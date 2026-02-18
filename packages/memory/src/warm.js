import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { getDataPath } from "@cairn/shared";
import * as Automerge from "@automerge/automerge";
const DATA_DIR = getDataPath("memory");
const WARM_FILE_JSON = join(DATA_DIR, "warm.json");
const WARM_FILE_AM = join(DATA_DIR, "warm.automerge");
let doc = Automerge.init();
export async function initWarmMemory() {
    await mkdir(DATA_DIR, { recursive: true });
    if (existsSync(WARM_FILE_AM)) {
        const binary = await readFile(WARM_FILE_AM);
        doc = Automerge.load(binary);
    }
    else if (existsSync(WARM_FILE_JSON)) {
        // Migration Path
        const raw = await readFile(WARM_FILE_JSON, "utf-8");
        const oldData = JSON.parse(raw);
        doc = Automerge.from(oldData);
        await persist();
    }
}
export function warmGet(key) {
    const data = Automerge.toJS(doc);
    return data[key];
}
export async function warmSet(key, value) {
    doc = Automerge.change(doc, (d) => {
        d[key] = value;
    });
    await persist();
}
export async function warmDelete(key) {
    doc = Automerge.change(doc, (d) => {
        delete d[key];
    });
    await persist();
}
export function warmGetAll() {
    return Automerge.toJS(doc);
}
export function getRawDoc() {
    return doc;
}
export async function mergeChanges(binary) {
    const remoteDoc = Automerge.load(binary);
    doc = Automerge.merge(doc, remoteDoc);
    await persist();
}
async function persist() {
    const binary = Automerge.save(doc);
    await writeFile(WARM_FILE_AM, binary);
}
//# sourceMappingURL=warm.js.map