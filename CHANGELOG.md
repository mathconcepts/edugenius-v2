# Changelog

All notable changes to GATE Math are documented here.

## [2.1.0-beta] — 2026-04-19

### 🗄️ DB-less GBrain (major architecture shift)

Transforms the runtime from server-DB to **local-first with stateless edge proxy**.
All student state lives in IndexedDB on-device. Static knowledge ships as JSON bundles.
Server becomes a pure LLM/vision/embedding relay with zero persistence.

Introduces **student-uploaded materials** as a first-class feature — the headline use
case for the new architecture. Privacy-first: materials are parsed, embedded, and stored
entirely client-side.

### Added

**Pure-function GBrain core**
- `src/gbrain/gbrain-core.ts` — pure Bayesian updates, mastery aggregation, ZPD selection,
  exam strategy computation, task reasoner — all side-effect-free. Runs on server or client.
- `frontend/src/lib/gbrain/core.ts` — async mirror for browser (loads concept graph lazily).

**Client-side IndexedDB store** (`frontend/src/lib/gbrain/db.ts`)
- 8 object stores: student, errors, attempts, confidence, materials, chunks, embeddings, generated
- Full CRUD + indexes (by-session, by-concept, by-date, by-material, by-source)
- Cosine similarity search over embeddings
- Export/import JSON for backup/restore

**Client-side embeddings** (`frontend/src/lib/gbrain/embedder.ts`)
- `@xenova/transformers` wrapper for `all-MiniLM-L6-v2` (384-dim)
- Lazy-loaded (~22 MB one-time, browser-cached)
- First embed ~500 ms cold, ~50 ms warm

**Materials parsing pipeline** (`frontend/src/lib/gbrain/materials.ts`)
- PDF parser via pdfjs-dist
- DOCX parser via mammoth
- Markdown/TXT direct
- Image OCR via Gemini Vision proxy (`/api/gemini/vision-ocr`)
- Chunking (~500 words with sentence overlap)
- Full ingestion: parse → chunk → embed → persist

**Static knowledge bundles** (`frontend/public/data/`)
- `concept-graph.json` — 82 concepts + prerequisites (generated from `ALL_CONCEPTS`)
- `pyq-bank.json` — 12 seed PYQs (extensible from DB via `scripts/export-bundles.ts`)
- Build script: `npx tsx scripts/export-bundles.ts` (CI-ready)

**Stateless Gemini proxy** (`src/api/gemini-proxy.ts`)
- `POST /api/gemini/classify-error` — error classification, no DB
- `POST /api/gemini/generate-problem` — generate + self-verify
- `POST /api/gemini/embed` — server-side embedding (fallback)
- `POST /api/gemini/vision-ocr` — OCR handwritten images
- `POST /api/gemini/chat` — SSE stream with grounding
- Graceful fallback when `GEMINI_API_KEY` is absent
- Zero database. Zero persistence. Portable to any edge runtime.

**Client GBrain controller** (`frontend/src/lib/gbrain/client.ts`)
- `recordAttempt()` — full pipeline: Bayesian update + classify + log, all client-side
- `getExamStrategy()` — instant from local model
- `getErrorReport()` — client-side aggregation over IndexedDB
- `generateProblemClient()` — with local cache
- `streamGroundedChat()` — retrieves top-K material chunks, streams Gemini with grounding

**Materials UX** (`frontend/src/pages/gate/MaterialsPage.tsx`, route `/materials`)
- Drag-drop upload (PDF, DOCX, MD, TXT, images)
- Live progress bar (parse → chunk → embed)
- Materials library with chunk counts
- Privacy banner, grounding indicator
- Delete with confirmation (cleans up chunks + embeddings)

**Concept loader** (`frontend/src/lib/gbrain/concept-loader.ts`)
- Lazy-loads concept graph JSON
- `getAllConcepts()`, `getConcept(id)`, `getConceptsForTopicClient(topic)`
- Client-side `traceWeakestPrerequisiteClient()` for prereq repair

### Changed
- `src/gate-server.ts` — registers new `geminiProxyRoutes` alongside existing gbrain routes
- `frontend/src/App.tsx` — `/materials` route added
- `frontend/src/pages/gate/ProgressPage.tsx` — "Your Materials" link at top of GBrain section
- `frontend/package.json` — added `mammoth`, `@xenova/transformers`

### Architecture
- Existing DB-mode endpoints remain fully functional (backward compat)
- IndexedDB mode runs in parallel as opt-in
- No migration required; new users auto-get IndexedDB on browsers, logged-in users keep DB

### Deferred to Phase 7
- Opt-in anonymous cohort aggregation
- Fully removing Postgres from production server
- Re-embedding PYQ bundle at 384-dim (currently 3072-dim from Gemini)

---

## [2.0.0] - 2026-04-19

### 🧠 GBrain Cognitive Architecture — Major Release

Transforms EduGenius from a practice app into a cognitive learning platform. GBrain is a 6-pillar architecture that models how a student thinks, not just what they answer.

### Added — Backend Cognitive Architecture (~2,878 LOC)
- **Pillar 1: Student Model v2** — 15-attribute live profile (mastery vector, speed profile, cognitive style, abstraction comfort, working memory, motivation state, confidence calibration, frustration threshold, exam strategy). Bayesian updates on every attempt.
- **Pillar 2: Error Taxonomy** — 7-type classifier (conceptual/procedural/notation/misread/time-pressure/arithmetic/overconfidence-skip) with Gemini-powered misconception explanations and corrective problem generation.
- **Pillar 3: Concept Graph** — 82 GATE concepts organized as a prerequisite DAG with 112 edges. `traceWeakestPrerequisite()` auto-routes foundation repair.
- **Pillar 4: Adaptive Problem Generator** — Infinite calibrated practice targeting specific (concept × error-type × difficulty) gaps. Self-verified, cached.
- **Pillar 5: Exam Strategy Optimizer** — Personalized playbooks: attempt order, time budgets, confidence-calibrated skip threshold, score maximization planner.
- **Pillar 6: Task Reasoner (Layer 2)** — 5-node decision tree (intent → action → difficulty → format → verification) runs before every chat completion.
- **Migration 011** — 7 new tables, auto-applies on server startup.

### Added — MOAT Operations (~970 LOC)
- `/api/gbrain/audit/:sessionId` — 360° student audit with markdown export
- `/api/gbrain/cohort` — population insights (admin/teacher gated)
- `/api/gbrain/content-gap/{scan,fill}` — inventory scan + auto-fill
- `/api/gbrain/health` — 6-check system health
- `/api/gbrain/daily-intelligence` — nightly refresh (CRON_SECRET gated)
- `/api/gbrain/mock-exam/:sessionId` — full-length timed calibrated exam
- `/api/gbrain/weekly-digest/:sessionId` — tone-calibrated progress report
- `/api/gbrain/misconceptions` — mined misconceptions (admin/teacher gated)
- `/api/gbrain/seed-rag` — pre-seed RAG cache (CRON_SECRET gated)
- `/api/gbrain/verify-sweep` — re-verify problems to catch model drift

### Added — Frontend Pages
- `/practice/:id` — integrated `ErrorDiagnosis` on wrong answers
- `/exam-strategy` — personalized playbook + score maximization
- `/error-patterns` — weekly error digest with trends
- `/audit` — 360° audit with mastery heatmap, action plan, markdown export
- `/digest` — student-facing weekly report
- `/mock-exam` — full-length timed exam UI with live timer
- `/admin/gbrain` — unified admin dashboard (Cohort/Health/Content tabs)
- `/gbrain` — marketing landing page showcasing the architecture

### Added — Infrastructure
- `.github/workflows/gbrain-cron.yml` — 4 scheduled cron jobs (daily-intelligence, seed-rag, verify-sweep, content-gap-fill) with `workflow_dispatch` for manual runs
- `src/api/auth-middleware.ts` — `requireRole('admin', 'teacher')` wraps admin endpoints
- `.claude/bootstrap-skills.sh` — teammate onboarding script for vendored gstack
- 10 MOAT skills in `.claude/skills/` (student-audit, cohort-analysis, content-gap, gbrain-health, daily-intelligence, mock-exam, weekly-digest, misconception-miner, seed-rag, verify-sweep)

### Changed
- `/api/chat` SSE runs Task Reasoner before Gemini; streams `reasoner` event first with `{intent, action, concept, motivation}`
- `ProgressPage` expanded GBrain Intelligence section with 5 MOAT links
- `CLAUDE.md` updated with full MOAT skill catalog and routing rules

### Fixed
- 36 broken skill symlinks in `.claude/skills/` that pointed to a hardcoded macOS path. Vendored gstack; replaced with relative symlinks so teammates on any OS can use skills.

### Security
- Admin endpoints gated via `requireRole('admin', 'teacher')`
- Cron endpoints require `Bearer $CRON_SECRET`

---

## [0.3.0.0] - 2026-04-10

### Changed
- **Navigation restructure:** 5-tab bottom nav → 3 tabs (Home, Notes, Progress) + floating Tutor FAB. The AI tutor is now always one tap away from any page via a sky-blue floating button.
- **Header:** Slimmed from 56px to 48px, removed "GATE Math" text label (kept "G" logo badge). Content padding reduced from `p-4` to `px-4 pt-2 pb-4`.
- **GateHome:** Added quick-help tutor chips below One Thing card ("Explain {topic}" / "Solve a problem step by step"). Fixed dead-end states — "All done" and "Free study day" now link to the tutor. TopicGrid simplified from 2-column cards to horizontal rows.
- **NotebookPage:** Renamed "Smart Notebook" → "Notes". Removed topic completion summary grid and status legend. Simplified collapsed entries to (status dot + query + timestamp).
- **ProgressPage:** Merged weak + all topics into single sorted list (weakest first). Weak topics get amber accent. Shows top 3 by default with "Show all topics" toggle. Removed MasteryRing from topic cards.
- **PracticePage:** Removed verification metadata (tier, duration, confidence). Compact result banner (icon + verdict). "Next Problem" is full-width primary CTA; "All Problems" becomes small text link.
- **ChatPage:** Simplified empty state from 4-card grid to 3 compact chips with colored dots. Shrunk icon from 64px to 48px. Added URL param support (`?prompt=...`) for pre-filling input from home page tutor chips.
- **OnboardPage:** Replaced 10 individual confidence sliders with 3-bucket tappable sort (Weak / Okay / Strong). Faster (10 taps vs 10 drags), more mobile-friendly.
- **DESIGN.md:** Updated nav spec, added FAB spec, rewrote App Declutter Rules, added 4 decisions to log.

## [0.2.2.1] - 2026-04-09

### Fixed
- Double-tap race condition on rating buttons (ref guard prevents duplicate POSTs)
- Silent error swallowing on rate/skip — now shows transient "Couldn't save" toast
- `profileChecked` not reset on retry — prevents stale profile flash after error recovery
- Defensive guard on `currentTask` access to prevent crash if task index is invalid

## [0.2.2.0] - 2026-04-09

### Added
- **One Thing Mode:** Home page stripped to a single priority card per session. Tired students at 11pm see one clear instruction instead of a 12-element dashboard
  - Three user states: no profile (onboard CTA), no diagnostic (diagnostic CTA), fully onboarded (One Thing card)
  - Progressive disclosure: complete or skip task #1 to reveal task #2, then #3
  - "Start practicing" navigates directly to a problem via `content_preview.pyq_id` from the daily plan API
  - Celebration state with confetti and MasteryRing when all tasks are done
  - "Free study day!" fallback with topic grid when no tasks are scheduled
- **Tired Student Mode:** AI tutor prompt modifier detects late-night study (after 9pm IST + exam within 30 days) and keeps responses short and actionable
- Streak badge moved to global header (visible on all pages)

### Changed
- Home page WHY line uses encouraging tone ("Biggest room to grow") instead of shaming ("weakest topic")
- All interactive elements now meet 44px minimum touch targets
- Added `prefers-reduced-motion` support, `aria-live` regions, and focus-visible rings throughout home page

## [0.2.1.0] - 2026-04-08

### Fixed
- Blog "See Problems" CTA now takes you to the topic page instead of a broken route. Previously, clicking the CTA on any blog post led nowhere
- Frontend and backend content types are now in sync (was 7 vs 4, only `comparison` overlapped)

### Changed
- All 10 GATE topic definitions live in one place (`src/constants/topics.ts`). Previously scattered across 7 files, which meant adding a topic required 7 edits
- Blog content types centralized into `src/constants/content-types.ts`. Labels, accent colors, and type lists all come from one source now

## [0.2.0.0] - 2026-04-05

### Added
- **Content Intelligence Engine:** Self-improving content loop that gets smarter over time
  - Trend collection from Reddit, Stack Exchange, YouTube, and NewsAPI. Matches external signals to your 10 GATE topics automatically
  - 5-signal priority scoring (user struggle, trend signal, conversion rate, view velocity, coverage gap) decides what content to create next
  - Feedback scoring grades every blog post on engagement, conversion, and relevance. Low performers get auto-archived after 90 days
  - Smart flywheel integration: content-flywheel now picks topics based on priority scores and weaves trend context into Gemini prompts
- **Dark Neubrutalism blog redesign:** Gen Z/Gen Alpha aesthetic with personality
  - Hard 2px borders with content-type accent colors, colored offset shadows (3px 3px) that shift on hover
  - Space Grotesk font (geometric, modern), uppercase bold labels, sharp 4px corners
  - Single-column card feed, topic filter pills, sort tabs (Recent/Trending/Most Read), content type tabs
  - CSS-only stagger entrance animations (80ms per card) + scroll-reveal (progressive enhancement)
  - Full `prefers-reduced-motion` accessibility support
  - Sticky floating CTA bar on blog posts bridges readers to the app
  - Zero JS, single font load, ~4KB CSS total
- **App declutter:** Compact hero bar, removed welcome banner, daily challenge threshold raised to 3+ reviews, subtle inline onboarding nudge

### Fixed
- Blog route gracefully falls back when `content_score` column missing (migration not yet applied)

## [0.1.0.0] - 2026-04-03

### Added
- **Growth Engine:** Full marketing and acquisition stack
  - Blog content pipeline: 4 content types (solved problems, topic explainers, exam strategy, comparison posts) auto-generated from verified problems via Gemini
  - Server-side rendered blog pages, exam landing pages, dynamic sitemap, and RSS feed for SEO
  - Acquisition funnel tracking with backend API (replaces localStorage-only tracking)
  - Retention engine: welcome email sequence, streak reminders, weekly digest via Resend (optional)
  - Push notification subscription and preferences API
  - Social posting: Telegram Bot API + optional Twitter API v2 with IST-aware posting windows
  - Blog admin API: draft/publish/archive workflow with view counting
  - Light theme for public SEO pages, dark theme for app
- **Content Pipeline:** Chat grounding, content previews, prompt modifiers
- **Study Commander:** Priority engine, onboarding diagnostic, personalized daily plans
- **Camera Scan:** OCR problem input with smart notebook and exam readiness scoring
- **AI Tutor:** Streaming chat via SSE with Gemini 2.5-flash
- **3-Tier Verification:** RAG cache, Gemini dual-solve, Wolfram Alpha
- **Auth:** Supabase Auth (Google OAuth + email/password), anonymous-first with upgrade
- **Social Autopilot:** Content flywheel generates posts for admin approval
- **Telegram Bot:** Daily problem posting with inline keyboards
- **Frontend:** 10-route React SPA with Duolingo-style UX, bottom nav, progress tracking

### Fixed
- SQL injection in notification preferences endpoint (parameterized queries)
- XSS in SSR blog templates (escape all LLM-generated content, sanitize URLs)
- SPA catch-all exclusion for SSR routes (/blog, /exams, /sitemap.xml, /rss.xml)
- Retention engine reads env vars at call time (testability fix)
