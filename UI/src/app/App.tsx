import { useState } from "react";
import { Nucleus, NucleusState } from "./components/cairn/Nucleus";
import { Chat } from "./components/cairn/Chat";
import { Notes } from "./components/cairn/Notes";
import { Kanban } from "./components/cairn/Kanban";
import { Logs } from "./components/cairn/Logs";
import { AgentsPage } from "./components/cairn/pages/AgentsPage";
import { IntegrationsPage } from "./components/cairn/pages/IntegrationsPage";
import { PreferencesPage } from "./components/cairn/pages/PreferencesPage";
import { Box, Network, Sliders } from "lucide-react";
import { useCairn } from "./hooks/useCairn";

type View = 'home' | 'agents' | 'integrations' | 'preferences';

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [currentView, setCurrentView] = useState<View>('home');

  const cairn = useCairn();

  return (
    <div className={`flex flex-col h-screen w-screen bg-[#F3F2EE] text-[#1A1D21] overflow-hidden font-sans transition-all duration-300 ${darkMode ? 'invert' : ''}`}>

      {currentView === 'home' && (
        <>
            <div className="relative flex-none h-[40vh] min-h-[350px] border-b border-[#1A1D21]/10 flex items-center justify-center bg-[#F3F2EE]">

                {/* Top Left: Brand */}
                <div className="absolute top-6 left-6 z-50">
                    <h1 className="text-2xl font-bold tracking-tighter">CAIRN</h1>
                    <div className="text-[10px] opacity-40 uppercase tracking-widest mt-1">
                      {cairn.connected ? "Live Environment" : "Connecting..."}
                    </div>
                </div>

                {/* Top Right: System Menu */}
                <div className="absolute top-6 right-6 z-50 flex gap-4">
                    <button onClick={() => setCurrentView('agents')} title="Agents Graph" className="opacity-40 hover:opacity-100 transition-opacity">
                        <Network size={20} strokeWidth={1.5} />
                    </button>
                    <button onClick={() => setCurrentView('integrations')} title="Integrations" className="opacity-40 hover:opacity-100 transition-opacity">
                        <Box size={20} strokeWidth={1.5} />
                    </button>
                    <button onClick={() => setCurrentView('preferences')} title="Preferences" className="opacity-40 hover:opacity-100 transition-opacity">
                        <Sliders size={20} strokeWidth={1.5} />
                    </button>
                    <div className="w-px h-5 bg-[#1A1D21]/20 mx-1" />
                    <button onClick={() => setDarkMode(!darkMode)} title="Toggle Theme" className="opacity-40 hover:opacity-100 transition-opacity">
                        <div className="w-5 h-5 rounded-full border border-current bg-transparent" />
                    </button>
                </div>

                {/* Center: Nucleus */}
                <Nucleus state={cairn.nucleusState} subAgents={cairn.subAgents} />

                {/* State indicator */}
                <div className="absolute bottom-4 z-50">
                    <span className="text-[10px] uppercase tracking-widest opacity-30">
                      {cairn.nucleusState}
                    </span>
                </div>
            </div>

            {/* Middle Section: Chat */}
            <div className="flex-1 min-h-0 border-b border-[#1A1D21]/10">
                <Chat messages={cairn.messages} onSend={cairn.sendChat} className="h-full" />
            </div>

            {/* Bottom Section: Panels */}
            <div className="flex-none h-[30vh] min-h-[250px] grid grid-cols-3">
                <Notes
                  notes={cairn.notes}
                  onResurface={cairn.resurfaceNote}
                  onCreateNote={cairn.createNote}
                  className="h-full"
                />
                <Kanban cards={cairn.kanbanCards} className="h-full" />
                <Logs logs={cairn.logs} className="h-full" />
            </div>
        </>
      )}

      {currentView === 'agents' && <AgentsPage onBack={() => setCurrentView('home')} />}
      {currentView === 'integrations' && <IntegrationsPage onBack={() => setCurrentView('home')} />}
      {currentView === 'preferences' && <PreferencesPage onBack={() => setCurrentView('home')} darkMode={darkMode} setDarkMode={setDarkMode} />}

    </div>
  );
}
