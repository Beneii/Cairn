export declare function newId(): string;
/**
 * Returns the absolute path to the project root directory.
 * Cached after first call.
 */
export declare function getProjectRoot(): string;
/**
 * Returns the absolute path to a data subdirectory.
 * Use this instead of join(process.cwd(), "data", ...) for consistent paths.
 */
export declare function getDataPath(...segments: string[]): string;
export declare function now(): string;
export declare function shortTime(): string;
export declare function hashString(input: string): string;
/** USD per 1K tokens for supported models */
export declare const MODEL_COSTS: Record<string, {
    prompt: number;
    completion: number;
}>;
export declare function calculateCost(model: string, promptTokens: number, completionTokens: number): number;
/**
 * Security: Redact sensitive information from error messages before displaying to user.
 * Removes file paths, API keys, tokens, and other potentially sensitive data.
 */
export declare function redactError(error: unknown): string;
//# sourceMappingURL=utils.d.ts.map