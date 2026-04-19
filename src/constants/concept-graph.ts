// @ts-nocheck
/**
 * Concept Dependency Graph — GATE Engineering Mathematics
 *
 * ~80 concepts organized by topic with prerequisite edges.
 * This is the static data layer that powers:
 *   - Prerequisite Auto-Repair (Pillar 3)
 *   - Adaptive Problem Generation (Pillar 4)
 *   - Mastery Vector granularity (Pillar 1)
 *
 * Each concept has:
 *   id: kebab-case unique identifier
 *   topic: parent GATE topic
 *   label: human-readable name
 *   difficulty_base: inherent difficulty 0-1
 *   gate_frequency: how often tested (high/medium/low/rare)
 *   prerequisites: concept_ids this depends on
 */

export interface ConceptNode {
  id: string;
  topic: string;
  label: string;
  description: string;
  difficulty_base: number;
  gate_frequency: 'high' | 'medium' | 'low' | 'rare';
  prerequisites: string[];
}

// ============================================================================
// CALCULUS
// ============================================================================

const CALCULUS: ConceptNode[] = [
  { id: 'sequences', topic: 'calculus', label: 'Sequences', description: 'Convergence, divergence, bounded sequences', difficulty_base: 0.3, gate_frequency: 'medium', prerequisites: [] },
  { id: 'series', topic: 'calculus', label: 'Infinite Series', description: 'Convergence tests, power series, Taylor/Maclaurin', difficulty_base: 0.4, gate_frequency: 'medium', prerequisites: ['sequences'] },
  { id: 'limits', topic: 'calculus', label: 'Limits', description: 'Limit evaluation, L\'Hôpital\'s rule, indeterminate forms', difficulty_base: 0.3, gate_frequency: 'high', prerequisites: ['sequences'] },
  { id: 'continuity', topic: 'calculus', label: 'Continuity', description: 'Types of discontinuity, intermediate value theorem', difficulty_base: 0.3, gate_frequency: 'medium', prerequisites: ['limits'] },
  { id: 'differentiability', topic: 'calculus', label: 'Differentiability', description: 'Differentiability vs continuity, piecewise functions', difficulty_base: 0.4, gate_frequency: 'medium', prerequisites: ['continuity'] },
  { id: 'derivatives-basic', topic: 'calculus', label: 'Basic Derivatives', description: 'Power rule, sum/difference, basic functions', difficulty_base: 0.2, gate_frequency: 'high', prerequisites: ['differentiability'] },
  { id: 'chain-rule', topic: 'calculus', label: 'Chain Rule', description: 'Composite function differentiation', difficulty_base: 0.4, gate_frequency: 'high', prerequisites: ['derivatives-basic'] },
  { id: 'product-quotient-rule', topic: 'calculus', label: 'Product & Quotient Rule', description: 'Product rule, quotient rule, combined applications', difficulty_base: 0.3, gate_frequency: 'high', prerequisites: ['derivatives-basic'] },
  { id: 'implicit-differentiation', topic: 'calculus', label: 'Implicit Differentiation', description: 'Implicit functions, related rates', difficulty_base: 0.5, gate_frequency: 'medium', prerequisites: ['chain-rule'] },
  { id: 'maxima-minima', topic: 'calculus', label: 'Maxima & Minima', description: 'Critical points, second derivative test, optimization', difficulty_base: 0.5, gate_frequency: 'high', prerequisites: ['chain-rule', 'product-quotient-rule'] },
  { id: 'mean-value-theorems', topic: 'calculus', label: 'Mean Value Theorems', description: 'Rolle\'s theorem, Lagrange MVT, Cauchy MVT', difficulty_base: 0.5, gate_frequency: 'high', prerequisites: ['differentiability', 'continuity'] },
  { id: 'integration-basics', topic: 'calculus', label: 'Integration Basics', description: 'Antiderivatives, basic integration formulas', difficulty_base: 0.3, gate_frequency: 'high', prerequisites: ['derivatives-basic'] },
  { id: 'integration-substitution', topic: 'calculus', label: 'Integration by Substitution', description: 'u-substitution, trigonometric substitution', difficulty_base: 0.4, gate_frequency: 'high', prerequisites: ['integration-basics', 'chain-rule'] },
  { id: 'integration-by-parts', topic: 'calculus', label: 'Integration by Parts', description: 'LIATE rule, repeated integration by parts', difficulty_base: 0.5, gate_frequency: 'high', prerequisites: ['integration-basics', 'product-quotient-rule'] },
  { id: 'partial-fractions', topic: 'calculus', label: 'Partial Fractions', description: 'Decomposition for rational functions', difficulty_base: 0.4, gate_frequency: 'medium', prerequisites: ['integration-basics'] },
  { id: 'definite-integrals', topic: 'calculus', label: 'Definite Integrals', description: 'FTC, properties, area computation', difficulty_base: 0.4, gate_frequency: 'high', prerequisites: ['integration-substitution', 'integration-by-parts', 'partial-fractions'] },
  { id: 'improper-integrals', topic: 'calculus', label: 'Improper Integrals', description: 'Infinite limits, convergence of integrals', difficulty_base: 0.6, gate_frequency: 'medium', prerequisites: ['definite-integrals', 'limits'] },
  { id: 'multivariable-calculus', topic: 'calculus', label: 'Multivariable Calculus', description: 'Partial derivatives, total derivative, Jacobian', difficulty_base: 0.6, gate_frequency: 'high', prerequisites: ['chain-rule', 'definite-integrals'] },
  { id: 'multiple-integrals', topic: 'calculus', label: 'Multiple Integrals', description: 'Double/triple integrals, change of variables', difficulty_base: 0.7, gate_frequency: 'high', prerequisites: ['multivariable-calculus', 'definite-integrals'] },
];

// ============================================================================
// LINEAR ALGEBRA
// ============================================================================

const LINEAR_ALGEBRA: ConceptNode[] = [
  { id: 'matrix-operations', topic: 'linear-algebra', label: 'Matrix Operations', description: 'Addition, multiplication, transpose, properties', difficulty_base: 0.2, gate_frequency: 'high', prerequisites: [] },
  { id: 'determinants', topic: 'linear-algebra', label: 'Determinants', description: 'Computation, properties, cofactor expansion', difficulty_base: 0.3, gate_frequency: 'high', prerequisites: ['matrix-operations'] },
  { id: 'matrix-inverse', topic: 'linear-algebra', label: 'Matrix Inverse', description: 'Inverse computation, adjugate method, properties', difficulty_base: 0.3, gate_frequency: 'high', prerequisites: ['determinants'] },
  { id: 'systems-of-equations', topic: 'linear-algebra', label: 'Systems of Linear Equations', description: 'Gaussian elimination, consistency, solution types', difficulty_base: 0.4, gate_frequency: 'high', prerequisites: ['matrix-inverse'] },
  { id: 'rank-nullity', topic: 'linear-algebra', label: 'Rank & Nullity', description: 'Row echelon, rank, nullity, rank-nullity theorem', difficulty_base: 0.5, gate_frequency: 'high', prerequisites: ['systems-of-equations'] },
  { id: 'vector-spaces', topic: 'linear-algebra', label: 'Vector Spaces', description: 'Subspaces, span, basis, dimension', difficulty_base: 0.5, gate_frequency: 'medium', prerequisites: ['rank-nullity'] },
  { id: 'linear-transformations', topic: 'linear-algebra', label: 'Linear Transformations', description: 'Kernel, image, matrix representation', difficulty_base: 0.6, gate_frequency: 'medium', prerequisites: ['vector-spaces'] },
  { id: 'eigenvalues', topic: 'linear-algebra', label: 'Eigenvalues & Eigenvectors', description: 'Characteristic polynomial, computation, properties', difficulty_base: 0.5, gate_frequency: 'high', prerequisites: ['determinants', 'systems-of-equations'] },
  { id: 'diagonalization', topic: 'linear-algebra', label: 'Diagonalization', description: 'Diagonalizability, similar matrices, powers', difficulty_base: 0.6, gate_frequency: 'high', prerequisites: ['eigenvalues', 'vector-spaces'] },
  { id: 'cayley-hamilton', topic: 'linear-algebra', label: 'Cayley-Hamilton Theorem', description: 'Statement, applications, matrix powers/inverse', difficulty_base: 0.5, gate_frequency: 'high', prerequisites: ['eigenvalues'] },
  { id: 'orthogonality', topic: 'linear-algebra', label: 'Orthogonality', description: 'Gram-Schmidt, orthogonal matrices, projections', difficulty_base: 0.6, gate_frequency: 'medium', prerequisites: ['vector-spaces'] },
];

// ============================================================================
// DIFFERENTIAL EQUATIONS
// ============================================================================

const DIFF_EQ: ConceptNode[] = [
  { id: 'ode-first-order', topic: 'differential-equations', label: 'First Order ODEs', description: 'Separable, exact, linear first-order', difficulty_base: 0.4, gate_frequency: 'high', prerequisites: ['integration-basics', 'derivatives-basic'] },
  { id: 'ode-bernoulli', topic: 'differential-equations', label: 'Bernoulli Equations', description: 'Reduction to linear via substitution', difficulty_base: 0.5, gate_frequency: 'medium', prerequisites: ['ode-first-order'] },
  { id: 'ode-exact', topic: 'differential-equations', label: 'Exact Equations', description: 'Exactness condition, integrating factors', difficulty_base: 0.5, gate_frequency: 'medium', prerequisites: ['ode-first-order', 'multivariable-calculus'] },
  { id: 'ode-second-order-homo', topic: 'differential-equations', label: 'Second Order Homogeneous', description: 'Characteristic equation, complementary solution', difficulty_base: 0.5, gate_frequency: 'high', prerequisites: ['ode-first-order', 'eigenvalues'] },
  { id: 'ode-second-order-nonhomo', topic: 'differential-equations', label: 'Second Order Non-Homogeneous', description: 'Particular solution, undetermined coefficients, variation of parameters', difficulty_base: 0.6, gate_frequency: 'high', prerequisites: ['ode-second-order-homo', 'integration-by-parts'] },
  { id: 'ode-higher-order', topic: 'differential-equations', label: 'Higher Order ODEs', description: 'nth order linear, operator methods', difficulty_base: 0.7, gate_frequency: 'medium', prerequisites: ['ode-second-order-nonhomo'] },
  { id: 'pde-basics', topic: 'differential-equations', label: 'PDE Basics', description: 'Classification, separation of variables, wave/heat/Laplace', difficulty_base: 0.7, gate_frequency: 'medium', prerequisites: ['ode-second-order-homo', 'multivariable-calculus'] },
];

// ============================================================================
// PROBABILITY & STATISTICS
// ============================================================================

const PROBABILITY: ConceptNode[] = [
  { id: 'counting-principles', topic: 'probability-statistics', label: 'Counting Principles', description: 'Permutations, combinations, pigeonhole', difficulty_base: 0.3, gate_frequency: 'medium', prerequisites: [] },
  { id: 'probability-basics', topic: 'probability-statistics', label: 'Probability Basics', description: 'Axioms, conditional, Bayes theorem', difficulty_base: 0.3, gate_frequency: 'high', prerequisites: ['counting-principles'] },
  { id: 'random-variables', topic: 'probability-statistics', label: 'Random Variables', description: 'PMF, PDF, CDF, expectation, variance', difficulty_base: 0.4, gate_frequency: 'high', prerequisites: ['probability-basics', 'integration-basics'] },
  { id: 'discrete-distributions', topic: 'probability-statistics', label: 'Discrete Distributions', description: 'Binomial, Poisson, geometric, hypergeometric', difficulty_base: 0.4, gate_frequency: 'high', prerequisites: ['random-variables'] },
  { id: 'continuous-distributions', topic: 'probability-statistics', label: 'Continuous Distributions', description: 'Normal, exponential, uniform, gamma', difficulty_base: 0.5, gate_frequency: 'high', prerequisites: ['random-variables', 'definite-integrals'] },
  { id: 'joint-distributions', topic: 'probability-statistics', label: 'Joint Distributions', description: 'Joint, marginal, conditional distributions, independence', difficulty_base: 0.6, gate_frequency: 'medium', prerequisites: ['continuous-distributions', 'multiple-integrals'] },
  { id: 'hypothesis-testing', topic: 'probability-statistics', label: 'Hypothesis Testing', description: 'Type I/II errors, p-values, confidence intervals', difficulty_base: 0.6, gate_frequency: 'medium', prerequisites: ['continuous-distributions'] },
  { id: 'regression-correlation', topic: 'probability-statistics', label: 'Regression & Correlation', description: 'Linear regression, correlation coefficient', difficulty_base: 0.5, gate_frequency: 'medium', prerequisites: ['random-variables'] },
];

// ============================================================================
// COMPLEX VARIABLES
// ============================================================================

const COMPLEX: ConceptNode[] = [
  { id: 'complex-numbers', topic: 'complex-variables', label: 'Complex Numbers', description: 'Algebra, polar form, De Moivre\'s theorem', difficulty_base: 0.3, gate_frequency: 'medium', prerequisites: [] },
  { id: 'analytic-functions', topic: 'complex-variables', label: 'Analytic Functions', description: 'Cauchy-Riemann equations, harmonic functions', difficulty_base: 0.5, gate_frequency: 'high', prerequisites: ['complex-numbers', 'multivariable-calculus'] },
  { id: 'complex-integration', topic: 'complex-variables', label: 'Complex Integration', description: 'Contour integrals, Cauchy integral theorem/formula', difficulty_base: 0.6, gate_frequency: 'high', prerequisites: ['analytic-functions', 'definite-integrals'] },
  { id: 'taylor-laurent', topic: 'complex-variables', label: 'Taylor & Laurent Series', description: 'Series expansions, singularities classification', difficulty_base: 0.6, gate_frequency: 'high', prerequisites: ['complex-integration', 'series'] },
  { id: 'residue-calculus', topic: 'complex-variables', label: 'Residue Calculus', description: 'Residue theorem, real integral evaluation', difficulty_base: 0.7, gate_frequency: 'high', prerequisites: ['taylor-laurent'] },
  { id: 'conformal-mapping', topic: 'complex-variables', label: 'Conformal Mapping', description: 'Bilinear transformations, Joukowski', difficulty_base: 0.7, gate_frequency: 'low', prerequisites: ['analytic-functions'] },
];

// ============================================================================
// NUMERICAL METHODS
// ============================================================================

const NUMERICAL: ConceptNode[] = [
  { id: 'root-finding', topic: 'numerical-methods', label: 'Root Finding', description: 'Bisection, Newton-Raphson, secant, fixed-point', difficulty_base: 0.4, gate_frequency: 'high', prerequisites: ['derivatives-basic', 'continuity'] },
  { id: 'interpolation', topic: 'numerical-methods', label: 'Interpolation', description: 'Lagrange, Newton divided differences, splines', difficulty_base: 0.5, gate_frequency: 'high', prerequisites: ['systems-of-equations'] },
  { id: 'numerical-integration', topic: 'numerical-methods', label: 'Numerical Integration', description: 'Trapezoidal, Simpson\'s, Gaussian quadrature', difficulty_base: 0.4, gate_frequency: 'high', prerequisites: ['definite-integrals', 'interpolation'] },
  { id: 'numerical-ode', topic: 'numerical-methods', label: 'Numerical ODE Solvers', description: 'Euler, Runge-Kutta, stability analysis', difficulty_base: 0.6, gate_frequency: 'medium', prerequisites: ['ode-first-order', 'root-finding'] },
  { id: 'numerical-linear-algebra', topic: 'numerical-methods', label: 'Numerical Linear Algebra', description: 'LU decomposition, iterative methods, condition number', difficulty_base: 0.6, gate_frequency: 'medium', prerequisites: ['systems-of-equations', 'matrix-inverse'] },
];

// ============================================================================
// TRANSFORM THEORY
// ============================================================================

const TRANSFORMS: ConceptNode[] = [
  { id: 'laplace-transform', topic: 'transform-theory', label: 'Laplace Transform', description: 'Definition, properties, standard transforms', difficulty_base: 0.5, gate_frequency: 'high', prerequisites: ['improper-integrals', 'ode-second-order-nonhomo'] },
  { id: 'inverse-laplace', topic: 'transform-theory', label: 'Inverse Laplace Transform', description: 'Partial fractions method, convolution', difficulty_base: 0.5, gate_frequency: 'high', prerequisites: ['laplace-transform', 'partial-fractions'] },
  { id: 'laplace-applications', topic: 'transform-theory', label: 'Laplace Applications', description: 'Solving ODEs, circuit analysis, transfer functions', difficulty_base: 0.6, gate_frequency: 'high', prerequisites: ['inverse-laplace'] },
  { id: 'fourier-series', topic: 'transform-theory', label: 'Fourier Series', description: 'Trigonometric series, Dirichlet conditions, Parseval', difficulty_base: 0.5, gate_frequency: 'high', prerequisites: ['definite-integrals', 'series'] },
  { id: 'fourier-transform', topic: 'transform-theory', label: 'Fourier Transform', description: 'FT properties, convolution, applications', difficulty_base: 0.6, gate_frequency: 'medium', prerequisites: ['fourier-series', 'improper-integrals'] },
  { id: 'z-transform', topic: 'transform-theory', label: 'Z-Transform', description: 'Definition, properties, inverse, difference equations', difficulty_base: 0.6, gate_frequency: 'medium', prerequisites: ['laplace-transform', 'sequences'] },
];

// ============================================================================
// VECTOR CALCULUS
// ============================================================================

const VECTOR_CALC: ConceptNode[] = [
  { id: 'vector-fields', topic: 'vector-calculus', label: 'Vector Fields', description: 'Scalar/vector fields, gradient', difficulty_base: 0.4, gate_frequency: 'high', prerequisites: ['multivariable-calculus'] },
  { id: 'divergence-curl', topic: 'vector-calculus', label: 'Divergence & Curl', description: 'Divergence, curl, Laplacian, identities', difficulty_base: 0.5, gate_frequency: 'high', prerequisites: ['vector-fields'] },
  { id: 'line-integrals', topic: 'vector-calculus', label: 'Line Integrals', description: 'Scalar/vector line integrals, work, circulation', difficulty_base: 0.5, gate_frequency: 'high', prerequisites: ['vector-fields', 'definite-integrals'] },
  { id: 'surface-integrals', topic: 'vector-calculus', label: 'Surface Integrals', description: 'Flux, surface parameterization', difficulty_base: 0.6, gate_frequency: 'medium', prerequisites: ['line-integrals', 'multiple-integrals'] },
  { id: 'greens-theorem', topic: 'vector-calculus', label: "Green's Theorem", description: 'Circulation-flux form, applications', difficulty_base: 0.6, gate_frequency: 'high', prerequisites: ['line-integrals', 'divergence-curl'] },
  { id: 'stokes-theorem', topic: 'vector-calculus', label: "Stokes' Theorem", description: 'Generalized curl theorem, applications', difficulty_base: 0.7, gate_frequency: 'high', prerequisites: ['surface-integrals', 'greens-theorem'] },
  { id: 'gauss-divergence', topic: 'vector-calculus', label: 'Gauss Divergence Theorem', description: 'Volume-surface flux relationship', difficulty_base: 0.7, gate_frequency: 'high', prerequisites: ['surface-integrals', 'divergence-curl'] },
];

// ============================================================================
// DISCRETE MATHEMATICS
// ============================================================================

const DISCRETE: ConceptNode[] = [
  { id: 'propositional-logic', topic: 'discrete-mathematics', label: 'Propositional Logic', description: 'Connectives, truth tables, tautologies, equivalences', difficulty_base: 0.3, gate_frequency: 'medium', prerequisites: [] },
  { id: 'sets-relations', topic: 'discrete-mathematics', label: 'Sets & Relations', description: 'Set operations, equivalence/partial order relations', difficulty_base: 0.3, gate_frequency: 'medium', prerequisites: ['propositional-logic'] },
  { id: 'functions-combinatorics', topic: 'discrete-mathematics', label: 'Functions & Combinatorics', description: 'Injection, surjection, bijection, counting', difficulty_base: 0.4, gate_frequency: 'medium', prerequisites: ['sets-relations'] },
  { id: 'recurrence-relations', topic: 'discrete-mathematics', label: 'Recurrence Relations', description: 'Solving linear recurrences, generating functions', difficulty_base: 0.5, gate_frequency: 'medium', prerequisites: ['functions-combinatorics'] },
  { id: 'boolean-algebra', topic: 'discrete-mathematics', label: 'Boolean Algebra', description: 'Boolean functions, minimization, Karnaugh maps', difficulty_base: 0.4, gate_frequency: 'medium', prerequisites: ['propositional-logic'] },
  { id: 'group-theory-basics', topic: 'discrete-mathematics', label: 'Group Theory Basics', description: 'Groups, subgroups, cyclic groups, cosets', difficulty_base: 0.6, gate_frequency: 'low', prerequisites: ['sets-relations'] },
];

// ============================================================================
// GRAPH THEORY
// ============================================================================

const GRAPH: ConceptNode[] = [
  { id: 'graph-basics', topic: 'graph-theory', label: 'Graph Basics', description: 'Vertices, edges, degree, handshaking lemma', difficulty_base: 0.3, gate_frequency: 'high', prerequisites: [] },
  { id: 'graph-connectivity', topic: 'graph-theory', label: 'Connectivity', description: 'Paths, cycles, connected components, bridges', difficulty_base: 0.4, gate_frequency: 'high', prerequisites: ['graph-basics'] },
  { id: 'trees', topic: 'graph-theory', label: 'Trees', description: 'Spanning trees, binary trees, Prüfer sequences', difficulty_base: 0.4, gate_frequency: 'high', prerequisites: ['graph-connectivity'] },
  { id: 'euler-hamilton', topic: 'graph-theory', label: 'Eulerian & Hamiltonian', description: 'Euler circuits/paths, Hamiltonian cycles, conditions', difficulty_base: 0.5, gate_frequency: 'high', prerequisites: ['graph-connectivity'] },
  { id: 'graph-coloring', topic: 'graph-theory', label: 'Graph Coloring', description: 'Chromatic number, chromatic polynomial, planar coloring', difficulty_base: 0.5, gate_frequency: 'medium', prerequisites: ['graph-basics'] },
  { id: 'planar-graphs', topic: 'graph-theory', label: 'Planar Graphs', description: 'Planarity, Euler formula, Kuratowski theorem', difficulty_base: 0.5, gate_frequency: 'medium', prerequisites: ['graph-connectivity'] },
  { id: 'shortest-paths', topic: 'graph-theory', label: 'Shortest Paths', description: 'Dijkstra, Bellman-Ford, Floyd-Warshall', difficulty_base: 0.5, gate_frequency: 'medium', prerequisites: ['trees'] },
];

// ============================================================================
// COMBINED GRAPH
// ============================================================================

export const ALL_CONCEPTS: ConceptNode[] = [
  ...CALCULUS,
  ...LINEAR_ALGEBRA,
  ...DIFF_EQ,
  ...PROBABILITY,
  ...COMPLEX,
  ...NUMERICAL,
  ...TRANSFORMS,
  ...VECTOR_CALC,
  ...DISCRETE,
  ...GRAPH,
];

/** Map concept_id → ConceptNode for O(1) lookup */
export const CONCEPT_MAP: Map<string, ConceptNode> = new Map(
  ALL_CONCEPTS.map(c => [c.id, c])
);

/** Get all concepts for a topic */
export function getConceptsForTopic(topic: string): ConceptNode[] {
  return ALL_CONCEPTS.filter(c => c.topic === topic);
}

/** Get direct prerequisites for a concept */
export function getPrerequisites(conceptId: string): ConceptNode[] {
  const node = CONCEPT_MAP.get(conceptId);
  if (!node) return [];
  return node.prerequisites.map(id => CONCEPT_MAP.get(id)).filter(Boolean) as ConceptNode[];
}

/** Get all dependents (concepts that require this one) */
export function getDependents(conceptId: string): ConceptNode[] {
  return ALL_CONCEPTS.filter(c => c.prerequisites.includes(conceptId));
}

/**
 * Trace prerequisite chain backward from a concept to find the weakest ancestor.
 * Uses BFS with mastery scores to find the root cause of struggles.
 */
export function traceWeakestPrerequisite(
  conceptId: string,
  masteryVector: Record<string, { score: number }>,
  threshold: number = 0.3,
): ConceptNode[] {
  const weak: ConceptNode[] = [];
  const visited = new Set<string>();
  const queue = [conceptId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const node = CONCEPT_MAP.get(current);
    if (!node) continue;

    for (const prereqId of node.prerequisites) {
      const mastery = masteryVector[prereqId]?.score ?? 0;
      if (mastery < threshold) {
        const prereqNode = CONCEPT_MAP.get(prereqId);
        if (prereqNode) weak.push(prereqNode);
      }
      queue.push(prereqId);
    }
  }

  // Sort by mastery (weakest first)
  return weak.sort((a, b) => {
    const ma = masteryVector[a.id]?.score ?? 0;
    const mb = masteryVector[b.id]?.score ?? 0;
    return ma - mb;
  });
}

/**
 * Get concept IDs in topological order (prerequisites before dependents).
 * Useful for determining learning path.
 */
export function topologicalSort(): string[] {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const c of ALL_CONCEPTS) {
    inDegree.set(c.id, c.prerequisites.length);
    for (const p of c.prerequisites) {
      if (!adjList.has(p)) adjList.set(p, []);
      adjList.get(p)!.push(c.id);
    }
  }

  const queue = ALL_CONCEPTS.filter(c => c.prerequisites.length === 0).map(c => c.id);
  const result: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const dep of (adjList.get(current) || [])) {
      inDegree.set(dep, (inDegree.get(dep) || 1) - 1);
      if (inDegree.get(dep) === 0) queue.push(dep);
    }
  }

  return result;
}
