import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { newId, now, hashString, bus, getDataPath } from "@cairn/shared";
const DATA_DIR = getDataPath("ledger");
const LEDGER_FILE = join(DATA_DIR, "ledger.json");
let entries = [];
let sequence = 0;
export async function initLedger() {
    await mkdir(DATA_DIR, { recursive: true });
    if (existsSync(LEDGER_FILE)) {
        const raw = await readFile(LEDGER_FILE, "utf-8");
        if (raw.trim()) {
            entries = JSON.parse(raw);
        }
        else {
            entries = [];
        }
        sequence = entries.length;
        // Security: Verify hash chain integrity on startup
        if (entries.length > 0 && !verifyChain()) {
            console.error("[ledger] CRITICAL: Hash chain verification failed! Ledger may be tampered.");
            console.error("[ledger] This could indicate data corruption or malicious modification.");
            // Log to ledger itself for audit trail
            const tamperEntry = {
                id: newId(),
                sequence: sequence++,
                timestamp: now(),
                type: "error",
                node: "ledger",
                job_id: "system",
                content: "Ledger hash chain verification failed on startup - possible tampering detected",
                prev_hash: entries[entries.length - 1]?.hash || "genesis",
                hash: "",
            };
            const { hash: _, ...hashInput } = tamperEntry;
            tamperEntry.hash = hashString(JSON.stringify(hashInput));
            entries.push(tamperEntry);
            await persist();
        }
        else if (entries.length > 0) {
            console.log(`[ledger] Loaded ${entries.length} entries. Hash chain verified.`);
        }
    }
}
export async function appendEntry(type, node, jobId, content, metadata) {
    const prevHash = entries.length > 0 ? entries[entries.length - 1].hash : "genesis";
    const entry = {
        id: newId(),
        sequence: sequence++,
        timestamp: now(),
        type,
        node,
        job_id: jobId,
        content,
        metadata,
        prev_hash: prevHash,
        hash: "",
    };
    // Compute hash over the entry (excluding the hash field itself)
    const { hash: _, ...hashInput } = entry;
    entry.hash = hashString(JSON.stringify(hashInput));
    entries.push(entry);
    await persist();
    // Emit as LogEntry for the UI (only for UI-compatible types)
    const uiTypes = ["thought", "tool", "file", "api", "agent", "error"];
    if (uiTypes.includes(type)) {
        bus.emit("log:entry", {
            id: entry.id,
            timestamp: entry.timestamp,
            type: type,
            content: entry.content,
        });
    }
    return entry;
}
export async function recordEvent(params) {
    return appendEntry(params.type, params.node, params.job_id, params.content, params.metadata);
}
export function getEntries(filter) {
    // Security: Optional integrity check before returning entries
    if (filter?.verifyIntegrity && entries.length > 0) {
        if (!verifyChain()) {
            console.error("[ledger] WARNING: Hash chain verification failed during read");
            throw new Error("Ledger integrity check failed - hash chain is broken");
        }
    }
    let result = entries;
    if (filter?.jobId)
        result = result.filter((e) => e.job_id === filter.jobId);
    if (filter?.type)
        result = result.filter((e) => e.type === filter.type);
    return result;
}
export function verifyChain() {
    for (let i = 1; i < entries.length; i++) {
        if (entries[i].prev_hash !== entries[i - 1].hash)
            return false;
    }
    return true;
}
async function persist() {
    await writeFile(LEDGER_FILE, JSON.stringify(entries, null, 2));
}
//# sourceMappingURL=ledger.js.map