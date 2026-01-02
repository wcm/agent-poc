import React, { useState, useRef, useEffect } from "react";
import Sidebar from '../Sidebar/Sidebar';
import ChatInterface from '../Chat/ChatInterface';
import { Message, Session, StepUpdate } from '../../types';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import DiscoveryFeed from '../Discovery/DiscoveryFeed';

const MainLayout: React.FC = () => {
    // Layout State
    const [activeTab, setActiveTab] = useState('atria');
    const [activeBrand, setActiveBrand] = useState('Starbucks');
    const [isCollapsed, setIsCollapsed] = useState(false);
    
    // Inspirations State
    const [activeInspirationTab, setActiveInspirationTab] = useState('discovery');

    // Session State
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    // Chat State (Active Session)
    const [isLoading, setIsLoading] = useState(false);
    const [currentProcessSteps, setCurrentProcessSteps] = useState<StepUpdate[]>([]);
    
    // Refs for streaming
    const stepsRef = useRef<StepUpdate[]>([]);
    const dataPoolRef = useRef<any[]>([]);

    // Initial Load - Clear History
    useEffect(() => {
        const apiUrl = window.location.hostname === "localhost" 
            ? "http://localhost:3001/api/clear" 
            : "/api/clear";
            
        fetch(apiUrl, { method: "POST" })
            .catch(err => console.error("Failed to clear history:", err));
    }, []);

    const handleNewSession = () => {
        setActiveSessionId(null);
    };

    const handleSessionSelect = (id: string) => {
        setActiveSessionId(id);
    };

    const activeSession = sessions.find(s => s.id === activeSessionId);
    const currentMessages = activeSession ? activeSession.messages : [];

    const handleSendMessage = async (content: string) => {
        // 1. Prepare User Message
        const userMessage: Message = { role: "user", content };
        
        // 2. Determine Session ID (Create if new)
        let currentSessionId = activeSessionId;
        let newSessions = [...sessions];
        
        if (!currentSessionId) {
            currentSessionId = Date.now().toString(); // Simple ID generation
            const newSession: Session = {
                id: currentSessionId,
                title: content.length > 30 ? content.substring(0, 30) + '...' : content, // Title is first prompt
                messages: [userMessage],
                createdAt: Date.now()
            };
            newSessions.push(newSession);
            setSessions(newSessions);
            setActiveSessionId(currentSessionId);
        } else {
            // Add to existing session
            setSessions(prev => prev.map(s => {
                if (s.id === currentSessionId) {
                    return { ...s, messages: [...s.messages, userMessage] };
                }
                return s;
            }));
        }

        setIsLoading(true);
        setCurrentProcessSteps([]);
        stepsRef.current = [];
        dataPoolRef.current = [];

        // 3. Start Streaming
        const apiUrl = window.location.hostname === "localhost" 
            ? `http://localhost:3001/api/stream?message=${encodeURIComponent(content)}`
            : `/api/stream?message=${encodeURIComponent(content)}`;
            
        const eventSource = new EventSource(apiUrl);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "progress") {
                const newStep = { ...data.data, timestamp: Date.now() };

                setCurrentProcessSteps((prev) => [...prev, newStep]);
                stepsRef.current.push(newStep);
                
                if (newStep.dataPool && Array.isArray(newStep.dataPool)) {
                    dataPoolRef.current.push(...newStep.dataPool);
                }
            } else if (data.type === "final") {
                const assistantMessage: Message = {
                    role: "assistant",
                    content: data.response,
                    steps: [...stepsRef.current],
                    dataPool: [...dataPoolRef.current],
                };
                
                // Add Assistant Message to Session
                setSessions(prev => prev.map(s => {
                    if (s.id === currentSessionId) {
                        return { ...s, messages: [...s.messages, assistantMessage] };
                    }
                    return s;
                }));

                setIsLoading(false);
                setCurrentProcessSteps([]);
                stepsRef.current = [];
                dataPoolRef.current = [];
                eventSource.close();
            } else if (data.type === "error") {
                const errorMessage: Message = { role: "assistant", content: `Error: ${data.error}` };
                 setSessions(prev => prev.map(s => {
                    if (s.id === currentSessionId) {
                        return { ...s, messages: [...s.messages, errorMessage] };
                    }
                    return s;
                }));
                setIsLoading(false);
                setCurrentProcessSteps([]);
                stepsRef.current = [];
                eventSource.close();
            }
        };

        eventSource.onerror = (err) => {
            console.error("EventSource failed:", err);
            eventSource.close();
            setIsLoading(false);
        };
    };

    return (
        <div className="main-layout">
            <Sidebar 
                activeTab={activeTab} 
                onTabChange={setActiveTab}
                activeBrand={activeBrand}
                onBrandChange={setActiveBrand}
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSessionSelect={handleSessionSelect}
                onNewSession={handleNewSession}
                isCollapsed={isCollapsed}
                activeInspirationTab={activeInspirationTab}
                onInspirationTabChange={setActiveInspirationTab}
            />
            <div className="main-content">
                <button 
                    className="sidebar-toggle-btn"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
                </button>

                {activeTab === 'atria' ? (
                     <ChatInterface 
                        messages={currentMessages}
                        isLoading={isLoading}
                        currentProcessSteps={currentProcessSteps}
                        onSendMessage={handleSendMessage}
                     />
                ) : activeTab === 'inspirations' ? (
                    activeInspirationTab === 'discovery' ? (
                        <DiscoveryFeed />
                    ) : (
                        <div className="placeholder-content">
                            <h1>Inspirations: {activeInspirationTab.replace('_', ' ').charAt(0).toUpperCase() + activeInspirationTab.replace('_', ' ').slice(1)}</h1>
                            <p>This module is under construction.</p>
                        </div>
                    )
                ) : (
                    <div className="placeholder-content">
                        <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
                        <p>This module is coming soon.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MainLayout;
