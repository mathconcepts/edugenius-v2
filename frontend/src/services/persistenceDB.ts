/**
 * persistenceDB.ts — EduGenius Persistence Layer
 *
 * Strategy: IndexedDB via `idb` library
 * - Works offline, no auth required, zero external deps
 * - ~50MB+ capacity vs localStorage's ~5MB
 * - Async, non-blocking — won't freeze the UI
 * - When Supabase access is resolved, this becomes the offline cache
 *   and a sync layer is added on top (see syncToSupabase())
 *
 * DB Name: edugenius-db  (version 1)
 * Stores:
 *   student_profiles   — StudentPersona per studentId
 *   topic_mastery      — per-student per-topic mastery records
 *   interaction_log    — every Sage interaction event
 *   content_cache      — generated content keyed by topic+type
 *   signal_queue       — pending agent signals (drained on heartbeat)
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { StudentPersona } from './studentPersonaEngine';

// ─── Schema ───────────────────────────────────────────────────────────────────

export interface TopicMasteryRecord {
  id: string;              // `${studentId}::${examId}::${topicId}`
  studentId: string;
  examId: string;
  topicId: string;
  masteryScore: number;    // 0–1 (Bayesian knowledge tracing estimate)
  correctCount: number;
  incorrectCount: number;
  lastPracticed: string;   // ISO timestamp
  consecutiveCorrect: number;
  isMastered: boolean;     // true when masteryScore >= 0.85 && consecutiveCorrect >= 3
  updatedAt: string;
}

export interface InteractionEvent {
  id: string;              // auto-generated uuid
  studentId: string;
  examId: string;
  topicId: string;
  questionId?: string;
  correct?: boolean;
  timeSpentMs: number;
  emotionDetected?: string;
  responseRating?: number; // 1–5 explicit, or null for implicit
  messageCount: number;    // messages in session at time of event
  sessionId: string;
  createdAt: string;       // ISO timestamp
}

export interface ContentCacheEntry {
  id: string;              // `${examId}::${topicId}::${contentType}::${variant}`
  examId: string;
  topicId: string;
  contentType: 'analogy' | 'explanation' | 'hint' | 'variant_mcq' | 'summary';
  learningStyle?: string;  // analogy variants keyed to style
  content: string;
  generatedBy: string;     // 'gemini' | 'static'
  usageCount: number;
  createdAt: string;
  expiresAt: string;       // ISO — content is considered stale after this
}

export interface AgentSignal {
  id: string;
  type: 'CONTENT_GAP' | 'STRUGGLE_PATTERN' | 'MASTERY_ACHIEVED' | 'FRUSTRATION_ALERT'
       | 'COHORT_ALERT' | 'CHURN_RISK' | 'BREAKTHROUGH'
       | 'FORMAT_REQUEST' | 'SR_OVERDUE' | 'BEHAVIORAL_SNAPSHOT' | 'FORMAT_SUCCESS';
  sourceAgent: string;
  targetAgent: string;
  payload: Record<string, unknown>;
  createdAt: string;
  deliveredAt?: string;    // null = pending
  studentId?: string;
  topicId?: string;
}

// ─── DB Init ──────────────────────────────────────────────────────────────────

const DB_NAME = 'edugenius-db';
const DB_VERSION = 2;

let _db: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db;

  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // student_profiles
      if (!db.objectStoreNames.contains('student_profiles')) {
        const profileStore = db.createObjectStore('student_profiles', { keyPath: 'studentId' });
        profileStore.createIndex('by_exam', 'exam');
        profileStore.createIndex('by_updated', 'lastActive');
      }

      // topic_mastery
      if (!db.objectStoreNames.contains('topic_mastery')) {
        const masteryStore = db.createObjectStore('topic_mastery', { keyPath: 'id' });
        masteryStore.createIndex('by_student', 'studentId');
        masteryStore.createIndex('by_student_exam', ['studentId', 'examId']);
        masteryStore.createIndex('by_mastered', 'isMastered');
      }

      // interaction_log
      if (!db.objectStoreNames.contains('interaction_log')) {
        const logStore = db.createObjectStore('interaction_log', { keyPath: 'id' });
        logStore.createIndex('by_student', 'studentId');
        logStore.createIndex('by_student_topic', ['studentId', 'topicId']);
        logStore.createIndex('by_session', 'sessionId');
        logStore.createIndex('by_created', 'createdAt');
      }

      // content_cache
      if (!db.objectStoreNames.contains('content_cache')) {
        const cacheStore = db.createObjectStore('content_cache', { keyPath: 'id' });
        cacheStore.createIndex('by_topic_type', ['topicId', 'contentType']);
        cacheStore.createIndex('by_exam_topic', ['examId', 'topicId']);
        cacheStore.createIndex('by_expires', 'expiresAt');
      }

      // signal_queue
      if (!db.objectStoreNames.contains('signal_queue')) {
        const signalStore = db.createObjectStore('signal_queue', { keyPath: 'id' });
        signalStore.createIndex('by_target', 'targetAgent');
        signalStore.createIndex('by_pending', 'deliveredAt');
        signalStore.createIndex('by_type', 'type');
      }

      // sr_records (version 2) — spaced repetition records per student+exam+topic
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('sr_records')) {
          const srStore = db.createObjectStore('sr_records', { keyPath: 'id' });
          // id = `${studentId}::${examId}::${topicId}`
          srStore.createIndex('by_student_exam', ['studentId', 'examId']);
          srStore.createIndex('by_next_review', 'nextReviewAt');
        }
      }
    },
  });

  return _db;
}

// ─── Student Profile CRUD ─────────────────────────────────────────────────────

export async function saveStudentProfile(persona: StudentPersona): Promise<void> {
  const db = await getDB();
  await db.put('student_profiles', {
    ...persona,
    lastActive: new Date().toISOString(),
  });
}

export async function loadStudentProfile(studentId: string): Promise<StudentPersona | null> {
  const db = await getDB();
  const record = await db.get('student_profiles', studentId);
  return record ?? null;
}

export async function getAllStudentProfiles(): Promise<StudentPersona[]> {
  const db = await getDB();
  return db.getAll('student_profiles');
}

// ─── Topic Mastery CRUD ───────────────────────────────────────────────────────

export async function getTopicMastery(
  studentId: string,
  examId: string,
  topicId: string
): Promise<TopicMasteryRecord | null> {
  const db = await getDB();
  const key = `${studentId}::${examId}::${topicId}`;
  return db.get('topic_mastery', key) ?? null;
}

export async function getStudentMastery(
  studentId: string,
  examId: string
): Promise<TopicMasteryRecord[]> {
  const db = await getDB();
  const index = db.transaction('topic_mastery').store.index('by_student_exam');
  return index.getAll([studentId, examId]);
}

export async function updateTopicMastery(
  studentId: string,
  examId: string,
  topicId: string,
  correct: boolean
): Promise<TopicMasteryRecord> {
  const db = await getDB();
  const key = `${studentId}::${examId}::${topicId}`;
  const existing = await db.get('topic_mastery', key);

  const now = new Date().toISOString();
  const prev: TopicMasteryRecord = existing ?? {
    id: key,
    studentId,
    examId,
    topicId,
    masteryScore: 0.3,        // BKT prior
    correctCount: 0,
    incorrectCount: 0,
    lastPracticed: now,
    consecutiveCorrect: 0,
    isMastered: false,
    updatedAt: now,
  };

  // Bayesian Knowledge Tracing (simplified)
  // P(mastery | correct) = P(correct | mastery) * P(mastery) / P(correct)
  const LEARN_RATE = 0.15;
  const SLIP_RATE = 0.1;
  const GUESS_RATE = 0.2;

  let mastery = prev.masteryScore;
  if (correct) {
    const pCorrect = mastery * (1 - SLIP_RATE) + (1 - mastery) * GUESS_RATE;
    mastery = (mastery * (1 - SLIP_RATE)) / pCorrect;
    mastery = mastery + (1 - mastery) * LEARN_RATE; // learning effect
  } else {
    const pWrong = mastery * SLIP_RATE + (1 - mastery) * (1 - GUESS_RATE);
    mastery = (mastery * SLIP_RATE) / pWrong;
  }
  mastery = Math.max(0, Math.min(1, mastery)); // clamp 0–1

  const consecutiveCorrect = correct ? prev.consecutiveCorrect + 1 : 0;
  const isMastered = mastery >= 0.85 && consecutiveCorrect >= 3;

  const updated: TopicMasteryRecord = {
    ...prev,
    masteryScore: mastery,
    correctCount: prev.correctCount + (correct ? 1 : 0),
    incorrectCount: prev.incorrectCount + (correct ? 0 : 1),
    lastPracticed: now,
    consecutiveCorrect,
    isMastered,
    updatedAt: now,
  };

  await db.put('topic_mastery', updated);
  return updated;
}

export async function getWeakTopics(
  studentId: string,
  examId: string,
  limit = 3
): Promise<TopicMasteryRecord[]> {
  const records = await getStudentMastery(studentId, examId);
  // Sort by mastery ascending — lowest mastery = weakest
  return records
    .filter((r) => !r.isMastered)
    .sort((a, b) => a.masteryScore - b.masteryScore)
    .slice(0, limit);
}

export async function getMasteredTopics(
  studentId: string,
  examId: string
): Promise<string[]> {
  const records = await getStudentMastery(studentId, examId);
  return records.filter((r) => r.isMastered).map((r) => r.topicId);
}

// ─── Interaction Log ──────────────────────────────────────────────────────────

export async function logInteraction(event: Omit<InteractionEvent, 'id' | 'createdAt'>): Promise<void> {
  const db = await getDB();
  const record: InteractionEvent = {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  await db.put('interaction_log', record);
}

export async function getRecentInteractions(
  studentId: string,
  topicId: string,
  limit = 10
): Promise<InteractionEvent[]> {
  const db = await getDB();
  const index = db.transaction('interaction_log').store.index('by_student_topic');
  const all = await index.getAll([studentId, topicId]);
  return all
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export async function getInteractionCount(
  studentId: string,
  topicId: string
): Promise<number> {
  const db = await getDB();
  const index = db.transaction('interaction_log').store.index('by_student_topic');
  return index.count([studentId, topicId]);
}

// ─── Content Cache ────────────────────────────────────────────────────────────

export async function getCachedContent(
  examId: string,
  topicId: string,
  contentType: ContentCacheEntry['contentType'],
  learningStyle?: string
): Promise<ContentCacheEntry | null> {
  const db = await getDB();
  const variant = learningStyle ?? 'default';
  const key = `${examId}::${topicId}::${contentType}::${variant}`;
  const entry = await db.get('content_cache', key);

  if (!entry) return null;

  // Check expiry
  if (new Date(entry.expiresAt) < new Date()) {
    await db.delete('content_cache', key); // prune stale
    return null;
  }

  // Increment usage count
  await db.put('content_cache', { ...entry, usageCount: entry.usageCount + 1 });
  return entry;
}

export async function cacheContent(
  entry: Omit<ContentCacheEntry, 'id' | 'usageCount' | 'createdAt' | 'expiresAt'> & { ttlDays?: number }
): Promise<void> {
  const db = await getDB();
  const { ttlDays = 30, ...rest } = entry;
  const now = new Date();
  const expires = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  const variant = rest.learningStyle ?? 'default';
  const id = `${rest.examId}::${rest.topicId}::${rest.contentType}::${variant}`;

  await db.put('content_cache', {
    ...rest,
    id,
    usageCount: 0,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  });
}

// ─── Signal Queue ─────────────────────────────────────────────────────────────

export async function enqueueSignal(
  signal: Omit<AgentSignal, 'id' | 'createdAt' | 'deliveredAt'>
): Promise<void> {
  const db = await getDB();
  await db.put('signal_queue', {
    ...signal,
    id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    deliveredAt: undefined,
  });
}

export async function drainPendingSignals(targetAgent: string): Promise<AgentSignal[]> {
  const db = await getDB();
  const tx = db.transaction('signal_queue', 'readwrite');
  const index = tx.store.index('by_target');
  const all = await index.getAll(targetAgent);

  // Mark as delivered
  const pending = all.filter((s) => !s.deliveredAt);
  const now = new Date().toISOString();
  for (const signal of pending) {
    await tx.store.put({ ...signal, deliveredAt: now });
  }
  await tx.done;

  return pending;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Returns a summary of what's persisted — useful for debugging */
export async function getStorageSummary(): Promise<{
  profiles: number;
  masteryRecords: number;
  interactions: number;
  cachedContent: number;
  pendingSignals: number;
}> {
  const db = await getDB();
  const [profiles, masteryRecords, interactions, cachedContent, allSignals] = await Promise.all([
    db.count('student_profiles'),
    db.count('topic_mastery'),
    db.count('interaction_log'),
    db.count('content_cache'),
    db.getAll('signal_queue'),
  ]);
  const pendingSignals = allSignals.filter((s) => !s.deliveredAt).length;

  return { profiles, masteryRecords, interactions, cachedContent, pendingSignals };
}

// ─── SR Record Helpers (wrappers for spacedRepetition.ts) ────────────────────

/**
 * Retrieve a raw SR record from IndexedDB by composite key.
 * Used by spacedRepetition.ts — exported here so it can share the getDB() instance.
 */
export async function getSRRecordRaw(id: string): Promise<Record<string, unknown> | null> {
  const db = await getDB();
  const raw = await db.get('sr_records', id);
  return (raw as Record<string, unknown>) ?? null;
}

/**
 * Save a raw SR record object to IndexedDB.
 * Used by spacedRepetition.ts — exported here so it can share the getDB() instance.
 */
export async function saveSRRecordRaw(record: Record<string, unknown>): Promise<void> {
  const db = await getDB();
  await db.put('sr_records', record);
}

/** Prune expired content cache entries */
export async function pruneExpiredCache(): Promise<number> {
  const db = await getDB();
  const tx = db.transaction('content_cache', 'readwrite');
  const all = await tx.store.getAll();
  const now = new Date();
  let pruned = 0;
  for (const entry of all) {
    if (new Date(entry.expiresAt) < now) {
      await tx.store.delete(entry.id);
      pruned++;
    }
  }
  await tx.done;
  return pruned;
}

/**
 * Delta sync to Supabase when credentials are available.
 * IndexedDB remains the primary/offline store; Supabase is the cloud backup.
 *
 * Strategy:
 *   1. Get records with updatedAt > lastSyncedAt (from localStorage)
 *   2. Upsert to Supabase in batches of 100
 *   3. Update lastSyncedAt on success
 *   4. On conflict: Supabase wins for profiles, IndexedDB wins for interactions
 *   5. Graceful fallback if credentials missing or network fails
 */
export async function syncToSupabase(): Promise<{ synced: number; skipped: number }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Supabase not configured — IndexedDB is the sole store.
    return { synced: 0, skipped: -1 };
  }

  const LAST_SYNC_KEY = 'edugenius_last_supabase_sync';
  const lastSyncedAt = parseInt(localStorage.getItem(LAST_SYNC_KEY) ?? '0', 10);
  const now = Date.now();

  let synced = 0;
  let skipped = 0;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const db = await getDB();

    // ── 1. Sync student profiles ────────────────────────────────────────────
    const profiles = await db.getAll('student_profiles');
    const dirtyProfiles = profiles.filter((p: any) =>
      !lastSyncedAt || new Date(p.updatedAt ?? 0).getTime() > lastSyncedAt
    );

    if (dirtyProfiles.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < dirtyProfiles.length; i += BATCH) {
        const batch = dirtyProfiles.slice(i, i + BATCH).map((p: any) => ({
          student_id: p.studentId,
          exam_id: p.examId ?? null,
          data: JSON.stringify(p),
          updated_at: new Date(p.updatedAt ?? now).toISOString(),
        }));
        const { error } = await supabase
          .from('student_profiles')
          .upsert(batch, { onConflict: 'student_id' });
        if (error) {
          console.warn('[Persistence] Profile sync batch error:', error.message);
          skipped += batch.length;
        } else {
          synced += batch.length;
        }
      }
    }

    // ── 2. Sync topic mastery ────────────────────────────────────────────────
    const mastery = await db.getAll('topic_mastery');
    const dirtyMastery = mastery.filter((m: any) =>
      !lastSyncedAt || new Date(m.lastUpdated ?? 0).getTime() > lastSyncedAt
    );

    if (dirtyMastery.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < dirtyMastery.length; i += BATCH) {
        const batch = dirtyMastery.slice(i, i + BATCH).map((m: any) => ({
          id: m.id,
          student_id: m.studentId,
          exam_id: m.examId,
          topic_id: m.topicId,
          mastery_score: m.masteryScore,
          attempts: m.attempts,
          correct: m.correct,
          last_updated: new Date(m.lastUpdated ?? now).toISOString(),
        }));
        const { error } = await supabase
          .from('topic_mastery')
          .upsert(batch, { onConflict: 'id' });
        if (error) {
          console.warn('[Persistence] Mastery sync batch error:', error.message);
          skipped += batch.length;
        } else {
          synced += batch.length;
        }
      }
    }

    // ── 3. Sync recent interactions (delta only, max 500) ──────────────────
    const interactions = await db.getAll('interaction_log');
    const newInteractions = interactions
      .filter((e: any) => new Date(e.createdAt ?? 0).getTime() > lastSyncedAt)
      .slice(-500); // cap at 500 per sync cycle

    if (newInteractions.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < newInteractions.length; i += BATCH) {
        const batch = newInteractions.slice(i, i + BATCH).map((e: any) => ({
          id: e.id,
          student_id: e.studentId,
          topic_id: e.topicId,
          exam_id: e.examId ?? null,
          event_type: e.eventType,
          data: JSON.stringify(e),
          created_at: new Date(e.createdAt ?? now).toISOString(),
        }));
        const { error } = await supabase
          .from('interaction_log')
          .upsert(batch, { onConflict: 'id' });
        if (error) {
          console.warn('[Persistence] Interaction sync batch error:', error.message);
          skipped += batch.length;
        } else {
          synced += batch.length;
        }
      }
    }

    // ── 4. Update lastSyncedAt on success ──────────────────────────────────
    localStorage.setItem(LAST_SYNC_KEY, String(now));
    console.log(`[Persistence] Supabase sync complete — ${synced} synced, ${skipped} skipped`);

  } catch (err) {
    console.warn('[Persistence] Supabase sync failed (graceful fallback):', err);
    skipped++;
  }

  return { synced, skipped };
}
