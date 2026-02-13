/**
 * Deterministic Pre-Router — Cairn V2
 * 
 * Fast, rule-based, zero-LLM layer that catches obvious intents
 * before burning tokens on the classifier.
 * 
 * This layer NEVER invokes an LLM.
 */

import type { PreRouteDecision } from "@cairn/shared";

// ---- Pattern Matchers ----

const GREETING_RE = /^(hi|hello|hey|yo|sup|good\s+(morning|afternoon|evening)|thanks|thank you|ok|okay|cool|nice|great|gm|gn)\b[!.?\s]*$/i;
const EMOJI_ONLY_RE = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+$/u;
const COMMAND_RE = /^\/(\w+)(?:\s+(.*))?$/;
const WEB_RE = /\b(search|look\s*up|latest|find\s+.*\s+online|google|youtube|browse|go\s+to|visit|navigate\s+to)\b/i;

// Direct skill invocation patterns — skip classifier entirely
const SKILL_PATTERNS: { pattern: RegExp; skillId: string; extractArgs: (match: RegExpMatchArray) => Record<string, any> }[] = [
    {
        pattern: /^(?:create|add|new)\s+task\s+(.+)$/i,
        skillId: "task.create",
        extractArgs: (m) => ({ title: m[1].trim() }),
    },
    {
        pattern: /^(?:complete|finish|done|check\s+off)\s+task\s+(.+)$/i,
        skillId: "task.complete",
        extractArgs: (m) => ({ title: m[1].trim() }),
    },
    {
        pattern: /^(?:create|add|new)\s+note\s+(.+)$/i,
        skillId: "note.create",
        extractArgs: (m) => ({ content: m[1].trim() }),
    },
];

// Command keyword → locked intent mapping
const COMMAND_MAP: Record<string, string> = {
    help: "help",
    status: "status",
    health: "health",
    heartbeat: "heartbeat",
    config: "config",
    goals: "goal.read",
    tasks: "task.read",
    memory: "memory.read",
    calendar: "calendar.read",
};

// ---- Pre-Router ----

export function preRoute(userText: string): PreRouteDecision {
    const trimmed = userText.trim();

    // 1. Empty or whitespace-only
    if (!trimmed) {
        return {
            route: "DIRECT",
            lockedIntent: "empty",
            directResponse: "Hey! What can I help you with?",
            reason: "Empty input",
        };
    }

    // 2. Greeting detection
    if (GREETING_RE.test(trimmed)) {
        return {
            route: "DIRECT",
            lockedIntent: "greeting",
            directResponse: getGreetingResponse(trimmed),
            reason: "Greeting matched deterministic pattern",
        };
    }

    // 3. Emoji-only detection
    if (EMOJI_ONLY_RE.test(trimmed)) {
        return {
            route: "DIRECT",
            lockedIntent: "emoji",
            directResponse: "👍",
            reason: "Emoji-only message",
        };
    }

    // 4. Explicit command keywords (slash commands)
    const cmdMatch = trimmed.match(COMMAND_RE);
    if (cmdMatch) {
        const command = cmdMatch[1].toLowerCase();
        const mappedIntent = COMMAND_MAP[command];
        if (mappedIntent) {
            return {
                route: "DIRECT",
                lockedIntent: mappedIntent,
                reason: `Slash command: /${command}`,
            };
        }
        // Unknown command → still route to classifier
        return {
            route: "LLM_CLASSIFY",
            reason: `Unknown slash command: /${command}`,
        };
    }

    // 5. Direct skill invocation patterns
    for (const { pattern, skillId, extractArgs } of SKILL_PATTERNS) {
        const match = trimmed.match(pattern);
        if (match) {
            return {
                route: "DIRECT",
                lockedIntent: skillId,
                reason: `Skill pattern matched: ${skillId}`,
            };
        }
    }

    // 6. Web action patterns — hint for classifier but don't lock
    if (WEB_RE.test(trimmed)) {
        return {
            route: "LLM_CLASSIFY",
            reason: "Web action pattern detected — needs classifier for specifics",
        };
    }

    // 7. Default: route to LLM classifier
    return {
        route: "LLM_CLASSIFY",
        reason: "No deterministic pattern matched",
    };
}

/**
 * Extract skill arguments from a direct-match pattern.
 * Only call this when preRoute returns a lockedIntent that matches a SKILL_PATTERNS entry.
 */
export function extractSkillArgs(userText: string, skillId: string): Record<string, any> | undefined {
    for (const { pattern, skillId: sid, extractArgs } of SKILL_PATTERNS) {
        if (sid === skillId) {
            const match = userText.trim().match(pattern);
            if (match) return extractArgs(match);
        }
    }
    return undefined;
}

// ---- Helpers ----

function getGreetingResponse(input: string): string {
    const lower = input.toLowerCase().trim().replace(/[!.?\s]+$/, "");

    if (/^(thanks|thank you)/.test(lower)) return "You're welcome! Anything else?";
    if (/^good\s+morning/.test(lower)) return "Good morning! What's on the agenda?";
    if (/^good\s+afternoon/.test(lower)) return "Good afternoon! How can I help?";
    if (/^good\s+evening/.test(lower)) return "Good evening! What do you need?";
    if (/^(gm)$/.test(lower)) return "Good morning! What's on the agenda?";
    if (/^(gn)$/.test(lower)) return "Good night! Rest well.";

    return "Hey! What can I help you with?";
}
