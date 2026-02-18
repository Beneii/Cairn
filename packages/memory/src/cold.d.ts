/**
 * Cold Memory - Vector-based Long-term Storage
 *
 * Cold memory stores documents and their embeddings for semantic search.
 * Agents can only READ cold memory via vector_search.
 * Writing to cold memory happens through the curator process (warm → cold promotion).
 *
 * Architecture:
 * - Documents are chunked into ~512 token pieces
 * - Each chunk gets an embedding via OpenAI text-embedding-3-small
 * - Embeddings are stored in SQLite with a simple vector similarity search
 * - Top-k retrieval returns most relevant chunks
 */
import Database from "better-sqlite3";
export interface ColdDocument {
    id: string;
    source: "note" | "conversation" | "document" | "external";
    title: string;
    content: string;
    metadata: Record<string, unknown>;
    created_at: string;
    promoted_at: string;
}
export interface ColdChunk {
    id: string;
    document_id: string;
    chunk_index: number;
    content: string;
    embedding: number[];
    token_count: number;
    created_at: string;
}
export interface SearchResult {
    chunk_id: string;
    document_id: string;
    content: string;
    score: number;
    document_title: string;
    document_source: string;
}
export declare function initColdMemory(): Database.Database;
export declare function getColdDb(): Database.Database;
export declare function addDocument(source: ColdDocument["source"], title: string, content: string, metadata?: Record<string, unknown>): ColdDocument;
export declare function getDocument(id: string): ColdDocument | null;
export declare function getAllDocuments(): ColdDocument[];
export declare function getDocumentCount(): number;
export declare function addChunk(documentId: string, chunkIndex: number, content: string, embedding: number[], tokenCount: number): ColdChunk;
export declare function getChunksForDocument(documentId: string): ColdChunk[];
export declare function getChunkCount(): number;
/**
 * Search cold memory for chunks similar to the query embedding
 */
export declare function vectorSearch(queryEmbedding: number[], topK?: number, minScore?: number, sourceFilter?: ColdDocument["source"]): SearchResult[];
export declare function deleteDocument(id: string): boolean;
export declare function getColdMemoryStats(): {
    documentCount: number;
    chunkCount: number;
    sourceBreakdown: Record<string, number>;
};
//# sourceMappingURL=cold.d.ts.map