-- ============================================================
-- GATE Engineering Mathematics — PYQ Seed Data (2018–2024)
-- 30 questions across all 10 topics
-- Run AFTER 001_rag_schema.sql
-- Embeddings are NULL — populated at runtime via ragService.embedPYQs()
-- ============================================================

INSERT INTO pyq_questions (exam_id, year, question_text, options, correct_answer, explanation, topic, difficulty, marks, negative_marks) VALUES

-- ── LINEAR ALGEBRA (3 questions) ──────────────────────────
('gate-engineering-maths', 2023,
 'The eigenvalues of the matrix [[3, 1], [0, 3]] are',
 '{"A": "3, 3", "B": "3, 0", "C": "1, 3", "D": "0, 1"}',
 'A',
 'The matrix is upper triangular. Eigenvalues of a triangular matrix are the diagonal entries: 3 and 3.',
 'linear-algebra', 'easy', 2, -0.67),

('gate-engineering-maths', 2022,
 'The rank of the matrix [[1,2,3],[4,5,6],[7,8,9]] is',
 '{"A": "1", "B": "2", "C": "3", "D": "0"}',
 'B',
 'Row reduce: R2 = R2 - 4*R1, R3 = R3 - 7*R1. R3 becomes [0,0,0]. Two non-zero rows remain, so rank = 2.',
 'linear-algebra', 'medium', 2, -0.67),

('gate-engineering-maths', 2021,
 'If A is an n×n matrix with det(A) = 0, then the system Ax = b',
 '{"A": "always has a unique solution", "B": "has no solution", "C": "has infinitely many solutions or no solution", "D": "always has infinitely many solutions"}',
 'C',
 'det(A) = 0 means A is singular. The system is either inconsistent (no solution) or has infinitely many solutions, depending on b.',
 'linear-algebra', 'medium', 2, -0.67),

-- ── CALCULUS (3 questions) ─────────────────────────────────
('gate-engineering-maths', 2024,
 'The value of lim(x→0) (sin x - x) / x³ is',
 '{"A": "-1/6", "B": "1/6", "C": "0", "D": "-1/3"}',
 'A',
 'Using Taylor series: sin x = x - x³/6 + ... So (sin x - x)/x³ = -x³/6 / x³ = -1/6.',
 'calculus', 'medium', 2, -0.67),

('gate-engineering-maths', 2022,
 'The maximum value of f(x) = x³ - 3x on [-2, 2] is',
 '{"A": "2", "B": "-2", "C": "4", "D": "-4"}',
 'A',
 'f\'(x) = 3x² - 3 = 0 → x = ±1. f(1) = -2, f(-1) = 2, f(2) = 2, f(-2) = -2. Maximum = 2.',
 'calculus', 'medium', 2, -0.67),

('gate-engineering-maths', 2020,
 'The double integral ∫₀¹ ∫₀ˣ y dy dx equals',
 '{"A": "1/6", "B": "1/3", "C": "1/2", "D": "1/4"}',
 'A',
 'Inner integral: ∫₀ˣ y dy = x²/2. Outer: ∫₀¹ x²/2 dx = [x³/6]₀¹ = 1/6.',
 'calculus', 'medium', 2, -0.67),

-- ── DIFFERENTIAL EQUATIONS (3 questions) ──────────────────
('gate-engineering-maths', 2023,
 'The general solution of dy/dx + y = eˣ is',
 '{"A": "y = (eˣ/2) + Ce⁻ˣ", "B": "y = eˣ + Ce⁻ˣ", "C": "y = eˣ/2 + Ceˣ", "D": "y = 2eˣ + Ce⁻ˣ"}',
 'A',
 'Integrating factor μ = eˣ. d(yeˣ)/dx = e²ˣ. Integrate: yeˣ = e²ˣ/2 + C. So y = eˣ/2 + Ce⁻ˣ.',
 'differential-equations', 'hard', 2, -0.67),

('gate-engineering-maths', 2021,
 'The order and degree of the ODE (d²y/dx²)³ + (dy/dx)² + y = 0 are respectively',
 '{"A": "2 and 3", "B": "3 and 2", "C": "2 and 2", "D": "3 and 3"}',
 'A',
 'Order = highest derivative = 2 (d²y/dx²). Degree = power of highest derivative = 3.',
 'differential-equations', 'easy', 2, -0.67),

('gate-engineering-maths', 2019,
 'The particular integral of d²y/dx² + 4y = cos 2x is',
 '{"A": "x sin 2x / 4", "B": "cos 2x / 4", "C": "x cos 2x / 4", "D": "sin 2x / 4"}',
 'A',
 'Since 2 is a root of the characteristic equation m² + 4 = 0, we use the formula for repeated case: PI = x sin 2x / 4.',
 'differential-equations', 'hard', 2, -0.67),

-- ── COMPLEX VARIABLES (3 questions) ───────────────────────
('gate-engineering-maths', 2024,
 'The residue of f(z) = 1/(z² + 1) at z = i is',
 '{"A": "1/(2i)", "B": "-1/(2i)", "C": "1/2", "D": "-1/2"}',
 'A',
 'Simple poles at z = ±i. Residue at z = i: lim(z→i)(z-i)·1/((z-i)(z+i)) = 1/(2i).',
 'complex-variables', 'medium', 2, -0.67),

('gate-engineering-maths', 2022,
 'The function f(z) = |z|² is',
 '{"A": "analytic everywhere", "B": "analytic nowhere", "C": "analytic only at z = 0", "D": "analytic on the real axis"}',
 'C',
 'f(z) = x² + y². Check Cauchy-Riemann: ∂u/∂x = 2x = ∂v/∂y = 0 only if x = 0 and y = 0. So analytic only at origin.',
 'complex-variables', 'hard', 2, -0.67),

('gate-engineering-maths', 2020,
 'The value of the contour integral ∮_C dz/(z-2) where C is |z| = 3 is',
 '{"A": "2πi", "B": "0", "C": "πi", "D": "-2πi"}',
 'A',
 'z = 2 is inside |z| = 3. By Cauchy''s integral formula: ∮ dz/(z-a) = 2πi for a inside C.',
 'complex-variables', 'medium', 2, -0.67),

-- ── PROBABILITY & STATISTICS (3 questions) ────────────────
('gate-engineering-maths', 2023,
 'A fair die is rolled twice. The probability that the sum equals 7 is',
 '{"A": "1/6", "B": "1/4", "C": "5/36", "D": "7/36"}',
 'A',
 'Pairs summing to 7: (1,6),(2,5),(3,4),(4,3),(5,2),(6,1) = 6 outcomes. P = 6/36 = 1/6.',
 'probability-statistics', 'easy', 2, -0.67),

('gate-engineering-maths', 2022,
 'For a Poisson distribution with mean λ = 2, P(X = 0) equals',
 '{"A": "e⁻²", "B": "2e⁻²", "C": "1/e²", "D": "e²"}',
 'A',
 'P(X = k) = e⁻λ · λᵏ / k!. P(X=0) = e⁻² · 2⁰ / 0! = e⁻².',
 'probability-statistics', 'easy', 2, -0.67),

('gate-engineering-maths', 2021,
 'The mean and variance of a binomial distribution B(n, p) are respectively',
 '{"A": "np and np(1-p)", "B": "np and np²", "C": "np(1-p) and np", "D": "n/p and n/p²"}',
 'A',
 'Standard result: Mean = np, Variance = npq = np(1-p).',
 'probability-statistics', 'easy', 2, -0.67),

-- ── NUMERICAL METHODS (3 questions) ───────────────────────
('gate-engineering-maths', 2024,
 'In Newton-Raphson method, the iteration formula for finding √N is',
 '{"A": "xₙ₊₁ = (xₙ + N/xₙ)/2", "B": "xₙ₊₁ = xₙ - N/xₙ", "C": "xₙ₊₁ = (2xₙ + N)/3", "D": "xₙ₊₁ = xₙ/2 + N"}',
 'A',
 'For f(x) = x² - N, f\'(x) = 2x. NR: xₙ₊₁ = xₙ - (xₙ² - N)/(2xₙ) = (xₙ + N/xₙ)/2.',
 'numerical-methods', 'medium', 2, -0.67),

('gate-engineering-maths', 2022,
 'The trapezoidal rule for ∫ₐᵇ f(x)dx with n intervals has error of order',
 '{"A": "O(h²)", "B": "O(h³)", "C": "O(h⁴)", "D": "O(h)"}',
 'A',
 'The global truncation error for trapezoidal rule is O(h²) where h = (b-a)/n.',
 'numerical-methods', 'medium', 2, -0.67),

('gate-engineering-maths', 2020,
 'The Gauss-Seidel method converges if the coefficient matrix is',
 '{"A": "diagonally dominant", "B": "symmetric", "C": "orthogonal", "D": "skew-symmetric"}',
 'A',
 'Gauss-Seidel is guaranteed to converge when the coefficient matrix is strictly diagonally dominant.',
 'numerical-methods', 'medium', 2, -0.67),

-- ── TRANSFORM THEORY (3 questions) ────────────────────────
('gate-engineering-maths', 2023,
 'The Laplace transform of t·eᵃᵗ is',
 '{"A": "1/(s-a)²", "B": "1/(s+a)²", "C": "a/(s-a)²", "D": "s/(s-a)²"}',
 'A',
 'L{t·eᵃᵗ} = L{t} shifted by a: L{t} = 1/s², so L{t·eᵃᵗ} = 1/(s-a)².',
 'transform-theory', 'medium', 2, -0.67),

('gate-engineering-maths', 2021,
 'The Fourier transform of a rectangular pulse of width τ is a',
 '{"A": "sinc function", "B": "Gaussian function", "C": "triangular function", "D": "delta function"}',
 'A',
 'The Fourier transform of rect(t/τ) is τ·sinc(fτ) = τ·sin(πfτ)/(πfτ). It is a sinc function.',
 'transform-theory', 'easy', 2, -0.67),

('gate-engineering-maths', 2019,
 'If L{f(t)} = F(s), then L{f(t-a)·u(t-a)} equals',
 '{"A": "e⁻ᵃˢ·F(s)", "B": "eᵃˢ·F(s)", "C": "F(s-a)", "D": "F(s+a)"}',
 'A',
 'This is the second shifting theorem (time delay property): L{f(t-a)·u(t-a)} = e⁻ᵃˢ·F(s).',
 'transform-theory', 'easy', 2, -0.67),

-- ── DISCRETE MATHEMATICS (3 questions) ────────────────────
('gate-engineering-maths', 2024,
 'The number of onto functions from a set of 3 elements to a set of 2 elements is',
 '{"A": "6", "B": "4", "C": "8", "D": "2"}',
 'A',
 'Total functions = 2³ = 8. Non-onto (all to one element) = 2. Onto = 8 - 2 = 6.',
 'discrete-mathematics', 'medium', 2, -0.67),

('gate-engineering-maths', 2022,
 'In a group of 100 students, 60 study Maths and 50 study Physics. If 20 study both, how many study neither?',
 '{"A": "10", "B": "20", "C": "30", "D": "40"}',
 'A',
 '|M∪P| = 60 + 50 - 20 = 90. Neither = 100 - 90 = 10.',
 'discrete-mathematics', 'easy', 2, -0.67),

('gate-engineering-maths', 2020,
 'Which of the following is a tautology?',
 '{"A": "p ∨ ¬p", "B": "p ∧ ¬p", "C": "p → q", "D": "p ∧ q"}',
 'A',
 'p ∨ ¬p is always TRUE (Law of Excluded Middle) — it is a tautology.',
 'discrete-mathematics', 'easy', 2, -0.67),

-- ── GRAPH THEORY (3 questions) ────────────────────────────
('gate-engineering-maths', 2023,
 'The number of edges in a complete graph Kₙ is',
 '{"A": "n(n-1)/2", "B": "n²", "C": "n(n+1)/2", "D": "2n"}',
 'A',
 'In Kₙ every vertex connects to every other: n(n-1)/2 edges.',
 'graph-theory', 'easy', 2, -0.67),

('gate-engineering-maths', 2021,
 'A graph G has 5 vertices and is Eulerian. The minimum number of edges it must have is',
 '{"A": "5", "B": "4", "C": "6", "D": "10"}',
 'A',
 'Eulerian graph: connected, all vertices even degree. Min even degree = 2. 5 vertices × degree 2 / 2 = 5 edges.',
 'graph-theory', 'hard', 2, -0.67),

('gate-engineering-maths', 2019,
 'Which of the following is true for a tree with n vertices?',
 '{"A": "It has exactly n-1 edges", "B": "It has exactly n edges", "C": "It has n+1 edges", "D": "It has n(n-1)/2 edges"}',
 'A',
 'A tree with n vertices always has exactly n-1 edges. This is a fundamental property of trees.',
 'graph-theory', 'easy', 2, -0.67),

-- ── VECTOR CALCULUS (3 questions) ─────────────────────────
('gate-engineering-maths', 2024,
 'The divergence of F = x²î + y²ĵ + z²k̂ at (1,1,1) is',
 '{"A": "6", "B": "3", "C": "1", "D": "9"}',
 'A',
 'div F = ∂(x²)/∂x + ∂(y²)/∂y + ∂(z²)/∂z = 2x + 2y + 2z. At (1,1,1): 2+2+2 = 6.',
 'vector-calculus', 'easy', 2, -0.67),

('gate-engineering-maths', 2022,
 'The curl of F = yî - xĵ + 0k̂ is',
 '{"A": "-2k̂", "B": "2k̂", "C": "0", "D": "î + ĵ"}',
 'A',
 'curl F = (∂Fz/∂y - ∂Fy/∂z)î + (∂Fx/∂z - ∂Fz/∂x)ĵ + (∂Fy/∂x - ∂Fx/∂y)k̂ = 0î + 0ĵ + (-1-1)k̂ = -2k̂.',
 'vector-calculus', 'medium', 2, -0.67),

('gate-engineering-maths', 2020,
 'By Green''s theorem, ∮_C (y dx - x dy) over a closed curve C equals',
 '{"A": "-2A", "B": "2A", "C": "A", "D": "-A"}',
 'A',
 'Green''s theorem: ∮(P dx + Q dy) = ∬(∂Q/∂x - ∂P/∂y) dA. Here P=y, Q=-x: ∂Q/∂x - ∂P/∂y = -1-1 = -2. So integral = -2A.',
 'vector-calculus', 'hard', 2, -0.67);
