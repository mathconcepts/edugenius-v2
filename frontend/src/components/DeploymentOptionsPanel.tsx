/**
 * DeploymentOptionsPanel
 *
 * CEO-facing UI showing all 5 EduGenius deployment options.
 * Includes cost comparison, quick-start commands, and current
 * deployment status badge.
 *
 * Used on: CEO Dashboard / Settings / Infrastructure page
 */

import React, { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types (mirrors src/deployment/options.ts — kept local to avoid backend import)
// ─────────────────────────────────────────────────────────────────────────────

type DeploymentTier = 'local' | 'hybrid' | 'paas' | 'aws' | 'gcp';

interface DeploymentOption {
  id: DeploymentTier;
  name: string;
  description: string;
  emoji: string;
  bestFor: string[];
  pros: string[];
  cons: string[];
  costRange: { min: number; max: number };
  difficulty: 1 | 2 | 3 | 4 | 5;
  quickStart: string;
  docsAnchor: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Static Data
// ─────────────────────────────────────────────────────────────────────────────

const DEPLOYMENT_OPTIONS: DeploymentOption[] = [
  {
    id: 'local',
    name: 'Totally Local',
    description:
      'Everything runs on your hardware via Docker Compose — Postgres, Redis, backend, frontend. ' +
      'Zero cloud bills. Full data privacy. Single command to start.',
    emoji: '🖥️',
    bestFor: ['Development', 'Privacy-first', 'Home server / Raspberry Pi', 'Zero budget'],
    pros: ['No cloud bills', 'Full data privacy', 'Works offline', 'One command: docker compose up'],
    cons: ['No HA/redundancy', 'Uptime tied to local machine', 'Manual backups'],
    costRange: { min: 0, max: 5 },
    difficulty: 1,
    quickStart: 'docker compose up -d',
    docsAnchor: '#local',
  },
  {
    id: 'hybrid',
    name: 'Local + Cloud Hybrid',
    description:
      'Backend runs locally; Supabase handles the database and Cloudinary serves media. ' +
      'Cloud durability without cloud compute bills.',
    emoji: '🔀',
    bestFor: ['Solo founders', 'Reliable DB without ops', 'Dev → staging workflow'],
    pros: ['Cloud-grade DB (Supabase)', 'Cloudinary CDN for media', 'Cheap to run', 'Easy .env switch'],
    cons: ['Backend still local', 'Supabase free tier row limits', 'Internet latency to DB'],
    costRange: { min: 0, max: 25 },
    difficulty: 2,
    quickStart: 'bash scripts/deploy-hybrid.sh',
    docsAnchor: '#hybrid',
  },
  {
    id: 'paas',
    name: 'Cloud: PaaS (Railway)',
    description:
      'One command deploys backend + Postgres plugin + Redis plugin to Railway.app. ' +
      'Automatic HTTPS, custom domains, GitHub CI/CD. Zero DevOps.',
    emoji: '🚂',
    bestFor: ['Zero DevOps', 'MVP launches', 'Early-stage SaaS', 'Teams without cloud expertise'],
    pros: ['One command: railway up', 'Managed Postgres + Redis', 'Automatic HTTPS', 'GitHub CI/CD'],
    cons: ['Less control than raw cloud', 'Pricier at scale', 'Railway lock-in'],
    costRange: { min: 5, max: 40 },
    difficulty: 2,
    quickStart: 'bash scripts/deploy-railway.sh',
    docsAnchor: '#paas',
  },
  {
    id: 'aws',
    name: 'Cloud: AWS (ECS Fargate)',
    description:
      'Production-grade AWS with ECS Fargate + RDS Postgres + S3 + CloudFront. ' +
      'Auto-scaling, multi-zone, compliance-ready. No EC2 management.',
    emoji: '🟠',
    bestFor: ['Enterprise workloads', 'Existing AWS infra', 'High scale (>10k users)', 'Multi-region'],
    pros: ['Auto-scaling Fargate', 'RDS managed backups', 'CloudFront CDN', 'AWS compliance certs'],
    cons: ['Steep learning curve', 'Complex IAM', 'Higher baseline cost', 'CDK required'],
    costRange: { min: 30, max: 80 },
    difficulty: 4,
    quickStart: 'bash scripts/deploy-aws.sh',
    docsAnchor: '#aws',
  },
  {
    id: 'gcp',
    name: 'Cloud: GCP (Cloud Run)',
    description:
      'Serverless Cloud Run (scales to zero) + Cloud SQL + GCS. ' +
      'Cheapest cloud option for low traffic. Vertex AI nearby for future ML.',
    emoji: '🔵',
    bestFor: ['Startups watching spend', 'Spiky/variable traffic', 'Google Workspace users', 'AI/ML roadmap'],
    pros: ['Scales to zero — no idle cost', 'Cheapest cloud option', 'Cloud SQL managed', 'Vertex AI ready'],
    cons: ['Cold start latency (~1s)', 'Cloud SQL min cost', 'GCP console learning curve'],
    costRange: { min: 10, max: 40 },
    difficulty: 3,
    quickStart: 'bash scripts/deploy-gcp.sh',
    docsAnchor: '#gcp',
  },
];

const BATCH_JOBS = [
  { id: 'atlas:content-generation', agent: 'Atlas', schedule: '2:00 AM daily',     description: 'Nightly content generation' },
  { id: 'scout:market-scan',        agent: 'Scout', schedule: 'Mon 6:00 AM',        description: 'Weekly market intelligence' },
  { id: 'oracle:analytics-summary', agent: 'Oracle', schedule: 'Every 6h',          description: 'Analytics aggregation' },
  { id: 'herald:campaign-check',    agent: 'Herald', schedule: '8:00 AM daily',     description: 'Campaign health check' },
  { id: 'forge:health-check',       agent: 'Forge',  schedule: 'Every 30 minutes',  description: 'Infrastructure health check' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function DifficultyBadge({ level }: { level: number }) {
  const labels = ['', 'Easiest', 'Easy', 'Moderate', 'Advanced', 'Expert'];
  const colors = ['', 'bg-emerald-100 text-emerald-700', 'bg-green-100 text-green-700',
    'bg-yellow-100 text-yellow-700', 'bg-orange-100 text-orange-700', 'bg-red-100 text-red-700'];
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[level]}`}>
      {labels[level]}
    </span>
  );
}

function CostBadge({ min, max }: { min: number; max: number }) {
  const color = min === 0 ? 'text-emerald-600 bg-emerald-50' :
    min < 15 ? 'text-blue-600 bg-blue-50' : 'text-purple-600 bg-purple-50';
  return (
    <span className={`text-sm font-semibold px-3 py-1 rounded-lg ${color}`}>
      {min === 0 && max <= 5 ? 'Free / ~$3 electricity' : `$${min}–$${max}/mo`}
    </span>
  );
}

interface OptionCardProps {
  option: DeploymentOption;
  isActive: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

function OptionCard({ option, isActive, isSelected, onSelect }: OptionCardProps) {
  const [copied, setCopied] = useState(false);

  const copyCommand = () => {
    navigator.clipboard.writeText(option.quickStart).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      onClick={onSelect}
      className={`
        relative border-2 rounded-xl p-5 cursor-pointer transition-all duration-200
        ${isSelected
          ? 'border-indigo-500 bg-indigo-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'}
      `}
    >
      {/* Active badge */}
      {isActive && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          Active
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl">{option.emoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm">{option.name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <DifficultyBadge level={option.difficulty} />
            <CostBadge min={option.costRange.min} max={option.costRange.max} />
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600 mb-3 leading-relaxed">{option.description}</p>

      {/* Best for */}
      <div className="mb-3">
        <p className="text-xs font-medium text-gray-500 mb-1.5">Best for:</p>
        <div className="flex flex-wrap gap-1">
          {option.bestFor.map(tag => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Quick-start command */}
      <div
        className="flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-2 mt-3 group"
        onClick={e => { e.stopPropagation(); copyCommand(); }}
      >
        <span className="text-gray-400 text-xs font-mono flex-1 truncate">
          $ {option.quickStart}
        </span>
        <button className="text-xs text-gray-400 group-hover:text-white transition-colors shrink-0">
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

function OptionDetail({ option }: { option: DeploymentOption }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{option.emoji}</span>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{option.name}</h2>
          <p className="text-sm text-gray-500">{option.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <h4 className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">
            ✅ Pros
          </h4>
          <ul className="space-y-1">
            {option.pros.map(p => (
              <li key={p} className="text-sm text-gray-700 flex items-start gap-1.5">
                <span className="text-emerald-500 mt-0.5">•</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">
            ⚠️ Cons
          </h4>
          <ul className="space-y-1">
            {option.cons.map(c => (
              <li key={c} className="text-sm text-gray-700 flex items-start gap-1.5">
                <span className="text-red-400 mt-0.5">•</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Quick Start
        </h4>
        <code className="text-sm text-gray-800 font-mono block">
          $ {option.quickStart}
        </code>
        <p className="text-xs text-gray-400 mt-1">
          See docs/19-deployment-options.md for full walkthrough.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Panel
// ─────────────────────────────────────────────────────────────────────────────

interface DeploymentOptionsPanelProps {
  /** Currently active deployment tier (detected from env or passed from API) */
  activeTier?: DeploymentTier;
  className?: string;
}

export function DeploymentOptionsPanel({
  activeTier = 'hybrid',
  className = '',
}: DeploymentOptionsPanelProps) {
  const [selectedTier, setSelectedTier] = useState<DeploymentTier>(activeTier);
  const [showBatchJobs, setShowBatchJobs] = useState(false);
  const [activeTab, setActiveTab] = useState<'options' | 'costs' | 'agents'>('options');

  const selectedOption = DEPLOYMENT_OPTIONS.find(o => o.id === selectedTier)!;

  return (
    <div className={`space-y-6 ${className}`}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">🚀 Deployment Options</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Choose how and where EduGenius runs.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Current:</span>
          <span className="font-semibold text-indigo-600">
            {DEPLOYMENT_OPTIONS.find(o => o.id === activeTier)?.emoji}{' '}
            {DEPLOYMENT_OPTIONS.find(o => o.id === activeTier)?.name}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['options', 'costs', 'agents'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              px-4 py-2 text-sm font-medium capitalize transition-colors
              ${activeTab === tab
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'}
            `}
          >
            {tab === 'options' ? '🔧 Options' : tab === 'costs' ? '💰 Cost Comparison' : '🤖 Agent Impact'}
          </button>
        ))}
      </div>

      {/* Tab: Options */}
      {activeTab === 'options' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEPLOYMENT_OPTIONS.map(option => (
              <OptionCard
                key={option.id}
                option={option}
                isActive={option.id === activeTier}
                isSelected={option.id === selectedTier}
                onSelect={() => setSelectedTier(option.id)}
              />
            ))}
          </div>
          {selectedOption && (
            <OptionDetail option={selectedOption} />
          )}
        </div>
      )}

      {/* Tab: Cost Comparison */}
      {activeTab === 'costs' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Option</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Est. Cost/Month</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Compute</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Database</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Difficulty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                { tier: 'local' as const,  compute: '$0', db: '$0 (local)',       difficulty: 1 },
                { tier: 'hybrid' as const, compute: '$0', db: '$0 (Supabase)',    difficulty: 2 },
                { tier: 'paas' as const,   compute: '$8', db: '$10 (Railway)',    difficulty: 2 },
                { tier: 'gcp' as const,    compute: '$5', db: '$18 (Cloud SQL)',  difficulty: 3 },
                { tier: 'aws' as const,    compute: '$20', db: '$30 (RDS)',       difficulty: 4 },
              ].map(row => {
                const opt = DEPLOYMENT_OPTIONS.find(o => o.id === row.tier)!;
                return (
                  <tr
                    key={row.tier}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                      activeTier === row.tier ? 'bg-indigo-50' : ''
                    }`}
                    onClick={() => { setSelectedTier(row.tier); setActiveTab('options'); }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{opt.emoji}</span>
                        <span className="font-medium text-gray-900">{opt.name}</span>
                        {activeTier === row.tier && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <CostBadge min={opt.costRange.min} max={opt.costRange.max} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{row.compute}</td>
                    <td className="px-4 py-3 text-gray-600">{row.db}</td>
                    <td className="px-4 py-3">
                      <DifficultyBadge level={row.difficulty} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-amber-50 border-t border-amber-100">
            <p className="text-xs text-amber-700">
              💡 Costs are estimates at ~100 daily active users. Actual costs vary with usage.
              GCP Cloud Run scales to zero — ideal for early-stage launches.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Agent Impact */}
      {activeTab === 'agents' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-800">Agent Capabilities by Deployment Tier</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                All agents run in all tiers. Batch scheduling method varies.
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Agent</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">🖥️ Local</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">🔀 Hybrid</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">🚂 Railway</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">🟠 AWS</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">🔵 GCP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { agent: '📚 Atlas', scheduling: ['cron', 'cron', 'cron', 'EventBridge', 'Cloud Scheduler'] },
                  { agent: '🔍 Scout', scheduling: ['cron', 'cron', 'cron', 'EventBridge', 'Cloud Scheduler'] },
                  { agent: '📊 Oracle', scheduling: ['cron', 'cron', 'cron', 'EventBridge', 'Cloud Scheduler'] },
                  { agent: '📣 Herald', scheduling: ['cron', 'cron', 'cron', 'EventBridge', 'Cloud Scheduler'] },
                  { agent: '⚙️ Forge', scheduling: ['cron', 'cron', 'cron', 'EventBridge', 'Cloud Scheduler'] },
                  { agent: '🧑‍🏫 Sage',   scheduling: ['real-time', 'real-time', 'real-time', 'real-time', 'real-time'] },
                  { agent: '👨‍🎓 Mentor', scheduling: ['real-time', 'real-time', 'real-time', 'real-time', 'real-time'] },
                ].map(row => (
                  <tr key={row.agent} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{row.agent}</td>
                    {row.scheduling.map((s, i) => (
                      <td key={i} className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          s === 'real-time'
                            ? 'bg-blue-100 text-blue-700'
                            : s === 'cron'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {s}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Batch jobs table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
              onClick={() => setShowBatchJobs(!showBatchJobs)}
            >
              <h3 className="font-semibold text-gray-800">🕐 Batch Job Schedule</h3>
              <span className="text-gray-400 text-sm">{showBatchJobs ? '▲ Hide' : '▼ Show'}</span>
            </div>
            {showBatchJobs && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Job ID</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Agent</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Schedule</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Description</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Run Manually</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {BATCH_JOBS.map(job => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <code className="text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                          {job.id}
                        </code>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-gray-700">{job.agent}</td>
                      <td className="px-4 py-2.5 text-gray-600">{job.schedule}</td>
                      <td className="px-4 py-2.5 text-gray-600">{job.description}</td>
                      <td className="px-4 py-2.5">
                        <code className="text-xs text-gray-500 font-mono">
                          batch-run.sh {job.id}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DeploymentOptionsPanel;
