import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  DollarSign,
  Activity,
  Bot,
  Zap,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  AlertCircle,
  X,
  Rocket,
  ChevronRight,
  BarChart3,
  Target,
  MessageSquare,
  Plug,
  PenTool,
} from 'lucide-react';
import { AgentWorkflowPanel } from '@/components/AgentWorkflowPanel';
import { AgentROIPanel, AIRevenueNarrative, DailyOpsDigest, ExamOpportunityRadar, CompetitorPulse } from '@/components/ux/UXEnhancements';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useAppStore } from '@/stores/appStore';
import { clsx } from 'clsx';

const revenueData = [
  { date: 'Mon', value: 2400 },
  { date: 'Tue', value: 1398 },
  { date: 'Wed', value: 9800 },
  { date: 'Thu', value: 3908 },
  { date: 'Fri', value: 4800 },
  { date: 'Sat', value: 3800 },
  { date: 'Sun', value: 4300 },
];

const userGrowthData = [
  { date: 'Jan', students: 400, teachers: 24 },
  { date: 'Feb', students: 600, teachers: 32 },
  { date: 'Mar', students: 850, teachers: 45 },
  { date: 'Apr', students: 1200, teachers: 58 },
  { date: 'May', students: 1800, teachers: 72 },
  { date: 'Jun', students: 2400, teachers: 89 },
];

const agentWorkload = [
  { name: 'Scout', tasks: 45 },
  { name: 'Atlas', tasks: 120 },
  { name: 'Sage', tasks: 280 },
  { name: 'Mentor', tasks: 85 },
  { name: 'Herald', tasks: 35 },
  { name: 'Forge', tasks: 22 },
  { name: 'Oracle', tasks: 55 },
];

const pieColors = ['#0ea5e9', '#d946ef', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface StatCardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ElementType;
  color: string;
  hero?: boolean;
}

function StatCard({ title, value, change, icon: Icon, color, hero }: StatCardProps) {
  const isPositive = change >= 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-surface-400">{title}</p>
          <p className={clsx('font-bold mt-1', hero ? 'text-3xl' : 'text-2xl')}>{value}</p>
          <div className={clsx(
            'flex items-center gap-1 mt-2 text-sm',
            isPositive ? 'text-green-400' : 'text-red-400'
          )}>
            {isPositive ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            <span>{Math.abs(change)}%</span>
            <span className="text-surface-500">vs last week</span>
          </div>
        </div>
        <div className={clsx('p-3 rounded-xl', color)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </motion.div>
  );
}

// ── Launch Exam Modal ──────────────────────────────────────────────────────────

const EXAM_OPTIONS = [
  { id: 'jee_main', label: 'JEE Main', icon: '🔢', status: 'active' as const },
  { id: 'jee_advanced', label: 'JEE Advanced', icon: '⚡', status: 'pilot' as const },
  { id: 'neet', label: 'NEET', icon: '🧬', status: 'active' as const },
  { id: 'cbse_10', label: 'CBSE Class 10', icon: '📚', status: 'active' as const },
  { id: 'cbse_12', label: 'CBSE Class 12', icon: '🎓', status: 'pilot' as const },
  { id: 'cat', label: 'CAT', icon: '💼', status: 'inactive' as const },
  { id: 'upsc', label: 'UPSC', icon: '🏛️', status: 'inactive' as const },
  { id: 'gate', label: 'GATE', icon: '⚙️', status: 'inactive' as const },
];

const statusConfig = {
  active: { label: 'Live', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  pilot: { label: 'Pilot', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  inactive: { label: 'Inactive', color: 'bg-surface-700 text-surface-400 border-surface-600' },
};

function LaunchExamModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<'pilot' | 'full'>('pilot');
  const [launched, setLaunched] = useState(false);

  const selectedExam = EXAM_OPTIONS.find(e => e.id === selected);

  const handleLaunch = () => {
    if (!selected) return;
    setLaunched(true);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={!launched ? onClose : undefined} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={clsx(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full glass rounded-2xl shadow-2xl p-6 overflow-y-auto',
          launched ? 'max-w-2xl max-h-[90vh]' : 'max-w-lg'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary-400" />
            <h3 className="text-lg font-bold">
              {launched ? `Launching ${selectedExam?.label}...` : 'Launch Exam'}
            </h3>
          </div>
          {!launched && (
            <button onClick={onClose} className="p-1.5 hover:bg-surface-800 rounded-lg transition-colors">
              <X className="w-4 h-4 text-surface-400" />
            </button>
          )}
        </div>

        {!launched ? (
          <>
            <p className="text-sm text-surface-400 mb-4">Select an exam to launch or activate:</p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {EXAM_OPTIONS.map(exam => {
                const sc = statusConfig[exam.status];
                return (
                  <button
                    key={exam.id}
                    onClick={() => setSelected(exam.id)}
                    className={clsx(
                      'flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                      selected === exam.id
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-surface-700 bg-surface-800/50 hover:border-surface-600'
                    )}
                  >
                    <span className="text-xl">{exam.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{exam.label}</p>
                      <span className={clsx('text-[10px] px-1.5 py-0.5 rounded border', sc.color)}>
                        {sc.label}
                      </span>
                    </div>
                    {selected === exam.id && (
                      <CheckCircle className="w-4 h-4 text-primary-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mb-5">
              <p className="text-sm text-surface-400 mb-2">Launch mode:</p>
              <div className="flex gap-2">
                {(['pilot', 'full'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={clsx(
                      'flex-1 py-2 rounded-lg text-sm font-medium border transition-all',
                      mode === m
                        ? 'border-primary-500 bg-primary-500/20 text-primary-400'
                        : 'border-surface-700 text-surface-400 hover:border-surface-600'
                    )}
                  >
                    {m === 'pilot' ? '🧪 Pilot (limited users)' : '🌐 Full Launch'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-surface-500 mt-2">
                {mode === 'pilot'
                  ? 'Pilot: up to 50 users, AI tutor active, content generated by Atlas'
                  : 'Full launch: unlimited users, all features enabled, Herald starts marketing'}
              </p>
            </div>

            <button
              onClick={handleLaunch}
              disabled={!selected}
              className={clsx(
                'w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
                selected
                  ? 'bg-primary-500 hover:bg-primary-400 text-white'
                  : 'bg-surface-800 text-surface-500 cursor-not-allowed'
              )}
            >
              <Rocket className="w-4 h-4" />
              {selected ? `Launch ${selectedExam?.label}` : 'Select an exam first'}
            </button>
          </>
        ) : (
          <>
            {/* Workflow info bar */}
            <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-surface-800/50 border border-surface-700/50">
              <span className="text-2xl">{selectedExam?.icon}</span>
              <div>
                <p className="text-sm font-semibold">{selectedExam?.label}</p>
                <p className="text-xs text-surface-400">
                  Pipeline: Scout 🔍 → Atlas 📚 → Forge ⚙️ → Oracle 📊
                </p>
              </div>
              <span className={clsx('ml-auto text-xs px-2 py-0.5 rounded border', statusConfig[selectedExam?.status ?? 'inactive'].color)}>
                {mode === 'pilot' ? '🧪 Pilot' : '🌐 Full Launch'}
              </span>
            </div>

            {/* Live workflow panel */}
            <AgentWorkflowPanel
              workflowId="launch_exam"
              inputs={{ examName: selectedExam?.label, examId: selected, mode }}
              autoStart={true}
              showFlowDiagram={true}
              onComplete={() => setTimeout(onClose, 3000)}
            />
          </>
        )}
      </motion.div>
    </>
  );
}

// ── Run Daily Ops Modal ──────────────────────────────────────────────────────

function RunOpsModal({ onClose }: { onClose: () => void }) {
  const [started, setStarted] = useState(false);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={!started ? onClose : undefined} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto glass rounded-2xl shadow-2xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-bold">Daily Operations</h3>
          </div>
          {!started && (
            <button onClick={onClose} className="p-1.5 hover:bg-surface-800 rounded-lg transition-colors">
              <X className="w-4 h-4 text-surface-400" />
            </button>
          )}
        </div>

        <p className="text-sm text-surface-400 mb-4">
          {started
            ? 'Running daily ops — all agents working in sequence...'
            : 'Pipeline: Oracle 📊 → Scout 🔍 → Herald 📢 → Mentor 👨‍🏫 → Forge ⚙️'}
        </p>

        <AgentWorkflowPanel
          workflowId="run_daily_ops"
          inputs={{ date: new Date().toISOString().split('T')[0] }}
          autoStart={started}
          showFlowDiagram={true}
          onComplete={() => setTimeout(onClose, 4000)}
        />

        {!started && (
          <button
            onClick={() => setStarted(true)}
            className="mt-4 w-full py-2.5 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-400 font-semibold text-sm transition-all flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" /> Run All Tasks
          </button>
        )}
      </motion.div>
    </>
  );
}

// ── All quick actions config ───────────────────────────────────────────────────

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function CEODashboard() {
  const { agents } = useAppStore();
  const navigate = useNavigate();
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [showOpsModal, setShowOpsModal] = useState(false);

  const activeAgents = agents.filter(a => a.status === 'active' || a.status === 'busy').length;
  const totalTasks = agents.reduce((sum, a) => sum + a.metrics.tasksCompleted, 0);
  const avgSuccessRate = agents.reduce((sum, a) => sum + a.metrics.successRate, 0) / agents.length;

  const quickActions = [
    { icon: Rocket, label: 'Discover → Launch', desc: 'Find opportunity first', color: 'text-primary-400', bg: 'bg-primary-500/10 border-primary-500/30 hover:bg-primary-500/20', action: () => navigate('/opportunity-discovery') },
    { icon: Zap, label: 'Run Daily Ops', desc: 'Execute daily automation', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20', action: () => setShowOpsModal(true) },
    { icon: MessageSquare, label: 'Chat with Agents', desc: 'Direct agent interaction', color: 'text-accent-400', bg: 'bg-surface-800 border-surface-700 hover:bg-surface-700', action: () => navigate('/chat') },
    { icon: BarChart3, label: 'View Analytics', desc: 'Platform performance', color: 'text-green-400', bg: 'bg-surface-800 border-surface-700 hover:bg-surface-700', action: () => navigate('/analytics') },
    { icon: Target, label: 'Growth Strategy', desc: 'Autonomous playbooks', color: 'text-orange-400', bg: 'bg-surface-800 border-surface-700 hover:bg-surface-700', action: () => navigate('/strategy') },
    { icon: Plug, label: 'Integrations', desc: 'Connect tools & APIs', color: 'text-purple-400', bg: 'bg-surface-800 border-surface-700 hover:bg-surface-700', action: () => navigate('/integrations') },
    { icon: PenTool, label: 'Blog / Content', desc: 'AI blog management', color: 'text-pink-400', bg: 'bg-surface-800 border-surface-700 hover:bg-surface-700', action: () => navigate('/blog') },
    { icon: Users, label: 'Manage Users', desc: 'Students & teachers', color: 'text-cyan-400', bg: 'bg-surface-800 border-surface-700 hover:bg-surface-700', action: () => navigate('/users') },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Modals */}
      <AnimatePresence>
        {showLaunchModal && <LaunchExamModal onClose={() => setShowLaunchModal(false)} />}
        {showOpsModal && <RunOpsModal onClose={() => setShowOpsModal(false)} />}
      </AnimatePresence>

      {/* ── Priority Banner — #1 thing needing attention ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative flex items-center gap-4 px-5 py-4 rounded-xl bg-amber-500/8 border border-amber-500/30 overflow-hidden"
        style={{ borderLeftWidth: 3, borderLeftColor: '#f59e0b' }}
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/70 mb-0.5">Priority Alert</p>
          <p className="text-sm font-semibold text-white">Herald is awaiting blog approval — 3 posts ready to publish</p>
          <p className="text-xs text-surface-400 mt-0.5">Approving now boosts organic reach by ~40% for the week</p>
        </div>
        <button
          onClick={() => navigate('/blog')}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm font-semibold border border-amber-500/30 transition-all"
        >
          Review <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </motion.div>

      {/* ── Hero Revenue Strip ── */}
      <div className="bg-gradient-to-r from-primary-600/20 to-emerald-600/20 border border-primary-500/30 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-surface-400 text-sm font-medium uppercase tracking-wider">Monthly Recurring Revenue</p>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-3xl sm:text-5xl font-bold text-white">₹4,82,000</span>
              <span className="text-emerald-400 text-lg font-semibold">+23% ↑</span>
            </div>
            <p className="text-surface-400 text-sm mt-1">1,240 active students · 89 new this month</p>
          </div>
          <div className="text-right">
            <p className="text-surface-400 text-sm">Next milestone</p>
            <p className="text-white font-bold text-xl">₹10L MRR</p>
            <div className="w-32 bg-surface-700 rounded-full h-2 mt-2">
              <div className="bg-primary-500 h-2 rounded-full" style={{width: '48%'}} />
            </div>
            <p className="text-surface-400 text-xs mt-1">48% there</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-surface-700">
          {[
            {label:'Today\'s Revenue', value:'₹16,400', change:'+12%'},
            {label:'Churn Rate', value:'2.1%', change:'-0.3%'},
            {label:'LTV', value:'₹8,200', change:'+5%'},
            {label:'CAC', value:'₹340', change:'-8%'},
          ].map(m => (
            <div key={m.label}>
              <p className="text-surface-400 text-xs">{m.label}</p>
              <p className="text-white font-bold">{m.value}</p>
              <p className={m.change.startsWith('+') || m.change.startsWith('-0') ? 'text-emerald-400 text-xs' : 'text-red-400 text-xs'}>{m.change}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CEO Command Center</h1>
          <p className="text-surface-400">Real-time overview of your autonomous education platform</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            All Systems Operational
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Today's MRR"
          value="₹7.24L"
          change={12}
          icon={DollarSign}
          color="bg-gradient-to-br from-green-500 to-emerald-600"
          hero
        />
        <StatCard
          title="Active Students"
          value="2,847"
          change={8.2}
          icon={Users}
          color="bg-gradient-to-br from-primary-500 to-primary-600"
        />
        <StatCard
          title="Agent Tasks Today"
          value={totalTasks.toLocaleString()}
          change={15.3}
          icon={Bot}
          color="bg-gradient-to-br from-accent-500 to-accent-600"
        />
        <StatCard
          title="Success Rate"
          value={`${avgSuccessRate.toFixed(1)}%`}
          change={2.1}
          icon={Activity}
          color="bg-gradient-to-br from-orange-500 to-orange-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <h3 className="font-semibold mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
              <YAxis stroke="#71717a" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#0ea5e9"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* User Growth */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <h3 className="font-semibold mb-4">User Growth</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={userGrowthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
              <YAxis stroke="#71717a" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="students"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={{ fill: '#0ea5e9' }}
              />
              <Line
                type="monotone"
                dataKey="teachers"
                stroke="#d946ef"
                strokeWidth={2}
                dot={{ fill: '#d946ef' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* ── AI Revenue Narrative (Oracle) ── */}
      <AIRevenueNarrative />

      {/* Agent Status & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Agent Fleet Status</h3>
            <span className="text-sm text-surface-400">
              {activeAgents}/{agents.length} active
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-surface-800/50 hover:bg-surface-800 transition-colors cursor-pointer"
              >
                <div className="text-3xl">{agent.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{agent.name}</span>
                    <span
                      className={clsx(
                        'w-2 h-2 rounded-full',
                        agent.status === 'active' && 'bg-green-500',
                        agent.status === 'busy' && 'bg-blue-500',
                        agent.status === 'idle' && 'bg-yellow-500',
                        agent.status === 'offline' && 'bg-surface-500'
                      )}
                    />
                  </div>
                  <p className="text-sm text-surface-400 truncate">{agent.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{agent.metrics.tasksCompleted}</p>
                  <p className="text-xs text-surface-500">tasks</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quick Actions + Recent Events */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
        >
          {/* Quick Actions — now fully wired */}
          <div className="card">
            <h3 className="font-semibold mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {quickActions.slice(0, 4).map((action, i) => (
                <button
                  key={i}
                  onClick={action.action}
                  className={clsx(
                    'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group',
                    action.bg
                  )}
                >
                  <action.icon className={clsx('w-5 h-5 flex-shrink-0', action.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{action.label}</p>
                    <p className="text-xs text-surface-400">{action.desc}</p>
                  </div>
                  {i === 0 ? (
                    <span className="text-xs font-semibold text-primary-400 bg-primary-500/10 px-2 py-1 rounded-lg border border-primary-500/20 flex-shrink-0">
                      Do it →
                    </span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-surface-400 transition-colors" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Recent Events */}
          <div className="card">
            <h4 className="text-sm font-semibold mb-3">Recent Events</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm">Atlas published 15 new questions</p>
                  <p className="text-xs text-surface-500">2 min ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Activity className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm">Sage handled 45 student sessions</p>
                  <p className="text-xs text-surface-500">15 min ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm">Herald awaiting blog approval</p>
                  <p className="text-xs text-surface-500">1 hour ago</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Agent ROI Panel ── */}
      <AgentROIPanel />

      {/* All Quick Actions grid (below charts) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="card"
      >
        <h3 className="font-semibold mb-4">All Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={action.action}
              className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-surface-800/50 hover:bg-surface-800 border border-surface-700/50 hover:border-surface-600 transition-all group text-center"
            >
              <div className={clsx('p-3 rounded-xl bg-surface-700/50 group-hover:scale-110 transition-transform')}>
                <action.icon className={clsx('w-5 h-5', action.color)} />
              </div>
              <div>
                <p className="text-sm font-medium">{action.label}</p>
                <p className="text-[10px] text-surface-500 mt-0.5">{action.desc}</p>
              </div>
              <span className="text-[10px] font-semibold text-surface-400 group-hover:text-white bg-surface-700 group-hover:bg-primary-500/20 group-hover:text-primary-400 px-2 py-0.5 rounded-md transition-colors">
                ▶ Execute
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Agent Workload Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="card"
      >
        <h3 className="font-semibold mb-4">Agent Task Distribution (Today)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={agentWorkload}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
            <YAxis stroke="#71717a" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="tasks" fill="#0ea5e9" radius={[4, 4, 0, 0]}>
              {agentWorkload.map((_, index) => (
                <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* ── Exam Opportunity Radar + Daily Ops Digest + Competitor Pulse ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ExamOpportunityRadar />
        </div>
        <div className="space-y-4">
          <DailyOpsDigest />
          <CompetitorPulse />
        </div>
      </div>
    </div>
  );
}
