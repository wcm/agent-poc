import { Tool } from '../tool-base';
import { GlobalContext, CreativeReport, getLatestFocusItemSet, generateId } from '../context';
import { FocusedItemCard, StreamEmitter, SSEEvent } from '../types';
import { imageExtractionTool } from './image-extraction';
import { videoTranscriptTool } from './video-transcript';
import { creativeAnalysisTool } from './creative-analysis';
import { logger } from '../utils/logger';

/**
 * CreativeInsights Tool Result
 */
export interface CreativeInsightsResult {
    reports: CreativeReport[];
}

/**
 * CreativeInsights Tool
 * 
 * Performs deep creative analysis on focused items.
 * For each item:
 * 1. If image: run image-extraction
 * 2. If video: run video-transcript
 * 3. Run creative-analysis with extraction + metrics
 * 4. Output MD report to chat + context
 */
class CreativeInsightsToolWrapper {
    /**
     * Analyze all items in the latest focus set
     */
    async execute(
        stepDescription: string, 
        context: GlobalContext, 
        stream: StreamEmitter
    ): Promise<CreativeInsightsResult> {
        logger.debug('CreativeInsightsTool', 'Starting analysis', { stepDescription });

        const focusSet = getLatestFocusItemSet(context);
        if (!focusSet || focusSet.items.length === 0) {
            throw new Error('No focus items available. Run focusItems first.');
        }

        const reportResults = await Promise.all(focusSet.items.map(async (item, i) => {
            logger.debug('CreativeInsightsTool', `Processing item ${i + 1}/${focusSet.items.length}`, {
                itemId: item.id,
                itemName: item.name,
                displayFormat: item.displayFormat
            });

            try {
                const report = await this.processItem(item, stepDescription, context);

                // Stream the report to frontend
                stream({
                    type: 'report',
                    reportType: 'creative',
                    reportId: report.id,
                    title: `Creative Insights: ${item.name}`,
                    content: report.content,
                    itemId: item.id,
                    itemName: item.name,
                    itemData: {
                        thumbnail: item.thumbnail,
                        displayFormat: item.displayFormat,
                        metrics: {
                            roas: item.metrics?.roas,
                            spend: item.metrics?.spend,
                            ctr: item.metrics?.ctr,
                            impressions: item.metrics?.impressions
                        }
                    }
                });

                return { index: i, report };

            } catch (error: any) {
                logger.log('ERROR', { component: 'CreativeInsightsTool', action: 'ANALYZE' }, error.message);
                stream({ type: 'text', content: `⚠️ Could not analyze ${item.name}: ${error.message}` });
                return { index: i, report: null };
            }
        }));

        const reports = reportResults
            .sort((a, b) => a.index - b.index)
            .map((result) => result.report)
            .filter((report): report is CreativeReport => report !== null);

        context.creativeReports.push(...reports);

        return { reports };
    }

    /**
     * Process a single item - extract content then analyze
     */
    private async processItem(
        item: FocusedItemCard, 
        stepDescription: string,
        context: GlobalContext
    ): Promise<CreativeReport> {
        let extractedContent: string | null = null;
        let contentType: 'image' | 'video' | null = null;

        // Check if this is a competitor ad (no metrics)
        const isCompetitorAd = !item.metrics || Object.keys(item.metrics).length === 0;

        // Step 1: Extract visual content based on format
        if (item.type === 'ad' || item.type === 'creative') {
            if (item.displayFormat === 'video') {
                // Generate video transcript
                let transcriptInput = `
Ad/Creative Name: ${item.name}
Type: ${item.type}
Format: Video
`;
                if (!isCompetitorAd && item.metrics?.roas) {
                    transcriptInput += `Metrics: ROAS ${item.metrics.roas?.toFixed(2)}, Spend $${item.metrics.spend?.toFixed(0)}, CTR ${(item.metrics.ctr || 0).toFixed(2)}%`;
                } else {
                    transcriptInput += `This is a COMPETITOR AD - focus on creative elements, messaging, and strategy.`;
                }
                transcriptInput += `\n\nGenerate a plausible video ad script for this creative.`;
                
                extractedContent = await videoTranscriptTool.process(transcriptInput);
                contentType = 'video';
                
            } else if (item.thumbnail) {
                // Extract image content
                extractedContent = await imageExtractionTool.extractFromUrl(
                    item.thumbnail,
                    `Ad/Creative Name: ${item.name}, Type: ${item.type}${isCompetitorAd ? ' (COMPETITOR AD)' : ''}`
                );
                contentType = 'image';
            }
        }

        // Step 2: Run creative analysis
        const analysisInput = this.buildAnalysisInput(item, extractedContent, contentType, stepDescription, context.userInput, isCompetitorAd);
        const analysisMarkdown = await creativeAnalysisTool.process(analysisInput);

        // Step 3: Format the full report
        const fullContent = this.formatFullReport(item, extractedContent, contentType, analysisMarkdown);

        return {
            id: generateId('creative-report'),
            focusSetId: getLatestFocusItemSet(context)?.id || '',
            itemId: item.id,
            itemName: item.name,
            content: fullContent,
            timestamp: Date.now()
        };
    }

    /**
     * Build input for creative analysis
     */
    private buildAnalysisInput(
        item: FocusedItemCard,
        extractedContent: string | null,
        contentType: 'image' | 'video' | null,
        stepDescription: string,
        userInput: string,
        isCompetitorAd: boolean = false
    ): string {
        let input = `
## ITEM INFORMATION
- **Name**: ${item.name}
- **Type**: ${item.type}${isCompetitorAd ? ' (COMPETITOR AD)' : ''}
- **Format**: ${item.displayFormat || 'text'}
`;

        if (isCompetitorAd) {
            input += `
## NOTE
This is a COMPETITOR AD - no performance metrics available.
Focus your analysis on:
- Creative strategy and messaging approach
- Visual elements and brand positioning
- Call-to-action effectiveness
- What we can learn and apply to our own ads
`;
        } else {
            input += `
## PERFORMANCE METRICS
- ROAS: ${item.metrics?.roas?.toFixed(2) || 'N/A'}
- Spend: $${item.metrics?.spend?.toFixed(0) || 'N/A'}
- CTR: ${item.metrics?.ctr?.toFixed(2) || 'N/A'}%
- Impressions: ${item.metrics?.impressions?.toLocaleString() || 'N/A'}
- CPC: $${item.metrics?.cpc?.toFixed(2) || 'N/A'}
`;
        }

        input += `
## ANALYSIS OBJECTIVE
${stepDescription}
`;

        if (extractedContent && contentType === 'image') {
            input += `
## IMAGE DESCRIPTION
${extractedContent}
`;
        } else if (extractedContent && contentType === 'video') {
            input += `
## VIDEO TRANSCRIPT
${extractedContent}
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
     * Format the full report with all components
     */
    private formatFullReport(
        item: FocusedItemCard,
        extractedContent: string | null,
        contentType: 'image' | 'video' | null,
        analysisMarkdown: string
    ): string {
        let content = analysisMarkdown;
        
        // Append extracted content section
        if (extractedContent && contentType === 'image') {
            content += `\n\n---\n\n### Visual Analysis\n${extractedContent}`;
        } else if (extractedContent && contentType === 'video') {
            content += `\n\n---\n\n### Video Script\n${extractedContent}`;
        }
        
        return content;
    }
}

export const creativeInsightsTool = new CreativeInsightsToolWrapper();
