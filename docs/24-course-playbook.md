# 24 — Course Playbook

> **EduGenius v2.0 — Universal Knowledge Graph for Every Subtopic**  
> Implemented: 2026-03-13  
> Commits: `cd99890` (initial) · `6af8d66` (rename SubTopic Bible → Course Playbook)  
> File: `frontend/src/services/coursePlaybookService.ts` (1,235 lines)  
> Status: Production-ready · localStorage-backed · Supabase-ready

---

## What it is and why

The **Course Playbook** is the single source of truth for every course subtopic in EduGenius. It is a rich knowledge graph — one document per `(examId, topicId, subtopicId)` triplet — that stores:

- Academic foundation (definition, prerequisites, Bloom's level, mastery hours)
- Teaching intelligence (Socratic questions, analogies, misconceptions, scaffolding strategies)
- Exam intelligence (weightage, PYQs with explanations, trap topics, high-yield formulas)
- Live student analytics (mastery scores, stuck points, engagement trends)
- Student preferences (preferred styles, formats, session length)
- Search intelligence (trending queries, content gaps)
- Agent connections (what each agent last did and when)
- Prompt intelligence (which prompts worked, which failed)
- Knowledge graph (incoming/outgoing links, cross-exam relevance)
- Update history (audit trail of every change)

**Before the Playbook:** each agent held fragmented knowledge about each topic. Atlas knew formulas; Sage knew what questions worked; Oracle knew mastery rates. None of it was shared.

**After the Playbook:** every agent reads the same source. Atlas enriches it. Sage teaches from it. Oracle writes analytics to it. Scout writes search data to it. Mentor records nudge effectiveness. Herald records published content performance. The playbook grows smarter with every student interaction.

---

## Full Schema

### Identity Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | `'{examId}__{topicId}__{subtopicId}'` |
| `examId` | `string` | `'GATE_EM' \| 'JEE' \| 'NEET' \| 'CAT' \| 'UPSC'` |
| `topicId` | `string` | Parent topic key: `'linear_algebra'`, `'calculus'`, etc. |
| `subtopicId` | `string` | Leaf node: `'eigenvalues_eigenvectors'`, `'differentiation'`, etc. |
| `subtopicName` | `string` | Human-readable: `'Eigenvalues and Eigenvectors'` |
| `version` | `number` | Increments on every update |
| `lastUpdatedAt` | `string` | ISO timestamp |
| `lastUpdatedBy` | `string` | Agent name, `'system'`, or `'student_interaction'` |

---

### Section 1: `academic`

Core educational metadata for the subtopic.

| Field | Type | Description |
|-------|------|-------------|
| `definition` | `string` | Authoritative explanation of the concept |
| `prerequisites` | `string[]` | Subtopic IDs that must be known first |
| `postrequisites` | `string[]` | Subtopics that build on this one |
| `difficulty` | `'foundational' \| 'intermediate' \| 'advanced' \| 'expert'` | Calibrated difficulty level |
| `estimatedMasteryHours` | `number` | Average hours to reach mastery |
| `bloomsLevel` | `'remember' \| 'understand' \| 'apply' \| 'analyze' \| 'evaluate' \| 'create'` | Bloom's taxonomy classification |
| `conceptualDependencies` | `string[]` | Abstract concepts required (not just subtopics) |
| `realWorldApplications` | `string[]` | Real engineering/science applications |
| `crossSubjectConnections` | `string[]` | Connections to other subjects (e.g. quantum mechanics) |

---

### Section 2: `pedagogy`

Teaching intelligence for Sage and Atlas.

| Field | Type | Description |
|-------|------|-------------|
| `teachingSequence` | `string[]` | Ordered steps for introducing the topic |
| `commonMisconceptions` | `{ misconception, correction, frequency }[]` | Top mistakes with corrections; frequency = very_common/common/occasional |
| `effectiveAnalogies` | `{ analogy, worksFor[], examId? }[]` | Validated analogies and which student profiles they work for |
| `scaffoldingStrategies` | `string[]` | How to build up from simpler concepts |
| `accelerationStrategies` | `string[]` | How to fast-track advanced learners |
| `socraticQuestions` | `string[]` | Pre-validated Socratic probes for Sage |
| `checkpointQuestions` | `string[]` | Self-assessment questions mid-topic |
| `teacherNotes` | `string` | Notes for teacher_kit template |
| `parentExplanation` | `string` | Plain-English version for parent_brief template |

---

### Section 3: `examIntelligence`

Exam-specific intelligence for all content generation.

| Field | Type | Description |
|-------|------|-------------|
| `weightage` | `number` | Average marks/% in exam papers |
| `averageQuestionsPerPaper` | `number` | Historical average |
| `difficultyCurve` | `'easy_heavy' \| 'balanced' \| 'hard_heavy'` | Distribution of question difficulty |
| `questionPatterns` | `{ pattern, frequency, example }[]` | Recurring question formats |
| `pyqs` | `{ year, question, answer, explanation, marks, difficulty, trap?, source }[]` | Past-year questions with full solutions |
| `trapTopics` | `string[]` | Sub-areas where students commonly lose marks |
| `highYieldFormulas` | `string[]` | Formulas to memorize for this exam |
| `examSpecificTips` | `string` | One-paragraph exam strategy |
| `yearwiseTrend` | `Record<string, number>` | Questions per year: `{ '2022': 2, '2023': 3, ... }` |

---

### Section 4: `contentAtoms`

Tracks which mandatory and personalized atoms have been generated.

| Field | Type | Description |
|-------|------|-------------|
| `mandatory` | `{ concept_core?, formula_card?, worked_example?, pyq_set?, common_mistakes?, exam_tips? }` | IDs of generated mandatory atoms |
| `personalized` | `Record<string, string>` | styleKey → atomId for personalized variants |
| `lastGeneratedAt` | `string` | ISO timestamp of last generation event |
| `generationVersion` | `number` | Increments on each Atlas generation |

---

### Section 5: `analytics`

Live student performance data written by Oracle.

| Field | Type | Description |
|-------|------|-------------|
| `totalStudentsTaught` | `number` | Count of unique students who studied this |
| `averageMasteryScore` | `number` | 0-100, aggregated across students |
| `averageSessionsToMastery` | `number` | How many sessions until mastery typically achieved |
| `commonStuckPoints` | `string[]` | Topics students most often get confused at |
| `averageTimeToComplete` | `number` | Minutes to complete the subtopic |
| `dropoffRate` | `number` | 0-1, % of students who abandoned mid-topic |
| `completionRate` | `number` | 0-1, % who finished |
| `feedbackSentiment` | `'positive' \| 'neutral' \| 'negative' \| 'mixed'` | Aggregated feedback sentiment |
| `engagementScore` | `number` | 0-100 composite engagement metric |
| `recentTrend` | `'improving' \| 'stable' \| 'declining'` | Recent trend direction |
| `lastAnalyticsUpdate` | `string` | ISO timestamp |

---

### Section 6: `studentPreferences`

Aggregated preferences across all students who studied this subtopic.

| Field | Type | Description |
|-------|------|-------------|
| `preferredLearningStyles` | `Record<string, number>` | Style → count: `{ visual: 12, analytical: 7 }` |
| `preferredFormats` | `Record<string, number>` | Format → count |
| `preferredDifficulty` | `'gradual' \| 'jump_in' \| 'mixed'` | Most common difficulty preference |
| `sessionLengthPreference` | `'short_5min' \| 'medium_15min' \| 'long_30min' \| 'varied'` | Most common session length |
| `bestTimeOfDay` | `'morning' \| 'afternoon' \| 'evening' \| 'night' \| 'no_preference'` | When most students study this topic |
| `moodDistribution` | `Record<string, number>` | Mood → count during study |
| `devicePreference` | `'mobile' \| 'desktop' \| 'mixed'` | Most common device |
| `lastPreferenceUpdate` | `string` | ISO timestamp |

---

### Section 7: `searchIntelligence`

Written by Scout; used by Atlas for content gap analysis.

| Field | Type | Description |
|-------|------|-------------|
| `topSearchQueries` | `string[]` | What students search for about this subtopic |
| `relatedSearchTerms` | `string[]` | Adjacent terms and synonyms |
| `externalSearchTrends` | `{ keyword, trend: 'rising'\|'stable'\|'falling', volume: 'high'\|'medium'\|'low' }[]` | External search signal data |
| `contentGaps` | `string[]` | Questions being searched with no good EduGenius content |
| `discoveryPath` | `string[]` | How students typically find this subtopic |
| `lastSearchUpdate` | `string` | ISO timestamp |

---

### Section 8: `agentConnections`

Tracks every agent's last interaction with this subtopic.

| Agent | Fields |
|-------|--------|
| `atlas` | `lastGenerated`, `contentCoverage` (0-100%), `nextGenerationScheduled?`, `generationPriority` |
| `sage` | `lastTaughtAt`, `totalSessions`, `avgSocraticDepth`, `effectivePromptIds[]` |
| `oracle` | `lastAnalyzed`, `masteryDistribution`, `alertLevel: green\|amber\|red` |
| `scout` | `lastResearched`, `competitorCoverage`, `marketPosition: leading\|parity\|gap` |
| `mentor` | `nudgesSent`, `nudgeEffectiveness`, `bestNudgeType` |
| `herald` | `contentPublished`, `lastPublishedAt`, `topPerformingContent` |

---

### Section 9: `promptIntelligence`

Tracks which prompts worked and which failed; powers `autoPersonalize()`.

| Field | Type | Description |
|-------|------|-------------|
| `effectiveSystemPrompts` | `{ promptId, style, objective, successRate, avgEngagement, usageCount }[]` | Top-10 prompts that drove engagement |
| `failedPromptPatterns` | `string[]` | Patterns to avoid in future prompts |
| `bestTemplateKey` | `string` | Key of best-performing CourseTemplate for this subtopic |
| `promptEvolutionLog` | `{ version, change, impact, date }[]` | Audit trail of prompt changes |

---

### Section 10: `knowledgeGraph`

Topological knowledge graph data for the subtopic.

| Field | Type | Description |
|-------|------|-------------|
| `incomingLinks` | `string[]` | Subtopic IDs that link to this one (dependency) |
| `outgoingLinks` | `string[]` | Subtopic IDs this one leads to |
| `clusterTag` | `string` | Topic cluster this belongs to (e.g. `'linear_algebra_core'`) |
| `difficultyPathways` | `{ easy: string[], hard: string[] }` | Simpler/harder alternative paths |
| `crossExamRelevance` | `Record<string, number>` | Relevance to other exams: `{ GATE_EM: 1.0, JEE: 0.7 }` |

---

### Section 11: `updateHistory`

Audit trail of the last 50 changes to the playbook.

Each entry: `{ field, oldValue, newValue, updatedBy, updatedAt, reason }`

---

## Agent Ownership Map

| Agent | Owns (writes) | Reads | Update Frequency |
|-------|--------------|-------|-----------------|
| **Atlas** | `contentAtoms`, `agentConnections.atlas` | `examIntelligence`, `pedagogy`, `academic` | Every content generation |
| **Sage** | `agentConnections.sage`, `promptIntelligence` | `pedagogy.socraticQuestions`, `examIntelligence.pyqs`, `contentAtoms.mandatory` | Every tutoring session |
| **Oracle** | `analytics`, `agentConnections.oracle` | `analytics.commonStuckPoints`, `agentConnections.oracle.alertLevel` | Every analytics pass (~30 min) |
| **Scout** | `searchIntelligence`, `agentConnections.scout` | `examIntelligence.yearwiseTrend` | Scout research cycle |
| **Mentor** | `agentConnections.mentor` | `analytics.engagementScore`, `studentPreferences` | After nudge events |
| **Herald** | `agentConnections.herald` | `searchIntelligence`, `examIntelligence` | After publishing content |
| **System** | `academic`, `pedagogy`, `examIntelligence` (seed) | — | Seed only (once) |
| **Student interaction** | `studentPreferences`, `analytics` (indirect) | — | Every session |

---

## Progressive Update Hooks

Every major system event triggers a playbook update. These are wired into the signal bus via `playbookProgressiveUpdater.ts` (599 lines, runs reconciliation every 30 minutes):

| Trigger | Handler | Playbook Fields Updated |
|---------|---------|------------------------|
| Atlas generates content atom | `updateFromAtlasGeneration()` | `contentAtoms`, `agentConnections.atlas.contentCoverage` |
| Sage completes tutoring session | `updateFromSageSession()` | `agentConnections.sage`, `promptIntelligence.effectiveSystemPrompts` |
| Oracle runs analytics pass | `updateFromOracleAnalytics()` | `analytics`, `agentConnections.oracle.alertLevel` |
| Scout researches keywords | `updateFromScoutResearch()` | `searchIntelligence`, `agentConnections.scout` |
| Mentor sends nudge (with result) | `updateFromMentorNudge()` | `agentConnections.mentor.nudgeEffectiveness`, `studentPreferences` |
| Herald publishes content | `updateFromHeraldPublish()` | `agentConnections.herald`, `analytics.engagementScore` |
| Student completes topic | Via Oracle analytics | `analytics.completionRate`, `studentPreferences.preferredLearningStyles` |
| Content feedback received | `contentFeedbackService` | `analytics.feedbackSentiment`, `promptIntelligence.failedPromptPatterns` |
| Knowledge Router resolves query | `knowledgeRouter` | `searchIntelligence.topSearchQueries` |
| Course Material generated | `recordCourseMaterialGeneration()` | `contentAtoms.mandatory`, `agentConnections.atlas` |

---

## CEO Page: `/course-playbook`

The `CoursePlaybookViewer.tsx` page (954 lines) provides full visibility into all playbooks.

### Tab 1: Playbook Browser

- **Exam filter** — GATE_EM / JEE / NEET / CAT / UPSC
- **Topic filter** — filtered by selected exam
- **Playbook cards** — each card shows:
  - Subtopic name + exam badge
  - Completeness bar (0-100%) — based on 20 measured fields
  - Oracle alert level (🟢/🟡/🔴)
  - Atlas coverage %
  - Sage session count
  - Last updated timestamp
- **Click any card** → expanded view with all 10 sections
- **Sections rendered:** academic info, pedagogy table, PYQ list with expand/collapse, agent status, content atoms inventory

### Tab 2: Playbook Health

- **Summary cards:** total playbooks seeded, avg completeness, playbooks with red/amber alerts, total PYQs stored
- **Health score** = `completeness × 0.6 + engagementScore × 0.4 − alertPenalty`
- **Trigger Enrichment button** — schedules Atlas generation for critical-priority playbooks
- **List of low-health playbooks** with direct enrichment actions

### Tab 3: Updates

- **Live update feed** — all recent playbook changes in reverse chronological order
- **Filter by agent** — see only Atlas / Sage / Oracle updates
- **Each entry:** timestamp, agent, playbook ID, fields changed

---

## localStorage Schema

| Key | Type | Description |
|-----|------|-------------|
| `eg_playbook_{examId}_{topicId}_{subtopicId}` | `CoursePlaybook` (JSON) | Full playbook object, keyed by lowercased IDs |
| `eg_playbook_index` | `string[]` (JSON) | All playbook IDs (`examId__topicId__subtopicId`) |
| `eg_playbook_seeded_v1` | `string` (ISO timestamp) | Guard flag — prevents double-seeding |

**Key example:** `eg_playbook_gate_em_linear_algebra_eigenvalues_eigenvectors`

**Index example:**
```json
[
  "GATE_EM__linear_algebra__eigenvalues_eigenvectors",
  "GATE_EM__linear_algebra__matrix_operations",
  "GATE_EM__calculus__differentiation"
]
```

---

## Supabase Migration Path

The service is Supabase-ready. When `VITE_SUPABASE_URL` is set:

1. `isSupabaseAvailable()` returns `true`
2. All `getPlaybook()` calls switch from `localStorage.getItem(...)` to `supabase.from('subtopic_playbooks').select(...)` 
3. All `savePlaybook()` calls switch to `supabase.from('subtopic_playbooks').upsert(...)`
4. Index is maintained via Supabase query (no separate `eg_playbook_index` key needed)
5. `seedDefaultPlaybooks()` seeds via `supabase.from('subtopic_playbooks').insert(...)`

**Expected Supabase table schema:**
```sql
CREATE TABLE subtopic_playbooks (
  id text PRIMARY KEY,          -- '{examId}__{topicId}__{subtopicId}'
  exam_id text NOT NULL,
  topic_id text NOT NULL,
  subtopic_id text NOT NULL,
  data jsonb NOT NULL,          -- full CoursePlaybook JSON
  version integer DEFAULT 1,
  last_updated_at timestamptz DEFAULT now(),
  last_updated_by text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX ON subtopic_playbooks(exam_id);
CREATE INDEX ON subtopic_playbooks(exam_id, topic_id);
```

---

## Seeded Subtopics (10 GATE EM)

### Linear Algebra (5 subtopics)

| SubtopicId | Name | Bloom's Level | Difficulty | Mastery Hours | Weightage |
|-----------|------|--------------|-----------|---------------|-----------|
| `eigenvalues_eigenvectors` | Eigenvalues and Eigenvectors | analyze | advanced | 4h | 8% |
| `matrix_operations` | Matrix Operations | apply | intermediate | 2h | 5% |
| `linear_transformations` | Linear Transformations | analyze | advanced | 3h | 4% |
| `vector_spaces` | Vector Spaces | understand | intermediate | 3h | 4% |
| `systems_of_equations` | Systems of Linear Equations | apply | intermediate | 2h | 5% |

### Calculus (5 subtopics)

| SubtopicId | Name | Bloom's Level | Difficulty | Mastery Hours | Weightage |
|-----------|------|--------------|-----------|---------------|-----------|
| `limits_continuity` | Limits and Continuity | understand | foundational | 2h | 4% |
| `differentiation` | Differentiation | apply | intermediate | 3h | 6% |
| `integration` | Integration | apply | intermediate | 4h | 6% |
| `series_sequences` | Series and Sequences | analyze | advanced | 3h | 4% |
| `multivariable_calculus` | Multivariable Calculus | analyze | expert | 5h | 7% |

Each seeded subtopic includes:
- Full `academic.definition` with GATE-specific notes
- `pedagogy.socraticQuestions` (3 per subtopic)
- `pedagogy.teachingSequence` (5 steps)
- `pedagogy.commonMisconceptions` (1+ with correction + frequency)
- `examIntelligence.highYieldFormulas` (3-5 formulas)
- `examIntelligence.examSpecificTips` (exam strategy)
- `examIntelligence.yearwiseTrend` (2019-2024)
- `examIntelligence.pyqs` (real PYQs where available)
- `promptIntelligence.bestTemplateKey`
- `knowledgeGraph.crossExamRelevance` (GATE_EM, JEE, CAT scores)

---

## API Reference

All exported functions from `coursePlaybookService.ts`:

### READ

```ts
// Get a playbook (null if not found)
getPlaybook(examId: string, topicId: string, subtopicId: string): CoursePlaybook | null

// Get or create (creates skeleton if not found)
getPlaybookOrCreate(examId, topicId, subtopicId, subtopicName?): CoursePlaybook

// Get all playbooks, optionally filtered
getAllPlaybooks(examId?: string, topicId?: string): CoursePlaybook[]

// Completeness score (0-100, based on 20 fields)
getPlaybookCompleteness(playbook: CoursePlaybook): number

// Health score = completeness × 0.6 + engagement × 0.4 − alertPenalty
getPlaybookHealthScore(playbook: CoursePlaybook): number
```

### WRITE

```ts
// Overwrite entire playbook
savePlaybook(playbook: CoursePlaybook): void

// Update a single top-level field
updatePlaybookField<K extends keyof CoursePlaybook>(id, field, value, updatedBy): void

// Deep-merge partial update
mergePlaybookUpdate(id, partial: Partial<CoursePlaybook>, updatedBy): void
```

### PROGRESSIVE UPDATES (called by agents)

```ts
// Atlas: after generating a content atom
updateFromAtlasGeneration(examId, topicId, subtopicId, atomType, atomId, layer, styleKey?): void

// Sage: after each tutoring session
updateFromSageSession(examId, topicId, subtopicId, sessionData: SageSessionUpdate): void

// Oracle: after analytics pass
updateFromOracleAnalytics(examId, topicId, subtopicId, analyticsUpdate: AnalyticsUpdate): void

// Scout: after keyword research
updateFromScoutResearch(examId, topicId, subtopicId, searchUpdate: SearchIntelligenceUpdate): void

// Mentor: after nudge outcome
updateFromMentorNudge(examId, topicId, subtopicId, nudgeResult: NudgeResult): void

// Herald: after publishing content
updateFromHeraldPublish(examId, topicId, subtopicId, heraldResult: HeraldContentResult): void
```

### ANALYTICS

```ts
// Get top subtopics by engagement score
getTopSubtopicsByEngagement(examId: string, limit: number): CoursePlaybook[]

// Get subtopics with red or amber Oracle alerts
getSubtopicsWithAlerts(): CoursePlaybook[]

// Check Supabase availability
isSupabaseAvailable(): boolean
```

### SEED

```ts
// Seed 10 GATE EM subtopics + skeleton for all mandatory coverage map entries
// Runs once (guards with localStorage flag 'eg_playbook_seeded_v1')
seedDefaultPlaybooks(): void

// Schedule a playbook for priority Atlas generation
schedulePlaybookGeneration(examId, topicId, subtopicId): void
```

---

*EduGenius v2.0 — mathconcepts1 · Implemented 2026-03-13*
