import { MockTauriService } from "./tauriBridge";
import { GitLogEntry, Worktree, MergeConflict } from "../types";
import { VirtualFileSystem } from "./virtualFileSystem";

export interface GitStatus {
    isRepo: boolean;
    currentBranch: string;
    isDirty: boolean;
    hasRemote: boolean;
    behind: number;
    ahead: number;
}

export class GitService {
    private static instance: GitService;

    public static getInstance(): GitService {
        if (!GitService.instance) {
            GitService.instance = new GitService();
        }
        return GitService.instance;
    }

    private getRoot(): string | undefined {
        return VirtualFileSystem.getInstance().getRoot() || undefined;
    }

    async getStatus(): Promise<GitStatus> {
        const cwd = this.getRoot();

        if (cwd) {
            const nativeStatus = await MockTauriService.getGitStatus(cwd);
            if (nativeStatus) {
                return {
                    isRepo: nativeStatus.is_repo,
                    currentBranch: nativeStatus.current_branch,
                    isDirty: nativeStatus.is_dirty,
                    hasRemote: nativeStatus.has_remote,
                    behind: nativeStatus.behind,
                    ahead: nativeStatus.ahead
                };
            }
        }

        // Fallback or Empty state
        return { isRepo: false, currentBranch: '', isDirty: false, hasRemote: false, behind: 0, ahead: 0 };
    }

    async initRepo(): Promise<boolean> {
        const cwd = this.getRoot();
        if (!cwd) return false;

        try {
            // Rustification: Use native git init via libgit2
            await MockTauriService.gitInit(cwd);

            await this.ensureGitIgnore();

            // Rustification: Use native add all
            await MockTauriService.gitAddAll(cwd);

            // Rustification: Use native commit
            await MockTauriService.gitCommit(cwd, 'Initial commit by MakerCode');

            return true;
        } catch (e) {
            console.error("Failed to init repo", e);
            return false;
        }
    }

    async ensureGitIgnore() {
        // Basic ignore list for MakerCode projects
        const ignoreContent = `
node_modules
dist
src-tauri/target
.maker/worktrees
.maker/logs
.DS_Store
.env
        `.trim();

        try {
            const vfs = VirtualFileSystem.getInstance();
            const existing = await vfs.readFile('.gitignore');
            if (!existing) throw new Error("Missing");
        } catch {
            console.log("[Git] Creating default .gitignore");
            await VirtualFileSystem.getInstance().writeFile('.gitignore', ignoreContent);
        }
    }

    async commitAll(message: string, overrideCwd?: string): Promise<void> {
        const cwd = overrideCwd || this.getRoot();
        if (!cwd) throw new Error("No active project root");

        try {
            if (!overrideCwd) await this.ensureGitIgnore();

            // Rustification: If we are in the root (standard commit), use the fast Rust bindings
            if (!overrideCwd) {
                await MockTauriService.gitAddAll(cwd);
                await MockTauriService.gitCommit(cwd, message);
            } else {
                // Fallback: Worktree operations might require shell if they are outside the main repo context contextually
                // or if we haven't exposed worktree-specific logic in lib.rs yet.
                // For now, keep shell for worktrees to be safe.
                await MockTauriService.executeShell('git', ['add', '-A'], cwd);
                await MockTauriService.executeShell('git', ['commit', '-m', message], cwd);
            }
        } catch (e: any) {
            console.error("Commit failed", e);
            throw new Error(`Commit failed: ${e.message || e}`);
        }
    }

    async syncRemote(): Promise<string> {
        const cwd = this.getRoot();
        try {
            const pullRes = await MockTauriService.executeShell('git', ['pull', '--rebase'], cwd);
            const pushRes = await MockTauriService.executeShell('git', ['push'], cwd);
            return `Sync Complete.\n${pullRes}\n${pushRes}`;
        } catch (e: any) {
            throw new Error(`Sync failed: ${e.message || e}`);
        }
    }

    async createWorktree(taskId: string, stepId: string): Promise<{ branch: string, path: string }> {
        const cwd = this.getRoot();
        const branchName = `maker/${taskId}/step-${stepId}`;
        const worktreeRelPath = `.maker/worktrees/${stepId}`;

        console.log(`[Git] Creating worktree for ${branchName}`);

        try {
            try {
                await MockTauriService.executeShell('git', ['rev-parse', '--verify', branchName], cwd);
            } catch {
                await MockTauriService.executeShell('git', ['branch', branchName, 'HEAD'], cwd);
            }

            await MockTauriService.executeShell('git', ['worktree', 'add', '--force', worktreeRelPath, branchName], cwd);

            // Return absolute path if we have a root, otherwise relative
            const fullPath = cwd ? `${cwd}/${worktreeRelPath}` : worktreeRelPath;
            return { branch: branchName, path: fullPath };
        } catch (error) {
            console.error("Failed to create worktree:", error);
            throw new Error(`Git Worktree creation failed: ${error}`);
        }
    }

    async cleanupWorktree(path: string, branchName: string) {
        const cwd = this.getRoot();
        console.log(`[Git] Cleaning up worktree ${path}`);
        try {
            await MockTauriService.executeShell('git', ['worktree', 'remove', path, '--force'], cwd);
            await MockTauriService.executeShell('git', ['branch', '-D', branchName], cwd);
        } catch (e) {
            console.warn(`Failed to cleanup worktree ${path}:`, e);
        }
    }

    async listWorktrees(): Promise<Worktree[]> {
        const cwd = this.getRoot();
        try {
            const output = await MockTauriService.executeShell('git', ['worktree', 'list', '--porcelain'], cwd);
            const lines = output.split('\n');
            const worktrees: Worktree[] = [];

            let currentWt: Partial<Worktree> = {};

            for (const line of lines) {
                if (line.startsWith('worktree ')) {
                    if (currentWt.path && currentWt.branch) {
                        worktrees.push(currentWt as Worktree);
                    }
                    currentWt = {
                        path: line.substring(9),
                        id: Math.random().toString(36).substr(2, 5),
                        status: 'active',
                        lastActivity: 'Active'
                    };
                } else if (line.startsWith('branch ')) {
                    currentWt.branch = line.substring(11).replace('refs/heads/', '');
                }
            }
            if (currentWt.path && currentWt.branch) {
                worktrees.push(currentWt as Worktree);
            }

            return worktrees;
        } catch (e) {
            return [];
        }
    }

    async createCheckpoint(message: string, files: string[] = ['.'], overrideCwd?: string) {
        const cwd = overrideCwd || this.getRoot();
        if (!cwd) return;

        console.log(`[Git] Checkpointing in ${cwd}: ${message}`);

        // Optimization: If we are checkpointing everything in the main root, use Rust
        if (!overrideCwd && files.length === 1 && files[0] === '.') {
            await MockTauriService.gitAddAll(cwd);
            await MockTauriService.gitCommit(cwd, `MAKER: ${message}`);
        } else {
            // Specific files or worktrees still need shell
            await MockTauriService.executeShell('git', ['add', ...files], cwd);
            await MockTauriService.executeShell('git', ['commit', '-m', `MAKER: ${message}`], cwd);
        }
    }

    async mergeWorktreeToMain(branchName: string, message: string): Promise<boolean> {
        const cwd = this.getRoot();
        console.log(`[Git] Merging ${branchName} into main...`);
        try {
            await MockTauriService.executeShell('git', ['merge', '--squash', branchName], cwd);
            // Rust commit for the merge commit
            if (cwd) await MockTauriService.gitCommit(cwd, `MAKER Merge: ${message}`);
            return true;
        } catch (e) {
            console.error("Merge failed (likely conflict):", e);
            const status = await MockTauriService.executeShell('git', ['status'], cwd);
            if (status.includes('Unmerged paths')) {
                return false;
            }
            throw e;
        }
    }

    async getConflicts(): Promise<MergeConflict[]> {
        const cwd = this.getRoot();
        try {
            const output = await MockTauriService.executeShell('git', ['diff', '--name-only', '--diff-filter=U'], cwd);
            const files = output.split('\n').filter(line => line.trim() !== '');

            if (files.length === 0) return [];

            const conflicts: MergeConflict[] = [];

            for (const filePath of files) {
                let contentA = "";
                try {
                    contentA = await MockTauriService.executeShell('git', ['show', `:2:${filePath}`], cwd);
                } catch { contentA = "(Deleted in HEAD)"; }

                let contentB = "";
                try {
                    contentB = await MockTauriService.executeShell('git', ['show', `:3:${filePath}`], cwd);
                } catch { contentB = "(Deleted in Incoming)"; }

                const proposal = `// MAKER Semantic Merge Proposal\n// Resolving conflict in ${filePath}\n\n${contentB}`;

                conflicts.push({
                    id: filePath,
                    filePath,
                    branchA: 'Current (HEAD)',
                    branchB: 'Agent Branch',
                    contentA,
                    contentB,
                    aiResolutionProposal: proposal
                });
            }

            return conflicts;
        } catch (error) {
            return [];
        }
    }

    async resolveConflict(conflictId: string, resolutionContent: string): Promise<void> {
        const cwd = this.getRoot();
        console.log(`[Git] Resolving conflict for ${conflictId}`);
        await VirtualFileSystem.getInstance().writeFile(conflictId, resolutionContent);
        await MockTauriService.executeShell('git', ['add', conflictId], cwd);
    }

    async getHistory(): Promise<GitLogEntry[]> {
        const cwd = this.getRoot();
        try {
            const output = await MockTauriService.executeShell('git', ['log', '-n', '20', '--pretty=format:%h|%an|%ar|%s'], cwd);
            if (!output) return [];

            return output.split('\n').filter(l => l).map(line => {
                const [hash, author, date, message] = line.split('|');
                return { hash, author, date, message, stats: { additions: 0, deletions: 0 } };
            });
        } catch {
            return [];
        }
    }
}