/**
 * Personalization Engine
 * 
 * Core service that adapts responses based on:
 * 1. Learning Mode (knowledge vs exam prep)
 * 2. Student context (mastery, weak areas, preferences)
 * 3. Exam context (proximity, patterns, priorities)
 * 4. Query intent analysis
 */

import type {
  LearningMode,
  ResponseStyle,
  ContentDepth,
  StudentContext,
  ResponseConfig,
  ExamTip,
  TopicExamProfile,
  ModeDetectionSignals,
  ResponseTemplate,
  MODE_KEYWORDS,
  DEEP_LEARNING_TEMPLATE,
  EXAM_PREP_TEMPLATE,
  QUICK_REFERENCE_TEMPLATE,
} from '@/types/personalization';

// ============================================
// MODE DETECTION
// ============================================

export function detectLearningMode(
  query: string,
  signals: ModeDetectionSignals
): LearningMode {
  // 1. Check for explicit mode override
  if (signals.explicitMode) {
    return signals.explicitMode;
  }

  // 2. Keyword analysis
  const queryLower = query.toLowerCase();
  const modeScores: Record<LearningMode, number> = {
    deep_learning: 0,
    exam_prep: 0,
    revision: 0,
    practice: 0,
    doubt_clearing: 0,
    quick_reference: 0,
  };

  // Score based on keywords
  const modeKeywords: Record<LearningMode, string[]> = {
    deep_learning: [
      'explain', 'understand', 'why', 'how does', 'concept', 'theory',
      'intuition', 'derive', 'proof', 'meaning', 'deep', 'fundamentals'
    ],
    exam_prep: [
      'exam', 'test', 'quick', 'shortcut', 'trick', 'tip', 'fast',
      'jee', 'neet', 'boards', 'pattern', 'important', 'expected', 'marks'
    ],
    revision: [
      'revise', 'review', 'refresh', 'summary', 'recap', 'remember',
      'forgot', 'remind', 'key points'
    ],
    practice: [
      'solve', 'problem', 'question', 'practice', 'exercise', 'try',
      'calculate', 'find', 'evaluate', 'answer'
    ],
    doubt_clearing: [
      'doubt', 'confused', 'stuck', 'wrong', 'mistake', 'clarify',
      'not understanding', 'help', 'explain again', 'still'
    ],
    quick_reference: [
      'formula', 'value', 'constant', 'what is', 'define', 'unit',
      'symbol', 'equation', 'give me'
    ],
  };

  for (const [mode, keywords] of Object.entries(modeKeywords)) {
    for (const keyword of keywords) {
      if (queryLower.includes(keyword)) {
        modeScores[mode as LearningMode] += 10;
      }
    }
  }

  // 3. Urgency indicators boost exam_prep
  const urgencyWords = ['quickly', 'fast', 'urgent', 'tomorrow', 'today', 'exam in'];
  for (const word of urgencyWords) {
    if (queryLower.includes(word)) {
      modeScores.exam_prep += 15;
    }
  }

  // 4. Exam proximity boost
  if (signals.daysToExam !== undefined) {
    if (signals.daysToExam <= 7) {
      modeScores.exam_prep += 30;
      modeScores.revision += 20;
    } else if (signals.daysToExam <= 30) {
      modeScores.exam_prep += 15;
    }
  }

  if (signals.isExamWeek) {
    modeScores.exam_prep += 25;
    modeScores.quick_reference += 15;
  }

  // 5. Question type analysis
  if (queryLower.startsWith('why') || queryLower.includes('reason')) {
    modeScores.deep_learning += 20;
  }
  if (queryLower.startsWith('what is') || queryLower.startsWith('define')) {
    modeScores.quick_reference += 15;
  }
  if (queryLower.startsWith('solve') || queryLower.includes('find the')) {
    modeScores.practice += 20;
  }

  // 6. Find highest scoring mode
  let maxScore = 0;
  let detectedMode: LearningMode = 'deep_learning';
  for (const [mode, score] of Object.entries(modeScores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedMode = mode as LearningMode;
    }
  }

  // Default to deep_learning if no strong signals
  if (maxScore < 10) {
    return 'deep_learning';
  }

  return detectedMode;
}

// ============================================
// RESPONSE CONFIGURATION
// ============================================

export function buildResponseConfig(
  mode: LearningMode,
  context: StudentContext
): ResponseConfig {
  const baseConfig: ResponseConfig = {
    mode,
    style: 'detailed',
    depth: 'moderate',
    includeTheory: true,
    includeDerivation: false,
    includeExamples: 2,
    includePracticeProblems: 1,
    includeVisuals: true,
    includeInteractiveResource: true,
    includeExamTips: false,
    includeShortcuts: false,
    includeCommonMistakes: true,
    includePYQReference: false,
    includeTimeEstimate: false,
    maxLength: 'moderate',
    useNumberedSteps: true,
    highlightKeyFormulas: true,
    addMemoryAids: false,
  };

  // Adapt based on mode
  switch (mode) {
    case 'deep_learning':
      return {
        ...baseConfig,
        style: 'detailed',
        depth: 'deep',
        includeTheory: true,
        includeDerivation: true,
        includeExamples: 3,
        includeVisuals: true,
        includeInteractiveResource: true,
        maxLength: 'comprehensive',
      };

    case 'exam_prep':
      return {
        ...baseConfig,
        style: 'tip_focused',
        depth: 'surface',
        includeTheory: false,
        includeDerivation: false,
        includeExamples: 1,
        includePracticeProblems: 0,
        includeVisuals: false,
        includeInteractiveResource: false,
        includeExamTips: true,
        includeShortcuts: true,
        includeCommonMistakes: true,
        includePYQReference: true,
        includeTimeEstimate: true,
        maxLength: 'brief',
        addMemoryAids: true,
      };

    case 'revision':
      return {
        ...baseConfig,
        style: 'concise',
        depth: 'moderate',
        includeTheory: true,
        includeDerivation: false,
        includeExamples: 1,
        includePracticeProblems: 2,
        includeExamTips: true,
        includeCommonMistakes: true,
        maxLength: 'moderate',
        addMemoryAids: true,
      };

    case 'practice':
      return {
        ...baseConfig,
        style: 'step_by_step',
        depth: 'moderate',
        includeTheory: false,
        includeExamples: 0,
        includePracticeProblems: 3,
        includeCommonMistakes: true,
        includeTimeEstimate: true,
        maxLength: 'moderate',
      };

    case 'doubt_clearing':
      return {
        ...baseConfig,
        style: 'detailed',
        depth: 'deep',
        includeTheory: true,
        includeExamples: 2,
        includeVisuals: true,
        includeCommonMistakes: true,
        maxLength: 'detailed',
      };

    case 'quick_reference':
      return {
        ...baseConfig,
        style: 'concise',
        depth: 'surface',
        includeTheory: false,
        includeDerivation: false,
        includeExamples: 0,
        includePracticeProblems: 0,
        includeVisuals: false,
        includeInteractiveResource: false,
        maxLength: 'brief',
        highlightKeyFormulas: true,
      };
  }

  // Further adapt based on time constraints
  if (context.timeAvailable === 'rushed') {
    baseConfig.maxLength = 'brief';
    baseConfig.includeExamples = Math.min(baseConfig.includeExamples, 1);
    baseConfig.includeDerivation = false;
    baseConfig.includeInteractiveResource = false;
  }

  // Adapt based on mastery level
  if (context.masteryLevel.overall === 'beginner') {
    baseConfig.depth = 'moderate';
    baseConfig.includeExamples = Math.max(baseConfig.includeExamples, 2);
    baseConfig.addMemoryAids = true;
  } else if (context.masteryLevel.overall === 'advanced') {
    baseConfig.depth = 'deep';
    baseConfig.includeExamples = Math.min(baseConfig.includeExamples, 1);
  }

  return baseConfig;
}

// ============================================
// EXAM TIPS DATABASE
// ============================================

export const examTipsDatabase: ExamTip[] = [
  // Physics - Mechanics
  {
    id: 'projectile-range',
    type: 'shortcut',
    content: 'For maximum range, launch at 45°. For same range, complementary angles work (30° and 60° give same range).',
    applicableTo: ['Projectile Motion', 'Kinematics'],
    examTypes: ['JEE Main', 'JEE Advanced', 'NEET'],
    importance: 'must_know',
    timeSaving: 30,
    errorReduction: 15,
  },
  {
    id: 'friction-direction',
    type: 'common_trap',
    content: 'Friction opposes RELATIVE motion, not absolute motion. Check direction carefully!',
    applicableTo: ['Friction', 'Newton\'s Laws'],
    examTypes: ['JEE Main', 'NEET'],
    importance: 'must_know',
    timeSaving: 0,
    errorReduction: 40,
  },
  {
    id: 'energy-conservation',
    type: 'pattern',
    content: 'If no non-conservative forces (friction, air resistance), use energy conservation directly. It\'s faster than kinematics.',
    applicableTo: ['Energy', 'Mechanics'],
    examTypes: ['JEE Main', 'JEE Advanced'],
    importance: 'must_know',
    timeSaving: 45,
    errorReduction: 20,
  },
  {
    id: 'shm-quick-formulas',
    type: 'shortcut',
    content: 'For SHM: v_max = ωA, a_max = ω²A. At mean position: v=max, a=0. At extreme: v=0, a=max.',
    applicableTo: ['Simple Harmonic Motion', 'Oscillations'],
    examTypes: ['JEE Main', 'NEET'],
    importance: 'must_know',
    timeSaving: 20,
    errorReduction: 10,
  },

  // Physics - Electromagnetism
  {
    id: 'kirchhoff-sign',
    type: 'common_trap',
    content: 'In Kirchhoff loops: EMF is + when going - to + inside battery. IR drop is - in direction of current.',
    applicableTo: ['Current Electricity', 'Kirchhoff Laws'],
    examTypes: ['JEE Main', 'NEET'],
    importance: 'must_know',
    timeSaving: 0,
    errorReduction: 50,
  },
  {
    id: 'capacitor-series-parallel',
    type: 'shortcut',
    content: 'Capacitors: Series = 1/C_eq = Σ(1/C_i), Parallel = C_eq = ΣC_i. OPPOSITE of resistors!',
    applicableTo: ['Capacitors', 'Electrostatics'],
    examTypes: ['JEE Main', 'NEET'],
    importance: 'must_know',
    timeSaving: 15,
    errorReduction: 30,
  },
  {
    id: 'magnetic-field-direction',
    type: 'shortcut',
    content: 'Right-hand rule: Thumb = current, Fingers curl = magnetic field direction. For force: F = qv × B (right-hand)',
    applicableTo: ['Magnetism', 'Electromagnetic Induction'],
    examTypes: ['JEE Main', 'JEE Advanced', 'NEET'],
    importance: 'must_know',
    timeSaving: 10,
    errorReduction: 25,
  },

  // Chemistry - Physical
  {
    id: 'ph-quick-calc',
    type: 'shortcut',
    content: 'For weak acid: pH ≈ ½(pKa - log C). For buffer: pH = pKa + log([salt]/[acid]). Memorize Henderson-Hasselbalch!',
    applicableTo: ['Ionic Equilibrium', 'pH', 'Buffers'],
    examTypes: ['JEE Main', 'NEET'],
    importance: 'must_know',
    timeSaving: 40,
    errorReduction: 20,
  },
  {
    id: 'rate-law-order',
    type: 'pattern',
    content: 'Zero order: [A] vs t linear. First order: ln[A] vs t linear, t½ = 0.693/k. Second order: 1/[A] vs t linear.',
    applicableTo: ['Chemical Kinetics', 'Rate Laws'],
    examTypes: ['JEE Main', 'NEET'],
    importance: 'must_know',
    timeSaving: 30,
    errorReduction: 15,
  },

  // Chemistry - Organic
  {
    id: 'sn1-sn2-decide',
    type: 'pattern',
    content: 'SN1: 3° > 2° > 1° (carbocation stability). SN2: 1° > 2° > 3° (steric hindrance). Polar protic → SN1, Polar aprotic → SN2.',
    applicableTo: ['Organic Reactions', 'Nucleophilic Substitution'],
    examTypes: ['JEE Main', 'JEE Advanced', 'NEET'],
    importance: 'must_know',
    timeSaving: 25,
    errorReduction: 35,
  },
  {
    id: 'markovnikov-rule',
    type: 'shortcut',
    content: 'Markovnikov: H goes to C with more H\'s (rich get richer). Anti-Markovnikov: with peroxides, H goes to C with fewer H\'s.',
    applicableTo: ['Alkenes', 'Addition Reactions'],
    examTypes: ['JEE Main', 'NEET'],
    importance: 'must_know',
    timeSaving: 15,
    errorReduction: 25,
  },

  // Mathematics
  {
    id: 'quadratic-discriminant',
    type: 'shortcut',
    content: 'D = b² - 4ac. D > 0: 2 real roots. D = 0: 1 repeated root. D < 0: complex roots. Check D first!',
    applicableTo: ['Quadratic Equations', 'Algebra'],
    examTypes: ['JEE Main', 'JEE Advanced'],
    importance: 'must_know',
    timeSaving: 20,
    errorReduction: 10,
  },
  {
    id: 'integration-by-parts',
    type: 'shortcut',
    content: 'ILATE priority: Inverse trig > Log > Algebraic > Trig > Exponential. Choose u from left, dv from right.',
    applicableTo: ['Integration', 'Calculus'],
    examTypes: ['JEE Main', 'JEE Advanced'],
    importance: 'must_know',
    timeSaving: 25,
    errorReduction: 20,
  },
  {
    id: 'determinant-properties',
    type: 'shortcut',
    content: 'Row/column of zeros → det = 0. Two identical rows → det = 0. Swapping rows changes sign. Factor out constants!',
    applicableTo: ['Matrices', 'Determinants'],
    examTypes: ['JEE Main', 'JEE Advanced'],
    importance: 'must_know',
    timeSaving: 35,
    errorReduction: 15,
  },
  {
    id: 'limits-lhopital',
    type: 'pattern',
    content: 'L\'Hopital works for 0/0 or ∞/∞ forms ONLY. For 0×∞, rewrite as 0/(1/∞) first. For 1^∞, use e^ln() form.',
    applicableTo: ['Limits', 'Calculus'],
    examTypes: ['JEE Main', 'JEE Advanced'],
    importance: 'must_know',
    timeSaving: 30,
    errorReduction: 25,
  },

  // Time Management
  {
    id: 'jee-time-allocation',
    type: 'time_management',
    content: 'JEE Main: ~2 min/question. Physics: start with easy mechanics. Chemistry: organic/inorganic first. Math: coordinate geometry is usually fastest.',
    applicableTo: ['All'],
    examTypes: ['JEE Main'],
    importance: 'must_know',
    timeSaving: 300,
    errorReduction: 10,
  },
  {
    id: 'neet-time-allocation',
    type: 'time_management',
    content: 'NEET: ~1.5 min/question. Start with your strongest subject. Biology first (90 questions), then Chem/Physics.',
    applicableTo: ['All'],
    examTypes: ['NEET'],
    importance: 'must_know',
    timeSaving: 240,
    errorReduction: 10,
  },
];

// ============================================
// RESPONSE GENERATOR
// ============================================

export interface GeneratedResponse {
  mode: LearningMode;
  content: string;
  sections: ResponseSection[];
  examTips?: ExamTip[];
  interactiveResources?: string[];
  practiceProblems?: string[];
  estimatedReadTime: number;
  followUpSuggestions: string[];
}

interface ResponseSection {
  id: string;
  title: string;
  content: string;
  icon?: string;
}

export function generateResponseStructure(
  query: string,
  topic: string,
  mode: LearningMode,
  config: ResponseConfig,
  context: StudentContext
): GeneratedResponse {
  const sections: ResponseSection[] = [];
  let examTips: ExamTip[] = [];

  if (mode === 'deep_learning') {
    sections.push(
      { id: 'concept', title: '📚 Core Concept', content: '', icon: '📚' },
      { id: 'intuition', title: '💡 Intuition', content: '', icon: '💡' },
      { id: 'derivation', title: '📝 Derivation', content: '', icon: '📝' },
      { id: 'examples', title: '✏️ Worked Examples', content: '', icon: '✏️' },
      { id: 'visualization', title: '📊 Visualization', content: '', icon: '📊' },
      { id: 'connections', title: '🔗 Related Topics', content: '', icon: '🔗' },
      { id: 'practice', title: '🎯 Try These', content: '', icon: '🎯' }
    );
  } else if (mode === 'exam_prep') {
    sections.push(
      { id: 'quick_answer', title: '⚡ Quick Answer', content: '', icon: '⚡' },
      { id: 'formula', title: '📐 Key Formula', content: '', icon: '📐' },
      { id: 'shortcut', title: '🚀 Shortcut', content: '', icon: '🚀' },
      { id: 'steps', title: '📋 Quick Steps', content: '', icon: '📋' },
      { id: 'watch_out', title: '⚠️ Watch Out', content: '', icon: '⚠️' },
      { id: 'time', title: '⏱️ Time Estimate', content: '', icon: '⏱️' },
      { id: 'pyq', title: '📖 Previous Year Pattern', content: '', icon: '📖' }
    );

    // Get relevant exam tips
    examTips = examTipsDatabase.filter(
      (tip) => tip.applicableTo.some((t) => topic.toLowerCase().includes(t.toLowerCase())) ||
               tip.applicableTo.includes('All')
    );

    // Filter by exam type if available
    if (context.examInfo?.examType) {
      examTips = examTips.filter((tip) =>
        tip.examTypes.includes(context.examInfo!.examType)
      );
    }
  } else if (mode === 'quick_reference') {
    sections.push(
      { id: 'formula', title: '📐 Formula', content: '', icon: '📐' },
      { id: 'variables', title: '🔤 Variables', content: '', icon: '🔤' },
      { id: 'units', title: '📏 Units', content: '', icon: '📏' }
    );
  } else if (mode === 'revision') {
    sections.push(
      { id: 'summary', title: '📝 Summary', content: '', icon: '📝' },
      { id: 'key_points', title: '🔑 Key Points', content: '', icon: '🔑' },
      { id: 'formulas', title: '📐 Important Formulas', content: '', icon: '📐' },
      { id: 'common_mistakes', title: '⚠️ Common Mistakes', content: '', icon: '⚠️' },
      { id: 'memory_aids', title: '🧠 Memory Aids', content: '', icon: '🧠' },
      { id: 'quick_quiz', title: '❓ Quick Quiz', content: '', icon: '❓' }
    );
  } else if (mode === 'practice') {
    sections.push(
      { id: 'approach', title: '🎯 Approach', content: '', icon: '🎯' },
      { id: 'solution', title: '📝 Step-by-Step Solution', content: '', icon: '📝' },
      { id: 'verification', title: '✅ Verify Your Answer', content: '', icon: '✅' },
      { id: 'similar', title: '🔄 Similar Problems', content: '', icon: '🔄' }
    );
  } else if (mode === 'doubt_clearing') {
    sections.push(
      { id: 'clarification', title: '💡 Clarification', content: '', icon: '💡' },
      { id: 'where_confusion', title: '🤔 Common Confusion Points', content: '', icon: '🤔' },
      { id: 'correct_understanding', title: '✅ Correct Understanding', content: '', icon: '✅' },
      { id: 'analogy', title: '🔗 Simple Analogy', content: '', icon: '🔗' },
      { id: 'examples', title: '✏️ Clarifying Examples', content: '', icon: '✏️' }
    );
  }

  // Calculate read time based on config
  const readTimeMap = {
    brief: 1,
    moderate: 3,
    detailed: 5,
    comprehensive: 8,
  };

  // Generate follow-up suggestions based on mode
  const followUpSuggestions = generateFollowUpSuggestions(mode, topic, context);

  return {
    mode,
    content: '',
    sections,
    examTips: examTips.length > 0 ? examTips : undefined,
    interactiveResources: config.includeInteractiveResource ? [] : undefined,
    practiceProblems: config.includePracticeProblems > 0 ? [] : undefined,
    estimatedReadTime: readTimeMap[config.maxLength],
    followUpSuggestions,
  };
}

function generateFollowUpSuggestions(
  mode: LearningMode,
  topic: string,
  context: StudentContext
): string[] {
  const suggestions: string[] = [];

  if (mode === 'deep_learning') {
    suggestions.push(
      `Try some practice problems on ${topic}`,
      `Explore the interactive simulation`,
      `See how ${topic} connects to other concepts`
    );
  } else if (mode === 'exam_prep') {
    suggestions.push(
      `Practice previous year questions`,
      `Time yourself on similar problems`,
      `Review common mistakes`
    );
  } else if (mode === 'revision') {
    suggestions.push(
      `Test yourself with a quick quiz`,
      `Move to the next topic`,
      `Revisit weak areas`
    );
  } else if (mode === 'practice') {
    suggestions.push(
      `Try a harder problem`,
      `Understand the concept deeper`,
      `Get exam tips for this type`
    );
  }

  return suggestions;
}

// ============================================
// PROMPT BUILDER FOR AI
// ============================================

export function buildPersonalizedPrompt(
  query: string,
  topic: string,
  mode: LearningMode,
  config: ResponseConfig,
  context: StudentContext
): string {
  let systemPrompt = `You are Sage, an AI tutor for ${context.examInfo?.examType || 'competitive exams'}.\n\n`;

  // Mode-specific instructions
  if (mode === 'deep_learning') {
    systemPrompt += `LEARNING MODE: Deep Understanding
- Explain concepts thoroughly with intuition first
- Use analogies and real-world connections
- Derive formulas step-by-step
- Include 2-3 worked examples
- Suggest interactive visualizations
- Connect to related topics
- Encourage exploration and curiosity`;
  } else if (mode === 'exam_prep') {
    systemPrompt += `LEARNING MODE: Exam Preparation
- Be CONCISE and DIRECT
- Lead with the formula/answer
- Provide shortcuts and time-saving tricks
- Highlight common mistakes to avoid
- Reference previous year question patterns
- Include time estimates
- Use bullet points, not paragraphs
- Add memory aids/mnemonics
- Maximum 150 words total`;
  } else if (mode === 'quick_reference') {
    systemPrompt += `LEARNING MODE: Quick Reference
- Give ONLY the formula/definition
- List variables with meanings
- Include units
- No explanations unless asked
- Maximum 50 words`;
  } else if (mode === 'revision') {
    systemPrompt += `LEARNING MODE: Revision
- Summarize key points concisely
- List important formulas
- Highlight common mistakes
- Add memory aids
- Include a quick self-test question`;
  } else if (mode === 'practice') {
    systemPrompt += `LEARNING MODE: Practice
- Focus on the solution approach
- Give step-by-step solution
- Include verification method
- Suggest similar problems
- Show time estimate`;
  } else if (mode === 'doubt_clearing') {
    systemPrompt += `LEARNING MODE: Doubt Clearing
- Address the specific confusion
- Explain common misconceptions
- Use simple analogies
- Give clarifying examples
- Be patient and thorough`;
  }

  // Add student context
  systemPrompt += `\n\nSTUDENT CONTEXT:
- Mastery Level: ${context.masteryLevel.overall}
- Time Available: ${context.timeAvailable}`;

  if (context.examInfo) {
    systemPrompt += `
- Exam: ${context.examInfo.examType}
- Days to Exam: ${context.examInfo.daysRemaining || 'Not set'}`;
  }

  if (context.weakAreas.length > 0) {
    systemPrompt += `
- Weak Areas: ${context.weakAreas.join(', ')}`;
  }

  // Add response format instructions
  systemPrompt += `\n\nFORMAT:
- ${config.useNumberedSteps ? 'Use numbered steps' : 'Use bullet points'}
- ${config.highlightKeyFormulas ? 'Highlight formulas in **bold**' : ''}
- ${config.addMemoryAids ? 'Include mnemonics or memory tricks' : ''}
- Max Length: ${config.maxLength}`;

  return systemPrompt;
}

// ============================================
// EXPORT
// ============================================

export const PersonalizationEngine = {
  detectLearningMode,
  buildResponseConfig,
  generateResponseStructure,
  buildPersonalizedPrompt,
  examTipsDatabase,
};

export default PersonalizationEngine;
