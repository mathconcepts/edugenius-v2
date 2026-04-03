/**
 * acquisitionFunnelService.ts — Acquisition Funnel Tracking
 *
 * Tracks every stage of the acquisition funnel:
 *   landing → engagement → lead_capture → trial → activation → retention
 *
 * Emits events to Oracle (analytics) and Scout (high-intent signals).
 * Identifies dropoff points and generates actionable recommendations.
 *
 * All localStorage keys prefixed `edugenius_growth_`.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type FunnelStage =
  | 'landing'
  | 'engagement'
  | 'lead_capture'
  | 'trial'
  | 'activation'
  | 'retention';

export type FunnelEventType =
  | 'page_view'
  | 'content_consumed'
  | 'cta_click'
  | 'signup_start'
  | 'signup_complete'
  | 'first_lesson'
  | 'activated'
  | 'returned_after_7d';

export type AttributionSource =
  | 'direct'
  | 'organic'
  | 'blog'
  | 'social'
  | 'referral'
  | 'exam_page'
  | 'paid'
  | 'email';

export interface FunnelEvent {
  type: FunnelEventType;
  stage: FunnelStage;
  source: AttributionSource;
  sessionId: string;
  timestamp: string;
  examId?: string;
  pageId?: string;
  topicId?: string;
  ctaText?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface FunnelMetrics {
  timeWindow: string;
  visitors: number;
  engaged: number;
  leads: number;
  signups: number;
  activated: number;
  retained: number;
  conversionRates: {
    visitorToEngaged: number;
    engagedToLead: number;
    leadToSignup: number;
    signupToActivated: number;
    activatedToRetained: number;
    overallFunnel: number;
  };
  topSources: Array<{ source: AttributionSource; count: number; conversionRate: number }>;
  topExams: Array<{ examId: string; views: number; signups: number }>;
}

export interface DropoffPoint {
  stage: FunnelStage;
  dropoffRate: number;
  absoluteDropoff: number;
  hypothesis: string;
  recommendation: string;
}

export interface FunnelInsight {
  type: 'opportunity' | 'warning' | 'success';
  title: string;
  body: string;
  actionable: string;
  urgency: 'low' | 'medium' | 'high';
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY_EVENTS = 'edugenius_growth_funnel_events';
const STORAGE_KEY_METRICS = 'edugenius_growth_funnel_metrics_cache';
const MAX_STORED_EVENTS = 1000;

// ─── Stage ordering ───────────────────────────────────────────────────────────

const STAGE_ORDER: FunnelStage[] = ['landing', 'engagement', 'lead_capture', 'trial', 'activation', 'retention'];

function stageIndex(stage: FunnelStage): number {
  return STAGE_ORDER.indexOf(stage);
}

// ─── Session ID ───────────────────────────────────────────────────────────────

function getSessionId(): string {
  let sid = sessionStorage.getItem('edugenius_growth_session_id');
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('edugenius_growth_session_id', sid);
  }
  return sid;
}

// ─── Acquisition Funnel Service ───────────────────────────────────────────────

class AcquisitionFunnelService {
  private sessionId: string;

  constructor() {
    this.sessionId = getSessionId();
  }

  // ── Track Event ─────────────────────────────────────────────────────────────

  trackFunnelEvent(params: Partial<FunnelEvent> & { stage: FunnelStage; source: AttributionSource }): void {
    const event: FunnelEvent = {
      type: params.type ?? 'page_view',
      stage: params.stage,
      source: params.source,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      examId: params.examId,
      pageId: params.pageId,
      topicId: params.topicId,
      ctaText: params.ctaText,
      metadata: params.metadata,
    };

    this._persistEvent(event);
    this._emitToOracle(event);

    // High-intent signals go to Scout for audience research
    if (event.type === 'cta_click' || event.type === 'signup_start' || event.type === 'activated') {
      this._emitToScout(event);
    }

    // Emit to growth orchestrator signal bus
    this._emitGrowthSignal(event);
  }

  // ── Batch track (convenience) ───────────────────────────────────────────────

  trackPageView(source: AttributionSource, examId?: string, pageId?: string): void {
    this.trackFunnelEvent({ type: 'page_view', stage: 'landing', source, examId, pageId });
  }

  trackCtaClick(ctaText: string, source: AttributionSource, examId?: string): void {
    this.trackFunnelEvent({ type: 'cta_click', stage: 'engagement', source, ctaText, examId });
  }

  trackContentConsumed(topicId: string, examId: string, source: AttributionSource): void {
    this.trackFunnelEvent({ type: 'content_consumed', stage: 'engagement', source, topicId, examId });
  }

  trackSignupStart(source: AttributionSource, examId?: string): void {
    this.trackFunnelEvent({ type: 'signup_start', stage: 'lead_capture', source, examId });
  }

  trackSignupComplete(source: AttributionSource, examId?: string): void {
    this.trackFunnelEvent({ type: 'signup_complete', stage: 'trial', source, examId });
  }

  trackActivation(examId: string): void {
    this.trackFunnelEvent({ type: 'activated', stage: 'activation', source: 'direct', examId });
  }

  // ── Funnel Metrics ──────────────────────────────────────────────────────────

  getFunnelMetrics(timeWindow: '24h' | '7d' | '30d' | 'all' = '7d'): FunnelMetrics {
    const events = this._loadEvents();
    const filtered = this._filterByTimeWindow(events, timeWindow);

    const byStage = this._groupByStage(filtered);
    const visitors = byStage['landing'] ?? 0;
    const engaged = byStage['engagement'] ?? 0;
    const leads = byStage['lead_capture'] ?? 0;
    const signups = byStage['trial'] ?? 0;
    const activated = byStage['activation'] ?? 0;
    const retained = byStage['retention'] ?? 0;

    const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) / 100 : 0);

    const topSources = this._topSources(filtered);
    const topExams = this._topExams(filtered);

    const metrics: FunnelMetrics = {
      timeWindow,
      visitors: visitors || this._fallbackCount('landing'),
      engaged: engaged || this._fallbackCount('engagement'),
      leads: leads || this._fallbackCount('lead_capture'),
      signups: signups || this._fallbackCount('trial'),
      activated: activated || this._fallbackCount('activation'),
      retained,
      conversionRates: {
        visitorToEngaged: rate(engaged, visitors),
        engagedToLead: rate(leads, engaged),
        leadToSignup: rate(signups, leads),
        signupToActivated: rate(activated, signups),
        activatedToRetained: rate(retained, activated),
        overallFunnel: rate(activated, visitors),
      },
      topSources,
      topExams,
    };

    // Cache
    try {
      localStorage.setItem(STORAGE_KEY_METRICS, JSON.stringify({ metrics, cachedAt: Date.now() }));
    } catch {
      // Ignore
    }

    return metrics;
  }

  getCachedMetrics(): FunnelMetrics | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_METRICS);
      if (!raw) return null;
      const { metrics, cachedAt } = JSON.parse(raw) as { metrics: FunnelMetrics; cachedAt: number };
      // Stale after 5 minutes
      if (Date.now() - cachedAt > 300_000) return null;
      return metrics;
    } catch {
      return null;
    }
  }

  // ── Dropoff Detection ───────────────────────────────────────────────────────

  identifyDropoffPoints(timeWindow: '24h' | '7d' | '30d' = '7d'): DropoffPoint[] {
    const m = this.getFunnelMetrics(timeWindow);
    const drops: DropoffPoint[] = [];

    const stages: Array<{
      from: FunnelStage;
      to: FunnelStage;
      fromCount: number;
      toCount: number;
      rateKey: keyof typeof m.conversionRates;
    }> = [
      { from: 'landing', to: 'engagement', fromCount: m.visitors, toCount: m.engaged, rateKey: 'visitorToEngaged' },
      { from: 'engagement', to: 'lead_capture', fromCount: m.engaged, toCount: m.leads, rateKey: 'engagedToLead' },
      { from: 'lead_capture', to: 'trial', fromCount: m.leads, toCount: m.signups, rateKey: 'leadToSignup' },
      { from: 'trial', to: 'activation', fromCount: m.signups, toCount: m.activated, rateKey: 'signupToActivated' },
    ];

    const HYPOTHESES: Partial<Record<FunnelStage, string>> = {
      landing: 'High bounce — hero copy or page speed may not be resonating',
      engagement: 'Users are not scrolling to CTAs — content above fold may be weak',
      lead_capture: 'Signup form friction — too many fields or unclear value proposition',
      trial: 'First session not delivering "aha moment" — onboarding needs improvement',
    };

    const RECOMMENDATIONS: Partial<Record<FunnelStage, string>> = {
      landing: 'A/B test hero headline and reduce above-fold content',
      engagement: 'Move CTA section higher, add social proof near top',
      lead_capture: 'Simplify signup — email-only or Google OAuth first',
      trial: 'Add guided first session — show Sage demo immediately on signup',
    };

    for (const stage of stages) {
      const dropoffRate = 1 - m.conversionRates[stage.rateKey];
      if (dropoffRate > 0.6) {
        drops.push({
          stage: stage.from,
          dropoffRate: Math.round(dropoffRate * 100) / 100,
          absoluteDropoff: stage.fromCount - stage.toCount,
          hypothesis: HYPOTHESES[stage.from] ?? 'Unknown drop reason',
          recommendation: RECOMMENDATIONS[stage.from] ?? 'Investigate with session recordings',
        });
      }
    }

    return drops.sort((a, b) => b.dropoffRate - a.dropoffRate);
  }

  // ── Funnel Insights ─────────────────────────────────────────────────────────

  generateFunnelInsights(timeWindow: '7d' | '30d' = '7d'): FunnelInsight[] {
    const m = this.getFunnelMetrics(timeWindow);
    const insights: FunnelInsight[] = [];

    // Overall funnel health
    if (m.conversionRates.overallFunnel > 0.05) {
      insights.push({
        type: 'success',
        title: 'Strong Overall Conversion',
        body: `${Math.round(m.conversionRates.overallFunnel * 100)}% of visitors convert to activated users — above industry average.`,
        actionable: 'Scale top traffic sources to amplify growth.',
        urgency: 'low',
      });
    }

    // Signup conversion warning
    if (m.conversionRates.leadToSignup < 0.3) {
      insights.push({
        type: 'warning',
        title: 'Signup Friction Detected',
        body: `Only ${Math.round(m.conversionRates.leadToSignup * 100)}% of CTA clickers complete signup — industry norm is 40-60%.`,
        actionable: 'Simplify the signup flow. Test a single-step "Email + Start" form.',
        urgency: 'high',
      });
    }

    // Activation gap
    if (m.conversionRates.signupToActivated < 0.4) {
      insights.push({
        type: 'warning',
        title: 'Activation Gap',
        body: `${Math.round((1 - m.conversionRates.signupToActivated) * 100)}% of signups never complete their first lesson.`,
        actionable: 'Trigger an immediate AI tutoring session on signup. Reduce time-to-first-value.',
        urgency: 'high',
      });
    }

    // Top performing source
    if (m.topSources.length > 0) {
      const top = m.topSources[0];
      insights.push({
        type: 'opportunity',
        title: `${top.source.charAt(0).toUpperCase() + top.source.slice(1)} is Your Best Acquisition Channel`,
        body: `${top.count} visits from ${top.source} with ${Math.round(top.conversionRate * 100)}% conversion.`,
        actionable: `Double down on ${top.source} content. Generate 2x more ${top.source === 'blog' ? 'blog posts' : 'social content'} for top exams.`,
        urgency: 'medium',
      });
    }

    // Top exam opportunity
    if (m.topExams.length > 0) {
      const topExam = m.topExams[0];
      insights.push({
        type: 'opportunity',
        title: `${topExam.examId.toUpperCase()} Pages Driving Most Traffic`,
        body: `${topExam.views} views → ${topExam.signups} signups from ${topExam.examId} exam pages.`,
        actionable: `Update ${topExam.examId} landing page content. Refresh FAQ schema and add latest exam date.`,
        urgency: 'medium',
      });
    }

    return insights;
  }

  // ── Private: Emit to Oracle ─────────────────────────────────────────────────

  private _emitToOracle(event: FunnelEvent): void {
    try {
      localStorage.setItem(
        'edugenius_growth_signal_oracle_funnel',
        JSON.stringify({ payload: event, ts: Date.now() }),
      );
    } catch {
      // Graceful failure
    }
  }

  // ── Private: Emit to Scout ──────────────────────────────────────────────────

  private _emitToScout(event: FunnelEvent): void {
    try {
      localStorage.setItem(
        'edugenius_growth_signal_scout_intent',
        JSON.stringify({
          payload: {
            intentType: event.type,
            examId: event.examId,
            source: event.source,
            sessionId: event.sessionId,
          },
          ts: Date.now(),
        }),
      );
    } catch {
      // Graceful failure
    }
  }

  // ── Private: Emit growth signal ─────────────────────────────────────────────

  private _emitGrowthSignal(event: FunnelEvent): void {
    try {
      localStorage.setItem(
        'edugenius_growth_funnel_event',
        JSON.stringify({
          payload: { stage: event.stage, source: event.source, examId: event.examId, type: event.type },
          ts: Date.now(),
        }),
      );
    } catch {
      // Graceful failure
    }
  }

  // ── Private: Persistence ────────────────────────────────────────────────────

  private _persistEvent(event: FunnelEvent): void {
    try {
      const events = this._loadEvents();
      events.push(event);
      // Keep only last MAX_STORED_EVENTS
      const trimmed = events.slice(-MAX_STORED_EVENTS);
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(trimmed));
    } catch {
      // Ignore storage full errors
    }

    // Also persist to backend API (fire-and-forget)
    this._persistToApi(event);
  }

  private _persistToApi(event: FunnelEvent): void {
    try {
      // Extract UTM params from current URL
      const params = new URLSearchParams(window.location.search);
      const utmParams: Record<string, string> = {};
      for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
        const val = params.get(key);
        if (val) utmParams[key] = val;
      }

      // Map FunnelEventType to API event_type
      const apiEventType = event.type === 'content_consumed' ? 'blog_read'
        : event.type === 'first_lesson' ? 'first_practice'
        : event.type === 'returned_after_7d' ? 'activated'
        : event.type;

      fetch('/api/funnel/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: event.sessionId,
          event_type: apiEventType,
          source: event.source,
          utm_params: utmParams,
          metadata: {
            ...event.metadata,
            exam_id: event.examId,
            page_id: event.pageId,
            topic_id: event.topicId,
            blog_slug: event.metadata?.blog_slug,
          },
        }),
      }).catch(() => {}); // Silent failure — localStorage is the primary store
    } catch {
      // Ignore
    }
  }

  private _loadEvents(): FunnelEvent[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_EVENTS);
      return raw ? (JSON.parse(raw) as FunnelEvent[]) : [];
    } catch {
      return [];
    }
  }

  private _filterByTimeWindow(events: FunnelEvent[], window: string): FunnelEvent[] {
    if (window === 'all') return events;
    const msMap: Record<string, number> = {
      '24h': 86400000,
      '7d': 604800000,
      '30d': 2592000000,
    };
    const cutoff = Date.now() - (msMap[window] ?? msMap['7d']);
    return events.filter((e) => new Date(e.timestamp).getTime() > cutoff);
  }

  private _groupByStage(events: FunnelEvent[]): Record<string, number> {
    const sessionsByStage: Record<string, Set<string>> = {};
    for (const e of events) {
      if (!sessionsByStage[e.stage]) sessionsByStage[e.stage] = new Set();
      sessionsByStage[e.stage].add(e.sessionId);
    }
    const result: Record<string, number> = {};
    for (const [stage, sessions] of Object.entries(sessionsByStage)) {
      result[stage] = sessions.size;
    }
    return result;
  }

  private _topSources(events: FunnelEvent[]): FunnelMetrics['topSources'] {
    const countMap: Record<string, number> = {};
    const convMap: Record<string, number> = {};
    for (const e of events) {
      countMap[e.source] = (countMap[e.source] ?? 0) + 1;
      if (e.type === 'activated') convMap[e.source] = (convMap[e.source] ?? 0) + 1;
    }
    return Object.entries(countMap)
      .map(([source, count]) => ({
        source: source as AttributionSource,
        count,
        conversionRate: Math.round(((convMap[source] ?? 0) / count) * 100) / 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private _topExams(events: FunnelEvent[]): FunnelMetrics['topExams'] {
    const viewMap: Record<string, number> = {};
    const signupMap: Record<string, number> = {};
    for (const e of events) {
      if (!e.examId) continue;
      if (e.type === 'page_view') viewMap[e.examId] = (viewMap[e.examId] ?? 0) + 1;
      if (e.type === 'signup_complete') signupMap[e.examId] = (signupMap[e.examId] ?? 0) + 1;
    }
    return Object.entries(viewMap)
      .map(([examId, views]) => ({ examId, views, signups: signupMap[examId] ?? 0 }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);
  }

  private _fallbackCount(stage: FunnelStage): number {
    // Sensible demo fallbacks when no real data exists
    const fallbacks: Record<FunnelStage, number> = {
      landing: 1240,
      engagement: 680,
      lead_capture: 312,
      trial: 189,
      activation: 143,
      retention: 98,
    };
    return fallbacks[stage] ?? 0;
  }

  // ── Utility: stage label ────────────────────────────────────────────────────

  getStageFunnelPosition(stage: FunnelStage): number {
    return stageIndex(stage);
  }

  getAllStages(): FunnelStage[] {
    return [...STAGE_ORDER];
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const acquisitionFunnelService = new AcquisitionFunnelService();
export type { AcquisitionFunnelService };
