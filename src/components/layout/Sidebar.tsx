import React from 'react';
import { Cpu, FolderOpen } from 'lucide-react';
import { FileExplorer } from '../FileExplorer';
import { EngineState } from '../../types';

interface SidebarProps {
    projectPath: string | null;
    onOpenProject: () => void;
    activeFile: string | null;
    onSelectFile: (path: string) => void;
    engineState: EngineState;
}

export const Sidebar: React.FC<SidebarProps> = ({
    projectPath,
    onOpenProject,
    activeFile,
    onSelectFile,
    engineState
}) => {
    return (
        <div className="w-64 border-r border-gray-800 bg-gray-900 flex flex-col">
            <div className="h-12 flex items-center px-4 border-b border-gray-800 font-bold text-indigo-400 gap-2">
                <Cpu size={20} />
                <span>MAKER<span className="text-gray-500">.code</span></span>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                <div className="mb-4">
                    <button
                        onClick={onOpenProject}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-sm transition-colors text-gray-300"
                    >
                        <FolderOpen size={14} />
                        <span className="truncate">{projectPath ? projectPath.split(/[/\\]/).pop() : "Open Project"}</span>
                    </button>
                    {projectPath && <div className="text-[10px] text-gray-600 px-3 mt-1 truncate">{projectPath}</div>}
                </div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">Explorer</div>
                <FileExplorer onSelectFile={onSelectFile} activeFile={activeFile} />
            </div>

            <div className="p-4 border-t border-gray-800 text-xs text-gray-500">
                <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${engineState.globalActiveWorkers > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></div>
                    Status: {engineState.globalActiveWorkers > 0 ? `${engineState.globalActiveWorkers} Agents Active` : 'Idle'}
                </div>
                <div>Mode: Tauri v2 / Strict</div>
            </div>
        </div>
    );
};