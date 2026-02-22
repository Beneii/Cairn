
import * as fs from "fs";
import * as path from "path";
import { callLLM } from "../llm.js";
import { getEnabledSkills, getSkillManifest } from "@cairn/skills";
import { newId } from "@cairn/shared";

const PROMPT_DIR = path.join(process.cwd(), "packages/orchestrator/src/subagents/prompts");

function loadPrompt(name: string, vars: Record<string, string>): string {
    let template = fs.readFileSync(path.join(PROMPT_DIR, `${name}.txt`), "utf-8");
    for (const [key, value] of Object.entries(vars)) {
        template = template.replace(new RegExp(`{{${key}}}`, "g"), value);
    }
    return template;
}

export async function runClassifier(userInput: string, history: any[]) {
    const enabledSkills = getEnabledSkills();
    const skillContext = enabledSkills.map(s => `- ${s.id}: ${s.description}`).join('\n');

    const systemPrompt = loadPrompt("classifier", { skillContext });

    const response = await callLLM({
        model: "gpt-4o-mini",
        systemPrompt,
        messages: [
            ...history.slice(-5),
            { role: "user", content: userInput }
        ],
        temperature: 0,
    }, "classifier", `classify-${newId().slice(0,8)}`);

    try {
        return JSON.parse(response.content);
    } catch (e) {
        return { recommendedAction: "none", confidence: 0 };
    }
}

export async function runSkillSpecialist(skillId: string, userInput: string, history: any[]) {
    const manifest = getSkillManifest(skillId);
    if (!manifest) throw new Error(`Skill ${skillId} not found`);

    const systemPrompt = loadPrompt("specialist", {
        skillId: manifest.id,
        description: manifest.description,
        inputSchema: JSON.stringify(manifest.inputSchema)
    });

    const response = await callLLM({
        model: "gpt-4o-mini",
        systemPrompt,
        messages: [
            ...history.slice(-3),
            { role: "user", content: userInput }
        ],
        temperature: 0,
    }, "specialist", `specialist-${skillId}-${newId().slice(0,8)}`);

    try {
        return JSON.parse(response.content);
    } catch (e) {
        return { arguments: {}, confidence: 0 };
    }
}
