---
name: seed-rag
description: |
  Pre-seed the RAG cache with solution patterns from the PYQ bank. Boosts Tier 1
  verification hit rate from day-one, cutting Wolfram + LLM costs. Run once at deploy
  and whenever new PYQs are added.
triggers:
  - seed rag
  - warm cache
  - pre-seed patterns
  - boost tier 1
allowed-tools:
  - Bash
---

# RAG Cache Seeder (GBrain MOAT)

## Invocation

```bash
# Seed from all PYQs
npx tsx src/gbrain/operations/seed-rag.ts --source pyq

# Seed from verified generated_problems
npx tsx src/gbrain/operations/seed-rag.ts --source generated

# Both
npx tsx src/gbrain/operations/seed-rag.ts --all
```

## Process

1. Fetch all `pyq_questions` rows with non-null explanations
2. For each problem:
   - Extract solution pattern (method + answer structure)
   - Generate embedding (Gemini gemini-embedding-001)
   - Insert into `rag_cache` with topic + embedding
3. For generated problems: same process, filter to `verified = true`
4. Build IVFFlat index on embeddings (when count > 10K)

## Budget Aware

- Embedding calls are batched (20 per request) to minimize API costs
- Skips rows already in rag_cache (dedup by problem text hash)
- Respects `EMBEDDING_BUDGET` env var (default: 500 per run)

## Why MOAT

Tier 1 (RAG) hits are $0 and sub-50ms. Pre-seeding means your month-1 Wolfram costs
drop from ~$2 to ~$0.30. Every verified problem in your cache is a future zero-cost
verification. The cache compounds as you ship content.
