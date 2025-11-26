import React, { useState } from 'react';
import { Settings, GitBranch, Wand2, Key, Eye, EyeOff, Server, Globe, User, Plus, Trash2, Save, Wrench, Play, Zap } from 'lucide-react';
import { MakerConfig, AgentProfile, ToolDefinition } from '../types';

interface SettingsPanelProps {
    config: MakerConfig;
    onUpdate: (config: Partial<MakerConfig>) => void;
    isOpen: boolean;
    onToggle: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onUpdate, isOpen, onToggle }) => {
    const [showKey, setShowKey] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'agents' | 'tools'>('general');

    const [editingAgent, setEditingAgent] = useState<AgentProfile | null>(null);
    const [editingTool, setEditingTool] = useState<ToolDefinition | null>(null);

    if (!isOpen) return null;

    // --- AGENT HANDLERS ---
    const handleAddAgent = () => {
        const newAgent: AgentProfile = {
            id: Math.random().toString(36).substr(2, 9),
            name: "New Agent",
            role: "Developer",
            riskTolerance: 0.5,
            color: "text-gray-400",
            model: config.llmProvider === 'openai' ? config.openaiModel || "gpt-4o" : "gemini-2.0-flash"
        };
        onUpdate({ agentProfiles: [...config.agentProfiles, newAgent] });
        setEditingAgent(newAgent);
    };

    const handleUpdateAgent = (agent: AgentProfile) => {
        const updated = config.agentProfiles.map(p => p.id === agent.id ? agent : p);
        onUpdate({ agentProfiles: updated });
    };

    const handleDeleteAgent = (id: string) => {
        if (config.agentProfiles.length <= 1) return;
        onUpdate({ agentProfiles: config.agentProfiles.filter(p => p.id !== id) });
        if (editingAgent?.id === id) setEditingAgent(null);
    };

    // --- TOOL HANDLERS ---
    const handleAddTool = () => {
        const newTool: ToolDefinition = {
            id: Math.random().toString(36).substr(2, 9),
            name: "New_Tool",
            description: "Description of what this tool does",
            command: "echo {{message}}",
            requiresApproval: true
        };
        const currentTools = config.tools || [];
        onUpdate({ tools: [...currentTools, newTool] });
        setEditingTool(newTool);
    };

    const handleUpdateTool = (tool: ToolDefinition) => {
        const currentTools = config.tools || [];
        const updated = currentTools.map(t => t.id === tool.id ? tool : t);
        onUpdate({ tools: updated });
    };

    const handleDeleteTool = (id: string) => {
        const currentTools = config.tools || [];
        onUpdate({ tools: currentTools.filter(t => t.id !== id) });
        if (editingTool?.id === id) setEditingTool(null);
    };

    return (
        <div className="absolute bottom-full right-0 mb-2 w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden flex flex-col z-50 max-h-[600px]">

            {/* Header Tabs */}
            <div className="flex items-center border-b border-gray-800 bg-gray-950">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 ${activeTab === 'general' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <Settings size={14} /> Engine
                </button>
                <button
                    onClick={() => setActiveTab('agents')}
                    className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 ${activeTab === 'agents' ? 'text-teal-400 border-b-2 border-teal-500' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <User size={14} /> Agents
                </button>
                <button
                    onClick={() => setActiveTab('tools')}
                    className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 ${activeTab === 'tools' ? 'text-orange-400 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <Wrench size={14} /> Tools
                </button>
            </div>

            <div className="p-4 overflow-y-auto">

                {/* --- GENERAL SETTINGS --- */}
                {activeTab === 'general' && (
                    <div className="space-y-5">
                        {/* Provider Selector */}
                        <div className="space-y-2">
                            <label className="text-xs text-gray-400 font-semibold flex items-center gap-1">
                                <Globe size={12} /> AI Provider
                            </label>
                            <div className="flex bg-gray-950 p-1 rounded-sm border border-gray-800">
                                <button
                                    onClick={() => onUpdate({ llmProvider: 'gemini' })}
                                    className={`flex-1 text-xs py-1 rounded-xs transition-colors ${config.llmProvider === 'gemini' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    Gemini
                                </button>
                                <button
                                    onClick={() => onUpdate({ llmProvider: 'openai' })}
                                    className={`flex-1 text-xs py-1 rounded-xs transition-colors ${config.llmProvider === 'openai' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    OpenAI
                                </button>
                            </div>
                        </div>

                        {/* Gemini Config */}
                        {config.llmProvider === 'gemini' && (
                            <div className="bg-gray-950/50 p-3 rounded-sm border border-indigo-500/20">
                                <label className="text-xs text-indigo-400 flex items-center gap-1 mb-2 font-semibold">
                                    <Key size={12} /> Gemini API Key
                                </label>
                                <div className="relative flex items-center">
                                    <input
                                        type={showKey ? "text" : "password"}
                                        value={config.geminiApiKey || ''}
                                        onChange={(e) => onUpdate({ geminiApiKey: e.target.value })}
                                        placeholder="AI Studio Key..."
                                        className="w-full bg-gray-800 border border-gray-700 rounded-sm px-2 py-1.5 text-xs text-gray-200 focus:border-indigo-500 outline-hidden pr-8 font-mono"
                                    />
                                    <button
                                        onClick={() => setShowKey(!showKey)}
                                        className="absolute right-2 text-gray-500 hover:text-gray-300"
                                    >
                                        {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* OpenAI Config */}
                        {config.llmProvider === 'openai' && (
                            <div className="bg-gray-950/50 p-3 rounded-sm border border-green-500/20 space-y-3">
                                <div>
                                    <label className="text-xs text-green-400 flex items-center gap-1 mb-1 font-semibold">
                                        <Server size={12} /> Base URL
                                    </label>
                                    <input
                                        type="text"
                                        value={config.openaiBaseUrl || ''}
                                        onChange={(e) => onUpdate({ openaiBaseUrl: e.target.value })}
                                        placeholder="https://api.openai.com/v1"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-sm px-2 py-1.5 text-xs text-gray-200 focus:border-green-500 outline-hidden font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-green-400 flex items-center gap-1 mb-1 font-semibold">
                                        <Key size={12} /> API Key
                                    </label>
                                    <input
                                        type="password"
                                        value={config.openaiApiKey || ''}
                                        onChange={(e) => onUpdate({ openaiApiKey: e.target.value })}
                                        placeholder="sk-..."
                                        className="w-full bg-gray-800 border border-gray-700 rounded-sm px-2 py-1.5 text-xs text-gray-200 focus:border-green-500 outline-hidden font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-green-400 flex items-center gap-1 mb-1 font-semibold">
                                        <Zap size={12} /> Default Model
                                    </label>
                                    <input
                                        type="text"
                                        value={config.openaiModel || ''}
                                        onChange={(e) => onUpdate({ openaiModel: e.target.value })}
                                        placeholder="gpt-4o"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-sm px-2 py-1.5 text-xs text-gray-200 focus:border-green-500 outline-hidden font-mono"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Toggles */}
                        <div className="space-y-3 pt-2 border-t border-gray-800">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400 flex items-center gap-1">
                                    <GitBranch size={12} /> Git Worktrees
                                </label>
                                <button
                                    onClick={() => onUpdate({ useGitWorktrees: !config.useGitWorktrees })}
                                    className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-colors ${config.useGitWorktrees ? 'bg-orange-600' : 'bg-gray-700'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-xs transition-transform ${config.useGitWorktrees ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400 flex items-center gap-1">
                                    <Wand2 size={12} /> Auto-Fix Linter
                                </label>
                                <button
                                    onClick={() => onUpdate({ autoFixLinter: !config.autoFixLinter })}
                                    className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-colors ${config.autoFixLinter ? 'bg-green-600' : 'bg-gray-700'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-xs transition-transform ${config.autoFixLinter ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- AGENT ROSTER --- */}
                {activeTab === 'agents' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">Configure your AI team.</span>
                            <button
                                onClick={handleAddAgent}
                                className="text-[10px] bg-teal-600 hover:bg-teal-500 text-white px-2 py-1 rounded-sm flex items-center gap-1"
                            >
                                <Plus size={10} /> Add Agent
                            </button>
                        </div>

                        <div className="space-y-2">
                            {config.agentProfiles.map(agent => (
                                <div key={agent.id} className="bg-gray-950 border border-gray-800 rounded-md p-3 hover:border-gray-700 transition-colors">
                                    {editingAgent?.id === agent.id ? (
                                        <div className="space-y-3 animate-in fade-in">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[9px] uppercase text-gray-500">Name</label>
                                                    <input
                                                        value={editingAgent.name}
                                                        onChange={e => setEditingAgent({ ...editingAgent, name: e.target.value })}
                                                        className="w-full bg-gray-900 border border-gray-700 rounded-sm px-2 py-1 text-xs text-gray-200"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] uppercase text-gray-500">Role</label>
                                                    <select
                                                        value={editingAgent.role}
                                                        onChange={e => setEditingAgent({ ...editingAgent, role: e.target.value as any })}
                                                        className="w-full bg-gray-900 border border-gray-700 rounded-sm px-2 py-1 text-xs text-gray-300"
                                                    >
                                                        <option value="Architect">Architect</option>
                                                        <option value="Developer">Developer</option>
                                                        <option value="QA">QA</option>
                                                        <option value="Security">Security</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[9px] uppercase text-gray-500">Model Override</label>
                                                <input
                                                    value={editingAgent.model}
                                                    onChange={e => setEditingAgent({ ...editingAgent, model: e.target.value })}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-sm px-2 py-1 text-xs font-mono text-gray-300"
                                                    placeholder="Inherit Default"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] uppercase text-gray-500 flex justify-between">
                                                    <span>Risk Tolerance</span>
                                                    <span>{editingAgent.riskTolerance}</span>
                                                </label>
                                                <input
                                                    type="range" min="0" max="1" step="0.1"
                                                    value={editingAgent.riskTolerance}
                                                    onChange={e => setEditingAgent({ ...editingAgent, riskTolerance: parseFloat(e.target.value) })}
                                                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                                                />
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                                <button
                                                    onClick={() => { handleUpdateAgent(editingAgent); setEditingAgent(null); }}
                                                    className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs py-1.5 rounded-sm flex items-center justify-center gap-1"
                                                >
                                                    <Save size={10} /> Save
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-3">
                                                <div className={`w-8 h-8 rounded bg-gray-900 border border-gray-800 flex items-center justify-center font-bold text-xs ${agent.color}`}>
                                                    {agent.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-gray-200">{agent.name}</div>
                                                    <div className="text-[10px] text-gray-500 flex items-center gap-1">
                                                        {agent.role} <span className="text-gray-700">•</span> {agent.model}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => setEditingAgent(agent)}
                                                    className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-gray-900 rounded-sm"
                                                >
                                                    <Settings size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteAgent(agent.id)}
                                                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-900 rounded-sm"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- TOOL REGISTRY --- */}
                {activeTab === 'tools' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">Define custom CLI tools.</span>
                            <button
                                onClick={handleAddTool}
                                className="text-[10px] bg-orange-600 hover:bg-orange-500 text-white px-2 py-1 rounded-sm flex items-center gap-1"
                            >
                                <Plus size={10} /> Add Tool
                            </button>
                        </div>

                        <div className="space-y-2">
                            {(config.tools || []).length === 0 && (
                                <div className="text-center text-gray-600 text-xs py-4 border border-dashed border-gray-800 rounded-md">
                                    No tools defined.
                                </div>
                            )}
                            {(config.tools || []).map(tool => (
                                <div key={tool.id} className="bg-gray-950 border border-gray-800 rounded-md p-3 hover:border-gray-700 transition-colors">
                                    {editingTool?.id === tool.id ? (
                                        <div className="space-y-3 animate-in fade-in">
                                            <div>
                                                <label className="text-[9px] uppercase text-gray-500">Tool Name (Unique)</label>
                                                <input
                                                    value={editingTool.name}
                                                    onChange={e => setEditingTool({ ...editingTool, name: e.target.value.replace(/\s+/g, '_') })}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-sm px-2 py-1 text-xs text-gray-200 font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] uppercase text-gray-500">Command Template</label>
                                                <input
                                                    value={editingTool.command}
                                                    onChange={e => setEditingTool({ ...editingTool, command: e.target.value })}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-sm px-2 py-1 text-xs text-gray-300 font-mono"
                                                    placeholder="npm run test -- {{file}}"
                                                />
                                                <p className="text-[9px] text-gray-600 mt-1">Use {'{{variable}}'} for dynamic arguments.</p>
                                            </div>
                                            <div>
                                                <label className="text-[9px] uppercase text-gray-500">Description (For AI)</label>
                                                <textarea
                                                    value={editingTool.description}
                                                    onChange={e => setEditingTool({ ...editingTool, description: e.target.value })}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-sm px-2 py-1 text-xs text-gray-300 h-16 resize-none"
                                                />
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                                <button
                                                    onClick={() => { handleUpdateTool(editingTool); setEditingTool(null); }}
                                                    className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs py-1.5 rounded-sm flex items-center justify-center gap-1"
                                                >
                                                    <Save size={10} /> Save
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-3">
                                                <div className="w-8 h-8 rounded bg-gray-900 border border-gray-800 flex items-center justify-center text-orange-500">
                                                    <Play size={14} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-gray-200 font-mono">{tool.name}</div>
                                                    <div className="text-[10px] text-gray-500 line-clamp-1">
                                                        {tool.command}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => { setEditingTool(tool); setEditingAgent(null); }}
                                                    className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-gray-900 rounded-sm"
                                                >
                                                    <Settings size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTool(tool.id)}
                                                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-900 rounded-sm"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};