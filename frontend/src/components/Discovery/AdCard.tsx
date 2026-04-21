import React from "react";
import { Bookmark, MoreHorizontal, Play } from "lucide-react";
import { Ad } from "../../types";
import { PlatformLogo, getPlatformLogoId } from "../icons/ServiceLogos";

const YouTubeIcon = () => (
	<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
		<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
	</svg>
);

const PlatformIcon: React.FC<{ platform: string }> = ({ platform }) => {
	const iconMap: Record<string, React.ReactNode> = {
		youtube: <YouTubeIcon />,
	};

	return (
		<span className="platform-icon" title={platform}>
			{getPlatformLogoId(platform) ? <PlatformLogo platform={platform} size={12} /> : iconMap[platform] || platform.substring(0, 2).toUpperCase()}
		</span>
	);
};

interface AdCardProps {
	ad: Ad;
	onBookmarkToggle: (ad: Ad) => void;
	onBrandClick?: (brandId: string) => void;
	showRunningTime?: boolean;
}

// Calculate running time in days
const calculateRunningTime = (startDate: string, endDate: string | null): string => {
	const start = new Date(startDate);
	const end = endDate ? new Date(endDate) : new Date();
	const diffTime = Math.abs(end.getTime() - start.getTime());
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
	return `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
};

const AdCard: React.FC<AdCardProps> = ({ ad, onBookmarkToggle, onBrandClick, showRunningTime = true }) => {
	const runningTime = calculateRunningTime(ad.start_date, ad.end_date);

	return (
		<div className="feed-card">
			<div className="feed-header">
				<img src={ad.brand_logo} alt={ad.brand_name} className="feed-brand-logo" onClick={() => onBrandClick?.(ad.brand_id || "")} style={{ cursor: onBrandClick ? "pointer" : "default" }} />
				<div className="feed-header-text">
					<span className="feed-brand-name" onClick={() => onBrandClick?.(ad.brand_id || "")} style={{ cursor: onBrandClick ? "pointer" : "default" }}>
						{ad.brand_name}
					</span>
					<div className="feed-meta-row">
						<span className={`status-badge ${ad.status}`}>{ad.status}</span>
						{showRunningTime && (
							<>
								<span className="meta-dot">•</span>
								<span className="running-time">{runningTime}</span>
							</>
						)}
					</div>
				</div>
				<button className="feed-menu-btn">
					<MoreHorizontal size={16} />
				</button>
			</div>

			<div className="feed-image-container">
				{ad.display_format === "video" && (
					<div className="video-badge">
						<Play size={14} fill="white" color="white" />
						<span>{ad.video_length}</span>
					</div>
				)}
				<img src={ad.image_url} alt={ad.headline} className="feed-image" />
				<div className="feed-overlay-platforms">
					{ad.platforms.map((p) => (
						<PlatformIcon key={p} platform={p} />
					))}
				</div>
			</div>

			<div className="feed-content">
				<div className="feed-headline">{ad.headline}</div>
				<div className="feed-text">{ad.ad_copy}</div>
				<div className="feed-footer">
					<button className="feed-cta-btn">{ad.cta}</button>
					<div className="feed-actions">
						<button className={`action-btn ${ad.is_bookmarked ? "active" : ""}`} onClick={() => onBookmarkToggle(ad)} title="Bookmark Ad">
							<Bookmark size={18} fill={ad.is_bookmarked ? "currentColor" : "none"} />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default AdCard;
