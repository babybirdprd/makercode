# MakerCode

**The Agentic Editor for Zero-Error Execution.**

MakerCode is a next-generation code editor built on the **MAKER Framework** (Massive Agentic Decomposition, Error Correction, and Red-flagging). Unlike traditional AI assistants that simply autocomplete code, MakerCode acts as a fully autonomous software engineering organization in a box. It decomposes high-level tasks into atomic units, executes them in parallel using isolated Git worktrees, and enforces rigorous consensus mechanisms.

---

## 🚦 Current Status (Alpha - "Context Aware")

**✅ What Works:**
*   **Deep Context Awareness**: Agents now automatically "scout" the project structure and read relevant files *before* writing code, eliminating 90% of hallucinations.
*   **Strict Stack Enforcement**: The system detects your tech stack (Python vs Node vs Rust) and proactively forbids agents from using the wrong tools (e.g., no `npm` in Python projects).
*   **The Flight Recorder**: Full observability into every step. You can export detailed JSON traces showing exactly what the agent read, thought, and wrote.
*   **Self-Correction Loops**: If an agent produces output that violates safety rules (Red Flags), the engine automatically rejects it and forces a retry with specific feedback.
*   **Git Isolation**: Every step runs in a temporary Git Worktree. Failed steps never pollute your main branch.

**🚧 Active Development:**
*   **User-Defined Tools**: Currently, agents use built-in tools (`ls`, `read_file`, `grep`). We are building the UI to let you register your own scripts (e.g., `./scripts/deploy.sh`).
*   **Cost Optimization**: We currently use the main model for everything. We are implementing "Model Routing" to use cheaper models for simple tasks (reading files) and smarter models for complex logic.

---

## 🚀 Core Philosophy

The project is built on the premise that LLMs are "autoregressive queens of failure" when asked to do too much at once. To solve this, MakerCode implements:

1.  **Extreme Decomposition**: Tasks are broken down until they are atomic (e.g., "Read file A", "Write file B").
2.  **Read-Before-Write Protocol**: Agents are forced to gather information before attempting generation.
3.  **Micro-Roles**: The system dynamically generates specific personas (e.g., "PythonDataEngineer", "DocumentationSpecialist") tailored to the exact task at hand.
4.  **Polyglot Context**: Intelligent, language-aware context injection prevents cross-language contamination.

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

---

## 🛠 Tech Stack

*   **Frontend**: React 19, TailwindCSS, Lucide Icons.
*   **Backend / System**: Tauri v2 (Rust), `tauri-plugin-fs`, `tauri-plugin-shell`.
*   **AI Orchestration**: Provider Agnostic (OpenAI, Gemini, DeepSeek).

---

## 📦 Running the Project

### Prerequisites
*   Node.js 18+
*   Rust (cargo)
*   Tauri CLI (`npm install -g @tauri-apps/cli`)
*   **Git**: Must be installed and available in PATH.
*   **Ripgrep (rg)**: Recommended for optimal search performance.

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