/**
 * ExamStrategyPage — Personalized exam playbook powered by GBrain.
 *
 * Shows: attempt sequence, time budget, skip threshold, score projections,
 * strategic notes, and score maximization study plan.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '@/hooks/useApi';
import { useSession } from '@/hooks/useSession';
import { trackEvent } from '@/lib/analytics';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { CountUp } from '@/components/gate/CountUp';
import {
  Target, Clock, TrendingUp, AlertTriangle, ChevronRight,
  BarChart3, Zap, Shield, ArrowUpRight,
} from 'lucide-react';
import { clsx } from 'clsx';

interface AttemptEntry {
  topic: string;
  label: string;
  reason: string;
  expected_accuracy: number;
  avg_time_per_question_sec: number;
}

interface Playbook {
  exam: string;
  attempt_sequence: AttemptEntry[];
  time_budget: Record<string, number>;
  skip_threshold: number;
  expected_score: { optimistic: number; realistic: number; conservative: number };
  strategic_notes: string[];
}

interface ScoreAllocation {
  topic: string;
  label: string;
  current_mastery: number;
  target_mastery: number;
  expected_marks_gain: number;
  hours_needed: number;
  priority_rank: number;
}

interface ScorePlan {
  allocations: ScoreAllocation[];
  total_expected_improvement: number;
  days_until_exam: number;
  daily_hours_needed: number;
}

export default function ExamStrategyPage() {
  const sessionId = useSession();
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [scorePlan, setScorePlan] = useState<ScorePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'playbook' | 'study-plan'>('playbook');

  useEffect(() => {
    trackEvent('page_view', { page: 'exam-strategy' });

    Promise.all([
      apiFetch<{ playbook: Playbook }>(`/api/gbrain/exam-strategy/${sessionId}`),
      apiFetch<{ plan: ScorePlan }>(`/api/gbrain/score-plan/${sessionId}?days=90&hours=15`),
    ])
      .then(([pb, sp]) => {
        setPlaybook(pb.playbook);
        setScorePlan(sp.plan);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-surface-800/60 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!playbook) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16 space-y-4">
        <Target size={48} className="text-surface-700 mx-auto" />
        <h2 className="text-xl font-bold text-surface-300">No strategy yet</h2>
        <p className="text-sm text-surface-500">Practice more problems so GBrain can learn your strengths and weaknesses.</p>
      </motion.div>
    );
  }

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={staggerContainer}>
      <motion.div variants={fadeInUp}>
        <h1 className="text-xl font-bold text-surface-100">Exam Strategy</h1>
        <p className="text-xs text-surface-500 mt-1">{playbook.exam} — personalized for your profile</p>
      </motion.div>

      {/* Score Projections */}
      <motion.div variants={fadeInUp} className="grid grid-cols-3 gap-3">
        {[
          { label: 'Conservative', value: playbook.expected_score.conservative, color: 'text-red-400' },
          { label: 'Realistic', value: playbook.expected_score.realistic, color: 'text-amber-400' },
          { label: 'Optimistic', value: playbook.expected_score.optimistic, color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl bg-surface-900 border border-surface-800 text-center">
            <CountUp target={s.value} className={clsx('text-lg font-bold', s.color)} />
            <p className="text-xs text-surface-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Skip Threshold */}
      <motion.div variants={fadeInUp} className="p-4 rounded-xl bg-surface-900 border border-surface-800">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={14} className="text-amber-400" />
          <span className="text-sm font-semibold text-surface-200">Skip Threshold</span>
        </div>
        <p className="text-sm text-surface-400">
          With negative marking, skip questions when confidence is below{' '}
          <span className="text-amber-300 font-bold">{Math.round(playbook.skip_threshold * 100)}%</span>.
          This is calibrated to your accuracy-vs-confidence data.
        </p>
      </motion.div>

      {/* Tab Switcher */}
      <motion.div variants={fadeInUp} className="flex gap-1 p-1 rounded-xl bg-surface-900 border border-surface-800">
        {[
          { id: 'playbook' as const, label: 'Attempt Order', icon: Zap },
          { id: 'study-plan' as const, label: 'Study Plan', icon: TrendingUp },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              activeTab === tab.id
                ? 'bg-surface-800 text-surface-100 shadow-sm'
                : 'text-surface-500 hover:text-surface-400',
            )}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </motion.div>

      {/* Playbook Tab */}
      {activeTab === 'playbook' && (
        <motion.div className="space-y-2" variants={staggerContainer} initial="hidden" animate="visible">
          <motion.p variants={fadeInUp} className="text-xs text-surface-500 px-1">
            Attempt topics in this order for maximum marks per minute
          </motion.p>

          {playbook.attempt_sequence.map((entry, i) => {
            const accPct = Math.round(entry.expected_accuracy * 100);
            const timeMins = playbook.time_budget[entry.topic] || 0;

            let accColor = 'text-red-400';
            if (accPct >= 70) accColor = 'text-emerald-400';
            else if (accPct >= 40) accColor = 'text-amber-400';

            return (
              <motion.div
                key={entry.topic}
                variants={fadeInUp}
                className="flex items-center gap-3 p-3 rounded-xl bg-surface-900 border border-surface-800"
              >
                {/* Rank */}
                <div className={clsx(
                  'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                  i < 3 ? 'bg-emerald-500/15 text-emerald-400' : i < 6 ? 'bg-amber-500/10 text-amber-400' : 'bg-surface-800 text-surface-500',
                )}>
                  {i + 1}
                </div>

                {/* Topic Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-200 truncate">{entry.label}</p>
                  <p className="text-xs text-surface-500 mt-0.5 truncate">{entry.reason}</p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 shrink-0 text-right">
                  <div>
                    <p className={clsx('text-sm font-bold', accColor)}>{accPct}%</p>
                    <p className="text-[10px] text-surface-600">accuracy</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-surface-300">{timeMins}m</p>
                    <p className="text-[10px] text-surface-600">budget</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Study Plan Tab */}
      {activeTab === 'study-plan' && scorePlan && (
        <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" animate="visible">
          {/* Summary Cards */}
          <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-surface-900 border border-surface-800 text-center">
              <CountUp target={Math.round(scorePlan.total_expected_improvement)} suffix=" marks" className="text-lg font-bold text-emerald-400" />
              <p className="text-xs text-surface-500">expected gain</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-900 border border-surface-800 text-center">
              <CountUp target={scorePlan.daily_hours_needed} decimals={1} suffix=" hrs/day" className="text-lg font-bold text-sky-400" />
              <p className="text-xs text-surface-500">study needed</p>
            </div>
          </motion.div>

          <motion.p variants={fadeInUp} className="text-xs text-surface-500 px-1">
            Topics ranked by marks gained per hour of study
          </motion.p>

          {/* Allocation List */}
          {scorePlan.allocations.map((alloc) => {
            const currentPct = Math.round(alloc.current_mastery * 100);
            const targetPct = Math.round(alloc.target_mastery * 100);

            return (
              <motion.div
                key={alloc.topic}
                variants={fadeInUp}
                className="p-3 rounded-xl bg-surface-900 border border-surface-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      'w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold',
                      alloc.priority_rank <= 3 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-surface-800 text-surface-500',
                    )}>
                      {alloc.priority_rank}
                    </span>
                    <span className="text-sm font-medium text-surface-200">{alloc.label}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-emerald-400 font-bold">+{alloc.expected_marks_gain}</span>
                    <span className="text-surface-600">marks</span>
                  </div>
                </div>

                {/* Mastery Progress Bar */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-surface-500 w-8">{currentPct}%</span>
                  <div className="flex-1 h-2 rounded-full bg-surface-800 overflow-hidden relative">
                    <motion.div
                      className="h-full rounded-full bg-sky-500/60"
                      initial={{ width: 0 }}
                      animate={{ width: `${currentPct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                    <div
                      className="absolute top-0 h-full border-r-2 border-dashed border-emerald-400/50"
                      style={{ left: `${targetPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-emerald-500 w-8">{targetPct}%</span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-surface-500">
                  <span>~{alloc.hours_needed} hours needed</span>
                  <span className="flex items-center gap-0.5">
                    <ArrowUpRight size={10} className="text-emerald-400" />
                    {currentPct}% → {targetPct}%
                  </span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Strategic Notes */}
      {playbook.strategic_notes.length > 0 && (
        <motion.div variants={fadeInUp} className="space-y-2">
          <h2 className="text-sm font-semibold text-surface-300 flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-amber-400" />
            Strategic Notes
          </h2>
          {playbook.strategic_notes.map((note, i) => (
            <div key={i} className="p-3 rounded-xl bg-surface-900 border border-surface-800">
              <p className="text-sm text-surface-400 leading-relaxed">{note}</p>
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
