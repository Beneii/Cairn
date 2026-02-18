
import { describe, it, expect, vi } from "vitest";
import { registerSkill, executeSkill, type SkillContext } from "../skill-registry.js";
import { type SkillManifest } from "@cairn/shared";

describe("Skill Governance", () => {
    const mockCtx: SkillContext = {
        jobId: "job-1",
        messageId: "msg-1",
        memoryRead: () => undefined,
        memoryWrite: async () => { },
    };

    it("should block execution of disabled skills", async () => {
        const disabledManifest: SkillManifest = {
            id: "test.disabled",
            version: "1.0.0",
            description: "A disabled skill",
            inputSchema: {},
            outputSchema: {},
            riskLevel: "low",
            enabled: false, // <-- DISABLED
        };

        registerSkill(disabledManifest, async () => ({ success: true, output: "Should not run" }));

        const result = await executeSkill("test.disabled", {}, mockCtx);

        expect(result.success).toBe(false);
        expect(result.output).toContain("is disabled by governance policy");
    });

    it("should allow execution of enabled skills", async () => {
        const enabledManifest: SkillManifest = {
            id: "test.enabled",
            version: "1.0.0",
            description: "An enabled skill",
            inputSchema: {},
            outputSchema: {},
            riskLevel: "low",
            enabled: true,
        };

        registerSkill(enabledManifest, async () => ({ success: true, output: "Ran successfully" }));

        const result = await executeSkill("test.enabled", {}, mockCtx);

        expect(result.success).toBe(true);
        expect(result.output).toBe("Ran successfully");
    });

    it("should warn on high risk skills (but still execute for now)", async () => {
        const highRiskManifest: SkillManifest = {
            id: "test.risky",
            version: "1.0.0",
            description: "A risky skill",
            inputSchema: {},
            outputSchema: {},
            riskLevel: "high", // <-- HIGH RISK
            enabled: true,
        };

        const consoleSpy = vi.spyOn(console, "warn");

        registerSkill(highRiskManifest, async () => ({ success: true, output: "Risky run" }));

        const result = await executeSkill("test.risky", {}, mockCtx);

        expect(result.success).toBe(true);
        // We expect a governance warning
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[GOVERNANCE] Executing HIGH RISK skill"));

        consoleSpy.mockRestore();
    });
});
