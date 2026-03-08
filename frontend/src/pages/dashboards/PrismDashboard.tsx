/**
 * PrismDashboard — Journey Intelligence Hub
 * CEO + Admin only · Route: /prism
 *
 * Design principles:
 *  • NEVER auto-runs on page visit — every run costs real money
 *  • Rate guard: once per day (configurable), with force-run confirm dialog
 *  • Cost is always visible before any CTA
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Zap,
  TrendingUp,
  Brain,
  Users,
  BarChart3,
  Target,
  Bot,
  BookOpen,
  MessageSquare,
  Activity,
  ArrowRight,
  Settings,
  X,
  Play,
  Lock,
  RefreshCw,
} from 'lucide-react';
import {
  runPrismAnalysis,
  loadPrismState,
  acknowledgePacket,
  actionPacket,
  loadScheduleConfig,
  updateScheduleConfig,
  canRunPrism,
  estimateRunCost,
  type PrismScheduleConfig,
  type PrismState,
  type IntelligencePacket,
  type PrismTargetAgent,
} from '@/services/prismBridge';
import { pushNetworkSignalsToPrism } from '@/services/networkAgentBridge';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimeAgo(isoString: string | null): string {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = diff / (1000 * 60);
  const hours = diff / (1000 * 60 * 60);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${Math.floor(mins)}m ago`;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatNextRun(isoString: string | null): string {
  if (!isoString) return '—';
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) return 'Now';
  const mins = diff / (1000 * 60);
  const hours = diff / (1000 * 60 * 60);
  if (mins < 60) return `in ${Math.ceil(mins)}m`;
  if (hours < 24) return `in ${hours.toFixed(1)}h`;
  return `in ${Math.floor(hours / 24)}d`;
}

function formatDateTime(isoString: string | null): string {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatCountdown(isoString: string | null): string {
  if (!isoString) return '';
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) return '';
  const totalMins = Math.floor(diff / (1000 * 60));
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `(in ${hrs}h ${mins}m)`;
}

// ── Agent metadata ────────────────────────────────────────────────────────────

const AGENT_META: Record<
  PrismTargetAgent,
  { emoji: string; name: string; color: string; icon: typeof Brain }
> = {
  sage:   { emoji: '🎓', name: 'Sage',   color: 'from-violet-500 to-purple-600', icon: Brain },
  atlas:  { emoji: '📚', name: 'Atlas',  color: 'from-blue-500 to-cyan-600',     icon: BookOpen },
  herald: { emoji: '📢', name: 'Herald', color: 'from-orange-500 to-amber-600',  icon: MessageSquare },
  scout:  { emoji: '🔍', name: 'Scout',  color: 'from-green-500 to-emerald-600', icon: TrendingUp },
  mentor: { emoji: '👨‍🏫', name: 'Mentor', color: 'from-pink-500 to-rose-600',    icon: Users },
  oracle: { emoji: '📊', name: 'Oracle', color: 'from-indigo-500 to-blue-600',   icon: BarChart3 },
  forge:  { emoji: '⚙️', name: 'Forge',  color: 'from-zinc-500 to-slate-600',    icon: Zap },
};

const ALL_AGENTS: PrismTargetAgent[] = ['sage', 'atlas', 'herald', 'scout', 'mentor', 'oracle', 'forge'];

// ── Priority badge ────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: IntelligencePacket['priority'] }) {
  const cls = {
    critical: 'bg-red-500/20 text-red-300 border-red-500/40',
    high:     'bg-amber-500/20 text-amber-300 border-amber-500/40',
    medium:   'bg-blue-500/20 text-blue-300 border-blue-500/40',
    low:      'bg-surface-700 text-surface-400 border-surface-600',
  }[priority];
  return (
    <span className={'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ' + cls}>
      {priority}
    </span>
  );
}

// ── Funnel Stage ──────────────────────────────────────────────────────────────

function conversionColor(rate: number): string {
  if (rate > 0.2) return 'text-green-400 border-green-500/40 bg-green-500/10';
  if (rate > 0.1) return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
  return 'text-red-400 border-red-500/40 bg-red-500/10';
}

function FunnelStage({
  label, count, rate, rateLabel, icon, isLast,
}: {
  label: string; count: number; rate?: number; rateLabel?: string;
  icon: React.ReactNode; isLast?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 min-w-0">
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 text-center">
          <div className="flex justify-center mb-2 text-surface-400">{icon}</div>
          <p className="text-xs text-surface-400 mb-1 font-medium">{label}</p>
          <p className="text-2xl font-bold text-white">{count.toLocaleString()}</p>
          {rate !== undefined && (
            <div className={'mt-2 inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ' + conversionColor(rate)}>
              {rateLabel ?? (rate * 100).toFixed(1) + '%'}
            </div>
          )}
        </div>
      </div>
      {!isLast && <ArrowRight className="w-5 h-5 text-surface-600 flex-shrink-0" />}
    </div>
  );
}

// ── Intelligence Card ─────────────────────────────────────────────────────────

function IntelCard({
  agent, packet, onAck, onAction,
}: {
  agent: PrismTargetAgent;
  packet: IntelligencePacket | undefined;
  onAck: (id: string) => void;
  onAction: (id: string) => void;
}) {
  const meta = AGENT_META[agent];
  const AgentIcon = meta.icon;
  const [actionNote, setActionNote] = useState<string | null>(null);

  const glowClass =
    packet?.priority === 'critical'
      ? 'ring-2 ring-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
      : packet?.priority === 'high'
      ? 'ring-1 ring-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.1)]'
      : '';

  // Action = mark actioned + heartbeat note; NO inline LLM calls
  const handleQueue = useCallback((packetId: string) => {
    onAction(packetId);
    setActionNote('Queued for agent. Will be processed on next heartbeat.');
  }, [onAction]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={'bg-surface-800 border border-surface-700 rounded-2xl p-4 flex flex-col gap-3 ' + glowClass}
    >
      <div className="flex items-center gap-3">
        <div className={'w-10 h-10 rounded-xl bg-gradient-to-br ' + meta.color + ' flex items-center justify-center text-lg flex-shrink-0'}>
          {meta.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">{meta.name}</p>
          {packet && <p className="text-[10px] text-surface-500">{packet.subAgent}</p>}
        </div>
        {packet && <PriorityBadge priority={packet.priority} />}
      </div>

      {packet ? (
        <>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface-700 text-surface-400 border border-surface-600 font-mono">
              {packet.signalType}
            </span>
            {packet.signalType.startsWith('network:') && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-900/40 text-purple-400 border border-purple-500/30 font-medium">
                🌐 Network Effect · {(packet.dataPoints?.networkLoopId as string ?? '').replace(/_/g, ' ')}
              </span>
            )}
            {packet.subAgent && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-900/20 text-blue-400 border border-blue-500/20">
                sub-agent: {packet.subAgent}
              </span>
            )}
          </div>

          <p className="text-sm text-surface-200 leading-relaxed">{packet.insight}</p>

          <div className="bg-surface-700/50 rounded-xl p-3 border border-surface-600/50">
            <p className="text-[10px] text-primary-400 font-semibold uppercase tracking-wider mb-1.5">
              Action Required
            </p>
            <p className="text-xs text-surface-300 leading-relaxed">{packet.actionRequired}</p>
          </div>

          {actionNote && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-green-900/20 border border-green-500/30 rounded-xl p-3"
            >
              <p className="text-xs text-green-400 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {actionNote}
              </p>
            </motion.div>
          )}

          {packet.status === 'pending' && (
            <div className="flex gap-2">
              <button
                onClick={() => onAck(packet.id)}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-surface-700 hover:bg-surface-600 text-surface-300 transition-colors font-medium"
              >
                Acknowledge
              </button>
              <button
                onClick={() => handleQueue(packet.id)}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-primary-500/20 hover:bg-primary-500/30 text-primary-300 border border-primary-500/30 transition-colors font-medium flex items-center justify-center gap-1"
              >
                <Zap className="w-3 h-3" /> Queue Action
              </button>
            </div>
          )}
          {packet.status === 'acknowledged' && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <AlertCircle className="w-3.5 h-3.5" />
              Acknowledged — awaiting action
              <button
                onClick={() => handleQueue(packet.id)}
                className="ml-auto px-2 py-1 text-[10px] rounded bg-primary-500/20 hover:bg-primary-500/30 text-primary-300 border border-primary-500/30 transition-colors flex items-center gap-1"
              >
                <Zap className="w-2.5 h-2.5" /> Queue
              </button>
            </div>
          )}
          {packet.status === 'actioned' && (
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <CheckCircle className="w-3.5 h-3.5" />
              Queued for agent heartbeat ✓
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center py-6">
          <div className="text-center">
            <AgentIcon className="w-8 h-8 text-surface-600 mx-auto mb-2" />
            <p className="text-xs text-surface-500">No intelligence yet</p>
            <p className="text-[10px] text-surface-600">Run analysis to generate packets</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Schedule Config Panel ─────────────────────────────────────────────────────

function SchedulePanel({
  config, onClose, onSave,
}: {
  config: PrismScheduleConfig;
  onClose: () => void;
  onSave: (updated: PrismScheduleConfig) => void;
}) {
  const [draft, setDraft] = useState<PrismScheduleConfig>({ ...config });

  const previewCost = ((draft.estimatedTokensPerRun / 1000) * draft.tokenCostPer1k).toFixed(4);

  const handleSave = () => {
    const updated = updateScheduleConfig(draft);
    onSave(updated);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }}
        className="bg-surface-900 border border-surface-700 rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-semibold text-white">Prism Schedule Configuration</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-700 text-surface-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-2">Run Frequency</label>
            <select
              value={draft.frequencyHours}
              onChange={(e) => setDraft({ ...draft, frequencyHours: Number(e.target.value) })}
              className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value={12}>Every 12 hours</option>
              <option value={24}>Once per day (24h)</option>
              <option value={48}>Every 2 days (48h)</option>
              <option value={72}>Every 3 days (72h)</option>
              <option value={168}>Weekly (168h)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-2">Max Runs Per Day</label>
            <select
              value={draft.maxRunsPerDay}
              onChange={(e) => setDraft({ ...draft, maxRunsPerDay: Number(e.target.value) })}
              className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value={1}>1 run/day (recommended)</option>
              <option value={2}>2 runs/day</option>
              <option value={3}>3 runs/day</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-2">Token Budget Per Run</label>
            <input
              type="number"
              value={draft.estimatedTokensPerRun}
              onChange={(e) => setDraft({ ...draft, estimatedTokensPerRun: Number(e.target.value) })}
              className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              min={1000}
              step={500}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-2">Token Cost (per 1K tokens, USD)</label>
            <input
              type="number"
              value={draft.tokenCostPer1k}
              onChange={(e) => setDraft({ ...draft, tokenCostPer1k: Number(e.target.value) })}
              className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              min={0.0001}
              step={0.0001}
            />
            <p className="text-[11px] text-surface-500 mt-1">Sonnet: $0.003 · Haiku: $0.00025</p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3">
            <p className="text-xs text-amber-300 font-medium">
              Estimated cost per run: ${previewCost} · {draft.estimatedTokensPerRun.toLocaleString()} tokens
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface-800 hover:bg-surface-700 text-surface-300 border border-surface-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-black transition-colors"
          >
            Save Configuration
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Force Run Confirm Dialog ──────────────────────────────────────────────────

function ForceRunDialog({
  config, onCancel, onConfirm,
}: {
  config: PrismScheduleConfig;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const lastRunAgo = formatTimeAgo(config.lastRunAt);
  const cost = estimateRunCost();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }}
        className="bg-surface-900 border border-amber-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Override Rate Limit?</h2>
            <p className="text-xs text-surface-400 mt-0.5">This consumes real tokens</p>
          </div>
        </div>

        <div className="space-y-3 mb-6 text-sm text-surface-300 leading-relaxed">
          <p>
            This will consume{' '}
            <span className="text-amber-400 font-semibold">
              ~{cost.tokens.toLocaleString()} tokens ({cost.formatted})
            </span>.
          </p>
          <p>
            You already ran analysis <span className="text-white font-medium">{lastRunAgo}</span>.
          </p>
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 text-xs text-amber-200">
            Prism is designed to run <strong>once per day</strong>. Forcing a run wastes
            budget without meaningful new data — student journeys don't change in hours.
          </div>
          {config.manualOverrideCount > 0 && (
            <p className="text-[11px] text-surface-500">
              You've overridden the schedule {config.manualOverrideCount} time{config.manualOverrideCount !== 1 ? 's' : ''} before.
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface-800 hover:bg-surface-700 text-surface-300 border border-surface-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors"
          >
            Force Run — I understand the cost
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

type ActiveTab = 'funnel' | 'packets' | 'gaps' | 'paths';

export function PrismDashboard() {
  const navigate = useNavigate();
  const [state, setState] = useState<PrismState | null>(null);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('packets');
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);
  const [showForceDialog, setShowForceDialog] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState<PrismScheduleConfig>(() => loadScheduleConfig());

  // Refresh config from localStorage on every render tick
  useEffect(() => {
    setScheduleConfig(loadScheduleConfig());
  });

  // Load cached state on mount — NO auto-run
  useEffect(() => {
    const cached = loadPrismState();
    if (cached) setState(cached);
    // deliberately NOT calling handleRunAnalysis here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAnalysis = useCallback(async (isManualOverride = false) => {
    setRunning(true);
    try {
      const result = runPrismAnalysis({ force: isManualOverride, manualOverride: isManualOverride });
      pushNetworkSignalsToPrism('JEE Main');
      const merged = loadPrismState();
      setState(merged ?? result);
      setScheduleConfig(loadScheduleConfig());
    } finally {
      setRunning(false);
    }
  }, []);

  const handleRunClick = useCallback(() => {
    const { allowed } = canRunPrism();
    if (!allowed) {
      setShowForceDialog(true);
    } else {
      runAnalysis(false);
    }
  }, [runAnalysis]);

  const handleForceConfirm = useCallback(() => {
    setShowForceDialog(false);
    runAnalysis(true);
  }, [runAnalysis]);

  const handleAck = useCallback((id: string) => {
    acknowledgePacket(id);
    setState(loadPrismState());
  }, []);

  const handleAction = useCallback((id: string) => {
    actionPacket(id);
    setState(loadPrismState());
  }, []);

  const funnel = state?.funnelMetrics;
  const packets = state?.intelligencePackets ?? [];

  const getLatestPacket = (agent: PrismTargetAgent): IntelligencePacket | undefined =>
    packets
      .filter((p) => p.targetAgent === agent)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())[0];

  // ── Derived values for rate-status bar ──
  const estimateCost = estimateRunCost();
  const lastRunAgo = formatTimeAgo(scheduleConfig.lastRunAt);
  const nextRunLabel = scheduleConfig.nextScheduledAt
    ? formatNextRun(scheduleConfig.nextScheduledAt)
    : scheduleConfig.lastRunAt ? '—' : 'Anytime';
  const nextRunDateTime = formatDateTime(scheduleConfig.nextScheduledAt);
  const nextRunCountdown = formatCountdown(scheduleConfig.nextScheduledAt);

  // ── Run Control state machine ──
  const rateCheck = canRunPrism();
  type RunState = 'never' | 'running' | 'locked' | 'ready';
  const runState: RunState = running
    ? 'running'
    : !scheduleConfig.lastRunAt
    ? 'never'
    : !rateCheck.allowed
    ? 'locked'
    : 'ready';

  // Tab visibility: tabs visible only if data exists
  const hasTabs = state !== null;

  return (
    <div className="min-h-screen p-6 space-y-5 max-w-7xl mx-auto">

      {/* ── Zone A: Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-xl shadow-lg">
            🔮
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Prism Intelligence</h1>
            <p className="text-xs text-surface-400">Journey analytics · Agent intelligence packets</p>
          </div>
        </div>
        <button
          onClick={() => setShowSchedulePanel(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-surface-800 hover:bg-surface-700 text-surface-300 border border-surface-600 transition-colors"
        >
          <Settings className="w-4 h-4" />
          Schedule
        </button>
      </div>

      {/* ── Zone B: Rate Status Bar ── */}
      <div className="rate-status-bar">
        <div className="stat">
          <span className="label">Last Run</span>
          <span className="value">{lastRunAgo}</span>
          <span className="sub">${scheduleConfig.lastRunCostUsd.toFixed(3)} spent</span>
        </div>
        <div className="divider" />
        <div className="stat">
          <span className="label">Next Scheduled</span>
          <span className="value">{nextRunLabel}</span>
          <span className="sub">
            {scheduleConfig.nextScheduledAt ? nextRunDateTime : `${scheduleConfig.frequencyHours}h frequency`}
          </span>
        </div>
        <div className="divider" />
        <div className="stat highlight">
          <span className="label">Cost Per Run</span>
          <span className="value">${estimateCost.costUsd.toFixed(3)}</span>
          <span className="sub">{estimateCost.tokens.toLocaleString()} tokens</span>
        </div>
        <div className="divider" />
        <div className="stat">
          <span className="label">Total Spent</span>
          <span className="value">${scheduleConfig.totalCostAllTimeUsd.toFixed(2)}</span>
          <span className="sub">{scheduleConfig.totalRunsAllTime} runs all-time</span>
        </div>
      </div>

      {/* ── Zone C: Run Control ── */}
      <div className={`prism-run-control ${runState === 'locked' ? 'locked' : runState === 'ready' || runState === 'never' ? 'ready' : ''}`}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {runState === 'running' && (
            <>
              <div className="w-5 h-5 rounded-full border-2 border-violet-400 border-t-transparent animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">Analysing journeys…</p>
                <p className="text-xs text-surface-400">Do not navigate away</p>
              </div>
            </>
          )}
          {runState === 'locked' && (
            <>
              <span className="text-xl flex-shrink-0">🔒</span>
              <div>
                <p className="text-sm font-semibold text-surface-200">
                  Next run in {nextRunCountdown}
                </p>
                <p className="text-xs text-surface-400">
                  {nextRunDateTime} · {scheduleConfig.frequencyHours}h frequency
                </p>
              </div>
            </>
          )}
          {runState === 'ready' && (
            <>
              <span className="text-xl flex-shrink-0">✅</span>
              <div>
                <p className="text-sm font-semibold text-emerald-300">Analysis window is open</p>
                <p className="text-xs text-surface-400">Last run: {lastRunAgo}</p>
              </div>
            </>
          )}
          {runState === 'never' && (
            <>
              <span className="text-xl flex-shrink-0">🔮</span>
              <div>
                <p className="text-sm font-semibold text-white">No data yet</p>
                <p className="text-xs text-surface-400">Run your first analysis to generate intelligence packets</p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {runState === 'locked' && (
            <button
              onClick={() => setShowForceDialog(true)}
              className="btn-force-run"
            >
              Force Run — ${estimateCost.costUsd.toFixed(3)}
            </button>
          )}
          {(runState === 'ready' || runState === 'never') && (
            <button
              onClick={handleRunClick}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-lg shadow-emerald-600/25"
            >
              <RefreshCw className="w-4 h-4" />
              {runState === 'never' ? 'Run First Analysis' : 'Run Analysis'} — {estimateCost.formatted}
            </button>
          )}
          {runState === 'running' && (
            <div className="px-4 py-2 rounded-xl text-sm font-semibold bg-surface-700 text-surface-400 cursor-not-allowed">
              Running…
            </div>
          )}
        </div>
      </div>

      {/* ── Zone D: Data Tabs ── */}
      {!hasTabs ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">No intelligence data yet</div>
          <div className="empty-state-hint">Run an analysis to generate funnel metrics, intelligence packets, and content gap insights for your agent squad.</div>
        </div>
      ) : (
        <>
          {/* Tab nav */}
          <div className="flex gap-1 border-b border-surface-800 pb-0">
            {(['packets', 'funnel', 'gaps', 'paths'] as ActiveTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors capitalize ${
                  activeTab === tab
                    ? 'bg-surface-800 text-white border border-b-0 border-surface-700'
                    : 'text-surface-400 hover:text-white hover:bg-surface-900'
                }`}
              >
                {tab === 'packets' ? '🤖 Packets' : tab === 'funnel' ? '📊 Funnel' : tab === 'gaps' ? '📝 Gaps' : '🛤 Paths'}
              </button>
            ))}
          </div>

          {/* Packets tab */}
          {activeTab === 'packets' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {ALL_AGENTS.map((agent) => {
                const packet = getLatestPacket(agent);
                const meta = AGENT_META[agent];
                return (
                  <motion.div
                    key={agent}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mobile-card"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-base`}>
                        {meta.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{meta.name}</p>
                        {packet && <PriorityBadge priority={packet.priority} />}
                      </div>
                      {packet && (
                        <span className="text-[10px] text-surface-500">{formatTimeAgo(packet.generatedAt)}</span>
                      )}
                    </div>
                    {packet ? (
                      <>
                        <p className="text-xs text-surface-300 leading-relaxed mb-3 line-clamp-3">{packet.insight}</p>
                        <p className="text-xs text-surface-400 leading-relaxed mb-3 italic line-clamp-2">→ {packet.actionRequired}</p>
                        <div className="flex gap-2">
                          {packet.status === 'pending' && (
                            <button onClick={() => handleAck(packet.id)} className="text-xs px-2.5 py-1 rounded-lg bg-surface-700 hover:bg-surface-600 text-surface-300 transition-colors">Ack</button>
                          )}
                          {packet.status !== 'actioned' && (
                            <button onClick={() => handleAction(packet.id)} className="text-xs px-2.5 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 transition-colors">
                              Queue for Agent
                            </button>
                          )}
                          {packet.status === 'actioned' && (
                            <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✓ Queued</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-surface-600 italic">No packet yet — run analysis</p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Funnel tab */}
          {activeTab === 'funnel' && funnel && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Blog Views', value: funnel.blogViews, sub: 'entry points' },
                  { label: 'CTA Clicks', value: funnel.blogCtaClicks, sub: `${(funnel.ctaClickRate*100).toFixed(1)}% CTR` },
                  { label: 'Chat Sessions', value: funnel.chatSessions, sub: `${(funnel.chatToPracticeRate*100).toFixed(0)}% → Practice` },
                  { label: 'Return Rate', value: `${(funnel.returnRate*100).toFixed(0)}%`, sub: 'come back' },
                ].map((m) => (
                  <div key={m.label} className="kpi-card">
                    <p className="text-xs text-surface-400 font-medium mb-1">{m.label}</p>
                    <p className="text-2xl font-bold text-white">{m.value}</p>
                    <p className="text-xs text-surface-500 mt-0.5">{m.sub}</p>
                  </div>
                ))}
              </div>
              <div className="mobile-card">
                <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Top Drop-off</p>
                <p className="text-sm text-white">{funnel.topDropoffPoint}</p>
              </div>
            </div>
          )}

          {/* Gaps tab */}
          {activeTab === 'gaps' && (
            <div className="space-y-2">
              {(state?.contentGaps ?? []).map((gap, i) => (
                <div key={gap.topic} className="mobile-card flex items-center gap-4">
                  <span className="text-lg font-bold text-surface-600 w-6 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{gap.topic}</p>
                    <p className="text-xs text-surface-400">{gap.examType}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-amber-400">{gap.frequency}</p>
                    <p className="text-xs text-surface-500">queries</p>
                  </div>
                </div>
              ))}
              {(state?.contentGaps ?? []).length === 0 && (
                <div className="empty-state"><div className="empty-state-hint">No content gaps detected</div></div>
              )}
            </div>
          )}

          {/* Paths tab */}
          {activeTab === 'paths' && (
            <div className="space-y-2">
              {(state?.topEntryPaths ?? []).map((path, i) => (
                <div key={path.path} className="mobile-card flex items-center gap-4">
                  <span className="text-lg font-bold text-surface-600 w-6 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-surface-300 truncate">{path.path}</p>
                    <p className="text-xs text-surface-500">{path.count} sessions</p>
                  </div>
                  <div className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${conversionColor(path.conversionRate)}`}>
                    {(path.conversionRate * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Force Run Confirm Dialog */}
      <AnimatePresence>
        {showForceDialog && (
          <ForceRunDialog
            config={scheduleConfig}
            onConfirm={handleForceConfirm}
            onCancel={() => setShowForceDialog(false)}
          />
        )}
      </AnimatePresence>

      {/* Schedule Config Panel */}
      <AnimatePresence>
        {showSchedulePanel && (
          <SchedulePanel
            config={scheduleConfig}
            onSave={(patch) => {
              const updated = updateScheduleConfig(patch);
              setScheduleConfig(updated);
              setShowSchedulePanel(false);
            }}
            onClose={() => setShowSchedulePanel(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default PrismDashboard;
