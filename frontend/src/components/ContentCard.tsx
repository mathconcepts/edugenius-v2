/**
 * ContentCard.tsx — Customer-Centric Content Presentation Component
 *
 * The universal content renderer. Takes a ContentAtom + CustomerProfile
 * and renders it appropriately for that customer using RenderDirectives.
 *
 * Renders differently for:
 *   Student exam_day          → compact, urgent, formula-first
 *   Student first_encounter   → full lesson, encouraging, step-by-step
 *   Student frustrated        → minimal, calming, hint-first
 *   Teacher lesson_planning   → rich, with pedagogy notes + edit CTA
 *   Parent progress_check     → plain English, no jargon
 *   CEO content_audit         → quality scores, engagement metrics, full data
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Lightbulb, Target, CheckCircle, XCircle, ChevronDown, ChevronUp,
  BookOpen, Pencil, BarChart3, Zap, AlertTriangle, Star, Clock,
  ThumbsUp, ThumbsDown, ArrowRight, Eye, Download, Share2,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { ContentAtom, CustomerProfile, RenderDirective } from '@/services/contentFramework';
import { resolvePresentation, buildCustomerProfile } from '@/services/contentFramework';
import { recordFeedback } from '@/services/contentFeedbackService';
import { getEffectiveStrategy } from '@/services/contentStrategyService';
import { loadCurrentUser } from '@/services/userService';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ContentCardProps {
  atom: ContentAtom;
  profileRaw: Parameters<typeof buildCustomerProfile>[0];
  renderSurface?: 'card' | 'fullpage';
  onCTA?: (action: RenderDirective['primaryCTA'] extends null ? never : NonNullable<RenderDirective['primaryCTA']>['action']) => void;
  onFeedback?: (rating: 1 | 2 | 3 | 4 | 5) => void;
  className?: string;
}

// ── Helper: tone → colour mapping ─────────────────────────────────────────────

function toneToAccent(tone: RenderDirective['tone']): string {
  switch (tone) {
    case 'encouraging': return 'from-blue-500 to-cyan-500';
    case 'calm':        return 'from-indigo-500 to-purple-500';
    case 'upbeat':      return 'from-emerald-500 to-teal-500';
    case 'urgent':      return 'from-amber-500 to-orange-500';
    case 'authoritative': return 'from-slate-600 to-slate-700';
    default:            return 'from-violet-500 to-purple-600';
  }
}

function toneToBorder(tone: RenderDirective['tone']): string {
  switch (tone) {
    case 'encouraging': return 'border-blue-200 dark:border-blue-800';
    case 'calm':        return 'border-indigo-200 dark:border-indigo-800';
    case 'upbeat':      return 'border-emerald-200 dark:border-emerald-800';
    case 'urgent':      return 'border-amber-200 dark:border-amber-800';
    case 'authoritative': return 'border-slate-300 dark:border-slate-600';
    default:            return 'border-violet-200 dark:border-violet-800';
  }
}

// ── Difficulty badge ──────────────────────────────────────────────────────────

function DifficultyBadge({ difficulty }: { difficulty: ContentAtom['difficulty'] }) {
  const styles = {
    easy:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    hard:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', styles[difficulty])}>
      {difficulty}
    </span>
  );
}

// ── Quality badge (CEO only) ──────────────────────────────────────────────────

function QualityBadge({ atom }: { atom: ContentAtom }) {
  const avg = ((atom.quality.accuracy + atom.quality.clarity + atom.quality.examRelevance) / 3 * 100).toFixed(0);
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      <span className="flex items-center gap-1">
        <CheckCircle className="w-3 h-3 text-green-500" />
        Accuracy {(atom.quality.accuracy * 100).toFixed(0)}%
      </span>
      <span className="flex items-center gap-1">
        <Eye className="w-3 h-3 text-blue-500" />
        Clarity {(atom.quality.clarity * 100).toFixed(0)}%
      </span>
      <span className="flex items-center gap-1">
        <Target className="w-3 h-3 text-purple-500" />
        Relevance {(atom.quality.examRelevance * 100).toFixed(0)}%
      </span>
      <span className="font-medium text-slate-700 dark:text-slate-300">Avg {avg}%</span>
      {atom.quality.wolframVerified && (
        <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded">
          ∑ Wolfram
        </span>
      )}
    </div>
  );
}

// ── MCQ renderer ─────────────────────────────────────────────────────────────

function MCQRenderer({ atom, directive }: { atom: ContentAtom; directive: RenderDirective }) {
  const [selected, setSelected] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);

  if (!atom.mcq) return null;
  const { question, options, correct, explanation, examTip } = atom.mcq;

  const optionStyle = (key: 'A' | 'B' | 'C' | 'D') => {
    if (!revealed) {
      return selected === key
        ? 'bg-violet-100 dark:bg-violet-900/30 border-violet-400'
        : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700';
    }
    if (key === correct) return 'bg-green-50 dark:bg-green-900/30 border-green-400';
    if (key === selected && key !== correct) return 'bg-red-50 dark:bg-red-900/30 border-red-400';
    return 'border-slate-200 dark:border-slate-700 opacity-50';
  };

  return (
    <div className="space-y-4">
      {/* Question */}
      <p className="text-slate-900 dark:text-slate-100 font-medium leading-relaxed">{question}</p>

      {/* Options */}
      <div className="space-y-2">
        {(['A', 'B', 'C', 'D'] as const).map(key => (
          <button
            key={key}
            disabled={revealed}
            onClick={() => setSelected(key)}
            className={clsx(
              'w-full text-left px-4 py-3 rounded-lg border transition-all text-sm',
              optionStyle(key),
            )}
          >
            <span className="font-semibold mr-2">{key}.</span>
            {options[key]}
            {revealed && key === correct && (
              <CheckCircle className="inline ml-2 w-4 h-4 text-green-600" />
            )}
            {revealed && key === selected && key !== correct && (
              <XCircle className="inline ml-2 w-4 h-4 text-red-500" />
            )}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {!revealed && selected && (
          <button
            onClick={() => setRevealed(true)}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            Check Answer
          </button>
        )}
        {directive.hintAvailable && !revealed && (
          <button
            onClick={() => setShowHint(v => !v)}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
          >
            <Lightbulb className="w-4 h-4" />
            {showHint ? 'Hide Hint' : 'Hint'}
          </button>
        )}
      </div>

      {/* Hint */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300"
          >
            💡 Think about which option would be true if you applied the core formula for this topic.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Explanation (after reveal) */}
      <AnimatePresence>
        {revealed && directive.showExplanation && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-2"
          >
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Explanation</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{explanation}</p>
            {directive.showExamTip && examTip && (
              <div className="mt-2 flex items-start gap-2 text-sm text-violet-700 dark:text-violet-300">
                <Zap className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span><strong>Exam tip:</strong> {examTip}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Formula renderer ──────────────────────────────────────────────────────────

function FormulaRenderer({ atom, directive }: { atom: ContentAtom; directive: RenderDirective }) {
  if (!atom.formula) return null;
  const { latex, plainText, intuition, whenToUse, pitfalls } = atom.formula;
  const [showDetails, setShowDetails] = useState(directive.density !== 'compact');

  const formulaDisplay = directive.mathRenderMode === 'latex'
    ? <code className="text-lg font-mono bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded block text-center">{latex}</code>
    : <p className="font-mono text-base text-center bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded">{plainText}</p>;

  return (
    <div className="space-y-3">
      {formulaDisplay}
      {directive.density !== 'minimal' && (
        <>
          <button
            onClick={() => setShowDetails(v => !v)}
            className="text-sm text-violet-600 dark:text-violet-400 flex items-center gap-1"
          >
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showDetails ? 'Less' : 'Show intuition & usage'}
          </button>
          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Intuition</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{intuition}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">When to use</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{whenToUse}</p>
                </div>
                {pitfalls.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">⚠ Common mistakes</p>
                    <ul className="space-y-1">
                      {pitfalls.map((p, i) => (
                        <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                          <span className="text-red-400 mt-0.5">•</span> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

// ── Lesson block renderer ─────────────────────────────────────────────────────

function LessonBlockRenderer({ atom, directive }: { atom: ContentAtom; directive: RenderDirective }) {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed">
      <div dangerouslySetInnerHTML={{ __html: directive.displayBody.replace(/\n/g, '<br/>') }} />
      {directive.showPedagogyNote && (
        <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1">
            <BookOpen className="w-3 h-3" /> Pedagogy Note
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Introduce with a real-world hook before stating the formal definition. Check student understanding with "What would happen if..." questions.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Flashcard renderer ────────────────────────────────────────────────────────

function FlashcardRenderer({ atom }: { atom: ContentAtom }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div
      onClick={() => setFlipped(v => !v)}
      className="cursor-pointer min-h-[120px] flex items-center justify-center"
    >
      <AnimatePresence mode="wait">
        {!flipped ? (
          <motion.div
            key="front"
            initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} exit={{ rotateY: -90 }}
            className="text-center"
          >
            <p className="text-xs text-slate-400 mb-2">Question (tap to flip)</p>
            <p className="font-medium text-slate-900 dark:text-slate-100">{atom.title}</p>
          </motion.div>
        ) : (
          <motion.div
            key="back"
            initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} exit={{ rotateY: -90 }}
            className="text-center"
          >
            <p className="text-xs text-green-500 mb-2">Answer ✓</p>
            <p className="text-slate-700 dark:text-slate-300">{atom.body}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ config }: { config: NonNullable<RenderDirective['progressBarConfig']> }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{config.label}</span>
        <span>{config.current}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full transition-all duration-500"
          style={{ width: `${config.current}%` }}
        />
      </div>
    </div>
  );
}

// ── CTA Button ────────────────────────────────────────────────────────────────

function CTAButton({ cta, onClick }: {
  cta: NonNullable<RenderDirective['primaryCTA']>;
  onClick: (action: typeof cta['action']) => void;
}) {
  const base = 'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5';
  const variants = {
    primary: 'bg-violet-600 text-white hover:bg-violet-700',
    secondary: 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
    ghost: 'text-violet-600 dark:text-violet-400 hover:underline',
  };
  return (
    <button
      onClick={() => onClick(cta.action)}
      className={clsx(base, variants[cta.variant])}
    >
      {cta.label}
      {cta.variant === 'primary' && <ArrowRight className="w-4 h-4" />}
    </button>
  );
}

// ── Feedback widget ───────────────────────────────────────────────────────────

/** Legacy widget used by the existing onFeedback prop */
function LegacyFeedbackWidget({ onFeedback }: { onFeedback: (r: 1 | 2 | 3 | 4 | 5) => void }) {
  const [rated, setRated] = useState<number | null>(null);
  if (rated !== null) {
    return <p className="text-xs text-green-600 dark:text-green-400">Thanks for the feedback! 🙌</p>;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400">Was this helpful?</span>
      <button onClick={() => { setRated(5); onFeedback(5); }} className="text-slate-400 hover:text-amber-400">
        <ThumbsUp className="w-4 h-4" />
      </button>
      <button onClick={() => { setRated(1); onFeedback(1); }} className="text-slate-400 hover:text-red-400">
        <ThumbsDown className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Enhanced feedback widget wired into contentFeedbackService */
interface FeedbackWidgetProps {
  atomId: string;
  atomType: import('@/services/contentFramework').ContentAtomType;
  topic: string;
  examType: string;
  strategyId: import('@/services/contentStrategyService').ContentStrategyId;
}

function FeedbackWidget({ atomId, atomType, topic, examType, strategyId }: FeedbackWidgetProps) {
  const [given, setGiven] = useState<'up' | 'down' | null>(null);
  const mountTimeRef = useRef<number>(Date.now());
  const user = loadCurrentUser();
  const userId = user?.uid ?? 'anon';

  // On unmount: record implicit signal based on time spent
  useEffect(() => {
    return () => {
      const elapsed = (Date.now() - mountTimeRef.current) / 1000; // seconds
      // Record time_on_content
      recordFeedback({
        atomId,
        atomType,
        topic,
        examType,
        signal: 'time_on_content',
        value: elapsed,
        userId,
        strategyId,
      });
      // If no explicit feedback was given, infer from time
      if (given === null) {
        if (elapsed >= 30) {
          recordFeedback({ atomId, atomType, topic, examType, signal: 'completed', userId, strategyId });
        } else if (elapsed < 10) {
          recordFeedback({ atomId, atomType, topic, examType, signal: 'skipped', userId, strategyId });
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [given]);

  const handleThumbsUp = () => {
    setGiven('up');
    recordFeedback({ atomId, atomType, topic, examType, signal: 'thumbs_up', userId, strategyId });
  };

  const handleThumbsDown = () => {
    setGiven('down');
    recordFeedback({ atomId, atomType, topic, examType, signal: 'thumbs_down', userId, strategyId });
  };

  if (given !== null) {
    return (
      <p className="text-xs text-emerald-600 dark:text-emerald-400">Thanks! 🙌</p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 dark:text-surface-500">Helpful?</span>
      <button
        onClick={handleThumbsUp}
        className="text-slate-400 hover:text-emerald-500 transition-colors"
        aria-label="Thumbs up"
      >
        <ThumbsUp className="w-4 h-4" />
      </button>
      <button
        onClick={handleThumbsDown}
        className="text-slate-400 hover:text-red-400 transition-colors"
        aria-label="Thumbs down"
      >
        <ThumbsDown className="w-4 h-4" />
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════

export function ContentCard({ atom, profileRaw, renderSurface = 'card', onCTA, onFeedback, className }: ContentCardProps) {
  const customer = buildCustomerProfile(profileRaw);
  const directive = resolvePresentation({ customer, contentAtom: atom, renderSurface, showMetadata: false });

  // Resolve effective strategy for the feedback widget
  const currentUser = loadCurrentUser();
  const effectiveStrategy = getEffectiveStrategy(currentUser?.uid);

  const handleCTA = useCallback((action: string) => {
    onCTA?.(action as any);
  }, [onCTA]);

  const handleFeedback = useCallback((rating: 1 | 2 | 3 | 4 | 5) => {
    onFeedback?.(rating);
  }, [onFeedback]);

  const accent = toneToAccent(directive.tone);
  const border = toneToBorder(directive.tone);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={clsx(
        'bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden',
        border,
        className,
      )}
    >
      {/* Tone accent stripe */}
      <div className={clsx('h-1 bg-gradient-to-r', accent)} />

      <div className={clsx(
        'p-5 space-y-4',
        directive.density === 'minimal' && 'p-3 space-y-2',
        directive.density === 'compact' && 'p-4 space-y-3',
      )}>

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            {/* Preface text */}
            {directive.prefaceText && (
              <p className={clsx(
                'text-xs font-medium px-2 py-1 rounded-md inline-block',
                directive.tone === 'calm' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' :
                directive.tone === 'urgent' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
              )}>
                {directive.useEmoji && '💬 '}{directive.prefaceText}
              </p>
            )}

            {/* Title */}
            <h3 className={clsx(
              'font-semibold text-slate-900 dark:text-slate-100 leading-tight',
              directive.density === 'minimal' ? 'text-sm' : 'text-base',
            )}>
              {directive.displayTitle}
            </h3>

            {/* Meta row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500">{atom.examId.toUpperCase()} · {atom.topic}</span>
              {directive.showDifficultyBadge && <DifficultyBadge difficulty={atom.difficulty} />}
              {atom.quality.wolframVerified && directive.density !== 'minimal' && (
                <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded">
                  ∑ Verified
                </span>
              )}
              {atom.syllabusPriority === 'high' && directive.useEmoji && (
                <span className="text-xs text-amber-600 dark:text-amber-400">⭐ High priority</span>
              )}
            </div>
          </div>

          {/* Type icon */}
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
            {atom.type === 'mcq' || atom.type === 'practice_set' ? <Target className="w-4 h-4 text-violet-500" /> :
             atom.type === 'formula_card' ? <Brain className="w-4 h-4 text-blue-500" /> :
             atom.type === 'flashcard' ? <Zap className="w-4 h-4 text-amber-500" /> :
             atom.type === 'exam_tip' ? <Star className="w-4 h-4 text-orange-500" /> :
             atom.type === 'misconception' ? <AlertTriangle className="w-4 h-4 text-red-500" /> :
             <BookOpen className="w-4 h-4 text-slate-500" />}
          </div>
        </div>

        {/* CEO quality badge */}
        {directive.showQualityBadge && <QualityBadge atom={atom} />}

        {/* Progress bar */}
        {directive.progressBarConfig && <ProgressBar config={directive.progressBarConfig} />}

        {/* ── CONTENT BODY ── */}
        {/* MCQ */}
        {(atom.type === 'mcq' || atom.type === 'practice_set') && (
          <MCQRenderer atom={atom} directive={directive} />
        )}

        {/* Formula */}
        {atom.type === 'formula_card' && (
          <FormulaRenderer atom={atom} directive={directive} />
        )}

        {/* Flashcard */}
        {atom.type === 'flashcard' && (
          <FlashcardRenderer atom={atom} />
        )}

        {/* Lesson block / summary / blog / misconception / exam tip / analogy */}
        {['lesson_block', 'summary', 'blog_post', 'misconception', 'exam_tip', 'analogy', 'worked_example', 'visual_explainer'].includes(atom.type) && (
          <LessonBlockRenderer atom={atom} directive={directive} />
        )}

        {/* Closing text */}
        {directive.closingText && directive.density !== 'minimal' && (
          <p className={clsx(
            'text-sm italic',
            directive.tone === 'upbeat' ? 'text-emerald-600 dark:text-emerald-400' :
            directive.tone === 'urgent' ? 'text-amber-600 dark:text-amber-400' :
            'text-slate-500 dark:text-slate-400',
          )}>
            {directive.closingText}
          </p>
        )}

        {/* Misconception warning */}
        {directive.showMisconceptionWarning && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">
              ⚠ Common misconception — many students get this wrong. Read carefully.
            </p>
          </div>
        )}

        {/* ── FOOTER ROW ── */}
        {directive.density !== 'minimal' && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
            {/* CTAs */}
            <div className="flex items-center gap-2">
              {directive.primaryCTA && (
                <CTAButton cta={directive.primaryCTA} onClick={handleCTA} />
              )}
              {directive.secondaryCTA && (
                <CTAButton cta={directive.secondaryCTA} onClick={handleCTA} />
              )}
            </div>

            {/* Right side: feedback / admin actions */}
            <div className="flex items-center gap-3">
              {directive.feedbackWidget && (
                effectiveStrategy.feedbackRequired ? (
                  <FeedbackWidget
                    atomId={atom.id}
                    atomType={atom.type}
                    topic={atom.topic}
                    examType={atom.examId}
                    strategyId={effectiveStrategy.id}
                  />
                ) : (
                  <LegacyFeedbackWidget onFeedback={handleFeedback} />
                )
              )}
              {directive.showQualityBadge && (
                <div className="flex items-center gap-2">
                  <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    <BarChart3 className="w-4 h-4" />
                  </button>
                  <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              )}
              {directive.showPedagogyNote && customer.role === 'teacher' && (
                <button className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                  <Share2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* CEO analytics row */}
        {directive.showQualityBadge && directive.density === 'rich' && (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-xs text-slate-500 flex items-center gap-4">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {atom.timesServed.toLocaleString()} served</span>
            <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-400" /> {atom.avgRating > 0 ? atom.avgRating.toFixed(1) : '—'}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {atom.completionRate > 0 ? `${(atom.completionRate * 100).toFixed(0)}% done` : 'No data'}</span>
            <span className="font-medium">v{atom.version}</span>
            <span>by {atom.generatedBy}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default ContentCard;
