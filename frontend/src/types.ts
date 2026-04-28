/**
 * SSE Event Types - Received from server
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface PlanTask {
    id: string;
    description: string;
    tool: string;
    status: TaskStatus;
}

// Text event
export interface TextEvent {
    type: 'text';
    content: string;
}

// Plan event
export interface PlanEvent {
    type: 'plan';
    planId: string;
    agentName: string;
    title: string;
    tasks: PlanTask[];
}

// Plan status update
export interface PlanStatusEvent {
    type: 'plan_status';
    planId: string;
    taskId: string;
    status: TaskStatus;
    result?: string;
}

// Item data for creative reports
export interface ReportItemData {
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
}

// Report event
export interface ReportEvent {
    type: 'report';
    reportType: 'performance' | 'creative' | 'common';
    reportId: string;
    title: string;
    content: string;
    itemId?: string;
    itemName?: string;
    itemData?: ReportItemData;
}

export type IntegrationResultStatus = 'connected' | 'available' | 'coming_soon' | 'unknown';

export interface IntegrationResultEvent {
    type: 'integration_result';
    resultId: string;
    integrationId: string;
    integrationName: string;
    title: string;
    status: IntegrationResultStatus;
    mode: 'data' | 'instruction';
    content: string;
}

// Focused items event
export interface FocusedItemsEvent {
    type: 'focused_items';
    items: FocusedItemCard[];
}

// Context update event
export interface ContextUpdateEvent {
    type: 'context_update';
    context: Partial<SessionContext>;
}

// Done event
export interface DoneEvent {
    type: 'done';
}

// Error event
export interface ErrorEvent {
    type: 'error';
    message: string;
}

/**
 * Ad concept shared fields
 */
export interface AdConceptBase {
    concept_name: string;
    concept_description: string;
    concept_summary: string;
    concept_detail: string;
    personas: string[];
    creative_tags: {
        ad_angles: string[];
        emotion: string[];
        themes: string[];
    };
}

export type ImageConceptStatus = 'pending' | 'generating' | 'done' | 'failed';

export interface ImageConcept extends AdConceptBase {
    imageDataUrl: string;
    status: ImageConceptStatus;
}

export interface VideoConcept extends AdConceptBase {
    script: string;
}

// Image concepts event
export interface ImageConceptsEvent {
    type: 'image_concepts';
    itemId: string;
    itemName: string;
    concepts: ImageConcept[];
}

// Image concept update event - progressive update for a single concept
export interface ImageConceptUpdateEvent {
    type: 'image_concept_update';
    itemId: string;
    conceptIndex: number;
    imageDataUrl: string;
    status: 'done' | 'failed';
}

// Video concepts event
export interface VideoConceptsEvent {
    type: 'video_concepts';
    itemId: string;
    itemName: string;
    concepts: VideoConcept[];
}

// Union type of all SSE events
export type SSEEvent = 
    | TextEvent 
    | PlanEvent 
    | PlanStatusEvent 
    | ReportEvent 
    | IntegrationResultEvent
    | FocusedItemsEvent 
    | ContextUpdateEvent 
    | DoneEvent
    | ErrorEvent
    | ImageConceptsEvent
    | ImageConceptUpdateEvent
    | VideoConceptsEvent;

/**
 * Focused Item Card
 */
export interface FocusedItemCard {
    id: string;
    name: string;
    thumbnail?: string;
    type?: 'ad' | 'creative' | 'headline' | 'ad_copy';
    displayFormat?: 'image' | 'video';
    videoLength?: string;
    metrics: { 
        roas?: number; 
        spend?: number; 
        ctr?: number; 
        impressions?: number;
        cpc?: number;
        cost_per_lead?: number;
    };
}

/**
 * Session Context - persisted at session level
 */
export interface SessionContext {
    performanceReports: Array<{
        id: string;
        title: string;
        content: string;
        integrationId: string;
        timestamp: number;
    }>;
    focusedItems: FocusedItemCard[];
    selectedItemIds: string[];
    creativeReports: Array<{
        id: string;
        itemId: string;
        itemName: string;
        content: string;
    }>;
    commonFindingsReport: string | null;
    agentHistory: Array<{
        agent: string;
        objective: string;
    timestamp: number;
    }>;
}

/**
 * Streamed Section - represents a single UI element from streaming
 */
export type StreamedSection = 
    | { type: 'text'; content: string }
    | { type: 'plan'; planId: string; agentName: string; title: string; tasks: PlanTask[] }
    | { type: 'report'; reportType: 'performance' | 'creative' | 'common'; reportId: string; title: string; content: string; itemId?: string; itemName?: string; itemData?: ReportItemData }
    | { type: 'integration_result'; resultId: string; integrationId: string; integrationName: string; title: string; status: IntegrationResultStatus; mode: 'data' | 'instruction'; content: string }
    | { type: 'focused_items'; items: FocusedItemCard[] }
    | { type: 'image_concepts'; itemId: string; itemName: string; concepts: ImageConcept[] }
    | { type: 'video_concepts'; itemId: string; itemName: string; concepts: VideoConcept[] };

/**
 * Message with streaming sections
 */
export interface Message {
    role: "user" | "assistant";
    content: string;
    sections?: StreamedSection[];
}

export type SessionStatus = "idle" | "running" | "completed" | "failed";

/**
 * Session with context
 */
export interface Session {
    id: string;
    title: string;
    messages: Message[];
    createdAt: number;
    lastActivityAt: number;
    context: SessionContext;
    status: SessionStatus;
    isRead: boolean;
    completedAt: number | null;
    streamingSections: StreamedSection[];
    planTaskStates: Record<string, PlanTask[]>;
}

/**
 * Legacy types for backwards compatibility
 */
export interface StepUpdate {
    tool: string;
    title: string;
    content: string;
    timestamp?: number;
    dataPool?: any[];
}

export interface AgentOutputSection {
    type: 'thinking' | 'text' | 'document' | 'focused_items' | 'creative_report';
    agent?: string;
    title?: string;
    content?: string;
    preview?: string;
    items?: FocusedItemCard[];
    steps?: StepUpdate[];
}

/**
 * Integration type for connected integrations
 */
export interface Integration {
    id: string;
    name: string;
    platform: string;
    account_id: string;
    is_connected: boolean;
}

export type AnalyticsDashboardView = "top_spend" | "top_videos" | "top_images";

export type RayaView = "tasks" | "brandContext" | "integrations" | "automations";

/**
 * Brand and Ad types
 */
export interface Brand {
    id: string;
    name: string;
    logo: string;
    description: string;
    category: string;
    website: string;
    is_followed: boolean;
}

export interface Ad {
    id: string;
    brand_id?: string;
    brand_name: string;
    brand_logo: string;
    image_url: string;
    headline: string;
    ad_copy: string;
    cta: string;
    engagement_score?: number;
    platforms: string[];
    status: 'active' | 'inactive';
    start_date: string;
    end_date: string | null;
    display_format: 'image' | 'video';
    video_length?: string;
    is_bookmarked?: boolean;
}
