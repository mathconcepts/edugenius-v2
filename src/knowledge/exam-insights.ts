/**
 * Exam Insights & Best Practices System
 * Curated wisdom from toppers, teachers, and AI analysis
 */

import { EventEmitter } from 'events';
import type { ExamType, Subject, DifficultyLevel } from '../users/types';

// ============================================
// TYPES
// ============================================

export type InsightCategory = 
  | 'strategy'           // Overall exam strategy
  | 'time_management'    // Time allocation tips
  | 'topic_priority'     // High-yield topics
  | 'common_mistakes'    // Pitfalls to avoid
  | 'revision_technique' // Effective revision methods
  | 'last_minute'        // Final week/day tips
  | 'mental_health'      // Stress management
  | 'topper_tip'         // Direct from rankers
  | 'teacher_advice'     // Expert educator insights
  | 'pattern_analysis'   // Exam pattern insights
  | 'scoring_hack'       // Maximize marks strategies
  | 'subject_specific'   // Subject-wise tips
  | 'resource_rec'       // Recommended resources
  | 'mock_strategy'      // Mock test approach
  | 'answer_writing';    // How to write answers

export type InsightSource = 
  | 'topper'             // From actual rankers
  | 'teacher'            // From educators
  | 'ai_analysis'        // Pattern-based AI insights
  | 'research'           // Educational research
  | 'community'          // Student community wisdom
  | 'official';          // From exam conducting bodies

export interface ExamInsight {
  id: string;
  examId: ExamType;
  category: InsightCategory;
  source: InsightSource;
  
  // Content
  title: string;
  summary: string;           // 1-2 lines
  content: string;           // Full insight
  actionItems: string[];     // Concrete steps
  
  // Relevance
  subjects?: Subject[];      // Specific subjects (optional)
  topics?: string[];         // Specific topics (optional)
  phase: 'preparation' | 'revision' | 'last_week' | 'exam_day' | 'all';
  daysBeforeExam?: { min: number; max: number }; // When most relevant
  
  // Personalization
  applicableToLevels: DifficultyLevel[];
  targetAudience: 'beginner' | 'intermediate' | 'advanced' | 'all';
  
  // Credibility
  sourceName?: string;       // "AIR 1 - JEE 2024"
  sourceYear?: number;
  verifiedBy?: string;
  confidenceScore: number;   // 0-100
  
  // Engagement
  helpfulCount: number;
  viewCount: number;
  
  // Metadata
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface LessonLearned {
  id: string;
  examId: ExamType;
  
  // What happened
  scenario: string;          // "I ignored organic chemistry thinking it's low weightage"
  mistake: string;           // The actual mistake
  consequence: string;       // What happened as a result
  lesson: string;            // The learning
  
  // Advice
  whatToDoInstead: string;
  preventionTips: string[];
  
  // Context
  subject?: Subject;
  topic?: string;
  phase: 'preparation' | 'revision' | 'exam_day';
  
  // Source
  source: InsightSource;
  sourceName?: string;
  isAnonymous: boolean;
  
  // Severity
  impactLevel: 'minor' | 'moderate' | 'major' | 'critical';
  frequency: 'rare' | 'common' | 'very_common';
  
  // Engagement
  relatedCount: number;      // "X students faced this"
  
  // Metadata
  tags: string[];
  createdAt: Date;
  isActive: boolean;
}

export interface TopperStory {
  id: string;
  examId: ExamType;
  
  // Profile
  name: string;
  rank: number;
  year: number;
  score?: number;
  percentile?: number;
  
  // Journey
  preparationMonths: number;
  coachingType: 'self' | 'online' | 'offline' | 'hybrid';
  previousAttempts: number;
  
  // Story
  background: string;
  challenges: string[];
  turningPoint: string;
  strategy: string;
  dailyRoutine: string;
  
  // Subject-wise
  subjectStrategies: {
    subject: Subject;
    strategy: string;
    resources: string[];
    hoursPerWeek: number;
  }[];
  
  // Tips
  topTips: string[];
  commonMistakesAvoided: string[];
  resourcesUsed: string[];
  
  // Metadata
  verifiedBy?: string;
  createdAt: Date;
  isActive: boolean;
}

// ============================================
// EXAM-SPECIFIC BEST PRACTICES DATABASE
// ============================================

export const EXAM_BEST_PRACTICES: Record<ExamType, {
  overview: string;
  keyStrategies: string[];
  subjectPriorities: { subject: string; priority: 'high' | 'medium' | 'low'; reason: string }[];
  commonMistakes: string[];
  timelineRecommendation: { months: number; phase: string; focus: string }[];
  scoringTips: string[];
  lastWeekStrategy: string[];
  examDayTips: string[];
}> = {
  JEE_MAIN: {
    overview: "JEE Main tests conceptual clarity and speed. Focus on NCERT first, then expand to advanced problems. Time management is crucial - you have ~2 minutes per question.",
    keyStrategies: [
      "Master NCERT thoroughly before any reference books",
      "Solve previous 10 years papers - patterns repeat",
      "Practice with strict time limits from day one",
      "Focus on accuracy over speed initially, then increase pace",
      "Attempt mock tests in exam-like conditions weekly",
    ],
    subjectPriorities: [
      { subject: "Mathematics", priority: "high", reason: "Highest scoring if prepared well, formulas are straightforward" },
      { subject: "Physics", priority: "high", reason: "Conceptual, once understood stays with you. Focus on mechanics and electromagnetism" },
      { subject: "Chemistry", priority: "medium", reason: "Inorganic is memory-based, Physical is calculation-heavy, Organic needs practice" },
    ],
    commonMistakes: [
      "Ignoring NCERT for Physics and Chemistry",
      "Not practicing enough numerical problems",
      "Spending too much time on one question during exam",
      "Neglecting negative marking - wild guessing hurts",
      "Starting Advanced problems before basics are solid",
    ],
    timelineRecommendation: [
      { months: 12, phase: "Foundation", focus: "Complete syllabus once, NCERT mastery" },
      { months: 6, phase: "Practice", focus: "Solve variety of problems, identify weak areas" },
      { months: 3, phase: "Revision", focus: "Quick revision, focus on weak topics" },
      { months: 1, phase: "Mock Tests", focus: "Full syllabus tests, analyze mistakes" },
    ],
    scoringTips: [
      "Attempt all single-answer MCQs carefully - no negative for correct",
      "In numerical questions, double-check calculations",
      "Chemistry inorganic can give quick marks - don't skip",
      "Leave difficult questions for the end, come back if time permits",
    ],
    lastWeekStrategy: [
      "Revise formulas and important reactions daily",
      "Solve 1 mock test every alternate day",
      "Focus on high-weightage chapters only",
      "Sleep well - 7-8 hours mandatory",
      "Light exercise to manage stress",
    ],
    examDayTips: [
      "Reach center 1 hour early",
      "Start with your strongest subject",
      "Don't panic if first few questions are tough - they're tough for everyone",
      "Keep 10 minutes for revision at the end",
      "Trust your preparation - no last-minute doubts",
    ],
  },
  JEE_ADVANCED: {
    overview: "JEE Advanced tests depth of understanding and problem-solving ability. Unlike Main, it rewards creative thinking over speed. Multi-concept problems are common.",
    keyStrategies: [
      "Understand concepts deeply - derivations matter",
      "Practice linking multiple concepts in single problems",
      "Master 'standard' problems from HC Verma, Irodov",
      "Learn to identify problem types quickly",
      "Practice integer-type and matrix-match extensively",
    ],
    subjectPriorities: [
      { subject: "Physics", priority: "high", reason: "Can be game-changer, problems are more analytical" },
      { subject: "Chemistry", priority: "high", reason: "Physical chemistry overlaps with Physics concepts" },
      { subject: "Mathematics", priority: "high", reason: "Calculus and algebra interlink with Physics" },
    ],
    commonMistakes: [
      "Treating it like JEE Main - it's a different exam",
      "Not reading questions carefully - multi-part answers",
      "Ignoring partial marking scheme",
      "Not managing time between papers",
      "Overthinking simple problems",
    ],
    timelineRecommendation: [
      { months: 18, phase: "Deep Foundation", focus: "Understand every concept thoroughly" },
      { months: 12, phase: "Problem Solving", focus: "Quality over quantity - solve varied problems" },
      { months: 6, phase: "Advanced Practice", focus: "Previous year papers, olympiad-style problems" },
      { months: 2, phase: "Simulation", focus: "Full mock tests matching Advanced pattern" },
    ],
    scoringTips: [
      "Read all options in MCQs - multiple can be correct",
      "Understand partial marking - attempt even if unsure",
      "Integer type: Round carefully, no negative marking",
      "Paper 1 and 2 have different difficulty - adjust accordingly",
    ],
    lastWeekStrategy: [
      "Revise class notes and important derivations",
      "Focus on your strongest areas - maximize them",
      "One full mock every 2 days",
      "Review mistakes from past mocks",
      "Stay calm - Advanced rewards composed minds",
    ],
    examDayTips: [
      "Paper 1 may feel tough - don't panic, Paper 2 balances",
      "Take the 5-minute break between papers seriously",
      "Skim entire paper first, mark easy questions",
      "Don't leave integer-type questions blank",
      "Trust your fundamentals",
    ],
  },
  NEET: {
    overview: "NEET is about accuracy and NCERT mastery. Biology is the game-changer with 360 marks. Focus on diagrams, tables, and exact NCERT language.",
    keyStrategies: [
      "NCERT is the Bible - read it 5-6 times minimum",
      "Biology diagrams must be exam-ready",
      "Physics numericals need extensive practice",
      "Chemistry organic reactions - memorize mechanisms",
      "Solve AIIMS/JIPMER papers for challenging questions",
    ],
    subjectPriorities: [
      { subject: "Biology", priority: "high", reason: "360/720 marks - more than half! Zoology and Botany equally important" },
      { subject: "Chemistry", priority: "medium", reason: "Overlap with Biology in Biochemistry. Inorganic is pure memory" },
      { subject: "Physics", priority: "medium", reason: "Can be challenging but scoring with practice" },
    ],
    commonMistakes: [
      "Focusing on reference books before NCERT",
      "Ignoring NCERT diagrams and tables",
      "Not practicing Biology assertion-reason questions",
      "Underestimating Physics weightage",
      "Last-minute syllabus hopping",
    ],
    timelineRecommendation: [
      { months: 14, phase: "Complete NCERT", focus: "Read NCERT thoroughly with notes" },
      { months: 8, phase: "Reference + Practice", focus: "MTG, previous years" },
      { months: 4, phase: "Revision", focus: "NCERT re-reading, weak topics" },
      { months: 2, phase: "Mock + Analysis", focus: "Full syllabus tests, error analysis" },
    ],
    scoringTips: [
      "Biology can give 340+ with pure NCERT",
      "Physics: Focus on optics, mechanics, modern physics",
      "Chemistry: Inorganic is quickest to score",
      "Don't guess randomly - -1 negative marking",
    ],
    lastWeekStrategy: [
      "Read NCERT Biology once more (quick skim)",
      "Revise reactions and formulas",
      "One mock every day - analyze same day",
      "Focus on sleep and nutrition",
      "No new topics - only revision",
    ],
    examDayTips: [
      "Start with Biology if it's your strength",
      "Mark questions you're unsure about - review later",
      "Don't change answers unless you're 100% sure",
      "Stay hydrated, but not too much (limited breaks)",
      "180 questions in 200 minutes - pace yourself",
    ],
  },
  CBSE_10: {
    overview: "Class 10 boards set the foundation. Focus on clarity of concepts and presentation. Internal assessment and practicals matter too.",
    keyStrategies: [
      "NCERT is sufficient for boards",
      "Practice sample papers from CBSE",
      "Focus on presentation and neat diagrams",
      "Understand marking scheme for each subject",
      "Internal assessment is easy marks - don't neglect",
    ],
    subjectPriorities: [
      { subject: "Mathematics", priority: "high", reason: "Objective questions need practice" },
      { subject: "Science", priority: "high", reason: "Diagrams and numerical both important" },
      { subject: "Social Science", priority: "medium", reason: "Reading comprehension key" },
    ],
    commonMistakes: [
      "Not following CBSE answer format",
      "Ignoring word limits in answers",
      "Poor time management in exam",
      "Messy handwriting and diagrams",
      "Not attempting all questions",
    ],
    timelineRecommendation: [
      { months: 8, phase: "Syllabus", focus: "Complete all chapters" },
      { months: 4, phase: "Practice", focus: "Sample papers, previous years" },
      { months: 1, phase: "Revision", focus: "Important questions, formulas" },
    ],
    scoringTips: [
      "Attempt all questions - CBSE is lenient",
      "Draw diagrams wherever possible",
      "Write in points for better readability",
      "Underline key terms in answers",
    ],
    lastWeekStrategy: [
      "Solve 2 sample papers per subject",
      "Revise formulas and important dates/events",
      "Practice diagrams (Science)",
      "Read map-based questions (Social Science)",
    ],
    examDayTips: [
      "Read questions carefully - don't assume",
      "Allocate time per section",
      "Start with familiar questions",
      "Review paper if time permits",
    ],
  },
  CBSE_12: {
    overview: "Class 12 scores matter for college admissions. Board patterns are predictable - master sample papers. Focus on core concepts over extra learning.",
    keyStrategies: [
      "NCERT is primary source for all subjects",
      "Practice CBSE sample papers and marking schemes",
      "Focus on case-study based questions",
      "Practical exams contribute to final score",
      "Maintain neat presentation throughout",
    ],
    subjectPriorities: [
      { subject: "Physics", priority: "high", reason: "Numericals and derivations both crucial" },
      { subject: "Chemistry", priority: "high", reason: "Organic mechanisms need practice" },
      { subject: "Mathematics", priority: "high", reason: "CBSE patterns are predictable with practice" },
    ],
    commonMistakes: [
      "Ignoring NCERT back-exercise questions",
      "Not understanding marking scheme patterns",
      "Rushing through case-study questions",
      "Poor practical file maintenance",
      "Last-minute syllabus cramming",
    ],
    timelineRecommendation: [
      { months: 10, phase: "Complete Syllabus", focus: "NCERT + class notes" },
      { months: 3, phase: "Practice", focus: "Sample papers, previous years" },
      { months: 1, phase: "Revision", focus: "Important chapters, formulas" },
    ],
    scoringTips: [
      "Case-study questions: Read passage carefully",
      "Derivations: Show all steps",
      "Diagrams: Label everything",
      "Word limit: Stick to it",
    ],
    lastWeekStrategy: [
      "One sample paper per subject",
      "Revise NCERT examples",
      "Focus on high-weightage chapters",
      "Practice case-study format",
    ],
    examDayTips: [
      "Read all options in MCQs carefully",
      "Manage time between sections",
      "Don't leave any question unanswered",
      "Review if time permits",
    ],
  },
  CAT: {
    overview: "CAT tests aptitude, not knowledge. Speed and accuracy both matter. VARC section can make or break your percentile.",
    keyStrategies: [
      "Build reading habit - 2 hours daily",
      "Practice mental math for quant",
      "LRDI: Learn to identify solvable sets",
      "Time management is everything",
      "Take 50+ full mocks before exam",
    ],
    subjectPriorities: [
      { subject: "VARC", priority: "high", reason: "RC alone is 70% of section" },
      { subject: "LRDI", priority: "high", reason: "Set selection is key skill" },
      { subject: "Quant", priority: "medium", reason: "Basics + speed needed" },
    ],
    commonMistakes: [
      "Not reading enough before CAT",
      "Spending too much time on one LRDI set",
      "Ignoring easy questions for tough ones",
      "Not taking enough mocks",
      "Poor sectional time allocation",
    ],
    timelineRecommendation: [
      { months: 6, phase: "Basics", focus: "Fundamentals of all sections" },
      { months: 3, phase: "Practice", focus: "Section-wise practice" },
      { months: 2, phase: "Mocks", focus: "Full-length tests + analysis" },
    ],
    scoringTips: [
      "VARC: Don't skim RC passages",
      "LRDI: Spend 2 min analyzing before solving",
      "Quant: Identify question type quickly",
      "Leave tough questions - CAT rewards smart selection",
    ],
    lastWeekStrategy: [
      "Light revision - no new concepts",
      "2-3 mocks with full analysis",
      "Focus on your strength areas",
      "Sleep and exercise",
    ],
    examDayTips: [
      "First 5 minutes: Skim entire section",
      "Don't get stuck - move on",
      "Trust your instincts in VARC",
      "Keep calm in LRDI",
    ],
  },
  UPSC: {
    overview: "UPSC is a marathon, not a sprint. Prelims, Mains, and Interview all test different skills. Current affairs integrated with static syllabus is key.",
    keyStrategies: [
      "Build strong foundation in NCERTs (6-12)",
      "Read newspaper daily - The Hindu/Indian Express",
      "Answer writing practice for Mains from day 1",
      "Optional subject choice is crucial",
      "Previous year analysis is gold",
    ],
    subjectPriorities: [
      { subject: "GS", priority: "high", reason: "Foundation for everything" },
      { subject: "CSAT", priority: "medium", reason: "Qualifying, but shouldn't be ignored" },
      { subject: "Essay", priority: "high", reason: "Tests articulation and depth" },
    ],
    commonMistakes: [
      "Too many books, too little revision",
      "Ignoring answer writing practice",
      "Not linking current affairs with syllabus",
      "Poor optional subject choice",
      "Underestimating Prelims",
    ],
    timelineRecommendation: [
      { months: 18, phase: "Foundation", focus: "NCERTs, basic books" },
      { months: 12, phase: "Advanced", focus: "Standard references, current affairs" },
      { months: 6, phase: "Answer Writing", focus: "Mains practice, test series" },
      { months: 2, phase: "Prelims Prep", focus: "Focused prelims revision" },
    ],
    scoringTips: [
      "Prelims: Elimination is key",
      "Mains: Structure answers well",
      "Essay: Have clear thesis",
      "Interview: Be authentic",
    ],
    lastWeekStrategy: [
      "Revise quick notes",
      "Current affairs of last 6 months",
      "Practice 1 mock daily",
      "Stay positive",
    ],
    examDayTips: [
      "Prelims: Attempt only sure shots",
      "Time management is crucial",
      "Don't change answers unless certain",
      "Stay calm",
    ],
  },
  GATE: {
    overview: "GATE tests depth of understanding in your engineering branch. Formula memorization won't work - understand concepts thoroughly.",
    keyStrategies: [
      "Master your branch fundamentals",
      "Previous 20 years papers are essential",
      "Practice numerical answer type questions",
      "General Aptitude is easy 15 marks",
      "Virtual calculator practice is must",
    ],
    subjectPriorities: [
      { subject: "Core Subjects", priority: "high", reason: "Major weightage, conceptual depth needed" },
      { subject: "Engineering Maths", priority: "high", reason: "Appears in most problems" },
      { subject: "General Aptitude", priority: "medium", reason: "Easy 15 marks" },
    ],
    commonMistakes: [
      "Not using virtual calculator before exam",
      "Ignoring General Aptitude",
      "Memorizing without understanding",
      "Not practicing NAT questions",
      "Poor time management",
    ],
    timelineRecommendation: [
      { months: 8, phase: "Theory", focus: "Subject-wise completion" },
      { months: 4, phase: "Problems", focus: "Previous years, practice" },
      { months: 2, phase: "Mocks", focus: "Full tests + analysis" },
    ],
    scoringTips: [
      "NAT questions: Careful calculations",
      "MSQs: All options can be correct",
      "GA: Attempt fully - easy marks",
      "Time per mark should be consistent",
    ],
    lastWeekStrategy: [
      "Formula revision",
      "Practice virtual calculator",
      "2 mocks with analysis",
      "Focus on strong subjects",
    ],
    examDayTips: [
      "Start with easy questions",
      "Use rough paper for calculations",
      "Don't rush NAT answers",
      "Review flagged questions",
    ],
  },

  ICSE_10: {
    overview: "ICSE Class 10 tests both conceptual understanding and application across a broad syllabus. English skills and internal assessments matter significantly.",
    keyStrategies: [
      "Balance board subjects with practical/project work",
      "Focus on English — it's a strong scoring subject",
      "Practice previous 10 years' papers thoroughly",
      "Don't neglect internal assessment marks",
    ],
    subjectPriorities: [
      { subject: "English", priority: "high", reason: "Strong scoring, needed for top percentage" },
      { subject: "Mathematics", priority: "high", reason: "Direct marks, no interpretation needed" },
      { subject: "Science", priority: "medium", reason: "Three-part paper needs balanced preparation" },
    ],
    commonMistakes: [
      "Ignoring project/practical marks",
      "Underestimating English Literature",
      "Skipping second language preparation",
    ],
    timelineRecommendation: [
      { months: 6, phase: "Foundation", focus: "Complete syllabus and notes" },
      { months: 3, phase: "Practice", focus: "Past papers and mock tests" },
      { months: 1, phase: "Revision", focus: "Weak areas and formula revision" },
    ],
    scoringTips: [
      "Attempt all questions — no negative marking",
      "Present answers clearly with steps",
      "Use diagrams wherever possible",
    ],
    lastWeekStrategy: [
      "Revise formula sheets and important definitions",
      "Do one full mock paper daily",
      "Focus on high-weightage chapters",
    ],
    examDayTips: [
      "Read questions carefully before answering",
      "Manage time across sections",
      "Attempt easy questions first",
    ],
  },

  ISC_12: {
    overview: "ISC Class 12 has a detailed syllabus with both board exams and internal assessment. English and core subjects need balanced attention.",
    keyStrategies: [
      "Understand the paper pattern for each subject",
      "Focus on internal assessment — it contributes significantly",
      "Practice writing answers within time limits",
      "Group study for Literature and History subjects",
    ],
    subjectPriorities: [
      { subject: "English", priority: "high", reason: "Compulsory and high scoring" },
      { subject: "Mathematics/Science", priority: "high", reason: "Core subject for future streams" },
      { subject: "Optional Subject", priority: "medium", reason: "Choose scoring elective wisely" },
    ],
    commonMistakes: [
      "Not reading prescribed texts for English Literature",
      "Neglecting internal marks",
      "Poor time management in lengthy papers",
    ],
    timelineRecommendation: [
      { months: 8, phase: "Foundation", focus: "Complete syllabus coverage" },
      { months: 3, phase: "Revision", focus: "Topic-wise revision and past papers" },
      { months: 1, phase: "Final Prep", focus: "Full mock tests and weak areas" },
    ],
    scoringTips: [
      "Answer precisely — avoid padding",
      "Show all working in Math/Science",
      "Use correct terminology in Science answers",
    ],
    lastWeekStrategy: [
      "Revise key themes for Literature subjects",
      "Practice time-bound writing",
      "Quick formula revision for Science/Math",
    ],
    examDayTips: [
      "Read the entire question paper first",
      "Attempt compulsory questions first",
      "Leave time to review answers",
    ],
  },

  STATE_BOARDS: {
    overview: "State board exams vary by state but generally test NCERT-level content with state-specific topics. Focus on official textbooks and past papers.",
    keyStrategies: [
      "Stick to state board textbooks as primary resource",
      "Solve 5+ years of state board past papers",
      "Focus on chapter-end questions from official books",
      "Don't over-prepare with competitive exam material",
    ],
    subjectPriorities: [
      { subject: "Mathematics", priority: "high", reason: "Scoring and formula-based" },
      { subject: "Science", priority: "high", reason: "Theory + practical components" },
      { subject: "Languages", priority: "medium", reason: "Scoring but time-intensive" },
    ],
    commonMistakes: [
      "Using competitive exam books instead of board textbooks",
      "Neglecting regional language papers",
      "Ignoring diagram-based questions in Science",
    ],
    timelineRecommendation: [
      { months: 5, phase: "Coverage", focus: "Complete all chapters from textbooks" },
      { months: 2, phase: "Practice", focus: "Past papers and sample papers" },
      { months: 1, phase: "Revision", focus: "Quick revision and weak topics" },
    ],
    scoringTips: [
      "Draw neat, labelled diagrams",
      "Write answers in proper format required by board",
      "Attempt all parts of each question",
    ],
    lastWeekStrategy: [
      "Read key definitions and theorems",
      "Practice one past paper per day",
      "Focus on most scoring chapters",
    ],
    examDayTips: [
      "Carry all required stationery",
      "Read instructions on cover page",
      "Divide time equally across sections",
    ],
  },

  OTHER: {
    overview: "For exams not specifically listed, focus on understanding the exam pattern, syllabus, and consistent practice with quality study materials.",
    keyStrategies: [
      "Download official syllabus and study plan",
      "Practice previous years' papers",
      "Focus on fundamentals before advanced topics",
      "Join or form a study group for peer learning",
    ],
    subjectPriorities: [
      { subject: "Core Subject", priority: "high", reason: "Primary focus area for the exam" },
      { subject: "Supporting Subject", priority: "medium", reason: "Complements core knowledge" },
      { subject: "General Knowledge", priority: "low", reason: "Supplementary if applicable" },
    ],
    commonMistakes: [
      "Not studying from official sources",
      "Underestimating the syllabus breadth",
      "Poor time management during exam",
    ],
    timelineRecommendation: [
      { months: 4, phase: "Foundation", focus: "Understand all topics" },
      { months: 2, phase: "Practice", focus: "Past papers and mock tests" },
      { months: 1, phase: "Final", focus: "Revision and confidence building" },
    ],
    scoringTips: [
      "Answer questions you know well first",
      "Manage time carefully",
      "Review your answers before submission",
    ],
    lastWeekStrategy: [
      "Light revision of key topics",
      "Ensure good sleep schedule",
      "Review your notes and formula sheets",
    ],
    examDayTips: [
      "Arrive early at exam venue",
      "Stay calm and read questions carefully",
      "Don't spend too long on any single question",
    ],
  },
};

// ============================================
// INSIGHTS SERVICE
// ============================================

export class ExamInsightsService {
  private insights: Map<string, ExamInsight> = new Map();
  private lessons: Map<string, LessonLearned> = new Map();
  private topperStories: Map<string, TopperStory> = new Map();
  private events: EventEmitter = new EventEmitter();

  constructor() {
    this.initializeDefaultInsights();
  }

  private initializeDefaultInsights(): void {
    // Convert best practices to insights
    for (const [examId, practices] of Object.entries(EXAM_BEST_PRACTICES)) {
      // Key strategies
      practices.keyStrategies.forEach((strategy, index) => {
        const insight: ExamInsight = {
          id: `${examId}_strategy_${index}`,
          examId: examId as ExamType,
          category: 'strategy',
          source: 'ai_analysis',
          title: `Strategy #${index + 1}`,
          summary: strategy,
          content: strategy,
          actionItems: [strategy],
          phase: 'all',
          applicableToLevels: ['beginner', 'intermediate', 'advanced'],
          targetAudience: 'all',
          confidenceScore: 95,
          helpfulCount: 0,
          viewCount: 0,
          tags: ['strategy', examId],
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
        };
        this.insights.set(insight.id, insight);
      });

      // Common mistakes as lessons
      practices.commonMistakes.forEach((mistake, index) => {
        const lesson: LessonLearned = {
          id: `${examId}_mistake_${index}`,
          examId: examId as ExamType,
          scenario: `Common mistake in ${examId} preparation`,
          mistake: mistake,
          consequence: "Results in lower scores or wasted preparation time",
          lesson: `Avoid: ${mistake}`,
          whatToDoInstead: `Focus on the opposite approach`,
          preventionTips: [mistake],
          phase: 'preparation',
          source: 'ai_analysis',
          isAnonymous: true,
          impactLevel: 'moderate',
          frequency: 'common',
          relatedCount: 100,
          tags: ['common_mistake', examId],
          createdAt: new Date(),
          isActive: true,
        };
        this.lessons.set(lesson.id, lesson);
      });
    }
  }

  // ============================================
  // INSIGHT RETRIEVAL
  // ============================================

  async getInsightsForExam(
    examId: ExamType,
    options?: {
      category?: InsightCategory;
      phase?: ExamInsight['phase'];
      targetAudience?: ExamInsight['targetAudience'];
      limit?: number;
    }
  ): Promise<ExamInsight[]> {
    let results = Array.from(this.insights.values())
      .filter(i => i.examId === examId && i.isActive);

    if (options?.category) {
      results = results.filter(i => i.category === options.category);
    }
    if (options?.phase) {
      results = results.filter(i => i.phase === options.phase || i.phase === 'all');
    }
    if (options?.targetAudience) {
      results = results.filter(
        i => i.targetAudience === options.targetAudience || i.targetAudience === 'all'
      );
    }

    // Sort by helpfulness
    results.sort((a, b) => b.helpfulCount - a.helpfulCount);

    return options?.limit ? results.slice(0, options.limit) : results;
  }

  async getLessonsForExam(
    examId: ExamType,
    options?: {
      subject?: Subject;
      phase?: LessonLearned['phase'];
      impactLevel?: LessonLearned['impactLevel'];
      limit?: number;
    }
  ): Promise<LessonLearned[]> {
    let results = Array.from(this.lessons.values())
      .filter(l => l.examId === examId && l.isActive);

    if (options?.subject) {
      results = results.filter(l => l.subject === options.subject);
    }
    if (options?.phase) {
      results = results.filter(l => l.phase === options.phase);
    }
    if (options?.impactLevel) {
      results = results.filter(l => l.impactLevel === options.impactLevel);
    }

    // Sort by frequency and impact
    results.sort((a, b) => {
      const impactOrder = { critical: 4, major: 3, moderate: 2, minor: 1 };
      return impactOrder[b.impactLevel] - impactOrder[a.impactLevel];
    });

    return options?.limit ? results.slice(0, options.limit) : results;
  }

  async getTopperStories(
    examId: ExamType,
    options?: {
      year?: number;
      limit?: number;
    }
  ): Promise<TopperStory[]> {
    let results = Array.from(this.topperStories.values())
      .filter(s => s.examId === examId && s.isActive);

    if (options?.year) {
      results = results.filter(s => s.year === options.year);
    }

    // Sort by rank
    results.sort((a, b) => a.rank - b.rank);

    return options?.limit ? results.slice(0, options.limit) : results;
  }

  async getBestPractices(examId: ExamType): Promise<typeof EXAM_BEST_PRACTICES[ExamType]> {
    return EXAM_BEST_PRACTICES[examId];
  }

  // ============================================
  // PERSONALIZED RECOMMENDATIONS
  // ============================================

  async getPersonalizedInsights(
    userId: string,
    examId: ExamType,
    context: {
      currentLevel: DifficultyLevel;
      daysToExam: number;
      weakSubjects?: Subject[];
      strongSubjects?: Subject[];
      learningStyle?: string;
    }
  ): Promise<{
    priorityInsights: ExamInsight[];
    lessonsToAvoid: LessonLearned[];
    topperTips: string[];
    phaseAdvice: string;
  }> {
    // Determine phase
    let phase: ExamInsight['phase'] = 'preparation';
    if (context.daysToExam <= 7) phase = 'last_week';
    else if (context.daysToExam <= 30) phase = 'revision';

    // Get relevant insights
    const priorityInsights = await this.getInsightsForExam(examId, {
      phase,
      targetAudience: context.currentLevel === 'beginner' ? 'beginner' : 
                      context.currentLevel === 'advanced' ? 'advanced' : 'intermediate',
      limit: 5,
    });

    // Get high-impact lessons
    const lessonsToAvoid = await this.getLessonsForExam(examId, {
      phase: phase === 'last_week' ? 'exam_day' : phase,
      impactLevel: 'critical',
      limit: 5,
    });

    // Get topper tips
    const topperStories = await this.getTopperStories(examId, { limit: 3 });
    const topperTips = topperStories.flatMap(s => s.topTips.slice(0, 2));

    // Phase advice from best practices
    const practices = EXAM_BEST_PRACTICES[examId];
    let phaseAdvice = practices.overview;
    if (phase === 'last_week') {
      phaseAdvice = practices.lastWeekStrategy.join(' • ');
    } else if (phase === 'revision') {
      phaseAdvice = `Focus on revision: ${practices.scoringTips.slice(0, 3).join(', ')}`;
    }

    this.events.emit('insights:personalized', { userId, examId, phase });

    return {
      priorityInsights,
      lessonsToAvoid,
      topperTips,
      phaseAdvice,
    };
  }

  // ============================================
  // CONTENT MANAGEMENT
  // ============================================

  async addInsight(insight: Omit<ExamInsight, 'id' | 'createdAt' | 'updatedAt' | 'helpfulCount' | 'viewCount'>): Promise<ExamInsight> {
    const newInsight: ExamInsight = {
      ...insight,
      id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      helpfulCount: 0,
      viewCount: 0,
    };

    this.insights.set(newInsight.id, newInsight);
    this.events.emit('insight:created', newInsight);

    return newInsight;
  }

  async addLessonLearned(lesson: Omit<LessonLearned, 'id' | 'createdAt' | 'relatedCount'>): Promise<LessonLearned> {
    const newLesson: LessonLearned = {
      ...lesson,
      id: `lesson_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      relatedCount: 1,
    };

    this.lessons.set(newLesson.id, newLesson);
    this.events.emit('lesson:created', newLesson);

    return newLesson;
  }

  async addTopperStory(story: Omit<TopperStory, 'id' | 'createdAt'>): Promise<TopperStory> {
    const newStory: TopperStory = {
      ...story,
      id: `topper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    };

    this.topperStories.set(newStory.id, newStory);
    this.events.emit('topper_story:created', newStory);

    return newStory;
  }

  async markInsightHelpful(insightId: string, userId: string): Promise<void> {
    const insight = this.insights.get(insightId);
    if (insight) {
      insight.helpfulCount++;
      this.events.emit('insight:helpful', { insightId, userId });
    }
  }

  async trackInsightView(insightId: string, userId: string): Promise<void> {
    const insight = this.insights.get(insightId);
    if (insight) {
      insight.viewCount++;
      this.events.emit('insight:viewed', { insightId, userId });
    }
  }

  // Event subscription
  on(event: string, handler: (...args: any[]) => void): void {
    this.events.on(event, handler);
  }
}

// ============================================
// AGENT INTEGRATION POINTS
// ============================================

/**
 * How each agent uses Exam Insights:
 * 
 * SAGE (AI Tutor):
 * - Embeds relevant insights in tutoring responses
 * - Warns about common mistakes when teaching a topic
 * - Shares topper strategies when student asks for advice
 * - Adjusts teaching based on phase (prep vs revision vs exam day)
 * 
 * MENTOR (Engagement):
 * - Sends daily tips based on days-to-exam
 * - Schedules "Lesson of the Day" notifications
 * - Shares topper stories for motivation
 * - Warns about common mistakes at right time
 * 
 * ATLAS (Content):
 * - Generates content aligned with best practices
 * - Creates question banks targeting common mistake areas
 * - Produces topper-style study materials
 * - Builds phase-appropriate content
 * 
 * HERALD (Marketing):
 * - Uses insights in blog content
 * - Creates "Topper Tips" social posts
 * - Builds SEO content around common mistakes
 * - Email sequences with phase-based tips
 * 
 * ORACLE (Analytics):
 * - Tracks which insights are most helpful
 * - Analyzes correlation between insight usage and scores
 * - Identifies gaps in knowledge base
 * - Measures engagement with topper content
 * 
 * SCOUT (Research):
 * - Discovers new topper interviews
 * - Finds pattern changes in exams
 * - Identifies emerging best practices
 * - Monitors competitor platforms for insights
 */

// Singleton
export const examInsightsService = new ExamInsightsService();
export default examInsightsService;
