import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, BarChart3, ChevronLeft, ChevronRight, Clock, FileText, Heart, Image as ImageIcon, Lightbulb, Paperclip, Plug, Search, Settings, Sparkles, Target } from "lucide-react";
import { HOME2_SECTIONS, Home2Section, Home2SectionId, Home2Task } from "../../home/home2Tasks";
import { RunSummary, Session, StreamedSection } from "../../types";
import { getIntegrationDefinitionById } from "../../integrations/catalog";
import { findBrandContext, getBrandContext, getBrandContextCompletionScore, getBrandContextPrimaryLogo } from "../../brandContext/catalog";
import BrandLogoMark from "../BrandContext/BrandLogoMark";
import rayaThinkingGif from "../../assets/raya-thinking.gif";

interface Home2PageProps {
	sessions: Session[];
	onRunTask: (sectionId: Home2SectionId, taskIndex: number, prompt: string, taskId?: string) => void;
	onRunComposerMessage: (message: string) => void;
	onSessionSelect: (sessionId: string) => void;
	onConnectRequiredIntegration?: (sessionId: string, integrationId: string) => Promise<void> | void;
	onOpenBrandContext: () => void;
	activeBrand: string;
	surface?: "home2" | "home3";
	layout?: "sections" | "tabs";
}

type IntegrationResultSection = Extract<StreamedSection, { type: "integration_result" }>;
type ReportSection = Extract<StreamedSection, { type: "report" }>;

const SECTION_ICONS: Record<Home2SectionId, React.ElementType> = {
	"competitor-intelligence": Search,
	"ad-performance": BarChart3,
	"new-concepts": Lightbulb,
};

const INSIGHT_FALLBACK_EMOJIS = ["💡", "📈", "🎯", "⚡"];

const COMPOSER_OVERLAY_ITEMS = [
	{ id: "assets", label: "Assets", icon: ImageIcon },
	{ id: "ads", label: "Ads", icon: Sparkles },
	{ id: "reports", label: "Reports", icon: FileText },
	{ id: "following-brand", label: "Following Brand", icon: Heart },
];

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
				return `Prepared image concepts for ${section.itemName}`;
			case "video_concepts":
				return `Prepared video scripts for ${section.itemName}`;
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
				if (!section.isBlocking) {
					feedItems.push({ id: `integration-${section.resultId}`, label: section.mode === "action" ? "Action" : "Source", text: section.title });
				}
				break;
			default:
				break;
		}
	});

	return feedItems.slice(-3);
};

const getDisplayInsight = (insight: RunSummary["insights"][number] | string, index: number) => {
	if (typeof insight === "string") {
		const title = insight
			.replace(/\*\*/g, "")
			.replace(/[`*_~#>-]/g, "")
			.trim()
			.split(/\s+/)
			.slice(0, 10)
			.join(" ");

		return {
			emoji: INSIGHT_FALLBACK_EMOJIS[index % INSIGHT_FALLBACK_EMOJIS.length],
			title: title || "Key Signal",
			description: insight.replace(/\*\*/g, ""),
		};
	}

	return {
		emoji: insight.emoji || INSIGHT_FALLBACK_EMOJIS[index % INSIGHT_FALLBACK_EMOJIS.length],
		title: insight.title || "Key Signal",
		description: (insight.description || "").replace(/\*\*/g, ""),
	};
};

const getSectionSessions = (sessions: Session[], sectionId: Home2SectionId, surface: "home2" | "home3") =>
	sessions
		.filter((session) => {
			if (session.home2Run?.sectionId !== sectionId) {
				return false;
			}

			const sessionSurface = session.home2Run.surface ?? "home2";
			return sessionSurface === surface;
		})
		.sort((a, b) => (b.lastActivityAt ?? b.createdAt) - (a.lastActivityAt ?? a.createdAt));

const getNextPredefinedTaskIndex = (section: Home2Section, sectionSessions: Session[]) => {
	const highestCompletedIndex = sectionSessions.reduce((highestIndex, session) => {
		if (session.status !== "completed") {
			return highestIndex;
		}
		const taskIndex = session.home2Run?.taskIndex;
		if (typeof taskIndex !== "number" || taskIndex >= section.tasks.length) {
			return highestIndex;
		}
		return Math.max(highestIndex, taskIndex);
	}, -1);
	const nextIndex = highestCompletedIndex + 1;
	return nextIndex < section.tasks.length ? nextIndex : null;
};

const Home2Page: React.FC<Home2PageProps> = ({
	sessions,
	onRunTask,
	onRunComposerMessage,
	onSessionSelect,
	onConnectRequiredIntegration,
	onOpenBrandContext,
	activeBrand,
	surface = "home2",
	layout = "sections",
}) => {
	const [summaryPageBySection, setSummaryPageBySection] = useState<Record<Home2SectionId, number>>({
		"competitor-intelligence": 0,
		"ad-performance": 0,
		"new-concepts": 0,
	});
	const [activeTabbedSectionId, setActiveTabbedSectionId] = useState<Home2SectionId>("competitor-intelligence");
	const [input, setInput] = useState("");
	const [isComposerMenuOpen, setIsComposerMenuOpen] = useState(false);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const composerMenuRef = useRef<HTMLDivElement>(null);
	const visibleSections = useMemo(
		() => (layout === "tabs" ? HOME2_SECTIONS.filter((section) => section.id === activeTabbedSectionId) : HOME2_SECTIONS),
		[activeTabbedSectionId, layout]
	);

	const explicitBrandContext = useMemo(() => findBrandContext(activeBrand), [activeBrand]);
	const activeBrandContext = useMemo(() => explicitBrandContext ?? getBrandContext(activeBrand), [activeBrand, explicitBrandContext]);
	const activeBrandPrimaryLogo = useMemo(() => getBrandContextPrimaryLogo(activeBrandContext), [activeBrandContext]);
	const brandContextScore = useMemo(() => (explicitBrandContext ? getBrandContextCompletionScore(explicitBrandContext) : 0), [explicitBrandContext]);

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

	const submitComposerMessage = () => {
		const trimmedInput = input.trim();
		if (!trimmedInput) {
			return;
		}

		onRunComposerMessage(trimmedInput);
		setInput("");
		setIsComposerMenuOpen(false);
	};

	const handleComposerSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		submitComposerMessage();
	};

	const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			submitComposerMessage();
		}
	};

	const renderComposerDropdown = () => {
		if (!isComposerMenuOpen) {
			return null;
		}

		return (
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
	};

	const renderHomeFixedComposer = () => (
		<div className="home-fixed-composer-area">
			<form className="home-fixed-composer" onSubmit={handleComposerSubmit}>
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
					onChange={(event) => setInput(event.target.value)}
					onKeyDown={handleComposerKeyDown}
					placeholder="Ask Raya to do anything..."
				/>
				<button type="submit" className="home-fixed-send-btn" disabled={!input.trim()} aria-label="Send message">
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
						size="xs"
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

	const renderSectionTabs = () => {
		if (layout !== "tabs") {
			return null;
		}

		return (
			<div className="home2-tabs" role="tablist" aria-label="Home-3 sections">
				{HOME2_SECTIONS.map((section) => {
					const SectionIcon = SECTION_ICONS[section.id];
					const isActive = activeTabbedSectionId === section.id;
					return (
						<button
							key={section.id}
							type="button"
							role="tab"
							aria-selected={isActive}
							className={`home2-tab ${isActive ? "is-active" : ""}`}
							onClick={() => setActiveTabbedSectionId(section.id)}
						>
							<span className="home2-tab-icon">
								<SectionIcon size={17} />
							</span>
							<span>{section.title}</span>
						</button>
					);
				})}
			</div>
		);
	};

	const paginateSection = (sectionId: Home2SectionId, total: number, direction: "left" | "right") => {
		if (total <= 1) {
			return;
		}
		setSummaryPageBySection((currentPages) => {
			const currentIndex = currentPages[sectionId] ?? 0;
			const delta = direction === "left" ? -1 : 1;
			return {
				...currentPages,
				[sectionId]: (currentIndex + delta + total) % total,
			};
		});
	};

	const renderConnectionRequiredCard = (session: Session, section: IntegrationResultSection) => {
		const definition = getIntegrationDefinitionById(section.integrationId);
		const integrationName = section.integrationName || definition?.name || section.integrationId;

		return (
			<button
				type="button"
				className="home2-connection-required"
				disabled={!section.canConnect}
				onClick={() => section.canConnect && onConnectRequiredIntegration?.(session.id, section.integrationId)}
			>
				<span className="home2-connection-logo">{definition?.renderLogo(34) ?? <Plug size={18} />}</span>
				<span className="home2-connection-copy">
					<strong>{section.title}</strong>
					<span>{section.content}</span>
				</span>
				<span className="home2-connection-action">{section.canConnect ? `Connect ${integrationName}` : "Not available"}</span>
			</button>
		);
	};

	const renderTaskCard = (section: Home2Section, task: Home2Task, taskIndex: number, label: string) => {
		const isNextDeliverable = label === "Next Deliverable";

		return (
			<button
				type="button"
				className={`home2-task-card ${isNextDeliverable ? "is-next-deliverable" : ""}`}
				onClick={() => onRunTask(section.id, taskIndex, task.prompt, task.id)}
			>
				<span className="home2-task-watermark" aria-hidden="true">
					<Target size={96} strokeWidth={1.6} />
				</span>
				<span className="home2-task-label">{label}</span>
				<span className="home2-task-copy">
					<strong>{task.title}</strong>
					<span>{task.description}</span>
				</span>
				<span className="home2-task-action">
					<span>Unlock Now</span>
					<ArrowUp size={14} />
				</span>
			</button>
		);
	};

	const renderGeneratedNextSteps = (section: Home2Section, summary: RunSummary | undefined, summarySessionId: string) => {
		if (!summary || summary.nextSteps.length === 0) {
			return null;
		}

		return (
			<div className="home2-next-steps">
				<div className="home2-mini-title">Next steps</div>
				{summary.nextSteps.slice(0, 2).map((nextStep, index) => (
					<button
						key={`${summarySessionId}-${nextStep.title}-${index}`}
						type="button"
						className="home2-next-step-card"
						onClick={() => onRunTask(section.id, section.tasks.length + index, nextStep.prompt, `generated-${summarySessionId}-${index}`)}
					>
						<span className="home2-next-step-icon" aria-hidden="true">
							<Sparkles size={22} fill="currentColor" />
						</span>
						<span className="home2-next-step-copy">
							<strong>{nextStep.title}</strong>
							<span>{nextStep.prompt}</span>
						</span>
						<span className="home2-next-step-action">
							<span>Unlock Now</span>
							<ArrowUp size={14} />
						</span>
					</button>
				))}
			</div>
		);
	};

	const renderRunningSession = (session: Session) => {
		const plan = getRunningSessionPlan(session);
		const tasks = plan?.tasks ?? [];
		const completedCount = tasks.filter((task) => task.status === "completed").length;
		const progressPercent = tasks.length > 0 ? Math.max(8, Math.round((completedCount / tasks.length) * 100)) : 8;
		const activeTask = tasks.find((task) => task.status === "running") ?? tasks.find((task) => task.status === "pending") ?? tasks[tasks.length - 1];
		const activeTaskNumber = activeTask ? tasks.findIndex((task) => task.id === activeTask.id) + 1 : 0;
		const activeToolName = activeTask?.tool.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase()) ?? "Planning";
		const activity = getRunningSessionActivity(session);
		const feedItems = getRunningSessionFeed(session);
		const blockingIntegration = getBlockingIntegrationResult(session);

		return (
			<article className="home2-run-card is-running">
				<div className="home2-run-header">
					<div>
						<h3>{session.title}</h3>
						<span className="home2-run-meta">
							<img src={rayaThinkingGif} alt="" />
							Running now
						</span>
					</div>
					<button type="button" className="home2-view-details-btn" onClick={() => onSessionSelect(session.id)}>
						View Details
					</button>
				</div>

				{blockingIntegration && renderConnectionRequiredCard(session, blockingIntegration)}

				<div className="home2-running-progress-shell" aria-label={`${completedCount} of ${tasks.length || 1} steps complete`}>
					<div className="home2-running-progress-fill" style={{ width: `${progressPercent}%` }} />
				</div>

				<div className="home2-running-current-step">
					<span className="home2-running-live-dot" />
					<span className="home2-running-current-step-copy">
						<strong>
							{activeTaskNumber > 0 ? `Step ${activeTaskNumber} of ${tasks.length}` : "Current step"} · {activeToolName}
						</strong>
						<span>{activeTask?.description ?? activity}</span>
					</span>
				</div>

				<div className="home2-running-feed" aria-label="Live task messages">
					{feedItems.length > 0 ? (
						feedItems.map((item) => (
							<div key={item.id} className="home2-running-feed-item">
								<span>{item.label}</span>
								<p>{item.text}</p>
							</div>
						))
					) : (
						<div className="home2-running-feed-item">
							<span>Update</span>
							<p>{activity}</p>
						</div>
					)}
				</div>
			</article>
		);
	};

	const renderSummaryArtifacts = (summary: RunSummary, session: Session) => {
		const imageUrls = summary.imageUrls.slice(0, 4);
		const generatedDocuments = getGeneratedDocuments(session).slice(0, 3);
		if (imageUrls.length === 0 && generatedDocuments.length === 0) {
			return null;
		}

		return (
			<div className="home2-summary-artifacts">
				<div className="home2-mini-title">Artifacts</div>
				{imageUrls.length > 0 && (
					<div className="home2-summary-images">
						{imageUrls.map((imageUrl, index) => (
							<div key={`${imageUrl}-${index}`} className="home2-summary-image">
								<img src={imageUrl} alt="" loading="lazy" />
							</div>
						))}
					</div>
				)}
				{generatedDocuments.length > 0 && (
					<div className="home2-document-list">
						{generatedDocuments.map((document) => (
							<div key={document.id} className="home2-document-item">
								<span className="home2-document-icon">
									<FileText size={14} />
								</span>
								<span className="home2-document-copy">
									<strong>{document.title}</strong>
									<span>{document.kind}</span>
								</span>
							</div>
						))}
					</div>
				)}
			</div>
		);
	};

	const renderSummary = (session: Session) => {
		const summary = session.summary;
		if (!summary) {
			return null;
		}
		const hasArtifacts = summary.imageUrls.length > 0 || getGeneratedDocuments(session).length > 0;

		return (
			<article className="home2-run-card">
				<div className="home2-run-header">
					<div>
						<h3>{session.title}</h3>
						<span className="home2-run-meta home2-summary-run-meta">
							<span>{formatTaskTimestamp(session.completedAt ?? session.lastActivityAt)}</span>
							<span className="home2-run-meta-divider" aria-hidden="true" />
							<span className="home2-scheduled-meta">
								<Clock size={14} />
								<span>Scheduled every Monday 09:00</span>
							</span>
						</span>
					</div>
					<div className="home2-run-actions">
						<button type="button" className="home2-settings-btn" aria-label="Summary settings" title="Summary settings">
							<Settings size={16} />
						</button>
						<button type="button" className="home2-view-details-btn" onClick={() => onSessionSelect(session.id)}>
							View Details
						</button>
					</div>
				</div>

				<div className={`home2-summary-body ${hasArtifacts ? "" : "without-artifacts"}`}>
					<div className="home2-summary-insights">
						<div className="home2-mini-title">Key insights</div>
						<div className="home2-insight-list">
							{summary.insights.slice(0, 4).map((insight, index) => {
								const displayInsight = getDisplayInsight(insight, index);
								return (
									<div key={`${displayInsight.title}-${displayInsight.description}`} className="home2-insight-item">
										<span className="home2-insight-emoji" aria-hidden="true">
											{displayInsight.emoji}
										</span>
										<div className="home2-insight-copy">
											<h4>{displayInsight.title}</h4>
											<p>{displayInsight.description}</p>
										</div>
									</div>
								);
							})}
						</div>
					</div>

					{renderSummaryArtifacts(summary, session)}
				</div>
			</article>
		);
	};

	const renderSection = (section: Home2Section) => {
		const SectionIcon = SECTION_ICONS[section.id];
		const sectionSessions = getSectionSessions(sessions, section.id, surface);
		const runningSession = sectionSessions.find((session) => session.status === "running") ?? null;
		const completedSessions = sectionSessions.filter((session) => session.status === "completed" && session.summary);
		const safePageIndex = completedSessions.length > 0 ? Math.min(summaryPageBySection[section.id] ?? 0, completedSessions.length - 1) : 0;
		const selectedSummarySession = completedSessions[safePageIndex] ?? null;
		const nextPredefinedTaskIndex = runningSession ? null : getNextPredefinedTaskIndex(section, sectionSessions);
		const nextPredefinedTask = nextPredefinedTaskIndex === null ? null : section.tasks[nextPredefinedTaskIndex];

		return (
			<section key={section.id} className="home2-section" aria-label={section.title}>
				<div className={`home2-section-header ${layout === "tabs" ? "is-home3-description" : ""}`}>
					{layout === "tabs" ? (
						<p>{section.description}</p>
					) : (
						<div className="home2-section-title-row">
							<span className="home2-section-icon">
								<SectionIcon size={20} />
							</span>
							<div>
								<h2>{section.title}</h2>
								<p>{section.description}</p>
							</div>
						</div>
					)}
				</div>

				<div className="home2-section-content">
					{runningSession
						? renderRunningSession(runningSession)
						: nextPredefinedTask && nextPredefinedTaskIndex !== null
							? renderTaskCard(section, nextPredefinedTask, nextPredefinedTaskIndex, selectedSummarySession ? "Next Deliverable" : "Start here")
							: renderGeneratedNextSteps(section, selectedSummarySession?.summary, selectedSummarySession?.id ?? section.id)}

					{selectedSummarySession && renderSummary(selectedSummarySession)}
					{completedSessions.length > 1 && (
						<div className="home2-pagination home2-section-pagination" aria-label={`${section.title} summaries`}>
							<button type="button" onClick={() => paginateSection(section.id, completedSessions.length, "left")} aria-label="Previous summary">
								<ChevronLeft size={18} />
							</button>
							<span>
								{safePageIndex + 1}/{completedSessions.length}
							</span>
							<button type="button" onClick={() => paginateSection(section.id, completedSessions.length, "right")} aria-label="Next summary">
								<ChevronRight size={18} />
							</button>
						</div>
					)}
				</div>
			</section>
		);
	};

	return (
		<div className={`home2-page ${layout === "tabs" ? "is-home3" : ""}`}>
			<div className="home2-page-inner">
				{renderHomeBrandContextCard()}
				{renderSectionTabs()}
				{visibleSections.map(renderSection)}
			</div>
			{renderHomeFixedComposer()}
		</div>
	);
};

export default Home2Page;
