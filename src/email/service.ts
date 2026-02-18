// @ts-nocheck
/**
 * Email Service
 * Multi-provider email with templates and sequences
 */

import * as crypto from 'crypto';
import {
  Email, EmailTemplate, EmailSequence, Subscriber, EmailList, EmailCampaign,
  EmailConfig, EmailProvider, EmailStatus, EmailRecipient, EmailAttachment,
  TemplateVariable, EmailWebhookEvent
} from './types';
import { EventBus } from '../events/event-bus';

// Default configuration
let emailConfig: EmailConfig = {
  providers: {
    sendgrid: {
      enabled: true,
      apiKey: process.env.SENDGRID_API_KEY || 'PLACEHOLDER_SENDGRID_API_KEY'
    },
    resend: {
      enabled: true,
      apiKey: process.env.RESEND_API_KEY || 'PLACEHOLDER_RESEND_API_KEY'
    },
    smtp: {
      enabled: false,
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    }
  },
  defaultProvider: 'sendgrid',
  defaultFrom: {
    email: 'hello@edugenius.ai',
    name: 'EduGenius'
  },
  trackOpens: true,
  trackClicks: true,
  rateLimit: {
    perSecond: 10,
    perMinute: 500,
    perHour: 10000
  },
  unsubscribeUrl: 'https://edugenius.ai/unsubscribe'
};

// In-memory stores
const emails = new Map<string, Email>();
const templates = new Map<string, EmailTemplate>();
const sequences = new Map<string, EmailSequence>();
const subscribers = new Map<string, Subscriber>();
const lists = new Map<string, EmailList>();
const campaigns = new Map<string, EmailCampaign>();
const webhookEvents: EmailWebhookEvent[] = [];

// Event bus
let eventBus: EventBus | null = null;

// Rate limiting
const rateLimitCounters = new Map<string, { count: number; resetAt: number }>();

export function setEventBus(bus: EventBus): void {
  eventBus = bus;
}

function generateId(prefix: string = ''): string {
  return `${prefix}${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * Configure email settings
 */
export function configureEmail(config: Partial<EmailConfig>): void {
  emailConfig = { ...emailConfig, ...config };
}

/**
 * Get email config
 */
export function getEmailConfig(): EmailConfig {
  return emailConfig;
}

// ============ SEND EMAIL ============

/**
 * Normalize recipients to array format
 */
function normalizeRecipients(to: string | string[] | EmailRecipient[]): EmailRecipient[] {
  if (typeof to === 'string') {
    return [{ email: to }];
  }
  return to.map(r => typeof r === 'string' ? { email: r } : r);
}

/**
 * Check rate limits
 */
function checkRateLimit(): boolean {
  const now = Date.now();
  const key = 'global';
  
  let counter = rateLimitCounters.get(key);
  if (!counter || counter.resetAt < now) {
    counter = { count: 0, resetAt: now + 3600000 };
  }
  
  if (counter.count >= emailConfig.rateLimit.perHour) {
    return false;
  }
  
  counter.count++;
  rateLimitCounters.set(key, counter);
  return true;
}

/**
 * Send an email
 */
export async function sendEmail(options: {
  to: string | string[] | EmailRecipient[];
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  from?: EmailRecipient;
  replyTo?: EmailRecipient;
  attachments?: EmailAttachment[];
  tags?: string[];
  scheduledFor?: Date;
  provider?: EmailProvider;
}): Promise<Email> {
  const recipients = normalizeRecipients(options.to);
  
  if (!checkRateLimit()) {
    throw new Error('Rate limit exceeded');
  }
  
  let subject = options.subject;
  let text = options.text;
  let html = options.html;
  
  if (options.templateId) {
    const template = templates.get(options.templateId);
    if (template) {
      subject = renderTemplate(template.subject, options.templateData || {});
      text = renderTemplate(template.text, options.templateData || {});
      html = renderTemplate(template.html, options.templateData || {});
    }
  }
  
  const emailId = generateId('eml_');
  const email: Email = {
    id: emailId,
    to: recipients,
    from: options.from || emailConfig.defaultFrom,
    replyTo: options.replyTo || emailConfig.defaultReplyTo,
    subject,
    text,
    html,
    templateId: options.templateId,
    templateData: options.templateData,
    attachments: options.attachments,
    trackOpens: emailConfig.trackOpens,
    trackClicks: emailConfig.trackClicks,
    scheduledFor: options.scheduledFor,
    tags: options.tags,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  emails.set(emailId, email);
  
  if (!options.scheduledFor) {
    await deliverEmail(email, options.provider);
  }
  
  return email;
}

/**
 * Deliver email to provider
 */
async function deliverEmail(email: Email, provider?: EmailProvider): Promise<void> {
  const selectedProvider = provider || emailConfig.defaultProvider;
  
  try {
    let providerMessageId: string | undefined;
    
    switch (selectedProvider) {
      case 'sendgrid':
        providerMessageId = await sendViaSendGrid(email);
        break;
      case 'resend':
        providerMessageId = await sendViaResend(email);
        break;
      case 'smtp':
        providerMessageId = await sendViaSMTP(email);
        break;
      default:
        throw new Error(`Unknown provider: ${selectedProvider}`);
    }
    
    email.status = 'sent';
    email.sentAt = new Date();
    email.provider = selectedProvider;
    email.providerMessageId = providerMessageId;
    email.updatedAt = new Date();
    
    if (eventBus) {
      await eventBus.publish({
        id: generateId('evt_'),
        type: 'email.sent',
        source: 'email-service',
        data: { emailId: email.id, to: email.to.map(r => r.email), subject: email.subject },
        timestamp: Date.now(),
        version: '1.0'
      });
    }
  } catch (error) {
    email.status = 'failed';
    email.error = error instanceof Error ? error.message : 'Unknown error';
    email.updatedAt = new Date();
    
    if (eventBus) {
      await eventBus.publish({
        id: generateId('evt_'),
        type: 'email.failed',
        source: 'email-service',
        data: { emailId: email.id, error: email.error },
        timestamp: Date.now(),
        version: '1.0'
      });
    }
  }
  
  emails.set(email.id, email);
}

// ============ PROVIDER IMPLEMENTATIONS ============

async function sendViaSendGrid(email: Email): Promise<string> {
  const config = emailConfig.providers.sendgrid;
  if (!config?.enabled || config.apiKey.includes('PLACEHOLDER')) {
    throw new Error('SendGrid not configured');
  }
  
  const payload = {
    personalizations: [{
      to: email.to.map(r => ({ email: r.email, name: r.name })),
      cc: email.cc?.map(r => ({ email: r.email, name: r.name })),
      bcc: email.bcc?.map(r => ({ email: r.email, name: r.name }))
    }],
    from: { email: email.from.email, name: email.from.name },
    reply_to: email.replyTo ? { email: email.replyTo.email, name: email.replyTo.name } : undefined,
    subject: email.subject,
    content: [
      email.text ? { type: 'text/plain', value: email.text } : null,
      email.html ? { type: 'text/html', value: email.html } : null
    ].filter(Boolean),
    attachments: email.attachments?.map(a => ({
      content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
      filename: a.filename,
      type: a.contentType,
      disposition: a.disposition || 'attachment',
      content_id: a.contentId
    })),
    tracking_settings: {
      open_tracking: { enable: email.trackOpens },
      click_tracking: { enable: email.trackClicks }
    },
    custom_args: email.metadata
  };
  
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SendGrid error: ${error}`);
  }
  
  return response.headers.get('x-message-id') || generateId('sg_');
}

async function sendViaResend(email: Email): Promise<string> {
  const config = emailConfig.providers.resend;
  if (!config?.enabled || config.apiKey.includes('PLACEHOLDER')) {
    throw new Error('Resend not configured');
  }
  
  const payload = {
    from: email.from.name ? `${email.from.name} <${email.from.email}>` : email.from.email,
    to: email.to.map(r => r.email),
    cc: email.cc?.map(r => r.email),
    bcc: email.bcc?.map(r => r.email),
    reply_to: email.replyTo?.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
    attachments: email.attachments?.map(a => ({
      filename: a.filename,
      content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content
    })),
    tags: email.tags?.map(t => ({ name: t, value: 'true' }))
  };
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend error: ${error}`);
  }
  
  const result = await response.json();
  return result.id;
}

async function sendViaSMTP(email: Email): Promise<string> {
  throw new Error('SMTP not implemented - use nodemailer in production');
}

// ============ TEMPLATES ============

export function createTemplate(template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>): EmailTemplate {
  const templateId = generateId('tpl_');
  const newTemplate: EmailTemplate = {
    ...template,
    id: templateId,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  templates.set(templateId, newTemplate);
  return newTemplate;
}

export function getTemplate(templateId: string): EmailTemplate | null {
  return templates.get(templateId) || null;
}

export function updateTemplate(templateId: string, updates: Partial<EmailTemplate>): EmailTemplate {
  const template = templates.get(templateId);
  if (!template) throw new Error('Template not found');
  
  const updated: EmailTemplate = { ...template, ...updates, updatedAt: new Date() };
  templates.set(templateId, updated);
  return updated;
}

export function listTemplates(): EmailTemplate[] {
  return Array.from(templates.values());
}

function renderTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return data[key] !== undefined ? String(data[key]) : `{{${key}}}`;
  });
}

// ============ SUBSCRIBERS ============

export function addSubscriber(data: {
  email: string;
  firstName?: string;
  lastName?: string;
  lists?: string[];
  tags?: string[];
  source?: string;
}): Subscriber {
  const existing = Array.from(subscribers.values()).find(s => s.email === data.email);
  if (existing) return existing;
  
  const subscriberId = generateId('sub_');
  const subscriber: Subscriber = {
    id: subscriberId,
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    status: 'subscribed',
    lists: data.lists || [],
    tags: data.tags || [],
    source: data.source,
    subscribedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  subscribers.set(subscriberId, subscriber);
  return subscriber;
}

export function unsubscribe(email: string): void {
  const subscriber = Array.from(subscribers.values()).find(s => s.email === email);
  if (subscriber) {
    subscriber.status = 'unsubscribed';
    subscriber.unsubscribedAt = new Date();
    subscriber.updatedAt = new Date();
    subscribers.set(subscriber.id, subscriber);
  }
}

export function getSubscriber(email: string): Subscriber | null {
  return Array.from(subscribers.values()).find(s => s.email === email) || null;
}

export function listSubscribers(listId?: string): Subscriber[] {
  let subs = Array.from(subscribers.values());
  if (listId) {
    subs = subs.filter(s => s.lists.includes(listId));
  }
  return subs.filter(s => s.status === 'subscribed');
}

// ============ LISTS ============

export function createList(name: string, description?: string): EmailList {
  const listId = generateId('lst_');
  const list: EmailList = {
    id: listId,
    name,
    description,
    doubleOptIn: false,
    subscriberCount: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  lists.set(listId, list);
  return list;
}

export function getList(listId: string): EmailList | null {
  return lists.get(listId) || null;
}

export function listLists(): EmailList[] {
  return Array.from(lists.values());
}

// ============ SEQUENCES ============

export function createSequence(sequence: Omit<EmailSequence, 'id' | 'createdAt' | 'updatedAt'>): EmailSequence {
  const sequenceId = generateId('seq_');
  const newSequence: EmailSequence = {
    ...sequence,
    id: sequenceId,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  sequences.set(sequenceId, newSequence);
  return newSequence;
}

export function getSequence(sequenceId: string): EmailSequence | null {
  return sequences.get(sequenceId) || null;
}

// ============ CAMPAIGNS ============

export function createCampaign(campaign: Omit<EmailCampaign, 'id' | 'status' | 'createdAt' | 'updatedAt'>): EmailCampaign {
  const campaignId = generateId('cmp_');
  const newCampaign: EmailCampaign = {
    ...campaign,
    id: campaignId,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  campaigns.set(campaignId, newCampaign);
  return newCampaign;
}

export function getCampaign(campaignId: string): EmailCampaign | null {
  return campaigns.get(campaignId) || null;
}

export async function sendCampaign(campaignId: string): Promise<void> {
  const campaign = campaigns.get(campaignId);
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status !== 'draft') throw new Error('Campaign already sent');
  
  campaign.status = 'sending';
  campaigns.set(campaignId, campaign);
  
  // Get subscribers
  const targetSubscribers = campaign.listIds.flatMap(listId => 
    listSubscribers(listId)
  );
  
  // Send emails
  for (const subscriber of targetSubscribers) {
    await sendEmail({
      to: subscriber.email,
      subject: campaign.subject,
      templateId: campaign.templateId,
      templateData: {
        firstName: subscriber.firstName,
        lastName: subscriber.lastName,
        email: subscriber.email
      },
      from: campaign.from,
      replyTo: campaign.replyTo,
      tags: ['campaign', campaignId]
    });
  }
  
  campaign.status = 'sent';
  campaign.sentAt = new Date();
  campaigns.set(campaignId, campaign);
}

// ============ WEBHOOKS ============

function parseWebhookEvents(provider: EmailProvider, payload: any): EmailWebhookEvent[] {
  const events: EmailWebhookEvent[] = [];
  
  if (provider === 'sendgrid') {
    const sgEvents = Array.isArray(payload) ? payload : [payload];
    for (const evt of sgEvents) {
      events.push({
        id: generateId('whe_'),
        provider: 'sendgrid',
        type: mapSendGridEvent(evt.event),
        messageId: evt.sg_message_id,
        email: evt.email,
        timestamp: new Date(evt.timestamp * 1000),
        metadata: evt,
        createdAt: new Date()
      });
    }
  }
  
  return events;
}

function mapSendGridEvent(event: string): EmailWebhookEvent['type'] {
  const map: Record<string, EmailWebhookEvent['type']> = {
    'delivered': 'delivered',
    'open': 'opened',
    'click': 'clicked',
    'bounce': 'bounced',
    'spamreport': 'complained',
    'unsubscribe': 'unsubscribed'
  };
  return map[event] || 'delivered';
}

export async function handleWebhook(provider: EmailProvider, payload: any, signature?: string): Promise<void> {
  const events = parseWebhookEvents(provider, payload);
  
  for (const event of events) {
    webhookEvents.push(event);
    
    if (event.messageId) {
      const email = Array.from(emails.values()).find(e => e.providerMessageId === event.messageId);
      if (email) {
        switch (event.type) {
          case 'delivered':
            email.status = 'delivered';
            email.deliveredAt = event.timestamp;
            break;
          case 'opened':
            email.status = 'opened';
            email.openedAt = event.timestamp;
            break;
          case 'clicked':
            email.status = 'clicked';
            email.clickedAt = event.timestamp;
            break;
          case 'bounced':
            email.status = 'bounced';
            break;
        }
        email.updatedAt = new Date();
        emails.set(email.id, email);
      }
    }
    
    if (event.type === 'unsubscribed') {
      unsubscribe(event.email);
    }
  }
}

// ============ UTILITIES ============

export function getEmail(emailId: string): Email | null {
  return emails.get(emailId) || null;
}

export function listEmails(limit: number = 50): Email[] {
  return Array.from(emails.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

// Initialize default templates
const defaultTemplates: Array<Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    name: 'Welcome Email',
    type: 'welcome',
    subject: 'Welcome to EduGenius, {{firstName}}! 🎉',
    text: 'Hi {{firstName}},\n\nWelcome to EduGenius!\n\nThe EduGenius Team',
    html: '<h1>Welcome {{firstName}}!</h1><p>We\'re excited to have you.</p>',
    variables: [
      { name: 'firstName', required: true, type: 'string' },
      { name: 'dashboardUrl', required: false, type: 'string' }
    ],
    isActive: true
  },
  {
    name: 'Verify Email',
    type: 'verify_email',
    subject: 'Verify your email address',
    text: 'Hi {{firstName}},\n\nVerify: {{verificationUrl}}\n\nEduGenius Team',
    html: '<p>Hi {{firstName}},</p><p><a href="{{verificationUrl}}">Verify Email</a></p>',
    variables: [
      { name: 'firstName', required: true, type: 'string' },
      { name: 'verificationUrl', required: true, type: 'string' }
    ],
    isActive: true
  },
  {
    name: 'Password Reset',
    type: 'reset_password',
    subject: 'Reset your password',
    text: 'Hi {{firstName}},\n\nReset: {{resetUrl}}\n\nEduGenius Team',
    html: '<p>Hi {{firstName}},</p><p><a href="{{resetUrl}}">Reset Password</a></p>',
    variables: [
      { name: 'firstName', required: true, type: 'string' },
      { name: 'resetUrl', required: true, type: 'string' }
    ],
    isActive: true
  }
];

defaultTemplates.forEach(t => createTemplate(t));

// Export types
export * from './types';
