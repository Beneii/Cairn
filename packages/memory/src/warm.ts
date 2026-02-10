import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { getDataPath } from "@cairn/shared";
import * as Automerge from "@automerge/automerge";

const DATA_DIR = getDataPath("memory");
const WARM_FILE_JSON = join(DATA_DIR, "warm.json");
const WARM_FILE_AM = join(DATA_DIR, "warm.automerge");

let doc = Automerge.init<Record<string, any>>();

export async function initWarmMemory(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });

  if (existsSync(WARM_FILE_AM)) {
    const binary = await readFile(WARM_FILE_AM);
    doc = Automerge.load<Record<string, any>>(binary);
  } else if (existsSync(WARM_FILE_JSON)) {
    // Migration Path
    const raw = await readFile(WARM_FILE_JSON, "utf-8");
    const oldData = JSON.parse(raw);
    doc = Automerge.from<Record<string, any>>(oldData);
    await persist();
  }
}

export function warmGet<T = unknown>(key: string): T | undefined {
  const data = Automerge.toJS(doc);
  return data[key] as T | undefined;
}

export async function warmSet(key: string, value: any): Promise<void> {
  doc = Automerge.change(doc, (d) => {
    d[key] = value;
  });
  await persist();
}

export async function warmDelete(key: string): Promise<void> {
  doc = Automerge.change(doc, (d) => {
    delete d[key];
  });
  await persist();
}

export function warmGetAll(): Record<string, any> {
  return Automerge.toJS(doc);
}

export function getRawDoc(): Automerge.Doc<Record<string, any>> {
  return doc;
}

export async function mergeChanges(binary: Uint8Array): Promise<void> {
  const remoteDoc = Automerge.load<Record<string, any>>(binary);
  doc = Automerge.merge(doc, remoteDoc);
  await persist();
}

async function persist(): Promise<void> {
  const binary = Automerge.save(doc);
  await writeFile(WARM_FILE_AM, binary);
}
