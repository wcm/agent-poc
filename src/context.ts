import { ChannelInfo, FocusedItemCard, TaskStatus } from './types';

/**
 * Query parameters for data fetching
 */
export interface QueryParams {
    channel?: string;
    groupBy?: 'ad_name' | 'creative_name' | 'headline' | 'ad_copy';
    filters?: {
        display_format?: 'video' | 'image';
        status?: 'active' | 'inactive';
        start_date_from?: string;
        start_date_to?: string;
    };
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

/**
 * Ad data structure from the API
 */
export interface AdData {
    id: string;
    ad_name?: string;
    creative_name?: string;
    headline?: string;
    ad_copy?: string;
    group_value?: string;
    image_url?: string;
    display_format?: 'image' | 'video';
    video_length?: string;
    status?: string;
    channel_id?: string;
    metrics: {
        spend: number;
        roas: number;
        ctr: number;
        cpc: number;
        cpa: number;
        aov: number;
        impressions: number;
        clicks: number;
        purchase_value: number;
        cost_per_lead: number;
        click_to_atc: number;
        atc_to_purchase: number;
    };
    ad_count?: number;
}

/**
 * Dataset stored in context from dataQuery tool
 */
export interface DataSet {
    id: string;
    queryDescription: string;
    queryParams: QueryParams;
    data: AdData[];
    timestamp: number;
}

/**
 * Analysis report from dataAnalysis tool
 */
export interface AnalysisReport {
    id: string;
    dataSetId: string;
    content: string;  // markdown
    timestamp: number;
}

/**
 * Focus item set from focusItems tool
 */
export interface FocusItemSet {
    id: string;
    summary: string;
    items: FocusedItemCard[];
    dataSetId: string;
    timestamp: number;
}

/**
 * Creative report from creativeInsights tool
 */
export interface CreativeReport {
    id: string;
    focusSetId: string;
    itemId: string;
    itemName: string;
    content: string;  // markdown with extraction + analysis
    timestamp: number;
}

/**
 * Consolidation report from consolidateFindings tool
 */
export interface ConsolidationReport {
    id: string;
    content: string;
    timestamp: number;
}

/**
 * Plan step structure
 */
export interface PlanStep {
    id: string;
    tool: 'dataQuery' | 'dataAnalysis' | 'focusItems' | 'creativeInsights' | 'consolidateFindings';
    description: string;
    status: TaskStatus;
}

/**
 * Execution plan from planner
 */
export interface Plan {
    id: string;
    objective: string;
    steps: PlanStep[];
    createdAt: number;
}

/**
 * Global Context - the single source of truth for the agent
 */
export interface GlobalContext {
    // Channel data (initialized on start)
    channel: ChannelInfo;
    
    // User's original input
    userInput: string;
    
    // Data from dataQuery tool (can have multiple datasets)
    dataSets: DataSet[];
    
    // Analysis reports from dataAnalysis
    analysisReports: AnalysisReport[];
    
    // Focus item sets (multiple per plan)
    focusItemSets: FocusItemSet[];
    
    // Creative insights reports
    creativeReports: CreativeReport[];
    
    // Consolidation reports
    consolidationReports: ConsolidationReport[];
    
    // Narrator messages for follow-up context
    narratorHistory: string[];
    
    // Conversation history for multi-turn
    conversationHistory: Array<{ role: string; content: string }>;
    
    // Current plan (if any)
    currentPlan: Plan | null;
}

/**
 * Create an empty GlobalContext with default values
 */
export function createEmptyContext(channel: ChannelInfo, userInput: string = ''): GlobalContext {
    return {
        channel,
        userInput,
        dataSets: [],
        analysisReports: [],
        focusItemSets: [],
        creativeReports: [],
        consolidationReports: [],
        narratorHistory: [],
        conversationHistory: [],
        currentPlan: null
    };
}

/**
 * Get the latest dataset from context
 */
export function getLatestDataSet(context: GlobalContext): DataSet | null {
    if (context.dataSets.length === 0) return null;
    return context.dataSets[context.dataSets.length - 1];
}

/**
 * Get the latest focus item set from context
 */
export function getLatestFocusItemSet(context: GlobalContext): FocusItemSet | null {
    if (context.focusItemSets.length === 0) return null;
    return context.focusItemSets[context.focusItemSets.length - 1];
}

/**
 * Generate a summary of the context for the planner/LLM
 */
export function getContextSummary(context: GlobalContext): string {
    const parts: string[] = [];
    
    parts.push(`Channel: ${context.channel.name} (${context.channel.platform})`);
    parts.push(`Channel ID: ${context.channel.id}`);
    
    if (context.dataSets.length > 0) {
        parts.push(`\nData Sets: ${context.dataSets.length}`);
        context.dataSets.forEach((ds, i) => {
            parts.push(`  [${i + 1}] ${ds.queryDescription} (${ds.data.length} items)`);
        });
    }
    
    if (context.focusItemSets.length > 0) {
        parts.push(`\nFocus Item Sets: ${context.focusItemSets.length}`);
        context.focusItemSets.forEach((fs, i) => {
            parts.push(`  [${i + 1}] ${fs.summary} (${fs.items.length} items)`);
        });
    }
    
    if (context.analysisReports.length > 0) {
        parts.push(`\nAnalysis Reports: ${context.analysisReports.length}`);
    }
    
    if (context.creativeReports.length > 0) {
        parts.push(`\nCreative Reports: ${context.creativeReports.length}`);
    }
    
    if (context.consolidationReports.length > 0) {
        parts.push(`\nConsolidation Reports: ${context.consolidationReports.length}`);
    }
    
    if (context.conversationHistory.length > 0) {
        parts.push(`\nRecent Conversation:`);
        const recent = context.conversationHistory.slice(-4);
        recent.forEach(msg => {
            const preview = msg.content.length > 100 ? msg.content.slice(0, 100) + '...' : msg.content;
            parts.push(`  ${msg.role.toUpperCase()}: ${preview}`);
        });
    }
    
    return parts.join('\n');
}

/**
 * Add a message to conversation history
 */
export function addToHistory(context: GlobalContext, role: 'user' | 'assistant', content: string): void {
    context.conversationHistory.push({ role, content });
}

/**
 * Generate unique ID for various entities
 */
export function generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

