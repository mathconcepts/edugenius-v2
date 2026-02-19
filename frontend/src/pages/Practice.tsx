/**
 * Practice Mode — Adaptive MCQ Engine
 * Timed sessions, JEE/NEET/CBSE filters, AI explanations, performance analytics.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Clock, Target, CheckCircle, XCircle, BarChart2,
  ChevronRight, ChevronLeft, Zap, Play, Flag, Award, Filter,
  Lightbulb, SkipForward, RotateCcw, TrendingUp,
} from 'lucide-react';
import { clsx } from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

type Difficulty = 'easy' | 'medium' | 'hard';
type Subject = 'Physics' | 'Chemistry' | 'Mathematics' | 'Biology' | 'English';
type ExamFilter = 'All' | 'JEE Main' | 'JEE Adv' | 'NEET' | 'CBSE 12' | 'CAT';

interface MCQ {
  id: string;
  subject: Subject;
  chapter: string;
  topic: string;
  difficulty: Difficulty;
  exam: string[];
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  formulaHint?: string;
}

interface UserAnswer {
  questionId: string;
  selectedIndex: number | null;
  correct: boolean;
  timeSpent: number;
  flagged: boolean;
}

interface SessionConfig {
  count: 10 | 20 | 40;
  exam: ExamFilter;
  subject: Subject | 'All';
  difficulty: Difficulty | 'All';
  timed: boolean;
  timerPerQuestion: number;
}

// ─── Question Bank ────────────────────────────────────────────────────────────

const QUESTION_BANK: MCQ[] = [
  {
    id: 'p001', subject: 'Physics', chapter: 'Kinematics', topic: 'Projectile Motion',
    difficulty: 'medium', exam: ['JEE Main', 'JEE Adv', 'CBSE 12'],
    question: 'A ball is thrown horizontally from a height of 80 m with a speed of 20 m/s. Time to reach the ground? (g = 10 m/s²)',
    options: ['2 s', '4 s', '6 s', '8 s'],
    correctIndex: 1,
    explanation: 'Vertical motion only: h = ½gt²\n80 = ½ × 10 × t²  →  t² = 16  →  t = 4 s\nHorizontal speed does not affect vertical fall time.',
    formulaHint: 'h = ½gt²',
  },
  {
    id: 'p002', subject: 'Physics', chapter: 'Laws of Motion', topic: "Newton's Laws",
    difficulty: 'easy', exam: ['JEE Main', 'CBSE 12', 'NEET'],
    question: 'A 2 kg block on a frictionless surface is pushed with 10 N horizontally. Its acceleration is:',
    options: ['2 m/s²', '5 m/s²', '10 m/s²', '20 m/s²'],
    correctIndex: 1,
    explanation: 'F = ma  →  a = F/m = 10/2 = 5 m/s²',
    formulaHint: 'F = ma',
  },
  {
    id: 'p003', subject: 'Physics', chapter: 'Electrostatics', topic: "Coulomb's Law",
    difficulty: 'medium', exam: ['JEE Main', 'NEET', 'CBSE 12'],
    question: 'Two charges +4μC and +9μC are 1 m apart. Distance from +4μC where field is zero:',
    options: ['0.4 m', '0.6 m', '0.5 m', '0.3 m'],
    correctIndex: 0,
    explanation: 'At null point: k·4/r² = k·9/(1−r)²\n→ 2/r = 3/(1−r)  →  2(1−r) = 3r  →  r = 0.4 m',
    formulaHint: 'Equal fields: √q₁/r₁ = √q₂/r₂',
  },
  {
    id: 'p004', subject: 'Physics', chapter: 'Optics', topic: 'Snell\'s Law',
    difficulty: 'easy', exam: ['JEE Main', 'NEET', 'CBSE 12'],
    question: 'Light enters glass (n=1.5) at 30° incidence. Angle of refraction:',
    options: ['19.47°', '45°', '20°', '15°'],
    correctIndex: 0,
    explanation: "Snell's Law: n₁sinθ₁ = n₂sinθ₂\n1 × sin30° = 1.5 × sinθ₂\nsinθ₂ = 0.5/1.5 = 0.333  →  θ₂ ≈ 19.47°",
    formulaHint: 'n₁sinθ₁ = n₂sinθ₂',
  },
  {
    id: 'p005', subject: 'Physics', chapter: 'Work & Energy', topic: 'Spring Energy',
    difficulty: 'hard', exam: ['JEE Main', 'JEE Adv'],
    question: 'Spring k=500 N/m compressed 0.1 m. Max velocity of 0.5 kg block when released:',
    options: ['√10 m/s', '2 m/s', '√5 m/s', '3 m/s'],
    correctIndex: 0,
    explanation: '½kx² = ½mv²\nv² = kx²/m = (500 × 0.01)/0.5 = 10\nv = √10 ≈ 3.16 m/s',
    formulaHint: '½kx² = ½mv²',
  },
  {
    id: 'c001', subject: 'Chemistry', chapter: 'Atomic Structure', topic: 'Quantum Numbers',
    difficulty: 'medium', exam: ['JEE Main', 'NEET', 'CBSE 12'],
    question: 'Max electrons in subshell with azimuthal quantum number l = 3:',
    options: ['6', '10', '14', '18'],
    correctIndex: 2,
    explanation: 'For l = 3: f subshell\nMax electrons = 2(2l+1) = 2×7 = 14',
    formulaHint: 'Max e⁻ = 2(2l+1)',
  },
  {
    id: 'c002', subject: 'Chemistry', chapter: 'Chemical Bonding', topic: 'VSEPR',
    difficulty: 'easy', exam: ['JEE Main', 'NEET', 'CBSE 12'],
    question: 'Molecular shape of NH₃:',
    options: ['Trigonal planar', 'Tetrahedral', 'Trigonal pyramidal', 'Linear'],
    correctIndex: 2,
    explanation: 'NH₃: 3 bond pairs + 1 lone pair → tetrahedral electron geometry → trigonal pyramidal molecular shape\nBond angle ≈ 107°',
  },
  {
    id: 'c003', subject: 'Chemistry', chapter: 'Thermodynamics', topic: 'Gibbs Energy',
    difficulty: 'hard', exam: ['JEE Main', 'JEE Adv', 'CBSE 12'],
    question: 'ΔH = −30 kJ/mol, ΔS = −100 J/mol·K at 300 K. The process is:',
    options: ['Spontaneous', 'Non-spontaneous', 'At equilibrium', 'Cannot determine'],
    correctIndex: 2,
    explanation: 'ΔG = ΔH − TΔS = −30,000 − 300×(−100) = −30,000 + 30,000 = 0\nΔG = 0 → system at equilibrium at this temperature.',
    formulaHint: 'ΔG = ΔH − TΔS',
  },
  {
    id: 'c004', subject: 'Chemistry', chapter: 'Organic', topic: 'Oxidation Reactions',
    difficulty: 'medium', exam: ['JEE Main', 'NEET'],
    question: 'Which reagent converts primary alcohol → aldehyde WITHOUT over-oxidation?',
    options: ['KMnO₄/H⁺', 'K₂Cr₂O₇/H₂SO₄', 'PCC (Pyridinium chlorochromate)', 'H₂O₂'],
    correctIndex: 2,
    explanation: 'PCC in anhydrous CH₂Cl₂ selectively stops at aldehyde.\nKMnO₄ and K₂Cr₂O₇ are strong oxidizers → go all the way to carboxylic acid.',
  },
  {
    id: 'c005', subject: 'Chemistry', chapter: 'Equilibrium', topic: "Le Chatelier's Principle",
    difficulty: 'easy', exam: ['JEE Main', 'NEET', 'CBSE 12'],
    question: 'N₂ + 3H₂ ⇌ 2NH₃  ΔH = −92 kJ. Increasing temperature:',
    options: ['Shifts right', 'Shifts left', 'No effect', 'Increases Kp'],
    correctIndex: 1,
    explanation: 'Forward reaction is exothermic. Increasing temperature favours the endothermic (reverse) reaction → equilibrium shifts left → less NH₃.',
  },
  {
    id: 'm001', subject: 'Mathematics', chapter: 'Calculus', topic: 'Differentiation',
    difficulty: 'medium', exam: ['JEE Main', 'JEE Adv', 'CBSE 12'],
    question: 'f(x) = x³ − 3x² + 4. Find f′′(1):',
    options: ['0', '6', '−6', '3'],
    correctIndex: 0,
    explanation: "f'(x) = 3x² − 6x\nf''(x) = 6x − 6\nf''(1) = 6(1) − 6 = 0",
    formulaHint: 'dⁿ/dxⁿ(xⁿ) = n!',
  },
  {
    id: 'm002', subject: 'Mathematics', chapter: 'Coordinate Geometry', topic: 'Circles',
    difficulty: 'easy', exam: ['JEE Main', 'CBSE 12'],
    question: 'Centre of circle x² + y² − 4x + 6y − 12 = 0:',
    options: ['(2, −3)', '(−2, 3)', '(4, −6)', '(−4, 6)'],
    correctIndex: 0,
    explanation: 'Complete the square:\n(x−2)² + (y+3)² = 25\nCentre = (2, −3), radius = 5',
  },
  {
    id: 'm003', subject: 'Mathematics', chapter: 'Probability', topic: 'Conditional Probability',
    difficulty: 'medium', exam: ['JEE Main', 'CBSE 12'],
    question: 'Two dice thrown. Given sum = 8, P(one die shows 3) = ?',
    options: ['1/5', '2/5', '1/3', '3/5'],
    correctIndex: 1,
    explanation: 'Sum=8 outcomes: (2,6),(3,5),(4,4),(5,3),(6,2) → 5 ways\nWith a 3: (3,5),(5,3) → 2 ways\nP = 2/5',
  },
  {
    id: 'm004', subject: 'Mathematics', chapter: 'Integration', topic: 'Definite Integrals',
    difficulty: 'hard', exam: ['JEE Main', 'JEE Adv'],
    question: '∫₀^π sin²(x) dx = ?',
    options: ['π/2', 'π', '1', '0'],
    correctIndex: 0,
    explanation: 'sin²x = (1−cos2x)/2\n∫₀^π (1−cos2x)/2 dx = [x/2 − sin2x/4]₀^π = π/2',
    formulaHint: 'sin²x = (1−cos2x)/2',
  },
  {
    id: 'm005', subject: 'Mathematics', chapter: 'Complex Numbers', topic: 'Modulus',
    difficulty: 'medium', exam: ['JEE Main', 'JEE Adv'],
    question: 'z = 1 + i. |z³| = ?',
    options: ['2', '2√2', '4', '√2'],
    correctIndex: 1,
    explanation: '|z| = √(1+1) = √2\n|z³| = |z|³ = (√2)³ = 2√2',
    formulaHint: '|zⁿ| = |z|ⁿ',
  },
  {
    id: 'b001', subject: 'Biology', chapter: 'Cell Division', topic: 'Mitosis',
    difficulty: 'easy', exam: ['NEET', 'CBSE 12'],
    question: 'Chromosomes align at the equatorial plate during:',
    options: ['Prophase', 'Metaphase', 'Anaphase', 'Telophase'],
    correctIndex: 1,
    explanation: 'Metaphase: chromosomes maximally condensed, aligned at the metaphase plate. Spindle fibers attach to kinetochores. Best phase for karyotyping.',
  },
  {
    id: 'b002', subject: 'Biology', chapter: 'Genetics', topic: "Mendel's Laws",
    difficulty: 'medium', exam: ['NEET', 'CBSE 12'],
    question: 'Cross AaBb × AaBb. Fraction of offspring that are aabb:',
    options: ['1/4', '1/8', '1/16', '3/16'],
    correctIndex: 2,
    explanation: 'P(aa) = 1/4, P(bb) = 1/4 (independent assortment)\nP(aabb) = 1/4 × 1/4 = 1/16',
  },
  {
    id: 'b003', subject: 'Biology', chapter: 'Ecology', topic: 'Food Chains',
    difficulty: 'easy', exam: ['NEET', 'CBSE 12'],
    question: 'Correct food chain:',
    options: [
      'Hawk → Snake → Frog → Insects → Plants',
      'Plants → Insects → Frog → Snake → Hawk',
      'Insects → Plants → Frog → Snake → Hawk',
      'Plants → Hawk → Snake → Frog → Insects',
    ],
    correctIndex: 1,
    explanation: 'Energy flows from producers → primary consumers → secondary → tertiary:\nPlants → Insects → Frog → Snake → Hawk',
  },
  {
    id: 'cat001', subject: 'Mathematics', chapter: 'Quantitative Aptitude', topic: 'Percentages',
    difficulty: 'medium', exam: ['CAT'],
    question: 'Shopkeeper marks goods 40% above CP and gives 25% discount. Profit/loss %:',
    options: ['5% profit', '5% loss', '10% profit', '10% loss'],
    correctIndex: 0,
    explanation: 'CP=100, MP=140, SP=140×0.75=105\nProfit = 5%',
  },
  {
    id: 'cat002', subject: 'English', chapter: 'Verbal Ability', topic: 'Vocabulary',
    difficulty: 'hard', exam: ['CAT'],
    question: '"Ephemeral" means closest to:',
    options: ['Eternal', 'Transient', 'Substantial', 'Vivid'],
    correctIndex: 1,
    explanation: 'Ephemeral = lasting for a very short time, fleeting.\nEx: "The cherry blossoms are ephemeral — gone within a week."',
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAMS: ExamFilter[] = ['All', 'JEE Main', 'JEE Adv', 'NEET', 'CBSE 12', 'CAT'];
const SUBJECTS: (Subject | 'All')[] = ['All', 'Physics', 'Chemistry', 'Mathematics', 'Biology', 'English'];
const DIFFICULTIES: (Difficulty | 'All')[] = ['All', 'easy', 'medium', 'hard'];
const SESSION_SIZES: (10 | 20 | 40)[] = [10, 20, 40];

const DIFF_STYLE: Record<Difficulty, string> = {
  easy: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  hard: 'text-red-400 bg-red-400/10 border-red-400/30',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterQuestions(cfg: SessionConfig): MCQ[] {
  let pool = QUESTION_BANK.filter(q => {
    const ex = cfg.exam === 'All' || q.exam.includes(cfg.exam);
    const su = cfg.subject === 'All' || q.subject === cfg.subject;
    const di = cfg.difficulty === 'All' || q.difficulty === cfg.difficulty;
    return ex && su && di;
  }).sort(() => Math.random() - 0.5);

  // Pad if needed (demo mode)
  while (pool.length < cfg.count) {
    pool = [...pool, ...QUESTION_BANK.sort(() => Math.random() - 0.5)].slice(0, cfg.count * 2);
  }
  return pool.slice(0, cfg.count);
}

// ─── Components ───────────────────────────────────────────────────────────────

function SetupScreen({ onStart }: { onStart: (cfg: SessionConfig) => void }) {
  const [cfg, setCfg] = useState<SessionConfig>({
    count: 20, exam: 'JEE Main', subject: 'All',
    difficulty: 'All', timed: true, timerPerQuestion: 90,
  });

  const pill = (active: boolean, color: string) =>
    active ? `${color} text-white` : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600';

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1 text-blue-400 text-sm mb-4">
          <Zap size={14} /> Adaptive Practice Engine
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Practice Mode</h1>
        <p className="text-zinc-400 text-sm">Sharpen your skills. AI explanations on every question.</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
        {/* Exam */}
        <div>
          <p className="text-sm font-medium text-zinc-300 mb-2">📋 Exam Target</p>
          <div className="flex flex-wrap gap-2">
            {EXAMS.map(e => (
              <button key={e} onClick={() => setCfg(c => ({ ...c, exam: e }))}
                className={clsx('px-3 py-1.5 rounded-lg text-sm border transition-all',
                  pill(cfg.exam === e, 'bg-blue-600 border-blue-500'))}>
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div>
          <p className="text-sm font-medium text-zinc-300 mb-2">📚 Subject</p>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map(s => (
              <button key={s} onClick={() => setCfg(c => ({ ...c, subject: s }))}
                className={clsx('px-3 py-1.5 rounded-lg text-sm border transition-all',
                  pill(cfg.subject === s, 'bg-purple-600 border-purple-500'))}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <p className="text-sm font-medium text-zinc-300 mb-2">⚡ Difficulty</p>
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map(d => (
              <button key={d} onClick={() => setCfg(c => ({ ...c, difficulty: d }))}
                className={clsx('px-3 py-1.5 rounded-lg text-sm border capitalize transition-all',
                  pill(cfg.difficulty === d, 'bg-orange-600 border-orange-500'))}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        <div>
          <p className="text-sm font-medium text-zinc-300 mb-2">🔢 Questions</p>
          <div className="flex gap-3">
            {SESSION_SIZES.map(n => (
              <button key={n} onClick={() => setCfg(c => ({ ...c, count: n }))}
                className={clsx('flex-1 py-3 rounded-xl text-lg font-bold border transition-all',
                  pill(cfg.count === n, 'bg-emerald-600 border-emerald-500'))}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Timer toggle */}
        <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-xl">
          <div>
            <p className="text-sm font-medium text-zinc-300">⏱ Timed Mode</p>
            <p className="text-xs text-zinc-500">{cfg.timerPerQuestion}s per question</p>
          </div>
          <button onClick={() => setCfg(c => ({ ...c, timed: !c.timed }))}
            className={clsx('w-12 h-6 rounded-full relative transition-colors', cfg.timed ? 'bg-blue-600' : 'bg-zinc-600')}>
            <div className={clsx('absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all', cfg.timed ? 'left-6' : 'left-0.5')} />
          </button>
        </div>

        <button onClick={() => onStart(cfg)}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all flex items-center justify-center gap-2">
          <Play size={20} /> Start Session ({cfg.count} Questions)
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3 mt-6">
        {[
          { label: 'Question Bank', value: QUESTION_BANK.length + '+', icon: BookOpen },
          { label: 'Subjects', value: '6', icon: Filter },
          { label: 'Exams', value: '5', icon: Target },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <Icon size={18} className="text-blue-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-xs text-zinc-500">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuizScreen({
  questions, config, onComplete
}: {
  questions: MCQ[];
  config: SessionConfig;
  onComplete: (answers: UserAnswer[]) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [answers, setAnswers] = useState<UserAnswer[]>([]);
  const [timeLeft, setTimeLeft] = useState(config.timerPerQuestion);
  const [paused, setPaused] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const startTime = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const q = questions[idx];

  // Timer
  useEffect(() => {
    if (!config.timed || paused || revealed) return;
    setTimeLeft(config.timerPerQuestion);
    startTime.current = Date.now();

    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(intervalRef.current!);
          handleSkip();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [idx, paused]);

  const handleSelect = (i: number) => {
    if (revealed) return;
    setSelected(i);
    setRevealed(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    const spent = Math.round((Date.now() - startTime.current) / 1000);
    const ans: UserAnswer = {
      questionId: q.id, selectedIndex: i,
      correct: i === q.correctIndex, timeSpent: spent, flagged: flagged.has(idx),
    };
    setAnswers(prev => [...prev, ans]);
  };

  const handleSkip = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const spent = Math.round((Date.now() - startTime.current) / 1000);
    const ans: UserAnswer = {
      questionId: q.id, selectedIndex: null,
      correct: false, timeSpent: spent, flagged: flagged.has(idx),
    };
    setAnswers(prev => {
      const updated = [...prev, ans];
      if (idx + 1 >= questions.length) {
        onComplete(updated);
      }
      return updated;
    });
    if (idx + 1 < questions.length) {
      setIdx(i => i + 1);
      setSelected(null);
      setRevealed(false);
      setShowHint(false);
    }
  }, [idx, q, flagged, questions.length, onComplete]);

  const handleNext = () => {
    if (idx + 1 >= questions.length) {
      onComplete(answers);
      return;
    }
    setIdx(i => i + 1);
    setSelected(null);
    setRevealed(false);
    setShowHint(false);
  };

  const timerPct = (timeLeft / config.timerPerQuestion) * 100;
  const timerColor = timeLeft > 30 ? 'bg-emerald-500' : timeLeft > 10 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      {/* Header bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
          <div className="bg-blue-500 h-1.5 rounded-full transition-all"
            style={{ width: `${((idx) / questions.length) * 100}%` }} />
        </div>
        <span className="text-sm text-zinc-400 whitespace-nowrap">{idx + 1}/{questions.length}</span>
        {config.timed && (
          <div className="flex items-center gap-1.5 text-sm min-w-[52px]">
            <Clock size={14} className={timeLeft < 10 ? 'text-red-400' : 'text-zinc-400'} />
            <span className={timeLeft < 10 ? 'text-red-400 font-bold' : 'text-zinc-300'}>{timeLeft}s</span>
          </div>
        )}
        <button onClick={() => setFlagged(f => {
          const n = new Set(f);
          n.has(idx) ? n.delete(idx) : n.add(idx);
          return n;
        })}
          className={clsx('p-1.5 rounded-lg transition-all',
            flagged.has(idx) ? 'text-yellow-400 bg-yellow-400/10' : 'text-zinc-600 hover:text-zinc-400')}>
          <Flag size={16} />
        </button>
      </div>

      {config.timed && (
        <div className="h-1 bg-zinc-800 rounded-full mb-4 overflow-hidden">
          <div className={clsx('h-1 rounded-full transition-all', timerColor)}
            style={{ width: `${timerPct}%` }} />
        </div>
      )}

      {/* Question card */}
      <AnimatePresence mode="wait">
        <motion.div key={idx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-4">

          {/* Meta */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className={clsx('text-xs px-2 py-0.5 rounded border', DIFF_STYLE[q.difficulty])}>{q.difficulty}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">{q.subject}</span>
            <span className="text-xs text-zinc-500">{q.chapter} · {q.topic}</span>
            {q.formulaHint && !showHint && !revealed && (
              <button onClick={() => setShowHint(true)} className="ml-auto text-xs text-yellow-400/70 hover:text-yellow-400 flex items-center gap-1">
                <Lightbulb size={12} /> Hint
              </button>
            )}
          </div>

          {showHint && q.formulaHint && (
            <div className="mb-3 text-xs text-yellow-300 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2 font-mono">
              💡 {q.formulaHint}
            </div>
          )}

          {/* Question */}
          <p className="text-white text-lg font-medium mb-6 leading-relaxed">{q.question}</p>

          {/* Options */}
          <div className="space-y-2.5">
            {q.options.map((opt, i) => {
              let style = 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600';
              if (revealed) {
                if (i === q.correctIndex) style = 'bg-emerald-600/20 border-emerald-500 text-emerald-300';
                else if (i === selected) style = 'bg-red-600/20 border-red-500 text-red-300';
                else style = 'bg-zinc-800/50 border-zinc-800 text-zinc-500';
              }
              return (
                <button key={i} onClick={() => handleSelect(i)} disabled={revealed}
                  className={clsx('w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3', style)}>
                  <span className="font-bold text-sm w-5">{String.fromCharCode(65 + i)}.</span>
                  <span className="text-sm">{opt}</span>
                  {revealed && i === q.correctIndex && <CheckCircle size={16} className="ml-auto text-emerald-400 shrink-0" />}
                  {revealed && i === selected && i !== q.correctIndex && <XCircle size={16} className="ml-auto text-red-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {revealed && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-5 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-1"><Lightbulb size={12} /> Sage Explanation</p>
              <p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed">{q.explanation}</p>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Actions */}
      <div className="flex gap-3">
        {!revealed ? (
          <button onClick={handleSkip} className="flex-1 py-3 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl text-sm flex items-center justify-center gap-2 hover:border-zinc-600 transition-all">
            <SkipForward size={16} /> Skip
          </button>
        ) : (
          <button onClick={handleNext} className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition-all font-semibold">
            {idx + 1 >= questions.length ? 'See Results' : 'Next Question'} <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function ResultsScreen({ questions, answers, config, onRestart }: {
  questions: MCQ[]; answers: UserAnswer[]; config: SessionConfig; onRestart: () => void;
}) {
  const correct = answers.filter(a => a.correct).length;
  const accuracy = Math.round((correct / answers.length) * 100);
  const totalTime = answers.reduce((s, a) => s + a.timeSpent, 0);
  const avgTime = Math.round(totalTime / answers.length);

  const bySubject: Record<string, { correct: number; total: number }> = {};
  answers.forEach((a, i) => {
    const q = questions[i]; if (!q) return;
    if (!bySubject[q.subject]) bySubject[q.subject] = { correct: 0, total: 0 };
    bySubject[q.subject].total++;
    if (a.correct) bySubject[q.subject].correct++;
  });

  const weakTopics: string[] = [];
  const topicErr: Record<string, number> = {};
  answers.forEach((a, i) => {
    if (!a.correct) {
      const q = questions[i]; if (!q) return;
      topicErr[q.topic] = (topicErr[q.topic] || 0) + 1;
    }
  });
  Object.entries(topicErr).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([t]) => weakTopics.push(t));

  const grade = accuracy >= 90 ? 'A+' : accuracy >= 75 ? 'A' : accuracy >= 60 ? 'B' : accuracy >= 45 ? 'C' : 'D';
  const gradeColor = accuracy >= 90 ? 'text-emerald-400' : accuracy >= 75 ? 'text-blue-400' : accuracy >= 60 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <div className={clsx('text-6xl font-black mb-2', gradeColor)}>{grade}</div>
        <p className="text-zinc-400 text-sm">{accuracy}% accuracy · {correct}/{answers.length} correct</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Score', value: `${correct}/${answers.length}`, icon: Award, color: 'text-emerald-400' },
          { label: 'Accuracy', value: `${accuracy}%`, icon: Target, color: 'text-blue-400' },
          { label: 'Avg Time', value: `${avgTime}s`, icon: Clock, color: 'text-purple-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <Icon size={18} className={clsx(color, 'mx-auto mb-1')} />
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-xs text-zinc-500">{label}</p>
          </div>
        ))}
      </div>

      {/* By subject */}
      {Object.keys(bySubject).length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4">
          <p className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2"><BarChart2 size={14} /> By Subject</p>
          <div className="space-y-3">
            {Object.entries(bySubject).map(([subj, { correct: c, total: t }]) => (
              <div key={subj}>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>{subj}</span>
                  <span>{c}/{t} ({Math.round(c/t*100)}%)</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full">
                  <div className="h-1.5 bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.round(c/t*100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weak topics */}
      {weakTopics.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
          <p className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2"><TrendingUp size={14} /> Revise These Topics</p>
          <div className="flex flex-wrap gap-2">
            {weakTopics.map(t => (
              <span key={t} className="text-xs px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full">{t}</span>
            ))}
          </div>
        </div>
      )}

      <button onClick={onRestart}
        className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all">
        <RotateCcw size={18} /> Practice Again
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Phase = 'setup' | 'quiz' | 'results';

export default function Practice() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [questions, setQuestions] = useState<MCQ[]>([]);
  const [answers, setAnswers] = useState<UserAnswer[]>([]);

  const handleStart = (cfg: SessionConfig) => {
    setConfig(cfg);
    setQuestions(filterQuestions(cfg));
    setPhase('quiz');
  };

  const handleComplete = (ans: UserAnswer[]) => {
    setAnswers(ans);
    setPhase('results');
  };

  const handleRestart = () => {
    setPhase('setup');
    setConfig(null);
    setQuestions([]);
    setAnswers([]);
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {phase === 'setup' && <SetupScreen onStart={handleStart} />}
      {phase === 'quiz' && config && (
        <QuizScreen questions={questions} config={config} onComplete={handleComplete} />
      )}
      {phase === 'results' && config && (
        <ResultsScreen questions={questions} answers={answers} config={config} onRestart={handleRestart} />
      )}
    </div>
  );
}
