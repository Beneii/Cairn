import { Wifi, WifiOff, ChevronDown, ChevronRight, Shield, Zap, Cpu, RefreshCw, Download } from "lucide-react";
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { getApiBase } from "../../../../config/runtime";
import { PageLayout } from "../PageLayout";
import { PageContent } from "../PageContent";
import { ModelManager } from "../settings/ModelManager";

interface SystemSettingsProps {
    connected: boolean;
    diagnostics: {
        wsUrl: string;
        apiBase: string;
        mode: string;
        lastPong: string | null;
        lastError: string | null;
        reconnectCount: number;
    };
    localModeEnabled: boolean;
    nodes: Record<string, any>;
    darkMode?: boolean;
    setLocalMode: (enabled: boolean) => void;
    triggerUpdate?: () => void;
    updateProgress?: {
        stage: "idle" | "pulling" | "building" | "restarting" | "error";
        message: string;
    } | null;
    builderStatus?: "idle" | "running" | "failed" | "completed";
    builderProgress?: string;
    triggerBuilder?: () => void;
}

function StatusDot({ ok }: { ok: boolean }) {
    return (
        <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`} />
    );
}

export function SystemSettings({ connected, diagnostics, localModeEnabled, nodes, darkMode = false, setLocalMode, triggerUpdate, updateProgress, builderStatus, builderProgress, triggerBuilder }: SystemSettingsProps) {
    const [healthStatus, setHealthStatus] = useState<"checking" | "ok" | "error">("checking");
    const [healthDetail, setHealthDetail] = useState("");
    const [showNodes, setShowNodes] = useState(false);

    const [localMode, setLocalModeState] = useState(localModeEnabled);

    const border = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(26,29,33,0.1)';
    const subtleBg = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(26,29,33,0.05)';

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const res = await fetch(`${getApiBase()}/health`);
                if (res.ok) {
                    const data = await res.json();
                    setHealthStatus("ok");
                    setHealthDetail(JSON.stringify(data));
                } else {
                    setHealthStatus("error");
                    setHealthDetail(`HTTP ${res.status}`);
                }
            } catch (err) {
                setHealthStatus("error");
                setHealthDetail(err instanceof Error ? err.message : "Fetch failed");
            }
        };
        checkHealth();
    }, []);

    // Sync local state when server-confirmed prop changes
    useEffect(() => {
        setLocalModeState(localModeEnabled);
    }, [localModeEnabled]);

    const handleToggleLocalMode = () => {
        const newState = !localMode;
        setLocalModeState(newState); // Optimistic output
        setLocalMode(newState); // Trigger parent action (WS send)
    };

    const getNodeIcon = (name: string) => {
        if (name === "gatekeeper") return <Shield size={16} />;
        if (name === "planner") return <Zap size={16} />;
        return <Cpu size={16} />;
    };

    const nodeList = Object.entries(nodes);

    return (
        <div>
            <div className="flex items-center gap-2 mb-6 opacity-60 text-sm">
                {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
                {connected ? "Connected to Gateway" : "Offline"}
            </div>

            {/* Connection Status */}
            <section className="mb-8">
                <h3 className="text-xs uppercase tracking-widest opacity-50 mb-4 pb-2" style={{ borderBottom: `1px solid ${border}` }}>
                    Connection
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: subtleBg }}>
                        <div className="text-xs opacity-50 mb-1">WebSocket</div>
                        <div className="flex items-center gap-2">
                            <StatusDot ok={connected} />
                            <span className="text-sm">{connected ? "Live" : "Disconnected"}</span>
                        </div>
                    </div>
                    <div className="p-3 rounded-lg" style={{ backgroundColor: subtleBg }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs opacity-50 mb-1">Gateway</div>
                                <div className="flex items-center gap-2">
                                    <StatusDot ok={healthStatus === "ok"} />
                                    <span className="text-sm">{healthStatus === "checking" ? "Checking..." : healthStatus === "ok" ? "Healthy" : "Error"}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Self Update */}
            {triggerUpdate && (
                <section className="mb-8">
                    <h3 className="text-xs uppercase tracking-widest opacity-50 mb-4 pb-2" style={{ borderBottom: `1px solid ${border}` }}>
                        Updates
                    </h3>
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: subtleBg, borderColor: border }}>
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <div className="text-sm font-medium">Pull & Restart</div>
                                <div className="text-xs opacity-60 max-w-md">
                                    Pull latest changes from git, rebuild, and restart the gateway.
                                </div>
                            </div>
                            <button
                                onClick={triggerUpdate}
                                disabled={!!updateProgress && updateProgress.stage !== "error" && updateProgress.stage !== "idle"}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                                style={{
                                    backgroundColor: updateProgress && updateProgress.stage !== "error" && updateProgress.stage !== "idle"
                                        ? (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
                                        : (darkMode ? '#E5E5E5' : '#1A1D21'),
                                    color: updateProgress && updateProgress.stage !== "error" && updateProgress.stage !== "idle"
                                        ? 'inherit'
                                        : (darkMode ? '#1c1c1c' : '#F3F2EE'),
                                    opacity: updateProgress && updateProgress.stage !== "error" && updateProgress.stage !== "idle" ? 0.5 : 1,
                                    cursor: updateProgress && updateProgress.stage !== "error" && updateProgress.stage !== "idle" ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {updateProgress && updateProgress.stage !== "error" && updateProgress.stage !== "idle"
                                    ? <RefreshCw size={14} className="animate-spin" />
                                    : <Download size={14} />
                                }
                                {updateProgress && updateProgress.stage !== "error" && updateProgress.stage !== "idle"
                                    ? "Updating..."
                                    : "Update & Restart"
                                }
                            </button>
                        </div>

                        {updateProgress && (
                            <div className="mt-3 pt-3 border-t" style={{ borderColor: border }}>
                                <div className="flex items-center gap-2 text-xs">
                                    <span
                                        className="inline-block w-2 h-2 rounded-full"
                                        style={{
                                            backgroundColor:
                                                updateProgress.stage === "error" ? "#ef4444" :
                                                    updateProgress.stage === "restarting" ? "#f59e0b" :
                                                        "#22c55e"
                                        }}
                                    />
                                    <span className="uppercase tracking-wider opacity-60">{updateProgress.stage}</span>
                                </div>
                                <div className="text-xs opacity-70 mt-1 font-mono">
                                    {updateProgress.message}
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Branch Builder */}
            {triggerBuilder && (
                <section className="mb-8">
                    <h3 className="text-xs uppercase tracking-widest opacity-50 mb-4 pb-2" style={{ borderBottom: `1px solid ${border}` }}>
                        Local Branch Builder
                    </h3>
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: subtleBg, borderColor: border }}>
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <div className="text-sm font-medium">Nightly Builder</div>
                                <div className="text-xs opacity-60 max-w-md">
                                    Autonomous agent that fixes issues on a new branch.
                                </div>
                            </div>
                            <button
                                onClick={triggerBuilder}
                                disabled={builderStatus === "running"}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                                style={{
                                    backgroundColor: builderStatus === "running"
                                        ? (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
                                        : (darkMode ? '#E5E5E5' : '#1A1D21'),
                                    color: builderStatus === "running"
                                        ? 'inherit'
                                        : (darkMode ? '#1c1c1c' : '#F3F2EE'),
                                    opacity: builderStatus === "running" ? 0.5 : 1,
                                    cursor: builderStatus === "running" ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {builderStatus === "running"
                                    ? <RefreshCw size={14} className="animate-spin" />
                                    : <Zap size={14} />
                                }
                                {builderStatus === "running" ? "Building..." : "Run Now"}
                            </button>
                        </div>

                        {builderStatus && builderStatus !== "idle" && (
                            <div className="mt-3 pt-3 border-t" style={{ borderColor: border }}>
                                <div className="flex items-center gap-2 text-xs">
                                    <span
                                        className="inline-block w-2 h-2 rounded-full"
                                        style={{
                                            backgroundColor:
                                                builderStatus === "failed" ? "#ef4444" :
                                                    builderStatus === "running" ? "#f59e0b" :
                                                        "#22c55e"
                                        }}
                                    />
                                    <span className="uppercase tracking-wider opacity-60">{builderStatus}</span>
                                </div>
                                {builderProgress && (
                                    <div className="text-xs opacity-70 mt-1 font-mono">
                                        {builderProgress}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Local Mode (Ollama) */}
            <section className="mb-8">
                <h3 className="text-xs uppercase tracking-widest opacity-50 mb-4 pb-2" style={{ borderBottom: `1px solid ${border}` }}>
                    AI Intelligence
                </h3>

                <div className="p-4 rounded-lg border mb-4" style={{ backgroundColor: subtleBg, borderColor: border }}>
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <div className="text-sm font-medium">Local Mode (Ollama)</div>
                            <div className="text-xs opacity-60 max-w-md">
                                Run all agents locally using Ollama by default. Requires Ollama running on localhost:11434.
                                Cloud fallback is disabled when active.
                            </div>
                        </div>
                        <button
                            onClick={handleToggleLocalMode}
                            className="w-8 h-5 rounded-full transition-all relative shrink-0"
                            style={{ backgroundColor: localMode ? (darkMode ? '#E5E5E5' : '#1A1D21') : subtleBg }}
                        >
                            <div
                                className="w-4 h-4 rounded-full absolute top-0.5 transition-all"
                                style={{
                                    backgroundColor: localMode ? (darkMode ? '#1c1c1c' : '#F3F2EE') : 'currentColor',
                                    opacity: localMode ? 1 : 0.3,
                                    left: localMode ? '14px' : '2px'
                                }}
                            />
                        </button>
                    </div>

                    {localMode && (
                        <div className="mt-4 pt-4 border-t" style={{ borderColor: border }}>
                            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-3 rounded text-xs mb-4">
                                <strong>Active:</strong> Agents will use their assigned local models (e.g., Gatekeeper → Phi-3.5-mini).
                            </div>
                            <ModelManager darkMode={darkMode} />
                        </div>
                    )}
                </div>
            </section>

            {/* Network Info */}
            <section className="mb-8">
                <h3 className="text-xs uppercase tracking-widest opacity-50 mb-4 pb-2" style={{ borderBottom: `1px solid ${border}` }}>
                    Network
                </h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1">
                        <span className="opacity-50">API Base</span>
                        <span className="font-mono">{diagnostics.apiBase}</span>
                    </div>
                    <div className="flex justify-between py-1">
                        <span className="opacity-50">WebSocket</span>
                        <span className="font-mono">{diagnostics.wsUrl}</span>
                    </div>
                    <div className="flex justify-between py-1">
                        <span className="opacity-50">Mode</span>
                        <span>{diagnostics.mode}</span>
                    </div>
                    <div className="flex justify-between py-1">
                        <span className="opacity-50">Reconnects</span>
                        <span>{diagnostics.reconnectCount}</span>
                    </div>
                    {diagnostics.lastError && (
                        <div className="flex justify-between py-1 text-red-500">
                            <span className="opacity-50">Last Error</span>
                            <span>{diagnostics.lastError}</span>
                        </div>
                    )}
                </div>
            </section>

            {/* Agent Nodes */}
            <section>
                <button
                    onClick={() => setShowNodes(!showNodes)}
                    className="w-full text-xs uppercase tracking-widest opacity-50 mb-4 pb-2 flex items-center gap-2 hover:opacity-100 transition-opacity"
                    style={{ borderBottom: `1px solid ${border}` }}
                >
                    {showNodes ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Agent Nodes ({nodeList.length})
                </button>

                {showNodes && (
                    <div className="space-y-2">
                        {nodeList.map(([name, config]) => (
                            <div key={name} className="p-3 rounded-lg" style={{ backgroundColor: subtleBg }}>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="opacity-50">{getNodeIcon(name)}</span>
                                    <span className="font-medium text-sm uppercase tracking-wide">{name}</span>
                                </div>
                                <div className="text-xs opacity-50 space-y-1">
                                    {config.model && <div>Model: {config.model}</div>}
                                    {config.tools && <div>Tools: {config.tools.join(", ") || "none"}</div>}
                                    {config.can_call && <div>Can call: {config.can_call.join(", ")}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
