/**
 * OpportunityDiscovery.tsx
 * CEO tool: Discover what exam to build next using real external intelligence.
 * Route: /opportunity-discovery
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, TrendingUp, Newspaper, Zap, BarChart3,
  ChevronRight, Play, CheckCircle2, AlertCircle,
  Clock, RefreshCw, ArrowRight, Star, DollarSign,
  Target, X, Cpu, Network, ExternalLink, Layers, Brain,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  MOCK_TREND_KEYWORDS, MOCK_COMPETITORS, MOCK_NEWS,
  MOCK_PAIN_POINTS, MOCK_OPPORTUNITIES,
  type TrendKeyword, type CompetitorEntry, type NewsItem,
  type PainPoint, type OpportunityEntry,
} from '@/services/businessAgents';
import {
  OPPORTUNITY_STEPS, OPPORTUNITY_PHASES,
  type OppStep,
} from '@/services/opportunityWorkflow';
import {
  generateConnectionManifest, saveConnectionManifest, loadConnectionManifest, applyManifestDefaults,
  type ConnectionManifest, type RequiredConnection,
} from '@/services/opportunityConnections';
import { DEFAULT_HEURISTICS, resolveLLM, type LLMHeuristicRule } from '@/services/llmHeuristics';

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function ScoreBadge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  const color = score >= 80 ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : score >= 65 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30';
  return (
    <span className={clsx('border rounded-full font-bold', color,
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
    )}>{score}/100</span>
  );
}

function DimBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[10px] text-surface-400">{label}</span>
        <span className="text-[10px] font-medium">{value}</span>
      </div>
      <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.8 }}
          className={clsx('h-full rounded-full', color)} />
      </div>
    </div>
  );
}

// ─── Intelligence Feed tab ────────────────────────────────────────────────────

function TrendRadarPanel({ keywords }: { keywords: TrendKeyword[] }) {
  return (
    <div className="card h-full">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📡</span>
        <h3 className="font-semibold text-sm">Trend Radar</h3>
        <span className="text-[10px] text-surface-500 ml-auto">via Brave Search</span>
      </div>
      <div className="space-y-1.5 overflow-y-auto max-h-[340px]">
        {keywords.map(kw => (
          <div key={kw.keyword} className="flex items-center gap-2 p-2 rounded-lg bg-surface-800/50 hover:bg-surface-800 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{kw.keyword}</p>
              <p className="text-[10px] text-surface-500">{kw.monthlySearchVolume.toLocaleString()}/mo</p>
            </div>
            <span className={clsx('text-xs font-bold', kw.yoyGrowth >= 30 ? 'text-green-400' : kw.yoyGrowth >= 10 ? 'text-amber-400' : 'text-surface-400')}>
              +{kw.yoyGrowth}%
            </span>
            <ScoreBadge score={kw.opportunityScore} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CompetitorMovesPanel({ competitors }: { competitors: CompetitorEntry[] }) {
  return (
    <div className="card h-full">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🕶️</span>
        <h3 className="font-semibold text-sm">Competitor Moves</h3>
        <span className="text-[10px] text-surface-500 ml-auto">Play Store + Brave</span>
      </div>
      <div className="space-y-2 overflow-y-auto max-h-[340px]">
        {competitors.map(c => (
          <div key={c.name} className={clsx(
            'p-2.5 rounded-xl border',
            c.threat === 'high' ? 'border-red-500/20 bg-red-500/5'
              : c.threat === 'medium' ? 'border-amber-500/20 bg-amber-500/5'
              : 'border-surface-700 bg-surface-800/30'
          )}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold">{c.name}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-surface-400">₹{c.price}/mo</span>
                <span className="text-[10px]">{'⭐'.repeat(Math.round(c.rating))}</span>
              </div>
            </div>
            <p className="text-[10px] text-surface-300">{c.recentMove}</p>
            <p className="text-[10px] text-green-400 mt-1">↳ Our response: {c.ourOpportunity}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewsPolicyPanel({ news }: { news: NewsItem[] }) {
  return (
    <div className="card h-full">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📰</span>
        <h3 className="font-semibold text-sm">News & Policy</h3>
        <span className="text-[10px] text-surface-500 ml-auto">NTA/CBSE/UGC</span>
      </div>
      <div className="space-y-2 overflow-y-auto max-h-[340px]">
        {news.map(item => (
          <div key={item.title} className="p-2.5 rounded-xl bg-surface-800/40 hover:bg-surface-800/70 transition-colors">
            <div className="flex items-start gap-2">
              <span className={clsx('flex-shrink-0 text-xs font-bold px-1.5 py-0.5 rounded border',
                item.impact === 'high' ? 'border-red-500/30 text-red-400' :
                item.impact === 'medium' ? 'border-amber-500/30 text-amber-400' : 'border-surface-600 text-surface-400'
              )}>{item.impact.toUpperCase()}</span>
              <div>
                <p className="text-xs font-medium leading-tight">{item.title}</p>
                <p className="text-[10px] text-surface-400 mt-0.5">{item.source} · {item.date}</p>
                <p className="text-[10px] text-primary-400 mt-1">AI: {item.businessImpact}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Opportunity Matrix tab ───────────────────────────────────────────────────

function OpportunityCard({ opp, onAnalyse, onLaunch }: {
  opp: OpportunityEntry;
  onAnalyse: (exam: string) => void;
  onLaunch: (exam: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="card hover:border-primary-500/30 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold">{opp.exam}</h3>
        <ScoreBadge score={opp.compositeScore} />
      </div>

      <div className="space-y-2 mb-4">
        <DimBar label="Demand" value={opp.demandScore} color="bg-blue-500" />
        <DimBar label="Competition Gap" value={opp.competitionGapScore} color="bg-purple-500" />
        <DimBar label="Revenue Potential" value={opp.revenuePotentialScore} color="bg-green-500" />
        <DimBar label="Platform Readiness" value={opp.platformReadinessScore} color="bg-orange-500" />
      </div>

      <div className="flex items-center justify-between mb-3 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
        <span className="text-xs text-surface-400">12-mo forecast</span>
        <span className="text-sm font-bold text-green-400">
          ₹{(opp.monthlyRevenueForecast * 12 / 100000).toFixed(1)}L/yr
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onAnalyse(opp.exam)}
          className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-xs font-medium transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          Analyse
        </button>
        <button
          onClick={() => onLaunch(opp.exam)}
          className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary-500/20 hover:bg-primary-500/30 border border-primary-500/30 text-primary-400 text-xs font-medium transition-colors"
        >
          <Zap className="w-3.5 h-3.5" />
          Fast-Track
        </button>
      </div>
    </motion.div>
  );
}

// ─── Business Pipeline Kanban ─────────────────────────────────────────────────

const pipelineData = {
  researching: [
    { exam: 'SSC CGL', score: 45, agent: 'VentureScout', updated: '2h ago' },
    { exam: 'IBPS PO', score: 52, agent: 'VentureScout', updated: '4h ago' },
  ],
  analysed: [
    { exam: 'UPSC CSE', score: 74, agent: 'Oracle', updated: '1h ago' },
    { exam: 'CAT', score: 79, agent: 'RevenueArchitect', updated: '30m ago' },
  ],
  ready: [
    { exam: 'GATE', score: 82, agent: 'GrowthCommander', updated: '15m ago' },
    { exam: 'CLAT', score: 80, agent: 'GrowthCommander', updated: '45m ago' },
  ],
  live: [
    { exam: 'JEE Main', score: 95, agent: 'All agents', updated: 'Live' },
    { exam: 'NEET', score: 91, agent: 'All agents', updated: 'Live' },
  ],
};

type PipelineStage = keyof typeof pipelineData;

function PipelineKanban({ onLaunch }: { onLaunch: (exam: string) => void }) {
  const columns: { key: PipelineStage; label: string; color: string }[] = [
    { key: 'researching', label: 'Researching 🔍', color: 'border-blue-500/30' },
    { key: 'analysed',    label: 'Analysed 📊',    color: 'border-purple-500/30' },
    { key: 'ready',       label: 'Ready 🚀',        color: 'border-green-500/30' },
    { key: 'live',        label: 'Live ✅',          color: 'border-amber-500/30' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {columns.map(col => (
        <div key={col.key} className={clsx('rounded-xl border p-3', col.color, 'bg-surface-800/30')}>
          <h3 className="text-xs font-semibold mb-3">{col.label}</h3>
          <div className="space-y-2">
            {pipelineData[col.key].map(item => (
              <div key={item.exam} className="p-2.5 rounded-lg bg-surface-800 hover:bg-surface-700 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold">{item.exam}</p>
                  <ScoreBadge score={item.score} size="sm" />
                </div>
                <p className="text-[10px] text-surface-500">{item.agent} · {item.updated}</p>
                {col.key === 'ready' && (
                  <button
                    onClick={() => onLaunch(item.exam)}
                    className="mt-2 w-full text-[10px] py-1 rounded bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-colors"
                  >
                    Move to Launch →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Workflow Runner tab ──────────────────────────────────────────────────────

type StepStatus = 'pending' | 'running' | 'done' | 'gate';

function WorkflowRunner({ onComplete }: { onComplete: (exam: string) => void }) {
  const [selectedExam, setSelectedExam] = useState('GATE');
  const [running, setRunning] = useState(false);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [stepOutputs, setStepOutputs] = useState<Record<string, string>>({});
  const [gateStep, setGateStep] = useState<OppStep | null>(null);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const exams = ['GATE', 'CAT', 'UPSC', 'CLAT', 'NDA', 'CDS'];

  const runWorkflow = async () => {
    setRunning(true);
    setDone(false);
    setStepStatuses({});
    setStepOutputs({});

    for (const step of OPPORTUNITY_STEPS) {
      if (step.requiresCEOApproval) {
        setStepStatuses(p => ({ ...p, [step.id]: 'gate' }));
        setGateStep(step);
        await new Promise<void>(res => {
          const interval = setInterval(() => {
            setGateStep(g => {
              if (!g) { clearInterval(interval); res(); return null; }
              return g;
            });
          }, 300);
        });
        setStepStatuses(p => ({ ...p, [step.id]: 'done' }));
        setStepOutputs(p => ({ ...p, [step.id]: step.sampleOutput(selectedExam) }));
        continue;
      }

      setStepStatuses(p => ({ ...p, [step.id]: 'running' }));
      setExpandedStep(step.id);
      await new Promise(r => setTimeout(r, step.estimatedMs || 2000));
      setStepStatuses(p => ({ ...p, [step.id]: 'done' }));
      setStepOutputs(p => ({ ...p, [step.id]: step.sampleOutput(selectedExam) }));
    }

    setRunning(false);
    setDone(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedExam}
          onChange={e => setSelectedExam(e.target.value)}
          disabled={running}
          className="px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-sm text-white disabled:opacity-50"
        >
          {exams.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <button
          onClick={runWorkflow}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-400 disabled:bg-surface-700 disabled:text-surface-400 text-white text-sm font-semibold transition-all"
        >
          {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? 'Running Discovery...' : 'Run Opportunity Discovery'}
        </button>
        {done && (
          <button
            onClick={() => onComplete(selectedExam)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-semibold hover:bg-green-500/30 transition-all"
          >
            Proceed to Exam Creation <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {OPPORTUNITY_PHASES.map(phase => {
          const phaseSteps = OPPORTUNITY_STEPS.filter(s => s.phase === phase.phase);
          return (
            <div key={phase.phase} className="card overflow-hidden">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{phase.emoji}</span>
                <h3 className={clsx('font-semibold text-sm', phase.color)}>
                  Phase {phase.phase}: {phase.label}
                </h3>
              </div>
              <div className="space-y-1.5">
                {phaseSteps.map(step => {
                  const status = stepStatuses[step.id] || 'pending';
                  const isExpanded = expandedStep === step.id;
                  return (
                    <div key={step.id}>
                      <button
                        onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                        className={clsx(
                          'w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all',
                          status === 'running' && 'bg-primary-500/10 border border-primary-500/20',
                          status === 'done' && 'bg-green-500/5',
                          status === 'gate' && 'bg-amber-500/10 border border-amber-500/20',
                          status === 'pending' && 'bg-surface-800/40',
                        )}
                      >
                        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                          {status === 'running' && <RefreshCw className="w-4 h-4 text-primary-400 animate-spin" />}
                          {status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                          {status === 'gate' && <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />}
                          {status === 'pending' && <Clock className="w-4 h-4 text-surface-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{step.agentEmoji}</span>
                            <p className="text-xs font-medium truncate">{step.action}</p>
                          </div>
                          {step.externalConnections.length > 0 && (
                            <p className="text-[10px] text-blue-400 mt-0.5">
                              🔌 {step.externalConnections.join(' · ')}
                            </p>
                          )}
                        </div>
                      </button>
                      {isExpanded && stepOutputs[step.id] && (
                        <div className="ml-8 mt-1 p-3 rounded-xl bg-surface-900 border border-surface-700">
                          <pre className="text-[10px] text-surface-300 font-mono whitespace-pre-wrap leading-relaxed">
                            {stepOutputs[step.id]}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* CEO Gate Modal */}
      <AnimatePresence>
        {gateStep && (
          <>
            <div className="fixed inset-0 bg-black/60 z-50" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md glass rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold">CEO Decision Required</h3>
              </div>
              <p className="text-sm text-surface-300 mb-4">
                Review the opportunity analysis above. Approve to proceed to pre-launch preparation.
              </p>
              <div className="p-3 rounded-xl bg-surface-800/50 mb-4 text-xs text-surface-300 font-mono">
                Pursuing: <span className="text-primary-400 font-bold">{selectedExam}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setGateStep(null)}
                  className="flex-1 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-400 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve & Continue
                </button>
                <button
                  onClick={() => { setGateStep(null); setRunning(false); }}
                  className="px-4 py-2.5 rounded-xl bg-surface-700 hover:bg-surface-600 text-sm transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'feed',        label: 'Intelligence Feed',   icon: Newspaper },
  { id: 'matrix',     label: 'Opportunity Matrix',   icon: BarChart3 },
  { id: 'pipeline',   label: 'Business Pipeline',    icon: Target },
  { id: 'workflow',   label: 'Run Discovery',         icon: Cpu },
  { id: 'connections',label: 'Required Connections',  icon: Network },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Required Connections Panel ───────────────────────────────────────────────

const PRIORITY_STYLE: Record<string, string> = {
  critical:    'bg-red-500/10 border-red-500/30 text-red-400',
  recommended: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  optional:    'bg-surface-700/50 border-surface-600 text-surface-400',
};

const LLM_PROVIDER_COLOR: Record<string, string> = {
  gemini:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
  anthropic: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  openai:    'bg-green-500/10 text-green-400 border-green-500/30',
  groq:      'bg-orange-500/10 text-orange-400 border-orange-500/30',
  learnlm:   'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  mock:      'bg-surface-700 text-surface-400 border-surface-600',
};

function RequiredConnectionsPanel() {
  const [exam, setExam] = useState('GATE');
  const [manifest, setManifest] = useState<ConnectionManifest | null>(loadConnectionManifest);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'critical' | 'recommended'>('all');
  const [activeSection, setActiveSection] = useState<'connections' | 'llm'>('connections');

  const EXAM_OPTIONS = ['JEE', 'NEET', 'GATE', 'CAT', 'UPSC', 'CBSE', 'CLAT', 'NDA', 'ICSE'];

  function generate() {
    const stored = (() => { try { return JSON.parse(localStorage.getItem('edugenius_connections') || '{}'); } catch { return {}; } })();
    const m = generateConnectionManifest(exam, 89, stored);
    saveConnectionManifest(m);
    setManifest(m);
    setApplied(false);
  }

  function applyDefaults() {
    if (!manifest) return;
    setApplying(true);
    const existing = (() => { try { return JSON.parse(localStorage.getItem('edugenius_connections') || '{}'); } catch { return {}; } })();
    const updated = applyManifestDefaults(manifest, existing);
    localStorage.setItem('edugenius_connections', JSON.stringify(updated));
    window.dispatchEvent(new StorageEvent('storage', { key: 'edugenius_connections', newValue: JSON.stringify(updated) }));
    setTimeout(() => { setApplying(false); setApplied(true); }, 800);
  }

  const filtered = manifest?.requiredConnections.filter(c =>
    priorityFilter === 'all' || c.priority === priorityFilter
  ) ?? [];

  // LLM heuristics summary for this exam
  const llmRules: LLMHeuristicRule[] = DEFAULT_HEURISTICS;

  return (
    <div className="space-y-5">
      {/* Exam selector + generate */}
      <div className="card flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Brain className="w-5 h-5 text-primary-400 shrink-0" />
          <div>
            <p className="font-semibold text-sm">What you'll need to launch</p>
            <p className="text-xs text-surface-400">Select an exam → get the exact connection requirements + LLM setup guide</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={exam}
            onChange={e => { setExam(e.target.value); setApplied(false); }}
            className="input text-sm px-3 py-1.5"
          >
            {EXAM_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <button
            onClick={generate}
            className="btn-primary text-sm px-4 py-1.5 flex items-center gap-1.5"
          >
            <Network className="w-3.5 h-3.5" /> Generate Manifest
          </button>
        </div>
      </div>

      {!manifest && (
        <div className="py-12 text-center text-surface-500">
          <Network className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Select an exam and generate the connection manifest to see what's required.</p>
        </div>
      )}

      {manifest && (
        <>
          {/* Executive summary */}
          <div className={`card border ${manifest.criticalMissing > 0 ? 'border-red-500/30 bg-red-500/5' : 'border-green-500/30 bg-green-500/5'}`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl">{manifest.criticalMissing > 0 ? '⚠️' : '✅'}</span>
              <div className="flex-1">
                <p className="font-semibold text-sm text-white">{manifest.exam} Connection Manifest</p>
                <p className="text-xs text-surface-300 mt-0.5">{manifest.executiveSummary}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-lg font-bold ${manifest.launchReadinessScore >= 70 ? 'text-green-400' : 'text-red-400'}`}>
                  {manifest.launchReadinessScore}/100
                </span>
                <span className="text-[10px] text-surface-500">readiness</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                { label: 'Critical missing', value: manifest.criticalMissing, color: manifest.criticalMissing > 0 ? 'text-red-400' : 'text-green-400' },
                { label: 'Recommended missing', value: manifest.recommendedMissing, color: 'text-yellow-400' },
                { label: 'Est. cost/mo', value: `$${manifest.estimatedTotalMonthlyCostUSD}`, color: 'text-surface-300' },
              ].map(s => (
                <div key={s.label} className="bg-surface-800/60 rounded-xl p-2.5 text-center">
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-surface-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            {manifest.requiredConnections.some(c => c.defaultValue) && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-surface-400">
                  {manifest.requiredConnections.filter(c => c.defaultValue).length} fields have default values ready to pre-fill
                </p>
                <button
                  onClick={applyDefaults}
                  disabled={applying || applied}
                  className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 ${applied ? 'bg-green-600 text-white' : 'btn-primary'}`}
                >
                  {applying ? <><RefreshCw className="w-3 h-3 animate-spin" /> Applying…</> :
                   applied  ? <><CheckCircle2 className="w-3 h-3" /> Applied to Registry</> :
                   <><Layers className="w-3 h-3" /> Apply Defaults to Registry</>}
                </button>
              </div>
            )}
          </div>

          {/* Section tabs */}
          <div className="flex gap-1 bg-surface-800/50 p-1 rounded-xl w-fit">
            {[
              { id: 'connections', label: `🔌 Connections (${manifest.requiredConnections.length})` },
              { id: 'llm',        label: `🧠 LLM Heuristics (${llmRules.length})` },
            ].map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id as typeof activeSection)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeSection === s.id ? 'bg-primary-600 text-white' : 'text-surface-400 hover:text-white'}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* ── Connections section ── */}
          {activeSection === 'connections' && (
            <div className="space-y-3">
              {/* Filter */}
              <div className="flex gap-2">
                {(['all', 'critical', 'recommended'] as const).map(f => (
                  <button key={f} onClick={() => setPriorityFilter(f)}
                    className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors capitalize ${priorityFilter === f ? 'bg-primary-600 text-white' : 'bg-surface-800 text-surface-400 hover:text-white'}`}>
                    {f}
                  </button>
                ))}
              </div>

              {filtered.map((conn, i) => (
                <motion.div
                  key={`${conn.envKey}-${i}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-surface-900 border border-surface-800 rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITY_STYLE[conn.priority]}`}>
                          {conn.priority.toUpperCase()}
                        </span>
                        <span className="text-xs bg-surface-800 text-surface-400 px-2 py-0.5 rounded-full">{conn.category}</span>
                        {conn.alreadyConfigured && (
                          <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Configured
                          </span>
                        )}
                        {conn.examEnvKey && (
                          <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Layers className="w-3 h-3" /> Exam-scoped
                          </span>
                        )}
                      </div>
                      <p className="text-white text-sm font-semibold">{conn.name}</p>
                      <p className="text-surface-400 text-xs mt-0.5">{conn.purpose}</p>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span className="font-mono text-surface-500">
                          {conn.examEnvKey ?? conn.envKey}
                        </span>
                        {conn.defaultValue && (
                          <span className="text-primary-400">
                            default: <code className="font-mono">{conn.defaultValue}</code>
                          </span>
                        )}
                        {conn.estimatedMonthlyCostUSD > 0 && (
                          <span className="text-surface-400">${conn.estimatedMonthlyCostUSD}/mo</span>
                        )}
                      </div>
                    </div>

                    <a href={conn.docsUrl} target="_blank" rel="noreferrer"
                      className="shrink-0 p-1.5 rounded-lg hover:bg-surface-700 transition-colors text-surface-400 hover:text-white">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* ── LLM Heuristics section ── */}
          {activeSection === 'llm' && (
            <div className="space-y-3">
              <div className="p-3 bg-surface-800/50 rounded-xl text-xs text-surface-400 flex items-start gap-2">
                <Brain className="w-4 h-4 text-primary-400 shrink-0 mt-0.5" />
                <span>
                  These are the <strong className="text-white">default LLM choices</strong> for each agent task type.
                  CEO can override any rule marked <span className="text-primary-400">overridable</span> via{' '}
                  <strong className="text-white">/autonomy-settings</strong>.
                  Rules marked <span className="text-red-400">locked</span> protect product quality (e.g., Socratic tutoring always uses LearnLM).
                </span>
              </div>

              {llmRules.map((rule, i) => {
                const decision = resolveLLM({ task: rule.task });
                const providerKey = decision.provider;
                return (
                  <motion.div
                    key={rule.task}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-surface-900 border border-surface-800 rounded-2xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${LLM_PROVIDER_COLOR[providerKey] ?? LLM_PROVIDER_COLOR.mock}`}>
                            {decision.provider} / {decision.model}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${rule.ceoOverridable ? 'bg-surface-700/50 text-surface-400 border-surface-600' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                            {rule.ceoOverridable ? '⚙️ overridable' : '🔒 locked'}
                          </span>
                          <span className="text-xs text-surface-500">Q:{rule.qualityScore}/10 · {rule.targetLatencyMs}ms · ${rule.estimatedCostPer1KTokens.toFixed(5)}/1K tok</span>
                        </div>
                        <p className="text-white text-sm font-semibold capitalize">{rule.task.replace(/_/g, ' ')}</p>
                        <p className="text-surface-400 text-xs mt-0.5">{rule.rationale.split('.')[0]}.</p>
                        {rule.fallbacks.length > 0 && (
                          <p className="text-xs text-surface-600 mt-1">
                            Fallbacks: {rule.fallbacks.map(f => `${f.provider}/${f.model}`).join(' → ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              <div className="p-3 bg-primary-500/5 border border-primary-500/20 rounded-xl flex items-center justify-between">
                <p className="text-xs text-surface-400">Override LLM defaults in Autonomy Settings</p>
                <a href="/autonomy-settings" className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                  ⚙️ Autonomy Settings →
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function OpportunityDiscovery() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('feed');
  const [lastScan] = useState('4 hours ago');
  const [scanning, setScanning] = useState(false);

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => setScanning(false), 2500);
  };

  const handleAnalyse = (exam: string) => {
    setTab('workflow');
    void exam; // will be passed to WorkflowRunner via state in real impl
  };

  const handleLaunch = (exam: string) => {
    navigate(`/create-exam?exam=${encodeURIComponent(exam)}&preanalysed=true`);
  };

  const handleWorkflowComplete = (exam: string) => {
    navigate(`/create-exam?exam=${encodeURIComponent(exam)}&preanalysed=true`);
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            🕵️ Opportunity Discovery
          </h1>
          <p className="text-surface-400 text-sm mt-0.5">
            Find what to build next — powered by VentureScout, RevenueArchitect & GrowthCommander
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-surface-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Last scan: {lastScan}
          </span>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500/20 border border-primary-500/30 text-primary-400 text-sm font-semibold hover:bg-primary-500/30 transition-all disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-4 h-4', scanning && 'animate-spin')} />
            {scanning ? 'Scanning...' : 'Run Intelligence Scan'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface-800/50 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white'
            )}
          >
            <t.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {tab === 'feed' && (
          <motion.div key="feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <TrendRadarPanel keywords={MOCK_TREND_KEYWORDS} />
              <CompetitorMovesPanel competitors={MOCK_COMPETITORS} />
              <NewsPolicyPanel news={MOCK_NEWS} />
            </div>
            {/* Pain points strip */}
            <div className="mt-4 card">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🎙️</span>
                <h3 className="font-semibold text-sm">Audience Pain Mining — Reddit / Quora / Telegram</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {(MOCK_PAIN_POINTS as PainPoint[]).slice(0, 6).map((p, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-surface-800/40">
                    <span className="text-sm font-bold text-surface-500 flex-shrink-0">#{i + 1}</span>
                    <div>
                      <p className="text-xs text-surface-200 leading-snug">{p.pain}</p>
                      <p className="text-[10px] text-surface-500 mt-0.5">{p.frequency} mentions · {p.source}</p>
                      {p.wtpSignal && <p className="text-[10px] text-green-400 mt-0.5">💰 {p.wtpSignal}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {tab === 'matrix' && (
          <motion.div key="matrix" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Top Exam Opportunities — Ranked by Revenue Potential</h2>
              <div className="flex gap-3 text-xs text-surface-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Demand</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" />Gap</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Revenue</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />Readiness</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(MOCK_OPPORTUNITIES as OpportunityEntry[]).map(opp => (
                <OpportunityCard key={opp.exam} opp={opp} onAnalyse={handleAnalyse} onLaunch={handleLaunch} />
              ))}
            </div>
          </motion.div>
        )}

        {tab === 'pipeline' && (
          <motion.div key="pipeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Business Pipeline</h2>
            </div>
            <PipelineKanban onLaunch={handleLaunch} />
            <div className="mt-6 grid grid-cols-3 gap-4">
              {[
                { label: 'Opportunities tracked', value: '10', icon: Search, color: 'text-blue-400' },
                { label: 'Analysed this week', value: '4', icon: TrendingUp, color: 'text-purple-400' },
                { label: 'Ready to launch', value: '2', icon: Zap, color: 'text-green-400' },
              ].map(stat => (
                <div key={stat.label} className="card flex items-center gap-3">
                  <stat.icon className={clsx('w-5 h-5', stat.color)} />
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-surface-400">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {tab === 'workflow' && (
          <motion.div key="workflow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="mb-3">
              <h2 className="font-semibold">Run Opportunity Discovery Workflow</h2>
              <p className="text-xs text-surface-400 mt-0.5">
                12-step intelligence pipeline across 4 phases. Uses Brave Search API + Gemini for real analysis.
              </p>
            </div>
            <WorkflowRunner onComplete={handleWorkflowComplete} />
          </motion.div>
        )}

        {tab === 'connections' && (
          <motion.div key="connections" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="mb-3">
              <h2 className="font-semibold">Required Connections & LLM Heuristics</h2>
              <p className="text-xs text-surface-400 mt-0.5">
                After scouting an exam opportunity, see exactly what API keys, MCPs, and infra you need — with defaults pre-filled.
              </p>
            </div>
            <RequiredConnectionsPanel />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="card bg-gradient-to-r from-primary-500/10 to-accent-500/10 border border-primary-500/20">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-primary-400" />
            <div>
              <p className="font-semibold text-sm">Ready to build your next revenue stream?</p>
              <p className="text-xs text-surface-400">Run discovery then launch in one seamless flow</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setTab('workflow')} className="px-4 py-2 rounded-xl bg-primary-500/20 border border-primary-500/30 text-primary-400 text-sm font-semibold hover:bg-primary-500/30 transition-all flex items-center gap-2">
              <Search className="w-4 h-4" /> Discover
            </button>
            <button onClick={() => navigate('/create-exam')} className="px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-400 text-white text-sm font-semibold transition-all flex items-center gap-2">
              <ChevronRight className="w-4 h-4" /> Launch Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
