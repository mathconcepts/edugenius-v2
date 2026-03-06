/**
 * lensEngine.ts — EduGenius Personalization Brain
 *
 * The Lens Engine compiles a rich LensContext object before every Sage response.
 * It replaces ad-hoc personalization scattered across sagePersonaPrompts.ts.
 *
 * Flow:
 *   Student message → LensEngine.build() → LensContext → Sage prompt builder → Gemini
 *
 * Data sources (all local, no external API required):
 *   - IndexedDB (topic mastery, interaction history) via persistenceDB
 *   - StudentPersona (emotional state, learning style) via studentPersonaEngine
 *   - ExamRegistry (topic weights, competitor gaps) via examRegistry
 *   - PYQ banks (static TypeScript bundles) — GATE EM + CAT
 *   - Static content bank (MCQs, formula sheets) — topic-keyed
 */

import {
  getTopicMastery,
  getWeakTopics,
  getMasteredTopics,
  getInteractionCount,
  getRecentInteractions,
  enqueueSignal,
  type TopicMasteryRecord,
} from './persistenceDB';
import { loadPersona, type StudentPersona, type LearningStyle, type EmotionalState } from './studentPersonaEngine';
import { getExamById } from '../data/examRegistry';
import { getTopperPromptAddendum } from './topperIntelligence';
import type { BehavioralSignals } from './behavioralSignals';
import { getDueTopics, getOverdueTopics } from './spacedRepetition';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContentStrategy =
  | 'deep_explain'       // Student has time, wants to understand
  | 'exam_shortcut'      // Exam pressure — give the trick fast
  | 'emotional_first'    // Student is frustrated/anxious — address emotion before content
  | 'quick_refresh'      // Student knows it, just needs a reminder
  | 'challenge_up'       // Student is confident — push harder
  | 'first_time';        // Student has never asked about this topic

export type ContentFormat =
  | 'text_explanation'   // default — plain prose
  | 'worked_example'     // show a solved problem step-by-step
  | 'analogy_bridge'     // explain via analogy to something familiar
  | 'mcq_probe'          // ask a MCQ to test understanding first
  | 'visual_ascii'       // ASCII diagram or table
  | 'formula_card'       // just the formula + variables explained
  | 'pyq_anchor'         // start with a real past question
  | 'compare_contrast';  // two concepts side-by-side

export type DeliveryPersona =
  | 'warm_coach'         // encouraging, personal
  | 'sharp_peer'         // direct, peer-to-peer, no fluff
  | 'calm_mentor'        // measured, step-by-step
  | 'energetic_pusher'   // motivating, short punchy sentences
  | 'gentle_rescuer';    // for students in distress

export interface NextContentSuggestion {
  topicId: string;
  reason: string;
  contentType: 'mcq' | 'concept' | 'formula' | 'pyq';
  urgency: 'high' | 'medium' | 'low';
}

export interface LensContext {
  // ── Identity
  studentId: string;
  studentName: string;
  examId: string;

  // ── Emotional / Session state
  currentEmotion: EmotionalState;
  sessionFatigue: number;          // 0–10 (escalates with message count)
  sessionMessageCount: number;

  // ── Topic intelligence
  topicId: string;
  topicMastery: TopicMasteryRecord | null;
  timesAskedAboutTopic: number;    // cross-session interaction count
  isFirstTimeOnTopic: boolean;
  isTopicMastered: boolean;
  isTopicWeak: boolean;
  isTopicExamCritical: boolean;
  cohortStruggleAlert: boolean;    // true if topic mastery < 0.4 (well-known hard topic)

  // ── Exam urgency
  daysToExam: number;
  examUrgency: 'critical' | 'moderate' | 'relaxed'; // <14 | 14–60 | >60

  // ── Learning style
  learningStyle: LearningStyle;
  prefersShortAnswers: boolean;
  prefersAnalogies: boolean;

  // ── Content availability
  hasPYQContext: boolean;
  hasManimTemplate: boolean;
  staticContentAvailable: boolean;

  // ── Derived strategy
  contentStrategy: ContentStrategy;
  suggestedNextContent: NextContentSuggestion | null;

  // ── Hyper-personalization (v2)
  behavioralSignals: BehavioralSignals | null;
  srDueTopics: string[];             // topics due for review via SM-2
  srOverdueTopics: string[];         // topics OVERDUE — surface urgently
  contentFormat: ContentFormat;      // auto-selected delivery format
  deliveryPersona: DeliveryPersona;  // how Sage should sound THIS response

  // ── Raw persona (for downstream use)
  persona: StudentPersona;
}

// ─── Manim topic map ──────────────────────────────────────────────────────────

const MANIM_TOPICS = new Set([
  'linear-algebra', 'calculus', 'probability-statistics',
  'transform-theory', 'vector-calculus', 'graph-theory',
  'integration', 'eigenvalue', 'fourier', 'differential-equations',
]);

// ─── Cohort struggle thresholds (hardcoded from known GATE/CAT pain points) ──

const KNOWN_HARD_TOPICS = new Set([
  'complex-variables', 'numerical-methods', 'transform-theory',
  'dilr', 'reading-comprehension',
]);

// ─── Exam urgency thresholds ──────────────────────────────────────────────────

function computeExamUrgency(daysToExam: number): LensContext['examUrgency'] {
  if (daysToExam <= 14) return 'critical';
  if (daysToExam <= 60) return 'moderate';
  return 'relaxed';
}

// ─── Content strategy decision tree ──────────────────────────────────────────

function pickContentStrategy(
  emotion: EmotionalState,
  mastery: TopicMasteryRecord | null,
  daysToExam: number,
  isFirstTime: boolean,
  sessionMessageCount: number,
): ContentStrategy {
  // Emotion overrides everything if negative
  if (emotion === 'frustrated' || emotion === 'anxious' || emotion === 'exhausted') {
    return 'emotional_first';
  }

  // First time on topic
  if (isFirstTime || !mastery) {
    return 'first_time';
  }

  // Student is confident + mastered → push harder
  if ((emotion === 'confident' || emotion === 'motivated') && mastery.isMastered) {
    return 'challenge_up';
  }

  // High exam pressure → shortcuts
  if (daysToExam <= 14) {
    return 'exam_shortcut';
  }

  // Long session + topic seen before → quick refresh
  if (sessionMessageCount > 10 && mastery.correctCount > 2) {
    return 'quick_refresh';
  }

  return 'deep_explain';
}

// ─── Next content suggestion ──────────────────────────────────────────────────

async function suggestNextContent(
  studentId: string,
  examId: string,
  currentTopicId: string,
  examUrgency: LensContext['examUrgency'],
): Promise<NextContentSuggestion | null> {
  const weakTopics = await getWeakTopics(studentId, examId, 3);
  const exam = getExamById(examId);

  // Filter out current topic
  const otherWeak = weakTopics.filter((t) => t.topicId !== currentTopicId);

  if (otherWeak.length > 0) {
    const next = otherWeak[0];
    const isExamCritical = exam?.topicWeights?.find(
      (w) => w.topicId === next.topicId && w.priority === 'high'
    );

    return {
      topicId: next.topicId,
      reason: isExamCritical
        ? `High-priority topic for ${exam?.shortName} — only ${Math.round(next.masteryScore * 100)}% mastery`
        : `Weakest topic right now — ${Math.round(next.masteryScore * 100)}% mastery`,
      contentType: examUrgency === 'critical' ? 'pyq' : 'concept',
      urgency: isExamCritical ? 'high' : 'medium',
    };
  }

  return null;
}

// ─── Content format picker ────────────────────────────────────────────────────

function pickContentFormat(
  lens: Partial<LensContext>,
  behavioral: BehavioralSignals | null
): ContentFormat {
  // Overloaded student → simplest possible format
  if (behavioral?.cognitiveLoad === 'overloaded') return 'formula_card';

  // First time on topic → build intuition with analogy
  if (lens.isFirstTimeOnTopic) return 'analogy_bridge';

  // Exam critical + < 14 days → anchor to real past question
  if (lens.examUrgency === 'critical' && lens.isTopicExamCritical) return 'pyq_anchor';

  // Visual learner + complex topic → ASCII diagram/table
  if (lens.learningStyle === 'visual' && lens.cohortStruggleAlert) return 'visual_ascii';

  // Practice-first learner → probe with MCQ before explaining
  if (lens.learningStyle === 'practice-first') return 'mcq_probe';

  // Student mastered but came back → deepen with compare/contrast
  if (lens.isTopicMastered) return 'compare_contrast';

  // Weak topic + already tried before → show a full worked example
  if (lens.isTopicWeak && (lens.timesAskedAboutTopic ?? 0) > 1) return 'worked_example';

  return 'text_explanation';
}

// ─── Delivery persona picker ──────────────────────────────────────────────────

function pickDeliveryPersona(
  emotion: EmotionalState,
  behavioral: BehavioralSignals | null,
  tier: StudentPersona['tier']
): DeliveryPersona {
  if (emotion === 'frustrated' || emotion === 'anxious') return 'gentle_rescuer';
  if (emotion === 'exhausted' || behavioral?.cognitiveLoad === 'overloaded') return 'calm_mentor';
  if (emotion === 'motivated' || behavioral?.confidenceSignal === 'high') return 'energetic_pusher';
  if (tier === 'advanced') return 'sharp_peer';
  if (tier === 'struggling') return 'warm_coach';
  return 'calm_mentor';
}

// ─── Main Builder ─────────────────────────────────────────────────────────────

export interface BuildLensOptions {
  studentId: string;
  topicId: string;
  examId: string;
  sessionId: string;
  sessionMessageCount: number;
  /** Pass the detected emotion from Sage's NLP layer */
  detectedEmotion?: EmotionalState;
  /** Whether static PYQ context exists for this topic */
  hasPYQContext?: boolean;
  /** Optional behavioral micro-signals from the chat interface */
  behavioralSignals?: BehavioralSignals | null;
}

export async function buildLensContext(opts: BuildLensOptions): Promise<LensContext> {
  const {
    studentId,
    topicId,
    examId,
    sessionMessageCount,
    detectedEmotion,
    hasPYQContext = false,
    behavioralSignals = null,
  } = opts;

  // ── Load all data sources in parallel ────────────────────────────────────
  const [persona, topicMastery, weakTopics, masteredTopics, interactionCount, srDueRecords, srOverdueRecords] =
    await Promise.all([
      loadStudentPersonaFromDB(studentId),
      getTopicMastery(studentId, examId, topicId),
      getWeakTopics(studentId, examId, 5),
      getMasteredTopics(studentId, examId),
      getInteractionCount(studentId, topicId),
      getDueTopics(studentId, examId, 10).catch(() => []),
      getOverdueTopics(studentId, examId).catch(() => []),
    ]);

  const exam = getExamById(examId);

  // ── Compute derived fields ────────────────────────────────────────────────
  const emotion = detectedEmotion ?? persona.emotionalState;
  const daysToExam = persona.daysToExam;
  const examUrgency = computeExamUrgency(daysToExam);

  const isFirstTime = interactionCount === 0;
  const isTopicWeak = weakTopics.some((t) => t.topicId === topicId);
  const isTopicMastered = masteredTopics.includes(topicId);
  const isTopicExamCritical = exam?.topicWeights?.some(
    (w) => w.topicId === topicId && w.priority === 'high'
  ) ?? false;

  const cohortStruggleAlert = KNOWN_HARD_TOPICS.has(topicId);
  const hasManimTemplate = MANIM_TOPICS.has(topicId);

  // Session fatigue: 0 at start, escalates after 8+ messages
  const sessionFatigue = Math.min(10, Math.max(0, (sessionMessageCount - 8) * 1.5));

  const contentStrategy = pickContentStrategy(
    emotion,
    topicMastery,
    daysToExam,
    isFirstTime,
    sessionMessageCount,
  );

  const suggestedNextContent = await suggestNextContent(
    studentId, examId, topicId, examUrgency
  );

  // ── Hyper-personalization: format + persona ───────────────────────────────
  // Build a partial LensContext for format/persona pickers (before full object exists)
  const partialLens: Partial<LensContext> = {
    isFirstTimeOnTopic: isFirstTime,
    examUrgency,
    isTopicExamCritical,
    learningStyle: persona.learningStyle,
    cohortStruggleAlert,
    isTopicMastered,
    isTopicWeak,
    timesAskedAboutTopic: interactionCount,
  };

  const contentFormat = pickContentFormat(partialLens, behavioralSignals);
  const deliveryPersona = pickDeliveryPersona(emotion, behavioralSignals, persona.tier);

  const srDueTopics = srDueRecords.map((r) => r.topicId);
  const srOverdueTopics = srOverdueRecords.map((r) => r.topicId);

  // ── Fire signals for struggling students ─────────────────────────────────
  if (topicMastery && topicMastery.incorrectCount >= 3 && !topicMastery.isMastered) {
    await enqueueSignal({
      type: 'STRUGGLE_PATTERN',
      sourceAgent: 'sage',
      targetAgent: 'atlas',
      payload: {
        studentId,
        topicId,
        examId,
        incorrectCount: topicMastery.incorrectCount,
        masteryScore: topicMastery.masteryScore,
        requestType: 'new_analogy_or_variant',
      },
      studentId,
      topicId,
    });
  }

  if (emotion === 'frustrated' && (topicMastery?.incorrectCount ?? 0) >= 2) {
    await enqueueSignal({
      type: 'FRUSTRATION_ALERT',
      sourceAgent: 'sage',
      targetAgent: 'mentor',
      payload: {
        studentId,
        topicId,
        examId,
        severity: Math.min(5, (topicMastery?.incorrectCount ?? 0)),
      },
      studentId,
      topicId,
    });
  }

  // ── Topper intelligence: inject before response if topic is known ────────
  if (topicId !== 'general') {
    const studyPhase: import('./topperIntelligence').StudyPhase =
      examUrgency === 'critical' ? 'exam_ready'
      : (topicMastery?.masteryScore ?? 0) < 0.4 ? 'first_encounter'
      : (topicMastery?.masteryScore ?? 0) < 0.7 ? 'building'
      : 'consolidating';

    const topperAddendum = getTopperPromptAddendum(examId, topicId, studyPhase, !isFirstTime, true);
    if (topperAddendum) {
      // Store in signal queue for Sage to pick up
      await enqueueSignal({
        type: 'CONTENT_GAP',
        sourceAgent: 'lens',
        targetAgent: 'sage',
        payload: { topperAddendum, topicId, examId, phase: studyPhase },
        topicId,
      });
    }
  }

  return {
    studentId,
    studentName: persona.name,
    examId,
    currentEmotion: emotion,
    sessionFatigue,
    sessionMessageCount,
    topicId,
    topicMastery,
    timesAskedAboutTopic: interactionCount,
    isFirstTimeOnTopic: isFirstTime,
    isTopicMastered,
    isTopicWeak,
    isTopicExamCritical,
    cohortStruggleAlert,
    daysToExam,
    examUrgency,
    learningStyle: persona.learningStyle,
    prefersShortAnswers: persona.prefersShortAnswers,
    prefersAnalogies: persona.prefersAnalogies,
    hasPYQContext,
    hasManimTemplate,
    staticContentAvailable: true, // always true — static bank always present
    contentStrategy,
    suggestedNextContent,
    // Hyper-personalization fields (v2)
    behavioralSignals,
    srDueTopics,
    srOverdueTopics,
    contentFormat,
    deliveryPersona,
    persona,
  };
}

// ─── Persona loader with DB fallback ─────────────────────────────────────────

async function loadStudentPersonaFromDB(studentId: string): Promise<StudentPersona> {
  // 1. Try IndexedDB first (cross-session data)
  const { loadStudentProfile } = await import('./persistenceDB');
  const stored = await loadStudentProfile(studentId);
  if (stored) return stored as StudentPersona;

  // 2. Fall back to in-memory/localStorage persona
  const { loadPersona } = await import('./studentPersonaEngine');
  return loadPersona();
}

// ─── Prompt generator from LensContext ───────────────────────────────────────

/**
 * Converts a LensContext into a structured Sage system prompt addendum.
 * This is injected AFTER the base Sage identity prompt.
 */
export function lensContextToPrompt(ctx: LensContext): string {
  const masteryPct = ctx.topicMastery
    ? Math.round(ctx.topicMastery.masteryScore * 100)
    : null;

  const urgencyLabel = {
    critical: '🚨 EXAM CRITICAL — less than 2 weeks',
    moderate: '⚡ Moderate urgency',
    relaxed: '📅 Relaxed timeline',
  }[ctx.examUrgency];

  const strategyInstructions: Record<ContentStrategy, string> = {
    emotional_first: `EMOTION FIRST: ${ctx.studentName} is ${ctx.currentEmotion}. 
Address the feeling in your FIRST sentence before any content. 
Keep explanation SHORT (3-4 sentences). One check question at the end only.`,

    first_time: `FIRST INTRODUCTION: ${ctx.studentName} has never asked about ${ctx.topicId} before.
Start from fundamentals. Use a concrete real-world hook. 
Don't assume prior knowledge. Build intuition before formulas.`,

    exam_shortcut: `EXAM MODE: ${urgencyLabel}.
Give the shortcut/trick first, then explain WHY it works.
Format: [Trick] → [Quick example] → [Tip for exam day].
Be concise — ${ctx.studentName} needs this fast.`,

    deep_explain: `DEEP LEARNING MODE: ${ctx.studentName} has time and wants to understand.
Go beyond the formula. Explain the intuition, the history if relevant, the 'why'.
Use ${ctx.prefersAnalogies ? 'analogies and real-world examples' : 'step-by-step logical reasoning'}.
Check understanding at the end.`,

    quick_refresh: `QUICK REFRESH: ${ctx.studentName} has seen this before (${ctx.timesAskedAboutTopic} times).
Skip the basics — they know them. Jump straight to the specific question.
One crisp explanation + one example is enough.`,

    challenge_up: `CHALLENGE MODE: ${ctx.studentName} has mastered this topic (${masteryPct}%).
Push them further. Ask a harder variant. Offer a twist problem.
"You've got the basics — let's try the GATE 2023 version of this..."`,
  };

  const parts: string[] = [];

  // Context block
  parts.push(`## LENS CONTEXT FOR THIS RESPONSE`);
  parts.push(`Student: ${ctx.studentName} | Exam: ${ctx.examId} | Topic: ${ctx.topicId}`);
  parts.push(`Emotion: ${ctx.currentEmotion} | Exam: ${urgencyLabel} | Session messages: ${ctx.sessionMessageCount}`);

  if (masteryPct !== null) {
    parts.push(`Topic mastery: ${masteryPct}% | Correct: ${ctx.topicMastery?.correctCount} / Wrong: ${ctx.topicMastery?.incorrectCount}`);
  }

  if (ctx.isTopicExamCritical) {
    parts.push(`⚠️ HIGH-PRIORITY TOPIC for ${ctx.examId} — competitors have weak coverage here`);
  }

  if (ctx.cohortStruggleAlert) {
    parts.push(`📊 COHORT NOTE: Many students struggle with ${ctx.topicId} — be extra patient here`);
  }

  if (ctx.hasPYQContext) {
    parts.push(`📚 PYQ context is available — reference it naturally if relevant`);
  }

  // Strategy instruction
  parts.push(`\n## RESPONSE STRATEGY: ${ctx.contentStrategy.toUpperCase()}`);
  parts.push(strategyInstructions[ctx.contentStrategy]);

  // Answer length
  const lengthGuide = ctx.prefersShortAnswers || ctx.sessionFatigue > 6
    ? 'BREVITY: Keep under 150 words unless the concept truly requires more.'
    : ctx.contentStrategy === 'deep_explain'
    ? 'LENGTH: Up to 300 words — this student wants depth.'
    : 'LENGTH: 100–200 words is ideal.';
  parts.push(`\n## FORMAT\n${lengthGuide}`);

  // ── Content format instructions ──────────────────────────────────────────
  const formatInstructions: Record<string, string> = {
    text_explanation: 'Explain clearly in plain prose. Build logically. One idea per paragraph.',
    worked_example:   'Show a COMPLETE worked solution. Label each step clearly (Step 1, Step 2...). Do NOT skip algebra or intermediate steps. End with: "Now you try: [variant question]".',
    analogy_bridge:   'Open with a real-world analogy BEFORE any formula. Format: "Think of [X] like [Y]..." — then connect to the concept. Make the analogy feel natural, not forced.',
    mcq_probe:        'Before explaining, ask ONE multiple choice question to gauge where they are. Format: "Quick check — which of these is correct?\nA) ...\nB) ...\nC) ...\nD) ..." — then teach based on their answer.',
    visual_ascii:     'Use ASCII tables, arrows, or diagrams to represent the concept. EVERY key relationship needs a visual. Use → for flow, | for tables, ■ for nodes. Keep text labels short.',
    formula_card:     'ONLY: the formula, variable definitions (one line each), and ONE numeric example. No prose. No backstory. Max 50 words total. Format:\nFormula: ...\nWhere: ...\nExample: ...',
    pyq_anchor:       'Start with: "In [GATE/CAT year], this appeared as: [question]". Then teach FROM the question — explain why each step applies. This is not abstract; it\'s exam-real.',
    compare_contrast: 'Show two versions side-by-side: ❌ COMMON MISTAKE vs ✅ CORRECT APPROACH. Make the contrast stark and clear. End with the rule that distinguishes them.',
  };

  const formatInstruction = formatInstructions[ctx.contentFormat] ?? formatInstructions.text_explanation;
  parts.push(`\n## CONTENT FORMAT: ${ctx.contentFormat.toUpperCase()}\n${formatInstruction}`);

  // ── Delivery persona instructions ────────────────────────────────────────
  const personaInstructions: Record<string, string> = {
    warm_coach:        'Be encouraging and personal. Use the student\'s name once. Acknowledge their effort. Tone: "You\'re getting there — here\'s the piece that unlocks it."',
    sharp_peer:        'Direct, peer-to-peer, zero fluff. Skip pleasantries. Lead with the answer or insight. Treat them as an equal who can handle directness.',
    calm_mentor:       'Measured, patient, step-by-step. Never rush. If the concept needs 3 steps, take all 3. Tone: steady, reassuring, methodical.',
    energetic_pusher:  'Short punchy sentences. Energy in every line. Use 🔥 sparingly. Push them: "Got it? Good — now level up." Keep momentum high.',
    gentle_rescuer:    'This student is struggling or distressed. Acknowledge FIRST: "This is genuinely hard — you\'re not alone." Then simplify everything. One small win at a time.',
  };

  const personaInstruction = personaInstructions[ctx.deliveryPersona] ?? personaInstructions.calm_mentor;
  parts.push(`\n## DELIVERY PERSONA: ${ctx.deliveryPersona.toUpperCase()}\n${personaInstruction}`);

  // ── Spaced repetition nudge ──────────────────────────────────────────────
  if (ctx.srDueTopics.length > 0 || ctx.srOverdueTopics.length > 0) {
    const srLines: string[] = ['\n## SPACED REPETITION'];
    if (ctx.srOverdueTopics.length > 0) {
      srLines.push(`⚠️ OVERDUE for review (>1 day): ${ctx.srOverdueTopics.join(', ')}`);
    }
    if (ctx.srDueTopics.length > 0) {
      srLines.push(`📅 Due for review today: ${ctx.srDueTopics.join(', ')}`);
    }
    srLines.push(`→ If any of these topics are RELEVANT to the current question, naturally mention: "You're due to review [topic] — want a quick test before we move on?"`);
    srLines.push(`→ Do NOT force this — only mention if it genuinely connects.`);
    parts.push(srLines.join('\n'));
  }

  // ── Behavioral signals ───────────────────────────────────────────────────
  if (ctx.behavioralSignals) {
    const bs = ctx.behavioralSignals;
    if (bs.cognitiveLoad === 'overloaded' || bs.cognitiveLoad === 'high') {
      parts.push(`\n## BEHAVIORAL SIGNAL\n⚠️ Student shows HIGH cognitive load (hesitation bursts: ${bs.hesitationBursts}, latency: ${Math.round(bs.avgResponseLatencyMs / 1000)}s avg). Simplify. Use shorter sentences. Avoid multi-part questions.`);
    } else if (bs.messageLengthTrend === 'decreasing' && bs.sessionScrollDepth < 0.2) {
      parts.push(`\n## BEHAVIORAL SIGNAL\nStudent's messages are getting shorter — possible fatigue. Keep THIS response concise. Suggest a break if appropriate.`);
    }
  }

  return parts.join('\n');
}
