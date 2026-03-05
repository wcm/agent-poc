import React, { useState } from "react";
import { Video } from "lucide-react";
import { VideoConcept } from "../../types";
import VideoConceptModal from "./VideoConceptModal";

interface VideoConceptsRowProps {
	itemName: string;
	concepts: VideoConcept[];
}

const VideoConceptsRow: React.FC<VideoConceptsRowProps> = ({ itemName, concepts }) => {
	const [selectedConcept, setSelectedConcept] = useState<VideoConcept | null>(null);

	const getFirstSentence = (script: string): string => {
		const narrationMatch = script.match(/(?:Narration|VO|Speaker):\s*"?([^"\n]+)/i);
		if (narrationMatch) return narrationMatch[1].trim();
		const firstLine = script.split("\n").find((line) => line.trim().length > 0);
		return firstLine?.trim().substring(0, 80) || "Video script concept";
	};

	return (
		<>
			<div className="video-concepts-container">
				<div className="video-concepts-header">
					<Video size={14} />
					<span>Video Concepts: {itemName}</span>
					<span className="video-concepts-count">{concepts.length} scripts</span>
				</div>
				<div className="video-concepts-row">
					{concepts.map((concept, index) => (
						<div
							key={index}
							className="video-concept-card"
							onClick={() => setSelectedConcept(concept)}
						>
							<div className="video-concept-card-title">{concept.concept_name}</div>
							<div className="video-concept-card-preview">{getFirstSentence(concept.script)}</div>
							<div className="video-concept-card-personas">
								{concept.personas.slice(0, 2).map((p, i) => (
									<span key={i} className="concept-tag persona small">{p}</span>
								))}
							</div>
						</div>
					))}
				</div>
			</div>

			{selectedConcept && (
				<VideoConceptModal concept={selectedConcept} onClose={() => setSelectedConcept(null)} />
			)}
		</>
	);
};

export default VideoConceptsRow;
