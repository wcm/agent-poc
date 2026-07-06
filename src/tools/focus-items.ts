import { Tool } from '../tool-base';
import { GlobalContext, FocusItemSet, getLatestAnyDataSet, generateId, AdData, DiscoveryAd } from '../context';
import { FocusedItemCard } from '../types';
import { logger } from '../utils/logger';

const MAX_FOCUS_ITEMS = 3;

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
1. Select at most 3 items. If "top N", "worst N", "all", or a larger count is requested, cap the selection at 3.
2. If "top N" is requested, select the first N items up to the 3-item cap (data is pre-sorted)
3. If "worst/bottom N" is requested, select from the end up to the 3-item cap (or first N if sorted ascending)
4. Default to selecting 3 items unless specified otherwise
5. If the task is about generating ad variations, ad concepts, or new creatives and no count is specified, default to selecting 1 item
6. Match the user's intent from the task description
7. Return actual IDs from the data (don't make them up)

## EXAMPLES

Task: "Select top 3 high-spend ads"
Data sorted by spend DESC
→ Select first 3 items

Task: "Select worst performing ads"
Data sorted by ROAS ASC
→ Select first 3 items (lowest ROAS)

Task: "Select top 5 video ads"
→ Select first 3 items (assuming data is filtered to videos, capped at 3)`
        });
    }

    /**
     * Select focus items from the latest dataset
     */
    async execute(stepDescription: string, context: GlobalContext): Promise<FocusItemsResult> {
        logger.debug('FocusItemsTool', 'Selecting items', { stepDescription });

        const latestData = getLatestAnyDataSet(context);
        if (!latestData) {
            throw new Error('No data available. Run dataQuery or discoveryQuery first.');
        }

        const { dataSet, type } = latestData;
        const isDiscovery = type === 'discovery';

        // Prepare data summary for selection
        let dataSummary: any[];
        if (isDiscovery) {
            dataSummary = (dataSet.data as DiscoveryAd[]).map(item => ({
                id: item.id,
                brand: item.brand_name,
                headline: item.headline,
                format: item.display_format,
                platforms: item.platforms?.join(', '),
                status: item.status
            }));
        } else {
            dataSummary = (dataSet.data as AdData[]).map(item => ({
                id: item.id,
                name: item.ad_name || item.group_value || item.creative_name || 'Unknown',
                format: item.display_format,
                roas: item.metrics?.roas,
                spend: item.metrics?.spend,
                ctr: item.metrics?.ctr
            }));
        }

        const input = `
## SELECTION TASK
${stepDescription}

## DATA TYPE
${isDiscovery ? 'COMPETITOR ADS (no performance metrics)' : 'YOUR OWN ADS (with metrics)'}

## AVAILABLE DATA (${dataSet.data.length} items)
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
                        selectedIds: dataSet.data.slice(0, MAX_FOCUS_ITEMS).map((d: any) => d.id),
                        summary: `Top ${Math.min(MAX_FOCUS_ITEMS, dataSet.data.length)} items`,
                        selectionReason: 'Default selection'
                    };
                }
            }

            // Find selected items in dataset
            const cappedSelectedIds = Array.isArray(selection.selectedIds) ? selection.selectedIds.slice(0, MAX_FOCUS_ITEMS) : [];
            const selectedItems = this.findSelectedItems(cappedSelectedIds, dataSet.data as any[], isDiscovery).slice(0, MAX_FOCUS_ITEMS);
            
            // Convert to FocusedItemCard format
            const focusedCards: FocusedItemCard[] = selectedItems.map(item => {
                if (isDiscovery) {
                    const discoveryItem = item as DiscoveryAd;
                    return {
                        id: discoveryItem.id,
                        name: `${discoveryItem.brand_name}: ${discoveryItem.headline}`,
                        thumbnail: discoveryItem.image_url,
                        type: 'ad' as const,
                        displayFormat: discoveryItem.display_format,
                        metrics: {} // No metrics for competitor ads
                    };
                } else {
                    const ownItem = item as AdData;
                    return {
                        id: ownItem.id,
                        name: ownItem.ad_name || ownItem.group_value || ownItem.creative_name || 'Unknown',
                        thumbnail: ownItem.image_url,
                        type: this.determineItemType((dataSet as any).queryParams?.groupBy),
                        displayFormat: ownItem.display_format,
                        metrics: {
                            roas: ownItem.metrics?.roas,
                            spend: ownItem.metrics?.spend,
                            ctr: ownItem.metrics?.ctr,
                            impressions: ownItem.metrics?.impressions,
                            cpc: ownItem.metrics?.cpc
                        }
                    };
                }
            });

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
            const fallbackItems = dataSet.data.slice(0, MAX_FOCUS_ITEMS) as any[];
            const focusedCards: FocusedItemCard[] = fallbackItems.map(item => {
                if (isDiscovery) {
                    return {
                        id: item.id,
                        name: `${item.brand_name}: ${item.headline}`,
                        thumbnail: item.image_url,
                        type: 'ad' as const,
                        displayFormat: item.display_format,
                        metrics: {}
                    };
                } else {
                    return {
                        id: item.id,
                        name: item.ad_name || item.group_value || item.creative_name || 'Unknown',
                        thumbnail: item.image_url,
                        type: this.determineItemType((dataSet as any).queryParams?.groupBy),
                        displayFormat: item.display_format,
                        metrics: {
                            roas: item.metrics?.roas,
                            spend: item.metrics?.spend,
                            ctr: item.metrics?.ctr,
                            impressions: item.metrics?.impressions,
                            cpc: item.metrics?.cpc
                        }
                    };
                }
            });

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
    private findSelectedItems(selectedIds: string[], data: any[], isDiscovery: boolean): any[] {
        const result: any[] = [];
        
        for (const selectedId of selectedIds) {
            const item = data.find(d => {
                const id = d.id || '';
                let name = '';
                if (isDiscovery) {
                    name = d.headline || d.brand_name || '';
                } else {
                    name = d.ad_name || d.group_value || d.creative_name || '';
                }
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
            return data.slice(0, Math.min(selectedIds.length || MAX_FOCUS_ITEMS, MAX_FOCUS_ITEMS, data.length));
        }
        
        return result.slice(0, MAX_FOCUS_ITEMS);
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
