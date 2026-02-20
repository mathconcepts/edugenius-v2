/**
 * Variable Resolver
 *
 * Instead of hardcoding values, agents ask the resolver:
 * "What should the pricing be?" → resolver uses Scout data + Oracle metrics to compute
 *
 * All variables have 3 layers:
 *   1. CEO override (highest priority — from thresholds/config)
 *   2. Agent-computed (from market data, ML)
 *   3. Hardcoded fallback (lowest priority — safe defaults)
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { DEFAULT_CEO_THRESHOLDS } from './ceo-thresholds';

// ── Core types ───────────────────────────────────────────────────────────────

export interface ResolvedVariable<T> {
  value: T;
  source: 'ceo_override' | 'agent_computed' | 'fallback';
  confidence: number;    // 0-1
  reasoning: string;
  computedBy: string;    // which agent/sub-agent computed this
  computedAt: Date;
  expiresAt: Date;       // when to recompute
}

// ── Variable schemas ─────────────────────────────────────────────────────────

export interface PricingVariables {
  freePlanLimit: number;          // e.g. 10 questions/day
  proMonthlyPrice: number;        // ₹299
  premiumMonthlyPrice: number;    // ₹599
  eliteMonthlyPrice: number;      // ₹999
  whatsappAddonPrice: number;     // ₹99
  telegramAddonPrice: number;     // ₹99
  bundleAddonPrice: number;       // ₹149
  trialDays: number;              // 7
  referralDiscount: number;       // 20%
  annualDiscount: number;         // 30%
}

export interface ContentVariables {
  blogPostsPerWeek: number;              // how many to publish
  emailCadenceDays: number;              // days between nurture emails
  whatsappReminderHour: number;          // 8 = 8am IST
  practiceQuestionsPerSession: number;
  dailyGoalMinutes: number;
  streakReminderThresholdDays: number;   // days inactive before reminder
}

export interface OutreachVariables {
  atRiskThresholdDays: number;           // days inactive before flagged
  churnRescueDays: number;               // days before sub expiry to trigger rescue
  onboardingEmailDelay: number;          // hours after signup for first onboarding email
  parentReportFrequencyDays: number;
  welcomeMessageDelay: number;           // minutes after signup for welcome WhatsApp
}

// ── Scout-informed pricing resolver ─────────────────────────────────────────

export async function resolvePricingVariables(
  marketData?: { competitorPrices?: number[]; avgIndianEdTechPrice?: number },
): Promise<ResolvedVariable<PricingVariables>> {
  let computed: PricingVariables;
  let confidence = 0.7;
  let reasoning = 'Fallback defaults — Scout market data not available';

  if (marketData?.competitorPrices?.length) {
    const avgCompetitor =
      marketData.competitorPrices.reduce((a, b) => a + b, 0) /
      marketData.competitorPrices.length;
    // Price at 80% of market average (competitive entry point)
    const baseMultiplier = 0.8;
    confidence = 0.85;
    reasoning =
      `Computed from ${marketData.competitorPrices.length} competitor price points. ` +
      `Avg market: ₹${avgCompetitor.toFixed(0)}. Priced at 80% for competitive entry.`;

    computed = {
      freePlanLimit: 10,
      proMonthlyPrice: Math.round((avgCompetitor * baseMultiplier * 0.5) / 10) * 10,
      premiumMonthlyPrice: Math.round((avgCompetitor * baseMultiplier) / 10) * 10,
      eliteMonthlyPrice: Math.round((avgCompetitor * baseMultiplier * 1.8) / 10) * 10,
      whatsappAddonPrice: 99,
      telegramAddonPrice: 99,
      bundleAddonPrice: 149,
      trialDays: 7,
      referralDiscount: 20,
      annualDiscount: 30,
    };
  } else {
    // Hardcoded market-researched defaults for Indian EdTech
    computed = {
      freePlanLimit: 10,
      proMonthlyPrice: 299,
      premiumMonthlyPrice: 599,
      eliteMonthlyPrice: 999,
      whatsappAddonPrice: 99,
      telegramAddonPrice: 99,
      bundleAddonPrice: 149,
      trialDays: 7,
      referralDiscount: 20,
      annualDiscount: 30,
    };
  }

  return {
    value: computed,
    source: marketData?.competitorPrices?.length ? 'agent_computed' : 'fallback',
    confidence,
    reasoning,
    computedBy: 'Scout.PricingCalibrator',
    computedAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // recompute weekly
  };
}

// ── Oracle-informed content cadence resolver ─────────────────────────────────

export async function resolveContentVariables(): Promise<ResolvedVariable<ContentVariables>> {
  // Oracle will override these when real engagement data is available
  return {
    value: {
      blogPostsPerWeek: 3,
      emailCadenceDays: 3,
      whatsappReminderHour: 8, // 8am IST
      practiceQuestionsPerSession: 20,
      dailyGoalMinutes: 45,
      streakReminderThresholdDays: 2,
    },
    source: 'fallback',
    confidence: 0.7,
    reasoning:
      'Research-backed defaults for Indian exam prep students. ' +
      'Oracle will refine with real engagement data.',
    computedBy: 'Oracle.EngagementOptimizer',
    computedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // recompute daily
  };
}

// ── Mentor-informed outreach timing resolver ─────────────────────────────────

export async function resolveOutreachVariables(): Promise<ResolvedVariable<OutreachVariables>> {
  return {
    value: {
      atRiskThresholdDays: 3,
      churnRescueDays: 7,
      onboardingEmailDelay: 1,  // 1 hour after signup
      parentReportFrequencyDays: 7,
      welcomeMessageDelay: 5,   // 5 min after signup
    },
    source: 'fallback',
    confidence: 0.8,
    reasoning:
      'Industry benchmarks for EdTech outreach timing. ' +
      'Mentor will A/B test and refine over time.',
    computedBy: 'Mentor.CadenceOptimizer',
    computedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
}

// ── Generic resolver with CEO override support ───────────────────────────────

export function resolveWithOverride<T>(
  agentComputed: T,
  ceoOverride: Partial<T> | undefined,
  fallback: T,
  metadata: { computedBy: string; reasoning: string; confidence: number; ttlMs?: number },
): ResolvedVariable<T> {
  if (ceoOverride && Object.keys(ceoOverride).length > 0) {
    return {
      value: { ...agentComputed, ...ceoOverride } as T,
      source: 'ceo_override',
      confidence: 1.0,
      reasoning: 'CEO override applied',
      computedBy: 'CEO',
      computedAt: new Date(),
      expiresAt: new Date(Date.now() + (metadata.ttlMs ?? 24 * 60 * 60 * 1000)),
    };
  }

  const hasAgentData =
    agentComputed !== null &&
    agentComputed !== undefined &&
    agentComputed !== fallback;

  return {
    value: hasAgentData ? agentComputed : fallback,
    source: hasAgentData ? 'agent_computed' : 'fallback',
    confidence: metadata.confidence,
    reasoning: metadata.reasoning,
    computedBy: metadata.computedBy,
    computedAt: new Date(),
    expiresAt: new Date(Date.now() + (metadata.ttlMs ?? 24 * 60 * 60 * 1000)),
  };
}
