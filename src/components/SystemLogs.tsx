import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Info, AlertTriangle, Trash2 } from 'lucide-react';
import { Logger, LogEntry } from '../services/logger';

export const SystemLogs: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const logger = Logger.getInstance();
        const unsub = logger.subscribe(setLogs);
        return unsub;
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="flex flex-col h-full bg-gray-950">
            <div className="flex justify-between items-center px-2 py-1 border-b border-gray-800 bg-gray-900/50">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Application Events</span>
                <button
                    onClick={() => Logger.getInstance().clear()}
                    className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-gray-300"
                    title="Clear Logs"
                >
                    <Trash2 size={12} />
                </button>
            </div>
            <div className="flex-1 p-2 font-mono text-xs overflow-y-auto" ref={scrollRef}>
                {logs.length === 0 && <div className="text-gray-600 italic p-2">No system logs recorded.</div>}
                {logs.map(log => (
                    <div key={log.id} className="mb-1 flex gap-2 break-all hover:bg-white/5 p-0.5 rounded-sm">
                        <span className="text-gray-600 shrink-0">[{log.timestamp}]</span>
                        <span className="shrink-0 pt-0.5">
                            {log.type === 'error' && <AlertCircle size={12} className="text-red-500" />}
                            {log.type === 'warn' && <AlertTriangle size={12} className="text-yellow-500" />}
                            {log.type === 'info' && <Info size={12} className="text-blue-500" />}
                        </span>
                        <span className={
                            log.type === 'error' ? 'text-red-400' :
                                log.type === 'warn' ? 'text-yellow-400' :
                                    'text-gray-400'
                        }>
                            {log.message}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};