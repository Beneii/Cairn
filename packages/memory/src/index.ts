export {
  hotGet,
  hotSet,
  hotDelete,
  hotClear,
  hotPurgeExpired,
} from "./hot.js";
export {
  initWarmMemory,
  warmGet,
  warmSet,
  warmDelete,
  warmGetAll,
} from "./warm.js";
export { memoryRead, memoryWrite, type MemoryAccess } from "./memory.js";

// Cold memory (RAG)
export {
  initColdMemory,
  addDocument,
  getDocument,
  getAllDocuments,
  getDocumentCount,
  addChunk,
  getChunksForDocument,
  getChunkCount,
  vectorSearch,
  deleteDocument,
  getColdMemoryStats,
  type ColdDocument,
  type ColdChunk,
  type SearchResult,
} from "./cold.js";

// Embeddings
export {
  initEmbeddingService,
  isEmbeddingAvailable,
  createEmbedding,
  createBatchEmbeddings,
  chunkText,
  estimateTokenCount,
  getEmbeddingConfig,
  type EmbeddingResult,
  type BatchEmbeddingResult,
} from "./embeddings.js";

// Curator (warm → cold promotion)
export {
  queueForPromotion,
  promoteToСold,
  runCurationCycle,
  getCuratorStats,
  type PromotionRequest,
  type PromotionResult,
} from "./curator.js";
