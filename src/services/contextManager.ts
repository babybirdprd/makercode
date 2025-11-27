import { VirtualFileSystem } from "./virtualFileSystem";
import { LanguageRegistry } from "./languages/registry";
import { ToolDefinition } from "../types";

export interface ProjectContext {
    fileTree: string;
    manifests: string;
    scoutedFiles: { path: string, content: string }[];
    primaryLanguage: string;
    packageManager: string;
    forbiddenKeywords: string[];
    detectedFrameworks: string[];
    tools: ToolDefinition[];
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

    async getArchitectContext(userPrompt: string, tools: ToolDefinition[]): Promise<ProjectContext> {
        const fileTree = await this.generateFileTree();
        const manifests = await this.getManifests();
        const scoutedFiles = await this.scoutFiles(userPrompt);

        // Deep Analysis of Project Identity
        const identity = await this.analyzeProjectIdentity();

        return {
            fileTree,
            manifests,
            scoutedFiles,
            primaryLanguage: identity.primaryLanguage,
            packageManager: identity.packageManager,
            forbiddenKeywords: identity.forbiddenKeywords,
            detectedFrameworks: identity.frameworks,
            tools
        };
    }

    async getTaskContext(fileTarget: string, dependencies: string[]): Promise<string> {
        let context = "";

        const targetContent = await this.vfs.readFile(fileTarget);
        if (targetContent) {
            context += `\n--- CURRENT CONTENT: ${fileTarget} ---\n${targetContent}\n`;
        }

        for (const depPath of dependencies) {
            const content = await this.vfs.readFile(depPath);
            if (content) {
                context += `\n--- REFERENCE: ${depPath} ---\n${content}\n`;
            }
        }

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
            const tree = await this.vfs.getDirectoryTree();
            const foundFile = this.findFileInTree(tree, symbol);
            if (foundFile) {
                const content = await this.vfs.readFile(foundFile);
                return `\n--- AUTO-DISCOVERED CONTEXT (${foundFile}) ---\n${content}\n`;
            }
        }
        return "";
    }

    private async analyzeProjectIdentity(): Promise<{
        primaryLanguage: string,
        packageManager: string,
        forbiddenKeywords: string[],
        frameworks: string[]
    }> {
        const tree = await this.vfs.getDirectoryTree();
        const files = this.flattenTree(tree);

        // 1. Check Anchors (Strongest Signal)
        const hasPackageJson = files.some(f => f.endsWith('package.json'));
        const hasRequirements = files.some(f => f.endsWith('requirements.txt') || f.endsWith('Pipfile') || f.endsWith('pyproject.toml'));
        const hasCargo = files.some(f => f.endsWith('Cargo.toml'));

        // 2. Check Extension Density (Heuristic Signal)
        let pyCount = 0, tsCount = 0, rsCount = 0;
        files.forEach(f => {
            if (f.endsWith('.py')) pyCount++;
            if (f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.tsx')) tsCount++;
            if (f.endsWith('.rs')) rsCount++;
        });

        // 3. Determine Identity
        let language = "Generic";
        let pkgMgr = "None";
        let forbidden: string[] = [];
        let frameworks: string[] = [];

        // Priority 1: Manifests
        if (hasPackageJson) {
            language = "TypeScript/Node";
            pkgMgr = "npm/yarn";
            forbidden = ["pip", "cargo", "maven", "gradle"];
        } else if (hasRequirements) {
            language = "Python";
            pkgMgr = "pip";
            forbidden = ["npm", "yarn", "node_modules", "cargo"];
        } else if (hasCargo) {
            language = "Rust";
            pkgMgr = "cargo";
            forbidden = ["npm", "pip", "node_modules"];
        }
        // Priority 2: Heuristics (The fix for your use case)
        else {
            if (pyCount > tsCount && pyCount > rsCount) {
                language = "Python";
                pkgMgr = "pip (assumed)";
                forbidden = ["npm", "yarn", "node_modules", "cargo", "package.json"];
            } else if (tsCount > pyCount) {
                language = "TypeScript/Node";
                pkgMgr = "npm (assumed)";
                forbidden = ["pip", "cargo"];
            } else if (rsCount > 0) {
                language = "Rust";
                pkgMgr = "cargo (assumed)";
                forbidden = ["npm", "pip"];
            }
        }

        return {
            primaryLanguage: language,
            packageManager: pkgMgr,
            forbiddenKeywords: forbidden,
            frameworks
        };
    }

    private async generateFileTree(): Promise<string> {
        const tree = await this.vfs.getDirectoryTree();
        return this.renderTree(tree);
    }

    private renderTree(nodes: any[], depth = 0): string {
        let output = "";
        const indent = "  ".repeat(depth);
        for (const node of nodes) {
            if (['node_modules', 'target', 'venv', '.git', '.maker', '__pycache__'].includes(node.name)) continue;
            output += `${indent}${node.name}${node.isDirectory ? '/' : ''}\n`;
            if (node.children) {
                output += this.renderTree(node.children, depth + 1);
            }
        }
        return output;
    }

    private async getManifests(): Promise<string> {
        let output = "";
        const manifestNames = this.langRegistry.getAllManifests();
        const uniqueManifests = [...new Set(manifestNames)];
        for (const name of uniqueManifests) {
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
            if (['node_modules', 'target', 'venv', '.git', '.maker', '__pycache__'].includes(node.name)) continue;
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