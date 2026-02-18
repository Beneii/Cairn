export { hotGet, hotSet, hotDelete, hotClear, hotPurgeExpired, } from "./hot.js";
export { initWarmMemory, warmGet, warmSet, warmDelete, warmGetAll, } from "./warm.js";
export { memoryRead, memoryWrite } from "./memory.js";
// Cold memory (RAG)
export { initColdMemory, addDocument, getDocument, getAllDocuments, getDocumentCount, addChunk, getChunksForDocument, getChunkCount, vectorSearch, deleteDocument, getColdMemoryStats, } from "./cold.js";
// Embeddings
export { initEmbeddingService, isEmbeddingAvailable, createEmbedding, createBatchEmbeddings, chunkText, estimateTokenCount, getEmbeddingConfig, } from "./embeddings.js";
// Curator (warm → cold promotion)
export { queueForPromotion, promoteToCold, runCurationCycle, getCuratorStats, } from "./curator.js";
//# sourceMappingURL=index.js.map