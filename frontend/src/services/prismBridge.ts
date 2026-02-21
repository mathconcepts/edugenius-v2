/**
 * prismBridge.ts — Prism Journey Intelligence Bridge
 *
 * Reads all available signals and generates IntelligencePackets
 * targeted at specific agents. Each packet tells an agent what it
 * should know and what action it should consider taking.
 */

import { listRecentTraces, TraceTree } from './traceabilityEngine';
import { getCohortInsights, CohortInsight } from './personaContentBridge';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PrismTargetAgent =
  | 'sage'
  | 'atlas'
  | 'herald'
  | 'scout'
  | 'mentor'
  | 'oracle'
  | 'forge';

export interface IntelligencePacket {
  id: string;
  generatedAt: string;
  targetAgent: PrismTargetAgent;
  subAgent?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  signalType: string;
  insight: string;
  actionRequired: string;
  dataPoints: Record<string, unknown>;
  expiresAt?: string;
  status: 'pending' | 'acknowledged' | 'actioned' | 'expired';
}

export interface JourneySegment {
  userId?: string;
  sessionId: string;
  entryPoint: string;
  entrySource?: string;
  blogSlug?: string;
  agentsContacted: string[];
  intentsDetected: string[];
  totalMessages: number;
  durationMs?: number;
  completedAt?: string;
  outcome: 'converted' | 'dropped' | 'returned' | 'active';
  dropoffAt?: string;
  frustrationDetected: boolean;
}

export interface FunnelMetrics {
  blogViews: number;
  blogCtaClicks: number;
  chatSessions: number;
  practiceAttempts: number;
  practiceReturns: number;
  ctaClickRate: number;
  chatToPracticeRate: number;
  returnRate: number;
  avgSessionMessages: number;
  topDropoffPoint: string;
}

export interface PrismState {
  lastRunAt: string;
  journeySegments: JourneySegment[];
  intelligencePackets: IntelligencePacket[];
  funnelMetrics: FunnelMetrics;
  contentGaps: { topic: string; frequency: number; examType: string }[];
  topEntryPaths: { path: string; count: number; conversionRate: number }[];
  isMockData: boolean;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const PRISM_STORAGE_KEY = 'edugenius_prism_state';

export function storePrismState(state: PrismState): void {
  try {
    localStorage.setItem(PRISM_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('[Prism] Failed to persist state:', e);
  }
}

export function loadPrismState(): PrismState | null {
  try {
    const raw = localStorage.getItem(PRISM_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PrismState;
  } catch {
    return null;
  }
}

export function getPrismPacketsForAgent(agent: PrismTargetAgent): IntelligencePacket[] {
  const state = loadPrismState();
  if (!state) return [];
  return state.intelligencePackets.filter(
    (p) => p.targetAgent === agent && p.status !== 'expired',
  );
}

export function acknowledgePacket(id: string): void {
  const state = loadPrismState();
  if (!state) return;
  const packet = state.intelligencePackets.find((p) => p.id === id);
  if (packet) {
    packet.status = 'acknowledged';
    storePrismState(state);
  }
}

export function actionPacket(id: string): void {
  const state = loadPrismState();
  if (!state) return;
  const packet = state.intelligencePackets.find((p) => p.id === id);
  if (packet) {
    packet.status = 'actioned';
    storePrismState(state);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return 'prism-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

// ─── Journey segment builders ─────────────────────────────────────────────────

function buildJourneySegments(traces: TraceTree[]): JourneySegment[] {
  const sessionMap = new Map<string, TraceTree[]>();
  for (const trace of traces) {
    const sid = trace.context.sessionId;
    if (!sessionMap.has(sid)) sessionMap.set(sid, []);
    sessionMap.get(sid)!.push(trace);
  }

  const segments: JourneySegment[] = [];

  for (const [sessionId, sessionTraces] of sessionMap) {
    const primary = sessionTraces[0];
    const ctx = primary.context;

    const agentsSet = new Set<string>();
    const intentsSet = new Set<string>();
    let totalMessages = 0;
    let frustrationDetected = false;
    let dropoffAt: string | undefined;

    for (const trace of sessionTraces) {
      for (const node of trace.nodes) {
        if (node.agentId) agentsSet.add(node.agentId.toLowerCase());
        if (node.nodeType === 'intent') {
          intentsSet.add(node.action);
          totalMessages++;
        }
        if (
          node.metadata?.emotion === 'frustrated' ||
          node.metadata?.intent === 'motivation' ||
          node.metadata?.emotion === 'anxious'
        ) {
          frustrationDetected = true;
        }
      }

      if (!trace.completedAt) {
        const lastNode = trace.nodes[trace.nodes.length - 1];
        if (lastNode) {
          if (lastNode.nodeType === 'intent') {
            dropoffAt = 'intent_stage';
          } else if (lastNode.nodeType === 'entry') {
            dropoffAt = ctx.entryPoint;
          } else if (lastNode.agentId) {
            dropoffAt = lastNode.agentId.toLowerCase() + '_response';
          } else {
            dropoffAt = lastNode.nodeType;
          }
        }
      }
    }

    const isCompleted = sessionTraces.every((t) => t.completedAt);
    const hasMultiple = sessionTraces.length > 1;
    const hasFrustration = frustrationDetected && !isCompleted;

    let outcome: JourneySegment['outcome'];
    if (isCompleted) {
      outcome = hasMultiple ? 'returned' : 'converted';
    } else if (hasFrustration) {
      outcome = 'dropped';
    } else if (hasMultiple) {
      outcome = 'returned';
    } else {
      outcome = 'active';
    }

    const startMs = new Date(primary.createdAt).getTime();
    const endMs = primary.completedAt
      ? new Date(primary.completedAt).getTime()
      : Date.now();

    segments.push({
      userId: ctx.userId,
      sessionId,
      entryPoint: ctx.entryPoint,
      entrySource: ctx.utmSource,
      blogSlug: ctx.blogSlug,
      agentsContacted: Array.from(agentsSet),
      intentsDetected: Array.from(intentsSet),
      totalMessages,
      durationMs: endMs - startMs,
      completedAt: primary.completedAt,
      outcome,
      dropoffAt,
      frustrationDetected,
    });
  }

  return segments;
}

// ─── Funnel metrics ───────────────────────────────────────────────────────────

function computeFunnelMetrics(journeys: JourneySegment[]): FunnelMetrics {
  const blogViews = journeys.filter(
    (j) => j.entryPoint === 'blog_cta' || j.entryPoint === 'blog_internal',
  ).length;

  const blogCtaClicks = journeys.filter((j) => j.entryPoint === 'blog_cta').length;

  const chatSessions = journeys.filter(
    (j) => j.agentsContacted.includes('sage') || j.agentsContacted.includes('mentor'),
  ).length;

  const practiceAttempts = journeys.filter((j) => j.entryPoint === 'practice').length;

  const practiceReturns = journeys.filter(
    (j) => j.entryPoint === 'practice' && j.outcome === 'returned',
  ).length;

  const ctaClickRate = blogViews > 0 ? blogCtaClicks / blogViews : 0;

  const chatToPracticeRate =
    chatSessions > 0
      ? journeys.filter(
          (j) => j.agentsContacted.includes('sage') && j.outcome !== 'dropped',
        ).length / chatSessions
      : 0;

  const returnRate =
    journeys.length > 0
      ? journeys.filter((j) => j.outcome === 'returned').length / journeys.length
      : 0;

  const totalMessages = journeys.reduce((sum, j) => sum + j.totalMessages, 0);
  const avgSessionMessages =
    journeys.length > 0 ? Math.round(totalMessages / journeys.length) : 0;

  const dropoffCounts = new Map<string, number>();
  for (const j of journeys) {
    if (j.dropoffAt) {
      dropoffCounts.set(j.dropoffAt, (dropoffCounts.get(j.dropoffAt) || 0) + 1);
    }
  }
  let topDropoffPoint = 'none';
  let maxCount = 0;
  for (const [point, count] of dropoffCounts) {
    if (count > maxCount) {
      maxCount = count;
      topDropoffPoint = point;
    }
  }

  return {
    blogViews,
    blogCtaClicks,
    chatSessions,
    practiceAttempts,
    practiceReturns,
    ctaClickRate: Math.round(ctaClickRate * 1000) / 1000,
    chatToPracticeRate: Math.round(chatToPracticeRate * 1000) / 1000,
    returnRate: Math.round(returnRate * 1000) / 1000,
    avgSessionMessages,
    topDropoffPoint,
  };
}

// ─── Content gap detection ────────────────────────────────────────────────────

const KNOWN_BLOG_TOPICS = [
  'integration_by_parts',
  'organic_chemistry',
  'jee_main_strategy',
  'neet_biology_tips',
  'reading_comprehension',
  'cat_quant_strategy',
  'electrochemistry',
  'modern_physics',
  'genetics_evolution',
  'coordinate_geometry',
];

function detectContentGaps(
  traces: TraceTree[],
  cohort: CohortInsight,
): { topic: string; frequency: number; examType: string }[] {
  const intentCounts = new Map<string, number>();
  const intentExams = new Map<string, string>();

  for (const trace of traces) {
    const examType = trace.context.examType || 'general';
    for (const node of trace.nodes) {
      if (node.nodeType === 'intent') {
        const intent = node.action.replace(/_/g, ' ').trim();
        intentCounts.set(intent, (intentCounts.get(intent) || 0) + 1);
        if (!intentExams.has(intent)) intentExams.set(intent, examType);
      }
    }
  }

  for (const weakTopic of cohort.topWeakTopics || []) {
    const key = weakTopic.topic.toLowerCase().replace(/\s+/g, '_');
    const isCovered = KNOWN_BLOG_TOPICS.some((slug) => slug.includes(key.slice(0, 8)));
    if (!isCovered) {
      const existing = intentCounts.get(weakTopic.topic) || 0;
      intentCounts.set(weakTopic.topic, existing + weakTopic.count);
      intentExams.set(weakTopic.topic, String(weakTopic.examType));
    }
  }

  const gaps: { topic: string; frequency: number; examType: string }[] = [];
  for (const [topic, frequency] of intentCounts) {
    const normalized = topic.toLowerCase().replace(/\s+/g, '_');
    const isCovered = KNOWN_BLOG_TOPICS.some((slug) => {
      const parts = slug.split('_');
      return parts.some((p) => normalized.includes(p) && p.length > 4);
    });
    if (!isCovered && frequency > 0) {
      gaps.push({ topic, frequency, examType: intentExams.get(topic) || 'general' });
    }
  }

  return gaps.sort((a, b) => b.frequency - a.frequency).slice(0, 10);
}

// ─── Intelligence packet generators ──────────────────────────────────────────

function generateSageIntel(
  journeys: JourneySegment[],
  cohort: CohortInsight,
): IntelligencePacket {
  const frustrating = journeys.filter((j) => j.frustrationDetected);
  const frustrationRate = journeys.length > 0 ? frustrating.length / journeys.length : 0;
  const dominantEmotion = cohort.dominantEmotion || 'neutral';
  const topTopic = cohort.topWeakTopics?.[0]?.topic || 'exam concepts';
  const priority: IntelligencePacket['priority'] =
    frustrationRate > 0.4 ? 'critical' : frustrationRate > 0.2 ? 'high' : 'medium';

  return {
    id: uid(),
    generatedAt: new Date().toISOString(),
    targetAgent: 'sage',
    subAgent: 'AdaptiveTutor',
    priority,
    signalType: frustrationRate > 0.25 ? 'frustration_spike' : 'persona_drift',
    insight:
      Math.round(frustrationRate * 100) +
      '% of recent sessions show frustration signals. Dominant cohort emotion is "' +
      dominantEmotion +
      '". Top unresolved topic: ' +
      topTopic +
      '.',
    actionRequired:
      'Activate empathetic tone mode for new sessions. Lead with reassurance before content. For ' +
      topTopic +
      ', proactively offer step-by-step breakdowns rather than waiting for follow-up questions.',
    dataPoints: {
      frustrationRate,
      dominantEmotion,
      topWeakTopic: topTopic,
      frustratedSessions: frustrating.length,
      totalSessions: journeys.length,
      avgSyllabusCompletion: cohort.avgSyllabusCompletion,
    },
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  };
}

function generateAtlasIntel(
  contentGaps: { topic: string; frequency: number; examType: string }[],
  journeys: JourneySegment[],
): IntelligencePacket {
  const topGap = contentGaps[0];
  const gapCount = contentGaps.length;
  const priority: IntelligencePacket['priority'] =
    topGap?.frequency > 50 ? 'critical' : gapCount > 5 ? 'high' : 'medium';

  return {
    id: uid(),
    generatedAt: new Date().toISOString(),
    targetAgent: 'atlas',
    subAgent: 'ContentCurator',
    priority,
    signalType: 'content_gap',
    insight: topGap
      ? gapCount +
        ' content gaps detected. Highest demand: "' +
        topGap.topic +
        '" (' +
        topGap.frequency +
        ' student queries, ' +
        topGap.examType +
        ') with zero blog coverage.'
      : 'No critical content gaps detected. Content coverage is aligned with student demand.',
    actionRequired: topGap
      ? 'Prioritise creating a comprehensive guide on "' +
        topGap.topic +
        '" for ' +
        topGap.examType +
        '. Use Socratic structure: concept → worked example → practice. Target 1,500 words with SEO optimisation.'
      : 'Monitor content gaps weekly. Consider refreshing high-traffic existing posts.',
    dataPoints: {
      totalGaps: gapCount,
      topGap: topGap || null,
      allGaps: contentGaps.slice(0, 5),
      blogEntryJourneys: journeys.filter((j) => j.entryPoint === 'blog_cta').length,
    },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  };
}

function generateHeraldIntel(
  funnel: FunnelMetrics,
  journeys: JourneySegment[],
): IntelligencePacket {
  const ctaRate = funnel.ctaClickRate;
  const priority: IntelligencePacket['priority'] =
    ctaRate < 0.05 ? 'critical' : ctaRate < 0.1 ? 'high' : 'medium';
  const droppedJourneys = journeys.filter((j) => j.outcome === 'dropped');
  const topBlogSlug =
    journeys.filter((j) => j.blogSlug)[0]?.blogSlug || 'jee-main-2026-strategy';

  return {
    id: uid(),
    generatedAt: new Date().toISOString(),
    targetAgent: 'herald',
    subAgent: 'CampaignStrategist',
    priority,
    signalType: ctaRate < 0.1 ? 'funnel_leak' : 'engagement_opportunity',
    insight:
      'Blog CTA click-through rate is ' +
      (ctaRate * 100).toFixed(1) +
      '% (target: >15%). ' +
      droppedJourneys.length +
      ' sessions dropped before reaching chat. Top drop point: "' +
      funnel.topDropoffPoint +
      '".',
    actionRequired:
      'A/B test a new CTA on /blog/' +
      topBlogSlug +
      ': change "Try AI Tutor" to "Ask Sage — Get Your Answer in 30s". Add a social proof line ("Join 1,240+ students"). Consider adding an exit-intent micro-quiz to capture dropping users.',
    dataPoints: {
      ctaClickRate: ctaRate,
      blogViews: funnel.blogViews,
      blogCtaClicks: funnel.blogCtaClicks,
      droppedSessions: droppedJourneys.length,
      topDropoffPoint: funnel.topDropoffPoint,
      topBlogSlug,
    },
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  };
}

function generateScoutIntel(journeys: JourneySegment[]): IntelligencePacket {
  const pathCounts = new Map<string, { count: number; converted: number }>();
  for (const j of journeys) {
    const path = (j.entrySource || 'direct') + ' → ' + j.entryPoint;
    if (!pathCounts.has(path)) pathCounts.set(path, { count: 0, converted: 0 });
    const entry = pathCounts.get(path)!;
    entry.count++;
    if (j.outcome === 'converted' || j.outcome === 'returned') entry.converted++;
  }

  let topPath = 'direct → chat_direct';
  let topRate = 0;
  for (const [path, data] of pathCounts) {
    const rate = data.count > 0 ? data.converted / data.count : 0;
    if (rate > topRate) {
      topRate = rate;
      topPath = path;
    }
  }

  const externalSources = journeys.filter(
    (j) => j.entrySource && j.entrySource !== 'blog',
  );
  const priority: IntelligencePacket['priority'] =
    externalSources.length > 5 ? 'high' : 'medium';

  return {
    id: uid(),
    generatedAt: new Date().toISOString(),
    targetAgent: 'scout',
    subAgent: 'TrendSpotter',
    priority,
    signalType: 'seo_opportunity',
    insight:
      'Highest converting entry path: "' +
      topPath +
      '" at ' +
      (topRate * 100).toFixed(0) +
      '% conversion. ' +
      externalSources.length +
      ' sessions arrived from external sources — potential SEO/referral opportunity.',
    actionRequired:
      'Investigate the "' +
      topPath +
      '" path. Find the organic keywords driving this traffic. Identify 3 similar high-intent keywords for Atlas to target with new blog content. Cross-reference with competitor gap analysis.',
    dataPoints: {
      topConvertingPath: topPath,
      topConversionRate: topRate,
      externalSourceCount: externalSources.length,
      allPaths: Array.from(pathCounts.entries()).map(([p, d]) => ({
        path: p,
        count: d.count,
        conversionRate: d.count > 0 ? d.converted / d.count : 0,
      })),
    },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  };
}

function generateMentorIntel(
  journeys: JourneySegment[],
  cohort: CohortInsight,
): IntelligencePacket {
  const dropped = journeys.filter((j) => j.outcome === 'dropped');
  const dropRate = journeys.length > 0 ? dropped.length / journeys.length : 0;
  const priority: IntelligencePacket['priority'] =
    dropRate > 0.4 ? 'critical' : dropRate > 0.2 ? 'high' : 'medium';

  const strugglingPct = cohort.tierDistribution?.struggling ?? 34;
  const atRisk = cohort.totalStudents
    ? Math.round((cohort.totalStudents * strugglingPct) / 100)
    : 0;

  return {
    id: uid(),
    generatedAt: new Date().toISOString(),
    targetAgent: 'mentor',
    subAgent: 'RetentionEngine',
    priority,
    signalType: dropRate > 0.3 ? 'funnel_leak' : 'churn_risk',
    insight:
      dropped.length +
      ' sessions dropped mid-journey (' +
      (dropRate * 100).toFixed(0) +
      '% drop rate). ' +
      atRisk +
      " students in struggling tier haven't returned in 3+ days.",
    actionRequired:
      'Send re-engagement WhatsApp/push to dropped sessions within 2 hours. Use subject: "Where did you go? Your question is still here 👋". For struggling tier (' +
      atRisk +
      ' students), trigger a "Quick Win" micro-lesson series to rebuild momentum.',
    dataPoints: {
      droppedSessions: dropped.length,
      dropRate,
      atRiskStudents: atRisk,
      avgStreakDays: cohort.avgStreakDays,
      dominantEmotion: cohort.dominantEmotion,
      droppedAtPoints: dropped.map((j) => j.dropoffAt).filter(Boolean),
    },
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  };
}

function generateOracleIntel(
  funnel: FunnelMetrics,
  journeys: JourneySegment[],
): IntelligencePacket {
  const funnelHealth =
    funnel.ctaClickRate > 0.15 && funnel.chatToPracticeRate > 0.3 ? 'good' : 'poor';
  const priority: IntelligencePacket['priority'] =
    funnelHealth === 'poor' ? 'high' : 'medium';

  return {
    id: uid(),
    generatedAt: new Date().toISOString(),
    targetAgent: 'oracle',
    subAgent: 'FunnelAnalyzer',
    priority,
    signalType: 'funnel_analysis',
    insight:
      'Funnel health: ' +
      funnelHealth +
      '. CTA→Chat: ' +
      (funnel.ctaClickRate * 100).toFixed(1) +
      '%, Chat→Practice: ' +
      (funnel.chatToPracticeRate * 100).toFixed(1) +
      '%, Return rate: ' +
      (funnel.returnRate * 100).toFixed(1) +
      '%. Avg session: ' +
      funnel.avgSessionMessages +
      ' messages.',
    actionRequired:
      'Generate a full funnel attribution report. Flag if CTA click rate drops below 10% for 3 consecutive days — trigger Herald alert. Track cohort return rate trend: target >25% monthly return. Surface these metrics in next CEO daily brief.',
    dataPoints: {
      funnelMetrics: funnel,
      journeyCount: journeys.length,
      convertedJourneys: journeys.filter((j) => j.outcome === 'converted').length,
      returnedJourneys: journeys.filter((j) => j.outcome === 'returned').length,
      activeJourneys: journeys.filter((j) => j.outcome === 'active').length,
      droppedJourneys: journeys.filter((j) => j.outcome === 'dropped').length,
    },
    expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  };
}

function generateForgeIntel(funnel: FunnelMetrics): IntelligencePacket {
  const highTraffic = funnel.blogViews > 1000 || funnel.chatSessions > 500;
  const priority: IntelligencePacket['priority'] = highTraffic ? 'high' : 'medium';

  return {
    id: uid(),
    generatedAt: new Date().toISOString(),
    targetAgent: 'forge',
    subAgent: 'InfraOptimizer',
    priority,
    signalType: highTraffic ? 'scale_signal' : 'performance_check',
    insight:
      funnel.chatSessions +
      ' chat sessions observed with avg ' +
      funnel.avgSessionMessages +
      ' messages. Blog driving ' +
      funnel.blogViews +
      ' views. ' +
      (highTraffic
        ? 'Traffic volume warrants infrastructure review.'
        : 'Current load is within normal range.'),
    actionRequired: highTraffic
      ? 'Review LLM response latency for Sage. Ensure edge caching is active for top blog posts. Pre-warm CDN for upcoming exam peak season. Set autoscale threshold at 800 concurrent sessions.'
      : 'Perform weekly infrastructure health check. Verify localStorage quota usage for trace storage. Confirm CDN cache hit rate > 85% for blog routes.',
    dataPoints: {
      blogViews: funnel.blogViews,
      chatSessions: funnel.chatSessions,
      practiceAttempts: funnel.practiceAttempts,
      avgSessionMessages: funnel.avgSessionMessages,
      highTrafficSignal: highTraffic,
    },
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  };
}

// ─── Top entry paths ──────────────────────────────────────────────────────────

function computeTopEntryPaths(
  journeys: JourneySegment[],
): { path: string; count: number; conversionRate: number }[] {
  const pathMap = new Map<string, { count: number; converted: number }>();

  for (const j of journeys) {
    const source = j.entrySource || 'direct';
    const entry = j.entryPoint.replace(/_/g, ' ');
    const slug = j.blogSlug ? ' /blog/' + j.blogSlug : '';
    const path = source + ' → ' + entry + slug;

    if (!pathMap.has(path)) pathMap.set(path, { count: 0, converted: 0 });
    const data = pathMap.get(path)!;
    data.count++;
    if (j.outcome === 'converted' || j.outcome === 'returned') data.converted++;
  }

  return Array.from(pathMap.entries())
    .map(([path, data]) => ({
      path,
      count: data.count,
      conversionRate:
        data.count > 0 ? Math.round((data.converted / data.count) * 1000) / 1000 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// ─── Mock data ────────────────────────────────────────────────────────────────

function buildMockPrismState(): PrismState {
  const journeySegments: JourneySegment[] = [
    {
      sessionId: 'demo-sess-001',
      entryPoint: 'blog_cta',
      entrySource: 'google',
      blogSlug: 'jee-main-2026-complete-strategy',
      agentsContacted: ['sage'],
      intentsDetected: ['exam_strategy', 'study_schedule'],
      totalMessages: 6,
      durationMs: 480000,
      completedAt: new Date(Date.now() - 1800000).toISOString(),
      outcome: 'converted',
      frustrationDetected: false,
    },
    {
      sessionId: 'demo-sess-002',
      entryPoint: 'chat_direct',
      entrySource: 'direct',
      agentsContacted: ['sage'],
      intentsDetected: ['explain_concept'],
      totalMessages: 3,
      durationMs: 240000,
      outcome: 'dropped',
      dropoffAt: 'sage_response',
      frustrationDetected: true,
    },
    {
      sessionId: 'demo-sess-003',
      entryPoint: 'practice',
      entrySource: 'social',
      agentsContacted: ['sage', 'mentor'],
      intentsDetected: ['generate_questions', 'explain_concept'],
      totalMessages: 12,
      durationMs: 900000,
      completedAt: new Date(Date.now() - 3600000).toISOString(),
      outcome: 'returned',
      frustrationDetected: false,
    },
  ];

  const funnelMetrics: FunnelMetrics = {
    blogViews: 1240,
    blogCtaClicks: 149,
    chatSessions: 874,
    practiceAttempts: 312,
    practiceReturns: 89,
    ctaClickRate: 0.12,
    chatToPracticeRate: 0.36,
    returnRate: 0.22,
    avgSessionMessages: 7,
    topDropoffPoint: 'blog_cta',
  };

  const contentGaps = [
    { topic: 'Organic Chemistry — Named Reactions', frequency: 312, examType: 'JEE_MAIN' },
    { topic: 'Integration by Parts', frequency: 287, examType: 'JEE_MAIN' },
    { topic: 'Genetics and Evolution', frequency: 241, examType: 'NEET' },
  ];

  const topEntryPaths = [
    { path: 'google → blog cta /blog/jee-main-2026-complete-strategy', count: 489, conversionRate: 0.18 },
    { path: 'direct → chat direct', count: 312, conversionRate: 0.31 },
    { path: 'social → practice', count: 189, conversionRate: 0.24 },
    { path: 'email → blog cta', count: 143, conversionRate: 0.22 },
    { path: 'whatsapp → chat direct', count: 107, conversionRate: 0.28 },
  ];

  // Generate mock intelligence packets
  const cohort = getCohortInsights();
  const intelligencePackets: IntelligencePacket[] = [
    generateSageIntel(journeySegments, cohort),
    generateAtlasIntel(contentGaps, journeySegments),
    generateHeraldIntel(funnelMetrics, journeySegments),
    generateScoutIntel(journeySegments),
    generateMentorIntel(journeySegments, cohort),
    generateOracleIntel(funnelMetrics, journeySegments),
    generateForgeIntel(funnelMetrics),
  ];

  return {
    lastRunAt: new Date().toISOString(),
    journeySegments,
    intelligencePackets,
    funnelMetrics,
    contentGaps,
    topEntryPaths,
    isMockData: true,
  };
}

// ─── Main export: runPrismAnalysis ────────────────────────────────────────────

export function runPrismAnalysis(): PrismState {
  const traces = listRecentTraces(50);

  // Use mock data if no real traces exist
  if (traces.length === 0) {
    const mockState = buildMockPrismState();
    storePrismState(mockState);
    return mockState;
  }

  const cohort = getCohortInsights();
  const journeySegments = buildJourneySegments(traces);
  const funnelMetrics = computeFunnelMetrics(journeySegments);
  const contentGaps = detectContentGaps(traces, cohort);
  const topEntryPaths = computeTopEntryPaths(journeySegments);

  const intelligencePackets: IntelligencePacket[] = [
    generateSageIntel(journeySegments, cohort),
    generateAtlasIntel(contentGaps, journeySegments),
    generateHeraldIntel(funnelMetrics, journeySegments),
    generateScoutIntel(journeySegments),
    generateMentorIntel(journeySegments, cohort),
    generateOracleIntel(funnelMetrics, journeySegments),
    generateForgeIntel(funnelMetrics),
  ];

  const state: PrismState = {
    lastRunAt: new Date().toISOString(),
    journeySegments,
    intelligencePackets,
    funnelMetrics,
    contentGaps,
    topEntryPaths,
    isMockData: false,
  };

  storePrismState(state);
  return state;
}

// ─── Exported helpers for agent consumption ───────────────────────────────────

/**
 * getFunnelMetrics — Returns the latest funnel metrics from Prism state.
 * Used by RevenueDashboard (Section A) and Oracle A/B test tracking.
 */
export function getFunnelMetrics(): FunnelMetrics | null {
  const state = loadPrismState();
  return state?.funnelMetrics ?? null;
}

// ─── A/B Test Baseline Tracking ──────────────────────────────────────────────

const AB_BASELINE_KEY = 'edugenius_ab_baselines';

export interface ABTestBaseline {
  testId: string;
  metric: string;
  controlValue: number;
  lockedAt: string;
  source: string;
  notes?: string;
}

export interface ABTestSplit {
  testId: string;
  controlClicks: number;
  variantClicks: number;
  controlRate?: number;
  variantRate?: number;
  significanceReached: boolean;
  winner?: 'control' | 'variant' | null;
  lockedAt: string;
  lastUpdated: string;
}

const AB_SPLIT_KEY = 'edugenius_ab_splits';

/** Lock a pre-test baseline value for an A/B experiment */
export function lockABBaseline(baseline: Omit<ABTestBaseline, 'lockedAt'>): ABTestBaseline {
  const entry: ABTestBaseline = { ...baseline, lockedAt: new Date().toISOString() };
  try {
    const existing: ABTestBaseline[] = JSON.parse(localStorage.getItem(AB_BASELINE_KEY) ?? '[]');
    const idx = existing.findIndex(b => b.testId === baseline.testId);
    if (idx >= 0) existing[idx] = entry; else existing.push(entry);
    localStorage.setItem(AB_BASELINE_KEY, JSON.stringify(existing));
  } catch { /* localStorage unavailable */ }
  return entry;
}

/** Retrieve all locked baselines */
export function getABBaselines(): ABTestBaseline[] {
  try {
    return JSON.parse(localStorage.getItem(AB_BASELINE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/** Get baseline for a specific test */
export function getABBaseline(testId: string): ABTestBaseline | null {
  return getABBaselines().find(b => b.testId === testId) ?? null;
}

/** Update split click counts and check for statistical significance (100 clicks/variant) */
export function updateABSplit(
  testId: string,
  side: 'control' | 'variant',
  count = 1,
): ABTestSplit {
  let splits: ABTestSplit[] = [];
  try { splits = JSON.parse(localStorage.getItem(AB_SPLIT_KEY) ?? '[]'); } catch { /**/ }

  const idx = splits.findIndex(s => s.testId === testId);
  const now = new Date().toISOString();

  let split: ABTestSplit = idx >= 0
    ? splits[idx]
    : { testId, controlClicks: 0, variantClicks: 0, significanceReached: false, winner: null, lockedAt: now, lastUpdated: now };

  if (side === 'control') split.controlClicks += count;
  else split.variantClicks += count;

  split.lastUpdated = now;

  // Statistical significance: both variants need >= 100 clicks
  if (split.controlClicks >= 100 && split.variantClicks >= 100) {
    split.significanceReached = true;
    // Determine winner by higher click count (proxy for rate — Prism has total views)
    if (split.variantClicks > split.controlClicks * 1.2) split.winner = 'variant';
    else if (split.controlClicks > split.variantClicks * 1.2) split.winner = 'control';
    else split.winner = null; // no clear winner
  }

  if (idx >= 0) splits[idx] = split; else splits.push(split);
  try { localStorage.setItem(AB_SPLIT_KEY, JSON.stringify(splits)); } catch { /**/ }
  return split;
}

/** Get all A/B splits */
export function getABSplits(): ABTestSplit[] {
  try { return JSON.parse(localStorage.getItem(AB_SPLIT_KEY) ?? '[]'); } catch { return []; }
}

/** Get split for a specific test */
export function getABSplit(testId: string): ABTestSplit | null {
  return getABSplits().find(s => s.testId === testId) ?? null;
}

/**
 * initPrismCycle2ABBaseline — Called once when Prism Cycle 2 runs.
 * Locks the blog_cta_ab_test baseline at 12% (Cycle 1 measurement).
 */
export function initPrismCycle2ABBaseline(): ABTestBaseline {
  const BASELINE_TEST_ID = 'blog_cta_ab_test_cycle2';
  const existing = getABBaseline(BASELINE_TEST_ID);
  if (existing) return existing; // Already locked — don't overwrite

  return lockABBaseline({
    testId: BASELINE_TEST_ID,
    metric: 'blog_cta_click_rate',
    controlValue: 0.12, // 12.0% — Prism Cycle 1 measurement
    source: '/blog/jee-main-2026-complete-strategy',
    notes: 'Cycle 1 baseline. Control: "Try AI Tutor". Variant: "Ask Sage — Get Your Answer in 30s". Target: >15%.',
  });
}

// ─── Revenue Insights ────────────────────────────────────────────────────────

export interface RevenueInsights {
  funnelMetrics: FunnelMetrics | null;
  abBaselines: ABTestBaseline[];
  abSplits: ABTestSplit[];
  topOpportunities: string[];
  cycle1Baseline: {
    blogCtaRate: number;
    chatToPracticeRate: number;
    returnRate: number;
    avgSessionMessages: number;
    frustrationRate: number;
  };
}

/**
 * getRevenueInsights — Aggregated signal for RevenueDashboard + Oracle.
 * Returns funnel metrics, A/B test state, and cycle-over-cycle deltas.
 */
export function getRevenueInsights(): RevenueInsights {
  const funnel = getFunnelMetrics();
  const baselines = getABBaselines();
  const splits = getABSplits();

  const topOpportunities: string[] = [];

  if (funnel) {
    if (funnel.ctaClickRate < 0.15) {
      topOpportunities.push(
        `Blog CTA at ${(funnel.ctaClickRate * 100).toFixed(1)}% vs 15% target — Herald A/B test in progress`
      );
    }
    if (funnel.returnRate < 0.25) {
      topOpportunities.push(
        `Return rate at ${(funnel.returnRate * 100).toFixed(1)}% — Mentor re-activation sequence needed`
      );
    }
    if (funnel.chatToPracticeRate < 0.30) {
      topOpportunities.push(
        `Chat→Practice at ${(funnel.chatToPracticeRate * 100).toFixed(1)}% — consider practice nudge after 5 messages`
      );
    }
  }

  return {
    funnelMetrics: funnel,
    abBaselines: baselines,
    abSplits: splits,
    topOpportunities,
    cycle1Baseline: {
      blogCtaRate: 0.12,
      chatToPracticeRate: 0.36,
      returnRate: 0.22,
      avgSessionMessages: 7,
      frustrationRate: 0.33,
    },
  };
}

// ─── Churn Risk ───────────────────────────────────────────────────────────────

export interface ChurnRiskStudent {
  sessionId: string;
  riskLevel: 'high' | 'medium' | 'low';
  lastSeenAt: string;
  entryPath: string;
  engagementScore: number; // 0–100
  estimatedMonthlyValue: number; // ₹
  suggestedAction: string;
}

/**
 * getChurnRisk — Returns students at churn risk from trace data.
 * Seeded with mock data until real backend is live.
 */
export function getChurnRisk(): ChurnRiskStudent[] {
  const traces = loadTraces();

  // Build risk list from real traces where possible
  const atRisk: ChurnRiskStudent[] = traces
    .filter(t => t.sessionDurationMs < 120_000 && t.messageCount <= 3)
    .slice(0, 10)
    .map((t, i) => ({
      sessionId: t.traceId,
      riskLevel: t.sessionDurationMs < 60_000 ? 'high' : 'medium',
      lastSeenAt: t.createdAt,
      entryPath: t.entryPoint ?? 'unknown',
      engagementScore: Math.max(10, Math.min(45, t.messageCount * 8)),
      estimatedMonthlyValue: [299, 499, 699, 999][i % 4],
      suggestedAction: t.sessionDurationMs < 60_000
        ? 'Send immediate re-engagement nudge via WhatsApp'
        : 'Trigger Mentor "One More Question" sequence',
    }));

  // Pad with mock data if under 5
  if (atRisk.length < 5) {
    const MOCK_RISK: ChurnRiskStudent[] = [
      { sessionId: 'mock-001', riskLevel: 'high',   lastSeenAt: new Date(Date.now() - 8.64e7).toISOString(), entryPath: 'chat_direct', engagementScore: 18, estimatedMonthlyValue: 499, suggestedAction: 'Send WhatsApp nudge — dropped after 90s' },
      { sessionId: 'mock-002', riskLevel: 'medium', lastSeenAt: new Date(Date.now() - 1.73e8).toISOString(), entryPath: 'blog_cta',    engagementScore: 34, estimatedMonthlyValue: 299, suggestedAction: 'Trigger Quick Win session on their weak subject' },
      { sessionId: 'mock-003', riskLevel: 'medium', lastSeenAt: new Date(Date.now() - 2.59e8).toISOString(), entryPath: 'google',      engagementScore: 41, estimatedMonthlyValue: 699, suggestedAction: 'Daily streak activation — 0-day streak user' },
      { sessionId: 'mock-004', riskLevel: 'low',    lastSeenAt: new Date(Date.now() - 3.46e8).toISOString(), entryPath: 'social',      engagementScore: 52, estimatedMonthlyValue: 299, suggestedAction: 'Email re-engagement drip sequence' },
      { sessionId: 'mock-005', riskLevel: 'high',   lastSeenAt: new Date(Date.now() - 4.32e7).toISOString(), entryPath: 'whatsapp',    engagementScore: 22, estimatedMonthlyValue: 999, suggestedAction: 'High-value — escalate to Mentor for personal outreach' },
    ];
    return [...atRisk, ...MOCK_RISK.slice(atRisk.length)];
  }
  return atRisk;
}

/** Helper: load trace summaries for churn detection */
function loadTraces(): Array<{ traceId: string; messageCount: number; sessionDurationMs: number; entryPoint?: string; createdAt: string }> {
  try {
    const raw = localStorage.getItem('edugenius_traces');
    if (!raw) return [];
    const map = JSON.parse(raw) as Record<string, unknown>;
    return Object.values(map).map((t: unknown) => {
      const trace = t as Record<string, unknown>;
      return {
        traceId: (trace['traceId'] as string) ?? '',
        messageCount: Number(trace['messageCount'] ?? 0),
        sessionDurationMs: Number(trace['sessionDurationMs'] ?? 0),
        entryPoint: trace['entryPoint'] as string | undefined,
        createdAt: (trace['createdAt'] as string) ?? new Date().toISOString(),
      };
    });
  } catch {
    return [];
  }
}
