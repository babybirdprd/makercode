import { GoogleGenAI } from "@google/genai";
import { MakerConfig } from "../types";

export interface LLMResponse {
    text: string;
}

export interface LLMClient {
    generate(systemPrompt: string, userPrompt: string, schema?: any): Promise<LLMResponse>;
}

export class LLMFactory {
    static create(config: MakerConfig): LLMClient {
        if (config.llmProvider === 'openai') {
            return new OpenAIClient(config);
        }
        return new GeminiClient(config);
    }
}

class GeminiClient implements LLMClient {
    private ai: GoogleGenAI | null = null;

    constructor(private config: MakerConfig) {
        if (config.geminiApiKey) {
            this.ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
        }
    }

    async generate(systemPrompt: string, userPrompt: string, schema?: any): Promise<LLMResponse> {
        if (!this.ai) throw new Error("Gemini API Key missing");

        const modelId = "gemini-2.0-flash";
        const reqConfig: any = { responseMimeType: "text/plain" };

        if (schema) {
            reqConfig.responseMimeType = "application/json";
            reqConfig.responseSchema = schema;
        }

        try {
            console.log(`[LLM] Gemini Request: ${modelId}`);
            const response = await this.ai.models.generateContent({
                model: modelId,
                contents: [
                    { role: 'user', parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }
                ],
                config: reqConfig
            });
            return { text: response.text || "" };
        } catch (e: any) {
            console.error("[LLM] Gemini Error:", e);
            throw new Error(`Gemini Error: ${e.message}`);
        }
    }
}

class OpenAIClient implements LLMClient {
    constructor(private config: MakerConfig) { }

    async generate(systemPrompt: string, userPrompt: string, schema?: any): Promise<LLMResponse> {
        const apiKey = this.config.openaiApiKey || "";

        // DEBUG: Log key status (Masked)
        if (!apiKey) {
            console.error("[LLM] OpenAI Client initialized WITHOUT API Key.");
        } else {
            console.log(`[LLM] OpenAI Client using Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);
        }

        let baseUrl = (this.config.openaiBaseUrl || "https://api.openai.com/v1").trim();
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
        if (baseUrl.endsWith('/chat/completions')) baseUrl = baseUrl.replace('/chat/completions', '');

        const model = this.config.openaiModel || "gpt-4o";
        const endpoint = `${baseUrl}/chat/completions`;

        console.log(`[LLM] OpenAI Request: ${model} -> ${endpoint}`);

        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        };

        const body: any = {
            model: model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.2
        };

        if (schema) {
            body.response_format = { type: "json_object" };
            body.messages[0].content += `\n\nOUTPUT MUST BE VALID JSON MATCHING THIS SCHEMA:\n${JSON.stringify(schema, null, 2)}`;
        }

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers,
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errText = await res.text();
                let errJson;
                try { errJson = JSON.parse(errText); } catch { }

                console.error(`[LLM] API Error ${res.status} at ${endpoint}:`, errText);

                const friendlyMsg = errJson?.error?.message || errText || res.statusText;
                throw new Error(`API Error (${res.status}): ${friendlyMsg}`);
            }

            const data = await res.json();
            const text = data.choices?.[0]?.message?.content || "";
            return { text };
        } catch (e: any) {
            console.error("[LLM] Provider Error:", e);
            throw new Error(`Provider Error: ${e.message}`);
        }
    }
}