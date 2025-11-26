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
     * Executes a tool based on its definition and the arguments provided by the Agent.
     */
    async executeTool(tool: ToolDefinition, call: ToolCall, cwd: string): Promise<string> {
        console.log(`[ToolService] Executing ${tool.name} in ${cwd}`);

        // 1. Interpolate Arguments
        // Command: "npm run test -- {{file}}"
        // Args: { file: "src/utils.ts" }
        // Result: "npm run test -- src/utils.ts"

        let commandStr = tool.command;
        for (const [key, value] of Object.entries(call.arguments)) {
            // Basic sanitization to prevent breaking out of quotes (simple)
            const safeValue = value.replace(/"/g, '\\"');
            commandStr = commandStr.replace(new RegExp(`{{${key}}}`, 'g'), safeValue);
        }

        // 2. Parse Command for Bridge
        // We need to split "npm run test" into cmd="npm" args=["run", "test"]
        // This is naive splitting; handling quoted args with spaces requires a proper tokenizer.
        // For this phase, we assume simple space separation or user provided clean commands.
        const parts = commandStr.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(s => s.replace(/"/g, '')) || [];

        if (parts.length === 0) {
            throw new Error("Tool command is empty after interpolation.");
        }

        const cmd = parts[0];
        const args = parts.slice(1);

        // 3. Execute
        try {
            // We use executeShell (buffered) because tools are usually discrete steps in a plan
            // that we want to capture output from to feed back to the agent.
            const output = await MockTauriService.executeShell(cmd, args, cwd);
            return output;
        } catch (e: any) {
            throw new Error(`Tool execution failed: ${e.message}`);
        }
    }

    validateToolCall(tool: ToolDefinition, call: ToolCall): string | null {
        // Check if all required placeholders in command are present in args
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