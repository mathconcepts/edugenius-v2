import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  FileText,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Filter,
  X,
} from 'lucide-react';
import { LiveHealthPanel, OnboardingFunnelCard, ContentQualityHeatmap, QuickUserActions, ActionableAlerts } from '@/components/ux/UXEnhancements';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { clsx } from 'clsx';

const activityData = [
  { time: '00:00', users: 45 },
  { time: '04:00', users: 23 },
  { time: '08:00', users: 156 },
  { time: '12:00', users: 289 },
  { time: '16:00', users: 342 },
  { time: '20:00', users: 198 },
  { time: '24:00', users: 87 },
];

const recentUsers = [
  { id: '1', name: 'Ananya Singh', email: 'ananya@email.com', role: 'student', joined: '2 hours ago', verified: true },
  { id: '2', name: 'Raj Mehta', email: 'raj@school.edu', role: 'teacher', joined: '5 hours ago', verified: true },
  { id: '3', name: 'Kavya Nair', email: 'kavya@email.com', role: 'student', joined: '1 day ago', verified: false },
  { id: '4', name: 'Arun Reddy', email: 'arun@email.com', role: 'student', joined: '1 day ago', verified: true },
];

const systemAlerts = [
  { id: '1', type: 'warning', message: 'High server load detected', time: '10 min ago' },
  { id: '2', type: 'info', message: 'Daily backup completed', time: '1 hour ago' },
  { id: '3', type: 'success', message: 'SSL certificate renewed', time: '2 hours ago' },
];

const contentStats = [
  { label: 'Total Questions', value: '12,450', change: '+234 this week' },
  { label: 'Active Topics', value: '456', change: '+12 this week' },
  { label: 'Video Lessons', value: '128', change: '+5 this week' },
  { label: 'Practice Tests', value: '89', change: '+3 this week' },
];

export function AdminDashboard() {
  const navigate = useNavigate();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [toast, setToast] = useState<string | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setShowInviteModal(false);
    setInviteName(''); setInviteEmail(''); setInviteRole('student');
    setToast(`Invite sent to ${inviteEmail} as ${inviteRole}`);
    setTimeout(() => setToast(null), 4000);
  };

  const getAlertAction = (alert: typeof systemAlerts[0]) => {
    if (alert.type === 'warning') return { label: 'Investigate', onClick: () => navigate('/status') };
    if (alert.type === 'error' || alert.type === 'critical') return { label: 'Fix Now', onClick: () => navigate('/status') };
    if (alert.type === 'info') return { label: 'View Details', onClick: () => setDismissedAlerts(p => new Set([...p, alert.id])) };
    return { label: '✓ Dismiss', onClick: () => setDismissedAlerts(p => new Set([...p, alert.id])) };
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-surface-800 border border-surface-700 rounded-xl p-4 text-sm text-white shadow-xl z-50 flex items-center gap-3">
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          {toast}
          <button onClick={() => setToast(null)} className="ml-2 text-surface-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Quick Invite Modal */}
      {showInviteModal && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowInviteModal(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Quick Invite</h3>
              <button onClick={() => setShowInviteModal(false)} className="p-1.5 hover:bg-surface-700 rounded-lg"><X className="w-4 h-4 text-surface-400" /></button>
            </div>
            <form onSubmit={handleInviteSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-surface-400 mb-1 block">Name</label>
                <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Full name" className="input w-full" required />
              </div>
              <div>
                <label className="text-xs text-surface-400 mb-1 block">Email</label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@example.com" className="input w-full" required />
              </div>
              <div>
                <label className="text-xs text-surface-400 mb-1 block">Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'student' | 'teacher' | 'admin')} className="input w-full">
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button type="submit" className="btn-primary w-full mt-2">Send Invite</button>
            </form>
          </div>
        </>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-surface-400">Platform management and user administration</p>
        </div>
        <div className="flex items-center gap-3">
          {/* System Health Indicators */}
          <div className="flex items-center gap-2 text-sm mr-2">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"/>API</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"/>DB</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400"/>AI</span>
          </div>
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Report
          </button>
          <button onClick={() => setShowInviteModal(true)} className="btn-primary flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Quick Invite
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-400">Total Users</p>
              <p className="text-2xl font-bold mt-1">3,247</p>
            </div>
            <div className="p-3 rounded-xl bg-primary-500/20">
              <Users className="w-6 h-6 text-primary-400" />
            </div>
          </div>
          <p className="text-sm text-green-400 mt-2">+156 this month</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-400">Active Today</p>
              <p className="text-2xl font-bold mt-1">892</p>
            </div>
            <div className="p-3 rounded-xl bg-green-500/20">
              <Activity className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <p className="text-sm text-surface-400 mt-2">27.5% of total</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-400">Teachers</p>
              <p className="text-2xl font-bold mt-1">89</p>
            </div>
            <div className="p-3 rounded-xl bg-accent-500/20">
              <Shield className="w-6 h-6 text-accent-400" />
            </div>
          </div>
          <p className="text-sm text-green-400 mt-2">+12 this month</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-400">Content Items</p>
              <p className="text-2xl font-bold mt-1">13,123</p>
            </div>
            <div className="p-3 rounded-xl bg-yellow-500/20">
              <FileText className="w-6 h-6 text-yellow-400" />
            </div>
          </div>
          <p className="text-sm text-green-400 mt-2">+254 this week</p>
        </motion.div>
      </div>

      {/* ── Live Health Panel + Quick User Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LiveHealthPanel />
        <QuickUserActions />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Activity Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">User Activity (Today)</h2>
            <button className="btn-ghost text-sm flex items-center gap-1">
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={activityData}>
              <defs>
                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
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
                dataKey="users"
                stroke="#0ea5e9"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorUsers)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* System Alerts with Inline Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <h2 className="font-semibold text-lg mb-4">System Alerts</h2>
          <div className="space-y-3">
            {systemAlerts.filter(a => !dismissedAlerts.has(a.id)).map(alert => {
              const alertAction = getAlertAction(alert);
              const iconColor = alert.type === 'warning' ? 'text-yellow-400' : alert.type === 'error' || alert.type === 'critical' ? 'text-red-400' : alert.type === 'success' ? 'text-green-400' : 'text-blue-400';
              const borderColor = alert.type === 'warning' ? 'border-yellow-500/20 bg-yellow-500/5' : alert.type === 'error' || alert.type === 'critical' ? 'border-red-500/20 bg-red-500/5' : alert.type === 'success' ? 'border-green-500/20 bg-green-500/5' : 'border-blue-500/20 bg-blue-500/5';
              const btnColor = alert.type === 'warning' ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20' : alert.type === 'error' || alert.type === 'critical' ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-surface-700 text-surface-300 hover:bg-surface-600';
              return (
                <div key={alert.id} className={clsx('flex items-center gap-3 p-3 rounded-xl border', borderColor)}>
                  <AlertTriangle className={clsx('w-4 h-4 flex-shrink-0', iconColor)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.message}</p>
                    <p className="text-xs text-surface-500">{alert.time}</p>
                  </div>
                  <button onClick={alertAction.onClick} className={clsx('text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0', btnColor)}>
                    {alertAction.label}
                  </button>
                </div>
              );
            })}
            {systemAlerts.every(a => dismissedAlerts.has(a.id)) && (
              <div className="text-center py-6 text-surface-400 text-sm">✅ No active alerts</div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Recent Users & Content Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Recent Registrations</h2>
            <Link to="/users" className="text-sm text-primary-400 hover:text-primary-300">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {recentUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-surface-800/50 hover:bg-surface-800 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white font-medium">
                  {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{user.name}</p>
                    {user.verified ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-yellow-400" />
                    )}
                  </div>
                  <p className="text-sm text-surface-400 truncate">{user.email}</p>
                </div>
                <div className="text-right">
                  <span
                    className={clsx(
                      'px-2 py-0.5 rounded text-xs font-medium capitalize',
                      user.role === 'teacher' && 'bg-accent-500/20 text-accent-400',
                      user.role === 'student' && 'bg-primary-500/20 text-primary-400'
                    )}
                  >
                    {user.role}
                  </span>
                  <p className="text-xs text-surface-500 mt-1">{user.joined}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Content Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Content Overview</h2>
            <Link to="/content" className="text-sm text-primary-400 hover:text-primary-300">
              Manage
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {contentStats.map((stat, index) => (
              <div
                key={index}
                className="p-4 rounded-lg bg-surface-800/50"
              >
                <p className="text-sm text-surface-400">{stat.label}</p>
                <p className="text-xl font-bold mt-1">{stat.value}</p>
                <p className="text-xs text-green-400 mt-1">{stat.change}</p>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 rounded-lg bg-gradient-to-br from-primary-500/10 to-accent-500/10">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📚</span>
              <div>
                <p className="font-medium">AI Content Generation</p>
                <p className="text-sm text-surface-400">Atlas has created 234 items this week</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Onboarding Funnel + Content Quality Heatmap ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OnboardingFunnelCard />
        <ContentQualityHeatmap />
      </div>
    </div>
  );
}
