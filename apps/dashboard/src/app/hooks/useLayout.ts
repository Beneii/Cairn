import { useState, useCallback, useRef, useEffect } from "react";

export type PanelId = "notes" | "logs";
export type ViewMode = "stacked" | "split";

export interface LayoutConfig {
  viewMode: ViewMode;
  vertical: [number, number, number]; // Stacked: Nucleus %, Chat %, Bottom %
  splitVertical: [number, number];    // Split: Top (Nucleus+Chat) %, Bottom %
  splitHorizontal: [number, number];  // Split: Nucleus %, Chat % (within top)
  bottomOrder: PanelId[];
  bottomSizes: [number, number];
}

const DEFAULT_LAYOUT: LayoutConfig = {
  viewMode: "stacked",
  vertical: [40, 30, 30],
  splitVertical: [60, 40],
  splitHorizontal: [40, 60],
  bottomOrder: ["notes", "logs"],
  bottomSizes: [50, 50],
};

const STORAGE_KEY = "cairn_layout";

function loadLayout(): LayoutConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LAYOUT };
    const parsed = JSON.parse(raw);
    // Basic validation
    if (Array.isArray(parsed.vertical) && parsed.vertical.length === 3) {
      // Migrate old 3-panel layouts to 2-panel (remove kanban)
      const merged = { ...DEFAULT_LAYOUT, ...parsed };
      if (Array.isArray(merged.bottomOrder)) {
        merged.bottomOrder = merged.bottomOrder.filter((id: string) => id !== "kanban");
      }
      if (merged.bottomOrder.length !== 2) {
        merged.bottomOrder = DEFAULT_LAYOUT.bottomOrder;
      }
      merged.bottomSizes = [50, 50];
      return merged as LayoutConfig;
    }
  } catch {
    // Corrupt data, use defaults
  }
  return { ...DEFAULT_LAYOUT };
}

function saveLayout(layout: LayoutConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function useLayout() {
  const [layout, setLayout] = useState<LayoutConfig>(loadLayout);
  const [editMode, setEditMode] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Debounced save
  const persistLayout = useCallback((next: LayoutConfig) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveLayout(next), 300);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const setVerticalSizes = useCallback((sizes: number[]) => {
    setLayout((prev) => {
      const next = { ...prev, vertical: sizes as [number, number, number] };
      persistLayout(next);
      return next;
    });
  }, [persistLayout]);

  const setSplitVerticalSizes = useCallback((sizes: number[]) => {
    setLayout((prev) => {
      const next = { ...prev, splitVertical: sizes as [number, number] };
      persistLayout(next);
      return next;
    });
  }, [persistLayout]);

  const setSplitHorizontalSizes = useCallback((sizes: number[]) => {
    setLayout((prev) => {
      const next = { ...prev, splitHorizontal: sizes as [number, number] };
      persistLayout(next);
      return next;
    });
  }, [persistLayout]);

  const toggleViewMode = useCallback(() => {
    setLayout((prev) => {
      const next = { ...prev, viewMode: (prev.viewMode === "stacked" ? "split" : "stacked") as ViewMode };
      persistLayout(next);
      return next;
    });
  }, [persistLayout]);

  const setBottomSizes = useCallback((sizes: number[]) => {
    setLayout((prev) => {
      const next = { ...prev, bottomSizes: sizes as [number, number] };
      persistLayout(next);
      return next;
    });
  }, [persistLayout]);

  const reorderBottom = useCallback((fromIndex: number, toIndex: number) => {
    setLayout((prev) => {
      const order = [...prev.bottomOrder] as PanelId[];
      const sizes = [...prev.bottomSizes] as [number, number];
      // Swap
      [order[fromIndex], order[toIndex]] = [order[toIndex], order[fromIndex]];
      [sizes[fromIndex], sizes[toIndex]] = [sizes[toIndex], sizes[fromIndex]];
      const next = { ...prev, bottomOrder: order, bottomSizes: sizes };
      persistLayout(next);
      return next;
    });
  }, [persistLayout]);

  const resetLayout = useCallback(() => {
    const defaults = { ...DEFAULT_LAYOUT };
    setLayout(defaults);
    saveLayout(defaults);
  }, []);

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => !prev);
  }, []);

  return {
    layout,
    editMode,
    toggleEditMode,
    toggleViewMode,
    setVerticalSizes,
    setSplitVerticalSizes,
    setSplitHorizontalSizes,
    setBottomSizes,
    reorderBottom,
    resetLayout,
  };
}
