# PRD: Atria Agent — Slack Integration

**Author:** Atria Engineering
**Date:** 2026-03-16
**Status:** Draft
**Version:** 1.0

---

## 1. Overview

Enable users to interact with the Atria marketing analytics agent directly from Slack by @mentioning `@atria` in any channel or DM. The agent processes the request using the existing orchestration pipeline (guardrail → planner → tools → narrator) and replies in Slack with rich, multi-block content — including text, reports, ad cards, generated images, and interactive elements.

---

## 2. Problem Statement

Today, Atria Agent is only accessible through the dedicated web app. Marketing teams live in Slack — they discuss campaigns, share results, and make decisions there. Forcing them to context-switch to a separate tool creates friction:

- **Discoverability:** Team members who don't have the web app bookmarked never engage.
- **Shareability:** Insights generated in the web app must be manually copy-pasted into Slack.
- **Speed:** Quick questions ("what's the ROAS on our Nike campaign this week?") don't justify opening a separate tool.
- **Collaboration:** Teammates can't see or build on each other's queries in real time.

---

## 3. Goals & Non-Goals

### Goals
- Users can `@atria` in any Slack channel or DM and get a full agent response.
- Responses render rich content blocks: markdown text, performance reports, ad cards with thumbnails, generated image concepts, video script concepts.
- Long-running agent workflows stream progressively (plan → step updates → final result).
- Threaded conversations maintain session context (multi-turn).
- Team members in the same channel can see and build on each other's queries.

### Non-Goals (v1)
- Proactive/scheduled notifications (e.g., "Your ROAS dropped 20% today") — future v2.
- Slash commands (`/atria analyze`) — `@mention` is the primary interface for v1.
- Slack Home tab with dashboards — future v2.
- Discovery feed browsing or bookmarking from Slack — future v2.
- Modifying agent tools or orchestration logic — reuse existing pipeline as-is.

---

## 4. User Stories

| # | As a... | I want to... | So that... |
|---|---------|-------------|-----------|
| U1 | Marketing manager | `@atria what's the top performing ad this month?` in #marketing | I get an instant answer without leaving Slack |
| U2 | Creative lead | `@atria analyze the creatives on our top 3 ads and generate new variations` | I see ad cards, creative insights, and generated image concepts inline |
| U3 | Team member | Read a teammate's `@atria` thread | I learn from their query without re-asking |
| U4 | Analyst | Ask a follow-up question in the same thread | The agent remembers context from earlier in the thread |
| U5 | Manager | `@atria compare our performance against Nike and Adidas` | I get a competitor analysis report right in Slack |

---

## 5. Architecture

### 5.1 High-Level Flow

```
Slack (user @mentions @atria)
        │
        ▼
  Slack Events API (app_mention event)
        │
        ▼
  Slack Adapter Service (new)
   ├── Parse message, extract user/channel/thread context
   ├── Map Slack thread_ts → Atria sessionId
   ├── Immediately post "thinking..." placeholder
   │
   ├──► Call existing Agent pipeline
   │    (same as POST /api/stream, but consumed internally)
   │
   ├── Stream SSE events from Agent
   │    ├── text       → chat.appendStream() or chat.update()
   │    ├── plan       → Post plan block
   │    ├── report     → Post report as formatted blocks + file attachment
   │    ├── focused_items → Post ad card blocks with thumbnails
   │    ├── image_concepts → Upload generated images + captions
   │    ├── video_concepts → Post video script blocks
   │    └── done       → chat.stopStream(), add feedback buttons
   │
   └── Store session mapping (thread_ts ↔ sessionId)
```

### 5.2 Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      Slack Workspace                     │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐   │
│  │ #marketing│  │ #creative│  │ DM with @atria      │   │
│  └─────┬─────┘  └─────┬────┘  └──────────┬──────────┘   │
└────────┼───────────────┼─────────────────┼───────────────┘
         │               │                 │
         ▼               ▼                 ▼
┌─────────────────────────────────────────────────────────┐
│                   Slack Events API                       │
│              (app_mention / message.im)                  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Slack Adapter Service (NEW)                  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Event Router  │  │ Block Builder│  │ Session Store  │  │
│  │ (Bolt SDK)    │  │ (Block Kit)  │  │ (thread↔session│  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                   │          │
│  ┌──────▼─────────────────▼───────────────────▼───────┐  │
│  │              SSE Consumer / Renderer                │  │
│  │  (consumes agent SSE stream, maps to Slack blocks) │  │
│  └────────────────────────┬───────────────────────────┘  │
└───────────────────────────┼──────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│               Existing Atria Agent Backend               │
│                                                          │
│  ┌────────┐  ┌─────────┐  ┌───────────────────────┐     │
│  │Guardrail│─▶│ Planner │─▶│ Tool Execution Engine │     │
│  └────────┘  └─────────┘  │ (17 tools)            │     │
│                            └───────────────────────┘     │
│                                                          │
│  POST /api/stream (SSE) ◄── consumed by Slack Adapter    │
└─────────────────────────────────────────────────────────┘
```

### 5.3 Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Slack SDK | **Bolt for JavaScript** (`@slack/bolt`) | Same runtime as existing backend (Node.js/TS); team familiarity |
| Transport | **Socket Mode** for dev, **HTTP mode** for production | Socket Mode needs no public URL for local dev; HTTP scales better |
| Agent integration | **Internal function call** (not HTTP) | Slack adapter lives in same process as Express server; avoids network hop; directly calls `agent.run()` and consumes the SSE event emitter |
| Session mapping | **thread_ts → sessionId** in-memory Map (v1), Redis (v2) | Threads are the natural conversation boundary in Slack |
| Streaming | **Slack chat streaming API** (`chat.startStream` / `appendStream` / `stopStream`) | Native progressive rendering; shows text as it's generated |
| Rich content | **Block Kit** for structured data; **file uploads** for images | Block Kit supports text, images, buttons, context; file upload for generated images |
| Long reports | **Truncated preview in message + full report as file attachment** | Slack's 50-block / 4KB text limits; attach full markdown as `.md` file |

---

## 6. Content Block Mapping

How each Atria SSE event type maps to Slack output:

### 6.1 Text (`type: "text"`)

**Slack rendering:** Streamed via `chat.appendStream()` as mrkdwn text.

```
┌─────────────────────────────────────────────┐
│ 🤖 @atria                                   │
│                                              │
│ I'm analyzing your top performing ads from   │
│ the last 30 days across Meta and TikTok...   │
└─────────────────────────────────────────────┘
```

### 6.2 Plan (`type: "plan"`)

**Slack rendering:** A `section` block with task checklist, updated in-place via `chat.update()` as tasks complete.

```
┌─────────────────────────────────────────────┐
│ 📋 Execution Plan                            │
│                                              │
│ ✅ Query ad performance data (30 days)       │
│ ✅ Identify top 3 performers by ROAS         │
│ 🔄 Analyze creative elements...              │
│ ⬚  Generate new ad variations                │
│ ⬚  Consolidate findings                      │
└─────────────────────────────────────────────┘
```

### 6.3 Report (`type: "report"`)

**Slack rendering:** Truncated summary in blocks (first ~500 chars) + full report uploaded as a `.md` file attachment.

```
┌─────────────────────────────────────────────┐
│ 📊 Performance Analysis Report               │
│                                              │
│ Your top performer is "Summer Sale V2" with  │
│ 4.2x ROAS and $12,450 in revenue...         │
│                                              │
│ 📎 full-report.md (2.4 KB)                  │
│                                              │
│ [View Full Report]  [Share to Channel]       │
└─────────────────────────────────────────────┘
```

### 6.4 Focused Items (`type: "focused_items"`)

**Slack rendering:** Image blocks with ad thumbnails + context blocks for metrics.

```
┌─────────────────────────────────────────────┐
│ 🎯 Top 3 Ads Selected for Analysis          │
│                                              │
│ ┌─────────┐  Summer Sale V2                  │
│ │ 📷      │  Meta · Image · Active           │
│ │ thumb   │  ROAS: 4.2x · CTR: 3.1%         │
│ └─────────┘  Spend: $2,800 · Rev: $11,760   │
│                                              │
│ ┌─────────┐  Spring Collection               │
│ │ 📷      │  TikTok · Video · Active         │
│ │ thumb   │  ROAS: 3.8x · CTR: 2.7%         │
│ └─────────┘  Spend: $3,200 · Rev: $12,160   │
│                                              │
│ ┌─────────┐  Brand Awareness Q1              │
│ │ 📷      │  Meta · Carousel · Paused        │
│ │ thumb   │  ROAS: 3.5x · CTR: 2.3%         │
│ └─────────┘  Spend: $4,100 · Rev: $14,350   │
└─────────────────────────────────────────────┘
```

### 6.5 Image Concepts (`type: "image_concepts"`)

**Slack rendering:** Generated images uploaded via `files.uploadV2()`, displayed in a grid-like thread with captions.

```
┌─────────────────────────────────────────────┐
│ 🎨 Generated Ad Variations for "Summer Sale" │
│                                              │
│ ┌──────────────┐  ┌──────────────┐           │
│ │  [Generated]  │  │  [Generated]  │          │
│ │   Image 1     │  │   Image 2     │          │
│ └──────────────┘  └──────────────┘           │
│ Concept 1: Bold     Concept 2: Minimal       │
│ typography with     product shot with         │
│ summer gradient     clean background          │
│                                              │
│ +6 more variations ▾                         │
└─────────────────────────────────────────────┘
```

### 6.6 Video Concepts (`type: "video_concepts"`)

**Slack rendering:** Formatted text blocks with script breakdowns.

```
┌─────────────────────────────────────────────┐
│ 🎬 Video Script Concepts                     │
│                                              │
│ *Concept 1: "Day in the Life"*               │
│ Hook: Close-up of product being unboxed      │
│ Body: User showcasing 3 use cases            │
│ CTA: "Shop the collection — link in bio"     │
│ Duration: 15s · Style: UGC                   │
│                                              │
│ ─────────────────────────────────────────    │
│                                              │
│ *Concept 2: "Before & After"*                │
│ Hook: Split screen transformation            │
│ Body: Side-by-side product comparison        │
│ CTA: "See the difference yourself"           │
│ Duration: 30s · Style: Editorial             │
└─────────────────────────────────────────────┘
```

### 6.7 Feedback (on `type: "done"`)

**Slack rendering:** `chat.stopStream()` with AI feedback buttons.

```
┌─────────────────────────────────────────────┐
│ Was this helpful?  [👍]  [👎]                │
└─────────────────────────────────────────────┘
```

---

## 7. Detailed Requirements

### 7.1 Event Handling

| Req | Description | Priority |
|-----|-------------|----------|
| R1 | Listen for `app_mention` events in public/private channels | P0 |
| R2 | Listen for `message.im` events for direct messages | P0 |
| R3 | Acknowledge all events within 3 seconds (Slack requirement) | P0 |
| R4 | Strip `<@BOT_USER_ID>` prefix from message text before passing to agent | P0 |
| R5 | Extract `thread_ts` to determine if this is a follow-up or new conversation | P0 |

### 7.2 Session & Context Management

| Req | Description | Priority |
|-----|-------------|----------|
| R6 | Map `{channel_id}:{thread_ts}` → `sessionId` for multi-turn context | P0 |
| R7 | New top-level message creates a new session; replies in thread reuse the session | P0 |
| R8 | Pass channel context (channel name, workspace) as metadata to agent | P1 |
| R9 | Session TTL: expire sessions after 24 hours of inactivity | P1 |
| R10 | v2: Persist sessions in Redis for multi-instance deployments | P2 |

### 7.3 Streaming & Progressive Updates

| Req | Description | Priority |
|-----|-------------|----------|
| R11 | Use `chat.startStream()` immediately on receiving a request | P0 |
| R12 | Stream `text` events via `chat.appendStream()` for real-time narration | P0 |
| R13 | Call `chat.stopStream()` on `done` event with feedback buttons | P0 |
| R14 | Post plan block as a separate message; update it in-place as tasks complete | P1 |
| R15 | All rich content (reports, ad cards, images) posted as threaded replies | P0 |

### 7.4 Content Rendering

| Req | Description | Priority |
|-----|-------------|----------|
| R16 | Convert agent markdown to Slack mrkdwn format (subset of markdown) | P0 |
| R17 | Reports: truncate to ~500 chars preview + attach full `.md` file | P0 |
| R18 | Focused items: render as image + context blocks with metrics | P0 |
| R19 | Image concepts: upload via `files.uploadV2()` with captions | P0 |
| R20 | Video concepts: render as formatted section blocks | P0 |
| R21 | Plan: render as checklist with status emojis, update in-place | P1 |
| R22 | Respect 50-block limit per message; split into multiple messages if needed | P0 |

### 7.5 Error Handling

| Req | Description | Priority |
|-----|-------------|----------|
| R23 | If agent errors mid-stream, stop stream and post error message | P0 |
| R24 | If Slack rate-limited, queue messages and retry with `Retry-After` | P0 |
| R25 | If message exceeds 4KB text limit, split or truncate gracefully | P0 |
| R26 | Timeout: if agent takes >120s, post partial results + timeout notice | P1 |

### 7.6 Security & Permissions

| Req | Description | Priority |
|-----|-------------|----------|
| R27 | Verify Slack request signatures on all incoming events | P0 |
| R28 | Bot token scoped to minimum required permissions (see OAuth Scopes below) | P0 |
| R29 | No sensitive data (API keys, internal metrics) exposed in Slack messages | P0 |
| R30 | Admin can restrict which channels the bot responds in (allowlist) | P1 |

---

## 8. OAuth Scopes Required

| Scope | Purpose |
|-------|---------|
| `app_mentions:read` | Receive @mention events |
| `chat:write` | Post messages and stream responses |
| `channels:history` | Read thread context in public channels |
| `groups:history` | Read thread context in private channels |
| `im:history` | Read DM conversation for context |
| `im:read` | Receive DM events |
| `files:write` | Upload reports and generated images |
| `reactions:write` | Add reactions (e.g., 👀 to acknowledge receipt) |

---

## 9. Technical Implementation

### 9.1 New Files

```
src/
├── slack/
│   ├── slack-app.ts          # Bolt app initialization, event listeners
│   ├── slack-adapter.ts      # SSE-to-Slack block renderer (core logic)
│   ├── block-builder.ts      # Block Kit JSON constructors for each content type
│   ├── markdown-converter.ts # Agent markdown → Slack mrkdwn conversion
│   ├── session-store.ts      # thread_ts ↔ sessionId mapping
│   └── file-uploader.ts      # Wrapper around files.uploadV2()
```

### 9.2 Modified Files

```
src/server.ts        # Mount Bolt app alongside Express; shared agent instances
src/agent.ts         # Expose agent.run() as an EventEmitter (not just HTTP SSE)
src/context.ts       # No changes expected
```

### 9.3 Agent Integration Pattern

The key architectural change: decouple the agent's event emission from the HTTP SSE transport so the Slack adapter can consume the same event stream.

```typescript
// agent.ts — expose as EventEmitter
class Agent {
  async run(message: string, sessionId: string): AsyncGenerator<AgentEvent> {
    // yields: { type: 'text', content: '...' }
    //         { type: 'plan', planId: '...', tasks: [...] }
    //         { type: 'report', ... }
    //         { type: 'focused_items', ... }
    //         { type: 'image_concepts', ... }
    //         { type: 'done' }
  }
}

// slack-adapter.ts
async function handleMention(event, client) {
  const sessionId = sessionStore.getOrCreate(event.channel, event.thread_ts);
  const agent = getAgent(sessionId);

  const streamer = await client.chat.startStream({ channel: event.channel, thread_ts: event.thread_ts });

  for await (const evt of agent.run(event.text, sessionId)) {
    switch (evt.type) {
      case 'text':
        await streamer.append({ markdown_text: evt.content });
        break;
      case 'plan':
        await postPlanBlock(client, event.channel, event.thread_ts, evt);
        break;
      case 'report':
        await postReportWithAttachment(client, event.channel, event.thread_ts, evt);
        break;
      case 'focused_items':
        await postAdCards(client, event.channel, event.thread_ts, evt);
        break;
      case 'image_concepts':
        await uploadAndPostImages(client, event.channel, event.thread_ts, evt);
        break;
      case 'done':
        await streamer.stop({ blocks: buildFeedbackButtons() });
        break;
    }
  }
}
```

### 9.4 Bolt App Setup

```typescript
// slack-app.ts
import { App } from '@slack/bolt';

const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: process.env.NODE_ENV !== 'production',
  appToken: process.env.SLACK_APP_TOKEN, // for Socket Mode
});

slackApp.event('app_mention', async ({ event, client }) => {
  await handleMention(event, client);
});

slackApp.event('message', async ({ event, client }) => {
  if (event.channel_type === 'im') {
    await handleMention(event, client);
  }
});
```

---

## 10. Constraints & Limitations

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| **3-second acknowledgment** | Must respond before agent starts processing | Post "thinking..." immediately; stream actual content after |
| **50 blocks per message** | Complex responses (many ad cards) exceed limit | Split into multiple threaded messages |
| **4KB text per block** | Long reports get truncated | Preview + file attachment pattern |
| **1 msg/sec per channel** | Rapid tool outputs may hit rate limit | Queue and batch updates; use `chat.update()` to modify existing messages |
| **16KB per message payload** | Large Block Kit JSON may exceed | Split into multiple messages |
| **Image in blocks requires public URL** | Generated images are base64 from Gemini | Upload to Slack via `files.uploadV2()` first, then reference |
| **No native charts in Slack** | Agent's performance data can't render as interactive charts | Generate chart as image server-side (e.g., Chart.js → PNG), upload to Slack |

---

## 11. Environment Variables (New)

```env
SLACK_BOT_TOKEN=xoxb-...          # Bot User OAuth Token
SLACK_SIGNING_SECRET=...           # Request verification
SLACK_APP_TOKEN=xapp-...           # Socket Mode token (dev only)
SLACK_ALLOWED_CHANNELS=C01,C02     # Optional channel allowlist (comma-separated)
```

---

## 12. Milestones & Phases

### Phase 1: Core Integration (2 weeks)
- Bolt app setup with Socket Mode
- `app_mention` event handling
- Text streaming via `chat.startStream()`
- Basic session management (thread → session)
- Markdown → mrkdwn conversion

### Phase 2: Rich Content (2 weeks)
- Report blocks with file attachments
- Focused items (ad cards) with thumbnails
- Image concept uploads
- Video script blocks
- Plan display with in-place updates

### Phase 3: Polish & Production (1 week)
- HTTP mode for production deployment
- Rate limit handling and message queuing
- Error handling and timeout management
- Channel allowlist configuration
- Feedback button interactions (thumbs up/down logging)

### Phase 4: Future Enhancements (v2)
- Proactive notifications (ROAS alerts, budget pacing)
- Slash commands for quick actions
- Slack Home tab with analytics dashboard
- Interactive buttons (e.g., "Generate more variations", "Bookmark this ad")
- Redis session store for horizontal scaling
- Multi-workspace support

---

## 13. Success Metrics

| Metric | Target |
|--------|--------|
| Time to first visible response | < 2 seconds |
| End-to-end response completion | < 60 seconds for standard queries |
| Message delivery success rate | > 99.5% |
| User engagement (queries/week/team) | 3x increase vs web-only |
| Feedback score (thumbs up %) | > 80% |

---

## 14. Open Questions

1. **Multi-workspace:** Should the bot support multiple Slack workspaces from day one, or single-workspace for v1?
2. **Authentication:** Should Slack users map to Atria accounts, or is the bot a shared team resource with one data context?
3. **Channel-specific brands:** Should `@atria` in `#nike-marketing` auto-scope to the Nike brand context?
4. **Image generation costs:** Generating 8 image concepts per ad is expensive — should Slack queries default to fewer (e.g., 4)?
5. **Thread behavior:** When a user starts a new `@atria` query in the middle of someone else's thread, should it create a new session or join the existing one?
