import { Circle, Settings, Archive, Flag, CheckCircle, LayoutDashboard, RotateCcw, Columns2, Rows2, Zap } from "lucide-react";
import type { ViewMode } from "../../hooks/useLayout";

type View = 'home' | 'settings' | 'archive' | 'goals' | 'tasks' | 'skills';

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

  const navItems: { view: View; icon: React.ReactNode; title: string }[] = [
    { view: 'home', icon: <Circle size={20} strokeWidth={1.5} />, title: 'Home' },
    { view: 'tasks', icon: <CheckCircle size={20} strokeWidth={1.5} />, title: 'Tasks' },
    { view: 'goals', icon: <Flag size={20} strokeWidth={1.5} />, title: 'Goals' },
    { view: 'settings', icon: <Settings size={20} strokeWidth={1.5} />, title: 'Settings' },
    { view: 'skills', icon: <Zap size={20} strokeWidth={1.5} />, title: 'Skills' },
    { view: 'archive', icon: <Archive size={20} strokeWidth={1.5} />, title: 'Archive' },
  ];

  return (
    <div className="flex gap-4 items-center">
      {navItems.map((item) => (
        <button
          key={item.view}
          onClick={() => setCurrentView(item.view)}
          title={item.title}
          className={`transition-opacity ${currentView === item.view ? 'opacity-100' : 'opacity-40 hover:opacity-100'
            }`}
        >
          {item.icon}
        </button>
      ))}
      <div className="w-px h-5 mx-1" style={{ backgroundColor: border }} />
    </div>
  );
}

export type { View };
