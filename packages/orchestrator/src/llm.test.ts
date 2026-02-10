
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callLLM, initLLM } from './llm.js';

// Mock shared config
vi.mock('@cairn/shared', async () => {
    return {
        calculateCost: vi.fn().mockReturnValue(0),
        now: vi.fn().mockReturnValue("2024-01-01T00:00:00Z"),
        MODEL_COSTS: {},
    };
});

// Mock nodes config
vi.mock('@cairn/policy', () => {
    return {
        getNodeConfig: vi.fn().mockImplementation((nodeName) => {
            return {
                name: nodeName,
                assigned_model: 'gpt-4o',
                local_model: 'phi-3.5-mini'
            };
        })
    };
});

// Mock OpenAI
const mockOpenAI = {
    chat: {
        completions: {
            create: vi.fn().mockResolvedValue({
                choices: [{ message: { content: 'OpenAI Response' } }],
                usage: { prompt_tokens: 10, completion_tokens: 20 }
            })
        }
    }
};

vi.mock('openai', () => {
    const OpenAI = vi.fn(() => mockOpenAI);
    return { default: OpenAI };
});

// Mock Ollama fetch
global.fetch = vi.fn();

describe('LLM Local Mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.OPENAI_API_KEY = 'test-key';
        delete process.env.LOCAL_MODE_ENABLED;
        initLLM(true);
    });

    afterEach(() => {
        delete process.env.LOCAL_MODE_ENABLED;
    });

    it('should use OpenAI when local mode is disabled', async () => {
        process.env.LOCAL_MODE_ENABLED = 'false';

        const result = await callLLM({
            model: 'gpt-4o',
            systemPrompt: 'sys',
            userMessage: 'hello',
            maxTokens: 100
        }, 'test-node', 'job-1');

        expect(result.content).toBe('OpenAI Response');
        expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
        expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(expect.objectContaining({
            model: 'gpt-4o'
        }));
    });

    it('should use Ollama when local mode is enabled', async () => {
        process.env.LOCAL_MODE_ENABLED = 'true';

        // Mock fetch for Ollama
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({
                message: { content: 'Ollama Response' },
                done: true,
                prompt_eval_count: 5,
                eval_count: 10
            })
        });

        const result = await callLLM({
            model: 'gpt-4o',
            systemPrompt: 'sys',
            userMessage: 'hello',
            maxTokens: 100
        }, 'test-node', 'job-1');

        expect(result.content).toBe('Ollama Response');
        expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();

        // Verify fetch was called with Ollama endpoint and LOCAL model from node config
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('http://localhost:11434/api/chat'),
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('"model":"phi-3.5-mini"')
            })
        );
    });
});
