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
            },
            {
                id: "sys_mkdir",
                name: "make_directory",
                description: "Create one or more directories recursively. Usage: path/to/dir",
                command: "__INTERNAL_MKDIR__ {{path}}",
                requiresApproval: false,
                isSystem: true
            },
            {
                id: "sys_exec",
                name: "execute_command",
                description: "Execute a system shell command. Allowed: git, npm, node, cargo, python, pip, touch, echo. Usage: <command> <args>",
                command: "{{command}} {{args}}",
                requiresApproval: true,
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

        // SPECIAL HANDLING: execute_command
        // Bypass string interpolation to preserve argument integrity (arrays, complex strings)
        if (tool.name === 'execute_command') {
            const cmd = String(call.arguments.command);
            let args: string[] = [];

            if (Array.isArray(call.arguments.args)) {
                args = call.arguments.args.map(String);
            } else if (typeof call.arguments.args === 'string') {
                // If it's a string, try to split it safely, but prefer array input from LLM
                args = (call.arguments.args as string).split(' ');
            }

            // Handle "echo 'content' > file" pattern simulated by LLM
            if (cmd === 'echo' && args.includes('>')) {
                const redirectIndex = args.indexOf('>');
                const content = args.slice(0, redirectIndex).join(' ');
                const targetFile = args[redirectIndex + 1];

                // Remove quotes if the LLM added them to the content
                const cleanContent = content.replace(/^['"]|['"]$/g, '');

                const fullPath = `${cwd}/${targetFile}`;
                await MockTauriService.writeFile(fullPath, cleanContent);
                return `Written to ${targetFile}`;
            }

            // Handle 'touch' manually since it's not a standard Windows command
            if (cmd === 'touch') {
                for (const file of args) {
                    const fullPath = `${cwd}/${file}`;
                    // Only write if not exists to mimic touch, or just write empty string
                    try {
                        await MockTauriService.readFile(fullPath);
                    } catch {
                        await MockTauriService.writeFile(fullPath, "");
                    }
                }
                return `Touched ${args.join(', ')}`;
            }

            return await MockTauriService.executeShell(cmd, args, cwd);
        }

        // STANDARD HANDLING: String Interpolation
        let commandStr = tool.command;
        for (const [key, value] of Object.entries(call.arguments)) {
            let safeValue = "";

            if (Array.isArray(value)) {
                safeValue = value.map(v => String(v).replace(/"/g, '\\"')).join(' ');
            } else {
                safeValue = String(value).replace(/"/g, '\\"');
            }

            commandStr = commandStr.replace(new RegExp(`{{${key}}}`, 'g'), safeValue);
        }

        // Handle optional path defaults if missing
        commandStr = commandStr.replace('{{path}}', '.');
        commandStr = commandStr.replace('{{args}}', ''); // Cleanup unused args placeholder

        // Intercept Internal Commands
        if (commandStr.startsWith('__INTERNAL_READ_FILE__')) {
            return this.handleInternalRead(commandStr, cwd);
        }

        if (commandStr.startsWith('__INTERNAL_MKDIR__')) {
            return this.handleInternalMkdir(commandStr, cwd);
        }

        // Parse Command
        const parts = commandStr.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(s => s.replace(/"/g, '')) || [];
        if (parts.length === 0) throw new Error("Tool command empty.");

        const cmd = parts[0];
        const args = parts.slice(1);

        // Execute with Fallback
        try {
            const output = await MockTauriService.executeShell(cmd, args, cwd);
            await this.handleOutput(output, cwd, outputFile);
            return output;
        } catch (e: any) {
            // Fallback for 'rg' on Windows (Program Not Found issue)
            if (cmd === 'rg' && e.message.includes('not found')) {
                console.warn("[ToolService] Direct rg execution failed. Attempting shell fallback...");
                try {
                    const isWindows = navigator.userAgent.includes('Windows');
                    if (isWindows) {
                        const shellOutput = await MockTauriService.executeShell('cmd', ['/C', commandStr], cwd);
                        await this.handleOutput(shellOutput, cwd, outputFile);
                        return shellOutput;
                    }
                } catch (shellError: any) {
                    const msg = e.message || String(e);
                    throw new Error(`Tool execution failed (Direct & Shell): ${msg} | ${shellError.message}`);
                }
            }

            const msg = e.message || String(e);
            throw new Error(`Tool execution failed: ${msg}`);
        }
    }

    private async handleInternalRead(commandStr: string, cwd: string): Promise<string> {
        let filePath = commandStr.replace('__INTERNAL_READ_FILE__', '').trim();
        const isWindowsAbsolute = /^[a-zA-Z]:/.test(filePath);

        if (!isWindowsAbsolute) {
            filePath = filePath.replace(/^[\/\\]/, '').replace(/^\.[\/\\]/, '');
            filePath = `${cwd}/${filePath}`;
        }

        try {
            return await MockTauriService.readFile(filePath);
        } catch (e: any) {
            const msg = e.message || (typeof e === 'string' ? e : JSON.stringify(e));
            return `Error reading file ${filePath}: ${msg}`;
        }
    }

    private async handleInternalMkdir(commandStr: string, cwd: string): Promise<string> {
        const rawArgs = commandStr.replace('__INTERNAL_MKDIR__', '').trim();
        const parts = rawArgs.split(/\s+/).filter(p => !p.startsWith('-'));

        const results: string[] = [];

        for (const part of parts) {
            let targetPath = part;
            if (!/^[a-zA-Z]:/.test(targetPath) && !targetPath.startsWith('/')) {
                targetPath = `${cwd}/${targetPath}`;
            }

            try {
                await MockTauriService.mkdir(targetPath);
                results.push(`Created: ${part}`);
            } catch (e: any) {
                results.push(`Failed ${part}: ${e.message}`);
            }
        }

        return results.join('\n');
    }

    private async handleOutput(output: string, cwd: string, outputFile?: string) {
        if (outputFile && outputFile !== 'stdout' && outputFile !== 'stderr') {
            console.log(`[ToolService] Saving output to ${outputFile}`);
            const targetPath = outputFile.startsWith('/') ? outputFile : `${cwd}/${outputFile}`;
            await MockTauriService.writeFile(targetPath, output);
        }
    }
}