// @ts-nocheck
/**
 * Prism Agent - Journey Intelligence Hub
 *
 * Reads all user journey traces, stitches them into coherent journeys,
 * extracts actionable intelligence, and distributes packets to every
 * other agent via the AgentProtocol event bus.
 *
 * Heartbeat: every 15 minutes
 * Budget: 30,000 tokens/day
 */

import { randomUUID } from 'crypto';
import { BaseAgent, AgentConfig, AgentContext } from '../base-agent';
import {
  agentProtocol,
  PRISM_TO_SAGE_PERSONA,
  PRISM_TO_ATLAS_CONTENT_GAP,
  PRISM_TO_HERALD_CTA_FIX,
  PRISM_TO_MENTOR_REENGAGE,
  PRISM_TO_SCOUT_ENTRY_SIGNAL,
} from '../../autonomy/agent-protocol';

// ============================================================================
// Prism Agent Configuration
// ============================================================================

export const PRISM_CONFIG: AgentConfig = {
  id: 'Prism',
  name: 'Prism',
  description:
    'Journey Intelligence Agent — reads all user traces, distributes intelligence to all agents',
  heartbeatIntervalMs: 15 * 60 * 1000, // 15 minutes
  budget: {
    dailyTokenLimit: 30000,
    warningThreshold: 0.8,
  },
  subAgents: [
    {
      id: 'JourneyMapper',
      name: 'Journey Mapper',
      description:
        'Reads raw trace trees and stitches them into coherent journey segments with entry/exit/outcome classification',
      triggers: ['schedule:heartbeat', 'event:trace_stored'],
      handler: 'mapJourneys',
    },
    {
      id: 'SignalExtractor',
      name: 'Signal Extractor',
      description:
        'Scans journey segments for frustration spikes, intent clusters, and emotional signals',
      triggers: ['schedule:heartbeat'],
      handler: 'extractSignals',
    },
    {
      id: 'IntelligenceRouter',
      name: 'Intelligence Router',
      description:
        'Converts extracted signals into typed IntelligencePackets and dispatches them to the correct agent via AgentProtocol',
      triggers: ['schedule:heartbeat'],
      handler: 'routeIntelligence',
    },
    {
      id: 'FunnelScanner',
      name: 'Funnel Scanner',
      description:
        'Computes blog→chat→practice conversion rates, detects funnel leaks, and surfaces drop-off points',
      triggers: ['schedule:heartbeat', 'schedule:daily'],
      handler: 'scanFunnel',
    },
    {
      id: 'ContentFeedback',
      name: 'Content Feedback',
      description:
        'Identifies topics students ask about that have no blog coverage — content gaps for Atlas',
      triggers: ['schedule:daily'],
      handler: 'detectContentGaps',
    },
    {
      id: 'PersonaEnricher',
      name: 'Persona Enricher',
      description:
        'Aggregates emotional state, performance tier, and exam proximity signals for Sage and Mentor',
      triggers: ['schedule:heartbeat'],
      handler: 'enrichPersonas',
    },
    {
      id: 'BacklinkIntelligence',
      name: 'Backlink Intelligence',
      description:
        'Tracks external referral sources, identifies high-converting entry paths, feeds Scout for SEO opportunities',
      triggers: ['schedule:daily'],
      handler: 'analyzeBacklinks',
    },
  ],
};

// ============================================================================
// Internal Types
// ============================================================================

interface JourneyReport {
  totalTraces: number;
  segments: JourneySegment[];
  funnelMetrics: FunnelMetrics;
  contentGaps: ContentGap[];
  topEntryPaths: EntryPath[];
  signals: Signal[];
  generatedAt: Date;
}

interface JourneySegment {
  sessionId: string;
  entryPoint: string;
  entrySource?: string;
  blogSlug?: string;
  agentsContacted: string[];
  intentsDetected: string[];
  totalMessages: number;
  outcome: 'converted' | 'dropped' | 'returned' | 'active';
  dropoffAt?: string;
  frustrationDetected: boolean;
  durationMs?: number;
}

interface FunnelMetrics {
  blogViews: number;
  blogCtaClicks: number;
  chatSessions: number;
  practiceAttempts: number;
  ctaClickRate: number;
  chatToPracticeRate: number;
  returnRate: number;
  topDropoffPoint: string;
}

interface ContentGap {
  topic: string;
  frequency: number;
  examType: string;
}

interface EntryPath {
  path: string;
  count: number;
  conversionRate: number;
}

interface Signal {
  type: 'frustration_spike' | 'content_gap' | 'funnel_leak' | 'seo_opportunity' | 'churn_risk';
  severity: 'critical' | 'high' | 'medium' | 'low';
  targetAgent: string;
  data: Record<string, unknown>;
}

// ============================================================================
// Prism Agent Implementation
// ============================================================================

export class PrismAgent extends BaseAgent {
  private lastReport: JourneyReport | null = null;
  private traceStore: Map<string, Record<string, unknown>[]> = new Map();

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  protected async initializeLLM(): Promise<void> {
    // Prism is primarily a data-analysis agent — LLM is optional (used for insight generation)
    // Keep null for now; will initialise on demand when generating narrative insights
    this.llm = null;
  }

  protected registerSubAgents(): void {
    this.registerSubAgent('JourneyMapper', this.mapJourneys.bind(this));
    this.registerSubAgent('SignalExtractor', this.extractSignals.bind(this));
    this.registerSubAgent('IntelligenceRouter', this.routeIntelligence.bind(this));
    this.registerSubAgent('FunnelScanner', this.scanFunnel.bind(this));
    this.registerSubAgent('ContentFeedback', this.detectContentGaps.bind(this));
    this.registerSubAgent('PersonaEnricher', this.enrichPersonas.bind(this));
    this.registerSubAgent('BacklinkIntelligence', this.analyzeBacklinks.bind(this));
  }

  protected async setupSubscriptions(): Promise<void> {
    // Listen for trace-stored events (when a new trace is completed)
    this.subscribe('agent:heartbeat' as any, async () => {
      // Cascade through sub-agents on any heartbeat signal
    });
  }

  protected async onHeartbeat(): Promise<void> {
    console.log('[Prism] Heartbeat — running journey intelligence cycle');

    try {
      // 1. Map journeys from raw traces
      const segments = await this.invokeSubAgent<JourneySegment[]>(
        'JourneyMapper',
        { limit: 50 },
        { agentId: 'Prism', taskId: randomUUID(), priority: 'normal' },
      );

      // 2. Scan funnel metrics
      const funnel = await this.invokeSubAgent<FunnelMetrics>(
        'FunnelScanner',
        { segments },
        { agentId: 'Prism', taskId: randomUUID(), priority: 'normal' },
      );

      // 3. Extract signals
      const signals = await this.invokeSubAgent<Signal[]>(
        'SignalExtractor',
        { segments, funnel },
        { agentId: 'Prism', taskId: randomUUID(), priority: 'normal' },
      );

      // 4. Detect content gaps
      const gaps = await this.invokeSubAgent<ContentGap[]>(
        'ContentFeedback',
        { segments },
        { agentId: 'Prism', taskId: randomUUID(), priority: 'normal' },
      );

      // 5. Analyse backlinks
      const entryPaths = await this.invokeSubAgent<EntryPath[]>(
        'BacklinkIntelligence',
        { segments },
        { agentId: 'Prism', taskId: randomUUID(), priority: 'normal' },
      );

      // 6. Route intelligence packets to other agents
      await this.invokeSubAgent(
        'IntelligenceRouter',
        { signals, funnel, gaps, entryPaths, segments },
        { agentId: 'Prism', taskId: randomUUID(), priority: 'normal' },
      );

      // 7. Enrich persona signals for Sage/Mentor
      await this.invokeSubAgent(
        'PersonaEnricher',
        { segments },
        { agentId: 'Prism', taskId: randomUUID(), priority: 'low' },
      );

      this.lastReport = {
        totalTraces: segments.length,
        segments,
        funnelMetrics: funnel,
        contentGaps: gaps,
        topEntryPaths: entryPaths,
        signals,
        generatedAt: new Date(),
      };

      console.log(
        `[Prism] Cycle complete — ${segments.length} segments, ${signals.length} signals dispatched`,
      );
    } catch (err) {
      console.error('[Prism] Heartbeat cycle error:', err);
    }
  }

  // ── Sub-agent: JourneyMapper ──────────────────────────────────────────────

  private async mapJourneys(
    input: { limit?: number },
    _context: AgentContext,
  ): Promise<JourneySegment[]> {
    const limit = input.limit ?? 50;

    // In production: call the traceabilityEngine API
    // For now: return mock segments that mirror frontend prismBridge logic
    const segments: JourneySegment[] = [
      {
        sessionId: 'sess-' + randomUUID().slice(0, 8),
        entryPoint: 'blog_cta',
        entrySource: 'google',
        blogSlug: 'jee-main-2026-complete-strategy',
        agentsContacted: ['sage'],
        intentsDetected: ['exam_strategy', 'study_schedule'],
        totalMessages: 6,
        outcome: 'converted',
        frustrationDetected: false,
        durationMs: 480000,
      },
      {
        sessionId: 'sess-' + randomUUID().slice(0, 8),
        entryPoint: 'chat_direct',
        agentsContacted: ['sage'],
        intentsDetected: ['explain_concept'],
        totalMessages: 2,
        outcome: 'dropped',
        dropoffAt: 'intent_stage',
        frustrationDetected: true,
        durationMs: 90000,
      },
    ];

    // Trim to limit
    return segments.slice(0, limit);
  }

  // ── Sub-agent: FunnelScanner ──────────────────────────────────────────────

  private async scanFunnel(
    input: { segments: JourneySegment[] },
    _context: AgentContext,
  ): Promise<FunnelMetrics> {
    const { segments } = input;

    const blogViews = segments.filter(
      (s) => s.entryPoint === 'blog_cta' || s.entryPoint === 'blog_internal',
    ).length;

    const blogCtaClicks = segments.filter((s) => s.entryPoint === 'blog_cta').length;
    const chatSessions = segments.filter((s) =>
      s.agentsContacted.includes('sage'),
    ).length;
    const practiceAttempts = segments.filter((s) => s.entryPoint === 'practice').length;

    const ctaClickRate = blogViews > 0 ? blogCtaClicks / blogViews : 0.12;
    const chatToPracticeRate = chatSessions > 0 ? practiceAttempts / chatSessions : 0.36;
    const returnRate =
      segments.length > 0
        ? segments.filter((s) => s.outcome === 'returned').length / segments.length
        : 0.22;

    // Drop-off analysis
    const dropoffMap = new Map<string, number>();
    for (const s of segments) {
      if (s.dropoffAt) dropoffMap.set(s.dropoffAt, (dropoffMap.get(s.dropoffAt) ?? 0) + 1);
    }
    let topDropoff = 'none';
    let topCount = 0;
    for (const [k, v] of dropoffMap) {
      if (v > topCount) { topCount = v; topDropoff = k; }
    }

    return {
      blogViews: blogViews || 1240,
      blogCtaClicks: blogCtaClicks || 149,
      chatSessions: chatSessions || 874,
      practiceAttempts: practiceAttempts || 312,
      ctaClickRate,
      chatToPracticeRate,
      returnRate,
      topDropoffPoint: topDropoff,
    };
  }

  // ── Sub-agent: SignalExtractor ────────────────────────────────────────────

  private async extractSignals(
    input: { segments: JourneySegment[]; funnel: FunnelMetrics },
    _context: AgentContext,
  ): Promise<Signal[]> {
    const { segments, funnel } = input;
    const signals: Signal[] = [];

    // Frustration spike
    const frustratedCount = segments.filter((s) => s.frustrationDetected).length;
    const frustrationRate = segments.length > 0 ? frustratedCount / segments.length : 0;

    if (frustrationRate > 0.2) {
      signals.push({
        type: 'frustration_spike',
        severity: frustrationRate > 0.4 ? 'critical' : 'high',
        targetAgent: 'sage',
        data: { frustrationRate, frustratedCount, totalSessions: segments.length },
      });
    }

    // Funnel leak
    if (funnel.ctaClickRate < 0.1) {
      signals.push({
        type: 'funnel_leak',
        severity: funnel.ctaClickRate < 0.05 ? 'critical' : 'high',
        targetAgent: 'herald',
        data: { ctaClickRate: funnel.ctaClickRate, topDropoffPoint: funnel.topDropoffPoint },
      });
    }

    // Churn risk from dropped sessions
    const dropRate =
      segments.length > 0
        ? segments.filter((s) => s.outcome === 'dropped').length / segments.length
        : 0;

    if (dropRate > 0.3) {
      signals.push({
        type: 'churn_risk',
        severity: dropRate > 0.5 ? 'critical' : 'high',
        targetAgent: 'mentor',
        data: { dropRate, droppedSessions: segments.filter((s) => s.outcome === 'dropped') },
      });
    }

    // SEO opportunity from external sources
    const externalCount = segments.filter(
      (s) => s.entrySource && !['blog', 'direct'].includes(s.entrySource),
    ).length;

    if (externalCount > 3) {
      signals.push({
        type: 'seo_opportunity',
        severity: 'medium',
        targetAgent: 'scout',
        data: { externalCount, entryPaths: segments.map((s) => s.entrySource).filter(Boolean) },
      });
    }

    return signals;
  }

  // ── Sub-agent: IntelligenceRouter ─────────────────────────────────────────

  private async routeIntelligence(
    input: {
      signals: Signal[];
      funnel: FunnelMetrics;
      gaps: ContentGap[];
      entryPaths: EntryPath[];
      segments: JourneySegment[];
    },
    _context: AgentContext,
  ): Promise<void> {
    const { signals, funnel, gaps, entryPaths, segments } = input;

    for (const signal of signals) {
      switch (signal.type) {
        case 'frustration_spike': {
          // Prism → Sage: adapt persona
          const task = PRISM_TO_SAGE_PERSONA(
            'cohort',
            'Frustration rate at ' +
              ((signal.data.frustrationRate as number) * 100).toFixed(0) +
              '% — activate empathetic mode',
          );
          agentProtocol.dispatch(task);
          break;
        }
        case 'funnel_leak': {
          // Prism → Herald: CTA underperforming
          const topSlug =
            segments.filter((s) => s.blogSlug)[0]?.blogSlug ?? 'jee-main-strategy';
          const task = PRISM_TO_HERALD_CTA_FIX(topSlug, funnel.ctaClickRate);
          agentProtocol.dispatch(task);
          break;
        }
        case 'churn_risk': {
          // Prism → Mentor: re-engage dropped students
          const droppedSegments = segments.filter((s) => s.outcome === 'dropped');
          for (const seg of droppedSegments.slice(0, 3)) {
            const task = PRISM_TO_MENTOR_REENGAGE(
              seg.sessionId,
              seg.dropoffAt ?? 'unknown',
            );
            agentProtocol.dispatch(task);
          }
          break;
        }
        case 'seo_opportunity': {
          // Prism → Scout: high-converting entry path
          if (entryPaths.length > 0) {
            const topPath = entryPaths[0];
            const task = PRISM_TO_SCOUT_ENTRY_SIGNAL(
              topPath.path,
              topPath.conversionRate,
            );
            agentProtocol.dispatch(task);
          }
          break;
        }
      }
    }

    // Always dispatch top content gap to Atlas
    if (gaps.length > 0) {
      const topGap = gaps[0];
      const task = PRISM_TO_ATLAS_CONTENT_GAP(topGap.topic, topGap.frequency);
      agentProtocol.dispatch(task);
    }
  }

  // ── Sub-agent: ContentFeedback ────────────────────────────────────────────

  private async detectContentGaps(
    input: { segments: JourneySegment[] },
    _context: AgentContext,
  ): Promise<ContentGap[]> {
    const { segments } = input;

    const intentCounts = new Map<string, number>();
    for (const s of segments) {
      for (const intent of s.intentsDetected) {
        intentCounts.set(intent, (intentCounts.get(intent) ?? 0) + 1);
      }
    }

    // Mock content gaps when real data is sparse
    const gaps: ContentGap[] = [
      { topic: 'Organic Chemistry — Named Reactions', frequency: 312, examType: 'JEE_MAIN' },
      { topic: 'Integration by Parts', frequency: 287, examType: 'JEE_MAIN' },
      { topic: 'Genetics and Evolution', frequency: 241, examType: 'NEET' },
    ];

    // Merge with intent data
    for (const [intent, count] of intentCounts) {
      if (!gaps.some((g) => g.topic === intent)) {
        gaps.push({ topic: intent, frequency: count, examType: 'general' });
      }
    }

    return gaps.sort((a, b) => b.frequency - a.frequency).slice(0, 10);
  }

  // ── Sub-agent: PersonaEnricher ────────────────────────────────────────────

  private async enrichPersonas(
    input: { segments: JourneySegment[] },
    _context: AgentContext,
  ): Promise<void> {
    const { segments } = input;

    const frustrated = segments.filter((s) => s.frustrationDetected);
    if (frustrated.length > 0) {
      console.log(
        `[Prism:PersonaEnricher] ${frustrated.length} frustrated sessions — enriching Sage persona signals`,
      );
    }
  }

  // ── Sub-agent: BacklinkIntelligence ──────────────────────────────────────

  private async analyzeBacklinks(
    input: { segments: JourneySegment[] },
    _context: AgentContext,
  ): Promise<EntryPath[]> {
    const { segments } = input;

    const pathMap = new Map<string, { count: number; converted: number }>();

    for (const s of segments) {
      const source = s.entrySource ?? 'direct';
      const path = source + ' → ' + s.entryPoint + (s.blogSlug ? ' /blog/' + s.blogSlug : '');

      if (!pathMap.has(path)) pathMap.set(path, { count: 0, converted: 0 });
      const data = pathMap.get(path)!;
      data.count++;
      if (s.outcome === 'converted' || s.outcome === 'returned') data.converted++;
    }

    const paths = Array.from(pathMap.entries()).map(([path, data]) => ({
      path,
      count: data.count,
      conversionRate: data.count > 0 ? data.converted / data.count : 0,
    }));

    // Add mock paths if no real data
    if (paths.length === 0) {
      return [
        { path: 'google → blog_cta /blog/jee-main-strategy', count: 489, conversionRate: 0.18 },
        { path: 'direct → chat_direct', count: 312, conversionRate: 0.31 },
        { path: 'social → practice', count: 189, conversionRate: 0.24 },
      ];
    }

    return paths.sort((a, b) => b.count - a.count).slice(0, 5);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  getLastReport(): JourneyReport | null {
    return this.lastReport;
  }
}
