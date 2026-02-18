/**
 * Pipeline Test Prompts — Cairn
 *
 * Defines test cases for the orchestrator pipeline harness.
 * Each case has a prompt, category, and expected behavior assertions.
 */

export interface TestExpectation {
  /** Routes the pre-router should NOT produce */
  routeNot?: string[];
  /** Acceptable action types from the contract builder */
  actionTypeIn?: string[];
  /** Phrases that must NOT appear in the final response */
  responseNotContains?: string[];
  /** Phrases that MUST appear in the final response */
  responseContains?: string[];
  /** At least one of these skills should be invoked */
  skillsUsed?: string[];
  /** Maximum acceptable latency in ms */
  maxLatencyMs?: number;
}

export interface TestCase {
  id: string;
  prompt: string;
  category: string;
  description: string;
  expect: TestExpectation;
}

// ---- Banned phrases (applies globally unless overridden) ----

export const GLOBAL_BANNED_PHRASES = [
  "I can't do that",
  "I don't have the ability",
  "I'm not able to",
  "you'll need to do",
  "you should go",
  "I cannot help with",
  "I'm unable to",
];

// ---- Test Cases ----

export const TEST_CASES: TestCase[] = [
  // ===== ACTION BIAS =====
  // These should route to skill or plan, never "none"
  {
    id: "action-1",
    prompt: "Draft me an email to my boss about taking Friday off",
    category: "action-bias",
    description: "Should attempt to draft content, not refuse",
    expect: {
      actionTypeIn: ["skill", "plan", "none"], // "none" OK if conversational response still drafts content
      responseNotContains: GLOBAL_BANNED_PHRASES,
    },
  },
  {
    id: "action-2",
    prompt: "Help me plan my week",
    category: "action-bias",
    description: "Should use planner to compose calendar + tasks + goals",
    expect: {
      actionTypeIn: ["plan", "skill", "none"],
      responseNotContains: GLOBAL_BANNED_PHRASES,
    },
  },
  {
    id: "action-3",
    prompt: "Research the best protein powder for endurance athletes",
    category: "action-bias",
    description: "Should attempt web search or provide knowledge",
    expect: {
      responseNotContains: GLOBAL_BANNED_PHRASES,
    },
  },
  {
    id: "action-4",
    prompt: "Summarize my goals and tasks into a status update",
    category: "action-bias",
    description: "Should compose from goal.read + task.read",
    expect: {
      responseNotContains: GLOBAL_BANNED_PHRASES,
    },
  },

  // ===== CREATIVE COMPOSITION =====
  // Should use the planner to chain multiple skills
  {
    id: "compose-1",
    prompt: "Give me a morning briefing with my calendar and goals",
    category: "creative-composition",
    description: "Should plan with calendar.read + goal.read",
    expect: {
      actionTypeIn: ["plan"],
      responseNotContains: GLOBAL_BANNED_PHRASES,
    },
  },
  {
    id: "compose-2",
    prompt: "Check my tasks and goals and write me a note summarizing what I need to focus on",
    category: "creative-composition",
    description: "Should chain task.read + goal.read + note.create",
    expect: {
      actionTypeIn: ["plan"],
      responseNotContains: GLOBAL_BANNED_PHRASES,
    },
  },

  // ===== NO REFUSAL =====
  // Even without the perfect skill, should help creatively
  {
    id: "no-refuse-1",
    prompt: "Send a message to John saying I'll be late",
    category: "no-refusal",
    description: "No direct messaging skill — should draft the message content",
    expect: {
      responseNotContains: GLOBAL_BANNED_PHRASES,
    },
  },
  {
    id: "no-refuse-2",
    prompt: "Book a restaurant for tonight at 7pm",
    category: "no-refusal",
    description: "No booking skill — should help creatively (suggestions, draft request)",
    expect: {
      responseNotContains: GLOBAL_BANNED_PHRASES,
    },
  },
  {
    id: "no-refuse-3",
    prompt: "Translate this to French: Hello, how are you?",
    category: "no-refusal",
    description: "Should provide the translation directly",
    expect: {
      responseNotContains: GLOBAL_BANNED_PHRASES,
    },
  },

  // ===== DIRECT SKILL =====
  // Should hit pre-router fast path, no LLM needed
  {
    id: "direct-1",
    prompt: "Create task buy groceries",
    category: "direct-skill",
    description: "Pre-router pattern match → task.create",
    expect: {
      skillsUsed: ["task.create"],
      maxLatencyMs: 5000,
    },
  },
  {
    id: "direct-2",
    prompt: "Create note remember to call dentist",
    category: "direct-skill",
    description: "Pre-router pattern match → note.create",
    expect: {
      skillsUsed: ["note.create"],
      maxLatencyMs: 5000,
    },
  },
  {
    id: "direct-3",
    prompt: "/goals",
    category: "direct-skill",
    description: "Command route → goal.read",
    expect: {
      skillsUsed: ["goal.read"],
      maxLatencyMs: 5000,
    },
  },
  {
    id: "direct-4",
    prompt: "hi",
    category: "direct-skill",
    description: "Greeting → DIRECT route with greeting response",
    expect: {
      maxLatencyMs: 1000,
    },
  },

  // ===== CONVERSATION =====
  // Should respond naturally without tools
  {
    id: "convo-1",
    prompt: "What do you think about AI?",
    category: "conversation",
    description: "Should give a conversational opinion",
    expect: {
      responseNotContains: GLOBAL_BANNED_PHRASES,
    },
  },
  {
    id: "convo-2",
    prompt: "Tell me a joke",
    category: "conversation",
    description: "Should tell a joke",
    expect: {
      responseNotContains: GLOBAL_BANNED_PHRASES,
    },
  },
];
