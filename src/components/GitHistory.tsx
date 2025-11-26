import React, { useEffect, useState } from 'react';
import { GitCommit, GitPullRequest, Hash, Calendar, User, FileDiff } from 'lucide-react';
import { GitService } from '../services/gitService';
import { GitLogEntry } from '../types';

export const GitHistory: React.FC = () => {
    const [history, setHistory] = useState<GitLogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadHistory = async () => {
            const git = new GitService();
            const log = await git.getHistory();
            setHistory(log);
            setLoading(false);
        };
        loadHistory();

        // Poll for updates (simplified for demo)
        const interval = setInterval(loadHistory, 5000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-gray-500 font-mono text-xs">Loading Repository History...</div>;
    }

    return (
        <div className="h-full w-full bg-gray-950 p-4 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
                    <h2 className="text-xl font-bold text-gray-200 flex items-center gap-2">
                        <GitCommit className="text-orange-500" />
                        Project Timeline
                    </h2>
                    <span className="text-xs font-mono text-gray-500 bg-gray-900 px-2 py-1 rounded-sm">
                        Branch: <span className="text-indigo-400">main</span>
                    </span>
                </div>

                <div className="space-y-4">
                    {history.map((commit, idx) => (
                        <div key={commit.hash} className="relative pl-8 pb-4 group">
                            {/* Connector Line */}
                            {idx !== history.length - 1 && (
                                <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-gray-800 group-hover:bg-gray-700 transition-colors"></div>
                            )}

                            {/* Node Point */}
                            <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-gray-900 border-2 border-orange-500/50 flex items-center justify-center z-10">
                                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                            </div>

                            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-orange-500/30 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-semibold text-gray-200 text-sm mb-1">{commit.message}</h3>
                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <User size={10} /> {commit.author}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar size={10} /> {commit.date}
                                            </span>
                                            <span className="flex items-center gap-1 font-mono text-gray-600">
                                                <Hash size={10} /> {commit.hash.substring(0, 7)}
                                            </span>
                                        </div>
                                    </div>

                                    {commit.stats && (
                                        <div className="flex items-center gap-2 text-[10px] font-mono bg-gray-950 px-2 py-1 rounded-sm border border-gray-800">
                                            <span className="text-green-400">+{commit.stats.additions}</span>
                                            <span className="text-gray-700">|</span>
                                            <span className="text-red-400">-{commit.stats.deletions}</span>
                                        </div>
                                    )}
                                </div>

                                {commit.tags && commit.tags.length > 0 && (
                                    <div className="flex gap-2 mt-2">
                                        {commit.tags.map(tag => (
                                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-sm bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};