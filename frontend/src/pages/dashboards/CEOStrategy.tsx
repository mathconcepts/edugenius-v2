/**
 * CEO Strategy Dashboard
 * Autonomous growth strategy management
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
type Priority = 'critical' | 'high' | 'medium' | 'low';
type Status = 'pending' | 'approved' | 'rejected' | 'in_progress' | 'completed';

interface Recommendation {
  id: string;
  title: string;
  description: string;
  rationale: string;
  priority: Priority;
  status: Status;
  confidence: number;
  projectedImpact: {
    users: number;
    revenue: number;
    timeframe: string;
  };
  actions: {
    title: string;
    owner: string;
    effort: string;
  }[];
  risks: string[];
  timestamp: Date;
  autoApprove: boolean;
}

interface Playbook {
  id: string;
  name: string;
  description: string;
  phase: string;
  targetSegment: string;
  automationLevel: 'manual' | 'semi_auto' | 'full_auto';
  successRate: number;
  timesExecuted: number;
}

interface ChannelPerformance {
  channel: string;
  users: number;
  cost: number;
  cac: number;
  revenue: number;
  roi: number;
}

interface SegmentHealth {
  segment: string;
  users: number;
  growth: number;
  satisfaction: number;
  churn: number;
}

// Mock data
const mockRecommendations: Recommendation[] = [
  {
    id: 'rec_1',
    title: 'Scale Organic Search - High ROI',
    description: 'Organic search has 15x ROI - opportunity to double content output',
    rationale: 'Top performing channel with room to grow',
    priority: 'high',
    status: 'pending',
    confidence: 0.85,
    projectedImpact: { users: 400, revenue: 60000, timeframe: '30 days' },
    actions: [
      { title: 'Generate 20 JEE PYQ blog posts', owner: 'Atlas', effort: 'medium' },
      { title: 'Optimize existing content', owner: 'Herald', effort: 'low' },
    ],
    risks: ['Content quality may drop with volume'],
    timestamp: new Date(),
    autoApprove: false,
  },
  {
    id: 'rec_2',
    title: 'Launch NEET Acquisition Campaign',
    description: 'NEET segment growing 12% but underserved',
    rationale: 'High growth segment with low competition',
    priority: 'medium',
    status: 'pending',
    confidence: 0.72,
    projectedImpact: { users: 500, revenue: 75000, timeframe: '45 days' },
    actions: [
      { title: 'Create NEET-specific landing page', owner: 'Herald', effort: 'medium' },
      { title: 'Generate NCERT biology content', owner: 'Atlas', effort: 'high' },
      { title: 'Run Telegram community campaign', owner: 'Herald', effort: 'low' },
    ],
    risks: ['Different audience psychology than JEE'],
    timestamp: new Date(),
    autoApprove: false,
  },
  {
    id: 'rec_3',
    title: 'Pause Paid Search - Negative ROI',
    description: 'Paid search has 2.5x ROI - below target of 3x',
    rationale: 'Reallocate budget to higher performing channels',
    priority: 'critical',
    status: 'pending',
    confidence: 0.92,
    projectedImpact: { users: 0, revenue: 15000, timeframe: '7 days' },
    actions: [
      { title: 'Pause underperforming campaigns', owner: 'Herald', effort: 'low' },
      { title: 'Reallocate to organic + social', owner: 'Herald', effort: 'low' },
    ],
    risks: ['May miss some high-intent users'],
    timestamp: new Date(),
    autoApprove: true,
  },
];

const mockPlaybooks: Playbook[] = [
  {
    id: 'pb_1',
    name: 'JEE Organic Acquisition',
    description: 'Capture JEE aspirants through SEO, YouTube, and community',
    phase: 'growth',
    targetSegment: 'aspirants_jee',
    automationLevel: 'semi_auto',
    successRate: 0.78,
    timesExecuted: 12,
  },
  {
    id: 'pb_2',
    name: 'Churn Prevention',
    description: 'Identify and save at-risk users before they churn',
    phase: 'optimization',
    targetSegment: 'all',
    automationLevel: 'full_auto',
    successRate: 0.65,
    timesExecuted: 45,
  },
  {
    id: 'pb_3',
    name: 'Free to Paid Conversion',
    description: 'Convert engaged free users to paid subscriptions',
    phase: 'monetization',
    targetSegment: 'all',
    automationLevel: 'semi_auto',
    successRate: 0.42,
    timesExecuted: 8,
  },
  {
    id: 'pb_4',
    name: 'Competitor Price Response',
    description: 'Respond to competitor pricing changes',
    phase: 'competitive',
    targetSegment: 'all',
    automationLevel: 'manual',
    successRate: 0.85,
    timesExecuted: 3,
  },
];

const mockChannels: ChannelPerformance[] = [
  { channel: 'Organic Search', users: 800, cost: 8000, cac: 100, revenue: 120000, roi: 15 },
  { channel: 'YouTube', users: 500, cost: 10000, cac: 200, revenue: 75000, roi: 7.5 },
  { channel: 'Social Organic', users: 300, cost: 2000, cac: 67, revenue: 45000, roi: 22.5 },
  { channel: 'Referral', users: 200, cost: 3000, cac: 150, revenue: 36000, roi: 12 },
  { channel: 'Paid Search', users: 400, cost: 24000, cac: 600, revenue: 60000, roi: 2.5 },
];

const mockSegments: SegmentHealth[] = [
  { segment: 'JEE Aspirants', users: 8000, growth: 0.15, satisfaction: 4.2, churn: 0.04 },
  { segment: 'NEET Aspirants', users: 5000, growth: 0.12, satisfaction: 4.0, churn: 0.05 },
  { segment: 'CBSE 12', users: 1500, growth: 0.08, satisfaction: 3.8, churn: 0.06 },
  { segment: 'CBSE 10', users: 500, growth: 0.05, satisfaction: 3.5, churn: 0.08 },
];

// Components
const PriorityBadge: React.FC<{ priority: Priority }> = ({ priority }) => {
  const styles: Record<Priority, string> = {
    critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 animate-pulse',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    low: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[priority]}`}>
      {priority.toUpperCase()}
    </span>
  );
};

const ConfidenceBar: React.FC<{ confidence: number }> = ({ confidence }) => {
  const percent = Math.round(confidence * 100);
  const color = percent >= 80 ? 'bg-green-500' : percent >= 60 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-gray-500">{percent}%</span>
    </div>
  );
};

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
}> = ({ title, value, subtitle, trend, trendValue }) => {
  const trendColors = {
    up: 'text-green-500',
    down: 'text-red-500',
    stable: 'text-gray-500',
  };
  const trendIcons = {
    up: '↑',
    down: '↓',
    stable: '→',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
        {trend && trendValue && (
          <span className={`text-xs ${trendColors[trend]}`}>
            {trendIcons[trend]} {trendValue}
          </span>
        )}
      </div>
    </div>
  );
};

const RecommendationCard: React.FC<{
  rec: Recommendation;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onExpand: (id: string) => void;
  isExpanded: boolean;
}> = ({ rec, onApprove, onReject, onExpand, isExpanded }) => {
  return (
    <motion.div
      layout
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <PriorityBadge priority={rec.priority} />
              {rec.autoApprove && (
                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                  🤖 Auto-eligible
                </span>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{rec.title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{rec.description}</p>
          </div>
          <ConfidenceBar confidence={rec.confidence} />
        </div>

        {/* Impact Preview */}
        <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <div>
            <p className="text-xs text-gray-500">Users</p>
            <p className="font-semibold text-gray-900 dark:text-white">+{rec.projectedImpact.users}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Revenue</p>
            <p className="font-semibold text-green-600">₹{rec.projectedImpact.revenue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Timeframe</p>
            <p className="font-semibold text-gray-900 dark:text-white">{rec.projectedImpact.timeframe}</p>
          </div>
        </div>

        {/* Expanded Details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-4 mb-4"
            >
              {/* Rationale */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Rationale</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{rec.rationale}</p>
              </div>

              {/* Actions */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Actions</p>
                <div className="space-y-2">
                  {rec.actions.map((action, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-gray-700 dark:text-gray-300">{action.title}</span>
                      <span className="text-xs text-gray-500">@{action.owner}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        action.effort === 'low' ? 'bg-green-100 text-green-700' :
                        action.effort === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {action.effort}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risks */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Risks</p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  {rec.risks.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-yellow-500">⚠️</span>
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(rec.id)}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            ✓ Approve
          </button>
          <button
            onClick={() => onReject(rec.id)}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            ✗ Reject
          </button>
          <button
            onClick={() => onExpand(rec.id)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {isExpanded ? '↑' : '↓'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// Main Component
export const CEOStrategy: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'recommendations' | 'playbooks' | 'performance' | 'settings'>('recommendations');
  const [recommendations, setRecommendations] = useState(mockRecommendations);
  const [expandedRec, setExpandedRec] = useState<string | null>(null);
  const [autonomousMode, setAutonomousMode] = useState(true);
  const [autoApproveThreshold, setAutoApproveThreshold] = useState(85);

  const handleApprove = (id: string) => {
    setRecommendations(prev => prev.map(r => 
      r.id === id ? { ...r, status: 'approved' as Status } : r
    ));
  };

  const handleReject = (id: string) => {
    setRecommendations(prev => prev.map(r => 
      r.id === id ? { ...r, status: 'rejected' as Status } : r
    ));
  };

  const pendingRecs = recommendations.filter(r => r.status === 'pending');
  const criticalRecs = pendingRecs.filter(r => r.priority === 'critical');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            🎯 Growth Strategy
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Autonomous growth recommendations and execution
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
            autonomousMode 
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${autonomousMode ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-sm font-medium">
              {autonomousMode ? 'Autonomous Mode ON' : 'Manual Mode'}
            </span>
          </div>
        </div>
      </div>

      {/* Critical Alerts */}
      {criticalRecs.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-200">
                {criticalRecs.length} Critical Action{criticalRecs.length > 1 ? 's' : ''} Required
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {criticalRecs.map(r => r.title).join(' • ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard title="Active Users" value="4,500" trend="up" trendValue="12%" />
        <MetricCard title="MRR" value="₹4.5L" trend="up" trendValue="8%" />
        <MetricCard title="LTV/CAC" value="15x" trend="stable" trendValue="0%" />
        <MetricCard title="Churn" value="4.5%" trend="down" trendValue="-0.5%" />
        <MetricCard title="NPS" value="45" trend="up" trendValue="+3" />
        <MetricCard title="Pending" value={pendingRecs.length} subtitle="decisions" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {[
            { id: 'recommendations', label: 'Recommendations', count: pendingRecs.length },
            { id: 'playbooks', label: 'Playbooks' },
            { id: 'performance', label: 'Performance' },
            { id: 'settings', label: 'Settings' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'recommendations' && (
        <div className="space-y-4">
          {pendingRecs.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-4xl">✨</span>
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                All caught up!
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                No pending recommendations. Strategy is running autonomously.
              </p>
            </div>
          ) : (
            pendingRecs
              .sort((a, b) => {
                const order = { critical: 0, high: 1, medium: 2, low: 3 };
                return order[a.priority] - order[b.priority];
              })
              .map(rec => (
                <RecommendationCard
                  key={rec.id}
                  rec={rec}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onExpand={(id) => setExpandedRec(expandedRec === id ? null : id)}
                  isExpanded={expandedRec === rec.id}
                />
              ))
          )}
        </div>
      )}

      {activeTab === 'playbooks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mockPlaybooks.map(pb => (
            <div key={pb.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{pb.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{pb.description}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded ${
                  pb.automationLevel === 'full_auto' ? 'bg-green-100 text-green-700' :
                  pb.automationLevel === 'semi_auto' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {pb.automationLevel.replace('_', ' ')}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500">Success Rate</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{Math.round(pb.successRate * 100)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Executions</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{pb.timesExecuted}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Phase</p>
                  <p className="font-semibold text-gray-900 dark:text-white capitalize">{pb.phase}</p>
                </div>
              </div>
              
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                ▶ Trigger Playbook
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Channel Performance */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Channel Performance</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Users</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CAC</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {mockChannels
                    .sort((a, b) => b.roi - a.roi)
                    .map(ch => (
                    <tr key={ch.channel}>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{ch.channel}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{ch.users}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">₹{ch.cost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">₹{ch.cac}</td>
                      <td className="px-4 py-3 text-right text-green-600">₹{ch.revenue.toLocaleString()}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${ch.roi >= 3 ? 'text-green-600' : 'text-red-600'}`}>
                        {ch.roi}x
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Segment Health */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Segment Health</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {mockSegments.map(seg => (
                <div key={seg.segment} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{seg.segment}</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Users</span>
                      <span className="font-medium">{seg.users.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Growth</span>
                      <span className="font-medium text-green-600">+{Math.round(seg.growth * 100)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Satisfaction</span>
                      <span className="font-medium">{seg.satisfaction}/5</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Churn</span>
                      <span className={`font-medium ${seg.churn > 0.05 ? 'text-red-600' : 'text-green-600'}`}>
                        {Math.round(seg.churn * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Autonomous Mode</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Enable Autonomous Actions</p>
                  <p className="text-sm text-gray-500">Allow strategy engine to execute low-risk actions automatically</p>
                </div>
                <button
                  onClick={() => setAutonomousMode(!autonomousMode)}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    autonomousMode ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    autonomousMode ? 'left-8' : 'left-1'
                  }`} />
                </button>
              </div>

              <div>
                <label className="block font-medium text-gray-900 dark:text-white mb-2">
                  Auto-Approve Threshold: {autoApproveThreshold}%
                </label>
                <input
                  type="range"
                  min="60"
                  max="95"
                  value={autoApproveThreshold}
                  onChange={(e) => setAutoApproveThreshold(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Recommendations with confidence ≥ {autoApproveThreshold}% will be auto-approved
                </p>
              </div>

              <div>
                <label className="block font-medium text-gray-900 dark:text-white mb-2">
                  Max Auto-Approve Spend
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                  <option value="1000">₹1,000 per action</option>
                  <option value="5000">₹5,000 per action</option>
                  <option value="10000">₹10,000 per action</option>
                  <option value="25000">₹25,000 per action</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-900 dark:text-white mb-2">
                  Risk Tolerance
                </label>
                <div className="flex gap-2">
                  {['conservative', 'moderate', 'aggressive'].map(level => (
                    <button
                      key={level}
                      className={`flex-1 px-4 py-2 rounded-lg border capitalize ${
                        level === 'moderate'
                          ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30'
                          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            Save Settings
          </button>
        </div>
      )}

      {/* Agent Connections */}
      <div className="mt-8 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
        <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-4">
          🤖 Connected Agents
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { id: 'scout', emoji: '🔍', name: 'Scout', role: 'Intelligence' },
            { id: 'oracle', emoji: '📊', name: 'Oracle', role: 'Analytics' },
            { id: 'herald', emoji: '📢', name: 'Herald', role: 'Marketing' },
            { id: 'atlas', emoji: '📚', name: 'Atlas', role: 'Content' },
            { id: 'mentor', emoji: '👨‍🏫', name: 'Mentor', role: 'Engagement' },
            { id: 'forge', emoji: '⚙️', name: 'Forge', role: 'Technical' },
          ].map(agent => (
            <div key={agent.id} className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white dark:bg-gray-800 shadow flex items-center justify-center text-2xl">
                {agent.emoji}
              </div>
              <p className="font-medium text-gray-900 dark:text-white text-sm">{agent.name}</p>
              <p className="text-xs text-gray-500">{agent.role}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-purple-700 dark:text-purple-300 mt-4 text-center">
          Strategy receives data from all agents and dispatches actions based on recommendations
        </p>
      </div>
    </div>
  );
};

export default CEOStrategy;