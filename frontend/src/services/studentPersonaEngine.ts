/**
 * Student Persona Engine
 * 
 * Builds a live student persona from all available signals.
 * Sage reads this before generating every response.
 * Updates after each interaction.
 */

export type ExamType = 'JEE_MAIN' | 'JEE_ADVANCED' | 'NEET' | 'CBSE_12' | 'CAT' | 'UPSC' | 'GATE';
export type LearningStyle = 'visual' | 'analytical' | 'story-driven' | 'practice-first' | 'unknown';
export type EmotionalState = 'confident' | 'anxious' | 'frustrated' | 'motivated' | 'exhausted' | 'neutral';
export type PerformanceTier = 'struggling' | 'average' | 'good' | 'advanced';

export interface StudentPersona {
  studentId: string;
  name: string;

  // Academic profile
  exam: ExamType;
  targetScore: number;           // e.g. 95 (percentile) or 650 (marks)
  currentScore: number;          // last mock test score
  daysToExam: number;
  weakSubjects: string[];        // e.g. ['Organic Chemistry', 'Integration']
  strongSubjects: string[];
  syllabusCompletion: number;    // 0-100%

  // Behavioural signals
  learningStyle: LearningStyle;
  avgSessionMinutes: number;
  questionsPerSession: number;
  streakDays: number;
  lastActive: Date;

  // Emotional / motivation signals
  emotionalState: EmotionalState;
  motivationLevel: number;       // 0-10
  frustrationScore: number;      // 0-10, computed from recent interactions

  // Performance tier
  tier: PerformanceTier;

  // Communication preferences (learned over time)
  prefersShortAnswers: boolean;
  prefersAnalogies: boolean;
  respondsBestTo: 'encouragement' | 'challenge' | 'calm_explanation' | 'humor';
  nativeLanguage: 'english' | 'hindi' | 'tamil' | 'telugu' | 'mixed';

  // Session context
  currentTopic: string;
  sessionStartedAt: Date;
  messagesThisSession: number;
  lastMessageSentiment: 'positive' | 'negative' | 'neutral';
}

// ── Persona builder ──────────────────────────────────────────────────────────

export function buildPersona(raw: Partial<StudentPersona>): StudentPersona {
  const daysToExam = raw.daysToExam ?? 90;
  const currentScore = raw.currentScore ?? 50;
  const targetScore = raw.targetScore ?? 80;
  const syllabusCompletion = raw.syllabusCompletion ?? 40;

  // Compute tier
  let tier: PerformanceTier = 'average';
  const gap = targetScore - currentScore;
  if (currentScore >= targetScore * 0.9) tier = 'advanced';
  else if (gap > 30 || syllabusCompletion < 30) tier = 'struggling';
  else if (currentScore >= targetScore * 0.75) tier = 'good';

  // Compute motivation level
  const streakBonus = Math.min((raw.streakDays ?? 0) * 0.5, 3);
  const progressBonus = (syllabusCompletion / 100) * 3;
  const urgencyFactor = daysToExam < 30 ? 2 : daysToExam < 60 ? 1 : 0;
  const motivationLevel = Math.min(10, 4 + streakBonus + progressBonus + urgencyFactor);

  return {
    studentId: raw.studentId ?? 'unknown',
    name: raw.name ?? 'Student',
    exam: raw.exam ?? 'JEE_MAIN',
    targetScore,
    currentScore,
    daysToExam,
    weakSubjects: raw.weakSubjects ?? [],
    strongSubjects: raw.strongSubjects ?? [],
    syllabusCompletion,
    learningStyle: raw.learningStyle ?? 'unknown',
    avgSessionMinutes: raw.avgSessionMinutes ?? 30,
    questionsPerSession: raw.questionsPerSession ?? 10,
    streakDays: raw.streakDays ?? 0,
    lastActive: raw.lastActive ?? new Date(),
    emotionalState: raw.emotionalState ?? 'neutral',
    motivationLevel,
    frustrationScore: raw.frustrationScore ?? 0,
    tier,
    prefersShortAnswers: raw.prefersShortAnswers ?? (raw.avgSessionMinutes ?? 30) < 20,
    prefersAnalogies: raw.prefersAnalogies ?? raw.learningStyle === 'visual',
    respondsBestTo: raw.respondsBestTo ?? (
      tier === 'struggling' ? 'encouragement' :
      tier === 'advanced' ? 'challenge' :
      'calm_explanation'
    ),
    nativeLanguage: raw.nativeLanguage ?? 'english',
    currentTopic: raw.currentTopic ?? 'General',
    sessionStartedAt: raw.sessionStartedAt ?? new Date(),
    messagesThisSession: raw.messagesThisSession ?? 0,
    lastMessageSentiment: raw.lastMessageSentiment ?? 'neutral',
  };
}

// ── Emotion detector ──────────────────────────────────────────────────────────

export function detectEmotion(message: string, persona: StudentPersona): EmotionalState {
  const lower = message.toLowerCase();

  // Frustration signals
  if (/i don'?t (understand|get it)|nothing makes sense|i (hate|give up)|why is this so hard|i'?m (confused|lost)|this is impossible/i.test(lower)) {
    return 'frustrated';
  }
  // Anxiety signals
  if (/scared|nervous|worried|stressed|anxiety|panic|what if i fail|not ready|running out of time/i.test(lower)) {
    return 'anxious';
  }
  // Exhaustion signals
  if (/tired|exhausted|can'?t do (this|anymore)|burned? out|sleep|too much/i.test(lower)) {
    return 'exhausted';
  }
  // Confidence signals
  if (/i (got|understand|solved|figured out)|makes sense now|got it|thanks (that helped)?|clear now/i.test(lower)) {
    return 'confident';
  }
  // Motivated
  if (/let'?s (do|go|study)|i'?m ready|motivated|focused|let me try|one more/i.test(lower)) {
    return 'motivated';
  }

  return persona.emotionalState; // maintain last known state
}

// ── Persona loader (reads from localStorage + user profile) ──────────────────

const PERSONA_KEY = 'edugenius_student_persona';

// ── ExamType → examDateService ID mapper ──────────────────────────────────────
// studentPersonaEngine uses snake_case; examDateService uses kebab-case catalog IDs.

const EXAM_TYPE_TO_CATALOG_ID: Record<ExamType, string> = {
  JEE_MAIN:     'jee-main',
  JEE_ADVANCED: 'jee-advanced',
  NEET:         'neet',
  CBSE_12:      'cbse-12',
  CAT:          'cat',
  UPSC:         'upsc',
  GATE:         'gate-em',
};

/**
 * getLiveDaysToExam(exam)
 * Returns live-computed days to exam from examDateService.
 * Falls back to stored persona value if service returns a negative number (passed).
 */
function getLiveDaysToExam(exam: ExamType, storedDays?: number): number {
  try {
    // Dynamic import at call-time to avoid circular deps at module load
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getDaysToExam } = require('./examDateService') as typeof import('./examDateService');
    const catalogId = EXAM_TYPE_TO_CATALOG_ID[exam] ?? 'gate-em';
    const live = getDaysToExam(catalogId);
    // If exam has passed (negative), use stored value as fallback
    return live >= 0 ? live : (storedDays ?? 90);
  } catch {
    return storedDays ?? 90;
  }
}

export function loadPersona(): StudentPersona {
  try {
    const stored = localStorage.getItem(PERSONA_KEY);
    if (stored) {
      const raw = JSON.parse(stored);
      // Override stored daysToExam with live-computed value from examDateService
      const liveDays = getLiveDaysToExam(raw.exam as ExamType, raw.daysToExam);
      return buildPersona({
        ...raw,
        lastActive: new Date(raw.lastActive),
        sessionStartedAt: new Date(),
        daysToExam: liveDays,
      });
    }
  } catch {
    // ignore parse errors
  }

  // Default persona for demo/new user
  const defaultExam: ExamType = 'JEE_MAIN';
  return buildPersona({
    studentId: 'demo',
    name: 'Student',
    exam: defaultExam,
    targetScore: 85,
    currentScore: 62,
    daysToExam: getLiveDaysToExam(defaultExam, 90),
    weakSubjects: ['Organic Chemistry', 'Integration'],
    strongSubjects: ['Mechanics', 'Algebra'],
    syllabusCompletion: 54,
    learningStyle: 'unknown',
    streakDays: 4,
    sessionStartedAt: new Date(),
  });
}

export function savePersona(persona: StudentPersona): void {
  localStorage.setItem(PERSONA_KEY, JSON.stringify(persona));
}

export function updatePersonaAfterMessage(
  persona: StudentPersona,
  userMessage: string,
  sentiment: 'positive' | 'negative' | 'neutral'
): StudentPersona {
  const newEmotion = detectEmotion(userMessage, persona);
  const newFrustration = newEmotion === 'frustrated'
    ? Math.min(10, persona.frustrationScore + 2)
    : Math.max(0, persona.frustrationScore - 0.5);

  const updated: StudentPersona = {
    ...persona,
    emotionalState: newEmotion,
    frustrationScore: newFrustration,
    messagesThisSession: persona.messagesThisSession + 1,
    lastMessageSentiment: sentiment,
  };

  savePersona(updated);
  return updated;
}

// ── CustomerProfile bridge ────────────────────────────────────────────────────

import type { CustomerProfile } from './contentFramework';

/**
 * Converts a StudentPersona to the raw input shape expected by buildCustomerProfile().
 * Use `import type` ensures CustomerProfile is erased at runtime (no circular dep).
 */
export function personaToCustomerProfileRaw(
  persona: StudentPersona,
  overrides?: {
    channel?: CustomerProfile['channel'];
    deviceType?: CustomerProfile['deviceType'];
    currentTopic?: string;
    questionsThisSession?: number;
  }
): Parameters<typeof import('./contentFramework').buildCustomerProfile>[0] {
  return {
    uid:                 persona.studentId,
    name:                persona.name,
    role:                'student' as const,
    examId:              persona.exam,
    examName:            persona.exam,
    daysToExam:          persona.daysToExam,
    channel:             overrides?.channel ?? 'web',
    deviceType:          overrides?.deviceType ?? 'desktop',
    emotionalState:      persona.emotionalState as CustomerProfile['emotionalState'],
    masteryPct:          persona.syllabusCompletion,
    recentScore:         persona.currentScore,
    streak:              persona.streakDays,
    weakTopics:          persona.weakSubjects,
    strongTopics:        persona.strongSubjects,
    sessionDurationMin:  persona.avgSessionMinutes,
    questionsThisSession: overrides?.questionsThisSession ?? 0,
    currentTopic:        overrides?.currentTopic,
    language:            (persona.nativeLanguage === 'english' ? 'english' : 'mixed') as CustomerProfile['language'],
    prefersShortContent: persona.prefersShortAnswers,
  };
}
