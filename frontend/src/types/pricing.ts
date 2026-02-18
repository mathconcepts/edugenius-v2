/**
 * Pricing & Freemium Model Types
 * 
 * CEO-configurable pricing system with:
 * - Multiple pricing tiers
 * - Feature gates
 * - Usage limits
 * - Exam-specific configurations
 * - A/B testing for pricing
 */

// ============================================
// PRICING TIERS
// ============================================

export type PricingTier = 'free' | 'starter' | 'pro' | 'unlimited' | 'enterprise';

export interface PricingPlan {
  id: string;
  tier: PricingTier;
  name: string;
  tagline: string;
  description: string;
  
  // Pricing
  pricing: PlanPricing;
  
  // Features & Limits
  features: PlanFeatures;
  limits: PlanLimits;
  
  // Display
  isPopular: boolean;
  isHidden: boolean;
  badge?: string;
  color: string;
  
  // Availability
  availableForExams: string[];  // Empty = all exams
  availableRegions: string[];   // Empty = all regions
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface PlanPricing {
  // Base pricing
  monthlyPrice: number;
  yearlyPrice: number;
  currency: 'INR' | 'USD';
  
  // Discounts
  yearlyDiscount: number;        // Percentage
  firstMonthDiscount?: number;
  referralDiscount?: number;
  
  // Trial
  trialDays: number;
  trialRequiresCard: boolean;
  
  // Special pricing
  studentDiscount?: number;      // With valid student ID
  groupDiscount?: {
    minUsers: number;
    discountPercent: number;
  }[];
}

export interface PlanFeatures {
  // AI Tutoring
  aiTutoringEnabled: boolean;
  learningModes: LearningModeAccess;
  voiceInputEnabled: boolean;
  imageInputEnabled: boolean;
  
  // Content
  subjectsIncluded: string[];    // Empty = all
  topicsIncluded: string[];      // Empty = all
  pyqAccess: boolean;
  mockTestsIncluded: number;     // -1 = unlimited
  
  // Notebook
  smartNotebookEnabled: boolean;
  notebookExportFormats: string[];
  revisionSchedulerEnabled: boolean;
  
  // Resources
  interactiveSimulations: boolean;
  videoExplanations: boolean;
  downloadableContent: boolean;
  
  // Channels
  webAccess: boolean;
  whatsappAccess: boolean;
  telegramAccess: boolean;
  
  // Support
  supportLevel: 'community' | 'email' | 'priority' | 'dedicated';
  liveTutoringMinutes: number;   // Per month, 0 = none
  
  // Analytics
  progressAnalytics: boolean;
  performancePrediction: boolean;
  weakAreaAnalysis: boolean;
  
  // Extras
  adsEnabled: boolean;
  watermarkEnabled: boolean;
  customBranding: boolean;
}

export interface LearningModeAccess {
  deep_learning: boolean;
  exam_prep: boolean;
  revision: boolean;
  practice: boolean;
  doubt_clearing: boolean;
  quick_reference: boolean;
}

export interface PlanLimits {
  // AI Usage
  dailyQuestions: number;        // -1 = unlimited
  monthlyQuestions: number;      // -1 = unlimited
  questionsPerSession: number;   // -1 = unlimited
  
  // Response quality
  maxResponseLength: 'short' | 'medium' | 'long' | 'unlimited';
  includeStepByStep: boolean;
  includeVisuals: boolean;
  
  // Storage
  notebookEntriesLimit: number;  // -1 = unlimited
  savedProblemsLimit: number;
  
  // Practice
  dailyPracticeProblems: number;
  mockTestsPerMonth: number;
  
  // Time
  sessionTimeoutMinutes: number;
  
  // Rate limits
  requestsPerMinute: number;
  requestsPerHour: number;
}

// ============================================
// FEATURE GATES
// ============================================

export interface FeatureGate {
  id: string;
  featureKey: string;
  displayName: string;
  description: string;
  
  // Gate configuration
  gateType: 'boolean' | 'limit' | 'tier_minimum';
  
  // For boolean gates
  enabledTiers?: PricingTier[];
  
  // For limit gates
  limitByTier?: Record<PricingTier, number>;
  
  // For tier minimum
  minimumTier?: PricingTier;
  
  // Upgrade prompts
  upgradePrompt: string;
  upgradeCTA: string;
  
  // Analytics
  gateHitCount: number;
  conversionRate: number;
}

export const defaultFeatureGates: FeatureGate[] = [
  {
    id: 'gate_daily_questions',
    featureKey: 'daily_questions',
    displayName: 'Daily AI Questions',
    description: 'Number of questions you can ask per day',
    gateType: 'limit',
    limitByTier: {
      free: 10,
      starter: 50,
      pro: 200,
      unlimited: -1,
      enterprise: -1,
    },
    upgradePrompt: 'You\'ve used all your questions for today',
    upgradeCTA: 'Upgrade for more questions',
    gateHitCount: 0,
    conversionRate: 0,
  },
  {
    id: 'gate_exam_prep_mode',
    featureKey: 'exam_prep_mode',
    displayName: 'Exam Prep Mode',
    description: 'Quick tips and shortcuts for exams',
    gateType: 'tier_minimum',
    minimumTier: 'starter',
    upgradePrompt: 'Exam Prep Mode is a premium feature',
    upgradeCTA: 'Unlock Exam Tips',
    gateHitCount: 0,
    conversionRate: 0,
  },
  {
    id: 'gate_interactive_simulations',
    featureKey: 'interactive_simulations',
    displayName: 'Interactive Simulations',
    description: 'PhET, GeoGebra, Wolfram simulations',
    gateType: 'boolean',
    enabledTiers: ['starter', 'pro', 'unlimited', 'enterprise'],
    upgradePrompt: 'Simulations help you visualize concepts',
    upgradeCTA: 'Get Access to 50+ Simulations',
    gateHitCount: 0,
    conversionRate: 0,
  },
  {
    id: 'gate_whatsapp',
    featureKey: 'whatsapp_access',
    displayName: 'WhatsApp Tutoring',
    description: 'Ask questions via WhatsApp',
    gateType: 'boolean',
    enabledTiers: ['pro', 'unlimited', 'enterprise'],
    upgradePrompt: 'Study on WhatsApp anytime',
    upgradeCTA: 'Enable WhatsApp Access',
    gateHitCount: 0,
    conversionRate: 0,
  },
  {
    id: 'gate_pyq',
    featureKey: 'pyq_access',
    displayName: 'Previous Year Questions',
    description: 'Access to all PYQs with solutions',
    gateType: 'boolean',
    enabledTiers: ['starter', 'pro', 'unlimited', 'enterprise'],
    upgradePrompt: 'PYQs are essential for exam prep',
    upgradeCTA: 'Unlock All PYQs',
    gateHitCount: 0,
    conversionRate: 0,
  },
  {
    id: 'gate_mock_tests',
    featureKey: 'mock_tests',
    displayName: 'Mock Tests',
    description: 'Full-length practice tests',
    gateType: 'limit',
    limitByTier: {
      free: 1,
      starter: 5,
      pro: 20,
      unlimited: -1,
      enterprise: -1,
    },
    upgradePrompt: 'Practice with more mock tests',
    upgradeCTA: 'Get Unlimited Mocks',
    gateHitCount: 0,
    conversionRate: 0,
  },
];

// ============================================
// EXAM-SPECIFIC PRICING
// ============================================

export interface ExamPricingConfig {
  examType: string;
  examName: string;
  
  // Custom pricing for this exam
  pricingOverrides?: Partial<Record<PricingTier, Partial<PlanPricing>>>;
  
  // Custom limits
  limitOverrides?: Partial<Record<PricingTier, Partial<PlanLimits>>>;
  
  // Exam-specific features
  additionalFeatures?: string[];
  
  // Launch config
  pilotMode: boolean;
  pilotUserLimit?: number;
  launchDate?: Date;
  
  // Market data (from Scout agent)
  competitorPricing?: CompetitorPrice[];
  recommendedPricing?: number;
  priceElasticity?: number;
}

export interface CompetitorPrice {
  competitor: string;
  planName: string;
  monthlyPrice: number;
  features: string[];
  lastUpdated: Date;
}

// ============================================
// CEO CONFIGURATION INTERFACE
// ============================================

export interface PricingConfiguration {
  // Global settings
  globalSettings: GlobalPricingSettings;
  
  // Plans
  plans: PricingPlan[];
  
  // Feature gates
  featureGates: FeatureGate[];
  
  // Exam-specific configs
  examConfigs: ExamPricingConfig[];
  
  // A/B Tests
  activeTests: PricingABTest[];
  
  // Metadata
  version: string;
  lastUpdatedBy: string;
  lastUpdatedAt: Date;
  publishedAt?: Date;
}

export interface GlobalPricingSettings {
  // Currency
  defaultCurrency: 'INR' | 'USD';
  supportedCurrencies: string[];
  exchangeRates: Record<string, number>;
  
  // Trials
  globalTrialDays: number;
  trialExtensionAllowed: boolean;
  maxTrialExtensions: number;
  
  // Discounts
  maxDiscountPercent: number;
  referralRewardAmount: number;
  referralDiscountPercent: number;
  
  // Billing
  billingCycles: ('monthly' | 'quarterly' | 'yearly')[];
  gracePeriodDays: number;
  
  // Freemium
  freemiumEnabled: boolean;
  freemiumConversionTarget: number;  // Target % to convert
  
  // Display
  showComparisonTable: boolean;
  showMonthlyByDefault: boolean;
  highlightSavings: boolean;
}

export interface PricingABTest {
  id: string;
  name: string;
  description: string;
  
  // Variants
  controlPlan: string;  // Plan ID
  variantPlans: {
    planId: string;
    trafficPercent: number;
  }[];
  
  // Targeting
  targetExams?: string[];
  targetRegions?: string[];
  targetUserSegments?: string[];
  
  // Status
  status: 'draft' | 'running' | 'paused' | 'completed';
  startDate?: Date;
  endDate?: Date;
  
  // Results
  results?: {
    conversionRates: Record<string, number>;
    revenuePerUser: Record<string, number>;
    statisticalSignificance: number;
    winner?: string;
  };
}

// ============================================
// AGENT CONNECTIONS
// ============================================

export interface PricingAgentConnections {
  // Scout Agent → Pricing
  scout: {
    providesCompetitorPricing: boolean;
    providesMarketTrends: boolean;
    providesPriceElasticity: boolean;
    updateFrequency: 'daily' | 'weekly' | 'monthly';
  };
  
  // Oracle Agent → Pricing
  oracle: {
    providesConversionAnalytics: boolean;
    providesChurnPrediction: boolean;
    providesRevenueForecasts: boolean;
    providesABTestResults: boolean;
  };
  
  // Herald Agent → Pricing
  herald: {
    receivesPricingUpdates: boolean;
    generatesPricingContent: boolean;
    promotesUpgrades: boolean;
  };
  
  // Sage Agent → Pricing
  sage: {
    enforcesFeatureGates: boolean;
    showsUpgradePrompts: boolean;
    tracksUsageLimits: boolean;
  };
  
  // Forge Agent → Pricing
  forge: {
    deploysPaymentIntegration: boolean;
    managesSubscriptions: boolean;
    handlesWebhooks: boolean;
  };
}

// ============================================
// USER SUBSCRIPTION
// ============================================

export interface UserSubscription {
  userId: string;
  
  // Current plan
  planId: string;
  tier: PricingTier;
  
  // Billing
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  
  // Status
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused';
  cancelAtPeriodEnd: boolean;
  
  // Usage
  usage: {
    questionsToday: number;
    questionsThisMonth: number;
    mockTestsThisMonth: number;
    notebookEntries: number;
  };
  
  // Trial
  trialEndsAt?: Date;
  trialExtensionsUsed: number;
  
  // Discounts
  activeDiscounts: {
    type: string;
    percent: number;
    expiresAt?: Date;
  }[];
  
  // A/B Test
  abTestVariant?: string;
  
  // Payment
  paymentMethodId?: string;
  lastPaymentDate?: Date;
  nextBillingDate?: Date;
}

// ============================================
// DEFAULT PLANS
// ============================================

export const defaultPricingPlans: PricingPlan[] = [
  {
    id: 'plan_free',
    tier: 'free',
    name: 'Free',
    tagline: 'Get started with AI tutoring',
    description: 'Perfect for trying out EduGenius',
    pricing: {
      monthlyPrice: 0,
      yearlyPrice: 0,
      currency: 'INR',
      yearlyDiscount: 0,
      trialDays: 0,
      trialRequiresCard: false,
    },
    features: {
      aiTutoringEnabled: true,
      learningModes: {
        deep_learning: true,
        exam_prep: false,
        revision: true,
        practice: true,
        doubt_clearing: true,
        quick_reference: true,
      },
      voiceInputEnabled: false,
      imageInputEnabled: false,
      subjectsIncluded: [],
      topicsIncluded: [],
      pyqAccess: false,
      mockTestsIncluded: 1,
      smartNotebookEnabled: true,
      notebookExportFormats: ['pdf'],
      revisionSchedulerEnabled: false,
      interactiveSimulations: false,
      videoExplanations: false,
      downloadableContent: false,
      webAccess: true,
      whatsappAccess: false,
      telegramAccess: false,
      supportLevel: 'community',
      liveTutoringMinutes: 0,
      progressAnalytics: true,
      performancePrediction: false,
      weakAreaAnalysis: false,
      adsEnabled: true,
      watermarkEnabled: true,
      customBranding: false,
    },
    limits: {
      dailyQuestions: 10,
      monthlyQuestions: 200,
      questionsPerSession: 20,
      maxResponseLength: 'medium',
      includeStepByStep: true,
      includeVisuals: false,
      notebookEntriesLimit: 100,
      savedProblemsLimit: 50,
      dailyPracticeProblems: 10,
      mockTestsPerMonth: 1,
      sessionTimeoutMinutes: 30,
      requestsPerMinute: 5,
      requestsPerHour: 50,
    },
    isPopular: false,
    isHidden: false,
    color: 'gray',
    availableForExams: [],
    availableRegions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
  },
  {
    id: 'plan_starter',
    tier: 'starter',
    name: 'Starter',
    tagline: 'For serious learners',
    description: 'Everything you need to ace your exams',
    pricing: {
      monthlyPrice: 299,
      yearlyPrice: 2499,
      currency: 'INR',
      yearlyDiscount: 30,
      trialDays: 7,
      trialRequiresCard: false,
      firstMonthDiscount: 50,
    },
    features: {
      aiTutoringEnabled: true,
      learningModes: {
        deep_learning: true,
        exam_prep: true,
        revision: true,
        practice: true,
        doubt_clearing: true,
        quick_reference: true,
      },
      voiceInputEnabled: true,
      imageInputEnabled: true,
      subjectsIncluded: [],
      topicsIncluded: [],
      pyqAccess: true,
      mockTestsIncluded: 5,
      smartNotebookEnabled: true,
      notebookExportFormats: ['pdf', 'docx'],
      revisionSchedulerEnabled: true,
      interactiveSimulations: true,
      videoExplanations: true,
      downloadableContent: false,
      webAccess: true,
      whatsappAccess: false,
      telegramAccess: true,
      supportLevel: 'email',
      liveTutoringMinutes: 0,
      progressAnalytics: true,
      performancePrediction: true,
      weakAreaAnalysis: true,
      adsEnabled: false,
      watermarkEnabled: false,
      customBranding: false,
    },
    limits: {
      dailyQuestions: 50,
      monthlyQuestions: 1000,
      questionsPerSession: 50,
      maxResponseLength: 'long',
      includeStepByStep: true,
      includeVisuals: true,
      notebookEntriesLimit: 500,
      savedProblemsLimit: 200,
      dailyPracticeProblems: 30,
      mockTestsPerMonth: 5,
      sessionTimeoutMinutes: 60,
      requestsPerMinute: 10,
      requestsPerHour: 100,
    },
    isPopular: true,
    isHidden: false,
    badge: 'Most Popular',
    color: 'primary',
    availableForExams: [],
    availableRegions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
  },
  {
    id: 'plan_pro',
    tier: 'pro',
    name: 'Pro',
    tagline: 'For JEE/NEET toppers',
    description: 'Maximum preparation power',
    pricing: {
      monthlyPrice: 599,
      yearlyPrice: 4999,
      currency: 'INR',
      yearlyDiscount: 30,
      trialDays: 7,
      trialRequiresCard: true,
    },
    features: {
      aiTutoringEnabled: true,
      learningModes: {
        deep_learning: true,
        exam_prep: true,
        revision: true,
        practice: true,
        doubt_clearing: true,
        quick_reference: true,
      },
      voiceInputEnabled: true,
      imageInputEnabled: true,
      subjectsIncluded: [],
      topicsIncluded: [],
      pyqAccess: true,
      mockTestsIncluded: 20,
      smartNotebookEnabled: true,
      notebookExportFormats: ['pdf', 'docx', 'notion'],
      revisionSchedulerEnabled: true,
      interactiveSimulations: true,
      videoExplanations: true,
      downloadableContent: true,
      webAccess: true,
      whatsappAccess: true,
      telegramAccess: true,
      supportLevel: 'priority',
      liveTutoringMinutes: 30,
      progressAnalytics: true,
      performancePrediction: true,
      weakAreaAnalysis: true,
      adsEnabled: false,
      watermarkEnabled: false,
      customBranding: false,
    },
    limits: {
      dailyQuestions: 200,
      monthlyQuestions: 5000,
      questionsPerSession: -1,
      maxResponseLength: 'unlimited',
      includeStepByStep: true,
      includeVisuals: true,
      notebookEntriesLimit: -1,
      savedProblemsLimit: -1,
      dailyPracticeProblems: 100,
      mockTestsPerMonth: 20,
      sessionTimeoutMinutes: 120,
      requestsPerMinute: 20,
      requestsPerHour: 200,
    },
    isPopular: false,
    isHidden: false,
    color: 'purple',
    availableForExams: [],
    availableRegions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
  },
  {
    id: 'plan_unlimited',
    tier: 'unlimited',
    name: 'Unlimited',
    tagline: 'No limits, maximum results',
    description: 'For students who want everything',
    pricing: {
      monthlyPrice: 999,
      yearlyPrice: 7999,
      currency: 'INR',
      yearlyDiscount: 33,
      trialDays: 14,
      trialRequiresCard: true,
    },
    features: {
      aiTutoringEnabled: true,
      learningModes: {
        deep_learning: true,
        exam_prep: true,
        revision: true,
        practice: true,
        doubt_clearing: true,
        quick_reference: true,
      },
      voiceInputEnabled: true,
      imageInputEnabled: true,
      subjectsIncluded: [],
      topicsIncluded: [],
      pyqAccess: true,
      mockTestsIncluded: -1,
      smartNotebookEnabled: true,
      notebookExportFormats: ['pdf', 'docx', 'notion', 'anki'],
      revisionSchedulerEnabled: true,
      interactiveSimulations: true,
      videoExplanations: true,
      downloadableContent: true,
      webAccess: true,
      whatsappAccess: true,
      telegramAccess: true,
      supportLevel: 'priority',
      liveTutoringMinutes: 60,
      progressAnalytics: true,
      performancePrediction: true,
      weakAreaAnalysis: true,
      adsEnabled: false,
      watermarkEnabled: false,
      customBranding: false,
    },
    limits: {
      dailyQuestions: -1,
      monthlyQuestions: -1,
      questionsPerSession: -1,
      maxResponseLength: 'unlimited',
      includeStepByStep: true,
      includeVisuals: true,
      notebookEntriesLimit: -1,
      savedProblemsLimit: -1,
      dailyPracticeProblems: -1,
      mockTestsPerMonth: -1,
      sessionTimeoutMinutes: -1,
      requestsPerMinute: 30,
      requestsPerHour: 500,
    },
    isPopular: false,
    isHidden: false,
    color: 'gold',
    availableForExams: [],
    availableRegions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
  },
];
