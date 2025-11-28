import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MakerVisualizer } from './components/MakerVisualizer';
import { VersionControl } from './components/VersionControl';
import { CodeEditor } from './components/CodeEditor';
import { AgentManager } from './components/AgentManager';
import { PlanEditor } from './components/PlanEditor';
import { ToastContainer, ToastMessage } from './components/Toast';
import { MakerEngine } from './services/makerService';
import { MakerConfig, SubTask, EngineState } from './types';
import { MockTauriService } from './services/tauriBridge';
import { VirtualFileSystem } from './services/virtualFileSystem';
import { ProjectService } from './services/projectService';
import { GitService } from './services/gitService';

// Layout Components
import { Sidebar } from './components/layout/Sidebar';
import { TopBar, TabType } from './components/layout/TopBar';
import { SessionTabs } from './components/layout/SessionTabs';
import { ControlBar } from './components/layout/ControlBar';
import { BottomPanel, BottomTab } from './components/layout/BottomPanel';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [engineState, setEngineState] = useState<EngineState>({
    sessions: [],
    activeSessionId: null,
    globalActiveWorkers: 0
  });

  const [activeTab, setActiveTab] = useState<TabType>('visualizer');
  const [bottomTab, setBottomTab] = useState<BottomTab>('terminal');
  const [showSettings, setShowSettings] = useState(false);
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isQuickSaving, setIsQuickSaving] = useState(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [config, setConfig] = useState<MakerConfig>({
    llmProvider: 'gemini',
    geminiApiKey: "",
    openaiBaseUrl: "https://api.openai.com/v1",
    openaiModel: "gpt-4o",
    riskThreshold: 0.6,
    maxAgents: 3,
    autoFixLinter: true,
    useGitWorktrees: false,
    maxParallelism: 1,
    agentProfiles: [
      { id: "1", name: "Atlas", role: "Architect", riskTolerance: 0.3, color: "text-purple-400", model: "gemini-2.0-flash" },
      { id: "2", name: "Bolt", role: "Developer", riskTolerance: 0.7, color: "text-blue-400", model: "gemini-2.0-flash" },
      { id: "3", name: "Cipher", role: "Security", riskTolerance: 0.1, color: "text-red-400", model: "gemini-2.0-flash" },
      { id: "4", name: "Dash", role: "QA", riskTolerance: 0.4, color: "text-green-400", model: "gemini-2.0-flash" }
    ],
    tools: []
  });

  const engineRef = useRef<MakerEngine | null>(null);
  const pendingUpdateRef = useRef<EngineState | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Math.random().toString(36).substring(2);
    setToasts(prev => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    const verifySystem = async () => {
      try {
        const version = await MockTauriService.executeShell('git', ['--version']);
        console.log(`[Health] Git detected: ${version.trim()}`);
        addToast('success', `System Ready: ${version.trim()}`);
      } catch (e: any) {
        addToast('error', `CRITICAL: Git not accessible. ${e.message}`);
      }
    };
    setTimeout(verifySystem, 1000);
  }, []);

  useEffect(() => {
    const checkGit = async () => {
      if (projectPath) {
        const status = await GitService.getInstance().getStatus();
        setIsDirty(status.isDirty);
      }
    };
    const interval = setInterval(checkGit, 5000);
    return () => clearInterval(interval);
  }, [projectPath]);

  useEffect(() => {
    engineRef.current = new MakerEngine();

    const unsubscribe = engineRef.current.subscribe((state) => {
      pendingUpdateRef.current = state;
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(() => {
          if (pendingUpdateRef.current) {
            setEngineState(pendingUpdateRef.current);
          }
          animationFrameRef.current = null;
        });
      }
    });

    return () => {
      unsubscribe();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const handleConfigUpdate = async (newConfig: Partial<MakerConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...newConfig };
      if (engineRef.current) engineRef.current.updateConfig(next);
      if (projectPath) ProjectService.saveConfig(projectPath, next);
      return next;
    });
  };

  const handleQuickSave = async () => {
    setIsQuickSaving(true);
    try {
      await GitService.getInstance().commitAll("WIP: Quick Save before Maker Task");
      addToast('success', 'Changes saved successfully.');
      setIsDirty(false);
    } catch (e: any) {
      addToast('error', `Quick Save Failed: ${e.message}`);
    } finally {
      setIsQuickSaving(false);
    }
  };

  const handleStartMaker = useCallback(async () => {
    if (!prompt.trim() || !engineRef.current) {
      addToast('error', 'Please enter a task description.');
      return;
    }

    const hasKey = config.llmProvider === 'openai' ? !!config.openaiApiKey : !!config.geminiApiKey;
    if (!hasKey) {
      addToast('error', `Missing API Key for ${config.llmProvider.toUpperCase()}. Check Settings.`);
      setShowSettings(true);
      return;
    }

    if (isDirty && !config.useGitWorktrees) {
      addToast('error', 'Repo has uncommitted changes. Enable Worktrees or Commit first.');
      setActiveTab('git');
      return;
    }

    setIsProcessing(true);
    addToast('info', 'Initializing Session...');

    try {
      engineRef.current.updateConfig(config);
      await engineRef.current.startTask(prompt);
      addToast('success', 'Session Started. Review Plan.');
      setPrompt('');
    } catch (error: any) {
      console.error("Task failed:", error);
      addToast('error', `Task initialization failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [prompt, config, isDirty]);

  const handleExecutePlan = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.executePlan();
      addToast('info', 'Execution started.');
    }
  }, []);

  const handlePlanUpdate = (updatedSteps: SubTask[]) => {
    addToast('info', 'Plan editing via UI is temporarily read-only in Multi-Session mode.');
    setShowPlanEditor(false);
  };

  const handleSwitchSession = (id: string) => {
    engineRef.current?.switchSession(id);
  };

  const handleOpenFile = async () => {
    const path = await MockTauriService.openDialog();
    if (path) {
      setProjectPath(path);
      const vfs = VirtualFileSystem.getInstance();
      vfs.setRoot(path);
      addToast('info', `Opened project: ${path}`);
      const savedConfig = await ProjectService.loadConfig(path);
      if (savedConfig) {
        setConfig(savedConfig);
        engineRef.current?.updateConfig(savedConfig);
      } else {
        await ProjectService.ensureMakerDirectory(path);
        await ProjectService.saveConfig(path, config);
      }
    }
  };

  const handleSelectFile = (path: string) => { setActiveFile(path); setActiveTab('editor'); };

  const activeSession = engineState.sessions.find(s => s.taskId === engineState.activeSessionId) || null;
  const isPlanning = activeSession?.isPlanning || false;

  return (
    <div className="flex h-screen w-full bg-gray-950 text-gray-300 font-sans selection:bg-indigo-500/30 relative">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {showPlanEditor && activeSession && (
        <PlanEditor
          steps={activeSession.decomposition}
          onUpdate={handlePlanUpdate}
          onClose={() => setShowPlanEditor(false)}
        />
      )}

      <Sidebar
        projectPath={projectPath}
        onOpenProject={handleOpenFile}
        activeFile={activeFile}
        onSelectFile={handleSelectFile}
        engineState={engineState}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isDirty={isDirty}
          activeWorkers={engineState.globalActiveWorkers}
          riskThreshold={config.riskThreshold}
        />

        <SessionTabs
          engineState={engineState}
          onSwitchSession={handleSwitchSession}
        />

        <div className="flex-1 overflow-hidden relative bg-gray-950 flex flex-col">
          {activeTab === 'visualizer' && <div className="flex-1 relative overflow-hidden"><MakerVisualizer state={activeSession} config={config} /></div>}
          {activeTab === 'git' && <VersionControl addToast={addToast} />}
          {activeTab === 'editor' && <CodeEditor activeFile={activeFile} />}
          {activeTab === 'agents' && <AgentManager activeWorkers={engineState.globalActiveWorkers} maxParallelism={config.maxParallelism} activeTasks={[]} agentProfiles={config.agentProfiles} onConfigUpdate={handleConfigUpdate} />}

          <ControlBar
            prompt={prompt}
            setPrompt={setPrompt}
            isProcessing={isProcessing}
            isPlanning={isPlanning}
            isDirty={isDirty}
            useGitWorktrees={config.useGitWorktrees}
            isQuickSaving={isQuickSaving}
            onQuickSave={handleQuickSave}
            onStart={handleStartMaker}
            onExecute={handleExecutePlan}
            onEditPlan={() => setShowPlanEditor(true)}
            config={config}
            onConfigUpdate={handleConfigUpdate}
            showSettings={showSettings}
            setShowSettings={setShowSettings}
            activeWorkers={engineState.globalActiveWorkers}
          />
        </div>

        <BottomPanel
          activeTab={bottomTab}
          setActiveTab={setBottomTab}
        />
      </div>
    </div>
  );
}