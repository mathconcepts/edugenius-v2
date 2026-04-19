// @ts-nocheck
/**
 * GATE Math App — AI Tutor Chat Routes
 *
 * Endpoints:
 *   POST /api/chat           — Stream a chat response (SSE)
 *   GET  /api/chat/:sessionId — Get chat history
 */

import { ServerResponse } from 'http';
import pg from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { detectTopic } from '../utils/topic-detection';
import { composeSystemContext } from '../content-pipeline/prompt-modifiers';
import type { UserContext } from '../content-pipeline/prompt-modifiers';
import type { VectorStore, VectorSearchResult } from '../data/vector-store';
import { getOrCreateStudentModel, saveStudentModel } from '../gbrain/student-model';
import { runTaskReasoner, buildContentGeneratorPrompt } from '../gbrain/task-reasoner';

const { Pool } = pg;

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

// ============================================================================
// Database
// ============================================================================

let _pool: any = null;

function getPool() {
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('[chat-routes] DATABASE_URL not configured');
  _pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000 });
  return _pool;
}

function sendJSON(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJSON(res, { error: message }, status);
}

// ============================================================================
// Content Pipeline Dependencies (injected from gate-server.ts)
// ============================================================================

let _vectorStore: VectorStore | null = null;
let _embedder: ((text: string) => Promise<number[]>) | null = null;

export function setChatVectorStore(vs: VectorStore): void { _vectorStore = vs; }
export function setChatEmbedder(fn: (text: string) => Promise<number[]>): void { _embedder = fn; }

// ============================================================================
// Gemini Chat Model
// ============================================================================

let _chatModel: any = null;

function getChatModel() {
  if (_chatModel) return _chatModel;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const genAI = new GoogleGenerativeAI(key);
  _chatModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  return _chatModel;
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are an expert GATE Engineering Mathematics tutor. Your name is GATE Math Tutor.

## Your Capabilities
- **Exam Strategy**: Help students create study plans, prioritize topics, manage time
- **Problem Solving**: Walk through problems step-by-step with clear explanations
- **Concept Explanation**: Explain mathematical concepts intuitively with examples
- **Doubt Clearing**: Answer any question about GATE math topics
- **Motivation**: Encourage students, celebrate progress, build confidence

## GATE Engineering Mathematics Topics
1. Linear Algebra (eigenvalues, matrix operations, systems of equations)
2. Calculus (limits, differentiation, integration, sequences & series)
3. Differential Equations (ODE, PDE, Laplace transforms)
4. Complex Variables (analytic functions, contour integration, residues)
5. Probability & Statistics (distributions, hypothesis testing, regression)
6. Numerical Methods (interpolation, numerical integration, root finding)
7. Transform Theory (Fourier, Laplace, Z-transforms)
8. Discrete Mathematics (logic, sets, combinatorics, recurrences)
9. Graph Theory (trees, connectivity, coloring, matching)
10. Vector Calculus (gradient, divergence, curl, line/surface integrals)

## Response Guidelines
- Use LaTeX for math: inline $...$ and display $$...$$
- Be concise but thorough — students are preparing for a competitive exam
- When solving problems, show each step clearly
- If a student seems confused, simplify and use analogies
- Always end with an encouraging note or a follow-up question
- For study plans, be specific: topic order, daily hours, practice problems count
- Reference GATE exam patterns and frequently tested concepts

## Intent Detection
- "How to prepare for X?" → Study plan with timeline
- "Solve this..." / math expression → Step-by-step solution
- "Explain X" / "What is X?" → Concept explanation with examples
- "I'm stuck on X" → Identify the gap, then explain with simpler examples
- General chat → Friendly, supportive exam prep guidance`;

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/chat — Stream a chat response via SSE
 * Body: { sessionId, message, history?: { role, content }[] }
 */
async function handleChat(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { sessionId, message, history, image, imageMimeType } = req.body as any || {};

  if (!sessionId || !message) {
    return sendError(res, 400, 'sessionId and message are required');
  }

  const model = getChatModel();
  if (!model) {
    return sendError(res, 503, 'AI tutor not available (GEMINI_API_KEY not configured)');
  }

  // Build conversation history for context
  const chatHistory = (history || []).slice(-10).map((msg: any) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  // ── Content grounding + prompt modifiers ──────────────────────────────
  let groundingContext = '';
  let studentContext = '';

  try {
    const pool = getPool();
    const detectedTopic = detectTopic(message);

    // Grounding: search verified content from PgVectorStore (in-memory, $0)
    if (_vectorStore && _embedder && detectedTopic !== 'general') {
      const embedding = await _embedder(message);
      const results = await _vectorStore.search({
        embedding,
        topK: 3,
        filter: { topic: detectedTopic },
      });
      const relevant = (results as any[]).filter((r: any) => r.score >= 0.85);
      if (relevant.length > 0) {
        groundingContext = '\n\n## Relevant Verified Content\n' +
          relevant.map((r: any) => r.content || r.document?.content || '').filter(Boolean).join('\n---\n');

        // Log to content_pipeline_log (fire-and-forget)
        const { randomUUID } = await import('crypto');
        pool.query(
          `INSERT INTO content_pipeline_log (trace_id, session_id, source, topic, tier_used, latency_ms)
           VALUES ($1, $2, 'chat_grounding', $3, 'rag_cache', 0)`,
          [randomUUID(), sessionId, detectedTopic]
        ).catch(() => {});
      }
    }

    // Prompt modifiers: compose student context from study profile + SR data
    const profileResult = await pool.query(
      `SELECT exam_date, diagnostic_scores, topic_confidence FROM study_profiles WHERE session_id = $1`,
      [sessionId]
    );
    if (profileResult.rows.length > 0) {
      const profile = profileResult.rows[0];
      const diagnosticScores = profile.diagnostic_scores || [];
      const latestDiag = diagnosticScores.length > 0 ? diagnosticScores[diagnosticScores.length - 1] : null;
      const topicScore = latestDiag?.scores?.[detectedTopic];

      // Get actual practice accuracies from SR
      const srResult = await pool.query(
        `SELECT pq.topic, AVG(CASE WHEN ss.correct_count > 0 THEN ss.correct_count::float / NULLIF(ss.attempts, 0) ELSE 0 END) as accuracy
         FROM sr_sessions ss JOIN pyq_questions pq ON ss.pyq_id = pq.id
         WHERE ss.session_id = $1 AND pq.topic IS NOT NULL GROUP BY pq.topic`,
        [sessionId]
      );
      const topicAccuracies: Record<string, number> = {};
      for (const row of srResult.rows) {
        topicAccuracies[row.topic] = parseFloat(row.accuracy) || 0;
      }

      const userCtx: UserContext = {
        sessionId,
        topic: detectedTopic !== 'general' ? detectedTopic : undefined,
        examDate: profile.exam_date,
        diagnosticScore: topicScore != null ? topicScore : undefined,
        topicAccuracies: Object.keys(topicAccuracies).length > 0 ? topicAccuracies : undefined,
      };
      studentContext = composeSystemContext(userCtx);
    }
  } catch (ctxErr) {
    console.error('[chat] Context enrichment error:', (ctxErr as Error).message);
    // Non-fatal: continue with plain system prompt
  }

  const enrichedSystemPrompt = SYSTEM_PROMPT + groundingContext + studentContext;

  // ── GBrain Layer 2: Task Reasoner ─────────────────────────────────────
  // Run the 5-node decision tree to determine pedagogical action
  let gbrainPrompt = enrichedSystemPrompt;
  try {
    const studentModel = await getOrCreateStudentModel(sessionId);
    const reasonerInstructions = await runTaskReasoner(message, studentModel, history);
    gbrainPrompt = buildContentGeneratorPrompt(reasonerInstructions, studentModel) +
      groundingContext;
    // Send reasoner metadata via SSE before streaming starts
    // (frontend can use this for UI adaptation)
    const reasonerMeta = {
      intent: reasonerInstructions.intent,
      action: reasonerInstructions.action,
      concept: reasonerInstructions.selected_concept,
      motivation: studentModel.motivation_state,
    };
    // Will be sent as first SSE event below
    var _reasonerMeta = reasonerMeta;
  } catch (gbrainErr) {
    console.error('[chat] GBrain Task Reasoner error, using fallback prompt:', (gbrainErr as Error).message);
    // Non-fatal: fall back to flat prompt
    var _reasonerMeta = null;
  }

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  try {
    // Send reasoner metadata as first SSE event (frontend can use for UI adaptation)
    if (_reasonerMeta) {
      res.write(`data: ${JSON.stringify({ type: 'reasoner', ...(_reasonerMeta) })}\n\n`);
    }

    // Start chat with history — uses GBrain layered prompt (Layer 0 + 1 + 2 instructions)
    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: 'System instructions: ' + gbrainPrompt }] },
        { role: 'model', parts: [{ text: 'Understood! I\'m GBrain, your GATE Engineering Mathematics tutor. I adapt to your learning style, diagnose your specific gaps, and help you maximize your exam score. How can I help you today?' }] },
        ...chatHistory,
      ],
    });

    // Build message parts (text + optional image)
    const messageParts: any[] = [{ text: message }];
    if (image) {
      messageParts.push({ inlineData: { mimeType: imageMimeType || 'image/jpeg', data: image } });
    }

    // Stream response
    const result = await chat.sendMessageStream(messageParts);
    let fullResponse = '';

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`);
      }
    }

    // Send done event
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);

    // Persist messages to DB
    try {
      const pool = getPool();
      await pool.query(
        'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3), ($1, $4, $5)',
        [sessionId, 'user', message, 'assistant', fullResponse]
      );
      // Auto-populate notebook from chat
      const topic = detectTopic(message + ' ' + fullResponse);
      if (topic !== 'general') {
        try {
          await pool.query(
            `INSERT INTO notebook_entries (session_id, source, topic, query_text, answer_text, status, confidence)
             VALUES ($1, 'chat', $2, $3, $4, 'to_review', 0.5)`,
            [sessionId, topic, message.slice(0, 200), fullResponse.slice(0, 500)]
          );
        } catch (nbErr) {
          console.error('[chat] Notebook persist error:', (nbErr as Error).message);
        }
      }
    } catch (dbErr) {
      console.error('[chat] DB persist error:', (dbErr as Error).message);
    }

  } catch (err) {
    console.error('[chat] Stream error:', (err as Error).message);
    res.write(`data: ${JSON.stringify({ type: 'error', content: 'Sorry, I encountered an error. Please try again.' })}\n\n`);
  }

  res.end();
}

/**
 * GET /api/chat/:sessionId — Get chat history
 */
async function handleGetHistory(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { sessionId } = req.params;

  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, role, content, metadata, created_at FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC LIMIT 100',
      [sessionId]
    );
    sendJSON(res, { messages: result.rows });
  } catch (err) {
    console.error('[chat] History error:', (err as Error).message);
    sendError(res, 500, 'Failed to load chat history');
  }
}

// ============================================================================
// Export
// ============================================================================

export const chatRoutes: RouteDefinition[] = [
  { method: 'POST', path: '/api/chat', handler: handleChat },
  { method: 'GET', path: '/api/chat/:sessionId', handler: handleGetHistory },
];
