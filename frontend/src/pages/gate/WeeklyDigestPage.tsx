/**
 * WeeklyDigestPage — student-facing weekly progress report.
 * Opens a tone-calibrated summary with one concrete action for the week.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '@/hooks/useApi';
import { useSession } from '@/hooks/useSession';
import { trackEvent } from '@/lib/analytics';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { CountUp } from '@/components/gate/CountUp';
import { Calendar, Flame, TrendingUp, Target, AlertCircle, Sparkles } from 'lucide-react';

interface Digest {
  session_id: string;
  generated_at: string;
  opening: string;
  stats: {
    problems_this_week: number;
    accuracy_pct: number;
    streak_days: number;
    errors_fixed: number;
  };
  growth_proof: string;
  ugly_truth: string | null;
  one_action: string;
  predicted_score: {
    current_trajectory: number;
    range: string;
  };
}

export default function WeeklyDigestPage() {
  const sessionId = useSession();
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackEvent('page_view', { page: 'weekly-digest' });
    apiFetch<Digest>(`/api/gbrain/weekly-digest/${sessionId}`)
      .then(setDigest)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-800/60 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!digest) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16 space-y-4">
        <Calendar size={48} className="text-surface-700 mx-auto" />
        <h2 className="text-xl font-bold text-surface-300">Digest unavailable</h2>
        <p className="text-sm text-surface-500">Come back next week for your progress summary.</p>
      </motion.div>
    );
  }

  return (
    <motion.div className="space-y-5" initial="hidden" animate="visible" variants={staggerContainer}>
      {/* Header */}
      <motion.div variants={fadeInUp}>
        <h1 className="text-xl font-bold text-surface-100">This Week</h1>
        <p className="text-xs text-surface-500 mt-1">
          {new Date(digest.generated_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
      </motion.div>

      {/* Opening */}
      <motion.div variants={fadeInUp} className="p-5 rounded-xl bg-gradient-to-br from-sky-500/10 to-emerald-500/10 border border-sky-500/20">
        <Sparkles size={20} className="text-sky-400 mb-3" />
        <p className="text-base text-surface-100 leading-relaxed font-medium">{digest.opening}</p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-surface-900 border border-surface-800 text-center">
          <Target size={14} className="text-sky-400 mx-auto mb-1" />
          <CountUp target={digest.stats.problems_this_week} className="text-lg font-bold text-surface-200 block" />
          <p className="text-[10px] text-surface-500">problems solved</p>
        </div>
        <div className="p-3 rounded-xl bg-surface-900 border border-surface-800 text-center">
          <TrendingUp size={14} className="text-emerald-400 mx-auto mb-1" />
          <CountUp target={digest.stats.accuracy_pct} suffix="%" className="text-lg font-bold text-surface-200 block" />
          <p className="text-[10px] text-surface-500">accuracy</p>
        </div>
        <div className="p-3 rounded-xl bg-surface-900 border border-surface-800 text-center">
          <Flame size={14} className="text-amber-400 mx-auto mb-1" />
          <CountUp target={digest.stats.streak_days} suffix="d" className="text-lg font-bold text-surface-200 block" />
          <p className="text-[10px] text-surface-500">day streak</p>
        </div>
        <div className="p-3 rounded-xl bg-surface-900 border border-surface-800 text-center">
          <Sparkles size={14} className="text-purple-400 mx-auto mb-1" />
          <CountUp target={digest.stats.errors_fixed} className="text-lg font-bold text-surface-200 block" />
          <p className="text-[10px] text-surface-500">errors fixed</p>
        </div>
      </motion.div>

      {/* Growth Proof */}
      <motion.div variants={fadeInUp} className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
        <p className="text-xs font-semibold text-emerald-400 mb-1">Growth Proof</p>
        <p className="text-sm text-surface-300 leading-relaxed">{digest.growth_proof}</p>
      </motion.div>

      {/* Ugly Truth */}
      {digest.ugly_truth && (
        <motion.div variants={fadeInUp} className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
          <p className="text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1">
            <AlertCircle size={11} /> The Honest Truth
          </p>
          <p className="text-sm text-surface-300 leading-relaxed">{digest.ugly_truth}</p>
        </motion.div>
      )}

      {/* One Action */}
      <motion.div variants={fadeInUp} className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/25">
        <p className="text-xs font-semibold text-sky-400 mb-1">Your One Action This Week</p>
        <p className="text-sm text-surface-100 leading-relaxed font-medium">{digest.one_action}</p>
      </motion.div>

      {/* Predicted Score */}
      <motion.div variants={fadeInUp} className="p-4 rounded-xl bg-surface-900 border border-surface-800 text-center">
        <p className="text-xs text-surface-500 mb-1">On your current trajectory</p>
        <div className="flex items-baseline justify-center gap-2">
          <CountUp target={digest.predicted_score.current_trajectory} className="text-3xl font-bold text-surface-100" />
          <span className="text-sm text-surface-500">marks</span>
        </div>
        <p className="text-[10px] text-surface-600 mt-1">Range: {digest.predicted_score.range}</p>
      </motion.div>
    </motion.div>
  );
}
