import { BuildSpec, BuildTask } from "./spec-generator.js";
import { callLLM } from "@cairn/orchestrator";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, realpath, mkdir } from "fs/promises";
import path from "path";
import { getProjectRoot, bus, newId, now } from "@cairn/shared";
import { existsSync } from "fs";

const execAsync = promisify(exec);


const WORKSHOP_DIR = "skills_workshop";
const PROTECTED_PATH_MARKERS = [
    `${path.sep}apps${path.sep}`,
    `${path.sep}packages${path.sep}orchestrator${path.sep}`,
    `${path.sep}packages${path.sep}executor${path.sep}`,
    `${path.sep}packages${path.sep}policy${path.sep}`,
    `${path.sep}packages${path.sep}vault${path.sep}`,
    `${path.sep}configs${path.sep}`,
    `${path.sep}data${path.sep}`,
    `${path.sep}.env`,
];

export interface WorkerState {
    status: "idle" | "working" | "paused" | "completed" | "failed";
    currentTask?: string;
    stepsCompleted: number;
    logs: string[];
}

export class BranchWorker {
    private spec: BuildSpec;
    private state: WorkerState;
    private root: string;

    constructor(spec: BuildSpec) {
        this.spec = spec;
        this.root = getProjectRoot();
        this.state = {
            status: "idle",
            stepsCompleted: 0,
            logs: []
        };
    }

    private log(msg: string) {
        const entry = `[${now()}] ${msg}`;
        this.state.logs.push(entry);
        bus.emit("builder:log", { specId: this.spec.id, msg });
        bus.emit("builder:progress", msg); // Send progress update to UI
        console.log(`[builder] ${msg}`);
    }

    async run(): Promise<boolean> {
        this.state.status = "working";
        this.log(`Starting build ${this.spec.id} on branch ${this.spec.branch}`);

        try {
            if (process.env.CAIRN_MODE !== "grow" && process.env.CAIRN_SELF_GROWTH !== "enabled") {
                this.state.status = "failed";
                this.log("Builder disabled outside GROW mode");
                return false;
            }

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

        } catch (err) {
            this.state.status = "failed";
            this.log(`Build failed: ${err}`);

            // Cleanup: checkout main? No, leave branch for inspection
            return false;
        }
    }


    private getWorkshopRoot(): string {
        return path.resolve(this.root, WORKSHOP_DIR);
    }

    private async resolveAndValidateTargetPath(targetFile: string): Promise<{ fullPath: string; relativePath: string }> {
        const workshopRoot = this.getWorkshopRoot();
        const fullPath = path.resolve(this.root, targetFile);

        if (!fullPath.startsWith(workshopRoot + path.sep)) {
            throw new Error(`Builder write rejected: outside workshop root (${targetFile})`);
        }

        if (PROTECTED_PATH_MARKERS.some(marker => fullPath.includes(marker))) {
            throw new Error(`Builder write rejected: protected path (${targetFile})`);
        }

        if (targetFile.includes("..")) {
            throw new Error(`Builder write rejected: path traversal detected (${targetFile})`);
        }

        const parentDir = path.dirname(fullPath);
        await mkdir(parentDir, { recursive: true });

        const realParent = await realpath(parentDir);
        if (!realParent.startsWith(workshopRoot + path.sep) && realParent !== workshopRoot) {
            throw new Error(`Builder write rejected: symlink escape detected (${targetFile})`);
        }

        return {
            fullPath,
            relativePath: path.relative(this.root, fullPath),
        };
    }

    private async runValidation(action: BuildTask["testAction"], skillPath: string): Promise<void> {
        if (!action) return;

        const safeSkillPath = skillPath.replace(/[^a-zA-Z0-9_./-]/g, "");

        switch (action) {
            case "skill-tests":
                await this.exec(`pnpm -C ${safeSkillPath} test`);
                return;
            case "lint":
                await this.exec("pnpm lint");
                return;
            case "typecheck":
                await this.exec("pnpm typecheck");
                return;
            case "workspace-test":
                await this.exec("pnpm test");
                return;
            default:
                throw new Error(`Invalid test action: ${String(action)}`);
        }
    }

    private async executeTask(task: BuildTask): Promise<void> {
        const { fullPath, relativePath } = await this.resolveAndValidateTargetPath(task.targetFile);

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

        const response = await callLLM(
            {
                model: "gpt-4o", // using strong model for code gen
                systemPrompt: "You are an expert TypeScript engineer. Output only valid code.",
                userMessage: prompt,
                temperature: 0,
                maxTokens: 4096,
            },
            "builder",
            `task-${task.id}`
        );

        let newCode = response.content.trim();
        // Strip code fences if present
        if (newCode.startsWith("```")) {
            newCode = newCode.replace(/^```[a-z]*\n/, "").replace(/\n```$/, "");
        }

        // Apply
        await writeFile(fullPath, newCode, "utf-8");

        // Verify Build
        try {
            const skillPath = path.dirname(relativePath);
            await this.runValidation(task.testAction, skillPath);
        } catch (err) {
            // Self-correction loop would go here
            this.log(`Validation failed for ${task.targetFile}, rolling back...`);
            if (originalContent) {
                await writeFile(fullPath, originalContent, "utf-8");
            }
            throw err;
        }

        // Commit
        await this.exec(`git add ${relativePath}`);
        await this.exec(`git commit -m "builder: ${task.description}"`);
    }

    private async exec(cmd: string): Promise<string> {
        try {
            const { stdout, stderr } = await execAsync(cmd, { cwd: this.root });
            return stdout || stderr;
        } catch (err: any) {
            throw new Error(`Command failed: ${cmd}\n${err.stderr || err.message}`);
        }
    }

    getReport(): any {
        return {
            spec: this.spec,
            state: this.state
        };
    }
}
