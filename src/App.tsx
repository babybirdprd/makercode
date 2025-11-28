import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Terminal as TerminalIcon,
  FileCode,
  Layers,
  Cpu,
  ShieldCheck,
  Activity,
  FolderOpen,
  Settings,
  GitGraph,
  Bot,
  CheckCircle,
  Edit2,
  AlertTriangle,
  FileText,
  Save
} from 'lucide-react';
import { MakerVisualizer } from './components/MakerVisualizer';
import { TerminalView } from './components/TerminalView';
import { FileExplorer } from './components/FileExplorer';
import { SettingsPanel } from './components/SettingsPanel';
import { VersionControl } from './components/VersionControl';
import { CodeEditor } from './components/CodeEditor';
import { AgentManager } from './components/AgentManager';
import { PlanEditor } from './components/PlanEditor';
import { ToastContainer, ToastMessage } from './components/Toast';
import { SystemLogs } from './components/SystemLogs';
import { MakerEngine } from './services/makerService';
import { TaskStatus, MakerConfig, AgentStatus, SubTask } from './types';
import { MockTauriService } from './services/tauriBridge';
import { VirtualFileSystem } from './services/virtualFileSystem';
import { ProjectService } from './services/projectService';
import { GitService } from './services/gitService';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [makerState, setMakerState] = useState<TaskStatus | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'visualizer' | 'git' | 'agents'>('visualizer');
  const [bottomTab, setBottomTab] = useState<'terminal' | 'logs'>('terminal');
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

  // FIX: Added refs for throttling logic to prevent UI jank
  const pendingUpdateRef = useRef<TaskStatus | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Math.random().toString(36).substring(2);
    setToasts(prev => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // --- STARTUP HEALTH CHECK ---
  useEffect(() => {
    const verifySystem = async () => {
      try {
        const version = await MockTauriService.executeShell('git', ['--version']);
        console.log(`[Health] Git detected: ${version.trim()}`);
        addToast('success', `System Ready: ${version.trim()}`);
      } catch (e: any) {
        console.error("[Health] Git check failed:", JSON.stringify(e, Object.getOwnPropertyNames(e)));
        const msg = e.message || JSON.stringify(e);
        addToast('error', `CRITICAL: Git not accessible. ${msg}`);
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

  // FIX: Throttled subscription to the MakerEngine
  useEffect(() => {
    engineRef.current = new MakerEngine();

    const unsubscribe = engineRef.current.subscribe((state) => {
      // Store latest state
      pendingUpdateRef.current = state;

      // Only schedule if not already scheduled
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(() => {
          if (pendingUpdateRef.current) {
            setMakerState(pendingUpdateRef.current);

            // Check for new errors
            if (pendingUpdateRef.current.errorCount > (makerState?.errorCount || 0)) {
              addToast('error', 'An error occurred during execution. Check logs.');
            }
          }
          animationFrameRef.current = null;
        });
      }
    });

    return () => {
      unsubscribe();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []); // Empty dependency array intended

  const handleConfigUpdate = async (newConfig: Partial<MakerConfig>) => {
    console.log("[App] Updating Config:", JSON.stringify(newConfig, null, 2));
    setConfig(prev => {
      const next = { ...prev, ...newConfig };
      if (engineRef.current) {
        engineRef.current.updateConfig(next);
      }
      if (projectPath) {
        ProjectService.saveConfig(projectPath, next)
          .catch(err => console.error("Failed to auto-save config", err));
      }
      return next;
    });
  };

  const handleQuickSave = async () => {
    setIsQuickSaving(true);
    try {
      await GitService.getInstance().commitAll("WIP: Quick Save before Maker Task");
      addToast('success', 'Changes saved successfully.');
      setIsDirty(false); // Optimistic update
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

    const hasKey = config.llmProvider === 'openai'
      ? !!config.openaiApiKey
      : !!config.geminiApiKey;

    if (!hasKey) {
      addToast('error', `Missing API Key for ${config.llmProvider.toUpperCase()}. Check Settings.`);
      setShowSettings(true);
      return;
    }

    if (isDirty) {
      addToast('error', 'Repo has uncommitted changes. Please commit or stash first.');
      setActiveTab('git');
      return;
    }

    setIsProcessing(true);
    addToast('info', 'Analyzing task requirements...');

    try {
      engineRef.current.updateConfig(config);
      await engineRef.current.startTask(prompt);
      addToast('success', 'Plan generated. Please review.');
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
      addToast('info', 'Execution started. Agents deployed.');
    }
  }, []);

  const handlePlanUpdate = (updatedSteps: SubTask[]) => {
    if (engineRef.current && makerState) {
      (engineRef.current as any).state.decomposition = updatedSteps;
      (engineRef.current as any).state.totalSteps = updatedSteps.length;
      (engineRef.current as any).notify();
      addToast('success', 'Plan updated successfully.');
    }
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
        addToast('success', 'Loaded project configuration.');
      } else {
        await ProjectService.ensureMakerDirectory(path);
        await ProjectService.saveConfig(path, config);
      }
    }
  };

  const handleSelectFile = (path: string) => {
    setActiveFile(path);
    setActiveTab('editor');
  };

  const isPlanning = makerState?.isPlanning || false;

  return (
    <div className="flex h-screen w-full bg-gray-950 text-gray-300 font-sans selection:bg-indigo-500/30 relative">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {showPlanEditor && makerState && (
        <PlanEditor
          steps={makerState.decomposition}
          onUpdate={handlePlanUpdate}
          onClose={() => setShowPlanEditor(false)}
        />
      )}

      {/* Sidebar */}
      <div className="w-64 border-r border-gray-800 bg-gray-900 flex flex-col">
        <div className="h-12 flex items-center px-4 border-b border-gray-800 font-bold text-indigo-400 gap-2">
          <Cpu size={20} />
          <span>MAKER<span className="text-gray-500">.code</span></span>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="mb-4">
            <button
              onClick={handleOpenFile}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-sm transition-colors text-gray-300"
            >
              <FolderOpen size={14} />
              <span className="truncate">{projectPath ? projectPath.split(/[/\\]/).pop() : "Open Project"}</span>
            </button>
            {projectPath && <div className="text-[10px] text-gray-600 px-3 mt-1 truncate">{projectPath}</div>}
          </div>
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">Explorer</div>
          <FileExplorer onSelectFile={handleSelectFile} activeFile={activeFile} />
        </div>

        <div className="p-4 border-t border-gray-800 text-xs text-gray-500">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${makerState?.activeWorkers ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></div>
            Status: {makerState?.activeWorkers ? 'Agent Active' : 'Idle'}
          </div>
          <div>Mode: Tauri v2 / Strict</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Bar / Navigation */}
        <div className="h-12 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveTab('visualizer')} className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm transition-colors ${activeTab === 'visualizer' ? 'bg-indigo-600/20 text-indigo-300' : 'hover:bg-gray-800'}`}>
              <Activity size={16} /> MAKER Visualizer
            </button>
            <button onClick={() => setActiveTab('git')} className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm transition-colors ${activeTab === 'git' ? 'bg-indigo-600/20 text-indigo-300' : 'hover:bg-gray-800'}`}>
              <GitGraph size={16} /> Version Control
              {isDirty && <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" title="Unsaved Changes"></span>}
            </button>
            <button onClick={() => setActiveTab('editor')} className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm transition-colors ${activeTab === 'editor' ? 'bg-indigo-600/20 text-indigo-300' : 'hover:bg-gray-800'}`}>
              <FileCode size={16} /> Code Editor
            </button>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <ShieldCheck size={14} className="text-green-500" />
              <span>Adaptive Consensus: {config.riskThreshold < 1 ? 'Active' : 'Disabled'}</span>
            </div>
            <div className="h-6 w-px bg-gray-800"></div>
            <button onClick={() => setActiveTab('agents')} className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm transition-colors ${activeTab === 'agents' ? 'bg-teal-600/20 text-teal-300 border border-teal-500/30' : 'hover:bg-gray-800 text-gray-400'}`}>
              <Bot size={16} /> Agent Manager
              {makerState?.activeWorkers ? (
                <span className="bg-teal-500 text-gray-900 text-[10px] font-bold px-1.5 rounded-full">{makerState.activeWorkers}</span>
              ) : null}
            </button>
          </div>
        </div>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-hidden relative bg-gray-950 flex flex-col">
          {activeTab === 'visualizer' && <div className="flex-1 relative overflow-hidden"><MakerVisualizer state={makerState} config={config} /></div>}
          {activeTab === 'git' && <VersionControl addToast={addToast} />}
          {activeTab === 'editor' && <CodeEditor activeFile={activeFile} />}
          {activeTab === 'agents' && <div className="flex-1 p-8 overflow-y-auto"><div className="max-w-4xl mx-auto"><AgentManager activeWorkers={makerState?.activeWorkers || 0} maxParallelism={config.maxParallelism} activeTasks={makerState ? makerState.decomposition.filter(t => t.status === AgentStatus.EXECUTING) : []} agentProfiles={config.agentProfiles} onConfigUpdate={handleConfigUpdate} /></div></div>}

          <div className="border-t border-gray-800 bg-gray-900 p-4 z-20">
            <div className="max-w-4xl mx-auto flex gap-4">
              <div className="flex-1 relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={isDirty ? "Commit changes in 'Version Control' before starting a new task." : "Describe the task. Example: 'Refactor the authentication logic in src/auth.ts to use JWTs and add error handling.'"}
                  disabled={isDirty}
                  className={`w-full bg-gray-950 border rounded-lg p-3 text-sm focus:ring-1 outline-hidden resize-none h-24 font-mono transition-colors ${isDirty ? 'border-yellow-900/50 text-gray-500 cursor-not-allowed' : 'border-gray-700 text-gray-300 focus:border-indigo-500 focus:ring-indigo-500'}`}
                />
                <div className="absolute bottom-3 right-3 text-xs flex items-center gap-2">
                  {isDirty && (
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-500 flex items-center gap-1 font-bold"><AlertTriangle size={12} /> Unsaved Changes</span>
                      <button
                        onClick={handleQuickSave}
                        disabled={isQuickSaving}
                        className="flex items-center gap-1 bg-yellow-600 hover:bg-yellow-500 text-white px-2 py-1 rounded-sm text-[10px] font-bold uppercase transition-colors"
                      >
                        {isQuickSaving ? <Activity size={10} className="animate-spin" /> : <Save size={10} />}
                        Quick Save
                      </button>
                    </div>
                  )}
                  <span className="text-gray-600">MAKER Framework Enabled</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 justify-between relative">
                <div className="relative">
                  <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-sm hover:bg-gray-800 transition-colors ${showSettings ? 'text-indigo-400 bg-gray-800' : 'text-gray-500'}`}>
                    <Settings size={18} />
                  </button>
                  <SettingsPanel config={config} onUpdate={handleConfigUpdate} isOpen={showSettings} onToggle={() => setShowSettings(!showSettings)} />
                </div>

                {isPlanning ? (
                  <div className="flex gap-2">
                    <button onClick={() => setShowPlanEditor(true)} className="h-10 px-4 rounded-lg font-medium text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 transition-all flex items-center gap-2"><Edit2 size={16} /> Edit Plan</button>
                    <button onClick={handleExecutePlan} className="h-10 px-6 rounded-lg font-medium text-sm flex items-center gap-2 transition-all bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20"><CheckCircle size={16} /> Approve</button>
                  </div>
                ) : (
                  <button onClick={handleStartMaker} disabled={isProcessing || makerState?.activeWorkers > 0 || isDirty} className={`h-10 px-6 rounded-lg font-medium text-sm flex items-center gap-2 transition-all ${(isProcessing || makerState?.activeWorkers > 0 || isDirty) ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'}`}>
                    {makerState?.activeWorkers > 0 ? <Activity className="animate-spin" size={16} /> : <Play size={16} />}
                    {makerState?.activeWorkers > 0 ? 'Executing...' : 'Start Task'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Panel */}
        <div className="h-64 border-t border-gray-800 bg-gray-900 flex flex-col">
          <div className="flex items-center h-8 bg-gray-900 border-b border-gray-800 px-2 gap-2">
            <button
              onClick={() => setBottomTab('terminal')}
              className={`flex items-center gap-2 px-3 py-1 text-xs rounded-t-sm transition-colors ${bottomTab === 'terminal' ? 'bg-gray-800 text-gray-200 border-t border-x border-gray-700' : 'text-gray-500 hover:bg-gray-800/50'}`}
            >
              <TerminalIcon size={12} /> Terminal
            </button>
            <button
              onClick={() => setBottomTab('logs')}
              className={`flex items-center gap-2 px-3 py-1 text-xs rounded-t-sm transition-colors ${bottomTab === 'logs' ? 'bg-gray-800 text-gray-200 border-t border-x border-gray-700' : 'text-gray-500 hover:bg-gray-800/50'}`}
            >
              <FileText size={12} /> System Logs
            </button>
          </div>
          <div className="flex-1 p-0 overflow-hidden relative">
            {bottomTab === 'terminal' && <TerminalView />}
            {bottomTab === 'logs' && <SystemLogs />}
          </div>
        </div>
      </div>
    </div>
  );
}