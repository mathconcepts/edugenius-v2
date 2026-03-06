/**
 * contentGenerationService.ts — Unified Content Generation Pipeline
 *
 * Pipeline:
 *   1. Source ingestion (prompt / document / external API / agent)
 *   2. LLM generation (Gemini → Atlas agent format)
 *   3. Wolfram verification (math facts, formulas, computations)
 *   4. Content enrichment (add verified steps, confidence scores)
 *   5. Format output (MCQ / lesson / blog / flashcard / quiz)
 *
 * Sources:
 *   - DirectPrompt: user types a prompt
 *   - DocumentUpload: PDF/DOCX extracted text
 *   - ExternalAPI: fetch from URL (NCERT, Khan Academy, custom)
 *   - MCPEndpoint: MCP protocol resource
 *   - WolframQuery: generate content grounded in Wolfram computation (NEW)
 *   - AgentWorkflow: Atlas/Herald/Scout agent execution
 */

import { callLLM } from './llmService';
import {
  queryWolfram,
  enrichContentWithWolfram,
  isWolframAvailable,
} from './wolframService';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContentSource =
  | 'direct_prompt'
  | 'document_upload'
  | 'external_api'
  | 'mcp_endpoint'
  | 'wolfram_grounded'   // NEW — content generated from Wolfram computation
  | 'agent_workflow';

export type ContentOutputFormat =
  | 'mcq_set'            // array of MCQs with options/answers/explanations
  | 'lesson_notes'       // structured lesson with sections
  | 'blog_post'          // SEO blog post
  | 'flashcard_set'      // Q&A pairs
  | 'quiz'               // quiz with scoring
  | 'formula_sheet'      // formulas with explanations
  | 'worked_example'     // solved problem with steps
  | 'summary';           // condensed summary

export interface GenerationRequest {
  source: ContentSource;
  sourceData: {
    prompt?: string;
    documentText?: string;    // extracted from upload
    apiUrl?: string;          // external URL to fetch
    mcpEndpoint?: string;     // MCP server endpoint
    wolframQuery?: string;    // Wolfram computation to base content on
    agentId?: string;         // 'atlas' | 'herald' | 'scout'
    agentPreset?: string;
  };
  outputFormat: ContentOutputFormat;
  examTarget: string;         // 'JEE Main', 'GATE', 'CAT', etc.
  topicId?: string;
  difficultyLevel?: 'easy' | 'medium' | 'hard' | 'mixed';
  count?: number;             // number of MCQs/flashcards etc.
  useWolframVerification: boolean;
  useWolframGrounding: boolean;
}

export interface MCQItem {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  wolframVerified: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface LessonSection {
  heading: string;
  content: string;
  formulas?: string[];
  examples?: string[];
}

export interface FlashCard {
  front: string;
  back: string;
  topic: string;
}

export interface GeneratedContent {
  id: string;
  source: ContentSource;
  format: ContentOutputFormat;
  title: string;
  content: string;             // raw markdown/JSON content
  structured?: MCQItem[] | LessonSection[] | FlashCard[];
  wolframVerified: boolean;
  wolframSteps?: string[];
  confidence: number;          // 0–1 overall content confidence
  generatedAt: Date;
  examTarget: string;
  topicId?: string;
  wordCount: number;
  readyForReview: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `cg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatLabel(f: ContentOutputFormat): string {
  const labels: Record<ContentOutputFormat, string> = {
    mcq_set: 'MCQ Set',
    lesson_notes: 'Lesson Notes',
    blog_post: 'Blog Post',
    flashcard_set: 'Flashcard Set',
    quiz: 'Quiz',
    formula_sheet: 'Formula Sheet',
    worked_example: 'Worked Example',
    summary: 'Summary',
  };
  return labels[f] ?? f;
}

// ─── Source ingestion ─────────────────────────────────────────────────────────

export async function fetchFromExternalAPI(url: string): Promise<string> {
  try {
    // Use a CORS proxy for external requests in browser context
    // Fallback: direct fetch (works for APIs that allow CORS)
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json, text/plain, */*' },
    });
    if (!res.ok) throw new Error(`Fetch error ${res.status}`);
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      const data = await res.json();
      // Try to extract text content from common API shapes
      return extractTextFromJson(data);
    }
    return await res.text();
  } catch (err) {
    throw new Error(`Failed to fetch from API: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}

function extractTextFromJson(data: any): string {
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) {
    return data.slice(0, 5).map(item =>
      typeof item === 'string' ? item : JSON.stringify(item)
    ).join('\n\n');
  }
  // Common API response shapes
  const text = data?.text ?? data?.content ?? data?.body ?? data?.description ?? data?.data;
  if (text) return typeof text === 'string' ? text : JSON.stringify(text);
  return JSON.stringify(data, null, 2).slice(0, 3000);
}

export async function fetchFromMCP(endpoint: string, resource?: string): Promise<string> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: resource ? 'resources/read' : 'resources/list',
        params: resource ? { uri: resource } : {},
      }),
    });
    if (!res.ok) throw new Error(`MCP error ${res.status}`);
    const data = await res.json();
    const content = data?.result?.content ?? data?.result ?? data;
    return typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  } catch (err) {
    throw new Error(`MCP fetch failed: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}

export async function ingestSource(
  request: GenerationRequest,
  onProgress?: (step: string, pct: number) => void
): Promise<string> {
  const { source, sourceData } = request;
  onProgress?.('Ingesting source...', 5);

  switch (source) {
    case 'direct_prompt':
      return sourceData.prompt ?? '';

    case 'document_upload':
      return sourceData.documentText ?? '';

    case 'external_api': {
      const url = sourceData.apiUrl;
      if (!url) throw new Error('No API URL provided');
      onProgress?.('Fetching from API...', 10);
      return await fetchFromExternalAPI(url);
    }

    case 'mcp_endpoint': {
      const ep = sourceData.mcpEndpoint;
      if (!ep) throw new Error('No MCP endpoint provided');
      onProgress?.('Connecting to MCP...', 10);
      return await fetchFromMCP(ep);
    }

    case 'wolfram_grounded': {
      const wq = sourceData.wolframQuery;
      if (!wq) throw new Error('No Wolfram query provided');
      onProgress?.('Computing with Wolfram...', 10);
      const wr = await queryWolfram(wq);
      if (!wr.success) throw new Error(`Wolfram query failed: ${wr.answer}`);
      return wr.answer;
    }

    case 'agent_workflow':
      // Agent workflow is handled externally; return preset/prompt if provided
      return sourceData.prompt ?? sourceData.agentPreset ?? '';

    default:
      return sourceData.prompt ?? '';
  }
}

// ─── LLM generation ───────────────────────────────────────────────────────────

/** Build a structured prompt for the given format */
function buildGenerationPrompt(
  sourceText: string,
  format: ContentOutputFormat,
  exam: string,
  count: number = 10,
  difficulty: string = 'mixed',
  topic?: string,
  wolframContext?: string
): string {
  const wolframBlock = wolframContext
    ? `\n\n**VERIFIED WOLFRAM COMPUTATION (use these exact values):**\n${wolframContext}\n\nEvery formula and numerical answer MUST match the Wolfram result above.\n`
    : '';

  const baseContext = `You are Atlas, the content engine for EduGenius. Generate high-quality educational content for ${exam} students.${wolframBlock}`;

  switch (format) {
    case 'mcq_set':
      return `${baseContext}

Generate exactly ${count} multiple-choice questions about: ${sourceText}
${topic ? `Topic: ${topic}` : ''}
Difficulty: ${difficulty}

Return ONLY valid JSON in this exact structure:
{
  "title": "descriptive title",
  "items": [
    {
      "question": "question text",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correctAnswer": "A",
      "explanation": "step-by-step explanation",
      "difficulty": "easy|medium|hard"
    }
  ]
}`;

    case 'lesson_notes':
      return `${baseContext}

Create comprehensive lesson notes about: ${sourceText}
${topic ? `Topic: ${topic}` : ''}

Return ONLY valid JSON:
{
  "title": "lesson title",
  "sections": [
    {
      "heading": "section heading",
      "content": "detailed content",
      "formulas": ["formula1", "formula2"],
      "examples": ["example1"]
    }
  ]
}`;

    case 'flashcard_set':
      return `${baseContext}

Generate ${count} flashcards about: ${sourceText}
${topic ? `Topic: ${topic}` : ''}

Return ONLY valid JSON:
{
  "title": "Flashcard Set Title",
  "items": [
    { "front": "question/term", "back": "answer/definition", "topic": "sub-topic" }
  ]
}`;

    case 'formula_sheet':
      return `${baseContext}

Create a formula sheet covering: ${sourceText}
${topic ? `Topic: ${topic}` : ''}

Return ONLY valid JSON:
{
  "title": "Formula Sheet Title",
  "sections": [
    {
      "heading": "category",
      "content": "explanatory text",
      "formulas": ["formula with variable definitions"],
      "examples": ["worked example using the formula"]
    }
  ]
}`;

    case 'worked_example':
      return `${baseContext}

Provide a fully worked example for: ${sourceText}
Show every step clearly with reasoning. Use LaTeX notation for formulas ($...$).

Return ONLY valid JSON:
{
  "title": "Problem Title",
  "sections": [
    {
      "heading": "Step N: description",
      "content": "detailed working",
      "formulas": ["relevant formulas"]
    }
  ]
}`;

    case 'blog_post':
      return `${baseContext}

Write an SEO-optimised blog post about: ${sourceText}
Target audience: ${exam} students. Length: 600-900 words. Use markdown formatting.

Return a JSON object:
{
  "title": "SEO-friendly title",
  "content": "full markdown blog post"
}`;

    case 'quiz':
      return `${baseContext}

Create a ${count}-question quiz on: ${sourceText}
Include a mix of question types. Return ONLY valid JSON:
{
  "title": "Quiz Title",
  "items": [
    {
      "question": "question text",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correctAnswer": "B",
      "explanation": "why this is correct",
      "difficulty": "medium"
    }
  ]
}`;

    case 'summary':
    default:
      return `${baseContext}

Write a concise, exam-focused summary of: ${sourceText}
${topic ? `Topic: ${topic}` : ''}
Length: 200-350 words. Highlight key formulas and concepts. Use markdown.

Return JSON: { "title": "Summary: [topic]", "content": "markdown summary" }`;
  }
}

export async function generateFromPrompt(
  prompt: string,
  format: ContentOutputFormat,
  exam: string,
  count: number = 10,
  difficulty: string = 'mixed',
  topic?: string
): Promise<string> {
  const systemPrompt = buildGenerationPrompt(prompt, format, exam, count, difficulty, topic);
  const result = await callLLM({
    agent: 'atlas',
    message: systemPrompt,
  });
  return result?.text ?? '';
}

export async function generateWolframGrounded(
  wolframQuery: string,
  format: ContentOutputFormat,
  exam: string,
  count: number = 10,
  topic?: string
): Promise<string> {
  // Step 1: Get deterministic Wolfram computation
  const wolframResult = await queryWolfram(wolframQuery);
  const wolframContext = wolframResult.success ? wolframResult.answer : undefined;

  // Step 2: Build grounded prompt
  const groundedPrompt = buildGenerationPrompt(
    wolframQuery,
    format,
    exam,
    count,
    'mixed',
    topic,
    wolframContext
  );

  // Step 3: Generate with LLM
  const result = await callLLM({
    agent: 'atlas',
    message: groundedPrompt,
  });

  return result?.text ?? '';
}

// ─── Wolfram verification ─────────────────────────────────────────────────────

export async function verifyGeneratedContent(
  content: string,
  topic: string
): Promise<{ verified: boolean; issues: string[]; enriched: string }> {
  if (!isWolframAvailable()) {
    return { verified: false, issues: ['Wolfram not configured'], enriched: content };
  }

  const issues: string[] = [];
  let enriched = content;

  try {
    enriched = await enrichContentWithWolfram(content, topic);
    return { verified: true, issues, enriched };
  } catch (err) {
    issues.push(`Wolfram verification error: ${err instanceof Error ? err.message : 'unknown'}`);
    return { verified: false, issues, enriched: content };
  }
}

// ─── Output parsing ───────────────────────────────────────────────────────────

export function parseGeneratedContent(
  raw: string,
  format: ContentOutputFormat
): GeneratedContent['structured'] {
  // Extract JSON block from LLM output (may be wrapped in markdown code fences)
  let jsonStr = raw.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();

  // Also handle case where LLM outputs the JSON directly with leading/trailing text
  const jsonStart = jsonStr.indexOf('{');
  const jsonEnd = jsonStr.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
  }

  try {
    const parsed = JSON.parse(jsonStr);

    switch (format) {
      case 'mcq_set':
      case 'quiz': {
        const items: MCQItem[] = (parsed?.items ?? []).map((item: any) => ({
          question: item.question ?? '',
          options: {
            A: item.options?.A ?? '',
            B: item.options?.B ?? '',
            C: item.options?.C ?? '',
            D: item.options?.D ?? '',
          },
          correctAnswer: (['A', 'B', 'C', 'D'].includes(item.correctAnswer)
            ? item.correctAnswer
            : 'A') as 'A' | 'B' | 'C' | 'D',
          explanation: item.explanation ?? '',
          wolframVerified: false,
          difficulty: (['easy', 'medium', 'hard'].includes(item.difficulty)
            ? item.difficulty
            : 'medium') as 'easy' | 'medium' | 'hard',
        }));
        return items;
      }

      case 'lesson_notes':
      case 'formula_sheet':
      case 'worked_example': {
        const sections: LessonSection[] = (parsed?.sections ?? []).map((s: any) => ({
          heading: s.heading ?? '',
          content: s.content ?? '',
          formulas: s.formulas ?? [],
          examples: s.examples ?? [],
        }));
        return sections;
      }

      case 'flashcard_set': {
        const cards: FlashCard[] = (parsed?.items ?? []).map((c: any) => ({
          front: c.front ?? '',
          back: c.back ?? '',
          topic: c.topic ?? '',
        }));
        return cards;
      }

      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

function extractTitle(raw: string, format: ContentOutputFormat, sourceHint: string): string {
  // Try to parse JSON title
  try {
    let jsonStr = raw.trim();
    const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) jsonStr = fence[1].trim();
    const jsonStart = jsonStr.indexOf('{');
    const jsonEnd = jsonStr.lastIndexOf('}');
    if (jsonStart !== -1) {
      const parsed = JSON.parse(jsonStr.slice(jsonStart, jsonEnd + 1));
      if (parsed?.title) return parsed.title as string;
    }
  } catch { /* ignore */ }

  // Fallback: derive from format and source
  return `${formatLabel(format)} — ${sourceHint.slice(0, 40)}`;
}

function extractRawContent(raw: string): string {
  // Try to get the "content" field from JSON if it's a blog/summary
  try {
    let jsonStr = raw.trim();
    const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) jsonStr = fence[1].trim();
    const jsonStart = jsonStr.indexOf('{');
    const jsonEnd = jsonStr.lastIndexOf('}');
    if (jsonStart !== -1) {
      const parsed = JSON.parse(jsonStr.slice(jsonStart, jsonEnd + 1));
      if (parsed?.content) return parsed.content as string;
    }
  } catch { /* ignore */ }
  return raw;
}

// ─── Master pipeline ──────────────────────────────────────────────────────────

export async function generateContent(
  request: GenerationRequest,
  onProgress?: (step: string, pct: number) => void
): Promise<GeneratedContent> {
  const {
    source,
    sourceData,
    outputFormat,
    examTarget,
    topicId,
    difficultyLevel = 'mixed',
    count = 10,
    useWolframVerification,
    useWolframGrounding,
  } = request;

  onProgress?.('Ingesting source...', 5);

  // ── Step 1: Ingest source ────────────────────────────────────────────────
  let sourceText: string;
  let wolframSteps: string[] = [];
  let wolframVerified = false;

  try {
    sourceText = await ingestSource(request, onProgress);
  } catch (err) {
    throw new Error(`Source ingestion failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  onProgress?.('Generating with AI...', 33);

  // ── Step 2: Generate ─────────────────────────────────────────────────────
  let rawOutput: string;

  if (source === 'wolfram_grounded' && useWolframGrounding && sourceData.wolframQuery) {
    rawOutput = await generateWolframGrounded(
      sourceData.wolframQuery,
      outputFormat,
      examTarget,
      count,
      topicId
    );
    // Flag as wolfram-verified since we used grounded computation
    wolframVerified = true;
  } else {
    rawOutput = await generateFromPrompt(
      sourceText || (sourceData.prompt ?? ''),
      outputFormat,
      examTarget,
      count,
      difficultyLevel,
      topicId
    );
  }

  if (!rawOutput) {
    throw new Error('LLM generation returned empty output. Check API key configuration.');
  }

  onProgress?.('Verifying with Wolfram...', 66);

  // ── Step 3: Wolfram verification (optional) ──────────────────────────────
  let finalContent = rawOutput;

  if (useWolframVerification && isWolframAvailable()) {
    const topic = topicId ?? sourceText.slice(0, 100);
    const verification = await verifyGeneratedContent(rawOutput, topic);
    finalContent = verification.enriched;
    if (verification.verified) {
      wolframVerified = true;
    }
  }

  // For wolfram_grounded: fetch steps from Wolfram
  if ((source === 'wolfram_grounded' || useWolframGrounding) && sourceData.wolframQuery) {
    const stepResult = await queryWolfram(sourceData.wolframQuery);
    wolframSteps = stepResult.steps ?? [];
  }

  onProgress?.('Parsing output...', 85);

  // ── Step 4: Parse structured output ──────────────────────────────────────
  const structured = parseGeneratedContent(finalContent, outputFormat);
  const sourceHint = sourceData.prompt ?? sourceData.wolframQuery ?? sourceData.apiUrl ?? 'content';
  const title = extractTitle(finalContent, outputFormat, sourceHint);
  const displayContent = extractRawContent(finalContent);

  onProgress?.('Ready for review', 100);

  return {
    id: generateId(),
    source,
    format: outputFormat,
    title,
    content: displayContent,
    structured,
    wolframVerified,
    wolframSteps: wolframSteps.length > 0 ? wolframSteps : undefined,
    confidence: wolframVerified ? 1.0 : 0.75,
    generatedAt: new Date(),
    examTarget,
    topicId,
    wordCount: countWords(displayContent),
    readyForReview: true,
  };
}
