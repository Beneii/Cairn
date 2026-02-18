
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executePlan } from './executor-v2.js';
import type { Plan } from '@cairn/shared';
import { executeSkill } from '../skill-registry.js';

// Mock dependencies
vi.mock('../skill-registry.js', () => ({
    ensureSkillRegistry: vi.fn(),
    getSkillDefinition: vi.fn((id) => {
        if (id === 'test.producer') return { id: 'test.producer' };
        if (id === 'test.consumer') return { id: 'test.consumer' };
        if (id === 'test.flaky') return { id: 'test.flaky' };
        return null; // Unknown skill
    }),
    validateSkillInput: vi.fn(() => ({ valid: true })),
    executeSkill: vi.fn(async (id, args) => {
        if (id === 'test.producer') {
            return {
                success: true,
                output: JSON.stringify({
                    id: 'produced-id-123',
                    details: {
                        name: 'something',
                        value: 42
                    }
                })
            };
        }
        if (id === 'test.consumer') {
            return {
                success: true,
                output: `Received: ${JSON.stringify(args)}`
            };
        }
        if (id === 'test.flaky') {
            const invocation = (globalThis as any).__flakyCount = ((globalThis as any).__flakyCount || 0) + 1;
            if (invocation < 2) return { success: false, output: 'Transient failure' };
            return { success: true, output: 'Recovered' };
        }
        return { success: false, output: 'Unknown skill' };
    })
}));

vi.mock('@cairn/shared', () => ({
    newId: () => 'test-id',
    now: () => '2024-01-01T00:00:00Z',
    bus: { emit: vi.fn() }
}));

vi.mock('@cairn/ledger', () => ({
    appendEntry: vi.fn()
}));

vi.mock('@cairn/skills', () => ({
    recordSkillInvocation: vi.fn()
}));

vi.mock('@cairn/memory', () => ({
    memoryRead: vi.fn(),
    memoryWrite: vi.fn(),
    initWarmMemory: vi.fn()
}));

// fs mock to avoid writing debug logs
vi.mock('fs', () => ({
    appendFileSync: vi.fn()
}));

describe('Executor V2 Variable Substitution', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (globalThis as any).__flakyCount = 0;
    });

    it('should substitute variables from previous steps', async () => {
        const plan: Plan = {
            steps: [
                {
                    skillId: 'test.producer',
                    arguments: {}
                },
                {
                    skillId: 'test.consumer',
                    arguments: {
                        targetId: '{{step1.output.id}}',
                        val: '{{step1.output.details.value}}'
                    }
                }
            ],
            maxToolCalls: 5,
            riskLevel: 'low'
        };

        const result = await executePlan(plan, 'msg-1');

        expect(result.allSuccess).toBe(true);
        expect(result.steps).toHaveLength(2);

        // Check output of consumer
        const consumerOutput = result.steps[1].output;
        expect(consumerOutput).toContain('produced-id-123');
        expect(consumerOutput).toContain('42');

        // Verify it didn't just stringify the placeholder
        expect(consumerOutput).not.toContain('{{step1.output.id}}');
    });

    it('should handle nested object substitution', async () => {
        const plan: Plan = {
            steps: [
                {
                    skillId: 'test.producer',
                    arguments: {}
                },
                {
                    skillId: 'test.consumer',
                    arguments: {
                        // pass entire details object
                        info: '{{step1.output.details}}'
                    }
                }
            ],
            maxToolCalls: 5,
            riskLevel: 'low'
        };

        const result = await executePlan(plan, 'msg-2');
        expect(result.allSuccess).toBe(true);
        const consumerOutput = result.steps[1].output;
        // Should have received the object { name: 'something', value: 42 }
        expect(consumerOutput).toContain('"name":"something"');
        expect(consumerOutput).toContain('"value":42');
    });

    it('should gracefully handle missing paths', async () => {
        const plan: Plan = {
            steps: [
                {
                    skillId: 'test.producer',
                    arguments: {}
                },
                {
                    skillId: 'test.consumer',
                    arguments: {
                        missing: '{{step1.output.does_not_exist}}'
                    }
                }
            ],
            maxToolCalls: 5,
            riskLevel: 'low'
        };

        const result = await executePlan(plan, 'msg-3');
        expect(result.allSuccess).toBe(true);
    });

    it('retries flaky steps and records confidence hooks', async () => {
        const plan: Plan = {
            steps: [
                {
                    skillId: 'test.flaky',
                    arguments: {},
                    workerClass: 'light',
                    parallelGroup: 'fanout-a',
                    maxRetries: 2,
                    confidenceHint: 0.9,
                },
                {
                    skillId: 'test.consumer',
                    arguments: { ack: true },
                    workerClass: 'light',
                    parallelGroup: 'fanout-a',
                }
            ],
            maxToolCalls: 5,
            riskLevel: 'low',
            governance: { maxParallelLightWorkers: 2, maxRetriesPerStep: 1, escalationMode: 'final-step' },
        };

        const result = await executePlan(plan, 'msg-4');
        expect(result.allSuccess).toBe(true);
        expect(result.steps[0].attempts).toBeGreaterThan(1);
        expect(result.steps[0].confidence).toBeLessThanOrEqual(0.9);
        expect(vi.mocked(executeSkill).mock.calls.length).toBeGreaterThanOrEqual(3);
    });
});
