/**
 * personaBatchService.ts — Persona-Driven Batch Content Generation
 *
 * Takes a PersonaBatchSpec (exam × topics × styles × objectives × formats)
 * and generates a cartesian product of content requests.
 *
 * Modes:
 *   'generate_only'       — pure LLM generation (fast, no external sources)
 *   'scrape_then_generate'— fetch from knowledgeRouter first, then generate grounded content
 *   'wolfram_grounded'    — Wolfram verification on all generated content
 *
 * Agent wiring:
 *   Scout  → seeds topic list + trending signals → feeds into PersonaBatchSpec
 *   Atlas  → receives output → stores in content store / blogStore
 *   Oracle → receives quality scores → feeds back as persona signals
 *   Sage   → receives high-quality outputs → uses as context in student interactions
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  renderPrompt,
  inferPersonaContext,
  type PersonaContext,
  type ContentPersonaFormat,
  type LearningStyle,
  type LearningObjective,
} from './contentPersonaEngine';
import type { ContentAtom, ContentAtomType } from './contentFramework';
import { resolveKnowledgeForUser } from './knowledgeRouter';
import { callLLM } from './llmService';
import { loadCurrentUser, getExamFilteredSources } from './userService';
import type { GenerationRequest } from './contentGenerationService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BatchMode =
  | 'generate_only'        // pure LLM — no external scraping
  | 'scrape_then_generate' // knowledgeRouter → grounded generation
  | 'wolfram_grounded';    // Wolfram verification on all outputs

export interface PersonaBatchSpec {
  id: string;
  name: string;
  examId: string;
  examName: string;

  // Cartesian dimensions
  topics: string[];                     // topic names/IDs (from syllabus or Scout signals)
  learningStyles: LearningStyle[];      // styles to generate for
  objectives: LearningObjective[];      // objectives to generate for
  formats: ContentPersonaFormat[];      // output formats

  // Generation config
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  itemCountPerRequest: number;          // MCQs per topic (default 10)
  mode: BatchMode;

  // Scrape config (for 'scrape_then_generate' mode)
  scrapeSourceIds?: string[];           // specific knowledgeRouter source IDs to use

  // Agent signal injections
  scoutSignals?: string[];              // trending topic signals from Scout
  cohortMistakes?: Record<string, string[]>; // topic → common mistakes from Oracle/Prism
}

export interface PersonaBatchExpansion {
  spec: PersonaBatchSpec;
  totalRequests: number;
  requests: PersonaBatchRequest[];
  skippedCombos: number;
}

export interface PersonaBatchRequest {
  id: string;
  personaContext: PersonaContext;
  renderedPrompt: { systemPrompt: string; userPrompt: string };
  generationRequest: GenerationRequest;
  scrapedContext?: string;              // pre-fetched from knowledgeRouter
  status: 'pending' | 'running' | 'done' | 'failed';
}

export interface PersonaBatchOutput {
  requestId: string;
  personaContext: PersonaContext;
  content: string;
  format: ContentPersonaFormat;
  wolframVerified: boolean;
  qualityScore: number;                 // 0–1
  agentRouted: 'atlas' | 'herald' | null;
  contentAtom?: ContentAtom;            // structured atom built from the generated content
}

// ─── Format → AtomType mapper ─────────────────────────────────────────────────

function formatToAtomType(format: ContentPersonaFormat): ContentAtomType {
  const map: Partial<Record<ContentPersonaFormat, ContentAtomType>> = {
    mcq_set:           'mcq',
    lesson_notes:      'lesson_block',
    formula_sheet:     'formula_card',
    flashcard_set:     'flashcard',
    blog_post:         'blog_post',
    cheatsheet:        'summary',
    worked_example:    'worked_example',
    analogy_explainer: 'analogy',
    doubt_resolution:  'lesson_block',
    visual_diagram_text: 'visual_explainer',
  };
  return map[format] ?? 'lesson_block';
}

export interface PersonaBatchResult {
  specId: string;
  completedAt: string;                  // ISO string
  totalRequests: number;
  succeeded: number;
  failed: number;
  outputs: PersonaBatchOutput[];
}

export interface PersonaBatchProgress {
  phase: 'scraping' | 'generating' | 'done';
  done: number;
  total: number;
  pct: number;                          // 0–100
}

// ─── Invalid Combination Registry ────────────────────────────────────────────
//
// These (objective, format) pairs are semantically nonsensical and are filtered
// out during cartesian expansion to avoid wasting LLM tokens.
//
const INVALID_COMBOS = new Set<string>([
  'quick_revision:blog_post',        // a quick-revision blog is a contradiction
  'doubt_clearing:blog_post',        // doubt clearing is interactive, not blog-style
  'competitive_edge:flashcard_set',  // flashcards are too shallow for topper content
  'quick_revision:lesson_notes',     // lesson notes are deep; quick revision is not
  'doubt_clearing:cheatsheet',       // cheatsheets don't resolve doubts
  'doubt_clearing:formula_sheet',    // same reason
]);

// ─── Expansion ────────────────────────────────────────────────────────────────

/**
 * Expands a PersonaBatchSpec into the full cartesian product of requests.
 * Filters invalid objective × format combinations.
 */
export function expandBatchSpec(spec: PersonaBatchSpec): PersonaBatchExpansion {
  const requests: PersonaBatchRequest[] = [];
  let skippedCombos = 0;

  for (const topic of spec.topics) {
    for (const style of spec.learningStyles) {
      for (const objective of spec.objectives) {
        for (const format of spec.formats) {

          // Skip nonsensical combinations
          const comboKey = `${objective}:${format}`;
          if (INVALID_COMBOS.has(comboKey)) {
            skippedCombos++;
            continue;
          }

          // Build persona context with spec overrides.
          // scoutSignals: trending topic signals from Scout — injected as relatedWeakTopics
          // so the exam-context directive proactively addresses them.
          // cohortMistakes: per-topic mistake list from Oracle/Prism — flows into commonMistakes.
          const personaCtx = inferPersonaContext(null, topic, spec.examId, format, {
            learningStyle:      style,
            objective,
            examId:             spec.examId,
            examName:           spec.examName,
            difficulty:         spec.difficulty,
            itemCount:          format === 'mcq_set' ? spec.itemCountPerRequest : undefined,
            commonMistakes:     spec.cohortMistakes?.[topic],
            // Scout signals become relatedWeakTopics, filtered to exclude the current topic
            relatedWeakTopics:  spec.scoutSignals?.filter(s => s !== topic),
          });

          // Render system + user prompts via the persona engine
          const rendered = renderPrompt(personaCtx);

          // Build a GenerationRequest compatible with batchContentService
          const generationRequest: GenerationRequest = {
            source:                 'direct_prompt',
            sourceData:             { prompt: rendered.userPrompt },
            outputFormat:           format as any,
            examTarget:             spec.examName,
            topicId:                topic,
            difficultyLevel:        spec.difficulty,
            count:                  personaCtx.itemCount,
            useWolframVerification: spec.mode === 'wolfram_grounded',
            useWolframGrounding:    spec.mode === 'wolfram_grounded',
          };

          const requestId = [
            spec.id,
            topic,
            style,
            objective,
            format,
          ].join('_').replace(/\s+/g, '-').toLowerCase();

          requests.push({
            id:              requestId,
            personaContext:  personaCtx,
            renderedPrompt:  {
              systemPrompt: rendered.systemPrompt,
              userPrompt:   rendered.userPrompt,
            },
            generationRequest,
            status: 'pending',
          });
        }
      }
    }
  }

  return {
    spec,
    totalRequests: requests.length,
    requests,
    skippedCombos,
  };
}

// ─── Scrape Phase ─────────────────────────────────────────────────────────────

/**
 * For each request, fetches grounding context from knowledgeRouter
 * and injects it into the generation request prompt.
 *
 * Only enriches requests where the router returns a non-LLM result
 * (i.e., real scraped/RAG content). Falls back to original request on error.
 */
export async function scrapeContextForRequests(
  requests: PersonaBatchRequest[],
  spec: PersonaBatchSpec,
  onProgress?: (done: number, total: number) => void
): Promise<PersonaBatchRequest[]> {
  const user = loadCurrentUser();
  const filteredSources = user
    ? getExamFilteredSources(user.examSubscriptions, spec.examId)
    : [];

  const enriched: PersonaBatchRequest[] = [];
  let done = 0;

  for (const req of requests) {
    try {
      const knowledge = await resolveKnowledgeForUser(
        {
          text:    req.personaContext.topic,
          examId:  spec.examId,
          topicId: req.personaContext.topic,
        },
        filteredSources.length > 0 ? filteredSources : undefined
      );

      // Only inject if we got real scraped content (not an LLM fallback)
      if (knowledge.answer && knowledge.source !== 'llm_fallback') {
        const referenceBlock = [
          '',
          `## REFERENCE MATERIAL (Source: ${knowledge.source}, confidence: ${Math.round(knowledge.confidence * 100)}%)`,
          knowledge.answer.slice(0, 2000),   // cap at 2k chars to stay within context
        ].join('\n');

        enriched.push({
          ...req,
          scrapedContext: knowledge.answer,
          generationRequest: {
            ...req.generationRequest,
            sourceData: {
              ...req.generationRequest.sourceData,
              prompt: (req.renderedPrompt.userPrompt + referenceBlock),
            },
          },
        });
      } else {
        enriched.push(req);
      }
    } catch {
      // Silently fall back to un-enriched request on error
      enriched.push(req);
    }

    done++;
    onProgress?.(done, requests.length);
  }

  return enriched;
}

// ─── Quality Scoring ──────────────────────────────────────────────────────────

/**
 * Simple heuristic quality score (0–1) based on output characteristics.
 * Oracle agent should replace this with real signal-based scoring over time.
 */
function scoreOutput(content: string, format: ContentPersonaFormat): number {
  let score = 0.5;

  if (!content || content.trim().length < 100) return 0;

  // Length check — too short is bad
  if (content.length > 500)  score += 0.1;
  if (content.length > 1500) score += 0.1;

  // Format-specific checks
  if (format === 'mcq_set') {
    const hasOptions   = /[A-D]\)/g.test(content);
    const hasAnswer    = /answer:/i.test(content);
    const hasExplain   = /explanation|because|correct/i.test(content);
    if (hasOptions)  score += 0.1;
    if (hasAnswer)   score += 0.1;
    if (hasExplain)  score += 0.1;
  }

  if (format === 'lesson_notes') {
    const hasSections = /##\s+(overview|concept|formula|example|tips)/i.test(content);
    if (hasSections) score += 0.2;
  }

  if (format === 'flashcard_set') {
    const hasCards = /^Q:/m.test(content);
    if (hasCards) score += 0.2;
  }

  if (format === 'worked_example') {
    const hasSteps = /(given|find|solution|answer)/i.test(content);
    if (hasSteps) score += 0.2;
  }

  return Math.min(score, 1.0);
}

// ─── Main Batch Runner ────────────────────────────────────────────────────────

/**
 * Runs a full persona batch job end-to-end:
 *   1. Expand spec into requests
 *   2. Scrape reference content (if mode requires)
 *   3. Generate via LLM using persona-rendered prompts
 *   4. Score and route outputs to agents
 *
 * Progress callbacks fire for each phase: 'scraping' | 'generating'.
 */
export async function runPersonaBatch(
  spec: PersonaBatchSpec,
  onProgress?: (phase: string, done: number, total: number) => void
): Promise<PersonaBatchResult> {
  // ── Phase 0: Expand ──────────────────────────────────────────────────────
  const expansion = expandBatchSpec(spec);
  let requests = expansion.requests;

  if (requests.length === 0) {
    return {
      specId:        spec.id,
      completedAt:   new Date().toISOString(),
      totalRequests: 0,
      succeeded:     0,
      failed:        0,
      outputs:       [],
    };
  }

  // ── Phase 1: Scrape (if mode requires it) ────────────────────────────────
  if (spec.mode === 'scrape_then_generate' || spec.mode === 'wolfram_grounded') {
    onProgress?.('scraping', 0, requests.length);
    requests = await scrapeContextForRequests(
      requests,
      spec,
      (done, total) => onProgress?.('scraping', done, total)
    );
    onProgress?.('scraping', requests.length, requests.length);
  }

  // ── Phase 2: Generate via LLM ────────────────────────────────────────────
  onProgress?.('generating', 0, requests.length);

  const outputs: PersonaBatchOutput[] = [];
  let succeeded = 0;
  let failed = 0;

  // Process sequentially to respect rate limits.
  // For higher throughput, wrap in a concurrency limiter (e.g. p-limit) and
  // integrate with rateLimitService — see batchContentService for reference.
  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    onProgress?.('generating', i, requests.length);

    try {
      const result = await callLLM({
        agent:             'atlas',
        message:           req.generationRequest.sourceData.prompt ?? req.renderedPrompt.userPrompt,
        customSystemPrompt: req.renderedPrompt.systemPrompt,
      });

      if (result?.text) {
        const quality = scoreOutput(result.text, req.personaContext.format);

        // Route blog posts to Herald (publishing agent), others stay with Atlas
        const agentRouted: 'atlas' | 'herald' | null =
          req.personaContext.format === 'blog_post' ? 'herald' : 'atlas';

        const ctx = req.personaContext;
        const output: PersonaBatchOutput = {
          requestId:       req.id,
          personaContext:  ctx,
          content:         result.text,
          format:          ctx.format,
          wolframVerified: false,     // Oracle/Wolfram verifies asynchronously
          qualityScore:    quality,
          agentRouted,
        };

        // Build a ContentAtom from the raw generated output
        const atom: ContentAtom = {
          id:    `batch_${req.id}`,
          type:  formatToAtomType(ctx.format),
          title: `${ctx.topic} — ${ctx.format} #${outputs.length + 1}`,
          body:  result.text.slice(0, 500),
          bodyMarkdown: result.text,
          examId: ctx.examId,
          topic: ctx.topic,
          difficulty: (ctx.difficulty === 'mixed' ? 'medium' : ctx.difficulty) ?? 'medium',
          syllabusPriority: 'high',
          quality: {
            accuracy:        quality,
            clarity:         quality * 0.9,
            examRelevance:   0.85,
            engagementScore: 0,
            wolframVerified: false,
            reviewedByHuman: false,
          },
          generatedBy:   'atlas',
          generatedAt:   new Date(),
          sourceType:    'llm',
          version:       1,
          timesServed:   0,
          avgRating:     0,
          completionRate: 0,
        };
        output.contentAtom = atom;

        outputs.push(output);
        succeeded++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  onProgress?.('generating', requests.length, requests.length);

  return {
    specId:        spec.id,
    completedAt:   new Date().toISOString(),
    totalRequests: requests.length,
    succeeded,
    failed,
    outputs,
  };
}

// ─── Convenience Builders ─────────────────────────────────────────────────────

/**
 * Build a quick MCQ-only batch spec for a single exam + topic list.
 * Useful for Scout-triggered content gaps.
 */
export function buildMCQBatchSpec(
  examId: string,
  examName: string,
  topics: string[],
  opts?: Partial<Pick<PersonaBatchSpec, 'difficulty' | 'itemCountPerRequest' | 'mode' | 'cohortMistakes'>>
): PersonaBatchSpec {
  return {
    id:                 `mcq_batch_${examId}_${Date.now()}`,
    name:               `MCQ Batch — ${examName}`,
    examId,
    examName,
    topics,
    learningStyles:     ['unknown'],          // let engine adapt
    objectives:         ['exam_readiness'],
    formats:            ['mcq_set'],
    difficulty:         opts?.difficulty          ?? 'mixed',
    itemCountPerRequest: opts?.itemCountPerRequest ?? 10,
    mode:               opts?.mode               ?? 'generate_only',
    cohortMistakes:     opts?.cohortMistakes,
  };
}

/**
 * Build a full-coverage batch spec across all styles and key formats.
 * Useful for seeding a new topic from scratch.
 */
export function buildFullCoverageBatchSpec(
  examId: string,
  examName: string,
  topics: string[],
  opts?: Partial<Pick<PersonaBatchSpec, 'mode' | 'cohortMistakes' | 'scoutSignals'>>
): PersonaBatchSpec {
  return {
    id:                 `full_batch_${examId}_${Date.now()}`,
    name:               `Full Coverage — ${examName}`,
    examId,
    examName,
    topics,
    learningStyles:     ['visual', 'analytical', 'practice_first', 'story_driven'],
    objectives:         ['conceptual_understanding', 'exam_readiness', 'quick_revision'],
    formats:            ['mcq_set', 'lesson_notes', 'cheatsheet', 'worked_example', 'flashcard_set'],
    difficulty:         'mixed',
    itemCountPerRequest: 10,
    mode:               opts?.mode          ?? 'generate_only',
    cohortMistakes:     opts?.cohortMistakes,
    scoutSignals:       opts?.scoutSignals,
  };
}

/**
 * Returns a summary string for logging/display.
 */
export function summariseBatchResult(result: PersonaBatchResult): string {
  const pct = result.totalRequests > 0
    ? Math.round((result.succeeded / result.totalRequests) * 100)
    : 0;

  const byFormat = result.outputs.reduce<Record<string, number>>((acc, o) => {
    acc[o.format] = (acc[o.format] ?? 0) + 1;
    return acc;
  }, {});

  const formatBreakdown = Object.entries(byFormat)
    .map(([f, n]) => `${f}: ${n}`)
    .join(', ');

  return [
    `Batch ${result.specId} — ${pct}% success (${result.succeeded}/${result.totalRequests})`,
    `Completed: ${result.completedAt}`,
    `By format: ${formatBreakdown || 'none'}`,
    result.failed > 0 ? `⚠️ ${result.failed} failed` : '✅ No failures',
  ].join(' | ');
}
