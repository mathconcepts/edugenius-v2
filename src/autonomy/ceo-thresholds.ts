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
