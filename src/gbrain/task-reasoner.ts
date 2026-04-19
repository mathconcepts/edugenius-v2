// @ts-nocheck
/**
 * GBrain Layer 2 — Task Reasoner
 *
 * The "thinking before speaking" layer. Runs a 5-node decision tree
 * before any content is generated, ensuring every response is
 * intentional and pedagogically grounded.
 *
 * Nodes:
 *   1. Intent Classification — what is the student doing?
 *   2. Pedagogical Action — what should GBrain do?
 *   3. Difficulty & Topic — zone of proximal development
 *   4. Format & Depth — match cognitive profile
 *   5. Verification Gate — pre-check instructions
 *
 * Output: TaskReasonerInstructions → passed to Content Generator
 */

import pg from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { StudentModel } from './student-model';
import { serializeForPrompt, getZPDConcept, getTopicMastery } from './student-model';
import { CONCEPT_MAP, getConceptsForTopic, traceWeakestPrerequisite } from '../constants/concept-graph';
import { detectTopic } from '../utils/topic-detection';

const { Pool } = pg;

let _pool: any = null;
function getPool() {
  if (_pool) return _pool;
  _pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  return _pool;
}

// ============================================================================
// Types
// ============================================================================

export type StudentIntent =
  | 'concept_question'        // Asking about a concept
  | 'solution_check'          // Submitting work for verification
  | 'practice_request'        // Wants practice problems
  | 'strategy_advice'         // Asking about exam strategy
  | 'expressing_confusion'    // Stuck, confused
  | 'expressing_frustration'  // Frustrated, upset
  | 'open_study'              // "Help me study" / general
  | 'greeting';               // Just saying hi

export type PedagogicalAction =
  | 'socratic_questioning'    // Student is close, ask guiding questions
  | 'worked_example'          // Show the full method
  | 'scaffolded_hint'         // Partial help, build independence
  | 'error_diagnosis'         // Diagnose and explain the error
  | 'prerequisite_repair'     // Trace backward, fix foundation
  | 'confidence_building'     // Serve easier win, rebuild momentum
  | 'challenge_stretch'       // Student is strong, push harder
  | 'strategy_coaching'       // Exam-specific advice
  | 'emotional_support'       // Address frustration/anxiety first
  | 'progress_reflection';    // Show growth, motivate

export interface TaskReasonerInstructions {
  // What the student is doing
  intent: StudentIntent;

  // What GBrain should do
  action: PedagogicalAction;

  // Topic and difficulty selection
  selected_concept: string | null;
  selected_difficulty: number; // 0-1
  selected_topic: string | null;

  // Format instructions for Content Generator
  format: {
    max_steps: number;           // How many solution steps to show
    use_visual: boolean;         // Include visual/geometric explanation
    start_concrete: boolean;     // Start with concrete example before abstract
    notation_level: 'minimal' | 'standard' | 'formal';
    tone: 'encouraging' | 'neutral' | 'challenging';
    response_length: 'short' | 'medium' | 'long';
  };

  // Reasoning (for logging)
  reasoning: string;

  // Whether prerequisite repair is needed
  prerequisite_repair_target: string | null;
}

// ============================================================================
// Task Reasoner — Structured Gemini Call
// ============================================================================

const REASONER_PROMPT = `You are the Task Reasoner for a GATE Engineering Mathematics tutoring system.
Your job: analyze the student's message and their profile, then decide the best pedagogical response.

You do NOT generate the actual response. You only decide WHAT to do and HOW to format it.

Respond ONLY with JSON (no markdown, no backticks):
{
  "intent": "concept_question|solution_check|practice_request|strategy_advice|expressing_confusion|expressing_frustration|open_study|greeting",
  "action": "socratic_questioning|worked_example|scaffolded_hint|error_diagnosis|prerequisite_repair|confidence_building|challenge_stretch|strategy_coaching|emotional_support|progress_reflection",
  "selected_concept": "concept-id or null",
  "selected_difficulty": 0.5,
  "reasoning": "Brief explanation of your pedagogical decision"
}

Decision rules:
- If student is frustrated (consecutive failures >= 3 or says "I give up"/"I can't"), choose confidence_building or emotional_support
- If student asks about a concept and mastery is 0.3-0.7, choose socratic_questioning
- If mastery < 0.3 and there are weak prerequisites, choose prerequisite_repair
- If mastery > 0.7, choose challenge_stretch
- If student submits work, choose error_diagnosis (if wrong) or progress_reflection (if right)
- For practice requests, select difficulty based on mastery (target ZPD: 0.3-0.7)
- For "help me study", check priority and serve the highest-need concept`;

/**
 * Run the Task Reasoner to decide what pedagogical action to take.
 */
export async function runTaskReasoner(
  studentMessage: string,
  model: StudentModel,
  chatHistory?: Array<{ role: string; content: string }>,
): Promise<TaskReasonerInstructions> {
  // Detect topic from message
  const detectedTopic = detectTopic(studentMessage);
  const topicMastery = detectedTopic && detectedTopic !== 'general'
    ? getTopicMastery(model, detectedTopic)
    : null;

  // Check for prerequisite issues
  let prereqRepairTarget: string | null = null;
  if (detectedTopic && topicMastery !== null && topicMastery < 0.3) {
    const zpdConcept = getZPDConcept(model, detectedTopic);
    if (zpdConcept) {
      const weakPrereqs = traceWeakestPrerequisite(zpdConcept, model.mastery_vector, 0.3);
      if (weakPrereqs.length > 0) {
        prereqRepairTarget = weakPrereqs[0].id;
      }
    }
  }

  // Try Gemini for intelligent reasoning
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const geminiResult = await runGeminiReasoner(
        studentMessage, model, detectedTopic, topicMastery, prereqRepairTarget
      );
      if (geminiResult) {
        // Log the decision
        logReasonerDecision(model.session_id, studentMessage, geminiResult).catch(() => {});
        return geminiResult;
      }
    } catch (err) {
      console.error('[gbrain/task-reasoner] Gemini reasoning failed, using heuristic:', (err as Error).message);
    }
  }

  // Fallback: heuristic-based reasoning
  const instructions = heuristicReasoner(studentMessage, model, detectedTopic, topicMastery, prereqRepairTarget);
  logReasonerDecision(model.session_id, studentMessage, instructions).catch(() => {});
  return instructions;
}

/** Gemini-based reasoning */
async function runGeminiReasoner(
  message: string,
  model: StudentModel,
  topic: string | null,
  topicMastery: number | null,
  prereqTarget: string | null,
): Promise<TaskReasonerInstructions | null> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const gemini = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const studentProfile = serializeForPrompt(model);

  const prompt = `${REASONER_PROMPT}

Student message: "${message}"

Student profile:
${studentProfile}

Detected topic: ${topic || 'none'}
Topic mastery: ${topicMastery !== null ? Math.round(topicMastery * 100) + '%' : 'unknown'}
Prerequisite repair needed: ${prereqTarget || 'no'}
Consecutive failures: ${model.consecutive_failures}`;

  const result = await gemini.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);

  return buildInstructions(parsed, model, topic, topicMastery, prereqTarget);
}

/** Heuristic-based reasoning (no LLM needed) */
function heuristicReasoner(
  message: string,
  model: StudentModel,
  topic: string | null,
  topicMastery: number | null,
  prereqTarget: string | null,
): TaskReasonerInstructions {
  const msgLower = message.toLowerCase();

  // Intent detection
  let intent: StudentIntent = 'open_study';
  if (msgLower.match(/^(hi|hello|hey|good morning|good evening)/)) {
    intent = 'greeting';
  } else if (msgLower.match(/solve|answer|verify|check|is this right|my answer/)) {
    intent = 'solution_check';
  } else if (msgLower.match(/practice|drill|problems|give me|more problems/)) {
    intent = 'practice_request';
  } else if (msgLower.match(/strategy|exam|plan|prepare|how to study|time management/)) {
    intent = 'strategy_advice';
  } else if (msgLower.match(/confused|don't understand|stuck|help|what is|explain|how does/)) {
    intent = 'expressing_confusion';
  } else if (msgLower.match(/frustrated|can't|give up|hate|impossible|too hard|angry/)) {
    intent = 'expressing_frustration';
  } else if (msgLower.match(/what|why|how|when|define|meaning|concept|theorem/)) {
    intent = 'concept_question';
  }

  // Action selection
  let action: PedagogicalAction = 'worked_example';
  let reasoning = '';

  if (intent === 'expressing_frustration' || model.motivation_state === 'frustrated') {
    action = 'emotional_support';
    reasoning = 'Student is frustrated — address emotional state before academics';
  } else if (intent === 'greeting') {
    action = 'progress_reflection';
    reasoning = 'Greeting — show progress to build engagement';
  } else if (intent === 'strategy_advice') {
    action = 'strategy_coaching';
    reasoning = 'Student asked for strategy advice';
  } else if (prereqTarget && topicMastery !== null && topicMastery < 0.3) {
    action = 'prerequisite_repair';
    reasoning = `Mastery at ${Math.round(topicMastery * 100)}% — prerequisite ${prereqTarget} needs repair first`;
  } else if (topicMastery !== null && topicMastery > 0.7) {
    action = 'challenge_stretch';
    reasoning = `Mastery at ${Math.round(topicMastery * 100)}% — stretch with harder problems`;
  } else if (model.consecutive_failures >= model.frustration_threshold) {
    action = 'confidence_building';
    reasoning = `${model.consecutive_failures} consecutive failures — serve easier win`;
  } else if (intent === 'concept_question' && topicMastery !== null && topicMastery >= 0.3) {
    action = 'socratic_questioning';
    reasoning = 'Student has base knowledge — guide discovery via questions';
  } else if (intent === 'solution_check') {
    action = 'error_diagnosis';
    reasoning = 'Student submitted work for checking';
  } else if (intent === 'practice_request') {
    action = 'worked_example';
    reasoning = 'Practice request — provide worked example then problem';
  }

  return buildInstructions(
    { intent, action, selected_concept: null, selected_difficulty: 0.5, reasoning },
    model, topic, topicMastery, prereqTarget
  );
}

/** Build full instructions from parsed reasoning */
function buildInstructions(
  parsed: any,
  model: StudentModel,
  topic: string | null,
  topicMastery: number | null,
  prereqTarget: string | null,
): TaskReasonerInstructions {
  // Difficulty selection based on mastery (ZPD targeting)
  let difficulty = parsed.selected_difficulty || 0.5;
  if (topicMastery !== null) {
    difficulty = Math.max(0.2, Math.min(0.8, topicMastery + 0.1));
  }

  // If action is confidence_building, lower difficulty
  if (parsed.action === 'confidence_building') {
    difficulty = Math.max(0.1, (topicMastery || 0.3) - 0.2);
  }
  // If action is challenge_stretch, raise difficulty
  if (parsed.action === 'challenge_stretch') {
    difficulty = Math.min(0.9, (topicMastery || 0.7) + 0.15);
  }

  // Format based on cognitive profile
  const format = {
    max_steps: model.working_memory_est <= 3 ? 4 : model.working_memory_est <= 5 ? 6 : 8,
    use_visual: model.representation_mode === 'geometric' || model.representation_mode === 'balanced',
    start_concrete: model.abstraction_comfort < 0.5,
    notation_level: (model.abstraction_comfort > 0.7 ? 'formal' : model.abstraction_comfort > 0.4 ? 'standard' : 'minimal') as 'minimal' | 'standard' | 'formal',
    tone: (model.motivation_state === 'frustrated' || model.motivation_state === 'anxious'
      ? 'encouraging'
      : model.motivation_state === 'driven'
        ? 'challenging'
        : 'neutral') as 'encouraging' | 'neutral' | 'challenging',
    response_length: (parsed.action === 'emotional_support' || parsed.action === 'confidence_building'
      ? 'short'
      : parsed.action === 'worked_example' || parsed.action === 'prerequisite_repair'
        ? 'long'
        : 'medium') as 'short' | 'medium' | 'long',
  };

  // Select concept
  let selectedConcept = parsed.selected_concept;
  if (!selectedConcept && topic && topic !== 'general') {
    selectedConcept = getZPDConcept(model, topic);
  }

  return {
    intent: parsed.intent,
    action: parsed.action,
    selected_concept: prereqTarget || selectedConcept || null,
    selected_difficulty: difficulty,
    selected_topic: topic !== 'general' ? topic : null,
    format,
    reasoning: parsed.reasoning,
    prerequisite_repair_target: prereqTarget,
  };
}

// ============================================================================
// Content Generator System Prompt Builder
// ============================================================================

/**
 * Build the enhanced system prompt for the Content Generator (Layer 3).
 * This replaces the old flat system prompt with layered instructions.
 */
export function buildContentGeneratorPrompt(
  instructions: TaskReasonerInstructions,
  model: StudentModel,
): string {
  const parts: string[] = [];

  // Layer 0: Identity Kernel (always present)
  parts.push(`You are GBrain, an expert GATE Engineering Mathematics tutor.

CORE PHILOSOPHY:
- Growth mindset: errors are learning opportunities, not failures
- Error-positive culture: celebrate the attempt, diagnose the gap
- Socratic preference: guide discovery over direct answers when appropriate
- Exam-aware: everything connects back to maximizing GATE score

Use LaTeX: inline $..$ and display $$...$$`);

  // Layer 2: Task Reasoner Instructions
  parts.push(`\n## YOUR TASK
Action: ${instructions.action}
${instructions.reasoning}`);

  // Action-specific instructions
  switch (instructions.action) {
    case 'socratic_questioning':
      parts.push(`Ask 2-3 guiding questions that lead the student to discover the answer.
Do NOT give the answer directly. Build understanding step by step.`);
      break;

    case 'worked_example':
      parts.push(`Show a complete worked example with clear steps.
Maximum ${instructions.format.max_steps} steps. Number each step.
${instructions.format.start_concrete ? 'Start with a concrete numerical example before the general method.' : ''}
After the example, provide one practice problem for the student to try.`);
      break;

    case 'scaffolded_hint':
      parts.push(`Give a partial hint — enough to unstick the student, not enough to solve it.
Focus on the key insight they're missing. Let them do the work.`);
      break;

    case 'error_diagnosis':
      parts.push(`The student submitted an answer for checking. If it's wrong:
1. Acknowledge their attempt positively
2. Identify the specific error (don't just say "wrong")
3. Explain why their approach was tempting but flawed
4. Give a targeted hint to fix the specific misconception
Do NOT solve the whole problem for them.`);
      break;

    case 'prerequisite_repair':
      parts.push(`The student is struggling because a prerequisite concept is weak.
Prerequisite to repair: ${instructions.prerequisite_repair_target}
Do NOT attempt the original topic. Instead:
1. Briefly explain why this prerequisite matters
2. Teach the prerequisite concept with a simple example
3. Provide a quick check problem on the prerequisite`);
      break;

    case 'confidence_building':
      parts.push(`The student has had ${model.consecutive_failures} failures in a row.
Serve an EASIER problem they're likely to get right.
Celebrate their success warmly. Rebuild momentum before pushing harder.
Keep response SHORT and encouraging.`);
      break;

    case 'challenge_stretch':
      parts.push(`Student has strong mastery here. Push them with:
- A harder variant or edge case
- A time-pressure challenge
- A problem requiring synthesis of multiple concepts
Tone: challenging but supportive. "You're ready for this."`);
      break;

    case 'strategy_coaching':
      parts.push(`Give specific, data-driven exam strategy advice.
Reference their speed profile and mastery data when available.
Be concrete: "Start with algebra (your fastest topic), then tackle probability."
Not generic: "Study hard and manage your time."`);
      break;

    case 'emotional_support':
      parts.push(`Student is frustrated or anxious. Address the emotion FIRST.
1. Acknowledge the feeling without minimizing it
2. Normalize struggle ("this topic trips up most students")
3. Show specific progress they've made (reference mastery data if available)
4. Only THEN offer a gentle next step
Keep it SHORT. Don't lecture.`);
      break;

    case 'progress_reflection':
      parts.push(`Show the student their progress. Highlight:
- Topics where mastery has improved
- Error types that have decreased
- Consistency/streak achievements
End with a specific, actionable next step.`);
      break;
  }

  // Format instructions
  parts.push(`\n## FORMAT
- Response length: ${instructions.format.response_length}
- Notation: ${instructions.format.notation_level}
- Tone: ${instructions.format.tone}
${instructions.format.use_visual ? '- Include a visual/geometric explanation where helpful' : ''}
${instructions.format.start_concrete ? '- Start with a concrete example before abstractions' : ''}`);

  // Layer 1: Student Profile Summary
  const profileSummary = serializeForPrompt(model);
  if (profileSummary) {
    parts.push(`\n## STUDENT PROFILE\n${profileSummary}`);
  }

  return parts.join('\n');
}

// ============================================================================
// Logging
// ============================================================================

async function logReasonerDecision(
  sessionId: string,
  message: string,
  instructions: TaskReasonerInstructions,
): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO task_reasoner_log
       (session_id, student_message, intent, pedagogical_action,
        selected_concept, selected_difficulty, format_instructions, reasoning)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sessionId, message, instructions.intent, instructions.action,
        instructions.selected_concept, instructions.selected_difficulty,
        JSON.stringify(instructions.format), instructions.reasoning,
      ],
    );
  } catch (err) {
    console.error('[gbrain/task-reasoner] Failed to log decision:', (err as Error).message);
  }
}
