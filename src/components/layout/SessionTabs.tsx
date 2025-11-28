import React from 'react';
import { EngineState } from '../../types';

interface SessionTabsProps {
    engineState: EngineState;
    onSwitchSession: (id: string) => void;
}

export const SessionTabs: React.FC<SessionTabsProps> = ({ engineState, onSwitchSession }) => {
    return (
        <div className="bg-gray-950 border-b border-gray-800 px-4 flex items-center gap-2 h-10 overflow-x-auto shrink-0">
            {engineState.sessions.map(s => (
                <button
                    key={s.taskId}
                    onClick={() => onSwitchSession(s.taskId)}
                    className={`flex items-center gap-2 px-3 py-1 text-xs rounded-t-sm border-t border-x transition-colors min-w-[120px] max-w-[200px] ${engineState.activeSessionId === s.taskId
                            ? 'bg-gray-900 border-gray-700 text-indigo-300 font-bold'
                            : 'bg-gray-950 border-transparent text-gray-500 hover:bg-gray-900'
                        }`}
                >
                    <span className="truncate flex-1">{s.originalPrompt || "Untitled Task"}</span>
                    {s.activeWorkers > 0 && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>}
                </button>
            ))}
            {engineState.sessions.length === 0 && <span className="text-xs text-gray-600 italic px-2">No active sessions</span>}
        </div>
    );
};