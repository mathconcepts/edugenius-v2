# GATE Math — AI-Powered Exam Prep

**Practice GATE Engineering Mathematics with verified solutions, AI tutoring, and spaced repetition.**

A focused, mobile-first exam prep app for GATE Engineering Mathematics. Every answer is verified through a 3-tier cascade (RAG cache → Gemini LLM dual-solve → Wolfram Alpha arbitration), so students can trust the solutions.

**Live:** https://gate-math-api.onrender.com
**Repo:** https://github.com/mathconcepts/edugenius-v2

---

## What You Can Do

| Feature | Description |
|---------|-------------|
| **Practice Problems** | 50+ GATE math problems across 10 topics, with MCQ selection and step-by-step solutions |
| **AI Tutor Chat** | Ask anything — study plans, concept explanations, problem solving. Streams responses via Gemini 2.5-flash |
| **3-Tier Verification** | Every answer verified: RAG cache ($0, <500ms) → LLM dual-solve → Wolfram Alpha arbitration |
| **Spaced Repetition** | SM-2 algorithm tracks your mastery per topic. Problems resurface when you're about to forget |
| **Progress Dashboard** | Topic-by-topic mastery rings, weak-topic heatmap, streak tracking |
| **Verify Any Problem** | Paste any math problem — the 3-tier engine verifies it (rate-limited) |
| **Social Autopilot** | Content flywheel auto-generates Twitter, Instagram, LinkedIn posts from verified problems |
| **SEO Pages** | Server-rendered solution pages with JSON-LD for organic search |
| **Blog + Dynamic Feed** | Dark-themed blog with topic filters, sort by trending/views, content type tabs. CSS-only scroll animations |
| **Content Intelligence** | Self-improving content loop: trend collection (Reddit, Stack Exchange, YouTube) → 5-signal priority scoring → smart flywheel → feedback scoring with auto-archive |
| **Telegram Bot** | Daily problem posting to GATE prep groups |

---

## Quick Start (Local Dev)

```bash
git clone https://github.com/mathconcepts/edugenius-v2.git
cd edugenius-v2/tehran

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Set up environment
cp .env.example .env
# Edit .env — add GEMINI_API_KEY (required), DATABASE_URL, WOLFRAM_APP_ID

# Run backend (port 8080)
npx tsx src/gate-server.ts

# Run frontend (port 3000, separate terminal)
cd frontend && npm run dev
```

**Minimum required:** `GEMINI_API_KEY` from [aistudio.google.com](https://aistudio.google.com/)
**For full features:** `DATABASE_URL` (Supabase), `WOLFRAM_APP_ID`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              GATE Math App                       │
├─────────────────────────────────────────────────┤
│  React Frontend (Vite + TailwindCSS)            │
│  10 routes, mobile-first, dark theme            │
│  Framer Motion animations, KaTeX math rendering │
├─────────────────────────────────────────────────┤
│  Node.js Backend (raw HTTP server)              │
│  TypeScript, gate-server.ts entry point         │
├─────────────────────────────────────────────────┤
│  API Routes                                     │
│  /api/topics, /api/problems, /api/verify        │
│  /api/chat (SSE streaming), /api/sr, /api/streak│
│  /api/admin/social, /api/auth/migrate-session   │
├─────────────────────────────────────────────────┤
│  Content Intelligence Engine                    │
│  Trends → Priority scoring → Smart flywheel     │
│  Feedback scoring → Auto-archive                │
├─────────────────────────────────────────────────┤
│  3-Tier Verification Engine                     │
│  Tier 1: RAG (pgvector cosine similarity)       │
│  Tier 2: Gemini 2.5-flash dual-solve            │
│  Tier 3: Wolfram Alpha arbitration              │
├─────────────────────────────────────────────────┤
│  Supabase (PostgreSQL + pgvector + Auth)        │
│  Tables: pyq_questions, sr_sessions, streaks,   │
│  chat_messages, user_profiles, social_content,  │
│  verification_log, rag_cache, seo_pages,        │
│  blog_posts, trend_signals, content_priorities  │
└─────────────────────────────────────────────────┘
```

---

## Frontend Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | GateHome | Topic grid with mastery rings, streak badge, GATE countdown |
| `/topic/:id` | TopicPage | Problem list for a topic with difficulty indicators |
| `/practice/:id` | PracticePage | Answer MCQs, see verified solutions, confetti celebrations |
| `/chat` | ChatPage | AI tutor — streaming chat with Gemini, suggested prompts |
| `/verify` | VerifyPage | Paste any math problem for 3-tier verification |
| `/progress` | ProgressPage | Mastery stats, weak-topic heatmap, animated counters |
| `/settings` | SettingsPage | Theme toggle, session management |
| `/login` | LoginPage | Supabase Auth — Google OAuth + email/password |
| `/admin` | AdminPage | Dashboard + social media content queue (teacher/admin only) |

---

## API Endpoints

```bash
# Core
GET  /health                     # Health check + DB diagnostics
GET  /api/topics                 # List 10 GATE math topics with problem counts
GET  /api/problems/:topic        # Problems for a topic
POST /api/verify                 # 3-tier verification cascade
POST /api/verify-any             # Verify arbitrary math (rate-limited)

# AI Tutor
POST /api/chat                   # Stream chat response (SSE)
GET  /api/chat/:sessionId        # Chat history

# Spaced Repetition
GET  /api/sr/:sessionId          # SR state for session
POST /api/sr/:sessionId          # Update SR after answer

# Progress & Streaks
GET  /api/progress/:sessionId    # Progress + weak topics
GET  /api/streak/:id             # Current + longest streak
POST /api/streak/:id             # Update streak

# Auth
POST /api/auth/migrate-session   # Link anonymous data to authenticated user

# Social Media (admin)
GET  /api/admin/social           # List social content
PUT  /api/admin/social/:id       # Approve/reject/schedule posts

# Automation
POST /api/flywheel/generate      # Content generation (cron, Bearer token)
POST /telegram/daily-problem     # Post daily problem to Telegram groups

# Content Intelligence (cron, Bearer token)
POST /api/trends/collect          # Collect trends from Reddit, Stack Exchange, YouTube, NewsAPI
POST /api/content/prioritize      # Compute 5-signal priority scores for all topics
POST /api/content/score           # Score blog posts + auto-archive low performers

# SEO
GET  /topics/:slug               # Server-rendered topic pages
GET  /solutions/:slug            # Server-rendered solution pages
GET  /sitemap.xml                # Auto-generated sitemap
```

---

## Environment Variables

| Key | Required | Description |
|-----|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google AI Studio — powers chat, verification, embeddings |
| `DATABASE_URL` | Yes (prod) | Supabase PostgreSQL connection string (transaction pooler) |
| `WOLFRAM_APP_ID` | No | Wolfram Alpha — Tier 3 verification arbitration |
| `SUPABASE_URL` | No | Supabase project URL (for Auth) |
| `SUPABASE_ANON_KEY` | No | Supabase anon key (for Auth) |
| `JWT_SECRET` | No | For backend JWT verification |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot for daily problems |
| `TELEGRAM_GROUP_IDS` | No | Comma-separated Telegram group chat IDs |
| `CRON_SECRET` | No | Bearer token for cron job endpoints |
| `PORT` | No | Server port (default: 8080) |

---

## Deployment (Render)

The app deploys to **Render** (free tier) via `render.yaml`:

```bash
# Push to main triggers auto-deploy
git push origin main
```

**Render dashboard:** Set `DATABASE_URL`, `GEMINI_API_KEY`, `WOLFRAM_APP_ID` as environment variables.

Build command: `npm install && cd frontend && npm install --include=dev && npx vite build`
Start command: `npx tsx src/gate-server.ts`

---

## Database Migrations

```
supabase/migrations/
├── 001_rag_schema.sql           # documents, document_chunks, pyq_questions + pgvector
├── 002_telegram_bot.sql         # posted_at column for daily problem tracking
├── 003_gate_app.sql             # sr_sessions, verification_log, seo_pages
├── 004_autopilot_growth.sql     # rag_cache, daily_limits, streaks, analytics_events
├── 005_chat_and_roles.sql       # chat_messages, user_profiles, social_content
├── 006_notebook_readiness.sql   # notebook_entries, exam_readiness
├── 007_study_commander.sql      # study plans, daily tasks
├── 008_content_pipeline.sql     # blog_posts table
├── 009_growth_engine.sql        # funnel_events, retention, social_content expansion
└── 010_content_intelligence.sql # trend_signals, content_priorities, blog_posts.content_score
```

Run migrations: `PGPASSWORD=<pw> psql <connection_string> -f supabase/migrations/<file>.sql`

---

## Project Structure

```
tehran/
├── src/                          # Backend TypeScript
│   ├── gate-server.ts            # Main entry point (standalone GATE server)
│   ├── api/
│   │   ├── gate-routes.ts        # Core API (topics, problems, verify, SR)
│   │   ├── chat-routes.ts        # AI tutor chat (SSE streaming)
│   │   ├── auth-middleware.ts     # JWT verification + role checks
│   │   ├── social-routes.ts      # Social media content admin
│   │   ├── streak-routes.ts      # Streak tracking
│   │   ├── topic-pages.ts        # SEO pages + sitemap
│   │   └── admin-routes.ts       # Admin seeding/reset
│   ├── verification/
│   │   ├── tiered-orchestrator.ts # 3-tier cascade engine
│   │   └── verifiers/            # wolfram.ts, llm-consensus.ts, sympy.ts
│   ├── data/
│   │   └── vector-store.ts       # PgVectorStore + InMemoryVectorStore
│   ├── constants/
│   │   ├── topics.ts            # Single source of truth: 10 GATE topics
│   │   └── content-types.ts     # Single source of truth: blog content types
│   ├── templates/
│   │   ├── blog-post.ts         # SSR blog post template (dark neubrutalism)
│   │   ├── blog-index.ts        # SSR blog index with topic filters
│   │   ├── exam-landing.ts      # SEO landing page
│   │   ├── rss-feed.ts          # RSS feed generator
│   │   └── sitemap.ts           # Sitemap generator
│   └── jobs/
│       ├── content-flywheel.ts   # Auto-generate problems + social content
│       ├── trend-collector.ts    # External trend collection (Reddit, SE, YouTube, NewsAPI)
│       ├── content-prioritizer.ts # 5-signal weighted priority scoring
│       ├── feedback-scorer.ts    # Blog post scoring + auto-archive
│       ├── daily-problem.ts      # Telegram daily posting
│       └── telegram-webhook.ts   # "Show Solution" button handler
├── frontend/                     # React + Vite + TailwindCSS
│   └── src/
│       ├── App.tsx               # 10-route SPA router
│       ├── pages/gate/           # GateHome, ChatPage, PracticePage, etc.
│       ├── components/gate/      # GateLayout, MasteryRing, StreakBadge, etc.
│       ├── hooks/                # useApi, useSession, useAuth
│       └── lib/                  # analytics, animations, supabase client
├── supabase/
│   ├── migrations/               # 10 migration files
│   └── seeds/                    # GATE EM PYQ seed data
├── render.yaml                   # Render deployment config
├── CLAUDE.md                     # AI agent instructions
└── TODOS.md                      # Deferred work tracker
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, TailwindCSS 3, Framer Motion 11, KaTeX |
| Backend | Node.js (raw HTTP), TypeScript 5, tsx runtime |
| Database | Supabase (PostgreSQL 16 + pgvector) |
| AI | Google Gemini 2.5-flash (chat, verification, embeddings) |
| Math Engine | Wolfram Alpha API (Tier 3 arbitration) |
| Auth | Supabase Auth (Google OAuth + email/password) |
| Hosting | Render (free tier, auto-deploy from main) |

---

## Roles

| Role | Access |
|------|--------|
| **Student** (default) | All practice pages, AI tutor, progress tracking |
| **Teacher** | Student access + admin dashboard, content management |
| **Admin** | Full access + social media queue, system settings |

Anonymous users (no login) get full access to practice and chat. Login is optional — it enables persistent progress across devices and session migration.

---

## 3-Tier Verification Engine

Every answer goes through a cost-optimized cascade:

1. **Tier 1 — RAG Cache** ($0, <500ms): Check if this problem pattern was previously verified. Uses pgvector cosine similarity with 3072-dim Gemini embeddings.
2. **Tier 2 — LLM Dual-Solve** ($0 free tier, <8s): Two Gemini 2.5-flash instances solve independently. If they agree, the answer is verified. Disagreement escalates to Tier 3.
3. **Tier 3 — Wolfram Alpha** (free 2000/mo, <15s): Arbitrates when LLMs disagree. Rate-limited to 50/day. Result is cached back to Tier 1 for future use.

Each verification generates a trace ID for observability. Results are logged to `verification_log`.

---

*GATE Math — Verified exam prep, powered by AI.*
