
import { getTool } from '@cairn/executor';
import { join } from 'path';

async function main() {
    console.log("Starting browser search verification...");

    // 1. Navigate
    console.log("\n--- Testing browser_navigate ---");
    const navTool = getTool("browser_navigate");
    if (!navTool) throw new Error("browser_navigate tool not found");

    const navResult = await navTool({ url: "https://www.youtube.com" }, { jobId: "test", nodeName: "test", memoryRead: () => undefined, memoryWrite: async () => { } });
    console.log("Navigate Result:", navResult);

    if (!navResult.success) {
        console.error("Navigation failed!");
        process.exit(1);
    }

    // 2. Fill Search
    console.log("\n--- Testing browser_fill ---");
    const fillTool = getTool("browser_fill");
    if (!fillTool) throw new Error("browser_fill tool not found");

    // YouTube search bar selector - might need adjustment if changed, but 'input[name="search_query"]' is standard for desktop
    const fillResult = await fillTool({ selector: 'input[name="search_query"]', value: "openclaw" }, { jobId: "test", nodeName: "test", memoryRead: () => undefined, memoryWrite: async () => { } });
    console.log("Fill Result:", fillResult);

    if (!fillResult.success) {
        console.error("Fill failed!");
        process.exit(1);
    }

    // 3. Press Enter
    console.log("\n--- Testing browser_press ---");
    const pressTool = getTool("browser_press");
    if (!pressTool) throw new Error("browser_press tool not found");

    const pressResult = await pressTool({ key: "Enter" }, { jobId: "test", nodeName: "test", memoryRead: () => undefined, memoryWrite: async () => { } });
    console.log("Press Result:", pressResult);

    if (!pressResult.success) {
        console.error("Press failed!");
        process.exit(1);
    }

    // 4. Wait for results (manual wait since we don't have a wait tool exposed, but we can just sleep)
    console.log("Waiting for results...");
    await new Promise(r => setTimeout(r, 5000));

    // 5. Screenshot
    console.log("\n--- Testing browser_screenshot ---");
    const screenTool = getTool("browser_screenshot");
    if (!screenTool) throw new Error("browser_screenshot tool not found");

    const screenResult = await screenTool({}, { jobId: "test", nodeName: "test", memoryRead: () => undefined, memoryWrite: async () => { } });
    console.log("Screenshot Result:", screenResult);

    console.log("\nVerification Complete!");

    // Close browser
    const closeTool = getTool("browser_close");
    if (closeTool) {
        await closeTool({}, { jobId: "test", nodeName: "test", memoryRead: () => undefined, memoryWrite: async () => { } });
    }
}

main().catch(console.error);
