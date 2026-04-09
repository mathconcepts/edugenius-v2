// Centralized GATE Engineering Mathematics topic definitions.
// Single source of truth — imported by jobs, templates, routes, and utils.

export const GATE_TOPICS = [
  'linear-algebra', 'calculus', 'differential-equations', 'complex-variables',
  'probability-statistics', 'numerical-methods', 'transform-theory',
  'discrete-mathematics', 'graph-theory', 'vector-calculus',
] as const;

export type GateTopic = typeof GATE_TOPICS[number];

export const TOPIC_LABELS: Record<GateTopic, string> = {
  'linear-algebra': 'Linear Algebra',
  'calculus': 'Calculus',
  'differential-equations': 'Differential Equations',
  'complex-variables': 'Complex Variables',
  'probability-statistics': 'Probability & Statistics',
  'numerical-methods': 'Numerical Methods',
  'transform-theory': 'Transform Theory',
  'discrete-mathematics': 'Discrete Mathematics',
  'graph-theory': 'Graph Theory',
  'vector-calculus': 'Vector Calculus',
};

export const TOPIC_ICONS: Record<GateTopic, string> = {
  'linear-algebra': 'grid',
  'calculus': 'activity',
  'differential-equations': 'git-branch',
  'complex-variables': 'circle',
  'probability-statistics': 'bar-chart',
  'numerical-methods': 'hash',
  'transform-theory': 'repeat',
  'discrete-mathematics': 'layers',
  'graph-theory': 'share-2',
  'vector-calculus': 'navigation',
};

export const TOPIC_KEYWORDS: Record<GateTopic, string[]> = {
  'linear-algebra': ['matrix', 'matrices', 'eigenvalue', 'eigenvector', 'determinant', 'rank', 'linear algebra', 'vector space', 'basis', 'span', 'orthogonal', 'diagonalization', 'cayley-hamilton', 'trace', 'linear transformation'],
  'calculus': ['integral', 'derivative', 'limit', 'differentiation', 'integration', 'calculus', 'maxima', 'minima', 'continuity', 'taylor', 'maclaurin', 'rolle', 'mean value theorem', 'series', 'convergence'],
  'differential-equations': ['ode', 'pde', 'differential equation', 'laplace', 'bernoulli equation', 'exact equation', 'first order', 'second order', 'homogeneous', 'particular solution', 'boundary value', 'initial value'],
  'complex-variables': ['complex', 'analytic', 'residue', 'contour', 'cauchy', 'laurent', 'singularity', 'conformal', 'harmonic', 'complex analysis', 'analytic function', 'conformal mapping', 'holomorphic'],
  'probability-statistics': ['probability', 'statistics', 'distribution', 'random variable', 'bayes', 'expected value', 'variance', 'poisson', 'binomial', 'normal distribution', 'gaussian', 'expectation'],
  'numerical-methods': ['interpolation', 'newton-raphson', 'numerical', 'bisection', 'trapezoidal', 'simpson', 'runge-kutta', 'gauss elimination', 'iteration', 'numerical method', 'newton raphson', 'numerical integration', 'finite difference'],
  'transform-theory': ['fourier', 'laplace transform', 'z-transform', 'inverse transform', 'convolution', 'transfer function', 'fourier transform', 'fourier series', 'dft', 'fft'],
  'discrete-mathematics': ['combinatorics', 'recurrence', 'logic', 'boolean', 'set theory', 'relation', 'function', 'pigeonhole', 'permutation', 'combination', 'boolean algebra', 'lattice', 'group theory'],
  'graph-theory': ['graph', 'tree', 'vertex', 'edge', 'coloring', 'eulerian', 'hamiltonian', 'adjacency', 'degree', 'planar', 'graph theory', 'spanning tree', 'shortest path', 'euler', 'planar graph'],
  'vector-calculus': ['gradient', 'divergence', 'curl', 'stokes', "green's theorem", 'line integral', 'surface integral', 'flux', 'gauss divergence', 'vector calculus', 'green theorem'],
};
