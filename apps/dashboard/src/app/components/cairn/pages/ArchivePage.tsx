import { ArrowLeft, RotateCcw, Folder } from "lucide-react";
import type { KanbanCard } from "../types";

interface ArchivePageProps {
  onBack: () => void;
  cards: KanbanCard[];
  onRestore: (id: string) => void;
}

export function ArchivePage({ onBack, cards, onRestore }: ArchivePageProps) {
  // Filter to only archived cards
  const archivedCards = cards.filter(c => c.archived);

  // Group by project
  const grouped = archivedCards.reduce((acc, card) => {
    const project = card.project || "Uncategorized";
    if (!acc[project]) acc[project] = [];
    acc[project].push(card);
    return acc;
  }, {} as Record<string, KanbanCard[]>);

  const projectNames = Object.keys(grouped).sort((a, b) => {
    if (a === "Uncategorized") return 1;
    if (b === "Uncategorized") return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="flex flex-col h-full p-8 bg-[#F3F2EE] text-[#1A1D21] max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 hover:bg-[#1A1D21]/5 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold tracking-tight">Archive</h2>
        <span className="text-sm opacity-50">({archivedCards.length} tasks)</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6">
        {archivedCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 opacity-50">
            <Folder size={48} strokeWidth={1} />
            <p className="mt-4 text-sm">No archived tasks yet</p>
            <p className="text-xs mt-1">Completed tasks will appear here once archived</p>
          </div>
        ) : (
          projectNames.map(project => (
            <section key={project}>
              <h3 className="text-sm uppercase tracking-widest opacity-50 mb-3 border-b border-[#1A1D21]/10 pb-2 flex items-center gap-2">
                <Folder size={14} />
                {project}
                <span className="text-xs">({grouped[project].length})</span>
              </h3>
              <div className="space-y-2">
                {grouped[project].map(card => (
                  <div
                    key={card.id}
                    className="group flex items-center justify-between p-3 border border-[#1A1D21]/10 bg-white/40 rounded-md"
                  >
                    <div className="flex-1">
                      <div className="text-sm">{card.title}</div>
                      <div className="text-xs opacity-40 mt-0.5">
                        {card.status === "done" ? "Completed" : card.status}
                      </div>
                    </div>
                    <button
                      onClick={() => onRestore(card.id)}
                      className="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity p-2 hover:bg-[#1A1D21]/5 rounded-md"
                      title="Restore to Kanban"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
