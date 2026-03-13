/**
 * PersonalizedFeed.tsx — Adaptive Content Feed
 *
 * An intelligent, infinite-scroll feed of personalized content modules.
 * Used in: Learn page (AI Recommended tab), Dashboard.
 *
 * - Loads next batch when 80% scrolled
 * - Adapts in real-time: mood changes mid-session → next batch reflects them
 * - "Why am I seeing this?" tooltip on each card
 * - CEO mode: shows resolution reason + signals overlay
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Info, RefreshCw, Sparkles } from 'lucide-react';
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
import { useAppStore } from '@/stores/appStore';

// Component
import { ContentSlot } from './ContentSlot';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedCard {
  id: string;
  slotId: SlotId;
  topic?: string;
  config: SlotConfig;
  resolvedAt: number;
}

interface PersonalizedFeedProps {
  /** Starting slot for the feed. Defaults to learn_topic_intro. */
  initialSlotId?: SlotId;
  /** Topic context for the feed */
  topic?: string;
  /** CEO mode: show debug overlays */
  ceoMode?: boolean;
  /** Compact layout for widgets */
  compact?: boolean;
  className?: string;
}

// ─── Feed Slot Sequence ───────────────────────────────────────────────────────
// The feed cycles through these slot types to create a varied experience

const FEED_SLOT_SEQUENCE: SlotId[] = [
  'learn_topic_intro',
  'dashboard_hero',
  'chat_post_response',
  'learn_topic_complete',
  'practice_between_q',
  'revision_card',
];

const BATCH_SIZE = 3;

// ─── Why Card ─────────────────────────────────────────────────────────────────

function WhyCard({ config, open, onToggle }: { config: SlotConfig; open: boolean; onToggle: () => void }) {
  return (
    <div className="mt-1">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-[10px] text-surface-500 hover:text-surface-300 transition-colors"
      >
        <Info className="w-3 h-3" />
        Why am I seeing this?
        <ChevronDown className={clsx('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-1 p-2 bg-surface-800/60 rounded-lg border border-surface-700">
              {config.modules.filter(m => m.visible).map((m, i) => (
                <div key={`${m.moduleId}-${i}`} className="mb-1.5 last:mb-0">
                  <p className="text-[10px] font-medium text-surface-300">{m.moduleId}</p>
                  <p className="text-[10px] text-surface-500">{m.reason}</p>
                  <div className="flex gap-1 flex-wrap mt-0.5">
                    {m.personalizationSignals.map(sig => (
                      <span
                        key={sig}
                        className="px-1 py-px bg-primary-500/10 text-primary-400 text-[9px] rounded"
                      >
                        {sig}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── CEO Overlay ──────────────────────────────────────────────────────────────

function CEOOverlay({ card }: { card: FeedCard }) {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      <div className="absolute top-2 right-2 bg-surface-900/95 border border-yellow-500/40 rounded-lg p-1.5 text-[9px] text-yellow-300 max-w-[160px]">
        <p className="font-mono font-bold">{card.slotId}</p>
        <p className="text-[8px] text-surface-400 mt-0.5">
          {card.config.modules.filter(m => m.visible).map(m => m.moduleId).join(' · ')}
        </p>
        <p className="text-[8px] text-surface-500">
          {new Date(card.resolvedAt).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

// ─── Build context from stores ────────────────────────────────────────────────

function buildFeedContext(slotId: SlotId, topic?: string) {
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

  return buildSlotContext(slotId, {
    userId:         user?.uid ?? 'anon',
    examId,
    topic:          topic ?? persona.currentTopic ?? undefined,
    learningStyle:  persona.learningStyle,
    cognitiveLoad:  persona.frustrationScore > 7 ? 'overloaded' :
                    persona.frustrationScore > 4 ? 'high' :
                    persona.emotionalState === 'confident' ? 'low' : 'medium',
    daysToExam,
    streakDays:     profile.streak,
    readinessScore: readiness.overallScore,
    mood:           latestMood?.mood,
    learningMoment: 'study',
    timeOfDay,
    isFirstSession: !localStorage.getItem('eg_has_sessioned'),
    hasSRCardsDue:  dueCards.length > 0,
    hasNewBadge:    profile.badges.some(b => {
      const earnedAt = new Date(b.earnedAt);
      return Date.now() - earnedAt.getTime() < 24 * 60 * 60 * 1000;
    }),
    role: user?.role ?? 'student',
  });
}

function generateFeedCard(
  sequenceIndex: number,
  topic?: string,
  spacedRepetitionEnabled = true,
  gamificationEnabled = true,
): FeedCard | null {
  const slotId = FEED_SLOT_SEQUENCE[sequenceIndex % FEED_SLOT_SEQUENCE.length];
  try {
    const ctx = buildFeedContext(slotId, topic);
    const config = resolveSlot(ctx);

    // Filter by feature flags
    const filtered = config.modules.filter(m => {
      if (m.moduleId === 'spaced_repetition' && !spacedRepetitionEnabled) return false;
      if ((m.moduleId === 'xp_bar' || m.moduleId === 'streak_motivation') && !gamificationEnabled) return false;
      return true;
    });

    if (filtered.filter(m => m.visible).length === 0) return null;

    return {
      id: `feed-${Date.now()}-${sequenceIndex}`,
      slotId,
      topic,
      config: { ...config, modules: filtered },
      resolvedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PersonalizedFeed({
  topic,
  ceoMode = false,
  compact = false,
  className,
}: PersonalizedFeedProps) {
  const { spacedRepetitionEnabled, gamificationEnabled } = useAppStore();
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [openWhyId, setOpenWhyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [seqIndex, setSeqIndex] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadBatch = useCallback(() => {
    if (loading || !hasMore) return;
    setLoading(true);

    const newCards: FeedCard[] = [];
    let idx = seqIndex;

    for (let i = 0; i < BATCH_SIZE; i++) {
      const card = generateFeedCard(idx, topic, spacedRepetitionEnabled, gamificationEnabled);
      if (card) newCards.push(card);
      idx++;
    }

    setSeqIndex(idx);
    setCards(prev => {
      const combined = [...prev, ...newCards];
      // Stop after 12 cards to avoid overwhelming
      if (combined.length >= 12) setHasMore(false);
      return combined;
    });
    setLoading(false);
  }, [loading, hasMore, seqIndex, topic, spacedRepetitionEnabled, gamificationEnabled]);

  // Initial load
  useEffect(() => {
    loadBatch();
    // Mark session started
    if (!localStorage.getItem('eg_session_start')) {
      localStorage.setItem('eg_session_start', Date.now().toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // IntersectionObserver for infinite scroll at 80%
  useEffect(() => {
    if (!sentinelRef.current) return;
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          loadBatch();
        }
      },
      { threshold: 0.1, rootMargin: '200px' },
    );

    observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [loadBatch]);

  const handleRefresh = () => {
    setCards([]);
    setSeqIndex(0);
    setHasMore(true);
    setOpenWhyId(null);
    loadBatch();
  };

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary-400" />
          <span className="text-sm font-semibold text-white">AI Recommended for You</span>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1 text-xs text-surface-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Feed Cards */}
      <AnimatePresence initial={false}>
        {cards.map((card, i) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: (i % BATCH_SIZE) * 0.08, duration: 0.35 }}
            className="relative"
          >
            {ceoMode && <CEOOverlay card={card} />}

            <div className={clsx(
              'rounded-xl border bg-surface-900/60 overflow-hidden',
              ceoMode ? 'border-yellow-500/30' : 'border-surface-700',
            )}>
              <div className={compact ? 'p-3' : 'p-4'}>
                <ContentSlot
                  slotId={card.slotId}
                  topic={card.topic}
                  compact={compact}
                  showPersonalizationBadge={false}
                />
              </div>

              {/* Why am I seeing this */}
              <div className="px-4 pb-3">
                <WhyCard
                  config={card.config}
                  open={openWhyId === card.id}
                  onToggle={() => setOpenWhyId(prev => prev === card.id ? null : card.id)}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: BATCH_SIZE }).map((_, i) => (
            <div
              key={i}
              className={clsx(
                'animate-pulse rounded-xl bg-surface-800/60',
                compact ? 'h-14' : 'h-24',
              )}
            />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {hasMore && <div ref={sentinelRef} className="h-4" />}

      {/* End of feed */}
      {!hasMore && cards.length > 0 && (
        <div className="text-center py-4">
          <p className="text-xs text-surface-500">You've seen all recommendations for now</p>
          <button
            onClick={handleRefresh}
            className="mt-2 text-xs text-primary-400 hover:text-primary-300 transition-colors"
          >
            Load fresh recommendations →
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && cards.length === 0 && (
        <div className="text-center py-8">
          <span className="text-3xl">🤖</span>
          <p className="text-sm text-surface-400 mt-2">Building your personalized feed...</p>
        </div>
      )}
    </div>
  );
}
