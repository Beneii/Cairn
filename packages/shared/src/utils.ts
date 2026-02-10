import { randomUUID, createHash } from "crypto";
import { join, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

export function newId(): string {
  return randomUUID();
}

/**
 * Finds the project root by walking up from the current file looking for documents/02_ARCHITECTURE.md
 * This ensures data paths are consistent regardless of where the app is started from.
 */
function findProjectRoot(): string {
  // Try CAIRN_ROOT env var first
  if (process.env.CAIRN_ROOT) {
    return process.env.CAIRN_ROOT;
  }

  // Walk up from this file's location to find documents/02_ARCHITECTURE.md (project root marker)
  let current = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(current, "documents", "02_ARCHITECTURE.md"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // Fallback to cwd
  return process.cwd();
}

let _projectRoot: string | null = null;

/**
 * Returns the absolute path to the project root directory.
 * Cached after first call.
 */
export function getProjectRoot(): string {
  if (!_projectRoot) {
    _projectRoot = findProjectRoot();
  }
  return _projectRoot;
}

/**
 * Returns the absolute path to a data subdirectory.
 * Use this instead of join(process.cwd(), "data", ...) for consistent paths.
 */
export function getDataPath(...segments: string[]): string {
  return join(getProjectRoot(), "data", ...segments);
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

/**
 * Security: Redact sensitive information from error messages before displaying to user.
 * Removes file paths, API keys, tokens, and other potentially sensitive data.
 */
export function redactError(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error);

  // Redact file system paths (Unix and Windows)
  message = message.replace(/\/[^\s]+/g, "[path]");
  message = message.replace(/[A-Z]:\\[^\s]+/g, "[path]");

  // Redact API keys and tokens (common patterns)
  message = message.replace(/sk-[a-zA-Z0-9]{20,}/g, "[api-key]");
  message = message.replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "Bearer [token]");
  message = message.replace(/token[:\s]+[a-zA-Z0-9._-]{20,}/gi, "token: [redacted]");

  // Redact environment variable values
  message = message.replace(/=[^\s]+/g, "=[redacted]");

  // Redact email addresses
  message = message.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]");

  // Redact IP addresses
  message = message.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[ip]");

  return message;
}
