/**
 * MockExamPage — full-length timed mock exam with GBrain calibration.
 *
 * Flow: Start → Review → Answer each question with timer → Submit → Post-analysis
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/hooks/useApi';
import { useSession } from '@/hooks/useSession';
import { trackEvent } from '@/lib/analytics';
import { fadeInUp } from '@/lib/animations';
import { Clock, CheckCircle, XCircle, SkipForward, ChevronRight, Play, Flag, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface Question {
  id: string;
  question_text: string;
  options?: Record<string, string> | string;
  correct_answer: string;
  topic: string;
  difficulty: string | number;
  marks: number;
  source?: string;
}

interface MockExam {
  exam_id: string;
  exam_name: string;
  time_limit_minutes: number;
  total_questions: number;
  marks_scheme: { correct: number; wrong: number };
  questions: Question[];
  section_breakdown: Record<string, number>;
}

type Phase = 'ready' | 'in-progress' | 'submitting' | 'results';

export default function MockExamPage() {
  const sessionId = useSession();
  const [exam, setExam] = useState<MockExam | null>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [loading, setLoading] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [results, setResults] = useState<any>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    trackEvent('page_view', { page: 'mock-exam' });
  }, []);

  // Timer
  useEffect(() => {
    if (phase !== 'in-progress') return;
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) { handleSubmit(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const handleStart = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<MockExam>(`/api/gbrain/mock-exam/${sessionId}`);
      setExam(data);
      setTimeRemaining(data.time_limit_minutes * 60);
      setPhase('in-progress');
      startedAt.current = Date.now();
      trackEvent('mock_exam_start', { exam_id: data.exam_id, total_questions: data.total_questions });
    } catch (err) {
      alert('Could not start exam: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (qId: string, answer: string | null) => {
    setAnswers(prev => ({ ...prev, [qId]: answer }));
  };

  const handleSubmit = async () => {
    if (!exam) return;
    setPhase('submitting');
    trackEvent('mock_exam_submit', { exam_id: exam.exam_id, elapsed: Date.now() - startedAt.current });

    // Grade client-side (fast) and record attempts to GBrain
    const scheme = exam.marks_scheme;
    let correct = 0, wrong = 0, skipped = 0, marks = 0;
    const byTopic: Record<string, { correct: number; attempted: number; marks: number }> = {};

    for (const q of exam.questions) {
      const studentAnswer = answers[q.id];
      byTopic[q.topic] = byTopic[q.topic] || { correct: 0, attempted: 0, marks: 0 };

      if (!studentAnswer) {
        skipped++;
        continue;
      }
      byTopic[q.topic].attempted++;

      const isCorrect = studentAnswer === q.correct_answer;
      if (isCorrect) {
        correct++;
        marks += scheme.correct;
        byTopic[q.topic].correct++;
        byTopic[q.topic].marks += scheme.correct;
      } else {
        wrong++;
        marks += scheme.wrong;
        byTopic[q.topic].marks += scheme.wrong;
      }

      // Fire GBrain attempt (fire-and-forget, don't block results)
      apiFetch('/api/gbrain/attempt', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          problem: q.question_text,
          studentAnswer,
          correctAnswer: q.correct_answer,
          conceptId: q.topic,
          isCorrect,
          difficulty: typeof q.difficulty === 'number' ? q.difficulty : 0.5,
          problemId: q.id,
        }),
      }).catch(() => {});
    }

    setResults({
      exam_id: exam.exam_id,
      total: exam.questions.length,
      correct, wrong, skipped,
      marks,
      max_marks: exam.questions.length * scheme.correct,
      accuracy: correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0,
      time_taken_sec: Math.round((Date.now() - startedAt.current) / 1000),
      by_topic: byTopic,
    });

    setPhase('results');
  };

  // ── Ready screen ──────────────────────────────────────────────
  if (phase === 'ready') {
    return (
      <motion.div className="space-y-6" initial="hidden" animate="visible">
        <motion.div variants={fadeInUp}>
          <h1 className="text-xl font-bold text-surface-100">Mock Exam</h1>
          <p className="text-xs text-surface-500 mt-1">Full-length, GBrain-calibrated to your mastery</p>
        </motion.div>

        <motion.div variants={fadeInUp} className="p-5 rounded-xl bg-gradient-to-br from-sky-500/10 to-emerald-500/10 border border-sky-500/20 text-center space-y-3">
          <div className="flex items-center justify-center gap-8 py-4">
            <div>
              <p className="text-3xl font-black text-surface-100">180</p>
              <p className="text-xs text-surface-500">minutes</p>
            </div>
            <div className="h-10 w-px bg-surface-700" />
            <div>
              <p className="text-3xl font-black text-surface-100">65</p>
              <p className="text-xs text-surface-500">questions</p>
            </div>
          </div>
          <p className="text-sm text-surface-300">
            Syllabus-weighted, mastery-calibrated. Difficulty biased to your Zone of Proximal Development.
          </p>
        </motion.div>

        <motion.div variants={fadeInUp} className="space-y-2">
          <p className="text-xs text-surface-500 px-1">Rules</p>
          <div className="p-3 rounded-xl bg-surface-900 border border-surface-800 space-y-1.5 text-sm text-surface-400">
            <p>• +2 marks for correct, -2/3 for wrong (GATE scheme)</p>
            <p>• Timer starts when you click Start — runs continuously</p>
            <p>• You can skip questions and return</p>
            <p>• Results update your GBrain student model</p>
          </div>
        </motion.div>

        <motion.button
          variants={fadeInUp}
          onClick={handleStart}
          disabled={loading}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} fill="white" />}
          {loading ? 'Preparing your exam...' : 'Start Mock Exam'}
        </motion.button>
      </motion.div>
    );
  }

  // ── In progress ──────────────────────────────────────────────
  if (phase === 'in-progress' && exam) {
    const q = exam.questions[currentQ];
    const answered = Object.values(answers).filter(Boolean).length;
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    const options = typeof q.options === 'string' ? JSON.parse(q.options || '{}') : (q.options || {});

    return (
      <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {/* Timer + Progress */}
        <div className="sticky top-12 z-30 -mx-4 px-4 py-2 bg-surface-950/95 backdrop-blur-md border-b border-surface-800 flex items-center justify-between">
          <div className={clsx(
            'flex items-center gap-2 px-3 py-1 rounded-lg font-mono font-bold',
            timeRemaining < 600 ? 'bg-red-500/10 text-red-400' : 'bg-surface-900 text-surface-200'
          )}>
            <Clock size={13} />
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </div>
          <span className="text-xs text-surface-400">
            {currentQ + 1} / {exam.questions.length} · {answered} answered
          </span>
        </div>

        {/* Question */}
        <motion.div
          key={currentQ}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-4 rounded-xl bg-surface-900 border border-surface-800"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono text-sky-400 uppercase tracking-wide">{q.topic}</span>
            <span className="text-[10px] text-surface-500">
              {q.source === 'generated' ? 'GBrain-generated' : 'PYQ'} · {q.marks || 2}m
            </span>
          </div>
          <p className="text-sm text-surface-100 leading-relaxed whitespace-pre-wrap mb-4">{q.question_text}</p>

          {/* Options */}
          {Object.keys(options).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(options).map(([key, value]) => {
                const isSelected = answers[q.id] === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleAnswer(q.id, isSelected ? null : key)}
                    className={clsx(
                      'w-full text-left p-3 rounded-lg border transition-colors text-sm',
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500/40 text-sky-300'
                        : 'bg-surface-800 border-surface-700 text-surface-300 hover:border-surface-600',
                    )}
                  >
                    <span className="font-mono font-bold mr-2">{key}.</span>
                    {value as string}
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              type="text"
              value={answers[q.id] || ''}
              onChange={e => handleAnswer(q.id, e.target.value || null)}
              placeholder="Enter your answer..."
              className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-surface-200 font-mono text-sm focus:outline-none focus:border-sky-500/50"
            />
          )}
        </motion.div>

        {/* Nav */}
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
            disabled={currentQ === 0}
            className="flex-1 py-2.5 rounded-lg bg-surface-900 border border-surface-800 text-sm text-surface-400 disabled:opacity-40"
          >
            ← Previous
          </button>
          {currentQ < exam.questions.length - 1 ? (
            <button
              onClick={() => setCurrentQ(currentQ + 1)}
              className="flex-1 py-2.5 rounded-lg bg-sky-500 text-white text-sm font-semibold"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="flex-1 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5"
            >
              <Flag size={13} /> Submit Exam
            </button>
          )}
        </div>

        {/* Question grid */}
        <div className="p-3 rounded-xl bg-surface-900 border border-surface-800">
          <p className="text-[10px] text-surface-500 mb-2 uppercase tracking-wide">Jump to</p>
          <div className="grid grid-cols-10 gap-1">
            {exam.questions.map((qq, i) => (
              <button
                key={qq.id}
                onClick={() => setCurrentQ(i)}
                className={clsx(
                  'h-7 rounded text-[10px] font-bold transition-colors',
                  i === currentQ ? 'bg-sky-500 text-white'
                    : answers[qq.id] ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-surface-800 text-surface-500',
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Submitting ──────────────────────────────────────────────
  if (phase === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="animate-spin text-sky-400" size={32} />
        <p className="text-sm text-surface-400">Grading your exam and updating GBrain...</p>
      </div>
    );
  }

  // ── Results ──────────────────────────────────────────────
  if (phase === 'results' && results) {
    const pct = Math.round((results.marks / results.max_marks) * 100);
    return (
      <motion.div className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="text-center py-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="inline-block"
          >
            <div className={clsx(
              'w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-3',
              pct >= 50 ? 'bg-emerald-500/20' : pct >= 25 ? 'bg-amber-500/20' : 'bg-red-500/20'
            )}>
              <span className={clsx(
                'text-3xl font-black',
                pct >= 50 ? 'text-emerald-400' : pct >= 25 ? 'text-amber-400' : 'text-red-400'
              )}>
                {results.marks}
              </span>
            </div>
          </motion.div>
          <p className="text-sm text-surface-500">out of {results.max_marks} marks · {pct}%</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <p className="text-xl font-bold text-emerald-400">{results.correct}</p>
            <p className="text-[10px] text-surface-500">correct</p>
          </div>
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
            <p className="text-xl font-bold text-red-400">{results.wrong}</p>
            <p className="text-[10px] text-surface-500">wrong</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-900 border border-surface-800 text-center">
            <p className="text-xl font-bold text-surface-400">{results.skipped}</p>
            <p className="text-[10px] text-surface-500">skipped</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface-900 border border-surface-800">
          <p className="text-xs text-surface-500 mb-2">Topic breakdown</p>
          <div className="space-y-1.5">
            {Object.entries(results.by_topic).map(([topic, s]: [string, any]) => (
              <div key={topic} className="flex items-center justify-between text-xs">
                <span className="text-surface-300 capitalize">{topic.replace(/-/g, ' ')}</span>
                <span className={clsx(
                  'font-mono',
                  s.marks > 0 ? 'text-emerald-400' : s.marks < 0 ? 'text-red-400' : 'text-surface-500'
                )}>
                  {s.correct}/{s.attempted} ({s.marks > 0 ? '+' : ''}{s.marks}m)
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sm text-surface-300">
          <p className="font-semibold text-sky-400 mb-1">What GBrain learned</p>
          <p>
            {results.correct + results.wrong} attempts recorded. Your mastery vector, speed profile,
            and error patterns have been updated. Check /error-patterns and /exam-strategy for
            refreshed recommendations.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 py-3 rounded-xl bg-emerald-500 text-white text-sm font-semibold"
          >
            Take Another Mock
          </button>
          <button
            onClick={() => window.location.href = '/error-patterns'}
            className="flex-1 py-3 rounded-xl bg-surface-900 border border-surface-800 text-surface-300 text-sm font-semibold"
          >
            View Errors
          </button>
        </div>
      </motion.div>
    );
  }

  return null;
}
