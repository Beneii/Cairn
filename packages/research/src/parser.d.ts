export interface ParsedPDF {
    title: string;
    text: string;
    pageCount: number;
    metadata: any;
}
export declare function parsePDF(buffer: Buffer): Promise<ParsedPDF>;
export declare function fetchAndParsePDF(url: string): Promise<ParsedPDF>;
//# sourceMappingURL=parser.d.ts.map