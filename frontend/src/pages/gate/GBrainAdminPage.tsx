/**
 * GBrainAdminPage — unified admin dashboard for GBrain MOAT operations.
 *
 * Three tabs:
 *   1. Cohort — population insights (misconceptions, bottlenecks, motivation health)
 *   2. Health — system health checks
 *   3. Content — content gap scan + fill controls
 *
 * Auth: requires admin or teacher role. Token passed via Authorization header.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { trackEvent } from '@/lib/analytics';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import {
  Users, Activity, Package, RefreshCcw, CheckCircle2, AlertTriangle, XCircle,
  Brain, Target, TrendingUp, Zap, Loader2, Play, Shield,
} from 'lucide-react';
import { clsx } from 'clsx';

type Tab = 'cohort' | 'health' | 'content';

interface Cohort {
  period_days: number;
  total_students: number;
  top_misconceptions: Array<{ id: string; concept: string; description: string; count: number; impact_score: number }>;
  error_type_distribution: Array<{ type: string; count: number }>;
  bottleneck_concepts: Array<{ concept_id: string; label: string; struggler_count: number }>;
  motivation_health: Record<string, number>;
}

interface HealthReport {
  status: 'healthy' | 'degraded' | 'fail';
  generated_at: string;
  summary: string;
  checks: Array<{ name: string; status: 'ok' | 'warn' | 'fail'; value: any; message: string }>;
}

interface ContentGaps {
  total_gaps: number;
  gaps: Array<{
    concept_id: string; topic: string; difficulty_bucket: string;
    current_count: number; gate_frequency: string; priority: number;
  }>;
}

// Get auth header for admin endpoints via the useAuth getToken() method.
function useAuthHeaders() {
  const { getToken } = useAuth();
  return useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, [getToken]);
}

export default function GBrainAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const getHeaders = useAuthHeaders();
  const [tab, setTab] = useState<Tab>('cohort');
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [gaps, setGaps] = useState<ContentGaps | null>(null);
  const [loading, setLoading] = useState<Record<Tab, boolean>>({ cohort: true, health: true, content: true });
  const [error, setError] = useState<string | null>(null);
  const [fillingTopic, setFillingTopic] = useState<string | null>(null);
  const [fillResult, setFillResult] = useState<any>(null);

  useEffect(() => { trackEvent('page_view', { page: 'admin-gbrain' }); }, []);

  const loadCohort = useCallback(async () => {
    setLoading(l => ({ ...l, cohort: true }));
    try {
      const headers = await getHeaders();
      const data = await apiFetch<Cohort>('/api/gbrain/cohort?days=30', { headers });
      setCohort(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(l => ({ ...l, cohort: false }));
    }
  }, [getHeaders]);

  const loadHealth = useCallback(async () => {
    setLoading(l => ({ ...l, health: true }));
    try {
      const headers = await getHeaders();
      const data = await apiFetch<HealthReport>('/api/gbrain/health', { headers });
      setHealth(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(l => ({ ...l, health: false }));
    }
  }, [getHeaders]);

  const loadGaps = useCallback(async () => {
    setLoading(l => ({ ...l, content: true }));
    try {
      const headers = await getHeaders();
      const data = await apiFetch<ContentGaps>('/api/gbrain/content-gap/scan', { headers });
      setGaps(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(l => ({ ...l, content: false }));
    }
  }, [getHeaders]);

  useEffect(() => {
    if (authLoading || !user) return;
    if (user.role !== 'admin' && user.role !== 'teacher') return;
    loadCohort();
    loadHealth();
    loadGaps();
  }, [authLoading, user, loadCohort, loadHealth, loadGaps]);

  const handleFillGap = async (topic?: string, budget = 10) => {
    setFillingTopic(topic || 'all');
    setFillResult(null);
    try {
      const headers = await getHeaders();
      const result = await apiFetch<any>('/api/gbrain/content-gap/fill', {
        method: 'POST',
        headers,
        body: JSON.stringify({ topic, budget }),
      });
      setFillResult(result);
      loadGaps(); // refresh
    } catch (err) {
      setFillResult({ error: (err as Error).message });
    } finally {
      setFillingTopic(null);
    }
  };

  // Auth gating
  if (authLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="animate-spin text-sky-400" size={24} /></div>;
  }
  if (!user) {
    return (
      <div className="text-center py-16 space-y-4">
        <Shield size={48} className="text-surface-700 mx-auto" />
        <h2 className="text-xl font-bold text-surface-300">Sign in required</h2>
        <p className="text-sm text-surface-500">The admin dashboard requires authentication.</p>
        <a href="/login" className="inline-block mt-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 text-white text-sm font-medium">
          Sign in
        </a>
      </div>
    );
  }
  if (user.role !== 'admin' && user.role !== 'teacher') {
    return (
      <div className="text-center py-16 space-y-4">
        <Shield size={48} className="text-surface-700 mx-auto" />
        <h2 className="text-xl font-bold text-surface-300">Access denied</h2>
        <p className="text-sm text-surface-500">This page is only available to admins and teachers.</p>
      </div>
    );
  }

  return (
    <motion.div className="space-y-5" initial="hidden" animate="visible" variants={staggerContainer}>
      <motion.div variants={fadeInUp}>
        <h1 className="text-xl font-bold text-surface-100 flex items-center gap-2">
          <Brain size={20} className="text-sky-400" />
          GBrain Admin
        </h1>
        <p className="text-xs text-surface-500 mt-1">Cognitive architecture observability + control plane</p>
      </motion.div>

      {/* Tab switcher */}
      <motion.div variants={fadeInUp} className="flex gap-1 p-1 rounded-xl bg-surface-900 border border-surface-800 overflow-x-auto">
        {[
          { id: 'cohort' as Tab, label: 'Cohort', icon: Users },
          { id: 'health' as Tab, label: 'Health', icon: Activity },
          { id: 'content' as Tab, label: 'Content', icon: Package },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap',
              tab === t.id ? 'bg-surface-800 text-surface-100 shadow-sm' : 'text-surface-500 hover:text-surface-400',
            )}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </motion.div>

      {error && (
        <motion.div variants={fadeInUp} className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
          {error}
        </motion.div>
      )}

      {/* === COHORT TAB === */}
      {tab === 'cohort' && (
        <>
          {loading.cohort ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-surface-800/60 animate-pulse" />)}
            </div>
          ) : cohort ? (
            <motion.div className="space-y-4" variants={staggerContainer} initial="hidden" animate="visible">
              {/* Summary stats */}
              <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-surface-900 border border-surface-800 text-center">
                  <p className="text-lg font-bold text-surface-200">{cohort.total_students}</p>
                  <p className="text-xs text-surface-500">students tracked</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-900 border border-surface-800 text-center">
                  <p className="text-lg font-bold text-surface-200">{cohort.top_misconceptions.length}</p>
                  <p className="text-xs text-surface-500">misconceptions ({cohort.period_days}d)</p>
                </div>
              </motion.div>

              {/* Motivation health */}
              <motion.div variants={fadeInUp} className="p-4 rounded-xl bg-surface-900 border border-surface-800">
                <h3 className="text-sm font-semibold text-surface-200 mb-3">Motivation Health</h3>
                <div className="space-y-2">
                  {Object.entries(cohort.motivation_health).map(([state, count]) => {
                    const pct = cohort.total_students > 0 ? Math.round((count / cohort.total_students) * 100) : 0;
                    const color = state === 'driven' || state === 'steady' ? 'bg-emerald-500/60' : state === 'flagging' ? 'bg-amber-500/60' : 'bg-red-500/60';
                    return (
                      <div key={state}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-surface-300 capitalize">{state}</span>
                          <span className="text-surface-500">{count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} className={clsx('h-full rounded-full', color)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Top misconceptions */}
              <motion.div variants={fadeInUp} className="space-y-2">
                <h3 className="text-sm font-semibold text-surface-200">Top Misconceptions</h3>
                {cohort.top_misconceptions.length === 0 ? (
                  <p className="text-xs text-surface-500 p-3 bg-surface-900 border border-surface-800 rounded-xl">No misconceptions logged yet.</p>
                ) : (
                  cohort.top_misconceptions.slice(0, 10).map((m, i) => (
                    <div key={i} className="p-3 rounded-xl bg-surface-900 border border-surface-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-sky-400">{m.id}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-surface-500">{m.count}×</span>
                          <span className="text-emerald-400">impact: {m.impact_score.toFixed(1)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-surface-500">{m.concept} — {m.description}</p>
                    </div>
                  ))
                )}
              </motion.div>

              {/* Error type distribution */}
              <motion.div variants={fadeInUp} className="p-4 rounded-xl bg-surface-900 border border-surface-800">
                <h3 className="text-sm font-semibold text-surface-200 mb-3">Error Types</h3>
                {cohort.error_type_distribution.length === 0 ? (
                  <p className="text-xs text-surface-500">No errors logged yet.</p>
                ) : (
                  <div className="space-y-2">
                    {cohort.error_type_distribution.map(e => (
                      <div key={e.type} className="flex items-center justify-between text-xs">
                        <span className="text-surface-300 capitalize">{e.type.replace(/_/g, ' ')}</span>
                        <span className="text-surface-500">{e.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>

              {/* Bottleneck concepts */}
              {cohort.bottleneck_concepts.length > 0 && (
                <motion.div variants={fadeInUp} className="space-y-2">
                  <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-1.5">
                    <AlertTriangle size={13} className="text-red-400" />
                    Bottleneck Concepts
                  </h3>
                  {cohort.bottleneck_concepts.slice(0, 10).map(b => (
                    <div key={b.concept_id} className="flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/15">
                      <span className="text-sm text-surface-300">{b.label}</span>
                      <span className="text-xs text-red-400 font-mono">{b.struggler_count} strugglers</span>
                    </div>
                  ))}
                </motion.div>
              )}

              <motion.button variants={fadeInUp} onClick={loadCohort} className="w-full py-2.5 rounded-xl bg-surface-900 border border-surface-800 text-sm text-surface-400 hover:text-surface-200 flex items-center justify-center gap-2">
                <RefreshCcw size={13} /> Refresh
              </motion.button>
            </motion.div>
          ) : null}
        </>
      )}

      {/* === HEALTH TAB === */}
      {tab === 'health' && (
        <>
          {loading.health ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-surface-800/60 animate-pulse" />)}
            </div>
          ) : health ? (
            <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" animate="visible">
              {/* Overall status */}
              <motion.div variants={fadeInUp} className={clsx(
                'p-4 rounded-xl border text-center',
                health.status === 'healthy' ? 'bg-emerald-500/10 border-emerald-500/25' :
                health.status === 'degraded' ? 'bg-amber-500/10 border-amber-500/25' :
                'bg-red-500/10 border-red-500/25'
              )}>
                <div className="flex items-center justify-center gap-2 mb-1">
                  {health.status === 'healthy' ? <CheckCircle2 size={18} className="text-emerald-400" /> :
                   health.status === 'degraded' ? <AlertTriangle size={18} className="text-amber-400" /> :
                   <XCircle size={18} className="text-red-400" />}
                  <span className="text-lg font-bold uppercase tracking-wide text-surface-100">
                    {health.status}
                  </span>
                </div>
                <p className="text-xs text-surface-400">{health.summary}</p>
                <p className="text-[10px] text-surface-500 mt-1">checked {new Date(health.generated_at).toLocaleTimeString()}</p>
              </motion.div>

              {/* Individual checks */}
              {health.checks.map((c, i) => (
                <motion.div key={c.name} variants={fadeInUp} className={clsx(
                  'p-3 rounded-xl border',
                  c.status === 'ok' ? 'bg-surface-900 border-surface-800' :
                  c.status === 'warn' ? 'bg-amber-500/5 border-amber-500/20' :
                  'bg-red-500/5 border-red-500/20'
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    {c.status === 'ok' ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0" /> :
                     c.status === 'warn' ? <AlertTriangle size={14} className="text-amber-400 shrink-0" /> :
                     <XCircle size={14} className="text-red-400 shrink-0" />}
                    <span className="text-sm text-surface-200 font-mono">{c.name}</span>
                  </div>
                  <p className="text-xs text-surface-400 ml-6">{c.message}</p>
                </motion.div>
              ))}

              <motion.button variants={fadeInUp} onClick={loadHealth} className="w-full py-2.5 rounded-xl bg-surface-900 border border-surface-800 text-sm text-surface-400 hover:text-surface-200 flex items-center justify-center gap-2">
                <RefreshCcw size={13} /> Refresh
              </motion.button>
            </motion.div>
          ) : null}
        </>
      )}

      {/* === CONTENT TAB === */}
      {tab === 'content' && (
        <>
          {loading.content ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-surface-800/60 animate-pulse" />)}
            </div>
          ) : gaps ? (
            <motion.div className="space-y-4" variants={staggerContainer} initial="hidden" animate="visible">
              {/* Summary */}
              <motion.div variants={fadeInUp} className="p-4 rounded-xl bg-surface-900 border border-surface-800">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-2xl font-bold text-surface-100">{gaps.total_gaps}</p>
                    <p className="text-xs text-surface-500">content gaps identified</p>
                  </div>
                  <button
                    onClick={() => handleFillGap(undefined, 20)}
                    disabled={fillingTopic !== null}
                    className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {fillingTopic === 'all' ? <Loader2 className="animate-spin" size={13} /> : <Play size={13} />}
                    Fill Top 20
                  </button>
                </div>
                <p className="text-xs text-surface-400">
                  Auto-generates problems for the highest-priority gaps and verifies them via GBrain's self-check pipeline.
                </p>
              </motion.div>

              {/* Fill result */}
              {fillResult && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                  <p className="text-sm font-semibold text-emerald-300 mb-1">Generation complete</p>
                  <p className="text-xs text-surface-300">
                    {fillResult.error ? `Error: ${fillResult.error}` : (
                      `${fillResult.processed} gap(s) processed. ${(fillResult.results || []).filter((r: any) => r.verified).length} problems verified.`
                    )}
                  </p>
                </motion.div>
              )}

              {/* Top gaps */}
              <motion.div variants={fadeInUp} className="space-y-2">
                <h3 className="text-sm font-semibold text-surface-200">Top priority gaps</h3>
                {gaps.gaps.slice(0, 20).map((g, i) => (
                  <div key={`${g.concept_id}-${g.difficulty_bucket}`} className="flex items-center justify-between p-3 rounded-xl bg-surface-900 border border-surface-800">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={clsx(
                          'text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase',
                          g.difficulty_bucket === 'easy' ? 'bg-emerald-500/15 text-emerald-400' :
                          g.difficulty_bucket === 'medium' ? 'bg-amber-500/15 text-amber-400' :
                          'bg-red-500/15 text-red-400'
                        )}>
                          {g.difficulty_bucket}
                        </span>
                        <span className="text-sm text-surface-200 truncate">{g.concept_id.replace(/-/g, ' ')}</span>
                      </div>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {g.topic.replace(/-/g, ' ')} · {g.gate_frequency} freq · {g.current_count}/5 problems
                      </p>
                    </div>
                    <div className="text-xs text-surface-500 ml-3">priority: {g.priority}</div>
                  </div>
                ))}
              </motion.div>

              <motion.button variants={fadeInUp} onClick={loadGaps} className="w-full py-2.5 rounded-xl bg-surface-900 border border-surface-800 text-sm text-surface-400 hover:text-surface-200 flex items-center justify-center gap-2">
                <RefreshCcw size={13} /> Refresh
              </motion.button>
            </motion.div>
          ) : null}
        </>
      )}
    </motion.div>
  );
}
