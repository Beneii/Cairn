/**
 * Web Tools
 *
 * Web search and URL fetching with safety checks.
 */
import { z } from "zod";
import { type ToolManifest } from "../manifest.js";
declare const webFetchInput: z.ZodObject<{
    url: z.ZodString;
    maxBytes: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
declare const webFetchOutput: z.ZodObject<{
    content: z.ZodString;
    contentType: z.ZodOptional<z.ZodString>;
    statusCode: z.ZodNumber;
    truncated: z.ZodBoolean;
}, z.core.$strip>;
export declare const webFetch: ToolManifest<z.infer<typeof webFetchInput>, z.infer<typeof webFetchOutput>>;
export declare function registerWebTools(): void;
export {};
//# sourceMappingURL=web.d.ts.map