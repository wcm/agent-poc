import * as dotenv from 'dotenv';

dotenv.config();

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * ImageExtractionTool
 * 
 * Uses Gemini Flash 2.5 with vision capability to analyze ad images.
 * Uses direct fetch to OpenRouter API since the SDK has validation issues with multimodal content.
 */
export class ImageExtractionTool {
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY || '';
        if (!this.apiKey) {
            console.warn('[ImageExtractionTool] OPENROUTER_API_KEY not set');
        }
    }

    /**
     * Analyze an image from a URL
     */
    async extractFromUrl(imageUrl: string, context?: string): Promise<string> {
        console.log(`[ImageExtractionTool] Analyzing image: ${imageUrl}`);

        if (!this.apiKey) {
            return `[Image analysis unavailable] API key not configured.`;
        }

        try {
            const prompt = `You are an expert ad creative analyst. Analyze this advertisement image and provide a detailed description.

${context ? `Context: ${context}\n` : ''}
Please describe:
1. **Visual Elements**: Colors, objects, people, setting, composition
2. **Text/Copywriting**: Any text visible on the image (headlines, CTAs, taglines)
3. **Style & Mood**: Overall aesthetic, emotional tone, brand feeling
4. **Target Audience Signals**: Who this ad seems designed for
5. **Key Visual Hook**: What catches attention first

Be specific and detailed in your analysis.`;

            // Use direct fetch to OpenRouter API
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://localhost:3000',
                    'X-Title': 'Atria Agent POC'
                },
                body: JSON.stringify({
                    model: 'google/gemini-2.5-flash',
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: prompt
                                },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: imageUrl
                                    }
                                }
                            ]
                        }
                    ]
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[ImageExtractionTool] API error (${response.status}):`, errorText);
                
                // Try with base64 as fallback
                console.log(`[ImageExtractionTool] Retrying with base64 encoding...`);
                return await this.extractWithBase64(imageUrl, context);
            }

            const data = await response.json();
            const output = data.choices?.[0]?.message?.content || '';
            
            if (!output) {
                throw new Error('Empty response from vision model');
            }

            console.log(`[ImageExtractionTool] Successfully analyzed image`);
            return output;

        } catch (error: any) {
            console.error(`[ImageExtractionTool] Error:`, error.message);
            
            // Try with base64 as fallback
            try {
                console.log(`[ImageExtractionTool] Retrying with base64 encoding...`);
                return await this.extractWithBase64(imageUrl, context);
            } catch (fallbackError: any) {
                console.error(`[ImageExtractionTool] Base64 fallback also failed:`, fallbackError.message);
                return `[Image analysis unavailable] Unable to analyze the image. The creative will be analyzed based on performance data only.`;
            }
        }
    }

    /**
     * Fallback: Analyze image using base64 encoding
     */
    private async extractWithBase64(imageUrl: string, context?: string): Promise<string> {
        // Fetch the image and convert to base64
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image: ${imageResponse.status}`);
        }
        
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        
        // Determine the content type
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
        const dataUrl = `data:${contentType};base64,${base64Image}`;

        const prompt = `You are an expert ad creative analyst. Analyze this advertisement image.

${context ? `Context: ${context}\n` : ''}
Describe the visual elements, any text/copywriting visible, style, mood, and what catches attention first.`;

        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://localhost:3000',
                'X-Title': 'Atria Agent POC'
            },
            body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: dataUrl
                                }
                            }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const output = data.choices?.[0]?.message?.content || '';
        
        if (!output) {
            throw new Error('Empty response from vision model');
        }

        return output;
    }
}

// Export singleton instance
export const imageExtractionTool = new ImageExtractionTool();
