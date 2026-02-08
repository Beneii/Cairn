import { Shield, Zap, Cpu, Database, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface AgentNode {
    name: string;
    assigned_model: string;
    allowed_callers: string[];
    allowed_tools: string[];
    memory_access: string[];
    max_runtime_seconds: number;
    max_tokens_per_call: number;
}

interface AgentsListProps {
    nodes: Record<string, AgentNode>;
    darkMode?: boolean;
}

export function AgentsList({ nodes, darkMode = false }: AgentsListProps) {
    const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

    const border = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(26,29,33,0.1)';
    const cardBg = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.5)';
    const subtleBg = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(26,29,33,0.05)';
    const tagBg = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(26,29,33,0.08)';

    const getIcon = (name: string) => {
        if (name === "gatekeeper") return <Shield size={20} />;
        if (name === "planner") return <Zap size={20} />;
        return <Cpu size={20} />;
    };

    const getMemoryDot = (tier: string) => {
        const colors: Record<string, string> = {
            hot: "bg-orange-400",
            warm: "bg-blue-400",
            cold: "bg-gray-400",
        };
        return colors[tier] || "bg-gray-400";
    };

    const nodeList = Object.values(nodes);

    return (
        <div className="space-y-3">
            {nodeList.map((agent) => {
                const isExpanded = expandedAgent === agent.name;

                return (
                    <div
                        key={agent.name}
                        className="rounded-lg overflow-hidden transition-all"
                        style={{ border: `1px solid ${border}`, backgroundColor: cardBg }}
                    >
                        {/* Header row */}
                        <button
                            onClick={() => setExpandedAgent(isExpanded ? null : agent.name)}
                            className="w-full flex items-center justify-between p-4 text-left hover:opacity-90 transition-opacity"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2 rounded-lg" style={{ backgroundColor: subtleBg }}>
                                    {getIcon(agent.name)}
                                </div>
                                <div>
                                    <h3 className="font-bold uppercase tracking-wider text-sm">{agent.name}</h3>
                                    <div className="text-xs opacity-40 font-mono">{agent.assigned_model}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                {/* Quick stats */}
                                <div className="flex items-center gap-4 text-xs opacity-60">
                                    <div className="flex items-center gap-1.5">
                                        <Zap size={12} />
                                        <span>{agent.allowed_tools.length} tools</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Database size={12} />
                                        <div className="flex gap-0.5">
                                            {agent.memory_access.map((m) => (
                                                <div key={m} className={`w-2 h-2 rounded-full ${getMemoryDot(m)}`} title={m} />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={12} />
                                        <span>{agent.max_runtime_seconds}s</span>
                                    </div>
                                </div>

                                {isExpanded ? <ChevronUp size={18} className="opacity-40" /> : <ChevronDown size={18} className="opacity-40" />}
                            </div>
                        </button>

                        {/* Expanded details */}
                        {isExpanded && (
                            <div className="px-4 pb-4 pt-2 space-y-4" style={{ borderTop: `1px solid ${border}` }}>
                                {/* Allowed Callers */}
                                <div>
                                    <div className="text-[10px] uppercase tracking-widest opacity-40 mb-2">Allowed Callers</div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {agent.allowed_callers.map((caller) => (
                                            <span key={caller} className="px-2 py-1 rounded text-xs" style={{ backgroundColor: tagBg }}>
                                                {caller}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Allowed Tools */}
                                <div>
                                    <div className="text-[10px] uppercase tracking-widest opacity-40 mb-2">Allowed Tools</div>
                                    {agent.allowed_tools.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {agent.allowed_tools.map((tool) => (
                                                <span key={tool} className="px-2 py-1 rounded text-xs font-mono" style={{ backgroundColor: tagBg }}>
                                                    {tool}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-xs opacity-30 italic">None</span>
                                    )}
                                </div>

                                {/* Memory Access */}
                                <div>
                                    <div className="text-[10px] uppercase tracking-widest opacity-40 mb-2">Memory Access</div>
                                    <div className="flex gap-3">
                                        {agent.memory_access.map((m) => (
                                            <div key={m} className="flex items-center gap-1.5">
                                                <div className={`w-3 h-3 rounded-full ${getMemoryDot(m)}`} />
                                                <span className="text-xs capitalize">{m}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Limits */}
                                <div className="grid grid-cols-2 gap-4 pt-3" style={{ borderTop: `1px solid ${border}` }}>
                                    <div>
                                        <div className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Max Runtime</div>
                                        <div className="text-sm font-medium">{agent.max_runtime_seconds} seconds</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Max Tokens</div>
                                        <div className="text-sm font-medium">{agent.max_tokens_per_call.toLocaleString()}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            {nodeList.length === 0 && (
                <div className="text-center py-12 opacity-40">
                    <Cpu size={32} className="mx-auto mb-3" />
                    <div className="text-sm">No agents configured</div>
                </div>
            )}
        </div>
    );
}
