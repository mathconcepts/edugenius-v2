/**
 * Teaching Materials Types - Interactive simulations, applets, and resources
 * Supports Wolfram, GeoGebra, PhET, and custom interactive content
 */

// ============================================
// INTERACTIVE RESOURCE TYPES
// ============================================

export type ResourceProvider = 
  | 'wolfram'           // Wolfram Alpha / Demonstrations
  | 'geogebra'          // GeoGebra applets
  | 'phet'              // PhET simulations
  | 'desmos'            // Desmos calculators/graphs
  | 'mathigon'          // Mathigon interactive courses
  | 'khan'              // Khan Academy resources
  | 'custom'            // Custom-built interactives
  | 'youtube'           // Video resources
  | 'threejs';          // 3D visualizations

export type ResourceType = 
  | 'simulation'        // Physics/chemistry simulations
  | 'applet'            // Interactive math applets
  | 'calculator'        // Graphing/scientific calculators
  | 'visualization'     // Data/concept visualizations
  | 'animation'         // Animated explanations
  | 'manipulative'      // Virtual manipulatives
  | 'game'              // Educational games
  | 'quiz_interactive'  // Interactive quizzes
  | 'diagram'           // Interactive diagrams
  | 'model_3d';         // 3D models

export interface InteractiveResource {
  id: string;
  name: string;
  description: string;
  provider: ResourceProvider;
  type: ResourceType;
  
  // Embedding
  embedUrl: string;
  embedCode?: string;
  apiEndpoint?: string;
  
  // Content mapping
  subjects: string[];
  topics: string[];
  subtopics: string[];
  concepts: string[];
  
  // Difficulty & grade
  difficultyRange: {
    min: 'beginner' | 'intermediate' | 'advanced' | 'olympiad';
    max: 'beginner' | 'intermediate' | 'advanced' | 'olympiad';
  };
  gradeRange: {
    min: number;  // e.g., 6
    max: number;  // e.g., 12
  };
  
  // Exam relevance
  examRelevance: ExamRelevance[];
  
  // Usage tracking
  usageCount: number;
  avgEngagementSeconds: number;
  effectivenessScore: number;  // 0-100 based on learning outcomes
  
  // Metadata
  thumbnailUrl?: string;
  tags: string[];
  language: string;
  isOfflineAvailable: boolean;
  lastUpdated: Date;
}

export interface ExamRelevance {
  examType: string;           // 'JEE', 'NEET', 'CBSE', etc.
  relevanceScore: number;     // 0-100
  yearsAppeared: number[];    // Years this concept appeared in exam
  questionTypes: string[];    // 'MCQ', 'Numerical', etc.
}

// ============================================
// WOLFRAM RESOURCES
// ============================================

export interface WolframResource extends InteractiveResource {
  provider: 'wolfram';
  wolframId: string;
  computationQuery?: string;    // For Wolfram Alpha queries
  demonstrationUrl?: string;    // For Wolfram Demonstrations
  notebookUrl?: string;         // For Wolfram Notebooks
  parameters: WolframParameter[];
}

export interface WolframParameter {
  name: string;
  type: 'slider' | 'checkbox' | 'dropdown' | 'number';
  defaultValue: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  description: string;
}

// ============================================
// GEOGEBRA RESOURCES
// ============================================

export interface GeoGebraResource extends InteractiveResource {
  provider: 'geogebra';
  geogebraId: string;
  materialType: 'worksheet' | 'book' | 'activity' | 'app';
  showToolbar: boolean;
  showMenubar: boolean;
  allowStyleBar: boolean;
  enableDragging: boolean;
  customizable: boolean;
}

// ============================================
// PHET SIMULATIONS
// ============================================

export interface PhETResource extends InteractiveResource {
  provider: 'phet';
  phetId: string;
  simulationName: string;
  category: 'physics' | 'chemistry' | 'biology' | 'math' | 'earth-science';
  htmlVersion: boolean;
  javaVersion: boolean;
  downloadUrl?: string;
}

// ============================================
// TEACHING STRATEGY
// ============================================

export type TeachingApproach = 
  | 'socratic'          // Guided questioning
  | 'scaffolded'        // Step-by-step building
  | 'discovery'         // Let student explore
  | 'direct'            // Direct instruction
  | 'problem_based'     // Start with problem
  | 'flipped'           // Pre-learning + practice
  | 'spiral';           // Revisit with increasing depth

export interface TeachingStrategy {
  id: string;
  name: string;
  description: string;
  approach: TeachingApproach;
  
  // When to use
  bestFor: {
    conceptTypes: string[];       // 'abstract', 'procedural', 'factual'
    learnerTypes: string[];       // 'visual', 'kinesthetic', 'auditory'
    difficultyLevels: string[];
    timeAvailable: 'short' | 'medium' | 'long';
  };
  
  // Strategy flow
  phases: TeachingPhase[];
  
  // Interactive resources used
  resourcesUsed: string[];        // Resource IDs
  
  // Effectiveness
  successRate: number;
  avgTimeMinutes: number;
  studentSatisfactionScore: number;
}

export interface TeachingPhase {
  order: number;
  name: string;
  description: string;
  durationMinutes: number;
  
  // Content
  activities: TeachingActivity[];
  
  // Checkpoints
  understandingCheck?: string;
  successCriteria?: string[];
}

export interface TeachingActivity {
  type: 'explain' | 'demonstrate' | 'practice' | 'discuss' | 'explore' | 'assess' | 'reflect';
  content: string;
  resourceId?: string;            // Link to interactive resource
  aiPrompt?: string;              // For AI-driven activities
  hints: string[];
  timeMinutes: number;
}

// ============================================
// CONTENT ENHANCEMENT
// ============================================

export interface EnhancedContent {
  problemId: string;
  
  // Interactive enhancements
  interactiveResources: ResourceRecommendation[];
  
  // Visual aids
  diagrams: DiagramResource[];
  animations: AnimationResource[];
  
  // Step-by-step
  visualizedSteps: VisualizedStep[];
  
  // Real-world connections
  realWorldExamples: RealWorldExample[];
  
  // Historical context
  historicalContext?: HistoricalContext;
  
  // Cross-topic connections
  conceptConnections: ConceptConnection[];
}

export interface ResourceRecommendation {
  resourceId: string;
  resource: InteractiveResource;
  relevanceScore: number;
  useCase: string;              // How to use this resource for the problem
  timestamp?: string;           // When in the explanation to show it
}

export interface DiagramResource {
  id: string;
  type: 'static' | 'interactive' | 'animated';
  url: string;
  caption: string;
  interactivePoints?: InteractivePoint[];
}

export interface InteractivePoint {
  x: number;
  y: number;
  label: string;
  tooltip: string;
  linkedResourceId?: string;
}

export interface AnimationResource {
  id: string;
  url: string;
  duration: number;
  keyMoments: KeyMoment[];
  isLooping: boolean;
  controlsEnabled: boolean;
}

export interface KeyMoment {
  timestamp: number;
  description: string;
  pauseHere: boolean;
}

export interface VisualizedStep {
  stepNumber: number;
  textExplanation: string;
  latexFormula?: string;
  visualType: 'diagram' | 'animation' | 'graph' | 'table' | 'code';
  visualContent: string;
  interactiveResourceId?: string;
  voiceOverText?: string;
}

export interface RealWorldExample {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  videoUrl?: string;
  industry: string;             // 'engineering', 'medicine', 'finance', etc.
  difficultyContext: string;    // How this applies at different levels
}

export interface HistoricalContext {
  discoverer: string;
  year: number;
  story: string;
  funFact?: string;
  imageUrl?: string;
}

export interface ConceptConnection {
  fromConcept: string;
  toConcept: string;
  relationshipType: 'builds_on' | 'similar_to' | 'opposite_of' | 'applies_to' | 'generalizes';
  explanation: string;
}

// ============================================
// WOW FACTOR ELEMENTS
// ============================================

export interface WowElement {
  id: string;
  type: WowElementType;
  trigger: WowTrigger;
  content: WowContent;
  celebrationLevel: 'subtle' | 'moderate' | 'exciting' | 'epic';
}

export type WowElementType = 
  | 'achievement_unlock'
  | 'streak_celebration'
  | 'mastery_breakthrough'
  | 'pattern_discovery'
  | 'speed_record'
  | 'accuracy_milestone'
  | 'exploration_reward'
  | 'challenge_complete';

export type WowTrigger = 
  | 'problem_solved'
  | 'concept_mastered'
  | 'streak_reached'
  | 'time_record'
  | 'accuracy_threshold'
  | 'exploration_complete'
  | 'hint_unused'
  | 'first_try_correct';

export interface WowContent {
  title: string;
  message: string;
  animation: string;            // Lottie animation URL
  sound?: string;               // Sound effect URL
  confetti?: boolean;
  badge?: {
    name: string;
    icon: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
  };
  xpReward?: number;
  shareMessage?: string;        // For social sharing
}

// ============================================
// RESOURCE CATALOG
// ============================================

export interface ResourceCatalog {
  categories: ResourceCategory[];
  featured: string[];           // Featured resource IDs
  trending: string[];           // Trending resource IDs
  newlyAdded: string[];
  totalCount: number;
}

export interface ResourceCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  resourceCount: number;
  subcategories: ResourceSubcategory[];
}

export interface ResourceSubcategory {
  id: string;
  name: string;
  resourceIds: string[];
}
