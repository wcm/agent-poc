import React from "react";
import { Video } from "lucide-react";
import { VideoConcept } from "../../types";

interface VideoConceptsRowProps {
	itemId: string;
	itemName: string;
	concepts: VideoConcept[];
	activeDocumentId?: string | null;
	onOpenConcept?: (itemId: string, itemName: string, concept: VideoConcept, index: number) => void;
}

const VideoConceptsRow: React.FC<VideoConceptsRowProps> = ({ itemId, itemName, concepts, activeDocumentId, onOpenConcept }) => {
	const getFirstSentence = (script: string): string => {
		const narrationMatch = script.match(/(?:Narration|VO|Speaker):\s*"?([^"\n]+)/i);
		if (narrationMatch) return narrationMatch[1].trim();
		const firstLine = script.split("\n").find((line) => line.trim().length > 0);
		return firstLine?.trim().substring(0, 80) || "Video script concept";
	};

	return (
		<div className="video-concepts-container">
			<div className="video-concepts-header">
				<Video size={14} />
				<span>Video Concepts: {itemName}</span>
				<span className="video-concepts-count">{concepts.length} scripts</span>
			</div>
			<div className="video-concepts-row">
				{concepts.map((concept, index) => {
					const documentId = `video:${itemId}:${index}`;
					return (
						<div key={documentId} className={`video-concept-card ${activeDocumentId === documentId ? "is-active" : ""}`} onClick={() => onOpenConcept?.(itemId, itemName, concept, index)}>
							<div className="video-concept-card-title">{concept.concept_name}</div>
							<div className="video-concept-card-preview">{getFirstSentence(concept.script)}</div>
							<div className="video-concept-card-personas">
								{concept.personas.slice(0, 2).map((persona, personaIndex) => (
									<span key={personaIndex} className="concept-tag persona small">
										{persona}
									</span>
								))}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default VideoConceptsRow;
