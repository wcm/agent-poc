import React from "react";
import { FileText, TrendingUp, Lightbulb, Sparkles, Play } from "lucide-react";
import { ReportItemData } from "../../types";

interface ReportCardProps {
	reportType: "performance" | "creative" | "common";
	reportId: string;
	title: string;
	content: string;
	itemName?: string;
	itemData?: ReportItemData;
	isActive?: boolean;
	onOpen?: () => void;
}

const getReportIcon = (reportType: ReportCardProps["reportType"]) => {
	switch (reportType) {
		case "performance":
			return <TrendingUp size={12} fill="currentColor" className="report-icon performance" />;
		case "creative":
			return <Lightbulb size={12} fill="currentColor" className="report-icon creative" />;
		case "common":
			return <Sparkles size={12} fill="currentColor" className="report-icon common" />;
		default:
			return <FileText size={12} fill="currentColor" className="report-icon" />;
	}
};

const getReportTypeLabel = (reportType: ReportCardProps["reportType"]) => {
	switch (reportType) {
		case "performance":
			return "Performance";
		case "creative":
			return "Creative";
		case "common":
			return "Common Findings";
		default:
			return "Report";
	}
};

const ReportCard: React.FC<ReportCardProps> = ({ reportType, title, content, itemName, itemData, isActive = false, onOpen }) => {
	// Get first few lines for preview, join with spaces for compact display
	const preview = content
		.split("\n")
		.slice(0, 10)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.join("  ");

	// Show thumbnail for creative reports
	const showThumbnail = reportType === "creative" && itemData?.thumbnail;

	return (
		<div className={`report-card ${reportType} ${showThumbnail ? "with-thumbnail" : ""} ${isActive ? "is-active" : ""}`} onClick={onOpen}>
			{showThumbnail && (
				<div className="report-card-thumbnail">
					<img src={itemData.thumbnail} alt={itemName || title} />
					{itemData.displayFormat === "video" && (
						<div className="thumbnail-video-indicator">
							<Play size={12} fill="white" />
						</div>
					)}
				</div>
			)}
			<div className="report-card-content">
				<div className="report-card-header">
					<div className="report-card-titles">
						<span className="report-title">{title}</span>
					</div>
					<div className={`report-type-badge ${reportType}`}>
						{getReportTypeLabel(reportType)}
						{getReportIcon(reportType)}
					</div>
				</div>
				<div className="report-card-preview">{preview}</div>
			</div>
		</div>
	);
};

export default ReportCard;
