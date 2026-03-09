/**
 * Practice Mode — Adaptive MCQ Engine
 * Timed sessions, JEE/NEET/CBSE filters, AI explanations, performance analytics.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { callLLM } from '@/services/llmService';
import { loadPersona, personaToCustomerProfileRaw } from '@/services/studentPersonaEngine';
import { buildSageNetworkContext } from '@/services/networkAgentBridge';
import { ContentCard } from '@/components/ContentCard';
import { buildCustomerProfile, type ContentAtom } from '@/services/contentFramework';
import { selectOptimalStrategy } from '@/services/teachingStrategy';
import {
  createRootTrace,
  addNode,
  storeTrace,
} from '@/services/traceabilityEngine';
import type { TraceTree } from '@/services/traceabilityEngine';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Clock, Target, CheckCircle, XCircle, BarChart2,
  ChevronRight, ChevronLeft, Zap, Play, Flag, Award, Filter,
  Lightbulb, SkipForward, RotateCcw, TrendingUp, Share2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { WhatsAppOptInModal } from '@/components/WhatsAppOptInModal';
import {
  hasWhatsAppOptIn,
  shouldShowWhatsAppPrompt,
  buildReferralShareMessage,
} from '@/services/whatsappOptIn';

// ─── Types ────────────────────────────────────────────────────────────────────

type Difficulty = 'easy' | 'medium' | 'hard';
type Subject = 'Physics' | 'Chemistry' | 'Mathematics' | 'Biology' | 'English';
type ExamFilter = 'All' | 'JEE Main' | 'JEE Adv' | 'NEET' | 'CBSE 12' | 'CAT' | 'GATE EM';

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

  // ── GATE Engineering Mathematics (Seed MCQs) ─────────────────────────────
  {
    id: 'gem001', subject: 'Mathematics', chapter: 'Linear Algebra', topic: 'Eigenvalues',
    difficulty: 'medium', exam: ['GATE EM'],
    question: 'Matrix A = [[2, 1], [0, 3]]. What are the eigenvalues of A?',
    options: ['1 and 3', '2 and 3', '0 and 3', '2 and 1'],
    correctIndex: 1,
    explanation: 'For an upper/lower triangular matrix, eigenvalues are the diagonal entries.\nA is upper triangular → eigenvalues = 2 and 3.\nVerify: det(A − λI) = (2−λ)(3−λ) = 0 → λ = 2, 3.',
    formulaHint: 'det(A − λI) = 0',
  },
  {
    id: 'gem002', subject: 'Mathematics', chapter: 'Calculus', topic: "L'Hôpital's Rule",
    difficulty: 'easy', exam: ['GATE EM'],
    question: 'lim(x→0) [sin(3x) / x] = ?',
    options: ['0', '1', '3', '∞'],
    correctIndex: 2,
    explanation: "Applying L'Hôpital's rule (0/0 form):\nd/dx[sin(3x)] = 3cos(3x), d/dx[x] = 1\nlim = 3cos(0)/1 = 3.\nAlternatively: sin(3x)/x = 3 · sin(3x)/(3x) → 3 · 1 = 3.",
    formulaHint: 'lim(x→0) sin(ax)/x = a',
  },
  {
    id: 'gem003', subject: 'Mathematics', chapter: 'Differential Equations', topic: 'First Order Linear ODE',
    difficulty: 'medium', exam: ['GATE EM'],
    question: "Integrating factor for dy/dx + (2/x)y = x² is:",
    options: ['e^(2x)', 'x²', 'x³', '1/x²'],
    correctIndex: 1,
    explanation: 'For dy/dx + P(x)y = Q(x), integrating factor μ = e^(∫P dx).\nP(x) = 2/x  →  ∫(2/x)dx = 2ln|x| = ln(x²)\nμ = e^(ln x²) = x².',
    formulaHint: 'μ = e^(∫P dx)',
  },
  {
    id: 'gem004', subject: 'Mathematics', chapter: 'Complex Variables', topic: "Cauchy's Integral Formula",
    difficulty: 'hard', exam: ['GATE EM'],
    question: '∮_C e^z / (z−1) dz where C is |z| = 2 (counterclockwise). Value = ?',
    options: ['0', '2πi', '2πi·e', 'πi'],
    correctIndex: 2,
    explanation: "Cauchy's integral formula: ∮_C f(z)/(z−a) dz = 2πi·f(a) when a is inside C.\nHere f(z) = eᶻ, a = 1, which is inside |z| = 2.\nResult = 2πi·e¹ = 2πie.",
    formulaHint: '∮ f(z)/(z−a) dz = 2πi·f(a)',
  },
  {
    id: 'gem005', subject: 'Mathematics', chapter: 'Probability & Statistics', topic: 'Bayes Theorem',
    difficulty: 'medium', exam: ['GATE EM'],
    question: 'Machine produces 5% defective items. Test correctly identifies defective 90% of time and non-defective 95% of time. P(defective | test positive) = ?',
    options: ['0.05', '0.49', '0.486', '0.90'],
    correctIndex: 2,
    explanation: 'P(D)=0.05, P(D\')=0.95, P(+|D)=0.9, P(+|D\')=0.05\nP(+) = 0.9×0.05 + 0.05×0.95 = 0.045+0.0475 = 0.0925\nP(D|+) = (0.9×0.05)/0.0925 = 0.045/0.0925 ≈ 0.486',
    formulaHint: "P(A|B) = P(B|A)·P(A) / P(B)",
  },
  {
    id: 'gem006', subject: 'Mathematics', chapter: 'Numerical Methods', topic: 'Newton-Raphson',
    difficulty: 'medium', exam: ['GATE EM'],
    question: 'Newton-Raphson iteration for √2 using f(x)=x²−2, starting at x₀=1. Value of x₁:',
    options: ['1.25', '1.5', '1.4', '1.75'],
    correctIndex: 1,
    explanation: 'x₁ = x₀ − f(x₀)/f\'(x₀)\nf(1) = 1−2 = −1, f\'(x) = 2x, f\'(1) = 2\nx₁ = 1 − (−1)/2 = 1 + 0.5 = 1.5',
    formulaHint: "xₙ₊₁ = xₙ − f(xₙ)/f'(xₙ)",
  },
  {
    id: 'gem007', subject: 'Mathematics', chapter: 'Transform Theory', topic: 'Laplace Transform',
    difficulty: 'easy', exam: ['GATE EM'],
    question: 'Laplace transform of f(t) = e^(at) is:',
    options: ['1/(s−a)', '1/(s+a)', 'a/(s²+a²)', 's/(s²+a²)'],
    correctIndex: 0,
    explanation: 'L{e^(at)} = ∫₀^∞ e^(at)·e^(−st) dt = ∫₀^∞ e^(−(s−a)t) dt = 1/(s−a), valid for s > a.',
    formulaHint: 'L{e^(at)} = 1/(s−a)',
  },
  {
    id: 'gem008', subject: 'Mathematics', chapter: 'Discrete Mathematics', topic: 'Pigeonhole Principle',
    difficulty: 'easy', exam: ['GATE EM'],
    question: 'Minimum people needed in a room to guarantee 2 share the same birth month:',
    options: ['12', '13', '24', '6'],
    correctIndex: 1,
    explanation: 'By the Pigeonhole Principle: with 12 months (pigeonholes) and 12 people, it\'s possible all have different months. Adding 1 more (13 people) guarantees at least two share a month.',
    formulaHint: 'n pigeonholes, n+1 pigeons → at least one hole has ≥2',
  },
  {
    id: 'gem009', subject: 'Mathematics', chapter: 'Graph Theory', topic: 'Euler Path',
    difficulty: 'medium', exam: ['GATE EM'],
    question: 'A connected undirected graph has an Euler circuit if and only if:',
    options: ['All vertices have odd degree', 'All vertices have even degree', 'Exactly 2 vertices have odd degree', 'The graph is a tree'],
    correctIndex: 1,
    explanation: "Euler's theorem: A connected undirected graph has an Euler circuit iff every vertex has even degree.\nEuler path (not circuit): exactly 2 vertices have odd degree.",
    formulaHint: 'Euler circuit ↔ all vertices even degree',
  },
  {
    id: 'gem010', subject: 'Mathematics', chapter: 'Vector Calculus', topic: "Green's Theorem",
    difficulty: 'hard', exam: ['GATE EM'],
    question: 'By Green\'s theorem, ∮_C (y dx − x dy) over a unit circle is:',
    options: ['0', '−2π', '2π', 'π'],
    correctIndex: 1,
    explanation: "Green's theorem: ∮_C (P dx + Q dy) = ∬_D (∂Q/∂x − ∂P/∂y) dA\nP=y, Q=−x → ∂Q/∂x = −1, ∂P/∂y = 1\nIntegrand = −1−1 = −2\nResult = −2 × Area(unit circle) = −2π",
    formulaHint: '∮ P dx + Q dy = ∬ (∂Q/∂x − ∂P/∂y) dA',
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAMS: ExamFilter[] = ['All', 'JEE Main', 'JEE Adv', 'NEET', 'CBSE 12', 'CAT', 'GATE EM'];
const SUBJECTS: (Subject | 'All')[] = ['All', 'Physics', 'Chemistry', 'Mathematics', 'Biology', 'English'];
const DIFFICULTIES: (Difficulty | 'All')[] = ['All', 'easy', 'medium', 'hard'];
const SESSION_SIZES: (10 | 20 | 40)[] = [10, 20, 40];

const DIFF_STYLE: Record<Difficulty, string> = {
  easy: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  hard: 'text-red-400 bg-red-400/10 border-red-400/30',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── MCQ → ContentAtom adapter ───────────────────────────────────────────────

function mcqToAtom(q: MCQ): ContentAtom {
  return {
    id:   q.id,
    type: 'mcq',
    title: q.topic,
    body:  q.question,
    bodyMarkdown: q.question,
    mcq: {
      question:  q.question,
      options: {
        A: q.options[0] ?? '',
        B: q.options[1] ?? '',
        C: q.options[2] ?? '',
        D: q.options[3] ?? '',
      },
      correct:           (['A', 'B', 'C', 'D'] as const)[q.correctIndex] ?? 'A',
      explanation:       q.explanation,
      commonWrongAnswer: 'B',
      examTip:           q.formulaHint,
    },
    examId:           q.exam[0] ?? 'gate-em',
    topic:            q.topic,
    difficulty:       q.difficulty,
    syllabusPriority: 'high',
    quality: {
      accuracy:        0.9,
      clarity:         0.85,
      examRelevance:   0.88,
      engagementScore: 0,
      wolframVerified: false,
      reviewedByHuman: false,
    },
    generatedBy:    'atlas',
    generatedAt:    new Date(),
    sourceType:     'pyq',
    version:        1,
    timesServed:    0,
    avgRating:      0,
    completionRate: 0,
  };
}

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

      <div className="glass rounded-2xl p-6 space-y-5">
        {/* Exam — pill chips with gradient active state */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-surface-400 mb-3">📋 Exam Target</p>
          <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 scrollbar-none">
            {EXAMS.map(e => (
              <button
                key={e}
                onClick={() => setCfg(c => ({ ...c, exam: e }))}
                className={clsx(
                  'flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-all',
                  cfg.exam === e
                    ? 'bg-gradient-to-r from-primary-600 to-primary-500 border-primary-500 text-white shadow-md shadow-primary-900/30'
                    : 'bg-surface-800/60 border-surface-700 text-surface-300 hover:border-surface-500 hover:text-white'
                )}>
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Subject — pill chips */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-surface-400 mb-3">📚 Subject</p>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map(s => (
              <button
                key={s}
                onClick={() => setCfg(c => ({ ...c, subject: s }))}
                className={clsx(
                  'px-4 py-2 rounded-full text-sm font-semibold border transition-all',
                  cfg.subject === s
                    ? 'bg-gradient-to-r from-accent-600 to-accent-500 border-accent-500 text-white shadow-md shadow-accent-900/30'
                    : 'bg-surface-800/60 border-surface-700 text-surface-300 hover:border-surface-500 hover:text-white'
                )}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty — pill chips */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-surface-400 mb-3">⚡ Difficulty</p>
          <div className="flex gap-2">
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                onClick={() => setCfg(c => ({ ...c, difficulty: d }))}
                className={clsx(
                  'flex-1 py-2 rounded-full text-sm font-semibold border capitalize transition-all',
                  cfg.difficulty === d
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 border-orange-500 text-white shadow-md shadow-orange-900/20'
                    : 'bg-surface-800/60 border-surface-700 text-surface-300 hover:border-surface-500 hover:text-white'
                )}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-surface-400 mb-3">🔢 Questions</p>
          <div className="flex gap-3">
            {SESSION_SIZES.map(n => (
              <button
                key={n}
                onClick={() => setCfg(c => ({ ...c, count: n }))}
                className={clsx(
                  'flex-1 py-3 rounded-2xl text-lg font-black border transition-all',
                  cfg.count === n
                    ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-900/30'
                    : 'bg-surface-800/60 border-surface-700 text-surface-300 hover:border-surface-500 hover:text-white'
                )}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Timer toggle */}
        <div className="flex items-center justify-between p-4 glass-card rounded-xl">
          <div>
            <p className="text-sm font-semibold text-white">⏱ Timed Mode</p>
            <p className="text-xs text-surface-500 mt-0.5">{cfg.timerPerQuestion}s per question · exam simulation</p>
          </div>
          <button onClick={() => setCfg(c => ({ ...c, timed: !c.timed }))}
            className={clsx('w-12 h-6 rounded-full relative transition-colors flex-shrink-0', cfg.timed ? 'bg-primary-500' : 'bg-surface-600')}>
            <div className={clsx('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all', cfg.timed ? 'left-6' : 'left-0.5')} />
          </button>
        </div>

        <button onClick={() => onStart(cfg)}
          className="w-full py-4 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-2xl font-bold text-base hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary-900/30">
          <Play size={18} /> Start Session · {cfg.count} Questions
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

  // ── Wire 2 — Traceability: session-level trace ──
  const sessionTrace = useRef<TraceTree | null>(null);
  const sessionId = useRef(`practice-${Date.now()}`);

  // ── Wire 6 — AI explanation state ──
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  // Initialise trace on mount (Wire 2)
  useEffect(() => {
    const trace = createRootTrace({
      sessionId: sessionId.current,
      entryPoint: 'practice',
      examType: config.exam,
    });
    sessionTrace.current = trace;
  }, []);

  // Wire 6 + Wire 5: build AI explanation when answer is revealed
  const buildAIExplanation = useCallback(async (q: MCQ, isCorrect: boolean) => {
    setLoadingExplanation(true);
    setAiExplanation(null);
    try {
      const persona = loadPersona();

      // Wire 5: Network context injection
      const networkCtx = buildSageNetworkContext(q.subject, config.exam === 'All' ? 'JEE Main' : config.exam);
      const cohortNote = networkCtx.cohortNote;

      // Wire 6: Select optimal teaching strategy
      const strategyProfile = {
        preferredStyle: (
          persona.learningStyle === 'visual' ? 'visual' :
          persona.learningStyle === 'analytical' ? 'logical' :
          persona.learningStyle === 'practice-first' ? 'practical' : 'sequential'
        ) as 'visual' | 'logical' | 'practical' | 'sequential',
        currentMood: (
          persona.emotionalState === 'frustrated' || persona.emotionalState === 'exhausted' ? 'struggling' :
          persona.emotionalState === 'confident' || persona.emotionalState === 'motivated' ? 'confident' :
          'curious'
        ) as 'curious' | 'struggling' | 'confident' | 'rushed',
        timeAvailable: 'medium' as const,
      };

      // Create a minimal PracticeProblem-compatible object for strategy selection
      const pseudoProblem = {
        id: q.id,
        subject: q.subject,
        topic: q.topic,
        difficulty: q.difficulty,
        questionLatex: q.question,
        relatedConcepts: [q.chapter],
      } as Parameters<typeof selectOptimalStrategy>[0];

      const strategy = selectOptimalStrategy(pseudoProblem, strategyProfile);

      const systemPrompt = [
        `You are Sage, an expert tutor. A student just ${isCorrect ? 'correctly answered' : 'got wrong'} a ${q.difficulty} ${q.subject} question.`,
        `Use the "${strategy.name}" teaching approach: ${strategy.description || strategy.phases?.[0]?.description || 'guide step by step'}.`,
        cohortNote ? `\n${cohortNote}` : '',
      ].filter(Boolean).join('\n');

      const prompt = `Question: ${q.question}\n\nCorrect answer: ${q.options[q.correctIndex]}\n${!isCorrect ? `Student chose: ${q.options[selected ?? 0]}\n` : ''}Explanation (from textbook): ${q.explanation}\n\nPlease give a concise, personalised explanation using the ${strategy.name} approach. ${cohortNote ? 'Include the peer context naturally.' : ''}`;

      const response = await callLLM({
        agent: 'sage',
        message: prompt,
        customSystemPrompt: systemPrompt,
      });

      if (response) {
        setAiExplanation(response.text);
      }
    } catch (err) {
      console.warn('[Practice] AI explanation failed:', err);
    } finally {
      setLoadingExplanation(false);
    }
  }, [config.exam, selected]);

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
    const isCorrect = i === q.correctIndex;
    const ans: UserAnswer = {
      questionId: q.id, selectedIndex: i,
      correct: isCorrect, timeSpent: spent, flagged: flagged.has(idx),
    };
    setAnswers(prev => [...prev, ans]);

    // Wire 2 — Traceability: record user answer node
    if (sessionTrace.current) {
      addNode(sessionTrace.current, {
        traceId: `${sessionId.current}-ans-${Date.now()}`,
        parentTraceId: sessionTrace.current.nodes[0]?.traceId,
        nodeType: 'intent',
        agentId: 'sage',
        action: isCorrect ? 'answer:correct' : 'answer:incorrect',
        inputSummary: q.question.slice(0, 80),
        outputSummary: `selected: ${q.options[i]} | correct: ${isCorrect}`,
        latencyMs: spent * 1000,
        timestamp: new Date().toISOString(),
        metadata: { questionId: q.id, subject: q.subject, correct: isCorrect },
      });
      storeTrace(sessionTrace.current);
    }

    // Wire 5 + 6 — AI explanation with network context + teaching strategy
    buildAIExplanation(q, isCorrect);

    // Wire 7 — Topper Intelligence: Sage→TopperIntel signal on incorrect answer
    // Oracle picks this up to track which lessons-learned need more exposure
    if (!isCorrect) {
      import('@/services/topperIntelligence').then(({ recordStudentMistake }) => {
        const examSlug = config.exam === 'GATE EM' ? 'gate-engineering-maths' : config.exam === 'CAT' ? 'cat' : 'general';
        const topicSlug = q.topic?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') ?? 'unknown';
        recordStudentMistake({
          studentId: 'anonymous',
          topicId: topicSlug,
          examId: examSlug,
          mistakeType: 'conceptual',
          mistakeDescription: `Incorrectly answered: "${q.question.slice(0, 100)}"`,
          sessionId: sessionId.current,
        }).catch(() => {/* non-blocking */});
      });
    }
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
        // Wire 2: record session end
        if (sessionTrace.current) {
          const correctCount = updated.filter(a => a.correct).length;
          const accuracy = Math.round((correctCount / updated.length) * 100);
          addNode(sessionTrace.current, {
            traceId: `${sessionId.current}-end-${Date.now()}`,
            parentTraceId: sessionTrace.current.nodes[0]?.traceId,
            nodeType: 'output',
            action: 'session_end',
            inputSummary: `${updated.length} answers`,
            outputSummary: `score: ${correctCount}/${updated.length} (${accuracy}%)`,
            timestamp: new Date().toISOString(),
            metadata: { score: correctCount, total: updated.length, accuracy },
          });
          storeTrace(sessionTrace.current);
        }
        onComplete(updated);
      }
      return updated;
    });
    if (idx + 1 < questions.length) {
      setIdx(i => i + 1);
      setSelected(null);
      setRevealed(false);
      setShowHint(false);
      setAiExplanation(null);
    }
  }, [idx, q, flagged, questions.length, onComplete]);

  const handleNext = () => {
    if (idx + 1 >= questions.length) {
      // Wire 2: record session end before completing
      if (sessionTrace.current) {
        const correctCount = answers.filter(a => a.correct).length;
        const accuracy = Math.round((correctCount / answers.length) * 100);
        addNode(sessionTrace.current, {
          traceId: `${sessionId.current}-end-${Date.now()}`,
          parentTraceId: sessionTrace.current.nodes[0]?.traceId,
          nodeType: 'output',
          action: 'session_end',
          inputSummary: `${answers.length} answers`,
          outputSummary: `score: ${correctCount}/${answers.length} (${accuracy}%)`,
          timestamp: new Date().toISOString(),
          metadata: { score: correctCount, total: answers.length, accuracy },
        });
        storeTrace(sessionTrace.current);
      }
      onComplete(answers);
      return;
    }
    setIdx(i => i + 1);
    setSelected(null);
    setRevealed(false);
    setShowHint(false);
    setAiExplanation(null);
  };

  const timerPct = (timeLeft / config.timerPerQuestion) * 100;
  const timerColor = timeLeft > 30 ? 'bg-emerald-500' : timeLeft > 10 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      {/* Progress bar — shimmer style with Q X of Y label */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-emerald-400 tracking-wide">Q {idx + 1} of {questions.length}</span>
          <div className="flex items-center gap-3">
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
        </div>
        {/* Shimmer progress bar */}
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="progress-shimmer h-2 rounded-full transition-all duration-500"
            style={{ width: `${((idx + (revealed ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {config.timed && (
        <div className="h-1 bg-zinc-800 rounded-full mb-4 overflow-hidden">
          <div className={clsx('h-1 rounded-full transition-all', timerColor)}
            style={{ width: `${timerPct}%` }} />
        </div>
      )}

      {/* ContentCard preview — difficulty badge + preface from contentFramework */}
      {(() => {
        try {
          const _persona = loadPersona();
          const _profileRaw = personaToCustomerProfileRaw(_persona);
          return (
            <ContentCard
              atom={mcqToAtom(q)}
              profileRaw={_profileRaw}
              renderSurface="card"
              className="mb-3"
            />
          );
        } catch {
          return null;
        }
      })()}

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

          {/* Options — full-width mobile, min 52px touch targets */}
          <div className="space-y-2.5">
            {q.options.map((opt, i) => {
              let style = 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600';
              let flashClass = '';
              if (revealed) {
                if (i === q.correctIndex) {
                  style = 'bg-emerald-600/20 border-emerald-500 text-emerald-300';
                  if (i === selected) flashClass = 'flash-correct';
                } else if (i === selected) {
                  style = 'bg-red-600/20 border-red-500 text-red-300';
                  flashClass = 'flash-incorrect';
                } else {
                  style = 'bg-zinc-800/50 border-zinc-800 text-zinc-500';
                }
              }
              return (
                <button key={i} onClick={() => handleSelect(i)} disabled={revealed}
                  className={clsx(
                    'w-full text-left px-4 rounded-xl border transition-all flex items-center gap-3',
                    'min-h-[52px] py-3',  /* mobile thumb-friendly */
                    style, flashClass
                  )}>
                  <span className="font-bold text-sm w-5 shrink-0">{String.fromCharCode(65 + i)}.</span>
                  <span className="text-sm text-left leading-snug">{opt}</span>
                  {revealed && i === q.correctIndex && <CheckCircle size={16} className="ml-auto text-emerald-400 shrink-0" />}
                  {revealed && i === selected && i !== q.correctIndex && <XCircle size={16} className="ml-auto text-red-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Instant feedback toast — correct / incorrect */}
          {revealed && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className={clsx(
                'mt-3 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2',
                selected === q.correctIndex
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/15 border border-red-500/30 text-red-300'
              )}
            >
              {selected === q.correctIndex ? (
                <>✅ Correct! +1 point</>
              ) : (
                <>❌ Not quite — here's why:</>
              )}
            </motion.div>
          )}

          {/* Explanation — static fallback + Wires 5 & 6 AI explanation */}
          {revealed && (
            <>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="mt-5 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <p className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-1"><Lightbulb size={12} /> Sage Explanation</p>
                {loadingExplanation ? (
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    Sage is personalising your explanation…
                  </div>
                ) : aiExplanation ? (
                  <p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed">{aiExplanation}</p>
                ) : (
                  <p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed">{q.explanation}</p>
                )}
              </motion.div>

              {/* Topper insight — shown after answer is revealed */}
              {(() => {
                // Map question topic to topper insight key
                const examSlug = config.exam === 'GATE EM' ? 'gate-engineering-maths' : config.exam === 'CAT' ? 'cat' : null;
                const topicSlug = q.topic
                  ?.toLowerCase()
                  .replace(/\s+/g, '-')
                  .replace(/[^a-z0-9-]/g, '');
                const { getTopperInsight } = require('@/services/topperIntelligence');
                const insight = examSlug ? getTopperInsight(examSlug, topicSlug) : null;
                if (!insight) return null;
                const { TopperInsightPanel } = require('@/components/chat/TopperInsightCard');
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-3"
                  >
                    <TopperInsightPanel insight={insight} />
                  </motion.div>
                );
              })()}
            </>
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

  // WhatsApp modal — show on high score (≥80%) if not already opted in
  const scoreOutOf10 = Math.round((correct / answers.length) * 10);
  const isHighScore = scoreOutOf10 >= 8;
  const [showWAModal, setShowWAModal] = useState(
    () => isHighScore && shouldShowWhatsAppPrompt()
  );

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

  // Referral share
  const topTopic = questions[0]?.topic ?? '';
  const examLabel = config.exam === 'All' ? 'JEE Main' : config.exam;

  const handleShare = () => {
    const msg = buildReferralShareMessage(examLabel, scoreOutOf10, topTopic || undefined);
    const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(wa, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* High-score WhatsApp opt-in modal */}
      {showWAModal && (
        <WhatsAppOptInModal
          exam={examLabel}
          source="post_session"
          headline="Great score! 🎉 Want us to track your streak on WhatsApp?"
          onClose={() => setShowWAModal(false)}
        />
      )}

      {/* Confidence card — score summary */}
      <div className="confidence-card p-6 mb-6 text-center">
        <p className="text-4xl mb-2">🎯</p>
        <p className="text-sm text-zinc-400 mb-1">Session Complete!</p>
        <p className={clsx('text-5xl font-black mb-1', gradeColor)}>{grade}</p>
        <p className="text-zinc-400 text-sm mb-3">
          {correct}/{answers.length} correct
        </p>
        <p className="text-4xl font-black text-emerald-400">{accuracy}%</p>
        <p className="text-xs text-zinc-500 mt-1">accuracy</p>
        {accuracy >= 80 && (
          <p className="mt-3 text-sm font-semibold text-emerald-300 achievement-pulse">
            🏆 Excellent! You're in the top tier today.
          </p>
        )}
        {accuracy >= 60 && accuracy < 80 && (
          <p className="mt-3 text-sm font-semibold text-sky-300">
            ⭐ Good effort — review the explanations to push higher!
          </p>
        )}
        {accuracy < 60 && (
          <p className="mt-3 text-sm font-medium text-amber-300">
            💪 Keep going — every attempt makes you stronger!
          </p>
        )}
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4">
          <p className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2"><TrendingUp size={14} /> Revise These Topics</p>
          <div className="flex flex-wrap gap-2">
            {weakTopics.map(t => (
              <span key={t} className="text-xs px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full">{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Referral share card ── */}
      <div className="bg-zinc-900 border border-[#25D366]/30 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🤝</span>
          <div>
            <p className="text-sm font-semibold text-white">Challenge a friend</p>
            <p className="text-xs text-zinc-400">
              Share your score on WhatsApp — see if they can beat you!
            </p>
          </div>
        </div>
        <button
          onClick={handleShare}
          style={{ backgroundColor: '#25D366' }}
          className="w-full mt-2 py-2.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.1 21.9l4.863-1.274A9.947 9.947 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" fill="#fff" fillOpacity="0.9"/>
            <path d="M17.006 14.547c-.274-.137-1.62-.8-1.871-.89-.252-.092-.435-.137-.617.137-.183.274-.708.891-.868 1.074-.16.183-.32.206-.594.069-.274-.137-1.157-.426-2.203-1.36-.815-.726-1.364-1.622-1.524-1.896-.16-.274-.017-.422.12-.559.124-.123.274-.32.411-.48.137-.16.183-.274.274-.457.092-.183.046-.343-.023-.48-.069-.137-.617-1.487-.845-2.036-.222-.534-.449-.462-.617-.47L8 7.998c-.16 0-.411.069-.627.32-.217.252-.823.805-.823 1.963 0 1.158.845 2.277.962 2.437.117.16 1.655 2.535 4.014 3.555.56.242 1 .387 1.34.495.563.179 1.076.154 1.48.093.452-.068 1.391-.568 1.588-1.118.196-.549.196-1.018.137-1.117-.058-.1-.24-.16-.514-.297z" fill="rgba(0,0,0,0.5)"/>
          </svg>
          Share on WhatsApp 🤝
        </button>
      </div>

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
