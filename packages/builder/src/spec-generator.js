import { callLLM } from "@cairn/orchestrator";
import { readFile } from "fs/promises";
import { join } from "path";
import { getProjectRoot, newId, now } from "@cairn/shared";
const SYSTEM_PROMPT = `You are the Cairn Architecture Engine. 
Your goal is to analyze a batch of runtime issues and design a concrete, scoped engineering plan to fix them.
You will produce a structured JSON design spec that a dumb worker will execute.

Constraints:
1. ONLY fix the issues provided. No refactoring unless improved reliability requires it.
2. Respect the project structure (monorepo: apps/, packages/).
3. Break work into small, testable tasks.
4. Define success criteria that are machine-verifiable (e.g. "pnpm build passes").

Project Context:
- Monorepo using pnpm workspaces
- TypeScript / React / Node.js
- Core packages: orchestrator, executor, policy, shared, ledger
- Apps: gateway, dashboard, mobile

Output JSON format:
{
  "branch": "cairn/builder/YYYY-MM-DD-short-desc",
  "tasks": [
    { "id": "t1", "description": "Create skill scaffold", "targetFile": "skills_workshop/my-skill/handler.ts", "changeType": "create", "testAction": "skill-tests" }
  ],
  "successCriteria": ["string"],
  "scopeAllowlist": ["packages/pkg/src/file.ts"],
  "scopeDenylist": ["packages/different-pkg/"],
  "estimatedSteps": number
}`;
export async function generateSpec(issues) {
    const projectRoot = getProjectRoot();
    // Read key docs for context
    const docs = [
        "01_CORE_IDENTITY.md",
        "02_ARCHITECTURE.md",
        "04_POLICIES_AND_GATES.md"
    ];
    let docContext = "";
    for (const doc of docs) {
        try {
            const content = await readFile(join(projectRoot, "documents", doc), "utf-8");
            docContext += `\n--- ${doc} ---\n${content.substring(0, 2000)}...\n`;
        }
        catch { }
    }
    const prompt = `
Issues to fix:
${JSON.stringify(issues.map(i => ({ category: i.category, summary: i.summary, context: i.rawContext })), null, 2)}

Documentation Context:
${docContext}

Current Date: ${now()}
`;
    const response = await callLLM({
        model: "gpt-4o",
        systemPrompt: SYSTEM_PROMPT,
        userMessage: prompt,
        responseFormat: "json_object",
        maxTokens: 4000,
        temperature: 0.1
    }, "builder", "spec-gen");
    const raw = JSON.parse(response.content);
    return {
        id: newId(),
        created: now(),
        issues: issues.map(i => i.id),
        maxSteps: 50,
        maxDurationMinutes: 120,
        ...raw
    };
}
//# sourceMappingURL=spec-generator.js.map