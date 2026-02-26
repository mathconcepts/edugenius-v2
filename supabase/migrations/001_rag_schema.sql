-- ============================================================
-- EduGenius RAG Schema — Phase 2
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Documents (top-level ingested sources) ─────────────────
CREATE TABLE IF NOT EXISTS documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  source_type  TEXT NOT NULL CHECK (source_type IN ('pdf', 'web_scrape', 'manual', 'pyq_bank')),
  exam_id      TEXT NOT NULL,   -- e.g. 'gate-engineering-maths'
  topic        TEXT,            -- e.g. 'linear-algebra'
  file_size    INTEGER,
  page_count   INTEGER,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  metadata     JSONB DEFAULT '{}'::jsonb
);

-- ── Document Chunks (RAG retrieval units) ──────────────────
CREATE TABLE IF NOT EXISTS document_chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID REFERENCES documents(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  embedding    VECTOR(768),     -- Gemini text-embedding-004 dimension
  chunk_index  INTEGER NOT NULL,
  token_count  INTEGER,
  exam_id      TEXT NOT NULL,
  topic        TEXT,
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── PYQ Questions (Previous Year Questions) ────────────────
CREATE TABLE IF NOT EXISTS pyq_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id         TEXT NOT NULL,
  year            INTEGER NOT NULL,
  question_text   TEXT NOT NULL,
  options         JSONB NOT NULL,   -- {"A": "...", "B": "...", "C": "...", "D": "..."}
  correct_answer  TEXT NOT NULL,    -- "A", "B", "C", or "D"
  explanation     TEXT,
  topic           TEXT NOT NULL,
  difficulty      TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  marks           NUMERIC DEFAULT 2,
  negative_marks  NUMERIC DEFAULT -0.67,
  embedding       VECTOR(768),
  source_url      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chunks_exam_id ON document_chunks(exam_id);
CREATE INDEX IF NOT EXISTS idx_chunks_topic   ON document_chunks(topic);
CREATE INDEX IF NOT EXISTS idx_pyqs_exam_id   ON pyq_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_pyqs_topic     ON pyq_questions(topic);
CREATE INDEX IF NOT EXISTS idx_pyqs_year      ON pyq_questions(year);

-- Vector similarity indexes (IVFFlat — good for <1M rows)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_pyqs_embedding ON pyq_questions
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ── Similarity Search Functions ────────────────────────────

-- Search document chunks by cosine similarity
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding VECTOR(768),
  match_count     INT DEFAULT 5,
  filter_exam_id  TEXT DEFAULT NULL,
  filter_topic    TEXT DEFAULT NULL
)
RETURNS TABLE (
  id          UUID,
  content     TEXT,
  document_id UUID,
  topic       TEXT,
  chunk_index INTEGER,
  similarity  FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.content,
    dc.document_id,
    dc.topic,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE
    dc.embedding IS NOT NULL
    AND (filter_exam_id IS NULL OR dc.exam_id = filter_exam_id)
    AND (filter_topic   IS NULL OR dc.topic   = filter_topic)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Search PYQ questions by cosine similarity
CREATE OR REPLACE FUNCTION match_pyqs(
  query_embedding VECTOR(768),
  match_count     INT DEFAULT 5,
  filter_exam_id  TEXT DEFAULT NULL,
  filter_topic    TEXT DEFAULT NULL
)
RETURNS TABLE (
  id             UUID,
  question_text  TEXT,
  options        JSONB,
  correct_answer TEXT,
  explanation    TEXT,
  topic          TEXT,
  year           INTEGER,
  difficulty     TEXT,
  similarity     FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pq.id,
    pq.question_text,
    pq.options,
    pq.correct_answer,
    pq.explanation,
    pq.topic,
    pq.year,
    pq.difficulty,
    1 - (pq.embedding <=> query_embedding) AS similarity
  FROM pyq_questions pq
  WHERE
    pq.embedding IS NOT NULL
    AND (filter_exam_id IS NULL OR pq.exam_id = filter_exam_id)
    AND (filter_topic   IS NULL OR pq.topic   = filter_topic)
  ORDER BY pq.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ── Row Level Security ─────────────────────────────────────
ALTER TABLE documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pyq_questions   ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read documents"       ON documents       FOR SELECT USING (true);
CREATE POLICY "Public read document_chunks" ON document_chunks FOR SELECT USING (true);
CREATE POLICY "Public read pyq_questions"   ON pyq_questions   FOR SELECT USING (true);

-- Service role full access (for ingestion pipeline)
CREATE POLICY "Service write documents"       ON documents       FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write document_chunks" ON document_chunks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write pyq_questions"   ON pyq_questions   FOR ALL USING (auth.role() = 'service_role');
