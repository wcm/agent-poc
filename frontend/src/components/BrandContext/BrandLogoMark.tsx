import React from "react";

interface BrandLogoMarkProps {
	markText?: string;
	imageUrl?: string;
	label: string;
	size?: "xs" | "sm" | "md" | "lg";
}

const BrandLogoMark: React.FC<BrandLogoMarkProps> = ({ markText, imageUrl, label, size = "lg" }) => {
	if (imageUrl) {
		return (
			<div className={`brand-context-logo-mark has-image ${size}`}>
				<img src={imageUrl} alt={label} className="brand-context-logo-mark-image" />
			</div>
		);
	}

	return (
		<div className={`brand-context-logo-mark ${size}`} role="img" aria-label={label}>
			<span>{markText ?? label.charAt(0)}</span>
		</div>
	);
};

export default BrandLogoMark;
