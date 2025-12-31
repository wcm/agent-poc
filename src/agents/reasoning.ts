import { Agent } from '../agent';

export const reasoningAgent = new Agent({
    name: "ReasoningAgent",
    model: "google/gemini-2.5-flash-lite",
    systemPrompt: `You are a Reasoning Agent. 
Your role is to analyze information, draw conclusions, and provide logical explanations.
Perform the reasoning task and provide a clear, succinct text-based reasoning.`
});

