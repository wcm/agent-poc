import { reasoningTool } from './tools/reasoning';
import { dataQueryTool } from './tools/data-query';
import { finalResponderTool } from './tools/final-responder';
import { Tool } from './tool-base';
import { EventEmitter } from 'events';
import { PlanTask, TaskStatus } from './types';

/**
 * Result structure for Performance Analysis
 */
export interface PerformanceAnalysisResult {
    markdownReport: string;
    focusItems: Array<{
        id: string;
        name: string;
        image_url?: string;
        display_format?: 'image' | 'video';
        metrics: Record<string, number>;
    }>;
}

/**
 * Internal task structure for the agent's plan
 */
interface AnalysisTask {
    id: string;
    description: string;
    tool: 'data-query' | 'reasoning';
}

/**
 * Status update callback type
 */
type StatusCallback = (taskId: string, status: TaskStatus, result?: string) => void;

/**
 * PerformanceAnalysisAgent
 * 
 * Specialized agent for analyzing ad performance data.
 * Takes a channelId and objective, then:
 * 1. Plans internally which tasks to execute
 * 2. Executes the plan using DataQueryTool and ReasoningTool
 * 3. Returns a structured result with markdown report and focus items
 */
export class PerformanceAnalysisAgent extends EventEmitter {
    private dataPool: any[] = [];
    private executionResults: string[] = [];
    private internalPlannerTool: Tool;
    private focusExtractorTool: Tool;

    constructor() {
        super();
        
        // Internal planner specific to performance analysis
        this.internalPlannerTool = new Tool({
            name: "PerformancePlanner",
            model: "google/gemini-2.5-flash-lite",
            systemPrompt: `You are an internal planner for a Performance Analysis Agent.

Given an objective and channel, create a simple plan of tasks to analyze the data.

## AVAILABLE TOOLS
1. **data-query**: Fetches and filters data from the analytics API. Describe WHAT data you need.
2. **reasoning**: Analyzes data, draws conclusions, provides insights.

## OUTPUT FORMAT
Return a JSON object with just the tasks array:
{
    "tasks": [
        {
            "id": "1",
            "description": "Clear description of what this task should do",
            "tool": "data-query" | "reasoning"
        }
    ]
}

## PLANNING RULES
- Keep tasks minimal (1-3 tasks max)
- Always start with a data-query task to get the data
- End with a reasoning task to analyze results
- Task descriptions should be clear and specific about WHAT is needed
- Do NOT include query parameters - just describe the data needed

## EXAMPLES
Objective: "Find top performing video ads"
→ {
    "tasks": [
        {"id":"1", "description":"Fetch video ads sorted by ROAS to find top performers", "tool":"data-query"},
        {"id":"2", "description":"Analyze the top performing video ads and identify patterns", "tool":"reasoning"}
    ]
}

Objective: "Compare creative performance"
→ {
    "tasks": [
        {"id":"1", "description":"Fetch ad data grouped by creative name to compare performance", "tool":"data-query"},
        {"id":"2", "description":"Analyze which creatives perform best and why", "tool":"reasoning"}
    ]
}

Objective: "What's my best headline?"
→ {
    "tasks": [
        {"id":"1", "description":"Fetch ad data grouped by headline sorted by performance", "tool":"data-query"},
        {"id":"2", "description":"Identify the best performing headlines", "tool":"reasoning"}
    ]
}`
        });

        // Tool to extract focus items from report
        this.focusExtractorTool = new Tool({
            name: "FocusExtractor",
            model: "google/gemini-2.5-flash-lite",
            systemPrompt: `You extract focus item identifiers from a performance report based on the user's objective.

## YOUR TASK
Given a report and data pool, identify which items from the data pool should be focused on based on the report content and user's objective.

## IMPORTANT RULES
1. Extract item identifiers that are ACTUALLY MENTIONED or RELEVANT to the objective
2. If user asks about "worst" or "poor" performers, select LOW performing items
3. If user asks about "best" or "top" performers, select HIGH performing items
4. Match items by name, id, group_value, headline, creative_name, or ad_copy
5. Return the EXACT identifiers as they appear in the data pool

## OUTPUT FORMAT
Return a JSON object:
{
    "focusItemIdentifiers": ["identifier1", "identifier2", ...],
    "selectionReason": "Brief explanation of why these items were selected"
}

Return 3-5 items maximum.`
        });
    }

    /**
     * Main analysis method with streaming support
     * @param channelId - The channel to analyze
     * @param objective - What the user wants to analyze
     * @param onStatusUpdate - Callback for plan status updates
     */
    async analyzeWithStreaming(
        channelId: string, 
        objective: string,
        onStatusUpdate?: StatusCallback
    ): Promise<PerformanceAnalysisResult> {
        console.log(`[PerformanceAgent] Starting analysis: channel=${channelId}, objective=${objective}`);
        
        // Reset state
        this.dataPool = [];
        this.executionResults = [];

        const updateStatus = onStatusUpdate || (() => {});

        try {
            // 1. Internal Planning
            updateStatus('plan', 'running');
            
            const planInput = `Channel ID: ${channelId}\nObjective: ${objective}`;
            const planResponse = await this.internalPlannerTool.process(planInput);
            
            let plan: { tasks: AnalysisTask[] };
            try {
                const cleanJson = planResponse.replace(/```json/g, '').replace(/```/g, '').trim();
                plan = JSON.parse(cleanJson);
            } catch (e) {
                const match = planResponse.match(/\{[\s\S]*\}/);
                if (match) {
                    plan = JSON.parse(match[0]);
                } else {
                    throw new Error("Failed to parse internal plan");
                }
            }

            console.log(`[PerformanceAgent] Plan created with ${plan.tasks.length} tasks`);
            updateStatus('plan', 'completed', `${plan.tasks.length} tasks planned`);

            // 2. Execute Tasks
            for (let i = 0; i < plan.tasks.length; i++) {
                const task: AnalysisTask = plan.tasks[i];
                const taskId = task.tool === 'data-query' ? 'query' : 'analyze';
                
                console.log(`[PerformanceAgent] Executing: ${task.description}`);
                updateStatus(taskId, 'running');

                let result = "";

                if (task.tool === 'data-query') {
                    const queryContext = `
Channel ID: ${channelId}
Objective: ${objective}
Task: ${task.description}
`;
                    const queryResultJson = await dataQueryTool.process(queryContext);
                    
                    try {
                        const parsedResult = JSON.parse(queryResultJson);
                        if (parsedResult.structuredData && Array.isArray(parsedResult.structuredData)) {
                            this.dataPool.push(...parsedResult.structuredData);
                        }
                        result = parsedResult.summary;
                    } catch (e) {
                        result = queryResultJson;
                    }
                    
                    updateStatus(taskId, 'completed', `Fetched ${this.dataPool.length} items`);
                    
                } else if (task.tool === 'reasoning') {
                    const reasoningInput = `
Objective: ${objective}
Channel: ${channelId}
Task: ${task.description}

Available Data (${this.dataPool.length} items):
${JSON.stringify(this.dataPool.slice(0, 10), null, 2)}
${this.dataPool.length > 10 ? `... and ${this.dataPool.length - 10} more items` : ''}

Previous Analysis:
${this.executionResults.join('\n\n')}

Provide analysis and insights.
`;
                    result = await reasoningTool.process(reasoningInput);
                    updateStatus(taskId, 'completed', 'Analysis complete');
                }

                this.executionResults.push(`Task ${i + 1} (${task.tool}): ${result}`);
            }

            // 3. Generate Final Report
            updateStatus('report', 'running');

            const finalInput = `
Objective: ${objective}
Channel: ${channelId}

Execution Results:
${this.executionResults.join('\n\n')}

Data Pool (${this.dataPool.length} items):
${JSON.stringify(this.dataPool.slice(0, 5), null, 2)}

Generate a clear, actionable markdown report. Include:
1. Key findings
2. Top recommendations
3. Specific items to focus on (reference by name/ID)
`;
            const markdownReport = await finalResponderTool.process(finalInput);
            updateStatus('report', 'completed', 'Report generated');

            // 4. Extract Focus Items based on report and objective
            updateStatus('focus', 'running');
            const focusItems = await this.extractFocusItemsFromReport(markdownReport, objective);
            updateStatus('focus', 'completed', `${focusItems.length} items identified`);

            return {
                markdownReport,
                focusItems
            };

        } catch (error: any) {
            console.error("[PerformanceAgent] Error:", error);
            throw error;
        }
    }

    /**
     * Legacy analyze method (for backwards compatibility)
     */
    async analyze(channelId: string, objective: string): Promise<PerformanceAnalysisResult> {
        return this.analyzeWithStreaming(channelId, objective);
    }

    /**
     * Extract focus items from the report using LLM to identify relevant items
     * Then fetch those items from the data pool
     */
    private async extractFocusItemsFromReport(report: string, objective: string): Promise<PerformanceAnalysisResult['focusItems']> {
        if (this.dataPool.length === 0) return [];

        // Prepare data pool summary for extraction
        const dataPoolSummary = this.dataPool.map(item => ({
            id: item.id || item.ad_id,
            name: item.ad_name || item.group_value || item.name,
            headline: item.headline,
            creative_name: item.creative_name,
            ad_copy: item.ad_copy,
            roas: item.metrics?.roas || item.roas,
            spend: item.metrics?.spend || item.spend,
            ctr: item.metrics?.ctr || item.ctr
        }));

        const extractorInput = `
## USER OBJECTIVE
${objective}

## PERFORMANCE REPORT
${report}

## DATA POOL (${this.dataPool.length} items)
${JSON.stringify(dataPoolSummary, null, 2)}

Based on the objective and report, which items should be focused on?
`;

        try {
            const extractorResponse = await this.focusExtractorTool.process(extractorInput);
            
            let extraction: { focusItemIdentifiers: string[], selectionReason: string };
            try {
                const cleanJson = extractorResponse.replace(/```json/g, '').replace(/```/g, '').trim();
                extraction = JSON.parse(cleanJson);
            } catch (e) {
                const match = extractorResponse.match(/\{[\s\S]*\}/);
                if (match) {
                    extraction = JSON.parse(match[0]);
                } else {
                    // Fallback to simple extraction
                    console.log("[PerformanceAgent] Failed to parse focus extractor response, using fallback");
                    return this.extractFocusItemsFallback(objective);
                }
            }

            console.log(`[PerformanceAgent] Focus selection: ${extraction.selectionReason}`);

            // Find items in data pool matching the identifiers
            const focusItems: PerformanceAnalysisResult['focusItems'] = [];
            
            for (const identifier of extraction.focusItemIdentifiers) {
                const item = this.dataPool.find(d => {
                    const id = d.id || d.ad_id || '';
                    const name = d.ad_name || d.group_value || d.name || '';
                    const headline = d.headline || '';
                    const creative = d.creative_name || '';
                    const copy = d.ad_copy || '';
                    
                    const idStr = String(identifier).toLowerCase();
                    return (
                        String(id).toLowerCase().includes(idStr) ||
                        name.toLowerCase().includes(idStr) ||
                        headline.toLowerCase().includes(idStr) ||
                        creative.toLowerCase().includes(idStr) ||
                        copy.toLowerCase().includes(idStr) ||
                        idStr.includes(String(id).toLowerCase()) ||
                        idStr.includes(name.toLowerCase())
                    );
                });

                if (item && !focusItems.some(f => f.id === (item.id || item.ad_id))) {
                    focusItems.push({
                        id: item.id || item.ad_id || 'unknown',
                        name: item.ad_name || item.group_value || item.name || 'Unknown',
                        image_url: item.image_url || item.thumbnail || undefined,
                        display_format: item.display_format as 'image' | 'video' | undefined,
                        metrics: item.metrics || {
                            spend: item.spend || 0,
                            roas: item.roas || 0,
                            ctr: item.ctr || 0,
                            impressions: item.impressions || 0
                        }
                    });
                }
            }

            // If no items found, use fallback
            if (focusItems.length === 0) {
                return this.extractFocusItemsFallback(objective);
            }

            return focusItems.slice(0, 5);

        } catch (error) {
            console.error("[PerformanceAgent] Error extracting focus items:", error);
            return this.extractFocusItemsFallback(objective);
        }
    }

    /**
     * Fallback extraction method based on objective keywords
     */
    private extractFocusItemsFallback(objective: string): PerformanceAnalysisResult['focusItems'] {
        if (this.dataPool.length === 0) return [];

        const lowerObjective = objective.toLowerCase();
        const isWorst = lowerObjective.includes('worst') || 
                        lowerObjective.includes('poor') || 
                        lowerObjective.includes('bad') ||
                        lowerObjective.includes('low') ||
                        lowerObjective.includes('underperform') ||
                        lowerObjective.includes('fail');

        // Sort based on objective
        const sorted = [...this.dataPool].sort((a, b) => {
            const aVal = a.metrics?.roas || a.roas || 0;
            const bVal = b.metrics?.roas || b.roas || 0;
            // If looking for worst, sort ascending (lowest first)
            return isWorst ? aVal - bVal : bVal - aVal;
        });

        return sorted.slice(0, 5).map(item => ({
            id: item.id || item.ad_id || 'unknown',
            name: item.ad_name || item.group_value || item.name || 'Unknown',
            image_url: item.image_url || item.thumbnail || undefined,
            display_format: item.display_format as 'image' | 'video' | undefined,
            metrics: item.metrics || {
                spend: item.spend || 0,
                roas: item.roas || 0,
                ctr: item.ctr || 0,
                impressions: item.impressions || 0
            }
        }));
    }
}
