import type { MemoryTier } from "@cairn/shared";
import { hotGet, hotSet } from "./hot.js";
import { warmGet, warmSet } from "./warm.js";

export interface MemoryAccess {
  read: MemoryTier[];
  write: ("hot" | "warm")[];
}

export function memoryRead(
  tier: MemoryTier,
  key: string,
  access: MemoryAccess,
): unknown | undefined {
  if (!access.read.includes(tier)) {
    throw new Error(`Memory read denied: cannot access tier "${tier}"`);
  }
  switch (tier) {
    case "hot":
      return hotGet(key);
    case "warm":
      return warmGet(key);
    case "cold":
      throw new Error("Cold memory not implemented in Phase 1");
  }
}

export async function memoryWrite(
  tier: "hot" | "warm",
  key: string,
  value: unknown,
  access: MemoryAccess,
): Promise<void> {
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
