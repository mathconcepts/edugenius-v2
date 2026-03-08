/**
 * staticPyqService.ts — Unified Static PYQ Service
 *
 * Normalises GATE EM and CAT PYQs into a common StaticPYQ interface,
 * provides keyword-based search, and formats context strings for Sage injection.
 */

import { GATE_EM_PYQS, PyqQuestion } from './gateEmPyqContext';
import { CAT_PYQS, CatPyqQuestion } from './catPyqContext';

// ─── Common interface ─────────────────────────────────────────────────────────

export interface StaticPYQ {
  id: string;
  examId: string;      // 'gate-em' | 'cat' | ...
  year: number;
  topic: string;
  question: string;
  options: Record<string, string>;
  answer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  passage?: string;
  type?: 'mcq' | 'tita';
}

// ─── Normalise GATE EM PYQs ───────────────────────────────────────────────────

function normaliseGatePyq(q: PyqQuestion, idx: number): StaticPYQ {
  return {
    id: `gate-em-${q.year}-${idx}`,
    examId: 'gate-em',
    year: q.year,
    topic: q.topic,
    question: q.question,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
    difficulty: q.difficulty,
    type: 'mcq',
  };
}

// ─── Normalise CAT PYQs ───────────────────────────────────────────────────────

function normaliseCatPyq(q: CatPyqQuestion, idx: number): StaticPYQ {
  return {
    id: `cat-${q.year}-${idx}`,
    examId: 'cat',
    year: q.year,
    topic: q.topic,
    question: q.question,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
    difficulty: q.difficulty,
    passage: q.passage,
    type: q.type,
  };
}

// ─── Master index ─────────────────────────────────────────────────────────────

let _allPyqs: StaticPYQ[] | null = null;

export function getAllStaticPYQs(): StaticPYQ[] {
  if (_allPyqs) return _allPyqs;
  _allPyqs = [
    ...GATE_EM_PYQS.map(normaliseGatePyq),
    ...CAT_PYQS.map(normaliseCatPyq),
  ];
  return _allPyqs;
}

// ─── Keyword scoring ──────────────────────────────────────────────────────────

function scoreQuery(pyq: StaticPYQ, query: string): number {
  const tokens = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);

  if (tokens.length === 0) return 0;

  const haystack = [
    pyq.question,
    pyq.explanation,
    pyq.topic,
    ...Object.values(pyq.options),
  ]
    .join(' ')
    .toLowerCase();

  let hits = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) hits++;
  }

  return hits / tokens.length;
}

// ─── Search ───────────────────────────────────────────────────────────────────

export function searchStaticPYQs(
  query: string,
  examId: string,
  topK = 5
): StaticPYQ[] {
  const all = getAllStaticPYQs();

  // Filter by exam; accept partial matches: 'gate' matches 'gate-em'
  const pool = examId
    ? all.filter((p) => p.examId === examId || p.examId.startsWith(examId.split('-')[0]))
    : all;

  const scored = pool
    .map((pyq) => ({ pyq, score: scoreQuery(pyq, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map(({ pyq }) => pyq);
}

// ─── Format for Sage ──────────────────────────────────────────────────────────

function formatPYQ(pyq: StaticPYQ): string {
  const optionLines = Object.entries(pyq.options)
    .map(([k, v]) => `  ${k}) ${v}`)
    .join('\n');

  const optionSection = optionLines ? `Options:\n${optionLines}\n` : '';
  const passageSection = pyq.passage ? `Passage: ${pyq.passage}\n` : '';

  return [
    `[${pyq.examId.toUpperCase()} ${pyq.year} | ${pyq.topic} | ${pyq.difficulty}]`,
    `Q: ${pyq.question}`,
    passageSection,
    optionSection,
    `Answer: ${pyq.answer}`,
    `Explanation: ${pyq.explanation}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Returns a formatted PYQ context string for injection into Sage's system prompt.
 * Returns null if no relevant PYQs found.
 */
export function getStaticPYQContext(query: string, examId: string): string | null {
  const results = searchStaticPYQs(query, examId, 3);
  if (results.length === 0) return null;

  const formatted = results.map(formatPYQ).join('\n\n---\n\n');
  return `Related Past Exam Questions:\n\n${formatted}`;
}
