/**
 * courseMaterialGenerator.ts — Bible-Driven Course Material Generator
 *
 * Takes a CourseMaterialRequest and returns fully-assembled CourseMaterial
 * by reading from the SubTopic Bible. Supports predefined templates AND
 * personalized user requests.
 *
 * Architecture:
 *   1. Read SubTopicBible for each subtopicId
 *   2. Auto-resolve PersonalizationConfig from student profile + bible
 *   3. Assemble mandatory sections first (Layer 1), then personalized (Layer 2)
 *   4. Apply template filter (quick_revision → formula+pyq+exam_tips)
 *   5. Apply customRequest overrides
 *   6. Tag each section with bibleSource + personalizationApplied
 *   7. Record generation event back to bible
 */

import {
  getBibleOrCreate,
  getBibleCompleteness,
  getBibleHealthScore,
  updateFromAtlasGeneration,
  type SubTopicBible,
} from './subTopicBibleService';
import { loadPersona } from './studentPersonaEngine';
import { buildLearnerProfile } from './courseOrchestrator';
import {
  type LearningStyle,
  type CognitiveTier,
  type ContentPersonaFormat,
} from './contentPersonaEngine';
import type { PersonaContext } from './contentPersonaEngine';
import { MANDATORY_COVERAGE_MAP } from './mandatoryContentService';

// ─── Template Types ───────────────────────────────────────────────────────────

export type CourseTemplate =
  | 'exam_cracker'      // PYQs + traps + formula flash — exam-day ready
  | 'concept_builder'   // concept core → worked examples → exercises
  | 'quick_revision'    // 10-min compact refresh
  | 'visual_deep_dive'  // visual explanations + ASCII diagrams + analogies
  | 'socratic_journey'  // question → probe → reveal — Sage-style
  | 'topper_strategy'   // edge cases + advanced applications
  | 'parent_brief'      // plain-English for parents
  | 'teacher_kit'       // lesson plan + pedagogy notes + classroom exercises
  | 'custom';           // user-driven free-form request

// ─── Config ───────────────────────────────────────────────────────────────────

export interface PersonalizationConfig {
  // Learner identity (read from existing services + bible)
  learningStyle?: LearningStyle;
  cognitiveTier?: CognitiveTier;
  cognitiveLoad?: 'low' | 'medium' | 'high' | 'overloaded';
  role?: string;
  emotionalState?: string;
  streakDays?: number;
  studyTimePattern?: string;

  // Exam & topic (read from bible)
  examId: string;
  topicId: string;
  subtopicIds: string[];        // which subtopics to cover
  daysToExam?: number;
  topicMasteryPct?: number;

  // Content preferences (read from bible.studentPreferences)
  preferredFormat?: ContentPersonaFormat;
  sessionLengthMinutes?: number;  // 5 | 10 | 15 | 30 | 60
  preferredDifficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  includeAnalogies?: boolean;
  includeSocraticQuestions?: boolean;
  includePYQs?: boolean;
  includeFormulas?: boolean;
  includeCommonMistakes?: boolean;
  includeExamTips?: boolean;

  // Personalized user request (free-form)
  customRequest?: string;       // "Explain like a story", "5-min revision"
  focusAreas?: string[];        // specific subtopics to emphasize
  avoidTopics?: string[];       // subtopics to skip (already mastered)
}

// ─── Section Types ────────────────────────────────────────────────────────────

export type CourseSectionType =
  | 'concept'
  | 'formula'
  | 'example'
  | 'pyq'
  | 'analogy'
  | 'socratic'
  | 'misconception'
  | 'exam_tip'
  | 'summary'
  | 'exercise'
  | 'teacher_note'
  | 'parent_note';

export interface CourseSection {
  id: string;
  type: CourseSectionType;
  title: string;
  content: string;
  bibleSource: string;              // which bible field this came from
  personalizationApplied: string[]; // which variables shaped this section
  estimatedMinutes: number;
  layer: 'mandatory' | 'personalized';
  subtopicId: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface CourseMaterial {
  id: string;
  title: string;
  subtitle: string;
  template: CourseTemplate;
  examId: string;
  subtopicsCovered: string[];
  estimatedTotalMinutes: number;
  personalizationSummary: string; // e.g. "Visual learner, T-2, quick revision"
  sections: CourseSection[];

  // Traceability
  biblesRead: string[];                       // bible IDs consulted
  personalizationVariables: Record<string, string>; // all vars used
  agentsInvolved: string[];                   // atlas, sage, oracle, etc.
  generationTrace: {
    templateUsed: string;
    templateKeyResolved?: string;
    mandatoryAtomsFulfilled: string[];
    personalizedSectionsAdded: number;
    bibleHealthAtGeneration: number;          // avg bible completeness
  };

  generatedAt: string;
  version: number;
}

// ─── Template Configs ─────────────────────────────────────────────────────────

export const TEMPLATE_CONFIGS: Record<CourseTemplate, Partial<PersonalizationConfig>> = {
  exam_cracker: {
    includePYQs: true,
    includeFormulas: true,
    includeExamTips: true,
    includeCommonMistakes: true,
    includeAnalogies: false,
    includeSocraticQuestions: false,
    preferredFormat: 'cheatsheet',
    preferredDifficulty: 'hard',
    sessionLengthMinutes: 30,
  },
  concept_builder: {
    includeFormulas: true,
    includeAnalogies: true,
    includeSocraticQuestions: true,
    includePYQs: true,
    includeCommonMistakes: true,
    includeExamTips: true,
    preferredFormat: 'lesson_notes',
    preferredDifficulty: 'medium',
    sessionLengthMinutes: 60,
  },
  quick_revision: {
    includeFormulas: true,
    includePYQs: true,
    includeExamTips: true,
    includeAnalogies: false,
    includeSocraticQuestions: false,
    includeCommonMistakes: true,
    preferredFormat: 'cheatsheet',
    preferredDifficulty: 'mixed',
    sessionLengthMinutes: 10,
  },
  visual_deep_dive: {
    includeAnalogies: true,
    includeSocraticQuestions: true,
    includeFormulas: true,
    includePYQs: false,
    includeExamTips: true,
    preferredFormat: 'visual_diagram_text',
    preferredDifficulty: 'medium',
    sessionLengthMinutes: 30,
    learningStyle: 'visual',
  },
  socratic_journey: {
    includeSocraticQuestions: true,
    includeAnalogies: true,
    includeFormulas: true,
    includePYQs: false,
    includeCommonMistakes: true,
    preferredFormat: 'lesson_notes',
    preferredDifficulty: 'mixed',
    sessionLengthMinutes: 45,
  },
  topper_strategy: {
    includeFormulas: true,
    includePYQs: true,
    includeExamTips: true,
    includeCommonMistakes: true,
    includeSocraticQuestions: true,
    includeAnalogies: false,
    preferredFormat: 'worked_example',
    preferredDifficulty: 'hard',
    sessionLengthMinutes: 60,
    cognitiveTier: 'advanced',
  },
  parent_brief: {
    includeAnalogies: true,
    includeFormulas: false,
    includePYQs: false,
    includeExamTips: false,
    includeSocraticQuestions: false,
    includeCommonMistakes: false,
    preferredFormat: 'analogy_explainer',
    preferredDifficulty: 'easy',
    sessionLengthMinutes: 10,
    role: 'parent',
  },
  teacher_kit: {
    includeSocraticQuestions: true,
    includeFormulas: true,
    includePYQs: true,
    includeCommonMistakes: true,
    includeExamTips: true,
    includeAnalogies: true,
    preferredFormat: 'lesson_notes',
    preferredDifficulty: 'mixed',
    sessionLengthMinutes: 60,
    role: 'teacher',
  },
  custom: {
    // All flags default to true for custom
    includeFormulas: true,
    includePYQs: true,
    includeExamTips: true,
    includeAnalogies: true,
    includeSocraticQuestions: true,
    includeCommonMistakes: true,
    preferredDifficulty: 'mixed',
    sessionLengthMinutes: 30,
  },
};

// ─── Template Section Filters ─────────────────────────────────────────────────

/** Which section types each template includes */
const TEMPLATE_SECTION_FILTERS: Record<CourseTemplate, CourseSectionType[]> = {
  exam_cracker:    ['formula', 'pyq', 'exam_tip', 'misconception'],
  concept_builder: ['concept', 'formula', 'example', 'analogy', 'socratic', 'misconception', 'exam_tip', 'exercise'],
  quick_revision:  ['formula', 'pyq', 'exam_tip', 'misconception', 'summary'],
  visual_deep_dive:['concept', 'analogy', 'formula', 'example', 'exam_tip'],
  socratic_journey:['concept', 'socratic', 'analogy', 'example', 'formula'],
  topper_strategy: ['formula', 'pyq', 'example', 'exam_tip', 'misconception', 'exercise'],
  parent_brief:    ['concept', 'analogy', 'parent_note'],
  teacher_kit:     ['concept', 'formula', 'example', 'socratic', 'misconception', 'teacher_note', 'exercise'],
  custom:          ['concept', 'formula', 'example', 'pyq', 'analogy', 'socratic', 'misconception', 'exam_tip', 'summary', 'exercise'],
};

// ─── Section Time Estimates ───────────────────────────────────────────────────

const SECTION_TIME_MINUTES: Record<CourseSectionType, number> = {
  concept:       5,
  formula:       2,
  example:       4,
  pyq:           3,
  analogy:       3,
  socratic:      4,
  misconception: 2,
  exam_tip:      2,
  summary:       2,
  exercise:      5,
  teacher_note:  3,
  parent_note:   2,
};

// ─── Section Builders ─────────────────────────────────────────────────────────

function buildConceptSection(
  bible: SubTopicBible,
  config: PersonalizationConfig,
  sectionIdx: number,
): CourseSection | null {
  if (!bible.academic.definition) return null;

  const personalizationApplied: string[] = ['academic.definition'];
  let content = `**${bible.subtopicName}**\n\n${bible.academic.definition}`;

  // Add real-world applications based on role
  if (config.role === 'teacher') {
    if (bible.academic.realWorldApplications.length > 0) {
      content += `\n\n**Real-World Applications:**\n${bible.academic.realWorldApplications.map(a => `• ${a}`).join('\n')}`;
      personalizationApplied.push('academic.realWorldApplications');
    }
  }

  // Add cross-subject connections for advanced tier
  if (config.cognitiveTier === 'advanced' && bible.academic.crossSubjectConnections.length > 0) {
    content += `\n\n**Cross-Subject Connections:**\n${bible.academic.crossSubjectConnections.map(c => `• ${c}`).join('\n')}`;
    personalizationApplied.push('academic.crossSubjectConnections');
  }

  // Add prerequisites
  if (bible.academic.prerequisites.length > 0) {
    content += `\n\n**Prerequisites:** ${bible.academic.prerequisites.join(', ')}`;
    personalizationApplied.push('academic.prerequisites');
  }

  // Teaching sequence
  if (bible.pedagogy.teachingSequence.length > 0) {
    content += `\n\n**Learning Sequence:**\n${bible.pedagogy.teachingSequence.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
    personalizationApplied.push('pedagogy.teachingSequence');
  }

  return {
    id: `section-${bible.subtopicId}-concept-${sectionIdx}`,
    type: 'concept',
    title: `Core Concept: ${bible.subtopicName}`,
    content,
    bibleSource: 'academic.definition + pedagogy.teachingSequence',
    personalizationApplied,
    estimatedMinutes: SECTION_TIME_MINUTES.concept,
    layer: 'mandatory',
    subtopicId: bible.subtopicId,
  };
}

function buildFormulaSection(
  bible: SubTopicBible,
  config: PersonalizationConfig,
  sectionIdx: number,
): CourseSection | null {
  const formulas = bible.examIntelligence.highYieldFormulas;
  if (formulas.length === 0) return null;

  const personalizationApplied: string[] = ['examIntelligence.highYieldFormulas'];

  let content = `**High-Yield Formulas for ${bible.examId}:**\n\n`;

  // Limit formulas based on session length
  const maxFormulas = config.sessionLengthMinutes !== undefined && config.sessionLengthMinutes <= 10
    ? 3
    : formulas.length;

  content += formulas.slice(0, maxFormulas).map((f, i) => `${i + 1}. \`${f}\``).join('\n');

  // Add exam tips inline if short session
  if (bible.examIntelligence.examSpecificTips) {
    content += `\n\n**Exam Strategy:** ${bible.examIntelligence.examSpecificTips}`;
    personalizationApplied.push('examIntelligence.examSpecificTips');
  }

  // Trap topics for advanced learners
  if (
    (config.cognitiveTier === 'advanced' || config.cognitiveTier === 'proficient') &&
    bible.examIntelligence.trapTopics.length > 0
  ) {
    content += `\n\n**⚠️ Trap Topics:** ${bible.examIntelligence.trapTopics.join(', ')}`;
    personalizationApplied.push('examIntelligence.trapTopics', 'cognitiveTier');
  }

  return {
    id: `section-${bible.subtopicId}-formula-${sectionIdx}`,
    type: 'formula',
    title: `Formula Card: ${bible.subtopicName}`,
    content,
    bibleSource: 'examIntelligence.highYieldFormulas',
    personalizationApplied,
    estimatedMinutes: SECTION_TIME_MINUTES.formula,
    layer: 'mandatory',
    subtopicId: bible.subtopicId,
  };
}

function buildPYQSection(
  bible: SubTopicBible,
  config: PersonalizationConfig,
  sectionIdx: number,
): CourseSection | null {
  const pyqs = bible.examIntelligence.pyqs;
  if (pyqs.length === 0) return null;

  const personalizationApplied: string[] = ['examIntelligence.pyqs'];

  // Filter by difficulty based on config
  let filteredPYQs = pyqs;
  if (config.preferredDifficulty && config.preferredDifficulty !== 'mixed') {
    filteredPYQs = pyqs.filter(p => p.difficulty === config.preferredDifficulty);
    if (filteredPYQs.length === 0) filteredPYQs = pyqs; // fallback to all
    personalizationApplied.push('preferredDifficulty');
  }

  // Limit based on session length
  const maxPYQs = config.sessionLengthMinutes !== undefined && config.sessionLengthMinutes <= 10
    ? 2
    : config.sessionLengthMinutes !== undefined && config.sessionLengthMinutes <= 30
    ? Math.min(3, filteredPYQs.length)
    : filteredPYQs.length;

  const selected = filteredPYQs.slice(0, maxPYQs);

  let content = `**Previous Year Questions — ${bible.subtopicName}:**\n\n`;
  content += selected.map((pyq, i) => [
    `**Q${i + 1} (${pyq.year}) [${pyq.difficulty}] — ${pyq.marks} marks**`,
    pyq.question,
    `*Answer:* ${pyq.answer}`,
    `*Explanation:* ${pyq.explanation}`,
    pyq.trap ? `*⚠️ Trap:* ${pyq.trap}` : '',
  ].filter(Boolean).join('\n')).join('\n\n---\n\n');

  return {
    id: `section-${bible.subtopicId}-pyq-${sectionIdx}`,
    type: 'pyq',
    title: `PYQ Set: ${bible.subtopicName} (${selected.length} questions)`,
    content,
    bibleSource: 'examIntelligence.pyqs',
    personalizationApplied,
    estimatedMinutes: Math.ceil(selected.length * SECTION_TIME_MINUTES.pyq),
    layer: 'mandatory',
    subtopicId: bible.subtopicId,
  };
}

function buildMisconceptionSection(
  bible: SubTopicBible,
  _config: PersonalizationConfig,
  sectionIdx: number,
): CourseSection | null {
  if (bible.pedagogy.commonMisconceptions.length === 0) return null;

  const content = `**Common Mistakes in ${bible.subtopicName}:**\n\n` +
    bible.pedagogy.commonMisconceptions.slice(0, 3).map((m, i) => [
      `**Mistake ${i + 1} [${m.frequency}]:**`,
      `❌ *What students think:* ${m.misconception}`,
      `✅ *Correction:* ${m.correction}`,
    ].join('\n')).join('\n\n');

  return {
    id: `section-${bible.subtopicId}-misconception-${sectionIdx}`,
    type: 'misconception',
    title: `Common Mistakes: ${bible.subtopicName}`,
    content,
    bibleSource: 'pedagogy.commonMisconceptions',
    personalizationApplied: ['pedagogy.commonMisconceptions'],
    estimatedMinutes: SECTION_TIME_MINUTES.misconception,
    layer: 'mandatory',
    subtopicId: bible.subtopicId,
  };
}

function buildExamTipSection(
  bible: SubTopicBible,
  config: PersonalizationConfig,
  sectionIdx: number,
): CourseSection | null {
  if (!bible.examIntelligence.examSpecificTips && bible.examIntelligence.trapTopics.length === 0) {
    return null;
  }

  const personalizationApplied: string[] = ['examIntelligence.examSpecificTips'];
  let content = '';

  // Weight info
  if (bible.examIntelligence.weightage > 0) {
    content += `**📊 Exam Weight:** ${bible.examIntelligence.weightage}% of ${bible.examId} marks\n\n`;
    personalizationApplied.push('examIntelligence.weightage');
  }

  if (bible.examIntelligence.examSpecificTips) {
    content += `**💡 Exam Strategy:**\n${bible.examIntelligence.examSpecificTips}\n\n`;
  }

  // Year-wise trend
  const trends = bible.examIntelligence.yearwiseTrend;
  if (Object.keys(trends).length > 0) {
    const trendStr = Object.entries(trends)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([y, q]) => `${y}: ${q}Q`)
      .join(' | ');
    content += `**📈 Year-wise Frequency:** ${trendStr}\n\n`;
    personalizationApplied.push('examIntelligence.yearwiseTrend');
  }

  // Trap topics
  if (bible.examIntelligence.trapTopics.length > 0) {
    content += `**⚠️ Trap Topics to Watch:**\n${bible.examIntelligence.trapTopics.map(t => `• ${t}`).join('\n')}`;
    personalizationApplied.push('examIntelligence.trapTopics');
  }

  // Days-to-exam urgency
  if (config.daysToExam !== undefined && config.daysToExam <= 7) {
    content += `\n\n**🚨 EXAM IN ${config.daysToExam} DAYS:** Focus only on high-yield formulas and trap patterns above.`;
    personalizationApplied.push('daysToExam');
  }

  return {
    id: `section-${bible.subtopicId}-examtip-${sectionIdx}`,
    type: 'exam_tip',
    title: `Exam Tips: ${bible.subtopicName}`,
    content,
    bibleSource: 'examIntelligence.examSpecificTips + examIntelligence.trapTopics',
    personalizationApplied,
    estimatedMinutes: SECTION_TIME_MINUTES.exam_tip,
    layer: 'mandatory',
    subtopicId: bible.subtopicId,
  };
}

function buildAnalogySection(
  bible: SubTopicBible,
  config: PersonalizationConfig,
  sectionIdx: number,
): CourseSection | null {
  if (bible.pedagogy.effectiveAnalogies.length === 0) return null;

  const learningStyle = config.learningStyle ?? 'unknown';

  // Pick the best analogy for this learning style
  const bestAnalogy = bible.pedagogy.effectiveAnalogies.find(a =>
    a.worksFor.includes(learningStyle as string),
  ) ?? bible.pedagogy.effectiveAnalogies[0];

  if (!bestAnalogy) return null;

  const personalizationApplied = ['pedagogy.effectiveAnalogies', `learningStyle:${learningStyle}`];

  // Role-specific framing
  let intro = '';
  if (config.role === 'parent') {
    intro = `Here's how to understand ${bible.subtopicName} without technical background:\n\n`;
    personalizationApplied.push('role:parent');
  } else if (config.role === 'teacher') {
    intro = `Use this analogy in class to explain ${bible.subtopicName}:\n\n`;
    personalizationApplied.push('role:teacher');
  }

  const content = `${intro}**Analogy for ${bible.subtopicName}:**\n\n${bestAnalogy.analogy}`;

  return {
    id: `section-${bible.subtopicId}-analogy-${sectionIdx}`,
    type: 'analogy',
    title: `Analogy: ${bible.subtopicName}`,
    content,
    bibleSource: 'pedagogy.effectiveAnalogies',
    personalizationApplied,
    estimatedMinutes: SECTION_TIME_MINUTES.analogy,
    layer: 'personalized',
    subtopicId: bible.subtopicId,
  };
}

function buildSocraticSection(
  bible: SubTopicBible,
  config: PersonalizationConfig,
  sectionIdx: number,
): CourseSection | null {
  const questions = bible.pedagogy.socraticQuestions;
  if (questions.length === 0) return null;

  // Socratic depth from bible's agent connections
  const socraticDepth = bible.agentConnections.sage.avgSocraticDepth;
  const personalizationApplied = [
    'pedagogy.socraticQuestions',
    `agentConnections.sage.avgSocraticDepth:${socraticDepth}`,
  ];

  // Limit questions based on session length and cognitive load
  let maxQ = questions.length;
  if (config.cognitiveLoad === 'overloaded') {
    maxQ = 1;
    personalizationApplied.push('cognitiveLoad:overloaded');
  } else if (config.sessionLengthMinutes !== undefined && config.sessionLengthMinutes <= 10) {
    maxQ = 2;
  }

  const selected = questions.slice(0, maxQ);

  const content = `**Socratic Questions for ${bible.subtopicName}:**\n\n` +
    `*These questions build deep understanding. Attempt each before checking the next.*\n\n` +
    selected.map((q, i) => `**Q${i + 1}:** ${q}`).join('\n\n') +
    (bible.pedagogy.checkpointQuestions.length > 0
      ? `\n\n**Checkpoint:**\n${bible.pedagogy.checkpointQuestions[0]}`
      : '');

  return {
    id: `section-${bible.subtopicId}-socratic-${sectionIdx}`,
    type: 'socratic',
    title: `Socratic Questions: ${bible.subtopicName}`,
    content,
    bibleSource: 'pedagogy.socraticQuestions + pedagogy.checkpointQuestions',
    personalizationApplied,
    estimatedMinutes: SECTION_TIME_MINUTES.socratic,
    layer: 'personalized',
    subtopicId: bible.subtopicId,
  };
}

function buildTeacherNoteSection(
  bible: SubTopicBible,
  _config: PersonalizationConfig,
  sectionIdx: number,
): CourseSection | null {
  if (!bible.pedagogy.teacherNotes) return null;

  return {
    id: `section-${bible.subtopicId}-teachernote-${sectionIdx}`,
    type: 'teacher_note',
    title: `Teacher Notes: ${bible.subtopicName}`,
    content: `**📋 Pedagogy Notes for ${bible.subtopicName}:**\n\n${bible.pedagogy.teacherNotes}`,
    bibleSource: 'pedagogy.teacherNotes',
    personalizationApplied: ['role:teacher', 'pedagogy.teacherNotes'],
    estimatedMinutes: SECTION_TIME_MINUTES.teacher_note,
    layer: 'personalized',
    subtopicId: bible.subtopicId,
  };
}

function buildParentNoteSection(
  bible: SubTopicBible,
  _config: PersonalizationConfig,
  sectionIdx: number,
): CourseSection | null {
  if (!bible.pedagogy.parentExplanation) return null;

  return {
    id: `section-${bible.subtopicId}-parentnote-${sectionIdx}`,
    type: 'parent_note',
    title: `Parent Explanation: ${bible.subtopicName}`,
    content: `**For Parents — ${bible.subtopicName} in Simple Terms:**\n\n${bible.pedagogy.parentExplanation}`,
    bibleSource: 'pedagogy.parentExplanation',
    personalizationApplied: ['role:parent', 'pedagogy.parentExplanation'],
    estimatedMinutes: SECTION_TIME_MINUTES.parent_note,
    layer: 'personalized',
    subtopicId: bible.subtopicId,
  };
}

function buildExampleSection(
  bible: SubTopicBible,
  config: PersonalizationConfig,
  sectionIdx: number,
): CourseSection | null {
  // Use atoms.mandatory.worked_example if it exists
  const workedExample = bible.contentAtoms.mandatory.worked_example;
  if (!workedExample) {
    // Generate from pedagogy if possible
    if (bible.pedagogy.checkpointQuestions.length === 0) return null;
    const q = bible.pedagogy.checkpointQuestions[0];

    return {
      id: `section-${bible.subtopicId}-example-${sectionIdx}`,
      type: 'example',
      title: `Worked Example: ${bible.subtopicName}`,
      content: `**Practice Problem:**\n\n${q}\n\n*Work through this step-by-step before checking the PYQ section.*`,
      bibleSource: 'pedagogy.checkpointQuestions',
      personalizationApplied: ['pedagogy.checkpointQuestions'],
      estimatedMinutes: SECTION_TIME_MINUTES.example,
      layer: 'mandatory',
      subtopicId: bible.subtopicId,
    };
  }

  const personalizationApplied = ['contentAtoms.mandatory.worked_example'];

  // Prefix for practice-first learners
  let prefix = '';
  if (config.learningStyle === 'practice_first') {
    prefix = `*Practice-first approach: Try the example before reading the theory.*\n\n`;
    personalizationApplied.push('learningStyle:practice_first');
  }

  return {
    id: `section-${bible.subtopicId}-example-${sectionIdx}`,
    type: 'example',
    title: `Worked Example: ${bible.subtopicName}`,
    content: `${prefix}**Worked Example:**\n\n${workedExample}`,
    bibleSource: 'contentAtoms.mandatory.worked_example',
    personalizationApplied,
    estimatedMinutes: SECTION_TIME_MINUTES.example,
    layer: 'mandatory' as const,
    subtopicId: bible.subtopicId,
  };
}

function buildSummarySection(
  bible: SubTopicBible,
  _config: PersonalizationConfig,
  sectionIdx: number,
): CourseSection {
  const content = [
    `**${bible.subtopicName} — Quick Summary**`,
    '',
    bible.academic.definition
      ? `**Core Concept:** ${bible.academic.definition.slice(0, 200)}...`
      : '',
    bible.examIntelligence.highYieldFormulas.length > 0
      ? `**Key Formula:** \`${bible.examIntelligence.highYieldFormulas[0]}\``
      : '',
    bible.examIntelligence.examSpecificTips
      ? `**Remember:** ${bible.examIntelligence.examSpecificTips.slice(0, 150)}`
      : '',
  ].filter(Boolean).join('\n');

  return {
    id: `section-${bible.subtopicId}-summary-${sectionIdx}`,
    type: 'summary',
    title: `Summary: ${bible.subtopicName}`,
    content,
    bibleSource: 'academic.definition + examIntelligence.highYieldFormulas',
    personalizationApplied: [],
    estimatedMinutes: SECTION_TIME_MINUTES.summary,
    layer: 'mandatory',
    subtopicId: bible.subtopicId,
  };
}

function buildExerciseSection(
  bible: SubTopicBible,
  config: PersonalizationConfig,
  sectionIdx: number,
): CourseSection | null {
  const checkpoints = bible.pedagogy.checkpointQuestions;
  if (checkpoints.length === 0) return null;

  const personalizationApplied = ['pedagogy.checkpointQuestions'];

  if (config.cognitiveTier === 'advanced' || config.cognitiveTier === 'proficient') {
    personalizationApplied.push(`cognitiveTier:${config.cognitiveTier}`);
  }

  const maxEx = config.sessionLengthMinutes !== undefined && config.sessionLengthMinutes <= 10 ? 1 : 3;
  const selected = checkpoints.slice(0, maxEx);

  const content = `**Practice Exercises — ${bible.subtopicName}:**\n\n` +
    selected.map((q, i) => `**Exercise ${i + 1}:** ${q}`).join('\n\n') +
    (bible.analytics.commonStuckPoints.length > 0
      ? `\n\n*Hint: Students often get stuck on — ${bible.analytics.commonStuckPoints.slice(0, 2).join(', ')}*`
      : '');

  return {
    id: `section-${bible.subtopicId}-exercise-${sectionIdx}`,
    type: 'exercise',
    title: `Exercises: ${bible.subtopicName}`,
    content,
    bibleSource: 'pedagogy.checkpointQuestions + analytics.commonStuckPoints',
    personalizationApplied,
    estimatedMinutes: SECTION_TIME_MINUTES.exercise,
    layer: 'personalized',
    subtopicId: bible.subtopicId,
  };
}

// ─── Assemble Sections for One Subtopic ──────────────────────────────────────

function assembleSectionsForSubtopic(
  bible: SubTopicBible,
  template: CourseTemplate,
  config: PersonalizationConfig,
  subtopicIndex: number,
): CourseSection[] {
  const allowedTypes = TEMPLATE_SECTION_FILTERS[template];
  const sections: CourseSection[] = [];
  let si = subtopicIndex * 100;

  // MANDATORY LAYER FIRST
  if (allowedTypes.includes('concept')) {
    const s = buildConceptSection(bible, config, si++);
    if (s) sections.push(s);
  }
  if (allowedTypes.includes('formula') && config.includeFormulas !== false) {
    const s = buildFormulaSection(bible, config, si++);
    if (s) sections.push(s);
  }
  if (allowedTypes.includes('example') && config.learningStyle !== 'visual') {
    const s = buildExampleSection(bible, config, si++);
    if (s) sections.push(s);
  }
  if (allowedTypes.includes('pyq') && config.includePYQs !== false) {
    const s = buildPYQSection(bible, config, si++);
    if (s) sections.push(s);
  }
  if (allowedTypes.includes('misconception') && config.includeCommonMistakes !== false) {
    const s = buildMisconceptionSection(bible, config, si++);
    if (s) sections.push(s);
  }
  if (allowedTypes.includes('exam_tip') && config.includeExamTips !== false) {
    const s = buildExamTipSection(bible, config, si++);
    if (s) sections.push(s);
  }
  if (allowedTypes.includes('summary')) {
    sections.push(buildSummarySection(bible, config, si++));
  }

  // PERSONALIZED LAYER AFTER
  if (allowedTypes.includes('analogy') && config.includeAnalogies !== false) {
    const s = buildAnalogySection(bible, config, si++);
    if (s) sections.push(s);
  }
  if (allowedTypes.includes('socratic') && config.includeSocraticQuestions !== false) {
    const s = buildSocraticSection(bible, config, si++);
    if (s) sections.push(s);
  }
  if (allowedTypes.includes('exercise')) {
    const s = buildExerciseSection(bible, config, si++);
    if (s) sections.push(s);
  }
  if (allowedTypes.includes('teacher_note') && config.role === 'teacher') {
    const s = buildTeacherNoteSection(bible, config, si++);
    if (s) sections.push(s);
  }
  if (allowedTypes.includes('parent_note') && config.role === 'parent') {
    const s = buildParentNoteSection(bible, config, si++);
    if (s) sections.push(s);
  }

  if (config.focusAreas && config.focusAreas.length > 0) {
    return sections.map(s =>
      config.focusAreas!.includes(s.subtopicId)
        ? { ...s, personalizationApplied: [...s.personalizationApplied, 'focusArea'] }
        : s,
    );
  }

  return sections;
}

// ─── Custom Request Parser ────────────────────────────────────────────────────

export function parseCustomRequest(request: string): Partial<PersonalizationConfig> {
  const lower = request.toLowerCase();
  const overrides: Partial<PersonalizationConfig> = {};

  if (/story|narrative|like a story|through a story/i.test(lower)) {
    overrides.learningStyle = 'story_driven';
    overrides.includeAnalogies = true;
  } else if (/visual|diagram|picture|draw|chart/i.test(lower)) {
    overrides.learningStyle = 'visual';
    overrides.includeAnalogies = true;
  } else if (/proof|derive|derivation|analytical|formula first/i.test(lower)) {
    overrides.learningStyle = 'analytical';
    overrides.includeFormulas = true;
  } else if (/practice|problem|exercise|doing|hands.?on/i.test(lower)) {
    overrides.learningStyle = 'practice_first';
    overrides.includePYQs = true;
  } else if (/conversation|talk|explain|tell me/i.test(lower)) {
    overrides.learningStyle = 'auditory';
  }

  const minMatch = lower.match(/(\d+)\s*min/);
  if (minMatch) {
    overrides.sessionLengthMinutes = parseInt(minMatch[1], 10);
    if (overrides.sessionLengthMinutes <= 10) {
      overrides.includeAnalogies = false;
      overrides.includeSocraticQuestions = false;
    }
  }

  if (/only pyq|just pyq|previous year|past paper/i.test(lower)) {
    overrides.includePYQs = true;
    overrides.includeFormulas = false;
    overrides.includeAnalogies = false;
    overrides.includeSocraticQuestions = false;
    overrides.includeCommonMistakes = false;
  }

  if (/trap|trick|common mistake|what to avoid|don.?t/i.test(lower)) {
    overrides.includeExamTips = true;
    overrides.includeCommonMistakes = true;
    overrides.focusAreas = ['trapTopics'];
  }

  if (/formula|equation|math only|just formula/i.test(lower)) {
    overrides.includeFormulas = true;
    overrides.includePYQs = false;
    overrides.includeAnalogies = false;
    overrides.includeSocraticQuestions = false;
  }

  if (/beginner|basic|simple|from scratch|never studied|zero/i.test(lower)) {
    overrides.cognitiveTier = 'foundational';
    overrides.preferredDifficulty = 'easy';
    overrides.includeAnalogies = true;
  } else if (/advanced|expert|deep|topper|hard|difficult/i.test(lower)) {
    overrides.cognitiveTier = 'advanced';
    overrides.preferredDifficulty = 'hard';
  } else if (/intermediate|medium|moderate/i.test(lower)) {
    overrides.cognitiveTier = 'developing';
    overrides.preferredDifficulty = 'medium';
  }

  if (/teacher|classroom|class|lesson plan|pedagogy/i.test(lower)) {
    overrides.role = 'teacher';
    overrides.includeSocraticQuestions = true;
    overrides.includeCommonMistakes = true;
  } else if (/parent|mom|dad|guardian|family/i.test(lower)) {
    overrides.role = 'parent';
    overrides.includeAnalogies = true;
    overrides.includeFormulas = false;
    overrides.includePYQs = false;
  }

  if (/easy|simple|light|gentle/i.test(lower)) {
    overrides.preferredDifficulty = 'easy';
  } else if (/hard|tough|difficult/i.test(lower)) {
    overrides.preferredDifficulty = 'hard';
  } else if (/mixed|vary|different/i.test(lower)) {
    overrides.preferredDifficulty = 'mixed';
  }

  return overrides;
}

// ─── Auto-Personalize ─────────────────────────────────────────────────────────

export async function autoPersonalize(
  examId: string,
  topicId: string,
  subtopicIds: string[],
): Promise<PersonalizationConfig> {
  const persona = loadPersona();
  const profile = buildLearnerProfile(persona.studentId, examId);

  const firstBible = subtopicIds.length > 0
    ? getBibleOrCreate(examId, topicId, subtopicIds[0])
    : null;

  const styleMap: Record<string, LearningStyle> = {
    visual:          'visual',
    conceptual:      'analytical',
    practice_first:  'practice_first',
    mixed:           'unknown',
    'story-driven':  'story_driven',
    analytical:      'analytical',
    unknown:         'unknown',
    auditory:        'auditory',
  };

  const learningStyle: LearningStyle = styleMap[persona.learningStyle] ?? styleMap[profile.learningStyle] ?? 'unknown';

  const tierMap: Record<string, CognitiveTier> = {
    advanced:   'advanced',
    good:       'proficient',
    average:    'developing',
    struggling: 'foundational',
  };
  const cognitiveTier: CognitiveTier = tierMap[persona.tier] ?? 'developing';

  const sessionPref = firstBible?.studentPreferences.sessionLengthPreference;
  const sessionLengthMinutes: number =
    sessionPref === 'short_5min'   ? 5  :
    sessionPref === 'medium_15min' ? 15 :
    sessionPref === 'long_30min'   ? 30 : 15;

  const diffPref = firstBible?.studentPreferences.preferredDifficulty;
  const preferredDifficulty: PersonalizationConfig['preferredDifficulty'] =
    diffPref === 'gradual' ? 'easy' :
    diffPref === 'jump_in' ? 'hard' : 'mixed';

  const styleCounts = firstBible?.studentPreferences.preferredLearningStyles ?? {};
  const topStyle = Object.entries(styleCounts).sort(([, a], [, b]) => b - a)[0]?.[0];
  const bibleStyle: LearningStyle = topStyle ? (styleMap[topStyle] ?? 'unknown') : 'unknown';

  return {
    examId,
    topicId,
    subtopicIds,
    learningStyle: bibleStyle !== 'unknown' ? bibleStyle : learningStyle,
    cognitiveTier,
    cognitiveLoad: profile.cognitiveLoad,
    role: profile.role,
    emotionalState: persona.emotionalState,
    streakDays: persona.streakDays,
    daysToExam: persona.daysToExam,
    topicMasteryPct: persona.syllabusCompletion,
    sessionLengthMinutes,
    preferredDifficulty,
    includeAnalogies: persona.prefersAnalogies,
    includeSocraticQuestions: true,
    includePYQs: true,
    includeFormulas: true,
    includeCommonMistakes: true,
    includeExamTips: true,
  };
}

// ─── Main Generator ───────────────────────────────────────────────────────────

export async function generateCourseMaterial(
  template: CourseTemplate,
  config: PersonalizationConfig,
): Promise<CourseMaterial> {
  const now = new Date().toISOString();
  const materialId = `cm_${template}_${config.examId}_${Date.now()}`;

  const templateBase = TEMPLATE_CONFIGS[template];
  const mergedConfig: PersonalizationConfig = {
    ...templateBase,
    ...config,
    includeAnalogies:         config.includeAnalogies         ?? templateBase.includeAnalogies,
    includeSocraticQuestions: config.includeSocraticQuestions ?? templateBase.includeSocraticQuestions,
    includePYQs:              config.includePYQs              ?? templateBase.includePYQs,
    includeFormulas:          config.includeFormulas          ?? templateBase.includeFormulas,
    includeCommonMistakes:    config.includeCommonMistakes    ?? templateBase.includeCommonMistakes,
    includeExamTips:          config.includeExamTips          ?? templateBase.includeExamTips,
    sessionLengthMinutes:     config.sessionLengthMinutes     ?? templateBase.sessionLengthMinutes,
    preferredDifficulty:      config.preferredDifficulty      ?? templateBase.preferredDifficulty,
    learningStyle:            config.learningStyle            ?? templateBase.learningStyle,
    cognitiveTier:            config.cognitiveTier            ?? templateBase.cognitiveTier,
    role:                     config.role                     ?? templateBase.role,
  };

  if (mergedConfig.customRequest) {
    const customOverrides = parseCustomRequest(mergedConfig.customRequest);
    Object.assign(mergedConfig, customOverrides);
  }

  const activeSubtopicIds = mergedConfig.subtopicIds.filter(
    sid => !mergedConfig.avoidTopics?.includes(sid),
  );

  const orderedSubtopicIds = mergedConfig.focusAreas
    ? [
        ...activeSubtopicIds.filter(s => mergedConfig.focusAreas!.includes(s)),
        ...activeSubtopicIds.filter(s => !mergedConfig.focusAreas!.includes(s)),
      ]
    : activeSubtopicIds;

  const bibles: SubTopicBible[] = [];
  for (const sid of orderedSubtopicIds) {
    bibles.push(getBibleOrCreate(mergedConfig.examId, mergedConfig.topicId, sid));
  }

  const healthScores = bibles.map(b => getBibleCompleteness(b));
  const avgHealth = healthScores.length > 0
    ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length)
    : 0;

  const allSections: CourseSection[] = [];
  const mandatoryFulfilled: string[] = [];

  bibles.forEach((bible, idx) => {
    const subtopicSections = assembleSectionsForSubtopic(bible, template, mergedConfig, idx);
    allSections.push(...subtopicSections);

    subtopicSections.forEach(s => {
      if (s.layer === 'mandatory') {
        const atomKey = `${s.type}:${bible.subtopicId}`;
        if (!mandatoryFulfilled.includes(atomKey)) {
          mandatoryFulfilled.push(atomKey);
        }
      }
    });
  });

  const personalizedCount = allSections.filter(s => s.layer === 'personalized').length;
  const totalMinutes = allSections.reduce((sum, s) => sum + s.estimatedMinutes, 0);

  const personalizationVariables: Record<string, string> = {
    examId:           mergedConfig.examId,
    topicId:          mergedConfig.topicId,
    subtopicCount:    String(orderedSubtopicIds.length),
    template,
    learningStyle:    mergedConfig.learningStyle ?? 'unknown',
    cognitiveTier:    mergedConfig.cognitiveTier ?? 'developing',
    cognitiveLoad:    mergedConfig.cognitiveLoad ?? 'medium',
    role:             mergedConfig.role ?? 'student',
    emotionalState:   mergedConfig.emotionalState ?? 'neutral',
    streakDays:       String(mergedConfig.streakDays ?? 0),
    daysToExam:       String(mergedConfig.daysToExam ?? 90),
    topicMasteryPct:  String(mergedConfig.topicMasteryPct ?? 0),
    sessionLength:    String(mergedConfig.sessionLengthMinutes ?? 15),
    difficulty:       mergedConfig.preferredDifficulty ?? 'mixed',
    includeAnalogies: String(mergedConfig.includeAnalogies ?? true),
    includePYQs:      String(mergedConfig.includePYQs ?? true),
    includeFormulas:  String(mergedConfig.includeFormulas ?? true),
  };

  const summaryParts: string[] = [];
  if (mergedConfig.learningStyle && mergedConfig.learningStyle !== 'unknown') {
    summaryParts.push(`${mergedConfig.learningStyle} learner`);
  }
  if (mergedConfig.cognitiveTier) summaryParts.push(mergedConfig.cognitiveTier);
  if (mergedConfig.daysToExam !== undefined && mergedConfig.daysToExam <= 30) {
    summaryParts.push(`T-${mergedConfig.daysToExam}`);
  }
  if (mergedConfig.sessionLengthMinutes !== undefined && mergedConfig.sessionLengthMinutes <= 10) {
    summaryParts.push('quick revision');
  }
  if (mergedConfig.role && mergedConfig.role !== 'student') {
    summaryParts.push(mergedConfig.role);
  }
  const personalizationSummary = summaryParts.length > 0 ? summaryParts.join(', ') : 'Standard';

  const agentsInvolved = ['atlas'];
  if (allSections.some(s => s.type === 'socratic')) agentsInvolved.push('sage');
  if (allSections.some(s => s.type === 'pyq')) agentsInvolved.push('oracle');
  if (mergedConfig.role === 'teacher') agentsInvolved.push('mentor');

  const firstBible = bibles[0];
  const topicName = firstBible?.subtopicName ?? mergedConfig.topicId;
  const templateLabels: Record<CourseTemplate, string> = {
    exam_cracker:    'Exam Cracker',
    concept_builder: 'Concept Builder',
    quick_revision:  'Quick Revision',
    visual_deep_dive:'Visual Deep Dive',
    socratic_journey:'Socratic Journey',
    topper_strategy: 'Topper Strategy',
    parent_brief:    'Parent Brief',
    teacher_kit:     'Teacher Kit',
    custom:          'Custom Guide',
  };

  return {
    id: materialId,
    title: `${templateLabels[template]}: ${topicName}`,
    subtitle: `${mergedConfig.examId} | ${orderedSubtopicIds.length} subtopic${orderedSubtopicIds.length > 1 ? 's' : ''} | ${totalMinutes} min`,
    template,
    examId: mergedConfig.examId,
    subtopicsCovered: orderedSubtopicIds,
    estimatedTotalMinutes: totalMinutes,
    personalizationSummary,
    sections: allSections,
    biblesRead: bibles.map(b => b.id),
    personalizationVariables,
    agentsInvolved,
    generationTrace: {
      templateUsed: template,
      templateKeyResolved: firstBible?.promptIntelligence.bestTemplateKey,
      mandatoryAtomsFulfilled: mandatoryFulfilled,
      personalizedSectionsAdded: personalizedCount,
      bibleHealthAtGeneration: avgHealth,
    },
    generatedAt: now,
    version: 1,
  };
}

// ─── Record Generation Event ──────────────────────────────────────────────────

export function recordCourseMaterialGeneration(
  material: CourseMaterial,
  _userId: string,
): void {
  for (const subtopicId of material.subtopicsCovered) {
    try {
      const subtopicSections = material.sections.filter(s => s.subtopicId === subtopicId);
      const mandatorySections = subtopicSections.filter(s => s.layer === 'mandatory');

      const atomTypeMap: Partial<Record<CourseSectionType, keyof SubTopicBible['contentAtoms']['mandatory']>> = {
        concept:       'concept_core',
        formula:       'formula_card',
        example:       'worked_example',
        pyq:           'pyq_set',
        misconception: 'common_mistakes',
        exam_tip:      'exam_tips',
      };

      for (const section of mandatorySections) {
        const atomType = atomTypeMap[section.type];
        if (atomType) {
          updateFromAtlasGeneration(
            material.examId,
            subtopicId,
            subtopicId,
            atomType,
            section.id,
            'mandatory',
          );
        }
      }
    } catch {
      // Non-fatal
    }
  }
}

// ─── Bible Health ─────────────────────────────────────────────────────────────

export function getMaterialBibleHealth(
  config: Pick<PersonalizationConfig, 'examId' | 'topicId' | 'subtopicIds'>,
): number {
  if (config.subtopicIds.length === 0) return 0;
  const bibles = config.subtopicIds.map(sid =>
    getBibleOrCreate(config.examId, config.topicId, sid),
  );
  const scores = bibles.map(b => getBibleHealthScore(b));
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// ─── Available Subtopics ──────────────────────────────────────────────────────

export function getAvailableSubtopics(
  examId: string,
  topicId?: string,
): Array<{ subtopicId: string; subtopicName: string }> {
  const topics = MANDATORY_COVERAGE_MAP[examId] ?? [];
  if (topicId) {
    const topic = topics.find(t => t.topicId === topicId);
    if (topic) return [{ subtopicId: topic.topicId, subtopicName: topic.topicName }];
  }
  return topics.map(t => ({ subtopicId: t.topicId, subtopicName: t.topicName }));
}

// ─── PersonaContext builder ───────────────────────────────────────────────────

export function buildPersonaContextFromConfig(config: PersonalizationConfig): PersonaContext {
  return {
    learningStyle:   config.learningStyle ?? 'unknown',
    objective:
      config.daysToExam !== undefined && config.daysToExam <= 7 ? 'quick_revision' :
      config.daysToExam !== undefined && config.daysToExam <= 30 ? 'exam_readiness' :
      'conceptual_understanding',
    cognitiveTier:   config.cognitiveTier ?? 'developing',
    cognitiveLoad:   config.cognitiveLoad ?? 'medium',
    streakDays:      config.streakDays ?? 0,
    daysToExam:      config.daysToExam ?? 90,
    studyTimePattern:'afternoon',
    examId:          config.examId,
    examName:        config.examId,
    topic:           config.topicId,
    topicWeight:     0.5,
    topicMasteryPct: config.topicMasteryPct ?? 0,
    format:          config.preferredFormat ?? 'lesson_notes',
    difficulty:      config.preferredDifficulty === 'mixed' ? 'medium' : (config.preferredDifficulty ?? 'medium'),
    channel:         'web',
  };
}
