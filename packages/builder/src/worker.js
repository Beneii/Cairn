import { callLLM } from "@cairn/orchestrator";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { getProjectRoot, bus, now } from "@cairn/shared";
import { existsSync } from "fs";
const execAsync = promisify(exec);
export class BranchWorker {
    spec;
    state;
    root;
    constructor(spec) {
        this.spec = spec;
        this.root = getProjectRoot();
        this.state = {
            status: "idle",
            stepsCompleted: 0,
            logs: []
        };
    }
    log(msg) {
        const entry = `[${now()}] ${msg}`;
        this.state.logs.push(entry);
        bus.emit("builder:log", { specId: this.spec.id, msg });
        console.log(`[builder] ${msg}`);
    }
    async run() {
        this.state.status = "working";
        this.log(`Starting build ${this.spec.id} on branch ${this.spec.branch}`);
        try {
            // 1. Setup git
            await this.exec(`git checkout -b ${this.spec.branch}`);
            // 2. Loop tasks
            for (const task of this.spec.tasks) {
                this.state.currentTask = task.id;
                this.log(`Task: ${task.description} (${task.targetFile})`);
                await this.executeTask(task);
                this.state.stepsCompleted++;
                // Safety: check budget
                if (this.state.stepsCompleted >= this.spec.maxSteps) {
                    throw new Error("Step budget exhausted");
                }
            }
            // 3. Final verification
            this.log("Running final verification...");
            await this.exec("pnpm build");
            // 4. Push
            this.log("Pushing branch...");
            // await this.exec(`git push -u origin ${this.spec.branch}`); // commented out for safety until tested
            this.state.status = "completed";
            return true;
        }
        catch (err) {
            this.state.status = "failed";
            this.log(`Build failed: ${err}`);
            // Cleanup: checkout main? No, leave branch for inspection
            return false;
        }
    }
    async executeTask(task) {
        const fullPath = join(this.root, task.targetFile);
        let originalContent = "";
        if (task.changeType !== "create" && existsSync(fullPath)) {
            originalContent = await readFile(fullPath, "utf-8");
        }
        // Generate Code
        const prompt = `
Task: ${task.description}
File: ${task.targetFile}
Change Type: ${task.changeType}

Current Content:
\`\`\`typescript
${originalContent}
\`\`\`

Return ONLY the new content for this file. No code fences, just the code.
`;
        const response = await callLLM({
            model: "gpt-4o", // using strong model for code gen
            systemPrompt: "You are an expert TypeScript engineer. Output only valid code.",
            userMessage: prompt,
            temperature: 0,
            maxTokens: 4096,
        }, "builder", `task-${task.id}`);
        let newCode = response.content.trim();
        // Strip code fences if present
        if (newCode.startsWith("```")) {
            newCode = newCode.replace(/^```[a-z]*\n/, "").replace(/\n```$/, "");
        }
        // Apply
        await writeFile(fullPath, newCode, "utf-8");
        // Verify Build
        try {
            // Scope build to package? For now, just global build or specific test if provided
            if (task.testCommand) {
                await this.exec(task.testCommand);
            }
            else {
                // Heuristic: try to build related package
                // await this.exec("pnpm build"); // too slow for every step?
                // Minimal check: tsc --noEmit?
            }
        }
        catch (err) {
            // Self-correction loop would go here
            this.log(`Validation failed for ${task.targetFile}, rolling back...`);
            if (originalContent) {
                await writeFile(fullPath, originalContent, "utf-8");
            }
            throw err;
        }
        // Commit
        await this.exec(`git add ${task.targetFile}`);
        await this.exec(`git commit -m "builder: ${task.description}"`);
    }
    async exec(cmd) {
        try {
            const { stdout, stderr } = await execAsync(cmd, { cwd: this.root });
            return stdout || stderr;
        }
        catch (err) {
            throw new Error(`Command failed: ${cmd}\n${err.stderr || err.message}`);
        }
    }
    getReport() {
        return {
            spec: this.spec,
            state: this.state
        };
    }
}
//# sourceMappingURL=worker.js.map