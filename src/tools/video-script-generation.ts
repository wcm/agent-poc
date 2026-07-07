import { Tool } from '../tool-base';
import { GlobalContext, CreativeReport, GenerationResult, generateId } from '../context';
import { FocusedItemCard, StreamEmitter, VideoConcept } from '../types';
import { logger } from '../utils/logger';

/**
 * LLM tool for generating structured video script concepts from creative insights
 */
const videoConceptGeneratorTool = new Tool({
    name: "VideoConceptGenerator",
    model: "google/gemini-2.5-flash-lite",
    systemPrompt: `You are an elite video ad creative director and scriptwriter. Given creative analysis of an existing video ad, generate new video script concepts as structured JSON.

## YOUR TASK
Generate video ad script concepts that iterate and improve on the original ad. Each concept must explore a distinct creative direction.

## STEPS
1. Analyze the provided transcript, performance data, and creative report (recommendations, strengths, weaknesses).
2. Think like an expert video ad creative: identify pacing opportunities, hook improvements, narrative structures, and fresh angles.
3. Generate diverse concepts — vary personas, storytelling approaches, hooks, and emotional arcs.
4. Each script should be production-ready with scene descriptions, narration/dialogue, and timing.

## OUTPUT FORMAT
Return ONLY valid JSON — no markdown fences, no commentary.
{
  "concepts": [
    {
      "concept_name": "Short Title (max 5 words)",
      "concept_description": "Short description (max 10 words)",
      "concept_summary": "One sentence summary of the creative direction.",
      "concept_detail": {
        "hook": "Opening idea.",
        "narrative": "Story structure.",
        "visuals": "Core visual direction.",
        "cta": "Final call to action.",
        "tone": "Mood and pacing."
      },
      "personas": ["Persona Title 1", "Persona Title 2"],
      "creative_tags": {
        "ad_angles": ["angle1", "angle2"],
        "emotion": ["emotion1", "emotion2"],
        "themes": ["theme1", "theme2"]
      },
      "script_scenes": [
        {
          "time": "0:00-0:03",
          "label": "HOOK",
          "visual": "Scene description.",
          "narration": "Narration or dialogue.",
          "onscreen_text": "On-screen text.",
          "audio": "Sound or music cue."
        }
      ]
    }
  ]
}

## SCRIPT FORMAT GUIDELINES
Each concept_detail must be an object, not a multi-line string. Each script must be script_scenes array, not a multi-line string.
Keep every JSON string concise and avoid newline characters inside JSON string values.
Total script length should be 15-60 seconds depending on the concept.`,
    maxTokens: 8192,
    stateless: true
});

export interface VideoScriptGenerationResult {
    generationResult: GenerationResult;
    concepts: VideoConcept[];
}

interface ConceptParseResult<TConcept> {
    concepts: TConcept[];
    ok: boolean;
    error?: string;
}

class VideoScriptGenerationToolWrapper {

    async execute(
        item: FocusedItemCard,
        report: CreativeReport,
        context: GlobalContext,
        stream: StreamEmitter,
        numConcepts: number = 4
    ): Promise<VideoScriptGenerationResult> {
        logger.debug('VideoScriptGenerationTool', `Generating ${numConcepts} video concepts for ${item.name}`);

        // Build prompt from creative report and item data
        const conceptPrompt = this.buildConceptPrompt(item, report, numConcepts);
        const conceptsJson = await videoConceptGeneratorTool.process(conceptPrompt);
        let parseResult = this.parseConcepts(conceptsJson, numConcepts, item);

        if (!parseResult.ok) {
            logger.debug('VideoScriptGenerationTool', 'Retrying script generation after invalid JSON', {
                itemName: item.name,
                error: parseResult.error
            });
            const retryPrompt = this.buildRetryConceptPrompt(conceptPrompt, conceptsJson, parseResult.error || 'Invalid JSON', numConcepts);
            const retryJson = await videoConceptGeneratorTool.process(retryPrompt);
            parseResult = this.parseConcepts(retryJson, numConcepts, item);
        }

        const videoConcepts = parseResult.concepts;

        // Stream result
        stream({
            type: 'video_concepts',
            itemId: item.id,
            itemName: item.name,
            concepts: videoConcepts
        });

        const generationResult: GenerationResult = {
            id: generateId('vid-gen'),
            itemId: item.id,
            itemName: item.name,
            type: 'video',
            videoConcepts,
            timestamp: Date.now()
        };

        context.generationResults.push(generationResult);

        return { generationResult, concepts: videoConcepts };
    }

    private buildConceptPrompt(
        item: FocusedItemCard,
        report: CreativeReport,
        numConcepts: number
    ): string {
        let prompt = `Generate exactly ${numConcepts} video ad script concepts for this item.\n\n`;

        prompt += `## AD INFORMATION\n- Name: ${item.name}\n- Type: ${item.type}\n- Format: video\n`;

        if (item.metrics) {
            const m = item.metrics;
            prompt += `\n## PERFORMANCE METRICS\n`;
            if (m.roas !== undefined) prompt += `- ROAS: ${m.roas.toFixed(2)}\n`;
            if (m.spend !== undefined) prompt += `- Spend: $${m.spend.toFixed(0)}\n`;
            if (m.ctr !== undefined) prompt += `- CTR: ${m.ctr.toFixed(2)}%\n`;
            if (m.impressions !== undefined) prompt += `- Impressions: ${m.impressions.toLocaleString()}\n`;
        }

        prompt += `\n## CREATIVE ANALYSIS REPORT\n${report.content}\n`;

        return prompt;
    }

    private buildRetryConceptPrompt(originalPrompt: string, invalidResponse: string, error: string, numConcepts: number): string {
        return `The previous response could not be parsed as valid JSON.

Parse error: ${error}

Regenerate the answer from scratch. Return ONLY one valid JSON object with exactly ${numConcepts} concepts. Keep all strings concise. Use script_scenes arrays instead of multi-line script strings. Do not use markdown fences. Do not use newline characters inside JSON string values.

Original request:
${originalPrompt.slice(0, 7000)}

Invalid response excerpt:
${invalidResponse.slice(0, 1200)}`;
    }

    private parseConcepts(raw: string, numConcepts: number, item: FocusedItemCard): ConceptParseResult<VideoConcept> {
        try {
            const parsed = this.parseJson(raw);
            const concepts = Array.isArray(parsed) ? parsed : parsed.concepts;

            if (!Array.isArray(concepts)) {
                throw new Error('Concepts is not an array');
            }

            const normalizedConcepts = concepts
                .slice(0, numConcepts)
                .map((concept: any, index: number) => this.normalizeConcept(concept, index, item));

            return {
                concepts: this.ensureConceptCount(normalizedConcepts, numConcepts, item),
                ok: true
            };
        } catch (e: any) {
            logger.log('ERROR', { component: 'VideoScriptGenerationTool', action: 'PARSE' }, e.message);
            return {
                concepts: this.buildFallbackConcepts(numConcepts, item),
                ok: false,
                error: e.message
            };
        }
    }

    private parseJson(raw: string) {
        const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            return JSON.parse(cleaned);
        } catch {
            const firstObject = cleaned.indexOf('{');
            const firstArray = cleaned.indexOf('[');
            const starts = [firstObject, firstArray].filter(index => index >= 0);
            if (starts.length === 0) {
                throw new Error('No JSON object or array found');
            }

            const start = Math.min(...starts);
            const end = cleaned[start] === '{' ? cleaned.lastIndexOf('}') : cleaned.lastIndexOf(']');
            if (end <= start) {
                throw new Error('No complete JSON object or array found');
            }

            return JSON.parse(cleaned.slice(start, end + 1));
        }
    }

    private normalizeConcept(concept: any, index: number, item: FocusedItemCard): VideoConcept {
        const fallback = this.buildFallbackConcept(index, item);
        const tags = concept?.creative_tags || {};

        return {
            concept_name: this.normalizeString(concept?.concept_name, fallback.concept_name),
            concept_description: this.normalizeString(concept?.concept_description, fallback.concept_description),
            concept_summary: this.normalizeString(concept?.concept_summary, fallback.concept_summary),
            concept_detail: this.normalizeConceptDetail(concept?.concept_detail, fallback.concept_detail),
            personas: this.normalizeStringArray(concept?.personas, fallback.personas),
            creative_tags: {
                ad_angles: this.normalizeStringArray(tags.ad_angles, fallback.creative_tags.ad_angles),
                emotion: this.normalizeStringArray(tags.emotion, fallback.creative_tags.emotion),
                themes: this.normalizeStringArray(tags.themes, fallback.creative_tags.themes)
            },
            script: this.normalizeScript(concept?.script_scenes || concept?.scenes || concept?.script, fallback.script)
        };
    }

    private normalizeConceptDetail(value: any, fallback: string): string {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }

        if (!value || typeof value !== 'object') {
            return fallback;
        }

        const detailRows = [
            ['Hook', value.hook],
            ['Narrative', value.narrative],
            ['Visuals', value.visuals],
            ['CTA', value.cta],
            ['Tone', value.tone]
        ];

        const detail = detailRows
            .map(([label, detailValue]) => [label, this.normalizeString(detailValue, '')])
            .filter(([, detailValue]) => detailValue)
            .map(([label, detailValue]) => `- ${label}: ${detailValue}`)
            .join('\n');

        return detail || fallback;
    }

    private normalizeScript(value: any, fallback: string): string {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }

        if (!Array.isArray(value)) {
            return fallback;
        }

        const scenes = value
            .map((scene: any) => {
                const time = this.normalizeString(scene?.time, '0:00-0:03');
                const label = this.normalizeString(scene?.label, 'SCENE').toUpperCase();
                const visual = this.normalizeString(scene?.visual || scene?.scene || scene?.description, '');
                const narration = this.normalizeString(scene?.narration || scene?.dialogue || scene?.voiceover, '');
                const onscreenText = this.normalizeString(scene?.onscreen_text || scene?.on_screen_text || scene?.text, '');
                const audio = this.normalizeString(scene?.audio || scene?.sound || scene?.music, '');

                return [
                    `[${time}] ${label}`,
                    visual ? `(${visual})` : '',
                    narration ? `Narration: "${narration}"` : '',
                    onscreenText ? `On-screen text: "${onscreenText}"` : '',
                    audio ? `Audio: ${audio}` : ''
                ].filter(Boolean).join('\n');
            })
            .filter(Boolean);

        return scenes.length > 0 ? scenes.join('\n\n') : fallback;
    }

    private ensureConceptCount(concepts: VideoConcept[], numConcepts: number, item: FocusedItemCard): VideoConcept[] {
        const result = [...concepts];

        while (result.length < numConcepts) {
            result.push(this.buildFallbackConcept(result.length, item));
        }

        return result.slice(0, numConcepts);
    }

    private buildFallbackConcepts(numConcepts: number, item: FocusedItemCard): VideoConcept[] {
        return Array.from({ length: numConcepts }, (_, index) => this.buildFallbackConcept(index, item));
    }

    private buildFallbackConcept(index: number, item: FocusedItemCard): VideoConcept {
        const sourceName = item.name || 'the source ad';
        const concepts = [
            {
                name: 'Instant Proof',
                description: 'Open with credibility fast',
                angle: 'proof-led hook',
                emotion: 'confidence',
                theme: 'validation',
                detail: `- Hook: Start with a sharp proof point
- Narrative: Show the product, explain why it works, then invite action
- Visuals: Fast close-ups inspired by ${sourceName}
- CTA: Shop the proven winner
- Tone: Confident and direct`,
                script: `[0:00-0:03] HOOK
(Fast product close-up with proof overlay)
Narration: "This is why shoppers stop scrolling."

[0:03-0:12] PROOF
(Show product benefit in use with quick cuts)
Narration: "Built around the detail people notice first, then backed by a clear reason to believe."

[0:12-0:15] CTA
(Product hero and CTA)
Narration: "Shop the proven choice today."`
            },
            {
                name: 'Problem Snap',
                description: 'Frame the pain first',
                angle: 'problem-solution',
                emotion: 'relief',
                theme: 'solution',
                detail: `- Hook: Name the customer problem immediately
- Narrative: Move from friction to product-led relief
- Visuals: Before-and-after moments based on ${sourceName}
- CTA: Try the easier option
- Tone: Helpful and practical`,
                script: `[0:00-0:03] PROBLEM
(Show the frustrating before moment)
Narration: "Still dealing with the same daily friction?"

[0:03-0:12] SOLUTION
(Product enters, benefit becomes obvious)
Narration: "This turns that moment into something simpler, cleaner, and easier to repeat."

[0:12-0:15] CTA
(Clear product shot)
Narration: "Try the upgrade now."`
            },
            {
                name: 'Creator Test',
                description: 'Make it feel demonstrated',
                angle: 'creator demo',
                emotion: 'trust',
                theme: 'demo',
                detail: `- Hook: Creator shows the product in hand
- Narrative: Demonstrate one claim with clear visual evidence
- Visuals: Native social demo inspired by ${sourceName}
- CTA: See it for yourself
- Tone: Conversational and useful`,
                script: `[0:00-0:03] HOOK
(Creator holds product to camera)
Narration: "Here's the detail I would test first."

[0:03-0:12] DEMO
(Hands-on demo with benefit captions)
Narration: "It makes the value obvious without overexplaining, which is exactly why this format can scale."

[0:12-0:15] CTA
(Creator points to CTA)
Narration: "See it for yourself."`
            },
            {
                name: 'Offer Push',
                description: 'Turn attention into action',
                angle: 'conversion offer',
                emotion: 'urgency',
                theme: 'conversion',
                detail: `- Hook: Lead with the strongest offer reason
- Narrative: Product value, proof, and CTA in a tight sequence
- Visuals: High-contrast offer frames around ${sourceName}
- CTA: Act now
- Tone: Energetic and decisive`,
                script: `[0:00-0:03] OFFER
(Bold offer text with product hero)
Narration: "If you've been waiting, this is the moment."

[0:03-0:12] VALUE
(Show benefit, proof, and product detail)
Narration: "You get the standout feature, the reason it matters, and a clear next step."

[0:12-0:15] CTA
(Final offer frame)
Narration: "Tap to get started."`
            }
        ];
        const selected = concepts[index % concepts.length];

        return {
            concept_name: selected.name,
            concept_description: selected.description,
            concept_summary: `${selected.name} turns ${sourceName} into a ${selected.angle} video variation.`,
            concept_detail: selected.detail,
            personas: ['Primary buyer', 'High-intent shopper'],
            creative_tags: {
                ad_angles: [selected.angle],
                emotion: [selected.emotion],
                themes: [selected.theme]
            },
            script: selected.script
        };
    }

    private normalizeString(value: any, fallback: string): string {
        if (typeof value === 'string') {
            const normalized = value.replace(/\s+/g, ' ').trim();
            return normalized || fallback;
        }

        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }

        return fallback;
    }

    private normalizeStringArray(value: any, fallback: string[]): string[] {
        if (Array.isArray(value)) {
            const normalized = value
                .map(item => this.normalizeString(item, ''))
                .filter(Boolean);
            return normalized.length > 0 ? normalized : fallback;
        }

        if (typeof value === 'string' && value.trim()) {
            return [value.trim()];
        }

        return fallback;
    }
}

export const videoScriptGenerationTool = new VideoScriptGenerationToolWrapper();
