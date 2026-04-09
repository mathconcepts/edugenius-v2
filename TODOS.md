# TODOS

Tracked deferred work from /plan-eng-review + /plan-ceo-review + /plan-design-review.
Branch: docs/content-intelligence-v2
Updated: 2026-04-09

---

## 1. IVFFlat pgvector Index for RAG Scale

**What:** Add IVFFlat index to pgvector when RAG solution patterns exceed 100K.
**Why:** Brute-force cosine similarity is O(n). At 100K+ patterns, Tier 1 RAG lookup degrades from <50ms to 200ms+. IVFFlat reduces to O(sqrt(n)).
**Pros:** Prevents Tier 1 from becoming a latency bottleneck at scale.
**Cons:** Premature now — ~300 patterns month 1, maybe 5K by year 1.
**Context:** vector-store.ts already supports pgvector. IVFFlat is a `CREATE INDEX` + nlist tuning. 15-minute task when needed.
**Depends on:** RAG growing to 100K+ patterns (implies product-market fit).
**Priority:** Low | **Added:** 2026-03-24

---

## 2. ~~User Authentication (Supabase Auth)~~ + Freemium Gate

**Completed (Auth):** 2026-03-27 — Supabase Auth wired up with Google OAuth + email/password. JWT middleware (`auth-middleware.ts`), role-based access (student/teacher/admin), `user_profiles` table, session migration endpoint, login page, user avatar in header.

**Remaining (Freemium Gate):** Daily view limits not yet enforced. `daily_limits` table exists but no middleware checks on `/api/verify` or `/api/problems`. Needs: rate-limit middleware checking `daily_limits` table, different caps per role (anon: 3/day, student: 10/day, teacher: unlimited).
**Priority:** Medium | **Added:** 2026-03-24 | **Updated:** 2026-03-27

---

## 3. E2E Browser Tests (Playwright)

**What:** Add E2E tests for 3 critical user flows: practice flow (Home → topic → problem → answer → solution → progress), verification badge states (verified/AI-verified/unverified/pending), and Wolfram re-verification button.
**Why:** Unit tests can't catch frontend-backend integration failures (e.g., badge not updating after API response).
**Pros:** Catches the bugs that matter most — broken user journeys.
**Cons:** Requires Playwright setup (~30 min with CC). Slower CI runs.
**Context:** No E2E framework in project. Vitest is backend-only (environment: 'node'). Frontend has zero tests.
**Depends on:** Core implementation complete + app running locally.
**Priority:** Medium | **Added:** 2026-03-24

---

## 4. RAG Cold-Start Seeding Script

**What:** Script to pre-seed RAG with ~200-300 solution patterns from existing 30+ GATE PYQs in `supabase/seeds/gate_em_pyqs.sql`.
**Why:** Month 1 RAG hit rate ~40%. Pre-seeding from existing PYQs could boost to ~60-70%, cutting Wolfram costs from $0.60/mo to ~$0.30/mo.
**Pros:** Faster cost convergence, better UX from day 1 (more instant verifications).
**Cons:** One-time Wolfram cost ~$0.30 for 30 problems. Script runs once at deploy.
**Context:** gate_em_pyqs.sql has 30+ problems across Linear Algebra, Probability, Calculus. Each generates ~3-5 patterns. ~20 min with CC.
**Depends on:** TieredVerificationOrchestrator + RAG cache write working.
**Priority:** Medium | **Added:** 2026-03-24

---

## 5. Monitor Actual Tier Hit Rates (Month 1)

**What:** Instrument the TieredVerificationOrchestrator to log which tier handled each problem. Dashboard or weekly report showing: Tier 1 hit rate, Tier 2 agreement rate, Tier 3 call rate.
**Why:** The 1.5% Wolfram rate and 85% RAG hit rate are assumptions with no empirical basis. If Tier 2 disagreement is 15-30% (not assumed ~10%), Wolfram costs jump 10-20x. Still under $5/mo budget, but the cost model could be significantly off.
**Pros:** Real data replaces assumptions. Enables informed decisions about RAG threshold tuning and model selection.
**Cons:** None — this is logging, not new features. ~15 min with CC.
**Context:** Ops wing already tracks wolfram.called signals. Extend to track tier_1_hit, tier_2_agree, tier_2_disagree, tier_3_called as structured events.
**Depends on:** Core implementation deployed with real traffic.
**Priority:** High | **Added:** 2026-03-24

---

## 6. Latency Targets + Loading UX Per Tier

**What:** Define P95 latency targets per verification tier and add per-tier loading UX so students see progress, not a spinner.
**Why:** The 3-tier cascade can take 1s (RAG hit) to 30s (LLM timeout + Wolfram). For exam practice, 30s after answering is unacceptable. No latency target is currently defined.
**Pros:** Better UX, clear performance SLOs, Ops wing can alert on regressions.
**Cons:** Requires frontend loading state per tier (small effort). Targets need tuning with real data.
**Context:** Suggested targets: Tier 1 <500ms (pgvector search), Tier 2 <8s (parallel LLM), Tier 3 <15s (Wolfram API). Show: "Checking knowledge base..." → "Running verification..." → "Consulting Wolfram..." so the student knows what's happening.
**Depends on:** Core implementation + TODO #5 (real latency data).
**Priority:** High | **Added:** 2026-03-24

---

## 7. Phase 2 Trigger Criteria (Validation Gate)

**What:** Define explicit go/no-go criteria for building the full 5-wing architecture (Phase 2).
**Why:** Without clear criteria, you'll either build too early (wasting effort if validation fails) or too late (missing momentum). Pre-defining success removes emotional decision-making.
**Suggested criteria (meet ANY 2 of these within 2 weeks of bot launch):**
- >10 meaningful engagements (replies, shares, DMs) across 3 GATE Telegram groups
- >5 DMs asking for more problems or requesting specific topics
- Any organic group admin invitation to post regularly
- >3 group shares of a single problem post
**What "meaningful" means:** A reply that engages with the math (asks a question, provides an alternative solution, debates the approach) — not just "thanks" or emoji reactions.
**If criteria NOT met:** Pivot distribution channel (try Reddit, YouTube, or content-first SEO) before investing in product.
**Depends on:** Telegram MVP deployed + active posting in 3+ GATE groups.
**Priority:** Critical (gates all Phase 2 work) | **Added:** 2026-03-24

---

## 8. Evaluate SymPy as Tier 2 Verifier

**What:** Evaluate existing `src/verification/verifiers/sympy.ts` as a Tier 2 alternative or complement to LLM dual-solve for computational verification.
**Why:** SymPy is free, local, and deterministic for GATE math (eigenvalues, integrals, limits, differential equations). Could reduce both LLM costs and Wolfram calls. Identified by outside voice during CEO review.
**Pros:** $0 cost, faster than LLM (~100ms vs ~5s), no hallucination risk for supported problem types.
**Cons:** Doesn't cover all problem types (word problems, proofs, conceptual questions). Needs SymPy server or Python subprocess running.
**Context:** SymPy verifier already exists in codebase and is wired into the current VerificationEngine. Could run alongside LLM dual-solve: SymPy for computational, LLM for conceptual. Evaluate after launch using real tier hit rate data from TODO #5.
**Depends on:** Core implementation + TODO #5 (tier hit rate data to measure impact).
**Priority:** Medium | **Added:** 2026-03-25

---

## 9. Telegram Group Admin Outreach Strategy

**What:** Develop a structured approach for getting bot posting permission in GATE Telegram groups — admin outreach, value-first posting cadence, fallback channels.
**Why:** Most active Telegram groups moderate or ban promotional bots. Posting without permission risks getting banned and burning the primary distribution channel. Identified by outside voice during CEO review.
**Pros:** Higher success rate for distribution, avoids burning bridges with group admins, builds relationships.
**Cons:** Requires manual founder effort (not automatable). May delay distribution by 1-2 weeks.
**Context:** The design doc's "Assignment" was to manually post first and gauge reception. This formalizes that: (1) identify 5-10 active GATE EM groups, (2) observe for 1 week, (3) provide value manually (answer questions, share insights), (4) approach admins with a proposal ("I can post daily verified problems — interested?"), (5) fallback: create own group, seed from Reddit/YouTube.
**Depends on:** Telegram bot working.
**Blocked by:** Nothing.
**Priority:** High | **Added:** 2026-03-25

---

## 10. ContentResolver Class for T4/T5 Paid Tiers

**What:** Build a ContentResolver class with 5-tier cascade (T1-T5) including Wolfram REST (T4) and Gemini generation (T5) with budget caps and write-back.
**Why:** Current content pipeline ships T1-T3 only (all $0). When real traffic data shows T1-T3 miss rate > 20%, paid tiers become necessary for content coverage.
**Pros:** Clean architecture for multi-tier resolution with observability, budget caps, and self-warming cache (T5 writes back to rag_cache).
**Cons:** Only needed when real users exist and miss rates are measured. Overbuilt until then.
**Context:** Codex outside voice correctly identified ContentResolver was overbuilt for T1-T3. The abstraction earns its keep when budget caps, Wolfram Language queries, and LLM generation enter the picture. Pattern: follow tiered-orchestrator.ts cascade structure.
**Depends on:** TODO #5 (tier hit rate data) showing T1-T3 miss rate > 20%.
**Priority:** Medium | **Added:** 2026-04-02

---

## 11. Learning Objectives System

**What:** Static GATE learning objectives (~80 LOs across 10 topics) with Bloom's taxonomy levels, GATE frequency, keyword matching, and tagging of pyq_questions with LO IDs.
**Why:** Enables LO-targeted content generation when T4/T5 ship. Also enables "study topic X at apply level" precision in commander tasks.
**Pros:** Foundation for precision content delivery. Makes the pipeline smarter about what to generate vs retrieve.
**Cons:** Maintenance cost of 80 static LOs. Nothing consumes LOs until T4/T5 or commander upgrades to LO-level tasks.
**Context:** User originally requested LO alignment. Deferred during eng review because nothing in the product currently operates at LO granularity (commander, SR, chat, notebook, progress, flywheel all work at topic level).
**Depends on:** TODO #10 (ContentResolver class) or commander upgrade to LO-level tasks.
**Priority:** Medium | **Added:** 2026-04-02

---

## 12. Evaluate Removing Topic Grid After Validation

**What:** After validation data, evaluate removing topic grid entirely for all users.
**Why:** If One Thing mode shows >30% Day-3 retention, topic grid is unnecessary complexity.
**Effort:** S (human: ~1 day / CC: ~15 min)
**Depends on:** Real user data from Telegram validation.
**Priority:** Low | **Added:** 2026-04-09

---

## 13. Auto-Mark Task on Return from Practice

**What:** When student returns from `/practice/:pyqId` to home, auto-mark the task as done and show inline rating pills instead of requiring manual "Done" tap.
**Why:** Reduces friction in progressive disclosure flow. Student already demonstrated completion by doing the problem.
**Effort:** S (human: ~2 hours / CC: ~10 min)
**Depends on:** One Thing Mode shipped + practice page completion detection.
**Priority:** Medium | **Added:** 2026-04-09
