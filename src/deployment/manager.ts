/**
 * Deployment Manager
 * Handles pilot/full deployment modes with feature flags and metrics
 */

import { randomUUID } from 'crypto';
import {
  DeploymentState,
  DeploymentMode,
  FeatureFlagState,
  PilotDeploymentConfig,
  DeploymentMetrics,
  ExamDeployment,
  ExamDeploymentConfig,
  FeatureFlag,
  AudienceTarget,
  RollbackTrigger,
  SuccessCriterion,
  PromotionCriteria,
  DeploymentEvent,
  DeploymentEventType,
  AudienceSelectionMethod,
} from './types';

// ============================================================================
// Deployment Manager
// ============================================================================

export class DeploymentManager {
  private deployments: Map<string, ExamDeployment> = new Map();
  private featureFlags: Map<string, FeatureFlag> = new Map();
  private events: DeploymentEvent[] = [];

  constructor() {
    this.initializeDefaultFeatureFlags();
  }

  // -------------------------------------------------------------------------
  // Exam Deployment
  // -------------------------------------------------------------------------

  async createDeployment(params: {
    examId: string;
    examCode: string;
    examName: string;
    config: ExamDeploymentConfig;
    pilotConfig?: Partial<PilotDeploymentConfig>;
  }): Promise<ExamDeployment> {
    const {
      examId,
      examCode,
      examName,
      config,
      pilotConfig,
    } = params;

    const defaultPilotConfig: PilotDeploymentConfig = {
      audienceMethod: 'signup_source',
      audienceFilter: {},
      targetSize: 100,
      currentSize: 0,
      durationType: 'fixed',
      durationDays: 14,
      rollbackTriggers: [
        {
          id: randomUUID(),
          metric: 'errorRate',
          operator: 'gt',
          threshold: 0.05,
          window: '1h',
          triggered: false,
        },
        {
          id: randomUUID(),
          metric: 'churnRate',
          operator: 'gt',
          threshold: 0.2,
          window: '24h',
          triggered: false,
        },
      ],
      successCriteria: [
        {
          id: randomUUID(),
          metric: 'retentionRate',
          target: 0.7,
          operator: 'gte',
          weight: 0.4,
          achieved: false,
        },
        {
          id: randomUUID(),
          metric: 'conversionRate',
          target: 0.05,
          operator: 'gte',
          weight: 0.3,
          achieved: false,
        },
        {
          id: randomUUID(),
          metric: 'avgSessionDuration',
          target: 300,
          operator: 'gte',
          weight: 0.3,
          achieved: false,
        },
      ],
      status: 'active',
    };

    const state: DeploymentState = {
      examId,
      mode: 'pilot',
      features: new Map(),
      pilotConfig: { ...defaultPilotConfig, ...pilotConfig },
      metrics: this.createEmptyMetrics(),
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Initialize feature states
    for (const featureId of config.features) {
      const flag = this.featureFlags.get(featureId);
      if (flag) {
        state.features.set(featureId, {
          id: featureId,
          name: flag.name,
          enabled: flag.enabled,
          rolloutPercentage: flag.pilotOnly ? 100 : flag.rolloutPercentage,
          pilotOnly: flag.pilotOnly,
          impressions: 0,
          activations: 0,
        });
      }
    }

    const deployment: ExamDeployment = {
      examId,
      examCode,
      examName,
      mode: 'pilot',
      config,
      state,
      promotionCriteria: {
        minPilotDuration: 7,
        minPilotUsers: 50,
        metrics: [
          { name: 'retentionRate', threshold: 0.6, operator: 'gte', required: true },
          { name: 'errorRate', threshold: 0.05, operator: 'lt', required: true },
        ],
      },
      status: 'draft',
    };

    this.deployments.set(examId, deployment);
    await this.recordEvent(examId, 'deployment.created', { config });

    return deployment;
  }

  private createEmptyMetrics(): DeploymentMetrics {
    return {
      totalUsers: 0,
      activeUsers: 0,
      pilotUsers: 0,
      avgSessionDuration: 0,
      sessionsPerUser: 0,
      retentionRate: 0,
      conversionRate: 0,
      revenue: 0,
      churnRate: 0,
      errorRate: 0,
      latencyP50: 0,
      latencyP95: 0,
      updatedAt: Date.now(),
    };
  }

  async getDeployment(examId: string): Promise<ExamDeployment | undefined> {
    return this.deployments.get(examId);
  }

  async listDeployments(filter?: {
    status?: string;
    mode?: DeploymentMode;
  }): Promise<ExamDeployment[]> {
    let deployments = Array.from(this.deployments.values());

    if (filter) {
      if (filter.status) {
        deployments = deployments.filter(d => d.status === filter.status);
      }
      if (filter.mode) {
        deployments = deployments.filter(d => d.mode === filter.mode);
      }
    }

    return deployments;
  }

  // -------------------------------------------------------------------------
  // Pilot Management
  // -------------------------------------------------------------------------

  async startPilot(examId: string): Promise<ExamDeployment | undefined> {
    const deployment = this.deployments.get(examId);
    if (!deployment) return undefined;

    deployment.status = 'pilot';
    deployment.mode = 'pilot';
    deployment.pilotStartDate = Date.now();
    deployment.state.startedAt = Date.now();

    if (deployment.state.pilotConfig?.durationType === 'fixed' &&
        deployment.state.pilotConfig.durationDays) {
      deployment.pilotEndDate = Date.now() + 
        (deployment.state.pilotConfig.durationDays * 24 * 60 * 60 * 1000);
    }

    this.deployments.set(examId, deployment);
    await this.recordEvent(examId, 'deployment.pilot_started', {});

    return deployment;
  }

  async extendPilot(examId: string, additionalDays: number): Promise<ExamDeployment | undefined> {
    const deployment = this.deployments.get(examId);
    if (!deployment || deployment.mode !== 'pilot') return undefined;

    if (deployment.pilotEndDate) {
      deployment.pilotEndDate += additionalDays * 24 * 60 * 60 * 1000;
    }

    if (deployment.state.pilotConfig?.durationDays) {
      deployment.state.pilotConfig.durationDays += additionalDays;
    }

    this.deployments.set(examId, deployment);
    await this.recordEvent(examId, 'deployment.pilot_extended', { additionalDays });

    return deployment;
  }

  async checkPilotStatus(examId: string): Promise<{
    canPromote: boolean;
    issues: string[];
    successCriteria: Array<{ name: string; achieved: boolean; value: number; target: number }>;
  }> {
    const deployment = this.deployments.get(examId);
    if (!deployment || deployment.mode !== 'pilot') {
      return { canPromote: false, issues: ['Deployment not in pilot mode'], successCriteria: [] };
    }

    const issues: string[] = [];
    const successCriteria: Array<{ name: string; achieved: boolean; value: number; target: number }> = [];

    const pilotConfig = deployment.state.pilotConfig;
    const metrics = deployment.state.metrics;
    const promotionCriteria = deployment.promotionCriteria;

    // Check minimum pilot duration
    const pilotDuration = Date.now() - (deployment.pilotStartDate || 0);
    const minDurationMs = promotionCriteria.minPilotDuration * 24 * 60 * 60 * 1000;
    if (pilotDuration < minDurationMs) {
      issues.push(`Minimum pilot duration not met (${Math.floor(pilotDuration / 86400000)}/${promotionCriteria.minPilotDuration} days)`);
    }

    // Check minimum pilot users
    if (metrics.pilotUsers < promotionCriteria.minPilotUsers) {
      issues.push(`Minimum pilot users not met (${metrics.pilotUsers}/${promotionCriteria.minPilotUsers})`);
    }

    // Check success criteria
    if (pilotConfig?.successCriteria) {
      for (const criterion of pilotConfig.successCriteria) {
        const value = this.getMetricValue(metrics, criterion.metric);
        const achieved = this.checkCriterion(value, criterion.target, criterion.operator);
        
        criterion.achieved = achieved;
        criterion.currentValue = value;
        
        successCriteria.push({
          name: criterion.metric,
          achieved,
          value,
          target: criterion.target,
        });
      }
    }

    // Check promotion metrics
    for (const metric of promotionCriteria.metrics) {
      const value = this.getMetricValue(metrics, metric.name);
      const met = this.checkCriterion(value, metric.threshold, metric.operator);
      
      if (!met && metric.required) {
        issues.push(`Required metric ${metric.name} not met (${value} vs ${metric.operator} ${metric.threshold})`);
      }
    }

    // Check for triggered rollback conditions
    if (pilotConfig?.rollbackTriggers) {
      for (const trigger of pilotConfig.rollbackTriggers) {
        if (trigger.triggered) {
          issues.push(`Rollback trigger active: ${trigger.metric} ${trigger.operator} ${trigger.threshold}`);
        }
      }
    }

    return {
      canPromote: issues.length === 0,
      issues,
      successCriteria,
    };
  }

  private getMetricValue(metrics: DeploymentMetrics, name: string): number {
    return (metrics as unknown as Record<string, number>)[name] || 0;
  }

  private checkCriterion(value: number, target: number, operator: string): boolean {
    switch (operator) {
      case 'gt': return value > target;
      case 'gte': return value >= target;
      case 'lt': return value < target;
      case 'lte': return value <= target;
      case 'eq': return value === target;
      case 'ne': return value !== target;
      default: return false;
    }
  }

  // -------------------------------------------------------------------------
  // Full Deployment
  // -------------------------------------------------------------------------

  async promoteToFull(examId: string): Promise<ExamDeployment | undefined> {
    const deployment = this.deployments.get(examId);
    if (!deployment) return undefined;

    // Check if can promote
    const { canPromote, issues } = await this.checkPilotStatus(examId);
    if (!canPromote) {
      throw new Error(`Cannot promote to full: ${issues.join(', ')}`);
    }

    deployment.status = 'full';
    deployment.mode = 'full';
    deployment.fullLaunchDate = Date.now();
    deployment.state.mode = 'full';

    // Update feature flags for full rollout
    for (const [featureId, featureState] of deployment.state.features) {
      if (featureState.pilotOnly) {
        featureState.enabled = false;
      } else {
        featureState.rolloutPercentage = 100;
      }
    }

    // Mark pilot config as succeeded
    if (deployment.state.pilotConfig) {
      deployment.state.pilotConfig.status = 'succeeded';
    }

    this.deployments.set(examId, deployment);
    await this.recordEvent(examId, 'deployment.promoted_to_full', {});

    return deployment;
  }

  async rollback(examId: string, reason: string): Promise<ExamDeployment | undefined> {
    const deployment = this.deployments.get(examId);
    if (!deployment) return undefined;

    // Disable all features
    for (const featureState of deployment.state.features.values()) {
      featureState.enabled = false;
      featureState.rolloutPercentage = 0;
    }

    deployment.status = 'paused';
    deployment.state.endedAt = Date.now();

    if (deployment.state.pilotConfig) {
      deployment.state.pilotConfig.status = 'rolled_back';
      deployment.state.pilotConfig.statusReason = reason;
    }

    this.deployments.set(examId, deployment);
    await this.recordEvent(examId, 'deployment.rolled_back', { reason });

    return deployment;
  }

  // -------------------------------------------------------------------------
  // Feature Flags
  // -------------------------------------------------------------------------

  async createFeatureFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): Promise<FeatureFlag> {
    const newFlag: FeatureFlag = {
      ...flag,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.featureFlags.set(newFlag.id, newFlag);
    return newFlag;
  }

  async getFeatureFlag(id: string): Promise<FeatureFlag | undefined> {
    return this.featureFlags.get(id);
  }

  async listFeatureFlags(filter?: {
    category?: string;
    enabled?: boolean;
    pilotOnly?: boolean;
  }): Promise<FeatureFlag[]> {
    let flags = Array.from(this.featureFlags.values());

    if (filter) {
      if (filter.category) {
        flags = flags.filter(f => f.category === filter.category);
      }
      if (filter.enabled !== undefined) {
        flags = flags.filter(f => f.enabled === filter.enabled);
      }
      if (filter.pilotOnly !== undefined) {
        flags = flags.filter(f => f.pilotOnly === filter.pilotOnly);
      }
    }

    return flags;
  }

  async setFeatureEnabled(
    examId: string,
    featureId: string,
    enabled: boolean
  ): Promise<boolean> {
    const deployment = this.deployments.get(examId);
    if (!deployment) return false;

    const featureState = deployment.state.features.get(featureId);
    if (!featureState) return false;

    featureState.enabled = enabled;
    deployment.state.updatedAt = Date.now();

    this.deployments.set(examId, deployment);
    await this.recordEvent(examId, enabled ? 'feature.enabled' : 'feature.disabled', { featureId });

    return true;
  }

  async setFeatureRollout(
    examId: string,
    featureId: string,
    percentage: number
  ): Promise<boolean> {
    const deployment = this.deployments.get(examId);
    if (!deployment) return false;

    const featureState = deployment.state.features.get(featureId);
    if (!featureState) return false;

    featureState.rolloutPercentage = Math.max(0, Math.min(100, percentage));
    deployment.state.updatedAt = Date.now();

    this.deployments.set(examId, deployment);
    await this.recordEvent(examId, 'feature.rollout_updated', { featureId, percentage });

    return true;
  }

  // -------------------------------------------------------------------------
  // Audience Targeting
  // -------------------------------------------------------------------------

  async isUserInPilot(examId: string, user: {
    id: string;
    signupSource?: string;
    geography?: string;
    cohort?: string;
  }): Promise<boolean> {
    const deployment = this.deployments.get(examId);
    if (!deployment || deployment.mode !== 'pilot') return false;

    const pilotConfig = deployment.state.pilotConfig;
    if (!pilotConfig) return false;

    switch (pilotConfig.audienceMethod) {
      case 'signup_source':
        const sources = pilotConfig.audienceFilter.sources as string[] | undefined;
        return sources ? sources.includes(user.signupSource || '') : false;

      case 'geography':
        const geos = pilotConfig.audienceFilter.geographies as string[] | undefined;
        return geos ? geos.includes(user.geography || '') : false;

      case 'cohort':
        const cohorts = pilotConfig.audienceFilter.cohorts as string[] | undefined;
        return cohorts ? cohorts.includes(user.cohort || '') : false;

      case 'random':
        const percentage = pilotConfig.audienceFilter.percentage as number || 10;
        return this.hashUserId(user.id) % 100 < percentage;

      default:
        return false;
    }
  }

  async isFeatureEnabled(
    examId: string,
    featureId: string,
    userId?: string
  ): Promise<boolean> {
    const deployment = this.deployments.get(examId);
    if (!deployment) return false;

    const featureState = deployment.state.features.get(featureId);
    if (!featureState || !featureState.enabled) return false;

    // Pilot-only features disabled in full mode
    if (featureState.pilotOnly && deployment.mode === 'full') return false;

    // Check rollout percentage
    if (featureState.rolloutPercentage < 100 && userId) {
      const hash = this.hashUserId(userId + featureId);
      if (hash % 100 >= featureState.rolloutPercentage) {
        return false;
      }
    }

    // Check audience targeting
    if (featureState.targetAudience) {
      // Would check against user properties
      // Simplified for now
    }

    // Track impression
    featureState.impressions++;

    return true;
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // -------------------------------------------------------------------------
  // Metrics
  // -------------------------------------------------------------------------

  async updateMetrics(examId: string, metrics: Partial<DeploymentMetrics>): Promise<void> {
    const deployment = this.deployments.get(examId);
    if (!deployment) return;

    deployment.state.metrics = {
      ...deployment.state.metrics,
      ...metrics,
      updatedAt: Date.now(),
    };

    // Check rollback triggers
    if (deployment.state.pilotConfig?.rollbackTriggers) {
      for (const trigger of deployment.state.pilotConfig.rollbackTriggers) {
        const value = this.getMetricValue(deployment.state.metrics, trigger.metric);
        const triggered = this.checkCriterion(value, trigger.threshold, trigger.operator);
        
        if (triggered && !trigger.triggered) {
          trigger.triggered = true;
          trigger.triggeredAt = Date.now();
          await this.recordEvent(examId, 'metric.threshold_breached', {
            metric: trigger.metric,
            value,
            threshold: trigger.threshold,
          });
        }
      }
    }

    // Check success criteria
    if (deployment.state.pilotConfig?.successCriteria) {
      for (const criterion of deployment.state.pilotConfig.successCriteria) {
        const value = this.getMetricValue(deployment.state.metrics, criterion.metric);
        const achieved = this.checkCriterion(value, criterion.target, criterion.operator);
        
        if (achieved && !criterion.achieved) {
          criterion.achieved = true;
          criterion.currentValue = value;
          await this.recordEvent(examId, 'metric.success_achieved', {
            metric: criterion.metric,
            value,
            target: criterion.target,
          });
        }
      }
    }

    this.deployments.set(examId, deployment);
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  private async recordEvent(
    examId: string,
    type: DeploymentEventType,
    data: Record<string, unknown>
  ): Promise<void> {
    const event: DeploymentEvent = {
      id: randomUUID(),
      examId,
      type,
      timestamp: Date.now(),
      actor: 'system',
      data,
    };

    this.events.push(event);
  }

  async getEvents(examId: string, limit = 50): Promise<DeploymentEvent[]> {
    return this.events
      .filter(e => e.examId === examId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // -------------------------------------------------------------------------
  // Default Feature Flags
  // -------------------------------------------------------------------------

  private initializeDefaultFeatureFlags(): void {
    const defaultFlags: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>[] = [
      {
        id: 'ai-tutoring',
        name: 'AI Tutoring',
        description: 'Enable AI-powered Socratic tutoring',
        enabled: true,
        pilotOnly: false,
        examSpecific: false,
        rolloutPercentage: 100,
        category: 'tutoring',
        owner: 'sage',
      },
      {
        id: 'smart-notebook',
        name: 'Smart Notebook',
        description: 'AI-powered note-taking with concept linking',
        enabled: true,
        pilotOnly: true,
        examSpecific: false,
        rolloutPercentage: 100,
        category: 'tutoring',
        owner: 'sage',
      },
      {
        id: 'adaptive-practice',
        name: 'Adaptive Practice',
        description: 'Personalized practice question selection',
        enabled: true,
        pilotOnly: false,
        examSpecific: true,
        rolloutPercentage: 100,
        category: 'content',
        owner: 'atlas',
      },
      {
        id: 'gamification',
        name: 'Gamification',
        description: 'Streaks, badges, and leaderboards',
        enabled: true,
        pilotOnly: false,
        examSpecific: false,
        rolloutPercentage: 100,
        category: 'engagement',
        owner: 'mentor',
      },
      {
        id: 'vernacular-content',
        name: 'Vernacular Content',
        description: 'Content in regional languages',
        enabled: true,
        pilotOnly: true,
        examSpecific: true,
        rolloutPercentage: 50,
        category: 'content',
        owner: 'atlas',
      },
      {
        id: 'video-solutions',
        name: 'Video Solutions',
        description: 'Video explanations for practice problems',
        enabled: false,
        pilotOnly: true,
        examSpecific: true,
        rolloutPercentage: 0,
        category: 'content',
        owner: 'atlas',
      },
      {
        id: 'parent-dashboard',
        name: 'Parent Dashboard',
        description: 'Progress reports and notifications for parents',
        enabled: true,
        pilotOnly: false,
        examSpecific: false,
        rolloutPercentage: 100,
        category: 'engagement',
        owner: 'mentor',
      },
      {
        id: 'social-learning',
        name: 'Social Learning',
        description: 'Peer discussion and group study features',
        enabled: false,
        pilotOnly: true,
        examSpecific: false,
        rolloutPercentage: 0,
        category: 'engagement',
        owner: 'mentor',
      },
    ];

    for (const flag of defaultFlags) {
      this.createFeatureFlag(flag);
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const deploymentManager = new DeploymentManager();
