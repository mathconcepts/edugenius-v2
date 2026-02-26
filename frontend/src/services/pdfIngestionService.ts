/**
 * pdfIngestionService.ts — EduGenius PDF Ingestion Pipeline
 * Phase 2: PDF → parse → chunk → embed → Supabase
 *
 * Flow:
 *   File → PDF.js parse → text chunks (500 tokens, 50 overlap)
 *        → Gemini embedContent → upsert to document_chunks table
 */

import { createClient } from '@supabase/supabase-js';
import { embedDocument } from './ragService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IngestionOptions {
  examId: string;
  topic?: string;
  chunkSize?: number;     // tokens (approx chars/4), default 500
  chunkOverlap?: number;  // tokens, default 50
  onProgress?: (progress: IngestionProgress) => void;
}

export interface IngestionProgress {
  stage: 'parsing' | 'chunking' | 'embedding' | 'storing' | 'done' | 'error';
  current: number;
  total: number;
  message: string;
}

export interface IngestionResult {
  success: boolean;
  documentId?: string;
  chunksCreated: number;
  pageCount: number;
  error?: string;
}

export interface TextChunk {
  content: string;
  index: number;
  tokenEstimate: number;
}

// ─── Text Chunking ────────────────────────────────────────────────────────────

/**
 * Estimate token count (rough: 1 token ≈ 4 chars for English/Math text).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into overlapping chunks of ~chunkSize tokens.
 */
export function chunkText(
  text: string,
  chunkSizeTokens = 500,
  overlapTokens = 50
): TextChunk[] {
  // Convert token counts to approximate char counts
  const chunkSizeChars = chunkSizeTokens * 4;
  const overlapChars = overlapTokens * 4;

  const chunks: TextChunk[] = [];

  // Split on paragraph boundaries first for cleaner chunks
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

  let currentChunk = '';
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const paraWithNewline = para.trim() + '\n\n';

    // If adding this paragraph would exceed chunk size, flush
    if (currentChunk.length + paraWithNewline.length > chunkSizeChars && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex++,
        tokenEstimate: estimateTokens(currentChunk),
      });

      // Carry over overlap from end of current chunk
      const overlapText = currentChunk.slice(-overlapChars);
      currentChunk = overlapText + paraWithNewline;
    } else {
      currentChunk += paraWithNewline;
    }
  }

  // Flush remaining
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunkIndex,
      tokenEstimate: estimateTokens(currentChunk),
    });
  }

  // Handle case where a single paragraph is too large — split by sentences
  const result: TextChunk[] = [];
  for (const chunk of chunks) {
    if (chunk.content.length > chunkSizeChars * 1.5) {
      const sentences = chunk.content.split(/(?<=[.!?])\s+/);
      let subChunk = '';
      let subIndex = chunk.index;

      for (const sentence of sentences) {
        if (subChunk.length + sentence.length > chunkSizeChars && subChunk.length > 0) {
          result.push({ content: subChunk.trim(), index: subIndex++, tokenEstimate: estimateTokens(subChunk) });
          subChunk = sentence + ' ';
        } else {
          subChunk += sentence + ' ';
        }
      }
      if (subChunk.trim()) {
        result.push({ content: subChunk.trim(), index: subIndex, tokenEstimate: estimateTokens(subChunk) });
      }
    } else {
      result.push(chunk);
    }
  }

  return result;
}

// ─── PDF Parsing ──────────────────────────────────────────────────────────────

/**
 * Extract text from a PDF file using PDF.js.
 * Returns concatenated text from all pages.
 */
export async function extractTextFromPDF(
  file: File,
  onProgress?: (page: number, total: number) => void
): Promise<{ text: string; pageCount: number }> {
  // Dynamic import to avoid bundle bloat when PDF not needed
  const pdfjsLib = await import('pdfjs-dist');

  // Set worker — use CDN for simplicity
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;

  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ');
    pageTexts.push(pageText);
    onProgress?.(pageNum, pageCount);
  }

  return {
    text: pageTexts.join('\n\n'),
    pageCount,
  };
}

// ─── Main Ingestion Pipeline ──────────────────────────────────────────────────

/**
 * Ingest a PDF file into the RAG pipeline.
 * 1. Parse PDF → text
 * 2. Chunk text
 * 3. Embed each chunk (Gemini)
 * 4. Store document + chunks in Supabase
 */
export async function ingestPDF(
  file: File,
  options: IngestionOptions
): Promise<IngestionResult> {
  const {
    examId,
    topic,
    chunkSize = 500,
    chunkOverlap = 50,
    onProgress,
  } = options;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { success: false, chunksCreated: 0, pageCount: 0, error: 'Supabase not configured' };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Stage 1: Parse PDF
    onProgress?.({ stage: 'parsing', current: 0, total: 1, message: 'Reading PDF...' });

    let text: string;
    let pageCount: number;

    try {
      ({ text, pageCount } = await extractTextFromPDF(file, (page, total) => {
        onProgress?.({ stage: 'parsing', current: page, total, message: `Parsing page ${page}/${total}...` });
      }));
    } catch (e) {
      return { success: false, chunksCreated: 0, pageCount: 0, error: `PDF parse failed: ${e}` };
    }

    if (!text.trim()) {
      return { success: false, chunksCreated: 0, pageCount, error: 'No text extracted from PDF' };
    }

    // Stage 2: Chunk text
    onProgress?.({ stage: 'chunking', current: 0, total: 1, message: 'Splitting into chunks...' });
    const chunks = chunkText(text, chunkSize, chunkOverlap);

    // Stage 3: Create document record
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        title: file.name.replace(/\.pdf$/i, ''),
        source_type: 'pdf',
        exam_id: examId,
        topic: topic ?? null,
        file_size: file.size,
        page_count: pageCount,
        metadata: { originalName: file.name, fileSize: file.size },
      })
      .select('id')
      .single();

    if (docError || !docData) {
      return { success: false, chunksCreated: 0, pageCount, error: `Failed to create document: ${docError?.message}` };
    }

    const documentId = docData.id;

    // Stage 4: Embed and store chunks
    let chunksCreated = 0;
    const BATCH_SIZE = 5; // Process 5 chunks at a time

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);

      onProgress?.({
        stage: 'embedding',
        current: i,
        total: chunks.length,
        message: `Embedding chunk ${i + 1}–${Math.min(i + BATCH_SIZE, chunks.length)} of ${chunks.length}...`,
      });

      // Embed batch (sequential to avoid rate limits)
      const embeddedBatch = [];
      for (const chunk of batch) {
        try {
          const embedding = await embedDocument(chunk.content);
          embeddedBatch.push({
            document_id: documentId,
            content: chunk.content,
            embedding: `[${embedding.join(',')}]`,
            chunk_index: chunk.index,
            token_count: chunk.tokenEstimate,
            exam_id: examId,
            topic: topic ?? null,
            metadata: { source: file.name, page_estimate: Math.floor(chunk.index / 2) + 1 },
          });
          // Small delay to respect rate limits
          await new Promise(r => setTimeout(r, 150));
        } catch (e) {
          console.error(`[PDF Ingest] Failed to embed chunk ${chunk.index}:`, e);
        }
      }

      // Store batch
      onProgress?.({
        stage: 'storing',
        current: i,
        total: chunks.length,
        message: `Storing ${embeddedBatch.length} chunks...`,
      });

      if (embeddedBatch.length > 0) {
        const { error: insertError } = await supabase
          .from('document_chunks')
          .insert(embeddedBatch);

        if (insertError) {
          console.error('[PDF Ingest] Chunk insert error:', insertError.message);
        } else {
          chunksCreated += embeddedBatch.length;
        }
      }
    }

    onProgress?.({
      stage: 'done',
      current: chunksCreated,
      total: chunks.length,
      message: `Done! ${chunksCreated} chunks indexed.`,
    });

    return { success: true, documentId, chunksCreated, pageCount };

  } catch (e) {
    console.error('[PDF Ingest] Unexpected error:', e);
    return { success: false, chunksCreated: 0, pageCount: 0, error: String(e) };
  }
}

// ─── List Documents ───────────────────────────────────────────────────────────

export interface DocumentRecord {
  id: string;
  title: string;
  source_type: string;
  exam_id: string;
  topic: string | null;
  page_count: number | null;
  created_at: string;
  chunk_count?: number;
}

export async function listDocuments(examId: string): Promise<DocumentRecord[]> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from('documents')
    .select('id, title, source_type, exam_id, topic, page_count, created_at')
    .eq('exam_id', examId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[PDF Ingest] listDocuments error:', error.message);
    return [];
  }

  return (data as DocumentRecord[]) ?? [];
}
