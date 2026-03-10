/**
 * socialAgentOrchestrator.ts — Master Social Intelligence Coordinator
 *
 * Ties together the 5-agent social pipeline:
 *   IntentScout → AnswerCrafter → HookSmith → ApprovalGate → PostScheduler
 *
 * Agent assignments (conceptual mapping to EduGenius squad):
 *   IntentScout → Scout agent (market intelligence)
 *   AnswerCrafter → Atlas + Sage agents (content + tutoring)
 *   HookSmith → Herald agent (distribution)
 *   ApprovalGate → Jarvis / CEO (human-in-the-loop)
 *   PostScheduler → Forge agent (infrastructure)
 *
 * localStorage signals emitted:
 *   social:new_signals — new questions detected
 *   social:answers_ready — answers ready for review
 *   social:posts_scheduled — posts added to schedule
 *   social:performance — post performance data
 *   social:scout_signal — feeds into scoutIntelligenceService
 *   social:cycle_complete — full cycle done, timestamp + stats
 */

import {
  simulateSocialScan,
  getSavedSignals,
  type SocialPlatform,
  type ExamCode,
} from './socialIntentScoutService';

import {
  craftAnswer,
  getAnswers,
} from './answerCrafterService';

import {
  addToQueue,
  getQueueStats,
} from './approvalQueueService';

import {
  getScheduledPosts,
} from './postSchedulerService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SocialCycleResult {
  cycleId: string;
  startedAt: number;
  completedAt: number;
  newSignals: number;
  answersGenerated: number;
  addedToQueue: number;
  autoApproved: number;
  errors: string[];
}

export interface SocialIntelStats {
  totalSignals: number;
  processedSignals: number;
  totalAnswers: number;
  pendingReview: number;
  approved: number;
  scheduled: number;
  posted: number;
  queueStats: ReturnType<typeof getQueueStats>;
  lastCycleAt?: number;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

const SETTINGS_KEY = 'edugenius_social_orchestrator_settings';
const CYCLE_LOG_KEY = 'edugenius_social_cycle_log';

export interface OrchestratorSettings {
  activePlatforms: SocialPlatform[];
  activeExams: ExamCode[];
  scanFrequency: 'hourly' | 'every6h' | 'daily';
  brandVoice: 'formal' | 'casual' | 'expert';
  autoRunEnabled: boolean;
  maxAnswersPerCycle: number;
}

export function getOrchestratorSettings(): OrchestratorSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : getDefaultSettings();
  } catch {
    return getDefaultSettings();
  }
}

function getDefaultSettings(): OrchestratorSettings {
  return {
    activePlatforms: ['reddit', 'quora', 'youtube_comments', 'x_twitter', 'telegram_group'],
    activeExams: ['gate-em', 'gate-ee', 'jee', 'neet', 'cat'],
    scanFrequency: 'every6h',
    brandVoice: 'casual',
    autoRunEnabled: false,
    maxAnswersPerCycle: 5,
  };
}

export function updateOrchestratorSettings(updates: Partial<OrchestratorSettings>): void {
  const current = getOrchestratorSettings();
  const updated = { ...current, ...updates };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
}

// ─── Full Pipeline ────────────────────────────────────────────────────────────

/**
 * Run a full social intelligence cycle.
 *
 * Pipeline:
 * 1. IntentScout: simulateSocialScan() → new signals
 * 2. AnswerCrafter: craftAnswer() for each unprocessed signal
 * 3. ApprovalGate: addToQueue() → auto-approve if eligible
 * 4. Emit signals to integrated services
 * 5. Update localStorage sync signals
 */
export async function runSocialIntelCycle(
  options?: Partial<OrchestratorSettings>
): Promise<SocialCycleResult> {
  const settings = { ...getOrchestratorSettings(), ...options };
  const cycleId = `cycle_${Date.now()}`;
  const startedAt = Date.now();
  const errors: string[] = [];

  // ── Step 1: IntentScout scan ───────────────────────────────────────────────
  let newSignals = 0;
  try {
    const scanned = simulateSocialScan(settings.activePlatforms, settings.activeExams);
    newSignals = scanned.length;

    if (newSignals > 0) {
      // Emit to Scout intelligence service
      localStorage.setItem('social:scout_signal', JSON.stringify({
        ts: startedAt,
        count: newSignals,
        platforms: settings.activePlatforms,
        exams: settings.activeExams,
      }));

      // Emit new signals count
      localStorage.setItem('social:new_signals', JSON.stringify({
        ts: startedAt,
        count: newSignals,
        cycleId,
      }));
    }
  } catch (e) {
    errors.push(`IntentScout: ${e instanceof Error ? e.message : 'Scan failed'}`);
  }

  // ── Step 2: AnswerCrafter — generate answers for unprocessed signals ───────
  let answersGenerated = 0;
  let addedToQueue = 0;
  let autoApproved = 0;

  try {
    const allSignals = getSavedSignals().filter(s => !s.processed);
    const toProcess = allSignals.slice(0, settings.maxAnswersPerCycle);

    for (const signal of toProcess) {
      try {
        // AnswerCrafter
        const answer = craftAnswer(signal);
        answersGenerated++;

        // ApprovalGate
        const queueItem = addToQueue(answer, signal.urgency);
        addedToQueue++;

        if (queueItem.autoApproved) {
          autoApproved++;
        }
      } catch (e) {
        errors.push(`AnswerCrafter [${signal.id}]: ${e instanceof Error ? e.message : 'Failed'}`);
      }
    }

    // Emit answers ready signal
    if (answersGenerated > 0) {
      localStorage.setItem('social:answers_ready', JSON.stringify({
        ts: Date.now(),
        count: answersGenerated,
        pending: answersGenerated - autoApproved,
        autoApproved,
        cycleId,
      }));
    }
  } catch (e) {
    errors.push(`AnswerCrafter batch: ${e instanceof Error ? e.message : 'Batch failed'}`);
  }

  // ── Step 3: Sync with content system ──────────────────────────────────────
  try {
    // Connect to masterContentAgent signal
    const signals = getSavedSignals().filter(s => !s.processed);
    if (signals.length > 0) {
      const topTopics = [...new Set(signals.map(s => s.topic))].slice(0, 5);
      localStorage.setItem('content:social_intel_topics', JSON.stringify({
        ts: Date.now(),
        topics: topTopics,
        signals: signals.length,
        source: 'socialAgentOrchestrator',
      }));
    }

    // Emit to Oracle for tracking
    const queueStats = getQueueStats();
    localStorage.setItem('social:performance', JSON.stringify({
      ts: Date.now(),
      cycleId,
      queueStats,
      newSignals,
      answersGenerated,
    }));
  } catch (e) {
    errors.push(`ContentSync: ${e instanceof Error ? e.message : 'Sync failed'}`);
  }

  // ── Complete ───────────────────────────────────────────────────────────────
  const completedAt = Date.now();

  const result: SocialCycleResult = {
    cycleId,
    startedAt,
    completedAt,
    newSignals,
    answersGenerated,
    addedToQueue,
    autoApproved,
    errors,
  };

  // Log cycle
  try {
    const log = getCycleLog();
    log.unshift(result);
    localStorage.setItem(CYCLE_LOG_KEY, JSON.stringify(log.slice(0, 20))); // keep last 20
  } catch {/* ignore */}

  // Emit cycle complete
  localStorage.setItem('social:cycle_complete', JSON.stringify({
    ts: completedAt,
    cycleId,
    durationMs: completedAt - startedAt,
    newSignals,
    answersGenerated,
    autoApproved,
    errors: errors.length,
  }));

  return result;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getSocialIntelStats(): SocialIntelStats {
  const allSignals = getSavedSignals();
  const allAnswers = getAnswers();
  const scheduledPosts = getScheduledPosts();
  const queueStats = getQueueStats();

  const lastCycleRaw = localStorage.getItem('social:cycle_complete');
  const lastCycleAt = lastCycleRaw ? JSON.parse(lastCycleRaw).ts : undefined;

  return {
    totalSignals: allSignals.length,
    processedSignals: allSignals.filter(s => s.processed).length,
    totalAnswers: allAnswers.length,
    pendingReview: allAnswers.filter(a => a.status === 'pending_review').length,
    approved: allAnswers.filter(a => a.status === 'approved').length,
    scheduled: scheduledPosts.filter(p => p.status === 'queued').length,
    posted: scheduledPosts.filter(p => p.status === 'posted').length,
    queueStats,
    lastCycleAt,
  };
}

export function getCycleLog(): SocialCycleResult[] {
  try {
    const raw = localStorage.getItem(CYCLE_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Integration Helpers ──────────────────────────────────────────────────────

/**
 * Get social signals suitable for feeding into sagePersonaPrompts.ts
 * Topics detected from social = topics students are struggling with.
 */
export function getSocialTopicsForSage(): string[] {
  const signals = getSavedSignals();
  const topicFrequency: Record<string, number> = {};

  for (const signal of signals) {
    topicFrequency[signal.topic] = (topicFrequency[signal.topic] || 0) + 1;
  }

  return Object.entries(topicFrequency)
    .sort(([, a], [, b]) => b - a)
    .map(([topic]) => topic)
    .slice(0, 10);
}

/**
 * Get signal that can be emitted to scoutIntelligenceService.
 */
export function getScoutSignalPayload() {
  const signals = getSavedSignals();
  const examBreakdown: Record<string, number> = {};
  const platformBreakdown: Record<string, number> = {};

  for (const signal of signals) {
    examBreakdown[signal.exam] = (examBreakdown[signal.exam] || 0) + 1;
    platformBreakdown[signal.platform] = (platformBreakdown[signal.platform] || 0) + 1;
  }

  return {
    totalSignals: signals.length,
    examBreakdown,
    platformBreakdown,
    topTopics: getSocialTopicsForSage(),
    urgentCount: signals.filter(s => s.urgency === 'high').length,
    ts: Date.now(),
  };
}
