/**
 * Users Management — CEO/Admin view
 * Hierarchy: Exam → Cohort/Batch → Section → Individual Users
 * Drill-down tree with stats, side panel, filters, add/export
 */
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ChevronDown, Users, Download, Plus, X, Check,
  TrendingUp, Flame, Clock, Search, AlertCircle, Filter,
  BookOpen, GraduationCap, Target, Mail,
} from 'lucide-react';
import { clsx } from 'clsx';

// ── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  name: string;
  email: string;
  progress: number;
  streak: number;
  lastActive: string;
  status: 'active' | 'inactive' | 'struggling';
  subjects: string[];
  joinedAt: string;
}

interface Section {
  id: string;
  name: string;
  students: Student[];
}

interface Cohort {
  id: string;
  name: string;
  sections: Section[];
}

interface ExamGroup {
  id: string;
  name: string;
  icon: string;
  color: string;
  cohorts: Cohort[];
}

// ── Mock data ────────────────────────────────────────────────────────────────

const makeStudent = (
  id: string, name: string, progress: number,
  streak: number, lastActive: string, status: Student['status'],
  subjects: string[]
): Student => ({
  id, name, email: `${name.toLowerCase().replace(' ', '.')}@student.eg`,
  progress, streak, lastActive, status, subjects,
  joinedAt: '2026-01-10',
});

const EXAM_GROUPS: ExamGroup[] = [
  {
    id: 'jee_main', name: 'JEE Main', icon: '🔢', color: 'text-blue-400',
    cohorts: [
      {
        id: 'jm_2026', name: '2026 Batch',
        sections: [
          { id: 'jm_2026_a', name: 'Section A', students: [
            makeStudent('s1', 'Arjun Sharma', 85, 14, '30m ago', 'active', ['Maths', 'Physics']),
            makeStudent('s2', 'Priya Patel', 52, 3, '2d ago', 'struggling', ['Chemistry', 'Maths']),
            makeStudent('s3', 'Rahul Kumar', 91, 22, '1h ago', 'active', ['Physics', 'Maths', 'Chemistry']),
            makeStudent('s4', 'Sneha Gupta', 38, 0, '5d ago', 'inactive', ['Chemistry']),
          ]},
          { id: 'jm_2026_b', name: 'Section B', students: [
            makeStudent('s5', 'Vikram Singh', 74, 7, '3h ago', 'active', ['Physics', 'Maths']),
            makeStudent('s6', 'Ananya Iyer', 61, 5, '1d ago', 'active', ['Maths', 'Chemistry']),
            makeStudent('s7', 'Rohit Verma', 45, 2, '3d ago', 'struggling', ['Physics']),
          ]},
        ],
      },
      {
        id: 'jm_2027', name: '2027 Batch',
        sections: [
          { id: 'jm_2027_sp', name: 'Self-Paced', students: [
            makeStudent('s8', 'Kavya Reddy', 67, 9, '2h ago', 'active', ['Maths', 'Physics']),
            makeStudent('s9', 'Aman Tiwari', 33, 1, '4d ago', 'inactive', ['Chemistry']),
            makeStudent('s10', 'Riya Nair', 78, 11, '45m ago', 'active', ['Physics', 'Maths']),
          ]},
        ],
      },
    ],
  },
  {
    id: 'neet', name: 'NEET', icon: '🧬', color: 'text-green-400',
    cohorts: [
      {
        id: 'neet_2026', name: '2026 Batch',
        sections: [
          { id: 'neet_2026_a', name: 'Section A', students: [
            makeStudent('s11', 'Divya Menon', 88, 18, '20m ago', 'active', ['Biology', 'Chemistry']),
            makeStudent('s12', 'Kiran Rao', 55, 4, '1d ago', 'struggling', ['Physics', 'Biology']),
            makeStudent('s13', 'Pooja Sharma', 92, 25, '10m ago', 'active', ['Biology', 'Chemistry', 'Physics']),
            makeStudent('s14', 'Suresh Babu', 41, 0, '6d ago', 'inactive', ['Chemistry']),
          ]},
          { id: 'neet_2026_b', name: 'Section B', students: [
            makeStudent('s15', 'Meena Krishnan', 72, 8, '4h ago', 'active', ['Biology', 'Chemistry']),
            makeStudent('s16', 'Aditya Pillai', 49, 2, '2d ago', 'struggling', ['Physics']),
          ]},
        ],
      },
    ],
  },
  {
    id: 'cbse_10', name: 'CBSE Class 10', icon: '📚', color: 'text-amber-400',
    cohorts: [
      {
        id: 'cbse10_2026', name: '2026 Batch',
        sections: [
          { id: 'cbse10_2026_a', name: 'Section A', students: [
            makeStudent('s17', 'Ishaan Bose', 79, 12, '1h ago', 'active', ['Maths', 'Science']),
            makeStudent('s18', 'Tanya Mehta', 64, 6, '3h ago', 'active', ['English', 'Science']),
            makeStudent('s19', 'Nikhil Das', 37, 1, '5d ago', 'inactive', ['Maths']),
          ]},
          { id: 'cbse10_2026_b', name: 'Section B', students: [
            makeStudent('s20', 'Sanya Joshi', 83, 15, '30m ago', 'active', ['Maths', 'Science', 'English']),
            makeStudent('s21', 'Raj Thakur', 47, 3, '2d ago', 'struggling', ['Maths']),
          ]},
        ],
      },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function progressColor(p: number) {
  if (p >= 75) return 'text-green-400';
  if (p >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function progressDot(p: number) {
  if (p >= 75) return 'bg-green-400';
  if (p >= 50) return 'bg-amber-400';
  return 'bg-red-400';
}

function statusLabel(s: Student['status']) {
  if (s === 'active') return { label: 'Active', cls: 'bg-green-500/10 text-green-400' };
  if (s === 'struggling') return { label: 'Struggling', cls: 'bg-red-500/10 text-red-400' };
  return { label: 'Inactive', cls: 'bg-surface-700 text-surface-400' };
}

function examStats(exam: ExamGroup) {
  const all = exam.cohorts.flatMap(c => c.sections.flatMap(s => s.students));
  const avg = all.length ? Math.round(all.reduce((s, u) => s + u.progress, 0) / all.length) : 0;
  const active = all.filter(u => u.status === 'active').length;
  return { total: all.length, avg, active };
}

function cohortStats(cohort: Cohort) {
  const all = cohort.sections.flatMap(s => s.students);
  const avg = all.length ? Math.round(all.reduce((s, u) => s + u.progress, 0) / all.length) : 0;
  return { total: all.length, avg };
}

function sectionStats(section: Section) {
  const avg = section.students.length
    ? Math.round(section.students.reduce((s, u) => s + u.progress, 0) / section.students.length)
    : 0;
  return { total: section.students.length, avg };
}

// ── Add User Modal ───────────────────────────────────────────────────────────

function AddUserModal({ onClose, onAdd }: { onClose: () => void; onAdd: (u: Student) => void }) {
  const [form, setForm] = useState({ name: '', email: '', exam: 'jee_main', role: 'student' });
  const [done, setDone] = useState(false);

  const handleAdd = () => {
    if (!form.name || !form.email) return;
    setDone(true);
    setTimeout(() => { onAdd({ ...makeStudent(`u${Date.now()}`, form.name, 0, 0, 'Just now', 'active', []) }); onClose(); }, 1200);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md glass rounded-2xl p-6 shadow-2xl">
        {done ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-green-400" />
            </div>
            <p className="font-semibold text-green-400">User added!</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">Add User</h3>
              <button onClick={onClose} className="p-1.5 hover:bg-surface-800 rounded-lg"><X className="w-4 h-4 text-surface-400" /></button>
            </div>
            <div className="space-y-3">
              <input className="input w-full" placeholder="Full name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <input className="input w-full" placeholder="Email address *" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <select className="input w-full" value={form.exam} onChange={e => setForm(f => ({ ...f, exam: e.target.value }))}>
                {EXAM_GROUPS.map(eg => <option key={eg.id} value={eg.id}>{eg.name}</option>)}
              </select>
              <select className="input w-full" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button onClick={handleAdd} disabled={!form.name || !form.email}
              className={clsx('w-full mt-5 py-2.5 rounded-xl font-semibold text-sm transition-all',
                form.name && form.email ? 'bg-primary-500 hover:bg-primary-400 text-white' : 'bg-surface-700 text-surface-500 cursor-not-allowed')}>
              Add User
            </button>
          </>
        )}
      </motion.div>
    </>
  );
}

// ── User Side Panel ───────────────────────────────────────────────────────────

function UserPanel({ user, onClose }: { user: Student; onClose: () => void }) {
  const sl = statusLabel(user.status);
  return (
    <motion.div initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 32 }}
      className="fixed right-0 top-0 h-screen w-80 glass border-l border-surface-700/50 z-40 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold">User Profile</h3>
        <button onClick={onClose} className="p-1.5 hover:bg-surface-800 rounded-lg"><X className="w-4 h-4 text-surface-400" /></button>
      </div>

      <div className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-2xl font-bold mb-3">
          {user.name.charAt(0)}
        </div>
        <h4 className="font-semibold text-lg">{user.name}</h4>
        <p className="text-sm text-surface-400">{user.email}</p>
        <span className={clsx('mt-2 px-2.5 py-1 rounded-full text-xs font-medium', sl.cls)}>{sl.label}</span>
      </div>

      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-surface-800/50">
          <p className="text-xs text-surface-400 mb-1">Overall Progress</p>
          <p className={clsx('text-2xl font-bold', progressColor(user.progress))}>{user.progress}%</p>
          <div className="mt-2 h-2 bg-surface-700 rounded-full overflow-hidden">
            <div className={clsx('h-full rounded-full', progressDot(user.progress).replace('bg-', 'bg-'))}
              style={{ width: `${user.progress}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-surface-800/50 text-center">
            <Flame className="w-4 h-4 text-orange-400 mx-auto mb-1" />
            <p className="font-bold">{user.streak}</p>
            <p className="text-[10px] text-surface-400">Day Streak</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-800/50 text-center">
            <Clock className="w-4 h-4 text-primary-400 mx-auto mb-1" />
            <p className="font-bold text-xs">{user.lastActive}</p>
            <p className="text-[10px] text-surface-400">Last Active</p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-surface-800/50">
          <p className="text-xs text-surface-400 mb-2">Subjects</p>
          <div className="flex flex-wrap gap-1.5">
            {user.subjects.length > 0 ? user.subjects.map(s => (
              <span key={s} className="text-xs px-2 py-0.5 bg-primary-500/10 text-primary-300 rounded-full">{s}</span>
            )) : <span className="text-xs text-surface-500">None yet</span>}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-surface-800/50">
          <p className="text-xs text-surface-400 mb-1">Joined</p>
          <p className="text-sm font-medium">{user.joinedAt}</p>
        </div>

        <div className="space-y-2">
          <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 text-sm transition-colors">
            <Mail className="w-4 h-4" /> Send Message
          </button>
          <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-sm transition-colors">
            <Target className="w-4 h-4 text-surface-400" /> Assign Goals
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Tree Row Components ────────────────────────────────────────────────────────

function StudentRow({ student, onSelect, selected }: {
  student: Student; onSelect: (s: Student) => void; selected: boolean;
}) {
  const sl = statusLabel(student.status);
  return (
    <div onClick={() => onSelect(student)}
      className={clsx('flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all group ml-12',
        selected ? 'bg-primary-500/10 border border-primary-500/20' : 'hover:bg-surface-800/50')}>
      <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', progressDot(student.progress))} />
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
        {student.name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{student.name}</p>
        <p className="text-[10px] text-surface-500 truncate">{student.email}</p>
      </div>
      <span className={clsx('text-[10px] px-2 py-0.5 rounded-full hidden sm:block', sl.cls)}>{sl.label}</span>
      <div className="text-right flex-shrink-0">
        <p className={clsx('text-sm font-bold', progressColor(student.progress))}>{student.progress}%</p>
        <p className="text-[10px] text-surface-500">{student.lastActive}</p>
      </div>
    </div>
  );
}

function SectionRow({ section, selectedUser, onSelectUser, depth = 2 }: {
  section: Section; selectedUser: Student | null; onSelectUser: (s: Student) => void; depth?: number;
}) {
  const [open, setOpen] = useState(false);
  const st = sectionStats(section);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-surface-800/40 transition-colors group ml-6">
        <div className={clsx('w-4 h-4 rounded flex items-center justify-center transition-transform flex-shrink-0', open && 'rotate-0')}>
          {open ? <ChevronDown className="w-3.5 h-3.5 text-surface-400" /> : <ChevronRight className="w-3.5 h-3.5 text-surface-400" />}
        </div>
        <BookOpen className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />
        <span className="text-sm font-medium">{section.name}</span>
        <span className="ml-auto flex items-center gap-3 text-xs text-surface-500">
          <span>{st.total} students</span>
          <span className={clsx('font-semibold', progressColor(st.avg))}>{st.avg}% avg</span>
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="space-y-1 py-1">
              {section.students.map(student => (
                <StudentRow key={student.id} student={student}
                  onSelect={onSelectUser} selected={selectedUser?.id === student.id} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CohortRow({ cohort, selectedUser, onSelectUser }: {
  cohort: Cohort; selectedUser: Student | null; onSelectUser: (s: Student) => void;
}) {
  const [open, setOpen] = useState(false);
  const st = cohortStats(cohort);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-surface-800/40 transition-colors ml-3">
        {open ? <ChevronDown className="w-3.5 h-3.5 text-surface-400" /> : <ChevronRight className="w-3.5 h-3.5 text-surface-400" />}
        <GraduationCap className="w-3.5 h-3.5 text-accent-400 flex-shrink-0" />
        <span className="text-sm font-semibold">{cohort.name}</span>
        <span className="ml-auto flex items-center gap-3 text-xs text-surface-500">
          <span>{st.total} students</span>
          <span className={clsx('font-semibold', progressColor(st.avg))}>{st.avg}% avg</span>
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="space-y-1 py-1">
              {cohort.sections.map(sec => (
                <SectionRow key={sec.id} section={sec} selectedUser={selectedUser} onSelectUser={onSelectUser} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExamGroupRow({ exam, selectedUser, onSelectUser, defaultOpen }: {
  exam: ExamGroup; selectedUser: Student | null; onSelectUser: (s: Student) => void; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const st = examStats(exam);
  return (
    <div className="card mb-3">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-1 rounded-xl transition-colors group">
        <div className="w-8 h-8 rounded-lg bg-surface-700/50 flex items-center justify-center text-lg">{exam.icon}</div>
        <div className="flex-1 text-left">
          <p className={clsx('font-bold', exam.color)}>{exam.name}</p>
          <p className="text-xs text-surface-500">{st.total} users · {st.active} active · {st.avg}% avg progress</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 bg-surface-700 rounded-full overflow-hidden">
            <div className={clsx('h-full rounded-full', st.avg >= 75 ? 'bg-green-500' : st.avg >= 50 ? 'bg-amber-500' : 'bg-red-500')}
              style={{ width: `${st.avg}%` }} />
          </div>
          {open ? <ChevronDown className="w-4 h-4 text-surface-400" /> : <ChevronRight className="w-4 h-4 text-surface-400" />}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-3 border-t border-surface-700/50 pt-3 space-y-1">
              {exam.cohorts.map(cohort => (
                <CohortRow key={cohort.id} cohort={cohort} selectedUser={selectedUser} onSelectUser={onSelectUser} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function Students() {
  const [selectedUser, setSelectedUser] = useState<Student | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterExam, setFilterExam] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Global stats across all exams
  const allStudents = useMemo(() =>
    EXAM_GROUPS.flatMap(eg => eg.cohorts.flatMap(c => c.sections.flatMap(s => s.students))),
    []
  );
  const totalActive = allStudents.filter(s => s.status === 'active').length;
  const totalStruggling = allStudents.filter(s => s.status === 'struggling').length;
  const globalAvg = Math.round(allStudents.reduce((s, u) => s + u.progress, 0) / allStudents.length);

  // Search filter — if active, show flat list instead of tree
  const searchResults = useMemo(() => {
    if (!search && filterStatus === 'all' && filterExam === 'all') return null;
    return allStudents.filter(u => {
      const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || u.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [search, filterStatus, filterExam, allStudents]);

  const visibleExams = filterExam === 'all' ? EXAM_GROUPS : EXAM_GROUPS.filter(e => e.id === filterExam);

  const handleExport = () => {
    const rows = ['Name,Email,Progress,Status,Streak,Last Active'];
    allStudents.forEach(u => rows.push(`${u.name},${u.email},${u.progress}%,${u.status},${u.streak},${u.lastActive}`));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'edugenius-users.csv'; a.click();
  };

  return (
    <div className={clsx('space-y-5 pb-8', selectedUser && 'mr-80')}>
      {/* Modals */}
      <AnimatePresence>
        {showAddModal && <AddUserModal onClose={() => setShowAddModal(false)} onAdd={() => {}} />}
        {selectedUser && <UserPanel user={selectedUser} onClose={() => setSelectedUser(null)} />}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Users</h1>
          <p className="text-surface-400 text-sm">Grouped by examination · drill down to individual learners</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-sm transition-colors">
            <Download className="w-4 h-4 text-surface-400" /> Export CSV
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary-500/20"><Users className="w-5 h-5 text-primary-400" /></div>
          <div><p className="text-xl font-bold">{allStudents.length}</p><p className="text-xs text-surface-400">Total Users</p></div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="p-2 rounded-xl bg-green-500/20"><TrendingUp className="w-5 h-5 text-green-400" /></div>
          <div><p className="text-xl font-bold">{totalActive}</p><p className="text-xs text-surface-400">Active Today</p></div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/20"><Target className="w-5 h-5 text-blue-400" /></div>
          <div><p className="text-xl font-bold">{globalAvg}%</p><p className="text-xs text-surface-400">Avg Progress</p></div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="p-2 rounded-xl bg-red-500/20"><AlertCircle className="w-5 h-5 text-red-400" /></div>
          <div><p className="text-xl font-bold">{totalStruggling}</p><p className="text-xs text-surface-400">Struggling</p></div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input className="input pl-9 w-full text-sm" placeholder="Search by name or email..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input text-sm" value={filterExam} onChange={e => setFilterExam(e.target.value)}>
          <option value="all">All Exams</option>
          {EXAM_GROUPS.map(eg => <option key={eg.id} value={eg.id}>{eg.name}</option>)}
        </select>
        <select className="input text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="struggling">Struggling</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Search results (flat list) */}
      {searchResults !== null ? (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-surface-400" />
            <h2 className="font-semibold text-sm">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</h2>
          </div>
          {searchResults.length === 0 ? (
            <p className="text-surface-500 text-sm text-center py-8">No users match your filters.</p>
          ) : (
            <div className="space-y-1">
              {searchResults.map(student => (
                <div key={student.id} onClick={() => setSelectedUser(student)}
                  className={clsx('flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all',
                    selectedUser?.id === student.id ? 'bg-primary-500/10 border border-primary-500/20' : 'hover:bg-surface-800/50')}>
                  <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', progressDot(student.progress))} />
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {student.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{student.name}</p>
                    <p className="text-xs text-surface-500">{student.email}</p>
                  </div>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full', statusLabel(student.status).cls)}>{statusLabel(student.status).label}</span>
                  <p className={clsx('text-sm font-bold', progressColor(student.progress))}>{student.progress}%</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Hierarchical tree */
        <div>
          {visibleExams.map((exam, i) => (
            <ExamGroupRow key={exam.id} exam={exam}
              selectedUser={selectedUser} onSelectUser={setSelectedUser}
              defaultOpen={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}
