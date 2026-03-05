import React, { useEffect } from "react";
import { X, Users, Tag } from "lucide-react";
import { VideoConcept } from "../../types";

interface VideoConceptModalProps {
	concept: VideoConcept;
	onClose: () => void;
}

const VideoConceptModal: React.FC<VideoConceptModalProps> = ({ concept, onClose }) => {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	useEffect(() => {
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "auto";
		};
	}, []);

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) onClose();
	};

	return (
		<div className="document-modal-overlay" onClick={handleBackdropClick}>
			<div className="video-concept-modal-content">
				<div className="document-modal-header">
					<h2>{concept.concept_name}</h2>
					<button className="close-modal-btn" onClick={onClose}>
						<X size={20} />
					</button>
				</div>
				<div className="video-concept-modal-body">
					<div className="video-concept-modal-script">
						<h4>Video Script</h4>
						<pre className="video-script-text">{concept.script}</pre>
					</div>
					<div className="video-concept-modal-details">
						<p className="video-concept-description">{concept.concept_description}</p>
						<div className="video-concept-summary">{concept.concept_summary}</div>

						<div className="video-concept-section">
							<h4>Concept Detail</h4>
							<pre className="video-concept-detail">{concept.concept_detail}</pre>
						</div>

						{concept.personas.length > 0 && (
							<div className="video-concept-section">
								<h4>
									<Users size={14} /> Personas
								</h4>
								<div className="concept-tags-list">
									{concept.personas.map((p, i) => (
										<span key={i} className="concept-tag persona">
											{p}
										</span>
									))}
								</div>
							</div>
						)}

						<div className="video-concept-section">
							<h4>
								<Tag size={14} /> Creative Tags
							</h4>
							{concept.creative_tags.ad_angles.length > 0 && (
								<div className="concept-tag-group">
									<span className="concept-tag-label">Ad Angles</span>
									<div className="concept-tags-list">
										{concept.creative_tags.ad_angles.map((t, i) => (
											<span key={i} className="concept-tag angle">
												{t}
											</span>
										))}
									</div>
								</div>
							)}
							{concept.creative_tags.emotion.length > 0 && (
								<div className="concept-tag-group">
									<span className="concept-tag-label">Emotion</span>
									<div className="concept-tags-list">
										{concept.creative_tags.emotion.map((t, i) => (
											<span key={i} className="concept-tag emotion">
												{t}
											</span>
										))}
									</div>
								</div>
							)}
							{concept.creative_tags.themes.length > 0 && (
								<div className="concept-tag-group">
									<span className="concept-tag-label">Themes</span>
									<div className="concept-tags-list">
										{concept.creative_tags.themes.map((t, i) => (
											<span key={i} className="concept-tag theme">
												{t}
											</span>
										))}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default VideoConceptModal;
