import Anthropic from '@anthropic-ai/sdk';

    export interface AgentConfig {
        name: string;
        model: string;
        systemPrompt: string;
        apiKey?: string;
        maxTokens?: number; // Optional configuration for max tokens
    }
    
    export class Agent {
        private client: Anthropic;
        private config: AgentConfig;
        private history: Anthropic.MessageParam[] = [];
    
        constructor(config: AgentConfig) {
            this.config = config;
            this.client = new Anthropic({
                apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
            });
        }
    
        async process(input: string): Promise<string> {
            console.log(`[${this.config.name}] Processing input...`);
    
            // Add user message to history
            this.history.push({ role: 'user', content: input });
    
            try {
                const response = await this.client.messages.create({
                    model: this.config.model,
                    max_tokens: this.config.maxTokens || 4096, // Increased default to 4096, configurable
                    system: this.config.systemPrompt,
                    messages: this.history,
                });
    
                // Extract text content
            const contentBlock = response.content[0];
            if (contentBlock.type !== 'text') {
                 throw new Error('Unexpected response type from Claude');
            }
            const output = contentBlock.text;

            // Add assistant message to history
            this.history.push({ role: 'assistant', content: output });

            return output;

        } catch (error) {
            console.error(`[${this.config.name}] Error:`, error);
            throw error;
        }
    }

    // Special method for Error Agents to handle rejections
    async processError(failedInput: string, reason: string): Promise<string> {
        const context = `User Input: "${failedInput}"\nRejection Reason: "${reason}"`;
        
        try {
            const response = await this.client.messages.create({
                model: this.config.model,
                max_tokens: 1024,
                system: this.config.systemPrompt,
                messages: [{ role: 'user', content: context }],
            });

            const contentBlock = response.content[0];
             if (contentBlock.type !== 'text') {
                 return "I apologize, but I cannot process your request at this time.";
            }
            return contentBlock.text;
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
