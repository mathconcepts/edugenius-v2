---
name: misconception-miner
description: |
  Mine the top misconceptions from error_log across all students, cluster similar ones,
  rank by impact (frequency × concept weight), and generate detailed explainer content
  for each. Feeds into corrective problem generation and content pipeline.
triggers:
  - misconception miner
  - top misconceptions
  - common mistakes
  - mine misconceptions
allowed-tools:
  - Bash
---

# Misconception Miner (GBrain MOAT)

The compounding data play — the more students use the app, the sharper the misconception library gets.

## Invocation

```bash
# Mine top 20 misconceptions
npx tsx src/gbrain/operations/misconception-miner.ts --top 20

# Export as corrective content
npx tsx src/gbrain/operations/misconception-miner.ts --top 20 --generate-correctives
```

## Process

1. **Aggregate** — GROUP BY misconception_id from error_log
2. **Rank by impact** — count × gate_frequency × MARKS_WEIGHTS of concept
3. **Cluster** — merge semantically similar misconceptions via embedding similarity
4. **Enrich** — for each top misconception, generate:
   - Why students fall for it (from representative error examples)
   - The correct mental model
   - 3 corrective problems calibrated to each error type
5. **Publish** — save enriched misconceptions into a new `misconception_library` table

## Output

```json
[
  {
    "id": "chain-rule-product-confusion",
    "concept": "chain-rule",
    "impact_score": 287,
    "frequency": 42,
    "examples": [...],
    "mental_model": "The chain rule composes; the product rule multiplies.",
    "corrective_problems": [...]
  }
]
```

## Why MOAT

This is the **pedagogical flywheel**: every wrong answer → classified misconception → mined pattern
→ generated corrective content → served to next student with same misconception. After 10K users,
your misconception library is the most comprehensive in the world for GATE math — and it's
impossible to replicate without your cognitive architecture.
