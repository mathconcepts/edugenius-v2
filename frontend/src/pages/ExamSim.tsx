/**
 * ExamSim.tsx — Live exam simulator with timer, percentile, and autopsy
 * Route: /exam-sim
 * CEO/Admin: appStore.examSimEnabled
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Flag, ChevronRight, ChevronLeft, AlertTriangle, CheckCircle2, XCircle, Trophy, Clock, BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '@/stores/appStore';
import {
  getExam, createSession, calculateResult, saveResult, getAvailableExams,
  type SimExam, type ExamSession, type ExamResult,
} from '@/services/examSimulatorService';
import { awardXP } from '@/services/gamificationService';

// ─── Timer component ──────────────────────────────────────────────────────────

function ExamTimer({ secondsLeft, total }: { secondsLeft: number; total: number }) {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const pct = (secondsLeft / total) * 100;
  const urgent = secondsLeft < 300; // < 5 min

  return (
    <div className={clsx(
      'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-mono font-bold transition-colors',
      urgent ? 'bg-red-900/40 border-red-600 text-red-300 animate-pulse' : 'bg-surface-800 border-surface-600 text-white'
    )}>
      <Timer className="w-4 h-4" />
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      <div className="w-16 h-1.5 bg-surface-600 rounded-full overflow-hidden">
        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Result screen ────────────────────────────────────────────────────────────

function ResultScreen({ result, exam, onRetry }: { result: ExamResult; exam: SimExam; onRetry: () => void }) {
  const [showAutopsy, setShowAutopsy] = useState(false);
  const gradeColor = result.grade === 'S' || result.grade === 'A+' ? 'text-green-400' :
    result.grade === 'A' || result.grade === 'B+' ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Score card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center py-8 bg-surface-800 rounded-2xl border border-surface-700"
      >
        <div className={clsx('text-6xl font-black mb-2', gradeColor)}>{result.grade}</div>
        <div className="text-3xl font-bold text-white">{result.totalMarks.toFixed(1)} / {result.maxMarks}</div>
        <div className="text-surface-400 text-sm mt-1">{result.percentage}%</div>

        <div className="flex justify-center gap-6 mt-6">
          <div>
            <div className="text-2xl font-bold text-green-400">{result.correct}</div>
            <div className="text-xs text-surface-400">Correct</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-400">{result.incorrect}</div>
            <div className="text-xs text-surface-400">Wrong</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-surface-400">{result.unattempted}</div>
            <div className="text-xs text-surface-400">Skipped</div>
          </div>
        </div>
      </motion.div>

      {/* Percentile + rank */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-800 rounded-xl p-4 text-center border border-surface-700">
          <Trophy className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
          <div className="text-2xl font-black text-white">{result.percentile}%ile</div>
          <div className="text-xs text-surface-400 mt-1">Better than {result.percentile}% of test-takers</div>
        </div>
        <div className="bg-surface-800 rounded-xl p-4 text-center border border-surface-700">
          <BarChart3 className="w-6 h-6 text-blue-400 mx-auto mb-2" />
          <div className="text-2xl font-black text-white">#{result.rank.toLocaleString()}</div>
          <div className="text-xs text-surface-400 mt-1">out of {result.totalParticipants.toLocaleString()}</div>
        </div>
      </div>

      {/* Time taken */}
      <div className="flex items-center gap-2 text-sm text-surface-400 justify-center">
        <Clock className="w-4 h-4" />
        Time taken: {Math.floor(result.timeTakenSeconds / 60)}m {result.timeTakenSeconds % 60}s
      </div>

      {/* Question autopsy */}
      <button
        onClick={() => setShowAutopsy(!showAutopsy)}
        className="w-full py-3 bg-surface-700 hover:bg-surface-600 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2"
      >
        {showAutopsy ? 'Hide' : 'Show'} Question Autopsy
        <ChevronRight className={clsx('w-4 h-4 transition-transform', showAutopsy && 'rotate-90')} />
      </button>

      <AnimatePresence>
        {showAutopsy && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden"
          >
            {result.questionResults.map((qr, i) => (
              <div key={qr.question.id} className={clsx(
                'rounded-xl border p-4 text-sm',
                qr.correct ? 'bg-green-900/20 border-green-700/40' :
                qr.selected === null ? 'bg-surface-800 border-surface-700' :
                'bg-red-900/20 border-red-700/40'
              )}>
                <div className="flex items-start gap-2 mb-2">
                  {qr.correct ? <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" /> :
                   qr.selected === null ? <span className="text-surface-400 mt-0.5">—</span> :
                   <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />}
                  <p className="font-medium text-white">Q{i + 1}. {qr.question.text}</p>
                </div>
                {qr.selected !== null && !qr.correct && (
                  <p className="text-red-300 text-xs mb-1">
                    Your answer: {qr.question.options[qr.selected]}
                  </p>
                )}
                <p className="text-green-300 text-xs mb-1">
                  Correct: {qr.question.options[qr.question.correctIndex]}
                </p>
                <p className="text-surface-400 text-xs">{qr.question.explanation}</p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={onRetry} className="w-full py-3 bg-primary-600 hover:bg-primary-500 rounded-xl text-white font-semibold transition-all">
        Try Another Mock
      </button>
    </div>
  );
}

// ─── Main Exam Page ───────────────────────────────────────────────────────────

type Phase = 'select' | 'active' | 'result';

export default function ExamSim() {
  const { examSimEnabled, gamificationEnabled } = useAppStore();
  const [phase, setPhase] = useState<Phase>('select');
  const [exam, setExam] = useState<SimExam | null>(null);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState<ExamResult | null>(null);

  // Timer
  useEffect(() => {
    if (phase !== 'active' || !exam) return;
    const id = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { handleSubmit(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, exam]);

  const startExam = (examId: string) => {
    const e = getExam(examId);
    const s = createSession(examId);
    setExam(e);
    setSession(s);
    setSecondsLeft(e.durationMinutes * 60);
    setCurrentQ(0);
    setPhase('active');
  };

  const handleAnswer = (questionId: string, optionIdx: number) => {
    if (!session) return;
    setSession(prev => prev ? {
      ...prev,
      answers: { ...prev.answers, [questionId]: optionIdx },
    } : prev);
  };

  const toggleFlag = (questionId: string) => {
    if (!session) return;
    setSession(prev => {
      if (!prev) return prev;
      const flagged = prev.flagged.includes(questionId)
        ? prev.flagged.filter(id => id !== questionId)
        : [...prev.flagged, questionId];
      return { ...prev, flagged };
    });
  };

  const handleSubmit = useCallback(() => {
    if (!exam || !session) return;
    const r = calculateResult(exam, session);
    saveResult(r);
    if (gamificationEnabled && r.correct > 0) {
      awardXP({ type: 'exam_complete', multiplier: r.percentage / 100 + 0.5 });
    }
    setResult(r);
    setPhase('result');
  }, [exam, session, gamificationEnabled]);

  if (!examSimEnabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-surface-400">
        <Timer className="w-12 h-12 mb-3 opacity-30" />
        <p className="font-medium">Exam Simulator is disabled</p>
        <p className="text-sm mt-1">CEO/Admin can enable it in Settings → Advanced</p>
      </div>
    );
  }

  // Phase: Select
  if (phase === 'select') {
    return (
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-2">🎯</div>
          <h1 className="text-2xl font-black text-white">Exam Simulator</h1>
          <p className="text-surface-400 text-sm mt-1">Timed mock with real GATE marking scheme</p>
        </div>

        <div className="space-y-3">
          {getAvailableExams().map(e => (
            <button
              key={e.id}
              onClick={() => startExam(e.id)}
              className="w-full text-left px-5 py-4 bg-surface-800 hover:bg-surface-700 border border-surface-700 hover:border-primary-500/50 rounded-2xl transition-all group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-white group-hover:text-primary-300 transition-colors">{e.name}</p>
                  <p className="text-sm text-surface-400 mt-0.5">{e.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-surface-500 group-hover:text-primary-400 mt-0.5 flex-shrink-0 transition-colors" />
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-surface-400">
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {e.questions} questions</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {e.duration} minutes</span>
              </div>
            </button>
          ))}
        </div>

        <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3 text-sm text-amber-200">
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          Negative marking applies: −0.33 for 1-mark, −0.67 for 2-mark questions.
        </div>
      </div>
    );
  }

  // Phase: Result
  if (phase === 'result' && result && exam) {
    return <ResultScreen result={result} exam={exam} onRetry={() => { setPhase('select'); setResult(null); }} />;
  }

  // Phase: Active exam
  if (!exam || !session) return null;

  const allQuestions = exam.sections.flatMap(s => s.questions);
  const q = allQuestions[currentQ];
  if (!q) return null;

  const answered = Object.values(session.answers).filter(v => v !== null && v !== undefined).length;
  const flagged = session.flagged.includes(q.id);

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      {/* Exam header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-bold text-white text-sm">{exam.name}</p>
          <p className="text-xs text-surface-400">{answered}/{allQuestions.length} answered</p>
        </div>
        <ExamTimer secondsLeft={secondsLeft} total={exam.durationMinutes * 60} />
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-all"
        >
          Submit Exam
        </button>
      </div>

      {/* Question */}
      <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-surface-400">
            <span className="px-2 py-0.5 bg-surface-700 rounded-lg">Q{currentQ + 1}/{allQuestions.length}</span>
            <span className={clsx('px-2 py-0.5 rounded-lg',
              q.difficulty === 'easy' ? 'bg-green-900/40 text-green-300' :
              q.difficulty === 'medium' ? 'bg-yellow-900/40 text-yellow-300' :
              'bg-red-900/40 text-red-300'
            )}>{q.difficulty}</span>
            <span className="px-2 py-0.5 bg-surface-700 rounded-lg">{q.marks}M / -{q.negativeMarks.toFixed(2)}</span>
          </div>
          <button
            onClick={() => toggleFlag(q.id)}
            className={clsx('flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all',
              flagged ? 'bg-amber-600/30 text-amber-300 border border-amber-600/40' : 'text-surface-400 hover:text-white'
            )}
          >
            <Flag className="w-3.5 h-3.5" />
            {flagged ? 'Flagged' : 'Flag'}
          </button>
        </div>

        <p className="text-white font-medium leading-relaxed">{q.text}</p>

        <div className="space-y-2">
          {q.options.map((opt, i) => {
            const isSelected = session.answers[q.id] === i;
            return (
              <button
                key={i}
                onClick={() => handleAnswer(q.id, i)}
                className={clsx(
                  'w-full text-left px-4 py-3 rounded-xl border text-sm transition-all',
                  isSelected
                    ? 'bg-primary-600/20 border-primary-500 text-primary-200'
                    : 'bg-surface-700/50 border-surface-600 text-surface-200 hover:bg-surface-600'
                )}
              >
                <span className="inline-flex items-center gap-3">
                  <span className={clsx(
                    'w-6 h-6 rounded-full border text-xs font-bold flex items-center justify-center flex-shrink-0',
                    isSelected ? 'bg-primary-500 border-primary-500 text-white' : 'border-surface-500 text-surface-400'
                  )}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
          disabled={currentQ === 0}
          className="flex items-center gap-1 px-4 py-2 bg-surface-700 hover:bg-surface-600 rounded-xl text-sm text-white disabled:opacity-40 transition-all"
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>

        {/* Question dots */}
        <div className="flex gap-1 flex-wrap justify-center max-w-xs">
          {allQuestions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentQ(i)}
              className={clsx(
                'w-6 h-6 rounded text-xs font-bold transition-all',
                i === currentQ ? 'bg-primary-500 text-white' :
                session.answers[allQuestions[i].id] !== undefined ? 'bg-green-700 text-white' :
                session.flagged.includes(allQuestions[i].id) ? 'bg-amber-600 text-white' :
                'bg-surface-700 text-surface-400 hover:bg-surface-600'
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <button
          onClick={() => setCurrentQ(q => Math.min(allQuestions.length - 1, q + 1))}
          disabled={currentQ === allQuestions.length - 1}
          className="flex items-center gap-1 px-4 py-2 bg-surface-700 hover:bg-surface-600 rounded-xl text-sm text-white disabled:opacity-40 transition-all"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
