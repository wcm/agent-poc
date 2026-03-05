import { GlobalContext, getLatestFocusItemSet, getLatestCreativeReports, GenerationResult } from '../context';
import { StreamEmitter } from '../types';
import { imageGenerationTool } from './image-generation';
import { videoScriptGenerationTool } from './video-script-generation';
import { logger } from '../utils/logger';

export interface GenerateAdVariationsResult {
    results: GenerationResult[];
}

/**
 * GenerateAdVariations Tool
 *
 * Wrapper/orchestrator that runs when creative insights are ready.
 * For each analyzed item, dispatches to image-generation or video-script-generation
 * based on the ad's displayFormat.
 */
class GenerateAdVariationsToolWrapper {

    async execute(
        stepDescription: string,
        context: GlobalContext,
        stream: StreamEmitter
    ): Promise<GenerateAdVariationsResult> {
        logger.debug('GenerateAdVariationsTool', 'Starting ad variation generation', { stepDescription });

        const focusSet = getLatestFocusItemSet(context);
        if (!focusSet || focusSet.items.length === 0) {
            throw new Error('No focus items available. Run focusItems and creativeInsights first.');
        }

        const creativeReports = getLatestCreativeReports(context);
        if (creativeReports.length === 0) {
            throw new Error('No creative reports available. Run creativeInsights first.');
        }

        const results: GenerationResult[] = [];

        for (let i = 0; i < focusSet.items.length; i++) {
            const item = focusSet.items[i];
            const report = creativeReports.find(r => r.itemId === item.id);

            if (!report) {
                logger.debug('GenerateAdVariationsTool', `No creative report for ${item.name}, skipping`);
                stream({ type: 'text', content: `Skipping ${item.name} — no creative analysis available.` });
                continue;
            }

            logger.debug('GenerateAdVariationsTool', `Processing ${item.name} (${item.displayFormat || 'image'})`);

            try {
                if (item.displayFormat === 'video') {
                    const result = await videoScriptGenerationTool.execute(item, report, context, stream);
                    results.push(result.generationResult);
                } else {
                    const result = await imageGenerationTool.execute(item, report, context, stream);
                    results.push(result.generationResult);
                }
            } catch (error: any) {
                logger.log('ERROR', { component: 'GenerateAdVariationsTool', action: 'GENERATE' }, `${item.name}: ${error.message}`);
                stream({ type: 'text', content: `Failed to generate variations for ${item.name}: ${error.message}` });
            }
        }

        return { results };
    }
}

export const generateAdVariationsTool = new GenerateAdVariationsToolWrapper();
