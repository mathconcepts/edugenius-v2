/**
 * ExitIntentQuiz — Exit-intent micro-quiz for blog posts
 *
 * Fires when the user has scrolled to the bottom of a blog article
 * without clicking any CTA. Asks 3 diagnostic questions and routes
 * to Sage with full context pre-loaded.
 *
 * Rules:
 * - Shows max once per session per post (tracked in sessionStorage)
 * - Dismissible (won't re-show this session)
 * - Mobile-first modal overlay
 * - All deep-links use source=blog_quiz for Prism tracking
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { X, ChevronRight, Sparkles, BookOpen } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Exam     = 'JEE' | 'NEET' | 'CBSE' | 'Other';
type Subject  = 'Physics' | 'Chemistry' | 'Maths' | 'Biology' | 'Other';
type Urgency  = 'low' | 'medium' | 'high';   // >6m / 2-6m / <2m

interface QuizAnswers {
  exam:    Exam    | null;
  subject: Subject | null;
  urgency: Urgency | null;
}

interface ExitIntentQuizProps {
  /** Post slug — used to key sessionStorage so we only show once per post */
  postSlug: string;
  /** Post title — pre-seeds Sage context */
  postTitle: string;
  /** Primary exam tag on the post — pre-selects the exam step */
  defaultExam?: string;
}

// ─── Storage helpers ───────────────────────────────────────────────────────────

const seenKey = (slug: string) => `edugenius_quiz_seen_${slug}`;

function markSeen(slug: string) {
  try { sessionStorage.setItem(seenKey(slug), '1'); } catch { /* noop */ }
}

function hasSeen(slug: string): boolean {
  try { return !!sessionStorage.getItem(seenKey(slug)); } catch { return false; }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface OptionButtonProps {
  label: string;
  emoji: string;
  selected: boolean;
  onClick: () => void;
}

function OptionButton({ label, emoji, selected, onClick }: OptionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all
        ${selected
          ? 'bg-primary-500/20 border-primary-500 text-primary-300 shadow-lg shadow-primary-500/10'
          : 'bg-surface-800 border-surface-700 text-surface-300 hover:border-surface-500 hover:text-white'
        }
      `}
    >
      <span className="text-lg flex-shrink-0">{emoji}</span>
      <span>{label}</span>
      {selected && <ChevronRight className="w-4 h-4 ml-auto text-primary-400" />}
    </button>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ExitIntentQuiz({ postSlug, postTitle, defaultExam }: ExitIntentQuizProps) {
  const navigate   = useNavigate();
  const [visible,  setVisible]  = useState(false);
  const [step,     setStep]     = useState(0); // 0=exam, 1=subject, 2=urgency, 3=done
  const [answers,  setAnswers]  = useState<QuizAnswers>({ exam: null, subject: null, urgency: null });
  const firedRef   = useRef(false);

  // ── Trigger: scroll to bottom without CTA click ──────────────────────────────
  useEffect(() => {
    if (hasSeen(postSlug)) return;

    const handleScroll = () => {
      if (firedRef.current) return;

      const scrolled     = window.scrollY + window.innerHeight;
      const total        = document.documentElement.scrollHeight;
      const nearBottom   = scrolled >= total - 200; // within 200px of bottom

      if (nearBottom) {
        firedRef.current = true;
        // Small delay so it doesn't feel jarring
        setTimeout(() => setVisible(true), 600);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [postSlug]);

  // Pre-select exam from post tag if available
  useEffect(() => {
    if (defaultExam) {
      const normalized = defaultExam.toUpperCase();
      if (['JEE', 'NEET', 'CBSE'].includes(normalized)) {
        setAnswers(a => ({ ...a, exam: normalized as Exam }));
      }
    }
  }, [defaultExam]);

  const dismiss = useCallback(() => {
    markSeen(postSlug);
    setVisible(false);
  }, [postSlug]);

  const handleExam = (exam: Exam) => {
    setAnswers(a => ({ ...a, exam }));
    setStep(1);
  };

  const handleSubject = (subject: Subject) => {
    setAnswers(a => ({ ...a, subject }));
    setStep(2);
  };

  const handleUrgency = (urgency: Urgency) => {
    const finalAnswers = { ...answers, urgency };
    setAnswers(finalAnswers);
    setStep(3);
    markSeen(postSlug);

    // Build deep-link with full context
    const params = new URLSearchParams({
      source:  'blog_quiz',
      exam:    finalAnswers.exam    ?? 'JEE',
      subject: finalAnswers.subject ?? 'Physics',
      urgency: finalAnswers.urgency ?? 'medium',
      topic:   postTitle,
      slug:    postSlug,
    });

    setTimeout(() => {
      navigate(`/chat?${params.toString()}`);
    }, 1200); // show "done" state briefly before navigating
  };

  // Subject options vary slightly by exam
  const subjectOptions: { label: Subject; emoji: string }[] =
    answers.exam === 'NEET'
      ? [
          { label: 'Physics',   emoji: '⚡' },
          { label: 'Chemistry', emoji: '🧪' },
          { label: 'Biology',   emoji: '🧬' },
          { label: 'Other',     emoji: '📖' },
        ]
      : [
          { label: 'Physics',   emoji: '⚡' },
          { label: 'Chemistry', emoji: '🧪' },
          { label: 'Maths',     emoji: '📐' },
          { label: 'Other',     emoji: '📖' },
        ];

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
            onClick={dismiss}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1     }}
            exit={{   opacity: 0, y: 40, scale: 0.96   }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:left-1/2 sm:-translate-x-1/2 z-50 w-full sm:max-w-md"
          >
            <div className="bg-surface-900 sm:rounded-2xl border border-surface-700 shadow-2xl rounded-t-3xl overflow-hidden">

              {/* Handle (mobile) */}
              <div className="flex justify-center pt-3 sm:hidden">
                <div className="w-10 h-1 bg-surface-600 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-start justify-between px-6 pt-5 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-primary-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">Before you go…</p>
                    <p className="text-surface-500 text-xs">Let Sage personalise your help</p>
                  </div>
                </div>
                <button onClick={dismiss} className="text-surface-500 hover:text-surface-300 transition-colors p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Progress bar */}
              <div className="h-0.5 bg-surface-800 mx-6 rounded-full mb-5">
                <motion.div
                  className="h-full bg-primary-500 rounded-full"
                  animate={{ width: `${step >= 3 ? 100 : (step / 3) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Steps */}
              <div className="px-6 pb-6 min-h-[200px]">
                <AnimatePresence mode="wait">

                  {/* Step 0 — Exam */}
                  {step === 0 && (
                    <motion.div key="step-exam"
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    >
                      <p className="text-white font-medium mb-4">What exam are you preparing for?</p>
                      <div className="space-y-2">
                        {([
                          { label: 'JEE',   emoji: '🏆' },
                          { label: 'NEET',  emoji: '🩺' },
                          { label: 'CBSE',  emoji: '📚' },
                          { label: 'Other', emoji: '🎯' },
                        ] as { label: Exam; emoji: string }[]).map(({ label, emoji }) => (
                          <OptionButton key={label} label={label} emoji={emoji}
                            selected={answers.exam === label} onClick={() => handleExam(label)} />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 1 — Subject */}
                  {step === 1 && (
                    <motion.div key="step-subject"
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    >
                      <p className="text-white font-medium mb-4">Which subject is hardest for you right now?</p>
                      <div className="space-y-2">
                        {subjectOptions.map(({ label, emoji }) => (
                          <OptionButton key={label} label={label} emoji={emoji}
                            selected={answers.subject === label} onClick={() => handleSubject(label)} />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2 — Urgency */}
                  {step === 2 && (
                    <motion.div key="step-urgency"
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    >
                      <p className="text-white font-medium mb-4">How much time until your exam?</p>
                      <div className="space-y-2">
                        {([
                          { label: 'More than 6 months', emoji: '🗓️', value: 'low'    as Urgency },
                          { label: '2 – 6 months',       emoji: '⏳', value: 'medium' as Urgency },
                          { label: 'Less than 2 months', emoji: '🔥', value: 'high'   as Urgency },
                        ]).map(({ label, emoji, value }) => (
                          <OptionButton key={value} label={label} emoji={emoji}
                            selected={answers.urgency === value} onClick={() => handleUrgency(value)} />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3 — Done, navigating */}
                  {step === 3 && (
                    <motion.div key="step-done"
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center justify-center py-6 text-center"
                    >
                      <motion.div
                        animate={{ rotate: [0, -10, 10, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="text-4xl mb-3"
                      >
                        🎓
                      </motion.div>
                      <p className="text-white font-semibold mb-1">Perfect! Taking you to Sage…</p>
                      <p className="text-surface-400 text-sm">
                        Your {answers.exam} {answers.subject} tutor is ready
                      </p>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>

              {/* Footer — skip / back */}
              {step < 3 && (
                <div className="px-6 pb-5 flex items-center justify-between">
                  {step > 0 ? (
                    <button onClick={() => setStep(s => s - 1)}
                      className="text-xs text-surface-500 hover:text-surface-300 transition-colors">
                      ← Back
                    </button>
                  ) : <span />}
                  <button onClick={dismiss}
                    className="text-xs text-surface-600 hover:text-surface-400 transition-colors">
                    Skip — just browse
                  </button>
                </div>
              )}

              {/* Social proof */}
              <div className="border-t border-surface-800 px-6 py-3 flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-surface-600 flex-shrink-0" />
                <p className="text-xs text-surface-500">
                  Join <span className="text-surface-300 font-medium">1,240+</span> students already studying with Sage
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ExitIntentQuiz;
