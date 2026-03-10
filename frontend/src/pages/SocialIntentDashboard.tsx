/**
 * SocialIntentDashboard.tsx — Social Media Intent Scout + Answer Engine
 * CEO/Admin page at /social-intent
 *
 * 5 tabs:
 *   1. 🎯 Intent Feed — live signal stream
 *   2. ✍️ Answer Queue — pending answers for review
 *   3. 📅 Post Schedule — upcoming posts timeline
 *   4. 📊 Analytics — performance tracking
 *   5. ⚙️ Settings — platform config + auto-approve
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Radio, RefreshCw, Zap, CheckCircle2, XCircle, Edit3,
  ChevronDown, ChevronUp, BarChart3, Calendar, Settings, Loader2,
  TrendingUp, Copy, ToggleLeft, ToggleRight,
} from 'lucide-react';

import {
  simulateSocialScan,
  getSavedSignals,
  getTrendingQuestions,
  markProcessed,
  getLastScanInfo,
  clearSignals,
  type SocialSignal,
  type SocialPlatform,
  type IntentType,
  type ExamCode,
  PLATFORM_LABELS,
  PLATFORM_EMOJIS,
  EXAM_LABELS,
  INTENT_LABELS,
} from '@/services/socialIntentScoutService';

import {
  craftAnswer,
  getAnswers,
  type CraftedAnswer,
} from '@/services/answerCrafterService';

import {
  addToQueue,
  getQueue,
  approve,
  reject as rejectItem,
  editAndApprove,
  bulkApprove,
  getQueueStats,
  getQueueSettings,
  setAutoApproveEnabled,
  setAutoApproveThreshold,
  type ApprovalItem,
} from '@/services/approvalQueueService';

import {
  getScheduledPosts,
  cancelPost,
  getPlatformQuotas,
  getPostsByDay,
  simulatePost,
  type ScheduledPost,
} from '@/services/postSchedulerService';

import {
  runSocialIntelCycle,
  getSocialIntelStats,
  getCycleLog,
  getOrchestratorSettings,
  updateOrchestratorSettings,
} from '@/services/socialAgentOrchestrator';

// ─── Tab Config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'feed', label: 'Intent Feed', emoji: '🎯' },
  { id: 'queue', label: 'Answer Queue', emoji: '✍️' },
  { id: 'schedule', label: 'Post Schedule', emoji: '📅' },
  { id: 'analytics', label: 'Analytics', emoji: '📊' },
  { id: 'settings', label: 'Settings', emoji: '⚙️' },
] as const;
type TabId = typeof TABS[number]['id'];

// ─── Constants ─────────────────────────────────────────────────────────────────

const URGENCY_BADGE: Record<string, string> = {
  high: 'text-red-400 bg-red-500/15 border border-red-500/30',
  medium: 'text-yellow-400 bg-yellow-500/15 border border-yellow-500/30',
  low: 'text-green-400 bg-green-500/15 border border-green-500/30',
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'text-surface-400 bg-surface-700/50',
  pending_review: 'text-yellow-400 bg-yellow-500/15',
  approved: 'text-green-400 bg-green-500/15',
  rejected: 'text-red-400 bg-red-500/15',
  posted: 'text-blue-400 bg-blue-500/15',
  scheduled: 'text-purple-400 bg-purple-500/15',
};

const SCORE_COLOR = (n: number) =>
  n >= 8 ? 'text-green-400' : n >= 6 ? 'text-yellow-400' : 'text-red-400';

const ALL_PLATFORMS: SocialPlatform[] = [
  'reddit', 'quora', 'youtube_comments', 'x_twitter', 'google_paa', 'telegram_group', 'whatsapp_group',
];
const ALL_EXAMS: ExamCode[] = ['gate-em', 'gate-ee', 'gate-cs', 'jee', 'neet', 'cat', 'upsc'];
const ALL_INTENTS: IntentType[] = [
  'help_request', 'confusion', 'resource_hunt', 'comparison',
  'motivation_drop', 'result_anxiety', 'concept_question', 'practice_need', 'community_query',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('en-IN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {/* ignore */});
}

// ─── Signal Card ──────────────────────────────────────────────────────────────

function SignalCard({
  signal, onCraft, crafting,
}: {
  signal: SocialSignal;
  onCraft: (id: string) => void;
  crafting: boolean;
}) {
  return (
    <div className={`card p-3 sm:p-4 transition-all ${signal.processed ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-base">{PLATFORM_EMOJIS[signal.platform]}</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-surface-700 text-surface-300">
            {PLATFORM_LABELS[signal.platform]}{signal.subreddit ? ` · r/${signal.subreddit}` : ''}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-primary-500/20 text-primary-300">
            {EXAM_LABELS[signal.exam]}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] ${URGENCY_BADGE[signal.urgency]}`}>
            {signal.urgency === 'high' ? '🔴' : signal.urgency === 'medium' ? '🟡' : '🟢'} {signal.urgency}
          </span>
          <span className="hidden sm:inline px-2 py-0.5 rounded-full text-[11px] bg-surface-800 text-surface-400">
            {INTENT_LABELS[signal.intentType]}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-surface-500">
          {signal.upvotes !== undefined && <span>▲ {signal.upvotes}</span>}
          <span>{timeAgo(signal.detectedAt)}</span>
        </div>
      </div>

      <p className="mt-2 text-sm text-surface-200 leading-relaxed line-clamp-2 sm:line-clamp-none">
        &ldquo;{signal.originalText}&rdquo;
      </p>

      <div className="mt-2 flex items-center justify-between">
        <div className="text-xs text-surface-500">
          {signal.authorHandle && <span className="mr-3 hidden sm:inline">{signal.authorHandle}</span>}
          <span className="hidden sm:inline">Topic: <em>{signal.topic}</em></span>
        </div>
        {!signal.processed ? (
          <button
            onClick={() => onCraft(signal.id)}
            disabled={crafting}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors disabled:opacity-50 min-h-[36px]"
          >
            {crafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            Craft
          </button>
        ) : (
          <span className="text-xs text-green-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Done
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Answer Card ──────────────────────────────────────────────────────────────

function AnswerCard({
  answer, signal, queueItem,
  onApprove, onReject, onEdit,
  selected, onSelect,
}: {
  answer: CraftedAnswer;
  signal?: SocialSignal;
  queueItem?: ApprovalItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string) => void;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeFmt, setActiveFmt] = useState<keyof CraftedAnswer['formatted']>('reddit');
  const [copied, setCopied] = useState(false);
  const isPending = answer.status === 'pending_review';
  const queueId = queueItem?.id || answer.id;

  const platforms: (keyof CraftedAnswer['formatted'])[] = ['reddit', 'quora', 'x_twitter', 'youtube', 'telegram', 'whatsapp'];

  const handleCopy = () => {
    copyText(answer.formatted[activeFmt]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`card border transition-all ${selected ? 'border-primary-500/50' : 'border-surface-700/50'}`}>
      {/* Header */}
      <div className="p-3 sm:p-4">
        <div className="flex items-start gap-2 sm:gap-3">
          {isPending && (
            <input
              type="checkbox" checked={selected}
              onChange={() => onSelect(queueId)}
              className="mt-1 w-4 h-4 accent-primary-500 flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className="text-base">{PLATFORM_EMOJIS[answer.platform]}</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-primary-500/20 text-primary-300">
                {EXAM_LABELS[answer.exam as ExamCode]}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-surface-700 text-surface-300 hidden sm:inline">
                {answer.topic}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] ${STATUS_BADGE[answer.status]}`}>
                {answer.status.replace('_', ' ')}
              </span>
            </div>
            {signal && (
              <p className="text-xs text-surface-500 italic mb-2 line-clamp-1">
                Q: &ldquo;{signal.originalText.slice(0, 80)}&hellip;&rdquo;
              </p>
            )}
            <p className="text-sm text-surface-200 font-medium line-clamp-2">{answer.hook}</p>
          </div>
          {/* Scores — compact on mobile */}
          <div className="flex-shrink-0 flex gap-2 sm:grid sm:grid-cols-3 sm:gap-2 text-center">
            {[
              { l: 'H', fullL: 'Human', v: answer.humanizationScore },
              { l: 'S', fullL: 'Anti-Spam', v: answer.antiSpamScore },
              { l: 'R', fullL: 'Read', v: answer.readabilityScore },
            ].map(({ l, fullL, v }) => (
              <div key={fullL}>
                <div className={`text-base sm:text-lg font-bold ${SCORE_COLOR(v)}`}>{v}</div>
                <div className="text-[10px] text-surface-500 leading-tight">
                  <span className="sm:hidden">{l}</span>
                  <span className="hidden sm:inline">{fullL}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-2 flex items-center gap-1 text-xs text-surface-500 hover:text-surface-300 min-h-[32px]"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Collapse' : 'View full answer'}
        </button>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-surface-700 p-3 sm:p-4 space-y-3">
          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
            {platforms.map(p => (
              <button
                key={p} onClick={() => setActiveFmt(p)}
                className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap shrink-0 min-h-[32px] ${
                  activeFmt === p ? 'bg-primary-600 text-white' : 'bg-surface-800 text-surface-400 hover:text-white'
                }`}
              >
                {p === 'x_twitter' ? '𝕏' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          <div className="bg-surface-900 rounded-lg p-3 text-sm text-surface-300 whitespace-pre-wrap font-mono leading-relaxed max-h-48 sm:max-h-56 overflow-y-auto">
            {answer.formatted[activeFmt]}
          </div>

          {answer.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {answer.hashtags.map(tag => (
                <span key={tag} className="text-[11px] text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-surface-500">
            <span>{answer.wordCount}w · {timeAgo(answer.generatedAt)}</span>
            <button onClick={handleCopy} className="flex items-center gap-1 hover:text-surface-200 min-h-[32px]">
              <Copy className="w-3 h-3" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="border-t border-surface-700 p-2 sm:p-3 flex gap-2">
          <button
            onClick={() => onApprove(queueId)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors min-h-[40px]"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Approve</span>
            <span className="sm:hidden">✓</span>
          </button>
          <button
            onClick={() => onEdit(queueId)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors min-h-[40px]"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Edit & Approve</span>
            <span className="sm:hidden">✏️</span>
          </button>
          <button
            onClick={() => onReject(queueId)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors min-h-[40px]"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reject</span>
            <span className="sm:hidden">✕</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Tab 1: Intent Feed ───────────────────────────────────────────────────────

function IntentFeedTab() {
  const [signals, setSignals] = useState<SocialSignal[]>([]);
  const [scanning, setScanning] = useState(false);
  const [craftingId, setCraftingId] = useState<string | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<SocialPlatform | 'all'>('all');
  const [filterExam, setFilterExam] = useState<ExamCode | 'all'>('all');
  const [filterUrgency, setFilterUrgency] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [filterIntent, setFilterIntent] = useState<IntentType | 'all'>('all');
  const [lastScan, setLastScan] = useState<{ ts: number; count: number } | null>(null);

  const load = useCallback(() => {
    let all = getSavedSignals();
    if (filterPlatform !== 'all') all = all.filter(s => s.platform === filterPlatform);
    if (filterExam !== 'all') all = all.filter(s => s.exam === filterExam);
    if (filterUrgency !== 'all') all = all.filter(s => s.urgency === filterUrgency);
    if (filterIntent !== 'all') all = all.filter(s => s.intentType === filterIntent);
    all.sort((a, b) => b.detectedAt - a.detectedAt);
    setSignals(all);
    setLastScan(getLastScanInfo());
  }, [filterPlatform, filterExam, filterUrgency, filterIntent]);

  useEffect(() => { load(); }, [load]);

  const handleScan = async () => {
    setScanning(true);
    try {
      await runSocialIntelCycle();
      load();
    } finally {
      setScanning(false);
    }
  };

  const handleCraft = async (signalId: string) => {
    setCraftingId(signalId);
    try {
      const signal = getSavedSignals().find(s => s.id === signalId);
      if (!signal) return;
      const answer = craftAnswer(signal);
      addToQueue(answer, signal.urgency);
      markProcessed(signalId, answer.id);
      load();
    } finally {
      setCraftingId(null);
    }
  };

  const trending = getTrendingQuestions(filterExam === 'all' ? undefined : filterExam, 3);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Scan controls */}
      <div className="card p-3 sm:p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium text-white">Social Scanner</p>
          <p className="text-xs text-surface-500">
            {lastScan
              ? `Last: ${timeAgo(lastScan.ts)} · ${lastScan.count} signals`
              : 'No scan yet'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { clearSignals(); load(); }}
            className="px-3 py-2 text-xs bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-lg min-h-[36px]"
          >
            Clear
          </button>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 hover:bg-primary-500 text-white rounded-lg disabled:opacity-50 min-h-[40px]"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
            {scanning ? 'Scanning…' : 'Scan'}
          </button>
        </div>
      </div>

      {/* Trending */}
      {trending.length > 0 && (
        <div className="card p-3 sm:p-4">
          <p className="text-sm font-semibold text-surface-200 mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-orange-400" /> Trending
          </p>
          <div className="space-y-1.5">
            {trending.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-xs text-surface-400">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  s.urgency === 'high' ? 'bg-red-400' : s.urgency === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                }`} />
                <span className="truncate">{s.originalText.slice(0, 80)}…</span>
                <span className="flex-shrink-0">{PLATFORM_EMOJIS[s.platform]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters — scrollable row on mobile */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {[
          {
            value: filterPlatform, onChange: (v: string) => setFilterPlatform(v as SocialPlatform | 'all'),
            options: [['all', 'All Platforms'], ...ALL_PLATFORMS.map(p => [p, PLATFORM_LABELS[p]])],
          },
          {
            value: filterExam, onChange: (v: string) => setFilterExam(v as ExamCode | 'all'),
            options: [['all', 'All Exams'], ...ALL_EXAMS.map(e => [e, EXAM_LABELS[e]])],
          },
          {
            value: filterUrgency, onChange: (v: string) => setFilterUrgency(v as 'all' | 'high' | 'medium' | 'low'),
            options: [['all', 'Urgency'], ['high', '🔴 High'], ['medium', '🟡 Med'], ['low', '🟢 Low']],
          },
          {
            value: filterIntent, onChange: (v: string) => setFilterIntent(v as IntentType | 'all'),
            options: [['all', 'All Intents'], ...ALL_INTENTS.map(i => [i, INTENT_LABELS[i]])],
          },
        ].map((sel, idx) => (
          <select
            key={idx}
            value={sel.value}
            onChange={e => sel.onChange(e.target.value)}
            className="px-3 py-2 text-xs bg-surface-800 border border-surface-700 text-surface-300 rounded-lg shrink-0 min-h-[36px]"
          >
            {sel.options.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        ))}
        <span className="flex items-center text-xs text-surface-500 px-2 shrink-0">
          {signals.length} signal{signals.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Signals */}
      {signals.length === 0 ? (
        <div className="card p-8 sm:p-10 text-center text-surface-500">
          <Radio className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No signals. Run a scan to detect student questions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {signals.map(signal => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onCraft={handleCraft}
              crafting={craftingId === signal.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Answer Queue ──────────────────────────────────────────────────────

function AnswerQueueTab() {
  const [answers, setAnswers] = useState<CraftedAnswer[]>([]);
  const [queueItems, setQueueItems] = useState<ApprovalItem[]>([]);
  const [signals, setSignals] = useState<SocialSignal[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState(getQueueSettings());
  const [threshold, setThreshold] = useState(getQueueSettings().autoApproveThreshold);
  const [filterStatus, setFilterStatus] = useState<CraftedAnswer['status'] | 'all'>('pending_review');
  const stats = getQueueStats();

  const reload = useCallback(() => {
    const all = getAnswers();
    setAnswers(filterStatus === 'all' ? all : all.filter(a => a.status === filterStatus));
    setQueueItems(getQueue());
    setSignals(getSavedSignals());
    setSettings(getQueueSettings());
  }, [filterStatus]);

  useEffect(() => { reload(); }, [reload]);

  const queueMap = Object.fromEntries(queueItems.map(qi => [qi.answerId, qi]));
  const signalMap = Object.fromEntries(signals.map(s => [s.id, s]));

  const handleApprove = (id: string) => { approve(id); reload(); };
  const handleReject = (id: string) => { rejectItem(id, 'Rejected by admin'); reload(); };
  const handleEdit = (id: string) => {
    const newHook = window.prompt('Edit the opening hook:');
    if (newHook) { editAndApprove(id, { hook: newHook }); reload(); }
  };
  const handleBulkApprove = () => {
    bulkApprove([...selected]);
    setSelected(new Set());
    reload();
  };
  const handleToggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const handleToggleAutoApprove = () => {
    setAutoApproveEnabled(!settings.autoApproveEnabled);
    setSettings(getQueueSettings());
  };
  const handleThresholdChange = (v: number) => {
    setThreshold(v);
    setAutoApproveThreshold(v);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Stats row — 2×2 on mobile, 4-col on sm+ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Pending', value: stats.pending, color: 'text-yellow-400' },
          { label: 'Approved', value: stats.approved, color: 'text-green-400' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-400' },
          { label: 'Auto-ok', value: stats.autoApproved, color: 'text-blue-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-3 text-center">
            <div className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-surface-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="card p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium text-white">Approval Queue</p>
            <p className="text-xs text-surface-500">{stats.pending} pending</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-surface-400">Auto-approve</span>
            <button onClick={handleToggleAutoApprove}>
              {settings.autoApproveEnabled
                ? <ToggleRight className="w-5 h-5 text-green-400" />
                : <ToggleLeft className="w-5 h-5 text-surface-500" />}
            </button>
          </div>
        </div>
        {settings.autoApproveEnabled && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-surface-400">Threshold: {threshold}</span>
            <input
              type="range" min={5} max={10} step={0.5} value={threshold}
              onChange={e => handleThresholdChange(Number(e.target.value))}
              className="w-24 accent-primary-500"
            />
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as CraftedAnswer['status'] | 'all')}
            className="px-3 py-2 text-xs bg-surface-800 border border-surface-700 text-surface-300 rounded-lg min-h-[36px]"
          >
            <option value="all">All Status</option>
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="scheduled">Scheduled</option>
            <option value="posted">Posted</option>
          </select>
          {selected.size > 0 && (
            <button
              onClick={handleBulkApprove}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg min-h-[36px] w-full sm:w-auto justify-center"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Bulk Approve ({selected.size})
            </button>
          )}
        </div>
      </div>

      {/* Answer cards */}
      {answers.length === 0 ? (
        <div className="card p-8 sm:p-10 text-center text-surface-500">
          <Edit3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No answers yet. Go to Intent Feed and click &quot;Craft Answer&quot;.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {answers.map(answer => (
            <AnswerCard
              key={answer.id}
              answer={answer}
              signal={signalMap[answer.signalId]}
              queueItem={queueMap[answer.id]}
              onApprove={handleApprove}
              onReject={handleReject}
              onEdit={handleEdit}
              selected={selected.has(queueMap[answer.id]?.id || answer.id)}
              onSelect={handleToggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Post Schedule ─────────────────────────────────────────────────────

function PostScheduleTab() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [quotas, setQuotas] = useState<ReturnType<typeof getPlatformQuotas>>({} as ReturnType<typeof getPlatformQuotas>);
  const [byDay, setByDay] = useState<Record<string, ScheduledPost[]>>({});

  const load = useCallback(() => {
    setPosts(getScheduledPosts());
    setQuotas(getPlatformQuotas());
    setByDay(getPostsByDay());
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCancel = (id: string) => { cancelPost(id); load(); };
  const handleSimulatePost = (post: ScheduledPost) => {
    simulatePost(post);
    load();
  };

  const platforms: SocialPlatform[] = ['reddit', 'quora', 'x_twitter', 'youtube_comments', 'telegram_group', 'whatsapp_group'];

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Quota bars */}
      <div className="card p-3 sm:p-4">
        <p className="text-sm font-semibold text-surface-200 mb-3">Daily Quotas</p>
        <div className="space-y-2">
          {platforms.map(p => {
            const q = quotas[p] || { used: 0, total: 0, remaining: 0 };
            if (q.total === 0) return null;
            const pct = q.total > 0 ? (q.used / q.total) * 100 : 0;
            return (
              <div key={p} className="flex items-center gap-2 sm:gap-3">
                <span className="text-sm w-5 text-center">{PLATFORM_EMOJIS[p]}</span>
                <span className="text-xs text-surface-400 w-20 sm:w-24 truncate">{PLATFORM_LABELS[p]}</span>
                <div className="flex-1 h-2 bg-surface-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <span className="text-xs text-surface-500 w-12 sm:w-16 text-right">{q.used}/{q.total}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline by day */}
      {Object.keys(byDay).length === 0 ? (
        <div className="card p-8 sm:p-10 text-center text-surface-500">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No posts scheduled. Approve answers to add them.</p>
        </div>
      ) : (
        Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, dayPosts]) => (
          <div key={day} className="card p-3 sm:p-4">
            <p className="text-sm font-semibold text-surface-200 mb-3">
              📅 {new Date(day).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
              <span className="ml-2 text-xs text-surface-500">({dayPosts.length})</span>
            </p>
            <div className="space-y-2">
              {dayPosts.sort((a, b) => a.scheduledFor - b.scheduledFor).map(post => (
                <div key={post.id} className="flex items-center gap-2 sm:gap-3 p-2 bg-surface-800/50 rounded-lg">
                  <span className="text-base">{PLATFORM_EMOJIS[post.platform]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-surface-300 truncate">{post.content.slice(0, 50)}…</p>
                    <p className="text-[10px] text-surface-500 mt-0.5">{formatDateTime(post.scheduledFor)}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] shrink-0 ${
                    post.status === 'posted' ? 'bg-green-500/15 text-green-400' :
                    post.status === 'failed' ? 'bg-red-500/15 text-red-400' :
                    post.status === 'cancelled' ? 'bg-surface-700 text-surface-500' :
                    'bg-yellow-500/15 text-yellow-400'
                  }`}>
                    {post.status}
                  </span>
                  {post.status === 'queued' && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleSimulatePost(post)}
                        className="px-2 py-1 text-[11px] bg-primary-600 hover:bg-primary-500 text-white rounded min-h-[28px]"
                      >
                        Post
                      </button>
                      <button
                        onClick={() => handleCancel(post.id)}
                        className="px-2 py-1 text-[11px] bg-surface-700 hover:bg-red-600 text-surface-300 hover:text-white rounded min-h-[28px]"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Tab 4: Analytics ─────────────────────────────────────────────────────────

function AnalyticsTab() {
  const [stats, setStats] = useState(getSocialIntelStats());
  const [cycleLog, setCycleLog] = useState<ReturnType<typeof getCycleLog>>([]);

  useEffect(() => {
    setStats(getSocialIntelStats());
    setCycleLog(getCycleLog());
  }, []);

  const allSignals = getSavedSignals();
  const allAnswers = getAnswers();

  const platformCounts: Record<string, number> = {};
  for (const s of allSignals) {
    platformCounts[s.platform] = (platformCounts[s.platform] || 0) + 1;
  }

  const examCounts: Record<string, number> = {};
  for (const s of allSignals) {
    examCounts[s.exam] = (examCounts[s.exam] || 0) + 1;
  }

  const intentCounts: Record<string, number> = {};
  for (const s of allSignals) {
    intentCounts[s.intentType] = (intentCounts[s.intentType] || 0) + 1;
  }

  const approvalRate = stats.queueStats.total > 0
    ? Math.round((stats.queueStats.approved / stats.queueStats.total) * 100)
    : 0;
  const autoApproveRate = stats.queueStats.approved > 0
    ? Math.round((stats.queueStats.autoApproved / stats.queueStats.approved) * 100)
    : 0;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* KPI row — 2×2 on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Signals', value: stats.totalSignals, sub: `${stats.processedSignals} done`, icon: '📡' },
          { label: 'Answers', value: stats.totalAnswers, sub: `${stats.pendingReview} pending`, icon: '✍️' },
          { label: 'Approval', value: `${approvalRate}%`, sub: `${autoApproveRate}% auto`, icon: '✅' },
          { label: 'Scheduled', value: stats.scheduled, sub: `${stats.posted} posted`, icon: '📅' },
        ].map(({ label, value, sub, icon }) => (
          <div key={label} className="card p-3">
            <div className="text-xl mb-1">{icon}</div>
            <div className="text-xl sm:text-2xl font-bold text-white">{value}</div>
            <div className="text-xs text-surface-400 mt-0.5">{label}</div>
            <div className="text-[11px] text-surface-600 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Platform breakdown */}
        <div className="card p-3 sm:p-4">
          <p className="text-sm font-semibold text-surface-200 mb-3">By Platform</p>
          <div className="space-y-2">
            {Object.entries(platformCounts).sort(([, a], [, b]) => b - a).map(([platform, count]) => {
              const pct = allSignals.length > 0 ? (count / allSignals.length) * 100 : 0;
              return (
                <div key={platform} className="flex items-center gap-2">
                  <span className="text-sm w-5">{PLATFORM_EMOJIS[platform as SocialPlatform]}</span>
                  <span className="text-xs text-surface-400 w-24 truncate">{PLATFORM_LABELS[platform as SocialPlatform]}</span>
                  <div className="flex-1 h-1.5 bg-surface-800 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-surface-500 w-5 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Exam breakdown */}
        <div className="card p-3 sm:p-4">
          <p className="text-sm font-semibold text-surface-200 mb-3">By Exam</p>
          <div className="space-y-2">
            {Object.entries(examCounts).sort(([, a], [, b]) => b - a).map(([exam, count]) => {
              const pct = allSignals.length > 0 ? (count / allSignals.length) * 100 : 0;
              return (
                <div key={exam} className="flex items-center gap-2">
                  <span className="text-xs text-surface-400 w-20">{EXAM_LABELS[exam as ExamCode]}</span>
                  <div className="flex-1 h-1.5 bg-surface-800 rounded-full overflow-hidden">
                    <div className="h-full bg-accent-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-surface-500 w-5 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quality scores */}
      <div className="card p-3 sm:p-4">
        <p className="text-sm font-semibold text-surface-200 mb-3">Answer Quality (Avg)</p>
        {allAnswers.length === 0 ? (
          <p className="text-xs text-surface-500">No answers generated yet.</p>
        ) : (
          <div className="space-y-3">
            {[
              { label: 'Humanization', key: 'humanizationScore' as const },
              { label: 'Anti-Spam', key: 'antiSpamScore' as const },
              { label: 'Readability', key: 'readabilityScore' as const },
            ].map(({ label, key }) => {
              const avg = allAnswers.reduce((sum, a) => sum + a[key], 0) / allAnswers.length;
              return (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs text-surface-400 w-24">{label}</span>
                  <div className="flex-1 h-2 bg-surface-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${avg >= 8 ? 'bg-green-500' : avg >= 6 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${avg * 10}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold w-8 text-right ${SCORE_COLOR(avg)}`}>{avg.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cycle log */}
      {cycleLog.length > 0 && (
        <div className="card p-3 sm:p-4">
          <p className="text-sm font-semibold text-surface-200 mb-3">Recent Scan Cycles</p>
          <div className="space-y-2">
            {cycleLog.slice(0, 5).map(cycle => (
              <div key={cycle.cycleId} className="flex flex-wrap items-center gap-2 text-xs text-surface-400 py-1 border-b border-surface-800">
                <span className="text-surface-500">{timeAgo(cycle.completedAt)}</span>
                <span>+{cycle.newSignals} sig</span>
                <span>+{cycle.answersGenerated} ans</span>
                <span>{cycle.autoApproved} auto</span>
                {cycle.errors.length > 0 && <span className="text-red-400">{cycle.errors.length} err</span>}
                <span className="ml-auto text-surface-600">{Math.round((cycle.completedAt - cycle.startedAt) / 1000)}s</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 5: Settings ──────────────────────────────────────────────────────────

function SettingsTab() {
  const [orchSettings, setOrchSettings] = useState(getOrchestratorSettings());
  const [queueSettings, setQueueSettingsState] = useState(getQueueSettings());
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateOrchestratorSettings(orchSettings);
    setAutoApproveEnabled(queueSettings.autoApproveEnabled);
    setAutoApproveThreshold(queueSettings.autoApproveThreshold);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const togglePlatform = (p: SocialPlatform) => {
    setOrchSettings(prev => ({
      ...prev,
      activePlatforms: prev.activePlatforms.includes(p)
        ? prev.activePlatforms.filter(x => x !== p)
        : [...prev.activePlatforms, p],
    }));
  };

  const toggleExam = (e: ExamCode) => {
    setOrchSettings(prev => ({
      ...prev,
      activeExams: prev.activeExams.includes(e)
        ? prev.activeExams.filter(x => x !== e)
        : [...prev.activeExams, e],
    }));
  };

  return (
    <div className="space-y-3 sm:space-y-4 max-w-2xl">
      {/* Platform toggles */}
      <div className="card p-3 sm:p-4">
        <p className="text-sm font-semibold text-surface-200 mb-3">Monitored Platforms</p>
        <div className="grid grid-cols-2 gap-2">
          {ALL_PLATFORMS.map(p => (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border transition-all min-h-[44px] ${
                orchSettings.activePlatforms.includes(p)
                  ? 'bg-primary-600/20 border-primary-500/40 text-primary-300'
                  : 'bg-surface-800 border-surface-700 text-surface-400'
              }`}
            >
              <span>{PLATFORM_EMOJIS[p]}</span>
              <span className="text-xs">{PLATFORM_LABELS[p]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Exam filters */}
      <div className="card p-3 sm:p-4">
        <p className="text-sm font-semibold text-surface-200 mb-3">Target Exams</p>
        <div className="flex flex-wrap gap-2">
          {ALL_EXAMS.map(e => (
            <button
              key={e}
              onClick={() => toggleExam(e)}
              className={`px-3 py-2 rounded-lg text-sm border transition-all min-h-[40px] ${
                orchSettings.activeExams.includes(e)
                  ? 'bg-accent-600/20 border-accent-500/40 text-accent-300'
                  : 'bg-surface-800 border-surface-700 text-surface-400'
              }`}
            >
              {EXAM_LABELS[e]}
            </button>
          ))}
        </div>
      </div>

      {/* Auto-approve settings */}
      <div className="card p-3 sm:p-4 space-y-4">
        <p className="text-sm font-semibold text-surface-200">Auto-Approve</p>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-surface-300">Enable Auto-Approve</p>
            <p className="text-xs text-surface-500">Approve answers meeting quality threshold</p>
          </div>
          <button onClick={() => setQueueSettingsState(prev => ({ ...prev, autoApproveEnabled: !prev.autoApproveEnabled }))}>
            {queueSettings.autoApproveEnabled
              ? <ToggleRight className="w-6 h-6 text-green-400" />
              : <ToggleLeft className="w-6 h-6 text-surface-500" />}
          </button>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <p className="text-sm text-surface-300">Quality Threshold</p>
            <span className="text-sm font-bold text-primary-400">{queueSettings.autoApproveThreshold}/10</span>
          </div>
          <input
            type="range" min={5} max={10} step={0.5}
            value={queueSettings.autoApproveThreshold}
            onChange={e => setQueueSettingsState(prev => ({ ...prev, autoApproveThreshold: Number(e.target.value) }))}
            className="w-full accent-primary-500"
          />
        </div>
      </div>

      {/* Scan & Voice */}
      <div className="card p-3 sm:p-4 space-y-4">
        <p className="text-sm font-semibold text-surface-200">Scan & Voice</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-surface-400 block mb-1.5">Scan Frequency</label>
            <select
              value={orchSettings.scanFrequency}
              onChange={e => setOrchSettings(prev => ({ ...prev, scanFrequency: e.target.value as 'hourly' | 'every6h' | 'daily' }))}
              className="w-full px-3 py-2 text-sm bg-surface-800 border border-surface-700 text-surface-300 rounded-lg"
            >
              <option value="hourly">Every Hour</option>
              <option value="every6h">Every 6 Hours</option>
              <option value="daily">Daily</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-400 block mb-1.5">Brand Voice</label>
            <select
              value={orchSettings.brandVoice}
              onChange={e => setOrchSettings(prev => ({ ...prev, brandVoice: e.target.value as 'formal' | 'casual' | 'expert' }))}
              className="w-full px-3 py-2 text-sm bg-surface-800 border border-surface-700 text-surface-300 rounded-lg"
            >
              <option value="casual">Casual</option>
              <option value="expert">Expert</option>
              <option value="formal">Formal</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-surface-400 block mb-1.5">
            Max Answers/Cycle: {orchSettings.maxAnswersPerCycle}
          </label>
          <input
            type="range" min={1} max={20} step={1}
            value={orchSettings.maxAnswersPerCycle}
            onChange={e => setOrchSettings(prev => ({ ...prev, maxAnswersPerCycle: Number(e.target.value) }))}
            className="w-full accent-primary-500"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        className={`w-full py-3 rounded-lg text-sm font-medium transition-all min-h-[48px] ${
          saved ? 'bg-green-600 text-white' : 'bg-primary-600 hover:bg-primary-500 text-white'
        }`}
      >
        {saved ? '✓ Settings Saved' : 'Save Settings'}
      </button>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function SocialIntentDashboard() {
  const [tab, setTab] = useState<TabId>('feed');
  const [stats, setStats] = useState(getSocialIntelStats());

  useEffect(() => {
    setStats(getSocialIntelStats());
    const interval = setInterval(() => setStats(getSocialIntelStats()), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-primary-400" />
              Social Intel Hub
            </h1>
            <p className="text-xs sm:text-sm text-surface-400 mt-1">
              Scout → Answer → Humanize → Approve → Post
            </p>
          </div>

          {/* Live stats badges — 2×2 on mobile */}
          <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2">
            <div className="px-3 py-1.5 bg-surface-800 rounded-lg text-xs text-center">
              <div className="font-bold text-white">{stats.totalSignals}</div>
              <div className="text-surface-500">Signals</div>
            </div>
            <div className="px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-center">
              <div className="font-bold text-yellow-400">{stats.pendingReview}</div>
              <div className="text-surface-500">Pending</div>
            </div>
            <div className="px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-center">
              <div className="font-bold text-green-400">{stats.scheduled}</div>
              <div className="text-surface-500">Sched.</div>
            </div>
            <div className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-center">
              <div className="font-bold text-blue-400">{stats.posted}</div>
              <div className="text-surface-500">Posted</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs — horizontally scrollable, icon-only on mobile */}
      <div className="flex gap-1 mb-4 sm:mb-6 overflow-x-auto scrollbar-none bg-surface-800/50 p-1 rounded-xl">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm transition-all shrink-0 min-h-[44px] ${
              tab === t.id
                ? 'bg-primary-600 text-white font-medium'
                : 'text-surface-400 hover:text-surface-200'
            }`}
          >
            <span>{t.emoji}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'feed' && <IntentFeedTab />}
      {tab === 'queue' && <AnswerQueueTab />}
      {tab === 'schedule' && <PostScheduleTab />}
      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}
