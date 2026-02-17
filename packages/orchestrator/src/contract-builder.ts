/**
 * Action Contract Builder — Cairn V2
 *
 * Deterministic gate that converts IntentClassification into a validated ActionContract.
 * Zero LLM involvement. Pure logic.
 *
 * Rules:
 * 1. If recommendedAction === "none" → actionType: "none"
 * 2. If suggestedSkillId not in registry → fall back to "plan" (try to compose existing skills)
 * 3. If skill found but required args missing → actionType: "none" with clarification
 * 4. If skill found and valid → actionType: "skill", validated contract
 * 5. If needsPlanner === true → actionType: "plan"
 */

import type { IntentClassification, ActionContract, FailureStatus } from "@cairn/shared";
import { getSkillDefinition, validateSkillInput } from "./skill-registry.js";

export interface ContractResult {
    contract: ActionContract;
    status: FailureStatus;
    clarificationNeeded?: string;
}

export function buildContract(classification: IntentClassification): ContractResult {
    // Rule 1: No action recommended
    if (classification.recommendedAction === "none") {
        return {
            contract: {
                actionType: "none",
                requiresConfirmation: false,
                justification: `User intent: ${classification.intent}. No action needed.`,
                confidence: classification.confidence,
            },
            status: "SUCCESS",
        };
    }

    // Rule 5: Plan required (multi-step)
    if (classification.recommendedAction === "plan" || classification.needsPlanner) {
        const skillId = classification.suggestedSkillId;

        // If a primary skill is suggested, validate it exists — but don't hard-fail
        if (skillId) {
            const skillDef = getSkillDefinition(skillId);
            if (!skillDef) {
                // Skill hint was wrong, but still let the planner try with all available skills
                return {
                    contract: {
                        actionType: "plan",
                        // Don't pass the invalid skillId — let planner choose freely
                        arguments: classification.suggestedArguments ?? undefined,
                        requiresConfirmation: false,
                        justification: `Plan needed for: ${classification.intent} (hint skill "${skillId}" unavailable, planner will compose from available skills)`,
                        confidence: classification.confidence * 0.8,
                    },
                    status: "SUCCESS",
                };
            }
        }

        return {
            contract: {
                actionType: "plan",
                skillId: skillId ?? undefined,
                arguments: classification.suggestedArguments ?? undefined,
                requiresConfirmation: false,
                justification: `Multi-step plan needed for: ${classification.intent}`,
                confidence: classification.confidence,
            },
            status: "SUCCESS",
        };
    }

    // Rule 2-4: Single skill execution
    const skillId = classification.suggestedSkillId;

    if (!skillId) {
        // Classifier said "skill" but didn't suggest one — escalate to planner
        return {
            contract: {
                actionType: "plan",
                requiresConfirmation: false,
                justification: `No specific skill matched for: ${classification.intent}. Planner will compose from available skills.`,
                confidence: classification.confidence * 0.8,
            },
            status: "SUCCESS",
        };
    }

    // Rule 2: Check skill exists — fall back to planner instead of hard-failing
    const skillDef = getSkillDefinition(skillId);
    if (!skillDef) {
        return {
            contract: {
                actionType: "plan",
                arguments: classification.suggestedArguments ?? undefined,
                requiresConfirmation: false,
                justification: `Skill "${skillId}" not found — planner will attempt to compose a solution for: ${classification.intent}`,
                confidence: classification.confidence * 0.7,
            },
            status: "SUCCESS",
        };
    }

    // Rule 3: Validate arguments
    const args = classification.suggestedArguments || {};
    const validation = validateSkillInput(skillId, args);

    if (!validation.valid) {
        return {
            contract: {
                actionType: "none",
                requiresConfirmation: false,
                justification: `Missing required fields for ${skillId}: ${validation.missingFields?.join(", ")}`,
                confidence: classification.confidence,
            },
            status: "SUCCESS", // Not a system failure — just needs clarification
            clarificationNeeded: `I need a bit more info to ${classification.intent}. Could you provide: ${validation.missingFields?.join(", ")}?`,
        };
    }

    // Rule 4: Build valid contract
    return {
        contract: {
            actionType: "skill",
            skillId,
            arguments: args,
            requiresConfirmation: skillDef.confirmationRequired || false,
            justification: `Executing ${skillId} for: ${classification.intent}`,
            confidence: classification.confidence,
        },
        status: "SUCCESS",
    };
}
