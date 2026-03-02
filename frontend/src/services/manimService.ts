/**
 * manimService.ts — EduGenius Manim Visualisation Client
 *
 * Handles:
 * 1. Arbitration: decide WHEN manim is worth calling vs plain KaTeX
 * 2. Rendering: call the local manim FastAPI service
 * 3. Caching: avoid duplicate renders within the session
 * 4. Fallback: if manim fails or is disabled, return null gracefully
 *
 * Cost/resource tradeoffs:
 *   - Static PNG: ~1–4s, used for diagrams/equations worth animating
 *   - Animation MP4: ~10–30s, ONLY for explicit "show me step by step" requests
 *   - KaTeX (default): instant, used for inline equations — never replaced by manim
 *
 * Arbitration rules:
 *   - Manim is called for VISUAL CONCEPTS, not symbol rendering
 *   - Diagrams > 2D > geometry > proofs > graphs → USE manim
 *   - Inline formulas, simple algebra → USE KaTeX only
 *   - Max 5 manim calls per conversation session
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ManimRenderResult {
  url: string;          // full URL to the PNG/MP4
  format: 'png' | 'mp4' | 'gif';
  cached: boolean;
  renderMs: number;
}

export interface ManimQuickRequest {
  topic: string;
  latex?: string;
  title?: string;
  sessionId?: string;
}

export interface ManimRenderRequest {
  sceneCode: string;
  format?: 'png' | 'gif' | 'mp4';
  quality?: 'low' | 'medium' | 'high';
  sessionId?: string;
}

// ── Arbitration: should we call manim for this? ──────────────────────────────

/**
 * High-value manim topics — concepts that BENEFIT from visual rendering.
 * These are topics where a diagram genuinely helps over a formula.
 */
const MANIM_HIGH_VALUE_TOPICS = [
  // Geometry & Vectors
  'vector', 'matrix transform', 'rotation', 'eigenvector', 'eigenvalue',
  'linear transformation', 'basis', 'span', 'null space',
  // Calculus
  'area under', 'definite integral', 'riemann sum', 'gradient', 'curl', 'divergence',
  'tangent line', 'normal line', 'slope field', 'phase portrait',
  // Probability & Stats
  'venn diagram', 'normal distribution', 'bell curve', 'probability tree',
  'bayes theorem', 'conditional probability',
  // Graph Theory
  'graph traversal', 'bfs', 'dfs', 'spanning tree', 'adjacency',
  // Number Theory / Discrete
  'modular arithmetic', 'number line', 'euclidean algorithm',
  // CAT / DILR specific
  'arrangement', 'circular arrangement', 'set theory', 'pie chart', 'bar chart',
  // GATE specific
  'signal', 'fourier', 'laplace transform', 'z-transform', 'bode plot',
];

/**
 * Decide if a Sage response + topic hint warrants a manim visualisation.
 * Returns the best topic keyword if YES, or null if NO.
 */
export function shouldRenderWithManim(
  userQuery: string,
  sageResponse: string,
  topicHint?: string,
): string | null {
  const text = `${userQuery} ${sageResponse} ${topicHint ?? ''}`.toLowerCase();

  // Explicit visualisation requests always trigger manim
  const explicitTriggers = [
    'show me', 'visualise', 'visualize', 'draw', 'diagram', 'plot',
    'animate', 'step by step visually', 'can you show',
  ];
  const hasExplicitRequest = explicitTriggers.some(t => text.includes(t));

  // Find matching high-value topic
  const matchedTopic = MANIM_HIGH_VALUE_TOPICS.find(t => text.includes(t));

  // Only trigger if explicit request OR high-value topic with sufficient complexity
  if (!hasExplicitRequest && !matchedTopic) return null;

  // Skip for very short queries (likely just formula lookups)
  if (userQuery.trim().split(' ').length < 4 && !hasExplicitRequest) return null;

  return matchedTopic ?? 'concept';
}

/**
 * Extract the most relevant LaTeX expression from Sage's response.
 * Used to pass to the quick-render endpoint.
 */
export function extractPrimaryLatex(sageResponse: string): string | undefined {
  // Look for display math first ($$...$$)
  const displayMatch = sageResponse.match(/\$\$([^$]+)\$\$/);
  if (displayMatch) return displayMatch[1].trim();
  // Fall back to inline math ($...$) — only if moderately complex
  const inlineMatch = sageResponse.match(/\$([^$]{10,60})\$/);
  if (inlineMatch) return inlineMatch[1].trim();
  return undefined;
}

// ── Service client ────────────────────────────────────────────────────────────

// In-session rate limit tracker (client-side shadow of server-side limit)
let _sessionRenderCount = 0;
const MAX_RENDERS_PER_SESSION = 10;

// In-memory cache for this tab session (URL → result)
const _renderCache = new Map<string, ManimRenderResult>();

function getCacheKey(req: ManimQuickRequest): string {
  return `${req.topic}::${req.latex ?? ''}::${req.title ?? ''}`;
}

/**
 * Quick render — Sage provides topic + optional LaTeX, service picks template.
 * This is the primary call path.
 */
export async function quickRender(
  req: ManimQuickRequest,
  serviceUrl: string,
): Promise<ManimRenderResult | null> {
  // Client-side rate limit
  if (_sessionRenderCount >= MAX_RENDERS_PER_SESSION) {
    console.warn('[Manim] Session render limit reached');
    return null;
  }

  const cacheKey = getCacheKey(req);
  if (_renderCache.has(cacheKey)) {
    return _renderCache.get(cacheKey)!;
  }

  try {
    _sessionRenderCount++;
    const res = await fetch(`${serviceUrl}/render/quick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: req.topic,
        latex: req.latex,
        title: req.title,
        session_id: req.sessionId,
        cache: true,
      }),
      signal: AbortSignal.timeout(15_000),  // 15s client timeout
    });

    if (!res.ok) {
      console.warn(`[Manim] Render failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const result: ManimRenderResult = {
      url: `${serviceUrl}${data.url}`,
      format: data.format,
      cached: data.cached,
      renderMs: data.render_ms,
    };

    _renderCache.set(cacheKey, result);
    return result;

  } catch (err) {
    console.warn('[Manim] Service unreachable or timed out:', err);
    return null;
  }
}

/**
 * Custom render — Sage or Atlas provides raw manim scene code.
 * Used for complex visualisations the AI generates on the fly.
 */
export async function customRender(
  req: ManimRenderRequest,
  serviceUrl: string,
): Promise<ManimRenderResult | null> {
  if (_sessionRenderCount >= MAX_RENDERS_PER_SESSION) return null;

  try {
    _sessionRenderCount++;
    const res = await fetch(`${serviceUrl}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene_code: req.sceneCode,
        format: req.format ?? 'png',
        quality: req.quality ?? 'low',
        session_id: req.sessionId,
        cache: true,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return {
      url: `${serviceUrl}${data.url}`,
      format: data.format,
      cached: data.cached,
      renderMs: data.render_ms,
    };
  } catch {
    return null;
  }
}

/**
 * Health check — verify the manim service is reachable before showing the toggle.
 */
export async function checkManimHealth(serviceUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${serviceUrl}/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function getSessionRenderCount(): number {
  return _sessionRenderCount;
}
