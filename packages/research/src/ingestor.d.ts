export interface IngestionResult {
    documentId: string;
    title: string;
    source: string;
    type: 'web' | 'pdf';
    charCount: number;
}
export declare function ingestWebPage(url: string): Promise<IngestionResult>;
export declare function ingestPDF(url: string): Promise<IngestionResult>;
export declare function ingestSource(url: string): Promise<IngestionResult>;
//# sourceMappingURL=ingestor.d.ts.map