import { imageExtractionTool } from './tools/image-extraction';
import { videoTranscriptTool } from './tools/video-transcript';
import { creativeAnalysisTool } from './tools/creative-analysis';
import { commonFindingsTool } from './tools/common-findings';
import { Tool } from './tool-base';
import { EventEmitter } from 'events';
import { SSEEvent, StreamEmitter, PlanTask } from './types';
import { logger } from './utils/logger';

/**
 * Focused Item - flexible input type
 */
export interface FocusedItem {
    id: string;
    name: string;
    type: 'ad' | 'creative' | 'headline' | 'ad_copy';
    image_url?: string;
    display_format?: 'image' | 'video';
    video_length?: string;
    metrics: Record<string, number>;
}

/**
 * Creative Report for a single item
 * The analysis is now stored as markdown directly
 */
export interface CreativeReport {
    itemId: string;
    itemName: string;
    itemType: 'ad' | 'creative' | 'headline' | 'ad_copy';
    imageDescription: string | null;
    videoTranscript: string | null;
    analysisMarkdown: string;  // Direct markdown output from creative analysis tool
    formattedContent: string;  // Full formatted report ready for display
}

/**
 * Final output of the Creative Insights Agent
 */
export interface CreativeInsightsResult {
    reports: CreativeReport[];
    commonFindings: string | null;
}

/**
 * Internal task for processing each item
 */
interface ItemTask {
    tool: 'image-extraction' | 'video-transcript' | 'creative-analysis';
    description: string;
}

/**
 * CreativeInsightsAgent
 * 
 * Analyzes focused items (ads, creatives, headlines, copy) to generate
 * detailed creative insights reports and common findings across items.
 */
export class CreativeInsightsAgent extends EventEmitter {
    private internalPlannerTool: Tool;

    constructor() {
        super();
        
        // Internal planner to decide tools for each item
        this.internalPlannerTool = new Tool({
            name: "CreativeInsightsPlanner",
            model: "google/gemini-2.5-flash-lite",
            systemPrompt: `You are an internal planner for a Creative Insights Agent.

Given an item's information (type, format), decide which tools to use for analysis.

## AVAILABLE TOOLS
1. **image-extraction**: Analyzes images using vision AI. Use for image ads/creatives.
2. **video-transcript**: Generates video ad script/transcript. Use for video ads/creatives.
3. **creative-analysis**: Performs deep creative analysis. Always use as final step.

## RULES
- Ad/Creative (image format): image-extraction → creative-analysis
- Ad/Creative (video format): video-transcript → creative-analysis
- Headline (text only): creative-analysis only
- Ad Copy (text only): creative-analysis only

## OUTPUT FORMAT
Return a JSON array of tasks:
{
    "tasks": [
        { "tool": "image-extraction" | "video-transcript" | "creative-analysis", "description": "What this task does" }
    ]
}

Keep it simple - only include necessary tools based on the item type and format.
Return ONLY the JSON object.`
        });
    }

    /**
     * Main analysis method with streaming support
     * @param focusedItems - Items to analyze
     * @param objective - Analysis objective
     * @param stream - SSE event emitter function for real-time updates
     */
    async analyzeWithStreaming(
        focusedItems: FocusedItem[], 
        objective: string,
        stream: StreamEmitter
    ): Promise<CreativeInsightsResult> {
        logger.debug('CreativeInsightsAgent', 'Internal analysis starting', { 
            itemsCount: focusedItems.length, 
            objective 
        });

        const reports: CreativeReport[] = [];

        // Process each focused item
        for (let i = 0; i < focusedItems.length; i++) {
            const item = focusedItems[i];
            logger.debug('CreativeInsightsAgent', `Processing item ${i + 1}/${focusedItems.length}`, {
                itemId: item.id,
                itemName: item.name,
                type: item.type,
                displayFormat: item.display_format
            });

            // Create a plan for this item
            const planId = `creative-item-${i + 1}`;
            const tasks = await this.planForItem(item);
            
            // Convert to PlanTask format
            const planTasks: PlanTask[] = tasks.map((t, idx) => ({
                id: `${t.tool}-${idx}`,
                description: t.description,
                tool: t.tool,
                status: 'pending' as const
            }));

            // Emit the plan for this item
            stream({
                type: 'plan',
                planId,
                agentName: 'Creative Insights',
                title: `Analyzing: ${item.name}`,
                tasks: planTasks
            });

            try {
                const report = await this.processItemWithStreaming(item, objective, planId, planTasks, stream);
                reports.push(report);

                // Emit the report - use the pre-formatted content
                stream({
                    type: 'report',
                    reportType: 'creative',
                    reportId: `creative-report-${item.id}`,
                    title: `Creative Insights: ${item.name}`,
                    content: report.formattedContent,
                    itemId: item.id,
                    itemName: item.name,
                    itemData: {
                        thumbnail: item.image_url,
                        displayFormat: item.display_format,
                        videoLength: item.video_length,
                        metrics: {
                            roas: item.metrics.roas,
                            spend: item.metrics.spend,
                            ctr: item.metrics.ctr,
                            impressions: item.metrics.impressions,
                            cost_per_lead: item.metrics.cost_per_lead
                        }
                    }
                });

            } catch (error: any) {
                console.error(`[CreativeInsights] Error processing item ${item.id}:`, error);
                stream({ type: 'text', content: `⚠️ Could not analyze ${item.name}: ${error.message}` });
            }
        }

        // Generate common findings if multiple items
        let commonFindings: string | null = null;
        if (reports.length > 1) {
            // Create plan for common findings
            const commonPlanId = 'common-findings';
            stream({
                type: 'plan',
                planId: commonPlanId,
                agentName: 'Creative Insights',
                title: 'Common Findings Analysis',
                tasks: [
                    { id: 'analyze', description: 'Analyze patterns across all items', tool: 'common-findings', status: 'pending' },
                    { id: 'report', description: 'Generate common findings report', tool: 'reporter', status: 'pending' }
                ]
            });

            stream({ type: 'plan_status', planId: commonPlanId, taskId: 'analyze', status: 'running' });

            commonFindings = await this.generateCommonFindings(reports, objective);

            stream({ type: 'plan_status', planId: commonPlanId, taskId: 'analyze', status: 'completed' });
            stream({ type: 'plan_status', planId: commonPlanId, taskId: 'report', status: 'running' });

            // Emit the common findings report
            stream({
                type: 'report',
                reportType: 'common',
                reportId: 'common-findings-report',
                title: 'Common Findings Report',
                content: commonFindings
            });

            stream({ type: 'plan_status', planId: commonPlanId, taskId: 'report', status: 'completed' });
        }

        return {
            reports,
            commonFindings
        };
    }

    /**
     * Legacy analyze method (for backwards compatibility)
     */
    async analyze(focusedItems: FocusedItem[], objective: string): Promise<CreativeInsightsResult> {
        // Create a no-op stream emitter for legacy usage
        const noOpStream: StreamEmitter = () => {};
        return this.analyzeWithStreaming(focusedItems, objective, noOpStream);
    }

    /**
     * Process a single item with streaming updates
     */
    private async processItemWithStreaming(
        item: FocusedItem, 
        objective: string,
        planId: string,
        tasks: PlanTask[],
        stream: StreamEmitter
    ): Promise<CreativeReport> {
        let imageDescription: string | null = null;
        let videoTranscript: string | null = null;
        let analysisMarkdown: string = '';

        // Execute each task with status updates
        for (const task of tasks) {
            stream({ type: 'plan_status', planId, taskId: task.id, status: 'running' });

            if (task.tool === 'image-extraction' && item.image_url) {
                imageDescription = await imageExtractionTool.extractFromUrl(
                    item.image_url,
                    `Ad/Creative Name: ${item.name}, Type: ${item.type}`
                );
                stream({ type: 'plan_status', planId, taskId: task.id, status: 'completed', result: 'Image analyzed' });

            } else if (task.tool === 'video-transcript') {
                const transcriptInput = `
Ad/Creative Name: ${item.name}
Type: ${item.type}
Format: Video
Metrics: ${JSON.stringify(item.metrics, null, 2)}

Generate a plausible video ad script for this creative.
`;
                videoTranscript = await videoTranscriptTool.process(transcriptInput);
                stream({ type: 'plan_status', planId, taskId: task.id, status: 'completed', result: 'Transcript generated' });

            } else if (task.tool === 'creative-analysis') {
                // Run the analysis - now returns markdown directly
                const analysisInput = this.buildAnalysisInput(item, objective, imageDescription, videoTranscript);
                analysisMarkdown = await creativeAnalysisTool.process(analysisInput);

                stream({ type: 'plan_status', planId, taskId: task.id, status: 'completed', result: 'Analysis complete' });
            }
        }

        const report: CreativeReport = {
            itemId: item.id,
            itemName: item.name,
            itemType: item.type,
            imageDescription,
            videoTranscript,
            analysisMarkdown,
            formattedContent: '' // Will be set below
        };
        
        // Set the formatted content
        report.formattedContent = this.formatFullReport(report);
        
        return report;
    }

    /**
     * Plan which tools to use for an item
     */
    private async planForItem(item: FocusedItem): Promise<ItemTask[]> {
        // Simple deterministic planning based on item type/format
        const tasks: ItemTask[] = [];

        if (item.type === 'ad' || item.type === 'creative') {
            if (item.display_format === 'video') {
                tasks.push({ tool: 'video-transcript', description: 'Generate video transcript' });
            } else if (item.image_url) {
                tasks.push({ tool: 'image-extraction', description: 'Extract image content' });
            }
        }
        // Headlines and ad_copy go directly to analysis (no content extraction needed)

        tasks.push({ tool: 'creative-analysis', description: 'Perform creative analysis' });

        return tasks;
    }

    /**
     * Build the input for creative analysis
     */
    private buildAnalysisInput(
        item: FocusedItem,
        objective: string,
        imageDescription: string | null,
        videoTranscript: string | null
    ): string {
        let input = `
## ITEM INFORMATION
- **Name**: ${item.name}
- **Type**: ${item.type}
- **Format**: ${item.display_format || 'text'}

## PERFORMANCE METRICS
${Object.entries(item.metrics).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

## USER'S OBJECTIVE
${objective}
`;

        if (imageDescription) {
            input += `
## IMAGE DESCRIPTION
${imageDescription}
`;
        }

        if (videoTranscript) {
            input += `
## VIDEO TRANSCRIPT
${videoTranscript}
`;
        }

        if (item.type === 'headline') {
            input += `
## HEADLINE TEXT
"${item.name}"

Analyze this headline for its effectiveness, emotional triggers, and optimization opportunities.
`;
        } else if (item.type === 'ad_copy') {
            input += `
## AD COPY TEXT
"${item.name}"

Analyze this ad copy for persuasion techniques, benefit focus, and improvement opportunities.
`;
        }

        return input;
    }

    /**
     * Format the full report including item name, context, and analysis
     */
    private formatFullReport(report: CreativeReport): string {
        let content = report.analysisMarkdown;
        
        if (report.imageDescription) {
            content += `### Image Analysis\n${report.imageDescription}\n\n`;
        }
        if (report.videoTranscript) {
            content += `### Video Script\n${report.videoTranscript}\n\n`;
        }
        
        return content;
    }

    /**
     * Generate common findings across all reports
     */
    private async generateCommonFindings(reports: CreativeReport[], objective: string): Promise<string> {
        const findingsInput = `
## OBJECTIVE
${objective}

## CREATIVE REPORTS (${reports.length} items)

${reports.map((report, idx) => `
### Report ${idx + 1}: ${report.itemName}
Type: ${report.itemType}

${report.analysisMarkdown}
`).join('\n---\n')}

Based on all the creative analysis reports above, generate a comprehensive Common Findings Report that identifies:
1. **Common Patterns**: Themes, personas, emotions that appear across multiple items
2. **Shared Strengths**: What's working well consistently
3. **Recurring Weaknesses**: Common areas for improvement
4. **Strategic Recommendations**: Actionable insights based on the collective analysis

Format your response as a clear markdown report.
`;

        return await commonFindingsTool.process(findingsInput);
    }
}
