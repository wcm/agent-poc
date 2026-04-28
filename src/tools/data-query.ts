import { Tool } from '../tool-base';
import { GlobalContext, DataSet, QueryParams, AdData, generateId } from '../context';
import { IntegrationInfo } from '../types';
import { logger } from '../utils/logger';

/**
 * DataQuery Tool Result
 */
export interface DataQueryResult {
    dataSet: DataSet;
    message: string;
}

/**
 * DataQueryTool
 * 
 * Translates analysis requests into API queries and fetches real data.
 * Stores results in the GlobalContext and returns a confirmation message.
 */
class DataQueryToolWrapper extends Tool {
    private baseUrl: string;

    constructor() {
        super({
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
    "integration": "integration id from input",
    "groupBy": "ad_name" | "creative_name" | "headline" | "ad_copy",
    "filters": {
        "display_format": "video" | "image" | null,
        "status": "active" | "inactive" | null
    },
    "sortBy": "metric_name",
    "sortOrder": "desc" | "asc"
}

## RULES
1. Extract integration ID from the context
2. Choose groupBy based on what the analysis needs (default: ad_name)
3. Apply filters only if explicitly requested
4. Default sortBy to "roas" for performance queries, "spend" for spend queries
5. For "top" queries use "desc", for "worst/bottom" use "asc"

## EXAMPLES

Task: "Query top 5 ads by ROAS"
Output: { "integration": "meta_ads", "groupBy": "ad_name", "filters": {}, "sortBy": "roas", "sortOrder": "desc" }

Task: "Query video ads sorted by spend"
Output: { "integration": "meta_ads", "groupBy": "ad_name", "filters": { "display_format": "video" }, "sortBy": "spend", "sortOrder": "desc" }

Task: "Query worst performing ads"
Output: { "integration": "meta_ads", "groupBy": "ad_name", "filters": {}, "sortBy": "roas", "sortOrder": "asc" }`
        });
        // Use localhost with dynamic port for server-side calls
        const port = process.env.PORT || 3002;
        this.baseUrl = `http://localhost:${port}`;
    }

    /**
     * Execute a data query and update context
     */
    async execute(stepDescription: string, context: GlobalContext): Promise<DataQueryResult> {
        logger.debug('DataQueryTool', 'Executing query', { stepDescription });

        // 1. Get query parameters from LLM
        const queryInput = `
Integration ID: ${context.integration.id}
Integration Name: ${context.integration.name}
Platform: ${context.integration.platform}

Task: ${stepDescription}

User's Original Request: ${context.userInput}

Generate the query parameters.
`;
        
        const queryJsonString = await this.process(queryInput);
        logger.debug('DataQueryTool', 'LLM query response', { queryJsonString: queryJsonString.slice(0, 500) });

        let queryParams: QueryParams;
        try {
            const cleanJson = queryJsonString.replace(/```json/g, '').replace(/```/g, '').trim();
            queryParams = JSON.parse(cleanJson);
        } catch (e) {
            const match = queryJsonString.match(/\{[\s\S]*\}/);
            if (match) {
                queryParams = JSON.parse(match[0]);
            } else {
                throw new Error(`Failed to generate valid query: ${queryJsonString}`);
            }
        }

        // 2. Build URL with query parameters
        const params = new URLSearchParams();
        
        const requestedIntegration = queryParams.integration;
        if (requestedIntegration) {
            params.append('integration', requestedIntegration);
            queryParams.integration = requestedIntegration;
        } else {
            params.append('integration', context.integration.id);
            queryParams.integration = context.integration.id;
        }
        if (queryParams.groupBy) {
            params.append('groupBy', queryParams.groupBy);
        }
        if (queryParams.filters) {
            if (queryParams.filters.display_format) {
                params.append('display_format', queryParams.filters.display_format);
            }
            if (queryParams.filters.status) {
                params.append('status', queryParams.filters.status);
            }
            if (queryParams.filters.start_date_from) {
                params.append('start_date_from', queryParams.filters.start_date_from);
            }
            if (queryParams.filters.start_date_to) {
                params.append('start_date_to', queryParams.filters.start_date_to);
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
            let ads: AdData[] = data.ads || [];
            
            logger.debug('DataQueryTool', 'API Response received', { 
                totalAds: ads.length,
                groupBy: data.groupBy
            });

            // 4. Sort the results
            if (queryParams.sortBy && ads.length > 0) {
                const sortField = queryParams.sortBy;
                const isAscending = queryParams.sortOrder === 'asc';
                
                ads = ads.sort((a: AdData, b: AdData) => {
                    const aVal = a.metrics?.[sortField as keyof typeof a.metrics] ?? 0;
                    const bVal = b.metrics?.[sortField as keyof typeof b.metrics] ?? 0;
                    return isAscending ? (aVal - bVal) : (bVal - aVal);
                });
            }

            // 5. Limit to top 20 results
            const limitedAds = ads.slice(0, 20);

            // 6. Create DataSet and add to context
            const dataSet: DataSet = {
                id: generateId('dataset'),
                queryDescription: stepDescription,
                queryParams: queryParams,
                data: limitedAds,
                timestamp: Date.now()
            };

            context.dataSets.push(dataSet);

            // 7. Generate confirmation message
            const message = this.generateMessage(dataSet, queryParams, context.integration);

            return { dataSet, message };

        } catch (e: any) {
            logger.log('ERROR', { component: 'DataQueryTool', action: 'FETCH' }, e.message);
            throw new Error(`Error fetching data: ${e.message}`);
        }
    }

    /**
     * Generate a comprehensive message about the query and results
     */
    private generateMessage(dataSet: DataSet, queryParams: QueryParams, integration: IntegrationInfo): string {
        // const topItems = dataSet.data.slice(0, 3);
        const sortField = queryParams.sortBy || 'spend';
        const sortOrder = queryParams.sortOrder || 'desc';
        
        let message = `**Query Details:**\n`;
        
        // Data source info
        message += `- Integration: ${integration.name} (${integration.platform})\n`;
        
        // Query parameters section
        message += `- Group by: ${queryParams.groupBy || 'ad_name'}\n`;
        message += `- Sort: ${sortField} (${sortOrder === 'desc' ? 'highest first' : 'lowest first'})\n`;
        
        // Filters applied
        if (queryParams.filters) {
            const filters: string[] = [];
            if (queryParams.filters.display_format) filters.push(`Format: ${queryParams.filters.display_format}`);
            if (queryParams.filters.status) filters.push(`Status: ${queryParams.filters.status}`);
            if (queryParams.filters.start_date_from) filters.push(`From: ${queryParams.filters.start_date_from}`);
            if (queryParams.filters.start_date_to) filters.push(`To: ${queryParams.filters.start_date_to}`);
            if (filters.length > 0) {
                message += `- Filters: ${filters.join(', ')}\n`;
            }
        }
        
        // Results summary
        message += `\n**Results:** ${dataSet.data.length} items found\n`;
        
        // // Top items preview with comprehensive metrics
        // if (topItems.length > 0) {
        //     message += `\n**Top ${topItems.length} Results:**\n`;
        //     topItems.forEach((item, i) => {
        //         const name = item.ad_name || item.group_value || item.creative_name || 'Unknown';
        //         const format = item.display_format ? ` [${item.display_format}]` : '';
        //         message += `\n${i + 1}. **${name}**${format}\n`;
        //         message += `   • ROAS: ${item.metrics.roas?.toFixed(2) || 'N/A'}`;
        //         message += ` | Spend: $${item.metrics.spend?.toFixed(0) || '0'}`;
        //         message += ` | CTR: ${(item.metrics.ctr || 0).toFixed(2)}%`;
        //         message += `\n`;
        //     });
        // }
        
        return message;
    }
}

export const dataQueryTool = new DataQueryToolWrapper();
