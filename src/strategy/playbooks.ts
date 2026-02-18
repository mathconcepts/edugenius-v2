/**
 * Pre-built Growth Playbooks
 * Ready-to-execute strategies for common scenarios
 */

import type { GrowthPlaybook, AudienceSegment, StrategyPhase } from './types';

// ============================================================================
// ACQUISITION PLAYBOOKS
// ============================================================================

export const ACQUISITION_PLAYBOOKS: GrowthPlaybook[] = [
  // JEE Aspirant Acquisition
  {
    id: 'pb_jee_acquisition_organic',
    name: 'JEE Organic Acquisition',
    description: 'Capture JEE aspirants through SEO, YouTube, and community',
    phase: 'growth',
    targetSegment: 'aspirants_jee',
    triggers: [
      { type: 'schedule', condition: 'JEE preparation season starts', schedule: '0 0 1 4 *' }, // April 1
      { type: 'metric', condition: 'jee_signup_rate < target', threshold: 0.02 },
    ],
    steps: [
      {
        order: 1,
        action: 'Generate 20 JEE PYQ solution blog posts',
        owner: 'atlas',
        inputs: { examType: 'JEE', contentType: 'pyq_solutions', count: 20 },
        outputs: ['blog_posts'],
        waitForCompletion: true,
        timeout: 86400000, // 24 hours
        onFailure: 'retry',
      },
      {
        order: 2,
        action: 'Create 5 YouTube-ready concept videos',
        owner: 'atlas',
        inputs: { examType: 'JEE', contentType: 'concept_videos', topics: ['calculus', 'mechanics', 'organic'] },
        outputs: ['video_scripts'],
        waitForCompletion: true,
        timeout: 86400000,
        onFailure: 'skip',
      },
      {
        order: 3,
        action: 'Publish content with SEO optimization',
        owner: 'herald',
        inputs: { content: '{{blog_posts}}', seoOptimize: true },
        outputs: ['published_urls'],
        waitForCompletion: true,
        timeout: 3600000,
        onFailure: 'retry',
      },
      {
        order: 4,
        action: 'Share on JEE communities (Reddit, Quora, Telegram)',
        owner: 'herald',
        inputs: { urls: '{{published_urls}}', platforms: ['reddit', 'quora', 'telegram'] },
        outputs: ['social_posts'],
        waitForCompletion: false,
        onFailure: 'skip',
      },
      {
        order: 5,
        action: 'Track and optimize based on performance',
        owner: 'oracle',
        inputs: { trackUrls: '{{published_urls}}', metrics: ['views', 'signups', 'time_on_page'] },
        outputs: ['performance_report'],
        waitForCompletion: false,
        onFailure: 'skip',
      },
    ],
    expectedOutcomes: [
      { metric: 'organic_traffic', improvement: '+50%', timeframe: '30 days' },
      { metric: 'jee_signups', improvement: '+100', timeframe: '30 days' },
      { metric: 'cac', improvement: '-30%', timeframe: '30 days' },
    ],
    automationLevel: 'semi_auto',
    requiresApproval: false,
    timesExecuted: 0,
    successRate: 0,
    avgROI: 0,
  },

  // NEET Aspirant Acquisition
  {
    id: 'pb_neet_acquisition_organic',
    name: 'NEET Organic Acquisition',
    description: 'Capture NEET aspirants through bio/chem content and community',
    phase: 'growth',
    targetSegment: 'aspirants_neet',
    triggers: [
      { type: 'schedule', condition: 'NEET preparation season', schedule: '0 0 1 1 *' }, // January 1
      { type: 'metric', condition: 'neet_signup_rate < target', threshold: 0.02 },
    ],
    steps: [
      {
        order: 1,
        action: 'Generate 30 NEET NCERT-aligned biology content',
        owner: 'atlas',
        inputs: { examType: 'NEET', contentType: 'ncert_notes', subjects: ['biology', 'chemistry'] },
        outputs: ['content_pieces'],
        waitForCompletion: true,
        timeout: 86400000,
        onFailure: 'retry',
      },
      {
        order: 2,
        action: 'Create NEET topic-wise practice tests',
        owner: 'atlas',
        inputs: { examType: 'NEET', contentType: 'practice_tests', count: 10 },
        outputs: ['practice_tests'],
        waitForCompletion: true,
        timeout: 86400000,
        onFailure: 'skip',
      },
      {
        order: 3,
        action: 'Publish with medical entrance keywords',
        owner: 'herald',
        inputs: { content: '{{content_pieces}}', keywords: ['neet 2026', 'mbbs entrance', 'biology notes'] },
        outputs: ['published_urls'],
        waitForCompletion: true,
        timeout: 3600000,
        onFailure: 'retry',
      },
      {
        order: 4,
        action: 'Engage in NEET preparation communities',
        owner: 'herald',
        inputs: { strategy: 'community_engagement', communities: ['neet_subreddit', 'telegram_groups'] },
        outputs: ['engagement_metrics'],
        waitForCompletion: false,
        onFailure: 'skip',
      },
    ],
    expectedOutcomes: [
      { metric: 'neet_organic_traffic', improvement: '+60%', timeframe: '30 days' },
      { metric: 'neet_signups', improvement: '+150', timeframe: '30 days' },
    ],
    automationLevel: 'semi_auto',
    requiresApproval: false,
    timesExecuted: 0,
    successRate: 0,
    avgROI: 0,
  },

  // Paid Acquisition Playbook
  {
    id: 'pb_paid_acquisition_scaling',
    name: 'Paid Acquisition Scaling',
    description: 'Scale paid acquisition when organic hits ceiling',
    phase: 'growth',
    targetSegment: 'aspirants_jee',
    triggers: [
      { type: 'metric', condition: 'organic_growth_rate < 5% AND budget_available', threshold: 0.05 },
      { type: 'manual', condition: 'CEO approved paid scaling' },
    ],
    steps: [
      {
        order: 1,
        action: 'Analyze top-performing organic content',
        owner: 'oracle',
        inputs: { analysis: 'top_content', metrics: ['conversions', 'engagement'] },
        outputs: ['top_content_report'],
        waitForCompletion: true,
        timeout: 1800000,
        onFailure: 'stop',
      },
      {
        order: 2,
        action: 'Create ad creatives from top content',
        owner: 'herald',
        inputs: { sourceContent: '{{top_content_report}}', formats: ['video', 'carousel', 'static'] },
        outputs: ['ad_creatives'],
        waitForCompletion: true,
        timeout: 86400000,
        onFailure: 'retry',
      },
      {
        order: 3,
        action: 'Launch test campaigns with 10% budget',
        owner: 'herald',
        inputs: { creatives: '{{ad_creatives}}', budget: 0.1, platforms: ['google', 'meta', 'youtube'] },
        outputs: ['campaign_ids'],
        waitForCompletion: true,
        timeout: 3600000,
        onFailure: 'stop',
      },
      {
        order: 4,
        action: 'Monitor for 3 days and identify winners',
        owner: 'oracle',
        inputs: { campaigns: '{{campaign_ids}}', duration: 259200000 },
        outputs: ['winner_report'],
        waitForCompletion: true,
        timeout: 259200000,
        onFailure: 'skip',
      },
      {
        order: 5,
        action: 'Scale winners, pause losers',
        owner: 'herald',
        inputs: { winners: '{{winner_report}}', scaleFactor: 3 },
        outputs: ['scaled_campaigns'],
        waitForCompletion: false,
        onFailure: 'skip',
      },
    ],
    expectedOutcomes: [
      { metric: 'paid_signups', improvement: '+200%', timeframe: '14 days' },
      { metric: 'cac', improvement: 'maintained < ₹150', timeframe: '14 days' },
      { metric: 'roas', improvement: '> 3x', timeframe: '30 days' },
    ],
    automationLevel: 'semi_auto',
    requiresApproval: true,
    timesExecuted: 0,
    successRate: 0,
    avgROI: 0,
  },
];

// ============================================================================
// ACTIVATION PLAYBOOKS
// ============================================================================

export const ACTIVATION_PLAYBOOKS: GrowthPlaybook[] = [
  // Onboarding Optimization
  {
    id: 'pb_onboarding_optimization',
    name: 'Onboarding Flow Optimization',
    description: 'Improve activation rate by optimizing first-time user experience',
    phase: 'optimization',
    targetSegment: 'aspirants_jee',
    triggers: [
      { type: 'metric', condition: 'activation_rate < 30%', threshold: 0.3 },
      { type: 'metric', condition: 'day1_retention < 40%', threshold: 0.4 },
    ],
    steps: [
      {
        order: 1,
        action: 'Analyze drop-off points in onboarding',
        owner: 'oracle',
        inputs: { funnel: 'onboarding', metrics: ['drop_off', 'time_spent', 'completion'] },
        outputs: ['funnel_analysis'],
        waitForCompletion: true,
        timeout: 3600000,
        onFailure: 'stop',
      },
      {
        order: 2,
        action: 'Create personalized onboarding paths by exam type',
        owner: 'sage',
        inputs: { analysis: '{{funnel_analysis}}', examTypes: ['JEE', 'NEET', 'CBSE'] },
        outputs: ['onboarding_variants'],
        waitForCompletion: true,
        timeout: 86400000,
        onFailure: 'retry',
      },
      {
        order: 3,
        action: 'Setup A/B test for onboarding variants',
        owner: 'oracle',
        inputs: { variants: '{{onboarding_variants}}', splitRatio: 0.5 },
        outputs: ['experiment_id'],
        waitForCompletion: true,
        timeout: 3600000,
        onFailure: 'stop',
      },
      {
        order: 4,
        action: 'Run experiment for 7 days',
        owner: 'oracle',
        inputs: { experimentId: '{{experiment_id}}', duration: 604800000 },
        outputs: ['experiment_results'],
        waitForCompletion: true,
        timeout: 604800000,
        onFailure: 'skip',
      },
      {
        order: 5,
        action: 'Roll out winning variant',
        owner: 'forge',
        inputs: { winner: '{{experiment_results}}', rolloutPercentage: 100 },
        outputs: ['rollout_status'],
        waitForCompletion: false,
        onFailure: 'skip',
      },
    ],
    expectedOutcomes: [
      { metric: 'activation_rate', improvement: '+10%', timeframe: '14 days' },
      { metric: 'day1_retention', improvement: '+15%', timeframe: '14 days' },
      { metric: 'time_to_aha', improvement: '-30%', timeframe: '7 days' },
    ],
    automationLevel: 'semi_auto',
    requiresApproval: true,
    timesExecuted: 0,
    successRate: 0,
    avgROI: 0,
  },

  // Aha Moment Acceleration
  {
    id: 'pb_aha_moment_acceleration',
    name: 'Aha Moment Acceleration',
    description: 'Get users to their first success moment faster',
    phase: 'optimization',
    targetSegment: 'aspirants_jee',
    triggers: [
      { type: 'metric', condition: 'time_to_first_success > 10 minutes', threshold: 600 },
    ],
    steps: [
      {
        order: 1,
        action: 'Identify aha moment from successful users',
        owner: 'oracle',
        inputs: { cohort: 'retained_users', lookback: 30 },
        outputs: ['aha_moment_analysis'],
        waitForCompletion: true,
        timeout: 7200000,
        onFailure: 'stop',
      },
      {
        order: 2,
        action: 'Create guided path to aha moment',
        owner: 'sage',
        inputs: { ahaMoment: '{{aha_moment_analysis}}' },
        outputs: ['guided_path'],
        waitForCompletion: true,
        timeout: 86400000,
        onFailure: 'retry',
      },
      {
        order: 3,
        action: 'Implement progressive disclosure',
        owner: 'forge',
        inputs: { path: '{{guided_path}}' },
        outputs: ['feature_flag'],
        waitForCompletion: true,
        timeout: 86400000,
        onFailure: 'stop',
      },
      {
        order: 4,
        action: 'Add contextual nudges',
        owner: 'mentor',
        inputs: { triggers: ['idle_30s', 'confusion_detected', 'wrong_path'] },
        outputs: ['nudge_config'],
        waitForCompletion: false,
        onFailure: 'skip',
      },
    ],
    expectedOutcomes: [
      { metric: 'time_to_first_success', improvement: '-50%', timeframe: '7 days' },
      { metric: 'first_session_completion', improvement: '+25%', timeframe: '7 days' },
    ],
    automationLevel: 'semi_auto',
    requiresApproval: true,
    timesExecuted: 0,
    successRate: 0,
    avgROI: 0,
  },
];

// ============================================================================
// RETENTION PLAYBOOKS
// ============================================================================

export const RETENTION_PLAYBOOKS: GrowthPlaybook[] = [
  // Churn Prevention
  {
    id: 'pb_churn_prevention',
    name: 'Proactive Churn Prevention',
    description: 'Identify and save at-risk users before they churn',
    phase: 'optimization',
    targetSegment: 'aspirants_jee',
    triggers: [
      { type: 'metric', condition: 'weekly_active_users declining', threshold: -0.05 },
      { type: 'event', condition: 'churn_risk_score > 0.7' },
    ],
    steps: [
      {
        order: 1,
        action: 'Identify users with high churn risk',
        owner: 'oracle',
        inputs: { threshold: 0.7, lookback: 7 },
        outputs: ['at_risk_users'],
        waitForCompletion: true,
        timeout: 1800000,
        onFailure: 'stop',
      },
      {
        order: 2,
        action: 'Segment by churn reason',
        owner: 'oracle',
        inputs: { users: '{{at_risk_users}}', analysis: 'churn_reasons' },
        outputs: ['segmented_users'],
        waitForCompletion: true,
        timeout: 3600000,
        onFailure: 'retry',
      },
      {
        order: 3,
        action: 'Trigger personalized win-back campaigns',
        owner: 'mentor',
        inputs: { segments: '{{segmented_users}}', campaigns: ['value_reminder', 'special_offer', 'personal_help'] },
        outputs: ['campaign_results'],
        waitForCompletion: false,
        onFailure: 'skip',
      },
      {
        order: 4,
        action: 'High-value user personal outreach',
        owner: 'mentor',
        inputs: { users: '{{segmented_users.high_value}}', method: 'personal_email' },
        outputs: ['outreach_results'],
        waitForCompletion: false,
        onFailure: 'skip',
      },
    ],
    expectedOutcomes: [
      { metric: 'churn_rate', improvement: '-20%', timeframe: '30 days' },
      { metric: 'saved_users', improvement: '+30%', timeframe: '30 days' },
    ],
    automationLevel: 'full_auto',
    requiresApproval: false,
    timesExecuted: 0,
    successRate: 0,
    avgROI: 0,
  },

  // Re-engagement Campaign
  {
    id: 'pb_reengagement',
    name: 'Dormant User Re-engagement',
    description: 'Bring back users who haven\'t been active in 7+ days',
    phase: 'optimization',
    targetSegment: 'aspirants_jee',
    triggers: [
      { type: 'schedule', condition: 'Weekly re-engagement check', schedule: '0 9 * * 1' }, // Every Monday 9 AM
    ],
    steps: [
      {
        order: 1,
        action: 'Find dormant users (7-30 days inactive)',
        owner: 'oracle',
        inputs: { inactiveDays: { min: 7, max: 30 } },
        outputs: ['dormant_users'],
        waitForCompletion: true,
        timeout: 1800000,
        onFailure: 'stop',
      },
      {
        order: 2,
        action: 'Generate personalized content recommendations',
        owner: 'sage',
        inputs: { users: '{{dormant_users}}', type: 'missed_content' },
        outputs: ['recommendations'],
        waitForCompletion: true,
        timeout: 3600000,
        onFailure: 'retry',
      },
      {
        order: 3,
        action: 'Send multi-channel re-engagement',
        owner: 'herald',
        inputs: { 
          users: '{{dormant_users}}', 
          content: '{{recommendations}}',
          channels: ['email', 'push', 'whatsapp'] 
        },
        outputs: ['message_results'],
        waitForCompletion: false,
        onFailure: 'skip',
      },
    ],
    expectedOutcomes: [
      { metric: 'reactivation_rate', improvement: '+15%', timeframe: '7 days' },
      { metric: 'dormant_to_active', improvement: '+50 users', timeframe: '7 days' },
    ],
    automationLevel: 'full_auto',
    requiresApproval: false,
    timesExecuted: 0,
    successRate: 0,
    avgROI: 0,
  },
];

// ============================================================================
// MONETIZATION PLAYBOOKS
// ============================================================================

export const MONETIZATION_PLAYBOOKS: GrowthPlaybook[] = [
  // Free to Paid Conversion
  {
    id: 'pb_free_to_paid',
    name: 'Free to Paid Conversion',
    description: 'Convert engaged free users to paid subscriptions',
    phase: 'optimization',
    targetSegment: 'aspirants_jee',
    triggers: [
      { type: 'metric', condition: 'free_to_paid_rate < 5%', threshold: 0.05 },
      { type: 'event', condition: 'user_hit_free_limit' },
    ],
    steps: [
      {
        order: 1,
        action: 'Identify high-intent free users',
        owner: 'oracle',
        inputs: { criteria: ['high_engagement', 'limit_hits', 'feature_interest'] },
        outputs: ['high_intent_users'],
        waitForCompletion: true,
        timeout: 1800000,
        onFailure: 'stop',
      },
      {
        order: 2,
        action: 'Create personalized upgrade offers',
        owner: 'sage',
        inputs: { users: '{{high_intent_users}}', offers: ['discount', 'trial_extension', 'feature_unlock'] },
        outputs: ['upgrade_offers'],
        waitForCompletion: true,
        timeout: 3600000,
        onFailure: 'retry',
      },
      {
        order: 3,
        action: 'Deliver offers at optimal moments',
        owner: 'mentor',
        inputs: { offers: '{{upgrade_offers}}', timing: 'optimal' },
        outputs: ['delivery_results'],
        waitForCompletion: false,
        onFailure: 'skip',
      },
      {
        order: 4,
        action: 'Track conversion and iterate',
        owner: 'oracle',
        inputs: { deliveries: '{{delivery_results}}', metrics: ['conversion', 'revenue'] },
        outputs: ['conversion_report'],
        waitForCompletion: false,
        onFailure: 'skip',
      },
    ],
    expectedOutcomes: [
      { metric: 'free_to_paid_rate', improvement: '+2%', timeframe: '30 days' },
      { metric: 'mrr', improvement: '+₹50,000', timeframe: '30 days' },
    ],
    automationLevel: 'semi_auto',
    requiresApproval: false,
    timesExecuted: 0,
    successRate: 0,
    avgROI: 0,
  },

  // Upsell to Higher Tier
  {
    id: 'pb_upsell_higher_tier',
    name: 'Upsell to Higher Tier',
    description: 'Move paid users to higher subscription tiers',
    phase: 'optimization',
    targetSegment: 'aspirants_jee',
    triggers: [
      { type: 'metric', condition: 'avg_revenue_per_user stagnant' },
      { type: 'event', condition: 'user_approaching_plan_limit' },
    ],
    steps: [
      {
        order: 1,
        action: 'Find users hitting plan limits',
        owner: 'oracle',
        inputs: { threshold: 0.8, metrics: ['questions_asked', 'features_used'] },
        outputs: ['limit_users'],
        waitForCompletion: true,
        timeout: 1800000,
        onFailure: 'stop',
      },
      {
        order: 2,
        action: 'Calculate value of upgrade for each user',
        owner: 'sage',
        inputs: { users: '{{limit_users}}' },
        outputs: ['value_propositions'],
        waitForCompletion: true,
        timeout: 3600000,
        onFailure: 'retry',
      },
      {
        order: 3,
        action: 'Present upgrade with social proof',
        owner: 'mentor',
        inputs: { propositions: '{{value_propositions}}', includeTestimonials: true },
        outputs: ['presentation_results'],
        waitForCompletion: false,
        onFailure: 'skip',
      },
    ],
    expectedOutcomes: [
      { metric: 'arpu', improvement: '+15%', timeframe: '30 days' },
      { metric: 'plan_upgrades', improvement: '+20', timeframe: '30 days' },
    ],
    automationLevel: 'semi_auto',
    requiresApproval: false,
    timesExecuted: 0,
    successRate: 0,
    avgROI: 0,
  },
];

// ============================================================================
// COMPETITIVE RESPONSE PLAYBOOKS
// ============================================================================

export const COMPETITIVE_PLAYBOOKS: GrowthPlaybook[] = [
  // Competitor Price Drop Response
  {
    id: 'pb_competitor_price_response',
    name: 'Competitor Price Drop Response',
    description: 'Respond to competitor pricing changes',
    phase: 'growth',
    targetSegment: 'aspirants_jee',
    triggers: [
      { type: 'event', condition: 'competitor_price_drop detected' },
    ],
    steps: [
      {
        order: 1,
        action: 'Analyze competitor pricing change',
        owner: 'scout',
        inputs: { competitor: '{{trigger.competitor}}', analysis: 'pricing_impact' },
        outputs: ['pricing_analysis'],
        waitForCompletion: true,
        timeout: 3600000,
        onFailure: 'stop',
      },
      {
        order: 2,
        action: 'Generate response options',
        owner: 'strategy',
        inputs: { analysis: '{{pricing_analysis}}' },
        outputs: ['response_options'],
        waitForCompletion: true,
        timeout: 7200000,
        onFailure: 'stop',
      },
      {
        order: 3,
        action: 'Present to CEO for decision',
        owner: 'strategy',
        inputs: { options: '{{response_options}}', urgency: 'high' },
        outputs: ['ceo_decision'],
        waitForCompletion: true,
        timeout: 86400000,
        onFailure: 'stop',
      },
      {
        order: 4,
        action: 'Execute chosen response',
        owner: 'herald',
        inputs: { decision: '{{ceo_decision}}' },
        outputs: ['execution_status'],
        waitForCompletion: false,
        onFailure: 'retry',
      },
    ],
    expectedOutcomes: [
      { metric: 'market_share', improvement: 'maintained', timeframe: '30 days' },
      { metric: 'churn_to_competitor', improvement: '<5%', timeframe: '30 days' },
    ],
    automationLevel: 'manual',
    requiresApproval: true,
    timesExecuted: 0,
    successRate: 0,
    avgROI: 0,
  },

  // Feature Parity Response
  {
    id: 'pb_feature_parity_response',
    name: 'Feature Parity Response',
    description: 'Respond when competitor launches similar feature',
    phase: 'growth',
    targetSegment: 'aspirants_jee',
    triggers: [
      { type: 'event', condition: 'competitor_feature_launch detected' },
    ],
    steps: [
      {
        order: 1,
        action: 'Analyze competitor feature',
        owner: 'scout',
        inputs: { feature: '{{trigger.feature}}', depth: 'detailed' },
        outputs: ['feature_analysis'],
        waitForCompletion: true,
        timeout: 7200000,
        onFailure: 'stop',
      },
      {
        order: 2,
        action: 'Identify our differentiation',
        owner: 'strategy',
        inputs: { theirFeature: '{{feature_analysis}}', ourFeatures: 'current' },
        outputs: ['differentiation_report'],
        waitForCompletion: true,
        timeout: 7200000,
        onFailure: 'retry',
      },
      {
        order: 3,
        action: 'Create comparison content',
        owner: 'herald',
        inputs: { differentiation: '{{differentiation_report}}', format: 'blog_social' },
        outputs: ['comparison_content'],
        waitForCompletion: true,
        timeout: 86400000,
        onFailure: 'skip',
      },
      {
        order: 4,
        action: 'Push comparison to all channels',
        owner: 'herald',
        inputs: { content: '{{comparison_content}}', priority: 'high' },
        outputs: ['distribution_results'],
        waitForCompletion: false,
        onFailure: 'skip',
      },
    ],
    expectedOutcomes: [
      { metric: 'brand_sentiment', improvement: 'maintained', timeframe: '14 days' },
      { metric: 'comparison_searches', improvement: 'captured', timeframe: '7 days' },
    ],
    automationLevel: 'semi_auto',
    requiresApproval: true,
    timesExecuted: 0,
    successRate: 0,
    avgROI: 0,
  },
];

// ============================================================================
// EXPORT ALL PLAYBOOKS
// ============================================================================

export const ALL_PLAYBOOKS: GrowthPlaybook[] = [
  ...ACQUISITION_PLAYBOOKS,
  ...ACTIVATION_PLAYBOOKS,
  ...RETENTION_PLAYBOOKS,
  ...MONETIZATION_PLAYBOOKS,
  ...COMPETITIVE_PLAYBOOKS,
];

// Get playbooks by phase
export function getPlaybooksByPhase(phase: StrategyPhase): GrowthPlaybook[] {
  return ALL_PLAYBOOKS.filter(p => p.phase === phase);
}

// Get playbooks by segment
export function getPlaybooksBySegment(segment: AudienceSegment): GrowthPlaybook[] {
  return ALL_PLAYBOOKS.filter(p => p.targetSegment === segment);
}

// Get playbooks that can run automatically
export function getAutoPlaybooks(): GrowthPlaybook[] {
  return ALL_PLAYBOOKS.filter(p => p.automationLevel !== 'manual' && !p.requiresApproval);
}
