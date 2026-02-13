/**
 * Action Contract Builder — Cairn V2
 * 
 * Deterministic gate that converts IntentClassification into a validated ActionContract.
 * Zero LLM involvement. Pure logic.
 * 
 * Rules:
 * 1. If recommendedAction === "none" → actionType: "none"
 * 2. If suggestedSkillId not in registry → SKILL_NOT_FOUND
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

        // If a primary skill is suggested, validate it exists
        if (skillId) {
            const skillDef = getSkillDefinition(skillId);
            if (!skillDef) {
                return {
                    contract: {
                        actionType: "none",
                        requiresConfirmation: false,
                        justification: `Suggested skill "${skillId}" not found in registry.`,
                        confidence: 0,
                    },
                    status: "SKILL_NOT_FOUND",
                };
            }
        }

        return {
            contract: {
                actionType: "plan",
                skillId: skillId,
                arguments: classification.suggestedArguments,
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
        // Classifier said "skill" but didn't suggest one
        return {
            contract: {
                actionType: "none",
                requiresConfirmation: false,
                justification: `Action type "skill" but no skill suggested for: ${classification.intent}`,
                confidence: 0,
            },
            status: "CONTRACT_VALIDATION_FAIL",
        };
    }

    // Rule 2: Check skill exists
    const skillDef = getSkillDefinition(skillId);
    if (!skillDef) {
        return {
            contract: {
                actionType: "none",
                requiresConfirmation: false,
                justification: `Skill "${skillId}" not found in registry.`,
                confidence: 0,
            },
            status: "SKILL_NOT_FOUND",
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
