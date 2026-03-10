/**
 * liveEvalsSkill.ts — Real-time Agent Quality Evaluation
 * VoltAgent pattern: Run online evaluations against agent outputs.
 *
 * Oracle uses this to score Sage responses and Atlas content in production.
 * All evaluation is heuristic-based — no LLM call required.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type EvalMetric =
  | 'accuracy'         // Is the answer correct? (step-by-step + final answer)
  | 'clarity'          // Is explanation clear? (sentence length, structure)
  | 'pedagogical'      // Does it teach? (because, therefore, notice that)
  | 'brevity'          // Is it appropriately concise?
  | 'engagement'       // Emoji usage, questions to student, encouragement
  | 'curriculum_fit';  // Does it match exam syllabus expectations?

export interface EvalResult {
  metric: EvalMetric;
  score: number;      // 0–100
  reasoning: string;  // why this score
  flag?: 'good' | 'warning' | 'critical';
}

export interface AgentEvalReport {
  agentId: string;
  sessionId: string;
  responseId: string;
  timestamp: number;
  input: string;
  output: string;
  evals: EvalResult[];
  overallScore: number;       // weighted average
  passedThreshold: boolean;   // score >= 70
  recommendations: string[];  // what to improve
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const EVAL_LOG_KEY = 'oracle:eval_log';
const MAX_LOG_SIZE = 200; // cap at 200 entries in localStorage

// ─── Metric weights ───────────────────────────────────────────────────────────

const METRIC_WEIGHTS: Record<EvalMetric, number> = {
  accuracy:       0.30,
  clarity:        0.25,
  pedagogical:    0.20,
  brevity:        0.10,
  engagement:     0.10,
  curriculum_fit: 0.05,
};

// ─── Scorers ──────────────────────────────────────────────────────────────────

function scoreAccuracy(input: string, output: string): EvalResult {
  let score = 50; // base: uncertain
  const reasons: string[] = [];

  // Check for step-by-step reasoning
  const hasSteps = /step \d|1\.|first,|then,|next,|\[understand\]|\[execute\]/i.test(output);
  if (hasSteps) { score += 20; reasons.push('step-by-step reasoning present'); }

  // Check for a boxed/bolded final answer
  const hasFinalAnswer = /\*\*answer\*\*|\*\*final answer\*\*|∴|therefore.*=|answer:\s*[\d.]/i.test(output);
  if (hasFinalAnswer) { score += 20; reasons.push('final answer clearly stated'); }

  // Check for verification/check step
  const hasVerification = /verify|check|units|confirm|sanity check/i.test(output);
  if (hasVerification) { score += 10; reasons.push('verification step included'); }

  // If input is a simple question and output is brief, assume reasonable accuracy
  if (input.length < 50 && output.length < 300) { score = Math.max(score, 60); }

  score = Math.min(100, score);
  return {
    metric: 'accuracy',
    score,
    reasoning: reasons.length ? reasons.join('; ') : 'No explicit reasoning pattern detected',
    flag: score >= 80 ? 'good' : score >= 60 ? undefined : 'warning',
  };
}

function scoreClarity(output: string): EvalResult {
  const sentences = output.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const words = output.split(/\s+/);
  const avgWordsPerSentence = sentences.length ? words.length / sentences.length : words.length;

  let score = 50;
  const reasons: string[] = [];

  // Sentence length: < 20 words avg = good
  if (avgWordsPerSentence < 15) { score += 20; reasons.push('concise sentences'); }
  else if (avgWordsPerSentence < 20) { score += 10; reasons.push('reasonable sentence length'); }
  else { score -= 10; reasons.push('sentences may be too long'); }

  // Headers/bullets = structured
  const hasBullets = /^[-*•]\s|^\d+\.\s/m.test(output);
  const hasHeaders = /^#{1,4}\s|^\*\*/m.test(output);
  if (hasBullets) { score += 15; reasons.push('uses bullet points'); }
  if (hasHeaders) { score += 15; reasons.push('uses headers/bold structure'); }

  // Code/formula blocks = clarity for math
  const hasCodeBlock = /```|`[^`]+`/.test(output);
  if (hasCodeBlock) { score += 10; reasons.push('uses code/formula blocks'); }

  score = Math.min(100, Math.max(0, score));
  return {
    metric: 'clarity',
    score,
    reasoning: reasons.join('; '),
    flag: score >= 75 ? 'good' : score >= 50 ? undefined : 'warning',
  };
}

function scorePedagogical(output: string): EvalResult {
  const teachingPhrases = [
    'because', 'therefore', 'notice that', 'understand', 'key insight',
    'the reason', 'this works because', 'think of it as', 'intuitively',
    'in other words', 'this means', 'the idea is', 'what this tells us',
    'now you can see', 'connects to', 'recall that', 'building on',
  ];

  let score = 30; // base
  let hits = 0;
  const hitWords: string[] = [];

  const lower = output.toLowerCase();
  for (const phrase of teachingPhrases) {
    if (lower.includes(phrase)) {
      hits++;
      hitWords.push(phrase);
    }
  }

  score += Math.min(60, hits * 10);

  // Also reward ending with a question (Socratic check)
  const endsWithQuestion = /\?\s*$/.test(output.trim());
  if (endsWithQuestion) { score += 10; }

  score = Math.min(100, score);
  return {
    metric: 'pedagogical',
    score,
    reasoning: hits > 0
      ? `Found ${hits} pedagogical phrase(s): ${hitWords.slice(0, 4).join(', ')}`
      : 'No explicit pedagogical language detected',
    flag: score >= 70 ? 'good' : score >= 50 ? undefined : 'warning',
  };
}

function scoreBrevity(output: string): EvalResult {
  const wordCount = output.split(/\s+/).length;
  let score: number;
  let reasoning: string;

  if (wordCount < 200) { score = 100; reasoning = `${wordCount} words — concise`; }
  else if (wordCount < 400) { score = 80; reasoning = `${wordCount} words — good length`; }
  else if (wordCount < 600) { score = 60; reasoning = `${wordCount} words — slightly long`; }
  else { score = 40; reasoning = `${wordCount} words — may overwhelm student`; }

  return {
    metric: 'brevity',
    score,
    reasoning,
    flag: score >= 80 ? 'good' : score >= 60 ? undefined : 'warning',
  };
}

function scoreEngagement(output: string): EvalResult {
  let score = 30;
  let reasons: string[] = [];

  // Count question marks (engagement through questions)
  const questionCount = (output.match(/\?/g) ?? []).length;
  const questionBonus = Math.min(25, questionCount * 5);
  if (questionCount > 0) { score += questionBonus; reasons.push(`${questionCount} question(s) to student`); }

  // Count exclamation marks (enthusiasm)
  const exclamationCount = (output.match(/!/g) ?? []).length;
  if (exclamationCount > 0 && exclamationCount < 5) {
    score += Math.min(10, exclamationCount * 5);
    reasons.push('appropriate enthusiasm');
  }

  // Emoji detection (Unicode ranges for common emoji)
  const emojiCount = (output.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/gu) ?? []).length;
  const emojiBonus = Math.min(25, emojiCount * 5);
  if (emojiCount > 0) { score += emojiBonus; reasons.push(`${emojiCount} emoji used`); }

  // Encouragement phrases
  const encouragement = ['well done', 'great', 'exactly', 'spot on', 'nicely', 'you\'ve got', 'you\'re right', '🎯', '💡', '🔥', '✅'];
  const hasEncouragement = encouragement.some(e => output.toLowerCase().includes(e));
  if (hasEncouragement) { score += 10; reasons.push('encouragement present'); }

  score = Math.min(100, score);
  return {
    metric: 'engagement',
    score,
    reasoning: reasons.length ? reasons.join('; ') : 'Minimal engagement signals',
    flag: score >= 70 ? 'good' : score >= 40 ? undefined : 'warning',
  };
}

function scoreCurriculumFit(input: string, output: string): EvalResult {
  // Heuristic: does output mention exam-relevant keywords from the input topic?
  const examKeywords: Record<string, string[]> = {
    gate: ['gate', 'engineering', 'ece', 'eee', 'cse', 'mech', 'civil', 'signal', 'control', 'network'],
    jee: ['jee', 'iit', 'mains', 'advanced', 'physics', 'chemistry', 'maths', 'board'],
    neet: ['neet', 'biology', 'zoology', 'botany', 'physiology', 'anatomy', 'biochemistry'],
    cat: ['cat', 'mba', 'quant', 'verbal', 'dilr', 'reading comprehension', 'data interpretation'],
    upsc: ['upsc', 'ias', 'polity', 'economy', 'history', 'geography', 'science & tech'],
  };

  const combined = (input + ' ' + output).toLowerCase();
  let score = 40; // base
  let matchedKeywords: string[] = [];

  for (const [, keywords] of Object.entries(examKeywords)) {
    for (const kw of keywords) {
      if (combined.includes(kw)) {
        score += 5;
        matchedKeywords.push(kw);
        if (score >= 100) break;
      }
    }
  }

  score = Math.min(100, score);
  return {
    metric: 'curriculum_fit',
    score,
    reasoning: matchedKeywords.length
      ? `Matched exam keywords: ${[...new Set(matchedKeywords)].slice(0, 5).join(', ')}`
      : 'No specific exam keywords detected',
    flag: score >= 70 ? 'good' : score >= 50 ? undefined : 'warning',
  };
}

// ─── Core evaluator ───────────────────────────────────────────────────────────

/**
 * Core heuristic evaluator — no LLM call required.
 */
export function evaluateAgentResponse(
  agentId: string,
  input: string,
  output: string,
  metrics: EvalMetric[]
): AgentEvalReport {
  const evals: EvalResult[] = [];
  const sessionId = `eval-${Date.now()}`;
  const responseId = `resp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  for (const metric of metrics) {
    switch (metric) {
      case 'accuracy':       evals.push(scoreAccuracy(input, output)); break;
      case 'clarity':        evals.push(scoreClarity(output)); break;
      case 'pedagogical':    evals.push(scorePedagogical(output)); break;
      case 'brevity':        evals.push(scoreBrevity(output)); break;
      case 'engagement':     evals.push(scoreEngagement(output)); break;
      case 'curriculum_fit': evals.push(scoreCurriculumFit(input, output)); break;
    }
  }

  // Weighted average
  let totalWeight = 0;
  let weightedScore = 0;
  for (const ev of evals) {
    const weight = METRIC_WEIGHTS[ev.metric] ?? 0.1;
    weightedScore += ev.score * weight;
    totalWeight += weight;
  }
  const overallScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

  // Build recommendations from warnings/criticals
  const recommendations: string[] = [];
  for (const ev of evals) {
    if (ev.flag === 'warning' || ev.flag === 'critical') {
      const fixes: Record<EvalMetric, string> = {
        accuracy:       'Add explicit step-by-step reasoning and a clearly boxed final answer.',
        clarity:        'Use shorter sentences (<20 words). Add headers and bullet points.',
        pedagogical:    'Explain WHY, not just HOW. Use "because", "therefore", "notice that".',
        brevity:        'Response is too long. Break into parts or summarise key points.',
        engagement:     'Add a follow-up question. Use 1-2 emojis. Acknowledge effort.',
        curriculum_fit: 'Reference specific exam context (GATE, JEE, etc.) in the response.',
      };
      recommendations.push(fixes[ev.metric]);
    }
  }

  return {
    agentId,
    sessionId,
    responseId,
    timestamp: Date.now(),
    input,
    output,
    evals,
    overallScore,
    passedThreshold: overallScore >= 70,
    recommendations: [...new Set(recommendations)],
  };
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export function saveEvalReport(report: AgentEvalReport): void {
  try {
    const existing = getEvalLog();
    existing.unshift(report); // newest first
    const capped = existing.slice(0, MAX_LOG_SIZE);
    localStorage.setItem(EVAL_LOG_KEY, JSON.stringify(capped));
  } catch {
    // localStorage may be full or unavailable — silent fail
  }
}

export function getEvalLog(agentId?: string, limit = 50): AgentEvalReport[] {
  try {
    const raw = localStorage.getItem(EVAL_LOG_KEY);
    if (!raw) return [];
    const all: AgentEvalReport[] = JSON.parse(raw);
    const filtered = agentId ? all.filter(r => r.agentId === agentId) : all;
    return filtered.slice(0, limit);
  } catch {
    return [];
  }
}

export function getAgentQualityScore(agentId: string): number {
  const log = getEvalLog(agentId, 20);
  if (log.length === 0) return 0;
  const sum = log.reduce((acc, r) => acc + r.overallScore, 0);
  return Math.round(sum / log.length);
}

export function getEvalSummary(): Record<string, { avgScore: number; total: number; passing: number }> {
  const log = getEvalLog(undefined, MAX_LOG_SIZE);
  const byAgent: Record<string, AgentEvalReport[]> = {};

  for (const report of log) {
    if (!byAgent[report.agentId]) byAgent[report.agentId] = [];
    byAgent[report.agentId].push(report);
  }

  const summary: Record<string, { avgScore: number; total: number; passing: number }> = {};
  for (const [agentId, reports] of Object.entries(byAgent)) {
    const total = reports.length;
    const passing = reports.filter(r => r.passedThreshold).length;
    const avgScore = Math.round(reports.reduce((a, r) => a + r.overallScore, 0) / total);
    summary[agentId] = { avgScore, total, passing };
  }

  return summary;
}
