import { bus, newId, now } from "@cairn/shared";
import { appendEntry } from "@cairn/ledger";
import { warmGet, warmSet } from "@cairn/memory";
import {
  createSkillRequest,
  initSkillRequestStore,
  type SkillRequest,
  getSkillMetrics,
} from "@cairn/skills";

export interface ExecutionObservation {
  skillId: string;
  success: boolean;
  output: string;
}

function detectMissingCapability(steps: ExecutionObservation[]): string | null {
  const failed = steps.filter((s) => !s.success);
  if (failed.length === 0) return null;

  const combined = failed.map((f) => f.output.toLowerCase()).join("\n");
  if (combined.includes("skill not found") || combined.includes("does not exist") || combined.includes("not available")) {
    return "missing_or_unavailable_skill";
  }
  if (combined.includes("requires approval") || combined.includes("never allowed")) {
    return "permission_or_policy_gap";
  }
  return null;
}

function inferRequiredTools(steps: ExecutionObservation[]): string[] {
  const failedSkills = steps.filter((s) => !s.success).map((s) => s.skillId);
  if (failedSkills.some((s) => s.startsWith("web."))) return ["web_search", "fetch_url"];
  if (failedSkills.some((s) => s.startsWith("calendar."))) return ["calendar_read"];
  if (failedSkills.some((s) => s.startsWith("email."))) return ["gmail_read"];
  return [];
}

function inferProposedTier(capability: string): number {
  if (capability === "permission_or_policy_gap") return 2;
  return 1;
}

function shortSummary(userInput: string): string {
  return userInput.slice(0, 500);
}

function computeGapConfidence(steps: ExecutionObservation[]): number {
  const failed = steps.filter((s) => !s.success);
  if (failed.length === 0) return 1;

  let confidence = 1;
  const nowMs = Date.now();

  for (const step of failed) {
    const metrics = getSkillMetrics(step.skillId);
    if (!metrics) continue;

    if (metrics.failure_count > 5) {
      confidence *= 0.7;
    }

    if (metrics.invocation_count > 10) {
      const reliability = metrics.success_count / metrics.invocation_count;
      if (reliability < 0.5) {
        confidence *= 0.7;
      }
    }

    if (metrics.last_error_at && nowMs - metrics.last_error_at < 10 * 60 * 1000) {
      confidence *= 0.8;
    }
  }

  return confidence;
}

async function mirrorSkillRequestToWarmMemory(request: SkillRequest): Promise<void> {
  const existing = warmGet<SkillRequest[]>("skill_requests") || [];
  await warmSet("skill_requests", [request, ...existing].slice(0, 100));
}

async function createDurableSkillRequest(messageId: string, userInput: string, steps: ExecutionObservation[], capability: string): Promise<SkillRequest> {
  initSkillRequestStore();

  const request = createSkillRequest({
    goal: `Address capability gap: ${capability}`,
    required_tools: inferRequiredTools(steps),
    proposed_tier: inferProposedTier(capability),
    source_context: shortSummary(userInput),
  });

  await mirrorSkillRequestToWarmMemory(request);

  bus.emit("log:entry", {
    id: newId(),
    timestamp: now(),
    type: "agent",
    content: `Evaluator created SkillRequest ${request.id} (${capability})`,
  });

  await appendEntry(
    "agent",
    "evaluator",
    messageId,
    `SkillRequest created: ${request.id} (${capability})`,
    {
      request_id: request.id,
      missing_capability: capability,
      failed_skills: steps.filter((s) => !s.success).map((s) => s.skillId),
      required_tools: request.required_tools,
      proposed_tier: request.proposed_tier,
    },
  );

  return request;
}

export async function evaluateExecutionOutcome(input: {
  messageId: string;
  userInput: string;
  steps: ExecutionObservation[];
}): Promise<{ skillRequestId?: string; note?: string }> {
  const capability = detectMissingCapability(input.steps);
  if (!capability) return {};

  const gapConfidence = computeGapConfidence(input.steps);
  if (gapConfidence < 0.5) {
    return {
      note: "Execution looked like a transient reliability issue; no new SkillRequest queued yet.",
    };
  }

  const req = await createDurableSkillRequest(input.messageId, input.userInput, input.steps, capability);
  return {
    skillRequestId: req.id,
    note: `I've noted this as something I should be able to do and queued it for learning (${req.id.slice(0, 8)}).`,
  };
}
