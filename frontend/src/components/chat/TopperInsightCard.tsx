/**
 * TopperInsightCard.tsx
 *
 * Exports:
 *   TopperTipChip       — compact inline chip for Chat (strategy OR trap variant)
 *   TopperStrategyCard  — full card for chat sidebar
 *   TopperLessonCard    — full lesson card (auto-expands when triggered by mistake)
 *   TopperInsightPanel  — tabbed panel for Practice page
 *
 * Inline cards shown in Chat + Practice pages that surface a topper strategy
 * or lesson learned relevant to the current topic.
 * Dismissible, collapsible, with deep-link to full strategy.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, AlertTriangle, ChevronDown, ChevronUp, Lightbulb, Clock, X, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import type { TopperStrategy, LessonLearned, TopperInsight } from '@/services/topperIntelligence';
import { getTopperStrategies, getCommonTrap } from '@/services/topperIntelligence';

// ─── TopperTipChip ── compact inline chat chip ────────────────────────────────

interface TopperTipChipProps {
  examId: string;
  topicId: string;
  variant: 'strategy' | 'trap';
}

export function TopperTipChip({ examId, topicId, variant }: TopperTipChipProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (dismissed) return null;

  if (variant === 'strategy') {
    const strategies = getTopperStrategies(examId, topicId);
    const topStrategy = strategies.sort((a, b) => b.examRelevance - a.examRelevance)[0];
    if (!topStrategy) return null;

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="rounded-lg border border-amber-500/20 bg-amber-500/6 overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <Trophy className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-[11px] text-amber-400 font-semibold">Topper move: </span>
              <span className="text-[12px] text-surface-300">{topStrategy.shortSummary}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[10px] text-amber-400/70 hover:text-amber-400 touch-manipulation px-1"
              >
                {expanded ? '▲' : '▼'}
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="p-0.5 hover:bg-surface-700/60 rounded text-surface-600 hover:text-surface-400 touch-manipulation"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-amber-500/10"
              >
                <div className="px-3 pb-2.5 pt-2">
                  <p className="text-[11px] font-semibold text-amber-300 mb-1">{topStrategy.title}</p>
                  <p className="text-[12px] text-surface-400 leading-relaxed whitespace-pre-line">
                    {topStrategy.detailedExplanation}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    );
  }

  // variant === 'trap'
  const trap = getCommonTrap(examId, topicId);
  if (!trap) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="rounded-lg border border-red-500/20 bg-red-500/5 overflow-hidden"
      >
        <div className="flex items-start gap-2 px-3 py-2">
          <Zap className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-[11px] text-red-400 font-semibold">Common trap: </span>
            <span className="text-[12px] text-surface-300 leading-relaxed">{trap}</span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="p-0.5 hover:bg-surface-700/60 rounded text-surface-600 hover:text-surface-400 touch-manipulation flex-shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Topper Strategy card ─────────────────────────────────────────────────────

interface StrategyCardProps {
  strategy: TopperStrategy;
  onDismiss: () => void;
  compact?: boolean;
}

export function TopperStrategyCard({ strategy, onDismiss, compact = false }: StrategyCardProps) {
  const [expanded, setExpanded] = useState(false);

  const examRelevancePct = Math.round(strategy.examRelevance * 100);
  const successPct = Math.round(strategy.successRate * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      className={clsx(
        'rounded-xl border overflow-hidden',
        'bg-gradient-to-br from-amber-500/8 to-orange-500/5',
        'border-amber-500/20',
        compact ? 'text-sm' : 'text-[15px]',
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center mt-0.5">
          <Trophy className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
              Topper Strategy
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20">
              {examRelevancePct}% exam relevance
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
              {successPct}% success rate
            </span>
          </div>
          <p className="font-semibold text-white mt-0.5 leading-snug">{strategy.title}</p>
          <p className="text-surface-400 mt-0.5 leading-relaxed text-[13px]">{strategy.shortSummary}</p>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-surface-700/60 text-surface-500 hover:text-white transition-colors touch-manipulation"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 border-t border-amber-500/10 hover:bg-amber-500/5 transition-colors touch-manipulation"
      >
        <span className="text-[12px] text-amber-400/80">
          {expanded ? 'Hide detail' : 'See the full topper approach →'}
        </span>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-amber-400/60" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-amber-400/60" />
        )}
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1">
              <div className="bg-surface-800/60 rounded-lg p-3 text-[13px] leading-relaxed text-surface-300 whitespace-pre-line font-mono border border-surface-700/40">
                {strategy.detailedExplanation}
              </div>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1 text-[11px] text-surface-500">
                  <Clock className="w-3 h-3" />
                  {strategy.timeInvestment === 'quick' ? '< 5 min to learn'
                    : strategy.timeInvestment === 'medium' ? '~30 min to master'
                    : '2h+ deep practice'}
                </span>
                <span className="text-[11px] text-surface-500">
                  Phase: <span className="text-surface-400">{strategy.phase.replace(/_/g, ' ')}</span>
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Lesson Learned card ──────────────────────────────────────────────────────

interface LessonCardProps {
  lesson: LessonLearned;
  onDismiss: () => void;
  triggeredByMistake?: boolean;  // true = student just made this mistake
}

export function TopperLessonCard({ lesson, onDismiss, triggeredByMistake = false }: LessonCardProps) {
  const [expanded, setExpanded] = useState(triggeredByMistake);  // auto-expand if triggered

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      className={clsx(
        'rounded-xl border overflow-hidden',
        triggeredByMistake
          ? 'bg-gradient-to-br from-red-500/8 to-orange-500/5 border-red-500/25'
          : 'bg-gradient-to-br from-blue-500/8 to-indigo-500/5 border-blue-500/20',
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-3">
        <div className={clsx(
          'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5',
          triggeredByMistake ? 'bg-red-500/15' : 'bg-blue-500/15',
        )}>
          {triggeredByMistake
            ? <AlertTriangle className="w-4 h-4 text-red-400" />
            : <Lightbulb className="w-4 h-4 text-blue-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx(
              'text-[11px] font-semibold uppercase tracking-wider',
              triggeredByMistake ? 'text-red-400' : 'text-blue-400',
            )}>
              {triggeredByMistake ? '⚠️ Topper Lesson' : 'Lesson Learned'}
            </span>
            {lesson.examYearsAppeared.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/20">
                GATE {lesson.examYearsAppeared.slice(-2).join(', ')}
              </span>
            )}
          </div>
          <p className="font-semibold text-white mt-0.5 leading-snug">{lesson.mistakeTitle}</p>
          <p className="text-surface-400 mt-0.5 leading-relaxed text-[13px]">
            {triggeredByMistake ? lesson.whyItHappens : lesson.mistakeDescription}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-surface-700/60 text-surface-500 hover:text-white transition-colors touch-manipulation"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* The fix — always visible when triggered */}
      {triggeredByMistake && (
        <div className="mx-3 mb-3 p-2.5 rounded-lg bg-green-500/8 border border-green-500/20">
          <p className="text-[11px] font-semibold text-green-400 mb-1">How toppers avoid this:</p>
          <p className="text-[13px] text-green-300 leading-relaxed">{lesson.howToppersAvoidIt}</p>
          <p className="text-[11px] text-green-400/70 mt-2 italic">
            10-second exam fix: {lesson.fixInSeconds}
          </p>
        </div>
      )}

      {/* Expand toggle for non-triggered view */}
      {!triggeredByMistake && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-3 py-2 border-t border-blue-500/10 hover:bg-blue-500/5 transition-colors touch-manipulation"
          >
            <span className="text-[12px] text-blue-400/80">
              {expanded ? 'Hide fix' : 'How did toppers fix this? →'}
            </span>
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-blue-400/60" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-blue-400/60" />
            )}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3">
                  <div className="p-2.5 rounded-lg bg-green-500/8 border border-green-500/20">
                    <p className="text-[13px] text-green-300 leading-relaxed">{lesson.howToppersAvoidIt}</p>
                    <p className="text-[11px] text-green-400/70 mt-2 italic">
                      10-second fix: {lesson.fixInSeconds}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}

// ─── Combined Topper Insight panel ────────────────────────────────────────────
// Used in Practice page: shows the full insight for current topic

interface TopperInsightPanelProps {
  insight: TopperInsight;
  className?: string;
}

export function TopperInsightPanel({ insight, className }: TopperInsightPanelProps) {
  const [activeTab, setActiveTab] = useState<'strategies' | 'lessons' | 'checklist'>('strategies');

  return (
    <div className={clsx('rounded-2xl border border-amber-500/20 overflow-hidden bg-gradient-to-br from-amber-500/6 to-transparent', className)}>
      {/* Header */}
      <div className="p-4 border-b border-amber-500/15">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Topper Intelligence</span>
        </div>
        <p className="text-[13px] text-surface-300 italic leading-relaxed">"{insight.topperMindset}"</p>
        <div className="flex items-center gap-3 mt-2 text-[11px] text-surface-500">
          <span>Avg student: <strong className="text-surface-400">{insight.timeToMasteryHours.average}h</strong> to master</span>
          <span>Topper: <strong className="text-amber-400">{insight.timeToMasteryHours.topper}h</strong> with these strategies</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-700/40">
        {(['strategies', 'lessons', 'checklist'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'flex-1 py-2 text-[12px] font-medium transition-colors touch-manipulation',
              activeTab === tab
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-surface-500 hover:text-surface-300',
            )}
          >
            {tab === 'strategies' ? '🏆 Strategies'
              : tab === 'lessons' ? '⚠️ Pitfalls'
              : '✅ Exam Day'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4 space-y-3 max-h-80 overflow-y-auto scrollbar-thin">
        {activeTab === 'strategies' && (
          <>
            {insight.keyStrategies.map(s => (
              <div key={s.id} className="p-3 rounded-xl bg-surface-800/50 border border-surface-700/40">
                <p className="font-semibold text-white text-[13px]">{s.title}</p>
                <p className="text-surface-400 text-[12px] mt-0.5">{s.shortSummary}</p>
                <div className="flex gap-2 mt-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                    {Math.round(s.examRelevance * 100)}% exam
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400">
                    {Math.round(s.successRate * 100)}% success
                  </span>
                </div>
              </div>
            ))}
            <div className="p-3 rounded-xl bg-green-500/6 border border-green-500/15">
              <p className="text-[11px] font-semibold text-green-400 mb-1">🎯 Breakthrough moment</p>
              <p className="text-[12px] text-green-300 leading-relaxed">{insight.breakthroughMoment}</p>
            </div>
          </>
        )}

        {activeTab === 'lessons' && (
          <>
            {insight.lessonsLearned.map(l => (
              <div key={l.id} className="p-3 rounded-xl bg-surface-800/50 border border-surface-700/40">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  <p className="font-semibold text-white text-[13px]">{l.mistakeTitle}</p>
                </div>
                <p className="text-surface-400 text-[12px] mb-2">{l.whyItHappens}</p>
                <div className="p-2 rounded-lg bg-green-500/8 border border-green-500/15">
                  <p className="text-[12px] text-green-300">{l.howToppersAvoidIt}</p>
                </div>
              </div>
            ))}
            <div className="p-3 rounded-xl bg-red-500/6 border border-red-500/15">
              <p className="text-[11px] font-semibold text-red-400 mb-1">⚠️ Most common trap</p>
              <p className="text-[12px] text-red-300 leading-relaxed">{insight.commonTrap}</p>
            </div>
          </>
        )}

        {activeTab === 'checklist' && (
          <div className="space-y-2">
            <p className="text-[11px] text-surface-500 mb-3">30-second mental scan before starting any question on this topic:</p>
            {insight.examDayChecklist.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-surface-800/40 border border-surface-700/30">
                <span className="text-[11px] font-bold text-amber-400 mt-0.5 flex-shrink-0">{i + 1}.</span>
                <p className="text-[13px] text-surface-300 leading-relaxed">{item}</p>
              </div>
            ))}
            <div className="mt-3 p-3 rounded-xl bg-blue-500/6 border border-blue-500/15">
              <p className="text-[11px] font-semibold text-blue-400 mb-1">📖 Study sequence</p>
              {insight.studySequence.map((step, i) => (
                <p key={i} className="text-[12px] text-blue-300 leading-relaxed">{step}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
