
import { semanticRoute } from "@cairn/memory";
import { runSkillSpecialist, runClassifier } from "./subagents/index.js";
import { bus, newId, now, shortTime } from "@cairn/shared";
import { appendEntry } from "@cairn/ledger";

/**
 * The "Tool OS" Orchestrator
 * 
 * Flow:
 * 1. Semantic Route (Embeddings) - High Confidence (>0.85) -> Specialist
 * 2. Pre-Router (Regex/Commands) -> Specialist
 * 3. Classifier (Small LLM) - Low Confidence / Complex -> Planner
 * 4. Respond
 */
export async function processMessageV3(userInput: string): Promise<void> {
    const messageId = newId();
    const startTime = Date.now();
    
    try {
        bus.emit("nucleus:state", "thinking");

        // --- STEP 1: Semantic Routing (Math Path) ---
        const topMatches = await semanticRoute(userInput);
        const bestMatch = topMatches[0];

        if (bestMatch && bestMatch.score > 0.85) {
            await appendEntry("agent", "semantic-router", messageId, `Routed to ${bestMatch.skillId} (score: ${bestMatch.score.toFixed(2)})`);
            
            bus.emit("nucleus:state", "tooling");
            const result = await runSkillSpecialist(bestMatch.skillId, userInput, []);
            // ... dispatch to executor ...
            return;
        }

        // --- STEP 2: Fallback to Classifier (Reasoning Path) ---
        // Wakes up a small model only when the math is uncertain.
        const classification = await runClassifier(userInput, []);
        
        if (classification.recommendedAction === "skill") {
            // Specialist flow...
        } else if (classification.recommendedAction === "plan") {
            // Planner flow...
        } else {
            // Conversational flow...
        }

    } catch (err) {
        console.error("[orchestrator-v3] Pipeline failure:", err);
    } finally {
        bus.emit("nucleus:state", "idle");
    }
}
