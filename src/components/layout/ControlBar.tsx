import React from 'react';
import { Settings, Edit2, CheckCircle, Loader2, Play, Plus, AlertTriangle, Save, Activity, GitGraph } from 'lucide-react';
import { MakerConfig } from '../../types';
import { SettingsPanel } from '../SettingsPanel';

interface ControlBarProps {
    prompt: string;
    setPrompt: (val: string) => void;
    isProcessing: boolean;
    isPlanning: boolean;
    isDirty: boolean;
    useGitWorktrees: boolean;
    isQuickSaving: boolean;
    onQuickSave: () => void;
    onStart: () => void;
    onExecute: () => void;
    onEditPlan: () => void;

    // Settings
    config: MakerConfig;
    onConfigUpdate: (cfg: Partial<MakerConfig>) => void;
    showSettings: boolean;
    setShowSettings: (val: boolean) => void;

    // Derived state for button text
    activeWorkers: number;
}

export const ControlBar: React.FC<ControlBarProps> = ({
    prompt, setPrompt, isProcessing, isPlanning, isDirty, useGitWorktrees, isQuickSaving,
    onQuickSave, onStart, onExecute, onEditPlan,
    config, onConfigUpdate, showSettings, setShowSettings,
    activeWorkers
}) => {
    return (
        <div className="border-t border-gray-800 bg-gray-900 p-4 z-20 shrink-0">
            <div className="max-w-4xl mx-auto flex gap-4">
                <div className="flex-1 relative">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={isDirty && !useGitWorktrees ? "Commit changes before starting." : "Describe task. 'Start Task' creates a new session."}
                        disabled={isDirty && !useGitWorktrees}
                        className={`w-full bg-gray-950 border rounded-lg p-3 text-sm focus:ring-1 outline-hidden resize-none h-24 font-mono transition-colors ${isDirty && !useGitWorktrees ? 'border-yellow-900/50 text-gray-500 cursor-not-allowed' : 'border-gray-700 text-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                            }`}
                    />
                    <div className="absolute bottom-3 right-3 text-xs flex items-center gap-2">
                        {isDirty && (
                            <div className="flex items-center gap-2">
                                <span className="text-yellow-500 flex items-center gap-1 font-bold"><AlertTriangle size={12} /> Unsaved Changes</span>
                                <button
                                    onClick={onQuickSave}
                                    disabled={isQuickSaving}
                                    className="flex items-center gap-1 bg-yellow-600 hover:bg-yellow-500 text-white px-2 py-1 rounded-sm text-[10px] font-bold uppercase transition-colors"
                                >
                                    {isQuickSaving ? <Activity size={10} className="animate-spin" /> : <Save size={10} />}
                                    Quick Save
                                </button>
                            </div>
                        )}
                        {useGitWorktrees && <span className="text-green-500 flex items-center gap-1"><GitGraph size={10} /> Worktrees Enabled</span>}
                    </div>
                </div>

                <div className="flex flex-col gap-2 justify-between relative">
                    <div className="relative">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-2 rounded-sm hover:bg-gray-800 transition-colors ${showSettings ? 'text-indigo-400 bg-gray-800' : 'text-gray-500'}`}
                        >
                            <Settings size={18} />
                        </button>
                        <SettingsPanel config={config} onUpdate={onConfigUpdate} isOpen={showSettings} onToggle={() => setShowSettings(!showSettings)} />
                    </div>

                    {isPlanning ? (
                        <div className="flex gap-2">
                            <button onClick={onEditPlan} className="h-10 px-4 rounded-lg font-medium text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 transition-all flex items-center gap-2">
                                <Edit2 size={16} /> Edit
                            </button>
                            <button onClick={onExecute} className="h-10 px-6 rounded-lg font-medium text-sm flex items-center gap-2 transition-all bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20">
                                <CheckCircle size={16} /> Approve
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={onStart}
                            disabled={isProcessing || (isDirty && !useGitWorktrees)}
                            className={`h-10 px-6 rounded-lg font-medium text-sm flex items-center gap-2 transition-all ${(isProcessing || (isDirty && !useGitWorktrees)) ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'}`}
                        >
                            {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                            {isProcessing ? 'Initializing...' : 'New Session'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};