import React, { useState, useRef, useEffect } from "react";
import Sidebar, { Channel } from "../Sidebar/Sidebar";
import ChatInterface from "../Chat/ChatInterface";
import { Message, Session, StepUpdate } from "../../types";
import DiscoveryFeed from "../Discovery/DiscoveryFeed";
import FollowingBrands from "../Discovery/FollowingBrands";
import BrandDetails from "../Discovery/BrandDetails";
import AnalyticsDashboard from "../Analytics/AnalyticsDashboard";

const MainLayout: React.FC = () => {
	// Layout State
	const [activeTab, setActiveTab] = useState("atria");
	const [activeBrand, setActiveBrand] = useState("Nike");
	const [isCollapsed, setIsCollapsed] = useState(false);

	// Inspirations State
	const [activeInspirationTab, setActiveInspirationTab] = useState("discovery");
	const [brandDetailId, setBrandDetailId] = useState<string | null>(null);

	// Analytics State
	const [channels, setChannels] = useState<Channel[]>([]);
	const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

	// Session State
	const [sessions, setSessions] = useState<Session[]>([]);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

	// Chat State (Active Session)
	const [isLoading, setIsLoading] = useState(false);
	const [currentProcessSteps, setCurrentProcessSteps] = useState<StepUpdate[]>([]);

	// Refs for streaming
	const stepsRef = useRef<StepUpdate[]>([]);
	const dataPoolRef = useRef<any[]>([]);

	const baseUrl = window.location.hostname === "localhost" ? "http://localhost:3001" : "";

	// Initial Load - Clear History & Fetch Channels
	useEffect(() => {
		fetch(`${baseUrl}/api/clear`, { method: "POST" }).catch((err) => console.error("Failed to clear history:", err));

		// Fetch channels for analytics
		fetch(`${baseUrl}/api/own-analytics`)
			.then((res) => res.json())
			.then((data) => {
				if (data.channels) {
					setChannels(data.channels);
					// Set first connected channel as default
					const firstConnected = data.channels.find((c: Channel) => c.is_connected);
					if (firstConnected) {
						setActiveChannelId(firstConnected.id);
					}
				}
			})
			.catch((err) => console.error("Failed to fetch channels:", err));
	}, [baseUrl]);

	const handleNewSession = () => {
		setActiveSessionId(null);
	};

	const handleSessionSelect = (id: string) => {
		setActiveSessionId(id);
	};

	const handleInspirationTabChange = (tab: string) => {
		setActiveInspirationTab(tab);
		setBrandDetailId(null); // Clear detail view when switching tabs
	};

	const handleNavigateToBrand = (brandId: string) => {
		setBrandDetailId(brandId);
	};

	const fetchChannels = async () => {
		try {
			const res = await fetch(`${baseUrl}/api/own-analytics`);
			const data = await res.json();
			if (data.channels) {
				setChannels(data.channels);
			}
		} catch (err) {
			console.error("Failed to fetch channels:", err);
		}
	};

	const handleChannelConnect = async (channelId: string) => {
		const res = await fetch(`${baseUrl}/api/channels/${channelId}/connect`, { method: "POST" });
		if (!res.ok) {
			throw new Error("Failed to connect channel");
		}
	};

	const activeSession = sessions.find((s) => s.id === activeSessionId);
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
				title: content.length > 30 ? content.substring(0, 30) + "..." : content, // Title is first prompt
				messages: [userMessage],
				createdAt: Date.now(),
			};
			newSessions.push(newSession);
			setSessions(newSessions);
			setActiveSessionId(currentSessionId);
		} else {
			// Add to existing session
			setSessions((prev) =>
				prev.map((s) => {
					if (s.id === currentSessionId) {
						return { ...s, messages: [...s.messages, userMessage] };
					}
					return s;
				})
			);
		}

		setIsLoading(true);
		setCurrentProcessSteps([]);
		stepsRef.current = [];
		dataPoolRef.current = [];

		// 3. Start Streaming
		const apiUrl = window.location.hostname === "localhost" ? `http://localhost:3001/api/stream?message=${encodeURIComponent(content)}` : `/api/stream?message=${encodeURIComponent(content)}`;

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
				setSessions((prev) =>
					prev.map((s) => {
						if (s.id === currentSessionId) {
							return { ...s, messages: [...s.messages, assistantMessage] };
						}
						return s;
					})
				);

				setIsLoading(false);
				setCurrentProcessSteps([]);
				stepsRef.current = [];
				dataPoolRef.current = [];
				eventSource.close();
			} else if (data.type === "error") {
				const errorMessage: Message = { role: "assistant", content: `Error: ${data.error}` };
				setSessions((prev) =>
					prev.map((s) => {
						if (s.id === currentSessionId) {
							return { ...s, messages: [...s.messages, errorMessage] };
						}
						return s;
					})
				);
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
				onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
				activeInspirationTab={activeInspirationTab}
				onInspirationTabChange={handleInspirationTabChange}
				channels={channels}
				activeChannelId={activeChannelId || undefined}
				onChannelSelect={setActiveChannelId}
				onChannelConnect={handleChannelConnect}
				onRefreshChannels={fetchChannels}
			/>
			<div className="main-content">
				{activeTab === "atria" ? (
					<ChatInterface messages={currentMessages} isLoading={isLoading} currentProcessSteps={currentProcessSteps} onSendMessage={handleSendMessage} />
				) : activeTab === "inspirations" ? (
					brandDetailId ? (
						<BrandDetails brandId={brandDetailId} onBack={() => setBrandDetailId(null)} />
					) : (
						<>
							{activeInspirationTab === "discovery" && <DiscoveryFeed onNavigateToBrand={handleNavigateToBrand} />}
							{activeInspirationTab === "following_brands" && <FollowingBrands onViewDetails={handleNavigateToBrand} />}
							{activeInspirationTab === "saved_ads" && <DiscoveryFeed savedOnly={true} onNavigateToBrand={handleNavigateToBrand} />}
						</>
					)
				) : activeTab === "analytics" ? (
					<AnalyticsDashboard channelId={activeChannelId || undefined} />
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
