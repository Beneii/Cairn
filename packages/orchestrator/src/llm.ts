import OpenAI from "openai";
import type { CostEntry } from "@cairn/shared";
import { calculateCost, now } from "@cairn/shared";

let client: OpenAI | null = null;
let initialized = false;

export function initLLM(): void {
  if (initialized) return;
  initialized = true;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[orchestrator] LLM disabled (no OPENAI_API_KEY)");
    return;
  }
  client = new OpenAI({ apiKey });
  console.log("[orchestrator] LLM initialized");
}

export function isLLMAvailable(): boolean {
  return client !== null;
}

export interface LLMRequest {
  model: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens: number;
  responseFormat?: "text" | "json_object";
}

export interface LLMResponse {
  content: string;
  cost: CostEntry;
  finishReason: string;
}

export async function callLLM(
  req: LLMRequest,
  nodeName: string,
  jobId: string,
): Promise<LLMResponse> {
  if (!client) {
    throw new Error("LLM not available — set OPENAI_API_KEY to enable AI");
  }

  const response = await client.chat.completions.create({
    model: req.model,
    messages: [
      { role: "system", content: req.systemPrompt },
      { role: "user", content: req.userMessage },
    ],
    max_tokens: req.maxTokens,
    ...(req.responseFormat === "json_object"
      ? { response_format: { type: "json_object" } }
      : {}),
  });

  const choice = response.choices[0];
  const usage = response.usage;

  const cost: CostEntry = {
    node: nodeName,
    model: req.model,
    prompt_tokens: usage?.prompt_tokens ?? 0,
    completion_tokens: usage?.completion_tokens ?? 0,
    cost_usd: calculateCost(
      req.model,
      usage?.prompt_tokens ?? 0,
      usage?.completion_tokens ?? 0,
    ),
    timestamp: now(),
  };

  return {
    content: choice?.message?.content ?? "",
    cost,
    finishReason: choice?.finish_reason ?? "unknown",
  };
}
