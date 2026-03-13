# 20 — Content Generation & Delivery System Architecture

> **EduGenius v2.0 — Content System Upgrade**
> Implemented: 2026-03-10
> Status: Production-ready (0 TS errors, build ✓)

---

## Overview

The content system upgrade delivers a complete multi-channel content machine for EduGenius, enabling Giri to generate, repurpose, orchestrate, and deploy content across 9 channels for 6 exams with a single interface.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Content Hub UI (/content-hub)                │
│  Tab 1: Generate | Tab 2: Repurpose | Tab 3: Campaign           │
│  Tab 4: Pages   | Tab 5: Sync Status                            │
└────────────┬────────────────────────────────────────────────────┘
             │
    ┌────────▼──────────────────────────────────────┐
    │           masterContentAgent.ts               │
    │  Supervisor: Scout → Strategy → Atlas →       │
    │  Herald → Oracle → Feedback Loop              │
    └────────┬──────────────────────────────────────┘
             │
    ┌────────▼──────────────────────────────────────┐
    │       contentGenerationHub.ts (Atlas)         │
    │  Blog | YouTube | Short Video | X Thread |    │
    │  Reddit | Quora | LinkedIn | Instagram | Email │
    └────────┬──────────────────────────────────────┘
             │
    ┌────────▼──────────────────────────────────────┐
    │    contentRepurposingService.ts               │
    │  Channel → Channel | Exam → Exam | Audience   │
    │  GATE EM ↔ JEE Math ↔ CAT Quant ↔ CBSE 12   │
    └────────┬──────────────────────────────────────┘
             │
    ┌────────▼──────────────────────────────────────┐
    │     contentSyncService.ts                     │
    │  Cross-agent sync health + audit             │
    │  User Intent → Scout → Atlas → RAG → Sage    │
    └───────────────────────────────────────────────┘
```

---

## Files Created

### Services

| File | Purpose |
|------|---------|
| `services/contentGenerationHub.ts` | Multi-format content generator (9 channels, 6 exams) |
| `services/contentRepurposingService.ts` | Cross-channel, cross-exam, cross-audience repurposing |
| `services/localPageBuilderService.ts` | Self-contained HTML page builder + Netlify deploy |
| `services/masterContentAgent.ts` | Campaign orchestrator (VoltAgent supervisor pattern) |
| `services/contentSyncService.ts` | Cross-agent sync layer + health audit |

### Pages (CEO-only)

| Route | File | Purpose |
|-------|------|---------|
| `/content-hub` | `pages/ContentHub.tsx` | 5-tab master content hub |
| `/page-builder` | `pages/LocalPageBuilder.tsx` | Page build/preview/deploy |

### Output Directory

```
/home/sprite/clawd/edugenius/pages-output/
```
Generated HTML files land here for Netlify deploy.

---

## Content Formats Supported

### 9 Channels
1. **Blog** — Title + meta + H1-H3 outline + 3 sections + conclusion + CTA + SEO keywords
2. **YouTube/Vlog** — Title + thumbnail brief + description + timestamps + chapters + script + pinned comment
3. **Short Video** — Hook (3s) + 60s script + caption + hashtags + CTA overlay
4. **X/Twitter** — Thread (5-8 tweets) + standalone tweet + poll options
5. **Reddit** — Post title + body + TL;DR + flair (r/GATE, r/JEEpreparation, etc.)
6. **Quora** — Question + detailed answer + credentials line
7. **LinkedIn** — Professional post + article outline
8. **Instagram** — Caption + hashtags + 3-slide story sequence
9. **Email** — Subject + preview text + body + CTA

### 6 Exams
GATE, JEE, NEET, CAT, UPSC, CBSE

### 6 Audience Types
student_beginner, student_intermediate, student_advanced, teacher, parent, aspirant

---

## Strategy Engine Extensions

### `contentStrategyService.ts` additions:

- **`CHANNEL_STRATEGIES`** — specs for all 9 channels (tone, length, CTA, frequency, best time)
- **`EXAM_STRATEGIES`** — per-exam content pillars, urgency, top topics
- **`HOOK_LIBRARY`** — 3+ exam-specific hooks per channel (6 × 9 = 54+ hooks)
- **`selectStrategy(exam, audience, channel, daysToExam)`** — returns best content type, tone, length, CTA, hooks
- **`generateContentCalendar(exam, examDate, today)`** — week-by-week content plan with urgency levels and channel recommendations

---

## Repurposing Engine

### Cross-channel
Every channel has repurpose instructions for every other channel.
Total: 9 × 8 = 72 repurpose directions.

### Cross-exam (overlap map)
| Source | Target | Shared Topics |
|--------|--------|--------------|
| GATE | JEE | calculus, linear algebra, complex numbers |
| GATE | UPSC | engineering concepts, basic physics |
| GATE | CBSE | calculus, vectors, electromagnetism |
| JEE | NEET | physics fundamentals, optics, thermodynamics |
| JEE | CAT | permutations, probability, algebra |
| CAT | CBSE | algebra, geometry, statistics |

### Cross-audience
6 × 6 = 36 audience adaptation instructions.

---

## Campaign Orchestrator Pipeline

```
orchestrateContentCampaign(exam, topic, targetDate, {audience, channels})
    │
    ├── Step 1: Scout     — trend scouting + Reddit intel
    │         emits: content:scout:insights
    │
    ├── Step 2: Strategy  — selectStrategy() → publish schedule
    │         emits: content:strategy:selected
    │
    ├── Step 3: Atlas     — generateAllChannels() → all channels
    │         emits: content:atlas:content_ready
    │         feeds: content:rag:index_request
    │
    ├── Step 4: Herald    — distribution queue per channel
    │         emits: content:herald:distribute_request
    │
    └── Step 5: Oracle    — tracking registration + metrics
              emits: content:oracle:track_campaign
```

---

## Cross-Agent Sync Connections

| Connection | From | To | Signal Key |
|-----------|------|----|-----------|
| User Intent → Strategy | userResearchSkill | contentStrategyService | `content:user_intent` |
| Scout → Topics | scoutIntelligenceService | contentGenerationHub | `content:scout:insights` |
| Atlas → RAG | contentGenerationHub | ragIndexer | `content:atlas:content_ready` |
| Herald → Oracle | Herald delivery | Oracle analytics | `content:herald:distribute_request` |
| RAG → Sage | ragIndexer | Sage tutor | `edugenius_rag_indexer_job` |
| Strategy → Atlas | contentStrategyService | contentGenerationHub | `content:strategy:selected` |
| Oracle → Feedback | Oracle analytics | Strategy/Quality | `content:oracle:track_campaign` |
| Page Builder → Oracle | localPageBuilderService | Oracle | built pages key |

---

## Local Page Builder

### Page Types
- `exam_landing` — Hero + features + CTA form + schema.org + OG tags
- `topic_explainer` — Article + inline CTA + structured content
- `lead_capture` — Minimal form (name, email, phone)
- `free_resource` — Content + download CTA + email gate

### HTML Output Features
- Tailwind CDN (zero build dependency)
- SEO meta tags (title, description, robots)
- OG tags (og:title, og:description, og:image)
- Twitter card meta
- Schema.org JSON-LD (EducationalOrganization)
- Google Analytics placeholder
- Lead capture form → redirects to edugenius.app/signup
- Responsive mobile-first design

### Deploy Flow
1. Build page → saves HTML to localStorage + emits signal
2. Preview → iframe in UI
3. Deploy button → Netlify CLI (one-click)
4. Sync status → local_only | deploying | deployed | deploy_failed

---

## localStorage Keys

All keys prefixed `edugenius_content_`:

| Key | Purpose |
|-----|---------|
| `edugenius_content_campaigns` | All campaign records |
| `edugenius_content_active_campaign` | Current campaign ID |
| `edugenius_content_batch_queue` | Scheduled campaigns |
| `edugenius_content_built_pages` | All built HTML pages |
| `edugenius_content_generation_cache` | 24h content cache |
| `edugenius_content_bulk_repurpose_last` | Last bulk repurpose |
| `edugenius_content_rag_queue` | Atlas → RAG queue |
| `edugenius_content_oracle_registry` | Oracle tracking registry |
| `edugenius_content_scout_insights_latest` | Latest Scout intel |
| `edugenius_content_user_intent_latest` | Latest user intent |
| `content_sync_health` | Sync health report |

### Agent signal keys (prefixed `content:`)

| Key | Emitted by |
|-----|-----------|
| `content:scout:insights` | Scout step |
| `content:strategy:selected` | Strategy step |
| `content:atlas:content_ready` | Atlas step |
| `content:atlas:quick_generate` | quickGenerate() |
| `content:herald:distribute_request` | Herald step |
| `content:oracle:track_campaign` | Oracle step |
| `content:campaign:started` | Orchestrator |
| `content:campaign:complete` | Orchestrator |
| `content:campaign:failed` | Orchestrator |
| `content:user_intent` | syncUserIntent() |

---

## Sidebar Nav (CEO)

Two new items added to `ceoNavItems`:
- `🗂 Content Hub` → `/content-hub`
- `🌐 Page Builder` → `/page-builder`

---

## Build Status

- **TypeScript:** 0 errors
- **Vite build:** ✓ 3061 modules transformed in 12.30s
- **New bundle:** `ContentHub-D57nox8l.js` (51.26 kB gzip: 14.43 kB)

---

## Update — Two-Layer Architecture (2026-03-13)

> **Commits:** `e81f548` · `e6a5f6d` · `88b5adb` · `cd99890` · `6af8d66` · `e1bb7cb`

The content system now operates on a **mandatory + personalized two-layer model**. Every content request first fulfills a guaranteed mandatory baseline, then adds persona-adapted personalized content on top. This makes EduGenius's content both pedagogically sound (mandatory) and individually engaging (personalized).

### The Two-Layer Model

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: HYPER-PERSONALIZED                                │
│  style-adapted, mood-aware, cognitive-load-adjusted         │
├─────────────────────────────────────────────────────────────┤
│  LAYER 1: MANDATORY BASELINE                                │
│  concept_core · formula_card · worked_example               │
│  pyq_set · common_mistakes · exam_tips                      │
└─────────────────────────────────────────────────────────────┘
```

**Graceful degradation:** If the personalization budget is exhausted (80 calls/day pool), only mandatory is delivered. If mandatory generation fails, cached or T0 static atoms are used. Students never see a blank screen.

### New Services Added (2026-03-13)

| Service File | Purpose | Lines |
|-------------|---------|-------|
| `contentSlotService.ts` | Universal slot resolution engine — 16 SlotIds, 18 ContentModules, 9 resolution scenarios | ~550 |
| `mandatoryContentService.ts` | Mandatory baseline engine — 6 atom types, 29 exam×topic pairs | ~600 |
| `contentLayerService.ts` | Orchestrates mandatory → personalized pipeline | ~250 |
| `coursePlaybookService.ts` | Universal knowledge graph — one playbook per subtopic | 1,235 |
| `playbookProgressiveUpdater.ts` | Signal-bus wiring for live playbook updates from all 6 agents | 599 |
| `courseMaterialGenerator.ts` | Playbook-driven course material generator — 8 templates, 34 personalization variables | 1,228 |

### New Components Added (2026-03-13)

| Component / Page | Route | Purpose |
|-----------------|-------|---------|
| `ContentSlot.tsx` | (drop-in, no route) | Universal renderer for any slot in any page |
| `PersonalizedFeed.tsx` | (embedded in Learn page) | Adaptive infinite-scroll feed |
| `ContentPersonalizationControl.tsx` | `/content-personalization` | CEO: slot simulator + A/B override manager |
| `CoursePlaybookViewer.tsx` | `/course-playbook` | CEO: browse/inspect/enrich all course playbooks |
| `CourseMaterialStudio.tsx` | `/course-material-studio` | CEO + Student: generate personalized course material |

### Generation Pipeline Two-Layer Sync

All 9 existing generation services were updated to be layer-aware in commit `88b5adb`. Every generation function now knows whether it is fulfilling a mandatory or personalized request:

- **Layer-aware prompts:** Mandatory prompts are framed for accuracy + completeness; personalized prompts are framed for style + engagement.
- **Layer-aware arbitration:** Mandatory math → Wolfram Alpha first; mandatory PYQs → static library only (no hallucination risk); personalized → LLM.
- **Batch priority:** Mandatory jobs always processed first in all batch queues.
- **Automation scoring:** Mandatory content gaps receive a **+200% priority boost** in the automation scoring system.
- **Sage directive:** `mandatoryDelivered[]` param tells Sage which atoms the student has already seen — Sage skips re-explaining and builds on top.

### Rate Limit Budget System

| Budget Category | Daily Allocation | Can Be Used For Personalization? |
|----------------|-----------------|--------------------------------|
| Mandatory reserve | 20 calls/day | No — protected |
| Personalization pool | 80 calls/day | Yes |
| Emergency burst | +10 calls/day | Mandatory only |
| **Total** | **100 calls/day** | |

### Course Playbook (Single Source of Truth)

The **Course Playbook** (`coursePlaybookService.ts`) is the single source of truth for every subtopic. Each playbook stores 10 sections: academic foundation, teaching intelligence, exam intelligence, content atoms, student analytics, preferences, search intelligence, agent connections, prompt intelligence, and knowledge graph. Every agent reads and writes to it.

**10 GATE EM subtopics** seeded with real data (5 Linear Algebra + 5 Calculus), including real PYQs with explanations, high-yield formulas, Socratic questions, and misconceptions.

Storage: `localStorage` (key pattern: `eg_playbook_{examId}_{topicId}_{subtopicId}`), Supabase-ready.

Full documentation: **[`24-course-playbook.md`](./24-course-playbook.md)**

### Course Material Generator

The `courseMaterialGenerator.ts` (1,228 lines) generates fully-assembled course materials by reading from Course Playbooks. Supports:

- **8 templates:** exam_cracker, concept_builder, quick_revision, visual_deep_dive, socratic_journey, topper_strategy, parent_brief, teacher_kit
- **34 personalization variables** across 5 dimensions
- **`parseCustomRequest()`:** NLP parser converts free-form text ("explain like a story") into resolved `PersonalizationConfig`
- **`autoPersonalize()`:** reads live student state + playbook and resolves all 34 variables automatically
- **Sage integration:** `buildCourseMaterialPrompt()` — Sage teaches from generated material

Full documentation: **[`25-course-material-generator.md`](./25-course-material-generator.md)**

### Two-Layer Architecture Documentation

Full documentation of the mandatory + personalized architecture:  
**[`23-two-layer-content-architecture.md`](./23-two-layer-content-architecture.md)**

### New CEO Sidebar Nav Items (2026-03-13)

| Item | Route | Purpose |
|------|-------|---------|
| `🎯 Content Personalization` | `/content-personalization` | Slot simulator + A/B override manager |
| `📖 Course Playbook` | `/course-playbook` | Browse + health + enrich all subtopic playbooks |
| `📚 Course Material Studio` | `/course-material-studio` | Generate personalized course material |
