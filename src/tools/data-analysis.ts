import { Tool } from '../tool-base';
import { GlobalContext, AnalysisReport, getLatestDataSet, generateId } from '../context';
import { logger } from '../utils/logger';

/**
 * DataAnalysis Tool Result
 */
export interface DataAnalysisResult {
    report: AnalysisReport;
    content: string;
}

/**
 * DataAnalysis Tool
 * 
 * Analyzes metrics and generates performance insights from data.
 * Uses the latest dataset in context to produce a markdown report.
 */
class DataAnalysisToolWrapper extends Tool {
    constructor() {
        super({
            name: "DataAnalysis",
            model: "google/gemini-2.5-flash-lite",
            systemPrompt: `You are a Marketing Analytics Expert analyzing ad performance data.

## YOUR TASK
Analyze the provided ad performance data and generate actionable insights.

## OUTPUT FORMAT
Generate a clear markdown report with:
1. **Overview** - Brief summary of what data was analyzed
2. **Key Findings** - Top 3-5 insights from the data
3. **Performance Table** - Comparison table of key items
4. **Recommendations** - Actionable next steps

## ANALYSIS GUIDELINES
- Compare metrics across items (ROAS, CTR, CPC, Spend)
- Identify patterns (what's working, what's not)
- Highlight outliers (unusually high or low performers)
- Consider spend efficiency (high ROAS with reasonable spend)
- Note format differences (video vs image performance)

## METRIC INTERPRETATIONS
- ROAS > 3.0: Excellent performance
- ROAS 2.0-3.0: Good performance
- ROAS 1.0-2.0: Breaking even
- ROAS < 1.0: Losing money
- High CTR + Low ROAS: Attractive but not converting
- Low CTR + High ROAS: Converting audience but limited reach

Keep the report concise and focused on actionable insights.`
        });
    }

    /**
     * Analyze the latest dataset and generate a report
     */
    async execute(stepDescription: string, context: GlobalContext): Promise<DataAnalysisResult> {
        logger.debug('DataAnalysisTool', 'Analyzing data', { stepDescription });

        const dataSet = getLatestDataSet(context);
        if (!dataSet) {
            throw new Error('No data available for analysis. Run dataQuery first.');
        }

        // Prepare data for analysis
        const dataPreview = dataSet.data.slice(0, 10).map(item => ({
            name: item.ad_name || item.group_value || item.creative_name || 'Unknown',
            format: item.display_format || 'unknown',
            spend: item.metrics.spend,
            roas: item.metrics.roas,
            ctr: item.metrics.ctr,
            cpc: item.metrics.cpc,
            impressions: item.metrics.impressions,
            clicks: item.metrics.clicks
        }));

        const input = `
## ANALYSIS TASK
${stepDescription}

## USER'S ORIGINAL REQUEST
${context.userInput}

## DATA SUMMARY
- Total items: ${dataSet.data.length}
- Query: ${dataSet.queryDescription}
- Sorted by: ${dataSet.queryParams.sortBy || 'default'}
- Filters: ${JSON.stringify(dataSet.queryParams.filters || {})}

## DATA (Top ${dataPreview.length} items)
${JSON.stringify(dataPreview, null, 2)}

Generate a comprehensive analysis report.
`;

        const content = await this.process(input);

        // Create report and add to context
        const report: AnalysisReport = {
            id: generateId('analysis'),
            dataSetId: dataSet.id,
            content: content,
            timestamp: Date.now()
        };

        context.analysisReports.push(report);

        return { report, content };
    }
}

export const dataAnalysisTool = new DataAnalysisToolWrapper();

