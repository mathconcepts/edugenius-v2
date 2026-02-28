# Sage Conversation Starters — GATE Engineering Mathematics

*10 example student questions that demo Sage's tutoring capability across all topics.*

---

## 1. Linear Algebra

**Student:** "I keep getting confused about eigenvalues vs eigenvectors. What's the actual difference and why do we care?"

**Sage would:** Start with the intuitive picture (eigenvectors are special directions, eigenvalues are how much they stretch), give a 2×2 example with visual reasoning, then connect to GATE question patterns.

---

## 2. Calculus

**Student:** "How do I know when to use L'Hôpital's rule vs just substituting? I always mess this up in exams."

**Sage would:** Explain the 0/0 or ∞/∞ prerequisite check, walk through a case where naive substitution fails, contrast with a case where Taylor series is faster, then give a GATE-style practice problem.

---

## 3. Differential Equations

**Student:** "What's the difference between homogeneous and non-homogeneous ODEs? The terms look similar in all my books."

**Sage would:** Give a clear structural definition with examples of each form, explain the superposition principle, show how the particular integral is found only for non-homogeneous cases, and give the standard GATE question format for each.

---

## 4. Complex Variables

**Student:** "I don't understand the Cauchy-Riemann equations. Why do we need them and when do I apply them?"

**Sage would:** Start with "analyticity means the function behaves nicely everywhere" (no jumps, no corners), derive C-R from the definition of complex derivative, show a quick check on f(z) = z², then flag the GATE trap that |z|² fails C-R everywhere except origin.

---

## 5. Probability & Statistics

**Student:** "When do I use Bayes' theorem? I understand the formula but not when it's the right tool."

**Sage would:** Frame it as "updating beliefs with evidence" (prior → posterior), use the classic medical test example, then show how GATE phrases these problems and what keywords signal Bayes.

---

## 6. Numerical Methods

**Student:** "Newton-Raphson converges fast, but sometimes my iterations diverge. Why?"

**Sage would:** Explain the geometric picture (tangent line approximation overshoots), show a case with a local extremum near the root causing divergence, give the convergence condition (f'(x) ≠ 0 near root), and recommend bracketing methods as fallback.

---

## 7. Transform Theory

**Student:** "I always confuse the first and second shifting theorems of Laplace. Can you give me a rule of thumb?"

**Sage would:** Give a clean mnemonic: "First shift = multiply by e^(at) in time → shift in s. Second shift = delay by a in time → multiply by e^(-as) in s." Then solve one example of each type side by side.

---

## 8. Discrete Mathematics

**Student:** "What's the fastest way to check if a proposition is a tautology in an exam?"

**Sage would:** Teach the negation shortcut (assume it's false → derive contradiction → it's a tautology), show De Morgan's application, and flag the 3 most-tested GATE tautology forms.

---

## 9. Graph Theory

**Student:** "I know Euler's formula V - E + F = 2, but I always forget when it applies. Is it always true?"

**Sage would:** Clarify: connected planar graphs only, and F counts the outer (infinite) face. Give the tree as a sanity check (V=n, E=n-1, F=1: n-(n-1)+1=2 ✓). Then show the K₅ failure as the non-planar counterexample.

---

## 10. Vector Calculus

**Student:** "I never know whether to use Stokes' theorem or Gauss's theorem. They both involve surfaces."

**Sage would:** Draw the distinction in one line: "Stokes goes surface→line (boundary). Gauss goes volume→surface (boundary)." Then give the keyword triggers: "closed surface" → Gauss; "boundary of surface" → Stokes. Practice with one of each.
