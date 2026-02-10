

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

export interface OllamaModelInfo {
    name: string;
    size: number;
    digest: string;
    modified_at: string;
}

export async function isOllamaAvailable(): Promise<boolean> {
    try {
        const res = await fetch(`${OLLAMA_BASE_URL}/api/version`);
        return res.ok;
    } catch (err) {
        return false;
    }
}

export async function getLocalModels(): Promise<OllamaModelInfo[]> {
    try {
        const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
        if (!res.ok) return [];
        const data = await res.json() as { models: OllamaModelInfo[] };
        return data.models || [];
    } catch (err) {
        console.warn("[ollama] Failed to list models:", err);
        return [];
    }
}

export async function pullModel(modelName: string): Promise<boolean> {
    try {
        const res = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: modelName, stream: false }),
        });
        return res.ok;
    } catch (err) {
        console.error(`[ollama] Failed to pull model ${modelName}:`, err);
        return false;
    }
}

/**
 * Pull a model with streaming progress. Returns a ReadableStream of NDJSON
 * lines from Ollama's pull API for the caller to pipe through (e.g. SSE).
 */
export async function pullModelStream(modelName: string): Promise<ReadableStream<Uint8Array> | null> {
    try {
        const res = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: modelName, stream: true }),
        });
        if (!res.ok || !res.body) return null;
        return res.body;
    } catch (err) {
        console.error(`[ollama] Failed to start streaming pull for ${modelName}:`, err);
        return null;
    }
}

export interface OllamaChatRequest {
    model: string;
    messages: {
        role: string;
        content: string;
        images?: string[]; // base64 encoded strings
    }[];
    stream?: boolean;
}

export interface OllamaChatResponse {
    model: string;
    created_at: string;
    message: { role: string; content: string };
    done: boolean;
    total_duration: number;
    expected_eval_count?: number; // Approximate check
    prompt_eval_count?: number;
    eval_count?: number;
}

export async function chatOllama(req: OllamaChatRequest): Promise<OllamaChatResponse> {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
    });

    if (!res.ok) {
        throw new Error(`Ollama API error: ${res.statusText}`);
    }

    // Cast the response to unknown first, then to the expected type
    const data = await res.json();
    return data as OllamaChatResponse;
}
