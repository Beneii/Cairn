/**
 * Embedding Service
 *
 * Creates vector embeddings for text using OpenAI's embedding models.
 * Used by cold memory for semantic search.
 */
import OpenAI from "openai";
import { now } from "@cairn/shared";
let client = null;
// Model configuration
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
// Cost per 1M tokens for text-embedding-3-small
const EMBEDDING_COST_PER_1M = 0.02;
// ---- Init ----
export function initEmbeddingService() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.warn("[embeddings] Embedding service disabled (no OPENAI_API_KEY)");
        return;
    }
    client = new OpenAI({ apiKey });
    console.log("[embeddings] Embedding service initialized");
}
export function isEmbeddingAvailable() {
    return client !== null;
}
/**
 * Create an embedding for a single text
 */
export async function createEmbedding(text) {
    if (!client) {
        throw new Error("Embedding service not available");
    }
    const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
        dimensions: EMBEDDING_DIMENSIONS,
    });
    const embedding = response.data[0].embedding;
    const tokenCount = response.usage.total_tokens;
    const cost = {
        node: "embeddings",
        model: EMBEDDING_MODEL,
        prompt_tokens: tokenCount,
        completion_tokens: 0,
        cost_usd: (tokenCount / 1_000_000) * EMBEDDING_COST_PER_1M,
        timestamp: now(),
    };
    return { embedding, tokenCount, cost };
}
/**
 * Create embeddings for multiple texts (more efficient than individual calls)
 */
export async function createBatchEmbeddings(texts) {
    if (!client) {
        throw new Error("Embedding service not available");
    }
    if (texts.length === 0) {
        return {
            embeddings: [],
            tokenCounts: [],
            totalTokens: 0,
            cost: {
                node: "embeddings",
                model: EMBEDDING_MODEL,
                prompt_tokens: 0,
                completion_tokens: 0,
                cost_usd: 0,
                timestamp: now(),
            },
        };
    }
    const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts,
        dimensions: EMBEDDING_DIMENSIONS,
    });
    // Sort by index to ensure correct order
    const sorted = response.data.sort((a, b) => a.index - b.index);
    const embeddings = sorted.map(d => d.embedding);
    // Token counts are not available per-item in batch, estimate based on total
    const totalTokens = response.usage.total_tokens;
    const avgTokensPerText = totalTokens / texts.length;
    const tokenCounts = texts.map(() => Math.round(avgTokensPerText));
    const cost = {
        node: "embeddings",
        model: EMBEDDING_MODEL,
        prompt_tokens: totalTokens,
        completion_tokens: 0,
        cost_usd: (totalTokens / 1_000_000) * EMBEDDING_COST_PER_1M,
        timestamp: now(),
    };
    return { embeddings, tokenCounts, totalTokens, cost };
}
// ---- Text Processing ----
/**
 * Simple token count estimation (rough, for chunking purposes)
 * More accurate than character count, less overhead than tiktoken
 */
export function estimateTokenCount(text) {
    // Average of ~4 characters per token for English text
    return Math.ceil(text.length / 4);
}
/**
 * Chunk text into pieces suitable for embedding
 * Uses sentence boundaries when possible
 */
export function chunkText(text, maxTokens = 512, overlap = 50) {
    const chunks = [];
    // Split into sentences (simple heuristic)
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunk = [];
    let currentTokenCount = 0;
    for (const sentence of sentences) {
        const sentenceTokens = estimateTokenCount(sentence);
        // If single sentence is too long, split by words
        if (sentenceTokens > maxTokens) {
            // Flush current chunk first
            if (currentChunk.length > 0) {
                chunks.push(currentChunk.join(" "));
                currentChunk = [];
                currentTokenCount = 0;
            }
            // Split long sentence by words
            const words = sentence.split(/\s+/);
            let wordChunk = [];
            let wordTokenCount = 0;
            for (const word of words) {
                const wordTokens = estimateTokenCount(word);
                if (wordTokenCount + wordTokens > maxTokens && wordChunk.length > 0) {
                    chunks.push(wordChunk.join(" "));
                    // Keep last few words for overlap
                    const overlapWords = Math.ceil(overlap / 4);
                    wordChunk = wordChunk.slice(-overlapWords);
                    wordTokenCount = estimateTokenCount(wordChunk.join(" "));
                }
                wordChunk.push(word);
                wordTokenCount += wordTokens;
            }
            if (wordChunk.length > 0) {
                currentChunk = wordChunk;
                currentTokenCount = wordTokenCount;
            }
            continue;
        }
        // Check if adding this sentence would exceed limit
        if (currentTokenCount + sentenceTokens > maxTokens && currentChunk.length > 0) {
            chunks.push(currentChunk.join(" "));
            // Keep some sentences for overlap
            const overlapTokens = 0;
            let overlapChunk = [];
            for (let i = currentChunk.length - 1; i >= 0; i--) {
                const tokens = estimateTokenCount(currentChunk[i]);
                if (overlapTokens + tokens > overlap)
                    break;
                overlapChunk.unshift(currentChunk[i]);
            }
            currentChunk = overlapChunk;
            currentTokenCount = estimateTokenCount(currentChunk.join(" "));
        }
        currentChunk.push(sentence);
        currentTokenCount += sentenceTokens;
    }
    // Don't forget the last chunk
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(" "));
    }
    return chunks.filter(c => c.trim().length > 0);
}
// ---- Configuration ----
export function getEmbeddingConfig() {
    return {
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
        costPer1MTokens: EMBEDDING_COST_PER_1M,
    };
}
//# sourceMappingURL=embeddings.js.map