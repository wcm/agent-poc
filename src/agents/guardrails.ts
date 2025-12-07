import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

export interface GuardrailResult {
    passed: boolean;
    reason?: string;
}

export class Guardrails {
    
    static async validateInput(input: string): Promise<GuardrailResult> {
        const lowerInput = input.toLowerCase();

        // 1. Length Check
        if (input.length > 5000) {
            return { passed: false, reason: "Input is too long. Please keep it under 5000 characters." };
        }

        // 2. Safety / Jailbreak Check
        const unsafeKeywords = [
            "ignore previous instructions", 
            "system override", 
            "forget your instructions",
            "prompt injection"
        ];
        for (const keyword of unsafeKeywords) {
            if (lowerInput.includes(keyword)) {
                return { passed: false, reason: "Request rejected due to safety policy (potential prompt injection)." };
            }
        }

        // 3. PII Check (Sensitive Personal Info)
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
        const creditCardRegex = /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/;

        if (emailRegex.test(input)) {
            return { passed: false, reason: "Input contains potential Email Address. Please remove personal information." };
        }
        if (phoneRegex.test(input)) {
            return { passed: false, reason: "Input contains potential Phone Number. Please remove personal information." };
        }
        if (creditCardRegex.test(input)) {
             return { passed: false, reason: "Input contains potential Financial Information. Please remove personal information." };
        }

        // 4. Relevance Check (LLM-based)
        try {
            const client = new Anthropic({
                apiKey: process.env.ANTHROPIC_API_KEY,
            });

            const classification = await client.messages.create({
                model: "claude-sonnet-4-5",
                max_tokens: 10,
                system: `You are a strict relevance classifier. 
Your task is to determine if the user input is related to Marketing, Advertising, Data Analysis, Business Strategy, or general pleasantries (hello, hi, etc).
Respond with ONLY 'YES' or 'NO'.`,
                messages: [{ role: "user", content: input }]
            });

            const contentBlock = classification.content[0];
            if (contentBlock.type === 'text') {
                const answer = contentBlock.text.trim().toUpperCase();
                if (answer.includes('NO')) {
                    return { passed: false, reason: "Input does not seem related to Marketing or Ads Data analysis." };
                }
            }
        } catch (error) {
            console.error("Relevance check failed:", error);
            // Fallback: If LLM fails, we default to permissive or restrictive. 
            // For a prototype, let's warn but allow, or fail if we want strictness.
            // Let's fail to ensure safety.
            return { passed: false, reason: "Unable to verify input relevance due to system error." };
        }

        return { passed: true };
    }

    static async validateOutput(output: string): Promise<GuardrailResult> {
        if (!output) {
            return { passed: false, reason: "Empty output received." };
        }
        return { passed: true };
    }
}
