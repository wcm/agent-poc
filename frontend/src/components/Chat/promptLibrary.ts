export type PromptLibraryIconKey = "wand2" | "barChart3" | "sparkles" | "eye" | "compass";

export interface PromptLibraryCategory {
	id: string;
	label: string;
	icon: PromptLibraryIconKey;
}

export interface PromptLibraryItem {
	id: string;
	categoryId: string;
	title: string;
	summary: string;
	prompt: string;
}

export const PROMPT_LIBRARY_CATEGORIES: PromptLibraryCategory[] = [
	{ id: "ad_generation", label: "Ad Generation", icon: "wand2" },
	{ id: "own_performance", label: "Own Performance", icon: "barChart3" },
	{ id: "creative_analysis", label: "Creative Analysis", icon: "sparkles" },
	{ id: "competitor_intel", label: "Competitor Intel", icon: "eye" },
	{ id: "strategic_insights", label: "Strategic Insights", icon: "compass" },
];

export const PROMPT_LIBRARY_ITEMS: PromptLibraryItem[] = [
	{
		id: "top-spenders-remix",
		categoryId: "ad_generation",
		title: "Top Spenders Remix",
		summary: "Generate new concepts from your top spending ads.",
		prompt: "Generate more ad variations based on my top 3 spending ads.",
	},
	{
		id: "best-performers-iterations",
		categoryId: "ad_generation",
		title: "Best Performers",
		summary: "Create new angles from the ads already winning on ROAS.",
		prompt: "Take my top 3 ads by ROAS and generate new ad variations that build on their success.",
	},
	{
		id: "video-script-generation",
		categoryId: "ad_generation",
		title: "Video Scripts",
		summary: "Generate fresh hooks and scripts from top videos.",
		prompt: "Analyze my best performing video ads and generate new video script concepts with fresh hooks and angles.",
	},
	{
		id: "competitor-inspired-generation",
		categoryId: "ad_generation",
		title: "Competitor Inspired",
		summary: "Turn competitor learnings into new ads for my brand.",
		prompt: "Analyze top competitor ads, then generate new ad variations for my brand inspired by their best strategies.",
	},
	{
		id: "top-performers-performance",
		categoryId: "own_performance",
		title: "Top Performers",
		summary: "See the strongest ads by ROAS with their key metrics.",
		prompt: "Show me my top performing ads sorted by ROAS. Include key metrics like spend, CTR, and impressions.",
	},
	{
		id: "video-vs-image-performance",
		categoryId: "own_performance",
		title: "Video vs Image",
		summary: "Compare how each format performs across efficiency and engagement.",
		prompt: "Compare my video ads vs image ads performance. Which format drives better ROAS and engagement?",
	},
	{
		id: "winners-vs-losers",
		categoryId: "own_performance",
		title: "Winners vs Losers",
		summary: "Break down what separates the best ads from the worst.",
		prompt: "Compare my top 3 and worst 3 performing ads. Analyze what makes the winners successful and losers underperform.",
	},
	{
		id: "winning-formula",
		categoryId: "own_performance",
		title: "Winning Formula",
		summary: "Find the patterns shared by top spenders and top ROAS ads.",
		prompt: "Analyze my top spend ads vs top ROAS ads, deep dive into their creatives, and formulate a winning creative formula.",
	},
	{
		id: "best-creative",
		categoryId: "creative_analysis",
		title: "Best Creative",
		summary: "Analyze the visual and copy choices behind your best ad.",
		prompt: "Analyze the creative of my best performing ad. What visual and copy elements make it work?",
	},
	{
		id: "success-patterns",
		categoryId: "creative_analysis",
		title: "Success Patterns",
		summary: "Spot recurring creative traits across top performers.",
		prompt: "Analyze the creative patterns across my top 5 performing ads. What do they have in common?",
	},
	{
		id: "video-deep-dive",
		categoryId: "creative_analysis",
		title: "Video Deep Dive",
		summary: "Break down hooks, messaging, and visuals in winning videos.",
		prompt: "Deep dive into my top video ad creatives. Analyze the hooks, messaging, and visual elements that drive engagement.",
	},
	{
		id: "creative-template",
		categoryId: "creative_analysis",
		title: "Creative Template",
		summary: "Turn winning creative patterns into a repeatable template.",
		prompt: "Break down the creative elements of my top 3 performers and create a repeatable creative template I can use.",
	},
	{
		id: "top-competitors",
		categoryId: "competitor_intel",
		title: "Top Competitors",
		summary: "Surface active competitor ads and their key themes.",
		prompt: "Show me top competitor ads that are currently active. Analyze their key themes and strategies.",
	},
	{
		id: "brand-spotlight",
		categoryId: "competitor_intel",
		title: "Brand Spotlight",
		summary: "Analyze the campaign strategy of a specific competitor.",
		prompt: "What campaigns is Adidas currently running? Analyze their creative approach and messaging.",
	},
	{
		id: "competitor-video-strategies",
		categoryId: "competitor_intel",
		title: "Video Strategies",
		summary: "Learn what hooks and formats competitors use in video.",
		prompt: "Analyze competitor video ad strategies. What hooks and formats are they using that we can learn from?",
	},
	{
		id: "evergreen-ads",
		categoryId: "competitor_intel",
		title: "Evergreen Ads",
		summary: "Find long-running competitor creatives and why they work.",
		prompt: "Find the longest-running competitor campaigns and analyze why they've been successful over time.",
	},
	{
		id: "quick-compare",
		categoryId: "strategic_insights",
		title: "Quick Compare",
		summary: "Get a fast read on how your ads stack up against competitors.",
		prompt: "Give me a quick comparison of how my ads perform vs what competitors are running.",
	},
	{
		id: "gap-analysis",
		categoryId: "strategic_insights",
		title: "Gap Analysis",
		summary: "Find creative approaches and formats you are not using yet.",
		prompt: "Analyze competitor ads and identify creative approaches or formats I'm not currently using.",
	},
	{
		id: "beat-competition",
		categoryId: "strategic_insights",
		title: "Beat Competition",
		summary: "Compare your best ads with a competitor and spot opportunities.",
		prompt: "Compare my top ads with Adidas' approach. Identify what they do better and opportunities for me.",
	},
	{
		id: "growth-strategy",
		categoryId: "strategic_insights",
		title: "Growth Strategy",
		summary: "Build a full creative roadmap from performance and competitor insights.",
		prompt: "Based on my top performers and competitor insights, create a winning creative strategy with specific recommendations.",
	},
];

export const getPromptsForCategory = (categoryId: string) => PROMPT_LIBRARY_ITEMS.filter((item) => item.categoryId === categoryId);

export const getPromptCategory = (categoryId: string) => PROMPT_LIBRARY_CATEGORIES.find((category) => category.id === categoryId) || null;

export const getGroupedPromptLibrary = () =>
	PROMPT_LIBRARY_CATEGORIES.map((category) => ({
		...category,
		prompts: getPromptsForCategory(category.id),
	})).filter((category) => category.prompts.length > 0);
