/**
 * ContentSlot.tsx — Universal Personalized Module Renderer
 *
 * The drop-in component for any surface in EduGenius.
 * Takes a slotId + optional overrides, auto-resolves persona signals
 * from stores, then renders each module with staggered framer-motion
 * entrance animations.
 *
 * Usage:
 *   <ContentSlot slotId="dashboard_sidebar" />
 *   <ContentSlot slotId="chat_post_response" compact showPersonalizationBadge />
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, HelpCircle, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

// Services
import {
  resolveSlot,
  buildSlotContext,
  type SlotId,
  type SlotConfig,
  type ModuleConfig,
  type ContentModule,
} from '@/services/contentSlotService';
import { loadCurrentUser } from '@/services/userService';
import { loadPersona } from '@/services/studentPersonaEngine';
import { loadProfile } from '@/services/gamificationService';
import { getTodayMood } from '@/services/moodCheckInService';
import { getDueCards } from '@/services/spacedRepetitionEngine';
import { computeReadiness } from '@/services/readinessScoreService';
import { getDaysToExam } from '@/services/examDateService';
import { buildConceptCard } from '@/services/visualMathService';
import { useAppStore } from '@/stores/appStore';

// Components
import { SpacedRepetitionWidget } from './SpacedRepetitionWidget';
import { ReadinessScoreWidget } from './ReadinessScoreWidget';
import { MoodCheckIn } from './MoodCheckIn';
import { DailyBriefCard } from './DailyBriefCard';
import { XPBar } from './XPBar';
import { StreakCard } from './StreakCard';
import { VisualConceptCard } from './VisualConceptCard';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ContentSlotProps {
  slotId: SlotId;
  topic?: string;
  compact?: boolean;              // widget mode — smaller, tighter
  showPersonalizationBadge?: boolean; // debug / CEO mode
  onModuleClick?: (moduleId: ContentModule, data: unknown) => void;
  className?: string;
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function ModuleSkeleton({ compact }: { compact: boolean }) {
  return (
    <div className={clsx('animate-pulse rounded-xl bg-surface-800/60', compact ? 'h-16' : 'h-28')} />
  );
}

// ─── Personalization Badge ────────────────────────────────────────────────────

function PersonalizationBadge({ modules }: { modules: ModuleConfig[] }) {
  const [open, setOpen] = useState(false);
  const signals = [...new Set(modules.flatMap(m => m.personalizationSignals))];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1 text-[10px] text-primary-400/70 hover:text-primary-400 transition-colors"
      >
        <Sparkles className="w-3 h-3" />
        ✨ Personalized for you
        <HelpCircle className="w-3 h-3" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 top-5 z-50 w-72 bg-surface-800 border border-surface-700 rounded-xl p-3 shadow-xl"
          >
            <p className="text-xs font-semibold text-white mb-2">Why you're seeing this</p>
            {modules.map((m, i) => (
              <div key={`${m.moduleId}-${i}`} className="mb-2">
                <p className="text-xs text-surface-300 font-medium">{m.moduleId}</p>
                <p className="text-[10px] text-surface-500">{m.reason}</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {m.personalizationSignals.map(sig => (
                    <span key={sig} className="px-1.5 py-0.5 bg-primary-500/10 text-primary-400 text-[9px] rounded-full">
                      {sig}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[10px] text-surface-500 mt-1">Active signals: {signals.join(', ')}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Individual Module Renderers ──────────────────────────────────────────────

interface ModuleRendererProps {
  config: ModuleConfig;
  compact: boolean;
  onModuleClick?: (moduleId: ContentModule, data: unknown) => void;
}

function ModuleRenderer({ config, compact, onModuleClick }: ModuleRendererProps) {
  const handleClick = useCallback(
    (data: unknown = null) => onModuleClick?.(config.moduleId, data),
    [config.moduleId, onModuleClick],
  );

  switch (config.moduleId) {
    case 'spaced_repetition':
      return <SpacedRepetitionWidget />;

    case 'readiness_score':
      return <ReadinessScoreWidget compact={compact} />;

    case 'mood_checkin':
      return <MoodCheckIn />;

    case 'daily_brief':
      return <DailyBriefCard />;

    case 'xp_bar':
      return <XPBar compact={compact} />;

    case 'streak_motivation': {
      const days = typeof config.props.streakDays === 'number' ? config.props.streakDays : 0;
      return (
        <div
          className={clsx(
            'rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center gap-3 cursor-pointer',
            compact ? 'p-2' : 'p-4',
          )}
          onClick={() => handleClick({ days })}
        >
          <span className="text-2xl">🔥</span>
          <div>
            <p className={clsx('font-semibold text-orange-300', compact ? 'text-xs' : 'text-sm')}>
              {days}-day streak!
            </p>
            {!compact && (
              <p className="text-xs text-orange-400/70">
                Keep it going — consistency beats talent.
              </p>
            )}
          </div>
        </div>
      );
    }

    case 'exam_countdown': {
      const days = typeof config.props.daysToExam === 'number' ? config.props.daysToExam : 0;
      const examName = typeof config.props.examId === 'string'
        ? config.props.examId.toUpperCase().replace(/-/g, ' ')
        : 'Exam';
      const urgency = days <= 7 ? 'text-red-400' : days <= 30 ? 'text-amber-400' : 'text-green-400';
      return (
        <div
          className={clsx('rounded-xl bg-surface-800 border border-surface-700', compact ? 'p-2' : 'p-4')}
          onClick={() => handleClick({ days })}
        >
          <div className="flex items-center justify-between">
            <span className={clsx('font-bold', urgency, compact ? 'text-base' : 'text-2xl')}>
              {days}d
            </span>
            <span className="text-xs text-surface-400">{examName}</span>
          </div>
          {!compact && (
            <div className="mt-2 h-1.5 bg-surface-700 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full', days <= 7 ? 'bg-red-500' : days <= 30 ? 'bg-amber-500' : 'bg-green-500')}
                style={{ width: `${Math.max(5, Math.min(100, (1 - days / 365) * 100))}%` }}
              />
            </div>
          )}
        </div>
      );
    }

    case 'topic_recommendation': {
      const topic = typeof config.props.topic === 'string' ? config.props.topic : 'Next Topic';
      const difficulty = typeof config.props.difficulty === 'string' ? config.props.difficulty : 'medium';
      return (
        <div
          className={clsx(
            'rounded-xl bg-primary-500/10 border border-primary-500/20 cursor-pointer hover:bg-primary-500/20 transition-colors',
            compact ? 'p-2' : 'p-4',
          )}
          onClick={() => handleClick({ topic })}
        >
          <div className="flex items-center gap-2">
            <span>🎯</span>
            <div>
              <p className={clsx('font-medium text-white', compact ? 'text-xs' : 'text-sm')}>
                Recommended: {topic}
              </p>
              {!compact && (
                <p className="text-[11px] text-surface-400 mt-0.5">
                  Difficulty: {difficulty} · Based on your weak areas
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    case 'pyq_spotlight': {
      const examId = typeof config.props.examId === 'string' ? config.props.examId : 'gate-em';
      return (
        <div
          className={clsx(
            'rounded-xl bg-purple-500/10 border border-purple-500/20 cursor-pointer hover:bg-purple-500/20 transition-colors',
            compact ? 'p-2' : 'p-4',
          )}
          onClick={() => handleClick({ examId })}
        >
          <div className="flex items-center gap-2">
            <span>📜</span>
            <div>
              <p className={clsx('font-medium text-white', compact ? 'text-xs' : 'text-sm')}>PYQ Spotlight</p>
              {!compact && <p className="text-[11px] text-surface-400 mt-0.5">Solve a previous year question</p>}
            </div>
          </div>
        </div>
      );
    }

    case 'cohort_benchmark': {
      return (
        <div className={clsx('rounded-xl bg-blue-500/10 border border-blue-500/20', compact ? 'p-2' : 'p-4')}>
          <div className="flex items-center gap-2">
            <span>📊</span>
            <div>
              <p className={clsx('font-medium text-white', compact ? 'text-xs' : 'text-sm')}>Your Ranking</p>
              {!compact && <p className="text-[11px] text-surface-400 mt-0.5">Top 24% of GATE aspirants this week</p>}
            </div>
          </div>
        </div>
      );
    }

    case 'weakness_alert': {
      const topic = typeof config.props.topic === 'string' ? config.props.topic : 'Unknown Topic';
      const score = typeof config.props.score === 'number' ? config.props.score : 0;
      return (
        <div
          className={clsx(
            'rounded-xl bg-red-500/10 border border-red-500/20 cursor-pointer hover:bg-red-500/20 transition-colors',
            compact ? 'p-2' : 'p-4',
          )}
          onClick={() => handleClick({ topic, score })}
        >
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <div>
              <p className={clsx('font-medium text-red-300', compact ? 'text-xs' : 'text-sm')}>
                Weak Area: {topic}
              </p>
              {!compact && (
                <p className="text-[11px] text-surface-400 mt-0.5">
                  Score: {score}% — needs attention before exam
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    case 'celebration': {
      const score = typeof config.props.score === 'number' ? config.props.score : 80;
      return (
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className={clsx(
            'rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30',
            compact ? 'p-2' : 'p-4',
          )}
        >
          <div className="flex items-center gap-2">
            <span className={compact ? 'text-base' : 'text-2xl'}>🎉</span>
            <div>
              <p className={clsx('font-semibold text-green-300', compact ? 'text-xs' : 'text-sm')}>
                Amazing! {score}%
              </p>
              {!compact && <p className="text-[11px] text-surface-400 mt-0.5">You crushed it! Keep the momentum going.</p>}
            </div>
          </div>
        </motion.div>
      );
    }

    case 'nudge_card': {
      return (
        <div className={clsx('rounded-xl bg-surface-800 border border-surface-700', compact ? 'p-2' : 'p-4')}>
          <div className="flex items-center gap-2">
            <span>💬</span>
            <div>
              <p className={clsx('font-medium text-surface-200', compact ? 'text-xs' : 'text-sm')}>
                Mentor says
              </p>
              {!compact && (
                <p className="text-[11px] text-surface-400 mt-0.5">
                  "Every expert was once a beginner. Each mistake is data — what did you learn?"
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    case 'concept_bite': {
      const topic = typeof config.props.topic === 'string' ? config.props.topic : 'General';
      return (
        <div
          className={clsx(
            'rounded-xl bg-cyan-500/10 border border-cyan-500/20 cursor-pointer hover:bg-cyan-500/20 transition-colors',
            compact ? 'p-2' : 'p-4',
          )}
          onClick={() => handleClick({ topic })}
        >
          <div className="flex items-center gap-2">
            <span>⚡</span>
            <div>
              <p className={clsx('font-medium text-cyan-300', compact ? 'text-xs' : 'text-sm')}>
                2-min concept: {topic}
              </p>
              {!compact && <p className="text-[11px] text-surface-400 mt-0.5">Quick bite — won't tire you out</p>}
            </div>
          </div>
        </div>
      );
    }

    case 'formula_flash': {
      const topic = typeof config.props.topic === 'string' ? config.props.topic : 'Key Formula';
      return (
        <div
          className={clsx(
            'rounded-xl bg-surface-900 border border-primary-500/30 cursor-pointer',
            compact ? 'p-2' : 'p-4',
          )}
          onClick={() => handleClick({ topic })}
        >
          <div className="flex items-center gap-2">
            <span>📐</span>
            <p className={clsx('font-mono text-primary-200', compact ? 'text-xs' : 'text-sm')}>
              Formula Flash: {topic}
            </p>
          </div>
          {!compact && (
            <p className="text-[11px] text-surface-500 mt-1">Tap to review key formulas for this topic</p>
          )}
        </div>
      );
    }

    case 'practice_cta': {
      return (
        <div
          className={clsx(
            'rounded-xl bg-primary-500/10 border border-primary-500/30 cursor-pointer hover:bg-primary-500/20 transition-colors text-center',
            compact ? 'p-2' : 'p-4',
          )}
          onClick={() => handleClick(null)}
        >
          <p className={clsx('font-semibold text-primary-300', compact ? 'text-xs' : 'text-sm')}>
            🎯 Start Practice Session
          </p>
          {!compact && <p className="text-[11px] text-surface-400 mt-0.5">10 questions · adaptive difficulty</p>}
        </div>
      );
    }

    case 'empty_state_guide': {
      const examId = typeof config.props.examId === 'string' ? config.props.examId : 'your exam';
      return (
        <div className={clsx('rounded-xl bg-gradient-to-br from-primary-500/10 to-accent-500/10 border border-primary-500/20', compact ? 'p-2' : 'p-5')}>
          <p className={clsx('font-semibold text-white', compact ? 'text-xs' : 'text-base')}>
            👋 Welcome to EduGenius
          </p>
          {!compact && (
            <>
              <p className="text-sm text-surface-300 mt-1">
                You're preparing for <strong className="text-primary-400">{examId.toUpperCase().replace(/-/g, ' ')}</strong>.
                Here's how to get started:
              </p>
              <ul className="mt-3 space-y-1">
                {['Take a mood check-in', 'Ask Sage your first question', 'Review today\'s daily brief'].map((step, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-surface-300">
                    <span className="w-5 h-5 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      );
    }

    case 'visual_concept_card': {
      const topicStr = typeof config.props.topic === 'string' ? config.props.topic : 'eigenvalues';
      const examIdStr = typeof config.props.examId === 'string' ? config.props.examId : 'gate-em';
      try {
        const cardData = buildConceptCard(topicStr, examIdStr);
        return (
          <VisualConceptCard
            data={cardData}
            defaultCollapsed={compact}
            onDismiss={() => onModuleClick?.('visual_concept_card', { topic: topicStr })}
          />
        );
      } catch {
        return (
          <div className={clsx('rounded-xl bg-surface-800 border border-surface-700', compact ? 'p-2' : 'p-4')}>
            <p className={clsx('text-surface-300', compact ? 'text-xs' : 'text-sm')}>📚 {topicStr}</p>
          </div>
        );
      }
    }

    default:
      return null;
  }
}

// ─── Layout Wrappers ──────────────────────────────────────────────────────────

interface LayoutProps {
  config: SlotConfig;
  compact: boolean;
  onModuleClick?: (moduleId: ContentModule, data: unknown) => void;
}

function StackLayout({ config, compact, onModuleClick }: LayoutProps) {
  return (
    <div className="space-y-3">
      {config.modules.filter(m => m.visible).map((m, i) => (
        <motion.div
          key={m.moduleId}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, duration: 0.3 }}
        >
          <ModuleRenderer config={m} compact={compact} onModuleClick={onModuleClick} />
        </motion.div>
      ))}
    </div>
  );
}

function CarouselLayout({ config, compact, onModuleClick }: LayoutProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
      {config.modules.filter(m => m.visible).map((m, i) => (
        <motion.div
          key={m.moduleId}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06 }}
          className="snap-start shrink-0 w-64"
        >
          <ModuleRenderer config={m} compact={compact} onModuleClick={onModuleClick} />
        </motion.div>
      ))}
    </div>
  );
}

function GridLayout({ config, compact, onModuleClick }: LayoutProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {config.modules.filter(m => m.visible).map((m, i) => (
        <motion.div
          key={m.moduleId}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
        >
          <ModuleRenderer config={m} compact={compact} onModuleClick={onModuleClick} />
        </motion.div>
      ))}
    </div>
  );
}

function SingleLayout({ config, compact, onModuleClick }: LayoutProps) {
  const m = config.modules.find(m => m.visible);
  if (!m) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <ModuleRenderer config={m} compact={compact} onModuleClick={onModuleClick} />
    </motion.div>
  );
}

function InlineLayout({ config, compact, onModuleClick }: LayoutProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {config.modules.filter(m => m.visible).map((m, i) => (
        <motion.div
          key={m.moduleId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.04 }}
          className="flex-1 min-w-0"
        >
          <ModuleRenderer config={m} compact={true} onModuleClick={onModuleClick} />
        </motion.div>
      ))}
    </div>
  );
}

// ─── Context Builder (reads from stores) ──────────────────────────────────────

function buildContextFromStores(slotId: SlotId, topic?: string) {
  const user = loadCurrentUser();
  const persona = loadPersona();
  const profile = loadProfile();
  const latestMood = getTodayMood();
  const dueCards = getDueCards();
  const readiness = computeReadiness();

  const examId = user?.examSubscriptions?.[0]?.examId ?? 'gate-em';
  const catalogId = examId.toLowerCase().includes('gate') ? 'gate-em' :
                    examId.toLowerCase().includes('jee') ? 'jee-main' : 'gate-em';

  const daysToExam = getDaysToExam(catalogId);

  const hour = new Date().getHours();
  const timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night' =
    hour < 6    ? 'late_night' :
    hour < 12   ? 'morning' :
    hour < 17   ? 'afternoon' :
    hour < 21   ? 'evening' : 'night';

  const sessionStart = parseInt(localStorage.getItem('eg_session_start') ?? '0', 10);
  const sessionMinutes = sessionStart ? Math.floor((Date.now() - sessionStart) / 60_000) : 0;

  const isFirstSession = !localStorage.getItem('eg_has_sessioned');

  return buildSlotContext(slotId, {
    userId:         user?.uid ?? 'anon',
    examId:         examId,
    topic:          topic ?? persona.currentTopic ?? undefined,
    learningStyle:  persona.learningStyle,
    cognitiveLoad:  persona.emotionalState === 'exhausted' || persona.frustrationScore > 7
      ? 'overloaded'
      : persona.emotionalState === 'anxious' || persona.frustrationScore > 4
      ? 'high'
      : persona.emotionalState === 'confident' || persona.emotionalState === 'motivated'
      ? 'low'
      : 'medium',
    daysToExam,
    streakDays:     profile.streak,
    readinessScore: readiness.overallScore,
    mood:           latestMood?.mood,
    sessionMinutes,
    learningMoment: 'study',
    timeOfDay,
    isFirstSession,
    hasSRCardsDue:  dueCards.length > 0,
    hasNewBadge:    profile.badges.some(b => {
      const earnedAt = new Date(b.earnedAt);
      const now = new Date();
      return now.getTime() - earnedAt.getTime() < 24 * 60 * 60 * 1000;
    }),
    role:           user?.role ?? 'student',
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ContentSlot({
  slotId,
  topic,
  compact = false,
  showPersonalizationBadge = false,
  onModuleClick,
  className,
}: ContentSlotProps) {
  const { spacedRepetitionEnabled, gamificationEnabled } = useAppStore();
  const [config, setConfig] = useState<SlotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const resolve = useCallback(() => {
    setLoading(true);
    try {
      const ctx = buildContextFromStores(slotId, topic);
      const resolved = resolveSlot(ctx);

      // Apply feature flag filtering
      const filteredModules = resolved.modules.filter(m => {
        if (m.moduleId === 'spaced_repetition' && !spacedRepetitionEnabled) return false;
        if ((m.moduleId === 'xp_bar' || m.moduleId === 'streak_motivation') && !gamificationEnabled) return false;
        return true;
      });

      setConfig({ ...resolved, modules: filteredModules });
    } catch (err) {
      // Fail gracefully
      console.warn('[ContentSlot] Resolution failed:', err);
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [slotId, topic, spacedRepetitionEnabled, gamificationEnabled]);

  useEffect(() => {
    resolve();
  }, [resolve, refreshKey]);

  // Auto-refresh
  useEffect(() => {
    if (!config?.refreshIntervalMs) return;
    const id = setInterval(() => setRefreshKey(k => k + 1), config.refreshIntervalMs);
    return () => clearInterval(id);
  }, [config?.refreshIntervalMs]);

  if (loading) {
    return (
      <div className={clsx('space-y-2', className)}>
        <ModuleSkeleton compact={compact} />
        {!compact && <ModuleSkeleton compact={compact} />}
      </div>
    );
  }

  if (!config || config.modules.filter(m => m.visible).length === 0) {
    return null;
  }

  const renderLayout = () => {
    switch (config.layout) {
      case 'stack':    return <StackLayout    config={config} compact={compact} onModuleClick={onModuleClick} />;
      case 'carousel': return <CarouselLayout config={config} compact={compact} onModuleClick={onModuleClick} />;
      case 'grid':     return <GridLayout     config={config} compact={compact} onModuleClick={onModuleClick} />;
      case 'single':   return <SingleLayout   config={config} compact={compact} onModuleClick={onModuleClick} />;
      case 'inline':   return <InlineLayout   config={config} compact={compact} onModuleClick={onModuleClick} />;
      default:         return <StackLayout    config={config} compact={compact} onModuleClick={onModuleClick} />;
    }
  };

  return (
    <div className={clsx('relative', className)}>
      {renderLayout()}

      {/* Personalization badge + refresh */}
      {showPersonalizationBadge && (
        <div className="flex items-center justify-between mt-2">
          <PersonalizationBadge modules={config.modules} />
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="text-[10px] text-surface-500 hover:text-surface-300 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
