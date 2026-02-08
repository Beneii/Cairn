import { RotateCcw, Folder, ChevronDown, ChevronRight, Clock, Calendar } from "lucide-react";
import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import type { KanbanCard } from "../types";
import { PageLayout } from "../PageLayout";
import { PageContent } from "../PageContent";

interface ArchivePageProps {
  nav: ReactNode;
  cards: KanbanCard[];
  onRestore: (id: string) => void;
  darkMode?: boolean;
}

type ViewMode = "recent" | "byProject";

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

export function ArchivePage({ nav, cards, onRestore, darkMode = false }: ArchivePageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("recent");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const border = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(26,29,33,0.1)';
  const cardBg = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.4)';
  const subtleBg = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(26,29,33,0.05)';
  const toggleActiveBg = darkMode ? 'rgba(255,255,255,0.15)' : '#ffffff';

  const archivedCards = useMemo(() => {
    const filtered = cards.filter(c => c.archived);
    // Sort by archivedAt descending (most recent first)
    return filtered.sort((a, b) => {
      const dateA = a.archivedAt ? new Date(a.archivedAt).getTime() : 0;
      const dateB = b.archivedAt ? new Date(b.archivedAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [cards]);

  const displayCards = showAll ? archivedCards : archivedCards.slice(0, 10);

  const grouped = useMemo(() => {
    return archivedCards.reduce((acc, card) => {
      const project = card.project || "Uncategorized";
      if (!acc[project]) acc[project] = [];
      acc[project].push(card);
      return acc;
    }, {} as Record<string, KanbanCard[]>);
  }, [archivedCards]);

  const projectNames = Object.keys(grouped).sort((a, b) => {
    if (a === "Uncategorized") return 1;
    if (b === "Uncategorized") return -1;
    return a.localeCompare(b);
  });

  const toggleProject = (project: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(project)) {
      newExpanded.delete(project);
    } else {
      newExpanded.add(project);
    }
    setExpandedProjects(newExpanded);
  };

  const CardItem = ({ card }: { card: KanbanCard }) => (
    <div
      className="group flex items-center justify-between p-3 rounded-md"
      style={{ border: `1px solid ${border}`, backgroundColor: cardBg }}
    >
      <div className="flex-1">
        <div className="text-sm">{card.title}</div>
        <div className="text-xs opacity-40 mt-0.5 flex items-center gap-2">
          {card.archivedAt && (
            <>
              <Clock size={10} />
              {formatDate(card.archivedAt)}
            </>
          )}
          {card.project && viewMode === "recent" && (
            <>
              <span className="opacity-30">•</span>
              <Folder size={10} />
              {card.project}
            </>
          )}
        </div>
      </div>
      <button
        onClick={() => onRestore(card.id)}
        className="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity p-2 rounded-md"
        style={{ backgroundColor: subtleBg }}
        title="Restore to Kanban"
      >
        <RotateCcw size={14} />
      </button>
    </div>
  );

  return (
    <PageLayout nav={nav} darkMode={darkMode}>
      <PageContent
        title="Archive"
        subtitle={`${archivedCards.length} tasks`}
        darkMode={darkMode}
      >
        {archivedCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 opacity-50">
            <Folder size={48} strokeWidth={1} />
            <p className="mt-4 text-sm">No archived tasks yet</p>
            <p className="text-xs mt-1">Completed tasks will appear here once archived</p>
          </div>
        ) : (
          <>
            {/* View Mode Toggle */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: subtleBg }}>
                <button
                  onClick={() => setViewMode("recent")}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
                  style={viewMode === "recent" ? { backgroundColor: toggleActiveBg, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { opacity: 0.5 }}
                >
                  <Clock size={12} />
                  Recent
                </button>
                <button
                  onClick={() => setViewMode("byProject")}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
                  style={viewMode === "byProject" ? { backgroundColor: toggleActiveBg, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { opacity: 0.5 }}
                >
                  <Folder size={12} />
                  By Project
                </button>
              </div>
            </div>

            {viewMode === "recent" ? (
              /* Recent View - Chronological list */
              <div className="space-y-2">
                {displayCards.map(card => (
                  <CardItem key={card.id} card={card} />
                ))}

                {!showAll && archivedCards.length > 10 && (
                  <button
                    onClick={() => setShowAll(true)}
                    className="w-full py-3 text-xs opacity-50 hover:opacity-100 transition-opacity"
                    style={{ borderTop: `1px solid ${border}` }}
                  >
                    Show all {archivedCards.length} tasks
                  </button>
                )}
              </div>
            ) : (
              /* By Project View - Collapsible sections */
              <div className="space-y-3">
                {projectNames.map(project => {
                  const isExpanded = expandedProjects.has(project);
                  const projectCards = grouped[project];

                  return (
                    <section key={project}>
                      <button
                        onClick={() => toggleProject(project)}
                        className="w-full text-left text-sm uppercase tracking-widest opacity-50 hover:opacity-100 mb-2 pb-2 flex items-center gap-2 transition-opacity"
                        style={{ borderBottom: `1px solid ${border}` }}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <Folder size={14} />
                        {project}
                        <span className="text-xs font-normal">({projectCards.length})</span>
                      </button>

                      {isExpanded && (
                        <div className="space-y-2 ml-6">
                          {projectCards.map(card => (
                            <CardItem key={card.id} card={card} />
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </PageContent>
    </PageLayout>
  );
}
