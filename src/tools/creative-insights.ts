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

        const reports: CreativeReport[] = [];

        // Process each focused item
        for (let i = 0; i < focusSet.items.length; i++) {
            const item = focusSet.items[i];
            logger.debug('CreativeInsightsTool', `Processing item ${i + 1}/${focusSet.items.length}`, {
                itemId: item.id,
                itemName: item.name,
                displayFormat: item.displayFormat
            });

            try {
                const report = await this.processItem(item, stepDescription, context);
                reports.push(report);

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
                            roas: item.metrics.roas,
                            spend: item.metrics.spend,
                            ctr: item.metrics.ctr,
                            impressions: item.metrics.impressions
                        }
                    }
                });

                // Add to context
                context.creativeReports.push(report);

            } catch (error: any) {
                logger.log('ERROR', { component: 'CreativeInsightsTool', action: 'ANALYZE' }, error.message);
                stream({ type: 'text', content: `⚠️ Could not analyze ${item.name}: ${error.message}` });
            }
        }

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

        // Step 1: Extract visual content based on format
        if (item.type === 'ad' || item.type === 'creative') {
            if (item.displayFormat === 'video') {
                // Generate video transcript
                const transcriptInput = `
Ad/Creative Name: ${item.name}
Type: ${item.type}
Format: Video
Metrics: ROAS ${item.metrics.roas?.toFixed(2)}, Spend $${item.metrics.spend?.toFixed(0)}, CTR ${(item.metrics.ctr || 0).toFixed(2)}%

Generate a plausible video ad script for this creative.
`;
                extractedContent = await videoTranscriptTool.process(transcriptInput);
                contentType = 'video';
                
            } else if (item.thumbnail) {
                // Extract image content
                extractedContent = await imageExtractionTool.extractFromUrl(
                    item.thumbnail,
                    `Ad/Creative Name: ${item.name}, Type: ${item.type}`
                );
                contentType = 'image';
            }
        }

        // Step 2: Run creative analysis
        const analysisInput = this.buildAnalysisInput(item, extractedContent, contentType, stepDescription, context.userInput);
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
        userInput: string
    ): string {
        let input = `
## ITEM INFORMATION
- **Name**: ${item.name}
- **Type**: ${item.type}
- **Format**: ${item.displayFormat || 'text'}

## PERFORMANCE METRICS
- ROAS: ${item.metrics.roas?.toFixed(2) || 'N/A'}
- Spend: $${item.metrics.spend?.toFixed(0) || 'N/A'}
- CTR: ${item.metrics.ctr?.toFixed(2) || 'N/A'}%
- Impressions: ${item.metrics.impressions?.toLocaleString() || 'N/A'}
- CPC: $${item.metrics.cpc?.toFixed(2) || 'N/A'}

## ANALYSIS OBJECTIVE
${stepDescription}

## USER'S ORIGINAL REQUEST
${userInput}
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

