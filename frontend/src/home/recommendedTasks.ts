export type RecommendedTaskIcon = "competitors" | "launch" | "audit" | "fatigue";

export interface RecommendedTask {
	id: string;
	title: string;
	description: string;
	icon: RecommendedTaskIcon;
	prompt: string;
}

export const RECOMMENDED_HOME_TASKS: RecommendedTask[] = [
	{
		id: "competitor-intelligence-report",
		title: "Competitor Intelligence Analysis",
		description: "Map the angles competitors use most often, identify the ones worth testing, and turn them into a ranked creative testing plan.",
		icon: "competitors",
		prompt:
			"Task name: Competitor Intelligence Analysis.\n\nBuild a competitor intelligence analysis for Nike using the latest active competitor ads. Identify the most used and most effective creative angles, messaging themes, offers, visual patterns, and hooks worth testing. Compare those angles against Nike's current ad account where useful, then end with a prioritized testing plan.",
	},
	{
		id: "last-7-days-launch-analysis",
		title: "Last 7 Days Launch Analysis",
		description: "The fastest way to spot emerging winners, react to fresh trend shifts, and send a concise launch readout to Slack.",
		icon: "launch",
		prompt:
			"Task name: Last 7 Days Launch Analysis.\n\nAnalyze the latest available 7-day launch window of Nike ad performance to identify the newest emerging winners, fast-declining ads, and creative trends that need action. Use the most recent Nike ad data available in the connected Meta account rather than inventing calendar dates. Prioritize the latest shifts so the team can react quickly. At the end of the task, send a concise summary message to Slack with the key findings, risks, and next actions instead of only preparing a draft.",
	},
	{
		id: "ad-account-audit",
		title: "Ad Account Audit",
		description: "Run a complete diagnosis of performance, creative, account structure, and next actions with a thorough prioritized plan.",
		icon: "audit",
		prompt:
			"Task name: Ad Account Audit.\n\nRun a complete and thorough audit of Nike's ad account. Diagnose performance health, creative strengths and weaknesses, budget efficiency, underperforming patterns, scaling opportunities, and tracking risks. Finish with a prioritized action plan that separates urgent fixes, high-upside tests, and longer-term improvements.",
	},
	{
		id: "creative-fatigue-watchlist",
		title: "Creative Fatigue Watchlist",
		description: "Catch fatigue before it drains spend by finding ads with weakening signals and recommending replacement angles.",
		icon: "fatigue",
		prompt:
			"Task name: Creative Fatigue Watchlist.\n\nIdentify Nike ads that are likely entering creative fatigue by reviewing recent performance signals, spend concentration, CTR, CPC, CPA, ROAS, and creative repetition. Explain which ads need refreshes first, what replacement angles to test, and what should be monitored automatically each week.",
	},
];
