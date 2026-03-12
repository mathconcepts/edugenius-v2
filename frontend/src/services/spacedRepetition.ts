/**
 * spacedRepetition.ts — SM-2 Spaced Repetition Scheduler
 *
 * SM-2 algorithm adapted for EdTech:
 *   - Quality 0-5 based on practice performance
 *   - Interval doubles on success, resets on failure
 *   - Ease factor adapts per student-topic pair
 *
 * Integration points:
 *   - Practice.tsx: after each MCQ, update SR record
 *   - LensEngine: reads next_review_at to prioritise topics
 *   - Sage: mentions "you're due to review X" proactively
 *   - Mentor: fires review nudge when topic is overdue
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SRRecord {
  id: string;               // `${studentId}::${examId}::${topicId}`
  studentId: string;
  topicId: string;
  examId: string;
  easeFactor: number;       // starts at 2.5, min 1.3
  interval: number;         // days until next review
  repetitions: number;      // successful review count
  lastReviewedAt: Date;
  nextReviewAt: Date;
  lastQuality: number;      // 0–5 score from last practice
  totalReviews: number;
}

export interface SRUpdate {
  quality: number;  // 0=blackout, 1=wrong, 2=wrong-easy, 3=correct-hard, 4=correct, 5=perfect
}

// ─── SM-2 Constants ───────────────────────────────────────────────────────────

const MIN_EASE_FACTOR = 1.3;
const INITIAL_EASE_FACTOR = 2.5;

// ─── SM-2 Core Algorithm ──────────────────────────────────────────────────────

/**
 * Update an SR record using the SM-2 algorithm.
 * If record is null (new topic), creates one from scratch.
 *
 * SM-2 rules:
 *   - quality < 3: reset interval to 1, keep repetitions at 0, ease factor decreases
 *   - quality >= 3: increase interval based on ease factor, ease factor adjusts
 *   - interval: 1 → 6 → interval * easeFactor (rounded)
 */
export function updateSRRecord(
  record: SRRecord | null,
  update: SRUpdate,
  studentId: string,
  topicId: string,
  examId: string
): SRRecord {
  const { quality } = update;

  // Clamp quality to valid range
  const q = Math.max(0, Math.min(5, quality));

  const now = new Date();
  const id = `${studentId}::${examId}::${topicId}`;

  if (!record) {
    // New record — bootstrap with SM-2 first review logic
    const easeFactor = INITIAL_EASE_FACTOR;
    let interval = 1;
    let repetitions = 0;

    if (q >= 3) {
      interval = 1;
      repetitions = 1;
    }

    const newEase = Math.max(
      MIN_EASE_FACTOR,
      easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    );

    const nextReviewAt = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

    return {
      id,
      studentId,
      topicId,
      examId,
      easeFactor: newEase,
      interval,
      repetitions,
      lastReviewedAt: now,
      nextReviewAt,
      lastQuality: q,
      totalReviews: 1,
    };
  }

  // Existing record — apply SM-2 update
  let { easeFactor, interval, repetitions } = record;

  if (q < 3) {
    // Failed recall — reset
    interval = 1;
    repetitions = 0;
  } else {
    // Successful recall
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions++;
  }

  // Adjust ease factor (never below minimum)
  easeFactor = Math.max(
    MIN_EASE_FACTOR,
    easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  );

  const nextReviewAt = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

  return {
    ...record,
    easeFactor,
    interval,
    repetitions,
    lastReviewedAt: now,
    nextReviewAt,
    lastQuality: q,
    totalReviews: record.totalReviews + 1,
  };
}

// ─── Quality score from practice result ──────────────────────────────────────

/**
 * Maps a practice result to SM-2 quality score (0–5).
 *
 * Scoring logic:
 *   - Wrong answer → 0–2 (worse if took long / used hints)
 *   - Correct + fast + no hints → 5 (perfect)
 *   - Correct + medium time → 4
 *   - Correct + slow or hints used → 3
 */
export function qualityFromPracticeResult(
  correct: boolean,
  timeSpentSeconds: number,
  hintsUsed: number
): number {
  if (!correct) {
    // Wrong — quality 0, 1, or 2
    if (hintsUsed === 0 && timeSpentSeconds < 30) return 1;  // quick wrong guess
    if (hintsUsed > 0) return 0;                              // used hints and still wrong
    return 2;                                                  // wrong but thought about it
  }

  // Correct answer — quality 3, 4, or 5
  const FAST_THRESHOLD_S = 30;  // < 30s = fast
  const SLOW_THRESHOLD_S = 120; // > 2 min = slow

  if (hintsUsed === 0 && timeSpentSeconds < FAST_THRESHOLD_S) return 5;  // perfect
  if (hintsUsed === 0 && timeSpentSeconds < SLOW_THRESHOLD_S) return 4;  // correct, comfortable
  return 3; // correct but needed hints or took long — "correct hard"
}

// ─── DB helpers (IndexedDB via persistenceDB getDB) ──────────────────────────

async function getDB() {
  const { getDB: _getDB } = await import('./persistenceDB');
  return _getDB();
}

// ─── Serialize / deserialize (IndexedDB stores Dates as strings) ──────────────

function serializeRecord(record: SRRecord): Record<string, unknown> {
  return {
    ...record,
    lastReviewedAt: record.lastReviewedAt.toISOString(),
    nextReviewAt: record.nextReviewAt.toISOString(),
  };
}

function deserializeRecord(raw: Record<string, unknown>): SRRecord {
  return {
    ...(raw as unknown as SRRecord),
    lastReviewedAt: new Date(raw.lastReviewedAt as string),
    nextReviewAt: new Date(raw.nextReviewAt as string),
  };
}

// ─── Persistence ──────────────────────────────────────────────────────────────

/**
 * Save an SR record to IndexedDB `sr_records` store.
 */
export async function saveSRRecord(record: SRRecord): Promise<void> {
  try {
    const db = await getDB();
    await db.put('sr_records', serializeRecord(record));
  } catch (err) {
    console.warn('[SpacedRepetition] Failed to save SR record:', err);
  }
}

/**
 * Load an SR record from IndexedDB. Returns null if not found.
 */
export async function loadSRRecord(
  studentId: string,
  topicId: string,
  examId: string
): Promise<SRRecord | null> {
  try {
    const db = await getDB();
    const id = `${studentId}::${examId}::${topicId}`;
    const raw = await db.get('sr_records', id);
    if (!raw) return null;
    return deserializeRecord(raw as Record<string, unknown>);
  } catch (err) {
    console.warn('[SpacedRepetition] Failed to load SR record:', err);
    return null;
  }
}

// ─── Query functions ──────────────────────────────────────────────────────────

/**
 * Returns topics due for review (nextReviewAt <= now), sorted by most overdue first.
 */
export async function getDueTopics(
  studentId: string,
  examId: string,
  limit = 10
): Promise<SRRecord[]> {
  try {
    const db = await getDB();
    const tx = db.transaction('sr_records', 'readonly');
    const index = tx.store.index('by_student_exam');
    const all = await index.getAll([studentId, examId]);
    await tx.done;

    const now = new Date();
    return all
      .map((r) => deserializeRecord(r as Record<string, unknown>))
      .filter((r) => r.nextReviewAt <= now)
      .sort((a, b) => a.nextReviewAt.getTime() - b.nextReviewAt.getTime())
      .slice(0, limit);
  } catch (err) {
    console.warn('[SpacedRepetition] getDueTopics failed:', err);
    return [];
  }
}

/**
 * Returns topics overdue by more than 1 day.
 */
export async function getOverdueTopics(
  studentId: string,
  examId: string
): Promise<SRRecord[]> {
  try {
    const due = await getDueTopics(studentId, examId, 50);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return due.filter((r) => r.nextReviewAt <= oneDayAgo);
  } catch (err) {
    console.warn('[SpacedRepetition] getOverdueTopics failed:', err);
    return [];
  }
}

/**
 * Returns a summary of SR state for a student + exam.
 */
export async function getSRSummary(
  studentId: string,
  examId: string
): Promise<{
  dueCount: number;
  overdueCount: number;
  masteredCount: number;
  nextDueAt: Date | null;
}> {
  try {
    const db = await getDB();
    const tx = db.transaction('sr_records', 'readonly');
    const index = tx.store.index('by_student_exam');
    const all = await index.getAll([studentId, examId]);
    await tx.done;

    const records = all.map((r) => deserializeRecord(r as Record<string, unknown>));
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const due = records.filter((r) => r.nextReviewAt <= now);
    const overdue = due.filter((r) => r.nextReviewAt <= oneDayAgo);
    // Mastered = ease factor high + many successful repetitions + interval > 21 days
    const mastered = records.filter((r) => r.repetitions >= 5 && r.interval >= 21);

    const upcoming = records
      .filter((r) => r.nextReviewAt > now)
      .sort((a, b) => a.nextReviewAt.getTime() - b.nextReviewAt.getTime());

    return {
      dueCount: due.length,
      overdueCount: overdue.length,
      masteredCount: mastered.length,
      nextDueAt: upcoming.length > 0 ? upcoming[0].nextReviewAt : null,
    };
  } catch (err) {
    console.warn('[SpacedRepetition] getSRSummary failed:', err);
    return { dueCount: 0, overdueCount: 0, masteredCount: 0, nextDueAt: null };
  }
}

// ─── SRCard (localStorage-based, for SpacedRepetitionWidget) ─────────────────
// Separate from the IndexedDB SRRecord above — simpler, for standalone widget

export interface SRCard {
  id: string;
  topic: string;
  subject: string;
  concept: string;
  difficulty: number; // 0-1
  lastSeen: number;   // timestamp
  nextReview: number; // timestamp
  interval: number;   // days
  easeFactor: number; // SM-2
  repetitions: number;
  retentionScore: number; // 0-100 estimated
}

const SR_CARDS_KEY = 'eg_sr_cards';

export function getAllCards(): SRCard[] {
  try {
    return JSON.parse(localStorage.getItem(SR_CARDS_KEY) ?? '[]') as SRCard[];
  } catch { return []; }
}

export function saveCard(card: SRCard): void {
  const cards = getAllCards().filter(c => c.id !== card.id);
  localStorage.setItem(SR_CARDS_KEY, JSON.stringify([...cards, card]));
}

export function getDueCards(): SRCard[] {
  const now = Date.now();
  return getAllCards()
    .filter(c => c.nextReview <= now)
    .sort((a, b) => a.nextReview - b.nextReview);
}

export function addCard(topic: string, subject: string, concept: string): SRCard {
  const card: SRCard = {
    id: `${topic.replace(/\s+/g, '_')}_${Date.now()}`,
    topic,
    subject,
    concept,
    difficulty: 0.5,
    lastSeen: 0,
    nextReview: Date.now(),
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
    retentionScore: 100,
  };
  saveCard(card);
  return card;
}

export function calculateNextReview(card: SRCard, quality: 0 | 1 | 2 | 3 | 4 | 5): SRCard {
  let { easeFactor, interval, repetitions } = card;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
  }

  easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const retentionScore = Math.min(100, Math.round(100 * Math.exp(-0.1 * interval)));

  return {
    ...card,
    easeFactor,
    interval,
    repetitions,
    lastSeen: Date.now(),
    nextReview: Date.now() + interval * 86400000,
    retentionScore,
  };
}

export function ensureSampleCards(): void {
  if (getAllCards().length > 0) return;
  const samples = [
    { topic: "Faraday's Law", subject: 'Electromagnetics', concept: 'EMF = -dΦ/dt. Rate of change of flux induces EMF.' },
    { topic: "Lenz's Law", subject: 'Electromagnetics', concept: 'Induced current opposes the change in flux that caused it.' },
    { topic: 'Biot-Savart Law', subject: 'Electromagnetics', concept: 'dB = (μ₀/4π) × (I dl × r̂)/r²' },
    { topic: 'Merge Sort', subject: 'Algorithms', concept: 'Divide and conquer. O(n log n) always. Stable sort.' },
    { topic: 'P vs NP', subject: 'Theory of Computation', concept: 'P ⊆ NP. Whether P=NP is the greatest unsolved CS problem.' },
    { topic: 'Thevenin Theorem', subject: 'Circuit Theory', concept: 'Any linear circuit ≡ Vth in series with Rth.' },
    { topic: 'Dijkstra Algorithm', subject: 'Algorithms', concept: 'Greedy shortest path. O((V+E) log V) with binary heap.' },
  ];
  samples.forEach(s => addCard(s.topic, s.subject, s.concept));
}
