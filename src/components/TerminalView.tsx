import React, { useEffect, useRef, useState } from 'react';
import { VirtualFileSystem } from '../services/virtualFileSystem';
import { MockTauriService, ProcessHandle } from '../services/tauriBridge';
import { XCircle } from 'lucide-react';

interface LogLine {
  id: string;
  type: 'input' | 'stdout' | 'stderr' | 'system';
  content: string;
  cwd?: string;
}

export const TerminalView: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cwd, setCwd] = useState<string>('.');
  const [logs, setLogs] = useState<LogLine[]>([
    { id: 'init', type: 'system', content: 'MAKER Shell v2.3.1 [Ready]' },
    { id: 'help', type: 'system', content: 'Commands: git, npm, npx, cd, ls, clear' }
  ]);
  const [input, setInput] = useState('');

  const [activeProcess, setActiveProcess] = useState<ProcessHandle | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (type: LogLine['type'], content: string, cmdCwd?: string) => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36),
      type,
      content,
      cwd: cmdCwd
    }]);
  };

  const handleCommand = async (cmdStr: string) => {
    if (!cmdStr.trim()) return;

    setHistory(prev => [...prev, cmdStr]);
    setHistoryIndex(-1);
    addLog('input', cmdStr, cwd);
    setInput('');

    const vfs = VirtualFileSystem.getInstance();
    const projectRoot = vfs.getRoot();

    const parts = cmdStr.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(s => s.replace(/"/g, '')) || [];
    const cmd = parts[0];
    const args = parts.slice(1);

    try {
      if (cmd === 'clear') {
        setLogs([]);
        return;
      }
      if (cmd === 'cd') {
        if (!args[0] || args[0] === '.') { /* noop */ }
        else if (args[0] === '..') {
          const segments = cwd.split('/');
          if (segments.length > 1 && cwd !== '.') {
            segments.pop();
            setCwd(segments.join('/') || '.');
          } else setCwd('.');
        } else {
          setCwd(cwd === '.' ? args[0] : `${cwd}/${args[0]}`);
        }
        return;
      }
      // RESTORED: Internal LS command for fast feedback
      if (cmd === 'ls' || cmd === 'dir') {
        const tree = await vfs.getDirectoryTree();
        // Simple flat list of root for now, ideally filter by CWD
        const listing = tree.map(n => n.isDirectory ? `\u001b[34m${n.name}/\u001b[0m` : n.name).join('  ');
        addLog('stdout', listing || '(empty directory)');
        return;
      }

      const absCwd = projectRoot ? (cwd === '.' ? projectRoot : `${projectRoot}/${cwd}`) : undefined;

      const proc = await MockTauriService.spawnShell(
        cmd,
        args,
        absCwd,
        (data, type) => {
          const cleanData = data.endsWith('\n') ? data.slice(0, -1) : data;
          addLog(type, cleanData);
        },
        (code) => {
          if (code !== 0) addLog('system', `Exited with code ${code}`);
          setActiveProcess(null);
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      );

      setActiveProcess(proc);

    } catch (e: any) {
      addLog('stderr', e.message || 'Execution failed');
    }
  };

  const handleKill = async () => {
    if (activeProcess) {
      await activeProcess.kill();
      setActiveProcess(null);
      addLog('system', '^C');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (activeProcess) {
        // activeProcess.write(input + '\n');
      } else {
        handleCommand(input);
      }
    } else if (e.key === 'c' && e.ctrlKey) {
      if (activeProcess) {
        handleKill();
      } else {
        setInput('');
        addLog('input', '^C', cwd);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIdx);
        setInput(history[newIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIdx = Math.min(history.length - 1, historyIndex + 1);
        setHistoryIndex(newIdx);
        setInput(history[newIdx]);
      } else {
        setInput('');
      }
    }
  };

  return (
    <div className="h-full w-full bg-gray-950 flex flex-col">
      <div
        className="flex-1 p-2 font-mono text-xs overflow-y-auto"
        onClick={() => inputRef.current?.focus()}
        ref={scrollRef}
      >
        {logs.map((log) => (
          <div key={log.id} className="mb-0.5 break-all whitespace-pre-wrap leading-relaxed">
            {log.type === 'input' && (
              <div className="flex items-center gap-2 text-gray-500 mt-2 mb-1">
                <span className="text-indigo-400 font-bold">➜</span>
                <span className="text-cyan-600">{log.cwd}</span>
                <span className="text-gray-300">{log.content}</span>
              </div>
            )}
            {log.type !== 'input' && (
              <div className="pl-4">
                <AnsiRenderer text={log.content} type={log.type} />
              </div>
            )}
          </div>
        ))}

        <div className="flex items-center gap-2 mt-2 pl-0.5">
          <span className={`font-bold ${activeProcess ? 'text-yellow-500 animate-pulse' : 'text-green-500'}`}>
            {activeProcess ? '⚙' : '➜'}
          </span>
          <span className="text-cyan-600">{cwd}</span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent outline-hidden border-none text-gray-100 placeholder-gray-700"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            disabled={!!activeProcess}
            placeholder={activeProcess ? "Running... (Ctrl+C to stop)" : ""}
          />
        </div>
      </div>

      {activeProcess && (
        <div className="h-8 bg-gray-900 border-t border-gray-800 flex items-center justify-between px-4">
          <span className="text-xs text-yellow-500 flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-ping"></div>
            Process Active (PID: {activeProcess.pid})
          </span>
          <button
            onClick={handleKill}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 bg-red-900/20 px-2 py-1 rounded-sm border border-red-900/50 transition-colors"
          >
            <XCircle size={12} /> Stop
          </button>
        </div>
      )}
    </div>
  );
};

const AnsiRenderer: React.FC<{ text: string, type: string }> = ({ text, type }) => {
  if (!text) return null;
  const baseClass = type === 'stderr' ? 'text-red-400' : type === 'system' ? 'text-blue-400' : 'text-gray-300';
  const parts = text.split(/(\u001b\[\d+m)/g);
  let currentColor = baseClass;
  let isBold = false;

  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('\u001b[')) {
          if (part === '\u001b[0m') { currentColor = baseClass; isBold = false; }
          else if (part === '\u001b[1m') { isBold = true; }
          else if (part === '\u001b[31m') { currentColor = 'text-red-500'; }
          else if (part === '\u001b[32m') { currentColor = 'text-green-500'; }
          else if (part === '\u001b[33m') { currentColor = 'text-yellow-500'; }
          else if (part === '\u001b[34m') { currentColor = 'text-blue-500'; }
          else if (part === '\u001b[36m') { currentColor = 'text-cyan-500'; }
          return null;
        }
        return <span key={i} className={`${currentColor} ${isBold ? 'font-bold' : ''}`}>{part}</span>;
      })}
    </span>
  );
};