/**
 * moodCheckInService.ts — Student mood detection and adaptive pacing
 * CEO/Admin: appStore.moodCheckInEnabled
 * No API calls — heuristic + localStorage.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type Mood = 'energised' | 'focused' | 'tired' | 'stressed' | 'frustrated' | 'neutral';

export interface MoodEntry {
  mood: Mood;
  timestamp: number;
  sessionLength?: number; // recommended minutes
}

export interface SessionPlan {
  durationMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  style: 'drill' | 'explore' | 'review' | 'rest';
  message: string;
  sageInstruction: string;
  streakProtected: boolean;
}

export const MOOD_OPTIONS: Array<{ mood: Mood; emoji: string; label: string }> = [
  { mood: 'energised', emoji: '⚡', label: "Let's go!" },
  { mood: 'focused',   emoji: '🎯', label: 'Focused' },
  { mood: 'neutral',   emoji: '😐', label: 'Okay' },
  { mood: 'tired',     emoji: '😴', label: 'Tired' },
  { mood: 'stressed',  emoji: '😰', label: 'Stressed' },
  { mood: 'frustrated',emoji: '😤', label: 'Frustrated' },
];

// ─── Adaptive Session Plans ────────────────────────────────────────────────────

const SESSION_PLANS: Record<Mood, SessionPlan> = {
  energised: {
    durationMinutes: 60,
    difficulty: 'hard',
    style: 'drill',
    message: "🚀 You're on fire! Let's tackle the tough stuff today.",
    sageInstruction: 'The student is energised and ready for a challenge. Push them with harder questions and detailed explanations. Ask follow-up questions to deepen mastery.',
    streakProtected: false,
  },
  focused: {
    durationMinutes: 45,
    difficulty: 'medium',
    style: 'explore',
    message: '🎯 Great mindset for learning. Let\'s explore something new.',
    sageInstruction: 'The student is focused. Engage deeply with the concept. Use the Socratic method effectively. Build on their existing knowledge.',
    streakProtected: false,
  },
  neutral: {
    durationMinutes: 30,
    difficulty: 'medium',
    style: 'review',
    message: '📖 Steady day. A good review session will keep your momentum going.',
    sageInstruction: 'The student is in a neutral mood. Keep explanations clear and encouraging. Mix in some easier wins to build confidence.',
    streakProtected: false,
  },
  tired: {
    durationMinutes: 15,
    difficulty: 'easy',
    style: 'review',
    message: '😴 Rest is part of learning. A quick 15-min review is all you need today.',
    sageInstruction: 'The student is tired. Keep it short and positive. Focus on revision of known concepts. Do NOT introduce new material. Be very encouraging.',
    streakProtected: true,
  },
  stressed: {
    durationMinutes: 20,
    difficulty: 'easy',
    style: 'review',
    message: "😰 Stress is normal before exams. Let's do a calming review of things you already know.",
    sageInstruction: 'The student is stressed. Be extra warm and reassuring. Remind them of their progress. Use easier questions to rebuild confidence. Avoid adding pressure.',
    streakProtected: true,
  },
  frustrated: {
    durationMinutes: 15,
    difficulty: 'easy',
    style: 'drill',
    message: "😤 Frustration means you care. Let's break this down into tiny steps.",
    sageInstruction: 'The student is frustrated. Be patient, empathetic, and break concepts into the smallest possible steps. Acknowledge their effort explicitly. Celebrate every small win.',
    streakProtected: true,
  },
};

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'eg_mood_log';
const TODAY_KEY = 'eg_mood_today';

export function getTodayMood(): MoodEntry | null {
  try {
    const raw = localStorage.getItem(TODAY_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as MoodEntry;
    // Expire after 8 hours
    if (Date.now() - entry.timestamp > 28800000) return null;
    return entry;
  } catch { return null; }
}

export function recordMood(mood: Mood): MoodEntry {
  const entry: MoodEntry = { mood, timestamp: Date.now() };
  localStorage.setItem(TODAY_KEY, JSON.stringify(entry));

  // Append to log
  const log: MoodEntry[] = getMoodLog();
  log.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log.slice(0, 30)));

  return entry;
}

export function getMoodLog(): MoodEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

export function getSessionPlan(mood: Mood): SessionPlan {
  return SESSION_PLANS[mood];
}

export function getMoodEmoji(mood: Mood): string {
  return MOOD_OPTIONS.find(m => m.mood === mood)?.emoji ?? '😐';
}

/** Analyse mood log to detect chronic stress/fatigue */
export function getMoodInsight(): string | null {
  const log = getMoodLog().slice(0, 7);
  if (log.length < 3) return null;

  const negative = log.filter(e => ['stressed', 'frustrated', 'tired'].includes(e.mood)).length;
  const ratio = negative / log.length;

  if (ratio >= 0.7) return '⚠️ You\'ve been stressed or tired most days this week. Consider taking a short break or speaking to someone.';
  if (ratio >= 0.5) return '📊 More difficult days than good ones lately. Short 15-min sessions are fine — consistency beats intensity.';
  return null;
}
