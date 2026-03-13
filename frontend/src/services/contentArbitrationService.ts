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
import type { GenerationRequest, ContentSource, GenerationLayer } from './contentGenerationService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ArbitrationPath = 'wolfram' | 'document' | 'llm';

export interface ArbitrationDecision {
  path: ArbitrationPath;
  reason: string;           // human-readable explanation
  wolframQuery?: string;    // if wolfram path, the query to run
  sourceLabel: string;      // "🔢 Wolfram Verified" | "📄 Document" | "🧠 LLM"
  confidenceBoost: number;  // 0.0–0.25 confidence bonus over base
  // Two-layer model context (optional, set when layer info is available)
  layer?: GenerationLayer;
  mandatoryAtomType?: string;
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
 * Priority (with layer-aware overrides):
 *  1. Explicit wolfram_grounded source → wolfram
 *  2. Document / API / MCP source → document
 *  3. [mandatory layer] math topic → always wolfram (accuracy > speed)
 *  4. [mandatory layer] PYQ atom type → never llm; use static/pyq path → document fallback
 *  5. [personalized layer] style adaptation → prefer llm (persona prompts)
 *  6. [personalized layer] math topic + non-free plan → wolfram; else → llm
 *  7. useWolframGrounding flag + Wolfram available + mathematical topic → wolfram
 *  8. Topic is mathematical + Wolfram available → wolfram
 *  9. Fallback → llm
 */
export function arbitrateContentSource(
  request: GenerationRequest,
): ArbitrationDecision {
  const { layer, mandatoryAtomType } = request;

  // Rule 1: explicit wolfram_grounded source
  if (request.source === 'wolfram_grounded') {
    return {
      path: 'wolfram',
      reason: 'Source explicitly set to wolfram_grounded',
      wolframQuery: buildWolframQuery(request),
      sourceLabel: '🔢 Wolfram Verified',
      confidenceBoost: 0.25,
      layer,
      mandatoryAtomType,
    };
  }

  // Rule 2: document-type sources
  if (isDocumentSource(request.source)) {
    return {
      path: 'document',
      reason: `Source is ${request.source} — using document/external path`,
      sourceLabel: '📄 Document',
      confidenceBoost: 0.1,
      layer,
      mandatoryAtomType,
    };
  }

  // ── Layer-aware rules ────────────────────────────────────────────────────

  if (layer === 'mandatory') {
    // Mandatory: PYQ atom types come from static only (never LLM for PYQ facts)
    if (mandatoryAtomType === 'pyq_set') {
      return {
        path: 'document',  // static PYQ library or document path
        reason: 'Mandatory PYQ set — PYQs come from static/verified source, not LLM',
        sourceLabel: '📄 Document (PYQ Static)',
        confidenceBoost: 0.2,
        layer,
        mandatoryAtomType,
      };
    }

    // Mandatory + math topic → always wolfram (accuracy imperative)
    if (isMathematicalTopic(request) && isWolframAvailable()) {
      const wolframQuery = buildWolframQuery(request);
      return {
        path: 'wolfram',
        reason: 'Mandatory layer + mathematical topic — Wolfram required for accuracy',
        wolframQuery,
        sourceLabel: '🔢 Wolfram Verified',
        confidenceBoost: 0.25,
        layer,
        mandatoryAtomType,
      };
    }

    // Mandatory + non-math → LLM with mandatory framing (see buildGenerationPrompt)
    return {
      path: 'llm',
      reason: 'Mandatory layer non-math topic — LLM with mandatory-framing prompt',
      sourceLabel: '🧠 LLM (Mandatory)',
      confidenceBoost: 0.05,
      layer,
      mandatoryAtomType,
    };
  }

  if (layer === 'personalized') {
    // Personalized + math topic → wolfram only if topic is mathematical and wolfram available
    if (isMathematicalTopic(request) && isWolframAvailable()) {
      const wolframQuery = buildWolframQuery(request);
      return {
        path: 'wolfram',
        reason: 'Personalized layer + mathematical topic — Wolfram for accuracy, then style-adapted',
        wolframQuery,
        sourceLabel: '🔢 Wolfram Verified',
        confidenceBoost: 0.2,
        layer,
        mandatoryAtomType,
      };
    }

    // Personalized + non-math → LLM with persona prompts
    return {
      path: 'llm',
      reason: 'Personalized layer — LLM with persona/style adaptation prompts',
      sourceLabel: '🧠 LLM (Personalized)',
      confidenceBoost: 0.0,
      layer,
      mandatoryAtomType,
    };
  }

  // ── Original rules (no layer specified — backward compat) ────────────────

  // Rule 3 (legacy): useWolframGrounding flag + Wolfram available + mathematical topic
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

  // Rule 4 (legacy): topic matches WOLFRAM_TOPICS + Wolfram available
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

  // Rule 5 (legacy): fallback to LLM
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
