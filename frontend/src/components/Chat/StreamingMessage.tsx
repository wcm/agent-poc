import React from "react";
import { StreamedSection, PlanTask } from "../../types";
import TextSection from "./TextSection";
import PlanTimeline from "./PlanTimeline";
import ReportCard from "./ReportCard";
import FocusedItemsGrid from "./FocusedItemsGrid";

interface StreamingMessageProps {
	sections: StreamedSection[];
	planStates: Map<string, PlanTask[]>; // Map of planId -> current task states
	hidePlan?: boolean; // Whether to hide plan sections (when shown sticky)
}

/**
 * Render a single section by type
 */
const renderSection = (section: StreamedSection, index: number, planStates: Map<string, PlanTask[]>) => {
	switch (section.type) {
		case "text":
			return <TextSection key={`text-${index}`} content={section.content} />;

		case "report":
			return (
				<ReportCard
					key={`report-${section.reportId}`}
					reportType={section.reportType}
					reportId={section.reportId}
					title={section.title}
					content={section.content}
					itemName={section.itemName}
					itemData={section.itemData}
				/>
			);

		case "focused_items":
			return <FocusedItemsGrid key={`items-${index}`} title="Focus Items" items={section.items} />;

		default:
			return null;
	}
};

/**
 * StreamingMessage renders a collection of streamed sections
 * If a plan exists, renders two-column layout with plan on left, content on right
 */
const StreamingMessage: React.FC<StreamingMessageProps> = ({ sections, planStates, hidePlan = false }) => {
	if (sections.length === 0) {
		return null;
	}

	// Find plan section and separate content sections
	const planSection = sections.find((s) => s.type === "plan");
	const contentSections = sections.filter((s) => s.type !== "plan");

	// If we have a plan and should show it, use two-column layout
	if (planSection && planSection.type === "plan" && !hidePlan) {
		const tasks = planStates.get(planSection.planId) || planSection.tasks;

		return (
			<div className="response-with-plan">
				<div className="plan-column">
					<PlanTimeline planId={planSection.planId} agentName={planSection.agentName} title={planSection.title} tasks={tasks} />
				</div>
				<div className="content-column">{contentSections.map((section, index) => renderSection(section, index, planStates))}</div>
			</div>
		);
	}

	// No plan or plan is hidden - render content normally
	return (
		<div className="response-with-plan">
			<div className="plan-column"></div>
			<div className="content-column">{contentSections.map((section, index) => renderSection(section, index, planStates))}</div>
		</div>
	);
};

export default StreamingMessage;
