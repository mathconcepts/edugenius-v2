import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Zap,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  Settings,
  ChevronRight,
  TrendingUp,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAppStore } from '@/stores/appStore';
import { clsx } from 'clsx';

const performanceData = [
  { time: '00:00', tasks: 12, tokens: 5000 },
  { time: '04:00', tasks: 8, tokens: 3200 },
  { time: '08:00', tasks: 45, tokens: 18000 },
  { time: '12:00', tasks: 67, tokens: 28000 },
  { time: '16:00', tasks: 52, tokens: 21000 },
  { time: '20:00', tasks: 38, tokens: 15000 },
];

const recentTasks = [
  { id: '1', type: 'content', description: 'Generated 15 math questions', time: '2 min ago', status: 'completed' },
  { id: '2', type: 'analysis', description: 'Analyzed student performance data', time: '5 min ago', status: 'completed' },
  { id: '3', type: 'tutor', description: 'Tutoring session with Student #2847', time: '10 min ago', status: 'in-progress' },
  { id: '4', type: 'marketing', description: 'Draft blog post: "10 Tips for JEE"', time: '15 min ago', status: 'pending-review' },
];

export function Agents() {
  const { agentId } = useParams();
  const { agents, updateAgentStatus } = useAppStore();
  const [selectedAgent, setSelectedAgent] = useState(agentId || null);

  const agent = selectedAgent ? agents.find(a => a.id === selectedAgent) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Fleet</h1>
          <p className="text-surface-400">Monitor and control your AI agents</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh All
          </button>
          <button className="btn-primary flex items-center gap-2">
            <Play className="w-4 h-4" />
            Run Daily Ops
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Agent List */}
        <div className="space-y-3">
          {agents.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setSelectedAgent(a.id)}
              className={clsx(
                'card-hover flex items-center gap-4 cursor-pointer',
                selectedAgent === a.id && 'ring-2 ring-primary-500 bg-primary-500/5'
              )}
            >
              <div className="text-3xl">{a.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.name}</span>
                  <span
                    className={clsx(
                      'w-2 h-2 rounded-full',
                      a.status === 'active' && 'bg-green-500',
                      a.status === 'busy' && 'bg-blue-500 animate-pulse',
                      a.status === 'idle' && 'bg-yellow-500',
                      a.status === 'offline' && 'bg-surface-500'
                    )}
                  />
                </div>
                <p className="text-xs text-surface-400 truncate">{a.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-surface-400" />
            </motion.div>
          ))}
        </div>

        {/* Agent Detail */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {agent ? (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Agent Header */}
                <div className="card">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-5xl">{agent.emoji}</div>
                      <div>
                        <h2 className="text-2xl font-bold">{agent.name}</h2>
                        <p className="text-surface-400">{agent.description}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span
                            className={clsx(
                              'flex items-center gap-1.5 px-2 py-1 rounded-full text-sm',
                              agent.status === 'active' && 'bg-green-500/20 text-green-400',
                              agent.status === 'busy' && 'bg-blue-500/20 text-blue-400',
                              agent.status === 'idle' && 'bg-yellow-500/20 text-yellow-400',
                              agent.status === 'offline' && 'bg-surface-500/20 text-surface-400'
                            )}
                          >
                            <span
                              className={clsx(
                                'w-2 h-2 rounded-full',
                                agent.status === 'active' && 'bg-green-500',
                                agent.status === 'busy' && 'bg-blue-500 animate-pulse',
                                agent.status === 'idle' && 'bg-yellow-500',
                                agent.status === 'offline' && 'bg-surface-500'
                              )}
                            />
                            {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                          </span>
                          <span className="text-sm text-surface-400">
                            {agent.subAgents.length} sub-agents
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateAgentStatus(agent.id, agent.status === 'active' ? 'idle' : 'active')}
                        className={clsx(
                          'p-2 rounded-lg transition-colors',
                          agent.status === 'active' || agent.status === 'busy'
                            ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        )}
                      >
                        {agent.status === 'active' || agent.status === 'busy' ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                      </button>
                      <Link
                        to={`/chat?agent=${agent.id}`}
                        className="p-2 rounded-lg bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-colors"
                      >
                        <MessageSquare className="w-5 h-5" />
                      </Link>
                      <button className="p-2 rounded-lg bg-surface-800 hover:bg-surface-700 transition-colors">
                        <Settings className="w-5 h-5 text-surface-400" />
                      </button>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-4 gap-4 mt-6">
                    <div className="p-4 rounded-xl bg-surface-800/50">
                      <div className="flex items-center gap-2 text-surface-400 mb-1">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">Tasks Completed</span>
                      </div>
                      <p className="text-2xl font-bold">{agent.metrics.tasksCompleted.toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-surface-800/50">
                      <div className="flex items-center gap-2 text-surface-400 mb-1">
                        <Zap className="w-4 h-4" />
                        <span className="text-sm">Tokens Used</span>
                      </div>
                      <p className="text-2xl font-bold">{(agent.metrics.tokensUsed / 1000).toFixed(0)}K</p>
                    </div>
                    <div className="p-4 rounded-xl bg-surface-800/50">
                      <div className="flex items-center gap-2 text-surface-400 mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">Avg Response</span>
                      </div>
                      <p className="text-2xl font-bold">{agent.metrics.avgResponseTime}s</p>
                    </div>
                    <div className="p-4 rounded-xl bg-surface-800/50">
                      <div className="flex items-center gap-2 text-surface-400 mb-1">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm">Success Rate</span>
                      </div>
                      <p className="text-2xl font-bold">{agent.metrics.successRate}%</p>
                    </div>
                  </div>
                </div>

                {/* Performance Chart */}
                <div className="card">
                  <h3 className="font-semibold mb-4">Performance (24h)</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={performanceData}>
                      <defs>
                        <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="time" stroke="#71717a" fontSize={12} />
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
                        dataKey="tasks"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorTasks)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Sub-agents */}
                <div className="card">
                  <h3 className="font-semibold mb-4">Sub-Agents</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {agent.subAgents.map((sub) => (
                      <div
                        key={sub.id}
                        className="p-4 rounded-xl bg-surface-800/50 hover:bg-surface-800 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{sub.name}</span>
                          <span
                            className={clsx(
                              'w-2 h-2 rounded-full',
                              sub.status === 'active' && 'bg-green-500',
                              sub.status === 'busy' && 'bg-blue-500 animate-pulse',
                              sub.status === 'idle' && 'bg-yellow-500'
                            )}
                          />
                        </div>
                        <p className="text-xs text-surface-400">{sub.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Tasks */}
                <div className="card">
                  <h3 className="font-semibold mb-4">Recent Tasks</h3>
                  <div className="space-y-3">
                    {recentTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-4 p-3 rounded-lg bg-surface-800/50"
                      >
                        <div
                          className={clsx(
                            'p-2 rounded-lg',
                            task.status === 'completed' && 'bg-green-500/20',
                            task.status === 'in-progress' && 'bg-blue-500/20',
                            task.status === 'pending-review' && 'bg-yellow-500/20'
                          )}
                        >
                          {task.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-400" />}
                          {task.status === 'in-progress' && <Activity className="w-4 h-4 text-blue-400" />}
                          {task.status === 'pending-review' && <AlertCircle className="w-4 h-4 text-yellow-400" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{task.description}</p>
                          <p className="text-xs text-surface-500">{task.time}</p>
                        </div>
                        <span
                          className={clsx(
                            'px-2 py-1 rounded text-xs font-medium',
                            task.status === 'completed' && 'bg-green-500/20 text-green-400',
                            task.status === 'in-progress' && 'bg-blue-500/20 text-blue-400',
                            task.status === 'pending-review' && 'bg-yellow-500/20 text-yellow-400'
                          )}
                        >
                          {task.status.replace('-', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="card flex flex-col items-center justify-center h-96"
              >
                <div className="text-6xl mb-4">🤖</div>
                <h3 className="text-xl font-semibold mb-2">Select an Agent</h3>
                <p className="text-surface-400 text-center max-w-md">
                  Choose an agent from the list to view detailed information, metrics, and recent activity.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
