import { VirtualFileSystem } from "./virtualFileSystem";
import { LanguageRegistry } from "./languages/registry";

export interface ProjectContext {
    fileTree: string;
    manifests: string;
    scoutedFiles: { path: string, content: string }[];
}

export class ContextManager {
    private static instance: ContextManager;
    private vfs: VirtualFileSystem;
    private langRegistry: LanguageRegistry;

    private constructor() {
        this.vfs = VirtualFileSystem.getInstance();
        this.langRegistry = LanguageRegistry.getInstance();
    }

    public static getInstance(): ContextManager {
        if (!ContextManager.instance) {
            ContextManager.instance = new ContextManager();
        }
        return ContextManager.instance;
    }

    async getArchitectContext(userPrompt: string): Promise<ProjectContext> {
        const fileTree = await this.generateFileTree();
        const manifests = await this.getManifests();
        const scoutedFiles = await this.scoutFiles(userPrompt);

        return {
            fileTree,
            manifests,
            scoutedFiles
        };
    }

    async getTaskContext(fileTarget: string, dependencies: string[]): Promise<string> {
        let context = "";

        // 1. Target File
        const targetContent = await this.vfs.readFile(fileTarget);
        if (targetContent) {
            context += `\n--- CURRENT CONTENT: ${fileTarget} ---\n${targetContent}\n`;
        }

        // 2. Dependencies
        for (const depPath of dependencies) {
            const content = await this.vfs.readFile(depPath);
            if (content) {
                context += `\n--- REFERENCE: ${depPath} ---\n${content}\n`;
            }
        }

        // 3. Language Specific Guidelines
        const provider = this.langRegistry.getProvider(fileTarget);
        if (provider) {
            context += `\n--- LANGUAGE RULES ---\n${provider.getSystemPrompt()}\n`;
        }

        return context;
    }

    async expandContext(errorMessage: string): Promise<string> {
        const match = errorMessage.match(/'([^']+)'/) || errorMessage.match(/"([^"]+)"/);

        if (match) {
            const symbol = match[1];
            console.log(`[ContextManager] Failsafe triggered. Hunting for symbol: ${symbol}`);

            const tree = await this.vfs.getDirectoryTree();
            const foundFile = this.findFileInTree(tree, symbol);

            if (foundFile) {
                const content = await this.vfs.readFile(foundFile);
                return `\n--- AUTO-DISCOVERED CONTEXT (${foundFile}) ---\n${content}\n`;
            }
        }

        return "";
    }

    private async generateFileTree(): Promise<string> {
        const tree = await this.vfs.getDirectoryTree();
        return this.renderTree(tree);
    }

    private renderTree(nodes: any[], depth = 0): string {
        let output = "";
        const indent = "  ".repeat(depth);

        for (const node of nodes) {
            if (['node_modules', 'target', 'venv', '.git', 'dist', '.maker'].includes(node.name)) continue;

            output += `${indent}${node.name}${node.isDirectory ? '/' : ''}\n`;
            if (node.children) {
                output += this.renderTree(node.children, depth + 1);
            }
        }
        return output;
    }

    private async getManifests(): Promise<string> {
        let output = "";

        // Dynamic Manifest Loading based on Language Registry
        const manifestNames = this.langRegistry.getAllManifests();
        // Deduplicate
        const uniqueManifests = [...new Set(manifestNames)];

        for (const name of uniqueManifests) {
            // We search in root for these files
            // In a real app we might search deeper, but root is standard for manifests
            const content = await this.vfs.readFile(`/${name}`);
            if (content) {
                output += `\n--- ${name} ---\n${content}\n`;
            }
        }

        return output;
    }

    private async scoutFiles(prompt: string): Promise<{ path: string, content: string }[]> {
        const keywords = prompt.toLowerCase().split(' ').filter(w => w.length > 4);
        const results: { path: string, content: string }[] = [];

        if (keywords.length === 0) return [];

        const tree = await this.vfs.getDirectoryTree();
        const files = this.flattenTree(tree);

        for (const file of files) {
            if (results.length >= 3) break;

            const fileName = file.split('/').pop()?.toLowerCase() || "";
            if (keywords.some(k => fileName.includes(k))) {
                const content = await this.vfs.readFile(file);
                if (content) results.push({ path: file, content: content.substring(0, 1000) + "..." });
            }
        }

        return results;
    }

    private flattenTree(nodes: any[], prefix = ''): string[] {
        let results: string[] = [];
        for (const node of nodes) {
            if (['node_modules', 'target', 'venv', '.git'].includes(node.name)) continue;
            if (!node.isDirectory) {
                results.push(node.path);
            } else if (node.children) {
                results = [...results, ...this.flattenTree(node.children)];
            }
        }
        return results;
    }

    private findFileInTree(nodes: any[], query: string): string | null {
        const q = query.toLowerCase();
        for (const node of nodes) {
            if (['node_modules', 'target', 'venv'].includes(node.name)) continue;

            // Heuristic matching for TS, Rust, Python
            if (!node.isDirectory) {
                const n = node.name.toLowerCase();
                if (n === `${q}.ts` || n === `${q}.tsx` || n === `${q}.rs` || n === `${q}.py`) {
                    return node.path;
                }
            }

            if (node.children) {
                const found = this.findFileInTree(node.children, query);
                if (found) return found;
            }
        }
        return null;
    }
}