import { Tool } from '../tool-base';
import { GlobalContext, getContextSummary } from '../context';
import { RunSummary, RunNextStep, RunInsight } from '../types';

const TITLE_SYSTEM_PROMPT = `You write concise task titles for a marketing analytics assistant.

Return only a 3-5 word title. No quotes, no punctuation unless part of a brand name.`;

const SUMMARY_SYSTEM_PROMPT = `You write homepage TLDR cards for completed marketing analytics agent runs.

Output valid JSON only:
{
  "insights": [
    { "emoji": "...", "title": "...", "description": "..." },
    { "emoji": "...", "title": "...", "description": "..." },
    { "emoji": "...", "title": "...", "description": "..." },
    { "emoji": "...", "title": "...", "description": "..." }
  ],
  "nextSteps": [
    { "title": "...", "prompt": "..." },
    { "title": "...", "prompt": "..." }
  ]
}

Rules:
- Exactly 4 insights.
- Each insight emoji must be one relevant emoji.
- Each insight title must be catchy, clear, plain text, and 10 words or fewer.
- Each insight description must be concise but can include enough detail: 14-30 words.
- Insight descriptions must be plain text only. Do not use markdown or bold text.
- Insights must be concrete, useful, and based on the provided reports/context.
- Strongly prioritize metric-backed insights. Include specific numbers whenever available: ROAS, CTR, CPC, spend, revenue, impressions, conversion rate, deltas, ranks, counts, or time windows.
- Do not write vague summaries if metrics exist. Tie each insight to at least one concrete metric, named asset, campaign, audience, competitor, or observed data point.
- Exactly 2 nextSteps.
- Each next step title must be 2-6 words.
- Each next step prompt must be ready to send to the agent and must be specific.
- Do not mention that you are generating JSON.
- Do not include image URLs in the JSON.`;

const fallbackNextSteps: RunNextStep[] = [
    {
        title: 'Find Test Angles',
        prompt: 'Run a follow-up analysis on this task to identify the strongest creative angles worth testing next.'
    },
    {
        title: 'Build Action Plan',
        prompt: 'Turn the findings from this task into a prioritized action plan with clear tests, owners, and expected impact.'
    }
];

const titleTool = new Tool({
    name: 'RunTitle',
    model: 'google/gemini-2.5-flash-lite',
    systemPrompt: TITLE_SYSTEM_PROMPT,
    maxTokens: 64
});

const summaryTool = new Tool({
    name: 'RunSummary',
    model: 'google/gemini-2.5-flash-lite',
    systemPrompt: SUMMARY_SYSTEM_PROMPT,
    maxTokens: 800
});

const stripCodeFences = (value: string) => value.replace(/```json/g, '').replace(/```/g, '').trim();

const extractJsonObject = (value: string) => {
    const cleaned = stripCodeFences(value);
    try {
        return JSON.parse(cleaned);
    } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) {
            throw new Error('No JSON object found');
        }
        return JSON.parse(match[0]);
    }
};

const clampWords = (value: string, maxWords: number) =>
    value
        .replace(/^["']|["']$/g, '')
        .replace(/[.!?]+$/g, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, maxWords)
        .join(' ');

const extractExplicitTaskName = (userInput: string): string | null => {
    const match = userInput.match(/Task name\s*:\s*([^\r\n]+)/i);
    if (!match) {
        return null;
    }

    const rawNameLine = match[1].trim();
    const sentenceMatch = rawNameLine.match(/^(.+?)([.!?])(?=\s+[A-Z]|\s*$)/);
    const rawName = sentenceMatch
        ? `${sentenceMatch[1]}${sentenceMatch[2] === '?' || sentenceMatch[2] === '!' ? sentenceMatch[2] : ''}`
        : rawNameLine;
    const taskName = rawName
        .replace(/^["']|["']$/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    return taskName || null;
};

const buildFallbackTitle = (userInput: string) => clampWords(userInput, 5) || 'Marketing Analysis';

const unique = (values: string[]) => {
    const seen = new Set<string>();
    return values.filter((value) => {
        const normalized = value.trim();
        if (!normalized || seen.has(normalized)) {
            return false;
        }
        seen.add(normalized);
        return true;
    });
};

const collectImageUrls = (context: GlobalContext): string[] => {
    const generatedImages = [...context.generationResults].reverse().flatMap((result) =>
        result.imageConcepts?.map((concept) => concept.imageDataUrl).filter(Boolean) ?? []
    );
    const focusImages = [...context.focusItemSets].reverse().flatMap((focusSet) => focusSet.items.map((item) => item.thumbnail).filter(Boolean) as string[]);
    const ownAdImages = [...context.dataSets].reverse().flatMap((dataSet) => dataSet.data.map((ad) => ad.image_url).filter(Boolean) as string[]);
    const discoveryImages = [...context.discoveryDataSets].reverse().flatMap((dataSet) => dataSet.data.map((ad) => ad.image_url).filter(Boolean));

    return unique([...generatedImages, ...focusImages, ...ownAdImages, ...discoveryImages]);
};

const collectReportSnippets = (context: GlobalContext): string => {
    const snippets = [
        ...context.consolidationReports.slice(-2).map((report) => report.content),
        ...context.analysisReports.slice(-2).map((report) => report.content),
        ...context.creativeReports.slice(-4).map((report) => `Creative report for ${report.itemName}:\n${report.content}`),
        ...context.integrationResults.slice(-3).map((result) => `${result.title}\n${result.content}`)
    ];

    return snippets
        .join('\n\n---\n\n')
        .replace(/\s+/g, ' ')
        .slice(0, 9000);
};

const titleFromDescription = (description: string) =>
    clampWords(
        description
            .replace(/\*\*/g, '')
            .replace(/[`*_~#>-]/g, '')
            .replace(/\s+/g, ' ')
            .trim(),
        10
    ) || 'Key Signal';

const fallbackInsightEmojis = ['💡', '📈', '🎯', '⚡'];

const normalizeInsights = (value: unknown): RunInsight[] => {
    const source = Array.isArray(value) ? value : [];
    const insights = source
        .map((item, index) => {
            if (typeof item === 'string') {
                const description = item.trim();
                return {
                    emoji: fallbackInsightEmojis[index % fallbackInsightEmojis.length],
                    title: titleFromDescription(description),
                    description: description.replace(/\*\*/g, '')
                };
            }

            const candidate = item as Partial<RunInsight> | null | undefined;
            const description = String(candidate?.description || '').replace(/\*\*/g, '').trim();
            return {
                emoji: clampWords(String(candidate?.emoji || fallbackInsightEmojis[index % fallbackInsightEmojis.length]), 1),
                title: clampWords(String(candidate?.title || titleFromDescription(description)), 10),
                description
            };
        })
        .filter((item) => item.title && item.description)
        .slice(0, 4);

    while (insights.length < 4) {
        const fallback = [
            { emoji: '💡', title: 'Performance Signal Needs Review', description: 'Performance signal needs a closer read before scaling decisions.' },
            { emoji: '📈', title: 'Creative Pattern Ready', description: 'Creative pattern is ready to translate into a sharper test.' },
            { emoji: '🎯', title: 'Audience Response Is Promising', description: 'Audience response points to one or two promising next angles.' },
            { emoji: '⚡', title: 'Next Action Is Clear', description: 'Next action should focus on the highest-confidence opportunity.' }
        ][insights.length];
        insights.push(fallback);
    }

    return insights;
};

const normalizeNextSteps = (value: unknown): RunNextStep[] => {
    const source = Array.isArray(value) ? value : [];
    const steps = source
        .map((item) => ({
            title: clampWords(String(item?.title || ''), 6),
            prompt: String(item?.prompt || '').trim()
        }))
        .filter((item) => item.title && item.prompt)
        .slice(0, 2);

    while (steps.length < 2) {
        steps.push(fallbackNextSteps[steps.length]);
    }

    return steps;
};

class RunMetadataTool {
    async generateTitle(userInput: string): Promise<string> {
        const explicitTaskName = extractExplicitTaskName(userInput);
        if (explicitTaskName) {
            return explicitTaskName;
        }

        try {
            titleTool.clearHistory();
            const response = await titleTool.process(`Task request:\n${userInput}`);
            const title = clampWords(response, 5);
            return title || buildFallbackTitle(userInput);
        } catch {
            return buildFallbackTitle(userInput);
        }
    }

    async generateSummary(userInput: string, context: GlobalContext): Promise<RunSummary> {
        const imageUrls = collectImageUrls(context);
        const reportSnippets = collectReportSnippets(context);

        try {
            summaryTool.clearHistory();
            const response = await summaryTool.process(`
Task request:
${userInput}

Context summary:
${getContextSummary(context)}

Report and result snippets:
${reportSnippets || 'No detailed reports were generated.'}

Create the JSON TLDR now.`);

            const parsed = extractJsonObject(response);
            return {
                imageUrls,
                insights: normalizeInsights(parsed.insights),
                nextSteps: normalizeNextSteps(parsed.nextSteps)
            };
        } catch {
            return {
                imageUrls,
                insights: normalizeInsights([]),
                nextSteps: fallbackNextSteps
            };
        }
    }
}

export const runMetadataTool = new RunMetadataTool();
