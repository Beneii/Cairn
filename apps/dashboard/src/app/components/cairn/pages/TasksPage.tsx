
import React, { useState } from "react";
import { Plus, X, ArrowRight, CheckCircle, Circle, Archive, Calendar, RefreshCw, Sparkles } from "lucide-react";
import { Task } from "../types";
import { PageLayout } from "../PageLayout";
import { PageContent } from "../PageContent";
import { useTheme } from "../../../theme";

interface TasksPageProps {
    nav: React.ReactNode;
    tasks: Task[];
    createTask: (title: string, type: "one-off" | "recurring", schedule?: any) => void;
    updateTask: (id: string, changes: Record<string, unknown>) => void;
    deleteTask: (id: string) => void;
    darkMode: boolean;
}

export function TasksPage({ nav, tasks, createTask, updateTask, deleteTask, darkMode }: TasksPageProps) {
    const [isCreating, setIsCreating] = useState(false);
    const [isRecurring, setIsRecurring] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [scheduledDate, setScheduledDate] = useState("");
    const [recurrence, setRecurrence] = useState("daily");
    const theme = useTheme(darkMode);

    const accent = '#10B981'; // Green accent as requested

    // Filter tasks
    const today = new Date().toISOString().split('T')[0];
    const activeTasks = tasks.filter(t => t.status === 'todo');
    const todayStr = new Date().toISOString().split('T')[0];

    // Completed today?
    const completedToday = tasks.filter(t => t.status === 'done' && t.completed_at && t.completed_at.startsWith(todayStr));

    const todayTasks = [
        ...activeTasks.filter(t => t.scheduled_date && t.scheduled_date.startsWith(today)),
        ...completedToday
    ];
    const upcomingTasks = activeTasks.filter(t => t.scheduled_date && t.scheduled_date > today);
    const unscheduledTasks = activeTasks.filter(t => !t.scheduled_date);
    const recurringTasks = activeTasks.filter(t => t.type === 'recurring');

    const handleCreate = () => {
        if (!newTitle.trim()) return;

        const schedule: any = {};
        if (scheduledDate) schedule.on = scheduledDate;
        if (isRecurring) schedule.recurrence = recurrence;

        createTask(newTitle, isRecurring ? "recurring" : "one-off", schedule);

        setNewTitle("");
        setScheduledDate("");
        setIsCreating(false);
    };

    return (
        <PageLayout nav={nav} darkMode={darkMode}>
            <PageContent title="Tasks" darkMode={darkMode}>
                <div className="space-y-8">

                    {/* DO TODAY Section */}
                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-sm font-bold uppercase tracking-widest opacity-50 flex items-center gap-2">
                                Today
                            </h2>
                            {!isCreating && (
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-colors"
                                    style={{ backgroundColor: `${accent}20`, color: accent }}
                                >
                                    <Plus size={14} /> New Task
                                </button>
                            )}
                        </div>

                        {/* Creation Form */}
                        {isCreating && (
                            <div className="mb-6 p-4 rounded-xl border animate-in slide-in-from-top-2 fade-in duration-200" style={{ borderColor: `${accent}30`, backgroundColor: `${accent}05` }}>
                                <div className="flex justify-between mb-2">
                                    <h3 className="font-medium" style={{ color: accent }}>New Task</h3>
                                    <button onClick={() => setIsCreating(false)} className="opacity-50 hover:opacity-100"><X size={16} /></button>
                                </div>
                                <div className="space-y-3">
                                    <input
                                        value={newTitle}
                                        onChange={e => setNewTitle(e.target.value)}
                                        placeholder="What needs doing?"
                                        className="w-full bg-transparent border-b p-1 focus:outline-none transition-colors"
                                        style={{ borderColor: theme.border, '--tw-ring-color': accent } as any}
                                        autoFocus
                                    />

                                    <div className="flex gap-4 items-center text-xs">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} />
                                            Recurring
                                        </label>

                                        {isRecurring && (
                                            <select
                                                value={recurrence}
                                                onChange={e => setRecurrence(e.target.value)}
                                                className="bg-transparent border rounded p-1"
                                                style={{ borderColor: theme.border }}
                                            >
                                                <option value="daily">Daily</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="monthly">Monthly</option>
                                            </select>
                                        )}

                                        <input
                                            type="date"
                                            value={scheduledDate}
                                            onChange={e => setScheduledDate(e.target.value)}
                                            className="bg-transparent border rounded p-1 opacity-50 hover:opacity-100"
                                            style={{ borderColor: theme.border }}
                                        />
                                    </div>

                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setIsCreating(false)} className="text-xs px-3 py-1.5 opacity-60 hover:opacity-100">Cancel</button>
                                        <button
                                            onClick={handleCreate}
                                            disabled={!newTitle}
                                            className="text-xs px-4 py-1.5 text-white rounded hover:opacity-90 disabled:opacity-50"
                                            style={{ backgroundColor: accent }}
                                        >
                                            Add Task
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            {todayTasks.length === 0 && !isCreating && (
                                <div className="text-center py-8 opacity-30 text-sm border-2 border-dashed rounded-xl" style={{ borderColor: theme.border }}>
                                    Nothing scheduled for today.
                                </div>
                            )}
                            {todayTasks.map(task => (
                                <TaskItem
                                    key={task.id}
                                    task={task}
                                    onToggle={() => updateTask(task.id, { status: 'done' })}
                                    onDelete={() => deleteTask(task.id)}
                                    accent={accent}
                                    cardBg={theme.cardBg}
                                    border={theme.border}
                                />
                            ))}
                        </div>
                    </section>

                    {/* Unscheduled / General */}
                    <section>
                        <h2 className="text-sm font-bold uppercase tracking-widest opacity-50 mb-4">Inbox / General</h2>
                        <div className="space-y-2">
                            {unscheduledTasks.map(task => (
                                <TaskItem
                                    key={task.id}
                                    task={task}
                                    onToggle={() => updateTask(task.id, { status: 'done' })}
                                    onDelete={() => deleteTask(task.id)}
                                    accent={accent}
                                    cardBg={theme.cardBg}
                                    border={theme.border}
                                />
                            ))}
                            {unscheduledTasks.length === 0 && (
                                <div className="text-center py-4 opacity-20 text-xs">No pending tasks</div>
                            )}
                        </div>
                    </section>

                    {/* Coming Up */}
                    {upcomingTasks.length > 0 && (
                        <section>
                            <h2 className="text-sm font-bold uppercase tracking-widest opacity-50 mb-4">Coming Up</h2>
                            <div className="space-y-2 opacity-70">
                                {upcomingTasks.map(task => (
                                    <TaskItem
                                        key={task.id}
                                        task={task}
                                        onToggle={() => updateTask(task.id, { status: 'done' })}
                                        onDelete={() => deleteTask(task.id)}
                                        accent={accent}
                                        cardBg={theme.cardBg}
                                        border={theme.border}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </PageContent>
        </PageLayout>
    );
}

function TaskItem({ task, onToggle, onDelete, accent, cardBg, border }: {
    task: Task,
    onToggle: () => void,
    onDelete: () => void,
    accent: string,
    cardBg: string,
    border: string
}) {
    return (
        <div className="group flex items-center justify-between p-3 rounded-lg border transition-all hover:translate-x-1"
            style={{ backgroundColor: cardBg, borderColor: border }}>
            <div className="flex items-center gap-3">
                <button
                    onClick={onToggle}
                    className="w-5 h-5 rounded border flex items-center justify-center hover:bg-opacity-10 transition-colors"
                    style={{ borderColor: accent, color: accent }}
                >
                    {task.status === 'done' && <CheckCircle size={14} />}
                </button>
                <div className="flex flex-col">
                    <span className={task.status === 'done' ? 'line-through opacity-50' : ''}>
                        {task.title}
                    </span>
                    <div className="flex gap-2 text-[10px] opacity-40 uppercase tracking-widest">
                        {task.type === 'recurring' && (
                            <span className="flex items-center gap-0.5"><RefreshCw size={10} /> {task.recurrence_rule}</span>
                        )}
                        {task.suggested_by_agent && (
                            <span className="flex items-center gap-0.5 text-purple-400"><Sparkles size={10} /> Suggested</span>
                        )}
                        {task.scheduled_date && (
                            <span className="flex items-center gap-0.5"><Calendar size={10} /> {task.scheduled_date}</span>
                        )}
                    </div>
                </div>
            </div>
            <button onClick={onDelete} className="opacity-0 group-hover:opacity-20 hover:!opacity-100 transition-opacity">
                <X size={14} />
            </button>
        </div>
    )
}
