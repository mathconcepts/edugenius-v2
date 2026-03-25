/**
 * GateHome — Topic grid + daily problem + due reviews banner.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '@/hooks/useApi';
import { useSession } from '@/hooks/useSession';
import {
  Grid3x3, Activity, GitBranch, Circle, BarChart,
  Hash, Repeat, Layers, Share2, Navigation, ChevronRight,
  Clock,
} from 'lucide-react';
import { clsx } from 'clsx';

interface Topic {
  id: string;
  name: string;
  icon: string;
  problemCount: number;
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
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ topics: Topic[] }>('/api/topics'),
      apiFetch<{ stats: { due: number } }>(`/api/sr/${sessionId}`).catch(() => ({ stats: { due: 0 } })),
    ]).then(([topicRes, srRes]) => {
      setTopics(topicRes.topics);
      setDueCount(parseInt(String(srRes.stats.due)) || 0);
    }).finally(() => setLoading(false));
  }, [sessionId]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="text-center pt-2 pb-4">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent">
          GATE Engineering Math
        </h1>
        <p className="text-surface-400 text-sm mt-1">
          Previous year questions with verified solutions
        </p>
      </div>

      {/* Due Reviews Banner */}
      {dueCount > 0 && (
        <Link
          to="/progress"
          className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/15 transition-colors"
        >
          <Clock size={20} className="text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">
              {dueCount} review{dueCount !== 1 ? 's' : ''} due today
            </p>
            <p className="text-xs text-surface-400">Spaced repetition keeps knowledge fresh</p>
          </div>
          <ChevronRight size={16} className="text-amber-400" />
        </Link>
      )}

      {/* Topic Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-surface-800/60 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {topics.map(topic => {
            const Icon = ICON_MAP[topic.icon] || Grid3x3;
            return (
              <Link
                key={topic.id}
                to={`/topic/${topic.id}`}
                className={clsx(
                  'flex flex-col gap-2 p-4 rounded-xl border transition-all duration-200',
                  'bg-surface-900 border-surface-800 hover:border-sky-500/40 hover:bg-surface-800/80',
                  'active:scale-[0.98]',
                )}
              >
                <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center">
                  <Icon size={18} className="text-sky-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-surface-200 leading-tight">{topic.name}</p>
                  <p className="text-xs text-surface-500 mt-0.5">{topic.problemCount} problems</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Verify Any CTA */}
      <Link
        to="/verify"
        className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-sky-500/10 border border-emerald-500/25 hover:from-emerald-500/15 hover:to-sky-500/15 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-lg">?</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-surface-200">Verify Any Problem</p>
          <p className="text-xs text-surface-400">Check your answer to any math problem</p>
        </div>
        <ChevronRight size={16} className="text-surface-500" />
      </Link>
    </div>
  );
}
