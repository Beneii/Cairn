/**
 * Web Tools
 * 
 * Web search and URL fetching with safety checks.
 */

import { z } from "zod";
import { registerTool, type ToolManifest } from "../manifest.js";

// Security helpers
function isPrivateIP(hostname: string): boolean {
    const privateRanges = [
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[01])\./,
        /^192\.168\./,
        /^127\./,
        /^localhost$/i,
        /^169\.254\./,
    ];
    return privateRanges.some((pattern) => pattern.test(hostname));
}

function isMetadataEndpoint(hostname: string): boolean {
    const metadataHosts = ["169.254.169.254", "metadata.google.internal", "metadata"];
    return metadataHosts.includes(hostname.toLowerCase());
}

function isSafeURL(urlString: string): { safe: boolean; reason?: string } {
    try {
        const url = new URL(urlString);
        if (!["http:", "https:"].includes(url.protocol)) {
            return { safe: false, reason: "Only HTTP/HTTPS allowed" };
        }
        if (isPrivateIP(url.hostname)) {
            return { safe: false, reason: "Private IP not allowed" };
        }
        if (isMetadataEndpoint(url.hostname)) {
            return { safe: false, reason: "Metadata endpoint not allowed" };
        }
        return { safe: true };
    } catch {
        return { safe: false, reason: "Invalid URL" };
    }
}

// ---- web.fetch ----

const webFetchInput = z.object({
    url: z.string().url(),
    maxBytes: z.number().max(1000000).default(100000),
});

const webFetchOutput = z.object({
    content: z.string(),
    contentType: z.string().optional(),
    statusCode: z.number(),
    truncated: z.boolean(),
});

export const webFetch: ToolManifest<
    z.infer<typeof webFetchInput>,
    z.infer<typeof webFetchOutput>
> = {
    name: "web.fetch",
    description: "Fetch content from a URL",
    category: "web",
    inputSchema: webFetchInput,
    outputSchema: webFetchOutput,
    costHint: "cheap",
    cacheable: true,
    cacheTTLSeconds: 3600,
    safetyTier: "auto",
    sideEffects: ["reads:web"],

    handler: async (input) => {
        const safetyCheck = isSafeURL(input.url);
        if (!safetyCheck.safe) {
            return {
                ok: false,
                error: `URL blocked: ${safetyCheck.reason}`,
            };
        }

        try {
            const response = await fetch(input.url, {
                headers: { "User-Agent": "Cairn/1.0" },
                signal: AbortSignal.timeout(10000),
            });

            const buffer = await response.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            const truncated = bytes.length > input.maxBytes;
            const content = new TextDecoder().decode(
                truncated ? bytes.slice(0, input.maxBytes) : bytes
            );

            return {
                ok: true,
                data: {
                    content,
                    contentType: response.headers.get("content-type") ?? undefined,
                    statusCode: response.status,
                    truncated,
                },
            };
        } catch (err) {
            return {
                ok: false,
                error: err instanceof Error ? err.message : "Fetch failed",
            };
        }
    },
};

// ---- Register all ----

export function registerWebTools(): void {
    registerTool(webFetch);
}
