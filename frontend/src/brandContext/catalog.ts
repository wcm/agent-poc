export interface BrandContextLogo {
	id: string;
	name: string;
	label: string;
	imageUrl?: string;
	markText?: string;
}

export interface BrandContextColor {
	name: string;
	hex: string;
}

export interface BrandContextFont {
	id: string;
	role: string;
	family: string;
	weight: string;
	sample: string;
}

export interface BrandContextGuidelines {
	logos: BrandContextLogo[];
	colors: BrandContextColor[];
	fonts: BrandContextFont[];
	toneOfVoice: string;
	preferredWords: string[];
	avoidWords: string[];
}

export interface BrandContextItem {
	id: string;
	name: string;
	description?: string;
}

export interface BrandContextFile {
	id: string;
	name: string;
	fileType: "md" | "image";
}

export interface BrandContext {
	id: string;
	name: string;
	website: string;
	industryVerticals: string[];
	shortDescriptor: string;
	integrations: BrandContextItem[];
	products: BrandContextItem[];
	scenarios: BrandContextItem[];
	personas: BrandContextItem[];
	competitors: BrandContextItem[];
	contextFiles: BrandContextFile[];
	profile: {
		description: string;
		uniqueValuePropositions: string[];
		targetAudience: string;
		category: string[];
		categoryNeeds: string;
		moreAboutBrand: string;
	};
	guidelines: BrandContextGuidelines;
}

export const DEFAULT_BRAND_CONTEXT_ID = "nike";

export const BRAND_CONTEXTS: Record<string, BrandContext> = {
	nike: {
		id: "nike",
		name: "Nike",
		website: "https://www.nike.com",
		industryVerticals: ["Sportswear", "Footwear", "Apparel", "Fitness"],
		shortDescriptor: "Sportswear, Athletic Footwear, Apparel & Fitness",
		integrations: [
			{
				id: "nike-meta-ads",
				name: "NIKE Official Meta",
				description: "Primary paid social performance integration for Nike mock analytics.",
			},
			{
				id: "nike-tiktok-ads",
				name: "NIKE TikTok",
				description: "Short-form paid social integration used for connected source selection.",
			},
		],
		products: [
			{
				id: "pegasus-41",
				name: "Pegasus 41",
				description: "Everyday performance running shoe built around responsive cushioning and broad appeal.",
			},
			{
				id: "metcon-9",
				name: "Metcon 9",
				description: "Training shoe optimized for gym work, lifting stability, and high-intensity performance.",
			},
			{
				id: "tech-fleece",
				name: "Tech Fleece",
				description: "Premium sportswear apparel franchise balancing comfort, warmth, and streetwear relevance.",
			},
		],
		scenarios: [
			{
				id: "performance-launch",
				name: "Performance footwear launch",
				description: "Introduce a new technical shoe through athlete proof, product benefit, and training context.",
			},
			{
				id: "seasonal-lifestyle",
				name: "Seasonal lifestyle campaign",
				description: "Build demand around apparel, sneakers, and everyday movement moments.",
			},
			{
				id: "creator-training",
				name: "Creator-led training content",
				description: "Use trusted fitness creators to translate product benefits into repeatable training stories.",
			},
		],
		personas: [
			{
				id: "performance-athlete",
				name: "Performance Athlete",
				description: "Runners, gym athletes, and sport-specific buyers seeking measurable performance gains.",
			},
			{
				id: "sneaker-culture",
				name: "Sneaker Culture Consumer",
				description: "Style-led shoppers who follow drops, collaborations, colorways, and cultural relevance.",
			},
			{
				id: "everyday-mover",
				name: "Everyday Mover",
				description: "Consumers who want activewear that moves easily between training, errands, and social plans.",
			},
		],
		competitors: [
			{
				id: "adidas",
				name: "Adidas",
				description: "Heritage sportswear and lifestyle competitor across footwear and apparel.",
			},
			{
				id: "lululemon",
				name: "Lululemon",
				description: "Premium activewear competitor with strong community and lifestyle positioning.",
			},
			{
				id: "on-running",
				name: "On Running",
				description: "Performance running competitor known for comfort-led product stories.",
			},
			{
				id: "puma",
				name: "Puma",
				description: "Sportswear competitor across classics, football, running, and lifestyle.",
			},
		],
		contextFiles: [
			{
				id: "nike-brand-positioning",
				name: "Nike Brand Positioning.md",
				fileType: "md",
			},
			{
				id: "nike-tone-of-voice",
				name: "Nike Tone of Voice.md",
				fileType: "md",
			},
			{
				id: "nike-style-reference-running",
				name: "Style Reference - Running Energy.png",
				fileType: "image",
			},
			{
				id: "nike-style-reference-sportswear",
				name: "Style Reference - Tech Fleece.png",
				fileType: "image",
			},
		],
		profile: {
			description:
				"Nike is a global sportswear and performance brand focused on athletic footwear, apparel, equipment, and digitally connected training experiences.",
			uniqueValuePropositions: [
				"Performance innovation at global scale",
				"Iconic athlete storytelling",
				"Culture-defining product launches",
				"Premium sport-to-lifestyle credibility",
			],
			targetAudience:
				"Athletes, fitness enthusiasts, sneaker culture consumers, and everyday movers who use sport and style as part of their identity.",
			category: ["Athletic footwear", "Sports apparel", "Training", "Lifestyle sneakers"],
			categoryNeeds:
				"Clear product benefit proof, fast creative testing, culturally current messaging, and segmented storytelling across sport, lifestyle, and commerce moments.",
			moreAboutBrand:
				"Nike's brand platform centers on motivation, self-belief, and movement. Creative should feel direct, kinetic, and emotionally charged without losing product clarity.",
		},
		guidelines: {
			logos: [
				{
					id: "nike-wordmark",
					name: "Nike wordmark",
					label: "Default",
					imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTfyWHG1bVeVskDPs8xjlzIiDE7E3pzZQIIQg&s",
					markText: "NIKE",
				},
			],
			colors: [
				{ name: "Black", hex: "#111111" },
				{ name: "White", hex: "#FFFFFF" },
				{ name: "Volt", hex: "#C7FF00" },
				{ name: "Safety Orange", hex: "#FF5A1F" },
			],
			fonts: [
				{
					id: "headline",
					role: "Headline",
					family: "Nike Futura",
					weight: "Bold",
					sample: "Aa",
				},
				{
					id: "body",
					role: "Body",
					family: "Inter",
					weight: "Regular",
					sample: "Aa",
				},
			],
			toneOfVoice: "Bold, motivational, concise, culturally fluent",
			preferredWords: ["move", "train", "faster", "stronger", "everyday", "limitless"],
			avoidWords: ["cheap", "passive", "generic", "impossible"],
		},
	},
};

const normalizeBrandKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

export const findBrandContext = (brandNameOrId: string) => {
	const normalizedKey = normalizeBrandKey(brandNameOrId);
	return BRAND_CONTEXTS[normalizedKey] ?? null;
};

export const getBrandContext = (brandNameOrId: string) => {
	return findBrandContext(brandNameOrId) ?? BRAND_CONTEXTS[DEFAULT_BRAND_CONTEXT_ID];
};

export const getBrandContextPrimaryLogo = (brandNameOrId: string | BrandContext) => {
	const brand = typeof brandNameOrId === "string" ? getBrandContext(brandNameOrId) : brandNameOrId;
	return brand.guidelines.logos[0] ?? null;
};

export const getBrandContextCompletionScore = (brandNameOrId: string | BrandContext) => {
	const brand = typeof brandNameOrId === "string" ? getBrandContext(brandNameOrId) : brandNameOrId;
	const checks = [
		Boolean(brand.website),
		brand.industryVerticals.length > 0,
		brand.integrations.length > 0,
		brand.scenarios.length > 0,
		brand.personas.length > 0,
		brand.competitors.length > 0,
		Boolean(brand.profile.description),
		brand.profile.uniqueValuePropositions.length > 0,
		Boolean(brand.profile.targetAudience),
		brand.profile.category.length > 0,
		Boolean(brand.profile.categoryNeeds),
		Boolean(brand.profile.moreAboutBrand),
		brand.guidelines.logos.length > 0,
		brand.guidelines.colors.length > 0,
		brand.guidelines.fonts.length > 0,
		Boolean(brand.guidelines.toneOfVoice),
		brand.guidelines.preferredWords.length > 0,
		brand.guidelines.avoidWords.length > 0,
	];

	const completedChecks = checks.filter(Boolean).length;
	return Math.round((completedChecks / checks.length) * 100);
};
