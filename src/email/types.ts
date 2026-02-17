/**
 * Email Types
 * Multi-provider email system
 */

// Email providers
export type EmailProvider = 'sendgrid' | 'mailgun' | 'ses' | 'postmark' | 'resend' | 'smtp';

// Email status
export type EmailStatus = 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';

// Template types
export type EmailTemplateType =
  | 'welcome'
  | 'verify_email'
  | 'reset_password'
  | 'invite'
  | 'subscription_confirmed'
  | 'subscription_cancelled'
  | 'payment_receipt'
  | 'payment_failed'
  | 'newsletter'
  | 'progress_report'
  | 'course_complete'
  | 'streak_reminder'
  | 'custom';

/**
 * Email message
 */
export interface Email {
  id: string;
  
  // Recipients
  to: EmailRecipient[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  
  // Sender
  from: EmailRecipient;
  replyTo?: EmailRecipient;
  
  // Content
  subject: string;
  text?: string;
  html?: string;
  
  // Template
  templateId?: string;
  templateData?: Record<string, any>;
  
  // Attachments
  attachments?: EmailAttachment[];
  
  // Headers
  headers?: Record<string, string>;
  
  // Tracking
  trackOpens?: boolean;
  trackClicks?: boolean;
  
  // Scheduling
  scheduledFor?: Date;
  
  // Metadata
  tags?: string[];
  metadata?: Record<string, string>;
  
  // Status
  status: EmailStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  
  // Provider
  provider?: EmailProvider;
  providerMessageId?: string;
  
  // Error
  error?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType: string;
  contentId?: string; // For inline attachments
  disposition?: 'attachment' | 'inline';
}

/**
 * Email template
 */
export interface EmailTemplate {
  id: string;
  name: string;
  type: EmailTemplateType;
  
  // Content
  subject: string;
  text: string;
  html: string;
  
  // Variables
  variables: TemplateVariable[];
  
  // Defaults
  defaultFrom?: EmailRecipient;
  defaultReplyTo?: EmailRecipient;
  
  // Provider template IDs
  sendgridTemplateId?: string;
  mailgunTemplateId?: string;
  postmarkTemplateId?: string;
  
  // Status
  isActive: boolean;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  name: string;
  description?: string;
  required: boolean;
  defaultValue?: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
}

/**
 * Email sequence (drip campaign)
 */
export interface EmailSequence {
  id: string;
  name: string;
  description?: string;
  
  // Trigger
  trigger: SequenceTrigger;
  
  // Steps
  steps: SequenceStep[];
  
  // Entry conditions
  entryConditions?: SequenceCondition[];
  exitConditions?: SequenceCondition[];
  
  // Status
  isActive: boolean;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface SequenceTrigger {
  type: 'signup' | 'event' | 'manual' | 'segment' | 'date';
  event?: string;
  segmentId?: string;
  date?: Date;
}

export interface SequenceStep {
  id: string;
  order: number;
  
  // Timing
  delay: {
    value: number;
    unit: 'minutes' | 'hours' | 'days' | 'weeks';
  };
  
  // Content
  templateId: string;
  subject?: string; // Override template subject
  
  // Conditions
  conditions?: SequenceCondition[];
  
  // Actions
  actions?: SequenceAction[];
}

export interface SequenceCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'exists' | 'not_exists';
  value?: any;
}

export interface SequenceAction {
  type: 'tag_add' | 'tag_remove' | 'segment_add' | 'segment_remove' | 'webhook' | 'exit';
  data?: Record<string, any>;
}

/**
 * Subscriber
 */
export interface Subscriber {
  id: string;
  email: string;
  
  // Profile
  firstName?: string;
  lastName?: string;
  
  // Status
  status: 'subscribed' | 'unsubscribed' | 'bounced' | 'complained';
  
  // Lists and tags
  lists: string[];
  tags: string[];
  
  // Custom fields
  customFields?: Record<string, any>;
  
  // Engagement
  lastEmailSentAt?: Date;
  lastEmailOpenedAt?: Date;
  lastEmailClickedAt?: Date;
  
  // Source
  source?: string;
  ipAddress?: string;
  
  // Timestamps
  subscribedAt: Date;
  unsubscribedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Email list
 */
export interface EmailList {
  id: string;
  name: string;
  description?: string;
  
  // Settings
  doubleOptIn: boolean;
  
  // Stats
  subscriberCount: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Email campaign
 */
export interface EmailCampaign {
  id: string;
  name: string;
  
  // Targeting
  listIds: string[];
  segmentIds?: string[];
  excludeListIds?: string[];
  
  // Content
  templateId: string;
  subject: string;
  preheader?: string;
  
  // Sender
  from: EmailRecipient;
  replyTo?: EmailRecipient;
  
  // Schedule
  sendAt?: Date;
  timezone?: string;
  
  // A/B Testing
  abTest?: ABTestConfig;
  
  // Status
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled';
  
  // Stats
  stats?: CampaignStats;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
}

export interface ABTestConfig {
  enabled: boolean;
  variants: ABTestVariant[];
  testSize: number; // Percentage
  winnerCriteria: 'opens' | 'clicks' | 'conversions';
  duration: number; // Hours before selecting winner
}

export interface ABTestVariant {
  id: string;
  subject?: string;
  templateId?: string;
  weight: number;
}

export interface CampaignStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  complained: number;
  
  // Rates
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubscribeRate: number;
}

/**
 * Email configuration
 */
export interface EmailConfig {
  // Provider settings
  providers: {
    sendgrid?: {
      enabled: boolean;
      apiKey: string;
    };
    mailgun?: {
      enabled: boolean;
      apiKey: string;
      domain: string;
    };
    ses?: {
      enabled: boolean;
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
    };
    postmark?: {
      enabled: boolean;
      serverToken: string;
    };
    resend?: {
      enabled: boolean;
      apiKey: string;
    };
    smtp?: {
      enabled: boolean;
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
  };
  
  // Default settings
  defaultProvider: EmailProvider;
  defaultFrom: EmailRecipient;
  defaultReplyTo?: EmailRecipient;
  
  // Tracking
  trackOpens: boolean;
  trackClicks: boolean;
  
  // Rate limiting
  rateLimit: {
    perSecond: number;
    perMinute: number;
    perHour: number;
  };
  
  // Unsubscribe
  unsubscribeUrl: string;
  
  // Compliance
  physicalAddress?: string;
}

/**
 * Webhook event
 */
export interface EmailWebhookEvent {
  id: string;
  provider: EmailProvider;
  type: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed';
  messageId: string;
  email: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
}
