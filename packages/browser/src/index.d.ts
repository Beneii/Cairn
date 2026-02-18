import { Page } from 'playwright';
export interface BrowserOptions {
    headless?: boolean;
    profileId?: string;
    domainAllowlist?: string[];
    userDataDir?: string;
}
export interface BrowserActionResult {
    success: boolean;
    message: string;
    screenshotPath?: string;
    htmlPath?: string;
}
export declare class BrowserOperator {
    private context;
    private options;
    private sessionDir;
    constructor(options?: BrowserOptions);
    init(): Promise<void>;
    close(): Promise<void>;
    getPage(): Promise<Page>;
    private isDomainAllowed;
    navigate(url: string): Promise<BrowserActionResult>;
    click(selector: string): Promise<BrowserActionResult>;
    fill(selector: string, value: string): Promise<BrowserActionResult>;
    extract(selector: string): Promise<{
        success: boolean;
        data?: string;
        message: string;
    }>;
    type(selector: string, text: string, delay?: number): Promise<BrowserActionResult>;
    press(key: string): Promise<BrowserActionResult>;
    screenshot(): Promise<BrowserActionResult>;
    /**
     * Observe the current page and return a structured summary of interactive elements.
     * This acts as a "screen reader" for the LLM.
     */
    observe(): Promise<{
        success: boolean;
        url: string;
        title: string;
        elements: any[];
    }>;
}
//# sourceMappingURL=index.d.ts.map