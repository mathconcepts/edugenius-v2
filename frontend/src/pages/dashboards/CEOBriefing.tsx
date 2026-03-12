/**
 * CEO Daily Briefing — /briefing
 *
 * One screenful. 4 zones. No scroll for essential content.
 * Zone A: Greeting header
 * Zone B: 4 compact KPI cards
 * Zone C: Decisions (one-line each)
 * Zone D: Agent activity (scroll within zone)
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, Bot, CheckCircle2, XCircle, ChevronRight, RefreshCw,
  TrendingUp, TrendingDown, AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { generateLiveBrief, LiveDecision } from '../../services/liveBriefing';
import { useAppStore } from '@/stores/appStore';
import { loadProfile } from '@/services/gamificationService';
import { computeReadiness } from '@/services/readinessScoreService';

// ── Compact KPI Card ─────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  change,
  color,
}: {
  label: string;
  value: string;
  change?: number;
  color: 'green' | 'blue' | 'red' | 'amber';
}) {
  const colorMap = {
    green: 'border-emerald-500/20 text-emerald-400',
    blue:  'border-blue-500/20   text-blue-400',
    red:   'border-red-500/20    text-red-400',
    amber: 'border-amber-500/20  text-amber-400',
  };

  return (
    <div className={clsx('kpi-card border', colorMap[color])}>
      <p className="text-[10px] font-medium text-surface-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold text-white leading-tight">{value}</p>
      {change !== undefined && (
        <div className="flex items-center gap-1 mt-0.5">
          {change >= 0
            ? <TrendingUp className="w-3 h-3 text-emerald-400" />
            : <TrendingDown className="w-3 h-3 text-red-400" />}
          <span className={clsx('text-[10px] font-medium', change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {change > 0 ? '+' : ''}{change}%
          </span>
        </div>
      )}
    </div>
  );
}

// ── One-line Decision Row ─────────────────────────────────────────────────────

function DecisionRow({ decision: d }: { decision: LiveDecision }) {
  const [chosen, setChosen] = useState<string | null>(null);

  if (chosen) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{d.decision.slice(0, 60)}{d.decision.length > 60 ? '…' : ''}</span>
        <span className="ml-auto text-emerald-400/60 whitespace-nowrap">→ {chosen}</span>
      </div>
    );
  }

  const isUrgent = d.urgency === 'must_decide';

  return (
    <div className="flex items-center gap-3 py-2 border-b border-surface-700/20 last:border-0">
      {isUrgent && <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
      <span className="text-xs text-surface-200 flex-1 truncate min-w-0">
        {d.decision.slice(0, 72)}{d.decision.length > 72 ? '…' : ''}
      </span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {d.options.slice(0, 2).map((opt, i) => (
          <button
            key={opt}
            onClick={() => setChosen(opt)}
            className={clsx(
              'px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all',
              i === 0
                ? 'bg-primary-500/20 text-primary-400 border-primary-500/30 hover:bg-primary-500/30'
                : 'bg-surface-700/50 text-surface-300 border-surface-600/30 hover:bg-surface-700'
            )}
          >
            {opt.length > 12 ? opt.slice(0, 12) + '…' : opt}
          </button>
        ))}
        {d.options.length === 0 && (
          <button
            onClick={() => setChosen('Viewed')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-surface-600/30 text-surface-400 hover:bg-surface-700 transition-all"
          >
            View
          </button>
        )}
      </div>
    </div>
  );
}

// ── Agent Activity Row ────────────────────────────────────────────────────────

const AGENT_EMOJIS: Record<string, string> = {
  Scout: '🔍', Atlas: '📚', Sage: '🎓', Mentor: '👨‍🏫',
  Herald: '📢', Forge: '⚙️', Oracle: '📊',
};

function AgentRow({ agent, summary, count, time }: {
  agent: string;
  summary: string;
  count: number;
  time?: string;
}) {
  const name = agent.split(' ')[0];
  const emoji = AGENT_EMOJIS[name] ?? '🤖';
  return (
    <div className="flex items-center gap-3 py-2 border-b border-surface-700/15 last:border-0">
      <span className="text-sm flex-shrink-0">{emoji}</span>
      <span className="text-xs font-medium text-surface-300 w-14 flex-shrink-0">{name}</span>
      <span className="text-xs text-surface-500 flex-1 truncate min-w-0">→ {summary}</span>
      <span className="text-[10px] text-surface-600 flex-shrink-0 tabular-nums">
        {time ?? count.toLocaleString('en-IN')}
      </span>
    </div>
  );
}

// ── Engagement Metrics Panel ─────────────────────────────────────────────────

function EngagementMetricsPanel() {
  const { gamificationEnabled, readinessScoreEnabled } = useAppStore();
  if (!gamificationEnabled && !readinessScoreEnabled) return null;

  // Load local student's profile as proxy (in prod this would be aggregate API)
  const profile = loadProfile();
  const report = computeReadiness();

  return (
    <div className="glass rounded-xl px-4 py-3 flex-shrink-0">
      <h3 className="text-xs font-semibold text-surface-300 uppercase tracking-wider mb-3 flex items-center gap-2">
        🎮 Engagement Pulse
        <span className="text-[10px] text-surface-500 font-normal normal-case">(live from student sessions)</span>
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Avg XP/Week', value: String(profile.weeklyXP), color: 'text-yellow-400', icon: '⚡' },
          { label: 'Streak', value: `${profile.streak}d`, color: 'text-orange-400', icon: '🔥' },
          { label: 'Readiness', value: `${report.overallScore}%`, color: report.overallScore >= 75 ? 'text-green-400' : 'text-amber-400', icon: '📊' },
          { label: 'Level', value: `Lv.${profile.level} ${profile.rank}`, color: 'text-purple-400', icon: '🏆' },
        ].map(m => (
          <div key={m.label} className="bg-surface-800/60 rounded-xl p-3 text-center">
            <div className="text-lg mb-1">{m.icon}</div>
            <div className={`text-lg font-black ${m.color}`}>{m.value}</div>
            <div className="text-xs text-surface-400">{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function CEOBriefing() {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  const brief = useMemo(() => generateLiveBrief(), [refreshKey]);
  const m = brief.metrics;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col gap-4 max-w-5xl mx-auto px-4 py-5 overflow-hidden">

      {/* ── Zone A: Header ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-shrink-0"
      >
        <div>
          <h1 className="text-lg font-bold text-white">
            {greeting}, Giri. Here's what needs you today.
          </h1>
          <p className="text-xs text-surface-500 mt-0.5">{brief.date} · {brief.generatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} UTC</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/create-exam')}
            className="btn-primary text-xs px-3 py-1.5"
          >
            View Live Exams →
          </button>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-2 hover:bg-surface-800 rounded-lg transition-colors text-surface-500"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>

      {/* ── Zone B: 4 KPI cards ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-shrink-0"
      >
        <KPICard
          label="Active Students"
          value={m.activeStudents.toLocaleString('en-IN')}
          color="blue"
        />
        <KPICard
          label="AI Cost / Day"
          value={`$${m.estimatedAiCostUsd}`}
          color="amber"
        />
        <KPICard
          label="At Risk"
          value={m.atRiskStudents.toLocaleString('en-IN')}
          color="red"
        />
        <KPICard
          label="Decisions Needed"
          value={`${brief.decisions.filter(d => d.urgency === 'must_decide').length} items`}
          color="green"
        />
      </motion.div>

      {/* ── Zone C: Decisions ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-xl px-4 py-3 flex-shrink-0"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">📋</span>
            <span className="text-xs font-semibold text-surface-300 uppercase tracking-wider">
              Decisions ({brief.decisions.length})
            </span>
          </div>
          <span className="text-[10px] text-surface-600">Agents execute default in 24h</span>
        </div>

        {brief.decisions.length === 0 ? (
          <p className="text-xs text-surface-500 py-1">No decisions pending. Agents are handling everything. ✓</p>
        ) : (
          <div className="divide-y divide-surface-700/20">
            {brief.decisions.slice(0, 4).map(d => (
              <DecisionRow key={d.id} decision={d} />
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Zone C.5: Engagement Pulse (gamification + readiness) ────────── */}
      <EngagementMetricsPanel />

      {/* ── Zone D: Agent Activity (scrolls within zone) ─────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass rounded-xl px-4 py-3 flex-1 min-h-0 flex flex-col"
      >
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="w-3.5 h-3.5 text-primary-400" />
            <span className="text-xs font-semibold text-surface-300 uppercase tracking-wider">
              Agent Activity
            </span>
          </div>
          <button
            onClick={() => navigate('/agents')}
            className="flex items-center gap-1 text-[11px] text-primary-400 hover:text-primary-300 transition-colors"
          >
            All agents <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 scrollbar-thin pr-1">
          {brief.agentActivity.length === 0 ? (
            <p className="text-xs text-surface-500 py-1">No agent activity yet today.</p>
          ) : (
            brief.agentActivity.map((a, i) => (
              <AgentRow
                key={a.agent}
                agent={a.agent}
                summary={a.summary}
                count={a.count}
              />
            ))
          )}
        </div>
      </motion.div>

    </div>
  );
}
