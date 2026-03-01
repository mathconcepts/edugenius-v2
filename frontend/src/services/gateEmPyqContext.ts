/**
 * GATE Engineering Mathematics — Static PYQ Context
 * 
 * 30 previous year questions (2018–2024) across all 10 topics.
 * Embedded directly in the bundle — no Supabase or external DB required.
 * Injected into Sage's Gemini context window for RAG-style grounding.
 */

export interface PyqQuestion {
  year: number;
  topic: string;
  question: string;
  options: Record<string, string>;
  answer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const GATE_EM_PYQS: PyqQuestion[] = [
  // ── LINEAR ALGEBRA ──────────────────────────────────────
  {
    year: 2023, topic: 'linear-algebra', difficulty: 'easy',
    question: 'The eigenvalues of the matrix [[3, 1], [0, 3]] are',
    options: { A: '3, 3', B: '3, 0', C: '1, 3', D: '0, 1' },
    answer: 'A',
    explanation: 'The matrix is upper triangular. Eigenvalues of a triangular matrix are the diagonal entries: 3 and 3.',
  },
  {
    year: 2022, topic: 'linear-algebra', difficulty: 'medium',
    question: 'The rank of the matrix [[1,2,3],[4,5,6],[7,8,9]] is',
    options: { A: '1', B: '2', C: '3', D: '0' },
    answer: 'B',
    explanation: 'Row reduce: R2 = R2 - 4*R1, R3 = R3 - 7*R1. R3 becomes [0,0,0]. Two non-zero rows remain, so rank = 2.',
  },
  {
    year: 2021, topic: 'linear-algebra', difficulty: 'medium',
    question: 'If A is an n×n matrix with det(A) = 0, then the system Ax = b',
    options: { A: 'always has a unique solution', B: 'has no solution', C: 'has infinitely many solutions or no solution', D: 'always has infinitely many solutions' },
    answer: 'C',
    explanation: 'det(A) = 0 means A is singular. The system is either inconsistent (no solution) or has infinitely many solutions, depending on b.',
  },

  // ── CALCULUS ─────────────────────────────────────────────
  {
    year: 2024, topic: 'calculus', difficulty: 'medium',
    question: 'The value of lim(x→0) (sin x - x) / x³ is',
    options: { A: '-1/6', B: '1/6', C: '0', D: '-1/3' },
    answer: 'A',
    explanation: 'Using Taylor series: sin x = x - x³/6 + ... So (sin x - x)/x³ = -x³/6 / x³ = -1/6.',
  },
  {
    year: 2022, topic: 'calculus', difficulty: 'medium',
    question: 'The maximum value of f(x) = x³ - 3x on [-2, 2] is',
    options: { A: '2', B: '-2', C: '4', D: '-4' },
    answer: 'A',
    explanation: "f'(x) = 3x² - 3 = 0 → x = ±1. f(1) = -2, f(-1) = 2, f(2) = 2, f(-2) = -2. Maximum = 2.",
  },
  {
    year: 2020, topic: 'calculus', difficulty: 'medium',
    question: 'The double integral ∫₀¹ ∫₀ˣ y dy dx equals',
    options: { A: '1/6', B: '1/3', C: '1/2', D: '1/4' },
    answer: 'A',
    explanation: 'Inner integral: ∫₀ˣ y dy = x²/2. Outer: ∫₀¹ x²/2 dx = [x³/6]₀¹ = 1/6.',
  },

  // ── DIFFERENTIAL EQUATIONS ────────────────────────────────
  {
    year: 2023, topic: 'differential-equations', difficulty: 'hard',
    question: 'The general solution of dy/dx + y = eˣ is',
    options: { A: 'y = (eˣ/2) + Ce⁻ˣ', B: 'y = eˣ + Ce⁻ˣ', C: 'y = eˣ/2 + Ceˣ', D: 'y = 2eˣ + Ce⁻ˣ' },
    answer: 'A',
    explanation: 'Integrating factor μ = eˣ. d(yeˣ)/dx = e²ˣ. Integrate: yeˣ = e²ˣ/2 + C. So y = eˣ/2 + Ce⁻ˣ.',
  },
  {
    year: 2021, topic: 'differential-equations', difficulty: 'easy',
    question: 'The order and degree of the ODE (d²y/dx²)³ + (dy/dx)² + y = 0 are respectively',
    options: { A: '2 and 3', B: '3 and 2', C: '2 and 2', D: '3 and 3' },
    answer: 'A',
    explanation: 'Order = highest derivative = 2 (d²y/dx²). Degree = power of highest derivative = 3.',
  },
  {
    year: 2019, topic: 'differential-equations', difficulty: 'hard',
    question: 'The particular integral of d²y/dx² + 4y = cos 2x is',
    options: { A: 'x sin 2x / 4', B: 'cos 2x / 4', C: 'x cos 2x / 4', D: 'sin 2x / 4' },
    answer: 'A',
    explanation: 'Since 2 is a root of the characteristic equation m² + 4 = 0, we use the formula for repeated case: PI = x sin 2x / 4.',
  },

  // ── COMPLEX VARIABLES ─────────────────────────────────────
  {
    year: 2024, topic: 'complex-variables', difficulty: 'medium',
    question: 'The residue of f(z) = 1/(z² + 1) at z = i is',
    options: { A: '1/(2i)', B: '-1/(2i)', C: '1/2', D: '-1/2' },
    answer: 'A',
    explanation: 'Simple poles at z = ±i. Residue at z = i: lim(z→i)(z-i)·1/((z-i)(z+i)) = 1/(2i).',
  },
  {
    year: 2022, topic: 'complex-variables', difficulty: 'hard',
    question: 'The function f(z) = |z|² is',
    options: { A: 'analytic everywhere', B: 'analytic nowhere', C: 'analytic only at z = 0', D: 'analytic on the real axis' },
    answer: 'C',
    explanation: 'f(z) = x² + y². Check Cauchy-Riemann: ∂u/∂x = 2x = ∂v/∂y = 0 only if x = 0 and y = 0. So analytic only at origin.',
  },
  {
    year: 2020, topic: 'complex-variables', difficulty: 'medium',
    question: 'The value of the contour integral ∮_C dz/(z-2) where C is |z| = 3 is',
    options: { A: '2πi', B: '0', C: 'πi', D: '-2πi' },
    answer: 'A',
    explanation: "z = 2 is inside |z| = 3. By Cauchy's integral formula: ∮ dz/(z-a) = 2πi for a inside C.",
  },

  // ── PROBABILITY & STATISTICS ──────────────────────────────
  {
    year: 2023, topic: 'probability-statistics', difficulty: 'easy',
    question: 'A fair die is rolled twice. The probability that the sum equals 7 is',
    options: { A: '1/6', B: '1/4', C: '5/36', D: '7/36' },
    answer: 'A',
    explanation: 'Pairs summing to 7: (1,6),(2,5),(3,4),(4,3),(5,2),(6,1) = 6 outcomes. P = 6/36 = 1/6.',
  },
  {
    year: 2022, topic: 'probability-statistics', difficulty: 'easy',
    question: 'For a Poisson distribution with mean λ = 2, P(X = 0) equals',
    options: { A: 'e⁻²', B: '2e⁻²', C: '1/e²', D: 'e²' },
    answer: 'A',
    explanation: 'P(X = k) = e⁻λ · λᵏ / k!. P(X=0) = e⁻² · 2⁰ / 0! = e⁻².',
  },
  {
    year: 2021, topic: 'probability-statistics', difficulty: 'easy',
    question: 'The mean and variance of a binomial distribution B(n, p) are respectively',
    options: { A: 'np and np(1-p)', B: 'np and np²', C: 'np(1-p) and np', D: 'n/p and n/p²' },
    answer: 'A',
    explanation: 'Standard result: Mean = np, Variance = npq = np(1-p).',
  },

  // ── NUMERICAL METHODS ─────────────────────────────────────
  {
    year: 2024, topic: 'numerical-methods', difficulty: 'medium',
    question: 'In Newton-Raphson method, the iteration formula for finding √N is',
    options: { A: 'xₙ₊₁ = (xₙ + N/xₙ)/2', B: 'xₙ₊₁ = xₙ - N/xₙ', C: 'xₙ₊₁ = (2xₙ + N)/3', D: 'xₙ₊₁ = xₙ/2 + N' },
    answer: 'A',
    explanation: "For f(x) = x² - N, f'(x) = 2x. NR: xₙ₊₁ = xₙ - (xₙ² - N)/(2xₙ) = (xₙ + N/xₙ)/2.",
  },
  {
    year: 2022, topic: 'numerical-methods', difficulty: 'medium',
    question: 'The trapezoidal rule for ∫ₐᵇ f(x)dx with n intervals has error of order',
    options: { A: 'O(h²)', B: 'O(h³)', C: 'O(h⁴)', D: 'O(h)' },
    answer: 'A',
    explanation: 'The global truncation error for trapezoidal rule is O(h²) where h = (b-a)/n.',
  },
  {
    year: 2020, topic: 'numerical-methods', difficulty: 'medium',
    question: 'The Gauss-Seidel method converges if the coefficient matrix is',
    options: { A: 'diagonally dominant', B: 'symmetric', C: 'orthogonal', D: 'skew-symmetric' },
    answer: 'A',
    explanation: 'Gauss-Seidel is guaranteed to converge when the coefficient matrix is strictly diagonally dominant.',
  },

  // ── TRANSFORM THEORY ──────────────────────────────────────
  {
    year: 2023, topic: 'transform-theory', difficulty: 'medium',
    question: 'The Laplace transform of t·eᵃᵗ is',
    options: { A: '1/(s-a)²', B: '1/(s+a)²', C: 'a/(s-a)²', D: 's/(s-a)²' },
    answer: 'A',
    explanation: 'L{t·eᵃᵗ} = L{t} shifted by a: L{t} = 1/s², so L{t·eᵃᵗ} = 1/(s-a)².',
  },
  {
    year: 2021, topic: 'transform-theory', difficulty: 'easy',
    question: 'The Fourier transform of a rectangular pulse of width τ is a',
    options: { A: 'sinc function', B: 'Gaussian function', C: 'triangular function', D: 'delta function' },
    answer: 'A',
    explanation: 'The Fourier transform of rect(t/τ) is τ·sinc(fτ) = τ·sin(πfτ)/(πfτ). It is a sinc function.',
  },
  {
    year: 2019, topic: 'transform-theory', difficulty: 'easy',
    question: 'If L{f(t)} = F(s), then L{f(t-a)·u(t-a)} equals',
    options: { A: 'e⁻ᵃˢ·F(s)', B: 'eᵃˢ·F(s)', C: 'F(s-a)', D: 'F(s+a)' },
    answer: 'A',
    explanation: 'This is the second shifting theorem (time delay property): L{f(t-a)·u(t-a)} = e⁻ᵃˢ·F(s).',
  },

  // ── DISCRETE MATHEMATICS ─────────────────────────────────
  {
    year: 2024, topic: 'discrete-mathematics', difficulty: 'medium',
    question: 'The number of onto functions from a set of 3 elements to a set of 2 elements is',
    options: { A: '6', B: '4', C: '8', D: '2' },
    answer: 'A',
    explanation: 'Total functions = 2³ = 8. Non-onto (all to one element) = 2. Onto = 8 - 2 = 6.',
  },
  {
    year: 2022, topic: 'discrete-mathematics', difficulty: 'easy',
    question: 'In a group of 100 students, 60 study Maths and 50 study Physics. If 20 study both, how many study neither?',
    options: { A: '10', B: '20', C: '30', D: '40' },
    answer: 'A',
    explanation: '|M∪P| = 60 + 50 - 20 = 90. Neither = 100 - 90 = 10.',
  },
  {
    year: 2020, topic: 'discrete-mathematics', difficulty: 'easy',
    question: 'Which of the following is a tautology?',
    options: { A: 'p ∨ ¬p', B: 'p ∧ ¬p', C: 'p → q', D: 'p ∧ q' },
    answer: 'A',
    explanation: 'p ∨ ¬p is always TRUE (Law of Excluded Middle) — it is a tautology.',
  },

  // ── GRAPH THEORY ─────────────────────────────────────────
  {
    year: 2023, topic: 'graph-theory', difficulty: 'easy',
    question: 'The number of edges in a complete graph Kₙ is',
    options: { A: 'n(n-1)/2', B: 'n²', C: 'n(n+1)/2', D: '2n' },
    answer: 'A',
    explanation: 'In Kₙ every vertex connects to every other: n(n-1)/2 edges.',
  },
  {
    year: 2021, topic: 'graph-theory', difficulty: 'hard',
    question: 'A graph G has 5 vertices and is Eulerian. The minimum number of edges it must have is',
    options: { A: '5', B: '4', C: '6', D: '10' },
    answer: 'A',
    explanation: 'Eulerian graph: connected, all vertices even degree. Min even degree = 2. 5 vertices × degree 2 / 2 = 5 edges.',
  },
  {
    year: 2019, topic: 'graph-theory', difficulty: 'easy',
    question: 'Which of the following is true for a tree with n vertices?',
    options: { A: 'It has exactly n-1 edges', B: 'It has exactly n edges', C: 'It has n+1 edges', D: 'It has n(n-1)/2 edges' },
    answer: 'A',
    explanation: 'A tree with n vertices always has exactly n-1 edges. This is a fundamental property of trees.',
  },

  // ── VECTOR CALCULUS ───────────────────────────────────────
  {
    year: 2024, topic: 'vector-calculus', difficulty: 'easy',
    question: 'The divergence of F = x²î + y²ĵ + z²k̂ at (1,1,1) is',
    options: { A: '6', B: '3', C: '1', D: '9' },
    answer: 'A',
    explanation: 'div F = ∂(x²)/∂x + ∂(y²)/∂y + ∂(z²)/∂z = 2x + 2y + 2z. At (1,1,1): 2+2+2 = 6.',
  },
  {
    year: 2022, topic: 'vector-calculus', difficulty: 'medium',
    question: 'The curl of F = yî - xĵ + 0k̂ is',
    options: { A: '-2k̂', B: '2k̂', C: '0', D: 'î + ĵ' },
    answer: 'A',
    explanation: 'curl F = (∂Fz/∂y - ∂Fy/∂z)î + (∂Fx/∂z - ∂Fz/∂x)ĵ + (∂Fy/∂x - ∂Fx/∂y)k̂ = 0î + 0ĵ + (-1-1)k̂ = -2k̂.',
  },
  {
    year: 2020, topic: 'vector-calculus', difficulty: 'hard',
    question: "By Green's theorem, ∮_C (y dx - x dy) over a closed curve C equals",
    options: { A: '-2A', B: '2A', C: 'A', D: '-A' },
    answer: 'A',
    explanation: "Green's theorem: ∮(P dx + Q dy) = ∬(∂Q/∂x - ∂P/∂y) dA. Here P=y, Q=-x: ∂Q/∂x - ∂P/∂y = -1-1 = -2. So integral = -2A.",
  },
];

/**
 * Get PYQs filtered by topic (optional).
 * Returns all 30 if no topic specified.
 */
export function getPyqsByTopic(topic?: string): PyqQuestion[] {
  if (!topic) return GATE_EM_PYQS;
  return GATE_EM_PYQS.filter(q => q.topic === topic);
}

/**
 * Format PYQs as a compact context block for Gemini's system prompt.
 * Optimised for token efficiency — ~2500 tokens for all 30 questions.
 */
export function formatPyqsForContext(pyqs: PyqQuestion[]): string {
  return pyqs.map(q => {
    const opts = Object.entries(q.options).map(([k, v]) => `${k}) ${v}`).join(' | ');
    return `[GATE ${q.year} | ${q.topic} | ${q.difficulty}]\nQ: ${q.question}\n${opts}\nAnswer: ${q.answer} — ${q.explanation}`;
  }).join('\n\n');
}

/**
 * Build the full static RAG context string to inject into Sage's prompt.
 * Replaces Supabase pgvector lookup entirely.
 */
export function buildStaticRagContext(topicHint?: string): string {
  // If we can detect a topic from context, filter to relevant PYQs + a few others
  const relevant = topicHint
    ? [
        ...getPyqsByTopic(topicHint),        // All from the topic (3 questions)
        ...GATE_EM_PYQS.filter(q => q.topic !== topicHint).slice(0, 5) // 5 from other topics
      ]
    : GATE_EM_PYQS; // All 30 if no topic hint

  return formatPyqsForContext(relevant);
}
