/**
 * ProgressPage — Animated progress overview with mastery rings, count-up stats, and celebration state.
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiFetch } from '@/hooks/useApi';
import { useSession } from '@/hooks/useSession';
import { trackEvent } from '@/lib/analytics';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { CountUp } from '@/components/gate/CountUp';
import { Confetti } from '@/components/gate/Confetti';
import { ExamReadinessBreakdown } from '@/components/gate/ExamReadiness';
import { BarChart3, Clock, ChevronRight, PartyPopper, Target, Brain, Sparkles, Calendar, FileText, BookOpen } from 'lucide-react';
import { clsx } from 'clsx';

interface TopicStat {
  topic: string;
  totalProblems: number;
  correct: number;
  attempts: number;
  mastery: number;
  easiness: number;
  due: number;
}

interface WeakTopic {
  topic: string;
  mastery: number;
  easiness: number;
  due: number;
}

interface ProgressData {
  topics: TopicStat[];
  overall: {
    problems_attempted: string;
    total_correct: string;
    total_attempts: string;
    due_today: string;
  };
  weakTopics: WeakTopic[];
}

export default function ProgressPage() {
  const sessionId = useSession();
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllTopics, setShowAllTopics] = useState(false);

  useEffect(() => {
    trackEvent('page_view', { page: 'progress' });
    apiFetch<ProgressData>(`/api/progress/${sessionId}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-16 rounded-xl bg-surface-800/60 animate-pulse" />
      ))}
    </div>;
  }

  if (!data || data.topics.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16 space-y-4"
      >
        <BarChart3 size={48} className="text-surface-700 mx-auto" />
        <h2 className="text-xl font-bold text-surface-300">No progress yet</h2>
        <p className="text-sm text-surface-500">Start practicing to see your progress here.</p>
        <Link
          to="/"
          className="inline-block mt-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 text-white text-sm font-medium shadow-lg shadow-sky-500/25"
        >
          Start Practicing
        </Link>
      </motion.div>
    );
  }

  const overall = data.overall;
  const totalAttempts = parseInt(overall.total_attempts) || 0;
  const totalCorrect = parseInt(overall.total_correct) || 0;
  const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  const dueToday = parseInt(overall.due_today) || 0;
  const allCaughtUp = dueToday === 0;

  const weakSet = useMemo(() => new Set(data.weakTopics.map(w => w.topic)), [data.weakTopics]);
  const sortedTopics = useMemo(() => [...data.topics].sort((a, b) => a.mastery - b.mastery), [data.topics]);
  const WEAK_LIMIT = Math.max(weakSet.size, 3);
  const visibleTopics = showAllTopics ? sortedTopics : sortedTopics.slice(0, WEAK_LIMIT);
  const hasMoreTopics = sortedTopics.length > WEAK_LIMIT;

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      <Confetti trigger={allCaughtUp} />

      <motion.h1 variants={fadeInUp} className="text-xl font-bold text-surface-100">
        Your Progress
      </motion.h1>

      {/* Overall Stats — animated counters */}
      <motion.div variants={fadeInUp} className="grid grid-cols-3 gap-3">
        {[
          { label: 'Problems', value: parseInt(overall.problems_attempted) || 0, suffix: '' },
          { label: 'Accuracy', value: accuracy, suffix: '%' },
          { label: 'Due Today', value: dueToday, suffix: '' },
        ].map(stat => (
          <div key={stat.label} className="p-3 rounded-xl bg-surface-900 border border-surface-800 text-center">
            <CountUp
              target={stat.value}
              suffix={stat.suffix}
              className="text-lg font-bold text-surface-200"
            />
            <p className="text-xs text-surface-500">{stat.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Exam Readiness Breakdown */}
      <ExamReadinessBreakdown sessionId={sessionId} />

      {/* All Caught Up celebration */}
      {allCaughtUp && (
        <motion.div
          variants={fadeInUp}
          className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-sky-500/10 border border-emerald-500/25 text-center"
        >
          <PartyPopper size={24} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-emerald-300">You're all caught up!</p>
          <p className="text-xs text-surface-400 mt-0.5">Come back tomorrow for more reviews.</p>
        </motion.div>
      )}

      {/* Topics — sorted by mastery (weakest first), weak topics get amber accent */}
      <motion.div variants={fadeInUp} className="space-y-2">
        <h2 className="text-sm font-semibold text-surface-300">Topics</h2>
        <motion.div className="space-y-2" variants={staggerContainer}>
          {visibleTopics.map(topic => {
            const name = topic.topic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const masteryPct = Math.round(topic.mastery * 100);
            const isWeak = weakSet.has(topic.topic);

            let barColor = 'bg-red-500';
            if (masteryPct >= 70) barColor = 'bg-emerald-500';
            else if (masteryPct >= 40) barColor = 'bg-amber-500';

            return (
              <motion.div key={topic.topic} variants={fadeInUp}>
                <Link
                  to={`/topic/${topic.topic}`}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-xl transition-colors group',
                    isWeak
                      ? 'bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10'
                      : 'bg-surface-900 border border-surface-800 hover:border-surface-700',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-surface-200 truncate">{name}</span>
                      <span className="text-xs text-surface-500 shrink-0 ml-2">
                        {masteryPct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
                      <motion.div
                        className={clsx('h-full rounded-full', barColor)}
                        initial={{ width: 0 }}
                        animate={{ width: `${masteryPct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                      />
                    </div>
                    {topic.due > 0 && (
                      <span className="text-[10px] text-amber-500 mt-0.5 inline-flex items-center gap-1">
                        <Clock size={10} /> {topic.due} due
                      </span>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-surface-600 shrink-0 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all" />
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
        {hasMoreTopics && !showAllTopics && (
          <button
            onClick={() => setShowAllTopics(true)}
            aria-expanded={showAllTopics}
            className="w-full py-2 text-xs text-surface-400 hover:text-surface-300 transition-colors cursor-pointer touch-manipulation"
          >
            Show all {sortedTopics.length} topics
          </button>
        )}
      </motion.div>

      {/* GBrain Intelligence */}
      <motion.div variants={fadeInUp} className="space-y-2">
        <h2 className="text-sm font-semibold text-surface-300">GBrain Intelligence</h2>
        <Link
          to="/materials"
          className="flex items-center gap-3 p-3 rounded-xl bg-surface-900 border border-surface-800 hover:border-emerald-500/30 transition-colors group"
        >
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <BookOpen size={16} className="text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-surface-200">Your Materials</p>
            <p className="text-xs text-surface-500">Upload notes, textbooks — GBrain learns from them</p>
          </div>
          <ChevronRight size={14} className="text-surface-600 group-hover:text-emerald-400 transition-colors" />
        </Link>
        <Link
          to="/smart-practice"
          className="flex items-center gap-3 p-3 rounded-xl bg-surface-900 border border-surface-800 hover:border-sky-500/30 transition-colors group"
        >
          <div className="p-2 rounded-lg bg-sky-500/10">
            <Sparkles size={16} className="text-sky-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-surface-200">Smart Practice</p>
            <p className="text-xs text-surface-500">Four-tier cost-optimized delivery</p>
          </div>
          <ChevronRight size={14} className="text-surface-600 group-hover:text-sky-400 transition-colors" />
        </Link>
        <Link
          to="/audit"
          className="flex items-center gap-3 p-3 rounded-xl bg-surface-900 border border-surface-800 hover:border-emerald-500/30 transition-colors group"
        >
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <FileText size={16} className="text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-surface-200">Your Audit</p>
            <p className="text-xs text-surface-500">360° analysis: mastery, cognition, action plan</p>
          </div>
          <ChevronRight size={14} className="text-surface-600 group-hover:text-emerald-400 transition-colors" />
        </Link>
        <Link
          to="/digest"
          className="flex items-center gap-3 p-3 rounded-xl bg-surface-900 border border-surface-800 hover:border-purple-500/30 transition-colors group"
        >
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Calendar size={16} className="text-purple-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-surface-200">Weekly Digest</p>
            <p className="text-xs text-surface-500">This week's progress, growth proof, one action</p>
          </div>
          <ChevronRight size={14} className="text-surface-600 group-hover:text-purple-400 transition-colors" />
        </Link>
        <Link
          to="/mock-exam"
          className="flex items-center gap-3 p-3 rounded-xl bg-surface-900 border border-surface-800 hover:border-red-500/30 transition-colors group"
        >
          <div className="p-2 rounded-lg bg-red-500/10">
            <Sparkles size={16} className="text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-surface-200">Mock Exam</p>
            <p className="text-xs text-surface-500">Full-length, timed, GBrain-calibrated</p>
          </div>
          <ChevronRight size={14} className="text-surface-600 group-hover:text-red-400 transition-colors" />
        </Link>
        <Link
          to="/exam-strategy"
          className="flex items-center gap-3 p-3 rounded-xl bg-surface-900 border border-surface-800 hover:border-sky-500/30 transition-colors group"
        >
          <div className="p-2 rounded-lg bg-sky-500/10">
            <Target size={16} className="text-sky-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-surface-200">Exam Strategy</p>
            <p className="text-xs text-surface-500">Personalized playbook, time budgets, skip thresholds</p>
          </div>
          <ChevronRight size={14} className="text-surface-600 group-hover:text-sky-400 transition-colors" />
        </Link>
        <Link
          to="/error-patterns"
          className="flex items-center gap-3 p-3 rounded-xl bg-surface-900 border border-surface-800 hover:border-amber-500/30 transition-colors group"
        >
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Brain size={16} className="text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-surface-200">Error Patterns</p>
            <p className="text-xs text-surface-500">Weekly error digest, misconceptions, recommendations</p>
          </div>
          <ChevronRight size={14} className="text-surface-600 group-hover:text-amber-400 transition-colors" />
        </Link>
      </motion.div>
    </motion.div>
  );
}
