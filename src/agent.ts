import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { 
    GlobalContext, 
    Plan, 
    PlanStep,
    UserContext,
    createEmptyContext, 
    addToHistory,
    generateId
} from './context';
import { 
    SSEEvent, 
    StreamEmitter, 
    ChannelInfo,
    PlanTask
} from './types';
import { guardrailTool } from './tools/guardrail';
import { plannerTool } from './tools/planner';
import { dataQueryTool } from './tools/data-query';
import { discoveryQueryTool } from './tools/discovery-query';
import { dataAnalysisTool } from './tools/data-analysis';
import { focusItemsTool } from './tools/focus-items';
import { creativeInsightsTool } from './tools/creative-insights';
import { consolidateFindingsTool } from './tools/consolidate-findings';
import { narratorTool } from './tools/narrator';
import { logger } from './utils/logger';

/**
 * Unified Agent
 * 
 * Single orchestrator that handles all conversation flows:
 * 1. Guardrail check - determines if planning is needed
 * 2. Planner - creates execution plan from tools
 * 3. Executor - runs plan step by step
 * 4. Narrator - adds context between steps and suggests next actions
 */
export class Agent extends EventEmitter {
    // Session context persisted across turns
    private context: GlobalContext;
    private initialized: boolean = false;

    constructor() {
        super();
        // Initialize with empty context (channel will be set on first request)
        this.context = createEmptyContext({
            id: '',
            name: '',
            platform: '',
            account_id: '',
            is_connected: false
        });
    }

    /**
     * Stream emitter - sends SSE events to the client
     */
    private stream: StreamEmitter = (event: SSEEvent) => {
        this.emit('stream', event);
    };

    /**
     * Clear context and reset
     */
    clearHistory(): void {
        this.context = createEmptyContext(this.context.channel);
        this.initialized = false;
        logger.debug('Agent', 'History cleared');
    }

    /**
     * Get current context
     */
    getContext(): GlobalContext {
        return this.context;
    }

    /**
     * Fetch channel info from analytics data
     */
    private getChannelInfo(channelId: string): ChannelInfo {
        try {
            const dataPath = path.join(__dirname, 'data', 'own-analytics.json');
            const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
            const channel = data.channels?.find((c: ChannelInfo) => c.id === channelId);
            if (channel) return channel;
        } catch (e) {
            logger.log('ERROR', { component: 'Agent', action: 'INIT' }, 'Error reading channel info');
        }
        // Fallback
        return {
            id: channelId,
            name: channelId,
            platform: 'unknown',
            account_id: '',
            is_connected: true
        };
    }

    /**
     * Main request handler
     */
    async handleRequest(userInput: string, channelId: string, userContext?: UserContext): Promise<void> {
        logger.separator('NEW REQUEST');
        logger.agentStart('Agent', { userInput, channelId, userContext });

        try {
            // Determine the active channel - user selection takes priority
            let activeChannel: ChannelInfo;
            if (userContext?.channel) {
                activeChannel = userContext.channel;
                logger.debug('Agent', 'Using user-selected channel', { channelId: activeChannel.id });
            } else {
                activeChannel = this.getChannelInfo(channelId);
            }

            // Initialize/update context
            if (!this.initialized || this.context.channel.id !== activeChannel.id) {
                this.context = createEmptyContext(activeChannel, userInput, userContext);
                this.initialized = true;
            } else {
                this.context.userInput = userInput;
                this.context.channel = activeChannel;
                // Update followed brands if provided
                if (userContext?.brands) {
                    this.context.followedBrands = userContext.brands;
                }
            }

            // Step 1: Guardrail check
            this.stream({ type: 'text', content: 'Analyzing your request...' });
            
            const guardrailResult = await guardrailTool.check(userInput, this.context);
            logger.guardrail(userInput, guardrailResult.passed, guardrailResult.reason);

            if (!guardrailResult.passed) {
                this.stream({ type: 'text', content: guardrailResult.directResponse || guardrailResult.reason || 'Request could not be processed.' });
                addToHistory(this.context, 'user', userInput);
                addToHistory(this.context, 'assistant', guardrailResult.directResponse || guardrailResult.reason || '');
                this.stream({ type: 'done' });
                return;
            }

            // Step 2: Check if planning is needed
            if (!guardrailResult.needsPlanning) {
                // Direct response - no planning needed
                const response = guardrailResult.directResponse || "How can I help you with your ad analytics?";
                this.stream({ type: 'text', content: response });
                addToHistory(this.context, 'user', userInput);
                addToHistory(this.context, 'assistant', response);
                this.stream({ type: 'done' });
                return;
            }

            // Step 3: Create plan
            const plan = await plannerTool.createPlan(userInput, this.context);
            this.context.currentPlan = plan;
            
            logger.plan('Agent', plan.steps.map(s => ({ 
                id: s.id, 
                description: s.description, 
                tool: s.tool 
            })));

            // Emit plan to frontend
            const planTasks: PlanTask[] = plan.steps.map(step => ({
                id: step.id,
                description: step.description,
                tool: step.tool,
                status: 'pending' as const
            }));

            this.stream({
                type: 'plan',
                planId: plan.id,
                agentName: 'Atria',
                title: plan.objective,
                tasks: planTasks
            });

            // Narrator intro
            const introMessage = await narratorTool.generate({
                type: 'intro',
                userInput,
                planObjective: plan.objective,
                context: this.context
            });
            if (introMessage) {
                this.stream({ type: 'text', content: introMessage });
            }

            // Step 4: Execute plan
            let previousStep: PlanStep | null = null;
            let previousStepResult: string = '';
            
            for (let i = 0; i < plan.steps.length; i++) {
                const step = plan.steps[i];
                
                // Dynamic narrator transition before step (if warranted)
                const transitionMessage = await this.generateStepTransition(
                    step, previousStep, previousStepResult, i, plan.steps.length, userInput
                );
                if (transitionMessage) {
                    this.stream({ type: 'text', content: transitionMessage });
                }
                
                // Update step status to running
                step.status = 'running';
                this.stream({ 
                    type: 'plan_status', 
                    planId: plan.id, 
                    taskId: step.id, 
                    status: 'running' 
                });

                try {
                    const result = await this.executeStep(step);
                    
                    // Update step status to completed
                    step.status = 'completed';
                    this.stream({ 
                        type: 'plan_status', 
                        planId: plan.id, 
                        taskId: step.id, 
                        status: 'completed',
                        result: result.substring(0, 100) // Brief result preview
                    });

                    logger.taskEnd('Agent', step.id, 'completed');
                    previousStep = step;
                    previousStepResult = result;

                } catch (error: any) {
                    step.status = 'failed';
                    this.stream({ 
                        type: 'plan_status', 
                        planId: plan.id, 
                        taskId: step.id, 
                        status: 'failed' 
                    });
                    
                    logger.log('ERROR', { component: 'Agent', action: 'EXECUTE' }, `Step ${step.id} failed: ${error.message}`);
                    
                    // Narrator error message
                    const errorMessage = await narratorTool.generate({
                        type: 'error',
                        userInput,
                        error: error.message,
                        context: this.context
                    });
                    this.stream({ type: 'text', content: errorMessage });
                    previousStep = step;
                    previousStepResult = `Error: ${error.message}`;
                }
            }

            // Step 5: Final narrator with suggestions
            const finalMessage = await narratorTool.generate({
                type: 'final',
                userInput,
                planObjective: plan.objective,
                completedSteps: plan.steps.filter(s => s.status === 'completed').length,
                totalSteps: plan.steps.length,
                context: this.context
            });
            if (finalMessage) {
                this.stream({ type: 'text', content: finalMessage });
            }

            // Update conversation history
            addToHistory(this.context, 'user', userInput);
            addToHistory(this.context, 'assistant', finalMessage || `Completed analysis: ${plan.objective}`);

            // Signal completion
            this.stream({ type: 'done' });

        } catch (error: any) {
            logger.log('ERROR', { component: 'Agent', action: 'REQUEST' }, error.message);
            this.stream({ type: 'error', message: error.message });
            this.stream({ type: 'text', content: `Something went wrong: ${error.message}` });
            this.stream({ type: 'done' });
        }
    }

    /**
     * Generate a transition message before a step (if warranted)
     * Returns empty string if no transition needed
     */
    private async generateStepTransition(
        currentStep: PlanStep,
        previousStep: PlanStep | null,
        previousStepResult: string,
        stepIndex: number,
        totalSteps: number,
        userInput: string
    ): Promise<string> {
        // Skip transition for the first step (intro already covers it)
        if (stepIndex === 0) {
            return '';
        }

        // Generate transition with previous step context
        const transitionMessage = await narratorTool.generate({
            type: 'transition',
            userInput,
            previousStepDescription: previousStep?.description,
            stepResult: previousStepResult,
            stepDescription: currentStep.description,
            completedSteps: stepIndex,
            totalSteps: totalSteps,
            context: this.context
        });

        return transitionMessage;
    }

    /**
     * Execute a single plan step
     */
    private async executeStep(step: PlanStep): Promise<string> {
        logger.taskStart('Agent', step.id, step.description, step.tool);

        switch (step.tool) {
            case 'dataQuery': {
                const result = await dataQueryTool.execute(step.description, this.context);
                this.stream({ type: 'text', content: result.message });
                return result.message;
            }

            case 'discoveryQuery': {
                const result = await discoveryQueryTool.execute(step.description, this.context);
                this.stream({ type: 'text', content: result.message });
                return result.message;
            }

            case 'dataAnalysis': {
                const result = await dataAnalysisTool.execute(step.description, this.context);
                this.stream({
                    type: 'report',
                    reportType: 'performance',
                    reportId: result.report.id,
                    title: 'Performance Analysis',
                    content: result.content
                });
                return `Analysis report generated`;
            }

            case 'focusItems': {
                const result = await focusItemsTool.execute(step.description, this.context);
                this.stream({ 
                    type: 'focused_items', 
                    items: result.items 
                });
                return `Selected ${result.items.length} items: ${result.summary}`;
            }

            case 'creativeInsights': {
                const result = await creativeInsightsTool.execute(step.description, this.context, this.stream);
                return `Generated ${result.reports.length} creative insights reports`;
            }

            case 'consolidateFindings': {
                const result = await consolidateFindingsTool.execute(step.description, this.context);
                this.stream({
                    type: 'report',
                    reportType: 'common',
                    reportId: result.report.id,
                    title: 'Consolidated Findings',
                    content: result.content
                });
                return `Consolidation report generated`;
            }

            default:
                throw new Error(`Unknown tool: ${step.tool}`);
        }
    }
}

