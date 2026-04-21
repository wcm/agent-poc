import { ChannelInfo, FocusedItemCard, TaskStatus, BrandInfo, ImageConcept, VideoConcept, FrontendIntegrationInfo, IntegrationInfo, IntegrationResultRecord } from './types';
import { resolveIntegrations } from './integrations';

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
 * Discovery ad data structure from the API
 */
export interface DiscoveryAd {
    id: string;
    brand_id: string;
    brand_name: string;
    brand_logo: string;
    headline: string;
    ad_copy: string;
    image_url: string;
    cta: string;
    display_format: 'image' | 'video';
    video_length?: string;
    platforms: string[];
    status: 'active' | 'inactive';
    start_date: string;
    end_date: string | null;
    is_bookmarked: boolean;
}

/**
 * Discovery query parameters
 */
export interface DiscoveryQueryParams {
    brand?: string;
    display_format?: 'video' | 'image';
    status?: 'active' | 'inactive';
    platform?: string;
    sort?: 'latest' | 'longest_running';
}

/**
 * Dataset stored in context from discoveryQuery tool
 */
export interface DiscoveryDataSet {
    id: string;
    queryDescription: string;
    queryParams: DiscoveryQueryParams;
    data: DiscoveryAd[];
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
 * Generation result from image-generation or video-script-generation
 */
export interface GenerationResult {
    id: string;
    itemId: string;
    itemName: string;
    type: 'image' | 'video';
    imageConcepts?: ImageConcept[];
    videoConcepts?: VideoConcept[];
    timestamp: number;
}

/**
 * Plan step structure
 */
export interface PlanStep {
    id: string;
    tool: 'dataQuery' | 'dataAnalysis' | 'focusItems' | 'creativeInsights' | 'consolidateFindings' | 'discoveryQuery' | 'generateAdVariations' | 'integrations';
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
    // Active channel (user-selected or default)
    channel: ChannelInfo;
    
    // User-selected followed brands (from context selector)
    followedBrands: BrandInfo[];

    // Connected and supported workspace integrations
    integrations: IntegrationInfo[];
    
    // User's original input
    userInput: string;
    
    // Data from dataQuery tool (can have multiple datasets)
    dataSets: DataSet[];
    
    // Data from discoveryQuery tool (competitor ads)
    discoveryDataSets: DiscoveryDataSet[];
    
    // Analysis reports from dataAnalysis
    analysisReports: AnalysisReport[];
    
    // Focus item sets (multiple per plan)
    focusItemSets: FocusItemSet[];
    
    // Creative insights reports
    creativeReports: CreativeReport[];
    
    // Consolidation reports
    consolidationReports: ConsolidationReport[];
    
    // Ad generation results (image concepts + video scripts)
    generationResults: GenerationResult[];

    // Results from mocked integration calls
    integrationResults: IntegrationResultRecord[];
    
    // Narrator messages for follow-up context
    narratorHistory: string[];
    
    // Conversation history for multi-turn
    conversationHistory: Array<{ role: string; content: string }>;
    
    // Current plan (if any)
    currentPlan: Plan | null;
}

/**
 * User-provided context from the frontend
 */
export interface UserContext {
    channel?: ChannelInfo;
    brands?: BrandInfo[];
    integrations?: FrontendIntegrationInfo[];
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * Create an empty GlobalContext with default values
 */
export function createEmptyContext(channel: ChannelInfo, userInput: string = '', userContext?: UserContext): GlobalContext {
    return {
        channel,
        followedBrands: userContext?.brands || [],
        integrations: resolveIntegrations(userContext?.integrations || []),
        userInput,
        dataSets: [],
        discoveryDataSets: [],
        analysisReports: [],
        focusItemSets: [],
        creativeReports: [],
        consolidationReports: [],
        generationResults: [],
        integrationResults: [],
        narratorHistory: [],
        conversationHistory: userContext?.conversationHistory || [],
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
 * Get the latest discovery dataset from context
 */
export function getLatestDiscoveryDataSet(context: GlobalContext): DiscoveryDataSet | null {
    if (context.discoveryDataSets.length === 0) return null;
    return context.discoveryDataSets[context.discoveryDataSets.length - 1];
}

/**
 * Get the latest data (either own ads or discovery ads) - returns the most recent one
 */
export type AnyDataSet = DataSet | DiscoveryDataSet;
export type AnyAdData = AdData | DiscoveryAd;

export function getLatestAnyDataSet(context: GlobalContext): { dataSet: AnyDataSet; type: 'own' | 'discovery' } | null {
    const latestOwn = context.dataSets.length > 0 ? context.dataSets[context.dataSets.length - 1] : null;
    const latestDiscovery = context.discoveryDataSets.length > 0 ? context.discoveryDataSets[context.discoveryDataSets.length - 1] : null;
    
    if (!latestOwn && !latestDiscovery) return null;
    if (!latestOwn) return { dataSet: latestDiscovery!, type: 'discovery' };
    if (!latestDiscovery) return { dataSet: latestOwn, type: 'own' };
    
    // Return whichever is more recent
    if (latestDiscovery.timestamp > latestOwn.timestamp) {
        return { dataSet: latestDiscovery, type: 'discovery' };
    }
    return { dataSet: latestOwn, type: 'own' };
}

/**
 * Check if data is a discovery ad (has brand_name but no metrics)
 */
export function isDiscoveryAd(item: any): item is DiscoveryAd {
    return 'brand_name' in item && !('metrics' in item);
}

/**
 * Get the latest focus item set from context
 */
export function getLatestFocusItemSet(context: GlobalContext): FocusItemSet | null {
    if (context.focusItemSets.length === 0) return null;
    return context.focusItemSets[context.focusItemSets.length - 1];
}

/**
 * Get creative reports for the latest focus item set
 */
export function getLatestCreativeReports(context: GlobalContext): CreativeReport[] {
    const focusSet = getLatestFocusItemSet(context);
    if (!focusSet) return [];
    return context.creativeReports.filter(r => r.focusSetId === focusSet.id);
}

/**
 * Generate a summary of the context for the planner/LLM
 */
export function getContextSummary(context: GlobalContext): string {
    const parts: string[] = [];
    
    // Active channel
    parts.push(`Channel: ${context.channel.name} (${context.channel.platform})`);
    parts.push(`Channel ID: ${context.channel.id}`);
    
    // User-selected brands
    if (context.followedBrands.length > 0) {
        parts.push(`\nSelected Brands to Monitor:`);
        context.followedBrands.forEach(brand => {
            parts.push(`  - ${brand.name}${brand.category ? ` (${brand.category})` : ''}`);
        });
    }

    if (context.integrations.length > 0) {
        const connected = context.integrations.filter((integration) => integration.status === 'connected');
        const available = context.integrations.filter((integration) => integration.status === 'available');
        const comingSoon = context.integrations.filter((integration) => integration.status === 'coming_soon');

        parts.push(`\nWorkspace Integrations:`);
        if (connected.length > 0) {
            parts.push(`  Connected:`);
            connected.forEach((integration) => {
                parts.push(`    - ${integration.name}: ${integration.capabilities.join(', ')}`);
            });
        } else {
            parts.push(`  Connected: none`);
        }

        if (available.length > 0) {
            parts.push(`  Available but not connected: ${available.map((integration) => integration.name).join(', ')}`);
        }

        if (comingSoon.length > 0) {
            parts.push(`  Coming soon: ${comingSoon.map((integration) => integration.name).join(', ')}`);
        }
    }
    
    if (context.dataSets.length > 0) {
        parts.push(`\nOwn Ad Data Sets: ${context.dataSets.length}`);
        context.dataSets.forEach((ds, i) => {
            parts.push(`  [${i + 1}] ${ds.queryDescription} (${ds.data.length} items)`);
        });
    }
    
    if (context.discoveryDataSets.length > 0) {
        parts.push(`\nDiscovery/Competitor Data Sets: ${context.discoveryDataSets.length}`);
        context.discoveryDataSets.forEach((ds, i) => {
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
    
    if (context.generationResults.length > 0) {
        parts.push(`\nAd Generation Results: ${context.generationResults.length}`);
        context.generationResults.forEach((gr, i) => {
            const count = gr.type === 'image' ? gr.imageConcepts?.length : gr.videoConcepts?.length;
            parts.push(`  [${i + 1}] ${gr.itemName} (${gr.type}, ${count} concepts)`);
        });
    }

    if (context.integrationResults.length > 0) {
        parts.push(`\nRecent Integration Results:`);
        context.integrationResults.slice(-3).forEach((result, i) => {
            parts.push(`  [${i + 1}] ${result.integrationName} (${result.mode})`);
        });
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
