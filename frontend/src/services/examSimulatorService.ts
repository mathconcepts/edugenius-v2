/**
 * examSimulatorService.ts — Live exam simulation with timer, negative marking
 * No API key required — uses embedded mock exams
 */

export interface SimExam {
  id: string;
  name: string;
  totalQuestions: number;
  durationMinutes: number;
  sections: SimSection[];
}

export interface SimSection {
  name: string;
  questions: SimQuestion[];
}

export interface SimQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  marks: number;
  negativeMarks: number;
}

export interface ExamSession {
  examId: string;
  startTime: number;
  answers: Record<string, number | null>; // questionId -> selectedIndex
  flagged: string[]; // serializable (no Set)
  timeLeft: number; // seconds
  submitted: boolean;
}

export interface ExamResult {
  totalMarks: number;
  maxMarks: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  percentile: number; // mock
  sectionBreakdown: Record<string, { correct: number; total: number; marks: number }>;
  timeTaken: number; // seconds
  rank: number; // mock
  totalParticipants: number; // mock
}

// ─── Mock Exam Bank ───────────────────────────────────────────────────────────

export function getGATEMockExam(): SimExam {
  return {
    id: 'gate-em-mock-1',
    name: 'GATE 2026 — Electromagnetics Mock Test',
    totalQuestions: 10,
    durationMinutes: 20,
    sections: [
      {
        name: 'Electromagnetics',
        questions: [
          {
            id: 'q1', subject: 'EM', difficulty: 'medium', marks: 2, negativeMarks: 0.67,
            text: 'The divergence of the magnetic flux density B is always:',
            options: ['Positive', 'Negative', 'Zero', 'Infinite'],
            correctIndex: 2,
            explanation: '∇·B = 0 (Maxwell\'s 2nd equation — no magnetic monopoles exist)',
          },
          {
            id: 'q2', subject: 'EM', difficulty: 'hard', marks: 2, negativeMarks: 0.67,
            text: 'A uniform plane wave traveling in free space has E = 10 V/m. What is H?',
            options: ['26.5 mA/m', '37.7 mA/m', '10 mA/m', '120π mA/m'],
            correctIndex: 0,
            explanation: 'Intrinsic impedance η₀ = 377Ω ≈ 120π Ω. H = E/η₀ = 10/377 ≈ 26.5 mA/m',
          },
          {
            id: 'q3', subject: 'EM', difficulty: 'easy', marks: 1, negativeMarks: 0.33,
            text: 'Faraday\'s law of electromagnetic induction relates:',
            options: ['E and charge density', 'B and current density', 'EMF and changing magnetic flux', 'H and B'],
            correctIndex: 2,
            explanation: 'Faraday\'s law: EMF = -dΦ/dt — rate of change of magnetic flux induces EMF',
          },
          {
            id: 'q4', subject: 'EM', difficulty: 'medium', marks: 2, negativeMarks: 0.67,
            text: 'In a conductor, Ohm\'s law in point form is:',
            options: ['J = σE', 'J = εE', 'J = μE', 'J = E/σ'],
            correctIndex: 0,
            explanation: 'Point form of Ohm\'s law: J = σE where σ is conductivity (S/m)',
          },
          {
            id: 'q5', subject: 'EM', difficulty: 'hard', marks: 2, negativeMarks: 0.67,
            text: 'Skin depth for a good conductor is proportional to:',
            options: ['√f', '1/√f', 'f', '1/f'],
            correctIndex: 1,
            explanation: 'δ = 1/√(πfμσ) — skin depth decreases as frequency increases (1/√f relationship)',
          },
          {
            id: 'q6', subject: 'EM', difficulty: 'medium', marks: 2, negativeMarks: 0.67,
            text: 'The curl of the electric field E in a time-varying field equals:',
            options: ['∂D/∂t', '−∂B/∂t', 'J', '∇·E'],
            correctIndex: 1,
            explanation: 'Faraday\'s law in differential form: ∇×E = −∂B/∂t',
          },
          {
            id: 'q7', subject: 'EM', difficulty: 'easy', marks: 1, negativeMarks: 0.33,
            text: 'The unit of magnetic flux density B is:',
            options: ['Weber (Wb)', 'Tesla (T)', 'Henry (H)', 'Ampere/meter (A/m)'],
            correctIndex: 1,
            explanation: 'Magnetic flux density B is measured in Tesla (T = Wb/m²)',
          },
          {
            id: 'q8', subject: 'EM', difficulty: 'hard', marks: 2, negativeMarks: 0.67,
            text: 'For a transmission line, the reflection coefficient Γ = 0 when:',
            options: ['ZL = 0', 'ZL = ∞', 'ZL = Z₀', 'ZL = 2Z₀'],
            correctIndex: 2,
            explanation: 'Γ = (ZL − Z₀)/(ZL + Z₀). When ZL = Z₀ (matched load), Γ = 0, no reflection.',
          },
          {
            id: 'q9', subject: 'EM', difficulty: 'medium', marks: 2, negativeMarks: 0.67,
            text: 'Lenz\'s Law states that induced current creates a magnetic field that:',
            options: [
              'Aids the original flux change',
              'Opposes the original flux change',
              'Is perpendicular to original flux',
              'Has no relation to original flux',
            ],
            correctIndex: 1,
            explanation: 'Lenz\'s Law: induced EMF/current opposes the change in flux that caused it (energy conservation)',
          },
          {
            id: 'q10', subject: 'EM', difficulty: 'easy', marks: 1, negativeMarks: 0.33,
            text: 'Gauss\'s law for magnetism states:',
            options: ['∮B·dS = Q_enc/ε₀', '∮B·dS = 0', '∮B·dl = I_enc', '∇×B = 0'],
            correctIndex: 1,
            explanation: '∮B·dS = 0 — total magnetic flux through any closed surface is zero (no magnetic monopoles)',
          },
        ],
      },
    ],
  };
}

export function getCSMockExam(): SimExam {
  return {
    id: 'gate-cs-mock-1',
    name: 'GATE 2026 — Computer Science Mock Test',
    totalQuestions: 10,
    durationMinutes: 20,
    sections: [
      {
        name: 'Data Structures & Algorithms',
        questions: [
          {
            id: 'cs1', subject: 'DSA', difficulty: 'medium', marks: 2, negativeMarks: 0.67,
            text: 'What is the worst-case time complexity of QuickSort?',
            options: ['O(n log n)', 'O(n²)', 'O(n)', 'O(log n)'],
            correctIndex: 1,
            explanation: 'QuickSort worst case is O(n²) when pivot is always the smallest/largest element',
          },
          {
            id: 'cs2', subject: 'DSA', difficulty: 'easy', marks: 1, negativeMarks: 0.33,
            text: 'Which data structure uses FIFO order?',
            options: ['Stack', 'Queue', 'Heap', 'Tree'],
            correctIndex: 1,
            explanation: 'Queue uses FIFO (First In, First Out). Stack uses LIFO.',
          },
          {
            id: 'cs3', subject: 'DSA', difficulty: 'hard', marks: 2, negativeMarks: 0.67,
            text: 'The height of a balanced BST with n nodes is:',
            options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(√n)'],
            correctIndex: 1,
            explanation: 'A balanced BST has height O(log n), ensuring O(log n) search/insert/delete',
          },
          {
            id: 'cs4', subject: 'OS', difficulty: 'medium', marks: 2, negativeMarks: 0.67,
            text: 'Belady\'s Anomaly occurs in which page replacement algorithm?',
            options: ['LRU', 'Optimal', 'FIFO', 'Clock'],
            correctIndex: 2,
            explanation: 'FIFO exhibits Belady\'s anomaly — more frames can sometimes cause MORE page faults',
          },
          {
            id: 'cs5', subject: 'TOC', difficulty: 'hard', marks: 2, negativeMarks: 0.67,
            text: 'The language L = {aⁿbⁿ | n ≥ 0} is:',
            options: ['Regular', 'Context-free but not regular', 'Context-sensitive', 'Turing-decidable only'],
            correctIndex: 1,
            explanation: 'aⁿbⁿ requires counting (push/pop), achievable by PDA but not DFA/NFA',
          },
          {
            id: 'cs6', subject: 'DBMS', difficulty: 'medium', marks: 2, negativeMarks: 0.67,
            text: 'Which normal form eliminates transitive functional dependencies?',
            options: ['1NF', '2NF', '3NF', 'BCNF'],
            correctIndex: 2,
            explanation: '3NF eliminates transitive dependencies. BCNF is stronger but may not always be achievable.',
          },
          {
            id: 'cs7', subject: 'Networks', difficulty: 'easy', marks: 1, negativeMarks: 0.33,
            text: 'TCP uses which type of connection setup?',
            options: ['Two-way handshake', 'Three-way handshake', 'Four-way handshake', 'No handshake'],
            correctIndex: 1,
            explanation: 'TCP uses a 3-way handshake: SYN → SYN-ACK → ACK',
          },
          {
            id: 'cs8', subject: 'DSA', difficulty: 'hard', marks: 2, negativeMarks: 0.67,
            text: 'Dijkstra\'s algorithm fails when graph has:',
            options: ['Directed edges', 'Undirected edges', 'Negative edge weights', 'Cycles'],
            correctIndex: 2,
            explanation: 'Dijkstra\'s greedy approach breaks with negative weights. Use Bellman-Ford instead.',
          },
          {
            id: 'cs9', subject: 'OS', difficulty: 'medium', marks: 2, negativeMarks: 0.67,
            text: 'The critical section problem requires which three properties?',
            options: [
              'Mutual exclusion, Progress, Bounded waiting',
              'Mutual exclusion, Synchronization, Deadlock freedom',
              'Atomicity, Consistency, Isolation',
              'Fairness, Safety, Liveness',
            ],
            correctIndex: 0,
            explanation: 'Mutual exclusion (no two in CS), Progress (no unnecessary blocking), Bounded waiting (fair)',
          },
          {
            id: 'cs10', subject: 'TOC', difficulty: 'medium', marks: 2, negativeMarks: 0.67,
            text: 'The halting problem is:',
            options: ['Decidable', 'Semi-decidable but not decidable', 'Undecidable', 'Context-free'],
            correctIndex: 2,
            explanation: 'Halting problem is undecidable — proved by Alan Turing via diagonalization argument',
          },
        ],
      },
    ],
  };
}

export function getAllMockExams(): SimExam[] {
  return [getGATEMockExam(), getCSMockExam()];
}

export function calculateResult(exam: SimExam, session: ExamSession): ExamResult {
  let correct = 0, incorrect = 0, unattempted = 0, totalMarks = 0, maxMarks = 0;
  const sectionBreakdown: ExamResult['sectionBreakdown'] = {};

  exam.sections.forEach(section => {
    let sCorrect = 0, sMarks = 0;
    section.questions.forEach(q => {
      maxMarks += q.marks;
      const ans = session.answers[q.id];
      if (ans === null || ans === undefined) {
        unattempted++;
      } else if (ans === q.correctIndex) {
        correct++;
        sCorrect++;
        totalMarks += q.marks;
        sMarks += q.marks;
      } else {
        incorrect++;
        totalMarks -= q.negativeMarks;
        sMarks -= q.negativeMarks;
      }
    });
    sectionBreakdown[section.name] = {
      correct: sCorrect,
      total: section.questions.length,
      marks: Math.max(0, sMarks),
    };
  });

  const clampedTotal = Math.max(0, totalMarks);
  const pct = maxMarks > 0 ? (clampedTotal / maxMarks) * 100 : 0;
  const percentile = Math.min(99, Math.max(1, Math.round(pct * 1.05 + 10)));

  return {
    totalMarks: clampedTotal,
    maxMarks,
    correct,
    incorrect,
    unattempted,
    percentile,
    sectionBreakdown,
    timeTaken: exam.durationMinutes * 60 - (session.timeLeft ?? 0),
    rank: Math.max(1, Math.round(100000 * (1 - percentile / 100))),
    totalParticipants: 100000,
  };
}

const SESSION_KEY = 'eg_exam_session';

export function saveSession(session: ExamSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    ...session,
    flagged: Array.from(session.flagged), // ensure array
  }));
}

export function loadSession(): ExamSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ExamSession;
  } catch { return null; }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
