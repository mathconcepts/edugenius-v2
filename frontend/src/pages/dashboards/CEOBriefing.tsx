/**
 * CEO Daily Briefing — /briefing
 *
 * The first thing Giri sees every morning.
 * 5 numbers, agent activity, decisions needed, 1 win.
 * Designed to be actionable in < 60 seconds.
 *
 * Now powered by live data from:
 *   - Cohort Insights (student personas)
 *   - Connection Registry (infrastructure status)
 *   - CEO Threshold Config (autonomy settings)
 *   - LLM Heuristics (AI cost estimate)
 *   - Opportunity Manifest (scouting results)
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Users,
  UserPlus,
  UserMinus,
  Bot,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Trophy,
  Clock,
  ChevronRight,
  Sparkles,
  Settings,
  Wifi,
  WifiOff,
  DollarSign,
  RefreshCw,
  Database,
} from 'lucide-react';
import { clsx } from 'clsx';
import { generateLiveBrief, LiveDecision } from '../../services/liveBriefing';
import { ExamLifecycleDashboard } from '../../components/ExamLifecycleDashboard';

// ── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon: Icon,
  change,
  subtext,
  color,
  delay,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  change?: number;
  subtext?: string;
  color: 'green' | 'red' | 'blue' | 'purple' | 'amber' | 'cyan';
  delay: number;
}) {
  const colorMap = {
    green: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
    red: 'from-red-500/20 to-red-500/5 border-red-500/20 text-red-400',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20 text-blue-400',
    purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/20 text-purple-400',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-400',
    cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/20 text-cyan-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={clsx(
        'relative rounded-2xl border bg-gradient-to-b p-5 overflow-hidden',
        colorMap[color],
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-surface-400 mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-1">
              {change >= 0 ? (
                <TrendingUp className="w-3 h-3 text-emerald-400" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-400" />
              )}
              <span
                className={clsx(
                  'text-xs font-medium',
                  change >= 0 ? 'text-emerald-400' : 'text-red-400',
                )}
              >
                {change > 0 ? '+' : ''}
                {change}%
              </span>
            </div>
          )}
          {subtext && (
            <p className="text-[10px] text-surface-500 mt-1">{subtext}</p>
          )}
        </div>
        <Icon className={clsx('w-8 h-8 opacity-60', colorMap[color].split(' ')[3])} />
      </div>
    </motion.div>
  );
}

function AgentCard({
  agent,
  summary,
  count,
  delay,
}: {
  agent: string;
  summary: string;
  count: number;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="flex items-center gap-4 px-4 py-3.5 rounded-xl bg-surface-800/40 border border-surface-700/30 hover:border-surface-600/50 transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-surface-700/60 flex items-center justify-center text-lg flex-shrink-0">
        {agent.split(' ')[1] ?? '🤖'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{agent.split(' ')[0]}</p>
        <p className="text-xs text-surface-400 leading-snug">{summary}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <span className="text-sm font-bold text-surface-300">
          {count.toLocaleString('en-IN')}
        </span>
        <p className="text-[10px] text-surface-500">actions</p>
      </div>
    </motion.div>
  );
}

const urgencyConfig = {
  must_decide: {
    label: 'Must Decide',
    className: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: AlertCircle,
  },
  nice_to_decide: {
    label: 'Optional',
    className: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    icon: AlertTriangle,
  },
  agents_handle: {
    label: 'Agents Handle',
    className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    icon: CheckCircle2,
  },
};

function DecisionCard({
  decision: d,
  delay,
}: {
  decision: LiveDecision;
  delay: number;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const urg = urgencyConfig[d.urgency];
  const UrgIcon = urg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="rounded-2xl border border-surface-700/40 bg-surface-800/30 p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold',
              urg.className,
            )}
          >
            <UrgIcon className="w-3 h-3" />
            {urg.label}
          </span>
          <span className="text-xs text-surface-500">from {d.from}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-surface-500">
          <Clock className="w-3 h-3" />
          {d.expiresIn} left
        </div>
      </div>

      <p className="text-sm text-surface-200 mb-4 leading-relaxed">{d.decision}</p>

      {chosen ? (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          <span>Decision recorded: {chosen}</span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {d.options.map(opt => (
            <button
              key={opt}
              onClick={() => setChosen(opt)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                opt === d.options[0]
                  ? 'bg-primary-500/20 text-primary-400 border-primary-500/30 hover:bg-primary-500/30'
                  : 'bg-surface-700/50 text-surface-300 border-surface-600/30 hover:bg-surface-700 hover:text-white',
              )}
            >
              {opt}
            </button>
          ))}
          <button
            onClick={() => setChosen('Let agents handle')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-surface-600/20 text-surface-500 hover:text-surface-300 transition-all"
          >
            Let agents handle →
          </button>
        </div>
      )}

      {!chosen && (
        <p className="mt-3 text-[11px] text-surface-600">
          🤖 Default if silent: {d.defaultIfNoResponse}
        </p>
      )}
    </motion.div>
  );
}

const alertConfig = {
  critical: { className: 'border-red-500/40 bg-red-500/10', icon: AlertCircle, color: 'text-red-400' },
  warning: { className: 'border-amber-500/40 bg-amber-500/10', icon: AlertTriangle, color: 'text-amber-400' },
  info: { className: 'border-blue-500/40 bg-blue-500/10', icon: Info, color: 'text-blue-400' },
};

// ── AI Status Badge ───────────────────────────────────────────────────────────

function AIStatusBadge({ aiLive, costUsd }: { aiLive: boolean; costUsd: number }) {
  return (
    <div className={clsx(
      'flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium',
      aiLive
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    )}>
      {aiLive ? (
        <Wifi className="w-3.5 h-3.5" />
      ) : (
        <WifiOff className="w-3.5 h-3.5" />
      )}
      {aiLive ? `AI Live · ~$${costUsd}/day` : 'Demo Mode — No AI Key'}
    </div>
  );
}

// ── Data Sources Strip ────────────────────────────────────────────────────────

function DataSourceStrip({ sources }: { sources: string[] }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="flex items-center gap-2 flex-wrap"
    >
      <Database className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />
      <span className="text-[10px] text-surface-500">Powered by:</span>
      {sources.map(src => (
        <span
          key={src}
          className="px-2 py-0.5 rounded-full bg-surface-700/50 text-[10px] text-surface-400 border border-surface-600/30"
        >
          {src}
        </span>
      ))}
    </motion.div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function CEOBriefing() {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  // Compute live brief from real available data
  // Memoized per refreshKey — re-runs when user hits refresh
  const brief = useMemo(() => generateLiveBrief(), [refreshKey]);

  const m = brief.metrics;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-accent-400" />
            <span className="text-xs font-semibold text-accent-400 uppercase tracking-widest">
              Daily Brief
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">Good morning, Giri 👋</h1>
          <p className="text-sm text-surface-400 mt-0.5">{brief.date}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <Bot className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">Oracle generated this</span>
          </div>
          <p className="text-[11px] text-surface-500">
            {brief.generatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} UTC
          </p>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="flex items-center gap-1 text-[11px] text-surface-500 hover:text-surface-300 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* AI Status + Data Sources */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <AIStatusBadge aiLive={m.aiLive} costUsd={m.estimatedAiCostUsd} />
        <DataSourceStrip sources={brief.dataSourceLabels} />
      </div>

      {/* ── 6 Metrics strip ── */}
      <section>
        <p className="text-xs font-semibold text-surface-500 uppercase tracking-widest mb-3">
          Platform Pulse
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard
            label="Total Students"
            value={m.activeStudents.toLocaleString('en-IN')}
            icon={Users}
            subtext="Personas loaded"
            color="blue"
            delay={0.05}
          />
          <MetricCard
            label="New Signups"
            value={`+${m.newSignups}`}
            icon={UserPlus}
            color="purple"
            delay={0.1}
          />
          <MetricCard
            label="At Risk"
            value={m.atRiskStudents.toLocaleString('en-IN')}
            icon={UserMinus}
            subtext="Struggling tier"
            color="red"
            delay={0.15}
          />
          <MetricCard
            label="Avg Syllabus"
            value={`${m.avgSyllabusPercent}%`}
            icon={TrendingUp}
            subtext="Cohort completion"
            color="green"
            delay={0.18}
          />
          <MetricCard
            label="Days to Exam"
            value={`${m.avgDaysToExam}d`}
            icon={Clock}
            subtext="Median across cohort"
            color={m.avgDaysToExam < 30 ? 'red' : m.avgDaysToExam < 60 ? 'amber' : 'cyan'}
            delay={0.21}
          />
          <MetricCard
            label="AI Cost / Day"
            value={`$${m.estimatedAiCostUsd}`}
            icon={DollarSign}
            subtext="500 student sessions"
            color="amber"
            delay={0.24}
          />
        </div>
      </section>

      {/* ── Connections status strip ── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="rounded-xl border border-surface-700/30 bg-surface-800/20 px-4 py-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={clsx(
                'w-2 h-2 rounded-full',
                m.connectionsConfigured > 10 ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse',
              )} />
              <span className="text-xs font-medium text-surface-300">
                Infrastructure: {m.connectionsConfigured}/{m.connectionTotal} connections configured
              </span>
            </div>
            {m.opportunityExam && (
              <span className="text-xs text-accent-400 font-medium">
                · Scouting: {m.opportunityExam}
              </span>
            )}
          </div>
          <button
            onClick={() => navigate('/connections')}
            className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
          >
            Configure
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1 rounded-full bg-surface-700/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-700"
            style={{ width: `${Math.min(100, (m.connectionsConfigured / m.connectionTotal) * 100)}%` }}
          />
        </div>
      </motion.section>

      {/* ── Agent activity overnight ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-widest">
            What Your Agents Did Overnight
          </p>
          <span className="text-[11px] text-surface-600">No action needed</span>
        </div>
        <div className="space-y-2">
          {brief.agentActivity.map((a, i) => (
            <AgentCard
              key={a.agent}
              agent={a.agent}
              summary={a.summary}
              count={a.count}
              delay={0.3 + i * 0.06}
            />
          ))}
        </div>
      </section>

      {/* ── Decisions needed ── */}
      {brief.decisions.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-widest">
              Decisions Needed
            </p>
            <span className="text-[11px] text-surface-600">
              Agents execute default after 24h if no response
            </span>
          </div>
          <div className="space-y-3">
            {brief.decisions.map((d, i) => (
              <DecisionCard key={d.id} decision={d} delay={0.55 + i * 0.08} />
            ))}
          </div>
        </section>
      )}

      {/* ── Live Exams — Orchestrator Dashboard ── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
      >
        <ExamLifecycleDashboard />
      </motion.section>

      {/* ── Today's win ── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-orange-500/5 p-5"
      >
        <div className="flex items-start gap-3">
          <Trophy className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-1">
              Today's Win
            </p>
            <p className="text-sm text-surface-200 leading-relaxed">{brief.highlight.message}</p>
          </div>
        </div>
      </motion.section>

      {/* ── Alerts ── */}
      {brief.alerts.length > 0 && (
        <section className="space-y-2">
          {brief.alerts.map((alert, i) => {
            const cfg = alertConfig[alert.severity];
            const AlertIcon = cfg.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.75 + i * 0.05 }}
                className={clsx(
                  'flex items-start gap-3 rounded-xl border p-3.5',
                  cfg.className,
                )}
              >
                <AlertIcon className={clsx('w-4 h-4 flex-shrink-0 mt-0.5', cfg.color)} />
                <div>
                  <p className={clsx('text-xs font-semibold capitalize mb-0.5', cfg.color)}>
                    {alert.severity}
                  </p>
                  <p className="text-xs text-surface-300">{alert.message}</p>
                  <p className="text-[11px] text-surface-500 mt-1">
                    Suggested: {alert.suggestedAction}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </section>
      )}

      {/* ── Autonomy Settings Link ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85 }}
        className="flex items-center justify-between rounded-xl border border-surface-700/30 bg-surface-800/20 px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-surface-500" />
          <span className="text-xs text-surface-400">
            Control what your agents decide autonomously vs escalate to you
          </span>
        </div>
        <button
          onClick={() => navigate('/autonomy-settings')}
          className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium"
        >
          Configure autonomy thresholds
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </motion.div>

      {/* ── Footer ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="flex items-center justify-between pt-4 border-t border-surface-700/30"
      >
        <p className="text-[11px] text-surface-600">
          Next brief in ~{Math.floor(Math.random() * 4 + 18)}h · Powered by cohort + connection data
        </p>
        <button
          onClick={() => navigate('/exam-analytics')}
          className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-300 transition-colors"
        >
          Full analytics
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    </div>
  );
}
