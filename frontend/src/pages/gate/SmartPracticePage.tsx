/**
 * SmartPracticePage — content engine in action.
 *
 * Unlike the legacy PracticePage which fetches by problem ID, this page uses
 * the four-tier resolver so practice is delivered from the cheapest available
 * source. Shows the user exactly where each problem came from and what it cost
 * (educational + transparency).
 *
 * Flow:
 *   User picks topic + difficulty
 *   → resolve() walks tiers
 *   → problem renders with provenance badge
 *   → user answers, GBrain updates locally
 *   → next problem via same resolver
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { trackEvent } from '@/lib/analytics';
import { useSession } from '@/hooks/useSession';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { resolve, warmContentBundle, getBundleStats, type ResolvedContent, type ContentSource } from '@/lib/content/resolver';
import { recordAttempt } from '@/lib/gbrain/client';
import {
  Sparkles, Zap, Database, Server, CheckCircle2, XCircle, Loader2, ArrowRight,
  BookOpen, Target, DollarSign, Clock,
} from 'lucide-react';
import { clsx } from 'clsx';

const TOPICS = [
  'linear-algebra', 'calculus', 'differential-equations', 'probability-statistics',
  'complex-variables', 'numerical-methods', 'transform-theory',
  'discrete-mathematics', 'graph-theory', 'vector-calculus',
];

const DIFFICULTY_LABELS: Array<{ label: string; value: number }> = [
  { label: 'Easy', value: 0.25 },
  { label: 'Medium', value: 0.5 },
  { label: 'Hard', value: 0.75 },
];

const SOURCE_META: Record<ContentSource, { label: string; icon: typeof Sparkles; color: string; description: string }> = {
  'tier-0-bundle-exact': { label: 'Bundled', icon: Database, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', description: 'Served from pre-verified bundle — instant, free.' },
  'tier-0-explainer': { label: 'Explainer', icon: BookOpen, color: 'text-sky-400 bg-sky-500/10 border-sky-500/25', description: 'Canonical concept explainer — pre-computed.' },
  'tier-0-client-cache': { label: 'Cached', icon: Zap, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', description: 'Cached on your device from previous session.' },
  'tier-1-rag': { label: 'RAG', icon: Sparkles, color: 'text-purple-400 bg-purple-500/10 border-purple-500/25', description: 'Semantic match over bundle.' },
  'tier-1-material': { label: 'Your Notes', icon: BookOpen, color: 'text-amber-400 bg-amber-500/10 border-amber-500/25', description: 'Grounded in your uploaded materials.' },
  'tier-2-generated': { label: 'Generated', icon: Sparkles, color: 'text-sky-400 bg-sky-500/10 border-sky-500/25', description: 'Generated live via Gemini Flash-Lite.' },
  'tier-3-wolfram-verified': { label: 'Wolfram-Verified', icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', description: 'Computationally verified by Wolfram|Alpha.' },
  'miss': { label: 'No Match', icon: XCircle, color: 'text-red-400 bg-red-500/10 border-red-500/25', description: 'No content available. Upload materials or pick another topic.' },
};

export default function SmartPracticePage() {
  const sessionId = useSession();
  const [topic, setTopic] = useState<string>('linear-algebra');
  const [difficulty, setDifficulty] = useState<number>(0.5);
  const [requireWolfram, setRequireWolfram] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState<ResolvedContent | null>(null);
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [bundleStats, setBundleStats] = useState<any>(null);
  const [sessionStats, setSessionStats] = useState({ problems_served: 0, total_cost_usd: 0, avg_latency_ms: 0 });

  useEffect(() => {
    trackEvent('page_view', { page: 'smart-practice' });
    warmContentBundle();
    getBundleStats().then(setBundleStats).catch(() => {});
  }, []);

  const nextProblem = useCallback(async () => {
    setLoading(true);
    setSubmitted(false);
    setWasCorrect(null);
    setAnswer('');
    try {
      const result = await resolve({
        intent: 'practice',
        concept_id: topic,
        topic,
        difficulty,
        require_wolfram: requireWolfram,
        use_materials: true,
      });
      setResolved(result);
      setStartedAt(Date.now());
      setSessionStats(s => ({
        problems_served: s.problems_served + 1,
        total_cost_usd: s.total_cost_usd + result.cost_estimate_usd,
        avg_latency_ms: Math.round((s.avg_latency_ms * s.problems_served + result.latency_ms) / (s.problems_served + 1)),
      }));
      trackEvent('content_resolved', { source: result.source, cost: result.cost_estimate_usd });
    } catch (err) {
      setResolved({ source: 'miss', confidence: 0, latency_ms: 0, cost_estimate_usd: 0 });
    } finally {
      setLoading(false);
    }
  }, [topic, difficulty, requireWolfram]);

  const handleSubmit = async () => {
    if (!resolved?.problem) return;
    const timeTakenMs = Date.now() - startedAt;
    const correct = resolved.problem.correct_answer &&
      answer.trim().toLowerCase() === String(resolved.problem.correct_answer).trim().toLowerCase();
    setWasCorrect(!!correct);
    setSubmitted(true);

    try {
      await recordAttempt({
        sessionId,
        problem: resolved.problem.question_text,
        studentAnswer: answer.trim(),
        correctAnswer: String(resolved.problem.correct_answer),
        conceptId: resolved.problem.concept_id || topic,
        isCorrect: !!correct,
        difficulty,
        timeTakenMs,
        problemId: resolved.problem.id,
      });
    } catch {}
  };

  const sourceMeta = resolved ? SOURCE_META[resolved.source] : null;

  return (
    <motion.div className="space-y-5" initial="hidden" animate="visible" variants={staggerContainer}>
      <motion.div variants={fadeInUp}>
        <h1 className="text-xl font-bold text-surface-100 flex items-center gap-2">
          <Sparkles size={20} className="text-sky-400" />
          Smart Practice
        </h1>
        <p className="text-xs text-surface-500 mt-1">
          Content routed through the cheapest matching tier. Watch the cost meter.
        </p>
      </motion.div>

      {/* Bundle stats mini-dash */}
      {bundleStats && (
        <motion.div variants={fadeInUp} className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl bg-surface-900 border border-surface-800 text-center">
            <p className="text-lg font-bold text-surface-100">{bundleStats.total_problems}</p>
            <p className="text-[10px] text-surface-500">bundled problems</p>
          </div>
          <div className="p-2.5 rounded-xl bg-surface-900 border border-surface-800 text-center">
            <p className="text-lg font-bold text-surface-100">{bundleStats.total_explainers}</p>
            <p className="text-[10px] text-surface-500">explainers</p>
          </div>
          <div className="p-2.5 rounded-xl bg-surface-900 border border-surface-800 text-center">
            <p className="text-lg font-bold text-emerald-400">${sessionStats.total_cost_usd.toFixed(4)}</p>
            <p className="text-[10px] text-surface-500">session cost</p>
          </div>
        </motion.div>
      )}

      {/* Controls */}
      <motion.div variants={fadeInUp} className="p-3 rounded-xl bg-surface-900 border border-surface-800 space-y-3">
        <div>
          <label className="text-[10px] text-surface-500 uppercase tracking-wide">Topic</label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {TOPICS.map(t => (
              <button key={t}
                onClick={() => setTopic(t)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs transition-colors',
                  topic === t ? 'bg-sky-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-surface-200',
                )}>
                {t.replace(/-/g, ' ')}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] text-surface-500 uppercase tracking-wide">Difficulty</label>
          <div className="flex gap-1.5 mt-1.5">
            {DIFFICULTY_LABELS.map(d => (
              <button key={d.value}
                onClick={() => setDifficulty(d.value)}
                className={clsx(
                  'flex-1 py-1.5 rounded-lg text-xs',
                  difficulty === d.value ? 'bg-sky-500 text-white' : 'bg-surface-800 text-surface-400',
                )}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-surface-300">Require Wolfram verification</p>
            <p className="text-[10px] text-surface-500">Slower + tiny cost, but fully verified</p>
          </div>
          <button
            onClick={() => setRequireWolfram(v => !v)}
            className={`w-10 h-6 rounded-full transition-colors ${requireWolfram ? 'bg-emerald-500' : 'bg-surface-700'}`}
          >
            <motion.div
              className="w-4 h-4 rounded-full bg-white shadow"
              animate={{ x: requireWolfram ? 18 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
        <button
          onClick={nextProblem}
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 text-white font-semibold flex items-center justify-center gap-1.5"
        >
          {loading ? <Loader2 className="animate-spin" size={14} /> : <ArrowRight size={14} />}
          {loading ? 'Resolving...' : resolved ? 'Next problem' : 'Get problem'}
        </button>
      </motion.div>

      {/* Resolved problem */}
      <AnimatePresence mode="wait">
        {resolved && (
          <motion.div
            key={resolved.problem?.id || resolved.source}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {/* Provenance badge */}
            {sourceMeta && (
              <div className={clsx('p-3 rounded-xl border flex items-start gap-2', sourceMeta.color)}>
                <sourceMeta.icon size={14} className="shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide">{sourceMeta.label}</p>
                    <div className="flex items-center gap-3 text-[10px] shrink-0">
                      <span className="flex items-center gap-1"><Clock size={10} />{resolved.latency_ms}ms</span>
                      <span className="flex items-center gap-1"><DollarSign size={10} />{resolved.cost_estimate_usd === 0 ? 'free' : resolved.cost_estimate_usd.toFixed(4)}</span>
                    </div>
                  </div>
                  <p className="text-xs opacity-80 mt-0.5">{sourceMeta.description}</p>
                </div>
              </div>
            )}

            {resolved.source === 'miss' && (
              <div className="p-4 rounded-xl bg-surface-900 border border-surface-800 text-center text-sm text-surface-400">
                No match for this topic at this difficulty. Try a different combination,
                or upload study materials at <a href="/materials" className="text-sky-400 underline">/materials</a>.
              </div>
            )}

            {resolved.problem && (
              <div className="p-4 rounded-xl bg-surface-900 border border-surface-800 space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] text-surface-500 uppercase tracking-wide">
                  <Target size={10} />
                  {resolved.problem.topic?.replace(/-/g, ' ')}
                  <span>·</span>
                  <span>{resolved.problem.year || 'generated'}</span>
                  <span>·</span>
                  <span>{resolved.problem.marks || 2} marks</span>
                </div>
                <p className="text-sm text-surface-100 leading-relaxed whitespace-pre-wrap">
                  {resolved.problem.question_text}
                </p>

                {resolved.problem.options && typeof resolved.problem.options === 'object' && (
                  <div className="space-y-1.5">
                    {Object.entries(resolved.problem.options).map(([key, val]) => (
                      <button
                        key={key}
                        disabled={submitted}
                        onClick={() => !submitted && setAnswer(key)}
                        className={clsx(
                          'w-full text-left p-2.5 rounded-lg border transition-colors text-sm',
                          submitted && key === resolved.problem.correct_answer ? 'bg-emerald-500/15 border-emerald-500/40' :
                          submitted && key === answer && key !== resolved.problem.correct_answer ? 'bg-red-500/15 border-red-500/40' :
                          answer === key ? 'bg-sky-500/15 border-sky-500/40 text-sky-200' :
                          'bg-surface-800 border-surface-700 text-surface-300',
                        )}
                      >
                        <span className="font-mono mr-2 font-bold">{key}.</span>
                        {String(val)}
                      </button>
                    ))}
                  </div>
                )}

                {!resolved.problem.options && (
                  <input
                    type="text"
                    value={answer}
                    disabled={submitted}
                    onChange={e => setAnswer(e.target.value)}
                    placeholder="Your answer..."
                    className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-surface-200 text-sm focus:outline-none focus:border-sky-500/50"
                  />
                )}

                {!submitted ? (
                  <button
                    onClick={handleSubmit}
                    disabled={!answer}
                    className="w-full py-2.5 rounded-lg bg-sky-500 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    Submit
                  </button>
                ) : (
                  <div className={clsx(
                    'p-3 rounded-lg border flex items-start gap-2',
                    wasCorrect ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-red-500/10 border-red-500/25',
                  )}>
                    {wasCorrect ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" /> : <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />}
                    <div className="text-xs text-surface-300">
                      <p className="font-semibold">{wasCorrect ? 'Correct!' : 'Not quite.'}</p>
                      <p className="mt-0.5">Answer: <span className="font-mono">{resolved.problem.correct_answer}</span></p>
                      {resolved.problem.explanation && <p className="mt-1 opacity-80">{resolved.problem.explanation}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Explainer mode */}
            {resolved.explainer && (
              <div className="p-4 rounded-xl bg-surface-900 border border-surface-800 space-y-2">
                <h3 className="text-sm font-semibold text-surface-100">{resolved.explainer.label}</h3>
                <p className="text-xs text-surface-400 leading-relaxed">{resolved.explainer.canonical_definition}</p>
                {resolved.explainer.exam_tip && (
                  <p className="text-xs text-sky-300 mt-2">💡 {resolved.explainer.exam_tip}</p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session stats */}
      {sessionStats.problems_served > 0 && (
        <motion.div variants={fadeInUp} className="p-3 rounded-xl bg-surface-900 border border-surface-800">
          <p className="text-[10px] text-surface-500 uppercase tracking-wide mb-2">Session</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-surface-200">{sessionStats.problems_served}</p>
              <p className="text-[10px] text-surface-500">problems</p>
            </div>
            <div>
              <p className="text-lg font-bold text-surface-200">{sessionStats.avg_latency_ms}ms</p>
              <p className="text-[10px] text-surface-500">avg latency</p>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-400">${sessionStats.total_cost_usd.toFixed(4)}</p>
              <p className="text-[10px] text-surface-500">total cost</p>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
