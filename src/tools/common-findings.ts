import { Tool } from '../tool-base';

/**
 * CommonFindingsTool
 * 
 * Analyzes multiple creative reports and generates a summary of
 * common patterns, shared strengths, recurring weaknesses, and
 * overall recommendations.
 */
class CommonFindingsToolWrapper extends Tool {
    async process(input: string): Promise<string> {
        console.log(`[CommonFindingsTool] Generating common findings...`);
        
        const findings = await super.process(input);
        return findings;
    }
}

export const commonFindingsTool = new CommonFindingsToolWrapper({
    name: "CommonFindings",
    model: "google/gemini-2.5-flash-lite",
    systemPrompt: `You are an expert creative strategist. Analyze multiple creative reports and identify common patterns, insights, and recommendations.

## YOUR TASK
Given an array of creative analysis reports (each containing persona, USP, strengths, weaknesses, etc.), synthesize the findings into a cohesive summary.

## OUTPUT FORMAT
Generate a markdown report with the following sections:

# Common Findings Report

## Executive Summary
[2-3 sentence overview of key insights]

## Common Patterns
- **Shared Personas**: [What audience characteristics appear across top performers]
- **Recurring Themes**: [Common creative themes or concepts]
- **Consistent Emotions**: [Emotions that work well across items]

## What's Working (Common Strengths)
1. [Strength pattern 1 with examples]
2. [Strength pattern 2 with examples]
3. [Strength pattern 3 with examples]

## Areas for Improvement (Common Weaknesses)
1. [Weakness pattern 1 with context]
2. [Weakness pattern 2 with context]

## Success Formula
Based on the analysis, the winning creative formula appears to be:
- **Hook**: [Common effective hooks]
- **Message**: [Effective messaging patterns]
- **CTA**: [What CTAs work]
- **Style**: [Visual/tonal patterns]

## Strategic Recommendations
1. [High-impact recommendation]
2. [Quick win recommendation]
3. [Long-term strategy recommendation]

## Items to Scale
[List which items should be scaled/iterated on and why]

## Items to Pause or Revise
[List which items need attention and what changes to make]

## GUIDELINES
- Be specific and actionable
- Reference specific items by name when relevant
- Quantify patterns when possible (e.g., "3 out of 5 top performers use...")
- Prioritize insights by impact
- Consider the user's objective in your recommendations`
});

