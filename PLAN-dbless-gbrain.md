# PLAN: DB-less GBrain — Local-First Architecture

> **Status:** Planning only. No code changes in this document.
> **Date:** 2026-04-19
> **Author:** GBrain architecture review

---

## TL;DR

**Yes, it is fully possible** to run this project without Postgres. The shift is from
a server-database model to a **local-first, static-knowledge** model:

- **Static knowledge** (concept graph, PYQ bank, seed RAG bundle) → bundled as JSON assets
- **Per-student state** (cognitive model, error log, attempts) → IndexedDB on device
- **Shared intelligence** (LLM calls, embedding, verification) → stateless edge functions
- **Uploaded materials** → parsed, embedded, stored in IndexedDB — never leaves the device

All 6 GBrain pillars continue to work. Only two features degrade meaningfully:
**cohort analysis** and **misconception mining** lose their population-level data unless
we add opt-in anonymous aggregation (recommended as Phase 6).

**What this unlocks:**
- Infra cost drops from ~$14/mo to near-zero (LLM calls only)
- App works offline after first load
- Student materials become first-class citizens (privacy win)
- Zero-friction install: no signup wall, no account required
- Scales to infinite users without DB scaling concerns

**What we lose:**
- Cross-device sync without optional cloud backup
- Cohort analytics (unless opt-in)
- Cron-driven batch operations (become on-demand or manual)
- The current admin dashboard's cohort tab

**Recommendation:** Implement in 6 phases over ~3-4 weeks. Ship as a mode alongside
existing DB mode, then gradually make IndexedDB the default.

---

## Part 1: Current DB Dependency Inventory

The project currently has **24 tables** across 11 migrations. Let me classify them by
whether they're essential to GBrain's core function.

### Tier 1 — Per-student state (moves to IndexedDB)

| Table | Purpose | Size estimate per student | Move to |
|-------|---------|---------------------------|---------|
| `student_model` | 15-attribute cognitive profile | ~5 KB | IndexedDB |
| `error_log` | Classified errors | ~50 KB (1000 errors) | IndexedDB |
| `confidence_log` | Confidence-correctness pairs | ~30 KB | IndexedDB |
| `task_reasoner_log` | Decision audit trail | ~100 KB (can be pruned) | IndexedDB |
| `sr_sessions` | Spaced repetition state | ~20 KB | IndexedDB |
| `chat_messages` | Tutor chat history | ~200 KB (rolling window) | IndexedDB |
| `notebook_entries` | Auto-captured notes | ~50 KB | IndexedDB |
| `streaks` | Engagement tracking | <1 KB | IndexedDB |

**Total per student: ~500 KB** — comfortably fits in IndexedDB (browsers allow 50 MB–unlimited).

### Tier 2 — Shared static data (moves to bundled JSON)

| Table | Purpose | Static? | Move to |
|-------|---------|---------|---------|
| `concept_graph` | 82 concepts, metadata | ✅ already in `src/constants/concept-graph.ts` | DELETE — redundant |
| `concept_edges` | 112 prerequisite edges | ✅ already in code | DELETE — redundant |
| `pyq_questions` | PYQ bank (currently 12, target ~500) | ✅ rarely changes | `public/data/pyq.json` |
| `generated_problems` | Cache of Gemini-generated, verified problems | ⚠️ grows but can be snapshotted | `public/data/seed-problems.json` + client cache |
| `rag_cache` | Problem embeddings for Tier 1 verification | ⚠️ grows but snapshottable | `public/data/rag-bundle.json` + client cache |

### Tier 3 — Infrastructure (drop or move)

| Table | Purpose | Fate |
|-------|---------|------|
| `_migrations` | Migration tracking | Delete — no migrations needed |
| `verification_log` | Verification cascade audit | Keep as optional telemetry (opt-in) or drop |
| `content_pipeline_log` | Chat grounding logs | Drop |
| `daily_limits` | Rate limiting | Move to edge function (KV or cookie) |
| `analytics_events` | Funnel tracking | Use PostHog/Plausible instead |
| `seo_pages`, `blog_posts`, `social_content` | Content marketing | Render from markdown files at build time |
| `documents`, `document_chunks` | Uploaded content | IndexedDB (per-student, see Part 5) |
| `user_profiles` | Auth/role | Only needed if accounts exist — use Supabase `auth.users` directly |
| `push_subscriptions`, `email_queue` | Notifications | Defer; use Resend API directly when needed |

### Tier 4 — Admin/cohort (breaking change)

These tables power features that fundamentally require aggregation across all students:

| Feature | Current DB behavior | DB-less alternative |
|---------|---------------------|---------------------|
| Cohort analysis | `SELECT COUNT(*) FROM student_model GROUP BY motivation_state` | **Opt-in anonymous aggregation** (see Phase 6) |
| Misconception mining | `SELECT misconception_id, COUNT(*) FROM error_log` | Same — opt-in |
| Content gap detection | Count of `generated_problems` per concept | Based on **shipped bundle** instead of live queries |
| Health checks | Row counts + latency | Simpler — just version checks + Gemini ping |

---

## Part 2: Proposed Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  CLIENT (Browser / Mobile)                                    │
│                                                                │
│  ┌─────────────────────┐  ┌──────────────────────────────┐   │
│  │  React UI           │  │  IndexedDB (local-first)     │   │
│  │  • PracticePage     │  │  • student_model             │   │
│  │  • StudentAuditPage │←→│  • error_log                 │   │
│  │  • MockExamPage     │  │  • attempts                  │   │
│  │  • ChatPage         │  │  • uploaded_materials        │   │
│  │  • MarketingLanding │  │  • uploaded_embeddings       │   │
│  └──────────┬──────────┘  └──────────────────────────────┘   │
│             │                                                  │
│             │             ┌──────────────────────────────┐   │
│             │             │  Static Assets (bundled)     │   │
│             │             │  • concept-graph.json        │   │
│             ├─────────────┤  • pyq-bank.json             │   │
│             │             │  • rag-seed.json (500 probs) │   │
│             │             │  • blog/*.md                 │   │
│             │             └──────────────────────────────┘   │
│             │                                                  │
│             │             ┌──────────────────────────────┐   │
│             │             │  transformers.js (WASM)      │   │
│             │             │  • all-MiniLM-L6-v2 (384d)   │   │
│             │             │  • embeds uploaded materials │   │
│             │             │  • embeds student queries    │   │
│             │             └──────────────────────────────┘   │
│             │                                                  │
└─────────────┼──────────────────────────────────────────────────┘
              │                                                   
              │  HTTPS (stateless)                                
              ↓                                                   
┌──────────────────────────────────────────────────────────────┐
│  EDGE FUNCTION (Cloudflare Worker / Vercel Edge / Render)     │
│                                                                │
│  • POST /api/problem/generate   → proxy to Gemini             │
│  • POST /api/problem/verify      → proxy to Gemini + Wolfram  │
│  • POST /api/error/classify      → proxy to Gemini            │
│  • POST /api/chat                → SSE proxy to Gemini        │
│                                                                │
│  NO DATABASE. NO PERSISTENCE. Pure computation.                │
└──────────────────────────────────────────────────────────────┘
```

**Key design principles:**

1. **Client owns the truth.** Student state never leaves the device unless the user
   explicitly exports or cloud-syncs.
2. **Server is stateless.** Every request is independent. Any edge function works.
3. **Static knowledge is bundled.** The concept graph, PYQ bank, and seed RAG travel
   with the app. Instant load after install.
4. **Uploaded materials are private by architecture.** Parsed + embedded + stored
   client-side. Server never sees them.

---

## Part 3: GBrain Pillar Viability Matrix

| Pillar | Current impl | DB-less viable? | Changes needed |
|--------|--------------|-----------------|----------------|
| **1. Student Model** | Postgres `student_model` table, Bayesian updates | ✅ **Yes** | Wrap CRUD in a `StudentStore` interface; add `IndexedDBStudentStore` impl. |
| **2. Error Taxonomy** | Gemini classifier + Postgres `error_log` | ✅ **Yes** | Classifier unchanged (stateless); log goes to IndexedDB. Weekly reports aggregate client-side. |
| **3. Concept Graph** | Static in `concept-graph.ts` + redundant `concept_graph` table | ✅ **Already works** | Delete the table + migration entries. Concept graph is already pure TS. |
| **4. Problem Generator** | Gemini gen + self-verify + Postgres cache | ✅ **Yes** | Ship seed cache as JSON; new gens cache in IndexedDB per-student. Public verified pool grows via opt-in contribution (Phase 6). |
| **5. Exam Strategy** | Pure computation from student model | ✅ **Already works** | Zero changes — it's already math over the model. |
| **6. Task Reasoner** | 5-node decision tree + Gemini | ✅ **Yes** | Works as-is; reads student model from whatever store. Decision log to IndexedDB. |

**Verdict: All 6 pillars work without Postgres.** The only work is abstracting the data
layer so swaps are transparent to the pillars.

---

## Part 4: RAG Strategy Without pgvector

This is the most interesting technical problem. Currently:

- Gemini embedding: **3072 dimensions**
- Stored in `rag_cache` table with `vector(3072)` column
- Used for Tier 1 verification: cosine similarity over embeddings

Without pgvector, we have three viable options.

### Option A — Ship pre-computed RAG bundle (recommended for Phase 1)

**Approach:**
1. Pre-generate embeddings for the ~500 PYQs + seed verified problems
2. Export as `public/data/rag-bundle.json` containing `[{problem, answer, topic, embedding}]`
3. On app init, load into memory (or IndexedDB)
4. Linear-scan cosine similarity in JS (fast for <5K entries)

**Numbers:**
- 500 problems × 3072 floats × 4 bytes = **6 MB** (gzips to ~2 MB)
- Linear scan: ~10 ms in JS for 500 items
- Works offline after first load

**Pros:**
- Simplest to implement
- Works with existing embedding dimension
- Verified content bundled with the app — high trust

**Cons:**
- Static — doesn't grow unless we ship updates
- 6 MB asset (acceptable once, painful to refresh)

**Recommendation: Start here.**

### Option B — Client-side embeddings via transformers.js

**Approach:**
1. Use `@xenova/transformers` (ONNX/WASM) to run `all-MiniLM-L6-v2` in browser
2. Embedding dim: 384 (not 3072 — 8× smaller)
3. Embed queries + uploaded materials client-side
4. For pre-existing PYQ bank: ship **re-embedded** bundle at 384-dim

**Numbers:**
- 500 problems × 384 × 4 = **768 KB** (10× smaller than Option A)
- Model download: ~22 MB one-time (cached by browser)
- First embed: ~500 ms cold, ~50 ms warm
- Upload processing: ~1 sec for a 20-page PDF

**Pros:**
- Unlocks embedding on the fly (critical for **student-uploaded materials**)
- Smaller bundles scale better (can ship 5000 problems)
- Zero embedding API cost

**Cons:**
- Lower-quality embeddings than Gemini 3072-dim
- ~22 MB one-time model download
- More complex setup

**Recommendation: Adopt in Phase 3 once materials upload is live.**

### Option C — Skip RAG, always use Tier 2 (LLM verification)

**Approach:**
- Don't pre-check similarity
- Every verification hits Gemini 2.5 Flash directly
- Cost: ~$0.0002 per verification

**Pros:**
- Zero RAG infrastructure
- Always fresh

**Cons:**
- 10–50× slower (300–1500 ms vs 10 ms)
- Cost scales linearly with usage
- Burns Gemini quota

**Verdict: Do not recommend** except as emergency fallback.

### Recommendation Summary

| Phase | Strategy | Why |
|-------|----------|-----|
| 1–2 (MVP) | Option A — ship 3072-dim bundle | Fastest ship, preserves quality |
| 3+ | Option B — transformers.js | Unlocks student uploads, scales infinitely |
| Fallback | Option C — Tier 2 only | Used if both cache miss |

**All three can coexist.** Use Option A for bundled PYQs, Option B for uploaded materials,
Option C as final fallback.

---

## Part 5: Student-Uploaded Materials (NEW feature)

This fits **perfectly** into the DB-less architecture because uploaded materials are
inherently per-student and privacy-sensitive.

### Use cases

1. **Upload lecture notes (PDF)** → ground the AI tutor in student's actual coursework
2. **Upload textbook chapter** → generate problems in that textbook's style/notation
3. **Upload handwritten solution (image)** → classify errors via vision
4. **Upload past mock exam paper** → use as calibrated practice
5. **Upload syllabus** → tailor exam strategy to specific curriculum

### Upload pipeline

```
Student selects file
     │
     ├─ PDF           → pdfjs-dist extracts text per page
     ├─ DOCX          → mammoth.js extracts text
     ├─ Image (notes) → Gemini Vision OCR (server proxy, one-shot)
     ├─ Image (work)  → Gemini Vision classifies → error taxonomy
     └─ Markdown/TXT  → read directly
     │
     ▼
Text extracted → chunked (500-800 tokens)
     │
     ▼
Each chunk → transformers.js embedding (384-dim, client-side)
     │
     ▼
Stored in IndexedDB:
  materials:    { id, filename, type, uploaded_at }
  chunks:       { material_id, seq, text, topic, concepts }
  embeddings:   { chunk_id, vector: Float32Array(384) }
```

### Retrieval pipeline (during chat/practice)

```
Student asks a question
     │
     ▼
Embed query (transformers.js, ~50ms)
     │
     ├─ Search PYQ bundle embeddings (cosine, top-K)
     └─ Search uploaded material embeddings (cosine, top-K)
     │
     ▼
Combine top chunks into grounding context
     │
     ▼
Send to Gemini along with Task Reasoner instructions
```

### New IndexedDB stores (schema)

```typescript
interface MaterialsDB extends DBSchema {
  materials: {
    key: string; // uuid
    value: {
      id: string;
      filename: string;
      type: 'pdf' | 'docx' | 'md' | 'image-notes' | 'image-work' | 'image-exam';
      uploaded_at: string;
      size_bytes: number;
      page_count?: number;
      detected_topic?: string;
    };
  };
  chunks: {
    key: string;
    value: {
      id: string;
      material_id: string;
      seq: number;
      text: string;
      topic_guess?: string;
      concepts_guess?: string[]; // matched against CONCEPT_MAP
      page?: number;
    };
    indexes: { 'by-material': string };
  };
  embeddings: {
    key: string; // chunk_id
    value: {
      chunk_id: string;
      dim: number;
      vector: Float32Array;
    };
  };
}
```

### Privacy guarantee

- Uploaded files are parsed in-browser
- Text extraction happens client-side (pdfjs-dist, mammoth.js)
- Embeddings generated client-side (transformers.js)
- Storage is IndexedDB, origin-isolated
- **Only** chunks that the student explicitly asks about get sent to Gemini as grounding
- Vision OCR for handwritten images is the ONE operation that touches the server — make
  this clear in UI copy

### Grounding UX

On any chat or practice screen, a subtle indicator shows "grounded in: [Chapter 3 notes, Mock Exam 2022]".
Students can toggle materials on/off per session.

---

## Part 6: Implementation Phases

### Phase 1: Data layer abstraction (Week 1, ~3 days)

**Goal:** Introduce a `StudentStore` interface so pillars don't care about storage.

```typescript
interface StudentStore {
  getModel(sessionId: string): Promise<StudentModel>;
  saveModel(model: StudentModel): Promise<void>;
  logError(sessionId: string, error: ErrorDiagnosis, ctx: ErrorContext): Promise<void>;
  getErrorReport(sessionId: string, days: number): Promise<ErrorPatternReport>;
  logAttempt(sessionId: string, attempt: Attempt): Promise<void>;
  // ... etc
}

class PostgresStudentStore implements StudentStore { /* current code */ }
class IndexedDBStudentStore implements StudentStore { /* new */ }
```

**Deliverable:** Current Postgres code runs unchanged through the new interface.

### Phase 2: IndexedDB implementation (Week 1, ~4 days)

**Goal:** Functional parity of `StudentStore` on IndexedDB.

- Port all 10 MOAT operations to work against the interface
- Add a `.env` flag: `STORAGE_MODE=postgres|indexeddb|auto`
- On browser: `auto` picks IndexedDB for logged-out, Postgres for logged-in (transitional)

**Deliverable:** Anonymous users can use the full app with zero server state.

### Phase 3: Static knowledge bundles (Week 2, ~3 days)

**Goal:** Ship PYQ bank + RAG seed + concept graph as static JSON.

- Build a script: `npm run build:bundles` → reads from Postgres, writes to `public/data/`
- PYQ bank: `public/data/pyq-bank.json` (~500 problems, ~2 MB uncompressed)
- Seed RAG: `public/data/rag-seed.json` (500 × 3072-dim embeddings, ~6 MB → ~2 MB gzipped)
- Concept graph: already in code, just remove the redundant DB migration

**Deliverable:** First-time app load downloads bundles, then works without any DB query
for known content.

### Phase 4: Stateless edge server (Week 2, ~2 days)

**Goal:** Slim the backend to a pure LLM proxy.

- Strip all routes except Gemini-proxy endpoints
- Remove Postgres connection, migration runner, pgvector setup
- Deploy as Cloudflare Worker (free tier: 100k requests/day) or Vercel Edge Function
- Keep Render instance around for DB-mode users during transition

**Deliverable:** Production cost drops from ~$14/mo to ~$0 (free tiers only).

### Phase 5: Client-side embeddings (Week 3, ~4 days)

**Goal:** Enable on-the-fly embedding for uploaded materials.

- Add `@xenova/transformers` dependency
- Lazy-load `all-MiniLM-L6-v2` on first upload
- Re-embed PYQ bundle at 384-dim (keep 3072-dim as optional)
- Add similarity search utility (cosine, heap-based top-K)

**Deliverable:** Students can ask "explain this chapter" about uploaded material.

### Phase 6: Student materials UX (Week 3, ~4 days)

**Goal:** Full upload + ground-in-chat UX.

- Upload drop zone in Settings (supports PDF, DOCX, MD, images)
- Parse + embed pipeline (progress bar)
- Materials library page (list, preview, delete)
- Grounding toggle in chat/practice ("grounded in: [materials]")
- Per-material analytics: which questions used it, mastery it helped build

**Deliverable:** Headline marketing claim — "your AI tutor learns from your materials."

### Phase 7 (optional): Opt-in anonymous aggregation (Week 4, ~3 days)

**Goal:** Restore cohort analysis without re-introducing DB dependency.

- Add setting: "Help improve GBrain by sharing anonymous aggregate stats (default: off)"
- If enabled, periodic tiny POST to `/api/aggregate` with:
  - `{concept: 'eigenvalues', error_type: 'conceptual', count: 3}` — no PII
- Server aggregates in Cloudflare KV or a tiny SQLite file
- Exposes a read-only `/api/cohort` endpoint (admin)

**Deliverable:** Misconception miner + cohort analysis work again, with user consent.

---

## Part 7: Trade-offs

### What we gain

| Gain | Magnitude |
|------|-----------|
| **Infra cost** | ~$14/mo → ~$0 (Cloudflare free tier) |
| **Latency** | RAG query: 50 ms network → 10 ms local; student model read: 20 ms → 2 ms |
| **Privacy** | Materials never leave device; student state never hits server unless user opts in |
| **Offline mode** | Works without internet after first load (no LLM calls, but static content + cached state) |
| **Scale** | Infinite users at constant cost — no DB to scale |
| **Bootstrap speed** | No signup wall; anonymous users get full personalization instantly |
| **New feature (materials)** | Architecturally clean, not bolted on |

### What we lose

| Loss | Mitigation |
|------|-----------|
| **Cross-device sync** | Optional cloud backup via Supabase Auth + single `snapshots` table (opt-in) |
| **Cohort analysis** | Opt-in anonymous aggregation (Phase 7) |
| **Misconception mining** | Same as above |
| **Cron-driven nightly refresh** | Make it a service worker that runs on next app open |
| **Server-side verification sweep** | Becomes a build-time process over shipped bundles |
| **Admin dashboard cohort tab** | Shows only aggregated opt-in data; disable when no data |

### What stays the same

- All 6 GBrain pillars
- Task Reasoner layered prompts
- Error classification quality (uses same Gemini)
- Problem generation quality (uses same Gemini)
- All 10 MOAT skills (most become fully client-side)
- The entire marketing story
- The admin dashboard (health tab stays; content-gap tab works on bundled data)

---

## Part 8: Migration Path (zero-downtime)

### Current → target, safely

The goal is to avoid a big-bang rewrite. Instead:

1. **Dual-mode from day 1** — Ship the `StorageMode` flag. Existing Postgres users stay
   on Postgres. New users default to IndexedDB.
2. **Feature parity testing** — Both modes run the same test suite. CI gates on both.
3. **Gradual rollout** — Progressively enable IndexedDB-first for anonymous users, then
   authenticated users.
4. **Data export/import** — Before DB mode goes away, give Postgres-mode users a
   "Download my data" button that produces an importable JSON.
5. **Deprecation notice** — Give DB-mode users 90 days to export/import.
6. **Archive DB mode** — Keep PostgresStudentStore code for one more release, then remove.

### Rollback

If anything breaks:
- Keep the Postgres server running for 60 days post-switch
- Feature flag can be flipped back per-user
- Student data lives in Supabase Auth metadata + optional snapshot table, so no data loss

---

## Part 9: Open questions for decision

These need your input before implementation starts:

### 1. Cohort analysis — sacrifice or preserve?

- **Option A:** Ship DB-less MVP without cohort tab. Re-add in Phase 7 via opt-in.
- **Option B:** Keep a minimal Postgres instance just for anonymous aggregates. Costs $7/mo.
- **Recommendation:** A. The misconception miner payoff is real but not Day-1 critical.

### 2. Embedding strategy — all-MiniLM or stay on Gemini?

- **Option A:** Ship Gemini 3072-dim (Option A in Part 4). Re-embedding later for uploads.
- **Option B:** Go straight to all-MiniLM 384-dim for everything. Smaller, faster, but lower quality.
- **Recommendation:** A for Phase 1, switch to B in Phase 5 when uploads ship.

### 3. Auth — fully anonymous or Supabase Auth?

- **Option A:** Fully anonymous. Session ID in IndexedDB. No email. Export/import is the only "sync."
- **Option B:** Optional Supabase Auth for cross-device sync. User chooses.
- **Recommendation:** B. Makes retention much easier (email for weekly digests).

### 4. Uploaded materials privacy boundary — client-only or hybrid?

- **Option A:** Strictly client-side. Handwritten images can't be OCR'd (no server vision).
- **Option B:** Client-side storage + embedding, but Gemini Vision proxy for images only.
- **Recommendation:** B. Vision is Gemini's strength; disclose clearly in UI.

### 5. Pricing model implications?

A DB-less architecture has essentially zero marginal cost per user. LLM API is the only cost.
This means:

- Free tier generous by default (say 100 Gemini calls/day)
- Paid tier unlocks unlimited Gemini + handwritten vision + cloud backup
- No "seats" model needed — scales naturally

**Decision needed:** Do you want to change the pricing model?

---

## Part 10: Recommended next actions

If you want to proceed:

1. **Approve the plan** — respond with any changes
2. **Decide the 5 open questions** above
3. **I start Phase 1** — data layer abstraction (non-breaking, safe)
4. **Review Phase 1 PR** — both modes run in parallel
5. **Decide on timing for phases 2-6**

If you want to pivot or split:

- **Just student materials (no DB removal):** 1 week, builds on existing infra
- **Just DB removal (no materials):** 2 weeks, preserves current feature set
- **Full plan:** ~3-4 weeks to Phase 6, ~5 weeks with Phase 7

---

## Appendix: What "full functionality via GBrain features" looks like

The question asked which GBrain features realize full functionality. Mapping:

| Project goal | GBrain pillar that delivers it | Works DB-less? |
|--------------|-------------------------------|----------------|
| Personalized difficulty calibration | Pillar 1 (student model) + Pillar 4 (gen) | ✅ |
| "Why did I get it wrong?" explanations | Pillar 2 (error taxonomy) | ✅ |
| Foundation-gap detection | Pillar 3 (concept graph) + Pillar 1 | ✅ |
| Infinite fresh practice | Pillar 4 (adaptive gen) | ✅ |
| Exam-day strategy | Pillar 5 (exam optimizer) | ✅ |
| Smart AI tutor that adapts | Pillar 6 (task reasoner) + Pillar 1 | ✅ |
| Grounded in your materials | **NEW: Student materials pipeline** | ✅ only in DB-less |
| Cohort insights (admin) | MOAT operations — cohort, miner | ⚠️ requires opt-in aggregation |
| Health observability | MOAT operation — health | ✅ simpler version |
| Content bank growth | MOAT operations — content-gap, seed-rag, verify-sweep | ⚠️ becomes build-time |

**Bottom line:** All core student-facing functionality works in the DB-less architecture.
Admin/content-pipeline features need rework but aren't user-facing blockers.

---

*End of plan. Reply with decisions on the 5 open questions, or "approve & start Phase 1" to begin.*
