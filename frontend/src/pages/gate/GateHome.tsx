/**
 * GateHome — Engaging topic grid with mastery rings, daily challenge, and animations.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  Clock, Zap, BookOpen, Target, CheckCircle2, SkipForward,
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

interface DailyTask {
  topic: string;
  topic_name: string;
  type: 'practice' | 'study' | 'revise';
  minutes: number;
  priority_score: number;
}

interface DailyPlan {
  id: string;
  tasks: DailyTask[];
  completed: Array<{ task_idx: number; rating: string; completed_at: string }>;
  plan_date: string;
}

interface StudyProfile {
  session_id: string;
  exam_date: string;
  target_score: number;
  weekly_hours: number;
  topic_confidence: Record<string, number>;
  diagnostic_taken_at: string | null;
}

const TASK_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  practice: { icon: Target, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', label: 'Practice' },
  study: { icon: BookOpen, color: 'text-sky-400', bgColor: 'bg-sky-500/10', label: 'Study' },
  revise: { icon: Repeat, color: 'text-amber-400', bgColor: 'bg-amber-500/10', label: 'Revise' },
};

export function GateHome() {
  const sessionId = useSession();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [masteryMap, setMasteryMap] = useState<Record<string, TopicMastery>>({});
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Study Commander state
  const [profile, setProfile] = useState<StudyProfile | null>(null);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    setAnalyticsSession(sessionId);
    trackEvent('page_view', { page: 'home' });

    Promise.all([
      apiFetch<{ topics: Topic[] }>('/api/topics'),
      apiFetch<{ stats: { due: number }; topics?: TopicMastery[] }>(`/api/sr/${sessionId}`).catch(() => ({
        stats: { due: 0 },
        topics: [] as TopicMastery[],
      })),
      apiFetch<{ topics: TopicMastery[] }>(`/api/progress/${sessionId}`).catch(() => ({
        topics: [] as TopicMastery[],
      })),
      // Check study profile
      apiFetch<{ profile: StudyProfile | null }>(`/api/onboard/${sessionId}`).catch(() => ({ profile: null })),
    ]).then(([topicRes, srRes, progressRes, profileRes]) => {
      setTopics(topicRes.topics);
      setDueCount(parseInt(String(srRes.stats.due)) || 0);

      // Build mastery map from progress data
      const map: Record<string, TopicMastery> = {};
      const progressTopics = progressRes.topics || [];
      for (const t of progressTopics) {
        map[t.topic] = t;
      }
      setMasteryMap(map);

      // Study Commander
      if (profileRes.profile) {
        setProfile(profileRes.profile);
        // Load today's plan
        apiFetch<{ plan: DailyPlan }>(`/api/today/${sessionId}`)
          .then(data => setDailyPlan(data.plan))
          .catch(() => {});
      }
      setProfileChecked(true);
    }).finally(() => setLoading(false));
  }, [sessionId]);

  const handleRateTask = async (taskIdx: number, rating: string) => {
    try {
      const data = await apiFetch<{ plan: DailyPlan }>(`/api/today/${sessionId}/${taskIdx}/rate`, {
        method: 'POST',
        body: JSON.stringify({ rating }),
      });
      setDailyPlan(data.plan);
    } catch {}
  };

  const isTaskCompleted = (idx: number): boolean => {
    return dailyPlan?.completed?.some(c => c.task_idx === idx) || false;
  };

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {/* Compact Hero Bar */}
      <motion.div variants={fadeInUp} className="flex items-center justify-between pt-1 pb-2">
        <div>
          <h1 className="text-lg font-bold text-surface-100">GATE Math</h1>
          <p className="text-surface-500 text-xs">Verified solutions &middot; AI tutor</p>
        </div>
        <div className="flex items-center gap-2">
          <StreakBadge sessionId={sessionId} />
          <GATECountdown />
        </div>
      </motion.div>

      {/* Exam Readiness Score */}
      <ExamReadinessBadge sessionId={sessionId} />

      {/* Study Commander: Today's Plan (onboarded users) */}
      {profileChecked && profile && dailyPlan && (
        <motion.div variants={fadeInUp} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-surface-300">Today's Plan</h2>
            <span className="text-xs text-surface-500 font-mono">
              {dailyPlan.completed?.length || 0}/{dailyPlan.tasks?.length || 0} done
            </span>
          </div>
          {dailyPlan.tasks?.map((task, idx) => {
            const done = isTaskCompleted(idx);
            const config = TASK_TYPE_CONFIG[task.type] || TASK_TYPE_CONFIG.practice;
            const TaskIcon = config.icon;
            return (
              <motion.div
                key={idx}
                variants={fadeInUp}
                className={clsx(
                  'flex items-center gap-3 p-3 rounded-xl border transition-all',
                  done
                    ? 'bg-emerald-500/5 border-emerald-500/20 opacity-70'
                    : 'bg-surface-900 border-surface-800'
                )}
              >
                <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', config.bgColor)}>
                  {done ? <CheckCircle2 size={18} className="text-emerald-400" /> : <TaskIcon size={18} className={config.color} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={clsx('text-sm font-medium truncate', done ? 'text-surface-500 line-through' : 'text-surface-200')}>
                    {config.label}: {task.topic_name}
                  </p>
                  <p className="text-xs text-surface-500">{task.minutes} min</p>
                </div>
                {!done && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleRateTask(idx, 'easy')}
                      className="px-2 py-1 rounded-lg text-[10px] font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      Done
                    </button>
                    <button
                      onClick={() => handleRateTask(idx, 'skip')}
                      className="p-1 rounded-lg text-surface-600 hover:text-surface-400 hover:bg-surface-800 transition-colors"
                    >
                      <SkipForward size={14} />
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Daily Challenge — only when 3+ reviews due (not noise for 1-2) */}
      {dueCount >= 3 && (
        <motion.div variants={fadeInUp}>
          <Link
            to="/progress"
            className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 hover:bg-amber-500/10 transition-all group"
          >
            <Zap size={16} className="text-amber-400 shrink-0" />
            <p className="text-sm font-medium text-amber-300 flex-1">
              {dueCount} reviews due
            </p>
            <ChevronRight size={14} className="text-amber-400/50 group-hover:translate-x-0.5 transition-transform" />
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

      {/* Onboarding nudge — subtle, after topic grid (non-onboarded users only) */}
      {profileChecked && !profile && (
        <motion.div variants={fadeInUp}>
          <button
            onClick={() => navigate('/onboard')}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-900 border border-surface-800 hover:border-emerald-500/30 transition-all group text-left"
          >
            <Target size={16} className="text-emerald-400 shrink-0" />
            <p className="text-sm text-surface-400 flex-1">
              <span className="text-surface-200 font-medium">Set your exam date</span> — get a daily study plan
            </p>
            <ChevronRight size={14} className="text-surface-600 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
