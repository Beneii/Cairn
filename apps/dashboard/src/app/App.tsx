import { useState, useEffect, useCallback } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Nucleus } from "./components/cairn/Nucleus";
import type { LayoutConfig, ViewMode } from "./hooks/useLayout";
import { Chat } from "./components/cairn/Chat";
import { Notes } from "./components/cairn/Notes";
import { Kanban } from "./components/cairn/Kanban";
import { Logs } from "./components/cairn/Logs";
import { NavBar, type View } from "./components/cairn/NavBar";
import { DraggablePanel } from "./components/cairn/DraggablePanel";
import { SettingsPage } from "./components/cairn/pages/SettingsPage";
import { ArchivePage } from "./components/cairn/pages/ArchivePage";
import { GoalsPage } from "./components/cairn/pages/GoalsPage";
import { TasksPage } from "./components/cairn/pages/TasksPage";
import { SkillsPage } from "./components/cairn/pages/SkillsPage";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./components/ui/resizable";
import { useCairn } from "./hooks/useCairn";
import { useLayout, type PanelId } from "./hooks/useLayout";
import { getApiBase, getGatewayUrl } from "../config/runtime";

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("cairn_theme") === "dark";
  });
  const [currentView, setCurrentView] = useState<View>('home');

  useEffect(() => {
    localStorage.setItem("cairn_theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const cairn = useCairn();
  const {
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
  } = useLayout();

  // Theme colors
  const bg = darkMode ? '#1c1c1c' : '#F3F2EE';
  const fg = darkMode ? '#E5E5E5' : '#1A1D21';
  const border = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(26,29,33,0.1)';

  const renderBottomPanel = useCallback((id: PanelId) => {
    switch (id) {
      case "notes":
        return (
          <Notes
            notes={cairn.notes}
            onResurface={cairn.resurfaceNote}
            onCreateNote={cairn.createNote}
            className="h-full min-h-0"
            darkMode={darkMode}
          />
        );
      case "kanban":
        return <Kanban cards={cairn.kanbanCards} className="h-full min-h-0" onArchive={cairn.archiveCard} darkMode={darkMode} />;
      case "logs":
        return <Logs logs={cairn.logs} className="h-full min-h-0" darkMode={darkMode} />;
    }
  }, [cairn.notes, cairn.resurfaceNote, cairn.createNote, cairn.kanbanCards, cairn.archiveCard, cairn.logs, darkMode]);

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden font-sans transition-all duration-300"
      style={{ backgroundColor: bg, color: fg }}
    >

      {currentView === 'home' && (
        <DndProvider backend={HTML5Backend}>
          {layout.viewMode === "stacked" ? (
            /* ---- STACKED LAYOUT: Nucleus / Chat / Bottom ---- */
            <ResizablePanelGroup direction="vertical" onLayout={setVerticalSizes}>
              <ResizablePanel defaultSize={layout.vertical[0]} minSize={20}>
                <NucleusSection
                  cairn={cairn}
                  bg={bg}
                  border={border}
                  darkMode={darkMode}
                  currentView={currentView}
                  setCurrentView={setCurrentView}
                  setDarkMode={setDarkMode}
                  editMode={editMode}
                  viewMode={layout.viewMode}
                  toggleEditMode={toggleEditMode}
                  toggleViewMode={toggleViewMode}
                  resetLayout={resetLayout}
                />
              </ResizablePanel>

              <ResizableHandle disabled={!editMode} withHandle={editMode} className={editMode ? "" : "opacity-0 pointer-events-none"} />

              <ResizablePanel defaultSize={layout.vertical[1]} minSize={15}>
                <div className="h-full" style={{ borderBottom: `1px solid ${border}` }}>
                  <Chat messages={cairn.messages} onSend={cairn.sendChat} className="h-full" darkMode={darkMode} />
                </div>
              </ResizablePanel>

              <ResizableHandle disabled={!editMode} withHandle={editMode} className={editMode ? "" : "opacity-0 pointer-events-none"} />

              <ResizablePanel defaultSize={layout.vertical[2]} minSize={10}>
                <BottomPanels
                  layout={layout}
                  editMode={editMode}
                  darkMode={darkMode}
                  setBottomSizes={setBottomSizes}
                  reorderBottom={reorderBottom}
                  renderPanel={renderBottomPanel}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            /* ---- SPLIT LAYOUT: (Nucleus | Chat) / Bottom ---- */
            <ResizablePanelGroup direction="vertical" onLayout={setSplitVerticalSizes}>
              <ResizablePanel defaultSize={layout.splitVertical[0]} minSize={25}>
                <ResizablePanelGroup direction="horizontal" onLayout={setSplitHorizontalSizes}>
                  <ResizablePanel defaultSize={layout.splitHorizontal[0]} minSize={20}>
                    <NucleusSection
                      cairn={cairn}
                      bg={bg}
                      border={border}
                      darkMode={darkMode}
                      currentView={currentView}
                      setCurrentView={setCurrentView}
                      setDarkMode={setDarkMode}
                      editMode={editMode}
                      viewMode={layout.viewMode}
                      toggleEditMode={toggleEditMode}
                      toggleViewMode={toggleViewMode}
                      resetLayout={resetLayout}
                    />
                  </ResizablePanel>

                  <ResizableHandle disabled={!editMode} withHandle={editMode} className={editMode ? "" : "opacity-0 pointer-events-none"} />

                  <ResizablePanel defaultSize={layout.splitHorizontal[1]} minSize={25}>
                    <div className="h-full" style={{ borderRight: `1px solid ${border}` }}>
                      <Chat messages={cairn.messages} onSend={cairn.sendChat} className="h-full" darkMode={darkMode} />
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>

              <ResizableHandle disabled={!editMode} withHandle={editMode} className={editMode ? "" : "opacity-0 pointer-events-none"} />

              <ResizablePanel defaultSize={layout.splitVertical[1]} minSize={10}>
                <BottomPanels
                  layout={layout}
                  editMode={editMode}
                  darkMode={darkMode}
                  setBottomSizes={setBottomSizes}
                  reorderBottom={reorderBottom}
                  renderPanel={renderBottomPanel}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </DndProvider>
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
          setProactive={cairn.setProactiveConfig}
          setMobileConfig={cairn.setMobileConfig}
          // Integrations
          hasOpenAI={cairn.config.has_openai_key}
          setOpenAIKey={cairn.setOpenAIKey}
          hasTelegram={cairn.config.has_telegram_token}
          setTelegramToken={cairn.setTelegramToken}
          telegramAdminChatId={cairn.config.telegram_admin_chat_id}
          setTelegramAdminChatId={cairn.setTelegramAdminChatId}
          hasGoogle={cairn.config.has_google_calendar}
          gatewayUrl={getGatewayUrl()}
          // System
          connected={cairn.connected}
          diagnostics={cairn.diagnostics}
          nodes={cairn.policy.nodes}
          setLocalMode={cairn.setLocalMode}
          triggerUpdate={cairn.triggerUpdate}
          updateProgress={cairn.updateProgress}
          builderStatus={cairn.builder.status}
          builderProgress={cairn.builder.progress}
          triggerBuilder={cairn.triggerBuilder}
        />
      )}
      {currentView === 'goals' && (
        <GoalsPage
          nav={<NavBar currentView={currentView} setCurrentView={setCurrentView} darkMode={darkMode} setDarkMode={setDarkMode} />}
          darkMode={darkMode}
          goals={cairn.goals}
          createGoal={cairn.createGoal}
          updateGoal={cairn.updateGoal}
          deleteGoal={cairn.deleteGoal}
        />
      )}
      {currentView === 'tasks' && (
        <TasksPage
          nav={<NavBar currentView={currentView} setCurrentView={setCurrentView} darkMode={darkMode} setDarkMode={setDarkMode} />}
          darkMode={darkMode}
          tasks={cairn.tasks}
          createTask={cairn.createTask}
          updateTask={cairn.updateTask}
          deleteTask={cairn.deleteTask}
        />
      )}
      {currentView === 'archive' && (
        <ArchivePage
          nav={<NavBar currentView={currentView} setCurrentView={setCurrentView} darkMode={darkMode} setDarkMode={setDarkMode} />}
          cards={cairn.kanbanCards}
          logs={cairn.archiveLogs}
          systemDocs={cairn.archiveSystemDocs}
          onRestore={cairn.restoreCard}
          onRefreshLogs={cairn.refreshArchiveLogs}
          onRefreshSystemDocs={cairn.refreshSystemDocs}
          lastJobDetails={cairn.lastJobDetails}
          onGetJobDetails={cairn.getJobDetails}
          darkMode={darkMode}
        />
      )}
      {currentView === 'skills' && (
        <SkillsPage
          nav={<NavBar currentView={currentView} setCurrentView={setCurrentView} darkMode={darkMode} setDarkMode={setDarkMode} />}
          metrics={cairn.skillMetrics}
          requests={cairn.skillRequests}
          darkMode={darkMode}
        />
      )}

    </div>
  );
}

/** Nucleus + Brand + NavBar section (reused in both stacked and split layouts) */
function NucleusSection({
  cairn,
  bg,
  border,
  darkMode,
  currentView,
  setCurrentView,
  setDarkMode,
  editMode,
  viewMode,
  toggleEditMode,
  toggleViewMode,
  resetLayout,
}: {
  cairn: ReturnType<typeof useCairn>;
  bg: string;
  border: string;
  darkMode: boolean;
  currentView: View;
  setCurrentView: (v: View) => void;
  setDarkMode: (v: boolean) => void;
  editMode: boolean;
  viewMode: ViewMode;
  toggleEditMode: () => void;
  toggleViewMode: () => void;
  resetLayout: () => void;
}) {
  return (
    <div
      className="relative h-full flex items-center justify-center"
      style={{ borderBottom: `1px solid ${border}`, backgroundColor: bg }}
    >
      <div className="absolute top-6 left-6 z-50">
        <h1 className="text-2xl font-bold tracking-tighter">CAIRN</h1>
        <div className="text-[10px] opacity-40 uppercase tracking-widest mt-1">
          {cairn.connected ? "Live Environment" : "Connecting..."}
        </div>
      </div>

      <div className="absolute top-6 right-6 z-50">
        <NavBar
          currentView={currentView}
          setCurrentView={setCurrentView}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          editMode={editMode}
          viewMode={viewMode}
          onToggleEditMode={toggleEditMode}
          onToggleViewMode={toggleViewMode}
          onResetLayout={resetLayout}
        />
      </div>

      <Nucleus state={cairn.nucleusState} subAgents={cairn.subAgents} darkMode={darkMode} />

      <div className="absolute bottom-4 z-50">
        <span className="text-[10px] uppercase tracking-widest opacity-30">
          {cairn.nucleusState}
        </span>
      </div>
    </div>
  );
}

/** Bottom panels group (reused in both layouts) */
function BottomPanels({
  layout,
  editMode,
  darkMode,
  setBottomSizes,
  reorderBottom,
  renderPanel,
}: {
  layout: LayoutConfig;
  editMode: boolean;
  darkMode: boolean;
  setBottomSizes: (sizes: number[]) => void;
  reorderBottom: (from: number, to: number) => void;
  renderPanel: (id: PanelId) => React.ReactNode;
}) {
  return (
    <ResizablePanelGroup direction="horizontal" onLayout={setBottomSizes}>
      {layout.bottomOrder.map((panelId, i) => (
        <BottomPanelSlot
          key={panelId}
          panelId={panelId}
          index={i}
          defaultSize={layout.bottomSizes[i]}
          editMode={editMode}
          darkMode={darkMode}
          isLast={i === layout.bottomOrder.length - 1}
          onReorder={reorderBottom}
          renderPanel={renderPanel}
        />
      ))}
    </ResizablePanelGroup>
  );
}

/** Single bottom panel slot with its resize handle */
function BottomPanelSlot({
  panelId,
  index,
  defaultSize,
  editMode,
  darkMode,
  isLast,
  onReorder,
  renderPanel,
}: {
  panelId: PanelId;
  index: number;
  defaultSize: number;
  editMode: boolean;
  darkMode: boolean;
  isLast: boolean;
  onReorder: (from: number, to: number) => void;
  renderPanel: (id: PanelId) => React.ReactNode;
}) {
  return (
    <>
      <ResizablePanel defaultSize={defaultSize} minSize={10}>
        <DraggablePanel
          panelId={panelId}
          index={index}
          editMode={editMode}
          darkMode={darkMode}
          onReorder={onReorder}
        >
          {renderPanel(panelId)}
        </DraggablePanel>
      </ResizablePanel>
      {!isLast && (
        <ResizableHandle
          disabled={!editMode}
          withHandle={editMode}
          className={editMode ? "" : "opacity-0 pointer-events-none"}
        />
      )}
    </>
  );
}
