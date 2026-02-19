/**
 * Process conversations_tagged_raw copy.json:
 * - User messages whose content contains "report_data" are special: parse JSON, extract report_data.title, remove message.
 * - Consecutive special messages: append titles to same array, remove each.
 * - When next user message is not special: prepend "[title1, title2, ...]" to content, keep message, clear titles.
 * - Clear titles at start of each conversation and on every assistant message.
 */

import * as fs from 'fs';
import * as path from 'path';

const FILE_PATH = path.join(__dirname, '../data/conversations_tagged_raw copy.json');

function isSpecialMessage(content: string): boolean {
  return typeof content === 'string' && content.includes('report_data');
}

function extractReportTitles(content: string): string[] {
  const titles: string[] = [];
  try {
    let raw = content.trim();
    // Strip outer quotes if present (content may be "\"[{\"type\":...}]\"" )
    if (raw.startsWith('"')) raw = raw.slice(1);
    if (raw.endsWith('"')) raw = raw.slice(0, -1);
    // Unescape: in the string we have \\\" (backslash-quote) which must become " for valid JSON
    const unescaped = raw.replace(/\\"/g, '"');
    const arr = JSON.parse(unescaped);
    if (!Array.isArray(arr)) return titles;
    for (const item of arr) {
      if (item && item.report_data && typeof item.report_data.title === 'string') {
        titles.push(item.report_data.title);
      }
    }
  } catch (_) {
    // ignore parse errors
  }
  return titles;
}

function processConversations(data: any[]): void {
  for (const conv of data) {
    const messages = conv.messages ?? [];
    let reportTitles: string[] = [];
    const kept: any[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      if (msg.type === 'assistant') {
        reportTitles = [];
        kept.push(msg);
        continue;
      }

      if (msg.type === 'user') {
        const content = msg.content ?? '';

        if (isSpecialMessage(content)) {
          const titles = extractReportTitles(content);
          reportTitles.push(...titles);
          // remove this message (do not push to kept)
          continue;
        }

        // Not special: if we have accumulated titles, prepend "[title1, title2, ...]" to content
        if (reportTitles.length > 0) {
          const prefix = `[${reportTitles.join(', ')}]`;
          msg.content = prefix + content;
          reportTitles = [];
        }
        kept.push(msg);
        continue;
      }

      // any other type (e.g. system): clear titles and keep
      reportTitles = [];
      kept.push(msg);
    }

    conv.messages = kept;
  }
}

function main() {
  const raw = fs.readFileSync(FILE_PATH, 'utf-8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    console.error('Expected root array');
    process.exit(1);
  }
  processConversations(data);
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  console.log('Done. Updated', FILE_PATH);
}

main();
