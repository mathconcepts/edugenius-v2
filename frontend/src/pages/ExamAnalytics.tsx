/**
 * ExamAnalytics — Per-exam performance analytics for Admin/Teacher
 *
 * Shows:
 *  - Exam-level KPIs (enrolled, active, sessions, avg score, completion)
 *  - Subject breakdown per exam
 *  - Engagement trend (7-day sparkline)
 *  - At-risk student count per exam
 *  - Batch/grade drill-down
 *
 * No API required: curated mock data with API-first pattern.
 * When Oracle agent + backend are live, replace fetchData() output.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart2,
  Users,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Activity,
  Target,
  Clock,
  Award,
  Filter,
} from 'lucide-react';
import { clsx } from 'clsx';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type ExamCode = 'JEE_MAIN' | 'JEE_ADVANCED' | 'NEET' | 'CBSE_12' | 'CBSE_10' | 'CAT' | 'UPSC' | 'GATE';

interface SubjectStats {
  subject: string;
  enrolled: number;
  avgScore: number;
  avgTime: string;
  completion: number;
  trend: 'up' | 'down' | 'flat';
}

interface BatchStats {
  grade: string;
  enrolled: number;
  active: number;
  avgScore: number;
  atRisk: number;
  topScorer: string;
}

interface ExamStats {
  code: ExamCode;
  name: string;
  emoji: string;
  enrolled: number;
  activeToday: number;
  avgDailySession: number; // minutes
  avgScore: number;        // out of 100
  completion: number;      // % of syllabus
  atRisk: number;
  examDate: string;
  daysLeft: number;
  trend7d: number[];       // daily active users for last 7 days
  subjects: SubjectStats[];
  batches: BatchStats[];
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const EXAM_DATA: ExamStats[] = [
  {
    code: 'JEE_MAIN',
    name: 'JEE Main',
    emoji: '⚗️',
    enrolled: 3840,
    activeToday: 1420,
    avgDailySession: 52,
    avgScore: 68,
    completion: 74,
    atRisk: 312,
    examDate: '2026-04-05',
    daysLeft: 45,
    trend7d: [1180, 1250, 1100, 1380, 1290, 1450, 1420],
    subjects: [
      { subject: 'Mathematics', enrolled: 3840, avgScore: 65, avgTime: '28m', completion: 78, trend: 'up' },
      { subject: 'Physics', enrolled: 3840, avgScore: 71, avgTime: '24m', completion: 72, trend: 'up' },
      { subject: 'Chemistry', enrolled: 3840, avgScore: 68, avgTime: '19m', completion: 70, trend: 'flat' },
    ],
    batches: [
      { grade: 'Class 12 — 2026', enrolled: 2240, active: 980, avgScore: 71, atRisk: 180, topScorer: 'Arjun S.' },
      { grade: 'Class 12 — Dropper', enrolled: 1200, active: 380, avgScore: 63, atRisk: 98, topScorer: 'Priya K.' },
      { grade: 'Class 11 — Early Prep', enrolled: 400, active: 60, avgScore: 58, atRisk: 34, topScorer: 'Rahul M.' },
    ],
  },
  {
    code: 'NEET',
    name: 'NEET UG',
    emoji: '🔬',
    enrolled: 2980,
    activeToday: 1105,
    avgDailySession: 48,
    avgScore: 72,
    completion: 68,
    atRisk: 241,
    examDate: '2026-05-04',
    daysLeft: 74,
    trend7d: [920, 980, 1050, 1000, 1080, 1120, 1105],
    subjects: [
      { subject: 'Biology', enrolled: 2980, avgScore: 78, avgTime: '30m', completion: 72, trend: 'up' },
      { subject: 'Physics', enrolled: 2980, avgScore: 65, avgTime: '22m', completion: 61, trend: 'down' },
      { subject: 'Chemistry', enrolled: 2980, avgScore: 73, avgTime: '20m', completion: 70, trend: 'flat' },
    ],
    batches: [
      { grade: 'Class 12 — 2026', enrolled: 1860, active: 780, avgScore: 74, atRisk: 140, topScorer: 'Sneha R.' },
      { grade: 'Class 12 — Dropper', enrolled: 920, active: 290, avgScore: 69, atRisk: 85, topScorer: 'Dev P.' },
      { grade: 'Class 11 — Early Prep', enrolled: 200, active: 35, avgScore: 61, atRisk: 16, topScorer: 'Isha T.' },
    ],
  },
  {
    code: 'CBSE_12',
    name: 'CBSE Class 12',
    emoji: '📚',
    enrolled: 5620,
    activeToday: 2140,
    avgDailySession: 35,
    avgScore: 76,
    completion: 82,
    atRisk: 390,
    examDate: '2026-03-01',
    daysLeft: 10,
    trend7d: [1820, 1980, 2050, 2100, 2200, 2180, 2140],
    subjects: [
      { subject: 'Mathematics', enrolled: 2100, avgScore: 73, avgTime: '25m', completion: 85, trend: 'up' },
      { subject: 'Physics', enrolled: 1840, avgScore: 78, avgTime: '22m', completion: 83, trend: 'up' },
      { subject: 'Chemistry', enrolled: 1680, avgScore: 75, avgTime: '20m', completion: 80, trend: 'flat' },
      { subject: 'English', enrolled: 5620, avgScore: 82, avgTime: '18m', completion: 90, trend: 'up' },
    ],
    batches: [
      { grade: 'PCM Stream', enrolled: 1840, active: 820, avgScore: 76, atRisk: 148, topScorer: 'Kavya N.' },
      { grade: 'PCB Stream', enrolled: 1580, active: 690, avgScore: 74, atRisk: 122, topScorer: 'Amit S.' },
      { grade: 'Commerce', enrolled: 1200, active: 430, avgScore: 79, atRisk: 80, topScorer: 'Riya M.' },
      { grade: 'Humanities', enrolled: 1000, active: 200, avgScore: 81, atRisk: 40, topScorer: 'Zara K.' },
    ],
  },
  {
    code: 'CAT',
    name: 'CAT',
    emoji: '🎓',
    enrolled: 1240,
    activeToday: 380,
    avgDailySession: 44,
    avgScore: 61,
    completion: 55,
    atRisk: 180,
    examDate: '2026-11-28',
    daysLeft: 282,
    trend7d: [310, 330, 360, 340, 390, 370, 380],
    subjects: [
      { subject: 'VARC', enrolled: 1240, avgScore: 64, avgTime: '20m', completion: 58, trend: 'up' },
      { subject: 'DILR', enrolled: 1240, avgScore: 55, avgTime: '28m', completion: 50, trend: 'down' },
      { subject: 'Quant', enrolled: 1240, avgScore: 63, avgTime: '24m', completion: 57, trend: 'flat' },
    ],
    batches: [
      { grade: 'Working Professionals', enrolled: 820, active: 260, avgScore: 63, atRisk: 120, topScorer: 'Ankit B.' },
      { grade: 'Fresh Graduates', enrolled: 420, active: 120, avgScore: 57, atRisk: 60, topScorer: 'Meera J.' },
    ],
  },
  {
    code: 'UPSC',
    name: 'UPSC CSE',
    emoji: '🏛️',
    enrolled: 890,
    activeToday: 210,
    avgDailySession: 68,
    avgScore: 54,
    completion: 38,
    atRisk: 142,
    examDate: '2026-06-07',
    daysLeft: 108,
    trend7d: [190, 200, 210, 205, 215, 208, 210],
    subjects: [
      { subject: 'GS Paper I', enrolled: 890, avgScore: 58, avgTime: '35m', completion: 42, trend: 'up' },
      { subject: 'GS Paper II', enrolled: 890, avgScore: 52, avgTime: '30m', completion: 38, trend: 'flat' },
      { subject: 'GS Paper III', enrolled: 890, avgScore: 50, avgTime: '32m', completion: 35, trend: 'flat' },
      { subject: 'CSAT', enrolled: 890, avgScore: 68, avgTime: '20m', completion: 48, trend: 'up' },
    ],
    batches: [
      { grade: 'Prelims Target 2026', enrolled: 540, active: 150, avgScore: 56, atRisk: 88, topScorer: 'Rohan T.' },
      { grade: 'Mains Target 2026', enrolled: 210, active: 45, avgScore: 51, atRisk: 38, topScorer: 'Sunita V.' },
      { grade: 'Interview Stage', enrolled: 140, active: 15, avgScore: 72, atRisk: 16, topScorer: 'Ajay P.' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SPARKLINE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function Sparkline({ data, color = '#6366f1' }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const trend = data[data.length - 1] >= data[0];
  const lineColor = trend ? '#22c55e' : '#ef4444';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-80">
      <polyline points={pts.join(' ')} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS BAR
// ─────────────────────────────────────────────────────────────────────────────

function ProgressBar({ value, color = 'bg-primary-500', className = '' }: { value: number; color?: string; className?: string }) {
  return (
    <div className={clsx('h-1.5 bg-surface-700 rounded-full overflow-hidden', className)}>
      <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE BADGE
// ─────────────────────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 75 ? 'text-green-400 bg-green-400/10' :
    score >= 60 ? 'text-yellow-400 bg-yellow-400/10' :
                  'text-red-400 bg-red-400/10';
  return (
    <span className={clsx('px-2 py-0.5 rounded text-xs font-semibold', color)}>
      {score}%
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXAM CARD
// ─────────────────────────────────────────────────────────────────────────────

function ExamCard({ exam, selected, onClick }: { exam: ExamStats; selected: boolean; onClick: () => void }) {
  const urgency = exam.daysLeft <= 15 ? 'border-red-500/40' : exam.daysLeft <= 45 ? 'border-yellow-500/30' : 'border-surface-600';
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={clsx(
        'w-full text-left p-4 rounded-xl border transition-all',
        selected ? 'bg-surface-700 border-primary-500' : `bg-surface-800 ${urgency} hover:border-surface-500`
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{exam.emoji}</span>
          <div>
            <p className="font-semibold text-white text-sm">{exam.name}</p>
            <p className={clsx('text-xs', exam.daysLeft <= 15 ? 'text-red-400' : 'text-surface-400')}>
              {exam.daysLeft <= 0 ? 'Exam passed' : `${exam.daysLeft}d left`}
            </p>
          </div>
        </div>
        <Sparkline data={exam.trend7d} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-surface-400">Enrolled</p>
          <p className="text-sm font-semibold text-white">{exam.enrolled.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-surface-400">Active</p>
          <p className="text-sm font-semibold text-green-400">{exam.activeToday.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-surface-400">At Risk</p>
          <p className="text-sm font-semibold text-red-400">{exam.atRisk}</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-xs text-surface-400 mb-1">
          <span>Syllabus</span>
          <span>{exam.completion}%</span>
        </div>
        <ProgressBar
          value={exam.completion}
          color={exam.completion >= 80 ? 'bg-green-500' : exam.completion >= 60 ? 'bg-yellow-500' : 'bg-primary-500'}
        />
      </div>
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL PANEL
// ─────────────────────────────────────────────────────────────────────────────

type DetailTab = 'overview' | 'subjects' | 'batches';

function ExamDetail({ exam }: { exam: ExamStats }) {
  const [tab, setTab] = useState<DetailTab>('overview');
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  const TABS: { id: DetailTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'subjects', label: 'Subjects', icon: BookOpen },
    { id: 'batches', label: 'Batches', icon: Users },
  ];

  return (
    <div className="bg-surface-800 rounded-xl border border-surface-700 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-surface-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{exam.emoji}</span>
            <div>
              <h2 className="text-xl font-bold text-white">{exam.name}</h2>
              <p className="text-sm text-surface-400">
                Exam: {exam.examDate} &nbsp;·&nbsp;
                <span className={exam.daysLeft <= 15 ? 'text-red-400 font-semibold' : 'text-surface-400'}>
                  {exam.daysLeft}d remaining
                </span>
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {[
              { label: 'Avg Score', value: `${exam.avgScore}%`, icon: Target, color: 'text-primary-400' },
              { label: 'Avg Session', value: `${exam.avgDailySession}m`, icon: Clock, color: 'text-blue-400' },
              { label: 'Syllabus Done', value: `${exam.completion}%`, icon: Award, color: 'text-green-400' },
            ].map(m => (
              <div key={m.label} className="text-center px-4 py-2 bg-surface-700 rounded-lg">
                <m.icon className={clsx('w-4 h-4 mx-auto mb-1', m.color)} />
                <p className="text-lg font-bold text-white">{m.value}</p>
                <p className="text-xs text-surface-400">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Total Enrolled', value: exam.enrolled.toLocaleString(), icon: Users, color: 'text-white' },
            { label: 'Active Today', value: exam.activeToday.toLocaleString(), icon: Activity, color: 'text-green-400' },
            { label: 'At Risk', value: exam.atRisk.toString(), icon: AlertTriangle, color: 'text-red-400' },
            { label: 'Activation Rate', value: `${Math.round((exam.activeToday / exam.enrolled) * 100)}%`, icon: TrendingUp, color: 'text-yellow-400' },
          ].map(k => (
            <div key={k.label} className="bg-surface-700/50 rounded-lg p-3">
              <k.icon className={clsx('w-4 h-4 mb-1', k.color)} />
              <p className={clsx('text-xl font-bold', k.color)}>{k.value}</p>
              <p className="text-xs text-surface-400">{k.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-700">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2',
              tab === t.id
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-surface-400 hover:text-white'
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-5">
        <AnimatePresence mode="wait">
          {tab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* 7-day trend chart (bar chart simulation) */}
              <h3 className="text-sm font-medium text-surface-300 mb-3">7-Day Active Users</h3>
              <div className="flex items-end gap-1.5 h-20 mb-6">
                {exam.trend7d.map((v, i) => {
                  const max = Math.max(...exam.trend7d);
                  const h = (v / max) * 100;
                  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                  const isLast = i === exam.trend7d.length - 1;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-surface-400">{v.toLocaleString()}</span>
                      <div
                        className={clsx('w-full rounded-t transition-all', isLast ? 'bg-primary-500' : 'bg-surface-600')}
                        style={{ height: `${h}%` }}
                      />
                      <span className="text-xs text-surface-500">{days[i]}</span>
                    </div>
                  );
                })}
              </div>

              {/* Syllabus completion by subject */}
              <h3 className="text-sm font-medium text-surface-300 mb-3">Syllabus Completion by Subject</h3>
              <div className="space-y-3">
                {exam.subjects.map(s => (
                  <div key={s.subject}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-surface-300">{s.subject}</span>
                      <span className="text-surface-400">{s.completion}%</span>
                    </div>
                    <ProgressBar
                      value={s.completion}
                      color={s.completion >= 80 ? 'bg-green-500' : s.completion >= 60 ? 'bg-yellow-500' : 'bg-primary-500'}
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {tab === 'subjects' && (
            <motion.div key="subjects" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-surface-400 uppercase border-b border-surface-700">
                    <th className="pb-2 text-left">Subject</th>
                    <th className="pb-2 text-right">Enrolled</th>
                    <th className="pb-2 text-right">Avg Score</th>
                    <th className="pb-2 text-right">Avg Time</th>
                    <th className="pb-2 text-right">Completion</th>
                    <th className="pb-2 text-right">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700/50">
                  {exam.subjects.map(s => (
                    <tr key={s.subject}>
                      <td className="py-3 font-medium text-white">{s.subject}</td>
                      <td className="py-3 text-right text-surface-300">{s.enrolled.toLocaleString()}</td>
                      <td className="py-3 text-right"><ScoreBadge score={s.avgScore} /></td>
                      <td className="py-3 text-right text-surface-300">{s.avgTime}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ProgressBar value={s.completion} className="w-16" />
                          <span className="text-xs text-surface-400 w-8">{s.completion}%</span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <span className={clsx('text-xs font-medium',
                          s.trend === 'up' ? 'text-green-400' :
                          s.trend === 'down' ? 'text-red-400' : 'text-surface-400'
                        )}>
                          {s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}

          {tab === 'batches' && (
            <motion.div key="batches" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {exam.batches.map(b => (
                <div key={b.grade} className="bg-surface-700/40 rounded-lg">
                  <button
                    className="w-full flex items-center justify-between p-4"
                    onClick={() => setExpandedBatch(expandedBatch === b.grade ? null : b.grade)}
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4 text-surface-400" />
                      <span className="font-medium text-white text-sm">{b.grade}</span>
                      {b.atRisk > 0 && (
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                          {b.atRisk} at risk
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <ScoreBadge score={b.avgScore} />
                      {expandedBatch === b.grade
                        ? <ChevronDown className="w-4 h-4 text-surface-400" />
                        : <ChevronRight className="w-4 h-4 text-surface-400" />
                      }
                    </div>
                  </button>

                  <AnimatePresence>
                    {expandedBatch === b.grade && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-surface-700">
                          {[
                            { label: 'Enrolled', value: b.enrolled.toLocaleString(), color: 'text-white' },
                            { label: 'Active', value: b.active.toLocaleString(), color: 'text-green-400' },
                            { label: 'At Risk', value: b.atRisk.toString(), color: 'text-red-400' },
                            { label: 'Top Scorer', value: b.topScorer, color: 'text-yellow-400' },
                          ].map(m => (
                            <div key={m.label} className="pt-3">
                              <p className="text-xs text-surface-400">{m.label}</p>
                              <p className={clsx('text-sm font-semibold mt-0.5', m.color)}>{m.value}</p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function ExamAnalytics() {
  const [selectedExam, setSelectedExam] = useState<ExamCode>('JEE_MAIN');
  const [sortBy, setSortBy] = useState<'enrolled' | 'atRisk' | 'daysLeft'>('enrolled');

  const sortedExams = useMemo(() => {
    return [...EXAM_DATA].sort((a, b) => {
      if (sortBy === 'enrolled') return b.enrolled - a.enrolled;
      if (sortBy === 'atRisk') return b.atRisk - a.atRisk;
      if (sortBy === 'daysLeft') return a.daysLeft - b.daysLeft;
      return 0;
    });
  }, [sortBy]);

  const detail = EXAM_DATA.find(e => e.code === selectedExam)!;

  // Aggregate stats
  const totalEnrolled = EXAM_DATA.reduce((s, e) => s + e.enrolled, 0);
  const totalActive = EXAM_DATA.reduce((s, e) => s + e.activeToday, 0);
  const totalAtRisk = EXAM_DATA.reduce((s, e) => s + e.atRisk, 0);
  const avgCompletion = Math.round(EXAM_DATA.reduce((s, e) => s + e.completion, 0) / EXAM_DATA.length);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Exam Analytics</h1>
          <p className="text-sm text-surface-400 mt-1">Performance & engagement across all exam groups</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-surface-400" />
          <span className="text-xs text-surface-400">Sort by:</span>
          {([
            { id: 'enrolled', label: 'Enrolled' },
            { id: 'atRisk', label: 'At Risk' },
            { id: 'daysLeft', label: 'Urgency' },
          ] as const).map(s => (
            <button
              key={s.id}
              onClick={() => setSortBy(s.id)}
              className={clsx(
                'btn btn-sm px-3 py-1 text-xs',
                sortBy === s.id ? 'bg-primary-600 text-white' : 'bg-surface-700 text-surface-400 hover:text-white'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: totalEnrolled.toLocaleString(), icon: Users, color: 'text-primary-400' },
          { label: 'Active Today', value: totalActive.toLocaleString(), icon: Activity, color: 'text-green-400' },
          { label: 'At Risk', value: totalAtRisk.toString(), icon: AlertTriangle, color: 'text-red-400' },
          { label: 'Avg Syllabus Done', value: `${avgCompletion}%`, icon: BookOpen, color: 'text-yellow-400' },
        ].map(k => (
          <div key={k.label} className="bg-surface-800 rounded-xl border border-surface-700 p-4">
            <k.icon className={clsx('w-5 h-5 mb-2', k.color)} />
            <p className={clsx('text-2xl font-bold', k.color)}>{k.value}</p>
            <p className="text-sm text-surface-400 mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Main layout: sidebar list + detail panel */}
      <div className="grid grid-cols-[280px_1fr] gap-4">
        {/* Exam list */}
        <div className="space-y-2">
          {sortedExams.map(exam => (
            <ExamCard
              key={exam.code}
              exam={exam}
              selected={selectedExam === exam.code}
              onClick={() => setSelectedExam(exam.code)}
            />
          ))}
        </div>

        {/* Detail */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedExam}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            <ExamDetail exam={detail} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* API readiness note */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300">
        <strong>Oracle Agent ready:</strong> Connect <code>VITE_GEMINI_API_KEY</code> to replace mock data with live analytics from the Oracle agent.
      </div>
    </div>
  );
}
