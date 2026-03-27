/**
 * ProgressPage — Animated progress overview with mastery rings, count-up stats, and celebration state.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiFetch } from '@/hooks/useApi';
import { useSession } from '@/hooks/useSession';
import { trackEvent } from '@/lib/analytics';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { MasteryRing } from '@/components/gate/MasteryRing';
import { CountUp } from '@/components/gate/CountUp';
import { Confetti } from '@/components/gate/Confetti';
import { BarChart3, TrendingDown, Clock, ChevronRight, Sparkles, PartyPopper } from 'lucide-react';
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

      {/* Weak Topics Alert */}
      {data.weakTopics.length > 0 && (
        <motion.div variants={fadeInUp} className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
            <TrendingDown size={16} />
            <span>Weak Topics</span>
          </div>
          {data.weakTopics.map(wt => {
            const name = wt.topic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            return (
              <Link
                key={wt.topic}
                to={`/topic/${wt.topic}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10 transition-colors group"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-surface-200">{name}</p>
                  <p className="text-xs text-surface-500">{Math.round(wt.mastery * 100)}% accuracy</p>
                </div>
                {wt.due > 0 && (
                  <span className="flex items-center gap-1 text-xs text-amber-400">
                    <Clock size={12} /> {wt.due} due
                  </span>
                )}
                <ChevronRight size={14} className="text-surface-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
              </Link>
            );
          })}
        </motion.div>
      )}

      {/* Topic Mastery — rings + animated bars */}
      <motion.div variants={fadeInUp} className="space-y-2">
        <h2 className="text-sm font-semibold text-surface-300">All Topics</h2>
        <motion.div className="space-y-2" variants={staggerContainer}>
          {data.topics.map(topic => {
            const name = topic.topic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const masteryPct = Math.round(topic.mastery * 100);

            let barColor = 'bg-red-500';
            if (masteryPct >= 70) barColor = 'bg-emerald-500';
            else if (masteryPct >= 40) barColor = 'bg-amber-500';

            return (
              <motion.div key={topic.topic} variants={fadeInUp}>
                <Link
                  to={`/topic/${topic.topic}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface-900 border border-surface-800 hover:border-surface-700 transition-colors group"
                >
                  <MasteryRing value={masteryPct} size={36} strokeWidth={2.5}>
                    <span className="text-[8px] font-bold text-surface-400">{masteryPct}%</span>
                  </MasteryRing>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-surface-200 truncate">{name}</span>
                      <span className="text-xs text-surface-500 shrink-0 ml-2">
                        {topic.correct}/{topic.attempts}
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
                      <span className="text-[10px] text-amber-500 mt-0.5 inline-block">{topic.due} due</span>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-surface-600 shrink-0 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all" />
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
