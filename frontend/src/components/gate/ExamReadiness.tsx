/**
 * ExamReadiness — Composite exam readiness score badge + breakdown.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Target, TrendingUp, Brain, AlertTriangle, Flame, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch } from '@/hooks/useApi';
import { fadeInUp } from '@/lib/animations';

interface ReadinessData {
  score: number;
  breakdown: {
    coverage: number;
    accuracy: number;
    srHealth: number;
    weakSpots: number;
    consistency: number;
  };
  daysLeft: number;
  topicsAttempted: number;
  weakTopicCount: number;
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 1000;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      setDisplay(Math.round(value * progress));
      if (progress < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [value]);
  return <>{display}</>;
}

const BREAKDOWN_ITEMS = [
  { key: 'coverage', label: 'Topic Coverage', icon: Target, color: 'emerald' },
  { key: 'accuracy', label: 'Accuracy', icon: TrendingUp, color: 'sky' },
  { key: 'srHealth', label: 'Review Health', icon: Brain, color: 'amber' },
  { key: 'weakSpots', label: 'Weak Spots', icon: AlertTriangle, color: 'emerald' },
  { key: 'consistency', label: 'Consistency', icon: Flame, color: 'amber' },
] as const;

/** Compact badge for GateHome hero */
export function ExamReadinessBadge({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<ReadinessData | null>(null);

  useEffect(() => {
    apiFetch<ReadinessData>(`/api/exam-readiness/${sessionId}`).then(setData).catch(() => {});
  }, [sessionId]);

  if (!data) return null;

  const scoreColor = data.score >= 70 ? 'text-emerald-400' : data.score >= 40 ? 'text-amber-400' : 'text-red-400';
  const borderColor = data.score >= 70 ? 'border-emerald-500/30' : data.score >= 40 ? 'border-amber-500/30' : 'border-red-500/30';
  const bgColor = data.score >= 70 ? 'bg-emerald-500/10' : data.score >= 40 ? 'bg-amber-500/10' : 'bg-red-500/10';

  return (
    <motion.div variants={fadeInUp} className={`flex items-center justify-between p-4 rounded-xl border ${borderColor} ${bgColor}`}>
      <div className="flex items-center gap-3">
        <div className="relative w-14 h-14">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-surface-800" />
            <circle
              cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4"
              strokeDasharray={`${(data.score / 100) * 150.8} 150.8`}
              strokeLinecap="round"
              className={scoreColor}
            />
          </svg>
          <span className={`absolute inset-0 flex items-center justify-center text-sm font-black ${scoreColor}`}>
            <AnimatedNumber value={data.score} />
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Exam Readiness</p>
          <p className="text-xs text-surface-400">{data.topicsAttempted}/10 topics started</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-surface-300">{data.daysLeft}</p>
        <p className="text-xs text-surface-500">days left</p>
      </div>
    </motion.div>
  );
}

/** Expanded breakdown for ProgressPage */
export function ExamReadinessBreakdown({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<ReadinessData | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    apiFetch<ReadinessData>(`/api/exam-readiness/${sessionId}`).then(setData).catch(() => {});
  }, [sessionId]);

  if (!data) return null;

  const scoreColor = data.score >= 70 ? 'text-emerald-400' : data.score >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <motion.div variants={fadeInUp} className="bg-surface-900 border border-surface-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-surface-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-black ${scoreColor}`}>{data.score}%</span>
          <span className="text-sm font-medium text-surface-300">Exam Readiness Score</span>
        </div>
        {expanded ? <ChevronUp size={18} className="text-surface-500" /> : <ChevronDown size={18} className="text-surface-500" />}
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="px-4 pb-4 space-y-3"
        >
          {BREAKDOWN_ITEMS.map(({ key, label, icon: Icon, color }) => {
            const value = data.breakdown[key];
            const barColor = color === 'emerald' ? 'bg-emerald-500' : color === 'sky' ? 'bg-sky-500' : 'bg-amber-500';
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className="text-surface-400" />
                    <span className="text-xs text-surface-400">{label}</span>
                  </div>
                  <span className="text-xs font-semibold text-surface-300">{value}%</span>
                </div>
                <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-full rounded-full ${barColor}`}
                  />
                </div>
              </div>
            );
          })}
          {data.weakTopicCount > 0 && (
            <p className="text-xs text-amber-400 mt-2">
              {data.weakTopicCount} weak topic{data.weakTopicCount > 1 ? 's' : ''} need attention
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
