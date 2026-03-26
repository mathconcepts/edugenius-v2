// @ts-nocheck
/**
 * Auto-Content Flywheel — Daily Problem Generation Pipeline
 *
 * Generates GATE math problems via Gemini, verifies through 3-tier pipeline,
 * publishes verified problems as SEO pages + queues for Telegram.
 *
 * Called via external cron: POST /api/flywheel/generate (Bearer CRON_SECRET)
 *
 * Flow:
 *   1. Pick topic (weighted toward low-count topics)
 *   2. Gemini generates MCQ
 *   3. 3-tier verify (RAG → LLM → Wolfram)
 *   4. If verified: INSERT pyq_questions + seo_pages
 *   5. Best problem queued for Telegram (posted_at = NULL)
 */

import { ServerResponse } from 'http';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// Types
// ============================================================================

interface ParsedRequest {
  pathname: string;
  query: URLSearchParams;
  params: Record<string, string>;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}

type RouteHandler = (req: ParsedRequest, res: ServerResponse) => Promise<void>;

interface RouteDefinition {
  method: string;
  path: string;
  handler: RouteHandler;
}

interface GeneratedProblem {
  question_text: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
}

// ============================================================================
// Configuration
// ============================================================================

const GATE_TOPICS = [
  'linear-algebra', 'calculus', 'differential-equations', 'complex-variables',
  'probability-statistics', 'numerical-methods', 'transform-theory',
  'discrete-mathematics', 'graph-theory', 'vector-calculus',
];

const BATCH_SIZE = 5;
const MIN_CONFIDENCE = 0.8;

let _pool: any = null;
let _orchestrator: any = null;

function getPool() {
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('[flywheel] DATABASE_URL not configured');
  const { Pool } = require('pg');
  _pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 30_000 });
  return _pool;
}

export function setFlywheelOrchestrator(orch: any): void {
  _orchestrator = orch;
}

// ============================================================================
// Topic Selection (weighted toward low-count topics)
// ============================================================================

async function selectTopic(): Promise<string> {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT topic, COUNT(*) as count
      FROM pyq_questions
      GROUP BY topic
    `);
    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.topic] = parseInt(row.count, 10);
    }

    // Weight: inverse of count (low-count topics get picked more)
    const maxCount = Math.max(...Object.values(counts), 1);
    const weighted = GATE_TOPICS.map(t => ({
      topic: t,
      weight: maxCount - (counts[t] || 0) + 1,
    }));
    const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const w of weighted) {
      roll -= w.weight;
      if (roll <= 0) return w.topic;
    }
  } catch {
    // Fallback: random topic
  }
  return GATE_TOPICS[Math.floor(Math.random() * GATE_TOPICS.length)];
}

// ============================================================================
// Problem Generation
// ============================================================================

async function generateProblem(topic: string): Promise<GeneratedProblem | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error('[flywheel] GEMINI_API_KEY not set');
    return null;
  }

  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const topicLabel = topic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const difficulty = ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)];

  const prompt = `Generate a GATE Engineering Mathematics multiple choice question on ${topicLabel}.
Difficulty: ${difficulty}
Year style: GATE 2020-2025

Requirements:
- Question must be solvable with pen and paper in under 3 minutes
- 4 options labeled A, B, C, D
- One correct answer
- Brief explanation (2-3 sentences)
- Must be distinct from common textbook problems

Respond in EXACTLY this JSON format (no markdown, no code fences):
{
  "question_text": "The question...",
  "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
  "correct_answer": "A",
  "explanation": "Brief explanation...",
  "difficulty": "${difficulty}"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip markdown code fences if present
    const jsonStr = text.replace(/^```(?:json)?\n?/g, '').replace(/\n?```$/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (!parsed.question_text || !parsed.options || !parsed.correct_answer || !parsed.explanation) {
      console.warn('[flywheel] Generated problem missing required fields');
      return null;
    }
    if (!['A', 'B', 'C', 'D'].includes(parsed.correct_answer)) {
      console.warn('[flywheel] Invalid correct_answer:', parsed.correct_answer);
      return null;
    }

    return {
      ...parsed,
      difficulty: parsed.difficulty || difficulty,
      topic,
    };
  } catch (err) {
    console.error('[flywheel] Generation failed:', (err as Error).message);
    return null;
  }
}

// ============================================================================
// Verification + Publishing
// ============================================================================

async function verifyAndPublish(problem: GeneratedProblem): Promise<{ verified: boolean; tier?: string }> {
  if (!_orchestrator) {
    console.error('[flywheel] Orchestrator not set');
    return { verified: false };
  }

  try {
    const answerText = `${problem.correct_answer}) ${problem.options[problem.correct_answer]}`;
    const result = await _orchestrator.verify(problem.question_text, answerText);

    if (result.overallStatus !== 'verified' || result.overallConfidence < MIN_CONFIDENCE) {
      console.log(`[flywheel] Problem rejected: status=${result.overallStatus}, confidence=${result.overallConfidence.toFixed(2)}, tier=${result.tierUsed}`);
      return { verified: false, tier: result.tierUsed };
    }

    // Insert into pyq_questions
    const pool = getPool();
    const topicLabel = problem.topic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const year = new Date().getFullYear();

    const insertResult = await pool.query(
      `INSERT INTO pyq_questions
       (exam_id, year, question_text, options, correct_answer, explanation,
        topic, difficulty, marks, negative_marks, source, generated_at, verification_tier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12)
       RETURNING id`,
      [
        'gate-engineering-maths',
        year,
        problem.question_text,
        JSON.stringify(problem.options),
        problem.correct_answer,
        problem.explanation,
        problem.topic,
        problem.difficulty,
        2,
        -0.67,
        'generated',
        result.tierUsed,
      ],
    );

    const pyqId = insertResult.rows[0].id;

    // Generate SEO page
    const slug = `gate-${problem.topic}-${pyqId.slice(0, 8)}`;
    try {
      await pool.query(
        `INSERT INTO seo_pages (slug, title, html_content, topic, pyq_id, meta_desc)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (slug) DO NOTHING`,
        [
          slug,
          `GATE ${topicLabel} Practice Problem | Verified Solution`,
          generateSEOHtml(problem, pyqId),
          problem.topic,
          pyqId,
          `Practice GATE ${topicLabel} with verified solutions. ${problem.difficulty} difficulty MCQ with step-by-step explanation.`,
        ],
      );
    } catch (seoErr) {
      console.warn('[flywheel] SEO page insert failed (non-fatal):', (seoErr as Error).message);
    }

    console.log(`[flywheel] Published: ${problem.topic} (${problem.difficulty}) via ${result.tierUsed}, pyq_id=${pyqId}`);
    return { verified: true, tier: result.tierUsed };
  } catch (err) {
    console.error('[flywheel] Verify/publish error:', (err as Error).message);
    return { verified: false };
  }
}

function generateSEOHtml(problem: GeneratedProblem, pyqId: string): string {
  const topicLabel = problem.topic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const optionsHtml = Object.entries(problem.options)
    .map(([key, val]) => `<li><strong>${key})</strong> ${escapeHtml(String(val))}</li>`)
    .join('\n      ');

  return `
  <article itemscope itemtype="https://schema.org/Quiz">
    <h1 itemprop="name">GATE ${topicLabel} Practice Problem</h1>
    <meta itemprop="about" content="GATE Engineering Mathematics - ${topicLabel}">

    <section class="problem">
      <h2>Question</h2>
      <p itemprop="text">${escapeHtml(problem.question_text)}</p>
      <ul class="options">
      ${optionsHtml}
      </ul>
    </section>

    <details class="solution">
      <summary>Show Verified Solution</summary>
      <p><strong>Answer: ${problem.correct_answer})</strong> ${escapeHtml(String(problem.options[problem.correct_answer]))}</p>
      <p>${escapeHtml(problem.explanation)}</p>
      <p class="badge">Verified by 3-tier verification pipeline</p>
    </details>

    <footer>
      <p>Practice more at <a href="/">GATE Math Practice</a></p>
    </footer>
  </article>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================
// Main Pipeline
// ============================================================================

async function runFlywheel(): Promise<{ generated: number; verified: number; topics: string[] }> {
  const results = { generated: 0, verified: 0, topics: [] as string[] };

  for (let i = 0; i < BATCH_SIZE; i++) {
    const topic = await selectTopic();
    const problem = await generateProblem(topic);
    if (!problem) continue;
    results.generated++;

    const { verified } = await verifyAndPublish(problem);
    if (verified) {
      results.verified++;
      results.topics.push(topic);
    }
  }

  console.log(`[flywheel] Batch complete: ${results.verified}/${results.generated} verified (${results.topics.join(', ')})`);
  return results;
}

// ============================================================================
// Route Handler
// ============================================================================

async function handleFlywheelGenerate(req: ParsedRequest, res: ServerResponse): Promise<void> {
  // Auth: Bearer CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'CRON_SECRET not configured' }));
    return;
  }

  const authHeader = (req.headers?.['authorization'] || req.headers?.['Authorization']) as string | undefined;
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  try {
    const result = await runFlywheel();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'complete',
      generated: result.generated,
      verified: result.verified,
      topics: result.topics,
    }));
  } catch (err) {
    console.error('[flywheel] Pipeline error:', (err as Error).message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}

// ============================================================================
// Exports
// ============================================================================

export { runFlywheel };

export const flywheelRoutes: RouteDefinition[] = [
  { method: 'POST', path: '/api/flywheel/generate', handler: handleFlywheelGenerate },
];
