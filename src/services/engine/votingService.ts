import { Type } from "@google/genai";
import { SubTask, VoteResult, AgentCandidate, AgentProfile } from "../../types";
import { LLMClient } from "../llm";

export class VotingService {
    constructor(private llm: LLMClient | null) { }

    async performVoting(
        step: SubTask,
        leadAgent: AgentProfile,
        context: string,
        agentProfiles: AgentProfile[],
        codeGenerator: (agent: AgentProfile) => Promise<string>
    ): Promise<VoteResult> {

        // 1. Select Voters
        const voters = agentProfiles.filter(p => p.id !== leadAgent.id).slice(0, 2);
        voters.unshift(leadAgent);

        const candidates: AgentCandidate[] = [];

        // 2. Generate Proposals
        await Promise.all(voters.map(async (voter) => {
            const content = await codeGenerator(voter);
            candidates.push({
                id: voter.id,
                agentName: voter.name,
                content: content,
                voteCount: 0,
                reasoning: `Proposed by ${voter.role}`
            });
        }));

        // 3. Semantic Judge
        if (this.llm) {
            try {
                const candidatesPrompt = candidates.map(c =>
                    `--- CANDIDATE ${c.id} (${c.agentName}) ---\n${c.content}\n`
                ).join('\n');

                const schema = {
                    type: Type.OBJECT,
                    properties: {
                        winnerId: { type: Type.STRING },
                        reasoning: { type: Type.STRING }
                    },
                    required: ["winnerId", "reasoning"]
                };

                const response = await this.llm.generate(
                    "SYSTEM: You are the Chief Architect. Evaluate these 3 implementations. Return JSON.",
                    `TASK: ${step.description}\nCONTEXT:\n${context}\n\n${candidatesPrompt}`,
                    schema
                );

                let jsonStr = response.text;
                if (jsonStr.includes('```json')) {
                    jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
                } else if (jsonStr.includes('```')) {
                    jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
                }

                const decision = JSON.parse(jsonStr);
                const winner = candidates.find(c => c.id === decision.winnerId) || candidates[0];

                winner.voteCount = voters.length;
                winner.reasoning = `[JUDGE] ${decision.reasoning}`;

                return {
                    winner: winner.content,
                    voteCount: voters.length,
                    totalVotes: voters.length,
                    isConsensus: true,
                    candidates
                };
            } catch (e) {
                console.error("Judge failed:", e);
            }
        }

        // Fallback
        const winner = candidates[0];
        winner.voteCount = 1;
        return {
            winner: winner.content,
            voteCount: 1,
            totalVotes: voters.length,
            isConsensus: false,
            candidates
        };
    }
}