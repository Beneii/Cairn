
import React, { useState } from "react";
import { Plus, X, ArrowRight, Flag, Calendar, Activity, CheckCircle, Circle, Archive } from "lucide-react";
import { Goal } from "../types";
import { PageLayout } from "../PageLayout";
import { PageContent } from "../PageContent";

interface GoalsPageProps {
    nav: React.ReactNode;
    goals: Goal[];
    createGoal: (title: string, success_definition: string) => void;
    updateGoal: (id: string, changes: Record<string, unknown>) => void;
    deleteGoal: (id: string) => void;
    darkMode: boolean;
}

export function GoalsPage({ nav, goals, createGoal, updateGoal, deleteGoal, darkMode }: GoalsPageProps) {
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newDef, setNewDef] = useState("");
    const [error, setError] = useState<string | null>(null);

    const activeGoals = goals.filter(g => g.status === "active");
    const otherGoals = goals.filter(g => g.status !== "active");
    const canCreate = activeGoals.length < 3;

    const cardBg = darkMode ? '#2A2A2A' : '#FFFFFF';
    const border = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

    const handleCreate = () => {
        if (!newTitle.trim() || !newDef.trim()) return;
        if (activeGoals.length >= 3) {
            setError("Maximum 3 active goals allowed. Please pause or complete one first.");
            return;
        }
        createGoal(newTitle, newDef);
        setNewTitle("");
        setNewDef("");
        setIsCreating(false);
        setError(null);
    };

    return (
        <PageLayout nav={nav} darkMode={darkMode}>
            <PageContent
                title="Active Goals"
                subtitle="Long-term objectives that guide Cairn's decision making. Limited to 3 active goals to ensure focus."
                darkMode={darkMode}
            >
                <div className="space-y-8">
                    {/* Active Goals Section */}
                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-sm font-bold uppercase tracking-widest opacity-50 flex items-center gap-2">
                                Active ({activeGoals.length}/3)
                            </h2>
                            {canCreate && !isCreating && (
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors"
                                >
                                    <Plus size={14} /> New Goal
                                </button>
                            )}
                        </div>

                        {/* Creation Form */}
                        {isCreating && (
                            <div className="mb-6 p-4 rounded-xl border border-green-500/30 bg-green-500/5 animate-in slide-in-from-top-2 fade-in duration-200">
                                <div className="flex justify-between mb-2">
                                    <h3 className="font-medium text-green-500">New Goal</h3>
                                    <button onClick={() => setIsCreating(false)} className="opacity-50 hover:opacity-100"><X size={16} /></button>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs opacity-50 uppercase tracking-widest block mb-1">Title</label>
                                        <input
                                            value={newTitle}
                                            onChange={e => setNewTitle(e.target.value)}
                                            placeholder="e.g., Launch MVP"
                                            className="w-full bg-transparent border-b p-1 focus:outline-none focus:border-green-500 transition-colors"
                                            style={{ borderColor: border }}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs opacity-50 uppercase tracking-widest block mb-1">Success Definition</label>
                                        <textarea
                                            value={newDef}
                                            onChange={e => setNewDef(e.target.value)}
                                            placeholder="What does success look like?"
                                            className="w-full bg-transparent border p-2 rounded text-sm focus:outline-none focus:border-green-500 transition-colors"
                                            style={{ borderColor: border }}
                                            rows={3}
                                        />
                                    </div>
                                    {error && <div className="text-red-500 text-xs">{error}</div>}
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setIsCreating(false)} className="text-xs px-3 py-1.5 opacity-60 hover:opacity-100">Cancel</button>
                                        <button
                                            onClick={handleCreate}
                                            disabled={!newTitle || !newDef}
                                            className="text-xs px-4 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                                        >
                                            Create Active Goal
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {activeGoals.map(goal => (
                                <div key={goal.id} className="p-5 rounded-xl border relative group" style={{ backgroundColor: cardBg, borderColor: border }}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-bold text-lg">{goal.title}</div>
                                        <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest ${goal.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-500'
                                            }`}>
                                            {goal.status}
                                        </div>
                                    </div>

                                    <p className="text-sm opacity-70 mb-4 h-20 overflow-y-auto custom-scrollbar">
                                        {goal.success_definition}
                                    </p>

                                    <div className="flex items-center gap-4 text-xs opacity-50 mb-4">
                                        <div className="flex items-center gap-1" title="Time Horizon">
                                            <Calendar size={12} /> {goal.time_horizon}
                                        </div>
                                        <div className="flex items-center gap-1" title="Priority">
                                            <Flag size={12} /> {goal.priority}
                                        </div>
                                        <div className="flex items-center gap-1" title="Updates">
                                            <Activity size={12} /> {goal.timeline?.length || 0}
                                        </div>
                                    </div>

                                    {/* Timeline Preview */}
                                    {goal.timeline && goal.timeline.length > 0 && (
                                        <div className="mb-4 pl-3 border-l-2 border-dashed opacity-70" style={{ borderColor: border }}>
                                            {goal.timeline.slice(-2).map(event => (
                                                <div key={event.id} className="text-[10px] mb-1">
                                                    <span className="opacity-50">{event.timestamp}</span> <span className="font-medium">{event.message}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="pt-3 border-t flex justify-between items-center" style={{ borderColor: border }}>
                                        <div className="text-[10px] opacity-40">
                                            Created {new Date(goal.created_at).toLocaleDateString()}
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => updateGoal(goal.id, { status: 'paused' })}
                                                title="Pause Goal"
                                                className="p-1 hover:bg-white/10 rounded"
                                            >
                                                <Circle size={14} />
                                            </button>
                                            <button
                                                onClick={() => deleteGoal(goal.id)}
                                                title="Delete Goal"
                                                className="p-1 hover:bg-red-500/10 text-red-500 rounded"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {activeGoals.length === 0 && !isCreating && (
                                <div className="col-span-full py-12 text-center opacity-30 border-2 border-dashed rounded-xl" style={{ borderColor: border }}>
                                    No active goals. Create one to guide Cairn.
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Other Goals (Paused/Completed) */}
                    {otherGoals.length > 0 && (
                        <section>
                            <h2 className="text-sm font-bold uppercase tracking-widest opacity-50 mb-4 flex items-center gap-2">
                                <Archive size={14} /> Archive / Paused
                            </h2>
                            <div className="space-y-2">
                                {otherGoals.map(goal => (
                                    <div key={goal.id} className="p-3 rounded-lg border flex items-center justify-between" style={{ backgroundColor: cardBg, borderColor: border }}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${goal.status === 'completed' ? 'bg-green-500' :
                                                goal.status === 'paused' ? 'bg-yellow-500' :
                                                    'bg-red-500'
                                                }`} />
                                            <span className="font-medium text-sm">{goal.title}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs opacity-50 uppercase">{goal.status}</span>
                                            {goal.status === 'paused' && activeGoals.length < 3 && (
                                                <button
                                                    onClick={() => updateGoal(goal.id, { status: 'active' })}
                                                    className="text-xs hover:underline text-green-500"
                                                >
                                                    Activate
                                                </button>
                                            )}
                                            <button
                                                onClick={() => deleteGoal(goal.id)}
                                                className="opacity-20 hover:opacity-100"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </PageContent>
        </PageLayout>
    );
}
