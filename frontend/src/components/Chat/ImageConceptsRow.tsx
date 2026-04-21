import React from "react";
import { Image as ImageIcon, AlertCircle } from "lucide-react";
import { ImageConcept } from "../../types";

interface ImageConceptsRowProps {
	itemId: string;
	itemName: string;
	concepts: ImageConcept[];
	activeDocumentId?: string | null;
	onOpenConcept?: (itemId: string, itemName: string, concept: ImageConcept, index: number) => void;
}

const renderThumbnailContent = (concept: ImageConcept) => {
	switch (concept.status) {
		case "pending":
			return (
				<div className="image-concept-thumb-pending">
					<div className="image-concept-thumb-shimmer" />
					<span>Generating concepts...</span>
				</div>
			);
		case "generating":
			return (
				<div className="image-concept-thumb-generating">
					<div className="image-concept-thumb-shimmer" />
					<span>Generating image...</span>
				</div>
			);
		case "done":
			if (concept.imageDataUrl) {
				return <img src={concept.imageDataUrl} alt={concept.concept_name} />;
			}
			return (
				<div className="image-concept-thumb-placeholder">
					<ImageIcon size={20} />
				</div>
			);
		case "failed":
			return (
				<div className="image-concept-thumb-failed">
					<AlertCircle size={18} />
					<span>Failed</span>
				</div>
			);
		default:
			return (
				<div className="image-concept-thumb-placeholder">
					<ImageIcon size={20} />
				</div>
			);
	}
};

const ImageConceptsRow: React.FC<ImageConceptsRowProps> = ({ itemId, itemName, concepts, activeDocumentId, onOpenConcept }) => {
	return (
		<div className="image-concepts-container">
			<div className="image-concepts-header">
				<ImageIcon size={14} />
				<span>Ad Concepts: {itemName}</span>
				<span className="image-concepts-count">{concepts.length} concepts</span>
			</div>
			<div className="image-concepts-row">
				{concepts.map((concept, index) => {
					const documentId = `image:${itemId}:${index}`;
					return (
						<div
							key={documentId}
							className={`image-concept-thumbnail clickable ${activeDocumentId === documentId ? "is-active" : ""}`}
							onClick={() => onOpenConcept?.(itemId, itemName, concept, index)}
							title={concept.concept_name || `Concept ${index + 1}`}
						>
							{renderThumbnailContent(concept)}
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default ImageConceptsRow;
