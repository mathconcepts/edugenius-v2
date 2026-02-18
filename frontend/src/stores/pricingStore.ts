/**
 * Pricing Store - CEO Configuration Interface
 * 
 * Manages:
 * - Pricing plans (CRUD)
 * - Feature gates
 * - Exam-specific configs
 * - A/B tests
 * - Agent connections
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  PricingPlan,
  PricingTier,
  FeatureGate,
  ExamPricingConfig,
  PricingABTest,
  PricingConfiguration,
  GlobalPricingSettings,
  UserSubscription,
  defaultPricingPlans,
  defaultFeatureGates,
} from '@/types/pricing';

// ============================================
// STORE STATE
// ============================================

interface PricingState {
  // Configuration
  config: PricingConfiguration;
  
  // Draft (for editing before publish)
  draftConfig: PricingConfiguration | null;
  hasUnsavedChanges: boolean;
  
  // Agent data (inputs)
  competitorData: CompetitorData | null;
  analyticsData: AnalyticsData | null;
  
  // User subscriptions (for testing)
  userSubscriptions: Map<string, UserSubscription>;
  
  // ============================================
  // PLAN MANAGEMENT
  // ============================================
  
  // Get plans
  getPlans: () => PricingPlan[];
  getPlanById: (id: string) => PricingPlan | undefined;
  getPlanByTier: (tier: PricingTier) => PricingPlan | undefined;
  
  // CRUD
  createPlan: (plan: Omit<PricingPlan, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updatePlan: (id: string, updates: Partial<PricingPlan>) => void;
  deletePlan: (id: string) => void;
  duplicatePlan: (id: string, newName: string) => string;
  
  // Ordering
  reorderPlans: (planIds: string[]) => void;
  
  // ============================================
  // FEATURE GATES
  // ============================================
  
  getFeatureGates: () => FeatureGate[];
  updateFeatureGate: (id: string, updates: Partial<FeatureGate>) => void;
  checkFeatureAccess: (featureKey: string, userTier: PricingTier) => boolean;
  getFeatureLimit: (featureKey: string, userTier: PricingTier) => number;
  
  // ============================================
  // EXAM CONFIGS
  // ============================================
  
  getExamConfigs: () => ExamPricingConfig[];
  getExamConfig: (examType: string) => ExamPricingConfig | undefined;
  updateExamConfig: (examType: string, updates: Partial<ExamPricingConfig>) => void;
  createExamConfig: (config: ExamPricingConfig) => void;
  
  // ============================================
  // A/B TESTS
  // ============================================
  
  getABTests: () => PricingABTest[];
  createABTest: (test: Omit<PricingABTest, 'id'>) => string;
  updateABTest: (id: string, updates: Partial<PricingABTest>) => void;
  startABTest: (id: string) => void;
  stopABTest: (id: string) => void;
  getABTestVariant: (testId: string, userId: string) => string;
  
  // ============================================
  // GLOBAL SETTINGS
  // ============================================
  
  getGlobalSettings: () => GlobalPricingSettings;
  updateGlobalSettings: (updates: Partial<GlobalPricingSettings>) => void;
  
  // ============================================
  // DRAFT & PUBLISH
  // ============================================
  
  startEditing: () => void;
  saveDraft: () => void;
  discardDraft: () => void;
  publishConfig: () => void;
  
  // ============================================
  // AGENT INTEGRATIONS
  // ============================================
  
  // Scout Agent → Pricing (competitor data)
  updateCompetitorData: (data: CompetitorData) => void;
  
  // Oracle Agent → Pricing (analytics)
  updateAnalyticsData: (data: AnalyticsData) => void;
  
  // Generate recommendations
  getRecommendedPricing: (examType: string) => PricingRecommendation;
  
  // ============================================
  // USER SUBSCRIPTION MANAGEMENT
  // ============================================
  
  getUserSubscription: (userId: string) => UserSubscription | undefined;
  createSubscription: (userId: string, planId: string) => void;
  updateSubscription: (userId: string, updates: Partial<UserSubscription>) => void;
  checkUsageLimit: (userId: string, limitType: string) => UsageLimitResult;
  incrementUsage: (userId: string, usageType: string, amount?: number) => void;
}

// ============================================
// AGENT DATA TYPES
// ============================================

interface CompetitorData {
  lastUpdated: Date;
  competitors: {
    name: string;
    plans: {
      name: string;
      price: number;
      features: string[];
    }[];
  }[];
  marketTrends: {
    trend: string;
    impact: 'positive' | 'negative' | 'neutral';
    recommendation: string;
  }[];
}

interface AnalyticsData {
  lastUpdated: Date;
  conversionRates: Record<string, number>;
  churnRates: Record<string, number>;
  revenueByPlan: Record<string, number>;
  featureUsage: Record<string, number>;
  gateHits: Record<string, number>;
  upgradePatterns: {
    fromTier: string;
    toTier: string;
    count: number;
    avgDaysToUpgrade: number;
  }[];
}

interface PricingRecommendation {
  examType: string;
  recommendedPrices: Record<PricingTier, number>;
  reasoning: string[];
  competitorComparison: string;
  confidence: number;
}

interface UsageLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  resetAt?: Date;
  upgradePrompt?: string;
}

// ============================================
// DEFAULT CONFIG
// ============================================

const defaultGlobalSettings: GlobalPricingSettings = {
  defaultCurrency: 'INR',
  supportedCurrencies: ['INR', 'USD'],
  exchangeRates: { USD: 83 },
  globalTrialDays: 7,
  trialExtensionAllowed: true,
  maxTrialExtensions: 1,
  maxDiscountPercent: 50,
  referralRewardAmount: 100,
  referralDiscountPercent: 20,
  billingCycles: ['monthly', 'yearly'],
  gracePeriodDays: 3,
  freemiumEnabled: true,
  freemiumConversionTarget: 10,
  showComparisonTable: true,
  showMonthlyByDefault: true,
  highlightSavings: true,
};

const defaultConfig: PricingConfiguration = {
  globalSettings: defaultGlobalSettings,
  plans: [], // Will be populated from defaultPricingPlans
  featureGates: [], // Will be populated from defaultFeatureGates
  examConfigs: [],
  activeTests: [],
  version: '1.0.0',
  lastUpdatedBy: 'system',
  lastUpdatedAt: new Date(),
};

// ============================================
// STORE IMPLEMENTATION
// ============================================

const generateId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const usePricingStore = create<PricingState>()(
  persist(
    (set, get) => ({
      config: defaultConfig,
      draftConfig: null,
      hasUnsavedChanges: false,
      competitorData: null,
      analyticsData: null,
      userSubscriptions: new Map(),

      // ============================================
      // PLAN MANAGEMENT
      // ============================================

      getPlans: () => get().config.plans,
      
      getPlanById: (id) => get().config.plans.find((p) => p.id === id),
      
      getPlanByTier: (tier) => get().config.plans.find((p) => p.tier === tier),

      createPlan: (plan) => {
        const id = `plan_${generateId()}`;
        const newPlan: PricingPlan = {
          ...plan,
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({
          config: {
            ...state.config,
            plans: [...state.config.plans, newPlan],
            lastUpdatedAt: new Date(),
          },
          hasUnsavedChanges: true,
        }));
        return id;
      },

      updatePlan: (id, updates) => {
        set((state) => ({
          config: {
            ...state.config,
            plans: state.config.plans.map((p) =>
              p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
            ),
            lastUpdatedAt: new Date(),
          },
          hasUnsavedChanges: true,
        }));
      },

      deletePlan: (id) => {
        set((state) => ({
          config: {
            ...state.config,
            plans: state.config.plans.filter((p) => p.id !== id),
            lastUpdatedAt: new Date(),
          },
          hasUnsavedChanges: true,
        }));
      },

      duplicatePlan: (id, newName) => {
        const original = get().getPlanById(id);
        if (!original) throw new Error('Plan not found');
        
        const newId = `plan_${generateId()}`;
        const newPlan: PricingPlan = {
          ...original,
          id: newId,
          name: newName,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        set((state) => ({
          config: {
            ...state.config,
            plans: [...state.config.plans, newPlan],
            lastUpdatedAt: new Date(),
          },
          hasUnsavedChanges: true,
        }));
        
        return newId;
      },

      reorderPlans: (planIds) => {
        const plans = get().config.plans;
        const reordered = planIds.map((id) => plans.find((p) => p.id === id)!).filter(Boolean);
        set((state) => ({
          config: { ...state.config, plans: reordered },
          hasUnsavedChanges: true,
        }));
      },

      // ============================================
      // FEATURE GATES
      // ============================================

      getFeatureGates: () => get().config.featureGates,

      updateFeatureGate: (id, updates) => {
        set((state) => ({
          config: {
            ...state.config,
            featureGates: state.config.featureGates.map((g) =>
              g.id === id ? { ...g, ...updates } : g
            ),
            lastUpdatedAt: new Date(),
          },
          hasUnsavedChanges: true,
        }));
      },

      checkFeatureAccess: (featureKey, userTier) => {
        const gate = get().config.featureGates.find((g) => g.featureKey === featureKey);
        if (!gate) return true; // No gate = allowed
        
        const tierOrder: PricingTier[] = ['free', 'starter', 'pro', 'unlimited', 'enterprise'];
        const userTierIndex = tierOrder.indexOf(userTier);
        
        switch (gate.gateType) {
          case 'boolean':
            return gate.enabledTiers?.includes(userTier) ?? false;
          case 'tier_minimum':
            const minTierIndex = tierOrder.indexOf(gate.minimumTier!);
            return userTierIndex >= minTierIndex;
          case 'limit':
            const limit = gate.limitByTier?.[userTier] ?? 0;
            return limit !== 0;
          default:
            return true;
        }
      },

      getFeatureLimit: (featureKey, userTier) => {
        const gate = get().config.featureGates.find((g) => g.featureKey === featureKey);
        if (!gate || gate.gateType !== 'limit') return -1;
        return gate.limitByTier?.[userTier] ?? 0;
      },

      // ============================================
      // EXAM CONFIGS
      // ============================================

      getExamConfigs: () => get().config.examConfigs,

      getExamConfig: (examType) => 
        get().config.examConfigs.find((c) => c.examType === examType),

      updateExamConfig: (examType, updates) => {
        set((state) => ({
          config: {
            ...state.config,
            examConfigs: state.config.examConfigs.map((c) =>
              c.examType === examType ? { ...c, ...updates } : c
            ),
            lastUpdatedAt: new Date(),
          },
          hasUnsavedChanges: true,
        }));
      },

      createExamConfig: (config) => {
        set((state) => ({
          config: {
            ...state.config,
            examConfigs: [...state.config.examConfigs, config],
            lastUpdatedAt: new Date(),
          },
          hasUnsavedChanges: true,
        }));
      },

      // ============================================
      // A/B TESTS
      // ============================================

      getABTests: () => get().config.activeTests,

      createABTest: (test) => {
        const id = `abtest_${generateId()}`;
        set((state) => ({
          config: {
            ...state.config,
            activeTests: [...state.config.activeTests, { ...test, id }],
            lastUpdatedAt: new Date(),
          },
          hasUnsavedChanges: true,
        }));
        return id;
      },

      updateABTest: (id, updates) => {
        set((state) => ({
          config: {
            ...state.config,
            activeTests: state.config.activeTests.map((t) =>
              t.id === id ? { ...t, ...updates } : t
            ),
            lastUpdatedAt: new Date(),
          },
          hasUnsavedChanges: true,
        }));
      },

      startABTest: (id) => {
        get().updateABTest(id, { status: 'running', startDate: new Date() });
      },

      stopABTest: (id) => {
        get().updateABTest(id, { status: 'paused' });
      },

      getABTestVariant: (testId, userId) => {
        const test = get().config.activeTests.find((t) => t.id === testId);
        if (!test || test.status !== 'running') return test?.controlPlan || '';
        
        // Deterministic assignment based on userId hash
        const hash = userId.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
        const normalized = Math.abs(hash) % 100;
        
        let cumulative = 0;
        for (const variant of test.variantPlans) {
          cumulative += variant.trafficPercent;
          if (normalized < cumulative) {
            return variant.planId;
          }
        }
        return test.controlPlan;
      },

      // ============================================
      // GLOBAL SETTINGS
      // ============================================

      getGlobalSettings: () => get().config.globalSettings,

      updateGlobalSettings: (updates) => {
        set((state) => ({
          config: {
            ...state.config,
            globalSettings: { ...state.config.globalSettings, ...updates },
            lastUpdatedAt: new Date(),
          },
          hasUnsavedChanges: true,
        }));
      },

      // ============================================
      // DRAFT & PUBLISH
      // ============================================

      startEditing: () => {
        set((state) => ({
          draftConfig: JSON.parse(JSON.stringify(state.config)),
        }));
      },

      saveDraft: () => {
        // Auto-saved via persistence
        set({ hasUnsavedChanges: false });
      },

      discardDraft: () => {
        set((state) => ({
          config: state.draftConfig || state.config,
          draftConfig: null,
          hasUnsavedChanges: false,
        }));
      },

      publishConfig: () => {
        set((state) => ({
          config: {
            ...state.config,
            publishedAt: new Date(),
            version: incrementVersion(state.config.version),
          },
          draftConfig: null,
          hasUnsavedChanges: false,
        }));
      },

      // ============================================
      // AGENT INTEGRATIONS
      // ============================================

      updateCompetitorData: (data) => {
        set({ competitorData: data });
      },

      updateAnalyticsData: (data) => {
        set({ analyticsData: data });
      },

      getRecommendedPricing: (examType) => {
        const { competitorData, analyticsData } = get();
        const examConfig = get().getExamConfig(examType);
        
        // Calculate recommended prices based on competitor data and analytics
        const recommendedPrices: Record<PricingTier, number> = {
          free: 0,
          starter: 299,
          pro: 599,
          unlimited: 999,
          enterprise: 0,
        };
        
        const reasoning: string[] = [];
        
        if (competitorData) {
          const avgCompetitorPrice = competitorData.competitors
            .flatMap((c) => c.plans.map((p) => p.price))
            .reduce((a, b) => a + b, 0) / competitorData.competitors.length;
          
          reasoning.push(`Average competitor price: ₹${avgCompetitorPrice}`);
          
          // Price 10-20% below average for market entry
          recommendedPrices.starter = Math.round(avgCompetitorPrice * 0.85);
        }
        
        if (analyticsData) {
          const bestConverting = Object.entries(analyticsData.conversionRates)
            .sort(([, a], [, b]) => b - a)[0];
          reasoning.push(`Best converting plan: ${bestConverting?.[0]} (${bestConverting?.[1]}%)`);
        }
        
        if (examConfig?.priceElasticity) {
          reasoning.push(`Price elasticity: ${examConfig.priceElasticity}`);
        }
        
        return {
          examType,
          recommendedPrices,
          reasoning,
          competitorComparison: competitorData 
            ? `Priced ${20}% below market average`
            : 'No competitor data available',
          confidence: competitorData && analyticsData ? 0.85 : 0.5,
        };
      },

      // ============================================
      // USER SUBSCRIPTION MANAGEMENT
      // ============================================

      getUserSubscription: (userId) => get().userSubscriptions.get(userId),

      createSubscription: (userId, planId) => {
        const plan = get().getPlanById(planId);
        if (!plan) throw new Error('Plan not found');
        
        const subscription: UserSubscription = {
          userId,
          planId,
          tier: plan.tier,
          billingCycle: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: plan.pricing.trialDays > 0 ? 'trialing' : 'active',
          cancelAtPeriodEnd: false,
          usage: {
            questionsToday: 0,
            questionsThisMonth: 0,
            mockTestsThisMonth: 0,
            notebookEntries: 0,
          },
          trialEndsAt: plan.pricing.trialDays > 0 
            ? new Date(Date.now() + plan.pricing.trialDays * 24 * 60 * 60 * 1000)
            : undefined,
          trialExtensionsUsed: 0,
          activeDiscounts: [],
        };
        
        set((state) => {
          const newMap = new Map(state.userSubscriptions);
          newMap.set(userId, subscription);
          return { userSubscriptions: newMap };
        });
      },

      updateSubscription: (userId, updates) => {
        set((state) => {
          const newMap = new Map(state.userSubscriptions);
          const existing = newMap.get(userId);
          if (existing) {
            newMap.set(userId, { ...existing, ...updates });
          }
          return { userSubscriptions: newMap };
        });
      },

      checkUsageLimit: (userId, limitType) => {
        const subscription = get().getUserSubscription(userId);
        if (!subscription) {
          return { allowed: false, current: 0, limit: 0, remaining: 0 };
        }
        
        const plan = get().getPlanById(subscription.planId);
        if (!plan) {
          return { allowed: false, current: 0, limit: 0, remaining: 0 };
        }
        
        let current = 0;
        let limit = 0;
        
        switch (limitType) {
          case 'dailyQuestions':
            current = subscription.usage.questionsToday;
            limit = plan.limits.dailyQuestions;
            break;
          case 'monthlyQuestions':
            current = subscription.usage.questionsThisMonth;
            limit = plan.limits.monthlyQuestions;
            break;
          case 'mockTests':
            current = subscription.usage.mockTestsThisMonth;
            limit = plan.limits.mockTestsPerMonth;
            break;
          case 'notebookEntries':
            current = subscription.usage.notebookEntries;
            limit = plan.limits.notebookEntriesLimit;
            break;
        }
        
        const unlimited = limit === -1;
        const allowed = unlimited || current < limit;
        const remaining = unlimited ? -1 : Math.max(0, limit - current);
        
        const gate = get().config.featureGates.find((g) => g.featureKey === limitType);
        
        return {
          allowed,
          current,
          limit,
          remaining,
          upgradePrompt: !allowed ? gate?.upgradePrompt : undefined,
        };
      },

      incrementUsage: (userId, usageType, amount = 1) => {
        const subscription = get().getUserSubscription(userId);
        if (!subscription) return;
        
        const newUsage = { ...subscription.usage };
        
        switch (usageType) {
          case 'questionsToday':
            newUsage.questionsToday += amount;
            newUsage.questionsThisMonth += amount;
            break;
          case 'mockTests':
            newUsage.mockTestsThisMonth += amount;
            break;
          case 'notebookEntries':
            newUsage.notebookEntries += amount;
            break;
        }
        
        get().updateSubscription(userId, { usage: newUsage });
      },
    }),
    {
      name: 'edugenius-pricing',
      partialize: (state) => ({
        config: state.config,
        userSubscriptions: Array.from(state.userSubscriptions.entries()),
      }),
    }
  )
);

// Helper function
function incrementVersion(version: string): string {
  const parts = version.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join('.');
}

export default usePricingStore;
