---
name: gbrain-health
description: |
  Comprehensive health check for all GBrain subsystems: student_model row count,
  error_log growth rate, generated_problems verification rate, task_reasoner latencies,
  prerequisite alert volume, concept_graph integrity. Run after deploys and in daily cron.
triggers:
  - gbrain health
  - system health
  - is gbrain ok
  - check gbrain
allowed-tools:
  - Bash
---

# GBrain Health Check

## Invocation

```bash
npx tsx src/gbrain/operations/gbrain-health.ts
```

## Checks

| Check | Pass Threshold |
|-------|---------------|
| student_model rows | ≥ 1 (after users exist) |
| error_log growth (7d) | Any rows = healthy |
| generated_problems verified rate | ≥ 85% |
| task_reasoner avg latency | ≤ 3000ms |
| prerequisite alert volume | < 50% of students |
| concept_graph integrity | 0 orphan concepts, 0 circular deps |
| Gemini API connectivity | responds within 5s |
| Postgres connection pool | active connections < 80% of max |

## Output

```
GBrain Health Report — 2026-04-19 03:15 UTC
═══════════════════════════════════════════
✅ student_model: 1,284 students tracked
✅ error_log: 342 errors logged in last 7d
⚠️  generated_problems: 78% verified (target: 85%)
✅ task_reasoner: 1,240ms avg (target <3000ms)
✅ concept_graph: 82 concepts, 112 edges, 0 cycles
✅ Gemini: reachable in 680ms
✅ Postgres: 3/5 connections active

Status: MOSTLY HEALTHY
Action: Investigate problem generator — verification rate below threshold.
```

## Why MOAT

Competitors can't measure their pedagogical system because they don't have one. You have
a living cognitive architecture with observable health metrics. When something degrades
(e.g., error classifier drift after a Gemini model update), you detect it before users do.
