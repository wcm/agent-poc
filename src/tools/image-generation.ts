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
      "concept_summary": "One sentence summary of the creative direction.",
      "concept_detail": {
        "layout": "Composition and arrangement.",
        "style": "Visual aesthetic.",
        "visuals": "Key visual elements, colors, subjects, setting.",
        "text_copy": {
          "headline": "Actual headline text to render.",
          "cta": "Actual CTA text to render."
        },
        "tone": "Mood and emotional tone.",
        "logo": "Logo placement and treatment."
      },
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
Each concept_detail must be an object, not a multi-line string. Keep every value concise and avoid newline characters inside JSON strings.

Do NOT include image tags or URLs. The concept_detail will be converted into an image generation prompt.`,
    maxTokens: 8192,
    stateless: true
});

type ParsedImageConcept = Omit<ImageConcept, 'imageDataUrl' | 'status'>;

interface ConceptParseResult<TConcept> {
    concepts: TConcept[];
    ok: boolean;
    error?: string;
}

export interface ImageGenerationResult {
    generationResult: GenerationResult;
    concepts: ImageConcept[];
    metadata?: ImageGenerationMetadata;
}

export interface ImagePersistenceInput {
    concept: Omit<ImageConcept, 'imageDataUrl' | 'status'>;
    conceptIndex: number;
    imageUrl: string;
    item: FocusedItemCard;
    request: GeneratedImageRequestRecord;
    response: any;
}

export interface ImagePersistenceResult {
    imageUrl: string;
    localPath?: string;
    originalImageUrl?: string;
    isLocal: boolean;
}

export interface ImageGenerationExecutionOptions {
    persistImage?: (input: ImagePersistenceInput) => Promise<ImagePersistenceResult>;
}

export interface GeneratedImageRequestRecord {
    url: string;
    model: string;
    prompt: string;
    originalImageUrl?: string;
    logoUrl?: string;
    body: any;
}

export interface GeneratedImageResponseRecord {
    conceptIndex: number;
    status: 'done' | 'failed';
    imageUrl: string;
    originalImageUrl?: string;
    localPath?: string;
    isLocal?: boolean;
    providerImage?: any;
    request?: GeneratedImageRequestRecord;
    response?: any;
    error?: string;
}

export interface ImageGenerationMetadata {
    visualAnalysis: string;
    logoUrl?: string;
    conceptPrompt: string;
    conceptResponseRaw: string;
    imageResponses: GeneratedImageResponseRecord[];
}

interface GeneratedImageApiResult {
    imageUrl: string;
    providerImage?: any;
    request: GeneratedImageRequestRecord;
    response: any;
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
        numConcepts: number = 4,
        options: ImageGenerationExecutionOptions = {}
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
        let conceptsJson = await conceptGeneratorTool.process(conceptPrompt);
        let parseResult = this.parseConcepts(conceptsJson, numConcepts, item);

        if (!parseResult.ok) {
            logger.debug('ImageGenerationTool', 'Retrying concept generation after invalid JSON', {
                itemName: item.name,
                error: parseResult.error
            });
            const retryPrompt = this.buildRetryConceptPrompt(conceptPrompt, conceptsJson, parseResult.error || 'Invalid JSON', numConcepts);
            const retryJson = await conceptGeneratorTool.process(retryPrompt);
            conceptsJson = `${conceptsJson}\n\n--- RETRY RESPONSE ---\n${retryJson}`;
            parseResult = this.parseConcepts(retryJson, numConcepts, item);
        }

        const parsedConcepts = parseResult.concepts;
        const imageResponses: GeneratedImageResponseRecord[] = [];

        // Phase 2: Stream concepts with "generating" status (concepts are known, images pending)
        const generatingConcepts: ImageConcept[] = parsedConcepts.map(c => ({
            ...c, imageDataUrl: '', status: 'generating' as const
        }));
        stream({ type: 'image_concepts', itemId: item.id, itemName: item.name, concepts: generatingConcepts });

        // Phase 3: Generate all images in parallel, streaming each as it completes
        const imagePromises = parsedConcepts.map((concept, index) =>
            this.generateImage(concept, item.thumbnail, logoUrl)
                .then(async generatedImage => {
                    let imageDataUrl = generatedImage.imageUrl;
                    let persistence: ImagePersistenceResult | undefined;

                    if (options.persistImage) {
                        persistence = await options.persistImage({
                            concept,
                            conceptIndex: index,
                            imageUrl: generatedImage.imageUrl,
                            item,
                            request: generatedImage.request,
                            response: generatedImage.response
                        });
                        imageDataUrl = persistence.imageUrl;
                    }

                    imageResponses[index] = {
                        conceptIndex: index,
                        status: 'done',
                        imageUrl: imageDataUrl,
                        originalImageUrl: persistence?.originalImageUrl || generatedImage.imageUrl,
                        localPath: persistence?.localPath,
                        isLocal: persistence?.isLocal,
                        providerImage: generatedImage.providerImage,
                        request: generatedImage.request,
                        response: generatedImage.response
                    };

                    logger.debug('ImageGenerationTool', `Image ${index + 1}/${parsedConcepts.length} done: ${concept.concept_name}`);
                    stream({ type: 'image_concept_update', itemId: item.id, conceptIndex: index, imageDataUrl, status: 'done' });
                    return imageDataUrl;
                })
                .catch((e: any) => {
                    imageResponses[index] = {
                        conceptIndex: index,
                        status: 'failed',
                        imageUrl: '',
                        error: e.message
                    };
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

        return {
            generationResult,
            concepts: imageConcepts,
            metadata: {
                visualAnalysis,
                logoUrl,
                conceptPrompt,
                conceptResponseRaw: conceptsJson,
                imageResponses
            }
        };
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

    private buildRetryConceptPrompt(originalPrompt: string, invalidResponse: string, error: string, numConcepts: number): string {
        return `The previous response could not be parsed as valid JSON.

Parse error: ${error}

Regenerate the answer from scratch. Return ONLY one valid JSON object with exactly ${numConcepts} concepts. Keep all strings concise. Do not use markdown fences. Do not use newline characters inside JSON string values.

Original request:
${originalPrompt.slice(0, 7000)}

Invalid response excerpt:
${invalidResponse.slice(0, 1200)}`;
    }

    private parseConcepts(raw: string, numConcepts: number, item: FocusedItemCard): ConceptParseResult<ParsedImageConcept> {
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
            logger.log('ERROR', { component: 'ImageGenerationTool', action: 'PARSE' }, e.message);
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

    private normalizeConcept(concept: any, index: number, item: FocusedItemCard): ParsedImageConcept {
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
            }
        };
    }

    private normalizeConceptDetail(value: any, fallback: string): string {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }

        if (!value || typeof value !== 'object') {
            return fallback;
        }

        const textCopy = value.text_copy || value.textCopy || {};
        const copyParts = [
            this.normalizeString(textCopy.headline, ''),
            this.normalizeString(textCopy.cta, '')
        ].filter(Boolean);

        const detailRows = [
            ['Layout', value.layout],
            ['Style', value.style],
            ['Visuals', value.visuals],
            ['Text/Copy', copyParts.join(' / ') || value.text_copy || value.copy],
            ['Tone', value.tone],
            ['Logo', value.logo]
        ];

        const detail = detailRows
            .map(([label, detailValue]) => [label, this.normalizeString(detailValue, '')])
            .filter(([, detailValue]) => detailValue)
            .map(([label, detailValue]) => `- ${label}: ${detailValue}`)
            .join('\n');

        return detail || fallback;
    }

    private ensureConceptCount(concepts: ParsedImageConcept[], numConcepts: number, item: FocusedItemCard): ParsedImageConcept[] {
        const result = [...concepts];

        while (result.length < numConcepts) {
            result.push(this.buildFallbackConcept(result.length, item));
        }

        return result.slice(0, numConcepts);
    }

    private buildFallbackConcepts(numConcepts: number, item: FocusedItemCard): ParsedImageConcept[] {
        return Array.from({ length: numConcepts }, (_, index) => this.buildFallbackConcept(index, item));
    }

    private buildFallbackConcept(index: number, item: FocusedItemCard): ParsedImageConcept {
        const sourceName = item.name || 'the source ad';
        const concepts = [
            {
                name: 'Proof First',
                description: 'Lead with the strongest proof',
                angle: 'proof-led positioning',
                emotion: 'confidence',
                theme: 'validation',
                detail: `- Layout: Product hero on the left with a crisp proof badge on the right
- Style: Clean performance-ad photography with sharp contrast
- Visuals: ${sourceName} reimagined with bold metric callouts and product close-ups
- Text/Copy: "Built To Prove It" / "Shop Now"
- Tone: Credible, focused, high-conviction`
            },
            {
                name: 'Daily Upgrade',
                description: 'Show the everyday use case',
                angle: 'lifestyle transformation',
                emotion: 'relief',
                theme: 'daily routine',
                detail: `- Layout: Before-and-after lifestyle sequence in a simple grid
- Style: Natural light, premium but approachable
- Visuals: ${sourceName} placed in a realistic daily moment with clear product benefit cues
- Text/Copy: "Upgrade The Everyday" / "See The Difference"
- Tone: Practical, optimistic, human`
            },
            {
                name: 'Creator Demo',
                description: 'Make the product feel tested',
                angle: 'creator demonstration',
                emotion: 'trust',
                theme: 'demo',
                detail: `- Layout: Creator-style demo frame with product benefit overlays
- Style: Native social creative with polished lighting
- Visuals: Hands-on product interaction inspired by ${sourceName}
- Text/Copy: "See Why It Works" / "Try It Today"
- Tone: Direct, useful, convincing`
            },
            {
                name: 'Bold Offer',
                description: 'Convert attention into action',
                angle: 'offer spotlight',
                emotion: 'urgency',
                theme: 'conversion',
                detail: `- Layout: Centered product shot with a strong offer panel and clear CTA
- Style: High-contrast digital ad with minimal distractions
- Visuals: ${sourceName} reframed around the product, offer, and reason to act now
- Text/Copy: "Your Next Favorite" / "Get Started"
- Tone: Energetic, clear, conversion-focused`
            }
        ];
        const selected = concepts[index % concepts.length];

        return {
            concept_name: selected.name,
            concept_description: selected.description,
            concept_summary: `${selected.name} reframes ${sourceName} around ${selected.angle}.`,
            concept_detail: selected.detail,
            personas: ['Primary buyer', 'High-intent shopper'],
            creative_tags: {
                ad_angles: [selected.angle],
                emotion: [selected.emotion],
                themes: [selected.theme]
            }
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

    private async generateImage(
        concept: Omit<ImageConcept, 'imageDataUrl' | 'status'>,
        originalImageUrl?: string,
        logoUrl?: string
    ): Promise<GeneratedImageApiResult> {
        if (!this.apiKey) {
            throw new Error('OPENROUTER_API_KEY not configured');
        }

        const imagePrompt = this.buildImagePrompt(concept);

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

        const requestBody = {
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
        };

        const request: GeneratedImageRequestRecord = {
            url: OPENROUTER_API_URL,
            model: IMAGE_GEN_MODEL,
            prompt: imagePrompt,
            originalImageUrl,
            logoUrl,
            body: requestBody
        };

        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://localhost:3000',
                'X-Title': 'Atria Agent POC'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Image generation API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const extractedImage = this.extractImageFromResponse(data);

        if (extractedImage) {
            return {
                imageUrl: extractedImage.imageUrl,
                providerImage: extractedImage.providerImage,
                request,
                response: data
            };
        }

        throw new Error('No image returned from generation model');
    }

    private buildImagePrompt(concept: Omit<ImageConcept, 'imageDataUrl' | 'status'>): string {
        return `Create an advertisement image based on this creative concept:

${concept.concept_detail}

Style direction: ${concept.concept_description}
Target audience: ${concept.personas.join(', ')}
Emotional tone: ${concept.creative_tags.emotion.join(', ')}

Create a polished, professional ad creative suitable for digital advertising. Do not include any watermarks or placeholder text.`;
    }

    private extractImageFromResponse(data: any): { imageUrl: string; providerImage?: any } | null {
        const message = data?.choices?.[0]?.message;
        const candidates = [
            ...(Array.isArray(message?.images) ? message.images : []),
            ...(Array.isArray(data?.images) ? data.images : []),
            ...(Array.isArray(data?.data) ? data.data : [])
        ];

        for (const candidate of candidates) {
            const imageUrl =
                candidate?.image_url?.url ||
                candidate?.image_url ||
                candidate?.url ||
                candidate?.data_url ||
                candidate?.dataUrl;

            if (typeof imageUrl === 'string' && imageUrl.length > 0) {
                return { imageUrl, providerImage: candidate };
            }

            const base64Image =
                candidate?.b64_json ||
                candidate?.base64 ||
                candidate?.image?.base64 ||
                candidate?.image_base64;

            if (typeof base64Image === 'string' && base64Image.length > 0) {
                const cleaned = base64Image.includes(',') ? base64Image.split(',').pop() : base64Image;
                return { imageUrl: `data:image/png;base64,${cleaned}`, providerImage: candidate };
            }
        }

        if (typeof message?.content === 'string') {
            const dataUrlMatch = message.content.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/);
            if (dataUrlMatch) {
                return { imageUrl: dataUrlMatch[0] };
            }
        }

        return null;
    }
}

export const imageGenerationTool = new ImageGenerationToolWrapper();
