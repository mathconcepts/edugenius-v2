/**
 * Deployment Types
 * Pilot/Full deployment modes with feature flags
 */

// ============================================================================
// Deployment Mode Types
// ============================================================================

export type DeploymentMode = 'pilot' | 'full';
export type AudienceSelectionMethod = 'signup_source' | 'geography' | 'random' | 'cohort';
export type DurationType = 'fixed' | 'metric_based';

export interface DeploymentState {
  examId: string;
  mode: DeploymentMode;
  
  // Feature states
  features: Map<string, FeatureFlagState>;
  
  // Pilot configuration (if mode === 'pilot')
  pilotConfig?: PilotDeploymentConfig;
  
  // Metrics
  metrics: DeploymentMetrics;
  
  // Timestamps
  startedAt: number;
  updatedAt: number;
  endedAt?: number;
}

export interface FeatureFlagState {
  id: string;
  name: string;
  enabled: boolean;
  rolloutPercentage: number;
  pilotOnly: boolean;
  
  // Targeting
  targetAudience?: AudienceTarget;
  
  // Metrics
  impressions: number;
  activations: number;
}

export interface AudienceTarget {
  signupSources?: string[];
  geographies?: string[];
  cohorts?: string[];
  userIds?: string[];
  percentage?: number;
}

export interface PilotDeploymentConfig {
  // Audience selection
  audienceMethod: AudienceSelectionMethod;
  audienceFilter: Record<string, unknown>;
  targetSize: number;
  currentSize: number;
  
  // Duration
  durationType: DurationType;
  durationDays?: number;
  endDate?: number;
  
  // Success metrics
  successMetric?: string;
  successThreshold?: number;
  
  // Rollback triggers
  rollbackTriggers: RollbackTrigger[];
  
  // Success criteria
  successCriteria: SuccessCriterion[];
  
  // Status
  status: 'active' | 'succeeded' | 'failed' | 'rolled_back';
  statusReason?: string;
}

export interface RollbackTrigger {
  id: string;
  metric: string;
  operator: 'lt' | 'gt' | 'eq' | 'ne';
  threshold: number;
  window: string;              // e.g., '1h', '24h'
  triggered: boolean;
  triggeredAt?: number;
}

export interface SuccessCriterion {
  id: string;
  metric: string;
  target: number;
  operator: 'gt' | 'gte' | 'eq';
  weight: number;             // Importance weight (0-1)
  achieved: boolean;
  currentValue?: number;
}

export interface DeploymentMetrics {
  // User metrics
  totalUsers: number;
  activeUsers: number;
  pilotUsers: number;
  
  // Engagement metrics
  avgSessionDuration: number;
  sessionsPerUser: number;
  retentionRate: number;
  
  // Business metrics
  conversionRate: number;
  revenue: number;
  churnRate: number;
  
  // Quality metrics
  errorRate: number;
  latencyP50: number;
  latencyP95: number;
  
  // Last updated
  updatedAt: number;
}

// ============================================================================
// Exam Deployment Types
// ============================================================================

export interface ExamDeployment {
  examId: string;
  examCode: string;
  examName: string;
  
  // Deployment mode
  mode: DeploymentMode;
  
  // Configuration
  config: ExamDeploymentConfig;
  
  // State
  state: DeploymentState;
  
  // Timeline
  pilotStartDate?: number;
  pilotEndDate?: number;
  fullLaunchDate?: number;
  
  // Promotion criteria
  promotionCriteria: PromotionCriteria;
  
  // Status
  status: 'draft' | 'pilot' | 'promoting' | 'full' | 'paused' | 'archived';
}

export interface ExamDeploymentConfig {
  // Content settings
  content: {
    blogsEnabled: boolean;
    vlogsEnabled: boolean;
    socialEnabled: boolean;
    cadence: ContentCadenceConfig;
  };
  
  // Tutoring settings
  tutoring: {
    enabled: boolean;
    modelsAllowed: string[];
    featuresEnabled: string[];
  };
  
  // Marketing settings
  marketing: {
    enabled: boolean;
    channels: string[];
    budget: number;
  };
  
  // Feature flags for this exam
  features: string[];
}

export interface ContentCadenceConfig {
  questionsPerDay: number;
  blogsPerWeek: number;
  videosPerWeek: number;
  practiceTestsPerMonth: number;
}

export interface PromotionCriteria {
  minPilotDuration: number;    // days
  minPilotUsers: number;
  metrics: PromotionMetric[];
}

export interface PromotionMetric {
  name: string;
  threshold: number;
  operator: 'gt' | 'gte' | 'eq' | 'lt' | 'lte';
  required: boolean;
}

// ============================================================================
// Feature Flag Types
// ============================================================================

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  
  // Global state
  enabled: boolean;
  
  // Deployment scope
  pilotOnly: boolean;
  examSpecific: boolean;
  
  // Rollout
  rolloutPercentage: number;
  rolloutSchedule?: RolloutSchedule;
  
  // Targeting
  targetAudience?: AudienceTarget;
  
  // Dependencies
  requires?: string[];         // Feature IDs that must be enabled
  conflicts?: string[];        // Feature IDs that must be disabled
  
  // Metadata
  category: string;
  owner: string;
  createdAt: number;
  updatedAt: number;
}

export interface RolloutSchedule {
  type: 'immediate' | 'gradual' | 'scheduled';
  
  // Gradual rollout
  steps?: RolloutStep[];
  
  // Scheduled rollout
  scheduledAt?: number;
}

export interface RolloutStep {
  percentage: number;
  startAt: number;
  duration: number;           // ms
}

// ============================================================================
// Event Types
// ============================================================================

export interface DeploymentEvent {
  id: string;
  examId: string;
  type: DeploymentEventType;
  timestamp: number;
  actor: string;
  data: Record<string, unknown>;
}

export type DeploymentEventType =
  | 'deployment.created'
  | 'deployment.pilot_started'
  | 'deployment.pilot_extended'
  | 'deployment.promoted_to_full'
  | 'deployment.rolled_back'
  | 'deployment.paused'
  | 'deployment.resumed'
  | 'deployment.archived'
  | 'feature.enabled'
  | 'feature.disabled'
  | 'feature.rollout_updated'
  | 'metric.threshold_breached'
  | 'metric.success_achieved';
