/**
 * StudentDashboard — Frugal, motivating, Khanmigo-inspired
 * Focus: What to do today + quick access to chat
 * No agent noise, no clutter — just learning momentum
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, BookOpen, Flame, Target, Trophy, ChevronRight, Play, CheckCircle2, Sparkles, BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';
import { AIStudyCoach, ExamReadinessScore, PeerActivity } from '@/components/ux/UXEnhancements';

// ── Mock data (real data comes from backend) ────────────────────────────────

const todayPlan = [
  { id: '1', title: 'Quadratic Equations', subject: 'Mathematics', duration: '20 min', done: true },
  { id: '2', title: 'Newton\'s Second Law', subject: 'Physics', duration: '25 min', done: false },
  { id: '3', title: 'Organic Chemistry Basics', subject: 'Chemistry', duration: '20 min', done: false },
];

const recentChats = [
  { id: '1', preview: 'Explain integration by parts', time: '2h ago' },
  { id: '2', preview: 'Why does NaCl dissolve in water?', time: 'Yesterday' },
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
  const [streak] = useState(12);
  const doneTasks = todayPlan.filter(t => t.done).length;
  const totalTasks = todayPlan.length;
  const todayPct = Math.round((doneTasks / totalTasks) * 100);

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

      {/* ── Hero CTA: Ask a question ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Link
          to="/chat"
          className="block group p-5 rounded-2xl bg-gradient-to-r from-primary-600/30 via-primary-500/20 to-accent-500/20 border border-primary-500/30 hover:border-primary-400/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary-500/20 group-hover:bg-primary-500/30 transition-colors">
                <MessageSquare className="w-6 h-6 text-primary-400" />
              </div>
              <div>
                <p className="font-semibold">Ask your AI tutor</p>
                <p className="text-sm text-surface-400">Type, speak, or snap a photo of your problem</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-surface-400 group-hover:text-primary-400 transition-colors group-hover:translate-x-1 transform" />
          </div>

          {/* Recent questions as quick-tap chips */}
          {recentChats.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-xs text-surface-500 self-center">Recent:</span>
              {recentChats.map(c => (
                <span key={c.id} className="text-xs px-2.5 py-1 bg-surface-800/80 rounded-full text-surface-300 hover:text-white cursor-pointer transition-colors truncate max-w-[180px]">
                  {c.preview}
                </span>
              ))}
            </div>
          )}
        </Link>
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
            {todayPlan.map(task => (
              <div key={task.id} className={clsx(
                'flex items-center gap-3 p-2.5 rounded-xl transition-colors',
                task.done ? 'opacity-50' : 'hover:bg-surface-800/60 cursor-pointer'
              )}>
                <div className={clsx(
                  'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                  task.done ? 'bg-green-500' : 'border-2 border-surface-600'
                )}>
                  {task.done && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={clsx('text-sm font-medium truncate', task.done && 'line-through')}>{task.title}</p>
                  <p className="text-xs text-surface-500">{task.subject} · {task.duration}</p>
                </div>
                {!task.done && (
                  <Link to="/learn" className="p-1.5 rounded-lg bg-primary-500/10 hover:bg-primary-500/20 transition-colors">
                    <Play className="w-3.5 h-3.5 text-primary-400" />
                  </Link>
                )}
              </div>
            ))}
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
              View topper strategies <ChevronRight className="w-3 h-3" />
            </Link>
          </motion.div>

          {/* ── Exam Readiness Score ── */}
          <ExamReadinessScore />
        </div>
      </div>

      {/* ── Bottom row: quick access links ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="grid grid-cols-2 sm:grid-cols-3 gap-3"
      >
        {[
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
