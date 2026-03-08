/**
 * signalBus.ts — EduGenius Agent Signal Bus
 *
 * Bi-directional event system connecting all 8 domain agents.
 * Signals are persisted to IndexedDB (signal_queue store) so they
 * survive page reloads and are delivered on the next agent heartbeat.
 *
 * Signal flow:
 *   Agent emits signal → enqueueSignal() → IndexedDB
 *   Agent checks inbox → drainPendingSignals() → processes + responds
 *
 * In the browser (no backend yet), agents run as service modules.
 * When a backend is added, this module becomes the client side of a
 * WebSocket or Server-Sent Events channel.
 */

import { enqueueSignal, drainPendingSignals, type AgentSignal } from './persistenceDB';
import { updateTopicMastery, logInteraction } from './persistenceDB';
import type { BehavioralSignals } from './behavioralSignals';
import type { ContentFormat, DeliveryPersona } from './lensEngine';

// ─── Signal type catalogue ────────────────────────────────────────────────────

export type SignalType = AgentSignal['type'];

// ─── Typed emitters (one per signal type) ────────────────────────────────────

/** Sage → Atlas: student couldn't understand a topic */
export async function emitContentGap(params: {
  studentId: string;
  topicId: string;
  examId: string;
  missingType: 'analogy' | 'easier_variant' | 'visual' | 'step_by_step';
  learningStyle?: string;
}): Promise<void> {
  await enqueueSignal({
    type: 'CONTENT_GAP',
    sourceAgent: 'sage',
    targetAgent: 'atlas',
    payload: params,
    studentId: params.studentId,
    topicId: params.topicId,
  });
}

/** Sage → Atlas: multiple students struggling on same concept */
export async function emitStrugglePattern(params: {
  topicId: string;
  examId: string;
  studentId: string;
  incorrectCount: number;
  masteryScore: number;
}): Promise<void> {
  await enqueueSignal({
    type: 'STRUGGLE_PATTERN',
    sourceAgent: 'sage',
    targetAgent: 'atlas',
    payload: params,
    studentId: params.studentId,
    topicId: params.topicId,
  });
}

/** Sage/Oracle → Oracle+Mentor: student mastered a concept */
export async function emitMasteryAchieved(params: {
  studentId: string;
  topicId: string;
  examId: string;
  masteryScore: number;
  sessionDurationMs: number;
}): Promise<void> {
  // Fire to both Oracle (analytics) and Mentor (celebration nudge)
  await Promise.all([
    enqueueSignal({
      type: 'MASTERY_ACHIEVED',
      sourceAgent: 'sage',
      targetAgent: 'oracle',
      payload: params,
      studentId: params.studentId,
      topicId: params.topicId,
    }),
    enqueueSignal({
      type: 'MASTERY_ACHIEVED',
      sourceAgent: 'sage',
      targetAgent: 'mentor',
      payload: params,
      studentId: params.studentId,
      topicId: params.topicId,
    }),
  ]);
}

/** Sage → Mentor: student showing frustration */
export async function emitFrustrationAlert(params: {
  studentId: string;
  topicId: string;
  examId: string;
  severity: 1 | 2 | 3 | 4 | 5;
  sessionMessageCount: number;
}): Promise<void> {
  await enqueueSignal({
    type: 'FRUSTRATION_ALERT',
    sourceAgent: 'sage',
    targetAgent: 'mentor',
    payload: params,
    studentId: params.studentId,
    topicId: params.topicId,
  });
}

/** Oracle → Mentor: student hasn't logged in */
export async function emitChurnRisk(params: {
  studentId: string;
  examId: string;
  daysInactive: number;
  lastTopicId: string;
  riskScore: number; // 0-1
}): Promise<void> {
  await enqueueSignal({
    type: 'CHURN_RISK',
    sourceAgent: 'oracle',
    targetAgent: 'mentor',
    payload: params,
    studentId: params.studentId,
  });
}

/** Sage → Oracle+Mentor: a breakthrough moment ("I get it now!") */
export async function emitBreakthrough(params: {
  studentId: string;
  topicId: string;
  examId: string;
  sessionMinutes: number;
}): Promise<void> {
  await Promise.all([
    enqueueSignal({
      type: 'BREAKTHROUGH',
      sourceAgent: 'sage',
      targetAgent: 'oracle',
      payload: params,
      studentId: params.studentId,
      topicId: params.topicId,
    }),
    enqueueSignal({
      type: 'BREAKTHROUGH',
      sourceAgent: 'sage',
      targetAgent: 'mentor',
      payload: params,
      studentId: params.studentId,
      topicId: params.topicId,
    }),
  ]);
}

// ─── Hyper-personalization signal emitters (v2) ───────────────────────────────

/** Lens → Atlas: request specific content format for a topic */
export async function emitFormatRequest(params: {
  studentId: string;
  topicId: string;
  examId: string;
  requestedFormat: ContentFormat;
  reason: string;
}): Promise<void> {
  await enqueueSignal({
    type: 'FORMAT_REQUEST',
    sourceAgent: 'lens',
    targetAgent: 'atlas',
    payload: params,
    studentId: params.studentId,
    topicId: params.topicId,
  });
}

/** Lens → Mentor: SR topic overdue — trigger review nudge */
export async function emitSROverdue(params: {
  studentId: string;
  overdueTopics: string[];
  examId: string;
  daysOverdue: number;
}): Promise<void> {
  await enqueueSignal({
    type: 'SR_OVERDUE',
    sourceAgent: 'lens',
    targetAgent: 'mentor',
    payload: params,
    studentId: params.studentId,
  });
}

/** Lens → Oracle: behavioral signal snapshot for analytics */
export async function emitBehavioralSnapshot(params: {
  studentId: string;
  examId: string;
  signals: BehavioralSignals;
  contentFormat: ContentFormat;
  deliveryPersona: DeliveryPersona;
  sessionMessageCount: number;
}): Promise<void> {
  await enqueueSignal({
    type: 'BEHAVIORAL_SNAPSHOT',
    sourceAgent: 'lens',
    targetAgent: 'oracle',
    payload: {
      studentId: params.studentId,
      examId: params.examId,
      cognitiveLoad: params.signals.cognitiveLoad,
      confidenceSignal: params.signals.confidenceSignal,
      studyTimePattern: params.signals.studyTimePattern,
      avgTypingSpeedWpm: params.signals.avgTypingSpeedWpm,
      hesitationBursts: params.signals.hesitationBursts,
      messageLengthTrend: params.signals.messageLengthTrend,
      avgResponseLatencyMs: params.signals.avgResponseLatencyMs,
      rereadCount: params.signals.rereadCount,
      entryPoint: params.signals.entryPoint,
      contentFormat: params.contentFormat,
      deliveryPersona: params.deliveryPersona,
      sessionMessageCount: params.sessionMessageCount,
    },
    studentId: params.studentId,
  });
}

/** Sage → Atlas: a delivery format got positive engagement — learn from it */
export async function emitFormatSuccess(params: {
  studentId: string;
  topicId: string;
  examId: string;
  format: ContentFormat;
  engagementSignal: 'follow_up_question' | 'mastery_achieved' | 'explicit_thanks';
}): Promise<void> {
  await enqueueSignal({
    type: 'FORMAT_SUCCESS',
    sourceAgent: 'sage',
    targetAgent: 'atlas',
    payload: params,
    studentId: params.studentId,
    topicId: params.topicId,
  });
}

// ─── Interaction recorder (Sage → persistence → Oracle) ──────────────────────

/**
 * Call this after every Sage response.
 * Updates: topic mastery (BKT), interaction log, optionally fires signals.
 */
export async function recordSageInteraction(params: {
  studentId: string;
  examId: string;
  topicId: string;
  sessionId: string;
  messageCount: number;
  correct?: boolean;
  timeSpentMs?: number;
  emotionDetected?: string;
  responseRating?: number;
  triggeredBreakthrough?: boolean;
}): Promise<void> {
  const {
    studentId, examId, topicId, sessionId, messageCount,
    correct, timeSpentMs = 0, emotionDetected, responseRating,
    triggeredBreakthrough = false,
  } = params;

  // 1. Log the raw interaction
  await logInteraction({
    studentId,
    examId,
    topicId,
    sessionId,
    messageCount,
    correct,
    timeSpentMs,
    emotionDetected,
    responseRating,
  });

  // 2. Update BKT mastery if we have a correctness signal
  if (correct !== undefined) {
    const updated = await updateTopicMastery(studentId, examId, topicId, correct);

    // 3. Fire mastery signal if newly mastered
    if (updated.isMastered && updated.consecutiveCorrect === 3) {
      await emitMasteryAchieved({
        studentId,
        topicId,
        examId,
        masteryScore: updated.masteryScore,
        sessionDurationMs: timeSpentMs,
      });
    }

    // 4. Fire struggle signal at threshold
    if (!correct && updated.incorrectCount === 3) {
      await emitStrugglePattern({
        topicId,
        examId,
        studentId,
        incorrectCount: updated.incorrectCount,
        masteryScore: updated.masteryScore,
      });
    }
  }

  // 5. Breakthrough signal
  if (triggeredBreakthrough) {
    await emitBreakthrough({
      studentId,
      topicId,
      examId,
      sessionMinutes: Math.round(timeSpentMs / 60000),
    });
  }

  // 6. Frustration signal
  if (emotionDetected === 'frustrated') {
    const { getTopicMastery: getTM } = await import('./persistenceDB');
    const mastery = await getTM(studentId, examId, topicId);
    if ((mastery?.incorrectCount ?? 0) >= 2) {
      await emitFrustrationAlert({
        studentId,
        topicId,
        examId,
        severity: Math.min(5, mastery?.incorrectCount ?? 2) as 1|2|3|4|5,
        sessionMessageCount: messageCount,
      });
    }
  }
}

// ─── Exam Lifecycle Emitters ──────────────────────────────────────────────────

/** CEO → All agents: exam approved, begin your jobs */
export async function emitExamApproved(params: {
  examId: string;
  examName: string;
  topics: string[];
  isPilot: boolean;
  targetAgents: string[];
}): Promise<void> {
  await Promise.all(
    params.targetAgents.map((agent) =>
      enqueueSignal({
        type: 'EXAM_APPROVED',
        sourceAgent: 'ceo',
        targetAgent: agent,
        examId: params.examId,
        payload: {
          examId: params.examId,
          examName: params.examName,
          topics: params.topics,
          isPilot: params.isPilot,
        },
      }),
    ),
  );
}

/** Atlas → Sage+Forge+Herald: content batch is ready for verification */
export async function emitContentReady(params: {
  examId: string;
  batchId: string;
  topicIds: string[];
  contentCount: number;
  formats: string[];
}): Promise<void> {
  await Promise.all(
    ['sage', 'forge', 'herald'].map((agent) =>
      enqueueSignal({
        type: 'CONTENT_READY',
        sourceAgent: 'atlas',
        targetAgent: agent,
        examId: params.examId,
        payload: params,
      }),
    ),
  );
}

/** Sage → Forge+Herald: content verified, deploy + promote */
export async function emitContentVerified(params: {
  examId: string;
  batchId: string;
  verifiedCount: number;
  avgAccuracy: number;
  failedTopicIds: string[];
}): Promise<void> {
  await Promise.all(
    ['forge', 'herald'].map((agent) =>
      enqueueSignal({
        type: 'CONTENT_VERIFIED',
        sourceAgent: 'sage',
        targetAgent: agent,
        examId: params.examId,
        payload: params,
      }),
    ),
  );
}

/** Forge → Oracle+Herald+Mentor: exam is live on CDN */
export async function emitExamDeployed(params: {
  examId: string;
  deployedAt: string;
  url: string;
  contentCount: number;
  regions: string[];
}): Promise<void> {
  await Promise.all(
    ['oracle', 'herald', 'mentor'].map((agent) =>
      enqueueSignal({
        type: 'EXAM_DEPLOYED',
        sourceAgent: 'forge',
        targetAgent: agent,
        examId: params.examId,
        payload: params,
      }),
    ),
  );
}

/** Oracle → Scout+Atlas+Mentor: performance insights for feedback loop */
export async function emitPerformanceInsight(params: {
  examId: string;
  staleTopicIds: string[];
  churnRiskCount: number;
  lowEngagementTopics: string[];
  highPerformingTopics: string[];
  weeklyDAU: number;
}): Promise<void> {
  await Promise.all(
    ['scout', 'atlas', 'mentor'].map((agent) =>
      enqueueSignal({
        type: 'PERFORMANCE_INSIGHT',
        sourceAgent: 'oracle',
        targetAgent: agent,
        examId: params.examId,
        payload: params,
      }),
    ),
  );
}

/** User service → Mentor+Sage+Oracle: student enrolled */
export async function emitStudentEnrolled(params: {
  examId: string;
  studentId: string;
  isFirstForExam: boolean;
}): Promise<void> {
  await Promise.all(
    ['mentor', 'sage', 'oracle'].map((agent) =>
      enqueueSignal({
        type: 'STUDENT_ENROLLED',
        sourceAgent: 'user_service',
        targetAgent: agent,
        examId: params.examId,
        payload: params,
        studentId: params.studentId,
      }),
    ),
  );
}

// ─── Agent inbox processors ───────────────────────────────────────────────────

/**
 * Atlas processes its signal inbox.
 * In production, Atlas agent's heartbeat calls this.
 * In browser context, it's a no-op that logs pending work.
 */
export async function processAtlasInbox(): Promise<{
  contentGaps: AgentSignal[];
  strugglePatterns: AgentSignal[];
}> {
  const signals = await drainPendingSignals('atlas');
  const contentGaps = signals.filter((s) => s.type === 'CONTENT_GAP');
  const strugglePatterns = signals.filter((s) => s.type === 'STRUGGLE_PATTERN');

  if (contentGaps.length > 0) {
    console.log(`[Atlas] ${contentGaps.length} content gaps to address:`, contentGaps.map(s => s.payload));
  }
  if (strugglePatterns.length > 0) {
    console.log(`[Atlas] ${strugglePatterns.length} struggle patterns detected:`, strugglePatterns.map(s => s.payload));
  }

  return { contentGaps, strugglePatterns };
}

/**
 * Mentor processes its inbox — churn risks + mastery achievements + frustrations.
 */
export async function processMentorInbox(): Promise<{
  churnRisks: AgentSignal[];
  masteries: AgentSignal[];
  frustrations: AgentSignal[];
  breakthroughs: AgentSignal[];
}> {
  const signals = await drainPendingSignals('mentor');
  return {
    churnRisks:    signals.filter((s) => s.type === 'CHURN_RISK'),
    masteries:     signals.filter((s) => s.type === 'MASTERY_ACHIEVED'),
    frustrations:  signals.filter((s) => s.type === 'FRUSTRATION_ALERT'),
    breakthroughs: signals.filter((s) => s.type === 'BREAKTHROUGH'),
  };
}

/**
 * Oracle processes its inbox — mastery events + breakthroughs.
 */
export async function processOracleInbox(): Promise<AgentSignal[]> {
  return drainPendingSignals('oracle');
}

// ─── Cohort alert detection (runs in browser on login) ───────────────────────

/**
 * Detects if the current topic is known to be hard (cohort-level signal).
 * In production, this would pull from Oracle's cohort database.
 * For now: static known-hard list + topic mastery data.
 */
export async function checkCohortAlert(topicId: string): Promise<{
  isHardTopic: boolean;
  alertMessage: string | null;
}> {
  const HARD_TOPIC_ALERTS: Record<string, string> = {
    'complex-variables':  '📊 Many GATE students find complex variables tricky — you\'re not alone',
    'numerical-methods':  '📊 Numerical methods has the lowest mastery rate in GATE EM — let\'s tackle it together',
    'transform-theory':   '📊 Laplace & Fourier transforms trip up most students the first time',
    'dilr':               '📊 DILR is the hardest CAT section on time management — pacing matters as much as logic',
    'reading-comprehension': '📊 RC is 70% strategy, 30% speed — most students try to do it backwards',
  };

  const alert = HARD_TOPIC_ALERTS[topicId] ?? null;
  return {
    isHardTopic: !!alert,
    alertMessage: alert,
  };
}
