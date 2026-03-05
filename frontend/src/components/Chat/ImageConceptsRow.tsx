import React, { useState } from "react";
import { Image as ImageIcon, AlertCircle } from "lucide-react";
import { ImageConcept } from "../../types";
import ImageConceptModal from "./ImageConceptModal";

interface ImageConceptsRowProps {
	itemName: string;
	concepts: ImageConcept[];
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

const ImageConceptsRow: React.FC<ImageConceptsRowProps> = ({ itemName, concepts }) => {
	const [selectedConcept, setSelectedConcept] = useState<ImageConcept | null>(null);

	const handleClick = (concept: ImageConcept) => {
		if (concept.status === "done") {
			setSelectedConcept(concept);
		}
	};

	return (
		<>
			<div className="image-concepts-container">
				<div className="image-concepts-header">
					<ImageIcon size={14} />
					<span>Ad Concepts: {itemName}</span>
					<span className="image-concepts-count">{concepts.length} concepts</span>
				</div>
				<div className="image-concepts-row">
					{concepts.map((concept, index) => (
						<div
							key={index}
							className={`image-concept-thumbnail ${concept.status === "done" ? "clickable" : ""}`}
							onClick={() => handleClick(concept)}
							title={concept.status === "done" ? concept.concept_name : undefined}
						>
							{renderThumbnailContent(concept)}
						</div>
					))}
				</div>
			</div>

			{selectedConcept && (
				<ImageConceptModal concept={selectedConcept} onClose={() => setSelectedConcept(null)} />
			)}
		</>
	);
};

export default ImageConceptsRow;
