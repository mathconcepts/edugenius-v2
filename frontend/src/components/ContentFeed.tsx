/**
 * ContentFeed.tsx — Customer-Centric Content Feed
 *
 * Orchestrates content selection, sequencing, and presentation for each customer.
 * Uses the ContentFramework to determine what to show and how.
 *
 * Behaviour by customer:
 *   Student exam_day        → formula cards first, then MCQs, no extras
 *   Student first_encounter → lesson block → worked example → 3 easy MCQs
 *   Student practice mode   → MCQ stream, adaptive difficulty
 *   Student doubt_resolving → misconception atom → worked example → ask Sage CTA
 *   Teacher                 → editable lesson blocks + pedagogy notes
 *   Parent                  → summary cards only, plain English
 *   CEO                     → all content types with quality overlay
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Filter, Zap, BookOpen, Brain, ArrowUpRight } from 'lucide-react';
import { clsx } from 'clsx';
import { ContentCard } from './ContentCard';
import type {
  ContentAtom,
  CustomerProfile,
  LearningMoment,
  ContentAtomType,
} from '@/services/contentFramework';
import {
  buildCustomerProfile,
  canSeeContent,
} from '@/services/contentFramework';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ContentFeedProps {
  atoms: ContentAtom[];                   // available content atoms
  profileRaw: Parameters<typeof buildCustomerProfile>[0];
  onRequestMore?: () => void;             // load more atoms
  onAtomAction?: (atomId: string, action: string) => void;
  onAtomFeedback?: (atomId: string, rating: number) => void;
  isLoading?: boolean;
  className?: string;
}

// ── Sequencing logic ──────────────────────────────────────────────────────────

/**
 * Determines the ideal order and selection of atoms for a given customer moment.
 */
function sequenceAtoms(atoms: ContentAtom[], profile: CustomerProfile): ContentAtom[] {
  // Filter by visibility
  let visible = atoms.filter(a => canSeeContent(profile.role, a.type));

  // Sort strategy by learning moment
  switch (profile.moment as LearningMoment) {
    case 'exam_day':
      // Formula cards → exam tips → easy MCQs only
      visible = visible
        .filter(a => ['formula_card', 'exam_tip', 'mcq'].includes(a.type))
        .filter(a => a.difficulty !== 'hard')
        .sort((a, b) => {
          const order: ContentAtomType[] = ['formula_card', 'exam_tip', 'mcq'];
          return order.indexOf(a.type) - order.indexOf(b.type);
        });
      break;

    case 'quick_revision':
      // Flashcards → formula cards → summary → MCQs
      visible.sort((a, b) => {
        const order: ContentAtomType[] = ['flashcard', 'formula_card', 'summary', 'mcq', 'exam_tip'];
        return (order.indexOf(a.type) ?? 99) - (order.indexOf(b.type) ?? 99);
      });
      break;

    case 'first_encounter':
      // Lesson block → analogy → worked example → easy MCQs
      visible = visible.filter(a => a.difficulty !== 'hard');
      visible.sort((a, b) => {
        const order: ContentAtomType[] = ['lesson_block', 'analogy', 'worked_example', 'formula_card', 'mcq'];
        return (order.indexOf(a.type) ?? 99) - (order.indexOf(b.type) ?? 99);
      });
      break;

    case 'doubt_resolution':
      // Misconception → analogy → worked example → ask Sage
      visible.sort((a, b) => {
        const order: ContentAtomType[] = ['misconception', 'analogy', 'worked_example', 'lesson_block', 'mcq'];
        return (order.indexOf(a.type) ?? 99) - (order.indexOf(b.type) ?? 99);
      });
      break;

    case 'practice_session':
      // MCQs first, by difficulty progression
      visible.sort((a, b) => {
        if (a.type === 'mcq' && b.type !== 'mcq') return -1;
        if (a.type !== 'mcq' && b.type === 'mcq') return 1;
        const diffOrder = { easy: 0, medium: 1, hard: 2 };
        return (diffOrder[a.difficulty] ?? 1) - (diffOrder[b.difficulty] ?? 1);
      });
      // Adaptive: if mastery > 70%, push harder atoms earlier
      if ((profile.masteryPct ?? 0) > 70) {
        visible.sort((a, b) => {
          const diffOrder = { hard: 0, medium: 1, easy: 2 };
          return (diffOrder[a.difficulty] ?? 1) - (diffOrder[b.difficulty] ?? 1);
        });
      }
      break;

    case 'lesson_planning':
      // Teacher: lesson blocks → worked examples → MCQ sets → formula cards
      visible.sort((a, b) => {
        const order: ContentAtomType[] = ['lesson_block', 'concept_map', 'worked_example', 'practice_set', 'formula_card', 'mcq'];
        return (order.indexOf(a.type) ?? 99) - (order.indexOf(b.type) ?? 99);
      });
      break;

    case 'content_audit':
      // CEO: sort by quality score ascending (lowest quality first for review)
      visible.sort((a, b) => {
        const qA = (a.quality.accuracy + a.quality.clarity + a.quality.examRelevance) / 3;
        const qB = (b.quality.accuracy + b.quality.clarity + b.quality.examRelevance) / 3;
        return qA - qB;
      });
      break;

    case 'progress_check':
      // Parent: summaries only, already filtered by canSeeContent
      break;

    default:
      // Default: high exam relevance first
      visible.sort((a, b) => b.quality.examRelevance - a.quality.examRelevance);
  }

  return visible;
}

// ── Feed header ───────────────────────────────────────────────────────────────

function FeedHeader({ profile, count }: { profile: CustomerProfile; count: number }) {
  const titles: Record<LearningMoment, string> = {
    exam_day: '⚡ Exam Day Focus — Key Formulas & Tips',
    quick_revision: '🔄 Quick Revision Pack',
    first_encounter: '🌱 New Topic — Let\'s Build It',
    doubt_resolution: '🔍 Let\'s Fix That Confusion',
    practice_session: '🎯 Practice Session',
    building_concept: '📖 Learning Materials',
    lesson_planning: '📋 Teaching Materials',
    classroom_delivery: '🖥 Classroom Content',
    student_review: '📊 Student Content Review',
    progress_check: '📈 Your Child\'s Progress',
    content_audit: '🔎 Content Quality Review',
    performance_review: '📊 Performance Overview',
  };

  const subtitles: Partial<Record<LearningMoment, string>> = {
    exam_day: profile.daysToExam === 0 ? 'Exam today — you\'ve got this.' : `${profile.daysToExam} day${profile.daysToExam === 1 ? '' : 's'} to go.`,
    practice_session: `${count} items · adaptive difficulty`,
    content_audit: `${count} atoms · sorted by quality score`,
  };

  return (
    <div className="space-y-1 mb-4">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {titles[profile.moment] ?? 'Your Content'}
      </h2>
      {subtitles[profile.moment] && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{subtitles[profile.moment]}</p>
      )}
    </div>
  );
}

// ── Filter bar (compact) ──────────────────────────────────────────────────────

const FILTER_LABELS: Partial<Record<ContentAtomType, string>> = {
  mcq: 'MCQs',
  formula_card: 'Formulas',
  flashcard: 'Flashcards',
  lesson_block: 'Lessons',
  worked_example: 'Examples',
  exam_tip: 'Tips',
};

function FilterBar({
  available,
  active,
  onChange,
}: {
  available: ContentAtomType[];
  active: ContentAtomType | 'all';
  onChange: (f: ContentAtomType | 'all') => void;
}) {
  const types = ['all' as const, ...available.filter(t => FILTER_LABELS[t])];
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
      {types.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={clsx(
            'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
            active === t
              ? 'bg-violet-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
          )}
        >
          {t === 'all' ? 'All' : FILTER_LABELS[t]}
        </button>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ profile }: { profile: CustomerProfile }) {
  const messages: Record<string, string> = {
    student: 'No content found for this topic yet. Ask Sage to explain it!',
    teacher: 'No teaching materials found. Generate some from the Content tab.',
    parent: 'No progress data yet — check back after your child studies.',
    ceo: 'No content atoms match the current filter.',
  };
  return (
    <div className="text-center py-12 space-y-2">
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">
        <BookOpen className="w-6 h-6 text-slate-400" />
      </div>
      <p className="text-slate-500 dark:text-slate-400 text-sm">
        {messages[profile.role] ?? 'No content found.'}
      </p>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export function ContentFeed({
  atoms,
  profileRaw,
  onRequestMore,
  onAtomAction,
  onAtomFeedback,
  isLoading = false,
  className,
}: ContentFeedProps) {
  const profile = buildCustomerProfile(profileRaw);
  const [activeFilter, setActiveFilter] = useState<ContentAtomType | 'all'>('all');
  const [visibleCount, setVisibleCount] = useState(
    profile.moment === 'exam_day' ? 4 : profile.moment === 'quick_revision' ? 6 : 8,
  );

  // Get available atom types for filter bar
  const availableTypes = [...new Set(atoms.map(a => a.type))];

  // Sequence atoms
  const sequenced = sequenceAtoms(atoms, profile);

  // Apply filter
  const filtered = activeFilter === 'all'
    ? sequenced
    : sequenced.filter(a => a.type === activeFilter);

  // Visible slice
  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const handleLoadMore = useCallback(() => {
    setVisibleCount(v => v + 6);
    if (hasMore && visible.length >= sequenced.length) {
      onRequestMore?.();
    }
  }, [hasMore, visible.length, sequenced.length, onRequestMore]);

  // Reset count on filter change
  useEffect(() => { setVisibleCount(8); }, [activeFilter]);

  if (atoms.length === 0 && !isLoading) {
    return (
      <div className={className}>
        <FeedHeader profile={profile} count={0} />
        <EmptyState profile={profile} />
      </div>
    );
  }

  const renderSurface = profile.channel === 'whatsapp' ? 'fullpage' : 'card';

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Header */}
      <FeedHeader profile={profile} count={filtered.length} />

      {/* Filter bar — not shown for exam_day or parent */}
      {profile.moment !== 'exam_day' && profile.role !== 'parent' && availableTypes.length > 2 && (
        <FilterBar
          available={availableTypes}
          active={activeFilter}
          onChange={setActiveFilter}
        />
      )}

      {/* Exam day urgency banner */}
      {profile.moment === 'exam_day' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3">
          <Zap className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Exam day mode</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">Showing only the highest-priority formulas and tips. You&apos;ve got this.</p>
          </div>
        </div>
      )}

      {/* CEO insights banner */}
      {profile.role === 'ceo' && atoms.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 flex items-center gap-4 text-sm">
          <Brain className="w-5 h-5 text-violet-500 flex-shrink-0" />
          <div className="flex gap-6 flex-wrap">
            <span className="text-slate-600 dark:text-slate-400">
              <strong className="text-slate-900 dark:text-slate-100">{atoms.length}</strong> total atoms
            </span>
            <span className="text-slate-600 dark:text-slate-400">
              <strong className="text-green-600">{atoms.filter(a => a.quality.wolframVerified).length}</strong> Wolfram-verified
            </span>
            <span className="text-slate-600 dark:text-slate-400">
              <strong className="text-amber-600">{atoms.filter(a => !a.quality.reviewedByHuman).length}</strong> pending human review
            </span>
            <span className="text-slate-600 dark:text-slate-400">
              Avg quality: <strong className="text-violet-600">
                {(atoms.reduce((s, a) => s + (a.quality.accuracy + a.quality.clarity + a.quality.examRelevance) / 3, 0) / atoms.length * 100).toFixed(0)}%
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Content grid */}
      <div className={clsx(
        'grid gap-4',
        profile.role === 'ceo' ? 'grid-cols-1' :
        profile.channel === 'whatsapp' ? 'grid-cols-1' :
        profile.deviceType === 'mobile' ? 'grid-cols-1' :
        profile.moment === 'practice_session' ? 'grid-cols-1 max-w-2xl' :
        'grid-cols-1 lg:grid-cols-2',
      )}>
        <AnimatePresence mode="popLayout">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <motion.div
                  key={`skeleton-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-48 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"
                />
              ))
            : visible.map((atom, i) => (
                <motion.div
                  key={atom.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  layout
                >
                  <ContentCard
                    atom={atom}
                    profileRaw={profileRaw}
                    renderSurface={renderSurface}
                    onCTA={(action) => onAtomAction?.(atom.id, action)}
                    onFeedback={(rating) => onAtomFeedback?.(atom.id, rating)}
                  />
                </motion.div>
              ))}
        </AnimatePresence>
      </div>

      {/* Load more */}
      {hasMore && !isLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
          <button
            onClick={handleLoadMore}
            className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Load more ({filtered.length - visibleCount} remaining)
          </button>
        </motion.div>
      )}

      {/* Ask Sage CTA (for doubt resolution) */}
      {profile.moment === 'doubt_resolution' && !isLoading && (
        <div className="border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-violet-900 dark:text-violet-200">Still confused?</p>
            <p className="text-xs text-violet-600 dark:text-violet-400">Sage can give you a personalized explanation.</p>
          </div>
          <button
            onClick={() => onAtomAction?.('sage', 'ask_sage')}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700"
          >
            Ask Sage <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default ContentFeed;
