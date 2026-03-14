/**
 * userPlaybookService.ts — Per-User Course Playbook with DB Archiving
 *
 * Every user can have their own "active playbook" for an exam, covering the
 * full syllabus or a partial subset of topics.
 *
 * Storage Strategy (dual-layer):
 *   localStorage (always):
 *     Active playbook : eg_user_playbook_{userId}_{examId}
 *     Index           : eg_user_playbook_index_{userId} → string[] of examIds
 *
 *   Supabase (when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY available):
 *     Table user_playbooks         — upsert by id
 *     Table user_playbook_archive  — insert-only snapshots
 *
 * Pattern: same as persistenceDB.ts and ragIndexer.ts
 *   dynamic `await import('@supabase/supabase-js')`, check env vars first.
 */

import { isSupabaseAvailable } from './coursePlaybookService';

// ─── Core Types ───────────────────────────────────────────────────────────────

export type SyllabusScope = 'full' | 'partial';

export interface UserPlaybookScope {
  /** 'full' = all topics; 'partial' = selectedTopicIds only */
  scopeType: SyllabusScope;
  /** if partial: only these topics are active; if full: ignored */
  selectedTopicIds: string[];
  /** optional finer-grain: restrict within selected topics */
  selectedSubtopicIds?: string[];
  /** full scope minus these */
  excludedTopicIds?: string[];
  /** user-defined study order (overrides system order) */
  customOrder?: string[];
}

export interface UserPlaybook {
  /** '{userId}__{examId}' — one active playbook per user per exam */
  id: string;
  userId: string;
  examId: string;
  examName: string;
  scope: UserPlaybookScope;
  status: 'active' | 'paused' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
  version: number;

  /** Progress tracking per topic: topicId → progress */
  topicProgress: Record<string, {
    masteryScore: number;         // 0–1
    sessionsCompleted: number;
    lastStudiedAt?: string;
    status: 'not_started' | 'in_progress' | 'mastered' | 'skipped';
    subtopicProgress?: Record<string, { masteryScore: number; status: string }>;
  }>;

  /** Playbook-level metadata */
  meta: {
    totalTopics: number;          // active topics count (respects scope)
    completedTopics: number;
    overallMastery: number;       // 0–1 weighted average
    estimatedHoursRemaining: number;
    lastOrchestratorDecisionId?: string;
    generatedBy: 'system' | 'ceo_manual' | 'user_request';
    notes?: string;               // CEO notes
  };

  /** Archive snapshots appended each time playbook is saved to DB */
  archiveHistory: Array<{
    snapshotAt: string;
    version: number;
    overallMastery: number;
    completedTopics: number;
    trigger: 'session_end' | 'mastery_milestone' | 'scope_change' | 'manual_save' | 'daily_sync';
  }>;
}

export type ArchiveTrigger = UserPlaybook['archiveHistory'][0]['trigger'];

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const USER_PLAYBOOK_PREFIX = 'eg_user_playbook_';
const USER_PLAYBOOK_INDEX_PREFIX = 'eg_user_playbook_index_';

function playbookStorageKey(userId: string, examId: string): string {
  return `${USER_PLAYBOOK_PREFIX}${userId}_${examId}`;
}

function playbookIndexKey(userId: string): string {
  return `${USER_PLAYBOOK_INDEX_PREFIX}${userId}`;
}

// ─── Index Helpers ────────────────────────────────────────────────────────────

function readUserIndex(userId: string): string[] {
  try {
    const raw = localStorage.getItem(playbookIndexKey(userId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function addToUserIndex(userId: string, examId: string): void {
  try {
    const idx = readUserIndex(userId);
    if (!idx.includes(examId)) {
      idx.push(examId);
      localStorage.setItem(playbookIndexKey(userId), JSON.stringify(idx));
    }
  } catch { /* quota exceeded — best-effort */ }
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function upsertPlaybookToSupabase(playbook: UserPlaybook): Promise<void> {
  if (!isSupabaseAvailable()) return;

  const supabaseUrl = (typeof import.meta !== 'undefined'
    ? (import.meta as unknown as Record<string, Record<string, string>>).env?.VITE_SUPABASE_URL
    : undefined) ?? '';
  const supabaseKey = (typeof import.meta !== 'undefined'
    ? (import.meta as unknown as Record<string, Record<string, string>>).env?.VITE_SUPABASE_ANON_KEY
    : undefined) ?? '';

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error } = await supabase.from('user_playbooks').upsert(
    {
      id:            playbook.id,
      user_id:       playbook.userId,
      exam_id:       playbook.examId,
      playbook_json: playbook,
      version:       playbook.version,
      updated_at:    playbook.updatedAt,
    },
    { onConflict: 'id' },
  );

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }
}

async function insertArchiveToSupabase(
  playbook: UserPlaybook,
  trigger: ArchiveTrigger,
): Promise<void> {
  if (!isSupabaseAvailable()) return;

  const supabaseUrl = (typeof import.meta !== 'undefined'
    ? (import.meta as unknown as Record<string, Record<string, string>>).env?.VITE_SUPABASE_URL
    : undefined) ?? '';
  const supabaseKey = (typeof import.meta !== 'undefined'
    ? (import.meta as unknown as Record<string, Record<string, string>>).env?.VITE_SUPABASE_ANON_KEY
    : undefined) ?? '';

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error } = await supabase.from('user_playbook_archive').insert({
    user_id:            playbook.userId,
    exam_id:            playbook.examId,
    snapshot_json:      playbook,
    version:            playbook.version,
    mastery_at_snapshot: playbook.meta.overallMastery,
    trigger,
    created_at:         new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Supabase archive insert failed: ${error.message}`);
  }
}

// ─── CREATE / LOAD / SAVE ─────────────────────────────────────────────────────

/**
 * Create a brand-new UserPlaybook for a user+exam combination.
 * Does NOT save automatically — call saveUserPlaybook() after.
 */
export function createUserPlaybook(
  userId: string,
  examId: string,
  scope: UserPlaybookScope,
): UserPlaybook {
  const now = new Date().toISOString();
  return {
    id: `${userId}__${examId}`,
    userId,
    examId,
    examName: examId, // caller can override after creation
    scope,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    version: 1,
    topicProgress: {},
    meta: {
      totalTopics: 0,
      completedTopics: 0,
      overallMastery: 0,
      estimatedHoursRemaining: 0,
      generatedBy: 'system',
    },
    archiveHistory: [],
  };
}

/**
 * Load a UserPlaybook from localStorage.
 * Returns null if not found.
 */
export function loadUserPlaybook(userId: string, examId: string): UserPlaybook | null {
  try {
    const raw = localStorage.getItem(playbookStorageKey(userId, examId));
    return raw ? (JSON.parse(raw) as UserPlaybook) : null;
  } catch {
    return null;
  }
}

/**
 * Save a UserPlaybook to localStorage (synchronous).
 * Also updates the per-user index.
 */
export function saveUserPlaybook(playbook: UserPlaybook): void {
  try {
    const updated = { ...playbook, updatedAt: new Date().toISOString() };
    localStorage.setItem(playbookStorageKey(playbook.userId, playbook.examId), JSON.stringify(updated));
    addToUserIndex(playbook.userId, playbook.examId);
  } catch { /* quota exceeded — best-effort */ }
}

/**
 * Persist a UserPlaybook to Supabase (async upsert).
 * Falls back silently to localStorage-only if Supabase unavailable or fails.
 */
export async function persistUserPlaybook(playbook: UserPlaybook): Promise<void> {
  // Always sync to localStorage first
  saveUserPlaybook(playbook);

  try {
    await upsertPlaybookToSupabase(playbook);
  } catch (err) {
    // Graceful fallback — localStorage is already updated above
    console.warn('[UserPlaybook] Supabase persist failed (localStorage fallback active):', err);
  }
}

// ─── SCOPE MANAGEMENT ─────────────────────────────────────────────────────────

/**
 * Set the playbook to cover the full syllabus for the given exam.
 * Returns an updated (immutable) copy — does NOT save.
 */
export function setFullSyllabus(playbook: UserPlaybook, _examId: string): UserPlaybook {
  return {
    ...playbook,
    scope: {
      ...playbook.scope,
      scopeType: 'full',
      selectedTopicIds: [],
      excludedTopicIds: [],
    },
    updatedAt: new Date().toISOString(),
    version: playbook.version + 1,
  };
}

/**
 * Set the playbook to cover only the given topicIds (partial syllabus).
 * Returns an updated (immutable) copy — does NOT save.
 */
export function setPartialSyllabus(
  playbook: UserPlaybook,
  topicIds: string[],
  subtopicIds?: string[],
): UserPlaybook {
  return {
    ...playbook,
    scope: {
      ...playbook.scope,
      scopeType: 'partial',
      selectedTopicIds: [...topicIds],
      selectedSubtopicIds: subtopicIds ? [...subtopicIds] : playbook.scope.selectedSubtopicIds,
    },
    updatedAt: new Date().toISOString(),
    version: playbook.version + 1,
  };
}

/**
 * Add topics to the playbook scope.
 * - If full scope: moves them out of excludedTopicIds.
 * - If partial scope: adds them to selectedTopicIds.
 * Returns an updated copy — does NOT save.
 */
export function addTopicsToScope(playbook: UserPlaybook, topicIds: string[]): UserPlaybook {
  const scope = playbook.scope;

  if (scope.scopeType === 'full') {
    const excluded = (scope.excludedTopicIds ?? []).filter(id => !topicIds.includes(id));
    return {
      ...playbook,
      scope: { ...scope, excludedTopicIds: excluded },
      updatedAt: new Date().toISOString(),
      version: playbook.version + 1,
    };
  }

  // partial
  const selected = [...new Set([...scope.selectedTopicIds, ...topicIds])];
  return {
    ...playbook,
    scope: { ...scope, selectedTopicIds: selected },
    updatedAt: new Date().toISOString(),
    version: playbook.version + 1,
  };
}

/**
 * Remove topics from the playbook scope.
 * - If full scope: adds them to excludedTopicIds.
 * - If partial scope: removes them from selectedTopicIds.
 * Returns an updated copy — does NOT save.
 */
export function removeTopicsFromScope(playbook: UserPlaybook, topicIds: string[]): UserPlaybook {
  const scope = playbook.scope;

  if (scope.scopeType === 'full') {
    const excluded = [...new Set([...(scope.excludedTopicIds ?? []), ...topicIds])];
    return {
      ...playbook,
      scope: { ...scope, excludedTopicIds: excluded },
      updatedAt: new Date().toISOString(),
      version: playbook.version + 1,
    };
  }

  // partial
  const selected = scope.selectedTopicIds.filter(id => !topicIds.includes(id));
  return {
    ...playbook,
    scope: { ...scope, selectedTopicIds: selected },
    updatedAt: new Date().toISOString(),
    version: playbook.version + 1,
  };
}

/**
 * Resolve the active topic IDs given the full exam topic list.
 * Full scope: all topics minus excluded.
 * Partial scope: only selectedTopicIds, respecting customOrder if set.
 */
export function getActiveTopicIds(playbook: UserPlaybook, allTopicIds: string[]): string[] {
  const { scope } = playbook;

  let active: string[];

  if (scope.scopeType === 'full') {
    const excluded = new Set(scope.excludedTopicIds ?? []);
    active = allTopicIds.filter(id => !excluded.has(id));
  } else {
    // partial: only selected topics that also appear in allTopicIds
    const selected = new Set(scope.selectedTopicIds);
    active = allTopicIds.filter(id => selected.has(id));
  }

  // Apply customOrder if provided
  if (scope.customOrder && scope.customOrder.length > 0) {
    const orderMap = new Map(scope.customOrder.map((id, idx) => [id, idx]));
    active.sort((a, b) => {
      const ia = orderMap.has(a) ? orderMap.get(a)! : active.length;
      const ib = orderMap.has(b) ? orderMap.get(b)! : active.length;
      return ia - ib;
    });
  }

  return active;
}

// ─── PROGRESS UPDATES ─────────────────────────────────────────────────────────

type TopicProgressEntry = UserPlaybook['topicProgress'][string];

/**
 * Patch progress for a single topic.
 * Returns an updated copy — does NOT save.
 */
export function updateTopicProgress(
  playbook: UserPlaybook,
  topicId: string,
  patch: Partial<TopicProgressEntry>,
): UserPlaybook {
  const existing: TopicProgressEntry = playbook.topicProgress[topicId] ?? {
    masteryScore: 0,
    sessionsCompleted: 0,
    status: 'not_started',
  };

  return {
    ...playbook,
    topicProgress: {
      ...playbook.topicProgress,
      [topicId]: { ...existing, ...patch },
    },
    updatedAt: new Date().toISOString(),
    version: playbook.version + 1,
  };
}

/**
 * Record a study session for a topic, applying a mastery delta.
 * Automatically updates status based on new mastery score.
 * Returns an updated copy — does NOT save.
 */
export function recordPlaybookSession(
  playbook: UserPlaybook,
  topicId: string,
  masteryDelta: number,
): UserPlaybook {
  const now = new Date().toISOString();
  const existing: TopicProgressEntry = playbook.topicProgress[topicId] ?? {
    masteryScore: 0,
    sessionsCompleted: 0,
    status: 'not_started',
  };

  const newMastery = Math.max(0, Math.min(1, existing.masteryScore + masteryDelta));
  const newStatus: TopicProgressEntry['status'] =
    newMastery >= 0.85 ? 'mastered'
    : newMastery > 0    ? 'in_progress'
    : 'not_started';

  const updated = updateTopicProgress(playbook, topicId, {
    masteryScore: Math.round(newMastery * 1000) / 1000,
    sessionsCompleted: existing.sessionsCompleted + 1,
    lastStudiedAt: now,
    status: newStatus,
  });

  return recomputeMeta(updated);
}

/**
 * Recompute all meta fields (totals, overall mastery, ETA).
 * Should be called after any batch of progress updates.
 * Returns an updated copy — does NOT save.
 */
export function recomputeMeta(playbook: UserPlaybook): UserPlaybook {
  const progress = Object.values(playbook.topicProgress);
  const totalTopics = Object.keys(playbook.topicProgress).length;
  const completedTopics = progress.filter(p => p.status === 'mastered').length;
  const overallMastery = totalTopics > 0
    ? progress.reduce((sum, p) => sum + p.masteryScore, 0) / totalTopics
    : 0;

  // Rough ETA: assume 3h per topic to mastery; remaining = (1 - mastery) * 3h per topic
  const estimatedHoursRemaining = progress
    .filter(p => p.status !== 'mastered' && p.status !== 'skipped')
    .reduce((sum, p) => sum + (1 - p.masteryScore) * 3, 0);

  return {
    ...playbook,
    meta: {
      ...playbook.meta,
      totalTopics,
      completedTopics,
      overallMastery: Math.round(overallMastery * 1000) / 1000,
      estimatedHoursRemaining: Math.round(estimatedHoursRemaining * 10) / 10,
    },
    updatedAt: new Date().toISOString(),
  };
}

// ─── ARCHIVE ──────────────────────────────────────────────────────────────────

/**
 * Archive a snapshot of the current playbook state.
 * Appends to archiveHistory (localStorage) and inserts to Supabase if available.
 * The playbook object itself is NOT mutated — call saveUserPlaybook separately.
 */
export async function archivePlaybookSnapshot(
  playbook: UserPlaybook,
  trigger: ArchiveTrigger,
): Promise<void> {
  const now = new Date().toISOString();
  const snapshot: UserPlaybook['archiveHistory'][0] = {
    snapshotAt: now,
    version: playbook.version,
    overallMastery: playbook.meta.overallMastery,
    completedTopics: playbook.meta.completedTopics,
    trigger,
  };

  // Update archiveHistory in localStorage
  const withHistory: UserPlaybook = {
    ...playbook,
    archiveHistory: [...playbook.archiveHistory.slice(-99), snapshot],
    updatedAt: now,
  };
  saveUserPlaybook(withHistory);

  // Insert to Supabase (non-blocking, graceful fallback)
  try {
    await insertArchiveToSupabase(withHistory, trigger);
  } catch (err) {
    console.warn('[UserPlaybook] Supabase archive insert failed (localStorage fallback active):', err);
  }
}

/**
 * Get the archive history for a user+exam.
 * Tries Supabase first; falls back to localStorage archiveHistory.
 */
export async function getArchiveHistory(
  userId: string,
  examId: string,
): Promise<UserPlaybook['archiveHistory']> {
  if (isSupabaseAvailable()) {
    try {
      const supabaseUrl = (typeof import.meta !== 'undefined'
        ? (import.meta as unknown as Record<string, Record<string, string>>).env?.VITE_SUPABASE_URL
        : undefined) ?? '';
      const supabaseKey = (typeof import.meta !== 'undefined'
        ? (import.meta as unknown as Record<string, Record<string, string>>).env?.VITE_SUPABASE_ANON_KEY
        : undefined) ?? '';

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data, error } = await supabase
        .from('user_playbook_archive')
        .select('snapshot_json, created_at, trigger, version, mastery_at_snapshot')
        .eq('user_id', userId)
        .eq('exam_id', examId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data && data.length > 0) {
        return data.map(row => ({
          snapshotAt: row.created_at as string,
          version: row.version as number,
          overallMastery: row.mastery_at_snapshot as number,
          completedTopics: (row.snapshot_json as UserPlaybook)?.meta?.completedTopics ?? 0,
          trigger: row.trigger as ArchiveTrigger,
        }));
      }
    } catch { /* fallback to localStorage */ }
  }

  // Fallback: localStorage
  const playbook = loadUserPlaybook(userId, examId);
  return playbook?.archiveHistory ?? [];
}

// ─── QUERY ────────────────────────────────────────────────────────────────────

/**
 * Return all UserPlaybooks for a given user (all exams).
 */
export function getUserPlaybooks(userId: string): UserPlaybook[] {
  const examIds = readUserIndex(userId);
  const playbooks: UserPlaybook[] = [];
  for (const examId of examIds) {
    const playbook = loadUserPlaybook(userId, examId);
    if (playbook) playbooks.push(playbook);
  }
  return playbooks;
}

/**
 * Return topic coverage stats: how many topics are included vs the full syllabus.
 * Requires the caller to pass in the full topic count for the exam.
 */
export function getPlaybookCoverage(
  playbook: UserPlaybook,
): { covered: number; total: number; pct: number } {
  const { scope, meta } = playbook;

  const covered =
    scope.scopeType === 'full'
      ? Math.max(0, meta.totalTopics - (scope.excludedTopicIds?.length ?? 0))
      : scope.selectedTopicIds.length;

  const total = meta.totalTopics || covered;
  const pct = total > 0 ? Math.round((covered / total) * 100) : 0;

  return { covered, total, pct };
}

/**
 * Return the next topic to study based on progress + custom order.
 * Priority: in_progress first (lowest mastery), then not_started.
 * Returns null if all topics are mastered or there are no topics.
 */
export function getNextStudyTopic(playbook: UserPlaybook): string | null {
  const { scope, topicProgress } = playbook;

  // Build ordered list of active topics
  let activeIds: string[];
  if (scope.scopeType === 'partial') {
    activeIds = [...scope.selectedTopicIds];
  } else {
    const excluded = new Set(scope.excludedTopicIds ?? []);
    activeIds = Object.keys(topicProgress).filter(id => !excluded.has(id));
  }

  if (scope.customOrder && scope.customOrder.length > 0) {
    const orderMap = new Map(scope.customOrder.map((id, idx) => [id, idx]));
    activeIds.sort((a, b) => {
      const ia = orderMap.has(a) ? orderMap.get(a)! : activeIds.length;
      const ib = orderMap.has(b) ? orderMap.get(b)! : activeIds.length;
      return ia - ib;
    });
  }

  // in_progress topics (lowest mastery first)
  const inProgress = activeIds
    .map(id => ({ id, prog: topicProgress[id] }))
    .filter(x => x.prog && x.prog.status === 'in_progress')
    .sort((a, b) => (a.prog?.masteryScore ?? 0) - (b.prog?.masteryScore ?? 0));

  if (inProgress.length > 0) return inProgress[0].id;

  // not_started topics (respect custom order)
  const notStarted = activeIds.find(id => {
    const prog = topicProgress[id];
    return !prog || prog.status === 'not_started';
  });

  return notStarted ?? null;
}
