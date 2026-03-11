/**
 * GrowthCommand.tsx — CEO Growth Intelligence Dashboard
 *
 * Central command panel for the Master Growth Orchestrator:
 * - Funnel metrics (visitors → leads → signups → activated)
 * - SEO health score
 * - Active content campaigns
 * - Page priority queue
 * - Content freshness alerts
 * - Scout trend signals
 * - "Run Growth Cycle" trigger button
 */

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Search, Zap, AlertTriangle, CheckCircle,
  RefreshCw, BarChart3, Globe, Target, Clock,
  ArrowUp, ArrowDown, Users, MousePointer, UserCheck,
  Loader2, ChevronRight,
} from 'lucide-react';
import { growthOrchestrator, type GrowthStrategy, type PagePriorityItem, type ContentFreshnessAlert } from '@/services/growthOrchestrator';
import { acquisitionFunnelService, type FunnelMetrics, type FunnelInsight } from '@/services/acquisitionFunnelService';
import { websiteSeoService } from '@/services/websiteSeoService';
import { getLiveExams } from '@/data/examRegistry';

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  trend,
  color = 'primary',
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'primary' | 'green' | 'yellow' | 'red';
}) {
  const colorMap: Record<string, string> = {
    primary: 'text-primary-400 bg-primary-500/10',
    green:   'text-green-400 bg-green-500/10',
    yellow:  'text-yellow-400 bg-yellow-500/10',
    red:     'text-red-400 bg-red-500/10',
  };
  return (
    <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
      <div className="flex items-start justify-between mb-3">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </span>
        {trend && trend !== 'neutral' && (
          <span className={trend === 'up' ? 'text-green-400' : 'text-red-400'}>
            {trend === 'up' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-surface-400 mt-0.5">{label}</p>
      {subtext && <p className="text-xs text-surface-500 mt-1">{subtext}</p>}
    </div>
  );
}

// ─── Funnel Bar ───────────────────────────────────────────────────────────────

function FunnelBar({ metrics }: { metrics: FunnelMetrics }) {
  const stages = [
    { label: 'Visitors',  value: metrics.visitors,  color: 'bg-blue-500' },
    { label: 'Engaged',   value: metrics.engaged,   color: 'bg-indigo-500' },
    { label: 'Leads',     value: metrics.leads,     color: 'bg-violet-500' },
    { label: 'Signups',   value: metrics.signups,   color: 'bg-purple-500' },
    { label: 'Activated', value: metrics.activated, color: 'bg-primary-500' },
  ];
  const max = Math.max(metrics.visitors, 1);

  return (
    <div className="space-y-3">
      {stages.map((s) => (
        <div key={s.label} className="flex items-center gap-3">
          <span className="text-xs text-surface-400 w-20 flex-shrink-0">{s.label}</span>
          <div className="flex-1 bg-surface-700 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${s.color}`}
              style={{ width: `${Math.max(2, (s.value / max) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-white font-mono w-12 text-right">{s.value.toLocaleString('en-IN')}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Insight Badge ────────────────────────────────────────────────────────────

function InsightBadge({ insight }: { insight: FunnelInsight }) {
  const config: Record<string, { icon: string; color: string }> = {
    opportunity: { icon: '💡', color: 'border-blue-500/30 bg-blue-500/5' },
    warning:     { icon: '⚠️', color: 'border-yellow-500/30 bg-yellow-500/5' },
    success:     { icon: '✅', color: 'border-green-500/30 bg-green-500/5' },
  };
  const c = config[insight.type] ?? config.opportunity;

  return (
    <div className={`p-4 rounded-xl border ${c.color}`}>
      <div className="flex items-start gap-2">
        <span className="text-base flex-shrink-0">{c.icon}</span>
        <div>
          <p className="text-sm font-medium text-white">{insight.title}</p>
          <p className="text-xs text-surface-400 mt-0.5">{insight.body}</p>
          <p className="text-xs text-primary-400 mt-1 font-medium">→ {insight.actionable}</p>
        </div>
        <span className={`ml-auto flex-shrink-0 px-2 py-0.5 rounded-full text-xs ${
          insight.urgency === 'high' ? 'bg-red-500/20 text-red-400' :
          insight.urgency === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-surface-700 text-surface-400'
        }`}>
          {insight.urgency}
        </span>
      </div>
    </div>
  );
}

// ─── Priority Row ─────────────────────────────────────────────────────────────

function PriorityRow({ item, rank }: { item: PagePriorityItem; rank: number }) {
  const urgencyColor =
    item.priorityScore > 50 ? 'text-red-400 bg-red-500/10' :
    item.priorityScore > 25 ? 'text-yellow-400 bg-yellow-500/10' :
    'text-green-400 bg-green-500/10';

  return (
    <div className="flex items-center gap-3 p-3 bg-surface-900/60 rounded-xl border border-surface-700/60 hover:border-surface-600 transition-all">
      <span className="text-surface-500 text-xs font-mono w-4 text-center">{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{item.slug}</p>
        <p className="text-xs text-surface-500 mt-0.5 truncate">{item.recommendation}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <p className="text-xs text-surface-400">Traffic</p>
          <p className="text-xs text-white font-medium">{item.trafficPotential}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-surface-400">Fresh</p>
          <p className={`text-xs font-medium ${item.contentFreshness < 30 ? 'text-red-400' : item.contentFreshness < 60 ? 'text-yellow-400' : 'text-green-400'}`}>
            {item.contentFreshness}%
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${urgencyColor}`}>
          {item.priorityScore}
        </span>
      </div>
    </div>
  );
}

// ─── Freshness Alert Row ─────────────────────────────────────────────────────

function FreshnessRow({ alert }: { alert: ContentFreshnessAlert }) {
  const urg: Record<string, string> = {
    high:   'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low:    'bg-surface-700 text-surface-400 border-surface-600',
  };
  return (
    <div className="flex items-center justify-between p-3 bg-surface-900/40 rounded-xl border border-surface-700/60">
      <div className="flex items-center gap-3">
        <AlertTriangle className={`w-4 h-4 ${alert.urgency === 'high' ? 'text-red-400' : alert.urgency === 'medium' ? 'text-yellow-400' : 'text-surface-400'}`} />
        <div>
          <p className="text-sm text-white font-medium">{alert.pageId}</p>
          <p className="text-xs text-surface-500">{alert.action}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-surface-400">{alert.staleDays}d stale</span>
        <span className={`px-2 py-0.5 rounded-full text-xs border ${urg[alert.urgency]}`}>
          {alert.urgency}
        </span>
      </div>
    </div>
  );
}

// ─── SEO Health Gauge ─────────────────────────────────────────────────────────

function SeoGauge({ score, grade }: { score: number; grade: string }) {
  const color =
    score >= 80 ? 'text-green-400' :
    score >= 60 ? 'text-yellow-400' :
    'text-red-400';

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className={`text-6xl font-bold ${color}`}>{score}</div>
      <div className={`text-2xl font-semibold mt-1 ${color}`}>{grade}</div>
      <p className="text-surface-400 text-sm mt-2">Overall SEO Health</p>
      <div className="w-full mt-4 bg-surface-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ─── Conversion Rate Card ─────────────────────────────────────────────────────

function ConversionRates({ rates }: { rates: FunnelMetrics['conversionRates'] }) {
  const items = [
    { label: 'Visitor → Engaged',   rate: rates.visitorToEngaged },
    { label: 'Engaged → Lead',      rate: rates.engagedToLead },
    { label: 'Lead → Signup',       rate: rates.leadToSignup },
    { label: 'Signup → Activated',  rate: rates.signupToActivated },
    { label: 'Overall Funnel',      rate: rates.overallFunnel },
  ];
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between">
          <span className="text-xs text-surface-400 flex items-center gap-1">
            <ChevronRight className="w-3 h-3" /> {item.label}
          </span>
          <span className={`text-xs font-bold ${
            item.rate >= 0.5 ? 'text-green-400' :
            item.rate >= 0.25 ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {Math.round(item.rate * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function GrowthCommand() {
  const [metrics, setMetrics] = useState<FunnelMetrics | null>(null);
  const [insights, setInsights] = useState<FunnelInsight[]>([]);
  const [queue, setQueue] = useState<PagePriorityItem[]>([]);
  const [freshnessAlerts, setFreshnessAlerts] = useState<ContentFreshnessAlert[]>([]);
  const [seoHealth, setSeoHealth] = useState<{ score: number; grade: string; pageScores: Record<string, number> } | null>(null);
  const [lastStrategy, setLastStrategy] = useState<GrowthStrategy | null>(null);
  const [cycleRunning, setCycleRunning] = useState(false);
  const [timeWindow, setTimeWindow] = useState<'24h' | '7d' | '30d'>('7d');

  const loadData = useCallback(() => {
    const m = acquisitionFunnelService.getFunnelMetrics(timeWindow);
    setMetrics(m);
    setInsights(acquisitionFunnelService.generateFunnelInsights('7d'));
    setQueue(growthOrchestrator.getPagePriorityQueue());
    setFreshnessAlerts(growthOrchestrator.getFreshnessAlerts());
    setSeoHealth(growthOrchestrator.getOverallSeoHealth());
    setLastStrategy(growthOrchestrator.getLastStrategy());
  }, [timeWindow]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runGrowthCycle = async () => {
    setCycleRunning(true);
    try {
      const strategy = await growthOrchestrator.orchestrateGrowth('manual');
      setLastStrategy(strategy);
      loadData();
    } catch {
      // Graceful failure
    } finally {
      setCycleRunning(false);
    }
  };

  const convRates = metrics?.conversionRates;

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary-400" />
            Growth Command
          </h1>
          <p className="text-surface-400 text-sm mt-1">Master Growth Orchestrator — real-time acquisition funnel intelligence</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time window */}
          <div className="flex items-center gap-1 bg-surface-800 border border-surface-700 rounded-lg p-1">
            {(['24h', '7d', '30d'] as const).map((w) => (
              <button
                key={w}
                onClick={() => setTimeWindow(w)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  timeWindow === w ? 'bg-primary-600 text-white' : 'text-surface-400 hover:text-white'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
          {/* Refresh */}
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-300 hover:text-white hover:border-surface-600 transition-all text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {/* Run Growth Cycle */}
          <button
            onClick={runGrowthCycle}
            disabled={cycleRunning}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 disabled:opacity-60 rounded-lg text-white text-sm font-medium transition-all"
          >
            {cycleRunning ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Running...</>
            ) : (
              <><Zap className="w-4 h-4" /> Run Growth Cycle</>
            )}
          </button>
        </div>
      </div>

      {/* Last cycle status */}
      {lastStrategy && (
        <div className={`flex items-center gap-3 p-3 rounded-xl border text-sm ${
          lastStrategy.cycleStatus === 'complete'
            ? 'bg-green-500/5 border-green-500/30 text-green-400'
            : lastStrategy.cycleStatus === 'error'
            ? 'bg-red-500/5 border-red-500/30 text-red-400'
            : 'bg-surface-800 border-surface-700 text-surface-400'
        }`}>
          {lastStrategy.cycleStatus === 'complete' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          Last cycle: {lastStrategy.trigger} — {lastStrategy.cycleStatus} — {new Date(lastStrategy.runAt).toLocaleString('en-IN')}
          · {lastStrategy.pagesUpdated.length} pages updated · {lastStrategy.durationMs}ms
        </div>
      )}

      {/* ── Top KPI Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <MetricCard label="Visitors" value={metrics?.visitors.toLocaleString('en-IN') ?? '—'} icon={Users} trend="up" color="primary" subtext={timeWindow} />
        <MetricCard label="Leads" value={metrics?.leads.toLocaleString('en-IN') ?? '—'} icon={MousePointer} trend="up" color="green" />
        <MetricCard label="Signups" value={metrics?.signups.toLocaleString('en-IN') ?? '—'} icon={UserCheck} trend="neutral" color="yellow" />
        <MetricCard label="Activated" value={metrics?.activated.toLocaleString('en-IN') ?? '—'} icon={CheckCircle} color="green" />
        <MetricCard label="SEO Score" value={seoHealth?.score ?? '—'} icon={Search} color={seoHealth?.score && seoHealth.score >= 70 ? 'green' : 'yellow'} subtext={`Grade: ${seoHealth?.grade ?? '—'}`} />
      </div>

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Funnel Visualisation */}
        <div className="lg:col-span-2 bg-surface-800 rounded-2xl border border-surface-700 p-5">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary-400" />
            Acquisition Funnel
            <span className="text-xs text-surface-500 ml-auto">{timeWindow} window</span>
          </h2>
          {metrics ? <FunnelBar metrics={metrics} /> : (
            <div className="flex items-center justify-center h-24 text-surface-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
            </div>
          )}
          {convRates && (
            <div className="mt-5 pt-4 border-t border-surface-700">
              <p className="text-xs text-surface-400 mb-3 font-medium">Conversion Rates</p>
              <ConversionRates rates={convRates} />
            </div>
          )}
        </div>

        {/* SEO Health */}
        <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
          <h2 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary-400" />
            SEO Health
          </h2>
          {seoHealth ? (
            <>
              <SeoGauge score={seoHealth.score} grade={seoHealth.grade} />
              <div className="mt-3 space-y-1.5">
                {Object.entries(seoHealth.pageScores).slice(0, 5).map(([pageId, score]) => (
                  <div key={pageId} className="flex items-center justify-between">
                    <span className="text-xs text-surface-400 truncate max-w-[120px]">{pageId}</span>
                    <span className={`text-xs font-medium ${score >= 70 ? 'text-green-400' : 'text-yellow-400'}`}>{score}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32 text-surface-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
            </div>
          )}
        </div>
      </div>

      {/* ── Second row ─────────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Page Priority Queue */}
        <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary-400" />
            Page Priority Queue
            <span className="text-xs text-surface-500 ml-auto">Score = traffic × gap × staleness</span>
          </h2>
          <div className="space-y-2">
            {queue.slice(0, 6).map((item, i) => (
              <PriorityRow key={item.pageId} item={item} rank={i + 1} />
            ))}
            {queue.length === 0 && (
              <p className="text-surface-500 text-sm text-center py-6">
                Run a growth cycle to populate the queue.
              </p>
            )}
          </div>
        </div>

        {/* Funnel Insights */}
        <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary-400" />
            Growth Insights
          </h2>
          <div className="space-y-3">
            {insights.slice(0, 4).map((insight, i) => (
              <InsightBadge key={i} insight={insight} />
            ))}
            {insights.length === 0 && (
              <p className="text-surface-500 text-sm text-center py-6">
                No insights yet — run a growth cycle.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Third row ──────────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Content Freshness Alerts */}
        <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            Content Freshness Alerts
          </h2>
          <div className="space-y-2">
            {freshnessAlerts.length > 0 ? (
              freshnessAlerts.slice(0, 5).map((alert, i) => (
                <FreshnessRow key={i} alert={alert} />
              ))
            ) : (
              <div className="flex items-center gap-2 p-3 bg-green-500/5 border border-green-500/20 rounded-xl">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <p className="text-sm text-green-400">All pages are fresh — no stale content detected.</p>
              </div>
            )}
          </div>
        </div>

        {/* Scout Trend Signals */}
        <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary-400" />
            Scout Trend Signals
          </h2>
          {(() => {
            try {
              const raw = localStorage.getItem('scout:weekly-report');
              if (!raw) return (
                <p className="text-surface-500 text-sm text-center py-6">
                  No Scout signals yet. Run a Scout intelligence cycle first.
                </p>
              );
              const report = JSON.parse(raw) as {
                trendAlerts?: Array<{ keyword: string; examFocus?: string }>;
                priorityContentQueue?: Array<{ topic: string; examFocus: string; priority: number }>;
                generatedAt?: string;
              };
              const trends = report.trendAlerts ?? [];
              const queue2 = report.priorityContentQueue ?? [];
              return (
                <div className="space-y-3">
                  {trends.slice(0, 3).map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-surface-900/60 rounded-lg border border-surface-700/60">
                      <span className="text-sm text-white">{t.keyword}</span>
                      {t.examFocus && <span className="text-xs text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded">{t.examFocus}</span>}
                    </div>
                  ))}
                  {queue2.slice(0, 2).map((q, i) => (
                    <div key={`q${i}`} className="flex items-center justify-between p-2 bg-primary-500/5 rounded-lg border border-primary-500/20">
                      <span className="text-sm text-white">{q.topic}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-surface-400">{q.examFocus}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${q.priority > 70 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {q.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                  {report.generatedAt && (
                    <p className="text-xs text-surface-500 text-right">Scout ran: {new Date(report.generatedAt).toLocaleString('en-IN')}</p>
                  )}
                </div>
              );
            } catch {
              return <p className="text-surface-500 text-sm text-center py-6">Scout data unavailable.</p>;
            }
          })()}
        </div>
      </div>

      {/* ── Top performing exam landing pages ──────────────────────────────── */}
      <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary-400" />
          Exam Landing Pages — Performance
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {getLiveExams().map((exam) => {
            const examMetrics = metrics?.topExams.find((e) => e.examId === exam.id);
            const seoScore = seoHealth?.pageScores[exam.id] ?? 0;
            return (
              <div key={exam.id} className="p-4 bg-surface-900/60 rounded-xl border border-surface-700/60">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{exam.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-white">{exam.shortName}</p>
                    <p className="text-xs text-surface-500">/website/exams/{exam.route}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-surface-400">Views</p>
                    <p className="text-sm font-bold text-white">{examMetrics?.views.toLocaleString('en-IN') ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-surface-400">Signups</p>
                    <p className="text-sm font-bold text-primary-400">{examMetrics?.signups ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-surface-400">SEO</p>
                    <p className={`text-sm font-bold ${seoScore >= 70 ? 'text-green-400' : 'text-yellow-400'}`}>{seoScore || '—'}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default GrowthCommand;
