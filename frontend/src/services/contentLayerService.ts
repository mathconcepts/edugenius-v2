/**
 * contentLayerService.ts — Mandatory + Personalized Content Layer Orchestrator
 *
 * Combines the mandatory baseline (Layer 1) with hyper-personalized content
 * (Layer 2) into a single LayeredContent response.
 *
 * The two-layer model:
 * ┌─────────────────────────────────────────────────────────┐
 * │  LAYER 2: HYPER-PERSONALIZED                            │
 * │  (adapts to individual: style, load, mood, exam prox.)  │
 * ├─────────────────────────────────────────────────────────┤
 * │  LAYER 1: MANDATORY BASELINE                            │
 * │  (guaranteed: concept_core, formula_card, worked_ex,    │
 * │   pyq_set, common_mistakes, exam_tips)                  │
 * └─────────────────────────────────────────────────────────┘
 *
 * Graceful degradation:
 * - If personalization budget exhausted → mandatory only
 * - If everything fails → T0 static always works
 */

import type { ContentAtom } from './contentFramework';
import type { DeliverySurface } from './contentTierService';
import type { PersonaContext } from './contentPersonaEngine';
import {
  getMandatoryLayer,
  queueMissingMandatory,
  auditMandatoryContent,
} from './mandatoryContentService';
import { buildPersonalizedLayer } from './contentPersonaEngine';
import {
  getContentBudget,
  getContentBudgetStatus,
  consumeContentBudget,
} from './rateLimitService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LayeredContent {
  /** Always shown first — the mandatory baseline atoms */
  mandatory: ContentAtom[];
  /** Shown after mandatory — adapted to persona */
  personalized: ContentAtom[];
  /** 0-100 completeness of mandatory baseline */
  mandatoryCompleteness: number;
  /** Depth of personalization achieved */
  personalizationDepth: 'full' | 'partial' | 'default';
  /** Trace for debugging / CEO panel */
  generationTrace: {
    mandatorySource: 'static' | 'cached' | 'generated';
    personalizedSource: 'template' | 'llm' | 'static_adapted' | 'none';
    tier: string;
    rateLimitState: string;
  };
}

// ─── Core orchestrator ────────────────────────────────────────────────────────

/**
 * Returns layered content for the given (examId, topicId, persona) combination.
 *
 * Logic:
 * 1. getMandatoryLayer → always first, never skipped
 * 2. Check rate-limit budget remaining
 * 3. If budget allows → build personalized layer on top
 * 4. If rate limited / budget exhausted → mandatory only (never blocks user)
 * 5. Queue any missing mandatory atoms for background generation
 * 6. Return layered result
 */
export async function getLayeredContent(
  examId: string,
  topicId: string,
  personaCtx: PersonaContext,
  surface: DeliverySurface,
  userPlan?: string,
): Promise<LayeredContent> {
  // ── Step 1: Get mandatory baseline ──────────────────────────────────────
  const mandatory = getMandatoryLayer(examId, topicId);
  const spec = auditMandatoryContent(examId, topicId);
  const mandatoryCompleteness = spec.completeness;

  const mandatorySource: LayeredContent['generationTrace']['mandatorySource'] =
    mandatory.some(a => a.sourceType === 'llm') ? 'generated'
    : mandatory.some(a => a.id.includes('mandatory_')) ? 'cached'
    : 'static';

  // ── Step 2: Queue missing mandatory atoms for background generation ──────
  // Fire-and-forget: don't await — background task
  void queueMissingMandatory(examId, topicId);

  // ── Step 3: Check personalization budget ────────────────────────────────
  const budgetStatus = getContentBudgetStatus();
  const budget = getContentBudget();
  const rateLimitState = `status=${budgetStatus} used=${budget.dailyLLMCallsUsed}/${budget.dailyLLMCallsLimit}`;

  // If budget exhausted, return mandatory only
  if (budgetStatus === 'exhausted') {
    return {
      mandatory,
      personalized: [],
      mandatoryCompleteness,
      personalizationDepth: 'default',
      generationTrace: {
        mandatorySource,
        personalizedSource: 'none',
        tier: 'T0_static',
        rateLimitState,
      },
    };
  }

  // ── Step 4: Build personalized layer ────────────────────────────────────
  // Only if plan allows or budget healthy
  const planAllowsPersonalization =
    !userPlan || userPlan !== 'free' || budgetStatus === 'healthy';

  if (!planAllowsPersonalization) {
    return {
      mandatory,
      personalized: [],
      mandatoryCompleteness,
      personalizationDepth: 'default',
      generationTrace: {
        mandatorySource,
        personalizedSource: 'none',
        tier: 'T0_static',
        rateLimitState,
      },
    };
  }

  let personalized: ContentAtom[] = [];
  let personalizedSource: LayeredContent['generationTrace']['personalizedSource'] = 'none';
  let personalizationDepth: LayeredContent['personalizationDepth'] = 'default';
  let tier = 'T2_llm';

  try {
    // Consume personalization budget
    const budgetConsumed = consumeContentBudget('personalized');
    if (!budgetConsumed) {
      // Personalization budget exhausted — mandatory only
      return {
        mandatory,
        personalized: [],
        mandatoryCompleteness,
        personalizationDepth: 'default',
        generationTrace: {
          mandatorySource,
          personalizedSource: 'none',
          tier: 'T0_static',
          rateLimitState,
        },
      };
    }

    personalized = await buildPersonalizedLayer(mandatory, personaCtx, examId, topicId);
    personalizedSource = 'llm';
    personalizationDepth = personalized.length >= 3 ? 'full' : 'partial';
    tier = 'T2_llm';
  } catch {
    // Graceful degradation — personalization failed, mandatory still delivered
    personalized = [];
    personalizedSource = 'none';
    personalizationDepth = 'default';
    tier = 'T0_static';
  }

  return {
    mandatory,
    personalized,
    mandatoryCompleteness,
    personalizationDepth,
    generationTrace: {
      mandatorySource,
      personalizedSource,
      tier,
      rateLimitState,
    },
  };
}

/**
 * Returns a flat list of atoms in display order:
 * mandatory first, then personalized.
 * Used by components that want a single ordered list.
 */
export function flattenLayeredContent(layered: LayeredContent): ContentAtom[] {
  return [...layered.mandatory, ...layered.personalized];
}

/**
 * Returns a summary string for CEO/debug logging.
 */
export function describeLayeredContent(layered: LayeredContent): string {
  const lines = [
    `Mandatory: ${layered.mandatory.length} atoms (${layered.mandatoryCompleteness}% complete)`,
    `Personalized: ${layered.personalized.length} atoms (depth: ${layered.personalizationDepth})`,
    `Source: mandatory=${layered.generationTrace.mandatorySource}, personalized=${layered.generationTrace.personalizedSource}`,
    `Tier: ${layered.generationTrace.tier}`,
    `Rate limit: ${layered.generationTrace.rateLimitState}`,
  ];
  return lines.join('\n');
}
