
export function extractPlannerJson(text: string): any {
    // 1. Remove markdown code fences
    const cleaned = text
        .trim()
        .replace(/^```json/i, "")
        .replace(/^```/, "")
        .replace(/```$/, "")
        .trim();

    // 2. Find the first valid JSON object block
    // This regex looks for the first '{' and the last '}' that might form a valid object
    // It's a heuristic but works for standard LLM outputs
    const match = cleaned.match(/\{[\s\S]*\}/);

    if (!match) {
        throw new Error("No JSON object found in planner output");
    }

    // 3. Parse safely
    try {
        return JSON.parse(match[0]);
    } catch (err) {
        throw new Error(`Failed to parse extracted JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
}
