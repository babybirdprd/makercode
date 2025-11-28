import React from 'react';
import { Activity, GitGraph, FileCode, Bot, ShieldCheck } from 'lucide-react';

export type TabType = 'visualizer' | 'git' | 'editor' | 'agents';

interface TopBarProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
    isDirty: boolean;
    activeWorkers: number;
    riskThreshold: number;
}

export const TopBar: React.FC<TopBarProps> = ({
    activeTab,
    setActiveTab,
    isDirty,
    activeWorkers,
    riskThreshold
}) => {
    return (
        <div className="h-12 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-4">
                <button onClick={() => setActiveTab('visualizer')} className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm transition-colors ${activeTab === 'visualizer' ? 'bg-indigo-600/20 text-indigo-300' : 'hover:bg-gray-800'}`}>
                    <Activity size={16} /> Visualizer
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
                    <span>Adaptive Consensus: {riskThreshold < 1 ? 'Active' : 'Disabled'}</span>
                </div>
                <div className="h-6 w-px bg-gray-800"></div>
                <button onClick={() => setActiveTab('agents')} className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm transition-colors ${activeTab === 'agents' ? 'bg-teal-600/20 text-teal-300 border border-teal-500/30' : 'hover:bg-gray-800 text-gray-400'}`}>
                    <Bot size={16} /> Agent Manager
                    {activeWorkers > 0 && (
                        <span className="bg-teal-500 text-gray-900 text-[10px] font-bold px-1.5 rounded-full">{activeWorkers}</span>
                    )}
                </button>
            </div>
        </div>
    );
};