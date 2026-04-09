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
import { GATE_TOPICS } from '../constants/topics';
import { BLOG_CONTENT_TYPES } from '../constants/content-types';

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

// GATE_TOPICS imported from ../constants/topics

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

    // Try priority-based selection first (from content-prioritizer)
    const { rows: priorities } = await pool.query(
      `SELECT topic, priority_score FROM content_priorities
       WHERE created_at > NOW() - INTERVAL '2 days'
       ORDER BY priority_score DESC LIMIT 5`
    );

    if (priorities.length > 0) {
      // Weighted random from top 5 priorities
      const totalWeight = priorities.reduce((s, r) => s + parseFloat(r.priority_score), 0);
      let roll = Math.random() * totalWeight;
      for (const r of priorities) {
        roll -= parseFloat(r.priority_score);
        if (roll <= 0) {
          console.log(`[flywheel] Topic selected via priorities: ${r.topic} (score=${parseFloat(r.priority_score).toFixed(3)})`);
          return r.topic;
        }
      }
      return priorities[0].topic;
    }

    // Fallback: inverse-count logic (original behavior)
    const result = await pool.query(`
      SELECT topic, COUNT(*) as count
      FROM pyq_questions
      GROUP BY topic
    `);
    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.topic] = parseInt(row.count, 10);
    }

    const maxCount = Math.max(...Object.values(counts), 1);
    const weighted = GATE_TOPICS.map(t => ({
      topic: t,
      weight: maxCount - (counts[t] || 0) + 1,
    }));
    const totalW = weighted.reduce((s, w) => s + w.weight, 0);
    let roll2 = Math.random() * totalW;
    for (const w of weighted) {
      roll2 -= w.weight;
      if (roll2 <= 0) return w.topic;
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

    // Generate social media content (fire-and-forget, non-blocking)
    generateSocialContent(problem, pyqId).catch(err =>
      console.warn('[flywheel] Social content generation failed (non-fatal):', (err as Error).message)
    );

    // Generate blog post (fire-and-forget, non-blocking)
    generateBlogPost(problem, pyqId).catch(err =>
      console.warn('[flywheel] Blog post generation failed (non-fatal):', (err as Error).message)
    );

    console.log(`[flywheel] Published: ${problem.topic} (${problem.difficulty}) via ${result.tierUsed}, pyq_id=${pyqId}`);
    return { verified: true, tier: result.tierUsed };
  } catch (err) {
    console.error('[flywheel] Verify/publish error:', (err as Error).message);
    return { verified: false };
  }
}

/**
 * Generate social media content for Twitter, Instagram, and LinkedIn.
 */
async function generateSocialContent(problem: GeneratedProblem, pyqId: string): Promise<void> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return;

  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const topicLabel = problem.topic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const appUrl = process.env.APP_URL || 'https://gate-math-api.onrender.com';

  const prompt = `Generate social media content for this GATE Engineering Mathematics problem.

Topic: ${topicLabel}
Difficulty: ${problem.difficulty}
Question: ${problem.question_text}
Options: ${JSON.stringify(problem.options)}
Answer: ${problem.correct_answer}
Explanation: ${problem.explanation}

Generate content for all 3 platforms in this exact JSON format:
{
  "twitter": "A thread-style post. Start with a hook question, then the problem (abbreviated), then 'Reply with your answer! Full solution: ${appUrl}'. Use relevant hashtags: #GATE2027 #EngineeringMath #${problem.topic.replace(/-/g, '')}. Max 280 chars per tweet, format as a single post.",
  "instagram": "A carousel-style caption. Hook → Problem → Key insight → CTA to practice more. Use emojis. Include hashtags. Max 500 chars.",
  "linkedin": "A professional post about this math concept. Start with an observation about GATE exam patterns, present the problem as a challenge, share a key insight from the solution, CTA to practice. Professional tone. Max 600 chars."
}

Return ONLY valid JSON, no markdown.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const content = JSON.parse(jsonMatch[0]);
    const pool = getPool();

    const platforms = ['twitter', 'instagram', 'linkedin'] as const;
    for (const platform of platforms) {
      if (content[platform]) {
        await pool.query(
          `INSERT INTO social_content (pyq_id, platform, content, status)
           VALUES ($1, $2, $3, 'pending')
           ON CONFLICT DO NOTHING`,
          [pyqId, platform, content[platform]]
        );
      }
    }
    console.log(`[flywheel] Social content generated for ${platforms.length} platforms`);
  } catch (err) {
    console.warn('[flywheel] Social content LLM error:', (err as Error).message);
  }
}

/**
 * Generate a blog post from a verified problem.
 * Rotates through 4 content types: solved_problem, topic_explainer, exam_strategy, comparison.
 */
// BLOG_CONTENT_TYPES imported from ../constants/content-types
let _blogTypeIndex = 0;

async function generateBlogPost(problem: GeneratedProblem, pyqId: string): Promise<void> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return;

  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const topicLabel = problem.topic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const contentType = BLOG_CONTENT_TYPES[_blogTypeIndex % BLOG_CONTENT_TYPES.length];
  _blogTypeIndex++;

  const prompts: Record<string, string> = {
    solved_problem: `Write a blog post titled "GATE ${topicLabel} — Solved Problem with Detailed Solution".

Problem: ${problem.question_text}
Options: ${JSON.stringify(problem.options)}
Correct Answer: ${problem.correct_answer}
Explanation: ${problem.explanation}

Structure:
1. Brief introduction to the topic (2-3 sentences)
2. The full problem statement
3. Step-by-step solution approach
4. Key concept explanation
5. Common mistakes to avoid
6. Practice tip

~600 words. Educational, clear, useful for GATE aspirants.`,

    topic_explainer: `Write a blog post titled "${topicLabel} for GATE Engineering Mathematics — Complete Guide".

Use this problem as a teaching example:
${problem.question_text}
Answer: ${problem.correct_answer}
Explanation: ${problem.explanation}

Structure:
1. What is ${topicLabel} and why it matters for GATE
2. Key concepts and formulas
3. Worked example (the problem above)
4. Common GATE question patterns
5. Study strategy for this topic

~600 words. Educational, comprehensive, focused on GATE exam patterns.`,

    exam_strategy: `Write a blog post titled "How to Master ${topicLabel} in GATE Engineering Mathematics".

Context: ${topicLabel} appears in GATE every year, worth 10-15 marks.

Structure:
1. GATE weightage and importance of ${topicLabel}
2. Topic breakdown (subtopics to cover)
3. Time management tips for ${topicLabel} questions
4. Recommended preparation order
5. Common pitfalls and how to avoid them
6. Quick revision checklist

~600 words. Strategic, actionable, confident tone.`,

    comparison: `Write a blog post titled "GATE vs JEE Mathematics: How ${topicLabel} Differs".

Structure:
1. Brief overview of ${topicLabel} in both exams
2. Key differences in question style and difficulty
3. What GATE emphasizes vs what JEE emphasizes
4. How JEE preparation helps (or doesn't) for GATE
5. Specific topics to focus on for GATE
6. Transition strategy for JEE students preparing for GATE

~600 words. Analytical, helpful for students transitioning from JEE to GATE prep.`,
  };

  // Fetch trend context for this topic (enriches the prompt)
  let trendContext = '';
  try {
    const trendResult = await pool.query(
      `SELECT title, source, score FROM trend_signals
       WHERE topic_match = $1 AND collected_at > NOW() - INTERVAL '7 days'
       ORDER BY score DESC LIMIT 3`, [problem.topic]
    );
    if (trendResult.rows.length > 0) {
      trendContext = `\n\nCurrently trending in ${topicLabel}: ${trendResult.rows.map(r => `"${r.title}" (${r.source})`).join(', ')}. Weave these trends into the content naturally where relevant.`;
    }
  } catch {
    // Non-fatal: proceed without trend context
  }

  // App feature CTAs per content type
  const APP_FEATURE_CTAS: Record<string, { text: string; url: string; context: string }> = {
    solved_problem: { text: 'Solve similar problems', url: `/practice/${problem.topic}`, context: 'Include a section suggesting readers practice similar problems in the app.' },
    topic_explainer: { text: 'Get your personalized study plan', url: '/onboard', context: 'Include a section about how Study Commander can create a personalized plan for this topic.' },
    exam_strategy: { text: 'Take the diagnostic test', url: '/diagnostic', context: 'Include a section about taking a diagnostic test to identify weak areas.' },
    comparison: { text: 'Chat with AI tutor', url: '/chat', context: 'Include a section about asking the AI tutor for help with concept differences.' },
  };
  const ctaInfo = APP_FEATURE_CTAS[contentType] || APP_FEATURE_CTAS.solved_problem;

  const blogPrompt = `${prompts[contentType]}${trendContext}

${ctaInfo.context}

Return the blog post as a JSON array of sections. Each section has:
- type: "heading" | "paragraph" | "bullets" | "callout"
- content: the text content
- level: 1|2|3 (for headings only)
- items: string[] (for bullets only)
- calloutType: "tip"|"info"|"warning" (for callouts only)

Also return title, excerpt (1-2 sentences), and keywords (5-8 SEO keywords).

Return ONLY valid JSON in this format:
{
  "title": "...",
  "excerpt": "...",
  "keywords": ["keyword1", "keyword2"],
  "sections": [{"type":"heading","level":1,"content":"..."},{"type":"paragraph","content":"..."}]
}`;

  try {
    const result = await model.generateContent(blogPrompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[flywheel] Blog generation: no JSON found in response');
      return;
    }

    const blog = JSON.parse(jsonMatch[0]);
    if (!blog.title || !blog.sections || !Array.isArray(blog.sections)) {
      console.warn('[flywheel] Blog generation: missing title or sections');
      return;
    }

    const pool = getPool();
    const slugBase = contentType === 'solved_problem'
      ? `gate-${problem.topic}-solved-${pyqId.slice(0, 8)}`
      : contentType === 'topic_explainer'
        ? `gate-${problem.topic}-guide`
        : contentType === 'exam_strategy'
          ? `gate-${problem.topic}-strategy`
          : `gate-vs-jee-${problem.topic}`;

    // Add app feature CTA section
    blog.sections.push({
      type: 'cta',
      ctaText: ctaInfo.text,
      ctaUrl: ctaInfo.url,
      content: ctaInfo.text,
    });

    // Add disclaimer section at the end
    blog.sections.push({
      type: 'callout',
      calloutType: 'info',
      content: 'Explanations in this article are AI-generated. Problems and solutions are verified through our 3-tier verification system (RAG cache, dual LLM solve, Wolfram Alpha).',
    });

    await pool.query(
      `INSERT INTO blog_posts
       (slug, title, excerpt, content_type, sections, seo_meta, topic, exam_tags, pyq_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft')
       ON CONFLICT (slug) DO NOTHING`,
      [
        slugBase,
        blog.title,
        blog.excerpt || '',
        contentType,
        JSON.stringify(blog.sections),
        JSON.stringify({ title: blog.title, description: blog.excerpt, keywords: blog.keywords || [] }),
        problem.topic,
        ['GATE'],
        contentType === 'solved_problem' || contentType === 'topic_explainer' ? pyqId : null,
      ]
    );

    console.log(`[flywheel] Blog post generated: "${blog.title}" (${contentType})`);
  } catch (err) {
    console.warn('[flywheel] Blog generation error:', (err as Error).message);
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
