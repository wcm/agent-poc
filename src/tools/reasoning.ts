import { Tool } from '../tool-base';

export const reasoningTool = new Tool({
    name: "Reasoning",
    model: "google/gemini-2.5-flash-lite",
    systemPrompt: `You are a Reasoning Tool. 
Your role is to analyze information, draw conclusions, and provide logical explanations.
Perform the reasoning task and provide a clear, succinct text-based reasoning.`
});

