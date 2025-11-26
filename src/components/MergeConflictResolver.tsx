import React, { useState } from 'react';
import { GitMerge, Wand2, Check, X, FileDiff, ArrowRight } from 'lucide-react';
import { MergeConflict } from '../types';

interface MergeConflictResolverProps {
    conflicts: MergeConflict[];
    onResolve: (id: string, content: string) => void;
}

export const MergeConflictResolver: React.FC<MergeConflictResolverProps> = ({ conflicts, onResolve }) => {
    const [selectedConflict, setSelectedConflict] = useState<string | null>(conflicts[0]?.id || null);
    const activeConflict = conflicts.find(c => c.id === selectedConflict);

    if (conflicts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Check className="text-green-500 mb-2" size={32} />
                <p>No active merge conflicts.</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-950">
            <div className="p-4 border-b border-gray-800 bg-red-950/10 flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-sm text-red-500">
                    <GitMerge size={20} />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-red-200">Merge Conflict Detected</h3>
                    <p className="text-xs text-red-400/70">MAKER has detected {conflicts.length} files requiring resolution.</p>
                </div>
            </div>

            <div className="flex-1 flex min-h-0">
                {/* File List */}
                <div className="w-64 border-r border-gray-800 bg-gray-900/50 p-2 overflow-y-auto">
                    <div className="text-xs font-semibold text-gray-500 mb-2 px-2 uppercase">Conflicted Files</div>
                    {conflicts.map(conflict => (
                        <div
                            key={conflict.id}
                            onClick={() => setSelectedConflict(conflict.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded text-sm cursor-pointer mb-1 ${selectedConflict === conflict.id ? 'bg-indigo-600/20 text-indigo-300' : 'hover:bg-gray-800 text-gray-400'
                                }`}
                        >
                            <FileDiff size={14} />
                            <span className="truncate">{conflict.filePath}</span>
                        </div>
                    ))}
                </div>

                {/* Conflict Editor */}
                {activeConflict ? (
                    <div className="flex-1 flex flex-col min-h-0">
                        {/* Comparison View */}
                        <div className="flex-1 grid grid-cols-2 divide-x divide-gray-800 min-h-0">
                            <div className="flex flex-col">
                                <div className="h-8 bg-gray-900 border-b border-gray-800 flex items-center px-4 text-xs font-mono text-gray-400">
                                    HEAD ({activeConflict.branchA})
                                </div>
                                <div className="flex-1 p-4 font-mono text-xs overflow-auto bg-gray-950/50 text-red-300 whitespace-pre">
                                    {activeConflict.contentA}
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <div className="h-8 bg-gray-900 border-b border-gray-800 flex items-center px-4 text-xs font-mono text-gray-400">
                                    Incoming ({activeConflict.branchB})
                                </div>
                                <div className="flex-1 p-4 font-mono text-xs overflow-auto bg-gray-950/50 text-green-300 whitespace-pre">
                                    {activeConflict.contentB}
                                </div>
                            </div>
                        </div>

                        {/* AI Resolution Proposal */}
                        <div className="h-1/3 border-t border-gray-800 bg-gray-900 flex flex-col">
                            <div className="h-8 bg-gray-800 flex items-center justify-between px-4 text-xs border-b border-gray-700">
                                <div className="flex items-center gap-2 text-indigo-300">
                                    <Wand2 size={12} /> MAKER Proposal
                                </div>
                                <div className="flex gap-2">
                                    <button className="flex items-center gap-1 hover:text-white text-gray-400">
                                        Regenerate
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 p-4 font-mono text-xs overflow-auto text-indigo-100 whitespace-pre">
                                {activeConflict.aiResolutionProposal}
                            </div>
                            <div className="p-3 border-t border-gray-800 flex justify-end gap-3 bg-gray-950">
                                <button className="px-4 py-1.5 rounded-sm text-xs bg-gray-800 hover:bg-gray-700 text-gray-300">
                                    Manual Edit
                                </button>
                                <button
                                    onClick={() => onResolve(activeConflict.id, activeConflict.aiResolutionProposal || "")}
                                    className="px-4 py-1.5 rounded-sm text-xs bg-green-600 hover:bg-green-500 text-white flex items-center gap-2"
                                >
                                    <Check size={14} /> Accept Resolution
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">Select a file</div>
                )}
            </div>
        </div>
    );
};