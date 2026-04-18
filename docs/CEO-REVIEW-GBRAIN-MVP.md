# CEO Review: EduGenius v2 → GBrain-Powered 10-Star Product

**Mode:** SCOPE EXPANSION — Dream big, find the 10-star product
**Date:** 2026-04-18
**Reviewer:** Claude (gstack /plan-ceo-review)
**Repo:** mathconcepts/edugenius-v2 (v0.3.0.0)
**Input:** GBrain + GStack Feature Specification (April 2026 PDF)

---

## System Audit Summary

### What Exists Today (v0.3.0)
```
┌─────────────────────────────────────────────────────┐
│  GATE Math Prep App (Mobile-first PWA)              │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ 10 Topics│→ │ PYQ Bank │→ │ 3-Tier Verify    │  │
│  │ Grid     │  │ (static) │  │ RAG→LLM→Wolfram  │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Study    │→ │ Priority │→ │ Daily Plan       │  │
│  │ Commander│  │ Engine   │  │ (5-factor)       │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ AI Tutor │  │ Notebook │  │ Content Flywheel │  │
│  │ (Gemini) │  │          │  │ + Blog + Social  │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│                                                     │
│  Auth │ SR Sessions │ Streaks │ Telegram Bot       │
└─────────────────────────────────────────────────────┘
```

**Lines of code:** ~3,200 in core backend, 12 frontend pages, 25 DB tables, 10 migrations.

**What it does well:**
- 3-tier verification is genuinely clever — RAG cache → LLM dual-solve → Wolfram is cost-efficient and correct
- Priority engine has real math behind it (marks weight × weakness × improvement speed × recency × exam proximity)
- Content flywheel auto-generates problems and social posts
- Auth, roles, admin dashboard — the infrastructure is solid

**What it does NOT do:**
- No student model beyond topic-level confidence (1-5 self-reported + accuracy)
- No error diagnosis — just right/wrong
- No misconception detection
- No prerequisite tracking
- No exam strategy intelligence
- No cognitive/emotional profiling
- No adaptive difficulty
- Tutor is generic Gemini + RAG — no pedagogical reasoning layer
- Practice is static PYQ — no problem generation

**The gap:** The current app is a **practice tool**. The PDF envisions a **learning intelligence system**. That's not an incremental improvement — it's a category shift.

---

## The 10-Star Product Vision

### One-Sentence Thesis
**"The app that knows you better than your best tutor — and is available 24/7 for ₹0."**

Every Indian coaching class charges ₹50K-2L/year. The best tutors are inaccessible. The 10-star version of EduGenius replaces the *intelligence* of a great tutor — not the content, the judgment: knowing what to teach, when, how, and why you're stuck.

### The Closed Learning Loop
```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   ┌───────────┐    ┌───────────┐    ┌───────────────────┐   │
│   │ DIAGNOSE  │───→│  TEACH    │───→│   PRACTICE        │   │
│   │           │    │           │    │                   │   │
│   │ Why wrong │    │ Right way │    │ Calibrated to gap │   │
│   │ Error type│    │ Right mode│    │ Adaptive diff.    │   │
│   │ Prereq?   │    │ Right level│   │ Interleaved       │   │
│   └───────────┘    └───────────┘    └───────────────────┘   │
│         ↑                                    │              │
│         │          ┌───────────┐             │              │
│         │          │   ADAPT   │             │              │
│         └──────────│           │←────────────┘              │
│                    │ Update    │                             │
│                    │ student   │                             │
│                    │ model     │                             │
│                    └───────────┘                             │
│                         │                                    │
│                    ┌────┴─────┐                              │
│                    │ EVALUATE │                              │
│                    │ Mastery  │                              │
│                    │ Strategy │                              │
│                    │ Readiness│                              │
│                    └──────────┘                              │
└──────────────────────────────────────────────────────────────┘
```

This loop is the product. Everything else is a surface over this loop.

---

## GBrain Architecture: The Four-Layer Intelligence

This is the single most important architectural change. The current app mixes reasoning and generation in a single Gemini call. The PDF's layered architecture separates them — and that separation is what creates the intelligence.

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 0: IDENTITY KERNEL                                    │
│ Permanent system prompt. Growth mindset. Error-positive.    │
│ Socratic preference. Exam-aware. Never changes per session. │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: STUDENT MODEL                                      │
│ Living profile. 25+ attributes. Updates every session.      │
│ Mastery vectors, error taxonomy, cognitive style,           │
│ emotional state, exam strategy parameters.                  │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: TASK REASONER                                      │
│ "Think before speaking." Classifies intent. Chooses         │
│ pedagogical action. Selects difficulty/topic/format.        │
│ 5-node decision tree. Output: instructions for Layer 3.     │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: CONTENT GENERATOR                                  │
│ Produces the response. Follows Layer 2 instructions.        │
│ Never sees raw student input — only pedagogically           │
│ filtered instructions + student model context.              │
├─────────────────────────────────────────────────────────────┤
│ VERIFICATION PIPELINE                                       │
│ 5-step: Generate → Self-verify → Constraint check →        │
│ Pedagogical audit → Emotional tone check                    │
└─────────────────────────────────────────────────────────────┘
```

### Why This Matters
The current tutor is: `student_message + system_prompt → Gemini → response`. The GBrain tutor is: `student_message → classify_intent → load_student_model → reason_about_pedagogy → generate_with_instructions → verify`. The difference is like a doctor who listens then prescribes vs. a doctor who runs diagnostics, checks history, considers alternatives, then prescribes.

---

## The Student Model: Heart of Personalization

This is where EduGenius becomes something no competitor has. Not a feature — a **compound advantage** that gets better with every session.

### Current State vs. 10-Star State
| Attribute Domain | Current (v0.3) | 10-Star (GBrain) |
|---|---|---|
| **Academic** | Topic confidence (1-5, self-reported) | Mastery vector (0.0-1.0, Bayesian), prerequisite map, error taxonomy, speed profile, accuracy-under-pressure |
| **Cognitive** | None | Representation mode, abstraction comfort, working memory estimate, analogical reasoning affinity |
| **Motivational** | Streak count | Motivation state, confidence calibration, frustration threshold, growth trajectory awareness, exam anxiety profile |
| **Exam Strategy** | Exam date only | Target exam params, optimal attempt sequence, skip-or-attempt threshold, time budget, score maximization plan |
| **Session Context** | None | Time of day, session duration intent, fatigue detection, days until exam, emotional context |

### Database Schema (New)
```sql
CREATE TABLE student_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id),

    -- Academic (updated every problem attempt)
    mastery_vector JSONB NOT NULL DEFAULT '{}',        -- {topic_id: 0.0-1.0}
    prerequisite_map JSONB NOT NULL DEFAULT '{}',      -- {topic_id: {prereq: ready|shaky}}
    error_taxonomy JSONB NOT NULL DEFAULT '[]',        -- [{type, problem_id, diagnosis, ts}]
    speed_profile JSONB NOT NULL DEFAULT '{}',         -- {topic_id: {avg_seconds, by_difficulty}}
    accuracy_under_pressure JSONB DEFAULT NULL,        -- {degradation_rate, pattern}

    -- Cognitive (inferred over 10+ sessions)
    representation_mode TEXT DEFAULT NULL,             -- algebraic|visual|numerical|formal
    abstraction_comfort REAL DEFAULT NULL,             -- 0.0 (concrete only) to 1.0 (abstract OK)
    working_memory_estimate INT DEFAULT NULL,          -- 2-7 steps
    analogical_affinity BOOLEAN DEFAULT NULL,

    -- Motivational (updated every session)
    motivation_state TEXT DEFAULT 'steady',            -- driven|steady|flagging|frustrated|anxious
    confidence_calibration TEXT DEFAULT 'unknown',     -- over|under|calibrated
    frustration_threshold INT DEFAULT 3,               -- consecutive failures before disengage
    growth_trajectory JSONB DEFAULT '[]',              -- [{week, mastery_delta}]

    -- Exam Strategy (updated on profile change + weekly)
    target_exam TEXT DEFAULT NULL,                     -- GATE|BITSAT|JEE|UGEE
    optimal_attempt_sequence TEXT[] DEFAULT '{}',
    skip_threshold REAL DEFAULT 0.6,
    time_budget JSONB DEFAULT NULL,
    score_max_plan JSONB DEFAULT NULL,

    -- Session (ephemeral, updated per session)
    last_session_ts TIMESTAMPTZ,
    sessions_today INT DEFAULT 0,
    current_emotional_context TEXT DEFAULT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE error_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id),
    problem_id TEXT NOT NULL,
    error_type TEXT NOT NULL,  -- conceptual|procedural|notation|misread|time_pressure|overconfidence|arithmetic
    topic TEXT NOT NULL,
    difficulty REAL,
    student_answer TEXT,
    correct_answer TEXT,
    diagnosis TEXT,            -- GBrain Layer 2 analysis
    time_taken_seconds INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_error_events_user ON error_events(user_id, created_at DESC);
CREATE INDEX idx_student_models_user ON student_models(user_id);
```

---

## MVP Feature Set: The 10-Star First Release

### Tier 1 — Ship First (Weeks 1-3): The Intelligence Layer

These are the features that transform the product category. Without them, you're competing with Testbook on features. With them, you're competing with a private tutor on intelligence.

#### 1. Error Taxonomy Engine
**What it replaces:** Current binary right/wrong tracking.
**What it does:** Every wrong answer gets classified into one of 7 error types (conceptual misunderstanding, procedural slip, notation confusion, question misinterpretation, time-pressure shortcut, overconfidence skip, arithmetic error). Each classification includes a diagnosis explaining WHY the error happened, not just THAT it happened.
**Implementation:** GBrain Layer 2 classifies errors using the student's answer + correct answer + problem context. Stored in `error_events` table. Surfaces in weekly Error Pattern Reports.
**Why 10-star:** No exam prep app in India does this. Students currently have no idea why they keep getting things wrong. This is the diagnostic that coaching teachers do manually for their top students.

#### 2. Prerequisite Auto-Repair
**What it replaces:** Flat topic grid where all topics are peers.
**What it does:** When a student struggles with "definite integrals" (mastery 0.3), GBrain traces the concept dependency graph and discovers "limits" is at 0.4. Instead of more integral practice, it serves a micro-lesson on limits. The student discovers the real gap — not the symptom.
**Implementation:** Static concept dependency graph (JSON) for GATE math (~60 nodes, ~120 edges). Priority engine checks prerequisite readiness before serving problems. If prereq mastery < 0.5, redirect to prereq first.
**Why 10-star:** This is what the best tutors do instinctively. "You don't understand integrals because you don't understand limits." No app does this. It's the difference between drilling the symptom and fixing the cause.

#### 3. Adaptive Problem Generation
**What it replaces:** Static PYQ bank (~30 problems).
**What it does:** Generates infinite practice calibrated to the student's exact mastery level. Uses Vygotsky zone-of-proximal-development heuristic: serve problems where mastery is 0.3-0.7. Below 0.3 = prereqs first. Above 0.7 = no more drill.
**Implementation:** Gemini generates problems with constraints from Layer 2 (topic, difficulty, format, error type to avoid). 5-step verification pipeline catches bad problems before they reach the student. Generated problems get added to RAG cache for reuse.
**Why 10-star:** The PYQ bank is a cold-start hack. The 10-star app has infinite practice — like having a tutor who can write a new problem for exactly what you need to learn, every time.

#### 4. GBrain Task Reasoner (Layer 2)
**What it replaces:** Direct Gemini calls with system prompt.
**What it does:** 5-node decision tree before any content is generated: (1) classify intent, (2) choose pedagogical action, (3) select difficulty/topic, (4) choose format/depth, (5) verification gate. The tutor "thinks" before "speaking."
**Implementation:** Separate Gemini call that outputs structured JSON instructions for Layer 3. ~200 LOC. The key architectural change.
**Why 10-star:** This is what makes the tutor intelligent rather than responsive. A tutor who thinks "this student is frustrated, struggling with a conceptual misunderstanding, and has low working memory — I should give a concrete example with fewer steps and validate their effort" vs. a tutor who just answers the question.

#### 5. Three Tutoring Modes
**What it replaces:** Single chat mode.
**What it does:** Hint (next nudge only), Explain (full walkthrough), Socratic (asks questions back). Student controls their scaffolding level.
**Implementation:** Mode selector in chat UI. Layer 2 adjusts generation instructions based on mode. Socratic mode uses guided questioning chains.
**Why 10-star:** This prevents learned helplessness — the #1 failure mode of AI tutors. Students who always get full explanations never learn to think independently. The Socratic mode is the killer feature: the AI that asks you the right question is more valuable than the AI that gives you the answer.

### Tier 2 — Ship Next (Weeks 4-6): The Strategy Layer

These features are the competitive moat for exam prep specifically.

#### 6. Score Maximization Planner
**What it does:** Given current mastery vector + exam scoring scheme, computes optimal study allocation. "Improving probability from 0.5 to 0.7 adds expected +8 marks. Improving coord geometry from 0.3 to 0.5 adds only +4. Prioritize probability."
**Implementation:** Extension of existing priority engine. Add expected-marks-gain calculation per topic based on mastery curve + exam weights. Surface in Study Commander.
**Why 10-star:** This is the single most valuable piece of information for any exam student: where to spend their next hour of study for maximum score impact. No app computes this.

#### 7. Attempt Strategy Optimizer
**What it does:** Personalized exam playbook: which sections first, time budgets, skip thresholds. Based on speed profile + accuracy data.
**Implementation:** New `/strategy` page. Consumes speed_profile and accuracy data from student model. Generates playbook as structured JSON from Gemini + verification.
**Why 10-star:** Every topper has an "attempt strategy." Most students don't know this exists. The app gives every student a topper-grade strategy.

#### 8. Negative Marking Trainer
**What it does:** Presents problems and asks "Would you attempt this in a real exam?" before revealing the answer. Teaches calibrated decision-making under uncertainty.
**Implementation:** New practice mode. Tracks confidence-vs-accuracy over time. Updates `confidence_calibration` in student model.
**Why 10-star:** GATE has +2/−0.67 marking. Students lose 5-15 marks per exam from bad skip decisions. This is trainable — and no one trains it.

#### 9. Mock Exam Simulator with Post-Analysis
**What it does:** Full-length timed mocks with real exam conditions. Post-mock analysis: time-per-question breakdown, accuracy by topic, comparison to target, strategic adjustments.
**Implementation:** New `/mock` page + `mock_results` table. Timer, section navigation, auto-submit. Post-analysis generated by GBrain with student model context.
**Why 10-star:** Other apps have mocks. None have intelligent post-analysis that says "You spent 4 minutes on Q17 which you got wrong — your data says skip it next time."

#### 10. Confidence Calibration Training
**What it does:** After every problem, asks "How confident are you?" (1-5) before revealing the answer. Over time, teaches accurate self-assessment.
**Implementation:** Simple UI addition to practice flow. Track predicted_confidence vs actual_correct. Surface calibration curve in progress.
**Why 10-star:** Metacognition. The student who knows what they don't know outperforms the student who doesn't. This is the foundation of skip-or-attempt decisions.

### Tier 3 — Compound Later (Weeks 7+): The Personalization Layer

These features require accumulated student data to work well.

#### 11. Cognitive Profile Detection
Infer representation mode, abstraction comfort, working memory from interaction patterns. Requires 10+ sessions of data.

#### 12. Emotional Awareness
Detect frustration, anxiety, motivation dips from session patterns. Adjust content strategy accordingly. Interleave confidence-building problems.

#### 13. Forgetting Curve Alerts
Proactive push notifications when mastered topics are predicted to decay. "You last practiced matrices 12 days ago — 5 minutes now prevents significant decay."

#### 14. Interleaved Practice
Mix topics within sessions. Harder in the moment, 2-3x better long-term retention. Explain to the student why you're mixing.

#### 15. Worked Example Fading
Start with fully worked examples, progressively remove steps. One of the most evidence-backed techniques in cognitive science (Renkl, Atkinson).

#### 16. Multi-Language Support
Telugu/Hindi explanations for intuition-building. Formal math stays in English notation. Conceptual analogies in mother tongue.

---

## Architecture Evolution

### Current → 10-Star Migration Path

```
CURRENT:
  Student → gate-server.ts → Gemini (flat prompt) → Response

10-STAR:
  Student → gate-server.ts → GBrain Router
                                  │
                          ┌───────┴────────┐
                          │ Load Student   │
                          │ Model (L1)     │
                          └───────┬────────┘
                                  │
                          ┌───────┴────────┐
                          │ Task Reasoner  │
                          │ (L2) — Gemini  │
                          │ Structured JSON│
                          └───────┬────────┘
                                  │
                          ┌───────┴────────┐
                          │ Content Gen    │
                          │ (L3) — Gemini  │
                          │ + Instructions │
                          └───────┬────────┘
                                  │
                          ┌───────┴────────┐
                          │ Verify + Update│
                          │ Student Model  │
                          └────────────────┘
```

### New Files Needed
```
src/gbrain/
  identity-kernel.ts          -- Layer 0: permanent system prompts
  student-model.ts            -- Layer 1: load/update student model
  task-reasoner.ts            -- Layer 2: 5-node decision tree
  content-generator.ts        -- Layer 3: instruction-following generation
  verification-pipeline.ts    -- 5-step content verification
  error-classifier.ts         -- Error taxonomy engine

src/engine/
  prerequisite-graph.ts       -- Concept dependency graph
  score-maximizer.ts          -- Expected marks gain calculator
  strategy-optimizer.ts       -- Exam attempt strategy generator
  confidence-tracker.ts       -- Calibration curve computation

src/api/
  strategy-routes.ts          -- /api/strategy/* endpoints
  mock-routes.ts              -- /api/mock/* endpoints
  model-routes.ts             -- /api/model/* (student model read)

frontend/src/pages/gate/
  StrategyPage.tsx            -- Exam strategy playbook
  MockPage.tsx                -- Mock exam simulator
  MockResultsPage.tsx         -- Post-mock analysis

supabase/migrations/
  011_student_model.sql       -- student_models + error_events tables
  012_mock_exams.sql          -- mock_results + mock_answers tables
```

### Cost Model (10-Star)

| Component | Current Cost | 10-Star Cost | Notes |
|---|---|---|---|
| Gemini (tutor) | ~$0.01/session | ~$0.03/session | 2 calls (L2 reasoner + L3 generator) |
| Gemini (problem gen) | $0 | ~$0.005/problem | Only when PYQ bank exhausted |
| Wolfram | ~$0.02/problem | ~$0.01/problem | Better RAG = fewer Wolfram calls |
| Supabase | Free tier | Free tier | Student model is small JSON |
| **Total/user/month** | **~$0.30** | **~$0.80** | At 10 sessions/month |

Still under $1/user/month. The intelligence layer costs almost nothing — it's just structured prompting.

---

## What Competitors Cannot Copy

1. **The student model compounds.** Every session makes the app smarter about this specific student. Testbook and Unacademy serve the same content to everyone. After 30 sessions, EduGenius knows your error patterns, cognitive style, and optimal exam strategy. That's a switching cost.

2. **Error taxonomy is proprietary data.** After 1000 students, you have the richest dataset of GATE math misconceptions ever assembled. This trains better classifiers, which diagnose better, which generates better practice, which attracts more students. Flywheel.

3. **The architecture is the moat.** The 4-layer separation (identity → model → reasoner → generator) is not a feature — it's an engineering decision that every subsequent feature builds on. Competitors who start with "Gemini + prompt" can't retrofit this.

---

## Risk Map

| Risk | Severity | Mitigation |
|---|---|---|
| Error classifier accuracy | High | Start with 3 types (conceptual, procedural, arithmetic) not 7. Expand as data accumulates. Manual review first 100 classifications. |
| Prerequisite graph wrong | Medium | Use NCERT chapter ordering as ground truth. Static graph, not ML. Human-verified. |
| Generated problems have errors | Critical | 5-step verification pipeline. Never serve unverified problems. Fallback to PYQ bank. |
| Student model cold start | Medium | Existing onboarding diagnostic + 5 problems = enough for basic model. Full model emerges over 5+ sessions. |
| Gemini latency (2 calls) | Medium | Layer 2 (reasoner) can be a faster/cheaper model (Flash). Layer 3 needs quality. Pipeline both. |
| Scope creep into Tier 3 | High | Hard gate: Tier 3 features require 10+ sessions of data per student. Don't build them until you have that data. |

---

## Recommended Execution Order

```
Week 1:  Database schema (student_models, error_events)
         GBrain Layer 0 (identity kernel) + Layer 1 (student model CRUD)
         Error classifier (3 types: conceptual, procedural, arithmetic)

Week 2:  GBrain Layer 2 (task reasoner — 5-node decision tree)
         Prerequisite dependency graph (static JSON, 60 nodes)
         Prerequisite auto-repair in priority engine

Week 3:  GBrain Layer 3 (content generator with L2 instructions)
         Three tutoring modes (Hint/Explain/Socratic)
         Adaptive problem generation (Gemini + verification)
         Wire up: chat → GBrain pipeline (replace flat Gemini call)

Week 4:  Confidence calibration UI (rate confidence before reveal)
         Error Pattern Reports (weekly digest)
         Score Maximization Planner

Week 5:  Attempt Strategy Optimizer page
         Negative Marking Trainer mode
         Mock Exam Simulator (basic: timer + sections + submit)

Week 6:  Mock post-analysis (GBrain-powered)
         Student model dashboard (show students their own profile)
         Integration testing, edge cases, polish
```

---

## GSTACK REVIEW REPORT

**Review mode:** SCOPE EXPANSION
**Verdict:** The PDF's vision is the right product. The question is sequencing.

**Critical path:** Tier 1 features (Error Taxonomy + Prerequisite Auto-Repair + GBrain Layers + Adaptive Problems + Tutoring Modes) are the product. Everything else is built on this foundation. Do not skip to "exam strategy" features without the intelligence layer — they'd be cosmetic without the student model powering them.

**Biggest insight:** The 4-layer GBrain architecture costs almost nothing to implement (it's structured prompting, not ML infrastructure) but creates a 10x improvement in tutor quality. This is the highest-leverage change in the entire plan.

**One thing I'd challenge:** The PDF lists 30+ features. The real MVP is 5 features (Error Taxonomy, Prerequisite Repair, Task Reasoner, Three Tutoring Modes, Adaptive Problems) that create the closed learning loop. Everything else compounds on top of that loop. Ship the loop first.

**Score:** ★★★★★ — This is the right vision. Execute Tier 1, validate, then layer.
