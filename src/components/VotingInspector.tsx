import React from 'react';
import { X, Award, GitGraph, ThumbsUp, ShieldAlert } from 'lucide-react';
import { SubTask, AgentCandidate } from '../types';

interface VotingInspectorProps {
    step: SubTask;
    onClose: () => void;
}

export const VotingInspector: React.FC<VotingInspectorProps> = ({ step, onClose }) => {
    if (!step.candidates || step.candidates.length === 0) return null;

    const sortedCandidates = [...step.candidates].sort((a, b) => b.voteCount - a.voteCount);

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-xs p-8">
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900">
                    <div>
                        <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                            <GitGraph className="text-purple-500" />
                            Consensus Inspector
                        </h2>
                        <p className="text-xs text-gray-500 font-mono">Step ID: {step.id} • {step.description}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden flex">
                    {/* Candidate List */}
                    <div className="w-1/3 border-r border-gray-800 bg-gray-900/50 overflow-y-auto p-4 space-y-4">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Agent Proposals</div>

                        {sortedCandidates.map((cand, idx) => (
                            <div key={cand.id} className={`p-4 rounded-lg border relative ${idx === 0
                                ? 'bg-purple-900/10 border-purple-500/50'
                                : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
                                }`}>
                                {idx === 0 && (
                                    <div className="absolute -top-2 -right-2 bg-purple-600 text-white p-1 rounded-full shadow-lg">
                                        <Award size={14} />
                                    </div>
                                )}
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`text-sm font-bold ${idx === 0 ? 'text-purple-300' : 'text-gray-300'}`}>
                                        {cand.agentName}
                                    </span>
                                    <span className="flex items-center gap-1 text-xs bg-gray-950 px-2 py-1 rounded-sm border border-gray-800">
                                        <ThumbsUp size={10} className={idx === 0 ? 'text-purple-400' : 'text-gray-500'} />
                                        {cand.voteCount} Votes
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 italic mb-2">"{cand.reasoning}"</p>
                                <div className="text-[10px] font-mono bg-gray-950/50 p-2 rounded-sm text-gray-400 overflow-hidden h-20 relative">
                                    {cand.content}
                                    <div className="absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-gray-950 to-transparent"></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Winner Detail View */}
                    <div className="flex-1 flex flex-col bg-gray-950">
                        <div className="p-4 border-b border-gray-800 bg-purple-900/5 flex items-center justify-between">
                            <span className="text-xs font-bold text-purple-400 flex items-center gap-2">
                                <Award size={14} /> WINNING CANDIDATE
                            </span>
                            <div className="flex gap-2">
                                <span className="text-[10px] px-2 py-0.5 rounded-sm bg-green-900/20 text-green-400 border border-green-900/30">Linter Passed</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-sm bg-blue-900/20 text-blue-400 border border-blue-900/30">Security Verified</span>
                            </div>
                        </div>
                        <div className="flex-1 p-6 overflow-auto font-mono text-sm leading-relaxed text-gray-300">
                            <pre>{sortedCandidates[0].content}</pre>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="h-12 border-t border-gray-800 bg-gray-900 flex items-center px-6 gap-4 text-xs text-gray-500">
                    <ShieldAlert size={14} className="text-yellow-500" />
                    <span>Consensus reached with {(step.votes / 3 * 100).toFixed(0)}% confidence. Risk score: {step.riskScore.toFixed(2)}.</span>
                </div>
            </div>
        </div>
    );
};