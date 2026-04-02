-- ============================================================
-- Content Pipeline — Observability + Dedup
-- Run AFTER 007_study_commander.sql
-- ============================================================

-- ── Content Pipeline Log (observability) ─────────────────────
-- Tracks what content was served, from where, how long, to whom.
-- Consumed by GET /api/content/stats and monitoring dashboards.

CREATE TABLE IF NOT EXISTS content_pipeline_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id     UUID NOT NULL,
  session_id   TEXT,
  source       TEXT NOT NULL,              -- 'commander_preview' | 'chat_grounding' | 'api_resolve'
  topic        TEXT,
  content_id   UUID,                       -- pyq_questions.id or rag_cache.id
  tier_used    TEXT NOT NULL,              -- 'pyq_questions' | 'rag_cache' | 'document_chunks'
  latency_ms   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cpl_session ON content_pipeline_log(session_id);
CREATE INDEX IF NOT EXISTS idx_cpl_source ON content_pipeline_log(source);
CREATE INDEX IF NOT EXISTS idx_cpl_created ON content_pipeline_log(created_at);

-- ── Content Served (dedup tracking) ──────────────────────────
-- Prevents serving the same problem to the same user repeatedly.
-- Used by commander content preview to rotate through available problems.

CREATE TABLE IF NOT EXISTS content_served (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   TEXT NOT NULL,
  content_id   UUID NOT NULL,              -- pyq_questions.id
  source       TEXT NOT NULL,              -- 'commander_preview' | 'chat_grounding'
  served_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cs_session ON content_served(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cs_dedup ON content_served(session_id, content_id);
