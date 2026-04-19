---
name: cohort-analysis
description: |
  Population-level analytics across all students. Surfaces common misconceptions,
  bottleneck concepts, topics with highest drop-off, and hidden patterns in error_log
  and student_model tables. Use to prioritize content creation and find systemic gaps.
triggers:
  - cohort analysis
  - population insights
  - all students
  - what's everyone struggling with
allowed-tools:
  - Bash
---

# Cohort Analysis (GBrain MOAT)

## Invocation

```bash
npx tsx src/gbrain/operations/cohort-analysis.ts [--days 30]
```

## Outputs

1. **Top 20 misconceptions** across all students (count, concept, description)
2. **Bottleneck concepts** — highest % of students with mastery < 0.3 despite attempts
3. **Error type distribution** across population (vs. per-student)
4. **Motivation health** — % students frustrated/flagging
5. **Prerequisite cascade map** — concepts that trigger the most downstream alerts
6. **Engagement patterns** — session time-of-day, duration, consecutive-failure distribution

## Why MOAT

Every wrong answer in your system makes the whole population smarter. Competitors' 1000 students and
your 1000 students solve the same problems, but your system knows *exactly* which misconception
each wrong answer represents — so the next problem generated targets it. That compounding is the moat.
