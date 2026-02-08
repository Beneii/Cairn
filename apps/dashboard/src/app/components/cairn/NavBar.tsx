import { Circle, Settings, Box, Archive, Monitor } from "lucide-react";

type View = 'home' | 'settings' | 'integrations' | 'archive' | 'system';

interface NavBarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
}

export function NavBar({ currentView, setCurrentView, darkMode }: NavBarProps) {
  const border = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(26,29,33,0.1)';

  const navItems: { view: View; icon: React.ReactNode; title: string }[] = [
    { view: 'home', icon: <Circle size={20} strokeWidth={1.5} />, title: 'Home' },
    { view: 'settings', icon: <Settings size={20} strokeWidth={1.5} />, title: 'Settings' },
    { view: 'integrations', icon: <Box size={20} strokeWidth={1.5} />, title: 'Integrations' },
    { view: 'archive', icon: <Archive size={20} strokeWidth={1.5} />, title: 'Archive' },
    { view: 'system', icon: <Monitor size={20} strokeWidth={1.5} />, title: 'System' },
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
