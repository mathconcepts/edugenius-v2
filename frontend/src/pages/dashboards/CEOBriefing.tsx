/**
 * CEO Daily Briefing — /briefing
 *
 * The first thing Giri sees every morning.
 * 5 numbers, agent activity, decisions needed, 1 win.
 * Designed to be actionable in < 60 seconds.
 */

import { useState } from 'react';
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
  IndianRupee,
  Settings,
} from 'lucide-react';
import { clsx } from 'clsx';

// ── Mock data (Oracle will feed real data via API) ───────────────────────────

const mockBrief = {
  date: new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }),
  generatedAt: new Date(),
  metrics: {
    mrrINR: 284000,
    mrrChange: 4.2,
    activeStudents: 12847,
    newSignups: 143,
    churnedToday: 8,
  },
  agentActivity: [
    { agent: 'Scout 🔍', summary: 'Found 3 trending JEE topics; queued for Herald', count: 3 },
    { agent: 'Herald 📢', summary: 'Published 2 blog posts; 40% avg open rate on emails', count: 14 },
    { agent: 'Mentor 👨‍🏫', summary: 'Onboarded 143 new students; sent 47 re-engagement nudges', count: 190 },
    { agent: 'Oracle 📊', summary: 'A/B test concluded: Variant B wins — rolling out to 100%', count: 1 },
    { agent: 'Sage 🎓', summary: 'Answered 2,341 tutor queries; avg session 12 min', count: 2341 },
    { agent: 'Atlas 📚', summary: 'Generated 5 practice sets for NEET Biology', count: 5 },
  ],
  pendingDecisions: [
    {
      id: 'pd_001',
      from: 'Scout',
      decision: 'Add CUET to exam catalogue — Scout found 18K monthly searches, low competition',
      options: ['Launch Now', 'Launch Next Month', 'Skip'],
      defaultIfNoResponse: 'Agents will begin content prep for next month launch',
      urgency: 'nice_to_decide' as const,
      expiresIn: '22h 14m',
    },
    {
      id: 'pd_002',
      from: 'Oracle',
      decision: 'Increase Pro plan by ₹50 (₹299→₹349) — conversion rate stable at current price',
      options: ['Approve Increase', 'Hold Price', 'Test First (A/B)'],
      defaultIfNoResponse: 'Price held; Oracle will re-evaluate in 7 days',
      urgency: 'agents_handle' as const,
      expiresIn: '23h 41m',
    },
  ],
  highlight: {
    type: 'revenue' as const,
    message: 'MRR hit ₹2.84L — highest ever! Oracle predicts ₹3L by month-end if signups hold.',
  },
  alerts: [
    {
      severity: 'info' as const,
      message: 'Forge deployed content update to CDN — 0 errors',
      suggestedAction: 'No action needed',
    },
  ],
};

// ── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon: Icon,
  change,
  color,
  delay,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  change?: number;
  color: 'green' | 'red' | 'blue' | 'purple';
  delay: number;
}) {
  const colorMap = {
    green: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
    red: 'from-red-500/20 to-red-500/5 border-red-500/20 text-red-400',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20 text-blue-400',
    purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/20 text-purple-400',
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
        <p className="text-xs text-surface-400 truncate">{summary}</p>
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
  decision: (typeof mockBrief.pendingDecisions)[0];
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
      {/* Header */}
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

      {/* Decision text */}
      <p className="text-sm text-surface-200 mb-4 leading-relaxed">{d.decision}</p>

      {/* Options */}
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

      {/* Default note */}
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

// ── Main Page ────────────────────────────────────────────────────────────────

export function CEOBriefing() {
  const brief = mockBrief;
  const navigate = useNavigate();

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
        <div className="text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <Bot className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">Oracle generated this</span>
          </div>
          <p className="text-[11px] text-surface-500 mt-0.5">
            {brief.generatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST
          </p>
        </div>
      </motion.div>

      {/* ── 5 Numbers strip ── */}
      <section>
        <p className="text-xs font-semibold text-surface-500 uppercase tracking-widest mb-3">
          Business Pulse
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label="Monthly Revenue"
            value={`₹${(brief.metrics.mrrINR / 1000).toFixed(0)}K`}
            icon={IndianRupee}
            change={brief.metrics.mrrChange}
            color="green"
            delay={0.05}
          />
          <MetricCard
            label="Active Students"
            value={brief.metrics.activeStudents.toLocaleString('en-IN')}
            icon={Users}
            color="blue"
            delay={0.1}
          />
          <MetricCard
            label="New Today"
            value={`+${brief.metrics.newSignups}`}
            icon={UserPlus}
            color="purple"
            delay={0.15}
          />
          <MetricCard
            label="Churned Today"
            value={`−${brief.metrics.churnedToday}`}
            icon={UserMinus}
            color="red"
            delay={0.2}
          />
        </div>
      </section>

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
              delay={0.25 + i * 0.06}
            />
          ))}
        </div>
      </section>

      {/* ── Decisions needed ── */}
      {brief.pendingDecisions.length > 0 && (
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
            {brief.pendingDecisions.map((d, i) => (
              <DecisionCard key={d.id} decision={d} delay={0.5 + i * 0.08} />
            ))}
          </div>
        </section>
      )}

      {/* ── Today's win ── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
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
                transition={{ delay: 0.7 + i * 0.05 }}
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
        transition={{ delay: 0.75 }}
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
        transition={{ delay: 0.8 }}
        className="flex items-center justify-between pt-4 border-t border-surface-700/30"
      >
        <p className="text-[11px] text-surface-600">
          Next brief in ~{Math.floor(Math.random() * 4 + 18)}h · Generated by Oracle at 7:00 AM IST
        </p>
        <button className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-300 transition-colors">
          Full analytics
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    </div>
  );
}
