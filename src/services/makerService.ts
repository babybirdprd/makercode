import { Type } from "@google/genai";
import { SubTask, AgentStatus, TaskStatus, MakerConfig, AgentProfile, ExecutionTrace } from "../types";
import { MockTauriService } from "./tauriBridge";
import { GitService } from "./gitService";
import { VirtualFileSystem } from "./virtualFileSystem";
import { LLMFactory, LLMClient } from "./llm";
import { ContextManager } from "./contextManager";
import { LanguageRegistry } from "./languages/registry";
import { DecompositionService } from "./engine/decompositionService";
import { VotingService } from "./engine/votingService";
import { ToolService } from "./toolService";
import { Prompts } from "./prompts";

export class MakerEngine {
    private llm: LLMClient | null = null;
    private git: GitService;
    private contextManager: ContextManager;
    private langRegistry: LanguageRegistry;
    private toolService: ToolService;

    private decomposer!: DecompositionService;
    private voter!: VotingService;

    private config: MakerConfig = {
        llmProvider: 'gemini',
        geminiApiKey: "",
        openaiBaseUrl: "https://api.openai.com/v1",
        openaiModel: "gpt-4o",
        riskThreshold: 0.6,
        maxAgents: 3,
        autoFixLinter: true,
        useGitWorktrees: false,
        maxParallelism: 1,
        agentProfiles: [
            { id: "1", name: "Atlas", role: "Architect", riskTolerance: 0.3, color: "text-purple-400", model: "gemini-2.0-flash" },
            { id: "2", name: "Bolt", role: "Developer", riskTolerance: 0.7, color: "text-blue-400", model: "gemini-2.0-flash" },
            { id: "3", name: "Cipher", role: "Security", riskTolerance: 0.1, color: "text-red-400", model: "gemini-2.0-flash" },
            { id: "4", name: "Dash", role: "QA", riskTolerance: 0.4, color: "text-green-400", model: "gemini-2.0-flash" }
        ],
        tools: []
    };

    private state: TaskStatus = {
        taskId: "init",
        originalPrompt: "",
        decomposition: [],
        totalSteps: 0,
        completedSteps: 0,
        errorCount: 0,
        activeWorkers: 0,
        conflicts: [],
        isPlanning: false
    };

    private listeners: ((state: TaskStatus) => void)[] = [];
    private isRunning: boolean = false;

    constructor() {
        this.git = GitService.getInstance();
        this.contextManager = ContextManager.getInstance();
        this.langRegistry = LanguageRegistry.getInstance();
        this.toolService = ToolService.getInstance();

        const savedKey = typeof localStorage !== 'undefined' ? localStorage.getItem('MAKER_API_KEY') : "";
        if (savedKey) {
            this.config.geminiApiKey = savedKey;
            this.llm = LLMFactory.create(this.config);
        }

        this.initSubServices();
    }

    private initSubServices() {
        this.decomposer = new DecompositionService(this.llm, this.contextManager);
        this.voter = new VotingService(this.llm);
    }

    subscribe(listener: (state: TaskStatus) => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    updateConfig(newConfig: Partial<MakerConfig>) {
        console.log("[MakerEngine] updateConfig called. Keys present:",
            newConfig.openaiApiKey ? "Yes (OpenAI)" : "No",
            newConfig.geminiApiKey ? "Yes (Gemini)" : "No"
        );

        const prevKey = this.config.geminiApiKey;
        const prevProvider = this.config.llmProvider;
        const prevUrl = this.config.openaiBaseUrl;
        const prevOpenAiKey = this.config.openaiApiKey;

        this.config = { ...this.config, ...newConfig };

        if (
            newConfig.geminiApiKey !== prevKey ||
            newConfig.llmProvider !== prevProvider ||
            newConfig.openaiBaseUrl !== prevUrl ||
            newConfig.openaiApiKey !== prevOpenAiKey
        ) {
            console.log("[MAKER] Re-initializing LLM Client...");
            this.llm = LLMFactory.create(this.config);
            this.initSubServices();

            if (typeof localStorage !== 'undefined') {
                if (this.config.geminiApiKey) localStorage.setItem('MAKER_API_KEY', this.config.geminiApiKey);
            }
        }
        this.notify();
    }

    private notify() {
        this.listeners.forEach(l => l(this.state));
    }

    async startTask(prompt: string) {
        this.state = {
            taskId: Date.now().toString(),
            originalPrompt: prompt,
            decomposition: [],
            totalSteps: 0,
            completedSteps: 0,
            errorCount: 0,
            activeWorkers: 0,
            conflicts: [],
            isPlanning: true
        };
        this.notify();

        try {
            const status = await this.git.getStatus();
            if (!status.isRepo) await this.git.initRepo();
            if (status.isDirty) await this.git.createCheckpoint("Auto-Checkpoint before Task Start");

            // Combine System Tools + User Tools
            const allTools = this.toolService.getAvailableTools(this.config.tools || []);
            const decomposition = await this.decomposer.decompose(prompt, allTools);

            this.state.decomposition = decomposition.map(d => ({
                id: d.id || Math.random().toString(36).substring(2, 10),
                description: d.description || "Unspecified Task",
                fileTarget: d.fileTarget || "./",
                status: AgentStatus.PLANNING,
                attempts: 0,
                votes: 0,
                riskScore: 0,
                logs: [],
                dependencies: d.dependencies || [],
                riskReason: d.riskReason,
                role: d.role,
                roleDescription: d.roleDescription,
                candidates: [],
                toolCall: d.toolCall
            }));
            this.state.totalSteps = this.state.decomposition.length;
            this.notify();

        } catch (e: any) {
            console.error("[MakerEngine] Start Task Failed:", e);

            this.state.errorCount++;
            this.state.decomposition = [{
                id: "error",
                description: "Decomposition Failed: " + e.message,
                fileTarget: "error.log",
                status: AgentStatus.FAILED,
                attempts: 1,
                votes: 0,
                riskScore: 1,
                logs: [e.message],
                dependencies: []
            }];
            this.notify();
        }
    }

    async executePlan() {
        this.state.isPlanning = false;
        this.state.decomposition = this.state.decomposition.map(s => ({ ...s, status: AgentStatus.QUEUED }));
        this.notify();
        this.isRunning = true;
        this.processQueue();
    }

    private async processQueue() {
        if (!this.isRunning) return;

        const allComplete = this.state.decomposition.every(s => s.status === AgentStatus.PASSED || s.status === AgentStatus.FAILED);
        if (allComplete) {
            this.isRunning = false;
            return;
        }

        const completedIds = new Set(this.state.decomposition.filter(s => s.status === AgentStatus.PASSED).map(s => s.id));
        const runnableIndices = this.state.decomposition
            .map((step, index) => ({ step, index }))
            .filter(({ step }) => step.status === AgentStatus.QUEUED && step.dependencies.every(depId => completedIds.has(depId)))
            .map(item => item.index);

        while (this.state.activeWorkers < this.config.maxParallelism && runnableIndices.length > 0) {
            const index = runnableIndices.shift();
            if (index !== undefined) {
                this.state.activeWorkers++;
                const assignedAgent = this.config.agentProfiles[index % this.config.agentProfiles.length];
                this.updateStepStatus(index, AgentStatus.QUEUED, { assignedAgentId: assignedAgent.id });
                this.notify();
                this.executeStep(index, assignedAgent).then(() => {
                    this.state.activeWorkers--;
                    this.processQueue();
                });
            }
        }
    }

    private async executeStep(index: number, agent: AgentProfile) {
        const step = this.state.decomposition[index];
        let worktreeInfo: { branch: string, path: string } | null = null;
        const vfs = VirtualFileSystem.getInstance();

        try {
            if (this.config.useGitWorktrees) {
                this.updateStepStatus(index, AgentStatus.IDLE);
                try {
                    worktreeInfo = await this.git.createWorktree(this.state.taskId, step.id);
                    this.updateStepStatus(index, AgentStatus.ANALYZING, { gitBranch: worktreeInfo.branch, worktreePath: worktreeInfo.path });
                } catch (e: any) {
                    console.error("[MakerEngine] Worktree Creation Failed:", e);
                    this.updateStepStatus(index, AgentStatus.FAILED, { logs: [`Worktree failed: ${e.message}`] });
                    return;
                }
            } else {
                this.updateStepStatus(index, AgentStatus.ANALYZING);
            }

            if (step.toolCall) {
                this.updateStepStatus(index, AgentStatus.EXECUTING);
                const allTools = this.toolService.getAvailableTools(this.config.tools || []);
                const toolDef = allTools.find(t => t.name === step.toolCall?.toolName);

                if (!toolDef) {
                    throw new Error(`Tool '${step.toolCall.toolName}' not found in registry.`);
                }

                const cwd = worktreeInfo ? worktreeInfo.path : vfs.getRoot() || ".";

                // FIX: Do not write tool output to file if it's a read-only tool
                const isReadOnly = ['read_file', 'ls', 'grep'].includes(toolDef.name);
                const isDirectory = step.fileTarget.endsWith('/') || step.fileTarget === '.' || step.fileTarget === './';
                const outputFile = !isReadOnly && !isDirectory && step.fileTarget ? step.fileTarget : undefined;

                const output = await this.toolService.executeTool(toolDef, step.toolCall, cwd, outputFile);

                // STORE OUTPUT IN LOGS SO DEPENDENT STEPS CAN SEE IT
                this.updateStepStatus(index, AgentStatus.PASSED, {
                    logs: [output]
                });
                this.state.completedSteps++;

                if (this.config.useGitWorktrees && worktreeInfo) {
                    // FIX: Only checkpoint if we actually wrote a file (outputFile is defined)
                    if (outputFile) {
                        await this.git.createCheckpoint(step.description, ['.'], worktreeInfo.path);
                        await this.git.mergeWorktreeToMain(worktreeInfo.branch, `Executed Tool: ${step.description}`);
                    } else {
                        console.log(`[MakerEngine] Read-only tool executed. Skipping merge.`);
                    }
                    await this.git.cleanupWorktree(worktreeInfo.path, worktreeInfo.branch);
                }
                this.notify();
                return;
            }

            const riskAssessment = await this.assessRisk(step, agent);
            this.updateStepStatus(index, AgentStatus.THINKING, { riskScore: riskAssessment.score, riskReason: riskAssessment.reason });

            const dependencyFiles = this.state.decomposition
                .filter(s => step.dependencies.includes(s.id))
                .map(s => s.id); // Pass IDs to lookup logs

            // Pass full decomposition for log lookup
            let context = await this.contextManager.getTaskContext(step.fileTarget, dependencyFiles, this.state.decomposition);
            const fullContext = await this.contextManager.getArchitectContext(step.description, []);

            const shouldVote = riskAssessment.score > Math.min(this.config.riskThreshold, agent.riskTolerance + 0.3);
            let content = "";
            let traceData: ExecutionTrace | undefined;

            if (shouldVote && this.llm) {
                this.updateStepStatus(index, AgentStatus.VOTING);
                const result = await this.voter.performVoting(step, agent, context, this.config.agentProfiles,
                    async (a) => {
                        const res = await this.generateCode(step, a, context, fullContext);
                        return res.content;
                    }
                );
                this.updateStepStatus(index, AgentStatus.VOTING, { candidates: result.candidates });

                if (!result.isConsensus || !result.winner) {
                    const fallback = result.candidates.find(c => c.agentName === agent.name);
                    content = fallback?.content || "";
                    if (!content) throw new Error("Consensus failed.");
                } else {
                    content = result.winner;
                }
            } else {
                this.updateStepStatus(index, AgentStatus.SKIPPED_VOTE);
                const genResult = await this.generateCode(step, agent, context, fullContext);
                content = genResult.content;
                traceData = genResult.trace;
            }

            // --- RED FLAG SELF-CORRECTION LOOP ---
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

                        this.updateStepStatus(index, AgentStatus.THINKING, {
                            logs: [...(this.state.decomposition[index].logs || []), `[Self-Correction] Red Flags: ${currentRedFlags.join(', ')}. Retrying (${redFlagAttempts + 1}/${maxRedFlagRetries})...`]
                        });

                        const retryResult = await this.generateCode(step, agent, context, fullContext, feedback);
                        content = retryResult.content;
                        traceData = retryResult.trace;
                        redFlagAttempts++;
                    } else {
                        if (traceData) traceData.redFlags = currentRedFlags;
                        throw new Error(`Red Flags Persisted after retries: ${currentRedFlags.join(', ')}`);
                    }
                }
            } while (currentRedFlags.length > 0 && redFlagAttempts <= maxRedFlagRetries);

            this.updateStepStatus(index, AgentStatus.EXECUTING, { trace: traceData });

            // --- PATH RESOLUTION FIX ---
            let targetPath = step.fileTarget;
            const root = vfs.getRoot();

            if (worktreeInfo) {
                targetPath = `${worktreeInfo.path}/${step.fileTarget}`;
            } else if (root) {
                // If no worktree, ensure we write relative to project root
                // Remove ./ if present
                const cleanRel = step.fileTarget.replace(/^\.\//, '');
                targetPath = `${root}/${cleanRel}`;
            }

            // Ensure directory exists
            const dir = targetPath.substring(0, targetPath.lastIndexOf('/'));
            if (dir && dir !== '.') await MockTauriService.mkdir(dir);

            // Use VFS for non-worktree writes to keep cache in sync
            if (!worktreeInfo && root) {
                await vfs.writeFile(step.fileTarget, content);
            } else {
                await MockTauriService.writeFile(targetPath, content);
            }

            // --- LINTER LOOP ---
            const provider = this.langRegistry.getProvider(targetPath);
            let lintAttempts = 0;
            const maxLintAttempts = this.config.autoFixLinter ? 2 : 0;
            let isLintValid = false;

            while (!isLintValid) {
                const lintErrors = provider ? await provider.lintFile(targetPath, vfs.getRoot() || ".") : [];

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

                    this.updateStepStatus(index, AgentStatus.EXECUTING, {
                        logs: [...(this.state.decomposition[index].logs || []), `[AutoFix] ${provider?.id} Linter failed: ${errorMsg}. Retrying...`]
                    });

                    const retryResult = await this.generateCode(step, agent, context, fullContext, lintErrors.join('\n'));
                    content = retryResult.content;

                    // Re-write file
                    if (!worktreeInfo && root) {
                        await vfs.writeFile(step.fileTarget, content);
                    } else {
                        await MockTauriService.writeFile(targetPath, content);
                    }
                    lintAttempts++;
                } else {
                    console.log("Triggering Re-plan due to persistent lint errors...");
                    const newSteps = await this.decomposer.replan(step, lintErrors.join('\n'));

                    if (newSteps.length > 0) {
                        const safeNewSteps = newSteps.map(s => ({
                            id: s.id || `rescue-${Math.random().toString(36).substr(2, 5)}`,
                            description: s.description || "Rescue Step",
                            fileTarget: s.fileTarget || step.fileTarget,
                            status: AgentStatus.QUEUED,
                            attempts: 0,
                            votes: 0,
                            riskScore: 0,
                            logs: ["Re-planned from failed parent"],
                            dependencies: s.dependencies || step.dependencies,
                            candidates: []
                        }));

                        const newDecomp = [...this.state.decomposition];
                        newDecomp.splice(index, 1, ...safeNewSteps);

                        this.state.decomposition = newDecomp;
                        this.state.totalSteps = newDecomp.length;

                        if (worktreeInfo && this.config.useGitWorktrees) {
                            await this.git.cleanupWorktree(worktreeInfo.path, worktreeInfo.branch);
                        }

                        this.notify();
                        return;
                    } else {
                        throw new Error(`${provider?.id || 'System'} Linter validation failed: ${lintErrors[0]}`);
                    }
                }
            }

            this.updateStepStatus(index, AgentStatus.CHECKPOINTING);
            if (this.config.useGitWorktrees && worktreeInfo) {
                await this.git.createCheckpoint(step.description, ['.'], worktreeInfo.path);
                this.updateStepStatus(index, AgentStatus.MERGING);
                const mergeSuccess = await this.git.mergeWorktreeToMain(worktreeInfo.branch, step.description);
                if (!mergeSuccess) throw new Error("Merge Conflict.");
                await this.git.cleanupWorktree(worktreeInfo.path, worktreeInfo.branch);
            } else {
                await this.git.createCheckpoint(step.description, [step.fileTarget]);
            }

            this.updateStepStatus(index, AgentStatus.PASSED);
            this.state.completedSteps++;

        } catch (e: any) {
            console.error(`[MakerEngine] Step ${index} Failed:`, e);

            this.failStep(index, e.message || "Unknown error");
            if (worktreeInfo && this.config.useGitWorktrees) {
                await this.git.cleanupWorktree(worktreeInfo.path, worktreeInfo.branch);
            }
        } finally {
            this.notify();
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

    private failStep(index: number, reason: string) {
        const newDecomp = [...this.state.decomposition];
        newDecomp[index] = { ...newDecomp[index], status: AgentStatus.FAILED, logs: [...newDecomp[index].logs, reason] };
        this.state.decomposition = newDecomp;
        this.state.errorCount++;
        this.notify();
    }

    private updateStepStatus(index: number, status: AgentStatus, extra: Partial<SubTask> = {}) {
        const newDecomp = [...this.state.decomposition];
        newDecomp[index] = { ...newDecomp[index], status, ...extra };
        this.state.decomposition = newDecomp;
        this.notify();
    }
}