import { Tool } from '../tool-base';
import { GlobalContext, getContextSummary } from '../context';

/**
 * Narrator message types
 */
export type NarratorMessageType = 
    | 'intro'           // Start of analysis
    | 'step_complete'   // After a tool completes
    | 'transition'      // Between major phases
    | 'final'           // End of plan with suggestions
    | 'error';          // When something goes wrong

/**
 * Context for generating narrator messages
 */
export interface NarratorInput {
    type: NarratorMessageType;
    userInput: string;
    stepDescription?: string;           // Current/next step description
    stepResult?: string;                // Result from previous step
    previousStepDescription?: string;   // What the previous step did
    planObjective?: string;
    completedSteps?: number;
    totalSteps?: number;
    context: GlobalContext;
    error?: string;
}

/**
 * NarratorTool
 * 
 * Generates contextual, natural-sounding messages:
 * - Intro: What we're about to do
 * - Step complete: Brief update after each step
 * - Transition: Moving between phases
 * - Final: Summary with suggested next actions
 */
class NarratorToolWrapper extends Tool {
    constructor() {
        super({
            name: "Narrator",
            model: "google/gemini-2.5-flash-lite",
            systemPrompt: `You are a concise narrator for an AI marketing analytics assistant. Generate SHORT, natural messages based on the context.

## MESSAGE TYPES

### INTRO
Brief intro (1 sentence) about what you're starting. Match the user's intent.
Example: "Let me analyze your top performing ads to find success patterns..."

### STEP_COMPLETE  
Very brief acknowledgment (1 short sentence or skip if obvious from results).
Example: "Found 5 high-ROAS ads." or "Analysis complete for Summer Campaign."

### TRANSITION
Bridge between steps - summarize what was just done and introduce the next step (1-2 sentences).
Examples:
- "Found 5 high-performing ads with strong ROAS. Now let me analyze their creative elements..."
- "The top spenders share similar messaging patterns. Let me compare these with your ROAS performers..."
- "Creative analysis complete for your top ads. Now examining your underperformers to find the differences..."

### FINAL
Summary (1-2 sentences) with a SPECIFIC suggested next action or question.
Examples:
- "Based on this analysis, your video hooks outperform images by 40%. Would you like me to analyze what makes your video intros effective?"
- "I found that urgency messaging drives 2x higher ROAS. Want me to suggest ways to add urgency to your underperforming ads?"
- "Your top ads share a 'social proof' pattern. Should I compare these patterns against your TikTok integration?"

### ERROR
Friendly error message explaining what went wrong.
Example: "I couldn't complete the analysis because no data was found for those filters. Try adjusting your criteria."

## RULES
- Keep messages SHORT (1-2 sentences max)
- Match the user's original intent
- Be conversational, not robotic
- For FINAL messages, ALWAYS suggest a specific follow-up action
- Don't repeat what's already shown in reports
- Output ONLY the message text, no formatting`
        });
    }

    /**
     * Generate a contextual narrator message
     */
    async generate(input: NarratorInput): Promise<string> {
        const prompt = this.buildPrompt(input);
        
        try {
            const response = await this.process(prompt);
            const message = response.trim().replace(/^["']|["']$/g, '');
            
            // Add to narrator history for follow-up context
            input.context.narratorHistory.push(message);
            
            return message;
        } catch (error) {
            console.error('[NarratorTool] Error:', error);
            return this.getFallback(input.type);
        }
    }

    /**
     * Build the prompt for the LLM
     */
    private buildPrompt(input: NarratorInput): string {
        let prompt = `User's request: "${input.userInput}"\n`;
        prompt += `Message type: ${input.type.toUpperCase()}\n`;
        
        if (input.planObjective) {
            prompt += `Plan objective: ${input.planObjective}\n`;
        }

        switch (input.type) {
            case 'intro':
                prompt += `\nGenerate a brief intro for what we're about to do.`;
                break;
                
            case 'step_complete':
                prompt += `\nStep completed: ${input.stepDescription}\n`;
                if (input.stepResult) {
                    prompt += `Result: ${input.stepResult}\n`;
                }
                prompt += `Progress: ${input.completedSteps}/${input.totalSteps} steps\n`;
                prompt += `\nGenerate a very brief acknowledgment (or empty if the result speaks for itself).`;
                break;
                
            case 'transition':
                prompt += `\nPrevious step: ${input.previousStepDescription || 'N/A'}\n`;
                prompt += `Previous result: ${input.stepResult || 'N/A'}\n`;
                prompt += `Next step: ${input.stepDescription}\n`;
                prompt += `Progress: ${input.completedSteps}/${input.totalSteps} steps\n`;
                prompt += `\nGenerate a brief transition that:
1. Briefly summarizes what we just found/did (from previous result)
2. Introduces what we're about to do next
Keep it to 1-2 sentences.`;
                break;
                
            case 'final':
                prompt += `\nAll ${input.totalSteps} steps completed.\n`;
                prompt += `\nContext summary:\n${getContextSummary(input.context)}\n`;
                prompt += `\nGenerate a brief summary with a SPECIFIC suggested follow-up action.`;
                break;
                
            case 'error':
                prompt += `\nError occurred: ${input.error}\n`;
                prompt += `\nGenerate a friendly error message.`;
                break;
        }
        
        return prompt;
    }

    /**
     * Fallback messages for each type
     */
    private getFallback(type: NarratorMessageType): string {
        switch (type) {
            case 'intro':
                return "Let me analyze that for you...";
            case 'step_complete':
                return ""; // Silent for step completions
            case 'transition':
                return "Moving to the next step...";
            case 'final':
                return "Analysis complete. What would you like to explore next?";
            case 'error':
                return "Something went wrong. Please try again.";
            default:
                return "";
        }
    }
}

export const narratorTool = new NarratorToolWrapper();
