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

    // Singleton pattern to ensure we don't have multiple services fighting over git lock
    public static getInstance(): GitService {
        if (!GitService.instance) {
            GitService.instance = new GitService();
        }
        return GitService.instance;
    }

    /**
     * HEALTH & STATUS
     * Acts as the "Internal Client" heartbeat.
     */
    async getStatus(): Promise<GitStatus> {
        try {
            // 1. Check if Repo
            try {
                await MockTauriService.executeShell('git', ['rev-parse', '--is-inside-work-tree']);
            } catch {
                return { isRepo: false, currentBranch: '', isDirty: false, hasRemote: false, behind: 0, ahead: 0 };
            }

            // 2. Get Branch
            const branch = (await MockTauriService.executeShell('git', ['branch', '--show-current'])).trim();

            // 3. Check Dirty State (Modified files not committed)
            // --porcelain returns empty string if clean
            const statusOutput = await MockTauriService.executeShell('git', ['status', '--porcelain']);
            const isDirty = statusOutput.trim().length > 0;

            // 4. Check Remote
            let hasRemote = false;
            try {
                const remote = await MockTauriService.executeShell('git', ['remote']);
                hasRemote = remote.trim().length > 0;
            } catch { }

            // 5. Check Ahead/Behind (if remote exists)
            let ahead = 0;
            let behind = 0;
            if (hasRemote) {
                try {
                    // Ensure we have latest info without modifying working tree
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
            await MockTauriService.executeShell('git', ['branch', '-M', 'main']);
            // Create initial empty commit so we have a HEAD
            await MockTauriService.executeShell('git', ['commit', '--allow-empty', '-m', 'Initial commit by MakerCode']);
            return true;
        } catch (e) {
            console.error("Failed to init repo", e);
            return false;
        }
    }

    /**
     * EXTERNAL INTEGRATION
     * Syncs the Internal Client with the External Source of Truth (GitHub/GitLab)
     */
    async syncRemote(): Promise<string> {
        try {
            // 1. Pull Rebase (Keep history linear)
            const pullRes = await MockTauriService.executeShell('git', ['pull', '--rebase']);

            // 2. Push
            const pushRes = await MockTauriService.executeShell('git', ['push']);

            return `Sync Complete.\n${pullRes}\n${pushRes}`;
        } catch (e: any) {
            throw new Error(`Sync failed: ${e.message || e}`);
        }
    }

    /**
     * WORKTREE MANAGEMENT (ISOLATION)
     * Creates an isolated environment for a specific agent to work in.
     */
    async createWorktree(taskId: string, stepId: string): Promise<{ branch: string, path: string }> {
        const branchName = `maker/${taskId}/step-${stepId}`;
        const worktreeRelPath = `.maker/worktrees/${stepId}`;

        console.log(`[Git] Creating worktree for ${branchName}`);

        try {
            // 1. Create branch based on HEAD
            // Check if branch exists first
            try {
                await MockTauriService.executeShell('git', ['rev-parse', '--verify', branchName]);
            } catch {
                await MockTauriService.executeShell('git', ['branch', branchName, 'HEAD']);
            }

            // 2. Add Worktree
            // We use --force because sometimes the index lock lingers in these rapid AI environments
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
            // Remove worktree folder via git command
            await MockTauriService.executeShell('git', ['worktree', 'remove', path, '--force']);

            // Delete branch (assuming merged)
            // We use -D to force delete even if not fully merged (agent failure scenario)
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

    /**
     * CHECKPOINT SYSTEM
     * Commits the changes to the main history.
     */
    async createCheckpoint(message: string, files: string[] = ['.']) {
        console.log(`[Git] Checkpointing: ${message}`);
        // Add specific files or all
        await MockTauriService.executeShell('git', ['add', ...files]);
        await MockTauriService.executeShell('git', ['commit', '-m', `MAKER: ${message}`]);
    }

    async mergeWorktreeToMain(branchName: string, message: string): Promise<boolean> {
        console.log(`[Git] Merging ${branchName} into main...`);
        try {
            // Merge squash to keep history clean
            await MockTauriService.executeShell('git', ['merge', '--squash', branchName]);
            await MockTauriService.executeShell('git', ['commit', '-m', `MAKER Merge: ${message}`]);
            return true;
        } catch (e) {
            console.error("Merge failed (likely conflict):", e);
            const status = await MockTauriService.executeShell('git', ['status']);
            if (status.includes('Unmerged paths')) {
                return false; // Real conflict
            }
            throw e;
        }
    }

    /**
     * CONFLICT MANAGEMENT
     */
    async getConflicts(): Promise<MergeConflict[]> {
        try {
            const output = await MockTauriService.executeShell('git', ['diff', '--name-only', '--diff-filter=U']);
            const files = output.split('\n').filter(line => line.trim() !== '');

            if (files.length === 0) return [];

            const conflicts: MergeConflict[] = [];

            for (const filePath of files) {
                // Get HEAD version
                let contentA = "";
                try {
                    contentA = await MockTauriService.executeShell('git', ['show', `:2:${filePath}`]);
                } catch { contentA = "(Deleted in HEAD)"; }

                // Get Incoming version
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