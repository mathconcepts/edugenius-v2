/**
 * ErrorDiagnosis — GBrain error analysis display.
 * Shows error type, why the misconception is tempting, why it's wrong,
 * and a corrective problem. Appears after a wrong answer.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Brain, ChevronDown, ChevronUp, Lightbulb, Target, GitBranch } from 'lucide-react';
import { clsx } from 'clsx';

interface CorrectionProblem {
  question: string;
  answer: string;
  explanation: string;
}

interface DiagnosisData {
  error_type: string;
  concept_id: string;
  misconception_id: string;
  diagnosis: string;
  why_tempting: string;
  why_wrong: string;
  corrective_hint: string;
  corrective_problem?: CorrectionProblem;
}

interface PrerequisiteAlert {
  concept: string;
  shaky_prereqs: string[];
  severity: string;
}

interface ErrorDiagnosisProps {
  diagnosis: DiagnosisData;
  prerequisiteAlerts?: PrerequisiteAlert[];
  motivationState?: string;
  consecutiveFailures?: number;
}

const ERROR_TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof Brain; tip: string }> = {
  conceptual:          { label: 'Conceptual Gap',      color: 'text-red-400',    icon: Brain,         tip: 'The underlying concept needs review' },
  procedural:          { label: 'Wrong Procedure',     color: 'text-amber-400',  icon: GitBranch,     tip: 'Right concept, wrong method applied' },
  notation:            { label: 'Notation Confusion',  color: 'text-sky-400',    icon: AlertTriangle, tip: 'Mathematical notation was misread' },
  misread:             { label: 'Question Misread',    color: 'text-purple-400', icon: AlertTriangle, tip: 'The question was misinterpreted' },
  time_pressure:       { label: 'Rushed Error',        color: 'text-amber-400',  icon: Target,        tip: 'You knew the method but went too fast' },
  arithmetic:          { label: 'Calculation Error',   color: 'text-emerald-400',icon: Target,        tip: 'Right approach, arithmetic slip' },
  overconfidence_skip: { label: 'Skipped Steps',       color: 'text-amber-400',  icon: Lightbulb,     tip: 'Important steps were skipped' },
};

export function ErrorDiagnosis({ diagnosis, prerequisiteAlerts, motivationState, consecutiveFailures }: ErrorDiagnosisProps) {
  const [expanded, setExpanded] = useState(true);
  const [showCorrective, setShowCorrective] = useState(false);
  const [corrAnswerRevealed, setCorrAnswerRevealed] = useState(false);

  const config = ERROR_TYPE_CONFIG[diagnosis.error_type] || ERROR_TYPE_CONFIG.conceptual;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 25 }}
      className="rounded-xl border border-surface-800 overflow-hidden"
    >
      {/* Header — Error Type Badge */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-surface-900/80 hover:bg-surface-800/80 transition-colors cursor-pointer"
      >
        <div className={clsx('p-1.5 rounded-lg bg-surface-800', config.color)}>
          <Icon size={14} />
        </div>
        <div className="flex-1 text-left">
          <span className={clsx('text-xs font-semibold uppercase tracking-wide', config.color)}>
            {config.label}
          </span>
          <p className="text-sm text-surface-300 mt-0.5">{diagnosis.diagnosis}</p>
        </div>
        {expanded ? <ChevronUp size={14} className="text-surface-500" /> : <ChevronDown size={14} className="text-surface-500" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Why Tempting */}
              {diagnosis.why_tempting && (
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
                  <p className="text-xs font-semibold text-amber-400 mb-1">Why your approach seemed right</p>
                  <p className="text-sm text-surface-300 leading-relaxed">{diagnosis.why_tempting}</p>
                </div>
              )}

              {/* Why Wrong */}
              {diagnosis.why_wrong && (
                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/15">
                  <p className="text-xs font-semibold text-red-400 mb-1">The specific flaw</p>
                  <p className="text-sm text-surface-300 leading-relaxed">{diagnosis.why_wrong}</p>
                </div>
              )}

              {/* Corrective Hint */}
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                <p className="text-xs font-semibold text-emerald-400 mb-1">
                  <Lightbulb size={12} className="inline mr-1" />
                  How to fix this
                </p>
                <p className="text-sm text-surface-300 leading-relaxed">{diagnosis.corrective_hint}</p>
              </div>

              {/* Prerequisite Alerts */}
              {prerequisiteAlerts && prerequisiteAlerts.length > 0 && (
                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/15">
                  <p className="text-xs font-semibold text-purple-400 mb-1">
                    <GitBranch size={12} className="inline mr-1" />
                    Foundation gap detected
                  </p>
                  <p className="text-sm text-surface-300 leading-relaxed">
                    Strengthen first:{' '}
                    {prerequisiteAlerts[0].shaky_prereqs
                      .map(p => p.replace(/-/g, ' '))
                      .join(' → ')}
                  </p>
                </div>
              )}

              {/* Corrective Problem */}
              {diagnosis.corrective_problem && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowCorrective(!showCorrective)}
                    className="flex items-center gap-2 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                  >
                    <Target size={12} />
                    {showCorrective ? 'Hide' : 'Try'} a corrective problem
                    {showCorrective ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  <AnimatePresence>
                    {showCorrective && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-3 rounded-lg bg-sky-500/5 border border-sky-500/15 space-y-3">
                          <p className="text-sm text-surface-200 leading-relaxed whitespace-pre-wrap">
                            {diagnosis.corrective_problem.question}
                          </p>

                          {!corrAnswerRevealed ? (
                            <button
                              onClick={() => setCorrAnswerRevealed(true)}
                              className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                            >
                              Reveal answer
                            </button>
                          ) : (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="space-y-2"
                            >
                              <p className="text-sm font-semibold text-emerald-300">
                                Answer: {diagnosis.corrective_problem.answer}
                              </p>
                              <p className="text-xs text-surface-400 leading-relaxed whitespace-pre-wrap">
                                {diagnosis.corrective_problem.explanation}
                              </p>
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Encouragement for frustrated students */}
              {motivationState === 'frustrated' && consecutiveFailures && consecutiveFailures >= 3 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="p-3 rounded-lg bg-sky-500/5 border border-sky-500/15 text-center"
                >
                  <p className="text-sm text-sky-300">
                    Struggling is how learning happens. Every expert was once a beginner who didn't quit.
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
