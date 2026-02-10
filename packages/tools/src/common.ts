import { registry } from './index.js';
import { z } from 'zod';

// We will eventually move the actual implementations here or import them.
// For now, these are placeholders that will be wired up to the existing executor logic.

export function registerCommonTools() {
    registry.register({
        name: 'memory_read',
        description: 'Read from memory ("hot" = session, "warm" = persistent)',
        tier: 0,
        parameters: z.object({
            tier: z.enum(['hot', 'warm', 'cold']),
            key: z.string()
        }),
        execute: async (args) => {
            // Implementation provided by runtime/context
            return null;
        }
    });

    registry.register({
        name: 'memory_write',
        description: 'Store information (warm = permanent, hot = session-only)',
        tier: 1,
        parameters: z.object({
            tier: z.enum(['hot', 'warm']),
            key: z.string(),
            value: z.any()
        }),
        execute: async (args) => {
            return null;
        }
    });

    registry.register({
        name: 'web_search',
        description: 'Search the web via DuckDuckGo',
        tier: 0,
        parameters: z.object({
            query: z.string()
        }),
        execute: async (args) => {
            return null;
        }
    });

    // Tier 3 example: External Write (requires approval)
    registry.register({
        name: 'gmail_send',
        description: 'Send an email via Gmail',
        tier: 3,
        parameters: z.object({
            to: z.string(),
            subject: z.string(),
            body: z.string()
        }),
        execute: async (args) => {
            return { success: true, message: 'Email sent' };
        }
    });
}
