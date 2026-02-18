import pdf from 'pdf-parse';
export async function parsePDF(buffer) {
    const data = await pdf(buffer);
    return {
        title: data.info?.Title || 'Untitled PDF',
        text: data.text,
        pageCount: data.numpages,
        metadata: data.metadata
    };
}
export async function fetchAndParsePDF(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch PDF from ${url}: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return parsePDF(buffer);
}
//# sourceMappingURL=parser.js.map