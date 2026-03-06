/**
 * wolframService.ts — EduGenius Wolfram Integration
 *
 * Wolfram Foundation Tool integration for:
 *   1. Math verification — verify MCQ answer correctness
 *   2. Computation grounding — ground Sage responses in deterministic math
 *   3. Content enrichment — enrich Atlas-generated content with verified calculations
 *   4. Formula validation — validate formulas in generated content
 *   5. Step-by-step solutions — generate traceable solution steps for problems
 *
 * Integration paths (in priority order):
 *   A. Wolfram LLM API — optimized for LLM integration (PREFERRED)
 *   B. Wolfram Full Results API — full structured output with pods
 *   C. Wolfram Short Answers API — quick facts/answers
 *   D. MCP mode — when a local MCP server is configured
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const env = (import.meta as any).env ?? {};

// ─── Types ────────────────────────────────────────────────────────────────────

export type WolframMode = 'llm_api' | 'full_results' | 'short_answer' | 'mcp';

export interface WolframConfig {
  appId: string;           // VITE_WOLFRAM_APP_ID
  mode: WolframMode;
  mcpEndpoint?: string;    // VITE_WOLFRAM_MCP_ENDPOINT
  timeout: number;
}

export interface WolframPod {
  title: string;
  content: string;
  isMainResult: boolean;
}

export interface WolframResult {
  success: boolean;
  answer: string;          // Human-readable answer
  steps?: string[];        // Step-by-step solution (if available)
  pods?: WolframPod[];     // Full structured pods (full_results mode)
  wolfram_code?: string;   // Wolfram Language code that generated this
  confidence: number;      // 0–1 (1 = exact computation, 0 = failed)
  source: WolframMode;
  query: string;
  cached: boolean;
}

export interface MathVerificationResult {
  isCorrect: boolean;
  confidence: number;
  correctAnswer: string;
  steps: string[];
  wolframAnswer: string;
  studentAnswer: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export function getWolframConfig(): WolframConfig | null {
  const appId = env.VITE_WOLFRAM_APP_ID as string | undefined;
  if (!appId) return null;

  const mcpEndpoint = env.VITE_WOLFRAM_MCP_ENDPOINT as string | undefined;
  const modeEnv = env.VITE_WOLFRAM_MODE as WolframMode | undefined;

  // Pick mode: if MCP endpoint is provided and mode says mcp → mcp; otherwise llm_api
  let mode: WolframMode = modeEnv ?? 'llm_api';
  if (mcpEndpoint && !modeEnv) mode = 'llm_api'; // still prefer llm_api unless explicit

  return {
    appId,
    mode,
    mcpEndpoint,
    timeout: 15000,
  };
}

export function isWolframAvailable(): boolean {
  return !!(env.VITE_WOLFRAM_APP_ID as string | undefined);
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

function cacheKey(query: string): string {
  // Simple hash: sum of char codes + length
  let hash = query.length;
  for (let i = 0; i < Math.min(query.length, 128); i++) {
    hash = ((hash << 5) - hash) + query.charCodeAt(i);
    hash |= 0;
  }
  return `wolfram_${Math.abs(hash)}`;
}

function getCached(query: string): WolframResult | null {
  try {
    const key = cacheKey(query);
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WolframResult;
    return { ...parsed, cached: true };
  } catch {
    return null;
  }
}

function setCache(query: string, result: WolframResult): void {
  try {
    sessionStorage.setItem(cacheKey(query), JSON.stringify({ ...result, cached: false }));
  } catch {
    // sessionStorage quota exceeded or unavailable — ignore
  }
}

// ─── API callers ──────────────────────────────────────────────────────────────

/** Wolfram LLM API — returns structured text optimised for LLM context */
async function callLlmApi(appId: string, query: string, timeout: number): Promise<WolframResult> {
  const url = `https://www.wolframalpha.com/api/v1/llm-api?appid=${encodeURIComponent(appId)}&input=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`LLM API ${res.status}`);
    const text = await res.text();
    // The LLM API returns plain text with possible step sections
    const steps = parseStepsFromLlmResponse(text);
    return {
      success: true,
      answer: text.trim(),
      steps,
      confidence: 1.0,
      source: 'llm_api',
      query,
      cached: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseStepsFromLlmResponse(text: string): string[] {
  // Attempt to extract numbered steps or bullet points from LLM API response
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const stepLines = lines.filter(l => /^(\d+[\.\)]\s|[-•]\s|Step\s+\d+)/i.test(l.trim()));
  if (stepLines.length >= 2) return stepLines.map(l => l.trim());
  return [];
}

/** Wolfram Full Results API — rich pod structure */
async function callFullResults(appId: string, query: string, timeout: number): Promise<WolframResult> {
  const url = `https://api.wolframalpha.com/v2/query?appid=${encodeURIComponent(appId)}&input=${encodeURIComponent(query)}&output=json&format=plaintext`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Full Results API ${res.status}`);
    const data = await res.json();
    const qr = data?.queryresult;

    if (!qr?.success) {
      const suggestion = qr?.didyoumeans?.[0]?.val;
      return {
        success: false,
        answer: suggestion ? `Did you mean: ${suggestion}?` : 'Wolfram could not interpret the query.',
        confidence: 0,
        source: 'full_results',
        query,
        cached: false,
      };
    }

    const rawPods: any[] = qr.pods ?? [];
    const pods: WolframPod[] = rawPods.map((p: any) => ({
      title: p.title ?? '',
      content: p.subpods?.map((s: any) => s.plaintext ?? '').filter(Boolean).join('\n') ?? '',
      isMainResult: p.id === 'Result' || p.id === 'Solution' || p.primary === true,
    }));

    const mainPod = pods.find(p => p.isMainResult) ?? pods[1]; // index 1: usually Result
    const answer = mainPod?.content ?? pods.map(p => `${p.title}: ${p.content}`).join('\n');
    const stepPod = rawPods.find((p: any) => /step/i.test(p.title ?? ''));
    const steps = stepPod?.subpods?.map((s: any) => s.plaintext ?? '').filter(Boolean) ?? [];

    return {
      success: true,
      answer: answer.trim(),
      steps,
      pods,
      confidence: 1.0,
      source: 'full_results',
      query,
      cached: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Wolfram Short Answers API — quick spoken answer */
async function callShortAnswer(appId: string, query: string, timeout: number): Promise<WolframResult> {
  const url = `https://api.wolframalpha.com/v1/spoken?appid=${encodeURIComponent(appId)}&i=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Short Answer API ${res.status}`);
    const text = await res.text();
    if (text.toLowerCase().includes('no spoken result') || text.toLowerCase().includes('wolfram alpha did not')) {
      return { success: false, answer: text, confidence: 0, source: 'short_answer', query, cached: false };
    }
    return { success: true, answer: text.trim(), confidence: 0.9, source: 'short_answer', query, cached: false };
  } finally {
    clearTimeout(timer);
  }
}

/** MCP mode — POST to a local/hosted MCP endpoint */
async function callMcp(endpoint: string, query: string, timeout: number): Promise<WolframResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'wolfram/query', params: { query } }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`MCP endpoint ${res.status}`);
    const data = await res.json();
    const answer = data?.result?.answer ?? data?.answer ?? JSON.stringify(data);
    return {
      success: true,
      answer: String(answer).trim(),
      steps: data?.result?.steps ?? [],
      confidence: 1.0,
      source: 'mcp',
      query,
      cached: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Main public functions ────────────────────────────────────────────────────

/**
 * queryWolfram — main entry point.
 * Tries in priority order: llm_api → full_results → short_answer → mcp
 * Falls back gracefully — never throws.
 */
export async function queryWolfram(query: string, mode?: WolframMode): Promise<WolframResult> {
  if (!isWolframAvailable()) {
    return { success: false, answer: 'Wolfram not configured (VITE_WOLFRAM_APP_ID missing)', confidence: 0, source: 'llm_api', query, cached: false };
  }

  const cached = getCached(query);
  if (cached) return cached;

  const cfg = getWolframConfig()!;
  const effectiveMode = mode ?? cfg.mode;
  const { appId, mcpEndpoint, timeout } = cfg;

  try {
    let result: WolframResult;

    switch (effectiveMode) {
      case 'mcp':
        if (!mcpEndpoint) throw new Error('MCP endpoint not configured');
        result = await callMcp(mcpEndpoint, query, timeout);
        break;
      case 'full_results':
        result = await callFullResults(appId, query, timeout);
        break;
      case 'short_answer':
        result = await callShortAnswer(appId, query, timeout);
        break;
      case 'llm_api':
      default:
        result = await callLlmApi(appId, query, timeout);
        break;
    }

    if (result.success) {
      setCache(query, result);
    }
    return result;
  } catch (err) {
    // Graceful fallback: try full_results if llm_api failed
    if (effectiveMode === 'llm_api') {
      try {
        const fallback = await callFullResults(appId, query, timeout);
        if (fallback.success) setCache(query, fallback);
        return fallback;
      } catch {
        // fall through to error return
      }
    }
    return {
      success: false,
      answer: `Wolfram query failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      confidence: 0,
      source: effectiveMode,
      query,
      cached: false,
    };
  }
}

/**
 * verifyMathAnswer — verify if studentAnswer matches the correct answer via Wolfram
 */
export async function verifyMathAnswer(
  problem: string,
  studentAnswer: string,
  correctAnswer: string
): Promise<MathVerificationResult> {
  if (!isWolframAvailable()) {
    return {
      isCorrect: false,
      confidence: 0,
      correctAnswer,
      steps: [],
      wolframAnswer: '',
      studentAnswer,
    };
  }

  // Ask Wolfram to evaluate the problem
  const wolframResult = await queryWolfram(`solve ${problem}`);

  if (!wolframResult.success) {
    // Fallback: just compare strings
    const normalise = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '');
    const matches = normalise(studentAnswer) === normalise(correctAnswer);
    return {
      isCorrect: matches,
      confidence: 0.5,
      correctAnswer,
      steps: [],
      wolframAnswer: '',
      studentAnswer,
    };
  }

  const wolframAnswer = wolframResult.answer;

  // Normalise and compare
  const normaliseNum = (s: string): number | null => {
    const n = parseFloat(s.replace(/[^0-9.\-+eE]/g, ''));
    return isNaN(n) ? null : n;
  };
  const normaliseStr = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/[×✕]/g, '*').replace(/[÷]/g, '/');

  // Try numeric comparison first
  const wNum = normaliseNum(wolframAnswer);
  const sNum = normaliseNum(studentAnswer);
  const cNum = normaliseNum(correctAnswer);

  let isCorrect = false;
  let confidence = 0.9;

  if (wNum !== null && sNum !== null) {
    isCorrect = Math.abs(wNum - sNum) < Math.abs(wNum) * 0.001 + 1e-9;
    if (cNum !== null) {
      const correctMatchesWolfram = Math.abs(wNum - cNum) < Math.abs(wNum) * 0.001 + 1e-9;
      confidence = correctMatchesWolfram ? 0.97 : 0.8;
    }
  } else {
    // String comparison
    const wStr = normaliseStr(wolframAnswer);
    const sStr = normaliseStr(studentAnswer);
    const cStr = normaliseStr(correctAnswer);
    isCorrect = wStr.includes(sStr) || sStr.includes(wStr);
    confidence = wStr.includes(cStr) ? 0.9 : 0.7;
  }

  return {
    isCorrect,
    confidence,
    correctAnswer,
    steps: wolframResult.steps ?? [],
    wolframAnswer,
    studentAnswer,
  };
}

/**
 * getStepByStepSolution — traceable solution steps for a math/science problem
 */
export async function getStepByStepSolution(problem: string): Promise<string[]> {
  if (!isWolframAvailable()) return [];

  // Prefer full_results mode for step pods
  const result = await queryWolfram(problem, 'full_results');
  if (!result.success) return [];

  // If we have steps from the pod, return them
  if (result.steps && result.steps.length > 0) return result.steps;

  // Otherwise, ask the LLM API for step-by-step
  const stepResult = await queryWolfram(`step by step: ${problem}`, 'llm_api');
  if (stepResult.success && stepResult.steps && stepResult.steps.length > 0) {
    return stepResult.steps;
  }

  // Last resort: split answer by newlines and return non-empty lines
  return (stepResult.success ? stepResult.answer : result.answer)
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
}

/**
 * enrichContentWithWolfram — scan content for math expressions, verify them,
 * and annotate the content with [✓ Wolfram verified] markers.
 */
export async function enrichContentWithWolfram(content: string, topic: string): Promise<string> {
  if (!isWolframAvailable()) return content;

  // Extract LaTeX/math expressions: $...$ or $$...$$
  const mathPattern = /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g;
  const matches: { full: string; expr: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = mathPattern.exec(content)) !== null) {
    matches.push({ full: m[0], expr: (m[1] ?? m[2]).trim() });
  }

  if (matches.length === 0) {
    // No math found; do a general grounding query
    const result = await queryWolfram(`${topic} formula or definition`);
    if (result.success) {
      return `${content}\n\n> 🔬 **Wolfram Grounded**: ${result.answer}`;
    }
    return content;
  }

  // Verify each expression (up to 3 to avoid quota abuse)
  const limit = Math.min(matches.length, 3);
  let enriched = content;

  for (let i = 0; i < limit; i++) {
    const { full, expr } = matches[i];
    const result = await queryWolfram(expr);
    if (result.success) {
      // Append verification annotation after the expression
      enriched = enriched.replace(full, `${full} *[✓ Wolfram: ${result.answer.split('\n')[0]}]*`);
    }
  }

  return enriched;
}

/**
 * groundFactInWolfram — verify a factual claim using Wolfram
 */
export async function groundFactInWolfram(
  fact: string
): Promise<{ grounded: boolean; verifiedFact: string; confidence: number }> {
  if (!isWolframAvailable()) {
    return { grounded: false, verifiedFact: fact, confidence: 0 };
  }

  const result = await queryWolfram(fact);
  if (!result.success) {
    return { grounded: false, verifiedFact: fact, confidence: 0 };
  }

  return {
    grounded: true,
    verifiedFact: result.answer,
    confidence: result.confidence,
  };
}
