---
name: mock-exam
description: |
  Generate a full-length timed mock exam calibrated to a student's current mastery.
  Samples problems from generated_problems cache + PYQ bank using the exam's section weights.
  Returns 65 problems (GATE standard) with appropriate difficulty distribution.
triggers:
  - mock exam
  - full exam
  - practice test
  - timed mock
allowed-tools:
  - Bash
---

# Mock Exam Generator (GBrain MOAT)

## Invocation

```bash
# API
curl http://localhost:8080/api/gbrain/mock-exam/<sessionId>?exam=gate

# CLI
npx tsx src/gbrain/operations/mock-exam.ts <sessionId> [gate|bitsat|jee-main]
```

## Structure

For GATE (65 questions, 180 min):
- **Section 1** — 10 high-weight topics × 6-7 questions each
- **Difficulty distribution**: 40% easy, 40% medium, 20% hard
- **Topic weights** match exam syllabus (from MARKS_WEIGHTS)
- **Calibration**: if student mastery > 0.7 on a topic, bias toward hard problems

## Output Schema

```json
{
  "exam_id": "mock-gate-2026-04-19-abc123",
  "time_limit_minutes": 180,
  "questions": [ { "id", "question_text", "options", "correct_answer", "topic", "difficulty", "marks" } ],
  "section_breakdown": { "linear-algebra": 10, "calculus": 10, ... },
  "post_analysis_hook": "/api/gbrain/mock-exam/<id>/analyze"
}
```

## Post-Analysis

After submission, calls GBrain to produce:
- Time-per-question breakdown
- Accuracy by topic × difficulty
- Errors classified via error-taxonomy
- Updated student model (mass update)
- Predicted exam score based on this performance
- Strategic adjustments for next mock

## Why MOAT

Competitors show you 25 random problems and call it a "mock." You generate a **syllabus-weighted,
mastery-calibrated, time-pressured exam** that converges on real GATE difficulty. Post-analysis
updates the cognitive model in ways that compound every future problem.
