import { GuardrailsTool } from './tools/guardrails';
import { errorHandlerTool } from './tools/error-handler';
import { PerformanceAnalysisAgent } from './performance-agent';
import { CreativeInsightsAgent } from './creative-insights-agent';
import { Tool } from './tool-base';
import { EventEmitter } from 'events';
import { 
    SSEEvent, 
    SessionContext, 
    FocusedItemCard, 
    PlanTask,
    StreamEmitter 
} from './types';

/**
 * ConversationOrchestrator
 * 
 * Main entry point for conversations.
 * Uses real-time streaming of SSE events for progressive UI updates.
 * Supports dynamic agent selection and session-level context.
 */
export class ConversationOrchestrator extends EventEmitter {
    private conversationHistory: { role: string, content: string }[] = [];
    private performanceAgent: PerformanceAnalysisAgent;
    private creativeInsightsAgent: CreativeInsightsAgent;
    private routerTool: Tool;
    
    // Session context - persists across turns
    private sessionContext: SessionContext = {
        performanceReports: [],
        focusedItems: [],
        selectedItemIds: [],
        creativeReports: [],
        commonFindingsReport: null,
        agentHistory: []
    };

    constructor() {
        super();
        this.performanceAgent = new PerformanceAnalysisAgent();
        this.creativeInsightsAgent = new CreativeInsightsAgent();

        // Router tool for request classification
        this.routerTool = new Tool({
            name: "Router",
            model: "google/gemini-2.5-flash-lite",
            systemPrompt: `You are a routing system for a Marketing Analytics AI Assistant.

## AVAILABLE AGENTS
1. **performance_analysis**: Data analysis, performance reports, ad comparisons, metrics
2. **creative_insights**: Deep creative analysis of specific items (needs items to analyze)
3. **performance_then_creative**: Chain both - first identify top performers, then analyze WHY

## DECISION RULES
- Metrics/rankings/comparisons → performance_analysis
- "Why is X performing well?", "Deep dive", "What makes ads work?" → performance_then_creative
- "Analyze this creative" (when items known) → creative_insights
- Simple questions/greetings → Answer directly

## OUTPUT FORMAT (JSON only)
{
    "action": "direct" | "call_agent",
    "agent": "performance_analysis" | "creative_insights" | "performance_then_creative" | null,
    "performanceObjective": "Objective for performance analysis",
    "creativeObjective": "Objective for creative insights",
    "channelOverride": "channel_id" | null,
    "directResponse": "Your response (if direct)"
}

## CHANNEL DETECTION
- "Meta ads" → "channel_1"
- "TikTok ads" → "channel_2"`
        });
    }

    /**
     * Stream emitter - sends SSE events to the client
     */
    private stream: StreamEmitter = (event: SSEEvent) => {
        this.emit('stream', event);
    };

    /**
     * Clear history and reset session context
     */
    clearHistory() {
        this.conversationHistory = [];
        this.sessionContext = {
            performanceReports: [],
            focusedItems: [],
            selectedItemIds: [],
            creativeReports: [],
            commonFindingsReport: null,
            agentHistory: []
        };
        console.log("[Orchestrator] History cleared.");
    }

    /**
     * Get session context
     */
    getSessionContext(): SessionContext {
        return this.sessionContext;
    }

    private getRecentHistory(limit: number = 5): string {
        if (this.conversationHistory.length === 0) return "No previous conversation.";
        const recent = this.conversationHistory.slice(-limit);
        return recent.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    }

    /**
     * Main request handler with real-time streaming
     */
    async handleRequest(userInput: string, activeChannelId: string): Promise<void> {
        console.log("[Orchestrator] Starting request...");
        console.log(`[Orchestrator] Channel: ${activeChannelId}`);

        try {
            // Phase 1: Orchestrator routing
            this.stream({ type: 'text', content: "Let me analyze your request..." });

            // Create routing plan
            const routingPlanId = `routing-${Date.now()}`;
            const routingTasks: PlanTask[] = [
                { id: 'safety', description: 'Safety & relevance check', tool: 'guardrails', status: 'pending' },
                { id: 'route', description: 'Determine best approach', tool: 'router', status: 'pending' },
                { id: 'select', description: 'Select agent', tool: 'selector', status: 'pending' }
            ];
            
            this.stream({ 
                type: 'plan', 
                planId: routingPlanId, 
                agentName: 'Orchestrator',
                title: 'Request Analysis',
                tasks: routingTasks 
            });

            // Task 1: Safety check
            this.stream({ type: 'plan_status', planId: routingPlanId, taskId: 'safety', status: 'running' });
            
            const historyForGuardrail = this.getRecentHistory(4);
            const guardResult = await GuardrailsTool.validateInput(userInput, historyForGuardrail);

            if (!guardResult.passed) {
                this.stream({ type: 'plan_status', planId: routingPlanId, taskId: 'safety', status: 'failed' });
                throw new Error(`Guardrail Violation: ${guardResult.reason}`);
            }
            this.stream({ type: 'plan_status', planId: routingPlanId, taskId: 'safety', status: 'completed' });

            // Task 2: Route request
            this.stream({ type: 'plan_status', planId: routingPlanId, taskId: 'route', status: 'running' });

            const routerInput = `
CONVERSATION HISTORY:
${this.getRecentHistory(6)}

USER MESSAGE: ${userInput}
ACTIVE CHANNEL: ${activeChannelId}
CONTEXT: ${this.sessionContext.focusedItems.length > 0 ? `${this.sessionContext.focusedItems.length} focused items available` : 'No previous context'}
`;
            const routerResponse = await this.routerTool.process(routerInput);
            
            let routeDecision;
            try {
                const cleanJson = routerResponse.replace(/```json/g, '').replace(/```/g, '').trim();
                routeDecision = JSON.parse(cleanJson);
            } catch (e) {
                const match = routerResponse.match(/\{[\s\S]*\}/);
                if (match) {
                    routeDecision = JSON.parse(match[0]);
                } else {
                    throw new Error("Failed to parse router response");
                }
            }

            this.stream({ type: 'plan_status', planId: routingPlanId, taskId: 'route', status: 'completed' });

            // Task 3: Select agent
            this.stream({ type: 'plan_status', planId: routingPlanId, taskId: 'select', status: 'running' });
            
            const channelId = routeDecision.channelOverride || activeChannelId;
            const selectedAgent = routeDecision.agent || 'direct';
            
            this.stream({ 
                type: 'plan_status', 
                planId: routingPlanId, 
                taskId: 'select', 
                status: 'completed',
                result: `Selected: ${selectedAgent}`
            });

            console.log("[Orchestrator] Route decision:", routeDecision);

            // Phase 2: Execute based on routing decision
            if (routeDecision.action === 'direct') {
                this.stream({ type: 'text', content: routeDecision.directResponse || "How can I help you?" });
                
            } else if (routeDecision.agent === 'performance_analysis') {
                this.stream({ type: 'text', content: "I'll analyze your ad performance data..." });
                
                await this.runPerformanceAgent(
                    channelId,
                    routeDecision.performanceObjective || userInput
                );
                
                this.stream({ type: 'text', content: "Analysis complete! You can ask me to dive deeper into any of these items, or explore other aspects of your data." });
                
            } else if (routeDecision.agent === 'creative_insights') {
                await this.runCreativeInsightsAgent(
                    routeDecision.creativeObjective || userInput
                );
                
            } else if (routeDecision.agent === 'performance_then_creative') {
                // Chain: Performance → Creative
                this.stream({ type: 'text', content: "I'll first identify your top performers, then analyze why they work..." });
                
                await this.runPerformanceAgent(
                    channelId,
                    routeDecision.performanceObjective || "Identify top performing items"
                );

                if (this.sessionContext.focusedItems.length > 0) {
                    this.stream({ type: 'text', content: "Now let me analyze the creative elements of these top performers..." });
                    
                    await this.runCreativeInsightsAgent(
                        routeDecision.creativeObjective || "Analyze why these items perform well"
                    );
                    
                    this.stream({ type: 'text', content: "Based on my analysis, I recommend focusing on the patterns identified in the common findings. Would you like me to elaborate on any specific aspect?" });
                } else {
                    this.stream({ type: 'text', content: "I couldn't identify specific items for creative analysis. Try adjusting your filters or asking about a different metric." });
                }
                
            } else {
                this.stream({ type: 'text', content: "I'm not sure how to handle that request. Could you rephrase?" });
            }

            // Update conversation history
            this.conversationHistory.push({ role: 'user', content: userInput });
            this.conversationHistory.push({ role: 'assistant', content: `[Processed with ${selectedAgent}]` });

            // Signal completion
            this.stream({ type: 'done' });

        } catch (error: any) {
            console.error("[Orchestrator] Error:", error);
            const errorResponse = await errorHandlerTool.processError(userInput, error.message || "Unknown error");
            this.stream({ type: 'text', content: errorResponse });
            this.stream({ type: 'error', message: error.message });
            this.stream({ type: 'done' });
        }
    }

    /**
     * Run Performance Analysis Agent with streaming
     */
    private async runPerformanceAgent(channelId: string, objective: string): Promise<void> {
        console.log(`[Orchestrator] Running Performance Agent: ${objective}`);

        // Record in history
        this.sessionContext.agentHistory.push({
            agent: 'performance_analysis',
            objective,
            timestamp: Date.now()
        });

        // Create performance plan
        const planId = `perf-${Date.now()}`;
        const tasks: PlanTask[] = [
            { id: 'plan', description: 'Create analysis plan', tool: 'planner', status: 'pending' },
            { id: 'query', description: 'Fetch ad data', tool: 'data-query', status: 'pending' },
            { id: 'analyze', description: 'Analyze metrics', tool: 'reasoning', status: 'pending' },
            { id: 'report', description: 'Generate report', tool: 'reporter', status: 'pending' },
            { id: 'focus', description: 'Identify focus items', tool: 'selector', status: 'pending' }
        ];

        this.stream({
            type: 'plan',
            planId,
            agentName: 'Performance Analysis',
            title: objective,
            tasks
        });

        // Execute with the agent
        const result = await this.performanceAgent.analyzeWithStreaming(
            channelId,
            objective,
            (taskId: string, status: PlanTask['status'], result?: string) => {
                this.stream({ type: 'plan_status', planId, taskId, status, result });
            }
        );

        // Emit the report
        const reportId = `perf-report-${Date.now()}`;
        this.stream({
            type: 'report',
            reportType: 'performance',
            reportId,
            title: 'Performance Analysis Report',
            content: result.markdownReport
        });

        // Store in session context
        this.sessionContext.performanceReports.push({
            id: reportId,
            title: 'Performance Analysis Report',
            content: result.markdownReport,
            channelId,
            timestamp: Date.now()
        });

        // Emit focused items if any
        if (result.focusItems.length > 0) {
            const focusedItems: FocusedItemCard[] = result.focusItems.map(item => ({
                id: item.id,
                name: item.name,
                thumbnail: item.image_url,
                type: 'ad' as const,
                displayFormat: item.display_format,
                metrics: {
                    roas: item.metrics.roas,
                    spend: item.metrics.spend,
                    ctr: item.metrics.ctr,
                    impressions: item.metrics.impressions
                }
            }));

            this.stream({ type: 'focused_items', items: focusedItems });

            // Update session context
            this.sessionContext.focusedItems = focusedItems;
            
            this.stream({
                type: 'context_update',
                context: {
                    focusedItems,
                    performanceReports: this.sessionContext.performanceReports
                }
            });
        }
    }

    /**
     * Run Creative Insights Agent with streaming
     */
    private async runCreativeInsightsAgent(objective: string): Promise<void> {
        console.log(`[Orchestrator] Running Creative Insights: ${objective}`);

        const itemsToAnalyze = this.sessionContext.focusedItems;

        if (itemsToAnalyze.length === 0) {
            this.stream({ type: 'text', content: "No items available for creative analysis. Please run a performance analysis first." });
            return;
        }

        // Record in history
        this.sessionContext.agentHistory.push({
            agent: 'creative_insights',
            objective,
            timestamp: Date.now()
        });

        // Convert to agent format
        const focusedItems = itemsToAnalyze.map(item => ({
            id: item.id,
            name: item.name,
            type: item.type,
            image_url: item.thumbnail,
            display_format: item.displayFormat,
            metrics: item.metrics as Record<string, number>
        }));

        // Run creative analysis with streaming
        const result = await this.creativeInsightsAgent.analyzeWithStreaming(
            focusedItems,
            objective,
            this.stream
        );

        // Store creative reports in context - use formattedContent directly from the agent
        for (const report of result.reports) {
            const reportId = `creative-${report.itemId}-${Date.now()}`;
            
            this.sessionContext.creativeReports.push({
                id: reportId,
                itemId: report.itemId,
                itemName: report.itemName,
                content: report.formattedContent
            });
        }

        // Store common findings
        if (result.commonFindings) {
            this.sessionContext.commonFindingsReport = result.commonFindings;
        }

        // Emit context update
        this.stream({
            type: 'context_update',
            context: {
                creativeReports: this.sessionContext.creativeReports,
                commonFindingsReport: this.sessionContext.commonFindingsReport
            }
        });
    }
}
