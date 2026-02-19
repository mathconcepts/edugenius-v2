/**
 * StudentDashboard — Frugal, motivating, Khanmigo-inspired
 * Focus: What to do today + quick access to chat
 * No agent noise, no clutter — just learning momentum
 */
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Flame, Target, Trophy, Play, CheckCircle2, Sparkles, BarChart3, Send, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { AIStudyCoach, ExamReadinessScore, PeerActivity } from '@/components/ux/UXEnhancements';

// ── Mock data (real data comes from backend) ────────────────────────────────

const todayPlan = [
  { id: '1', title: 'Quadratic Equations', subject: 'Mathematics', duration: '20 min', done: true },
  { id: '2', title: 'Newton\'s Second Law', subject: 'Physics', duration: '25 min', done: false },
  { id: '3', title: 'Organic Chemistry Basics', subject: 'Chemistry', duration: '20 min', done: false },
];

const examCountdown = { exam: 'JEE Main', daysLeft: 47 };

const weekProgress = [40, 65, 50, 80, 70, 30, 60]; // Mon-Sun, percentage

// ── Tiny streak flame ───────────────────────────────────────────────────────

function StreakPill({ streak }: { streak: number }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full">
      <Flame className="w-4 h-4 text-orange-400" />
      <span className="text-sm font-semibold text-orange-300">{streak} day streak</span>
    </div>
  );
}

// ── Week progress bar (7 dots) ───────────────────────────────────────────────

function WeekBar({ data }: { data: number[] }) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date().getDay(); // 0=Sun
  const todayIdx = today === 0 ? 6 : today - 1;

  return (
    <div className="flex items-end gap-1.5">
      {data.map((pct, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className="w-6 bg-surface-800 rounded-sm overflow-hidden" style={{ height: 32 }}>
            <div
              className={clsx(
                'w-full rounded-sm transition-all',
                i === todayIdx ? 'bg-primary-500' : pct > 0 ? 'bg-primary-500/40' : 'bg-surface-700'
              )}
              style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
            />
          </div>
          <span className={clsx('text-[10px]', i === todayIdx ? 'text-primary-400 font-bold' : 'text-surface-600')}>{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function StudentDashboard() {
  const navigate = useNavigate();
  const [streak] = useState(12);
  const [doubtInput, setDoubtInput] = useState('');
  const [celebrating, setCelebrating] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doneTasks = todayPlan.filter(t => t.done).length;
  const totalTasks = todayPlan.length;
  const todayPct = Math.round((doneTasks / totalTasks) * 100);

  // First incomplete task gets the "Continue" CTA
  const firstIncompleteTask = todayPlan.find(t => !t.done);

  // Auto-clear celebration after 1.5s
  useEffect(() => {
    if (celebrating) {
      const t = setTimeout(() => setCelebrating(null), 1500);
      return () => clearTimeout(t);
    }
  }, [celebrating]);

  const handleDoubtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = doubtInput.trim();
    if (!q) return;
    navigate(`/chat?q=${encodeURIComponent(q)}`);
  };

  const handleTaskPlay = (taskId: string) => {
    setCelebrating(taskId);
    navigate('/learn');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-4 md:pb-8">

      {/* ── Top row: greeting + streak ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-lg md:text-xl font-bold">Good morning! 👋</h1>
          <p className="text-surface-400 text-xs md:text-sm mt-0.5">
            {examCountdown.daysLeft} days to {examCountdown.exam} · Let's make today count
          </p>
        </div>
        {/* Streak hidden on mobile (shown in top bar) */}
        <div className="hidden md:block">
          <StreakPill streak={streak} />
        </div>
        {/* Compact countdown pill on mobile */}
        <div className="flex md:hidden items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold text-amber-300">{examCountdown.daysLeft}d</span>
        </div>
      </motion.div>

      {/* ── AI Study Coach ── */}
      <AIStudyCoach />

      {/* ── Hero CTA: Instant Doubt Bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="p-5 rounded-2xl bg-gradient-to-r from-primary-600/30 via-primary-500/20 to-accent-500/20 border border-primary-500/30"
      >
        <form onSubmit={handleDoubtSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={doubtInput}
            onChange={e => setDoubtInput(e.target.value)}
            placeholder="Ask any doubt... e.g. 'explain Newton's 3rd law'"
            className="flex-1 bg-surface-900/60 border border-surface-700/60 rounded-xl px-4 py-2.5 text-sm placeholder-surface-500 text-white focus:outline-none focus:border-primary-500/70 transition-colors"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-400 active:scale-95 text-white text-sm font-semibold transition-all"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>

        {/* Quick-tap chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/chat?mode=image')}
            className="text-xs px-3 py-1.5 bg-surface-800/70 hover:bg-surface-700 active:scale-95 rounded-full text-surface-300 hover:text-white transition-all"
          >
            📸 Snap a problem
          </button>
          <button
            onClick={() => navigate('/chat?mode=voice')}
            className="text-xs px-3 py-1.5 bg-surface-800/70 hover:bg-surface-700 active:scale-95 rounded-full text-surface-300 hover:text-white transition-all"
          >
            🎤 Voice
          </button>
          <button
            onClick={() => navigate('/practice')}
            className="text-xs px-3 py-1.5 bg-surface-800/70 hover:bg-surface-700 active:scale-95 rounded-full text-surface-300 hover:text-white transition-all"
          >
            📝 Practice MCQ
          </button>
        </div>
      </motion.div>

      {/* ── Two-column: today's plan + weekly progress ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Today's plan */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary-400" />
              <h2 className="font-semibold text-sm">Today's Plan</h2>
            </div>
            <span className="text-xs text-surface-500">{doneTasks}/{totalTasks} done</span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-surface-700 rounded-full mb-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-500"
              style={{ width: `${todayPct}%` }}
            />
          </div>

          <div className="space-y-2.5">
            {todayPlan.map(task => {
              const isCelebrating = celebrating === task.id;
              const isFirstIncomplete = !task.done && task.id === firstIncompleteTask?.id;
              return (
                <div key={task.id} className={clsx(
                  'flex items-center gap-3 p-2.5 rounded-xl transition-colors relative',
                  task.done ? 'opacity-50' : 'hover:bg-surface-800/60 cursor-pointer',
                  isCelebrating ? 'bg-green-500/10' : ''
                )}>
                  {/* Celebration overlay */}
                  {isCelebrating && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl pointer-events-none z-10">
                      <span className="text-sm font-bold text-green-300 animate-bounce">✅ Done! 🔥 +1 streak</span>
                    </div>
                  )}
                  <div className={clsx(
                    'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                    task.done || isCelebrating ? 'bg-green-500' : 'border-2 border-surface-600'
                  )}>
                    {(task.done || isCelebrating) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-sm font-medium truncate', task.done && 'line-through')}>{task.title}</p>
                    <p className="text-xs text-surface-500">{task.subject} · {task.duration}</p>
                  </div>
                  {!task.done && (
                    isFirstIncomplete ? (
                      /* "Continue" button with green pulsing ring on first incomplete task */
                      <button
                        onClick={() => handleTaskPlay(task.id)}
                        className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-semibold transition-all active:scale-95"
                      >
                        {/* Pulsing ring */}
                        <span className="absolute inset-0 rounded-lg ring-2 ring-green-400/60 animate-ping pointer-events-none" />
                        <ArrowRight className="w-3.5 h-3.5" />
                        Continue
                      </button>
                    ) : (
                      <button
                        onClick={() => handleTaskPlay(task.id)}
                        className="p-1.5 rounded-lg bg-primary-500/10 hover:bg-primary-500/20 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5 text-primary-400" />
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Weekly activity + exam countdown */}
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="card"
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-accent-400" />
              <h2 className="font-semibold text-sm">This Week</h2>
            </div>
            <WeekBar data={weekProgress} />
            <p className="text-xs text-surface-500 mt-3">5 of 7 days active · Great work!</p>
          </motion.div>

          {/* Exam countdown card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20"
          >
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h2 className="font-semibold text-sm text-amber-300">{examCountdown.exam}</h2>
            </div>
            <p className="text-3xl font-bold text-amber-200">{examCountdown.daysLeft}</p>
            <p className="text-xs text-amber-400/70">days remaining</p>
            <Link to="/insights" className="mt-3 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
              View topper strategies <ArrowRight className="w-3 h-3" />
            </Link>
          </motion.div>

          {/* ── Exam Readiness Score ── */}
          <ExamReadinessScore />
        </div>
      </div>

      {/* ── Bottom row: quick access links — Practice FIRST ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="grid grid-cols-2 sm:grid-cols-3 gap-3"
      >
        {[
          { to: '/practice', icon: Target,     label: 'Practice', color: 'text-red-400',    bg: 'bg-red-500/10' },
          { to: '/learn',    icon: BookOpen,   label: 'Study',    color: 'text-blue-400',   bg: 'bg-blue-500/10' },
          { to: '/notebook', icon: '📓',       label: 'Notebook', color: 'text-green-400',  bg: 'bg-green-500/10' },
          { to: '/progress', icon: BarChart3,  label: 'Progress', color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { to: '/insights', icon: Trophy,     label: 'Exam Tips',color: 'text-amber-400',  bg: 'bg-amber-500/10' },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-800/50 hover:bg-surface-800 active:scale-95 transition-all text-center group"
          >
            <div className={clsx('p-3 rounded-xl', item.bg)}>
              {typeof item.icon === 'string' ? (
                <span className="text-2xl">{item.icon}</span>
              ) : (
                <item.icon className={clsx('w-6 h-6', item.color)} />
              )}
            </div>
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}
      </motion.div>

      {/* ── Peer Activity ── */}
      <PeerActivity />
    </div>
  );
}
