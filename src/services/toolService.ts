import { ToolDefinition, ToolCall } from "../types";
import { MockTauriService } from "./tauriBridge";

export class ToolService {
    private static instance: ToolService;

    private constructor() { }

    public static getInstance(): ToolService {
        if (!ToolService.instance) {
            ToolService.instance = new ToolService();
        }
        return ToolService.instance;
    }

    /**
     * Executes a tool and optionally writes output to a target file.
     */
    async executeTool(tool: ToolDefinition, call: ToolCall, cwd: string, outputFile?: string): Promise<string> {
        console.log(`[ToolService] Executing ${tool.name} in ${cwd}`);

        // 1. Interpolate Arguments
        let commandStr = tool.command;
        for (const [key, value] of Object.entries(call.arguments)) {
            const safeValue = value.replace(/"/g, '\\"');
            commandStr = commandStr.replace(new RegExp(`{{${key}}}`, 'g'), safeValue);
        }

        // 2. Parse Command
        const parts = commandStr.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(s => s.replace(/"/g, '')) || [];
        if (parts.length === 0) throw new Error("Tool command empty.");

        const cmd = parts[0];
        const args = parts.slice(1);

        // 3. Execute
        try {
            const output = await MockTauriService.executeShell(cmd, args, cwd);

            // 4. Output Redirection (Context Persistence)
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

    validateToolCall(tool: ToolDefinition, call: ToolCall): string | null {
        const matches = tool.command.match(/{{(.*?)}}/g);
        if (!matches) return null;

        for (const match of matches) {
            const key = match.replace(/{{|}}/g, '');
            if (!call.arguments[key]) {
                return `Missing argument: ${key}`;
            }
        }
        return null;
    }
}