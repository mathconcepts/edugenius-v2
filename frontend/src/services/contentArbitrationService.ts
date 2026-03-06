/**
 * contentArbitrationService.ts — Decides content source path
 *
 * Three modes:
 *   wolfram  → Wolfram CAG (compute first, then generate)
 *   document → External source (document upload / API / MCP)
 *   llm      → Direct LLM generation (implicit knowledge)
 *
 * Wolfram is preferred for mathematical/scientific topics when available.
 * Document is used when an external source is explicitly provided.
 * LLM is the fallback for all other cases.
 */

import { isWolframAvailable } from './wolframService';
import type { GenerationRequest, ContentSource } from './contentGenerationService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ArbitrationPath = 'wolfram' | 'document' | 'llm';

export interface ArbitrationDecision {
  path: ArbitrationPath;
  reason: string;           // human-readable explanation
  wolframQuery?: string;    // if wolfram path, the query to run
  sourceLabel: string;      // "🔢 Wolfram Verified" | "📄 Document" | "🧠 LLM"
  confidenceBoost: number;  // 0.0–0.25 confidence bonus over base
}

// ─── Wolfram topic keywords ───────────────────────────────────────────────────

const WOLFRAM_TOPICS: string[] = [
  'math', 'physics', 'chemistry', 'formula', 'equation', 'calculus',
  'integral', 'derivative', 'eigenvalue', 'thermodynamics', 'electromagnetism',
  'signals', 'control systems', 'laplace', 'fourier', 'differential', 'matrix',
  'vector', 'circuit', 'mechanics', 'optics', 'quantum', 'probability',
  'statistics', 'gate', 'jee', 'nernst', 'bernoulli', 'kirchhoff', 'maxwell',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDocumentSource(source: ContentSource): boolean {
  return (
    source === 'document_upload' ||
    source === 'external_api' ||
    source === 'mcp_endpoint'
  );
}

function isMathematicalTopic(request: GenerationRequest): boolean {
  const haystack = [
    request.sourceData.prompt ?? '',
    request.sourceData.wolframQuery ?? '',
    request.topicId ?? '',
  ]
    .join(' ')
    .toLowerCase();

  return WOLFRAM_TOPICS.some(kw => haystack.includes(kw));
}

function buildWolframQuery(request: GenerationRequest): string {
  // If a wolframQuery is already explicitly set, use it.
  if (request.sourceData.wolframQuery) {
    return request.sourceData.wolframQuery;
  }
  // Otherwise derive from the prompt / topicId
  const base = request.sourceData.prompt ?? request.topicId ?? '';
  return base.trim();
}

// ─── Source badge display metadata ───────────────────────────────────────────

export function getSourceBadge(path: ArbitrationPath): {
  label: string;
  color: string;
  icon: string;
} {
  switch (path) {
    case 'wolfram':
      return { label: '🔢 Wolfram', color: 'green', icon: '🔢' };
    case 'document':
      return { label: '📄 Document', color: 'blue', icon: '📄' };
    case 'llm':
    default:
      return { label: '🧠 LLM', color: 'grey', icon: '🧠' };
  }
}

// ─── Core arbitration logic ───────────────────────────────────────────────────

/**
 * arbitrateContentSource — given a GenerationRequest, decide which source path to use.
 *
 * Priority:
 *  1. Explicit wolfram_grounded source → wolfram
 *  2. Document / API / MCP source → document
 *  3. useWolframGrounding flag + Wolfram available + mathematical topic → wolfram
 *  4. Topic is mathematical + Wolfram available → wolfram
 *  5. Fallback → llm
 */
export function arbitrateContentSource(
  request: GenerationRequest,
): ArbitrationDecision {
  // Rule 1: explicit wolfram_grounded source
  if (request.source === 'wolfram_grounded') {
    return {
      path: 'wolfram',
      reason: 'Source explicitly set to wolfram_grounded',
      wolframQuery: buildWolframQuery(request),
      sourceLabel: '🔢 Wolfram Verified',
      confidenceBoost: 0.25,
    };
  }

  // Rule 2: document-type sources
  if (isDocumentSource(request.source)) {
    return {
      path: 'document',
      reason: `Source is ${request.source} — using document/external path`,
      sourceLabel: '📄 Document',
      confidenceBoost: 0.1,
    };
  }

  // Rule 3: useWolframGrounding flag + Wolfram available + mathematical topic
  if (
    request.useWolframGrounding &&
    isWolframAvailable() &&
    isMathematicalTopic(request)
  ) {
    const wolframQuery = buildWolframQuery(request);
    return {
      path: 'wolfram',
      reason:
        'useWolframGrounding is true, Wolfram is available, and topic is mathematical',
      wolframQuery,
      sourceLabel: '🔢 Wolfram Verified',
      confidenceBoost: 0.2,
    };
  }

  // Rule 4: topic matches WOLFRAM_TOPICS + Wolfram available
  if (isMathematicalTopic(request) && isWolframAvailable()) {
    const wolframQuery = buildWolframQuery(request);
    return {
      path: 'wolfram',
      reason: 'Topic matches Wolfram subject keywords and Wolfram is available',
      wolframQuery,
      sourceLabel: '🔢 Wolfram Verified',
      confidenceBoost: 0.15,
    };
  }

  // Rule 5: fallback to LLM
  return {
    path: 'llm',
    reason: 'No Wolfram or document source applicable — using direct LLM generation',
    sourceLabel: '🧠 LLM',
    confidenceBoost: 0.0,
  };
}

// ─── Request resolver ─────────────────────────────────────────────────────────

/**
 * resolveGenerationRequest — runs arbitration and returns a new GenerationRequest
 * with the correct `source` and `sourceData.wolframQuery` fields set.
 */
export function resolveGenerationRequest(
  request: GenerationRequest,
): GenerationRequest {
  const decision = arbitrateContentSource(request);

  switch (decision.path) {
    case 'wolfram':
      return {
        ...request,
        source: 'wolfram_grounded',
        sourceData: {
          ...request.sourceData,
          wolframQuery: decision.wolframQuery ?? request.sourceData.wolframQuery,
        },
        useWolframGrounding: true,
        useWolframVerification: true,
      };

    case 'document':
      // Document path — keep the existing source as-is
      return {
        ...request,
        useWolframVerification: isWolframAvailable(),
      };

    case 'llm':
    default:
      return {
        ...request,
        source: request.source === 'wolfram_grounded' ? 'direct_prompt' : request.source,
        useWolframGrounding: false,
        useWolframVerification: isWolframAvailable(),
      };
  }
}
