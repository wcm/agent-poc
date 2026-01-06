import React, { useState, useRef, useEffect, useCallback } from "react";
import Sidebar, { Channel } from "../Sidebar/Sidebar";
import ChatInterface from "../Chat/ChatInterface";
import { Message, Session, SessionContext, StreamedSection, PlanTask, SSEEvent, PlanEvent, PlanStatusEvent, Channel as ContextChannel, Brand } from "../../types";
import DiscoveryFeed from "../Discovery/DiscoveryFeed";
import FollowingBrands from "../Discovery/FollowingBrands";
import BrandDetails from "../Discovery/BrandDetails";
import AnalyticsDashboard from "../Analytics/AnalyticsDashboard";

// Default empty session context
const createEmptyContext = (): SessionContext => ({
	performanceReports: [],
	focusedItems: [],
	selectedItemIds: [],
	creativeReports: [],
	commonFindingsReport: null,
	agentHistory: [],
});

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

	// Streaming State
	const [streamingSections, setStreamingSections] = useState<StreamedSection[]>([]);
	const [planStates, setPlanStates] = useState<Map<string, PlanTask[]>>(new Map());

	// Refs for streaming accumulation
	const sectionsRef = useRef<StreamedSection[]>([]);
	const planStatesRef = useRef<Map<string, PlanTask[]>>(new Map());

	const baseUrl = window.location.hostname === "localhost" ? "http://localhost:3002" : "";

	// Initial Load - Clear History & Fetch Channels
	useEffect(() => {
		fetch(`${baseUrl}/api/clear`, { method: "POST" }).catch((err) => console.error("Failed to clear history:", err));

		fetch(`${baseUrl}/api/own-analytics`)
			.then((res) => res.json())
			.then((data) => {
				if (data.channels) {
					setChannels(data.channels);
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
		setBrandDetailId(null);
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
	// Session context is available for future use (e.g., manual item selection)
	// const currentContext = activeSession?.context || createEmptyContext();

	/**
	 * Handle incoming SSE events during streaming
	 */
	const handleSSEEvent = useCallback((event: SSEEvent, currentSessionId: string) => {
		switch (event.type) {
			case "text": {
				const section: StreamedSection = { type: "text", content: event.content };
				sectionsRef.current.push(section);
				setStreamingSections([...sectionsRef.current]);
				break;
			}

			case "plan": {
				const planEvent = event as PlanEvent;
				const section: StreamedSection = {
					type: "plan",
					planId: planEvent.planId,
					agentName: planEvent.agentName,
					title: planEvent.title,
					tasks: planEvent.tasks,
				};
				sectionsRef.current.push(section);

				// Store initial plan state
				planStatesRef.current.set(planEvent.planId, [...planEvent.tasks]);

				setStreamingSections([...sectionsRef.current]);
				setPlanStates(new Map(planStatesRef.current));
				break;
			}

			case "plan_status": {
				const statusEvent = event as PlanStatusEvent;
				const currentTasks = planStatesRef.current.get(statusEvent.planId);

				if (currentTasks) {
					const updatedTasks = currentTasks.map((task) => (task.id === statusEvent.taskId ? { ...task, status: statusEvent.status } : task));
					planStatesRef.current.set(statusEvent.planId, updatedTasks);

					// Also update the tasks in the section so they persist in the final message
					sectionsRef.current = sectionsRef.current.map((section) => {
						if (section.type === "plan" && section.planId === statusEvent.planId) {
							return { ...section, tasks: updatedTasks };
						}
						return section;
					});

					setPlanStates(new Map(planStatesRef.current));
					setStreamingSections([...sectionsRef.current]);
				}
				break;
			}

			case "report": {
				const section: StreamedSection = {
					type: "report",
					reportType: event.reportType,
					reportId: event.reportId,
					title: event.title,
					content: event.content,
					itemId: event.itemId,
					itemName: event.itemName,
					itemData: event.itemData,
				};
				sectionsRef.current.push(section);
				setStreamingSections([...sectionsRef.current]);
				break;
			}

			case "focused_items": {
				const section: StreamedSection = {
					type: "focused_items",
					items: event.items,
				};
				sectionsRef.current.push(section);
				setStreamingSections([...sectionsRef.current]);
				break;
			}

			case "context_update": {
				// Update session context
				setSessions((prev) =>
					prev.map((s) => {
						if (s.id === currentSessionId) {
							return {
								...s,
								context: { ...s.context, ...event.context },
							};
						}
						return s;
					})
				);
				break;
			}

			case "done": {
				// Finalize the message
				const finalSections = [...sectionsRef.current];
				const plainContent = finalSections
					.filter((s) => s.type === "text")
					.map((s) => (s.type === "text" ? s.content : ""))
					.join("\n\n");

				const assistantMessage: Message = {
					role: "assistant",
					content: plainContent || "Analysis complete.",
					sections: finalSections,
				};

				setSessions((prev) =>
					prev.map((s) => {
						if (s.id === currentSessionId) {
							return { ...s, messages: [...s.messages, assistantMessage] };
						}
						return s;
					})
				);

				// Clear streaming state
				setIsLoading(false);
				setStreamingSections([]);
				setPlanStates(new Map());
				sectionsRef.current = [];
				planStatesRef.current = new Map();
				break;
			}

			case "error": {
				const errorSection: StreamedSection = {
					type: "text",
					content: `⚠️ Error: ${event.message}`,
				};
				sectionsRef.current.push(errorSection);
				setStreamingSections([...sectionsRef.current]);
				break;
			}
		}
	}, []);

	const handleSendMessage = async (content: string, context?: { channel?: ContextChannel; brands: Brand[] }) => {
		// 1. Prepare User Message
		const userMessage: Message = { role: "user", content };

		// 2. Determine Session ID (Create if new)
		let currentSessionId = activeSessionId;
		let newSessions = [...sessions];

		if (!currentSessionId) {
			currentSessionId = Date.now().toString();
			const newSession: Session = {
				id: currentSessionId,
				title: content.length > 30 ? content.substring(0, 30) + "..." : content,
				messages: [userMessage],
				createdAt: Date.now(),
				context: createEmptyContext(),
			};
			newSessions.push(newSession);
			setSessions(newSessions);
			setActiveSessionId(currentSessionId);
		} else {
			setSessions((prev) =>
				prev.map((s) => {
					if (s.id === currentSessionId) {
						return { ...s, messages: [...s.messages, userMessage] };
					}
					return s;
				})
			);
		}

		// 3. Reset streaming state
		setIsLoading(true);
		setStreamingSections([]);
		setPlanStates(new Map());
		sectionsRef.current = [];
		planStatesRef.current = new Map();

		// 4. Start SSE streaming
		const channelParam = activeChannelId ? `&channelId=${encodeURIComponent(activeChannelId)}` : "";
		const sessionParam = `&sessionId=${encodeURIComponent(currentSessionId)}`;

		// Build context params
		let contextParam = "";
		if (context) {
			const contextData = {
				channel: context.channel,
				brands: context.brands,
			};
			contextParam = `&context=${encodeURIComponent(JSON.stringify(contextData))}`;
		}

		const apiUrl = `${baseUrl}/api/stream?message=${encodeURIComponent(content)}${channelParam}${sessionParam}${contextParam}`;

		const eventSource = new EventSource(apiUrl);
		const sessionId = currentSessionId; // Capture for closure

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data) as SSEEvent;
				handleSSEEvent(data, sessionId);

				// Close EventSource on done
				if (data.type === "done") {
					eventSource.close();
				}
			} catch (err) {
				console.error("Failed to parse SSE event:", err);
			}
		};

		eventSource.onerror = (err) => {
			console.error("EventSource failed:", err);
			eventSource.close();
			setIsLoading(false);
			setStreamingSections([]);
			setPlanStates(new Map());
			sectionsRef.current = [];
			planStatesRef.current = new Map();
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
					<ChatInterface messages={currentMessages} isLoading={isLoading} streamingSections={streamingSections} planStates={planStates} onSendMessage={handleSendMessage} />
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
