import type { SkillMetrics } from "./types.js";
export declare function initSkillMetricsStore(): void;
export declare function recordSkillInvocation(params: {
    skill_id: string;
    latency_ms: number;
    success: boolean;
}): void;
export declare function getSkillMetrics(skill_id: string): SkillMetrics | null;
export declare function listSkillMetrics(): SkillMetrics[];
//# sourceMappingURL=skill-metrics-store.d.ts.map