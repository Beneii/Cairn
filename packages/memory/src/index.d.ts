export { hotGet, hotSet, hotDelete, hotClear, hotPurgeExpired, } from "./hot.js";
export { initWarmMemory, warmGet, warmSet, warmDelete, warmGetAll, } from "./warm.js";
export { memoryRead, memoryWrite, type MemoryAccess } from "./memory.js";
export { initColdMemory, addDocument, getDocument, getAllDocuments, getDocumentCount, addChunk, getChunksForDocument, getChunkCount, vectorSearch, deleteDocument, getColdMemoryStats, type ColdDocument, type ColdChunk, type SearchResult, } from "./cold.js";
export { initEmbeddingService, isEmbeddingAvailable, createEmbedding, createBatchEmbeddings, chunkText, estimateTokenCount, getEmbeddingConfig, type EmbeddingResult, type BatchEmbeddingResult, } from "./embeddings.js";
export { queueForPromotion, promoteToCold, runCurationCycle, getCuratorStats, type PromotionRequest, type PromotionResult, } from "./curator.js";
//# sourceMappingURL=index.d.ts.map