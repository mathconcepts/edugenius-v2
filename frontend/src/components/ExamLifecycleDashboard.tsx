/**
 * ExamLifecycleDashboard.tsx
 *
 * Real-time CEO view of all active exam lifecycles and their agent status.
 * Shows phase, agent health, content/marketing stats, and a live signal log.
 *
 * Props: { examId?: string }
 *   - If examId is provided → shows that one exam in detail
 *   - Otherwise → shows all active lifecycles in a summary list
 *
 * AUDIT NOTE: No active route imports this component yet — kept intentionally.
 * // DEBT: add to CEOBriefing or create /lifecycle route for CEO
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Activity,
  BookOpen,
  Cpu,
  BarChart3,
  Megaphone,
  GraduationCap,
  Search,
  Users,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  getAllLifecycles,
  getExamLifecycleState,
  type ExamLifecycleState,
  type AgentId,
  type ExamLifecyclePhase,
  type AgentLifecycleStatus,
} from '@/services/examOrchestrator';

// ─── Agent display config ─────────────────────────────────────────────────────

interface AgentMeta {
  label: string;
  emoji: string;
  icon: React.ElementType;
  color: string;
  borderColor: string;
}

const AGENT_META: Record<AgentId, AgentMeta> = {
  scout: {
    label: 'Scout',
    emoji: '🔍',
    icon: Search,
    color: 'text-sky-400',
    borderColor: 'border-sky-500/30',
  },
  atlas: {
    label: 'Atlas',
    emoji: '📚',
    icon: BookOpen,
    color: 'text-fuchsia-400',
    borderColor: 'border-fuchsia-500/30',
  },
  sage: {
    label: 'Sage',
    emoji: '🎓',
    icon: GraduationCap,
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
  },
  forge: {
    label: 'Forge',
    emoji: '⚙️',
    icon: Cpu,
    color: 'text-violet-400',
    borderColor: 'border-violet-500/30',
  },
  herald: {
    label: 'Herald',
    emoji: '📢',
    icon: Megaphone,
    color: 'text-red-400',
    borderColor: 'border-red-500/30',
  },
  oracle: {
    label: 'Oracle',
    emoji: '📊',
    icon: BarChart3,
    color: 'text-cyan-400',
    borderColor: 'border-cyan-500/30',
  },
  mentor: {
    label: 'Mentor',
    emoji: '👨‍🏫',
    icon: Users,
    color: 'text-amber-400',
    borderColor: 'border-amber-500/30',
  },
};

const AGENT_ORDER: AgentId[] = [
  'scout', 'atlas', 'sage', 'forge', 'herald', 'oracle', 'mentor',
];

// ─── Phase config ─────────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<
  ExamLifecyclePhase,
  { label: string; color: string; bgColor: string }
> = {
  approved: {
    label: 'APPROVED',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
  },
  content_building: {
    label: 'CONTENT',
    color: 'text-fuchsia-400',
    bgColor: 'bg-fuchsia-500/10 border-fuchsia-500/20',
  },
  verifying: {
    label: 'VERIFYING',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20',
  },
  deploying: {
    label: 'DEPLOYING',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10 border-violet-500/20',
  },
  marketing: {
    label: 'MARKETING',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/20',
  },
  live: {
    label: 'LIVE 🟢',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20',
  },
  optimizing: {
    label: 'OPTIMIZING',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10 border-cyan-500/20',
  },
};

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AgentLifecycleStatus['status'] }) {
  const map = {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    waiting: 'bg-surface-700/50 text-surface-400 border-surface-600/30',
    idle: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
  } as const;

  return (
    <span
      className={clsx(
        'px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide shrink-0',
        map[status],
      )}
    >
      {status === 'active' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />}
      {status}
    </span>
  );
}

// ─── Agent row ────────────────────────────────────────────────────────────────

function AgentRow({ agentId, status }: { agentId: AgentId; status: AgentLifecycleStatus }) {
  const meta = AGENT_META[agentId];

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors',
        meta.borderColor,
        status.status === 'active'
          ? 'bg-surface-800/60'
          : 'bg-surface-800/20',
      )}
    >
      <span className="text-base shrink-0">{meta.emoji}</span>
      <span className={clsx('text-sm font-semibold w-16 shrink-0', meta.color)}>
        {meta.label}
      </span>
      <StatusBadge status={status.status} />
      <p className="text-xs text-surface-400 flex-1 min-w-0 truncate">
        {status.lastAction}
      </p>
      {status.pendingSignals > 0 && (
        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] border border-amber-500/30 shrink-0">
          {status.pendingSignals} pending
        </span>
      )}
    </div>
  );
}

// ─── Signal log entry ─────────────────────────────────────────────────────────

function SignalLogRow({
  entry,
  index,
}: {
  entry: ExamLifecycleState['signalLog'][0];
  index: number;
}) {
  const time = new Date(entry.timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-start gap-2 py-1.5 border-b border-surface-700/20 last:border-0"
    >
      <span className="text-[10px] text-surface-500 shrink-0 mt-0.5 w-10">{time}</span>
      <span className="text-[10px] font-mono text-sky-400 shrink-0">
        {entry.from}→{entry.to}
      </span>
      <span className="text-[10px] text-surface-400 flex-1 min-w-0">{entry.summary}</span>
    </motion.div>
  );
}

// ─── Health score ring ────────────────────────────────────────────────────────

function HealthRing({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'text-emerald-400'
      : score >= 60
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <div className="flex flex-col items-center">
      <div
        className={clsx(
          'text-2xl font-bold tabular-nums',
          color,
        )}
      >
        {score}
      </div>
      <div className="text-[10px] text-surface-500 uppercase tracking-wide">health</div>
    </div>
  );
}

// ─── Single exam lifecycle card ───────────────────────────────────────────────

function ExamLifecycleCard({
  lifecycle,
  defaultExpanded,
}: {
  lifecycle: ExamLifecycleState;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const phase = PHASE_CONFIG[lifecycle.phase];
  const activeAgentCount = AGENT_ORDER.filter(
    (id) => lifecycle.agentStatus[id]?.status === 'active',
  ).length;

  const approvedDate = new Date(lifecycle.approvedAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="mobile-card rounded-2xl border border-surface-700/30 bg-surface-800/40 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-4 flex items-center gap-3 hover:bg-surface-700/20 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-lg">📡</span>
            <h3 className="font-bold text-white text-sm truncate">{lifecycle.examName}</h3>
            <span
              className={clsx(
                'px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide',
                phase.bgColor,
                phase.color,
              )}
            >
              {phase.label}
            </span>
          </div>
          <p className="text-[11px] text-surface-500">
            Approved {approvedDate} · {activeAgentCount}/7 agents active
          </p>
        </div>
        <HealthRing score={lifecycle.healthScore} />
        {expanded ? (
          <ChevronDown size={16} className="text-surface-500 shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-surface-500 shrink-0" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-surface-700/30 pt-3">
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatChip
                  label="Generated"
                  value={lifecycle.contentStats.totalGenerated}
                  icon={<BookOpen size={12} />}
                  color="fuchsia"
                />
                <StatChip
                  label="Verified"
                  value={lifecycle.contentStats.totalVerified}
                  icon={<CheckCircle2 size={12} />}
                  color="emerald"
                />
                <StatChip
                  label="Campaigns"
                  value={lifecycle.marketingStats.campaignsLive}
                  icon={<Megaphone size={12} />}
                  color="red"
                />
                <StatChip
                  label="Enrolled"
                  value={lifecycle.marketingStats.studentsEnrolled}
                  icon={<Users size={12} />}
                  color="amber"
                />
              </div>

              {/* Churn risk alert */}
              {lifecycle.marketingStats.weeklyChurnRisks > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertTriangle size={14} className="text-red-400 shrink-0" />
                  <p className="text-xs text-red-300">
                    {lifecycle.marketingStats.weeklyChurnRisks} students at churn risk this week
                  </p>
                </div>
              )}

              {/* Agent status rows */}
              <div>
                <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-widest mb-2">
                  Agent Status
                </p>
                <div className="space-y-1.5">
                  {AGENT_ORDER.map((id) => (
                    <AgentRow
                      key={id}
                      agentId={id}
                      status={
                        lifecycle.agentStatus[id] ?? {
                          agentId: id,
                          status: 'waiting',
                          lastAction: 'Not yet activated',
                          lastActionAt: lifecycle.approvedAt,
                          pendingSignals: 0,
                        }
                      }
                    />
                  ))}
                </div>
              </div>

              {/* Signal log */}
              {lifecycle.signalLog.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Activity size={10} />
                    Recent Activity
                  </p>
                  <div className="bg-surface-900/40 rounded-xl px-3 py-2 max-h-40 overflow-y-auto">
                    {[...lifecycle.signalLog]
                      .reverse()
                      .slice(0, 10)
                      .map((entry, i) => (
                        <SignalLogRow key={i} entry={entry} index={i} />
                      ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'fuchsia' | 'emerald' | 'red' | 'amber';
}) {
  const colorMap = {
    fuchsia: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  };

  return (
    <div
      className={clsx(
        'rounded-lg border px-3 py-2 flex flex-col items-center gap-0.5',
        colorMap[color],
      )}
    >
      <div className={clsx('flex items-center gap-1', colorMap[color].split(' ')[0])}>
        {icon}
        <span className="text-base font-bold tabular-nums">{value}</span>
      </div>
      <p className="text-[10px] text-surface-500">{label}</p>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="text-center py-8 px-4">
      <div className="w-12 h-12 rounded-full bg-surface-700/50 flex items-center justify-center mx-auto mb-3">
        <Zap size={20} className="text-surface-500" />
      </div>
      <p className="text-sm font-medium text-surface-400">No active exam lifecycles</p>
      <p className="text-xs text-surface-600 mt-1">
        Approve an exam in the Exam Creation Wizard to start the automated pipeline
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ExamLifecycleDashboardProps {
  /** Optional: show a specific exam. If omitted, shows all active lifecycles. */
  examId?: string;
}

export function ExamLifecycleDashboard({ examId }: ExamLifecycleDashboardProps) {
  const [lifecycles, setLifecycles] = useState<ExamLifecycleState[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    try {
      if (examId) {
        const single = getExamLifecycleState(examId);
        setLifecycles(single ? [single] : []);
      } else {
        setLifecycles(getAllLifecycles());
      }
      setLastRefreshed(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, [examId]);

  // Initial load + auto-refresh every 30s
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const totalActive = lifecycles.filter((l) => l.phase === 'live' || l.phase === 'optimizing').length;
  const totalApproved = lifecycles.length;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-400" />
          <h2 className="text-sm font-bold text-white">Live Exams</h2>
          {totalApproved > 0 && (
            <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full">
              {totalActive} LIVE · {totalApproved} TOTAL
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-surface-600 flex items-center gap-1">
            <Clock size={10} />
            {lastRefreshed.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <button
            onClick={refresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg hover:bg-surface-700/50 text-surface-500 hover:text-surface-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={clsx(isRefreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Content */}
      {lifecycles.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {lifecycles.map((lc, i) => (
              <motion.div
                key={lc.examId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: i * 0.05 }}
              >
                <ExamLifecycleCard
                  lifecycle={lc}
                  defaultExpanded={lifecycles.length === 1}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default ExamLifecycleDashboard;
