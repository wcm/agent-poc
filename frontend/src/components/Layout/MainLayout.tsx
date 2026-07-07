import React, { useState, useRef, useEffect, useCallback } from "react";
import Sidebar from "../Sidebar/Sidebar";
import ChatInterface from "../Chat/ChatInterface";
import {
	AnalyticsDashboardView,
	Message,
	Session,
	SessionContext,
	StreamedSection,
	PlanTask,
	SSEEvent,
	PlanEvent,
	PlanStatusEvent,
	Integration,
	Brand,
	RayaView,
	SummaryLayout,
	PreviousRunArtifactContext,
	PreviousRunContext,
	PreviousRunReportContext,
	PreviousRunStepContext,
} from "../../types";
import DiscoveryFeed from "../Discovery/DiscoveryFeed";
import FollowingBrands from "../Discovery/FollowingBrands";
import BrandDetails from "../Discovery/BrandDetails";
import AnalyticsDashboard from "../Analytics/AnalyticsDashboard";
import BrandContextPage from "../BrandContext/BrandContextPage";
import IntegrationsPage from "../Integrations/IntegrationsPage";
import AutomationsPage from "../Automations/AutomationsPage";
import FilesPage from "../Files/FilesPage";
import Home2Page from "../Home2/Home2Page";
import OnboardingPage from "../Onboarding/OnboardingPage";
import { AutomationDefinition, AUTOMATION_STATE_STORAGE_KEY, getInitialAutomations, mergePersistedAutomations } from "../../automations/catalog";
import type { Home2SectionId } from "../../home/home2Tasks";
import {
	getConnectedIntegrations,
	getConnectableIntegrationId,
	getInitialIntegrationState,
	getIntegrationDefinitionById,
	BRAND_GUIDELINES_INTEGRATION_ID,
	IntegrationState,
	resolveIntegrations,
	ResolvedIntegration,
} from "../../integrations/catalog";

type SeedConversationEntry = Pick<Message, "role" | "content">;

interface SendMessageOptions {
	forceNewSession?: boolean;
	stayOnHome?: boolean;
	targetRayaView?: RayaView;
	home2Run?: {
		surface?: "home2" | "home3";
		sectionId: Home2SectionId;
		taskId: string;
		taskIndex: number;
		summaryLayout?: SummaryLayout;
		sourceSessionId?: string;
	};
	sourceSessionId?: string;
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

const getSessionSectionsForContext = (session: Session): StreamedSection[] => {
	const sections: StreamedSection[] = [];
	session.messages.forEach((message) => {
		if (message.sections) {
			sections.push(...message.sections);
		}
	});
	sections.push(...session.streamingSections);
	return sections;
};

const buildPreviousRunContextFromSession = (session: Session): PreviousRunContext => {
	const sections = getSessionSectionsForContext(session);
	const completedSteps: PreviousRunStepContext[] = [];
	const completedStepKeys = new Set<string>();
	const artifacts = new Map<string, PreviousRunArtifactContext>();
	const focusItems = new Map<string, PreviousRunContext["focusItems"][number]>();
	const reports = new Map<string, PreviousRunReportContext>();

	const addArtifact = (artifact: PreviousRunArtifactContext) => {
		if (!artifacts.has(artifact.id)) {
			artifacts.set(artifact.id, artifact);
		}
	};

	sections.forEach((section) => {
		if (section.type === "plan") {
			const tasks = session.planTaskStates[section.planId] ?? section.tasks;
			tasks.forEach((task) => {
				if (task.status !== "completed") {
					return;
				}

				const stepKey = `${task.tool}:${task.description}`;
				if (completedStepKeys.has(stepKey)) {
					return;
				}

				completedStepKeys.add(stepKey);
				completedSteps.push({
					tool: task.tool,
					description: task.description,
				});
			});
			return;
		}

		if (section.type === "focused_items") {
			section.items.forEach((item) => {
				focusItems.set(item.id, item);
			});
			addArtifact({
				id: `focus:${session.id}:${artifacts.size}`,
				type: "focus_items",
				title: `Focused items (${section.items.length})`,
			});
			return;
		}

		if (section.type === "report") {
			reports.set(section.reportId, {
				id: section.reportId,
				reportType: section.reportType,
				title: section.title,
				content: section.content,
				itemId: section.itemId,
				itemName: section.itemName,
				itemData: section.itemData,
			});
			addArtifact({
				id: `report:${section.reportId}`,
				type: "report",
				title: section.title,
			});
			return;
		}

		if (section.type === "image_concepts") {
			addArtifact({
				id: `image:${section.itemId}`,
				type: "image_concepts",
				title: `Image concepts for ${section.itemName}`,
			});
			return;
		}

		if (section.type === "video_concepts") {
			addArtifact({
				id: `video:${section.itemId}`,
				type: "video_concepts",
				title: `Video scripts for ${section.itemName}`,
			});
		}
	});

	if (session.summary) {
		addArtifact({
			id: `summary:${session.id}`,
			type: "summary",
			title: "Run summary",
		});
	}

	return {
		sourceSessionId: session.id,
		sourceTaskId: session.home2Run?.taskId,
		title: session.title,
		userRequest: session.messages.find((message) => message.role === "user")?.content,
		summary: session.summary,
		completedSteps,
		artifacts: Array.from(artifacts.values()),
		focusItems: Array.from(focusItems.values()),
		reports: Array.from(reports.values()),
	};
};

// Default empty session context
const createEmptyContext = (): SessionContext => ({
	performanceReports: [],
	focusedItems: [],
	selectedItemIds: [],
	creativeReports: [],
	commonFindingsReport: null,
	agentHistory: [],
});

const normalizeFrontendIntegrations = (integrations: Integration[] = []): Integration[] =>
	integrations.map((integration) => ({
		...integration,
		is_connected: false,
	}));

interface MainLayoutProps {
	initialRayaView?: RayaView;
	initialHome3SectionId?: Home2SectionId;
	highlightHome3SectionId?: Home2SectionId;
	onboardingMode?: boolean;
}

const MainLayout: React.FC<MainLayoutProps> = ({ initialRayaView, initialHome3SectionId, highlightHome3SectionId, onboardingMode = false }) => {
	// Layout State
	const [activeTab, setActiveTab] = useState("atria");
	const [activeRayaView, setActiveRayaView] = useState<RayaView>(initialRayaView ?? "home3");
	const [isOnboardingMode, setIsOnboardingMode] = useState(onboardingMode);
	const [home3InitialSectionId, setHome3InitialSectionId] = useState<Home2SectionId | undefined>(initialHome3SectionId);
	const [home3HighlightSectionId, setHome3HighlightSectionId] = useState<Home2SectionId | undefined>(highlightHome3SectionId);
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
	const [integrations, setIntegrations] = useState<Integration[]>([]);
	const [activeIntegrationId, setActiveIntegrationId] = useState<string | null>(null);
	const [selectedIntegrationIds, setSelectedIntegrationIds] = useState<string[]>([]);
	const [activeAnalyticsView, setActiveAnalyticsView] = useState<AnalyticsDashboardView>("top_spend");
	const [integrationState, setIntegrationState] = useState<IntegrationState>(() => getInitialIntegrationState());
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
		setIsOnboardingMode(onboardingMode);
	}, [onboardingMode]);

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

	const buildPreviousRunContext = useCallback(
		(sourceSessionId?: string) => {
			if (!sourceSessionId) {
				return undefined;
			}

			const sourceSession = sessions.find((session) => session.id === sourceSessionId);
			if (!sourceSession) {
				return undefined;
			}

			return buildPreviousRunContextFromSession(sourceSession);
		},
		[sessions]
	);

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

	const createStreamContextParam = useCallback(
		async (contextData: unknown) => {
			const response = await fetch(`${baseUrl}/api/stream/context`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ context: contextData }),
			});

			if (!response.ok) {
				throw new Error(`Failed to register stream context (${response.status})`);
			}

			const data = (await response.json()) as { contextId?: string };
			if (!data.contextId) {
				throw new Error("Stream context registration did not return a context ID.");
			}

			return `&contextId=${encodeURIComponent(data.contextId)}`;
		},
		[baseUrl]
	);

	useEffect(() => {
		const activeStreams = eventSourcesRef.current;
		return () => {
			activeStreams.forEach((eventSource) => eventSource.close());
			activeStreams.clear();
		};
	}, []);

	// Initial Load - Clear History & Fetch Integrations
	useEffect(() => {
		fetch(`${baseUrl}/api/clear`, { method: "POST" }).catch((err) => console.error("Failed to clear history:", err));

		fetch(`${baseUrl}/api/own-analytics`)
			.then((res) => res.json())
			.then((data) => {
				const loadedIntegrations = normalizeFrontendIntegrations(data.integrations);
				if (loadedIntegrations) {
					setIntegrations(loadedIntegrations);
				}
			})
			.catch((err) => console.error("Failed to fetch integrations:", err));
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

	const fetchIntegrations = async () => {
		try {
			const res = await fetch(`${baseUrl}/api/own-analytics`);
			const data = await res.json();
			const loadedIntegrations = normalizeFrontendIntegrations(data.integrations);
			if (loadedIntegrations) {
				setIntegrations(loadedIntegrations);
			}
		} catch (err) {
			console.error("Failed to fetch integrations:", err);
		}
	};

	const handleSelectedIntegrationIdsChange = useCallback((integrationIds: string[]) => {
		setSelectedIntegrationIds(integrationIds);
		setActiveIntegrationId((currentActiveId) => {
			if (currentActiveId && integrationIds.includes(currentActiveId)) {
				return currentActiveId;
			}

			const selectedAliases = new Set(integrationIds);
			const selectedBackendIntegration = getConnectedIntegrations(integrations, integrationState).find(
				(integration) => selectedAliases.has(integration.id) || (integration.integration ? selectedAliases.has(integration.integration.id) : false)
			)?.integration;

			return selectedBackendIntegration?.id ?? currentActiveId;
		});
	}, [integrations, integrationState]);

	const handleIntegrationSelect = useCallback((integrationId: string) => {
		setActiveIntegrationId(integrationId);
		setSelectedIntegrationIds((currentSelection) => (currentSelection.includes(integrationId) ? currentSelection : [...currentSelection, integrationId]));
	}, []);

	const handleIntegrationConnect = async (integrationId: string) => {
		const res = await fetch(`${baseUrl}/api/integrations/${integrationId}/connect`, { method: "POST" });
		if (!res.ok) {
			throw new Error("Failed to connect integration");
		}
		setIntegrationState((prev) => ({
			...prev,
			[integrationId]: true,
		}));
		setActiveIntegrationId(integrationId);
		setSelectedIntegrationIds((currentSelection) => (currentSelection.includes(integrationId) ? currentSelection : [...currentSelection, integrationId]));
	};

	const handleIntegrationDisconnect = async (integrationId: string) => {
		const res = await fetch(`${baseUrl}/api/integrations/${integrationId}/disconnect`, { method: "POST" });
		if (!res.ok) {
			throw new Error("Failed to disconnect integration");
		}
		setIntegrationState((prev) => ({
			...prev,
			[integrationId]: false,
		}));
		setSelectedIntegrationIds((currentSelection) => currentSelection.filter((id) => id !== integrationId));
		setActiveIntegrationId((currentActiveId) => (currentActiveId === integrationId ? null : currentActiveId));
	};

	const handleIntegrationStateConnect = useCallback((integrationId: string) => {
		setIntegrationState((prev) => ({
			...prev,
			[integrationId]: true,
		}));
	}, []);

	const handleIntegrationStateDisconnect = useCallback((integrationId: string) => {
		setIntegrationState((prev) => ({
			...prev,
			[integrationId]: false,
		}));
		setSelectedIntegrationIds((currentSelection) => currentSelection.filter((id) => id !== integrationId));
		setActiveIntegrationId((currentActiveId) => (currentActiveId === integrationId ? null : currentActiveId));
	}, []);

	const getAgentIntegrationContext = useCallback(
		(forceConnectedIntegrationId?: string) => {
			const effectiveIntegrationState = forceConnectedIntegrationId
				? { ...integrationState, [forceConnectedIntegrationId]: true }
				: integrationState;
			const resolved = resolveIntegrations(integrations, effectiveIntegrationState);
			const connected = resolved.filter((integration) => integration.isConnected);
			const connectedDataSources = connected.filter((integration) => integration.section === "dataSources");
			const effectiveSelectedIntegrationIds =
				selectedIntegrationIds.length > 0 ? selectedIntegrationIds : connectedDataSources.map((integration) => integration.id);
			const selectedAliases = new Set(effectiveSelectedIntegrationIds);
			const selectedDataSources = connectedDataSources.filter(
				(integration) => selectedAliases.has(integration.id) || (integration.integration ? selectedAliases.has(integration.integration.id) : false)
			);
			const connectedActionIntegrations = connected.filter((integration) => integration.section !== "dataSources");
			const uniqueIntegrations: ResolvedIntegration[] = [];
			const seenIntegrationIds = new Set<string>();

			[...selectedDataSources, ...connectedActionIntegrations].forEach((integration) => {
				if (seenIntegrationIds.has(integration.id)) {
					return;
				}
				seenIntegrationIds.add(integration.id);
				uniqueIntegrations.push(integration);
			});

			return uniqueIntegrations.map((integration) => ({
				id: integration.id,
				name: integration.name,
				status: "connected" as const,
			}));
		},
		[integrations, integrationState, selectedIntegrationIds]
	);

	const handleSaveAutomation = useCallback((automation: AutomationDefinition) => {
		setAutomations((prev) => prev.map((item) => (item.id === automation.id ? automation : item)));
	}, []);

	const handleSSEEvent = useCallback(
		(event: SSEEvent, currentSessionId: string) => {
			const visible = isSessionVisible(currentSessionId);
			const eventTimestamp = Date.now();

			switch (event.type) {
				case "run_title": {
					updateSession(currentSessionId, (session) => ({
						...session,
						title: event.title,
						lastActivityAt: eventTimestamp,
						isRead: visible ? true : session.isRead,
					}));
					break;
				}

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
						actionStatus: event.actionStatus,
						isBlocking: event.isBlocking,
						canConnect: event.canConnect,
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

				case "run_blocked": {
					updateSession(currentSessionId, (session) => ({
						...session,
						lastActivityAt: eventTimestamp,
						status: "running",
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

				case "run_summary": {
					const nextStepsSection: StreamedSection = {
						type: "next_steps",
						steps: event.summary.nextSteps,
					};

					updateSession(currentSessionId, (session) => ({
						...session,
						lastActivityAt: eventTimestamp,
						summary: event.summary,
						streamingSections: [...session.streamingSections.filter((section) => section.type !== "next_steps"), nextStepsSection],
						isRead: visible ? true : session.isRead,
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
		context?: { integration?: Integration; brands?: Brand[] },
		options?: SendMessageOptions
	): Promise<string | null> => {
		setActiveRayaView(options?.targetRayaView ?? "tasks");
		setActiveAutomationId(null);
		setActiveAutomationMode("overview");
		const userMessage: Message = { role: "user", content };
		const shouldStayOnHome = Boolean(options?.stayOnHome);
		let currentSessionId = options?.forceNewSession || shouldStayOnHome ? null : activeSessionId;
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
				home2Run: options?.home2Run,
			};

			setSessions((prev) => [...prev, newSession]);
			if (shouldStayOnHome) {
				activeSessionIdRef.current = null;
				setActiveSessionId(null);
			} else {
				activeSessionIdRef.current = currentSessionId;
				setActiveSessionId(currentSessionId);
			}
		} else {
			if (existingSession.status === "running") {
				return currentSessionId;
			}

			updateSession(currentSessionId, (session) => ({
				...session,
				messages: [...session.messages, userMessage],
				lastActivityAt: Date.now(),
				status: "running",
				isRead: true,
				completedAt: null,
				summary: undefined,
				streamingSections: [],
				planTaskStates: {},
				home2Run: options?.home2Run ?? session.home2Run,
			}));
		}

		const sessionId = currentSessionId;
		if (!sessionId) {
			return null;
		}

		closeSessionStream(sessionId);

		const mockIntegration = integrations.find((integration) => integration.id === "meta_ads") || integrations[0];
		const integrationParam = `&integrationId=${encodeURIComponent("meta_ads")}`;
		const sessionParam = `&sessionId=${encodeURIComponent(sessionId)}`;

		let contextParam = "";
		const integrationContext = getAgentIntegrationContext();
		const sourceSessionId = options?.sourceSessionId ?? options?.home2Run?.sourceSessionId;
		const previousRun = buildPreviousRunContext(sourceSessionId);
		const runMetadata =
			options?.home2Run || sourceSessionId
				? {
						taskId: options?.home2Run?.taskId,
						summaryLayout: options?.home2Run?.summaryLayout,
						sourceSessionId,
					}
				: undefined;
		const contextData = {
			integration: context?.integration ?? mockIntegration,
			brands: context?.brands,
			integrations: integrationContext,
			conversationHistory: options?.seedConversationHistory,
			runMetadata,
			previousRun,
		};
		try {
			contextParam = await createStreamContextParam(contextData);
		} catch (error) {
			console.error("Failed to register stream context:", error);
			updateSession(sessionId, (session) => ({
				...session,
				lastActivityAt: Date.now(),
				status: "failed",
				streamingSections: [
					{
						type: "text",
						content: "⚠️ Error: Failed to prepare task context before starting the run.",
					},
				],
			}));
			return sessionId;
		}

		const apiUrl = `${baseUrl}/api/stream?message=${encodeURIComponent(content)}${integrationParam}${sessionParam}${contextParam}`;
		const eventSource = new EventSource(apiUrl);
		eventSourcesRef.current.set(sessionId, eventSource);

		eventSource.onmessage = (messageEvent) => {
			try {
				const data = JSON.parse(messageEvent.data) as SSEEvent;
				handleSSEEvent(data, sessionId);

				if (data.type === "done" || data.type === "run_blocked") {
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
						: [{ type: "text", content: "⚠️ Error: Integration interrupted before the task completed." } as StreamedSection];

				return {
					...session,
					lastActivityAt: Date.now(),
					status: "failed",
					isRead: isSessionVisible(sessionId) ? true : session.isRead,
					streamingSections: fallbackSections,
				};
			});
		};

		return sessionId;
	};

	const handleRunHomeTask = async (prompt: string, sourceSessionId?: string) => {
		return handleSendMessage(prompt, undefined, {
			forceNewSession: true,
			stayOnHome: true,
			sourceSessionId,
		});
	};

	const handleRunHome2Task = async (
		sectionId: Home2SectionId,
		taskIndex: number,
		prompt: string,
		taskId?: string,
		summaryLayout?: SummaryLayout,
		sourceSessionId?: string
	) => {
		return handleSendMessage(prompt, undefined, {
			forceNewSession: true,
			stayOnHome: true,
			targetRayaView: "home2",
			sourceSessionId,
			home2Run: {
				sectionId,
				taskId: taskId ?? `${sectionId}-${taskIndex}`,
				taskIndex,
				summaryLayout,
				sourceSessionId,
			},
		});
	};

	const handleRunHome2ComposerMessage = async (prompt: string) => {
		return handleSendMessage(prompt, undefined, {
			forceNewSession: true,
			stayOnHome: true,
			targetRayaView: "home2",
		});
	};

	const handleRunHome3Task = async (
		sectionId: Home2SectionId,
		taskIndex: number,
		prompt: string,
		taskId?: string,
		summaryLayout?: SummaryLayout,
		sourceSessionId?: string
	) => {
		return handleSendMessage(prompt, undefined, {
			forceNewSession: true,
			stayOnHome: true,
			targetRayaView: "home3",
			sourceSessionId,
			home2Run: {
				sectionId,
				taskId: taskId ?? `${sectionId}-${taskIndex}`,
				taskIndex,
				summaryLayout,
				sourceSessionId,
			},
		});
	};

	const handleRunHome3ComposerMessage = async (prompt: string) => {
		return handleSendMessage(prompt, undefined, {
			forceNewSession: true,
			stayOnHome: true,
			targetRayaView: "home3",
		});
	};

	const resumeBlockedSession = async (sessionId: string, integrationId: string) => {
		closeSessionStream(sessionId);

		const mockIntegration = integrations.find((integration) => integration.id === "meta_ads") || integrations[0];
		const sessionParam = `&sessionId=${encodeURIComponent(sessionId)}`;
		const integrationParam = `&integrationId=${encodeURIComponent(integrationId)}`;
		const contextData = {
			integration: mockIntegration,
			integrations: getAgentIntegrationContext(integrationId),
		};
		let contextParam = "";
		try {
			contextParam = await createStreamContextParam(contextData);
		} catch (error) {
			console.error("Failed to register resume stream context:", error);
			updateSession(sessionId, (session) => ({
				...session,
				lastActivityAt: Date.now(),
				status: "failed",
				streamingSections: [
					...session.streamingSections,
					{
						type: "text",
						content: "⚠️ Error: Failed to prepare connection context before resuming the task.",
					},
				],
			}));
			return;
		}
		const apiUrl = `${baseUrl}/api/stream/resume?${sessionParam.slice(1)}${integrationParam}${contextParam}`;
		const eventSource = new EventSource(apiUrl);
		eventSourcesRef.current.set(sessionId, eventSource);

		eventSource.onmessage = (messageEvent) => {
			try {
				const data = JSON.parse(messageEvent.data) as SSEEvent;
				handleSSEEvent(data, sessionId);

				if (data.type === "done" || data.type === "run_blocked") {
					closeSessionStream(sessionId);
				}
			} catch (err) {
				console.error("Failed to parse resume SSE event:", err);
			}
		};

		eventSource.onerror = (err) => {
			console.error("Resume EventSource failed:", err);
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
						: [{ type: "text", content: "⚠️ Error: Connection resume interrupted before the task completed." } as StreamedSection];

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

	const handleConnectRequiredIntegration = async (sessionId: string, integrationId: string) => {
		const definition = getIntegrationDefinitionById(integrationId);
		const backendIntegrationId = definition ? getConnectableIntegrationId(definition) : null;

		try {
			if (backendIntegrationId) {
				await handleIntegrationConnect(backendIntegrationId);
				setIntegrationState((prev) => ({
					...prev,
					[integrationId]: true,
				}));
				await fetchIntegrations();
			} else {
				handleIntegrationStateConnect(integrationId);
			}

			const markIntegrationCardsConnected = (sections: StreamedSection[]): StreamedSection[] =>
				sections.map((section) => {
					if (section.type !== "integration_result" || section.integrationId !== integrationId || section.status === "connected") {
						return section;
					}

					const integrationName = section.integrationName || definition?.name || integrationId;
					return {
						...section,
						integrationName,
						title: `${integrationName} connected`,
						status: "connected" as const,
						actionStatus: "completed" as const,
						isBlocking: false,
						canConnect: false,
						content: `${integrationName} connected. Continuing the task...`,
					};
				});

			updateSession(sessionId, (session) => ({
				...session,
				lastActivityAt: Date.now(),
				status: "running",
				messages: session.messages.map((message) => (message.sections ? { ...message, sections: markIntegrationCardsConnected(message.sections) } : message)),
				streamingSections: [
					...markIntegrationCardsConnected(session.streamingSections),
					{
						type: "text",
						content: `${definition?.name ?? integrationId} connected. Resuming the task...`,
					},
				],
			}));
			await resumeBlockedSession(sessionId, integrationId);
		} catch (error) {
			console.error("Failed to connect required integration:", error);
		}
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

	const activeSession = sessions.find((session) => session.id === activeSessionId);
	const currentMessages = activeSession ? activeSession.messages : [];
	const currentStreamingSections = activeSession?.streamingSections || [];
	const currentPlanStates = new Map<string, PlanTask[]>(Object.entries(activeSession?.planTaskStates || {}));
	const currentIsLoading = activeSession?.status === "running";
	const resolvedIntegrations = resolveIntegrations(integrations, integrationState);
	const connectedIntegrations = resolvedIntegrations.filter((integration) => integration.isConnected);
	const myConnections = resolvedIntegrations.filter((integration) => integration.section === "myConnections");
	const isBrandGuidelinesConnected = resolvedIntegrations.some(
		(integration) => integration.id === BRAND_GUIDELINES_INTEGRATION_ID && integration.isConnected
	);

	const completeOnboarding = () => {
		window.history.pushState({}, "", "/?view=home3&section=competitor-intelligence&highlight=ad-performance&onboarding=complete");
		setActiveTab("atria");
		setActiveRayaView("home3");
		setHome3InitialSectionId("competitor-intelligence");
		setHome3HighlightSectionId("ad-performance");
		setIsOnboardingMode(false);
	};

	const handleOnboardingSessionSelect = (sessionId: string) => {
		window.history.pushState({}, "", "/");
		setIsOnboardingMode(false);
		handleSessionSelect(sessionId);
	};

	if (isOnboardingMode) {
		return (
			<OnboardingPage
				sessions={sessions}
				onRunTask={handleRunHome3Task}
				onSessionSelect={handleOnboardingSessionSelect}
				onConnectRequiredIntegration={handleConnectRequiredIntegration}
				onOpenBrandContext={() => setActiveRayaView("brandContext")}
				onConnectSlack={() => handleIntegrationStateConnect("slack")}
				onComplete={completeOnboarding}
				activeBrand={activeBrand}
				isBrandGuidelinesConnected={isBrandGuidelinesConnected}
			/>
		);
	}

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
				integrations={integrations}
				onIntegrationSelect={handleIntegrationSelect}
				onIntegrationConnect={handleIntegrationConnect}
				onRefreshIntegrations={fetchIntegrations}
			/>
			<div className="main-content">
				{activeTab === "atria" ? (
					activeRayaView === "brandContext" ? (
						<BrandContextPage brandName={activeBrand} />
					) : activeRayaView === "integrations" ? (
						<IntegrationsPage
							integrations={integrations}
							integrationState={integrationState}
							onIntegrationConnect={handleIntegrationConnect}
							onIntegrationDisconnect={handleIntegrationDisconnect}
							onRefreshIntegrations={fetchIntegrations}
							onConnectIntegration={handleIntegrationStateConnect}
							onDisconnectIntegration={handleIntegrationStateDisconnect}
						/>
					) : activeRayaView === "automations" ? (
						<AutomationsPage
							automations={automations}
							activeAutomationId={activeAutomationId}
							activeAutomationMode={activeAutomationMode}
							integrations={integrations}
							activeIntegrationId={activeIntegrationId}
							activeBrand={activeBrand}
							initialRunId={activeAutomationRunId}
							composerPrefill={activeAutomationComposerPrefill}
							integrationState={integrationState}
							onAutomationSelect={handleAutomationSelect}
							onAutomationModeChange={handleAutomationModeChange}
							onSaveAutomation={handleSaveAutomation}
							onIntegrationConnect={handleIntegrationConnect}
							onRefreshIntegrations={fetchIntegrations}
							onConnectIntegration={handleIntegrationStateConnect}
							onDisconnectIntegration={handleIntegrationStateDisconnect}
							onOpenBrandContext={() => setActiveRayaView("brandContext")}
							onTestAutomation={handleTestAutomation}
							onContinueAutomationRun={handleContinueAutomationRun}
						/>
					) : activeRayaView === "home2" || activeRayaView === "home3" ? (
						<Home2Page
							sessions={sessions}
							onRunTask={activeRayaView === "home3" ? handleRunHome3Task : handleRunHome2Task}
							onRunComposerMessage={activeRayaView === "home3" ? handleRunHome3ComposerMessage : handleRunHome2ComposerMessage}
							onSessionSelect={handleSessionSelect}
							onConnectRequiredIntegration={handleConnectRequiredIntegration}
							onOpenBrandContext={() => setActiveRayaView("brandContext")}
							activeBrand={activeBrand}
							isBrandGuidelinesConnected={isBrandGuidelinesConnected}
							surface={activeRayaView}
							layout={activeRayaView === "home3" ? "tabs" : "sections"}
							initialTabbedSectionId={activeRayaView === "home3" ? home3InitialSectionId : undefined}
							highlightSectionId={activeRayaView === "home3" ? home3HighlightSectionId : undefined}
						/>
					) : (
						<ChatInterface
							sessionId={activeSessionId}
							sessions={sessions}
							messages={currentMessages}
							isLoading={currentIsLoading}
							streamingSections={currentStreamingSections}
							planStates={currentPlanStates}
							onSendMessage={handleSendMessage}
							onRunHomeTask={handleRunHomeTask}
							onSessionSelect={handleSessionSelect}
							onConnectRequiredIntegration={handleConnectRequiredIntegration}
							onSetupAutomation={() => {
								setActiveAutomationId(null);
								setActiveAutomationMode("overview");
								setActiveRayaView("automations");
							}}
							onOpenIntegrations={() => setActiveRayaView("integrations")}
							onOpenBrandContext={() => setActiveRayaView("brandContext")}
							connectedIntegrations={connectedIntegrations}
							myConnections={myConnections}
							activeIntegrationId={activeIntegrationId}
							activeBrand={activeBrand}
							isBrandGuidelinesConnected={isBrandGuidelinesConnected}
							selectedIntegrationIds={selectedIntegrationIds}
							onSelectedIntegrationIdsChange={handleSelectedIntegrationIdsChange}
							onConnectMyConnection={handleIntegrationStateConnect}
							onDisconnectMyConnection={handleIntegrationStateDisconnect}
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
						integrations={integrations}
						integrationId={activeIntegrationId || undefined}
						onIntegrationChange={setActiveIntegrationId}
						dashboardView={activeAnalyticsView}
					/>
				) : activeTab === "files" ? (
					<FilesPage
						baseUrl={baseUrl}
						isBrandGuidelinesConnected={isBrandGuidelinesConnected}
						onConnectBrandGuidelines={() => handleIntegrationStateConnect(BRAND_GUIDELINES_INTEGRATION_ID)}
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
