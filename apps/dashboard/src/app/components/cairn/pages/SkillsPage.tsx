
import React from "react";
import { Zap, Activity, Clock, Trash2, CheckCircle2, AlertCircle, Play, Sparkles } from "lucide-react";
import { SkillMetric, SkillRequest } from "../types";
import { PageLayout } from "../PageLayout";
import { PageContent } from "../PageContent";
import { useTheme } from "../../../theme";

interface SkillsPageProps {
    nav: React.ReactNode;
    metrics: SkillMetric[];
    requests: SkillRequest[];
    darkMode: boolean;
}

export function SkillsPage({ nav, metrics, requests, darkMode }: SkillsPageProps) {
    const theme = useTheme(darkMode);

    const pendingRequests = requests.filter(r => r.status === "pending" || r.status === "building");
    const promotedRequests = requests.filter(r => r.status === "promoted");
    const failedRequests = requests.filter(r => r.status === "failed");

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "promoted": return <CheckCircle2 size={14} className="text-green-500" />;
            case "building": return <Activity size={14} className="text-blue-500 animate-pulse" />;
            case "failed": return <AlertCircle size={14} className="text-red-500" />;
            default: return <Clock size={14} className="opacity-50" />;
        }
    };

    return (
        <PageLayout nav={nav} darkMode={darkMode}>
            <PageContent
                title="Skills & Growth"
                subtitle="Monitor automated skill performance and manage new capability requests."
                darkMode={darkMode}
            >
                <div className="space-y-8">
                    {/* Metrics Section */}
                    <section>
                        <h2 className="text-sm font-bold uppercase tracking-widest opacity-50 mb-4 flex items-center gap-2">
                            <Activity size={16} /> Performance Metrics
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {metrics.map(metric => {
                                const successRate = metric.usage_count > 0
                                    ? Math.round((metric.success_count / metric.usage_count) * 100)
                                    : 0;

                                return (
                                    <div key={metric.skill_id} className="p-4 rounded-xl border" style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="font-bold uppercase tracking-wider text-xs">{metric.skill_id}</div>
                                            <div className={`text-xs font-bold ${successRate > 80 ? 'text-green-500' : successRate > 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                                                {successRate}% SR
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 text-center mb-3">
                                            <div className="p-2 rounded bg-opacity-10 bg-blue-500">
                                                <div className="text-[10px] opacity-50 uppercase">Uses</div>
                                                <div className="text-sm font-bold">{metric.usage_count}</div>
                                            </div>
                                            <div className="p-2 rounded bg-opacity-10 bg-green-500">
                                                <div className="text-[10px] opacity-50 uppercase">Succeeded</div>
                                                <div className="text-sm font-bold">{metric.success_count}</div>
                                            </div>
                                            <div className="p-2 rounded bg-opacity-10 bg-red-500">
                                                <div className="text-[10px] opacity-50 uppercase">Failed</div>
                                                <div className="text-sm font-bold">{metric.failure_count}</div>
                                            </div>
                                        </div>

                                        <div className="text-[10px] opacity-40 flex items-center gap-1">
                                            <Clock size={10} /> Last used: {metric.last_used || "Never"}
                                        </div>
                                    </div>
                                );
                            })}
                            {metrics.length === 0 && (
                                <div className="col-span-full py-8 text-center opacity-30 border-2 border-dashed rounded-xl" style={{ borderColor: theme.border }}>
                                    No skill metrics recorded yet.
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Skill Requests Section */}
                    <section>
                        <h2 className="text-sm font-bold uppercase tracking-widest opacity-50 mb-4 flex items-center gap-2">
                            <Sparkles size={16} /> Skill Requests
                        </h2>
                        <div className="space-y-3">
                            {[...pendingRequests, ...promotedRequests, ...failedRequests].map(request => (
                                <div key={request.id} className="p-4 rounded-xl border flex items-center justify-between" style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}>
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="p-2 rounded-lg bg-opacity-10 bg-blue-500">
                                            {getStatusIcon(request.status)}
                                        </div>
                                        <div>
                                            <div className="font-medium text-sm">{request.goal}</div>
                                            {request.source_context && (
                                                <div className="text-xs opacity-40 mt-0.5 line-clamp-1">
                                                    Source: {request.source_context}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded ${request.status === 'promoted' ? 'bg-green-500/20 text-green-500' :
                                                request.status === 'building' ? 'bg-blue-500/20 text-blue-500' :
                                                    request.status === 'failed' ? 'bg-red-500/20 text-red-500' :
                                                        'bg-gray-500/20 text-gray-500'
                                            }`}>
                                            {request.status}
                                        </span>
                                        <div className="text-[10px] opacity-40 whitespace-nowrap">
                                            {new Date(request.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {requests.length === 0 && (
                                <div className="py-12 text-center opacity-30 border-2 border-dashed rounded-xl" style={{ borderColor: theme.border }}>
                                    No skill requests found.
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </PageContent>
        </PageLayout>
    );
}
