import { fetchAndExtract } from './fetcher.js';
import { fetchAndParsePDF } from './parser.js';
import { addDocument, addChunk, chunkText, createBatchEmbeddings, estimateTokenCount, initColdMemory, initEmbeddingService, isEmbeddingAvailable, } from '@cairn/memory';
import { bus } from '@cairn/shared';
async function storeDocumentWithChunks(title, content, metadata) {
    const doc = addDocument("document", title, content, metadata);
    if (isEmbeddingAvailable()) {
        const chunks = chunkText(content);
        if (chunks.length > 0) {
            const embeddingResult = await createBatchEmbeddings(chunks);
            for (let i = 0; i < chunks.length; i++) {
                const tokenCount = embeddingResult.tokenCounts[i] || estimateTokenCount(chunks[i]);
                addChunk(doc.id, i, chunks[i], embeddingResult.embeddings[i], tokenCount);
            }
        }
    }
    return doc;
}
export async function ingestWebPage(url) {
    const extracted = await fetchAndExtract(url);
    await initColdMemory();
    await initEmbeddingService();
    const doc = await storeDocumentWithChunks(extracted.title, extracted.textContent, {
        byline: extracted.byline,
        excerpt: extracted.excerpt,
        type: 'web'
    });
    const result = {
        documentId: doc.id,
        title: extracted.title,
        source: url,
        type: 'web',
        charCount: extracted.textContent.length
    };
    bus.emit('log:entry', {
        id: doc.id,
        timestamp: new Date().toISOString(),
        type: 'agent',
        content: `Ingested web page: ${extracted.title} (${url})`
    });
    return result;
}
export async function ingestPDF(url) {
    const parsed = await fetchAndParsePDF(url);
    await initColdMemory();
    await initEmbeddingService();
    const doc = await storeDocumentWithChunks(parsed.title, parsed.text, {
        pageCount: parsed.pageCount,
        type: 'pdf'
    });
    const result = {
        documentId: doc.id,
        title: parsed.title,
        source: url,
        type: 'pdf',
        charCount: parsed.text.length
    };
    bus.emit('log:entry', {
        id: doc.id,
        timestamp: new Date().toISOString(),
        type: 'agent',
        content: `Ingested PDF: ${parsed.title} (${url})`
    });
    return result;
}
export async function ingestSource(url) {
    if (url.toLowerCase().endsWith('.pdf')) {
        return ingestPDF(url);
    }
    return ingestWebPage(url);
}
//# sourceMappingURL=ingestor.js.map