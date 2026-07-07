import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowUp, BarChart3, ChevronLeft, ChevronRight, Clock, FileText, Heart, Image as ImageIcon, Lightbulb, Paperclip, Plug, Search, Settings, Sparkles, Target } from "lucide-react";
import { HOME2_SECTIONS, Home2Section, Home2SectionId, Home2Task } from "../../home/home2Tasks";
import { FocusedItemCard, RunSummary, Session, StreamedSection, SummaryChart, SummaryCreative, SummaryLayout } from "../../types";
import { getIntegrationDefinitionById } from "../../integrations/catalog";
import { findBrandContext, getBrandContext, getBrandContextPrimaryLogo } from "../../brandContext/catalog";
import BrandLogoMark from "../BrandContext/BrandLogoMark";
import rayaThinkingGif from "../../assets/raya-thinking.gif";

interface Home2PageProps {
	sessions: Session[];
	onRunTask: (
		sectionId: Home2SectionId,
		taskIndex: number,
		prompt: string,
		taskId?: string,
		summaryLayout?: SummaryLayout,
		sourceSessionId?: string
	) => Promise<string | null> | string | null | void;
	onRunComposerMessage: (message: string) => void;
	onSessionSelect: (sessionId: string) => void;
	onConnectRequiredIntegration?: (sessionId: string, integrationId: string) => Promise<void> | void;
	onOpenBrandContext: () => void;
	activeBrand: string;
	isBrandGuidelinesConnected?: boolean;
	surface?: "home2" | "home3";
	layout?: "sections" | "tabs";
	initialTabbedSectionId?: Home2SectionId;
	highlightSectionId?: Home2SectionId;
	singleTaskMode?: {
		sectionId: Home2SectionId;
		taskIndex: number;
		sessionId?: string | null;
		sourceSessionId?: string;
	};
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

const CHART_COLORS = ["#f97316", "#0f172a", "#14b8a6", "#8b5cf6", "#64748b"];
const LINE_CHART_WIDTH = 260;
const LINE_CHART_HEIGHT = 128;
const LINE_CHART_VERTICAL_PADDING = 10;

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

const getSummaryAdCards = (session: Session) => {
	const cards: FocusedItemCard[] = [];
	const seen = new Set<string>();
	const addCard = (card: FocusedItemCard) => {
		if (seen.has(card.id)) {
			return;
		}
		seen.add(card.id);
		cards.push(card);
	};

	[...getSessionSections(session)].reverse().forEach((section) => {
		if (section.type === "focused_items") {
			section.items.forEach(addCard);
			return;
		}

		if (section.type === "report" && section.itemName && section.itemData) {
			addCard({
				id: section.itemId || section.reportId,
				name: section.itemName,
				thumbnail: section.itemData.thumbnail,
				type: "ad",
				displayFormat: section.itemData.displayFormat,
				videoLength: section.itemData.videoLength,
				metrics: section.itemData.metrics,
			});
		}
	});

	return cards;
};

const formatCompactCurrency = (value: number) =>
	new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: "USD",
		notation: value >= 1000 ? "compact" : "standard",
		maximumFractionDigits: value >= 1000 ? 1 : 0,
	}).format(value);

const getAdCardMetrics = (item: FocusedItemCard) =>
	[
		item.metrics.roas !== undefined ? { label: "ROAS", value: `${item.metrics.roas.toFixed(1)}x` } : null,
		item.metrics.spend !== undefined ? { label: "Spend", value: formatCompactCurrency(item.metrics.spend) } : null,
		item.metrics.ctr !== undefined ? { label: "CTR", value: `${item.metrics.ctr.toFixed(1)}%` } : null,
	]
		.filter(Boolean)
		.slice(0, 3) as Array<{ label: string; value: string }>;

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

const renderSummaryError = (summary: RunSummary) => {
	if (!summary.error) {
		return null;
	}

	return (
		<div className="home2-summary-error" role="alert">
			<div className="home2-summary-error-header">
				<AlertTriangle size={18} />
				<div>
					<h4>{summary.error.title}</h4>
					<p>{summary.error.message}</p>
				</div>
			</div>
			{summary.error.details && <p className="home2-summary-error-details">{summary.error.details}</p>}
			{summary.error.rawResponse && (
				<details className="home2-summary-error-raw">
					<summary>Raw summary response</summary>
					<pre>{summary.error.rawResponse}</pre>
				</details>
			)}
		</div>
	);
};

const getSectionSessions = (sessions: Session[], sectionId: Home2SectionId) =>
	sessions
		.filter((session) => {
			return session.home2Run?.sectionId === sectionId;
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

const buildDonutGradient = (points: SummaryChart["points"]) => {
	const total = points.reduce((sum, point) => sum + Math.max(0, point.value), 0);
	if (total <= 0) {
		return "conic-gradient(#e2e8f0 0 100%)";
	}

	let cursor = 0;
	const segments = points.map((point, index) => {
		const start = cursor;
		cursor += (Math.max(0, point.value) / total) * 100;
		return `${CHART_COLORS[index % CHART_COLORS.length]} ${start}% ${cursor}%`;
	});

	return `conic-gradient(${segments.join(", ")})`;
};

const getChartSeries = (chart: SummaryChart) => {
	const series = chart.series?.filter((item) => item.points.length > 0) ?? [];
	return series.length > 0 ? series : [{ label: chart.unit || chart.title, points: chart.points }];
};

const getChartRange = (series: ReturnType<typeof getChartSeries>) => {
	const values = series.flatMap((item) => item.points.map((point) => point.value));
	return {
		max: Math.max(...values, 1),
		min: Math.min(...values, 0),
	};
};

const getLinePath = (points: SummaryChart["points"], min: number, max: number) => {
	if (points.length === 0) {
		return "";
	}

	const range = Math.max(max - min, 1);

	return points
		.map((point, index) => {
			const x = points.length === 1 ? LINE_CHART_WIDTH / 2 : (index / (points.length - 1)) * LINE_CHART_WIDTH;
			const y =
				LINE_CHART_HEIGHT -
				((point.value - min) / range) * (LINE_CHART_HEIGHT - LINE_CHART_VERTICAL_PADDING * 2) -
				LINE_CHART_VERTICAL_PADDING;
			return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
		})
		.join(" ");
};

const getCreativeTags = (creative: SummaryCreative) => creative.tags.filter(Boolean).slice(0, 4);

const Home2Page: React.FC<Home2PageProps> = ({
	sessions,
	onRunTask,
	onRunComposerMessage,
	onSessionSelect,
	onConnectRequiredIntegration,
	onOpenBrandContext,
	activeBrand,
	isBrandGuidelinesConnected = false,
	layout = "sections",
	initialTabbedSectionId,
	highlightSectionId,
	singleTaskMode,
}) => {
	const [summaryPageBySection, setSummaryPageBySection] = useState<Record<Home2SectionId, number>>({
		"competitor-intelligence": 0,
		"ad-performance": 0,
		"new-concepts": 0,
	});
	const [activeTabbedSectionId, setActiveTabbedSectionId] = useState<Home2SectionId>(initialTabbedSectionId ?? "competitor-intelligence");
	const [showHighlightedSectionTooltip, setShowHighlightedSectionTooltip] = useState(Boolean(highlightSectionId));
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
	const brandContextScore = explicitBrandContext ? (isBrandGuidelinesConnected ? 100 : 68) : 0;

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
		if (initialTabbedSectionId) {
			setActiveTabbedSectionId(initialTabbedSectionId);
		}
	}, [initialTabbedSectionId]);

	useEffect(() => {
		setShowHighlightedSectionTooltip(Boolean(highlightSectionId));
	}, [highlightSectionId]);

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
							onClick={() => {
								setActiveTabbedSectionId(section.id);
								if (section.id === highlightSectionId) {
									setShowHighlightedSectionTooltip(false);
								}
							}}
						>
							<span className="home2-tab-icon">
								<SectionIcon size={17} />
							</span>
							<span>{section.title}</span>
							{showHighlightedSectionTooltip && highlightSectionId === section.id && (
								<span className="home3-tab-tooltip" role="status">
									Unlock more tasks here when you are ready.
								</span>
							)}
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

	const renderTaskCard = (section: Home2Section, task: Home2Task, taskIndex: number, sourceSessionId?: string) => {
		return (
			<button
				type="button"
				className="home2-task-card"
				onClick={() => onRunTask(section.id, taskIndex, task.prompt, task.id, task.summaryLayout, sourceSessionId)}
			>
				<span className="home2-task-watermark" aria-hidden="true">
					<Target size={156} strokeWidth={1.45} />
				</span>
				<span className="home2-task-copy">
					<strong>{task.title}</strong>
					<span>{task.description}</span>
					<span className="home2-task-frequency-tag">Weekly</span>
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

		const nextStep = summary.nextSteps[0];

		return (
			<div className="home2-next-steps">
				<button
					type="button"
					className="home2-next-step-card"
					onClick={() => onRunTask(section.id, section.tasks.length, nextStep.prompt, `generated-${summarySessionId}-0`, undefined, summarySessionId)}
				>
					<span className="home2-next-step-icon" aria-hidden="true">
						<Sparkles size={22} fill="currentColor" />
					</span>
					<span className="home2-next-step-copy">
						<strong>{nextStep.title}</strong>
						<span>{nextStep.prompt}</span>
					</span>
					<span className="home2-next-step-action">
						<span>Run Now</span>
						<ArrowUp size={14} />
					</span>
				</button>
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
					</div>
					<button type="button" className="home2-view-details-btn" onClick={() => onSessionSelect(session.id)}>
						View Details
					</button>
				</div>

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

				{!blockingIntegration && (
					<span className="home2-run-meta home2-running-status-meta">
						<img src={rayaThinkingGif} alt="" />
						Running now
					</span>
				)}

				{blockingIntegration && renderConnectionRequiredCard(session, blockingIntegration)}
			</article>
		);
	};

	const renderSummaryChart = (chart: SummaryChart) => {
		const total = chart.points.reduce((sum, point) => sum + point.value, 0);
		const chartSeries = getChartSeries(chart);
		const chartRange = getChartRange(chartSeries);
		const maxBarValue = Math.max(...chart.points.map((point) => point.value), 1);

		return (
			<div key={chart.id} className={`home2-summary-chart-card is-${chart.type}`}>
				<div className="home2-summary-chart-title">
					<strong>{chart.title}</strong>
					{chart.unit && <span>{chart.unit}</span>}
				</div>
				{chart.type === "line" ? (
					<div className="home2-line-chart" aria-label={chart.title}>
						<svg viewBox={`0 0 ${LINE_CHART_WIDTH} ${LINE_CHART_HEIGHT}`} role="img">
							{chartSeries.map((series, seriesIndex) => {
								const color = series.color || CHART_COLORS[seriesIndex % CHART_COLORS.length];
								return (
									<g key={series.label}>
										<path
											d={getLinePath(series.points, chartRange.min, chartRange.max)}
											fill="none"
											stroke={color}
											strokeWidth="3"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
										{series.points.map((point, index) => {
											const range = Math.max(chartRange.max - chartRange.min, 1);
											const x = series.points.length === 1 ? LINE_CHART_WIDTH / 2 : (index / (series.points.length - 1)) * LINE_CHART_WIDTH;
											const y =
												LINE_CHART_HEIGHT -
												((point.value - chartRange.min) / range) * (LINE_CHART_HEIGHT - LINE_CHART_VERTICAL_PADDING * 2) -
												LINE_CHART_VERTICAL_PADDING;
											return <circle key={`${series.label}-${point.label}-${index}`} cx={x} cy={y} r="3.4" fill={color} />;
										})}
									</g>
								);
							})}
						</svg>
							<div className="home2-line-chart-meta">
								<div className="home2-line-chart-labels">
									{chartSeries[0]?.points.slice(0, 4).map((point) => (
										<span key={point.label}>{point.label}</span>
									))}
								</div>
							<div className="home2-chart-series-legend">
								{chartSeries.slice(0, 4).map((series, index) => (
									<span key={series.label}>
										<i style={{ background: series.color || CHART_COLORS[index % CHART_COLORS.length] }} />
										{series.label}
									</span>
								))}
							</div>
						</div>
					</div>
				) : chart.type === "bar" ? (
					<div className="home2-bar-chart" aria-label={chart.title}>
						{chart.points.slice(0, 5).map((point, index) => (
							<div key={`${point.label}-${index}`} className="home2-bar-chart-row">
								<span>{point.label}</span>
								<div className="home2-bar-chart-track">
									<i
										style={{
											width: `${Math.max(8, Math.round((point.value / maxBarValue) * 100))}%`,
											background: CHART_COLORS[index % CHART_COLORS.length],
										}}
									/>
								</div>
								<em>{point.value}</em>
							</div>
						))}
					</div>
				) : (
					<div className="home2-donut-chart-wrap">
						<div className="home2-donut-chart" style={{ background: buildDonutGradient(chart.points) }}>
							<span>{Math.round(total)}</span>
						</div>
						<div className="home2-chart-legend">
							{chart.points.map((point, index) => (
								<div key={`${point.label}-${index}`} className="home2-chart-legend-item">
									<span style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
									<strong>{point.label}</strong>
									<em>{point.value}</em>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		);
	};

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
				<div key={creative.id} className="home2-summary-creative-card is-video-script">
					<div className="home2-summary-script-card-header">
						<strong>{creative.title}</strong>
						<span>Script</span>
					</div>
					<div className="home2-summary-script-lines">
						{getCreativeScriptSections(creative).map((section, index) => (
							<div key={`${creative.id}-line-${index}`} className="home2-summary-script-line">
								<span>{section.label}</span>
								<p>{section.narration}</p>
							</div>
						))}
					</div>
					{getCreativeTags(creative).length > 0 && (
						<div className="home2-summary-creative-tags">
							{getCreativeTags(creative).map((tag) => (
								<span key={tag}>{tag}</span>
							))}
						</div>
					)}
				</div>
			);
		}

		return (
			<div key={creative.id} className="home2-summary-creative-card">
				<div className="home2-summary-creative-preview">
					{creative.imageUrl ? <img src={creative.imageUrl} alt="" loading="lazy" /> : <Sparkles size={20} />}
				</div>
				<div className="home2-summary-creative-copy">
					<div>
						<strong>{creative.title}</strong>
					</div>
					{getCreativeTags(creative).length > 0 && (
						<div className="home2-summary-creative-tags">
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
		`home2-summary-creatives ${creatives.some((creative) => creative.format === "video") ? "is-script-grid" : ""}`;

	const renderSummaryAdCard = (item: FocusedItemCard) => {
		const metrics = getAdCardMetrics(item);
		return (
			<div key={`ad-${item.id}`} className="home2-summary-ad-card">
				<div className="home2-summary-ad-thumb">
					{item.thumbnail ? <img src={item.thumbnail} alt="" loading="lazy" /> : <ImageIcon size={20} />}
					{item.displayFormat && <span>{item.displayFormat}</span>}
				</div>
				<div className="home2-summary-ad-copy">
					<strong>{item.name}</strong>
					{metrics.length > 0 && (
						<div className="home2-summary-ad-metrics">
							{metrics.map((metric) => (
								<span key={metric.label}>
									<em>{metric.label}</em>
									{metric.value}
								</span>
							))}
						</div>
					)}
				</div>
			</div>
		);
	};

	const renderFocusAdGrid = (session: Session) => {
		const adCards = getSummaryAdCards(session);

		if (adCards.length === 0) {
			return null;
		}

		return (
			<div className="home2-summary-visual-grid">
				{adCards.map(renderSummaryAdCard)}
			</div>
		);
	};

	const renderSummaryArtifacts = (summary: RunSummary, session: Session) => {
		const layout = summary.layout ?? "default";
		const isInsightLayout = layout === "analysis" || layout === "default";
		const charts = layout === "analysis" ? summary.charts ?? [] : [];
		const creatives = layout === "creation" ? summary.creatives ?? [] : [];
		const imageUrls = summary.imageUrls.slice(0, 4);
		const allGeneratedDocuments = getGeneratedDocuments(session);
		const generatedDocuments = layout === "creation" || isInsightLayout ? [] : allGeneratedDocuments.slice(0, 3);
		const remainingDocumentCount = Math.max(0, allGeneratedDocuments.length - generatedDocuments.length);
		const focusAdCards = isInsightLayout ? getSummaryAdCards(session) : [];
		const hasImageArtifacts = !isInsightLayout && imageUrls.length > 0;
		if (charts.length === 0 && creatives.length === 0 && !hasImageArtifacts && generatedDocuments.length === 0 && focusAdCards.length === 0) {
			return null;
		}

		return (
			<div className="home2-summary-artifacts">
				{charts.length > 0 && <div className="home2-summary-charts">{charts.slice(0, 3).map(renderSummaryChart)}</div>}
				{isInsightLayout && renderFocusAdGrid(session)}
				{!isInsightLayout && (layout !== "creation" || creatives.length === 0) && imageUrls.length > 0 && (
					<div className="home2-summary-images">
						{imageUrls.map((imageUrl, index) => (
							<div key={`${imageUrl}-${index}`} className="home2-summary-image">
								<img src={imageUrl} alt="" loading="lazy" />
							</div>
						))}
					</div>
				)}
				{creatives.length > 0 && <div className={getSummaryCreativeGridClassName(creatives)}>{creatives.slice(0, 12).map(renderSummaryCreative)}</div>}
				{!isInsightLayout && generatedDocuments.length > 0 && (
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
						{remainingDocumentCount > 0 && (
							<div className="home2-document-more">+{remainingDocumentCount} more</div>
						)}
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
		const layout = summary.layout ?? "default";
		const isCreationLayout = layout === "creation";
		const isInsightLayout = layout === "analysis" || layout === "default";
		const focusAdCardCount = isInsightLayout ? getSummaryAdCards(session).length : 0;
		const documentArtifactCount = isCreationLayout || isInsightLayout ? 0 : getGeneratedDocuments(session).length;
		const hasImageArtifacts = !isInsightLayout && summary.imageUrls.length > 0;
		const hasArtifacts =
			hasImageArtifacts ||
			documentArtifactCount > 0 ||
			(summary.charts?.length ?? 0) > 0 ||
			(summary.creatives?.length ?? 0) > 0 ||
			focusAdCardCount > 0;

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

				<div
					className={`home2-summary-body ${hasArtifacts ? "" : "without-artifacts"} ${isInsightLayout ? "is-insight-layout" : ""} ${
						layout === "analysis" ? "is-analysis" : ""
					} ${isCreationLayout ? "is-creation" : ""}`}
				>
					{isCreationLayout ? (
						<>
							{summary.overview && <p className="home2-summary-overview">{summary.overview}</p>}
							{renderSummaryArtifacts(summary, session)}
						</>
					) : (
						<>
							<div className="home2-summary-insights">
								{summary.error ? (
									renderSummaryError(summary)
								) : (
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
								)}
							</div>

							{renderSummaryArtifacts(summary, session)}
						</>
					)}
				</div>
			</article>
		);
	};

	const renderSection = (section: Home2Section) => {
		const isTabbedLayout = layout === "tabs";
		const SectionIcon = SECTION_ICONS[section.id];
		const sectionSessions = getSectionSessions(sessions, section.id);
		const runningSession = sectionSessions.find((session) => session.status === "running") ?? null;
		const completedSessions = sectionSessions.filter((session) => session.status === "completed" && session.summary);
		const safePageIndex = completedSessions.length > 0 ? Math.min(summaryPageBySection[section.id] ?? 0, completedSessions.length - 1) : 0;
		const selectedSummarySession = (isTabbedLayout ? completedSessions[0] : completedSessions[safePageIndex]) ?? null;
		const visibleSummarySessions = isTabbedLayout ? completedSessions : selectedSummarySession ? [selectedSummarySession] : [];
		const nextPredefinedTaskIndex = runningSession ? null : getNextPredefinedTaskIndex(section, sectionSessions);
		const nextPredefinedTask = nextPredefinedTaskIndex === null ? null : section.tasks[nextPredefinedTaskIndex];

		return (
			<section key={section.id} className="home2-section" aria-label={section.title}>
				<div className={`home2-section-header ${isTabbedLayout ? "is-home3-description" : ""}`}>
					{isTabbedLayout ? (
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
							? renderTaskCard(section, nextPredefinedTask, nextPredefinedTaskIndex, selectedSummarySession?.id)
							: renderGeneratedNextSteps(section, selectedSummarySession?.summary, selectedSummarySession?.id ?? section.id)}

					{visibleSummarySessions.map((session) => renderSummary(session))}
					{!isTabbedLayout && completedSessions.length > 1 && (
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

	if (singleTaskMode) {
		const singleTaskSection = HOME2_SECTIONS.find((section) => section.id === singleTaskMode.sectionId);
		const singleTask = singleTaskSection?.tasks[singleTaskMode.taskIndex];
		const singleTaskSession = singleTaskMode.sessionId ? sessions.find((session) => session.id === singleTaskMode.sessionId) : null;

		return (
			<div className="home2-single-task-host">
				{singleTaskSession
					? singleTaskSession.status === "completed" && singleTaskSession.summary
						? renderSummary(singleTaskSession)
						: renderRunningSession(singleTaskSession)
					: singleTaskSection && singleTask
						? renderTaskCard(singleTaskSection, singleTask, singleTaskMode.taskIndex, singleTaskMode.sourceSessionId)
						: null}
			</div>
		);
	}

	return (
		<div className={`home2-page ${layout === "tabs" ? "is-home3" : ""}`}>
			{renderHomeBrandContextCard()}
			{renderSectionTabs()}
			{visibleSections.map(renderSection)}
			{renderHomeFixedComposer()}
		</div>
	);
};

export default Home2Page;
