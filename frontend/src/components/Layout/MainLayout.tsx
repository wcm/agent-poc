import React, { useState, useRef, useEffect, useCallback } from "react";
import Sidebar from "../Sidebar/Sidebar";
import ChatInterface from "../Chat/ChatInterface";
import { AnalyticsDashboardView, Message, Session, SessionContext, StreamedSection, PlanTask, SSEEvent, PlanEvent, PlanStatusEvent, Channel as ContextChannel, Brand } from "../../types";
import DiscoveryFeed from "../Discovery/DiscoveryFeed";
import FollowingBrands from "../Discovery/FollowingBrands";
import BrandDetails from "../Discovery/BrandDetails";
import AnalyticsDashboard from "../Analytics/AnalyticsDashboard";
import IntegrationsPage from "../Integrations/IntegrationsPage";
import AutomationsPage from "../Automations/AutomationsPage";
import { AutomationDefinition, AUTOMATION_STATE_STORAGE_KEY, getInitialAutomations, mergePersistedAutomations } from "../../automations/catalog";
import {
	getConnectedIntegrations,
	getInitialIntegrationConnectionState,
	INTEGRATION_STATE_STORAGE_KEY,
	IntegrationConnectionState,
} from "../../integrations/catalog";

type SeedConversationEntry = Pick<Message, "role" | "content">;

interface SendMessageOptions {
	forceNewSession?: boolean;
	seedMessages?: Message[];
	seedConversationHistory?: SeedConversationEntry[];
}

const MAX_SEEDED_HISTORY_MESSAGES = 2;

const buildSeedConversationHistory = (messages: Message[]): SeedConversationEntry[] =>
	messages
		.slice(-MAX_SEEDED_HISTORY_MESSAGES)
		.map((message) => ({
			role: message.role,
			content: message.content.trim(),
		}))
		.filter((message) => message.content.length > 0);

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
	const [activeRayaView, setActiveRayaView] = useState<"tasks" | "integrations" | "automations">("tasks");
	const [activeAutomationId, setActiveAutomationId] = useState<string | null>(null);
	const [activeAutomationMode, setActiveAutomationMode] = useState<"overview" | "details" | "run">("overview");
	const [activeAutomationRunId, setActiveAutomationRunId] = useState<string | null>(null);
	const [activeAutomationComposerPrefill, setActiveAutomationComposerPrefill] = useState<string | null>(null);
	const [activeBrand, setActiveBrand] = useState("Nike");
	const [isCollapsed, setIsCollapsed] = useState(false);

	// Inspirations State
	const [activeInspirationTab, setActiveInspirationTab] = useState("discovery");
	const [brandDetailId, setBrandDetailId] = useState<string | null>(null);

	// Analytics State
	const [channels, setChannels] = useState<ContextChannel[]>([]);
	const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
	const [activeAnalyticsView, setActiveAnalyticsView] = useState<AnalyticsDashboardView>("top_spend");
	const [integrationConnectionState, setIntegrationConnectionState] = useState<IntegrationConnectionState>(() => {
		const defaultState = getInitialIntegrationConnectionState();
		if (typeof window === "undefined") {
			return defaultState;
		}

		try {
			const stored = window.localStorage.getItem(INTEGRATION_STATE_STORAGE_KEY);
			if (!stored) {
				return defaultState;
			}

			const parsed = JSON.parse(stored) as IntegrationConnectionState;
			return { ...defaultState, ...parsed };
		} catch (error) {
			console.error("Failed to restore integration connection state:", error);
			return defaultState;
		}
	});
	const [automations, setAutomations] = useState<AutomationDefinition[]>(() => {
		const defaultAutomations = getInitialAutomations();
		if (typeof window === "undefined") {
			return defaultAutomations;
		}

		try {
			const stored = window.localStorage.getItem(AUTOMATION_STATE_STORAGE_KEY);
			if (!stored) {
				return defaultAutomations;
			}

			return mergePersistedAutomations(JSON.parse(stored) as AutomationDefinition[]);
		} catch (error) {
			console.error("Failed to restore automation state:", error);
			return defaultAutomations;
		}
	});

	// Session State
	const [sessions, setSessions] = useState<Session[]>([]);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

	const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());
	const activeSessionIdRef = useRef<string | null>(null);
	const activeTabRef = useRef(activeTab);

	const baseUrl = window.location.hostname === "localhost" ? "http://localhost:3002" : "";

	useEffect(() => {
		activeSessionIdRef.current = activeSessionId;
	}, [activeSessionId]);

	useEffect(() => {
		activeTabRef.current = activeTab;
	}, [activeTab]);

	useEffect(() => {
		try {
			window.localStorage.setItem(INTEGRATION_STATE_STORAGE_KEY, JSON.stringify(integrationConnectionState));
		} catch (error) {
			console.error("Failed to persist integration connection state:", error);
		}
	}, [integrationConnectionState]);

	useEffect(() => {
		try {
			window.localStorage.setItem(AUTOMATION_STATE_STORAGE_KEY, JSON.stringify(automations));
		} catch (error) {
			console.error("Failed to persist automation state:", error);
		}
	}, [automations]);

	useEffect(() => {
		setAutomations((previous) => {
			const merged = mergePersistedAutomations(previous);
			return JSON.stringify(previous) === JSON.stringify(merged) ? previous : merged;
		});
	}, []);

	useEffect(() => {
		if (activeAutomationId && !automations.some((automation) => automation.id === activeAutomationId)) {
			setActiveAutomationId(null);
			setActiveAutomationMode("overview");
		}
	}, [activeAutomationId, automations]);

	const updateSession = useCallback((sessionId: string, updater: (session: Session) => Session) => {
		setSessions((prev) => prev.map((session) => (session.id === sessionId ? updater(session) : session)));
	}, []);

	const isSessionVisible = useCallback((sessionId: string) => {
		return activeTabRef.current === "atria" && activeSessionIdRef.current === sessionId;
	}, []);

	const markSessionRead = useCallback(
		(sessionId: string | null) => {
			if (!sessionId) return;
			updateSession(sessionId, (session) => (session.isRead ? session : { ...session, isRead: true }));
		},
		[updateSession]
	);

	const closeSessionStream = useCallback((sessionId: string) => {
		const eventSource = eventSourcesRef.current.get(sessionId);
		if (eventSource) {
			eventSource.close();
			eventSourcesRef.current.delete(sessionId);
		}
	}, []);

	useEffect(() => {
		const activeStreams = eventSourcesRef.current;
		return () => {
			activeStreams.forEach((eventSource) => eventSource.close());
			activeStreams.clear();
		};
	}, []);

	// Initial Load - Clear History & Fetch Channels
	useEffect(() => {
		fetch(`${baseUrl}/api/clear`, { method: "POST" }).catch((err) => console.error("Failed to clear history:", err));

		fetch(`${baseUrl}/api/own-analytics`)
			.then((res) => res.json())
			.then((data) => {
				if (data.channels) {
					setChannels(data.channels);
					const firstConnected = data.channels.find((c: ContextChannel) => c.is_connected);
					if (firstConnected) {
						setActiveChannelId(firstConnected.id);
					}
				}
			})
			.catch((err) => console.error("Failed to fetch channels:", err));
	}, [baseUrl]);

	useEffect(() => {
		if (activeTab === "atria" && activeSessionId) {
			markSessionRead(activeSessionId);
		}
	}, [activeTab, activeSessionId, markSessionRead]);

	const handleNewSession = () => {
		setActiveRayaView("tasks");
		setActiveAutomationId(null);
		setActiveAutomationMode("overview");
		setActiveAutomationRunId(null);
		setActiveAutomationComposerPrefill(null);
		activeSessionIdRef.current = null;
		setActiveSessionId(null);
	};

	const handleSessionSelect = (id: string) => {
		setActiveRayaView("tasks");
		setActiveAutomationId(null);
		setActiveAutomationMode("overview");
		setActiveAutomationRunId(null);
		setActiveAutomationComposerPrefill(null);
		activeSessionIdRef.current = id;
		setActiveSessionId(id);
		if (activeTab === "atria") {
			markSessionRead(id);
		}
	};

	const handleAutomationSelect = useCallback((automationId: string | null) => {
		setActiveAutomationId(automationId);
		setActiveAutomationRunId(null);
		setActiveAutomationComposerPrefill(null);
	}, []);

	const handleAutomationModeChange = useCallback((mode: "overview" | "details" | "run") => {
		setActiveAutomationMode(mode);
		if (mode !== "run") {
			setActiveAutomationRunId(null);
			setActiveAutomationComposerPrefill(null);
		}
	}, []);

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
				const connectedChannels = data.channels.filter((channel: ContextChannel) => channel.is_connected);
				if (!activeChannelId && connectedChannels.length > 0) {
					setActiveChannelId(connectedChannels[0].id);
				}
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

	const handleIntegrationConnect = useCallback((integrationId: string) => {
		setIntegrationConnectionState((prev) => ({
			...prev,
			[integrationId]: true,
		}));
	}, []);

	const handleIntegrationDisconnect = useCallback((integrationId: string) => {
		setIntegrationConnectionState((prev) => ({
			...prev,
			[integrationId]: false,
		}));
	}, []);

	const handleSaveAutomation = useCallback((automation: AutomationDefinition) => {
		setAutomations((prev) => prev.map((item) => (item.id === automation.id ? automation : item)));
	}, []);

	const handleSSEEvent = useCallback(
		(event: SSEEvent, currentSessionId: string) => {
			const visible = isSessionVisible(currentSessionId);
			const eventTimestamp = Date.now();

			switch (event.type) {
				case "text": {
					const section: StreamedSection = { type: "text", content: event.content };
					updateSession(currentSessionId, (session) => ({
						...session,
						lastActivityAt: eventTimestamp,
						streamingSections: [...session.streamingSections, section],
						isRead: visible ? true : session.isRead,
					}));
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

					updateSession(currentSessionId, (session) => ({
						...session,
						lastActivityAt: eventTimestamp,
						streamingSections: [...session.streamingSections, section],
						planTaskStates: {
							...session.planTaskStates,
							[planEvent.planId]: [...planEvent.tasks],
						},
						isRead: visible ? true : session.isRead,
					}));
					break;
				}

				case "plan_status": {
					const statusEvent = event as PlanStatusEvent;
					updateSession(currentSessionId, (session) => {
						const currentTasks = session.planTaskStates[statusEvent.planId];
						if (!currentTasks) {
							return session;
						}

						const updatedTasks = currentTasks.map((task) => (task.id === statusEvent.taskId ? { ...task, status: statusEvent.status } : task));

						return {
							...session,
							lastActivityAt: eventTimestamp,
							planTaskStates: {
								...session.planTaskStates,
								[statusEvent.planId]: updatedTasks,
							},
							streamingSections: session.streamingSections.map((section) =>
								section.type === "plan" && section.planId === statusEvent.planId ? { ...section, tasks: updatedTasks } : section
							),
							isRead: visible ? true : session.isRead,
						};
					});
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

					updateSession(currentSessionId, (session) => ({
						...session,
						lastActivityAt: eventTimestamp,
						streamingSections: [...session.streamingSections, section],
						isRead: visible ? true : session.isRead,
					}));
					break;
				}

				case "integration_result": {
					const section: StreamedSection = {
						type: "integration_result",
						resultId: event.resultId,
						integrationId: event.integrationId,
						integrationName: event.integrationName,
						title: event.title,
						status: event.status,
						mode: event.mode,
						content: event.content,
					};

					updateSession(currentSessionId, (session) => ({
						...session,
						lastActivityAt: eventTimestamp,
						streamingSections: [...session.streamingSections, section],
						isRead: visible ? true : session.isRead,
					}));
					break;
				}

				case "focused_items": {
					const section: StreamedSection = {
						type: "focused_items",
						items: event.items,
					};

					updateSession(currentSessionId, (session) => ({
						...session,
						lastActivityAt: eventTimestamp,
						streamingSections: [...session.streamingSections, section],
						isRead: visible ? true : session.isRead,
					}));
					break;
				}

				case "image_concepts": {
					updateSession(currentSessionId, (session) => {
						const existingIdx = session.streamingSections.findIndex((section) => section.type === "image_concepts" && section.itemId === event.itemId);
						const section: StreamedSection = {
							type: "image_concepts",
							itemId: event.itemId,
							itemName: event.itemName,
							concepts: event.concepts,
						};

						if (existingIdx >= 0) {
							const nextSections = [...session.streamingSections];
							nextSections[existingIdx] = section;
							return {
								...session,
								lastActivityAt: eventTimestamp,
								streamingSections: nextSections,
								isRead: visible ? true : session.isRead,
							};
						}

						return {
							...session,
							lastActivityAt: eventTimestamp,
							streamingSections: [...session.streamingSections, section],
							isRead: visible ? true : session.isRead,
						};
					});
					break;
				}

				case "image_concept_update": {
					updateSession(currentSessionId, (session) => ({
						...session,
						lastActivityAt: eventTimestamp,
						streamingSections: session.streamingSections.map((section) => {
							if (section.type === "image_concepts" && section.itemId === event.itemId) {
								return {
									...section,
									concepts: section.concepts.map((concept, index) =>
										index === event.conceptIndex ? { ...concept, imageDataUrl: event.imageDataUrl, status: event.status } : concept
									),
								};
							}
							return section;
						}),
						isRead: visible ? true : session.isRead,
					}));
					break;
				}

				case "video_concepts": {
					const section: StreamedSection = {
						type: "video_concepts",
						itemId: event.itemId,
						itemName: event.itemName,
						concepts: event.concepts,
					};

					updateSession(currentSessionId, (session) => ({
						...session,
						lastActivityAt: eventTimestamp,
						streamingSections: [...session.streamingSections, section],
						isRead: visible ? true : session.isRead,
					}));
					break;
				}

				case "context_update": {
					updateSession(currentSessionId, (session) => ({
						...session,
						lastActivityAt: eventTimestamp,
						context: { ...session.context, ...event.context },
					}));
					break;
				}

				case "done": {
					updateSession(currentSessionId, (session) => {
						const finalSections = [...session.streamingSections];
						const plainContent = finalSections
							.filter((section) => section.type === "text")
							.map((section) => (section.type === "text" ? section.content : ""))
							.join("\n\n");

						const assistantMessage: Message = {
							role: "assistant",
							content: plainContent || "Analysis complete.",
							sections: finalSections,
						};

						return {
							...session,
							lastActivityAt: eventTimestamp,
							messages: [...session.messages, assistantMessage],
							status: "completed",
							isRead: visible,
							completedAt: Date.now(),
							streamingSections: [],
							planTaskStates: {},
						};
					});
					break;
				}

				case "error": {
					const errorSection: StreamedSection = {
						type: "text",
						content: `⚠️ Error: ${event.message}`,
					};

					updateSession(currentSessionId, (session) => ({
						...session,
						lastActivityAt: eventTimestamp,
						streamingSections: [...session.streamingSections, errorSection],
						isRead: visible ? true : session.isRead,
					}));
					break;
				}
			}
		},
		[isSessionVisible, updateSession]
	);

	const handleSendMessage = async (
		content: string,
		context?: { channel?: ContextChannel; brands?: Brand[] },
		options?: SendMessageOptions
	) => {
		setActiveRayaView("tasks");
		setActiveAutomationId(null);
		setActiveAutomationMode("overview");
		const userMessage: Message = { role: "user", content };
		let currentSessionId = options?.forceNewSession ? null : activeSessionId;
		const existingSession = currentSessionId ? sessions.find((session) => session.id === currentSessionId) : undefined;

		if (!currentSessionId || !existingSession) {
			currentSessionId = Date.now().toString();

			const newSession: Session = {
				id: currentSessionId,
				title: content.length > 30 ? content.substring(0, 30) + "..." : content,
				messages: [...(options?.seedMessages ?? []), userMessage],
				createdAt: Date.now(),
				lastActivityAt: Date.now(),
				context: createEmptyContext(),
				status: "running",
				isRead: true,
				completedAt: null,
				streamingSections: [],
				planTaskStates: {},
			};

			setSessions((prev) => [...prev, newSession]);
			activeSessionIdRef.current = currentSessionId;
			setActiveSessionId(currentSessionId);
		} else {
			if (existingSession.status === "running") {
				return;
			}

			updateSession(currentSessionId, (session) => ({
				...session,
				messages: [...session.messages, userMessage],
				lastActivityAt: Date.now(),
				status: "running",
				isRead: true,
				completedAt: null,
				streamingSections: [],
				planTaskStates: {},
			}));
		}

		const sessionId = currentSessionId;
		if (!sessionId) {
			return;
		}

		closeSessionStream(sessionId);

		const channelParam = activeChannelId ? `&channelId=${encodeURIComponent(activeChannelId)}` : "";
		const sessionParam = `&sessionId=${encodeURIComponent(sessionId)}`;

		let contextParam = "";
		const integrationContext = connectedIntegrations.map((integration) => ({
			id: integration.id,
			name: integration.name,
			status: "connected" as const,
		}));
		if (context || integrationContext.length > 0 || (options?.seedConversationHistory?.length ?? 0) > 0) {
			const contextData = {
				channel: context?.channel,
				brands: context?.brands,
				integrations: integrationContext,
				conversationHistory: options?.seedConversationHistory,
			};
			contextParam = `&context=${encodeURIComponent(JSON.stringify(contextData))}`;
		}

		const apiUrl = `${baseUrl}/api/stream?message=${encodeURIComponent(content)}${channelParam}${sessionParam}${contextParam}`;
		const eventSource = new EventSource(apiUrl);
		eventSourcesRef.current.set(sessionId, eventSource);

		eventSource.onmessage = (messageEvent) => {
			try {
				const data = JSON.parse(messageEvent.data) as SSEEvent;
				handleSSEEvent(data, sessionId);

				if (data.type === "done") {
					closeSessionStream(sessionId);
				}
			} catch (err) {
				console.error("Failed to parse SSE event:", err);
			}
		};

		eventSource.onerror = (err) => {
			console.error("EventSource failed:", err);
			if (!eventSourcesRef.current.has(sessionId)) {
				return;
			}

			closeSessionStream(sessionId);
			updateSession(sessionId, (session) => {
				if (session.status !== "running") {
					return session;
				}

				const fallbackSections =
					session.streamingSections.length > 0
						? session.streamingSections
						: [{ type: "text", content: "⚠️ Error: Connection interrupted before the task completed." } as StreamedSection];

				return {
					...session,
					lastActivityAt: Date.now(),
					status: "failed",
					isRead: isSessionVisible(sessionId) ? true : session.isRead,
					streamingSections: fallbackSections,
				};
			});
		};
	};

	const handleTestAutomation = async (prompt: string) => {
		await handleSendMessage(prompt, undefined, { forceNewSession: true });
	};

	const handleContinueAutomationRun = async (historyMessages: Message[], content: string) => {
		await handleSendMessage(content, undefined, {
			forceNewSession: true,
			seedMessages: historyMessages,
			seedConversationHistory: buildSeedConversationHistory(historyMessages),
		});
	};

	const handleOpenAutomationRun = (automationId: string, options?: { runId?: string; prefilledInput?: string }) => {
		setActiveRayaView("automations");
		setActiveAutomationId(automationId);
		setActiveAutomationMode("run");
		setActiveAutomationRunId(options?.runId ?? null);
		setActiveAutomationComposerPrefill(options?.prefilledInput ?? null);
	};

	const handleOpenAutomationsOverview = () => {
		setActiveRayaView("automations");
		setActiveAutomationId(null);
		setActiveAutomationMode("overview");
		setActiveAutomationRunId(null);
		setActiveAutomationComposerPrefill(null);
	};

	const activeSession = sessions.find((session) => session.id === activeSessionId);
	const currentMessages = activeSession ? activeSession.messages : [];
	const currentStreamingSections = activeSession?.streamingSections || [];
	const currentPlanStates = new Map<string, PlanTask[]>(Object.entries(activeSession?.planTaskStates || {}));
	const currentIsLoading = activeSession?.status === "running";
	const connectedIntegrations = getConnectedIntegrations(channels, integrationConnectionState);
	const activeAutomations = automations.filter((automation) => automation.status === "active");

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
				activeRayaView={activeRayaView}
				onRayaViewChange={setActiveRayaView}
				automations={automations}
				activeAutomationId={activeAutomationId}
				activeAutomationMode={activeAutomationMode}
				onAutomationSelect={handleAutomationSelect}
				onAutomationModeChange={handleAutomationModeChange}
				activeAnalyticsView={activeAnalyticsView}
				onAnalyticsViewChange={setActiveAnalyticsView}
				channels={channels}
				activeChannelId={activeChannelId || undefined}
				onChannelSelect={setActiveChannelId}
				onChannelConnect={handleChannelConnect}
				onRefreshChannels={fetchChannels}
			/>
			<div className="main-content">
				{activeTab === "atria" ? (
					activeRayaView === "integrations" ? (
						<IntegrationsPage
							channels={channels}
							integrationConnectionState={integrationConnectionState}
							onChannelConnect={handleChannelConnect}
							onRefreshChannels={fetchChannels}
							onConnectIntegration={handleIntegrationConnect}
							onDisconnectIntegration={handleIntegrationDisconnect}
						/>
					) : activeRayaView === "automations" ? (
						<AutomationsPage
							automations={automations}
							activeAutomationId={activeAutomationId}
							activeAutomationMode={activeAutomationMode}
							channels={channels}
							activeChannelId={activeChannelId}
							initialRunId={activeAutomationRunId}
							composerPrefill={activeAutomationComposerPrefill}
							integrationConnectionState={integrationConnectionState}
							onAutomationSelect={handleAutomationSelect}
							onAutomationModeChange={handleAutomationModeChange}
							onSaveAutomation={handleSaveAutomation}
							onChannelConnect={handleChannelConnect}
							onRefreshChannels={fetchChannels}
							onConnectIntegration={handleIntegrationConnect}
							onTestAutomation={handleTestAutomation}
							onContinueAutomationRun={handleContinueAutomationRun}
						/>
					) : (
						<ChatInterface
							sessionId={activeSessionId}
							messages={currentMessages}
							isLoading={currentIsLoading}
							streamingSections={currentStreamingSections}
							planStates={currentPlanStates}
							onSendMessage={handleSendMessage}
							onOpenIntegrations={() => setActiveRayaView("integrations")}
							connectedIntegrations={connectedIntegrations}
							channels={channels}
							activeChannelId={activeChannelId}
							homeAutomations={activeAutomations}
							onOpenAutomationRun={handleOpenAutomationRun}
							onExploreAutomations={handleOpenAutomationsOverview}
						/>
					)
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
					<AnalyticsDashboard
						channels={channels}
						channelId={activeChannelId || undefined}
						onChannelChange={setActiveChannelId}
						dashboardView={activeAnalyticsView}
					/>
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
