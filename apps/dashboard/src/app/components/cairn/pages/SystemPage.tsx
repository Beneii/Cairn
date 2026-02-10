import { Wifi, WifiOff, ChevronDown, ChevronRight, Shield, Zap, Cpu } from "lucide-react";
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { getApiBase } from "../../../../config/runtime";
import { PageLayout } from "../PageLayout";
import { PageContent } from "../PageContent";

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
    nodes: Record<string, any>;
    darkMode?: boolean;
}

function StatusDot({ ok }: { ok: boolean }) {
    return (
        <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`} />
    );
}

export function SystemSettings({ connected, diagnostics, nodes, darkMode = false }: SystemSettingsProps) {
    const [healthStatus, setHealthStatus] = useState<"checking" | "ok" | "error">("checking");
    const [healthDetail, setHealthDetail] = useState("");
    const [showNodes, setShowNodes] = useState(false);
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
                        <div className="text-xs opacity-50 mb-1">Gateway</div>
                        <div className="flex items-center gap-2">
                            <StatusDot ok={healthStatus === "ok"} />
                            <span className="text-sm">{healthStatus === "checking" ? "Checking..." : healthStatus === "ok" ? "Healthy" : "Error"}</span>
                        </div>
                    </div>
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
