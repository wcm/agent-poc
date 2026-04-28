import React, { useRef, useEffect, useState, useCallback, useMemo, useLayoutEffect } from "react";
import { ArrowUp, Sparkles, LucideIcon, Plus, ImageIcon, FileText, Heart, Check, Plug } from "lucide-react";
import { Message, StreamedSection, PlanTask, ImageConcept, VideoConcept } from "../../types";
import StreamingMessage from "./StreamingMessage";
import { MessageContent } from "../../MessageContent";
import PlanTimeline from "./PlanTimeline";
import DocumentPanel, { ChatDocument } from "./DocumentPanel";
import AssistantStreamingIndicator, { AssistantStreamingPhase } from "./AssistantStreamingIndicator";
import { ResolvedIntegration } from "../../integrations/catalog";
import PromptSuggestions from "./PromptSuggestions";
import { PromptLibraryItem } from "./promptLibrary";
import RayaLogo from "../icons/RayaLogo";
import { AutomationDefinition } from "../../automations/catalog";
import AutomationHighlights from "./AutomationHighlights";
import { findBrandContext, getBrandContext, getBrandContextCompletionScore, getBrandContextPrimaryLogo } from "../../brandContext/catalog";
import BrandLogoMark from "../BrandContext/BrandLogoMark";
import MyConnectionsModal from "./MyConnectionsModal";

interface ChatInterfaceProps {
	sessionId: string | null;
	messages: Message[];
	isLoading: boolean;
	streamingSections: StreamedSection[];
	planStates: Map<string, PlanTask[]>;
	onSendMessage: (message: string) => void;
	onOpenIntegrations: () => void;
	onOpenBrandContext: () => void;
	connectedIntegrations: ResolvedIntegration[];
	myConnections: ResolvedIntegration[];
	activeIntegrationId: string | null;
	activeBrand: string;
	selectedIntegrationIds?: string[];
	onSelectedIntegrationIdsChange?: (integrationIds: string[]) => void;
	onConnectMyConnection: (integrationId: string) => Promise<void> | void;
	onDisconnectMyConnection: (integrationId: string) => Promise<void> | void;
	showComposer?: boolean;
	headerContent?: React.ReactNode;
	prefilledInput?: string | null;
	homeAutomations?: AutomationDefinition[];
	onOpenAutomationRun?: (automationId: string, options?: { runId?: string; prefilledInput?: string }) => void;
	onExploreAutomations?: () => void;
}

type PlanSection = Extract<StreamedSection, { type: "plan" }>;
type ReportSection = Extract<StreamedSection, { type: "report" }>;

const getReportDocumentId = (reportId: string) => `report:${reportId}`;

const getImageDocumentId = (itemId: string, index: number) => `image:${itemId}:${index}`;

const getVideoDocumentId = (itemId: string, index: number) => `video:${itemId}:${index}`;

const COMPOSER_OVERLAY_ITEMS: Array<{ id: string; label: string; icon: LucideIcon }> = [
	{ id: "assets", label: "Assets", icon: ImageIcon },
	{ id: "ads", label: "Ads", icon: Sparkles },
	{ id: "reports", label: "Reports", icon: FileText },
	{ id: "following-brand", label: "Following Brand", icon: Heart },
];

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
	messages,
	isLoading,
	streamingSections,
	planStates,
	onSendMessage,
	onOpenIntegrations,
	onOpenBrandContext,
	connectedIntegrations,
	myConnections,
	activeIntegrationId,
	activeBrand,
	selectedIntegrationIds,
	onSelectedIntegrationIdsChange,
	onConnectMyConnection,
	onDisconnectMyConnection,
	showComposer = true,
	headerContent,
	prefilledInput,
	homeAutomations = [],
	onOpenAutomationRun,
	onExploreAutomations,
}) => {
	const [input, setInput] = useState("");
	const [isProgressCollapsed, setIsProgressCollapsed] = useState(true);
	const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
	const [isDocumentPanelOpen, setIsDocumentPanelOpen] = useState(false);
	const [isComposerMenuOpen, setIsComposerMenuOpen] = useState(false);
	const [isMyConnectionsModalOpen, setIsMyConnectionsModalOpen] = useState(false);
	const chatMessagesAreaRef = useRef<HTMLDivElement>(null);
	const initialScrollSessionRef = useRef<string | null>(null);
	const composerMenuRef = useRef<HTMLDivElement>(null);
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
	const brandContextScore = useMemo(() => (explicitBrandContext ? getBrandContextCompletionScore(explicitBrandContext) : 0), [explicitBrandContext]);
	const streamingPhase = useMemo<AssistantStreamingPhase>(() => {
		const hasContentSections = streamingSections.some((section) => section.type !== "plan");
		return hasContentSections ? "writing" : "reasoning";
	}, [streamingSections]);
	const selectedIntegrationIdSet = useMemo(
		() => selectedIntegrationIds ?? (activeIntegrationId ? [activeIntegrationId] : []),
		[activeIntegrationId, selectedIntegrationIds]
	);

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

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || isLoading) return;
		onSendMessage(input);
		setInput("");
	};

	const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			if (!input.trim() || isLoading) {
				return;
			}

			onSendMessage(input);
			setInput("");
		}
	};

	const handlePromptSelect = (item: PromptLibraryItem) => {
		setInput(item.prompt);
		window.requestAnimationFrame(() => {
			resizeComposer();
			inputRef.current?.focus();
		});
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
								{isComposerMenuOpen && (
									<div className="composer-overlay-dropdown">
										{COMPOSER_OVERLAY_ITEMS.map((item) => {
											const Icon = item.icon;
											return (
												<button
													key={item.id}
													type="button"
													className="composer-overlay-item"
													onClick={() => setIsComposerMenuOpen(false)}
												>
													<span className="composer-overlay-item-icon">
														<Icon size={16} />
													</span>
													<span>{item.label}</span>
												</button>
											);
										})}
									</div>
								)}
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

	const renderHomeBrandContextCard = () => (
		<div className="home-brand-context-row">
			<button type="button" className="home-brand-context-card" onClick={onOpenBrandContext}>
				<div className="home-brand-context-main">
					<BrandLogoMark
						markText={activeBrandPrimaryLogo?.markText ?? activeBrand.charAt(0)}
						imageUrl={activeBrandPrimaryLogo?.imageUrl}
						size="xs"
						label={`${activeBrand} logo`}
					/>
					<div className="home-brand-context-copy">
						<strong>{activeBrand}</strong>
						<span>Brand context score</span>
					</div>
				</div>
				<div className="home-brand-context-ring" style={{ ["--brand-context-progress" as any]: `${brandContextScore}%` }}>
					<div className="home-brand-context-ring-value" aria-label={`Brand context score ${brandContextScore}`}>
						<span className="home-brand-context-ring-number">{brandContextScore}</span>
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
					<div className="empty-state-container" ref={emptyStateRef}>
						{renderHomeBrandContextCard()}
						<div className="empty-state-header">
						<div className="empty-state-title-row">
							<RayaLogo size={36} variant="color" className="empty-state-brand-icon" />
							<h2 className="center-brand">What would you like to do?</h2>
						</div>
							<p className="center-brand-subtitle">Trained on insights from 5.4B in ad spend</p>
						</div>
						<div className="home-composer-stack">
							{renderInputArea(true)}
						</div>
						<PromptSuggestions onPromptSelect={handlePromptSelect} />
						{homeAutomations.length > 0 && onOpenAutomationRun && (
							<AutomationHighlights
								automations={homeAutomations}
								onOpenAutomationRun={onOpenAutomationRun}
								onExploreAutomations={onExploreAutomations}
							/>
						)}
					</div>
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
