/**
 * ProgressPage — Progress overview + weak-topic heat map + due reviews.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '@/hooks/useApi';
import { useSession } from '@/hooks/useSession';
import { BarChart3, TrendingDown, Clock, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

interface TopicStat {
  topic: string;
  totalProblems: number;
  correct: number;
  attempts: number;
  mastery: number;
  easiness: number;
  due: number;
}

interface WeakTopic {
  topic: string;
  mastery: number;
  easiness: number;
  due: number;
}

interface ProgressData {
  topics: TopicStat[];
  overall: {
    problems_attempted: string;
    total_correct: string;
    total_attempts: string;
    due_today: string;
  };
  weakTopics: WeakTopic[];
}

export default function ProgressPage() {
  const sessionId = useSession();
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<ProgressData>(`/api/progress/${sessionId}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-16 rounded-xl bg-surface-800/60 animate-pulse" />
      ))}
    </div>;
  }

  if (!data || data.topics.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <BarChart3 size={48} className="text-surface-700 mx-auto" />
        <h2 className="text-xl font-bold text-surface-300">No progress yet</h2>
        <p className="text-sm text-surface-500">Start practicing to see your progress here.</p>
        <Link
          to="/"
          className="inline-block mt-2 px-6 py-2.5 rounded-xl bg-sky-500/10 text-sky-300 border border-sky-500/25 text-sm font-medium hover:bg-sky-500/15 transition-colors"
        >
          Start Practicing
        </Link>
      </div>
    );
  }

  const overall = data.overall;
  const totalAttempts = parseInt(overall.total_attempts) || 0;
  const totalCorrect = parseInt(overall.total_correct) || 0;
  const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-surface-100">Your Progress</h1>

      {/* Overall Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Problems', value: overall.problems_attempted || '0' },
          { label: 'Accuracy', value: `${accuracy}%` },
          { label: 'Due Today', value: overall.due_today || '0' },
        ].map(stat => (
          <div key={stat.label} className="p-3 rounded-xl bg-surface-900 border border-surface-800 text-center">
            <p className="text-lg font-bold text-surface-200">{stat.value}</p>
            <p className="text-xs text-surface-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Weak Topics Alert */}
      {data.weakTopics.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
            <TrendingDown size={16} />
            <span>Weak Topics</span>
          </div>
          {data.weakTopics.map(wt => {
            const topicName = wt.topic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            return (
              <Link
                key={wt.topic}
                to={`/topic/${wt.topic}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10 transition-colors"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-surface-200">{topicName}</p>
                  <p className="text-xs text-surface-500">{Math.round(wt.mastery * 100)}% accuracy</p>
                </div>
                {wt.due > 0 && (
                  <span className="flex items-center gap-1 text-xs text-amber-400">
                    <Clock size={12} /> {wt.due} due
                  </span>
                )}
                <ChevronRight size={14} className="text-surface-600" />
              </Link>
            );
          })}
        </div>
      )}

      {/* Topic Heat Map */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-surface-300">All Topics</h2>
        {data.topics.map(topic => {
          const topicName = topic.topic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const masteryPct = Math.round(topic.mastery * 100);

          // Heat map color: red (0%) → amber (50%) → emerald (100%)
          let barColor = 'bg-red-500';
          if (masteryPct >= 70) barColor = 'bg-emerald-500';
          else if (masteryPct >= 40) barColor = 'bg-amber-500';

          return (
            <Link
              key={topic.topic}
              to={`/topic/${topic.topic}`}
              className="block p-3 rounded-xl bg-surface-900 border border-surface-800 hover:border-surface-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-surface-200">{topicName}</span>
                <span className="text-xs text-surface-400">
                  {topic.correct}/{topic.attempts} correct
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
                <div
                  className={clsx('h-full rounded-full transition-all duration-500', barColor)}
                  style={{ width: `${masteryPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-surface-600">{masteryPct}% mastery</span>
                {topic.due > 0 && (
                  <span className="text-[10px] text-amber-500">{topic.due} due</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
