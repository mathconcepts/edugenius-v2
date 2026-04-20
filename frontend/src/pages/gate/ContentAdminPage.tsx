/**
 * ContentAdminPage — observability for the content engine.
 *
 * Shows:
 *   - Lifetime + 14-day tier hit rates (how many served from bundle vs Gemini vs Wolfram)
 *   - Cost trend per day
 *   - Free hit rate percentage (tier-0 + tier-1 as % of total)
 *   - Topic coverage from current bundle
 *   - Generated vs Wolfram-verified counts
 *
 * Auth: admin or teacher role.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { trackEvent } from '@/lib/analytics';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import {
  Shield, Loader2, RefreshCcw, Database, Zap, Sparkles, DollarSign,
  TrendingUp, BookOpen, Layers, CheckCircle2,
} from 'lucide-react';
import { clsx } from 'clsx';

interface Summary {
  lifetime: {
    total_events: number;
    total_cost_usd: number;
    by_source: Record<string, number>;
    free_hit_rate_pct: number;
    avg_cost_per_event_usd: number;
  };
  last_14_days: Array<{
    day: string;
    total: number;
    cost_usd: number;
    avg_latency_ms: number;
    tier_0: number;
    tier_1: number;
    tier_2: number;
    tier_3: number;
    miss: number;
    free_hit_rate_pct: number;
  }>;
  started_at: string;
}

interface BundleStats {
  version: number;
  total_problems: number;
  total_explainers: number;
  wolfram_verified_count: number;
  by_topic: Record<string, number>;
}

const SOURCE_LABELS: Record<string, { label: string; color: string; tier: string }> = {
  'tier-0-bundle-exact': { label: 'Bundle Exact', color: 'bg-emerald-500/60', tier: 'Tier 0' },
  'tier-0-explainer': { label: 'Explainer', color: 'bg-emerald-400/60', tier: 'Tier 0' },
  'tier-0-client-cache': { label: 'Client Cache', color: 'bg-teal-500/60', tier: 'Tier 0' },
  'tier-1-rag': { label: 'Bundle RAG', color: 'bg-sky-500/60', tier: 'Tier 1' },
  'tier-1-material': { label: 'Your Notes', color: 'bg-purple-500/60', tier: 'Tier 1' },
  'tier-2-generated': { label: 'Generated (LLM)', color: 'bg-amber-500/60', tier: 'Tier 2' },
  'tier-3-wolfram-verified': { label: 'Wolfram Verified', color: 'bg-blue-500/60', tier: 'Tier 3' },
  'miss': { label: 'Miss', color: 'bg-red-500/50', tier: 'Miss' },
};

export default function ContentAdminPage() {
  const { user, loading: authLoading, getToken } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [stats, setStats] = useState<BundleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const [sum, st] = await Promise.all([
        apiFetch<Summary>('/api/content/telemetry/summary', { headers }),
        apiFetch<BundleStats>('/api/content/stats'),
      ]);
      setSummary(sum);
      setStats(st);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    trackEvent('page_view', { page: 'admin-content' });
    if (authLoading || !user) return;
    if (user.role !== 'admin' && user.role !== 'teacher') return;
    load();
  }, [authLoading, user, load]);

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="animate-spin text-sky-400" size={24} /></div>;
  }
  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
    return (
      <div className="text-center py-16 space-y-4">
        <Shield size={48} className="text-surface-700 mx-auto" />
        <h2 className="text-xl font-bold text-surface-300">Admin access required</h2>
        {!user && (
          <a href="/login" className="inline-block px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 text-white text-sm font-medium">
            Sign in
          </a>
        )}
      </div>
    );
  }

  return (
    <motion.div className="space-y-5" initial="hidden" animate="visible" variants={staggerContainer}>
      <motion.div variants={fadeInUp} className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-100 flex items-center gap-2">
            <Layers size={20} className="text-sky-400" />
            Content Engine
          </h1>
          <p className="text-xs text-surface-500 mt-1">Tier hit rates, cost trends, bundle inventory</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg bg-surface-900 border border-surface-800 text-surface-400 hover:text-surface-200">
          <RefreshCcw size={13} />
        </button>
      </motion.div>

      {error && (
        <motion.div variants={fadeInUp} className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
          {error}
        </motion.div>
      )}

      {loading && !summary ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-surface-800/60 animate-pulse" />)}
        </div>
      ) : summary && stats ? (
        <>
          {/* Headline metrics */}
          <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-sky-500/10 border border-emerald-500/25 text-center">
              <p className="text-3xl font-black text-emerald-400">{summary.lifetime.free_hit_rate_pct}%</p>
              <p className="text-xs text-surface-400 mt-1">free tier hit rate</p>
              <p className="text-[10px] text-surface-600 mt-0.5">target ≥ 85%</p>
            </div>
            <div className="p-4 rounded-xl bg-surface-900 border border-surface-800 text-center">
              <p className="text-3xl font-black text-surface-100">
                ${summary.lifetime.avg_cost_per_event_usd.toFixed(5)}
              </p>
              <p className="text-xs text-surface-400 mt-1">avg cost / event</p>
              <p className="text-[10px] text-surface-600 mt-0.5">lifetime: ${summary.lifetime.total_cost_usd.toFixed(4)}</p>
            </div>
          </motion.div>

          <motion.div variants={fadeInUp} className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-xl bg-surface-900 border border-surface-800 text-center">
              <p className="text-lg font-bold text-surface-200">{stats.total_problems}</p>
              <p className="text-[10px] text-surface-500">bundle problems</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-900 border border-surface-800 text-center">
              <p className="text-lg font-bold text-surface-200">{stats.total_explainers}</p>
              <p className="text-[10px] text-surface-500">explainers</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-900 border border-surface-800 text-center">
              <p className="text-lg font-bold text-emerald-400">{stats.wolfram_verified_count}</p>
              <p className="text-[10px] text-surface-500">Wolfram verified</p>
            </div>
          </motion.div>

          {/* Tier source breakdown — lifetime */}
          <motion.div variants={fadeInUp} className="p-4 rounded-xl bg-surface-900 border border-surface-800">
            <h3 className="text-sm font-semibold text-surface-200 mb-3 flex items-center gap-1.5">
              <Layers size={13} className="text-sky-400" />
              Lifetime Source Distribution
            </h3>
            {summary.lifetime.total_events === 0 ? (
              <p className="text-xs text-surface-500 italic">No resolve events yet. Use Smart Practice to generate traffic.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(summary.lifetime.by_source)
                  .sort(([, a], [, b]) => b - a)
                  .map(([source, count]) => {
                    const meta = SOURCE_LABELS[source] || { label: source, color: 'bg-surface-600', tier: '' };
                    const pct = Math.round((count / summary.lifetime.total_events) * 100);
                    return (
                      <div key={source}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-surface-300 flex items-center gap-2">
                            <span className="text-[10px] text-surface-500 font-mono">{meta.tier}</span>
                            {meta.label}
                          </span>
                          <span className="text-surface-400 font-mono">{count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5 }}
                            className={clsx('h-full rounded-full', meta.color)}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </motion.div>

          {/* 14-day trend */}
          <motion.div variants={fadeInUp} className="p-4 rounded-xl bg-surface-900 border border-surface-800">
            <h3 className="text-sm font-semibold text-surface-200 mb-3 flex items-center gap-1.5">
              <TrendingUp size={13} className="text-emerald-400" />
              Last 14 Days
            </h3>
            {summary.last_14_days.length === 0 ? (
              <p className="text-xs text-surface-500 italic">No daily data yet.</p>
            ) : (
              <div className="space-y-1.5">
                {summary.last_14_days.map(d => (
                  <div key={d.day} className="flex items-center gap-2 text-[11px]">
                    <span className="font-mono text-surface-500 w-16 shrink-0">{d.day.slice(5)}</span>
                    <div className="flex-1 flex h-4 rounded overflow-hidden bg-surface-800">
                      {d.tier_0 > 0 && (
                        <div className="bg-emerald-500/70" style={{ width: `${(d.tier_0 / d.total) * 100}%` }} title={`Tier 0: ${d.tier_0}`} />
                      )}
                      {d.tier_1 > 0 && (
                        <div className="bg-sky-500/70" style={{ width: `${(d.tier_1 / d.total) * 100}%` }} title={`Tier 1: ${d.tier_1}`} />
                      )}
                      {d.tier_2 > 0 && (
                        <div className="bg-amber-500/70" style={{ width: `${(d.tier_2 / d.total) * 100}%` }} title={`Tier 2: ${d.tier_2}`} />
                      )}
                      {d.tier_3 > 0 && (
                        <div className="bg-blue-500/70" style={{ width: `${(d.tier_3 / d.total) * 100}%` }} title={`Tier 3: ${d.tier_3}`} />
                      )}
                      {d.miss > 0 && (
                        <div className="bg-red-500/60" style={{ width: `${(d.miss / d.total) * 100}%` }} title={`Miss: ${d.miss}`} />
                      )}
                    </div>
                    <span className="text-surface-400 font-mono w-12 text-right shrink-0">{d.total}</span>
                    <span className="text-emerald-400 font-mono w-16 text-right shrink-0">${d.cost_usd.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center gap-3 text-[10px] text-surface-500 flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/70" /> Tier 0 (free)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-sky-500/70" /> Tier 1 (free)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/70" /> Tier 2 (LLM)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500/70" /> Tier 3 (Wolfram)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/60" /> Miss</span>
            </div>
          </motion.div>

          {/* Topic coverage */}
          <motion.div variants={fadeInUp} className="p-4 rounded-xl bg-surface-900 border border-surface-800">
            <h3 className="text-sm font-semibold text-surface-200 mb-3 flex items-center gap-1.5">
              <BookOpen size={13} className="text-purple-400" />
              Bundle Topic Coverage
            </h3>
            <div className="space-y-1.5">
              {Object.entries(stats.by_topic)
                .sort(([, a], [, b]) => b - a)
                .map(([topic, count]) => {
                  const maxCount = Math.max(...Object.values(stats.by_topic));
                  const pct = (count / maxCount) * 100;
                  return (
                    <div key={topic}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-surface-300 capitalize">{topic.replace(/-/g, ' ')}</span>
                        <span className="text-surface-500 font-mono">{count}</span>
                      </div>
                      <div className="h-1 rounded-full bg-surface-800 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5 }}
                          className="h-full bg-purple-500/60 rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.div>

          {/* Lifetime started_at */}
          <motion.div variants={fadeInUp} className="text-center text-[10px] text-surface-600">
            Tracking since {new Date(summary.started_at).toLocaleDateString()}
          </motion.div>
        </>
      ) : null}
    </motion.div>
  );
}
