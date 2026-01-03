export interface StepUpdate {
    agent: string;
    title: string;
    content: string;
    timestamp: number;
    dataPool?: any[];
}

export interface Message {
    role: "user" | "assistant";
    content: string;
    steps?: StepUpdate[];
    dataPool?: any[];
}

export interface Session {
    id: string;
    title: string;
    messages: Message[];
    createdAt: number;
}

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
