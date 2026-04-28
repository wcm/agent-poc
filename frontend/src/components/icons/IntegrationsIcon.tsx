import React from "react";

interface IntegrationsIconProps {
	size?: number;
	className?: string;
}

const IntegrationsIcon: React.FC<IntegrationsIconProps> = ({ size = 16, className }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.7"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true"
	>
		<rect x="3.5" y="11.5" width="6.5" height="6.5" rx="1.8" />
		<rect x="11" y="11.5" width="6.5" height="6.5" rx="1.8" />
		<rect x="3.5" y="4" width="6.5" height="6.5" rx="1.8" />
		<rect x="14" y="1" width="6.5" height="6.5" rx="1.8" />
	</svg>
);

export default IntegrationsIcon;
