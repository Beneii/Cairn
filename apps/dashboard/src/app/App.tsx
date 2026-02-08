import { useState, useEffect } from "react";
import { Nucleus } from "./components/cairn/Nucleus";
import { Chat } from "./components/cairn/Chat";
import { Notes } from "./components/cairn/Notes";
import { Kanban } from "./components/cairn/Kanban";
import { Logs } from "./components/cairn/Logs";
import { NavBar, type View } from "./components/cairn/NavBar";
import { SettingsPage } from "./components/cairn/pages/SettingsPage";
import { IntegrationsPage } from "./components/cairn/pages/IntegrationsPage";
import { ArchivePage } from "./components/cairn/pages/ArchivePage";
import { SystemPage } from "./components/cairn/pages/SystemPage";
import { useCairn } from "./hooks/useCairn";
import { getApiBase } from "../config/runtime";

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("cairn_theme") === "dark";
  });
  const [currentView, setCurrentView] = useState<View>('home');

  useEffect(() => {
    localStorage.setItem("cairn_theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const cairn = useCairn();

  // Theme colors
  const bg = darkMode ? '#1c1c1c' : '#F3F2EE';
  const fg = darkMode ? '#E5E5E5' : '#1A1D21';
  const border = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(26,29,33,0.1)';

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden font-sans transition-all duration-300"
      style={{ backgroundColor: bg, color: fg }}
    >

      {currentView === 'home' && (
        <>
          <div
            className="relative flex-none h-[40vh] min-h-[350px] flex items-center justify-center"
            style={{ borderBottom: `1px solid ${border}`, backgroundColor: bg }}
          >

            {/* Top Left: Brand */}
            <div className="absolute top-6 left-6 z-50">
              <h1 className="text-2xl font-bold tracking-tighter">CAIRN</h1>
              <div className="text-[10px] opacity-40 uppercase tracking-widest mt-1">
                {cairn.connected ? "Live Environment" : "Connecting..."}
              </div>
            </div>

            {/* Top Right: System Menu */}
            <div className="absolute top-6 right-6 z-50">
              <NavBar currentView={currentView} setCurrentView={setCurrentView} darkMode={darkMode} setDarkMode={setDarkMode} />
            </div>

            {/* Center: Nucleus */}
            <Nucleus state={cairn.nucleusState} subAgents={cairn.subAgents} darkMode={darkMode} />

            {/* State indicator */}
            <div className="absolute bottom-4 z-50">
              <span className="text-[10px] uppercase tracking-widest opacity-30">
                {cairn.nucleusState}
              </span>
            </div>
          </div>

          {/* Middle Section: Chat */}
          <div className="flex-1 min-h-0" style={{ borderBottom: `1px solid ${border}` }}>
            <Chat messages={cairn.messages} onSend={cairn.sendChat} className="h-full" darkMode={darkMode} />
          </div>

          {/* Bottom Section: Panels */}
          <div className="flex-none h-[30vh] min-h-[250px] grid grid-cols-3 overflow-hidden">
            <Notes
              notes={cairn.notes}
              onResurface={cairn.resurfaceNote}
              onCreateNote={cairn.createNote}
              className="h-full min-h-0"
            />
            <Kanban cards={cairn.kanbanCards} className="h-full min-h-0" onArchive={cairn.archiveCard} />
            <Logs logs={cairn.logs} className="h-full min-h-0" />
          </div>
        </>
      )}

      {currentView === 'settings' && (
        <SettingsPage
          nav={<NavBar currentView={currentView} setCurrentView={setCurrentView} darkMode={darkMode} setDarkMode={setDarkMode} />}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          config={cairn.config}
          setHeartbeat={cairn.setHeartbeat}
          setSpendLimit={cairn.setSpendLimit}
          setDecisionLimit={cairn.setDecisionLimit}
          setInteractionLimit={cairn.setInteractionLimit}
        />
      )}
      {currentView === 'integrations' && (
        <IntegrationsPage
          nav={<NavBar currentView={currentView} setCurrentView={setCurrentView} darkMode={darkMode} setDarkMode={setDarkMode} />}
          hasOpenAI={cairn.config.has_openai_key}
          setOpenAIKey={cairn.setOpenAIKey}
          hasTelegram={cairn.config.has_telegram_token}
          setTelegramToken={cairn.setTelegramToken}
          telegramAdminChatId={cairn.config.telegram_admin_chat_id}
          setTelegramAdminChatId={cairn.setTelegramAdminChatId}
          hasGoogle={cairn.config.has_google_calendar}
          gatewayUrl={getApiBase()}
          darkMode={darkMode}
        />
      )}
      {currentView === 'archive' && (
        <ArchivePage
          nav={<NavBar currentView={currentView} setCurrentView={setCurrentView} darkMode={darkMode} setDarkMode={setDarkMode} />}
          cards={cairn.kanbanCards}
          onRestore={cairn.restoreCard}
          darkMode={darkMode}
        />
      )}
      {currentView === 'system' && (
        <SystemPage
          nav={<NavBar currentView={currentView} setCurrentView={setCurrentView} darkMode={darkMode} setDarkMode={setDarkMode} />}
          connected={cairn.connected}
          diagnostics={cairn.diagnostics}
          nodes={cairn.policy.nodes}
          darkMode={darkMode}
        />
      )}

    </div>
  );
}
