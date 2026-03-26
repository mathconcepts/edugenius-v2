-- ============================================================
-- Autopilot Growth Engine — Phase 0 + Expansion Tables
-- Run AFTER 003_gate_app.sql
-- ============================================================

-- ── RAG Verification Cache (pgvector, 3072 dims for gemini-embedding-001) ──
-- Persists verified solution patterns so Tier 1 RAG survives cold starts.
-- This is the compounding data asset.

CREATE TABLE IF NOT EXISTS rag_cache (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  embedding               VECTOR(3072),
  content                 TEXT NOT NULL,           -- "problem answer: student_answer"
  verification_status     TEXT NOT NULL,           -- verified | failed | partial | inconclusive
  verification_confidence REAL NOT NULL,
  verifier                TEXT NOT NULL,           -- database | llm_consensus | wolfram
  answer                  TEXT,
  topic                   TEXT,
  metadata                JSONB DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NOTE: pgvector on Supabase caps IVFFlat/HNSW at 2000 dims.
-- gemini-embedding-001 produces 3072 dims, so no vector index for now.
-- Brute-force cosine scan is fine at <100K vectors (see TODOS #1).

CREATE INDEX IF NOT EXISTS idx_rag_cache_status ON rag_cache(verification_status);

-- ── Alter pyq_questions: source tracking for generated problems ────────────
ALTER TABLE pyq_questions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'seed';
ALTER TABLE pyq_questions ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;
ALTER TABLE pyq_questions ADD COLUMN IF NOT EXISTS generation_prompt TEXT;
ALTER TABLE pyq_questions ADD COLUMN IF NOT EXISTS verification_tier TEXT;

-- ── Daily usage limits (freemium gate) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_limits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier      TEXT NOT NULL,          -- user_id or session_id
  identifier_type TEXT NOT NULL,          -- 'user' or 'session'
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  view_count      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(identifier, date)
);
CREATE INDEX IF NOT EXISTS idx_daily_limits_lookup ON daily_limits(identifier, date);

-- ── Streaks ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS streaks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier      TEXT NOT NULL UNIQUE,   -- user_id or session_id
  current_streak  INTEGER NOT NULL DEFAULT 0,
  longest_streak  INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Analytics events (lightweight, append-only) ───────────────────────────
CREATE TABLE IF NOT EXISTS analytics_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT NOT NULL,           -- page_view, problem_solved, signup, share
  identifier      TEXT,                    -- user_id or session_id
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analytics_type_date ON analytics_events(event_type, created_at);

-- ── Row Level Security ────────────────────────────────────────────────────
ALTER TABLE rag_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rag_cache_public_read" ON rag_cache FOR SELECT USING (true);
CREATE POLICY "rag_cache_service_write" ON rag_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "daily_limits_public_all" ON daily_limits FOR ALL USING (true);
CREATE POLICY "streaks_public_all" ON streaks FOR ALL USING (true);
CREATE POLICY "analytics_service_write" ON analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "analytics_service_read" ON analytics_events FOR SELECT USING (true);

-- ── RAG cache search function ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_rag_cache(
  query_embedding VECTOR(3072),
  match_count     INT DEFAULT 1,
  min_similarity  FLOAT DEFAULT 0.85
)
RETURNS TABLE (
  id                      UUID,
  content                 TEXT,
  verification_status     TEXT,
  verification_confidence REAL,
  verifier                TEXT,
  answer                  TEXT,
  similarity              FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.id,
    rc.content,
    rc.verification_status,
    rc.verification_confidence,
    rc.verifier,
    rc.answer,
    1 - (rc.embedding <=> query_embedding) AS similarity
  FROM rag_cache rc
  WHERE
    rc.embedding IS NOT NULL
    AND 1 - (rc.embedding <=> query_embedding) >= min_similarity
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
