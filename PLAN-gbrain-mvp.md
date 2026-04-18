# PLAN: EduGenius → GBrain MVP Evolution

**Mode:** SCOPE EXPANSION — find the 10-star product
**Branch:** main
**Date:** 2026-04-18
**Reviewer:** /plan-ceo-review (gstack)

---

## The Gap: Where You Are vs. Where You Could Be

### Current Product (v0.3)
EduGenius today is a **practice app with smart ordering**. It serves static PYQ problems, verifies answers (well — 3-tier cascade is strong), and tells you which topic to study next via a 5-factor priority formula. The AI tutor answers questions with basic context modifiers (difficulty, exam proximity, weakness, time-of-day).

What it does NOT do:
- Diagnose **why** you got a problem wrong (just says right/wrong)
- Understand **how** you think about math (algebraic vs geometric, abstraction level)
- Track your **error patterns** over time (sign errors vs conceptual gaps vs rushing)
- Repair **prerequisites** automatically (struggles with integrals → needs limits work)
- Generate **new problems** calibrated to your exact gap (static PYQ bank only)
- Build a **personalized exam playbook** (attempt order, skip thresholds, time budgets)
- Separate **pedagogical reasoning** from **content generation** (one prompt does both)

### The 10-Star Product
> "EduGenius doesn't give you problems. It understands how you think, diagnoses why you fail, auto-repairs your foundations, generates infinite practice for your exact gaps, and hands you a personalized exam playbook that maximizes your score. Your only job is to show up."

This is what GBrain enables. Not a chatbot with a question bank — a **cognitive learning system** that compounds.

---

## System Audit Findings

```
Codebase:  ~60 backend files, 12 frontend pages, 10 DB migrations
Stack:     Express (raw http), Supabase (Postgres + pgvector), Gemini 2.5-flash
Deploy:    Render (auto from main), single service
State:     Pre-validation — no real users yet, Telegram distribution unproven
TODOs:     13 open, 3 critical (tier monitoring, freemium gate, validation criteria)
Tech debt: @ts-nocheck on most files, no E2E tests, no CI, frontend = zero tests
```

Key architectural observations:
1. **Priority engine is pure** — deterministic function, no side effects. Good foundation to extend.
2. **Verification cascade is the strongest subsystem** — well-architected, type-safe, extensible.
3. **AI tutor has 4 context modifiers** — difficulty, proximity, weakness, tired-student. This is the seed of the Student Model.
4. **No concept-level granularity** — everything operates at topic level (10 topics). The PDF proposes concept-level mastery across hundreds of nodes.
5. **Content is static** — PYQ bank in SQL seed file. No generation pipeline for practice problems.

---

## Architecture: The Four-Layer Cathedral

```
┌─────────────────────────────────────────────────┐
│                  STUDENT INPUT                    │
│    (typed question / answer / photo / "help me")  │
└──────────────────────┬──────────────────────────┘
                       │
           ┌───────────▼───────────┐
           │  LAYER 0: IDENTITY    │  Permanent system prompt
           │  Growth mindset,      │  Socratic preference,
           │  error-positive       │  exam-awareness
           └───────────┬───────────┘
                       │
           ┌───────────▼───────────┐
           │  LAYER 1: STUDENT     │  Living profile — updates every session
           │  MODEL                │  Mastery vectors, error taxonomy,
           │  (25+ attributes)     │  cognitive prefs, emotional state,
           │                       │  exam strategy parameters
           └───────────┬───────────┘
                       │
           ┌───────────▼───────────┐
           │  LAYER 2: TASK        │  "Think before speaking"
           │  REASONER             │  Classifies intent, selects action,
           │  (5-node decision     │  chooses difficulty/topic/format
           │   tree)               │  ↓ INSTRUCTIONS (not content)
           └───────────┬───────────┘
                       │
           ┌───────────▼───────────┐
           │  LAYER 3: CONTENT     │  Produces actual output following
           │  GENERATOR            │  Layer 2 instructions with Layer 1
           │                       │  personalization
           └───────────┬───────────┘
                       │
           ┌───────────▼───────────┐
           │  VERIFICATION         │  Math check → constraint check →
           │  PIPELINE             │  pedagogy check → tone check
           │  (existing 3-tier +   │
           │   new pedagogy layer) │
           └───────────┬───────────┘
                       │
           ┌───────────▼───────────┐
           │  STUDENT MODEL        │  Log interaction, update mastery,
           │  UPDATE               │  update error taxonomy
           └───────────────────────┘
```

This is the fundamental shift: **separate reasoning from generation**. Today's tutor simultaneously figures out what's pedagogically appropriate AND generates math content in a single prompt. That's why it can't diagnose errors deeply — it's trying to do too many things at once.

---

## MVP Feature Set: 6 Pillars

### Pillar 1: Student Model v2

**What exists today:** `UserContext` with 5 fields (sessionId, topic, difficulty, examDate, diagnosticScore) + topic-level accuracy from SR sessions.

**What 10-star looks like:** A living profile with 15 attributes across 5 domains, persisted in Postgres, updated every interaction.

**MVP Attribute Schema:**

| Domain | Attribute | How Computed | Why It Matters |
|--------|-----------|-------------|----------------|
| Academic | `mastery_vector` | Bayesian update from problem attempts (hard correct = bigger bump) | Replaces crude 1-5 confidence with calibrated 0.0-1.0 per concept |
| Academic | `error_taxonomy` | Classified by Task Reasoner on every wrong answer | "40% of mistakes are sign errors in calculus" → targeted fix |
| Academic | `speed_profile` | Avg time per problem by topic + difficulty | Exam strategy: "skip coord geometry (4 min avg), start with algebra (1.5 min)" |
| Academic | `prerequisite_map` | Dependency graph edges, status derived from mastery_vector | If limits = 0.4, flag integrals as "building on shaky ground" |
| Cognitive | `representation_mode` | Detected from which explanation types lead to successful follow-ups | Some students need visual, some algebraic, some numerical-first |
| Cognitive | `abstraction_comfort` | From error patterns on abstract vs concrete problems | "Let f be continuous" vs "let f(x) = x² + 3x" |
| Cognitive | `working_memory_est` | From error patterns in multi-step problems | Lower WM → smaller solution chunks |
| Motivational | `motivation_state` | Session patterns: duration, attempts vs skips, hint usage | driven / steady / flagging / frustrated / anxious |
| Motivational | `confidence_calibration` | Compare self-rated confidence to actual accuracy | Over/under-confident → affects skip threshold in exams |
| Motivational | `frustration_threshold` | Consecutive failures before disengagement | Interleave confidence-builders between hard problems |
| Exam | `optimal_attempt_sequence` | Derived from speed + accuracy profiles | "Start with algebra → probability → calculus; skip coord geometry" |
| Exam | `skip_threshold` | Calibrated from confidence vs accuracy data | "If <60% sure on a -1 penalty question, skip" |
| Exam | `time_budget` | Per-section time targets from speed profile + exam weights | "42 min on Section A, 18 min on Section B" |
| Session | `session_fatigue` | Session count today, duration, time of day | 3+ sessions → lighter review, no new material |
| Session | `days_until_exam` | Computed from profile.exam_date | Fundamentally changes strategy at 90/30/7 day thresholds |

**DB Schema:**
```sql
CREATE TABLE IF NOT EXISTS student_model (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  mastery_vector JSONB DEFAULT '{}',        -- concept_id → {score, attempts, last_update}
  error_taxonomy JSONB DEFAULT '[]',        -- [{type, concept, problem_id, diagnosed_at, diagnosis}]
  speed_profile JSONB DEFAULT '{}',         -- topic → {avg_ms, by_difficulty: {easy, med, hard}}
  prerequisite_alerts JSONB DEFAULT '[]',   -- [{concept, shaky_prereq, severity}]
  cognitive_profile JSONB DEFAULT '{}',     -- {representation_mode, abstraction_comfort, working_memory_est}
  motivation_state VARCHAR DEFAULT 'steady',
  confidence_calibration JSONB DEFAULT '{}', -- {overconfident_rate, underconfident_rate, calibration_score}
  exam_strategy JSONB DEFAULT '{}',         -- {attempt_sequence, skip_threshold, time_budget}
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Effort:** M (human: ~1 week / CC: ~2 hours). Schema + CRUD + update triggers on every problem attempt.

---

### Pillar 2: Error Taxonomy + Misconception Hunter

**What exists today:** Verification says "correct" or "incorrect." That's it. No diagnosis.

**What 10-star looks like:** When a student answers wrong, the system:
1. Classifies the error type (conceptual / procedural / notation / misread / time-pressure / arithmetic / overconfidence)
2. Identifies the specific misconception ("confused chain rule with product rule")
3. Shows why the misconception is tempting
4. Generates a corrective problem that distinguishes correct from misconception

**Architecture:**
```
Student submits wrong answer
        │
        ▼
  ┌─────────────┐
  │ ERROR        │  Input: question + student_answer + correct_answer
  │ CLASSIFIER   │  Output: {error_type, misconception_id, explanation}
  │ (Gemini call)│  Prompt: structured JSON output with error taxonomy
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │ MISCONCEPTION│  Input: misconception_id + concept
  │ EXPLAINER    │  Output: {why_tempting, why_wrong, corrective_problem}
  │ (Gemini call)│  Uses student model for representation_mode
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │ STUDENT      │  Append to error_taxonomy JSONB
  │ MODEL UPDATE │  Update mastery_vector (wrong answer = decay)
  └─────────────┘
```

**Error Type Taxonomy:**
- `conceptual` — misunderstands the underlying concept
- `procedural` — knows concept, applies wrong procedure
- `notation` — confused by mathematical notation
- `misread` — misinterpreted the question
- `time_pressure` — knew the method, rushed and slipped
- `arithmetic` — pure computation error
- `overconfidence_skip` — skipped steps, missed edge case

**This is the single biggest UX leap.** Going from "Wrong. The answer is 42." to "You confused the chain rule with the product rule. Here's why that's tempting, and here's a problem that will lock in the difference." This is what a great private tutor does.

**Effort:** M (human: ~1 week / CC: ~3 hours). Error classifier prompt + misconception explainer + UI for diagnosis display.

---

### Pillar 3: Concept Dependency Graph + Prerequisite Auto-Repair

**What exists today:** 10 flat topics. No dependency edges. No concept-level granularity.

**What 10-star looks like:** A directed acyclic graph where every concept is a node, prerequisites are edges, and the system can trace backward to find the root cause of struggles.

**Concept Graph Structure (GATE Math):**
```
sequences → limits → continuity → differentiability → derivatives
                                                          │
                                     chain_rule ◄─────────┤
                                     product_rule ◄────────┤
                                     implicit_diff ◄───────┘
                                          │
                                          ▼
                                     integration_basics
                                          │
                              ┌───────────┼───────────┐
                              ▼           ▼           ▼
                         substitution  by_parts    partial_fractions
                              │           │           │
                              └─────┬─────┘           │
                                    ▼                 │
                              definite_integrals ◄────┘
                                    │
                                    ▼
                              differential_equations
```

**Static data file:** `src/constants/concept-graph.ts` — ~80-100 concepts with edges. Authored once, maintained alongside syllabus changes.

**Auto-Repair Flow:**
```
Student struggles with definite_integrals (mastery < 0.3)
        │
        ▼
  Trace prerequisites: integration_basics → derivatives → limits
        │
        ▼
  Find weakest ancestor: limits (mastery = 0.25)
        │
        ▼
  Serve micro-lesson on limits (5 min, 3 problems)
        │
        ▼
  Re-assess → if limits improved, return to definite_integrals
```

This prevents the cascade: "I don't understand integrals" → "you actually don't understand limits" → "you actually don't understand sequences." Most students (and most tutors) don't trace backward. GBrain does.

**Effort:** M (human: ~1 week / CC: ~3 hours). Concept graph data + traversal algorithm + micro-lesson generation.

---

### Pillar 4: Adaptive Problem Generation

**What exists today:** Static PYQ bank (~30 problems in SQL seed file). Content flywheel generates social/blog content but not practice problems.

**What 10-star looks like:** Infinite practice calibrated to the student's exact gap. Not random problems — problems synthesized to target the specific concept × error-type × difficulty intersection the student needs.

**Generation Pipeline:**
```
Student Model says: "weak on integration_by_parts, error_type = procedural"
        │
        ▼
  ┌─────────────┐
  │ PROBLEM      │  Input: concept + difficulty + error_type_to_target
  │ GENERATOR    │  Constraints: GATE format, syllabus-aligned,
  │ (Gemini)     │  no forward references, match student's notation prefs
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │ VERIFICATION │  Solve problem independently to verify answer
  │ (existing    │  Check difficulty calibration
  │  3-tier)     │  Check constraint compliance
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │ CACHE        │  Store in rag_cache for future students with
  │ WRITE-BACK   │  similar profiles
  └─────────────┘
```

**Key insight:** Generated problems get verified by the existing 3-tier pipeline. If verification fails, the problem is discarded — never shown to the student. Mathematical correctness is non-negotiable.

**Effort:** L (human: ~2 weeks / CC: ~4 hours). Problem generator prompt engineering + verification integration + caching + UI for generated vs PYQ problems.

---

### Pillar 5: Exam Strategy Optimizer

**What exists today:** Priority engine ranks topics by marks_weight × weakness × improvement_speed × recency × proximity. No per-question strategy.

**What 10-star looks like:** A personalized exam playbook that tells you:
- Which sections to attempt first (based on your speed profile)
- Time budgets per section (based on your speed × section weight)
- Skip thresholds for negative-marking questions (calibrated to YOUR confidence accuracy)
- Score maximization plan ("improving probability from 0.5→0.7 adds 8 marks; coord geometry 0.3→0.5 adds only 4 — prioritize probability")

**Score Maximization Formula:**
```
expected_marks_gain(topic) = exam_weight(topic)
                           × (target_mastery - current_mastery)
                           × improvement_rate(topic)
                           × time_remaining_factor

Study allocation = sort topics by expected_marks_gain DESC
```

**Negative Marking Trainer:**
Present problems and ask "Would you attempt this in a real exam?" before revealing the answer. Over time, trains calibrated confidence → reduces negative marking losses.

**Attempt Strategy Flow:**
```
  ┌─────────────────────────────┐
  │ Pre-Exam Strategy Generator │
  │                             │
  │ Input:                      │
  │   - speed_profile by topic  │
  │   - accuracy by topic       │
  │   - exam scheme (+3/-1)     │
  │   - total time (180 min)    │
  │                             │
  │ Output:                     │
  │   - attempt_sequence        │
  │   - time_budget per section │
  │   - skip_threshold (0-1)    │
  │   - expected_score range    │
  └─────────────────────────────┘
```

**Effort:** M (human: ~1 week / CC: ~2 hours). Strategy computation is mostly deterministic math on the student model data.

---

### Pillar 6: Task Reasoner (Layer 2)

**What exists today:** AI tutor receives the student's message + basic context modifiers and generates a response directly. No intermediate reasoning step.

**What 10-star looks like:** A 5-node decision tree that runs BEFORE any content is generated.

```
Node 1: INTENT CLASSIFICATION
  What is the student doing?
  → asking a concept question
  → submitting a solution for checking
  → requesting practice
  → asking strategy advice
  → expressing confusion/frustration
  → "help me study" (open-ended)

Node 2: PEDAGOGICAL ACTION
  What should GBrain DO?
  → Socratic questioning (student is close, needs a nudge)
  → Worked example (student needs to see the method)
  → Scaffolded hint (partial help, build independence)
  → Error diagnosis (wrong answer, classify and explain)
  → Prerequisite repair (struggling because foundation is weak)
  → Confidence building (frustration detected, serve an easier win)
  → Strategy coaching (exam-related question)

Node 3: DIFFICULTY + TOPIC
  Zone of proximal development: mastery 0.3-0.7
  Below 0.3 → prerequisites need work first
  Above 0.7 → no more drill needed, move on

Node 4: FORMAT + DEPTH
  Based on working_memory_est, abstraction_comfort, representation_mode:
  → How many steps to show?
  → Visual or algebraic?
  → Concrete example first or abstract definition?
  → How much notation?

Node 5: VERIFICATION GATE
  Before response reaches student:
  → Is the math correct? (self-check)
  → Does it match the student's level? (pedagogy check)
  → Is the tone growth-oriented? (emotional safety check)
```

**Implementation:** This is a structured Gemini call that outputs JSON instructions, which are then passed to the Content Generator as a system prompt. Two LLM calls instead of one, but the quality leap is enormous.

**Effort:** M (human: ~1 week / CC: ~3 hours). Task Reasoner prompt + structured output parsing + Content Generator prompt refactor.

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- Student Model v2 schema + CRUD + update triggers
- Concept dependency graph (static data, ~80-100 concepts)
- Error taxonomy classifier (Gemini structured output)
- DB migration 011

### Phase 2: Intelligence (Weeks 3-4)
- Task Reasoner (Layer 2) — intent classification + pedagogical action selection
- Misconception Hunter — diagnosis + corrective problem generation
- Prerequisite Auto-Repair — graph traversal + micro-lesson serving
- Adaptive problem generation (Gemini + verification gate)

### Phase 3: Strategy (Week 5)
- Exam Strategy Optimizer — attempt sequence, time budget, skip threshold
- Score Maximization Planner — study allocation based on expected marks gain
- Negative Marking Trainer — confidence calibration game
- Strategy UI on Progress page

### Phase 4: Polish (Week 6)
- Worked Example Fading — progressive removal of solution steps
- Spaced Repetition v2 — SR-2 algorithm calibrated for math (steeper curves for procedural skills)
- Error Pattern Reports — weekly digest ("40% sign errors, 30% misreads, 20% conceptual")
- Three tutoring modes: Hint / Explain / Socratic (student controls scaffolding level)

---

## Risk Map

| Risk | Severity | Mitigation |
|------|----------|------------|
| Error classifier hallucinates wrong diagnosis | HIGH | Verify diagnosis against student's actual work; never claim misconception without evidence from the submitted answer |
| Generated problems have wrong answers | HIGH | Every generated problem goes through existing 3-tier verification. Discard on failure. |
| Student Model becomes stale/wrong | MEDIUM | Bayesian updates self-correct over time. Add "reset topic" escape hatch. |
| Two-LLM-call latency (Reasoner + Generator) | MEDIUM | Parallel prefetch student model while Reasoner runs. Target <3s total. |
| Concept graph maintenance burden | LOW | Static data, changes only when syllabus changes (annually). |
| Over-personalization feels creepy | LOW | Student can see their full profile. Transparency builds trust. |

---

## Cost Impact

| Component | Current Monthly | With GBrain | Notes |
|-----------|-----------------|-------------|-------|
| Gemini API | ~$2 (tutor chat) | ~$8-12 | 2x calls per interaction (Reasoner + Generator) + error classification + problem generation |
| Wolfram | ~$0.60 | ~$1.50 | More generated problems need verification |
| Supabase | Free tier | Free tier | Student Model is JSONB, no extra tables needed beyond one |
| Render | Free tier | Free tier | Same single service |
| **Total** | **~$3/mo** | **~$10-14/mo** | Still under $15/mo. Sustainable at 0 revenue. |

---

## What This Does NOT Include (Deferred)

- Voice input/output (Phase 4+)
- Camera scan for handwritten problems (exists in UI, not connected)
- Language mixing (Telugu/Hindi) — needs bilingual training data
- Offline problem sets (PDF generation)
- Parent/teacher progress sharing
- Multi-exam support (JEE, BITSAT) — architecture supports it, just needs exam skill modules
- Community features
- GBrain as a separate service (stays embedded in gate-server for now)

---

## GSTACK REVIEW REPORT

**Review mode:** SCOPE EXPANSION
**Verdict:** BUILD THIS.

The current product is a practice app. The GBrain evolution makes it a **cognitive learning system**. The difference is the difference between Google Maps (gives directions) and a local who's lived in the city for 30 years (knows the shortcuts, the construction zones, and why you're going the wrong way).

**Highest-leverage pillar:** Error Taxonomy + Misconception Hunter. A student who gets "You confused chain rule with product rule — here's a problem that locks in the difference" will never go back to an app that just says "Wrong. The answer is 42."

**Second-highest leverage:** Prerequisite Auto-Repair. This is what separates a great tutor from a good one. Most students (and most apps) treat symptoms. GBrain traces root causes.

**Strategic risk:** This is still a pre-validation product. Building all 6 pillars before proving distribution is a real risk. Recommendation: ship Pillar 1 (Student Model) + Pillar 2 (Error Taxonomy) first. These are the most visible user-facing improvements and can be validated with existing Telegram distribution. If users engage with error diagnosis, build the rest.

**Timeline:** 6 weeks to full 6-pillar MVP with CC. Not 6 months.

**The cathedral is worth building.**
