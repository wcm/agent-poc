import { GlobalContext, getLatestFocusItemSet, getLatestCreativeReports, GenerationResult } from '../context';
import { FocusedItemCard, StreamEmitter } from '../types';
import { imageGenerationTool } from './image-generation';
import { videoScriptGenerationTool } from './video-script-generation';
import { logger } from '../utils/logger';

export interface GenerateAdVariationsResult {
    results: GenerationResult[];
}

const DEFAULT_CONCEPTS_PER_SOURCE = 4;
const DEFAULT_REFERENCE_COUNT = 1;
const MAX_REFERENCE_COUNT = 3;

/**
 * GenerateAdVariations Tool
 *
 * Wrapper/orchestrator that runs when creative insights are ready.
 * For each analyzed item, dispatches to image-generation or video-script-generation
 * based on the ad's displayFormat.
 */
class GenerateAdVariationsToolWrapper {
    private readonly numberWords: Record<string, number> = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
        both: 2
    };

    private extractRequestedItemCount(text: string): number | null {
        const normalized = text.toLowerCase();
        const numericMatch = normalized.match(/\b(?:top|best|first|analyze|generate|for|from|based on)?\s*(\d+)\s+(?:\w+\s+){0,3}?(?:ads?|items?|creatives?|images?|videos?)\b/);
        if (numericMatch) {
            return Number(numericMatch[1]);
        }

        const wordMatch = normalized.match(/\b(?:top|best|first|analyze|generate|for|from|based on)?\s*(one|two|three|four|five|six|seven|eight|nine|ten|both)\s+(?:\w+\s+){0,3}?(?:ads?|items?|creatives?|images?|videos?)\b/);
        if (wordMatch) {
            return this.numberWords[wordMatch[1]] || null;
        }

        return null;
    }

    private shouldProcessAllItems(text: string): boolean {
        const normalized = text.toLowerCase();
        return /\b(all|each|every)\s+(?:ads?|items?|creatives?|images?|videos?)\b/.test(normalized);
    }

    private getItemsToProcess(focusItems: FocusedItemCard[], stepDescription: string, userInput: string) {
        if (this.shouldProcessAllItems(userInput) || this.shouldProcessAllItems(stepDescription)) {
            return focusItems.slice(0, MAX_REFERENCE_COUNT);
        }

        const requestedCount = this.extractRequestedItemCount(userInput) ?? this.extractRequestedItemCount(stepDescription);
        if (requestedCount !== null) {
            return focusItems.slice(0, Math.min(MAX_REFERENCE_COUNT, Math.max(1, requestedCount)));
        }

        return focusItems.slice(0, DEFAULT_REFERENCE_COUNT);
    }

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
        const itemsToProcess = this.getItemsToProcess(focusSet.items, stepDescription, context.userInput);

        logger.debug('GenerateAdVariationsTool', 'Resolved variation item count', {
            availableItems: focusSet.items.length,
            selectedItems: itemsToProcess.length,
            userInput: context.userInput
        });

        for (let i = 0; i < itemsToProcess.length; i++) {
            const item = itemsToProcess[i];
            const report = creativeReports.find(r => r.itemId === item.id);

            if (!report) {
                logger.debug('GenerateAdVariationsTool', `No creative report for ${item.name}, skipping`);
                stream({ type: 'text', content: `Skipping ${item.name} — no creative analysis available.` });
                continue;
            }

            logger.debug('GenerateAdVariationsTool', `Processing ${item.name} (${item.displayFormat || 'image'})`);

            try {
                if (item.displayFormat === 'video') {
                    const result = await videoScriptGenerationTool.execute(item, report, context, stream, DEFAULT_CONCEPTS_PER_SOURCE);
                    results.push(result.generationResult);
                } else {
                    const result = await imageGenerationTool.execute(item, report, context, stream, DEFAULT_CONCEPTS_PER_SOURCE);
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
