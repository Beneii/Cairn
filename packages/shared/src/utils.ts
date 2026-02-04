import { randomUUID, createHash } from "crypto";

export function newId(): string {
  return randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}

export function shortTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function hashString(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** USD per 1K tokens for supported models */
export const MODEL_COSTS: Record<
  string,
  { prompt: number; completion: number }
> = {
  "gpt-4o-mini": { prompt: 0.00015, completion: 0.0006 },
  "gpt-4o": { prompt: 0.0025, completion: 0.01 },
};

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const rates = MODEL_COSTS[model];
  if (!rates) return 0;
  return (
    (promptTokens / 1000) * rates.prompt +
    (completionTokens / 1000) * rates.completion
  );
}
