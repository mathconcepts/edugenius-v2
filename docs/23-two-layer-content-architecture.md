# 23 — Two-Layer Content Architecture

> **EduGenius v2.0 — Mandatory + Personalized Content System**
> Implemented: 2026-03-13  
> Commits: `e81f548` (Content Slot System) · `e6a5f6d` (Two-Layer Architecture) · `88b5adb` (Pipeline Sync)  
> Status: Production-ready (0 TS errors, build ✓)

---

## Overview

Every piece of content in EduGenius is now delivered through a two-layer model:

- **Layer 1 (Mandatory):** A guaranteed, high-accuracy baseline that every student on every topic must receive — correct concept core, formulas, a worked example, PYQs, common mistakes, and exam tips. Non-negotiable. Never skipped.
- **Layer 2 (Personalized):** Style, mood, cognitive-load, and exam-proximity adaptations placed on top of the baseline. Budget-limited; gracefully degrades to Layer 1 if exhausted.

The content slot system renders this layered output in any page through a universal `<ContentSlot>` drop-in component.

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    ANY PAGE / COMPONENT                          │
│        <ContentSlot slotId="dashboard_hero" ... />               │
└──────────────────┬───────────────────────────────────────────────┘
                   │ SlotContext (who + where + when + why)
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│              contentSlotService.ts                               │
│  resolveSlot(ctx) → SlotConfig                                   │
│  • 9 resolution scenarios (priority order)                       │
│  • Slot filtering (allowlists per slotId)                        │
│  • Mandatory-first injection                                     │
│  • A/B override application                                      │
│  • Signal-weight visibility gating                               │
└─────────────────────────┬────────────────────────────────────────┘
                          │ resolved modules
          ┌───────────────┴──────────────┐
          ▼                              ▼
┌────────────────────┐       ┌──────────────────────────────────┐
│  LAYER 2           │       │  LAYER 1                         │
│  PERSONALIZED      │       │  MANDATORY BASELINE              │
│                    │       │                                  │
│  contentPersona    │       │  mandatoryContentService.ts      │
│  Engine.ts         │       │  • concept_core                  │
│  • style-adapted   │       │  • formula_card                  │
│  • mood-aware      │       │  • worked_example                │
│  • load-adjusted   │       │  • pyq_set                       │
│  • LLM-generated   │       │  • common_mistakes               │
└────────────────────┘       │  • exam_tips                     │
          │                  └──────────────────────────────────┘
          │                              │
          └──────────────┬───────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│              contentLayerService.ts                              │
│  getLayeredContent(examId, topicId, persona, surface)            │
│  → LayeredContent { mandatory[], personalized[], ... }           │
│                                                                  │
│  Graceful degradation:                                           │
│    Budget exhausted → mandatory only (never blocks user)         │
│    Personalization fails → mandatory only                        │
│    Everything fails → T0 static fallback                         │
└──────────────────────────────────────────────────────────────────┘
                         │
                         ▼
              Student sees content
```

---

## Layer 1 — Mandatory Baseline

### What it is

The mandatory layer guarantees that for **every (examId, topicId) pair**, the following six atom types always exist and are delivered first:

| Atom Type | Purpose | Delivery Order |
|-----------|---------|----------------|
| `concept_core` | Core explanation of the topic | 1st |
| `formula_card` | Key formulas + definitions | 2nd |
| `worked_example` | At least 1 fully solved problem | 3rd |
| `pyq_set` | At least 5 past-year questions with solutions | 4th |
| `common_mistakes` | Top 3 mistake alerts with corrections | 5th |
| `exam_tips` | Exam-specific weight + strategy | 6th |

### Coverage Map

Every exam × topic pair below is guaranteed to have all 6 mandatory atoms:

| Exam | Topics Covered | Total Pairs |
|------|---------------|-------------|
| `GATE_EM` | linear_algebra, calculus, probability, differential_equations, transform_theory, complex_variables, numerical_methods | 7 |
| `JEE` | mechanics, electrostatics, waves, organic_chemistry, calculus, coordinate_geometry | 6 |
| `NEET` | human_physiology, cell_biology, genetics, ecology, organic_chemistry | 5 |
| `CAT` | arithmetic, algebra, geometry, data_interpretation, reading_comprehension, logical_reasoning | 6 |
| `UPSC` | modern_history, polity, geography, economy, environment | 5 |
| **Total** | | **29 pairs** |

### Generation Priority Rules

When the mandatory layer detects missing atoms, it queues them with elevated priority:

| Condition | Priority Level | Generation Behaviour |
|-----------|---------------|---------------------|
| Mandatory atom missing | `critical` | First in batch; +200% automation score |
| Mandatory atom stale (>7d) | `high` | Second in batch |
| Personalized atom missing | `normal` | After all mandatory |
| Personalized atom stale | `low` | Background |

The automation scoring system (contentAutomationService) multiplies the score of any mandatory gap by **3×** (i.e. +200%) to ensure it is prioritized over all personalized content jobs.

---

## Layer 2 — Personalized Adaptations

### Personalization Variables

All 34 variables across 5 dimensions that Layer 2 uses when adapting content:

| Dimension | Variable | Source | Effect |
|-----------|----------|--------|--------|
| **Learner Identity** | `learningStyle` | studentPersonaEngine | visual/analytical/story_driven/practice_first/auditory |
| | `cognitiveTier` | courseOrchestrator | foundational/developing/proficient/advanced |
| | `cognitiveLoad` | SlotContext | low/medium/high/overloaded → simplify or expand |
| | `role` | auth profile | student/teacher/parent → different content type |
| | `emotionalState` | Mentor signal | stressed/confident/motivated → tone adjustment |
| | `streakDays` | persona | motivation framing |
| | `studyTimePattern` | persona | session structure |
| **Exam & Topic** | `examId` | user profile | GATE_EM / JEE / NEET / CAT / UPSC |
| | `topicId` | current topic | parent topic key |
| | `subtopicIds[]` | current subtopic | which subtopics to cover |
| | `daysToExam` | persona | urgency framing, content depth |
| | `topicMasteryPct` | Oracle analytics | difficulty level selection |
| **Content Preferences** | `preferredFormat` | playbook.studentPreferences | lesson_notes/cheatsheet/visual_diagram_text/worked_example/analogy_explainer |
| | `sessionLengthMinutes` | playbook / persona | 5/10/15/30/60 |
| | `preferredDifficulty` | playbook | easy/medium/hard/mixed |
| | `includeAnalogies` | persona.prefersAnalogies | whether to generate analogy sections |
| | `includeSocraticQuestions` | template config | whether to include Socratic prompts |
| | `includePYQs` | template / user | whether to include PYQs |
| | `includeFormulas` | template / user | whether to include formula sections |
| | `includeCommonMistakes` | template config | whether to include misconception sections |
| | `includeExamTips` | template config | whether to include exam tip sections |
| **Focus & Avoidance** | `focusAreas[]` | user request / parseCustomRequest | subtopics to front-load |
| | `avoidTopics[]` | user request | subtopics to skip |
| | `customRequest` | free-form text | NLP-parsed to any of the above variables |
| **Playbook State** | `preferredLearningStyles` | playbook.studentPreferences.preferredLearningStyles | aggregate of what worked |
| | `sessionLengthPreference` | playbook.studentPreferences.sessionLengthPreference | aggregate session pref |
| | `preferredDifficultyPref` | playbook.studentPreferences.preferredDifficulty | aggregate difficulty pref |
| | `bestTemplateKey` | playbook.promptIntelligence.bestTemplateKey | which Sage prompt worked best |
| | `commonStuckPoints[]` | playbook.analytics.commonStuckPoints | used to hint exercises |
| | `effectiveAnalogies[]` | playbook.pedagogy.effectiveAnalogies | which analogies to use |
| | `socraticQuestions[]` | playbook.pedagogy.socraticQuestions | pre-validated questions |
| | `scaffoldingStrategies[]` | playbook.pedagogy.scaffoldingStrategies | teaching approach |
| | `checkpointQuestions[]` | playbook.pedagogy.checkpointQuestions | in-section exercises |
| **Session Context** | `timeOfDay` | SlotContext (derived from wall clock) | morning/afternoon/evening/night/late_night |
| | `mood` | mood check-in widget | stressed/motivated/neutral etc. |

### Resolution Logic (Layer 2)

```
buildPersonalizedLayer(examId, topicId, personaCtx) →
  1. Read playbook (examId, topicId, subtopicId)
  2. Extract preferredLearningStyles → pick top style
  3. Compare persona.cognitiveTier → choose depth
  4. cognitiveLoad overloaded? → simplify, shorten
  5. daysToExam ≤ 7? → inject exam urgency framing
  6. Consume 1 personalization budget token
  7. Build style-adapted prompt
  8. Call LLM (with personalized system prompt)
  9. Return PersonalizedContent atoms
```

---

## Rate Limit Budget System

The system has a **100 calls/day budget** for all content generation. The budget is split:

| Budget Category | Allocation | Cannot Be Overridden? |
|----------------|-----------|----------------------|
| Mandatory reserve | 20 calls/day | Yes — always protected |
| Personalization pool | 80 calls/day | No — can be exhausted |
| Emergency mandatory buffer | +10 calls/day (burst) | Yes |

**Rules:**
- If personalization pool is exhausted → only mandatory is delivered (never blocks the user)
- Mandatory reserve is **never** drawn down for personalized requests
- `consumeContentBudget('mandatory')` deducts from the reserve
- `consumeContentBudget('personalized')` deducts from the pool
- Budget resets daily at 00:00 UTC

**Graceful degradation chain:**
```
Full personalization available
  → if personalization budget exhausted: mandatory only
  → if mandatory generation fails: cached mandatory
  → if cache empty: T0 static atoms (always available)
  → never: blank screen
```

---

## ContentSlot System

### What it is

`ContentSlot` is a universal drop-in React component. You place it anywhere in any page, give it a `slotId` and minimal context, and it automatically resolves and renders the correct personalized (or mandatory) module for that student at that moment.

```tsx
// Drop-in — zero setup
<ContentSlot slotId="dashboard_hero" userId={userId} examId={examId} topic={topic} />
```

### All 16 SlotIds

| SlotId | Location | Layout | Max Modules | Auto-refresh |
|--------|----------|--------|-------------|-------------|
| `dashboard_hero` | Top of student dashboard | single | 1 | 5 min |
| `dashboard_sidebar` | Right column widget stack | stack | 4 | 2 min |
| `chat_pre_session` | Before Sage chat starts | single | 1 | — |
| `chat_post_response` | After each Sage response | inline | 2 | — |
| `practice_between_q` | Between practice questions | single | 1 | — |
| `practice_session_end` | After practice session ends | stack | 3 | — |
| `learn_topic_intro` | Before topic starts | stack | 2 | — |
| `learn_topic_complete` | After topic completed | stack | 3 | — |
| `daily_brief_card` | Daily brief widget | single | 1 | — |
| `exam_sim_pre` | Before mock exam | stack | 2 | — |
| `exam_sim_post` | After mock exam results | stack | 3 | — |
| `revision_card` | Inside revision schedule | carousel | 5 | — |
| `blog_sidebar` | Blog page right column | stack | 3 | — |
| `blog_post_bottom` | Below blog article | grid | 2 | — |
| `leaderboard_personal` | Personal leaderboard summary | stack | 2 | — |
| `notification_push` | WhatsApp/push notification | single | 1 | — |
| `course_material_cta` | Learn page CTA | single | 1 | — |

### All 18 ContentModules

| ContentModule | Description | Typical Layer |
|--------------|-------------|---------------|
| `visual_concept_card` | VisualConceptCard component with topic visual | personalized |
| `spaced_repetition` | SR card due today (SM-2 algorithm) | mandatory |
| `readiness_score` | Readiness gauge (0-100) | personalized |
| `mood_checkin` | Mood capture widget | personalized |
| `daily_brief` | Today's study brief | mandatory |
| `xp_bar` | Gamification XP + level bar | personalized |
| `streak_motivation` | Streak protection card | personalized |
| `exam_countdown` | Days-to-exam countdown | mandatory |
| `topic_recommendation` | Next best topic to study | personalized |
| `pyq_spotlight` | One PYQ to try right now | mandatory |
| `cohort_benchmark` | How student compares to cohort | personalized |
| `weakness_alert` | Topic flagged as weak area | mandatory |
| `celebration` | Win moment card | personalized |
| `nudge_card` | Mentor nudge message | personalized |
| `concept_bite` | 2-minute micro-concept | mandatory |
| `formula_flash` | Formula to remember now | mandatory |
| `practice_cta` | CTA to start a practice session | personalized |
| `empty_state_guide` | First-time onboarding guide | personalized |

### 9 Resolution Scenarios

Resolution is **priority-ordered** — the first matching scenario wins:

| Priority | Scenario | Trigger Condition | Modules Resolved |
|----------|----------|-------------------|-----------------|
| 1 | **Exam Day** | `daysToExam <= 1` | formula_flash → pyq_spotlight → readiness_score |
| 2 | **Overloaded / Stressed** | `cognitiveLoad === 'overloaded'` or mood = stressed/frustrated | concept_bite → streak_motivation → (SR if due) |
| 3 | **First Session** | `isFirstSession === true` | empty_state_guide → mood_checkin → exam_countdown |
| 4 | **Post High Score** | `recentScore >= 80` | celebration → cohort_benchmark → topic_recommendation → (SR if due) |
| 5 | **Post Low Score** | `recentScore < 40` | weakness_alert → concept_bite → nudge_card → (SR if due) |
| 6 | **SR Due** | `hasSRCardsDue === true` | spaced_repetition (injected into any scenario) |
| 7 | **Morning + Streak** | `timeOfDay === 'morning' && streakDays > 0` | streak_motivation |
| 8 | **Exam Soon (2-7 days)** | `daysToExam >= 2 && daysToExam <= 7` | exam_countdown → daily_brief → formula_flash → readiness_score |
| 9 | **Standard / Baseline** | Fallback (none of above matched) | visual_concept_card → topic_recommendation → xp_bar → (mood_checkin if not today) |

**Mandatory-first injection** (always runs after scenario resolution):
- For slots `dashboard_hero`, `learn_topic_intro`, `chat_pre_session`, `practice_between_q`, `dashboard_sidebar`
- If topic is set AND no mandatory module is already in the stack → `formula_flash` (layer: mandatory) is prepended at priority 0

---

## ContentLayerService Orchestration Flow

```
getLayeredContent(examId, topicId, personaCtx, surface, userPlan?)
│
├── Step 0: Load Course Playbook (non-blocking)
│         playbook context enriches personalization
│
├── Step 1: getMandatoryLayer(examId, topicId)
│         → mandatory ContentAtom[]
│         source: static library → cached → generated
│
├── Step 2: queueMissingMandatory(examId, topicId) [fire & forget]
│         background task — queues gaps for Atlas
│
├── Step 3: Check personalization budget
│         getContentBudget() → remaining personalization tokens
│
├── Step 4 (if budget > 0): buildPersonalizedLayer(personaCtx)
│         → personalized ContentAtom[]
│         → consumeContentBudget('personalized', 1)
│
├── Step 5: Return LayeredContent {
│           mandatory: [...],           // always present
│           personalized: [...],        // present if budget available
│           mandatoryCompleteness: 0-100,
│           personalizationDepth: full|partial|default,
│           generationTrace: { ... }    // for CEO debugging
│         }
│
└── Step 6 (post-return): updateFromAtlasGeneration() if atoms generated
```

---

## How Layers Connect to Sage

Sage receives a `buildBibleAwareDirective()` (now `buildPlaybookAwareDirective`) at session start that includes:

```ts
{
  mandatoryDelivered: string[];  // atom types already shown to student this session
  playbookContext: {
    definition: string;
    highYieldFormulas: string[];
    examSpecificTips: string;
    socraticQuestions: string[];
    commonMisconceptions: string[];
  }
}
```

The `mandatoryDelivered[]` array tells Sage which mandatory atoms the student has already seen. Sage then **skips re-explaining** those atoms and builds on top of them with Socratic depth, rather than repeating content.

Example: if `mandatoryDelivered = ['concept_core', 'formula_card']`, Sage's opening message references the formula card the student just saw and launches directly into a worked example or Socratic probe.

---

## GenerationLayer Throughout Pipeline

All generation services were updated in commit `88b5adb` to be layer-aware. Every function that calls an LLM now receives a `GenerationLayer` parameter:

```ts
type GenerationLayer = 'mandatory' | 'personalized';
```

| File Updated | What Changed |
|-------------|-------------|
| `contentGenerationService.ts` | `generateContent(topic, layer)` — layer-aware prompts |
| `contentGenerationHub.ts` | `generateAllChannels(topic, layer)` — mandatory = factual tone |
| `masterContentAgent.ts` | Batch orchestrator — mandatory jobs queued first |
| `batchContentService.ts` | `processBatch()` — mandatory items sorted to front |
| `contentAutomationService.ts` | Scoring: mandatory gaps × 3× boost |
| `wolframService.ts` | Arbitration: mandatory math → Wolfram; personalized → LLM |
| `staticContentLibrary.ts` | PYQ arbitration: mandatory PYQs → static only (never hallucinated) |
| `sagePersonaPrompts.ts` | `buildLayerPrefix()` — system prompt framing per layer |
| `contentFeedbackService.ts` | Feedback tagged with layer for analytics |

**Layer-aware prompt framing (buildLayerPrefix):**

| Layer | Injected System Prompt Prefix |
|-------|------------------------------|
| `mandatory` | "You are generating foundational course content. Prioritize accuracy and completeness over style. This content must be correct for every student." |
| `personalized` | "You are generating personalized content for a student with the following profile: [persona]. Adapt style, depth, and format to match their learning preferences." |

---

## New Files Added

| File | Size | Purpose |
|------|------|---------|
| `services/contentSlotService.ts` | ~550 lines | Slot resolution engine |
| `services/mandatoryContentService.ts` | ~600 lines | Mandatory baseline engine + coverage map |
| `services/contentLayerService.ts` | ~250 lines | Two-layer orchestrator |
| `components/ContentSlot.tsx` | ~200 lines | Universal drop-in renderer |
| `components/PersonalizedFeed.tsx` | ~180 lines | Adaptive infinite-scroll feed |
| `pages/ContentPersonalizationControl.tsx` | ~300 lines | CEO control panel at `/content-personalization` |

---

## localStorage Keys

| Key Pattern | Purpose |
|------------|---------|
| `eg_mandatory_content_{EXAMID}_{topicId}` | MandatoryContentSpec (completeness, flags) |
| `eg_mandatory_generated_{EXAMID}_{topicId}` | Generated mandatory ContentAtom[] |
| `eg_mandatory_queue` | MandatoryGenerationQueue[] pending jobs |

---

*EduGenius v2.0 — mathconcepts1 · Implemented 2026-03-13*
