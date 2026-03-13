/**
 * mandatoryContentService.ts — Mandatory Baseline Content Engine
 *
 * Ensures that for EVERY (examId, topicId) pair, the following content
 * atoms ALWAYS exist and are delivered to students:
 *
 *   Layer 1 — MANDATORY BASELINE:
 *   • concept_core    — core explanation of the topic
 *   • formula_card    — formulas + definitions
 *   • worked_example  — at least 1 solved problem
 *   • pyq_set         — at least 5 PYQs with solutions
 *   • common_mistakes — top 3 mistake alerts
 *   • exam_tips       — exam-specific weight + strategy
 *
 * Storage (localStorage until Supabase is connected):
 *   eg_mandatory_content_{examId}_{topicId}   → MandatoryContentSpec
 *   eg_mandatory_queue                         → MandatoryGenerationQueue[]
 *   eg_mandatory_generated_{examId}_{topicId} → ContentAtom[]
 */

import type { ContentAtom, ContentAtomType } from './contentFramework';
import type { StaticContentAtom } from './staticContentLibrary';
import {
  getStaticAtomsForTopic,
  getMandatoryAtomsForTopic,
} from './staticContentLibrary';
import { withRateLimit } from './rateLimitService';
import { consumeContentBudget } from './rateLimitService';
import { callLLM } from './llmService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MandatoryAtomFlags {
  concept_core: boolean;
  formula_card: boolean;
  worked_example: boolean;
  pyq_set: boolean;
  common_mistakes: boolean;
  exam_tips: boolean;
}

export interface MandatoryContentSpec {
  examId: string;
  topicId: string;
  topicName: string;
  atoms: MandatoryAtomFlags;
  completeness: number;       // 0-100, % of mandatory atoms present
  missingAtoms: string[];     // which atom types are missing
  lastAuditedAt: string;      // ISO timestamp
}

export interface MandatoryGenerationQueue {
  examId: string;
  topicId: string;
  atomType: string;
  priority: 'critical' | 'high' | 'normal';
  scheduledAt: string;
  reason: string;
}

// ─── Coverage Map ─────────────────────────────────────────────────────────────

/**
 * The mandatory topic coverage map.
 * Every exam → topic listed here must have all 6 mandatory atoms.
 */
export const MANDATORY_COVERAGE_MAP: Record<string, { topicId: string; topicName: string }[]> = {
  GATE_EM: [
    { topicId: 'linear_algebra',         topicName: 'Linear Algebra' },
    { topicId: 'calculus',               topicName: 'Calculus' },
    { topicId: 'probability',            topicName: 'Probability & Statistics' },
    { topicId: 'differential_equations', topicName: 'Differential Equations' },
    { topicId: 'transform_theory',       topicName: 'Transform Theory' },
    { topicId: 'complex_variables',      topicName: 'Complex Variables' },
    { topicId: 'numerical_methods',      topicName: 'Numerical Methods' },
  ],
  JEE: [
    { topicId: 'mechanics',           topicName: 'Mechanics' },
    { topicId: 'electrostatics',      topicName: 'Electrostatics' },
    { topicId: 'waves',               topicName: 'Waves & Oscillations' },
    { topicId: 'organic_chemistry',   topicName: 'Organic Chemistry' },
    { topicId: 'calculus',            topicName: 'Calculus' },
    { topicId: 'coordinate_geometry', topicName: 'Coordinate Geometry' },
  ],
  NEET: [
    { topicId: 'human_physiology',  topicName: 'Human Physiology' },
    { topicId: 'cell_biology',      topicName: 'Cell Biology' },
    { topicId: 'genetics',          topicName: 'Genetics' },
    { topicId: 'ecology',           topicName: 'Ecology' },
    { topicId: 'organic_chemistry', topicName: 'Organic Chemistry' },
  ],
  CAT: [
    { topicId: 'arithmetic',              topicName: 'Arithmetic' },
    { topicId: 'algebra',                 topicName: 'Algebra' },
    { topicId: 'geometry',                topicName: 'Geometry' },
    { topicId: 'data_interpretation',     topicName: 'Data Interpretation' },
    { topicId: 'reading_comprehension',   topicName: 'Reading Comprehension' },
    { topicId: 'logical_reasoning',       topicName: 'Logical Reasoning' },
  ],
  UPSC: [
    { topicId: 'modern_history', topicName: 'Modern History' },
    { topicId: 'polity',         topicName: 'Indian Polity' },
    { topicId: 'geography',      topicName: 'Geography' },
    { topicId: 'economy',        topicName: 'Indian Economy' },
    { topicId: 'environment',    topicName: 'Environment & Ecology' },
  ],
};

// All mandatory atom type keys
const MANDATORY_ATOM_TYPES: (keyof MandatoryAtomFlags)[] = [
  'concept_core',
  'formula_card',
  'worked_example',
  'pyq_set',
  'common_mistakes',
  'exam_tips',
];

// ─── localStorage helpers ─────────────────────────────────────────────────────

function storageKey(prefix: string, examId: string, topicId: string): string {
  return `${prefix}_${examId.toUpperCase()}_${topicId.toLowerCase()}`;
}

function readSpec(examId: string, topicId: string): MandatoryContentSpec | null {
  try {
    const raw = localStorage.getItem(storageKey('eg_mandatory_content', examId, topicId));
    return raw ? (JSON.parse(raw) as MandatoryContentSpec) : null;
  } catch {
    return null;
  }
}

function writeSpec(spec: MandatoryContentSpec): void {
  try {
    localStorage.setItem(
      storageKey('eg_mandatory_content', spec.examId, spec.topicId),
      JSON.stringify(spec),
    );
  } catch { /* quota exceeded */ }
}

function readGeneratedAtoms(examId: string, topicId: string): ContentAtom[] {
  try {
    const raw = localStorage.getItem(storageKey('eg_mandatory_generated', examId, topicId));
    return raw ? (JSON.parse(raw) as ContentAtom[]) : [];
  } catch {
    return [];
  }
}

function writeGeneratedAtoms(examId: string, topicId: string, atoms: ContentAtom[]): void {
  try {
    localStorage.setItem(
      storageKey('eg_mandatory_generated', examId, topicId),
      JSON.stringify(atoms),
    );
  } catch { /* quota exceeded */ }
}

function readQueue(): MandatoryGenerationQueue[] {
  try {
    const raw = localStorage.getItem('eg_mandatory_queue');
    return raw ? (JSON.parse(raw) as MandatoryGenerationQueue[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: MandatoryGenerationQueue[]): void {
  try {
    localStorage.setItem('eg_mandatory_queue', JSON.stringify(queue));
  } catch { /* quota exceeded */ }
}

// ─── Supabase detection ───────────────────────────────────────────────────────

/**
 * Returns true when Supabase is connected and available.
 * When true, data should be read/written via Supabase tables instead of localStorage.
 */
export function isSupabaseAvailable(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  return typeof url === 'string' && url.length > 0;
}

// ─── Static atom → ContentAtom bridge ────────────────────────────────────────

const STATIC_FORMAT_TO_MANDATORY_TYPE: Record<string, keyof MandatoryAtomFlags> = {
  explanation:    'concept_core',
  formula_sheet:  'formula_card',
  worked_example: 'worked_example',
  revision_card:  'exam_tips',
};

function staticAtomToContentAtom(atom: StaticContentAtom): ContentAtom {
  const atomTypeMap: Record<string, ContentAtomType> = {
    explanation:    'lesson_block',
    formula_sheet:  'formula_card',
    worked_example: 'worked_example',
    revision_card:  'exam_tip',
  };
  return {
    id: atom.id,
    type: atomTypeMap[atom.format] ?? 'lesson_block',
    title: atom.topicName,
    body: atom.content.slice(0, 600),
    bodyMarkdown: atom.content,
    examId: atom.examId,
    topic: atom.topicName,
    difficulty: atom.difficulty,
    syllabusPriority: 'high',
    quality: {
      accuracy: 0.95,
      clarity: 0.9,
      examRelevance: 0.95,
      engagementScore: 0,
      wolframVerified: false,
      reviewedByHuman: true,
    },
    generatedBy: 'atlas',
    generatedAt: new Date('2025-01-01'),
    sourceType: 'manual',
    version: 1,
    timesServed: 0,
    avgRating: 0,
    completionRate: 0,
  };
}

// ─── Audit Logic ──────────────────────────────────────────────────────────────

/**
 * Determines which mandatory atom types are present for the given exam+topic,
 * by checking the static library AND any previously generated/cached atoms.
 */
function detectPresentAtoms(examId: string, topicId: string): MandatoryAtomFlags {
  const flags: MandatoryAtomFlags = {
    concept_core:    false,
    formula_card:    false,
    worked_example:  false,
    pyq_set:         false,
    common_mistakes: false,
    exam_tips:       false,
  };

  // Check static library (mandatory atom types)
  const staticMandatory = getMandatoryAtomsForTopic(examId, topicId);
  for (const atom of staticMandatory) {
    const mappedType = STATIC_FORMAT_TO_MANDATORY_TYPE[atom.format];
    if (mappedType) flags[mappedType] = true;
  }

  // Also check general static atoms (broader coverage)
  const staticAtoms = getStaticAtomsForTopic(examId, topicId);
  for (const atom of staticAtoms) {
    if (atom.format === 'explanation')    flags.concept_core    = true;
    if (atom.format === 'formula_sheet')  flags.formula_card    = true;
    if (atom.format === 'worked_example') flags.worked_example  = true;
    if (atom.format === 'revision_card')  flags.exam_tips       = true;
  }

  // Check previously generated atoms
  const generated = readGeneratedAtoms(examId, topicId);
  for (const atom of generated) {
    if (atom.type === 'lesson_block')   flags.concept_core    = true;
    if (atom.type === 'formula_card')   flags.formula_card    = true;
    if (atom.type === 'worked_example') flags.worked_example  = true;
    if (atom.type === 'mcq')            flags.pyq_set         = true;
    if (atom.type === 'exam_tip')       flags.exam_tips       = true;
    if (atom.type === 'misconception')  flags.common_mistakes = true;
    // Also check by id suffix
    if (atom.id.includes('common_mistakes')) flags.common_mistakes = true;
    if (atom.id.includes('exam_tips'))       flags.exam_tips       = true;
  }

  return flags;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Audit mandatory content for a given exam+topic pair.
 * Checks static library + cached generations.
 * Caches the audit result in localStorage (valid for 1 hour).
 */
export function auditMandatoryContent(examId: string, topicId: string): MandatoryContentSpec {
  // Return cached spec if fresh (< 1 hour)
  const cached = readSpec(examId, topicId);
  if (cached) {
    const cacheAge = Date.now() - new Date(cached.lastAuditedAt).getTime();
    if (cacheAge < 3_600_000) return cached;
  }

  // Determine topic name
  const coverageList = MANDATORY_COVERAGE_MAP[examId.toUpperCase()] ?? [];
  const coverageTopic = coverageList.find(t => t.topicId === topicId);
  const topicName = coverageTopic?.topicName ?? topicId;

  const flags = detectPresentAtoms(examId, topicId);
  const missingAtoms = MANDATORY_ATOM_TYPES.filter(k => !flags[k]);
  const completeness = Math.round(
    ((MANDATORY_ATOM_TYPES.length - missingAtoms.length) / MANDATORY_ATOM_TYPES.length) * 100,
  );

  const spec: MandatoryContentSpec = {
    examId,
    topicId,
    topicName,
    atoms: flags,
    completeness,
    missingAtoms,
    lastAuditedAt: new Date().toISOString(),
  };

  writeSpec(spec);
  return spec;
}

/**
 * Returns all mandatory atoms (from static library + cached generation)
 * for the given exam + topic pair.
 */
export function getMandatoryAtoms(examId: string, topicId: string): StaticContentAtom[] {
  return getMandatoryAtomsForTopic(examId, topicId);
}

/**
 * Returns mandatory atoms as ContentAtom[] — the format used by the
 * presentation layer. Includes both static and generated atoms.
 */
export function getMandatoryLayer(examId: string, topicId: string): ContentAtom[] {
  const staticAtoms = getStaticAtomsForTopic(examId, topicId).map(staticAtomToContentAtom);
  const generatedAtoms = readGeneratedAtoms(examId, topicId);

  // Merge: static atoms first (highest trust), then generated
  const seen = new Set<string>();
  const merged: ContentAtom[] = [];

  for (const a of [...staticAtoms, ...generatedAtoms]) {
    if (!seen.has(a.id)) {
      seen.add(a.id);
      merged.push(a);
    }
  }

  return merged;
}

/**
 * Adds missing mandatory atoms to the generation queue (localStorage).
 * Returns the newly queued items.
 */
export function queueMissingMandatory(
  examId: string,
  topicId: string,
): MandatoryGenerationQueue[] {
  const spec = auditMandatoryContent(examId, topicId);
  if (spec.missingAtoms.length === 0) return [];

  const existing = readQueue();
  const existingKeys = new Set(
    existing.map(q => `${q.examId}_${q.topicId}_${q.atomType}`),
  );

  const newItems: MandatoryGenerationQueue[] = [];

  for (const atomType of spec.missingAtoms) {
    const key = `${examId}_${topicId}_${atomType}`;
    if (existingKeys.has(key)) continue;

    const priority: MandatoryGenerationQueue['priority'] =
      atomType === 'concept_core' ? 'critical'
      : atomType === 'formula_card' ? 'critical'
      : atomType === 'pyq_set' ? 'high'
      : 'normal';

    newItems.push({
      examId,
      topicId,
      atomType,
      priority,
      scheduledAt: new Date().toISOString(),
      reason: `Missing mandatory atom: ${atomType} for ${examId}/${topicId}`,
    });
  }

  if (newItems.length > 0) {
    writeQueue([...existing, ...newItems]);
  }

  return newItems;
}

/**
 * Processes the mandatory generation queue.
 * Generates missing atoms via LLM (T2), respects rate limiter.
 * @param maxItems Maximum items to process in this call (default: 3)
 */
export async function processMandatoryQueue(maxItems = 3): Promise<void> {
  const queue = readQueue();
  if (queue.length === 0) return;

  // Sort by priority: critical → high → normal
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, normal: 2 };
  const sorted = [...queue].sort(
    (a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2),
  );

  const toProcess = sorted.slice(0, maxItems);
  const remainingQueue = queue.filter(
    q => !toProcess.some(
      p => p.examId === q.examId && p.topicId === q.topicId && p.atomType === q.atomType,
    ),
  );

  for (const item of toProcess) {
    // Check content budget before generating
    const budgetOk = consumeContentBudget('mandatory');
    if (!budgetOk) {
      // Budget exhausted — stop processing
      break;
    }

    try {
      const atom = await withRateLimit('llm', () =>
        generateMandatoryAtom(item.examId, item.topicId, item.atomType),
      );

      if (atom) {
        const existing = readGeneratedAtoms(item.examId, item.topicId);
        writeGeneratedAtoms(item.examId, item.topicId, [...existing, atom]);
        // Invalidate audit cache
        const staleSpec = readSpec(item.examId, item.topicId);
        if (staleSpec) {
          writeSpec({ ...staleSpec, lastAuditedAt: new Date(0).toISOString() });
        }
      }
    } catch {
      // Rate limit or LLM error — put back at end of queue
      remainingQueue.push({ ...item, scheduledAt: new Date().toISOString() });
    }
  }

  writeQueue(remainingQueue);
}

/**
 * Returns a completeness percentage per exam.
 * Key: examId, Value: 0-100 (average completeness across all mandatory topics).
 */
export function getMandatoryCompleteness(): Record<string, number> {
  const result: Record<string, number> = {};

  for (const [examId, topics] of Object.entries(MANDATORY_COVERAGE_MAP)) {
    if (topics.length === 0) {
      result[examId] = 0;
      continue;
    }
    const totalCompleteness = topics.reduce((sum, t) => {
      const spec = auditMandatoryContent(examId, t.topicId);
      return sum + spec.completeness;
    }, 0);
    result[examId] = Math.round(totalCompleteness / topics.length);
  }

  return result;
}

// ─── LLM generation helper ────────────────────────────────────────────────────

async function generateMandatoryAtom(
  examId: string,
  topicId: string,
  atomType: string,
): Promise<ContentAtom | null> {
  const topicInfo = MANDATORY_COVERAGE_MAP[examId.toUpperCase()]
    ?.find(t => t.topicId === topicId);
  const topicName = topicInfo?.topicName ?? topicId;

  const prompts: Record<string, string> = {
    concept_core: `Generate a comprehensive concept explanation for "${topicName}" for ${examId} students.
Cover: what it is, why it matters, core principle, intuition. 300-400 words. Exam-focused.
Return JSON: { "title": "...", "content": "full markdown explanation" }`,

    formula_card: `Generate a complete formula card for "${topicName}" for ${examId} students.
Include ALL key formulas, variable definitions, units, and conditions. Exam-relevant.
Return JSON: { "title": "Formula Card: ${topicName}", "content": "markdown with formulas" }`,

    worked_example: `Generate 1 fully worked example problem for "${topicName}" for ${examId} exam.
Show every step. Label approach. Include verification. Past-exam style difficulty.
Return JSON: { "title": "Worked Example: ${topicName}", "content": "full step-by-step solution" }`,

    pyq_set: `Generate 5 Previous Year Question (PYQ)-style problems for "${topicName}" (${examId}).
Each with: question, 4 options (A/B/C/D), correct answer, full explanation.
Return JSON: { "title": "PYQ Set: ${topicName}", "content": "5 questions with solutions" }`,

    common_mistakes: `List the top 3 common mistakes students make on "${topicName}" in ${examId} exam.
For each: what the mistake is, why it happens, how to avoid it. Exam-specific.
Return JSON: { "title": "Common Mistakes: ${topicName}", "content": "markdown list of 3 mistakes" }`,

    exam_tips: `Generate exam-specific tips for "${topicName}" in ${examId} exam.
Include: topic weight, question patterns, time strategy, must-know shortcuts.
Return JSON: { "title": "Exam Tips: ${topicName}", "content": "markdown tips for ${examId}" }`,
  };

  const prompt = prompts[atomType];
  if (!prompt) return null;

  try {
    const result = await callLLM({ agent: 'atlas', message: prompt });
    const raw = result?.text ?? '';

    // Extract JSON
    let jsonStr = raw.trim();
    const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) jsonStr = fence[1].trim();
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    if (start === -1 || end === -1) return null;

    const parsed = JSON.parse(jsonStr.slice(start, end + 1)) as {
      title: string;
      content: string;
    };

    const atomTypeMap: Record<string, ContentAtomType> = {
      concept_core:    'lesson_block',
      formula_card:    'formula_card',
      worked_example:  'worked_example',
      pyq_set:         'mcq',
      common_mistakes: 'misconception',
      exam_tips:       'exam_tip',
    };

    return {
      id: `mandatory_${examId}_${topicId}_${atomType}_${Date.now()}`,
      type: atomTypeMap[atomType] ?? 'lesson_block',
      title: parsed.title,
      body: parsed.content.slice(0, 600),
      bodyMarkdown: parsed.content,
      examId,
      topic: topicName,
      difficulty: 'medium',
      syllabusPriority: 'high',
      quality: {
        accuracy: 0.85,
        clarity: 0.85,
        examRelevance: 0.9,
        engagementScore: 0,
        wolframVerified: false,
        reviewedByHuman: false,
      },
      generatedBy: 'atlas',
      generatedAt: new Date(),
      sourceType: 'llm',
      version: 1,
      timesServed: 0,
      avgRating: 0,
      completionRate: 0,
    };
  } catch {
    return null;
  }
}

/**
 * Get the static library coverage completeness for a specific topic.
 * Checks how much of the mandatory baseline is present in the static library.
 */
export function getStaticTopicCompleteness(
  examId: string,
  topicId: string,
): { complete: boolean; missing: string[]; coverage: number } {
  const staticAtoms = getMandatoryAtomsForTopic(examId, topicId);
  const availableFormats = new Set(staticAtoms.map(a => a.format));

  const mandatoryFormats = ['explanation', 'formula_sheet', 'worked_example', 'revision_card'] as const;
  const missingFormats = mandatoryFormats.filter(f => !availableFormats.has(f));
  const coverage = Math.round(
    ((mandatoryFormats.length - missingFormats.length) / mandatoryFormats.length) * 100,
  );

  const formatLabels: Record<string, string> = {
    explanation:    'concept_core',
    formula_sheet:  'formula_card',
    worked_example: 'worked_example',
    revision_card:  'exam_tips',
  };

  return {
    complete: missingFormats.length === 0,
    missing: missingFormats.map(f => formatLabels[f] ?? f),
    coverage,
  };
}
