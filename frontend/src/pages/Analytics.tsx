/**
 * Analytics Page - CEO/Admin analytics dashboard
 * AI-powered insights from Oracle agent
 * Wire 3: live Prism funnel metrics + A/B splits replace hardcoded data
 */

import { useState, useEffect } from 'react';
import {
  getFunnelMetrics,
  getABSplits,
  getRevenueInsights,
  loadPrismState,
} from '@/services/prismBridge';
import type { FunnelMetrics, ABTestSplit } from '@/services/prismBridge';

interface MetricCard {
  label: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: string;
}

const metrics: MetricCard[] = [
  { label: 'Total Users', value: '24,580', change: 12.5, trend: 'up', icon: '👥' },
  { label: 'Active Today', value: '3,421', change: 8.2, trend: 'up', icon: '🟢' },
  { label: 'Sessions', value: '8,942', change: 15.3, trend: 'up', icon: '📱' },
  { label: 'Avg Session', value: '24m', change: -2.1, trend: 'down', icon: '⏱️' },
  { label: 'Retention (7d)', value: '72%', change: 3.4, trend: 'up', icon: '🔄' },
  { label: 'Conversion', value: '4.8%', change: 0.5, trend: 'up', icon: '💰' },
  { label: 'MRR', value: '₹4.2L', change: 18.2, trend: 'up', icon: '📈' },
  { label: 'NPS Score', value: '67', change: 5, trend: 'up', icon: '⭐' },
];

// Static fallback funnel data (shown when Prism hasn't run yet)
const FALLBACK_FUNNEL = [
  { stage: 'Visitors', count: 45000, rate: 100 },
  { stage: 'Signups', count: 8500, rate: 18.9 },
  { stage: 'Activated', count: 5200, rate: 61.2 },
  { stage: 'Engaged', count: 3800, rate: 73.1 },
  { stage: 'Converted', count: 1200, rate: 31.6 },
];

// Static fallback A/B tests
const FALLBACK_AB_TESTS = [
  { id: '1', name: 'Pricing Page CTA', status: 'running', confidence: 87, winner: 'Variant B', lift: '+12%' },
  { id: '2', name: 'Onboarding Flow', status: 'running', confidence: 62, winner: 'Variant A', lift: '+5%' },
  { id: '3', name: 'Landing Page Hero', status: 'completed', confidence: 95, winner: 'Variant C', lift: '+24%' },
];

export default function Analytics() {
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');

  // Wire 3 — Live Prism data
  const [liveFunnel, setLiveFunnel] = useState<FunnelMetrics | null>(null);
  const [liveABSplits, setLiveABSplits] = useState<ABTestSplit[]>([]);
  const [prismLastRun, setPrismLastRun] = useState<string | null>(null);
  const [prismCycle, setPrismCycle] = useState<number | null>(null);
  const [prismIsMock, setPrismIsMock] = useState<boolean>(false);
  const [revenueOpportunities, setRevenueOpportunities] = useState<string[]>([]);

  useEffect(() => {
    // Load live Prism metrics
    const funnel = getFunnelMetrics();
    if (funnel) setLiveFunnel(funnel);

    const splits = getABSplits();
    if (splits.length > 0) setLiveABSplits(splits);

    const insights = getRevenueInsights();
    setRevenueOpportunities(insights.topOpportunities);

    // Load Prism state for cycle metadata
    const prismState = loadPrismState();
    if (prismState) {
      setPrismLastRun(prismState.lastRunAt);
      setPrismIsMock(prismState.isMockData);
      // Estimate cycle from number of intelligence packets (each run adds packets)
      const packetCount = prismState.intelligencePackets?.length ?? 0;
      setPrismCycle(Math.max(1, Math.ceil(packetCount / 7)));
    }
  }, []);

  // Build funnel display data: use live Prism if available, fallback otherwise
  const funnelData = liveFunnel
    ? [
        { stage: 'Blog Views', count: liveFunnel.blogViews, rate: 100 },
        { stage: 'CTA Clicks', count: liveFunnel.blogCtaClicks, rate: +(liveFunnel.ctaClickRate * 100).toFixed(1) },
        { stage: 'Chat Sessions', count: liveFunnel.chatSessions, rate: +(liveFunnel.chatToPracticeRate * 100).toFixed(1) },
        { stage: 'Practice', count: liveFunnel.practiceAttempts, rate: +(liveFunnel.returnRate * 100).toFixed(1) },
        { stage: 'Returned', count: liveFunnel.practiceReturns, rate: 100 },
      ]
    : FALLBACK_FUNNEL;

  // Build A/B test display: merge live splits with fallback display list
  const abTestDisplay = liveABSplits.length > 0
    ? liveABSplits.map((split) => ({
        id: split.testId,
        name: split.testId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        status: split.significanceReached ? 'completed' : 'running',
        confidence: split.significanceReached
          ? 95
          : Math.min(90, Math.round(((split.controlClicks + split.variantClicks) / 200) * 85)),
        winner: split.winner === 'variant' ? 'Variant B' : split.winner === 'control' ? 'Variant A' : 'Too early',
        lift: split.winner
          ? `+${Math.round(((split.variantClicks - split.controlClicks) / Math.max(1, split.controlClicks)) * 100)}%`
          : 'TBD',
      }))
    : FALLBACK_AB_TESTS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`btn btn-sm ${timeRange === range ? 'bg-primary-600' : 'bg-surface-700'}`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Prism Status Bar — Wire 3 */}
      {prismLastRun && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-sm">
          <span className="text-lg">🔮</span>
          <span className="text-violet-300 font-medium">Prism Intelligence</span>
          {prismCycle && (
            <span className="text-violet-400 text-xs bg-violet-500/20 px-2 py-0.5 rounded-full">
              Cycle {prismCycle}
            </span>
          )}
          {prismIsMock && (
            <span className="text-amber-400 text-xs bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
              Demo data
            </span>
          )}
          <span className="text-surface-400 text-xs ml-auto">
            Last run: {new Date(prismLastRun).toLocaleString()}
          </span>
        </div>
      )}

      {/* AI Insights */}
      <div className="card bg-gradient-to-r from-accent-600/10 to-primary-600/10 border-accent-500/30">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-accent-500/20 rounded-xl">
            <span className="text-2xl">🔮</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white mb-2">Oracle AI Insights</h3>
            {revenueOpportunities.length > 0 ? (
              <div className="space-y-2 text-sm text-surface-300">
                {revenueOpportunities.map((op, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-primary-400">💡</span>
                    <span>{op}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-surface-300">
                <div className="flex items-start gap-2">
                  <span className="text-green-400">📈</span>
                  <span>User growth is 23% higher than last month. The new landing page is performing well.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-yellow-400">⚠️</span>
                  <span>Churn rate increased in the Chemistry segment. Consider adding more visual content.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary-400">💡</span>
                  <span>Peak usage is 6-9 PM. Schedule push notifications for 5:30 PM for best engagement.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-accent-400">🎯</span>
                  <span>JEE students have 2.5x higher conversion than NEET. Consider doubling JEE marketing budget.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map(metric => (
          <div key={metric.label} className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{metric.icon}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                metric.trend === 'up' ? 'bg-green-500/20 text-green-400' :
                metric.trend === 'down' ? 'bg-red-500/20 text-red-400' :
                'bg-surface-600 text-surface-300'
              }`}>
                {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'} {Math.abs(metric.change)}%
              </span>
            </div>
            <p className="text-2xl font-bold text-white">{metric.value}</p>
            <p className="text-sm text-surface-400">{metric.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel — Wire 3: live Prism data */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Conversion Funnel</h3>
            {liveFunnel ? (
              <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                🔮 Live Prism
              </span>
            ) : (
              <span className="text-xs text-surface-500 bg-surface-700/50 px-2 py-0.5 rounded-full">
                Fallback data
              </span>
            )}
          </div>
          <div className="space-y-3">
            {funnelData.map((stage, i) => (
              <div key={stage.stage}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-surface-300">{stage.stage}</span>
                  <span className="text-white">{stage.count.toLocaleString()}</span>
                </div>
                <div className="h-8 bg-surface-800 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-primary-600 to-accent-600 rounded-lg transition-all"
                    style={{ width: `${Math.min(100, stage.rate)}%` }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-white">
                    {i > 0 && `${stage.rate}%`}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {liveFunnel && (
            <div className="mt-3 pt-3 border-t border-surface-700/50 text-xs text-surface-500">
              Top drop-off: <span className="text-amber-400">{liveFunnel.topDropoffPoint.replace(/_/g, ' ')}</span>
              {' '}· Avg session: <span className="text-surface-400">{liveFunnel.avgSessionMessages} messages</span>
            </div>
          )}
        </div>

        {/* A/B Tests — Wire 3: live splits */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Active A/B Tests</h3>
            {liveABSplits.length > 0 && (
              <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                🔮 Live data
              </span>
            )}
          </div>
          <div className="space-y-3">
            {abTestDisplay.map(test => (
              <div key={test.id} className="p-4 bg-surface-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium text-sm">{test.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    test.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {test.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-surface-400">
                    {test.confidence}% confidence · {test.winner} winning
                  </span>
                  <span className="text-green-400 font-medium">{test.lift}</span>
                </div>
                <div className="mt-2 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      test.confidence >= 95 ? 'bg-green-500' :
                      test.confidence >= 80 ? 'bg-yellow-500' : 'bg-surface-500'
                    }`}
                    style={{ width: `${test.confidence}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Exam Performance */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Exam Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { exam: 'JEE Main', users: 8420, conversion: 5.2, trend: 'up' },
            { exam: 'NEET UG', users: 6350, conversion: 3.8, trend: 'stable' },
            { exam: 'CBSE 12', users: 5280, conversion: 4.1, trend: 'up' },
            { exam: 'CBSE 10', users: 3150, conversion: 3.2, trend: 'down' },
            { exam: 'CAT', users: 1380, conversion: 6.5, trend: 'up' },
          ].map(exam => (
            <div key={exam.exam} className="p-4 bg-surface-800/50 rounded-xl">
              <p className="text-white font-medium">{exam.exam}</p>
              <p className="text-2xl font-bold text-primary-400 my-1">{exam.users.toLocaleString()}</p>
              <p className="text-sm text-surface-400">
                {exam.conversion}% conv.
                <span className={`ml-1 ${
                  exam.trend === 'up' ? 'text-green-400' :
                  exam.trend === 'down' ? 'text-red-400' : 'text-surface-400'
                }`}>
                  {exam.trend === 'up' ? '↑' : exam.trend === 'down' ? '↓' : '→'}
                </span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Chart Placeholder */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Revenue Trend</h3>
          <button className="btn btn-sm bg-surface-700 hover:bg-surface-600">
            📥 Export Report
          </button>
        </div>
        <div className="h-64 flex items-center justify-center text-surface-400 bg-surface-800/30 rounded-xl">
          <div className="text-center">
            <span className="text-4xl mb-2 block">📊</span>
            <p>Revenue chart visualization</p>
            <p className="text-sm">Connect to analytics backend</p>
          </div>
        </div>
      </div>
    </div>
  );
}
