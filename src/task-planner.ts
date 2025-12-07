import { Agent } from './agent';

export const taskAgent = new Agent({
    name: "TaskPlanner",
    model: "claude-sonnet-4-5",
    systemPrompt: `You are an expert project manager and system architect. 
Your goal is to take a user's high-level objective and break it down into clear, actionable steps.
Output format:
1. [Step Name]: [Brief Description]
...

Keep it practical and implementation-focused.`
});

