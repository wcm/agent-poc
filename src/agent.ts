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
    applyPreviousRunContext
} from './context';
import { getConnectedIntegrationInputs, resolveIntegrations } from './integrations';
import { requireIntegration } from './integration-requirements';
import { 
    SSEEvent, 
    StreamEmitter, 
    IntegrationInfo,
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
import { generateAdVariationsTool } from './tools/generate-ad-variations';
import { integrationsTool } from './tools/integrations';
import { integrationActionTool } from './tools/integration-action';
import { narratorTool } from './tools/narrator';
import { runMetadataTool } from './tools/run-metadata';
import { logger } from './utils/logger';
import { IntegrationResultRecord } from './types';

class RunBlockedError extends Error {
    result: IntegrationResultRecord;

    constructor(result: IntegrationResultRecord) {
        super(result.content);
        this.name = 'RunBlockedError';
        this.result = result;
    }
}

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
        // Initialize with empty context (integration will be set on first request)
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
        this.context = createEmptyContext(this.context.integration);
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
     * Fetch integration info from analytics data
     */
    private getIntegrationInfo(integrationId: string): IntegrationInfo {
        try {
            const dataPath = path.join(__dirname, 'data', 'own-analytics.json');
            const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
            const integrations = data.integrations;
            const integration = integrations?.find((c: IntegrationInfo) => c.id === integrationId);
            if (integration) return integration;
        } catch (e) {
            logger.log('ERROR', { component: 'Agent', action: 'INIT' }, 'Error reading integration info');
        }
        // Fallback
        return {
            id: integrationId,
            name: integrationId,
            platform: 'unknown',
            account_id: '',
            is_connected: false
        };
    }

    /**
     * Main request handler
     */
    async handleRequest(userInput: string, integrationId: string, userContext?: UserContext): Promise<void> {
        logger.separator('NEW REQUEST');
        logger.agentStart('Agent', { userInput, integrationId, userContext });

        try {
            // Determine the active integration - user selection takes priority
            let activeIntegration: IntegrationInfo;
            if (userContext?.integration) {
                activeIntegration = userContext.integration;
                logger.debug('Agent', 'Using user-selected integration', { integrationId: activeIntegration.id });
            } else {
                activeIntegration = this.getIntegrationInfo(integrationId);
            }

            const connectedIntegrationInputs = userContext?.integrations || getConnectedIntegrationInputs(this.context.integrations);

            // Initialize/update context
            if (!this.initialized || this.context.integration.id !== activeIntegration.id) {
                this.context = createEmptyContext(activeIntegration, userInput, {
                    ...userContext,
                    integrations: connectedIntegrationInputs
                });
                this.initialized = true;
            } else {
                this.context.userInput = userInput;
                this.context.integration = activeIntegration;
                this.context.runMetadata = userContext?.runMetadata;
                this.context.integrations = resolveIntegrations(connectedIntegrationInputs);
                if (userContext?.previousRun) {
                    applyPreviousRunContext(this.context, userContext.previousRun);
                }
                // Update followed brands if provided
                if (userContext?.brands) {
                    this.context.followedBrands = userContext.brands;
                }
            }

            const runTitle = await runMetadataTool.generateTitle(userInput);
            this.stream({ type: 'run_title', title: runTitle });

            // Step 1: Guardrail check
            this.stream({ type: 'text', content: 'Analyzing your request...' });
            
            const guardrailResult = await guardrailTool.check(userInput, this.context);
            logger.guardrail(userInput, guardrailResult.passed, guardrailResult.reason);

            if (!guardrailResult.passed) {
                this.stream({ type: 'text', content: guardrailResult.directResponse || guardrailResult.reason || 'Request could not be processed.' });
                addToHistory(this.context, 'user', userInput);
                addToHistory(this.context, 'assistant', guardrailResult.directResponse || guardrailResult.reason || '');
                await this.emitRunSummary(userInput);
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
                await this.emitRunSummary(userInput);
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
                    if (error instanceof RunBlockedError) {
                        logger.taskEnd('Agent', step.id, 'blocked');
                        this.stream({
                            type: 'run_blocked',
                            reason: 'integration_connection_required',
                            integrationId: error.result.integrationId,
                            integrationName: error.result.integrationName,
                            resultId: error.result.id,
                            message: error.result.content
                        });
                        return;
                    }

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

            await this.emitRunSummary(userInput);

            // Signal completion
            this.stream({ type: 'done' });

        } catch (error: any) {
            logger.log('ERROR', { component: 'Agent', action: 'REQUEST' }, error.message);
            this.stream({ type: 'error', message: error.message });
            this.stream({ type: 'text', content: `Something went wrong: ${error.message}` });
            await this.emitRunSummary(userInput);
            this.stream({ type: 'done' });
        }
    }

    async resumeAfterConnection(integrationId: string, userContext?: UserContext): Promise<void> {
        const plan = this.context.currentPlan;

        if (!plan) {
            this.stream({ type: 'error', message: 'No paused task found to resume.' });
            this.stream({ type: 'done' });
            return;
        }

        try {
            const connectedIntegrationInputs = userContext?.integrations || getConnectedIntegrationInputs(this.context.integrations);
            this.context.integrations = resolveIntegrations(connectedIntegrationInputs);
            if (userContext?.brands) {
                this.context.followedBrands = userContext.brands;
            }

            const resumeIndex = plan.steps.findIndex((step) => step.status !== 'completed');
            if (resumeIndex < 0) {
                this.stream({ type: 'done' });
                return;
            }

            const userInput = this.context.userInput;
            this.stream({ type: 'text', content: `${this.getIntegrationDisplayName(integrationId)} connected. Continuing the task...` });

            let previousStep: PlanStep | null = resumeIndex > 0 ? plan.steps[resumeIndex - 1] : null;
            let previousStepResult = '';

            for (let i = resumeIndex; i < plan.steps.length; i++) {
                const step = plan.steps[i];

                const transitionMessage = await this.generateStepTransition(
                    step, previousStep, previousStepResult, i, plan.steps.length, userInput
                );
                if (transitionMessage) {
                    this.stream({ type: 'text', content: transitionMessage });
                }

                step.status = 'running';
                this.stream({
                    type: 'plan_status',
                    planId: plan.id,
                    taskId: step.id,
                    status: 'running'
                });

                try {
                    const result = await this.executeStep(step);

                    step.status = 'completed';
                    this.stream({
                        type: 'plan_status',
                        planId: plan.id,
                        taskId: step.id,
                        status: 'completed',
                        result: result.substring(0, 100)
                    });

                    logger.taskEnd('Agent', step.id, 'completed');
                    previousStep = step;
                    previousStepResult = result;
                } catch (error: any) {
                    if (error instanceof RunBlockedError) {
                        logger.taskEnd('Agent', step.id, 'blocked');
                        this.stream({
                            type: 'run_blocked',
                            reason: 'integration_connection_required',
                            integrationId: error.result.integrationId,
                            integrationName: error.result.integrationName,
                            resultId: error.result.id,
                            message: error.result.content
                        });
                        return;
                    }

                    step.status = 'failed';
                    this.stream({
                        type: 'plan_status',
                        planId: plan.id,
                        taskId: step.id,
                        status: 'failed'
                    });
                    throw error;
                }
            }

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

            addToHistory(this.context, 'user', userInput);
            addToHistory(this.context, 'assistant', finalMessage || `Completed analysis: ${plan.objective}`);

            await this.emitRunSummary(userInput);
            this.stream({ type: 'done' });
        } catch (error: any) {
            logger.log('ERROR', { component: 'Agent', action: 'RESUME' }, error.message);
            this.stream({ type: 'error', message: error.message });
            this.stream({ type: 'text', content: `Something went wrong while resuming: ${error.message}` });
            this.stream({ type: 'done' });
        }
    }

    private async emitRunSummary(userInput: string): Promise<void> {
        const summary = await runMetadataTool.generateSummary(userInput, this.context);
        this.stream({ type: 'run_summary', summary });
    }

    private getIntegrationDisplayName(integrationId: string): string {
        return this.context.integrations.find((integration) => integration.id === integrationId)?.name || integrationId;
    }

    private emitIntegrationResult(result: IntegrationResultRecord): void {
        this.stream({
            type: 'integration_result',
            resultId: result.id,
            integrationId: result.integrationId,
            integrationName: result.integrationName,
            title: result.title,
            status: result.status,
            mode: result.mode,
            actionStatus: result.actionStatus,
            isBlocking: result.isBlocking,
            canConnect: result.canConnect,
            content: result.content
        });
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
                const requirement = requireIntegration(this.context, {
                    integrationId: this.context.integration.id,
                    fallbackIntegration: this.context.integration,
                    mode: 'instruction',
                    query: 'Data query requires a connected integration',
                    purpose: 'query ad performance data'
                });

                if (requirement.block) {
                    this.context.integrationResults.push(requirement.block);
                    this.emitIntegrationResult(requirement.block);
                    throw new RunBlockedError(requirement.block);
                }

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

            case 'generateAdVariations': {
                const requirement = requireIntegration(this.context, {
                    integrationId: 'brand_guidelines',
                    mode: 'instruction',
                    query: 'Brand Guidelines required for creative generation',
                    purpose: 'generate brand-safe creative concepts and ad variations'
                });

                if (requirement.block) {
                    this.context.integrationResults.push(requirement.block);
                    this.emitIntegrationResult(requirement.block);
                    throw new RunBlockedError(requirement.block);
                }

                const result = await generateAdVariationsTool.execute(step.description, this.context, this.stream);
                return `Generated ad variations for ${result.results.length} items`;
            }

            case 'integrations': {
                const result = await integrationsTool.execute(step.description, this.context);
                this.emitIntegrationResult(result.result);
                if (!result.result.shouldContinue) {
                    throw new RunBlockedError(result.result);
                }
                return result.result.title;
            }

            case 'integrationAction': {
                const result = await integrationActionTool.execute(step.description, this.context);
                this.emitIntegrationResult(result.result);
                if (!result.result.shouldContinue) {
                    throw new RunBlockedError(result.result);
                }
                return result.result.title;
            }

            default:
                throw new Error(`Unknown tool: ${step.tool}`);
        }
    }
}
