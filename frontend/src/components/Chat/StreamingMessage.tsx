import React from "react";
import { ImageConcept, StreamedSection, PlanTask, VideoConcept } from "../../types";
import TextSection from "./TextSection";
import ReportCard from "./ReportCard";
import IntegrationCard from "./IntegrationCard";
import FocusedItemsGrid from "./FocusedItemsGrid";
import ImageConceptsRow from "./ImageConceptsRow";
import VideoConceptsRow from "./VideoConceptsRow";

interface StreamingMessageProps {
	sections: StreamedSection[];
	planStates: Map<string, PlanTask[]>; // Map of planId -> current task states
	activeDocumentId?: string | null;
	onOpenReport?: (section: Extract<StreamedSection, { type: "report" }>) => void;
	onOpenImageConcept?: (itemId: string, itemName: string, concept: ImageConcept, index: number) => void;
	onOpenVideoConcept?: (itemId: string, itemName: string, concept: VideoConcept, index: number) => void;
}

/**
 * Render a single section by type
 */
const renderSection = (
	section: StreamedSection,
	index: number,
	planStates: Map<string, PlanTask[]>,
	activeDocumentId?: string | null,
	onOpenReport?: (section: Extract<StreamedSection, { type: "report" }>) => void,
	onOpenImageConcept?: (itemId: string, itemName: string, concept: ImageConcept, index: number) => void,
	onOpenVideoConcept?: (itemId: string, itemName: string, concept: VideoConcept, index: number) => void
) => {
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
					isActive={activeDocumentId === `report:${section.reportId}`}
					onOpen={() => onOpenReport?.(section)}
				/>
			);

		case "integration_result":
			return (
				<IntegrationCard
					key={`integration-${section.resultId}`}
					resultId={section.resultId}
					integrationId={section.integrationId}
					integrationName={section.integrationName}
					title={section.title}
					status={section.status}
					mode={section.mode}
					content={section.content}
				/>
			);

		case "focused_items":
			return <FocusedItemsGrid key={`items-${index}`} title="Focus Items" items={section.items} />;

		case "image_concepts":
			return (
				<ImageConceptsRow
					key={`img-concepts-${section.itemId}`}
					itemId={section.itemId}
					itemName={section.itemName}
					concepts={section.concepts}
					activeDocumentId={activeDocumentId}
					onOpenConcept={onOpenImageConcept}
				/>
			);

		case "video_concepts":
			return (
				<VideoConceptsRow
					key={`vid-concepts-${section.itemId}`}
					itemId={section.itemId}
					itemName={section.itemName}
					concepts={section.concepts}
					activeDocumentId={activeDocumentId}
					onOpenConcept={onOpenVideoConcept}
				/>
			);

		default:
			return null;
	}
};

const StreamingMessage: React.FC<StreamingMessageProps> = ({ sections, planStates, activeDocumentId, onOpenReport, onOpenImageConcept, onOpenVideoConcept }) => {
	if (sections.length === 0) {
		return null;
	}

	const contentSections = sections.filter((section) => section.type !== "plan");

	return (
		<div className="response-with-plan">
			{contentSections.map((section, index) => renderSection(section, index, planStates, activeDocumentId, onOpenReport, onOpenImageConcept, onOpenVideoConcept))}
		</div>
	);
};

export default StreamingMessage;
