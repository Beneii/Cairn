import { fetchAndExtract } from './fetcher.js';
import { fetchAndParsePDF } from './parser.js';
import { addDocument, initColdMemory, initEmbeddingService } from '@cairn/memory';
import { bus } from '@cairn/shared';

export interface IngestionResult {
    documentId: string;
    title: string;
    source: string;
    type: 'web' | 'pdf';
    charCount: number;
}

export async function ingestWebPage(url: string): Promise<IngestionResult> {
    const extracted = await fetchAndExtract(url);

    await initColdMemory();
    await initEmbeddingService();

    const doc = addDocument("document", extracted.title, extracted.textContent, {
        byline: extracted.byline,
        excerpt: extracted.excerpt,
        type: 'web'
    });

    const result: IngestionResult = {
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
    } as any);

    return result;
}

export async function ingestPDF(url: string): Promise<IngestionResult> {
    const parsed = await fetchAndParsePDF(url);

    await initColdMemory();
    await initEmbeddingService();

    const doc = addDocument("document", parsed.title, parsed.text, {
        pageCount: parsed.pageCount,
        type: 'pdf'
    });

    const result: IngestionResult = {
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
    } as any);

    return result;
}

export async function ingestSource(url: string): Promise<IngestionResult> {
    if (url.toLowerCase().endsWith('.pdf')) {
        return ingestPDF(url);
    }
    return ingestWebPage(url);
}
