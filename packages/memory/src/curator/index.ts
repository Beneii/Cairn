
import { MemoryCurator } from "./MemoryCurator.js";

/**
 * Initializes the periodic runner.
 * Default: Runs distillation every 15 minutes.
 */
export function initCuratorWorker(intervalMs: number = 15 * 60 * 1000): void {
  const curator = new MemoryCurator();

  setInterval(async () => {
    try {
      console.log("[curator] Starting distillation batch...");
      await curator.runBatchDistillation();
    } catch (err) {
      console.error("[curator] Batch failed:", err);
    }
  }, intervalMs);

  console.log(`[curator] Worker started (interval: ${intervalMs}ms)`);
}
