/**
 * Analytics Types
 * Multi-provider analytics system
 */

// Analytics providers
export type AnalyticsProvider = 'ga4' | 'mixpanel' | 'amplitude' | 'posthog' | 'custom';

// Event types
export type EventType =
  | 'page_view'
  | 'click'
  | 'form_submit'
  | 'sign_up'
  | 'sign_in'
  | 'sign_out'
  | 'purchase'
  | 'subscription_start'
  | 'subscription_cancel'
  | 'content_view'
  | 'course_start'
  | 'course_complete'
  | 'lesson_complete'
  | 'quiz_start'
  | 'quiz_complete'
  | 'question_answered'
  | 'ai_interaction'
  | 'search'
  | 'share'
  | 'error'
  | 'custom';

/**
 * Base event
 */
export interface AnalyticsEvent {
  name: string;
  type: EventType;
  properties?: Record<string, any>;
  timestamp?: number;
  
  // User context
  userId?: string;
  anonymousId?: string;
  sessionId?: string;
  
  // Page context
  url?: string;
  path?: string;
  referrer?: string;
  title?: string;
  
  // Device context
  userAgent?: string;
  language?: string;
  screenWidth?: number;
  screenHeight?: number;
  
  // UTM parameters
  utm?: UTMParams;
}

export interface UTMParams {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

/**
 * User identity
 */
export interface UserIdentity {
  userId: string;
  traits?: UserTraits;
}

export interface UserTraits {
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  
  // Segmentation
  plan?: string;
  role?: string;
  signupDate?: string;
  
  // Education-specific
  grade?: string;
  exam?: string;
  school?: string;
  
  // Custom traits
  [key: string]: any;
}

/**
 * Page view
 */
export interface PageView {
  path: string;
  title?: string;
  url?: string;
  referrer?: string;
  properties?: Record<string, any>;
}

/**
 * E-commerce events
 */
export interface PurchaseEvent {
  transactionId: string;
  revenue: number;
  currency: string;
  products: Product[];
  coupon?: string;
  tax?: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  variant?: string;
}

/**
 * Learning events
 */
export interface LearningEvent {
  contentId: string;
  contentType: 'course' | 'lesson' | 'quiz' | 'article' | 'video';
  title: string;
  progress?: number;
  score?: number;
  duration?: number; // seconds
  metadata?: Record<string, any>;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  enabled: boolean;
  trackingId: string;
  options?: Record<string, any>;
}

/**
 * Analytics configuration
 */
export interface AnalyticsConfig {
  // Provider configs
  providers: {
    ga4?: ProviderConfig & {
      measurementId: string;
      sendPageViews?: boolean;
    };
    mixpanel?: ProviderConfig & {
      token: string;
      apiHost?: string;
    };
    amplitude?: ProviderConfig & {
      apiKey: string;
    };
    posthog?: ProviderConfig & {
      apiKey: string;
      apiHost?: string;
    };
  };
  
  // Global settings
  debug?: boolean;
  respectDoNotTrack?: boolean;
  anonymizeIp?: boolean;
  cookieConsent?: boolean;
  
  // Sampling
  sampleRate?: number; // 0-1
  
  // Custom event handlers
  beforeTrack?: (event: AnalyticsEvent) => AnalyticsEvent | null;
  afterTrack?: (event: AnalyticsEvent, results: Map<AnalyticsProvider, boolean>) => void;
}

/**
 * Funnel definition
 */
export interface Funnel {
  id: string;
  name: string;
  steps: FunnelStep[];
}

export interface FunnelStep {
  name: string;
  event: string;
  filters?: Record<string, any>;
}

/**
 * Experiment/A-B test
 */
export interface Experiment {
  id: string;
  name: string;
  variants: ExperimentVariant[];
  allocation: 'random' | 'sticky';
  startDate?: Date;
  endDate?: Date;
}

export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number; // 0-100
}

/**
 * Cohort definition
 */
export interface Cohort {
  id: string;
  name: string;
  criteria: CohortCriteria[];
}

export interface CohortCriteria {
  property: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
}
