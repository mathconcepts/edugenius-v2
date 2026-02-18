// @ts-nocheck
/**
 * Strategy Engine
 * Autonomous growth strategy system for CEO
 * Monitors, recommends, and executes growth initiatives
 */

import { EventEmitter } from 'events';
import type {
  StrategyPhase,
  AudienceSegment,
  ChannelType,
  MarketIntelligence,
  GrowthStrategy,
  StrategicRecommendation,
  GrowthPlaybook,
  StrategyDashboard,
  ProposedAction,
  DataPoint,
  OpportunityData,
  ThreatData,
  AGENT_CONNECTIONS,
  ActionPriority,
} from './types';
import { ALL_PLAYBOOKS, getAutoPlaybooks } from './playbooks';

// ============================================================================
// STRATEGY ENGINE CONFIGURATION
// ============================================================================

export interface StrategyEngineConfig {
  enabled: boolean;
  
  // Autonomous operation settings
  autonomousMode: boolean;
  autoApproveThreshold: number;      // Auto-approve recommendations above this confidence
  maxAutoApproveSpend: number;       // Max spend auto-approved per action (INR)
  maxDailyAutoActions: number;       // Max autonomous actions per day
  
  // Monitoring settings
  monitoringInterval: number;        // How often to check metrics (ms)
  alertThresholds: {
    churnRateIncrease: number;       // Alert if churn increases by this %
    conversionDrop: number;          // Alert if conversion drops by this %
    competitorMove: boolean;         // Alert on competitor moves
    budgetExhaustion: number;        // Alert when budget below this %
  };
  
  // CEO preferences
  ceoPreferences: {
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    focusSegments: AudienceSegment[];
    excludedChannels: ChannelType[];
    preferredApprovalTime: string;   // e.g., "09:00-18:00 IST"
    notificationChannels: string[];  // e.g., ["telegram", "email"]
  };
  
  // Budget
  monthlyBudget: {
    total: number;
    allocated: Record<ChannelType, number>;
    spent: Record<ChannelType, number>;
    currency: string;
  };
}

const DEFAULT_CONFIG: StrategyEngineConfig = {
  enabled: true,
  autonomousMode: true,
  autoApproveThreshold: 0.85,
  maxAutoApproveSpend: 5000,
  maxDailyAutoActions: 10,
  monitoringInterval: 300000, // 5 minutes
  alertThresholds: {
    churnRateIncrease: 0.1,
    conversionDrop: 0.15,
    competitorMove: true,
    budgetExhaustion: 0.2,
  },
  ceoPreferences: {
    riskTolerance: 'moderate',
    focusSegments: ['aspirants_jee', 'aspirants_neet'],
    excludedChannels: [],
    preferredApprovalTime: '09:00-21:00',
    notificationChannels: ['telegram'],
  },
  monthlyBudget: {
    total: 100000,
    allocated: {
      organic_search: 10000,
      paid_search: 30000,
      social_organic: 5000,
      social_paid: 20000,
      youtube: 15000,
      whatsapp: 5000,
      telegram: 2000,
      referral: 5000,
      partnerships: 5000,
      offline: 0,
      email: 3000,
      content_marketing: 0,
    },
    spent: {
      organic_search: 0,
      paid_search: 0,
      social_organic: 0,
      social_paid: 0,
      youtube: 0,
      whatsapp: 0,
      telegram: 0,
      referral: 0,
      partnerships: 0,
      offline: 0,
      email: 0,
      content_marketing: 0,
    },
    currency: 'INR',
  },
};

// ============================================================================
// STRATEGY ENGINE
// ============================================================================

export class StrategyEngine extends EventEmitter {
  private config: StrategyEngineConfig;
  private currentStrategy: GrowthStrategy | null = null;
  private intelligence: MarketIntelligence[] = [];
  private recommendations: StrategicRecommendation[] = [];
  private playbooks: Map<string, GrowthPlaybook> = new Map();
  private dailyActionCount = 0;
  private lastDailyReset: Date = new Date();
  private monitoringTimer: NodeJS.Timer | null = null;
  
  // Metrics cache
  private metricsCache: Record<string, any> = {};
  private metricsCacheTime: Date | null = null;
  
  constructor(config: Partial<StrategyEngineConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Load playbooks
    for (const playbook of ALL_PLAYBOOKS) {
      this.playbooks.set(playbook.id, playbook);
    }
  }
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  async initialize(): Promise<void> {
    // Start monitoring if enabled
    if (this.config.enabled && this.config.monitoringInterval > 0) {
      this.startMonitoring();
    }
    
    this.emit('engine:initialized');
  }
  
  async shutdown(): Promise<void> {
    this.stopMonitoring();
    this.emit('engine:shutdown');
  }
  
  // ============================================================================
  // MONITORING
  // ============================================================================
  
  private startMonitoring(): void {
    if (this.monitoringTimer) return;
    
    this.monitoringTimer = setInterval(() => {
      this.runMonitoringCycle().catch(err => {
        this.emit('error', err);
      });
    }, this.config.monitoringInterval);
    
    // Run immediately
    this.runMonitoringCycle().catch(err => {
      this.emit('error', err);
    });
  }
  
  private stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
  }
  
  private async runMonitoringCycle(): Promise<void> {
    // Reset daily action count if new day
    const now = new Date();
    if (now.getDate() !== this.lastDailyReset.getDate()) {
      this.dailyActionCount = 0;
      this.lastDailyReset = now;
    }
    
    // Collect metrics from agents
    await this.collectMetrics();
    
    // Check for anomalies
    const anomalies = await this.detectAnomalies();
    
    // Check playbook triggers
    const triggeredPlaybooks = await this.checkPlaybookTriggers();
    
    // Generate recommendations
    const newRecommendations = await this.generateRecommendations(anomalies, triggeredPlaybooks);
    
    // Auto-approve if enabled and meets threshold
    if (this.config.autonomousMode) {
      await this.processAutoApprovals(newRecommendations);
    }
    
    this.emit('monitoring:cycle:complete', {
      anomalies,
      triggeredPlaybooks,
      newRecommendations,
    });
  }
  
  // ============================================================================
  // METRICS COLLECTION
  // ============================================================================
  
  private async collectMetrics(): Promise<void> {
    // In production, this would call Oracle agent
    // For now, simulate metrics collection
    
    this.metricsCache = {
      // User metrics
      totalUsers: 15000,
      activeUsers: 4500,
      newUsersToday: 120,
      newUsersThisWeek: 780,
      newUsersThisMonth: 2800,
      
      // Revenue
      mrr: 450000,
      arr: 5400000,
      
      // Unit economics
      cac: 120,
      ltv: 1800,
      ltvCacRatio: 15,
      
      // Retention
      churnRate: 0.045,
      day1Retention: 0.55,
      day7Retention: 0.35,
      day30Retention: 0.22,
      
      // Conversion funnel
      visitors: 50000,
      signups: 2500,
      activations: 1875,
      conversions: 375,
      
      // NPS
      nps: 45,
      
      // Channel performance
      channels: {
        organic_search: { users: 800, cost: 8000, cac: 100, revenue: 120000, roi: 15 },
        paid_search: { users: 400, cost: 24000, cac: 600, revenue: 60000, roi: 2.5 },
        social_organic: { users: 300, cost: 2000, cac: 67, revenue: 45000, roi: 22.5 },
        youtube: { users: 500, cost: 10000, cac: 200, revenue: 75000, roi: 7.5 },
        referral: { users: 200, cost: 3000, cac: 150, revenue: 36000, roi: 12 },
      },
      
      // Segment health
      segments: {
        aspirants_jee: { users: 8000, growth: 0.15, satisfaction: 4.2, churn: 0.04 },
        aspirants_neet: { users: 5000, growth: 0.12, satisfaction: 4.0, churn: 0.05 },
        cbse_12: { users: 1500, growth: 0.08, satisfaction: 3.8, churn: 0.06 },
        cbse_10: { users: 500, growth: 0.05, satisfaction: 3.5, churn: 0.08 },
      },
    };
    
    this.metricsCacheTime = new Date();
    this.emit('metrics:collected', this.metricsCache);
  }
  
  // ============================================================================
  // ANOMALY DETECTION
  // ============================================================================
  
  private async detectAnomalies(): Promise<{type: string; severity: string; details: any}[]> {
    const anomalies: {type: string; severity: string; details: any}[] = [];
    
    const metrics = this.metricsCache;
    const thresholds = this.config.alertThresholds;
    
    // Check churn rate
    if (metrics.churnRate > 0.05 * (1 + thresholds.churnRateIncrease)) {
      anomalies.push({
        type: 'churn_spike',
        severity: 'high',
        details: { current: metrics.churnRate, expected: 0.05 },
      });
    }
    
    // Check conversion rate
    const conversionRate = metrics.conversions / metrics.signups;
    if (conversionRate < 0.15 * (1 - thresholds.conversionDrop)) {
      anomalies.push({
        type: 'conversion_drop',
        severity: 'high',
        details: { current: conversionRate, expected: 0.15 },
      });
    }
    
    // Check budget exhaustion
    const budgetSpent = Object.values(this.config.monthlyBudget.spent).reduce((a, b) => a + b, 0);
    const budgetRemaining = this.config.monthlyBudget.total - budgetSpent;
    const budgetRatio = budgetRemaining / this.config.monthlyBudget.total;
    
    if (budgetRatio < thresholds.budgetExhaustion) {
      anomalies.push({
        type: 'budget_low',
        severity: 'medium',
        details: { remaining: budgetRemaining, ratio: budgetRatio },
      });
    }
    
    // Check channel ROI anomalies
    for (const [channel, data] of Object.entries(metrics.channels || {})) {
      if ((data as any).roi < 1) {
        anomalies.push({
          type: 'negative_roi_channel',
          severity: 'medium',
          details: { channel, roi: (data as any).roi },
        });
      }
    }
    
    if (anomalies.length > 0) {
      this.emit('anomalies:detected', anomalies);
    }
    
    return anomalies;
  }
  
  // ============================================================================
  // PLAYBOOK TRIGGERS
  // ============================================================================
  
  private async checkPlaybookTriggers(): Promise<GrowthPlaybook[]> {
    const triggered: GrowthPlaybook[] = [];
    
    for (const playbook of this.playbooks.values()) {
      for (const trigger of playbook.triggers) {
        let shouldTrigger = false;
        
        switch (trigger.type) {
          case 'metric':
            shouldTrigger = this.evaluateMetricTrigger(trigger.condition, trigger.threshold);
            break;
            
          case 'schedule':
            shouldTrigger = this.evaluateScheduleTrigger(trigger.schedule!);
            break;
            
          case 'event':
            // Events are triggered externally
            break;
        }
        
        if (shouldTrigger) {
          triggered.push(playbook);
          this.emit('playbook:triggered', playbook);
          break;
        }
      }
    }
    
    return triggered;
  }
  
  private evaluateMetricTrigger(condition: string, threshold?: number): boolean {
    // Parse simple conditions like "churn_rate > 0.05"
    const metrics = this.metricsCache;
    
    // Simple pattern matching
    const patterns: Record<string, () => boolean> = {
      'activation_rate < 30%': () => (metrics.activations / metrics.signups) < 0.3,
      'day1_retention < 40%': () => metrics.day1Retention < 0.4,
      'churn_rate > 5%': () => metrics.churnRate > 0.05,
      'free_to_paid_rate < 5%': () => (metrics.conversions / metrics.activations) < 0.05,
    };
    
    for (const [pattern, check] of Object.entries(patterns)) {
      if (condition.toLowerCase().includes(pattern.split(' ')[0].toLowerCase())) {
        return check();
      }
    }
    
    return false;
  }
  
  private evaluateScheduleTrigger(schedule: string): boolean {
    // Simple schedule matching (would use proper cron in production)
    // For now, return false to prevent auto-triggering
    return false;
  }
  
  // ============================================================================
  // RECOMMENDATION GENERATION
  // ============================================================================
  
  private async generateRecommendations(
    anomalies: {type: string; severity: string; details: any}[],
    triggeredPlaybooks: GrowthPlaybook[]
  ): Promise<StrategicRecommendation[]> {
    const recommendations: StrategicRecommendation[] = [];
    
    // Generate recommendations from anomalies
    for (const anomaly of anomalies) {
      const rec = await this.generateAnomalyRecommendation(anomaly);
      if (rec) {
        recommendations.push(rec);
        this.recommendations.push(rec);
      }
    }
    
    // Generate recommendations from triggered playbooks
    for (const playbook of triggeredPlaybooks) {
      const rec = await this.generatePlaybookRecommendation(playbook);
      if (rec) {
        recommendations.push(rec);
        this.recommendations.push(rec);
      }
    }
    
    // Generate opportunity-based recommendations
    const opportunities = await this.identifyOpportunities();
    for (const opp of opportunities) {
      const rec = await this.generateOpportunityRecommendation(opp);
      if (rec) {
        recommendations.push(rec);
        this.recommendations.push(rec);
      }
    }
    
    if (recommendations.length > 0) {
      this.emit('recommendations:generated', recommendations);
    }
    
    return recommendations;
  }
  
  private async generateAnomalyRecommendation(
    anomaly: {type: string; severity: string; details: any}
  ): Promise<StrategicRecommendation | null> {
    const id = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    switch (anomaly.type) {
      case 'churn_spike':
        return {
          id,
          timestamp: new Date(),
          title: 'Urgent: Churn Rate Spike Detected',
          description: `Churn rate has increased to ${(anomaly.details.current * 100).toFixed(1)}% vs expected ${(anomaly.details.expected * 100).toFixed(1)}%`,
          rationale: 'High churn directly impacts MRR and requires immediate attention',
          dataPoints: [
            { source: 'oracle', metric: 'churn_rate', value: anomaly.details.current, timestamp: new Date() },
          ],
          actions: [
            {
              id: `action_${id}_1`,
              type: 'campaign',
              title: 'Launch churn prevention campaign',
              description: 'Identify at-risk users and send personalized win-back messages',
              owner: 'mentor',
              effort: 'low',
              cost: 0,
              timeline: '24 hours',
              dependencies: [],
            },
            {
              id: `action_${id}_2`,
              type: 'product',
              title: 'Analyze churn reasons',
              description: 'Deep-dive into why users are leaving',
              owner: 'oracle',
              effort: 'medium',
              cost: 0,
              timeline: '48 hours',
              dependencies: [],
            },
          ],
          expectedOutcome: 'Reduce churn rate by 20% within 2 weeks',
          projectedImpact: {
            users: 50,
            revenue: 90000,
            timeframe: '14 days',
            confidence: 0.75,
          },
          risks: ['May require discounts which reduce margin'],
          mitigations: ['Focus on value communication over discounts'],
          priority: 'critical',
          requiresCEOApproval: false,
          autoApproveThreshold: 0.7,
          status: 'pending',
        };
        
      case 'negative_roi_channel':
        return {
          id,
          timestamp: new Date(),
          title: `Pause Underperforming Channel: ${anomaly.details.channel}`,
          description: `${anomaly.details.channel} has ROI of ${anomaly.details.roi}x - below break-even`,
          rationale: 'Spending money with negative returns should be paused and reallocated',
          dataPoints: [
            { source: 'oracle', metric: 'channel_roi', value: anomaly.details.roi, timestamp: new Date() },
          ],
          actions: [
            {
              id: `action_${id}_1`,
              type: 'channel',
              title: `Pause ${anomaly.details.channel} spend`,
              description: 'Stop spending on underperforming channel',
              owner: 'herald',
              effort: 'low',
              cost: 0,
              timeline: '1 hour',
              dependencies: [],
            },
            {
              id: `action_${id}_2`,
              type: 'channel',
              title: 'Reallocate budget to best performer',
              description: 'Move budget to highest ROI channel',
              owner: 'herald',
              effort: 'low',
              cost: 0,
              timeline: '1 hour',
              dependencies: [`action_${id}_1`],
            },
          ],
          expectedOutcome: 'Improve overall marketing ROI by 20%',
          projectedImpact: {
            users: 20,
            revenue: 30000,
            timeframe: '7 days',
            confidence: 0.85,
          },
          risks: ['May miss channel-specific audience'],
          mitigations: ['Keep minimal spend for testing'],
          priority: 'high',
          requiresCEOApproval: true,
          status: 'pending',
        };
        
      default:
        return null;
    }
  }
  
  private async generatePlaybookRecommendation(
    playbook: GrowthPlaybook
  ): Promise<StrategicRecommendation | null> {
    const id = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    return {
      id,
      timestamp: new Date(),
      title: `Execute Playbook: ${playbook.name}`,
      description: playbook.description,
      rationale: `Playbook triggered by: ${playbook.triggers.map(t => t.condition).join(', ')}`,
      dataPoints: [],
      actions: playbook.steps.map((step, i) => ({
        id: `action_${id}_${i}`,
        type: 'campaign',
        title: step.action,
        description: step.action,
        owner: step.owner,
        effort: 'medium',
        cost: 0,
        timeline: `Step ${step.order}`,
        dependencies: [],
      })),
      expectedOutcome: playbook.expectedOutcomes.map(o => `${o.metric}: ${o.improvement}`).join(', '),
      projectedImpact: {
        users: 100,
        revenue: 150000,
        timeframe: '30 days',
        confidence: playbook.successRate || 0.7,
      },
      risks: ['Execution may vary from expected'],
      mitigations: ['Monitor closely and adjust'],
      priority: 'medium',
      requiresCEOApproval: playbook.requiresApproval,
      autoApproveThreshold: playbook.requiresApproval ? undefined : 0.7,
      status: 'pending',
    };
  }
  
  private async identifyOpportunities(): Promise<OpportunityData[]> {
    const opportunities: OpportunityData[] = [];
    const metrics = this.metricsCache;
    
    // Opportunity: High-growth segment underserved
    const segments = metrics.segments || {};
    for (const [segmentId, data] of Object.entries(segments)) {
      const seg = data as any;
      if (seg.growth > 0.1 && seg.users < 5000) {
        opportunities.push({
          id: `opp_${segmentId}_growth`,
          title: `Accelerate ${segmentId} Growth`,
          description: `${segmentId} is growing at ${(seg.growth * 100).toFixed(0)}% but only has ${seg.users} users`,
          segment: segmentId as AudienceSegment,
          potentialRevenue: seg.users * 1000 * 2, // Double the users * avg revenue
          effort: 'medium',
          timeToCapture: '30 days',
          confidence: 0.7,
          requiredActions: ['Create targeted content', 'Run segment-specific campaigns'],
        });
      }
    }
    
    // Opportunity: High LTV/CAC ratio channel
    const channels = metrics.channels || {};
    for (const [channelId, data] of Object.entries(channels)) {
      const ch = data as any;
      if (ch.roi > 10) {
        opportunities.push({
          id: `opp_${channelId}_scale`,
          title: `Scale ${channelId} - High ROI`,
          description: `${channelId} has ${ch.roi}x ROI - opportunity to increase spend`,
          segment: 'aspirants_jee',
          potentialRevenue: ch.revenue * 0.5, // 50% more revenue if scaled
          effort: 'low',
          timeToCapture: '7 days',
          confidence: 0.85,
          requiredActions: ['Increase budget by 50%', 'Monitor for diminishing returns'],
        });
      }
    }
    
    return opportunities;
  }
  
  private async generateOpportunityRecommendation(
    opportunity: OpportunityData
  ): Promise<StrategicRecommendation | null> {
    const id = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    return {
      id,
      timestamp: new Date(),
      title: opportunity.title,
      description: opportunity.description,
      rationale: `Potential revenue: ₹${opportunity.potentialRevenue.toLocaleString()} with ${opportunity.effort} effort`,
      opportunity,
      dataPoints: [],
      actions: opportunity.requiredActions.map((action, i) => ({
        id: `action_${id}_${i}`,
        type: 'campaign',
        title: action,
        description: action,
        owner: 'herald',
        effort: opportunity.effort,
        cost: 0,
        timeline: opportunity.timeToCapture,
        dependencies: [],
      })),
      expectedOutcome: `Capture ₹${opportunity.potentialRevenue.toLocaleString()} additional revenue`,
      projectedImpact: {
        users: Math.floor(opportunity.potentialRevenue / 1000),
        revenue: opportunity.potentialRevenue,
        timeframe: opportunity.timeToCapture,
        confidence: opportunity.confidence,
      },
      risks: ['Market conditions may change'],
      mitigations: ['Start small and scale'],
      priority: opportunity.effort === 'low' ? 'high' : 'medium',
      requiresCEOApproval: opportunity.potentialRevenue > 100000,
      autoApproveThreshold: opportunity.confidence > 0.8 ? opportunity.confidence : undefined,
      status: 'pending',
    };
  }
  
  // ============================================================================
  // AUTO-APPROVAL
  // ============================================================================
  
  private async processAutoApprovals(recommendations: StrategicRecommendation[]): Promise<void> {
    if (this.dailyActionCount >= this.config.maxDailyAutoActions) {
      this.emit('auto_approval:limit_reached', { count: this.dailyActionCount });
      return;
    }
    
    for (const rec of recommendations) {
      if (rec.requiresCEOApproval) continue;
      if (!rec.autoApproveThreshold) continue;
      
      const confidence = rec.projectedImpact.confidence;
      const cost = rec.actions.reduce((sum, a) => sum + a.cost, 0);
      
      // Check if meets auto-approve criteria
      if (
        confidence >= rec.autoApproveThreshold &&
        confidence >= this.config.autoApproveThreshold &&
        cost <= this.config.maxAutoApproveSpend &&
        this.dailyActionCount < this.config.maxDailyAutoActions
      ) {
        rec.status = 'approved';
        rec.approvedBy = 'strategy_engine_auto';
        rec.approvedAt = new Date();
        
        this.dailyActionCount++;
        
        this.emit('recommendation:auto_approved', rec);
        
        // Execute the recommendation
        await this.executeRecommendation(rec);
      }
    }
  }
  
  // ============================================================================
  // EXECUTION
  // ============================================================================
  
  private async executeRecommendation(rec: StrategicRecommendation): Promise<void> {
    rec.executionStatus = 'in_progress';
    this.emit('recommendation:executing', rec);
    
    // In production, this would dispatch to actual agents
    // For now, emit events that agents would listen to
    
    for (const action of rec.actions) {
      this.emit('action:dispatch', {
        recommendationId: rec.id,
        action,
      });
    }
  }
  
  // ============================================================================
  // CEO INTERFACE
  // ============================================================================
  
  /**
   * Get dashboard data for CEO
   */
  getDashboard(): StrategyDashboard {
    const metrics = this.metricsCache;
    
    return {
      currentPhase: 'growth',
      activeStrategy: this.currentStrategy,
      
      metrics: {
        totalUsers: metrics.totalUsers || 0,
        activeUsers: metrics.activeUsers || 0,
        newUsersToday: metrics.newUsersToday || 0,
        newUsersThisWeek: metrics.newUsersThisWeek || 0,
        newUsersThisMonth: metrics.newUsersThisMonth || 0,
        mrr: metrics.mrr || 0,
        arr: metrics.arr || 0,
        cac: metrics.cac || 0,
        ltv: metrics.ltv || 0,
        ltvCacRatio: metrics.ltvCacRatio || 0,
        churnRate: metrics.churnRate || 0,
        nps: metrics.nps || 0,
      },
      
      funnel: {
        visitors: metrics.visitors || 0,
        signups: metrics.signups || 0,
        activations: metrics.activations || 0,
        conversions: metrics.conversions || 0,
        retained: Math.floor((metrics.activeUsers || 0) * 0.7),
      },
      
      channelPerformance: Object.entries(metrics.channels || {}).map(([channel, data]: [string, any]) => ({
        channel: channel as ChannelType,
        users: data.users,
        cost: data.cost,
        cac: data.cac,
        revenue: data.revenue,
        roi: data.roi,
      })),
      
      segmentHealth: Object.entries(metrics.segments || {}).map(([segment, data]: [string, any]) => ({
        segment: segment as AudienceSegment,
        users: data.users,
        growth: data.growth,
        satisfaction: data.satisfaction,
        churn: data.churn,
      })),
      
      pendingRecommendations: this.recommendations.filter(r => r.status === 'pending'),
      
      recentWins: [],
      
      alerts: [],
    };
  }
  
  /**
   * CEO approves a recommendation
   */
  async approveRecommendation(recId: string): Promise<void> {
    const rec = this.recommendations.find(r => r.id === recId);
    if (!rec) throw new Error('Recommendation not found');
    
    rec.status = 'approved';
    rec.approvedBy = 'ceo';
    rec.approvedAt = new Date();
    
    this.emit('recommendation:approved', rec);
    
    await this.executeRecommendation(rec);
  }
  
  /**
   * CEO rejects a recommendation
   */
  rejectRecommendation(recId: string, reason: string): void {
    const rec = this.recommendations.find(r => r.id === recId);
    if (!rec) throw new Error('Recommendation not found');
    
    rec.status = 'rejected';
    rec.rejectionReason = reason;
    
    this.emit('recommendation:rejected', rec);
  }
  
  /**
   * Get all recommendations
   */
  getRecommendations(filter?: { status?: string; priority?: string }): StrategicRecommendation[] {
    let recs = [...this.recommendations];
    
    if (filter?.status) {
      recs = recs.filter(r => r.status === filter.status);
    }
    if (filter?.priority) {
      recs = recs.filter(r => r.priority === filter.priority);
    }
    
    return recs.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
    });
  }
  
  /**
   * Get available playbooks
   */
  getPlaybooks(): GrowthPlaybook[] {
    return Array.from(this.playbooks.values());
  }
  
  /**
   * Manually trigger a playbook
   */
  async triggerPlaybook(playbookId: string): Promise<StrategicRecommendation | null> {
    const playbook = this.playbooks.get(playbookId);
    if (!playbook) throw new Error('Playbook not found');
    
    const rec = await this.generatePlaybookRecommendation(playbook);
    if (rec) {
      this.recommendations.push(rec);
      this.emit('playbook:triggered:manual', { playbook, recommendation: rec });
    }
    
    return rec;
  }
  
  /**
   * Update configuration
   */
  updateConfig(updates: Partial<StrategyEngineConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config:updated', this.config);
  }
  
  /**
   * Get current configuration
   */
  getConfig(): StrategyEngineConfig {
    return { ...this.config };
  }
  
  /**
   * Ingest intelligence from agents
   */
  ingestIntelligence(intel: MarketIntelligence): void {
    this.intelligence.push(intel);
    this.emit('intelligence:received', intel);
    
    // Trim old intelligence
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    this.intelligence = this.intelligence.filter(i => i.timestamp >= cutoff);
  }
  
  /**
   * Get agent connections
   */
  getAgentConnections(): AgentConnection[] {
    // Import at runtime to avoid circular dependency
    const { AGENT_CONNECTIONS } = require('./types') as { AGENT_CONNECTIONS: AgentConnection[] };
    return AGENT_CONNECTIONS;
  }
}

// Singleton instance
export const strategyEngine = new StrategyEngine();
