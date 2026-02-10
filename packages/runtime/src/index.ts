import { registry, ToolDefinition } from '@cairn/tools';
import { checkTool, PolicyViolation } from '@cairn/policy';
import { recordEvent } from '@cairn/ledger';
import { metrics } from '@cairn/telemetry';

export interface RuntimeContext {
    nodeName: string;
    jobId: string;
    requestId?: string;
}

export class Runtime {
    async executeTool(context: RuntimeContext, name: string, args: any): Promise<any> {
        const results = await this.executeTools(context, [{ name, args }]);
        return results[0];
    }

    async executeTools(context: RuntimeContext, toolCalls: { name: string, args: any }[]): Promise<any[]> {
        return Promise.all(toolCalls.map(async ({ name, args }) => {
            const tool = registry.getTool(name);
            if (!tool) {
                throw new Error(`Tool ${name} not found in registry`);
            }

            // 1. Policy Gate
            try {
                checkTool(context.nodeName, name, tool.tier);
            } catch (err: any) {
                if (err instanceof PolicyViolation) {
                    await recordEvent({
                        type: 'security',
                        node: context.nodeName,
                        job_id: context.jobId,
                        content: `Policy Denied: ${err.violation} for tool ${name}`,
                        metadata: { tool: name, args, error: err.message }
                    });
                }
                throw err;
            }

            // 2. Execution with Trace
            const startTime = Date.now();
            try {
                const result = await tool.execute(args);
                const duration = Date.now() - startTime;

                metrics.record('tool_latency', duration, { tool: name, node: context.nodeName });
                metrics.record('tool_success', 1, { tool: name });

                await recordEvent({
                    type: 'tool',
                    node: context.nodeName,
                    job_id: context.jobId,
                    content: `Executed tool: ${name}`,
                    metadata: {
                        tool: name,
                        args: this.sanitizeArgs(args),
                        duration_ms: duration,
                        success: true
                    }
                });

                return result;
            } catch (err: any) {
                const duration = Date.now() - startTime;
                metrics.record('tool_latency', duration, { tool: name, node: context.nodeName });
                metrics.record('tool_success', 0, { tool: name });

                await recordEvent({
                    type: 'error',
                    node: context.nodeName,
                    job_id: context.jobId,
                    content: `Tool error: ${name}`,
                    metadata: {
                        tool: name,
                        args: this.sanitizeArgs(args),
                        duration_ms: duration,
                        error: err instanceof Error ? err.message : String(err)
                    }
                });
                throw err;
            }
        }));
    }

    private sanitizeArgs(args: any): any {
        // Redaction logic would go here (C0 Vault integration)
        return args;
    }
}

export const runtime = new Runtime();
