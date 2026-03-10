/**
 * StudentDashboard — Frugal redesign (3-zone layout)
 *
 * Zone 1: Context Strip  — single line metadata
 * Zone 2: Next Task Card — THE ONE THING
 * Zone 3: Escape Hatches — 3 equal nav cards
 *
 * Principle: Maximum signal, minimum chrome.
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Target, MessageSquare, BarChart3 } from 'lucide-react';
import { loadPersona } from '@/services/studentPersonaEngine';
import { getDaysToExam, getExamDateFormatted, getUrgencyLevel } from '@/services/examDateService';
import { loadNotebookState, getDueRevisions, type ExamScope } from '@/services/notebookEngine';

// ── Dynamic today plan from persona + notebook ────────────────────────────────

function buildTodayPlan(
  persona: ReturnType<typeof loadPersona>,
  notebookState: ReturnType<typeof loadNotebookState>,
) {
  const examMap: Record<string, ExamScope> = {
    JEE_MAIN: 'JEE Main', JEE_ADVANCED: 'JEE Adv', NEET: 'NEET',
    CBSE_12: 'CBSE 12', CAT: 'CAT', UPSC: 'UPSC', GATE: 'GATE',
  };
  const examScope: ExamScope = examMap[persona.exam] ?? 'JEE Main';
  const dueRevisions = getDueRevisions(notebookState);

  const plan: { id: string; title: string; subject: string; duration: string; done: boolean }[] = [];

  dueRevisions.slice(0, 2).forEach((rev, i) => {
    plan.push({
      id: `rev-${rev.topicId}-${i}`,
      title: `Revise: ${rev.topicId.replace(/-/g, ' ').replace(/^\w+-\w+-/, '')}`,
      subject: 'Revision',
      duration: '20 min',
      done: false,
    });
  });

  if (plan.length < 2 && persona.weakSubjects.length > 0) {
    persona.weakSubjects.slice(0, 2 - plan.length).forEach((subj, i) => {
      plan.push({
        id: `weak-${i}`,
        title: `Strengthen: ${subj}`,
        subject: subj.split(' ')[0],
        duration: '25 min',
        done: false,
      });
    });
  }

  plan.push({ id: 'practice', title: 'Daily Practice (10 MCQs)', subject: 'Mixed', duration: '15 min', done: false });

  if (plan.length === 1) {
    const fallbacks = [
      { id: 'f1', title: `${examScope} Core Revision`, subject: 'Mixed', duration: '20 min', done: false },
      { id: 'f2', title: 'Formula Quick Review', subject: 'Mixed', duration: '10 min', done: false },
    ];
    plan.unshift(...fallbacks);
  }

  return plan.slice(0, 3);
}

// ── Dynamic exam countdown ────────────────────────────────────────────────────

const EXAM_TYPE_TO_CATALOG: Record<string, string> = {
  JEE_MAIN: 'jee-main', JEE_ADVANCED: 'jee-advanced', NEET: 'neet',
  CBSE_12: 'cbse-12', CAT: 'cat', UPSC: 'upsc', GATE: 'gate-em',
};
const EXAM_LABELS: Record<string, string> = {
  JEE_MAIN: 'JEE Main', JEE_ADVANCED: 'JEE Advanced', NEET: 'NEET',
  CBSE_12: 'CBSE 12', CAT: 'CAT', UPSC: 'UPSC', GATE: 'GATE',
};

function buildExamCountdown(persona: ReturnType<typeof loadPersona>) {
  const catalogId = EXAM_TYPE_TO_CATALOG[persona.exam] ?? 'gate-em';
  return {
    exam: EXAM_LABELS[persona.exam] ?? 'Exam',
    daysLeft: getDaysToExam(catalogId),
    examDate: getExamDateFormatted(catalogId),
    urgency: getUrgencyLevel(catalogId),
    catalogId,
  };
}

// ── Time-of-day greeting ──────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Late night crunch';
}

// ── Zone 1: Context Strip ─────────────────────────────────────────────────────

interface ContextStripProps {
  greeting: string;
  streak: number;
  examCountdown: ReturnType<typeof buildExamCountdown>;
}

function ContextStrip({ greeting, streak, examCountdown }: ContextStripProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-surface-400 flex-wrap">
      <span>{greeting}</span>
      <span className="text-surface-600">·</span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
        <span className="text-surface-300">{streak}</span>
      </span>
      <span className="text-surface-600">·</span>
      <span>
        {examCountdown.exam}:{' '}
        <span className="text-surface-300">{examCountdown.daysLeft}</span> days
      </span>
    </div>
  );
}

// ── Zone 2: Next Task Card ────────────────────────────────────────────────────

interface NextTaskCardProps {
  task: { id: string; title: string; subject: string; duration: string; done: boolean } | undefined;
  todayDone: number;
  todayTotal: number;
  onStart: () => void;
}

function NextTaskCard({ task, todayDone, todayTotal, onStart }: NextTaskCardProps) {
  const donePct = Math.round((todayDone / Math.max(todayTotal, 1)) * 100);

  if (!task) {
    return (
      <div className="rounded-2xl bg-surface-900 border border-green-600 p-4 sm:p-6 flex flex-col items-center justify-center gap-3 min-h-[220px]">
        <span className="text-5xl">🎉</span>
        <p className="text-lg font-semibold text-white">All done for today</p>
        <p className="text-sm text-surface-400">Incredible focus. See you tomorrow!</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface-900 border border-surface-700 p-4 sm:p-6 space-y-4">
      {/* Subject pill */}
      <span className="inline-flex items-center bg-surface-800 text-xs px-2 py-0.5 rounded-full text-surface-300">
        {task.subject} · {task.duration}
      </span>

      {/* Task title */}
      <h2 className="text-2xl font-bold text-white leading-snug line-clamp-2">
        {task.title}
      </h2>

      {/* Progress bar */}
      <div className="h-1 bg-surface-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all"
          style={{ width: `${donePct}%` }}
        />
      </div>

      {/* Start button */}
      <button
        onClick={onStart}
        className="w-full bg-primary-500 hover:bg-primary-400 active:scale-[0.98] text-white font-semibold py-3 rounded-xl transition-all"
      >
        Start →
      </button>

      {/* Done count */}
      <p className="text-xs text-surface-500 text-center">
        {todayDone} of {todayTotal} done today
      </p>
    </div>
  );
}

// ── Zone 3: Escape Hatches ────────────────────────────────────────────────────

const HATCHES = [
  { to: '/practice', icon: Target,       label: 'Practice'  },
  { to: '/chat',     icon: MessageSquare, label: 'Ask Sage'  },
  { to: '/progress', icon: BarChart3,    label: 'Progress'  },
] as const;

function EscapeHatches() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {HATCHES.map(({ to, icon: Icon, label }) => (
        <Link
          key={to}
          to={to}
          className="rounded-xl bg-surface-800 hover:bg-surface-700 p-4 flex flex-col items-center gap-2 cursor-pointer transition-colors"
        >
          <Icon className="w-5 h-5 text-surface-400" />
          <span className="text-sm text-surface-300 font-medium">{label}</span>
        </Link>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function StudentDashboard() {
  const navigate = useNavigate();

  const [streak, setStreak] = useState<number>(() => {
    const stored = localStorage.getItem('edugenius_streak');
    return stored ? parseInt(stored, 10) : 12;
  });

  const [todayPlan, setTodayPlan] = useState<ReturnType<typeof buildTodayPlan>>([]);
  const [examCountdown, setExamCountdown] = useState<ReturnType<typeof buildExamCountdown>>({
    exam: 'JEE Main',
    daysLeft: getDaysToExam('jee-main'),
    examDate: '',
    urgency: getUrgencyLevel('jee-main'),
    catalogId: 'jee-main',
  });

  useEffect(() => {
    const persona = loadPersona();
    const examMap: Record<string, ExamScope> = {
      JEE_MAIN: 'JEE Main', JEE_ADVANCED: 'JEE Adv', NEET: 'NEET',
      CBSE_12: 'CBSE 12', CAT: 'CAT', UPSC: 'UPSC', GATE: 'GATE',
    };
    const examScope: ExamScope = examMap[persona.exam] ?? 'JEE Main';
    const notebookState = loadNotebookState(examScope);
    setTodayPlan(buildTodayPlan(persona, notebookState));
    setExamCountdown(buildExamCountdown(persona));
    if (persona.streakDays > 0) {
      setStreak(persona.streakDays);
    }
  }, []);

  const doneTasks    = todayPlan.filter(t => t.done).length;
  const totalTasks   = Math.max(todayPlan.length, 1);
  const firstIncompleteTask = todayPlan.find(t => !t.done);

  const handleStart = () => {
    const destination = firstIncompleteTask?.subject === 'Mixed' ? '/practice' : '/learn';
    navigate(destination);
  };

  const greeting = getGreeting();

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-8 space-y-4">

      {/* ZONE 1: Context Strip */}
      <ContextStrip
        greeting={greeting}
        streak={streak}
        examCountdown={examCountdown}
      />

      {/* ZONE 2: The One Thing */}
      <NextTaskCard
        task={firstIncompleteTask}
        todayDone={doneTasks}
        todayTotal={totalTasks}
        onStart={handleStart}
      />

      {/* ZONE 3: Escape Hatches */}
      <EscapeHatches />

    </div>
  );
}
