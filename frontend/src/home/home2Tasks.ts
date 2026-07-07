import type { SummaryLayout } from "../types";

export type Home2SectionId = "competitor-intelligence" | "ad-performance" | "new-concepts";

export interface Home2Task {
	id: string;
	title: string;
	description: string;
	prompt: string;
	summaryLayout?: SummaryLayout;
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
				id: "top-spending-hooks",
				title: "Get the top spending hooks in my industry",
				description: "Find competitor hooks with available or estimated spend above $50k, then explain the formats and angles behind them.",
				summaryLayout: "analysis",
				prompt:
					"Task name: Hooks with spend more than $50k in my industry. This is a competitor discovery research task. Use discoveryQuery and public competitor ad-library examples only. Interpret spend as a public or estimated competitive spend signal for competitor ads, not internal brand media data. Find competitor hooks in the brand's industry with available or estimated public spend above $50k. For each hook, name the competitor, hook wording, format, CTA, start date, spend signal or proxy evidence, and why it is worth testing. Summarize the most used and effective angles to test next.",
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
				title: "Scale my own ads using the top industry hooks",
				description: "Translate strong industry hooks into brand-safe ad ideas ready for creative production.",
				summaryLayout: "creation",
				prompt:
					"Task name: Scale my own ads using the top industry hooks. Use the strongest industry hooks, concepts, angles, and formats as inspiration, then create new brand-safe ad concepts for this brand. Do not copy competitor assets verbatim. Preserve the proven strategic pattern, adapt it to the brand voice, and include hooks, visual direction, copy angles, and testing rationale.",
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
				summaryLayout: "analysis",
				prompt:
					"Task name: Why winners win. Analyze the latest available Meta Ads performance data and creative assets to diagnose why the current winning ads are winning. Focus on creative angle, format, hook, offer, audience fit, funnel role, and performance metrics. Include concrete metrics such as spend, ROAS, CTR, CPA, CVR, thumb-stop rate, or other available indicators. End with the most important next steps.\n\nDelivery requirement: send the final concise summary message to Slack with the winning patterns, supporting metrics, and recommended next actions instead of only preparing a draft. The delivery integration is Slack, not the ad data source.",
			},
			{
				id: "scale-iterate-winners",
				title: "Scale & iterate winners",
				description: "Turn winning ads into a scale plan with focused iterations, budget guidance, and creative variants.",
				summaryLayout: "creation",
				prompt:
					"Task name: Scale and iterate winners. Analyze the current winning ads in the Meta Ads account and create a scale-and-iteration plan. Identify which winners should receive more budget, which need creative refreshes, and which variants should be produced next. Then generate concrete new creative variants for the highest-priority winners, including fresh hooks, visual concepts, copy angles, format recommendations, and testing rationale for each variant. Use available performance metrics to justify every recommendation and explain why each generated creative should improve or extend the winning pattern.",
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
				summaryLayout: "creation",
				prompt:
					"Task name: Generate concepts to fill creative gaps. Based on the brand context, performance learnings, and missing creative territories, generate new ad concepts that fill the highest-impact gaps. For each concept include persona, angle, hook, visual direction, core message, and why it is expected to work.",
			},
		],
	},
];
