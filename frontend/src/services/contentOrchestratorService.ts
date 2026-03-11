/**
 * contentOrchestratorService.ts — Master Content Orchestrator
 *
 * Receives a ContentOrchestrationRequest, selects tier + strategy + format,
 * routes to the right generator, delivers to the right surface,
 * and emits feedback signals to connected agents.
 *
 * Connected agents:
 *   → Scout    (topic priority from trend data)
 *   → Atlas    (content atom generation)
 *   → Sage     (in-app delivery + chat)
 *   → Oracle   (analytics + performance)
 *   → Mentor   (engagement + churn signals)
 *   → Herald   (blog/marketing delivery)
 *   → Forge    (deployment of rich media)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { selectTier } from './contentTierService';
import type {
  ContentTier,
  DeliverySurface,
  MediaFormat,
  TierSelectionInput,
} from './contentTierService';
import { getEffectiveStrategy } from './contentStrategyService';
import type { ContentStrategyId } from './contentStrategyService';
import type { ContentAtom, ContentAtomType } from './contentFramework';
import { callLLM } from './llmService';

// ─── Re-export types for consumers ───────────────────────────────────────────

export type { ContentTier, DeliverySurface, MediaFormat };

// ─── Rich Media Types ─────────────────────────────────────────────────────────

export interface VideoScript {
  title: string;
  hook: string; // first 30 seconds — must grab attention
  chapters: { title: string; duration: string; content: string }[];
  callToAction: string;
  totalDuration: string; // e.g. "8-10 minutes"
  tags: string[];
  description: string; // YouTube description
}

export interface ThumbnailBrief {
  headline: string; // bold text on thumbnail
  subtext?: string;
  visualConcept: string; // describe what should be shown
  colorScheme: string;   // e.g. "dark blue + orange accent"
  imagePrompt: string;   // full DALL-E prompt
}

export interface InfographicSpec {
  title: string;
  format: 'vertical' | 'horizontal' | 'square'; // for platform
  sections: { heading: string; content: string }[];
  imagePrompt: string;
}

// ─── Agent Signal ─────────────────────────────────────────────────────────────

export interface AgentSignal {
  agentId: string;
  signalType: string;
  data: Record<string, unknown>;
  storageKey: string;
}

// ─── Core Request / Result ────────────────────────────────────────────────────

export interface ContentOrchestrationRequest {
  // WHAT
  topic: string;
  examType: string;
  atomType?: ContentAtomType; // optional, orchestrator can decide

  // WHO
  userId?: string;
  userPlan?: 'free' | 'basic' | 'pro' | 'enterprise';
  persona?: 'student' | 'teacher' | 'parent' | 'ceo';

  // WHERE
  surface: DeliverySurface;

  // HOW
  strategyOverride?: ContentStrategyId;
  tierOverride?: ContentTier;
  mediaFormats?: MediaFormat[]; // for T4: which formats to generate

  // WHY
  triggeredBy:
    | 'student_request'
    | 'atlas_task'
    | 'scout_signal'
    | 'regen_queue'
    | 'scheduled'
    | 'ceo_manual';
  priority: 'urgent' | 'normal' | 'background';
}

export interface ContentOrchestrationResult {
  requestId: string;
  tier: ContentTier;
  strategy: ContentStrategyId;
  surface: DeliverySurface;

  // Outputs by format
  textContent?: string; // always present when status != 'failed'
  atom?: ContentAtom;   // structured atom for in_app surface
  imagePrompt?: string; // for T4: DALL-E/Midjourney prompt
  videoScript?: VideoScript; // for T4 + youtube surface
  thumbnailBrief?: ThumbnailBrief; // for T4 + youtube/blog
  infographicSpec?: InfographicSpec; // for T4 + whatsapp/blog

  // Meta
  generationMs: number;
  agentSignals: AgentSignal[]; // what was emitted to which agents
  cost: 'free' | 'low' | 'medium' | 'high';
  status: 'success' | 'partial' | 'fallback' | 'failed';
  fallbackReason?: string;
}

// ─── Batch ────────────────────────────────────────────────────────────────────

export interface BatchOrchestrationRequest {
  requests: ContentOrchestrationRequest[];
  maxParallel: number; // 1–5
  onProgress?: (completed: number, total: number) => void;
}

// ─── Orchestrator Config ──────────────────────────────────────────────────────

export interface OrchestratorConfig {
  defaultTierOverride?: ContentTier;  // CEO sets this to force a tier
  autoEscalate: boolean;              // true = auto-upgrade tier if quality low
  maxCostLevel: 'free' | 'low' | 'medium' | 'high'; // budget guard
  enabledSurfaces: DeliverySurface[];
  richMediaSurfaces: DeliverySurface[]; // which surfaces get T4
  agentSignalsEnabled: Record<string, boolean>; // per-agent toggle
}

const ORCHESTRATOR_CONFIG_KEY = 'edugenius_orchestrator_config';

const DEFAULT_CONFIG: OrchestratorConfig = {
  autoEscalate: true,
  maxCostLevel: 'medium',
  enabledSurfaces: ['in_app', 'blog_web', 'whatsapp', 'telegram', 'email', 'pdf'],
  richMediaSurfaces: ['blog_web', 'youtube'],
  agentSignalsEnabled: {
    scout: true,
    atlas: true,
    sage: true,
    oracle: true,
    mentor: true,
    herald: true,
    forge: true,
  },
};

export function getOrchestratorConfig(): OrchestratorConfig {
  try {
    const raw = localStorage.getItem(ORCHESTRATOR_CONFIG_KEY);
    if (raw) {
      return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<OrchestratorConfig>) };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_CONFIG };
}

export function updateOrchestratorConfig(patch: Partial<OrchestratorConfig>): void {
  try {
    const current = getOrchestratorConfig();
    const updated = { ...current, ...patch };
    localStorage.setItem(ORCHESTRATOR_CONFIG_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

// ─── Orchestration Log ────────────────────────────────────────────────────────

const LOG_KEY = 'edugenius_orchestration_log';

interface OrchestrationLogEntry {
  requestId: string;
  topic: string;
  tier: ContentTier;
  surface: DeliverySurface;
  status: string;
  generationMs: number;
  formats: string[];
  timestamp: string;
}

function appendToLog(result: ContentOrchestrationResult, topic: string): void {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const log: OrchestrationLogEntry[] = raw ? (JSON.parse(raw) as OrchestrationLogEntry[]) : [];
    const formats: string[] = [];
    if (result.textContent) formats.push('text');
    if (result.imagePrompt) formats.push('image_prompt');
    if (result.videoScript) formats.push('video_script');
    if (result.thumbnailBrief) formats.push('thumbnail');
    if (result.infographicSpec) formats.push('infographic');
    log.unshift({
      requestId: result.requestId,
      topic,
      tier: result.tier,
      surface: result.surface,
      status: result.status,
      generationMs: result.generationMs,
      formats,
      timestamp: new Date().toISOString(),
    });
    // Keep last 20
    const trimmed = log.slice(0, 20);
    localStorage.setItem(LOG_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

export function getOrchestrationLog(): OrchestrationLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as OrchestrationLogEntry[]) : [];
  } catch {
    return [];
  }
}

// ─── Agent Signal Emission ────────────────────────────────────────────────────

/**
 * Write a value to localStorage, silently ignoring quota/security errors.
 * Centralises the repetitive try/catch pattern used across all signal emitters.
 */
function safeLocalSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* ignore quota/security errors */ }
}

/**
 * Build and persist agent signal entries to localStorage, returning the full signal list.
 * Each agent gets a dedicated storage key so its signal can be read independently.
 */
function emitAgentSignals(
  req: ContentOrchestrationRequest,
  tier: ContentTier,
  textContent: string,
): AgentSignal[] {
  const config = getOrchestratorConfig();
  const signals: AgentSignal[] = [];
  const now = new Date().toISOString();

  // Scout signal — topic generated
  if (config.agentSignalsEnabled.scout !== false) {
    const key = 'orchestrator:generated_topics';
    try {
      const existing = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown[];
      existing.unshift({ topic: req.topic, examType: req.examType, tier, at: now });
      safeLocalSet(key, existing.slice(0, 50));
    } catch { /* ignore */ }
    signals.push({
      agentId: 'scout',
      signalType: 'topic_generated',
      data: { topic: req.topic, examType: req.examType, tier },
      storageKey: key,
    });
  }

  // Atlas signal — content atom ready
  if (config.agentSignalsEnabled.atlas !== false && req.surface === 'in_app') {
    const key = 'orchestrator:atlas_signal';
    safeLocalSet(key, { topic: req.topic, examType: req.examType, tier, at: now });
    signals.push({
      agentId: 'atlas',
      signalType: 'content_ready',
      data: { topic: req.topic, tier, triggeredBy: req.triggeredBy },
      storageKey: key,
    });
  }

  // Oracle signal — generation event for analytics
  if (config.agentSignalsEnabled.oracle !== false) {
    const key = 'orchestrator:oracle_signal';
    safeLocalSet(key, {
      topic: req.topic,
      examType: req.examType,
      surface: req.surface,
      tier,
      wordCount: textContent.split(/\s+/).length,
      at: now,
    });
    signals.push({
      agentId: 'oracle',
      signalType: 'generation_event',
      data: { topic: req.topic, surface: req.surface, tier },
      storageKey: key,
    });
  }

  // Herald signal — blog/marketing content ready
  if (
    config.agentSignalsEnabled.herald !== false &&
    (req.surface === 'blog_web' || req.surface === 'email')
  ) {
    const key = 'orchestrator:herald_signal';
    safeLocalSet(key, { topic: req.topic, examType: req.examType, surface: req.surface, at: now });
    signals.push({
      agentId: 'herald',
      signalType: 'marketing_content_ready',
      data: { topic: req.topic, surface: req.surface },
      storageKey: key,
    });
  }

  // Mentor signal — for student-triggered content
  if (
    config.agentSignalsEnabled.mentor !== false &&
    (req.triggeredBy === 'student_request' || req.persona === 'student')
  ) {
    const key = 'orchestrator:mentor_signal';
    safeLocalSet(key, { userId: req.userId, topic: req.topic, examType: req.examType, at: now });
    signals.push({
      agentId: 'mentor',
      signalType: 'student_engagement',
      data: { userId: req.userId, topic: req.topic },
      storageKey: key,
    });
  }

  // Forge signal — rich media ready for deployment
  if (config.agentSignalsEnabled.forge !== false && tier === 'T4_richmedia') {
    const key = 'orchestrator:forge_signal';
    safeLocalSet(key, { topic: req.topic, surface: req.surface, at: now });
    signals.push({
      agentId: 'forge',
      signalType: 'rich_media_ready',
      data: { topic: req.topic, surface: req.surface },
      storageKey: key,
    });
  }

  return signals;
}

// ─── Content Atom Builder (from plain text) ───────────────────────────────────

function buildAtomFromText(
  topic: string,
  examType: string,
  text: string,
  tier: ContentTier,
): ContentAtom {
  const now = new Date();
  return {
    id: `orch-atom-${Date.now()}`,
    type: 'lesson_block',
    title: topic,
    body: text.slice(0, 600),
    bodyMarkdown: text,
    examId: examType.toLowerCase(),
    topic,
    difficulty: 'medium',
    syllabusPriority: 'high',
    quality: {
      accuracy: tier === 'T3_wolfram' || tier === 'T4_richmedia' ? 0.95 : 0.85,
      clarity: 0.85,
      examRelevance: 0.85,
      engagementScore: 0,
      wolframVerified: tier === 'T3_wolfram' || tier === 'T4_richmedia',
      reviewedByHuman: false,
    },
    generatedBy: 'atlas',
    generatedAt: now,
    sourceType:
      tier === 'T0_static' ? 'pyq'
      : tier === 'T1_rag' ? 'document'
      : tier === 'T3_wolfram' || tier === 'T4_richmedia' ? 'wolfram'
      : 'llm',
    version: 1,
    timesServed: 0,
    avgRating: 0,
    completionRate: 0,
  };
}

// ─── Rich Media Generation ────────────────────────────────────────────────────

async function generateRichMedia(
  topic: string,
  examType: string,
  baseText: string,
  formats: MediaFormat[],
): Promise<{
  imagePrompt?: string;
  videoScript?: VideoScript;
  thumbnailBrief?: ThumbnailBrief;
  infographicSpec?: InfographicSpec;
}> {
  const result: {
    imagePrompt?: string;
    videoScript?: VideoScript;
    thumbnailBrief?: ThumbnailBrief;
    infographicSpec?: InfographicSpec;
  } = {};

  // Image Prompt
  if (formats.includes('image_prompt')) {
    try {
      const resp = await callLLM({
        agent: 'atlas',
        message: `You are a visual designer specialising in educational content.
Create a detailed DALL-E image generation prompt for: "${topic}" (${examType} exam context).
The image should be suitable for an educational blog post or YouTube thumbnail.
The prompt should describe: style, composition, color palette, key visual elements.
Keep it under 200 words. Return ONLY the prompt, no explanation.

Base content: ${baseText.slice(0, 400)}`,
      });
      if (resp?.text) result.imagePrompt = resp.text.trim();
    } catch {
      // gracefully skip
    }
  }

  // Video Script
  if (formats.includes('video_script')) {
    try {
      const resp = await callLLM({
        agent: 'atlas',
        message: `You are a YouTube educator who creates viral educational content for ${examType} students.
Write a video script for an 8–10 minute video on: "${topic}".
Return ONLY valid JSON in this exact format:
{
  "title": "video title",
  "hook": "first 30 seconds script to grab attention",
  "chapters": [
    {"title": "chapter name", "duration": "2 min", "content": "chapter content summary"},
    {"title": "chapter name", "duration": "3 min", "content": "content"},
    {"title": "chapter name", "duration": "2 min", "content": "content"}
  ],
  "callToAction": "what to say at end",
  "totalDuration": "8-10 minutes",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "description": "YouTube description (150 words)"
}

Base content: ${baseText.slice(0, 500)}`,
      });
      if (resp?.text) {
        try {
          const cleaned = resp.text.replace(/```json\n?|```\n?/g, '').trim();
          result.videoScript = JSON.parse(cleaned) as VideoScript;
        } catch {
          // Parse failed — build a minimal script
          result.videoScript = {
            title: `${topic} — Complete Guide for ${examType}`,
            hook: `Did you know that ${topic} appears in almost every ${examType} paper? In the next 8 minutes, you'll master it.`,
            chapters: [
              { title: 'Introduction & Core Concept', duration: '2 min', content: baseText.slice(0, 300) },
              { title: 'Key Formulas & Theory', duration: '3 min', content: 'Formula walkthrough' },
              { title: 'Solved Examples', duration: '2 min', content: 'PYQ-style worked examples' },
              { title: 'Exam Tips & Common Mistakes', duration: '1 min', content: 'What to avoid in exams' },
            ],
            callToAction: `Like and subscribe for daily ${examType} content. Drop your doubts in the comments!`,
            totalDuration: '8-10 minutes',
            tags: [topic, examType, 'education', 'exam prep', 'study'],
            description: `Master ${topic} for ${examType} in this comprehensive guide. Includes formulas, solved examples, and exam tips.`,
          };
        }
      }
    } catch {
      // gracefully skip
    }
  }

  // Thumbnail Brief
  if (formats.includes('image_prompt') || formats.includes('video_script')) {
    try {
      const resp = await callLLM({
        agent: 'atlas',
        message: `Create a YouTube thumbnail design brief for a video about "${topic}" (${examType}).
Return ONLY valid JSON:
{
  "headline": "SHORT bold headline (max 5 words)",
  "subtext": "optional subtitle",
  "visualConcept": "describe what should be visually shown in the thumbnail",
  "colorScheme": "dominant colors and accents",
  "imagePrompt": "full DALL-E prompt for generating the thumbnail background"
}`,
      });
      if (resp?.text) {
        try {
          const cleaned = resp.text.replace(/```json\n?|```\n?/g, '').trim();
          result.thumbnailBrief = JSON.parse(cleaned) as ThumbnailBrief;
        } catch {
          result.thumbnailBrief = {
            headline: topic.slice(0, 30),
            subtext: `${examType} Master Guide`,
            visualConcept: `Educational infographic showing key concepts of ${topic}`,
            colorScheme: 'Dark blue background with orange accent text',
            imagePrompt: result.imagePrompt ?? `Educational thumbnail for ${topic} ${examType} exam preparation, dark blue background, bold orange text`,
          };
        }
      }
    } catch {
      // gracefully skip
    }
  }

  // Infographic Spec
  if (formats.includes('infographic_spec')) {
    try {
      const resp = await callLLM({
        agent: 'atlas',
        message: `Design an infographic layout for "${topic}" (${examType} exam context).
Return ONLY valid JSON:
{
  "title": "infographic title",
  "format": "vertical",
  "sections": [
    {"heading": "section heading", "content": "section content"},
    {"heading": "section heading", "content": "section content"},
    {"heading": "section heading", "content": "section content"}
  ],
  "imagePrompt": "DALL-E prompt to generate this infographic visually"
}`,
      });
      if (resp?.text) {
        try {
          const cleaned = resp.text.replace(/```json\n?|```\n?/g, '').trim();
          result.infographicSpec = JSON.parse(cleaned) as InfographicSpec;
        } catch {
          result.infographicSpec = {
            title: `${topic} — Quick Reference`,
            format: 'vertical',
            sections: [
              { heading: 'Core Concept', content: baseText.slice(0, 150) },
              { heading: 'Key Formulas', content: 'Important equations and relationships' },
              { heading: 'Exam Tips', content: `What ${examType} examiners look for` },
            ],
            imagePrompt: `Vertical educational infographic about ${topic} for ${examType}, clean design, white background`,
          };
        }
      }
    } catch {
      // gracefully skip
    }
  }

  return result;
}

// ─── Tier-based Content Generation ───────────────────────────────────────────

async function generateByTier(
  tier: ContentTier,
  req: ContentOrchestrationRequest,
): Promise<{ text: string; actualTier: ContentTier; fallbackReason?: string }> {

  // ── T0: Static PYQ index ──
  if (tier === 'T0_static') {
    try {
      const { searchStaticPYQs } = await import('./staticPyqService');
      const pyqs = searchStaticPYQs(req.topic, req.examType, 3);
      if (pyqs.length > 0) {
        const text = pyqs
          .map(
            (p, i) =>
              `**Q${i + 1} (${p.year} ${p.examId.toUpperCase()})**: ${p.question}\n` +
              `Options: ${Object.entries(p.options)
                .map(([k, v]) => `${k}) ${v}`)
                .join(' | ')}\n` +
              `✅ Answer: ${p.answer}\n📝 ${p.explanation}`,
          )
          .join('\n\n---\n\n');
        return { text, actualTier: 'T0_static' };
      }
    } catch (e) {
      console.warn('[Orchestrator] T0 static search failed:', e);
    }
    // T0 found nothing — fall to T1
    return generateByTier('T1_rag', req);
  }

  // ── T1: RAG / Supabase semantic search ──
  if (tier === 'T1_rag') {
    try {
      const { getRagContext } = await import('./ragService');
      const ragCtx = await getRagContext(req.topic, req.examType);
      if (ragCtx.hasContext) {
        const chunks = ragCtx.chunks
          .slice(0, 3)
          .map((c) => c.content)
          .join('\n\n');
        const pyqs = ragCtx.pyqs
          .slice(0, 2)
          .map((p) => `PYQ: ${p.question_text}\n✅ ${p.correct_answer}`)
          .join('\n');
        const text = [chunks, pyqs].filter(Boolean).join('\n\n---\n\n');
        if (text.trim()) return { text, actualTier: 'T1_rag' };
      }
    } catch (e) {
      console.warn('[Orchestrator] T1 RAG failed:', e);
    }
    // Fall to T2
    return generateByTier('T2_llm', req);
  }

  // ── T2: LLM generation ──
  if (tier === 'T2_llm') {
    try {
      const { generateFromPrompt } = await import('./contentGenerationService');
      const text = await generateFromPrompt(
        `Explain "${req.topic}" for ${req.examType} students. Include key concepts, a formula if applicable, and one worked example.`,
        'lesson_notes',
        req.examType,
        1,
        'medium',
        req.topic,
      );
      if (text?.trim()) return { text, actualTier: 'T2_llm' };
    } catch (e) {
      console.warn('[Orchestrator] T2 LLM failed:', e);
    }
    // Fall to T1 → T0
    const fallback = await generateByTier('T1_rag', req);
    return {
      ...fallback,
      fallbackReason: 'T2 LLM generation failed — fell back to RAG/static',
    };
  }

  // ── T3: Wolfram-grounded LLM ──
  if (tier === 'T3_wolfram') {
    try {
      const { generateWolframGrounded } = await import('./contentGenerationService');
      const text = await generateWolframGrounded(
        req.topic,
        'lesson_notes',
        req.examType,
        1,
        req.topic,
      );
      if (text?.trim()) return { text, actualTier: 'T3_wolfram' };
    } catch (e) {
      console.warn('[Orchestrator] T3 Wolfram failed:', e);
    }
    const fallback = await generateByTier('T2_llm', req);
    return {
      ...fallback,
      fallbackReason: 'T3 Wolfram unavailable — fell back to T2 LLM',
    };
  }

  // ── T4: Rich Media (T3 + extras) ──
  if (tier === 'T4_richmedia') {
    const base = await generateByTier('T3_wolfram', req);
    return base;
  }

  // Fallback: return empty
  return { text: '', actualTier: 'T0_static', fallbackReason: 'No tier could generate content' };
}

// ─── Core Orchestration Function ──────────────────────────────────────────────

export async function orchestrateContent(
  req: ContentOrchestrationRequest,
): Promise<ContentOrchestrationResult> {
  const startMs = Date.now();
  const requestId = `orch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // 1. Load orchestrator config
  const config = getOrchestratorConfig();

  // 2. Determine effective tier
  const isMarketing =
    req.surface === 'blog_web' ||
    req.surface === 'youtube' ||
    req.surface === 'email';
  const isMathSci = /math|physics|chemistry|calculus|algebra|differential|integral|circuit|wave|quantum/i.test(
    req.topic,
  );

  const selectionInput: TierSelectionInput = {
    topic: req.topic,
    examType: req.examType,
    surface: req.surface,
    userPlan: req.userPlan,
    requiresVerification: isMathSci,
    isMarketing,
    forceTier: req.tierOverride ?? config.defaultTierOverride,
  };

  const tierResult = selectTier(selectionInput);
  const chosenTier = tierResult.selectedTier;

  // Budget guard — downgrade if cost exceeds limit
  const COST_RANK: Record<string, number> = { free: 0, low: 1, medium: 2, high: 3 };
  let effectiveTier = chosenTier;
  const configCostRank = COST_RANK[config.maxCostLevel] ?? 2;
  const tierCostRank = COST_RANK[tierResult.config.costLevel] ?? 0;
  if (tierCostRank > configCostRank) {
    // Downgrade to T2 at most
    effectiveTier = 'T2_llm';
  }

  // 3. Get strategy
  const strategyObj = req.strategyOverride
    ? { id: req.strategyOverride }
    : getEffectiveStrategy(req.userId);
  const strategy = (strategyObj.id as ContentStrategyId) ?? 'adaptive';

  // 4. Generate content based on tier
  let textContent = '';
  let actualTier = effectiveTier;
  let fallbackReason: string | undefined;
  let status: ContentOrchestrationResult['status'] = 'success';

  try {
    const generated = await generateByTier(effectiveTier, req);
    textContent = generated.text;
    actualTier = generated.actualTier;
    fallbackReason = generated.fallbackReason;

    if (!textContent?.trim()) {
      status = 'failed';
      textContent = `Unable to generate content for "${req.topic}" at this time. Please try again.`;
    } else if (fallbackReason) {
      status = 'fallback';
    }
  } catch (e) {
    status = 'failed';
    fallbackReason = e instanceof Error ? e.message : 'Unknown generation error';
    textContent = `Generation failed: ${fallbackReason}`;
  }

  // 5. If in_app: create ContentAtom
  let atom: ContentAtom | undefined;
  if (req.surface === 'in_app' || req.surface === 'chat') {
    atom = buildAtomFromText(req.topic, req.examType, textContent, actualTier);
  }

  // 6. If T4 (or rich media surface): generate rich media assets
  let imagePrompt: string | undefined;
  let videoScript: VideoScript | undefined;
  let thumbnailBrief: ThumbnailBrief | undefined;
  let infographicSpec: InfographicSpec | undefined;

  const isRichSurface = config.richMediaSurfaces.includes(req.surface);
  const wantsRichMedia =
    actualTier === 'T4_richmedia' || (isRichSurface && actualTier !== 'T0_static');
  const requestedFormats: MediaFormat[] = req.mediaFormats ?? ['text'];

  if (wantsRichMedia && textContent.trim()) {
    const richFormats: MediaFormat[] = requestedFormats.filter(
      (f): f is MediaFormat => f !== 'text',
    );
    if (richFormats.length === 0) {
      richFormats.push('image_prompt', 'video_script');
    }
    try {
      const rich = await generateRichMedia(req.topic, req.examType, textContent, richFormats);
      imagePrompt = rich.imagePrompt;
      videoScript = rich.videoScript;
      thumbnailBrief = rich.thumbnailBrief;
      infographicSpec = rich.infographicSpec;
      if (imagePrompt || videoScript || thumbnailBrief || infographicSpec) {
        if (status === 'success') status = 'success'; // keep success
      }
    } catch {
      // rich media generation is best-effort
      if (status === 'success') status = 'partial';
    }
  }

  // 7. Emit agent signals
  const agentSignals = emitAgentSignals(req, actualTier, textContent);

  // 8. Record to atlas task service if atlas_task-triggered
  if (req.triggeredBy === 'atlas_task') {
    try {
      const { updateTaskStatus } = await import('./atlasTaskService');
      if (atom) {
        updateTaskStatus(`atlas-orchestrated-${requestId}`, 'done', atom);
      }
    } catch {
      // ignore
    }
  }

  const generationMs = Date.now() - startMs;
  const costLevel = TIER_CONFIGS_COST[actualTier];

  const result: ContentOrchestrationResult = {
    requestId,
    tier: actualTier,
    strategy,
    surface: req.surface,
    textContent,
    atom,
    imagePrompt,
    videoScript,
    thumbnailBrief,
    infographicSpec,
    generationMs,
    agentSignals,
    cost: costLevel,
    status,
    fallbackReason,
  };

  // 9. Append to orchestration log
  appendToLog(result, req.topic);

  return result;
}

// Cost map (needed after TIER_CONFIGS import)
const TIER_CONFIGS_COST: Record<ContentTier, 'free' | 'low' | 'medium' | 'high'> = {
  T0_static:    'free',
  T1_rag:       'free',
  T2_llm:       'low',
  T3_wolfram:   'medium',
  T4_richmedia: 'high',
};

// ─── Batch Orchestration ──────────────────────────────────────────────────────

export async function orchestrateBatch(
  batch: BatchOrchestrationRequest,
): Promise<ContentOrchestrationResult[]> {
  const { requests, maxParallel = 2, onProgress } = batch;
  const results: ContentOrchestrationResult[] = [];
  let completed = 0;

  const limit = Math.max(1, Math.min(maxParallel, 5));

  for (let i = 0; i < requests.length; i += limit) {
    const chunk = requests.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map((r) => orchestrateContent(r)));
    results.push(...chunkResults);
    completed += chunk.length;
    onProgress?.(completed, requests.length);
  }

  // Aggregate agent signals to orchestrator:batch_complete
  safeLocalSet('orchestrator:batch_complete', {
    at: new Date().toISOString(),
    count: requests.length,
    successCount: results.filter((r) => r.status === 'success').length,
    topics: requests.map((r) => r.topic),
  });

  return results;
}
