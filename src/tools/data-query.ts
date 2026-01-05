import { Tool } from '../tool-base';
import { logger } from '../utils/logger';

/**
 * DataQueryTool
 * 
 * Translates analysis requests into API queries and fetches real data
 * from the /api/own-analytics endpoint.
 */
class DataQueryToolWrapper extends Tool {
    private baseUrl: string;

    constructor(config: any) {
        super(config);
        // Use localhost for server-side calls
        this.baseUrl = 'http://localhost:3001';
    }

    async process(input: string): Promise<string> {
        // 1. Get the Query Object from the LLM
        logger.debug('DataQueryTool', 'Getting query from LLM', { input: input.slice(0, 200) });
        const queryJsonString = await super.process(input);
        logger.debug('DataQueryTool', 'LLM query response', { queryJsonString: queryJsonString.slice(0, 500) });

        let queryObj;
        try {
            // Clean up Markdown if present
            const cleanJson = queryJsonString.replace(/```json/g, '').replace(/```/g, '').trim();
            queryObj = JSON.parse(cleanJson);
        } catch (e) {
            return JSON.stringify({
                summary: `Failed to generate valid query: ${queryJsonString}`,
                structuredData: []
            });
        }

        // 2. Build URL with query parameters
        const params = new URLSearchParams();
        
        if (queryObj.channel) {
            params.append('channel', queryObj.channel);
        }
        if (queryObj.groupBy) {
            params.append('groupBy', queryObj.groupBy);
        }
        if (queryObj.filters) {
            if (queryObj.filters.display_format) {
                params.append('display_format', queryObj.filters.display_format);
            }
            if (queryObj.filters.status) {
                params.append('status', queryObj.filters.status);
            }
            if (queryObj.filters.start_date_from) {
                params.append('start_date_from', queryObj.filters.start_date_from);
            }
            if (queryObj.filters.start_date_to) {
                params.append('start_date_to', queryObj.filters.start_date_to);
            }
        }

        const url = `${this.baseUrl}/api/own-analytics?${params.toString()}`;
        logger.debug('DataQueryTool', 'Calling API', { url });

        // 3. Call the actual API
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            let ads = data.ads || [];
            
            logger.debug('DataQueryTool', 'API Response received', { 
                totalAds: ads.length,
                groupBy: data.groupBy,
                firstItem: ads[0] ? { 
                    id: ads[0].id || ads[0].ad_id,
                    name: ads[0].ad_name || ads[0].group_value,
                    metrics: ads[0].metrics 
                } : null
            });

            // 4. Sort the results if sortBy is specified
            if (queryObj.sortBy && ads.length > 0) {
                const sortField = queryObj.sortBy;
                const isAscending = queryObj.sortOrder === 'asc';
                
                logger.debug('DataQueryTool', 'Sorting data', { 
                    sortField, 
                    sortOrder: queryObj.sortOrder,
                    isAscending,
                    sampleValuesBefore: ads.slice(0, 3).map((a: any) => ({
                        name: a.ad_name || a.group_value,
                        [sortField]: a.metrics?.[sortField] ?? a[sortField]
                    }))
                });
                
                ads = ads.sort((a: any, b: any) => {
                    const aVal = a.metrics?.[sortField] ?? a[sortField] ?? 0;
                    const bVal = b.metrics?.[sortField] ?? b[sortField] ?? 0;
                    // For descending (default): highest first → bVal - aVal
                    // For ascending: lowest first → aVal - bVal
                    return isAscending ? (aVal - bVal) : (bVal - aVal);
                });
                
                logger.debug('DataQueryTool', 'After sorting', { 
                    sampleValuesAfter: ads.slice(0, 3).map((a: any) => ({
                        name: a.ad_name || a.group_value,
                        [sortField]: a.metrics?.[sortField] ?? a[sortField]
                    }))
                });
            }

            // 5. Limit to top results for efficiency
            const limitedAds = ads.slice(0, 20);
            
            logger.debug('DataQueryTool', 'Final result prepared', {
                totalBeforeLimit: ads.length,
                afterLimit: limitedAds.length,
                topItems: limitedAds.slice(0, 3).map((ad: any) => ({
                    id: ad.id || ad.ad_id,
                    name: ad.ad_name || ad.group_value,
                    roas: ad.metrics?.roas,
                    spend: ad.metrics?.spend
                }))
            });

            // 6. Return the combined output as JSON string
            const resultObject = {
                summary: `QUERY EXECUTED:
${JSON.stringify(queryObj, null, 2)}

DATA RETRIEVED:
- Total items: ${ads.length}
- Group by: ${data.groupBy || 'ad_name'}
- Top ${Math.min(3, limitedAds.length)} results:
${JSON.stringify(limitedAds.slice(0, 3).map((ad: any) => ({
    name: ad.ad_name || ad.group_value,
    spend: ad.metrics?.spend,
    roas: ad.metrics?.roas,
    ctr: ad.metrics?.ctr,
    impressions: ad.metrics?.impressions
})), null, 2)}`,
                structuredData: limitedAds
            };

            return JSON.stringify(resultObject);

        } catch (e: any) {
            console.error('[DataQueryTool] API Error:', e);
            return JSON.stringify({
                summary: `Error fetching data: ${e.message}`,
                structuredData: []
            });
        }
    }
}

export const dataQueryTool = new DataQueryToolWrapper({
    name: "DataQuery",
    model: "google/gemini-2.5-flash-lite",
    systemPrompt: `You are a Data Query Tool for a Marketing Analytics Platform.
Your job is to translate analysis requests into query parameters for the analytics API.

## DATA SCHEMA

### Dimensions (for groupBy)
- \`ad_name\`: Individual ad names
- \`creative_name\`: Creative asset names (multiple ads can share same creative)
- \`headline\`: Ad headlines
- \`ad_copy\`: Ad copy text

### Filters
- \`display_format\`: "video" | "image"
- \`status\`: "active" | "inactive"
- \`start_date_from\`: ISO date string (e.g., "2025-12-01")
- \`start_date_to\`: ISO date string

### Metrics (for sorting)
- \`spend\`: Total ad spend
- \`roas\`: Return on Ad Spend
- \`ctr\`: Click-through Rate
- \`cpc\`: Cost per Click
- \`cpa\`: Cost per Acquisition
- \`aov\`: Average Order Value
- \`impressions\`: Total impressions
- \`clicks\`: Total clicks
- \`purchase_value\`: Total purchase value
- \`cost_per_lead\`: Cost per lead
- \`click_to_atc\`: Click to Add-to-Cart rate
- \`atc_to_purchase\`: Add-to-Cart to Purchase rate

## OUTPUT FORMAT
Return a JSON object ONLY:
{
    "channel": "channel_id from input",
    "groupBy": "ad_name" | "creative_name" | "headline" | "ad_copy",
    "filters": {
        "display_format": "video" | "image" | null,
        "status": "active" | "inactive" | null
    },
    "sortBy": "metric_name",
    "sortOrder": "desc" | "asc"
}

## RULES
1. Extract channel ID from the input context
2. Choose groupBy based on what the analysis needs
3. Apply filters only if explicitly requested
4. Default sortBy to "spend" if not specified
5. Default sortOrder to "desc" (highest first)

## EXAMPLES

Input: "Channel ID: channel_1, Task: Fetch video ads sorted by ROAS"
Output:
{
    "channel": "channel_1",
    "groupBy": "ad_name",
    "filters": { "display_format": "video" },
    "sortBy": "roas",
    "sortOrder": "desc"
}

Input: "Channel ID: channel_2, Task: Get creative performance data"
Output:
{
    "channel": "channel_2",
    "groupBy": "creative_name",
    "filters": {},
    "sortBy": "spend",
    "sortOrder": "desc"
}`
});
