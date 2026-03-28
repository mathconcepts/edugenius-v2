/**
 * VerifyPage — "Verify Any Problem" with animations and auto-resize textarea.
 * Rate limited: 10/hr per session.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/hooks/useApi';
import { useSession } from '@/hooks/useSession';
import { trackEvent } from '@/lib/analytics';
import { fadeInUp, staggerContainer, tapScale, celebration } from '@/lib/animations';
import { CheckCircle, XCircle, Loader2, AlertTriangle, Zap, Clock, Camera } from 'lucide-react';
import { clsx } from 'clsx';
import { CameraInput } from '@/components/gate/CameraInput';

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
  const [image, setImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    trackEvent('page_view', { page: 'verify' });
  }, []);

  // Auto-resize textarea
  const handleProblemChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setProblem(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  };

  const handleVerify = async () => {
    if ((!problem.trim() && !image) || !answer.trim()) return;
    setLoading(true);
    setResult(null);
    setError('');

    trackEvent('verify_submit', { problemLength: problem.length, hasImage: !!image });

    try {
      const payload: any = { answer: answer.trim(), sessionId };
      if (problem.trim()) payload.problem = problem.trim();
      if (image) {
        payload.image = image.base64;
        payload.imageMimeType = image.mimeType;
      }
      const res = await apiFetch<VerifyResult>('/api/verify-any', {
        method: 'POST',
        body: JSON.stringify(payload),
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

  const canSubmit = (problem.trim() || image) && answer.trim() && !loading;

  return (
    <motion.div
      className="space-y-5"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      <motion.div variants={fadeInUp}>
        <h1 className="text-xl font-bold text-surface-100">Scan & Verify</h1>
        <p className="text-sm text-surface-500 mt-1">
          Snap a photo of any math problem or type it in. We'll verify your answer through our 3-tier pipeline.
        </p>
      </motion.div>

      {/* Camera Input */}
      <motion.div variants={fadeInUp}>
        <CameraInput
          onCapture={(b, m) => setImage({ base64: b, mimeType: m })}
          onClear={() => setImage(null)}
          preview={image?.base64 || null}
        />
      </motion.div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-surface-800" />
        <span className="text-xs text-surface-500">or type manually</span>
        <div className="flex-1 h-px bg-surface-800" />
      </div>

      {/* Problem Input */}
      <motion.div variants={fadeInUp} className="space-y-3">
        <div>
          <label className="text-xs font-medium text-surface-400 mb-1 block">Problem</label>
          <textarea
            ref={textareaRef}
            value={problem}
            onChange={handleProblemChange}
            placeholder="e.g. Find the eigenvalues of the matrix [[2,1],[1,2]]"
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-900 border border-surface-800 text-surface-200 text-sm placeholder:text-surface-600 focus:outline-none focus:border-sky-500/50 resize-none transition-[border-color] duration-200"
            style={{ minHeight: '5rem', overflow: 'hidden' }}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-surface-400 mb-1 block">Your Answer</label>
          <input
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="e.g. 1 and 3"
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-900 border border-surface-800 text-surface-200 text-sm placeholder:text-surface-600 focus:outline-none focus:border-sky-500/50 transition-[border-color] duration-200"
          />
        </div>

        <motion.button
          whileTap={canSubmit ? tapScale : undefined}
          onClick={handleVerify}
          disabled={!canSubmit}
          className={clsx(
            'w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200',
            canSubmit
              ? 'bg-gradient-to-r from-emerald-500 to-sky-500 text-white shadow-lg shadow-emerald-500/25 active:scale-[0.98]'
              : 'bg-surface-800 text-surface-500 cursor-not-allowed',
            canSubmit && !loading && 'animate-pulse',
          )}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={16} />
              Verifying...
            </span>
          ) : 'Verify Answer'}
        </motion.button>
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="space-y-3"
          >
            <motion.div
              variants={celebration}
              initial="hidden"
              animate="visible"
              className={clsx('p-4 rounded-xl border', statusColor(result.status))}
            >
              <div className="flex items-center gap-2">
                {result.status === 'verified' ? (
                  <motion.div
                    initial={{ rotate: -180, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  >
                    {statusIcon(result.status)}
                  </motion.div>
                ) : result.status === 'failed' ? (
                  <motion.div
                    initial={{ x: -5 }}
                    animate={{ x: [0, -3, 3, -3, 3, 0] }}
                    transition={{ duration: 0.4 }}
                  >
                    {statusIcon(result.status)}
                  </motion.div>
                ) : (
                  statusIcon(result.status)
                )}
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
            </motion.div>

            {/* Verification Steps */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-4 rounded-xl bg-surface-900 border border-surface-800"
            >
              <h3 className="text-xs font-semibold text-surface-400 mb-2 uppercase tracking-wider">Verification Steps</h3>
              <div className="space-y-2">
                {result.checks.map((check, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="flex items-start gap-2 text-sm"
                  >
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
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rate Limit Notice */}
      <motion.p variants={fadeInUp} className="text-xs text-surface-600 text-center">
        10 verifications per hour. Powered by RAG + LLM + Wolfram Alpha.
      </motion.p>
    </motion.div>
  );
}
