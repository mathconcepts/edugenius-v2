/**
 * UserAdmin — Full Admin User Management
 * Features: search, filter by role/plan/status, CRUD, bulk ops, detail panel
 */
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Download, Plus, X, Check, Edit2, Shield,
  CreditCard, Activity, Mail, Calendar, BookOpen, GraduationCap,
  Crown, Ban, Bell, RefreshCw, Eye, ChevronRight, Filter,
  LayoutList, Network, Layers, ChevronDown, Target, BarChart2,
} from 'lucide-react';
import { clsx } from 'clsx';

// ── Types ────────────────────────────────────────────────────────────────────

type Role = 'student' | 'parent' | 'teacher' | 'manager' | 'admin' | 'owner';
type Plan = 'free' | 'starter' | 'pro' | 'enterprise';
type Status = 'active' | 'inactive' | 'suspended' | 'pending';

interface User {
  id: string; name: string; email: string; avatar: string;
  role: Role; plan: Plan; status: Status;
  joinedAt: string; lastActive: string; exam?: string;
  sessionsTotal: number; sessionsMonth: number; revenueTotal: number;
  verified: boolean; tags: string[];
}

// ── Mock data ────────────────────────────────────────────────────────────────

function mk(id: string, name: string, email: string, role: Role, plan: Plan,
  status: Status, joined: string, last: string, exam?: string,
  st = 0, sm = 0, rev = 0, v = true, tags: string[] = []): User {
  return { id, name, email, avatar: name.split(' ').map(n => n[0]).join('').toUpperCase(),
    role, plan, status, joinedAt: joined, lastActive: last, exam,
    sessionsTotal: st, sessionsMonth: sm, revenueTotal: rev, verified: v, tags };
}

const USERS: User[] = [
  mk('u1','Arjun Sharma','arjun@gmail.com','student','pro','active','2025-09-01','2h ago','JEE',142,18,2999,true,['jee-2026','top-performer']),
  mk('u2','Priya Nair','priya@gmail.com','student','starter','active','2025-10-15','5h ago','NEET',98,12,999),
  mk('u3','Rohan Mehta','rohan@gmail.com','student','free','inactive','2025-11-01','3d ago','JEE',23),
  mk('u4','Sunita Verma','sunita@gmail.com','parent','starter','active','2025-08-20','1d ago',undefined,0,0,999,true,['parent-jee']),
  mk('u5','Dr. Anil Kumar','anil@school.edu','teacher','pro','active','2025-07-01','30m ago',undefined,0,5,2999,true,['cbse-teacher']),
  mk('u6','Meera Iyer','meera@gmail.com','student','pro','active','2025-06-15','1h ago','UPSC',210,22,2999,true,['upsc-2026']),
  mk('u7','Vikram Patel','vikram@gmail.com','student','enterprise','active','2025-05-01','3h ago','CAT',320,30,9999,true,['premium']),
  mk('u8','Kavitha Rao','kavitha@school.edu','teacher','starter','active','2025-09-10','2d ago',undefined,0,3,999),
  mk('u9','Raju Gupta','raju@gmail.com','student','free','suspended','2025-12-01','8d ago','GATE',5,0,0,false,['spam']),
  mk('u10','Nisha Singh','nisha@gmail.com','student','pro','pending','2026-01-15','1d ago','JEE',2,1,2999,false),
  mk('u11','Amit Joshi','amit@gmail.com','admin','enterprise','active','2025-01-01','10m ago',undefined,0,0,0,true,['internal']),
  mk('u12','Pooja Reddy','pooja@gmail.com','student','starter','active','2025-11-20','6h ago','NEET',67,8,999),
  mk('u13','Kiran Bhat','kiran@gmail.com','student','pro','active','2025-10-01','4h ago','CAT',145,20,2999),
  mk('u14','Divya Kumar','divya@gmail.com','parent','free','inactive','2026-01-01','12d ago'),
  mk('u15','Santosh MS','santosh@startup.in','teacher','pro','active','2025-08-01','1h ago',undefined,0,8,2999,true,['top-teacher']),
];

// ── Metadata ─────────────────────────────────────────────────────────────────

const roleMeta: Record<Role, { label: string; icon: React.ReactNode; color: string }> = {
  student:  { label: 'Student',    icon: <GraduationCap size={11}/>, color: 'text-blue-400 bg-blue-500/20' },
  parent:   { label: 'Parent',     icon: <Users size={11}/>,         color: 'text-purple-400 bg-purple-500/20' },
  teacher:  { label: 'Teacher',    icon: <BookOpen size={11}/>,      color: 'text-green-400 bg-green-500/20' },
  manager:  { label: 'Manager',    icon: <Shield size={11}/>,        color: 'text-teal-400 bg-teal-500/20' },
  admin:    { label: 'Admin',      icon: <Shield size={11}/>,        color: 'text-amber-400 bg-amber-500/20' },
  owner:    { label: 'Owner',      icon: <Crown size={11}/>,         color: 'text-red-400 bg-red-500/20' },
};

const planMeta: Record<Plan, { label: string; color: string; price: string }> = {
  free:       { label: 'Free',       color: 'text-surface-400 bg-surface-700', price: '₹0' },
  starter:    { label: 'Starter',    color: 'text-blue-400 bg-blue-500/20',    price: '₹999' },
  pro:        { label: 'Pro',        color: 'text-violet-400 bg-violet-500/20',price: '₹2,999' },
  enterprise: { label: 'Enterprise', color: 'text-amber-400 bg-amber-500/20',  price: '₹9,999' },
};

const statusMeta: Record<Status, { label: string; dot: string; text: string }> = {
  active:    { label: 'Active',    dot: 'bg-green-500',   text: 'text-green-400' },
  inactive:  { label: 'Inactive',  dot: 'bg-surface-500', text: 'text-surface-400' },
  suspended: { label: 'Suspended', dot: 'bg-red-500',     text: 'text-red-400' },
  pending:   { label: 'Pending',   dot: 'bg-amber-500',   text: 'text-amber-400' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', className)}>
      {children}
    </span>
  );
}

function Av({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
  const sz = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' }[size];
  return (
    <div className={clsx('rounded-full bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center font-bold text-white shrink-0', sz)}>
      {initials}
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [form, setForm] = useState({ role: user.role, plan: user.plan, status: user.status });
  const [saved, setSaved] = useState(false);

  return (
    <motion.div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div className="bg-surface-800 border border-surface-700 rounded-2xl w-full max-w-md"
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>

        <div className="flex items-center justify-between p-6 border-b border-surface-700">
          <div className="flex items-center gap-3">
            <Av name={user.name} />
            <div>
              <p className="font-semibold text-white">{user.name}</p>
              <p className="text-sm text-surface-400">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-700 rounded-lg"><X size={18} className="text-surface-400"/></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Role */}
          <div>
            <label className="text-xs text-surface-400 uppercase tracking-wide mb-2 block">Role</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(roleMeta) as Role[]).map(r => (
                <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                  className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors',
                    form.role === r ? 'border-primary-500 bg-primary-500/20 text-primary-300' : 'border-surface-600 text-surface-400 hover:border-surface-500')}>
                  {roleMeta[r].icon} {roleMeta[r].label}
                </button>
              ))}
            </div>
          </div>

          {/* Plan */}
          <div>
            <label className="text-xs text-surface-400 uppercase tracking-wide mb-2 block">Plan</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(planMeta) as Plan[]).map(p => (
                <button key={p} onClick={() => setForm(f => ({ ...f, plan: p }))}
                  className={clsx('flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors',
                    form.plan === p ? 'border-primary-500 bg-primary-500/20 text-primary-300' : 'border-surface-600 text-surface-400 hover:border-surface-500')}>
                  <span>{planMeta[p].label}</span>
                  <span className="text-xs text-surface-500">{planMeta[p].price}/mo</span>
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs text-surface-400 uppercase tracking-wide mb-2 block">Status</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(statusMeta) as Status[]).map(s => (
                <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={clsx('flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
                    form.status === s ? 'border-primary-500 bg-primary-500/20 text-primary-300' : 'border-surface-600 text-surface-400 hover:border-surface-500')}>
                  <span className={clsx('w-2 h-2 rounded-full', statusMeta[s].dot)} />
                  {statusMeta[s].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 btn-secondary py-2.5">Cancel</button>
          <button onClick={() => { setSaved(true); setTimeout(onClose, 800); }}
            className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2">
            {saved ? <><Check size={16}/> Saved!</> : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Add User Modal ────────────────────────────────────────────────────────────

function AddModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'student' as Role, plan: 'free' as Plan });
  const [sent, setSent] = useState(false);

  return (
    <motion.div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div className="bg-surface-800 border border-surface-700 rounded-2xl w-full max-w-md"
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>

        <div className="flex items-center justify-between p-6 border-b border-surface-700">
          <h3 className="font-semibold text-white">Invite New User</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-700 rounded-lg"><X size={18} className="text-surface-400"/></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">Full Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5 text-sm text-white focus:border-primary-500 focus:outline-none"
              placeholder="Arjun Sharma" />
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">Email Address</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5 text-sm text-white focus:border-primary-500 focus:outline-none"
              type="email" placeholder="arjun@gmail.com" />
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-2 block">Role</label>
            <div className="flex flex-wrap gap-2">
              {(['student', 'teacher', 'admin'] as Role[]).map(r => (
                <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                  className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors',
                    form.role === r ? 'border-primary-500 bg-primary-500/20 text-primary-300' : 'border-surface-600 text-surface-400')}>
                  {roleMeta[r].icon} {roleMeta[r].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-2 block">Plan</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(planMeta) as Plan[]).map(p => (
                <button key={p} onClick={() => setForm(f => ({ ...f, plan: p }))}
                  className={clsx('flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors',
                    form.plan === p ? 'border-primary-500 bg-primary-500/20 text-primary-300' : 'border-surface-600 text-surface-400')}>
                  <span>{planMeta[p].label}</span>
                  <span className="text-xs text-surface-500">{planMeta[p].price}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 btn-secondary py-2.5">Cancel</button>
          <button onClick={() => { setSent(true); setTimeout(onClose, 900); }}
            className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2">
            {sent ? <><Check size={16}/> Invited!</> : <><Mail size={16}/> Send Invite</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({ user, onClose, onEdit }: { user: User; onClose: () => void; onEdit: () => void }) {
  const [tab, setTab] = useState<'info' | 'activity' | 'subscription'>('info');

  return (
    <motion.div className="w-88 bg-surface-800 border-l border-surface-700 flex flex-col h-full overflow-hidden"
      initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }} transition={{ duration: 0.18 }}>

      {/* Header */}
      <div className="p-5 border-b border-surface-700">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Av name={user.name} size="lg" />
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-white">{user.name}</p>
                {user.verified && <Check size={13} className="text-green-400"/>}
              </div>
              <p className="text-sm text-surface-400">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-700 rounded-lg"><X size={15} className="text-surface-400"/></button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className={roleMeta[user.role].color}>{roleMeta[user.role].icon}{roleMeta[user.role].label}</Badge>
          <Badge className={planMeta[user.plan].color}><CreditCard size={10}/>{planMeta[user.plan].label}</Badge>
          <span className={clsx('flex items-center gap-1 text-xs', statusMeta[user.status].text)}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', statusMeta[user.status].dot)}/>
            {statusMeta[user.status].label}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-700 px-4">
        {(['info', 'activity', 'subscription'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('py-2.5 px-2 text-sm border-b-2 transition-colors capitalize',
              tab === t ? 'border-primary-500 text-primary-400' : 'border-transparent text-surface-400 hover:text-surface-300')}>
            {t}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {tab === 'info' && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Sessions', value: user.sessionsTotal },
                { label: 'This Month', value: user.sessionsMonth },
                { label: 'Revenue', value: `₹${user.revenueTotal.toLocaleString()}` },
                { label: 'Last Active', value: user.lastActive },
              ].map(s => (
                <div key={s.label} className="bg-surface-900 rounded-xl p-3">
                  <p className="text-xs text-surface-400 mb-1">{s.label}</p>
                  <p className="text-lg font-bold text-white">{s.value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2.5 text-sm">
              {user.exam && (
                <div className="flex items-center gap-2.5">
                  <BookOpen size={14} className="text-surface-500"/><span className="text-surface-400">Exam:</span>
                  <span className="text-white font-medium">{user.exam}</span>
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <Calendar size={14} className="text-surface-500"/><span className="text-surface-400">Joined:</span>
                <span className="text-white">{user.joinedAt}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail size={14} className="text-surface-500"/><span className="text-white">{user.email}</span>
              </div>
            </div>
            {user.tags.length > 0 && (
              <div>
                <p className="text-xs text-surface-500 mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {user.tags.map(t => (
                    <span key={t} className="text-xs bg-surface-700 text-surface-300 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'activity' && (
          <div className="space-y-3">
            {[
              { icon: <Activity size={13} className="text-blue-400"/>, desc: `Logged in from mobile`, at: user.lastActive },
              { icon: <BookOpen size={13} className="text-green-400"/>, desc: `Completed study session`, at: '2d ago' },
              { icon: <CreditCard size={13} className="text-violet-400"/>, desc: `${planMeta[user.plan].label} plan active`, at: user.joinedAt },
            ].map((a, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <div className="w-7 h-7 rounded-full bg-surface-700 flex items-center justify-center shrink-0">{a.icon}</div>
                <div><p className="text-surface-200">{a.desc}</p><p className="text-xs text-surface-500">{a.at}</p></div>
              </div>
            ))}
          </div>
        )}

        {tab === 'subscription' && (
          <div className="space-y-3">
            <div className="bg-surface-900 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">{planMeta[user.plan].label} Plan</span>
                <Badge className={planMeta[user.plan].color}>{planMeta[user.plan].price}/mo</Badge>
              </div>
              <div className="flex justify-between"><span className="text-surface-400">Revenue</span><span className="text-white">₹{user.revenueTotal.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-surface-400">Since</span><span className="text-white">{user.joinedAt}</span></div>
            </div>
            {[
              { icon: <RefreshCw size={14} className="text-blue-400"/>, label: 'Force Refresh' },
              { icon: <Bell size={14} className="text-amber-400"/>, label: 'Send Renewal Reminder' },
              { icon: <Ban size={14} className="text-red-400"/>, label: 'Suspend Account' },
            ].map(a => (
              <button key={a.label} className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-900 hover:bg-surface-700 transition-colors text-sm text-surface-300">
                {a.icon} {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-surface-700 flex gap-2">
        <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-1.5 btn-secondary py-2 text-sm">
          <Edit2 size={13}/> Edit
        </button>
        <button className="px-3 py-2 rounded-lg bg-surface-700 hover:bg-red-500/20 hover:text-red-400 transition-colors text-surface-400">
          <Ban size={14}/>
        </button>
      </div>
    </motion.div>
  );
}

// ── Exam Group View ───────────────────────────────────────────────────────────

interface ExamGroup {
  exam: string;
  emoji: string;
  students: User[];
  grades: GradeGroup[];
}

interface GradeGroup {
  grade: string;
  subjects: SubjectGroup[];
  students: User[];
}

interface SubjectGroup {
  subject: string;
  students: User[];
}

const EXAM_SUBJECTS: Record<string, string[]> = {
  'JEE':    ['Physics', 'Chemistry', 'Mathematics'],
  'NEET':   ['Physics', 'Chemistry', 'Biology'],
  'CBSE':   ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English', 'Social Science'],
  'CAT':    ['Quant', 'VARC', 'DILR'],
  'UPSC':   ['General Studies', 'CSAT', 'Optional'],
  'GATE':   ['Engineering Mathematics', 'Core Subject', 'General Aptitude'],
  'CET':    ['Physics', 'Chemistry', 'Mathematics'],
  'SAT':    ['Math', 'Reading & Writing'],
};

const EXAM_GRADES: Record<string, string[]> = {
  'JEE':    ['Class 11', 'Class 12', 'Dropper'],
  'NEET':   ['Class 11', 'Class 12', 'Dropper'],
  'CBSE':   ['Class 10', 'Class 12'],
  'CAT':    ['Batch A (Morning)', 'Batch B (Evening)'],
  'UPSC':   ['Prelims', 'Mains', 'Interview'],
  'GATE':   ['CS/IT', 'EC', 'ME', 'EE', 'CE'],
  'CET':    ['Class 12'],
  'SAT':    ['Grade 11', 'Grade 12'],
};

const EXAM_EMOJIS: Record<string, string> = {
  'JEE': '⚗️', 'NEET': '🧬', 'CBSE': '📚', 'CAT': '💼',
  'UPSC': '🏛️', 'GATE': '⚙️', 'CET': '🎯', 'SAT': '🌎',
};

function buildExamGroups(users: User[]): ExamGroup[] {
  const studentsByExam: Record<string, User[]> = {};
  users.forEach(u => {
    if (u.role === 'student' && u.exam) {
      const key = u.exam;
      if (!studentsByExam[key]) studentsByExam[key] = [];
      studentsByExam[key].push(u);
    }
  });

  return Object.entries(studentsByExam).map(([exam, students]) => {
    const grades = EXAM_GRADES[exam] || ['General'];
    const subjects = EXAM_SUBJECTS[exam] || ['General'];

    const gradeGroups: GradeGroup[] = grades.map(grade => ({
      grade,
      students: students.filter((_, i) => i % grades.length === grades.indexOf(grade)),
      subjects: subjects.map(subject => ({
        subject,
        students: students.filter((_, i) => i % subjects.length === subjects.indexOf(subject)),
      })),
    }));

    return { exam, emoji: EXAM_EMOJIS[exam] || '📖', students, grades: gradeGroups };
  });
}

function SubjectRow({ subject, students, onSelect }: {
  subject: SubjectGroup;
  students: User[];
  onSelect: (u: User) => void;
}) {
  const [open, setOpen] = useState(false);
  const pct = Math.round((students.filter(u => u.status === 'active').length / Math.max(students.length, 1)) * 100);

  return (
    <div className="ml-8">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-surface-700/30 transition-colors text-left"
      >
        <ChevronRight size={13} className={clsx('text-surface-500 transition-transform shrink-0', open && 'rotate-90')} />
        <BookOpen size={13} className="text-violet-400 shrink-0" />
        <span className="text-sm text-surface-300 flex-1">{subject.subject}</span>
        <span className="text-xs text-surface-500">{students.length} students</span>
        <div className="w-16 h-1.5 bg-surface-700 rounded-full overflow-hidden ml-2">
          <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-green-400 w-8 text-right">{pct}%</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="ml-6 py-1 space-y-0.5">
              {students.length === 0 ? (
                <p className="text-xs text-surface-500 px-4 py-2">No students in this subject</p>
              ) : students.map(u => (
                <button
                  key={u.id}
                  onClick={() => onSelect(u)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-700/40 transition-colors text-left"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    {u.avatar[0]}
                  </div>
                  <span className="text-sm text-surface-200 flex-1 truncate">{u.name}</span>
                  <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full', statusMeta[u.status].dot === 'bg-green-500' ? 'bg-green-500/20 text-green-400' : 'bg-surface-700 text-surface-400')}>
                    {u.status}
                  </span>
                  <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full', planMeta[u.plan].color)}>
                    {planMeta[u.plan].label}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GradeRow({ gradeGroup, onSelect }: { gradeGroup: GradeGroup; onSelect: (u: User) => void }) {
  const [open, setOpen] = useState(false);
  const activeCount = gradeGroup.students.filter(u => u.status === 'active').length;

  return (
    <div className="ml-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 p-2.5 rounded-xl hover:bg-surface-700/40 transition-colors text-left"
      >
        <ChevronRight size={14} className={clsx('text-surface-400 transition-transform shrink-0', open && 'rotate-90')} />
        <Layers size={14} className="text-blue-400 shrink-0" />
        <span className="text-sm font-medium text-surface-200 flex-1">{gradeGroup.grade}</span>
        <div className="flex items-center gap-3 text-xs text-surface-400">
          <span>{gradeGroup.students.length} students</span>
          <span className="text-green-400">{activeCount} active</span>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="space-y-0.5 py-1">
              {gradeGroup.subjects.map(sg => (
                <SubjectRow key={sg.subject} subject={sg} students={sg.students} onSelect={onSelect} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExamGroupView({ users, onSelectUser }: { users: User[]; onSelectUser: (u: User) => void }) {
  const [openExams, setOpenExams] = useState<Set<string>>(new Set(['JEE', 'NEET']));
  const [drillLevel, setDrillLevel] = useState<'exam' | 'grade' | 'subject'>('grade');
  const groups = useMemo(() => buildExamGroups(users), [users]);

  const toggleExam = (exam: string) => {
    setOpenExams(prev => {
      const n = new Set(prev);
      n.has(exam) ? n.delete(exam) : n.add(exam);
      return n;
    });
  };

  const noStudents = groups.length === 0;

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {/* Drill-level selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-surface-500">Show drill-down to:</span>
        <div className="flex gap-1 p-1 bg-surface-800 rounded-lg">
          {(['exam', 'grade', 'subject'] as const).map(l => (
            <button
              key={l}
              onClick={() => setDrillLevel(l)}
              className={clsx('px-3 py-1 rounded-md text-xs font-medium transition-all capitalize',
                drillLevel === l ? 'bg-primary-500 text-white' : 'text-surface-400 hover:text-white')}
            >
              {l}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-surface-500">
          {users.filter(u => u.role === 'student' && u.exam).length} enrolled students
        </span>
      </div>

      {noStudents ? (
        <div className="flex flex-col items-center justify-center h-48 text-surface-400">
          <Users size={32} className="mb-3 opacity-40" />
          <p className="text-sm">No students match the current filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => {
            const isOpen = openExams.has(group.exam);
            const proCount = group.students.filter(u => u.plan === 'pro' || u.plan === 'enterprise').length;
            const activeCount = group.students.filter(u => u.status === 'active').length;
            const revenue = group.students.reduce((s, u) => s + u.revenueTotal, 0);

            return (
              <div key={group.exam} className="bg-surface-800/50 border border-surface-700/50 rounded-2xl overflow-hidden">
                {/* Exam header */}
                <button
                  onClick={() => toggleExam(group.exam)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-surface-700/30 transition-colors text-left"
                >
                  <span className="text-2xl">{group.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{group.exam}</span>
                      <span className="text-xs bg-primary-500/20 text-primary-300 px-2 py-0.5 rounded-full">
                        {group.students.length} students
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-surface-400">
                      <span className="flex items-center gap-1"><Target size={10} className="text-green-400" />{activeCount} active</span>
                      <span className="flex items-center gap-1"><CreditCard size={10} className="text-violet-400" />{proCount} paid</span>
                      <span className="flex items-center gap-1"><BarChart2 size={10} className="text-amber-400" />₹{(revenue / 1000).toFixed(0)}K revenue</span>
                    </div>
                  </div>

                  {/* Mini progress bar */}
                  <div className="hidden md:flex flex-col items-end gap-1">
                    <span className="text-xs text-surface-500">Active rate</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${Math.round((activeCount / Math.max(group.students.length, 1)) * 100)}%` }} />
                      </div>
                      <span className="text-xs text-green-400">
                        {Math.round((activeCount / Math.max(group.students.length, 1)) * 100)}%
                      </span>
                    </div>
                  </div>

                  <ChevronDown size={16} className={clsx('text-surface-400 transition-transform ml-2 shrink-0', isOpen && 'rotate-180')} />
                </button>

                {/* Grade / Subject drill-down */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden border-t border-surface-700/50"
                    >
                      <div className="p-3 space-y-1">
                        {drillLevel === 'exam' ? (
                          // Just show flat student list at exam level
                          <div className="space-y-0.5">
                            {group.students.map(u => (
                              <button key={u.id} onClick={() => onSelectUser(u)}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-700/40 transition-colors text-left">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                  {u.avatar}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white truncate">{u.name}</p>
                                  <p className="text-xs text-surface-400 truncate">{u.email}</p>
                                </div>
                                <span className={clsx('text-xs px-2 py-0.5 rounded-full', planMeta[u.plan].color)}>{planMeta[u.plan].label}</span>
                                <span className={clsx('flex items-center gap-1 text-xs', statusMeta[u.status].text)}>
                                  <span className={clsx('w-1.5 h-1.5 rounded-full', statusMeta[u.status].dot)} />{u.status}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          // Grade → subject drill-down
                          group.grades.map(g => (
                            drillLevel === 'grade' ? (
                              <div key={g.grade} className="py-1">
                                <GradeRow key={g.grade} gradeGroup={g} onSelect={onSelectUser} />
                              </div>
                            ) : (
                              <div key={g.grade} className="py-1">
                                <GradeRow key={g.grade} gradeGroup={g} onSelect={onSelectUser} />
                              </div>
                            )
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Students with no exam assigned */}
          {(() => {
            const noExam = users.filter(u => u.role === 'student' && !u.exam);
            if (noExam.length === 0) return null;
            return (
              <div className="bg-surface-800/30 border border-surface-700/30 rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggleExam('__noexam__')}
                  className="w-full flex items-center gap-3 p-4 hover:bg-surface-700/20 transition-colors"
                >
                  <span className="text-2xl">🎓</span>
                  <div className="flex-1 text-left">
                    <span className="font-medium text-surface-300">No Exam Assigned</span>
                    <span className="ml-2 text-xs bg-surface-700 text-surface-400 px-2 py-0.5 rounded-full">{noExam.length}</span>
                  </div>
                  <ChevronDown size={16} className={clsx('text-surface-500 transition-transform', openExams.has('__noexam__') && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {openExams.has('__noexam__') && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-surface-700/30">
                      <div className="p-3 space-y-0.5">
                        {noExam.map(u => (
                          <button key={u.id} onClick={() => onSelectUser(u)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-700/40 transition-colors text-left">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-surface-500 to-surface-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                              {u.avatar}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{u.name}</p>
                              <p className="text-xs text-surface-400 truncate">{u.email} · {u.role}</p>
                            </div>
                            <span className={clsx('text-xs px-2 py-0.5 rounded-full', planMeta[u.plan].color)}>{planMeta[u.plan].label}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function UserAdmin() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [planFilter, setPlanFilter] = useState<Plan | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [selected, setSelected] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'exam'>('table');

  const filtered = useMemo(() => USERS.filter(u => {
    const q = search.toLowerCase();
    if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (planFilter !== 'all' && u.plan !== planFilter) return false;
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    return true;
  }), [search, roleFilter, planFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: USERS.length,
    active: USERS.filter(u => u.status === 'active').length,
    revenue: USERS.reduce((s, u) => s + u.revenueTotal, 0),
    pro: USERS.filter(u => u.plan === 'pro' || u.plan === 'enterprise').length,
  }), []);

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const allChecked = filtered.length > 0 && filtered.every(u => checkedIds.has(u.id));
  const toggleAll = () => {
    if (allChecked) setCheckedIds(new Set());
    else setCheckedIds(new Set(filtered.map(u => u.id)));
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-surface-700 shrink-0">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-bold text-white">User Management</h1>
              <p className="text-surface-400 text-sm mt-0.5">Manage accounts, roles, and subscriptions</p>
            </div>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex gap-1 p-1 bg-surface-800 border border-surface-700 rounded-lg">
                <button
                  onClick={() => setViewMode('table')}
                  className={clsx('flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
                    viewMode === 'table' ? 'bg-primary-500 text-white' : 'text-surface-400 hover:text-white')}
                >
                  <LayoutList size={13} /> Table
                </button>
                <button
                  onClick={() => setViewMode('exam')}
                  className={clsx('flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
                    viewMode === 'exam' ? 'bg-primary-500 text-white' : 'text-surface-400 hover:text-white')}
                >
                  <Network size={13} /> By Exam
                </button>
              </div>
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors text-sm text-surface-300">
                <Download size={14}/> Export CSV
              </button>
              <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 btn-primary px-4 py-2 text-sm">
                <Plus size={15}/> Invite User
              </button>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Total Users', value: stats.total, icon: <Users size={16} className="text-blue-400"/> },
              { label: 'Active',      value: stats.active, icon: <Check size={16} className="text-green-400"/> },
              { label: 'Paid Plans',  value: stats.pro,   icon: <CreditCard size={16} className="text-violet-400"/> },
              { label: 'Revenue',     value: `₹${(stats.revenue/1000).toFixed(0)}K`, icon: <Activity size={16} className="text-amber-400"/> },
            ].map(s => (
              <div key={s.label} className="bg-surface-900 border border-surface-700 rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-surface-800 flex items-center justify-center shrink-0">{s.icon}</div>
                <div>
                  <p className="text-xs text-surface-400">{s.label}</p>
                  <p className="text-lg font-bold text-white">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"/>
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-surface-900 border border-surface-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none"
                placeholder="Search by name or email…"/>
            </div>
            {/* Role filter */}
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)}
              className="bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none">
              <option value="all">All Roles</option>
              {(Object.keys(roleMeta) as Role[]).map(r => <option key={r} value={r}>{roleMeta[r].label}</option>)}
            </select>
            {/* Plan filter */}
            <select value={planFilter} onChange={e => setPlanFilter(e.target.value as any)}
              className="bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none">
              <option value="all">All Plans</option>
              {(Object.keys(planMeta) as Plan[]).map(p => <option key={p} value={p}>{planMeta[p].label}</option>)}
            </select>
            {/* Status filter */}
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none">
              <option value="all">All Statuses</option>
              {(Object.keys(statusMeta) as Status[]).map(s => <option key={s} value={s}>{statusMeta[s].label}</option>)}
            </select>
          </div>
        </div>

        {/* Bulk actions bar */}
        <AnimatePresence>
          {checkedIds.size > 0 && (
            <motion.div className="flex items-center gap-3 px-6 py-2.5 bg-primary-500/10 border-b border-primary-500/30 text-sm shrink-0"
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <span className="text-primary-300 font-medium">{checkedIds.size} selected</span>
              <div className="flex gap-2 ml-auto">
                {[
                  { label: 'Export', icon: <Download size={13}/> },
                  { label: 'Suspend', icon: <Ban size={13}/> },
                  { label: 'Delete', icon: <X size={13}/> },
                ].map(a => (
                  <button key={a.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors text-surface-300">
                    {a.icon} {a.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Exam Group View */}
        {viewMode === 'exam' && (
          <ExamGroupView
            users={filtered}
            onSelectUser={u => setSelected(s => s?.id === u.id ? null : u)}
          />
        )}

        {/* Table */}
        {viewMode === 'table' && <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-900 border-b border-surface-700 z-10">
              <tr>
                <th className="w-10 p-3 text-left">
                  <button onClick={toggleAll} className={clsx('w-4 h-4 rounded border flex items-center justify-center transition-colors',
                    allChecked ? 'bg-primary-500 border-primary-500' : 'border-surface-600 hover:border-surface-400')}>
                    {allChecked && <Check size={10} className="text-white"/>}
                  </button>
                </th>
                <th className="p-3 text-left text-xs text-surface-400 font-medium uppercase tracking-wide">User</th>
                <th className="p-3 text-left text-xs text-surface-400 font-medium uppercase tracking-wide">Role</th>
                <th className="p-3 text-left text-xs text-surface-400 font-medium uppercase tracking-wide">Plan</th>
                <th className="p-3 text-left text-xs text-surface-400 font-medium uppercase tracking-wide">Status</th>
                <th className="p-3 text-left text-xs text-surface-400 font-medium uppercase tracking-wide hidden lg:table-cell">Exam</th>
                <th className="p-3 text-left text-xs text-surface-400 font-medium uppercase tracking-wide hidden xl:table-cell">Last Active</th>
                <th className="p-3 text-right text-xs text-surface-400 font-medium uppercase tracking-wide">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700/50">
              {filtered.map(u => (
                <motion.tr key={u.id} layout
                  onClick={() => setSelected(s => s?.id === u.id ? null : u)}
                  className={clsx('group cursor-pointer transition-colors',
                    selected?.id === u.id ? 'bg-primary-500/10' : 'hover:bg-surface-800/50')}>
                  <td className="p-3" onClick={e => { e.stopPropagation(); toggleCheck(u.id); }}>
                    <div className={clsx('w-4 h-4 rounded border flex items-center justify-center transition-colors',
                      checkedIds.has(u.id) ? 'bg-primary-500 border-primary-500' : 'border-surface-600 hover:border-surface-400')}>
                      {checkedIds.has(u.id) && <Check size={10} className="text-white"/>}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <Av name={u.name} size="sm"/>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-white">{u.name}</span>
                          {u.verified && <Check size={11} className="text-green-400"/>}
                        </div>
                        <span className="text-surface-400 text-xs">{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge className={roleMeta[u.role].color}>{roleMeta[u.role].icon}{roleMeta[u.role].label}</Badge>
                  </td>
                  <td className="p-3">
                    <Badge className={planMeta[u.plan].color}>{planMeta[u.plan].label}</Badge>
                  </td>
                  <td className="p-3">
                    <span className={clsx('flex items-center gap-1.5 text-xs', statusMeta[u.status].text)}>
                      <span className={clsx('w-1.5 h-1.5 rounded-full', statusMeta[u.status].dot)}/>
                      {statusMeta[u.status].label}
                    </span>
                  </td>
                  <td className="p-3 hidden lg:table-cell text-surface-400">{u.exam || '—'}</td>
                  <td className="p-3 hidden xl:table-cell text-surface-400">{u.lastActive}</td>
                  <td className="p-3 text-right">
                    <span className={clsx('font-medium', u.revenueTotal > 0 ? 'text-green-400' : 'text-surface-500')}>
                      {u.revenueTotal > 0 ? `₹${u.revenueTotal.toLocaleString()}` : '—'}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-surface-400">
              <Users size={40} className="mb-3 opacity-30"/>
              <p className="font-medium">No users found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          )}
        </div>}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-surface-700 flex items-center justify-between text-xs text-surface-400 shrink-0">
          <span>Showing {filtered.length} of {USERS.length} users</span>
          <span>{viewMode === 'exam' ? 'Grouped by Exam' : 'Page 1 of 1'}</span>
        </div>
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <DetailPanel
            user={selected}
            onClose={() => setSelected(null)}
            onEdit={() => { setEditUser(selected); setSelected(null); }}
          />
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {editUser && <EditModal user={editUser} onClose={() => setEditUser(null)}/>}
        {showAdd && <AddModal onClose={() => setShowAdd(false)}/>}
      </AnimatePresence>
    </div>
  );
}
