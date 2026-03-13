/**
 * bibleProgressiveUpdater.ts — Progressive Bible Update Engine
 *
 * Wires all agent signals and student interactions into the SubTopicBible.
 * Called once on app startup via initBibleUpdater().
 *
 * Connections:
 *   signalBus events → updateFromX calls
 *   contentFeedbackService → updateFromFeedback
 *   knowledgeRouter → updateFromKnowledgeRouter
 *   Periodic reconciliation every 30 minutes
 */

import {
  getBiblesWithGaps,
  getBiblesNeedingContent,
  getBible,
  getBibleOrCreate,
  saveBible,
  getBibleCompleteness,
  updateFromAtlasGeneration,
  updateFromFeedback,
  updateFromKnowledgeRouter,
  seedDefaultBibles,
  type SubTopicBible,
} from './subTopicBibleService';
import type { FeedbackEvent } from './contentFeedbackService';
import type { KnowledgeResult } from './knowledgeRouter';
import { MANDATORY_COVERAGE_MAP } from './mandatoryContentService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReconcileResult {
  audited: number;
  gaps: number;
  queued: number;
}

interface AtlasSignalPayload {
  examId?: string;
  topicId?: string;
  subtopicId?: string;
  atomType?: string;
  atomId?: string;
  layer?: 'mandatory' | 'personalized';
  styleKey?: string;
}

interface SageSignalPayload {
  examId?: string;
  topicId?: string;
  subtopicId?: string;
  sessionDurationMs?: number;
  socraticDepth?: number;
  promptId?: string;
  promptStyle?: string;
  successSignal?: boolean;
  engagementScore?: number;
}

interface OracleSignalPayload {
  examId?: string;
  topicId?: string;
  subtopicId?: string;
  averageMasteryScore?: number;
  dropoffRate?: number;
  engagementScore?: number;
  totalStudentsTaught?: number;
  masteryDistribution?: Record<string, number>;
  alertLevel?: 'green' | 'amber' | 'red';
}

interface ScoutSignalPayload {
  examId?: string;
  topicId?: string;
  subtopicId?: string;
  searchQuery?: string;
  relatedTerms?: string[];
  contentGap?: string;
  externalTrend?: {
    keyword: string;
    trend: 'rising' | 'stable' | 'falling';
    volume: 'high' | 'medium' | 'low';
  };
  yearwiseTrend?: Record<string, number>;
}

interface MentorSignalPayload {
  examId?: string;
  topicId?: string;
  subtopicId?: string;
  nudgeType?: string;
  effectiveness?: number;
}

interface HeraldSignalPayload {
  examId?: string;
  topicId?: string;
  subtopicId?: string;
  contentId?: string;
  contentTitle?: string;
}

// ─── Internal state ───────────────────────────────────────────────────────────

let _initialized = false;
let _reconcileTimer: ReturnType<typeof setTimeout> | null = null;
const RECONCILE_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Signal Bus Listener (localStorage polling) ───────────────────────────────

/**
 * Watch localStorage keys that agents write to and update bibles accordingly.
 * This is the lightweight alternative to a full event emitter when no backend.
 */
function watchSignalKey(key: string, handler: (payload: unknown) => void): void {
  // Use storage event for cross-tab signals
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === key && e.newValue) {
      try {
        handler(JSON.parse(e.newValue));
      } catch { /* ignore */ }
    }
  });
}

/**
 * Poll a localStorage key once and call handler if data found.
 * Used for single-page signals that may already be present.
 */
function pollSignalKey(key: string, handler: (payload: unknown) => void): void {
  try {
    const raw = localStorage.getItem(key);
    if (raw) handler(JSON.parse(raw));
  } catch { /* ignore */ }
}

// ─── initBibleUpdater ─────────────────────────────────────────────────────────

/**
 * Wire all update hooks. Call once from main.tsx.
 */
export function initBibleUpdater(): void {
  if (_initialized) return;
  _initialized = true;

  // 1. Seed default bibles on first load
  seedDefaultBibles();

  // 2. Wire Atlas content generation signals
  watchSignalKey('atlas:bible_update', (raw) => {
    const p = raw as AtlasSignalPayload;
    if (p.examId && p.topicId && p.subtopicId && p.atomType && p.atomId) {
      const validTypes = ['concept_core', 'formula_card', 'worked_example', 'pyq_set', 'common_mistakes', 'exam_tips'] as const;
      type MandatoryKey = typeof validTypes[number];
      if (validTypes.includes(p.atomType as MandatoryKey)) {
        updateFromAtlasGeneration(
          p.examId, p.topicId, p.subtopicId,
          p.atomType as MandatoryKey,
          p.atomId,
          p.layer ?? 'mandatory',
          p.styleKey,
        );
      }
    }
  });

  // 3. Wire feedback signals
  watchSignalKey('bible:feedback', (raw) => {
    const ev = raw as FeedbackEvent & { examId?: string; topicId?: string; subtopicId?: string };
    if (ev.examId && ev.topicId && ev.subtopicId) {
      updateFromFeedback(ev.examId, ev.topicId, ev.subtopicId, ev);
    }
  });

  // 4. Wire knowledge router signals
  watchSignalKey('bible:knowledge_result', (raw) => {
    const payload = raw as { examId?: string; topicId?: string; subtopicId?: string; result?: KnowledgeResult; query?: string };
    if (payload.examId && payload.topicId && payload.subtopicId && payload.result) {
      updateFromKnowledgeRouter(
        payload.examId, payload.topicId, payload.subtopicId,
        payload.result, payload.query,
      );
    }
  });

  // 5. Wire Sage session signals
  watchSignalKey('bible:sage_session', (raw) => {
    const p = raw as SageSignalPayload;
    if (p.examId && p.topicId && p.subtopicId) {
      _handleSageSignal(p);
    }
  });

  // 6. Wire Oracle analytics signals
  watchSignalKey('bible:oracle_analytics', (raw) => {
    const p = raw as OracleSignalPayload;
    if (p.examId && p.topicId && p.subtopicId) {
      _handleOracleSignal(p);
    }
  });

  // 7. Wire Scout research signals
  watchSignalKey('bible:scout_research', (raw) => {
    const p = raw as ScoutSignalPayload;
    if (p.examId && p.topicId && p.subtopicId) {
      _handleScoutSignal(p);
    }
  });

  // 8. Wire Mentor nudge signals
  watchSignalKey('bible:mentor_nudge', (raw) => {
    const p = raw as MentorSignalPayload;
    if (p.examId && p.topicId && p.subtopicId) {
      _handleMentorSignal(p);
    }
  });

  // 9. Wire Herald content signals
  watchSignalKey('bible:herald_content', (raw) => {
    const p = raw as HeraldSignalPayload;
    if (p.examId && p.topicId && p.subtopicId) {
      _handleHeraldSignal(p);
    }
  });

  // 10. Poll existing signals that may have been written before init
  pollSignalKey('atlas:bible_update', (raw) => {
    const p = raw as AtlasSignalPayload;
    if (p.examId && p.topicId && p.subtopicId && p.atomType && p.atomId) {
      const validTypes = ['concept_core', 'formula_card', 'worked_example', 'pyq_set', 'common_mistakes', 'exam_tips'] as const;
      type MandatoryKey = typeof validTypes[number];
      if (validTypes.includes(p.atomType as MandatoryKey)) {
        updateFromAtlasGeneration(
          p.examId, p.topicId, p.subtopicId,
          p.atomType as MandatoryKey,
          p.atomId,
          p.layer ?? 'mandatory',
          p.styleKey,
        );
      }
    }
  });

  // 11. Schedule periodic reconciliation
  _scheduleReconcile();
}

// ─── Signal Handlers ──────────────────────────────────────────────────────────

function _handleSageSignal(p: SageSignalPayload): void {
  if (!p.examId || !p.topicId || !p.subtopicId) return;
  const { updateFromSageSession } = require('./subTopicBibleService') as typeof import('./subTopicBibleService');
  updateFromSageSession(p.examId, p.topicId, p.subtopicId, {
    sessionDurationMs: p.sessionDurationMs ?? 0,
    socraticDepth: p.socraticDepth ?? 0,
    promptId: p.promptId,
    promptStyle: p.promptStyle,
    successSignal: p.successSignal ?? false,
    engagementScore: p.engagementScore,
  });
}

function _handleOracleSignal(p: OracleSignalPayload): void {
  if (!p.examId || !p.topicId || !p.subtopicId) return;
  const { updateFromOracleAnalytics } = require('./subTopicBibleService') as typeof import('./subTopicBibleService');
  updateFromOracleAnalytics(p.examId, p.topicId, p.subtopicId, {
    averageMasteryScore: p.averageMasteryScore,
    dropoffRate: p.dropoffRate,
    engagementScore: p.engagementScore,
    totalStudentsTaught: p.totalStudentsTaught,
    masteryDistribution: p.masteryDistribution,
    alertLevel: p.alertLevel,
  });
}

function _handleScoutSignal(p: ScoutSignalPayload): void {
  if (!p.examId || !p.topicId || !p.subtopicId) return;
  const { updateFromScoutResearch } = require('./subTopicBibleService') as typeof import('./subTopicBibleService');
  updateFromScoutResearch(p.examId, p.topicId, p.subtopicId, {
    searchQuery: p.searchQuery,
    relatedTerms: p.relatedTerms,
    contentGap: p.contentGap,
    externalTrend: p.externalTrend,
    yearwiseTrend: p.yearwiseTrend,
  });
}

function _handleMentorSignal(p: MentorSignalPayload): void {
  if (!p.examId || !p.topicId || !p.subtopicId) return;
  const { updateFromMentorNudge } = require('./subTopicBibleService') as typeof import('./subTopicBibleService');
  updateFromMentorNudge(p.examId, p.topicId, p.subtopicId, {
    nudgeType: p.nudgeType ?? 'generic',
    effectiveness: p.effectiveness ?? 0.5,
  });
}

function _handleHeraldSignal(p: HeraldSignalPayload): void {
  if (!p.examId || !p.topicId || !p.subtopicId) return;
  const { updateFromHeraldContent } = require('./subTopicBibleService') as typeof import('./subTopicBibleService');
  updateFromHeraldContent(p.examId, p.topicId, p.subtopicId, {
    contentId: p.contentId ?? '',
    contentTitle: p.contentTitle ?? '',
  });
}

// ─── Reconcile ────────────────────────────────────────────────────────────────

function _scheduleReconcile(): void {
  if (_reconcileTimer) clearTimeout(_reconcileTimer);
  _reconcileTimer = setTimeout(() => {
    reconcileBibles().catch(() => {});
    _scheduleReconcile(); // reschedule
  }, RECONCILE_INTERVAL_MS);
}

/**
 * Scan all bibles, find gaps, queue generation for critical ones.
 */
export async function reconcileBibles(): Promise<ReconcileResult> {
  const withGaps = getBiblesWithGaps();
  const needingContent = getBiblesNeedingContent(10);

  let queued = 0;
  for (const item of needingContent) {
    const { scheduleBibleGeneration } = await import('./subTopicBibleService');
    scheduleBibleGeneration(item.examId, item.topicId, item.subtopicId);
    queued++;
  }

  return {
    audited: withGaps.length,
    gaps: withGaps.reduce((sum, g) => sum + g.gaps.length, 0),
    queued,
  };
}

// ─── Enrichment ───────────────────────────────────────────────────────────────

/**
 * Enrich a bible by filling gaps using existing service data.
 */
export async function enrichBible(
  bible: SubTopicBible,
  _maxAgentCalls = 5,
): Promise<SubTopicBible> {
  // Re-read to get latest
  const current = getBible(bible.examId, bible.topicId, bible.subtopicId);
  if (!current) return bible;

  // Fill from static content library
  await seedFromStaticLibrary();

  return getBible(bible.examId, bible.topicId, bible.subtopicId) ?? current;
}

// ─── Seed from existing services ─────────────────────────────────────────────

/**
 * Seed search intelligence from static content library tags.
 */
export async function seedFromStaticLibrary(): Promise<void> {
  const { getAllStaticAtoms } = await import('./staticContentLibrary');

  const examIds = ['GATE_EM', 'JEE', 'CAT', 'NEET', 'UPSC'];
  for (const examId of examIds) {
    const atoms = getAllStaticAtoms(examId);
    for (const atom of atoms) {
      const bible = getBibleOrCreate(examId, atom.topicId, atom.topicId, atom.topicName);
      // Mark search terms from tags
      const updatedQueries = [...new Set([...bible.searchIntelligence.topSearchQueries, ...atom.tags])].slice(-20);
      if (updatedQueries.length > bible.searchIntelligence.topSearchQueries.length) {
        const updated: SubTopicBible = {
          ...bible,
          searchIntelligence: {
            ...bible.searchIntelligence,
            topSearchQueries: updatedQueries,
            relatedSearchTerms: atom.tags,
          },
          version: bible.version + 1,
          lastUpdatedAt: new Date().toISOString(),
          lastUpdatedBy: 'seed_static_library',
        };
        saveBible(updated);
      }
    }
  }
}

/**
 * Seed prompt intelligence from templateRegistry.
 */
export async function seedFromTemplateRegistry(): Promise<void> {
  const { TEMPLATE_REGISTRY } = await import('./templateRegistry');

  for (const [key, template] of Object.entries(TEMPLATE_REGISTRY)) {
    // Key format: exam__topic__style__objective or exam__style__objective
    const parts = key.split('__');
    if (parts.length < 3) continue;

    const examPrefix = parts[0]; // e.g. 'gate'
    const topicSlugOrStyle = parts[1];

    // Only process exam×topic×style×objective (4 parts) = most specific
    if (parts.length < 4) continue;

    const examId = examPrefix.toUpperCase() === 'GATE' ? 'GATE_EM' : examPrefix.toUpperCase();
    const topicSlug = topicSlugOrStyle.replace(/-/g, '_');

    // Try to find matching bibles
    const { getAllBibles } = await import('./subTopicBibleService');
    const bibles = getAllBibles(examId, topicSlug);

    for (const bible of bibles) {
      if (bible.promptIntelligence.bestTemplateKey) continue; // already has one
      const updated: SubTopicBible = {
        ...bible,
        promptIntelligence: {
          ...bible.promptIntelligence,
          bestTemplateKey: key,
          effectiveSystemPrompts: [
            ...bible.promptIntelligence.effectiveSystemPrompts,
            {
              promptId: template.id,
              style: parts[2] ?? 'unknown',
              objective: parts[3] ?? 'unknown',
              successRate: 0.8,
              avgEngagement: 70,
              usageCount: 0,
            },
          ].slice(-10),
        },
        version: bible.version + 1,
        lastUpdatedAt: new Date().toISOString(),
        lastUpdatedBy: 'seed_template_registry',
      };
      saveBible(updated);
    }
  }
}

/**
 * Seed content atom flags from mandatoryContentService audit.
 */
export async function seedFromMandatoryService(): Promise<void> {
  const { auditMandatoryContent } = await import('./mandatoryContentService');

  for (const [examId, topics] of Object.entries(MANDATORY_COVERAGE_MAP)) {
    for (const topic of topics) {
      const spec = auditMandatoryContent(examId, topic.topicId);
      const bible = getBibleOrCreate(examId, topic.topicId, topic.topicId, topic.topicName);

      // Update mandatory atom presence flags
      const mandatoryUpdate: SubTopicBible['contentAtoms']['mandatory'] = {};
      if (spec.atoms.concept_core) mandatoryUpdate.concept_core = `static_${examId}_${topic.topicId}_concept_core`;
      if (spec.atoms.formula_card) mandatoryUpdate.formula_card = `static_${examId}_${topic.topicId}_formula_card`;
      if (spec.atoms.worked_example) mandatoryUpdate.worked_example = `static_${examId}_${topic.topicId}_worked_example`;
      if (spec.atoms.pyq_set) mandatoryUpdate.pyq_set = `static_${examId}_${topic.topicId}_pyq_set`;
      if (spec.atoms.common_mistakes) mandatoryUpdate.common_mistakes = `static_${examId}_${topic.topicId}_common_mistakes`;
      if (spec.atoms.exam_tips) mandatoryUpdate.exam_tips = `static_${examId}_${topic.topicId}_exam_tips`;

      if (Object.keys(mandatoryUpdate).length > 0) {
        const coverage = Math.round((Object.keys(mandatoryUpdate).length / 6) * 100);
        const updated: SubTopicBible = {
          ...bible,
          contentAtoms: {
            ...bible.contentAtoms,
            mandatory: { ...bible.contentAtoms.mandatory, ...mandatoryUpdate },
            lastGeneratedAt: bible.contentAtoms.lastGeneratedAt || new Date().toISOString(),
          },
          agentConnections: {
            ...bible.agentConnections,
            atlas: {
              ...bible.agentConnections.atlas,
              contentCoverage: Math.max(bible.agentConnections.atlas.contentCoverage, coverage),
            },
          },
          version: bible.version + 1,
          lastUpdatedAt: new Date().toISOString(),
          lastUpdatedBy: 'seed_mandatory_service',
        };
        saveBible(updated);
      }
    }
  }
}

/**
 * Seed academic fields from courseOrchestrator outline data.
 */
export async function seedFromCourseOrchestrator(): Promise<void> {
  // Pull exam topic catalogue knowledge to populate academic sections
  for (const [examId, topics] of Object.entries(MANDATORY_COVERAGE_MAP)) {
    for (const topic of topics) {
      const bible = getBibleOrCreate(examId, topic.topicId, topic.topicId, topic.topicName);
      if (bible.academic.definition.length > 10) continue; // already has content

      // Set basic academic data from known exam patterns
      const updated: SubTopicBible = {
        ...bible,
        academic: {
          ...bible.academic,
          definition: bible.academic.definition || `Core ${topic.topicName} concepts for ${examId} examination preparation.`,
          difficulty: 'intermediate',
          estimatedMasteryHours: 4,
          bloomsLevel: 'apply',
        },
        version: bible.version + 1,
        lastUpdatedAt: new Date().toISOString(),
        lastUpdatedBy: 'seed_course_orchestrator',
      };
      saveBible(updated);
    }
  }
}

// ─── Emit helpers (for agents to use) ────────────────────────────────────────

/**
 * Emit a bible update signal from Atlas.
 * Agents call this after generating content.
 */
export function emitAtlasBibleUpdate(
  examId: string,
  topicId: string,
  subtopicId: string,
  atomType: string,
  atomId: string,
  layer: 'mandatory' | 'personalized' = 'mandatory',
  styleKey?: string,
): void {
  try {
    localStorage.setItem('atlas:bible_update', JSON.stringify({
      examId, topicId, subtopicId, atomType, atomId, layer, styleKey,
      timestamp: Date.now(),
    }));
  } catch { /* quota exceeded */ }
}

/**
 * Emit a Sage session update to the bible.
 */
export function emitSageBibleSession(
  examId: string,
  topicId: string,
  subtopicId: string,
  sessionData: Omit<SageSignalPayload, 'examId' | 'topicId' | 'subtopicId'>,
): void {
  try {
    localStorage.setItem('bible:sage_session', JSON.stringify({
      examId, topicId, subtopicId, ...sessionData, timestamp: Date.now(),
    }));
  } catch { /* quota exceeded */ }
}

/**
 * Emit a feedback event to the bible.
 */
export function emitFeedbackToBible(
  examId: string,
  topicId: string,
  subtopicId: string,
  feedback: FeedbackEvent,
): void {
  try {
    localStorage.setItem('bible:feedback', JSON.stringify({
      ...feedback, examId, topicId, subtopicId, timestamp: Date.now(),
    }));
  } catch { /* quota exceeded */ }
}

/**
 * Emit a knowledge router result to the bible.
 */
export function emitKnowledgeResultToBible(
  examId: string,
  topicId: string,
  subtopicId: string,
  result: KnowledgeResult,
  query?: string,
): void {
  try {
    localStorage.setItem('bible:knowledge_result', JSON.stringify({
      examId, topicId, subtopicId, result, query, timestamp: Date.now(),
    }));
  } catch { /* quota exceeded */ }
}

/**
 * Get the completeness summary for all bibles (used in health dashboard).
 */
export function getBibleHealthSummary(): { total: number; healthy: number; needsAttention: number } {
  const { getAllBibles: getAll } = require('./subTopicBibleService') as typeof import('./subTopicBibleService');
  const bibles = getAll();
  const total = bibles.length;
  const healthy = bibles.filter(b => getBibleCompleteness(b) >= 70).length;
  const needsAttention = total - healthy;
  return { total, healthy, needsAttention };
}
