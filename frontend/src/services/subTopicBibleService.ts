/**
 * subTopicBibleService.ts — SubTopic Bible
 *
 * Canonical reference for every topic/subtopic's:
 *   - Core learning objectives
 *   - Common mistakes and misconceptions
 *   - Prerequisite map
 *   - Exam weightings
 *   - Orchestration metadata (updated by CourseOrchestrator on each session)
 *
 * The orchestrator reads from this bible to inject context into its decision,
 * and writes back orchestration signals so the bible stays live.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubTopicEntry {
  topicId: string;
  topicName: string;
  subTopics: string[];
  commonMistakes: string[];
  prerequisites: string[];
  examWeight: number;          // 0–1 relative importance for the exam
  conceptDifficulty: 'easy' | 'medium' | 'hard';
  estimatedStudyHours: number;
}

export interface BibleOrchestrationData {
  /** Session ID of the most recent orchestrator decision referencing this topic */
  lastOrchestrationSessionId?: string;
  /** Timestamp of last orchestration */
  lastOrchestrationTs?: number;
  /** Objective type chosen by orchestrator on last session */
  lastObjectiveType?: string;
  /** Phase at time of last orchestration */
  lastPhase?: string;
}

export interface SubTopicBible {
  examId: string;
  topics: SubTopicEntry[];
  /** Per-topic orchestration state — updated by emitOrchestratorSignals() */
  orchestrationData: Record<string, BibleOrchestrationData>;
  updatedAt: number;
}

// ─── Storage key ──────────────────────────────────────────────────────────────

const BIBLE_LS_PREFIX = 'edugenius_subtopic_bible_';

function bibleKey(examId: string): string {
  return `${BIBLE_LS_PREFIX}${examId}`;
}

// ─── Built-in seed data (minimal, extensible) ─────────────────────────────────

const SEED_BIBLES: Record<string, SubTopicEntry[]> = {
  GATE_EM: [
    {
      topicId: 'linear_algebra',
      topicName: 'Linear Algebra',
      subTopics: ['Eigenvalues & Eigenvectors', 'Matrix operations', 'Determinants', 'Rank & Nullity', 'SVD'],
      commonMistakes: ['Confusing eigenvalue with determinant', 'Wrong cofactor sign in adjugate', 'Forgetting to check consistency before solving'],
      prerequisites: [],
      examWeight: 0.12,
      conceptDifficulty: 'medium',
      estimatedStudyHours: 8,
    },
    {
      topicId: 'calculus',
      topicName: 'Calculus',
      subTopics: ['Limits & Continuity', 'Differentiation', 'Integration', 'Partial derivatives', 'Gradient & Divergence'],
      commonMistakes: ['L\'Hôpital misapplication', 'Chain rule omission', 'Wrong integration limits'],
      prerequisites: [],
      examWeight: 0.10,
      conceptDifficulty: 'medium',
      estimatedStudyHours: 10,
    },
    {
      topicId: 'probability',
      topicName: 'Probability & Statistics',
      subTopics: ['Bayes theorem', 'Random variables', 'Distributions', 'Hypothesis testing', 'Central Limit Theorem'],
      commonMistakes: ['Confusing conditional and joint probability', 'Wrong application of Bayes', 'Ignoring continuity correction'],
      prerequisites: ['calculus'],
      examWeight: 0.08,
      conceptDifficulty: 'medium',
      estimatedStudyHours: 7,
    },
  ],
  JEE: [
    {
      topicId: 'mechanics',
      topicName: 'Mechanics',
      subTopics: ['Kinematics', 'Newton\'s Laws', 'Work-Energy', 'Rotational Motion', 'Gravitation'],
      commonMistakes: ['Sign errors in vectors', 'Ignoring friction direction', 'Wrong moment of inertia formula'],
      prerequisites: [],
      examWeight: 0.18,
      conceptDifficulty: 'medium',
      estimatedStudyHours: 15,
    },
  ],
};

// ─── Bible loader ─────────────────────────────────────────────────────────────

/**
 * Load the SubTopic Bible for a given exam from localStorage,
 * falling back to seed data if not yet saved.
 */
export function loadBible(examId: string): SubTopicBible {
  try {
    const raw = localStorage.getItem(bibleKey(examId));
    if (raw) {
      return JSON.parse(raw) as SubTopicBible;
    }
  } catch { /* ignore */ }

  // Build from seed
  const topics = SEED_BIBLES[examId] ?? [];
  return {
    examId,
    topics,
    orchestrationData: {},
    updatedAt: Date.now(),
  };
}

/**
 * Save the bible (with orchestration data) back to localStorage.
 */
export function saveBible(bible: SubTopicBible): void {
  try {
    localStorage.setItem(bibleKey(bible.examId), JSON.stringify({ ...bible, updatedAt: Date.now() }));
  } catch { /* ignore */ }
}

/**
 * Get a single topic entry from the bible. Returns null if not found.
 */
export function getBibleEntry(examId: string, topicId: string): SubTopicEntry | null {
  const bible = loadBible(examId);
  return bible.topics.find(t => t.topicId === topicId) ?? null;
}

/**
 * Update orchestration metadata for a topic in the bible.
 * Called by emitOrchestratorSignals() after each session decision.
 */
export function updateBibleOrchestrationData(
  examId: string,
  topicId: string,
  data: BibleOrchestrationData,
): void {
  try {
    const bible = loadBible(examId);
    bible.orchestrationData[topicId] = {
      ...(bible.orchestrationData[topicId] ?? {}),
      ...data,
    };
    saveBible(bible);
  } catch { /* ignore */ }
}
