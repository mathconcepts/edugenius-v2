/**
 * Visual Math Service — Customer-Centric Visual Framework
 *
 * Enhances math explanations with structured visual output.
 * Customer value: Beat ChatGPT on exam specificity, pedagogical depth,
 * and curriculum alignment — not just pretty visuals.
 *
 * No LLM calls — all pre-seeded data + heuristics.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type VisualType =
  | 'number-line'
  | 'graph'
  | 'matrix'
  | 'probability-tree'
  | 'venn'
  | 'formula-box'
  | 'worked-example';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface VisualExplanation {
  concept: string;
  examId: string;
  difficulty: Difficulty;
  visualType: VisualType;
  steps: string[];
  keyFormula: string;           // LaTeX string
  memoryAnchor: string;         // one-liner mnemonic
  examTip: string;              // exam-specific trap or shortcut
  asciiDiagram?: string;        // optional ASCII art
}

export interface VisualConceptCardData extends VisualExplanation {
  topicId: string;
  gateSection?: string;         // e.g. "GATE Paper Section 5 — Engineering Mathematics"
  jeeFrequency?: string;        // e.g. "Appears in ~3 questions per JEE Main"
  practiceLink: string;         // /practice?exam=gate-em&topic=eigenvalues
}

// ── Visual strategy map: topic → best visual type per exam ───────────────────

const VISUAL_STRATEGY_MAP: Record<string, Record<string, VisualType>> = {
  // GATE Engineering Mathematics topics
  'eigenvalues':             { 'gate-engineering-maths': 'matrix',           'jee-main': 'matrix'     },
  'eigenvectors':            { 'gate-engineering-maths': 'matrix',           'jee-main': 'matrix'     },
  'laplace-transform':       { 'gate-engineering-maths': 'formula-box',      'gate': 'formula-box'    },
  'integration':             { 'gate-engineering-maths': 'graph',            'jee-main': 'graph'      },
  'ode':                     { 'gate-engineering-maths': 'worked-example',   'gate': 'worked-example' },
  'probability':             { 'gate-engineering-maths': 'probability-tree', 'jee-main': 'probability-tree' },
  'matrices':                { 'gate-engineering-maths': 'matrix',           'jee-main': 'matrix'     },
  'calculus':                { 'gate-engineering-maths': 'graph',            'jee-main': 'graph'      },
  'fourier-series':          { 'gate-engineering-maths': 'graph',            'gate': 'graph'          },
  'linear-algebra':          { 'gate-engineering-maths': 'matrix',           'jee-main': 'matrix'     },
  'complex-numbers':         { 'gate-engineering-maths': 'graph',            'jee-main': 'graph'      },
  'numerical-methods':       { 'gate-engineering-maths': 'worked-example',   'gate': 'worked-example' },
  'differential-equations':  { 'gate-engineering-maths': 'worked-example',   'jee-main': 'worked-example' },
  'statistics':              { 'gate-engineering-maths': 'probability-tree', 'jee-main': 'formula-box' },
  'vector-calculus':         { 'gate-engineering-maths': 'graph',            'gate': 'graph'          },
  'set-theory':              { 'gate-engineering-maths': 'venn',             'jee-main': 'venn'       },
  'limits':                  { 'gate-engineering-maths': 'graph',            'jee-main': 'graph'      },
  'partial-derivatives':     { 'gate-engineering-maths': 'formula-box',      'jee-main': 'formula-box' },
  'bayes-theorem':           { 'gate-engineering-maths': 'probability-tree', 'jee-main': 'probability-tree' },
  'number-line':             { 'gate-engineering-maths': 'number-line',      'jee-main': 'number-line' },
};

const DEFAULT_VISUAL_STRATEGY: Record<string, VisualType> = {
  'gate-engineering-maths': 'formula-box',
  'jee-main': 'worked-example',
  'jee-advanced': 'worked-example',
  'neet': 'formula-box',
  'cat': 'number-line',
  'gate': 'formula-box',
};

// ── Pre-seeded GATE EM concept bank (10+ topics) ──────────────────────────────

const GATE_EM_CONCEPTS: Record<string, Omit<VisualConceptCardData, 'topicId' | 'practiceLink'>> = {

  'eigenvalues': {
    concept: 'Eigenvalues & Eigenvectors',
    examId: 'gate-engineering-maths',
    difficulty: 'medium',
    visualType: 'matrix',
    steps: [
      'Start with square matrix A (n × n)',
      'Set up characteristic equation: det(A − λI) = 0',
      'Expand the determinant — this gives an n-th degree polynomial in λ',
      'Solve for λ (eigenvalues)',
      'For each λ, solve (A − λI)x = 0 to find eigenvector x',
      'Verify: Ax = λx must hold exactly',
    ],
    keyFormula: '\\det(A - \\lambda I) = 0',
    memoryAnchor: '"Lambda lives on the diagonal" — eigenvalues come from diagonal-λ determinant.',
    examTip: 'GATE trap: For a 2×2 matrix, use trace = λ₁+λ₂ and det = λ₁·λ₂ to verify without full computation. Saves ~2 minutes.',
    gateSection: 'GATE Paper — Engineering Mathematics, Linear Algebra (15–20% weightage)',
    asciiDiagram: `
  Matrix A:         Characteristic Eq:
  ┌ a  b ┐          |a-λ  b  |
  └ c  d ┘    →     | c   d-λ|  = 0
  
  → (a-λ)(d-λ) - bc = 0
  → λ² - (a+d)λ + (ad-bc) = 0
       trace         det(A)
`,
  },

  'laplace-transform': {
    concept: 'Laplace Transform',
    examId: 'gate-engineering-maths',
    difficulty: 'medium',
    visualType: 'formula-box',
    steps: [
      'Identify function f(t) in time domain',
      'Apply definition: L{f(t)} = ∫₀^∞ e^(-st) f(t) dt',
      'Use standard transform pairs from the table (faster in exam)',
      'Apply linearity: L{af+bg} = aL{f} + bL{g}',
      'For inverse: use partial fractions + table look-up',
      'Apply initial/final value theorems to check answers quickly',
    ],
    keyFormula: '\\mathcal{L}\\{f(t)\\} = F(s) = \\int_0^{\\infty} e^{-st} f(t)\\, dt',
    memoryAnchor: '"s-domain surgery" — Laplace converts differential equations into algebra.',
    examTip: 'GATE shortcut: Memorise L{tⁿ}=n!/s^(n+1), L{eᵃᵗ}=1/(s-a), L{sin(at)}=a/(s²+a²). These cover 80% of GATE questions.',
    gateSection: 'GATE Paper — Differential Equations & Transforms (10–12% weightage)',
    asciiDiagram: `
  Time Domain f(t)          s-Domain F(s)
  ─────────────────         ─────────────────
  1          →              1/s
  t          →              1/s²
  eᵃᵗ        →              1/(s-a)
  sin(ωt)    →              ω/(s²+ω²)
  cos(ωt)    →              s/(s²+ω²)
  
  KEY: Solve ODE in s-domain → Invert → Solution
`,
  },

  'integration': {
    concept: 'Definite Integration Techniques',
    examId: 'gate-engineering-maths',
    difficulty: 'easy',
    visualType: 'graph',
    steps: [
      'Identify the integrand type: polynomial, trigonometric, exponential, rational',
      'Choose technique: substitution, by-parts, partial fractions, or standard formula',
      'For definite integrals: find antiderivative F(x), then evaluate F(b) − F(a)',
      'Check using symmetry: for even f(x), ∫₋ₐᵃ = 2∫₀ᵃ; for odd f(x) = 0',
      'King\'s property: ∫₀ᵃ f(x)dx = ∫₀ᵃ f(a-x)dx — saves steps in GATE',
      'Verify with dimensional analysis or boundary conditions',
    ],
    keyFormula: '\\int_a^b f(x)\\,dx = F(b) - F(a),\\quad F\'(x) = f(x)',
    memoryAnchor: '"ILATE rule for by-parts: Inverse, Log, Algebraic, Trig, Exponential."',
    examTip: 'GATE trap: Don\'t expand and integrate. Look for King\'s property first — ∫₀^(π/2) sin/(sin+cos) = π/4 in one line.',
    gateSection: 'GATE Paper — Calculus (12–15% weightage)',
    asciiDiagram: `
       f(x)
        │    ╭─────╮
        │   ╱       ╲
        │  ╱  AREA   ╲
        │ ╱  = ∫f(x)dx╲
        │╱              ╲
  ──────┼────────────────┼─── x
        a                b
  
  Area under curve = definite integral
`,
  },

  'ode': {
    concept: 'Ordinary Differential Equations (ODE)',
    examId: 'gate-engineering-maths',
    difficulty: 'hard',
    visualType: 'worked-example',
    steps: [
      'Determine ODE order (highest derivative) and degree',
      'Classify: linear vs nonlinear, homogeneous vs non-homogeneous',
      'For 1st order: identify if separable, exact, linear (use integrating factor), or Bernoulli',
      'For 2nd order linear: find complementary solution yc from characteristic equation',
      'Find particular solution yp using undetermined coefficients or variation of parameters',
      'General solution = yc + yp; apply initial/boundary conditions to find constants',
    ],
    keyFormula: 'y\'\' + P(x)y\' + Q(x)y = R(x)',
    memoryAnchor: '"CF + PI = General Solution" — Complementary Function + Particular Integral.',
    examTip: 'GATE numerical type: They often give an ODE with initial conditions — always substitute IC to get the final numerical answer, not just the general form.',
    gateSection: 'GATE Paper — Ordinary Differential Equations (8–10% weightage)',
    asciiDiagram: `
  CLASSIFICATION TREE:
  ODE
  ├── 1st Order
  │   ├── Separable: f(x)dx = g(y)dy
  │   ├── Linear: y' + Py = Q → IF = e^∫P dx
  │   ├── Exact: M dx + N dy = 0 (∂M/∂y = ∂N/∂x)
  │   └── Bernoulli: y' + Py = Qyⁿ
  └── 2nd Order
      ├── Homogeneous: y'' + Py' + Qy = 0
      └── Non-hom: y = yc + yp
`,
  },

  'probability': {
    concept: 'Probability & Random Variables',
    examId: 'gate-engineering-maths',
    difficulty: 'medium',
    visualType: 'probability-tree',
    steps: [
      'Define sample space S and event A',
      'Classical: P(A) = |A|/|S| (equally likely outcomes)',
      'Conditional: P(A|B) = P(A∩B)/P(B)',
      'Bayes\' Theorem: P(A|B) = P(B|A)·P(A) / P(B)',
      'For random variables: find E[X] = Σ xᵢP(xᵢ) and Var(X) = E[X²] - (E[X])²',
      'Check: all probabilities sum to 1, P(A) ∈ [0,1]',
    ],
    keyFormula: 'P(A|B) = \\frac{P(B|A)\\cdot P(A)}{P(B)}',
    memoryAnchor: '"Prior × Likelihood → Posterior" — Bayes updates belief with evidence.',
    examTip: 'GATE trap: Don\'t confuse P(A|B) with P(B|A). In disease-testing problems, confusing these leads to wildly wrong answers. Draw the tree first.',
    gateSection: 'GATE Paper — Probability & Statistics (10–12% weightage)',
    asciiDiagram: `
  Bayes Probability Tree:
  
         P(B|A)=0.9 ──→  B│A: P(A)×P(B|A)
  P(A)  ─┤
         P(B'|A)=0.1 ──→ B'│A
  
         P(B|A')=0.2 ──→ B│A': P(A')×P(B|A')
  P(A') ─┤
         P(B'|A')=0.8 ─→ B'│A'
  
  P(A|B) = top-right / (top-right + bottom-right)
`,
  },

  'matrices': {
    concept: 'Matrix Operations & Rank',
    examId: 'gate-engineering-maths',
    difficulty: 'easy',
    visualType: 'matrix',
    steps: [
      'Identify matrix dimensions: m×n (rows × columns)',
      'For multiplication AB: inner dimensions must match (A is m×k, B is k×n)',
      'Transpose: (Aᵀ)ᵢⱼ = Aⱼᵢ; (AB)ᵀ = BᵀAᵀ',
      'Rank: maximum number of linearly independent rows/columns (use row reduction)',
      'Determinant: use cofactor expansion or row operations',
      'Inverse exists iff det(A) ≠ 0 → A⁻¹ = adj(A)/det(A)',
    ],
    keyFormula: '\\text{rank}(A) + \\text{nullity}(A) = n \\quad (\\text{Rank-Nullity Theorem})',
    memoryAnchor: '"Rank + Null = Columns" — what you lose in null space, you lose from rank.',
    examTip: 'GATE favourite: Rank-Nullity theorem directly gives nullity = n - rank. System Ax=b is consistent iff rank(A) = rank([A|b]).',
    gateSection: 'GATE Paper — Linear Algebra (15–20% weightage)',
    asciiDiagram: `
  Row Reduction (RREF):
  ┌ 1  2  3 ┐       ┌ 1  0  -1 ┐
  │ 4  5  6 │  →    │ 0  1   2 │
  └ 7  8  9 ┘       └ 0  0   0 ┘
  
  Rank = 2 (two non-zero rows)
  Nullity = 3 - 2 = 1
`,
  },

  'fourier-series': {
    concept: 'Fourier Series',
    examId: 'gate-engineering-maths',
    difficulty: 'medium',
    visualType: 'graph',
    steps: [
      'Check if f(x) is periodic with period 2L',
      'Compute a₀ = (1/L) ∫₋ₗᴸ f(x) dx',
      'Compute aₙ = (1/L) ∫₋ₗᴸ f(x)cos(nπx/L) dx',
      'Compute bₙ = (1/L) ∫₋ₗᴸ f(x)sin(nπx/L) dx',
      'Write series: f(x) = a₀/2 + Σ[aₙcos(nπx/L) + bₙsin(nπx/L)]',
      'Check: even function → bₙ=0; odd function → aₙ=0 (saves half the work)',
    ],
    keyFormula: 'f(x) = \\frac{a_0}{2} + \\sum_{n=1}^{\\infty}\\left[a_n\\cos\\frac{n\\pi x}{L} + b_n\\sin\\frac{n\\pi x}{L}\\right]',
    memoryAnchor: '"Even=cosines, Odd=sines" — symmetry kills half the coefficients.',
    examTip: 'GATE shortcut: First check symmetry of f(x). If even, all bₙ=0 and you only compute aₙ. This halves your integration work on numerical types.',
    gateSection: 'GATE Paper — Transforms (8–10% weightage)',
  },

  'complex-numbers': {
    concept: 'Complex Numbers & Cauchy-Riemann',
    examId: 'gate-engineering-maths',
    difficulty: 'medium',
    visualType: 'graph',
    steps: [
      'Express z = x + iy (rectangular) or r·e^(iθ) = r(cosθ + i·sinθ) (polar)',
      'Modulus |z| = √(x²+y²); argument arg(z) = arctan(y/x)',
      'For analytic functions: check Cauchy-Riemann equations',
      'C-R equations: ∂u/∂x = ∂v/∂y AND ∂u/∂y = -∂v/∂x',
      'If C-R satisfied + partial derivatives continuous → function is analytic',
      'Use residue theorem for contour integration problems',
    ],
    keyFormula: '\\frac{\\partial u}{\\partial x} = \\frac{\\partial v}{\\partial y}, \\quad \\frac{\\partial u}{\\partial y} = -\\frac{\\partial v}{\\partial x}',
    memoryAnchor: '"∂u/∂x = ∂v/∂y: Same sign. ∂u/∂y = -∂v/∂x: Opposite sign."',
    examTip: 'GATE trap: Analytic ≠ differentiable everywhere. Always verify C-R conditions AND continuity of partials. f(z)=|z|² fails C-R everywhere except origin.',
    gateSection: 'GATE Paper — Complex Variables (5–8% weightage)',
    asciiDiagram: `
  Complex Plane (Argand):
  
  Im(z)
  │      × z = x+iy
  │     ╱│
  │    ╱ │
  │ r╱  │ y
  │  ╱θ │
  │ ╱   │
  ├─────────── Re(z)
  0    x
  
  r = |z| = √(x²+y²)
  θ = arg(z) = arctan(y/x)
`,
  },

  'numerical-methods': {
    concept: 'Numerical Methods (Newton-Raphson, Gauss)',
    examId: 'gate-engineering-maths',
    difficulty: 'medium',
    visualType: 'worked-example',
    steps: [
      'Newton-Raphson: start with initial guess x₀',
      'Iterate: xₙ₊₁ = xₙ - f(xₙ)/f\'(xₙ)',
      'Converges quadratically near the root (fast!)',
      'For linear systems: Gauss elimination → row reduce [A|b] to RREF',
      'Gauss-Seidel: iterative method — update each variable using latest values',
      'Check convergence: Gauss-Seidel converges when A is diagonally dominant',
    ],
    keyFormula: 'x_{n+1} = x_n - \\frac{f(x_n)}{f\'(x_n)}',
    memoryAnchor: '"Tangent line to the rescue" — Newton-Raphson follows the tangent to find next guess.',
    examTip: 'GATE numerical: They give f(x) and x₀, ask for x₂. Always compute f(x₀), f\'(x₀), get x₁, then repeat. Don\'t skip steps — they check intermediate values.',
    gateSection: 'GATE Paper — Numerical Methods (5–8% weightage)',
    asciiDiagram: `
  Newton-Raphson Visualization:
  
  f(x)
  │    ╭╮
  │   ╱  ╲     Tangent line at x₀
  │  ╱    ╲   ╱
  │ ╱      ╲ ╱
  │╱   x₁   x₀ ── x
  ┼──────────────────
  
  Tangent at x₀ crosses x-axis at x₁
  → x₁ closer to root than x₀
`,
  },

  'vector-calculus': {
    concept: 'Vector Calculus (Gradient, Divergence, Curl)',
    examId: 'gate-engineering-maths',
    difficulty: 'hard',
    visualType: 'graph',
    steps: [
      'Gradient ∇f: points in direction of steepest increase; ∇f = (∂f/∂x, ∂f/∂y, ∂f/∂z)',
      'Divergence ∇·F: scalar measure of "source/sink" at a point',
      'Curl ∇×F: vector measure of rotation at a point',
      'Gauss\'s theorem: ∯ F·dS = ∭ ∇·F dV (surface to volume)',
      'Stokes\' theorem: ∮ F·dr = ∬ (∇×F)·dS (line to surface)',
      'Conservative field: ∇×F = 0 ↔ F = ∇φ (path independent)',
    ],
    keyFormula: '\\nabla \\times (\\nabla f) = \\mathbf{0}, \\quad \\nabla \\cdot (\\nabla \\times \\mathbf{F}) = 0',
    memoryAnchor: '"Curl of gradient = 0, Div of curl = 0" — the two free lunch identities.',
    examTip: 'GATE trick: Before computing a line integral, check if F is conservative (curl=0). If yes, use potential function φ — integral = φ(end) - φ(start). Much faster.',
    gateSection: 'GATE Paper — Calculus (10–12% weightage)',
  },

  'statistics': {
    concept: 'Statistics: Mean, Variance, Distributions',
    examId: 'gate-engineering-maths',
    difficulty: 'easy',
    visualType: 'formula-box',
    steps: [
      'Mean (μ): average of all values = Σxᵢ/n',
      'Variance (σ²): E[(X-μ)²] = E[X²] - (E[X])²',
      'Standard Deviation σ = √Variance',
      'Normal distribution: 68-95-99.7 rule (1σ, 2σ, 3σ coverage)',
      'Binomial: P(X=k) = C(n,k)·pᵏ·(1-p)^(n-k); mean=np, var=np(1-p)',
      'Poisson: P(X=k) = e^(-λ)·λᵏ/k!; mean=var=λ',
    ],
    keyFormula: '\\sigma^2 = E[X^2] - (E[X])^2 = \\frac{\\sum(x_i - \\mu)^2}{n}',
    memoryAnchor: '"Var = E of square minus Square of E" — never forget the shortcut formula.',
    examTip: 'GATE favourite: E[X²] - (E[X])² is faster than computing deviations. For Poisson, mean = variance = λ — they test this directly.',
    gateSection: 'GATE Paper — Probability & Statistics (10–12% weightage)',
  },

  'partial-derivatives': {
    concept: 'Partial Derivatives & Maxima/Minima',
    examId: 'gate-engineering-maths',
    difficulty: 'medium',
    visualType: 'formula-box',
    steps: [
      'Partial derivative ∂f/∂x: differentiate w.r.t x treating y as constant',
      'Find critical points: set ∂f/∂x = 0 AND ∂f/∂y = 0',
      'Compute second-order partials: fxx, fyy, fxy',
      'Discriminant D = fxx·fyy - (fxy)²',
      'If D > 0, fxx > 0 → local minimum; D > 0, fxx < 0 → local maximum',
      'If D < 0 → saddle point; D = 0 → test is inconclusive',
    ],
    keyFormula: 'D = f_{xx}f_{yy} - f_{xy}^2',
    memoryAnchor: '"Discriminant decides destiny" — D > 0 means max or min, D < 0 means saddle.',
    examTip: 'GATE pattern: They almost always have 2-variable optimization with a quadratic. Compute D quickly — don\'t waste time verifying with substitution.',
    gateSection: 'GATE Paper — Calculus (12–15% weightage)',
  },

  'bayes-theorem': {
    concept: 'Bayes\' Theorem & Conditional Probability',
    examId: 'gate-engineering-maths',
    difficulty: 'medium',
    visualType: 'probability-tree',
    steps: [
      'Identify prior probability P(A) — what you know before evidence',
      'Identify likelihood P(B|A) — probability of evidence given hypothesis',
      'Compute P(B) using total probability: P(B) = P(B|A)P(A) + P(B|A\')P(A\')',
      'Apply Bayes: P(A|B) = P(B|A)·P(A) / P(B)',
      'Draw the probability tree — it eliminates confusion',
      'Check: P(A|B) + P(A\'|B) must = 1',
    ],
    keyFormula: 'P(A|B) = \\frac{P(B|A) \\cdot P(A)}{P(B|A)P(A) + P(B|A^c)P(A^c)}',
    memoryAnchor: '"Flip the condition with Bayes" — you know P(B|A) but want P(A|B).',
    examTip: 'GATE classic: Medical testing / quality control problems. P(defective|tested positive) is NOT the same as P(positive|defective). Tree prevents this error.',
    gateSection: 'GATE Paper — Probability & Statistics (10–12% weightage)',
  },
};

// ── Math concept keyword detector ─────────────────────────────────────────────

const MATH_KEYWORDS = [
  'formula', 'equation', 'theorem', 'law', 'proof', 'calculate',
  'eigenvalue', 'eigenvector', 'matrix', 'laplace', 'integral', 'derivative',
  'probability', 'fourier', 'differential', 'complex', 'vector', 'gradient',
  'variance', 'statistics', 'numerical', 'calculus', 'determinant', 'rank',
  'linear algebra', 'ode', 'transform', 'convergence', 'divergence', 'curl',
];

/**
 * Detect if a text response contains a math concept.
 */
export function containsMathConcept(text: string): boolean {
  const lower = text.toLowerCase();
  return MATH_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Detect the most likely topic from response text.
 */
export function detectTopicFromText(text: string): string | null {
  const lower = text.toLowerCase();
  const topicMap: Record<string, string[]> = {
    'eigenvalues': ['eigenvalue', 'eigenvector', 'characteristic equation'],
    'laplace-transform': ['laplace transform', 'l{', 'laplace'],
    'integration': ['integral', 'integrate', 'antiderivative', 'area under'],
    'ode': ['differential equation', 'ode', 'dy/dx', 'y\'\'', 'homogeneous'],
    'probability': ['probability', 'bayes', 'random variable', 'p(a|b)'],
    'matrices': ['matrix', 'matrices', 'determinant', 'rank', 'singular'],
    'fourier-series': ['fourier series', 'fourier transform'],
    'complex-numbers': ['complex number', 'cauchy-riemann', 'argand', 'contour'],
    'numerical-methods': ['newton-raphson', 'gauss-seidel', 'numerical method'],
    'vector-calculus': ['gradient', 'divergence', 'curl', 'stokes', 'gauss theorem'],
    'statistics': ['mean', 'variance', 'standard deviation', 'normal distribution'],
    'partial-derivatives': ['partial derivative', 'saddle point', 'maxima', 'minima'],
    'bayes-theorem': ['bayes theorem', 'posterior', 'prior probability'],
  };
  for (const [topicId, keywords] of Object.entries(topicMap)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return topicId;
    }
  }
  return null;
}

// ── Core API functions ────────────────────────────────────────────────────────

/**
 * Returns which visualType works best for a given topic and exam.
 */
export function getVisualStrategy(topic: string, examId: string): VisualType {
  const topicKey = topic.toLowerCase().replace(/\s+/g, '-');
  const strategyEntry = VISUAL_STRATEGY_MAP[topicKey];
  if (strategyEntry) {
    return strategyEntry[examId] ?? strategyEntry['gate-engineering-maths'] ?? 'formula-box';
  }
  return DEFAULT_VISUAL_STRATEGY[examId] ?? 'formula-box';
}

/**
 * Returns structured visual explanation for a concept.
 * No LLM calls — uses pre-seeded data with fallback heuristics.
 */
export function renderVisualExplanation(
  concept: string,
  examId: string,
  difficulty: Difficulty = 'medium'
): VisualExplanation {
  const topicKey = concept.toLowerCase().replace(/\s+/g, '-');

  // Try exact match in pre-seeded bank
  const seeded = GATE_EM_CONCEPTS[topicKey];
  if (seeded) {
    return { ...seeded, difficulty };
  }

  // Fuzzy match: find topic whose key is contained in the concept string
  for (const [key, data] of Object.entries(GATE_EM_CONCEPTS)) {
    if (topicKey.includes(key) || key.includes(topicKey)) {
      return { ...data, difficulty };
    }
  }

  // Heuristic fallback: generate a generic visual explanation
  const visualType = getVisualStrategy(concept, examId);
  return {
    concept,
    examId,
    difficulty,
    visualType,
    steps: [
      `Identify the key variables and given information in the problem`,
      `Recall the relevant formula or theorem for ${concept}`,
      `Set up the equation with the given values`,
      `Solve step by step, showing all working`,
      `Verify the answer using boundary conditions or special cases`,
      `State the final answer with correct units/notation`,
    ],
    keyFormula: `\\text{Apply the ${concept} formula}`,
    memoryAnchor: `Break it down: What's given → What formula applies → Substitute → Solve.`,
    examTip: `Always write the formula first before substituting values. GATE examiners award method marks even if the final answer is wrong.`,
  };
}

/**
 * Builds a complete VisualConceptCardData object for a topic.
 */
export function buildConceptCard(topic: string, examId: string): VisualConceptCardData {
  const topicKey = topic.toLowerCase().replace(/\s+/g, '-');
  const base = renderVisualExplanation(topic, examId);
  const seeded = GATE_EM_CONCEPTS[topicKey];

  return {
    ...base,
    topicId: topicKey,
    gateSection: seeded?.gateSection,
    jeeFrequency: examId.includes('jee')
      ? `Appears in approximately 2–3 questions per JEE Main paper (${topic})`
      : undefined,
    practiceLink: `/practice?exam=${encodeURIComponent(examId)}&topic=${encodeURIComponent(topicKey)}`,
  };
}

/**
 * Get all available pre-seeded topics for a given exam.
 */
export function getAvailableTopics(examId: string): string[] {
  return Object.keys(GATE_EM_CONCEPTS).filter(key => {
    const concept = GATE_EM_CONCEPTS[key];
    return concept.examId === examId || examId === 'gate-engineering-maths';
  });
}
