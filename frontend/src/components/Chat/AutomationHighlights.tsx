import React, { useMemo } from "react";
import { ArrowUp, ArrowUpRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AutomationDefinition, formatHistoryTimestamp } from "../../automations/catalog";
import { getAutomationMockRunById, getLatestAutomationMockRunByAutomationId } from "../../automations/mockRuns";
import { FocusedItemCard, Message, StreamedSection } from "../../types";

interface AutomationHighlightsProps {
	automations: AutomationDefinition[];
	onOpenAutomationRun: (automationId: string, options?: { runId?: string; prefilledInput?: string }) => void;
	onExploreAutomations?: () => void;
}

interface AutomationHighlightCardData {
	automationId: string;
	name: string;
	latestRunTimestamp: string;
	runId: string | null;
	focusItems: FocusedItemCard[];
	summary: string;
	followUps: string[];
}

const FilledSparkleIcon = ({ size = 15 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
		<path d="M8 0.8c0.23 0 0.43 0.15 0.49 0.37l0.95 3.07c0.15 0.49 0.53 0.87 1.02 1.02l3.07 0.95a0.52 0.52 0 0 1 0 0.99l-3.07 0.95a1.5 1.5 0 0 0-1.02 1.02l-0.95 3.07a0.52 0.52 0 0 1-0.99 0l-0.95-3.07a1.5 1.5 0 0 0-1.02-1.02L2.46 7.18a0.52 0.52 0 0 1 0-0.99l3.07-0.95c0.49-0.15 0.87-0.53 1.02-1.02L7.5 1.17A0.52 0.52 0 0 1 8 0.8Z" />
		<path d="M12.9 10.25c0.14 0 0.26 0.09 0.3 0.22l0.39 1.24c0.09 0.29 0.31 0.51 0.6 0.6l1.24 0.39a0.31 0.31 0 0 1 0 0.6l-1.24 0.39a0.89 0.89 0 0 0-0.6 0.6l-0.39 1.24a0.31 0.31 0 0 1-0.6 0l-0.39-1.24a0.89 0.89 0 0 0-0.6-0.6l-1.24-0.39a0.31 0.31 0 0 1 0-0.6l1.24-0.39a0.89 0.89 0 0 0 0.6-0.6l0.39-1.24a0.31 0.31 0 0 1 0.3-0.22Z" />
	</svg>
);

type ReportSection = Extract<StreamedSection, { type: "report" }>;
type FocusedItemsSection = Extract<StreamedSection, { type: "focused_items" }>;

const flattenSections = (messages: Message[]) =>
	messages.reduce<StreamedSection[]>((allSections, message) => {
		if (message.sections) {
			allSections.push(...message.sections);
		}
		return allSections;
	}, []);

const getLatestRunTimestamp = (automation: AutomationDefinition) => {
	const latestHistoryEntry = [...automation.history].sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0];
	return latestHistoryEntry?.timestamp ?? "";
};

const getReportSummary = (sections: StreamedSection[], fallback: string) => {
	const reports = sections.filter((section): section is ReportSection => section.type === "report");
	if (reports.length === 0) {
		return fallback;
	}

	const latestReport =
		[...reports].reverse().find((section) => section.reportType === "common") ??
		reports[reports.length - 1];
	const executiveSummaryMatch = latestReport.content.match(
		/(?:^|\n)#{2,3}\s+(?:\d+\.\s+)?Executive Summary\s*\n([\s\S]*?)(?=\n#{2,3}\s+(?:\d+\.\s+)?[^\n]+|\s*$)/i
	);
	return executiveSummaryMatch?.[1]?.trim() || fallback;
};

const getFocusedItems = (sections: StreamedSection[]) => {
	const latestFocusSection =
		[...sections]
			.reverse()
			.find((section): section is FocusedItemsSection => section.type === "focused_items" && section.items.length > 0) ?? null;

	if (!latestFocusSection) {
		return [];
	}

	return latestFocusSection.items.filter((item) => item.thumbnail).slice(0, 4);
};

const buildHighlightCardData = (automation: AutomationDefinition): AutomationHighlightCardData => {
	const latestHistoryWithRun =
		[...automation.history]
			.sort((left, right) => right.timestamp.localeCompare(left.timestamp))
			.find((entry) => entry.sampleRunId && getAutomationMockRunById(entry.sampleRunId)) ?? null;
	const run =
		(latestHistoryWithRun?.sampleRunId ? getAutomationMockRunById(latestHistoryWithRun.sampleRunId) : null) ??
		getLatestAutomationMockRunByAutomationId(automation.id);
	const latestRunTimestamp = run?.timestamp ?? latestHistoryWithRun?.timestamp ?? getLatestRunTimestamp(automation);

	if (!run) {
		return {
			automationId: automation.id,
			name: automation.name,
			latestRunTimestamp,
			runId: null,
			focusItems: [],
			summary: automation.description,
			followUps: [],
		};
	}

	const sections = flattenSections(run.messages);
	return {
		automationId: automation.id,
		name: automation.name,
		latestRunTimestamp,
		runId: run.id,
		focusItems: getFocusedItems(sections),
		summary: getReportSummary(sections, automation.description),
		followUps: run.followUps || [],
	};
};

const AutomationHighlights: React.FC<AutomationHighlightsProps> = ({ automations, onOpenAutomationRun, onExploreAutomations }) => {
	const cards = useMemo(() => automations.map(buildHighlightCardData), [automations]);

	if (cards.length === 0) {
		return null;
	}

	return (
		<div className="automation-highlights">
			<div className="automation-highlights-grid">
				{cards.map((card) => (
					<div key={card.automationId} className="automation-highlight-card">
						<div className="automation-highlight-card-top">
							<div className="automation-highlight-card-copy">
								<h3>{card.name}</h3>
								<p>{card.latestRunTimestamp ? formatHistoryTimestamp(card.latestRunTimestamp) : "No runs yet"}</p>
							</div>
							<button
								type="button"
								className="automation-highlight-view-btn"
								onClick={() => onOpenAutomationRun(card.automationId, { runId: card.runId ?? undefined })}
							>
								<span>View Details</span>
								<ArrowUpRight size={15} />
							</button>
						</div>

						{card.focusItems.length > 0 && (
							<div className="automation-highlight-thumbnails">
								{card.focusItems.map((item) => (
									<div key={item.id} className="automation-highlight-thumbnail" title={item.name}>
										<img src={item.thumbnail} alt={item.name} loading="lazy" />
									</div>
								))}
							</div>
						)}

						<div className="automation-highlight-summary">
							<ReactMarkdown remarkPlugins={[remarkGfm]}>{card.summary}</ReactMarkdown>
						</div>

						{card.followUps.length > 0 && card.runId && (
							<div className="automation-highlight-followups">
								<div className="automation-highlight-followups-header">Follow-ups</div>
								{card.followUps.map((followUp) => (
									<button
										key={followUp}
										type="button"
										className="automation-highlight-followup-btn"
										onClick={() =>
											onOpenAutomationRun(card.automationId, {
												runId: card.runId ?? undefined,
												prefilledInput: followUp,
											})
										}
									>
										<span className="automation-highlight-followup-copy">
											<FilledSparkleIcon size={15} />
											<span>{followUp}</span>
										</span>
										<ArrowUp size={15} />
									</button>
								))}
							</div>
						)}
					</div>
				))}
			</div>
			{onExploreAutomations && (
				<div className="automation-highlights-footer">
					<button type="button" className="automation-highlights-explore-btn" onClick={onExploreAutomations}>
						Explore More Automations
					</button>
				</div>
			)}
		</div>
	);
};

export default AutomationHighlights;
