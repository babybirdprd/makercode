# MakerCode

**The Agentic Editor for Zero-Error Execution.**

MakerCode is a next-generation code editor built on the **MAKER Framework** (Massive Agentic Decomposition, Error Correction, and Red-flagging). Unlike traditional AI assistants that simply autocomplete code, MakerCode acts as a fully autonomous software engineering organization in a box. It decomposes high-level tasks into atomic units, executing them in parallel with rigorous consensus mechanisms to ensure correctness.

## 🚀 Core Philosophy

The project is built on the premise that LLMs are "autoregressive queens of failure" when asked to do too much at once. To solve this, MakerCode implements:

1.  **Extreme Decomposition**: Tasks are broken down until they are atomic (e.g., "Write this specific function").
2.  **Adaptive Consensus**: High-risk changes trigger a multi-agent voting process (The "Architect", "Security Auditor", and "QA" agents must agree).
3.  **Isolation**: Agents work in Git Worktrees to prevent race conditions.
4.  **Polyglot Context**: Intelligent, language-aware context injection (The "Context Onion") prevents hallucination.

---

## 🛠 Tech Stack

*   **Frontend**: React 19, TailwindCSS, Lucide Icons.
*   **Backend / System**: Tauri v2 (Rust), `tauri-plugin-fs`, `tauri-plugin-shell`.
*   **AI Orchestration**: Provider Agnostic (Gemini, OpenAI, DeepSeek, Ollama).
*   **State Management**: In-Memory Virtual File System (VFS) with Event Subscription.

---

## 🗺️ ROADMAP

### Phase 1: The Foundation (✅ Completed)
*   [x] **Hybrid Architecture**: React 19 frontend + Rust/Tauri v2 backend.
*   [x] **Virtual File System (VFS)**: Async read/write layer bridging UI and Disk.
*   [x] **Real I/O**: `tauri-plugin-fs` integration for opening/saving actual files.
*   [x] **Project Persistence**: Auto-loading `.maker/config.json` for per-project agent settings.
*   [x] **Secret Management**: Secure (local) storage of API Keys.

### Phase 2: The Wiring (✅ Completed)
*   [x] **Local Git Abstraction**:
    *   [x] **Internal Client**: App manages its own "Shadow Repo" state.
    *   [x] **Worktree Isolation**: Agents run in isolated git worktrees to prevent conflicts.
    *   [x] **Dirty State Protection**: Prevents agents from running on unstable state.
    *   [x] **Remote Sync**: Push/Pull integration with GitHub/GitLab.
*   [x] **Polyglot Support**:
    *   [x] **Language Registry**: Modular support for TypeScript, Rust, and Python.
    *   [x] **Manifest Detection**: Auto-detects `package.json`, `Cargo.toml`, etc.
*   [x] **Context Awareness (RAG Lite)**:
    *   [x] **The Context Onion**: Layered context injection (Tree -> Manifests -> Dependencies).
    *   [x] **Keyword Scouting**: Heuristic scanning for relevant files based on user prompt.
    *   [x] **Reactive Expansion**: Auto-healing context when linter errors occur.

### Phase 3: The "Brain" Upgrade (✅ Completed)
*   [x] **Provider Agnostic AI**:
    *   [x] Support for OpenAI, DeepSeek, and Local LLMs via standard API.
    *   [x] Dynamic configuration via Settings Panel.
*   [x] **Modular Architecture**:
    *   [x] Split monolithic service into `DecompositionService`, `VotingService`, and `MakerEngine`.
*   [x] **Consensus Engine**:
    *   [x] **The Judge**: Semantic evaluation of candidate code by a superior model.
    *   [x] **Voting Logic**: Multi-agent proposal generation and selection.

### Phase 4: Safety & Robustness (✅ Completed)
*   [x] **Static Safety**:
    *   [x] Path traversal prevention in VFS.
    *   [x] Banned module checks (child_process, unsafe) in generated code.
*   [x] **Dynamic Re-planning**:
    *   [x] Architect auto-decomposes failed steps into smaller sub-tasks.
*   [x] **Production Terminal**:
    *   [x] Real-time streaming output for `npm install` / `cargo build`.
    *   [x] Process control (Stop/Kill).

### Phase 5: Extensibility (🚧 Next Up)
*   [ ] **Dynamic Agent Profiles**:
    *   [ ] UI to create/edit agents (e.g., "Rust Expert", "Python Data Scientist").
    *   [ ] Persist agent roster to `.maker/config.json` so it travels with the repo.
    *   [ ] **Preserve Defaults**: Ensure "Atlas", "Bolt", "Cipher", and "Dash" remain the default team.
*   [ ] **Plugin System**:
    *   [ ] Allow users to define custom "Tools" (e.g., "Run Database Migration") that Agents can invoke.

---

## 📦 Running the Project

### Prerequisites
*   Node.js 18+
*   Rust (cargo)
*   Tauri CLI (`npm install -g @tauri-apps/cli`)
*   **Git**: Must be installed and available in PATH.

### Development
1.  Install dependencies:
    ```bash
    pnpm install
    ```
2.  Run the web interface (UI Only, Mocked Backend):
    ```bash
    pnpm tauri dev
    ```
3.  Build the Desktop App (Requires Rust):
    ```bash
    pnpm tauri build
    ```