// @ts-nocheck
/**
 * Gemini Proxy Routes — Stateless.
 *
 * Pure LLM/vision/embedding relay. No database. No persistence.
 * Client is responsible for passing context and storing results.
 *
 * Endpoints:
 *   POST /api/gemini/classify-error   — classify a wrong answer
 *   POST /api/gemini/generate-problem — generate + verify a problem
 *   POST /api/gemini/embed            — get an embedding (server-side Gemini)
 *   POST /api/gemini/vision-ocr       — OCR an image (handwritten notes/work)
 *   POST /api/gemini/chat             — SSE chat with reasoner + grounding
 *
 * Replaces: /api/gbrain/attempt (when caller is DB-less)
 */

import { ServerResponse } from 'http';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ParsedRequest {
  pathname: string;
  query: URLSearchParams;
  params: Record<string, string>;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}

type RouteHandler = (req: ParsedRequest, res: ServerResponse) => Promise<void>;

function sendJSON(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, status: number, message: string) {
  sendJSON(res, { error: message }, status);
}

function getGenAI(): GoogleGenerativeAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

// ============================================================================
// POST /api/gemini/classify-error
// ============================================================================

async function handleClassifyError(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = req.body as any;
  const { problem, studentAnswer, correctAnswer, timeTakenMs } = body || {};
  if (!problem || !studentAnswer || !correctAnswer) return sendError(res, 400, 'problem, studentAnswer, correctAnswer required');

  const genAI = getGenAI();
  if (!genAI) {
    return sendJSON(res, {
      error_type: 'conceptual',
      concept_id: 'unknown',
      misconception_id: 'unclassified',
      diagnosis: 'Classification service unavailable.',
      why_tempting: '',
      why_wrong: '',
      corrective_hint: 'Review the topic and try again.',
    });
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const prompt = `You are an expert math error diagnostician.
Classify this error. Respond ONLY with JSON (no markdown):
{
  "error_type": "conceptual|procedural|notation|misread|time_pressure|arithmetic|overconfidence_skip",
  "concept_id": "kebab-case-concept",
  "misconception_id": "brief-kebab-misconception-name",
  "diagnosis": "One sentence",
  "why_tempting": "One sentence",
  "why_wrong": "One sentence",
  "corrective_hint": "One sentence"
}

Problem: ${problem}
Student's answer: ${studentAnswer}
Correct answer: ${correctAnswer}
${timeTakenMs ? `Time: ${Math.round(timeTakenMs / 1000)}s` : ''}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);
    sendJSON(res, parsed);
  } catch (err) {
    sendError(res, 500, `Classification failed: ${(err as Error).message}`);
  }
}

// ============================================================================
// POST /api/gemini/generate-problem
// ============================================================================

async function handleGenerateProblem(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = req.body as any;
  const { conceptId, conceptLabel, conceptDescription, difficulty, targetErrorType, format } = body || {};
  if (!conceptId) return sendError(res, 400, 'conceptId required');

  const genAI = getGenAI();
  if (!genAI) return sendError(res, 503, 'Gemini not configured');

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const diffLabel = difficulty < 0.33 ? 'easy' : difficulty < 0.66 ? 'medium' : 'hard';

  const prompt = `Generate a ${diffLabel} difficulty ${format === 'mcq' ? 'multiple choice' : 'numerical answer'} GATE math problem.

Topic: ${conceptLabel || conceptId}
Description: ${conceptDescription || ''}
Difficulty: ${diffLabel} (${Math.round((difficulty || 0.5) * 100)}%)
${targetErrorType ? `Target error type: "${targetErrorType}" — design so a student making this error gets a specific wrong answer.` : ''}

Respond ONLY with JSON (no markdown):
{
  "question_text": "The problem in LaTeX",
  "correct_answer": "The exact answer",
  "solution_steps": ["Step 1", "Step 2"],
  "distractors": ["wrong 1", "wrong 2", "wrong 3"]
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Self-verify
    const verifyPrompt = `Solve independently. End with: ANSWER: <final>

Problem: ${parsed.question_text}`;
    const verifyRes = await model.generateContent(verifyPrompt);
    const verifyText = verifyRes.response.text();
    const match = verifyText.match(/ANSWER:\s*(.+)/i);
    const verifiedAnswer = match ? match[1].trim() : '';

    const normalize = (s: string) => (s || '').replace(/\s+/g, '').replace(/\$/g, '').toLowerCase();
    const expected = parsed.correct_answer.trim();
    const numE = parseFloat(expected), numA = parseFloat(verifiedAnswer);
    const verified = expected === verifiedAnswer
      || normalize(expected) === normalize(verifiedAnswer)
      || (!isNaN(numE) && !isNaN(numA) && Math.abs(numE - numA) < 0.001);

    sendJSON(res, { ...parsed, verified, verification_answer: verifiedAnswer });
  } catch (err) {
    sendError(res, 500, `Generation failed: ${(err as Error).message}`);
  }
}

// ============================================================================
// POST /api/gemini/embed
// ============================================================================

async function handleEmbed(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = req.body as any;
  const { text } = body || {};
  if (!text || typeof text !== 'string') return sendError(res, 400, 'text required');

  const genAI = getGenAI();
  if (!genAI) return sendError(res, 503, 'Gemini not configured');

  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  try {
    const result = await model.embedContent(text);
    sendJSON(res, { embedding: result.embedding.values, dim: result.embedding.values.length });
  } catch (err) {
    sendError(res, 500, `Embedding failed: ${(err as Error).message}`);
  }
}

// ============================================================================
// POST /api/gemini/vision-ocr
// ============================================================================

async function handleVisionOCR(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = req.body as any;
  const { image, mimeType } = body || {};
  if (!image) return sendError(res, 400, 'image (base64) required');

  const genAI = getGenAI();
  if (!genAI) return sendError(res, 503, 'Gemini not configured');

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = `Extract ALL text visible in this image, preserving mathematical notation in LaTeX.
If the image shows handwritten work, transcribe it exactly. If a math problem, include the full problem.
Respond with ONLY the extracted text, no commentary.`;

  try {
    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType: mimeType || 'image/jpeg', data: image } },
    ]);
    const text = result.response.text().trim();
    sendJSON(res, { text, character_count: text.length });
  } catch (err) {
    sendError(res, 500, `OCR failed: ${(err as Error).message}`);
  }
}

// ============================================================================
// POST /api/gemini/chat — SSE stream
// ============================================================================

async function handleGeminiChat(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = req.body as any;
  const { message, history, systemPrompt, groundingChunks, image, imageMimeType } = body || {};
  if (!message) return sendError(res, 400, 'message required');

  const genAI = getGenAI();
  if (!genAI) return sendError(res, 503, 'Gemini not configured');

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Build system prompt with optional grounding
  const groundingText = (groundingChunks || []).length > 0
    ? `\n\n## Student's Uploaded Materials\n${(groundingChunks as string[]).join('\n---\n')}`
    : '';

  const fullSystem = (systemPrompt || 'You are a GATE Engineering Mathematics tutor.') + groundingText;

  const chatHistory = (history || []).slice(-10).map((m: any) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  try {
    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: 'System: ' + fullSystem }] },
        { role: 'model', parts: [{ text: 'Understood.' }] },
        ...chatHistory,
      ],
    });

    const parts: any[] = [{ text: message }];
    if (image) parts.push({ inlineData: { mimeType: imageMimeType || 'image/jpeg', data: image } });

    const result = await chat.sendMessageStream(parts);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) res.write(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: (err as Error).message })}\n\n`);
    res.end();
  }
}

// ============================================================================
// Export routes
// ============================================================================

export const geminiProxyRoutes: Array<{ method: string; path: string; handler: RouteHandler }> = [
  { method: 'POST', path: '/api/gemini/classify-error', handler: handleClassifyError },
  { method: 'POST', path: '/api/gemini/generate-problem', handler: handleGenerateProblem },
  { method: 'POST', path: '/api/gemini/embed', handler: handleEmbed },
  { method: 'POST', path: '/api/gemini/vision-ocr', handler: handleVisionOCR },
  { method: 'POST', path: '/api/gemini/chat', handler: handleGeminiChat },
];
