import { Tool } from '../tool-base';
import { GlobalContext, ConsolidationReport, generateId } from '../context';
import { logger } from '../utils/logger';

/**
 * ConsolidateFindings Tool Result
 */
export interface ConsolidateFindingsResult {
    report: ConsolidationReport;
    content: string;
}

/**
 * ConsolidateFindings Tool
 * 
 * Compares and synthesizes findings from multiple analyses in the context.
 * Can compare creative reports, analysis reports, find patterns, and generate recommendations.
 */
class ConsolidateFindingsToolWrapper extends Tool {
    constructor() {
        super({
            name: "ConsolidateFindings",
            model: "google/gemini-2.5-flash-lite",
            systemPrompt: `You are an expert marketing strategist. Analyze and compare multiple reports to synthesize insights and recommendations.

## YOUR TASK
Given multiple analysis reports (creative insights, performance analyses), synthesize the findings into actionable insights.

## OUTPUT FORMAT
Generate a markdown report with relevant sections based on the consolidation task:

### For Comparisons (e.g., top vs bottom performers):

# Comparison Analysis

## Executive Summary
[2-3 sentence overview of key differences/insights]

## Key Differences

| Attribute | Top Performers | Bottom Performers |
|-----------|---------------|-------------------|
| Common Persona | ... | ... |
| Dominant Emotion | ... | ... |
| Visual Style | ... | ... |
| Message Focus | ... | ... |

## What Top Performers Do Right
1. [Specific pattern with evidence]
2. [Another pattern]
3. [Third pattern]

## Why Bottom Performers Struggle
1. [Issue with context]
2. [Another issue]

## Winning Formula
Based on the comparison:
- **Hook**: [What works]
- **Message**: [What resonates]
- **Offer**: [Effective offers]
- **Visual**: [Winning visuals]

## Actionable Recommendations
1. [High-impact change to make]
2. [Quick win]
3. [Strategy adjustment]

---

### For Pattern Analysis (single group):

# Pattern Analysis

## Common Success Patterns
[What appears across successful items]

## Strengths to Scale
[What's working that should be expanded]

## Weaknesses to Address
[Common issues to fix]

## Strategic Recommendations
[Action items]

---

## GUIDELINES
- Be specific and reference items by name
- Quantify patterns (e.g., "4 out of 5 top performers...")
- Prioritize actionable insights
- Consider the user's original objective
- Make recommendations concrete and implementable`
        });
    }

    /**
     * Consolidate findings from context
     */
    async execute(stepDescription: string, context: GlobalContext): Promise<ConsolidateFindingsResult> {
        logger.debug('ConsolidateFindingsTool', 'Consolidating', { stepDescription });

        // Gather all relevant reports from context
        const contextSummary = this.buildContextSummary(context);

        const input = `
## CONSOLIDATION TASK
${stepDescription}

## USER'S ORIGINAL REQUEST
${context.userInput}

${contextSummary}

Generate a comprehensive consolidation report based on the task.
`;

        const content = await this.process(input);

        // Create report and add to context
        const report: ConsolidationReport = {
            id: generateId('consolidation'),
            content: content,
            timestamp: Date.now()
        };

        context.consolidationReports.push(report);

        return { report, content };
    }

    /**
     * Build a summary of all relevant context for consolidation
     */
    private buildContextSummary(context: GlobalContext): string {
        const parts: string[] = [];

        // Include focus item sets
        if (context.focusItemSets.length > 0) {
            parts.push('## FOCUS ITEM SETS');
            context.focusItemSets.forEach((set, i) => {
                parts.push(`\n### Set ${i + 1}: ${set.summary}`);
                parts.push(`Items: ${set.items.map(item => {
                    return `${item.name} (ROAS: ${item.metrics.roas?.toFixed(2)}, Spend: $${item.metrics.spend?.toFixed(0)})`;
                }).join(', ')}`);
            });
        }

        // Include creative reports
        if (context.creativeReports.length > 0) {
            parts.push('\n## CREATIVE ANALYSIS REPORTS');
            context.creativeReports.forEach((report, i) => {
                parts.push(`\n### Report ${i + 1}: ${report.itemName}`);
                // Truncate long reports
                const truncated = report.content.length > 1500 
                    ? report.content.slice(0, 1500) + '\n...[truncated]'
                    : report.content;
                parts.push(truncated);
            });
        }

        // Include analysis reports
        if (context.analysisReports.length > 0) {
            parts.push('\n## PERFORMANCE ANALYSIS REPORTS');
            context.analysisReports.forEach((report, i) => {
                parts.push(`\n### Analysis ${i + 1}`);
                const truncated = report.content.length > 1000 
                    ? report.content.slice(0, 1000) + '\n...[truncated]'
                    : report.content;
                parts.push(truncated);
            });
        }

        // Include datasets summary
        if (context.dataSets.length > 0) {
            parts.push('\n## DATA QUERIES EXECUTED');
            context.dataSets.forEach((ds, i) => {
                parts.push(`${i + 1}. ${ds.queryDescription} (${ds.data.length} items)`);
            });
        }

        return parts.join('\n');
    }
}

export const consolidateFindingsTool = new ConsolidateFindingsToolWrapper();

