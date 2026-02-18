import { Circle, Settings, Archive, Flag } from "lucide-react";
import { useRef } from "react";
import type { ViewMode } from "../../hooks/useLayout";

type View = 'home' | 'settings' | 'archive' | 'goals';

interface NavBarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  editMode?: boolean;
  viewMode?: ViewMode;
  onToggleEditMode?: () => void;
  onToggleViewMode?: () => void;
  onResetLayout?: () => void;
  onOpenCommandPalette?: () => void;
}

export function NavBar({ currentView, setCurrentView, darkMode, editMode, viewMode, onToggleEditMode, onToggleViewMode, onResetLayout, onOpenCommandPalette }: NavBarProps) {
  const border = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(26,29,33,0.1)';
  const navItems: { view: View; icon: React.ReactNode; title: string; hint: string }[] = [
    { view: 'home', icon: <Circle size={20} strokeWidth={1.5} />, title: 'Home', hint: 'Overview and current system state' },
    { view: 'goals', icon: <Flag size={20} strokeWidth={1.5} />, title: 'Goals', hint: 'Review and manage active goals' },
    { view: 'settings', icon: <Settings size={20} strokeWidth={1.5} />, title: 'Settings', hint: 'Configure dashboard and agent behavior' },
    { view: 'archive', icon: <Archive size={20} strokeWidth={1.5} />, title: 'Archive', hint: 'Browse previous runs and history' },
  ];

  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveFocus = (index: number) => {
    buttonRefs.current[index]?.focus();
  };

  const handleNavKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    const currentIndex = navItems.findIndex((item) => item.view === currentView);
    if (currentIndex === -1) return;

    switch (event.key) {
      case 'ArrowRight': {
        event.preventDefault();
        const nextIndex = (currentIndex + 1) % navItems.length;
        setCurrentView(navItems[nextIndex].view);
        moveFocus(nextIndex);
        return;
      }
      case 'ArrowLeft': {
        event.preventDefault();
        const prevIndex = (currentIndex - 1 + navItems.length) % navItems.length;
        setCurrentView(navItems[prevIndex].view);
        moveFocus(prevIndex);
        return;
      }
      case 'Home': {
        event.preventDefault();
        setCurrentView(navItems[0].view);
        moveFocus(0);
        return;
      }
      case 'End': {
        event.preventDefault();
        const last = navItems.length - 1;
        setCurrentView(navItems[last].view);
        moveFocus(last);
        return;
      }
    }
  };

  return (
    <nav className="flex items-center gap-4" aria-label="Primary dashboard navigation">
      <ul className="m-0 flex list-none items-center gap-2 p-0" onKeyDown={handleNavKeyDown}>
        {navItems.map((item, index) => {
          const isActive = currentView === item.view;
          return (
            <li key={item.view}>
              <button
                ref={(el) => {
                  buttonRefs.current[index] = el;
                }}
                onClick={() => setCurrentView(item.view)}
                title={`${item.title} — ${item.hint}`}
                aria-label={`${item.title}. ${item.hint}`}
                aria-current={isActive ? 'page' : undefined}
                className={`group inline-flex min-h-9 min-w-9 items-center justify-center rounded-md px-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  isActive
                    ? 'bg-white/15 text-white shadow-sm dark:bg-white/20'
                    : 'opacity-70 hover:opacity-100 hover:bg-white/10'
                }`}
              >
                {item.icon}
                <span className="ml-2 hidden text-xs font-medium sm:inline">{item.title}</span>
                <span className="sr-only">{item.hint}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mx-1 h-5 w-px" style={{ backgroundColor: border }} aria-hidden="true" />
      {onOpenCommandPalette && (
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs opacity-80 transition hover:opacity-100"
          style={{ borderColor: border }}
          title="Open quick actions (Ctrl+K / Cmd+K)"
          aria-label="Open quick actions"
        >
          <span className="uppercase tracking-wider">Quick Actions</span>
          <kbd className="rounded border px-1 py-0.5 text-[10px]" style={{ borderColor: border }}>⌘K</kbd>
        </button>
      )}
    </nav>
  );
}

export type { View };
