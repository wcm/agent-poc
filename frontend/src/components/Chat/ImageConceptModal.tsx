import React, { useEffect } from "react";
import { X, Users, Tag } from "lucide-react";
import { ImageConcept } from "../../types";

interface ImageConceptModalProps {
	concept: ImageConcept;
	onClose: () => void;
}

const ImageConceptModal: React.FC<ImageConceptModalProps> = ({ concept, onClose }) => {
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
			<div className="image-concept-modal-content">
				<div className="document-modal-header">
					<h2>{concept.concept_name}</h2>
					<button className="close-modal-btn" onClick={onClose}>
						<X size={20} />
					</button>
				</div>
				<div className="image-concept-modal-body">
					<div className="image-concept-modal-preview">
						{concept.imageDataUrl ? <img src={concept.imageDataUrl} alt={concept.concept_name} /> : <div className="image-concept-placeholder">Image generation failed</div>}
					</div>
					<div className="image-concept-modal-details">
						<p className="image-concept-description">{concept.concept_description}</p>
						<div className="image-concept-summary">{concept.concept_summary}</div>

						<div className="image-concept-section">
							<h4>Concept Detail</h4>
							<pre className="image-concept-detail">{concept.concept_detail}</pre>
						</div>

						{concept.personas.length > 0 && (
							<div className="image-concept-section">
								<h4>
									<Users size={14} /> Personas
								</h4>
								<div className="image-concept-tags">
									{concept.personas.map((p, i) => (
										<span key={i} className="concept-tag persona">
											{p}
										</span>
									))}
								</div>
							</div>
						)}

						<div className="image-concept-section">
							<h4>
								<Tag size={14} /> Creative Tags
							</h4>
							{concept.creative_tags.ad_angles.length > 0 && (
								<div className="concept-tag-group">
									<span className="concept-tag-label">Ad Angles</span>
									<div className="image-concept-tags">
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
									<div className="image-concept-tags">
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
									<div className="image-concept-tags">
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

export default ImageConceptModal;
