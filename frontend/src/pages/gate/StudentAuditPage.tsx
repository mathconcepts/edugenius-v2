/**
 * StudentAuditPage — 360° analysis of a student powered by GBrain.
 *
 * Shows: executive summary, mastery heatmap, error analysis, prerequisite alerts,
 * cognitive profile, motivation, strategic recommendations, and 3-session action plan.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '@/hooks/useApi';
import { useSession } from '@/hooks/useSession';
import { trackEvent } from '@/lib/analytics';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import {
  Target, TrendingUp, Brain, AlertTriangle, Lightbulb, Flame, CheckCircle2,
  BookOpen, Clock, Sparkles, ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';

interface AuditReport {
  session_id: string;
  generated_at: string;
  executive_summary: {
    predicted_score_range: string;
    readiness_level: 'not-ready' | 'building' | 'ready' | 'confident';
    biggest_risk: string;
    top_strength: string;
  };
  mastery_heatmap: Array<{
    topic: string; label: string; mastery: number; weight: number;
    expected_marks_contribution: number; trend: string;
  }>;
  error_analysis: {
    total_errors: number;
    dominant_type: string;
    trend: string;
    top_misconceptions: Array<{ id: string; count: number; description: string }>;
    recommendations: string[];
  };
  prerequisite_alerts: Array<{
    concept: string; severity: string; fix_order: string[];
  }>;
  cognitive_profile: {
    representation_mode: string;
    abstraction_comfort: number;
    working_memory_est: number;
    narrative: string;
  };
  motivation_trajectory: {
    current_state: string;
    consecutive_failures: number;
    narrative: string;
  };
  strategic_recommendations: string[];
  action_plan: Array<{
    session: number; focus: string; concepts: string[];
    duration_minutes: number; rationale: string;
  }>;
}

const READINESS_CONFIG = {
  'not-ready': { label: 'Foundation Phase', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25' },
  'building': { label: 'Building', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25' },
  'ready': { label: 'Exam-Ready', color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/25' },
  'confident': { label: 'Peak Form', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
};

export default function StudentAuditPage() {
  const sessionId = useSession();
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackEvent('page_view', { page: 'student-audit' });
    apiFetch<{ report: AuditReport }>(`/api/gbrain/audit/${sessionId}`)
      .then(res => setReport(res.report))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleExportMarkdown = async () => {
    const res = await fetch(`/api/gbrain/audit/${sessionId}?format=markdown`);
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${sessionId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-800/60 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !report) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16 space-y-4">
        <Brain size={48} className="text-surface-700 mx-auto" />
        <h2 className="text-xl font-bold text-surface-300">Audit unavailable</h2>
        <p className="text-sm text-surface-500">{error || 'Not enough data yet. Practice more problems first.'}</p>
      </motion.div>
    );
  }

  const readiness = READINESS_CONFIG[report.executive_summary.readiness_level];

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={staggerContainer}>
      <motion.div variants={fadeInUp} className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-100">Your Audit</h1>
          <p className="text-xs text-surface-500 mt-1">
            Generated {new Date(report.generated_at).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={handleExportMarkdown}
          className="px-3 py-1.5 rounded-lg bg-surface-900 border border-surface-800 text-xs text-surface-400 hover:text-surface-200 hover:border-surface-700 transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <BookOpen size={12} /> Export
        </button>
      </motion.div>

      {/* Executive Summary */}
      <motion.div variants={fadeInUp} className={clsx('p-4 rounded-xl border', readiness.bg, readiness.border)}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className={readiness.color} />
          <span className={clsx('text-xs font-semibold uppercase tracking-wide', readiness.color)}>
            {readiness.label}
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-surface-500">Predicted Score</span>
            <span className={clsx('text-sm font-bold', readiness.color)}>
              {report.executive_summary.predicted_score_range}
            </span>
          </div>
          <div>
            <p className="text-xs text-surface-500 mb-0.5">Biggest Risk</p>
            <p className="text-sm text-surface-300">{report.executive_summary.biggest_risk}</p>
          </div>
          <div>
            <p className="text-xs text-surface-500 mb-0.5">Top Strength</p>
            <p className="text-sm text-surface-300">{report.executive_summary.top_strength}</p>
          </div>
        </div>
      </motion.div>

      {/* Mastery Heatmap */}
      <motion.div variants={fadeInUp} className="space-y-2">
        <h2 className="text-sm font-semibold text-surface-300 flex items-center gap-1.5">
          <Target size={13} className="text-sky-400" />
          Mastery Heatmap
        </h2>
        <div className="space-y-1.5">
          {report.mastery_heatmap.map(h => {
            const pct = Math.round(h.mastery * 100);
            let barColor = 'bg-red-500/60';
            if (pct >= 70) barColor = 'bg-emerald-500/60';
            else if (pct >= 40) barColor = 'bg-amber-500/60';
            else if (pct >= 20) barColor = 'bg-orange-500/60';

            return (
              <div key={h.topic} className="p-2.5 rounded-lg bg-surface-900 border border-surface-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-surface-200 font-medium">{h.label}</span>
                  <div className="flex items-center gap-2 text-[10px] text-surface-500">
                    <span>{pct}%</span>
                    <span className="text-emerald-400">+{h.expected_marks_contribution} marks</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
                  <motion.div
                    className={clsx('h-full rounded-full', barColor)}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Prerequisite Alerts */}
      {report.prerequisite_alerts.length > 0 && (
        <motion.div variants={fadeInUp} className="space-y-2">
          <h2 className="text-sm font-semibold text-surface-300 flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-purple-400" />
            Foundation Alerts
          </h2>
          {report.prerequisite_alerts.slice(0, 5).map((a, i) => (
            <div key={i} className={clsx(
              'p-3 rounded-lg border',
              a.severity === 'critical' ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'
            )}>
              <div className="flex items-center gap-2 mb-1">
                <span className={clsx(
                  'text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide',
                  a.severity === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                )}>
                  {a.severity}
                </span>
                <span className="text-sm text-surface-200 font-medium">
                  {a.concept.replace(/-/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-surface-400">
                Fix order: {a.fix_order.slice(0, 3).map(c => c.replace(/-/g, ' ')).join(' → ')}
              </p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Cognitive Profile */}
      <motion.div variants={fadeInUp} className="p-4 rounded-xl bg-surface-900 border border-surface-800">
        <h2 className="text-sm font-semibold text-surface-300 flex items-center gap-1.5 mb-2">
          <Brain size={13} className="text-sky-400" />
          How You Think
        </h2>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 rounded-lg bg-surface-800">
            <p className="text-[10px] text-surface-500 uppercase tracking-wide">Style</p>
            <p className="text-sm text-surface-200 font-medium capitalize">{report.cognitive_profile.representation_mode}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-surface-800">
            <p className="text-[10px] text-surface-500 uppercase tracking-wide">Abstract</p>
            <p className="text-sm text-surface-200 font-medium">{Math.round(report.cognitive_profile.abstraction_comfort * 100)}%</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-surface-800">
            <p className="text-[10px] text-surface-500 uppercase tracking-wide">Memory</p>
            <p className="text-sm text-surface-200 font-medium">{report.cognitive_profile.working_memory_est} steps</p>
          </div>
        </div>
        <p className="text-xs text-surface-400 leading-relaxed">{report.cognitive_profile.narrative}</p>
      </motion.div>

      {/* Motivation */}
      <motion.div variants={fadeInUp} className="p-4 rounded-xl bg-surface-900 border border-surface-800">
        <h2 className="text-sm font-semibold text-surface-300 flex items-center gap-1.5 mb-2">
          <Flame size={13} className="text-amber-400" />
          Motivation
        </h2>
        <p className="text-xs text-surface-400 leading-relaxed">{report.motivation_trajectory.narrative}</p>
      </motion.div>

      {/* Strategic Recommendations */}
      {report.strategic_recommendations.length > 0 && (
        <motion.div variants={fadeInUp} className="space-y-2">
          <h2 className="text-sm font-semibold text-surface-300 flex items-center gap-1.5">
            <Lightbulb size={13} className="text-emerald-400" />
            Strategic Recommendations
          </h2>
          {report.strategic_recommendations.map((rec, i) => (
            <div key={i} className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
              <p className="text-sm text-surface-300 leading-relaxed">{rec}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Action Plan */}
      <motion.div variants={fadeInUp} className="space-y-2">
        <h2 className="text-sm font-semibold text-surface-300 flex items-center gap-1.5">
          <TrendingUp size={13} className="text-sky-400" />
          Next 3 Sessions
        </h2>
        {report.action_plan.map(s => (
          <div key={s.session} className="p-3 rounded-xl bg-surface-900 border border-surface-800">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold bg-sky-500/15 text-sky-400">
                  {s.session}
                </span>
                <span className="text-sm font-medium text-surface-200">{s.focus}</span>
              </div>
              <span className="text-[10px] text-surface-500 flex items-center gap-1">
                <Clock size={9} />
                {s.duration_minutes}m
              </span>
            </div>
            <p className="text-xs text-surface-400 leading-relaxed">{s.rationale}</p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
