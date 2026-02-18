/**
 * Pipeline Test Harness — Cairn
 *
 * Sends test prompts through the full orchestrator pipeline,
 * captures events, runs assertions, and outputs a report.
 *
 * Usage: pnpm test:pipeline
 */

import path from "path";
import { fileURLToPath } from "url";
import { mkdir, writeFile } from "fs/promises";
import dotenv from "dotenv";

// Load env before any Cairn imports
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });

import { bus } from "@cairn/shared";
import type { ChatMessage, LogEntry, NucleusState, SubAgent } from "@cairn/shared";
import { initLedger } from "@cairn/ledger";
import { initWarmMemory } from "@cairn/memory";
import { initJobStore, initLLM, processMessage } from "@cairn/orchestrator";
import { initSkillRequestStore, initSkillMetricsStore } from "@cairn/skills";

import { TEST_CASES, GLOBAL_BANNED_PHRASES, type TestCase, type TestExpectation } from "./test-prompts.js";

// ---- Types ----

interface CapturedEvents {
  messages: ChatMessage[];
  logs: LogEntry[];
  states: { state: NucleusState; subAgents?: SubAgent[] }[];
}

interface ParsedTrace {
  route?: string;
  routeReason?: string;
  classifierIntent?: string;
  classifierAction?: string;
  contractAction?: string;
  contractSkill?: string;
  planSteps?: number;
  skillsExecuted: string[];
  errors: string[];
}

interface AssertionResult {
  name: string;
  passed: boolean;
  detail?: string;
}

interface TestResult {
  id: string;
  prompt: string;
  category: string;
  description: string;
  passed: boolean;
  latencyMs: number;
  response: string;
  tools: string[];
  trace: ParsedTrace;
  assertions: AssertionResult[];
  events: CapturedEvents;
}

// ---- Colors ----

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

// ---- Event Capture ----

function createEventCapture(): { events: CapturedEvents; attach: () => void; detach: () => void } {
  const events: CapturedEvents = { messages: [], logs: [], states: [] };

  const onMessage = (msg: ChatMessage) => events.messages.push(msg);
  const onLog = (entry: LogEntry) => events.logs.push(entry);
  const onState = (state: NucleusState, subAgents?: SubAgent[]) => events.states.push({ state, subAgents });

  return {
    events,
    attach() {
      bus.on("chat:message", onMessage);
      bus.on("log:entry", onLog);
      bus.on("nucleus:state", onState);
    },
    detach() {
      bus.off("chat:message", onMessage);
      bus.off("log:entry", onLog);
      bus.off("nucleus:state", onState);
    },
  };
}

// ---- Log Parsing ----

function parseTrace(logs: LogEntry[]): ParsedTrace {
  const trace: ParsedTrace = { skillsExecuted: [], errors: [] };

  for (const log of logs) {
    const c = log.content;

    // Pre-router: "Route: DIRECT | Reason: greeting_match"
    const routeMatch = c.match(/Route:\s*(\w+)\s*\|\s*Reason:\s*(.+)/);
    if (routeMatch) {
      trace.route = routeMatch[1];
      trace.routeReason = routeMatch[2].trim();
    }

    // Classifier: "Status: SUCCESS | Intent: ... | Action: ..."
    const classifierMatch = c.match(/Status:\s*\w+\s*\|\s*Intent:\s*(.+?)\s*\|\s*Action:\s*(.+)/);
    if (classifierMatch) {
      trace.classifierIntent = classifierMatch[1].trim();
      trace.classifierAction = classifierMatch[2].trim();
    }

    // Contract builder: "Action: skill | Skill: task.create | Status: SUCCESS"
    const contractMatch = c.match(/Action:\s*(\w+)\s*\|\s*Skill:\s*(.+?)\s*\|\s*Status:/);
    if (contractMatch) {
      trace.contractAction = contractMatch[1].trim();
      trace.contractSkill = contractMatch[2].trim();
    }

    // Planner: "Plan: 3 steps, max 5 calls, risk: low"
    const planMatch = c.match(/Plan:\s*(\d+)\s*steps/);
    if (planMatch) {
      trace.planSteps = parseInt(planMatch[1]);
    }

    // Skill execution: "Executing skill: task.create(...)"
    const skillExecMatch = c.match(/Executing skill:\s*([\w.]+)/);
    if (skillExecMatch) {
      trace.skillsExecuted.push(skillExecMatch[1]);
    }

    // Errors
    if (log.type === "error") {
      trace.errors.push(c);
    }
  }

  return trace;
}

// ---- Assertions ----

function runAssertions(
  testCase: TestCase,
  response: string,
  tools: string[],
  trace: ParsedTrace,
  latencyMs: number,
): AssertionResult[] {
  const results: AssertionResult[] = [];
  const expect = testCase.expect;

  // Route NOT assertions
  if (expect.routeNot) {
    for (const banned of expect.routeNot) {
      results.push({
        name: `route != ${banned}`,
        passed: trace.route !== banned,
        detail: trace.route ? `Got route: ${trace.route}` : "No route captured",
      });
    }
  }

  // Action type IN assertions
  if (expect.actionTypeIn) {
    const actual = trace.contractAction || (trace.route === "DIRECT" ? "direct" : "unknown");
    results.push({
      name: `actionType in [${expect.actionTypeIn.join(", ")}]`,
      passed: expect.actionTypeIn.includes(actual) || trace.route === "DIRECT",
      detail: `Got: ${actual} (route: ${trace.route || "?"})`,
    });
  }

  // Response NOT contains
  if (expect.responseNotContains) {
    const lower = response.toLowerCase();
    for (const banned of expect.responseNotContains) {
      const found = lower.includes(banned.toLowerCase());
      results.push({
        name: `response !~ "${banned}"`,
        passed: !found,
        detail: found ? `Found banned phrase in response` : undefined,
      });
    }
  }

  // Response contains
  if (expect.responseContains) {
    const lower = response.toLowerCase();
    for (const required of expect.responseContains) {
      const found = lower.includes(required.toLowerCase());
      results.push({
        name: `response ~ "${required}"`,
        passed: found,
        detail: !found ? `Required phrase not found in response` : undefined,
      });
    }
  }

  // Skills used
  if (expect.skillsUsed) {
    const allSkills = [...trace.skillsExecuted, ...tools];
    const found = expect.skillsUsed.some((s) => allSkills.includes(s));
    results.push({
      name: `skills used: [${expect.skillsUsed.join(", ")}]`,
      passed: found,
      detail: `Skills seen: [${allSkills.join(", ") || "none"}]`,
    });
  }

  // Max latency
  if (expect.maxLatencyMs) {
    results.push({
      name: `latency <= ${expect.maxLatencyMs}ms`,
      passed: latencyMs <= expect.maxLatencyMs,
      detail: `Actual: ${latencyMs}ms`,
    });
  }

  // If no specific assertions, at least check we got a response
  if (results.length === 0) {
    results.push({
      name: "got a response",
      passed: response.length > 0,
      detail: response.length === 0 ? "Empty response" : undefined,
    });
  }

  return results;
}

// ---- Runner ----

const TEST_TIMEOUT_MS = 30_000;

async function runTest(testCase: TestCase): Promise<TestResult> {
  const capture = createEventCapture();
  capture.attach();

  const start = Date.now();

  try {
    await Promise.race([
      processMessage(testCase.prompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Test timeout")), TEST_TIMEOUT_MS),
      ),
    ]);
  } catch (err) {
    capture.events.logs.push({
      id: "harness-error",
      timestamp: new Date().toISOString(),
      type: "error",
      content: `Harness error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // Wait for async events to settle
  await new Promise((r) => setTimeout(r, 300));

  capture.detach();

  const latencyMs = Date.now() - start;

  // Extract response from captured messages
  const cairnMessages = capture.events.messages.filter((m) => m.role === "cairn");
  const response = cairnMessages.map((m) => m.text).join("\n") || "";
  const tools = cairnMessages.flatMap((m) => m.tools || []);

  // Parse trace from logs
  const trace = parseTrace(capture.events.logs);

  // Run assertions
  const assertions = runAssertions(testCase, response, tools, trace, latencyMs);
  const passed = assertions.every((a) => a.passed);

  return {
    id: testCase.id,
    prompt: testCase.prompt,
    category: testCase.category,
    description: testCase.description,
    passed,
    latencyMs,
    response,
    tools,
    trace,
    assertions,
    events: capture.events,
  };
}

// ---- Reporter ----

function printResults(results: TestResult[]): void {
  console.log("\n" + BOLD + "═══════════════════════════════════════════" + RESET);
  console.log(BOLD + "  Cairn Pipeline Test Results" + RESET);
  console.log(BOLD + "═══════════════════════════════════════════" + RESET + "\n");

  // Group by category
  const categories = [...new Set(results.map((r) => r.category))];

  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    const catPassed = catResults.filter((r) => r.passed).length;
    const catColor = catPassed === catResults.length ? GREEN : RED;

    console.log(`${CYAN}${BOLD}[${cat}]${RESET} ${catColor}${catPassed}/${catResults.length}${RESET}`);

    for (const result of catResults) {
      const icon = result.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
      console.log(`  ${icon} ${result.id} ${DIM}(${result.latencyMs}ms)${RESET}`);
      console.log(`       ${DIM}${result.description}${RESET}`);

      if (!result.passed) {
        // Show failed assertions
        for (const a of result.assertions.filter((a) => !a.passed)) {
          console.log(`       ${RED}x ${a.name}${a.detail ? ` — ${a.detail}` : ""}${RESET}`);
        }
        // Show truncated response
        const truncated = result.response.substring(0, 150).replace(/\n/g, " ");
        console.log(`       ${YELLOW}Response: "${truncated}..."${RESET}`);
      }

      // Show trace summary
      const t = result.trace;
      const traceStr = [
        t.route && `route=${t.route}`,
        t.classifierIntent && `intent=${t.classifierIntent}`,
        t.contractAction && `action=${t.contractAction}`,
        t.skillsExecuted.length > 0 && `skills=[${t.skillsExecuted.join(",")}]`,
        t.planSteps && `plan=${t.planSteps}steps`,
      ]
        .filter(Boolean)
        .join(" → ");
      if (traceStr) {
        console.log(`       ${DIM}${traceStr}${RESET}`);
      }
    }
    console.log();
  }

  // Summary
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  const avgLatency = Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / total);

  console.log(BOLD + "───────────────────────────────────────────" + RESET);
  if (failed === 0) {
    console.log(`${GREEN}${BOLD}  ALL ${total} TESTS PASSED${RESET} ${DIM}(avg ${avgLatency}ms)${RESET}`);
  } else {
    console.log(`${RED}${BOLD}  ${failed} FAILED${RESET}, ${GREEN}${passed} passed${RESET} ${DIM}(avg ${avgLatency}ms)${RESET}`);
  }
  console.log(BOLD + "───────────────────────────────────────────" + RESET + "\n");
}

async function saveResults(results: TestResult[]): Promise<string> {
  const dir = path.join(PROJECT_ROOT, "data", "test-results");
  await mkdir(dir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(dir, `${timestamp}.json`);

  // Strip verbose event data for the JSON (keep logs, drop full messages)
  const slimResults = results.map((r) => ({
    ...r,
    events: {
      messageCount: r.events.messages.length,
      logCount: r.events.logs.length,
      stateTransitions: r.events.states.map((s) => s.state),
      logs: r.events.logs.map((l) => ({ type: l.type, content: l.content })),
    },
  }));

  const report = {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    avgLatencyMs: Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length),
    results: slimResults,
  };

  await writeFile(filePath, JSON.stringify(report, null, 2));
  return filePath;
}

// ---- Main ----

async function main() {
  console.log(`\n${BOLD}Cairn Pipeline Test Harness${RESET}`);
  console.log(`${DIM}Initializing services...${RESET}\n`);

  // Boot minimum services
  await initLedger();
  await initWarmMemory();
  await initJobStore();
  initLLM();
  initSkillRequestStore();
  initSkillMetricsStore();

  console.log(`${DIM}Running ${TEST_CASES.length} tests...${RESET}\n`);

  const results: TestResult[] = [];

  for (const testCase of TEST_CASES) {
    process.stdout.write(`  ${DIM}Running ${testCase.id}...${RESET}`);
    const result = await runTest(testCase);
    results.push(result);

    const icon = result.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
    process.stdout.write(`\r  ${icon} ${testCase.id} ${DIM}(${result.latencyMs}ms)${RESET}\n`);
  }

  // Print report
  printResults(results);

  // Save JSON
  const filePath = await saveResults(results);
  console.log(`${DIM}Full trace saved: ${filePath}${RESET}\n`);

  // Exit code
  const failed = results.filter((r) => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${RED}Harness crashed: ${err}${RESET}`);
  process.exit(2);
});
