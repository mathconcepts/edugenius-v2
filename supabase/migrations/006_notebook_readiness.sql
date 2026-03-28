-- Migration 006: Smart Notebook + Exam Readiness foundations
-- Adds notebook_entries table for auto-logging all student interactions by topic

-- Notebook entries: auto-logged from chat, practice, verify
CREATE TABLE IF NOT EXISTS notebook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('chat', 'practice', 'verify', 'manual')),
  source_id TEXT,
  topic TEXT NOT NULL DEFAULT 'general',
  query_text TEXT NOT NULL,
  answer_text TEXT,
  status TEXT NOT NULL DEFAULT 'to_review' CHECK (status IN ('mastered', 'in_progress', 'to_review')),
  confidence REAL DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_notebook_session_topic ON notebook_entries(session_id, topic);
CREATE INDEX IF NOT EXISTS idx_notebook_session_created ON notebook_entries(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notebook_session_status ON notebook_entries(session_id, status);

-- Unique constraint for upserts from practice/verify (prevent duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notebook_source_unique
  ON notebook_entries(session_id, source, source_id)
  WHERE source_id IS NOT NULL;

-- Analytics events table (referenced in gate-routes but never migrated)
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  identifier TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type, created_at DESC);

-- Enable RLS
ALTER TABLE notebook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Public access policies (anonymous sessions use session_id, not auth)
CREATE POLICY "notebook_public_all" ON notebook_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "analytics_public_all" ON analytics_events FOR ALL USING (true) WITH CHECK (true);
