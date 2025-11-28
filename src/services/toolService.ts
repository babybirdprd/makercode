import { ToolDefinition, ToolCall } from "../types";
import { MockTauriService } from "./tauriBridge";

export class ToolService {
    private static instance: ToolService;
    private systemTools: ToolDefinition[] = [];

    private constructor() {
        this.registerSystemTools();
    }

    public static getInstance(): ToolService {
        if (!ToolService.instance) {
            ToolService.instance = new ToolService();
        }
        return ToolService.instance;
    }

    private registerSystemTools() {
        this.systemTools = [
            {
                id: "sys_ls",
                name: "ls",
                description: "List files in the project (respects .gitignore)",
                command: "git ls-files --full-name",
                requiresApproval: false,
                isSystem: true
            },
            {
                id: "sys_read",
                name: "read_file",
                description: "Read the contents of a file",
                command: "__INTERNAL_READ_FILE__ {{path}}",
                requiresApproval: false,
                isSystem: true
            },
            {
                id: "sys_grep",
                name: "grep",
                description: "Search for patterns in files using Ripgrep (rg)",
                command: "rg -n --no-heading \"{{pattern}}\" {{path}}",
                requiresApproval: false,
                isSystem: true
            }
        ];
    }

    public getAvailableTools(customTools: ToolDefinition[]): ToolDefinition[] {
        return [...this.systemTools, ...customTools];
    }

    /**
     * Executes a tool and optionally writes output to a target file.
     */
    async executeTool(tool: ToolDefinition, call: ToolCall, cwd: string, outputFile?: string): Promise<string> {
        console.log(`[ToolService] Executing ${tool.name} in ${cwd}`);

        // 1. Interpolate Arguments
        let commandStr = tool.command;
        for (const [key, value] of Object.entries(call.arguments)) {
            // Basic sanitization
            const safeValue = value.replace(/"/g, '\\"');
            commandStr = commandStr.replace(new RegExp(`{{${key}}}`, 'g'), safeValue);
        }

        // Handle optional path defaults if missing
        commandStr = commandStr.replace('{{path}}', '.');

        // 2. Intercept Internal Commands
        if (commandStr.startsWith('__INTERNAL_READ_FILE__')) {
            let filePath = commandStr.replace('__INTERNAL_READ_FILE__', '').trim();

            // FIX: Robust Path Resolution
            // If it looks like a Windows absolute path (C:\...), keep it.
            // If it starts with /, but we are in a project, treat it as relative to CWD.
            const isWindowsAbsolute = /^[a-zA-Z]:/.test(filePath);

            if (!isWindowsAbsolute) {
                // Strip leading slash/dot-slash to make it clean relative
                filePath = filePath.replace(/^[\/\\]/, '').replace(/^\.[\/\\]/, '');
                // Join with CWD
                filePath = `${cwd}/${filePath}`;
            }

            try {
                return await MockTauriService.readFile(filePath);
            } catch (e: any) {
                // FIX: Better error logging
                const msg = e.message || (typeof e === 'string' ? e : JSON.stringify(e));
                return `Error reading file ${filePath}: ${msg}`;
            }
        }

        // 3. Parse Command
        const parts = commandStr.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(s => s.replace(/"/g, '')) || [];
        if (parts.length === 0) throw new Error("Tool command empty.");

        const cmd = parts[0];
        const args = parts.slice(1);

        // 4. Execute
        try {
            const output = await MockTauriService.executeShell(cmd, args, cwd);

            // 5. Output Redirection (Context Persistence)
            if (outputFile && outputFile !== 'stdout' && outputFile !== 'stderr') {
                console.log(`[ToolService] Saving output to ${outputFile}`);
                const targetPath = outputFile.startsWith('/') ? outputFile : `${cwd}/${outputFile}`;
                await MockTauriService.writeFile(targetPath, output);
            }

            return output;
        } catch (e: any) {
            const msg = e.message || String(e);
            throw new Error(`Tool execution failed: ${msg}`);
        }
    }
}