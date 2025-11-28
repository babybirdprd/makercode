import { SubTask, AgentStatus, TaskStatus, MakerConfig, AgentProfile, EngineState } from "../types";
import { GitService } from "./gitService";
import { VirtualFileSystem } from "./virtualFileSystem";
import { LLMFactory, LLMClient } from "./llm";
import { ContextManager } from "./contextManager";
import { LanguageRegistry } from "./languages/registry";
import { DecompositionService } from "./engine/decompositionService";
import { VotingService } from "./engine/votingService";
import { ToolService } from "./toolService";
import { StepExecutor } from "./engine/stepExecutor";

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

    // Multi-Session State
    private sessions: Map<string, TaskStatus> = new Map();
    private activeSessionId: string | null = null;
    private globalActiveWorkers: number = 0;

    private listeners: ((state: EngineState) => void)[] = [];
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

    subscribe(listener: (state: EngineState) => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    updateConfig(newConfig: Partial<MakerConfig>) {
        console.log("[MakerEngine] updateConfig called.");

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
        this.listeners.forEach(l => l({
            sessions: Array.from(this.sessions.values()),
            activeSessionId: this.activeSessionId,
            globalActiveWorkers: this.globalActiveWorkers
        }));
    }

    switchSession(sessionId: string) {
        if (this.sessions.has(sessionId)) {
            this.activeSessionId = sessionId;
            this.notify();
        }
    }

    async startTask(prompt: string) {
        // Concurrency Gate
        if (this.globalActiveWorkers > 0 && !this.config.useGitWorktrees) {
            // Check if there are other sessions running
            const runningSessions = Array.from(this.sessions.values()).filter(s => s.activeWorkers > 0);
            if (runningSessions.length > 0) {
                throw new Error("Parallel tasks require Git Worktrees to be enabled in Settings.");
            }
        }

        const newSessionId = Date.now().toString();

        const newSession: TaskStatus = {
            taskId: newSessionId,
            originalPrompt: prompt,
            decomposition: [],
            totalSteps: 0,
            completedSteps: 0,
            errorCount: 0,
            activeWorkers: 0,
            conflicts: [],
            isPlanning: false
        };

        this.sessions.set(newSessionId, newSession);
        this.activeSessionId = newSessionId;
        this.notify();

        try {
            // Initial Git checks (only if this is the first session or worktrees enabled)
            const status = await this.git.getStatus();
            if (!status.isRepo) await this.git.initRepo();

            // Auto-checkpoint only if main branch is dirty and we aren't using worktrees (conflict risk)
            // If using worktrees, we can stash or ignore, but here we checkpoint for safety.
            if (status.isDirty) await this.git.createCheckpoint("Auto-Checkpoint before Task Start");

            const allTools = this.toolService.getAvailableTools(this.config.tools || []);
            const decomposition = await this.decomposer.decompose(prompt, allTools);

            const session = this.sessions.get(newSessionId)!;
            session.decomposition = decomposition.map(d => ({
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
            session.totalSteps = session.decomposition.length;
            session.isPlanning = true;
            this.notify();

        } catch (e: any) {
            console.error("[MakerEngine] Start Task Failed:", e);
            const session = this.sessions.get(newSessionId);
            if (session) {
                session.errorCount++;
                session.decomposition = [{
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
                session.isPlanning = false;
            }
            this.notify();
            throw e;
        }
    }

    async executePlan() {
        if (!this.activeSessionId || !this.sessions.has(this.activeSessionId)) return;

        const session = this.sessions.get(this.activeSessionId)!;
        session.isPlanning = false;
        session.decomposition = session.decomposition.map(s => ({ ...s, status: AgentStatus.QUEUED }));

        this.notify();
        this.isRunning = true;
        this.processQueue();
    }

    // Global Queue Processor
    private async processQueue() {
        if (!this.isRunning) return;

        // Iterate over all sessions
        for (const [sessionId, session] of this.sessions.entries()) {

            // Check session completion
            const allComplete = session.decomposition.every(s => s.status === AgentStatus.PASSED || s.status === AgentStatus.FAILED);
            if (allComplete && session.activeWorkers === 0) {
                // Handle Final Commit for Micro-Tasks (Adaptive Checkpointing)
                if (session.totalSteps < 3 && !this.config.useGitWorktrees) {
                    // Check if we need to commit
                    const passedSteps = session.decomposition.filter(s => s.status === AgentStatus.PASSED);
                    if (passedSteps.length > 0) {
                        await this.git.createCheckpoint(`Completed Task: ${session.originalPrompt.substring(0, 50)}...`, ['.']);
                    }
                }
                continue;
            }

            // Scheduling
            const completedIds = new Set(session.decomposition.filter(s => s.status === AgentStatus.PASSED).map(s => s.id));
            const runnableIndices = session.decomposition
                .map((step, index) => ({ step, index }))
                .filter(({ step }) => step.status === AgentStatus.QUEUED && step.dependencies.every(depId => completedIds.has(depId)))
                .map(item => item.index);

            // We use global max parallelism, but we could also limit per session.
            // For now, we respect global limit.
            while (this.globalActiveWorkers < this.config.maxParallelism && runnableIndices.length > 0) {
                const index = runnableIndices.shift();
                if (index !== undefined) {
                    this.globalActiveWorkers++;
                    session.activeWorkers++;

                    const assignedAgent = this.config.agentProfiles[index % this.config.agentProfiles.length];
                    this.updateStepStatus(sessionId, index, AgentStatus.QUEUED, { assignedAgentId: assignedAgent.id });
                    this.notify();

                    const executor = new StepExecutor(
                        this.llm,
                        this.voter,
                        this.decomposer,
                        this.config,
                        sessionId,
                        session.totalSteps,
                        (update) => {
                            if (update.logs && session.decomposition[index].logs) {
                                update.logs = [...session.decomposition[index].logs, ...update.logs];
                            }
                            this.updateStepStatus(sessionId, index, update.status || AgentStatus.THINKING, update);
                        }
                    );

                    executor.execute(session.decomposition[index], assignedAgent, session.decomposition)
                        .then(() => {
                            this.globalActiveWorkers--;
                            session.activeWorkers--;
                            session.completedSteps++;
                            this.processQueue();
                        })
                        .catch((e: any) => {
                            // Handle Replan Signal
                            if (e.message.startsWith('__REPLAN_REQUIRED__:')) {
                                try {
                                    const newSteps = JSON.parse(e.message.replace('__REPLAN_REQUIRED__:', ''));
                                    const safeNewSteps = newSteps.map((s: any) => ({
                                        id: s.id || `rescue-${Math.random().toString(36).substr(2, 5)}`,
                                        description: s.description || "Rescue Step",
                                        fileTarget: s.fileTarget || session.decomposition[index].fileTarget,
                                        status: AgentStatus.QUEUED,
                                        attempts: 0,
                                        votes: 0,
                                        riskScore: 0,
                                        logs: ["Re-planned from failed parent"],
                                        dependencies: s.dependencies || session.decomposition[index].dependencies,
                                        candidates: []
                                    }));

                                    const newDecomp = [...session.decomposition];
                                    newDecomp.splice(index, 1, ...safeNewSteps);
                                    session.decomposition = newDecomp;
                                    session.totalSteps = newDecomp.length;
                                    this.notify();
                                } catch (parseError) {
                                    console.error("Failed to parse replan steps", parseError);
                                    this.failStep(sessionId, index, "Re-planning failed to parse.");
                                }
                            } else {
                                this.failStep(sessionId, index, e.message);
                            }
                            this.globalActiveWorkers--;
                            session.activeWorkers--;
                            this.processQueue();
                        });
                }
            }
        }
    }

    private failStep(sessionId: string, index: number, reason: string) {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        const newDecomp = [...session.decomposition];
        const currentLogs = newDecomp[index].logs || [];
        newDecomp[index] = { ...newDecomp[index], status: AgentStatus.FAILED, logs: [...currentLogs, reason] };
        session.decomposition = newDecomp;
        session.errorCount++;
        this.notify();
    }

    private updateStepStatus(sessionId: string, index: number, status: AgentStatus, extra: Partial<SubTask> = {}) {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        const newDecomp = [...session.decomposition];
        newDecomp[index] = { ...newDecomp[index], status, ...extra };
        session.decomposition = newDecomp;
        this.notify();
    }
}