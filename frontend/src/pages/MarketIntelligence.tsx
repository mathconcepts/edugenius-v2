/**
 * MarketIntelligence.tsx — Scout's Market Intelligence Dashboard
 * CEO-only page at /market-intel
 * Shows Google Trends pulse, Reddit content gaps, and Atlas priority queue
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertTriangle,
  Zap,
  Search,
  MessageSquare,
  BarChart3,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  Target,
  FileText,
  CheckCircle,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  runWeeklyIntelligenceScan,
  getLastReport,
  isReportStale,
  type ScoutWeeklyReport,
  type PriorityContentItem,
} from '@/services/scoutIntelligenceService';
import {
  simulateTrendData,
  type TrendResult,
  EDUGENIUS_TRACKED_KEYWORDS,
} from '@/services/googleTrendsService';
import {
  simulateRedditData,
  type ContentGap,
  type RedditPost,
  getHotPosts,
  TARGET_SUBREDDITS,
} from '@/services/redditIntelService';
import {
  createAtlasTask,
  queueTask,
  getQueue,
  clearCompletedTasks,
  type AtlasContentTask,
} from '@/services/atlasTaskService';

// ── Types ─────────────────────────────────────────────────────────────────────

type LoadState = 'idle' | 'loading' | 'success' | 'error';

// ── Style helpers ─────────────────────────────────────────────────────────────

const velocityConfig = {
  rising:   { icon: TrendingUp,   label: '↑ Rising',   class: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  stable:   { icon: Minus,        label: '→ Stable',   class: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  declining:{ icon: TrendingDown, label: '↓ Declining', class: 'text-red-400 bg-red-500/10 border-red-500/30' },
};

const urgencyConfig = {
  high:   { label: 'High Urgency',   class: 'text-red-400 bg-red-500/10 border-red-500/30' },
  medium: { label: 'Medium',         class: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  low:    { label: 'Low Priority',   class: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
};

const examBadgeColor: Record<string, string> = {
  GATE:    'text-blue-400 bg-blue-500/10 border-blue-500/30',
  CAT:     'text-purple-400 bg-purple-500/10 border-purple-500/30',
  JEE:     'text-orange-400 bg-orange-500/10 border-orange-500/30',
  NEET:    'text-pink-400 bg-pink-500/10 border-pink-500/30',
  General: 'text-surface-400 bg-surface-500/10 border-surface-500/30',
  UPSC:    'text-amber-400 bg-amber-500/10 border-amber-500/30',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle, color = 'text-primary-400' }: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={clsx('p-2 rounded-xl bg-surface-800/60 border border-surface-700/50', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score > 70 ? 'bg-emerald-500' : score > 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-surface-400 w-6 text-right">{score}</span>
    </div>
  );
}

// ── Trend Card ────────────────────────────────────────────────────────────────

function TrendCard({ result, index }: { result: TrendResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const vc = velocityConfig[result.velocity];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-surface-900 border border-surface-800 rounded-2xl p-4 hover:border-surface-700 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm leading-snug truncate">{result.keyword}</p>
          <div className="mt-2">
            <ScoreBar score={result.score} />
          </div>
        </div>
        <span className={clsx('text-xs px-2 py-1 rounded-full border whitespace-nowrap flex-shrink-0 font-medium', vc.class)}>
          {vc.label}
        </span>
      </div>

      {result.relatedQueries.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-primary-400 flex items-center gap-1 hover:text-primary-300 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Hide' : 'Related queries'}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 flex flex-wrap gap-1"
              >
                {result.relatedQueries.map(q => (
                  <span key={q} className="text-xs bg-surface-800 text-surface-400 px-2 py-0.5 rounded-full border border-surface-700">
                    {q}
                  </span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

// ── Trend Pulse Section ───────────────────────────────────────────────────────

function TrendPulseSection({ trends, loading }: { trends: TrendResult[]; loading: boolean }) {
  const examGroups = Object.keys(EDUGENIUS_TRACKED_KEYWORDS);
  const [activeExam, setActiveExam] = useState<string>('All');

  const filtered = activeExam === 'All'
    ? trends
    : trends.filter(t =>
        (EDUGENIUS_TRACKED_KEYWORDS[activeExam] ?? []).includes(t.keyword),
      );

  return (
    <div className="bg-surface-900/50 border border-surface-800 rounded-3xl p-6">
      <SectionHeader
        icon={TrendingUp}
        title="Trend Pulse"
        subtitle="Live Google Trends data for tracked exam keywords · India"
        color="text-emerald-400"
      />

      {/* Exam filter tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {['All', ...examGroups].map(exam => (
          <button
            key={exam}
            onClick={() => setActiveExam(exam)}
            className={clsx(
              'text-xs px-3 py-1.5 rounded-full border transition-all',
              activeExam === exam
                ? 'bg-primary-600/30 text-primary-300 border-primary-500/40'
                : 'bg-surface-800 text-surface-400 border-surface-700 hover:border-surface-600',
            )}
          >
            {exam}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-surface-800 rounded-2xl h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((result, i) => (
            <TrendCard key={result.keyword} result={result} index={i} />
          ))}
        </div>
      )}

      {/* Rising count summary */}
      {!loading && (
        <div className="mt-4 flex gap-4 text-xs text-surface-500">
          <span className="text-emerald-400">{trends.filter(t => t.velocity === 'rising').length} ↑ Rising</span>
          <span className="text-yellow-400">{trends.filter(t => t.velocity === 'stable').length} → Stable</span>
          <span className="text-red-400">{trends.filter(t => t.velocity === 'declining').length} ↓ Declining</span>
        </div>
      )}
    </div>
  );
}

// ── Content Gap Radar ─────────────────────────────────────────────────────────

function GapRadarSection({
  gaps,
  loading,
  queuedGaps,
  onQueue,
}: {
  gaps: ContentGap[];
  loading: boolean;
  queuedGaps: Set<string>;
  onQueue: (gap: ContentGap) => void;
}) {
  return (
    <div className="bg-surface-900/50 border border-surface-800 rounded-3xl p-6">
      <SectionHeader
        icon={AlertTriangle}
        title="Content Gap Radar"
        subtitle="Reddit intelligence — unanswered questions and student struggles"
        color="text-yellow-400"
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-surface-800 rounded-2xl h-20 animate-pulse" />)}
        </div>
      ) : gaps.length === 0 ? (
        <p className="text-surface-500 text-sm text-center py-8">No content gaps detected this scan.</p>
      ) : (
        <div className="space-y-3">
          {gaps.slice(0, 10).map((gap, i) => {
            const uc = urgencyConfig[gap.urgency];
            const isQueued = queuedGaps.has(gap.topic);
            return (
              <motion.div
                key={gap.topic}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-surface-900 border border-surface-800 rounded-2xl p-4 flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full border font-medium', uc.class)}>
                      {uc.label}
                    </span>
                    <span className="text-xs text-surface-500">
                      {gap.questionCount} questions · avg score {gap.avgScore}
                    </span>
                  </div>
                  <h3 className="text-white font-medium text-sm">{gap.topic}</h3>
                  {gap.sampleQuestions.length > 0 && (
                    <p className="text-xs text-surface-500 mt-1 italic">
                      "{gap.sampleQuestions[0]}"
                    </p>
                  )}
                </div>
                {isQueued ? (
                  <span className="flex-shrink-0 text-xs bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-xl flex items-center gap-1 font-medium">
                    <CheckCircle className="w-3 h-3" />
                    ✓ Queued
                  </span>
                ) : (
                  <button
                    onClick={() => onQueue(gap)}
                    className="flex-shrink-0 text-xs bg-primary-600/20 hover:bg-primary-600/40 border border-primary-500/30 text-primary-300 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1"
                  >
                    <Zap className="w-3 h-3" />
                    Create Content
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Priority Content Queue ────────────────────────────────────────────────────

function PriorityQueueSection({
  items,
  loading,
  queuedItems,
  onQueue,
}: {
  items: PriorityContentItem[];
  loading: boolean;
  queuedItems: Set<string>;
  onQueue: (item: PriorityContentItem) => void;
}) {
  return (
    <div className="bg-surface-900/50 border border-surface-800 rounded-3xl p-6">
      <SectionHeader
        icon={Target}
        title="Priority Content Queue"
        subtitle="Top 10 items Scout recommends Atlas builds next"
        color="text-primary-400"
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="bg-surface-800 rounded-2xl h-24 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 10).map((item, i) => {
            const isQueued = queuedItems.has(item.topic);
            return (
              <motion.div
                key={item.topic}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-surface-900 border border-surface-800 rounded-2xl p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary-600/20 border border-primary-500/30 flex items-center justify-center text-xs font-bold text-primary-300">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full border', examBadgeColor[item.examFocus] ?? examBadgeColor.General)}>
                        {item.examFocus}
                      </span>
                      <span className="text-xs bg-surface-800 text-surface-400 px-2 py-0.5 rounded-full border border-surface-700">
                        {item.suggestedAtomType.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-surface-500 ml-auto">
                        Score: <span className="text-white font-medium">{item.priority}</span>
                      </span>
                    </div>
                    <h3 className="text-white font-medium text-sm leading-snug">{item.topic}</h3>
                    <p className="text-xs text-surface-500 mt-1 leading-relaxed">{item.reasoning}</p>
                  </div>
                  <div className="flex-shrink-0 mt-0.5">
                    {isQueued ? (
                      <span className="text-xs bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-xl flex items-center gap-1 font-medium">
                        <CheckCircle className="w-3 h-3" />
                        ✓ Queued
                      </span>
                    ) : (
                      <button
                        onClick={() => onQueue(item)}
                        className="text-xs bg-primary-600/20 hover:bg-primary-600/40 border border-primary-500/30 text-primary-300 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1"
                      >
                        <Zap className="w-3 h-3" />
                        Create Content
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Atlas Task Queue Panel ────────────────────────────────────────────────────

const statusConfig = {
  queued:      { emoji: '🟡', label: 'Queued',      class: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  in_progress: { emoji: '🔵', label: 'In Progress', class: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  done:        { emoji: '✅', label: 'Done',         class: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  failed:      { emoji: '❌', label: 'Failed',       class: 'text-red-400 bg-red-500/10 border-red-500/30' },
};

function AtlasQueuePanel({ taskQueue, onRefresh }: { taskQueue: AtlasContentTask[]; onRefresh: () => void }) {
  const handleClearCompleted = () => {
    clearCompletedTasks();
    onRefresh();
  };

  const hasTasks = taskQueue.length > 0;
  const hasCompleted = taskQueue.some(t => t.status === 'done' || t.status === 'failed');

  return (
    <div className="bg-surface-900/50 border border-surface-800 rounded-3xl p-6">
      <div className="flex items-center justify-between mb-5">
        <SectionHeader
          icon={Sparkles}
          title="Atlas Task Queue"
          subtitle="Content generation jobs queued for Atlas — auto-refreshes every 30s"
          color="text-violet-400"
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasCompleted && (
            <button
              onClick={handleClearCompleted}
              className="text-xs flex items-center gap-1 text-surface-400 hover:text-red-400 border border-surface-700 hover:border-red-500/40 px-3 py-1.5 rounded-xl transition-all"
            >
              <Trash2 className="w-3 h-3" />
              Clear Completed
            </button>
          )}
          <button
            onClick={onRefresh}
            className="text-xs flex items-center gap-1 text-surface-400 hover:text-white border border-surface-700 hover:border-surface-600 px-3 py-1.5 rounded-xl transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
      </div>

      {!hasTasks ? (
        <div className="text-center py-10">
          <p className="text-surface-500 text-sm">Queue empty — run a scan and create content tasks</p>
          <p className="text-surface-600 text-xs mt-1">Click "Create Content" on any gap or priority item above</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-surface-500 border-b border-surface-800">
                <th className="text-left pb-3 pr-4 font-medium">Topic</th>
                <th className="text-left pb-3 pr-4 font-medium">Exam</th>
                <th className="text-left pb-3 pr-4 font-medium">Atom Type</th>
                <th className="text-left pb-3 pr-4 font-medium">Status</th>
                <th className="text-right pb-3 font-medium">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {taskQueue.map(task => {
                const sc = statusConfig[task.status];
                return (
                  <motion.tr
                    key={task.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group"
                  >
                    <td className="py-3 pr-4">
                      <p className="text-white font-medium text-xs leading-snug max-w-[200px] truncate" title={task.topic}>
                        {task.topic}
                      </p>
                      <p className="text-surface-600 text-[10px] mt-0.5 truncate max-w-[200px]" title={task.reasoning}>
                        {task.reasoning}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full border', examBadgeColor[task.examFocus] ?? examBadgeColor.General)}>
                        {task.examFocus}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-xs bg-surface-800 text-surface-400 px-2 py-0.5 rounded-full border border-surface-700">
                        {task.atomType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full border font-medium', sc.class)}>
                        {sc.emoji} {sc.label}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <span className="text-xs font-bold text-white">{task.priority}</span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Reddit Live Feed ──────────────────────────────────────────────────────────

function RedditFeedSection() {
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubreddit, setActiveSubreddit] = useState(TARGET_SUBREDDITS[0]);

  const loadPosts = useCallback(async (subreddit: string) => {
    setLoading(true);
    const fetched = await getHotPosts(subreddit, 10);
    if (fetched.length > 0) {
      setPosts(fetched);
    } else {
      // Fallback to simulated
      const simData = simulateRedditData();
      const simPosts: RedditPost[] = simData.contentGaps.flatMap(gap =>
        gap.sampleQuestions.map((q, i) => ({
          title: q,
          score: Math.floor(Math.random() * 50) + 2,
          numComments: Math.floor(Math.random() * 20) + 1,
          url: `https://reddit.com/r/${subreddit}`,
          created: Date.now() / 1000 - i * 3600,
          subreddit,
        })),
      ).slice(0, 10);
      setPosts(simPosts);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPosts(activeSubreddit);
  }, [activeSubreddit, loadPosts]);

  const timeAgo = (created: number) => {
    const hours = Math.round((Date.now() / 1000 - created) / 3600);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  };

  return (
    <div className="bg-surface-900/50 border border-surface-800 rounded-3xl p-6">
      <SectionHeader
        icon={MessageSquare}
        title="Raw Reddit Feed"
        subtitle="Hot posts from exam subreddits — live"
        color="text-orange-400"
      />

      {/* Subreddit tabs */}
      <div className="flex gap-2 flex-wrap mb-5 overflow-x-auto pb-1">
        {TARGET_SUBREDDITS.map(sub => (
          <button
            key={sub}
            onClick={() => setActiveSubreddit(sub)}
            className={clsx(
              'text-xs px-3 py-1.5 rounded-full border transition-all whitespace-nowrap',
              activeSubreddit === sub
                ? 'bg-orange-600/30 text-orange-300 border-orange-500/40'
                : 'bg-surface-800 text-surface-400 border-surface-700 hover:border-surface-600',
            )}
          >
            r/{sub}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="bg-surface-800 rounded-xl h-14 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post, i) => (
            <motion.div
              key={`${post.url}-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-start gap-3 p-3 bg-surface-900 rounded-xl border border-surface-800 hover:border-surface-700 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white leading-snug line-clamp-2">{post.title}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
                  <span>↑ {post.score}</span>
                  <span>💬 {post.numComments}</span>
                  <span>{timeAgo(post.created)}</span>
                </div>
              </div>
              {post.url && post.url.startsWith('http') && (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-surface-600 hover:text-primary-400 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Competitor Signals ────────────────────────────────────────────────────────

function CompetitorSignalsSection({ signals, loading }: { signals: string[]; loading: boolean }) {
  return (
    <div className="bg-surface-900/50 border border-surface-800 rounded-3xl p-6">
      <SectionHeader
        icon={Search}
        title="Competitor Signals"
        subtitle="Tracked moves from Unacademy, PW, BYJU's & others"
        color="text-red-400"
      />
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-surface-800 rounded-xl h-10 animate-pulse" />)}
        </div>
      ) : (
        <ul className="space-y-2">
          {signals.map((signal, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-start gap-2 text-sm text-surface-300 p-3 bg-surface-900 rounded-xl border border-surface-800"
            >
              <span className="text-red-400 mt-0.5 flex-shrink-0">⚡</span>
              {signal}
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Scan Status Bar ───────────────────────────────────────────────────────────

function ScanStatusBar({
  report,
  scanning,
  onScan,
  usingSimulated,
}: {
  report: ScoutWeeklyReport | null;
  scanning: boolean;
  onScan: () => void;
  usingSimulated: boolean;
}) {
  const stale = isReportStale();

  return (
    <div className={clsx(
      'flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border',
      stale
        ? 'bg-yellow-500/5 border-yellow-500/20'
        : 'bg-surface-900/50 border-surface-800',
    )}>
      <div className="flex items-center gap-3">
        <Clock className={clsx('w-4 h-4', stale ? 'text-yellow-400' : 'text-surface-400')} />
        <div>
          <p className="text-sm font-medium text-white">
            {report ? 'Last scan' : 'No scan yet'}
            {usingSimulated && (
              <span className="ml-2 text-xs bg-surface-800 text-surface-400 px-2 py-0.5 rounded-full border border-surface-700">
                Simulated data
              </span>
            )}
          </p>
          <p className="text-xs text-surface-500">
            {report
              ? new Date(report.generatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
              : 'Run a scan to get market intelligence'}
          </p>
        </div>
        {stale && report && (
          <span className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">
            ⚠ Stale — &gt;7 days old
          </span>
        )}
      </div>
      <button
        onClick={onScan}
        disabled={scanning}
        className="btn-primary flex items-center gap-2 text-sm"
      >
        <RefreshCw className={clsx('w-4 h-4', scanning && 'animate-spin')} />
        {scanning ? 'Scanning...' : 'Run Scan Now'}
      </button>
    </div>
  );
}

// ── Summary Stats ─────────────────────────────────────────────────────────────

function SummaryStats({ report }: { report: ScoutWeeklyReport | null }) {
  if (!report) return null;

  const risingCount = report.trendAlerts.length;
  const highGaps = report.contentGaps.filter(g => g.urgency === 'high').length;
  const queueSize = report.priorityContentQueue.length;
  const topPriority = report.priorityContentQueue[0]?.priority ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[
        { label: 'Rising Trends', value: risingCount, icon: TrendingUp, color: 'text-emerald-400' },
        { label: 'High-Priority Gaps', value: highGaps, icon: AlertTriangle, color: 'text-red-400' },
        { label: 'Content Queue', value: queueSize, icon: FileText, color: 'text-primary-400' },
        { label: 'Top Priority Score', value: topPriority, icon: BarChart3, color: 'text-yellow-400' },
      ].map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="bg-surface-900/50 border border-surface-800 rounded-2xl p-4"
        >
          <div className={clsx('flex items-center gap-2 mb-2', stat.color)}>
            <stat.icon className="w-4 h-4" />
            <span className="text-xs font-medium">{stat.label}</span>
          </div>
          <p className="text-2xl font-bold text-white">{stat.value}</p>
        </motion.div>
      ))}
    </div>
  );
}

// ── Toast notification ────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface-800 border border-emerald-500/40 text-emerald-300 text-sm px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2"
    >
      <CheckCircle className="w-4 h-4 flex-shrink-0" />
      {message}
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MarketIntelligence() {
  const [report, setReport] = useState<ScoutWeeklyReport | null>(null);
  const [trends, setTrends] = useState<TrendResult[]>([]);
  const [gaps, setGaps] = useState<ContentGap[]>([]);
  const [queue, setQueue] = useState<PriorityContentItem[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [usingSimulated, setUsingSimulated] = useState(false);

  // Atlas queue state
  const [queuedGaps, setQueuedGaps] = useState<Set<string>>(new Set());
  const [queuedItems, setQueuedItems] = useState<Set<string>>(new Set());
  const [atlasTaskQueue, setAtlasTaskQueue] = useState<AtlasContentTask[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshAtlasQueue = useCallback(() => {
    setAtlasTaskQueue(getQueue().tasks);
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    refreshAtlasQueue();
    autoRefreshRef.current = setInterval(refreshAtlasQueue, 30_000);
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [refreshAtlasQueue]);

  const handleQueueGap = useCallback((gap: ContentGap) => {
    const task = createAtlasTask(gap, 'gap_radar');
    queueTask(task);
    setQueuedGaps(prev => new Set(prev).add(gap.topic));
    setAtlasTaskQueue(getQueue().tasks);
    setToast(`✅ Queued for Atlas — ${gap.topic}`);
  }, []);

  const handleQueueItem = useCallback((item: PriorityContentItem) => {
    const task = createAtlasTask(item, 'priority_queue');
    queueTask(task);
    setQueuedItems(prev => new Set(prev).add(item.topic));
    setAtlasTaskQueue(getQueue().tasks);
    setToast(`✅ Queued for Atlas — ${item.topic}`);
  }, []);

  const applyReport = (r: ScoutWeeklyReport, simulated: boolean) => {
    setReport(r);
    setTrends(r.trendAlerts.length > 0
      ? [...r.trendAlerts, ...simulateTrendData().filter(t => !r.trendAlerts.find(a => a.keyword === t.keyword))]
      : simulateTrendData(),
    );
    setGaps(r.contentGaps);
    setQueue(r.priorityContentQueue);
    setCompetitors(r.competitorSignals);
    setUsingSimulated(simulated);
    setLoadState('success');
  };

  // Load from cache on mount
  useEffect(() => {
    const cached = getLastReport();
    if (cached) {
      applyReport(cached, false);
    } else {
      // Use simulated data as initial state
      const simTrends = simulateTrendData();
      const simReddit = simulateRedditData();
      setTrends(simTrends);
      setGaps(simReddit.contentGaps);
      setCompetitors([
        'Unacademy launched GATE 2026 "Pro" subscription — ₹12,000/year',
        'PhysicsWallah adding AI doubt solver — beta live for JEE students',
        'BYJU\'s focusing on NEET after JEE pullback — opportunity for our JEE content',
        'Allen launched free mock test series for GATE 2026 — monitor sign-ups',
        'Testbook gaining ground on CAT preparation segment — differentiate with AI',
      ]);
      setUsingSimulated(true);
      setLoadState('success');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      const result = await runWeeklyIntelligenceScan();
      applyReport(result, false);
    } catch (err) {
      console.error('[MarketIntelligence] Scan failed:', err);
      // Fallback to simulated
      const simTrends = simulateTrendData();
      const simReddit = simulateRedditData();
      const fakeReport: ScoutWeeklyReport = {
        generatedAt: new Date().toISOString(),
        trendAlerts: simTrends.filter(t => t.velocity === 'rising'),
        contentGaps: simReddit.contentGaps,
        priorityContentQueue: simReddit.contentGaps.slice(0, 10).map((g, i) => ({
          topic: g.topic,
          examFocus: 'GATE',
          priority: 90 - i * 5,
          reasoning: `High urgency gap with ${g.questionCount} unanswered questions`,
          suggestedAtomType: 'explainer_article',
        })),
        competitorSignals: competitors,
      };
      applyReport(fakeReport, true);
    } finally {
      setScanning(false);
    }
  }, [competitors]);

  const isLoading = loadState === 'loading';

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Toast notifications */}
      <AnimatePresence>
        {toast && (
          <Toast message={toast} onDismiss={() => setToast(null)} />
        )}
      </AnimatePresence>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
            🔍 Market Intelligence
          </h1>
          <p className="text-surface-400 text-sm mt-1">
            Scout's real-time signal pipeline — Google Trends + Reddit exam communities
          </p>
        </div>
      </div>

      {/* Scan Status Bar */}
      <ScanStatusBar
        report={report}
        scanning={scanning}
        onScan={handleScan}
        usingSimulated={usingSimulated}
      />

      {/* Summary Stats */}
      {report && <SummaryStats report={report} />}

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <TrendPulseSection trends={trends} loading={isLoading || scanning} />
          <CompetitorSignalsSection signals={competitors} loading={isLoading || scanning} />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <GapRadarSection
            gaps={gaps}
            loading={isLoading || scanning}
            queuedGaps={queuedGaps}
            onQueue={handleQueueGap}
          />
          <PriorityQueueSection
            items={queue}
            loading={isLoading || scanning}
            queuedItems={queuedItems}
            onQueue={handleQueueItem}
          />
        </div>
      </div>

      {/* Atlas Task Queue — full width */}
      <AtlasQueuePanel taskQueue={atlasTaskQueue} onRefresh={refreshAtlasQueue} />

      {/* Reddit Feed — full width */}
      <RedditFeedSection />
    </div>
  );
}
