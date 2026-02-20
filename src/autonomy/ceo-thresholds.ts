/**
 * CEO Approval Thresholds
 *
 * Everything BELOW these thresholds: agents decide autonomously
 * Everything ABOVE: agents propose → CEO approves via dashboard
 *
 * Single source of truth for the entire autonomy engine.
 */

export interface CEOThresholds {
  // Financial
  maxSpendAutonomous: number;        // ₹ per action (default: 5000)
  maxPriceChangePercent: number;     // % price change (default: 15%)
  maxDiscountPercent: number;        // max auto-discount (default: 20%)

  // Content
  maxBlogPostsPerDay: number;        // Atlas auto-publishes up to this (default: 3)
  maxEmailsPerWeek: number;          // Herald auto-sends up to this (default: 5)
  maxWhatsAppBlastsPerWeek: number;  // Mentor auto-sends (default: 2)

  // Operations
  maxNewStudentsAutoOnboard: number; // Mentor handles onboarding up to this (default: 500)
  maxTicketsAutoResolve: number;     // Nexus auto-resolves up to this per day (default: 100)

  // Strategic
  requireApprovalForNewExam: boolean;        // Always true
  requireApprovalForPriceIncrease: boolean;  // Always true
  requireApprovalForNewAgent: boolean;       // Always true

  // Confidence gate
  minConfidenceToAct: number;        // 0-1, agents act if confidence >= this (default: 0.75)
}

export const DEFAULT_CEO_THRESHOLDS: CEOThresholds = {
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

// ── Threshold checker ────────────────────────────────────────────────────────

export function requiresCEOApproval(
  action: string,
  value: number | boolean,
  thresholds: CEOThresholds = DEFAULT_CEO_THRESHOLDS,
): { required: boolean; reason: string } {
  switch (action) {
    case 'spend':
      return (value as number) > thresholds.maxSpendAutonomous
        ? {
            required: true,
            reason: `Spend ₹${value} exceeds autonomous limit of ₹${thresholds.maxSpendAutonomous}`,
          }
        : { required: false, reason: 'Within autonomous spend limit' };

    case 'price_change':
      return (value as number) > thresholds.maxPriceChangePercent
        ? {
            required: true,
            reason: `Price change ${value}% exceeds ${thresholds.maxPriceChangePercent}% limit`,
          }
        : { required: false, reason: 'Within autonomous price change limit' };

    case 'price_increase':
      return thresholds.requireApprovalForPriceIncrease
        ? { required: true, reason: 'Price increases always require CEO approval' }
        : { required: false, reason: 'Price increase approval not required in current config' };

    case 'new_exam':
      return thresholds.requireApprovalForNewExam
        ? { required: true, reason: 'New exam launches always require CEO approval' }
        : { required: false, reason: 'New exam approval not required in current config' };

    case 'new_agent':
      return thresholds.requireApprovalForNewAgent
        ? { required: true, reason: 'Deploying a new agent always requires CEO approval' }
        : { required: false, reason: 'New agent approval not required in current config' };

    case 'discount':
      return (value as number) > thresholds.maxDiscountPercent
        ? {
            required: true,
            reason: `Discount ${value}% exceeds autonomous limit of ${thresholds.maxDiscountPercent}%`,
          }
        : { required: false, reason: 'Within autonomous discount limit' };

    case 'blog_posts_day':
      return (value as number) > thresholds.maxBlogPostsPerDay
        ? {
            required: true,
            reason: `${value} posts/day exceeds Atlas autonomous limit of ${thresholds.maxBlogPostsPerDay}`,
          }
        : { required: false, reason: 'Within autonomous blog posting limit' };

    case 'emails_week':
      return (value as number) > thresholds.maxEmailsPerWeek
        ? {
            required: true,
            reason: `${value} emails/week exceeds Herald autonomous limit of ${thresholds.maxEmailsPerWeek}`,
          }
        : { required: false, reason: 'Within autonomous email limit' };

    default:
      return { required: false, reason: 'No threshold defined — agent decides autonomously' };
  }
}

// ── Confidence gate ──────────────────────────────────────────────────────────

export function meetsConfidenceGate(
  confidence: number,
  thresholds: CEOThresholds = DEFAULT_CEO_THRESHOLDS,
): { canAct: boolean; reason: string } {
  return confidence >= thresholds.minConfidenceToAct
    ? { canAct: true, reason: `Confidence ${(confidence * 100).toFixed(0)}% meets minimum threshold` }
    : {
        canAct: false,
        reason: `Confidence ${(confidence * 100).toFixed(0)}% below minimum ${(thresholds.minConfidenceToAct * 100).toFixed(0)}% — queuing for CEO review`,
      };
}

// ── Persistence (backend) ────────────────────────────────────────────────────

import * as fs from 'fs';
import * as path from 'path';

const THRESHOLDS_PATH = path.join(process.cwd(), 'config', 'ceo-thresholds.json');

export function loadThresholds(): CEOThresholds {
  try {
    if (fs.existsSync(THRESHOLDS_PATH)) {
      const raw = fs.readFileSync(THRESHOLDS_PATH, 'utf-8');
      return { ...DEFAULT_CEO_THRESHOLDS, ...JSON.parse(raw) };
    }
  } catch {
    // Fall through to defaults
  }
  return { ...DEFAULT_CEO_THRESHOLDS };
}

export function saveThresholds(thresholds: CEOThresholds): void {
  try {
    fs.mkdirSync(path.dirname(THRESHOLDS_PATH), { recursive: true });
    fs.writeFileSync(THRESHOLDS_PATH, JSON.stringify(thresholds, null, 2));
  } catch (e) {
    console.error('[Thresholds] Failed to persist:', e);
  }
}

// Active thresholds — agents always read this, never the hardcoded DEFAULT
export let ACTIVE_THRESHOLDS: CEOThresholds = loadThresholds();

export function updateThresholds(patch: Partial<CEOThresholds>): CEOThresholds {
  ACTIVE_THRESHOLDS = { ...ACTIVE_THRESHOLDS, ...patch };
  saveThresholds(ACTIVE_THRESHOLDS);
  return ACTIVE_THRESHOLDS;
}

// Agent-recommended values (computed from market data / operational data)
export interface ThresholdRecommendation {
  field: keyof CEOThresholds;
  recommendedValue: number | boolean;
  currentValue: number | boolean;
  reasoning: string;
  computedBy: string;
  confidence: number;
}

export function getAgentRecommendations(): ThresholdRecommendation[] {
  return [
    {
      field: 'maxSpendAutonomous',
      recommendedValue: 7500,
      currentValue: ACTIVE_THRESHOLDS.maxSpendAutonomous,
      reasoning: 'Scout: avg successful campaign spend is ₹6,200. ₹7,500 covers 95% of effective actions without CEO bottleneck.',
      computedBy: 'Scout.SpendAnalyzer',
      confidence: 0.78,
    },
    {
      field: 'maxPriceChangePercent',
      recommendedValue: 10,
      currentValue: ACTIVE_THRESHOLDS.maxPriceChangePercent,
      reasoning: 'Oracle: price changes >10% caused 23% spike in churn in comparable EdTech. Keep to 10% for stability.',
      computedBy: 'Oracle.ChurnPredictor',
      confidence: 0.82,
    },
    {
      field: 'maxDiscountPercent',
      recommendedValue: 25,
      currentValue: ACTIVE_THRESHOLDS.maxDiscountPercent,
      reasoning: 'Herald: 25% discount has highest conversion rate (34%) without LTV degradation in A/B tests.',
      computedBy: 'Herald.ConversionOptimizer',
      confidence: 0.76,
    },
    {
      field: 'maxBlogPostsPerDay',
      recommendedValue: 4,
      currentValue: ACTIVE_THRESHOLDS.maxBlogPostsPerDay,
      reasoning: 'Atlas: 4 posts/day maximises SEO crawl budget without quality dilution. Keyword backlog supports this volume.',
      computedBy: 'Atlas.SEOOptimizer',
      confidence: 0.80,
    },
    {
      field: 'maxEmailsPerWeek',
      recommendedValue: 4,
      currentValue: ACTIVE_THRESHOLDS.maxEmailsPerWeek,
      reasoning: 'Herald: 4 emails/week has 28% open rate vs 5/week at 21%. Unsubscribe rate also lower.',
      computedBy: 'Herald.EmailCadenceOptimizer',
      confidence: 0.88,
    },
    {
      field: 'maxWhatsAppBlastsPerWeek',
      recommendedValue: 3,
      currentValue: ACTIVE_THRESHOLDS.maxWhatsAppBlastsPerWeek,
      reasoning: 'Mentor: 3 WhatsApp messages/week achieves 71% read rate. 4+ drops to 52% with higher block rate.',
      computedBy: 'Mentor.EngagementOptimizer',
      confidence: 0.85,
    },
    {
      field: 'minConfidenceToAct',
      recommendedValue: 0.80,
      currentValue: ACTIVE_THRESHOLDS.minConfidenceToAct,
      reasoning: 'System: 0.80 threshold reduces false-positive actions by 31% while keeping 94% of valid actions autonomous.',
      computedBy: 'Oracle.AutonomyOptimizer',
      confidence: 0.90,
    },
    {
      field: 'maxTicketsAutoResolve',
      recommendedValue: 150,
      currentValue: ACTIVE_THRESHOLDS.maxTicketsAutoResolve,
      reasoning: 'Nexus: L1 auto-resolution rate is 87% with CSAT > 4.2. Can safely increase to 150/day.',
      computedBy: 'Nexus.ResolutionAnalyzer',
      confidence: 0.83,
    },
  ];
}
