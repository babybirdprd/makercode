import React, { useState, useEffect } from 'react';
import { GitCommit, GitBranch, AlertTriangle, Layers, RefreshCw, Cloud, ArrowUp, ArrowDown, Check, Loader2, Save } from 'lucide-react';
import { GitHistory } from './GitHistory';
import { MergeConflictResolver } from './MergeConflictResolver';
import { GitService, GitStatus } from '../services/gitService';
import { Worktree, MergeConflict } from '../types';

interface VersionControlProps {
    addToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const VersionControl: React.FC<VersionControlProps> = ({ addToast }) => {
    const [view, setView] = useState<'timeline' | 'worktrees' | 'conflicts'>('timeline');
    const [worktrees, setWorktrees] = useState<Worktree[]>([]);
    const [conflicts, setConflicts] = useState<MergeConflict[]>([]);
    const [status, setStatus] = useState<GitStatus | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const [commitMsg, setCommitMsg] = useState('');
    const [isCommitting, setIsCommitting] = useState(false);

    const loadData = async () => {
        const git = GitService.getInstance();
        const [wts, cfs, st] = await Promise.all([
            git.listWorktrees(),
            git.getConflicts(),
            git.getStatus()
        ]);
        setWorktrees(wts);
        setConflicts(cfs);
        setStatus(st);
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await GitService.getInstance().syncRemote();
            await loadData();
            addToast?.('success', 'Sync completed successfully.');
        } catch (e: any) {
            console.error("Sync failed", e);
            addToast?.('error', `Sync Failed: ${e.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleCommit = async () => {
        if (!commitMsg.trim()) return;
        setIsCommitting(true);
        try {
            await GitService.getInstance().commitAll(commitMsg);
            setCommitMsg('');
            await loadData();
            addToast?.('success', 'Changes committed.');
        } catch (e: any) {
            console.error("Commit failed", e);
            addToast?.('error', `Commit Failed: ${e.message}`);
        } finally {
            setIsCommitting(false);
        }
    };

    const handleResolveConflict = async (id: string, content: string) => {
        const git = GitService.getInstance();
        await git.resolveConflict(id, content);
        setConflicts(prev => prev.filter(c => c.id !== id));
        addToast?.('success', 'Conflict resolved.');
    };

    return (
        <div className="flex flex-col h-full bg-gray-950">
            {/* Status Bar / External Integration */}
            <div className="h-12 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${status?.isDirty ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                        <span className="text-xs font-mono text-gray-300">
                            {status?.isDirty ? 'Unsaved Changes' : 'Clean'}
                        </span>
                    </div>
                    {status?.currentBranch && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-950 px-2 py-1 rounded-sm border border-gray-800">
                            <GitBranch size={10} />
                            {status.currentBranch}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {status?.hasRemote ? (
                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-sm transition-colors disabled:opacity-50"
                        >
                            {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <Cloud size={12} />}
                            Sync
                            {(status.behind > 0 || status.ahead > 0) && (
                                <span className="flex items-center gap-1 ml-1 text-[10px] bg-indigo-700 px-1.5 rounded-full">
                                    {status.behind > 0 && <span className="flex items-center"><ArrowDown size={8} />{status.behind}</span>}
                                    {status.ahead > 0 && <span className="flex items-center"><ArrowUp size={8} />{status.ahead}</span>}
                                </span>
                            )}
                        </button>
                    ) : (
                        <span className="text-xs text-gray-600 italic px-2">No Remote Configured</span>
                    )}
                </div>
            </div>

            {/* Dirty State Commit Box */}
            {status?.isDirty && (
                <div className="p-3 bg-yellow-900/10 border-b border-yellow-500/20 flex gap-2 items-center animate-in slide-in-from-top">
                    <input
                        value={commitMsg}
                        onChange={(e) => setCommitMsg(e.target.value)}
                        placeholder="Describe your changes..."
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-sm px-3 py-1.5 text-xs text-white focus:border-yellow-500 outline-hidden"
                        onKeyDown={(e) => e.key === 'Enter' && handleCommit()}
                    />
                    <button
                        onClick={handleCommit}
                        disabled={isCommitting || !commitMsg.trim()}
                        className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-1.5 rounded-sm text-xs font-medium flex items-center gap-2 disabled:opacity-50"
                    >
                        {isCommitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Commit
                    </button>
                </div>
            )}

            {/* Sub-Navigation */}
            <div className="h-10 border-b border-gray-800 flex items-center px-4 gap-6 bg-gray-900/50">
                <button
                    onClick={() => setView('timeline')}
                    className={`text-xs flex items-center gap-2 h-full border-b-2 transition-colors ${view === 'timeline' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                    <GitCommit size={14} /> Commit Timeline
                </button>
                <button
                    onClick={() => setView('worktrees')}
                    className={`text-xs flex items-center gap-2 h-full border-b-2 transition-colors ${view === 'worktrees' ? 'border-orange-500 text-orange-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                    <Layers size={14} /> Active Worktrees
                    <span className="bg-gray-800 px-1.5 py-0.5 rounded-full text-[10px]">{worktrees.length}</span>
                </button>
                <button
                    onClick={() => setView('conflicts')}
                    className={`text-xs flex items-center gap-2 h-full border-b-2 transition-colors ${view === 'conflicts' ? 'border-red-500 text-red-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                    <AlertTriangle size={14} /> Conflict Resolver
                    {conflicts.length > 0 && (
                        <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full text-[10px]">{conflicts.length}</span>
                    )}
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
                {view === 'timeline' && <GitHistory />}

                {view === 'worktrees' && (
                    <div className="p-8">
                        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                            {worktrees.length === 0 ? (
                                <div className="col-span-2 text-center text-gray-500 py-12">
                                    <Layers size={48} className="mx-auto mb-4 opacity-20" />
                                    <p>No active worktrees.</p>
                                    <p className="text-xs mt-1">Agents create isolated worktrees automatically during execution.</p>
                                </div>
                            ) : (
                                worktrees.map(wt => (
                                    <div key={wt.id} className="bg-gray-900 border border-gray-800 p-4 rounded-lg hover:border-orange-500/30 transition-colors">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2 text-orange-400 text-sm font-semibold">
                                                <GitBranch size={16} />
                                                {wt.branch}
                                            </div>
                                            <span className="text-[10px] bg-green-900/30 text-green-400 px-2 py-0.5 rounded-sm uppercase">
                                                {wt.status}
                                            </span>
                                        </div>
                                        <div className="space-y-2 text-xs text-gray-500 font-mono">
                                            <div className="flex items-center gap-2">
                                                <Layers size={12} />
                                                <span className="truncate">{wt.path}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <RefreshCw size={12} />
                                                <span>Active: {wt.lastActivity}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {view === 'conflicts' && (
                    <MergeConflictResolver conflicts={conflicts} onResolve={handleResolveConflict} />
                )}
            </div>
        </div>
    );
};