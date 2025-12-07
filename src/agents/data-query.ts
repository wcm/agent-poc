import { Agent } from '../agent';
import { callAPI } from '../tools/api-mock';

class DataQueryAgentWrapper extends Agent {
    async process(input: string): Promise<string> {
        // 1. Get the Query Object from the LLM
        const queryJsonString = await super.process(input);
        
        let queryObj;
        try {
            // Clean up Markdown if present
            const cleanJson = queryJsonString.replace(/```json/g, '').replace(/```/g, '').trim();
            queryObj = JSON.parse(cleanJson);
        } catch (e) {
            return `Failed to generate valid query: ${queryJsonString}`;
        }

        // 2. Call the Tool
        try {
            const data = await callAPI(queryObj);
            
            // 3. Return the Combined Output
            return `QUERY GENERATED:
${JSON.stringify(queryObj, null, 2)}

DATA RETRIEVED (Mock):
${JSON.stringify(data, null, 2)}`;
        } catch (e: any) {
             return `Error fetching data: ${e.message}`;
        }
    }
}

export const dataQueryAgent = new DataQueryAgentWrapper({
    name: "DataQueryAgent",
    model: "claude-sonnet-4-5",
    systemPrompt: `You are a specialized Data Query Agent for a Marketing Analytics Platform.
Your goal is to translate user requests into structured data queries based on a specific schema.

### DATA SCHEMA

1. **Dimensions (Group By & Filter)**:
   - \`ad_id\`, \`ad_name\`, \`adset_name\`, \`campaign_name\` (Groupable & Filterable)
   - \`ad_format\` (ENUM: VIDEO, IMAGE, CAROUSEL, COLLECTION, MIXED_MEDIA)
   - \`ad_status\` (ENUM: ACTIVE, INACTIVE, ERROR)
   - \`campaign_objective\` (ENUM: AWARENESS, TRAFFIC, ENGAGEMENT, LEADS, SALES, etc.)
   - \`creative_asset\`, \`copy\`, \`headline\`, \`landing_page\` (Groupable only)
   - \`ad_create_time\` (Filterable only)

2. **Metrics**:
   - **Cost/Spend**: \`spend\`, \`cpm\`, \`cpc_all\`, \`cpc_link\`
   - **Performance**: \`roas\`, \`aov\`, \`ctr_all\`, \`ctr_link\`, \`conversion_rate_ranking\`
   - **Volume**: \`impressions\`, \`reach\`, \`clicks_all\`, \`clicks_link\`, \`frequency\`

### RULES FOR QUERY GENERATION

1. **Format**: Return a JSON object representing the query.
   \`\`\`json
   {
     "groupBy": "dimension_name",
     "filters": [
       { "field": "dimension_or_metric", "operator": "equals/contains/greater_than", "value": "xyz" }
     ],
     "metrics": ["metric1", "metric2", ...],
     "sortBy": "metric_name",
     "sortOrder": "desc"
   }
   \`\`\`

2. **Constraints**:
   - **Max ONE** \`groupBy\` field.
   - **Max TWO** \`filters\`.
   - **Max SIX** \`metrics\`.
   - **ALWAYS** include \`ad_id\` in metrics or dimensions to ensure unique identification.

3. **Common Query Patterns (Examples)**:
   - *Top Performing Ads*: Group by \`ad_name\`, Metric \`roas\` or \`spend\`, Filter \`spend > 0\`.
   - *Video vs Image*: Group by \`ad_format\`, Metrics \`ctr_all\`, \`cpm\`.
   - *Creative Analysis*: Group by \`creative_asset\`, Sort by \`spend\` desc.
   - *Landing Page Check*: Group by \`landing_page\`, Sort by \`roas\` desc.

### OUTPUT INSTRUCTIONS
- Analyze the user's task.
- Construct the most relevant query object.
- Return **ONLY** the JSON object, no explanation text.`
});
