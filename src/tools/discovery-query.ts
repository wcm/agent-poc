import { Tool } from '../tool-base';
import { GlobalContext, DiscoveryDataSet, DiscoveryAd, generateId } from '../context';
import { logger } from '../utils/logger';

/**
 * Discovery Query Parameters
 */
export interface DiscoveryQueryParams {
    brand?: string;
    display_format?: 'video' | 'image';
    status?: 'active' | 'inactive';
    platform?: string;
    sort?: 'latest' | 'longest_running';
}

/**
 * DiscoveryQuery Tool Result
 */
export interface DiscoveryQueryResult {
    dataSet: DiscoveryDataSet;
    message: string;
}

/**
 * DiscoveryQueryTool
 * 
 * Fetches competitor/inspiration ads from the discovery API.
 * Used for competitive analysis and creative inspiration.
 */
class DiscoveryQueryToolWrapper extends Tool {
    private baseUrl: string;

    constructor() {
        super({
            name: "DiscoveryQuery",
            model: "google/gemini-2.5-flash-lite",
            systemPrompt: `You are a Discovery Query Tool for a Marketing Analytics Platform.
Your job is to translate research requests into query parameters for the discovery/inspiration ads API.

## DATA SCHEMA

### Filters
- \`brand\`: Filter by brand name (e.g., "Adidas", "On Running", "Lululemon")
- \`display_format\`: "video" | "image"
- \`status\`: "active" | "inactive" - IMPORTANT: Default to "active" unless user asks for past/inactive/ended ads
- \`platform\`: "instagram" | "facebook" | "tiktok" | "youtube"

### Sorting
- \`sort\`: "latest" (most recent first) | "longest_running" (campaigns running the longest, sorted by duration)

## OUTPUT FORMAT
Return a JSON object ONLY:
{
    "brand": "brand name" | null,
    "display_format": "video" | "image" | null,
    "status": "active" | "inactive" | null,
    "platform": "platform name" | null,
    "sort": "latest" | "longest_running"
}

## RULES
1. Default sort is "latest" unless user asks for long-running campaigns
2. **DEFAULT status to "active"** - most users want to see currently running competitor ads
3. Only set status to "inactive" if user explicitly asks for "past ads", "ended campaigns", "old ads", or "inactive"
4. Only filter by brand if user explicitly mentions: "Adidas", "On Running", "Lululemon"
5. NEVER use the user's own brand/integration as a filter - this API is for COMPETITOR ads only
6. For platform, use lowercase: "instagram", "facebook", "tiktok", "youtube"

## EXAMPLES

Task: "Show me top competitor ads"
Output: { "status": "active", "sort": "latest" }

Task: "Get competitor inspiration"
Output: { "status": "active", "sort": "latest" }

Task: "Show me competitor video ads on TikTok"
Output: { "status": "active", "display_format": "video", "platform": "tiktok", "sort": "latest" }

Task: "What are Adidas' latest campaigns?"
Output: { "brand": "Adidas", "status": "active", "sort": "latest" }

Task: "Find longest running ads"
Output: { "status": "active", "sort": "longest_running" }

Task: "Show me inspiration from image ads"
Output: { "status": "active", "display_format": "image", "sort": "latest" }

Task: "Show me past competitor campaigns"
Output: { "status": "inactive", "sort": "latest" }

Task: "What ads have competitors stopped running?"
Output: { "status": "inactive", "sort": "latest" }`
        });
        const port = process.env.PORT || 3002;
        this.baseUrl = `http://localhost:${port}`;
    }

    /**
     * Execute a discovery query and update context
     */
    async execute(stepDescription: string, context: GlobalContext): Promise<DiscoveryQueryResult> {
        logger.debug('DiscoveryQueryTool', 'Executing query', { stepDescription });

        // Build followed brands context
        let brandsContext = '';
        if (context.followedBrands && context.followedBrands.length > 0) {
            const followedNames = context.followedBrands.map(b => b.name).join(', ');
            brandsContext = `User's Followed Competitor Brands: ${followedNames}\nOnly filter by these brands if user specifically asks about "my brands", "followed brands", or "brands I follow".`;
        }

        // 1. Get query parameters from LLM
        const queryInput = `
IMPORTANT: This is for fetching COMPETITOR ads, NOT the user's own ads.
The user's own integration is "${context.integration.name}" - DO NOT use this as a filter.
Available competitor brands in database: Adidas, On Running, Lululemon

Task: ${stepDescription}

User's Original Request: ${context.userInput}

${brandsContext}

REMINDER: If user asks for "top competitor ads" or "competitor inspiration" without specifying a brand, return NO brand filter (null). Only filter by brand if user explicitly mentions a specific competitor brand name.

Generate the query parameters.
`;
        
        const queryJsonString = await this.process(queryInput);
        logger.debug('DiscoveryQueryTool', 'LLM query response', { queryJsonString: queryJsonString.slice(0, 500) });

        let queryParams: DiscoveryQueryParams;
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
        
        if (queryParams.brand) {
            params.append('brand', queryParams.brand);
        }
        if (queryParams.display_format) {
            params.append('display_format', queryParams.display_format);
        }
        if (queryParams.status) {
            params.append('status', queryParams.status);
        }
        if (queryParams.platform) {
            params.append('platform', queryParams.platform);
        }
        if (queryParams.sort) {
            params.append('sort', queryParams.sort);
        }
        // Always limit to 10 results
        params.append('limit', '10');

        const url = `${this.baseUrl}/api/inspirations/discovery?${params.toString()}`;
        logger.debug('DiscoveryQueryTool', 'Calling API', { url });

        // 3. Call the actual API
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
            }
            
            const ads: DiscoveryAd[] = await response.json();
            
            logger.debug('DiscoveryQueryTool', 'API Response received', { 
                totalAds: ads.length
            });

            // 4. Create DiscoveryDataSet and add to context
            const dataSet: DiscoveryDataSet = {
                id: generateId('discovery'),
                queryDescription: stepDescription,
                queryParams: queryParams,
                data: ads,
                timestamp: Date.now()
            };

            context.discoveryDataSets.push(dataSet);

            // 5. Generate confirmation message
            const message = this.generateMessage(dataSet, queryParams);

            return { dataSet, message };

        } catch (e: any) {
            logger.log('ERROR', { component: 'DiscoveryQueryTool', action: 'FETCH' }, e.message);
            throw new Error(`Error fetching discovery data: ${e.message}`);
        }
    }

    /**
     * Generate a message about the query and results
     */
    private generateMessage(dataSet: DiscoveryDataSet, queryParams: DiscoveryQueryParams): string {
        let message = `**Discovery Query:**\n`;
        
        // Query parameters section
        const filters: string[] = [];
        if (queryParams.brand) filters.push(`Brand: ${queryParams.brand}`);
        if (queryParams.display_format) filters.push(`Format: ${queryParams.display_format}`);
        if (queryParams.status) filters.push(`Status: ${queryParams.status}`);
        if (queryParams.platform) filters.push(`Platform: ${queryParams.platform}`);
        
        if (filters.length > 0) {
            message += `- Filters: ${filters.join(', ')}\n`;
        }
        message += `- Sort: ${queryParams.sort || 'latest'}\n`;
        
        // Results summary
        message += `\n**Results:** ${dataSet.data.length} competitor ads found\n`;
        
        // Preview of top ads
        if (dataSet.data.length > 0) {
            const preview = dataSet.data.slice(0, 3);
            message += `\n**Preview:**\n`;
            preview.forEach((ad, i) => {
                message += `${i + 1}. **${ad.brand_name}** - "${ad.headline}" [${ad.display_format}]\n`;
            });
        }
        
        return message;
    }
}

export const discoveryQueryTool = new DiscoveryQueryToolWrapper();
