const CODE_FENCE_RE = /^```(?:json)?\s*|\s*```$/gi;

function stripCodeFences(text: string): string {
  return text.trim().replace(CODE_FENCE_RE, "").trim();
}

function extractJsonObject(text: string): string | null {
  const cleaned = stripCodeFences(text);
  const start = cleaned.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === "\\") {
        escaped = true;
        continue;
      }

      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        return cleaned.slice(start, i + 1);
      }
    }
  }

  return null;
}

export function parseJsonObjectFromLLM(text: string): Record<string, unknown> {
  const extracted = extractJsonObject(text);
  if (!extracted) {
    throw new Error("No JSON object found in LLM output");
  }

  return JSON.parse(extracted) as Record<string, unknown>;
}

export async function repairJsonViaLLM(
  raw: string,
  callRepairModel: (input: string) => Promise<string>,
): Promise<Record<string, unknown> | null> {
  try {
    const repaired = await callRepairModel(raw);
    return parseJsonObjectFromLLM(repaired);
  } catch {
    return null;
  }
}

export function sanitizeLogSnippet(text: string, maxLen = 300): string {
  return text.replace(/\s+/g, " ").slice(0, maxLen);
}
