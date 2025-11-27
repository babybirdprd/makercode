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

## 🚦 Current Status (Alpha)

**What Works:**
*   **Decomposition Engine**: Successfully breaks down high-level prompts into atomic sub-tasks.
*   **Git Isolation**: Agents correctly create isolated git worktrees for every step.
*   **Checkpointing**: Code is committed inside worktrees and merged back to `main` only upon success.
*   **File System Bridge**: The app can open external projects and read/write files securely via Tauri.
*   **Voting Logic**: The consensus engine is wired up; high-risk tasks trigger multi-agent voting.

**Known Issues & Limitations:**
*   **Hallucination**: Agents may assume generic web-dev stacks (npm/node) even in Python/Rust projects if context is weak.
*   **Tooling**: Agents cannot yet reliably run arbitrary shell commands (like `pip install`) unless explicitly defined.
*   **Observability**: It is currently difficult to see the *exact* prompt sent to the agent and the *rejected* candidates during voting.

---

## 🗺️ ROADMAP

### Phase 1: The Foundation (✅ Completed)
*   [x] **Hybrid Architecture**: React 19 frontend + Rust/Tauri v2 backend.
*   [x] **Virtual File System**: Async read/write bridging.
*   [x] **Project Persistence**: `.maker/config.json` support.

### Phase 2: The Wiring (✅ Completed)
*   [x] **Local Git Abstraction**: Internal client, worktree isolation, and dirty state protection.
*   [x] **Polyglot Support**: Language Registry and Manifest Detection.
*   [x] **Context Awareness**: Basic file scouting and context injection.

### Phase 3: The "Brain" Upgrade (✅ Completed)
*   [x] **Provider Agnostic AI**: Support for Gemini, OpenAI, etc.
*   [x] **Consensus Engine**: Multi-agent voting and semantic judging.
*   [x] **Dynamic Re-planning**: Auto-decomposition of failed steps.

### Phase 4: Observability & Insights (🚧 Priority)
*   [ ] **The Flight Recorder**: A detailed timeline view showing exactly what each agent "thought", "wrote", and "rejected".
*   [ ] **Diff Visualization**: See exactly what changed in the file system after every atomic step.
*   [ ] **Red Flag Indicators**: Visual warnings when agents produce outputs that violate constraints (too long, bad format).

### Phase 5: Prompt Architecture 2.0 (🚧 Priority)
*   [ ] **External Prompt Files**: Move prompts out of code into `.maker/prompts/*.md` or `.xml` for easy tuning.
*   [ ] **Micro-Role Generation**: Instead of generic "Developers", the system should spawn "PythonDependencyFixer" or "ReactRefactorer" based on the task.
*   [ ] **Strict Output Gates**: Implement the "Red-flagging" from MAKER.txt (e.g., discard outputs > 1000 tokens for atomic edits).

### Phase 6: Tooling Ecosystem
*   [ ] **Hardwired Tools**: Native support for `ls`, `cat`, `grep`, `git status` to allow agents to "orient" themselves.
*   [ ] **User-Defined Tools**: UI for users to register scripts (e.g., `./scripts/deploy.sh`) as tools available to agents.

### Phase 7: Adaptive Intelligence
*   [ ] **Model Routing**: Use cheap models (Flash/Haiku) for simple edits and smart models (Pro/4o/DeepSeek) for architecture.
*   [ ] **Cost Estimation**: Display estimated API cost before executing a massive plan.

---

## 🛠 Tech Stack

*   **Frontend**: React 19, TailwindCSS, Lucide Icons.
*   **Backend / System**: Tauri v2 (Rust), `tauri-plugin-fs`, `tauri-plugin-shell`.
*   **AI Orchestration**: Provider Agnostic.

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