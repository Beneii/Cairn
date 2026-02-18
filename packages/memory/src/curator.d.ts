/**
 * Curator Service
 *
 * Handles promotion of content from warm memory to cold memory.
 * Runs as a background process, chunking and embedding documents.
 *
 * Per truth.md §7: "Agents never write directly to cold memory.
 * Promotion from warm → cold is handled by a curator process."
 */
import { type ColdDocument } from "./cold.js";
export interface PromotionRequest {
    id: string;
    source: ColdDocument["source"];
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
    deleteFromWarm?: boolean;
    warmKey?: string;
}
export interface PromotionResult {
    success: boolean;
    documentId?: string;
    chunkCount?: number;
    tokenCount?: number;
    error?: string;
}
/**
 * Queue content for promotion to cold memory
 */
export declare function queueForPromotion(request: PromotionRequest): void;
/**
 * Promote content directly to cold memory (bypasses queue)
 */
export declare function promoteToCold(request: PromotionRequest): Promise<PromotionResult>;
/**
 * Check warm memory for items that should be promoted to cold.
 * Called periodically by the scheduler.
 */
export declare function runCurationCycle(): Promise<{
    promoted: number;
    skipped: number;
}>;
export declare function getCuratorStats(): {
    queueLength: number;
    isProcessing: boolean;
    documents: number;
    chunks: number;
};
//# sourceMappingURL=curator.d.ts.map