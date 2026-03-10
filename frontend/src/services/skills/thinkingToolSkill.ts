/**
 * thinkingToolSkill.ts — Structured Reasoning Steps
 * VoltAgent pattern: Structured thinking before final answer.
 *
 * For complex problems (math, physics, multi-step):
 *   1. UNDERSTAND: Restate the problem
 *   2. IDENTIFY: What formulas/concepts apply?
 *   3. PLAN: Steps to solve
 *   4. EXECUTE: Work through each step
 *   5. VERIFY: Check answer (units, magnitude, logic)
 *   6. SUMMARIZE: Final answer with key insight
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThinkingStep {
  phase: 'understand' | 'identify' | 'plan' | 'execute' | 'verify' | 'summarize';
  content: string;
  duration?: number; // ms
}

export interface ThinkingResult {
  steps: ThinkingStep[];
  finalAnswer: string;
  confidence: 'high' | 'medium' | 'low';
  requiresWolfram: boolean;   // true if numerical computation detected
  keyFormulas: string[];
  commonMistakes: string[];
}

export interface ThinkingBlock {
  title: string;
  steps: { label: string; content: string }[];
  finalAnswer: string;
  confidence: string;
}

// ─── Phase labels ─────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<ThinkingStep['phase'], string> = {
  understand: '🔍 Understand',
  identify:   '📐 Identify Formulas',
  plan:       '🗺️ Plan',
  execute:    '⚙️ Execute',
  verify:     '✅ Verify',
  summarize:  '💡 Summary',
};

// ─── Detection heuristics ─────────────────────────────────────────────────────

const MULTI_STEP_KEYWORDS = [
  'find', 'calculate', 'derive', 'prove', 'determine', 'compute', 'evaluate',
  'solve for', 'show that', 'verify that', 'what is the value', 'how much',
  'what will be', 'obtain', 'integrate', 'differentiate', 'maximise', 'minimise',
];

const EQUATION_PATTERN = /[a-zA-Z]\s*[=<>≤≥]\s*[-\d.a-zA-Z+\-*/^()√∫∑]/;
const NUMBER_AND_VARIABLE_PATTERN = /\d+[\s.]*(?:m|s|kg|N|J|V|A|Ω|Hz|Pa|K|mol|rad|m\/s|km\/h)?(?:\s+and\s+|\s*[+\-*/]\s*).*[a-zA-Z]/i;

/**
 * Detect if a question needs structured thinking (vs simple factual answer).
 */
export function needsStructuredThinking(question: string): boolean {
  const lower = question.toLowerCase().trim();

  // Too short to be complex
  if (lower.length < 20) return false;

  // Contains equation-like pattern
  if (EQUATION_PATTERN.test(question)) return true;

  // Contains numbers + variables together
  if (NUMBER_AND_VARIABLE_PATTERN.test(question)) return true;

  // Multi-step keywords
  if (MULTI_STEP_KEYWORDS.some(kw => lower.includes(kw))) return true;

  // Lengthy question (usually complex)
  if (question.length > 100) return true;

  return false;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Builds a system prompt addition that forces structured reasoning for Sage.
 */
export function buildThinkingPrompt(question: string, examType: string, topic: string): string {
  return `
THINKING PROTOCOL ACTIVATED for this question:
Topic: ${topic} | Exam: ${examType}

Question: "${question}"

Work through these phases EXPLICITLY and label each one:

[UNDERSTAND] Restate the problem in your own words. What exactly are we finding?

[IDENTIFY] What formulas, theorems, or concepts apply here? List them with variable definitions.

[PLAN] What are the ordered steps to solve this? (numbered list)

[EXECUTE] Work through each step, showing ALL algebra/arithmetic. Don't skip steps.

[VERIFY] Check: Are units consistent? Is the magnitude physically reasonable? Does a special case confirm this?

[SUMMARIZE] State the final answer clearly. Add one key insight students often miss.

Do NOT skip any phase. Show your reasoning like a topper would in an answer script.
`.trim();
}

// ─── Output parser ────────────────────────────────────────────────────────────

/**
 * Parse LLM output (expected to contain [PHASE] blocks) into a ThinkingResult.
 * Gracefully handles partial or missing phases.
 */
export function parseThinkingOutput(raw: string): ThinkingResult {
  const phases: ThinkingStep['phase'][] = ['understand', 'identify', 'plan', 'execute', 'verify', 'summarize'];
  const phaseKeys: Record<string, ThinkingStep['phase']> = {
    UNDERSTAND: 'understand',
    IDENTIFY:   'identify',
    PLAN:       'plan',
    EXECUTE:    'execute',
    VERIFY:     'verify',
    SUMMARIZE:  'summarize',
  };

  const steps: ThinkingStep[] = [];
  let finalAnswer = '';
  let currentPhase: ThinkingStep['phase'] | null = null;
  let currentContent: string[] = [];

  const flushCurrent = () => {
    if (currentPhase && currentContent.length > 0) {
      steps.push({ phase: currentPhase, content: currentContent.join('\n').trim() });
    }
    currentContent = [];
  };

  for (const line of raw.split('\n')) {
    // Detect phase headers like [UNDERSTAND], [IDENTIFY], etc.
    const phaseMatch = line.match(/^\[([A-Z ]+)\]/);
    if (phaseMatch) {
      const key = phaseMatch[1].trim().toUpperCase().split(' ')[0];
      if (phaseKeys[key]) {
        flushCurrent();
        currentPhase = phaseKeys[key];
        // Content after the phase tag on the same line
        const rest = line.replace(/^\[[A-Z ]+\]\s*/, '').trim();
        if (rest) currentContent.push(rest);
        continue;
      }
    }
    if (currentPhase) {
      currentContent.push(line);
    }
  }
  flushCurrent();

  // Extract final answer from summarize step
  const summarizeStep = steps.find(s => s.phase === 'summarize');
  if (summarizeStep) {
    finalAnswer = summarizeStep.content;
  } else if (steps.length > 0) {
    finalAnswer = steps[steps.length - 1].content;
  } else {
    finalAnswer = raw.trim();
  }

  // Fill in any missing phases with empty stubs
  for (const p of phases) {
    if (!steps.find(s => s.phase === p)) {
      steps.push({ phase: p, content: '' });
    }
  }
  // Sort steps by phase order
  steps.sort((a, b) => phases.indexOf(a.phase) - phases.indexOf(b.phase));

  // Heuristics for metadata
  const requiresWolfram = /\d+\.?\d*\s*[\^*/]\s*\d+/.test(raw) || /integral|derivative|∫|∂/.test(raw);
  const keyFormulas = extractFormulas(raw);
  const commonMistakes = extractCommonMistakes(raw);
  const confidence = steps.filter(s => s.content.length > 10).length >= 4 ? 'high' :
                     steps.filter(s => s.content.length > 5).length >= 2 ? 'medium' : 'low';

  return { steps, finalAnswer, confidence, requiresWolfram, keyFormulas, commonMistakes };
}

// ─── Block builder ────────────────────────────────────────────────────────────

/**
 * Build a display-ready ThinkingBlock for ContentCard/UI rendering.
 */
export function buildThinkingBlock(result: ThinkingResult): ThinkingBlock {
  const confidenceLabels = { high: '🟢 High', medium: '🟡 Medium', low: '🔴 Low' };

  return {
    title: '🧠 Step-by-Step Reasoning',
    steps: result.steps
      .filter(s => s.content.length > 0)
      .map(s => ({
        label: PHASE_LABELS[s.phase],
        content: s.content,
      })),
    finalAnswer: result.finalAnswer,
    confidence: confidenceLabels[result.confidence],
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function extractFormulas(text: string): string[] {
  const formulaPattern = /[A-Za-z]\s*=\s*[^.\n]{5,50}/g;
  const matches = text.match(formulaPattern) ?? [];
  return [...new Set(matches)].slice(0, 5);
}

function extractCommonMistakes(text: string): string[] {
  const mistakePattern = /(?:common mistake|often forget|students miss|watch out|don't forget|beware)[^\n.!?]{5,100}/gi;
  const matches = text.match(mistakePattern) ?? [];
  return matches.slice(0, 3);
}
