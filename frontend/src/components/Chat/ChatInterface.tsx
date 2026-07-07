import React, { useRef, useEffect, useState, useCallback, useMemo, useLayoutEffect } from "react";
import { AlertTriangle, ArrowUp, ArrowUpRight, Sparkles, LucideIcon, Plus, ImageIcon, FileText, Heart, Check, Plug, ChevronLeft, ChevronRight, Search, Rocket, ClipboardCheck, Gauge, Clock, Paperclip } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message, StreamedSection, PlanTask, ImageConcept, VideoConcept, Session, RunSummary, SummaryCreative } from "../../types";
import StreamingMessage from "./StreamingMessage";
import { MessageContent } from "../../MessageContent";
import PlanTimeline from "./PlanTimeline";
import DocumentPanel, { ChatDocument } from "./DocumentPanel";
import AssistantStreamingIndicator, { AssistantStreamingPhase } from "./AssistantStreamingIndicator";
import { getIntegrationDefinitionById, ResolvedIntegration } from "../../integrations/catalog";
import { findBrandContext, getBrandContext, getBrandContextPrimaryLogo } from "../../brandContext/catalog";
import BrandLogoMark from "../BrandContext/BrandLogoMark";
import MyConnectionsModal from "./MyConnectionsModal";
import { RECOMMENDED_HOME_TASKS, RecommendedTaskIcon } from "../../home/recommendedTasks";
import rayaThinkingGif from "../../assets/raya-thinking.gif";

interface ChatInterfaceProps {
	sessionId: string | null;
	sessions: Session[];
	messages: Message[];
	isLoading: boolean;
	streamingSections: StreamedSection[];
	planStates: Map<string, PlanTask[]>;
	onSendMessage: (message: string) => void;
	onRunHomeTask?: (message: string, sourceSessionId?: string) => void;
	onSessionSelect: (sessionId: string) => void;
	onConnectRequiredIntegration?: (sessionId: string, integrationId: string) => Promise<void> | void;
	onSetupAutomation?: () => void;
	onOpenIntegrations: () => void;
	onOpenBrandContext: () => void;
	connectedIntegrations: ResolvedIntegration[];
	myConnections: ResolvedIntegration[];
	activeIntegrationId: string | null;
	activeBrand: string;
	isBrandGuidelinesConnected?: boolean;
	selectedIntegrationIds?: string[];
	onSelectedIntegrationIdsChange?: (integrationIds: string[]) => void;
	onConnectMyConnection: (integrationId: string) => Promise<void> | void;
	onDisconnectMyConnection: (integrationId: string) => Promise<void> | void;
	showComposer?: boolean;
	headerContent?: React.ReactNode;
	prefilledInput?: string | null;
}

type PlanSection = Extract<StreamedSection, { type: "plan" }>;
type ReportSection = Extract<StreamedSection, { type: "report" }>;

const getReportDocumentId = (reportId: string) => `report:${reportId}`;

const getImageDocumentId = (itemId: string, index: number) => `image:${itemId}:${index}`;

const getVideoDocumentId = (itemId: string, index: number) => `video:${itemId}:${index}`;

const getArtifactReportKind = (reportType: ReportSection["reportType"]) => {
	switch (reportType) {
		case "performance":
			return "Performance report";
		case "creative":
			return "Creative report";
		case "common":
			return "Final report";
		default:
			return "Report";
	}
};

const COMPOSER_OVERLAY_ITEMS: Array<{ id: string; label: string; icon: LucideIcon }> = [
	{ id: "assets", label: "Assets", icon: ImageIcon },
	{ id: "ads", label: "Ads", icon: Sparkles },
	{ id: "reports", label: "Reports", icon: FileText },
	{ id: "following-brand", label: "Following Brand", icon: Heart },
];

const RECOMMENDED_TASK_ICONS: Record<RecommendedTaskIcon, LucideIcon> = {
	competitors: Search,
	launch: Rocket,
	audit: ClipboardCheck,
	fatigue: Gauge,
};

const formatTaskTimestamp = (value: number | null) => {
	if (!value) {
		return "Running now";
	}

	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(value));
};

const getLatestPlanSection = (messages: Message[]): PlanSection | null => {
	for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
		const sections = messages[messageIndex].sections;
		if (!sections) {
			continue;
		}

		for (let sectionIndex = sections.length - 1; sectionIndex >= 0; sectionIndex -= 1) {
			const section = sections[sectionIndex];
			if (section.type === "plan") {
				return section;
			}
		}
	}

	return null;
};

const getLatestDocumentCandidates = (messages: Message[], streamingSections: StreamedSection[]) => {
	const documents: ChatDocument[] = [];
	const sections: StreamedSection[] = [];

	messages.forEach((message) => {
		if (message.sections) {
			sections.push(...message.sections);
		}
	});
	sections.push(...streamingSections);

	sections.forEach((section) => {
		switch (section.type) {
			case "report":
				documents.push({
					id: getReportDocumentId(section.reportId),
					kind: "report",
					title: section.title,
					reportType: section.reportType,
					content: section.content,
					itemName: section.itemName,
					itemData: section.itemData,
				});
				break;
			case "image_concepts":
				section.concepts.forEach((concept, index) => {
					documents.push({
						id: getImageDocumentId(section.itemId, index),
						kind: "image-concept",
						title: concept.concept_name || `Image Concept ${index + 1}`,
						itemName: section.itemName,
						index,
						concept,
					});
				});
				break;
			case "video_concepts":
				section.concepts.forEach((concept, index) => {
					documents.push({
						id: getVideoDocumentId(section.itemId, index),
						kind: "video-concept",
						title: concept.concept_name || `Video Concept ${index + 1}`,
						itemName: section.itemName,
						index,
						concept,
					});
				});
				break;
			default:
				break;
		}
	});

	const latestReportDocument = [...documents].reverse().find((document): document is Extract<ChatDocument, { kind: "report" }> => document.kind === "report") || null;
	const latestGenerationDocument =
		[...documents].reverse().find((document) => {
			if (document.kind === "video-concept") {
				return true;
			}

			if (document.kind === "image-concept") {
				return Boolean(document.concept.concept_name || document.concept.concept_summary || document.concept.concept_detail || document.concept.imageDataUrl);
			}

			return false;
		}) ||
		[...documents].reverse().find((document) => document.kind === "image-concept" || document.kind === "video-concept") ||
		null;

	return {
		documents,
		latestReportDocument,
		latestGenerationDocument,
	};
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({
	sessionId,
	sessions,
	messages,
	isLoading,
	streamingSections,
	planStates,
	onSendMessage,
	onRunHomeTask,
	onSessionSelect,
	onConnectRequiredIntegration,
	onSetupAutomation,
	onOpenIntegrations,
	onOpenBrandContext,
	connectedIntegrations,
	myConnections,
	activeIntegrationId,
	activeBrand,
	isBrandGuidelinesConnected = false,
	selectedIntegrationIds,
	onSelectedIntegrationIdsChange,
	onConnectMyConnection,
	onDisconnectMyConnection,
	showComposer = true,
	headerContent,
	prefilledInput,
}) => {
	const [input, setInput] = useState("");
	const [isProgressCollapsed, setIsProgressCollapsed] = useState(true);
	const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
	const [isDocumentPanelOpen, setIsDocumentPanelOpen] = useState(false);
	const [isComposerMenuOpen, setIsComposerMenuOpen] = useState(false);
	const [isMyConnectionsModalOpen, setIsMyConnectionsModalOpen] = useState(false);
	const [currentRunningIndex, setCurrentRunningIndex] = useState(0);
	const chatMessagesAreaRef = useRef<HTMLDivElement>(null);
	const initialScrollSessionRef = useRef<string | null>(null);
	const composerMenuRef = useRef<HTMLDivElement>(null);
	const taskCarouselRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	const resizeComposer = useCallback(() => {
		const node = inputRef.current;
		if (!node) {
			return;
		}

		node.style.height = "auto";
		const nextHeight = Math.min(node.scrollHeight, 220);
		node.style.height = `${nextHeight}px`;
		node.style.overflowY = node.scrollHeight > 220 ? "auto" : "hidden";
	}, []);

	// Callback ref that scrolls to top when empty state mounts
	const emptyStateRef = useCallback((node: HTMLDivElement | null) => {
		if (node) {
			node.scrollTo({ top: 0, behavior: "auto" });
		}
	}, []);

	const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
		const node = chatMessagesAreaRef.current;
		if (!node) {
			return;
		}

		const scroll = () => {
			node.scrollTo({
				top: node.scrollHeight,
				behavior,
			});
		};

		scroll();
		window.requestAnimationFrame(scroll);
	}, []);

	const isEmptyState = showComposer && messages.length === 0 && !isLoading;
	const explicitBrandContext = useMemo(() => findBrandContext(activeBrand), [activeBrand]);
	const activeBrandContext = useMemo(() => explicitBrandContext ?? getBrandContext(activeBrand), [activeBrand, explicitBrandContext]);
	const activeBrandPrimaryLogo = useMemo(() => getBrandContextPrimaryLogo(activeBrandContext), [activeBrandContext]);
	const brandContextScore = explicitBrandContext ? (isBrandGuidelinesConnected ? 100 : 68) : 0;
	const streamingPhase = useMemo<AssistantStreamingPhase>(() => {
		const hasContentSections = streamingSections.some((section) => section.type !== "plan");
		return hasContentSections ? "writing" : "reasoning";
	}, [streamingSections]);
	const selectedIntegrationIdSet = useMemo(
		() => selectedIntegrationIds ?? (activeIntegrationId ? [activeIntegrationId] : []),
		[activeIntegrationId, selectedIntegrationIds]
	);
	const runningHomeSessions = useMemo(
		() => sessions.filter((session) => session.status === "running").sort((left, right) => right.lastActivityAt - left.lastActivityAt),
		[sessions]
	);
	const completedHomeSessions = useMemo(
		() =>
			sessions
				.filter((session) => session.status === "completed" && session.summary)
				.sort((left, right) => (right.completedAt ?? right.lastActivityAt) - (left.completedAt ?? left.lastActivityAt)),
		[sessions]
	);

	useEffect(() => {
		setCurrentRunningIndex((currentIndex) => {
			if (runningHomeSessions.length === 0) {
				return 0;
			}

			return Math.min(currentIndex, runningHomeSessions.length - 1);
		});
	}, [runningHomeSessions.length]);

	useEffect(() => {
		if (!isEmptyState) {
			scrollToBottom(isLoading ? "auto" : "smooth");
		}
	}, [messages, streamingSections, isEmptyState, isLoading, scrollToBottom]);

	useLayoutEffect(() => {
		if (!sessionId || isEmptyState || initialScrollSessionRef.current === sessionId) {
			return;
		}

		const frameId = window.requestAnimationFrame(() => {
			scrollToBottom("auto");
			initialScrollSessionRef.current = sessionId;
		});

		return () => window.cancelAnimationFrame(frameId);
	}, [sessionId, isEmptyState, messages.length, streamingSections.length, scrollToBottom]);

	const activePlanSection = streamingSections.find((section): section is PlanSection => section.type === "plan");
	const activePlanTasks = activePlanSection ? planStates.get(activePlanSection.planId) || activePlanSection.tasks : [];
	const latestCompletedPlanSection = getLatestPlanSection(messages);
	const displayedPlanSection = activePlanSection || (!isLoading ? latestCompletedPlanSection : null);
	const displayedPlanTasks = activePlanSection ? activePlanTasks : displayedPlanSection?.tasks || [];
	const displayedPlanId = displayedPlanSection?.planId;
	const { documents, latestReportDocument, latestGenerationDocument } = useMemo(() => getLatestDocumentCandidates(messages, streamingSections), [messages, streamingSections]);
	const latestDocument = latestGenerationDocument || latestReportDocument;
	const selectedDocument = (selectedDocumentId ? documents.find((document) => document.id === selectedDocumentId) : null) || null;

	useEffect(() => {
		if (displayedPlanId) {
			setIsProgressCollapsed(true);
		}
	}, [displayedPlanId]);

	useEffect(() => {
		if (!sessionId) {
			setSelectedDocumentId(null);
			setIsDocumentPanelOpen(false);
			return;
		}

		if (latestDocument) {
			setSelectedDocumentId(latestDocument.id);
			setIsDocumentPanelOpen(true);
			return;
		}

		setSelectedDocumentId(null);
		setIsDocumentPanelOpen(false);
	}, [sessionId, latestDocument]);

	useEffect(() => {
		if (isLoading && latestGenerationDocument) {
			setSelectedDocumentId(latestGenerationDocument.id);
			setIsDocumentPanelOpen(true);
		}
	}, [isLoading, latestGenerationDocument]);

	useEffect(() => {
		if (!selectedDocumentId) {
			return;
		}

		if (!selectedDocument && latestDocument) {
			setSelectedDocumentId(latestDocument.id);
			setIsDocumentPanelOpen(true);
		}
	}, [selectedDocumentId, selectedDocument, latestDocument]);

	useEffect(() => {
		if (!prefilledInput) {
			return;
		}

		setInput(prefilledInput);
		window.requestAnimationFrame(() => {
			resizeComposer();
			inputRef.current?.focus();
		});
	}, [prefilledInput, resizeComposer, sessionId]);

	useLayoutEffect(() => {
		resizeComposer();
	}, [input, resizeComposer]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (composerMenuRef.current && !composerMenuRef.current.contains(event.target as Node)) {
				setIsComposerMenuOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const runHomeTask = useCallback(
		(message: string, sourceSessionId?: string) => {
			if (onRunHomeTask) {
				onRunHomeTask(message, sourceSessionId);
				return;
			}
			onSendMessage(message);
		},
		[onRunHomeTask, onSendMessage]
	);

	const submitComposerMessage = (sendMessage: (message: string) => void) => {
		const trimmedInput = input.trim();
		if (!trimmedInput || isLoading) return;
		sendMessage(trimmedInput);
		setInput("");
		setIsComposerMenuOpen(false);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		submitComposerMessage(onSendMessage);
	};

	const handleHomeFixedSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		submitComposerMessage(runHomeTask);
	};

	const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			submitComposerMessage(onSendMessage);
		}
	};

	const handleHomeFixedComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			submitComposerMessage(runHomeTask);
		}
	};

	const isIntegrationSelected = (integration: ResolvedIntegration) =>
		selectedIntegrationIdSet.includes(integration.id) || (integration.integration ? selectedIntegrationIdSet.includes(integration.integration.id) : false);

	const toggleIntegrationSelection = (integration: ResolvedIntegration) => {
		if (!onSelectedIntegrationIdsChange) {
			return;
		}

		const aliases = new Set([integration.id, integration.integration?.id].filter(Boolean) as string[]);
		const nextSelection = isIntegrationSelected(integration)
			? selectedIntegrationIdSet.filter((id) => !aliases.has(id))
			: [...selectedIntegrationIdSet, integration.id];
		onSelectedIntegrationIdsChange(nextSelection);
	};

	const openReportDocument = (section: ReportSection) => {
		setSelectedDocumentId(getReportDocumentId(section.reportId));
		setIsDocumentPanelOpen(true);
	};

	const openImageConceptDocument = (itemId: string, _itemName: string, _concept: ImageConcept, index: number) => {
		setSelectedDocumentId(getImageDocumentId(itemId, index));
		setIsDocumentPanelOpen(true);
	};

	const openVideoConceptDocument = (itemId: string, _itemName: string, _concept: VideoConcept, index: number) => {
		setSelectedDocumentId(getVideoDocumentId(itemId, index));
		setIsDocumentPanelOpen(true);
	};

	const closeDocumentPanel = () => {
		setSelectedDocumentId(null);
		setIsDocumentPanelOpen(false);
	};

	const scrollRecommendedTasks = (direction: "left" | "right") => {
		const node = taskCarouselRef.current;
		if (!node) {
			return;
		}

		node.scrollBy({
			left: direction === "left" ? -node.clientWidth * 0.82 : node.clientWidth * 0.82,
			behavior: "smooth",
		});
	};

	const paginateRunningTasks = (direction: "left" | "right") => {
		if (runningHomeSessions.length <= 1) {
			return;
		}

		setCurrentRunningIndex((currentIndex) => {
			const delta = direction === "left" ? -1 : 1;
			return (currentIndex + delta + runningHomeSessions.length) % runningHomeSessions.length;
		});
	};

	const renderSummaryImages = (summary: RunSummary) => {
		if (summary.imageUrls.length === 0) {
			return null;
		}
		const visibleImageUrls = summary.imageUrls.slice(0, 8);
		const hiddenImageCount = Math.max(0, summary.imageUrls.length - visibleImageUrls.length);

		return (
			<div className="home-insight-images">
				{visibleImageUrls.map((imageUrl, index) => (
					<div key={`${imageUrl}-${index}`} className="home-insight-image-thumb">
						<img src={imageUrl} alt="" loading="lazy" />
						{hiddenImageCount > 0 && index === visibleImageUrls.length - 1 && <span className="home-insight-image-more">+{hiddenImageCount}</span>}
					</div>
				))}
			</div>
		);
	};

	const getDisplayInsight = (insight: RunSummary["insights"][number] | string, index: number) => {
		const fallbackEmojis = ["💡", "📈", "🎯", "⚡"];
		if (typeof insight === "string") {
			const title = insight
				.replace(/\*\*/g, "")
				.replace(/[`*_~#>-]/g, "")
				.trim()
				.split(/\s+/)
				.slice(0, 10)
				.join(" ");
			return {
				emoji: fallbackEmojis[index % fallbackEmojis.length],
				title: title || "Key Signal",
				description: insight.replace(/\*\*/g, ""),
			};
		}

		const description = (insight.description || "").replace(/\*\*/g, "");
		return {
			emoji: insight.emoji || fallbackEmojis[index % fallbackEmojis.length],
			title: insight.title || "Key Signal",
			description,
		};
	};

	const renderSummaryError = (summary: RunSummary) => {
		if (!summary.error) {
			return null;
		}

		return (
			<div className="home-summary-error" role="alert">
				<div className="home-summary-error-header">
					<AlertTriangle size={18} />
					<div>
						<h4>{summary.error.title}</h4>
						<p>{summary.error.message}</p>
					</div>
				</div>
				{summary.error.details && <p className="home-summary-error-details">{summary.error.details}</p>}
				{summary.error.rawResponse && (
					<details className="home-summary-error-raw">
						<summary>Raw summary response</summary>
						<pre>{summary.error.rawResponse}</pre>
					</details>
				)}
			</div>
		);
	};

	const getSessionSections = (session: Session) => {
		const sections: StreamedSection[] = [];
		session.messages.forEach((message) => {
			if (message.sections) {
				sections.push(...message.sections);
			}
		});
		sections.push(...session.streamingSections);
		return sections;
	};

	const getBlockingIntegrationResult = (session: Session) => {
		const sections = getSessionSections(session);
		const completedActionIntegrations = new Set<string>();
		for (let index = sections.length - 1; index >= 0; index -= 1) {
			const section = sections[index];
			if (section.type !== "integration_result") {
				continue;
			}
			if (section.actionStatus === "completed") {
				completedActionIntegrations.add(section.integrationId);
				continue;
			}
			if (section.isBlocking && !completedActionIntegrations.has(section.integrationId)) {
				return section;
			}
		}

		return null;
	};

	const renderConnectionRequiredCard = (session: Session, section: Extract<StreamedSection, { type: "integration_result" }>) => {
		const definition = getIntegrationDefinitionById(section.integrationId);
		const integrationName = section.integrationName || definition?.name || section.integrationId;

		return (
			<button
				type="button"
				className="home-running-connection-required"
				disabled={!section.canConnect}
				onClick={() => section.canConnect && onConnectRequiredIntegration?.(session.id, section.integrationId)}
			>
				<span className="home-running-connection-logo">{definition?.renderLogo(34) ?? <Plug size={18} />}</span>
				<span className="home-running-connection-copy">
					<strong>{section.title}</strong>
					<span>{section.content}</span>
				</span>
				<span className="home-running-connection-action">{section.canConnect ? `Connect ${integrationName}` : "Not available"}</span>
			</button>
		);
	};

	const getGeneratedDocuments = (session: Session) => {
		const documents: Array<{ id: string; title: string; kind: string }> = [];
		const seen = new Set<string>();
		const addDocument = (document: { id: string; title: string; kind: string }) => {
			if (seen.has(document.id)) {
				return;
			}
			seen.add(document.id);
			documents.push(document);
		};

		[...getSessionSections(session)].reverse().forEach((section) => {
			switch (section.type) {
				case "report":
					addDocument({
						id: `report:${section.reportId}`,
						title: section.title,
						kind: getArtifactReportKind(section.reportType),
					});
					break;
				case "image_concepts":
					addDocument({
						id: `image:${section.itemId}`,
						title: `Image concepts for ${section.itemName}`,
						kind: "Creative document",
					});
					break;
				case "video_concepts":
					addDocument({
						id: `video:${section.itemId}`,
						title: `Video scripts for ${section.itemName}`,
						kind: "Creative document",
					});
					break;
				default:
					break;
			}
		});

		return documents;
	};

	const renderGeneratedDocuments = (generatedDocuments: Array<{ id: string; title: string; kind: string }>) => {
		if (generatedDocuments.length === 0) {
			return null;
		}

		const visibleDocuments = generatedDocuments.slice(0, 3);
		const hiddenCount = generatedDocuments.length - visibleDocuments.length;

		return (
			<div className="home-generated-documents">
				<div className="home-generated-documents-list">
					{visibleDocuments.map((document) => (
						<div key={document.id} className="home-generated-document">
							<span className="home-generated-document-icon">
								<FileText size={14} />
							</span>
							<span className="home-generated-document-copy">
								<strong>{document.title}</strong>
								<span>{document.kind}</span>
							</span>
						</div>
					))}
					{hiddenCount > 0 && <div className="home-generated-document-more">+{hiddenCount} more</div>}
				</div>
			</div>
		);
	};

	const renderSummaryArtifacts = (summary: RunSummary, generatedDocuments: Array<{ id: string; title: string; kind: string }>) => {
		if (summary.imageUrls.length === 0 && generatedDocuments.length === 0) {
			return null;
		}

		return (
			<div className="home-summary-artifacts">
				{renderSummaryImages(summary)}
				{renderGeneratedDocuments(generatedDocuments)}
			</div>
		);
	};

	const getCreativeTags = (creative: SummaryCreative) => creative.tags.filter(Boolean).slice(0, 4);

	const getCreativeScriptSections = (creative: SummaryCreative) => {
		const sections = creative.scriptSections?.filter((section) => section.narration) ?? [];
		if (sections.length > 0) {
			return sections.slice(0, 3);
		}

		const fallbackLabels = ["Hook", "Problem / Desire", "Solution"];
		const narrations = creative.scriptNarrations?.filter(Boolean) ?? [];
		const lines = narrations.length > 0 ? narrations.slice(0, 3) : [creative.scriptPreview || creative.description || "Video script concept"];
		return lines.map((narration, index) => ({
			label: fallbackLabels[index] ?? `Beat ${index + 1}`,
			narration,
		}));
	};

	const renderSummaryCreative = (creative: SummaryCreative) => {
		if (creative.format === "video") {
			return (
				<div key={creative.id} className="home-summary-creative-card is-video-script">
					<div className="home-summary-script-card-header">
						<strong>{creative.title}</strong>
						<span>Script</span>
					</div>
					<div className="home-summary-script-lines">
						{getCreativeScriptSections(creative).map((section, index) => (
							<div key={`${creative.id}-line-${index}`} className="home-summary-script-line">
								<span>{section.label}</span>
								<p>{section.narration}</p>
							</div>
						))}
					</div>
					{getCreativeTags(creative).length > 0 && (
						<div className="home-summary-creative-tags">
							{getCreativeTags(creative).map((tag) => (
								<span key={tag}>{tag}</span>
							))}
						</div>
					)}
				</div>
			);
		}

		return (
			<div key={creative.id} className="home-summary-creative-card">
				<div className="home-summary-creative-preview">
					{creative.imageUrl ? <img src={creative.imageUrl} alt="" loading="lazy" /> : <Sparkles size={20} />}
				</div>
				<div className="home-summary-creative-copy">
					<div>
						<strong>{creative.title}</strong>
					</div>
					{getCreativeTags(creative).length > 0 && (
						<div className="home-summary-creative-tags">
							{getCreativeTags(creative).map((tag) => (
								<span key={tag}>{tag}</span>
							))}
						</div>
					)}
				</div>
			</div>
		);
	};

	const getSummaryCreativeGridClassName = (creatives: SummaryCreative[] = []) =>
		`home-summary-creatives ${creatives.some((creative) => creative.format === "video") ? "is-script-grid" : ""}`;

	const getRunningSessionPlan = (session: Session) => {
		for (let index = session.streamingSections.length - 1; index >= 0; index -= 1) {
			const section = session.streamingSections[index];
			if (section.type === "plan") {
				return {
					...section,
					tasks: session.planTaskStates[section.planId] ?? section.tasks,
				};
			}
		}

		return null;
	};

	const getRunningSessionActivity = (session: Session) => {
		for (let index = session.streamingSections.length - 1; index >= 0; index -= 1) {
			const section = session.streamingSections[index];
			switch (section.type) {
				case "text":
					return section.content.replace(/\s+/g, " ").trim();
				case "report":
					return `Drafted ${section.title}`;
				case "focused_items":
					return `Selected ${section.items.length} focus items for deeper analysis`;
				case "image_concepts":
					return `Generating image concepts for ${section.itemName}`;
				case "video_concepts":
					return `Drafting video concepts for ${section.itemName}`;
				case "integration_result":
					return section.actionStatus === "connection_required" ? `${section.integrationName} connection required` : section.title;
				default:
					break;
			}
		}

		return "Planning the work and gathering context";
	};

	const getRunningSessionFeed = (session: Session) => {
		const feedItems: Array<{ id: string; label: string; text: string }> = [];

		session.streamingSections.forEach((section, index) => {
			switch (section.type) {
				case "text": {
					const text = section.content.replace(/\s+/g, " ").trim();
					if (text) {
						feedItems.push({ id: `text-${index}`, label: "Update", text });
					}
					break;
				}
				case "report":
					feedItems.push({ id: `report-${section.reportId}`, label: "Document", text: `Drafted ${section.title}` });
					break;
				case "focused_items":
					feedItems.push({ id: `focus-${index}`, label: "Selection", text: `Selected ${section.items.length} items for deeper analysis` });
					break;
				case "image_concepts":
					feedItems.push({ id: `images-${section.itemId}`, label: "Creative", text: `Prepared image concepts for ${section.itemName}` });
					break;
				case "video_concepts":
					feedItems.push({ id: `videos-${section.itemId}`, label: "Creative", text: `Prepared video scripts for ${section.itemName}` });
					break;
				case "integration_result":
					if (section.isBlocking) {
						break;
					}
					feedItems.push({ id: `integration-${section.resultId}`, label: section.mode === "action" ? "Action" : "Source", text: section.title });
					break;
				default:
					break;
			}
		});

		return feedItems.slice(-4);
	};

	const getRunningSessionImages = (session: Session) => {
		const urls: string[] = [];
		const pushUrl = (value?: string) => {
			if (value && !urls.includes(value)) {
				urls.push(value);
			}
		};

		session.streamingSections.forEach((section) => {
			switch (section.type) {
				case "report":
					pushUrl(section.itemData?.thumbnail);
					break;
				case "focused_items":
					section.items.forEach((item) => pushUrl(item.thumbnail));
					break;
				case "image_concepts":
					section.concepts.forEach((concept) => pushUrl(concept.imageDataUrl));
					break;
				default:
					break;
			}
		});

		return urls.slice(0, 6);
	};

	const renderRunningImages = (imageUrls: string[]) => {
		if (imageUrls.length === 0) {
			return null;
		}

		return (
			<div className="home-running-message-images" aria-label="Current creative previews">
				{imageUrls.slice(0, 4).map((imageUrl, index) => (
					<img key={`${imageUrl}-${index}`} className="home-running-thumbnail" src={imageUrl} alt="" loading="lazy" />
				))}
			</div>
		);
	};

	const renderHomeCardActions = (sessionId: string, options: { showSetupAutomation?: boolean } = {}) => {
		const showSetupAutomation = options.showSetupAutomation ?? true;

		return (
		<div className="home-insight-card-actions">
			{showSetupAutomation && onSetupAutomation && (
				<button type="button" className="home-automation-setup-btn" onClick={onSetupAutomation}>
					<Clock size={15} />
					<span>Setup Automation</span>
				</button>
			)}
			<button type="button" className="home-insight-view-btn" onClick={() => onSessionSelect(sessionId)}>
				View Details
			</button>
		</div>
		);
	};

	const renderRunningSessionCard = (session: Session) => {
		const plan = getRunningSessionPlan(session);
		const tasks = plan?.tasks ?? [];
		const completedCount = tasks.filter((task) => task.status === "completed").length;
		const progressPercent = tasks.length > 0 ? Math.max(8, Math.round((completedCount / tasks.length) * 100)) : 8;
		const activeTask = tasks.find((task) => task.status === "running") ?? tasks.find((task) => task.status === "pending") ?? tasks[tasks.length - 1];
		const activity = getRunningSessionActivity(session);
		const imageUrls = getRunningSessionImages(session);
		const feedItems = getRunningSessionFeed(session);
		const blockingIntegration = getBlockingIntegrationResult(session);
		const activeTaskNumber = activeTask ? tasks.findIndex((task) => task.id === activeTask.id) + 1 : 0;
		const activeToolName = activeTask?.tool.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase()) ?? "Planning";

		return (
			<article key={session.id} className="home-insight-card is-running">
				<div className="home-insight-card-header">
					<div>
						<h3>{session.title}</h3>
					</div>
					{renderHomeCardActions(session.id, { showSetupAutomation: false })}
				</div>

				{blockingIntegration && renderConnectionRequiredCard(session, blockingIntegration)}

				<div className="home-running-progress-shell" aria-label={`${completedCount} of ${tasks.length || 1} steps complete`}>
					<div className="home-running-progress-fill" style={{ width: `${progressPercent}%` }} />
				</div>

				<div className={`home-running-current-step ${activeTask?.status ?? "running"}`}>
					<span className="home-running-live-dot" />
					<span className="home-running-current-step-copy">
						<strong>
							{activeTaskNumber > 0 ? `Step ${activeTaskNumber} of ${tasks.length}` : "Current step"} · {activeToolName}
						</strong>
						<span>{activeTask?.description ?? activity}</span>
					</span>
				</div>

				<div className="home-running-feed" aria-label="Live task messages">
					<div key={session.lastActivityAt} className="home-running-feed-list">
						{feedItems.length > 0 ? (
							feedItems.map((item) => (
								<div key={item.id} className="home-running-feed-item">
									<span>{item.label}</span>
									<p>{item.text}</p>
								</div>
							))
						) : (
							<div className="home-running-feed-item">
								<span>Update</span>
								<p>{activity}</p>
							</div>
						)}
					</div>
				</div>

				{renderRunningImages(imageUrls)}
			</article>
		);
	};

	const renderMessage = (msg: Message, index: number) => {
		if (msg.role === "user") {
			return (
				<div key={index} className="message user">
					<div className="message-content">{msg.content}</div>
				</div>
			);
		}

		// Assistant message with new streaming sections format
		if (msg.sections && msg.sections.length > 0) {
			return (
				<div key={index} className="assistant-response">
					<StreamingMessage
						sections={msg.sections}
						planStates={new Map()}
						activeDocumentId={isDocumentPanelOpen ? selectedDocumentId : null}
						onOpenReport={openReportDocument}
						onOpenImageConcept={openImageConceptDocument}
						onOpenVideoConcept={openVideoConceptDocument}
						onRunNextStep={onSendMessage}
						onConnectRequiredIntegration={sessionId ? (integrationId) => onConnectRequiredIntegration?.(sessionId, integrationId) : undefined}
					/>
				</div>
			);
		}

		// Fallback to legacy format (plain text)
		return (
			<div key={index} className="message assistant">
				<MessageContent content={msg.content} dataPool={undefined} />
			</div>
		);
	};

	// Input area component (reusable)
	const renderHomeSelectionRow = (isCompact = false) => {
		const selectableIntegrations = connectedIntegrations.filter((integration) => integration.section === "dataSources");

		return (
			<div className={`home-selection-row ${isCompact ? "compact" : ""}`} aria-label="Home selections">
				<div className={`home-selection-pills ${isCompact ? "compact" : ""}`}>
					{onSelectedIntegrationIdsChange &&
						selectableIntegrations.map((integration) => {
							const isSelected = isIntegrationSelected(integration);
							const displayName = integration.connectedAccountName ?? integration.name;
							return (
								<button
									key={integration.id}
									type="button"
									className={`home-selection-pill home-account-pill ${isCompact ? "compact" : ""} ${isSelected ? "is-selected" : ""}`}
									aria-pressed={isSelected}
									onClick={() => toggleIntegrationSelection(integration)}
								>
									<span className="home-selection-pill-logo">{integration.renderLogo(isCompact ? 14 : 16, isCompact ? "bare" : "default")}</span>
									<span className="home-selection-pill-name">{displayName}</span>
									{isSelected && !isCompact && <Check size={14} />}
								</button>
							);
						})}
					<button
						type="button"
						className={`home-selection-pill integrations-launch-btn ${isCompact ? "compact" : ""}`}
						aria-label="Open integrations"
						title="Open integrations"
						onClick={onOpenIntegrations}
					>
						{isCompact ? (
							<>
								<Plus size={12} />
								<span>Data Source</span>
							</>
						) : (
							<Plus size={16} />
						)}
					</button>
				</div>
			</div>
		);
	};

	const renderComposerDropdown = () =>
		isComposerMenuOpen && (
			<div className="composer-overlay-dropdown">
				{COMPOSER_OVERLAY_ITEMS.map((item) => {
					const Icon = item.icon;
					return (
						<button key={item.id} type="button" className="composer-overlay-item" onClick={() => setIsComposerMenuOpen(false)}>
							<span className="composer-overlay-item-icon">
								<Icon size={16} />
							</span>
							<span>{item.label}</span>
						</button>
					);
				})}
			</div>
		);

	const renderInputArea = (isInline: boolean) => (
		<div className={`chat-input-area ${isInline ? "inline" : "floating"}`}>
			<div className="chat-input-shell">
				{!isInline && displayedPlanSection && displayedPlanTasks.length > 0 && (
					<div className="input-progress-panel">
						<PlanTimeline
							planId={displayedPlanSection.planId}
							agentName={displayedPlanSection.agentName}
							title={displayedPlanSection.title}
							tasks={displayedPlanTasks}
							collapsed={isProgressCollapsed}
							onToggleCollapsed={() => setIsProgressCollapsed((prev) => !prev)}
						/>
					</div>
				)}
				<form onSubmit={handleSubmit} className={`input-wrapper ${isInline ? "inline-home-composer" : ""}`}>
					{isInline && renderHomeSelectionRow(true)}
					<textarea
						ref={inputRef}
						rows={1}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleComposerKeyDown}
						placeholder="Ask me to do anything..."
						disabled={isLoading}
					/>
					<div className="input-toolbar">
						<div className="input-toolbar-left">
							<div className="composer-overlay-menu" ref={composerMenuRef}>
								<button
									type="button"
									className={`composer-plus-btn ${isComposerMenuOpen ? "is-open" : ""}`}
									aria-label="Open composer menu"
									onClick={() => setIsComposerMenuOpen((prev) => !prev)}
								>
									<Plus size={18} />
								</button>
								{renderComposerDropdown()}
							</div>
							{isInline && (
								<button
									type="button"
									className={`composer-plus-btn composer-connections-btn ${isMyConnectionsModalOpen ? "is-open" : ""}`}
									aria-label="Open my connections"
									onClick={() => {
										setIsComposerMenuOpen(false);
										setIsMyConnectionsModalOpen(true);
									}}
								>
									<Plug size={17} />
								</button>
							)}
						</div>
						<div className="input-toolbar-right">
							<button type="submit" disabled={isLoading || !input.trim()} className="send-btn">
								<ArrowUp size={18} color="white" />
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	);

	const renderHomeFixedComposer = () => (
		<div className="home-fixed-composer-area">
			<form className="home-fixed-composer" onSubmit={handleHomeFixedSubmit}>
				<div className="composer-overlay-menu home-fixed-attachment-menu" ref={composerMenuRef}>
					<button
						type="button"
						className={`home-fixed-attachment-btn ${isComposerMenuOpen ? "is-open" : ""}`}
						aria-label="Attach files"
						title="Attach files"
						onClick={() => setIsComposerMenuOpen((prev) => !prev)}
					>
						<Paperclip size={18} />
					</button>
					{renderComposerDropdown()}
				</div>
				<textarea
					ref={inputRef}
					rows={1}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleHomeFixedComposerKeyDown}
					placeholder="Ask Raya to do anything..."
					disabled={isLoading}
				/>
				<button type="submit" className="home-fixed-send-btn" disabled={isLoading || !input.trim()} aria-label="Send message">
					<ArrowUp size={18} />
				</button>
			</form>
		</div>
	);

	const renderHomeBrandContextCard = () => (
		<div className="home-brand-context-row">
			<button type="button" className="home-brand-context-card" onClick={onOpenBrandContext}>
				<div className="home-brand-context-main">
					<BrandLogoMark
						markText={activeBrandPrimaryLogo?.markText ?? activeBrand.charAt(0)}
						imageUrl={activeBrandPrimaryLogo?.imageUrl}
						size="lg"
						label={`${activeBrand} logo`}
					/>
					<div className="home-brand-context-copy">
						<strong>{activeBrand}</strong>
						<span>{activeBrandContext.shortDescriptor}</span>
					</div>
				</div>
				<div className="home-brand-context-score">
					<span>Context score</span>
					<div className="home-brand-context-ring" style={{ ["--brand-context-progress" as any]: `${brandContextScore}%` }}>
						<div className="home-brand-context-ring-value" aria-label={`Brand context score ${brandContextScore}`}>
							<span className="home-brand-context-ring-number">{brandContextScore}</span>
						</div>
					</div>
				</div>
			</button>
		</div>
	);

	return (
		<div className={`chat-interface ${isDocumentPanelOpen && selectedDocument ? "has-document-panel" : ""}`}>
			<div className="chat-primary-column">
				{headerContent && !isEmptyState && <div className="chat-interface-header">{headerContent}</div>}
				{isEmptyState ? (
					<>
						<div className="empty-state-container" ref={emptyStateRef}>
							{renderHomeBrandContextCard()}

							<section className="home-recommended-section" aria-label="Recommended tasks">
							<div className="home-section-header">
								<div>
									<h2>What to do next</h2>
								</div>
								<div className="home-carousel-controls" aria-label="Recommended task carousel controls">
									<button type="button" onClick={() => scrollRecommendedTasks("left")} aria-label="Scroll recommended tasks left">
										<ChevronLeft size={18} />
									</button>
									<button type="button" onClick={() => scrollRecommendedTasks("right")} aria-label="Scroll recommended tasks right">
										<ChevronRight size={18} />
									</button>
								</div>
							</div>
							<div className="home-task-carousel" ref={taskCarouselRef}>
								{RECOMMENDED_HOME_TASKS.map((task) => {
									const Icon = RECOMMENDED_TASK_ICONS[task.icon];
									return (
										<button key={task.id} type="button" className="home-task-card" onClick={() => runHomeTask(task.prompt)}>
											<span className="home-task-card-watermark" aria-hidden="true">
												<Icon size={112} strokeWidth={1.35} />
											</span>
											<span className="home-task-card-icon">
												<Icon size={20} />
											</span>
											<span className="home-task-card-copy">
												<strong>{task.title}</strong>
												<span>{task.description}</span>
											</span>
											<span className="home-task-card-action">
												Run Now
												<ArrowUpRight size={14} />
											</span>
										</button>
									);
								})}
							</div>
							</section>

							<section className="home-latest-insights" aria-label="Latest insights">
							<div className="home-section-header">
								<div>
									<h2>Latest Insights</h2>
								</div>
							</div>

							<div className="home-insights-list">
								{runningHomeSessions.length > 0 && (
									<div className="home-running-task-group">
										<div className="home-running-task-header">
											<div className="home-running-status-label">
												<img src={rayaThinkingGif} alt="" className="home-running-raya-gif" />
												<span className="home-running-status-pill">
													{runningHomeSessions.length} running {runningHomeSessions.length === 1 ? "task" : "tasks"}
												</span>
											</div>
											{runningHomeSessions.length > 1 && (
												<div className="home-carousel-controls home-running-controls" aria-label="Running task controls">
													<span>
														{currentRunningIndex + 1}/{runningHomeSessions.length}
													</span>
													<button type="button" onClick={() => paginateRunningTasks("left")} aria-label="Show previous running task">
														<ChevronLeft size={18} />
													</button>
													<button type="button" onClick={() => paginateRunningTasks("right")} aria-label="Show next running task">
														<ChevronRight size={18} />
													</button>
												</div>
											)}
										</div>
										{renderRunningSessionCard(runningHomeSessions[currentRunningIndex] ?? runningHomeSessions[0])}
									</div>
								)}

								{completedHomeSessions.map((session) => {
									const summary = session.summary;
									if (!summary) {
										return null;
									}
									const generatedDocuments = getGeneratedDocuments(session);
									const layout = summary.layout ?? "default";
									const isCreationLayout = layout === "creation";
									const hasCreationCreatives = isCreationLayout && (summary.creatives?.length ?? 0) > 0;
									const summaryDocuments = isCreationLayout ? [] : generatedDocuments;
									const hasArtifacts = summary.imageUrls.length > 0 || summaryDocuments.length > 0 || hasCreationCreatives;

									return (
										<article key={session.id} className="home-insight-card">
											<div className="home-insight-card-header">
												<div className="home-summary-title-block">
													<h3>{session.title}</h3>
													<span className="home-insight-meta">{formatTaskTimestamp(session.completedAt ?? session.lastActivityAt)}</span>
												</div>
												{renderHomeCardActions(session.id)}
											</div>

											<div className={`home-summary-body ${hasArtifacts ? "" : "without-artifacts"} ${isCreationLayout ? "is-creation" : ""}`}>
												{isCreationLayout ? (
													<>
														{summary.overview && <p className="home-summary-overview">{summary.overview}</p>}
														{hasCreationCreatives ? (
															<div className={getSummaryCreativeGridClassName(summary.creatives)}>
																{summary.creatives?.slice(0, 12).map(renderSummaryCreative)}
															</div>
														) : (
															renderSummaryArtifacts(summary, summaryDocuments)
														)}
													</>
												) : (
													<>
														<div className="home-summary-insights-column">
															{summary.error ? (
																renderSummaryError(summary)
															) : (
																<div className="home-insight-points">
																	{summary.insights.slice(0, 4).map((insight, index) => {
																		const displayInsight = getDisplayInsight(insight, index);
																		return (
																			<div key={`${displayInsight.title}-${displayInsight.description}`} className="home-insight-point">
																				<span className="home-insight-point-emoji" aria-hidden="true">
																					{displayInsight.emoji}
																				</span>
																				<div className="home-insight-point-copy">
																					<h4>{displayInsight.title}</h4>
																					<ReactMarkdown remarkPlugins={[remarkGfm]}>{displayInsight.description}</ReactMarkdown>
																				</div>
																			</div>
																		);
																	})}
																</div>
															)}
														</div>

														{renderSummaryArtifacts(summary, summaryDocuments)}
													</>
												)}
											</div>

											{summary.nextSteps.length > 0 && (
												<div className="home-next-steps">
													<div className="home-next-steps-header">Next steps</div>
													{summary.nextSteps.map((nextStep) => (
														<button
															key={`${nextStep.title}-${nextStep.prompt}`}
															type="button"
															className="home-next-step"
															onClick={() => runHomeTask(nextStep.prompt, session.id)}
														>
															<span className="home-next-step-main">
																<span className="home-next-step-icon" aria-hidden="true">
																	<Sparkles size={21} fill="currentColor" />
																</span>
																<span className="home-next-step-copy">
																	<strong>{nextStep.title}</strong>
																	<span>{nextStep.prompt}</span>
																</span>
															</span>
															<span className="home-next-step-action">
																<span>Run Now</span>
																<ArrowUp size={14} />
															</span>
														</button>
													))}
												</div>
											)}
										</article>
									);
								})}

								{runningHomeSessions.length === 0 && completedHomeSessions.length === 0 && (
									<div className="home-insights-empty">
										<Sparkles size={18} />
										<span>Run a recommended task to create your first insight card.</span>
									</div>
								)}
							</div>
							</section>
						</div>
						{showComposer && renderHomeFixedComposer()}
					</>
				) : (
					<div className="chat-messages-area" ref={chatMessagesAreaRef}>
						<div className="chat-thread-shell">
							{/* Render completed messages */}
							{messages.map((msg, index) => renderMessage(msg, index))}

							{/* Render streaming sections during loading */}
							{isLoading && streamingSections.length > 0 && (
								<div className="assistant-response streaming">
									<StreamingMessage
										sections={streamingSections}
										planStates={planStates}
										activeDocumentId={isDocumentPanelOpen ? selectedDocumentId : null}
										onOpenReport={openReportDocument}
										onOpenImageConcept={openImageConceptDocument}
										onOpenVideoConcept={openVideoConceptDocument}
										onRunNextStep={onSendMessage}
										onConnectRequiredIntegration={sessionId ? (integrationId) => onConnectRequiredIntegration?.(sessionId, integrationId) : undefined}
									/>
								</div>
							)}

							{isLoading && (
								<div className="loading-indicator">
									<AssistantStreamingIndicator phase={streamingPhase} />
								</div>
							)}
						</div>
						{/* Floating input for active chat */}
						{showComposer && renderInputArea(false)}
					</div>
				)}
			</div>
			{isDocumentPanelOpen && selectedDocument && <DocumentPanel document={selectedDocument} onClose={closeDocumentPanel} />}
			<MyConnectionsModal
				isOpen={isMyConnectionsModalOpen}
				connections={myConnections}
				onClose={() => setIsMyConnectionsModalOpen(false)}
				onConnectConnection={onConnectMyConnection}
				onDisconnectConnection={onDisconnectMyConnection}
			/>
		</div>
	);
};

export default ChatInterface;
