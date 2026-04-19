/**
 * ErrorPatternsPage — GBrain error pattern report.
 * Shows error type breakdown, trends, top misconceptions, and actionable recommendations.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '@/hooks/useApi';
import { useSession } from '@/hooks/useSession';
import { trackEvent } from '@/lib/analytics';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { CountUp } from '@/components/gate/CountUp';
import {
  Brain, TrendingDown, TrendingUp, Minus, AlertTriangle, Lightbulb,
  Target, GitBranch, Calculator, Clock, Eye, SkipForward,
} from 'lucide-react';
import { clsx } from 'clsx';

interface ErrorReport {
  session_id: string;
  total_errors: number;
  by_type: Record<string, number>;
  by_concept: Record<string, number>;
  top_misconceptions: Array<{ id: string; count: number; description: string }>;
  trend: 'improving' | 'stable' | 'declining';
  recommendations: string[];
}

const ERROR_ICONS: Record<string, typeof Brain> = {
  conceptual: Brain,
  procedural: GitBranch,
  notation: Eye,
  misread: AlertTriangle,
  time_pressure: Clock,
  arithmetic: Calculator,
  overconfidence_skip: SkipForward,
};

const ERROR_COLORS: Record<string, string> = {
  conceptual: 'bg-red-500',
  procedural: 'bg-amber-500',
  notation: 'bg-sky-500',
  misread: 'bg-purple-500',
  time_pressure: 'bg-orange-500',
  arithmetic: 'bg-emerald-500',
  overconfidence_skip: 'bg-yellow-500',
};

const ERROR_LABELS: Record<string, string> = {
  conceptual: 'Conceptual',
  procedural: 'Procedural',
  notation: 'Notation',
  misread: 'Misread',
  time_pressure: 'Time Pressure',
  arithmetic: 'Arithmetic',
  overconfidence_skip: 'Skipped Steps',
};

export default function ErrorPatternsPage() {
  const sessionId = useSession();
  const [report, setReport] = useState<ErrorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    trackEvent('page_view', { page: 'error-patterns' });
  }, []);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ report: ErrorReport }>(`/api/gbrain/errors/${sessionId}?days=${days}`)
      .then(res => setReport(res.report))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId, days]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-surface-800/60 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!report || report.total_errors === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16 space-y-4">
        <Brain size={48} className="text-surface-700 mx-auto" />
        <h2 className="text-xl font-bold text-surface-300">No errors to analyze</h2>
        <p className="text-sm text-surface-500">Practice more problems to see your error patterns here.</p>
      </motion.div>
    );
  }

  const TrendIcon = report.trend === 'improving' ? TrendingDown : report.trend === 'declining' ? TrendingUp : Minus;
  const trendColor = report.trend === 'improving' ? 'text-emerald-400' : report.trend === 'declining' ? 'text-red-400' : 'text-surface-400';
  const trendLabel = report.trend === 'improving' ? 'Fewer errors than last week' : report.trend === 'declining' ? 'More errors than last week' : 'Similar to last week';

  // Compute type percentages
  const typeEntries = Object.entries(report.by_type)
    .sort(([, a], [, b]) => b - a);

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={staggerContainer}>
      <motion.div variants={fadeInUp}>
        <h1 className="text-xl font-bold text-surface-100">Error Patterns</h1>
        <p className="text-xs text-surface-500 mt-1">Understand your mistakes to eliminate them</p>
      </motion.div>

      {/* Period Selector */}
      <motion.div variants={fadeInUp} className="flex gap-1 p-1 rounded-xl bg-surface-900 border border-surface-800">
        {[
          { d: 7, label: '7 days' },
          { d: 14, label: '14 days' },
          { d: 30, label: '30 days' },
        ].map(opt => (
          <button
            key={opt.d}
            onClick={() => setDays(opt.d)}
            className={clsx(
              'flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              days === opt.d ? 'bg-surface-800 text-surface-100' : 'text-surface-500 hover:text-surface-400',
            )}
          >
            {opt.label}
          </button>
        ))}
      </motion.div>

      {/* Summary */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-surface-900 border border-surface-800 text-center">
          <CountUp target={report.total_errors} className="text-lg font-bold text-surface-200" />
          <p className="text-xs text-surface-500">total errors</p>
        </div>
        <div className="p-3 rounded-xl bg-surface-900 border border-surface-800 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <TrendIcon size={16} className={trendColor} />
            <span className={clsx('text-sm font-bold', trendColor)}>
              {report.trend.charAt(0).toUpperCase() + report.trend.slice(1)}
            </span>
          </div>
          <p className="text-xs text-surface-500 mt-0.5">{trendLabel}</p>
        </div>
      </motion.div>

      {/* Error Type Breakdown — visual bar chart */}
      <motion.div variants={fadeInUp} className="space-y-2">
        <h2 className="text-sm font-semibold text-surface-300">Error Type Breakdown</h2>
        <div className="space-y-2">
          {typeEntries.map(([type, count]) => {
            const pct = Math.round((count / report.total_errors) * 100);
            const Icon = ERROR_ICONS[type] || Brain;

            return (
              <div key={type} className="p-3 rounded-xl bg-surface-900 border border-surface-800">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Icon size={13} className="text-surface-400" />
                    <span className="text-sm text-surface-200">{ERROR_LABELS[type] || type}</span>
                  </div>
                  <span className="text-xs text-surface-500">{count} ({pct}%)</span>
                </div>
                <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
                  <motion.div
                    className={clsx('h-full rounded-full', ERROR_COLORS[type] || 'bg-surface-600')}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Top Misconceptions */}
      {report.top_misconceptions.length > 0 && (
        <motion.div variants={fadeInUp} className="space-y-2">
          <h2 className="text-sm font-semibold text-surface-300 flex items-center gap-1.5">
            <Target size={13} className="text-red-400" />
            Top Misconceptions
          </h2>
          {report.top_misconceptions.map((m, i) => (
            <div key={i} className="p-3 rounded-xl bg-surface-900 border border-surface-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-sky-400">{m.id.replace(/-/g, ' ')}</span>
                <span className="text-xs text-surface-500">{m.count}×</span>
              </div>
              <p className="text-sm text-surface-400">{m.description}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <motion.div variants={fadeInUp} className="space-y-2">
          <h2 className="text-sm font-semibold text-surface-300 flex items-center gap-1.5">
            <Lightbulb size={13} className="text-emerald-400" />
            Recommendations
          </h2>
          {report.recommendations.map((rec, i) => (
            <div key={i} className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
              <p className="text-sm text-surface-300 leading-relaxed">{rec}</p>
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
