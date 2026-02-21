/**
 * RevenueDashboard.tsx — Prism-powered Revenue Intelligence
 * Route: /revenue  |  Role: CEO
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle,
  Zap, ArrowRight, RefreshCw, ChevronDown, ChevronUp,
  BarChart3, Target, Layers, CreditCard, Info,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { runPrismAnalysis, PrismState, actionPacket } from '@/services/prismBridge';
import { getCohortInsights } from '@/services/personaContentBridge';
import { clsx } from 'clsx';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface RevenueMetrics {
  mrr: number;
  mrrChange: number;
  arr: number;
  activeSubscribers: number;
  subscriberChange: number;
  arpu: number;
  churnRate: number;
  ltvCacRatio: number;
  atRiskRevenue: number;
}

interface FunnelStep {
  name: string;
  value: number;
  rate?: number;
  fill: string;
}

interface CohortRevenue {
  exam: string;
  revenue: number;
  subscribers: number;
  arpu: number;
  churnRisk: number;
  fill: string;
}

interface ChurnRiskStudent {
  id: string;
  name: string;
  exam: string;
  plan: string;
  daysInactive: number;
  churnProbability: number;
  monthlyValue: number;
  lastSeen: string;
}

interface RevenueLever {
  id: string;
  title: string;
  description: string;
  potentialMrr: number;
  effort: 'low' | 'medium' | 'high';
  agent: string;
  actionLabel: string;
  packetId?: string;
}

interface PlanSlice {
  plan: string;
  count: number;
  fill: string;
}

interface MrrPoint {
  label: string;
  mrr: number;
  new: number;
  churned: number;
}

// ─── Data builders ─────────────────────────────────────────────────────────────

function buildMetrics(prism: PrismState): RevenueMetrics {
  const cohort = getCohortInsights();
  const dropped = prism.journeySegments.filter(j => j.outcome === 'dropped').length;
  const total = Math.max(prism.journeySegments.length, 1);
  const dropRate = dropped / total;
  return {
    mrr: 284000,
    mrrChange: 14.2,
    arr: 284000 * 12,
    activeSubscribers: cohort.totalStudents || 1847,
    subscriberChange: 8.7,
    arpu: Math.round(284000 / (cohort.totalStudents || 1847)),
    churnRate: Math.min(12, Math.round((dropRate * 0.3 + 0.06) * 100)),
    ltvCacRatio: 4.2,
    atRiskRevenue: Math.round(284000 * 0.09),
  };
}

function buildMrrTrend(): MrrPoint[] {
  return [
    { label: 'Sep', mrr: 160000, new: 22000, churned: 8000 },
    { label: 'Oct', mrr: 181000, new: 28000, churned: 7000 },
    { label: 'Nov', mrr: 198000, new: 24000, churned: 7000 },
    { label: 'Dec', mrr: 210000, new: 19000, churned: 7000 },
    { label: 'Jan', mrr: 248000, new: 46000, churned: 8000 },
    { label: 'Feb', mrr: 284000, new: 44000, churned: 8000 },
  ];
}

function buildFunnelSteps(prism: PrismState): FunnelStep[] {
  const fm = prism.funnelMetrics;
  const blogViews = Math.max(fm.blogViews, 1240);
  const ctaClicks = Math.max(fm.blogCtaClicks, 149);
  const chatSessions = Math.max(fm.chatSessions, 874);
  const practiceAttempts = Math.max(fm.practiceAttempts, 312);
  const paid = Math.round(practiceAttempts * 0.18);
  return [
    { name: 'Blog Views', value: blogViews, fill: '#0ea5e9' },
    { name: 'Chat Started', value: ctaClicks, rate: Math.round((ctaClicks / blogViews) * 100), fill: '#6366f1' },
    { name: 'Practice Session', value: practiceAttempts, rate: Math.round((practiceAttempts / chatSessions) * 100), fill: '#a855f7' },
    { name: 'Paid Conversion', value: paid, rate: Math.round((paid / practiceAttempts) * 100), fill: '#22c55e' },
  ];
}

function buildCohortRevenue(): CohortRevenue[] {
  return [
    { exam: 'JEE Main', revenue: 112000, subscribers: 612, arpu: 183, churnRisk: 8, fill: '#0ea5e9' },
    { exam: 'NEET',     revenue: 89000,  subscribers: 487, arpu: 183, churnRisk: 11, fill: '#d946ef' },
    { exam: 'CAT',      revenue: 43000,  subscribers: 234, arpu: 184, churnRisk: 7,  fill: '#f59e0b' },
    { exam: 'CBSE 12',  revenue: 28000,  subscribers: 312, arpu: 90,  churnRisk: 14, fill: '#22c55e' },
    { exam: 'UPSC',     revenue: 12000,  subscribers: 202, arpu: 59,  churnRisk: 19, fill: '#ef4444' },
  ];
}

function buildChurnRisk(): ChurnRiskStudent[] {
  return [
    { id:'s1', name:'Arjun M.', exam:'JEE',  plan:'Pro',     daysInactive:8,  churnProbability:0.82, monthlyValue:499, lastSeen:'8d ago' },
    { id:'s2', name:'Priya K.', exam:'NEET', plan:'Starter', daysInactive:12, churnProbability:0.76, monthlyValue:299, lastSeen:'12d ago' },
    { id:'s3', name:'Rahul S.', exam:'CAT',  plan:'Pro',     daysInactive:6,  churnProbability:0.71, monthlyValue:499, lastSeen:'6d ago' },
    { id:'s4', name:'Sneha R.', exam:'NEET', plan:'Pro',     daysInactive:9,  churnProbability:0.68, monthlyValue:499, lastSeen:'9d ago' },
    { id:'s5', name:'Dev P.',   exam:'JEE',  plan:'Starter', daysInactive:15, churnProbability:0.63, monthlyValue:299, lastSeen:'15d ago' },
  ];
}

function buildLevers(prism: PrismState): RevenueLever[] {
  const mentorPkt = prism.intelligencePackets.find(p => p.targetAgent === 'mentor');
  const heraldPkt = prism.intelligencePackets.find(p => p.targetAgent === 'herald');
  const atlasPkt  = prism.intelligencePackets.find(p => p.targetAgent === 'atlas');
  return [
    { id:'l1', title:'Re-engage 42 paywall-hit free users', description:"42 students hit the paywall this week but didn't convert. A personalised WhatsApp nudge with '₹99 first month' offer can recover them fast.", potentialMrr:4158, effort:'low', agent:'Herald', actionLabel:'Send Nudge Campaign', packetId:heraldPkt?.id },
    { id:'l2', title:'Churn prevention — 5 high-value at-risk students', description:'Top 5 at-risk students represent ₹2,095/mo at 77% avg churn probability. Mentor re-engagement has a 34% win-back rate.', potentialMrr:2095, effort:'low', agent:'Mentor', actionLabel:'Trigger Re-engagement', packetId:mentorPkt?.id },
    { id:'l3', title:'Blog CTA optimisation → +18 trial signups/week', description:'Blog CTA click rate at 12% vs 20% benchmark. A/B testing "Ask Sage" copy + social proof could yield +150 sessions/week → ~18 trial signups.', potentialMrr:3600, effort:'medium', agent:'Herald', actionLabel:'Start A/B Test', packetId:heraldPkt?.id },
    { id:'l4', title:'Content gap: Organic Chemistry (312 unserved queries)', description:'312 student queries on "Organic Chemistry — Named Reactions" with zero blog coverage. One post = 200+ organic visits/week.', potentialMrr:1800, effort:'medium', agent:'Atlas', actionLabel:'Create Content', packetId:atlasPkt?.id },
    { id:'l5', title:'WhatsApp add-on upsell — 180 Pro students without it', description:'180 Pro students haven\'t purchased the WhatsApp chatbot add-on (₹99/mo). In-app prompt after 5th chat converts 30–40%.', potentialMrr:5940, effort:'low', agent:'Mentor', actionLabel:'Enable Upsell Prompt' },
  ];
}

function buildPlanSlices(): PlanSlice[] {
  return [
    { plan: 'Free',           count: 2840, fill: '#3f3f46' },
    { plan: 'Starter (₹299)', count: 824,  fill: '#6366f1' },
    { plan: 'Pro (₹499)',     count: 892,  fill: '#0ea5e9' },
    { plan: 'Enterprise',     count: 131,  fill: '#f59e0b' },
  ];
}

// ─── Small components ──────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('rounded-xl border border-surface-800 bg-surface-900 p-4', className)}>
      {children}
    </div>
  );
}

function SectionHeader({ title, icon: Icon, badge }: { title: string; icon: React.ElementType; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="p-1.5 rounded-lg bg-surface-800"><Icon size={14} className="text-sky-400" /></div>
      <h2 className="font-semibold text-white text-sm">{title}</h2>
      {badge && <span className="ml-auto text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5">{badge}</span>}
    </div>
  );
}

function MetricTile({
  label, value, subValue, change, icon: Icon, accent, hero,
}: {
  label: string; value: string; subValue?: string; change?: number;
  icon: React.ElementType; accent: string; hero?: boolean;
}) {
  const up = change !== undefined ? change >= 0 : undefined;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'rounded-xl border p-4 flex flex-col gap-1.5',
        hero ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-sky-500/10' : 'border-surface-800 bg-surface-900',
      )}
    >
      <div className="flex items-center justify-between">
        <span className={clsx('text-xs font-medium uppercase tracking-wider', hero ? 'text-emerald-400' : 'text-surface-400')}>{label}</span>
        <div className={clsx('p-1.5 rounded-lg', accent)}><Icon size={13} className="text-white" /></div>
      </div>
      <span className={clsx('font-bold text-white', hero ? 'text-2xl' : 'text-lg')}>{value}</span>
      {subValue && <span className="text-xs text-surface-400">{subValue}</span>}
      {change !== undefined && (
        <span className={clsx('text-xs font-medium flex items-center gap-1', up ? 'text-emerald-400' : 'text-red-400')}>
          {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {up ? '+' : ''}{change.toFixed(1)}% vs last mo
        </span>
      )}
    </motion.div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function RevenueDashboard() {
  const [prism, setPrism] = useState<PrismState | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedLever, setExpandedLever] = useState<string | null>(null);
  const [actioned, setActioned] = useState<Set<string>>(new Set());
  const [showAllChurn, setShowAllChurn] = useState(false);
  const [updatedAt, setUpdatedAt] = useState('');

  const refresh = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setPrism(runPrismAnalysis());
      setUpdatedAt(new Date().toLocaleTimeString());
      setLoading(false);
    }, 500);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading || !prism) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-400">
        <div className="flex flex-col items-center gap-3">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}>
            <RefreshCw size={20} />
          </motion.div>
          <span className="text-sm">Loading revenue intelligence…</span>
        </div>
      </div>
    );
  }

  const metrics      = buildMetrics(prism);
  const mrrTrend     = buildMrrTrend();
  const funnelSteps  = buildFunnelSteps(prism);
  const cohorts      = buildCohortRevenue();
  const churnList    = buildChurnRisk();
  const levers       = buildLevers(prism);
  const planSlices   = buildPlanSlices();

  const visibleChurn = showAllChurn ? churnList : churnList.slice(0, 3);
  const totalOpportunity = levers.reduce((s, l) => s + l.potentialMrr, 0);
  const biggestLeakIdx = funnelSteps.reduce(
    (worst, step, i) => i > 0 && (step.rate ?? 100) < (funnelSteps[worst]?.rate ?? 100) ? i : worst,
    1,
  );

  const handleAction = (lever: RevenueLever) => {
    if (lever.packetId) actionPacket(lever.packetId);
    setActioned(prev => new Set(prev).add(lever.id));
  };

  const effortColor: Record<RevenueLever['effort'], string> = {
    low:    'bg-emerald-500/20 text-emerald-400',
    medium: 'bg-amber-500/20 text-amber-400',
    high:   'bg-red-500/20 text-red-400',
  };

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <DollarSign size={20} className="text-emerald-400" /> Revenue Intelligence
          </h1>
          <p className="text-xs text-surface-400 mt-0.5">
            Powered by Prism · {prism.isMockData ? 'Demo data' : 'Live signals'}
            {updatedAt && ` · Updated ${updatedAt}`}
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-surface-800 hover:border-surface-600"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Hero KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="col-span-2 sm:col-span-1 lg:col-span-2">
          <MetricTile label="Monthly Recurring Revenue" value={`₹${(metrics.mrr/1000).toFixed(0)}K`} subValue={`₹${(metrics.arr/100000).toFixed(1)}L ARR`} change={metrics.mrrChange} icon={DollarSign} accent="bg-emerald-500/30" hero />
        </div>
        <MetricTile label="Active Subscribers" value={metrics.activeSubscribers.toLocaleString()} change={metrics.subscriberChange} icon={Users} accent="bg-sky-500/30" />
        <MetricTile label="ARPU" value={`₹${metrics.arpu}`} subValue="per user / month" icon={CreditCard} accent="bg-violet-500/30" />
        <MetricTile label="Monthly Churn" value={`${metrics.churnRate}%`} subValue="target <8%" change={-2.1} icon={TrendingDown} accent="bg-red-500/30" />
        <MetricTile label="LTV:CAC" value={`${metrics.ltvCacRatio}×`} subValue="benchmark >3×" icon={Target} accent="bg-amber-500/30" />
        <MetricTile label="Revenue at Risk" value={`₹${(metrics.atRiskRevenue/1000).toFixed(1)}K`} subValue="from churn" icon={AlertTriangle} accent="bg-orange-500/30" />
      </div>

      {/* MRR Trend + Opportunity banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <SectionHeader title="MRR Trend — 6 Months" icon={TrendingUp} />
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={mrrTrend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="label" tick={{ fill:'#71717a', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'#71717a', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background:'#18181b', border:'1px solid #3f3f46', borderRadius:8, fontSize:12 }}
                formatter={(val: number, name: string) => [`₹${(val/1000).toFixed(1)}K`, name === 'mrr' ? 'MRR' : name === 'new' ? 'New' : 'Churned']} />
              <Area type="monotone" dataKey="mrr" stroke="#22c55e" strokeWidth={2} fill="url(#mrrGrad)" />
              <Bar dataKey="new"     fill="#22c55e" opacity={0.5} radius={[3,3,0,0]} />
              <Bar dataKey="churned" fill="#ef4444" opacity={0.45} radius={[3,3,0,0]} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Opportunity banner */}
        <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Zap size={15} className="text-amber-400" />
            <span className="font-semibold text-amber-300 text-sm">Revenue Opportunity</span>
          </div>
          <div className="text-3xl font-bold text-white">
            +₹{(totalOpportunity/1000).toFixed(1)}K
            <span className="text-sm font-normal text-surface-400 ml-1">/mo potential</span>
          </div>
          <p className="text-xs text-surface-300 leading-relaxed">
            Prism identified <strong className="text-amber-300">{levers.length} revenue levers</strong> across
            churn prevention, conversion optimisation, and upsell.
          </p>
          <div className="border-t border-amber-500/20 pt-3 space-y-1.5">
            {levers.slice(0,3).map(l => (
              <div key={l.id} className="flex items-center gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="text-surface-300 truncate">{l.title}</span>
                <span className="ml-auto text-emerald-400 font-medium flex-shrink-0">+₹{(l.potentialMrr/1000).toFixed(1)}K</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Funnel */}
      <Card>
        <SectionHeader
          title="Conversion Funnel — Blog → Paid"
          icon={Layers}
          badge={`Biggest leak: ${funnelSteps[biggestLeakIdx]?.name} (${funnelSteps[biggestLeakIdx]?.rate}%)`}
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {funnelSteps.map((step, i) => (
            <div key={step.name} className="relative">
              <div className={clsx(
                'rounded-lg border p-3 text-center',
                i === biggestLeakIdx ? 'border-red-500/40 bg-red-500/10' : 'border-surface-700 bg-surface-800',
              )}>
                <div className="text-2xl font-bold text-white">{step.value.toLocaleString()}</div>
                <div className="text-xs text-surface-400 mt-0.5">{step.name}</div>
                {step.rate !== undefined && (
                  <div className={clsx('text-xs font-medium mt-1', step.rate >= 20 ? 'text-emerald-400' : step.rate >= 10 ? 'text-amber-400' : 'text-red-400')}>
                    {step.rate}% conversion
                  </div>
                )}
              </div>
              {i < funnelSteps.length - 1 && (
                <div className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                  <ArrowRight size={13} className="text-surface-600" />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 rounded-lg bg-surface-800 border border-surface-700 text-xs text-surface-300 flex items-start gap-2">
          <Info size={13} className="text-sky-400 flex-shrink-0 mt-0.5" />
          <span>
            <strong className="text-white">Prism insight:</strong>{' '}
            {prism.funnelMetrics.topDropoffPoint === 'blog_cta'
              ? 'Most drop-offs at blog → chat CTA. Herald recommends testing "Ask Sage — answer in 30s" copy.'
              : `Top drop-off: ${prism.funnelMetrics.topDropoffPoint}. Consider a re-engagement nudge at this step.`}
          </span>
        </div>
      </Card>

      {/* Cohort revenue + Plan distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Card>
          <SectionHeader title="Revenue by Exam Cohort" icon={BarChart3} />
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={cohorts} margin={{ top:4, right:4, left:-24, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="exam" tick={{ fill:'#71717a', fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'#71717a', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
              <Tooltip
                contentStyle={{ background:'#18181b', border:'1px solid #3f3f46', borderRadius:8, fontSize:12 }}
                formatter={(val: number, name: string) => [
                  name === 'revenue' ? `₹${(val/1000).toFixed(1)}K` : `${val}%`,
                  name === 'revenue' ? 'Revenue' : 'Churn Risk',
                ]}
              />
              <Bar dataKey="revenue" radius={[4,4,0,0]}>
                {cohorts.map(c => <Cell key={c.exam} fill={c.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-5 gap-1 mt-2">
            {cohorts.map(c => (
              <div key={c.exam} className="text-center">
                <div className="text-[10px] text-surface-400 truncate">{c.exam}</div>
                <div className={clsx('text-[10px] font-medium', c.churnRisk >= 15 ? 'text-red-400' : c.churnRisk >= 10 ? 'text-amber-400' : 'text-emerald-400')}>
                  {c.churnRisk}% churn
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Plan Distribution" icon={Layers} />
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={170}>
              <PieChart>
                <Pie data={planSlices} dataKey="count" cx="50%" cy="50%" outerRadius={70} strokeWidth={0}>
                  {planSlices.map(p => <Cell key={p.plan} fill={p.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ background:'#18181b', border:'1px solid #3f3f46', borderRadius:8, fontSize:12 }}
                  formatter={(val: number, _: string, payload: { name?: string }) => [val.toLocaleString(), payload.name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 flex-1">
              {planSlices.map(p => (
                <div key={p.plan} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: p.fill }} />
                  <span className="text-surface-300 flex-1 truncate">{p.plan}</span>
                  <span className="text-white font-medium">{p.count.toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t border-surface-700 pt-2 mt-1">
                <div className="text-xs text-surface-400">Free→Paid conversion</div>
                <div className="text-sm font-bold text-white">
                  {Math.round(((824+892+131) / 2840) * 100)}%
                  <span className="text-xs font-normal text-surface-400 ml-1">of free users</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Churn Risk Panel */}
      <Card>
        <SectionHeader
          title="Churn Risk — High-Value Students"
          icon={AlertTriangle}
          badge={`₹${churnList.reduce((s,c) => s + c.monthlyValue, 0).toLocaleString()} at risk`}
        />
        <div className="space-y-2">
          {visibleChurn.map(s => (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-800 border border-surface-700">
              <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {s.name.slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{s.name}</span>
                  <span className="text-xs text-surface-400">{s.exam} · {s.plan}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex-1 h-1.5 rounded-full bg-surface-700 overflow-hidden">
                    <div className="h-full rounded-full bg-red-500" style={{ width: `${s.churnProbability * 100}%` }} />
                  </div>
                  <span className="text-xs text-red-400 font-medium w-12 text-right">{Math.round(s.churnProbability * 100)}% risk</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-white">₹{s.monthlyValue}</div>
                <div className="text-xs text-surface-400">{s.lastSeen}</div>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setShowAllChurn(v => !v)}
          className="w-full mt-3 text-xs text-surface-400 hover:text-white flex items-center justify-center gap-1 py-2 border border-dashed border-surface-700 rounded-lg hover:border-surface-500 transition-colors"
        >
          {showAllChurn ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show all {churnList.length} at-risk students</>}
        </button>
      </Card>

      {/* Revenue Levers */}
      <Card>
        <SectionHeader title="Revenue Levers — AI-Generated by Prism" icon={Zap} badge={`${levers.filter(l => !actioned.has(l.id)).length} pending`} />
        <div className="space-y-2">
          {levers.map(lever => {
            const isActioned = actioned.has(lever.id);
            const isExpanded = expandedLever === lever.id;
            return (
              <div key={lever.id} className={clsx('rounded-lg border transition-colors', isActioned ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-surface-700 bg-surface-800 hover:border-surface-600')}>
                <button
                  className="w-full flex items-center gap-3 p-3 text-left"
                  onClick={() => setExpandedLever(isExpanded ? null : lever.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={clsx('text-sm font-medium', isActioned ? 'text-emerald-300' : 'text-white')}>{lever.title}</span>
                      <span className={clsx('text-xs rounded-full px-2 py-0.5', effortColor[lever.effort])}>
                        {lever.effort} effort
                      </span>
                      <span className="text-xs text-surface-400 bg-surface-700 rounded px-1.5 py-0.5">{lever.agent}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-emerald-400 font-bold text-sm">+₹{(lever.potentialMrr/1000).toFixed(1)}K/mo</span>
                    {isActioned
                      ? <span className="text-xs text-emerald-400">✓ Sent</span>
                      : isExpanded ? <ChevronUp size={14} className="text-surface-500" /> : <ChevronDown size={14} className="text-surface-500" />
                    }
                  </div>
                </button>
                {isExpanded && !isActioned && (
                  <div className="px-3 pb-3 border-t border-surface-700 pt-2">
                    <p className="text-xs text-surface-300 leading-relaxed mb-3">{lever.description}</p>
                    <button
                      onClick={() => handleAction(lever)}
                      className="flex items-center gap-1.5 text-xs bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Zap size={11} /> {lever.actionLabel}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

    </div>
  );
}
