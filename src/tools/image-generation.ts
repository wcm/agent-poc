import { Tool } from '../tool-base';
import { GlobalContext, CreativeReport, GenerationResult, getLatestFocusItemSet, getLatestCreativeReports, generateId } from '../context';
import { FocusedItemCard, StreamEmitter, ImageConcept } from '../types';
import { imageExtractionTool } from './image-extraction';
import { logger } from '../utils/logger';
import * as dotenv from 'dotenv';

dotenv.config();

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const IMAGE_GEN_MODEL = 'google/gemini-3.1-flash-image-preview';

/**
 * LLM tool for generating structured ad concept JSON from creative insights
 */
const conceptGeneratorTool = new Tool({
    name: "ImageConceptGenerator",
    model: "google/gemini-2.5-flash-lite",
    systemPrompt: `You are an elite ad creative director. Given creative analysis of an existing ad, generate new ad concepts as structured JSON.

## YOUR TASK
Generate ad concepts that iterate and improve on the original ad. Each concept must explore a distinct creative direction.

## STEPS
1. Analyze the provided visual description, performance data, and creative report (recommendations, strengths, weaknesses, top issues).
2. Think like an expert ad creative: identify opportunities, underserved personas, untapped emotions, and fresh angles.
3. Generate diverse concepts — vary personas, ad angles, value propositions, and visual styles.
4. If a logo image is provided, EVERY concept must include instructions for placing the logo naturally in the composition.

## OUTPUT FORMAT
Return ONLY valid JSON — no markdown fences, no commentary.
{
  "concepts": [
    {
      "concept_name": "Short Title (max 5 words)",
      "concept_description": "Short description (max 10 words)",
      "concept_summary": "1-2 sentence summary of the creative direction.",
      "concept_detail": "- Layout: ...\\n- Style: ...\\n- Visuals: ...\\n- Text/Copy: ...\\n- Tone: ...\\n- Logo: ...",
      "personas": ["Persona Title 1", "Persona Title 2"],
      "creative_tags": {
        "ad_angles": ["angle1", "angle2"],
        "emotion": ["emotion1", "emotion2"],
        "themes": ["theme1", "theme2"]
      }
    }
  ]
}

## CONCEPT DETAIL GUIDELINES
Each concept_detail must be a bullet-point structured prompt describing:
- **Layout**: Composition and arrangement of elements
- **Style**: Visual aesthetic (photography, illustration, flat design, etc.)
- **Visuals**: Key visual elements, colors, subjects, setting
- **Text/Copy**: Headline text, CTA text, tagline (actual text to render)
- **Tone**: Emotional tone and mood
- **Logo**: Placement, size, and treatment of the brand logo (if provided)

Do NOT include image tags or URLs. The concept_detail will be used as an image generation prompt.`
});

export interface ImageGenerationResult {
    generationResult: GenerationResult;
    concepts: ImageConcept[];
}

class ImageGenerationToolWrapper {
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY || '';
    }

    async execute(
        item: FocusedItemCard,
        report: CreativeReport,
        context: GlobalContext,
        stream: StreamEmitter,
        numConcepts: number = 4
    ): Promise<ImageGenerationResult> {
        logger.debug('ImageGenerationTool', `Generating ${numConcepts} concepts for ${item.name}`);

        // Phase 1: Stream pending placeholders immediately
        const pendingConcepts: ImageConcept[] = Array.from({ length: numConcepts }, () => ({
            concept_name: '', concept_description: '', concept_summary: '',
            concept_detail: '', personas: [], creative_tags: { ad_angles: [], emotion: [], themes: [] },
            imageDataUrl: '', status: 'pending' as const
        }));
        stream({ type: 'image_concepts', itemId: item.id, itemName: item.name, concepts: pendingConcepts });

        // Step 1: Analyze original ad image
        let visualAnalysis = '';
        if (item.thumbnail) {
            try {
                visualAnalysis = await imageExtractionTool.extractFromUrl(
                    item.thumbnail,
                    `Ad: ${item.name}, generating new ad variations`
                );
            } catch (e: any) {
                logger.debug('ImageGenerationTool', `Image extraction failed: ${e.message}`);
            }
        }

        // Step 2: Find brand logo
        const logoUrl = this.findBrandLogo(context);

        // Step 3: Generate concepts via LLM
        const conceptPrompt = this.buildConceptPrompt(item, report, visualAnalysis, logoUrl, numConcepts);
        const conceptsJson = await conceptGeneratorTool.process(conceptPrompt);
        const parsedConcepts = this.parseConcepts(conceptsJson, numConcepts);

        // Phase 2: Stream concepts with "generating" status (concepts are known, images pending)
        const generatingConcepts: ImageConcept[] = parsedConcepts.map(c => ({
            ...c, imageDataUrl: '', status: 'generating' as const
        }));
        stream({ type: 'image_concepts', itemId: item.id, itemName: item.name, concepts: generatingConcepts });

        // Phase 3: Generate all images in parallel, streaming each as it completes
        const imagePromises = parsedConcepts.map((concept, index) =>
            this.generateImage(concept, item.thumbnail, logoUrl)
                .then(imageDataUrl => {
                    logger.debug('ImageGenerationTool', `Image ${index + 1}/${parsedConcepts.length} done: ${concept.concept_name}`);
                    stream({ type: 'image_concept_update', itemId: item.id, conceptIndex: index, imageDataUrl, status: 'done' });
                    return imageDataUrl;
                })
                .catch((e: any) => {
                    logger.log('ERROR', { component: 'ImageGenerationTool', action: 'GENERATE_IMAGE' }, `Failed concept ${index + 1}: ${e.message}`);
                    stream({ type: 'image_concept_update', itemId: item.id, conceptIndex: index, imageDataUrl: '', status: 'failed' });
                    return '';
                })
        );
        const imageUrls = await Promise.all(imagePromises);

        // Build final concepts with resolved images
        const imageConcepts: ImageConcept[] = parsedConcepts.map((c, i) => ({
            ...c,
            imageDataUrl: imageUrls[i],
            status: (imageUrls[i] ? 'done' : 'failed') as ImageConcept['status']
        }));

        const generationResult: GenerationResult = {
            id: generateId('img-gen'),
            itemId: item.id,
            itemName: item.name,
            type: 'image',
            imageConcepts,
            timestamp: Date.now()
        };

        context.generationResults.push(generationResult);

        return { generationResult, concepts: imageConcepts };
    }

    private findBrandLogo(context: GlobalContext): string | undefined {
        // Check followed brands for a logo
        const brandWithLogo = context.followedBrands.find(b => b.logo);
        if (brandWithLogo?.logo) return brandWithLogo.logo;
        return undefined;
    }

    private buildConceptPrompt(
        item: FocusedItemCard,
        report: CreativeReport,
        visualAnalysis: string,
        logoUrl: string | undefined,
        numConcepts: number
    ): string {
        let prompt = `Generate exactly ${numConcepts} ad concepts for this item.\n\n`;

        prompt += `## AD INFORMATION\n- Name: ${item.name}\n- Type: ${item.type}\n- Format: ${item.displayFormat || 'image'}\n`;

        if (item.metrics) {
            const m = item.metrics;
            prompt += `\n## PERFORMANCE METRICS\n`;
            if (m.roas !== undefined) prompt += `- ROAS: ${m.roas.toFixed(2)}\n`;
            if (m.spend !== undefined) prompt += `- Spend: $${m.spend.toFixed(0)}\n`;
            if (m.ctr !== undefined) prompt += `- CTR: ${m.ctr.toFixed(2)}%\n`;
            if (m.impressions !== undefined) prompt += `- Impressions: ${m.impressions.toLocaleString()}\n`;
        }

        if (visualAnalysis) {
            prompt += `\n## ORIGINAL AD VISUAL ANALYSIS\n${visualAnalysis}\n`;
        }

        prompt += `\n## CREATIVE ANALYSIS REPORT\n${report.content}\n`;

        if (logoUrl) {
            prompt += `\n## BRAND LOGO\nA brand logo image is available. Each concept MUST include the logo positioned naturally in the composition. Describe where and how the logo should appear.\n`;
        }

        return prompt;
    }

    private parseConcepts(raw: string, numConcepts: number): Omit<ImageConcept, 'imageDataUrl' | 'status'>[] {
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
                }
            }));
        } catch (e: any) {
            logger.log('ERROR', { component: 'ImageGenerationTool', action: 'PARSE' }, e.message);
            // Fallback: generate a single generic concept
            return [{
                concept_name: 'Fresh Take',
                concept_description: 'A new creative direction',
                concept_summary: 'Reimagined version of the original ad with improved visual appeal.',
                concept_detail: '- Layout: Clean, centered composition\n- Style: Modern photography\n- Visuals: Bold colors, product focus\n- Text/Copy: "Discover Something New"\n- Tone: Energetic and inviting',
                personas: ['General audience'],
                creative_tags: { ad_angles: ['product-focus'], emotion: ['excitement'], themes: ['discovery'] }
            }];
        }
    }

    private async generateImage(
        concept: Omit<ImageConcept, 'imageDataUrl' | 'status'>,
        originalImageUrl?: string,
        logoUrl?: string
    ): Promise<string> {
        if (!this.apiKey) {
            throw new Error('OPENROUTER_API_KEY not configured');
        }

        const imagePrompt = `Create an advertisement image based on this creative concept:

${concept.concept_detail}

Style direction: ${concept.concept_description}
Target audience: ${concept.personas.join(', ')}
Emotional tone: ${concept.creative_tags.emotion.join(', ')}

Create a polished, professional ad creative suitable for digital advertising. Do not include any watermarks or placeholder text.`;

        // Build message content parts
        const contentParts: any[] = [{ type: 'text', text: imagePrompt }];

        // Include original ad as reference
        if (originalImageUrl) {
            contentParts.push({
                type: 'image_url',
                image_url: { url: originalImageUrl }
            });
        }

        // Include logo as reference
        if (logoUrl) {
            contentParts.push({
                type: 'image_url',
                image_url: { url: logoUrl }
            });
        }

        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://localhost:3000',
                'X-Title': 'Atria Agent POC'
            },
            body: JSON.stringify({
                model: IMAGE_GEN_MODEL,
                messages: [{
                    role: 'user',
                    content: contentParts
                }],
                modalities: ['image', 'text'],
                image_config: {
                    aspect_ratio: '1:1',
                    image_size: '1K'
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Image generation API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const images = data.choices?.[0]?.message?.images;

        if (images && images.length > 0) {
            return images[0].image_url.url;
        }

        throw new Error('No image returned from generation model');
    }
}

export const imageGenerationTool = new ImageGenerationToolWrapper();
