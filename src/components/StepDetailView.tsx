import React, { useState } from 'react';
import { X, Cpu, AlertTriangle, FileText, Terminal, Clock, ShieldAlert } from 'lucide-react';
import { SubTask } from '../types';

interface StepDetailViewProps {
    step: SubTask;
    onClose: () => void;
}

export const StepDetailView: React.FC<StepDetailViewProps> = ({ step, onClose }) => {
    const [activeTab, setActiveTab] = useState<'trace' | 'output' | 'logs'>('trace');

    const trace = step.trace;

    return (
        // FIX: Changed absolute -> fixed to ensure visibility regardless of scroll
        // Added z-50 to ensure it sits on top of everything
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs">
            {/* Prevent closing when clicking content */}
            <div
                className="w-[600px] h-full bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Header */}
                <div className="h-14 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-950 shrink-0">
                    <div>
                        <h2 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                            <Cpu size={16} className="text-indigo-400" />
                            Flight Recorder
                        </h2>
                        <p className="text-[10px] text-gray-500 font-mono">{step.id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Agent Info Banner */}
                <div className="p-4 bg-indigo-900/10 border-b border-indigo-500/10 shrink-0">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <div className="text-xs font-bold text-indigo-300 mb-0.5">Assigned Agent</div>
                            <div className="text-sm text-white font-mono">{step.role || "Generic Developer"}</div>
                            <div className="text-[10px] text-gray-400">{step.roleDescription || "No specific persona assigned"}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] text-gray-500 uppercase">Status</div>
                            <span className={`text-xs font-bold ${step.status === 'PASSED' ? 'text-green-400' : 'text-yellow-400'}`}>
                                {step.status}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-800 bg-gray-900 shrink-0">
                    <button
                        onClick={() => setActiveTab('trace')}
                        className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 ${activeTab === 'trace' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <Terminal size={14} /> Prompt Trace
                    </button>
                    <button
                        onClick={() => setActiveTab('output')}
                        className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 ${activeTab === 'output' ? 'text-teal-400 border-b-2 border-teal-500' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <FileText size={14} /> Raw Response
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 ${activeTab === 'logs' ? 'text-orange-400 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <AlertTriangle size={14} /> System Logs
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-gray-300 leading-relaxed">

                    {activeTab === 'trace' && (
                        trace ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-gray-500 border-b border-gray-800 pb-2">
                                    <Clock size={12} />
                                    <span>Timestamp: {new Date(trace.timestamp).toLocaleTimeString()}</span>
                                </div>
                                {trace.redFlags.length > 0 && (
                                    <div className="bg-red-900/20 border border-red-500/30 p-3 rounded-md">
                                        <div className="text-red-400 font-bold flex items-center gap-2 mb-1">
                                            <ShieldAlert size={14} /> Red Flags Detected
                                        </div>
                                        <ul className="list-disc pl-4 text-red-300/80 space-y-1">
                                            {trace.redFlags.map((flag, i) => <li key={i}>{flag}</li>)}
                                        </ul>
                                    </div>
                                )}
                                <div>
                                    <div className="text-[10px] uppercase text-gray-500 mb-2 font-bold">Full Context Prompt</div>
                                    <div className="bg-gray-950 p-3 rounded border border-gray-800 whitespace-pre-wrap break-all">
                                        {trace.finalPrompt}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-gray-500 mt-20">No execution trace available yet.</div>
                        )
                    )}

                    {activeTab === 'output' && (
                        trace ? (
                            <div className="bg-gray-950 p-3 rounded border border-gray-800 whitespace-pre-wrap">
                                {trace.rawResponse}
                            </div>
                        ) : (
                            <div className="text-center text-gray-500 mt-20">No output generated yet.</div>
                        )
                    )}

                    {activeTab === 'logs' && (
                        <div className="space-y-2">
                            {step.logs.length === 0 && <div className="text-center text-gray-500 mt-20">No logs recorded.</div>}
                            {step.logs.map((log, i) => (
                                <div key={i} className="flex gap-2 border-b border-gray-800/50 pb-1">
                                    <span className="text-gray-600 select-none">[{i + 1}]</span>
                                    <span className={log.toLowerCase().includes('fail') || log.toLowerCase().includes('error') ? 'text-red-400' : 'text-gray-400'}>
                                        {log}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};