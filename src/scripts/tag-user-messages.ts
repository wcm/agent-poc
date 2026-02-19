/**
 * Script: Tag user messages in conversations_with_messages.json using Gemini 2.5 Flash.
 * Reads tag_specifications.md, calls LLM per user message (with previous assistant context),
 * adds a "tags" property to each user message, and writes conversations_with_messages_tagged.json.
 */

import { OpenRouter } from '@openrouter/sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const TAG_SPEC_PATH = path.join(__dirname, '../data/tag_specifications.md');
const CONVERSATIONS_PATH = path.join(__dirname, '../data/conversations_with_messages.json');
const OUTPUT_PATH = path.join(__dirname, '../data/conversations_with_messages_tagged.json');

const MODEL = 'google/gemini-2.5-flash';

const SYSTEM_PROMPT = `You are a tagging assistant. Your only job is to assign intent tags to the user's message according to the tag specification.

## Tag specification (follow exactly)

You will be given a tag specification document. Use ONLY the categories and topics listed there.

Tag format: a JSON array of objects, each with "category" and "topic". Example:
[{"category": "data_analysis", "topic": "creative_insights"}, {"category": "recommendation", "topic": "operation"}]

Guidelines:
- Assign multiple tags when the question spans intents.
- Use {"category": "other", "topic": "follow_up_clarification"} when the message is primarily a follow-up to prior context (e.g. "and why?", "what about X?", "diving deeper").
- Use {"category": "other", "topic": "unspecified"} only when no other tag fits.
- Consider the previous assistant message (if provided) to understand context and follow-up intent.

You must respond with ONLY a valid JSON array of tag objects. No markdown, no code fence, no explanation. Just the JSON array.`;

function extractJsonArray(text: string): { category: string; topic: string }[] {
  const trimmed = text.trim();
  // Strip optional markdown code block
  let jsonStr = trimmed;
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  if (codeBlock) jsonStr = codeBlock[1].trim();
  const start = jsonStr.indexOf('[');
  const end = jsonStr.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON array found in response');
  }
  jsonStr = jsonStr.slice(start, end + 1);
  const parsed = JSON.parse(jsonStr);
  if (!Array.isArray(parsed)) throw new Error('Response is not an array');
  return parsed.map((t: any) => ({
    category: String(t?.category ?? 'other'),
    topic: String(t?.topic ?? 'unspecified'),
  }));
}

async function tagUserMessage(
  client: OpenRouter,
  userContent: string,
  previousAssistantContent: string | null,
  tagSpec: string
): Promise<{ category: string; topic: string }[]> {
  const userPrompt = previousAssistantContent
    ? `## Previous assistant message (for context)\n${previousAssistantContent}\n\n## User message to tag\n${userContent}`
    : `## User message to tag\n${userContent}`;

  const fullUser = `${tagSpec}\n\n---\n\n${userPrompt}\n\nRespond with ONLY a JSON array of tags, e.g. [{"category":"data_analysis","topic":"query"}].`;

  const response: any = await client.chat.send({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: fullUser },
    ],
    max_tokens: 512,
  } as any, {
    headers: {
      'HTTP-Referer': 'https://localhost:3000',
      'X-Title': 'Atria Agent POC - Tag Script',
    },
  });

  const output = response.choices?.[0]?.message?.content ?? response.content ?? '';
  if (!output) throw new Error('Empty LLM response');
  return extractJsonArray(output);
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY is not set. Add it to .env');
    process.exit(1);
  }

  const tagSpec = fs.readFileSync(TAG_SPEC_PATH, 'utf8');
  const conversations: any[] = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
  const client = new OpenRouter({ apiKey });

  let totalUser = 0;
  let ok = 0;
  let err = 0;

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (let c = 0; c < conversations.length; c++) {
    const conv = conversations[c];
    const messages = conv.messages ?? [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.type !== 'user') continue;

      // Previous assistant message = last assistant message before this user message
      let prevAssistantContent: string | null = null;
      for (let j = i - 1; j >= 0; j--) {
        if (messages[j].type === 'assistant') {
          prevAssistantContent = messages[j].content ?? '';
          break;
        }
      }

      totalUser++;
      const userContent = msg.content ?? '';
      try {
        const tags = await tagUserMessage(client, userContent, prevAssistantContent, tagSpec);
        msg.tags = tags;
        ok++;
        if (totalUser % 50 === 0) console.log(`Tagged ${totalUser} user messages...`);
      } catch (e: any) {
        console.warn(`Failed to tag user message (conv ${c}, msg ${i}):`, e?.message ?? e);
        msg.tags = [{ category: 'other', topic: 'unspecified' }];
        err++;
      }

      await delay(300);
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(conversations, null, 2), 'utf8');
  console.log(`Done. Tagged ${ok} user messages, ${err} fallback to unspecified. Output: ${OUTPUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
