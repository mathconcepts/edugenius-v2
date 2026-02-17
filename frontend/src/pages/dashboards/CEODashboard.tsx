import { motion } from 'framer-motion';
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
  Play,
} from 'lucide-react';
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
}

function StatCard({ title, value, change, icon: Icon, color }: StatCardProps) {
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
          <p className="text-2xl font-bold mt-1">{value}</p>
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

export function CEODashboard() {
  const { agents } = useAppStore();

  const activeAgents = agents.filter(a => a.status === 'active' || a.status === 'busy').length;
  const totalTasks = agents.reduce((sum, a) => sum + a.metrics.tasksCompleted, 0);
  const avgSuccessRate = agents.reduce((sum, a) => sum + a.metrics.successRate, 0) / agents.length;

  return (
    <div className="space-y-6">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Monthly Revenue"
          value="₹4.2L"
          change={12.5}
          icon={DollarSign}
          color="bg-gradient-to-br from-green-500 to-emerald-600"
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <h3 className="font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary-500/10 border border-primary-500/30 hover:bg-primary-500/20 transition-colors text-left">
              <Play className="w-5 h-5 text-primary-400" />
              <div>
                <p className="font-medium text-sm">Launch Exam</p>
                <p className="text-xs text-surface-400">Start new exam content pipeline</p>
              </div>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-800 hover:bg-surface-700 transition-colors text-left">
              <Zap className="w-5 h-5 text-yellow-400" />
              <div>
                <p className="font-medium text-sm">Run Daily Ops</p>
                <p className="text-xs text-surface-400">Execute daily automation</p>
              </div>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-800 hover:bg-surface-700 transition-colors text-left">
              <Bot className="w-5 h-5 text-accent-400" />
              <div>
                <p className="font-medium text-sm">Chat with Agents</p>
                <p className="text-xs text-surface-400">Direct agent interaction</p>
              </div>
            </button>
          </div>

          {/* Recent Events */}
          <div className="mt-6 pt-4 border-t border-surface-700/50">
            <h4 className="text-sm font-medium text-surface-400 mb-3">Recent Events</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                <div>
                  <p className="text-sm">Atlas published 15 new questions</p>
                  <p className="text-xs text-surface-500">2 min ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Activity className="w-4 h-4 text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm">Sage handled 45 student sessions</p>
                  <p className="text-xs text-surface-500">15 min ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5" />
                <div>
                  <p className="text-sm">Herald awaiting blog approval</p>
                  <p className="text-xs text-surface-500">1 hour ago</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

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
    </div>
  );
}
