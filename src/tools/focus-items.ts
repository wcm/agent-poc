import { Tool } from '../tool-base';
import { GlobalContext, FocusItemSet, getLatestDataSet, generateId, AdData } from '../context';
import { FocusedItemCard } from '../types';
import { logger } from '../utils/logger';

/**
 * FocusItems Tool Result
 */
export interface FocusItemsResult {
    focusSet: FocusItemSet;
    items: FocusedItemCard[];
    summary: string;
}

/**
 * FocusItems Tool
 * 
 * Selects specific items from the latest dataset for detailed analysis.
 * Can be called multiple times per plan (each creates a new focus set).
 */
class FocusItemsToolWrapper extends Tool {
    constructor() {
        super({
            name: "FocusItems",
            model: "google/gemini-2.5-flash-lite",
            systemPrompt: `You are a Focus Item Selector for a Marketing Analytics AI.

## YOUR TASK
Given a dataset and selection criteria, identify which items to focus on for detailed analysis.

## OUTPUT FORMAT
Return a JSON object:
{
    "selectedIds": ["id1", "id2", ...],
    "summary": "Brief description of what was selected (e.g., 'Top 3 performers by ROAS')",
    "selectionReason": "Why these items were selected"
}

## SELECTION RULES
1. If "top N" is requested, select the first N items (data is pre-sorted)
2. If "worst/bottom N" is requested, select from the end (or first N if sorted ascending)
3. Default to selecting 3-5 items unless specified otherwise
4. Match the user's intent from the task description
5. Return actual IDs from the data (don't make them up)

## EXAMPLES

Task: "Select top 3 high-spend ads"
Data sorted by spend DESC
→ Select first 3 items

Task: "Select worst performing ads"
Data sorted by ROAS ASC
→ Select first 3 items (lowest ROAS)

Task: "Select top 5 video ads"
→ Select first 5 items (assuming data is filtered to videos)`
        });
    }

    /**
     * Select focus items from the latest dataset
     */
    async execute(stepDescription: string, context: GlobalContext): Promise<FocusItemsResult> {
        logger.debug('FocusItemsTool', 'Selecting items', { stepDescription });

        const dataSet = getLatestDataSet(context);
        if (!dataSet) {
            throw new Error('No data available. Run dataQuery first.');
        }

        // Prepare data summary for selection
        const dataSummary = dataSet.data.map(item => ({
            id: item.id,
            name: item.ad_name || item.group_value || item.creative_name || 'Unknown',
            format: item.display_format,
            roas: item.metrics.roas,
            spend: item.metrics.spend,
            ctr: item.metrics.ctr
        }));

        const input = `
## SELECTION TASK
${stepDescription}

## USER'S ORIGINAL REQUEST
${context.userInput}

## AVAILABLE DATA (${dataSet.data.length} items, sorted by ${dataSet.queryParams.sortBy || 'default'})
${JSON.stringify(dataSummary, null, 2)}

Select the appropriate items based on the task.
`;

        try {
            const response = await this.process(input);
            
            let selection;
            try {
                const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
                selection = JSON.parse(cleanJson);
            } catch (e) {
                const match = response.match(/\{[\s\S]*\}/);
                if (match) {
                    selection = JSON.parse(match[0]);
                } else {
                    // Default fallback - select first 3
                    selection = {
                        selectedIds: dataSet.data.slice(0, 3).map(d => d.id),
                        summary: `Top ${Math.min(3, dataSet.data.length)} items`,
                        selectionReason: 'Default selection'
                    };
                }
            }

            // Find selected items in dataset
            const selectedItems = this.findSelectedItems(selection.selectedIds, dataSet.data);
            
            // Convert to FocusedItemCard format
            const focusedCards: FocusedItemCard[] = selectedItems.map(item => ({
                id: item.id,
                name: item.ad_name || item.group_value || item.creative_name || 'Unknown',
                thumbnail: item.image_url,
                type: this.determineItemType(dataSet.queryParams.groupBy),
                displayFormat: item.display_format,
                metrics: {
                    roas: item.metrics.roas,
                    spend: item.metrics.spend,
                    ctr: item.metrics.ctr,
                    impressions: item.metrics.impressions,
                    cpc: item.metrics.cpc
                }
            }));

            // Create focus set
            const focusSet: FocusItemSet = {
                id: generateId('focusset'),
                summary: selection.summary || `Selected ${focusedCards.length} items`,
                items: focusedCards,
                dataSetId: dataSet.id,
                timestamp: Date.now()
            };

            context.focusItemSets.push(focusSet);

            return {
                focusSet,
                items: focusedCards,
                summary: selection.summary
            };

        } catch (error) {
            logger.log('ERROR', { component: 'FocusItemsTool', action: 'SELECT' }, String(error));
            
            // Fallback: select first 3 items
            const fallbackItems = dataSet.data.slice(0, 3);
            const focusedCards: FocusedItemCard[] = fallbackItems.map(item => ({
                id: item.id,
                name: item.ad_name || item.group_value || item.creative_name || 'Unknown',
                thumbnail: item.image_url,
                type: this.determineItemType(dataSet.queryParams.groupBy),
                displayFormat: item.display_format,
                metrics: {
                    roas: item.metrics.roas,
                    spend: item.metrics.spend,
                    ctr: item.metrics.ctr,
                    impressions: item.metrics.impressions,
                    cpc: item.metrics.cpc
                }
            }));

            const focusSet: FocusItemSet = {
                id: generateId('focusset'),
                summary: `Top ${focusedCards.length} items`,
                items: focusedCards,
                dataSetId: dataSet.id,
                timestamp: Date.now()
            };

            context.focusItemSets.push(focusSet);

            return {
                focusSet,
                items: focusedCards,
                summary: focusSet.summary
            };
        }
    }

    /**
     * Find items by ID, with fuzzy matching
     */
    private findSelectedItems(selectedIds: string[], data: AdData[]): AdData[] {
        const result: AdData[] = [];
        
        for (const selectedId of selectedIds) {
            const item = data.find(d => {
                const id = d.id || '';
                const name = d.ad_name || d.group_value || d.creative_name || '';
                return (
                    id === selectedId ||
                    id.includes(selectedId) ||
                    selectedId.includes(id) ||
                    name.toLowerCase().includes(selectedId.toLowerCase()) ||
                    selectedId.toLowerCase().includes(name.toLowerCase())
                );
            });
            
            if (item && !result.some(r => r.id === item.id)) {
                result.push(item);
            }
        }
        
        // If no matches found, return first N items
        if (result.length === 0) {
            return data.slice(0, Math.min(selectedIds.length || 3, data.length));
        }
        
        return result;
    }

    /**
     * Determine item type based on groupBy parameter
     */
    private determineItemType(groupBy?: string): 'ad' | 'creative' | 'headline' | 'ad_copy' {
        switch (groupBy) {
            case 'creative_name': return 'creative';
            case 'headline': return 'headline';
            case 'ad_copy': return 'ad_copy';
            default: return 'ad';
        }
    }
}

export const focusItemsTool = new FocusItemsToolWrapper();

