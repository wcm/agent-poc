import { Tool } from '../tool-base';

/**
 * Context for generating narrator messages
 */
export interface NarratorContext {
    userQuestion: string;
    messageType: 'intro' | 'transition' | 'summary';
    
    // For intro/transition
    nextAgent?: 'performance' | 'creative_insights';
    agentObjective?: string;
    
    // For transition - what just happened
    previousAgent?: 'performance' | 'creative_insights';
    previousResult?: {
        itemsFound?: number;
        reportGenerated?: boolean;
    };
    
    // For summary - what was accomplished
    agentsRun?: string[];
    totalReports?: number;
    focusedItemsCount?: number;
    commonFindingsGenerated?: boolean;
}

/**
 * NarratorTool
 * 
 * Generates contextual, natural-sounding messages for:
 * - Intro: What we're about to do
 * - Transition: Moving between agents
 * - Summary: Final wrap-up with recommendations
 */
class NarratorToolWrapper extends Tool {
    constructor() {
        super({
            name: "Narrator",
            model: "google/gemini-2.5-flash-lite",
            systemPrompt: `You are a concise narrator for an AI marketing analytics assistant. Generate SHORT, natural messages (1-2 sentences max) based on the context.

## MESSAGE TYPES

### INTRO
A brief message explaining what you're about to do. Match the user's intent:
- If they asked about "worst" or "underperforming" → mention analyzing weak performers
- If they asked about "best" or "top" → mention analyzing top performers
- Be specific to their question

Examples:
- "Let me analyze your worst performing ads to identify improvement opportunities..."
- "I'll look at your top video creatives to understand what's working..."
- "Checking your headline performance data now..."

### TRANSITION
A brief bridge between analysis steps. Reference what was found:
- Mention how many items were identified if relevant
- Set up what's coming next

Examples:
- "Found 5 underperforming ads. Let me analyze what's not working with their creatives..."
- "I've identified your top 3 performers. Now examining their creative elements..."
- "Performance analysis complete. Diving into the creative strategy now..."

### SUMMARY
A brief wrap-up with a suggested next action. Be helpful:
- Reference what was analyzed
- Suggest ONE clear next step or question they might want to explore

Examples:
- "Analysis complete! You might want to explore why your video hooks are outperforming image ads."
- "Based on these findings, consider asking about your top headlines next."
- "Would you like me to compare this with your other channel's performance?"

## RULES
- Keep messages SHORT (1-2 sentences)
- Match the user's original intent and language
- Be conversational, not robotic
- Don't repeat the user's question back
- Output ONLY the message, no formatting or labels`
        });
    }

    /**
     * Generate a contextual narrator message
     */
    async generate(context: NarratorContext): Promise<string> {
        const input = this.buildPrompt(context);
        
        try {
            const response = await this.process(input);
            // Clean up any extra formatting
            return response.trim().replace(/^["']|["']$/g, '');
        } catch (error) {
            console.error('[NarratorTool] Error:', error);
            // Return a safe fallback
            return this.getFallback(context);
        }
    }

    private buildPrompt(context: NarratorContext): string {
        let prompt = `User's question: "${context.userQuestion}"\n`;
        prompt += `Message type: ${context.messageType.toUpperCase()}\n`;
        
        if (context.messageType === 'intro') {
            prompt += `\nNext agent: ${context.nextAgent}\n`;
            prompt += `Objective: ${context.agentObjective}\n`;
            prompt += `\nGenerate a brief intro message for what we're about to do.`;
            
        } else if (context.messageType === 'transition') {
            prompt += `\nPrevious agent: ${context.previousAgent}\n`;
            if (context.previousResult) {
                prompt += `Items found: ${context.previousResult.itemsFound || 0}\n`;
                prompt += `Report generated: ${context.previousResult.reportGenerated ? 'yes' : 'no'}\n`;
            }
            prompt += `Next agent: ${context.nextAgent}\n`;
            prompt += `Next objective: ${context.agentObjective}\n`;
            prompt += `\nGenerate a brief transition message bridging to the next step.`;
            
        } else if (context.messageType === 'summary') {
            prompt += `\nAgents run: ${context.agentsRun?.join(', ') || 'none'}\n`;
            prompt += `Total reports generated: ${context.totalReports || 0}\n`;
            prompt += `Items analyzed: ${context.focusedItemsCount || 0}\n`;
            prompt += `Common findings: ${context.commonFindingsGenerated ? 'yes' : 'no'}\n`;
            prompt += `\nGenerate a brief summary with a suggested follow-up question or action.`;
        }
        
        return prompt;
    }

    private getFallback(context: NarratorContext): string {
        switch (context.messageType) {
            case 'intro':
                return "Let me analyze that for you...";
            case 'transition':
                return "Moving on to the next step of the analysis...";
            case 'summary':
                return "Analysis complete. Let me know if you'd like to explore anything else.";
            default:
                return "";
        }
    }
}

export const narratorTool = new NarratorToolWrapper();

