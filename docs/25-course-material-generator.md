# 25 — Course Material Generator

> **EduGenius v2.0 — Playbook-Driven Course Material Generation**  
> Implemented: 2026-03-13  
> Commit: `e1bb7cb`  
> File: `frontend/src/services/courseMaterialGenerator.ts` (1,228 lines)  
> Status: Production-ready (0 TS errors, build ✓)

---

## Overview

The Course Material Generator produces fully-assembled, publication-ready `CourseMaterial` objects by reading from Course Playbooks. It supports 8 pre-defined templates plus free-form custom requests parsed by an NLP engine.

**Key design principle:** mandatory content (Layer 1) is assembled first, personalized sections (Layer 2) are appended after. Every section is traceable to its playbook source field.

```
generateCourseMaterial(template, config) →
  1. Merge template defaults + user config + custom request overrides
  2. Load Course Playbooks for each subtopicId
  3. Assemble mandatory sections first (concept, formula, example, PYQ, mistakes, tips)
  4. Append personalized sections (analogy, socratic, exercise, teacher/parent note)
  5. Apply focusAreas ordering + avoidTopics filtering
  6. Record generation event back to playbook
  7. Return CourseMaterial { sections, personalizationVariables, generationTrace, ... }
```

---

## 8 Course Templates

| Template Key | Display Name | Description | Best Use Case | Est. Time |
|-------------|-------------|-------------|--------------|-----------|
| `exam_cracker` | Exam Cracker | PYQs + trap topics + formula flash + exam tips; no analogies | Last 2-4 weeks before exam | 30 min |
| `concept_builder` | Concept Builder | Concept → formulas → worked examples → analogies → exercises → Socratic | Learning a new topic from scratch | 60 min |
| `quick_revision` | Quick Revision | Compact: formula + PYQ + tip + mistake | 10-minute refresh before class or exam | 10 min |
| `visual_deep_dive` | Visual Deep Dive | Analogies + ASCII diagrams + visual explanations; minimal PYQs | Visual learners; building intuition | 30 min |
| `socratic_journey` | Socratic Journey | Question → probe → reveal → analogy; Sage-style dialogue | Students who learn by thinking, not reading | 45 min |
| `topper_strategy` | Topper Strategy | Edge cases + hard PYQs + advanced applications; Socratic depth | Advanced students, rank improvement | 60 min |
| `parent_brief` | Parent Brief | Plain-English, no formulas, all analogies; parent_note sections | Parents wanting to understand what their child is studying | 10 min |
| `teacher_kit` | Teacher Kit | Lesson plan + Socratic questions + classroom exercises + teacher_notes | Teachers designing a class session | 60 min |
| `custom` | Custom Guide | All section types enabled; shaped entirely by `customRequest` text | Free-form user request | varies |

### Template Section Types Included

| Template | concept | formula | example | pyq | analogy | socratic | mistake | exam_tip | summary | exercise | teacher_note | parent_note |
|----------|---------|---------|---------|-----|---------|---------|---------|---------|---------|---------|------------|------------|
| exam_cracker | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| concept_builder | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| quick_revision | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| visual_deep_dive | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| socratic_journey | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| topper_strategy | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| parent_brief | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| teacher_kit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
| custom | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |

### Section Time Estimates

| Section Type | Est. Minutes | Layer |
|-------------|-------------|-------|
| concept | 5 | mandatory |
| formula | 2 | mandatory |
| example | 4 | mandatory |
| pyq | 3 | mandatory |
| misconception | 2 | mandatory |
| exam_tip | 2 | mandatory |
| summary | 2 | mandatory |
| analogy | 3 | personalized |
| socratic | 4 | personalized |
| exercise | 5 | personalized |
| teacher_note | 3 | personalized |
| parent_note | 2 | personalized |

---

## All 34 Personalization Variables

Across 5 dimensions:

| # | Variable | Source | Playbook Field | Agent | Feature |
|---|----------|--------|---------------|-------|---------|
| 1 | `learningStyle` | studentPersonaEngine → playbook aggregate | `studentPreferences.preferredLearningStyles` | Sage | visual/analytical/story_driven/practice_first/auditory/unknown |
| 2 | `cognitiveTier` | courseOrchestrator.buildLearnerProfile | — | Oracle | foundational/developing/proficient/advanced |
| 3 | `cognitiveLoad` | buildLearnerProfile | — | Oracle/Mentor | low/medium/high/overloaded |
| 4 | `role` | auth profile | — | System | student/teacher/parent |
| 5 | `emotionalState` | persona.emotionalState | — | Mentor | stressed/confident/motivated/neutral |
| 6 | `streakDays` | persona.streakDays | — | Mentor | Motivational framing |
| 7 | `studyTimePattern` | persona | — | Oracle | morning/afternoon/evening |
| 8 | `examId` | user profile | — | System | GATE_EM/JEE/NEET/CAT/UPSC |
| 9 | `topicId` | current topic | — | System | linear_algebra/calculus/etc. |
| 10 | `subtopicIds[]` | UI selection or autoPersonalize | — | System | Which subtopics to cover |
| 11 | `daysToExam` | persona.daysToExam | — | System | Urgency framing + content depth |
| 12 | `topicMasteryPct` | persona.syllabusCompletion | — | Oracle | Difficulty level selection |
| 13 | `preferredFormat` | playbook → persona | `studentPreferences.preferredFormats` | Atlas | lesson_notes/cheatsheet/visual_diagram_text/worked_example/analogy_explainer |
| 14 | `sessionLengthMinutes` | playbook → persona | `studentPreferences.sessionLengthPreference` | Sage | 5/10/15/30/60 |
| 15 | `preferredDifficulty` | playbook → persona | `studentPreferences.preferredDifficulty` | Oracle | easy/medium/hard/mixed |
| 16 | `includeAnalogies` | persona.prefersAnalogies | — | Atlas | boolean |
| 17 | `includeSocraticQuestions` | template config | — | Sage | boolean |
| 18 | `includePYQs` | template / user | — | Oracle | boolean |
| 19 | `includeFormulas` | template / user | — | Atlas | boolean |
| 20 | `includeCommonMistakes` | template config | — | Atlas | boolean |
| 21 | `includeExamTips` | template config | — | Oracle | boolean |
| 22 | `focusAreas[]` | user request / parseCustomRequest | — | System | Subtopics to front-load |
| 23 | `avoidTopics[]` | user request | — | System | Subtopics to skip |
| 24 | `customRequest` | free-form text | — | System | NLP-parsed to any variable |
| 25 | `preferredLearningStyles` (aggregate) | playbook | `studentPreferences.preferredLearningStyles` | Sage | Aggregate of what worked |
| 26 | `sessionLengthPreference` (aggregate) | playbook | `studentPreferences.sessionLengthPreference` | Sage | Most common session pref |
| 27 | `preferredDifficultyPref` (aggregate) | playbook | `studentPreferences.preferredDifficulty` | Oracle | Aggregate difficulty pref |
| 28 | `bestTemplateKey` | playbook | `promptIntelligence.bestTemplateKey` | Atlas/Sage | Which Sage template worked best |
| 29 | `commonStuckPoints[]` | playbook | `analytics.commonStuckPoints` | Oracle | Used in exercise hints |
| 30 | `effectiveAnalogies[]` | playbook | `pedagogy.effectiveAnalogies` | Atlas | Pre-validated analogies to use |
| 31 | `socraticQuestions[]` | playbook | `pedagogy.socraticQuestions` | Sage | Pre-validated Socratic prompts |
| 32 | `scaffoldingStrategies[]` | playbook | `pedagogy.scaffoldingStrategies` | Sage | Teaching approach |
| 33 | `checkpointQuestions[]` | playbook | `pedagogy.checkpointQuestions` | Sage | In-section exercises |
| 34 | `template` | UI selection | — | System | Which of 8 templates |

---

## Free-Form Request Parsing

`parseCustomRequest(request: string)` converts natural language into `PersonalizationConfig` overrides:

| Input Example | Resolved Variables |
|--------------|-------------------|
| "Explain like a story" | `learningStyle=story_driven, includeAnalogies=true` |
| "Show me visually with diagrams" | `learningStyle=visual, includeAnalogies=true` |
| "Give me the derivation only" | `learningStyle=analytical, includeFormulas=true` |
| "Practice problems only" | `learningStyle=practice_first, includePYQs=true` |
| "Just talk me through it" | `learningStyle=auditory` |
| "5 min revision" | `sessionLengthMinutes=5, includeAnalogies=false, includeSocraticQuestions=false` |
| "Only PYQs / previous year" | `includePYQs=true, includeFormulas=false, includeAnalogies=false, includeSocraticQuestions=false, includeCommonMistakes=false` |
| "Show me the traps / common mistakes" | `includeExamTips=true, includeCommonMistakes=true, focusAreas=['trapTopics']` |
| "Just formulas" | `includeFormulas=true, includePYQs=false, includeAnalogies=false, includeSocraticQuestions=false` |
| "From scratch / beginner / zero" | `cognitiveTier=foundational, preferredDifficulty=easy, includeAnalogies=true` |
| "Advanced / topper / hard" | `cognitiveTier=advanced, preferredDifficulty=hard` |
| "Medium / intermediate" | `cognitiveTier=developing, preferredDifficulty=medium` |
| "For my teacher / lesson plan / pedagogy" | `role=teacher, includeSocraticQuestions=true, includeCommonMistakes=true` |
| "For my parent / mom / guardian" | `role=parent, includeAnalogies=true, includeFormulas=false, includePYQs=false` |
| "Easy / light / gentle" | `preferredDifficulty=easy` |
| "Hard / tough / difficult" | `preferredDifficulty=hard` |

Multiple patterns can match: `"5 min story-driven from scratch"` → `sessionLengthMinutes=5, learningStyle=story_driven, cognitiveTier=foundational, preferredDifficulty=easy, includeAnalogies=true`

---

## `generateCourseMaterial()` Flow

```
generateCourseMaterial(template, config) → CourseMaterial
│
├── Step 1: Merge configs
│   templateBase = TEMPLATE_CONFIGS[template]
│   mergedConfig = { ...templateBase, ...config }   // config wins over template defaults
│   if customRequest → parseCustomRequest() overrides applied last
│
├── Step 2: Apply avoidTopics filter
│   activeSubtopicIds = config.subtopicIds.filter(not in avoidTopics)
│
├── Step 3: Apply focusAreas ordering
│   orderedSubtopicIds = [focusAreas first, then rest]
│
├── Step 4: Load playbooks
│   for each subtopicId → getPlaybookOrCreate(examId, topicId, subtopicId)
│   avgHealth = average of getPlaybookCompleteness() across all playbooks
│
├── Step 5: Assemble sections (per subtopic, in order)
│   MANDATORY LAYER FIRST:
│     concept → formula → example → pyq → misconception → exam_tip → summary
│   PERSONALIZED LAYER AFTER:
│     analogy → socratic → exercise → teacher_note → parent_note
│   (filtered by TEMPLATE_SECTION_FILTERS[template])
│   (filtered by include* flags)
│   (capped by sessionLengthMinutes if short session)
│
├── Step 6: Compute metadata
│   estimatedTotalMinutes = sum of section.estimatedMinutes
│   personalizationSummary = "visual learner, advanced, T-14, quick revision"
│   mandatoryFulfilled[] = track which atom types were assembled
│   agentsInvolved[] = ['atlas'] + ['sage' if socratic] + ['oracle' if pyq] + ['mentor' if teacher]
│
├── Step 7: Build CourseMaterial object
│   { id, title, subtitle, template, sections[], playbooksRead[], personalizationVariables{} }
│
└── Step 8: recordCourseMaterialGeneration()  [non-blocking]
    → updateFromAtlasGeneration() for each mandatory section built
    → increments playbook.contentAtoms and agentConnections.atlas.contentCoverage
```

---

## `autoPersonalize()` — What it Reads and How

`autoPersonalize(examId, topicId, subtopicIds[])` reads live state to build a fully-resolved `PersonalizationConfig` without any user input:

```
1. loadPersona()                → studentPersonaEngine
   Reads: learningStyle, tier, emotionalState, streakDays, daysToExam,
          syllabusCompletion, prefersAnalogies

2. buildLearnerProfile()        → courseOrchestrator
   Reads: cognitiveLoad, role

3. getPlaybookOrCreate()        → coursePlaybookService (first subtopic)
   Reads: studentPreferences.sessionLengthPreference
          studentPreferences.preferredDifficulty
          studentPreferences.preferredLearningStyles (aggregate → top style)

4. Reconcile and return PersonalizationConfig {
     learningStyle: playbook aggregate style OR persona style
     cognitiveTier: from persona tier map
     cognitiveLoad: from courseOrchestrator
     role: from courseOrchestrator
     daysToExam: from persona
     sessionLengthMinutes: from playbook preference
     preferredDifficulty: from playbook preference
     includeAnalogies: from persona.prefersAnalogies
     includeSocraticQuestions: true (always)
     ... all include* flags = true as defaults
   }
```

---

## CourseMaterialStudio: CEO Mode + Student Mode

The `CourseMaterialStudio.tsx` page at `/course-material-studio` serves two audiences.

### CEO / Admin Mode

Accessed via the CEO sidebar. Full access to all controls.

**Left Panel:**
- Template selector (8 template cards with description + estimated time)
- Exam picker (GATE_EM / JEE / NEET / CAT / UPSC)
- Topic picker (filtered by exam from MANDATORY_COVERAGE_MAP)
- Subtopic multi-select (all subtopics for selected topic)

**Personalization Accordion (6 groups):**
1. **Learner Identity** — learning style, cognitive tier, cognitive load, role
2. **Exam Context** — days to exam, topic mastery %
3. **Content Preferences** — session length, difficulty, format
4. **Content Toggles** — include/exclude analogies, PYQs, formulas, Socratic, mistakes, tips
5. **Focus & Avoidance** — add subtopics to focus list or skip list
6. **Custom Request** — free-form text input with parseCustomRequest preview

**Auto-Personalize button** — fills all fields using `autoPersonalize()` from live state.

**Playbook Health bar** — shows average completeness of selected subtopics' playbooks.

**Generate button** → calls `generateCourseMaterial()` → displays result.

**Output panel:**
- Material title + subtitle
- Estimated total minutes + section count
- Personalization summary badge
- Sections rendered by type with layer indicator (mandatory / personalized)
- Save to library button (saves to `eg_course_library` localStorage)
- Ask Sage button (passes material to `buildCourseMaterialPrompt()`)

### Student Mode

Accessed from the Learn page. Simplified interface.

- Search bar with `parseCustomRequest` live preview
- 3 recommended templates based on `daysToExam` and `cognitiveLoad`
  - T-7 days → exam_cracker + quick_revision
  - T-30+ days → concept_builder + socratic_journey
  - overloaded → quick_revision + visual_deep_dive
- One-tap generate (calls `autoPersonalize()` then `generateCourseMaterial()`)
- Ask Sage CTA — takes generated material into Sage chat session

---

## Sage Integration: `buildCourseMaterialPrompt()`

When a student clicks "Ask Sage" on a generated course material:

```
buildCourseMaterialPrompt(material: CourseMaterial) →
  system prompt injecting:
  - template used + subtopics covered
  - mandatory sections assembled (Sage won't re-explain these)
  - personalization summary (Sage adapts tone and depth accordingly)
  - high-yield formulas from playbook
  - socratic questions from playbook (Sage uses these as probes)
  - common misconceptions (Sage watches for and corrects these)

Sage then:
  - Teaches from the assembled material as its "Bible"
  - Skips concepts already covered in mandatory sections
  - Adapts style to learningStyle in personalizationVariables
  - Uses pre-validated socraticQuestions from playbook
```

---

## CourseOrchestrator: 6th Tab

The CourseOrchestrator page (`/course-orchestrator`) has a new **6th tab: "Course Studio"** added in commit `e1bb7cb`.

| Tab | Purpose |
|-----|---------|
| 1. Overview | System-wide orchestration status |
| 2. Learner Profile | Live student cognitive profile |
| 3. Content Queue | Pending content generation jobs |
| 4. Batch Jobs | Batch content generation controls |
| 5. Analytics | Oracle analytics integration |
| **6. Course Studio** | **Direct access to CourseMaterialStudio — pick template, select subtopics, generate** |

The 6th tab embeds the full CourseMaterialStudio in CEO mode, providing a single-window view of the entire content intelligence stack alongside course material generation.

---

## Output Object: `CourseMaterial`

```ts
interface CourseMaterial {
  id: string;                              // 'cm_{template}_{examId}_{timestamp}'
  title: string;                           // 'Exam Cracker: Eigenvalues and Eigenvectors'
  subtitle: string;                        // 'GATE_EM | 2 subtopics | 28 min'
  template: CourseTemplate;
  examId: string;
  subtopicsCovered: string[];             // subtopicIds included
  estimatedTotalMinutes: number;
  personalizationSummary: string;          // 'visual learner, advanced, T-14'
  sections: CourseSection[];              // ordered mandatory-first

  // Traceability
  playbooksRead: string[];                // playbook IDs consulted
  personalizationVariables: Record<string, string>; // all 34 vars resolved
  agentsInvolved: string[];              // ['atlas', 'sage', 'oracle']
  generationTrace: {
    templateUsed: string;
    templateKeyResolved?: string;          // from promptIntelligence.bestTemplateKey
    mandatoryAtomsFulfilled: string[];     // e.g. ['concept:eigenvalues_eigenvectors', 'formula:eigenvalues_eigenvectors']
    personalizedSectionsAdded: number;
    playbookHealthAtGeneration: number;    // avg health score at time of generation
  };

  generatedAt: string;                   // ISO timestamp
  version: number;                       // 1 (future: versioned edits)
}
```

Each `CourseSection`:
```ts
interface CourseSection {
  id: string;
  type: CourseSectionType;
  title: string;
  content: string;                        // markdown content
  playbookSource: string;                 // 'academic.definition + pedagogy.teachingSequence'
  personalizationApplied: string[];      // variables that shaped this section
  estimatedMinutes: number;
  layer: 'mandatory' | 'personalized';
  subtopicId: string;
}
```

---

## localStorage Keys

| Key | Type | Description |
|-----|------|-------------|
| `eg_course_library` | `CourseMaterial[]` (JSON) | All generated materials saved by user |

---

*EduGenius v2.0 — mathconcepts1 · Implemented 2026-03-13*
