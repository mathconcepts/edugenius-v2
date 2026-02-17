/**
 * Prompt Repository Types
 * Wolfram-style prompt management with versioning and A/B testing
 */

// ============================================================================
// Core Types
// ============================================================================

export type PromptCategory =
  | 'content'      // Atlas - content generation
  | 'tutoring'     // Sage - tutoring interactions
  | 'marketing'    // Herald - marketing copy
  | 'engagement'   // Mentor - notifications/nudges
  | 'analysis'     // Oracle - data analysis
  | 'research'     // Scout - market research
  | 'system';      // System-level prompts

export type PromptScope =
  | 'global'       // Available to all agents
  | 'agent'        // Specific to one agent
  | 'exam'         // Exam-specific
  | 'campaign';    // Campaign-specific

export type ModifierType =
  // Tone modifiers
  | 'tone:formal'
  | 'tone:casual'
  | 'tone:friendly'
  | 'tone:professional'
  | 'tone:academic'
  // Language modifiers
  | 'lang:hinglish'
  | 'lang:regional'
  | 'lang:simple'
  | 'lang:technical'
  // Format modifiers
  | 'format:listicle'
  | 'format:explainer'
  | 'format:qa'
  | 'format:story'
  | 'format:tutorial'
  | 'format:comparison'
  // Audience modifiers
  | 'audience:student'
  | 'audience:parent'
  | 'audience:teacher'
  | 'audience:beginner'
  | 'audience:advanced'
  // Exam-style modifiers
  | 'style:jee'
  | 'style:neet'
  | 'style:board'
  | 'style:competitive'
  | 'style:practice'
  // Output modifiers
  | 'output:concise'
  | 'output:detailed'
  | 'output:stepwise'
  | 'output:visual'
  // Custom modifier
  | `custom:${string}`;

export interface PromptModifier {
  id: string;
  type: ModifierType;
  name: string;
  description: string;
  template: string;           // Modifier template to inject
  position: 'prefix' | 'suffix' | 'inject';
  injectAt?: string;          // Marker for injection point
  category: PromptCategory[];
  conflicts?: ModifierType[]; // Modifiers that can't be combined
  requires?: ModifierType[];  // Required companion modifiers
  metadata?: Record<string, unknown>;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: PromptCategory;
  scope: PromptScope;
  
  // Core prompt
  systemPrompt?: string;
  userPromptTemplate: string;
  
  // Variables
  variables: PromptVariable[];
  
  // Defaults
  defaultModifiers: ModifierType[];
  allowedModifiers: ModifierType[];
  
  // Versioning
  version: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  
  // A/B Testing
  variants?: PromptVariant[];
  abTestId?: string;
  
  // Targeting
  examTypes?: string[];
  audiences?: string[];
  
  // Performance
  metrics?: PromptMetrics;
}

export interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: unknown;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: unknown[];
  };
}

export interface PromptVariant {
  id: string;
  name: string;
  promptTemplate: string;
  weight: number;           // A/B test weight (0-1)
  isControl: boolean;       // Is this the control variant?
  metrics?: PromptMetrics;
}

export interface PromptMetrics {
  usageCount: number;
  successRate: number;
  avgLatencyMs: number;
  avgTokens: number;
  userRating?: number;
  conversionRate?: number;  // For marketing prompts
  engagementRate?: number;  // For content prompts
  lastUsed: number;
}

export interface PromptExecution {
  id: string;
  templateId: string;
  variantId?: string;
  agentId: string;
  
  // Input
  variables: Record<string, unknown>;
  modifiers: ModifierType[];
  
  // Output
  compiledPrompt: string;
  response?: string;
  
  // Metrics
  startedAt: number;
  completedAt?: number;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  success: boolean;
  error?: string;
  
  // Context
  examType?: string;
  deploymentMode: 'pilot' | 'full';
}

// ============================================================================
// A/B Testing Types
// ============================================================================

export interface PromptABTest {
  id: string;
  templateId: string;
  name: string;
  description: string;
  
  // Variants
  variants: PromptVariant[];
  
  // Configuration
  trafficSplit: Record<string, number>; // variantId -> percentage
  targetAudience?: string[];
  targetExams?: string[];
  
  // Status
  status: 'draft' | 'running' | 'paused' | 'completed';
  startedAt?: number;
  endedAt?: number;
  
  // Results
  winner?: string;
  confidenceLevel?: number;
  sampleSize: number;
  
  // Metrics
  variantMetrics: Record<string, ABTestMetrics>;
}

export interface ABTestMetrics {
  impressions: number;
  conversions: number;
  conversionRate: number;
  avgEngagement: number;
  avgQuality: number;
  statisticalSignificance: number;
}

// ============================================================================
// Repository Types
// ============================================================================

export interface PromptFilter {
  category?: PromptCategory;
  scope?: PromptScope;
  examType?: string;
  isActive?: boolean;
  search?: string;
  tags?: string[];
}

export interface PromptCompileOptions {
  variables: Record<string, unknown>;
  modifiers?: ModifierType[];
  variant?: string;
  exam?: string;
  deploymentMode?: 'pilot' | 'full';
}

export interface CompiledPrompt {
  systemPrompt?: string;
  userPrompt: string;
  templateId: string;
  variantId?: string;
  modifiersApplied: ModifierType[];
  compiledAt: number;
}

// ============================================================================
// Exam Configuration Types
// ============================================================================

export interface ExamConfig {
  id: string;
  name: string;
  code: string;                    // Short code (JEE, NEET, CBSE10)
  
  // Nature & Format
  nature: ExamNature;
  format: ExamFormat;
  
  // Content configuration
  subjects: SubjectConfig[];
  difficultyDistribution: DifficultyDistribution;
  
  // Volume settings
  contentCadence: ContentCadence;
  
  // Language variants
  languages: LanguageConfig[];
  
  // Marketing allocation
  marketingBudget: MarketingBudget;
  
  // Deployment
  deploymentMode: 'pilot' | 'full';
  pilotConfig?: PilotConfig;
  
  // Timeline
  launchDate?: number;
  pilotStartDate?: number;
  pilotEndDate?: number;
  
  // Status
  status: 'draft' | 'pilot' | 'active' | 'paused' | 'archived';
  createdAt: number;
  updatedAt: number;
}

export interface ExamNature {
  type: 'entrance' | 'board' | 'competitive' | 'certification' | 'olympiad';
  level: 'school' | 'undergraduate' | 'graduate' | 'professional';
  frequency: 'annual' | 'biannual' | 'quarterly' | 'monthly' | 'rolling';
  importance: 'critical' | 'high' | 'medium' | 'low';
}

export interface ExamFormat {
  questionTypes: QuestionType[];
  totalMarks: number;
  duration: number;              // in minutes
  sections: SectionFormat[];
  negativemarking: boolean;
  negativeMarkingRatio?: number; // e.g., 0.33 for -1/3
  calculator: 'allowed' | 'scientific' | 'none';
}

export interface QuestionType {
  type: 'mcq' | 'numerical' | 'short' | 'long' | 'matching' | 'assertion';
  weight: number;               // Percentage of exam
  marks: number;
}

export interface SectionFormat {
  name: string;
  subjects: string[];
  mandatory: boolean;
  questionCount: number;
  marks: number;
}

export interface SubjectConfig {
  name: string;
  code: string;
  chapters: ChapterConfig[];
  weight: number;               // Percentage in exam
}

export interface ChapterConfig {
  name: string;
  weight: number;
  topics: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface DifficultyDistribution {
  easy: number;                 // Percentage
  medium: number;
  hard: number;
}

export interface ContentCadence {
  questionsPerDay: number;
  blogsPerWeek: number;
  videosPerWeek: number;
  practiceTestsPerMonth: number;
  revisionsPerChapter: number;
}

export interface LanguageConfig {
  code: string;                 // 'en', 'hi', 'hinglish', etc.
  name: string;
  priority: number;             // Lower = higher priority
  coverage: number;             // Percentage of content
}

export interface MarketingBudget {
  total: number;                // Monthly budget
  channels: {
    social: number;
    email: number;
    ads: number;
    influencer: number;
    content: number;
  };
}

export interface PilotConfig {
  audienceSelection: 'signup_source' | 'geography' | 'random' | 'cohort';
  audienceFilter: Record<string, unknown>;
  targetSize: number;
  duration: {
    type: 'fixed' | 'metric_based';
    days?: number;
    successMetric?: string;
    threshold?: number;
  };
  rollbackTriggers: {
    metric: string;
    operator: 'lt' | 'gt' | 'eq';
    threshold: number;
  }[];
  successCriteria: {
    metric: string;
    target: number;
  }[];
}

// ============================================================================
// Deployment Types
// ============================================================================

export interface DeploymentConfig {
  mode: 'pilot' | 'full';
  examId: string;
  
  // Feature flags
  features: FeatureFlag[];
  
  // Content settings
  contentEnabled: boolean;
  tutorEnabled: boolean;
  marketingEnabled: boolean;
  
  // Targeting
  targetAudience: AudienceTarget;
  
  // Metrics tracking
  trackingConfig: TrackingConfig;
}

export interface FeatureFlag {
  id: string;
  name: string;
  enabled: boolean;
  pilotOnly: boolean;
  rolloutPercentage: number;
  targetAudience?: string[];
}

export interface AudienceTarget {
  signupSources?: string[];
  geographies?: string[];
  cohorts?: string[];
  percentage?: number;
}

export interface TrackingConfig {
  metricsToTrack: string[];
  reportingInterval: 'hourly' | 'daily' | 'weekly';
  alertThresholds: Record<string, number>;
}
