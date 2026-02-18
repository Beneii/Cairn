import type { SkillRequest, SkillRequestStatus } from "./types.js";
export declare function initSkillRequestStore(): void;
export declare function createSkillRequest(data: {
    goal: string;
    required_tools: string[];
    proposed_tier?: number;
    source_context?: string;
}): SkillRequest;
export declare function listSkillRequests(status?: SkillRequestStatus): SkillRequest[];
export declare function getSkillRequestById(id: string): SkillRequest | null;
export declare function updateSkillRequestStatus(id: string, status: SkillRequestStatus): void;
//# sourceMappingURL=skill-requests-store.d.ts.map