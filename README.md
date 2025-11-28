# MakerCode

**The Agentic Editor for Zero-Error Execution.**

> **Status:** 🟢 **Beta (Functional Prototype)**
>
> We have successfully implemented the core **MAKER Framework** (Massive Agentic Decomposition, Error Correction, and Red-flagging). The system can now autonomously decompose tasks, assign micro-roles, execute tools, and write code with self-correction loops using isolated Git Worktrees.

MakerCode is not just an autocomplete engine. It is an **Autonomous Software Engineering Organization** in a box. It decomposes high-level tasks into atomic units, executes them in parallel, and enforces rigorous consensus mechanisms to prevent hallucinations.

---

## 🏗️ System Architecture

MakerCode uses a **Hybrid Architecture** designed for performance and security. We split the "Brain" (Reasoning) from the "Muscle" (Execution).

### 🧠 The Brain (TypeScript / React)
Located in `src/`, this layer handles the cognitive load and orchestration:
*   **`MakerEngine`**: The central event loop. It manages the task queue, agent state, and risk assessment.
*   **`DecompositionService`**: Implements the "Decomposition" part of MAKER. Breaks prompts into atomic steps (Tool Usage vs. Code Generation).
*   **`VotingService`**: Implements the "Error Correction" part. If a step is high-risk (e.g., security logic), multiple agents generate solutions and vote on the best one.
*   **`ContextManager`**: A "RAG-lite" system that intelligently scouts the file system to provide agents with relevant context (preventing "blind" coding).

### 💪 The Muscle (Rust / Tauri)
Located in `src-tauri/`, this layer handles heavy I/O and system operations:
*   **`libgit2` Bindings**: We use native Rust bindings for Git operations (Status, Init, Add, Commit) to ensure speed and reliability, avoiding shell overhead.
*   **Recursive File Scanning**: A custom Rust implementation (`get_project_tree`) scans thousands of files in milliseconds to feed the Context Manager.
*   **Secure Shell Execution**: All command-line tools (`npm`, `cargo`, `pip`) are proxied through a strict allowlist in `capabilities.json`.
*   **Virtual File System (VFS)**: An abstraction layer that syncs in-memory state with the disk, handling path normalization across Windows/macOS/Linux.

---

## 🚦 Features & Capabilities

### 1. The MAKER Protocol
We strictly adhere to the paper's methodology:
*   **Decomposition**: High-level requests ("Create a Todo App") are broken down into atomic actions ("Create dir", "Write Component A", "Write Component B").
*   **Micro-Roles**: Agents aren't generic. They are assigned specific personas like `PythonDataEngineer` or `ReactComponentSpecialist` for each step.
*   **Red-Flagging**: The engine analyzes agent output *before* it touches the disk. If a Python agent tries to run `npm install`, it triggers a "Red Flag" and forces a self-correction loop.

### 2. The Flight Recorder
Every action is logged. You can export a detailed JSON trace (`maker_trace.json`) that contains:
*   The exact prompt sent to the LLM.
*   The raw response.
*   Any "Red Flags" detected.
*   Tool execution logs.
*   Risk scores and voting outcomes.

### 3. Tooling Ecosystem
Agents have access to a suite of system tools:
*   **`ls` / `read_file`**: For information gathering (Read-Before-Write).
*   **`make_directory`**: Recursive directory creation (Internal Rust implementation).
*   **`execute_command`**: Safe execution of shell commands (`npm install`, `touch`, `echo`).
*   **`grep`**: Pattern matching using `rg` (or `git grep` fallback).

### 4. Git Integration
*   **Auto-Checkpointing**: The system commits changes automatically after successful steps.
*   **Worktree Isolation**: Spins up temporary Git Worktrees for every step, ensuring that failed code generation never pollutes your main branch.
*   **Conflict Resolution**: A dedicated UI for resolving merge conflicts if agents step on each other's toes.

---

## 🗺️ ROADMAP

### Phase 1: The Foundation (✅ Completed)
*   [x] **Hybrid Architecture**: React 19 frontend + Rust/Tauri v2 backend.
*   [x] **Virtual File System**: Async read/write bridging with recursive directory scanning.
*   [x] **Project Persistence**: `.maker/config.json` support.

### Phase 2: The Wiring (✅ Completed)
*   [x] **Local Git Abstraction**: Internal client, worktree isolation, and dirty state protection.
*   [x] **Polyglot Support**: Language Registry and Manifest Detection.
*   [x] **Context Awareness**: Heuristic stack detection (Python/Node/Rust).

### Phase 3: The "Brain" Upgrade (✅ Completed)
*   [x] **Provider Agnostic AI**: Support for Gemini, OpenAI, etc.
*   [x] **Consensus Engine**: Multi-agent voting and semantic judging.
*   [x] **Dynamic Re-planning**: Auto-decomposition of failed steps.

### Phase 4: Observability & Insights (✅ Completed)
*   [x] **The Flight Recorder**: Detailed JSON export of execution traces (Prompts, Responses, Red Flags).
*   [x] **Step Detail View**: UI to inspect the raw output and logs of any specific step.
*   [x] **Red Flag Indicators**: Visual warnings when agents produce outputs that violate constraints.

### Phase 5: Prompt Architecture 2.0 (✅ Completed)
*   [x] **Prompt Registry**: Centralized, structured prompts.
*   [x] **Micro-Role Generation**: Dynamic persona assignment (e.g., "DocumentationSpecialist").
*   [x] **Strict Output Gates**: "Red-flagging" logic that detects and rejects hallucinations (e.g., `npm` in Python).
*   [x] **Read-Before-Write**: Architects are prompted to schedule `read_file` steps before `write_file` steps.

### Phase 6: Tooling Ecosystem (🚧 Next Up)
*   [x] **Hardwired Tools**: `ls`, `read_file`, `grep`.
*   [ ] **User-Defined Tools**: UI to register custom CLI commands as tools available to agents.
*   [ ] **Tool Permission System**: "Human-in-the-loop" approval for dangerous tools (e.g., `rm -rf`, `deploy`).

### Phase 7: Adaptive Intelligence
*   [ ] **Model Routing**: Configurable routing to use cheaper models (Flash/Haiku) for `read_file`/`ls` steps and powerful models (Pro/4o) for `write_code`.
*   [ ] **Cost Estimation**: Real-time token usage tracking and cost projection per task.

## 🦀 The "Rustification" Roadmap

We are actively moving performance-critical components from TypeScript/Shell to Native Rust.

| Component | Current Status | Target | Reason |
| :--- | :--- | :--- | :--- |
| **Git Operations** | ✅ Rust (`git2`) | Rust | Speed & Reliability (No shell spawning) |
| **File Scanning** | ✅ Rust (`walkdir`) | Rust | Handling large `node_modules` without freezing |
| **Grep / Search** | ⚠️ Shell (`rg`) | Rust (`grep-searcher`) | Eliminate dependency on external `rg` binary |
| **AST Parsing** | ⚠️ TypeScript (`babel`) | Rust (`swc` / `oxc`) | Faster "Red Flag" analysis for syntax errors |
| **Worktree Mgmt** | ⚠️ Shell (`git worktree`) | Rust (`git2`) | Atomic worktree creation/pruning is complex in shell |
| **Terminal PTY** | ⚠️ Shell (`spawn`) | Rust (`portable-pty`) | Real interactive terminal support |

---

## 📦 Getting Started

### Prerequisites
*   Node.js 18+
*   Rust (cargo)
*   Git (in PATH)
*   Ripgrep (`rg`) - *Recommended for optimal search performance.*

### Installation
1.  **Install Dependencies:**
    ```bash
    pnpm install
    ```
2.  **Run Development Mode:**
    ```bash
    pnpm tauri dev
    ```
3.  **Build for Production:**
    ```bash
    pnpm tauri build
    ```

### Configuration
On first launch, click the **Settings (⚙️)** icon to configure your LLM Provider:
*   **Gemini**: Requires an API Key.
*   **OpenAI**: Requires API Key (and optional Base URL for local inference servers like Ollama/LM Studio).

---

*Built with ❤️ by the MakerCode Team.*