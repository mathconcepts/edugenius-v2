/**
 * Analytics Service
 * Multi-provider analytics tracking
 */

import * as crypto from 'crypto';
import {
  AnalyticsEvent, AnalyticsConfig, AnalyticsProvider, EventType,
  UserIdentity, UserTraits, PageView, PurchaseEvent, LearningEvent,
  ProviderConfig, Experiment, ExperimentVariant
} from './types';

// Default configuration
let analyticsConfig: AnalyticsConfig = {
  providers: {},
  debug: process.env.NODE_ENV === 'development',
  respectDoNotTrack: true,
  anonymizeIp: true,
  cookieConsent: true,
  sampleRate: 1.0
};

// Current user context
let currentUser: UserIdentity | null = null;
let sessionId: string | null = null;
let anonymousId: string | null = null;

// Event queue for batching
const eventQueue: AnalyticsEvent[] = [];
let flushTimer: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL = 5000;
const MAX_QUEUE_SIZE = 100;

// Experiments
const experiments = new Map<string, Experiment>();
const userVariants = new Map<string, string>();

/**
 * Initialize analytics
 */
export function initAnalytics(config: Partial<AnalyticsConfig>): void {
  analyticsConfig = { ...analyticsConfig, ...config };
  
  // Generate anonymous ID if not exists
  if (!anonymousId) {
    anonymousId = generateId('anon_');
  }
  
  // Generate session ID
  sessionId = generateId('sess_');
  
  // Start flush timer
  if (!flushTimer) {
    flushTimer = setInterval(flushEvents, FLUSH_INTERVAL);
  }
  
  if (analyticsConfig.debug) {
    console.log('[Analytics] Initialized with config:', analyticsConfig);
  }
}

/**
 * Get analytics config
 */
export function getAnalyticsConfig(): AnalyticsConfig {
  return analyticsConfig;
}

/**
 * Identify user
 */
export function identify(userId: string, traits?: UserTraits): void {
  currentUser = { userId, traits };
  
  const event: AnalyticsEvent = {
    name: 'identify',
    type: 'custom',
    userId,
    properties: traits,
    timestamp: Date.now()
  };
  
  sendToProviders('identify', event);
  
  if (analyticsConfig.debug) {
    console.log('[Analytics] Identify:', { userId, traits });
  }
}

/**
 * Clear user identity (on logout)
 */
export function reset(): void {
  currentUser = null;
  sessionId = generateId('sess_');
  
  // Reset in providers
  sendToProviders('reset', {});
  
  if (analyticsConfig.debug) {
    console.log('[Analytics] Reset user identity');
  }
}

/**
 * Track page view
 */
export function trackPageView(pageView: PageView): void {
  const event: AnalyticsEvent = {
    name: 'page_view',
    type: 'page_view',
    path: pageView.path,
    title: pageView.title,
    url: pageView.url,
    referrer: pageView.referrer,
    properties: pageView.properties,
    ...getUserContext(),
    timestamp: Date.now()
  };
  
  queueEvent(event);
  
  if (analyticsConfig.debug) {
    console.log('[Analytics] Page view:', pageView);
  }
}

/**
 * Track event
 */
export function trackEvent(
  name: string,
  properties?: Record<string, any>,
  type: EventType = 'custom'
): void {
  const event: AnalyticsEvent = {
    name,
    type,
    properties,
    ...getUserContext(),
    timestamp: Date.now()
  };
  
  queueEvent(event);
  
  if (analyticsConfig.debug) {
    console.log('[Analytics] Event:', { name, properties, type });
  }
}

/**
 * Track purchase
 */
export function trackPurchase(purchase: PurchaseEvent): void {
  const event: AnalyticsEvent = {
    name: 'purchase',
    type: 'purchase',
    properties: {
      transaction_id: purchase.transactionId,
      value: purchase.revenue,
      currency: purchase.currency,
      items: purchase.products,
      coupon: purchase.coupon,
      tax: purchase.tax
    },
    ...getUserContext(),
    timestamp: Date.now()
  };
  
  queueEvent(event);
  
  if (analyticsConfig.debug) {
    console.log('[Analytics] Purchase:', purchase);
  }
}

/**
 * Track learning event
 */
export function trackLearning(eventName: string, learning: LearningEvent): void {
  const event: AnalyticsEvent = {
    name: eventName,
    type: eventName as EventType,
    properties: {
      content_id: learning.contentId,
      content_type: learning.contentType,
      content_title: learning.title,
      progress: learning.progress,
      score: learning.score,
      duration: learning.duration,
      ...learning.metadata
    },
    ...getUserContext(),
    timestamp: Date.now()
  };
  
  queueEvent(event);
  
  if (analyticsConfig.debug) {
    console.log('[Analytics] Learning:', { eventName, learning });
  }
}

/**
 * Track AI interaction
 */
export function trackAIInteraction(data: {
  action: 'question' | 'answer' | 'hint' | 'explanation';
  topic?: string;
  subject?: string;
  responseTime?: number;
  satisfaction?: number;
}): void {
  trackEvent('ai_interaction', data, 'ai_interaction');
}

/**
 * Track search
 */
export function trackSearch(query: string, results?: number): void {
  trackEvent('search', { query, results_count: results }, 'search');
}

/**
 * Track error
 */
export function trackError(error: Error | string, context?: Record<string, any>): void {
  const errorData = error instanceof Error ? {
    message: error.message,
    stack: error.stack,
    name: error.name
  } : { message: error };
  
  trackEvent('error', { ...errorData, ...context }, 'error');
}

// ============ EXPERIMENTS ============

/**
 * Define an experiment
 */
export function defineExperiment(experiment: Experiment): void {
  experiments.set(experiment.id, experiment);
}

/**
 * Get variant for user
 */
export function getVariant(experimentId: string, userId?: string): ExperimentVariant | null {
  const experiment = experiments.get(experimentId);
  if (!experiment) return null;
  
  const effectiveUserId = userId || currentUser?.userId || anonymousId || 'anonymous';
  const key = `${experimentId}:${effectiveUserId}`;
  
  // Check sticky assignment
  let variantId = userVariants.get(key);
  
  if (!variantId) {
    // Assign variant based on weight
    const hash = hashString(key);
    const normalized = hash / 0xFFFFFFFF * 100;
    
    let cumulative = 0;
    for (const variant of experiment.variants) {
      cumulative += variant.weight;
      if (normalized < cumulative) {
        variantId = variant.id;
        break;
      }
    }
    
    // Fallback to first variant
    if (!variantId) {
      variantId = experiment.variants[0]?.id;
    }
    
    // Store assignment
    if (experiment.allocation === 'sticky') {
      userVariants.set(key, variantId);
    }
  }
  
  return experiment.variants.find(v => v.id === variantId) || null;
}

/**
 * Track experiment exposure
 */
export function trackExperiment(experimentId: string, variantId: string): void {
  trackEvent('experiment_viewed', {
    experiment_id: experimentId,
    variant_id: variantId
  });
}

// ============ INTERNAL ============

function generateId(prefix: string = ''): string {
  return `${prefix}${crypto.randomBytes(12).toString('hex')}`;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getUserContext(): Partial<AnalyticsEvent> {
  return {
    userId: currentUser?.userId,
    anonymousId: anonymousId || undefined,
    sessionId: sessionId || undefined
  };
}

function queueEvent(event: AnalyticsEvent): void {
  // Apply sampling
  if (analyticsConfig.sampleRate && analyticsConfig.sampleRate < 1) {
    if (Math.random() > analyticsConfig.sampleRate) {
      return;
    }
  }
  
  // Apply beforeTrack hook
  if (analyticsConfig.beforeTrack) {
    const processed = analyticsConfig.beforeTrack(event);
    if (!processed) return;
    event = processed;
  }
  
  eventQueue.push(event);
  
  // Flush if queue is full
  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    flushEvents();
  }
}

async function flushEvents(): Promise<void> {
  if (eventQueue.length === 0) return;
  
  const events = [...eventQueue];
  eventQueue.length = 0;
  
  for (const event of events) {
    await sendToProviders('track', event);
  }
}

async function sendToProviders(
  action: 'identify' | 'track' | 'reset',
  data: any
): Promise<void> {
  const results = new Map<AnalyticsProvider, boolean>();
  
  // GA4
  if (analyticsConfig.providers.ga4?.enabled) {
    try {
      await sendToGA4(action, data);
      results.set('ga4', true);
    } catch (e) {
      results.set('ga4', false);
      if (analyticsConfig.debug) {
        console.error('[Analytics] GA4 error:', e);
      }
    }
  }
  
  // Mixpanel
  if (analyticsConfig.providers.mixpanel?.enabled) {
    try {
      await sendToMixpanel(action, data);
      results.set('mixpanel', true);
    } catch (e) {
      results.set('mixpanel', false);
      if (analyticsConfig.debug) {
        console.error('[Analytics] Mixpanel error:', e);
      }
    }
  }
  
  // PostHog
  if (analyticsConfig.providers.posthog?.enabled) {
    try {
      await sendToPostHog(action, data);
      results.set('posthog', true);
    } catch (e) {
      results.set('posthog', false);
      if (analyticsConfig.debug) {
        console.error('[Analytics] PostHog error:', e);
      }
    }
  }
  
  // After track hook
  if (action === 'track' && analyticsConfig.afterTrack) {
    analyticsConfig.afterTrack(data, results);
  }
}

// ============ PROVIDER IMPLEMENTATIONS ============

async function sendToGA4(action: string, data: any): Promise<void> {
  const config = analyticsConfig.providers.ga4;
  if (!config) return;
  
  // In browser: use gtag
  // In server: use Measurement Protocol
  
  // Server-side Measurement Protocol
  const measurementId = config.measurementId;
  const apiSecret = (config as any).apiSecret;
  
  if (!measurementId || !apiSecret) {
    return; // Client-side only
  }
  
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;
  
  const payload = {
    client_id: data.anonymousId || data.userId,
    user_id: data.userId,
    events: [{
      name: data.name?.replace(/[^a-zA-Z0-9_]/g, '_'),
      params: {
        ...data.properties,
        engagement_time_msec: 100,
        session_id: data.sessionId
      }
    }]
  };
  
  await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function sendToMixpanel(action: string, data: any): Promise<void> {
  const config = analyticsConfig.providers.mixpanel;
  if (!config) return;
  
  const token = config.token;
  const apiHost = (config as any).apiHost || 'https://api.mixpanel.com';
  
  if (action === 'identify') {
    // Set user profile
    await fetch(`${apiHost}/engage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${Buffer.from(JSON.stringify({
        $token: token,
        $distinct_id: data.userId,
        $set: data.properties
      })).toString('base64')}`
    });
  } else if (action === 'track') {
    // Track event
    await fetch(`${apiHost}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${Buffer.from(JSON.stringify({
        event: data.name,
        properties: {
          token,
          distinct_id: data.userId || data.anonymousId,
          time: Math.floor((data.timestamp || Date.now()) / 1000),
          ...data.properties
        }
      })).toString('base64')}`
    });
  }
}

async function sendToPostHog(action: string, data: any): Promise<void> {
  const config = analyticsConfig.providers.posthog;
  if (!config) return;
  
  const apiKey = config.apiKey;
  const apiHost = (config as any).apiHost || 'https://app.posthog.com';
  
  const payload = {
    api_key: apiKey,
    distinct_id: data.userId || data.anonymousId,
    properties: data.properties
  };
  
  if (action === 'identify') {
    await fetch(`${apiHost}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        event: '$identify',
        properties: {
          ...payload.properties,
          $set: data.properties
        }
      })
    });
  } else if (action === 'track') {
    await fetch(`${apiHost}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        event: data.name,
        timestamp: new Date(data.timestamp || Date.now()).toISOString()
      })
    });
  }
}

// ============ UTILITIES ============

/**
 * Get client-side tracking script
 */
export function getClientScript(): string {
  const scripts: string[] = [];
  
  // GA4
  if (analyticsConfig.providers.ga4?.enabled) {
    const measurementId = analyticsConfig.providers.ga4.measurementId;
    scripts.push(`
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${measurementId}'${analyticsConfig.anonymizeIp ? ", { 'anonymize_ip': true }" : ''});
</script>`);
  }
  
  // Mixpanel
  if (analyticsConfig.providers.mixpanel?.enabled) {
    const token = analyticsConfig.providers.mixpanel.token;
    scripts.push(`
<!-- Mixpanel -->
<script>
(function(f,b){if(!b.__SV){var e,g,i,h;window.mixpanel=b;b._i=[];b.init=function(e,f,c){function g(a,d){var b=d.split(".");2==b.length&&(a=a[b[0]],d=b[1]);a[d]=function(){a.push([d].concat(Array.prototype.slice.call(arguments,0)))}}var a=b;"undefined"!==typeof c?a=b[c]=[]:c="mixpanel";a.people=a.people||[];a.toString=function(a){var d="mixpanel";"mixpanel"!==c&&(d+="."+c);a||(d+=" (stub)");return d};a.people.toString=function(){return a.toString(1)+".people (stub)"};i="disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" ");for(h=0;h<i.length;h++)g(a,i[h]);var j="set set_once union unset remove delete".split(" ");a.get_group=function(){function b(c){d[c]=function(){call2_args=arguments;call2=[c].concat(Array.prototype.slice.call(call2_args,0));a.push([e,call2])}}for(var d={},e=["get_group"].concat(Array.prototype.slice.call(arguments,0)),c=0;c<j.length;c++)b(j[c]);return d};b._i.push([e,f,c])};b.__SV=1.2;e=f.createElement("script");e.type="text/javascript";e.async=!0;e.src="undefined"!==typeof MIXPANEL_CUSTOM_LIB_URL?MIXPANEL_CUSTOM_LIB_URL:"file:"===f.location.protocol&&"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js".match(/^\\/\\//)?"https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js":"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";g=f.getElementsByTagName("script")[0];g.parentNode.insertBefore(e,g)}})(document,window.mixpanel||[]);
mixpanel.init('${token}');
</script>`);
  }
  
  return scripts.join('\n');
}

// Cleanup on process exit
process.on('beforeExit', async () => {
  if (flushTimer) {
    clearInterval(flushTimer);
    await flushEvents();
  }
});

// Export types
export * from './types';
