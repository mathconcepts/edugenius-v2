/**
 * courseOrchestrator.ts — Master Course Orchestrator
 *
 * Central intelligence layer that decides what every user learns,
 * when, how, and at what depth. Connects bidirectionally to all
 * agents, features, and prompts.
 *
 * Decision Layers (top → bottom):
 *   1. ROLE LAYER      → who is this user?
 *   2. EXAM LAYER      → which exam? phase? days remaining?
 *   3. KNOWLEDGE LAYER → mastery per topic (BKT/persistence)
 *   4. OBJECTIVE LAYER → what's the learning goal right now?
 *   5. CONTENT LAYER   → static vs dynamic, format, difficulty
 *   6. DELIVERY LAYER  → which surface/channel/agent?
 *   7. FEEDBACK LAYER  → did it work? adapt next decision
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type LearnerRole = 'student' | 'teacher' | 'parent' | 'self_learner' | 'coach';

export type ExamPhase =
  | 'discovery'      // >180 days: exploring, deciding
  | 'foundation'     // 90–180 days: building basics
  | 'structured'     // 45–90 days: systematic syllabus coverage
  | 'intensive'      // 21–45 days: speed + accuracy
  | 'sprint'         // 7–21 days: revision + mock tests
  | 'exam_week'      // <7 days: mindset + last-minute
  | 'post_exam';     // after: reflection + next steps

export type LearningObjectiveType =
  | 'introduce_concept'    // first time seeing topic
  | 'deepen_understanding' // knows basics, needs depth
  | 'fix_misconception'    // wrong mental model detected
  | 'build_speed'          // knows concept, needs fluency
  | 'exam_pattern'         // learn how examiners test this
  | 'cross_connect'        // link this to other topics
  | 'revision'             // seen before, refresh
  | 'assess_readiness';    // test before moving on

export type ContentMode =
  | 'static_pyq'        // pre-indexed PYQ (T0)
  | 'rag_retrieval'     // Supabase RAG (T1)
  | 'llm_generated'     // dynamic LLM (T2)
  | 'wolfram_verified'  // math-verified (T3)
  | 'rich_media';       // video/infographic (T4)

export type DeliveryChannel =
  | 'in_app_chat'    // Sage in Chat page
  | 'practice_mcq'   // Practice page
  | 'content_feed'   // Learn page ContentFeed
  | 'notebook'       // Notebook page
  | 'whatsapp'       // WhatsApp bot
  | 'telegram'       // Telegram bot
  | 'email';         // Email digest

export interface TopicMasterySnapshot {
  topicId: string;
  topicName: string;
  masteryScore: number;       // 0–1
  isMastered: boolean;
  attemptCount: number;
  lastAttempted?: number;
  weakSubtopics: string[];
}

export interface LearnerProfile {
  userId: string;
  role: LearnerRole;
  examId: string;
  examPhase: ExamPhase;
  daysToExam: number;
  learningStyle: 'visual' | 'conceptual' | 'practice_first' | 'mixed';
  cognitiveLoad: 'low' | 'medium' | 'high';  // session fatigue estimate
  streakDays: number;
  sessionCount: number;
  topicMastery: TopicMasterySnapshot[];
  weakestTopics: string[];     // bottom 20% by mastery
  strongestTopics: string[];   // top 20% by mastery
  nextReviewTopics: string[];  // spaced repetition due
  preferredChannel: DeliveryChannel;
}

export interface LearningObjective {
  type: LearningObjectiveType;
  topicId: string;
  topicName: string;
  subtopicFocus?: string;
  rationale: string;           // why this objective was chosen
  estimatedMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  prerequisites: string[];
}

export interface ContentDecision {
  mode: ContentMode;
  format: 'explanation' | 'worked_example' | 'mcq' | 'short_answer' | 'concept_map' | 'formula_sheet' | 'revision_card' | 'mock_question';
  channel: DeliveryChannel;
  agentId: 'sage' | 'atlas' | 'mentor' | 'oracle';
  promptDirectives: string[];  // injected into agent prompt
  contextAtoms: string[];      // content IDs to pre-load
  estimatedTokens: number;
  tierTarget: 0 | 1 | 2 | 3 | 4;
}

export interface OrchestratorDecision {
  sessionId: string;
  userId: string;
  timestamp: number;

  learnerProfile: LearnerProfile;
  objective: LearningObjective;
  contentDecision: ContentDecision;

  // Cross-role context (for teacher/parent views)
  studentInsights?: {
    topStruggle: string;
    recentWin: string;
    suggestedIntervention: string;
  };

  // Adaptation signals
  adaptationHints: {
    ifConfused: string;       // what to do if student signals confusion
    ifBored: string;          // what to do if student seems disengaged
    ifTooFast: string;        // if they're racing through
    nextObjective: string;    // what comes after this succeeds
  };

  // Agent signals to emit
  signals: Record<string, unknown>;
}

interface OutcomeRecord {
  sessionId: string;
  completed: boolean;
  timeSpentMs: number;
  correctAnswers?: number;
  totalAnswers?: number;
  studentFeedback?: 'too_easy' | 'just_right' | 'too_hard' | 'confusing';
  timestamp: number;
}

// ─── LocalStorage keys ────────────────────────────────────────────────────────

const LS = {
  ORCHESTRATOR_HISTORY:  (uid: string) => `edugenius_orchestrator_history_${uid}`,
  ORCHESTRATOR_STATE:    'edugenius_orchestrator_state',
  OUTCOME_LOG:           'edugenius_orchestrator_outcomes',
  RULES:                 'edugenius_orchestrator_rules',

  // Data sources (read)
  STUDENT_PERSONA:       'edugenius_student_persona',
  TOPIC_MASTERY:         (uid: string, eid: string) => `edugenius_topic_mastery_${uid}_${eid}`,
  STREAK:                'edugenius_streak',
  SESSION_COUNT:         'edugenius_session_count',
  SPACED_REP_QUEUE:      'edugenius_spaced_rep_queue',
  ORACLE_MASTERY_UPDATE: 'oracle:mastery_update',
  MENTOR_ENGAGEMENT:     'mentor:engagement_signal',

  // Outbound signals (TO agents)
  SAGE_DIRECTIVE:        'orchestrator:sage_directive',
  ATLAS_TASK:            'orchestrator:atlas_task',
  MENTOR_NUDGE:          'orchestrator:mentor_nudge',
  ORACLE_EVENT:          'orchestrator:oracle_event',
  SCOUT_PRIORITY:        'orchestrator:scout_priority',

  // Inbound signals (FROM agents)
  SAGE_OUTCOME:          'sage:session_outcome',
  ATLAS_READY:           'atlas:content_ready',
} as const;

// ─── Phase thresholds (editable via Orchestration Rules tab) ─────────────────

interface PhaseThresholds {
  discoveryMin: number;   // > this → discovery
  foundationMin: number;  // > this → foundation
  structuredMin: number;  // > this → structured
  intensiveMin: number;   // > this → intensive
  sprintMin: number;      // > this → sprint
  examWeekMin: number;    // > this → exam_week (else post_exam if < 0)
}

function getPhaseThresholds(): PhaseThresholds {
  try {
    const saved = localStorage.getItem(LS.RULES);
    if (saved) {
      const parsed = JSON.parse(saved) as { phaseThresholds?: PhaseThresholds };
      if (parsed.phaseThresholds) return parsed.phaseThresholds;
    }
  } catch { /* ignore */ }
  return {
    discoveryMin:  180,
    foundationMin: 90,
    structuredMin: 45,
    intensiveMin:  21,
    sprintMin:     7,
    examWeekMin:   0,
  };
}

// ─── inferExamPhase ───────────────────────────────────────────────────────────

/**
 * Determine exam phase from days remaining.
 */
export function inferExamPhase(daysToExam: number): ExamPhase {
  const t = getPhaseThresholds();
  if (daysToExam < 0)             return 'post_exam';
  if (daysToExam < t.examWeekMin || daysToExam < 1) return 'exam_week'; // treat 0 as exam_week
  if (daysToExam < t.sprintMin)   return 'exam_week';
  if (daysToExam < t.intensiveMin) return 'sprint';
  if (daysToExam < t.structuredMin) return 'intensive';
  if (daysToExam < t.foundationMin) return 'structured';
  if (daysToExam < t.discoveryMin)  return 'foundation';
  return 'discovery';
}

// ─── buildLearnerProfile ──────────────────────────────────────────────────────

/**
 * Build learner profile from all available data sources.
 */
export function buildLearnerProfile(userId: string, examId: string): LearnerProfile {
  // 1. Student persona
  let persona: Record<string, unknown> = {};
  try {
    const raw = localStorage.getItem(LS.STUDENT_PERSONA);
    if (raw) persona = JSON.parse(raw) as Record<string, unknown>;
  } catch { /* ignore */ }

  // 2. Topic mastery
  let topicMastery: TopicMasterySnapshot[] = [];
  try {
    const raw = localStorage.getItem(LS.TOPIC_MASTERY(userId, examId));
    if (raw) {
      const parsed = JSON.parse(raw) as Array<{
        topicId?: string; topicName?: string; masteryScore?: number;
        isMastered?: boolean; attemptCount?: number; lastAttempted?: number;
        weakSubtopics?: string[];
      }>;
      topicMastery = parsed.map(r => ({
        topicId:      r.topicId ?? 'unknown',
        topicName:    r.topicName ?? r.topicId ?? 'Unknown',
        masteryScore: r.masteryScore ?? 0,
        isMastered:   r.isMastered ?? false,
        attemptCount: r.attemptCount ?? 0,
        lastAttempted: r.lastAttempted,
        weakSubtopics: r.weakSubtopics ?? [],
      }));
    }
  } catch { /* ignore */ }

  // Merge Oracle mastery updates
  try {
    const oracleRaw = localStorage.getItem(LS.ORACLE_MASTERY_UPDATE);
    if (oracleRaw) {
      const oracleUpdate = JSON.parse(oracleRaw) as {
        topicId?: string; masteryScore?: number; timestamp?: number;
      };
      if (oracleUpdate.topicId) {
        const idx = topicMastery.findIndex(t => t.topicId === oracleUpdate.topicId);
        if (idx >= 0 && oracleUpdate.masteryScore !== undefined) {
          topicMastery[idx].masteryScore = oracleUpdate.masteryScore;
          topicMastery[idx].isMastered = oracleUpdate.masteryScore >= 0.85;
        }
      }
    }
  } catch { /* ignore */ }

  // Compute weakest / strongest
  const sorted = [...topicMastery].sort((a, b) => a.masteryScore - b.masteryScore);
  const quintile = Math.max(1, Math.ceil(sorted.length * 0.2));
  const weakestTopics = sorted.slice(0, quintile).map(t => t.topicId);
  const strongestTopics = sorted.slice(-quintile).map(t => t.topicId);

  // 3. Streak
  let streakDays = 0;
  try {
    const raw = localStorage.getItem(LS.STREAK);
    if (raw) streakDays = Number(JSON.parse(raw)?.current ?? raw) || 0;
  } catch { /* ignore */ }

  // 4. Session count
  let sessionCount = 0;
  try {
    const raw = localStorage.getItem(LS.SESSION_COUNT);
    if (raw) sessionCount = Number(raw) || 0;
  } catch { /* ignore */ }

  // 5. Spaced rep due topics
  let nextReviewTopics: string[] = [];
  try {
    const raw = localStorage.getItem(LS.SPACED_REP_QUEUE);
    if (raw) {
      const parsed = JSON.parse(raw) as Array<{ topicId?: string } | string>;
      nextReviewTopics = parsed.map(p => (typeof p === 'string' ? p : p.topicId ?? '')).filter(Boolean);
    }
  } catch { /* ignore */ }

  // 6. Cognitive load — estimate from mentor engagement signal
  let cognitiveLoad: 'low' | 'medium' | 'high' = 'medium';
  try {
    const raw = localStorage.getItem(LS.MENTOR_ENGAGEMENT);
    if (raw) {
      const signal = JSON.parse(raw) as { fatigue?: string; load?: string };
      if (signal.fatigue === 'high' || signal.load === 'high') cognitiveLoad = 'high';
      else if (signal.fatigue === 'low' || signal.load === 'low') cognitiveLoad = 'low';
    }
  } catch { /* ignore */ }

  // Days to exam
  const daysToExam = (persona.daysToExam as number) ?? 90;
  const examPhase = inferExamPhase(daysToExam);

  // Learning style
  const rawStyle = (persona.learningStyle as string) ?? 'mixed';
  const learningStyle: LearnerProfile['learningStyle'] =
    ['visual', 'conceptual', 'practice_first', 'mixed'].includes(rawStyle)
      ? (rawStyle as LearnerProfile['learningStyle'])
      : 'mixed';

  // Role
  const rawRole = (persona.role as string) ?? 'student';
  const role: LearnerRole = ['student', 'teacher', 'parent', 'self_learner', 'coach'].includes(rawRole)
    ? (rawRole as LearnerRole)
    : 'student';

  // Preferred channel
  const rawChannel = (persona.preferredChannel as string) ?? 'in_app_chat';
  const preferredChannel: DeliveryChannel = [
    'in_app_chat', 'practice_mcq', 'content_feed', 'notebook', 'whatsapp', 'telegram', 'email'
  ].includes(rawChannel)
    ? (rawChannel as DeliveryChannel)
    : 'in_app_chat';

  return {
    userId,
    role,
    examId: examId || (persona.exam as string) || 'GATE_EM',
    examPhase,
    daysToExam,
    learningStyle,
    cognitiveLoad,
    streakDays,
    sessionCount,
    topicMastery,
    weakestTopics,
    strongestTopics,
    nextReviewTopics,
    preferredChannel,
  };
}

// ─── selectLearningObjective ──────────────────────────────────────────────────

/**
 * Select the right learning objective given a learner profile.
 * Fully implements the priority logic from the architecture spec.
 */
export function selectLearningObjective(profile: LearnerProfile): LearningObjective {
  const { examPhase, nextReviewTopics, weakestTopics, cognitiveLoad, streakDays, topicMastery } = profile;

  // ── Priority override rules (checked before phase logic) ──────────────────

  // Override 1: Returning student (streak broken) → re-engage with revision
  if (streakDays === 0 && profile.sessionCount > 0) {
    const topicId = topicMastery[0]?.topicId ?? 'general';
    const topicName = topicMastery[0]?.topicName ?? 'Previous Topics';
    return {
      type: 'revision',
      topicId,
      topicName,
      rationale: 'You\'ve been away — let\'s ease back in with a quick revision of what you know.',
      estimatedMinutes: 10,
      difficulty: 'easy',
      prerequisites: [],
    };
  }

  // Override 2: High cognitive load → lighter revision
  if (cognitiveLoad === 'high') {
    const topicId = profile.strongestTopics[0] ?? topicMastery[0]?.topicId ?? 'general';
    const topicName = topicMastery.find(t => t.topicId === topicId)?.topicName ?? 'Known Topics';
    return {
      type: 'revision',
      topicId,
      topicName,
      rationale: 'Your session load is high — light revision of a strong topic to consolidate.',
      estimatedMinutes: 8,
      difficulty: 'easy',
      prerequisites: [],
    };
  }

  // Override 3: Spaced repetition due → revision
  if (nextReviewTopics.length > 0) {
    const topicId = nextReviewTopics[0];
    const topicName = topicMastery.find(t => t.topicId === topicId)?.topicName ?? topicId;
    return {
      type: 'revision',
      topicId,
      topicName,
      subtopicFocus: undefined,
      rationale: 'Spaced repetition: this topic is due for review to strengthen long-term retention.',
      estimatedMinutes: 12,
      difficulty: 'medium',
      prerequisites: [],
    };
  }

  // Override 4: Critical misconception — mastery < 0.2 on a weak topic
  if (weakestTopics.length > 0) {
    const weakTopic = topicMastery.find(t => t.topicId === weakestTopics[0]);
    if (weakTopic && weakTopic.masteryScore < 0.2 && weakTopic.attemptCount > 0) {
      return {
        type: 'fix_misconception',
        topicId: weakTopic.topicId,
        topicName: weakTopic.topicName,
        subtopicFocus: weakTopic.weakSubtopics[0],
        rationale: `Mastery is critically low (${Math.round(weakTopic.masteryScore * 100)}%). A targeted misconception fix will unlock faster progress.`,
        estimatedMinutes: 20,
        difficulty: 'medium',
        prerequisites: [],
      };
    }
  }

  // ── Phase-based objective selection ───────────────────────────────────────

  // Find best candidate topic based on phase
  const unstarted = topicMastery.filter(t => t.attemptCount === 0);
  const inProgress = topicMastery.filter(t => t.attemptCount > 0 && !t.isMastered);
  const mastered = topicMastery.filter(t => t.isMastered);

  const pickTopic = (candidates: TopicMasterySnapshot[], fallback?: TopicMasterySnapshot): TopicMasterySnapshot => {
    return candidates[0] ?? fallback ?? topicMastery[0] ?? {
      topicId: 'general',
      topicName: 'General Study',
      masteryScore: 0,
      isMastered: false,
      attemptCount: 0,
      weakSubtopics: [],
    };
  };

  switch (examPhase) {
    case 'discovery': {
      const topic = pickTopic(unstarted, inProgress[0]);
      return {
        type: 'introduce_concept',
        topicId: topic.topicId,
        topicName: topic.topicName,
        rationale: 'Discovery phase: exploring new territory. Let\'s start with a fresh topic.',
        estimatedMinutes: 15,
        difficulty: 'easy',
        prerequisites: [],
      };
    }

    case 'foundation': {
      // Alternate between introduce and deepen based on session parity
      const useIntro = (profile.sessionCount % 2 === 0) && unstarted.length > 0;
      if (useIntro) {
        const topic = pickTopic(unstarted);
        return {
          type: 'introduce_concept',
          topicId: topic.topicId,
          topicName: topic.topicName,
          rationale: 'Foundation phase: introducing a new core concept to build your base.',
          estimatedMinutes: 20,
          difficulty: 'easy',
          prerequisites: [],
        };
      } else {
        const topic = pickTopic(inProgress, unstarted[0]);
        return {
          type: 'deepen_understanding',
          topicId: topic.topicId,
          topicName: topic.topicName,
          rationale: 'Foundation phase: deepening understanding of a topic you\'ve started.',
          estimatedMinutes: 20,
          difficulty: 'medium',
          prerequisites: [],
        };
      }
    }

    case 'structured': {
      // Follow syllabus order — check for misconceptions first
      const misconceptionCandidate = inProgress.find(t => t.masteryScore < 0.4 && t.attemptCount >= 2);
      if (misconceptionCandidate) {
        return {
          type: 'fix_misconception',
          topicId: misconceptionCandidate.topicId,
          topicName: misconceptionCandidate.topicName,
          subtopicFocus: misconceptionCandidate.weakSubtopics[0],
          rationale: 'Structured phase: detected a persistent gap. Fixing the misconception before moving forward.',
          estimatedMinutes: 25,
          difficulty: 'medium',
          prerequisites: [],
        };
      }
      const topic = pickTopic(inProgress, unstarted[0]);
      return {
        type: 'deepen_understanding',
        topicId: topic.topicId,
        topicName: topic.topicName,
        rationale: 'Structured phase: systematic syllabus coverage — deepening the next topic.',
        estimatedMinutes: 25,
        difficulty: 'medium',
        prerequisites: [],
      };
    }

    case 'intensive': {
      // High-weightage mastered topics → build speed. Others → exam pattern
      const speedCandidate = mastered.find(t => !profile.weakestTopics.includes(t.topicId));
      if (speedCandidate) {
        return {
          type: 'build_speed',
          topicId: speedCandidate.topicId,
          topicName: speedCandidate.topicName,
          rationale: 'Intensive phase: concept is known — now build speed and accuracy for timed exams.',
          estimatedMinutes: 30,
          difficulty: 'hard',
          prerequisites: [],
        };
      }
      const topic = pickTopic(inProgress, mastered[0]);
      return {
        type: 'exam_pattern',
        topicId: topic.topicId,
        topicName: topic.topicName,
        rationale: 'Intensive phase: learn how examiners frame this topic in real papers.',
        estimatedMinutes: 25,
        difficulty: 'hard',
        prerequisites: [],
      };
    }

    case 'sprint': {
      // Alternate revision and readiness checks
      const useAssess = profile.sessionCount % 3 === 2;
      const topic = pickTopic(mastered.length > 0 ? mastered : inProgress, topicMastery[0]);
      if (useAssess) {
        return {
          type: 'assess_readiness',
          topicId: topic.topicId,
          topicName: topic.topicName,
          rationale: 'Sprint phase: time to test yourself — are you exam-ready on this topic?',
          estimatedMinutes: 20,
          difficulty: 'hard',
          prerequisites: [],
        };
      }
      return {
        type: 'revision',
        topicId: topic.topicId,
        topicName: topic.topicName,
        rationale: 'Sprint phase: rapid revision of key topics before the exam.',
        estimatedMinutes: 15,
        difficulty: 'medium',
        prerequisites: [],
      };
    }

    case 'exam_week': {
      // Revision only — no new concepts
      const topic = pickTopic(mastered.length > 0 ? mastered : topicMastery, topicMastery[0]);
      return {
        type: 'revision',
        topicId: topic.topicId,
        topicName: topic.topicName,
        rationale: 'Exam week: only revision. No new concepts — trust your preparation.',
        estimatedMinutes: 10,
        difficulty: 'medium',
        prerequisites: [],
      };
    }

    case 'post_exam': {
      // Reflection — cross-connect topics
      const topic = pickTopic(mastered, topicMastery[0]);
      return {
        type: 'cross_connect',
        topicId: topic.topicId,
        topicName: topic.topicName,
        rationale: 'Post-exam: connecting concepts across topics for deeper understanding and next exam prep.',
        estimatedMinutes: 20,
        difficulty: 'medium',
        prerequisites: [],
      };
    }

    default: {
      return {
        type: 'revision',
        topicId: topicMastery[0]?.topicId ?? 'general',
        topicName: topicMastery[0]?.topicName ?? 'General',
        rationale: 'Default: revision to re-engage.',
        estimatedMinutes: 15,
        difficulty: 'medium',
        prerequisites: [],
      };
    }
  }
}

// ─── decideContent ────────────────────────────────────────────────────────────

/**
 * Decide content mode, format, channel, and agent assignment.
 */
export function decideContent(profile: LearnerProfile, objective: LearningObjective): ContentDecision {
  const { daysToExam, learningStyle, preferredChannel, examPhase } = profile;
  const { type: objType } = objective;

  // ── Content mode selection ──────────────────────────────────────────────

  let mode: ContentMode;

  if (objType === 'introduce_concept') {
    mode = 'wolfram_verified'; // math/logic verification for new concepts
  } else if (objType === 'exam_pattern') {
    mode = 'static_pyq'; // exam pattern → real PYQs first
  } else if (objType === 'build_speed') {
    mode = 'static_pyq'; // speed → pre-built MCQ bank
  } else if (objType === 'revision') {
    mode = daysToExam < 14 ? 'static_pyq' : 'rag_retrieval';
  } else if (objType === 'fix_misconception') {
    mode = 'llm_generated'; // custom explanation for wrong mental model
  } else if (objType === 'deepen_understanding') {
    mode = 'rag_retrieval';
  } else if (objType === 'cross_connect') {
    mode = 'llm_generated';
  } else if (objType === 'assess_readiness') {
    mode = 'static_pyq';
  } else {
    mode = 'rag_retrieval';
  }

  // Days < 7 + MCQ → always static for exam-realistic feel
  if (daysToExam < 7 && ['assess_readiness', 'build_speed', 'exam_pattern'].includes(objType)) {
    mode = 'static_pyq';
  }

  // ── Format selection ────────────────────────────────────────────────────

  let format: ContentDecision['format'];

  if (objType === 'introduce_concept') {
    format = learningStyle === 'visual' ? 'concept_map' : 'explanation';
  } else if (objType === 'deepen_understanding') {
    format = 'worked_example';
  } else if (objType === 'fix_misconception') {
    format = 'explanation';
  } else if (objType === 'build_speed') {
    format = 'mcq';
  } else if (objType === 'exam_pattern') {
    format = 'mock_question';
  } else if (objType === 'revision') {
    format = examPhase === 'exam_week' ? 'revision_card' : 'formula_sheet';
  } else if (objType === 'cross_connect') {
    format = 'concept_map';
  } else if (objType === 'assess_readiness') {
    format = 'mcq';
  } else {
    format = 'explanation';
  }

  // Practice-first learners → mcq whenever appropriate
  if (learningStyle === 'practice_first' && ['revision', 'deepen_understanding'].includes(objType)) {
    format = 'mcq';
  }

  // ── Channel selection ───────────────────────────────────────────────────

  let channel: DeliveryChannel = preferredChannel;

  if (['build_speed', 'assess_readiness', 'exam_pattern'].includes(objType)) {
    channel = 'practice_mcq';
  } else if (['introduce_concept', 'deepen_understanding'].includes(objType)) {
    channel = 'in_app_chat';
  } else if (objType === 'revision' && examPhase === 'sprint') {
    channel = 'practice_mcq';
  }

  // ── Agent assignment ────────────────────────────────────────────────────

  let agentId: ContentDecision['agentId'];

  if (['introduce_concept', 'deepen_understanding', 'fix_misconception', 'cross_connect'].includes(objType)) {
    agentId = 'sage';
  } else if (['build_speed', 'exam_pattern', 'assess_readiness'].includes(objType)) {
    agentId = 'atlas';
  } else if (objType === 'revision') {
    agentId = examPhase === 'exam_week' ? 'sage' : 'atlas';
  } else {
    agentId = 'sage';
  }

  // ── Prompt directives ───────────────────────────────────────────────────

  const promptDirectives: string[] = [
    `objective: ${objType}`,
    `topic: ${objective.topicName}`,
    `difficulty: ${objective.difficulty}`,
    `phase: ${examPhase}`,
  ];
  if (objective.subtopicFocus) promptDirectives.push(`subtopic_focus: ${objective.subtopicFocus}`);
  if (learningStyle !== 'mixed') promptDirectives.push(`learning_style: ${learningStyle}`);

  // ── Tier target ─────────────────────────────────────────────────────────

  const tierMap: Record<ContentMode, 0 | 1 | 2 | 3 | 4> = {
    static_pyq: 0,
    rag_retrieval: 1,
    llm_generated: 2,
    wolfram_verified: 3,
    rich_media: 4,
  };

  // ── Token estimate ──────────────────────────────────────────────────────

  const tokenMap: Record<ContentDecision['format'], number> = {
    explanation: 400,
    worked_example: 600,
    mcq: 250,
    short_answer: 300,
    concept_map: 350,
    formula_sheet: 200,
    revision_card: 150,
    mock_question: 300,
  };

  return {
    mode,
    format,
    channel,
    agentId,
    promptDirectives,
    contextAtoms: [],
    estimatedTokens: tokenMap[format] ?? 300,
    tierTarget: tierMap[mode],
  };
}

// ─── applyRoleOverrides ───────────────────────────────────────────────────────

/**
 * Apply role-specific overrides to an orchestrator decision.
 */
export function applyRoleOverrides(
  decision: OrchestratorDecision,
  role: LearnerRole
): OrchestratorDecision {
  const result = { ...decision };

  switch (role) {
    case 'teacher': {
      result.objective = {
        ...result.objective,
        type: 'assess_readiness',
        rationale: 'Teacher view: assessing class readiness and identifying students who need intervention.',
      };
      result.contentDecision = {
        ...result.contentDecision,
        channel: 'content_feed',
        agentId: 'oracle',
        format: 'revision_card',
      };
      result.studentInsights = {
        topStruggle: result.learnerProfile.weakestTopics[0] ?? 'No data',
        recentWin: result.learnerProfile.strongestTopics[0] ?? 'No data',
        suggestedIntervention: `Focus class time on ${result.learnerProfile.weakestTopics[0] ?? 'weak topics'} — mastery below threshold.`,
      };
      break;
    }

    case 'parent': {
      result.objective = {
        ...result.objective,
        type: 'assess_readiness',
        rationale: 'Parent view: checking child\'s progress and readiness.',
      };
      result.contentDecision = {
        ...result.contentDecision,
        channel: result.learnerProfile.preferredChannel === 'whatsapp' ? 'whatsapp' : 'email',
        format: 'revision_card',
        agentId: 'oracle',
      };
      result.studentInsights = {
        topStruggle: result.learnerProfile.weakestTopics[0] ?? 'No data',
        recentWin: result.learnerProfile.strongestTopics[0] ?? 'No data',
        suggestedIntervention: `Your child needs extra help with ${result.learnerProfile.weakestTopics[0] ?? 'weak areas'}. Consider a focused practice session.`,
      };
      break;
    }

    case 'coach': {
      // Coach gets analytics + assessment focus
      result.objective = {
        ...result.objective,
        type: 'assess_readiness',
        rationale: 'Coach view: evaluating student mastery to plan next coaching session.',
      };
      result.contentDecision = {
        ...result.contentDecision,
        agentId: 'oracle',
        channel: 'content_feed',
      };
      result.studentInsights = {
        topStruggle: result.learnerProfile.weakestTopics[0] ?? 'No data',
        recentWin: result.learnerProfile.strongestTopics[0] ?? 'No data',
        suggestedIntervention: `Next session: drill ${result.learnerProfile.weakestTopics.slice(0, 2).join(' and ')}.`,
      };
      break;
    }

    case 'self_learner': {
      // Self-learner: breadth over depth, cross-connect
      result.objective = {
        ...result.objective,
        type: 'cross_connect',
        rationale: 'Self-learner mode: exploring connections between topics for broader understanding.',
      };
      result.contentDecision = {
        ...result.contentDecision,
        mode: 'llm_generated',
        format: 'concept_map',
      };
      break;
    }

    default:
      break; // student — no overrides needed
  }

  return result;
}

// ─── buildAdaptationHints ─────────────────────────────────────────────────────

function buildAdaptationHints(
  profile: LearnerProfile,
  objective: LearningObjective
): OrchestratorDecision['adaptationHints'] {
  const nextObjectiveType: LearningObjectiveType = (() => {
    switch (objective.type) {
      case 'introduce_concept': return 'deepen_understanding';
      case 'deepen_understanding': return 'build_speed';
      case 'fix_misconception': return 'deepen_understanding';
      case 'build_speed': return 'exam_pattern';
      case 'exam_pattern': return 'assess_readiness';
      case 'revision': return 'assess_readiness';
      case 'assess_readiness': return 'cross_connect';
      case 'cross_connect': return 'revision';
      default: return 'revision';
    }
  })();

  return {
    ifConfused: `Switch to a simpler analogy or worked example for "${objective.topicName}". Ask: "What part is confusing — the concept or the calculation?"`,
    ifBored: `Increase difficulty or jump to a challenge problem. Try: "Beat the clock — solve this in under 2 minutes."`,
    ifTooFast: `Move to the next subtopic: ${objective.subtopicFocus ?? objective.topicName}. Consider unlocking harder questions.`,
    nextObjective: `After ${objective.type} → ${nextObjectiveType} on ${objective.topicName}`,
  };
}

// ─── emitOrchestratorSignals ──────────────────────────────────────────────────

/**
 * Emit signals to all connected agents via localStorage.
 */
export function emitOrchestratorSignals(decision: OrchestratorDecision): void {
  const { objective, contentDecision, learnerProfile } = decision;

  // → Sage: inject prompt directive
  if (contentDecision.agentId === 'sage') {
    localStorage.setItem(LS.SAGE_DIRECTIVE, JSON.stringify({
      objective: objective.type,
      topicFocus: objective.topicName,
      difficulty: objective.difficulty,
      promptAdd: contentDecision.promptDirectives.join('\n'),
      sessionId: decision.sessionId,
      timestamp: decision.timestamp,
    }));
  }

  // → Atlas: content generation request
  if (contentDecision.agentId === 'atlas') {
    localStorage.setItem(LS.ATLAS_TASK, JSON.stringify({
      examId: learnerProfile.examId,
      topicId: objective.topicId,
      topicName: objective.topicName,
      format: contentDecision.format,
      mode: contentDecision.mode,
      difficulty: objective.difficulty,
      sessionId: decision.sessionId,
      timestamp: decision.timestamp,
    }));
  }

  // → Mentor: engagement signal
  localStorage.setItem(LS.MENTOR_NUDGE, JSON.stringify({
    userId: learnerProfile.userId,
    streakDays: learnerProfile.streakDays,
    phase: learnerProfile.examPhase,
    cognitiveLoad: learnerProfile.cognitiveLoad,
    objective: objective.type,
    sessionId: decision.sessionId,
    timestamp: decision.timestamp,
  }));

  // → Oracle: analytics event
  localStorage.setItem(LS.ORACLE_EVENT, JSON.stringify({
    event: 'orchestrator_decision',
    userId: learnerProfile.userId,
    examId: learnerProfile.examId,
    phase: learnerProfile.examPhase,
    objective: objective.type,
    topicId: objective.topicId,
    channel: contentDecision.channel,
    agentId: contentDecision.agentId,
    tierTarget: contentDecision.tierTarget,
    sessionId: decision.sessionId,
    timestamp: decision.timestamp,
  }));

  // → Scout: content intelligence priority
  localStorage.setItem(LS.SCOUT_PRIORITY, JSON.stringify({
    examId: learnerProfile.examId,
    topicId: objective.topicId,
    weakTopics: learnerProfile.weakestTopics,
    phase: learnerProfile.examPhase,
    sessionId: decision.sessionId,
    timestamp: decision.timestamp,
  }));
}

// ─── orchestrateSession ───────────────────────────────────────────────────────

/**
 * PRIMARY ENTRY POINT.
 * Runs the full orchestration pipeline for a user session.
 */
export async function orchestrateSession(
  userId: string,
  examId: string,
  channel?: DeliveryChannel
): Promise<OrchestratorDecision> {
  const sessionId = `orch-${userId}-${Date.now()}`;

  // Build learner profile
  const learnerProfile = buildLearnerProfile(userId, examId);
  if (channel) learnerProfile.preferredChannel = channel;

  // Select learning objective
  const objective = selectLearningObjective(learnerProfile);

  // Decide content
  const contentDecision = decideContent(learnerProfile, objective);

  // Build adaptation hints
  const adaptationHints = buildAdaptationHints(learnerProfile, objective);

  // Assemble decision
  let decision: OrchestratorDecision = {
    sessionId,
    userId,
    timestamp: Date.now(),
    learnerProfile,
    objective,
    contentDecision,
    adaptationHints,
    signals: {},
  };

  // Apply role overrides
  decision = applyRoleOverrides(decision, learnerProfile.role);

  // Emit signals
  emitOrchestratorSignals(decision);

  // Sync state
  syncOrchestratorState(decision);

  // Save to history
  _appendToHistory(userId, decision);

  return decision;
}

// ─── recordOutcome ────────────────────────────────────────────────────────────

/**
 * Feedback loop — record outcome of last orchestrator decision.
 */
export function recordOutcome(
  sessionId: string,
  outcome: {
    completed: boolean;
    timeSpentMs: number;
    correctAnswers?: number;
    totalAnswers?: number;
    studentFeedback?: 'too_easy' | 'just_right' | 'too_hard' | 'confusing';
  }
): void {
  const record: OutcomeRecord = { sessionId, ...outcome, timestamp: Date.now() };

  try {
    const raw = localStorage.getItem(LS.OUTCOME_LOG);
    const log: OutcomeRecord[] = raw ? (JSON.parse(raw) as OutcomeRecord[]) : [];
    log.push(record);
    // Keep last 100
    const trimmed = log.slice(-100);
    localStorage.setItem(LS.OUTCOME_LOG, JSON.stringify(trimmed));
  } catch { /* ignore */ }

  // Emit to Oracle
  localStorage.setItem(LS.ORACLE_EVENT, JSON.stringify({
    event: 'session_outcome',
    sessionId,
    ...outcome,
    timestamp: Date.now(),
  }));
}

// ─── getDecisionHistory ───────────────────────────────────────────────────────

/**
 * Get history of orchestrator decisions for a user.
 */
export function getDecisionHistory(userId: string, limit = 10): OrchestratorDecision[] {
  try {
    const raw = localStorage.getItem(LS.ORCHESTRATOR_HISTORY(userId));
    if (!raw) return [];
    const all = JSON.parse(raw) as OrchestratorDecision[];
    return all.slice(-limit).reverse(); // most recent first
  } catch {
    return [];
  }
}

// ─── syncOrchestratorState ────────────────────────────────────────────────────

/**
 * Sync orchestrator state snapshot to localStorage for other services to read.
 */
export function syncOrchestratorState(decision: OrchestratorDecision): void {
  try {
    localStorage.setItem(LS.ORCHESTRATOR_STATE, JSON.stringify({
      lastDecision: decision,
      syncedAt: Date.now(),
    }));
  } catch { /* ignore */ }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _appendToHistory(userId: string, decision: OrchestratorDecision): void {
  try {
    const key = LS.ORCHESTRATOR_HISTORY(userId);
    const raw = localStorage.getItem(key);
    const history: OrchestratorDecision[] = raw ? (JSON.parse(raw) as OrchestratorDecision[]) : [];
    history.push(decision);
    // Keep last 50 per user
    const trimmed = history.slice(-50);
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch { /* ignore */ }
}

// ─── getOrchestratorRules ─────────────────────────────────────────────────────

export interface OrchestratorRules {
  phaseThresholds: PhaseThresholds;
  autoSyncIntervalMs: number;
  roleOverridesEnabled: Record<LearnerRole, boolean>;
  contentModePreferences: Partial<Record<LearningObjectiveType, ContentMode>>;
}

export function getOrchestratorRules(): OrchestratorRules {
  const defaults: OrchestratorRules = {
    phaseThresholds: getPhaseThresholds(),
    autoSyncIntervalMs: 30000,
    roleOverridesEnabled: {
      student: true,
      teacher: true,
      parent: true,
      self_learner: true,
      coach: true,
    },
    contentModePreferences: {},
  };
  try {
    const raw = localStorage.getItem(LS.RULES);
    if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<OrchestratorRules>) };
  } catch { /* ignore */ }
  return defaults;
}

export function saveOrchestratorRules(rules: Partial<OrchestratorRules>): void {
  try {
    const current = getOrchestratorRules();
    localStorage.setItem(LS.RULES, JSON.stringify({ ...current, ...rules }));
  } catch { /* ignore */ }
}

// ─── Course Summary Outline ───────────────────────────────────────────────────
//
// Generated BEFORE content is approved/delivered. Gives the CEO/admin a full
// hierarchical view of what will be generated and delivered. Every node can be
// toggled off (excluded) or edited, then explicitly approved before Atlas runs.

export type OutlineNodeStatus = 'included' | 'excluded' | 'pending';

export interface OutlineLesson {
  id: string;
  title: string;
  objectiveType: LearningObjectiveType;
  format: ContentDecision['format'];
  mode: ContentMode;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedMinutes: number;
  agentId: 'sage' | 'atlas' | 'mentor' | 'oracle';
  status: OutlineNodeStatus;
  rationale: string;
  prerequisites: string[];
}

export interface OutlineTopic {
  id: string;
  topicId: string;
  topicName: string;
  phase: ExamPhase;
  totalMinutes: number;
  lessons: OutlineLesson[];
  status: OutlineNodeStatus;
}

export interface OutlineModule {
  id: string;
  title: string;           // e.g. "Foundation Phase — Core Concepts"
  phase: ExamPhase;
  description: string;
  totalMinutes: number;
  topics: OutlineTopic[];
  status: OutlineNodeStatus;
}

export interface CourseSummaryOutline {
  id: string;
  examId: string;
  examName: string;
  generatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  status: 'draft' | 'approved' | 'generating' | 'complete';
  totalModules: number;
  totalTopics: number;
  totalLessons: number;
  estimatedHours: number;
  modules: OutlineModule[];
  changeLog: Array<{ ts: string; change: string }>;
}

// ─── Exam topic catalogue (seeded per exam) ───────────────────────────────────

const EXAM_TOPIC_CATALOGUE: Record<string, Array<{ topicId: string; topicName: string; difficulty: 'easy' | 'medium' | 'hard'; estimatedMinutes: number }>> = {
  GATE_EM: [
    { topicId: 'linear_algebra',   topicName: 'Linear Algebra',      difficulty: 'medium', estimatedMinutes: 45 },
    { topicId: 'calculus',         topicName: 'Calculus',            difficulty: 'medium', estimatedMinutes: 40 },
    { topicId: 'probability',      topicName: 'Probability & Stats', difficulty: 'medium', estimatedMinutes: 35 },
    { topicId: 'complex_numbers',  topicName: 'Complex Numbers',     difficulty: 'hard',   estimatedMinutes: 30 },
    { topicId: 'signals',          topicName: 'Signals & Systems',   difficulty: 'hard',   estimatedMinutes: 50 },
    { topicId: 'numerical_methods',topicName: 'Numerical Methods',   difficulty: 'hard',   estimatedMinutes: 35 },
    { topicId: 'transform_theory', topicName: 'Transform Theory',    difficulty: 'hard',   estimatedMinutes: 40 },
    { topicId: 'differential_eq',  topicName: 'Differential Equations', difficulty: 'medium', estimatedMinutes: 35 },
  ],
  JEE: [
    { topicId: 'mechanics',        topicName: 'Mechanics',           difficulty: 'medium', estimatedMinutes: 50 },
    { topicId: 'thermodynamics',   topicName: 'Thermodynamics',      difficulty: 'medium', estimatedMinutes: 40 },
    { topicId: 'electromagnetism', topicName: 'Electromagnetism',    difficulty: 'hard',   estimatedMinutes: 55 },
    { topicId: 'organic_chemistry',topicName: 'Organic Chemistry',   difficulty: 'hard',   estimatedMinutes: 60 },
    { topicId: 'inorganic_chem',   topicName: 'Inorganic Chemistry', difficulty: 'medium', estimatedMinutes: 45 },
    { topicId: 'calculus',         topicName: 'Calculus',            difficulty: 'medium', estimatedMinutes: 50 },
    { topicId: 'algebra',          topicName: 'Algebra',             difficulty: 'medium', estimatedMinutes: 40 },
    { topicId: 'coordinate_geo',   topicName: 'Coordinate Geometry', difficulty: 'medium', estimatedMinutes: 35 },
    { topicId: 'optics',           topicName: 'Optics',              difficulty: 'easy',   estimatedMinutes: 30 },
  ],
  NEET: [
    { topicId: 'cell_biology',     topicName: 'Cell Biology',        difficulty: 'medium', estimatedMinutes: 40 },
    { topicId: 'genetics',         topicName: 'Genetics',            difficulty: 'hard',   estimatedMinutes: 50 },
    { topicId: 'plant_physiology', topicName: 'Plant Physiology',    difficulty: 'medium', estimatedMinutes: 35 },
    { topicId: 'human_physiology', topicName: 'Human Physiology',    difficulty: 'hard',   estimatedMinutes: 55 },
    { topicId: 'organic_chemistry',topicName: 'Organic Chemistry',   difficulty: 'hard',   estimatedMinutes: 50 },
    { topicId: 'biomolecules',     topicName: 'Biomolecules',        difficulty: 'medium', estimatedMinutes: 35 },
    { topicId: 'mechanics',        topicName: 'Mechanics',           difficulty: 'easy',   estimatedMinutes: 30 },
  ],
  CAT: [
    { topicId: 'quant_arithmetic', topicName: 'Arithmetic',          difficulty: 'medium', estimatedMinutes: 40 },
    { topicId: 'quant_algebra',    topicName: 'Algebra',             difficulty: 'medium', estimatedMinutes: 35 },
    { topicId: 'quant_geometry',   topicName: 'Geometry',            difficulty: 'hard',   estimatedMinutes: 40 },
    { topicId: 'reading_comp',     topicName: 'Reading Comprehension', difficulty: 'hard', estimatedMinutes: 50 },
    { topicId: 'verbal_ability',   topicName: 'Verbal Ability',      difficulty: 'medium', estimatedMinutes: 35 },
    { topicId: 'dilr',             topicName: 'Data Interpretation & LR', difficulty: 'hard', estimatedMinutes: 55 },
  ],
  CBSE_12: [
    { topicId: 'calculus',         topicName: 'Calculus',            difficulty: 'medium', estimatedMinutes: 45 },
    { topicId: 'vectors',          topicName: 'Vectors & 3D',        difficulty: 'medium', estimatedMinutes: 35 },
    { topicId: 'probability',      topicName: 'Probability',         difficulty: 'easy',   estimatedMinutes: 30 },
    { topicId: 'electrostatics',   topicName: 'Electrostatics',      difficulty: 'medium', estimatedMinutes: 40 },
    { topicId: 'magnetism',        topicName: 'Magnetism',           difficulty: 'medium', estimatedMinutes: 35 },
    { topicId: 'organic_chemistry',topicName: 'Organic Chemistry',   difficulty: 'hard',   estimatedMinutes: 50 },
  ],
};

// ─── Lesson generator per topic ───────────────────────────────────────────────

function buildLessonsForTopic(
  topicId: string,
  topicName: string,
  difficulty: 'easy' | 'medium' | 'hard',
  phase: ExamPhase,
  phaseIndex: number,
): OutlineLesson[] {
  const lessons: OutlineLesson[] = [];
  const base = `${topicId}::${phase}`;

  // Phase determines which lessons are generated
  const lessonSet: Array<{
    suffix: string;
    title: string;
    objType: LearningObjectiveType;
    format: ContentDecision['format'];
    mode: ContentMode;
    minutes: number;
    agent: OutlineLesson['agentId'];
    rationale: string;
  }> = [];

  if (['discovery', 'foundation'].includes(phase)) {
    lessonSet.push({
      suffix: 'intro',
      title: `Introduction to ${topicName}`,
      objType: 'introduce_concept',
      format: 'explanation',
      mode: 'llm_generated',
      minutes: 15,
      agent: 'sage',
      rationale: 'First-encounter lesson: builds mental model from scratch with real-world hooks.',
    });
    lessonSet.push({
      suffix: 'worked',
      title: `${topicName} — Worked Examples`,
      objType: 'deepen_understanding',
      format: 'worked_example',
      mode: 'wolfram_verified',
      minutes: 20,
      agent: 'sage',
      rationale: 'Deepens understanding through step-by-step verified examples.',
    });
  }

  if (['structured', 'intensive'].includes(phase)) {
    lessonSet.push({
      suffix: 'misconception',
      title: `Common Mistakes in ${topicName}`,
      objType: 'fix_misconception',
      format: 'explanation',
      mode: 'llm_generated',
      minutes: 12,
      agent: 'sage',
      rationale: 'Targets the most common wrong mental models detected in student cohort.',
    });
    lessonSet.push({
      suffix: 'practice',
      title: `${topicName} — MCQ Drill`,
      objType: 'build_speed',
      format: 'mcq',
      mode: 'static_pyq',
      minutes: 20,
      agent: 'atlas',
      rationale: 'Builds timed MCQ speed. Uses PYQs from previous exam papers.',
    });
    lessonSet.push({
      suffix: 'exam_pattern',
      title: `${topicName} — Exam Pattern Analysis`,
      objType: 'exam_pattern',
      format: 'mock_question',
      mode: 'static_pyq',
      minutes: 18,
      agent: 'atlas',
      rationale: 'Shows exactly how examiners frame this topic. PYQ-anchored.',
    });
  }

  if (['sprint', 'exam_week'].includes(phase)) {
    lessonSet.push({
      suffix: 'formula',
      title: `${topicName} — Formula Sheet`,
      objType: 'revision',
      format: 'formula_sheet',
      mode: 'static_pyq',
      minutes: 8,
      agent: 'atlas',
      rationale: 'High-density formula revision card. Zero prose, maximum recall.',
    });
    lessonSet.push({
      suffix: 'readiness',
      title: `${topicName} — Readiness Check`,
      objType: 'assess_readiness',
      format: 'mcq',
      mode: 'static_pyq',
      minutes: 15,
      agent: 'atlas',
      rationale: 'Diagnostic MCQ set to confirm exam-readiness before the test.',
    });
  }

  if (phase === 'post_exam') {
    lessonSet.push({
      suffix: 'crossconnect',
      title: `${topicName} — Cross-Connections`,
      objType: 'cross_connect',
      format: 'concept_map',
      mode: 'llm_generated',
      minutes: 20,
      agent: 'sage',
      rationale: 'Links this topic to adjacent concepts for deeper long-term understanding.',
    });
  }

  // If phase has no specific set, default to intro + practice
  if (lessonSet.length === 0) {
    lessonSet.push({
      suffix: 'intro',
      title: `Introduction to ${topicName}`,
      objType: 'introduce_concept',
      format: 'explanation',
      mode: 'llm_generated',
      minutes: 15,
      agent: 'sage',
      rationale: 'General introduction lesson.',
    });
    lessonSet.push({
      suffix: 'practice',
      title: `${topicName} — Practice`,
      objType: 'build_speed',
      format: 'mcq',
      mode: 'static_pyq',
      minutes: 15,
      agent: 'atlas',
      rationale: 'Practice MCQs for this topic.',
    });
  }

  lessonSet.forEach((l, li) => {
    lessons.push({
      id: `${base}::${l.suffix}::${phaseIndex}-${li}`,
      title: l.title,
      objectiveType: l.objType,
      format: l.format,
      mode: l.mode,
      difficulty,
      estimatedMinutes: l.minutes,
      agentId: l.agent,
      status: 'included',
      rationale: l.rationale,
      prerequisites: li > 0 ? [`${base}::${lessonSet[li - 1].suffix}::${phaseIndex}-${li - 1}`] : [],
    });
  });

  return lessons;
}

// ─── generateCourseSummary ────────────────────────────────────────────────────

/**
 * Generate a full hierarchical course summary outline for a given exam.
 * This is called BEFORE approval — the CEO reviews and edits, then approves.
 * Atlas only runs after approval.
 *
 * Structure:  CourseSummaryOutline → [OutlineModule] → [OutlineTopic] → [OutlineLesson]
 */
export function generateCourseSummary(
  examId: string,
  daysToExam: number,
  customTopicIds?: string[],   // optional: restrict to these topics only
): CourseSummaryOutline {
  const id = `outline-${examId}-${Date.now()}`;
  const topics = (EXAM_TOPIC_CATALOGUE[examId] ?? EXAM_TOPIC_CATALOGUE.GATE_EM)
    .filter(t => !customTopicIds || customTopicIds.includes(t.topicId));

  // Determine phases to cover based on daysToExam
  const phasePlan: ExamPhase[] = [];
  if (daysToExam > 90)  phasePlan.push('foundation');
  if (daysToExam > 45)  phasePlan.push('structured');
  if (daysToExam > 21)  phasePlan.push('intensive');
  if (daysToExam > 7)   phasePlan.push('sprint');
  if (daysToExam <= 7)  phasePlan.push('exam_week');
  if (daysToExam <= 0)  phasePlan.push('post_exam');
  if (phasePlan.length === 0) phasePlan.push('structured');

  const PHASE_MODULE_TITLES: Record<ExamPhase, string> = {
    discovery:  '🌱 Discovery — Orientation',
    foundation: '🏗️ Foundation — Core Concepts',
    structured: '📐 Structured — Systematic Coverage',
    intensive:  '⚡ Intensive — Speed & Accuracy',
    sprint:     '🏃 Sprint — High-Value Revision',
    exam_week:  '🎯 Exam Week — Final Polish',
    post_exam:  '🎉 Post-Exam — Deep Connections',
  };
  const PHASE_DESC: Record<ExamPhase, string> = {
    discovery:  'Orientation and broad exploration of the exam landscape.',
    foundation: 'Build conceptual understanding from the ground up for all core topics.',
    structured: 'Systematic syllabus coverage: deepen understanding and fix misconceptions.',
    intensive:  'Speed-building, exam-pattern mastery and high-difficulty drills.',
    sprint:     'Focused revision of key formulas and rapid readiness checks.',
    exam_week:  'Last-mile formula sheets and confidence-building readiness tests.',
    post_exam:  'Cross-topic connections and preparation for the next level.',
  };

  const modules: OutlineModule[] = phasePlan.map((phase, phaseIndex) => {
    const outlineTopics: OutlineTopic[] = topics.map((t, ti) => {
      const lessons = buildLessonsForTopic(t.topicId, t.topicName, t.difficulty, phase, phaseIndex * 100 + ti);
      const totalMinutes = lessons.reduce((s, l) => s + l.estimatedMinutes, 0);
      return {
        id: `topic-${phase}-${t.topicId}`,
        topicId: t.topicId,
        topicName: t.topicName,
        phase,
        totalMinutes,
        lessons,
        status: 'included',
      };
    });

    const totalMinutes = outlineTopics.reduce((s, t) => s + t.totalMinutes, 0);
    return {
      id: `module-${phase}-${phaseIndex}`,
      title: PHASE_MODULE_TITLES[phase] ?? `Phase: ${phase}`,
      phase,
      description: PHASE_DESC[phase] ?? '',
      totalMinutes,
      topics: outlineTopics,
      status: 'included',
    };
  });

  const totalLessons = modules.flatMap(m => m.topics.flatMap(t => t.lessons)).length;
  const totalTopics  = modules.flatMap(m => m.topics).length;
  const totalMinutes = modules.reduce((s, m) => s + m.totalMinutes, 0);

  return {
    id,
    examId,
    examName: examId,
    generatedAt: new Date().toISOString(),
    status: 'draft',
    totalModules: modules.length,
    totalTopics,
    totalLessons,
    estimatedHours: Math.round(totalMinutes / 60),
    modules,
    changeLog: [{ ts: new Date().toISOString(), change: 'Outline generated — awaiting approval.' }],
  };
}

// ─── Outline mutation helpers ─────────────────────────────────────────────────

/** Toggle include/exclude on any outline node by id. */
export function toggleOutlineNode(
  outline: CourseSummaryOutline,
  nodeId: string,
  level: 'module' | 'topic' | 'lesson',
  nextStatus: OutlineNodeStatus,
): CourseSummaryOutline {
  const updated: CourseSummaryOutline = JSON.parse(JSON.stringify(outline));
  let changeDesc = '';

  if (level === 'module') {
    const m = updated.modules.find(m => m.id === nodeId);
    if (m) {
      m.status = nextStatus;
      // Cascade to children
      m.topics.forEach(t => {
        t.status = nextStatus;
        t.lessons.forEach(l => { l.status = nextStatus; });
      });
      changeDesc = `Module "${m.title}" → ${nextStatus}`;
    }
  } else if (level === 'topic') {
    for (const m of updated.modules) {
      const t = m.topics.find(t => t.id === nodeId);
      if (t) {
        t.status = nextStatus;
        t.lessons.forEach(l => { l.status = nextStatus; });
        changeDesc = `Topic "${t.topicName}" in module "${m.title}" → ${nextStatus}`;
        break;
      }
    }
  } else {
    for (const m of updated.modules) {
      for (const t of m.topics) {
        const l = t.lessons.find(l => l.id === nodeId);
        if (l) {
          l.status = nextStatus;
          changeDesc = `Lesson "${l.title}" → ${nextStatus}`;
          break;
        }
      }
    }
  }

  // Recompute summary counts
  const allLessons = updated.modules.flatMap(m => m.topics.flatMap(t => t.lessons));
  const includedLessons = allLessons.filter(l => l.status === 'included');
  updated.totalLessons = includedLessons.length;
  updated.totalTopics  = updated.modules.flatMap(m => m.topics.filter(t => t.status === 'included')).length;
  updated.totalModules = updated.modules.filter(m => m.status === 'included').length;
  updated.estimatedHours = Math.round(includedLessons.reduce((s, l) => s + l.estimatedMinutes, 0) / 60);

  if (changeDesc) {
    updated.changeLog.push({ ts: new Date().toISOString(), change: changeDesc });
  }

  return updated;
}

/** Update a lesson's title, rationale, or difficulty. */
export function editOutlineLesson(
  outline: CourseSummaryOutline,
  lessonId: string,
  patch: Partial<Pick<OutlineLesson, 'title' | 'rationale' | 'difficulty' | 'estimatedMinutes' | 'format'>>,
): CourseSummaryOutline {
  const updated: CourseSummaryOutline = JSON.parse(JSON.stringify(outline));
  for (const m of updated.modules) {
    for (const t of m.topics) {
      const l = t.lessons.find(l => l.id === lessonId);
      if (l) {
        const changes = Object.entries(patch)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        Object.assign(l, patch);
        updated.changeLog.push({ ts: new Date().toISOString(), change: `Lesson "${l.title}" edited — ${changes}` });
        break;
      }
    }
  }
  return updated;
}

/** Approve the outline — records who approved and when. */
export function approveOutline(
  outline: CourseSummaryOutline,
  approvedBy = 'CEO',
): CourseSummaryOutline {
  return {
    ...outline,
    status: 'approved',
    approvedAt: new Date().toISOString(),
    approvedBy,
    changeLog: [...outline.changeLog, {
      ts: new Date().toISOString(),
      change: `✅ Approved by ${approvedBy} — Atlas generation queued.`,
    }],
  };
}

const OUTLINE_LS_KEY = 'edugenius_course_outline';

export function saveOutlineToStorage(outline: CourseSummaryOutline): void {
  try { localStorage.setItem(OUTLINE_LS_KEY, JSON.stringify(outline)); } catch { /* ignore */ }
}

export function loadOutlineFromStorage(): CourseSummaryOutline | null {
  try {
    const raw = localStorage.getItem(OUTLINE_LS_KEY);
    return raw ? (JSON.parse(raw) as CourseSummaryOutline) : null;
  } catch { return null; }
}

// ─── Signal health check ──────────────────────────────────────────────────────

export interface AgentSignalStatus {
  agentId: string;
  outboundKey: string;
  inboundKey?: string;
  lastOutboundTs?: number;
  lastInboundTs?: number;
  outboundStatus: 'live' | 'silent' | 'error';
  inboundStatus: 'live' | 'silent' | 'unknown';
}

export function getAgentSignalStatuses(): AgentSignalStatus[] {
  const now = Date.now();
  const MAX_AGE = 3600000; // 1 hour

  const readTs = (key: string): number | undefined => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as { timestamp?: number; ts?: number };
      return parsed.timestamp ?? parsed.ts ?? now - 500;
    } catch { return undefined; }
  };

  const statusOf = (ts: number | undefined): 'live' | 'silent' | 'error' => {
    if (!ts) return 'silent';
    return (now - ts) < MAX_AGE ? 'live' : 'silent';
  };

  return [
    {
      agentId: 'sage',
      outboundKey: LS.SAGE_DIRECTIVE,
      inboundKey: LS.SAGE_OUTCOME,
      lastOutboundTs: readTs(LS.SAGE_DIRECTIVE),
      lastInboundTs: readTs(LS.SAGE_OUTCOME),
      outboundStatus: statusOf(readTs(LS.SAGE_DIRECTIVE)),
      inboundStatus: readTs(LS.SAGE_OUTCOME) ? 'live' : 'silent',
    },
    {
      agentId: 'atlas',
      outboundKey: LS.ATLAS_TASK,
      inboundKey: LS.ATLAS_READY,
      lastOutboundTs: readTs(LS.ATLAS_TASK),
      lastInboundTs: readTs(LS.ATLAS_READY),
      outboundStatus: statusOf(readTs(LS.ATLAS_TASK)),
      inboundStatus: readTs(LS.ATLAS_READY) ? 'live' : 'silent',
    },
    {
      agentId: 'mentor',
      outboundKey: LS.MENTOR_NUDGE,
      inboundKey: LS.MENTOR_ENGAGEMENT,
      lastOutboundTs: readTs(LS.MENTOR_NUDGE),
      lastInboundTs: readTs(LS.MENTOR_ENGAGEMENT),
      outboundStatus: statusOf(readTs(LS.MENTOR_NUDGE)),
      inboundStatus: readTs(LS.MENTOR_ENGAGEMENT) ? 'live' : 'silent',
    },
    {
      agentId: 'oracle',
      outboundKey: LS.ORACLE_EVENT,
      inboundKey: LS.ORACLE_MASTERY_UPDATE,
      lastOutboundTs: readTs(LS.ORACLE_EVENT),
      lastInboundTs: readTs(LS.ORACLE_MASTERY_UPDATE),
      outboundStatus: statusOf(readTs(LS.ORACLE_EVENT)),
      inboundStatus: readTs(LS.ORACLE_MASTERY_UPDATE) ? 'live' : 'silent',
    },
    {
      agentId: 'scout',
      outboundKey: LS.SCOUT_PRIORITY,
      inboundKey: undefined,
      lastOutboundTs: readTs(LS.SCOUT_PRIORITY),
      lastInboundTs: undefined,
      outboundStatus: statusOf(readTs(LS.SCOUT_PRIORITY)),
      inboundStatus: 'unknown',
    },
    {
      agentId: 'herald',
      outboundKey: 'orchestrator:herald_campaign',
      inboundKey: undefined,
      lastOutboundTs: readTs('orchestrator:herald_campaign'),
      lastInboundTs: undefined,
      outboundStatus: statusOf(readTs('orchestrator:herald_campaign')),
      inboundStatus: 'unknown',
    },
  ];
}
