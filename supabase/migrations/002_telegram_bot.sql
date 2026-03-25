-- ============================================================
-- Telegram Bot — Daily Problem Support
-- Adds posted_at tracking for idempotent daily problem posting.
-- Run AFTER 001_rag_schema.sql
-- ============================================================

-- Track which PYQs have been posted to Telegram
ALTER TABLE pyq_questions ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;

-- Index for efficient "find unposted" queries
CREATE INDEX IF NOT EXISTS idx_pyqs_posted_at ON pyq_questions(posted_at)
  WHERE posted_at IS NULL;
