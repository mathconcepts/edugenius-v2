// @ts-nocheck
/**
 * GBrain — Error Taxonomy + Misconception Hunter (Pillar 2)
 *
 * Transforms verification from "right/wrong" to deep diagnosis:
 *   1. Classifies the error type (7 categories)
 *   2. Identifies the specific misconception
 *   3. Explains why the misconception is tempting
 *   4. Generates a corrective problem
 *
 * Error Types:
 *   conceptual          — misunderstands the underlying concept
 *   procedural          — knows concept, applies wrong procedure
 *   notation            — confused by mathematical notation
 *   misread             — misinterpreted the question
 *   time_pressure       — knew the method, rushed and slipped
 *   arithmetic          — pure computation error
 *   overconfidence_skip — skipped steps, missed edge case
 */

import pg from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CONCEPT_MAP } from '../constants/concept-graph';
import { detectTopic } from '../utils/topic-detection';

const { Pool } = pg;

let _pool: any = null;
function getPool() {
  if (_pool) return _pool;
  _pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  return _pool;
}

// ============================================================================
// Types
// ============================================================================

export type ErrorType =
  | 'conceptual'
  | 'procedural'
  | 'notation'
  | 'misread'
  | 'time_pressure'
  | 'arithmetic'
  | 'overconfidence_skip';

export interface ErrorDiagnosis {
  error_type: ErrorType;
  concept_id: string;
  misconception_id: string;
  diagnosis: string;        // What went wrong
  why_tempting: string;     // Why the student's approach seemed reasonable
  why_wrong: string;        // The specific flaw in reasoning
  corrective_hint: string;  // Targeted hint to fix the misconception
  corrective_problem?: {    // Problem to lock in the distinction
    question: string;
    answer: string;
    explanation: string;
  };
}

export interface ErrorPatternReport {
  session_id: string;
  total_errors: number;
  by_type: Record<ErrorType, number>;
  by_concept: Record<string, number>;
  top_misconceptions: Array<{ id: string; count: number; description: string }>;
  trend: 'improving' | 'stable' | 'declining';
  recommendations: string[];
}

// ============================================================================
// Error Classification (Gemini structured output)
// ============================================================================

const ERROR_CLASSIFIER_PROMPT = `You are an expert mathematics error diagnostician for GATE Engineering Mathematics.

Given a math problem, the student's wrong answer, and the correct answer, classify the error.

Respond ONLY with a JSON object (no markdown, no backticks):
{
  "error_type": "conceptual|procedural|notation|misread|time_pressure|arithmetic|overconfidence_skip",
  "concept_id": "the-specific-concept-id-where-error-occurred",
  "misconception_id": "brief-kebab-case-misconception-name",
  "diagnosis": "One sentence: what specifically went wrong",
  "why_tempting": "One sentence: why the student's approach seemed reasonable",
  "why_wrong": "One sentence: the specific flaw in the reasoning",
  "corrective_hint": "One sentence: what to focus on to fix this"
}

Error type definitions:
- conceptual: misunderstands the underlying mathematical concept
- procedural: understands concept but applies the wrong procedure or formula
- notation: confused by mathematical notation or symbols
- misread: misinterpreted what the question was asking
- time_pressure: knew the method but rushed and made a careless error
- arithmetic: pure computation/calculation error (right method, wrong numbers)
- overconfidence_skip: skipped necessary steps and missed an edge case

For concept_id, use these GATE math concept identifiers where applicable:
sequences, series, limits, continuity, differentiability, derivatives-basic, chain-rule,
product-quotient-rule, implicit-differentiation, maxima-minima, mean-value-theorems,
integration-basics, integration-substitution, integration-by-parts, partial-fractions,
definite-integrals, improper-integrals, multivariable-calculus, multiple-integrals,
matrix-operations, determinants, matrix-inverse, systems-of-equations, rank-nullity,
vector-spaces, eigenvalues, diagonalization, cayley-hamilton, orthogonality,
ode-first-order, ode-second-order-homo, ode-second-order-nonhomo,
probability-basics, random-variables, discrete-distributions, continuous-distributions,
complex-numbers, analytic-functions, complex-integration, residue-calculus,
root-finding, interpolation, numerical-integration,
laplace-transform, inverse-laplace, fourier-series, fourier-transform,
vector-fields, divergence-curl, line-integrals, greens-theorem, stokes-theorem,
graph-basics, graph-connectivity, trees, euler-hamilton`;

/**
 * Classify a student's error using Gemini structured output.
 */
export async function classifyError(
  problem: string,
  studentAnswer: string,
  correctAnswer: string,
  timeTakenMs?: number,
): Promise<ErrorDiagnosis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Fallback: return generic diagnosis
    return {
      error_type: 'conceptual',
      concept_id: detectTopic(problem) || 'unknown',
      misconception_id: 'unclassified',
      diagnosis: 'The answer was incorrect.',
      why_tempting: 'The approach may have seemed reasonable.',
      why_wrong: 'The specific error needs further analysis.',
      corrective_hint: 'Review the core concept and try again.',
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const timeContext = timeTakenMs
    ? `\nTime taken: ${Math.round(timeTakenMs / 1000)}s (consider time_pressure if very fast)`
    : '';

  const prompt = `${ERROR_CLASSIFIER_PROMPT}

Problem: ${problem}
Student's answer: ${studentAnswer}
Correct answer: ${correctAnswer}${timeContext}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned) as ErrorDiagnosis;

    // Validate error_type
    const validTypes: ErrorType[] = [
      'conceptual', 'procedural', 'notation', 'misread',
      'time_pressure', 'arithmetic', 'overconfidence_skip',
    ];
    if (!validTypes.includes(parsed.error_type)) {
      parsed.error_type = 'conceptual';
    }

    return parsed;
  } catch (err) {
    console.error('[gbrain/error-taxonomy] Classification failed:', (err as Error).message);
    return {
      error_type: 'conceptual',
      concept_id: detectTopic(problem) || 'unknown',
      misconception_id: 'classification-failed',
      diagnosis: 'The answer was incorrect. Error classification unavailable.',
      why_tempting: '',
      why_wrong: '',
      corrective_hint: 'Review the topic and try a similar problem.',
    };
  }
}

// ============================================================================
// Misconception Explainer + Corrective Problem Generator
// ============================================================================

const MISCONCEPTION_PROMPT = `You are an expert GATE math tutor. Given an error diagnosis, generate:
1. A detailed explanation of why the misconception is tempting and why it's wrong
2. A corrective problem that specifically distinguishes the correct concept from the misconception

Respond ONLY with JSON (no markdown):
{
  "detailed_explanation": "2-3 sentences explaining the misconception clearly, addressing the student directly using 'you'",
  "corrective_problem": {
    "question": "A problem that tests exactly this distinction",
    "answer": "The correct answer",
    "explanation": "Step-by-step solution highlighting the key distinction"
  }
}

Use LaTeX ($..$ for inline, $$...$$ for display) in all math.`;

/**
 * Generate detailed misconception explanation + corrective problem.
 */
export async function generateMisconceptionExplanation(
  diagnosis: ErrorDiagnosis,
  problem: string,
  representationMode: string = 'balanced',
): Promise<ErrorDiagnosis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return diagnosis;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `${MISCONCEPTION_PROMPT}

Original problem: ${problem}
Error type: ${diagnosis.error_type}
Misconception: ${diagnosis.misconception_id}
Diagnosis: ${diagnosis.diagnosis}
Why tempting: ${diagnosis.why_tempting}
Why wrong: ${diagnosis.why_wrong}
Student's preferred representation: ${representationMode}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (parsed.detailed_explanation) {
      diagnosis.why_tempting = parsed.detailed_explanation;
    }
    if (parsed.corrective_problem) {
      diagnosis.corrective_problem = parsed.corrective_problem;
    }

    return diagnosis;
  } catch (err) {
    console.error('[gbrain/error-taxonomy] Misconception explanation failed:', (err as Error).message);
    return diagnosis;
  }
}

// ============================================================================
// Error Logging
// ============================================================================

/** Log a classified error to the database */
export async function logError(
  sessionId: string,
  diagnosis: ErrorDiagnosis,
  context: {
    problemId?: string;
    studentAnswer?: string;
    correctAnswer?: string;
    timeTakenMs?: number;
    confidenceBefore?: number;
  },
): Promise<void> {
  const pool = getPool();
  const topic = CONCEPT_MAP.get(diagnosis.concept_id)?.topic || detectTopic(context.studentAnswer || '') || 'unknown';

  await pool.query(
    `INSERT INTO error_log
     (session_id, problem_id, concept_id, topic, error_type, misconception_id,
      diagnosis, why_tempting, why_wrong, corrective_hint,
      student_answer, correct_answer, time_taken_ms, confidence_before)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      sessionId,
      context.problemId || null,
      diagnosis.concept_id,
      topic,
      diagnosis.error_type,
      diagnosis.misconception_id,
      diagnosis.diagnosis,
      diagnosis.why_tempting,
      diagnosis.why_wrong,
      diagnosis.corrective_hint,
      context.studentAnswer || null,
      context.correctAnswer || null,
      context.timeTakenMs || null,
      context.confidenceBefore || null,
    ],
  );
}

// ============================================================================
// Error Pattern Reports (Pillar 9: Metacognitive)
// ============================================================================

/** Generate weekly error pattern report for a student */
export async function getErrorPatternReport(
  sessionId: string,
  daysBack: number = 7,
): Promise<ErrorPatternReport> {
  const pool = getPool();

  // Get error counts by type
  const typeResult = await pool.query(
    `SELECT error_type, COUNT(*) as count
     FROM error_log
     WHERE session_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval
     GROUP BY error_type ORDER BY count DESC`,
    [sessionId, daysBack],
  );

  // Get error counts by concept
  const conceptResult = await pool.query(
    `SELECT concept_id, COUNT(*) as count
     FROM error_log
     WHERE session_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval
     GROUP BY concept_id ORDER BY count DESC LIMIT 10`,
    [sessionId, daysBack],
  );

  // Get top misconceptions
  const misconceptionResult = await pool.query(
    `SELECT misconception_id, diagnosis, COUNT(*) as count
     FROM error_log
     WHERE session_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval
     GROUP BY misconception_id, diagnosis ORDER BY count DESC LIMIT 5`,
    [sessionId, daysBack],
  );

  // Trend: compare this period to previous period
  const currentCount = typeResult.rows.reduce((sum: number, r: any) => sum + parseInt(r.count), 0);
  const prevResult = await pool.query(
    `SELECT COUNT(*) as count FROM error_log
     WHERE session_id = $1
       AND created_at >= NOW() - ($2 * 2 || ' days')::interval
       AND created_at < NOW() - ($2 || ' days')::interval`,
    [sessionId, daysBack],
  );
  const prevCount = parseInt(prevResult.rows[0]?.count || '0');

  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (prevCount > 0) {
    const ratio = currentCount / prevCount;
    if (ratio < 0.8) trend = 'improving';
    else if (ratio > 1.2) trend = 'declining';
  }

  // Generate recommendations
  const recommendations: string[] = [];
  const byType: Record<ErrorType, number> = {} as any;
  for (const r of typeResult.rows) {
    byType[r.error_type as ErrorType] = parseInt(r.count);
  }

  if ((byType.arithmetic || 0) > currentCount * 0.3) {
    recommendations.push('Over 30% of errors are arithmetic. Try slower, more deliberate calculation. Write out intermediate steps.');
  }
  if ((byType.conceptual || 0) > currentCount * 0.3) {
    recommendations.push('Many conceptual errors detected. Revisit foundational concepts before attempting harder problems.');
  }
  if ((byType.time_pressure || 0) > currentCount * 0.2) {
    recommendations.push('Time pressure is causing errors. Practice with relaxed time limits first, then gradually tighten.');
  }
  if ((byType.overconfidence_skip || 0) > currentCount * 0.2) {
    recommendations.push('You\'re skipping steps and missing edge cases. Write out every step — speed comes from fluency, not shortcuts.');
  }

  const byConcept: Record<string, number> = {};
  for (const r of conceptResult.rows) {
    byConcept[r.concept_id] = parseInt(r.count);
  }

  return {
    session_id: sessionId,
    total_errors: currentCount,
    by_type: byType,
    by_concept: byConcept,
    top_misconceptions: misconceptionResult.rows.map((r: any) => ({
      id: r.misconception_id,
      count: parseInt(r.count),
      description: r.diagnosis,
    })),
    trend,
    recommendations,
  };
}
