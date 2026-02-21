/**
 * PrismDashboard — Journey Intelligence Hub
 * CEO + Admin only
 * Route: /prism
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  RefreshCw,
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
} from 'lucide-react';
import {
  runPrismAnalysis,
  loadPrismState,
  acknowledgePacket,
  actionPacket,
  type PrismState,
  type IntelligencePacket,
  type PrismTargetAgent,
} from '@/services/prismBridge';

// ── Agent definitions ─────────────────────────────────────────────────────────

const AGENT_META: Record<
  PrismTargetAgent,
  { emoji: string; name: string; color: string; icon: typeof Brain }
> = {
  sage: { emoji: '🎓', name: 'Sage', color: 'from-violet-500 to-purple-600', icon: Brain },
  atlas: { emoji: '📚', name: 'Atlas', color: 'from-blue-500 to-cyan-600', icon: BookOpen },
  herald: { emoji: '📢', name: 'Herald', color: 'from-orange-500 to-amber-600', icon: MessageSquare },
  scout: { emoji: '🔍', name: 'Scout', color: 'from-green-500 to-emerald-600', icon: TrendingUp },
  mentor: { emoji: '👨‍🏫', name: 'Mentor', color: 'from-pink-500 to-rose-600', icon: Users },
  oracle: { emoji: '📊', name: 'Oracle', color: 'from-indigo-500 to-blue-600', icon: BarChart3 },
  forge: { emoji: '⚙️', name: 'Forge', color: 'from-zinc-500 to-slate-600', icon: Zap },
};

const ALL_AGENTS: PrismTargetAgent[] = ['sage', 'atlas', 'herald', 'scout', 'mentor', 'oracle', 'forge'];

// ── Priority badge ────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: IntelligencePacket['priority'] }) {
  const config = {
    critical: 'bg-red-500/20 text-red-300 border-red-500/40',
    high: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    medium: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    low: 'bg-surface-700 text-surface-400 border-surface-600',
  }[priority];

  return (
    <span className={'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ' + config}>
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

interface FunnelStageProps {
  label: string;
  count: number;
  rate?: number;
  rateLabel?: string;
  icon: React.ReactNode;
  isLast?: boolean;
}

function FunnelStage({ label, count, rate, rateLabel, icon, isLast }: FunnelStageProps) {
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 min-w-0">
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 text-center">
          <div className="flex justify-center mb-2 text-surface-400">{icon}</div>
          <p className="text-xs text-surface-400 mb-1 font-medium">{label}</p>
          <p className="text-2xl font-bold text-white">{count.toLocaleString()}</p>
          {rate !== undefined && (
            <div className={'mt-2 inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ' + conversionColor(rate)}>
              {rateLabel || (rate * 100).toFixed(1) + '%'}
            </div>
          )}
        </div>
      </div>
      {!isLast && (
        <ArrowRight className="w-5 h-5 text-surface-600 flex-shrink-0" />
      )}
    </div>
  );
}

// ── Intelligence Card ─────────────────────────────────────────────────────────

interface IntelCardProps {
  agent: PrismTargetAgent;
  packet: IntelligencePacket | undefined;
  onAck: (id: string) => void;
  onAction: (id: string) => void;
}

function IntelCard({ agent, packet, onAck, onAction }: IntelCardProps) {
  const meta = AGENT_META[agent];
  const AgentIcon = meta.icon;

  const glowClass =
    packet?.priority === 'critical'
      ? 'ring-2 ring-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
      : packet?.priority === 'high'
      ? 'ring-1 ring-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.1)]'
      : '';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={'bg-surface-800 border border-surface-700 rounded-2xl p-4 flex flex-col gap-3 ' + glowClass}
    >
      {/* Agent header */}
      <div className="flex items-center gap-3">
        <div className={'w-10 h-10 rounded-xl bg-gradient-to-br ' + meta.color + ' flex items-center justify-center text-lg flex-shrink-0'}>
          {meta.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">{meta.name}</p>
          {packet && (
            <p className="text-[10px] text-surface-500">{packet.subAgent}</p>
          )}
        </div>
        {packet && <PriorityBadge priority={packet.priority} />}
      </div>

      {packet ? (
        <>
          {/* Signal type */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface-700 text-surface-400 border border-surface-600 font-mono">
              {packet.signalType}
            </span>
          </div>

          {/* Insight */}
          <p className="text-sm text-surface-200 leading-relaxed">{packet.insight}</p>

          {/* Action required */}
          <div className="bg-surface-700/50 rounded-xl p-3 border border-surface-600/50">
            <p className="text-[10px] text-primary-400 font-semibold uppercase tracking-wider mb-1.5">
              Action Required
            </p>
            <p className="text-xs text-surface-300 leading-relaxed">{packet.actionRequired}</p>
          </div>

          {/* Buttons */}
          {packet.status === 'pending' && (
            <div className="flex gap-2">
              <button
                onClick={() => onAck(packet.id)}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-surface-700 hover:bg-surface-600 text-surface-300 transition-colors font-medium"
              >
                Acknowledge
              </button>
              <button
                onClick={() => onAction(packet.id)}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-primary-500/20 hover:bg-primary-500/30 text-primary-300 border border-primary-500/30 transition-colors font-medium"
              >
                Mark Actioned
              </button>
            </div>
          )}
          {packet.status === 'acknowledged' && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <AlertCircle className="w-3.5 h-3.5" />
              Acknowledged — awaiting action
              <button
                onClick={() => onAction(packet.id)}
                className="ml-auto px-2 py-1 text-[10px] rounded bg-surface-700 hover:bg-surface-600 text-surface-300 transition-colors"
              >
                Mark Done
              </button>
            </div>
          )}
          {packet.status === 'actioned' && (
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <CheckCircle className="w-3.5 h-3.5" />
              Actioned ✓
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

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function PrismDashboard() {
  const navigate = useNavigate();
  const [state, setState] = useState<PrismState | null>(null);
  const [running, setRunning] = useState(false);

  // Load cached state on mount
  useEffect(() => {
    const cached = loadPrismState();
    if (cached) setState(cached);
  }, []);

  const handleRunAnalysis = useCallback(async () => {
    setRunning(true);
    try {
      const result = runPrismAnalysis();
      setState(result);
    } finally {
      setRunning(false);
    }
  }, []);

  // Auto-run if no state
  useEffect(() => {
    if (!state) handleRunAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAck = useCallback(
    (id: string) => {
      acknowledgePacket(id);
      setState(loadPrismState());
    },
    [],
  );

  const handleAction = useCallback(
    (id: string) => {
      actionPacket(id);
      setState(loadPrismState());
    },
    [],
  );

  const funnel = state?.funnelMetrics;
  const packets = state?.intelligencePackets ?? [];

  const getLatestPacket = (agent: PrismTargetAgent): IntelligencePacket | undefined =>
    packets
      .filter((p) => p.targetAgent === agent)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())[0];

  return (
    <div className="min-h-screen p-6 space-y-8 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-xl shadow-lg">
              🔮
            </div>
            <h1 className="text-2xl font-bold text-white">
              Prism{' '}
              <span className="text-surface-400 font-normal text-lg">— Journey Intelligence</span>
            </h1>
          </div>
          <p className="text-surface-400 text-sm ml-13">
            Real-time intelligence from all user journeys, distributed to your agent squad
          </p>
          <div className="flex items-center gap-3 mt-2 ml-13">
            {state && (
              <span className="text-[11px] text-surface-500">
                Last run: {new Date(state.lastRunAt).toLocaleTimeString()}
              </span>
            )}
            {state?.isMockData && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Demo data
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleRunAnalysis}
          disabled={running}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary-500/25"
        >
          <RefreshCw className={'w-4 h-4 ' + (running ? 'animate-spin' : '')} />
          {running ? 'Analysing…' : 'Run Analysis'}
        </button>
      </div>

      <AnimatePresence>
        {state && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* ── Section 1: Journey Flow Sankey ── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-primary-400" />
                <h2 className="text-sm font-semibold text-surface-200 uppercase tracking-wider">
                  Journey Flow
                </h2>
              </div>
              <div className="bg-surface-800/50 border border-surface-700 rounded-2xl p-5">
                <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
                  <FunnelStage
                    label="Blog Views"
                    count={funnel?.blogViews ?? 0}
                    icon={<BookOpen className="w-5 h-5" />}
                  />
                  <FunnelStage
                    label="CTA Clicks"
                    count={funnel?.blogCtaClicks ?? 0}
                    rate={funnel?.ctaClickRate}
                    rateLabel={(((funnel?.ctaClickRate ?? 0) * 100).toFixed(1)) + '% CTR'}
                    icon={<Target className="w-5 h-5" />}
                  />
                  <FunnelStage
                    label="Chat Sessions"
                    count={funnel?.chatSessions ?? 0}
                    rate={funnel?.chatToPracticeRate}
                    rateLabel={(((funnel?.chatToPracticeRate ?? 0) * 100).toFixed(0)) + '% → Practice'}
                    icon={<MessageSquare className="w-5 h-5" />}
                  />
                  <FunnelStage
                    label="Practice"
                    count={funnel?.practiceAttempts ?? 0}
                    rate={funnel?.returnRate}
                    rateLabel={(((funnel?.returnRate ?? 0) * 100).toFixed(0)) + '% Return'}
                    icon={<Zap className="w-5 h-5" />}
                  />
                  <FunnelStage
                    label="Returned"
                    count={funnel?.practiceReturns ?? 0}
                    icon={<TrendingUp className="w-5 h-5" />}
                    isLast
                  />
                </div>

                {/* Top dropoff callout */}
                {funnel && funnel.topDropoffPoint !== 'none' && (
                  <div className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/8 border border-red-500/20">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-xs text-red-300">
                      Top drop-off point:{' '}
                      <span className="font-semibold">{funnel.topDropoffPoint.replace(/_/g, ' ')}</span>
                      {' '}— consider optimising this step
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* ── Section 2: Intelligence Packets ── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-primary-400" />
                <h2 className="text-sm font-semibold text-surface-200 uppercase tracking-wider">
                  Intelligence Packets
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-700 text-surface-400 border border-surface-600">
                  {packets.filter((p) => p.status === 'pending').length} pending
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {ALL_AGENTS.map((agent) => (
                  <IntelCard
                    key={agent}
                    agent={agent}
                    packet={getLatestPacket(agent)}
                    onAck={handleAck}
                    onAction={handleAction}
                  />
                ))}
              </div>
            </section>

            {/* ── Section 3: Content Gaps ── */}
            {state.contentGaps.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-4 h-4 text-primary-400" />
                  <h2 className="text-sm font-semibold text-surface-200 uppercase tracking-wider">
                    Content Gaps
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/25">
                    {state.contentGaps.length} gaps
                  </span>
                </div>

                <div className="bg-surface-800/50 border border-surface-700 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-700">
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-surface-400 uppercase tracking-wider">
                          Topic
                        </th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-surface-400 uppercase tracking-wider">
                          Frequency
                        </th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-surface-400 uppercase tracking-wider">
                          Exam
                        </th>
                        <th className="px-5 py-3 text-right text-[11px] font-semibold text-surface-400 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.contentGaps.map((gap, idx) => (
                        <motion.tr
                          key={gap.topic}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="border-b border-surface-700/50 hover:bg-surface-700/30 transition-colors"
                        >
                          <td className="px-5 py-3.5 font-medium text-white">
                            {gap.topic}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-1.5 rounded-full bg-primary-500/60"
                                style={{
                                  width: Math.min(
                                    120,
                                    (gap.frequency /
                                      (state.contentGaps[0]?.frequency || 1)) *
                                      120,
                                  ),
                                }}
                              />
                              <span className="text-surface-300 text-xs">
                                {gap.frequency} queries
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-surface-700 text-surface-300 border border-surface-600">
                              {gap.examType}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() =>
                                navigate(
                                  '/content-intelligence?topic=' +
                                    encodeURIComponent(gap.topic) +
                                    '&exam=' +
                                    encodeURIComponent(gap.examType),
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/15 hover:bg-primary-500/25 text-primary-300 border border-primary-500/25 transition-colors"
                            >
                              Create Content
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── Section 4: Top Entry Paths ── */}
            {state.topEntryPaths.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Bot className="w-4 h-4 text-primary-400" />
                  <h2 className="text-sm font-semibold text-surface-200 uppercase tracking-wider">
                    Top Entry Paths
                  </h2>
                </div>

                <div className="space-y-3">
                  {state.topEntryPaths.map((ep, idx) => (
                    <motion.div
                      key={ep.path}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-surface-800/50 border border-surface-700 rounded-xl px-5 py-4 flex items-center gap-4"
                    >
                      <span className="text-surface-500 text-xs font-mono w-5 text-center flex-shrink-0">
                        {idx + 1}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{ep.path}</p>
                        <p className="text-xs text-surface-500 mt-0.5">
                          {ep.count} sessions
                        </p>
                      </div>

                      {/* Conversion bar */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="w-24 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                          <div
                            className={
                              'h-full rounded-full ' +
                              (ep.conversionRate > 0.2
                                ? 'bg-green-500'
                                : ep.conversionRate > 0.1
                                ? 'bg-amber-500'
                                : 'bg-red-500')
                            }
                            style={{ width: Math.round(ep.conversionRate * 100) + '%' }}
                          />
                        </div>
                        <span
                          className={
                            'text-sm font-bold ' +
                            (ep.conversionRate > 0.2
                              ? 'text-green-400'
                              : ep.conversionRate > 0.1
                              ? 'text-amber-400'
                              : 'text-red-400')
                          }
                        >
                          {(ep.conversionRate * 100).toFixed(0)}%
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <p className="mt-3 text-xs text-surface-500 text-center">
                  Conversion = sessions that reached chat or completed a practice set
                </p>
              </section>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      {!state && running && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-2xl animate-pulse">
            🔮
          </div>
          <p className="text-surface-400 text-sm">Analysing all user journeys…</p>
        </div>
      )}
    </div>
  );
}
