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
import { join, dirname } from "path";
import { mkdirSync, existsSync } from "fs";
import { getDataPath, newId, now } from "@cairn/shared";

let db: Database.Database | null = null;

// ---- Types ----

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

// ---- Schema ----

const COLD_SCHEMA = `
-- Documents (original content before chunking)
CREATE TABLE IF NOT EXISTS cold_documents (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  promoted_at TEXT NOT NULL
);

-- Chunks (with embeddings for vector search)
CREATE TABLE IF NOT EXISTS cold_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB NOT NULL,
  token_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES cold_documents(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cold_docs_source ON cold_documents(source);
CREATE INDEX IF NOT EXISTS idx_cold_chunks_doc ON cold_chunks(document_id);
`;

// ---- Init ----

export function initColdMemory(): Database.Database {
    if (db) return db;

    const dbPath = join(getDataPath(), "cold_memory.db");
    const dir = dirname(dbPath);

    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    // Create tables
    db.exec(COLD_SCHEMA);

    console.log(`[cold-memory] Initialized at ${dbPath}`);
    return db;
}

export function getColdDb(): Database.Database {
    if (!db) {
        return initColdMemory();
    }
    return db;
}

// ---- Document Operations ----

export function addDocument(
    source: ColdDocument["source"],
    title: string,
    content: string,
    metadata: Record<string, unknown> = {}
): ColdDocument {
    const doc: ColdDocument = {
        id: newId(),
        source,
        title,
        content,
        metadata,
        created_at: now(),
        promoted_at: now(),
    };

    const db = getColdDb();
    const stmt = db.prepare(`
    INSERT INTO cold_documents (id, source, title, content, metadata, created_at, promoted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    stmt.run(
        doc.id,
        doc.source,
        doc.title,
        doc.content,
        JSON.stringify(doc.metadata),
        doc.created_at,
        doc.promoted_at
    );

    return doc;
}

export function getDocument(id: string): ColdDocument | null {
    const db = getColdDb();
    const row = db.prepare("SELECT * FROM cold_documents WHERE id = ?").get(id) as {
        id: string;
        source: string;
        title: string;
        content: string;
        metadata: string;
        created_at: string;
        promoted_at: string;
    } | undefined;

    if (!row) return null;

    return {
        ...row,
        source: row.source as ColdDocument["source"],
        metadata: JSON.parse(row.metadata || "{}"),
    };
}

export function getAllDocuments(): ColdDocument[] {
    const db = getColdDb();
    const rows = db.prepare("SELECT * FROM cold_documents ORDER BY promoted_at DESC").all() as Array<{
        id: string;
        source: string;
        title: string;
        content: string;
        metadata: string;
        created_at: string;
        promoted_at: string;
    }>;

    return rows.map(row => ({
        ...row,
        source: row.source as ColdDocument["source"],
        metadata: JSON.parse(row.metadata || "{}"),
    }));
}

export function getDocumentCount(): number {
    const db = getColdDb();
    const row = db.prepare("SELECT COUNT(*) as count FROM cold_documents").get() as { count: number };
    return row.count;
}

// ---- Chunk Operations ----

export function addChunk(
    documentId: string,
    chunkIndex: number,
    content: string,
    embedding: number[],
    tokenCount: number
): ColdChunk {
    const chunk: ColdChunk = {
        id: newId(),
        document_id: documentId,
        chunk_index: chunkIndex,
        content,
        embedding,
        token_count: tokenCount,
        created_at: now(),
    };

    const db = getColdDb();
    const stmt = db.prepare(`
    INSERT INTO cold_chunks (id, document_id, chunk_index, content, embedding, token_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    // Store embedding as a binary blob (Float32Array)
    const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);

    stmt.run(
        chunk.id,
        chunk.document_id,
        chunk.chunk_index,
        chunk.content,
        embeddingBuffer,
        chunk.token_count,
        chunk.created_at
    );

    return chunk;
}

export function getChunksForDocument(documentId: string): ColdChunk[] {
    const db = getColdDb();
    const rows = db.prepare(
        "SELECT * FROM cold_chunks WHERE document_id = ? ORDER BY chunk_index"
    ).all(documentId) as Array<{
        id: string;
        document_id: string;
        chunk_index: number;
        content: string;
        embedding: Buffer;
        token_count: number;
        created_at: string;
    }>;

    return rows.map(row => ({
        ...row,
        embedding: Array.from(new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.length / 4)),
    }));
}

export function getChunkCount(): number {
    const db = getColdDb();
    const row = db.prepare("SELECT COUNT(*) as count FROM cold_chunks").get() as { count: number };
    return row.count;
}

// ---- Vector Search ----

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Search cold memory for chunks similar to the query embedding
 */
export function vectorSearch(
    queryEmbedding: number[],
    topK: number = 5,
    minScore: number = 0.3,
    sourceFilter?: ColdDocument["source"]
): SearchResult[] {
    const db = getColdDb();

    // Get all chunks with their documents
    let query = `
    SELECT c.id, c.document_id, c.content, c.embedding, 
           d.title as document_title, d.source as document_source
    FROM cold_chunks c
    JOIN cold_documents d ON c.document_id = d.id
  `;

    if (sourceFilter) {
        query += ` WHERE d.source = ?`;
    }

    const rows = (sourceFilter
        ? db.prepare(query).all(sourceFilter)
        : db.prepare(query).all()
    ) as Array<{
        id: string;
        document_id: string;
        content: string;
        embedding: Buffer;
        document_title: string;
        document_source: string;
    }>;

    // Calculate similarity scores
    const results: SearchResult[] = rows.map(row => {
        const embedding = Array.from(
            new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.length / 4)
        );
        const score = cosineSimilarity(queryEmbedding, embedding);

        return {
            chunk_id: row.id,
            document_id: row.document_id,
            content: row.content,
            score,
            document_title: row.document_title,
            document_source: row.document_source,
        };
    });

    // Sort by score descending and filter
    return results
        .filter(r => r.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
}

// ---- Deletion (for cleanup) ----

export function deleteDocument(id: string): boolean {
    const db = getColdDb();
    const result = db.prepare("DELETE FROM cold_documents WHERE id = ?").run(id);
    return result.changes > 0;
}

// ---- Stats ----

export function getColdMemoryStats(): {
    documentCount: number;
    chunkCount: number;
    sourceBreakdown: Record<string, number>;
} {
    const db = getColdDb();

    const docCount = db.prepare("SELECT COUNT(*) as count FROM cold_documents").get() as { count: number };
    const chunkCount = db.prepare("SELECT COUNT(*) as count FROM cold_chunks").get() as { count: number };

    const sources = db.prepare(
        "SELECT source, COUNT(*) as count FROM cold_documents GROUP BY source"
    ).all() as Array<{ source: string; count: number }>;

    const sourceBreakdown: Record<string, number> = {};
    for (const row of sources) {
        sourceBreakdown[row.source] = row.count;
    }

    return {
        documentCount: docCount.count,
        chunkCount: chunkCount.count,
        sourceBreakdown,
    };
}
