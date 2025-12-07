export interface Task {
    id: string;
    description: string;
    assignedAgent: 'reasoning' | 'data-query';
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    result?: string;
}

export interface GlobalPlan {
    objective: string;
    tasks: Task[];
}

export interface GlobalContext {
    userInput: string;
    plan: GlobalPlan | null;
    currentStepIndex: number;
    globalOutput: string[]; // Accumulate results from steps
}

