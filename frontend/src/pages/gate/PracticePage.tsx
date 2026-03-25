/**
 * PracticePage — Answer a GATE problem, get verified solution.
 *
 * Flow: Read problem → Select answer → Submit → See verification result + solution
 * Hooks into spaced repetition after answer.
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '@/hooks/useApi';
import { useSession } from '@/hooks/useSession';
import { ChevronLeft, CheckCircle, XCircle, Loader2, Clock, Zap } from 'lucide-react';
import { clsx } from 'clsx';

interface Problem {
  id: string;
  year: number;
  question_text: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation: string;
  topic: string;
  difficulty: string;
  marks: number;
}

interface VerifyResult {
  traceId: string;
  status: string;
  confidence: number;
  tierUsed: string;
  durationMs: number;
}

type Phase = 'answering' | 'verifying' | 'result';

export default function PracticePage() {
  const { problemId } = useParams<{ problemId: string }>();
  const sessionId = useSession();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('answering');
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyStatus, setVerifyStatus] = useState('');

  useEffect(() => {
    if (!problemId) return;
    apiFetch<{ problem: Problem }>(`/api/problems/id/${problemId}`)
      .then(res => setProblem(res.problem))
      .finally(() => setLoading(false));
  }, [problemId]);

  const handleSubmit = async () => {
    if (!selected || !problem) return;
    setPhase('verifying');

    const options = typeof problem.options === 'string' ? JSON.parse(problem.options) : problem.options;
    const answerText = options[selected] || selected;

    // Show progressive verification status
    setVerifyStatus('Checking knowledge base...');

    try {
      const result = await apiFetch<VerifyResult>('/api/verify', {
        method: 'POST',
        body: JSON.stringify({
          problem: problem.question_text,
          answer: answerText,
          sessionId,
        }),
      });

      setVerifyResult(result);
      setPhase('result');

      // Update spaced repetition
      const isCorrect = selected === problem.correct_answer;
      const quality = isCorrect ? 4 : 1; // SM-2: 4 = correct with hesitation, 1 = wrong
      await apiFetch(`/api/sr/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({ pyqId: problem.id, quality, answer: selected }),
      }).catch(() => {}); // SR update is non-blocking
    } catch {
      setPhase('result');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="animate-spin text-sky-400" size={32} />
    </div>;
  }

  if (!problem) {
    return <div className="text-center py-12 text-surface-500">Problem not found.</div>;
  }

  const options = typeof problem.options === 'string' ? JSON.parse(problem.options) : problem.options;
  const isCorrect = selected === problem.correct_answer;
  const topicName = problem.topic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="space-y-5">
      {/* Back + Meta */}
      <div className="flex items-center gap-3">
        <Link to={`/topic/${problem.topic}`} className="p-2 -ml-2 rounded-lg hover:bg-surface-800 transition-colors">
          <ChevronLeft size={20} className="text-surface-400" />
        </Link>
        <div className="flex-1">
          <p className="text-xs text-surface-500">{topicName} | GATE {problem.year} | {problem.marks}M</p>
        </div>
      </div>

      {/* Question */}
      <div className="p-4 rounded-xl bg-surface-900 border border-surface-800">
        <p className="text-surface-200 leading-relaxed whitespace-pre-wrap">{problem.question_text}</p>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {Object.entries(options).map(([key, value]) => {
          const isThisCorrect = key === problem.correct_answer;
          const isThisSelected = key === selected;

          let borderColor = 'border-surface-800';
          let bgColor = 'bg-surface-900';
          let textColor = 'text-surface-300';

          if (phase === 'result') {
            if (isThisCorrect) {
              borderColor = 'border-emerald-500/50';
              bgColor = 'bg-emerald-500/10';
              textColor = 'text-emerald-300';
            } else if (isThisSelected && !isThisCorrect) {
              borderColor = 'border-red-500/50';
              bgColor = 'bg-red-500/10';
              textColor = 'text-red-300';
            }
          } else if (isThisSelected) {
            borderColor = 'border-sky-500/50';
            bgColor = 'bg-sky-500/10';
            textColor = 'text-sky-300';
          }

          return (
            <button
              key={key}
              onClick={() => phase === 'answering' && setSelected(key)}
              disabled={phase !== 'answering'}
              className={clsx(
                'w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-200',
                borderColor, bgColor, textColor,
                phase === 'answering' && 'hover:border-sky-500/30 hover:bg-surface-800/80 active:scale-[0.99]',
              )}
            >
              <span className={clsx(
                'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                isThisSelected ? 'bg-sky-500/20 text-sky-300' : 'bg-surface-800 text-surface-400',
                phase === 'result' && isThisCorrect && 'bg-emerald-500/20 text-emerald-300',
              )}>
                {key}
              </span>
              <span className="text-sm">{value as string}</span>
              {phase === 'result' && isThisCorrect && <CheckCircle size={16} className="ml-auto text-emerald-400" />}
              {phase === 'result' && isThisSelected && !isThisCorrect && <XCircle size={16} className="ml-auto text-red-400" />}
            </button>
          );
        })}
      </div>

      {/* Submit / Verifying / Result */}
      {phase === 'answering' && (
        <button
          onClick={handleSubmit}
          disabled={!selected}
          className={clsx(
            'w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200',
            selected
              ? 'bg-gradient-to-r from-emerald-500 to-sky-500 text-white shadow-lg shadow-emerald-500/25 active:scale-[0.98]'
              : 'bg-surface-800 text-surface-500 cursor-not-allowed',
          )}
        >
          Check Answer
        </button>
      )}

      {phase === 'verifying' && (
        <div className="flex items-center justify-center gap-3 py-4">
          <Loader2 className="animate-spin text-sky-400" size={20} />
          <span className="text-sm text-surface-400">{verifyStatus}</span>
        </div>
      )}

      {phase === 'result' && (
        <div className="space-y-4">
          {/* Result Banner */}
          <div className={clsx(
            'p-4 rounded-xl border',
            isCorrect
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-red-500/10 border-red-500/30',
          )}>
            <div className="flex items-center gap-2">
              {isCorrect
                ? <CheckCircle size={20} className="text-emerald-400" />
                : <XCircle size={20} className="text-red-400" />
              }
              <span className={clsx('font-semibold text-sm', isCorrect ? 'text-emerald-300' : 'text-red-300')}>
                {isCorrect ? 'Correct!' : `Incorrect — Answer: ${problem.correct_answer})`}
              </span>
            </div>

            {/* Verification metadata */}
            {verifyResult && (
              <div className="flex items-center gap-3 mt-2 text-xs text-surface-500">
                <span className="flex items-center gap-1">
                  <Zap size={12} />
                  {verifyResult.tierUsed.replace('tier1_', 'Tier 1: ').replace('tier2_', 'Tier 2: ').replace('tier3_', 'Tier 3: ')}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {verifyResult.durationMs}ms
                </span>
                <span>{Math.round(verifyResult.confidence * 100)}% confidence</span>
              </div>
            )}
          </div>

          {/* Explanation */}
          <div className="p-4 rounded-xl bg-surface-900 border border-surface-800">
            <h3 className="text-sm font-semibold text-surface-300 mb-2">Solution</h3>
            <p className="text-sm text-surface-400 leading-relaxed whitespace-pre-wrap">
              {problem.explanation}
            </p>
          </div>

          {/* Next Actions */}
          <div className="flex gap-3">
            <Link
              to={`/topic/${problem.topic}`}
              className="flex-1 py-3 rounded-xl text-center text-sm font-medium bg-surface-800 text-surface-300 hover:bg-surface-700 transition-colors"
            >
              More Problems
            </Link>
            <Link
              to="/"
              className="flex-1 py-3 rounded-xl text-center text-sm font-medium bg-sky-500/10 text-sky-300 border border-sky-500/25 hover:bg-sky-500/15 transition-colors"
            >
              All Topics
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
