
import { OpenRouter } from "@openrouter/sdk";
import * as dotenv from 'dotenv';

dotenv.config();

export interface AgentConfig {
    name: string;
    model: string;
    systemPrompt: string;
    apiKey?: string;
    maxTokens?: number;
}

export class Agent {
    private client: OpenRouter;
    private config: AgentConfig;
    private history: any[] = [];

    constructor(config: AgentConfig) {
        this.config = config;
        this.client = new OpenRouter({
            apiKey: config.apiKey || process.env.OPENROUTER_API_KEY,
        });
    }

    async process(input: string): Promise<string> {
        console.log(`[${this.config.name}] Processing input...`);

        this.history.push({ role: 'user', content: input });

        try {
            // Updated: Passing headers in the SECOND argument (options)
            const response: any = await this.client.chat.send({
                model: this.config.model,
                messages: [{ role: 'system', content: this.config.systemPrompt }, ...this.history],
                // OpenRouter might map maxTokens differently or pass it through
                max_tokens: this.config.maxTokens || 4096,
            } as any, { // casting to any to avoid strict type checks on body properties for prototyping
                headers: {
                    "HTTP-Referer": "https://localhost:3000",
                    "X-Title": "Atria Agent POC",
                }
            });

            const output = response.choices?.[0]?.message?.content || response.content || "";

            if (!output) {
                console.log("Raw Response:", JSON.stringify(response));
                throw new Error('Empty response from OpenRouter/Model');
            }

            this.history.push({ role: 'assistant', content: output });

            return output;

        } catch (error) {
            console.error(`[${this.config.name}] Error:`, error);
            throw error;
        }
    }

    async processError(failedInput: string, reason: string): Promise<string> {
        const context = `User Input: "${failedInput}"\nRejection Reason: "${reason}"`;

        try {
            const response: any = await this.client.chat.send({
                model: this.config.model,
                messages: [
                    { role: 'system', content: this.config.systemPrompt },
                    { role: 'user', content: context }
                ]
            });

            return response.choices?.[0]?.message?.content || response.content || "I apologize, but I cannot process your request at this time.";
        } catch (e) {
            console.error("Error Agent failed:", e);
            return `I apologize, but I cannot process your request because it violated our safety policies (${reason}).`;
        }
    }

    getHistory() {
        return this.history;
    }

    clearHistory() {
        this.history = [];
    }
}
