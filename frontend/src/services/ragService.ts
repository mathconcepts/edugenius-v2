/**
 * ragService.ts — EduGenius RAG Service
 * Phase 2: Vector search via Supabase pgvector + Gemini embeddings
 *
 * Flow:
 *   userQuery → embedText() → match_chunks() + match_pyqs() → RagContext → Sage
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChunkResult {
  id: string;
  content: string;
  document_id: string;
  topic: string | null;
  chunk_index: number;
  similarity: number;
}

export interface PYQResult {
  id: string;
  question_text: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation: string | null;
  topic: string;
  year: number;
  difficulty: string | null;
  similarity: number;
}

export interface RagContext {
  chunks: ChunkResult[];
  pyqs: PYQResult[];
  hasContext: boolean;
  queryEmbedding?: number[];
}

// ─── Supabase Client ──────────────────────────────────────────────────────────

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('[RAG] Supabase not configured — VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing');
    return null;
  }

  _supabase = createClient(url, key);
  return _supabase;
}

// ─── Gemini Embeddings ────────────────────────────────────────────────────────

const GEMINI_EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIMENSION = 768;

/**
 * Embed a text string using Gemini text-embedding-004.
 * Returns a 768-dimensional vector.
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('[RAG] VITE_GEMINI_API_KEY not set');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_QUERY',
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[RAG] Embedding API error: ${err}`);
  }

  const data = await response.json();
  return data.embedding?.values ?? [];
}

/**
 * Embed text for document ingestion (different task type for better retrieval).
 */
export async function embedDocument(text: string): Promise<number[]> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('[RAG] VITE_GEMINI_API_KEY not set');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_DOCUMENT',
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[RAG] Embedding API error: ${err}`);
  }

  const data = await response.json();
  return data.embedding?.values ?? [];
}

// ─── Search Functions ─────────────────────────────────────────────────────────

/**
 * Search document chunks by semantic similarity.
 */
export async function searchChunks(
  query: string,
  examId: string,
  topK = 5,
  topic?: string
): Promise<ChunkResult[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const embedding = await embedText(query);

    const { data, error } = await supabase.rpc('match_chunks', {
      query_embedding: embedding,
      match_count: topK,
      filter_exam_id: examId,
      filter_topic: topic ?? null,
    });

    if (error) {
      console.error('[RAG] searchChunks error:', error.message);
      return [];
    }

    return (data as ChunkResult[]) ?? [];
  } catch (e) {
    console.error('[RAG] searchChunks failed:', e);
    return [];
  }
}

/**
 * Search PYQ questions by semantic similarity.
 */
export async function searchPYQs(
  query: string,
  examId: string,
  topK = 3,
  topic?: string
): Promise<PYQResult[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const embedding = await embedText(query);

    const { data, error } = await supabase.rpc('match_pyqs', {
      query_embedding: embedding,
      match_count: topK,
      filter_exam_id: examId,
      filter_topic: topic ?? null,
    });

    if (error) {
      console.error('[RAG] searchPYQs error:', error.message);
      return [];
    }

    return (data as PYQResult[]) ?? [];
  } catch (e) {
    console.error('[RAG] searchPYQs failed:', e);
    return [];
  }
}

/**
 * Get combined RAG context for a query — chunks + PYQs.
 * This is what Sage calls before generating an answer.
 */
export async function getRagContext(
  query: string,
  examId: string,
  topic?: string
): Promise<RagContext> {
  try {
    const [chunks, pyqs] = await Promise.all([
      searchChunks(query, examId, 5, topic),
      searchPYQs(query, examId, 3, topic),
    ]);

    return {
      chunks,
      pyqs,
      hasContext: chunks.length > 0 || pyqs.length > 0,
    };
  } catch (e) {
    console.error('[RAG] getRagContext failed:', e);
    return { chunks: [], pyqs: [], hasContext: false };
  }
}

// ─── PYQ Embedding Population ─────────────────────────────────────────────────

/**
 * Populate embeddings for PYQs that don't have them yet.
 * Call this once after seeding the database.
 * Requires service_role key — use from admin panel only.
 */
export async function embedPYQs(
  serviceRoleKey: string,
  examId = 'gate-engineering-maths'
): Promise<{ processed: number; errors: number }> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) throw new Error('[RAG] VITE_SUPABASE_URL not set');

  const adminClient = createClient(url, serviceRoleKey);

  const { data: pyqs, error } = await adminClient
    .from('pyq_questions')
    .select('id, question_text, explanation')
    .eq('exam_id', examId)
    .is('embedding', null);

  if (error) throw new Error(`[RAG] Failed to fetch PYQs: ${error.message}`);
  if (!pyqs?.length) return { processed: 0, errors: 0 };

  let processed = 0;
  let errors = 0;

  for (const pyq of pyqs) {
    try {
      const text = `${pyq.question_text} ${pyq.explanation ?? ''}`.trim();
      const embedding = await embedDocument(text);

      const { error: updateError } = await adminClient
        .from('pyq_questions')
        .update({ embedding: `[${embedding.join(',')}]` })
        .eq('id', pyq.id);

      if (updateError) {
        console.error(`[RAG] Failed to update PYQ ${pyq.id}:`, updateError.message);
        errors++;
      } else {
        processed++;
      }

      // Rate limit: 1 embedding per 100ms
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.error(`[RAG] Error embedding PYQ ${pyq.id}:`, e);
      errors++;
    }
  }

  return { processed, errors };
}

// ─── Context Formatter ────────────────────────────────────────────────────────

/**
 * Format RAG context into a string for injection into Sage's prompt.
 */
export function formatRagContext(ctx: RagContext): string {
  if (!ctx.hasContext) return '';

  const parts: string[] = [];

  if (ctx.chunks.length > 0) {
    parts.push('## Relevant Study Material\n');
    ctx.chunks.forEach((chunk, i) => {
      parts.push(`[Excerpt ${i + 1}${chunk.topic ? ` — ${chunk.topic}` : ''}]\n${chunk.content}\n`);
    });
  }

  if (ctx.pyqs.length > 0) {
    parts.push('\n## Related GATE Previous Year Questions\n');
    ctx.pyqs.forEach((pyq, i) => {
      parts.push(
        `[GATE ${pyq.year} — ${pyq.topic}]\n` +
        `Q: ${pyq.question_text}\n` +
        `Options: ${Object.entries(pyq.options).map(([k, v]) => `${k}) ${v}`).join(' | ')}\n` +
        `Answer: ${pyq.correct_answer}${pyq.explanation ? `\nExplanation: ${pyq.explanation}` : ''}\n`
      );
    });
  }

  return parts.join('\n');
}

export { EMBEDDING_DIMENSION };
