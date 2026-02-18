/**
 * Tool Registration Index
 *
 * Registers all manifest-based tools.
 */
import { registerMemoryTools } from "./memory.js";
import { registerCalendarTools } from "./calendar.js";
import { registerWebTools } from "./web.js";
import "./cold-memory.js"; // Self-registering cold memory tools
export function registerAllTools() {
    registerMemoryTools();
    registerCalendarTools();
    registerWebTools();
    // Cold memory tools are self-registered on import
    console.log("[tools] All tools registered");
}
// Re-export for convenience
export { setCalendarProvider, getCalendarProvider, initCalendarProvider } from "./calendar.js";
//# sourceMappingURL=index.js.map