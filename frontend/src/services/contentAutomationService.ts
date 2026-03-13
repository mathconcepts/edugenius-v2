/**
 * contentAutomationService.ts — Automated content generation pipeline
 *
 * Connects batch generation to a schedule-driven pipeline:
 *   - Reads exam registry to know which topics need content
 *   - Tracks content freshness (what was generated when)
 *   - Scores topics by priority: exam proximity + competitor gap + freshness
 *   - Schedules batch jobs automatically
 *   - Respects rate limits via rateLimitService
 *   - Persists state to localStorage
 */

import { useState, useEffect } from 'react';
import { EXAM_REGISTRY, getLiveExams } from '@/data/examRegistry';
import {
  createBatchJob,
  runBatchJobWithPrefetch,
  type BatchProgress,
  type BatchResult,
} from './batchContentService';
import type { GenerationRequest, GeneratedContent, ContentOutputFormat, GenerationLayer } from './contentGenerationService';
import { getStaticTopicCompleteness } from './mandatoryContentService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutomationStatus = 'idle' | 'running' | 'paused' | 'error';

export type TriggerMode =
  | 'manual'       // user clicks "Run Now"
  | 'scheduled'    // runs every N minutes
  | 'gap_driven'   // runs when content gap score exceeds threshold
  | 'continuous';  // runs whenever rate limits allow, non-stop

export interface TopicContentRecord {
  topicId: string;
  examId: string;
  lastGeneratedAt?: string;    // ISO string (serialisable)
  generationCount: number;
  lastFormat: ContentOutputFormat;
  wolframVerified: boolean;
  contentIds: string[];        // IDs of GeneratedContent items
}

export interface AutomationConfig {
  enabled: boolean;
  triggerMode: TriggerMode;
  intervalMinutes: number;              // for 'scheduled' mode (default: 60)
  targetExams: string[];                // exam IDs to generate for (default: all live)
  targetFormats: ContentOutputFormat[]; // formats to generate (default: ['mcq_set'])
  itemsPerBatch: number;                // topics per batch run (default: 5)
  countPerTopic: number;                // MCQs/items per topic (default: 10)
  prioritizeCompetitorGaps: boolean;    // use examRegistry.competitorGap (default: true)
  prioritizeStaleContent: boolean;      // regenerate old content first (default: true)
  stalenessThresholdDays: number;       // content older than this is "stale" (default: 7)
  autoPublish: boolean;                 // auto-mark as readyForReview (default: true)
}

export interface AutomationRun {
  id: string;
  triggeredBy: TriggerMode;
  startedAt: string;           // ISO string
  completedAt?: string;        // ISO string
  batchJobId?: string;
  topicsAttempted: string[];
  topicsSucceeded: string[];
  topicsFailed: string[];
  verifiedCount: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
}

export interface AutomationState {
  config: AutomationConfig;
  status: AutomationStatus;
  currentRun?: AutomationRun;
  runHistory: AutomationRun[];          // last 20 runs
  topicRecords: TopicContentRecord[];
  generatedContent: GeneratedContent[]; // all content produced by automation
  nextScheduledRun?: string;            // ISO string
  totalGenerated: number;
  totalVerified: number;
}

export interface ScoredTopic {
  topicId: string;
  examId: string;
  examName: string;
  score: number;                 // 0–100, higher = generate sooner
  reasons: string[];             // why this score
  suggestedFormat: ContentOutputFormat;
  suggestedWolframQuery: string;
  mandatoryCompleteness: number; // 0–100 from static library check
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'edugenius-automation-state';

const MATH_SCIENCE_KEYWORDS = [
  'algebra', 'calculus', 'differential', 'integral', 'transform', 'laplace', 'fourier',
  'matrix', 'vector', 'eigenvalue', 'probability', 'statistics', 'numerical',
  'thermodynamics', 'electromagnetism', 'mechanics', 'optics', 'quantum',
  'chemistry', 'physics', 'circuit', 'signals', 'control', 'equation',
  'graph-theory', 'linear-algebra', 'complex-variables', 'discrete-mathematics',
  'vector-calculus', 'differential-equations',
];

// ─── Default config ───────────────────────────────────────────────────────────

function buildDefaultConfig(): AutomationConfig {
  const liveExams = getLiveExams();
  return {
    enabled: false,
    triggerMode: 'manual',
    intervalMinutes: 60,
    targetExams: liveExams.map(e => e.id),
    targetFormats: ['mcq_set'],
    itemsPerBatch: 5,
    countPerTopic: 10,
    prioritizeCompetitorGaps: true,
    prioritizeStaleContent: true,
    stalenessThresholdDays: 7,
    autoPublish: true,
  };
}

function buildDefaultState(): AutomationState {
  return {
    config: buildDefaultConfig(),
    status: 'idle',
    currentRun: undefined,
    runHistory: [],
    topicRecords: [],
    generatedContent: [],
    nextScheduledRun: undefined,
    totalGenerated: 0,
    totalVerified: 0,
  };
}

// ─── Topic scoring helpers ────────────────────────────────────────────────────

function isMathematical(topicId: string): boolean {
  const t = topicId.toLowerCase();
  return MATH_SCIENCE_KEYWORDS.some(kw => t.includes(kw));
}

function suggestFormat(topicId: string): ContentOutputFormat {
  const t = topicId.toLowerCase();
  if (isMathematical(t)) return 'mcq_set';
  if (
    t.includes('reading') || t.includes('comprehension') ||
    t.includes('verbal') || t.includes('blog')
  ) return 'blog_post';
  if (
    t.includes('concept') || t.includes('theory') ||
    t.includes('lesson') || t.includes('notes')
  ) return 'lesson_notes';
  return 'mcq_set';
}

export function buildWolframQueryForTopic(topicId: string, examName: string): string {
  // Convert kebab-case topicId to human-readable form
  const humanTopic = topicId
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return `${humanTopic} for ${examName}`;
}

function daysSince(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff / (1000 * 60 * 60 * 24);
}

// ─── Core scoring function ────────────────────────────────────────────────────

export function scoreTopicsForGeneration(
  config: AutomationConfig,
  topicRecords: TopicContentRecord[],
): ScoredTopic[] {
  const scored: ScoredTopic[] = [];

  const targetExamIds = config.targetExams.length > 0
    ? config.targetExams
    : getLiveExams().map(e => e.id);

  for (const examId of targetExamIds) {
    const exam = EXAM_REGISTRY.find(e => e.id === examId);
    if (!exam) continue;

    for (const topicId of exam.topics) {
      let score = 50;
      const reasons: string[] = [];

      const record = topicRecords.find(
        r => r.topicId === topicId && r.examId === examId,
      );

      // +30 if topic is in exam.competitorGap
      if (
        config.prioritizeCompetitorGaps &&
        exam.competitorGap?.includes(topicId)
      ) {
        score += 30;
        reasons.push('+30 competitor gap topic');
      }

      // +20 if topic has never been generated
      if (!record) {
        score += 20;
        reasons.push('+20 never generated');
      } else {
        // +15 if last generated > stalenessThresholdDays ago
        const age = daysSince(record.lastGeneratedAt);
        if (
          config.prioritizeStaleContent &&
          age !== null &&
          age > config.stalenessThresholdDays
        ) {
          score += 15;
          reasons.push(`+15 stale (${Math.round(age)}d ago)`);
        }

        // -10 if generated in last 24h (recently done)
        if (age !== null && age < 1) {
          score -= 10;
          reasons.push('-10 generated recently');
        }
      }

      // +10 if topic is in topicWeights with priority 'high'
      const weight = exam.topicWeights?.find(tw => tw.topicId === topicId);
      if (weight?.priority === 'high') {
        score += 10;
        reasons.push('+10 high-priority topic');
      }

      // +5 if topic is mathematical (Wolfram path available)
      if (isMathematical(topicId)) {
        score += 5;
        reasons.push('+5 mathematical (Wolfram path)');
      }

      // Two-layer model: strong boost for mandatory-incomplete topics
      const mandatorySpec = getStaticTopicCompleteness(examId, topicId);
      const mandatoryCompleteness = mandatorySpec.coverage;
      if (mandatoryCompleteness < 100) {
        const mandatoryBoost = (100 - mandatoryCompleteness) * 2;
        score += mandatoryBoost;
        reasons.push(`+${mandatoryBoost} mandatory gap (${mandatoryCompleteness}% complete)`);
      }

      // Clamp to 0–100
      score = Math.min(100, Math.max(0, score));

      scored.push({
        topicId,
        examId,
        examName: exam.name,
        score,
        reasons,
        suggestedFormat: suggestFormat(topicId),
        suggestedWolframQuery: buildWolframQueryForTopic(topicId, exam.name),
        mandatoryCompleteness,
      });
    }
  }

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Return top itemsPerBatch
  return scored.slice(0, config.itemsPerBatch);
}

// ─── Alias for external callers (AutomationPanel) ────────────────────────────

export function selectTopicsForNextRun(state: AutomationState): ScoredTopic[] {
  return scoreTopicsForGeneration(state.config, state.topicRecords);
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export function saveAutomationState(state: AutomationState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage not available (SSR/private browsing)
  }
}

export function initAutomation(): AutomationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AutomationState>;
      // Merge with defaults to handle new fields added in future
      return {
        ...buildDefaultState(),
        ...parsed,
        config: {
          ...buildDefaultConfig(),
          ...(parsed.config ?? {}),
        },
      };
    }
  } catch {
    // ignore parse errors
  }
  return buildDefaultState();
}

export function updateAutomationConfig(patch: Partial<AutomationConfig>): void {
  _state = {
    ..._state,
    config: { ..._state.config, ...patch },
  };
  saveAutomationState(_state);
}

// ─── Cancellation flag ────────────────────────────────────────────────────────

let _cancelled = false;

export function cancelCurrentRun(): void {
  _cancelled = true;
  if (_state.currentRun && _state.currentRun.status === 'running') {
    _state.currentRun = {
      ..._state.currentRun,
      status: 'cancelled',
      completedAt: new Date().toISOString(),
    };
    _state.status = 'idle';
    saveAutomationState(_state);
  }
}

// ─── Schedule helper ──────────────────────────────────────────────────────────

export function scheduleNextRun(state: AutomationState): Date {
  const intervalMs = state.config.intervalMinutes * 60 * 1000;
  return new Date(Date.now() + intervalMs);
}

// ─── Build generation requests from scored topics ─────────────────────────────

function buildRequestsFromScoredTopics(
  topics: ScoredTopic[],
  config: AutomationConfig,
): GenerationRequest[] {
  const requests: GenerationRequest[] = [];

  // First pass: mandatory requests for topics with incomplete baseline
  for (const t of topics) {
    if (t.mandatoryCompleteness < 100) {
      const layer: GenerationLayer = 'mandatory';
      requests.push({
        source: isMathematical(t.topicId) ? ('wolfram_grounded' as const) : ('direct_prompt' as const),
        sourceData: {
          prompt: buildWolframQueryForTopic(t.topicId, t.examName),
          wolframQuery: t.suggestedWolframQuery,
        },
        outputFormat: t.suggestedFormat,
        examTarget: t.examName,
        topicId: t.topicId,
        difficultyLevel: 'mixed' as const,
        count: config.countPerTopic,
        useWolframVerification: isMathematical(t.topicId),
        useWolframGrounding: isMathematical(t.topicId),
        layer,
        mandatoryAtomType: t.suggestedFormat === 'mcq_set' ? 'pyq_set' : 'concept_core',
      });
    }
  }

  // Second pass: personalized requests for topics with complete baseline
  for (const t of topics) {
    if (t.mandatoryCompleteness >= 100) {
      const layer: GenerationLayer = 'personalized';
      requests.push({
        source: isMathematical(t.topicId) ? ('wolfram_grounded' as const) : ('direct_prompt' as const),
        sourceData: {
          prompt: buildWolframQueryForTopic(t.topicId, t.examName),
          wolframQuery: t.suggestedWolframQuery,
        },
        outputFormat: t.suggestedFormat,
        examTarget: t.examName,
        topicId: t.topicId,
        difficultyLevel: 'mixed' as const,
        count: config.countPerTopic,
        useWolframVerification: isMathematical(t.topicId),
        useWolframGrounding: isMathematical(t.topicId),
        layer,
      });
    }
  }

  return requests;
}

// ─── Main automation run ──────────────────────────────────────────────────────

export async function startAutomationRun(
  state: AutomationState,
  onProgress?: (p: BatchProgress) => void,
  onComplete?: (run: AutomationRun, content: GeneratedContent[]) => void,
): Promise<AutomationRun> {
  _cancelled = false;

  // Select topics
  const scoredTopics = scoreTopicsForGeneration(state.config, state.topicRecords);

  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const run: AutomationRun = {
    id: runId,
    triggeredBy: state.config.triggerMode,
    startedAt: new Date().toISOString(),
    topicsAttempted: scoredTopics.map(t => `${t.examId}::${t.topicId}`),
    topicsSucceeded: [],
    topicsFailed: [],
    verifiedCount: 0,
    status: 'running',
  };

  // Update singleton state
  _state = {
    ..._state,
    status: 'running',
    currentRun: run,
  };
  saveAutomationState(_state);

  try {
    // Build requests
    const requests = buildRequestsFromScoredTopics(scoredTopics, state.config);

    // Create batch job
    const batchJob = createBatchJob(
      `Auto Run — ${new Date().toLocaleString()}`,
      requests,
      { concurrency: 2, maxRetries: 1 },
    );
    run.batchJobId = batchJob.id;

    // Run the batch
    const result: BatchResult = await runBatchJobWithPrefetch(
      batchJob,
      (p) => {
        if (_cancelled) return;
        onProgress?.(p);
      },
    );

    if (_cancelled) {
      run.status = 'cancelled';
      run.completedAt = new Date().toISOString();
    } else {
      // Collect generated content
      const newContent: GeneratedContent[] = result.items
        .filter(item => item.status === 'done' && item.result)
        .map(item => item.result!);

      // Update topic records
      const updatedRecords = [..._state.topicRecords];
      result.items.forEach((item, idx) => {
        const scored = scoredTopics[idx];
        if (!scored) return;
        const key = `${scored.examId}::${scored.topicId}`;

        if (item.status === 'done' && item.result) {
          run.topicsSucceeded.push(key);

          // Update or create record
          const existingIdx = updatedRecords.findIndex(
            r => r.topicId === scored.topicId && r.examId === scored.examId,
          );
          const newRecord: TopicContentRecord = {
            topicId: scored.topicId,
            examId: scored.examId,
            lastGeneratedAt: new Date().toISOString(),
            generationCount:
              existingIdx >= 0 ? updatedRecords[existingIdx].generationCount + 1 : 1,
            lastFormat: scored.suggestedFormat,
            wolframVerified: item.result.wolframVerified,
            contentIds: [
              ...(existingIdx >= 0 ? updatedRecords[existingIdx].contentIds : []),
              item.result.id,
            ],
          };
          if (existingIdx >= 0) {
            updatedRecords[existingIdx] = newRecord;
          } else {
            updatedRecords.push(newRecord);
          }
        } else if (item.status === 'failed') {
          run.topicsFailed.push(key);
        }
      });

      run.verifiedCount = result.verifiedCount;
      run.status = 'completed';
      run.completedAt = new Date().toISOString();

      // Update singleton state
      const updatedContent = [
        ...newContent,
        ..._state.generatedContent,
      ].slice(0, 500); // cap at 500

      const updatedHistory = [run, ..._state.runHistory].slice(0, 20);

      _state = {
        ..._state,
        status: 'idle',
        currentRun: run,
        runHistory: updatedHistory,
        topicRecords: updatedRecords,
        generatedContent: updatedContent,
        totalGenerated: _state.totalGenerated + newContent.length,
        totalVerified: _state.totalVerified + result.verifiedCount,
        nextScheduledRun:
          state.config.triggerMode === 'scheduled'
            ? scheduleNextRun(_state).toISOString()
            : undefined,
      };

      saveAutomationState(_state);
      onComplete?.(run, newContent);
    }
  } catch (err) {
    run.status = 'failed';
    run.completedAt = new Date().toISOString();
    run.error = err instanceof Error ? err.message : String(err);

    const updatedHistory = [run, ..._state.runHistory].slice(0, 20);
    _state = {
      ..._state,
      status: 'error',
      currentRun: run,
      runHistory: updatedHistory,
    };
    saveAutomationState(_state);
  }

  return run;
}

// ─── Module-level singleton ───────────────────────────────────────────────────

let _state: AutomationState = initAutomation();

export function getAutomationState(): AutomationState {
  return _state;
}

export function setAutomationStateDirectly(patch: Partial<AutomationState>): void {
  _state = { ..._state, ...patch };
  saveAutomationState(_state);
}

// ─── React hook ───────────────────────────────────────────────────────────────

export function useAutomation(): {
  state: AutomationState;
  refresh: () => void;
} {
  const [state, setState] = useState<AutomationState>(() => getAutomationState());

  useEffect(() => {
    // Poll the singleton every 2s to sync React state
    const id = setInterval(() => {
      setState({ ...getAutomationState() });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const refresh = () => setState({ ...getAutomationState() });

  return { state, refresh };
}
