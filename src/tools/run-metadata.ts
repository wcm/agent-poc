import { Tool } from '../tool-base';
import { GlobalContext, getContextSummary } from '../context';
import { RunSummary, RunNextStep, RunInsight, SummaryChart, SummaryCreative, SummaryLayout } from '../types';
import { logger } from '../utils/logger';

const TITLE_SYSTEM_PROMPT = `You write concise task titles for a marketing analytics assistant.

Return only a 3-5 word title. No quotes, no punctuation unless part of a brand name.`;

const SUMMARY_SYSTEM_PROMPT = `You write homepage TLDR cards for completed marketing analytics agent runs.

Output valid JSON only:
{
  "overview": "One concise sentence describing the completed run.",
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
- JSON validity is mandatory. Return exactly one JSON object and nothing else.
- Use double quotes for all keys and string values.
- Keep every string value on one line.
- Avoid double quote characters inside string values; if unavoidable, escape them as \\".
- Do not include trailing commas, comments, markdown fences, or prose outside the JSON object.
- Separate every object in arrays with a comma.
- If the summary layout is "creation", set insights to [].
- If the summary layout is "analysis" or "default", provide exactly 4 insights.
- overview must be 16-32 words, plain text, and summarize the result without next-step language.
- For creation summaries, overview should describe the generated creative output and testing direction, not analysis findings.
- For analysis/default summaries, the 4 insights must directly answer and resolve the task named in "Task name:" from the request. Do not write generic run summaries.
- Each insight must be phrased as part of the answer to the task, not as background context. For example, for "Where am I missing compared to competitors?", every insight must identify a specific missing gap, why it matters, and the evidence behind it.
- If the task asks "why", insight titles must state the reason. If the task asks "where am I missing", titles must state the missing area. If the task asks "what to test", titles must state the testable angle/format.
- Each insight emoji must be one relevant emoji.
- Each insight title must be catchy, clear, plain text, and 10 words or fewer.
- For analysis/default summaries, each insight description should be data-dense and useful: 20-40 words maximum.
- For descriptions, preserve the most important metric or named asset and remove filler words.
- Insight descriptions must be plain text only. Do not use markdown or bold text.
- Insights must be concrete, useful, and based on the provided reports/context.
- Treat the Structured evidence block as the highest-priority source. Use the detailed report snippets only to explain why the evidence matters.
- For every analysis/default insight, include at least one specific anchor: an exact metric, count, date, ad name, creative name, campaign, competitor, headline, angle, hook, format, CTA, audience, or offer.
- Strongly prioritize metric-backed insights. Include specific numbers whenever available: ROAS, CTR, CPC, CPA, spend, revenue, impressions, conversion rate, deltas, ranks, counts, or time windows.
- If own performance metrics exist, at least 3 of the 4 insights must include numeric metrics.
- If the run is competitor/discovery-only, use concrete competitor names, ad headlines, hooks, formats, CTAs, start dates, or counts instead of performance metrics.
- Do not invent metrics. If metrics are unavailable, say the concrete observed creative signal instead.
- Avoid generic statements like "creative patterns emerged" or "performance needs review" unless they include the exact data point or ad concept that proves it.
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
    maxTokens: 1100
});

const stripCodeFences = (value: string) => value.replace(/```json/g, '').replace(/```/g, '').trim();

const SUMMARY_JSON_KEYS = [
    'overview',
    'insights',
    'emoji',
    'title',
    'description',
    'nextSteps',
    'prompt',
    'charts',
    'creatives',
    'imageUrls'
];

const repairCommonJsonSyntax = (value: string) => {
    const keyPattern = SUMMARY_JSON_KEYS.join('|');
    return value
        .replace(/}\s*\n\s*(?=\{)/g, '},\n')
        .replace(new RegExp(`([}\\]"])\\s*\\n\\s*("(?:${keyPattern})"\\s*:)`, 'g'), '$1,\n$2')
        .replace(/,\s*([}\]])/g, '$1');
};

const parseJsonWithCommonRepair = (value: string) => {
    try {
        return JSON.parse(value);
    } catch (firstError) {
        const repaired = repairCommonJsonSyntax(value);
        if (repaired !== value) {
            try {
                return JSON.parse(repaired);
            } catch {
                // Keep the original parse error because it points to the model output.
            }
        }
        throw firstError;
    }
};

const extractJsonObject = (value: string) => {
    const cleaned = stripCodeFences(value);
    try {
        return parseJsonWithCommonRepair(cleaned);
    } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) {
            throw new Error('No JSON object found');
        }
        return parseJsonWithCommonRepair(match[0]);
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
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 12000);
};

const formatNumber = (value: unknown, options: Intl.NumberFormatOptions = {}) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return null;
    }

    return new Intl.NumberFormat('en-US', options).format(numeric);
};

const formatMetric = (label: string, value: unknown, formatter: (value: number) => string) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return null;
    }

    return `${label} ${formatter(numeric)}`;
};

const formatCurrency = (value: number) =>
    `$${formatNumber(value, {
        maximumFractionDigits: value >= 100 ? 0 : 2
    })}`;

const formatPercent = (value: number) => `${formatNumber(value, { maximumFractionDigits: 2 })}%`;

const formatCompactNumber = (value: number) =>
    formatNumber(value, {
        notation: Math.abs(value) >= 10000 ? 'compact' : 'standard',
        maximumFractionDigits: 1
    }) || String(value);

const getOwnAdName = (ad: any, index: number) =>
    String(ad.ad_name || ad.creative_name || ad.headline || ad.group_value || `Ad ${index + 1}`).replace(/\s+/g, ' ').trim();

const cleanInlineText = (value: unknown, maxLength = 120) => {
    const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) {
        return '';
    }

    return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1).trim()}…` : cleaned;
};

const formatOwnAdEvidence = (ad: any, index: number) => {
    const metrics = ad.metrics || {};
    const metricParts = [
        formatMetric('ROAS', metrics.roas, (value) => `${formatNumber(value, { maximumFractionDigits: 2 })}x`),
        formatMetric('spend', metrics.spend, formatCurrency),
        formatMetric('CTR', metrics.ctr, formatPercent),
        formatMetric('CPA', metrics.cpa, formatCurrency),
        formatMetric('CPC', metrics.cpc, formatCurrency),
        formatMetric('revenue', metrics.purchase_value, formatCurrency),
        formatMetric('impressions', metrics.impressions, formatCompactNumber)
    ].filter(Boolean);
    const descriptors = [
        ad.display_format ? `format ${ad.display_format}` : null,
        ad.headline ? `headline "${cleanInlineText(ad.headline, 70)}"` : null,
        ad.ad_copy ? `copy "${cleanInlineText(ad.ad_copy, 90)}"` : null
    ].filter(Boolean);

    return `- ${getOwnAdName(ad, index)}: ${[...metricParts, ...descriptors].join('; ')}`;
};

const formatDiscoveryEvidence = (ad: any, index: number) => {
    const parts = [
        ad.headline ? `headline "${cleanInlineText(ad.headline, 80)}"` : null,
        ad.ad_copy ? `copy "${cleanInlineText(ad.ad_copy, 110)}"` : null,
        ad.display_format ? `format ${ad.display_format}` : null,
        ad.cta ? `CTA ${ad.cta}` : null,
        ad.start_date ? `started ${ad.start_date}` : null,
        Array.isArray(ad.platforms) && ad.platforms.length > 0 ? `platforms ${ad.platforms.join(', ')}` : null
    ].filter(Boolean);

    return `- ${ad.brand_name || `Competitor ${index + 1}`}: ${parts.join('; ')}`;
};

const formatFocusItemEvidence = (item: any, index: number) => {
    const metrics = item.metrics || {};
    const metricParts = [
        formatMetric('ROAS', metrics.roas, (value) => `${formatNumber(value, { maximumFractionDigits: 2 })}x`),
        formatMetric('spend', metrics.spend, formatCurrency),
        formatMetric('CTR', metrics.ctr, formatPercent),
        formatMetric('CPC', metrics.cpc, formatCurrency),
        formatMetric('impressions', metrics.impressions, formatCompactNumber)
    ].filter(Boolean);
    const descriptors = [item.displayFormat ? `format ${item.displayFormat}` : null, item.type ? `type ${item.type}` : null].filter(Boolean);

    return `- ${item.name || `Focused item ${index + 1}`}: ${[...metricParts, ...descriptors].join('; ')}`;
};

const extractEvidenceLines = (content: string, maxLines: number): string[] => {
    const evidencePattern =
        /\b(\d+(?:\.\d+)?%?|\$|ROAS|CTR|CPA|CPC|spend|revenue|impressions|conversion|winner|loser|top|bottom|hook|angle|format|CTA|competitor|headline|creative|ad\s|campaign|audience|offer)\b/i;
    const lines = content
        .replace(/\|[-:\s|]+\|/g, '\n')
        .split(/\n|(?<=[.!?])\s+(?=[A-Z0-9])/)
        .map((line) =>
            line
                .replace(/^#+\s*/, '')
                .replace(/^[-*]\s*/, '')
                .replace(/\*\*/g, '')
                .replace(/\s+/g, ' ')
                .trim()
        )
        .filter((line) => line.length >= 28 && line.length <= 260 && evidencePattern.test(line));

    return unique(lines).slice(0, maxLines);
};

const collectStructuredEvidence = (context: GlobalContext): string => {
    const sections: string[] = [];
    const latestOwnDataSets = [...context.dataSets].reverse().filter((dataSet) => dataSet.data.length > 0).slice(0, 2);
    const latestDiscoveryDataSets = [...context.discoveryDataSets].reverse().filter((dataSet) => dataSet.data.length > 0).slice(0, 2);
    const latestFocusSet = [...context.focusItemSets].reverse().find((focusSet) => focusSet.items.length > 0);

    latestOwnDataSets.forEach((dataSet, dataSetIndex) => {
        sections.push(
            [
                `Own performance dataset ${dataSetIndex + 1}: ${dataSet.queryDescription} (${dataSet.data.length} rows)`,
                ...dataSet.data.slice(0, 8).map(formatOwnAdEvidence)
            ].join('\n')
        );
    });

    latestDiscoveryDataSets.forEach((dataSet, dataSetIndex) => {
        sections.push(
            [
                `Competitor/discovery dataset ${dataSetIndex + 1}: ${dataSet.queryDescription} (${dataSet.data.length} rows)`,
                ...dataSet.data.slice(0, 8).map(formatDiscoveryEvidence)
            ].join('\n')
        );
    });

    if (latestFocusSet) {
        sections.push(
            [`Focused items selected: ${latestFocusSet.summary} (${latestFocusSet.items.length} items)`, ...latestFocusSet.items.slice(0, 6).map(formatFocusItemEvidence)].join(
                '\n'
            )
        );
    }

    const reportEvidenceLines = [
        ...context.consolidationReports.slice(-2).flatMap((report) => extractEvidenceLines(report.content, 5)),
        ...context.analysisReports.slice(-2).flatMap((report) => extractEvidenceLines(report.content, 4)),
        ...context.creativeReports.slice(-4).flatMap((report) =>
            extractEvidenceLines(`Creative report for ${report.itemName}: ${report.content}`, 3)
        )
    ];

    if (reportEvidenceLines.length > 0) {
        sections.push(['Concrete report findings:', ...unique(reportEvidenceLines).slice(0, 14).map((line) => `- ${line}`)].join('\n'));
    }

    return sections.join('\n\n').slice(0, 14000);
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

const getInsightsSource = (parsed: any): unknown => parsed?.insights;

const normalizeInsights = (value: unknown): RunInsight[] => {
    const source = Array.isArray(value) ? value : [];
    return source
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

const normalizeOverview = (value: unknown, layout: SummaryLayout): string => {
    const overview = String(value || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    if (overview) {
        return overview;
    }

    switch (layout) {
        case 'analysis':
            return 'Raya analyzed the strongest signals and packaged the evidence into a concise readout with chart-ready context.';
        case 'creation':
            return 'Raya translated the strongest signals into creative directions that can move directly into testing or production.';
        default:
            return 'Raya completed the run and condensed the most useful findings into a short summary.';
    }
};

const isSummaryLayout = (value: unknown): value is SummaryLayout => value === 'analysis' || value === 'creation' || value === 'default';

const resolveSummaryLayout = (userInput: string, context: GlobalContext): SummaryLayout => {
    const explicitLayout = context.runMetadata?.summaryLayout;
    if (isSummaryLayout(explicitLayout)) {
        return explicitLayout;
    }

    const input = `${context.runMetadata?.taskId || ''} ${userInput}`.toLowerCase();
    if (
        input.includes('scale and iterate') ||
        input.includes('adapt top competitor') ||
        input.includes('generate concepts') ||
        input.includes('creative variants') ||
        input.includes('new creative') ||
        input.includes('new ads')
    ) {
        return 'creation';
    }

    if (
        input.includes('top angles') ||
        input.includes('why winners win') ||
        input.includes('analysis') ||
        input.includes('diagnose') ||
        input.includes('audit')
    ) {
        return 'analysis';
    }

    return 'default';
};

const formatLabel = (value: string, fallback: string) => {
    const cleaned = value.replace(/\s+/g, ' ').trim();
    if (!cleaned) {
        return fallback;
    }
    return cleaned.length > 18 ? `${cleaned.slice(0, 16).trim()}…` : cleaned;
};

const getOwnAdLabel = (ad: any, index: number) =>
    formatLabel(ad.ad_name || ad.creative_name || ad.headline || ad.group_value || `Ad ${index + 1}`, `Ad ${index + 1}`);

const getChartValue = (value: unknown, fallback: number) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : fallback;
};

const countBy = <T>(items: T[], getKey: (item: T) => string | undefined): Array<{ label: string; value: number }> => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
        const key = getKey(item)?.trim();
        if (!key) {
            return;
        }
        counts.set(key, (counts.get(key) || 0) + 1);
    });

    return [...counts.entries()]
        .map(([label, value]) => ({ label: formatLabel(label, label), value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 4);
};

const formatMetricLabel = (metric: string) => {
    const labels: Record<string, string> = {
        roas: 'ROAS',
        ctr: 'CTR',
        spend: 'Spend',
        impressions: 'Impressions',
        cost_per_lead: 'CPL',
        cpa: 'CPA',
        cpc: 'CPC'
    };
    return labels[metric] || metric.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const normalizeSeriesValues = (points: Array<{ label: string; value: number }>): Array<{ label: string; value: number }> => {
    const max = Math.max(...points.map((point) => point.value), 0);
    if (max <= 0) {
        return points.map((point) => ({ ...point, value: 0 }));
    }

    return points.map((point) => ({
        label: point.label,
        value: Math.round((point.value / max) * 100)
    }));
};

const OWN_LINE_METRICS: Array<keyof GlobalContext['dataSets'][number]['data'][number]['metrics']> = ['roas', 'ctr', 'spend'];

const buildAnalysisCharts = (context: GlobalContext): SummaryChart[] => {
    const latestOwnDataSet = [...context.dataSets].reverse().find((dataSet) => dataSet.data.length > 0);
    const latestDiscoveryDataSet = [...context.discoveryDataSets].reverse().find((dataSet) => dataSet.data.length > 0);
    const ownChartAds = latestOwnDataSet?.data.slice(0, 6) ?? [];
    const discoveryChartAds = latestDiscoveryDataSet?.data.slice(0, 6) ?? [];

    const lineChart: SummaryChart = latestOwnDataSet
        ? {
              id: 'analysis-performance-line',
              type: 'line',
              title: 'Winner signal trend',
              unit: 'indexed',
              points: ownChartAds.map((ad, index) => ({
                  label: getOwnAdLabel(ad, index),
                  value: getChartValue(ad.metrics?.roas, 2.5 + index * 0.7)
              })),
              series: OWN_LINE_METRICS.map((metric) => ({
                  label: formatMetricLabel(metric),
                  points: normalizeSeriesValues(
                      ownChartAds.map((ad, index) => ({
                          label: getOwnAdLabel(ad, index),
                          value: getChartValue(ad.metrics?.[metric], metric === 'spend' ? 10000 + index * 1200 : 2.5 + index * 0.7)
                      }))
                  )
              }))
          }
        : {
              id: 'analysis-momentum-line',
              type: 'line',
              title: 'Competitor signal trend',
              unit: 'score',
              points: discoveryChartAds.map((ad, index) => ({
                  label: formatLabel(ad.brand_name || ad.headline || `Signal ${index + 1}`, `Signal ${index + 1}`),
                  value: 42 + index * 9 + ((ad.headline || ad.ad_copy || '').length % 11)
              })),
              series: ['Recency', 'Format', 'Message'].map((label, seriesIndex) => ({
                  label,
                  points: discoveryChartAds.map((ad, index) => ({
                      label: formatLabel(ad.brand_name || ad.headline || `Signal ${index + 1}`, `Signal ${index + 1}`),
                      value: 36 + index * (8 + seriesIndex) + ((ad.headline || ad.ad_copy || '').length % (9 + seriesIndex * 2))
                  }))
              }))
          };

    if (lineChart.points.length === 0) {
        lineChart.points = [
            { label: 'Mon', value: 42 },
            { label: 'Tue', value: 48 },
            { label: 'Wed', value: 57 },
            { label: 'Thu', value: 63 },
            { label: 'Fri', value: 71 }
        ];
        lineChart.series = [
            { label: 'ROAS', points: lineChart.points },
            {
                label: 'CTR',
                points: [
                    { label: 'Mon', value: 38 },
                    { label: 'Tue', value: 45 },
                    { label: 'Wed', value: 52 },
                    { label: 'Thu', value: 58 },
                    { label: 'Fri', value: 66 }
                ]
            }
        ];
    }

    const ownFormatCounts = latestOwnDataSet ? countBy(latestOwnDataSet.data, (ad) => ad.display_format || 'image') : [];
    const discoveryFormatCounts = latestDiscoveryDataSet ? countBy(latestDiscoveryDataSet.data, (ad) => ad.display_format || 'image') : [];
    const brandCounts = latestDiscoveryDataSet ? countBy(latestDiscoveryDataSet.data, (ad) => ad.brand_name) : [];
    const topOwnBars = latestOwnDataSet
        ? latestOwnDataSet.data.slice(0, 5).map((ad, index) => ({
              label: getOwnAdLabel(ad, index),
              value: getChartValue(ad.metrics?.roas, 2.5 + index * 0.7)
          }))
        : [];
    const topDiscoveryBars = latestDiscoveryDataSet
        ? latestDiscoveryDataSet.data.slice(0, 5).map((ad, index) => ({
              label: formatLabel(ad.brand_name || ad.headline || `Signal ${index + 1}`, `Signal ${index + 1}`),
              value: 30 + index * 8 + ((ad.headline || ad.ad_copy || '').length % 12)
          }))
        : [];
    const barPoints = topOwnBars.length > 0 ? topOwnBars : topDiscoveryBars;

    const donutPoints = ownFormatCounts.length > 1 ? ownFormatCounts : discoveryFormatCounts.length > 1 ? discoveryFormatCounts : brandCounts;

    return [
        lineChart,
        {
            id: 'analysis-mix-donut',
            type: 'donut',
            title: donutPoints.length > 0 ? 'Signal mix' : 'Angle mix',
            points:
                donutPoints.length > 0
                    ? donutPoints
                    : [
                          { label: 'Product proof', value: 38 },
                          { label: 'Lifestyle', value: 26 },
                          { label: 'Offer', value: 21 },
                          { label: 'UGC', value: 15 }
                      ]
        },
        {
            id: 'analysis-ranked-bar',
            type: 'bar',
            title: topOwnBars.length > 0 ? 'Top ads by ROAS' : 'Top signal strength',
            unit: topOwnBars.length > 0 ? 'ROAS' : 'score',
            points:
                barPoints.length > 0
                    ? barPoints
                    : [
                          { label: 'Product proof', value: 74 },
                          { label: 'Lifestyle', value: 62 },
                          { label: 'Offer', value: 55 },
                          { label: 'UGC', value: 48 }
                      ]
        }
    ];
};

const conceptTags = (concept: { personas?: string[]; creative_tags?: { ad_angles?: string[]; emotion?: string[]; themes?: string[] } }) =>
    unique([
        ...(concept.personas || []),
        ...(concept.creative_tags?.ad_angles || []),
        ...(concept.creative_tags?.emotion || []),
        ...(concept.creative_tags?.themes || [])
    ]).slice(0, 4);

const getScriptPreview = (script: string): string => {
    const narrationMatch = script.match(/(?:Narration|VO|Speaker):\s*"?([^"\n]+)/i);
    if (narrationMatch) {
        return narrationMatch[1].trim();
    }

    const hookSectionMatch = script.match(/\bHOOK\b[\s\S]*?(?:\n|\r\n)([^\n\r]+)/i);
    if (hookSectionMatch) {
        return hookSectionMatch[1].replace(/[()"]/g, '').trim();
    }

    const firstLine = script.split(/\r?\n/).find((line) => line.trim().length > 0);
    return firstLine?.trim().slice(0, 100) || 'Video script concept';
};

const getScriptNarrations = (script: string): string[] => {
    const narrationMatches = [...script.matchAll(/(?:Narration|VO|Speaker|Voiceover):\s*"?([^"\n]+)/gi)]
        .map((match) => match[1]?.replace(/\s+/g, ' ').trim())
        .filter(Boolean) as string[];

    if (narrationMatches.length > 0) {
        return unique(narrationMatches).slice(0, 3);
    }

    const sceneLines = script
        .split(/\r?\n/)
        .map((line) => line.replace(/^\[[^\]]+\]\s*[A-Z ]+\s*/i, '').replace(/[()"]/g, '').trim())
        .filter((line) => line.length > 12 && !/^audio:/i.test(line) && !/^on-screen text:/i.test(line));

    return unique(sceneLines).slice(0, 3);
};

const normalizeScriptLabel = (value: string, index: number): string => {
    const fallbackLabels = ['Hook', 'Problem / Desire', 'Solution'];
    const cleaned = value
        .replace(/scene\s*\d+\s*[-:]\s*/i, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleaned) {
        return fallbackLabels[index] || `Beat ${index + 1}`;
    }

    return cleaned
        .toLowerCase()
        .split(' ')
        .map((word) => (word === '/' ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`))
        .join(' ');
};

const getScriptSections = (script: string): Array<{ label: string; narration: string }> => {
    const sceneMatches = [...script.matchAll(/\[(?:[^\]]+)\]\s*([A-Z][A-Z /\-]*)\s*([\s\S]*?)(?=\n\s*\[(?:[^\]]+)\]\s*[A-Z]|\s*$)/gi)];
    const sections = sceneMatches
        .map((match, index) => {
            const body = match[2] || '';
            const narrationMatch = body.match(/(?:Narration|VO|Speaker|Voiceover|Audio\/VO):\s*"?([^"\n]+)/i);
            const fallbackLine = body
                .split(/\r?\n/)
                .map((line) => line.replace(/[()"]/g, '').trim())
                .find((line) => line.length > 12 && !/^visual:/i.test(line) && !/^audio:/i.test(line) && !/^on-screen text:/i.test(line));
            const narration = (narrationMatch?.[1] || fallbackLine || '').replace(/\s+/g, ' ').trim();
            return {
                label: normalizeScriptLabel(match[1] || '', index),
                narration
            };
        })
        .filter((section) => section.narration)
        .slice(0, 3);

    if (sections.length > 0) {
        return sections;
    }

    return getScriptNarrations(script).map((narration, index) => ({
        label: normalizeScriptLabel('', index),
        narration
    }));
};

const buildCreationFallbacks = (userInput: string): SummaryCreative[] => {
    const isScaleTask = userInput.toLowerCase().includes('scale');
    return [
        {
            id: 'mock-creative-1',
            title: isScaleTask ? 'Winner Refresh' : 'Competitor Pattern Remix',
            format: 'concept',
            description: isScaleTask ? 'Refresh the strongest winner with a sharper hook.' : 'Reframe a proven competitor structure for the brand.',
            rationale: 'Keeps the proven strategic pattern while giving the team a fresh execution to test.',
            tags: ['Hook refresh', 'Product hero', 'Fast test']
        },
        {
            id: 'mock-creative-2',
            title: isScaleTask ? 'Format Extension' : 'Format Transfer',
            format: 'concept',
            description: isScaleTask ? 'Move the winning idea into a second high-fit format.' : 'Translate the observed format into a new brand-safe ad.',
            rationale: 'Expands reach without abandoning the evidence behind the original winner.',
            tags: ['Format test', 'Creative system', 'Iteration']
        },
        {
            id: 'mock-creative-3',
            title: isScaleTask ? 'Audience Variant' : 'Angle Variant',
            format: 'concept',
            description: isScaleTask ? 'Tailor the winner for a nearby persona.' : 'Turn the same pattern toward a different buyer motivation.',
            rationale: 'Tests whether the insight generalizes across a second audience or angle.',
            tags: ['Persona', 'Angle', 'Validation']
        }
    ];
};

const buildCreationCreatives = (context: GlobalContext, userInput: string): SummaryCreative[] => {
    const concepts = [...context.generationResults]
        .reverse()
        .flatMap((result) => {
            const imageConcepts =
                result.imageConcepts?.map((concept, index): SummaryCreative => ({
                    id: `${result.id}-image-${index}`,
                    title: concept.concept_name || `Image concept ${index + 1}`,
                    format: 'image',
                    description: concept.concept_description,
                    rationale: concept.concept_summary || concept.concept_detail || 'Generated from the strongest available creative signal.',
                    tags: conceptTags(concept),
                    imageUrl: concept.imageDataUrl || undefined
                })) ?? [];

            const videoConcepts =
                result.videoConcepts?.map((concept, index): SummaryCreative => ({
                    id: `${result.id}-video-${index}`,
                    title: concept.concept_name || `Video concept ${index + 1}`,
                    format: 'video',
                    description: concept.concept_description,
                    rationale: concept.concept_summary || concept.concept_detail || 'Generated from the strongest available creative signal.',
                    tags: conceptTags(concept),
                    scriptPreview: getScriptPreview(concept.script || ''),
                    scriptNarrations: getScriptNarrations(concept.script || ''),
                    scriptSections: getScriptSections(concept.script || '')
                })) ?? [];

            return [...imageConcepts, ...videoConcepts];
        })
        .filter((creative) => creative.title && creative.rationale)
        .slice(0, 12);

    return concepts.length > 0 ? concepts : buildCreationFallbacks(userInput);
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
        const structuredEvidence = collectStructuredEvidence(context);
        const reportSnippets = collectReportSnippets(context);
        const layout = resolveSummaryLayout(userInput, context);
        const taskName = extractExplicitTaskName(userInput) || context.runMetadata?.taskId || 'Untitled task';
        const buildErrorSummary = (input: {
            title: string;
            message: string;
            details?: string;
            rawResponse?: string;
            parsedKeys?: string[];
        }): RunSummary => {
            const creatives = layout === 'creation' ? buildCreationCreatives(context, userInput) : undefined;
            const creativeImageUrls = creatives?.map((creative) => creative.imageUrl).filter(Boolean) as string[] | undefined;
            return {
                layout,
                overview: 'Run summary generation failed. The error details are shown below so the schema problem can be fixed.',
                error: {
                    ...input,
                    rawResponse: input.rawResponse?.slice(0, 1600)
                },
                imageUrls: unique([...(creativeImageUrls || []), ...imageUrls]),
                insights: [],
                nextSteps: [],
                charts: layout === 'analysis' ? buildAnalysisCharts(context) : undefined,
                creatives
            };
        };
        const buildPrompt = (extraInstruction = '') => `
Task request:
${userInput}

Task name to answer directly:
${taskName}

Context summary:
${getContextSummary(context)}

Structured evidence:
${structuredEvidence || 'No structured evidence was available. Use report snippets if they contain concrete data.'}

Report and result snippets:
${reportSnippets || 'No detailed reports were generated.'}

Summary layout:
${layout}

${extraInstruction}

For analysis/default layouts, write the insights as the direct answer to "${taskName}". If an insight does not help resolve that named task, do not include it.

Create the JSON TLDR now.`;

        try {
            summaryTool.clearHistory();
            let response = await summaryTool.process(buildPrompt());
            let parsed: any;
            try {
                parsed = extractJsonObject(response);
            } catch (parseError: any) {
                logger.log('ERROR', { component: 'RunMetadataTool', action: 'SUMMARY_JSON_PARSE' }, 'Summary response was invalid JSON. Retrying with stricter instructions.', {
                    taskId: context.runMetadata?.taskId,
                    layout,
                    error: parseError?.message || String(parseError),
                    rawPreview: response.slice(0, 1200)
                });

                const retryInstruction = `The previous RunSummary response was invalid JSON: ${parseError?.message || String(parseError)}.
Regenerate the summary from scratch using the evidence above.
Return ONLY one valid JSON object matching the exact schema.
Do not copy the invalid response.
Keep every string on one line.
Avoid quote characters inside string values; use plain names without surrounding quotes.
Use commas between every array item and no trailing commas.
For analysis/default layouts, return exactly 4 insight objects and exactly 2 nextSteps.`;

                response = await summaryTool.process(buildPrompt(retryInstruction));
                try {
                    parsed = extractJsonObject(response);
                } catch (retryError: any) {
                    logger.log('ERROR', { component: 'RunMetadataTool', action: 'SUMMARY_JSON_RETRY' }, 'Summary retry also returned invalid JSON.', {
                        taskId: context.runMetadata?.taskId,
                        layout,
                        error: retryError?.message || String(retryError),
                        rawPreview: response.slice(0, 1200)
                    });

                    return buildErrorSummary({
                        title: 'Summary generation error',
                        message: retryError?.message || String(retryError),
                        details: `Layout: ${layout}. Task id: ${context.runMetadata?.taskId || 'none'}. JSON retry failed after the first parse error: ${parseError?.message || String(parseError)}.`,
                        rawResponse: response
                    });
                }
            }
            const insights = layout === 'creation' ? [] : normalizeInsights(getInsightsSource(parsed));

            if (layout !== 'creation' && insights.length < 4) {
                const parsedKeys = parsed && typeof parsed === 'object' ? Object.keys(parsed) : [];
                const insightSource = getInsightsSource(parsed);
                logger.log('ERROR', { component: 'RunMetadataTool', action: 'SUMMARY_INSIGHTS' }, 'Summary response did not include 4 usable insights.', {
                    taskId: context.runMetadata?.taskId,
                    layout,
                    parsedKeys,
                    insightSourceType: Array.isArray(insightSource) ? 'array' : typeof insightSource,
                    usableInsights: insights.length,
                    rawPreview: response.slice(0, 1200)
                });

                return buildErrorSummary({
                    title: 'Summary insights missing',
                    message: `RunSummary returned ${insights.length} usable insights for a ${layout} summary. Expected exactly 4.`,
                    details: `Parsed keys: ${parsedKeys.length > 0 ? parsedKeys.join(', ') : 'none'}. insights source type: ${Array.isArray(insightSource) ? 'array' : typeof insightSource}.`,
                    rawResponse: response,
                    parsedKeys
                });
            }

            const creatives = layout === 'creation' ? buildCreationCreatives(context, userInput) : undefined;
            const creativeImageUrls = creatives?.map((creative) => creative.imageUrl).filter(Boolean) as string[] | undefined;
            return {
                layout,
                overview: normalizeOverview(parsed.overview, layout),
                imageUrls: unique([...(creativeImageUrls || []), ...imageUrls]),
                insights,
                nextSteps: normalizeNextSteps(parsed.nextSteps),
                charts: layout === 'analysis' ? buildAnalysisCharts(context) : undefined,
                creatives
            };
        } catch (error: any) {
            logger.log('ERROR', { component: 'RunMetadataTool', action: 'SUMMARY_ERROR' }, 'Summary generation failed.', {
                taskId: context.runMetadata?.taskId,
                layout,
                error: error?.message || String(error)
            });
            return buildErrorSummary({
                title: 'Summary generation error',
                message: error?.message || String(error),
                details: `Layout: ${layout}. Task id: ${context.runMetadata?.taskId || 'none'}.`
            });
        }
    }
}

export const runMetadataTool = new RunMetadataTool();
