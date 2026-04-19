/**
 * GBrain IndexedDB Store — Local-first student state.
 *
 * Schema:
 *   student      - StudentModel keyed by session_id (singleton row per user)
 *   errors       - ErrorLog entries
 *   attempts     - Attempt history
 *   confidence   - Confidence-calibration entries
 *   materials    - Uploaded material metadata
 *   chunks       - Parsed material text chunks
 *   embeddings   - 384-dim vectors per chunk
 *   generated    - Client-cached generated problems
 *
 * All operations are async. 50MB+ available per origin.
 */

import { openDB, IDBPDatabase, DBSchema } from 'idb';

export interface GBrainDB extends DBSchema {
  student: {
    key: string;
    value: any;
  };
  errors: {
    key: string;
    value: {
      id: string;
      session_id: string;
      concept_id: string;
      topic: string;
      error_type: string;
      misconception_id: string;
      diagnosis: string;
      why_tempting?: string;
      why_wrong?: string;
      corrective_hint?: string;
      student_answer?: string;
      correct_answer?: string;
      time_taken_ms?: number;
      confidence_before?: number;
      created_at: string;
    };
    indexes: { 'by-session': string; 'by-concept': string; 'by-date': string };
  };
  attempts: {
    key: string;
    value: {
      id: string;
      session_id: string;
      problem_id?: string;
      concept_id: string;
      is_correct: boolean;
      difficulty: number;
      time_taken_ms?: number;
      created_at: string;
    };
    indexes: { 'by-session': string; 'by-date': string };
  };
  confidence: {
    key: string;
    value: {
      id: string;
      session_id: string;
      concept_id: string;
      confidence_before: number;
      was_correct: boolean;
      created_at: string;
    };
    indexes: { 'by-session': string };
  };
  materials: {
    key: string;
    value: {
      id: string;
      filename: string;
      type: 'pdf' | 'docx' | 'md' | 'txt' | 'image-notes' | 'image-work';
      size_bytes: number;
      page_count?: number;
      detected_topic?: string;
      uploaded_at: string;
    };
    indexes: { 'by-date': string };
  };
  chunks: {
    key: string;
    value: {
      id: string;
      material_id: string;
      seq: number;
      text: string;
      page?: number;
    };
    indexes: { 'by-material': string };
  };
  embeddings: {
    key: string;
    value: {
      chunk_id: string;
      dim: number;
      vector: Float32Array;
      source: 'material' | 'pyq' | 'generated';
    };
    indexes: { 'by-source': string };
  };
  generated: {
    key: string;
    value: {
      id: string;
      concept_id: string;
      topic: string;
      difficulty: number;
      question_text: string;
      correct_answer: string;
      solution_steps: string[];
      distractors: string[];
      verified: boolean;
      target_error_type?: string;
      created_at: string;
    };
    indexes: { 'by-concept': string; 'by-topic': string };
  };
}

const DB_NAME = 'gbrain';
const DB_VERSION = 1;

let _db: Promise<IDBPDatabase<GBrainDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<GBrainDB>> {
  if (_db) return _db;
  _db = openDB<GBrainDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('student')) {
        db.createObjectStore('student', { keyPath: 'session_id' });
      }
      if (!db.objectStoreNames.contains('errors')) {
        const s = db.createObjectStore('errors', { keyPath: 'id' });
        s.createIndex('by-session', 'session_id');
        s.createIndex('by-concept', 'concept_id');
        s.createIndex('by-date', 'created_at');
      }
      if (!db.objectStoreNames.contains('attempts')) {
        const s = db.createObjectStore('attempts', { keyPath: 'id' });
        s.createIndex('by-session', 'session_id');
        s.createIndex('by-date', 'created_at');
      }
      if (!db.objectStoreNames.contains('confidence')) {
        const s = db.createObjectStore('confidence', { keyPath: 'id' });
        s.createIndex('by-session', 'session_id');
      }
      if (!db.objectStoreNames.contains('materials')) {
        const s = db.createObjectStore('materials', { keyPath: 'id' });
        s.createIndex('by-date', 'uploaded_at');
      }
      if (!db.objectStoreNames.contains('chunks')) {
        const s = db.createObjectStore('chunks', { keyPath: 'id' });
        s.createIndex('by-material', 'material_id');
      }
      if (!db.objectStoreNames.contains('embeddings')) {
        const s = db.createObjectStore('embeddings', { keyPath: 'chunk_id' });
        s.createIndex('by-source', 'source');
      }
      if (!db.objectStoreNames.contains('generated')) {
        const s = db.createObjectStore('generated', { keyPath: 'id' });
        s.createIndex('by-concept', 'concept_id');
        s.createIndex('by-topic', 'topic');
      }
    },
  });
  return _db;
}

// ============================================================================
// Student Model
// ============================================================================

export async function getStudentModel(sessionId: string) {
  const db = await getDB();
  return db.get('student', sessionId);
}

export async function saveStudentModel(model: any) {
  const db = await getDB();
  await db.put('student', model);
}

// ============================================================================
// Errors
// ============================================================================

export async function logError(entry: Omit<GBrainDB['errors']['value'], 'id' | 'created_at'>): Promise<string> {
  const db = await getDB();
  const id = `err-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  await db.put('errors', { ...entry, id, created_at: new Date().toISOString() });
  return id;
}

export async function getErrors(sessionId: string, daysBack = 30): Promise<GBrainDB['errors']['value'][]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('errors', 'by-session', sessionId);
  const cutoff = Date.now() - daysBack * 86400000;
  return all.filter(e => new Date(e.created_at).getTime() >= cutoff);
}

// ============================================================================
// Attempts
// ============================================================================

export async function logAttempt(entry: Omit<GBrainDB['attempts']['value'], 'id' | 'created_at'>): Promise<string> {
  const db = await getDB();
  const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  await db.put('attempts', { ...entry, id, created_at: new Date().toISOString() });
  return id;
}

export async function getAttempts(sessionId: string, daysBack = 30) {
  const db = await getDB();
  const all = await db.getAllFromIndex('attempts', 'by-session', sessionId);
  const cutoff = Date.now() - daysBack * 86400000;
  return all.filter(a => new Date(a.created_at).getTime() >= cutoff);
}

// ============================================================================
// Confidence
// ============================================================================

export async function logConfidence(entry: Omit<GBrainDB['confidence']['value'], 'id' | 'created_at'>) {
  const db = await getDB();
  const id = `conf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  await db.put('confidence', { ...entry, id, created_at: new Date().toISOString() });
  return id;
}

// ============================================================================
// Materials
// ============================================================================

export async function saveMaterial(material: GBrainDB['materials']['value']) {
  const db = await getDB();
  await db.put('materials', material);
}

export async function getAllMaterials() {
  const db = await getDB();
  return db.getAll('materials');
}

export async function getMaterial(id: string) {
  const db = await getDB();
  return db.get('materials', id);
}

export async function deleteMaterial(id: string) {
  const db = await getDB();
  // Get chunks for this material, delete their embeddings too
  const chunks = await db.getAllFromIndex('chunks', 'by-material', id);
  const tx = db.transaction(['materials', 'chunks', 'embeddings'], 'readwrite');
  for (const c of chunks) {
    tx.objectStore('chunks').delete(c.id);
    tx.objectStore('embeddings').delete(c.id);
  }
  tx.objectStore('materials').delete(id);
  await tx.done;
}

export async function saveChunk(chunk: GBrainDB['chunks']['value']) {
  const db = await getDB();
  await db.put('chunks', chunk);
}

export async function saveEmbedding(chunkId: string, vector: Float32Array, source: 'material' | 'pyq' | 'generated' = 'material') {
  const db = await getDB();
  await db.put('embeddings', { chunk_id: chunkId, dim: vector.length, vector, source });
}

export async function getChunksForMaterial(materialId: string) {
  const db = await getDB();
  return db.getAllFromIndex('chunks', 'by-material', materialId);
}

export async function getAllMaterialEmbeddings() {
  const db = await getDB();
  return db.getAllFromIndex('embeddings', 'by-source', 'material');
}

// ============================================================================
// Generated problems cache
// ============================================================================

export async function saveGeneratedProblem(p: GBrainDB['generated']['value']) {
  const db = await getDB();
  await db.put('generated', p);
}

export async function getCachedProblems(conceptId: string, difficulty: number, tolerance = 0.15) {
  const db = await getDB();
  const all = await db.getAllFromIndex('generated', 'by-concept', conceptId);
  return all.filter(p => p.verified && Math.abs(p.difficulty - difficulty) < tolerance);
}

// ============================================================================
// Export / Import for backup
// ============================================================================

export async function exportAll(sessionId: string): Promise<Blob> {
  const db = await getDB();
  const data = {
    schema_version: DB_VERSION,
    exported_at: new Date().toISOString(),
    session_id: sessionId,
    student: await db.get('student', sessionId),
    errors: await db.getAllFromIndex('errors', 'by-session', sessionId),
    attempts: await db.getAllFromIndex('attempts', 'by-session', sessionId),
    confidence: await db.getAllFromIndex('confidence', 'by-session', sessionId),
    materials: await db.getAll('materials'),
    // Note: chunks + embeddings deliberately omitted (large, regeneratable)
  };
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

export async function importAll(json: string): Promise<void> {
  const data = JSON.parse(json);
  const db = await getDB();
  const tx = db.transaction(['student', 'errors', 'attempts', 'confidence', 'materials'], 'readwrite');
  if (data.student) await tx.objectStore('student').put(data.student);
  for (const e of (data.errors || [])) await tx.objectStore('errors').put(e);
  for (const a of (data.attempts || [])) await tx.objectStore('attempts').put(a);
  for (const c of (data.confidence || [])) await tx.objectStore('confidence').put(c);
  for (const m of (data.materials || [])) await tx.objectStore('materials').put(m);
  await tx.done;
}

// ============================================================================
// Cosine similarity (pure function)
// ============================================================================

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}

/** Top-K similarity search over all material embeddings */
export async function searchMaterials(queryVector: Float32Array, topK = 5): Promise<Array<{ chunk_id: string; score: number }>> {
  const db = await getDB();
  const embeddings = await db.getAllFromIndex('embeddings', 'by-source', 'material');
  const scored = embeddings
    .map(e => ({ chunk_id: e.chunk_id, score: cosineSimilarity(queryVector, e.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  return scored;
}
