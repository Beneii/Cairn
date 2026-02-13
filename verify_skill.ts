
import { initSkillRegistry, executeSkill, getSkill } from "./packages/orchestrator/src/skill-registry";
import { registerWebTools } from "./packages/executor/src/tools/web";

async function run() {
    await import("./packages/executor/src/tools"); // Force load tools

    console.log("Initializing skill registry...");
    await initSkillRegistry();

    const skill = getSkill("weather.get");
    if (!skill) {
        console.error("weather.get skill not registerd!");
        process.exit(1);
    } else {
        console.log("Skill found:", skill.definition.id);
    }

    console.log("Executing skill...");
    const result = await executeSkill("weather.get", { location: "London" }, { jobId: "test", messageId: "1", memoryRead: () => { }, memoryWrite: async () => { } } as any);

    console.log("Result:", result.success, result.output.substring(0, 100) + "...");
}

run().catch(console.error);
