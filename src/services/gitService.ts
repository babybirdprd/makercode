import { MockTauriService } from "./tauriBridge";
import { GitLogEntry, Worktree, MergeConflict } from "../types";

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

    async getStatus(): Promise<GitStatus> {
        try {
            try {
                await MockTauriService.executeShell('git', ['rev-parse', '--is-inside-work-tree']);
            } catch {
                return { isRepo: false, currentBranch: '', isDirty: false, hasRemote: false, behind: 0, ahead: 0 };
            }

            const branch = (await MockTauriService.executeShell('git', ['branch', '--show-current'])).trim();
            const statusOutput = await MockTauriService.executeShell('git', ['status', '--porcelain']);
            const isDirty = statusOutput.trim().length > 0;

            let hasRemote = false;
            try {
                const remote = await MockTauriService.executeShell('git', ['remote']);
                hasRemote = remote.trim().length > 0;
            } catch { }

            let ahead = 0;
            let behind = 0;
            if (hasRemote) {
                try {
                    await MockTauriService.executeShell('git', ['fetch', '--dry-run']);
                    const count = await MockTauriService.executeShell('git', ['rev-list', '--left-right', '--count', `${branch}...origin/${branch}`]);
                    const parts = count.trim().split(/\s+/);
                    if (parts.length === 2) {
                        ahead = parseInt(parts[0]);
                        behind = parseInt(parts[1]);
                    }
                } catch { }
            }

            return { isRepo: true, currentBranch: branch, isDirty, hasRemote, behind, ahead };
        } catch (e) {
            console.error("[Git] Status check failed", e);
            return { isRepo: false, currentBranch: '', isDirty: false, hasRemote: false, behind: 0, ahead: 0 };
        }
    }

    async initRepo(): Promise<boolean> {
        try {
            await MockTauriService.executeShell('git', ['init']);
            await this.ensureGitIgnore(); // Ensure we don't track garbage
            await MockTauriService.executeShell('git', ['branch', '-M', 'main']);
            await MockTauriService.executeShell('git', ['add', '.']);
            await MockTauriService.executeShell('git', ['commit', '--allow-empty', '-m', 'Initial commit by MakerCode']);
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
.DS_Store
.env
        `.trim();

        // Check if exists, if not write it
        try {
            await MockTauriService.readFile('.gitignore');
        } catch {
            console.log("[Git] Creating default .gitignore");
            await MockTauriService.writeFile('.gitignore', ignoreContent);
        }
    }

    async commitAll(message: string): Promise<void> {
        try {
            // Ensure ignore file exists to prevent adding 'target' folder issues
            await this.ensureGitIgnore();

            // Use -A (all) instead of . to handle deletions/moves better and usually avoids the ignore warning
            await MockTauriService.executeShell('git', ['add', '-A']);
            await MockTauriService.executeShell('git', ['commit', '-m', message]);
        } catch (e: any) {
            // Fallback: If add -A failed, try adding just the current directory non-recursively or handle the error
            console.error("Commit failed", e);
            throw new Error(`Commit failed: ${e.message || e}`);
        }
    }

    async syncRemote(): Promise<string> {
        try {
            const pullRes = await MockTauriService.executeShell('git', ['pull', '--rebase']);
            const pushRes = await MockTauriService.executeShell('git', ['push']);
            return `Sync Complete.\n${pullRes}\n${pushRes}`;
        } catch (e: any) {
            throw new Error(`Sync failed: ${e.message || e}`);
        }
    }

    async createWorktree(taskId: string, stepId: string): Promise<{ branch: string, path: string }> {
        const branchName = `maker/${taskId}/step-${stepId}`;
        const worktreeRelPath = `.maker/worktrees/${stepId}`;

        console.log(`[Git] Creating worktree for ${branchName}`);

        try {
            try {
                await MockTauriService.executeShell('git', ['rev-parse', '--verify', branchName]);
            } catch {
                await MockTauriService.executeShell('git', ['branch', branchName, 'HEAD']);
            }

            await MockTauriService.executeShell('git', ['worktree', 'add', '--force', worktreeRelPath, branchName]);

            return { branch: branchName, path: worktreeRelPath };
        } catch (error) {
            console.error("Failed to create worktree:", error);
            throw new Error(`Git Worktree creation failed: ${error}`);
        }
    }

    async cleanupWorktree(path: string, branchName: string) {
        console.log(`[Git] Cleaning up worktree ${path}`);
        try {
            await MockTauriService.executeShell('git', ['worktree', 'remove', path, '--force']);
            await MockTauriService.executeShell('git', ['branch', '-D', branchName]);
        } catch (e) {
            console.warn(`Failed to cleanup worktree ${path}:`, e);
        }
    }

    async listWorktrees(): Promise<Worktree[]> {
        try {
            const output = await MockTauriService.executeShell('git', ['worktree', 'list', '--porcelain']);
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

    async createCheckpoint(message: string, files: string[] = ['.']) {
        console.log(`[Git] Checkpointing: ${message}`);
        await MockTauriService.executeShell('git', ['add', ...files]);
        await MockTauriService.executeShell('git', ['commit', '-m', `MAKER: ${message}`]);
    }

    async mergeWorktreeToMain(branchName: string, message: string): Promise<boolean> {
        console.log(`[Git] Merging ${branchName} into main...`);
        try {
            await MockTauriService.executeShell('git', ['merge', '--squash', branchName]);
            await MockTauriService.executeShell('git', ['commit', '-m', `MAKER Merge: ${message}`]);
            return true;
        } catch (e) {
            console.error("Merge failed (likely conflict):", e);
            const status = await MockTauriService.executeShell('git', ['status']);
            if (status.includes('Unmerged paths')) {
                return false;
            }
            throw e;
        }
    }

    async getConflicts(): Promise<MergeConflict[]> {
        try {
            const output = await MockTauriService.executeShell('git', ['diff', '--name-only', '--diff-filter=U']);
            const files = output.split('\n').filter(line => line.trim() !== '');

            if (files.length === 0) return [];

            const conflicts: MergeConflict[] = [];

            for (const filePath of files) {
                let contentA = "";
                try {
                    contentA = await MockTauriService.executeShell('git', ['show', `:2:${filePath}`]);
                } catch { contentA = "(Deleted in HEAD)"; }

                let contentB = "";
                try {
                    contentB = await MockTauriService.executeShell('git', ['show', `:3:${filePath}`]);
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
        console.log(`[Git] Resolving conflict for ${conflictId}`);
        await MockTauriService.writeFile(conflictId, resolutionContent);
        await MockTauriService.executeShell('git', ['add', conflictId]);
    }

    async getHistory(): Promise<GitLogEntry[]> {
        try {
            const output = await MockTauriService.executeShell('git', ['log', '-n', '20', '--pretty=format:%h|%an|%ar|%s']);
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