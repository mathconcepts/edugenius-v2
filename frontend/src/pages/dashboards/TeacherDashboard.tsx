/**
 * TeacherDashboard — Frugal, action-oriented
 * Focus: Know your students, act fast, AI is one click away
 * No noise — just students, classes, and AI help
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, MessageSquare, AlertCircle, TrendingUp,
  ChevronRight, Plus, Clock, CheckCircle2
} from 'lucide-react';
import { clsx } from 'clsx';
import { AITriagePanel, QuickQuestionGen, TeachingEffectivenessCard } from '@/components/ux/UXEnhancements';

// ── Mock data ────────────────────────────────────────────────────────────────

const students = [
  { id: '1', name: 'Arjun Sharma', progress: 85, status: 'on-track' as const, lastSeen: '2h ago', topic: 'Quadratic Equations' },
  { id: '2', name: 'Priya Patel', progress: 52, status: 'struggling' as const, lastSeen: '1d ago', topic: 'Chemical Bonding' },
  { id: '3', name: 'Rahul Kumar', progress: 91, status: 'on-track' as const, lastSeen: '30m ago', topic: 'Newton\'s Laws' },
  { id: '4', name: 'Sneha Gupta', progress: 38, status: 'needs-attention' as const, lastSeen: '3d ago', topic: 'Trigonometry' },
  { id: '5', name: 'Vikram Singh', progress: 74, status: 'on-track' as const, lastSeen: '5h ago', topic: 'Organic Chemistry' },
];

const todayClasses = [
  { id: '1', name: 'Math 10A', time: '10:00 AM', topic: 'Trigonometry', students: 32, status: 'upcoming' as const },
  { id: '2', name: 'Physics 11B', time: '2:00 PM', topic: 'Mechanics', students: 28, status: 'upcoming' as const },
];

type StudentStatus = 'on-track' | 'needs-attention' | 'struggling';

const statusConfig: Record<StudentStatus, { label: string; color: string; dot: string }> = {
  'on-track': { label: 'On track', color: 'text-green-400', dot: 'bg-green-400' },
  'needs-attention': { label: 'Needs attention', color: 'text-amber-400', dot: 'bg-amber-400' },
  'struggling': { label: 'Struggling', color: 'text-red-400', dot: 'bg-red-400' },
};

// ── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ icon: Icon, value, label, color }: {
  icon: React.ElementType; value: string | number; label: string; color: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-1.5 sm:gap-3 p-3 sm:p-4 rounded-xl bg-surface-800/50 text-center sm:text-left">
      <div className={clsx('p-1.5 sm:p-2 rounded-lg shrink-0', color)}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
      <div>
        <p className="text-lg sm:text-xl font-bold">{value}</p>
        <p className="text-[10px] sm:text-xs text-surface-400 leading-tight">{label}</p>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function TeacherDashboard() {
  const [filter, setFilter] = useState<'all' | StudentStatus>('all');

  const needsAttention = students.filter(s => s.status !== 'on-track').length;
  const avgProgress = Math.round(students.reduce((s, st) => s + st.progress, 0) / students.length);
  const filtered = (filter === 'all' ? students : students.filter(s => s.status === filter))
    .sort((a, b) => {
      const urgency: Record<StudentStatus, number> = { 'struggling': 0, 'needs-attention': 1, 'on-track': 2 };
      return urgency[a.status] - urgency[b.status];
    });

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-4 md:pb-8">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-lg md:text-xl font-bold">Good morning! 👋</h1>
          <p className="text-surface-400 text-xs md:text-sm mt-0.5">
            {needsAttention > 0
              ? `${needsAttention} student${needsAttention > 1 ? 's' : ''} need your attention today`
              : 'All students are on track — great work!'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/content?type=quiz" className="btn-primary flex items-center gap-1.5 text-xs px-3 py-2">
            <Plus className="w-3.5 h-3.5" /> Quiz
          </Link>
          <Link to="/chat?q=explain%20a%20concept%20for%20my%20class" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-surface-700 hover:bg-surface-600 text-white transition-colors">
            <MessageSquare className="w-3.5 h-3.5" /> Explain
          </Link>
        </div>
      </motion.div>

      {/* ── Action Required card ── */}
      {needsAttention > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20"
        >
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">{needsAttention} student{needsAttention > 1 ? 's' : ''} need immediate attention</p>
            <p className="text-xs text-amber-400/70">Sorted to top of your list below</p>
          </div>
          <Link to="/chat?q=which+students+need+the+most+help+today" className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors flex-shrink-0">Ask AI</Link>
        </motion.div>
      )}

      {/* ── Stats strip ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-3 gap-2 md:gap-3"
      >
        <StatChip icon={Users} value={students.length} label="My Students" color="bg-primary-500/20 text-primary-400" />
        <StatChip icon={TrendingUp} value={`${avgProgress}%`} label="Avg Progress" color="bg-green-500/20 text-green-400" />
        <StatChip icon={AlertCircle} value={needsAttention} label="Need Help" color="bg-amber-500/20 text-amber-400" />
      </motion.div>

      {/* ── AI Triage Panel ── */}
      <AITriagePanel />

      {/* ── Main grid: students + sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Students list (takes 2/3 width on large screens) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 card"
        >
          {/* List header + filter pills */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Students</h2>
            <div className="flex gap-1">
              {(['all', 'needs-attention', 'struggling'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                    filter === f
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'text-surface-400 hover:text-white hover:bg-surface-700'
                  )}
                >
                  {f === 'all' ? 'All' : f === 'needs-attention' ? 'Attention' : 'Struggling'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filtered.map(student => {
              const sc = statusConfig[student.status];
              return (
                <div
                  key={student.id}
                  className="flex items-center gap-4 p-3.5 rounded-xl bg-surface-800/40 hover:bg-surface-800/80 transition-colors cursor-pointer group"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                    {student.name.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{student.name}</p>
                      <span className={clsx('flex items-center gap-1 text-xs', sc.color)}>
                        <span className={clsx('w-1.5 h-1.5 rounded-full', sc.dot)} />
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-xs text-surface-500 truncate">
                      Working on: {student.topic} · {student.lastSeen}
                    </p>
                  </div>

                  {/* Progress */}
                  <div className="text-right flex-shrink-0">
                    <p className={clsx('font-bold text-sm', student.progress >= 75 ? 'text-green-400' : student.progress >= 50 ? 'text-amber-400' : 'text-red-400')}>
                      {student.progress}%
                    </p>
                    <div className="w-16 h-1.5 bg-surface-700 rounded-full mt-1">
                      <div
                        className={clsx('h-full rounded-full', student.progress >= 75 ? 'bg-green-500' : student.progress >= 50 ? 'bg-amber-500' : 'bg-red-500')}
                        style={{ width: `${student.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Action — always visible on mobile, hover-only on desktop */}
                  <Link
                    to={`/chat?context=${encodeURIComponent(student.name + ' is ' + student.status.replace('-', ' ') + ' on ' + student.topic + ' with ' + student.progress + '% progress')}`}
                    onClick={e => e.stopPropagation()}
                    title={`Chat with AI about ${student.name}`}
                    className="md:opacity-0 md:group-hover:opacity-100 p-2.5 md:p-2 rounded-lg bg-primary-500/10 hover:bg-primary-500/20 active:scale-95 transition-all flex-shrink-0"
                  >
                    <MessageSquare className="w-4 h-4 text-primary-400" />
                  </Link>
                </div>
              );
            })}
          </div>

          <Link to="/students" className="mt-4 flex items-center justify-center gap-1 text-sm text-surface-400 hover:text-white transition-colors py-2">
            View all students <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>

        {/* Sidebar: today's classes + AI help */}
        <div className="space-y-4">

          {/* Today's classes */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="card"
          >
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-surface-400" />
              <h2 className="font-semibold text-sm">Today's Classes</h2>
            </div>
            <div className="space-y-2.5">
              {todayClasses.map(cls => (
                <div key={cls.id} className="p-3 rounded-xl bg-surface-800/50 hover:bg-surface-800 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{cls.name}</p>
                    <span className="text-xs text-primary-400 font-medium">{cls.time}</span>
                  </div>
                  <p className="text-xs text-surface-400 mt-0.5">{cls.topic} · {cls.students} students</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* AI Help — single focused CTA */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card bg-gradient-to-br from-primary-500/10 to-accent-500/10 border border-primary-500/20"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <span className="text-2xl">🎓</span>
              <div>
                <h2 className="font-semibold text-sm">AI Assistant</h2>
                <p className="text-xs text-surface-400">Lesson plans, analysis, question banks</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                'Create a quiz for Class 10A',
                'Who needs help with Physics?',
                'Generate practice problems',
              ].map((prompt, i) => (
                <Link
                  key={i}
                  to={`/chat?q=${encodeURIComponent(prompt)}`}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-surface-800/60 hover:bg-surface-800 text-xs text-surface-300 hover:text-white transition-colors text-left"
                >
                  <span className="text-accent-400">›</span>
                  {prompt}
                </Link>
              ))}
            </div>
            <Link to="/chat" className="mt-3 btn-primary w-full text-center block text-sm py-2">
              Open AI Chat
            </Link>
          </motion.div>

          {/* Quick wins */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="card"
          >
            <h2 className="font-semibold text-sm mb-3">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { to: '/students', icon: Users, label: 'View all students' },
                { to: '/content', icon: CheckCircle2, label: 'Create a lesson' },
                { to: '/analytics', icon: TrendingUp, label: 'Progress reports' },
              ].map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-800/60 text-surface-300 hover:text-white transition-colors"
                >
                  <item.icon className="w-4 h-4 text-surface-500" />
                  <span className="text-sm">{item.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-surface-600 ml-auto" />
                </Link>
              ))}
            </div>
          </motion.div>

          {/* ── Quick Question Generator ── */}
          <QuickQuestionGen />

          {/* ── Teaching Effectiveness ── */}
          <TeachingEffectivenessCard />
        </div>
      </div>
    </div>
  );
}
