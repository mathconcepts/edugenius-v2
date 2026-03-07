/**
 * StudentDashboard — Premium redesign
 * Zone A: Hero gradient with greeting + exam ring + streak
 * Zone B: Today's Mission — ONE prominent next task
 * Zone C: Quick action pills (glassmorphism)
 * + Floating quick-ask bar (mobile)
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Flame, Target, Trophy, Play, CheckCircle2, Sparkles,
  BarChart3, Send, ArrowRight, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { clsx } from 'clsx';
import { AIStudyCoach, ExamReadinessScore, PeerActivity } from '@/components/ux/UXEnhancements';
import { WhatsAppOptInModal } from '@/components/WhatsAppOptInModal';
import { hasWhatsAppOptIn, shouldShowWhatsAppPrompt } from '@/services/whatsappOptIn';
// Wire 5 — P1: Notebook Engine + Persona Engine for dynamic todayPlan
import { loadPersona } from '@/services/studentPersonaEngine';
import { loadNotebookState, getDueRevisions, type ExamScope } from '@/services/notebookEngine';

// ── Dynamic today plan from persona + notebook (P1 Wire 5) ─────────────────

function buildTodayPlan(
  persona: ReturnType<typeof loadPersona>,
  notebookState: ReturnType<typeof loadNotebookState>,
) {
  // Map persona exam type to notebook ExamScope
  const examMap: Record<string, ExamScope> = {
    JEE_MAIN: 'JEE Main', JEE_ADVANCED: 'JEE Adv', NEET: 'NEET',
    CBSE_12: 'CBSE 12', CAT: 'CAT', UPSC: 'UPSC', GATE: 'GATE',
  };
  const examScope: ExamScope = examMap[persona.exam] ?? 'JEE Main';
  const dueRevisions = getDueRevisions(notebookState);

  // Build plan items from due revisions (up to 2) + weak subjects
  const plan: { id: string; title: string; subject: string; duration: string; done: boolean }[] = [];

  // Add due revisions first
  dueRevisions.slice(0, 2).forEach((rev, i) => {
    plan.push({
      id: `rev-${rev.topicId}-${i}`,
      title: `Revise: ${rev.topicId.replace(/-/g, ' ').replace(/^\w+-\w+-/, '')}`,
      subject: 'Revision',
      duration: '20 min',
      done: false,
    });
  });

  // Add weak subjects as topics if plan has room
  if (plan.length < 2 && persona.weakSubjects.length > 0) {
    persona.weakSubjects.slice(0, 2 - plan.length).forEach((subj, i) => {
      plan.push({
        id: `weak-${i}`,
        title: `Strengthen: ${subj}`,
        subject: subj.split(' ')[0],
        duration: '25 min',
        done: false,
      });
    });
  }

  // Always add a daily practice task
  plan.push({ id: 'practice', title: 'Daily Practice (10 MCQs)', subject: 'Mixed', duration: '15 min', done: false });

  // Fallback if nothing from revisions/weak subjects
  if (plan.length === 1) {
    const fallbacks = [
      { id: 'f1', title: `${examScope} Core Revision`, subject: 'Mixed', duration: '20 min', done: false },
      { id: 'f2', title: 'Formula Quick Review', subject: 'Mixed', duration: '10 min', done: false },
    ];
    plan.unshift(...fallbacks);
  }

  return plan.slice(0, 3);
}

// ── Dynamic exam countdown from persona ──────────────────────────────────────

function buildExamCountdown(persona: ReturnType<typeof loadPersona>) {
  const examLabels: Record<string, string> = {
    JEE_MAIN: 'JEE Main', JEE_ADVANCED: 'JEE Advanced', NEET: 'NEET',
    CBSE_12: 'CBSE 12', CAT: 'CAT', UPSC: 'UPSC', GATE: 'GATE',
  };
  return {
    exam: examLabels[persona.exam] ?? 'Exam',
    daysLeft: persona.daysToExam ?? 47,
  };
}

// ── Confetti Burst ──────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

function ConfettiBurst({ active }: { active: boolean }) {
  const pieces = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    key: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${10 + Math.random() * 80}%`,
    delay: `${Math.random() * 0.3}s`,
    size: `${5 + Math.random() * 6}px`,
    rotate: `${Math.random() * 360}deg`,
  })), []);

  if (!active) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-20">
      {pieces.map(p => (
        <span key={p.key} style={{
          position: 'absolute', bottom: '10%', left: p.left,
          width: p.size, height: p.size, backgroundColor: p.color,
          borderRadius: '2px', transform: `rotate(${p.rotate})`,
          animation: `confettiFly 0.8s ease-out ${p.delay} forwards`,
        }} />
      ))}
      <style>{`@keyframes confettiFly{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(-80px) rotate(360deg);opacity:0}}`}</style>
    </div>
  );
}

// ── Time-of-day greeting ─────────────────────────────────────────────────────

function getGreeting(): { text: string; emoji: string } {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good morning', emoji: '☀️' };
  if (h < 17) return { text: 'Good afternoon', emoji: '🌤️' };
  if (h < 21) return { text: 'Good evening', emoji: '🌆' };
  return { text: 'Late night crunch', emoji: '🌙' };
}

// ── Exam urgency ring SVG ────────────────────────────────────────────────────

function ExamRing({ daysLeft, exam }: { daysLeft: number; exam: string }) {
  const total = 90;
  const pct = Math.max(0, Math.min(1, (total - daysLeft) / total));
  const r = 30;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke={daysLeft < 15 ? '#ef4444' : daysLeft < 30 ? '#f59e0b' : '#38bdf8'}
            strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black text-white leading-none">{daysLeft}</span>
          <span className="text-[9px] text-white/60 leading-none">days</span>
        </div>
      </div>
      <span className="text-xs font-semibold text-white/80">{exam}</span>
    </div>
  );
}

// ── Week bar ─────────────────────────────────────────────────────────────────

function WeekBar({ data }: { data: number[] }) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;

  return (
    <div className="flex items-end gap-1.5">
      {data.map((pct, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className="w-6 bg-surface-800 rounded-sm overflow-hidden" style={{ height: 32 }}>
            <div
              className={clsx('w-full rounded-sm transition-all', i === todayIdx ? 'bg-primary-500' : pct > 0 ? 'bg-primary-500/40' : 'bg-surface-700')}
              style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
            />
          </div>
          <span className={clsx('text-[10px]', i === todayIdx ? 'text-primary-400 font-bold' : 'text-surface-600')}>{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Progress arc for mission card ────────────────────────────────────────────

function ProgressArc({ pct }: { pct: number }) {
  const r = 18; const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="w-11 h-11 -rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
      <circle cx="22" cy="22" r={r} fill="none" stroke="#38bdf8" strokeWidth="4"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function StudentDashboard() {
  const navigate = useNavigate();
  const [streak, setStreak] = useState<number>(() => {
    const stored = localStorage.getItem('edugenius_streak');
    return stored ? parseInt(stored, 10) : 12;
  });
  const [doubtInput, setDoubtInput] = useState('');
  const [celebrating, setCelebrating] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showFullPlan, setShowFullPlan] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [showWABanner, setShowWABanner] = useState(() => shouldShowWhatsAppPrompt());
  const [showWAModal, setShowWAModal] = useState(false);

  const handleDismissWABanner = () => {
    setShowWABanner(false);
    import('@/services/whatsappOptIn').then(m => m.saveWhatsAppSkip());
  };

  // Wire 5 — P1: Dynamic today plan from persona + notebook engine
  const [todayPlan, setTodayPlan] = useState<ReturnType<typeof buildTodayPlan>>([]);
  const [examCountdown, setExamCountdown] = useState<ReturnType<typeof buildExamCountdown>>({ exam: 'JEE Main', daysLeft: 47 });
  const [weekProgress] = useState<number[]>([40, 65, 50, 80, 70, 30, 60]);

  useEffect(() => {
    const persona = loadPersona();
    const examMap: Record<string, ExamScope> = {
      JEE_MAIN: 'JEE Main', JEE_ADVANCED: 'JEE Adv', NEET: 'NEET',
      CBSE_12: 'CBSE 12', CAT: 'CAT', UPSC: 'UPSC', GATE: 'GATE',
    };
    const examScope: ExamScope = examMap[persona.exam] ?? 'JEE Main';
    const notebookState = loadNotebookState(examScope);
    setTodayPlan(buildTodayPlan(persona, notebookState));
    setExamCountdown(buildExamCountdown(persona));
    // Sync streak from persona if persona has more accurate count
    if (persona.streakDays > 0) {
      setStreak(persona.streakDays);
    }
  }, []);

  const doneTasks = todayPlan.filter(t => t.done).length;
  const totalTasks = Math.max(todayPlan.length, 1);
  const todayPct = Math.round((doneTasks / totalTasks) * 100);
  const firstIncompleteTask = todayPlan.find(t => !t.done);

  useEffect(() => {
    if (celebrating) {
      const t = setTimeout(() => setCelebrating(null), 1500);
      return () => clearTimeout(t);
    }
  }, [celebrating]);

  useEffect(() => {
    if (showConfetti) {
      const t = setTimeout(() => setShowConfetti(false), 900);
      return () => clearTimeout(t);
    }
  }, [showConfetti]);

  const handleDoubtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = doubtInput.trim();
    if (!q) return;
    navigate(`/chat?q=${encodeURIComponent(q)}`);
  };

  const handleTaskPlay = (taskId: string) => {
    setCelebrating(taskId);
    const newStreak = streak + 1;
    setStreak(newStreak);
    localStorage.setItem('edugenius_streak', String(newStreak));
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 900);
    setTimeout(() => navigate('/learn'), 600);
  };

  const greeting = getGreeting();

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-24 md:pb-8">

      {/* ── WhatsApp banner ── */}
      {showWABanner && !hasWhatsAppOptIn() && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#25D366]/10 border border-[#25D366]/30"
        >
          <button
            onClick={() => setShowWAModal(true)}
            className="flex items-center gap-2 text-sm text-[#25D366] font-medium hover:opacity-80 transition-opacity"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.1 21.9l4.863-1.274A9.947 9.947 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" fill="#25D366"/>
              <path d="M17.006 14.547c-.274-.137-1.62-.8-1.871-.89-.252-.092-.435-.137-.617.137-.183.274-.708.891-.868 1.074-.16.183-.32.206-.594.069-.274-.137-1.157-.426-2.203-1.36-.815-.726-1.364-1.622-1.524-1.896-.16-.274-.017-.422.12-.559.124-.123.274-.32.411-.48.137-.16.183-.274.274-.457.092-.183.046-.343-.023-.48-.069-.137-.617-1.487-.845-2.036-.222-.534-.449-.462-.617-.47L8 7.998c-.16 0-.411.069-.627.32-.217.252-.823.805-.823 1.963 0 1.158.845 2.277.962 2.437.117.16 1.655 2.535 4.014 3.555.56.242 1 .387 1.34.495.563.179 1.076.154 1.48.093.452-.068 1.391-.568 1.588-1.118.196-.549.196-1.018.137-1.117-.058-.1-.24-.16-.514-.297z" fill="#fff"/>
            </svg>
            📲 Get your progress on WhatsApp →
          </button>
          <button onClick={handleDismissWABanner} className="p-1 rounded-lg hover:bg-surface-700 text-surface-400 hover:text-white flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
      {showWAModal && (
        <WhatsAppOptInModal exam="JEE Main" source="post_session" onClose={() => { setShowWAModal(false); setShowWABanner(false); }} />
      )}

      {/* ────────────────────────────────────────
          ZONE A — Hero Header (animated gradient)
          ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="hero-gradient rounded-2xl px-5 py-6 md:py-8 relative overflow-hidden"
        style={{ minHeight: 160 }}
      >
        {/* Subtle overlay */}
        <div className="absolute inset-0 bg-black/20 rounded-2xl" />

        <div className="relative z-10 flex items-start justify-between gap-4">
          {/* Left: greeting + streak */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{greeting.emoji}</span>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight">
                {greeting.text}, Arjun!
              </h1>
            </div>
            <p className="text-white/70 text-sm mb-4">Let's make today count → {doneTasks}/{totalTasks} tasks done</p>

            {/* Streak pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full">
              <Flame className="w-4 h-4 text-orange-300" />
              <span className="text-sm font-bold text-white">{streak} day streak</span>
              <span className="text-white/50 text-xs">🔥</span>
            </div>
          </div>

          {/* Right: exam countdown ring */}
          <div className="flex-shrink-0">
            <ExamRing daysLeft={examCountdown.daysLeft} exam={examCountdown.exam} />
          </div>
        </div>
      </motion.div>

      {/* ── AI Study Coach ── */}
      <AIStudyCoach />

      {/* ────────────────────────────────────────
          ZONE B — Today's Mission (single next task)
          ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        {firstIncompleteTask ? (
          <div
            className="relative rounded-2xl overflow-hidden cursor-pointer group border border-primary-500/30 bg-gradient-to-br from-surface-900 to-surface-800 hover:border-primary-500/50 transition-all"
            onClick={() => handleTaskPlay(firstIncompleteTask.id)}
          >
            <ConfettiBurst active={celebrating === firstIncompleteTask.id && showConfetti} />

            {/* Left accent bar */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-500 to-accent-500 rounded-l-2xl" />

            <div className="px-6 py-5 pl-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary-400 mb-1">Your Next Task →</p>
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-1">{firstIncompleteTask.title}</h2>
                  <p className="text-surface-400 text-sm">{firstIncompleteTask.subject} · {firstIncompleteTask.duration}</p>
                </div>
                {/* Arc + play */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="relative">
                    <ProgressArc pct={todayPct} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary-400">{todayPct}%</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary-500 group-hover:bg-primary-400 flex items-center justify-center transition-colors shadow-lg shadow-primary-500/30">
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Pulsing ring on CTA */}
              <div className="mt-4 flex items-center gap-2">
                <div className="relative flex items-center">
                  <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-primary-400 animate-ping opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-500" />
                </div>
                <span className="text-xs font-semibold text-primary-300 group-hover:text-primary-200 transition-colors">
                  Tap to start · {todayPlan.filter(t => !t.done).length} tasks left today
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* All done state */
          <div className="rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 p-6 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <h2 className="text-xl font-bold text-green-300">All tasks done for today!</h2>
            <p className="text-surface-400 text-sm mt-1">Incredible focus. Your streak is safe — great work!</p>
          </div>
        )}

        {/* See full plan toggle */}
        <button
          onClick={() => setShowFullPlan(p => !p)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 text-xs text-surface-500 hover:text-surface-300 transition-colors"
        >
          {showFullPlan ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showFullPlan ? 'Hide full plan' : 'See full plan'}
        </button>

        <AnimatePresence>
          {showFullPlan && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="card space-y-2.5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary-400" />
                    <h3 className="font-semibold text-sm">Full Today's Plan</h3>
                  </div>
                  <span className="text-xs text-surface-500">{doneTasks}/{totalTasks} done</span>
                </div>
                <div className="h-1.5 bg-surface-700 rounded-full mb-3 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full" style={{ width: `${todayPct}%` }} />
                </div>
                {todayPlan.map(task => {
                  const isFirst = !task.done && task.id === firstIncompleteTask?.id;
                  return (
                    <div key={task.id} className={clsx(
                      'flex items-center gap-3 p-2.5 rounded-xl transition-colors relative',
                      task.done ? 'opacity-50' : 'hover:bg-surface-800/60 cursor-pointer'
                    )}>
                      <div className={clsx(
                        'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                        task.done ? 'bg-green-500' : 'border-2 border-surface-600'
                      )}>
                        {task.done && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={clsx('text-sm font-medium truncate', task.done && 'line-through')}>{task.title}</p>
                        <p className="text-xs text-surface-500">{task.subject} · {task.duration}</p>
                      </div>
                      {!task.done && (
                        isFirst ? (
                          <button onClick={() => handleTaskPlay(task.id)} className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-semibold transition-all">
                            <span className="absolute inset-0 rounded-lg ring-2 ring-green-400/40 animate-ping pointer-events-none" />
                            <ArrowRight className="w-3.5 h-3.5" /> Continue
                          </button>
                        ) : (
                          <button onClick={() => handleTaskPlay(task.id)} className="p-1.5 rounded-lg bg-primary-500/10 hover:bg-primary-500/20 transition-colors">
                            <Play className="w-3.5 h-3.5 text-primary-400" />
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ────────────────────────────────────────
          ZONE C — Quick Actions (glassmorphism pills)
          ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className="grid grid-cols-3 gap-3"
      >
        {[
          { to: '/practice', emoji: '📝', label: 'Practice', color: 'from-red-600/20 to-red-500/10 border-red-500/20 hover:border-red-500/40' },
          { to: '/chat',     emoji: '💬', label: 'Ask Sage', color: 'from-primary-600/20 to-primary-500/10 border-primary-500/20 hover:border-primary-500/40', highlight: true },
          { to: '/learn',    emoji: '📚', label: 'Study',    color: 'from-blue-600/20 to-blue-500/10 border-blue-500/20 hover:border-blue-500/40' },
        ].map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={clsx(
              'flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border bg-gradient-to-b glass-card transition-all active:scale-95 group',
              item.color,
              item.highlight && 'shadow-lg shadow-primary-500/10'
            )}
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">{item.emoji}</span>
            <span className={clsx('text-sm font-semibold', item.highlight ? 'text-primary-300' : 'text-surface-200')}>
              {item.label}
            </span>
          </Link>
        ))}
      </motion.div>

      {/* ── Two-column: weekly progress + exam countdown ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="card">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-accent-400" />
            <h2 className="font-semibold text-sm">This Week</h2>
          </div>
          <WeekBar data={weekProgress} />
          <p className="text-xs text-surface-500 mt-3">5 of 7 days active · Great work!</p>
        </motion.div>

        {/* Exam countdown */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="font-semibold text-sm text-amber-300">{examCountdown.exam}</h2>
          </div>
          <p className="text-3xl font-bold text-amber-200">{examCountdown.daysLeft}</p>
          <p className="text-xs text-amber-400/70">days remaining</p>
          <Link to="/insights" className="mt-3 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
            View topper strategies <ArrowRight className="w-3 h-3" />
          </Link>
        </motion.div>
      </div>

      {/* ── Exam Readiness Score ── */}
      <ExamReadinessScore />

      {/* ── More quick links ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
        className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { to: '/notebook', icon: '📓', label: 'Notebook',  bg: 'bg-green-500/10' },
          { to: '/progress', icon: <BarChart3 className="w-6 h-6 text-purple-400" />, label: 'Progress', bg: 'bg-purple-500/10' },
          { to: '/insights', icon: <Trophy className="w-6 h-6 text-amber-400" />, label: 'Exam Tips', bg: 'bg-amber-500/10' },
        ].map(item => (
          <Link key={item.to} to={item.to}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-800/50 hover:bg-surface-800 active:scale-95 transition-all text-center group">
            <div className={clsx('p-3 rounded-xl', item.bg)}>
              {typeof item.icon === 'string' ? <span className="text-2xl">{item.icon}</span> : item.icon}
            </div>
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}
      </motion.div>

      {/* ── Peer Activity ── */}
      <PeerActivity />

      {/* ────────────────────────────────────────────────────────────────
          Floating Quick-Ask Bar (mobile, fixed above tab bar)
          ──────────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-[72px] left-0 right-0 px-4 z-30 md:hidden">
        <form
          onSubmit={handleDoubtSubmit}
          className="flex gap-2 p-2 rounded-2xl glass border border-surface-600/40 shadow-2xl shadow-black/30 backdrop-blur-xl"
        >
          <input
            ref={inputRef}
            type="text"
            value={doubtInput}
            onChange={e => setDoubtInput(e.target.value)}
            placeholder="Ask Sage anything..."
            className="flex-1 bg-transparent text-sm placeholder-surface-500 text-white focus:outline-none px-2"
          />
          <button
            type="submit"
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary-500 hover:bg-primary-400 flex items-center justify-center transition-colors active:scale-95"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </form>

      </div>

    </div>
  );
}
