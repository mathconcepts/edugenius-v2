/**
 * masterContentAgent.ts — Master Content Orchestrator Agent
 *
 * Supervisor pattern (VoltAgent-inspired): coordinates Atlas, Herald, Scout.
 * Pipeline: Scout → Strategy → Atlas → Herald → Oracle → feedback loop.
 *
 * All localStorage keys prefixed `edugenius_content_`.
 * All signals prefixed `content:` in localStorage keys.
 */

import { callLLM } from './llmService';
import { generateContent, generateAllChannels } from './contentGenerationHub';
import { selectStrategy } from './contentStrategyService';
import { getStaticTopicCompleteness } from './mandatoryContentService';
import type { SupportedExam, ContentChannel, ContentAudience, GeneratedContent } from './contentGenerationHub';

// ─── Campaign types ───────────────────────────────────────────────────────────

export type CampaignStatus =
  | 'idle'
  | 'scouting'
  | 'strategy'
  | 'generating'
  | 'distributing'
  | 'measuring'
  | 'complete'
  | 'failed';

export interface ContentCampaign {
  id: string;
  exam: SupportedExam;
  topic: string;
  targetDate: string;         // ISO date — exam date or campaign end date
  audience: ContentAudience;
  channels: ContentChannel[];
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;

  // Pipeline results
  scoutInsights?: ScoutInsights;
  strategy?: CampaignStrategy;
  generatedContent?: Map<ContentChannel, GeneratedContent>;
  distributionStatus?: Record<ContentChannel, 'pending' | 'sent' | 'failed'>;
  metrics?: CampaignMetrics;

  // Execution log
  pipelineLog: PipelineEntry[];

  // Scheduling
  scheduledAt?: string;
  batchId?: string;

  // Two-layer model: what kind of campaign was run
  campaignLayer?: 'mandatory_fill' | 'personalized_campaign' | 'mixed';
}

export interface ScoutInsights {
  trendingTopics: string[];
  redditHotPosts: string[];
  competitorActivity: string;
  audienceSignals: string[];
  recommendedAngles: string[];
  capturedAt: string;
}

export interface CampaignStrategy {
  primaryChannel: ContentChannel;
  supportingChannels: ContentChannel[];
  tone: string;
  publishSchedule: { channel: ContentChannel; scheduledFor: string }[];
  estimatedReach: string;
}

export interface CampaignMetrics {
  impressions: number;
  clicks: number;
  leads: number;
  engagementRate: number;
  topPerformingChannel: ContentChannel;
  measuredAt: string;
}

export interface PipelineEntry {
  step: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  detail?: string;
  startedAt?: string;
  completedAt?: string;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const CAMPAIGNS_KEY = 'edugenius_content_campaigns';
const ACTIVE_CAMPAIGN_KEY = 'edugenius_content_active_campaign';
const BATCH_QUEUE_KEY = 'edugenius_content_batch_queue';

// ─── Signal bus helpers ───────────────────────────────────────────────────────

function emitSignal(eventKey: string, payload: unknown): void {
  try {
    localStorage.setItem(`content:${eventKey}`, JSON.stringify({ payload, ts: Date.now() }));
    // Dispatch storage event for cross-tab sync
    window.dispatchEvent(new StorageEvent('storage', { key: `content:${eventKey}` }));
  } catch { /* ignore */ }
}

function readSignal<T>(eventKey: string): T | null {
  try {
    const raw = localStorage.getItem(`content:${eventKey}`);
    if (!raw) return null;
    const { payload } = JSON.parse(raw) as { payload: T; ts: number };
    return payload;
  } catch {
    return null;
  }
}

// ─── Campaign storage ─────────────────────────────────────────────────────────

function loadCampaigns(): ContentCampaign[] {
  try {
    const raw = localStorage.getItem(CAMPAIGNS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ContentCampaign[];
    // Restore Maps
    return arr.map(c => ({
      ...c,
      generatedContent: c.generatedContent
        ? new Map(Object.entries(c.generatedContent as unknown as Record<string, GeneratedContent>)) as Map<ContentChannel, GeneratedContent>
        : undefined,
    }));
  } catch {
    return [];
  }
}

function saveCampaigns(campaigns: ContentCampaign[]): void {
  try {
    const serializable = campaigns.map(c => ({
      ...c,
      generatedContent: c.generatedContent
        ? Object.fromEntries(c.generatedContent)
        : undefined,
    }));
    localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(serializable));
  } catch { /* ignore */ }
}

function upsertCampaign(campaign: ContentCampaign): void {
  const campaigns = loadCampaigns();
  const idx = campaigns.findIndex(c => c.id === campaign.id);
  if (idx >= 0) {
    campaigns[idx] = campaign;
  } else {
    campaigns.push(campaign);
  }
  saveCampaigns(campaigns);
}

// ─── Pipeline step helpers ────────────────────────────────────────────────────

function addLog(campaign: ContentCampaign, step: string, status: PipelineEntry['status'], detail?: string): ContentCampaign {
  const now = new Date().toISOString();
  const existing = campaign.pipelineLog.findIndex(l => l.step === step);
  const entry: PipelineEntry = {
    step, status, detail,
    startedAt: status === 'running' ? now : campaign.pipelineLog[existing]?.startedAt,
    completedAt: (status === 'done' || status === 'failed') ? now : undefined,
  };
  const newLog = [...campaign.pipelineLog];
  if (existing >= 0) {
    newLog[existing] = entry;
  } else {
    newLog.push(entry);
  }
  return { ...campaign, pipelineLog: newLog, updatedAt: now };
}

// ─── Step 1: Scout – Trend/Audience Intelligence ──────────────────────────────

async function runScoutStep(campaign: ContentCampaign): Promise<ContentCampaign> {
  let c = addLog(campaign, 'scout', 'running', 'Gathering trends and audience signals');
  c = { ...c, status: 'scouting' };
  upsertCampaign(c);
  emitSignal('scout:request', { exam: c.exam, topic: c.topic, campaignId: c.id });

  // Check if Scout has pre-loaded signals
  const scoutData = readSignal<ScoutInsights>('scout:insights');

  try {
    const prompt = `You are Scout, EduGenius market intelligence agent.
Gather insights for a content campaign:
Exam: ${c.exam} | Topic: ${c.topic} | Target Date: ${c.targetDate}

Analyse the competitive landscape and audience sentiment. Return JSON:
{
  "trendingTopics": ["topic1", "topic2", "topic3"],
  "redditHotPosts": ["post summary 1", "post summary 2"],
  "competitorActivity": "brief summary of what competitors are posting",
  "audienceSignals": ["signal1", "signal2", "signal3"],
  "recommendedAngles": ["angle1", "angle2", "angle3"]
}`;

    const response = await callLLM({ agent: 'scout', message: prompt, intent: 'market_research' });
    const raw = response?.text ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    const insights: ScoutInsights = match
      ? { ...JSON.parse(match[0]), capturedAt: new Date().toISOString() }
      : (scoutData ?? {
          trendingTopics: [c.topic],
          redditHotPosts: [`Students asking about ${c.topic}`],
          competitorActivity: 'No data available',
          audienceSignals: [`${c.exam} students need help with ${c.topic}`],
          recommendedAngles: ['how_to', 'myth_bust', 'tip'],
          capturedAt: new Date().toISOString(),
        });

    emitSignal('scout:insights', insights);
    c = addLog({ ...c, scoutInsights: insights }, 'scout', 'done', `Found ${insights.trendingTopics.length} trending topics`);
    return c;
  } catch (err) {
    return addLog(c, 'scout', 'failed', String(err));
  }
}

// ─── Step 2: Strategy selection ───────────────────────────────────────────────

async function runStrategyStep(campaign: ContentCampaign): Promise<ContentCampaign> {
  let c = addLog(campaign, 'strategy', 'running');
  c = { ...c, status: 'strategy' };
  upsertCampaign(c);

  const daysToTarget = Math.max(0, Math.ceil(
    (new Date(c.targetDate).getTime() - Date.now()) / 86400000
  ));

  // Use strategy selector
  const strategyResult = selectStrategy(c.exam, c.audience, c.channels[0] ?? 'blog', daysToTarget);

  const strategy: CampaignStrategy = {
    primaryChannel: c.channels[0] ?? 'blog',
    supportingChannels: c.channels.slice(1),
    tone: strategyResult.tone,
    publishSchedule: c.channels.map((channel, i) => ({
      channel,
      scheduledFor: new Date(Date.now() + i * 86400000).toISOString(),
    })),
    estimatedReach: daysToTarget < 7 ? 'High urgency' : daysToTarget < 30 ? 'Medium-term' : 'Long-term',
  };

  emitSignal('strategy:selected', { campaignId: c.id, strategy });
  c = addLog({ ...c, strategy }, 'strategy', 'done', `Primary: ${strategy.primaryChannel}, ${strategy.supportingChannels.length} supporting channels`);
  return c;
}

// ─── Step 3: Atlas – Content generation ───────────────────────────────────────

async function runAtlasStep(campaign: ContentCampaign): Promise<ContentCampaign> {
  let c = addLog(campaign, 'generate', 'running', `Generating content for ${campaign.channels.length} channels`);
  c = { ...c, status: 'generating' };
  upsertCampaign(c);
  emitSignal('atlas:generate_request', { campaignId: c.id, exam: c.exam, topic: c.topic });

  try {
    // ── STEP 1: Mandatory Audit ────────────────────────────────────────────
    // Derive examId and topicId from exam name and topic
    const examId = c.exam.toUpperCase().replace(/\s+/g, '_');
    const topicId = c.topic.toLowerCase().replace(/\s+/g, '_');
    const mandatorySpec = getStaticTopicCompleteness(examId, topicId);
    const mandatoryCompleteness = mandatorySpec.coverage;

    let campaignLayer: ContentCampaign['campaignLayer'] = 'personalized_campaign';

    // ── STEP 2: Generate mandatory atoms first if incomplete ──────────────
    if (mandatoryCompleteness < 100) {
      campaignLayer = mandatoryCompleteness === 0 ? 'mandatory_fill' : 'mixed';
      addLog(c, 'generate', 'running',
        `Mandatory baseline at ${mandatoryCompleteness}% — filling gaps before campaign content`);

      // Queue mandatory generation for each channel with mandatory layer tag
      await generateAllChannels(c.exam, c.topic, c.audience, c.channels.slice(0, 1), 'mandatory');

      emitSignal('atlas:mandatory_fill', {
        campaignId: c.id,
        examId,
        topicId,
        mandatoryCompleteness,
        missingAtoms: mandatorySpec.missing,
      });
    }

    // ── STEP 3: Generate campaign/personalized content ────────────────────
    const contentMap = await generateAllChannels(c.exam, c.topic, c.audience, c.channels, 'personalized');
    emitSignal('atlas:content_ready', { campaignId: c.id, channelCount: contentMap.size });

    // Feed to RAG indexer
    emitSignal('rag:index_request', {
      campaignId: c.id,
      exam: c.exam,
      topic: c.topic,
      contentCount: contentMap.size,
    });

    c = addLog(
      { ...c, generatedContent: contentMap, campaignLayer },
      'generate', 'done',
      `Generated ${contentMap.size} content pieces (layer: ${campaignLayer})`,
    );
    return c;
  } catch (err) {
    return addLog(c, 'generate', 'failed', String(err));
  }
}

// ─── Step 4: Herald – Distribution ───────────────────────────────────────────

async function runHeraldStep(campaign: ContentCampaign): Promise<ContentCampaign> {
  let c = addLog(campaign, 'distribute', 'running');
  c = { ...c, status: 'distributing' };
  upsertCampaign(c);

  const distributionStatus: Record<string, 'pending' | 'sent' | 'failed'> = {};
  for (const channel of c.channels) {
    distributionStatus[channel] = 'pending';
  }

  emitSignal('herald:distribute_request', {
    campaignId: c.id,
    channels: c.channels,
    strategy: c.strategy,
  });

  // Mark as sent (Herald picks up via signal)
  for (const channel of c.channels) {
    distributionStatus[channel] = 'sent';
  }

  c = addLog(
    { ...c, distributionStatus: distributionStatus as ContentCampaign['distributionStatus'] },
    'distribute', 'done',
    `Queued ${c.channels.length} channels for Herald`,
  );
  return c;
}

// ─── Step 5: Oracle – Measure ─────────────────────────────────────────────────

async function runOracleStep(campaign: ContentCampaign): Promise<ContentCampaign> {
  let c = addLog(campaign, 'measure', 'running');
  upsertCampaign(c);

  // Emit signal to Oracle for performance tracking setup
  emitSignal('oracle:track_campaign', {
    campaignId: c.id,
    channels: c.channels,
    exam: c.exam,
    topic: c.topic,
    distributionStatus: c.distributionStatus,
  });

  // Mock initial metrics (Oracle populates real data later)
  const metrics: CampaignMetrics = {
    impressions: 0,
    clicks: 0,
    leads: 0,
    engagementRate: 0,
    topPerformingChannel: c.channels[0] ?? 'blog',
    measuredAt: new Date().toISOString(),
  };

  c = addLog({ ...c, metrics, status: 'complete' }, 'measure', 'done', 'Oracle tracking configured');
  return c;
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export async function orchestrateContentCampaign(
  exam: SupportedExam,
  topic: string,
  targetDate: string,
  options: {
    audience?: ContentAudience;
    channels?: ContentChannel[];
  } = {},
): Promise<ContentCampaign> {
  const id = `campaign_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  let campaign: ContentCampaign = {
    id,
    exam,
    topic,
    targetDate,
    audience: options.audience ?? 'student_intermediate',
    channels: options.channels ?? ['blog', 'x_twitter', 'instagram', 'email'],
    status: 'idle',
    createdAt: now,
    updatedAt: now,
    pipelineLog: [],
  };

  upsertCampaign(campaign);
  localStorage.setItem(ACTIVE_CAMPAIGN_KEY, id);
  emitSignal('campaign:started', { campaignId: id, exam, topic });

  try {
    campaign = await runScoutStep(campaign);
    upsertCampaign(campaign);

    campaign = await runStrategyStep(campaign);
    upsertCampaign(campaign);

    campaign = await runAtlasStep(campaign);
    upsertCampaign(campaign);

    campaign = await runHeraldStep(campaign);
    upsertCampaign(campaign);

    campaign = await runOracleStep(campaign);
    upsertCampaign(campaign);

    emitSignal('campaign:complete', { campaignId: id, status: 'complete' });
    return campaign;

  } catch (err) {
    campaign = {
      ...campaign,
      status: 'failed',
      updatedAt: new Date().toISOString(),
    };
    campaign = addLog(campaign, 'orchestrator', 'failed', String(err));
    upsertCampaign(campaign);
    emitSignal('campaign:failed', { campaignId: id, error: String(err) });
    return campaign;
  }
}

// ─── Schedule campaign ────────────────────────────────────────────────────────

export function scheduleCampaign(params: {
  exam: SupportedExam;
  topic: string;
  targetDate: string;
  scheduledAt: string;
  audience?: ContentAudience;
  channels?: ContentChannel[];
}): string {
  const batchId = `batch_${Date.now()}`;
  try {
    const queue = JSON.parse(localStorage.getItem(BATCH_QUEUE_KEY) ?? '[]') as typeof params[];
    queue.push({ ...params });
    localStorage.setItem(BATCH_QUEUE_KEY, JSON.stringify(queue));
    emitSignal('campaign:scheduled', { batchId, ...params });
  } catch { /* ignore */ }
  return batchId;
}

// ─── Get campaign status ──────────────────────────────────────────────────────

export function getCampaignStatus(campaignId?: string): ContentCampaign | null {
  const id = campaignId ?? localStorage.getItem(ACTIVE_CAMPAIGN_KEY);
  if (!id) return null;
  return loadCampaigns().find(c => c.id === id) ?? null;
}

export function getAllCampaigns(): ContentCampaign[] {
  return loadCampaigns().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getBatchQueue(): unknown[] {
  try {
    return JSON.parse(localStorage.getItem(BATCH_QUEUE_KEY) ?? '[]') as unknown[];
  } catch {
    return [];
  }
}

// ─── Social Intel Integration ─────────────────────────────────────────────────

/**
 * Trigger a social intel scan as part of the content campaign pipeline.
 * IntentScout → AnswerCrafter → ApprovalGate → PostScheduler.
 * Called optionally at the start of orchestrateContentCampaign.
 */
export async function runSocialIntelPass(): Promise<void> {
  try {
    // Dynamic import to avoid circular deps
    const { runSocialIntelCycle } = await import('./socialAgentOrchestrator');
    await runSocialIntelCycle();
    emitSignal('social:intel_cycle_complete', { ts: Date.now() });
  } catch {
    // Non-fatal — social intel is additive, not blocking
  }
}

// ─── Quick generate (no full pipeline) ───────────────────────────────────────

export async function quickGenerate(
  exam: SupportedExam,
  topic: string,
  channel: ContentChannel,
  audience: ContentAudience,
): Promise<GeneratedContent> {
  emitSignal('atlas:quick_generate', { exam, topic, channel, audience });
  return generateContent({ exam, topic, channel, audience });
}
