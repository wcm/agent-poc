import React, { useEffect } from "react";
import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ReportItemData } from "../../types";
import AdMetricCard from "./AdMetricCard";

interface CreativeReportModalProps {
	title: string;
	content: string;
	itemName: string;
	itemData?: ReportItemData;
	onClose: () => void;
}

const CreativeReportModal: React.FC<CreativeReportModalProps> = ({ title, content, itemName, itemData, onClose }) => {
	// Close on escape key
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	// Prevent body scroll when modal is open
	useEffect(() => {
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "auto";
		};
	}, []);

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	};

	return (
		<div className="document-modal-overlay" onClick={handleBackdropClick}>
			<div className="creative-report-modal-content">
				<div className="document-modal-header">
					<h2>{title}</h2>
					<button className="close-modal-btn" onClick={onClose}>
						<X size={20} />
					</button>
				</div>
				<div className="creative-report-modal-body">
					{/* Left sidebar - Ad metric card */}
					{itemData && (
						<div className="creative-report-sidebar">
							<AdMetricCard itemData={itemData} itemName={itemName} />
						</div>
					)}

					{/* Right content - Markdown */}
					<div className="creative-report-markdown">
						<ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
					</div>
				</div>
			</div>
		</div>
	);
};

export default CreativeReportModal;
