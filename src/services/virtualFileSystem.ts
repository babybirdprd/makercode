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
        // Normalize root path immediately: replace backslashes and remove trailing slashes
        this.projectRoot = path.replace(/\\/g, '/').replace(/\/$/, '');
        this.fileCache.clear();

        if (this.unwatchFn) {
            this.unwatchFn();
            this.unwatchFn = null;
        }

        try {
            // Watch the normalized path
            this.unwatchFn = await MockTauriService.watchPath(this.projectRoot, (event) => {
                this.handleDiskChange(event);
            });
            console.log(`[VFS] Watcher started on ${this.projectRoot}`);
        } catch (e) {
            console.warn("[VFS] Failed to start watcher. Manual refresh required.", e);
        }

        this.notify();
    }

    async refresh() {
        if (this.projectRoot) {
            console.log("[VFS] Refreshing file tree...");
            this.notify();
        }
    }

    private handleDiskChange(event: any) {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            console.log("[VFS] Disk change detected:", event);
            this.notify();
        }, 500);
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
        return this.scanDir(this.projectRoot, '');
    }

    private async scanDir(absolutePath: string, relativePath: string): Promise<any[]> {
        try {
            const entries = await MockTauriService.listFiles(absolutePath);

            const nodes = await Promise.all(entries.map(async (entry: any) => {
                const entryRelativePath = relativePath
                    ? `${relativePath}/${entry.name}`
                    : `/${entry.name}`;

                const entryAbsolutePath = `${absolutePath}/${entry.name}`;

                const node: any = {
                    name: entry.name,
                    path: entryRelativePath,
                    isDirectory: entry.isDirectory,
                };

                if (entry.isDirectory) {
                    if (['node_modules', '.git', 'target', 'dist', 'build', '.maker', '__pycache__', 'venv', '.vscode'].includes(entry.name)) {
                        node.children = [];
                    } else {
                        try {
                            node.children = await this.scanDir(entryAbsolutePath, entryRelativePath);
                        } catch {
                            node.children = [];
                        }
                    }
                }
                return node;
            }));

            return nodes.sort((a: any, b: any) => {
                if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                return a.isDirectory ? -1 : 1;
            });
        } catch (e) {
            console.error(`[VFS] Failed to scan dir ${absolutePath}`, e);
            return [];
        }
    }

    private normalizePath(path: string): string {
        // 1. Convert backslashes
        let clean = path.replace(/\\/g, '/');

        // 2. Handle root-relative paths carefully
        if (clean.startsWith('./')) clean = clean.substring(2);

        // 3. Remove trailing slash if it's not root
        if (clean.length > 1 && clean.endsWith('/')) clean = clean.slice(0, -1);

        // 4. SECURITY: Prevent directory traversal
        if (clean.includes('../') || clean.endsWith('/..') || clean === '..') {
            throw new Error(`Security Violation: Path traversal detected in '${path}'. Access denied.`);
        }

        // 5. Ensure absolute path relative to VFS root
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