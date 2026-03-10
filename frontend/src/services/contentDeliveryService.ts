/**
 * contentDeliveryService.ts — Content Sequencer
 *
 * Determines WHAT content to show NEXT and WHEN, based on the active
 * strategy, recent feedback signals, and the student's persona.
 */

import type { ContentAtomType } from './contentFramework';
import type { ContentStrategy } from './contentStrategyService';
import { getEffectiveStrategy } from './contentStrategyService';
import type { FeedbackEvent, AtomPerformance } from './contentFeedbackService';
import { getAllPerformance, getRegenerationQueue } from './contentFeedbackService';
import { loadCurrentUser, getActiveExamForSession } from './userService';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeliveryContext {
  userId: string;
  examType: string;
  strategy: ContentStrategy;
  sessionStartTime: number;
  atomsSeenThisSession: string[];   // atomIds
  currentTopic?: string;
  recentFeedback: FeedbackEvent[];
}

export interface NextContentRecommendation {
  atomType: ContentAtomType;
  topic: string;
  reason: string;
  urgency: 'high' | 'normal' | 'low';
  estimatedTimeMin: number;
  sourceAgent: 'sequencer' | 'oracle' | 'mentor' | 'scout';
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const SESSION_KEY = 'edugenius_delivery_session';

interface SessionRecord {
  userId: string;
  atomsSeenThisSession: string[];
  sessionStartTime: number;
}

function readSession(userId: string): SessionRecord {
  try {
    const raw = localStorage.getItem(`${SESSION_KEY}_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionRecord;
      // Reset if session is older than 4 hours
      const fourHours = 4 * 60 * 60 * 1000;
      if (Date.now() - parsed.sessionStartTime < fourHours) return parsed;
    }
  } catch {
    // corrupted
  }
  return { userId, atomsSeenThisSession: [], sessionStartTime: Date.now() };
}

function writeSession(record: SessionRecord): void {
  try {
    localStorage.setItem(`${SESSION_KEY}_${record.userId}`, JSON.stringify(record));
  } catch {
    // quota exceeded
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a DeliveryContext for the current user, reading from localStorage.
 */
export function buildDeliveryContext(userId?: string): DeliveryContext {
  const user = loadCurrentUser();
  const uid = userId ?? user?.uid ?? 'anon';
  const examType = getActiveExamForSession() ?? user?.examSubscriptions?.[0]?.examId ?? 'general';
  const strategy = getEffectiveStrategy(uid);
  const session = readSession(uid);

  // Pull recent feedback (last 20 events for this user)
  let recentFeedback: FeedbackEvent[] = [];
  try {
    const raw = localStorage.getItem('edugenius_content_feedback');
    if (raw) {
      const all = JSON.parse(raw) as FeedbackEvent[];
      recentFeedback = all
        .filter(e => e.userId === uid)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20);
    }
  } catch {
    // corrupted
  }

  return {
    userId: uid,
    examType,
    strategy,
    sessionStartTime: session.sessionStartTime,
    atomsSeenThisSession: session.atomsSeenThisSession,
    recentFeedback,
  };
}

/**
 * Determine the best next content recommendation given the delivery context.
 *
 * Logic:
 * 1. spaced_rep  → check due revisions first (atoms not seen recently)
 * 2. exam_sprint → pick weakest MCQ topic
 * 3. socratic    → alternate question/explanation pairs
 * 4. adaptive    → use LearningMoment + performance score
 * 5. Always skip atoms in 'atlas:regen_queue' (being regenerated)
 */
export function getNextContentRecommendation(
  ctx: DeliveryContext,
): NextContentRecommendation {
  const regenQueue = getRegenerationQueue();
  const regenIds = new Set(regenQueue.map(p => p.atomId));

  const allPerf = getAllPerformance().filter(p => !regenIds.has(p.atomId));

  const strategy = ctx.strategy;

  // ── 1. Spaced Repetition ─────────────────────────────────────────────────
  if (strategy.id === 'spaced_rep') {
    // Find the atom with the lowest score that hasn't been seen this session
    const candidates = allPerf
      .filter(p => !ctx.atomsSeenThisSession.includes(p.atomId))
      .sort((a, b) => a.performanceScore - b.performanceScore);

    if (candidates.length > 0) {
      const weakest = candidates[0];
      return {
        atomType: weakest.atomType,
        topic: weakest.topic,
        reason: `Spaced rep interval — last score: ${weakest.performanceScore}`,
        urgency: weakest.performanceScore < 40 ? 'high' : 'normal',
        estimatedTimeMin: 3,
        sourceAgent: 'sequencer',
      };
    }
  }

  // ── 2. Exam Sprint ───────────────────────────────────────────────────────
  if (strategy.id === 'exam_sprint') {
    const weakMCQ = allPerf
      .filter(p => p.atomType === 'mcq' && !ctx.atomsSeenThisSession.includes(p.atomId))
      .sort((a, b) => a.performanceScore - b.performanceScore);

    if (weakMCQ.length > 0) {
      const target = weakMCQ[0];
      return {
        atomType: 'mcq',
        topic: target.topic,
        reason: `Exam Sprint: weakest MCQ topic (score: ${target.performanceScore})`,
        urgency: 'high',
        estimatedTimeMin: 2,
        sourceAgent: 'sequencer',
      };
    }

    // Fallback to formula card if no MCQ data
    return {
      atomType: 'formula_card',
      topic: ctx.currentTopic ?? ctx.examType,
      reason: 'Exam Sprint: formula review',
      urgency: 'high',
      estimatedTimeMin: 1,
      sourceAgent: 'sequencer',
    };
  }

  // ── 3. Socratic ──────────────────────────────────────────────────────────
  if (strategy.id === 'socratic') {
    // Alternate between MCQ (question) and worked_example (explanation)
    const seenCount = ctx.atomsSeenThisSession.length;
    const nextType: ContentAtomType = seenCount % 2 === 0 ? 'mcq' : 'worked_example';

    const candidate = allPerf.find(
      p => p.atomType === nextType && !ctx.atomsSeenThisSession.includes(p.atomId),
    );

    return {
      atomType: nextType,
      topic: candidate?.topic ?? ctx.currentTopic ?? ctx.examType,
      reason: `Socratic: ${nextType === 'mcq' ? 'guiding question' : 'explanation after attempt'}`,
      urgency: 'normal',
      estimatedTimeMin: nextType === 'mcq' ? 4 : 6,
      sourceAgent: 'sequencer',
    };
  }

  // ── 4. Adaptive / Generic / Story Mode ───────────────────────────────────
  // Check for Mentor's low-engagement signals
  const mentorQueue = _readMentorQueue();
  if (mentorQueue.length > 0) {
    const lowEngItem = mentorQueue.find(p => !ctx.atomsSeenThisSession.includes(p.atomId));
    if (lowEngItem) {
      return {
        atomType: strategy.atomTypePriority[0] ?? 'mcq',
        topic: lowEngItem.topic,
        reason: 'Mentor: low engagement detected — needs re-engagement',
        urgency: 'normal',
        estimatedTimeMin: 5,
        sourceAgent: 'mentor',
      };
    }
  }

  // Default: use the strategy's preferred atom type
  const preferredType = strategy.atomTypePriority[0] ?? 'mcq';

  // Find a topic that needs attention (lowest score)
  const weakest = allPerf
    .filter(p => !ctx.atomsSeenThisSession.includes(p.atomId))
    .sort((a, b) => a.performanceScore - b.performanceScore)[0];

  return {
    atomType: preferredType,
    topic: weakest?.topic ?? ctx.currentTopic ?? ctx.examType,
    reason: weakest
      ? `Weak area detected (score: ${weakest.performanceScore})`
      : `Strategy: ${strategy.name}`,
    urgency: weakest && weakest.performanceScore < 40 ? 'high' : 'low',
    estimatedTimeMin: strategy.id === 'story_mode' ? 8 : 5,
    sourceAgent: 'sequencer',
  };
}

/**
 * Record that a student has seen an atom this session.
 */
export function recordAtomSeen(ctx: DeliveryContext, atomId: string): void {
  const session = readSession(ctx.userId);
  if (!session.atomsSeenThisSession.includes(atomId)) {
    session.atomsSeenThisSession.push(atomId);
    writeSession(session);
  }
}

/**
 * Get aggregate stats for the current session.
 */
export function getSessionStats(
  userId?: string,
): { atomsSeen: number; avgScore: number; topicsCoated: string[] } {
  const uid = userId ?? loadCurrentUser()?.uid ?? 'anon';
  const session = readSession(uid);
  const allPerf = getAllPerformance();

  const seenPerf = allPerf.filter(p =>
    session.atomsSeenThisSession.includes(p.atomId),
  );

  const avgScore =
    seenPerf.length > 0
      ? Math.round(seenPerf.reduce((s, p) => s + p.performanceScore, 0) / seenPerf.length)
      : 0;

  const topicsCoated = [...new Set(seenPerf.map(p => p.topic))];

  return {
    atomsSeen: session.atomsSeenThisSession.length,
    avgScore,
    topicsCoated,
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _readMentorQueue(): AtomPerformance[] {
  try {
    const raw = localStorage.getItem('mentor:low_engagement');
    return raw ? (JSON.parse(raw) as AtomPerformance[]) : [];
  } catch {
    return [];
  }
}
