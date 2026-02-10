import OpenAI from "openai";
import type { CostEntry } from "@cairn/shared";
import { calculateCost, now } from "@cairn/shared";
import { getNodeConfig } from "@cairn/policy";
import { chatOllama } from "./ollama.js";

let client: OpenAI | null = null;
let initialized = false;

export function initLLM(force = false): void {
  if (initialized && !force) return;
  initialized = true;

  const localMode = process.env.LOCAL_MODE_ENABLED === "true";
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey && !localMode) {
    client = null;
    console.warn("[orchestrator] LLM disabled (no OPENAI_API_KEY and Local Mode disabled)");
    return;
  }

  if (apiKey) {
    client = new OpenAI({ apiKey });
  }

  console.log("[orchestrator] LLM initialized (force=" + force + ", local=" + localMode + ")");
}

export function isLLMAvailable(): boolean {
  return client !== null || process.env.LOCAL_MODE_ENABLED === "true";
}

export interface LLMRequest {
  model: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens: number;
  responseFormat?: "text" | "json_object";
  messages?: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
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
  const localMode = process.env.LOCAL_MODE_ENABLED === "true";

  // ---- LOCAL MODE (OLLAMA) ----
  if (localMode) {
    const nodeConfig = getNodeConfig(nodeName);
    const localModel = nodeConfig.local_model || "phi-3.5-mini"; // Fallback safety

    try {
      const ollamaRes = await chatOllama({
        model: localModel,
        messages: req.messages ? req.messages.map(m => ({ role: m.role, content: m.content as string })) : [
          { role: "system", content: req.systemPrompt },
          { role: "user", content: req.userMessage }
        ],
        stream: false
      });

      // 0 cost for local
      const cost: CostEntry = {
        node: nodeName,
        model: localModel,
        prompt_tokens: ollamaRes.prompt_eval_count || 0,
        completion_tokens: ollamaRes.eval_count || 0,
        cost_usd: 0,
        timestamp: now(),
      };

      return {
        content: ollamaRes.message.content,
        cost,
        finishReason: ollamaRes.done ? "stop" : "unknown"
      };
    } catch (err) {
      console.error(`[llm] Local mode call failed for ${nodeName}:`, err);
      throw err;
    }
  }

  // ---- CLOUD MODE (OPENAI) ----
  if (!client) {
    throw new Error("LLM not available — set OPENAI_API_KEY to enable AI");
  }

  const response = await client.chat.completions.create({
    model: req.model,
    messages: req.messages || [
      { role: "system", content: req.systemPrompt },
      { role: "user", content: req.userMessage },
    ] as any,
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
