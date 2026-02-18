import { Circle, Settings, Archive, Flag } from "lucide-react";
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
}

export function NavBar({ currentView, setCurrentView, darkMode, editMode, viewMode, onToggleEditMode, onToggleViewMode, onResetLayout }: NavBarProps) {
  const border = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(26,29,33,0.1)';

  const navItems: { view: View; icon: React.ReactNode; title: string; hint: string }[] = [
    { view: 'home', icon: <Circle size={20} strokeWidth={1.5} />, title: 'Home', hint: 'Overview and current system state' },
    { view: 'goals', icon: <Flag size={20} strokeWidth={1.5} />, title: 'Goals', hint: 'Review and manage active goals' },
    { view: 'settings', icon: <Settings size={20} strokeWidth={1.5} />, title: 'Settings', hint: 'Configure dashboard and agent behavior' },
    { view: 'archive', icon: <Archive size={20} strokeWidth={1.5} />, title: 'Archive', hint: 'Browse previous runs and history' },
  ];

  return (
    <nav className="flex items-center gap-4" aria-label="Primary dashboard navigation">
      <ul className="m-0 flex list-none items-center gap-2 p-0">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          return (
            <li key={item.view}>
              <button
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
    </nav>
  );
}

export type { View };
