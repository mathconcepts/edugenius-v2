/**
 * examOrchestrator.ts — Exam Lifecycle Orchestrator
 *
 * Triggered ONCE by CEO approval. Coordinates all 7 agents bidirectionally
 * with zero manual intervention thereafter.
 *
 * ─── FORWARD PIPELINE (CEO approval → live exam) ──────────────────────────
 *   CEO approves
 *     → Scout:  start monitoring keywords + competitors for this exam
 *     → Atlas:  begin content automation (daily batch generation)
 *     → Sage:   ingest generated content as knowledge context
 *     → Forge:  deploy exam infrastructure
 *     → Herald: launch SEO + marketing campaigns
 *     → Oracle: set up analytics funnels + KPI dashboards
 *     → Mentor: configure engagement rules (nudges, streaks, onboarding)
 *
 * ─── FEEDBACK LOOPS (bidirectional) ──────────────────────────────────────
 *   Oracle → Scout:  "Physics engagement -22% — research alternatives"
 *   Oracle → Atlas:  "These 5 topics need fresh content (stale + low mastery)"
 *   Oracle → Mentor: "18 students at churn risk this week"
 *   Sage → Atlas:    "Student couldn't understand EM waves analogy — generate visual variant"
 *   Mentor → Sage:   "Student X struggling for 3 days — trigger doubt clearing session"
 *   Scout → Atlas:   "New PYQ pattern found — add questions on transmission lines"
 *   Atlas → Sage:    "New content batch ready for accuracy verification"
 *   Sage → Forge+Herald: "Content verified — safe to deploy and promote"
 *   Forge → Oracle+Herald+Mentor: "Exam is live — start tracking and marketing"
 *   Herald → Oracle: "Campaign live — track CTR and conversions"
 */

import { enqueueSignal, drainPendingSignals, type AgentSignal } from './persistenceDB';

// ─── Agent IDs ────────────────────────────────────────────────────────────────

export type AgentId =
  | 'scout'
  | 'atlas'
  | 'sage'
  | 'forge'
  | 'herald'
  | 'oracle'
  | 'mentor';

export const ALL_AGENT_IDS: AgentId[] = [
  'scout', 'atlas', 'sage', 'forge', 'herald', 'oracle', 'mentor',
];

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExamLifecyclePhase =
  | 'approved'         // just approved, signals dispatched
  | 'content_building' // Atlas generating content
  | 'verifying'        // Sage verifying accuracy
  | 'deploying'        // Forge setting up infrastructure
  | 'marketing'        // Herald + Oracle running campaigns
  | 'live'             // all agents running, students enrolled
  | 'optimizing';      // steady state — feedback loops active

export interface AgentLifecycleStatus {
  agentId: AgentId;
  status: 'waiting' | 'active' | 'idle' | 'error';
  lastAction: string;
  lastActionAt: string;
  pendingSignals: number;
}

export interface SignalLogEntry {
  timestamp: string;
  from: string;
  to: string;
  type: string;
  summary: string;
}

export interface ExamLifecycleState {
  examId: string;
  examName: string;
  approvedAt: string;         // ISO timestamp
  approvedBy: 'ceo';
  phase: ExamLifecyclePhase;
  agentStatus: Record<AgentId, AgentLifecycleStatus>;
  contentStats: {
    totalGenerated: number;
    totalVerified: number;
    totalDeployed: number;
    lastGeneratedAt?: string;
  };
  marketingStats: {
    campaignsLive: number;
    studentsEnrolled: number;
    weeklyChurnRisks: number;
  };
  healthScore: number;        // 0–100, updated by Oracle weekly
  lastSignalAt: string;
  signalLog: SignalLogEntry[]; // last 50 events
}

export interface AgentInboxResult {
  agentId: AgentId;
  processed: number;
  actions: string[];        // human-readable log of what the agent did
  signalsEmitted: string[]; // signals this agent sent in response
}

// ─── Lifecycle signal types ───────────────────────────────────────────────────

const EXAM_LIFECYCLE_SIGNAL_TYPES = new Set([
  'EXAM_APPROVED',
  'CONTENT_READY',
  'CONTENT_VERIFIED',
  'EXAM_DEPLOYED',
  'MARKETING_LIVE',
  'STUDENT_ENROLLED',
  'PERFORMANCE_INSIGHT',
  'CONTENT_STALE',
  'CHURN_COHORT_ALERT',
  'EXAM_HEALTH_REPORT',
]);

// ─── Persistence (localStorage) ──────────────────────────────────────────────

const LIFECYCLE_KEY_PREFIX = 'edugenius_lifecycle_';

function persistLifecycle(state: ExamLifecycleState): void {
  try {
    localStorage.setItem(
      `${LIFECYCLE_KEY_PREFIX}${state.examId}`,
      JSON.stringify(state),
    );
  } catch {
    console.warn('[Orchestrator] Failed to persist lifecycle state:', state.examId);
  }
}

function loadLifecycle(examId: string): ExamLifecycleState | null {
  try {
    const raw = localStorage.getItem(`${LIFECYCLE_KEY_PREFIX}${examId}`);
    return raw ? (JSON.parse(raw) as ExamLifecycleState) : null;
  } catch {
    return null;
  }
}

function getAllLifecycleIds(): string[] {
  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(LIFECYCLE_KEY_PREFIX)) {
      ids.push(key.slice(LIFECYCLE_KEY_PREFIX.length));
    }
  }
  return ids;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDefaultAgentStatus(agentId: AgentId): AgentLifecycleStatus {
  return {
    agentId,
    status: 'waiting',
    lastAction: 'Awaiting EXAM_APPROVED signal',
    lastActionAt: new Date().toISOString(),
    pendingSignals: 1, // the EXAM_APPROVED we're about to send
  };
}

function appendSignalLog(
  state: ExamLifecycleState,
  entry: SignalLogEntry,
): ExamLifecycleState {
  const log = [...state.signalLog, entry].slice(-50); // keep last 50
  return {
    ...state,
    signalLog: log,
    lastSignalAt: entry.timestamp,
  };
}

function updateAgentStatus(
  state: ExamLifecycleState,
  agentId: AgentId,
  patch: Partial<AgentLifecycleStatus>,
): ExamLifecycleState {
  return {
    ...state,
    agentStatus: {
      ...state.agentStatus,
      [agentId]: { ...state.agentStatus[agentId], ...patch },
    },
  };
}

// ─── Core: dispatch approval signals ─────────────────────────────────────────

interface DispatchApprovalParams {
  examId: string;
  examName: string;
  topics: string[];
  targetAudience: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  isPilot: boolean;
  launchDate?: string;
}

async function dispatchApprovalSignals(
  params: DispatchApprovalParams,
): Promise<void> {
  const { examId, examName, topics, isPilot } = params;
  const now = new Date().toISOString();

  const agentJobs: { agentId: AgentId; job: Record<string, unknown> }[] = [
    {
      agentId: 'scout',
      job: { job: 'monitor_keywords', topics, examName },
    },
    {
      agentId: 'atlas',
      job: { job: 'begin_content_automation', topics, daily: true },
    },
    {
      agentId: 'sage',
      job: { job: 'ingest_exam_context', examId, topics },
    },
    {
      agentId: 'forge',
      job: { job: 'deploy_exam_infra', examId, isPilot },
    },
    {
      agentId: 'herald',
      job: { job: 'launch_seo_campaigns', examId, examName },
    },
    {
      agentId: 'oracle',
      job: {
        job: 'setup_analytics',
        examId,
        kpis: ['dau', 'ctr', 'conversions', 'mastery'],
      },
    },
    {
      agentId: 'mentor',
      job: { job: 'configure_engagement', examId, nudgeRules: true },
    },
  ];

  await Promise.all(
    agentJobs.map(({ agentId, job }) =>
      enqueueSignal({
        type: 'EXAM_APPROVED',
        sourceAgent: 'ceo',
        targetAgent: agentId,
        examId,
        payload: {
          examId,
          examName,
          topics,
          isPilot,
          approvedAt: now,
          ...job,
        },
      }),
    ),
  );
}

// ─── Core: process feedback loops ────────────────────────────────────────────

async function processFeedbackLoop(
  signal: AgentSignal,
  lifecycle: ExamLifecycleState,
): Promise<{ updatedLifecycle: ExamLifecycleState; actions: string[]; signalsEmitted: string[] }> {
  const actions: string[] = [];
  const signalsEmitted: string[] = [];
  let state = lifecycle;
  const examId = signal.examId ?? lifecycle.examId;
  const now = new Date().toISOString();

  switch (signal.type) {
    // ── Atlas → Sage: content batch ready, ask Sage to verify ───────────────
    case 'CONTENT_READY': {
      const { batchId, contentCount, topicIds } = signal.payload as {
        batchId: string;
        contentCount: number;
        topicIds: string[];
        formats: string[];
      };

      // Update Atlas stats
      state = updateAgentStatus(state, 'atlas', {
        status: 'active',
        lastAction: `Generated batch ${batchId} (${contentCount} pieces)`,
        lastActionAt: now,
      });
      state = {
        ...state,
        contentStats: {
          ...state.contentStats,
          totalGenerated: state.contentStats.totalGenerated + (contentCount || 0),
          lastGeneratedAt: now,
        },
      };

      // Emit CONTENT_VERIFIED request to Sage
      await enqueueSignal({
        type: 'CONTENT_READY',
        sourceAgent: 'atlas',
        targetAgent: 'sage',
        examId,
        payload: { batchId, contentCount, topicIds, requestedBy: 'orchestrator' },
      });

      actions.push(`Atlas: batch ${batchId} (${contentCount} pieces) queued for Sage verification`);
      signalsEmitted.push(`CONTENT_READY → sage (batchId:${batchId})`);

      state = appendSignalLog(state, {
        timestamp: now,
        from: 'Atlas',
        to: 'Sage',
        type: 'CONTENT_READY',
        summary: `Batch ${batchId} ready (${contentCount} pieces)`,
      });
      state = { ...state, phase: state.phase === 'approved' ? 'content_building' : state.phase };
      break;
    }

    // ── Sage → Forge+Herald: content verified, safe to deploy ───────────────
    case 'CONTENT_VERIFIED': {
      const { batchId, verifiedCount, avgAccuracy } = signal.payload as {
        batchId: string;
        verifiedCount: number;
        avgAccuracy: number;
        failedTopicIds: string[];
      };

      state = updateAgentStatus(state, 'sage', {
        status: 'active',
        lastAction: `Verified batch ${batchId} (${avgAccuracy}% accuracy)`,
        lastActionAt: now,
      });
      state = {
        ...state,
        contentStats: {
          ...state.contentStats,
          totalVerified: state.contentStats.totalVerified + (verifiedCount || 0),
        },
      };

      // Emit to Forge (deploy) and Herald (promote)
      await Promise.all([
        enqueueSignal({
          type: 'CONTENT_VERIFIED',
          sourceAgent: 'sage',
          targetAgent: 'forge',
          examId,
          payload: signal.payload,
        }),
        enqueueSignal({
          type: 'CONTENT_VERIFIED',
          sourceAgent: 'sage',
          targetAgent: 'herald',
          examId,
          payload: signal.payload,
        }),
      ]);

      actions.push(`Sage: verified batch ${batchId} — signalled Forge + Herald`);
      signalsEmitted.push(`CONTENT_VERIFIED → forge`, `CONTENT_VERIFIED → herald`);

      state = appendSignalLog(state, {
        timestamp: now,
        from: 'Sage',
        to: 'Forge + Herald',
        type: 'CONTENT_VERIFIED',
        summary: `Batch ${batchId} verified (${avgAccuracy?.toFixed(1)}% acc)`,
      });
      state = { ...state, phase: 'verifying' };
      break;
    }

    // ── Forge → Oracle+Herald+Mentor: exam deployed ──────────────────────────
    case 'EXAM_DEPLOYED': {
      const { deployedAt, url, contentCount } = signal.payload as {
        deployedAt: string;
        url: string;
        contentCount: number;
        regions: string[];
      };

      state = updateAgentStatus(state, 'forge', {
        status: 'idle',
        lastAction: `Deployed exam to CDN (${url})`,
        lastActionAt: deployedAt || now,
      });
      state = {
        ...state,
        contentStats: {
          ...state.contentStats,
          totalDeployed: state.contentStats.totalDeployed + (contentCount || 0),
        },
      };

      // Signal Oracle, Herald, Mentor
      await Promise.all([
        enqueueSignal({
          type: 'EXAM_DEPLOYED',
          sourceAgent: 'forge',
          targetAgent: 'oracle',
          examId,
          payload: signal.payload,
        }),
        enqueueSignal({
          type: 'EXAM_DEPLOYED',
          sourceAgent: 'forge',
          targetAgent: 'herald',
          examId,
          payload: signal.payload,
        }),
        enqueueSignal({
          type: 'EXAM_DEPLOYED',
          sourceAgent: 'forge',
          targetAgent: 'mentor',
          examId,
          payload: signal.payload,
        }),
      ]);

      actions.push(`Forge: exam deployed → Oracle, Herald, Mentor notified`);
      signalsEmitted.push(
        `EXAM_DEPLOYED → oracle`,
        `EXAM_DEPLOYED → herald`,
        `EXAM_DEPLOYED → mentor`,
      );

      state = appendSignalLog(state, {
        timestamp: now,
        from: 'Forge',
        to: 'Oracle · Herald · Mentor',
        type: 'EXAM_DEPLOYED',
        summary: `Exam live at ${url}`,
      });
      state = { ...state, phase: 'deploying' };
      break;
    }

    // ── Herald → Oracle: marketing campaigns live ────────────────────────────
    case 'MARKETING_LIVE': {
      const { campaignCount } = signal.payload as { campaignCount?: number };

      state = updateAgentStatus(state, 'herald', {
        status: 'active',
        lastAction: `${campaignCount ?? 1} campaigns live`,
        lastActionAt: now,
      });
      state = {
        ...state,
        marketingStats: {
          ...state.marketingStats,
          campaignsLive: state.marketingStats.campaignsLive + (campaignCount ?? 1),
        },
      };

      await enqueueSignal({
        type: 'MARKETING_LIVE',
        sourceAgent: 'herald',
        targetAgent: 'oracle',
        examId,
        payload: signal.payload,
      });

      actions.push(`Herald: ${campaignCount ?? 1} campaigns live — Oracle tracking`);
      signalsEmitted.push(`MARKETING_LIVE → oracle`);

      state = appendSignalLog(state, {
        timestamp: now,
        from: 'Herald',
        to: 'Oracle',
        type: 'MARKETING_LIVE',
        summary: `${campaignCount ?? 1} campaigns running`,
      });
      state = { ...state, phase: 'marketing' };
      break;
    }

    // ── User service → Mentor+Sage+Oracle: student enrolled ─────────────────
    case 'STUDENT_ENROLLED': {
      const { studentId, isFirstForExam } = signal.payload as {
        studentId: string;
        isFirstForExam: boolean;
      };

      state = {
        ...state,
        marketingStats: {
          ...state.marketingStats,
          studentsEnrolled: state.marketingStats.studentsEnrolled + 1,
        },
      };

      if (isFirstForExam) {
        // First student enrolled — transition to 'live'!
        state = { ...state, phase: 'live' };
        state = appendSignalLog(state, {
          timestamp: now,
          from: 'UserService',
          to: 'Mentor · Sage · Oracle',
          type: 'STUDENT_ENROLLED',
          summary: `First student enrolled (${studentId}) — exam is LIVE 🚀`,
        });
        actions.push(`🚀 First student enrolled! Lifecycle phase → LIVE`);
      } else {
        state = appendSignalLog(state, {
          timestamp: now,
          from: 'UserService',
          to: 'Mentor · Sage · Oracle',
          type: 'STUDENT_ENROLLED',
          summary: `Student ${studentId} enrolled`,
        });
        actions.push(`Student enrolled: ${studentId}`);
      }
      break;
    }

    // ── Oracle → Scout+Atlas+Mentor: performance feedback loop ──────────────
    case 'PERFORMANCE_INSIGHT': {
      const { staleTopicIds, churnRiskCount, lowEngagementTopics, weeklyDAU } =
        signal.payload as {
          staleTopicIds: string[];
          churnRiskCount: number;
          lowEngagementTopics: string[];
          highPerformingTopics: string[];
          weeklyDAU: number;
        };

      state = updateAgentStatus(state, 'oracle', {
        status: 'active',
        lastAction: `Weekly insight: DAU ${weeklyDAU}, ${churnRiskCount} churn risks`,
        lastActionAt: now,
      });

      const emits: Promise<void>[] = [];

      if (staleTopicIds?.length) {
        emits.push(
          enqueueSignal({
            type: 'CONTENT_STALE',
            sourceAgent: 'oracle',
            targetAgent: 'atlas',
            examId,
            payload: { topicIds: staleTopicIds, reason: 'low_engagement_7d' },
          }),
        );
        signalsEmitted.push(`CONTENT_STALE → atlas (${staleTopicIds.length} topics)`);
      }

      if (churnRiskCount > 0) {
        emits.push(
          enqueueSignal({
            type: 'CHURN_COHORT_ALERT',
            sourceAgent: 'oracle',
            targetAgent: 'mentor',
            examId,
            payload: { churnRiskCount, lowEngagementTopics },
          }),
        );
        signalsEmitted.push(`CHURN_COHORT_ALERT → mentor (${churnRiskCount} at risk)`);
      }

      // Also signal Scout for low-engagement topics
      if (lowEngagementTopics?.length) {
        emits.push(
          enqueueSignal({
            type: 'PERFORMANCE_INSIGHT',
            sourceAgent: 'oracle',
            targetAgent: 'scout',
            examId,
            payload: { lowEngagementTopics, weeklyDAU },
          }),
        );
        signalsEmitted.push(`PERFORMANCE_INSIGHT → scout`);
      }

      await Promise.all(emits);

      // Update health score (simple heuristic)
      const health = Math.max(
        0,
        Math.min(
          100,
          100 - churnRiskCount * 2 - (staleTopicIds?.length ?? 0) * 3,
        ),
      );
      state = { ...state, healthScore: health };
      state = { ...state, phase: state.phase === 'live' ? 'optimizing' : state.phase };

      actions.push(
        `Oracle: feedback loop — ${staleTopicIds?.length ?? 0} stale topics, ${churnRiskCount} churn risks, DAU ${weeklyDAU}`,
      );
      state = appendSignalLog(state, {
        timestamp: now,
        from: 'Oracle',
        to: 'Scout · Atlas · Mentor',
        type: 'PERFORMANCE_INSIGHT',
        summary: `DAU: ${weeklyDAU} · ${churnRiskCount} churn risks · ${staleTopicIds?.length ?? 0} stale topics`,
      });
      break;
    }

    // ── Oracle → Atlas: topic needs refresh ─────────────────────────────────
    case 'CONTENT_STALE': {
      const { topicIds } = signal.payload as { topicIds: string[] };

      await enqueueSignal({
        type: 'CONTENT_STALE',
        sourceAgent: signal.sourceAgent,
        targetAgent: 'atlas',
        examId,
        payload: { topicIds, triggeredAt: now },
      });

      actions.push(`Content stale: ${topicIds?.length ?? 0} topics flagged for Atlas refresh`);
      signalsEmitted.push(`CONTENT_STALE → atlas`);

      state = appendSignalLog(state, {
        timestamp: now,
        from: signal.sourceAgent,
        to: 'Atlas',
        type: 'CONTENT_STALE',
        summary: `${topicIds?.length ?? 0} topics need refresh`,
      });
      break;
    }

    // ── Scout → Atlas: trending keyword / PYQ pattern — generate content ──
    case 'TREND_SIGNAL': {
      const { topicId, trendType, keyword, urgency } = signal.payload as {
        topicId: string; trendType: string; keyword?: string; urgency: string;
      };
      state = updateAgentStatus(state, 'scout', {
        status: 'active',
        lastAction: `Trend detected: ${trendType} on ${topicId} (urgency: ${urgency})`,
        lastActionAt: now,
      });
      await enqueueSignal({
        type: 'TREND_SIGNAL',
        sourceAgent: 'scout',
        targetAgent: 'atlas',
        examId,
        payload: signal.payload,
      });
      actions.push(`Scout→Atlas: trend signal (${trendType}${keyword ? ` — "${keyword}"` : ''})`);
      signalsEmitted.push(`TREND_SIGNAL → atlas`);
      state = appendSignalLog(state, {
        timestamp: now, from: 'Scout', to: 'Atlas', type: 'TREND_SIGNAL',
        summary: `${trendType} trend: ${keyword ?? topicId} (${urgency} urgency)`,
      });
      break;
    }

    // ── Scout → Herald: keyword opportunity — create campaign ──────────────
    case 'KEYWORD_OPPORTUNITY': {
      const { keyword, recommendedAction } = signal.payload as {
        keyword: string; recommendedAction: string;
      };
      state = updateAgentStatus(state, 'scout', {
        status: 'active',
        lastAction: `Keyword opportunity: "${keyword}" → ${recommendedAction}`,
        lastActionAt: now,
      });
      await enqueueSignal({
        type: 'KEYWORD_OPPORTUNITY',
        sourceAgent: 'scout',
        targetAgent: 'herald',
        examId,
        payload: signal.payload,
      });
      actions.push(`Scout→Herald: keyword opportunity "${keyword}" (${recommendedAction})`);
      signalsEmitted.push(`KEYWORD_OPPORTUNITY → herald`);
      state = appendSignalLog(state, {
        timestamp: now, from: 'Scout', to: 'Herald', type: 'KEYWORD_OPPORTUNITY',
        summary: `"${keyword}" → ${recommendedAction}`,
      });
      break;
    }

    // ── Forge → Scout: deploy metrics — start SEO monitoring ───────────────
    case 'DEPLOY_METRICS': {
      const { url, topicsLive } = signal.payload as { url: string; topicsLive: string[] };
      state = updateAgentStatus(state, 'forge', {
        status: 'idle',
        lastAction: `Deploy metrics sent to Scout (${topicsLive?.length ?? 0} topics live)`,
        lastActionAt: now,
      });
      await enqueueSignal({
        type: 'DEPLOY_METRICS',
        sourceAgent: 'forge',
        targetAgent: 'scout',
        examId,
        payload: signal.payload,
      });
      actions.push(`Forge→Scout: monitor SEO for ${url} (${topicsLive?.length ?? 0} topics)`);
      signalsEmitted.push(`DEPLOY_METRICS → scout`);
      state = appendSignalLog(state, {
        timestamp: now, from: 'Forge', to: 'Scout', type: 'DEPLOY_METRICS',
        summary: `Monitor ${url} — ${topicsLive?.length ?? 0} topics`,
      });
      break;
    }

    // ── Mentor → Sage: student struggling — trigger doubt clearing ─────────
    case 'STUDENT_STRUGGLING': {
      const { studentId, topicId, dayStruggling } = signal.payload as {
        studentId: string; topicId: string; dayStruggling: number;
      };
      state = updateAgentStatus(state, 'mentor', {
        status: 'active',
        lastAction: `Escalated struggling student ${studentId} to Sage (${dayStruggling}d)`,
        lastActionAt: now,
      });
      await enqueueSignal({
        type: 'STUDENT_STRUGGLING',
        sourceAgent: 'mentor',
        targetAgent: 'sage',
        examId,
        payload: signal.payload,
      });
      actions.push(`Mentor→Sage: student ${studentId} struggling on ${topicId} for ${dayStruggling}d`);
      signalsEmitted.push(`STUDENT_STRUGGLING → sage`);
      state = appendSignalLog(state, {
        timestamp: now, from: 'Mentor', to: 'Sage', type: 'STUDENT_STRUGGLING',
        summary: `${studentId} on ${topicId} — ${dayStruggling} days`,
      });
      break;
    }

    // ── Mentor → Atlas: engagement gap — generate fresh content variant ─────
    case 'ENGAGEMENT_GAP': {
      const { topicId, engagementScore, suggestedFormat } = signal.payload as {
        topicId: string; engagementScore: number; suggestedFormat?: string;
      };
      state = updateAgentStatus(state, 'mentor', {
        status: 'active',
        lastAction: `Engagement gap on ${topicId} (score: ${engagementScore}) → Atlas`,
        lastActionAt: now,
      });
      await enqueueSignal({
        type: 'ENGAGEMENT_GAP',
        sourceAgent: 'mentor',
        targetAgent: 'atlas',
        examId,
        payload: signal.payload,
      });
      actions.push(`Mentor→Atlas: low engagement on ${topicId} (${engagementScore}/100) — generate ${suggestedFormat ?? 'variant'}`);
      signalsEmitted.push(`ENGAGEMENT_GAP → atlas`);
      state = appendSignalLog(state, {
        timestamp: now, from: 'Mentor', to: 'Atlas', type: 'ENGAGEMENT_GAP',
        summary: `${topicId}: score ${engagementScore} → ${suggestedFormat ?? 'new variant'}`,
      });
      break;
    }

    // ── Oracle → Herald: campaign performance feedback ──────────────────────
    case 'CAMPAIGN_PERFORMANCE': {
      const { campaignId, ctr, verdict } = signal.payload as {
        campaignId: string; ctr: number; verdict: string;
      };
      state = updateAgentStatus(state, 'oracle', {
        status: 'active',
        lastAction: `Campaign ${campaignId} CTR ${ctr}% → ${verdict} → Herald`,
        lastActionAt: now,
      });
      await enqueueSignal({
        type: 'CAMPAIGN_PERFORMANCE',
        sourceAgent: 'oracle',
        targetAgent: 'herald',
        examId,
        payload: signal.payload,
      });
      actions.push(`Oracle→Herald: campaign ${campaignId} CTR ${ctr}% — verdict: ${verdict}`);
      signalsEmitted.push(`CAMPAIGN_PERFORMANCE → herald`);
      state = appendSignalLog(state, {
        timestamp: now, from: 'Oracle', to: 'Herald', type: 'CAMPAIGN_PERFORMANCE',
        summary: `Campaign ${campaignId}: ${ctr}% CTR → ${verdict}`,
      });
      break;
    }

    // ── Herald → Scout: campaign underperformed — research why ─────────────
    case 'CAMPAIGN_RESULT': {
      const { campaignId, ctr, researchRequest } = signal.payload as {
        campaignId: string; ctr: number; researchRequest: string;
      };
      state = updateAgentStatus(state, 'herald', {
        status: 'active',
        lastAction: `Campaign ${campaignId} result (${ctr}%) → Scout for research`,
        lastActionAt: now,
      });
      await enqueueSignal({
        type: 'CAMPAIGN_RESULT',
        sourceAgent: 'herald',
        targetAgent: 'scout',
        examId,
        payload: signal.payload,
      });
      actions.push(`Herald→Scout: campaign ${campaignId} underperformed (${ctr}%) — research: ${researchRequest}`);
      signalsEmitted.push(`CAMPAIGN_RESULT → scout`);
      state = appendSignalLog(state, {
        timestamp: now, from: 'Herald', to: 'Scout', type: 'CAMPAIGN_RESULT',
        summary: `Campaign ${campaignId} CTR ${ctr}% — ${researchRequest}`,
      });
      break;
    }

    // ── Atlas → Oracle: content published — start tracking ─────────────────
    case 'CONTENT_PUBLISHED': {
      const { topicId, contentIds, formats } = signal.payload as {
        topicId: string; contentIds: string[]; formats: string[];
      };
      state = updateAgentStatus(state, 'atlas', {
        status: 'active',
        lastAction: `Published ${contentIds?.length ?? 0} pieces for ${topicId} → Oracle`,
        lastActionAt: now,
      });
      await enqueueSignal({
        type: 'CONTENT_PUBLISHED',
        sourceAgent: 'atlas',
        targetAgent: 'oracle',
        examId,
        payload: signal.payload,
      });
      actions.push(`Atlas→Oracle: ${contentIds?.length ?? 0} pieces published for ${topicId} (${formats?.join(', ')})`);
      signalsEmitted.push(`CONTENT_PUBLISHED → oracle`);
      state = appendSignalLog(state, {
        timestamp: now, from: 'Atlas', to: 'Oracle', type: 'CONTENT_PUBLISHED',
        summary: `${contentIds?.length ?? 0} pieces on ${topicId}`,
      });
      break;
    }

    default:
      // Pass-through: log but don't re-emit
      actions.push(`Signal ${signal.type} received and acknowledged`);
  }

  persistLifecycle(state);
  return { updatedLifecycle: state, actions, signalsEmitted };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * triggerExamApproval
 * Fired by the CEO (via ExamCreationWizard) once the wizard completes.
 * Dispatches EXAM_APPROVED to all 7 agents simultaneously.
 */
export async function triggerExamApproval(params: {
  examId: string;
  examName: string;
  examConfig: {
    topics: string[];
    targetAudience: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    isPilot: boolean;
    launchDate?: string;
  };
}): Promise<ExamLifecycleState> {
  const { examId, examName, examConfig } = params;
  const now = new Date().toISOString();

  // Check if lifecycle already exists (idempotent)
  const existing = loadLifecycle(examId);
  if (existing) {
    console.log('[Orchestrator] Lifecycle already exists for', examId, '— skipping re-approval');
    return existing;
  }

  // Build initial lifecycle state
  const agentStatus: Record<AgentId, AgentLifecycleStatus> = {} as Record<
    AgentId,
    AgentLifecycleStatus
  >;
  for (const id of ALL_AGENT_IDS) {
    agentStatus[id] = makeDefaultAgentStatus(id);
  }

  let state: ExamLifecycleState = {
    examId,
    examName,
    approvedAt: now,
    approvedBy: 'ceo',
    phase: 'approved',
    agentStatus,
    contentStats: {
      totalGenerated: 0,
      totalVerified: 0,
      totalDeployed: 0,
    },
    marketingStats: {
      campaignsLive: 0,
      studentsEnrolled: 0,
      weeklyChurnRisks: 0,
    },
    healthScore: 100,
    lastSignalAt: now,
    signalLog: [
      {
        timestamp: now,
        from: 'CEO',
        to: 'All Agents',
        type: 'EXAM_APPROVED',
        summary: `${examName} approved — all 7 agents activated`,
      },
    ],
  };

  // Dispatch EXAM_APPROVED to all agents
  await dispatchApprovalSignals({
    examId,
    examName,
    topics: examConfig.topics,
    targetAudience: examConfig.targetAudience,
    difficulty: examConfig.difficulty,
    isPilot: examConfig.isPilot,
    launchDate: examConfig.launchDate,
  });

  // Mark all agents as 'active' (they have a pending signal)
  for (const id of ALL_AGENT_IDS) {
    state = updateAgentStatus(state, id, {
      status: 'active',
      lastAction: 'EXAM_APPROVED received — starting job',
      lastActionAt: now,
    });
  }

  persistLifecycle(state);

  console.log(`[Orchestrator] ✅ Exam lifecycle started: ${examId} (${examName})`);
  return state;
}

/**
 * processAgentInbox
 * Called on each agent's heartbeat/tick.
 * Drains pending signals, runs feedback loops, updates lifecycle state.
 */
export async function processAgentInbox(agentId: AgentId): Promise<AgentInboxResult> {
  const result: AgentInboxResult = {
    agentId,
    processed: 0,
    actions: [],
    signalsEmitted: [],
  };

  // Drain all pending signals for this agent
  const signals = await drainPendingSignals(agentId);

  // Filter to exam lifecycle signals only
  const lifecycleSignals = signals.filter((s) =>
    EXAM_LIFECYCLE_SIGNAL_TYPES.has(s.type),
  );

  if (lifecycleSignals.length === 0) return result;

  for (const signal of lifecycleSignals) {
    const examId = signal.examId ?? (signal.payload?.examId as string);
    if (!examId) continue;

    let lifecycle = loadLifecycle(examId);
    if (!lifecycle) {
      // Create a minimal lifecycle state if not found (shouldn't normally happen)
      console.warn('[Orchestrator] No lifecycle found for examId:', examId, '— creating stub');
      continue;
    }

    const loopResult = await processFeedbackLoop(signal, lifecycle);
    lifecycle = loopResult.updatedLifecycle;

    result.processed++;
    result.actions.push(...loopResult.actions);
    result.signalsEmitted.push(...loopResult.signalsEmitted);
  }

  return result;
}

/**
 * getExamLifecycleState
 * Returns the current lifecycle state for a specific exam.
 */
export function getExamLifecycleState(examId: string): ExamLifecycleState | null {
  return loadLifecycle(examId);
}

/**
 * getAllLifecycles
 * Returns all active exam lifecycles (for CEO dashboard).
 */
export function getAllLifecycles(): ExamLifecycleState[] {
  return getAllLifecycleIds()
    .map(loadLifecycle)
    .filter((s): s is ExamLifecycleState => s !== null)
    .sort(
      (a, b) => new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime(),
    );
}
