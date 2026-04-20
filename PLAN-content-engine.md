# PLAN: Content Engine — Scrape, Generate, Deliver at Minimum Cost

> **Status:** Plan + implementation in progress
> **Date:** 2026-04-19
> **Context:** No DB. Local-first. Wolfram MCP available. RAG-like cost reduction required.

---

## Executive summary

The moat is **right content to right student at right moment, at near-zero cost**. That
requires three pipelines working together:

1. **Scrape** — build a seed corpus of verified problems/explanations from the open web (public PYQs, OCW, textbooks in creative commons, arXiv educational content). Done once, shipped as static bundles.
2. **Generate** — fill coverage gaps with LLM + Wolfram-verified problems. Done at build-time when possible, at runtime only when inevitable.
3. **Deliver** — at request time, pick from the cheapest tier that satisfies the need. Tier 0 (bundled static) → Tier 1 (client RAG over bundle + materials) → Tier 2 (generate on-demand) → Tier 3 (full Gemini + Wolfram MCP verification).

The RAG-equivalent for cost reduction is **three layers of progressively richer cache** sitting in front of expensive LLM calls.

---

## Part 1: Cost landscape (what we're optimizing)

Using current Gemini pricing (April 2026):

| Operation | Model | Cost per call (typical) |
|-----------|-------|-------------------------|
| Problem generation | Gemini 2.5 Flash | ~$0.0015 (500 in, 500 out) |
| Self-verify | Gemini 2.5 Flash | ~$0.001 |
| Full Wolfram check (MCP) | Wolfram API | ~$0.002 (free tier: 2k/mo, then $5/mo Wolfram MCP subscription) |
| Error classification | Gemini 2.5 Flash-Lite | ~$0.0003 |
| Embedding (server) | gemini-embedding-001 | ~$0.00015 / 1K chars |
| Embedding (client) | transformers.js all-MiniLM | $0 (WASM, local) |
| Vision OCR | Gemini 2.5 Flash | ~$0.002 per image |
| Chat turn (grounded) | Gemini 2.5 Flash | ~$0.002 per turn |

**Key insight: A single well-cached, verified problem delivered 1000 times costs the same as generating it once — roughly $0.003 amortized to $0.000003 per delivery.**

The entire optimization is: **generate once, deliver many**.

### Where the money goes without caching

Assume 100 daily active users, 20 problems/day each, 3 tutor turns/day:
- Naive: 100 × 20 × $0.003 (gen + verify) + 100 × 3 × $0.002 = $6.60/day = **$200/mo**

### Where the money goes with this framework

Same usage, with 80% tier-0 hits, 15% tier-1, 4% tier-2, 1% tier-3:
- Tier 0: free (bundled)
- Tier 1: free (client embeddings + cached materials)
- Tier 2: 100 × 20 × 0.04 × $0.003 = $0.24/day
- Tier 3: 100 × 20 × 0.01 × $0.005 = $0.10/day
- Chat turns (unchanged): $0.60/day
- **Total: ~$28/mo — 86% reduction**

With batch API + context caching for generation, another 40-60% off tier 2-3.

---

## Part 2: Three-pipeline architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SCRAPE PIPELINE (offline)                    │
│                                                                   │
│  GATE PYQs (public)         OCW MIT/NPTEL lectures               │
│       │                            │                              │
│       │                            │                              │
│       ▼                            ▼                              │
│  Parsed → normalized → concept-tagged → bundle manifest          │
│                                                                   │
│  Target: 2,000 problems + 500 lecture chunks shipped as JSON     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    GENERATE PIPELINE (CI-time)                   │
│                                                                   │
│  For each (concept × difficulty) with <5 problems:               │
│    1. Gemini 2.5 Flash generates problem + solution              │
│    2. Self-verify via re-solve                                   │
│    3. Wolfram MCP verifies numerical answer                      │
│    4. If agreed → add to bundle                                  │
│                                                                   │
│  Runs in GitHub Actions. Batch API = 50% discount.               │
│  Growing the bundle 100 problems/day costs ~$0.50.               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  DELIVERY PIPELINE (runtime)                     │
│                                                                   │
│  Student request                                                 │
│       │                                                           │
│       ▼                                                           │
│  ┌─────────────────────────────┐                                 │
│  │ Tier 0: Exact match         │ ← bundle lookup by concept+diff │
│  │ (static JSON, zero cost)    │                                 │
│  └──────────┬──────────────────┘                                 │
│             │ miss                                                │
│             ▼                                                     │
│  ┌─────────────────────────────┐                                 │
│  │ Tier 1: RAG over bundle +   │ ← client-side embed + cosine    │
│  │  uploaded materials         │                                 │
│  └──────────┬──────────────────┘                                 │
│             │ miss                                                │
│             ▼                                                     │
│  ┌─────────────────────────────┐                                 │
│  │ Tier 2: Generate + verify   │ ← Gemini 2.5 Flash-Lite         │
│  │  (cache result in IDB)      │                                 │
│  └──────────┬──────────────────┘                                 │
│             │ low confidence                                      │
│             ▼                                                     │
│  ┌─────────────────────────────┐                                 │
│  │ Tier 3: Wolfram MCP verify  │ ← expensive but authoritative   │
│  └─────────────────────────────┘                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Scraping strategy (legal, verified sources)

### Safe public sources to scrape

| Source | Content | Licensing | Priority |
|--------|---------|-----------|----------|
| GATE official previous year papers | PYQ problems | Public domain (India government) | P0 |
| NPTEL (nptel.ac.in) | Problems in lectures, assignment PDFs | CC-BY-SA | P0 |
| MIT OCW (ocw.mit.edu) | Problem sets, lecture notes | CC-BY-NC-SA | P1 |
| GitHub open textbooks (e.g. openstax) | Math textbook chapters | CC-BY | P1 |
| arxiv.org expository content | Worked examples | Open | P2 |
| StackExchange math.se | Voted-clean problems + solutions | CC-BY-SA | P2 |

**Do not scrape:**
- GateAcademy, Made Easy, GateOverflow content (copyrighted)
- Paid course material
- User-identifiable content from forums

### Scraper design

A single Node script with polite rate limiting:
- 1 request/second per domain
- Respect robots.txt
- User-Agent: "GBrain Content Engine; contact=<email>"
- Store raw artifact + source URL + license + timestamp
- Parse into normalized schema, concept-tag via Gemini Flash-Lite (cheap), hand-review top-ranked results

### Concept tagging

For each scraped problem, a **single** Gemini Flash-Lite call (~$0.0003) classifies:
- `topic` → one of 10 topic buckets
- `concept_id` → one of 82 concepts from graph
- `difficulty` → 0..1 float
- `misconception_target` → which error type this problem targets (or null)

2000 problems × $0.0003 = **$0.60 one-time** to tag the entire scraped corpus.

---

## Part 4: Generation strategy (build-time, not runtime)

The existing `/api/gemini/generate-problem` endpoint generates at runtime. That's the expensive path. The fix:

**Move generation to CI.** GitHub Actions runs nightly, scans content gaps, generates 50-100 problems, commits them into `frontend/public/data/generated-bundle.json`. Students then pull from the CDN cache.

### Generator workflow

```
scan-gaps.ts          → list [concept × difficulty × error_type] with <5 problems
                         ordered by gate_frequency × marks_weight
    │
    ▼
generate-batch.ts     → for each gap (up to budget, default 100/night):
                         • Batch API call to Gemini 2.5 Flash (50% off)
                         • Parse into problem schema
                         • Store in work queue
    │
    ▼
verify-batch.ts       → for each generated:
                         • Re-solve via Gemini 2.5 Flash (independent call)
                         • If answers disagree → discard
                         • If agree → pass to Wolfram MCP for numerical check
                         • If Wolfram agrees → verified=true
                         • If Wolfram disagrees → save as "suspicious" for human review
    │
    ▼
merge-bundle.ts       → merge newly-verified problems into main bundle
                         (dedup by semantic similarity)
    │
    ▼
commit + push         → CDN serves new bundle on next deploy
```

### Cost projection

- Generate 100/night × 500 output tokens × $0.30/1M = **$0.015/night**
- Self-verify 100 × $0.0015 = **$0.15/night**
- Wolfram MCP: free tier 2k/mo covers it; at scale $5/mo flat
- **Total: ~$5/mo for a content bank that grows by 3000 verified problems/month**

---

## Part 5: Delivery — four-tier cascade

This is the runtime RAG equivalent. Every content request flows through these tiers.

### Tier 0 — Exact match in bundle (free, instant)

```typescript
function tryTier0(conceptId, difficulty): Problem | null {
  const cached = bundle.filter(p =>
    p.concept_id === conceptId &&
    Math.abs(p.difficulty - difficulty) < 0.15
  );
  return cached.length > 0 ? pickOne(cached) : null;
}
```

Hit rate after 3000 problems bundled: **~80% of requests**. Zero cost. Sub-10ms.

### Tier 1 — Semantic RAG (free, ~50ms)

If no exact match, find semantically close problems:

```typescript
async function tryTier1(query, conceptId, embedder): Problem | null {
  const qVec = await embedder.embed(query);
  // Search both bundle and uploaded materials
  const candidates = [
    ...bundle,
    ...await getUploadedChunks(),
  ];
  const scored = candidates
    .map(c => ({ item: c, score: cosine(qVec, c.embedding) }))
    .sort((a, b) => b.score - a.score);
  return scored[0].score > 0.75 ? scored[0].item : null;
}
```

Works for:
- Similar-topic problems when exact concept not in bundle
- Material-grounded queries ("explain the chain rule from my notes")
- Concept lookups ("what is an eigenvalue")

Hit rate on tier-0 miss: **~70%**. Still free. Uses client-side all-MiniLM.

### Tier 2 — Generate on demand (cheap, ~2s)

Only when tiers 0+1 fail. Call Gemini 2.5 Flash-Lite (not Flash — Flash-Lite is 3x cheaper and fine for this):

```typescript
async function tryTier2(conceptId, difficulty): Promise<Problem> {
  const problem = await fetch('/api/gemini/generate-problem', { ... });
  // Cache in IndexedDB for future tier-0 hits (same device)
  await saveGeneratedProblem(problem);
  return problem;
}
```

Per-call cost: ~$0.0005 with Flash-Lite. Result is cached locally so same student never pays twice.

### Tier 3 — Wolfram MCP verification (for high-stakes)

When correctness matters (mock exams, wrong-answer diagnosis):

```typescript
async function verifyWithWolfram(problem, answer): Promise<boolean> {
  const wolframResult = await wolframMCP.query(problem);
  return normalizeAnswer(wolframResult) === normalizeAnswer(answer);
}
```

Used for ~1% of content events. $5/mo flat with Wolfram MCP subscription.

---

## Part 6: Cost-reduction techniques beyond tiering

### A. Batch API (50% off)

All build-time generation uses Batch API:
- Submit jobs → 24h SLA → half price
- Content gap fill, bundle expansion, RAG seeding — all offline, all batched

### B. Context caching (90% off on prefixes)

System prompts for chat grounding are ~500 tokens and identical across requests:
```
"You are GBrain, a GATE Math tutor. Use LaTeX..." + [materials grounding]
```

Cache this prefix → reads cost 10% of normal rate. Applied to `/api/gemini/chat`.

### C. Model routing (12.5× savings on simple calls)

| Task | Current model | Recommended | Savings |
|------|--------------|-------------|---------|
| Error classification | Gemini 2.5 Flash | Gemini 2.5 Flash-Lite | 3x |
| Concept tagging (CI) | Gemini 2.5 Flash | Gemini 2.5 Flash-Lite | 3x |
| Vision OCR | Gemini 2.5 Flash | Keep Flash (needed for math) | — |
| Chat | Gemini 2.0 Flash | Gemini 2.5 Flash | quality++ |
| Problem generation | Gemini 2.0 Flash | Gemini 2.5 Flash-Lite | 3x |
| Self-verify | Gemini 2.0 Flash | Gemini 2.5 Flash | quality++ (matters here) |

Different tiers for different jobs.

### D. Fingerprint dedup

When scraping, problems are near-duplicates across sources. Fingerprint by:
- Normalized text (remove whitespace, LaTeX variants)
- First 5 tokens of answer
- If two problems hash to same bucket → keep highest-quality source

### E. Progressive enhancement

Show tier-0 content instantly while tier-2 generates in background. No spinner.

---

## Part 7: Wolfram MCP integration

Two integration modes:

### Mode A: Build-time verification (recommended, free-tier safe)

CI workflow calls Wolfram MCP to verify generated problems. The verification happens once per problem, stored in bundle. Students never hit Wolfram at runtime.

```yaml
# .github/workflows/content-engine.yml
- name: Verify batch via Wolfram MCP
  env:
    WOLFRAM_APP_ID: ${{ secrets.WOLFRAM_APP_ID }}
  run: npx tsx scripts/verify-via-wolfram.ts
```

### Mode B: On-demand verification for mock exams (subscription)

When a student submits a mock exam, Wolfram MCP cross-checks answers they got wrong. Only when correctness genuinely matters. Requires $5/mo Wolfram MCP subscription.

### Implementation

Use the simplest option — HTTP to Wolfram Alpha's Full Results API (what all the MCP servers wrap). No local MCP binary needed on Render:

```typescript
// src/services/wolfram-service.ts
export async function wolframSolve(query: string): Promise<{
  answer: string | null;
  steps: string[];
  confidence: number;
}> {
  const appId = process.env.WOLFRAM_APP_ID;
  const url = `https://api.wolframalpha.com/v2/query?appid=${appId}&input=${encodeURIComponent(query)}&output=json&podstate=Result__Step-by-step%20solution`;
  const res = await fetch(url);
  const data = await res.json();
  // Parse pods → extract result + steps
  return parseWolframResponse(data);
}
```

This gives us the moat (computationally verified problems) without the MCP client complexity on Render's Linux environment.

---

## Part 8: Interactive delivery (RAG-like, cost-minimal)

Beyond problems, students need **explanations that feel conversational but stay cheap**. Three patterns:

### Pattern 1: Pre-computed explainer library

For each of the 82 concepts, pre-generate at build-time:
- 1 canonical explanation (300 words)
- 3 worked examples (one per difficulty)
- 5 common misconceptions (linked to error types)

Total: 82 × (explanation + 3 examples + 5 misconceptions) = ~1000 artifacts. All generated once at build, bundled. Zero runtime cost.

### Pattern 2: Materials-first chat

Chat retrieval order:
1. **User's uploaded materials** (privacy, personalization)
2. **Bundled explainer library** (free, always available)
3. **Gemini Flash** (fallback, $0.002/turn)

This makes the tutor feel deeply personalized even when 90% of responses come from pre-computed content.

### Pattern 3: Progressive disclosure

Student asks "explain eigenvalues":
- Instant: canonical 2-sentence definition (from bundle)
- On tap "More": 300-word deep dive (from bundle)
- On tap "Example": 3 worked examples (from bundle)
- On tap "Still confused" → **only now** fires Gemini with reasoning trace

Most sessions never hit Gemini.

---

## Part 9: What I'm building now

Concrete files this implementation produces:

### Scripts
- `scripts/scrape-gate-pyqs.ts` — pull from public sources, emit to `data/raw/`
- `scripts/tag-corpus.ts` — Flash-Lite concept-tagging in batch
- `scripts/generate-gaps.ts` — CI generator, batch API
- `scripts/verify-wolfram.ts` — Wolfram Alpha Full Results API verification
- `scripts/build-explainers.ts` — pre-compute 82-concept explainer library
- `scripts/build-bundle.ts` — merge everything into `public/data/content-bundle.json`

### Server
- `src/services/wolfram-service.ts` — Wolfram Alpha client
- `src/api/content-routes.ts` — `/api/content/resolve` (tier cascade entry)
- Updates to `src/api/gemini-proxy.ts` — context caching support

### Client
- `frontend/src/lib/content/resolver.ts` — tier cascade runner
- `frontend/src/lib/content/explainer-store.ts` — offline explainer access
- Updates to `frontend/src/lib/gbrain/client.ts` — use resolver for problem fetching

### CI
- `.github/workflows/content-engine.yml` — nightly scrape + generate + verify

### Static bundle additions
- `frontend/public/data/explainers.json` — 82 concept explainers
- `frontend/public/data/content-bundle.json` — merged problem pool

---

## Part 10: Metrics and success criteria

Ship this successfully means:
- Tier 0+1 hit rate ≥ 85% within 30 days
- LLM cost per DAU ≤ $0.01/mo
- Wolfram calls ≤ 2k/mo (free tier)
- Bundle size ≤ 5 MB gzipped (acceptable first-load)
- P95 problem delivery latency ≤ 200ms
- Student-perceived freshness: new content visible within 24h of CI run

---

*Implementation begins in the next commit.*
