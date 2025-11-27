import { Type } from "@google/genai";
import { SubTask, ToolDefinition } from "../../types";
import { LLMClient } from "../llm";
import { ContextManager } from "../contextManager";
import { Prompts } from "../prompts";

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
                {
                    id: "1",
                    description: "Setup Project Config",
                    fileTarget: "package.json",
                    dependencies: [],
                    role: "ConfigSpecialist",
                    roleDescription: "Expert in Node.js configuration"
                }
            ];
        }

        try {
            console.log("[Decomposition] Analyzing request...");

            const context = await this.contextManager.getArchitectContext(prompt, tools);
            const systemPrompt = Prompts.DECOMPOSITION_SYSTEM(context);

            const schema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING },
                        description: { type: Type.STRING },
                        fileTarget: { type: Type.STRING },
                        dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
                        role: { type: Type.STRING, description: "The specific persona needed (e.g. PythonExpert)" },
                        roleDescription: { type: Type.STRING, description: "Description of the persona's expertise" },
                        toolCall: {
                            type: Type.OBJECT,
                            properties: {
                                toolName: { type: Type.STRING },
                                arguments: { type: Type.OBJECT }
                            },
                            required: ["toolName", "arguments"]
                        },
                        riskReason: { type: Type.STRING }
                    },
                    required: ["id", "description", "fileTarget", "dependencies", "role"]
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
            throw new Error(`AI Decomposition failed: ${e.message || JSON.stringify(e)}`);
        }
    }

    async replan(failedStep: SubTask, errorLog: string): Promise<Partial<SubTask>[]> {
        if (!this.llm) return [];

        console.log(`[Re-planning] Attempting to rescue step: ${failedStep.description}`);

        const systemPrompt = Prompts.REPLAN_SYSTEM(failedStep.description, errorLog);

        const schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    description: { type: Type.STRING },
                    fileTarget: { type: Type.STRING },
                    dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
                    role: { type: Type.STRING },
                    roleDescription: { type: Type.STRING },
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
                dependencies: s.dependencies.length ? s.dependencies : failedStep.dependencies
            }));

        } catch (e) {
            console.error("Re-planning failed:", e);
            return [];
        }
    }
}