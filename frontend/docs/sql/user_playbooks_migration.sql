-- ============================================================
-- user_playbooks_migration.sql
-- EduGenius v2.0 — Per-User Playbook DB Schema
--
-- Run this in Supabase SQL editor (or via migration CLI).
-- Safe to re-run: all statements use IF NOT EXISTS.
-- ============================================================

-- -----------------------------------------------------------
-- TABLE: user_playbooks
-- One active row per user per exam.
-- Upserted on every save (conflict on id).
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_playbooks (
  id            TEXT PRIMARY KEY,          -- '{userId}__{examId}'
  user_id       TEXT NOT NULL,
  exam_id       TEXT NOT NULL,
  playbook_json JSONB NOT NULL,            -- full UserPlaybook object
  version       INTEGER NOT NULL DEFAULT 1,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user-level queries (list all exams for a user)
CREATE INDEX IF NOT EXISTS idx_user_playbooks_user_id
  ON user_playbooks(user_id);

-- Index for fast exam-level queries
CREATE INDEX IF NOT EXISTS idx_user_playbooks_exam_id
  ON user_playbooks(exam_id);

-- -----------------------------------------------------------
-- TABLE: user_playbook_archive
-- Immutable snapshot history — insert-only, never updated.
-- Each row is a point-in-time snapshot of a user's playbook.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_playbook_archive (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT NOT NULL,
  exam_id             TEXT NOT NULL,
  snapshot_json       JSONB NOT NULL,          -- full UserPlaybook at snapshot time
  version             INTEGER NOT NULL,
  mastery_at_snapshot FLOAT,                   -- denormalized for fast queries
  trigger             TEXT,                    -- 'session_end' | 'mastery_milestone' | 'scope_change' | 'manual_save' | 'daily_sync'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index for fetching history for a specific user+exam
CREATE INDEX IF NOT EXISTS idx_archive_user_exam
  ON user_playbook_archive(user_id, exam_id);

-- Index for chronological queries
CREATE INDEX IF NOT EXISTS idx_archive_created_at
  ON user_playbook_archive(created_at DESC);

-- -----------------------------------------------------------
-- COMMENTS (documentation in schema)
-- -----------------------------------------------------------
COMMENT ON TABLE user_playbooks IS
  'One active playbook row per user per exam. Upserted by userPlaybookService.ts on every save.';

COMMENT ON TABLE user_playbook_archive IS
  'Immutable point-in-time snapshots of user playbooks. Insert-only. Used for progress history, mastery milestones, and audit trails.';

COMMENT ON COLUMN user_playbooks.id IS
  'Composite key: {userId}__{examId}. Single playbook per user per exam.';

COMMENT ON COLUMN user_playbook_archive.trigger IS
  'What triggered this snapshot: session_end | mastery_milestone | scope_change | manual_save | daily_sync';

-- -----------------------------------------------------------
-- ROW LEVEL SECURITY (optional — enable when auth is wired)
-- Uncomment these when Supabase Auth is configured.
-- -----------------------------------------------------------
-- ALTER TABLE user_playbooks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_playbook_archive ENABLE ROW LEVEL SECURITY;

-- Allow users to read/write their own playbooks only
-- CREATE POLICY user_playbooks_own ON user_playbooks
--   FOR ALL USING (auth.uid()::text = user_id);

-- Allow users to read their own archive, insert new rows
-- CREATE POLICY archive_read_own ON user_playbook_archive
--   FOR SELECT USING (auth.uid()::text = user_id);
-- CREATE POLICY archive_insert_own ON user_playbook_archive
--   FOR INSERT WITH CHECK (auth.uid()::text = user_id);
