
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runGatekeeper } from './nodes/gatekeeper.js';
import { createJob } from './jobs.js';
import type { ChatAttachment } from '@cairn/shared';

// Mock dependencies
vi.mock('@cairn/policy', () => ({
    getNodeConfig: vi.fn().mockReturnValue({ assigned_model: 'gpt-4', max_tokens_per_call: 100 }),
    checkCaller: vi.fn(),
}));

vi.mock('@cairn/ledger', () => ({
    appendEntry: vi.fn(),
}));

vi.mock('@cairn/shared', async () => {
    return {
        newId: () => 'test-id',
        shortTime: () => '12:00',
        bus: { emit: vi.fn() },
        now: () => '2024-01-01T00:00:00Z',
        getDataPath: () => '/tmp',
        calculateCost: () => 0,
    }
});

vi.mock('./llm.js', () => ({
    callLLM: vi.fn().mockResolvedValue({
        content: '{"intent": "task", "complexity": "small", "acknowledgement": "ok", "needs_planner": false, "needs_web_agent": false, "is_task": false}',
        cost: { cost_usd: 0 },
    }),
}));

vi.mock('./jobs.js', () => ({
    createJob: vi.fn().mockReturnValue({ id: 'job-123', status: 'queued', attachments: [] }),
    updateJob: vi.fn(),
}));

vi.mock('@cairn/goals', () => ({
    getActiveGoals: vi.fn().mockReturnValue([]),
}));

vi.mock('@cairn/tasks', () => ({
    getTasks: vi.fn().mockReturnValue([]),
}));

vi.mock('@cairn/memory', () => ({
    warmGet: vi.fn().mockReturnValue([]),
}));

describe('Vision Routing', () => {
    it('should route to vision_worker when attachments are present', async () => {
        const attachments: ChatAttachment[] = [{
            id: 'img-1',
            type: 'image',
            mimeType: 'image/png',
            dataUrl: 'data:image/png;base64,abc',
            name: 'test.png'
        }];

        const result = await runGatekeeper('Look at this', attachments);

        expect(result.metadata?.needs_vision).toBe(true);
        expect(result.status).toBe('running');
    });

    it('should NOT route to vision_worker when NO attachments are present', async () => {
        const result = await runGatekeeper('Just text', []);

        expect(result.metadata?.needs_vision).toBeUndefined();
    });
});
