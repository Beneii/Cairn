/**
 * Embedding Service
 *
 * Creates vector embeddings for text using OpenAI's embedding models.
 * Used by cold memory for semantic search.
 */
import type { CostEntry } from "@cairn/shared";
export declare function initEmbeddingService(): void;
export declare function isEmbeddingAvailable(): boolean;
export interface EmbeddingResult {
    embedding: number[];
    tokenCount: number;
    cost: CostEntry;
}
export interface BatchEmbeddingResult {
    embeddings: number[][];
    tokenCounts: number[];
    totalTokens: number;
    cost: CostEntry;
}
/**
 * Create an embedding for a single text
 */
export declare function createEmbedding(text: string): Promise<EmbeddingResult>;
/**
 * Create embeddings for multiple texts (more efficient than individual calls)
 */
export declare function createBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult>;
/**
 * Simple token count estimation (rough, for chunking purposes)
 * More accurate than character count, less overhead than tiktoken
 */
export declare function estimateTokenCount(text: string): number;
/**
 * Chunk text into pieces suitable for embedding
 * Uses sentence boundaries when possible
 */
export declare function chunkText(text: string, maxTokens?: number, overlap?: number): string[];
export declare function getEmbeddingConfig(): {
    model: string;
    dimensions: number;
    costPer1MTokens: number;
};
//# sourceMappingURL=embeddings.d.ts.map