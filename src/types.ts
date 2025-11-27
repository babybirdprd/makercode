// MAKER Framework Types

export enum AgentStatus {
    IDLE = 'IDLE',
    QUEUED = 'QUEUED',
    PLANNING = 'PLANNING',
    ANALYZING = 'ANALYZING',
    THINKING = 'THINKING',
    VOTING = 'VOTING',
    PASSED = 'PASSED',
    FAILED = 'FAILED',
    EXECUTING = 'EXECUTING',
    SKIPPED_VOTE = 'FAST_TRACK',
    CHECKPOINTING = 'CHECKPOINTING',
    MERGING = 'MERGING',
    CONFLICT = 'CONFLICT'
}

export interface AgentCandidate {
    id: string;
    agentName: string;
    content: string;
    voteCount: number;
    reasoning: string;
}

export interface ToolDefinition {
    id: string;
    name: string;
    description: string;
    command: string; // e.g. "npm run test -- {{file}}"
    requiresApproval: boolean;
    isSystem?: boolean; // New: Marks hardwired tools
}

export interface ToolCall {
    toolName: string;
    arguments: Record<string, string>;
}

export interface ExecutionTrace {
    agentId: string;
    agentPersona: string; // The Micro-Role used
    timestamp: number;
    finalPrompt: string;  // The exact context sent to LLM
    rawResponse: string;  // The raw output
    redFlags: string[];   // Any warnings triggered
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
}

export interface SubTask {
    id: string;
    description: string;
    fileTarget: string;
    status: AgentStatus;
    attempts: number;
    votes: number;
    riskScore: number;
    riskReason?: string;
    logs: string[];

    // Micro-Role Assignment
    role?: string;
    roleDescription?: string;

    // Execution Data (The Flight Recorder)
    trace?: ExecutionTrace;

    // Tool Integration
    toolCall?: ToolCall;

    // Voting
    candidates?: AgentCandidate[];

    // Parallelism & Git
    dependencies: string[];
    gitBranch?: string;
    worktreePath?: string;

    assignedAgentId?: string;
}

export interface TaskStatus {
    taskId: string;
    originalPrompt: string;
    decomposition: SubTask[];
    totalSteps: number;
    completedSteps: number;
    errorCount: number;
    activeWorkers: number;
    conflicts: MergeConflict[];
    isPlanning: boolean;
}

export interface FileNode {
    id: string;
    name: string;
    type: 'file' | 'dir';
    children?: FileNode[];
    path: string;
}

export interface VoteResult {
    winner: string | null;
    voteCount: number;
    totalVotes: number;
    isConsensus: boolean;
    candidates: AgentCandidate[];
}

export interface AgentProfile {
    id: string;
    name: string;
    role: 'Architect' | 'Developer' | 'QA' | 'Security';
    riskTolerance: number;
    color: string;
    model: string;
}

export type LLMProviderType = 'gemini' | 'openai';

export interface MakerConfig {
    // LLM Configuration
    llmProvider: LLMProviderType;
    geminiApiKey?: string;
    openaiBaseUrl?: string;
    openaiApiKey?: string;
    openaiModel?: string;

    // Engine Settings
    riskThreshold: number;
    maxAgents: number;
    autoFixLinter: boolean;
    useGitWorktrees: boolean;
    maxParallelism: number;

    // Agent Roster
    agentProfiles: AgentProfile[];

    // Tool Registry
    tools: ToolDefinition[];
}

export interface GitLogEntry {
    hash: string;
    message: string;
    author: string;
    date: string;
    stats?: {
        additions: number;
        deletions: number;
    };
    tags?: string[];
}

export interface Worktree {
    id: string;
    path: string;
    branch: string;
    status: 'active' | 'merging' | 'stale';
    assignedAgentId?: string;
    lastActivity: string;
}

export interface MergeConflict {
    id: string;
    filePath: string;
    branchA: string;
    branchB: string;
    contentA: string;
    contentB: string;
    aiResolutionProposal?: string;
}