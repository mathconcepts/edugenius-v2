/**
 * GateHome — Engaging topic grid with mastery rings, daily challenge, and animations.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/hooks/useApi';
import { useSession } from '@/hooks/useSession';
import { setAnalyticsSession, trackEvent } from '@/lib/analytics';
import { fadeInUp, staggerContainer, cardHover } from '@/lib/animations';
import { MasteryRing } from '@/components/gate/MasteryRing';
import { StreakBadge } from '@/components/gate/StreakBadge';
import { GATECountdown } from '@/components/gate/GATECountdown';
import { ExamReadinessBadge } from '@/components/gate/ExamReadiness';
import {
  Grid3x3, Activity, GitBranch, Circle, BarChart,
  Hash, Repeat, Layers, Share2, Navigation, ChevronRight,
  Clock, Zap, Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';

interface Topic {
  id: string;
  name: string;
  icon: string;
  problemCount: number;
}

interface TopicMastery {
  topic: string;
  mastery: number;
  attempts: number;
}

const ICON_MAP: Record<string, React.ElementType> = {
  'grid': Grid3x3,
  'activity': Activity,
  'git-branch': GitBranch,
  'circle': Circle,
  'bar-chart': BarChart,
  'hash': Hash,
  'repeat': Repeat,
  'layers': Layers,
  'share-2': Share2,
  'navigation': Navigation,
};

export function GateHome() {
  const sessionId = useSession();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [masteryMap, setMasteryMap] = useState<Record<string, TopicMastery>>({});
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    setAnalyticsSession(sessionId);
    trackEvent('page_view', { page: 'home' });

    // Check first visit
    if (!localStorage.getItem('gate_hasVisited')) {
      setIsFirstVisit(true);
      localStorage.setItem('gate_hasVisited', '1');
    }

    Promise.all([
      apiFetch<{ topics: Topic[] }>('/api/topics'),
      apiFetch<{ stats: { due: number }; topics?: TopicMastery[] }>(`/api/sr/${sessionId}`).catch(() => ({
        stats: { due: 0 },
        topics: [] as TopicMastery[],
      })),
      apiFetch<{ topics: TopicMastery[] }>(`/api/progress/${sessionId}`).catch(() => ({
        topics: [] as TopicMastery[],
      })),
    ]).then(([topicRes, srRes, progressRes]) => {
      setTopics(topicRes.topics);
      setDueCount(parseInt(String(srRes.stats.due)) || 0);

      // Build mastery map from progress data
      const map: Record<string, TopicMastery> = {};
      const progressTopics = progressRes.topics || [];
      for (const t of progressTopics) {
        map[t.topic] = t;
      }
      setMasteryMap(map);
    }).finally(() => setLoading(false));
  }, [sessionId]);

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {/* Hero */}
      <motion.div variants={fadeInUp} className="text-center pt-2 pb-4">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent">
          GATE Engineering Math
        </h1>
        <p className="text-surface-400 text-sm mt-1">
          Previous year questions with verified solutions
        </p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <StreakBadge sessionId={sessionId} />
          <GATECountdown />
        </div>
      </motion.div>

      {/* Exam Readiness Score */}
      <ExamReadinessBadge sessionId={sessionId} />

      {/* Welcome Banner (first visit only) */}
      <AnimatePresence>
        {isFirstVisit && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="p-4 rounded-xl bg-gradient-to-r from-violet-500/10 to-sky-500/10 border border-violet-500/25"
          >
            <div className="flex items-center gap-3">
              <Sparkles size={20} className="text-violet-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-surface-200">Welcome to GATE Math!</p>
                <p className="text-xs text-surface-400 mt-0.5">Pick any topic below to start practicing with verified solutions.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Daily Challenge CTA */}
      {dueCount > 0 && (
        <motion.div variants={fadeInUp}>
          <Link
            to="/progress"
            className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/25 hover:from-amber-500/15 hover:to-orange-500/15 transition-all duration-300 group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Zap size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-300">
                {dueCount} review{dueCount !== 1 ? 's' : ''} due today
              </p>
              <p className="text-xs text-surface-400">Keep your streak alive — practice now!</p>
            </div>
            <ChevronRight size={16} className="text-amber-400 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      )}

      {/* Topic Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-surface-800/60 animate-pulse" />
          ))}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-2 gap-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {topics.map(topic => {
            const Icon = ICON_MAP[topic.icon] || Grid3x3;
            const mastery = masteryMap[topic.id];
            const masteryPct = mastery ? Math.round(mastery.mastery * 100) : 0;
            const hasAttempts = mastery && mastery.attempts > 0;

            return (
              <motion.div key={topic.id} variants={fadeInUp}>
                <Link
                  to={`/topic/${topic.id}`}
                  className={clsx(
                    'flex flex-col gap-2 p-4 rounded-xl border transition-all duration-200',
                    'bg-surface-900 border-surface-800 hover:border-sky-500/40 hover:bg-surface-800/80',
                    'active:scale-[0.98] group',
                  )}
                  onClick={() => trackEvent('topic_start', { topic: topic.id })}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center group-hover:bg-sky-500/20 transition-colors">
                      <Icon size={18} className="text-sky-400" />
                    </div>
                    {hasAttempts ? (
                      <MasteryRing value={masteryPct} size={32} strokeWidth={2.5}>
                        <span className="text-[9px] font-bold text-surface-300">{masteryPct}%</span>
                      </MasteryRing>
                    ) : (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400">
                        NEW
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-surface-200 leading-tight">{topic.name}</p>
                    <p className="text-xs text-surface-500 mt-0.5">{topic.problemCount} problems</p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Verify Any CTA */}
      <motion.div variants={fadeInUp}>
        <Link
          to="/verify"
          className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-sky-500/10 border border-emerald-500/25 hover:from-emerald-500/15 hover:to-sky-500/15 transition-all duration-300 group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <span className="text-white font-bold text-lg">?</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-surface-200">Verify Any Problem</p>
            <p className="text-xs text-surface-400">Check your answer to any math problem</p>
          </div>
          <ChevronRight size={16} className="text-surface-500 group-hover:translate-x-1 transition-transform" />
        </Link>
      </motion.div>
    </motion.div>
  );
}
