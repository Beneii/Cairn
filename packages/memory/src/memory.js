import { hotGet, hotSet } from "./hot.js";
import { warmGet, warmSet } from "./warm.js";
import { getDocument } from "./cold.js";
export function memoryRead(tier, key, access) {
    if (!access.read.includes(tier)) {
        throw new Error(`Memory read denied: cannot access tier "${tier}"`);
    }
    switch (tier) {
        case "hot":
            return hotGet(key);
        case "warm":
            return warmGet(key);
        case "cold": {
            const doc = getDocument(key);
            return doc ? doc.content : undefined;
        }
    }
}
export async function memoryWrite(tier, key, value, access) {
    if (!access.write.includes(tier)) {
        throw new Error(`Memory write denied: cannot write to tier "${tier}"`);
    }
    switch (tier) {
        case "hot":
            hotSet(key, value);
            break;
        case "warm":
            await warmSet(key, value);
            break;
    }
}
//# sourceMappingURL=memory.js.map