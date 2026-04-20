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

  // Extract principal result: look for "Result", "Solution", "Exact result", "Decimal form"
  const preferredTitles = ['Result', 'Exact result', 'Solution', 'Decimal form', 'Decimal approximation', 'Definite integral'];
  let answer: string | null = null;
  for (const title of preferredTitles) {
    const pod = pods.find((p: any) => p.title === title);
    if (pod && pod.plaintext) {
      answer = pod.plaintext.trim().split('\n')[0];
      break;
    }
  }
  // Fallback: first non-input pod
  if (!answer) {
    const firstNonInput = pods.find((p: any) => !/^Input/i.test(p.title) && p.plaintext);
    if (firstNonInput) answer = firstNonInput.plaintext.trim().split('\n')[0];
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
 */
export function answersAgree(a: string, b: string): boolean {
  if (!a || !b) return false;
  const normalize = (s: string) =>
    s.replace(/\\[a-zA-Z]+\{/g, '')
     .replace(/[\s$\\{}()[\]]/g, '')
     .toLowerCase();
  if (normalize(a) === normalize(b)) return true;

  const numA = parseFloat(a.replace(/[^\d.\-e]/g, ''));
  const numB = parseFloat(b.replace(/[^\d.\-e]/g, ''));
  if (!isNaN(numA) && !isNaN(numB)) {
    const scale = Math.max(Math.abs(numA), Math.abs(numB), 1);
    return Math.abs(numA - numB) / scale < 0.001;
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

  const verified = answersAgree(result.answer, expectedAnswer);
  return { verified, wolfram_answer: result.answer, latency_ms: result.latency_ms };
}
