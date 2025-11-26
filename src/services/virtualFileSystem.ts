import { MockTauriService } from './tauriBridge';

export class VirtualFileSystem {
    private static instance: VirtualFileSystem;
    private projectRoot: string | null = null;

    private fileCache: Map<string, string> = new Map();
    private listeners: (() => void)[] = [];

    private unwatchFn: (() => void) | null = null;
    private debounceTimer: any = null;

    private constructor() {
        this.fileCache.set('/package.json', '{\n  "name": "maker-project-demo",\n  "version": "1.0.0"\n}');
        this.fileCache.set('/src/index.ts', '// Entry point\nconsole.log("Hello MAKER");');
    }

    public static getInstance(): VirtualFileSystem {
        if (!VirtualFileSystem.instance) {
            VirtualFileSystem.instance = new VirtualFileSystem();
        }
        return VirtualFileSystem.instance;
    }

    async setRoot(path: string) {
        this.projectRoot = path;
        this.fileCache.clear();

        if (this.unwatchFn) {
            this.unwatchFn();
            this.unwatchFn = null;
        }

        this.unwatchFn = await MockTauriService.watchPath(path, (event) => {
            this.handleDiskChange(event);
        });

        this.notify();
    }

    private handleDiskChange(event: any) {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            console.log("[VFS] Disk change detected:", event);
            this.notify();
        }, 300);
    }

    getRoot(): string | null {
        return this.projectRoot;
    }

    subscribe(listener: () => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify() {
        this.listeners.forEach(l => l());
    }

    async writeFile(path: string, content: string) {
        const cleanPath = this.normalizePath(path);
        this.fileCache.set(cleanPath, content);

        if (this.projectRoot) {
            const fullPath = `${this.projectRoot}${cleanPath}`;
            await MockTauriService.writeFile(fullPath, content);
        }
        this.notify();
    }

    async readFile(path: string): Promise<string | null> {
        const cleanPath = this.normalizePath(path);

        if (this.projectRoot) {
            try {
                const fullPath = `${this.projectRoot}${cleanPath}`;
                const content = await MockTauriService.readFile(fullPath);
                this.fileCache.set(cleanPath, content);
                return content;
            } catch (e) {
                return null;
            }
        }

        if (this.fileCache.has(cleanPath)) {
            return this.fileCache.get(cleanPath) || null;
        }
        return null;
    }

    async getDirectoryTree(): Promise<any[]> {
        if (!this.projectRoot) return this.buildTreeFromCache();

        try {
            const entries = await MockTauriService.listFiles(this.projectRoot);
            const nodes = entries.map((entry: any) => ({
                name: entry.name,
                path: `/${entry.name}`,
                isDirectory: entry.isDirectory,
                children: entry.isDirectory ? [] : undefined
            }));

            return nodes.sort((a: any, b: any) => {
                if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                return a.isDirectory ? -1 : 1;
            });
        } catch (e) {
            console.error("VFS: Failed to scan root", e);
            return [];
        }
    }

    private normalizePath(path: string): string {
        // 1. Convert backslashes
        let clean = path.replace(/\\/g, '/');

        // 2. Remove leading ./
        if (clean.startsWith('./')) clean = clean.substring(2);

        // 3. SECURITY: Prevent directory traversal
        // We do not allow '..' segments that could escape the project root
        if (clean.includes('../') || clean.endsWith('/..') || clean === '..') {
            throw new Error(`Security Violation: Path traversal detected in '${path}'. Access denied.`);
        }

        // 4. Ensure absolute path relative to VFS root
        return clean.startsWith('/') ? clean : '/' + clean;
    }

    private buildTreeFromCache(): any[] {
        const root: any[] = [];
        const paths = Array.from(this.fileCache.keys()).sort();

        paths.forEach(path => {
            const parts = path.split('/').filter(p => p);
            let currentLevel = root;

            parts.forEach((part, index) => {
                const isFile = index === parts.length - 1;
                const existing = currentLevel.find(n => n.name === part);

                if (existing) {
                    if (!isFile) currentLevel = existing.children;
                } else {
                    const newNode = {
                        name: part,
                        path: '/' + parts.slice(0, index + 1).join('/'),
                        isDirectory: !isFile,
                        children: isFile ? undefined : []
                    };
                    currentLevel.push(newNode);
                    if (!isFile) currentLevel = newNode.children;
                }
            });
        });
        return root;
    }
}