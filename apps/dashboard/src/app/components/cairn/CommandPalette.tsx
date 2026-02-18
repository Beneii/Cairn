import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { View } from "./NavBar";

export type CommandAction = {
  id: string;
  label: string;
  description: string;
  keywords?: string;
  perform: () => void;
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  actions: CommandAction[];
  currentView: View;
}

export function CommandPalette({ open, onClose, actions, currentView }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((action) => {
      const haystack = `${action.label} ${action.description} ${action.keywords ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [actions, query]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((prev) => Math.min(prev + 1, Math.max(filtered.length - 1, 0)));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((prev) => Math.max(prev - 1, 0));
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const action = filtered[selected];
        if (!action) return;
        action.perform();
        onClose();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [filtered, onClose, open, selected]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto mt-[10vh] w-[min(680px,92vw)] rounded-xl border border-white/10 bg-[#111]/95 p-3 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <Search size={14} className="opacity-60" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm outline-none"
            placeholder="Jump anywhere or run quick actions..."
          />
          <span className="text-[10px] uppercase tracking-wider opacity-50">{currentView}</span>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-sm opacity-60">No actions found.</div>
          ) : (
            filtered.map((action, index) => {
              const active = index === selected;
              return (
                <button
                  key={action.id}
                  type="button"
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => {
                    action.perform();
                    onClose();
                  }}
                  className={`mb-1 w-full rounded-lg px-3 py-2 text-left transition ${active ? "bg-white/15" : "hover:bg-white/10"}`}
                >
                  <div className="text-sm font-medium">{action.label}</div>
                  <div className="text-xs opacity-65">{action.description}</div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
