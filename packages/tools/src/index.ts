import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface ToolDefinition<P extends z.ZodTypeAny = z.ZodTypeAny, R = any> {
    name: string;
    description: string;
    parameters: P;
    execute: (args: z.infer<P>) => Promise<R>;
    tier: 0 | 1 | 2 | 3;
}

export class ToolRegistry {
    private tools = new Map<string, ToolDefinition<any, any>>();

    register<P extends z.ZodTypeAny, R>(tool: ToolDefinition<P, R>): void {
        this.tools.set(tool.name, tool);
    }

    getTool(name: string): ToolDefinition | undefined {
        return this.tools.get(name);
    }

    listTools(): ToolDefinition[] {
        return Array.from(this.tools.values());
    }

    getJsonSchemas(): any[] {
        return this.listTools().map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: zodToJsonSchema(tool.parameters)
        }));
    }
}

export const registry = new ToolRegistry();
