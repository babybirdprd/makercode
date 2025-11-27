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
                // We use git ls-files because it works cross-platform if git is installed, 
                // and it filters out node_modules garbage automatically.
                command: "git ls-files --full-name",
                requiresApproval: false,
                isSystem: true
            },
            {
                id: "sys_read",
                name: "read_file",
                description: "Read the contents of a file",
                // We use a custom 'read_file' pseudo-command that we intercept in executeTool
                // This avoids 'cat' vs 'type' issues on Windows
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
            const filePath = commandStr.replace('__INTERNAL_READ_FILE__', '').trim();
            // Resolve path relative to CWD
            const fullPath = filePath.startsWith('/') || filePath.match(/^[a-zA-Z]:/) ? filePath : `${cwd}/${filePath}`;
            try {
                return await MockTauriService.readFile(fullPath);
            } catch (e: any) {
                return `Error reading file: ${e.message}`;
            }
        }

        // 3. Parse Command
        // This regex splits by spaces but respects quotes
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
                // Ensure path is absolute or relative to cwd
                const targetPath = outputFile.startsWith('/') ? outputFile : `${cwd}/${outputFile}`;
                await MockTauriService.writeFile(targetPath, output);
            }

            return output;
        } catch (e: any) {
            throw new Error(`Tool execution failed: ${e.message}`);
        }
    }
}