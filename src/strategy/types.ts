/**
 * Strategy Module Types
 * Autonomous growth strategy engine for CEO
 */

// ============================================================================
// STRATEGY TYPES
// ============================================================================

export type StrategyPhase = 
  | 'discovery'      // Finding product-market fit
  | 'validation'     // Testing with early users
  | 'growth'         // Scaling user acquisition
  | 'optimization'   // Improving unit economics
  | 'expansion';     // New markets/products

export type AudienceSegment =
  | 'aspirants_jee'
  | 'aspirants_neet'
  | 'aspirants_cat'
  | 'cbse_10'
  | 'cbse_12'
  | 'upsc'
  | 'state_boards'
  | 'parents'
  | 'teachers'
  | 'coaching_institutes';

export type ChannelType =
  | 'organic_search'
  | 'paid_search'
  | 'social_organic'
  | 'social_paid'
  | 'youtube'
  | 'whatsapp'
  | 'telegram'
  | 'referral'
  | 'partnerships'
  | 'offline'
  | 'email'
  | 'content_marketing';

export type ActionPriority = 'critical' | 'high' | 'medium' | 'low';
export type ActionStatus = 'proposed' | 'approved' | 'in_progress' | 'completed' | 'rejected' | 'paused';

// ============================================================================
// MARKET INTELLIGENCE
// ============================================================================

export interface MarketIntelligence {
  id: string;
  timestamp: Date;
  source: 'scout' | 'oracle' | 'herald' | 'external' | 'manual';
  
  // Market data
  marketSize?: {
    tam: number;        // Total addressable market
    sam: number;        // Serviceable addressable market
    som: number;        // Serviceable obtainable market
    currency: string;
    year: number;
  };
  
  // Competitor intel
  competitors?: CompetitorIntel[];
  
  // Trend data
  trends?: TrendData[];
  
  // Audience insights
  audienceInsights?: AudienceInsight[];
  
  // Opportunities
  opportunities?: OpportunityData[];
  
  // Threats
  threats?: ThreatData[];
}

export interface CompetitorIntel {
  name: string;
  website?: string;
  positioning: string;
  strengths: string[];
  weaknesses: string[];
  pricing?: {
    model: 'freemium' | 'subscription' | 'one-time' | 'hybrid';
    lowestTier: number;
    highestTier: number;
    currency: string;
  };
  estimatedUsers?: number;
  recentMoves?: string[];
  threatLevel: 'low' | 'medium' | 'high';
}

export interface TrendData {
  trend: string;
  direction: 'rising' | 'stable' | 'declining';
  relevance: number;  // 0-1
  timeframe: string;
  source: string;
  implications: string[];
}

export interface AudienceInsight {
  segment: AudienceSegment;
  size: number;
  growthRate: number;
  avgLTV: number;
  cac: number;
  painPoints: string[];
  motivations: string[];
  preferredChannels: ChannelType[];
  conversionRate: number;
}

export interface OpportunityData {
  id: string;
  title: string;
  description: string;
  segment: AudienceSegment;
  potentialRevenue: number;
  effort: 'low' | 'medium' | 'high';
  timeToCapture: string;
  confidence: number;
  requiredActions: string[];
}

export interface ThreatData {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: number;
  impact: string;
  mitigationActions: string[];
}

// ============================================================================
// STRATEGY & RECOMMENDATIONS
// ============================================================================

export interface GrowthStrategy {
  id: string;
  name: string;
  phase: StrategyPhase;
  targetSegments: AudienceSegment[];
  primaryChannels: ChannelType[];
  
  // Goals
  goals: StrategyGoal[];
  
  // Tactics
  tactics: StrategyTactic[];
  
  // Timeline
  startDate: Date;
  endDate: Date;
  milestones: StrategyMilestone[];
  
  // Resources
  budget: {
    total: number;
    allocated: Record<ChannelType, number>;
    currency: string;
  };
  
  // Metrics
  kpis: KPI[];
  
  // Status
  status: 'draft' | 'active' | 'paused' | 'completed';
  progress: number;  // 0-100
  lastReview: Date;
}

export interface StrategyGoal {
  id: string;
  metric: string;
  target: number;
  current: number;
  unit: string;
  deadline: Date;
  status: 'on_track' | 'at_risk' | 'behind' | 'achieved';
}

export interface StrategyTactic {
  id: string;
  name: string;
  channel: ChannelType;
  segment: AudienceSegment;
  description: string;
  expectedImpact: string;
  cost: number;
  owner: string;  // Agent ID
  status: ActionStatus;
  startDate?: Date;
  endDate?: Date;
  results?: TacticResult;
}

export interface TacticResult {
  impressions?: number;
  clicks?: number;
  conversions?: number;
  revenue?: number;
  cost?: number;
  roi?: number;
  notes: string;
}

export interface StrategyMilestone {
  id: string;
  name: string;
  targetDate: Date;
  achieved: boolean;
  achievedDate?: Date;
  criteria: string;
}

export interface KPI {
  id: string;
  name: string;
  metric: string;
  target: number;
  current: number;
  trend: 'up' | 'down' | 'stable';
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
}

// ============================================================================
// AUTONOMOUS ACTIONS
// ============================================================================

export interface StrategicRecommendation {
  id: string;
  timestamp: Date;
  
  // What
  title: string;
  description: string;
  rationale: string;
  
  // Why
  opportunity?: OpportunityData;
  threat?: ThreatData;
  dataPoints: DataPoint[];
  
  // How
  actions: ProposedAction[];
  
  // Impact
  expectedOutcome: string;
  projectedImpact: {
    users: number;
    revenue: number;
    timeframe: string;
    confidence: number;
  };
  
  // Risk
  risks: string[];
  mitigations: string[];
  
  // Approval
  priority: ActionPriority;
  requiresCEOApproval: boolean;
  autoApproveThreshold?: number;  // Auto-approve if confidence > this
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  
  // Execution
  assignedTo?: string[];
  deadline?: Date;
  executionStatus?: ActionStatus;
}

export interface ProposedAction {
  id: string;
  type: 'content' | 'campaign' | 'pricing' | 'product' | 'channel' | 'partnership';
  title: string;
  description: string;
  owner: string;  // Agent ID
  effort: 'low' | 'medium' | 'high';
  cost: number;
  timeline: string;
  dependencies: string[];
}

export interface DataPoint {
  source: string;
  metric: string;
  value: number | string;
  timestamp: Date;
  trend?: 'up' | 'down' | 'stable';
  context?: string;
}

// ============================================================================
// PLAYBOOKS
// ============================================================================

export interface GrowthPlaybook {
  id: string;
  name: string;
  description: string;
  phase: StrategyPhase;
  targetSegment: AudienceSegment;
  
  // Pre-conditions
  triggers: PlaybookTrigger[];
  
  // Steps
  steps: PlaybookStep[];
  
  // Expected results
  expectedOutcomes: {
    metric: string;
    improvement: string;
    timeframe: string;
  }[];
  
  // Automation level
  automationLevel: 'manual' | 'semi_auto' | 'full_auto';
  requiresApproval: boolean;
  
  // Track record
  timesExecuted: number;
  successRate: number;
  avgROI: number;
}

export interface PlaybookTrigger {
  type: 'metric' | 'event' | 'schedule' | 'manual';
  condition: string;
  threshold?: number;
  schedule?: string;  // Cron expression
}

export interface PlaybookStep {
  order: number;
  action: string;
  owner: string;
  inputs: Record<string, any>;
  outputs: string[];
  waitForCompletion: boolean;
  timeout?: number;
  onFailure: 'stop' | 'skip' | 'retry';
}

// ============================================================================
// CEO DASHBOARD
// ============================================================================

export interface StrategyDashboard {
  // Current state
  currentPhase: StrategyPhase;
  activeStrategy: GrowthStrategy | null;
  
  // Key metrics
  metrics: {
    totalUsers: number;
    activeUsers: number;
    newUsersToday: number;
    newUsersThisWeek: number;
    newUsersThisMonth: number;
    mrr: number;
    arr: number;
    cac: number;
    ltv: number;
    ltvCacRatio: number;
    churnRate: number;
    nps: number;
  };
  
  // Funnel
  funnel: {
    visitors: number;
    signups: number;
    activations: number;
    conversions: number;
    retained: number;
  };
  
  // Channel performance
  channelPerformance: {
    channel: ChannelType;
    users: number;
    cost: number;
    cac: number;
    revenue: number;
    roi: number;
  }[];
  
  // Segment health
  segmentHealth: {
    segment: AudienceSegment;
    users: number;
    growth: number;
    satisfaction: number;
    churn: number;
  }[];
  
  // Pending decisions
  pendingRecommendations: StrategicRecommendation[];
  
  // Recent wins
  recentWins: {
    title: string;
    impact: string;
    date: Date;
  }[];
  
  // Alerts
  alerts: {
    type: 'opportunity' | 'threat' | 'milestone' | 'anomaly';
    title: string;
    description: string;
    priority: ActionPriority;
    timestamp: Date;
  }[];
}

// ============================================================================
// AGENT CONNECTIONS
// ============================================================================

export interface AgentConnection {
  agentId: string;
  agentName: string;
  role: string;
  
  // What this agent provides
  provides: {
    dataType: string;
    frequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'on_demand';
    description: string;
  }[];
  
  // What this agent receives
  receives: {
    dataType: string;
    fromStrategy: boolean;
    description: string;
  }[];
  
  // Commands strategy can issue
  commands: {
    command: string;
    description: string;
    requiresApproval: boolean;
  }[];
}

export const AGENT_CONNECTIONS: AgentConnection[] = [
  {
    agentId: 'scout',
    agentName: 'Scout',
    role: 'Market Intelligence',
    provides: [
      { dataType: 'competitor_intel', frequency: 'daily', description: 'Competitor moves, pricing changes' },
      { dataType: 'market_trends', frequency: 'weekly', description: 'Industry trends, search volume' },
      { dataType: 'audience_insights', frequency: 'daily', description: 'Audience behavior, preferences' },
      { dataType: 'opportunity_alerts', frequency: 'realtime', description: 'New market opportunities' },
    ],
    receives: [
      { dataType: 'research_priorities', fromStrategy: true, description: 'What to research next' },
      { dataType: 'competitor_watchlist', fromStrategy: true, description: 'Competitors to monitor' },
    ],
    commands: [
      { command: 'deep_dive', description: 'Deep research on specific topic/competitor', requiresApproval: false },
      { command: 'trend_analysis', description: 'Analyze emerging trends', requiresApproval: false },
    ],
  },
  {
    agentId: 'oracle',
    agentName: 'Oracle',
    role: 'Analytics',
    provides: [
      { dataType: 'user_metrics', frequency: 'realtime', description: 'User counts, engagement' },
      { dataType: 'funnel_data', frequency: 'hourly', description: 'Conversion funnel metrics' },
      { dataType: 'cohort_analysis', frequency: 'weekly', description: 'User retention by cohort' },
      { dataType: 'revenue_metrics', frequency: 'daily', description: 'MRR, ARR, LTV, CAC' },
      { dataType: 'anomaly_alerts', frequency: 'realtime', description: 'Unusual patterns detected' },
      { dataType: 'predictions', frequency: 'daily', description: 'Churn risk, growth projections' },
    ],
    receives: [
      { dataType: 'tracking_requirements', fromStrategy: true, description: 'What to track' },
      { dataType: 'experiment_configs', fromStrategy: true, description: 'A/B test configurations' },
    ],
    commands: [
      { command: 'generate_report', description: 'Generate custom analytics report', requiresApproval: false },
      { command: 'run_analysis', description: 'Run specific analysis', requiresApproval: false },
      { command: 'setup_experiment', description: 'Configure A/B test', requiresApproval: true },
    ],
  },
  {
    agentId: 'herald',
    agentName: 'Herald',
    role: 'Marketing',
    provides: [
      { dataType: 'campaign_performance', frequency: 'daily', description: 'Campaign metrics, ROI' },
      { dataType: 'content_performance', frequency: 'daily', description: 'Blog, social engagement' },
      { dataType: 'channel_metrics', frequency: 'daily', description: 'Per-channel performance' },
      { dataType: 'brand_sentiment', frequency: 'weekly', description: 'Brand mentions, sentiment' },
    ],
    receives: [
      { dataType: 'campaign_briefs', fromStrategy: true, description: 'Campaign requirements' },
      { dataType: 'content_priorities', fromStrategy: true, description: 'Content to create' },
      { dataType: 'budget_allocation', fromStrategy: true, description: 'Channel budgets' },
    ],
    commands: [
      { command: 'launch_campaign', description: 'Launch marketing campaign', requiresApproval: true },
      { command: 'create_content', description: 'Create content piece', requiresApproval: false },
      { command: 'adjust_spend', description: 'Reallocate budget', requiresApproval: true },
      { command: 'pause_campaign', description: 'Pause underperforming campaign', requiresApproval: false },
    ],
  },
  {
    agentId: 'atlas',
    agentName: 'Atlas',
    role: 'Content Engine',
    provides: [
      { dataType: 'content_inventory', frequency: 'daily', description: 'Available content by topic' },
      { dataType: 'content_gaps', frequency: 'weekly', description: 'Missing content areas' },
      { dataType: 'quality_scores', frequency: 'daily', description: 'Content quality metrics' },
    ],
    receives: [
      { dataType: 'content_requests', fromStrategy: true, description: 'Content to generate' },
      { dataType: 'topic_priorities', fromStrategy: true, description: 'Topics to focus on' },
    ],
    commands: [
      { command: 'generate_content', description: 'Generate educational content', requiresApproval: false },
      { command: 'update_content', description: 'Update existing content', requiresApproval: false },
    ],
  },
  {
    agentId: 'mentor',
    agentName: 'Mentor',
    role: 'User Engagement',
    provides: [
      { dataType: 'engagement_metrics', frequency: 'daily', description: 'User engagement data' },
      { dataType: 'feedback_summary', frequency: 'weekly', description: 'User feedback themes' },
      { dataType: 'churn_signals', frequency: 'realtime', description: 'At-risk users' },
      { dataType: 'success_stories', frequency: 'weekly', description: 'User success cases' },
    ],
    receives: [
      { dataType: 'engagement_tactics', fromStrategy: true, description: 'Engagement strategies' },
      { dataType: 'retention_campaigns', fromStrategy: true, description: 'Retention playbooks' },
    ],
    commands: [
      { command: 'run_engagement_campaign', description: 'Run user engagement campaign', requiresApproval: false },
      { command: 'reach_out', description: 'Personal outreach to users', requiresApproval: false },
    ],
  },
  {
    agentId: 'forge',
    agentName: 'Forge',
    role: 'Technical/Deployment',
    provides: [
      { dataType: 'system_health', frequency: 'realtime', description: 'Platform status' },
      { dataType: 'feature_flags', frequency: 'on_demand', description: 'Active feature flags' },
      { dataType: 'deployment_status', frequency: 'on_demand', description: 'Deployment history' },
    ],
    receives: [
      { dataType: 'feature_requests', fromStrategy: true, description: 'Features to enable/disable' },
      { dataType: 'experiment_flags', fromStrategy: true, description: 'A/B test feature flags' },
    ],
    commands: [
      { command: 'toggle_feature', description: 'Enable/disable feature flag', requiresApproval: true },
      { command: 'rollout_feature', description: 'Gradual feature rollout', requiresApproval: true },
    ],
  },
];
