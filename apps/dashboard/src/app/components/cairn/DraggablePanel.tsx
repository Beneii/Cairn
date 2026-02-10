import { useRef } from "react";
import { useDrag, useDrop } from "react-dnd";
import { GripHorizontal } from "lucide-react";
import type { PanelId } from "../../hooks/useLayout";

const PANEL_TYPE = "BOTTOM_PANEL";

const PANEL_LABELS: Record<PanelId, string> = {
  notes: "Notes",
  kanban: "Kanban",
  logs: "Logs",
};

interface DraggablePanelProps {
  panelId: PanelId;
  index: number;
  editMode: boolean;
  darkMode: boolean;
  onReorder: (fromIndex: number, toIndex: number) => void;
  children: React.ReactNode;
}

interface DragItem {
  index: number;
  panelId: PanelId;
}

export function DraggablePanel({
  panelId,
  index,
  editMode,
  darkMode,
  onReorder,
  children,
}: DraggablePanelProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: PANEL_TYPE,
    item: { index, panelId },
    canDrag: editMode,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop<DragItem, void, { isOver: boolean }>({
    accept: PANEL_TYPE,
    hover(item) {
      if (item.index !== index) {
        onReorder(item.index, index);
        item.index = index;
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  dragPreview(drop(ref));

  const border = darkMode ? "rgba(255,255,255,0.1)" : "rgba(26,29,33,0.1)";
  const handleBg = darkMode ? "rgba(255,255,255,0.05)" : "rgba(26,29,33,0.03)";

  return (
    <div
      ref={ref}
      className="flex flex-col h-full min-h-0 relative"
      style={{
        opacity: isDragging ? 0.4 : 1,
        outline: editMode && isOver ? `2px dashed ${darkMode ? "rgba(255,255,255,0.3)" : "rgba(26,29,33,0.2)"}` : "none",
        outlineOffset: "-2px",
      }}
    >
      {editMode && (
        <div
          ref={drag}
          className="flex items-center gap-1.5 px-3 py-1 cursor-grab active:cursor-grabbing select-none shrink-0"
          style={{ backgroundColor: handleBg, borderBottom: `1px solid ${border}` }}
        >
          <GripHorizontal size={12} className="opacity-40" />
          <span className="text-[10px] uppercase tracking-widest opacity-40">
            {PANEL_LABELS[panelId]}
          </span>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
