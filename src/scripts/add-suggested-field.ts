/**
 * Add "suggested" field to user messages in conversations_tagged.json.
 * Default "no"; set to question number "1"-"9" when content matches suggested_questions.md.
 */

import * as fs from 'fs';
import * as path from 'path';

const SUGGESTED_QUESTIONS_PATH = path.join(__dirname, '../data/suggested_questions.md');
const CONVERSATIONS_PATH = path.join(__dirname, '../data/conversations_tagged.json');

function normalize(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function parseSuggestedQuestions(md: string): string[] {
  const lines = md.split('\n');
  const questions: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\d+\.\s+(.+)$/);
    if (m) questions.push(m[1].trim());
  }
  return questions;
}

function main() {
  const md = fs.readFileSync(SUGGESTED_QUESTIONS_PATH, 'utf8');
  const suggestedQuestions = parseSuggestedQuestions(md);
  const normalizedQuestions = suggestedQuestions.map(normalize);

  const conversations: any[] = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
  let matched = 0;

  for (const conv of conversations) {
    const messages = conv.messages ?? [];
    for (const msg of messages) {
      if (msg.type !== 'user') continue;

      msg.suggested = 'no';
      const content = (msg.content ?? '').trim();
      if (!content) continue;

      const normalizedContent = normalize(content);
      for (let i = 0; i < normalizedQuestions.length; i++) {
        if (normalizedContent === normalizedQuestions[i]) {
          msg.suggested = String(i + 1);
          matched++;
          break;
        }
      }
    }
  }

  fs.writeFileSync(CONVERSATIONS_PATH, JSON.stringify(conversations, null, 2), 'utf8');
  console.log(`Updated conversations_tagged.json: added "suggested" to user messages. ${matched} matched a suggested question.`);
}

main();
