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
      "concept_summary": "1-2 sentence summary of the creative direction.",
      "concept_detail": "- Hook: ...\\n- Narrative: ...\\n- Visuals: ...\\n- CTA: ...\\n- Tone: ...",
      "personas": ["Persona Title 1", "Persona Title 2"],
      "creative_tags": {
        "ad_angles": ["angle1", "angle2"],
        "emotion": ["emotion1", "emotion2"],
        "themes": ["theme1", "theme2"]
      },
      "script": "[0:00-0:03] HOOK\\n(Scene description)\\nNarration: \\"...\\\"\\n\\n[0:03-0:10] BODY\\n(Scene description)\\nNarration: \\"...\\\"\\n\\n[0:10-0:15] CTA\\n(Scene description)\\nNarration: \\"...\\\""
    }
  ]
}

## SCRIPT FORMAT GUIDELINES
Each script should include:
- **Timestamps** in [MM:SS-MM:SS] format
- **Scene labels** (HOOK, PROBLEM, SOLUTION, SOCIAL PROOF, CTA, etc.)
- **Scene descriptions** in parentheses
- **Narration/Dialogue** with speaker attribution
- **Sound/Music cues** where relevant
- Total length should be 15-60 seconds depending on the concept`
});

export interface VideoScriptGenerationResult {
    generationResult: GenerationResult;
    concepts: VideoConcept[];
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
        const videoConcepts = this.parseConcepts(conceptsJson, numConcepts);

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

    private parseConcepts(raw: string, numConcepts: number): VideoConcept[] {
        try {
            const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            const concepts = parsed.concepts || parsed;

            if (!Array.isArray(concepts)) {
                throw new Error('Concepts is not an array');
            }

            return concepts.slice(0, numConcepts).map((c: any) => ({
                concept_name: c.concept_name || 'Untitled',
                concept_description: c.concept_description || '',
                concept_summary: c.concept_summary || '',
                concept_detail: c.concept_detail || '',
                personas: Array.isArray(c.personas) ? c.personas : [],
                creative_tags: {
                    ad_angles: Array.isArray(c.creative_tags?.ad_angles) ? c.creative_tags.ad_angles : [],
                    emotion: Array.isArray(c.creative_tags?.emotion) ? c.creative_tags.emotion : [],
                    themes: Array.isArray(c.creative_tags?.themes) ? c.creative_tags.themes : []
                },
                script: c.script || ''
            }));
        } catch (e: any) {
            logger.log('ERROR', { component: 'VideoScriptGenerationTool', action: 'PARSE' }, e.message);
            return [{
                concept_name: 'Quick Hook',
                concept_description: 'Fast-paced product showcase',
                concept_summary: 'A quick, attention-grabbing video concept with bold visuals.',
                concept_detail: '- Hook: Bold visual opener\n- Narrative: Problem-solution\n- Visuals: Product close-ups\n- CTA: Strong call to action\n- Tone: Energetic',
                personas: ['General audience'],
                creative_tags: { ad_angles: ['product-focus'], emotion: ['excitement'], themes: ['discovery'] },
                script: '[0:00-0:03] HOOK\n(Bold visual of the product)\nNarration: "Ready for something new?"\n\n[0:03-0:12] BODY\n(Product in use, lifestyle shots)\nNarration: "Discover what makes us different."\n\n[0:12-0:15] CTA\n(Logo and CTA overlay)\nNarration: "Try it today."'
            }];
        }
    }
}

export const videoScriptGenerationTool = new VideoScriptGenerationToolWrapper();
