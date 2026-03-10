/**
 * atlasTaskService.ts — Bridge between Scout's content gaps and Atlas's generation queue
 *
 * Flow:
 *   Scout detects gap → createAtlasTask() → queueTask() → Atlas picks up → generateContentAtomForTask()
 *
 * Storage: localStorage under 'atlas:task-queue'
 * Signal bus: localStorage 'atlas:new-task-signal' triggers Atlas to poll
 */

import type { ContentAtom, ContentAtomType } from './contentFramework';
import type { ContentGap } from './redditIntelService';
import type { PriorityContentItem } from './scoutIntelligenceService';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AtlasContentTask {
  id: string;                    // uuid-style: `atlas-${Date.now()}`
  createdAt: string;             // ISO timestamp
  status: 'queued' | 'in_progress' | 'done' | 'failed';
  topic: string;
  examFocus: string;
  atomType: string;
  priority: number;              // 0–100
  reasoning: string;
  source: 'gap_radar' | 'priority_queue' | 'trend_alert';
  contentAtom?: ContentAtom;     // Filled when Atlas completes it
}

export interface AtlasTaskQueue {
  tasks: AtlasContentTask[];
  lastUpdated: string;
}

// ── Storage key ───────────────────────────────────────────────────────────────

const QUEUE_KEY = 'atlas:task-queue';

// ── Helpers ───────────────────────────────────────────────────────────────────

function inferExamFocus(topic: string): string {
  const lower = topic.toLowerCase();
  if (lower.includes('gate')) return 'GATE';
  if (lower.includes('cat') || lower.includes('mba')) return 'CAT';
  if (lower.includes('jee') || lower.includes('iit')) return 'JEE';
  if (lower.includes('neet')) return 'NEET';
  if (lower.includes('upsc')) return 'UPSC';
  return 'General';
}

function urgencyToPriority(urgency: 'high' | 'medium' | 'low'): number {
  switch (urgency) {
    case 'high':   return 90;
    case 'medium': return 55;
    case 'low':    return 25;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build an AtlasContentTask from a ContentGap or PriorityContentItem.
 */
export function createAtlasTask(
  gap: ContentGap | PriorityContentItem,
  source: AtlasContentTask['source'],
): AtlasContentTask {
  const isContentGap = 'urgency' in gap;   // discriminate between the two union members

  const topic      = gap.topic;
  const examFocus  = isContentGap ? inferExamFocus(topic) : (gap as PriorityContentItem).examFocus;
  const atomType   = isContentGap
    ? suggestAtomType(gap as ContentGap)
    : (gap as PriorityContentItem).suggestedAtomType;
  const priority   = isContentGap
    ? urgencyToPriority((gap as ContentGap).urgency)
    : (gap as PriorityContentItem).priority;
  const reasoning  = isContentGap
    ? `Reddit gap: ${(gap as ContentGap).questionCount} unanswered questions · avg score ${(gap as ContentGap).avgScore}`
    : (gap as PriorityContentItem).reasoning;

  const id = `atlas-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const task: AtlasContentTask = {
    id,
    createdAt: new Date().toISOString(),
    status: 'queued',
    topic,
    examFocus,
    atomType,
    priority,
    reasoning,
    source,
  };

  return task;
}

function suggestAtomType(gap: ContentGap): string {
  const lower = gap.topic.toLowerCase();
  const questions = gap.sampleQuestions.join(' ').toLowerCase();
  if (lower.includes('formula') || lower.includes('equation')) return 'formula_sheet';
  if (lower.includes('numericals') || lower.includes('problems') || questions.includes('mcq')) return 'mcq_set';
  if (gap.urgency === 'high' && gap.questionCount >= 5) return 'explainer_article';
  if (lower.includes('concept') || lower.includes('understand')) return 'explanation';
  return 'mcq_set';
}

/**
 * Persist a task to localStorage and fire the new-task signal.
 */
export function queueTask(task: AtlasContentTask): void {
  const current = getQueue();
  // Avoid exact-topic duplicates that are still queued
  const alreadyQueued = current.tasks.some(
    t => t.topic === task.topic && t.status === 'queued',
  );
  if (!alreadyQueued) {
    current.tasks.push(task);
  } else {
    // Replace with latest task so button state is consistent
    const idx = current.tasks.findIndex(t => t.topic === task.topic && t.status === 'queued');
    if (idx !== -1) current.tasks[idx] = task;
  }
  current.lastUpdated = new Date().toISOString();
  localStorage.setItem(QUEUE_KEY, JSON.stringify(current));

  // Signal Atlas to pick up new work
  localStorage.setItem(
    'atlas:new-task-signal',
    JSON.stringify({ taskId: task.id, timestamp: Date.now() }),
  );
}

/**
 * Load the full task queue from localStorage.
 */
export function getQueue(): AtlasTaskQueue {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AtlasTaskQueue;
      return parsed;
    }
  } catch {
    // corrupted storage — start fresh
  }
  return { tasks: [], lastUpdated: new Date().toISOString() };
}

/**
 * Update a task's status in-place.
 */
export function updateTaskStatus(
  id: string,
  status: AtlasContentTask['status'],
  contentAtom?: ContentAtom,
): void {
  const queue = getQueue();
  const idx = queue.tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  queue.tasks[idx].status = status;
  if (contentAtom !== undefined) {
    queue.tasks[idx].contentAtom = contentAtom;
  }
  queue.lastUpdated = new Date().toISOString();
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Remove all tasks with status 'done' or 'failed'.
 */
export function clearCompletedTasks(): void {
  const queue = getQueue();
  queue.tasks = queue.tasks.filter(t => t.status !== 'done' && t.status !== 'failed');
  queue.lastUpdated = new Date().toISOString();
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Return only tasks with status 'queued'.
 */
export function getPendingTasks(): AtlasContentTask[] {
  return getQueue().tasks.filter(t => t.status === 'queued');
}

// ── Content Generation (Atlas mock) ──────────────────────────────────────────

/**
 * Generate a ContentAtom for an Atlas task.
 * Uses ContentGenerationPipeline's scaffold when possible, then enriches with
 * realistic mock content based on atomType.
 */
export async function generateContentAtomForTask(task: AtlasContentTask): Promise<ContentAtom> {
  // Simulate a brief generation delay so the UI feels real
  await new Promise(resolve => setTimeout(resolve, 1200));

  const now = new Date();
  const baseId = `atlas-atom-${Date.now()}`;
  const atomType = mapToContentAtomType(task.atomType);

  const base: ContentAtom = {
    id: baseId,
    type: atomType,
    title: task.topic,
    body: '',
    examId: task.examFocus.toLowerCase(),
    topic: task.topic,
    difficulty: 'medium',
    syllabusPriority: task.priority >= 70 ? 'high' : task.priority >= 40 ? 'medium' : 'low',
    quality: {
      accuracy: 0.88,
      clarity: 0.84,
      examRelevance: task.priority / 100,
      engagementScore: 0,
      wolframVerified: false,
      reviewedByHuman: false,
    },
    generatedBy: 'atlas',
    generatedAt: now,
    sourceType: 'llm',
    version: 1,
    timesServed: 0,
    avgRating: 0,
    completionRate: 0,
  };

  // Enrich based on atom type
  switch (atomType) {
    case 'practice_set':
    case 'mcq': {
      const mcqs = buildMockMCQs(task.topic, task.examFocus, 3);
      const first = mcqs[0];
      return {
        ...base,
        title: `${task.topic} — Practice MCQ Set`,
        body: mcqs.map((m, i) =>
          `Q${i + 1}. ${m.question}\nA) ${m.options.A}  B) ${m.options.B}  C) ${m.options.C}  D) ${m.options.D}\nAnswer: ${m.correct}`,
        ).join('\n\n'),
        bodyMarkdown: mcqs.map((m, i) =>
          `**Q${i + 1}.** ${m.question}\n\n- A) ${m.options.A}\n- B) ${m.options.B}\n- C) ${m.options.C}\n- D) ${m.options.D}\n\n✅ **Answer:** ${m.correct} — ${m.explanation}`,
        ).join('\n\n---\n\n'),
        mcq: first,
        type: 'practice_set',
      };
    }

    case 'formula_card': {
      const formulas = buildMockFormulas(task.topic, task.examFocus);
      return {
        ...base,
        title: `${task.topic} — Formula Sheet`,
        body: formulas.map(f => `${f.plainText} — ${f.intuition}`).join('\n'),
        bodyMarkdown: formulas.map(f =>
          `**${f.plainText}**\n\n> ${f.intuition}\n\n*When to use:* ${f.whenToUse}`,
        ).join('\n\n---\n\n'),
        formula: formulas[0],
        type: 'formula_card',
      };
    }

    case 'lesson_block':
    case 'summary':
    default: {
      const explanation = buildMockExplanation(task.topic, task.examFocus);
      return {
        ...base,
        title: `${task.topic} — Explanation`,
        body: explanation,
        bodyMarkdown: `## ${task.topic}\n\n${explanation}\n\n> 📌 *${task.examFocus} tip: Focus on the core formula and one worked example.*`,
        type: 'lesson_block',
        supplementary: `Study this alongside previous year ${task.examFocus} questions on ${task.topic} for best results.`,
      };
    }
  }
}

// ── Mock content builders ─────────────────────────────────────────────────────

function mapToContentAtomType(atomType: string): ContentAtomType {
  const lower = atomType.toLowerCase().replace(/[_\s-]/g, '_');
  if (lower.includes('mcq') || lower.includes('practice')) return 'practice_set';
  if (lower.includes('formula') || lower.includes('sheet')) return 'formula_card';
  if (lower.includes('flash')) return 'flashcard';
  if (lower.includes('analogy')) return 'analogy';
  if (lower.includes('blog')) return 'blog_post';
  if (lower.includes('tip') || lower.includes('trick')) return 'exam_tip';
  if (lower.includes('summary') || lower.includes('overview')) return 'summary';
  return 'lesson_block';
}

interface MockMCQ {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  commonWrongAnswer: 'A' | 'B' | 'C' | 'D';
  examTip?: string;
}

function buildMockMCQs(topic: string, exam: string, count: number): MockMCQ[] {
  const templates: MockMCQ[] = [
    {
      question: `Which of the following best describes the fundamental principle behind ${topic}?`,
      options: {
        A: `The relationship is directly proportional to the square of the variable`,
        B: `It follows a logarithmic decay with time constant τ`,
        C: `Conservation of energy governs the transformation process`,
        D: `The output is independent of the input under steady-state conditions`,
      },
      correct: 'C',
      commonWrongAnswer: 'A',
      explanation: `Conservation principles are foundational in ${exam} problems on ${topic}. Always identify what is conserved first.`,
      examTip: `In ${exam}, eliminate options that introduce extra variables not given in the problem.`,
    },
    {
      question: `In a ${exam} exam context, if ${topic} has a parameter doubled, the output:`,
      options: {
        A: 'Doubles linearly',
        B: 'Quadruples (increases by factor of 4)',
        C: 'Remains unchanged due to normalisation',
        D: 'Halves due to inverse relationship',
      },
      correct: 'B',
      commonWrongAnswer: 'A',
      explanation: `The quadratic relationship is a common trap in ${exam}. Doubling a squared parameter quadruples the result.`,
      examTip: `Watch for squared relationships — they appear frequently in ${exam} numerical problems.`,
    },
    {
      question: `A common mistake students make when solving ${topic} problems in ${exam} is:`,
      options: {
        A: 'Using SI units throughout the calculation',
        B: `Forgetting to account for the boundary conditions`,
        C: 'Applying the formula without checking assumptions',
        D: 'Both B and C are common errors',
      },
      correct: 'D',
      commonWrongAnswer: 'C',
      explanation: `Boundary conditions and assumption-checking are both critical. ${exam} setters specifically test these.`,
      examTip: `Always state your assumptions before solving — it also helps you catch errors mid-calculation.`,
    },
  ];
  return templates.slice(0, Math.min(count, templates.length));
}

interface MockFormula {
  latex: string;
  plainText: string;
  intuition: string;
  whenToUse: string;
  pitfalls: string[];
}

function buildMockFormulas(topic: string, exam: string): MockFormula[] {
  return [
    {
      latex: `E = \\frac{1}{2}mv^2`,
      plainText: `Kinetic Energy = ½ × mass × velocity²`,
      intuition: `Energy stored in motion grows with the square of speed — doubling speed quadruples the energy.`,
      whenToUse: `Use when converting between mechanical energy forms in ${exam} problems on ${topic}.`,
      pitfalls: [
        'Forgetting the ½ factor',
        'Using speed in km/h instead of m/s',
        'Applying to rotational systems without the correct moment of inertia',
      ],
    },
    {
      latex: `P = \\frac{dE}{dt}`,
      plainText: `Power = rate of energy transfer`,
      intuition: `Power measures how fast energy is delivered or consumed. Critical for efficiency questions in ${exam}.`,
      whenToUse: `Any problem involving time and energy in ${topic}. Common in ${exam} electrics and thermodynamics sections.`,
      pitfalls: [
        'Confusing peak power with average power',
        'Missing the time conversion (ms vs s)',
      ],
    },
    {
      latex: `\\Delta G = \\Delta H - T\\Delta S`,
      plainText: `Gibbs Free Energy = Enthalpy − Temperature × Entropy`,
      intuition: `Spontaneous reactions have negative ΔG. Temperature determines which term dominates.`,
      whenToUse: `Thermodynamic feasibility questions — especially ${exam} problems that give ΔH and ΔS and ask for spontaneity.`,
      pitfalls: [
        'Using Celsius instead of Kelvin for T',
        'Confusing sign conventions for exothermic vs endothermic',
      ],
    },
    {
      latex: `v = u + at`,
      plainText: `Final velocity = Initial velocity + Acceleration × Time`,
      intuition: `One of the SUVAT equations. Velocity changes linearly with time under constant acceleration.`,
      whenToUse: `Kinematics problems in ${exam} — when acceleration is constant and you know 3 of the 4 variables.`,
      pitfalls: [
        'Applying to non-constant acceleration scenarios',
        'Mixing vector directions (up/down sign errors)',
      ],
    },
  ];
}

function buildMockExplanation(topic: string, exam: string): string {
  return `${topic} is a critical concept in the ${exam} syllabus, frequently tested in previous year questions.

**Core Idea:** At its heart, ${topic} involves understanding how variables interact under specific constraints. Students who master this topic typically score above average in this section.

**Key Principles:**
1. Identify the governing equation or relationship — this is always the entry point.
2. Apply boundary conditions carefully — most marks are lost here in ${exam}.
3. Check units and dimensions before finalising your answer.

**Common Student Struggles:** Many ${exam} aspirants confuse ${topic} with related concepts, leading to systematic errors. The key differentiator is to ask: "What is being conserved or held constant?"

**Exam Strategy:** In ${exam}, questions on ${topic} often come paired with a numerical and a conceptual sub-part. Solve the conceptual part first to orient your thinking, then tackle the numerical with confidence.`;
}
