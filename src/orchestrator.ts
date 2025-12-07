import { Guardrails } from './agents/guardrails';
import { plannerAgent } from './agents/planner';
import { reasoningAgent } from './agents/reasoning';
import { dataQueryAgent } from './agents/data-query';
import { finalResponseAgent } from './agents/final-responder';
import { errorAgent } from './agents/error-handler';
import { GlobalContext, Task } from './types';
import { EventEmitter } from 'events';

export class Orchestrator extends EventEmitter {
    private context: GlobalContext;

    constructor() {
        super();
        this.context = {
            userInput: '',
            plan: null,
            currentStepIndex: 0,
            globalOutput: []
        };
    }

    async handleRequest(userInput: string): Promise<string> {
        console.log("[Orchestrator] Starting request handling...");
        this.context.userInput = userInput;

        try {
            // 1. Guardrail Check
            this.emit('progress', { agent: 'guardrails', title: 'Safety Check', content: 'Validating input safety and relevance...' });
            const guardResult = await Guardrails.validateInput(userInput);
            if (!guardResult.passed) {
                console.warn("[Orchestrator] Guardrail blocked request.");
                // Throw an error with the specific reason to trigger the catch block
                throw new Error(`Guardrail Violation: ${guardResult.reason}`);
            }

            // 2. Planning Phase
            console.log("[Orchestrator] Planning...");
            this.emit('progress', { agent: 'planner', title: 'Planning', content: 'Analyzing request and creating execution plan...' });
            
            let planJson;
            try {
                planJson = await plannerAgent.process(userInput);
            } catch (e: any) {
                throw new Error(`Planning failed: ${e.message}`);
            }
            
            // Parse JSON
            try {
                this.context.plan = JSON.parse(planJson);
            } catch (e) {
                const match = planJson.match(/\{[\s\S]*\}/);
                if (match) {
                    this.context.plan = JSON.parse(match[0]);
                } else {
                    throw new Error("Failed to parse plan JSON");
                }
            }

            if (!this.context.plan || !this.context.plan.tasks) {
                throw new Error("Invalid plan structure received from planner");
            }

            // Emit the plan to the UI
            this.emit('progress', { 
                agent: 'planner', 
                title: 'Plan Generated', 
                content: `Objective: ${this.context.plan.objective}\nTasks:\n${this.context.plan.tasks.map(t => `- ${t.description}`).join('\n')}` 
            });

            console.log(`[Orchestrator] Plan generated with ${this.context.plan.tasks.length} tasks.`);

            // 3. Execution Loop
            for (let i = 0; i < this.context.plan.tasks.length; i++) {
                this.context.currentStepIndex = i;
                const task = this.context.plan.tasks[i];
                console.log(`[Orchestrator] Executing Step ${i + 1}: ${task.description} (${task.assignedAgent})`);

                // Emit start of task
                this.emit('progress', { 
                    agent: task.assignedAgent, 
                    title: `Executing Step ${i + 1}`, 
                    content: `Task: ${task.description}` 
                });

                const taskInput = this.formatTaskInput(task);
                let taskResult = "";

                try {
                    if (task.assignedAgent === 'reasoning') {
                        taskResult = await reasoningAgent.process(taskInput);
                    } else if (task.assignedAgent === 'data-query') {
                        taskResult = await dataQueryAgent.process(taskInput);
                    } else {
                        throw new Error(`Unknown agent assigned: ${task.assignedAgent}`);
                    }
                } catch (e: any) {
                    throw new Error(`Step ${i+1} (${task.assignedAgent}) failed: ${e.message}`);
                }

                // Emit task result
                this.emit('progress', { 
                    agent: task.assignedAgent, 
                    title: `Step ${i + 1} Complete`, 
                    content: taskResult 
                });

                // Store result
                this.context.globalOutput.push(`Step ${i + 1} Result (${task.assignedAgent}):\n${taskResult}`);
                task.status = 'completed';
                task.result = taskResult;
            }

            // 4. Final Response
            console.log("[Orchestrator] Generating final response...");
            this.emit('progress', { agent: 'final-responder', title: 'Synthesizing', content: 'Generating final answer...' });
            
            const finalInput = `
Original Objective: ${this.context.plan.objective}

Execution Results:
${this.context.globalOutput.join('\n\n')}

Please summarize this into a final answer for the user.
`;
            let finalAnswer;
            try {
                finalAnswer = await finalResponseAgent.process(finalInput);
            } catch (e: any) {
                throw new Error(`Final response generation failed: ${e.message}`);
            }
            return finalAnswer;

        } catch (error: any) {
            console.error("[Orchestrator] Execution failed:", error);
            
            // Delegate ALL errors to the Error Agent
            // The Error Agent will generate a polite, helpful response explaining what went wrong
            const errorResponse = await errorAgent.processError(userInput, error.message || "Unknown System Error");
            
            return errorResponse;
        }
    }

    private formatTaskInput(task: Task): string {
        return `
Current Task: ${task.description}

Global Context:
User Input: "${this.context.userInput}"
Overall Objective: ${this.context.plan?.objective}

Previous Steps Output:
${this.context.globalOutput.join('\n\n')}
`;
    }
}
