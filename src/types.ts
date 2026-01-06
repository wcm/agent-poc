/**
 * Channel Info - Analytics channel data
 */
export interface ChannelInfo {
    id: string;
    name: string;
    platform: string;
    account_id: string;
    is_connected: boolean;
}

/**
 * Brand Info - Followed brand data
 */
export interface BrandInfo {
    id: string;
    name: string;
    logo?: string;
    category?: string;
    description?: string;
    website?: string;
    is_followed: boolean;
}

/**
 * SSE Event Types - Sent from server to frontend
 */

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface PlanTask {
    id: string;
    description: string;
    tool: string;
    status: TaskStatus;
}

// Text event - natural language explanations
export interface TextEvent {
    type: 'text';
    content: string;
}

// Plan event - new plan with tasks
export interface PlanEvent {
    type: 'plan';
    planId: string;
    agentName: string;
    title: string;
    tasks: PlanTask[];
}

// Plan status update - task status change
export interface PlanStatusEvent {
    type: 'plan_status';
    planId: string;
    taskId: string;
    status: TaskStatus;
    result?: string;
}

// Report event - markdown report
export interface ReportEvent {
    type: 'report';
    reportType: 'performance' | 'creative' | 'common';
    reportId: string;
    title: string;
    content: string;
    itemId?: string;      // For creative reports - which item this is for
    itemName?: string;    // For creative reports
    itemData?: {          // For creative reports - ad thumbnail and metrics
        thumbnail?: string;
        displayFormat?: 'image' | 'video';
        videoLength?: string;
        metrics: {
            roas?: number;
            spend?: number;
            ctr?: number;
            impressions?: number;
            cost_per_lead?: number;
        };
    };
}

// Focused items event - ad/creative cards
export interface FocusedItemsEvent {
    type: 'focused_items';
    items: FocusedItemCard[];
}

// Context update event - update session context
export interface ContextUpdateEvent {
    type: 'context_update';
    context: Partial<SessionContext>;
}

// Done event - streaming complete
export interface DoneEvent {
    type: 'done';
}

// Error event
export interface ErrorEvent {
    type: 'error';
    message: string;
}

// Union type of all SSE events
export type SSEEvent = 
    | TextEvent 
    | PlanEvent 
    | PlanStatusEvent 
    | ReportEvent 
    | FocusedItemsEvent 
    | ContextUpdateEvent 
    | DoneEvent
    | ErrorEvent;

/**
 * Focused Item Card - for display in chat
 */
export interface FocusedItemCard {
    id: string;
    name: string;
    thumbnail?: string;
    type: 'ad' | 'creative' | 'headline' | 'ad_copy';
    displayFormat?: 'image' | 'video';
    metrics: {
        roas?: number;
        spend?: number;
        ctr?: number;
        impressions?: number;
        cpc?: number;
    };
}

/**
 * Session Context - stored at session level for multi-turn conversations
 */
export interface SessionContext {
    // From Performance Analysis
    performanceReports: Array<{
        id: string;
        title: string;
        content: string;
        channelId: string;
        timestamp: number;
    }>;
    
    // Focused items (selected by AI or user)
    focusedItems: FocusedItemCard[];
    selectedItemIds: string[];  // For future manual selection
    
    // From Creative Insights - analysis is now stored as markdown in content
    creativeReports: Array<{
        id: string;
        itemId: string;
        itemName: string;
        content: string;  // Full markdown report
    }>;
    commonFindingsReport: string | null;
    
    // Agent execution history
    agentHistory: Array<{
        agent: string;
        objective: string;
        timestamp: number;
    }>;
}

/**
 * Stream Emitter function type for agents
 */
export type StreamEmitter = (event: SSEEvent) => void;

/**
 * Agent Interface - for extensibility
 */
export interface AgentParams {
    channelId?: string;
    objective: string;
    focusedItems?: FocusedItemCard[];
    context?: SessionContext;
}

export interface AgentResult {
    success: boolean;
    error?: string;
}

/**
 * Legacy types (kept for backwards compatibility)
 */
export interface Task {
    id: string;
    description: string;
    assignedTool: 'reasoning' | 'data-query';
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    result?: string;
}

export interface GlobalPlan {
    objective: string;
    tasks: Task[];
}

export interface GlobalContext {
    userInput: string;
    conversationHistory: { role: string, content: string }[];
    plan: GlobalPlan | null;
    currentStepIndex: number;
    globalOutput: string[];
    dataPool: any[];
}
