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

/**
 * Sage → Atlas: student couldn't understand a topic — specific content type missing.
 * Atlas should generate the requested content variant (analogy, visual, etc.) for this topic.
 *
 * @param params.studentId    Student who encountered the gap
 * @param params.topicId      Topic where the gap exists
 * @param params.examId       Exam the topic belongs to
 * @param params.missingType  What type of content would help most
 * @param params.learningStyle  Student's detected learning style (optional)
 * @returns Promise<void>
 */
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

/**
 * Sage → Atlas: multiple students struggling on the same concept (cohort signal).
 * Atlas should create clearer or simpler explanations for this topic.
 *
 * @param params.topicId       Topic with the struggle pattern
 * @param params.examId        Exam context
 * @param params.studentId     Student triggering this particular signal
 * @param params.incorrectCount  Number of consecutive incorrect attempts
 * @param params.masteryScore  Current BKT mastery score (0–1)
 * @returns Promise<void>
 */
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

/**
 * Sage → Oracle + Mentor: student has mastered a concept.
 * Oracle should record the mastery event for analytics.
 * Mentor should send a congratulatory nudge to maintain momentum.
 *
 * @param params.studentId        Student who achieved mastery
 * @param params.topicId          Mastered topic
 * @param params.examId           Exam context
 * @param params.masteryScore     Final BKT mastery score (should be ≥ 0.85)
 * @param params.sessionDurationMs  Total session time in milliseconds
 * @returns Promise<void>
 */
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

/**
 * Sage → Mentor: student is showing frustration signals.
 * Mentor should send an empathy nudge and optionally alert a teacher.
 *
 * @param params.studentId            Frustrated student
 * @param params.topicId              Topic causing frustration
 * @param params.examId               Exam context
 * @param params.severity             1 (mild) to 5 (severe) frustration level
 * @param params.sessionMessageCount  Number of messages in the current session
 * @returns Promise<void>
 */
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

/**
 * Oracle → Mentor: student shows churn risk based on inactivity / engagement drop.
 * Mentor should trigger a personalised re-engagement sequence immediately.
 *
 * @param params.studentId    At-risk student
 * @param params.examId       Exam context
 * @param params.daysInactive  Days since last login
 * @param params.lastTopicId  Last topic the student was working on
 * @param params.riskScore    Churn probability (0–1)
 * @returns Promise<void>
 */
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

/**
 * Sage → Oracle + Mentor: student experienced a breakthrough moment ("I get it now!").
 * Oracle records the event for learning analytics.
 * Mentor should celebrate the moment with a badge or encouraging message.
 *
 * @param params.studentId      Student who had the breakthrough
 * @param params.topicId        Topic that clicked
 * @param params.examId         Exam context
 * @param params.sessionMinutes  How long it took (total session minutes)
 * @returns Promise<void>
 */
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

/**
 * Lens → Atlas: student needs a specific content format for a topic.
 * Atlas should generate content in the requested format as soon as possible.
 *
 * @param params.studentId       Student making the implicit format request
 * @param params.topicId         Topic that needs the format
 * @param params.examId          Exam context
 * @param params.requestedFormat  Specific content format needed
 * @param params.reason          Why this format was selected (Lens reasoning)
 * @returns Promise<void>
 */
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

/**
 * Lens → Mentor: spaced repetition review is overdue for one or more topics.
 * Mentor should send a review nudge (push, WhatsApp, or in-app).
 *
 * @param params.studentId     Student with overdue reviews
 * @param params.overdueTopics  List of topic slugs that are overdue
 * @param params.examId        Exam context
 * @param params.daysOverdue   How many days past the scheduled review date
 * @returns Promise<void>
 */
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

/**
 * Lens → Oracle: behavioral signal snapshot captured during a session.
 * Oracle should use this data to update the student's learning profile.
 *
 * @param params.studentId             Student being observed
 * @param params.examId                Exam context
 * @param params.signals               Full behavioral signals object from the session
 * @param params.contentFormat         Format the student was engaging with
 * @param params.deliveryPersona       Persona Sage was using for delivery
 * @param params.sessionMessageCount   Total messages in the session
 * @returns Promise<void>
 */
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

/**
 * Sage → Atlas: a content format got strong positive engagement — reinforce and replicate.
 * Atlas should note this format preference and apply it to similar topics for this student.
 *
 * @param params.studentId        Student who responded positively
 * @param params.topicId          Topic where the format worked
 * @param params.examId           Exam context
 * @param params.format           Format that was effective
 * @param params.engagementSignal  Type of positive signal detected
 * @returns Promise<void>
 */
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

/**
 * CEO → All agents: exam has been approved — each agent should begin its role in the launch pipeline.
 * This is the starting gun for the full exam launch workflow.
 *
 * @param params.examId         Unique exam identifier
 * @param params.examName       Human-readable exam name
 * @param params.topics         List of topic slugs included in this exam
 * @param params.isPilot        Whether this is a limited pilot launch
 * @param params.targetAgents   Which agents should receive this signal
 * @returns Promise<void>
 */
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

/**
 * Atlas → Sage + Forge + Herald: content batch is ready for downstream processing.
 * Sage should verify accuracy, Forge should prepare deployment, Herald should plan promotion.
 *
 * @param params.examId        Exam the batch belongs to
 * @param params.batchId       Unique batch identifier
 * @param params.topicIds      Topics included in this batch
 * @param params.contentCount  Total number of content pieces
 * @param params.formats       Content formats included (e.g. ['lesson', 'mcq'])
 * @returns Promise<void>
 */
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

/**
 * Sage → Forge + Herald: content accuracy verified — safe to deploy and promote.
 * Forge should push to CDN. Herald should begin scheduling promotions.
 *
 * @param params.examId          Exam the batch belongs to
 * @param params.batchId         Batch that was verified
 * @param params.verifiedCount   Number of pieces that passed verification
 * @param params.avgAccuracy     Average accuracy score (0–100)
 * @param params.failedTopicIds  Topics that failed and need Atlas to regenerate
 * @returns Promise<void>
 */
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

/**
 * Forge → Oracle + Herald + Mentor: exam is live on CDN and ready for students.
 * Oracle should start analytics tracking. Herald should launch campaigns. Mentor should notify enrolled students.
 *
 * @param params.examId        Deployed exam identifier
 * @param params.deployedAt    ISO timestamp of deployment
 * @param params.url           Public URL where the exam is accessible
 * @param params.contentCount  Total content pieces deployed
 * @param params.regions       CDN regions where content is now live
 * @returns Promise<void>
 */
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

/**
 * Oracle → Scout + Atlas + Mentor: performance insights to close the feedback loop.
 * Scout should research stale topics. Atlas should regenerate low-performing content. Mentor should re-engage at-risk students.
 *
 * @param params.examId                Exam the insights relate to
 * @param params.staleTopicIds         Topics with outdated or low-quality content
 * @param params.churnRiskCount        Number of students showing churn signals
 * @param params.lowEngagementTopics   Topics with below-threshold engagement
 * @param params.highPerformingTopics  Topics driving the most retention and conversions
 * @param params.weeklyDAU             Daily active users for the week
 * @returns Promise<void>
 */
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

/**
 * User service → Mentor + Sage + Oracle: a student has enrolled for an exam.
 * Mentor should send the welcome sequence. Sage should run the diagnostic. Oracle should start tracking.
 *
 * @param params.examId          Exam the student enrolled in
 * @param params.studentId       Newly enrolled student
 * @param params.isFirstForExam  True if this is the first student for this exam (milestone)
 * @returns Promise<void>
 */
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
 * Atlas processes its full signal inbox.
 * In production, Atlas agent's heartbeat calls this.
 * Handles all signals routed to Atlas: CONTENT_GAP, STRUGGLE_PATTERN,
 * FORMAT_REQUEST, FORMAT_SUCCESS, ENGAGEMENT_GAP, and TREND_SIGNAL.
 */
export async function processAtlasInbox(): Promise<{
  contentGaps: AgentSignal[];
  strugglePatterns: AgentSignal[];
  formatRequests: AgentSignal[];
  formatSuccesses: AgentSignal[];
  engagementGaps: AgentSignal[];
  trendSignals: AgentSignal[];
}> {
  const signals = await drainPendingSignals('atlas');
  return {
    contentGaps:     signals.filter((s) => s.type === 'CONTENT_GAP'),
    strugglePatterns: signals.filter((s) => s.type === 'STRUGGLE_PATTERN'),
    formatRequests:   signals.filter((s) => s.type === 'FORMAT_REQUEST'),
    formatSuccesses:  signals.filter((s) => s.type === 'FORMAT_SUCCESS'),
    engagementGaps:   signals.filter((s) => s.type === 'ENGAGEMENT_GAP'),
    trendSignals:     signals.filter((s) => s.type === 'TREND_SIGNAL'),
  };
}

/**
 * Sage processes its full signal inbox.
 * Handles STUDENT_STRUGGLING from Mentor and CONTENT_READY from Atlas.
 * On each heartbeat, Sage should act on these to adjust tutoring behaviour.
 */
export async function processSageInbox(): Promise<{
  studentStruggling: AgentSignal[];
  contentReady: AgentSignal[];
  examApproved: AgentSignal[];
}> {
  const signals = await drainPendingSignals('sage');
  return {
    studentStruggling: signals.filter((s) => s.type === 'STUDENT_STRUGGLING'),
    contentReady:      signals.filter((s) => s.type === 'CONTENT_READY'),
    examApproved:      signals.filter((s) => s.type === 'EXAM_APPROVED'),
  };
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

// ─── Gap-fill connections — bidirectional audit 2026-03-08 ───────────────────
// 7 missing agent→agent links identified and wired below.

/**
 * Scout → Atlas: trending keyword or new PYQ pattern found — trigger content generation.
 * Atlas should prioritise this topic in its next generation queue.
 *
 * @param params.examId       Exam the trend relates to
 * @param params.topicId      Topic slug that is trending
 * @param params.trendType    Nature of the trend (keyword spike, PYQ pattern, etc.)
 * @param params.keyword      Specific keyword if trendType is 'keyword'
 * @param params.urgency      How quickly Atlas should respond
 * @param params.suggestedFormats  Formats Scout recommends for maximum impact
 * @returns Promise<void>
 */
export async function emitTrendSignal(params: {
  examId: string;
  topicId: string;
  trendType: 'keyword' | 'pyq_pattern' | 'competitor_gap' | 'reddit_spike';
  keyword?: string;
  urgency: 'low' | 'medium' | 'high';
  suggestedFormats?: string[];
}): Promise<void> {
  await enqueueSignal({
    type: 'TREND_SIGNAL',
    sourceAgent: 'scout',
    targetAgent: 'atlas',
    examId: params.examId,
    topicId: params.topicId,
    payload: params,
  });
}

/**
 * Scout → Herald: a keyword opportunity has been identified — launch a campaign or blog post.
 * Herald should act on high-volume, low-difficulty opportunities immediately.
 *
 * @param params.examId             Exam the keyword is associated with
 * @param params.keyword            The target keyword
 * @param params.searchVolume       Monthly search volume estimate
 * @param params.difficulty         Keyword difficulty score (0–100)
 * @param params.recommendedAction  What Herald should create
 * @returns Promise<void>
 */
export async function emitKeywordOpportunity(params: {
  examId: string;
  keyword: string;
  searchVolume: number;
  difficulty: number;  // 0–100 KD score
  recommendedAction: 'blog_post' | 'landing_page' | 'social_campaign';
}): Promise<void> {
  await enqueueSignal({
    type: 'KEYWORD_OPPORTUNITY',
    sourceAgent: 'scout',
    targetAgent: 'herald',
    examId: params.examId,
    payload: params,
  });
}

/**
 * Forge → Scout: exam successfully deployed — monitor SEO rankings + CDN performance.
 * Scout should begin tracking search rankings and CDN latency for the deployed URL.
 *
 * @param params.examId      Exam that was deployed
 * @param params.url         Public URL of the deployed exam
 * @param params.deployedAt  ISO timestamp of deployment
 * @param params.topicsLive  List of topic slugs now live
 * @param params.regions     CDN regions where content is available
 * @returns Promise<void>
 */
export async function emitDeployMetrics(params: {
  examId: string;
  url: string;
  deployedAt: string;
  topicsLive: string[];
  regions: string[];
}): Promise<void> {
  await enqueueSignal({
    type: 'DEPLOY_METRICS',
    sourceAgent: 'forge',
    targetAgent: 'scout',
    examId: params.examId,
    payload: params,
  });
}

/**
 * Mentor → Sage: a student has been struggling for multiple days — trigger a targeted doubt-clearing session.
 * Sage should prioritise this student on next interaction, using a softer, encouraging tone.
 *
 * @param params.studentId      The struggling student's ID
 * @param params.examId         Exam the student is preparing for
 * @param params.topicId        Topic the student is stuck on
 * @param params.dayStruggling  Number of consecutive days the student has struggled
 * @param params.mistakeTypes   Patterns of errors (e.g. ['sign_error', 'formula_recall'])
 * @param params.lastSessionAt  ISO timestamp of student's last session
 * @returns Promise<void>
 */
export async function emitStudentStruggling(params: {
  studentId: string;
  examId: string;
  topicId: string;
  dayStruggling: number;
  mistakeTypes: string[];
  lastSessionAt?: string;
}): Promise<void> {
  await enqueueSignal({
    type: 'STUDENT_STRUGGLING',
    sourceAgent: 'mentor',
    targetAgent: 'sage',
    studentId: params.studentId,
    topicId: params.topicId,
    payload: params,
  });
}

/**
 * Mentor → Atlas: a topic has persistent low engagement — generate a fresh content variant.
 * Atlas should create a different format (analogy, diagram, story) to re-engage students.
 *
 * @param params.examId               Exam the topic belongs to
 * @param params.topicId              The low-engagement topic
 * @param params.engagementScore      Current engagement score (0–100)
 * @param params.avgSessionDurationSec  Average time spent on this topic per session
 * @param params.dropoffPoint         Step in the lesson where students typically leave
 * @param params.suggestedFormat      Format Mentor recommends for re-engagement
 * @returns Promise<void>
 */
export async function emitEngagementGap(params: {
  examId: string;
  topicId: string;
  engagementScore: number;   // 0–100
  avgSessionDurationSec: number;
  dropoffPoint?: string;     // where students leave
  suggestedFormat?: string;  // e.g. 'analogy_explainer', 'visual_diagram_text'
}): Promise<void> {
  await enqueueSignal({
    type: 'ENGAGEMENT_GAP',
    sourceAgent: 'mentor',
    targetAgent: 'atlas',
    topicId: params.topicId,
    payload: params,
  });
}

/**
 * Oracle → Herald: campaign performance data — scale, hold, adjust copy, or kill.
 * Herald should act on the verdict immediately to avoid wasting ad budget.
 *
 * @param params.examId          Exam the campaign promotes
 * @param params.campaignId      Campaign identifier
 * @param params.ctr             Click-through rate (%)
 * @param params.roas            Return on ad spend (optional)
 * @param params.impressions     Total impressions served
 * @param params.verdict         Oracle's recommendation
 * @param params.suggestedChange  Specific change if verdict is 'adjust_copy'
 * @returns Promise<void>
 */
export async function emitCampaignPerformance(params: {
  examId: string;
  campaignId: string;
  ctr: number;         // click-through rate %
  roas?: number;       // return on ad spend
  impressions: number;
  verdict: 'scale' | 'hold' | 'kill' | 'adjust_copy';
  suggestedChange?: string;
}): Promise<void> {
  await enqueueSignal({
    type: 'CAMPAIGN_PERFORMANCE',
    sourceAgent: 'oracle',
    targetAgent: 'herald',
    examId: params.examId,
    payload: params,
  });
}

/**
 * Herald → Scout: a campaign underperformed — research why and identify alternatives.
 * Scout should investigate the search landscape and suggest better keywords or angles.
 *
 * @param params.examId          Exam the campaign was for
 * @param params.campaignId      Campaign that underperformed
 * @param params.ctr             Actual CTR achieved
 * @param params.expectedCtr     Baseline CTR that was targeted
 * @param params.hypothesis      Herald's best guess for the underperformance
 * @param params.researchRequest  Specific question Scout should answer
 * @returns Promise<void>
 */
export async function emitCampaignResult(params: {
  examId: string;
  campaignId: string;
  ctr: number;
  expectedCtr: number;
  hypothesis: string;   // Herald's guess why it underperformed
  researchRequest: string; // What Scout should look into
}): Promise<void> {
  await enqueueSignal({
    type: 'CAMPAIGN_RESULT',
    sourceAgent: 'herald',
    targetAgent: 'scout',
    examId: params.examId,
    payload: params,
  });
}

/**
 * Atlas → Oracle: new content batch published — set up performance tracking.
 * Oracle should create a content-performance funnel for the published batch.
 *
 * @param params.examId          Exam the content belongs to
 * @param params.topicId         Topic slug that was published
 * @param params.contentIds      List of content IDs now live
 * @param params.formats         Formats included (e.g. ['lesson', 'mcq', 'infographic'])
 * @param params.publishedAt     ISO timestamp of publication
 * @param params.estimatedReach  Estimated number of students who will see this content
 * @returns Promise<void>
 */
export async function emitContentPublished(params: {
  examId: string;
  topicId: string;
  contentIds: string[];
  formats: string[];
  publishedAt: string;
  estimatedReach?: number;
}): Promise<void> {
  await enqueueSignal({
    type: 'CONTENT_PUBLISHED',
    sourceAgent: 'atlas',
    targetAgent: 'oracle',
    topicId: params.topicId,
    payload: params,
  });
}

// ─── Updated inbox processors (include new signal types) ─────────────────────

/** Scout processes its full inbox — trend requests + performance feedback */
export async function processScoutInbox(): Promise<{
  deployMetrics: AgentSignal[];
  campaignResults: AgentSignal[];
  performanceInsights: AgentSignal[];
}> {
  const signals = await drainPendingSignals('scout');
  return {
    deployMetrics:      signals.filter(s => s.type === 'DEPLOY_METRICS'),
    campaignResults:    signals.filter(s => s.type === 'CAMPAIGN_RESULT'),
    performanceInsights: signals.filter(s => s.type === 'PERFORMANCE_INSIGHT'),
  };
}

/** Herald processes its full inbox — campaign feedback + content verified + deployed */
export async function processHeraldInbox(): Promise<{
  contentVerified: AgentSignal[];
  examDeployed: AgentSignal[];
  campaignPerformance: AgentSignal[];
  keywordOpportunities: AgentSignal[];
}> {
  const signals = await drainPendingSignals('herald');
  return {
    contentVerified:      signals.filter(s => s.type === 'CONTENT_VERIFIED'),
    examDeployed:         signals.filter(s => s.type === 'EXAM_DEPLOYED'),
    campaignPerformance:  signals.filter(s => s.type === 'CAMPAIGN_PERFORMANCE'),
    keywordOpportunities: signals.filter(s => s.type === 'KEYWORD_OPPORTUNITY'),
  };
}

/** Forge processes its inbox — content verified (deploy) */
export async function processForgeInbox(): Promise<{
  contentVerified: AgentSignal[];
  examApproved: AgentSignal[];
}> {
  const signals = await drainPendingSignals('forge');
  return {
    contentVerified: signals.filter(s => s.type === 'CONTENT_VERIFIED'),
    examApproved:    signals.filter(s => s.type === 'EXAM_APPROVED'),
  };
}

// ─── Delight Feature Signal Emitters (bidirectional wiring 2026-03-12) ────────

/**
 * Gamification → Oracle: XP milestones and level-up events.
 * Oracle tracks engagement trends; Mentor acts on level-ups for motivation.
 */
export async function emitXPMilestone(params: {
  studentId: string;
  examId: string;
  event: string;   // e.g. 'level_up', 'badge_earned', 'streak_milestone'
  xp: number;
  level: number;
  streak: number;
  badge?: string;
}): Promise<void> {
  await enqueueSignal({
    type: 'XP_MILESTONE',
    sourceAgent: 'mentor',
    targetAgent: 'oracle',
    payload: params,
    studentId: params.studentId,
  });
}

/**
 * Readiness Score → Oracle: daily readiness snapshot for trend tracking.
 * Oracle uses this to compute week-over-week improvement curves.
 */
export async function emitReadinessSnapshot(params: {
  studentId: string;
  examId: string;
  score: number;
  grade: string;
  trend: string;
  topGap: string;
}): Promise<void> {
  await enqueueSignal({
    type: 'READINESS_SNAPSHOT',
    sourceAgent: 'sage',
    targetAgent: 'oracle',
    payload: params,
    studentId: params.studentId,
  });
}

/**
 * Mood → Mentor: daily mood signal for wellbeing tracking.
 * Mentor uses this to adjust study plan recommendations.
 */
export async function emitMoodSignal(params: {
  studentId: string;
  examId: string;
  mood: string;
  sessionPlanDuration: number;
  streakProtected: boolean;
}): Promise<void> {
  await enqueueSignal({
    type: 'MOOD_CHECK_IN',
    sourceAgent: 'sage',
    targetAgent: 'mentor',
    payload: params,
    studentId: params.studentId,
  });
}

// ─── Prism Journey Intelligence (bidirectional) ───────────────────────────────

/**
 * Prism → targetAgent: funnel leak or journey anomaly detected.
 * Prism analyses cross-agent journey traces and emits targeted insights
 * to whichever agent owns the leaking stage.
 *
 * @param params.targetAgent  The agent responsible for fixing the leak
 * @param params.funnelStage  AARRR stage where the leak occurs
 * @param params.leakType     Short identifier for the leak type (e.g. 'cta_copy', 'slow_load')
 * @param params.affectedSegment  Student/user segment experiencing the leak
 * @param params.recommendation  Specific, actionable fix recommendation
 * @param params.urgency      How quickly this should be addressed
 * @returns Promise<void>
 */
export async function emitFunnelInsight(params: {
  targetAgent: string;
  funnelStage: 'discovery' | 'activation' | 'retention' | 'revenue' | 'referral';
  leakType: string;
  affectedSegment: string;
  recommendation: string;
  urgency: 'low' | 'medium' | 'high';
}): Promise<void> {
  await enqueueSignal({
    type: 'FUNNEL_INSIGHT',
    sourceAgent: 'prism',
    targetAgent: params.targetAgent,
    payload: params,
  });
}

/**
 * Prism drains its inbox — receives journey event summaries from all other agents.
 * Prism is a pure analysis agent: it reads everything, emits FUNNEL_INSIGHT back.
 *
 * @returns All pending signals queued for Prism
 */
export async function processPrismInbox(): Promise<AgentSignal[]> {
  return drainPendingSignals('prism');
}
