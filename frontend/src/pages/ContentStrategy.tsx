/**
 * ContentStrategy.tsx — Strategy Selector UI
 * Route: /content-strategy
 *
 * CEO: sees platform-wide control + performance table + feedback loop status.
 * All roles: see a personal strategy picker.
 */

import { useState, useEffect, useCallback } from 'react';
import { Check, Sliders, BarChart3, RefreshCw, Zap, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import {
  CONTENT_STRATEGIES,
  getPlatformStrategy,
  setPlatformStrategy,
  getUserStrategy,
  setUserStrategy,
  clearUserStrategy,
  type ContentStrategyId,
  type ContentStrategy,
} from '@/services/contentStrategyService';
import {
  generateFeedbackReport,
  getAllPerformance,
  getRegenerationQueue,
  emitToOracle,
  emitToAtlas,
  emitToScout,
  type FeedbackReport,
} from '@/services/contentFeedbackService';
import { createAtlasTask, queueTask } from '@/services/atlasTaskService';
import { loadCurrentUser } from '@/services/userService';
import { useAppStore } from '@/stores/appStore';

// ── Strategy card ─────────────────────────────────────────────────────────────

interface StrategyCardProps {
  strategy: ContentStrategy;
  isActive: boolean;
  size?: 'normal' | 'small';
  onSelect: () => void;
  ctaLabel?: string;
}

function StrategyCard({
  strategy,
  isActive,
  size = 'normal',
  onSelect,
  ctaLabel = 'Set as Platform Default',
}: StrategyCardProps) {
  return (
    <div
      className={clsx(
        'relative rounded-2xl border transition-all cursor-pointer group',
        size === 'small' ? 'p-4' : 'p-5',
        isActive
          ? 'border-violet-500/60 bg-violet-500/10 shadow-lg shadow-violet-500/10'
          : 'border-surface-700 bg-surface-900/60 hover:border-surface-600',
      )}
      onClick={onSelect}
    >
      {isActive && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}

      <div className="flex items-center gap-3 mb-3">
        <span className={clsx('text-2xl', size === 'small' && 'text-xl')}>
          {strategy.emoji}
        </span>
        <div>
          <p className={clsx('font-semibold text-white', size === 'small' ? 'text-sm' : 'text-base')}>
            {strategy.name}
          </p>
          <p className="text-[11px] text-surface-500 mt-0.5">
            Best for: {strategy.bestFor}
          </p>
        </div>
      </div>

      <p className={clsx('text-surface-400 leading-relaxed', size === 'small' ? 'text-xs' : 'text-sm')}>
        {strategy.description}
      </p>

      <div className="flex items-center gap-2 mt-3 text-[11px] text-surface-500">
        <span className="bg-surface-800 px-2 py-0.5 rounded-full border border-surface-700">
          ×{strategy.paceMultiplier} pace
        </span>
        {strategy.feedbackRequired && (
          <span className="bg-surface-800 px-2 py-0.5 rounded-full border border-surface-700">
            feedback on
          </span>
        )}
        {strategy.momentOverride && (
          <span className="bg-surface-800 px-2 py-0.5 rounded-full border border-surface-700">
            {strategy.momentOverride.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {!isActive && size !== 'small' && (
        <button
          onClick={e => { e.stopPropagation(); onSelect(); }}
          className="mt-4 w-full text-xs py-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-300 hover:bg-surface-700 hover:text-white transition-all"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="p-2 rounded-xl bg-surface-800/60 border border-surface-700/50 text-violet-400">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ContentStrategy() {
  const { userRole } = useAppStore();
  const isCEO = userRole === 'ceo';
  const user = loadCurrentUser();
  const userId = user?.uid;

  // Platform strategy state
  const [platformStrategy, setPlatformStrategyState] = useState<ContentStrategyId>(
    getPlatformStrategy,
  );

  // User personal strategy
  const [userStrategyId, setUserStrategyState] = useState<ContentStrategyId | null>(
    () => getUserStrategy(userId),
  );
  const [usePlatformDefault, setUsePlatformDefault] = useState<boolean>(
    () => getUserStrategy(userId) === null,
  );

  // Feedback state
  const [report, setReport] = useState<FeedbackReport | null>(null);
  const [regenCount, setRegenCount] = useState(0);
  const [totalFeedback, setTotalFeedback] = useState(0);
  const [topPerformers, setTopPerformers] = useState(0);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [flushed, setFlushed] = useState(false);
  const [signalled, setSignalled] = useState(false);

  useEffect(() => {
    const allPerf = getAllPerformance();
    setRegenCount(getRegenerationQueue().length);
    setTotalFeedback(
      (() => {
        try {
          const raw = localStorage.getItem('edugenius_content_feedback');
          return raw ? (JSON.parse(raw) as unknown[]).length : 0;
        } catch { return 0; }
      })(),
    );
    setTopPerformers(allPerf.filter(p => p.performanceScore >= 70).length);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSetPlatform = useCallback((id: ContentStrategyId) => {
    setPlatformStrategy(id);
    setPlatformStrategyState(id);
  }, []);

  const handleTogglePlatformDefault = useCallback(() => {
    const next = !usePlatformDefault;
    setUsePlatformDefault(next);
    if (next) {
      clearUserStrategy(userId);
      setUserStrategyState(null);
    }
  }, [usePlatformDefault, userId]);

  const handleSetUserStrategy = useCallback((id: ContentStrategyId) => {
    setUserStrategyState(id);
  }, []);

  const handleSaveUserStrategy = useCallback(() => {
    if (!usePlatformDefault && userStrategyId) {
      setUserStrategy(userStrategyId, userId);
    }
  }, [usePlatformDefault, userStrategyId, userId]);

  const handleGenerateReport = useCallback(() => {
    const r = generateFeedbackReport();
    setReport(r);
    emitToOracle(r);
    setReportGenerated(true);
    setRegenCount(r.needsRegeneration.length);
    setTopPerformers(r.topPerformers.length);
    setTotalFeedback(r.totalFeedback);
  }, []);

  const handleFlushToAtlas = useCallback(() => {
    const queue = getRegenerationQueue();
    emitToAtlas(queue);
    // Also create Atlas tasks for each regen item
    queue.forEach(perf => {
      const task = createAtlasTask(
        {
          topic: perf.topic,
          urgency: 'high',
          questionCount: perf.totalImpressions,
          avgScore: perf.performanceScore,
          sampleQuestions: [],
          examFocus: perf.examType,
        } as Parameters<typeof createAtlasTask>[0],
        'gap_radar',
      );
      queueTask(task);
    });
    setFlushed(true);
  }, []);

  const handleSignalScout = useCallback(() => {
    const r = report ?? generateFeedbackReport();
    emitToScout(r.topicHealthMap);
    setSignalled(true);
  }, [report]);

  const strategies = Object.values(CONTENT_STRATEGIES);

  // Performance table data
  const stratEffectiveness = report?.strategyEffectiveness ?? {};

  const effectiveUserStrategy: ContentStrategyId =
    usePlatformDefault ? platformStrategy : (userStrategyId ?? platformStrategy);

  return (
    <div className="space-y-10 max-w-5xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
          <Sliders className="w-6 h-6 text-violet-400" />
          Content Strategy
        </h1>
        <p className="text-surface-400 text-sm mt-1">
          Control how content is generated and sequenced for students.
        </p>
      </div>

      {/* ── SECTION 1: Platform Strategy (CEO only) ─────────────────────── */}
      {isCEO && (
        <section className="bg-surface-900/50 border border-surface-800 rounded-3xl p-6">
          <SectionHeader
            icon={Sliders}
            title="Platform-Wide Content Strategy"
            subtitle="This applies to all students unless they override it personally."
          />

          {/* Active badge */}
          <div className="mb-5 flex items-center gap-2">
            <span className="text-xs text-surface-400">Platform Default:</span>
            <span className="flex items-center gap-1.5 bg-violet-500/20 border border-violet-500/40 text-violet-300 text-xs px-3 py-1 rounded-full font-medium">
              {CONTENT_STRATEGIES[platformStrategy].emoji}{' '}
              {CONTENT_STRATEGIES[platformStrategy].name}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {strategies.map(s => (
              <StrategyCard
                key={s.id}
                strategy={s}
                isActive={s.id === platformStrategy}
                onSelect={() => handleSetPlatform(s.id)}
                ctaLabel="Set as Platform Default"
              />
            ))}
          </div>
        </section>
      )}

      {/* ── SECTION 2: Personal Strategy (all roles) ────────────────────── */}
      <section className="bg-surface-900/50 border border-surface-800 rounded-3xl p-6">
        <SectionHeader
          icon={Sliders}
          title="Your Personal Strategy"
          subtitle="Override the platform default with a strategy that fits your learning style."
        />

        {/* Toggle */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={handleTogglePlatformDefault}
            className={clsx(
              'relative inline-flex items-center w-11 h-6 rounded-full transition-colors',
              usePlatformDefault ? 'bg-violet-500' : 'bg-surface-700',
            )}
          >
            <span
              className={clsx(
                'inline-block w-4 h-4 bg-white rounded-full shadow transition-transform',
                usePlatformDefault ? 'translate-x-6' : 'translate-x-1',
              )}
            />
          </button>
          <span className="text-sm text-surface-300">
            {usePlatformDefault ? 'Using platform default' : 'Custom strategy'}
          </span>
        </div>

        {!usePlatformDefault && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {strategies.map(s => (
                <StrategyCard
                  key={s.id}
                  strategy={s}
                  isActive={s.id === effectiveUserStrategy}
                  size="small"
                  onSelect={() => handleSetUserStrategy(s.id)}
                  ctaLabel="Select"
                />
              ))}
            </div>

            <button
              onClick={handleSaveUserStrategy}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Save My Strategy
            </button>
          </>
        )}

        {usePlatformDefault && (
          <p className="text-sm text-surface-500">
            You&apos;re using the platform default:{' '}
            <span className="text-white font-medium">
              {CONTENT_STRATEGIES[platformStrategy].emoji}{' '}
              {CONTENT_STRATEGIES[platformStrategy].name}
            </span>
            . Toggle off above to pick your own.
          </p>
        )}
      </section>

      {/* ── SECTION 3: Strategy Performance (CEO only) ──────────────────── */}
      {isCEO && (
        <section className="bg-surface-900/50 border border-surface-800 rounded-3xl p-6">
          <SectionHeader
            icon={BarChart3}
            title="Strategy Performance"
            subtitle="Which strategy is delivering the best outcomes?"
          />

          {Object.keys(stratEffectiveness).length === 0 ? (
            <p className="text-sm text-surface-500">
              No performance data yet. Generate a report below to populate this table.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-surface-500 border-b border-surface-800">
                    <th className="pb-3 font-medium">Strategy</th>
                    <th className="pb-3 font-medium">Avg Score</th>
                    <th className="pb-3 font-medium">Atoms Delivered</th>
                    <th className="pb-3 font-medium">Top Topic</th>
                    <th className="pb-3 font-medium">Skip Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  {(Object.entries(stratEffectiveness) as [ContentStrategyId, number][]).map(([stratId, avgScore]) => {
                    const s = CONTENT_STRATEGIES[stratId];
                    if (!s) return null;
                    const allPerf = getAllPerformance();
                    const stratPerf = allPerf.filter(p => {
                      try {
                        const raw = localStorage.getItem('edugenius_content_feedback');
                        if (!raw) return false;
                        const events = JSON.parse(raw) as Array<{ atomId: string; strategyId: string }>;
                        return events.some(e => e.atomId === p.atomId && e.strategyId === stratId);
                      } catch { return false; }
                    });
                    const topTopic = [...stratPerf].sort((a, b) => b.performanceScore - a.performanceScore)[0]?.topic ?? '—';
                    const avgSkip = stratPerf.length > 0
                      ? (stratPerf.reduce((sum, p) => sum + p.skipRate, 0) / stratPerf.length * 100).toFixed(0) + '%'
                      : '—';
                    const score = avgScore as number;
                    const scoreColor = score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-yellow-400' : 'text-red-400';
                    return (
                      <tr key={stratId} className="text-surface-300">
                        <td className="py-3">
                          <span className="flex items-center gap-2">
                            <span>{s.emoji}</span>
                            <span className="font-medium text-white">{s.name}</span>
                          </span>
                        </td>
                        <td className={clsx('py-3 font-semibold', scoreColor)}>
                          {score}
                        </td>
                        <td className="py-3 text-surface-400">{stratPerf.length}</td>
                        <td className="py-3 text-surface-400 truncate max-w-[120px]">{topTopic}</td>
                        <td className="py-3 text-surface-400">{avgSkip}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── SECTION 4: Feedback Loop Status (all, more detail for CEO) ──── */}
      <section className="bg-surface-900/50 border border-surface-800 rounded-3xl p-6">
        <SectionHeader
          icon={Activity}
          title="Feedback Loop Status"
          subtitle="Real-time signals from students powering the content improvement cycle."
        />

        {/* Live counts */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-surface-800/60 border border-surface-700 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{totalFeedback}</p>
            <p className="text-xs text-surface-500 mt-1">Total feedback events</p>
          </div>
          <div className="bg-surface-800/60 border border-surface-700 rounded-2xl p-4 text-center">
            <p className={clsx('text-2xl font-bold', regenCount > 0 ? 'text-red-400' : 'text-emerald-400')}>
              {regenCount}
            </p>
            <p className="text-xs text-surface-500 mt-1">Atoms needing regen</p>
          </div>
          <div className="bg-surface-800/60 border border-surface-700 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{topPerformers}</p>
            <p className="text-xs text-surface-500 mt-1">Top performers</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleGenerateReport}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-300 hover:text-violet-200 text-sm rounded-xl transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Generate Report
            {reportGenerated && <span className="text-emerald-400 text-xs">✓</span>}
          </button>

          {isCEO && (
            <>
              <button
                onClick={handleFlushToAtlas}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-sm rounded-xl transition-all"
              >
                <Zap className="w-4 h-4" />
                Flush Regen Queue to Atlas
                {flushed && <span className="text-emerald-400 text-xs">✓</span>}
              </button>

              <button
                onClick={handleSignalScout}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:text-blue-200 text-sm rounded-xl transition-all"
              >
                <BarChart3 className="w-4 h-4" />
                Signal Scout
                {signalled && <span className="text-emerald-400 text-xs">✓</span>}
              </button>
            </>
          )}
        </div>

        {/* Report summary (if generated) */}
        {report && (
          <div className="mt-5 p-4 bg-surface-800/40 border border-surface-700 rounded-2xl text-xs text-surface-400 space-y-1">
            <p className="text-white font-medium text-sm mb-2">
              Report — {new Date(report.generatedAt).toLocaleString()}
            </p>
            <p>{report.totalFeedback} total feedback events</p>
            <p>{report.topPerformers.length} top performers (score ≥ 70)</p>
            <p>{report.needsRegeneration.length} atoms queued for regeneration</p>
            <p>{Object.keys(report.topicHealthMap).length} topics tracked</p>
            <p className="text-emerald-400 text-xs mt-2">
              ✓ Emitted to Oracle (oracle:content_feedback)
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default ContentStrategy;
