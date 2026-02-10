import pdf from 'pdf-parse';

export interface ParsedPDF {
    title: string;
    text: string;
    pageCount: number;
    metadata: any;
}

export async function parsePDF(buffer: Buffer): Promise<ParsedPDF> {
    const data = await pdf(buffer);

    return {
        title: data.info?.Title || 'Untitled PDF',
        text: data.text,
        pageCount: data.numpages,
        metadata: data.metadata
    };
}

export async function fetchAndParsePDF(url: string): Promise<ParsedPDF> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch PDF from ${url}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return parsePDF(buffer);
}
