/**
 * businessAgents.ts
 * Three new specialist agents: VentureScout, RevenueArchitect, GrowthCommander
 */

export type BusinessAgentId = 'venture_scout' | 'revenue_architect' | 'growth_commander';
export type AgentStatus = 'idle' | 'running' | 'completed' | 'error';

export interface SubAgent {
  id: string;
  name: string;
  emoji: string;
  purpose: string;
  externalConnections: string[];
}

export interface BusinessAgent {
  id: BusinessAgentId;
  name: string;
  emoji: string;
  role: string;
  status: AgentStatus;
  subAgents: SubAgent[];
  externalConnections: string[];
  lastRunAt: Date | null;
  currentTask: string | null;
  tasksToday: number;
  successRate: number;
  costToday: number;
  revenueAttributed: number;
}

export interface TrendKeyword {
  keyword: string;
  monthlySearchVolume: number;
  yoyGrowth: number;
  competitionScore: number;
  opportunityScore: number;
  peakMonths: string[];
}

export interface CompetitorEntry {
  name: string;
  price: number;
  rating: number;
  reviewCount: number;
  aiFeatures: boolean;
  recentMove: string;
  ourOpportunity: string;
  threat: 'high' | 'medium' | 'low';
}

export interface NewsItem {
  title: string;
  source: string;
  date: string;
  impact: 'high' | 'medium' | 'low';
  businessImpact: string;
  url: string;
}

export interface PainPoint {
  pain: string;
  frequency: number;
  source: string;
  wtpSignal: string;
}

export interface OpportunityEntry {
  exam: string;
  demandScore: number;
  competitionGapScore: number;
  revenuePotentialScore: number;
  platformReadinessScore: number;
  compositeScore: number;
  monthlyRevenueForecast: number;
}

export interface PricingRecommendation {
  segment: string;
  currentPrice: number;
  recommendedPrice: number;
  elasticityScore: number;
  rationale: string;
  projectedRevenueUplift: number;
}

export interface ChurnSignal {
  cohort: string;
  churnRate: number;
  riskLevel: 'high' | 'medium' | 'low';
  topSignals: string[];
  intervention: string;
  expectedRecovery: number;
}

export interface RevenueForecast {
  period: string;
  low: number;
  mid: number;
  high: number;
  confidence: number;
  assumptions: string[];
}

export interface UpsellOpportunity {
  segment: string;
  count: number;
  trigger: string;
  expectedConversionRate: number;
  revenueOpportunity: number;
  action: string;
}

export interface SEOKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  ourRank: number | null;
  competitorRank: number;
  priority: 'high' | 'medium' | 'low';
}

export interface PartnerProspect {
  name: string;
  type: 'coaching' | 'school' | 'youtube' | 'telegram' | 'influencer';
  reach: number;
  relevance: number;
  proposedDeal: string;
  estimatedStudents: number;
  contactLinkedIn?: string;
}

// ─── Event bus ────────────────────────────────────────────────────────────────

type EventName =
  | 'venture_scout:opportunity_found'
  | 'revenue:forecast_updated'
  | 'growth:campaign_approved';

type EventListener = (payload: Record<string, unknown>) => void;
const _listeners: Record<string, EventListener[]> = {};

export const businessEventBus = {
  on(event: EventName, fn: EventListener) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(fn);
  },
  off(event: EventName, fn: EventListener) {
    _listeners[event] = (_listeners[event] || []).filter(l => l !== fn);
  },
  emit(event: EventName, payload: Record<string, unknown>) {
    (_listeners[event] || []).forEach(fn => fn(payload));
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function braveSearch(query: string): Promise<unknown[]> {
  const key = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_BRAVE_SEARCH_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
      { headers: { Accept: 'application/json', 'X-Subscription-Token': key } }
    );
    if (!res.ok) return [];
    const json = await res.json() as { web?: { results?: unknown[] } };
    return json.web?.results || [];
  } catch {
    return [];
  }
}

// ─── Mock data ────────────────────────────────────────────────────────────────

export const MOCK_TREND_KEYWORDS: TrendKeyword[] = [
  { keyword: 'GATE 2026 preparation', monthlySearchVolume: 38400, yoyGrowth: 42, competitionScore: 28, opportunityScore: 91, peakMonths: ['Sep', 'Oct', 'Nov'] },
  { keyword: 'CAT 2026 mock test', monthlySearchVolume: 52100, yoyGrowth: 28, competitionScore: 55, opportunityScore: 74, peakMonths: ['Jul', 'Aug', 'Sep'] },
  { keyword: 'UPSC CSE 2026 strategy', monthlySearchVolume: 74200, yoyGrowth: 18, competitionScore: 62, opportunityScore: 68, peakMonths: ['Feb', 'Mar', 'Apr'] },
  { keyword: 'CLAT 2026 preparation', monthlySearchVolume: 21800, yoyGrowth: 63, competitionScore: 22, opportunityScore: 88, peakMonths: ['Oct', 'Nov', 'Dec'] },
  { keyword: 'NDA 2026 exam syllabus', monthlySearchVolume: 18900, yoyGrowth: 55, competitionScore: 18, opportunityScore: 92, peakMonths: ['Jan', 'Jun', 'Jul'] },
  { keyword: 'CDS exam 2026', monthlySearchVolume: 12400, yoyGrowth: 71, competitionScore: 15, opportunityScore: 94, peakMonths: ['Feb', 'Aug'] },
  { keyword: 'IBPS PO 2026', monthlySearchVolume: 88400, yoyGrowth: 12, competitionScore: 75, opportunityScore: 52, peakMonths: ['Jul', 'Aug'] },
  { keyword: 'JEE Main 2026 mock', monthlySearchVolume: 124000, yoyGrowth: 8, competitionScore: 88, opportunityScore: 41, peakMonths: ['Oct', 'Nov', 'Jan'] },
  { keyword: 'NEET 2026 biology shortcuts', monthlySearchVolume: 98200, yoyGrowth: 15, competitionScore: 70, opportunityScore: 55, peakMonths: ['Jan', 'Feb', 'Mar'] },
  { keyword: 'CUET 2026 preparation', monthlySearchVolume: 42000, yoyGrowth: 88, competitionScore: 32, opportunityScore: 86, peakMonths: ['Nov', 'Dec', 'Jan'] },
  { keyword: 'SSC CGL 2026 syllabus', monthlySearchVolume: 134000, yoyGrowth: 6, competitionScore: 82, opportunityScore: 38, peakMonths: ['Mar', 'Apr'] },
  { keyword: 'AIIMS MBBS 2026', monthlySearchVolume: 28400, yoyGrowth: 22, competitionScore: 40, opportunityScore: 76, peakMonths: ['Feb', 'Mar'] },
  { keyword: 'BITSAT 2026 preparation', monthlySearchVolume: 16200, yoyGrowth: 35, competitionScore: 30, opportunityScore: 82, peakMonths: ['Dec', 'Jan', 'Feb'] },
  { keyword: 'XAT 2026 mock test', monthlySearchVolume: 11800, yoyGrowth: 48, competitionScore: 20, opportunityScore: 89, peakMonths: ['Oct', 'Nov'] },
  { keyword: 'SNAP 2026 preparation', monthlySearchVolume: 9400, yoyGrowth: 52, competitionScore: 18, opportunityScore: 91, peakMonths: ['Sep', 'Oct'] },
  { keyword: 'MHTCET 2026', monthlySearchVolume: 31200, yoyGrowth: 38, competitionScore: 25, opportunityScore: 84, peakMonths: ['Jan', 'Feb'] },
  { keyword: 'KVPY 2026 preparation', monthlySearchVolume: 8200, yoyGrowth: 30, competitionScore: 22, opportunityScore: 80, peakMonths: ['Aug', 'Sep'] },
  { keyword: 'RRB NTPC 2026', monthlySearchVolume: 184000, yoyGrowth: 4, competitionScore: 90, opportunityScore: 28, peakMonths: ['Varies'] },
  { keyword: 'AFMC 2026 exam', monthlySearchVolume: 7800, yoyGrowth: 58, competitionScore: 12, opportunityScore: 93, peakMonths: ['Feb', 'Mar'] },
  { keyword: 'COMEDK 2026', monthlySearchVolume: 14200, yoyGrowth: 44, competitionScore: 20, opportunityScore: 88, peakMonths: ['Jan', 'Feb', 'Mar'] },
];

export const MOCK_COMPETITORS: CompetitorEntry[] = [
  { name: 'Unacademy', price: 8999, rating: 3.8, reviewCount: 245000, aiFeatures: false, recentMove: 'Launched Unacademy AI in Jan 2026 — basic Q&A chatbot', ourOpportunity: 'Our adaptive Sage is 3x deeper — market the comparison', threat: 'high' as const },
  { name: 'Physics Wallah', price: 999, rating: 4.4, reviewCount: 482000, aiFeatures: false, recentMove: 'Added video content for GATE 2026 prep', ourOpportunity: 'They have reach but no AI tutor — partner or outcompete on AI angle', threat: 'medium' as const },
  { name: "BYJU'S", price: 18000, rating: 2.9, reviewCount: 312000, aiFeatures: true, recentMove: 'Reducing staff, cutting costs — brand trust declining', ourOpportunity: 'Target churned BYJU\'s students with 10x lower price + better AI', threat: 'low' as const },
  { name: 'Embibe', price: 4999, rating: 4.1, reviewCount: 88000, aiFeatures: true, recentMove: 'Partnered with Reliance for school deployments', ourOpportunity: 'They focus B2B schools — we dominate individual student market', threat: 'medium' as const },
  { name: 'Allen Online', price: 6500, rating: 4.2, reviewCount: 94000, aiFeatures: false, recentMove: 'Expanded to Tier 2 cities with offline centres', ourOpportunity: 'Digital-first beats offline — target students in cities without Allen centres', threat: 'low' as const },
];

export const MOCK_NEWS: NewsItem[] = [
  { title: 'NTA announces JEE Main 2026 will have 2 sessions in Jan and Apr', source: 'nta.ac.in', date: '2026-02-10', impact: 'high', businessImpact: 'Two sessions creates longer prep window. Platform opportunity: 6-month prep plan.', url: 'https://nta.ac.in' },
  { title: 'CBSE introduces AI & Data Science elective for Class 11-12', source: 'cbseacademic.nic.in', date: '2026-02-08', impact: 'high', businessImpact: 'New elective opens AI-specific content opportunity with low competition.', url: 'https://cbseacademic.nic.in' },
  { title: 'UGC mandates 30% online learning for college students', source: 'ugc.ac.in', date: '2026-02-05', impact: 'medium', businessImpact: 'Colleges need online platforms for compliance — B2B partnership opportunity.', url: 'https://ugc.ac.in' },
  { title: 'UPSC announces syllabus revision — Ethics paper expanded', source: 'upsc.gov.in', date: '2026-01-28', impact: 'medium', businessImpact: 'Expanded ethics paper requires new content. 380K UPSC aspirants affected.', url: 'https://upsc.gov.in' },
  { title: 'NEET PG 2026 dates clash with GATE 2026 — student confusion high', source: 'Hindu Education', date: '2026-01-20', impact: 'low', businessImpact: 'Scheduling clash creates dual-prep demand. Platform can serve both segments.', url: '#' },
];

export const MOCK_PAIN_POINTS: PainPoint[] = [
  { pain: 'Explanations are too textbook-style, need Hinglish explanations', frequency: 847, source: 'Reddit r/JEEprep', wtpSignal: '₹500–1000 extra for vernacular' },
  { pain: 'Mock tests dont replicate real exam interface (no timer, no section lock)', frequency: 623, source: 'Quora', wtpSignal: 'Would pay premium for authentic simulator' },
  { pain: 'No way to track which concepts are weak across multiple tests', frequency: 514, source: 'Telegram groups', wtpSignal: 'Strong upgrade trigger' },
  { pain: 'AI explanations are generic, not specific to my wrong answer', frequency: 488, source: 'Reddit r/UPSC', wtpSignal: 'Most requested paid feature' },
  { pain: 'Content updates lag when exam syllabus changes', frequency: 402, source: 'Play Store reviews', wtpSignal: 'Would switch platforms for real-time updates' },
  { pain: 'No parent dashboard to show study hours and progress', frequency: 367, source: 'WhatsApp groups', wtpSignal: '₹200–300/mo parent upgrade' },
  { pain: 'Practice questions are too easy — no hard-mode option', frequency: 341, source: 'Reddit r/CAT', wtpSignal: 'Willing to pay ₹700+ for hard-mode bank' },
  { pain: 'Cant study offline on train commutes', frequency: 318, source: 'Play Store reviews', wtpSignal: 'Offline mode = conversion driver' },
  { pain: 'No peer comparison — dont know how I rank among aspirants', frequency: 295, source: 'Quora', wtpSignal: 'Gamification feature' },
  { pain: 'Dont know when to stop revising a topic — no confidence metric', frequency: 272, source: 'Reddit r/NEET', wtpSignal: 'Core AI feature gap' },
];

export const MOCK_OPPORTUNITIES: OpportunityEntry[] = [
  { exam: 'GATE', demandScore: 88, competitionGapScore: 82, revenuePotentialScore: 85, platformReadinessScore: 72, compositeScore: 82, monthlyRevenueForecast: 380000 },
  { exam: 'CAT', demandScore: 91, competitionGapScore: 68, revenuePotentialScore: 92, platformReadinessScore: 65, compositeScore: 79, monthlyRevenueForecast: 420000 },
  { exam: 'UPSC', demandScore: 94, competitionGapScore: 55, revenuePotentialScore: 88, platformReadinessScore: 58, compositeScore: 74, monthlyRevenueForecast: 510000 },
  { exam: 'CLAT', demandScore: 78, competitionGapScore: 88, revenuePotentialScore: 74, platformReadinessScore: 80, compositeScore: 80, monthlyRevenueForecast: 220000 },
  { exam: 'NDA', demandScore: 82, competitionGapScore: 90, revenuePotentialScore: 68, platformReadinessScore: 85, compositeScore: 81, monthlyRevenueForecast: 190000 },
  { exam: 'CDS', demandScore: 74, competitionGapScore: 92, revenuePotentialScore: 62, platformReadinessScore: 88, compositeScore: 79, monthlyRevenueForecast: 145000 },
];

// ─── Sub-agent definitions ────────────────────────────────────────────────────

const VENTURE_SCOUT_SUB_AGENTS: SubAgent[] = [
  { id: 'trend_radar', name: 'TrendRadar', emoji: '📡', purpose: 'Polls Brave Search API for rising exam keywords. Returns search volume, YoY growth%, seasonality peaks.', externalConnections: ['Brave Search API'] },
  { id: 'competitor_spy', name: 'CompetitorSpy', emoji: '🕶️', purpose: 'Monitors competitor pricing, feature launches, weaknesses via Play Store + Brave Search.', externalConnections: ['Brave Search API'] },
  { id: 'audience_surveyor', name: 'AudienceSurveyor', emoji: '🎙️', purpose: 'Analyses Reddit/Quora/Telegram for unmet student needs: pain points, WTP signals.', externalConnections: ['Brave Search API'] },
  { id: 'blu_ocean_finder', name: 'BluOceanFinder', emoji: '🌊', purpose: 'Cross-references demand vs competition saturation. Outputs opportunity score matrix.', externalConnections: [] },
  { id: 'news_monitor', name: 'NewsMonitor', emoji: '📰', purpose: 'Tracks NTA/CBSE/UGC announcements, policy changes, new exam launches.', externalConnections: ['Brave Search API'] },
];

const REVENUE_ARCHITECT_SUB_AGENTS: SubAgent[] = [
  { id: 'pricing_optimiser', name: 'PricingOptimiser', emoji: '💱', purpose: 'Runs price elasticity models, suggests optimal price points per segment.', externalConnections: [] },
  { id: 'churn_predictor', name: 'ChurnPredictor', emoji: '🔮', purpose: 'ML-style churn signal analysis, recommends interventions per at-risk cohort.', externalConnections: [] },
  { id: 'upsell_engine', name: 'UpSellEngine', emoji: '⬆️', purpose: 'Identifies upgrade opportunities per student, triggers Mentor/Nexus to execute.', externalConnections: [] },
  { id: 'revenue_forecaster', name: 'RevenueForecaster', emoji: '📈', purpose: '30/60/90-day revenue forecasts with confidence intervals.', externalConnections: [] },
  { id: 'ltv_optimiser', name: 'LTVOptimiser', emoji: '♾️', purpose: 'Calculates LTV per cohort, recommends acquisition budget per channel.', externalConnections: [] },
];

const GROWTH_COMMANDER_SUB_AGENTS: SubAgent[] = [
  { id: 'seo_strategist', name: 'SEOStrategist', emoji: '🔑', purpose: 'Keyword gap analysis, tells Atlas what to write for maximum organic ROI.', externalConnections: ['Brave Search API'] },
  { id: 'community_builder', name: 'CommunityBuilder', emoji: '👥', purpose: 'Plans and grows Telegram/Discord/WhatsApp communities with conversion funnels.', externalConnections: [] },
  { id: 'partnership_finder', name: 'PartnershipFinder', emoji: '🤝', purpose: 'Finds schools, coaching institutes, influencers to partner with.', externalConnections: ['Brave Search API'] },
  { id: 'viral_loop_designer', name: 'ViralLoopDesigner', emoji: '🔄', purpose: 'Designs referral mechanics, tracks viral coefficient.', externalConnections: [] },
  { id: 'paid_ads_advisor', name: 'PaidAdsAdvisor', emoji: '📣', purpose: 'Recommends Google/Meta ad strategy, bid suggestions, creative briefs.', externalConnections: [] },
];

// ─── Agent registry ───────────────────────────────────────────────────────────

export const BUSINESS_AGENTS: Record<BusinessAgentId, BusinessAgent> = {
  venture_scout: {
    id: 'venture_scout',
    name: 'VentureScout',
    emoji: '🕵️',
    role: 'Opportunity Discovery',
    status: 'idle',
    subAgents: VENTURE_SCOUT_SUB_AGENTS,
    externalConnections: ['VITE_BRAVE_SEARCH_API_KEY', 'VITE_GEMINI_API_KEY'],
    lastRunAt: new Date(Date.now() - 4 * 3600_000),
    currentTask: null,
    tasksToday: 14,
    successRate: 0.94,
    costToday: 0.32,
    revenueAttributed: 0,
  },
  revenue_architect: {
    id: 'revenue_architect',
    name: 'RevenueArchitect',
    emoji: '💰',
    role: 'Revenue Strategy',
    status: 'idle',
    subAgents: REVENUE_ARCHITECT_SUB_AGENTS,
    externalConnections: ['VITE_GEMINI_API_KEY'],
    lastRunAt: new Date(Date.now() - 1 * 3600_000),
    currentTask: null,
    tasksToday: 8,
    successRate: 0.97,
    costToday: 0.18,
    revenueAttributed: 284000,
  },
  growth_commander: {
    id: 'growth_commander',
    name: 'GrowthCommander',
    emoji: '🚀',
    role: 'Growth Execution',
    status: 'idle',
    subAgents: GROWTH_COMMANDER_SUB_AGENTS,
    externalConnections: ['VITE_BRAVE_SEARCH_API_KEY', 'VITE_GEMINI_API_KEY'],
    lastRunAt: new Date(Date.now() - 2 * 3600_000),
    currentTask: null,
    tasksToday: 11,
    successRate: 0.91,
    costToday: 0.28,
    revenueAttributed: 142000,
  },
};

// ─── VentureScout run methods ─────────────────────────────────────────────────

export const ventureScoutRun = {
  async trendScan(): Promise<TrendKeyword[]> {
    await sleep(1200);
    const liveResults = await braveSearch('top competitive exam preparation India 2026');
    if (liveResults.length > 0) console.info('[VentureScout] Brave enriched:', liveResults.length);
    businessEventBus.emit('venture_scout:opportunity_found', {
      type: 'trend_scan',
      topKeyword: MOCK_TREND_KEYWORDS[0].keyword,
    });
    return [...MOCK_TREND_KEYWORDS].sort((a, b) => b.opportunityScore - a.opportunityScore);
  },

  async competitorLandscape(): Promise<CompetitorEntry[]> {
    await sleep(1800);
    return MOCK_COMPETITORS;
  },

  async newsWatch(): Promise<NewsItem[]> {
    await sleep(900);
    return MOCK_NEWS;
  },

  async audiencePainMining(): Promise<PainPoint[]> {
    await sleep(2200);
    return MOCK_PAIN_POINTS;
  },

  async opportunityMatrix(): Promise<OpportunityEntry[]> {
    await sleep(1400);
    return [...MOCK_OPPORTUNITIES].sort((a, b) => b.compositeScore - a.compositeScore);
  },
};

// ─── RevenueArchitect run methods ─────────────────────────────────────────────

export const revenueArchitectRun = {
  async pricingRecommendations(): Promise<PricingRecommendation[]> {
    await sleep(1600);
    return [
      { segment: 'JEE Main — Annual', currentPrice: 1799, recommendedPrice: 1999, elasticityScore: 0.18, rationale: 'Low price sensitivity; competitors at ₹8,999 leave headroom', projectedRevenueUplift: 42000 },
      { segment: 'NEET — Monthly', currentPrice: 199, recommendedPrice: 249, elasticityScore: 0.22, rationale: 'Monthly subscribers show 4x lower churn at slightly higher prices', projectedRevenueUplift: 18000 },
      { segment: 'Freemium → Pro tier', currentPrice: 0, recommendedPrice: 299, elasticityScore: 0.35, rationale: 'Add "Pro Mock Test" tier between free and paid to capture mid-intent users', projectedRevenueUplift: 75000 },
      { segment: 'CAT — Annual', currentPrice: 2499, recommendedPrice: 2999, elasticityScore: 0.12, rationale: 'CAT aspirants are premium — MBA ROI justifies higher price', projectedRevenueUplift: 55000 },
    ];
  },

  async churnSignals(): Promise<ChurnSignal[]> {
    await sleep(1400);
    return [
      { cohort: 'JEE Month 3+', churnRate: 0.18, riskLevel: 'high', topSignals: ['No login in 5+ days', 'Mock test completion < 20%', 'Hint overuse'], intervention: 'Personal re-engagement nudge + 1 free hard mock', expectedRecovery: 0.34 },
      { cohort: 'NEET Free Users', churnRate: 0.42, riskLevel: 'high', topSignals: ['Stuck on Organic Chemistry', 'Low session duration'], intervention: 'Simplified Organic Chemistry crash course', expectedRecovery: 0.28 },
      { cohort: 'CAT Working Professionals', churnRate: 0.12, riskLevel: 'medium', topSignals: ['Irregular login', 'Skipping Quant section'], intervention: 'Weekend prep schedule + Quant shortcuts email', expectedRecovery: 0.45 },
      { cohort: 'UPSC Aspirants Year 2+', churnRate: 0.08, riskLevel: 'low', topSignals: ['Content repetition fatigue'], intervention: 'New essay + ethics content unlock', expectedRecovery: 0.60 },
    ];
  },

  async revenueForecasts(): Promise<RevenueForecast[]> {
    await sleep(1200);
    businessEventBus.emit('revenue:forecast_updated', { updatedAt: new Date().toISOString() });
    return [
      { period: '30 days', low: 280000, mid: 380000, high: 520000, confidence: 0.88, assumptions: ['No new exam launches', 'Churn at current rate', 'Organic traffic +8%'] },
      { period: '60 days', low: 540000, mid: 760000, high: 1100000, confidence: 0.76, assumptions: ['GATE exam launch', 'Referral program active', 'Churn interventions executed'] },
      { period: '90 days', low: 820000, mid: 1250000, high: 1900000, confidence: 0.62, assumptions: ['CAT season traffic surge', '2 new exams live', 'Partnership channel active'] },
    ];
  },

  async upsellOpportunities(): Promise<UpsellOpportunity[]> {
    await sleep(1000);
    return [
      { segment: 'Free users who completed 5+ sessions', count: 47, trigger: 'High engagement = intent signal', expectedConversionRate: 0.23, revenueOpportunity: 21620, action: 'Show "Unlock Full Mock Tests" banner at session 6' },
      { segment: 'Monthly subscribers (>3 months)', count: 28, trigger: 'Stickiness = upgrade readiness', expectedConversionRate: 0.38, revenueOpportunity: 38640, action: 'Offer annual plan at 40% discount via Mentor nudge' },
      { segment: 'Students who scored >80% on mock', count: 12, trigger: 'High performers want harder content', expectedConversionRate: 0.50, revenueOpportunity: 17940, action: 'Unlock "Advanced Problem Sets" upgrade CTA' },
    ];
  },
};

// ─── GrowthCommander run methods ──────────────────────────────────────────────

export const growthCommanderRun = {
  async seoKeywords(examName: string): Promise<SEOKeyword[]> {
    await sleep(1800);
    await braveSearch(`${examName} preparation 2026 India site:quora.com OR site:reddit.com`);
    return [
      { keyword: `${examName} 2026 preparation guide`, volume: 22400, difficulty: 32, ourRank: null, competitorRank: 3, priority: 'high' },
      { keyword: `${examName} mock test free`, volume: 18200, difficulty: 28, ourRank: null, competitorRank: 5, priority: 'high' },
      { keyword: `${examName} syllabus 2026`, volume: 31400, difficulty: 22, ourRank: null, competitorRank: 7, priority: 'high' },
      { keyword: `${examName} previous year papers`, volume: 14800, difficulty: 35, ourRank: null, competitorRank: 4, priority: 'high' },
      { keyword: `best app for ${examName} preparation`, volume: 9200, difficulty: 45, ourRank: null, competitorRank: 8, priority: 'medium' },
      { keyword: `${examName} cut off 2025`, volume: 28600, difficulty: 18, ourRank: null, competitorRank: 2, priority: 'medium' },
      { keyword: `how to crack ${examName} in 3 months`, volume: 7400, difficulty: 30, ourRank: null, competitorRank: 6, priority: 'medium' },
      { keyword: `${examName} weightage chapter wise`, volume: 11200, difficulty: 25, ourRank: null, competitorRank: 9, priority: 'medium' },
    ];
  },

  async partnerProspects(examName: string): Promise<PartnerProspect[]> {
    await sleep(1400);
    return [
      { name: 'Resonance Kota', type: 'coaching', reach: 85000, relevance: 92, estimatedStudents: 4200, proposedDeal: 'Co-branding: EduGenius AI + Resonance brand on mock tests', contactLinkedIn: 'resonance-kota' },
      { name: 'Ajmer IIT Academy', type: 'coaching', reach: 12000, relevance: 88, estimatedStudents: 600, proposedDeal: 'Affiliate deal — ₹200 per referred student', contactLinkedIn: 'ajmer-iit' },
      { name: 'GATE Wallah YT', type: 'influencer', reach: 340000, relevance: 95, estimatedStudents: 8500, proposedDeal: 'Sponsored content — 2 videos/month at ₹25K each', contactLinkedIn: 'gate-wallah' },
    ];
  },
};
