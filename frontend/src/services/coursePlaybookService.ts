/**
 * coursePlaybookService.ts — Course Playbook: Universal Knowledge Graph
 *
 * The single source of truth for every course subtopic.
 * Every agent reads from it. Every agent writes to it.
 * Every student interaction updates it.
 *
 * Storage:
 *   localStorage key: `eg_playbook_{examId}_{topicId}_{subtopicId}` per playbook
 *   Index key:        `eg_playbook_index` → string[] of all playbook IDs
 *   Supabase table:   `subtopic_playbooks` (when available)
 */

import type { FeedbackEvent } from './contentFeedbackService';
import type { KnowledgeResult } from './knowledgeRouter';
import { MANDATORY_COVERAGE_MAP } from './mandatoryContentService';

// ─── Core Schema ──────────────────────────────────────────────────────────────

export interface CoursePlaybook {
  // ── Identity ──────────────────────────────────────────────────────────────
  id: string;                    // '{examId}__{topicId}__{subtopicId}'
  examId: string;                // 'GATE_EM' | 'JEE' | 'NEET' | 'CAT' | 'UPSC'
  topicId: string;               // parent topic: 'linear_algebra'
  subtopicId: string;            // 'eigenvalues' | 'matrix_operations' etc.
  subtopicName: string;          // 'Eigenvalues and Eigenvectors'
  version: number;               // increments on every update
  lastUpdatedAt: string;         // ISO timestamp
  lastUpdatedBy: string;         // agent or 'system' or 'student_interaction'

  // ── Academic Foundation ────────────────────────────────────────────────────
  academic: {
    definition: string;
    prerequisites: string[];
    postrequisites: string[];
    difficulty: 'foundational' | 'intermediate' | 'advanced' | 'expert';
    estimatedMasteryHours: number;
    bloomsLevel: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
    conceptualDependencies: string[];
    realWorldApplications: string[];
    crossSubjectConnections: string[];
  };

  // ── Teaching Intelligence ──────────────────────────────────────────────────
  pedagogy: {
    teachingSequence: string[];
    commonMisconceptions: {
      misconception: string;
      correction: string;
      frequency: 'very_common' | 'common' | 'occasional';
    }[];
    effectiveAnalogies: {
      analogy: string;
      worksFor: string[];
      examId?: string;
    }[];
    scaffoldingStrategies: string[];
    accelerationStrategies: string[];
    socraticQuestions: string[];
    checkpointQuestions: string[];
    teacherNotes: string;
    parentExplanation: string;
  };

  // ── Exam Intelligence ──────────────────────────────────────────────────────
  examIntelligence: {
    weightage: number;
    averageQuestionsPerPaper: number;
    difficultyCurve: 'easy_heavy' | 'balanced' | 'hard_heavy';
    questionPatterns: {
      pattern: string;
      frequency: number;
      example: string;
    }[];
    pyqs: {
      year: number;
      question: string;
      answer: string;
      explanation: string;
      marks: number;
      difficulty: 'easy' | 'medium' | 'hard';
      trap?: string;
      source: string;
    }[];
    trapTopics: string[];
    highYieldFormulas: string[];
    examSpecificTips: string;
    yearwiseTrend: Record<string, number>;
  };

  // ── Content Atoms ──────────────────────────────────────────────────────────
  contentAtoms: {
    mandatory: {
      concept_core?: string;
      formula_card?: string;
      worked_example?: string;
      pyq_set?: string;
      common_mistakes?: string;
      exam_tips?: string;
    };
    personalized: Record<string, string>;
    lastGeneratedAt: string;
    generationVersion: number;
  };

  // ── Student Analytics ──────────────────────────────────────────────────────
  analytics: {
    totalStudentsTaught: number;
    averageMasteryScore: number;
    averageSessionsToMastery: number;
    commonStuckPoints: string[];
    averageTimeToComplete: number;
    dropoffRate: number;
    completionRate: number;
    feedbackSentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    engagementScore: number;
    recentTrend: 'improving' | 'stable' | 'declining';
    lastAnalyticsUpdate: string;
  };

  // ── Student Preferences ────────────────────────────────────────────────────
  studentPreferences: {
    preferredLearningStyles: Record<string, number>;
    preferredFormats: Record<string, number>;
    preferredDifficulty: 'gradual' | 'jump_in' | 'mixed';
    sessionLengthPreference: 'short_5min' | 'medium_15min' | 'long_30min' | 'varied';
    bestTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | 'no_preference';
    moodDistribution: Record<string, number>;
    devicePreference: 'mobile' | 'desktop' | 'mixed';
    lastPreferenceUpdate: string;
  };

  // ── Search Intelligence ────────────────────────────────────────────────────
  searchIntelligence: {
    topSearchQueries: string[];
    relatedSearchTerms: string[];
    externalSearchTrends: {
      keyword: string;
      trend: 'rising' | 'stable' | 'falling';
      volume: 'high' | 'medium' | 'low';
    }[];
    contentGaps: string[];
    discoveryPath: string[];
    lastSearchUpdate: string;
  };

  // ── Agent Connections ──────────────────────────────────────────────────────
  agentConnections: {
    atlas: {
      lastGenerated: string;
      contentCoverage: number;
      nextGenerationScheduled?: string;
      generationPriority: 'critical' | 'high' | 'normal' | 'low';
    };
    sage: {
      lastTaughtAt: string;
      totalSessions: number;
      avgSocraticDepth: number;
      effectivePromptIds: string[];
    };
    oracle: {
      lastAnalyzed: string;
      masteryDistribution: Record<string, number>;
      alertLevel: 'green' | 'amber' | 'red';
    };
    scout: {
      lastResearched: string;
      competitorCoverage: Record<string, string>;
      marketPosition: 'leading' | 'parity' | 'gap';
    };
    mentor: {
      nudgesSent: number;
      nudgeEffectiveness: number;
      bestNudgeType: string;
    };
    herald: {
      contentPublished: number;
      lastPublishedAt: string;
      topPerformingContent: string;
    };
  };

  // ── Prompt Intelligence ────────────────────────────────────────────────────
  promptIntelligence: {
    effectiveSystemPrompts: {
      promptId: string;
      style: string;
      objective: string;
      successRate: number;
      avgEngagement: number;
      usageCount: number;
    }[];
    failedPromptPatterns: string[];
    bestTemplateKey: string;
    promptEvolutionLog: {
      version: string;
      change: string;
      impact: string;
      date: string;
    }[];
  };

  // ── Knowledge Graph ────────────────────────────────────────────────────────
  knowledgeGraph: {
    incomingLinks: string[];
    outgoingLinks: string[];
    clusterTag: string;
    difficultyPathways: {
      easy: string[];
      hard: string[];
    };
    crossExamRelevance: Record<string, number>;
  };

  // ── Update History ─────────────────────────────────────────────────────────
  updateHistory: {
    field: string;
    oldValue: string;
    newValue: string;
    updatedBy: string;
    updatedAt: string;
    reason: string;
  }[];
}

// ─── Agent Update Param Types ─────────────────────────────────────────────────

export interface SageSessionUpdate {
  subtopicId: string;
  examId: string;
  topicId: string;
  sessionDurationMs: number;
  socraticDepth: number;
  promptId?: string;
  promptStyle?: string;
  successSignal: boolean;
  engagementScore?: number;
}

export interface AnalyticsUpdate {
  subtopicId: string;
  examId: string;
  topicId: string;
  averageMasteryScore?: number;
  dropoffRate?: number;
  engagementScore?: number;
  totalStudentsTaught?: number;
  masteryDistribution?: Record<string, number>;
  alertLevel?: 'green' | 'amber' | 'red';
}

export interface SearchIntelligenceUpdate {
  subtopicId: string;
  examId: string;
  topicId: string;
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

export interface NudgeResult {
  subtopicId: string;
  examId: string;
  topicId: string;
  nudgeType: string;
  effectiveness: number;
}

export interface HeraldContentResult {
  subtopicId: string;
  examId: string;
  topicId: string;
  contentId: string;
  contentTitle: string;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const PLAYBOOK_KEY_PREFIX = 'eg_playbook_';
const PLAYBOOK_INDEX_KEY = 'eg_playbook_index';

function playbookStorageKey(examId: string, topicId: string, subtopicId: string): string {
  return `${PLAYBOOK_KEY_PREFIX}${examId.toLowerCase()}_${topicId.toLowerCase()}_${subtopicId.toLowerCase()}`;
}

function playbookId(examId: string, topicId: string, subtopicId: string): string {
  return `${examId}__${topicId}__${subtopicId}`;
}

// ─── Supabase Detection ───────────────────────────────────────────────────────

export function isSupabaseAvailable(): boolean {
  const url = (typeof import.meta !== 'undefined' ? (import.meta as unknown as Record<string, Record<string, string>>).env?.VITE_SUPABASE_URL : undefined) ?? '';
  return typeof url === 'string' && url.length > 0;
}

// ─── Index Helpers ────────────────────────────────────────────────────────────

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(PLAYBOOK_INDEX_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function addToIndex(id: string): void {
  try {
    const idx = readIndex();
    if (!idx.includes(id)) {
      idx.push(id);
      localStorage.setItem(PLAYBOOK_INDEX_KEY, JSON.stringify(idx));
    }
  } catch { /* quota exceeded */ }
}

// ─── Default Playbook Factory ─────────────────────────────────────────────────────

function createDefaultPlaybook(
  examId: string,
  topicId: string,
  subtopicId: string,
  subtopicName?: string,
): CoursePlaybook {
  const now = new Date().toISOString();
  return {
    id: playbookId(examId, topicId, subtopicId),
    examId,
    topicId,
    subtopicId,
    subtopicName: subtopicName ?? subtopicId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    version: 1,
    lastUpdatedAt: now,
    lastUpdatedBy: 'system',
    academic: {
      definition: '',
      prerequisites: [],
      postrequisites: [],
      difficulty: 'intermediate',
      estimatedMasteryHours: 3,
      bloomsLevel: 'understand',
      conceptualDependencies: [],
      realWorldApplications: [],
      crossSubjectConnections: [],
    },
    pedagogy: {
      teachingSequence: [],
      commonMisconceptions: [],
      effectiveAnalogies: [],
      scaffoldingStrategies: [],
      accelerationStrategies: [],
      socraticQuestions: [],
      checkpointQuestions: [],
      teacherNotes: '',
      parentExplanation: '',
    },
    examIntelligence: {
      weightage: 0,
      averageQuestionsPerPaper: 0,
      difficultyCurve: 'balanced',
      questionPatterns: [],
      pyqs: [],
      trapTopics: [],
      highYieldFormulas: [],
      examSpecificTips: '',
      yearwiseTrend: {},
    },
    contentAtoms: {
      mandatory: {},
      personalized: {},
      lastGeneratedAt: '',
      generationVersion: 0,
    },
    analytics: {
      totalStudentsTaught: 0,
      averageMasteryScore: 0,
      averageSessionsToMastery: 0,
      commonStuckPoints: [],
      averageTimeToComplete: 0,
      dropoffRate: 0,
      completionRate: 0,
      feedbackSentiment: 'neutral',
      engagementScore: 0,
      recentTrend: 'stable',
      lastAnalyticsUpdate: now,
    },
    studentPreferences: {
      preferredLearningStyles: {},
      preferredFormats: {},
      preferredDifficulty: 'gradual',
      sessionLengthPreference: 'medium_15min',
      bestTimeOfDay: 'no_preference',
      moodDistribution: {},
      devicePreference: 'mixed',
      lastPreferenceUpdate: now,
    },
    searchIntelligence: {
      topSearchQueries: [],
      relatedSearchTerms: [],
      externalSearchTrends: [],
      contentGaps: [],
      discoveryPath: [],
      lastSearchUpdate: now,
    },
    agentConnections: {
      atlas: { lastGenerated: '', contentCoverage: 0, generationPriority: 'normal' },
      sage: { lastTaughtAt: '', totalSessions: 0, avgSocraticDepth: 0, effectivePromptIds: [] },
      oracle: { lastAnalyzed: '', masteryDistribution: {}, alertLevel: 'green' },
      scout: { lastResearched: '', competitorCoverage: {}, marketPosition: 'gap' },
      mentor: { nudgesSent: 0, nudgeEffectiveness: 0, bestNudgeType: '' },
      herald: { contentPublished: 0, lastPublishedAt: '', topPerformingContent: '' },
    },
    promptIntelligence: {
      effectiveSystemPrompts: [],
      failedPromptPatterns: [],
      bestTemplateKey: '',
      promptEvolutionLog: [],
    },
    knowledgeGraph: {
      incomingLinks: [],
      outgoingLinks: [],
      clusterTag: topicId,
      difficultyPathways: { easy: [], hard: [] },
      crossExamRelevance: {},
    },
    updateHistory: [],
  };
}

// ─── READ Functions ───────────────────────────────────────────────────────────

/**
 * Get a playbook by examId, topicId, subtopicId. Returns null if not found.
 */
export function getPlaybook(
  examId: string,
  topicId: string,
  subtopicId: string,
): CoursePlaybook | null {
  try {
    const raw = localStorage.getItem(playbookStorageKey(examId, topicId, subtopicId));
    return raw ? (JSON.parse(raw) as CoursePlaybook) : null;
  } catch {
    return null;
  }
}

/**
 * Get a playbook, creating a skeleton if it doesn't exist.
 */
export function getPlaybookOrCreate(
  examId: string,
  topicId: string,
  subtopicId: string,
  subtopicName?: string,
): CoursePlaybook {
  const existing = getPlaybook(examId, topicId, subtopicId);
  if (existing) return existing;
  const playbook = createDefaultPlaybook(examId, topicId, subtopicId, subtopicName);
  savePlaybook(playbook);
  return playbook;
}

/**
 * Get all playbooks, optionally filtered by examId and/or topicId.
 */
export function getAllPlaybooks(examId?: string, topicId?: string): CoursePlaybook[] {
  const index = readIndex();
  const playbooks: CoursePlaybook[] = [];
  for (const id of index) {
    const parts = id.split('__');
    if (parts.length < 3) continue;
    const [eId, tId, sId] = parts;
    if (examId && eId.toLowerCase() !== examId.toLowerCase()) continue;
    if (topicId && tId.toLowerCase() !== topicId.toLowerCase()) continue;
    const playbook = getPlaybook(eId, tId, sId);
    if (playbook) playbooks.push(playbook);
  }
  return playbooks;
}

/**
 * Compute completeness percentage for a playbook (0-100).
 * Based on how many fields are non-empty/non-zero.
 */
export function getPlaybookCompleteness(playbook: CoursePlaybook): number {
  let filled = 0;
  const total = 20;

  if (playbook.academic.definition.length > 10) filled++;
  if (playbook.academic.prerequisites.length > 0) filled++;
  if (playbook.academic.realWorldApplications.length > 0) filled++;
  if (playbook.pedagogy.teachingSequence.length > 0) filled++;
  if (playbook.pedagogy.commonMisconceptions.length > 0) filled++;
  if (playbook.pedagogy.socraticQuestions.length > 0) filled++;
  if (playbook.pedagogy.effectiveAnalogies.length > 0) filled++;
  if (playbook.examIntelligence.weightage > 0) filled++;
  if (playbook.examIntelligence.pyqs.length > 0) filled++;
  if (playbook.examIntelligence.highYieldFormulas.length > 0) filled++;
  if (Object.keys(playbook.contentAtoms.mandatory).length > 0) filled++;
  if (playbook.analytics.totalStudentsTaught > 0) filled++;
  if (playbook.analytics.commonStuckPoints.length > 0) filled++;
  if (Object.keys(playbook.studentPreferences.preferredLearningStyles).length > 0) filled++;
  if (playbook.searchIntelligence.topSearchQueries.length > 0) filled++;
  if (playbook.agentConnections.atlas.contentCoverage > 0) filled++;
  if (playbook.agentConnections.sage.totalSessions > 0) filled++;
  if (playbook.promptIntelligence.effectiveSystemPrompts.length > 0) filled++;
  if (playbook.knowledgeGraph.incomingLinks.length + playbook.knowledgeGraph.outgoingLinks.length > 0) filled++;
  if (playbook.examIntelligence.examSpecificTips.length > 5) filled++;

  return Math.round((filled / total) * 100);
}

// ─── WRITE Functions ──────────────────────────────────────────────────────────

/**
 * Save/overwrite a playbook in localStorage.
 */
export function savePlaybook(playbook: CoursePlaybook): void {
  try {
    localStorage.setItem(
      playbookStorageKey(playbook.examId, playbook.topicId, playbook.subtopicId),
      JSON.stringify(playbook),
    );
    addToIndex(playbook.id);
  } catch { /* quota exceeded */ }
}

/**
 * Update a single top-level field on a playbook.
 */
export function updatePlaybookField<K extends keyof CoursePlaybook>(
  id: string,
  field: K,
  value: CoursePlaybook[K],
  updatedBy: string,
): void {
  const parts = id.split('__');
  if (parts.length < 3) return;
  const [examId, topicId, subtopicId] = parts;
  const playbook = getPlaybook(examId, topicId, subtopicId);
  if (!playbook) return;

  const oldValue = JSON.stringify(playbook[field]).slice(0, 200);
  const newPlaybook: CoursePlaybook = {
    ...playbook,
    [field]: value,
    version: playbook.version + 1,
    lastUpdatedAt: new Date().toISOString(),
    lastUpdatedBy: updatedBy,
    updateHistory: [
      ...playbook.updateHistory.slice(-49),
      {
        field: String(field),
        oldValue,
        newValue: JSON.stringify(value).slice(0, 200),
        updatedBy,
        updatedAt: new Date().toISOString(),
        reason: `field update by ${updatedBy}`,
      },
    ],
  };
  savePlaybook(newPlaybook);
}

/**
 * Deep-merge a partial playbook update into the stored playbook.
 */
export function mergePlaybookUpdate(
  id: string,
  partial: Partial<CoursePlaybook>,
  updatedBy: string,
): void {
  const parts = id.split('__');
  if (parts.length < 3) return;
  const [examId, topicId, subtopicId] = parts;
  const playbook = getPlaybook(examId, topicId, subtopicId);
  if (!playbook) return;

  const now = new Date().toISOString();
  const changedFields = Object.keys(partial).filter(k => k !== 'updateHistory');

  const merged: CoursePlaybook = {
    ...playbook,
    ...partial,
    // Deep merge nested objects
    academic: partial.academic ? { ...playbook.academic, ...partial.academic } : playbook.academic,
    pedagogy: partial.pedagogy ? { ...playbook.pedagogy, ...partial.pedagogy } : playbook.pedagogy,
    examIntelligence: partial.examIntelligence ? { ...playbook.examIntelligence, ...partial.examIntelligence } : playbook.examIntelligence,
    contentAtoms: partial.contentAtoms ? {
      ...playbook.contentAtoms,
      ...partial.contentAtoms,
      mandatory: { ...playbook.contentAtoms.mandatory, ...(partial.contentAtoms.mandatory ?? {}) },
      personalized: { ...playbook.contentAtoms.personalized, ...(partial.contentAtoms.personalized ?? {}) },
    } : playbook.contentAtoms,
    analytics: partial.analytics ? { ...playbook.analytics, ...partial.analytics } : playbook.analytics,
    studentPreferences: partial.studentPreferences ? { ...playbook.studentPreferences, ...partial.studentPreferences } : playbook.studentPreferences,
    searchIntelligence: partial.searchIntelligence ? { ...playbook.searchIntelligence, ...partial.searchIntelligence } : playbook.searchIntelligence,
    agentConnections: partial.agentConnections ? {
      atlas: partial.agentConnections.atlas ? { ...playbook.agentConnections.atlas, ...partial.agentConnections.atlas } : playbook.agentConnections.atlas,
      sage: partial.agentConnections.sage ? { ...playbook.agentConnections.sage, ...partial.agentConnections.sage } : playbook.agentConnections.sage,
      oracle: partial.agentConnections.oracle ? { ...playbook.agentConnections.oracle, ...partial.agentConnections.oracle } : playbook.agentConnections.oracle,
      scout: partial.agentConnections.scout ? { ...playbook.agentConnections.scout, ...partial.agentConnections.scout } : playbook.agentConnections.scout,
      mentor: partial.agentConnections.mentor ? { ...playbook.agentConnections.mentor, ...partial.agentConnections.mentor } : playbook.agentConnections.mentor,
      herald: partial.agentConnections.herald ? { ...playbook.agentConnections.herald, ...partial.agentConnections.herald } : playbook.agentConnections.herald,
    } : playbook.agentConnections,
    promptIntelligence: partial.promptIntelligence ? { ...playbook.promptIntelligence, ...partial.promptIntelligence } : playbook.promptIntelligence,
    knowledgeGraph: partial.knowledgeGraph ? { ...playbook.knowledgeGraph, ...partial.knowledgeGraph } : playbook.knowledgeGraph,
    version: playbook.version + 1,
    lastUpdatedAt: now,
    lastUpdatedBy: updatedBy,
    updateHistory: [
      ...playbook.updateHistory.slice(-49),
      {
        field: changedFields.join(', '),
        oldValue: '',
        newValue: '',
        updatedBy,
        updatedAt: now,
        reason: `merge update by ${updatedBy}`,
      },
    ],
  };

  savePlaybook(merged);
}

// ─── Progressive Update Triggers ─────────────────────────────────────────────

/**
 * Atlas: called after generating content atoms for a subtopic.
 */
export function updateFromAtlasGeneration(
  examId: string,
  topicId: string,
  subtopicId: string,
  atomType: keyof CoursePlaybook['contentAtoms']['mandatory'],
  atomId: string,
  layer: 'mandatory' | 'personalized',
  styleKey?: string,
): void {
  const playbook = getPlaybookOrCreate(examId, topicId, subtopicId);
  const now = new Date().toISOString();
  const updatedMandatory = layer === 'mandatory'
    ? { ...playbook.contentAtoms.mandatory, [atomType]: atomId }
    : playbook.contentAtoms.mandatory;
  const updatedPersonalized = layer === 'personalized' && styleKey
    ? { ...playbook.contentAtoms.personalized, [styleKey]: atomId }
    : playbook.contentAtoms.personalized;

  const mandatoryCount = Object.keys(updatedMandatory).length;
  const coverage = Math.round((mandatoryCount / 6) * 100);

  mergePlaybookUpdate(playbook.id, {
    contentAtoms: {
      mandatory: updatedMandatory,
      personalized: updatedPersonalized,
      lastGeneratedAt: now,
      generationVersion: playbook.contentAtoms.generationVersion + 1,
    },
    agentConnections: {
      ...playbook.agentConnections,
      atlas: {
        ...playbook.agentConnections.atlas,
        lastGenerated: now,
        contentCoverage: coverage,
        generationPriority: coverage < 50 ? 'critical' : coverage < 80 ? 'high' : 'normal',
      },
    },
  }, 'atlas');
}

/**
 * Sage: called after each tutoring session.
 */
export function updateFromSageSession(
  examId: string,
  topicId: string,
  subtopicId: string,
  sessionData: Omit<SageSessionUpdate, 'subtopicId' | 'examId' | 'topicId'>,
): void {
  const playbook = getPlaybookOrCreate(examId, topicId, subtopicId);
  const now = new Date().toISOString();
  const currentSage = playbook.agentConnections.sage;
  const newTotal = currentSage.totalSessions + 1;
  const newAvgDepth = (currentSage.avgSocraticDepth * currentSage.totalSessions + sessionData.socraticDepth) / newTotal;

  const updatedPromptIds = sessionData.promptId && sessionData.successSignal
    ? [...new Set([...currentSage.effectivePromptIds, sessionData.promptId])].slice(-10)
    : currentSage.effectivePromptIds;

  const updatedPrompts = sessionData.promptId && sessionData.successSignal
    ? [
        ...playbook.promptIntelligence.effectiveSystemPrompts,
        {
          promptId: sessionData.promptId,
          style: sessionData.promptStyle ?? 'unknown',
          objective: 'session',
          successRate: 1,
          avgEngagement: sessionData.engagementScore ?? 70,
          usageCount: 1,
        },
      ].slice(-20)
    : playbook.promptIntelligence.effectiveSystemPrompts;

  mergePlaybookUpdate(playbook.id, {
    agentConnections: {
      ...playbook.agentConnections,
      sage: {
        lastTaughtAt: now,
        totalSessions: newTotal,
        avgSocraticDepth: Math.round(newAvgDepth * 10) / 10,
        effectivePromptIds: updatedPromptIds,
      },
    },
    promptIntelligence: {
      ...playbook.promptIntelligence,
      effectiveSystemPrompts: updatedPrompts,
    },
  }, 'sage');
}

/**
 * Oracle: called after analytics pass.
 */
export function updateFromOracleAnalytics(
  examId: string,
  topicId: string,
  subtopicId: string,
  analyticsUpdate: Omit<AnalyticsUpdate, 'subtopicId' | 'examId' | 'topicId'>,
): void {
  const playbook = getPlaybookOrCreate(examId, topicId, subtopicId);
  const now = new Date().toISOString();

  const alertLevel: 'green' | 'amber' | 'red' = (() => {
    if (analyticsUpdate.alertLevel) return analyticsUpdate.alertLevel;
    const dropoff = analyticsUpdate.dropoffRate ?? playbook.analytics.dropoffRate;
    const engagement = analyticsUpdate.engagementScore ?? playbook.analytics.engagementScore;
    if (dropoff > 0.5 || engagement < 30) return 'red';
    if (dropoff > 0.3 || engagement < 50) return 'amber';
    return 'green';
  })();

  mergePlaybookUpdate(playbook.id, {
    analytics: {
      ...playbook.analytics,
      ...(analyticsUpdate.dropoffRate !== undefined && { dropoffRate: analyticsUpdate.dropoffRate }),
      ...(analyticsUpdate.engagementScore !== undefined && { engagementScore: analyticsUpdate.engagementScore }),
      ...(analyticsUpdate.totalStudentsTaught !== undefined && { totalStudentsTaught: analyticsUpdate.totalStudentsTaught }),
      lastAnalyticsUpdate: now,
    },
    agentConnections: {
      ...playbook.agentConnections,
      oracle: {
        lastAnalyzed: now,
        masteryDistribution: analyticsUpdate.masteryDistribution ?? playbook.agentConnections.oracle.masteryDistribution,
        alertLevel,
      },
    },
  }, 'oracle');
}

/**
 * Scout: called after market research pass.
 */
export function updateFromScoutResearch(
  examId: string,
  topicId: string,
  subtopicId: string,
  searchUpdate: Omit<SearchIntelligenceUpdate, 'subtopicId' | 'examId' | 'topicId'>,
): void {
  const playbook = getPlaybookOrCreate(examId, topicId, subtopicId);
  const now = new Date().toISOString();

  const updatedTrends = searchUpdate.externalTrend
    ? [...playbook.searchIntelligence.externalSearchTrends.filter(t => t.keyword !== searchUpdate.externalTrend!.keyword), searchUpdate.externalTrend]
    : playbook.searchIntelligence.externalSearchTrends;

  const updatedGaps = searchUpdate.contentGap
    ? [...new Set([...playbook.searchIntelligence.contentGaps, searchUpdate.contentGap])].slice(-20)
    : playbook.searchIntelligence.contentGaps;

  const updatedRelated = searchUpdate.relatedTerms
    ? [...new Set([...playbook.searchIntelligence.relatedSearchTerms, ...searchUpdate.relatedTerms])].slice(-30)
    : playbook.searchIntelligence.relatedSearchTerms;

  mergePlaybookUpdate(playbook.id, {
    searchIntelligence: {
      ...playbook.searchIntelligence,
      externalSearchTrends: updatedTrends,
      contentGaps: updatedGaps,
      relatedSearchTerms: updatedRelated,
      lastSearchUpdate: now,
    },
    examIntelligence: searchUpdate.yearwiseTrend
      ? { ...playbook.examIntelligence, yearwiseTrend: { ...playbook.examIntelligence.yearwiseTrend, ...searchUpdate.yearwiseTrend } }
      : playbook.examIntelligence,
    agentConnections: {
      ...playbook.agentConnections,
      scout: {
        ...playbook.agentConnections.scout,
        lastResearched: now,
      },
    },
  }, 'scout');
}

/**
 * Mentor: called after sending a nudge.
 */
export function updateFromMentorNudge(
  examId: string,
  topicId: string,
  subtopicId: string,
  nudgeResult: Omit<NudgeResult, 'subtopicId' | 'examId' | 'topicId'>,
): void {
  const playbook = getPlaybookOrCreate(examId, topicId, subtopicId);
  const currentMentor = playbook.agentConnections.mentor;
  const newCount = currentMentor.nudgesSent + 1;
  const newEff = (currentMentor.nudgeEffectiveness * currentMentor.nudgesSent + nudgeResult.effectiveness) / newCount;

  mergePlaybookUpdate(playbook.id, {
    agentConnections: {
      ...playbook.agentConnections,
      mentor: {
        nudgesSent: newCount,
        nudgeEffectiveness: Math.round(newEff * 100) / 100,
        bestNudgeType: nudgeResult.effectiveness > currentMentor.nudgeEffectiveness
          ? nudgeResult.nudgeType
          : currentMentor.bestNudgeType,
      },
    },
  }, 'mentor');
}

/**
 * Herald: called after publishing content related to this subtopic.
 */
export function updateFromHeraldContent(
  examId: string,
  topicId: string,
  subtopicId: string,
  contentResult: Omit<HeraldContentResult, 'subtopicId' | 'examId' | 'topicId'>,
): void {
  const playbook = getPlaybookOrCreate(examId, topicId, subtopicId);
  const now = new Date().toISOString();

  mergePlaybookUpdate(playbook.id, {
    agentConnections: {
      ...playbook.agentConnections,
      herald: {
        contentPublished: playbook.agentConnections.herald.contentPublished + 1,
        lastPublishedAt: now,
        topPerformingContent: contentResult.contentTitle,
      },
    },
  }, 'herald');
}

/**
 * Called when a student types a search query related to this subtopic.
 */
export function updateFromStudentSearch(
  examId: string,
  topicId: string,
  subtopicId: string,
  searchQuery: string,
): void {
  const playbook = getPlaybookOrCreate(examId, topicId, subtopicId);
  const now = new Date().toISOString();
  const updatedQueries = [
    searchQuery,
    ...playbook.searchIntelligence.topSearchQueries.filter(q => q !== searchQuery),
  ].slice(-20);

  mergePlaybookUpdate(playbook.id, {
    searchIntelligence: {
      ...playbook.searchIntelligence,
      topSearchQueries: updatedQueries,
      lastSearchUpdate: now,
    },
  }, 'student_interaction');
}

/**
 * Called after recording student feedback on content.
 */
export function updateFromFeedback(
  examId: string,
  topicId: string,
  subtopicId: string,
  feedback: FeedbackEvent,
): void {
  const playbook = getPlaybookOrCreate(examId, topicId, subtopicId);
  const formatKey = String(feedback.atomType);
  const currentScore = playbook.studentPreferences.preferredFormats[formatKey] ?? 50;
  const delta =
    feedback.signal === 'thumbs_up' ? 5
    : feedback.signal === 'thumbs_down' ? -5
    : feedback.signal === 'completed' ? 3
    : 0;
  const newScore = Math.max(0, Math.min(100, currentScore + delta));

  const updatedStuckPoints =
    feedback.signal === 'thumbs_down' && feedback.topic
      ? [...new Set([...playbook.analytics.commonStuckPoints, feedback.topic])].slice(-10)
      : playbook.analytics.commonStuckPoints;

  const sentimentMap: Record<string, number> = {
    thumbs_up: 1, thumbs_down: -1, completed: 0.5, skipped: -0.3,
  };
  const sentimentSignal = sentimentMap[feedback.signal] ?? 0;
  const currentSentiment = playbook.analytics.feedbackSentiment;
  const newSentiment: CoursePlaybook['analytics']['feedbackSentiment'] =
    sentimentSignal > 0.5 ? 'positive'
    : sentimentSignal < -0.5 ? 'negative'
    : currentSentiment === 'positive' && sentimentSignal < 0 ? 'mixed'
    : currentSentiment === 'negative' && sentimentSignal > 0 ? 'mixed'
    : currentSentiment;

  mergePlaybookUpdate(playbook.id, {
    studentPreferences: {
      ...playbook.studentPreferences,
      preferredFormats: { ...playbook.studentPreferences.preferredFormats, [formatKey]: newScore },
    },
    analytics: {
      ...playbook.analytics,
      commonStuckPoints: updatedStuckPoints,
      feedbackSentiment: newSentiment,
    },
  }, 'student_feedback');
}

/**
 * Called after knowledgeRouter resolves a query for this subtopic.
 */
export function updateFromKnowledgeRouter(
  examId: string,
  topicId: string,
  subtopicId: string,
  routerResult: KnowledgeResult,
  queryText?: string,
): void {
  const playbook = getPlaybookOrCreate(examId, topicId, subtopicId);
  const now = new Date().toISOString();

  const updatedQueries = queryText
    ? [queryText, ...playbook.searchIntelligence.topSearchQueries.filter(q => q !== queryText)].slice(-20)
    : playbook.searchIntelligence.topSearchQueries;

  const updatedGaps =
    routerResult.confidence < 0.4 && queryText
      ? [...new Set([...playbook.searchIntelligence.contentGaps, queryText])].slice(-20)
      : playbook.searchIntelligence.contentGaps;

  mergePlaybookUpdate(playbook.id, {
    searchIntelligence: {
      ...playbook.searchIntelligence,
      topSearchQueries: updatedQueries,
      contentGaps: updatedGaps,
      lastSearchUpdate: now,
    },
  }, 'knowledge_router');
}

// ─── Generation Triggers ──────────────────────────────────────────────────────

export function getPlaybooksNeedingContent(limit = 20): CoursePlaybook[] {
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
  return getAllPlaybooks()
    .filter(b => b.agentConnections.atlas.contentCoverage < 80)
    .sort((a, b) => {
      const pa = priorityOrder[a.agentConnections.atlas.generationPriority] ?? 2;
      const pb = priorityOrder[b.agentConnections.atlas.generationPriority] ?? 2;
      if (pa !== pb) return pa - pb;
      return a.agentConnections.atlas.contentCoverage - b.agentConnections.atlas.contentCoverage;
    })
    .slice(0, limit);
}

export function getPlaybooksWithGaps(): { playbook: CoursePlaybook; gaps: string[] }[] {
  return getAllPlaybooks().map(playbook => {
    const gaps: string[] = [];
    if (!playbook.contentAtoms.mandatory.concept_core) gaps.push('concept_core');
    if (!playbook.contentAtoms.mandatory.formula_card) gaps.push('formula_card');
    if (!playbook.contentAtoms.mandatory.worked_example) gaps.push('worked_example');
    if (!playbook.contentAtoms.mandatory.pyq_set) gaps.push('pyq_set');
    if (!playbook.contentAtoms.mandatory.common_mistakes) gaps.push('common_mistakes');
    if (!playbook.contentAtoms.mandatory.exam_tips) gaps.push('exam_tips');
    if (playbook.pedagogy.socraticQuestions.length === 0) gaps.push('socratic_questions');
    return { playbook, gaps };
  }).filter(({ gaps }) => gaps.length > 0);
}

export function schedulePlaybookGeneration(examId: string, topicId: string, subtopicId: string): void {
  const playbook = getPlaybookOrCreate(examId, topicId, subtopicId);
  mergePlaybookUpdate(playbook.id, {
    agentConnections: {
      ...playbook.agentConnections,
      atlas: {
        ...playbook.agentConnections.atlas,
        generationPriority: 'critical',
        nextGenerationScheduled: new Date(Date.now() + 5 * 60000).toISOString(),
      },
    },
  }, 'system');
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export function getPlaybookHealthScore(playbook: CoursePlaybook): number {
  const completeness = getPlaybookCompleteness(playbook);
  const engagement = playbook.analytics.engagementScore;
  const alertPenalty =
    playbook.agentConnections.oracle.alertLevel === 'red' ? 20
    : playbook.agentConnections.oracle.alertLevel === 'amber' ? 10 : 0;
  return Math.max(0, Math.round(completeness * 0.6 + engagement * 0.4 - alertPenalty));
}

export function getTopSubtopicsByEngagement(examId: string, limit: number): CoursePlaybook[] {
  return getAllPlaybooks(examId)
    .sort((a, b) => b.analytics.engagementScore - a.analytics.engagementScore)
    .slice(0, limit);
}

export function getSubtopicsWithAlerts(): CoursePlaybook[] {
  return getAllPlaybooks().filter(b =>
    b.agentConnections.oracle.alertLevel === 'red' ||
    b.agentConnections.oracle.alertLevel === 'amber',
  );
}

/**
 * getUserPlaybookForSubtopic — Scope-aware playbook access.
 *
 * Returns the global CoursePlaybook for (examId, topicId, subtopicId) only if
 * the topic is within the user's active UserPlaybook scope.
 * Returns null when:
 *   - The user has no UserPlaybook for this exam, OR
 *   - Their scope is 'partial' and this topic is NOT in selectedTopicIds, OR
 *   - Their scope is 'full' and this topic is in excludedTopicIds.
 *
 * Usage: agents should call this instead of getPlaybook() to respect user scope.
 */
export function getUserPlaybookForSubtopic(
  userId: string,
  examId: string,
  topicId: string,
  subtopicId: string,
): CoursePlaybook | null {
  try {
    // Lazy-import to avoid circular dependency: userPlaybookService imports from here.
    // We use a synchronous runtime require pattern via dynamic evaluation to keep this
    // file non-async. Since userPlaybookService only uses isSupabaseAvailable() from here,
    // there is no circular loop — but we still load it lazily to be safe.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ups = require('./userPlaybookService') as typeof import('./userPlaybookService');
    const userPlaybook = ups.loadUserPlaybook(userId, examId);

    if (!userPlaybook) {
      // No personal playbook — full access (system default)
      return getPlaybook(examId, topicId, subtopicId);
    }

    const scope = userPlaybook.scope;

    if (scope.scopeType === 'partial') {
      // Partial scope: topic must be in selectedTopicIds
      if (!scope.selectedTopicIds.includes(topicId)) return null;

      // Optional subtopic-level restriction
      if (
        scope.selectedSubtopicIds &&
        scope.selectedSubtopicIds.length > 0 &&
        !scope.selectedSubtopicIds.includes(subtopicId)
      ) {
        return null;
      }
    } else {
      // Full scope: topic must NOT be in excludedTopicIds
      const excluded = scope.excludedTopicIds ?? [];
      if (excluded.includes(topicId)) return null;
    }

    return getPlaybook(examId, topicId, subtopicId);
  } catch {
    // Fallback: return global playbook if anything goes wrong
    return getPlaybook(examId, topicId, subtopicId);
  }
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const GATE_EM_LINEAR_ALGEBRA_SUBTOPICS: Array<{
  id: string; name: string; def: string; prereqs: string[];
  bloom: CoursePlaybook['academic']['bloomsLevel'];
  diff: CoursePlaybook['academic']['difficulty'];
  hours: number; formulas: string[]; weightage: number; tips: string;
  pyqs: Array<{ year: number; q: string; a: string; exp: string; m: number; d: CoursePlaybook['examIntelligence']['pyqs'][0]['difficulty']; s: string }>;
}> = [
  {
    id: 'eigenvalues_eigenvectors', name: 'Eigenvalues and Eigenvectors',
    def: 'Scalars λ and vectors v satisfying Av=λv. Critical for GATE: trace=sum of eigenvalues, det=product of eigenvalues. Cayley-Hamilton: every matrix satisfies its own characteristic equation.',
    prereqs: ['matrix_operations'], bloom: 'analyze', diff: 'advanced', hours: 4,
    formulas: ['det(A - λI) = 0', 'Av = λv', 'trace(A) = Σλᵢ', 'det(A) = Πλᵢ', 'Cayley-Hamilton: p(A) = 0'],
    weightage: 8, tips: 'Verify eigenvalues using trace (sum) and determinant (product). Cayley-Hamilton gives inverse and powers of matrix easily.',
    pyqs: [{ year: 2022, q: 'Find eigenvalues of A=[[4,1],[2,3]]', a: 'λ₁=5, λ₂=2', exp: 'det(A-λI)=0 → λ²-7λ+10=0 → (λ-5)(λ-2)=0. Verify: trace=7=5+2✓, det=10=5×2✓', m: 2, d: 'medium', s: 'GATE_2022_Q7' }],
  },
  {
    id: 'matrix_operations', name: 'Matrix Operations',
    def: 'Matrix arithmetic: addition, multiplication, transpose, determinant, inverse. Foundation for all linear algebra in GATE.',
    prereqs: [], bloom: 'apply', diff: 'intermediate', hours: 2,
    formulas: ['det(AB)=det(A)·det(B)', 'det(kA)=kⁿdet(A)', '(AB)⁻¹=B⁻¹A⁻¹', 'A⁻¹=(1/det)·adj(A)'],
    weightage: 5, tips: 'For 2×2: inverse = (1/det)[[d,-b],[-c,a]]. Properties of det are frequently tested in NAT questions.',
    pyqs: [],
  },
  {
    id: 'linear_transformations', name: 'Linear Transformations',
    def: 'T:Vₙ→Vₘ satisfying T(αu+βv)=αT(u)+βT(v). Kernel (null space) and range (column space) are the fundamental subspaces.',
    prereqs: ['vector_spaces', 'matrix_operations'], bloom: 'analyze', diff: 'advanced', hours: 3,
    formulas: ['rank(T) + nullity(T) = n (Rank-Nullity)', 'ker(T) = {v : T(v) = 0}'],
    weightage: 4, tips: 'Rank-Nullity theorem: always check consistency. nullity = number of free variables = n - rank.',
    pyqs: [],
  },
  {
    id: 'vector_spaces', name: 'Vector Spaces',
    def: 'Set V with addition and scalar multiplication satisfying 8 axioms. Span, linear independence, basis, and dimension are key concepts for GATE.',
    prereqs: ['matrix_operations'], bloom: 'understand', diff: 'intermediate', hours: 3,
    formulas: ['dim(span{v₁,...,vₖ}) = rank of matrix [v₁|...|vₖ]', 'rank(A) + nullity(A) = n'],
    weightage: 4, tips: 'A basis must be linearly independent AND span the space. Dimension = number of vectors in any basis.',
    pyqs: [],
  },
  {
    id: 'systems_of_equations', name: 'Systems of Linear Equations',
    def: 'Ax=b. Solution existence and uniqueness determined by comparing rank(A), rank([A|b]), and n (number of unknowns).',
    prereqs: ['matrix_operations'], bloom: 'apply', diff: 'intermediate', hours: 2,
    formulas: ['rank(A)=rank([A|b])=n → unique solution', 'rank(A)=rank([A|b])<n → infinite solutions', 'rank(A)≠rank([A|b]) → no solution'],
    weightage: 5, tips: 'Row reduce [A|b] augmented matrix. Compare ranks. Consistent iff rank(A)=rank([A|b]).',
    pyqs: [],
  },
];

const GATE_EM_CALCULUS_SUBTOPICS: Array<{
  id: string; name: string; def: string; prereqs: string[];
  bloom: CoursePlaybook['academic']['bloomsLevel'];
  diff: CoursePlaybook['academic']['difficulty'];
  hours: number; formulas: string[]; weightage: number; tips: string;
  pyqs: Array<{ year: number; q: string; a: string; exp: string; m: number; d: CoursePlaybook['examIntelligence']['pyqs'][0]['difficulty']; s: string }>;
}> = [
  {
    id: 'limits_continuity', name: 'Limits and Continuity',
    def: 'lim(x→a)f(x) exists iff left and right limits are equal. Continuous at a iff limit=f(a). Foundation for all calculus.',
    prereqs: [], bloom: 'understand', diff: 'foundational', hours: 2,
    formulas: ['lim(sinx/x)=1 as x→0', 'lim((eˣ-1)/x)=1 as x→0', "L'Hôpital: 0/0 or ∞/∞ → f'(x)/g'(x)"],
    weightage: 4, tips: "L'Hôpital only applies to 0/0 or ∞/∞. Always check the form first! Common GATE trap.",
    pyqs: [],
  },
  {
    id: 'differentiation', name: 'Differentiation',
    def: "f'(x) = lim(Δx→0)[f(x+Δx)-f(x)]/Δx. Chain rule, product rule, Leibniz differentiation under integral sign.",
    prereqs: ['limits_continuity'], bloom: 'apply', diff: 'intermediate', hours: 3,
    formulas: ['chain: d/dx[f(g(x))]=f\'(g(x))g\'(x)', 'product: (uv)\'=u\'v+uv\'', 'Leibniz: d/dx[∫ₐ(x)^b(x) f(x,t)dt] = f(x,b)b\'-f(x,a)a\'+∫∂f/∂x dt'],
    weightage: 6, tips: 'Leibniz rule is the #1 GATE calculus trap. Always include the boundary term b\'(x)·f(x,b(x)). Forgetting this is the most common mistake.',
    pyqs: [{ year: 2023, q: 'Evaluate d/dx[∫₀^(x²) e^(-t²)dt] at x=1', a: '2/e ≈ 0.736', exp: 'Apply Leibniz: upper limit b(x)=x², b\'(x)=2x. Result = e^(-(x²)²)·2x. At x=1: 2·e^(-1)=2/e.', m: 2, d: 'hard', s: 'GATE_2023_Q14' }],
  },
  {
    id: 'integration', name: 'Integration',
    def: 'Antiderivative F(x) of f(x) satisfies F\'(x)=f(x). Definite integral = area under curve. IBP, substitution, partial fractions for GATE.',
    prereqs: ['differentiation'], bloom: 'apply', diff: 'intermediate', hours: 4,
    formulas: ['IBP: ∫u dv = uv - ∫v du', 'ILATE order: Inverse>Log>Algebraic>Trig>Exp', '∫eˣ(f+f\')dx = eˣf(x)'],
    weightage: 6, tips: 'ILATE determines u in IBP. ∫eˣ[f(x)+f\'(x)]dx = eˣf(x) is a frequently tested shortcut.',
    pyqs: [],
  },
  {
    id: 'series_sequences', name: 'Series and Sequences',
    def: 'Taylor series: f(x)=Σf⁽ⁿ⁾(a)(x-a)ⁿ/n!. Convergence tests for power series. Maclaurin series for standard functions.',
    prereqs: ['differentiation'], bloom: 'analyze', diff: 'advanced', hours: 3,
    formulas: ['eˣ=1+x+x²/2!+x³/3!+...', 'sinx=x-x³/3!+x⁵/5!-...', 'cosx=1-x²/2!+x⁴/4!-...', 'ln(1+x)=x-x²/2+x³/3-... (|x|<1)'],
    weightage: 4, tips: 'Know all 4 Maclaurin series by heart. Taylor truncation → polynomial approximation. Ratio test for convergence.',
    pyqs: [],
  },
  {
    id: 'multivariable_calculus', name: 'Multivariable Calculus',
    def: 'Partial derivatives, gradient ∇f, divergence ∇·F, curl ∇×F, double/triple integrals, line integrals, Green\'s/Stokes/Gauss theorems.',
    prereqs: ['differentiation', 'integration'], bloom: 'analyze', diff: 'expert', hours: 5,
    formulas: ['grad f = (∂f/∂x, ∂f/∂y, ∂f/∂z)', 'div F = ∂Fₓ/∂x+∂Fᵧ/∂y+∂F_z/∂z', "Green's: ∮Pdx+Qdy = ∬(∂Q/∂x-∂P/∂y)dA", "Stokes: ∮F·dr = ∬(∇×F)·dS"],
    weightage: 7, tips: "Green's theorem converts a line integral to a double integral. Very high GATE frequency! Always check if Green's applies before brute-forcing.",
    pyqs: [],
  },
];

export function seedDefaultPlaybooks(): void {
  const alreadySeeded = localStorage.getItem('eg_playbook_seeded_v1');
  if (alreadySeeded) return;

  const now = new Date().toISOString();

  // ── Seed GATE_EM Linear Algebra subtopics ─────────────────────────────────
  for (const sub of GATE_EM_LINEAR_ALGEBRA_SUBTOPICS) {
    const playbook = createDefaultPlaybook('GATE_EM', 'linear_algebra', sub.id, sub.name);
    playbook.academic.definition = sub.def;
    playbook.academic.prerequisites = sub.prereqs;
    playbook.academic.difficulty = sub.diff;
    playbook.academic.estimatedMasteryHours = sub.hours;
    playbook.academic.bloomsLevel = sub.bloom;
    playbook.academic.crossSubjectConnections = ['quantum mechanics', 'machine learning', 'signal processing'];
    playbook.academic.realWorldApplications = ['PCA in ML', 'vibration analysis', 'quantum state representation'];
    playbook.pedagogy.socraticQuestions = [
      `What is the geometric meaning of an eigenvalue for ${sub.name}?`,
      `How does the determinant tell you whether a system has a unique solution?`,
      `What happens to eigenvalues when you scale the matrix?`,
    ];
    playbook.pedagogy.teachingSequence = [
      'Review matrix basics', `Define ${sub.name}`, 'Work 2×2 example', 'Generalize to n×n', 'Apply to GATE patterns',
    ];
    playbook.pedagogy.commonMisconceptions = [{
      misconception: 'Eigenvalues of A² must be computed fresh by solving det(A²-λI)=0',
      correction: 'No — if λ is an eigenvalue of A, then λ² is an eigenvalue of A². Use this shortcut.',
      frequency: 'very_common',
    }];
    playbook.examIntelligence.weightage = sub.weightage;
    playbook.examIntelligence.highYieldFormulas = sub.formulas;
    playbook.examIntelligence.examSpecificTips = sub.tips;
    playbook.examIntelligence.yearwiseTrend = { '2019': 2, '2020': 2, '2021': 3, '2022': 2, '2023': 3, '2024': 2 };
    playbook.examIntelligence.difficultyCurve = 'balanced';
    playbook.examIntelligence.pyqs = sub.pyqs.map(p => ({
      year: p.year, question: p.q, answer: p.a, explanation: p.exp,
      marks: p.m, difficulty: p.d, source: p.s,
    }));
    playbook.promptIntelligence.bestTemplateKey = 'gate__linear-algebra__analytical__exam_readiness';
    playbook.knowledgeGraph.clusterTag = 'linear_algebra_core';
    playbook.knowledgeGraph.crossExamRelevance = { GATE_EM: 1.0, JEE: 0.7, CAT: 0.2 };
    playbook.contentAtoms.lastGeneratedAt = now;
    savePlaybook(playbook);
  }

  // ── Seed GATE_EM Calculus subtopics ──────────────────────────────────────
  for (const sub of GATE_EM_CALCULUS_SUBTOPICS) {
    const playbook = createDefaultPlaybook('GATE_EM', 'calculus', sub.id, sub.name);
    playbook.academic.definition = sub.def;
    playbook.academic.prerequisites = sub.prereqs;
    playbook.academic.difficulty = sub.diff;
    playbook.academic.estimatedMasteryHours = sub.hours;
    playbook.academic.bloomsLevel = sub.bloom;
    playbook.academic.realWorldApplications = ['physics', 'engineering analysis', 'optimization'];
    playbook.pedagogy.socraticQuestions = [
      `What is the precise definition of the limit for ${sub.name}?`,
      `Where does this concept appear in GATE problems — NAT or MCQ format?`,
      `Can you identify a scenario where the shortcut fails?`,
    ];
    playbook.pedagogy.teachingSequence = [
      'Review prerequisites', `Define ${sub.name}`, 'Worked example', 'GATE-style problems',
    ];
    playbook.examIntelligence.weightage = sub.weightage;
    playbook.examIntelligence.highYieldFormulas = sub.formulas;
    playbook.examIntelligence.examSpecificTips = sub.tips;
    playbook.examIntelligence.yearwiseTrend = { '2019': 2, '2020': 3, '2021': 2, '2022': 3, '2023': 2, '2024': 3 };
    playbook.examIntelligence.pyqs = sub.pyqs.map(p => ({
      year: p.year, question: p.q, answer: p.a, explanation: p.exp,
      marks: p.m, difficulty: p.d, source: p.s,
    }));
    playbook.promptIntelligence.bestTemplateKey = 'gate__calculus__mandatory_baseline';
    playbook.knowledgeGraph.clusterTag = 'calculus_core';
    playbook.knowledgeGraph.crossExamRelevance = { GATE_EM: 1.0, JEE: 0.9, NEET: 0.3 };
    playbook.contentAtoms.lastGeneratedAt = now;
    savePlaybook(playbook);
  }

  // ── Seed skeleton playbooks for all mandatory coverage map entries ──────────
  for (const [examId, topics] of Object.entries(MANDATORY_COVERAGE_MAP)) {
    for (const topic of topics) {
      const existing = getPlaybook(examId, topic.topicId, topic.topicId);
      if (!existing) {
        const playbook = createDefaultPlaybook(examId, topic.topicId, topic.topicId, topic.topicName);
        playbook.academic.difficulty = 'intermediate';
        playbook.examIntelligence.weightage = 5;
        playbook.promptIntelligence.bestTemplateKey =
          `${examId.toLowerCase().split('_')[0]}__${topic.topicId.replace(/_/g, '-')}__mandatory_baseline`;
        playbook.knowledgeGraph.clusterTag = topic.topicId;
        playbook.contentAtoms.lastGeneratedAt = now;
        savePlaybook(playbook);
      }
    }
  }

  localStorage.setItem('eg_playbook_seeded_v1', new Date().toISOString());
}
