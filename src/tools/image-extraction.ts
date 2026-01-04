import { OpenRouter } from "@openrouter/sdk";
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * ImageExtractionTool
 * 
 * Uses Gemini Flash 2.5 with vision capability to analyze ad images.
 * Extracts visual descriptions, text/copywriting on the image, style, and mood.
 */
export class ImageExtractionTool {
    private client: OpenRouter;

    constructor() {
        this.client = new OpenRouter({
            apiKey: process.env.OPENROUTER_API_KEY,
        });
    }

    /**
     * Analyze an image from a URL
     */
    async extractFromUrl(imageUrl: string, context?: string): Promise<string> {
        console.log(`[ImageExtractionTool] Analyzing image: ${imageUrl}`);

        try {
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

            // Send to Gemini with vision capability
            const response: any = await this.client.chat.send({
                model: "google/gemini-2.5-flash-lite",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `You are an expert ad creative analyst. Analyze this advertisement image and provide a detailed description.

${context ? `Context: ${context}\n` : ''}
Please describe:
1. **Visual Elements**: Colors, objects, people, setting, composition
2. **Text/Copywriting**: Any text visible on the image (headlines, CTAs, taglines)
3. **Style & Mood**: Overall aesthetic, emotional tone, brand feeling
4. **Target Audience Signals**: Who this ad seems designed for
5. **Key Visual Hook**: What catches attention first

Be specific and detailed in your analysis.`
                            },
                            {
                                type: "image_url",
                                image_url: { url: dataUrl }
                            }
                        ]
                    }
                ],
                max_tokens: 1500
            } as any, {
                headers: {
                    "HTTP-Referer": "https://localhost:3000",
                    "X-Title": "Atria Agent POC",
                }
            });

            const output = response.choices?.[0]?.message?.content || response.content || "";
            
            if (!output) {
                throw new Error('Empty response from vision model');
            }

            console.log(`[ImageExtractionTool] Successfully analyzed image`);
            return output;

        } catch (error: any) {
            console.error(`[ImageExtractionTool] Error:`, error);
            // Return a fallback description if image analysis fails
            return `[Image analysis failed: ${error.message}] Unable to analyze the image at ${imageUrl}. The image may be inaccessible or in an unsupported format.`;
        }
    }
}

// Export singleton instance
export const imageExtractionTool = new ImageExtractionTool();

