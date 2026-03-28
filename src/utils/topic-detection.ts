// Keyword-based topic detection for GATE Engineering Mathematics
// Used by chat-routes, gate-routes to auto-tag notebook entries

const TOPIC_KEYWORDS: Record<string, string[]> = {
  'linear-algebra': ['matrix', 'matrices', 'eigenvalue', 'eigenvector', 'determinant', 'rank', 'linear algebra', 'vector space', 'basis', 'span', 'orthogonal', 'diagonalization', 'cayley-hamilton', 'trace'],
  'calculus': ['integral', 'derivative', 'limit', 'differentiation', 'integration', 'calculus', 'maxima', 'minima', 'continuity', 'taylor', 'maclaurin', 'rolle', 'mean value theorem'],
  'differential-equations': ['ode', 'pde', 'differential equation', 'laplace', 'bernoulli equation', 'exact equation', 'first order', 'second order', 'homogeneous', 'particular solution'],
  'complex-variables': ['complex', 'analytic', 'residue', 'contour', 'cauchy', 'laurent', 'singularity', 'conformal', 'harmonic'],
  'probability-statistics': ['probability', 'statistics', 'distribution', 'random variable', 'bayes', 'expected value', 'variance', 'poisson', 'binomial', 'normal distribution', 'gaussian'],
  'numerical-methods': ['interpolation', 'newton-raphson', 'numerical', 'bisection', 'trapezoidal', 'simpson', 'runge-kutta', 'gauss elimination', 'iteration'],
  'transform-theory': ['fourier', 'laplace transform', 'z-transform', 'inverse transform', 'convolution', 'transfer function'],
  'discrete-mathematics': ['combinatorics', 'recurrence', 'logic', 'boolean', 'set theory', 'relation', 'function', 'pigeonhole', 'permutation', 'combination'],
  'graph-theory': ['graph', 'tree', 'vertex', 'edge', 'coloring', 'eulerian', 'hamiltonian', 'adjacency', 'degree', 'planar'],
  'vector-calculus': ['gradient', 'divergence', 'curl', 'stokes', "green's theorem", 'line integral', 'surface integral', 'flux', 'gauss divergence'],
};

export function detectTopic(text: string): string {
  const lower = text.toLowerCase();
  let bestMatch = 'general';
  let maxHits = 0;

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const hits = keywords.filter(kw => lower.includes(kw)).length;
    if (hits > maxHits) {
      maxHits = hits;
      bestMatch = topic;
    }
  }

  return bestMatch;
}
