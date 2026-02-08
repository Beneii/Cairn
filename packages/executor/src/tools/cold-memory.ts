/**
 * Cold Memory Tools
 * 
 * Tools for interacting with cold (long-term) memory via semantic search.
 * Per truth.md: "Cold Memory... Retrieval only (no raw DB access)"
 */

import { z } from "zod";
import { registerTool, type ToolOutput } from "../manifest.js";
import {
    initColdMemory,
    vectorSearch,
    getColdMemoryStats,
    type SearchResult,
} from "@cairn/memory";
import {
    initEmbeddingService,
    isEmbeddingAvailable,
    createEmbedding,
} from "@cairn/memory";

// ---- vector_search Tool ----

const VectorSearchInputSchema = z.object({
    query: z.string().min(1).describe("The search query - what you're looking for"),
    top_k: z.number().int().min(1).max(20).default(5).describe("Maximum number of results to return"),
    min_score: z.number().min(0).max(1).default(0.3).describe("Minimum similarity score (0-1)"),
    source_filter: z.enum(["note", "conversation", "document", "external"]).optional()
        .describe("Optional filter to only search specific sources"),
});

const VectorSearchOutputSchema = z.object({
    ok: z.boolean(),
    data: z.object({
        results: z.array(z.object({
            content: z.string(),
            score: z.number(),
            document_title: z.string(),
            document_source: z.string(),
        })),
        query: z.string(),
        total_documents: z.number(),
        total_chunks: z.number(),
    }).optional(),
    error: z.string().optional(),
});

type VectorSearchInput = z.infer<typeof VectorSearchInputSchema>;

registerTool({
    name: "vector_search",
    description: "Search long-term memory for relevant information using semantic similarity. Returns chunks of text that are semantically similar to the query.",
    category: "memory",

    inputSchema: VectorSearchInputSchema,
    outputSchema: VectorSearchOutputSchema,

    costHint: "cheap",
    cacheable: true,
    cacheTTLSeconds: 300, // Cache results for 5 minutes

    safetyTier: "auto",
    sideEffects: ["reads:memory"],

    handler: async (input: VectorSearchInput): Promise<ToolOutput> => {
        try {
            // Initialize services if needed
            initColdMemory();
            initEmbeddingService();

            if (!isEmbeddingAvailable()) {
                return {
                    ok: false,
                    error: "Embedding service not available. Set OPENAI_API_KEY to enable semantic search.",
                };
            }

            // Get stats first
            const stats = getColdMemoryStats();

            if (stats.chunkCount === 0) {
                return {
                    ok: true,
                    data: {
                        results: [],
                        query: input.query,
                        total_documents: 0,
                        total_chunks: 0,
                    },
                    warnings: ["Cold memory is empty. No documents have been promoted yet."],
                };
            }

            // Create embedding for the query
            const { embedding } = await createEmbedding(input.query);

            // Search cold memory
            const results = vectorSearch(
                embedding,
                input.top_k || 5,
                input.min_score || 0.3,
                input.source_filter
            );

            return {
                ok: true,
                data: {
                    results: results.map(r => ({
                        content: r.content,
                        score: Math.round(r.score * 1000) / 1000, // Round to 3 decimal places
                        document_title: r.document_title,
                        document_source: r.document_source,
                    })),
                    query: input.query,
                    total_documents: stats.documentCount,
                    total_chunks: stats.chunkCount,
                },
            };
        } catch (err) {
            return {
                ok: false,
                error: err instanceof Error ? err.message : "Unknown error during vector search",
            };
        }
    },
});

// ---- cold_memory_stats Tool ----

const ColdMemoryStatsInputSchema = z.object({});

const ColdMemoryStatsOutputSchema = z.object({
    ok: z.boolean(),
    data: z.object({
        document_count: z.number(),
        chunk_count: z.number(),
        sources: z.record(z.string(), z.number()),
    }).optional(),
    error: z.string().optional(),
});

registerTool({
    name: "cold_memory_stats",
    description: "Get statistics about cold (long-term) memory: number of documents, chunks, and breakdown by source.",
    category: "memory",

    inputSchema: ColdMemoryStatsInputSchema,
    outputSchema: ColdMemoryStatsOutputSchema,

    costHint: "trivial",
    cacheable: true,
    cacheTTLSeconds: 60,

    safetyTier: "auto",
    sideEffects: ["reads:memory"],

    handler: async (): Promise<ToolOutput> => {
        try {
            initColdMemory();
            const stats = getColdMemoryStats();

            return {
                ok: true,
                data: {
                    document_count: stats.documentCount,
                    chunk_count: stats.chunkCount,
                    sources: stats.sourceBreakdown,
                },
            };
        } catch (err) {
            return {
                ok: false,
                error: err instanceof Error ? err.message : "Unknown error getting cold memory stats",
            };
        }
    },
});

console.log("[tools] Cold memory tools registered");
