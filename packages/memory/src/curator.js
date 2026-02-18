/**
 * Curator Service
 *
 * Handles promotion of content from warm memory to cold memory.
 * Runs as a background process, chunking and embedding documents.
 *
 * Per truth.md §7: "Agents never write directly to cold memory.
 * Promotion from warm → cold is handled by a curator process."
 */
import { initColdMemory, addDocument, addChunk, getDocumentCount, getChunkCount, } from "./cold.js";
import { isEmbeddingAvailable, createBatchEmbeddings, chunkText, estimateTokenCount, } from "./embeddings.js";
import { warmGetAll, warmDelete } from "./warm.js";
import { bus, newId, now } from "@cairn/shared";
// Queue for pending promotions
const promotionQueue = [];
let isProcessing = false;
// ---- Core Functions ----
/**
 * Queue content for promotion to cold memory
 */
export function queueForPromotion(request) {
    promotionQueue.push(request);
    console.log(`[curator] Queued for promotion: "${request.title}" (${promotionQueue.length} in queue)`);
    // Start processing if not already running
    if (!isProcessing) {
        processQueue().catch(err => {
            console.error("[curator] Queue processing error:", err);
        });
    }
}
/**
 * Promote content directly to cold memory (bypasses queue)
 */
export async function promoteToCold(request) {
    if (!isEmbeddingAvailable()) {
        return { success: false, error: "Embedding service not available" };
    }
    try {
        // Initialize cold memory if needed
        initColdMemory();
        // 1. Add the document
        const doc = addDocument(request.source, request.title, request.content, request.metadata || {});
        // 2. Chunk the content
        const chunks = chunkText(request.content);
        if (chunks.length === 0) {
            return {
                success: true,
                documentId: doc.id,
                chunkCount: 0,
                tokenCount: 0
            };
        }
        // 3. Create embeddings for all chunks
        const embeddingResult = await createBatchEmbeddings(chunks);
        // 4. Store chunks with embeddings
        let totalTokens = 0;
        for (let i = 0; i < chunks.length; i++) {
            const tokenCount = embeddingResult.tokenCounts[i] || estimateTokenCount(chunks[i]);
            totalTokens += tokenCount;
            addChunk(doc.id, i, chunks[i], embeddingResult.embeddings[i], tokenCount);
        }
        // 5. Remove from warm memory if requested
        if (request.deleteFromWarm && request.warmKey) {
            await warmDelete(request.warmKey);
        }
        console.log(`[curator] Promoted to cold: "${request.title}" (${chunks.length} chunks, ${totalTokens} tokens)`);
        // Emit event for UI
        bus.emit("cold:promoted", {
            documentId: doc.id,
            title: request.title,
            chunkCount: chunks.length,
            tokenCount: totalTokens,
        });
        return {
            success: true,
            documentId: doc.id,
            chunkCount: chunks.length,
            tokenCount: totalTokens,
        };
    }
    catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error(`[curator] Promotion failed for "${request.title}":`, error);
        return { success: false, error };
    }
}
/**
 * Process the promotion queue
 */
async function processQueue() {
    if (isProcessing || promotionQueue.length === 0)
        return;
    isProcessing = true;
    console.log(`[curator] Processing queue (${promotionQueue.length} items)`);
    while (promotionQueue.length > 0) {
        const request = promotionQueue.shift();
        try {
            await promoteToCold(request);
        }
        catch (err) {
            console.error(`[curator] Failed to promote "${request.title}":`, err);
        }
        // Small delay between items to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    isProcessing = false;
    console.log("[curator] Queue empty");
}
// ---- Auto-promotion Rules ----
/**
 * Check warm memory for items that should be promoted to cold.
 * Called periodically by the scheduler.
 */
export async function runCurationCycle() {
    if (!isEmbeddingAvailable()) {
        console.log("[curator] Skipping curation cycle - embedding service not available");
        return { promoted: 0, skipped: 0 };
    }
    const warmData = warmGetAll();
    let promoted = 0;
    let skipped = 0;
    for (const [key, value] of Object.entries(warmData)) {
        // Skip system keys
        if (key.startsWith("config_") || key.startsWith("system_")) {
            skipped++;
            continue;
        }
        // Check if this should be promoted
        const shouldPromote = checkPromotionCriteria(key, value);
        if (shouldPromote) {
            const content = typeof value === "string" ? value : JSON.stringify(value, null, 2);
            queueForPromotion({
                id: newId(),
                source: inferSource(key),
                title: inferTitle(key, value),
                content,
                metadata: { warmKey: key, promotedAt: now() },
                deleteFromWarm: false, // Keep in warm for now
                warmKey: key,
            });
            promoted++;
        }
        else {
            skipped++;
        }
    }
    console.log(`[curator] Curation cycle: ${promoted} queued, ${skipped} skipped`);
    return { promoted, skipped };
}
/**
 * Check if a warm memory item should be promoted to cold
 */
function checkPromotionCriteria(key, value) {
    // Don't promote very short content
    const content = typeof value === "string" ? value : JSON.stringify(value);
    if (content.length < 100)
        return false;
    // Check for promotion markers
    if (typeof value === "object" && value !== null) {
        const obj = value;
        // Explicit promotion flag
        if (obj._promoteToCold === true)
            return true;
        // Check age (promote items older than 1 hour)
        if (obj.createdAt && typeof obj.createdAt === "string") {
            const age = Date.now() - new Date(obj.createdAt).getTime();
            if (age > 60 * 60 * 1000)
                return true;
        }
    }
    // Promote notes that are marked as read
    if (key.startsWith("note_"))
        return true;
    // Promote conversation summaries
    if (key.startsWith("summary_"))
        return true;
    return false;
}
/**
 * Infer document source from warm memory key
 */
function inferSource(key) {
    if (key.startsWith("note_"))
        return "note";
    if (key.startsWith("conversation_") || key.startsWith("summary_"))
        return "conversation";
    if (key.startsWith("doc_"))
        return "document";
    return "external";
}
/**
 * Infer document title from key and value
 */
function inferTitle(key, value) {
    if (typeof value === "object" && value !== null) {
        const obj = value;
        if (typeof obj.title === "string")
            return obj.title;
        if (typeof obj.name === "string")
            return obj.name;
        if (typeof obj.content === "string") {
            // First line or first 50 chars
            const firstLine = obj.content.split("\n")[0];
            return firstLine.slice(0, 50) + (firstLine.length > 50 ? "..." : "");
        }
    }
    // Clean up the key
    return key
        .replace(/_/g, " ")
        .replace(/^(note|doc|summary|conversation)\s+/i, "")
        .slice(0, 50);
}
// ---- Stats ----
export function getCuratorStats() {
    return {
        queueLength: promotionQueue.length,
        isProcessing,
        documents: getDocumentCount(),
        chunks: getChunkCount(),
    };
}
//# sourceMappingURL=curator.js.map