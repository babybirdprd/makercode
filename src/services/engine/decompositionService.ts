import { Type } from "@google/genai";
import { SubTask, ToolDefinition } from "../../types";
import { LLMClient } from "../llm";
import { ContextManager } from "../contextManager";

export class DecompositionService {
    constructor(
        private llm: LLMClient | null,
        private contextManager: ContextManager
    ) { }

    async decompose(prompt: string, tools: ToolDefinition[] = []): Promise<Partial<SubTask>[]> {
        if (!this.llm) {
            console.log("[Decomposition] No LLM Client. Using Mock.");
            await new Promise(r => setTimeout(r, 1000));
            return [
                { id: "1", description: "Setup Project Config", fileTarget: "package.json", dependencies: [] }
            ];
        }

        try {
            console.log("[Decomposition] Analyzing request...");

            const context = await this.contextManager.getArchitectContext(prompt);

            const scoutedInfo = context.scoutedFiles.length > 0
                ? `\nRELEVANT FILES FOUND:\n${context.scoutedFiles.map(f => `FILE: ${f.path}\n${f.content}`).join('\n')}`
                : "";

            const toolsInfo = tools.length > 0
                ? `\nAVAILABLE TOOLS:\n${tools.map(t => `- Name: ${t.name}\n  Description: ${t.description}\n  Args: ${t.command.match(/{{(.*?)}}/g)?.join(', ') || 'None'}`).join('\n')}`
                : "";

            const systemPrompt = `
                SYSTEM: You are the Lead Architect of the MAKER Framework.
                GOAL: Decompose the user's request into a set of ATOMIC steps.
                
                PROJECT CONTEXT:
                - Manifests: ${context.manifests}
                - File Tree:
                ${context.fileTree}
                ${scoutedInfo}
                ${toolsInfo}
                
                RULES:
                1. Granularity: Each step must touch ONLY ONE file OR execute ONE tool.
                2. Dependencies: Build a logical dependency graph.
                3. Tool Usage: If a tool is available and relevant (e.g. 'run_tests'), use it.
                4. Output: STRICT JSON Array.
                
                SCHEMA:
                {
                    id: string,
                    description: string,
                    fileTarget: string,
                    dependencies: string[],
                    toolCall?: { toolName: string, arguments: { [key: string]: string } }
                }
            `;

            const schema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING },
                        description: { type: Type.STRING },
                        fileTarget: { type: Type.STRING },
                        dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
                        toolCall: {
                            type: Type.OBJECT,
                            properties: {
                                toolName: { type: Type.STRING },
                                arguments: { type: Type.OBJECT }
                            },
                            required: ["toolName", "arguments"]
                        }
                    },
                    required: ["id", "description", "fileTarget", "dependencies"]
                }
            };

            const response = await this.llm.generate(systemPrompt, `USER REQUEST: "${prompt}"`, schema);

            let jsonStr = response.text;
            if (jsonStr.includes('```json')) {
                jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
            } else if (jsonStr.includes('```')) {
                jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
            }

            return JSON.parse(jsonStr);

        } catch (e: any) {
            console.error("AI Decomposition failed:", e);
            // FIX: Propagate the actual error message so it appears in the UI
            throw new Error(`AI Decomposition failed: ${e.message || JSON.stringify(e)}`);
        }
    }

    async replan(failedStep: SubTask, errorLog: string): Promise<Partial<SubTask>[]> {
        if (!this.llm) return [];

        console.log(`[Re-planning] Attempting to rescue step: ${failedStep.description}`);

        const systemPrompt = `
            SYSTEM: You are the Crisis Manager of the MAKER Framework.
            SITUATION: An agent failed to execute a step.
            GOAL: Break down the FAILED STEP into smaller, simpler sub-steps to resolve the error.
            
            FAILED STEP: "${failedStep.description}"
            TARGET FILE: ${failedStep.fileTarget}
            ERROR LOG:
            ${errorLog}
            
            RULES:
            1. Analyze the error. Is it a missing file? A syntax error? A logic error?
            2. Create 1-3 new atomic steps to fix the issue.
            3. If the error is unrecoverable (e.g. "API Key invalid"), return an empty array.
            4. Output: STRICT JSON Array of new steps.
        `;

        const schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    description: { type: Type.STRING },
                    fileTarget: { type: Type.STRING },
                    dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
                    riskReason: { type: Type.STRING }
                },
                required: ["id", "description", "fileTarget", "dependencies"]
            }
        };

        try {
            const response = await this.llm.generate(systemPrompt, "Please provide the rescue plan.", schema);

            let jsonStr = response.text;
            if (jsonStr.includes('```json')) {
                jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
            } else if (jsonStr.includes('```')) {
                jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
            }

            const newSteps = JSON.parse(jsonStr);

            // Ensure IDs are unique
            return newSteps.map((s: any) => ({
                ...s,
                id: `${failedStep.id}-rescue-${Math.random().toString(36).substr(2, 4)}`,
                // Inherit dependencies from the failed step plus any internal sequence
                dependencies: s.dependencies.length ? s.dependencies : failedStep.dependencies
            }));

        } catch (e) {
            console.error("Re-planning failed:", e);
            return [];
        }
    }
}