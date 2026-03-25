/**
 * VerifyPage — "Verify Any Problem" — arbitrary math input through 3-tier pipeline.
 * Rate limited: 10/hr per session.
 */

import { useState } from 'react';
import { apiFetch } from '@/hooks/useApi';
import { useSession } from '@/hooks/useSession';
import { CheckCircle, XCircle, Loader2, AlertTriangle, Zap, Clock } from 'lucide-react';
import { clsx } from 'clsx';

interface VerifyResult {
  traceId: string;
  status: string;
  confidence: number;
  tierUsed: string;
  durationMs: number;
  checks: Array<{
    verifier: string;
    status: string;
    confidence: number;
    details: string;
  }>;
}

export default function VerifyPage() {
  const sessionId = useSession();
  const [problem, setProblem] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    if (!problem.trim() || !answer.trim()) return;
    setLoading(true);
    setResult(null);
    setError('');

    try {
      const res = await apiFetch<VerifyResult>('/api/verify-any', {
        method: 'POST',
        body: JSON.stringify({ problem: problem.trim(), answer: answer.trim(), sessionId }),
      });
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const statusIcon = (status: string) => {
    if (status === 'verified') return <CheckCircle size={20} className="text-emerald-400" />;
    if (status === 'failed') return <XCircle size={20} className="text-red-400" />;
    return <AlertTriangle size={20} className="text-amber-400" />;
  };

  const statusColor = (status: string) => {
    if (status === 'verified') return 'border-emerald-500/30 bg-emerald-500/10';
    if (status === 'failed') return 'border-red-500/30 bg-red-500/10';
    return 'border-amber-500/30 bg-amber-500/10';
  };

  const statusLabel = (status: string) => {
    if (status === 'verified') return 'Answer verified correct';
    if (status === 'failed') return 'Answer appears incorrect';
    if (status === 'partial') return 'Partially verified';
    return 'Could not verify';
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-surface-100">Verify Any Problem</h1>
        <p className="text-sm text-surface-500 mt-1">
          Enter any math problem and your answer — we'll verify it through our 3-tier pipeline.
        </p>
      </div>

      {/* Problem Input */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-surface-400 mb-1 block">Problem</label>
          <textarea
            value={problem}
            onChange={e => setProblem(e.target.value)}
            placeholder="e.g. Find the eigenvalues of the matrix [[2,1],[1,2]]"
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-900 border border-surface-800 text-surface-200 text-sm placeholder:text-surface-600 focus:outline-none focus:border-sky-500/50 resize-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-surface-400 mb-1 block">Your Answer</label>
          <input
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="e.g. 1 and 3"
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-900 border border-surface-800 text-surface-200 text-sm placeholder:text-surface-600 focus:outline-none focus:border-sky-500/50"
          />
        </div>

        <button
          onClick={handleVerify}
          disabled={loading || !problem.trim() || !answer.trim()}
          className={clsx(
            'w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200',
            loading || !problem.trim() || !answer.trim()
              ? 'bg-surface-800 text-surface-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-500 to-sky-500 text-white shadow-lg shadow-emerald-500/25 active:scale-[0.98]',
          )}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={16} />
              Verifying...
            </span>
          ) : 'Verify Answer'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <div className={clsx('p-4 rounded-xl border', statusColor(result.status))}>
            <div className="flex items-center gap-2">
              {statusIcon(result.status)}
              <span className="font-semibold text-sm text-surface-200">{statusLabel(result.status)}</span>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-surface-500">
              <span className="flex items-center gap-1">
                <Zap size={12} />
                {result.tierUsed.replace('tier1_', 'Tier 1: ').replace('tier2_', 'Tier 2: ').replace('tier3_', 'Tier 3: ')}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {result.durationMs}ms
              </span>
              <span>{Math.round(result.confidence * 100)}% confidence</span>
            </div>
          </div>

          {/* Verification Steps */}
          <div className="p-4 rounded-xl bg-surface-900 border border-surface-800">
            <h3 className="text-xs font-semibold text-surface-400 mb-2 uppercase tracking-wider">Verification Steps</h3>
            <div className="space-y-2">
              {result.checks.map((check, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className={clsx(
                    'mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0',
                    check.status === 'verified' ? 'bg-emerald-500/20 text-emerald-400' :
                    check.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    'bg-surface-700 text-surface-400'
                  )}>
                    {i + 1}
                  </span>
                  <div>
                    <span className="text-surface-300">{check.verifier}</span>
                    <span className="text-surface-600 mx-1">—</span>
                    <span className="text-surface-500">{check.details}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rate Limit Notice */}
      <p className="text-xs text-surface-600 text-center">
        10 verifications per hour. Powered by RAG + LLM + Wolfram Alpha.
      </p>
    </div>
  );
}
