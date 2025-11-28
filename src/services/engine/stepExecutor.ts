import { SubTask, AgentProfile, MakerConfig, AgentStatus, ExecutionTrace } from "../../types";
import { GitService } from "../gitService";
import { VirtualFileSystem } from "../virtualFileSystem";
import { ToolService } from "../toolService";
import { LanguageRegistry } from "../languages/registry";
import { ContextManager } from "../contextManager";
import { VotingService } from "./votingService";
import { DecompositionService } from "./decompositionService";
import { LLMClient } from "../llm";
import { MockTauriService } from "../tauriBridge";
import { Prompts } from "../prompts";

export class StepExecutor {
    private git: GitService;
    private vfs: VirtualFileSystem;
    private toolService: ToolService;
    private langRegistry: LanguageRegistry;
    private contextManager: ContextManager;

    constructor(
        private llm: LLMClient | null,
        private voter: VotingService,
        private decomposer: DecompositionService,
        private config: MakerConfig,
        private taskId: string,
        private totalSteps: number, // Injected for Adaptive Checkpointing
        private onUpdate: (update: Partial<SubTask>) => void
    ) {
        this.git = GitService.getInstance();
        this.vfs = VirtualFileSystem.getInstance();
        this.toolService = ToolService.getInstance();
        this.langRegistry = LanguageRegistry.getInstance();
        this.contextManager = ContextManager.getInstance();
    }

    async execute(step: SubTask, agent: AgentProfile, allSteps: SubTask[]): Promise<void> {
        let worktreeInfo: { branch: string, path: string } | null = null;

        try {
            // 1. Worktree Setup
            if (this.config.useGitWorktrees) {
                this.onUpdate({ status: AgentStatus.IDLE });
                try {
                    worktreeInfo = await this.git.createWorktree(this.taskId, step.id);
                    this.onUpdate({
                        status: AgentStatus.ANALYZING,
                        gitBranch: worktreeInfo.branch,
                        worktreePath: worktreeInfo.path
                    });
                } catch (e: any) {
                    console.error("[StepExecutor] Worktree Creation Failed:", e);
                    this.onUpdate({ status: AgentStatus.FAILED, logs: [`Worktree failed: ${e.message}`] });
                    return;
                }
            } else {
                this.onUpdate({ status: AgentStatus.ANALYZING });
            }

            // 2. Branch: Tool Execution vs Code Generation
            if (step.toolCall) {
                await this.handleToolStep(step, worktreeInfo);
            } else {
                await this.handleCodingStep(step, agent, allSteps, worktreeInfo);
            }

            this.onUpdate({ status: AgentStatus.PASSED });

        } catch (e: any) {
            console.error(`[StepExecutor] Step Failed:`, e);
            this.onUpdate({
                status: AgentStatus.FAILED,
                logs: [...(step.logs || []), e.message || "Unknown error"]
            });
        } finally {
            // Cleanup Worktree
            if (worktreeInfo && this.config.useGitWorktrees) {
                await this.git.cleanupWorktree(worktreeInfo.path, worktreeInfo.branch);
            }
        }
    }

    private async handleToolStep(step: SubTask, worktreeInfo: { branch: string, path: string } | null) {
        this.onUpdate({ status: AgentStatus.EXECUTING });

        const allTools = this.toolService.getAvailableTools(this.config.tools || []);
        const toolDef = allTools.find(t => t.name === step.toolCall?.toolName);

        if (!toolDef) {
            throw new Error(`Tool '${step.toolCall?.toolName}' not found in registry.`);
        }

        const cwd = worktreeInfo ? worktreeInfo.path : this.vfs.getRoot() || ".";

        // Explicitly ignore make_directory as a "writable" tool to prevent overwriting dirs with text
        const isReadOnly = ['read_file', 'ls', 'grep', 'make_directory'].includes(toolDef.name);
        const isDirectory = step.fileTarget.endsWith('/') || step.fileTarget === '.' || step.fileTarget === './';
        const outputFile = !isReadOnly && !isDirectory && step.fileTarget ? step.fileTarget : undefined;

        if (step.toolCall) {
            const output = await this.toolService.executeTool(toolDef, step.toolCall, cwd, outputFile);

            this.onUpdate({
                status: AgentStatus.PASSED,
                logs: [output]
            });

            if (this.config.useGitWorktrees && worktreeInfo) {
                const didCommit = await this.git.createCheckpoint(step.description, ['.'], worktreeInfo.path);
                if (didCommit) {
                    await this.git.mergeWorktreeToMain(worktreeInfo.branch, `Executed Tool: ${step.description}`);
                }
            }
            // Direct Mode: Tool outputs are usually ephemeral or file writes handled by tool itself.
            // We do not force a commit for tools in direct mode unless it's a big task, handled by handleCodingStep logic usually.
            // But for consistency, let's apply adaptive logic here too? 
            // Actually tools like 'ls' shouldn't commit. 'execute_command' might.
            // For safety, we skip auto-commit for tools in Direct Mode unless explicitly requested.
        }
    }

    private async handleCodingStep(step: SubTask, agent: AgentProfile, allSteps: SubTask[], worktreeInfo: { branch: string, path: string } | null) {
        // A. Risk Assessment
        const riskAssessment = await this.assessRisk(step, agent);
        this.onUpdate({
            status: AgentStatus.THINKING,
            riskScore: riskAssessment.score,
            riskReason: riskAssessment.reason
        });

        // B. Context Gathering
        const dependencyFiles = allSteps
            .filter(s => step.dependencies.includes(s.id))
            .map(s => s.id);

        let context = await this.contextManager.getTaskContext(step.fileTarget, dependencyFiles, allSteps);
        const fullContext = await this.contextManager.getArchitectContext(step.description, []);

        // C. Generation / Voting
        const shouldVote = riskAssessment.score > Math.min(this.config.riskThreshold, agent.riskTolerance + 0.3);
        let content = "";
        let traceData: ExecutionTrace | undefined;

        if (shouldVote && this.llm) {
            this.onUpdate({ status: AgentStatus.VOTING });
            const result = await this.voter.performVoting(step, agent, context, this.config.agentProfiles,
                async (a) => {
                    const res = await this.generateCode(step, a, context, fullContext);
                    return res.content;
                }
            );
            this.onUpdate({ status: AgentStatus.VOTING, candidates: result.candidates });

            if (!result.isConsensus || !result.winner) {
                const fallback = result.candidates.find(c => c.agentName === agent.name);
                content = fallback?.content || "";
                if (!content) throw new Error("Consensus failed.");
            } else {
                content = result.winner;
            }
        } else {
            this.onUpdate({ status: AgentStatus.SKIPPED_VOTE });
            const genResult = await this.generateCode(step, agent, context, fullContext);
            content = genResult.content;
            traceData = genResult.trace;
        }

        // D. Red Flag Self-Correction
        const redFlagResult = await this.handleRedFlags(step, agent, context, fullContext, content, traceData);
        content = redFlagResult.content;
        traceData = redFlagResult.trace;

        this.onUpdate({ status: AgentStatus.EXECUTING, trace: traceData });

        // E. Writing to Disk
        let targetPath = step.fileTarget;
        const root = this.vfs.getRoot();

        if (worktreeInfo) {
            targetPath = `${worktreeInfo.path}/${step.fileTarget}`;
        } else if (root) {
            const cleanRel = step.fileTarget.replace(/^\.\//, '');
            targetPath = `${root}/${cleanRel}`;
        }

        const dir = targetPath.substring(0, targetPath.lastIndexOf('/'));
        if (dir && dir !== '.') await MockTauriService.mkdir(dir);

        if (!worktreeInfo && root) {
            await this.vfs.writeFile(step.fileTarget, content);
        } else {
            await MockTauriService.writeFile(targetPath, content);
        }

        // F. Linter Loop
        await this.handleLinting(step, agent, context, fullContext, targetPath, worktreeInfo, content);

        // G. Checkpoint (Adaptive)
        this.onUpdate({ status: AgentStatus.CHECKPOINTING });

        if (this.config.useGitWorktrees && worktreeInfo) {
            // Worktree Mode: Always commit to worktree branch to save progress
            const didCommit = await this.git.createCheckpoint(step.description, ['.'], worktreeInfo.path);
            if (didCommit) {
                this.onUpdate({ status: AgentStatus.MERGING });
                // We always merge worktrees back to main to persist the step
                const mergeSuccess = await this.git.mergeWorktreeToMain(worktreeInfo.branch, step.description);
                if (!mergeSuccess) throw new Error("Merge Conflict.");
            }
        } else {
            // Direct Mode: Adaptive Checkpointing
            // If task is small (< 3 steps), skip per-step commits. Engine will do one final commit.
            // If task is large, commit every step for safety.
            if (this.totalSteps >= 3) {
                await this.git.createCheckpoint(step.description, [step.fileTarget]);
            } else {
                // Skip commit, just log
                console.log(`[StepExecutor] Skipping checkpoint for micro-task step ${step.id}`);
            }
        }
    }

    // ... [handleRedFlags, handleLinting, generateCode, assessRisk methods remain same as previous step] ...
    private async handleRedFlags(
        step: SubTask,
        agent: AgentProfile,
        context: string,
        fullContext: any,
        initialContent: string,
        initialTrace?: ExecutionTrace
    ): Promise<{ content: string, trace?: ExecutionTrace }> {
        let content = initialContent;
        let trace = initialTrace;
        let redFlagAttempts = 0;
        const maxRedFlagRetries = 2;
        let currentRedFlags: string[] = [];

        do {
            currentRedFlags = [];
            if (fullContext.primaryLanguage === 'python' && content.includes('npm install')) {
                currentRedFlags.push("Hallucination: Detected 'npm install' in a Python project. Use pip or poetry.");
            }
            if (fullContext.primaryLanguage === 'rust' && content.includes('pip install')) {
                currentRedFlags.push("Hallucination: Detected 'pip install' in a Rust project. Use cargo.");
            }
            if (content.length > 50000) {
                currentRedFlags.push("Output too large (>50k chars). Summarize or split.");
            }

            if (currentRedFlags.length > 0) {
                if (redFlagAttempts < maxRedFlagRetries) {
                    const feedback = `CRITICAL SYSTEM WARNING - RED FLAGS DETECTED:\n${currentRedFlags.join('\n')}\n\nFIX THESE ISSUES IMMEDIATELY.`;

                    this.onUpdate({
                        status: AgentStatus.THINKING,
                        logs: [...(step.logs || []), `[Self-Correction] Red Flags: ${currentRedFlags.join(', ')}. Retrying (${redFlagAttempts + 1}/${maxRedFlagRetries})...`]
                    });

                    const retryResult = await this.generateCode(step, agent, context, fullContext, feedback);
                    content = retryResult.content;
                    trace = retryResult.trace;
                    redFlagAttempts++;
                } else {
                    if (trace) trace.redFlags = currentRedFlags;
                    throw new Error(`Red Flags Persisted after retries: ${currentRedFlags.join(', ')}`);
                }
            }
        } while (currentRedFlags.length > 0 && redFlagAttempts <= maxRedFlagRetries);

        return { content, trace };
    }

    private async handleLinting(
        step: SubTask,
        agent: AgentProfile,
        context: string,
        fullContext: any,
        targetPath: string,
        worktreeInfo: { branch: string, path: string } | null,
        initialContent: string
    ): Promise<void> {
        const provider = this.langRegistry.getProvider(targetPath);
        let lintAttempts = 0;
        const maxLintAttempts = this.config.autoFixLinter ? 2 : 0;
        let isLintValid = false;
        let content = initialContent;

        while (!isLintValid) {
            const lintErrors = provider ? await provider.lintFile(targetPath, this.vfs.getRoot() || ".") : [];

            if (lintErrors.length === 0) {
                isLintValid = true;
                break;
            }

            if (lintErrors.some(e => e.includes('SECURITY:'))) {
                throw new Error(`Security Check Failed: ${lintErrors.find(e => e.includes('SECURITY:'))}`);
            }

            if (lintAttempts < maxLintAttempts) {
                const errorMsg = lintErrors[0];
                const expandedContext = await this.contextManager.expandContext(errorMsg);
                if (expandedContext) context += expandedContext;

                this.onUpdate({
                    status: AgentStatus.EXECUTING,
                    logs: [...(step.logs || []), `[AutoFix] ${provider?.id} Linter failed: ${errorMsg}. Retrying...`]
                });

                const retryResult = await this.generateCode(step, agent, context, fullContext, lintErrors.join('\n'));
                content = retryResult.content;

                if (!worktreeInfo && this.vfs.getRoot()) {
                    await this.vfs.writeFile(step.fileTarget, content);
                } else {
                    await MockTauriService.writeFile(targetPath, content);
                }
                lintAttempts++;
            } else {
                console.log("Triggering Re-plan due to persistent lint errors...");
                const newSteps = await this.decomposer.replan(step, lintErrors.join('\n'));

                if (newSteps.length > 0) {
                    throw new Error(`__REPLAN_REQUIRED__:${JSON.stringify(newSteps)}`);
                } else {
                    throw new Error(`${provider?.id || 'System'} Linter validation failed: ${lintErrors[0]}`);
                }
            }
        }
    }

    private async generateCode(step: SubTask, agent: AgentProfile, context: string, fullContext: any, feedback?: string): Promise<{ content: string, trace: ExecutionTrace }> {
        if (!this.llm) return { content: `// Mock Content`, trace: {} as any };
        try {
            const ext = step.fileTarget.split('.').pop() || "text";
            const langMap: Record<string, string> = {
                'ts': 'TypeScript', 'tsx': 'TypeScript/React', 'js': 'JavaScript',
                'py': 'Python', 'rs': 'Rust', 'md': 'Markdown', 'json': 'JSON'
            };
            const language = langMap[ext] || "Code";

            const roleName = step.role || agent.role;
            const roleDesc = step.roleDescription || agent.name;

            const systemPrompt = Prompts.MICRO_ROLE_SYSTEM(roleName, roleDesc, language, fullContext);

            const userPrompt = `
                DESCRIPTION: ${step.description}
                TARGET FILE: ${step.fileTarget}
                --- RELEVANT CODEBASE CONTEXT ---
                ${context}
                ${feedback ? `--- FEEDBACK FROM PREVIOUS ATTEMPT (MUST FIX) ---\n${feedback}` : ''}
            `;

            const response = await this.llm.generate(systemPrompt, userPrompt);
            let text = response.text || "";
            if (text.startsWith('```')) text = text.replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '');

            const trace: ExecutionTrace = {
                agentId: agent.id,
                agentPersona: roleName,
                timestamp: Date.now(),
                finalPrompt: systemPrompt + "\n\n" + userPrompt,
                rawResponse: response.text,
                redFlags: []
            };

            return { content: text, trace };
        } catch (e) {
            console.warn("AI Generation failed:", e);
            return { content: "// Generation Failed", trace: {} as any };
        }
    }

    private async assessRisk(step: SubTask, agent: AgentProfile): Promise<{ score: number, reason: string }> {
        const isLogic = step.description.toLowerCase().includes("implement") || step.description.toLowerCase().includes("logic");
        let baseScore = isLogic ? 0.85 : 0.2;
        if (agent.role === 'Security' && (step.description.includes('Auth') || step.description.includes('JWT'))) {
            baseScore += 0.3;
            return { score: Math.min(0.99, baseScore), reason: `${agent.name} flagged security critical component` };
        }
        return { score: baseScore, reason: isLogic ? "Business Logic" : "Boilerplate/Scaffold" };
    }
}