/**
 * Analytics Page - CEO/Admin analytics dashboard
 * AI-powered insights from Oracle agent
 */

import { useState } from 'react';

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

const funnelData = [
  { stage: 'Visitors', count: 45000, rate: 100 },
  { stage: 'Signups', count: 8500, rate: 18.9 },
  { stage: 'Activated', count: 5200, rate: 61.2 },
  { stage: 'Engaged', count: 3800, rate: 73.1 },
  { stage: 'Converted', count: 1200, rate: 31.6 },
];

const abTests = [
  { id: '1', name: 'Pricing Page CTA', status: 'running', confidence: 87, winner: 'Variant B', lift: '+12%' },
  { id: '2', name: 'Onboarding Flow', status: 'running', confidence: 62, winner: 'Variant A', lift: '+5%' },
  { id: '3', name: 'Landing Page Hero', status: 'completed', confidence: 95, winner: 'Variant C', lift: '+24%' },
];

export default function Analytics() {
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');

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

      {/* AI Insights */}
      <div className="card bg-gradient-to-r from-accent-600/10 to-primary-600/10 border-accent-500/30">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-accent-500/20 rounded-xl">
            <span className="text-2xl">🔮</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white mb-2">Oracle AI Insights</h3>
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
        {/* Conversion Funnel */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Conversion Funnel</h3>
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
                    style={{ width: `${stage.rate}%` }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-white">
                    {i > 0 && `${stage.rate}%`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* A/B Tests */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Active A/B Tests</h3>
          <div className="space-y-3">
            {abTests.map(test => (
              <div key={test.id} className="p-4 bg-surface-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">{test.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    test.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {test.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-surface-400">
                    {test.confidence}% confidence • {test.winner} winning
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
