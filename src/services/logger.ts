export interface LogEntry {
    id: string;
    type: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    timestamp: string;
}

export class Logger {
    private static instance: Logger;
    private logs: LogEntry[] = [];
    private listeners: ((logs: LogEntry[]) => void)[] = [];

    private constructor() {
        this.patchConsole();
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private patchConsole() {
        const originalError = console.error;
        const originalWarn = console.warn;
        const originalLog = console.log;

        console.error = (...args) => {
            this.addLog('error', args);
            originalError.apply(console, args);
        };

        console.warn = (...args) => {
            this.addLog('warn', args);
            originalWarn.apply(console, args);
        };

        console.log = (...args) => {
            const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
            // Capture relevant app logs
            if (msg.startsWith('[MAKER]') || msg.startsWith('[Git]') || msg.startsWith('[LLM]')) {
                this.addLog('info', args);
            }
            originalLog.apply(console, args);
        };
    }

    private addLog(type: LogEntry['type'], args: any[]) {
        const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        const entry: LogEntry = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            message,
            timestamp: new Date().toLocaleTimeString()
        };
        this.logs.push(entry);
        this.notify();
    }

    public getLogs(): LogEntry[] {
        return this.logs;
    }

    public subscribe(listener: (logs: LogEntry[]) => void) {
        this.listeners.push(listener);
        // Send current state immediately
        listener(this.logs);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify() {
        this.listeners.forEach(l => l(this.logs));
    }

    public clear() {
        this.logs = [];
        this.notify();
    }
}