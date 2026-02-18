import type { LedgerEntry, LedgerEntryType } from "@cairn/shared";
export declare function initLedger(): Promise<void>;
export declare function appendEntry(type: LedgerEntryType, node: string, jobId: string, content: string, metadata?: Record<string, unknown>): Promise<LedgerEntry>;
export declare function recordEvent(params: {
    type: LedgerEntryType;
    node: string;
    job_id: string;
    content: string;
    metadata?: Record<string, unknown>;
}): Promise<LedgerEntry>;
export declare function getEntries(filter?: {
    jobId?: string;
    type?: string;
    verifyIntegrity?: boolean;
}): LedgerEntry[];
export declare function verifyChain(): boolean;
//# sourceMappingURL=ledger.d.ts.map