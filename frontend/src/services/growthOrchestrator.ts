/**
 * growthOrchestrator.ts — Master Growth Orchestrator
 *
 * Top-level growth intelligence layer for EduGenius v2.0.
 * Decides what content to generate, which pages to update, when to refresh SEO,
 * and how to drive the acquisition funnel.
 *
 * Signal architecture:
 *   INBOUND:  scout:insights, oracle:track_campaign, content:campaign:complete,
 *             social:intel_cycle_complete, orchestrator:oracle_event
 *   OUTBOUND: growth:page_update, growth:seo_update, growth:funnel_event,
 *             growth:content_priority, growth:landing_page_ready
 *
 * All localStorage keys prefixed `edugenius_growth_`.
 * No circular imports — growthOrchestrator imports FROM services, not vice versa.
 */

import { EXAM_REGISTRY, getLiveExams, getExamById, type ExamConfig } from '@/data/examRegistry';
import { websiteSeoService, type PageMeta } from './websiteSeoService';
import { landingPageEngine, type LandingPageConfig } from './landingPageEngine';
import { acquisitionFunnelService, type FunnelMetrics } from './acquisitionFunnelService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GrowthTrigger =
  | 'scheduled'
  | 'content_added'
  | 'trend_signal'
  | 'performance_alert'
  | 'manual';

export type GrowthCycleStatus = 'idle' | 'running' | 'complete' | 'error';

export interface PagePriorityItem {
  pageId: string;
  slug: string;
  examId?: string;
  trafficPotential: number;   // 0-100 estimated traffic score
  conversionGap: number;      // 0-100 gap from optimal conversion
  contentFreshness: number;   // 0-100 freshness score (100 = brand new)
  priorityScore: number;      // trafficPotential × conversionGap × (100 - contentFreshness) / 10000
  recommendation: string;
  lastUpdated: string;
}

export interface ContentFreshnessAlert {
  pageId: string;
  examId?: string;
  staleDays: number;
  urgency: 'low' | 'medium' | 'high';
  action: string;
}

export interface GrowthStrategy {
  trigger: GrowthTrigger;
  runAt: string;
  pagesUpdated: string[];
  contentPriorities: Array<{ topicId: string; examId: string; urgency: string }>;
  seoUpdates: Array<{ pageId: string; metaUpdated: boolean; schemaUpdated: boolean }>;
  funnelInsights: string[];
  cycleStatus: GrowthCycleStatus;
  durationMs: number;
}

export interface ScoutSignalPayload {
  trendingTopics?: string[];
  keyword?: string;
  examId?: string;
  urgency?: 'low' | 'medium' | 'high';
  recommendedAngles?: string[];
}

export interface OraclePerformancePayload {
  campaignId?: string;
  ctr?: number;
  conversionRate?: number;
  topPerformingExams?: string[];
  lowEngagementPages?: string[];
}

export interface HeroHeadline {
  text: string;
  examFocus?: string;
  cachedAt: string;
  expiresAt: string;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const SK_STRATEGY = 'edugenius_growth_last_strategy';
const SK_PAGE_QUEUE = 'edugenius_growth_page_priority_queue';
const SK_FRESHNESS = 'edugenius_growth_content_freshness';
const SK_HERO_HEADLINE = 'edugenius_growth_hero_headline';
const SK_CYCLE_STATUS = 'edugenius_growth_cycle_status';
const SK_SOCIAL_PROOF = 'edugenius_growth_social_proof';

// ─── Signal bus keys (inbound) ────────────────────────────────────────────────

const INBOUND_KEYS = {
  scoutInsights: 'scout:weekly-report',
  oracleCampaign: 'oracle:track_campaign',
  contentComplete: 'content:campaign:complete',
  socialCycle: 'social:intel_cycle_complete',
  orchestratorEvent: 'orchestrator:oracle_event',
} as const;

// ─── Traffic potential by exam (static seed, updated by Scout data) ───────────

const EXAM_TRAFFIC_POTENTIAL: Record<string, number> = {
  'jee-main': 95,
  'neet': 90,
  'cbse-12': 75,
  'cat': 65,
  'gate-engineering-maths': 55,
};

// ─── Default social proof numbers ────────────────────────────────────────────

const DEFAULT_SOCIAL_PROOF = {
  students: 50000,
  questions: 250000,
  successRate: 94,
  aiInteractions: 10000000,
};

// ─── Growth Orchestrator ──────────────────────────────────────────────────────

class GrowthOrchestrator {
  private _cycleStatus: GrowthCycleStatus = 'idle';

  // ── Main Entry Point ────────────────────────────────────────────────────────

  async orchestrateGrowth(trigger: GrowthTrigger): Promise<GrowthStrategy> {
    const startMs = Date.now();
    this._setCycleStatus('running');

    const strategy: GrowthStrategy = {
      trigger,
      runAt: new Date().toISOString(),
      pagesUpdated: [],
      contentPriorities: [],
      seoUpdates: [],
      funnelInsights: [],
      cycleStatus: 'running',
      durationMs: 0,
    };

    try {
      // 1. Read inbound signals
      const scoutSignals = this._readScoutSignals();
      const oracleData = this._readOraclePerformance();
      const socialSignals = this._readSocialSignals();

      // 2. Build page priority queue
      const queue = this._buildPagePriorityQueue(oracleData);
      this._savePagePriorityQueue(queue);

      // 3. Identify stale content → trigger Atlas regeneration signals
      const freshnessAlerts = this._calculateFreshnessAlerts(queue);
      strategy.contentPriorities = this._buildContentPriorities(freshnessAlerts, scoutSignals);

      // 4. Update landing pages for high-priority exams
      const liveExams = getLiveExams();
      for (const exam of liveExams.slice(0, 3)) {  // top 3 to stay responsive
        const config = landingPageEngine.generateExamLandingPage(exam.id);
        landingPageEngine.emitPageReady(config);
        strategy.pagesUpdated.push(config.pageId);
        this._emitPageUpdate(config, queue);
      }

      // 5. SEO updates for all live pages
      strategy.seoUpdates = this._runSeoUpdates(liveExams);
      websiteSeoService.injectSeoSignals(liveExams);

      // 6. Generate fresh hero headline (weekly cache)
      this._refreshHeroHeadline(scoutSignals, socialSignals);

      // 7. Funnel insights from acquisition data
      const funnelInsights = acquisitionFunnelService.generateFunnelInsights('7d');
      strategy.funnelInsights = funnelInsights.map((i) => `${i.title}: ${i.actionable}`);

      // 8. Emit growth signals outbound
      this._emitContentPriorities(strategy.contentPriorities);
      this._emitFunnelEvent(trigger);
      this._emitSeoUpdate(strategy.seoUpdates);

      strategy.cycleStatus = 'complete';
      this._setCycleStatus('complete');
    } catch (err) {
      strategy.cycleStatus = 'error';
      this._setCycleStatus('error');
      console.warn('[GrowthOrchestrator] Cycle error:', err);
    }

    strategy.durationMs = Date.now() - startMs;
    this._saveStrategy(strategy);
    return strategy;
  }

  // ── Page Priority Queue ─────────────────────────────────────────────────────

  private _buildPagePriorityQueue(oracleData: OraclePerformancePayload): PagePriorityItem[] {
    const liveExams = getLiveExams();
    const freshnessMap = this._loadFreshnessMap();
    const metrics = acquisitionFunnelService.getCachedMetrics();

    const items: PagePriorityItem[] = liveExams.map((exam) => {
      const trafficPotential = EXAM_TRAFFIC_POTENTIAL[exam.id] ?? 50;
      const lastUpdatedStr = freshnessMap[exam.id];
      const daysSince = lastUpdatedStr
        ? Math.floor((Date.now() - new Date(lastUpdatedStr).getTime()) / 86400000)
        : 999;
      const contentFreshness = Math.max(0, 100 - daysSince * 2); // decays 2 pts/day

      // Find conversion gap from funnel metrics
      const examMetrics = metrics?.topExams.find((e) => e.examId === exam.id);
      const signupRate = examMetrics ? examMetrics.signups / Math.max(examMetrics.views, 1) : 0.02;
      const conversionGap = Math.round((1 - Math.min(signupRate / 0.08, 1)) * 100); // target 8% conversion

      // Priority = traffic × gap × staleness / 10000
      const priorityScore =
        Math.round((trafficPotential * conversionGap * (100 - contentFreshness)) / 10000);

      let recommendation = 'Maintain current page';
      if (daysSince > 60) recommendation = 'Urgent: Refresh content — severely stale';
      else if (conversionGap > 70) recommendation = 'High conversion gap — update CTA and hero sections';
      else if (trafficPotential > 80) recommendation = 'High traffic potential — prioritise SEO improvements';

      return {
        pageId: `exam-${exam.id}`,
        slug: `/website/exams/${exam.route}`,
        examId: exam.id,
        trafficPotential,
        conversionGap,
        contentFreshness,
        priorityScore,
        recommendation,
        lastUpdated: lastUpdatedStr ?? new Date(0).toISOString(),
      };
    });

    // Add static pages
    items.push({
      pageId: 'home',
      slug: '/website',
      trafficPotential: 100,
      conversionGap: 40,
      contentFreshness: 80,
      priorityScore: Math.round((100 * 40 * 20) / 10000),
      recommendation: 'Keep homepage fresh — update hero headline weekly',
      lastUpdated: this._loadFreshnessMap()['home'] ?? new Date(0).toISOString(),
    });

    // Sort by priority descending
    return items.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  getPagePriorityQueue(): PagePriorityItem[] {
    try {
      const raw = localStorage.getItem(SK_PAGE_QUEUE);
      if (raw) {
        const parsed = JSON.parse(raw) as { queue: PagePriorityItem[]; ts: number };
        // Use cache if fresher than 1 hour
        if (Date.now() - parsed.ts < 3600000) return parsed.queue;
      }
    } catch {
      // fallthrough
    }
    // Build fresh if cache is missing
    const queue = this._buildPagePriorityQueue(this._readOraclePerformance());
    this._savePagePriorityQueue(queue);
    return queue;
  }

  private _savePagePriorityQueue(queue: PagePriorityItem[]): void {
    try {
      localStorage.setItem(SK_PAGE_QUEUE, JSON.stringify({ queue, ts: Date.now() }));
    } catch {
      // Ignore
    }
  }

  // ── Content Freshness ───────────────────────────────────────────────────────

  private _calculateFreshnessAlerts(queue: PagePriorityItem[]): ContentFreshnessAlert[] {
    const alerts: ContentFreshnessAlert[] = [];
    for (const item of queue) {
      const daysSince = Math.floor(
        (Date.now() - new Date(item.lastUpdated).getTime()) / 86400000,
      );
      if (daysSince >= 14) {
        alerts.push({
          pageId: item.pageId,
          examId: item.examId,
          staleDays: daysSince,
          urgency: daysSince >= 60 ? 'high' : daysSince >= 30 ? 'medium' : 'low',
          action:
            daysSince >= 60
              ? 'Regenerate full page content via Atlas'
              : daysSince >= 30
              ? 'Refresh FAQ + hero sections'
              : 'Update meta tags and schema markup',
        });
      }
    }
    // Persist alerts
    try {
      localStorage.setItem(SK_FRESHNESS, JSON.stringify({ alerts, ts: Date.now() }));
    } catch {
      // Ignore
    }
    return alerts;
  }

  getFreshnessAlerts(): ContentFreshnessAlert[] {
    try {
      const raw = localStorage.getItem(SK_FRESHNESS);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { alerts: ContentFreshnessAlert[]; ts: number };
      return parsed.alerts;
    } catch {
      return [];
    }
  }

  private _buildContentPriorities(
    alerts: ContentFreshnessAlert[],
    scoutSignals: ScoutSignalPayload,
  ): GrowthStrategy['contentPriorities'] {
    const priorities: GrowthStrategy['contentPriorities'] = [];

    // From freshness alerts
    for (const alert of alerts) {
      if (alert.examId) {
        const exam = getExamById(alert.examId);
        if (exam) {
          priorities.push({
            topicId: exam.topics[0] ?? alert.examId,
            examId: alert.examId,
            urgency: alert.urgency,
          });
        }
      }
    }

    // From scout signals
    if (scoutSignals.examId && scoutSignals.keyword) {
      priorities.push({
        topicId: scoutSignals.keyword,
        examId: scoutSignals.examId,
        urgency: scoutSignals.urgency ?? 'medium',
      });
    }

    // Deduplicate by examId
    const seen = new Set<string>();
    return priorities.filter((p) => {
      if (seen.has(p.examId)) return false;
      seen.add(p.examId);
      return true;
    });
  }

  // ── SEO Updates ─────────────────────────────────────────────────────────────

  private _runSeoUpdates(exams: ExamConfig[]): GrowthStrategy['seoUpdates'] {
    const updates: GrowthStrategy['seoUpdates'] = [];
    for (const exam of exams) {
      const meta = websiteSeoService.generatePageMeta('exam', { exam });
      const score = websiteSeoService.calculatePageSeoScore(meta);
      if (score.score < 70) {
        updates.push({ pageId: `exam-${exam.id}`, metaUpdated: true, schemaUpdated: true });
        websiteSeoService.markPageOptimised(exam.id);
      } else {
        updates.push({ pageId: `exam-${exam.id}`, metaUpdated: false, schemaUpdated: false });
      }
    }
    // Homepage
    const homeMeta = websiteSeoService.generatePageMeta('home', {});
    updates.push({ pageId: 'home', metaUpdated: true, schemaUpdated: true });
    void homeMeta; // used for scoring — suppress lint
    return updates;
  }

  // ── Hero Headline ───────────────────────────────────────────────────────────

  private _refreshHeroHeadline(scoutSignals: ScoutSignalPayload, socialSignals: Record<string, string>): void {
    const existing = this.getHeroHeadline();
    if (existing && new Date(existing.expiresAt).getTime() > Date.now()) return;

    const headlines = [
      'India\'s AI Tutor for JEE, NEET, GATE & More — Learn Smarter',
      'Ask. Think. Master. — EduGenius AI Tutoring for India\'s Toughest Exams',
      'Stop Memorising. Start Understanding. — Powered by AI',
      'Your Personal Socratic AI Tutor, Available 24/7',
      'Crack JEE, NEET, GATE with AI That Teaches You to Think',
    ];

    // Pick based on scout trend
    let idx = 0;
    if (scoutSignals.trendingTopics?.some((t) => t.toLowerCase().includes('jee'))) idx = 0;
    else if (scoutSignals.trendingTopics?.some((t) => t.toLowerCase().includes('neet'))) idx = 1;
    else idx = Math.floor(Math.random() * headlines.length);

    const headline: HeroHeadline = {
      text: headlines[idx],
      examFocus: scoutSignals.examId,
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), // 7 days
    };

    try {
      localStorage.setItem(SK_HERO_HEADLINE, JSON.stringify(headline));
    } catch {
      // Ignore
    }

    void socialSignals; // available for future use
  }

  getHeroHeadline(): HeroHeadline | null {
    try {
      const raw = localStorage.getItem(SK_HERO_HEADLINE);
      return raw ? (JSON.parse(raw) as HeroHeadline) : null;
    } catch {
      return null;
    }
  }

  getDefaultHeroHeadline(): string {
    return this.getHeroHeadline()?.text ?? 'India\'s AI Tutor for JEE, NEET, GATE & More';
  }

  // ── Social Proof Numbers ────────────────────────────────────────────────────

  getSocialProof(): typeof DEFAULT_SOCIAL_PROOF {
    try {
      const raw = localStorage.getItem(SK_SOCIAL_PROOF);
      if (raw) {
        const parsed = JSON.parse(raw) as { data: typeof DEFAULT_SOCIAL_PROOF; ts: number };
        return parsed.data;
      }
    } catch {
      // Fallthrough
    }
    return DEFAULT_SOCIAL_PROOF;
  }

  updateSocialProof(data: Partial<typeof DEFAULT_SOCIAL_PROOF>): void {
    const current = this.getSocialProof();
    const updated = { ...current, ...data };
    try {
      localStorage.setItem(SK_SOCIAL_PROOF, JSON.stringify({ data: updated, ts: Date.now() }));
    } catch {
      // Ignore
    }
  }

  // ── Inbound Signal Readers ──────────────────────────────────────────────────

  private _readScoutSignals(): ScoutSignalPayload {
    try {
      const raw = localStorage.getItem(INBOUND_KEYS.scoutInsights);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          trendAlerts?: Array<{ keyword: string }>;
          priorityContentQueue?: Array<{ examFocus: string; topic: string; priority: number }>;
          generatedAt?: string;
        };
        const top = parsed.priorityContentQueue?.[0];
        return {
          trendingTopics: parsed.trendAlerts?.map((t) => t.keyword) ?? [],
          examId: top?.examFocus,
          keyword: top?.topic,
          urgency: (top?.priority ?? 50) > 70 ? 'high' : 'medium',
        };
      }
    } catch {
      // Graceful fallback
    }
    return {};
  }

  private _readOraclePerformance(): OraclePerformancePayload {
    try {
      const raw = localStorage.getItem(INBOUND_KEYS.oracleCampaign);
      if (raw) return JSON.parse(raw) as OraclePerformancePayload;
    } catch {
      // Fallback
    }
    return {};
  }

  private _readSocialSignals(): Record<string, string> {
    try {
      const raw = localStorage.getItem(INBOUND_KEYS.socialCycle);
      if (raw) return JSON.parse(raw) as Record<string, string>;
    } catch {
      // Fallback
    }
    return {};
  }

  // ── Outbound Signal Emitters ────────────────────────────────────────────────

  private _emitPageUpdate(config: LandingPageConfig, queue: PagePriorityItem[]): void {
    const queueItem = queue.find((q) => q.pageId === config.pageId);
    try {
      localStorage.setItem(
        'edugenius_growth_page_update',
        JSON.stringify({
          payload: {
            pageId: config.pageId,
            sections: config.sections.map((s) => s.id),
            priority: queueItem?.priorityScore ?? 50,
            slug: config.slug,
          },
          ts: Date.now(),
        }),
      );
    } catch {
      // Ignore
    }
  }

  private _emitContentPriorities(
    priorities: GrowthStrategy['contentPriorities'],
  ): void {
    try {
      localStorage.setItem(
        'edugenius_growth_content_priority',
        JSON.stringify({ payload: { priorities }, ts: Date.now() }),
      );
    } catch {
      // Ignore
    }
  }

  private _emitFunnelEvent(trigger: GrowthTrigger): void {
    try {
      localStorage.setItem(
        'edugenius_growth_funnel_event',
        JSON.stringify({
          payload: { trigger, stage: 'orchestrated', source: 'growth_cycle' },
          ts: Date.now(),
        }),
      );
    } catch {
      // Ignore
    }
  }

  private _emitSeoUpdate(updates: GrowthStrategy['seoUpdates']): void {
    try {
      localStorage.setItem(
        'edugenius_growth_seo_update',
        JSON.stringify({ payload: { updates }, ts: Date.now() }),
      );
    } catch {
      // Ignore
    }
  }

  // ── Status & History ────────────────────────────────────────────────────────

  getCycleStatus(): GrowthCycleStatus {
    return this._cycleStatus;
  }

  private _setCycleStatus(status: GrowthCycleStatus): void {
    this._cycleStatus = status;
    try {
      localStorage.setItem(SK_CYCLE_STATUS, JSON.stringify({ status, ts: Date.now() }));
    } catch {
      // Ignore
    }
  }

  getLastStrategy(): GrowthStrategy | null {
    try {
      const raw = localStorage.getItem(SK_STRATEGY);
      return raw ? (JSON.parse(raw) as GrowthStrategy) : null;
    } catch {
      return null;
    }
  }

  private _saveStrategy(strategy: GrowthStrategy): void {
    try {
      localStorage.setItem(SK_STRATEGY, JSON.stringify(strategy));
    } catch {
      // Ignore
    }
  }

  // ── SEO Health Score (for CEO dashboard) ────────────────────────────────────

  getOverallSeoHealth(): { score: number; grade: string; pageScores: Record<string, number> } {
    const liveExams = getLiveExams();
    const pageScores: Record<string, number> = {};

    for (const exam of liveExams) {
      const meta = websiteSeoService.generatePageMeta('exam', { exam });
      pageScores[exam.id] = websiteSeoService.calculatePageSeoScore(meta).score;
    }

    const homeMeta = websiteSeoService.generatePageMeta('home', {});
    pageScores['home'] = websiteSeoService.calculatePageSeoScore(homeMeta).score;

    const scores = Object.values(pageScores);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const grade = avg >= 90 ? 'A' : avg >= 75 ? 'B' : avg >= 60 ? 'C' : avg >= 45 ? 'D' : 'F';

    return { score: avg, grade, pageScores };
  }

  // ── Utility ─────────────────────────────────────────────────────────────────

  private _loadFreshnessMap(): Record<string, string> {
    try {
      const raw = localStorage.getItem('edugenius_growth_seo_cache');
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  /** Get all active exam configs for landing page generation */
  getActiveExams(): ExamConfig[] {
    return getLiveExams();
  }

  /** Returns the top N exam pages by priority score */
  getTopExamPages(n = 5): PagePriorityItem[] {
    return this.getPagePriorityQueue().slice(0, n);
  }

  /** Latest funnel metrics (from cache or fresh) */
  getFunnelMetrics(window: '24h' | '7d' | '30d' = '7d'): FunnelMetrics {
    return (
      acquisitionFunnelService.getCachedMetrics() ??
      acquisitionFunnelService.getFunnelMetrics(window)
    );
  }

  /** Get PageMeta for any page type — convenience wrapper for components */
  getPageMeta(pageId: string): PageMeta {
    const exam = getExamById(pageId);
    if (exam) return websiteSeoService.generatePageMeta('exam', { exam });
    if (pageId === 'home') return websiteSeoService.generatePageMeta('home', {});
    if (pageId === 'blog') return websiteSeoService.generatePageMeta('blog_index', {});
    return websiteSeoService.generatePageMeta('home', {});
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const growthOrchestrator = new GrowthOrchestrator();
export type { GrowthOrchestrator };
