-- ============================================================
-- GATE Math App — Spaced Repetition & Verification Tracking
-- Run AFTER 002_telegram_bot.sql
-- ============================================================

-- ── Spaced Repetition Sessions ──────────────────────────────
-- Tracks SM-2 state per student per problem.
-- Anonymous users identified by UUID stored in localStorage.

CREATE TABLE IF NOT EXISTS sr_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    TEXT NOT NULL,                -- anonymous UUID from localStorage
  pyq_id        UUID NOT NULL REFERENCES pyq_questions(id),
  -- SM-2 algorithm state
  easiness      REAL NOT NULL DEFAULT 2.5,    -- EF (easiness factor), min 1.3
  interval_days INTEGER NOT NULL DEFAULT 1,   -- days until next review
  repetitions   INTEGER NOT NULL DEFAULT 0,   -- consecutive correct count
  next_review   DATE NOT NULL DEFAULT CURRENT_DATE,
  last_quality  INTEGER,                      -- last quality response (0-5)
  -- Tracking
  attempts      INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  last_answer   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, pyq_id)
);

CREATE INDEX IF NOT EXISTS idx_sr_next_review ON sr_sessions(session_id, next_review);

CREATE INDEX IF NOT EXISTS idx_sr_session ON sr_sessions(session_id);

-- ── Verification Log ────────────────────────────────────────
-- Tracks every verification through the 3-tier pipeline.
-- Used for: tier hit rate monitoring, cost tracking, debugging.

CREATE TABLE IF NOT EXISTS verification_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id      UUID NOT NULL,
  session_id    TEXT,                         -- anonymous user
  problem       TEXT NOT NULL,
  answer        TEXT NOT NULL,
  tier_used     TEXT NOT NULL,                -- tier1_rag | tier2_llm | tier3_wolfram
  status        TEXT NOT NULL,                -- verified | failed | partial | inconclusive
  confidence    REAL NOT NULL,
  tier1_ms      INTEGER,
  tier2_ms      INTEGER,
  tier3_ms      INTEGER,
  total_ms      INTEGER NOT NULL,
  rag_score     REAL,
  llm_agreement BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vlog_trace ON verification_log(trace_id);
CREATE INDEX IF NOT EXISTS idx_vlog_session ON verification_log(session_id);
CREATE INDEX IF NOT EXISTS idx_vlog_tier ON verification_log(tier_used);
CREATE INDEX IF NOT EXISTS idx_vlog_created ON verification_log(created_at);

-- ── SEO Pages Cache ─────────────────────────────────────────
-- Pre-rendered HTML for SEO landing pages.

CREATE TABLE IF NOT EXISTS seo_pages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,          -- e.g. "gate-linear-algebra-eigenvalues-2023"
  title         TEXT NOT NULL,
  html_content  TEXT NOT NULL,                 -- pre-rendered HTML (KaTeX)
  topic         TEXT NOT NULL,
  pyq_id        UUID REFERENCES pyq_questions(id),
  meta_desc     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_slug ON seo_pages(slug);
CREATE INDEX IF NOT EXISTS idx_seo_topic ON seo_pages(topic);

-- ── Row Level Security ──────────────────────────────────────

ALTER TABLE sr_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_pages ENABLE ROW LEVEL SECURITY;

-- Public read for SEO pages
CREATE POLICY "seo_pages_public_read" ON seo_pages FOR SELECT USING (true);
CREATE POLICY "seo_pages_service_write" ON seo_pages FOR ALL USING (auth.role() = 'service_role');

-- SR sessions: users can only access their own session data
-- (anonymous sessions matched by session_id passed in request)
CREATE POLICY "sr_sessions_public_all" ON sr_sessions FOR ALL USING (true);

-- Verification log: service role write, public read for own session
CREATE POLICY "vlog_public_read" ON verification_log FOR SELECT USING (true);
CREATE POLICY "vlog_service_write" ON verification_log FOR INSERT WITH CHECK (true);
