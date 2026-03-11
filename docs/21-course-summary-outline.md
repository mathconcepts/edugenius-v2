# Course Summary Outline

> **Added:** 2026-03-11 (commit `b439560`)  
> **Source files:** `services/courseOrchestrator.ts`, `pages/CourseOrchestrator.tsx`  
> **Route:** `/course-orchestrator` → **Course Summary** tab (CEO only)  
> **See also:** `07-workflows.md`, `02-agent-architecture.md`

---

## Overview

The Course Summary Outline is a **pre-approval hierarchical preview** of everything the orchestrator will generate and deliver for a given exam. The CEO sees the full structure — every module, topic, and lesson — **before Atlas runs a single generation job**.

This prevents runaway content generation and gives the CEO full control over scope, difficulty, and delivery agent assignments.

---

## User Flow

```
1. CEO opens /course-orchestrator → Course Summary tab
2. Selects exam (GATE_EM / JEE / NEET / CAT / CBSE_12)
3. Sets "Days to Exam" slider
4. Clicks → Generate Outline
5. Reviews the 3-level hierarchy
6. Toggles modules/topics/lessons ON or OFF
7. Edits any lesson (title, rationale, difficulty, time)
8. Clicks → Approve & Queue Atlas
9. Atlas generation begins (status: 'generating' → 'complete')
```

At any point, the outline can be regenerated or re-approved. All changes are tracked in the change log.

---

## Data Model

```typescript
CourseSummaryOutline          // top-level container
  ├── id                      // unique outline id
  ├── examId                  // e.g. 'GATE_EM'
  ├── examName                // display name
  ├── generatedAt             // ISO timestamp
  ├── approvedAt?             // set on approval
  ├── approvedBy?             // 'CEO' (default)
  ├── status                  // 'draft' | 'approved' | 'generating' | 'complete'
  ├── totalModules            // count of included modules
  ├── totalTopics             // count of included topics
  ├── totalLessons            // count of included lessons
  ├── estimatedHours          // sum of included lesson minutes / 60
  ├── modules[]               // OutlineModule[]
  └── changeLog[]             // { ts, change }[]

OutlineModule                 // one per exam phase
  ├── id
  ├── title                   // e.g. "🏗️ Foundation — Core Concepts"
  ├── phase                   // ExamPhase
  ├── description
  ├── totalMinutes
  ├── topics[]                // OutlineTopic[]
  └── status                  // 'included' | 'excluded' | 'pending'

OutlineTopic                  // one per topic in the exam catalogue
  ├── id
  ├── topicId                 // e.g. 'linear_algebra'
  ├── topicName               // e.g. 'Linear Algebra'
  ├── phase
  ├── totalMinutes
  ├── lessons[]               // OutlineLesson[]
  └── status

OutlineLesson                 // one atomic learning unit
  ├── id
  ├── title                   // e.g. "Introduction to Linear Algebra"
  ├── objectiveType           // LearningObjectiveType
  ├── format                  // ContentDecision['format']
  ├── mode                    // ContentMode
  ├── difficulty              // 'easy' | 'medium' | 'hard'
  ├── estimatedMinutes
  ├── agentId                 // 'sage' | 'atlas' | 'mentor' | 'oracle'
  ├── status                  // 'included' | 'excluded' | 'pending'
  ├── rationale               // why this lesson was chosen
  └── prerequisites[]         // lesson ids that must precede this one
```

---

## Phase → Lesson Type Mapping

Lesson types generated depend on the exam phase, calculated from `daysToExam`:

| Phase | Lessons Generated |
|-------|-------------------|
| `discovery` / `foundation` | Introduction (Sage) + Worked Examples (Sage, Wolfram-verified) |
| `structured` / `intensive` | Misconception Fix (Sage) + MCQ Drill (Atlas, PYQ) + Exam Pattern (Atlas, PYQ) |
| `sprint` / `exam_week` | Formula Sheet (Atlas) + Readiness Check (Atlas, PYQ) |
| `post_exam` | Cross-Connections (Sage, LLM-generated concept map) |

Multiple phases are included when `daysToExam` is large enough to span them. For example, 90 days generates `foundation + structured + intensive + sprint` modules.

---

## Exam Topic Catalogues (seeded)

| Exam | Topics |
|------|--------|
| GATE_EM | Linear Algebra, Calculus, Probability, Complex Numbers, Signals & Systems, Numerical Methods, Transform Theory, Differential Equations |
| JEE | Mechanics, Thermodynamics, Electromagnetism, Organic Chemistry, Inorganic Chemistry, Calculus, Algebra, Coordinate Geometry, Optics |
| NEET | Cell Biology, Genetics, Plant Physiology, Human Physiology, Organic Chemistry, Biomolecules, Mechanics |
| CAT | Arithmetic, Algebra, Geometry, Reading Comprehension, Verbal Ability, Data Interpretation & LR |
| CBSE_12 | Calculus, Vectors & 3D, Probability, Electrostatics, Magnetism, Organic Chemistry |

Custom topic subsets can be passed via `customTopicIds[]` to `generateCourseSummary()`.

---

## Service API

```typescript
// Generate a full outline
generateCourseSummary(
  examId: string,
  daysToExam: number,
  customTopicIds?: string[],   // optional: restrict to these topics
): CourseSummaryOutline

// Toggle include/exclude at module / topic / lesson level (cascades down)
toggleOutlineNode(
  outline: CourseSummaryOutline,
  nodeId: string,
  level: 'module' | 'topic' | 'lesson',
  nextStatus: OutlineNodeStatus,
): CourseSummaryOutline          // returns updated outline (immutable)

// Edit a lesson's metadata
editOutlineLesson(
  outline: CourseSummaryOutline,
  lessonId: string,
  patch: Partial<Pick<OutlineLesson, 'title' | 'rationale' | 'difficulty' | 'estimatedMinutes' | 'format'>>,
): CourseSummaryOutline

// Approve — records approver + timestamp, sets status to 'approved'
approveOutline(
  outline: CourseSummaryOutline,
  approvedBy?: string,           // default: 'CEO'
): CourseSummaryOutline

// Persistence (localStorage)
saveOutlineToStorage(outline: CourseSummaryOutline): void
loadOutlineFromStorage(): CourseSummaryOutline | null
```

---

## UI Components

| Component | Description |
|-----------|-------------|
| `CourseSummaryTab` | Main tab: generator bar + summary header + outline tree |
| `ModuleBlock` | Collapsible module with toggle + topic list |
| `TopicSection` | Collapsible topic with toggle + lesson list |
| `LessonRow` | Single lesson with toggle + hover-reveal edit button |
| `EditLessonModal` | Modal for editing title/rationale/difficulty/minutes |

---

## Change Log Tracking

Every mutation appends an entry to `outline.changeLog[]`:

```json
{ "ts": "2026-03-11T09:15:00Z", "change": "Outline generated — awaiting approval." }
{ "ts": "2026-03-11T09:17:30Z", "change": "Module \"🎯 Exam Week — Final Polish\" → excluded" }
{ "ts": "2026-03-11T09:18:00Z", "change": "Lesson \"Readiness Check\" edited — difficulty: medium" }
{ "ts": "2026-03-11T09:20:00Z", "change": "✅ Approved by CEO — Atlas generation queued." }
```

The change log is visible via the **Change Log** button in the UI and is included in the persisted outline.

---

## Persistence

The outline is auto-saved to `localStorage` under `edugenius_course_outline` after every toggle or edit. On page reload, `loadOutlineFromStorage()` restores the last outline — no re-generation needed.

---

## Atlas Integration

On approval:
1. `outline.status` → `'approved'`
2. `outline.approvedAt` and `outline.approvedBy` are recorded
3. A `CONTENT_READY` (or equivalent Atlas generation) signal is queued via `emitContentReady()` for each included topic
4. Atlas processes the queue, generates content, and emits `CONTENT_PUBLISHED` → Oracle when done

> **Note (2026-03-11):** The Atlas signal dispatch on approval is hooked into the signal bus. The `prism_analysis` workflow may also feed back content priority signals to modify the Atlas queue if funnel insights indicate certain topics or formats convert better.
