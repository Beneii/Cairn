import OpenAI from "openai";
import type { CostEntry, ChatAttachment } from "@cairn/shared";
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
  attachments?: ChatAttachment[];
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
    const localModel = nodeConfig.local_model || "phi3.5:latest"; // Fallback safety

    // Convert attachments to base64 images for Ollama
    let images: string[] | undefined;
    if (req.attachments && req.attachments.length > 0) {
      images = req.attachments
        .filter(a => a.type === "image" && a.dataUrl)
        .map(a => a.dataUrl.split(",")[1]); // Remove data:image/png;base64, prefix
    }

    try {
      const ollamaRes = await chatOllama({
        model: localModel,
        messages: req.messages ? req.messages.map(m => ({
          role: m.role,
          content: m.content as string
        })) : [
          { role: "system", content: req.systemPrompt },
          {
            role: "user",
            content: req.userMessage,
            images
          }
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

      // Enhance error message for common Ollama issues
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("404")) {
        throw new Error(`Local model '${localModel}' not found. logical name: ${nodeName}. Run 'ollama pull ${localModel}' to fix.`);
      }
      if (msg.includes("fetch failed") || msg.includes("ECONNREFUSED")) {
        throw new Error(`Ollama is not running. Start it with 'ollama serve'.`);
      }

      throw err;
    }
  }

  // ---- CLOUD MODE (OPENAI) ----
  if (!client) {
    throw new Error("LLM not available — set OPENAI_API_KEY to enable AI");
  }

  // Construct messages with potential image attachments
  let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = req.messages || [];

  if (!req.messages) {
    const systemMsg: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
      role: "system",
      content: req.systemPrompt
    };

    let userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] | string = req.userMessage;

    // SCENARIO: Attachments present -> convert to multimodal content array
    if (req.attachments && req.attachments.length > 0) {
      userContent = [
        { type: "text", text: req.userMessage }
      ];

      for (const att of req.attachments) {
        if (att.type === "image" && att.dataUrl) {
          userContent.push({
            type: "image_url",
            image_url: {
              url: att.dataUrl, // OpenAI accepts data:image/... base64 URLs directly
              detail: "auto"
            }
          });
        }
      }
    }

    const userMsg: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
      role: "user",
      content: userContent
    };

    messages = [systemMsg, userMsg];
  }

  const response = await client.chat.completions.create({
    model: req.model,
    messages: validMessages(messages),
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


// Helper to ensure TypeScript is happy with the message types
function validMessages(msgs: any[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return msgs as OpenAI.Chat.Completions.ChatCompletionMessageParam[];
}
