/**
 * DiagnosticPage — Quick 10-question diagnostic (1 per topic, 45s timer each).
 * Per-question save with local queue retry on network error.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/hooks/useApi';
import { useSession } from '@/hooks/useSession';
import { trackEvent } from '@/lib/analytics';
import { Clock, ChevronRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface DiagnosticQuestion {
  index: number;
  id: string;
  topic: string;
  topic_name: string;
  question_text: string;
  options: any;
  difficulty: string;
}

export default function DiagnosticPage() {
  const sessionId = useSession();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { selected: string | null; correct: boolean }>>({});
  const [timer, setTimer] = useState(45);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load questions
  useEffect(() => {
    trackEvent('page_view', { page: 'diagnostic' });
    apiFetch<{ questions: DiagnosticQuestion[] }>(`/api/diagnostic/${sessionId}`)
      .then(data => {
        setQuestions(data.questions);
      })
      .catch(() => {
        // If no profile, redirect to onboard
        navigate('/onboard');
      })
      .finally(() => setLoading(false));
  }, [sessionId, navigate]);

  // Timer countdown
  useEffect(() => {
    if (loading || showResult || currentIdx >= questions.length) return;
    setTimer(45);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAnswer(null); // time's up
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentIdx, loading, questions.length]);

  const handleAnswer = useCallback((selected: string | null) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (currentIdx >= questions.length) return;

    const q = questions[currentIdx];
    // Determine correctness — check if options has a correct_answer field
    const correctAnswer = q.options?.correct_answer || q.options?.answer;
    const isCorrect = selected !== null && selected === correctAnswer;

    setAnswers(prev => ({
      ...prev,
      [q.topic]: { selected, correct: isCorrect },
    }));

    // Move to next question after brief delay
    setTimeout(() => {
      if (currentIdx < questions.length - 1) {
        setCurrentIdx(prev => prev + 1);
      } else {
        setShowResult(true);
      }
    }, 600);
  }, [currentIdx, questions]);

  // Submit results
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Convert answers to scores (topic → 0 or 1)
      const scores: Record<string, number> = {};
      for (const q of questions) {
        const answer = answers[q.topic];
        scores[q.topic] = answer?.correct ? 1 : 0;
      }

      await apiFetch(`/api/diagnostic/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({ scores }),
      });

      trackEvent('diagnostic_complete', {
        correct: Object.values(scores).filter(s => s === 1).length,
        total: questions.length,
      });

      navigate('/');
    } catch (err) {
      // Retry on error — save locally
      console.error('Failed to save diagnostic:', err);
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="text-sky-400 animate-spin" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-surface-400">No diagnostic questions available.</p>
        <button onClick={() => navigate('/')} className="text-sky-400 underline">Go home</button>
      </div>
    );
  }

  // Results screen
  if (showResult) {
    const correctCount = Object.values(answers).filter(a => a.correct).length;
    const totalCount = questions.length;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 py-4"
      >
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-surface-100">Your GATE Math Profile</h1>
          <div className="text-5xl font-bold font-mono text-emerald-400">
            {correctCount}/{totalCount}
          </div>
          <p className="text-sm text-surface-400">
            {correctCount >= 7 ? 'Strong foundation! Let\'s fine-tune your weak spots.' :
             correctCount >= 4 ? 'Good start! Your study plan will focus on gaps.' :
             'Lots of room to grow — your plan will prioritize the basics.'}
          </p>
        </div>

        {/* Topic breakdown */}
        <div className="space-y-2">
          {questions.map(q => {
            const answer = answers[q.topic];
            return (
              <div
                key={q.topic}
                className={clsx(
                  'flex items-center gap-3 p-3 rounded-xl border',
                  answer?.correct
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-red-500/5 border-red-500/20'
                )}
              >
                {answer?.correct
                  ? <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  : <XCircle size={18} className="text-red-400 shrink-0" />
                }
                <span className="text-sm text-surface-200 flex-1">{q.topic_name}</span>
                <span className={clsx(
                  'text-xs font-mono',
                  answer?.correct ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {answer?.correct ? 'Correct' : 'Incorrect'}
                </span>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all flex items-center justify-center gap-2"
        >
          {submitting ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              See Your Study Plan
              <ChevronRight size={18} />
            </>
          )}
        </button>
      </motion.div>
    );
  }

  // Question screen
  const q = questions[currentIdx];
  const options = Array.isArray(q.options?.choices) ? q.options.choices :
    typeof q.options === 'object' && q.options !== null ?
      Object.entries(q.options).filter(([k]) => !['correct_answer', 'answer', 'explanation'].includes(k)).map(([k, v]) => ({ key: k, text: v })) :
      [];

  return (
    <div className="space-y-4">
      {/* Header: progress + timer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-surface-400 font-medium">
          Question {currentIdx + 1} of {questions.length}
        </span>
        <div className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-sm font-semibold',
          timer > 30 ? 'text-sky-400 bg-sky-500/10' :
          timer > 10 ? 'text-amber-400 bg-amber-500/10' :
          'text-red-400 bg-red-500/10'
        )}>
          <Clock size={14} />
          {timer}s
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-surface-800 overflow-hidden">
        <motion.div
          className="h-full bg-sky-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${((currentIdx) / questions.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Topic tag */}
      <span className="inline-block text-xs font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400">
        {q.topic_name}
      </span>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIdx}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <p className="text-surface-100 text-base leading-relaxed">
            {q.question_text}
          </p>

          {/* Options */}
          <div className="space-y-2">
            {options.map((opt: any, i: number) => {
              const optKey = opt.key || String.fromCharCode(65 + i);
              const optText = opt.text || opt;
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(optKey)}
                  className="w-full text-left p-3 rounded-xl border border-surface-700 bg-surface-900 hover:border-sky-500/50 hover:bg-surface-800 transition-all active:scale-[0.98]"
                >
                  <span className="text-xs font-mono text-sky-400 mr-2">{optKey}.</span>
                  <span className="text-sm text-surface-200">{optText}</span>
                </button>
              );
            })}
          </div>

          {/* Skip button */}
          <button
            onClick={() => handleAnswer(null)}
            className="text-xs text-surface-500 hover:text-surface-300 transition-colors"
          >
            Skip this question
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
