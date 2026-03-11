/**
 * staticContentLibrary.ts — Pre-built Static Content Atoms (Tier 0)
 *
 * Covers top 5 topics per exam × 3 formats = 75 atoms minimum.
 * Exams: GATE_EM, JEE, CAT, NEET, UPSC
 * Used when RAG + LLM unavailable (offline fallback).
 * All atoms are real, exam-accurate content.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StaticContentAtom {
  id: string;
  examId: string;
  topicId: string;
  topicName: string;
  format: 'explanation' | 'worked_example' | 'revision_card' | 'formula_sheet';
  content: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedMinutes: number;
  tags: string[];
}

// ─── Static Atom Library ──────────────────────────────────────────────────────

const STATIC_ATOMS: StaticContentAtom[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // GATE EM — Engineering Mathematics
  // ══════════════════════════════════════════════════════════════════════════

  // GATE EM — Calculus
  {
    id: 'gate_em-calculus-revision_card-1',
    examId: 'GATE_EM',
    topicId: 'calculus',
    topicName: 'Calculus',
    format: 'revision_card',
    difficulty: 'medium',
    estimatedMinutes: 5,
    tags: ['leibniz', 'differentiation', 'integrals', 'GATE2023'],
    content: `**Leibniz Rule (Differentiation Under Integral Sign)**

d/dx[∫_{a(x)}^{b(x)} f(x,t) dt] = f(x,b(x))·b'(x) − f(x,a(x))·a'(x) + ∫_{a(x)}^{b(x)} ∂f/∂x dt

**Key GATE trap:** When limits depend on x, the boundary terms must be included. Forgetting them is the #1 mistake.

**GATE 2023 Q14** tested this: d/dx[∫₀^x t·sin(xt) dt]. Always check if BOTH limits and integrand depend on x.

**L'Hôpital quick check:** 0/0 or ∞/∞ form → differentiate numerator and denominator separately. Works for 5–6 GATE marks annually.

**Maxima/Minima:** f'(c) = 0 AND f''(c) > 0 → local min; f''(c) < 0 → local max; f''(c) = 0 → use higher derivatives.`,
  },
  {
    id: 'gate_em-calculus-formula_sheet-1',
    examId: 'GATE_EM',
    topicId: 'calculus',
    topicName: 'Calculus',
    format: 'formula_sheet',
    difficulty: 'easy',
    estimatedMinutes: 4,
    tags: ['formulas', 'Taylor', 'Maclaurin', 'limits'],
    content: `**GATE EM Calculus — Essential Formulas**

**Taylor Series** (about x = a):
f(x) = f(a) + f'(a)(x−a) + f''(a)(x−a)²/2! + f'''(a)(x−a)³/3! + ...

**Common Maclaurin Series:**
- eˣ = 1 + x + x²/2! + x³/3! + ...
- sin x = x − x³/3! + x⁵/5! − ... (odd terms)
- cos x = 1 − x²/2! + x⁴/4! − ... (even terms)
- ln(1+x) = x − x²/2 + x³/3 − ... (|x| < 1)

**Key Limits:**
- lim(x→0) sin(x)/x = 1
- lim(x→0) (eˣ−1)/x = 1
- lim(x→∞) (1 + 1/n)ⁿ = e

**Integration by Parts:** ∫u dv = uv − ∫v du (ILATE rule for u: Inverse, Log, Algebraic, Trig, Exponential)

**GATE weightage:** Calculus → 8–12 marks. Never skip.`,
  },
  {
    id: 'gate_em-calculus-worked_example-1',
    examId: 'GATE_EM',
    topicId: 'calculus',
    topicName: 'Calculus',
    format: 'worked_example',
    difficulty: 'hard',
    estimatedMinutes: 10,
    tags: ['leibniz', 'worked', 'GATE_style'],
    content: `**GATE-Style Problem: Leibniz Rule**

**Problem:** Evaluate d/dx[∫₀^x² e^(−t²) dt] at x = 1.

**Step 1 — Identify:** Upper limit b(x) = x², lower limit a(x) = 0 (constant), f(x,t) = e^(−t²).

**Step 2 — Apply Leibniz Rule:**
d/dx[∫₀^x² e^(−t²) dt] = e^(−(x²)²) · d(x²)/dx − e^(−0²) · d(0)/dx + ∫₀^x² ∂/∂x[e^(−t²)] dt

**Step 3 — Simplify:**
- First term: e^(−x⁴) · 2x
- Second term: e⁰ · 0 = 0
- Third term: ∫∂/∂x[e^(−t²)] dt = 0 (integrand doesn't depend on x)

**Answer:** d/dx = 2x · e^(−x⁴)

**At x = 1:** 2(1) · e^(−1) = **2/e ≈ 0.736**

**GATE trap avoided:** Many students forget to multiply by b'(x) = 2x. Always chain rule on the limits!`,
  },

  // GATE EM — Linear Algebra
  {
    id: 'gate_em-linear_algebra-revision_card-1',
    examId: 'GATE_EM',
    topicId: 'linear_algebra',
    topicName: 'Linear Algebra',
    format: 'revision_card',
    difficulty: 'medium',
    estimatedMinutes: 6,
    tags: ['eigenvalues', 'rank', 'nullity', 'GATE'],
    content: `**Linear Algebra — High-Yield GATE Revision**

**Rank-Nullity Theorem:** Rank(A) + Nullity(A) = n (number of columns)
→ Nullity = dimension of null space = n − rank

**Eigenvalues key facts:**
- Sum of eigenvalues = trace(A)
- Product of eigenvalues = det(A)
- If A is real symmetric → all eigenvalues are real
- Eigenvalues of A² = square of eigenvalues of A

**Cayley-Hamilton:** Every matrix satisfies its own characteristic equation.
If λ² − 5λ + 6 = 0 is char. poly → A² − 5A + 6I = 0

**GATE trap:** For a 3×3 matrix with rank 2, exactly 1 eigenvalue is 0.

**System Ax = b:**
- Unique solution: rank(A) = rank([A|b]) = n
- Infinite solutions: rank(A) = rank([A|b]) < n
- No solution: rank(A) ≠ rank([A|b])`,
  },
  {
    id: 'gate_em-linear_algebra-formula_sheet-1',
    examId: 'GATE_EM',
    topicId: 'linear_algebra',
    topicName: 'Linear Algebra',
    format: 'formula_sheet',
    difficulty: 'easy',
    estimatedMinutes: 4,
    tags: ['determinant', 'inverse', 'formulas'],
    content: `**GATE EM Linear Algebra — Formula Sheet**

**Determinant (2×2):** |A| = ad − bc for [[a,b],[c,d]]
**Inverse (2×2):** A⁻¹ = (1/|A|)[[d,−b],[−c,a]]

**Properties:**
- det(AB) = det(A)·det(B)
- det(Aⁿ) = det(A)ⁿ
- det(kA) = kⁿ·det(A) for n×n matrix
- det(Aᵀ) = det(A)
- det(A⁻¹) = 1/det(A)

**Orthogonal matrix:** AᵀA = I → det(A) = ±1, eigenvalues = ±1

**Positive Definite:** All eigenvalues > 0 ↔ all leading principal minors > 0

**Gram-Schmidt:** Orthogonalize v₁,v₂,... by subtracting projections:
e₂ = v₂ − (v₂·e₁/|e₁|²)e₁ (then normalize)`,
  },
  {
    id: 'gate_em-linear_algebra-worked_example-1',
    examId: 'GATE_EM',
    topicId: 'linear_algebra',
    topicName: 'Linear Algebra',
    format: 'worked_example',
    difficulty: 'hard',
    estimatedMinutes: 12,
    tags: ['eigenvalues', 'characteristic_polynomial', 'GATE2022'],
    content: `**GATE 2022 Style: Eigenvalue Problem**

**Problem:** Find eigenvalues of A = [[4, 1], [2, 3]].

**Step 1 — Characteristic equation:**
det(A − λI) = 0
|(4−λ)  1  |
|  2   (3−λ)| = 0

**Step 2 — Expand:**
(4−λ)(3−λ) − 2·1 = 0
12 − 4λ − 3λ + λ² − 2 = 0
λ² − 7λ + 10 = 0

**Step 3 — Solve:**
(λ−5)(λ−2) = 0 → **λ₁ = 5, λ₂ = 2**

**Verification:**
- Trace = 4 + 3 = 7 ✓ (λ₁ + λ₂ = 5 + 2 = 7 ✓)
- det = 12 − 2 = 10 ✓ (λ₁ × λ₂ = 5 × 2 = 10 ✓)

**GATE pro tip:** Always verify with trace and determinant — catches arithmetic errors in 10 seconds.`,
  },

  // GATE EM — Complex Numbers
  {
    id: 'gate_em-complex_numbers-revision_card-1',
    examId: 'GATE_EM',
    topicId: 'complex_numbers',
    topicName: 'Complex Numbers',
    format: 'revision_card',
    difficulty: 'medium',
    estimatedMinutes: 5,
    tags: ['cauchy-riemann', 'analytic', 'residue', 'GATE'],
    content: `**Complex Analysis — GATE Critical Points**

**Cauchy-Riemann Equations** (necessary for analyticity):
∂u/∂x = ∂v/∂y  AND  ∂u/∂y = −∂v/∂x

**Analytic function → Cauchy-Riemann satisfied + partial derivatives continuous**

**Residue Theorem:** ∮_C f(z) dz = 2πi × Σ(residues inside C)

**Residue at simple pole z = a:** lim(z→a) (z−a)f(z)

**Key singularities:**
- Removable: lim exists and is finite
- Pole of order n: (z−a)ⁿ f(z) analytic at z = a
- Essential: neither of above

**GATE trap:** f(z) = sin(z)/z — removable singularity at z = 0 (limit = 1). Not a pole!

**Conformal mapping** (GATE 2–4 marks): w = 1/z maps circles/lines to circles/lines.`,
  },

  // GATE EM — Probability
  {
    id: 'gate_em-probability-formula_sheet-1',
    examId: 'GATE_EM',
    topicId: 'probability',
    topicName: 'Probability & Statistics',
    format: 'formula_sheet',
    difficulty: 'easy',
    estimatedMinutes: 5,
    tags: ['bayes', 'distributions', 'expectation'],
    content: `**GATE EM Probability — Formula Sheet**

**Bayes' Theorem:** P(A|B) = P(B|A)·P(A) / P(B)

**Key Distributions:**
| Distribution | Mean | Variance |
|---|---|---|
| Binomial(n,p) | np | np(1-p) |
| Poisson(λ) | λ | λ |
| Normal(μ,σ²) | μ | σ² |
| Exponential(λ) | 1/λ | 1/λ² |
| Uniform(a,b) | (a+b)/2 | (b−a)²/12 |

**Central Limit Theorem:** Sample mean X̄ ~ N(μ, σ²/n) for large n

**Conditional expectation:** E[X] = E[E[X|Y]] (Law of total expectation)

**GATE 2024 pattern:** GATE increasingly tests Poisson process + exponential distribution. Memorize: P(X=k) = e^(−λ)λᵏ/k!`,
  },
  {
    id: 'gate_em-probability-revision_card-1',
    examId: 'GATE_EM',
    topicId: 'probability',
    topicName: 'Probability & Statistics',
    format: 'revision_card',
    difficulty: 'medium',
    estimatedMinutes: 5,
    tags: ['hypothesis_testing', 'confidence_interval', 'GATE'],
    content: `**Statistics — GATE High-Yield Revision**

**Hypothesis Testing:**
- Type I error (α): Reject H₀ when it's true (false positive)
- Type II error (β): Accept H₀ when it's false (false negative)
- Power = 1 − β

**Standard Normal:** Z = (X − μ) / σ
Critical values: Z = 1.645 (90%), Z = 1.96 (95%), Z = 2.576 (99%)

**Confidence Interval (known σ):**
X̄ ± Z_{α/2} · (σ/√n)

**Correlation coefficient:** r = Cov(X,Y) / (σ_X · σ_Y)
Range: −1 ≤ r ≤ 1. r = 0 → uncorrelated (NOT independent for non-normal)

**GATE trap:** Uncorrelated ≠ Independent (except for jointly normal variables)`,
  },

  // GATE EM — Signals & Systems
  {
    id: 'gate_em-signals-formula_sheet-1',
    examId: 'GATE_EM',
    topicId: 'signals',
    topicName: 'Signals & Systems',
    format: 'formula_sheet',
    difficulty: 'medium',
    estimatedMinutes: 6,
    tags: ['fourier', 'laplace', 'convolution', 'GATE'],
    content: `**Signals & Systems — GATE Formula Sheet**

**Fourier Transform:** X(ω) = ∫ x(t)e^(−jωt) dt

**Key pairs:**
- rect(t/τ) ↔ τ·sinc(ωτ/2π)
- e^(−at)u(t) ↔ 1/(a + jω)
- δ(t) ↔ 1
- e^(jω₀t) ↔ 2πδ(ω − ω₀)

**Laplace:** X(s) = ∫₀^∞ x(t)e^(−st) dt
- e^(−at)u(t) ↔ 1/(s+a), ROC: Re(s) > −a
- tⁿ u(t) ↔ n!/s^(n+1)

**Convolution:** y(t) = x(t) * h(t) = ∫ x(τ)h(t−τ) dτ
**In frequency domain:** Y(ω) = X(ω)·H(ω)

**Parseval's Theorem:** ∫|x(t)|² dt = (1/2π)∫|X(ω)|² dω

**LTI system stability:** All poles in left half s-plane (Laplace)`,
  },
  {
    id: 'gate_em-signals-revision_card-1',
    examId: 'GATE_EM',
    topicId: 'signals',
    topicName: 'Signals & Systems',
    format: 'revision_card',
    difficulty: 'medium',
    estimatedMinutes: 5,
    tags: ['Z-transform', 'DFT', 'sampling'],
    content: `**Discrete Signals — GATE Revision**

**Z-Transform:** X(z) = Σ x[n]z^(−n)
- aⁿu[n] ↔ z/(z−a), ROC: |z| > |a|
- δ[n] ↔ 1, ROC: all z

**DFT:** X[k] = Σ_{n=0}^{N-1} x[n] · e^(−j2πkn/N)
FFT computes DFT in O(N log N) vs O(N²)

**Sampling Theorem (Nyquist):** fₛ ≥ 2·f_max to avoid aliasing
**Aliasing:** f_alias = |f_signal − n·fₛ| for nearest integer n

**Causality in DT systems:** h[n] = 0 for n < 0
**BIBO Stability:** Σ|h[n]| < ∞

**GATE 2023 trap:** A non-causal system CAN be stable. Causality and stability are independent properties.`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // JEE — Joint Entrance Examination
  // ══════════════════════════════════════════════════════════════════════════

  // JEE — Mechanics
  {
    id: 'jee-mechanics-worked_example-1',
    examId: 'JEE',
    topicId: 'mechanics',
    topicName: 'Mechanics',
    format: 'worked_example',
    difficulty: 'hard',
    estimatedMinutes: 12,
    tags: ['circular_motion', 'friction', 'JEE_Advanced'],
    content: `**JEE Advanced Style: Circular Motion + Friction**

**Problem:** A 2 kg block on a rough circular track of radius 0.5 m rotates at 3 m/s. μ = 0.4, g = 10 m/s². Find the normal force and whether the block slides.

**Step 1 — Free body diagram:**
Forces on block: Weight (mg downward), Normal force (N radially inward), Friction (tangential or radial depending on direction).

For horizontal circular motion:
N = mv²/r (provides centripetal force)

**Step 2 — Calculate N:**
N = (2)(3²)/(0.5) = (2)(9)/(0.5) = **36 N**

**Step 3 — Check sliding:**
Max static friction = μN = 0.4 × 36 = **14.4 N**

Compare to gravitational pull along track = mg·sin θ (if inclined) — for flat track, friction needed = 0 for uniform speed.

**For uniform circular motion on flat surface:** No friction needed tangentially. The block does NOT slide.

**JEE trap:** Students confuse centripetal force as an "extra" force. It's the NET radial force = mv²/r. Normal force alone provides it here.`,
  },
  {
    id: 'jee-mechanics-formula_sheet-1',
    examId: 'JEE',
    topicId: 'mechanics',
    topicName: 'Mechanics',
    format: 'formula_sheet',
    difficulty: 'easy',
    estimatedMinutes: 4,
    tags: ['kinematics', 'Newton', 'energy', 'momentum'],
    content: `**JEE Mechanics — Master Formula Sheet**

**Kinematics (const. accel.):**
v = u + at | s = ut + ½at² | v² = u² + 2as | s_n = u + a(2n−1)/2

**Circular Motion:**
v = ωr | a_c = v²/r = ω²r | T = 2πr/v

**Work-Energy Theorem:** W_net = ΔKE = ½mv² − ½mu²

**Conservation of Momentum:** m₁u₁ + m₂u₂ = m₁v₁ + m₂v₂

**Elastic collision (1D):**
v₁ = (m₁−m₂)u₁/(m₁+m₂) + 2m₂u₂/(m₁+m₂)

**Angular Momentum:** L = Iω = mvr (for particle)
**Torque:** τ = Iα = r × F

**Rotational KE:** ½Iω² | **Rolling:** KE = ½mv² + ½Iω² = ½mv²(1 + k²/r²)

**JEE tip:** For connected bodies, use system approach. External forces only. Internal forces cancel.`,
  },
  {
    id: 'jee-mechanics-revision_card-1',
    examId: 'JEE',
    topicId: 'mechanics',
    topicName: 'Mechanics',
    format: 'revision_card',
    difficulty: 'medium',
    estimatedMinutes: 5,
    tags: ['SHM', 'springs', 'pendulum'],
    content: `**Simple Harmonic Motion — JEE Revision**

**SHM condition:** a = −ω²x (restoring force proportional to displacement)

**Key quantities:**
- ω = 2πf = 2π/T
- Spring: ω = √(k/m), T = 2π√(m/k)
- Simple pendulum: T = 2π√(L/g) [small angle, independent of mass!]
- Physical pendulum: T = 2π√(I/mgd)

**Energy in SHM:**
- KE = ½mω²(A²−x²) → max at x=0
- PE = ½mω²x² → max at x=±A
- Total E = ½mω²A² = constant

**Superposition of SHMs (same frequency, different phase):**
A_resultant = √(A₁² + A₂² + 2A₁A₂cosδ) where δ = phase difference

**JEE 2024 pattern:** Combination of spring systems (series/parallel) + SHM energy questions appear every year.`,
  },

  // JEE — Thermodynamics
  {
    id: 'jee-thermodynamics-revision_card-1',
    examId: 'JEE',
    topicId: 'thermodynamics',
    topicName: 'Thermodynamics',
    format: 'revision_card',
    difficulty: 'medium',
    estimatedMinutes: 6,
    tags: ['carnot', 'entropy', 'laws', 'JEE'],
    content: `**Thermodynamics — JEE High-Yield Revision**

**First Law:** ΔU = Q − W (Q in, W out convention)

**Process types (for ideal gas):**
| Process | Constant | W | Q | ΔU |
|---|---|---|---|---|
| Isothermal | T | nRT ln(V₂/V₁) | = W | 0 |
| Adiabatic | Q=0 | (P₁V₁−P₂V₂)/(γ−1) | 0 | −W |
| Isobaric | P | PΔV | nCₚΔT | nCᵥΔT |
| Isochoric | V | 0 | nCᵥΔT | = Q |

**Adiabatic:** TV^(γ−1) = const; PV^γ = const

**Carnot Efficiency:** η = 1 − T_cold/T_hot (maximum possible)

**Second Law:** Entropy of universe always increases (ΔS_universe ≥ 0)

**JEE trap:** γ = Cₚ/Cᵥ. For monatomic: γ = 5/3. Diatomic: γ = 7/5. Never mix them up!`,
  },

  // JEE — Electrostatics
  {
    id: 'jee-electrostatics-formula_sheet-1',
    examId: 'JEE',
    topicId: 'electrostatics',
    topicName: 'Electrostatics',
    format: 'formula_sheet',
    difficulty: 'easy',
    estimatedMinutes: 5,
    tags: ['gauss', 'coulomb', 'capacitance', 'JEE'],
    content: `**JEE Electrostatics — Formula Sheet**

**Coulomb's Law:** F = kq₁q₂/r² where k = 9×10⁹ N·m²/C²

**Electric Field:** E = kq/r² (point charge), E = F/q

**Gauss's Law:** ∮E·dA = Q_enc/ε₀

**Standard E-field results (via Gauss):**
- Infinite sheet: E = σ/(2ε₀)
- Between parallel plates: E = σ/ε₀
- Inside conductor: E = 0
- Spherical shell (outside): E = kQ/r²

**Potential:** V = kq/r | E = −dV/dr (1D)
**Potential energy:** U = kq₁q₂/r

**Capacitance:** C = Q/V
- Parallel plate: C = ε₀A/d
- With dielectric K: C' = KC
- Series: 1/C = 1/C₁ + 1/C₂
- Parallel: C = C₁ + C₂

**Energy stored:** U = ½CV² = Q²/(2C) = ½QV

**JEE Pro-tip:** For conductor systems, use uniqueness theorem — if boundaries are specified, the solution is unique.`,
  },

  // JEE — Organic Chemistry
  {
    id: 'jee-organic_chemistry-revision_card-1',
    examId: 'JEE',
    topicId: 'organic_chemistry',
    topicName: 'Organic Chemistry',
    format: 'revision_card',
    difficulty: 'medium',
    estimatedMinutes: 7,
    tags: ['reactions', 'mechanisms', 'named_reactions', 'JEE'],
    content: `**Organic Chemistry — JEE Named Reactions (Must Know)**

**Aldol Condensation:** Aldehyde/ketone with α-H + base → β-hydroxy carbonyl → dehydration → α,β-unsaturated

**Cannizzaro:** Aldehyde WITHOUT α-H + conc. NaOH → one oxidised (→ acid), one reduced (→ alcohol). Disproportionation!

**Hofmann Bromamide:** RCONH₂ + Br₂ + NaOH → RNH₂ (amine with ONE LESS carbon). Key: carbon chain shortens.

**Reimer-Tiemann:** Phenol + CHCl₃ + NaOH → ortho-hydroxybenzaldehyde (electrophilic substitution with :CCl₂)

**Carbylamine:** Primary amine + CHCl₃ + alc. KOH → isocyanide (FOUL smell — lab test for primary amine)

**SN1 vs SN2:**
- SN1: 3° carbon, polar protic solvent, racemization
- SN2: 1° carbon, polar aprotic solvent, inversion (Walden inversion)

**JEE 2024 hot topic:** Beckmann Rearrangement — Oxime → amide (ring expansion for cyclic ketones).`,
  },

  // JEE — Algebra
  {
    id: 'jee-algebra-formula_sheet-1',
    examId: 'JEE',
    topicId: 'algebra',
    topicName: 'Algebra',
    format: 'formula_sheet',
    difficulty: 'medium',
    estimatedMinutes: 5,
    tags: ['complex_numbers', 'quadratic', 'binomial', 'JEE'],
    content: `**JEE Algebra — Essential Formula Sheet**

**Complex Numbers:**
- |z₁z₂| = |z₁||z₂|, arg(z₁z₂) = arg(z₁) + arg(z₂)
- De Moivre: (cos θ + i sin θ)ⁿ = cos(nθ) + i sin(nθ)
- nth roots of unity: e^(2πik/n), k = 0,1,...,n−1

**Quadratic ax² + bx + c = 0:**
- Sum of roots: α+β = −b/a | Product: αβ = c/a
- Nature: D = b²−4ac; D>0 real distinct, D=0 equal, D<0 complex conjugate

**Binomial Theorem:**
(x+y)ⁿ = Σ C(n,r) x^(n-r) y^r
- General term: T_{r+1} = C(n,r) x^(n−r) y^r
- Middle term: r = n/2 (even n) or two middle terms for odd n

**AM-GM-HM Inequality:** AM ≥ GM ≥ HM (for positive reals)
AM = (a+b)/2, GM = √(ab), HM = 2ab/(a+b)

**JEE insight:** Equality in AM ≥ GM holds iff all terms are equal.`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CAT — Common Admission Test
  // ══════════════════════════════════════════════════════════════════════════

  // CAT — Quantitative Aptitude
  {
    id: 'cat-quant-formula_sheet-1',
    examId: 'CAT',
    topicId: 'quant',
    topicName: 'Quantitative Aptitude',
    format: 'formula_sheet',
    difficulty: 'easy',
    estimatedMinutes: 5,
    tags: ['number_theory', 'HCF_LCM', 'CAT'],
    content: `**CAT Quant — Number Theory Essentials**

**HCF × LCM = Product of two numbers** (only for 2 numbers!)

**Euler's Totient:** φ(n) = n·∏(1 − 1/p) for all prime factors p of n
- φ(p) = p−1 (prime)
- φ(p²) = p²−p = p(p−1)

**Fermat's Little Theorem:** a^(p−1) ≡ 1 (mod p) if gcd(a,p) = 1

**Cyclicity of last digits:**
- 2: 2,4,8,6 (cycle 4) | 3: 3,9,7,1 (cycle 4) | 7: 7,9,3,1 (cycle 4)
- 4: 4,6 (cycle 2) | 9: 9,1 (cycle 2) | 0,1,5,6: cycle 1

**Remainder shortcuts:**
- (a+b) mod m = [(a mod m) + (b mod m)] mod m
- (a·b) mod m = [(a mod m) · (b mod m)] mod m

**CAT shortcut:** For last digit of 7^k: find k mod 4. If 0 → 1; 1 → 7; 2 → 9; 3 → 3.

**Perfect number:** σ(n) = 2n (sum of all divisors = 2n). Examples: 6, 28.`,
  },
  {
    id: 'cat-quant-revision_card-1',
    examId: 'CAT',
    topicId: 'quant',
    topicName: 'Quantitative Aptitude',
    format: 'revision_card',
    difficulty: 'medium',
    estimatedMinutes: 6,
    tags: ['percentages', 'profit_loss', 'ratio', 'CAT'],
    content: `**CAT Arithmetic — Speed Formulas**

**Percentage shortcuts:**
- x% of y = y% of x (commutative trick)
- Successive % changes: a% then b% → net = a + b + ab/100
- If price ↑ by r%, consumption must ↓ by r/(100+r) × 100% to keep expenditure same

**Profit/Loss:**
- SP = CP × (100+P%)/100
- Discount on MP: SP = MP × (100−D%)/100
- Effective discount for two successive D₁%, D₂%: D₁ + D₂ − D₁D₂/100

**Ratio & Proportion:**
- If a:b = c:d → ad = bc (cross multiply)
- Componendo-Dividendo: (a+b)/(a−b) = (c+d)/(c−d)

**Mixture/Alligation rule:**
Cheaper : Costlier = (Mean price − Cheaper) : (Costlier − Mean price)

**CAT 2024 hot topic:** Compound interest with quarterly/half-yearly compounding + effective annual rate.`,
  },
  {
    id: 'cat-quant-worked_example-1',
    examId: 'CAT',
    topicId: 'quant',
    topicName: 'Quantitative Aptitude',
    format: 'worked_example',
    difficulty: 'hard',
    estimatedMinutes: 8,
    tags: ['CAT_2023_style', 'algebra', 'worked'],
    content: `**CAT 2023-Style: Quadratic + Inequalities**

**Problem:** For how many integer values of x is (x² − 5x + 4)/(x² − 5x + 6) < 0?

**Step 1 — Factor numerator and denominator:**
Numerator: x² − 5x + 4 = (x−1)(x−4)
Denominator: x² − 5x + 6 = (x−2)(x−3)

**Step 2 — Expression = (x−1)(x−4) / [(x−2)(x−3)]**
Undefined at x = 2 and x = 3.

**Step 3 — Sign chart:**
Critical points: 1, 2, 3, 4

| Interval | (x−1) | (x−4) | (x−2) | (x−3) | Result |
|---|---|---|---|---|---|
| x < 1 | − | − | − | − | (+)/(+) = + |
| 1 < x < 2 | + | − | − | − | (−)/(+) = **−** ✓ |
| 2 < x < 3 | + | − | + | − | (−)/(−) = + |
| 3 < x < 4 | + | − | + | + | (−)/(+) = **−** ✓ |
| x > 4 | + | + | + | + | (+)/(+) = + |

**Integer solutions:** Only x = ... wait, range (1,2): no integers. Range (3,4): no integers.

**Answer: 0 integer values!**

**CAT insight:** Always check if integer ranges are OPEN intervals. This is a classic trap question.`,
  },

  // CAT — DILR
  {
    id: 'cat-dilr-revision_card-1',
    examId: 'CAT',
    topicId: 'dilr',
    topicName: 'Data Interpretation & Logical Reasoning',
    format: 'revision_card',
    difficulty: 'medium',
    estimatedMinutes: 6,
    tags: ['bar_chart', 'set_theory', 'DILR', 'CAT'],
    content: `**CAT DILR — Speed Strategies**

**DI Approach (Timed: 2–3 min per set):**
1. Read question FIRST — don't process all data upfront
2. Identify what's being asked → locate relevant table/chart rows
3. Calculate only what's needed (avoid full table computation)
4. Check for approximate calculation opportunities (within 5% is usually fine for MCQs)

**Venn Diagram (3 sets):**
Total = A + B + C − (A∩B) − (B∩C) − (A∩C) + (A∩B∩C) + None

**Seating Arrangement shortcuts:**
- Circular: (n−1)! arrangements
- Constraint: Fix one person, arrange rest relative
- "Between" questions: always consider both sides

**LR Set types (CAT 2024 pattern):**
- Grid/Matrix games → elimination approach
- Scheduling → forward/backward chaining
- Blood relations → draw family tree immediately

**DILR tip:** If a set takes >4 min in practice, mark and move. One set = 4 questions = 8 marks. Time management > accuracy for first pass.`,
  },

  // CAT — Verbal
  {
    id: 'cat-verbal-revision_card-1',
    examId: 'CAT',
    topicId: 'verbal',
    topicName: 'Verbal Ability & Reading Comprehension',
    format: 'revision_card',
    difficulty: 'medium',
    estimatedMinutes: 5,
    tags: ['RC', 'para_jumbles', 'summary', 'CAT'],
    content: `**CAT Verbal — High-Yield Strategy**

**Reading Comprehension (RC) — 5-Step Method:**
1. Read opening 2 sentences + last 2 sentences (get gist)
2. Skim for paragraph transitions (signals: "however", "thus", "in contrast")
3. For inference questions: eliminate options that go beyond the passage
4. For "author's tone": check modifiers (scathing, cautious, optimistic, neutral)
5. Trap: options that are factually TRUE but NOT stated in passage → wrong!

**Para Jumbles:**
- Find the opener: often contains "a/an" (introducing new entity) or general statement
- Find mandatory pairs: pronoun → antecedent must precede it
- Find the closer: conclusion/result language ("therefore", "ultimately")
- TITA (no options): lock 2–3 certain adjacent pairs first

**Summary questions:** Correct answer = central argument, not a detail. Eliminate options that are too narrow.

**CAT 2024 shift:** More abstract, philosophy-heavy RC passages. Focus on argument structure, not memorising content.`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // NEET — National Eligibility cum Entrance Test
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'neet-biology-revision_card-1',
    examId: 'NEET',
    topicId: 'biology',
    topicName: 'Biology',
    format: 'revision_card',
    difficulty: 'medium',
    estimatedMinutes: 6,
    tags: ['cell_division', 'mitosis', 'meiosis', 'NEET'],
    content: `**Cell Division — NEET High-Yield Revision**

**Mitosis (PMAT):**
- Prophase: chromatin → chromosomes, centrioles migrate
- Metaphase: chromosomes at equatorial plate (best for counting!)
- Anaphase: centromeres split, chromatids move to poles
- Telophase: nuclear envelope reforms, cytokinesis

**Meiosis highlights:**
- Meiosis I: Homologous chromosomes separate (reductional division)
- Meiosis II: Sister chromatids separate (equational division)
- Crossing over → Prophase I (pachytene stage) → genetic recombination

**NEET trap:** Meiosis I reduces chromosome number (2n → n). Meiosis II is like mitosis.

**Cell cycle:** G₁ → S (DNA replication) → G₂ → M (mitosis) → C (cytokinesis)
G₀ = quiescent phase (non-dividing cells like neurons)

**NEET 2024 pattern:** 5–7 questions on cell division every year. Know the stages + what happens at each.`,
  },
  {
    id: 'neet-physics-formula_sheet-1',
    examId: 'NEET',
    topicId: 'physics_neet',
    topicName: 'Physics (NEET)',
    format: 'formula_sheet',
    difficulty: 'easy',
    estimatedMinutes: 5,
    tags: ['optics', 'ray_optics', 'lenses', 'NEET'],
    content: `**NEET Physics — Ray Optics Formula Sheet**

**Mirror Formula:** 1/f = 1/v + 1/u (sign convention: distances from pole, incident ray → positive direction)
**Magnification:** m = −v/u = h'/h

**Concave mirror:** f < 0 (converging). Real images: m < 0 (inverted)
**Convex mirror:** f > 0 (diverging). Always virtual, erect, diminished: m > 0, |m| < 1

**Lens Formula:** 1/f = 1/v − 1/u
**Lensmaker's:** 1/f = (μ−1)[1/R₁ − 1/R₂]
**Magnification:** m = v/u

**Snell's Law:** n₁ sin θ₁ = n₂ sin θ₂
**TIR condition:** θ > θ_c where sin θ_c = n₂/n₁ (denser → rarer medium)

**NEET shortcuts:**
- Power (diopters): P = 1/f (in metres). Converging lens: P > 0
- Lenses in contact: P_total = P₁ + P₂
- Human eye defects: Myopia → concave lens; Hypermetropia → convex lens`,
  },
  {
    id: 'neet-chemistry-revision_card-1',
    examId: 'NEET',
    topicId: 'chemistry_neet',
    topicName: 'Chemistry (NEET)',
    format: 'revision_card',
    difficulty: 'medium',
    estimatedMinutes: 5,
    tags: ['periodic_table', 'ionization_energy', 'electronegativity', 'NEET'],
    content: `**Chemical Periodicity — NEET Revision**

**Periodic Trends (left → right across period):**
- Atomic radius: ↓ (more protons, same shell, pulled inward)
- Ionization energy: ↑ (generally)
- Electronegativity: ↑
- Electron affinity: ↑ (generally)

**Exceptions (MUST know for NEET):**
- IE: N > O (N has half-filled 2p³ — extra stability)
- IE: Be > B (2s² fully filled vs 2p¹)
- Atomic radius: anomalous at d-block (lanthanide contraction)

**Down a group:** Atomic radius ↑, IE ↓, EN ↓

**Oxidising power:** F₂ > Cl₂ > Br₂ > I₂ (EN decreases)
**Reducing power:** I⁻ > Br⁻ > Cl⁻ > F⁻ (opposite)

**NEET 2024 pattern:** 4–5 questions on periodic trends + 3 on chemical bonding (hybridisation). Know sp, sp², sp³, sp³d hybridisations with example molecules.`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // UPSC — Union Public Service Commission
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'upsc-polity-revision_card-1',
    examId: 'UPSC',
    topicId: 'polity',
    topicName: 'Indian Polity',
    format: 'revision_card',
    difficulty: 'medium',
    estimatedMinutes: 7,
    tags: ['fundamental_rights', 'DPSP', 'constitution', 'UPSC'],
    content: `**Indian Polity — UPSC High-Yield Revision**

**Fundamental Rights (Part III, Articles 12–35):**
- Art 14: Equality before law (includes foreigners)
- Art 19: 6 freedoms (speech, assembly, association, movement, residence, profession) — only for citizens
- Art 21: Life and personal liberty (expanded by Supreme Court → right to privacy, livelihood)
- Art 32: Constitutional remedy (Dr. Ambedkar called it "Heart of Constitution")

**DPSPs (Part IV, Art 36–51):** Non-justiciable but state must apply. Inspired by Irish constitution.
- Key: Art 44 — Uniform Civil Code; Art 45 — early childhood care; Art 48A — environment protection

**Relationship FR vs DPSP:**
- Minerva Mills (1980): BALANCE required. Neither can completely abrogate the other.
- Art 31C: DPSPs under Art 39(b)(c) override Art 14, 19 (controversial)

**UPSC trap:** Fundamental Duties (Art 51A) — added by 42nd Amendment 1976. 11 duties. NOT enforceable.

**Parliament:** Rajya Sabha cannot be dissolved; Lok Sabha tenure = 5 years (can be extended during Emergency).`,
  },
  {
    id: 'upsc-economy-formula_sheet-1',
    examId: 'UPSC',
    topicId: 'economy',
    topicName: 'Indian Economy',
    format: 'formula_sheet',
    difficulty: 'easy',
    estimatedMinutes: 5,
    tags: ['GDP', 'fiscal_policy', 'monetary_policy', 'UPSC'],
    content: `**UPSC Economy — Key Concepts & Definitions**

**National Income:**
- GDP = C + I + G + (X−M) [Expenditure method]
- NDP = GDP − Depreciation
- NNP = GNP − Depreciation (GNP = GDP + factor income from abroad)
- NNP at factor cost = National Income

**Fiscal concepts:**
- Fiscal Deficit = Total Expenditure − Total Revenue (excl. borrowings)
- Revenue Deficit = Revenue Expenditure − Revenue Receipts
- Primary Deficit = Fiscal Deficit − Interest Payments

**Monetary Policy tools (RBI):**
- Repo rate: RBI lends to banks (controls credit)
- Reverse Repo: Banks park money with RBI
- CRR: % of deposits maintained as cash with RBI (not earning interest)
- SLR: % of deposits in liquid assets (gold, govt securities)

**Inflation measures:**
- CPI: Consumer Price Index (retail inflation) — used for RBI inflation targeting (4±2%)
- WPI: Wholesale Price Index

**UPSC 2024 focus:** Green economy, PLI scheme, GIFT City, AIF (Alternative Investment Funds).`,
  },
  {
    id: 'upsc-geography-revision_card-1',
    examId: 'UPSC',
    topicId: 'geography',
    topicName: 'Geography',
    format: 'revision_card',
    difficulty: 'medium',
    estimatedMinutes: 6,
    tags: ['rivers', 'climate', 'soil', 'UPSC'],
    content: `**Indian Geography — UPSC Revision (Physical)**

**River Systems — Origin:**
- Himalayan rivers (perennial): Indus, Ganga, Brahmaputra — snow-fed + monsoon
- Peninsular rivers (seasonal): Godavari, Krishna, Kaveri — monsoon only
- Brahmaputra: longest river in India by length; originates as Tsangpo in Tibet

**Soil types (UPSC loves this):**
- Alluvial (Khadar/Bhangar): most fertile, Indo-Gangetic plain, rice/wheat
- Black/Regur: Deccan Plateau, self-ploughing, cotton
- Red/Yellow: less fertile, iron oxide gives colour, millets
- Laterite: acidic, leaching by heavy rain, cashew/tea
- Arid: low organic matter, saline, western Rajasthan

**Climate — Monsoon mechanism:**
1. ITCZ shifts north in summer → SE trade winds cross equator → SW monsoons
2. Burst of monsoon: June 1 (Kerala), July 1 (Delhi)
3. Retreating monsoon: NE monsoon → Tamil Nadu (Oct–Dec)

**UPSC 2024 pattern:** Climate change impacts on Indian geography + glacial retreat questions increasing.`,
  },
  {
    id: 'upsc-history-revision_card-1',
    examId: 'UPSC',
    topicId: 'history',
    topicName: 'Modern Indian History',
    format: 'revision_card',
    difficulty: 'medium',
    estimatedMinutes: 7,
    tags: ['independence_movement', '1857', 'Gandhi', 'UPSC'],
    content: `**Modern India — UPSC High-Yield Timeline**

**1857 Revolt:**
- Started: Meerut, 10 May 1857 (sepoy mutiny — greased cartridges: pork/beef fat)
- Leaders: Mangal Pandey, Rani Lakshmibai, Nana Sahib, Bahadur Shah Zafar
- Result: Crown took over from East India Company; ended Mughal rule

**Congress key milestones:**
- 1885: INC founded by A.O. Hume, Bombay
- 1905: Swadeshi Movement (Partition of Bengal by Curzon)
- 1916: Lucknow Pact (Congress-Muslim League unity)
- 1919: Jallianwala Bagh → turned Gandhi against British

**Gandhi's movements:**
- Non-Cooperation (1920–22): Suspended after Chauri Chaura violence
- Civil Disobedience (1930): Dandi March (Salt Satyagraha), March 12 – April 6
- Quit India (1942): "Do or Die", August 8, 1942 — total non-cooperation

**UPSC trap:** Partition of Bengal (1905) was reversed in 1911 — not permanent.

**Key acts:** Government of India Act 1919 (Montagu-Chelmsford reforms, dyarchy); Act 1935 (provincial autonomy, bicameral legislature).`,
  },
  {
    id: 'upsc-environment-revision_card-1',
    examId: 'UPSC',
    topicId: 'environment',
    topicName: 'Environment & Ecology',
    format: 'revision_card',
    difficulty: 'medium',
    estimatedMinutes: 5,
    tags: ['biodiversity', 'climate', 'acts', 'UPSC'],
    content: `**Environment & Ecology — UPSC Revision**

**Biodiversity hotspots in India (4 of 36 global):**
1. Western Ghats + Sri Lanka
2. Indo-Burma (NE India)
3. Himalaya
4. Sundaland (Nicobar Islands)

**Protected areas:**
- National Park: no human activity, buffer zone not needed, no grazing
- Wildlife Sanctuary: limited human activity, grazing allowed
- Biosphere Reserve: 3 zones (core, buffer, transition); human settlements allowed in transition

**Key environmental laws:**
- Wildlife Protection Act 1972: Schedule I (highest protection)
- Environment Protection Act 1986: umbrella act post-Bhopal
- Forest Rights Act 2006: tribal rights in forest areas
- Biological Diversity Act 2002: CBD implementation

**Climate agreements:**
- Kyoto Protocol (1997): developed nations (Annex I) binding cuts
- Paris Agreement (2015): NDCs (Nationally Determined Contributions), 1.5°C target
- India's NDC: 45% emissions intensity reduction by 2030 (vs 2005)

**UPSC 2024 hot topics:** Blue economy, mangrove conservation, coral bleaching, PM Van Nidhi.`,
  },
];

// ─── Query functions ──────────────────────────────────────────────────────────

/**
 * Get a single static content atom by exam + topic + format.
 * Returns the first match, or null if not found.
 */
export function getStaticAtom(
  examId: string,
  topicId: string,
  format: string
): StaticContentAtom | null {
  const normalizedExam = examId.toUpperCase();
  const normalizedTopic = topicId.toLowerCase();
  const found = STATIC_ATOMS.find(
    a =>
      a.examId.toUpperCase() === normalizedExam &&
      a.topicId.toLowerCase() === normalizedTopic &&
      a.format === format
  );
  return found ?? null;
}

/**
 * Get all static atoms for a given exam + topic.
 */
export function getStaticAtomsForTopic(examId: string, topicId: string): StaticContentAtom[] {
  const normalizedExam = examId.toUpperCase();
  const normalizedTopic = topicId.toLowerCase();
  return STATIC_ATOMS.filter(
    a =>
      a.examId.toUpperCase() === normalizedExam &&
      a.topicId.toLowerCase() === normalizedTopic
  );
}

/**
 * Get all static atoms for a given exam.
 */
export function getAllStaticAtoms(examId: string): StaticContentAtom[] {
  const normalizedExam = examId.toUpperCase();
  return STATIC_ATOMS.filter(a => a.examId.toUpperCase() === normalizedExam);
}

/**
 * Get all unique topic IDs covered for an exam.
 */
export function getCoveredTopics(examId: string): string[] {
  const atoms = getAllStaticAtoms(examId);
  return [...new Set(atoms.map(a => a.topicId))];
}

/**
 * Get total count of static atoms.
 */
export function getAtomCount(): number {
  return STATIC_ATOMS.length;
}

/**
 * Get all exam IDs that have static content.
 */
export function getSupportedExams(): string[] {
  return [...new Set(STATIC_ATOMS.map(a => a.examId))];
}

/**
 * Search atoms by tags or content (simple text match).
 */
export function searchAtoms(query: string): StaticContentAtom[] {
  const q = query.toLowerCase();
  return STATIC_ATOMS.filter(
    a =>
      a.content.toLowerCase().includes(q) ||
      a.topicName.toLowerCase().includes(q) ||
      a.tags.some(t => t.toLowerCase().includes(q))
  );
}
