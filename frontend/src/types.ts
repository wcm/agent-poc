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
