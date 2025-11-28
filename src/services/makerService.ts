import { SubTask, AgentStatus, TaskStatus, MakerConfig, AgentProfile } from "../types";
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
            isPlanning: false
        };
        this.notify();

        try {
            const status = await this.git.getStatus();
            if (!status.isRepo) await this.git.initRepo();
            if (status.isDirty) await this.git.createCheckpoint("Auto-Checkpoint before Task Start");

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
            this.state.isPlanning = true;
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
            this.state.isPlanning = false;
            this.notify();
            throw e;
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

                // DELEGATE TO STEP EXECUTOR
                const executor = new StepExecutor(
                    this.llm,
                    this.voter,
                    this.decomposer,
                    this.config,
                    this.state.taskId,
                    (update) => {
                        // Merge logs if present
                        if (update.logs && this.state.decomposition[index].logs) {
                            update.logs = [...this.state.decomposition[index].logs, ...update.logs];
                        }
                        this.updateStepStatus(index, update.status || AgentStatus.THINKING, update);
                    }
                );

                executor.execute(this.state.decomposition[index], assignedAgent, this.state.decomposition)
                    .then(() => {
                        this.state.activeWorkers--;
                        this.state.completedSteps++;
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
                                    fileTarget: s.fileTarget || this.state.decomposition[index].fileTarget,
                                    status: AgentStatus.QUEUED,
                                    attempts: 0,
                                    votes: 0,
                                    riskScore: 0,
                                    logs: ["Re-planned from failed parent"],
                                    dependencies: s.dependencies || this.state.decomposition[index].dependencies,
                                    candidates: []
                                }));

                                const newDecomp = [...this.state.decomposition];
                                newDecomp.splice(index, 1, ...safeNewSteps);
                                this.state.decomposition = newDecomp;
                                this.state.totalSteps = newDecomp.length;
                                this.notify();
                            } catch (parseError) {
                                console.error("Failed to parse replan steps", parseError);
                                this.failStep(index, "Re-planning failed to parse.");
                            }
                        } else {
                            // Standard Failure
                            this.failStep(index, e.message);
                        }
                        this.state.activeWorkers--;
                        this.processQueue();
                    });
            }
        }
    }

    private failStep(index: number, reason: string) {
        const newDecomp = [...this.state.decomposition];
        const currentLogs = newDecomp[index].logs || [];
        newDecomp[index] = { ...newDecomp[index], status: AgentStatus.FAILED, logs: [...currentLogs, reason] };
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