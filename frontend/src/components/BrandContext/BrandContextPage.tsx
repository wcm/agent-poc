import React, { useMemo } from "react";
import { ArrowRight, Ellipsis, FileImage, FileText, Package, Pencil, Plus, Target, Trophy, Users } from "lucide-react";
import { BrandContextFile, BrandContextItem, getBrandContext } from "../../brandContext/catalog";
import BrandLogoMark from "./BrandLogoMark";

interface BrandContextPageProps {
	brandName: string;
}

interface SummaryCardConfig {
	id: string;
	label: string;
	actionLabel: string;
	items: BrandContextItem[];
	icon: React.ReactNode;
	previewType: "scenarios" | "personas" | "competitors" | "products";
}

const renderListValue = (items: string[]) => (items.length > 0 ? items.join(", ") : "-");

const SummaryPreview: React.FC<Pick<SummaryCardConfig, "items" | "previewType">> = ({ items, previewType }) => {
	const visibleItems = items.slice(0, 4);

	if (visibleItems.length === 0) {
		return <div className="brand-context-summary-empty" />;
	}

	if (previewType === "personas") {
		return (
			<div className="brand-context-avatar-stack">
				{visibleItems.map((item, index) => (
					<span key={item.id} style={{ backgroundColor: ["#111111", "#C7FF00", "#FF5A1F", "#F1F5F9"][index] }}>
						{item.name.charAt(0)}
					</span>
				))}
			</div>
		);
	}

	if (previewType === "competitors") {
		return (
			<div className="brand-context-competitor-preview">
				{visibleItems.slice(0, 2).map((item) => (
					<span key={item.id}>{item.name}</span>
				))}
			</div>
		);
	}

	if (previewType === "products") {
		return (
			<div className="brand-context-product-preview">
				{visibleItems.slice(0, 3).map((item, index) => (
					<span key={item.id} style={{ backgroundColor: ["#111111", "#f8fafc", "#C7FF00"][index] }}>
						{item.name.split(" ")[0]}
					</span>
				))}
			</div>
		);
	}

	return (
		<div className="brand-context-scenario-preview">
			{visibleItems.slice(0, 3).map((item, index) => (
				<span key={item.id} style={{ backgroundColor: ["#E2E8F0", "#111111", "#C7FF00"][index] }} />
			))}
		</div>
	);
};

const getContextFileIcon = (file: BrandContextFile) => {
	switch (file.fileType) {
		case "image":
			return <FileImage size={16} />;
		case "md":
		default:
			return <FileText size={16} />;
	}
};

const BrandContextPage: React.FC<BrandContextPageProps> = ({ brandName }) => {
	const brand = useMemo(() => getBrandContext(brandName), [brandName]);
	const primaryLogo = brand.guidelines.logos[0];

	const summaryCards: SummaryCardConfig[] = [
		{
			id: "scenarios",
			label: "Scenarios",
			actionLabel: "View",
			items: brand.scenarios,
			icon: <Target size={22} />,
			previewType: "scenarios",
		},
		{
			id: "personas",
			label: "Personas",
			actionLabel: "View",
			items: brand.personas,
			icon: <Users size={22} />,
			previewType: "personas",
		},
		{
			id: "competitors",
			label: "Competitors",
			actionLabel: "View",
			items: brand.competitors,
			icon: <Trophy size={22} />,
			previewType: "competitors",
		},
		{
			id: "products",
			label: "Products",
			actionLabel: "View",
			items: brand.products,
			icon: <Package size={22} />,
			previewType: "products",
		},
	];

	return (
		<div className="brand-context-page">
			<div className="brand-context-shell">
				<header className="brand-context-hero">
					<div className="brand-context-identity">
						<BrandLogoMark
							markText={primaryLogo?.markText ?? brand.name.charAt(0)}
							imageUrl={primaryLogo?.imageUrl}
							label={`${brand.name} logo`}
						/>
						<div>
							<h1>{brand.name}</h1>
							<p>{brand.shortDescriptor}</p>
						</div>
					</div>
					<div className="brand-context-hero-actions">
						<button type="button" className="brand-context-button">
							<Pencil size={18} />
							<span>Edit profile</span>
						</button>
						<button type="button" className="brand-context-icon-button" aria-label="More brand options">
							<Ellipsis size={20} />
						</button>
					</div>
				</header>

				<section className="brand-context-summary-grid" aria-label="Brand context summary">
					{summaryCards.map((card) => (
						<article key={card.id} className="brand-context-summary-card">
							<div className="brand-context-summary-preview-wrap">
								<SummaryPreview items={card.items} previewType={card.previewType} />
								<div className="brand-context-summary-icon">{card.icon}</div>
							</div>
							<div className="brand-context-summary-count">
								<strong>{card.items.length}</strong>
								<span>{card.label}</span>
							</div>
							<div className="brand-context-card-divider" />
							<button type="button" className="brand-context-text-action">
								<span>{card.actionLabel}</span>
								<ArrowRight size={14} aria-hidden="true" />
							</button>
						</article>
					))}
				</section>

				<div className="brand-context-main-grid">
					<div className="brand-context-left-column">
						<section className="brand-context-panel brand-context-files-panel">
							<div className="brand-context-panel-header">
								<h2>Context Files</h2>
								<button type="button" className="brand-context-button compact">
									<Plus size={16} />
									<span>Add File</span>
								</button>
							</div>
							<div className="brand-context-card-divider" />
							<div className="brand-context-file-list">
								{brand.contextFiles.map((file) => (
									<div key={file.id} className="brand-context-file-row">
										<span className="brand-context-file-icon">{getContextFileIcon(file)}</span>
										<span className="brand-context-file-name">{file.name}</span>
									</div>
								))}
							</div>
						</section>

						<section className="brand-context-panel brand-context-profile-panel">
							<div className="brand-context-panel-header">
								<h2>Brand profile</h2>
								<button type="button" className="brand-context-button compact">
									<Pencil size={17} />
									<span>Edit</span>
								</button>
							</div>
							<div className="brand-context-card-divider" />
							<div className="brand-context-profile-list">
								<div className="brand-context-field">
									<span className="brand-context-field-label">Brand name</span>
									<p>{brand.name}</p>
								</div>
								<div className="brand-context-field">
									<span className="brand-context-field-label">Website</span>
									<p>{brand.website}</p>
								</div>
								<div className="brand-context-field">
									<span className="brand-context-field-label">Industry / vertical</span>
									<div className="brand-context-chip-row">
										{brand.industryVerticals.map((vertical) => (
											<span key={vertical} className="brand-context-chip">
												{vertical}
											</span>
										))}
									</div>
								</div>
								<div className="brand-context-field">
									<span className="brand-context-field-label">Product / service description</span>
									<p>{brand.profile.description}</p>
								</div>
								<div className="brand-context-field">
									<span className="brand-context-field-label">Unique value propositions</span>
									<div className="brand-context-chip-row wide">
										{brand.profile.uniqueValuePropositions.map((value) => (
											<span key={value} className="brand-context-chip">
												{value}
											</span>
										))}
									</div>
								</div>
								<div className="brand-context-field">
									<span className="brand-context-field-label">Target audience</span>
									<p>{brand.profile.targetAudience}</p>
								</div>
								<div className="brand-context-field">
									<span className="brand-context-field-label">Category</span>
									<p>{renderListValue(brand.profile.category)}</p>
								</div>
								<div className="brand-context-field">
									<span className="brand-context-field-label">Category needs</span>
									<p>{brand.profile.categoryNeeds}</p>
								</div>
								<div className="brand-context-field">
									<span className="brand-context-field-label">More about the brand</span>
									<p>{brand.profile.moreAboutBrand}</p>
								</div>
							</div>
						</section>
					</div>

					<aside className="brand-context-panel brand-context-guidelines-panel">
						<div className="brand-context-panel-header">
							<h2>Brand guidelines</h2>
							<button type="button" className="brand-context-button compact">
								<Pencil size={17} />
								<span>Edit</span>
							</button>
						</div>
						<div className="brand-context-card-divider" />
						<div className="brand-context-guideline-stack">
							<div className="brand-context-guideline-section">
								<span className="brand-context-field-label">Logos</span>
								<div className="brand-context-logo-list">
									{brand.guidelines.logos.map((logo) => (
										<div key={logo.id} className="brand-context-logo-item">
											<BrandLogoMark markText={logo.markText} imageUrl={logo.imageUrl} size="sm" label={logo.name} />
											<span>{logo.label}</span>
										</div>
									))}
								</div>
							</div>
							<div className="brand-context-guideline-section">
								<span className="brand-context-field-label">Brand colors</span>
								<div className="brand-context-color-row">
									{brand.guidelines.colors.map((color) => (
										<span
											key={color.hex}
											className="brand-context-color-swatch"
											style={{ backgroundColor: color.hex }}
											title={`${color.name} ${color.hex}`}
										/>
									))}
								</div>
							</div>
							<div className="brand-context-guideline-section">
								<span className="brand-context-field-label">Brand fonts</span>
								<div className="brand-context-font-stack">
									{brand.guidelines.fonts.map((font) => (
										<div key={font.id} className="brand-context-font-row">
											<div>
												<span>{font.role}</span>
												<strong>{font.sample}</strong>
											</div>
											<p>
												{font.family} - {font.weight}
											</p>
										</div>
									))}
								</div>
							</div>
							<div className="brand-context-guideline-section">
								<span className="brand-context-field-label">Tone of voice</span>
								<p>{brand.guidelines.toneOfVoice}</p>
							</div>
							<div className="brand-context-guideline-section">
								<span className="brand-context-field-label">Preferred words</span>
								<div className="brand-context-chip-row">
									{brand.guidelines.preferredWords.map((word) => (
										<span key={word} className="brand-context-chip">
											{word}
										</span>
									))}
								</div>
							</div>
							<div className="brand-context-guideline-section">
								<span className="brand-context-field-label">Avoid words</span>
								<div className="brand-context-chip-row muted">
									{brand.guidelines.avoidWords.map((word) => (
										<span key={word} className="brand-context-chip">
											{word}
										</span>
									))}
								</div>
							</div>
						</div>
					</aside>
				</div>
			</div>
		</div>
	);
};

export default BrandContextPage;
