import React from "react";
import { FocusedItemCard, ReportItemData } from "../../types";
import { ImageIcon, Play } from "lucide-react";

interface AdMetricCardProps {
	item?: FocusedItemCard;
	itemData?: ReportItemData;
	itemName?: string;
}

const formatNumber = (value: number | undefined): string => {
	if (value === undefined || value === null) return "N/A";
	if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
	if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
	return value.toFixed(2);
};

const formatCurrency = (value: number | undefined): string => {
	if (value === undefined || value === null) return "N/A";
	if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
	if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
	return `$${value.toFixed(2)}`;
};

const formatPercentage = (value: number | undefined): string => {
	if (value === undefined || value === null) return "N/A";
	return `${value.toFixed(2)}%`;
};

const AdMetricCard: React.FC<AdMetricCardProps> = ({ item, itemData, itemName }) => {
	// Support both FocusedItemCard and ReportItemData
	const thumbnail = item?.thumbnail || itemData?.thumbnail;
	const name = item?.name || itemName || "";
	const displayFormat = item?.displayFormat || itemData?.displayFormat;
	const videoLength = item?.videoLength || itemData?.videoLength;
	const metrics = item?.metrics || itemData?.metrics || {};

	const isVideo = displayFormat === "video";

	return (
		<div className="metric-card">
			<div className="metric-card-thumbnail">
				{thumbnail ? (
					<>
						<img src={thumbnail} alt={name} />
						{isVideo && (
							<div className="video-indicator">
								<Play size={14} fill="white" />
								{videoLength && <span className="video-length">{videoLength}</span>}
							</div>
						)}
					</>
				) : (
					<div className="metric-card-placeholder">
						<ImageIcon size={24} />
					</div>
				)}
			</div>
			<div className="metric-card-name" title={name}>
				{name}
			</div>
			<div className="metric-card-metrics">
				{metrics.cost_per_lead !== undefined && (
					<div className="metric-row">
						<span className="metric-label">Cost per lead</span>
						<span className="metric-value">{formatCurrency(metrics.cost_per_lead)}</span>
					</div>
				)}
				{metrics.spend !== undefined && (
					<div className="metric-row">
						<span className="metric-label">Spend</span>
						<span className="metric-value">{formatCurrency(metrics.spend)}</span>
					</div>
				)}
				{metrics.roas !== undefined && (
					<div className="metric-row">
						<span className="metric-label">ROAS</span>
						<span className="metric-value">{formatNumber(metrics.roas)}</span>
					</div>
				)}
				{metrics.ctr !== undefined && (
					<div className="metric-row">
						<span className="metric-label">CTR</span>
						<span className="metric-value">{formatPercentage(metrics.ctr)}</span>
					</div>
				)}
				{metrics.impressions !== undefined && (
					<div className="metric-row">
						<span className="metric-label">Impressions</span>
						<span className="metric-value">{formatNumber(metrics.impressions)}</span>
					</div>
				)}
			</div>
		</div>
	);
};

export default AdMetricCard;
