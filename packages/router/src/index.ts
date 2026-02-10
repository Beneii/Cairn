export interface RouterOptions {
    intent?: string;
    complexity?: 'small' | 'medium' | 'large';
    preferredModel?: string;
}

export interface ModelRouting {
    model: string;
    description: string;
}

const MODELS = {
    fast: 'gpt-4o-mini',
    smart: 'gpt-4o',
    strong: 'o1-preview'
};

export class Router {
    route(options: RouterOptions): ModelRouting {
        if (options.preferredModel) {
            return { model: options.preferredModel, description: 'User preferred' };
        }

        const complexity = options.complexity || 'medium';

        switch (complexity) {
            case 'small':
                return { model: MODELS.fast, description: 'Optimized for speed' };
            case 'large':
                return { model: MODELS.smart, description: 'Optimized for high-complexity planning' };
            case 'medium':
            default:
                return { model: MODELS.fast, description: 'Standard throughput model' };
        }
    }

    estimateCost(model: string, promptTokens: number, completionTokens: number): number {
        // Prices per 1k tokens (ballpark for gpt-4o families)
        const pricing: Record<string, { prompt: number, completion: number }> = {
            'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
            'gpt-4o': { prompt: 0.005, completion: 0.015 },
        };

        const rates = pricing[model] || pricing['gpt-4o'];
        const cost = (promptTokens / 1000) * rates.prompt + (completionTokens / 1000) * rates.completion;
        return cost;
    }
}

export const router = new Router();
