/**
 * UserManagementPortal.tsx — EduGenius Enhanced Admin Portal
 *
 * Tabs: Users | Exam Subscriptions | Channel Linking | MCP Privileges | Add/Edit User
 */

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Plus, X, Copy, Check, Shield, BookOpen,
  GraduationCap, Crown, Phone, MessageSquare, Globe, Monitor,
  ChevronRight, Filter, Download, Upload, RefreshCw, Eye,
  Wifi, WifiOff, Send, Code2, Activity, Zap, Database, Lock,
  Unlock, Trash2, Edit2, AlertTriangle, CheckCircle, Clock,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  loadAllUsers,
  saveAllUsers,
  createUser,
  subscribeToExam,
  linkChannel,
  computeMCPPrivileges,
  EXAM_CATALOG,
  MOCK_USERS,
  type EGUser,
  type UserRole,
  type PlanTier,
  type ExamSubscription,
  type ChannelAccess,
} from '@/services/userService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function copyToClipboard(text: string, onDone: () => void) {
  navigator.clipboard.writeText(text).then(onDone);
}

function getHighestPlan(user: EGUser): PlanTier {
  const planOrder: PlanTier[] = ['free', 'starter', 'pro', 'enterprise'];
  const plans = user.examSubscriptions.map((s) => s.plan);
  return plans.reduce((best, p) =>
    planOrder.indexOf(p) > planOrder.indexOf(best) ? p : best,
  'free' as PlanTier);
}

// ─── Style Maps ───────────────────────────────────────────────────────────────

const roleMeta: Record<UserRole, { label: string; color: string; icon: React.ReactNode }> = {
  student:  { label: 'Student',  color: 'text-blue-400 bg-blue-500/20',   icon: <GraduationCap size={11} /> },
  teacher:  { label: 'Teacher',  color: 'text-green-400 bg-green-500/20', icon: <BookOpen size={11} /> },
  parent:   { label: 'Parent',   color: 'text-purple-400 bg-purple-500/20', icon: <Users size={11} /> },
  manager:  { label: 'Manager',  color: 'text-teal-400 bg-teal-500/20',   icon: <Shield size={11} /> },
  admin:    { label: 'Admin',    color: 'text-amber-400 bg-amber-500/20', icon: <Shield size={11} /> },
  owner:    { label: 'Owner',    color: 'text-red-400 bg-red-500/20',     icon: <Crown size={11} /> },
};

const planMeta: Record<PlanTier, { label: string; color: string }> = {
  free:       { label: 'Free',       color: 'text-surface-400 bg-surface-700' },
  starter:    { label: 'Starter',    color: 'text-blue-400 bg-blue-500/20' },
  pro:        { label: 'Pro',        color: 'text-violet-400 bg-violet-500/20' },
  enterprise: { label: 'Enterprise', color: 'text-amber-400 bg-amber-500/20' },
};

const statusMeta = {
  active:    { dot: 'bg-green-500',   text: 'text-green-400',   label: 'Active' },
  inactive:  { dot: 'bg-surface-500', text: 'text-surface-400', label: 'Inactive' },
  suspended: { dot: 'bg-red-500',     text: 'text-red-400',     label: 'Suspended' },
  pending:   { dot: 'bg-amber-500',   text: 'text-amber-400',   label: 'Pending' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Chip({
  children, className,
}: { children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', className)}>
      {children}
    </span>
  );
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const sz = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' }[size];
  return (
    <div className={clsx('rounded-full bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center font-bold text-white shrink-0', sz)}>
      {initials}
    </div>
  );
}

function ChannelIcons({ access }: { access: ChannelAccess }) {
  return (
    <div className="flex items-center gap-1">
      {access.web       && <Globe      size={12} className="text-blue-400" />}
      {access.whatsapp  && <Phone      size={12} className="text-green-400" />}
      {access.telegram  && <Send       size={12} className="text-blue-300" />}
      {access.widget    && <Code2      size={12} className="text-violet-400" />}
    </div>
  );
}

// ─── Copy UID Badge ───────────────────────────────────────────────────────────

function UIDChip({ uid }: { uid: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => copyToClipboard(uid, () => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
      className="flex items-center gap-1 font-mono text-xs text-primary-300 hover:text-primary-200 transition-colors group"
    >
      {uid}
      {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} className="opacity-40 group-hover:opacity-100" />}
    </button>
  );
}

// ─── Tab Button ───────────────────────────────────────────────────────────────

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
        active
          ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
          : 'text-surface-400 hover:text-white hover:bg-surface-700/40'
      )}
    >
      {children}
    </button>
  );
}

// ─── User Detail Panel ────────────────────────────────────────────────────────

function UserDetailPanel({
  user,
  onClose,
  onUpdate,
}: {
  user: EGUser;
  onClose: () => void;
  onUpdate: (u: EGUser) => void;
}) {
  const highestPlan = getHighestPlan(user);
  const pm = planMeta[highestPlan];
  const sm = statusMeta[user.status];

  const toggleStatus = () => {
    const next = user.status === 'active' ? 'suspended' : 'active';
    onUpdate({ ...user, status: next });
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="w-[480px] bg-surface-900 border-l border-white/10 flex flex-col overflow-y-auto"
        initial={{ x: 480 }}
        animate={{ x: 0 }}
        exit={{ x: 480 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-white">{user.name}</p>
                <Chip className={pm.color}>{pm.label}</Chip>
              </div>
              <UIDChip uid={user.uid} />
            </div>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-white p-2 rounded-lg hover:bg-surface-700/40">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {/* Identity */}
          <section>
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Identity</h3>
            <div className="bg-surface-800/60 rounded-xl border border-white/8 p-4 space-y-2 text-sm">
              {user.email && <div className="flex justify-between"><span className="text-surface-400">Email</span><span className="text-white">{user.email}</span></div>}
              {user.phone && <div className="flex justify-between"><span className="text-surface-400">Phone</span><span className="text-white">{user.phone}</span></div>}
              <div className="flex justify-between"><span className="text-surface-400">Role</span>
                <Chip className={roleMeta[user.role].color}>{roleMeta[user.role].icon} {roleMeta[user.role].label}</Chip>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-surface-400">Status</span>
                <div className="flex items-center gap-2">
                  <span className={clsx('flex items-center gap-1.5 text-xs', sm.text)}>
                    <span className={clsx('w-1.5 h-1.5 rounded-full', sm.dot)} />{sm.label}
                  </span>
                  <button
                    onClick={toggleStatus}
                    className={clsx(
                      'px-2 py-0.5 rounded-md text-xs font-medium transition-colors',
                      user.status === 'active'
                        ? 'text-red-400 hover:bg-red-500/20'
                        : 'text-green-400 hover:bg-green-500/20'
                    )}
                  >
                    {user.status === 'active' ? 'Suspend' : 'Activate'}
                  </button>
                </div>
              </div>
              <div className="flex justify-between"><span className="text-surface-400">Joined</span><span className="text-white text-xs">{user.createdAt.slice(0, 10)}</span></div>
              <div className="flex justify-between"><span className="text-surface-400">Last active</span><span className="text-white text-xs">{timeAgo(user.lastActiveAt)}</span></div>
            </div>

            {/* Auth methods */}
            {user.authMethods.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-surface-500 mb-2">Auth methods:</p>
                <div className="flex flex-wrap gap-1.5">
                  {user.authMethods.map((m, i) => (
                    <Chip key={i} className="bg-surface-700 text-surface-300 border border-white/8">
                      {m.type.replace(/_/g, ' ')}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Item 11: Multi-exam summary row */}
          {user.examSubscriptions.length > 0 && (() => {
            const activeOnly = user.examSubscriptions.filter(
              (s) => s.status === 'active' || s.status === 'trial'
            );
            const effectivePriv = computeMCPPrivileges(activeOnly);
            const subStatusIcon = (status: string) =>
              status === 'active' ? '✅' : status === 'trial' ? '⏳' : '🔒';
            return (
              <section>
                <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Subscription Summary</h3>
                <div className="bg-surface-800/60 rounded-xl border border-white/8 p-3 space-y-2">
                  <div>
                    <p className="text-xs text-surface-400 mb-1.5">Active exams:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {user.examSubscriptions.map((s) => {
                        const exam = EXAM_CATALOG.find((e) => e.id === s.examId);
                        return (
                          <span key={s.examId} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-surface-700 rounded-lg">
                            <span>{exam?.emoji}</span>
                            <span className="text-white">{s.examName}</span>
                            <Chip className={`${planMeta[s.plan].color} text-xs py-0 px-1`}>{s.plan}</Chip>
                            <span>{subStatusIcon(s.status)}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="border-t border-white/8 pt-2">
                    <p className="text-xs text-surface-400 mb-1">Effective privileges (highest plan):</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className={effectivePriv.wolframEnabled ? 'text-green-400' : 'text-surface-500'}>
                        {effectivePriv.wolframEnabled ? '✅' : '❌'} Wolfram
                      </span>
                      <span className={effectivePriv.ragEnabled ? 'text-green-400' : 'text-surface-500'}>
                        {effectivePriv.ragEnabled ? '✅' : '❌'} RAG
                      </span>
                      <span className={effectivePriv.customMcpEnabled ? 'text-green-400' : 'text-surface-500'}>
                        {effectivePriv.customMcpEnabled ? '✅' : '❌'} Custom MCP
                      </span>
                      <span className="text-surface-400">
                        Max {effectivePriv.maxKnowledgeSources === 99 ? '∞' : effectivePriv.maxKnowledgeSources} sources
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            );
          })()}

          {/* Exam Subscriptions */}
          <section>
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Exam Subscriptions</h3>
            {user.examSubscriptions.length === 0 ? (
              <p className="text-surface-500 text-sm">No exam subscriptions</p>
            ) : (
              <div className="space-y-2">
                {user.examSubscriptions.map((sub) => {
                  const exam = EXAM_CATALOG.find((e) => e.id === sub.examId);
                  return (
                    <div key={sub.examId} className="bg-surface-800/60 rounded-xl border border-white/8 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{exam?.emoji}</span>
                          <div>
                            <p className="text-sm font-medium text-white">{sub.examName}</p>
                            <p className="text-xs text-surface-400">{sub.status} · {sub.expiresAt ? `expires ${sub.expiresAt.slice(0, 10)}` : 'lifetime'}</p>
                          </div>
                        </div>
                        <Chip className={planMeta[sub.plan].color}>{sub.plan}</Chip>
                      </div>
                      <div className="grid grid-cols-4 gap-1 mt-2">
                        {[
                          ['Chat', sub.features.chatEnabled],
                          ['Practice', sub.features.practiceEnabled],
                          ['Wolfram', sub.features.wolframVerification],
                          ['RAG', sub.features.ragEnabled],
                        ].map(([label, enabled]) => (
                          <div key={String(label)} className={clsx('flex items-center gap-1 text-xs px-2 py-1 rounded-lg', enabled ? 'text-green-400 bg-green-500/10' : 'text-surface-500 bg-surface-800')}>
                            {enabled ? <CheckCircle size={10} /> : <X size={10} />} {label}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Channel Access */}
          <section>
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Channel Access</h3>
            <div className="bg-surface-800/60 rounded-xl border border-white/8 p-4 space-y-3">
              {(['web', 'whatsapp', 'telegram', 'widget'] as const).map((ch) => {
                const enabled = !!user.channelAccess[ch];
                const identifier =
                  ch === 'whatsapp' ? user.channelAccess.whatsappPhone :
                  ch === 'telegram' ? user.channelAccess.telegramChatId :
                  ch === 'widget'   ? user.channelAccess.widgetToken :
                  null;
                return (
                  <div key={ch} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {ch === 'web'      && <Globe size={14} className="text-blue-400" />}
                      {ch === 'whatsapp' && <Phone size={14} className="text-green-400" />}
                      {ch === 'telegram' && <Send  size={14} className="text-blue-300" />}
                      {ch === 'widget'   && <Code2 size={14} className="text-violet-400" />}
                      <span className="text-sm text-surface-300 capitalize">{ch}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {identifier && <span className="text-xs text-surface-500 font-mono">{identifier}</span>}
                      {enabled
                        ? <Wifi size={12} className="text-green-400" />
                        : <WifiOff size={12} className="text-surface-600" />
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* MCP Privileges */}
          <section>
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">MCP Privileges</h3>
            <div className="bg-surface-800/60 rounded-xl border border-white/8 p-4 space-y-2 text-sm">
              {[
                ['Wolfram Alpha', user.mcpPrivileges.wolframEnabled],
                ['RAG Search', user.mcpPrivileges.ragEnabled],
                ['External APIs', user.mcpPrivileges.externalApiEnabled],
                ['Custom MCP', user.mcpPrivileges.customMcpEnabled],
              ].map(([label, enabled]) => (
                <div key={String(label)} className="flex items-center justify-between">
                  <span className="text-surface-400">{label}</span>
                  <span className={enabled ? 'text-green-400 flex items-center gap-1' : 'text-surface-600 flex items-center gap-1'}>
                    {enabled ? <Unlock size={12} /> : <Lock size={12} />}
                    {enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <span className="text-surface-400">Max sources</span>
                <span className="text-white">{user.mcpPrivileges.maxKnowledgeSources === 99 ? 'Unlimited' : user.mcpPrivileges.maxKnowledgeSources}</span>
              </div>
              {user.mcpPrivileges.allowedSources.length > 0 && (
                <div>
                  <span className="text-surface-400 block mb-1">Allowed sources:</span>
                  <div className="flex flex-wrap gap-1">
                    {user.mcpPrivileges.allowedSources.map((s) => (
                      <Chip key={s} className="bg-surface-700 text-surface-300 text-xs">{s}</Chip>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Add/Edit User Modal ──────────────────────────────────────────────────────

function AddUserModal({ onClose, onSave }: { onClose: () => void; onSave: (u: EGUser) => void }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'student' as UserRole,
    status: 'active' as EGUser['status'],
    examId: '',
    plan: 'free' as PlanTier,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    const user = createUser({
      name: form.name.trim(),
      email: form.email || undefined,
      phone: form.phone || undefined,
      role: form.role,
      status: form.status,
    });
    const users = loadAllUsers();
    users.push(user);
    saveAllUsers(users);
    let finalUser = user;
    if (form.examId) {
      finalUser = subscribeToExam(user.uid, form.examId, form.plan) ?? user;
    }
    setSaving(false);
    onSave(finalUser);
    onClose();
  };

  const inputCls = 'w-full px-3 py-2 rounded-xl bg-surface-700/60 border border-white/10 text-white text-sm placeholder-surface-500 focus:outline-none focus:border-primary-400';

  return (
    <motion.div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="bg-surface-800 border border-white/10 rounded-2xl w-full max-w-md"
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/8">
          <p className="font-semibold text-white">Add New User</p>
          <button onClick={onClose} className="text-surface-400 hover:text-white p-1.5 rounded-lg hover:bg-surface-700/40"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-surface-400 mb-1">Name *</label>
            <input className={inputCls} placeholder="Arjun Sharma" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-surface-400 mb-1">Email</label>
              <input className={inputCls} placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Phone (E.164)</label>
              <input className={inputCls} placeholder="+919876543210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-surface-400 mb-1">Role</label>
              <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
                {(['student', 'teacher', 'parent', 'manager', 'admin', 'owner'] as UserRole[]).map((r) => (
                  <option key={r} value={r}>{roleMeta[r].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Status</label>
              <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as EGUser['status'] })}>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-surface-400 mb-1">Exam</label>
              <select className={inputCls} value={form.examId} onChange={(e) => setForm({ ...form, examId: e.target.value })}>
                <option value="">— None —</option>
                {EXAM_CATALOG.map((e) => <option key={e.id} value={e.id}>{e.emoji} {e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Plan</label>
              <select className={inputCls} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value as PlanTier })}>
                {(['free', 'starter', 'pro', 'enterprise'] as PlanTier[]).map((p) => (
                  <option key={p} value={p}>{planMeta[p].label}</option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
        <div className="p-6 pt-0 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-surface-400 hover:text-white text-sm transition-colors">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-violet-600 text-white font-medium text-sm hover:from-primary-500 hover:to-violet-500 transition-all disabled:opacity-60"
          >
            {saving ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Tab 1: Users ─────────────────────────────────────────────────────────────

function UsersTab({ users, onSelect, onRefresh }: { users: EGUser[]; onSelect: (u: EGUser) => void; onRefresh: () => void }) {
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      if (q && !u.name.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q) && !u.phone?.includes(q) && !u.uid.toLowerCase().includes(q)) return false;
      if (filterRole !== 'all' && u.role !== filterRole) return false;
      if (filterStatus !== 'all' && u.status !== filterStatus) return false;
      if (filterPlan !== 'all') {
        const highest = getHighestPlan(u);
        if (highest !== filterPlan) return false;
      }
      return true;
    });
  }, [users, search, filterRole, filterStatus, filterPlan]);

  const selCls = 'px-3 py-1.5 rounded-lg bg-surface-700/60 border border-white/10 text-surface-300 text-xs focus:outline-none focus:border-primary-400';

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <input
            type="text"
            placeholder="Search name, email, phone, UID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-surface-700/60 border border-white/10 text-white text-sm placeholder-surface-500 focus:outline-none focus:border-primary-400"
          />
        </div>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className={selCls}>
          <option value="all">All roles</option>
          {Object.entries(roleMeta).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selCls}>
          <option value="all">All status</option>
          {Object.keys(statusMeta).map((s) => <option key={s} value={s}>{statusMeta[s as keyof typeof statusMeta].label}</option>)}
        </select>
        <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)} className={selCls}>
          <option value="all">All plans</option>
          {Object.entries(planMeta).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={onRefresh} className="p-2 rounded-lg bg-surface-700/40 border border-white/8 text-surface-400 hover:text-white transition-colors">
          <RefreshCw size={14} />
        </button>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium transition-colors"
        >
          <Plus size={14} /> Add User
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface-800/60 rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                {['UID', 'User', 'Role', 'Status', 'Exams', 'Channels', 'Plan', 'Last Active', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-surface-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const rm = roleMeta[u.role];
                const pm = planMeta[getHighestPlan(u)];
                const sm = statusMeta[u.status];
                return (
                  <motion.tr
                    key={u.uid}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors group"
                    onClick={() => onSelect(u)}
                  >
                    <td className="px-4 py-3"><UIDChip uid={u.uid} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={u.name} size="sm" />
                        <div>
                          <p className="text-white font-medium leading-tight">{u.name}</p>
                          <p className="text-surface-500 text-xs">{u.email ?? u.phone ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Chip className={rm.color}>{rm.icon} {rm.label}</Chip></td>
                    <td className="px-4 py-3">
                      <span className={clsx('flex items-center gap-1.5 text-xs', sm.text)}>
                        <span className={clsx('w-1.5 h-1.5 rounded-full', sm.dot)} />{sm.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.examSubscriptions.slice(0, 2).map((s) => (
                          <Chip key={s.examId} className="bg-surface-700 text-surface-300 text-xs">
                            {EXAM_CATALOG.find((e) => e.id === s.examId)?.emoji} {s.examName}
                          </Chip>
                        ))}
                        {u.examSubscriptions.length > 2 && <Chip className="bg-surface-700 text-surface-400">+{u.examSubscriptions.length - 2}</Chip>}
                      </div>
                    </td>
                    <td className="px-4 py-3"><ChannelIcons access={u.channelAccess} /></td>
                    <td className="px-4 py-3"><Chip className={pm.color}>{pm.label}</Chip></td>
                    <td className="px-4 py-3 text-surface-400 text-xs whitespace-nowrap">{timeAgo(u.lastActiveAt)}</td>
                    <td className="px-4 py-3">
                      <ChevronRight size={14} className="text-surface-600 group-hover:text-surface-300 transition-colors" />
                    </td>
                  </motion.tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-surface-500">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onSave={onRefresh} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Tab 2: Exam Subscriptions ────────────────────────────────────────────────

function ExamSubscriptionsTab({ users, onRefresh }: { users: EGUser[]; onRefresh: () => void }) {
  const [showAssign, setShowAssign] = useState(false);
  const [assignExamId, setAssignExamId] = useState('');
  const [assignPlan, setAssignPlan] = useState<PlanTier>('starter');
  const [assignUserId, setAssignUserId] = useState('');
  const [saving, setSaving] = useState(false);

  const examStats = useMemo(() => {
    return EXAM_CATALOG.map((exam) => {
      const subs = users.flatMap((u) => u.examSubscriptions.filter((s) => s.examId === exam.id));
      const byPlan: Record<PlanTier, number> = { free: 0, starter: 0, pro: 0, enterprise: 0 };
      subs.forEach((s) => { byPlan[s.plan]++; });
      return { exam, total: subs.length, byPlan, active: subs.filter((s) => s.status === 'active').length };
    });
  }, [users]);

  const handleAssign = async () => {
    if (!assignExamId || !assignUserId) return;
    setSaving(true);
    subscribeToExam(assignUserId, assignExamId, assignPlan);
    setSaving(false);
    setShowAssign(false);
    onRefresh();
  };

  const selCls = 'w-full px-3 py-2 rounded-xl bg-surface-700/60 border border-white/10 text-white text-sm focus:outline-none focus:border-primary-400';

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-surface-400 text-sm">Exam enrollment overview across all users</p>
        <button
          onClick={() => setShowAssign(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium"
        >
          <Plus size={14} /> Assign Exam
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {examStats.map(({ exam, total, byPlan, active }) => (
          <div key={exam.id} className="bg-surface-800/60 rounded-xl border border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{exam.emoji}</span>
                <div>
                  <p className="font-medium text-white">{exam.name}</p>
                  <p className="text-xs text-surface-400">{exam.fullName}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-white">{total}</p>
                <p className="text-xs text-surface-400">{active} active</p>
              </div>
            </div>
            <div className="flex gap-2">
              {(['free', 'starter', 'pro', 'enterprise'] as PlanTier[]).map((p) => (
                <div key={p} className={clsx('flex-1 text-center px-2 py-1.5 rounded-lg text-xs', planMeta[p].color)}>
                  <div className="font-bold">{byPlan[p]}</div>
                  <div className="opacity-70 capitalize">{p}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showAssign && (
          <motion.div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && setShowAssign(false)}>
            <motion.div className="bg-surface-800 border border-white/10 rounded-2xl w-full max-w-sm"
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}>
              <div className="flex items-center justify-between p-5 border-b border-white/8">
                <p className="font-semibold text-white">Assign Exam Subscription</p>
                <button onClick={() => setShowAssign(false)} className="text-surface-400 hover:text-white"><X size={16} /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs text-surface-400 mb-1">User</label>
                  <select className={selCls} value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
                    <option value="">— Select user —</option>
                    {users.map((u) => <option key={u.uid} value={u.uid}>{u.name} ({u.uid})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-surface-400 mb-1">Exam</label>
                  <select className={selCls} value={assignExamId} onChange={(e) => setAssignExamId(e.target.value)}>
                    <option value="">— Select exam —</option>
                    {EXAM_CATALOG.map((e) => <option key={e.id} value={e.id}>{e.emoji} {e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-surface-400 mb-1">Plan</label>
                  <select className={selCls} value={assignPlan} onChange={(e) => setAssignPlan(e.target.value as PlanTier)}>
                    {(['free', 'starter', 'pro', 'enterprise'] as PlanTier[]).map((p) => (
                      <option key={p} value={p}>{planMeta[p].label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="p-5 pt-0 flex gap-3">
                <button onClick={() => setShowAssign(false)} className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-surface-400 text-sm">Cancel</button>
                <button onClick={handleAssign} disabled={saving || !assignExamId || !assignUserId}
                  className="flex-1 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium disabled:opacity-60">
                  {saving ? 'Assigning…' : 'Assign'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tab 3: Channel Linking ───────────────────────────────────────────────────

function ChannelLinkingTab({ users }: { users: EGUser[] }) {
  const [widgetDomain, setWidgetDomain] = useState('https://yoursite.com');

  const waUsers = users.filter((u) => u.channelAccess.whatsapp);
  const tgUsers = users.filter((u) => u.channelAccess.telegram);
  const widgetUsers = users.filter((u) => u.channelAccess.widget);

  const embedCode = `<!-- EduGenius Widget -->
<script>
  window.EduGeniusConfig = {
    widgetToken: 'YOUR_WIDGET_TOKEN',
    primaryColor: '#6366f1',
    position: 'bottom-right',
  };
</script>
<script src="https://edugenius-ui.netlify.app/widget.js" defer></script>`;

  return (
    <div className="space-y-6">
      {/* WhatsApp */}
      <div className="bg-surface-800/60 rounded-xl border border-white/10 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Phone size={16} className="text-green-400" />
          <h3 className="font-semibold text-white">WhatsApp</h3>
          <Chip className="bg-green-500/20 text-green-300">{waUsers.length} linked</Chip>
        </div>
        <p className="text-surface-400 text-xs mb-4">Users who have linked their WhatsApp number.</p>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {waUsers.map((u) => (
            <div key={u.uid} className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-700/40">
              <div className="flex items-center gap-2">
                <Avatar name={u.name} size="sm" />
                <span className="text-sm text-white">{u.name}</span>
              </div>
              <span className="text-xs text-surface-400 font-mono">{u.channelAccess.whatsappPhone}</span>
            </div>
          ))}
          {waUsers.length === 0 && <p className="text-surface-500 text-sm">No linked users yet</p>}
        </div>
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-xs text-green-300">
          <p className="font-medium mb-1">How to link WhatsApp:</p>
          <p>1. User sends any message to your WhatsApp Business number</p>
          <p>2. Bot responds with a link code (EG-XXXXXXXX)</p>
          <p>3. User enters code at /login or in the app to link accounts</p>
        </div>
      </div>

      {/* Telegram */}
      <div className="bg-surface-800/60 rounded-xl border border-white/10 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Send size={16} className="text-blue-300" />
          <h3 className="font-semibold text-white">Telegram</h3>
          <Chip className="bg-blue-500/20 text-blue-300">{tgUsers.length} linked</Chip>
        </div>
        <p className="text-surface-400 text-xs mb-1">Bot: <span className="text-white font-mono">@EduGeniusBot</span></p>
        <p className="text-surface-400 text-xs mb-4">Users who have linked their Telegram account.</p>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {tgUsers.map((u) => (
            <div key={u.uid} className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-700/40">
              <div className="flex items-center gap-2">
                <Avatar name={u.name} size="sm" />
                <div>
                  <span className="text-sm text-white">{u.name}</span>
                  {u.channelAccess.telegramUsername && (
                    <span className="text-xs text-surface-400 ml-1">@{u.channelAccess.telegramUsername}</span>
                  )}
                </div>
              </div>
              <span className="text-xs text-surface-400 font-mono">{u.channelAccess.telegramChatId}</span>
            </div>
          ))}
          {tgUsers.length === 0 && <p className="text-surface-500 text-sm">No linked users yet</p>}
        </div>
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300">
          <p className="font-medium mb-1">How to link Telegram:</p>
          <p>1. User sends /start to @EduGeniusBot</p>
          <p>2. Bot responds with a link token</p>
          <p>3. User enters token at /login to link accounts</p>
        </div>
      </div>

      {/* Widget */}
      <div className="bg-surface-800/60 rounded-xl border border-white/10 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Code2 size={16} className="text-violet-400" />
          <h3 className="font-semibold text-white">Embed Widget</h3>
          <Chip className="bg-violet-500/20 text-violet-300">{widgetUsers.length} linked</Chip>
        </div>
        <div className="mb-4">
          <label className="block text-xs text-surface-400 mb-1">Target domain</label>
          <input
            type="text"
            value={widgetDomain}
            onChange={(e) => setWidgetDomain(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-surface-700/60 border border-white/10 text-white text-sm focus:outline-none focus:border-primary-400"
          />
        </div>
        <div className="relative">
          <pre className="bg-surface-900 rounded-xl p-4 text-xs text-green-300 font-mono overflow-x-auto whitespace-pre-wrap">{embedCode}</pre>
          <button
            onClick={() => navigator.clipboard.writeText(embedCode)}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-surface-700/60 text-surface-400 hover:text-white"
          >
            <Copy size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 4: MCP Privileges ────────────────────────────────────────────────────

function MCPPrivilegesTab({ users, onRefresh }: { users: EGUser[]; onRefresh: () => void }) {
  const planOrder: PlanTier[] = ['free', 'starter', 'pro', 'enterprise'];

  return (
    <div>
      <div className="mb-4 p-4 bg-surface-800/60 rounded-xl border border-white/8 text-xs text-surface-400">
        <p className="font-medium text-surface-300 mb-1 flex items-center gap-1.5"><Zap size={12} className="text-amber-400" /> MCP Source Access by Plan</p>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {planOrder.map((p) => (
            <div key={p} className={clsx('p-2 rounded-lg', planMeta[p].color)}>
              <p className="font-semibold capitalize">{p}</p>
              <p className="opacity-70 mt-1">
                {p === 'free' ? 'Static PYQ + LLM' :
                 p === 'starter' ? '+ RAG search' :
                 p === 'pro' ? '+ Wolfram + APIs' :
                 'All sources'}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface-800/60 rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                {['User', 'Plan', 'Wolfram', 'RAG', 'Custom MCP', 'Ext APIs', 'Max Sources'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-surface-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const priv = u.mcpPrivileges;
                const plan = getHighestPlan(u);
                return (
                  <tr key={u.uid} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={u.name} size="sm" />
                        <div>
                          <p className="text-white text-sm">{u.name}</p>
                          <p className="text-surface-500 text-xs font-mono">{u.uid}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Chip className={planMeta[plan].color}>{planMeta[plan].label}</Chip></td>
                    <td className="px-4 py-3">
                      <span className={priv.wolframEnabled ? 'text-green-400' : 'text-surface-600'}>
                        {priv.wolframEnabled ? <CheckCircle size={14} /> : <X size={14} />}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={priv.ragEnabled ? 'text-green-400' : 'text-surface-600'}>
                        {priv.ragEnabled ? <CheckCircle size={14} /> : <X size={14} />}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={priv.customMcpEnabled ? 'text-green-400' : 'text-surface-600'}>
                        {priv.customMcpEnabled ? <CheckCircle size={14} /> : <X size={14} />}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={priv.externalApiEnabled ? 'text-green-400' : 'text-surface-600'}>
                        {priv.externalApiEnabled ? <CheckCircle size={14} /> : <X size={14} />}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white">
                      {priv.maxKnowledgeSources === 99 ? '∞' : priv.maxKnowledgeSources}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserManagementPortal() {
  const [activeTab, setActiveTab] = useState(0);
  const [users, setUsers] = useState<EGUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<EGUser | null>(null);

  const refresh = () => {
    setUsers(loadAllUsers());
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleUserUpdate = (updated: EGUser) => {
    const all = loadAllUsers();
    const idx = all.findIndex((u) => u.uid === updated.uid);
    if (idx >= 0) {
      all[idx] = updated;
      saveAllUsers(all);
      setUsers([...all]);
      setSelectedUser(updated);
    }
  };

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.status === 'active').length,
    students: users.filter((u) => u.role === 'student').length,
    pro: users.filter((u) => getHighestPlan(u) === 'pro' || getHighestPlan(u) === 'enterprise').length,
  }), [users]);

  const tabs = ['Users', 'Exam Subscriptions', 'Channel Linking', 'MCP Privileges'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users size={24} className="text-primary-400" />
            User Management Portal
          </h1>
          <p className="text-surface-400 text-sm mt-1">Manage users, subscriptions, channels, and MCP access</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-surface-800/40 text-surface-300 text-xs hover:border-white/20 hover:text-white transition-colors">
            <Download size={14} /> Export
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-surface-800/40 text-surface-300 text-xs hover:border-white/20 hover:text-white transition-colors">
            <Upload size={14} /> Import CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: stats.total, icon: <Users size={16} />, color: 'text-blue-400' },
          { label: 'Active', value: stats.active, icon: <Activity size={16} />, color: 'text-green-400' },
          { label: 'Students', value: stats.students, icon: <GraduationCap size={16} />, color: 'text-violet-400' },
          { label: 'Pro+ Users', value: stats.pro, icon: <Zap size={16} />, color: 'text-amber-400' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-surface-800/60 rounded-xl border border-white/10 p-4">
            <div className={clsx('flex items-center gap-2 mb-2', color)}>{icon}<span className="text-xs font-medium">{label}</span></div>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t, i) => (
          <Tab key={t} active={activeTab === i} onClick={() => setActiveTab(i)}>{t}</Tab>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 0 && <UsersTab users={users} onSelect={setSelectedUser} onRefresh={refresh} />}
          {activeTab === 1 && <ExamSubscriptionsTab users={users} onRefresh={refresh} />}
          {activeTab === 2 && <ChannelLinkingTab users={users} />}
          {activeTab === 3 && <MCPPrivilegesTab users={users} onRefresh={refresh} />}
        </motion.div>
      </AnimatePresence>

      {/* User Detail Panel */}
      <AnimatePresence>
        {selectedUser && (
          <UserDetailPanel
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
            onUpdate={handleUserUpdate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
