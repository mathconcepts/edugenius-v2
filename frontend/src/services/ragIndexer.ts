/**
 * ragIndexer.ts — Progressive RAG Growth Engine
 * Background job that embeds logged queries into Supabase.
 */

import { getUnembeddedQueries, markQueryEmbedded } from './knowledgeRouter';
import { embedDocument } from './ragService';

export interface IndexingJob {
  status: 'idle' | 'running' | 'done' | 'error';
  processed: number;
  errors: number;
  lastRun?: string;
  nextRun?: string;
}

const JOB_KEY = 'edugenius_rag_indexer_job';

export function getIndexingJobStatus(): IndexingJob {
  try {
    return (
      JSON.parse(localStorage.getItem(JOB_KEY) ?? 'null') ?? {
        status: 'idle',
        processed: 0,
        errors: 0,
      }
    );
  } catch {
    return { status: 'idle', processed: 0, errors: 0 };
  }
}

export async function runProgressiveIndexing(batchSize = 20): Promise<IndexingJob> {
  const job: IndexingJob = {
    status: 'running',
    processed: 0,
    errors: 0,
    lastRun: new Date().toISOString(),
  };
  localStorage.setItem(JOB_KEY, JSON.stringify(job));

  const pending = getUnembeddedQueries(batchSize);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!supabaseUrl || !supabaseKey || !geminiKey || pending.length === 0) {
    job.status = 'done';
    job.nextRun = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    localStorage.setItem(JOB_KEY, JSON.stringify(job));
    return job;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  for (const entry of pending) {
    try {
      const docText = [
        `Question: ${entry.query}`,
        `Answer: ${entry.answerPreview}`,
        `Exam: ${entry.examId}`,
        entry.topicId ? `Topic: ${entry.topicId}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const embedding = await embedDocument(docText);

      await supabase.from('document_chunks').upsert({
        id: `query_log_${entry.id}`,
        content: docText,
        embedding,
        document_id: `progressive_rag_${entry.examId}`,
        topic: entry.topicId ?? null,
        chunk_index: 0,
        exam_id: entry.examId,
      });

      markQueryEmbedded(entry.id);
      job.processed++;
    } catch {
      job.errors++;
    }
  }

  job.status = 'done';
  job.nextRun = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  localStorage.setItem(JOB_KEY, JSON.stringify(job));
  return job;
}

export function scheduleProgressiveIndexing(): void {
  const pending = getUnembeddedQueries(1);
  if (pending.length === 0) return;
  setTimeout(() => {
    runProgressiveIndexing(20).catch(() => {});
  }, 5000);
}
