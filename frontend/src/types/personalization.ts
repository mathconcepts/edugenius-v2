/**
 * Personalization Types - Context-Aware Learning Modes
 * 
 * Core principle: Same question, different response based on:
 * 1. Learning Mode (knowledge vs exam prep)
 * 2. Time constraints
 * 3. Student's current mastery level
 * 4. Exam proximity
 */

// ============================================
// LEARNING MODES
// ============================================

export type LearningMode = 
  | 'deep_learning'      // Conceptual understanding, exploration
  | 'exam_prep'          // Quick tips, tricks, patterns
  | 'revision'           // Refresh and consolidate
  | 'practice'           // Problem-solving focus
  | 'doubt_clearing'     // Specific question clarification
  | 'quick_reference';   // Formula lookup, one-liner answers

export type ResponseStyle = 
  | 'detailed'           // Full explanation with examples
  | 'concise'            // Key points only
  | 'step_by_step'       // Procedural breakdown
  | 'tip_focused'        // Exam tips and shortcuts
  | 'visual'             // Diagram/graph heavy
  | 'comparative';       // Compare with similar concepts

export type ContentDepth = 'surface' | 'moderate' | 'deep' | 'exhaustive';

// ============================================
// STUDENT CONTEXT
// ============================================

export interface StudentContext {
  // Current session
  currentMode: LearningMode;
  sessionObjective: SessionObjective;
  timeAvailable: 'rushed' | 'normal' | 'ample';
  
  // Student profile
  masteryLevel: MasteryLevel;
  preferredStyle: ResponseStyle;
  weakAreas: string[];
  strongAreas: string[];
  
  // Exam context
  examInfo?: ExamContext;
  
  // Interaction history
  recentTopics: string[];
  confusionPoints: string[];
  frequentMistakes: MistakePattern[];
}

export interface SessionObjective {
  type: 'learn' | 'practice' | 'revise' | 'exam_prep' | 'doubt';
  topic?: string;
  targetOutcome: string;
  timeLimit?: number; // minutes
}

export interface MasteryLevel {
  overall: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  byTopic: Record<string, number>; // 0-100 mastery score
  bySubject: Record<string, number>;
}

export interface ExamContext {
  examType: string;           // 'JEE Main', 'NEET', 'CBSE 12', etc.
  examDate?: Date;
  daysRemaining?: number;
  targetScore?: number;
  currentPredictedScore?: number;
  priorityTopics: string[];   // Topics to focus on
  lowWeightTopics: string[];  // Topics to skip/skim
}

export interface MistakePattern {
  type: string;               // 'calculation', 'concept', 'reading', 'time'
  topic: string;
  frequency: number;
  lastOccurred: Date;
  suggestion: string;
}

// ============================================
// RESPONSE CONFIGURATION
// ============================================

export interface ResponseConfig {
  mode: LearningMode;
  style: ResponseStyle;
  depth: ContentDepth;
  
  // What to include
  includeTheory: boolean;
  includeDerivation: boolean;
  includeExamples: number;    // 0, 1, 2, 3+
  includePracticeProblems: number;
  includeVisuals: boolean;
  includeInteractiveResource: boolean;
  
  // Exam-specific
  includeExamTips: boolean;
  includeShortcuts: boolean;
  includeCommonMistakes: boolean;
  includePYQReference: boolean;  // Previous Year Questions
  includeTimeEstimate: boolean;
  
  // Formatting
  maxLength: 'brief' | 'moderate' | 'detailed' | 'comprehensive';
  useNumberedSteps: boolean;
  highlightKeyFormulas: boolean;
  addMemoryAids: boolean;      // Mnemonics, tricks
}

// ============================================
// EXAM-SPECIFIC TIPS STRUCTURE
// ============================================

export interface ExamTip {
  id: string;
  type: ExamTipType;
  content: string;
  applicableTo: string[];     // Topics/concepts
  examTypes: string[];        // Which exams this applies to
  importance: 'must_know' | 'good_to_know' | 'edge_case';
  timeSaving: number;         // Seconds saved per use
  errorReduction: number;     // % error reduction
}

export type ExamTipType = 
  | 'shortcut'               // Calculation shortcut
  | 'pattern'                // Question pattern recognition
  | 'elimination'            // Wrong answer elimination
  | 'approximation'          // Quick estimation
  | 'sign_check'             // Verify answer quickly
  | 'unit_analysis'          // Dimensional analysis
  | 'graph_reading'          // Extract info from graphs
  | 'option_analysis'        // Work backwards from options
  | 'time_management'        // When to skip/guess
  | 'common_trap';           // Avoid common mistakes

export interface TopicExamProfile {
  topic: string;
  examType: string;
  
  // Historical data
  averageQuestionsPerYear: number;
  typicalMarks: number;
  difficultyTrend: 'easier' | 'stable' | 'harder';
  
  // Question patterns
  commonQuestionTypes: QuestionPattern[];
  
  // Preparation strategy
  minimumPrepTime: number;    // hours for basic coverage
  optimalPrepTime: number;    // hours for mastery
  diminishingReturnsAfter: number;
  
  // Tips
  mustKnowConcepts: string[];
  frequentlyTested: string[];
  rarelyTested: string[];
  examTips: ExamTip[];
}

export interface QuestionPattern {
  pattern: string;
  frequency: number;          // % of questions
  avgTimeToSolve: number;     // seconds
  difficulty: 'easy' | 'medium' | 'hard';
  approach: string;           // How to solve
  exampleYears: number[];     // Years this appeared
}

// ============================================
// ADAPTIVE RESPONSE TEMPLATES
// ============================================

export interface ResponseTemplate {
  mode: LearningMode;
  structure: ResponseSection[];
  tone: 'academic' | 'friendly' | 'concise' | 'encouraging';
  formatRules: FormatRule[];
}

export interface ResponseSection {
  id: string;
  name: string;
  required: boolean;
  maxLength?: number;
  condition?: string;         // When to include
  template: string;
}

export interface FormatRule {
  rule: string;
  priority: number;
}

// Deep Learning Mode Template
export const DEEP_LEARNING_TEMPLATE: ResponseTemplate = {
  mode: 'deep_learning',
  structure: [
    { id: 'hook', name: 'Engaging Hook', required: true, maxLength: 100, template: 'Start with an intriguing question or real-world connection' },
    { id: 'intuition', name: 'Build Intuition', required: true, template: 'Explain the "why" before the "what"' },
    { id: 'concept', name: 'Core Concept', required: true, template: 'Clear explanation with analogies' },
    { id: 'derivation', name: 'Derivation/Proof', required: false, condition: 'if formula-based', template: 'Step-by-step derivation' },
    { id: 'visual', name: 'Visual Representation', required: true, template: 'Diagram, graph, or interactive' },
    { id: 'examples', name: 'Worked Examples', required: true, template: '2-3 examples of increasing difficulty' },
    { id: 'connections', name: 'Topic Connections', required: true, template: 'Link to related concepts' },
    { id: 'practice', name: 'Practice Suggestion', required: false, template: 'Recommended problems to try' },
  ],
  tone: 'friendly',
  formatRules: [
    { rule: 'Use analogies and real-world examples', priority: 1 },
    { rule: 'Explain intuition before formulas', priority: 2 },
    { rule: 'Include "why this matters" sections', priority: 3 },
    { rule: 'Encourage exploration', priority: 4 },
  ],
};

// Exam Prep Mode Template
export const EXAM_PREP_TEMPLATE: ResponseTemplate = {
  mode: 'exam_prep',
  structure: [
    { id: 'quick_answer', name: 'Direct Answer', required: true, maxLength: 50, template: 'One-line answer or formula' },
    { id: 'key_formula', name: 'Key Formula(s)', required: true, template: 'Highlighted, exam-ready format' },
    { id: 'shortcut', name: 'Shortcut/Trick', required: true, template: 'Time-saving method' },
    { id: 'pattern', name: 'Question Pattern', required: true, template: 'How to recognize this type' },
    { id: 'steps', name: 'Quick Steps', required: true, maxLength: 200, template: 'Numbered steps, no fluff' },
    { id: 'common_mistakes', name: 'Watch Out', required: true, template: 'Common errors to avoid' },
    { id: 'time_estimate', name: 'Time to Solve', required: true, template: 'Expected time in exam' },
    { id: 'pyq', name: 'PYQ Reference', required: false, template: 'Similar previous year questions' },
  ],
  tone: 'concise',
  formatRules: [
    { rule: 'Lead with the answer/formula', priority: 1 },
    { rule: 'Maximum 5-7 bullet points', priority: 2 },
    { rule: 'Use ⚡ for shortcuts, ⚠️ for warnings', priority: 3 },
    { rule: 'Include time estimates', priority: 4 },
    { rule: 'Reference exam patterns', priority: 5 },
  ],
};

// Quick Reference Mode Template
export const QUICK_REFERENCE_TEMPLATE: ResponseTemplate = {
  mode: 'quick_reference',
  structure: [
    { id: 'formula', name: 'Formula/Definition', required: true, maxLength: 100, template: 'The exact formula or definition' },
    { id: 'variables', name: 'Variables', required: true, template: 'What each symbol means' },
    { id: 'units', name: 'Units', required: false, template: 'SI units if applicable' },
    { id: 'quick_example', name: 'One Example', required: false, maxLength: 100, template: 'Single quick example' },
  ],
  tone: 'concise',
  formatRules: [
    { rule: 'One formula per response', priority: 1 },
    { rule: 'No explanations unless asked', priority: 2 },
    { rule: 'Use code blocks for formulas', priority: 3 },
  ],
};

// ============================================
// MODE DETECTION
// ============================================

export interface ModeDetectionSignals {
  // Explicit signals (user says it)
  explicitMode?: LearningMode;
  
  // Query analysis
  queryKeywords: string[];
  questionType: 'what' | 'why' | 'how' | 'solve' | 'formula' | 'tip' | 'quick';
  urgencyIndicators: string[];
  
  // Context signals
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  sessionDuration: number;    // minutes in current session
  questionsAskedInSession: number;
  
  // Exam proximity
  daysToExam?: number;
  isExamWeek: boolean;
  
  // Historical
  typicalModeAtThisTime: LearningMode;
  recentModeHistory: LearningMode[];
}

// Keywords that indicate different modes
export const MODE_KEYWORDS: Record<LearningMode, string[]> = {
  deep_learning: [
    'explain', 'understand', 'why', 'how does', 'concept', 'theory',
    'intuition', 'derive', 'proof', 'meaning', 'deep', 'fundamentals'
  ],
  exam_prep: [
    'exam', 'test', 'quick', 'shortcut', 'trick', 'tip', 'fast',
    'jee', 'neet', 'boards', 'pattern', 'important', 'expected'
  ],
  revision: [
    'revise', 'review', 'refresh', 'summary', 'recap', 'remember',
    'forgot', 'remind', 'key points'
  ],
  practice: [
    'solve', 'problem', 'question', 'practice', 'exercise', 'try',
    'calculate', 'find', 'evaluate'
  ],
  doubt_clearing: [
    'doubt', 'confused', 'stuck', 'wrong', 'mistake', 'clarify',
    'not understanding', 'help', 'explain again'
  ],
  quick_reference: [
    'formula', 'value', 'constant', 'what is', 'define', 'unit',
    'symbol', 'equation'
  ],
};

// ============================================
// PERSONALIZATION ENGINE CONFIG
// ============================================

export interface PersonalizationConfig {
  // Mode detection
  autoDetectMode: boolean;
  defaultMode: LearningMode;
  modeOverrideAllowed: boolean;
  
  // Response customization
  adaptToMasteryLevel: boolean;
  adaptToTimeConstraints: boolean;
  adaptToExamProximity: boolean;
  
  // Content selection
  prioritizeWeakAreas: boolean;
  skipMasteredBasics: boolean;
  includeStretchContent: boolean;
  
  // Exam features
  enableExamTips: boolean;
  enablePYQReferences: boolean;
  enableTimeEstimates: boolean;
  enableDifficultyRating: boolean;
  
  // Feedback loop
  trackEffectiveness: boolean;
  adaptFromFeedback: boolean;
}

export const DEFAULT_PERSONALIZATION_CONFIG: PersonalizationConfig = {
  autoDetectMode: true,
  defaultMode: 'deep_learning',
  modeOverrideAllowed: true,
  adaptToMasteryLevel: true,
  adaptToTimeConstraints: true,
  adaptToExamProximity: true,
  prioritizeWeakAreas: true,
  skipMasteredBasics: false,
  includeStretchContent: true,
  enableExamTips: true,
  enablePYQReferences: true,
  enableTimeEstimates: true,
  enableDifficultyRating: true,
  trackEffectiveness: true,
  adaptFromFeedback: true,
};
