import { KanbanCard, KanbanStatus } from "./types";
import { clsx } from "clsx";
import { Plus, Archive } from "lucide-react";

interface KanbanProps {
  cards: KanbanCard[];
  className?: string;
  onArchive?: (id: string) => void;
}

const COLUMNS: { id: KanbanStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "active", label: "Active" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
];

export function Kanban({ cards, className, onArchive }: KanbanProps) {
  // Filter out archived cards from main view
  const activeCards = cards.filter(c => !c.archived);

  return (
    <div className={clsx("flex flex-col h-full p-4 border-r border-[#1A1D21]/10", className)}>
      <h3 className="text-xs uppercase tracking-widest font-bold mb-4 opacity-40">Kanban</h3>

      <div className="flex-1 grid grid-cols-4 gap-2 min-w-[400px]">
        {COLUMNS.map((col) => {
          const colCards = activeCards.filter(c => c.status === col.id);

          return (
            <div key={col.id} className="flex flex-col h-full">
              <div className="text-[10px] uppercase font-bold opacity-30 mb-2 flex justify-between">
                <span>{col.label}</span>
                <span>{colCards.length}</span>
              </div>

              <div className="flex-1 min-h-0 space-y-2 overflow-y-auto">
                {colCards.map(card => (
                  <div key={card.id} className="group p-2 border border-[#1A1D21]/10 bg-white/40 text-xs shadow-sm">
                    <div className="flex justify-between items-start gap-1">
                      <span className="flex-1">{card.title}</span>
                      {col.id === 'done' && onArchive && (
                        <button
                          onClick={() => onArchive(card.id)}
                          className="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
                          title="Archive"
                        >
                          <Archive size={12} />
                        </button>
                      )}
                    </div>
                    {card.project && (
                      <div className="mt-1 text-[10px] opacity-50">{card.project}</div>
                    )}
                  </div>
                ))}
                {col.id === 'backlog' && (
                  <button className="w-full py-2 border border-dashed border-[#1A1D21]/20 opacity-30 hover:opacity-100 flex justify-center items-center">
                    <Plus size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
