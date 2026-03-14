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

// Extended LearnerProfile additions (non-breaking)
export interface LearnerProfileExtended extends LearnerProfile {
  // Gamification snapshot
  xp?: number;
  level?: number;
  // Mood signal
  currentMood?: string;
  // Readiness score
  readinessScore?: number;
  // Student persona tier
  personaTier?: string;
  // Emotional state from studentPersonaEngine
  emotionalState?: string;
}

// New fields on OrchestratorDecision (non-breaking — optional)
// Stored via declaration merging below.

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

  // ── Extended fields (bidirectional wiring v2) ──────────────────────────────

  /** SubTopic Bible context injected for the chosen topic */
  bibleContext?: {
    subTopics: string[];
    commonMistakes: string[];
    prerequisites: string[];
    examWeight: number;
  };

  /** Layered content metadata (mandatory + personalized layer summary) */
  layeredContentMeta?: {
    mandatoryCompleteness: number;
    personalizationDepth: string;
    tier: string;
  };

  /** ContentPersonaEngine context for Sage/Atlas prompt injection */
  personaContext?: {
    learningStyle: string;
    objective: string;
    cognitiveTier: string;
    cognitiveLoad: string;
    daysToExam: number;
  };

  /** Gamification snapshot at time of decision */
  gamificationSnapshot?: {
    xp: number;
    level: number;
    streak: number;
    rank: string;
  };

  /** Current readiness score at time of decision */
  readinessScore?: number;

  /** Current mood at time of decision */
  currentMood?: string;

  /** Suggested template from TemplateRegistry */
  suggestedTemplate?: {
    key: string;
    id: string;
  } | null;

  /** Feature flags state snapshot (which services were active) */
  featureFlagsSnapshot?: {
    gamificationEnabled: boolean;
    spacedRepetitionEnabled: boolean;
    readinessScoreEnabled: boolean;
    moodCheckInEnabled: boolean;
  };

  /** ID of the UserPlaybook that was active during this session (if any) */
  userPlaybookId?: string;
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
  HERALD_CAMPAIGN:       'orchestrator:herald_campaign',
  SUBTOPIC_BIBLE_UPDATE: 'orchestrator:bible_update',
  GAMIFICATION_SESSION:  'orchestrator:gamification_session',
  SR_LESSON_COMPLETE:    'orchestrator:sr_lesson_complete',

  // Inbound signals (FROM agents)
  SAGE_OUTCOME:          'sage:session_outcome',
  ATLAS_READY:           'atlas:content_ready',

  // Feature flag keys (from appStore persisted state)
  APP_STORE_KEY:         'edugenius-storage',
} as const;

// ─── Feature flags reader (reads from appStore persisted localStorage) ────────

interface AppFeatureFlags {
  gamificationEnabled: boolean;
  spacedRepetitionEnabled: boolean;
  readinessScoreEnabled: boolean;
  moodCheckInEnabled: boolean;
}

function readFeatureFlags(): AppFeatureFlags {
  const defaults: AppFeatureFlags = {
    gamificationEnabled: true,
    spacedRepetitionEnabled: true,
    readinessScoreEnabled: true,
    moodCheckInEnabled: true,
  };
  try {
    const raw = localStorage.getItem(LS.APP_STORE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as { state?: Partial<AppFeatureFlags> };
    const state = parsed.state ?? {};
    return {
      gamificationEnabled:    state.gamificationEnabled    ?? defaults.gamificationEnabled,
      spacedRepetitionEnabled: state.spacedRepetitionEnabled ?? defaults.spacedRepetitionEnabled,
      readinessScoreEnabled:  state.readinessScoreEnabled  ?? defaults.readinessScoreEnabled,
      moodCheckInEnabled:     state.moodCheckInEnabled     ?? defaults.moodCheckInEnabled,
    };
  } catch { return defaults; }
}

// ─── Extended profile cache (populated by buildLearnerProfile, read by orchestrateSession) ──

interface _ExtendedProfileCache {
  gamificationXP: number;
  gamificationLevel: number;
  readinessScore: number | undefined;
  currentMood: string | undefined;
  personaEmotionalState: string;
  personaTier: string;
  flags: AppFeatureFlags;
}

// Module-level cache — last build result
let _lastExtendedCache: _ExtendedProfileCache | null = null;

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

  // 4b. StudentPersonaEngine — read live persona for emotional state + tier
  // Uses the same localStorage key as loadPersona() — safe direct read
  let personaEmotionalState: string = 'neutral';
  let personaTier: string = 'average';
  let personaLearningStyle: string | undefined;
  let personaDaysToExam: number | undefined;
  try {
    const personaRaw = localStorage.getItem('edugenius_student_persona');
    if (personaRaw) {
      const personaParsed = JSON.parse(personaRaw) as {
        emotionalState?: string;
        tier?: string;
        learningStyle?: string;
        daysToExam?: number;
      };
      personaEmotionalState = personaParsed.emotionalState ?? 'neutral';
      personaTier = personaParsed.tier ?? 'average';
      personaLearningStyle = personaParsed.learningStyle;
      if (typeof personaParsed.daysToExam === 'number' && personaParsed.daysToExam > 0) {
        personaDaysToExam = personaParsed.daysToExam;
      }
    }
  } catch { /* ignore */ }

  // 5. Spaced rep due topics — localStorage read (sync, safe)
  const flags = readFeatureFlags();
  let nextReviewTopics: string[] = [];
  if (flags.spacedRepetitionEnabled) {
    try {
      const raw = localStorage.getItem(LS.SPACED_REP_QUEUE);
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{ topicId?: string } | string>;
        nextReviewTopics = parsed.map(p => (typeof p === 'string' ? p : p.topicId ?? '')).filter(Boolean);
      }
    } catch { /* ignore */ }

    // Also read from spacedRepetitionEngine's own key (eg_sr_cards_v2)
    try {
      const srRaw = localStorage.getItem('eg_sr_cards_v2');
      if (srRaw) {
        const srCards = JSON.parse(srRaw) as Array<{ topic?: string; nextReview?: number }>;
        const now = Date.now();
        const dueTopics = srCards
          .filter(c => (c.nextReview ?? 0) <= now)
          .map(c => (c.topic ?? '').replace(/\s+/g, '_').toLowerCase())
          .filter(Boolean);
        nextReviewTopics = [...new Set([...nextReviewTopics, ...dueTopics])];
      }
    } catch { /* ignore */ }
  }

  // 6. Cognitive load — primary: MoodCheckIn (eg_mood_today key); fallback: mentor engagement signal
  let cognitiveLoad: 'low' | 'medium' | 'high' = 'medium';
  let currentMood: string | undefined;

  if (flags.moodCheckInEnabled) {
    try {
      const moodRaw = localStorage.getItem('eg_mood_today');
      if (moodRaw) {
        const moodEntry = JSON.parse(moodRaw) as { mood?: string; timestamp?: number };
        // Expire after 8 hours
        if (moodEntry.mood && Date.now() - (moodEntry.timestamp ?? 0) < 28800000) {
          currentMood = moodEntry.mood;
          if (moodEntry.mood === 'tired' || moodEntry.mood === 'frustrated') cognitiveLoad = 'high';
          else if (moodEntry.mood === 'energised' || moodEntry.mood === 'focused') cognitiveLoad = 'low';
          else cognitiveLoad = 'medium';
        }
      }
    } catch { /* ignore */ }
  }

  // Supplement with mentor engagement signal (does not override mood)
  if (!currentMood) {
    try {
      const raw = localStorage.getItem(LS.MENTOR_ENGAGEMENT);
      if (raw) {
        const signal = JSON.parse(raw) as { fatigue?: string; load?: string };
        if (signal.fatigue === 'high' || signal.load === 'high') cognitiveLoad = 'high';
        else if (signal.fatigue === 'low' || signal.load === 'low') cognitiveLoad = 'low';
      }
    } catch { /* ignore */ }
  }

  // 6b. Gamification — read XP/level from gamification profile key
  let gamificationXP = 0;
  let gamificationLevel = 1;
  if (flags.gamificationEnabled) {
    try {
      const gRaw = localStorage.getItem('eg_gamification_profile');
      if (gRaw) {
        const gProfile = JSON.parse(gRaw) as { xp?: number; level?: number };
        gamificationXP = gProfile.xp ?? 0;
        gamificationLevel = gProfile.level ?? 1;
      }
    } catch { /* ignore */ }
  }

  // 6c. Readiness score (read cached value)
  let readinessScore: number | undefined;
  if (flags.readinessScoreEnabled) {
    try {
      const yesterday = localStorage.getItem('eg_readiness_yesterday');
      if (yesterday) readinessScore = parseInt(yesterday, 10) || undefined;
    } catch { /* ignore */ }
  }

  // Store extended data in module-level cache for orchestrateSession to consume
  _lastExtendedCache = {
    gamificationXP,
    gamificationLevel,
    readinessScore,
    currentMood,
    personaEmotionalState,
    personaTier,
    flags,
  };

  // Days to exam — prefer live persona over stored persona
  const daysToExam = personaDaysToExam ?? ((persona.daysToExam as number) ?? 90);
  const examPhase = inferExamPhase(daysToExam);

  // Learning style — prefer studentPersonaEngine, fall back to stored persona
  const rawStyleFromPersona = personaLearningStyle ?? (persona.learningStyle as string) ?? 'mixed';
  // Map studentPersonaEngine hyphenated/different styles to orchestrator enum
  const mappedStyle =
    rawStyleFromPersona === 'practice-first' ? 'practice_first' :
    rawStyleFromPersona === 'story-driven'   ? 'conceptual'     :
    rawStyleFromPersona === 'analytical'     ? 'conceptual'     :
    rawStyleFromPersona === 'auditory'       ? 'mixed'          :
    rawStyleFromPersona;
  const learningStyle: LearnerProfile['learningStyle'] =
    ['visual', 'conceptual', 'practice_first', 'mixed'].includes(mappedStyle)
      ? (mappedStyle as LearnerProfile['learningStyle'])
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
 * Respects feature flags so disabled features are never signalled.
 */
export function emitOrchestratorSignals(decision: OrchestratorDecision): void {
  const { objective, contentDecision, learnerProfile } = decision;
  const flags = decision.featureFlagsSnapshot ?? readFeatureFlags();

  // → Sage: inject prompt directive (includes bible + persona context)
  if (contentDecision.agentId === 'sage') {
    localStorage.setItem(LS.SAGE_DIRECTIVE, JSON.stringify({
      objective: objective.type,
      topicFocus: objective.topicName,
      difficulty: objective.difficulty,
      promptAdd: contentDecision.promptDirectives.join('\n'),
      bibleContext: decision.bibleContext ?? null,
      personaContext: decision.personaContext ?? null,
      sessionId: decision.sessionId,
      timestamp: decision.timestamp,
    }));
  }

  // → Atlas: content generation request (includes bible + layered content meta)
  if (contentDecision.agentId === 'atlas') {
    localStorage.setItem(LS.ATLAS_TASK, JSON.stringify({
      examId: learnerProfile.examId,
      topicId: objective.topicId,
      topicName: objective.topicName,
      format: contentDecision.format,
      mode: contentDecision.mode,
      difficulty: objective.difficulty,
      bibleContext: decision.bibleContext ?? null,
      layeredContentMeta: decision.layeredContentMeta ?? null,
      suggestedTemplate: decision.suggestedTemplate ?? null,
      sessionId: decision.sessionId,
      timestamp: decision.timestamp,
    }));
  }

  // → Mentor: engagement signal (includes mood + emotional state)
  localStorage.setItem(LS.MENTOR_NUDGE, JSON.stringify({
    userId: learnerProfile.userId,
    streakDays: learnerProfile.streakDays,
    phase: learnerProfile.examPhase,
    cognitiveLoad: learnerProfile.cognitiveLoad,
    currentMood: decision.currentMood ?? null,
    objective: objective.type,
    sessionId: decision.sessionId,
    timestamp: decision.timestamp,
  }));

  // → Oracle: analytics event (includes readiness + gamification)
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
    readinessScore: decision.readinessScore ?? null,
    gamificationSnapshot: decision.gamificationSnapshot ?? null,
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

  // → Herald: campaign hint (only emitted in sprint/exam_week phases)
  const { examPhase, daysToExam } = learnerProfile;
  if (examPhase === 'sprint' || examPhase === 'exam_week') {
    const urgencyScore = Math.min(1, Math.max(0, 1 - daysToExam / 21));
    const suggestedCampaignType =
      daysToExam <= 3  ? 'last_chance_urgency' :
      daysToExam <= 7  ? 'exam_week_checklist'  :
      'sprint_revision';
    localStorage.setItem(LS.HERALD_CAMPAIGN, JSON.stringify({
      topicId: objective.topicId,
      phase: examPhase,
      urgencyScore,
      suggestedCampaignType,
      examId: learnerProfile.examId,
      daysToExam,
      sessionId: decision.sessionId,
      timestamp: decision.timestamp,
    }));
  }

  // → SubTopic Bible: update orchestration data for this topic
  try {
    const { updateBibleOrchestrationData } = require('./subTopicBibleService') as typeof import('./subTopicBibleService');
    updateBibleOrchestrationData(learnerProfile.examId, objective.topicId, {
      lastOrchestrationSessionId: decision.sessionId,
      lastOrchestrationTs: decision.timestamp,
      lastObjectiveType: objective.type,
      lastPhase: examPhase,
    });
  } catch { /* ignore — non-fatal */ }

  // → Gamification signal bus (only if feature enabled)
  if (flags.gamificationEnabled) {
    localStorage.setItem(LS.GAMIFICATION_SESSION, JSON.stringify({
      event: 'orchestrator_session_started',
      userId: learnerProfile.userId,
      examId: learnerProfile.examId,
      objectiveType: objective.type,
      sessionId: decision.sessionId,
      timestamp: decision.timestamp,
    }));
  }

  // → SpacedRepetition: emit bible update key (lesson started — not completed yet)
  if (flags.spacedRepetitionEnabled) {
    localStorage.setItem(LS.SR_LESSON_COMPLETE, JSON.stringify({
      event: 'lesson_started',
      topicId: objective.topicId,
      examId: learnerProfile.examId,
      userId: learnerProfile.userId,
      sessionId: decision.sessionId,
      timestamp: decision.timestamp,
    }));
  }
}

// ─── orchestrateSession ───────────────────────────────────────────────────────

/**
 * PRIMARY ENTRY POINT.
 * Runs the full orchestration pipeline for a user session.
 * Bidirectionally wired to ALL agents, services, and feature flags.
 */
export async function orchestrateSession(
  userId: string,
  examId: string,
  channel?: DeliveryChannel
): Promise<OrchestratorDecision> {
  const sessionId = `orch-${userId}-${Date.now()}`;

  // ── 1. Build learner profile (sync — reads from localStorage) ────────────
  const learnerProfile = buildLearnerProfile(userId, examId);
  if (channel) learnerProfile.preferredChannel = channel;

  // Grab the extended cache populated by buildLearnerProfile
  const extCache = _lastExtendedCache;
  const flags = extCache?.flags ?? readFeatureFlags();

  // ── 1b. UserPlaybook — load per-user playbook and restrict topicMastery ──
  let _activeUserPlaybookId: string | undefined;
  try {
    const upsModule = await import('./userPlaybookService');
    const userPlaybook = upsModule.loadUserPlaybook(userId, examId);
    if (userPlaybook) {
      _activeUserPlaybookId = userPlaybook.id;

      if (userPlaybook.scope.scopeType === 'partial') {
        // Restrict topicMastery to only the active topics in this user's scope
        const allTopicIds = learnerProfile.topicMastery.map(t => t.topicId);
        const activeIds = new Set(upsModule.getActiveTopicIds(userPlaybook, allTopicIds));
        learnerProfile.topicMastery = learnerProfile.topicMastery.filter(
          t => activeIds.has(t.topicId),
        );
        // Recompute weakest/strongest from filtered mastery
        const filteredSorted = [...learnerProfile.topicMastery].sort(
          (a, b) => a.masteryScore - b.masteryScore,
        );
        const quintile = Math.max(1, Math.ceil(filteredSorted.length * 0.2));
        learnerProfile.weakestTopics = filteredSorted.slice(0, quintile).map(t => t.topicId);
        learnerProfile.strongestTopics = filteredSorted.slice(-quintile).map(t => t.topicId);
      }
    }
  } catch { /* ignore — non-fatal, playbook layer is supplementary */ }

  // ── 2. SubTopic Bible — inject bible context for chosen topic ────────────
  let bibleContext: OrchestratorDecision['bibleContext'];
  try {
    const bibleModule = await import('./subTopicBibleService');
    const entry = bibleModule.getBibleEntry(examId, '_placeholder_'); // will be replaced after objective selection
    void entry; // resolved after objective is selected below
  } catch { /* ignore */ }

  // ── 3. Select learning objective ──────────────────────────────────────────
  const objective = selectLearningObjective(learnerProfile);

  // ── 3b. Now load bible context for the selected topic ─────────────────────
  try {
    const bibleModule = await import('./subTopicBibleService');
    const entry = bibleModule.getBibleEntry(examId, objective.topicId);
    if (entry) {
      bibleContext = {
        subTopics: entry.subTopics,
        commonMistakes: entry.commonMistakes,
        prerequisites: entry.prerequisites,
        examWeight: entry.examWeight,
      };
      // Inject bible common mistakes into prompt directives
      if (entry.commonMistakes.length > 0) {
        // Will be merged into contentDecision.promptDirectives after decideContent
      }
    }
  } catch { /* ignore */ }

  // ── 4. Decide content ─────────────────────────────────────────────────────
  const contentDecision = decideContent(learnerProfile, objective);

  // Inject bible mistakes into prompt directives
  if (bibleContext?.commonMistakes.length) {
    contentDecision.promptDirectives.push(
      `avoid_mistakes: ${bibleContext.commonMistakes.slice(0, 3).join('; ')}`
    );
  }

  // ── 5. ContentPersonaEngine — build persona context ───────────────────────
  let personaContext: OrchestratorDecision['personaContext'];
  try {
    const cpeModule = await import('./contentPersonaEngine');
    // Map orchestrator learning style to contentPersonaEngine format
    const cpeStyle =
      learnerProfile.learningStyle === 'practice_first' ? 'practice_first' :
      learnerProfile.learningStyle === 'conceptual'     ? 'analytical'     :
      (learnerProfile.learningStyle as import('./contentPersonaEngine').LearningStyle);

    const cpeObjective: import('./contentPersonaEngine').LearningObjective =
      learnerProfile.daysToExam <= 7  ? 'quick_revision'  :
      learnerProfile.daysToExam <= 30 ? 'exam_readiness'  :
      objective.type === 'fix_misconception' ? 'doubt_clearing' :
      'conceptual_understanding';

    const cpeTier: import('./contentPersonaEngine').CognitiveTier =
      extCache?.personaTier === 'advanced'  ? 'advanced'   :
      extCache?.personaTier === 'good'      ? 'proficient' :
      extCache?.personaTier === 'struggling'? 'foundational' :
      'developing';

    const cogLoad: import('./contentPersonaEngine').PersonaContext['cognitiveLoad'] =
      learnerProfile.cognitiveLoad === 'high' ? 'high' :
      learnerProfile.cognitiveLoad === 'low'  ? 'low'  :
      'medium';

    personaContext = {
      learningStyle:  cpeStyle,
      objective:      cpeObjective,
      cognitiveTier:  cpeTier,
      cognitiveLoad:  cogLoad,
      daysToExam:     learnerProfile.daysToExam,
    };

    // Inject persona directives into content promptDirectives
    const styleDirective = cpeModule.buildLearningStyleDirective(cpeStyle, contentDecision.channel === 'in_app_chat' ? 'web' : contentDecision.channel as string);
    if (styleDirective) {
      contentDecision.promptDirectives.push(`persona_style: ${cpeStyle}`);
    }
  } catch { /* ignore — non-fatal */ }

  // ── 6. ContentLayerService — get layered content metadata ─────────────────
  let layeredContentMeta: OrchestratorDecision['layeredContentMeta'];
  try {
    const clsModule = await import('./contentLayerService');
    const cpeModule2 = await import('./contentPersonaEngine');

    // Build a minimal PersonaContext for getLayeredContent
    const minPersonaCtx: import('./contentPersonaEngine').PersonaContext = {
      learningStyle: (personaContext?.learningStyle as import('./contentPersonaEngine').LearningStyle) ?? 'unknown',
      objective: (personaContext?.objective as import('./contentPersonaEngine').LearningObjective) ?? 'conceptual_understanding',
      cognitiveTier: (personaContext?.cognitiveTier as import('./contentPersonaEngine').CognitiveTier) ?? 'developing',
      cognitiveLoad: (personaContext?.cognitiveLoad as import('./contentPersonaEngine').PersonaContext['cognitiveLoad']) ?? 'medium',
      streakDays: learnerProfile.streakDays,
      daysToExam: learnerProfile.daysToExam,
      studyTimePattern: 'afternoon',
      examId,
      examName: examId,
      topic: objective.topicId,
      topicWeight: bibleContext?.examWeight ?? 0.5,
      topicMasteryPct: Math.round((learnerProfile.topicMastery.find(t => t.topicId === objective.topicId)?.masteryScore ?? 0) * 100),
      format: 'lesson_notes',
      difficulty: objective.difficulty,
      channel: 'web',
    };

    void cpeModule2; // used above for PersonaContext type
    const surfaceId = 'web' as import('./contentTierService').DeliverySurface;

    // Non-blocking: call with a timeout-style try
    const layered = await clsModule.getLayeredContent(examId, objective.topicId, minPersonaCtx, surfaceId);
    layeredContentMeta = {
      mandatoryCompleteness: layered.mandatoryCompleteness,
      personalizationDepth:  layered.personalizationDepth,
      tier:                  layered.generationTrace.tier,
    };
  } catch { /* ignore — non-fatal, layered content is supplementary */ }

  // ── 7. TemplateRegistry — suggest best template ────────────────────────────
  let suggestedTemplate: OrchestratorDecision['suggestedTemplate'] = null;
  try {
    const { resolveTemplate } = await import('./templateRegistry');
    const styleForTemplate = personaContext?.learningStyle ?? learnerProfile.learningStyle;
    const objForTemplate =
      objective.type === 'fix_misconception' ? 'doubt_clearing' :
      objective.type === 'assess_readiness'  ? 'exam_readiness' :
      objective.type === 'revision'          ? 'quick_revision' :
      objective.type === 'build_speed'       ? 'exam_readiness' :
      'conceptual_understanding';

    const match = resolveTemplate(examId, objective.topicName, styleForTemplate, objForTemplate);
    if (match) {
      suggestedTemplate = { key: match.key, id: match.override.id };
    }
  } catch { /* ignore */ }

  // ── 8. Gamification snapshot ───────────────────────────────────────────────
  let gamificationSnapshot: OrchestratorDecision['gamificationSnapshot'];
  if (flags.gamificationEnabled) {
    try {
      const gRaw = localStorage.getItem('eg_gamification_profile');
      if (gRaw) {
        const gProfile = JSON.parse(gRaw) as { xp?: number; level?: number; streak?: number; rank?: string };
        gamificationSnapshot = {
          xp:     gProfile.xp     ?? 0,
          level:  gProfile.level  ?? 1,
          streak: gProfile.streak ?? 0,
          rank:   gProfile.rank   ?? 'Novice',
        };
      }
    } catch { /* ignore */ }
  }

  // ── 9. Build adaptation hints ─────────────────────────────────────────────
  const adaptationHints = buildAdaptationHints(learnerProfile, objective);

  // ── 10. Assemble decision (all fields) ────────────────────────────────────
  let decision: OrchestratorDecision = {
    sessionId,
    userId,
    timestamp: Date.now(),
    learnerProfile,
    objective,
    contentDecision,
    adaptationHints,
    signals: {},

    // ── New bidirectional fields ────────────────────────────────────────────
    bibleContext,
    layeredContentMeta,
    personaContext,
    gamificationSnapshot,
    readinessScore:  extCache?.readinessScore,
    currentMood:     extCache?.currentMood,
    suggestedTemplate,
    featureFlagsSnapshot: {
      gamificationEnabled:     flags.gamificationEnabled,
      spacedRepetitionEnabled: flags.spacedRepetitionEnabled,
      readinessScoreEnabled:   flags.readinessScoreEnabled,
      moodCheckInEnabled:      flags.moodCheckInEnabled,
    },
  };

  // Attach userPlaybookId to decision
  if (_activeUserPlaybookId) {
    decision.userPlaybookId = _activeUserPlaybookId;
  }

  // ── 10b. UserPlaybook — record session + persist ───────────────────────────
  if (_activeUserPlaybookId) {
    try {
      const upsModule = await import('./userPlaybookService');
      const userPlaybook = upsModule.loadUserPlaybook(userId, examId);
      if (userPlaybook) {
        // Record session with a small mastery delta (0.05 per session as a baseline)
        const updated = upsModule.recordPlaybookSession(userPlaybook, objective.topicId, 0.05);
        upsModule.saveUserPlaybook(updated);
        // Archive if this is a milestone (every 10 sessions on topic)
        const progress = updated.topicProgress[objective.topicId];
        if (progress && progress.sessionsCompleted % 10 === 0) {
          upsModule.archivePlaybookSnapshot(updated, 'session_end').catch(() => { /* best-effort */ });
        }
      }
    } catch { /* ignore — non-fatal */ }
  }

  // ── 11. Apply role overrides ───────────────────────────────────────────────
  decision = applyRoleOverrides(decision, learnerProfile.role);

  // ── 12. Emit signals to all connected services ────────────────────────────
  emitOrchestratorSignals(decision);

  // ── 13. Emit signalBus event (gamification XP trigger) ───────────────────
  if (flags.gamificationEnabled) {
    try {
      const { enqueueSignal } = await import('./persistenceDB');
      await enqueueSignal({
        type: 'XP_MILESTONE',
        sourceAgent: 'orchestrator' as Parameters<typeof enqueueSignal>[0]['sourceAgent'],
        targetAgent: 'mentor',
        payload: {
          event: 'orchestrator_session_started',
          userId,
          examId,
          objectiveType: objective.type,
          sessionId,
        },
        studentId: userId,
      });
    } catch { /* ignore — signalBus is best-effort */ }
  }

  // ── 14. Update module-level cache for signal status tracking ─────────────
  _lastExamIdCache = examId;

  // Emit lightweight status signals for the connections tab
  try {
    localStorage.setItem('orchestrator:content_layer_request', JSON.stringify({ timestamp: decision.timestamp, examId, topicId: objective.topicId }));
    localStorage.setItem('orchestrator:persona_context', JSON.stringify({ timestamp: decision.timestamp, ...(personaContext ?? {}) }));
    if (suggestedTemplate) {
      localStorage.setItem('orchestrator:template_match', JSON.stringify({ timestamp: decision.timestamp, ...suggestedTemplate }));
    }
    if (flags.readinessScoreEnabled) {
      localStorage.setItem('orchestrator:readiness_invalidate', JSON.stringify({ timestamp: decision.timestamp }));
    }
    if (flags.moodCheckInEnabled) {
      localStorage.setItem('orchestrator:mood_read', JSON.stringify({ timestamp: decision.timestamp, mood: extCache?.currentMood ?? null }));
    }
  } catch { /* ignore */ }

  // ── 16. Sync state ────────────────────────────────────────────────────────
  syncOrchestratorState(decision);

  // ── 17. Save to history ───────────────────────────────────────────────────
  _appendToHistory(userId, decision);

  return decision;
}

// ─── recordOutcome ────────────────────────────────────────────────────────────

/**
 * Feedback loop — record outcome of last orchestrator decision.
 * Also notifies SpacedRepetition and ReadinessScore services.
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

  const flags = readFeatureFlags();

  // Emit lesson-complete signal to SpacedRepetition service
  if (flags.spacedRepetitionEnabled && outcome.completed) {
    try {
      localStorage.setItem(LS.SR_LESSON_COMPLETE, JSON.stringify({
        event: 'lesson_completed',
        sessionId,
        completed: outcome.completed,
        correctAnswers: outcome.correctAnswers ?? 0,
        totalAnswers: outcome.totalAnswers ?? 0,
        timestamp: Date.now(),
      }));
    } catch { /* ignore */ }
  }

  // Trigger readiness score recalculation (invalidate cache)
  if (flags.readinessScoreEnabled && outcome.completed) {
    try {
      // Remove yesterday's cached score so it gets recomputed on next read
      localStorage.removeItem('eg_readiness_yesterday');
    } catch { /* ignore */ }
  }

  // Award gamification XP for completed session (fire-and-forget via localStorage)
  if (flags.gamificationEnabled && outcome.completed) {
    try {
      const correctRatio = outcome.totalAnswers
        ? (outcome.correctAnswers ?? 0) / outcome.totalAnswers
        : 0.5;
      const xpEvent = correctRatio >= 0.8 ? 'topic_complete' : 'daily_goal';
      localStorage.setItem('orchestrator:gamification_xp', JSON.stringify({
        event: xpEvent,
        sessionId,
        correctRatio,
        timestamp: Date.now(),
      }));
    } catch { /* ignore */ }
  }
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
  label?: string;           // display name (optional, defaults to agentId)
  outboundKey: string;
  inboundKey?: string;
  lastOutboundTs?: number;
  lastInboundTs?: number;
  outboundStatus: 'live' | 'silent' | 'error' | 'disabled';
  inboundStatus: 'live' | 'silent' | 'unknown' | 'disabled';
  isFeatureFlag?: boolean;  // true if this row represents a feature flag gate
  featureEnabled?: boolean; // whether the feature flag is on
}

export function getAgentSignalStatuses(): AgentSignalStatus[] {
  const now = Date.now();
  const MAX_AGE = 3600000; // 1 hour
  const flags = readFeatureFlags();

  const readTs = (key: string): number | undefined => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as { timestamp?: number; ts?: number; updatedAt?: number };
      return parsed.timestamp ?? parsed.ts ?? parsed.updatedAt ?? now - 500;
    } catch { return undefined; }
  };

  const statusOf = (ts: number | undefined, featureEnabled = true): 'live' | 'silent' | 'error' | 'disabled' => {
    if (!featureEnabled) return 'disabled';
    if (!ts) return 'silent';
    return (now - ts) < MAX_AGE ? 'live' : 'silent';
  };

  const inStatusOf = (ts: number | undefined, featureEnabled = true): 'live' | 'silent' | 'unknown' | 'disabled' => {
    if (!featureEnabled) return 'disabled';
    if (ts === undefined) return 'unknown';
    return (now - ts) < MAX_AGE ? 'live' : 'silent';
  };

  return [
    // ── Core Agents ──────────────────────────────────────────────────────────
    {
      agentId: 'sage',
      label: '🎓 Sage (Tutor)',
      outboundKey: LS.SAGE_DIRECTIVE,
      inboundKey: LS.SAGE_OUTCOME,
      lastOutboundTs: readTs(LS.SAGE_DIRECTIVE),
      lastInboundTs: readTs(LS.SAGE_OUTCOME),
      outboundStatus: statusOf(readTs(LS.SAGE_DIRECTIVE)),
      inboundStatus: inStatusOf(readTs(LS.SAGE_OUTCOME)),
    },
    {
      agentId: 'atlas',
      label: '📚 Atlas (Content)',
      outboundKey: LS.ATLAS_TASK,
      inboundKey: LS.ATLAS_READY,
      lastOutboundTs: readTs(LS.ATLAS_TASK),
      lastInboundTs: readTs(LS.ATLAS_READY),
      outboundStatus: statusOf(readTs(LS.ATLAS_TASK)),
      inboundStatus: inStatusOf(readTs(LS.ATLAS_READY)),
    },
    {
      agentId: 'mentor',
      label: '👨🏫 Mentor (Engagement)',
      outboundKey: LS.MENTOR_NUDGE,
      inboundKey: LS.MENTOR_ENGAGEMENT,
      lastOutboundTs: readTs(LS.MENTOR_NUDGE),
      lastInboundTs: readTs(LS.MENTOR_ENGAGEMENT),
      outboundStatus: statusOf(readTs(LS.MENTOR_NUDGE)),
      inboundStatus: inStatusOf(readTs(LS.MENTOR_ENGAGEMENT)),
    },
    {
      agentId: 'oracle',
      label: '📊 Oracle (Analytics)',
      outboundKey: LS.ORACLE_EVENT,
      inboundKey: LS.ORACLE_MASTERY_UPDATE,
      lastOutboundTs: readTs(LS.ORACLE_EVENT),
      lastInboundTs: readTs(LS.ORACLE_MASTERY_UPDATE),
      outboundStatus: statusOf(readTs(LS.ORACLE_EVENT)),
      inboundStatus: inStatusOf(readTs(LS.ORACLE_MASTERY_UPDATE)),
    },
    {
      agentId: 'scout',
      label: '🔍 Scout (Intelligence)',
      outboundKey: LS.SCOUT_PRIORITY,
      inboundKey: undefined,
      lastOutboundTs: readTs(LS.SCOUT_PRIORITY),
      lastInboundTs: undefined,
      outboundStatus: statusOf(readTs(LS.SCOUT_PRIORITY)),
      inboundStatus: 'unknown',
    },
    // ── Feature Connections ───────────────────────────────────────────────────
    {
      agentId: 'herald',
      label: '📢 Herald (Campaigns)',
      outboundKey: LS.HERALD_CAMPAIGN,
      inboundKey: undefined,
      lastOutboundTs: readTs(LS.HERALD_CAMPAIGN),
      lastInboundTs: undefined,
      outboundStatus: statusOf(readTs(LS.HERALD_CAMPAIGN)),
      inboundStatus: 'unknown',
    },
    {
      agentId: 'subtopic_bible',
      label: '📖 SubTopic Bible',
      outboundKey: LS.SUBTOPIC_BIBLE_UPDATE,
      inboundKey: `${BIBLE_LS_PREFIX_FOR_STATUS}${_lastExamIdCache}`,
      lastOutboundTs: readTs(LS.SUBTOPIC_BIBLE_UPDATE),
      lastInboundTs: _lastExamIdCache ? readTs(`${BIBLE_LS_PREFIX_FOR_STATUS}${_lastExamIdCache}`) : undefined,
      outboundStatus: statusOf(readTs(LS.SUBTOPIC_BIBLE_UPDATE)),
      inboundStatus: inStatusOf(_lastExamIdCache ? readTs(`${BIBLE_LS_PREFIX_FOR_STATUS}${_lastExamIdCache}`) : undefined),
    },
    {
      agentId: 'content_layer',
      label: '🧱 ContentLayer',
      outboundKey: 'orchestrator:content_layer_request',
      inboundKey: undefined,
      lastOutboundTs: readTs('orchestrator:content_layer_request'),
      lastInboundTs: undefined,
      outboundStatus: statusOf(readTs('orchestrator:content_layer_request')),
      inboundStatus: 'unknown',
    },
    {
      agentId: 'persona_engine',
      label: '🎭 ContentPersonaEngine',
      outboundKey: 'orchestrator:persona_context',
      inboundKey: 'edugenius_student_persona',
      lastOutboundTs: readTs('orchestrator:persona_context'),
      lastInboundTs: readTs('edugenius_student_persona'),
      outboundStatus: statusOf(readTs('orchestrator:persona_context')),
      inboundStatus: inStatusOf(readTs('edugenius_student_persona')),
    },
    {
      agentId: 'gamification',
      label: '🎮 Gamification',
      outboundKey: LS.GAMIFICATION_SESSION,
      inboundKey: 'eg_gamification_profile',
      lastOutboundTs: readTs(LS.GAMIFICATION_SESSION),
      lastInboundTs: readTs('eg_gamification_profile'),
      outboundStatus: statusOf(readTs(LS.GAMIFICATION_SESSION), flags.gamificationEnabled),
      inboundStatus: inStatusOf(readTs('eg_gamification_profile'), flags.gamificationEnabled),
      isFeatureFlag: true,
      featureEnabled: flags.gamificationEnabled,
    },
    {
      agentId: 'spaced_rep',
      label: '🔁 SpacedRepetition',
      outboundKey: LS.SR_LESSON_COMPLETE,
      inboundKey: 'eg_sr_cards_v2',
      lastOutboundTs: readTs(LS.SR_LESSON_COMPLETE),
      lastInboundTs: readTs('eg_sr_cards_v2'),
      outboundStatus: statusOf(readTs(LS.SR_LESSON_COMPLETE), flags.spacedRepetitionEnabled),
      inboundStatus: inStatusOf(readTs('eg_sr_cards_v2'), flags.spacedRepetitionEnabled),
      isFeatureFlag: true,
      featureEnabled: flags.spacedRepetitionEnabled,
    },
    {
      agentId: 'readiness',
      label: '📈 ReadinessScore',
      outboundKey: 'orchestrator:readiness_invalidate',
      inboundKey: 'eg_readiness_yesterday',
      lastOutboundTs: readTs('orchestrator:readiness_invalidate'),
      lastInboundTs: readTs('eg_readiness_yesterday'),
      outboundStatus: statusOf(readTs('orchestrator:readiness_invalidate'), flags.readinessScoreEnabled),
      inboundStatus: inStatusOf(readTs('eg_readiness_yesterday'), flags.readinessScoreEnabled),
      isFeatureFlag: true,
      featureEnabled: flags.readinessScoreEnabled,
    },
    {
      agentId: 'mood',
      label: '😊 MoodCheckIn',
      outboundKey: 'orchestrator:mood_read',
      inboundKey: 'eg_mood_today',
      lastOutboundTs: readTs('orchestrator:mood_read'),
      lastInboundTs: readTs('eg_mood_today'),
      outboundStatus: statusOf(readTs('orchestrator:mood_read'), flags.moodCheckInEnabled),
      inboundStatus: inStatusOf(readTs('eg_mood_today'), flags.moodCheckInEnabled),
      isFeatureFlag: true,
      featureEnabled: flags.moodCheckInEnabled,
    },
    {
      agentId: 'template_registry',
      label: '🗂️ TemplateRegistry',
      outboundKey: 'orchestrator:template_match',
      inboundKey: undefined,
      lastOutboundTs: readTs('orchestrator:template_match'),
      lastInboundTs: undefined,
      outboundStatus: statusOf(readTs('orchestrator:template_match')),
      inboundStatus: 'unknown',
    },
  ];
}

// ─── Module-level constants used by getAgentSignalStatuses ───────────────────

const BIBLE_LS_PREFIX_FOR_STATUS = 'edugenius_subtopic_bible_';
let _lastExamIdCache = 'GATE_EM'; // updated by orchestrateSession
