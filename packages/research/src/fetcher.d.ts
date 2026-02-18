export interface ExtractedContent {
    title: string;
    content: string;
    textContent: string;
    excerpt: string;
    byline: string;
}
export declare function fetchAndExtract(url: string): Promise<ExtractedContent>;
//# sourceMappingURL=fetcher.d.ts.map