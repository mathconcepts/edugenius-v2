/**
 * NotebookPage — Smart Notebook that auto-logs every query, structured by topic.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, MessageCircle, CheckCircle, Pen, ChevronDown, ChevronRight } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { apiFetch } from '@/hooks/useApi';
import { trackEvent } from '@/lib/analytics';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { clsx } from 'clsx';

interface NotebookEntry {
  id: string;
  source: 'chat' | 'practice' | 'verify' | 'manual';
  topic: string;
  query_text: string;
  answer_text: string | null;
  status: 'mastered' | 'in_progress' | 'to_review';
  confidence: number;
  created_at: string;
}

interface TopicSummary {
  topic: string;
  total: number;
  mastered: number;
  inProgress: number;
  toReview: number;
}

const SOURCE_ICONS = {
  chat: MessageCircle,
  practice: Pen,
  verify: CheckCircle,
  manual: BookOpen,
};

const STATUS_COLORS = {
  mastered: 'bg-emerald-500',
  in_progress: 'bg-amber-500',
  to_review: 'bg-surface-500',
};

const STATUS_LABELS = {
  mastered: 'Mastered',
  in_progress: 'In Progress',
  to_review: 'To Review',
};

function formatTopicName(id: string): string {
  return id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export default function NotebookPage() {
  const sessionId = useSession();
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [summary, setSummary] = useState<TopicSummary[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesRes, summaryRes] = await Promise.all([
        apiFetch<{ entries: NotebookEntry[]; total: number }>(
          `/api/notebook/${sessionId}${selectedTopic !== 'all' ? `?topic=${selectedTopic}` : ''}`
        ),
        apiFetch<{ topics: TopicSummary[]; totalEntries: number }>(`/api/notebook/${sessionId}/summary`),
      ]);
      setEntries(entriesRes.entries);
      setSummary(summaryRes.topics);
      setTotalEntries(summaryRes.totalEntries);
    } catch {
      // Silently handle — empty state shown
    } finally {
      setLoading(false);
    }
  }, [sessionId, selectedTopic]);

  useEffect(() => {
    trackEvent('page_view', { page: 'notebook' });
    fetchData();
  }, [fetchData]);

  const updateStatus = async (entryId: string, status: string) => {
    try {
      await apiFetch(`/api/notebook/${sessionId}/${entryId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, status: status as any } : e));
      trackEvent('notebook_status_update', { status });
    } catch {}
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-surface-800 rounded-lg w-48" />
        <div className="h-12 bg-surface-800 rounded-xl" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-surface-800 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-5">
      {/* Header */}
      <motion.div variants={fadeInUp}>
        <h1 className="text-xl font-bold text-white">Smart Notebook</h1>
        <p className="text-sm text-surface-400 mt-1">
          {totalEntries} entries across {summary.length} topics
        </p>
      </motion.div>

      {/* Topic filter pills */}
      <motion.div variants={fadeInUp} className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
        <button
          onClick={() => setSelectedTopic('all')}
          className={clsx(
            'px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all',
            selectedTopic === 'all'
              ? 'bg-emerald-500 text-white'
              : 'bg-surface-800 text-surface-400 hover:bg-surface-700',
          )}
        >
          All ({totalEntries})
        </button>
        {summary.map(t => (
          <button
            key={t.topic}
            onClick={() => setSelectedTopic(t.topic)}
            className={clsx(
              'px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all',
              selectedTopic === t.topic
                ? 'bg-emerald-500 text-white'
                : 'bg-surface-800 text-surface-400 hover:bg-surface-700',
            )}
          >
            {formatTopicName(t.topic)} ({t.total})
          </button>
        ))}
      </motion.div>

      {/* Topic completion summary (when "All" selected) */}
      {selectedTopic === 'all' && summary.length > 0 && (
        <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-2">
          {summary.map(t => {
            const pct = t.total > 0 ? Math.round((t.mastered / t.total) * 100) : 0;
            return (
              <button
                key={t.topic}
                onClick={() => setSelectedTopic(t.topic)}
                className="bg-surface-900 border border-surface-800 rounded-xl p-3 text-left hover:border-surface-700 transition-all"
              >
                <p className="text-xs font-medium text-surface-300 truncate">{formatTopicName(t.topic)}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 bg-surface-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold text-surface-400">{pct}%</span>
                </div>
                <p className="text-[10px] text-surface-500 mt-1">{t.mastered}/{t.total} mastered</p>
              </button>
            );
          })}
        </motion.div>
      )}

      {/* Entries list */}
      {entries.length === 0 ? (
        <motion.div variants={fadeInUp} className="text-center py-16">
          <BookOpen size={48} className="mx-auto text-surface-700 mb-4" />
          <h3 className="text-lg font-semibold text-surface-400 mb-2">Your notebook is empty</h3>
          <p className="text-sm text-surface-500 max-w-xs mx-auto">
            Start chatting with the AI tutor or practicing problems. Your learning trail will appear here automatically.
          </p>
        </motion.div>
      ) : (
        <motion.div variants={fadeInUp} className="space-y-2">
          {entries.map(entry => {
            const SourceIcon = SOURCE_ICONS[entry.source] || BookOpen;
            const isExpanded = expandedId === entry.id;
            return (
              <motion.div
                key={entry.id}
                layout
                className="bg-surface-900 border border-surface-800 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full flex items-start gap-3 p-3 text-left hover:bg-surface-800/50 transition-colors"
                >
                  <div className={clsx('w-2 h-2 rounded-full mt-2 flex-shrink-0', STATUS_COLORS[entry.status])} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white line-clamp-2">{entry.query_text}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-mono text-sky-400">{formatTopicName(entry.topic)}</span>
                      <SourceIcon size={10} className="text-surface-500" />
                      <span className="text-[10px] text-surface-500">{timeAgo(entry.created_at)}</span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown size={14} className="text-surface-500 mt-1" /> : <ChevronRight size={14} className="text-surface-500 mt-1" />}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-surface-800"
                    >
                      {entry.answer_text && (
                        <div className="px-3 py-3 text-xs text-surface-300 leading-relaxed whitespace-pre-wrap">
                          {entry.answer_text}
                        </div>
                      )}
                      <div className="flex gap-2 px-3 pb-3">
                        {(['mastered', 'in_progress', 'to_review'] as const).map(s => (
                          <button
                            key={s}
                            onClick={(e) => { e.stopPropagation(); updateStatus(entry.id, s); }}
                            className={clsx(
                              'px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all',
                              entry.status === s
                                ? s === 'mastered' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : s === 'in_progress' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-surface-700 text-surface-300 border border-surface-600'
                                : 'bg-surface-800 text-surface-500 hover:bg-surface-700',
                            )}
                          >
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Legend */}
      {entries.length > 0 && (
        <motion.div variants={fadeInUp} className="flex items-center gap-4 justify-center pt-2">
          {Object.entries(STATUS_COLORS).map(([key, color]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${color}`} />
              <span className="text-[10px] text-surface-500">{STATUS_LABELS[key as keyof typeof STATUS_LABELS]}</span>
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
