import { useState, useEffect, useCallback } from 'react';
import { Download, Check, Loader2, Server, ServerOff, AlertCircle } from 'lucide-react';
import { getApiBase } from '../../../../config/runtime';

interface ModelInfo {
    name: string;
    size: number;
    digest: string;
}

interface AgentModel {
    id: string;
    roles: string;
    size_gb: number;
}

/**
 * Full model roster from the Lean Agent Architecture spec.
 * 7 unique models — some shared across roles.
 */
const REQUIRED_MODELS: AgentModel[] = [
    { id: "phi3.5:latest", roles: "Gatekeeper, Orchestrator, Web Agent", size_gb: 2.2 },
    { id: "qwen2.5-coder:7b", roles: "Planner, Builder, Critic", size_gb: 4.7 },
    { id: "phi3:mini", roles: "Executor (tool runner)", size_gb: 2.2 },
    { id: "mistral:7b-instruct", roles: "Responder, Ops Worker", size_gb: 4.1 },
    { id: "llava-llama3:8b", roles: "Vision Worker (image/OCR/UI)", size_gb: 4.7 },
];

interface DownloadProgress {
    status: string;
    total?: number;
    completed?: number;
    percent: number;
}

export function ModelManager({ darkMode }: { darkMode: boolean }) {
    const [installedModels, setInstalledModels] = useState<string[]>([]);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [progress, setProgress] = useState<DownloadProgress | null>(null);
    const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'running' | 'stopped'>('checking');
    const [error, setError] = useState<string | null>(null);

    const subtleBg = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(26,29,33,0.05)';
    const border = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(26,29,33,0.1)';

    const checkStatus = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/models`);
            if (res.ok) {
                const data = await res.json();
                setInstalledModels((data.models || []).map((m: ModelInfo) => m.name));
                setOllamaStatus('running');
            } else {
                setOllamaStatus('stopped');
            }
        } catch {
            setOllamaStatus('stopped');
        }
    }, []);

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 15000);
        return () => clearInterval(interval);
    }, [checkStatus]);

    const handleDownload = async (modelId: string) => {
        setDownloading(modelId);
        setProgress({ status: 'starting', percent: 0 });
        setError(null);

        try {
            const res = await fetch(`${getApiBase()}/models/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: modelId })
            });

            if (!res.ok) {
                setError(`Failed to start download (HTTP ${res.status})`);
                setDownloading(null);
                setProgress(null);
                return;
            }

            // Read SSE stream for progress
            const reader = res.body?.getReader();
            if (!reader) {
                setError('No stream available');
                setDownloading(null);
                setProgress(null);
                return;
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const payload = line.slice(6).trim();
                    if (payload === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(payload);
                        if (parsed.error) {
                            setError(parsed.error);
                            break;
                        }
                        const pct = parsed.total && parsed.total > 0
                            ? Math.round((parsed.completed || 0) / parsed.total * 100)
                            : 0;
                        setProgress({
                            status: parsed.status || 'downloading',
                            total: parsed.total,
                            completed: parsed.completed,
                            percent: pct,
                        });
                    } catch {
                        // ignore malformed lines
                    }
                }
            }

            // Done — refresh model list
            await checkStatus();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Download failed');
        } finally {
            setDownloading(null);
            setProgress(null);
        }
    };

    const formatSize = (bytes: number | undefined) => {
        if (!bytes) return '';
        const gb = bytes / (1024 * 1024 * 1024);
        if (gb >= 1) return `${gb.toFixed(1)} GB`;
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(0)} MB`;
    };

    const totalSize = REQUIRED_MODELS.reduce((sum, m) => sum + m.size_gb, 0);
    const installedCount = REQUIRED_MODELS.filter(m =>
        installedModels.some(im => im.includes(m.id.split(':')[0]))
    ).length;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-sm font-medium opacity-70">Model Library</h4>
                    <div className="text-xs opacity-40 mt-0.5">
                        {installedCount}/{REQUIRED_MODELS.length} installed
                        {' '}({totalSize.toFixed(1)} GB total)
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    {ollamaStatus === 'running' ? (
                        <span className="text-green-500 flex items-center gap-1"><Server size={12} /> Ollama Connected</span>
                    ) : ollamaStatus === 'checking' ? (
                        <span className="opacity-50 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Checking...</span>
                    ) : (
                        <span className="text-red-500 flex items-center gap-1"><ServerOff size={12} /> Ollama Not Found</span>
                    )}
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 text-xs text-red-500 p-2 rounded-md bg-red-500/10">
                    <AlertCircle size={12} />
                    {error}
                </div>
            )}

            <div className="grid gap-2">
                {REQUIRED_MODELS.map(model => {
                    const isInstalled = installedModels.some(im => im.includes(model.id.split(':')[0]));
                    const isDownloading = downloading === model.id;

                    return (
                        <div key={model.id} className="flex items-center justify-between p-3 rounded-lg border"
                            style={{ backgroundColor: subtleBg, borderColor: border }}>
                            <div className="flex-1 min-w-0 mr-3">
                                <div className="text-sm font-medium font-mono">{model.id}</div>
                                <div className="text-xs opacity-50">{model.roles} &middot; {model.size_gb} GB</div>
                                {isDownloading && progress && (
                                    <div className="mt-2">
                                        <div className="flex items-center justify-between text-xs opacity-60 mb-1">
                                            <span className="capitalize">{progress.status}</span>
                                            <span>
                                                {progress.percent > 0 ? `${progress.percent}%` : ''}
                                                {progress.completed ? ` (${formatSize(progress.completed)} / ${formatSize(progress.total)})` : ''}
                                            </span>
                                        </div>
                                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: border }}>
                                            <div
                                                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                                                style={{ width: `${progress.percent}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {isInstalled ? (
                                <div className="flex items-center gap-1 text-green-500 text-xs font-medium px-2 py-1 rounded bg-green-500/10 shrink-0">
                                    <Check size={12} />
                                    <span>Ready</span>
                                </div>
                            ) : (
                                <button
                                    onClick={() => handleDownload(model.id)}
                                    disabled={isDownloading || ollamaStatus !== 'running'}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all shrink-0
                                        ${isDownloading || ollamaStatus !== 'running'
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                    style={isDownloading || ollamaStatus !== 'running' ? { backgroundColor: subtleBg } : {}}
                                >
                                    {isDownloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                    {isDownloading ? 'Pulling...' : 'Download'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
