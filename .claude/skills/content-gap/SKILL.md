---
name: content-gap
description: |
  Find concept × difficulty × error-type combinations with NO cached problems.
  Auto-generates + verifies the missing problems via the adaptive problem generator.
  Expands the generated_problems cache proactively so students never wait on gen.
triggers:
  - content gap
  - fill problems
  - expand problem bank
  - problem inventory
allowed-tools:
  - Bash
---

# Content Gap Filler (GBrain MOAT)

## Invocation

```bash
# Find gaps (report only)
npx tsx src/gbrain/operations/content-gap.ts --scan

# Fill specific topic
npx tsx src/gbrain/operations/content-gap.ts --fill --topic calculus --count 20

# Fill all gaps (budget-aware)
npx tsx src/gbrain/operations/content-gap.ts --fill --budget 50
```

## How It Works

1. **Scan** — For each (concept_id, difficulty_bucket) in concept_graph × {easy, med, hard}:
   count verified problems. Find gaps where count < 5.
2. **Prioritize** — Sort gaps by concept usage (how often served) × gate_frequency.
3. **Generate** — Call `generateProblems()` with targeted params until gaps are filled.
4. **Verify** — Every generated problem passes through the 3-tier verification pipeline.
5. **Cache** — Verified problems saved to `generated_problems` table.

## Why MOAT

Competitors have static question banks of 500-2000 problems. You generate infinite problems
targeted to exact learning gaps. The cache grows daily; every student's weak spot is pre-filled
before they need it. Zero-latency "next problem" UX that's impossible to replicate without this architecture.
