/**
 * examDateService.ts — Exam Date Management
 *
 * Single source of truth for exam dates across EduGenius.
 *
 * PRIORITY ORDER for resolving exam date:
 *   1. User-set date (stored in localStorage per exam)
 *   2. System default (known official dates for the current cycle)
 *   3. Fallback: 90 days from today
 *
 * System defaults are updated each academic cycle. If the exam has passed
 * for this year, the service automatically rolls over to next year's date.
 */

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'eg_exam_dates'; // { [examId]: 'YYYY-MM-DD' }

function loadStoredDates(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredDates(dates: Record<string, string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dates));
}

// ── System Defaults ───────────────────────────────────────────────────────────
//
// Official / historically consistent exam windows.
// Month is 0-indexed (JS Date convention).
// If the date has already passed this year, rolls to next year automatically.

interface ExamDateDefault {
  month: number;  // 0-indexed
  day: number;
  label: string;  // human-readable description of when this exam typically falls
}

const EXAM_DATE_DEFAULTS: Record<string, ExamDateDefault> = {
  // JEE Main: typically January + April sessions. Use April as primary.
  'jee-main':     { month: 3,  day: 5,  label: 'JEE Main (April session, approx.)' },
  // JEE Advanced: typically late May / early June
  'jee-advanced': { month: 5,  day: 1,  label: 'JEE Advanced (late May, approx.)' },
  // NEET: typically first Sunday of May
  'neet':         { month: 4,  day: 4,  label: 'NEET UG (May, approx.)' },
  // GATE: typically first two weekends of February
  'gate-em':      { month: 1,  day: 8,  label: 'GATE (February, approx.)' },
  // CAT: typically last Sunday of November
  'cat':          { month: 10, day: 24, label: 'CAT (late November, approx.)' },
  // UPSC Prelims: typically early June
  'upsc':         { month: 5,  day: 7,  label: 'UPSC CSE Prelims (June, approx.)' },
  // CBSE 12: board exams typically mid-February to mid-April
  'cbse-12':      { month: 2,  day: 15, label: 'CBSE Class 12 (March, approx.)' },
  // GMAT: rolling (no fixed date) — 90 days from today used as default
  'gmat':         { month: -1, day: -1, label: 'GMAT (rolling schedule)' },
};

/**
 * getSystemDefaultDate(examId)
 *
 * Returns the next occurrence of the exam's typical date.
 * If this year's date has already passed, returns next year's.
 * Returns null for rolling exams (GMAT etc.)
 */
export function getSystemDefaultDate(examId: string): Date | null {
  const def = EXAM_DATE_DEFAULTS[examId];
  if (!def || def.month === -1) return null;

  const now = new Date();
  const thisYear = now.getFullYear();

  // Try this year first
  const candidate = new Date(thisYear, def.month, def.day, 8, 0, 0, 0);
  if (candidate > now) return candidate;

  // Passed — use next year
  return new Date(thisYear + 1, def.month, def.day, 8, 0, 0, 0);
}

/**
 * getSystemDefaultLabel(examId)
 * Human-readable description of when this exam typically falls.
 */
export function getSystemDefaultLabel(examId: string): string {
  return EXAM_DATE_DEFAULTS[examId]?.label ?? 'Date not available';
}

// ── Core API ──────────────────────────────────────────────────────────────────

/**
 * getExamDate(examId)
 *
 * Returns the resolved exam date for the given exam:
 *   - User-set date if one exists
 *   - System default if known
 *   - 90 days from now as fallback
 *
 * Also returns the source so the UI can show "Set by you" vs "System default".
 */
export function getExamDate(examId: string): {
  date: Date;
  source: 'user' | 'system_default' | 'fallback';
  label: string;
} {
  const stored = loadStoredDates();

  // 1. User-set
  if (stored[examId]) {
    const d = new Date(stored[examId] + 'T08:00:00');
    if (!isNaN(d.getTime()) && d > new Date()) {
      return { date: d, source: 'user', label: 'Set by you' };
    }
    // Stored date is in the past — fall through
  }

  // 2. System default
  const def = getSystemDefaultDate(examId);
  if (def) {
    return {
      date: def,
      source: 'system_default',
      label: getSystemDefaultLabel(examId),
    };
  }

  // 3. Fallback: 90 days from now
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 90);
  return { date: fallback, source: 'fallback', label: '90-day estimate' };
}

/**
 * setExamDate(examId, date)
 * Store a user-selected exam date. Pass null to clear (revert to system default).
 */
export function setExamDate(examId: string, date: Date | null): void {
  const stored = loadStoredDates();
  if (date === null) {
    delete stored[examId];
  } else {
    // Store as YYYY-MM-DD
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    stored[examId] = `${yyyy}-${mm}-${dd}`;
  }
  saveStoredDates(stored);
}

/**
 * getDaysToExam(examId)
 *
 * Returns the number of days until the exam (0 = today, negative = passed).
 * This is the canonical function — all components should call this instead
 * of reading daysToExam from the persona directly.
 */
export function getDaysToExam(examId: string): number {
  const { date } = getExamDate(examId);
  const now = new Date();
  // Reset both to midnight for clean day diff
  const examMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowMidnight  = new Date(now.getFullYear(),  now.getMonth(),  now.getDate());
  const diffMs = examMidnight.getTime() - nowMidnight.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * getExamDateFormatted(examId)
 * Returns a human-readable date string: "Saturday, 8 Feb 2026"
 */
export function getExamDateFormatted(examId: string): string {
  const { date } = getExamDate(examId);
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * isExamToday(examId)
 */
export function isExamToday(examId: string): boolean {
  return getDaysToExam(examId) === 0;
}

/**
 * isExamSoon(examId, withinDays)
 * Returns true if the exam is within the given number of days.
 */
export function isExamSoon(examId: string, withinDays = 30): boolean {
  const days = getDaysToExam(examId);
  return days >= 0 && days <= withinDays;
}

/**
 * getUrgencyLevel(examId)
 * Returns a machine-readable urgency tier for styling decisions.
 */
export function getUrgencyLevel(examId: string): 'critical' | 'high' | 'medium' | 'low' {
  const days = getDaysToExam(examId);
  if (days <= 3)  return 'critical';
  if (days <= 14) return 'high';
  if (days <= 45) return 'medium';
  return 'low';
}

/**
 * getAllExamDates()
 * Returns date info for all known exams. Used by the settings panel.
 */
export function getAllExamDates(): Array<{
  examId: string;
  examName: string;
  date: Date;
  source: 'user' | 'system_default' | 'fallback';
  label: string;
  daysToExam: number;
  urgency: ReturnType<typeof getUrgencyLevel>;
}> {
  const examIds = Object.keys(EXAM_DATE_DEFAULTS);
  return examIds.map(id => {
    const { date, source, label } = getExamDate(id);
    const names: Record<string, string> = {
      'jee-main': 'JEE Main', 'jee-advanced': 'JEE Advanced', 'neet': 'NEET',
      'gate-em': 'GATE', 'cat': 'CAT', 'upsc': 'UPSC CSE', 'cbse-12': 'CBSE 12', 'gmat': 'GMAT',
    };
    return {
      examId: id,
      examName: names[id] ?? id,
      date,
      source,
      label,
      daysToExam: getDaysToExam(id),
      urgency: getUrgencyLevel(id),
    };
  });
}
