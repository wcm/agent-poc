import React from "react";
import metaLogo from "../../assets/logos/meta.png";
import tiktokLogo from "../../assets/logos/tiktok.png";
import slackLogo from "../../assets/logos/slack.png";
import notionLogo from "../../assets/logos/notion.png";
import googleAnalyticsLogo from "../../assets/logos/google-analytics.png";
import shopifyLogo from "../../assets/logos/shopify.png";
import googleDriveLogo from "../../assets/logos/google-drive.png";
import hubspotLogo from "../../assets/logos/hubspot.png";
import salesforceLogo from "../../assets/logos/salesforce.png";

export type ServiceLogoId =
	| "meta"
	| "tiktok"
	| "slack"
	| "notion"
	| "google_analytics"
	| "shopify"
	| "google_drive"
	| "hubspot"
	| "salesforce";

const LOGO_SOURCES: Record<ServiceLogoId, string> = {
	meta: metaLogo,
	tiktok: tiktokLogo,
	slack: slackLogo,
	notion: notionLogo,
	google_analytics: googleAnalyticsLogo,
	shopify: shopifyLogo,
	google_drive: googleDriveLogo,
	hubspot: hubspotLogo,
	salesforce: salesforceLogo,
};

export const getPlatformLogoId = (platform: string): ServiceLogoId | null => {
	switch (platform.toLowerCase()) {
		case "meta":
		case "facebook":
		case "instagram":
			return "meta";
		case "tiktok":
			return "tiktok";
		default:
			return null;
	}
};

export const getServiceLogoSrc = (logoId: ServiceLogoId) => LOGO_SOURCES[logoId];

interface ServiceLogoImageProps {
	logoId: ServiceLogoId;
	alt: string;
	size?: number;
	className?: string;
}

export const ServiceLogoImage: React.FC<ServiceLogoImageProps> = ({ logoId, alt, size = 16, className }) => (
	<img
		src={getServiceLogoSrc(logoId)}
		alt={alt}
		width={size}
		height={size}
		className={className}
		style={{
			width: size,
			height: size,
			objectFit: "contain",
			display: "block",
			flexShrink: 0,
		}}
	/>
);

interface PlatformLogoProps {
	platform: string;
	size?: number;
	className?: string;
}

export const PlatformLogo: React.FC<PlatformLogoProps> = ({ platform, size = 16, className }) => {
	const logoId = getPlatformLogoId(platform);
	if (!logoId) {
		return null;
	}

	return <ServiceLogoImage logoId={logoId} alt={`${platform} logo`} size={size} className={className} />;
};

interface TiledServiceLogoProps {
	logoId: ServiceLogoId;
	alt: string;
	size?: number;
	background?: string;
	border?: string;
}

export const TiledServiceLogo: React.FC<TiledServiceLogoProps> = ({
	logoId,
	alt,
	size = 24,
	background = "#ffffff",
	border = "1px solid #e2e8f0",
}) => {
	const innerSize = Math.round(size * 0.72);

	return (
		<span
			style={{
				width: size,
				height: size,
				borderRadius: Math.max(10, Math.round(size * 0.32)),
				background,
				border,
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				flexShrink: 0,
				overflow: "hidden",
			}}
		>
			<ServiceLogoImage logoId={logoId} alt={alt} size={innerSize} />
		</span>
	);
};
