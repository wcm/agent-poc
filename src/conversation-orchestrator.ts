import { GuardrailsTool } from './tools/guardrails';
import { errorHandlerTool } from './tools/error-handler';
import { narratorTool, NarratorContext } from './tools/narrator';
import { PerformanceAnalysisAgent } from './performance-agent';
import { CreativeInsightsAgent } from './creative-insights-agent';
import { Tool } from './tool-base';
import { EventEmitter } from 'events';
import { 
    SSEEvent, 
    SessionContext, 
    FocusedItemCard, 
    PlanTask,
    StreamEmitter,
    ChannelInfo
} from './types';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './utils/logger';

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
    
    // Track narrator messages during a turn for history
    private currentTurnMessages: string[] = [];
    
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
3. **performance_then_creative**: Chain both - first identify items, then analyze WHY

## DECISION RULES
- NEW data request (metrics/rankings/comparisons) → performance_analysis
- "Why is X performing well?", "Deep dive" → performance_then_creative  
- "Analyze this creative" (when items known) → creative_insights
- Simple questions/greetings → direct
- **FOLLOW-UP QUESTIONS about existing reports/data** → context_answer

## CONFIRMATORY RESPONSES (IMPORTANT!)
When user says "yes", "sure", "okay", "do it", "go ahead", "please do", etc.:
- Look at the ASSISTANT's LAST message in the conversation history
- If the assistant suggested an action (e.g., "compare with underperforming ads", "analyze more ads"):
  - Extract the suggested action as the NEW objective
  - Route to the appropriate agent based on that suggestion
  - Set performanceObjective/creativeObjective based on what was suggested
- Example: If assistant said "compare these with underperforming ads?" and user says "yes":
  - performanceObjective = "Identify worst performing ads for comparison"
  - agent = "performance_then_creative"

## CONTEXT-AWARE ANSWERS
When user asks about EXISTING context (e.g. "summarize", "what did you find?"):
- Check if EXISTING_CONTEXT shows reports/items exist
- If yes: set action="context_answer" and contextQuery="what user wants"
- Do NOT re-run agents for questions about existing data

## OUTPUT FORMAT (JSON only)
{
    "action": "direct" | "call_agent" | "context_answer",
    "agent": "performance_analysis" | "creative_insights" | "performance_then_creative" | null,
    "performanceObjective": "Objective for performance analysis",
    "creativeObjective": "Objective for creative insights",
    "channelOverride": "channel_id" | null,
    "directResponse": "Your response (if direct)",
    "contextQuery": "What user wants from existing context (if context_answer)"
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
     * Fetch channel info from the analytics data
     */
    private getChannelInfo(channelId: string): ChannelInfo {
        try {
            const dataPath = path.join(__dirname, 'data', 'own-analytics.json');
            const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
            const channel = data.channels?.find((c: ChannelInfo) => c.id === channelId);
            if (channel) {
                return channel;
            }
        } catch (e) {
            console.error('[Orchestrator] Error reading channel info:', e);
        }
        // Fallback if channel not found
        return {
            id: channelId,
            name: channelId,
            platform: 'unknown',
            account_id: '',
            is_connected: true
        };
    }

    /**
     * Generate contextual narrator message and track for history
     */
    private async narrate(userQuestion: string, context: Partial<NarratorContext>): Promise<void> {
        const message = await narratorTool.generate({
            userQuestion,
            messageType: context.messageType || 'intro',
            ...context
        } as NarratorContext);
        this.stream({ type: 'text', content: message });
        // Track for conversation history
        this.currentTurnMessages.push(message);
    }

    /**
     * Main request handler with real-time streaming
     */
    async handleRequest(userInput: string, activeChannelId: string): Promise<void> {
        logger.separator('NEW REQUEST');
        logger.agentStart('Orchestrator', {
            userInput,
            channelId: activeChannelId,
            historyLength: this.conversationHistory.length,
            existingContext: {
                performanceReports: this.sessionContext.performanceReports.length,
                focusedItems: this.sessionContext.focusedItems.length,
                creativeReports: this.sessionContext.creativeReports.length,
                hasCommonFindings: !!this.sessionContext.commonFindingsReport
            }
        });
        
        // Reset turn tracking
        this.currentTurnMessages = [];

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
            logger.guardrail(userInput, guardResult.passed, guardResult.reason);

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

EXISTING_CONTEXT:
- Performance Reports: ${this.sessionContext.performanceReports.length > 0 ? `${this.sessionContext.performanceReports.length} report(s) generated` : 'None'}
- Focused Items: ${this.sessionContext.focusedItems.length > 0 ? `${this.sessionContext.focusedItems.length} item(s) identified` : 'None'}
- Creative Reports: ${this.sessionContext.creativeReports.length > 0 ? `${this.sessionContext.creativeReports.length} report(s) generated` : 'None'}
- Common Findings: ${this.sessionContext.commonFindingsReport ? 'Available' : 'None'}
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

            logger.route({
                action: routeDecision.action,
                agent: selectedAgent,
                channelId,
                performanceObjective: routeDecision.performanceObjective,
                creativeObjective: routeDecision.creativeObjective
            });

            // Phase 2: Execute based on routing decision
            if (routeDecision.action === 'direct') {
                this.stream({ type: 'text', content: routeDecision.directResponse || "How can I help you?" });
                
            } else if (routeDecision.action === 'context_answer') {
                // Answer from existing context without re-running agents
                await this.answerFromContext(userInput, routeDecision.contextQuery || userInput);
                
            } else if (routeDecision.agent === 'performance_analysis') {
                // Dynamic intro
                await this.narrate(userInput, {
                    messageType: 'intro',
                    nextAgent: 'performance',
                    agentObjective: routeDecision.performanceObjective || userInput
                });
                
                await this.runPerformanceAgent(
                    channelId,
                    routeDecision.performanceObjective || userInput,
                    userInput
                );
                
                // Dynamic summary
                await this.narrate(userInput, {
                    messageType: 'summary',
                    agentsRun: ['performance_analysis'],
                    totalReports: 1,
                    focusedItemsCount: this.sessionContext.focusedItems.length
                });
                
            } else if (routeDecision.agent === 'creative_insights') {
                // Dynamic intro for creative
                await this.narrate(userInput, {
                    messageType: 'intro',
                    nextAgent: 'creative_insights',
                    agentObjective: routeDecision.creativeObjective || userInput
                });
                
                await this.runCreativeInsightsAgent(
                    routeDecision.creativeObjective || userInput
                );

                // Dynamic summary
                await this.narrate(userInput, {
                    messageType: 'summary',
                    agentsRun: ['creative_insights'],
                    totalReports: this.sessionContext.creativeReports.length,
                    commonFindingsGenerated: !!this.sessionContext.commonFindingsReport
                });
                
            } else if (routeDecision.agent === 'performance_then_creative') {
                // Chain: Performance → Creative
                // Dynamic intro for chained analysis
                await this.narrate(userInput, {
                    messageType: 'intro',
                    nextAgent: 'performance',
                    agentObjective: routeDecision.performanceObjective || "Identify items based on your criteria"
                });
                
                await this.runPerformanceAgent(
                    channelId,
                    routeDecision.performanceObjective || "Identify top performing items",
                    userInput
                );

                if (this.sessionContext.focusedItems.length > 0) {
                    // Dynamic transition
                    await this.narrate(userInput, {
                        messageType: 'transition',
                        previousAgent: 'performance',
                        previousResult: {
                            itemsFound: this.sessionContext.focusedItems.length,
                            reportGenerated: true
                        },
                        nextAgent: 'creative_insights',
                        agentObjective: routeDecision.creativeObjective || "Analyze the creative elements"
                    });
                    
                    await this.runCreativeInsightsAgent(
                        routeDecision.creativeObjective || "Generate creativeinsights on these items"
                    );
                    
                    // Dynamic summary for chained analysis
                    await this.narrate(userInput, {
                        messageType: 'summary',
                        agentsRun: ['performance_analysis', 'creative_insights'],
                        totalReports: 1 + this.sessionContext.creativeReports.length,
                        focusedItemsCount: this.sessionContext.focusedItems.length,
                        commonFindingsGenerated: !!this.sessionContext.commonFindingsReport
                    });
                } else {
                    this.stream({ type: 'text', content: "I couldn't identify specific items for creative analysis. Try adjusting your filters or asking about a different metric." });
                }
                
            } else {
                this.stream({ type: 'text', content: "I'm not sure how to handle that request. Could you rephrase?" });
            }

            // Update conversation history with actual messages
            this.conversationHistory.push({ role: 'user', content: userInput });
            // Use the last narrator message (usually the summary with suggestions) for history
            const assistantContent = this.currentTurnMessages.length > 0 
                ? this.currentTurnMessages[this.currentTurnMessages.length - 1]
                : `[Processed with ${selectedAgent}]`;
            this.conversationHistory.push({ role: 'assistant', content: assistantContent });

            // Signal completion
            this.stream({ type: 'done' });

        } catch (error: any) {
            logger.log('ERROR', { component: 'Orchestrator', action: 'ERROR' }, error.message, { stack: error.stack?.slice(0, 500) });
            const errorResponse = await errorHandlerTool.processError(userInput, error.message || "Unknown error");
            this.stream({ type: 'text', content: errorResponse });
            this.stream({ type: 'error', message: error.message });
            this.stream({ type: 'done' });
        }
    }

    /**
     * Run Performance Analysis Agent with streaming
     */
    private async runPerformanceAgent(channelId: string, objective: string, userQuestion: string): Promise<void> {
        // Fetch full channel info
        const channel = this.getChannelInfo(channelId);
        
        logger.agentStart('PerformanceAgent', {
            channelId: channel.id,
            channelName: channel.name,
            platform: channel.platform,
            objective,
            userQuestion
        });

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

        // Execute with the agent - pass full channel info
        const result = await this.performanceAgent.analyzeWithStreaming(
            channel,
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
            // Narrate transition to focused items
            await this.narrate(userQuestion, {
                messageType: 'transition',
                previousAgent: 'performance',
                previousResult: {
                    reportGenerated: true,
                    itemsFound: result.focusItems.length
                }
            });
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
        
        logger.agentEnd('PerformanceAgent', {
            reportLength: result.markdownReport.length,
            focusItemsCount: result.focusItems.length
        });
    }

    /**
     * Run Creative Insights Agent with streaming
     */
    private async runCreativeInsightsAgent(objective: string): Promise<void> {
        const itemsToAnalyze = this.sessionContext.focusedItems;
        
        logger.agentStart('CreativeInsightsAgent', {
            objective,
            itemsCount: itemsToAnalyze.length,
            items: itemsToAnalyze.map(i => ({ id: i.id, name: i.name, type: i.type }))
        });

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
        
        logger.agentEnd('CreativeInsightsAgent', {
            reportsCount: result.reports.length,
            hasCommonFindings: !!result.commonFindings
        });
    }

    /**
     * Answer a follow-up question using existing context
     */
    private async answerFromContext(userInput: string, contextQuery: string): Promise<void> {
        logger.debug('Orchestrator', 'Answering from context', { contextQuery });

        // Build context summary
        let contextContent = '';
        
        if (this.sessionContext.performanceReports.length > 0) {
            const latestReport = this.sessionContext.performanceReports[this.sessionContext.performanceReports.length - 1];
            contextContent += `## Latest Performance Report\n${latestReport.content}\n\n`;
        }

        if (this.sessionContext.focusedItems.length > 0) {
            contextContent += `## Focused Items (${this.sessionContext.focusedItems.length})\n`;
            contextContent += this.sessionContext.focusedItems.map(item => 
                `- ${item.name} (ROAS: ${item.metrics.roas?.toFixed(2) || 'N/A'}, Spend: $${item.metrics.spend?.toFixed(0) || 'N/A'})`
            ).join('\n');
            contextContent += '\n\n';
        }

        if (this.sessionContext.creativeReports.length > 0) {
            contextContent += `## Creative Reports (${this.sessionContext.creativeReports.length})\n`;
            for (const report of this.sessionContext.creativeReports) {
                contextContent += `### ${report.itemName}\n${report.content}\n\n`;
            }
        }

        if (this.sessionContext.commonFindingsReport) {
            contextContent += `## Common Findings\n${this.sessionContext.commonFindingsReport}\n`;
        }

        // Use a simple tool to answer from context
        const contextAnswerTool = new Tool({
            name: "ContextAnswer",
            model: "google/gemini-2.5-flash-lite",
            systemPrompt: `You answer follow-up questions about analysis results.
Given existing context and a user question, provide a helpful summary or answer.
Be concise and reference specific data from the context when relevant.
Format your response in markdown if helpful.`
        });

        const answerInput = `
USER QUESTION: ${userInput}
SPECIFIC QUERY: ${contextQuery}

AVAILABLE CONTEXT:
${contextContent || 'No context available yet.'}

Provide a helpful answer based on the available context.
`;

        const answer = await contextAnswerTool.process(answerInput);
        this.stream({ type: 'text', content: answer });
    }
}
