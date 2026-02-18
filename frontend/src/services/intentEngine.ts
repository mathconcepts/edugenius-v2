/**
 * Intent Detection Engine — Prism
 * Analyses multimodal input (text + image + audio + file) and determines:
 *  1. User intent (what they want to do)
 *  2. Best agent to handle it
 *  3. Suggested learning mode
 *
 * When real LLM is connected, swap the mock classifier with an API call.
 * The interface stays identical — only generateIntentPrompt() gets used.
 */

import type { AgentType, InputModality, MediaAttachment, IntentResult } from '@/types';

// ─── Intent catalogue ─────────────────────────────────────────────────────────

export type IntentCategory =
  | 'solve_math'
  | 'solve_physics'
  | 'solve_chemistry'
  | 'solve_biology'
  | 'explain_concept'
  | 'create_study_plan'
  | 'generate_questions'
  | 'generate_content'
  | 'analyze_image'
  | 'analyze_diagram'
  | 'check_handwriting'
  | 'exam_strategy'
  | 'doubt_clearing'
  | 'quick_reference'
  | 'analytics_query'
  | 'market_research'
  | 'system_status'
  | 'student_progress'
  | 'motivation'
  | 'general';

interface IntentRule {
  intent: IntentCategory;
  keywords: string[];
  modalities?: InputModality[];    // triggers if ANY of these modalities present
  targetAgent: AgentType;
  suggestedMode?: string;
  confidence: number;
}

const INTENT_RULES: IntentRule[] = [
  // ── Image / drawing analysis ──
  {
    intent: 'analyze_image',
    keywords: ['this image', 'this picture', 'this photo', 'what is in', 'look at this', 'see this', 'check this'],
    modalities: ['image', 'drawing'],
    targetAgent: 'sage',
    suggestedMode: 'doubt_clearing',
    confidence: 0.95,
  },
  {
    intent: 'check_handwriting',
    keywords: ['my notes', 'my solution', 'written', 'handwritten', 'my work', 'check my answer'],
    modalities: ['image', 'drawing'],
    targetAgent: 'sage',
    suggestedMode: 'doubt_clearing',
    confidence: 0.90,
  },
  {
    intent: 'analyze_diagram',
    keywords: ['diagram', 'graph', 'circuit', 'structure', 'formula sheet'],
    modalities: ['image'],
    targetAgent: 'sage',
    suggestedMode: 'explanation',
    confidence: 0.88,
  },

  // ── Audio ──
  {
    intent: 'doubt_clearing',
    keywords: [],
    modalities: ['audio'],
    targetAgent: 'sage',
    suggestedMode: 'doubt_clearing',
    confidence: 0.85,
  },

  // ── Math ──
  {
    intent: 'solve_math',
    keywords: ['solve', 'calculate', 'integrate', 'differentiate', 'derivative', 'integral', 'limit', 'matrix', 'determinant',
      'equation', 'simplify', 'expand', 'factorise', 'factorize', 'find x', 'find y', 'prove', 'probability',
      'trigonometry', 'sin', 'cos', 'tan', 'algebra', 'quadratic', 'polynomial', 'binomial', 'series', 'sum',
      'arithmetic', 'geometric', 'permutation', 'combination', 'vector', 'scalar', 'complex number'],
    targetAgent: 'sage',
    suggestedMode: 'deep_learning',
    confidence: 0.88,
  },

  // ── Physics ──
  {
    intent: 'solve_physics',
    keywords: ['force', 'newton', 'velocity', 'acceleration', 'momentum', 'energy', 'work', 'power', 'current',
      'voltage', 'resistance', 'ohm', 'capacitor', 'inductor', 'magnetic', 'electric field', 'gravitation',
      'optics', 'lens', 'mirror', 'wave', 'frequency', 'wavelength', 'thermodynamics', 'entropy',
      'pressure', 'fluid', 'rotational', 'torque', 'nuclear', 'radioactivity', 'photon'],
    targetAgent: 'sage',
    suggestedMode: 'deep_learning',
    confidence: 0.88,
  },

  // ── Chemistry ──
  {
    intent: 'solve_chemistry',
    keywords: ['reaction', 'equilibrium', 'mole', 'molarity', 'acid', 'base', 'ph', 'buffer', 'titration',
      'organic', 'alkane', 'alkene', 'alkyne', 'benzene', 'functional group', 'isomer', 'polymer',
      'electrochemistry', 'cell', 'electrode', 'oxidation', 'reduction', 'redox', 'periodic table',
      'atomic structure', 'orbital', 'hybridization', 'bond', 'intermolecular', 'thermochemistry', 'enthalpy'],
    targetAgent: 'sage',
    suggestedMode: 'deep_learning',
    confidence: 0.87,
  },

  // ── Biology ──
  {
    intent: 'solve_biology',
    keywords: ['cell', 'mitosis', 'meiosis', 'photosynthesis', 'respiration', 'enzyme', 'dna', 'rna', 'protein',
      'gene', 'chromosome', 'mutation', 'evolution', 'ecosystem', 'food chain', 'hormone', 'nervous system',
      'digestive', 'circulatory', 'reproductive', 'immunity', 'plant', 'animal kingdom', 'taxonomy'],
    targetAgent: 'sage',
    suggestedMode: 'deep_learning',
    confidence: 0.87,
  },

  // ── Concept explanation ──
  {
    intent: 'explain_concept',
    keywords: ['explain', 'what is', 'define', 'meaning of', 'concept', 'how does', 'why does', 'understand',
      'tell me about', 'describe', 'difference between', 'compare', 'contrast'],
    targetAgent: 'sage',
    suggestedMode: 'explanation',
    confidence: 0.82,
  },

  // ── Doubt clearing ──
  {
    intent: 'doubt_clearing',
    keywords: ['doubt', 'confused', 'don\'t understand', 'not getting', 'stuck', 'help me', 'clarify',
      'why is', 'how come', 'i think', 'is this correct', 'am i right'],
    targetAgent: 'sage',
    suggestedMode: 'doubt_clearing',
    confidence: 0.85,
  },

  // ── Quick reference ──
  {
    intent: 'quick_reference',
    keywords: ['formula', 'formula for', 'formula of', 'value of', 'what is the formula', 'constant', 'unit of',
      'periodic table', 'table of', 'standard deviation formula', 'quick', 'just give me'],
    targetAgent: 'sage',
    suggestedMode: 'quick_reference',
    confidence: 0.84,
  },

  // ── Exam strategy ──
  {
    intent: 'exam_strategy',
    keywords: ['strategy', 'how to prepare', 'preparation', 'tips', 'tricks', 'important topics', 'weightage',
      'syllabus', 'cutoff', 'marks', 'score', 'rank', 'jee', 'neet', 'cbse', 'board exam', 'mock test',
      'previous year', 'pyq', 'sample paper', 'time management', 'revision'],
    targetAgent: 'sage',
    suggestedMode: 'exam_prep',
    confidence: 0.83,
  },

  // ── Study plan ──
  {
    intent: 'create_study_plan',
    keywords: ['study plan', 'schedule', 'timetable', 'plan for', 'how many days', 'study routine',
      'weekly plan', 'monthly plan', 'revision plan', 'what to study'],
    targetAgent: 'mentor',
    suggestedMode: 'planning',
    confidence: 0.86,
  },

  // ── Motivation ──
  {
    intent: 'motivation',
    keywords: ['motivate', 'demotivated', 'giving up', 'stressed', 'anxious', 'nervous', 'scared', 'can\'t focus',
      'distracted', 'tired', 'burned out', 'feeling low', 'inspire', 'success story'],
    targetAgent: 'mentor',
    confidence: 0.87,
  },

  // ── Content generation ──
  {
    intent: 'generate_questions',
    keywords: ['generate questions', 'create questions', 'make questions', 'quiz', 'test me', 'question bank',
      'mcq', 'practice questions', 'problems on', 'worksheet'],
    targetAgent: 'atlas',
    confidence: 0.87,
  },
  {
    intent: 'generate_content',
    keywords: ['write a blog', 'create content', 'generate article', 'write an essay', 'create notes',
      'lesson plan', 'course content', 'write about'],
    targetAgent: 'atlas',
    confidence: 0.86,
  },

  // ── Analytics ──
  {
    intent: 'analytics_query',
    keywords: ['analytics', 'metrics', 'report', 'statistics', 'performance', 'how many students', 'engagement',
      'dashboard stats', 'revenue', 'growth', 'trend'],
    targetAgent: 'oracle',
    confidence: 0.88,
  },

  // ── Market research ──
  {
    intent: 'market_research',
    keywords: ['competitor', 'market', 'research', 'trend', 'opportunity', 'edtech', 'landscape', 'analysis'],
    targetAgent: 'scout',
    confidence: 0.87,
  },

  // ── System ──
  {
    intent: 'system_status',
    keywords: ['deploy', 'system', 'server', 'uptime', 'health', 'build', 'ci/cd', 'infrastructure', 'api status'],
    targetAgent: 'forge',
    confidence: 0.88,
  },

  // ── Student progress ──
  {
    intent: 'student_progress',
    keywords: ['student', 'progress', 'streak', 'inactive', 'at risk', 'engagement', 'badge', 'achievement'],
    targetAgent: 'mentor',
    confidence: 0.85,
  },
];

// ─── Scoring ──────────────────────────────────────────────────────────────────

interface ScoredIntent {
  rule: IntentRule;
  score: number;
}

function scoreRule(rule: IntentRule, text: string, modalities: InputModality[]): number {
  const lower = text.toLowerCase();
  let score = 0;

  // Keyword match
  let kwMatches = 0;
  for (const kw of rule.keywords) {
    if (lower.includes(kw)) kwMatches++;
  }
  if (rule.keywords.length > 0) {
    score += (kwMatches / rule.keywords.length) * rule.confidence;
  }

  // Modality bonus
  if (rule.modalities && modalities.length > 0) {
    const modalityMatch = rule.modalities.some(m => modalities.includes(m));
    if (modalityMatch) {
      score += 0.4; // strong bonus for matching modality
    }
  }

  // If rule REQUIRES modality and none present, no score
  if (rule.modalities && rule.keywords.length === 0 && modalities.length === 0) {
    return 0;
  }

  return score;
}

// ─── Main classifier ──────────────────────────────────────────────────────────

export function detectIntent(
  text: string,
  attachments: MediaAttachment[] = [],
  currentAgent?: AgentType
): IntentResult {
  const modalities = attachments.map(a => a.type) as InputModality[];
  const hasImage = modalities.includes('image') || modalities.includes('drawing');
  const hasAudio = modalities.includes('audio');
  const hasFile = modalities.includes('file');

  // Fast path: image with no/minimal text → analyze image
  if (hasImage && text.trim().length < 20) {
    return {
      intent: 'analyze_image',
      confidence: 0.95,
      targetAgent: 'sage',
      suggestedMode: 'doubt_clearing',
      reasoning: 'Image attachment detected with minimal text — routing to visual analysis',
    };
  }

  // Fast path: audio only
  if (hasAudio && text.trim().length === 0) {
    return {
      intent: 'doubt_clearing',
      confidence: 0.85,
      targetAgent: currentAgent || 'sage',
      suggestedMode: 'doubt_clearing',
      reasoning: 'Audio input — will transcribe and process',
    };
  }

  // Score all rules
  const scores: ScoredIntent[] = INTENT_RULES.map(rule => ({
    rule,
    score: scoreRule(rule, text, modalities),
  })).filter(s => s.score > 0);

  scores.sort((a, b) => b.score - a.score);

  if (scores.length === 0 || scores[0].score < 0.1) {
    // Fallback: stay with current agent, general intent
    return {
      intent: 'general',
      confidence: 0.5,
      targetAgent: currentAgent || 'sage',
      reasoning: 'No strong intent match — continuing with current agent',
    };
  }

  const best = scores[0];
  return {
    intent: best.rule.intent,
    confidence: Math.min(best.score, 0.98),
    targetAgent: best.rule.targetAgent,
    suggestedMode: best.rule.suggestedMode,
    reasoning: hasImage
      ? `Image + "${text.slice(0, 40)}" → ${best.rule.intent}`
      : `"${text.slice(0, 60)}" → ${best.rule.intent}`,
  };
}

// ─── Prompt builder for real LLM ─────────────────────────────────────────────

export function buildIntentPrompt(text: string, attachments: MediaAttachment[]): string {
  const attachmentDesc = attachments.map(a => `- ${a.type}: ${a.name}${a.analysis ? ` (AI analysis: ${a.analysis})` : ''}`).join('\n');

  return `You are Prism, the multimodal intent router for EduGenius AI platform.

Analyse the following user input and determine:
1. Their primary intent (what they want to accomplish)
2. Which specialist agent should handle this
3. Which learning mode is most appropriate
4. Your confidence level (0–1)

Available agents: sage (AI tutor), atlas (content), scout (research), herald (marketing), oracle (analytics), forge (devops), mentor (student engagement)

User text: "${text}"
${attachments.length ? `Attachments:\n${attachmentDesc}` : ''}

Respond in JSON:
{
  "intent": "<intent_category>",
  "confidence": <0-1>,
  "targetAgent": "<agent_id>",
  "suggestedMode": "<mode or null>",
  "reasoning": "<one sentence>"
}`;
}

// ─── Image analysis prompt ────────────────────────────────────────────────────

export function buildImageAnalysisPrompt(userText: string, imageContext?: string): string {
  return `You are Sage, an expert AI tutor for Indian competitive exams (JEE, NEET, CBSE).

The student has shared an image${userText ? ` and asked: "${userText}"` : ''}.
${imageContext ? `Image content: ${imageContext}` : ''}

If it's a math/physics/chemistry problem:
1. Identify what's being asked
2. Solve it step by step showing all working
3. State the final answer clearly
4. Point out any errors in the student's work if visible

If it's a diagram/concept map:
1. Identify and explain each component
2. Explain the relationships
3. Connect to exam relevance

If it's handwritten notes:
1. Validate the content for correctness
2. Suggest improvements or missing points

Be encouraging and educational. Format your response with clear steps and highlight key formulas.`;
}

// ─── Output block generator (mock, swap with LLM output parser) ───────────────

export function generateOutputBlocks(response: string, intent: string): import('@/types').OutputBlock[] {
  const blocks: import('@/types').OutputBlock[] = [];

  // Detect math equations (lines with =, ^, √, ∫)
  const mathPattern = /[=\^√∫∑∏±≤≥≠]/;

  // Split response into logical sections
  const lines = response.split('\n');
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      blocks.push({ type: 'text', content: currentParagraph.join('\n') });
      currentParagraph = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith('**Step') || line.match(/^Step \d/i)) {
      flushParagraph();
      blocks.push({ type: 'steps', content: line, items: [] });
    } else if (mathPattern.test(line) && line.trim().length < 100) {
      flushParagraph();
      blocks.push({ type: 'equation', content: line.trim() });
    } else if (line.startsWith('| ') || line.startsWith('|---')) {
      // Table detection
      flushParagraph();
      blocks.push({ type: 'table', content: line });
    } else {
      currentParagraph.push(line);
    }
  }
  flushParagraph();

  // If only one block and it's text, keep it simple
  if (blocks.length === 1) return [{ type: 'text', content: response }];

  return blocks.length > 0 ? blocks : [{ type: 'text', content: response }];
}
