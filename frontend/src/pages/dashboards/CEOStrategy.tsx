/**
 * CEOStrategy.tsx — Revenue Command Center
 * The CEO's primary tool for EARNING money, not just viewing metrics.
 * 6 tabs: Revenue Engine | Growth Playbooks | Opportunity Pipeline |
 *         Competitive Intel | Agent Command | Business Health
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, Rocket, Search, Cpu, BarChart3,
  TrendingUp, Zap, ArrowRight, CheckCircle2,
  AlertTriangle, RefreshCw, Play, Star, Target,
  Activity, Shield, Clock,
} from 'lucide-react';
import { clsx } from 'clsx';
import { AgentWorkflowPanel } from '@/components/AgentWorkflowPanel';
import { BUSINESS_AGENTS, MOCK_OPPORTUNITIES, MOCK_COMPETITORS } from '@/services/businessAgents';
import { MOCK_TREND_KEYWORDS } from '@/services/businessAgents';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ─── Revenue Engine Tab ───────────────────────────────────────────────────────

const revenueForecastData = [
  { month: 'Feb', conservative: 280000, realistic: 380000, optimistic: 520000 },
  { month: 'Mar', conservative: 340000, realistic: 460000, optimistic: 640000 },
  { month: 'Apr', conservative: 420000, realistic: 570000, optimistic: 790000 },
  { month: 'May', conservative: 510000, realistic: 690000, optimistic: 960000 },
  { month: 'Jun', conservative: 620000, realistic: 840000, optimistic: 1150000 },
];

const quickWins = [
  { id: 'qw1', label: 'Send renewal reminder to 23 expiring plans', agent: 'Nexus', impact: '+₹13,800', action: 'Execute', color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  { id: 'qw2', label: 'Upsell 47 free users who completed 5 sessions', agent: 'Mentor', impact: '+₹28,200', action: 'Execute', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { id: 'qw3', label: 'Offer 20% discount to 12 churned students', agent: 'Nexus', impact: '+₹5,760', action: 'Execute', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { id: 'qw4', label: 'Upgrade 31 Starter → Pro (feature gate triggered)', agent: 'Mentor', impact: '+₹9,300', action: 'Execute', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
];

function RevenueEngineTab() {
  const [executed, setExecuted] = useState<Set<string>>(new Set());
  const monthlyTarget = 1200000;
  const monthlyActual = 724000;
  const pct = Math.round((monthlyActual / monthlyTarget) * 100);

  return (
    <div className="space-y-5">
      {/* Target progress */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Monthly Revenue Target</h3>
            <p className="text-xs text-surface-400">February 2026 · 9 days remaining</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">₹{(monthlyActual / 100000).toFixed(1)}L</p>
            <p className="text-xs text-surface-400">of ₹{(monthlyTarget / 100000).toFixed(1)}L target</p>
          </div>
        </div>
        <div className="h-3 bg-surface-700 rounded-full overflow-hidden mb-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1 }}
            className={clsx('h-full rounded-full', pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500')}
          />
        </div>
        <p className="text-xs text-surface-400">{pct}% achieved · Need ₹{((monthlyTarget - monthlyActual) / 100000).toFixed(1)}L more in 9 days</p>
      </div>

      {/* Quick wins */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-yellow-400" />
          <h3 className="font-semibold">Quick Win Actions</h3>
          <span className="text-xs text-surface-400 ml-auto">AI-identified revenue moves</span>
        </div>
        <div className="space-y-2">
          {quickWins.map(win => (
            <div key={win.id} className={clsx('flex items-center gap-3 p-3 rounded-xl border', win.color)}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium leading-snug">{win.label}</p>
                <p className="text-[10px] text-surface-400 mt-0.5">{win.agent} will execute → <span className="text-green-400 font-medium">{win.impact}</span></p>
              </div>
              <button
                onClick={() => setExecuted(p => new Set([...p, win.id]))}
                disabled={executed.has(win.id)}
                className={clsx(
                  'flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all',
                  executed.has(win.id) ? 'bg-green-500/20 text-green-400' : 'bg-white/10 hover:bg-white/20'
                )}
              >
                {executed.has(win.id) ? '✅ Sent' : win.action}
              </button>
            </div>
          ))}
        </div>
        {executed.size > 0 && (
          <p className="text-xs text-green-400 mt-3">
            ✅ {executed.size} action{executed.size > 1 ? 's' : ''} dispatched → potential ₹{
              quickWins.filter(w => executed.has(w.id)).reduce((s, w) => s + parseInt(w.impact.replace(/[^\d]/g, '')), 0).toLocaleString()
            } additional revenue
          </p>
        )}
      </div>

      {/* Revenue forecast chart */}
      <div className="card">
        <h3 className="font-semibold mb-4">30/60/90-Day Revenue Forecast</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={revenueForecastData}>
            <defs>
              <linearGradient id="cg1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="month" stroke="#71717a" fontSize={11} />
            <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} />
            <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
              formatter={(v: number) => [`₹${(v/100000).toFixed(1)}L`]} />
            <Area type="monotone" dataKey="optimistic" stroke="#22c55e" strokeWidth={1} strokeDasharray="4 2" fill="none" />
            <Area type="monotone" dataKey="realistic" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#cg1)" />
            <Area type="monotone" dataKey="conservative" stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 2" fill="none" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex gap-4 text-xs mt-2 justify-center">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block" /> Optimistic</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-primary-400 inline-block" /> Realistic</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-400 inline-block" /> Conservative</span>
        </div>
      </div>
    </div>
  );
}

// ─── Growth Playbooks Tab ─────────────────────────────────────────────────────

const playbooks = [
  { id: 'pb_telegram', name: 'Telegram Community Growth', phase: 'Acquisition', level: 'semi_auto', rate: 0.82, runs: 3, revenue: 148000, desc: 'GrowthCommander builds Telegram community → social proof converts lurkers to trials', agents: ['Herald', 'GrowthCommander', 'Mentor'] },
  { id: 'pb_schools', name: 'School Partnership Blitz', phase: 'Acquisition', level: 'semi_auto', rate: 0.71, runs: 1, revenue: 84000, desc: '5 school partnerships in 30 days via GrowthCommander.PartnershipFinder', agents: ['GrowthCommander', 'Herald'] },
  { id: 'pb_referral', name: 'Viral Referral Launch', phase: 'Acquisition', level: 'full_auto', rate: 0.78, runs: 2, revenue: 212000, desc: '2-sided referral with gamification — students earn free months for successful invites', agents: ['GrowthCommander', 'Mentor', 'Nexus'] },
  { id: 'pb_content', name: 'Scale Organic Search', phase: 'Awareness', level: 'full_auto', rate: 0.91, runs: 8, revenue: 320000, desc: 'Atlas + GrowthCommander.SEOStrategist publish 20 JEE/NEET blog posts per month', agents: ['Atlas', 'GrowthCommander', 'Herald'] },
  { id: 'pb_reactivate', name: 'Churn Rescue Campaign', phase: 'Retention', level: 'full_auto', rate: 0.34, runs: 5, revenue: 89000, desc: 'RevenueArchitect.ChurnPredictor identifies at-risk users → Nexus sends personalised rescue sequence', agents: ['RevenueArchitect', 'Nexus', 'Mentor'] },
];

function GrowthPlaybooksTab() {
  const [activePlaybook, setActivePlaybook] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {playbooks.map(pb => (
        <div key={pb.id} className="card hover:border-surface-600 transition-colors">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-semibold text-sm">{pb.name}</h3>
                <span className={clsx('text-[10px] px-1.5 py-0.5 rounded border',
                  pb.level === 'full_auto' ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                )}>{pb.level === 'full_auto' ? '🤖 Full Auto' : '⚡ Semi-Auto'}</span>
                <span className="text-[10px] text-surface-500">{pb.phase}</span>
              </div>
              <p className="text-xs text-surface-400">{pb.desc}</p>
              <div className="flex items-center gap-3 mt-2 text-xs">
                <span className="text-surface-400">Success: <span className="text-white font-medium">{Math.round(pb.rate * 100)}%</span></span>
                <span className="text-surface-400">Runs: <span className="text-white font-medium">{pb.runs}</span></span>
                <span className="text-green-400 font-medium">₹{(pb.revenue / 1000).toFixed(0)}K generated</span>
              </div>
              <div className="flex gap-1 mt-2 flex-wrap">
                {pb.agents.map(a => (
                  <span key={a} className="text-[10px] px-1.5 py-0.5 bg-surface-700 rounded-full text-surface-300">{a}</span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={() => setActivePlaybook(activePlaybook === pb.id ? null : pb.id)}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary-500/20 border border-primary-500/30 text-primary-400 hover:bg-primary-500/30 transition-colors"
              >
                <Play className="w-3.5 h-3.5 inline mr-1" />Run
              </button>
            </div>
          </div>
          {activePlaybook === pb.id && (
            <div className="mt-4 pt-4 border-t border-surface-700">
              <AgentWorkflowPanel
                workflowId="growth_strategy"
                inputs={{ playbookId: pb.id, playbookName: pb.name }}
                autoStart={true}
                showFlowDiagram={false}
                onComplete={() => setActivePlaybook(null)}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Opportunity Pipeline Tab ─────────────────────────────────────────────────

function OpportunityPipelineTab({ onDiscover, onLaunch }: { onDiscover: () => void; onLaunch: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Opportunities tracked', value: '10', icon: Search, color: 'text-blue-400' },
          { label: 'Analysed this week', value: '4', icon: BarChart3, color: 'text-purple-400' },
          { label: 'Ready to launch', value: '2', icon: Rocket, color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="card flex items-center gap-3">
            <s.icon className={clsx('w-5 h-5', s.color)} />
            <div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-surface-400">{s.label}</p></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {MOCK_OPPORTUNITIES.slice(0, 6).map(opp => (
          <div key={opp.exam} className="card hover:border-surface-600 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">{opp.exam}</h3>
              <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full border',
                opp.compositeScore >= 80 ? 'text-green-400 border-green-500/30 bg-green-500/10'
                : opp.compositeScore >= 70 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                : 'text-surface-400 border-surface-600'
              )}>{opp.compositeScore}/100</span>
            </div>
            <div className="space-y-1 mb-3">
              {[
                { l: 'Demand', v: opp.demandScore, c: 'bg-blue-500' },
                { l: 'Gap', v: opp.competitionGapScore, c: 'bg-purple-500' },
                { l: 'Revenue', v: opp.revenuePotentialScore, c: 'bg-green-500' },
              ].map(d => (
                <div key={d.l}>
                  <div className="flex justify-between text-[10px] mb-0.5"><span className="text-surface-400">{d.l}</span><span>{d.v}</span></div>
                  <div className="h-1 bg-surface-700 rounded-full overflow-hidden">
                    <div className={clsx('h-full rounded-full', d.c)} style={{ width: `${d.v}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-green-400 font-medium">₹{(opp.monthlyRevenueForecast * 12 / 100000).toFixed(0)}L/yr potential</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={onDiscover} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500/20 border border-primary-500/30 text-primary-400 font-semibold text-sm hover:bg-primary-500/30 transition-all">
          <Search className="w-4 h-4" /> Discover New Opportunities
        </button>
        <button onClick={onLaunch} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-400 text-white font-semibold text-sm transition-all">
          <Rocket className="w-4 h-4" /> Launch Next Exam
        </button>
      </div>
    </div>
  );
}

// ─── Competitive Intelligence Tab ─────────────────────────────────────────────

function CompetitiveIntelTab() {
  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🕵️</span>
          <h3 className="font-semibold">VentureScout Live Feed</h3>
          <span className="text-xs text-surface-500 ml-auto">Updated 2h ago</span>
        </div>
        <div className="space-y-3">
          {MOCK_COMPETITORS.map(c => (
            <div key={c.name} className={clsx(
              'p-3 rounded-xl border',
              c.threat === 'high' ? 'border-red-500/20 bg-red-500/5'
              : c.threat === 'medium' ? 'border-amber-500/20 bg-amber-500/5'
              : 'border-surface-700/50 bg-surface-800/30'
            )}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded border',
                    c.threat === 'high' ? 'text-red-400 border-red-500/30' : c.threat === 'medium' ? 'text-amber-400 border-amber-500/30' : 'text-surface-400 border-surface-600'
                  )}>{c.threat.toUpperCase()}</span>
                  <span className="font-semibold text-sm">{c.name}</span>
                </div>
                <span className="text-xs text-surface-400">₹{c.price}/mo</span>
              </div>
              <p className="text-xs text-surface-300">{c.recentMove}</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-green-400">→ {c.ourOpportunity}</p>
                <button className="text-[10px] px-2 py-1 rounded bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-colors">Respond</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Market position map */}
      <div className="card">
        <h3 className="font-semibold mb-3">Market Position Map</h3>
        <div className="relative h-48 bg-surface-800/50 rounded-xl border border-surface-700/50 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-surface-500 rotate-[-90deg]">← Lower Price | Higher Price →</div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-surface-500">← Generic Content | AI-Powered →</div>
          </div>
          {[
            { name: 'EduGenius', x: 78, y: 42, color: 'bg-primary-500', size: 'w-4 h-4' },
            { name: "Byju's",    x: 25, y: 28, color: 'bg-red-400',     size: 'w-5 h-5' },
            { name: 'Unacademy', x: 38, y: 35, color: 'bg-orange-400',  size: 'w-5 h-5' },
            { name: 'TestBook',  x: 52, y: 55, color: 'bg-amber-400',   size: 'w-4 h-4' },
            { name: 'Adda247',   x: 60, y: 65, color: 'bg-yellow-400',  size: 'w-3.5 h-3.5' },
          ].map(p => (
            <div key={p.name} className="absolute flex flex-col items-center gap-1" style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)' }}>
              <div className={clsx('rounded-full', p.color, p.size)} />
              <span className="text-[9px] text-white font-medium">{p.name}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-surface-400 mt-2">EduGenius: highest AI quotient at mid-premium price — unique position in market</p>
      </div>

      {/* Top keywords we're winning */}
      <div className="card">
        <h3 className="font-semibold mb-3">Trend Radar — Top Opportunities</h3>
        <div className="space-y-1.5">
          {MOCK_TREND_KEYWORDS.slice(0, 6).map(kw => (
            <div key={kw.keyword} className="flex items-center gap-3 p-2 rounded-lg bg-surface-800/40">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{kw.keyword}</p>
                <p className="text-[10px] text-surface-500">{kw.monthlySearchVolume.toLocaleString()}/mo</p>
              </div>
              <span className={clsx('text-xs font-bold', kw.yoyGrowth >= 30 ? 'text-green-400' : 'text-amber-400')}>+{kw.yoyGrowth}% YoY</span>
              <span className={clsx('text-xs px-2 py-0.5 rounded-full font-bold',
                kw.opportunityScore >= 80 ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
              )}>{kw.opportunityScore}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Agent Command Tab ─────────────────────────────────────────────────────────

const ALL_AGENTS = [
  { id: 'scout',           name: 'Scout',           emoji: '🔍', role: 'Intelligence',     status: 'active',  tasks: 45,  cost: 95,   revenue: 18000 },
  { id: 'atlas',           name: 'Atlas',           emoji: '📚', role: 'Content Engine',   status: 'busy',    tasks: 120, cost: 320,  revenue: 60000 },
  { id: 'sage',            name: 'Sage',            emoji: '🎓', role: 'AI Tutor',         status: 'busy',    tasks: 280, cost: 890,  revenue: 120000 },
  { id: 'mentor',          name: 'Mentor',          emoji: '👨‍🏫', role: 'Engagement',       status: 'active',  tasks: 85,  cost: 180,  revenue: 35000 },
  { id: 'herald',          name: 'Herald',          emoji: '📢', role: 'Marketing',        status: 'idle',    tasks: 35,  cost: 145,  revenue: 28000 },
  { id: 'forge',           name: 'Forge',           emoji: '⚙️', role: 'Deployment',       status: 'idle',    tasks: 22,  cost: 75,   revenue: 0 },
  { id: 'oracle',          name: 'Oracle',          emoji: '📊', role: 'Analytics',        status: 'active',  tasks: 55,  cost: 110,  revenue: 12000 },
  { id: 'venture_scout',   name: 'VentureScout',    emoji: '🕵️', role: 'Opp Discovery',    status: 'idle',    tasks: 14,  cost: 32,   revenue: 0 },
  { id: 'revenue_architect',name:'RevenueArchitect',emoji: '💰', role: 'Revenue Strategy', status: 'active',  tasks: 8,   cost: 18,   revenue: 284000 },
  { id: 'growth_commander',name: 'GrowthCommander', emoji: '🚀', role: 'Growth Execution', status: 'active',  tasks: 11,  cost: 41,   revenue: 148000 },
];

function AgentCommandTab() {
  const [task, setTask] = useState('');
  const [assignTo, setAssignTo] = useState('sage');
  const [dispatched, setDispatched] = useState<string[]>([]);

  return (
    <div className="space-y-4">
      {/* Deploy Task */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-yellow-400" />
          <h3 className="font-semibold text-sm">Deploy Task to Agent</h3>
        </div>
        <div className="flex gap-2">
          <input
            value={task}
            onChange={e => setTask(e.target.value)}
            placeholder="e.g. Write 5 GATE blog posts targeting 'GATE 2026 preparation'"
            className="flex-1 px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500"
          />
          <select
            value={assignTo}
            onChange={e => setAssignTo(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-sm text-white"
          >
            {ALL_AGENTS.map(a => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>)}
          </select>
          <button
            onClick={() => { if (task) { setDispatched(p => [...p, `${assignTo}: ${task}`]); setTask(''); } }}
            disabled={!task}
            className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-400 disabled:bg-surface-700 disabled:text-surface-400 text-white text-sm font-semibold transition-all"
          >
            Deploy
          </button>
        </div>
        {dispatched.length > 0 && (
          <div className="mt-3 space-y-1">
            {dispatched.slice(-3).map((d, i) => (
              <p key={i} className="text-xs text-green-400">✅ {d}</p>
            ))}
          </div>
        )}
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ALL_AGENTS.map(agent => (
          <div key={agent.id} className="card hover:border-surface-600 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{agent.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{agent.name}</span>
                  <span className={clsx('w-2 h-2 rounded-full flex-shrink-0',
                    agent.status === 'active' ? 'bg-green-500' : agent.status === 'busy' ? 'bg-blue-500' : 'bg-surface-500'
                  )} />
                </div>
                <p className="text-[10px] text-surface-400">{agent.role}</p>
              </div>
              <div className="text-right text-xs">
                <p className="font-medium">{agent.tasks} tasks</p>
                {agent.revenue > 0 && <p className="text-green-400">₹{(agent.revenue/1000).toFixed(0)}K</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Business Health Tab ───────────────────────────────────────────────────────

const healthScores = [
  { label: 'Product Health',   score: 87, icon: Star,          color: 'text-primary-400' },
  { label: 'Growth Health',    score: 74, icon: TrendingUp,    color: 'text-green-400' },
  { label: 'Financial Health', score: 68, icon: DollarSign,    color: 'text-amber-400' },
  { label: 'Agent Health',     score: 93, icon: Cpu,           color: 'text-purple-400' },
];

const risks = [
  { risk: 'Unacademy AI launch in Q2', prob: 'High', impact: 'High', owner: 'GrowthCommander', mitigation: 'Publish differentiation content before their launch' },
  { risk: 'VITE_GEMINI_API_KEY not set', prob: 'Critical', impact: 'Critical', owner: 'Forge', mitigation: 'Giri to set in Netlify env vars (blocks all AI features)' },
  { risk: 'JEE Main students churn post-exam', prob: 'Medium', impact: 'High', owner: 'Nexus', mitigation: 'Transition JEE users to GATE / NEET offers immediately' },
  { risk: 'SEO traffic dependent on 3 articles', prob: 'Medium', impact: 'Medium', owner: 'Atlas', mitigation: 'Scale to 20+ articles this month to diversify' },
  { risk: 'No backend deployed yet', prob: 'High', impact: 'Medium', owner: 'Forge', mitigation: 'Deploy GCP/AWS backend when Giri approves infrastructure' },
];

function BusinessHealthTab() {
  return (
    <div className="space-y-5">
      {/* NorthStar */}
      <div className="card bg-gradient-to-r from-primary-500/10 to-accent-500/10 border border-primary-500/20">
        <div className="flex items-center gap-3">
          <Star className="w-6 h-6 text-primary-400" />
          <div>
            <h3 className="font-semibold">North Star Metric</h3>
            <p className="text-sm text-surface-300">Students achieving their exam goal</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-3xl font-bold text-primary-400">847</p>
            <p className="text-xs text-surface-400">this quarter · <span className="text-green-400">+18% vs last</span></p>
          </div>
        </div>
      </div>

      {/* Health scores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {healthScores.map(h => (
          <div key={h.label} className="card text-center">
            <h.icon className={clsx('w-5 h-5 mx-auto mb-2', h.color)} />
            <p className={clsx('text-2xl font-bold', h.score >= 80 ? 'text-green-400' : h.score >= 60 ? 'text-amber-400' : 'text-red-400')}>{h.score}</p>
            <p className="text-xs text-surface-400 mt-0.5">{h.label}</p>
          </div>
        ))}
      </div>

      {/* Oracle narrative */}
      <div className="card border border-primary-500/20">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📊</span>
          <h3 className="font-semibold text-sm">Oracle Weekly Narrative</h3>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2"><span className="text-green-400 flex-shrink-0">↑</span><p className="text-surface-200">Revenue up 12% this week — JEE Main cohort activation strong. Atlas published 4 high-traffic articles driving 1,200 organic visits.</p></div>
          <div className="flex items-start gap-2"><span className="text-red-400 flex-shrink-0">↓</span><p className="text-surface-200">3 cancellations cited "too expensive" — price sensitivity signal. RevenueArchitect recommends testing ₹399 mid-tier.</p></div>
          <div className="flex items-start gap-2"><span className="text-primary-400 flex-shrink-0">→</span><p className="text-surface-200">Recommendation: Launch GATE prep in next 14 days to capture registration-season traffic surge (window closes April).</p></div>
        </div>
      </div>

      {/* Risk register */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold text-sm">Risk Register</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-700 text-surface-400 font-normal">
                {['Risk', 'Prob', 'Impact', 'Owner', 'Mitigation'].map(h => (
                  <th key={h} className="text-left pb-2 pr-3 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {risks.map((r, i) => (
                <tr key={i} className="border-b border-surface-800 hover:bg-surface-800/30">
                  <td className="py-2 pr-3 font-medium max-w-[160px]">{r.risk}</td>
                  <td className="py-2 pr-3"><span className={clsx('px-1.5 py-0.5 rounded text-[10px]', r.prob === 'Critical' ? 'bg-red-500/20 text-red-400' : r.prob === 'High' ? 'bg-amber-500/20 text-amber-400' : 'bg-surface-700 text-surface-400')}>{r.prob}</span></td>
                  <td className="py-2 pr-3"><span className={clsx('px-1.5 py-0.5 rounded text-[10px]', r.impact === 'Critical' ? 'bg-red-500/20 text-red-400' : r.impact === 'High' ? 'bg-amber-500/20 text-amber-400' : 'bg-surface-700 text-surface-400')}>{r.impact}</span></td>
                  <td className="py-2 pr-3 text-primary-400">{r.owner}</td>
                  <td className="py-2 text-surface-400">{r.mitigation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const STRATEGY_TABS = [
  { id: 'revenue',      label: 'Revenue Engine',     icon: DollarSign, color: 'text-green-400' },
  { id: 'playbooks',    label: 'Growth Playbooks',   icon: Rocket,     color: 'text-orange-400' },
  { id: 'opportunity',  label: 'Opportunity Pipeline', icon: Search,   color: 'text-blue-400' },
  { id: 'competitive',  label: 'Competitive Intel',  icon: Shield,     color: 'text-purple-400' },
  { id: 'agents',       label: 'Agent Command',      icon: Cpu,        color: 'text-primary-400' },
  { id: 'health',       label: 'Business Health',    icon: Activity,   color: 'text-amber-400' },
] as const;

type StrategyTab = typeof STRATEGY_TABS[number]['id'];

export function CEOStrategy() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<StrategyTab>('revenue');

  // Track if business agents are used — re-exported for use in CEODashboard
  void BUSINESS_AGENTS;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Revenue Command Center 💰</h1>
          <p className="text-surface-400 text-sm mt-0.5">Your strategy, growth, and intelligence hub — all in one place</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/opportunity-discovery')} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-sm hover:bg-surface-700 transition-all">
            <Search className="w-4 h-4 text-blue-400" /> Discover
          </button>
          <button onClick={() => navigate('/create-exam')} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-500 hover:bg-primary-400 text-white text-sm font-semibold transition-all">
            <Rocket className="w-4 h-4" /> Launch Exam
          </button>
        </div>
      </div>

      {/* Last sync chip */}
      <div className="flex items-center gap-2 text-xs text-surface-500">
        <Clock className="w-3.5 h-3.5" />
        <span>All agents last synced 15 min ago</span>
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        <span className="text-green-400">Live</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface-800/50 overflow-x-auto">
        {STRATEGY_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0',
              tab === t.id ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white'
            )}
          >
            <t.icon className={clsx('w-4 h-4', tab === t.id ? t.color : 'text-surface-500')} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
          {tab === 'revenue'     && <RevenueEngineTab />}
          {tab === 'playbooks'   && <GrowthPlaybooksTab />}
          {tab === 'opportunity' && <OpportunityPipelineTab onDiscover={() => navigate('/opportunity-discovery')} onLaunch={() => navigate('/create-exam')} />}
          {tab === 'competitive' && <CompetitiveIntelTab />}
          {tab === 'agents'      && <AgentCommandTab />}
          {tab === 'health'      && <BusinessHealthTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
