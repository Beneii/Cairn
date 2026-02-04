import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data", "memory");
const WARM_FILE = join(DATA_DIR, "warm.json");

let warmData: Record<string, unknown> = {};

export async function initWarmMemory(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  if (existsSync(WARM_FILE)) {
    const raw = await readFile(WARM_FILE, "utf-8");
    warmData = JSON.parse(raw);
  }
}

export function warmGet<T = unknown>(key: string): T | undefined {
  return warmData[key] as T | undefined;
}

export async function warmSet(key: string, value: unknown): Promise<void> {
  warmData[key] = value;
  await persist();
}

export async function warmDelete(key: string): Promise<void> {
  delete warmData[key];
  await persist();
}

export function warmGetAll(): Record<string, unknown> {
  return { ...warmData };
}

async function persist(): Promise<void> {
  await writeFile(WARM_FILE, JSON.stringify(warmData, null, 2));
}
