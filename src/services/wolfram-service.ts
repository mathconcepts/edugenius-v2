// @ts-nocheck
/**
 * Wolfram Alpha Service
 *
 * Direct HTTP client for Wolfram|Alpha's Full Results API.
 * Used as the authoritative verifier for generated math problems and as an
 * optional on-demand answer checker for mock exams.
 *
 * We deliberately do NOT use the MCP client/server pattern here because:
 *   - MCP requires a persistent server process (not compatible with stateless edge)
 *   - We only need the "solve and return answer" subset of Wolfram
 *   - The Full Results API gives us the same computation + step-by-step pods
 *
 * Cost model: Free tier = 2k calls/month. After that, $5/mo flat via Wolfram MCP
 * subscription, OR ~$0.002/call if you go through their metered API.
 *
 * Per PLAN-content-engine.md:
 *   - Mode A (primary): Build-time verification in CI — one call per generated problem
 *   - Mode B (optional): Runtime mock-exam verification — cross-checks wrong answers
 *
 * Env: WOLFRAM_APP_ID required. If absent, service returns unavailable gracefully.
 */

export interface WolframResult {
  available: boolean;
  query: string;
  answer: string | null;
  steps: string[];
  interpretation: string | null;
  pods: Array<{ title: string; plaintext: string }>;
  error?: string;
  latency_ms: number;
}

const WOLFRAM_ENDPOINT = 'https://api.wolframalpha.com/v2/query';
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Issue a computation query to Wolfram|Alpha and return the parsed result.
 * Returns { available: false } when no API key is set, so callers can gracefully skip.
 */
export async function wolframSolve(
  query: string,
  options: { timeout_ms?: number; show_steps?: boolean } = {},
): Promise<WolframResult> {
  const start = Date.now();
  const appId = process.env.WOLFRAM_APP_ID;

  if (!appId) {
    return {
      available: false,
      query,
      answer: null,
      steps: [],
      interpretation: null,
      pods: [],
      error: 'WOLFRAM_APP_ID not configured',
      latency_ms: 0,
    };
  }

  const params = new URLSearchParams({
    appid: appId,
    input: query,
    output: 'json',
    format: 'plaintext',
  });
  if (options.show_steps) {
    params.append('podstate', 'Result__Step-by-step solution');
    params.append('podstate', 'Step-by-step solution');
  }

  const url = `${WOLFRAM_ENDPOINT}?${params}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout_ms ?? DEFAULT_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        available: true,
        query,
        answer: null,
        steps: [],
        interpretation: null,
        pods: [],
        error: `HTTP ${res.status}`,
        latency_ms: Date.now() - start,
      };
    }

    const json = await res.json();
    return parseWolframResponse(json, query, Date.now() - start);
  } catch (err) {
    return {
      available: true,
      query,
      answer: null,
      steps: [],
      interpretation: null,
      pods: [],
      error: (err as Error).message,
      latency_ms: Date.now() - start,
    };
  }
}

function parseWolframResponse(json: any, query: string, latency_ms: number): WolframResult {
  const qr = json?.queryresult;
  if (!qr || qr.success !== true) {
    return {
      available: true,
      query,
      answer: null,
      steps: [],
      interpretation: null,
      pods: [],
      error: qr?.error ? 'Wolfram error' : 'No result',
      latency_ms,
    };
  }

  const pods = (qr.pods || []).map((p: any) => {
    const subpodText = (p.subpods || [])
      .map((s: any) => s.plaintext || '')
      .filter(Boolean)
      .join('\n');
    return { title: p.title || '', plaintext: subpodText };
  });

  // Extract principal result. Preferred pods first, also Eigenvalues/Solutions which may span multiple lines.
  const preferredTitles = ['Result', 'Results', 'Exact result', 'Solution', 'Solutions', 'Eigenvalues', 'Roots', 'Decimal form', 'Decimal approximation', 'Definite integral', 'Indefinite integral'];
  let answer: string | null = null;
  for (const title of preferredTitles) {
    const pod = pods.find((p: any) => p.title === title);
    if (pod && pod.plaintext) {
      // Collapse multi-line pod into a single answer string so multi-value
      // results (eigenvalues, root sets) survive into answersAgree's number-set matcher.
      answer = pod.plaintext.trim().replace(/\n+/g, ' | ');
      break;
    }
  }
  // Fallback: first non-input pod
  if (!answer) {
    const firstNonInput = pods.find((p: any) => !/^Input/i.test(p.title) && p.plaintext);
    if (firstNonInput) answer = firstNonInput.plaintext.trim().replace(/\n+/g, ' | ');
  }

  // Extract steps from "Step-by-step solution" pod
  const stepsPod = pods.find((p: any) => /step-by-step/i.test(p.title));
  const steps = stepsPod ? stepsPod.plaintext.split('\n').filter((s: string) => s.trim()) : [];

  // Interpretation (how Wolfram parsed the query)
  const inputPod = pods.find((p: any) => /^Input/i.test(p.title));
  const interpretation = inputPod?.plaintext?.trim() || null;

  return {
    available: true,
    query,
    answer,
    steps,
    interpretation,
    pods,
    latency_ms,
  };
}

/**
 * Compare two answers tolerating whitespace, LaTeX, and small numerical deltas.
 *
 * Wolfram's answers are often verbose ("integral x^2 dx = x^3/3 + constant")
 * while expected answers are terse ("x^3/3"). We accept a match if:
 *   1. The normalized strings are equal, OR
 *   2. The normalized expected is a substring of the normalized Wolfram answer, OR
 *   3. Both parse to numbers within 0.1% relative error.
 */
export function answersAgree(expected: string, wolframAnswer: string): boolean {
  if (!expected || !wolframAnswer) return false;

  // Normalize Unicode super/subscripts to ASCII before further processing.
  // e.g. "x²" → "x^2", "C₁" → "C_1"
  const asciiize = (s: string) => {
    const superMap: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-' };
    const subMap: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
    let out = '';
    for (const ch of s) {
      if (superMap[ch]) out += '^' + superMap[ch];
      else if (subMap[ch]) out += '_' + subMap[ch];
      else out += ch;
    }
    // Common math symbols
    return out.replace(/·/g, '*').replace(/×/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi');
  };

  const normalize = (s: string) => {
    let out = asciiize(s)
      .replace(/\\[a-zA-Z]+\{/g, '')
      .replace(/\\[a-zA-Z]+/g, '');
    // Strip function-of-variable notation BEFORE generic paren strip:
    // 'y(x)' → 'y', 'f(x,y)' → 'f', 'z(t)' → 'z'
    // Matches: single letter followed by (<vars>) where vars are single letters / commas / spaces
    out = out.replace(/([a-zA-Z])\s*\(\s*[a-zA-Z](?:\s*,\s*[a-zA-Z])*\s*\)/g, '$1');
    out = out
      .replace(/[\s$\\{}()[\]|]/g, '')
      .toLowerCase();
    // Strip implicit-multiplication stars: "2*x" → "2x"
    out = out.replace(/\*/g, '');
    return out;
  };

  const nExp = normalize(expected);
  const nWolf = normalize(wolframAnswer);

  // Exact match
  if (nExp === nWolf) return true;

  // Substring — the expected answer appears inside Wolfram's verbose response
  // e.g. expected="x^3/3", wolfram="integralx^2dx=x^3/3+constant" → match
  // For single-char expected, require it be numeric + preceded by '=' or end-of-string
  const isSingleNumeric = /^-?\d+(\.\d+)?$/.test(expected.trim());
  if (isSingleNumeric) {
    // Look for "=<number>" or "<number>$" pattern in wolfram answer
    const escaped = nExp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const numRe = new RegExp(`(?:^|=)${escaped}(?:[^0-9.]|$)`);
    if (numRe.test(nWolf)) return true;
  } else {
    if (nExp.length >= 2 && nWolf.includes(nExp)) return true;
    if (nWolf.length >= 2 && nExp.includes(nWolf)) return true;
  }

  // Scalar numeric comparison — only when each side has exactly one number
  // (otherwise "1 and 3" would strip to "13" and false-match "13.5")
  const singleNumberRe = /^-?\d+\.?\d*(?:[eE][+-]?\d+)?$/;
  const expSingle = singleNumberRe.test(expected.trim()) ? parseFloat(expected.trim()) : NaN;
  const wolfTrimmed = wolframAnswer.trim();
  const wolfSingle = singleNumberRe.test(wolfTrimmed) ? parseFloat(wolfTrimmed) : NaN;
  if (!isNaN(expSingle) && !isNaN(wolfSingle) && isFinite(expSingle) && isFinite(wolfSingle)) {
    const scale = Math.max(Math.abs(expSingle), Math.abs(wolfSingle), 1);
    if (Math.abs(expSingle - wolfSingle) / scale < 0.001) return true;
  }

  // Wolfram sometimes returns "λ_1 = 3, λ_2 = 1" for "1 and 3" — try word matches
  // Extract all numbers from each and compare as sorted sets.
  // Strip subscript indices like "_1", "_2" before extraction to avoid polluting the set.
  const stripSubscripts = (s: string) => s.replace(/_\d+/g, '');
  const numsExp = (stripSubscripts(expected).match(/-?\d+\.?\d*/g) || []).map(Number).filter(n => !isNaN(n)).sort();
  const numsWolf = (stripSubscripts(wolframAnswer).match(/-?\d+\.?\d*/g) || []).map(Number).filter(n => !isNaN(n)).sort();
  if (numsExp.length >= 2 && numsExp.length === numsWolf.length) {
    const allMatch = numsExp.every((v, i) => {
      const scale = Math.max(Math.abs(v), Math.abs(numsWolf[i]), 1);
      return Math.abs(v - numsWolf[i]) / scale < 0.001;
    });
    if (allMatch) return true;
  }

  return false;
}

/**
 * Verify a generated problem: does Wolfram's answer agree with ours?
 */
export async function verifyProblemWithWolfram(
  problemText: string,
  expectedAnswer: string,
): Promise<{ verified: boolean; wolfram_answer: string | null; latency_ms: number; error?: string }> {
  const result = await wolframSolve(problemText);
  if (!result.available) return { verified: false, wolfram_answer: null, latency_ms: 0, error: result.error };
  if (!result.answer) return { verified: false, wolfram_answer: null, latency_ms: result.latency_ms, error: 'Wolfram returned no answer' };

  const verified = answersAgree(expectedAnswer, result.answer);
  return { verified, wolfram_answer: result.answer, latency_ms: result.latency_ms };
}
