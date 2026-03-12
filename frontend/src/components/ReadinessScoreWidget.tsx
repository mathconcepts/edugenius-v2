/**
 * ReadinessScoreWidget.tsx — Predictive exam readiness score display
 * CEO/Admin: appStore.readinessScoreEnabled
 */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, AlertCircle, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '@/stores/appStore';
import { computeReadiness } from '@/services/readinessScoreService';

interface ReadinessScoreWidgetProps {
  compact?: boolean;
  examDate?: Date;
  onViewDetails?: () => void;
}

export function ReadinessScoreWidget({ compact, examDate, onViewDetails }: ReadinessScoreWidgetProps) {
  const { readinessScoreEnabled } = useAppStore();
  const report = useMemo(() => computeReadiness(examDate), [examDate]);

  if (!readinessScoreEnabled) return null;

  const scoreColor =
    report.overallScore >= 80 ? 'text-green-400' :
    report.overallScore >= 60 ? 'text-yellow-400' :
    report.overallScore >= 40 ? 'text-orange-400' : 'text-red-400';

  const TrendIcon = report.trend === 'improving' ? TrendingUp :
                    report.trend === 'declining' ? TrendingDown : Minus;
  const trendColor = report.trend === 'improving' ? 'text-green-400' :
                     report.trend === 'declining' ? 'text-red-400' : 'text-surface-400';

  if (compact) {
    return (
      <div
        onClick={onViewDetails}
        className={clsx(
          'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer hover:border-opacity-80 transition-all',
          report.overallScore >= 75 ? 'bg-green-900/20 border-green-700/40' :
          report.overallScore >= 50 ? 'bg-yellow-900/20 border-yellow-700/40' :
          'bg-red-900/20 border-red-700/40'
        )}
      >
        <div className="flex-1">
          <p className="text-xs text-surface-400 uppercase tracking-wider">Exam Readiness</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className={clsx('text-2xl font-black', scoreColor)}>{report.overallScore}%</span>
            <span className="text-sm text-surface-400">Grade {report.grade}</span>
          </div>
        </div>
        <div className="text-right">
          <TrendIcon className={clsx('w-5 h-5', trendColor)} />
          <p className="text-xs text-surface-500 mt-1">
            {report.overallScore >= 75 ? 'Ready!' : `Ready by ${report.examReadyDate.split(' ').slice(0, 2).join(' ')}`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-800 rounded-2xl border border-surface-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700">
        <div>
          <p className="text-sm font-bold text-white">Exam Readiness Score</p>
          <p className="text-xs text-surface-400">Confidence: {report.confidence}</p>
        </div>
        <div className="text-right">
          <div className={clsx('text-4xl font-black', scoreColor)}>{report.overallScore}</div>
          <div className="text-xs text-surface-400">/ 100</div>
        </div>
      </div>

      {/* Progress arc visual */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-3 bg-surface-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${report.overallScore}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className={clsx('h-full rounded-full', 
                report.overallScore >= 75 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                report.overallScore >= 50 ? 'bg-gradient-to-r from-yellow-500 to-amber-400' :
                'bg-gradient-to-r from-red-500 to-orange-400'
              )}
            />
          </div>
          <div className="flex items-center gap-1">
            <TrendIcon className={clsx('w-4 h-4', trendColor)} />
            <span className={clsx('text-xs font-medium capitalize', trendColor)}>{report.trend}</span>
          </div>
        </div>

        {/* Ready date */}
        <p className="text-sm text-surface-300 mb-4">{report.recommendation}</p>

        {/* Breakdown bars */}
        <div className="space-y-2">
          {report.breakdown.map(b => (
            <div key={b.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-surface-300">{b.emoji} {b.label}</span>
                <span className={clsx('font-bold',
                  b.score >= 75 ? 'text-green-400' : b.score >= 50 ? 'text-yellow-400' : 'text-red-400'
                )}>{b.score}%</span>
              </div>
              <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${b.score}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={clsx('h-full rounded-full',
                    b.score >= 75 ? 'bg-green-500' : b.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  )}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Top gaps */}
        {report.topGaps.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <p className="text-xs font-bold text-surface-300 uppercase tracking-wider">Focus Areas</p>
            {report.topGaps.map((gap, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-surface-400">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-amber-400 flex-shrink-0" />
                {gap}
              </div>
            ))}
          </div>
        )}

        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="w-full mt-4 py-2 text-xs text-primary-400 hover:text-primary-300 flex items-center justify-center gap-1 transition-colors"
          >
            View detailed analysis <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
