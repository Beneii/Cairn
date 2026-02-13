# 07 — Home Lab Portability (Ollama / Local AI)

> **Status**: Partially implemented.
> - Dashboard toggle for `LOCAL_MODE_ENABLED` exists in Settings → System.
> - `callLLM` in `packages/orchestrator/src/llm.ts` supports Ollama via `baseURL` override.
> - Model names are configurable per node in `packages/policy/src/nodes.ts`.
> - Cost tracking handles local models (zero cost).
> **Remaining**: Embeddings are still OpenAI-only. Context window management for smaller local models needs tuning.

Cairn is primarily built around the OpenAI API (`gpt-4o`, `gpt-4o-mini`) and `text-embedding-3-small`. However, the architecture supports local LLMs (e.g., via Ollama) with the changes below.

## 1. The Abstraction Layer

All LLM calls flow through a single function: `callLLM` in `packages/orchestrator/src/llm.ts`.

- **Current State**: Hardcoded to instantiate `new OpenAI({ apiKey })`.
- **Required Change**: Modify `initLLM` to accept a `baseURL` (e.g., `http://localhost:11434/v1` for Ollama) or use an environment variable `LLM_BASE_URL`.

```typescript
// packages/orchestrator/src/llm.ts

// ...
client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "ollama", // Ollama doesn't strictly need a key
  baseURL: process.env.LLM_BASE_URL // Add this capability
});
// ...
```

## 2. Model Configuration

Models are not hardcoded in the agent logic; they are defined in the **Policy** package.

- **Location**: `packages/policy/src/nodes.ts`
- **Current State**:
  - `gatekeeper`: `gpt-4o-mini`
  - `planner`: `gpt-4o`
  - `executor`: `gpt-4o`
  - ...
- **Required Change**: Update `assigned_model` for each node to match your local Ollama models (e.g., `llama3`, `mistral`).

```typescript
// packages/policy/src/nodes.ts
export const NODES: Record<string, NodeConfig> = {
  gatekeeper: {
    // ...
    assigned_model: "llama3:8b", // Fast, good for routing
  },
  planner: {
    // ...
    assigned_model: "llama3:70b", // Smart, needs strong reasoning
  },
  // ...
};
```

## 3. Embeddings (Memory)

The **Memory** package currently relies on OpenAI's `text-embedding-3-small`.

- **Location**: `packages/memory/src/embeddings.ts`
- **Required Change**: If you want fully local memory, you must replace the OpenAI embedding call with a local equivalent (e.g., Ollama's `/api/embeddings` endpoint or a local library like `transformers.js`).

## 4. Cost Calculation

Cost tracking is hardcoded for OpenAI pricing.

- **Location**: `packages/shared/src/utils.ts` -> `MODEL_COSTS`
- **Impact**: Local models are "free" (minus electricity).
- **Required Change**: Add your local model names to `MODEL_COSTS` with `0` cost, or update `calculateCost` to handle unknown models gracefully without erroring.

## 5. Context Window Warning

Local models often have smaller context windows than GPT-4o (128k).

- **Impact**: The `planner` and `executor` inject large amounts of context (chat history, tool outputs, valid tools list).
- **Mitigation**: You may need to reduce `check.ts` `max_tokens_per_call` limits or aggressively truncate context in `planner.ts`/`executor-node.ts` if you hit context limits.
