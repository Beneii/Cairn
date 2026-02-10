import { appendEntry } from "@cairn/ledger";
import type { Artifact, LedgerEntryType } from "@cairn/shared";
import { bus, newId, now } from "@cairn/shared";

// Security: URL validation helpers (prevent SSRF)
function isPrivateIP(hostname: string): boolean {
  // RFC1918 private IP ranges
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^localhost$/i,
    /^169\.254\./, // Link-local
  ];
  return privateRanges.some((pattern) => pattern.test(hostname));
}

function isMetadataEndpoint(hostname: string): boolean {
  // Cloud metadata endpoints
  const metadataHosts = [
    "169.254.169.254", // AWS/Azure/GCP
    "metadata.google.internal",
    "metadata",
  ];
  return metadataHosts.includes(hostname.toLowerCase());
}

function isSafeURL(urlString: string): { safe: boolean; reason?: string } {
  try {
    const url = new URL(urlString);

    // Only allow HTTP/HTTPS
    if (!["http:", "https:"].includes(url.protocol)) {
      return { safe: false, reason: "Only HTTP/HTTPS protocols allowed" };
    }

    // Block private IPs
    if (isPrivateIP(url.hostname)) {
      return { safe: false, reason: "Private IP addresses are not allowed" };
    }

    // Block metadata endpoints
    if (isMetadataEndpoint(url.hostname)) {
      return { safe: false, reason: "Metadata endpoints are not allowed" };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: "Invalid URL format" };
  }
}

// Security: Memory key validation helpers
const SYSTEM_KEYS = ["config", "secrets", "internal", "_system"];

function isSystemKey(key: string): boolean {
  return SYSTEM_KEYS.some((prefix) => key.startsWith(prefix));
}

function isValidMemoryKey(key: string, jobId: string): { valid: boolean; reason?: string } {
  // Block system keys
  if (isSystemKey(key)) {
    return { valid: false, reason: "System keys are protected" };
  }

  // Enforce job namespace for hot memory
  // Note: warm memory allows global keys for shared context
  return { valid: true };
}

export interface ToolInput {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  artifact?: Artifact;
}

export interface ToolContext {
  jobId: string;
  nodeName: string;
  memoryRead: (tier: string, key: string) => unknown | undefined;
  memoryWrite: (tier: string, key: string, value: unknown) => Promise<void>;
}

export type ToolFn = (
  args: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<ToolResult>;

const toolRegistry = new Map<string, ToolFn>();

// ---- memory_read ----
toolRegistry.set("memory_read", async (args, ctx) => {
  const tier = args.tier as string;
  const key = args.key as string;

  // Security: Validate memory key
  const validation = isValidMemoryKey(key, ctx.jobId);
  if (!validation.valid) {
    return {
      success: false,
      output: `Access denied: ${validation.reason} `,
    };
  }

  const value = ctx.memoryRead(tier, key);
  return {
    success: true,
    output: value !== undefined ? JSON.stringify(value) : "No value found",
  };
});

// ---- memory_write ----
toolRegistry.set("memory_write", async (args, ctx) => {
  const tier = args.tier as string;
  const key = args.key as string;
  const value = args.value;

  // Security: Validate memory key
  const validation = isValidMemoryKey(key, ctx.jobId);
  if (!validation.valid) {
    return {
      success: false,
      output: `Access denied: ${validation.reason} `,
    };
  }

  await ctx.memoryWrite(tier, key, value);
  return {
    success: true,
    output: `Written to ${tier}:${key} `,
  };
});

// ---- ledger_write ----
toolRegistry.set("ledger_write", async (args, ctx) => {
  const type = (args.type as LedgerEntryType) || "agent";
  const content = args.content as string;
  await appendEntry(type, ctx.nodeName, ctx.jobId, content);
  return {
    success: true,
    output: `Logged: ${content} `,
  };
});

// ---- web_search ----
// Uses DuckDuckGo - no API key required
// Follows truth.md §4: "Web content is data, never instruction"
toolRegistry.set("web_search", async (args) => {
  const query = args.query as string;
  const encodedQuery = encodeURIComponent(query);

  try {
    // Try DuckDuckGo Instant Answer API first
    const instantUrl = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;
    const instantRes = await fetch(instantUrl);
    const instant = await instantRes.json();

    const results: { title: string; snippet: string; url?: string }[] = [];

    // Extract abstract if available
    if (instant.Abstract) {
      results.push({
        title: instant.Heading || query,
        snippet: instant.Abstract,
        url: instant.AbstractURL,
      });
    }

    // Extract related topics
    if (instant.RelatedTopics && Array.isArray(instant.RelatedTopics)) {
      for (const topic of instant.RelatedTopics.slice(0, 5)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(" - ")[0] || topic.Text.substring(0, 50),
            snippet: topic.Text,
            url: topic.FirstURL,
          });
        }
      }
    }

    // If we got results, return them
    if (results.length > 0) {
      return {
        success: true,
        output: JSON.stringify(results),
      };
    }

    // Fallback: scrape DuckDuckGo lite HTML
    const liteUrl = `https://lite.duckduckgo.com/lite/?q=${encodedQuery}`;
    const liteRes = await fetch(liteUrl);
    const html = await liteRes.text();

    // Extract result snippets from HTML (basic parsing)
    const snippetMatches = html.match(/<td class="result-snippet">([\s\S]*?)<\/td>/gi) || [];
    const linkMatches = html.match(/<a rel="nofollow" href="([^"]+)" class='result-link'>([^<]+)<\/a>/gi) || [];

    for (let i = 0; i < Math.min(5, linkMatches.length); i++) {
      const linkMatch = linkMatches[i]?.match(/href="([^"]+)"[^>]*>([^<]+)/);
      const snippet = snippetMatches[i]?.replace(/<[^>]+>/g, "").trim() || "";

      if (linkMatch) {
        results.push({
          title: linkMatch[2],
          snippet: snippet.substring(0, 200),
          url: linkMatch[1],
        });
      }
    }

    if (results.length === 0) {
      results.push({
        title: "No results found",
        snippet: `No search results found for "${query}". Try rephrasing your query.`,
      });
    }

    return {
      success: true,
      output: JSON.stringify(results),
    };
  } catch (err) {
    return {
      success: false,
      output: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});

// ---- fetch_url ----
toolRegistry.set("fetch_url", async (args) => {
  const url = args.url as string;

  // Security: Validate URL safety (prevent SSRF)
  const urlValidation = isSafeURL(url);
  if (!urlValidation.safe) {
    return {
      success: false,
      output: `URL blocked: ${urlValidation.reason}`,
    };
  }

  try {
    const res = await fetch(url);
    const text = await res.text();
    // Return first 2000 chars
    return {
      success: true,
      output: text.substring(0, 2000),
    };
  } catch (err) {
    return {
      success: false,
      output: `Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});

// ---- gmail_read ----
// Read emails from Gmail (requires Google OAuth setup)
toolRegistry.set("gmail_read", async (args) => {
  try {
    // Dynamic import to avoid breaking if integrations not installed
    const { isGoogleAuthenticated, getRecentEmails, getUnreadCount } = await import("@cairn/integrations");

    if (!isGoogleAuthenticated()) {
      return {
        success: false,
        output: "Gmail not connected. Set up Google OAuth in Integrations page.",
      };
    }

    const maxResults = (args.max_results as number) || 5;
    const emails = await getRecentEmails(maxResults);
    const unreadCount = await getUnreadCount();

    return {
      success: true,
      output: JSON.stringify({ unread_count: unreadCount, emails }),
    };
  } catch (err) {
    return {
      success: false,
      output: `Gmail error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});

// ---- calendar_read ----
// Read calendar events (requires Google OAuth setup)
toolRegistry.set("calendar_read", async (args) => {
  try {
    const { isGoogleAuthenticated, getTodayEvents, getUpcomingEvents } = await import("@cairn/integrations");

    if (!isGoogleAuthenticated()) {
      return {
        success: false,
        output: "Calendar not connected. Set up Google OAuth in Integrations page.",
      };
    }

    const days = (args.days as number) || 1;
    const events = days === 1 ? await getTodayEvents() : await getUpcomingEvents(days);

    return {
      success: true,
      output: JSON.stringify({ event_count: events.length, events }),
    };
  } catch (err) {
    return {
      success: false,
      output: `Calendar error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});

// ---- vector_search ----
// Semantic search over cold memory
toolRegistry.set("vector_search", async (args) => {
  try {
    const { initColdMemory, initEmbeddingService, isEmbeddingAvailable, createEmbedding, vectorSearch, getColdMemoryStats } = await import("@cairn/memory");

    initColdMemory();
    initEmbeddingService();

    if (!isEmbeddingAvailable()) {
      return {
        success: false,
        output: "Embedding service not available. Set OPENAI_API_KEY.",
      };
    }

    const query = args.query as string;
    if (!query) {
      return { success: false, output: "Query required" };
    }

    const stats = getColdMemoryStats();
    if (stats.chunkCount === 0) {
      return { success: true, output: "Cold memory is empty." };
    }

    const { embedding } = await createEmbedding(query);
    const results = vectorSearch(embedding, 5, 0.3);

    return {
      success: true,
      output: JSON.stringify(results.map(r => ({
        content: r.content,
        score: r.score.toFixed(3),
        source: r.document_title
      }))),
    };

  } catch (err) {
    return {
      success: false,
      output: `Vector search error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});

// ---- goals_read ----
// Read active goals so the agent knows what the user is working toward
toolRegistry.set("goals_read", async () => {
  try {
    const { getGoals, getActiveGoals } = await import("@cairn/goals");
    const active = getActiveGoals();
    const all = getGoals();
    return {
      success: true,
      output: JSON.stringify({
        active_count: active.length,
        total_count: all.length,
        active: active.map((g: any) => ({
          id: g.id,
          title: g.title,
          success_definition: g.success_definition,
          priority: g.priority,
          time_horizon: g.time_horizon,
          confidence: g.confidence,
          anti_goals: g.anti_goals,
          metrics: g.metrics,
          timeline_events: g.timeline?.length || 0,
          last_reviewed: g.last_reviewed,
        })),
      }),
    };
  } catch (err) {
    return {
      success: false,
      output: `Goals read error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});

// ---- goals_update ----
// Update a goal (status, timeline event, confidence, etc.)
toolRegistry.set("goals_update", async (args) => {
  try {
    const { updateGoal, getGoal } = await import("@cairn/goals");
    const { bus, newId } = await import("@cairn/shared");

    const goalId = args.goal_id as string;
    if (!goalId) return { success: false, output: "goal_id required" };

    const goal = getGoal(goalId);
    if (!goal) return { success: false, output: `Goal ${goalId} not found` };

    const changes: Record<string, unknown> = {};

    // Allow updating specific fields
    if (args.status) changes.status = args.status;
    if (args.confidence !== undefined) changes.confidence = args.confidence;
    if (args.blocked_reason) changes.blocked_reason = args.blocked_reason;

    // Add timeline event if provided
    if (args.timeline_message) {
      const event = {
        id: newId(),
        timestamp: new Date().toISOString(),
        type: (args.timeline_type as string) || "comment",
        message: args.timeline_message as string,
        agent: "cairn",
      };
      changes.timeline = [...(goal.timeline || []), event];
    }

    const updated = updateGoal(goalId, changes);
    if (!updated) return { success: false, output: "Update failed" };

    // Broadcast the change
    const { getGoals } = await import("@cairn/goals");
    bus.emit("goals:updated", getGoals());

    return {
      success: true,
      output: `Updated goal "${goal.title}": ${JSON.stringify(Object.keys(changes))}`,
    };
  } catch (err) {
    return {
      success: false,
      output: `Goals update error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});

// ---- tasks_read ----
// Read current tasks
toolRegistry.set("tasks_read", async (args) => {
  try {
    const { getTasks } = await import("@cairn/tasks");
    const filter = args.status ? { status: args.status as any } : undefined;
    const tasks = getTasks(filter);
    return {
      success: true,
      output: JSON.stringify({
        count: tasks.length,
        tasks: tasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          type: t.type,
          due_date: t.due_date,
          scheduled_date: t.scheduled_date,
          recurrence_rule: t.recurrence_rule,
          source: t.source,
        })),
      }),
    };
  } catch (err) {
    return {
      success: false,
      output: `Tasks read error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});

// ---- tasks_create ----
// Create a task (agent-suggested or on behalf of user)
toolRegistry.set("tasks_create", async (args) => {
  try {
    const { createTask } = await import("@cairn/tasks");
    const { bus } = await import("@cairn/shared");

    const title = args.title as string;
    if (!title) return { success: false, output: "title required" };

    const task = createTask({
      title,
      type: (args.type as "one-off" | "recurring") || "one-off",
      due_date: args.due_date as string | undefined,
      scheduled_date: args.scheduled_date as string | undefined,
      recurrence_rule: args.recurrence_rule as any,
      source: "cairn",
      suggested_by_agent: true,
    });

    // Broadcast
    const { getTasks } = await import("@cairn/tasks");
    bus.emit("tasks:updated", getTasks());

    return {
      success: true,
      output: `Created task: "${task.title}" (id: ${task.id})`,
    };
  } catch (err) {
    return {
      success: false,
      output: `Task create error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});

// ---- tasks_complete ----
// Mark a task as done
toolRegistry.set("tasks_complete", async (args) => {
  try {
    const { completeTask, getTasks } = await import("@cairn/tasks");
    const { bus } = await import("@cairn/shared");

    const taskId = args.task_id as string;
    if (!taskId) return { success: false, output: "task_id required" };

    const result = completeTask(taskId);
    if (!result) return { success: false, output: `Task ${taskId} not found` };

    bus.emit("tasks:updated", getTasks());

    return {
      success: true,
      output: `Completed task: "${result.title}"`,
    };
  } catch (err) {
    return {
      success: false,
      output: `Task complete error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});

// ---- research_ingest ----
// Securely ingest web content or PDF into cold memory
toolRegistry.set("research_ingest", async (args) => {
  try {
    const url = args.url as string;
    if (!url) return { success: false, output: "URL required" };

    // Security: Validate URL safety
    const urlValidation = isSafeURL(url);
    if (!urlValidation.safe) {
      return { success: false, output: `URL blocked: ${urlValidation.reason}` };
    }

    const { ingestSource } = await import("@cairn/research");
    const result = await ingestSource(url);

    return {
      success: true,
      output: `Successfully ingested ${result.type}: "${result.title}" (${result.charCount} characters). Document ID: ${result.documentId}`,
    };
  } catch (err) {
    return {
      success: false,
      output: `Ingestion failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});

// ---- browser_fill ----
// Fill an input field
toolRegistry.set("browser_fill", async (args) => {
  const browser = await getBrowser();
  try {
    const selector = args.selector as string;
    const value = args.value as string;
    if (!selector || value === undefined) return { success: false, output: "Selector and value required" };

    await browser.init();
    const result = await browser.fill(selector, value);
    return { success: result.success, output: result.message };
  } catch (err) {
    return { success: false, output: `Fill failed: ${err instanceof Error ? err.message : String(err)}` };
  }
});

// ---- browser_press ----
// Press a key (e.g. Enter)
toolRegistry.set("browser_press", async (args) => {
  const browser = await getBrowser();
  try {
    const key = args.key as string;
    if (!key) return { success: false, output: "Key required" };

    await browser.init();
    const result = await browser.press(key);
    return { success: result.success, output: result.message };
  } catch (err) {
    return { success: false, output: `Press failed: ${err instanceof Error ? err.message : String(err)}` };
  }
});

// ---- browser_type ----
// Type text into an input field (wait+click+type)
toolRegistry.set("browser_type", async (args) => {
  const browser = await getBrowser();
  try {
    const selector = args.selector as string;
    const text = args.text as string;
    const delay = (args.delay as number) || 50;
    if (!selector || text === undefined) return { success: false, output: "Selector and text required" };

    await browser.init();
    const result = await browser.type(selector, text, delay);
    return { success: result.success, output: result.message };
  } catch (err) {
    return { success: false, output: `Type failed: ${err instanceof Error ? err.message : String(err)}` };
  }
});

// Global browser instance for persistence
let globalBrowser: any = null;
async function getBrowser() {
  const { BrowserOperator } = await import("@cairn/browser");
  if (!globalBrowser) {
    console.log(`[tools:${process.pid}] Initializing new globalBrowser instance`);
    // Use a specific debug profile to avoid conflicts with zombies
    globalBrowser = new BrowserOperator({ profileId: 'debug-session' });
  } else {
    console.log(`[tools:${process.pid}] Reusing existing globalBrowser instance`);
  }
  return globalBrowser;
}

// ---- browser_navigate ----
// Securely navigate the browser to a given URL
toolRegistry.set("browser_navigate", async (args) => {
  const browser = await getBrowser();
  try {
    const url = args.url as string;
    if (!url) return { success: false, output: "URL required" };

    await browser.init();
    const result = await browser.navigate(url);

    // Capture title for better feedback
    let title = "";
    try {
      const page = await browser.getPage();
      title = await page.title();
    } catch (e) {
      // Ignore title error
    }

    return {
      success: result.success,
      output: result.success ? `Navigated to ${url} (Title: ${title})` : result.message
    };
  } catch (err) {
    return { success: false, output: `Navigation failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  // Do NOT close browser automatically
});

// ---- browser_close ----
// Close the browser session
toolRegistry.set("browser_close", async () => {
  if (globalBrowser) {
    console.log("[tools] Explicitly closing browser session");
    await globalBrowser.close();
    globalBrowser = null;
    return { success: true, output: "Browser session closed." };
  }
  return { success: true, output: "No active browser session." };
});

// ---- browser_click ----
// Click an element in the current browser page
toolRegistry.set("browser_click", async (args) => {
  const browser = await getBrowser();
  try {
    const selector = args.selector as string;
    const url = args.url as string; // Navigate if provided
    if (!selector) return { success: false, output: "Selector required" };

    await browser.init();
    if (url) await browser.navigate(url);

    const result = await browser.click(selector);
    return { success: result.success, output: result.message };
  } catch (err) {
    return { success: false, output: `Click failed: ${err instanceof Error ? err.message : String(err)}` };
  }
});

// ---- browser_screenshot ----
// Capture a screenshot of the current page
toolRegistry.set("browser_screenshot", async (args) => {
  const browser = await getBrowser();
  try {
    const url = args.url as string;
    await browser.init();
    if (url) await browser.navigate(url);

    const result = await browser.screenshot();

    return {
      success: result.success,
      output: `Screenshot captured: ${result.screenshotPath}`,
      artifacts: result.screenshotPath ? [{
        id: newId(),
        type: "image",
        content: result.screenshotPath,
        metadata: { path: result.screenshotPath },
        origin_node: "executor",
        created_at: now()
      }] : []
    };
  } catch (err) {
    return { success: false, output: `Screenshot failed: ${err instanceof Error ? err.message : String(err)}` };
  }
});

// ---- browser_observe ----
// Get a structured summary of the current page
toolRegistry.set("browser_observe", async (args) => {
  const browser = await getBrowser();
  try {
    await browser.init();
    const result = await browser.observe();
    if (!result.success) return { success: false, output: "Observation failed" };

    const summary = `URL: ${result.url}\nTitle: ${result.title}\nInteractive Elements:\n` +
      result.elements.map((el: any) => `- [${el.id}] ${el.tag}${el.type ? ` (${el.type})` : ''}: "${el.text}" ${el.aria ? `[aria: ${el.aria}]` : ''} ${el.selector ? `(selector: ${el.selector})` : ''}`).join("\n");

    return { success: true, output: summary };
  } catch (err) {
    return { success: false, output: `Observation failed: ${err instanceof Error ? err.message : String(err)}` };
  }
});

// ---- note_create ----
// Create a persistent note/document in the dashboard
toolRegistry.set("note_create", async (args) => {
  try {
    const content = args.content as string;
    if (!content) return { success: false, output: "Content required" };

    // Emit event for the UI/gateway to pick up and store
    bus.emit("note:create" as any, { content });

    return {
      success: true,
      output: "Note created successfully in the dashboard.",
      artifacts: [{
        id: newId(),
        type: "note",
        content,
        metadata: {},
        origin_node: "executor",
        created_at: now()
      }]
    };
  } catch (err) {
    return { success: false, output: `Note creation failed: ${err instanceof Error ? err.message : String(err)}` };
  }
});

export function getTool(name: string): ToolFn | undefined {
  return toolRegistry.get(name);
}

export function listTools(): string[] {
  return Array.from(toolRegistry.keys());
}
