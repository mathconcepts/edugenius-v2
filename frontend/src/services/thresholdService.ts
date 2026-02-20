/**
 * Frontend Threshold Service
 *
 * Reads/writes CEO thresholds from localStorage.
 * Broadcasts changes via StorageEvent so all components update live.
 *
 * NOTE: CEOThresholds interface is defined locally here to avoid cross-boundary
 * imports from the backend src/ directory.
 */

const STORAGE_KEY = 'edugenius_ceo_thresholds';

// ── Local copy of CEOThresholds (keep in sync with src/autonomy/ceo-thresholds.ts) ──

export interface CEOThresholds {
  // Financial
  maxSpendAutonomous: number;
  maxPriceChangePercent: number;
  maxDiscountPercent: number;
  // Content
  maxBlogPostsPerDay: number;
  maxEmailsPerWeek: number;
  maxWhatsAppBlastsPerWeek: number;
  // Operations
  maxNewStudentsAutoOnboard: number;
  maxTicketsAutoResolve: number;
  // Strategic
  requireApprovalForNewExam: boolean;
  requireApprovalForPriceIncrease: boolean;
  requireApprovalForNewAgent: boolean;
  // Confidence gate
  minConfidenceToAct: number;
}

export const DEFAULT_THRESHOLDS: CEOThresholds = {
  maxSpendAutonomous: 5000,
  maxPriceChangePercent: 15,
  maxDiscountPercent: 20,
  maxBlogPostsPerDay: 3,
  maxEmailsPerWeek: 5,
  maxWhatsAppBlastsPerWeek: 2,
  maxNewStudentsAutoOnboard: 500,
  maxTicketsAutoResolve: 100,
  requireApprovalForNewExam: true,
  requireApprovalForPriceIncrease: true,
  requireApprovalForNewAgent: true,
  minConfidenceToAct: 0.75,
};

export interface AgentRecommendation {
  field: keyof CEOThresholds;
  recommendedValue: number | boolean;
  reasoning: string;
  computedBy: string;
  confidence: number;
}

export const AGENT_RECOMMENDATIONS: AgentRecommendation[] = [
  {
    field: 'maxSpendAutonomous',
    recommendedValue: 7500,
    reasoning: 'Scout: avg successful campaign spend ₹6,200. ₹7,500 covers 95% of effective actions.',
    computedBy: 'Scout',
    confidence: 0.78,
  },
  {
    field: 'maxPriceChangePercent',
    recommendedValue: 10,
    reasoning: 'Oracle: price changes >10% caused 23% churn spike in comparable EdTech.',
    computedBy: 'Oracle',
    confidence: 0.82,
  },
  {
    field: 'maxDiscountPercent',
    recommendedValue: 25,
    reasoning: 'Herald: 25% discount = highest conversion (34%) without LTV degradation.',
    computedBy: 'Herald',
    confidence: 0.76,
  },
  {
    field: 'maxBlogPostsPerDay',
    recommendedValue: 4,
    reasoning: 'Atlas: 4 posts/day maximises SEO crawl budget without quality dilution.',
    computedBy: 'Atlas',
    confidence: 0.80,
  },
  {
    field: 'maxEmailsPerWeek',
    recommendedValue: 4,
    reasoning: 'Herald: 4 emails/week → 28% open rate vs 5/week → 21%. Fewer unsubscribes.',
    computedBy: 'Herald',
    confidence: 0.88,
  },
  {
    field: 'maxWhatsAppBlastsPerWeek',
    recommendedValue: 3,
    reasoning: 'Mentor: 3/week = 71% read rate. 4+ drops to 52% with higher block rate.',
    computedBy: 'Mentor',
    confidence: 0.85,
  },
  {
    field: 'minConfidenceToAct',
    recommendedValue: 0.80,
    reasoning: 'Oracle: 0.80 reduces false-positive actions 31% while keeping 94% autonomous.',
    computedBy: 'Oracle',
    confidence: 0.90,
  },
  {
    field: 'maxTicketsAutoResolve',
    recommendedValue: 150,
    reasoning: 'Nexus: L1 auto-resolution is 87% CSAT 4.2+. Safe to raise to 150/day.',
    computedBy: 'Nexus',
    confidence: 0.83,
  },
];

export function loadThresholds(): CEOThresholds {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_THRESHOLDS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { ...DEFAULT_THRESHOLDS };
}

export function saveThresholds(thresholds: CEOThresholds): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(thresholds));
  // Broadcast to all tabs/components
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: STORAGE_KEY,
      newValue: JSON.stringify(thresholds),
    }),
  );
}

export function applyAgentRecommendations(current: CEOThresholds): CEOThresholds {
  const patched = { ...current };
  for (const rec of AGENT_RECOMMENDATIONS) {
    if (typeof rec.recommendedValue === 'number') {
      (patched as Record<string, unknown>)[rec.field] = rec.recommendedValue;
    }
  }
  return patched;
}

export function resetToDefaults(): CEOThresholds {
  saveThresholds(DEFAULT_THRESHOLDS);
  return { ...DEFAULT_THRESHOLDS };
}
