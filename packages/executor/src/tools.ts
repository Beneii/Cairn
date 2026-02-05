import { appendEntry } from "@cairn/ledger";
import type { Artifact, LedgerEntryType } from "@cairn/shared";
import { newId, now } from "@cairn/shared";

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
  // Note: warm memory allows global keys for user preferences
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
      output: `Access denied: ${validation.reason}`,
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
      output: `Access denied: ${validation.reason}`,
    };
  }

  await ctx.memoryWrite(tier, key, value);
  return {
    success: true,
    output: `Written to ${tier}:${key}`,
  };
});

// ---- ledger_write ----
toolRegistry.set("ledger_write", async (args, ctx) => {
  const type = (args.type as LedgerEntryType) || "agent";
  const content = args.content as string;
  await appendEntry(type, ctx.nodeName, ctx.jobId, content);
  return {
    success: true,
    output: `Logged: ${content}`,
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

export function getTool(name: string): ToolFn | undefined {
  return toolRegistry.get(name);
}

export function listTools(): string[] {
  return Array.from(toolRegistry.keys());
}
