export type Home2SectionId = "competitor-intelligence" | "ad-performance" | "new-concepts";

export interface Home2Task {
	id: string;
	title: string;
	description: string;
	prompt: string;
}

export interface Home2Section {
	id: Home2SectionId;
	title: string;
	description: string;
	tasks: Home2Task[];
}

export const HOME2_SECTIONS: Home2Section[] = [
	{
		id: "competitor-intelligence",
		title: "Competitor Intelligence",
		description: "Track what competitors are proving in-market, then convert those signals into sharper creative moves.",
		tasks: [
			{
				id: "top-angles-formats",
				title: "Top angles and formats in my industry",
				description: "Find the strongest competitor creative patterns, repeated hooks, offers, formats, and proof points worth testing now.",
				prompt:
					"Task name: Top angles and formats in my industry. Use discovery competitor ads and inspiration examples only. Do not query the brand's own Meta Ads account, ad performance data, or any workspace integrations for this task. Analyze the latest available competitor ads and creative examples in the brand's industry. Identify the most repeated and persuasive angles, winning formats, hooks, offers, proof mechanisms, and creative structures. Prioritize signals that are recent, specific, and actionable. Use observable discovery evidence such as creative frequency, format patterns, recency, and visible messaging instead of own-account performance metrics. Recommend what should be tested next.",
			},
			{
				id: "competitor-gaps-next-steps",
				title: "Where am I missing compared to competitors?",
				description: "Compare our creative system against competitor patterns and turn the gaps into a prioritized action plan.",
				prompt:
					"Task name: Where am I missing compared to competitors? This task requires the brand's own Meta Ads account because it compares our current creative system against competitor activity. First query the brand's own Meta Ads creative and performance data, then query discovery competitor ads and inspiration examples. If Meta Ads is not connected, use the normal connection-required flow before continuing. Compare our current creative approach with competitor angles, formats, personas, offers, and proof mechanisms. Identify the biggest missing opportunities and explain why each gap matters using own-account metrics, competitor frequency, recency, or market evidence where available. Return a prioritized next-step plan.",
			},
			{
				id: "adapt-competitor-concepts",
				title: "Adapt top competitor concepts and formats",
				description: "Translate strong competitor concepts and formats into brand-safe ad ideas ready for creative production.",
				prompt:
					"Task name: Adapt top competitor concepts and formats. Use the strongest competitor concepts, angles, and formats as inspiration, then create new brand-safe ad concepts for this brand. Do not copy competitor assets verbatim. Preserve the proven strategic pattern, adapt it to the brand voice, and include hooks, visual direction, copy angles, and testing rationale.",
			},
		],
	},
	{
		id: "ad-performance",
		title: "Performance Insights",
		description: "Diagnose what is already working, then decide what to scale, refresh, or retire.",
		tasks: [
			{
				id: "why-winners-win",
				title: "Why winners win",
				description: "Diagnose the creative and performance traits behind winning ads, then recommend the next experiments.",
				prompt:
					"Task name: Why winners win. Analyze the latest available Meta Ads performance data and creative assets to diagnose why the current winning ads are winning. Focus on creative angle, format, hook, offer, audience fit, funnel role, and performance metrics. Include concrete metrics such as spend, ROAS, CTR, CPA, CVR, thumb-stop rate, or other available indicators. End with the most important next steps.",
			},
			{
				id: "scale-iterate-winners",
				title: "Scale & iterate winners",
				description: "Turn winning ads into a scale plan with focused iterations, budget guidance, and creative variants.",
				prompt:
					"Task name: Scale and iterate winners. Analyze the current winning ads in the Meta Ads account and create a scale-and-iteration plan. Identify which winners should receive more budget, which need creative refreshes, and which variants should be produced next. Use available performance metrics to justify every recommendation.",
			},
		],
	},
	{
		id: "new-concepts",
		title: "Unleash Creative Diversity",
		description: "Map the missing creative territory and generate concepts that fill meaningful gaps.",
		tasks: [
			{
				id: "creative-diversity-gap",
				title: "Find missing personas, audiences & angles",
				description: "Audit creative diversity to reveal missing personas, audiences, emotions, and angles worth exploring.",
				prompt:
					"Task name: Find missing personas, audiences, and angles. Analyze the brand's current creative mix and identify which personas, audience segments, emotional drivers, objections, use cases, and angles are underrepresented. Use performance data and creative evidence where available, then recommend the highest-impact gaps to fill next.",
			},
			{
				id: "generate-gap-concepts",
				title: "Generate concepts to fill creative gaps",
				description: "Produce new ad concepts that directly address the biggest creative diversity and performance gaps.",
				prompt:
					"Task name: Generate concepts to fill creative gaps. Based on the brand context, performance learnings, and missing creative territories, generate new ad concepts that fill the highest-impact gaps. For each concept include persona, angle, hook, visual direction, core message, and why it is expected to work.",
			},
		],
	},
];
