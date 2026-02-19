/**
 * UXEnhancements.tsx — AI-powered UX improvements for all 5 roles
 * All data is mock — no backend calls
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Target, Users, Zap, TrendingUp,
  Sparkles, ChevronDown, Clock, Star, BarChart3,
  Flame, Trophy, Wand2, Cpu, DollarSign, Shield,
  Play, X, Check, Send, Lightbulb, Activity,
  CheckCircle2,
} from 'lucide-react';
import { clsx } from 'clsx';

// ═══════════════════════════ ROLE 1: STUDENT ════════════════════════════

// AIStudyCoach
export function AIStudyCoach() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-primary-500/10 to-accent-500/10 border border-primary-500/25"
    >
      <button onClick={() => setDismissed(true)} className="absolute top-3 right-3 p-1 hover:bg-surface-700 rounded-lg transition-colors">
        <X className="w-3.5 h-3.5 text-surface-500" />
      </button>
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-primary-500/20 flex-shrink-0">
          <Brain className="w-5 h-5 text-primary-400" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-semibold text-primary-400 uppercase tracking-wide">Sage picked this</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">87% confident</span>
          </div>
          <p className="font-semibold text-sm">Newton's Second Law · Physics</p>
          <p className="text-xs text-surface-400 mt-1 leading-relaxed">
            Sage picked this because you scored 42% on Chemical Bonding yesterday. Physics today avoids burnout
            and matches your strongest morning focus window.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 ml-12">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-400 text-white text-xs font-medium transition-colors">
          <Play className="w-3 h-3" /> Start · 25 min
        </button>
        <button onClick={() => setDismissed(true)} className="text-xs text-surface-400 hover:text-surface-300 transition-colors">Not now</button>
      </div>
    </motion.div>
  );
}

// ExamReadinessScore
function ReadinessGauge({ score }: { score: number }) {
  const colorClass = score >= 70 ? 'text-green-400' : score >= 45 ? 'text-amber-400' : 'text-red-400';
  const ringClass  = score >= 70 ? 'stroke-green-500' : score >= 45 ? 'stroke-amber-500' : 'stroke-red-500';
  const circ = 2 * Math.PI * 30;
  return (
    <div className="relative w-20 h-20 flex-shrink-0">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r="30" fill="none" stroke="#27272a" strokeWidth="6" />
        <circle cx="36" cy="36" r="30" fill="none" strokeWidth="6" strokeLinecap="round"
          className={ringClass} strokeDasharray={`${(score / 100) * circ} ${circ}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={clsx('text-lg font-bold leading-none', colorClass)}>{score}</span>
        <span className="text-[9px] text-surface-500">/ 100</span>
      </div>
    </div>
  );
}

export function ExamReadinessScore() {
  const subjects = [{ name: 'Physics', score: 72 }, { name: 'Chemistry', score: 55 }, { name: 'Biology', score: 78 }];
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-accent-400" />
        <h2 className="font-semibold text-sm">Exam Readiness</h2>
      </div>
      <div className="flex items-center gap-4">
        <ReadinessGauge score={68} />
        <div className="flex-1">
          <p className="text-xs text-surface-400 mb-0.5">Sage predicts</p>
          <p className="font-bold text-base text-amber-300">~145/180 on NEET</p>
          <p className="text-xs text-surface-500 mt-1">at your current pace</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {subjects.map(s => (
          <div key={s.name} className="flex items-center gap-2">
            <span className="text-xs text-surface-400 w-16 flex-shrink-0">{s.name}</span>
            <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
              <div className={clsx('h-full rounded-full', s.score >= 70 ? 'bg-green-500' : s.score >= 45 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${s.score}%` }} />
            </div>
            <span className="text-xs font-medium w-7 text-right">{s.score}%</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// PeerActivity
export function PeerActivity() {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl bg-surface-800/50 border border-surface-700/50">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-semibold text-surface-300">Peer Activity</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-surface-400">
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
          <span>3 students also struggling with <strong className="text-surface-200">Newton's Laws</strong></span>
        </div>
        <div className="flex items-center gap-2 text-xs text-surface-400">
          <Trophy className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <span>Top in your batch: <strong className="text-surface-200">Arjun (92%)</strong></span>
        </div>
        <div className="flex items-center gap-2 text-xs text-surface-400">
          <Flame className="w-3 h-3 text-orange-400 flex-shrink-0" />
          <span>12 students are active right now</span>
        </div>
      </div>
    </motion.div>
  );
}

// SmartMemoryChip
const memoryItems = [
  { label: 'Exam target', value: 'NEET 2026 (160+ score)' },
  { label: 'Weak topics', value: 'Chemical Bonding, Trigonometry' },
  { label: 'Learning style', value: 'Visual learner, step-by-step' },
  { label: 'Streak', value: '12 days (best: 21)' },
];

export function SmartMemoryChip() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b border-surface-700/50">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-surface-800/50 transition-colors text-left">
        <span className="text-sm">🧠</span>
        <span className="text-xs font-medium text-surface-300">Sage remembers</span>
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary-500/15 text-primary-400 border border-primary-500/20 ml-1">last 5 sessions</span>
        <ChevronDown className={clsx('w-3.5 h-3.5 text-surface-500 ml-auto transition-transform', expanded && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <ul className="px-4 pb-3 space-y-1.5">
              {memoryItems.map(m => (
                <li key={m.label} className="flex items-start gap-2 text-xs">
                  <span className="text-primary-400 mt-0.5">·</span>
                  <span className="text-surface-400">{m.label}:</span>
                  <span className="text-surface-200 flex-1">{m.value}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// SmartNotifications
const nudges = [
  { id: 'n1', icon: '⏰', title: 'Physics gap detected', msg: "You haven't studied Physics in 3 days. Exam in 47 days. Sage suggests 25 mins tonight.", time: '2h ago', border: 'border-l-amber-500' },
  { id: 'n2', icon: '🔥', title: 'Streak at risk',       msg: 'Study 15 mins today to keep your 12-day streak alive!', time: '5h ago', border: 'border-l-orange-500' },
  { id: 'n3', icon: '🎯', title: 'Mock test due',         msg: "Your weekly NEET mock is tomorrow. Complete today's plan first.", time: '1d ago', border: 'border-l-blue-500' },
  { id: 'n4', icon: '📈', title: 'Progress milestone',   msg: "You're 70% done with Chemistry Unit 1. 30 more mins unlocks a badge!", time: '1d ago', border: 'border-l-green-500' },
];

export function SmartNotifications() {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<string[]>([]);
  const unread = nudges.filter(n => !read.includes(n.id)).length;
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="p-2 hover:bg-surface-800 rounded-lg transition-colors relative">
        <Sparkles className="w-5 h-5 text-primary-400" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">{unread}</span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 w-80 glass rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="p-4 border-b border-surface-700/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary-400" />
                  <h3 className="font-semibold text-sm">AI Nudges</h3>
                </div>
                {unread > 0 && <span className="text-xs bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded-full">{unread} new</span>}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {nudges.map(n => (
                  <div key={n.id} onClick={() => setRead(prev => [...prev, n.id])}
                    className={clsx('p-4 border-b border-surface-700/30 border-l-2 hover:bg-surface-800/50 cursor-pointer transition-colors', n.border, !read.includes(n.id) && 'bg-primary-500/3')}>
                    <div className="flex gap-3">
                      <span className="text-lg flex-shrink-0">{n.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs">{n.title}</p>
                        <p className="text-xs text-surface-400 mt-0.5 leading-relaxed">{n.msg}</p>
                        <p className="text-xs text-surface-600 mt-1">{n.time}</p>
                      </div>
                      {!read.includes(n.id) && <div className="w-2 h-2 rounded-full bg-primary-500 mt-1 flex-shrink-0" />}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════ ROLE 2: TEACHER ════════════════════════════

const triageItems = [
  { id: 't1', student: 'Priya Patel', avatar: 'P', urgency: 'high' as const,     action: 'Send encouragement',   reason: "Hasn't logged in 3 days before her exam." },
  { id: 't2', student: 'Sneha Gupta', avatar: 'S', urgency: 'critical' as const, action: 'Schedule 1:1 session', reason: 'Scored 38% on last mock. Trigonometry gap.' },
  { id: 't3', student: 'Rahul Kumar', avatar: 'R', urgency: 'low' as const,      action: 'Celebrate milestone',  reason: 'Hit 90%+ for 3 consecutive days!' },
];
const urgencyBadge: Record<string, string> = {
  critical: 'bg-red-500/15 border-red-500/30 text-red-400',
  high:     'bg-amber-500/15 border-amber-500/30 text-amber-400',
  medium:   'bg-blue-500/15 border-blue-500/30 text-blue-400',
  low:      'bg-green-500/15 border-green-500/30 text-green-400',
};

export function AITriagePanel() {
  const [done, setDone] = useState<string[]>([]);
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card border border-amber-500/20 bg-amber-500/5">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-amber-400" />
        <h2 className="font-semibold text-sm">Sage Triage · Top Actions</h2>
        <span className="text-xs text-surface-500 ml-auto">Updated 2 min ago</span>
      </div>
      <div className="space-y-3">
        {triageItems.map(item => (
          <AnimatePresence key={item.id}>
            {!done.includes(item.id) && (
              <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-3 p-3 rounded-xl bg-surface-800/60">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{item.avatar}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{item.student}</span>
                    <span className={clsx('text-[10px] px-1.5 py-0.5 rounded border', urgencyBadge[item.urgency])}>{item.urgency}</span>
                  </div>
                  <p className="text-xs text-surface-400 mt-0.5">{item.reason}</p>
                </div>
                <button onClick={() => setDone(prev => [...prev, item.id])}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-primary-500/15 hover:bg-primary-500/30 text-primary-400 transition-colors flex-shrink-0">
                  <Check className="w-3 h-3" /> {item.action}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
        {done.length === triageItems.length && <p className="text-center text-xs text-green-400 py-2">✅ All actions complete!</p>}
      </div>
    </motion.div>
  );
}

const mockMCQs = [
  { q: 'A 5 kg body acted on by 20 N net force has acceleration of:', diff: 'Easy', marks: 1 },
  { q: 'If mass doubles and force is constant, what happens to acceleration?', diff: 'Easy', marks: 1 },
  { q: 'Two perpendicular forces 3N and 4N. What is the resultant magnitude?', diff: 'Medium', marks: 2 },
  { q: '10 kg block on frictionless surface, 50 N applied. Find displacement in 4 s.', diff: 'Medium', marks: 2 },
  { q: "Derive the impulse-momentum theorem from Newton's 2nd law with one application.", diff: 'Hard', marks: 4 },
];

export function QuickQuestionGen() {
  const [topic, setTopic]         = useState('');
  const [questions, setQuestions] = useState<typeof mockMCQs>([]);
  const [loading, setLoading]     = useState(false);
  const [added, setAdded]         = useState(false);

  const generate = () => {
    if (!topic.trim()) return;
    setLoading(true); setAdded(false);
    setTimeout(() => { setQuestions(mockMCQs); setLoading(false); }, 1200);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card">
      <div className="flex items-center gap-2 mb-3">
        <Wand2 className="w-4 h-4 text-accent-400" />
        <h2 className="font-semibold text-sm">Quick Question Gen</h2>
      </div>
      <div className="flex gap-2 mb-3">
        <input type="text" value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()}
          placeholder="Topic (e.g. Newton's Laws)" className="input flex-1 text-xs py-2 px-3" />
        <button onClick={generate} disabled={loading || !topic.trim()}
          className="px-3 py-2 bg-primary-500 hover:bg-primary-400 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors">
          {loading ? '...' : 'Generate'}
        </button>
      </div>
      {questions.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          {questions.map((q, i) => (
            <div key={i} className="p-2.5 rounded-lg bg-surface-800/60 text-xs">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', q.diff === 'Easy' ? 'bg-green-500/15 text-green-400' : q.diff === 'Medium' ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400')}>{q.diff}</span>
                <span className="text-surface-500">{q.marks}m</span>
              </div>
              <p className="text-surface-300 leading-relaxed">{q.q}</p>
            </div>
          ))}
          <button onClick={() => setAdded(true)} className={clsx('w-full py-2 rounded-lg text-xs font-medium transition-colors mt-1', added ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-surface-700 hover:bg-surface-600 text-surface-200')}>
            {added ? '✅ Added to question bank' : '+ Add all to bank'}
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

export function TeachingEffectivenessCard() {
  const data = [
    { topic: 'Thermodynamics', gain: 18, confused: 0 },
    { topic: "Newton's Laws", gain: 12, confused: 3 },
    { topic: 'Organic Chemistry', gain: 9, confused: 1 },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-green-400" />
        <h2 className="font-semibold text-sm">Teaching Effectiveness</h2>
      </div>
      <div className="space-y-3">
        {data.map(item => (
          <div key={item.topic} className="p-2.5 rounded-xl bg-surface-800/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">{item.topic}</span>
              <span className="text-xs text-green-400 font-bold">+{item.gain}% avg</span>
            </div>
            <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(item.gain * 4, 100)}%` }} />
            </div>
            {item.confused > 0 && <p className="text-[10px] text-amber-400 mt-1">⚠ {item.confused} student{item.confused > 1 ? 's' : ''} still confused</p>}
          </div>
        ))}
      </div>
      <p className="text-xs text-surface-500 mt-3">Your Thermodynamics lesson improved class avg by 18% 🎉</p>
    </motion.div>
  );
}

// ═══════════════════════════ ROLE 3: MANAGER ════════════════════════════

export function NexusUrgencyScore({ score, reason }: { score: number; reason: string }) {
  const colorCls = score >= 80 ? 'text-red-400 border-red-500/30 bg-red-500/10' : score >= 50 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-green-400 border-green-500/30 bg-green-500/10';
  return (
    <div className="group relative inline-flex">
      <span className={clsx('inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-bold cursor-help', colorCls)}>
        <Cpu className="w-3 h-3" />{score}
      </span>
      <div className="absolute bottom-full left-0 mb-1.5 w-52 px-2.5 py-2 rounded-lg bg-surface-900 border border-surface-700 text-xs text-surface-300 shadow-xl z-10 hidden group-hover:block pointer-events-none">
        <p className="font-semibold text-white mb-1">Nexus Urgency Score</p>
        <p>{reason}</p>
      </div>
    </div>
  );
}

export function AIMessageDraft({ studentName, exam, riskReason, onUseDraft }:
  { studentName: string; exam: string; riskReason?: string; onUseDraft: (t: string) => void }) {
  const [draft, setDraft]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [showDraft, setShowDraft] = useState(false);

  const generate = () => {
    setLoading(true); setShowDraft(false);
    setTimeout(() => {
      const d = `Hi ${studentName}! We noticed you haven't been active recently, and your ${exam} is approaching. ${riskReason ? riskReason + ' ' : ''}Open the app for just 20 minutes — Sage has a personalised plan ready. You've got this!`;
      setDraft(d); setLoading(false); setShowDraft(true);
    }, 900);
  };

  return (
    <div className="mt-3">
      {!showDraft ? (
        <button onClick={generate} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-medium transition-colors">
          <Brain className="w-3.5 h-3.5" />
          {loading ? 'Nexus drafting...' : '✨ AI Draft Message'}
        </button>
      ) : (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3}
            className="w-full px-3 py-2 text-xs border border-purple-500/30 rounded-lg bg-purple-500/5 text-surface-200 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
          <div className="flex gap-2">
            <button onClick={() => { onUseDraft(draft); setShowDraft(false); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-xs font-medium transition-colors">
              <Send className="w-3 h-3" /> Use Draft
            </button>
            <button onClick={() => setShowDraft(false)} className="text-xs text-surface-500 hover:text-surface-300 transition-colors px-2">Discard</button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

const tlEvents = [
  { date: 'Sep 2025', event: 'Joined platform', type: 'join' },
  { date: 'Sep 2025', event: 'First session (Maths)', type: 'session' },
  { date: 'Oct 2025', event: '21-day streak milestone', type: 'milestone' },
  { date: 'Nov 2025', event: 'Mock score: 72%', type: 'score' },
  { date: 'Dec 2025', event: 'Ticket: AI explanation unclear', type: 'ticket' },
  { date: 'Jan 2026', event: 'At-risk alert sent', type: 'outreach' },
  { date: 'Feb 2026', event: 'Reactivated — streak resumed', type: 'session' },
];
const tlColor: Record<string, string> = {
  join: 'bg-green-500', session: 'bg-blue-500', milestone: 'bg-amber-500',
  score: 'bg-purple-500', ticket: 'bg-red-500', outreach: 'bg-orange-500',
};

export function StudentTimelineDrawer({ studentName, onClose }: { studentName: string; onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        className="fixed right-0 top-0 h-full w-80 bg-surface-900 border-l border-surface-700 z-50 flex flex-col shadow-2xl">
        <div className="p-4 border-b border-surface-700 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">{studentName}</h3>
            <p className="text-xs text-surface-400">Full journey timeline</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-800 rounded-lg transition-colors">
            <X className="w-4 h-4 text-surface-400" />
          </button>
        </div>
        <div className="p-4 bg-purple-500/5 border-b border-surface-700">
          <p className="text-xs font-semibold text-purple-400 mb-1">Nexus AI Summary</p>
          <p className="text-xs text-surface-300 leading-relaxed">
            Student shows consistent engagement dips every 6-8 weeks. Reactivation success rate is 80% when outreach is sent within 48h of inactivity.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4 relative before:absolute before:left-3 before:top-0 before:bottom-0 before:w-0.5 before:bg-surface-700">
            {tlEvents.map((ev, i) => (
              <div key={i} className="flex items-start gap-3 relative">
                <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center z-10 ${tlColor[ev.type] || 'bg-surface-600'}`}>
                  <span className="text-white text-[8px] font-bold">{ev.date.slice(0,3)}</span>
                </div>
                <div>
                  <p className="text-xs font-medium">{ev.event}</p>
                  <p className="text-[10px] text-surface-500">{ev.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

const campaignROI = [
  { type: 'At-Risk Alert',      sent: 120, opened: 98,  responded: 45, converted: 41, rate: 34 },
  { type: 'Churn Rescue',       sent: 60,  opened: 42,  responded: 18, converted: 12, rate: 20 },
  { type: 'Exam Countdown',     sent: 200, opened: 180, responded: 60, converted: 55, rate: 28 },
  { type: 'Subscription Expiry',sent: 80,  opened: 70,  responded: 30, converted: 22, rate: 28 },
];

export function CampaignROICard() {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-blue-400" />
        <h2 className="font-semibold text-sm text-gray-900 dark:text-white">Campaign ROI</h2>
      </div>
      <div className="space-y-3">
        {campaignROI.map(c => (
          <div key={c.type} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-900 dark:text-white">{c.type}</span>
              <span className="text-xs font-bold text-green-600 dark:text-green-400">{c.rate}% reactivation</span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-center">
              {[['Sent', c.sent], ['Opened', c.opened], ['Replied', c.responded], ['Converted', c.converted]].map(([label, val]) => (
                <div key={String(label)} className="p-1 rounded bg-white dark:bg-gray-800">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{label}</p>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">{val}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
        <Lightbulb className="w-3 h-3 inline mr-1" />
        At-Risk alerts have 34% reactivation — best performer this week
      </p>
    </motion.div>
  );
}

const lifecycleRules = [
  { trigger: 'Student inactive', days: 3, channel: 'WhatsApp', agent: 'Nexus', enabled: true },
  { trigger: 'Exam approaching', days: 7, channel: 'In-App',   agent: 'Sage',  enabled: true },
  { trigger: 'Plan expiring',    days: 5, channel: 'Email',    agent: 'Nexus', enabled: false },
  { trigger: 'Mock score < 40%', days: 0, channel: 'WhatsApp', agent: 'Nexus', enabled: true },
];

export function SmartRuleWizard() {
  const [rules, setRules] = useState(lifecycleRules);
  const toggle = (i: number) => setRules(prev => prev.map((r, idx) => idx === i ? { ...r, enabled: !r.enabled } : r));
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-indigo-400" />
        <h2 className="font-semibold text-sm text-gray-900 dark:text-white">Smart Rule Wizard</h2>
      </div>
      <div className="space-y-3">
        {rules.map((r, i) => (
          <div key={i} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 flex items-start gap-3">
            <button onClick={() => toggle(i)} className={clsx('w-9 h-5 rounded-full relative transition-colors flex-shrink-0 mt-0.5', r.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600')}>
              <span className={clsx('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all', r.enabled ? 'left-4' : 'left-0.5')} />
            </button>
            <p className="text-xs text-gray-700 dark:text-gray-300">
              When a student <strong>{r.trigger.toLowerCase()}</strong>
              {r.days > 0 ? <> for <strong>{r.days} days</strong></> : null}
              , send <strong>{r.channel}</strong> via <strong>{r.agent}</strong>.
              {' '}<span className={clsx('font-semibold', r.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400')}>
                Currently: {r.enabled ? 'ON' : 'OFF'}
              </span>
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════ ROLE 4: ADMIN ═════════════════════════════

const healthMetrics = [
  { label: 'API Latency',      value: 42,  unit: 'ms',    max: 200, color: 'bg-green-500' },
  { label: 'DB Connections',   value: 23,  unit: '/ 100', max: 100, color: 'bg-blue-500' },
  { label: 'Agent Queue',      value: 7,   unit: 'tasks', max: 50,  color: 'bg-amber-500' },
  { label: 'Error Rate',       value: 0.4, unit: '%',     max: 5,   color: 'bg-green-500' },
];

export function LiveHealthPanel() {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-green-400" />
          <h2 className="font-semibold text-sm">Live Health Panel</h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-green-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Last 1h: 99.2% uptime
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {healthMetrics.map(m => {
          const pct = Math.min((m.value / m.max) * 100, 100);
          const statusColor = pct < 50 ? 'text-green-400' : pct < 80 ? 'text-amber-400' : 'text-red-400';
          return (
            <div key={m.label} className="p-3 rounded-xl bg-surface-800/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-surface-400">{m.label}</span>
                <span className={clsx('text-xs font-bold', statusColor)}>{m.value}{m.unit}</span>
              </div>
              <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1 }}
                  className={clsx('h-full rounded-full', m.color)} />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

const funnelSteps = [
  { label: 'Registered',       count: 3247, pct: 100 },
  { label: 'Email Verified',   count: 2980, pct: 92 },
  { label: 'Profile Complete', count: 1038, pct: 32 },
  { label: 'First Session',    count: 820,  pct: 25 },
  { label: 'Paid Conversion',  count: 410,  pct: 13 },
];

export function OnboardingFunnelCard() {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-primary-400" />
        <h2 className="font-semibold text-sm">Onboarding Funnel</h2>
      </div>
      <div className="space-y-2">
        {funnelSteps.map((step, i) => (
          <div key={step.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-surface-400">{step.label}</span>
              <span className="text-xs font-medium">{step.count.toLocaleString()} ({step.pct}%)</span>
            </div>
            <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${step.pct}%` }} transition={{ delay: i * 0.1, duration: 0.8 }}
                className="h-full rounded-full bg-primary-500" />
            </div>
            {i < funnelSteps.length - 1 && (
              <p className="text-[10px] text-red-400 mt-0.5">
                -{(funnelSteps[i].pct - funnelSteps[i + 1].pct)}% drop-off
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-amber-400 mt-3">
        <Brain className="w-3 h-3 inline mr-1" />
        AI Insight: 68% drop at profile completion — suggest reducing required fields
      </p>
    </motion.div>
  );
}

const qualityGrid = [
  ['Physics',     ['72/A', '58/B', '31/C']],
  ['Chemistry',   ['80/A', '45/B', '22/C']],
  ['Biology',     ['65/A', '71/B', '38/C']],
  ['Mathematics', ['90/A', '60/B', '12/C']],
] as const;

export function ContentQualityHeatmap() {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-orange-400" />
        <h2 className="font-semibold text-sm">Content Quality Heatmap</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left pb-2 text-surface-400 font-normal">Subject</th>
              {['Easy', 'Medium', 'Hard'].map(d => (
                <th key={d} className="text-center pb-2 text-surface-400 font-normal">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody className="space-y-1">
            {qualityGrid.map(([subject, cells]) => (
              <tr key={subject}>
                <td className="py-1.5 pr-3 font-medium text-surface-300">{subject}</td>
                {cells.map(cell => {
                  const [count, grade] = cell.split('/');
                  const bg = grade === 'A' ? 'bg-green-500/20 text-green-400' : grade === 'B' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400';
                  return (
                    <td key={cell} className="py-1.5 px-1 text-center">
                      <span className={clsx('inline-block px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity text-[10px] font-medium', bg)}>
                        {count}q
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-surface-500 mt-2">Red cells need review. Click to drill down.</p>
    </motion.div>
  );
}

const quickUserActions = [
  { label: 'Unverified users', count: 14, action: 'Verify all', color: 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20' },
  { label: 'Inactive 30d',     count: 89, action: 'Nudge all',  color: 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20' },
  { label: 'Trial expiring',   count: 23, action: 'Outreach',   color: 'text-green-400 bg-green-500/10 hover:bg-green-500/20' },
];

export function QuickUserActions() {
  const [done, setDone] = useState<number[]>([]);
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-primary-400" />
        <h2 className="font-semibold text-sm">Quick User Actions</h2>
      </div>
      <div className="space-y-2">
        {quickUserActions.map((item, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-surface-800/50">
            <div>
              <p className="text-xs font-medium">{item.label}</p>
              <p className="text-lg font-bold mt-0.5">{item.count}</p>
            </div>
            <button onClick={() => setDone(prev => [...prev, i])} disabled={done.includes(i)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', done.includes(i) ? 'bg-green-500/10 text-green-400' : item.color)}>
              {done.includes(i) ? '✅ Done' : item.action}
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

const alertsData = [
  { id: 'a1', severity: 'critical', msg: 'High server load detected (CPU 89%)', suggestion: 'Scale Atlas worker count from 2 to 4.', icon: '🔴' },
  { id: 'a2', severity: 'warning',  msg: 'API latency spike on /chat endpoint (320ms)', suggestion: 'Check Redis connection pool — likely saturated.', icon: '🟡' },
  { id: 'a3', severity: 'info',     msg: 'Daily backup completed successfully', suggestion: 'No action needed.', icon: '🟢' },
];

export function ActionableAlerts() {
  const [fixed, setFixed] = useState<string[]>([]);
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-4 h-4 text-primary-400" />
        <h2 className="font-semibold">System Alerts</h2>
      </div>
      <div className="space-y-3">
        {alertsData.filter(a => !fixed.includes(a.id)).map(alert => (
          <div key={alert.id} className={clsx('p-3 rounded-xl', alert.severity === 'critical' ? 'bg-red-500/10 border border-red-500/20' : alert.severity === 'warning' ? 'bg-yellow-500/10' : 'bg-green-500/10')}>
            <div className="flex items-start gap-2 mb-2">
              <span className="text-base">{alert.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{alert.msg}</p>
                <p className="text-xs text-surface-400 mt-0.5">
                  <Brain className="w-3 h-3 inline mr-1 text-primary-400" />
                  {alert.suggestion}
                </p>
              </div>
            </div>
            {alert.severity !== 'info' && (
              <button onClick={() => setFixed(prev => [...prev, alert.id])}
                className="text-xs px-2.5 py-1 rounded-lg bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 transition-colors">
                Auto-fix
              </button>
            )}
          </div>
        ))}
        {fixed.length > 0 && <p className="text-xs text-green-400 text-center py-1">✅ {fixed.length} issue{fixed.length > 1 ? 's' : ''} auto-fixed</p>}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════ ROLE 5: CEO ═══════════════════════════════

const agentROIData = [
  { name: 'Sage',   emoji: '🎓', tasks: 1420, hours: 340, revenue: '₹1.2L', cost: '₹890',  roi: '134x' },
  { name: 'Atlas',  emoji: '📚', tasks: 890,  hours: 120, revenue: '₹60K',  cost: '₹320',  roi: '187x' },
  { name: 'Herald', emoji: '📢', tasks: 240,  hours: 48,  revenue: '₹35K',  cost: '₹180',  roi: '194x' },
  { name: 'Oracle', emoji: '📊', tasks: 310,  hours: 75,  revenue: '₹28K',  cost: '₹210',  roi: '133x' },
  { name: 'Scout',  emoji: '🔍', tasks: 145,  hours: 30,  revenue: '₹18K',  cost: '₹95',   roi: '189x' },
];

export function AgentROIPanel() {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-4 h-4 text-green-400" />
        <h2 className="font-semibold">Agent ROI Panel</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-surface-400 font-normal border-b border-surface-700">
              {['Agent', 'Tasks', 'Hours Saved', 'Revenue', 'Cost', 'ROI'].map(h => (
                <th key={h} className="text-left pb-2 pr-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agentROIData.map(a => (
              <tr key={a.name} className="border-b border-surface-800 hover:bg-surface-800/30 transition-colors">
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{a.emoji}</span>
                    <span className="font-medium">{a.name}</span>
                  </div>
                </td>
                <td className="py-2.5 pr-3">{a.tasks.toLocaleString()}</td>
                <td className="py-2.5 pr-3">{a.hours}h</td>
                <td className="py-2.5 pr-3 text-green-400 font-medium">{a.revenue}</td>
                <td className="py-2.5 pr-3 text-red-400">{a.cost}</td>
                <td className="py-2.5">
                  <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-bold">{a.roi}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

const revenueNarrative = [
  { dir: 'up',   text: 'Revenue up 12% — JEE Main cohort activated (82 new students enrolled this week).' },
  { dir: 'down', text: '3 cancellations — all cited "too expensive". Price sensitivity flagged by Oracle.' },
  { dir: 'right', text: "Suggestion: A/B test a ₹399 mid-tier plan targeting trial users who didn't convert." },
];

export function AIRevenueNarrative() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card border border-primary-500/20 bg-primary-500/5">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-primary-400" />
        <h3 className="font-semibold text-sm">Oracle Revenue Narrative · Today</h3>
      </div>
      <div className="space-y-2">
        {revenueNarrative.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5 text-sm">
            <span className="flex-shrink-0 text-base">{item.dir === 'up' ? '↑' : item.dir === 'down' ? '↓' : '→'}</span>
            <p className={clsx('text-xs leading-relaxed',
              item.dir === 'up' ? 'text-green-300' : item.dir === 'down' ? 'text-red-300' : 'text-primary-300')}>
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

const radarExams = [
  { name: 'GATE',  demand: 88, gap: 82, readiness: 75, revenue: 90, score: 89, rec: true },
  { name: 'CAT',   demand: 75, gap: 60, readiness: 55, revenue: 80, score: 68, rec: false },
  { name: 'UPSC',  demand: 70, gap: 50, readiness: 40, revenue: 65, score: 56, rec: false },
  { name: 'CLAT',  demand: 55, gap: 70, readiness: 60, revenue: 55, score: 60, rec: false },
];

export function ExamOpportunityRadar() {
  const dims = ['Demand', 'Gap', 'Readiness', 'Revenue'];
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card">
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-4 h-4 text-accent-400" />
        <h2 className="font-semibold">Exam Opportunity Radar</h2>
      </div>
      <div className="space-y-4">
        {radarExams.map(exam => (
          <div key={exam.name} className="p-3 rounded-xl bg-surface-800/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{exam.name}</span>
                {exam.rec && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-500/20 text-primary-400 border border-primary-500/30">Scout recommends</span>}
              </div>
              <span className={clsx('font-bold text-sm', exam.score >= 80 ? 'text-green-400' : exam.score >= 60 ? 'text-amber-400' : 'text-red-400')}>
                {exam.score} / 100
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {dims.map((dim, i) => {
                const val = [exam.demand, exam.gap, exam.readiness, exam.revenue][i];
                return (
                  <div key={dim} className="text-center">
                    <p className="text-[9px] text-surface-500 mb-1">{dim}</p>
                    <div className="h-12 bg-surface-700 rounded-sm overflow-hidden flex flex-col-reverse">
                      <motion.div initial={{ height: 0 }} animate={{ height: `${val}%` }} transition={{ delay: 0.2 }}
                        className={clsx('rounded-sm', val >= 70 ? 'bg-primary-500' : val >= 50 ? 'bg-amber-500' : 'bg-red-500')} />
                    </div>
                    <p className="text-[9px] mt-1 font-medium">{val}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-primary-400 mt-3 font-medium">
        🎯 Scout recommendation: Launch GATE next — 89/100 composite score
      </p>
    </motion.div>
  );
}

const opsDigestData = [
  { agent: 'Atlas',  emoji: '📚', summary: '23 questions created, 2 syllabus updates' },
  { agent: 'Sage',   emoji: '🎓', summary: '142 student sessions, 98% satisfaction' },
  { agent: 'Herald', emoji: '📢', summary: '1 blog published, 3 social posts scheduled' },
  { agent: 'Oracle', emoji: '📊', summary: '3 insights flagged, 1 revenue anomaly detected' },
  { agent: 'Scout',  emoji: '🔍', summary: '2 competitor moves tracked, 1 opportunity found' },
];

export function DailyOpsDigest() {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-accent-400" />
        <h3 className="font-semibold text-sm">Yesterday's Agent Activity</h3>
      </div>
      <div className="space-y-2">
        {opsDigestData.map(item => (
          <div key={item.agent} className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-800/50">
            <span className="text-xl flex-shrink-0">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">{item.agent}</p>
              <p className="text-xs text-surface-400 truncate">{item.summary}</p>
            </div>
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

const competitorUpdates = [
  { name: "Byju's",       update: "Dropped price to ₹499 (was ₹799)", icon: '📉', color: 'text-red-400' },
  { name: 'Unacademy',    update: 'Launched GATE prep course',         icon: '🚀', color: 'text-amber-400' },
  { name: 'EduGenius',    update: 'AI personalization score: 4.8/5',   icon: '⭐', color: 'text-green-400' },
  { name: 'PhysicsWallah', update: 'New free tier announced',          icon: '📢', color: 'text-blue-400' },
];

export function CompetitorPulse() {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card border border-surface-600/30">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-orange-400" />
        <h3 className="font-semibold text-sm">Competitor Pulse</h3>
        <span className="text-xs text-surface-500 ml-auto">Scout · 3h ago</span>
      </div>
      <div className="space-y-2.5">
        {competitorUpdates.map(item => (
          <div key={item.name} className="flex items-start gap-2.5">
            <span className="text-base flex-shrink-0">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <span className={clsx('text-xs font-semibold', item.color)}>{item.name}: </span>
              <span className="text-xs text-surface-300">{item.update}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-surface-500 mt-3 pt-3 border-t border-surface-700/50">
        Your differentiation: AI personalization score 4.8/5 — highest in segment
      </p>
    </motion.div>
  );
}
