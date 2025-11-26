
import React, { useState } from 'react';
import { Bot, Cpu, Zap, User, Plus, Trash2, Edit3, Save, X } from 'lucide-react';
import { SubTask, AgentProfile, MakerConfig } from '../types';

interface AgentManagerProps {
    activeWorkers: number;
    maxParallelism: number;
    activeTasks: SubTask[];
    agentProfiles: AgentProfile[];
    onConfigUpdate: (config: Partial<MakerConfig>) => void;
}

export const AgentManager: React.FC<AgentManagerProps> = ({ activeWorkers, maxParallelism, activeTasks, agentProfiles, onConfigUpdate }) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [tempAgent, setTempAgent] = useState<AgentProfile | null>(null);

    const slots = Array.from({ length: maxParallelism }, (_, i) => {
        const activeTask = activeTasks[i];
        return {
            id: i + 1,
            isOccupied: !!activeTask,
            task: activeTask
        };
    });

    const getAgentProfile = (agentId?: string): AgentProfile | undefined => {
        return agentProfiles.find(p => p.id === agentId);
    };

    const handleEdit = (agent: AgentProfile) => {
        setEditingId(agent.id);
        setTempAgent({ ...agent });
    };

    const handleSave = () => {
        if (!tempAgent) return;
        const updatedProfiles = agentProfiles.map(p => p.id === tempAgent.id ? tempAgent : p);
        onConfigUpdate({ agentProfiles: updatedProfiles });
        setEditingId(null);
        setTempAgent(null);
    };

    const handleAddAgent = () => {
        const newAgent: AgentProfile = {
            id: Math.random().toString(36).substring(2, 9),
            name: "New Agent",
            role: "Developer",
            riskTolerance: 0.5,
            color: "text-gray-400",
            model: "gemini-2.0-flash"
        };
        onConfigUpdate({ agentProfiles: [...agentProfiles, newAgent] });
        handleEdit(newAgent);
    };

    const handleDelete = (id: string) => {
        onConfigUpdate({ agentProfiles: agentProfiles.filter(p => p.id !== id) });
    };

    return (
        <div className="space-y-6">

            <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <Cpu size={100} className="text-teal-400" />
                </div>

                <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-500/10 rounded-lg text-teal-400">
                            <ActivityIcon active={activeWorkers > 0} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-100">Runtime Status</h2>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${activeWorkers > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></span>
                                {activeWorkers} / {maxParallelism} Threads Active
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-950 rounded-sm text-xs font-mono text-gray-400 border border-gray-800">
                        <Zap size={14} className={activeWorkers > 0 ? "text-yellow-400" : "text-gray-600"} />
                        <span>System Load: {Math.round((activeWorkers / maxParallelism) * 100)}%</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                    {slots.map(slot => {
                        const profile = slot.isOccupied ? getAgentProfile(slot.task?.assignedAgentId) : undefined;

                        return (
                            <div key={slot.id} className={`relative border rounded-lg p-4 transition-all duration-500 flex flex-col h-44 ${slot.isOccupied
                                ? 'bg-teal-950/20 border-teal-500/30 shadow-[0_0_20px_rgba(20,184,166,0.1)]'
                                : 'bg-gray-950/30 border-gray-800 border-dashed opacity-60 hover:opacity-100'
                                }`}>
                                <div className="flex items-center justify-between mb-3 border-b border-gray-800/50 pb-2">
                                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                                        SLOT {slot.id.toString().padStart(2, '0')}
                                    </span>
                                    {slot.isOccupied ? (
                                        <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-sm font-bold animate-pulse">ACTIVE</span>
                                    ) : (
                                        <span className="text-[9px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-sm">IDLE</span>
                                    )}
                                </div>

                                {slot.isOccupied && profile && slot.task ? (
                                    <div className="flex-1 flex flex-col">
                                        {/* AGENT IDENTITY - Primary Visual */}
                                        <div className="mb-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className={`w-8 h-8 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center font-bold text-sm ${profile.color}`}>
                                                    {profile.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className={`text-sm font-bold ${profile.color}`}>{profile.name}</div>
                                                    <div className="text-[10px] text-gray-400 flex items-center gap-1">
                                                        <span>{profile.role}</span>
                                                        <span className="text-gray-600">•</span>
                                                        <span className="font-mono">{profile.model}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-auto">
                                            <div className="text-[10px] text-gray-500 uppercase mb-1">Processing Task</div>
                                            <div className="text-xs font-medium text-teal-100 line-clamp-1 bg-teal-900/30 px-2 py-1.5 rounded-sm border border-teal-900/50" title={slot.task.description}>
                                                {slot.task.description}
                                            </div>
                                            <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden mt-2">
                                                <div className="h-full bg-teal-500 animate-progress-indeterminate"></div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-2">
                                        <Bot size={24} className="opacity-20" />
                                        <span className="text-xs">Waiting for job assignment...</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 shadow-lg">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                            <User size={18} className="text-indigo-400" />
                            Personnel Roster
                        </h2>
                        <p className="text-xs text-gray-500">Configure the AI agents available for decomposition and voting tasks.</p>
                    </div>
                    <button
                        onClick={handleAddAgent}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-sm text-xs font-medium transition-colors"
                    >
                        <Plus size={14} /> Add Agent
                    </button>
                </div>

                <div className="space-y-3">
                    {agentProfiles.map(agent => (
                        <div key={agent.id} className="bg-gray-950 border border-gray-800 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-start md:items-center hover:border-gray-700 transition-colors">
                            {editingId === agent.id && tempAgent ? (
                                <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-gray-500 uppercase">Name</label>
                                        <input
                                            value={tempAgent.name}
                                            onChange={(e) => setTempAgent({ ...tempAgent, name: e.target.value })}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-sm px-2 py-1.5 text-sm text-white focus:border-indigo-500 outline-hidden"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-gray-500 uppercase">Role</label>
                                        <select
                                            value={tempAgent.role}
                                            onChange={(e) => setTempAgent({ ...tempAgent, role: e.target.value as any })}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-sm px-2 py-1.5 text-sm text-gray-300 outline-hidden"
                                        >
                                            <option value="Architect">Architect</option>
                                            <option value="Developer">Developer</option>
                                            <option value="QA">QA</option>
                                            <option value="Security">Security</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-gray-500 uppercase">Risk Tolerance ({tempAgent.riskTolerance})</label>
                                        <input
                                            type="range" min="0" max="1" step="0.1"
                                            value={tempAgent.riskTolerance}
                                            onChange={(e) => setTempAgent({ ...tempAgent, riskTolerance: parseFloat(e.target.value) })}
                                            className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-2"
                                        />
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <button onClick={handleSave} className="flex-1 bg-green-600 hover:bg-green-500 text-white h-[34px] rounded-sm flex items-center justify-center gap-1 text-xs">
                                            <Save size={14} /> Save
                                        </button>
                                        <button onClick={() => setEditingId(null)} className="px-3 bg-gray-800 hover:bg-gray-700 text-gray-400 h-[34px] rounded-sm">
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className={`w-10 h-10 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center font-bold text-sm ${agent.color}`}>
                                            {agent.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-gray-200">{agent.name}</div>
                                            <div className="text-xs text-gray-500">{agent.role}</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 flex-1 justify-start md:justify-center">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-500 uppercase">Model</span>
                                            <span className="text-xs font-mono text-gray-400">{agent.model}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-500 uppercase">Risk Profile</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${agent.riskTolerance < 0.3 ? 'bg-red-500' :
                                                        agent.riskTolerance > 0.7 ? 'bg-green-500' : 'bg-blue-500'
                                                        }`} style={{ width: `${agent.riskTolerance * 100}%` }}></div>
                                                </div>
                                                <span className="text-xs font-mono text-gray-400">{agent.riskTolerance}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleEdit(agent)} className="p-2 hover:bg-gray-800 rounded-sm text-gray-500 hover:text-indigo-400 transition-colors">
                                            <Edit3 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(agent.id)} className="p-2 hover:bg-red-900/20 rounded-sm text-gray-600 hover:text-red-400 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ActivityIcon = ({ active }: { active: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={active ? "animate-pulse" : ""}>
        <path d="M22 12H18L15 21L9 3L6 12H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
