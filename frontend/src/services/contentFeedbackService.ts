/**
 * contentFeedbackService.ts — Feedback Loop Engine
 *
 * Collects student signals on content atoms, aggregates them into performance
 * scores, and emits structured reports to agent-specific localStorage keys
 * so that Oracle, Atlas, Scout, and Mentor can act on them.
 */

import type { ContentAtomType } from './contentFramework';
import type { ContentStrategyId } from './contentStrategyService';

// ── Signal types ──────────────────────────────────────────────────────────────

export type FeedbackSignal =
  | 'thumbs_up'       // explicit positive
  | 'thumbs_down'     // explicit negative
  | 'skipped'         // user skipped without engaging
  | 'replayed'        // user requested same content again
  | 'time_on_content' // implicit — how long they spent
  | 'question_asked'  // student asked Sage a follow-up
  | 'completed'       // finished the atom fully
  | 'shared';         // shared with someone

// ── Core interfaces ───────────────────────────────────────────────────────────

export interface FeedbackEvent {
  id: string;
  atomId: string;
  atomType: ContentAtomType;
  topic: string;
  examType: string;
  signal: FeedbackSignal;
  value?: number;       // time_on_content → seconds; rating → 1-5
  userId: string;
  timestamp: number;
  strategyId: ContentStrategyId;
}

export interface AtomPerformance {
  atomId: string;
  topic: string;
  atomType: ContentAtomType;
  examType: string;
  totalImpressions: number;
  thumbsUp: number;
  thumbsDown: number;
  skipRate: number;           // 0–1
  avgTimeOnContent: number;   // seconds
  completionRate: number;     // 0–1
  followUpQuestions: number;  // how many Sage follow-ups triggered
  performanceScore: number;   // computed: 0–100
  needsRegeneration: boolean; // true if score < 40
  lastUpdated: number;
}

export interface FeedbackReport {
  generatedAt: string;
  totalFeedback: number;
  topPerformers: AtomPerformance[];                        // top 5 by score
  needsRegeneration: AtomPerformance[];                    // score < 40
  strategyEffectiveness: Record<ContentStrategyId, number>; // avg score per strategy
  topicHealthMap: Record<string, number>;                  // topic → avg score
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const FEEDBACK_KEY = 'edugenius_content_feedback';
const PERFORMANCE_KEY = 'edugenius_atom_performance';
const REPORT_KEY = 'edugenius_feedback_report';

// ── Storage helpers ───────────────────────────────────────────────────────────

function readFeedback(): FeedbackEvent[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_KEY);
    return raw ? (JSON.parse(raw) as FeedbackEvent[]) : [];
  } catch {
    return [];
  }
}

function writeFeedback(events: FeedbackEvent[]): void {
  try {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(events));
  } catch {
    // quota exceeded or unavailable
  }
}

function readPerformanceMap(): Record<string, AtomPerformance> {
  try {
    const raw = localStorage.getItem(PERFORMANCE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, AtomPerformance>) : {};
  } catch {
    return {};
  }
}

function writePerformanceMap(map: Record<string, AtomPerformance>): void {
  try {
    localStorage.setItem(PERFORMANCE_KEY, JSON.stringify(map));
  } catch {
    // quota exceeded or unavailable
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Record a feedback event for an atom. Also updates the performance map
 * in-place so we don't have to recompute from scratch every time.
 */
export function recordFeedback(
  event: Omit<FeedbackEvent, 'id' | 'timestamp'>,
): void {
  const id = `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const full: FeedbackEvent = { ...event, id, timestamp: Date.now() };

  const events = readFeedback();
  events.push(full);
  writeFeedback(events);

  // Incrementally update performance for this atom
  _updatePerformanceForAtom(full.atomId);
}

export function getFeedbackForAtom(atomId: string): FeedbackEvent[] {
  return readFeedback().filter(e => e.atomId === atomId);
}

export function getAtomPerformance(atomId: string): AtomPerformance | null {
  const map = readPerformanceMap();
  return map[atomId] ?? null;
}

export function getAllPerformance(): AtomPerformance[] {
  return Object.values(readPerformanceMap());
}

/**
 * Compute a 0–100 performance score from raw feedback events.
 *
 * score = (thumbsUp * 30 + completions * 25 + avgTimeMins * 20
 *          − thumbsDown * 25 − skipRate * 20)
 * clamped to [0, 100].
 */
export function computePerformanceScore(events: FeedbackEvent[]): number {
  if (events.length === 0) return 50; // neutral default

  const thumbsUp = events.filter(e => e.signal === 'thumbs_up').length;
  const thumbsDown = events.filter(e => e.signal === 'thumbs_down').length;
  const completions = events.filter(e => e.signal === 'completed').length;
  const skips = events.filter(e => e.signal === 'skipped').length;
  const total = events.length;

  const skipRate = total > 0 ? skips / total : 0;

  const timeEvents = events.filter(e => e.signal === 'time_on_content' && typeof e.value === 'number');
  const avgTimeSec = timeEvents.length > 0
    ? timeEvents.reduce((sum, e) => sum + (e.value ?? 0), 0) / timeEvents.length
    : 0;
  const avgTimeMins = avgTimeSec / 60;

  const raw =
    thumbsUp * 30 +
    completions * 25 +
    avgTimeMins * 20 -
    thumbsDown * 25 -
    skipRate * 20;

  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Generate a full FeedbackReport with aggregates across all atoms.
 * Saves it to localStorage and returns it.
 */
export function generateFeedbackReport(): FeedbackReport {
  const allEvents = readFeedback();
  const allPerf = getAllPerformance();

  const sorted = [...allPerf].sort((a, b) => b.performanceScore - a.performanceScore);
  const topPerformers = sorted.slice(0, 5);
  const needsRegeneration = allPerf.filter(p => p.needsRegeneration);

  // Strategy effectiveness — average score per strategy
  const stratScores: Record<string, number[]> = {};
  for (const event of allEvents) {
    if (!stratScores[event.strategyId]) stratScores[event.strategyId] = [];
  }
  for (const perf of allPerf) {
    // Find which strategies were used for this atom
    const atomEvents = allEvents.filter(e => e.atomId === perf.atomId);
    const strats = new Set(atomEvents.map(e => e.strategyId));
    strats.forEach(s => {
      if (!stratScores[s]) stratScores[s] = [];
      stratScores[s].push(perf.performanceScore);
    });
  }

  const strategyEffectiveness = {} as Record<ContentStrategyId, number>;
  for (const [strat, scores] of Object.entries(stratScores)) {
    strategyEffectiveness[strat as ContentStrategyId] =
      scores.length > 0
        ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
        : 0;
  }

  // Topic health map
  const topicScores: Record<string, number[]> = {};
  for (const perf of allPerf) {
    if (!topicScores[perf.topic]) topicScores[perf.topic] = [];
    topicScores[perf.topic].push(perf.performanceScore);
  }
  const topicHealthMap: Record<string, number> = {};
  for (const [topic, scores] of Object.entries(topicScores)) {
    topicHealthMap[topic] = Math.round(
      scores.reduce((s, v) => s + v, 0) / scores.length,
    );
  }

  const report: FeedbackReport = {
    generatedAt: new Date().toISOString(),
    totalFeedback: allEvents.length,
    topPerformers,
    needsRegeneration,
    strategyEffectiveness,
    topicHealthMap,
  };

  try {
    localStorage.setItem(REPORT_KEY, JSON.stringify(report));
  } catch {
    // quota exceeded
  }

  return report;
}

export function getRegenerationQueue(): AtomPerformance[] {
  return getAllPerformance().filter(p => p.needsRegeneration);
}

export function markRegenerated(atomId: string): void {
  const map = readPerformanceMap();
  if (map[atomId]) {
    map[atomId].needsRegeneration = false;
    writePerformanceMap(map);
  }
}

// ── Agent signal emitters ─────────────────────────────────────────────────────

/** Signals Oracle with the full feedback report. */
export function emitToOracle(report: FeedbackReport): void {
  try {
    localStorage.setItem('oracle:content_feedback', JSON.stringify(report));
  } catch {
    // unavailable
  }
}

/** Signals Atlas with atoms that need regeneration. */
export function emitToAtlas(queue: AtomPerformance[]): void {
  try {
    localStorage.setItem('atlas:regen_queue', JSON.stringify(queue));
  } catch {
    // unavailable
  }
}

/** Signals Scout with the topic health map. */
export function emitToScout(topicHealth: Record<string, number>): void {
  try {
    localStorage.setItem('scout:topic_health', JSON.stringify(topicHealth));
  } catch {
    // unavailable
  }
}

/** Signals Mentor with low-engagement atoms. */
export function emitToMentor(lowEngagement: AtomPerformance[]): void {
  try {
    localStorage.setItem('mentor:low_engagement', JSON.stringify(lowEngagement));
  } catch {
    // unavailable
  }
}

/**
 * Emit a feedback summary to the Orchestrator so it can adjust content priorities.
 * Stored at 'orchestrator:feedback_signal' — read by contentOrchestratorService.
 */
export function emitToOrchestrator(report: FeedbackReport): void {
  try {
    const bestStrategy = Object.entries(report.strategyEffectiveness)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    localStorage.setItem(
      'orchestrator:feedback_signal',
      JSON.stringify({
        at: new Date().toISOString(),
        lowPerformers: report.needsRegeneration.map((a) => a.topic),
        topPerformers: report.topPerformers.map((a) => a.topic),
        bestStrategy,
      }),
    );
  } catch {
    // localStorage unavailable
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Recompute and persist performance for a single atom based on all its events.
 */
function _updatePerformanceForAtom(atomId: string): void {
  const events = readFeedback().filter(e => e.atomId === atomId);
  if (events.length === 0) return;

  const first = events[0];
  const map = readPerformanceMap();

  const thumbsUp = events.filter(e => e.signal === 'thumbs_up').length;
  const thumbsDown = events.filter(e => e.signal === 'thumbs_down').length;
  const skips = events.filter(e => e.signal === 'skipped').length;
  const completions = events.filter(e => e.signal === 'completed').length;
  const followUpQuestions = events.filter(e => e.signal === 'question_asked').length;

  const timeEvents = events.filter(
    e => e.signal === 'time_on_content' && typeof e.value === 'number',
  );
  const avgTimeOnContent =
    timeEvents.length > 0
      ? timeEvents.reduce((sum, e) => sum + (e.value ?? 0), 0) / timeEvents.length
      : 0;

  const total = events.length;
  const skipRate = total > 0 ? skips / total : 0;
  const completionRate = total > 0 ? completions / total : 0;

  const performanceScore = computePerformanceScore(events);

  const perf: AtomPerformance = {
    atomId,
    topic: first.topic,
    atomType: first.atomType,
    examType: first.examType,
    totalImpressions: total,
    thumbsUp,
    thumbsDown,
    skipRate,
    avgTimeOnContent,
    completionRate,
    followUpQuestions,
    performanceScore,
    needsRegeneration: performanceScore < 40,
    lastUpdated: Date.now(),
  };

  map[atomId] = perf;
  writePerformanceMap(map);
}
