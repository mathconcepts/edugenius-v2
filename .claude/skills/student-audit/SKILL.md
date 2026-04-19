---
name: student-audit
description: |
  Deep analysis of a single student: mastery vector breakdown, error pattern trends,
  motivation state, prerequisite gaps, exam readiness forecast, and personalized action plan.
  Use when: investigating why a student is stuck, preparing parent/teacher reports, diagnosing drop-off,
  or before a coaching session. Requires sessionId.
triggers:
  - audit this student
  - why is X struggling
  - generate student report
  - parent report
  - teacher report
allowed-tools:
  - Bash
  - Read
  - Write
---

# Student Audit (GBrain MOAT)

Comprehensive 360° analysis of a single student, compiled from the GBrain cognitive architecture.

## Invocation

```bash
npx tsx src/gbrain/operations/student-audit.ts <sessionId>
```

Or via API:
```bash
curl http://localhost:8080/api/gbrain/audit/<sessionId>
```

## What It Produces

A single markdown report with 8 sections:

1. **Executive Summary** — predicted exam score, readiness level, biggest risk
2. **Mastery Heatmap** — topic × concept mastery scores with trends
3. **Error Taxonomy** — breakdown by type, concept, time-of-day
4. **Prerequisite Alerts** — concepts built on shaky foundations
5. **Cognitive Profile** — representation mode, abstraction comfort, working memory
6. **Motivation Trajectory** — state changes, consecutive-failure spikes, engagement patterns
7. **Strategic Recommendations** — what to study next, what to avoid, pace adjustments
8. **Action Plan** — concrete next 3 sessions

## When To Use

- **Before a coaching session** — coach opens the report, knows exactly what to focus on
- **Parent/teacher report** — shareable PDF with student's progress
- **Drop-off investigation** — student hasn't engaged in 7+ days, what's wrong?
- **Milestone check-in** — 30/60/90 days before exam, readiness audit

## Why This Is MOAT

Competitors give you a dashboard. You ship a pedagogically-grounded narrative that a tutor
would take an hour to write — generated in 5 seconds from the cognitive architecture.
Parents see "your kid is struggling with chain rule because their limits foundation is shaky" —
not "60% accuracy in calculus."
