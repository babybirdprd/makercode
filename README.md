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
*   **Prompts**: The exact context sent to the LLM.
*   **Responses**: The raw output generated.
*   **Red Flags**: Any warnings triggered during generation.
*   **Tool Logs**: Output from command execution.
*   **Consensus Data**: Voting outcomes and risk scores.

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

## 🗺️ ROADMAP TO LAUNCH

We are moving from "Academic Prototype" to "Commercial Product". This roadmap prioritizes Engineering Rigor, Developer Experience (DX), and MAKER Fidelity.

### Phase 6: Engineering Rigor (Testing & CI/CD)
*Objective: Stop paying API fees to verify if the app works.*
*   [ ] **Deterministic LLM Mocking**: Implement a "VCR-style" record/replay system for `LLMClient`. This allows running the entire `StepExecutor` logic in CI without hitting OpenAI/Gemini.
*   [ ] **Integration Test Suite**: Automated tests for `GitService` (Worktree creation/cleanup) and `VirtualFileSystem` using an in-memory test harness.
*   [ ] **Performance Benchmarking**: Automated tracking of "Time to Decomposition" and "Time to Consensus".

### Phase 7: The "Pro" Editor Experience (DX)
*Objective: Replace the `<textarea>` with a tool developers actually respect.*
*   [ ] **CodeMirror Integration**: Replace the basic editor with CodeMirror 6.
    *   Syntax Highlighting (TS, Rust, Python).
    *   Basic LSP support (Go to Definition, Hover info).
    *   Vim Keybinding mode.
*   [ ] **Native Terminal (PTY)**: Replace the read-only log stream with a real interactive terminal (using `xterm.js` + `portable-pty` in Rust) to allow users to run `npm start` or `git push` manually.
*   [ ] **Git Auth Wizard**: In-app UI for SSH Key management and Credential Helper configuration to prevent "Permission Denied" errors during agent execution.

### Phase 8: Prompt Architecture 2.0
*Objective: Treat prompts as code.*
*   [ ] **Prompt Registry**: Move hardcoded strings from `src/services/prompts` to external `.yaml` or `.json` definitions.
*   [ ] **Prompt Versioning**: Allow A/B testing of different decomposition strategies.
*   [ ] **Metaprompting**: Implement a "Prompt Refiner" agent that optimizes Micro-Role descriptions before they are sent to the execution model.

### Phase 9: MAKER "Zero Error" Convergence
*Objective: Close the gap between our code and the MAKER Paper.*
*   [ ] **Dynamic "Ahead-by-K" Voting**: Upgrade `VotingService` from a fixed committee (3 agents) to a statistical model that spawns new voters until a confidence threshold (K) is met.
*   [ ] **Semantic Red-Flagging (AST)**: Replace fragile Regex checks with real AST analysis (using `oxc` or `swc` in Rust).
    *   *Example:* Detect "Variable used before declaration" or "Importing non-existent module" *before* running the linter.
*   [ ] **Tiered Model Routing**: Automatically route complex "Architect" tasks to high-IQ models (e.g., o3-mini) and simple "Linter" tasks to fast models (e.g., Gemini Flash).

### Phase 10: Enterprise Reliability
*Objective: Safety, Persistence, and Cost Control.*
*   [ ] **Session Persistence**: Replace in-memory state with SQLite/LocalDB. Allow users to close the app and resume a "Million Step" task later.
*   [ ] **Tokenometer & Budget Caps**: Real-time cost tracking with hard stops (e.g., "Pause task if cost exceeds $5.00").
*   [ ] **Sandboxed Execution**: Explore `docker` or `firecracker` integration for running agent code in true isolation (beyond just Git Worktrees).

---

## 🦀 The "Rustification" Roadmap

We are moving performance-critical components from TypeScript/Shell to Native Rust.

**Architectural Policy:** We prioritize **Official Tauri Plugins** (`tauri-plugin-*`) for stability. Custom Rust Commands are used only when necessary.

| Component | Current Status | Target | Reason |
| :--- | :--- | :--- | :--- |
| **File System** | ✅ `tauri-plugin-fs` | `tauri-plugin-fs` | Official standard for file I/O. |
| **Shell/Process** | ✅ `tauri-plugin-shell` | `tauri-plugin-shell` | Official standard for secure spawning. |
| **Dialogs** | ✅ `tauri-plugin-dialog` | `tauri-plugin-dialog` | Official standard for native UI. |
| **Git Operations** | ✅ Rust (`git2`) | Custom Rust Command | No official plugin; `git2` required for atomic speed. |
| **File Scanning** | ✅ Rust (`walkdir`) | Custom Rust Command | `fs.readDir` is too slow for deep recursion. |
| **Terminal PTY** | ❌ None | `portable-pty` | Required for interactive terminal support. |
| **AST Analysis** | ⚠️ Regex | `oxc` / `tree-sitter` | Required for "Zero Error" Semantic Red-Flagging. |
| **Search** | ⚠️ Shell (`rg`) | `ignore` + `grep` crate | Eliminate dependency on external `rg` binary. |

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