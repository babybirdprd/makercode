import React from 'react';
import { Terminal as TerminalIcon, FileText } from 'lucide-react';
import { TerminalView } from '../TerminalView';
import { SystemLogs } from '../SystemLogs';

export type BottomTab = 'terminal' | 'logs';

interface BottomPanelProps {
    activeTab: BottomTab;
    setActiveTab: (tab: BottomTab) => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({ activeTab, setActiveTab }) => {
    return (
        <div className="h-64 border-t border-gray-800 bg-gray-900 flex flex-col shrink-0">
            <div className="flex items-center h-8 bg-gray-900 border-b border-gray-800 px-2 gap-2">
                <button
                    onClick={() => setActiveTab('terminal')}
                    className={`flex items-center gap-2 px-3 py-1 text-xs rounded-t-sm transition-colors ${activeTab === 'terminal' ? 'bg-gray-800 text-gray-200 border-t border-x border-gray-700' : 'text-gray-500 hover:bg-gray-800/50'}`}
                >
                    <TerminalIcon size={12} /> Terminal
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`flex items-center gap-2 px-3 py-1 text-xs rounded-t-sm transition-colors ${activeTab === 'logs' ? 'bg-gray-800 text-gray-200 border-t border-x border-gray-700' : 'text-gray-500 hover:bg-gray-800/50'}`}
                >
                    <FileText size={12} /> System Logs
                </button>
            </div>
            <div className="flex-1 p-0 overflow-hidden relative">
                {activeTab === 'terminal' && <TerminalView />}
                {activeTab === 'logs' && <SystemLogs />}
            </div>
        </div>
    );
};