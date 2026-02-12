import React from "react";
import { X, Activity, Database, DollarSign, Layers, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";
import type { Job } from "./types";
import { useTheme } from "../../theme";

interface JobTraceProps {
    job: Job;
    onClose: () => void;
    darkMode?: boolean;
}

export function JobTrace({ job, onClose, darkMode = false }: JobTraceProps) {
    const totalCost = job.costs_so_far.reduce((sum: number, c: any) => sum + c.cost_usd, 0);
    const theme = useTheme(darkMode);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-end p-4 md:p-6">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            <div
                className="relative w-full max-w-xl h-full flex flex-col rounded-3xl overflow-hidden shadow-2xl"
                style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}` }}
            >
                {/* Header */}
                <div className="p-8" style={{ borderBottom: `1px solid ${theme.border}`, backgroundColor: theme.subtleBg }}>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${job.status === 'done' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                <Activity size={20} />
                            </div>
                            <h2 className="text-xl font-bold tracking-tight">Execution Trace</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl transition-all opacity-40 hover:opacity-100"
                            style={{ backgroundColor: 'transparent' }}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-2xl" style={{ backgroundColor: theme.subtleBg, border: `1px solid ${theme.border}` }}>
                            <div className="flex items-center gap-2 opacity-30 mb-1">
                                <DollarSign size={10} />
                                <span className="text-[10px] uppercase font-bold tracking-widest">Total Cost</span>
                            </div>
                            <div className="text-lg font-mono font-bold">${totalCost.toFixed(4)}</div>
                        </div>
                        <div className="p-4 rounded-2xl" style={{ backgroundColor: theme.subtleBg, border: `1px solid ${theme.border}` }}>
                            <div className="flex items-center gap-2 opacity-30 mb-1">
                                <Layers size={10} />
                                <span className="text-[10px] uppercase font-bold tracking-widest">Nodes</span>
                            </div>
                            <div className="text-lg font-mono font-bold">{job.nodes_traversed.length}</div>
                        </div>
                        <div className="p-4 rounded-2xl" style={{ backgroundColor: theme.subtleBg, border: `1px solid ${theme.border}` }}>
                            <div className="flex items-center gap-2 opacity-30 mb-1">
                                <Activity size={10} />
                                <span className="text-[10px] uppercase font-bold tracking-widest">Status</span>
                            </div>
                            <div className={`text-sm font-bold uppercase tracking-widest ${job.status === 'done' ? 'text-green-500' : 'text-blue-500'}`}>{job.status}</div>
                        </div>
                    </div>
                </div>

                {/* Trace Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {/* Input Section */}
                    <section>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 mb-4 flex items-center gap-3">
                            Original Intent
                            <div className="h-[1px] flex-1 bg-current opacity-20" />
                        </h3>
                        <div className="p-5 rounded-2xl text-sm leading-relaxed opacity-80" style={{ backgroundColor: theme.subtleBg, border: `1px solid ${theme.border}` }}>
                            {job.input}
                        </div>
                    </section>

                    {/* Timeline Section */}
                    <section>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 mb-6 flex items-center gap-3">
                            Execution Timeline
                            <div className="h-[1px] flex-1 bg-current opacity-20" />
                        </h3>
                        <div className="space-y-6 relative">
                            <div className="absolute left-4 top-2 bottom-2 w-[1px]" style={{ backgroundColor: theme.subtleBg }} />

                            {job.nodes_traversed.map((node: string, i: number) => {
                                const nodeCost = job.costs_so_far.filter((c: any) => c.node === node).reduce((sum: number, c: any) => sum + c.cost_usd, 0);
                                const isLast = i === job.nodes_traversed.length - 1;
                                return (
                                    <div key={i} className="flex gap-6 relative">
                                        <div
                                            className="z-10 w-8 h-8 rounded-full flex items-center justify-center border-2"
                                            style={isLast
                                                ? { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.2)', color: '#3b82f6' }
                                                : { borderColor: theme.border, backgroundColor: theme.bg, opacity: 0.6 }
                                            }
                                        >
                                            {isLast ? <CheckCircle2 size={14} /> : <div className="text-[10px] font-bold">{i + 1}</div>}
                                        </div>
                                        <div className="flex-1 pb-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="text-sm font-bold uppercase tracking-widest">{node}</h4>
                                                {nodeCost > 0 && <span className="text-[10px] font-mono opacity-30">${nodeCost.toFixed(4)}</span>}
                                            </div>
                                            <div className="text-xs opacity-40">Node execution completed successfully</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* Artifacts Section */}
                    {job.artifacts.length > 0 && (
                        <section>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 mb-4 flex items-center gap-3">
                                Artifacts Produced
                                <div className="h-[1px] flex-1 bg-current opacity-20" />
                            </h3>
                            <div className="space-y-3">
                                {job.artifacts.map((art: any) => (
                                    <div
                                        key={art.id}
                                        className="p-4 rounded-xl flex items-center gap-4 group transition-all"
                                        style={{ border: `1px solid ${theme.border}`, backgroundColor: theme.subtleBg }}
                                    >
                                        <div className="p-2 rounded-lg group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-all" style={{ backgroundColor: theme.subtleBg }}>
                                            <Database size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold truncate tracking-tight uppercase">{art.type}</div>
                                            <div className="text-[10px] opacity-30 truncate">Origin: {art.origin_node}</div>
                                        </div>
                                        <ChevronRight size={14} className="opacity-20 group-hover:opacity-100" />
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 flex justify-between items-center" style={{ borderTop: `1px solid ${theme.border}`, backgroundColor: theme.subtleBg }}>
                    <div className="flex items-center gap-2 opacity-30">
                        <span className="text-[10px] font-mono tracking-tighter">{job.id}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-bold text-sm tracking-tight transition-all hover:opacity-90"
                        style={{ backgroundColor: theme.fg, color: theme.bg }}
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
}
