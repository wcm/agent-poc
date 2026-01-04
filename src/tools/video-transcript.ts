import { Tool } from '../tool-base';

/**
 * VideoTranscriptTool
 * 
 * Generates mock ad scripts/transcripts for video ads.
 * Since actual video assets are not available, this generates plausible
 * ad scripts based on the item information and metrics.
 * 
 * In the future, this could be replaced with actual video transcription.
 */
class VideoTranscriptToolWrapper extends Tool {
    async process(input: string): Promise<string> {
        console.log(`[VideoTranscriptTool] Generating mock transcript...`);
        
        // Use the LLM to generate a plausible ad script
        const transcript = await super.process(input);
        return transcript;
    }
}

export const videoTranscriptTool = new VideoTranscriptToolWrapper({
    name: "VideoTranscript",
    model: "google/gemini-2.5-flash-lite",
    systemPrompt: `You are an expert ad creative analyst. Generate a realistic video ad script/transcript based on the provided information.

## YOUR TASK
Given information about a video ad (name, metrics, any available context), generate a plausible script that this video ad might contain.

## SCRIPT FORMAT
Generate a script with:
1. **Opening Hook** (0-3 seconds): What grabs attention
2. **Problem/Pain Point** (3-8 seconds): What problem is addressed
3. **Solution/Product** (8-20 seconds): How the product/service helps
4. **Social Proof/Benefits** (if applicable): Testimonials, stats, results
5. **Call to Action** (final seconds): What action to take

## OUTPUT FORMAT
Provide the script in this format:

**VIDEO AD SCRIPT**

[SCENE 1 - HOOK]
Visual: [describe what's shown]
Audio/VO: "[what is said]"

[SCENE 2 - PROBLEM]
Visual: [describe what's shown]
Audio/VO: "[what is said]"

[SCENE 3 - SOLUTION]
Visual: [describe what's shown]
Audio/VO: "[what is said]"

[SCENE 4 - CTA]
Visual: [describe what's shown]
Audio/VO: "[what is said]"

**Key Messages**: [list main messages]
**Tone**: [describe the overall tone]
**Target Emotion**: [what emotion it aims to evoke]

## GUIDELINES
- Make the script realistic and aligned with the ad's apparent purpose
- Consider the metrics - high ROAS ads likely have compelling scripts
- Match the brand voice and style based on the ad name
- Keep it concise but complete
- Be creative but plausible`
});

