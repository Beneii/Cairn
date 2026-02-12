import { RotateCcw, Folder, ChevronDown, ChevronRight, Clock, BookOpen, FileText, Search, Activity } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import type { ReactNode } from "react";
import type { KanbanCard } from "../types";
import { PageLayout } from "../PageLayout";
import { PageContent } from "../PageContent";
import { DocumentViewer } from "../DocumentViewer";
import { JobTrace } from "../JobTrace";
import type { Job } from "../types";
import { useTheme } from "../../../theme";

interface ArchivePageProps {
  nav: ReactNode;
  cards: KanbanCard[];
  logs: any[];
  systemDocs: any[];
  lastJobDetails: Job | null;
  onRestore: (id: string) => void;
  onRefreshLogs: () => void;
  onRefreshSystemDocs: () => void;
  onGetJobDetails: (id: string) => void;
  darkMode?: boolean;
}

type Tab = "tasks" | "logs" | "system";
type TaskViewMode = "recent" | "byProject";

function formatDate(isoString?: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ArchivePage({
  nav,
  cards,
  logs,
  systemDocs,
  lastJobDetails,
  onRestore,
  onRefreshLogs,
  onRefreshSystemDocs,
  onGetJobDetails,
  darkMode = false
}: ArchivePageProps) {
  const [activeTab, setActiveTab] = useState<Tab>("tasks");
  const [taskViewMode, setTaskViewMode] = useState<TaskViewMode>("recent");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [selectedDoc, setSelectedDoc] = useState<{ title: string, content: string } | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const theme = useTheme(darkMode);

  useEffect(() => {
    onRefreshLogs();
    onRefreshSystemDocs();
  }, [onRefreshLogs, onRefreshSystemDocs]);

  const archivedCards = useMemo(() => {
    return cards.filter(c => c.archived).sort((a, b) => {
      const dateA = a.archivedAt ? new Date(a.archivedAt).getTime() : 0;
      const dateB = b.archivedAt ? new Date(b.archivedAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [cards]);

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs;
    return logs.filter(l =>
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [logs, searchQuery]);

  const groupedTasks = useMemo(() => {
    return archivedCards.reduce((acc, card) => {
      const project = card.project || "Uncategorized";
      if (!acc[project]) acc[project] = [];
      acc[project].push(card);
      return acc;
    }, {} as Record<string, KanbanCard[]>);
  }, [archivedCards]);

  const renderTabButton = (id: Tab, label: string, icon: ReactNode) => (
    <button
      onClick={() => setActiveTab(id)}
      className="px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2"
      style={activeTab === id ? { backgroundColor: theme.activeBg, color: theme.fg } : { opacity: 0.4 }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <PageLayout nav={nav} darkMode={darkMode}>
      <PageContent
        title="Archive"
        subtitle={
          activeTab === "tasks" ? `${archivedCards.length} tasks` :
            activeTab === "logs" ? `${logs.length} daily logs` :
              `${systemDocs.length} system documents`
        }
        darkMode={darkMode}
      >
        {/* Main Tab Switcher */}
        <div className="flex items-center gap-2 mb-8 p-1 rounded-xl" style={{ backgroundColor: theme.subtleBg }}>
          {renderTabButton("tasks", "Tasks", <Folder size={14} />)}
          {renderTabButton("logs", "Daily Logs", <Clock size={14} />)}
          {renderTabButton("system", "System", <BookOpen size={14} />)}
        </div>

        {activeTab === "tasks" && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setTaskViewMode("recent")}
                className="px-3 py-1 rounded text-[10px] font-bold uppercase tracking-tighter transition-all"
                style={taskViewMode === 'recent' ? { backgroundColor: theme.activeBg, opacity: 1 } : { opacity: 0.4 }}
              >Timeline</button>
              <button
                onClick={() => setTaskViewMode("byProject")}
                className="px-3 py-1 rounded text-[10px] font-bold uppercase tracking-tighter transition-all"
                style={taskViewMode === 'byProject' ? { backgroundColor: theme.activeBg, opacity: 1 } : { opacity: 0.4 }}
              >Projects</button>
            </div>

            {archivedCards.length === 0 ? (
              <div className="py-20 text-center opacity-30 text-xs uppercase tracking-widest">No archived tasks</div>
            ) : taskViewMode === "recent" ? (
              <div className="space-y-2">
                {archivedCards.map(card => (
                  <div key={card.id} className="group flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: theme.border, backgroundColor: theme.cardBg }}>
                    <div
                      className={card.jobId ? "cursor-pointer hover:opacity-100 opacity-80" : ""}
                      onClick={() => {
                        if (card.jobId) {
                          onGetJobDetails(card.jobId);
                          setSelectedJobId(card.jobId);
                        }
                      }}
                    >
                      <div className="text-sm font-medium flex items-center gap-2">
                        {card.title}
                        {card.jobId && <Activity size={10} className="text-blue-500" />}
                      </div>
                      <div className="text-[10px] opacity-40 uppercase tracking-widest mt-1">
                        {card.project || 'General'} • {formatDate(card.archivedAt)}
                      </div>
                    </div>
                    <button onClick={() => onRestore(card.id)} className="p-2 opacity-0 group-hover:opacity-100 rounded-lg transition-all hover:bg-current/10">
                      <RotateCcw size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedTasks).map(([project, projectCards]) => (
                  <div key={project}>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 mb-4 flex items-center gap-2">
                      <div className="h-[1px] flex-1 bg-current opacity-20" />
                      {project}
                      <div className="h-[1px] flex-1 bg-current opacity-20" />
                    </div>
                    <div className="space-y-2">
                      {projectCards.map(card => (
                        <div key={card.id} className="p-4 rounded-xl border flex items-center justify-between" style={{ borderColor: theme.border }}>
                          <div className="text-sm">{card.title}</div>
                          <button onClick={() => onRestore(card.id)} className="p-2 opacity-40 hover:opacity-100"><RotateCcw size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "logs" && (
          <div className="space-y-4">
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={16} />
              <input
                type="text"
                placeholder="Search logs..."
                className="w-full rounded-xl py-3 pl-10 pr-4 text-sm outline-none"
                style={{ backgroundColor: theme.subtleBg, border: `1px solid ${theme.border}`, color: 'inherit' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredLogs.map(log => (
                <button
                  key={log.id}
                  onClick={() => setSelectedDoc(log)}
                  className="p-6 rounded-2xl text-left transition-all group"
                  style={{ border: `1px solid ${theme.border}`, backgroundColor: theme.cardBg }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg transition-colors" style={{ backgroundColor: theme.subtleBg }}>
                      <Clock size={18} className="opacity-60" />
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-30">
                      {formatDate(log.promoted_at)}
                    </div>
                  </div>
                  <h3 className="text-lg font-bold tracking-tight mb-2">{log.title}</h3>
                  <p className="text-sm opacity-40 line-clamp-2 leading-relaxed">{log.content}</p>
                </button>
              ))}
              {filteredLogs.length === 0 && (
                <div className="col-span-full py-20 text-center opacity-30 text-xs uppercase tracking-widest">No logs found</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "system" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {systemDocs.map(doc => (
              <button
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className="p-6 rounded-2xl text-left transition-all group"
                style={{ border: `1px solid ${theme.border}`, backgroundColor: theme.cardBg }}
              >
                <div className="p-2 w-fit rounded-lg mb-4 transition-colors" style={{ backgroundColor: theme.subtleBg }}>
                  <FileText size={20} className="opacity-60" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest mb-1">{doc.title}</h3>
                <div className="text-[10px] opacity-30 uppercase font-bold tracking-tighter">System Blueprint</div>
              </button>
            ))}
          </div>
        )}

        {selectedDoc && (
          <DocumentViewer
            title={selectedDoc.title}
            content={selectedDoc.content}
            onClose={() => setSelectedDoc(null)}
            darkMode={darkMode}
          />
        )}

        {selectedJobId && lastJobDetails && (
          <JobTrace
            job={lastJobDetails}
            onClose={() => setSelectedJobId(null)}
            darkMode={darkMode}
          />
        )}
      </PageContent>
    </PageLayout>
  );
}
