/**
 * Material parsing & chunking pipeline.
 *
 * Takes uploaded file → extracted text → chunks → embeddings → IndexedDB.
 * All client-side except image OCR which uses Gemini Vision proxy.
 */

import { saveMaterial, saveChunk, saveEmbedding, type GBrainDB } from './db';
import { embed } from './embedder';

export interface ParsedMaterial {
  text: string;
  pageCount?: number;
  pageTexts?: string[];
}

/** Chunk text into ~500-word (≈500 token) pieces with minor overlap */
export function chunkText(text: string, targetWords = 500): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current: string[] = [];
  let wordCount = 0;

  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).length;
    if (wordCount + words > targetWords && current.length > 0) {
      chunks.push(current.join(' '));
      // Overlap: keep last sentence
      current = current.slice(-1);
      wordCount = current.join(' ').split(/\s+/).length;
    }
    current.push(sentence);
    wordCount += words;
  }
  if (current.length > 0) chunks.push(current.join(' '));
  return chunks.filter(c => c.trim().length > 50); // drop tiny fragments
}

/** Parse a PDF file → text. Uses pdfjs-dist (already in deps). */
export async function parsePDF(file: File): Promise<ParsedMaterial> {
  const pdfjsLib = await import('pdfjs-dist');
  // Use the worker from CDN for simplicity
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${(pdfjsLib as any).version}/build/pdf.worker.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => it.str).join(' ');
    pageTexts.push(text);
  }

  return {
    text: pageTexts.join('\n\n'),
    pageCount: pdf.numPages,
    pageTexts,
  };
}

/** Parse a DOCX file → text. Uses mammoth. */
export async function parseDOCX(file: File): Promise<ParsedMaterial> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await (mammoth as any).extractRawText({ arrayBuffer });
  return { text: result.value };
}

/** Parse a plain text / markdown file */
export async function parseText(file: File): Promise<ParsedMaterial> {
  const text = await file.text();
  return { text };
}

/** OCR a handwritten note/work image via server Gemini Vision proxy */
export async function parseImage(file: File): Promise<ParsedMaterial> {
  const base64 = await fileToBase64(file);
  const res = await fetch('/api/gemini/vision-ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64, mimeType: file.type }),
  });
  if (!res.ok) throw new Error(`OCR failed: ${res.status}`);
  const data = await res.json();
  return { text: data.text || '' };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Full ingest pipeline: parse → chunk → embed → persist. Reports progress. */
export async function ingestMaterial(
  file: File,
  onProgress?: (stage: string, pct: number) => void,
): Promise<string> {
  const materialId = `mat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const ext = file.name.toLowerCase().split('.').pop() || '';
  let type: GBrainDB['materials']['value']['type'];
  let parsed: ParsedMaterial;

  onProgress?.('parsing', 0.1);

  if (ext === 'pdf') { type = 'pdf'; parsed = await parsePDF(file); }
  else if (ext === 'docx') { type = 'docx'; parsed = await parseDOCX(file); }
  else if (ext === 'md' || ext === 'markdown') { type = 'md'; parsed = await parseText(file); }
  else if (ext === 'txt') { type = 'txt'; parsed = await parseText(file); }
  else if (file.type.startsWith('image/')) { type = 'image-notes'; parsed = await parseImage(file); }
  else throw new Error(`Unsupported file type: ${ext}`);

  onProgress?.('chunking', 0.3);

  await saveMaterial({
    id: materialId,
    filename: file.name,
    type,
    size_bytes: file.size,
    page_count: parsed.pageCount,
    uploaded_at: new Date().toISOString(),
  });

  const chunks = chunkText(parsed.text);
  onProgress?.('embedding', 0.4);

  // Embed + persist each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunkId = `chk-${materialId}-${i}`;
    await saveChunk({
      id: chunkId,
      material_id: materialId,
      seq: i,
      text: chunks[i],
    });
    const vector = await embed(chunks[i]);
    await saveEmbedding(chunkId, vector, 'material');
    onProgress?.('embedding', 0.4 + 0.6 * ((i + 1) / chunks.length));
  }

  onProgress?.('done', 1.0);
  return materialId;
}
