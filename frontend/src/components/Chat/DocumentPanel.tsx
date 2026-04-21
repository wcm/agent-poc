import React from "react";
import { X, Sparkles, TrendingUp, Lightbulb, Image as ImageIcon, Video, Users, Tag, Play } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ImageConcept, ReportItemData, VideoConcept } from "../../types";
import AdMetricCard from "./AdMetricCard";

export type ChatDocument =
	| {
			id: string;
			kind: "report";
			title: string;
			reportType: "performance" | "creative" | "common";
			content: string;
			itemName?: string;
			itemData?: ReportItemData;
	  }
	| {
			id: string;
			kind: "image-concept";
			title: string;
			itemName: string;
			index: number;
			concept: ImageConcept;
	  }
	| {
			id: string;
			kind: "video-concept";
			title: string;
			itemName: string;
			index: number;
			concept: VideoConcept;
	  };

interface DocumentPanelProps {
	document: ChatDocument;
	onClose: () => void;
}

const getReportTypeLabel = (reportType: "performance" | "creative" | "common") => {
	switch (reportType) {
		case "performance":
			return "Data Analysis";
		case "creative":
			return "Creative Insights";
		case "common":
			return "Common Findings";
		default:
			return "Report";
	}
};

const getReportTypeIcon = (reportType: "performance" | "creative" | "common") => {
	switch (reportType) {
		case "performance":
			return <TrendingUp size={14} />;
		case "creative":
			return <Lightbulb size={14} />;
		case "common":
			return <Sparkles size={14} />;
		default:
			return <Sparkles size={14} />;
	}
};

const renderImagePlaceholder = (concept: ImageConcept) => {
	switch (concept.status) {
		case "pending":
			return <div className="document-panel-image-placeholder">Concept details are still loading.</div>;
		case "generating":
			return <div className="document-panel-image-placeholder">Image generation in progress.</div>;
		case "failed":
			return <div className="document-panel-image-placeholder">Image generation failed.</div>;
		default:
			return <div className="document-panel-image-placeholder">No preview available.</div>;
	}
};

const DocumentPanel: React.FC<DocumentPanelProps> = ({ document, onClose }) => {
	const markdownComponents = {
		table: ({ children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
			<div className="document-panel-table-wrap">
				<table {...props}>{children}</table>
			</div>
		),
	};

	return (
		<aside className="document-panel">
			<div className="document-panel-surface">
				<div className="document-panel-header">
					<div className="document-panel-header-copy">
						<span className="document-panel-eyebrow">
							{document.kind === "report" ? (
								<>
									{getReportTypeIcon(document.reportType)}
									{getReportTypeLabel(document.reportType)}
								</>
							) : document.kind === "image-concept" ? (
								<>
									<ImageIcon size={14} />
									Image Concept
								</>
							) : (
								<>
									<Video size={14} />
									Video Script
								</>
							)}
						</span>
						<h2 className="document-panel-title">{document.title}</h2>
						{document.itemName && !(document.kind === "report" && document.reportType === "creative") && <span className="document-panel-subtitle">{document.itemName}</span>}
					</div>
					<button type="button" className="document-panel-close" onClick={onClose} aria-label="Close document panel">
						<X size={18} />
					</button>
				</div>

				<div className="document-panel-body">
					{document.kind === "report" ? (
						<div className="document-panel-report">
							{document.reportType === "creative" && document.itemData && (
								<div className="document-panel-metric-card">
									<AdMetricCard itemData={document.itemData} itemName={document.itemName || document.title} layout="horizontal" />
								</div>
							)}
							<div className="document-panel-markdown">
								<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
									{document.content}
								</ReactMarkdown>
							</div>
						</div>
					) : document.kind === "image-concept" ? (
						<div className="document-panel-concept">
							<div className="document-panel-image-preview">
								{document.concept.imageDataUrl ? <img src={document.concept.imageDataUrl} alt={document.title} /> : renderImagePlaceholder(document.concept)}
							</div>
							<div className="document-panel-concept-copy">
								{document.concept.concept_description && <p className="image-concept-description">{document.concept.concept_description}</p>}
								{document.concept.concept_summary && <div className="image-concept-summary">{document.concept.concept_summary}</div>}

								<div className="image-concept-section">
									<h4>Concept Detail</h4>
									<pre className="image-concept-detail">{document.concept.concept_detail || "Detailed prompt will appear here once it is available."}</pre>
								</div>

								{document.concept.personas.length > 0 && (
									<div className="image-concept-section">
										<h4>
											<Users size={14} /> Personas
										</h4>
										<div className="image-concept-tags">
											{document.concept.personas.map((persona, index) => (
												<span key={index} className="concept-tag persona">
													{persona}
												</span>
											))}
										</div>
									</div>
								)}

								<div className="image-concept-section">
									<h4>
										<Tag size={14} /> Creative Tags
									</h4>
									{document.concept.creative_tags.ad_angles.length > 0 && (
										<div className="concept-tag-group">
											<span className="concept-tag-label">Ad Angles</span>
											<div className="image-concept-tags">
												{document.concept.creative_tags.ad_angles.map((tag, index) => (
													<span key={index} className="concept-tag angle">
														{tag}
													</span>
												))}
											</div>
										</div>
									)}
									{document.concept.creative_tags.emotion.length > 0 && (
										<div className="concept-tag-group">
											<span className="concept-tag-label">Emotion</span>
											<div className="image-concept-tags">
												{document.concept.creative_tags.emotion.map((tag, index) => (
													<span key={index} className="concept-tag emotion">
														{tag}
													</span>
												))}
											</div>
										</div>
									)}
									{document.concept.creative_tags.themes.length > 0 && (
										<div className="concept-tag-group">
											<span className="concept-tag-label">Themes</span>
											<div className="image-concept-tags">
												{document.concept.creative_tags.themes.map((tag, index) => (
													<span key={index} className="concept-tag theme">
														{tag}
													</span>
												))}
											</div>
										</div>
									)}
								</div>
							</div>
						</div>
					) : (
						<div className="document-panel-concept">
							<div className="document-panel-script-block">
								<h4>
									<Play size={14} /> Script
								</h4>
								<pre className="video-script-text">{document.concept.script}</pre>
							</div>
							<div className="document-panel-concept-copy">
								{document.concept.concept_description && <p className="video-concept-description">{document.concept.concept_description}</p>}
								{document.concept.concept_summary && <div className="video-concept-summary">{document.concept.concept_summary}</div>}

								<div className="video-concept-section">
									<h4>Concept Detail</h4>
									<pre className="video-concept-detail">{document.concept.concept_detail}</pre>
								</div>

								{document.concept.personas.length > 0 && (
									<div className="video-concept-section">
										<h4>
											<Users size={14} /> Personas
										</h4>
										<div className="concept-tags-list">
											{document.concept.personas.map((persona, index) => (
												<span key={index} className="concept-tag persona">
													{persona}
												</span>
											))}
										</div>
									</div>
								)}

								<div className="video-concept-section">
									<h4>
										<Tag size={14} /> Creative Tags
									</h4>
									{document.concept.creative_tags.ad_angles.length > 0 && (
										<div className="concept-tag-group">
											<span className="concept-tag-label">Ad Angles</span>
											<div className="concept-tags-list">
												{document.concept.creative_tags.ad_angles.map((tag, index) => (
													<span key={index} className="concept-tag angle">
														{tag}
													</span>
												))}
											</div>
										</div>
									)}
									{document.concept.creative_tags.emotion.length > 0 && (
										<div className="concept-tag-group">
											<span className="concept-tag-label">Emotion</span>
											<div className="concept-tags-list">
												{document.concept.creative_tags.emotion.map((tag, index) => (
													<span key={index} className="concept-tag emotion">
														{tag}
													</span>
												))}
											</div>
										</div>
									)}
									{document.concept.creative_tags.themes.length > 0 && (
										<div className="concept-tag-group">
											<span className="concept-tag-label">Themes</span>
											<div className="concept-tags-list">
												{document.concept.creative_tags.themes.map((tag, index) => (
													<span key={index} className="concept-tag theme">
														{tag}
													</span>
												))}
											</div>
										</div>
									)}
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</aside>
	);
};

export default DocumentPanel;
