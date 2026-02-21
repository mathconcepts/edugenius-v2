/**
 * Notebook Engine — Smart Study Companion
 * Syllabus-aware ready reckoner: coverage tracking, problem clusters,
 * spaced repetition, formula registry, uncovered topic alerts.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExamScope =
  | 'JEE Main' | 'JEE Adv' | 'NEET' | 'CBSE 12' | 'CAT' | 'UPSC' | 'GATE';

export type CoverageStatus = 'covered' | 'partial' | 'uncovered' | 'needs-revision';
export type ProblemDifficulty = 'easy' | 'medium' | 'hard';
export type ProblemSource = 'practice' | 'chat' | 'manual' | 'imported';

export interface TopicMeta {
  exam: ExamScope[];
  weightage: number;          // % of paper
  avgQuestionsPerYear: number;
  formulaCount: number;
  isHighYield: boolean;
}

export interface SyllabusTopic {
  id: string;
  name: string;
  chapter: string;
  subject: string;
  meta: TopicMeta;
  // Mutable — persisted in state
  coverage: CoverageStatus;
  masteryScore: number;       // 0–100
  lastPracticed?: number;
  revisionDue?: number;
  problemCount: number;
  noteCount: number;
  isBookmarked: boolean;
  isPinned: boolean;
}

export interface SyllabusChapter {
  id: string;
  name: string;
  subject: string;
  topics: SyllabusTopic[];
}

export interface SyllabusSubject {
  name: string;
  chapters: SyllabusChapter[];
}

export interface ProblemEntry {
  id: string;
  topicId: string;
  topicName: string;
  chapter: string;
  subject: string;
  exam: ExamScope[];
  question: string;
  userSolution?: string;
  aiSolution?: string;
  aiSteps?: string[];
  difficulty: ProblemDifficulty;
  source: ProblemSource;
  isCorrect?: boolean;
  timeSpentSec?: number;
  timestamp: number;
  tags: string[];
  isBookmarked: boolean;
  isFlagged: boolean;
  revisionCount: number;
  lastRevisedAt?: number;
  notes?: string;
}

export interface FormulaEntry {
  id: string;
  topicId: string;
  topicName: string;
  chapter: string;
  subject: string;
  latex: string;
  plain: string;
  description: string;
  example?: string;
  exam: ExamScope[];
  isBookmarked: boolean;
  masteryConfirmed: boolean;
}

export interface NoteEntry {
  id: string;
  topicId?: string;
  topicName?: string;
  chapter?: string;
  subject?: string;
  title: string;
  content: string;
  timestamp: number;
  updatedAt: number;
  tags: string[];
  isBookmarked: boolean;
  color: string;
}

export interface RevisionItem {
  problemId: string;
  topicId: string;
  dueAt: number;
  easeFactor: number;
  interval: number;
  repetitions: number;
}

export interface CoverageSummary {
  total: number;
  covered: number;
  partial: number;
  uncovered: number;
  needsRevision: number;
  coveragePercent: number;
  highYieldUncovered: SyllabusTopic[];
}

export interface NotebookState {
  activeExam: ExamScope;
  coverage: Record<string, CoverageStatus>;
  masteryScores: Record<string, number>;
  problems: ProblemEntry[];
  notes: NoteEntry[];
  revisionQueue: RevisionItem[];
  lastUpdated: number;
}

// ─── Syllabus Database ────────────────────────────────────────────────────────

function t(
  id: string, name: string, chapter: string, subject: string,
  exam: ExamScope[], weightage: number, avgQ: number, formulaCount: number, isHighYield: boolean
): SyllabusTopic {
  return {
    id, name, chapter, subject,
    meta: { exam, weightage, avgQuestionsPerYear: avgQ, formulaCount, isHighYield },
    coverage: 'uncovered', masteryScore: 0, problemCount: 0, noteCount: 0,
    isBookmarked: false, isPinned: false,
  };
}

export const SYLLABUS_MAP: Record<ExamScope, SyllabusSubject[]> = {
  'JEE Main': [
    {
      name: 'Physics', chapters: [
        { id: 'jee-phy-km', name: 'Kinematics', subject: 'Physics', topics: [
          t('jee-km-01', 'Projectile Motion', 'Kinematics', 'Physics', ['JEE Main','CBSE 12'], 4, 1, 6, true),
          t('jee-km-02', 'Relative Motion', 'Kinematics', 'Physics', ['JEE Main','JEE Adv'], 3, 1, 3, false),
          t('jee-km-03', '1D & 2D Motion Equations', 'Kinematics', 'Physics', ['JEE Main','NEET','CBSE 12'], 4, 2, 8, true),
        ]},
        { id: 'jee-phy-lm', name: 'Laws of Motion', subject: 'Physics', topics: [
          t('jee-lm-01', "Newton's Laws & Applications", 'Laws of Motion', 'Physics', ['JEE Main','NEET','CBSE 12'], 5, 2, 5, true),
          t('jee-lm-02', 'Friction & Circular Motion', 'Laws of Motion', 'Physics', ['JEE Main','JEE Adv'], 5, 2, 7, true),
        ]},
        { id: 'jee-phy-we', name: 'Work, Energy & Power', subject: 'Physics', topics: [
          t('jee-we-01', 'Work-Energy Theorem', 'Work, Energy & Power', 'Physics', ['JEE Main','NEET','CBSE 12'], 5, 2, 6, true),
          t('jee-we-02', 'Conservation of Energy & Springs', 'Work, Energy & Power', 'Physics', ['JEE Main','JEE Adv'], 4, 1, 5, false),
        ]},
        { id: 'jee-phy-es', name: 'Electrostatics', subject: 'Physics', topics: [
          t('jee-es-01', "Coulomb's Law & Electric Field", 'Electrostatics', 'Physics', ['JEE Main','JEE Adv','NEET'], 6, 2, 9, true),
          t('jee-es-02', 'Capacitance, Gauss Law', 'Electrostatics', 'Physics', ['JEE Main','JEE Adv'], 5, 2, 8, true),
        ]},
        { id: 'jee-phy-op', name: 'Optics', subject: 'Physics', topics: [
          t('jee-op-01', "Snell's Law & TIR", 'Optics', 'Physics', ['JEE Main','NEET','CBSE 12'], 4, 1, 6, false),
          t('jee-op-02', 'Wave Optics, Interference', 'Optics', 'Physics', ['JEE Main','JEE Adv'], 4, 1, 7, true),
        ]},
        { id: 'jee-phy-td', name: 'Thermodynamics', subject: 'Physics', topics: [
          t('jee-td-01', 'Laws of Thermodynamics', 'Thermodynamics', 'Physics', ['JEE Main','JEE Adv','NEET'], 5, 2, 8, true),
          t('jee-td-02', 'Kinetic Theory of Gases', 'Thermodynamics', 'Physics', ['JEE Main','CBSE 12'], 4, 1, 5, false),
        ]},
        { id: 'jee-phy-mod', name: 'Modern Physics', subject: 'Physics', topics: [
          t('jee-mod-01', 'Photoelectric Effect', 'Modern Physics', 'Physics', ['JEE Main','NEET','CBSE 12'], 4, 2, 4, true),
          t('jee-mod-02', 'Nuclear Physics & Radioactivity', 'Modern Physics', 'Physics', ['JEE Main','NEET'], 4, 1, 4, false),
        ]},
      ],
    },
    {
      name: 'Chemistry', chapters: [
        { id: 'jee-chem-as', name: 'Atomic Structure', subject: 'Chemistry', topics: [
          t('jee-as-01', 'Quantum Numbers & Orbitals', 'Atomic Structure', 'Chemistry', ['JEE Main','NEET','CBSE 12'], 4, 1, 5, true),
          t('jee-as-02', 'Electronic Configuration & Periodicity', 'Atomic Structure', 'Chemistry', ['JEE Main','NEET'], 3, 1, 3, false),
        ]},
        { id: 'jee-chem-cb', name: 'Chemical Bonding', subject: 'Chemistry', topics: [
          t('jee-cb-01', 'VSEPR Theory & Hybridisation', 'Chemical Bonding', 'Chemistry', ['JEE Main','NEET','CBSE 12'], 5, 2, 4, true),
          t('jee-cb-02', 'Molecular Orbital Theory', 'Chemical Bonding', 'Chemistry', ['JEE Main','JEE Adv'], 4, 1, 3, false),
        ]},
        { id: 'jee-chem-eq', name: 'Chemical Equilibrium', subject: 'Chemistry', topics: [
          t('jee-eq-01', "Le Chatelier's Principle", 'Chemical Equilibrium', 'Chemistry', ['JEE Main','NEET','CBSE 12'], 4, 1, 4, true),
          t('jee-eq-02', 'Kp, Kc, Degree of Dissociation', 'Chemical Equilibrium', 'Chemistry', ['JEE Main','JEE Adv'], 4, 1, 5, true),
          t('jee-eq-03', 'Ionic Equilibrium & pH', 'Chemical Equilibrium', 'Chemistry', ['JEE Main','NEET'], 4, 2, 4, true),
        ]},
        { id: 'jee-chem-oc', name: 'Organic Chemistry', subject: 'Chemistry', topics: [
          t('jee-oc-01', 'Named Reactions & Mechanisms', 'Organic Chemistry', 'Chemistry', ['JEE Main','JEE Adv','NEET'], 8, 3, 2, true),
          t('jee-oc-02', 'GOC (General Organic Chemistry)', 'Organic Chemistry', 'Chemistry', ['JEE Main','JEE Adv'], 6, 2, 3, true),
          t('jee-oc-03', 'Biomolecules & Polymers', 'Organic Chemistry', 'Chemistry', ['JEE Main','NEET','CBSE 12'], 4, 1, 1, false),
        ]},
        { id: 'jee-chem-td', name: 'Thermochemistry', subject: 'Chemistry', topics: [
          t('jee-ct-01', 'Gibbs Energy, Entropy & Enthalpy', 'Thermochemistry', 'Chemistry', ['JEE Main','JEE Adv','NEET'], 5, 2, 7, true),
        ]},
        { id: 'jee-chem-ec', name: 'Electrochemistry', subject: 'Chemistry', topics: [
          t('jee-ec-01', 'Electrolytic Cells & Faraday Laws', 'Electrochemistry', 'Chemistry', ['JEE Main','CBSE 12'], 4, 1, 5, true),
          t('jee-ec-02', 'Galvanic Cells & Nernst Equation', 'Electrochemistry', 'Chemistry', ['JEE Main','JEE Adv'], 4, 1, 4, true),
        ]},
      ],
    },
    {
      name: 'Mathematics', chapters: [
        { id: 'jee-maths-calc', name: 'Calculus', subject: 'Mathematics', topics: [
          t('jee-c1', 'Limits, Continuity & Differentiability', 'Calculus', 'Mathematics', ['JEE Main','JEE Adv','CBSE 12'], 7, 3, 10, true),
          t('jee-c2', 'Differentiation Techniques', 'Calculus', 'Mathematics', ['JEE Main','JEE Adv','CBSE 12'], 6, 2, 12, true),
          t('jee-c3', 'Integration by Parts & Substitution', 'Calculus', 'Mathematics', ['JEE Main','JEE Adv'], 8, 3, 14, true),
          t('jee-c4', 'Definite Integrals & Area Under Curves', 'Calculus', 'Mathematics', ['JEE Main','JEE Adv','CBSE 12'], 7, 3, 10, true),
          t('jee-c5', 'Differential Equations', 'Calculus', 'Mathematics', ['JEE Main','CBSE 12'], 5, 2, 6, false),
        ]},
        { id: 'jee-maths-cg', name: 'Coordinate Geometry', subject: 'Mathematics', topics: [
          t('jee-cg-01', 'Straight Lines & Pairs', 'Coordinate Geometry', 'Mathematics', ['JEE Main','CBSE 12'], 5, 2, 7, false),
          t('jee-cg-02', 'Circles & Tangents', 'Coordinate Geometry', 'Mathematics', ['JEE Main','JEE Adv','CBSE 12'], 6, 2, 9, true),
          t('jee-cg-03', 'Conic Sections (Parabola/Ellipse/Hyperbola)', 'Coordinate Geometry', 'Mathematics', ['JEE Main','JEE Adv'], 7, 3, 11, true),
        ]},
        { id: 'jee-maths-alg', name: 'Algebra', subject: 'Mathematics', topics: [
          t('jee-alg-01', 'Complex Numbers', 'Algebra', 'Mathematics', ['JEE Main','JEE Adv'], 5, 2, 8, true),
          t('jee-alg-02', 'Matrices & Determinants', 'Algebra', 'Mathematics', ['JEE Main','CBSE 12'], 5, 2, 7, false),
          t('jee-alg-03', 'Sequences, Series & Binomial Theorem', 'Algebra', 'Mathematics', ['JEE Main','JEE Adv'], 5, 2, 6, true),
          t('jee-alg-04', 'Permutations, Combinations & Probability', 'Algebra', 'Mathematics', ['JEE Main','JEE Adv','CBSE 12'], 5, 2, 6, true),
        ]},
        { id: 'jee-maths-trig', name: 'Trigonometry', subject: 'Mathematics', topics: [
          t('jee-trig-01', 'Trigonometric Identities & Equations', 'Trigonometry', 'Mathematics', ['JEE Main','CBSE 12'], 5, 2, 10, false),
          t('jee-trig-02', 'Inverse Trigonometry', 'Trigonometry', 'Mathematics', ['JEE Main','CBSE 12'], 4, 1, 5, false),
        ]},
        { id: 'jee-maths-3d', name: '3D Geometry & Vectors', subject: 'Mathematics', topics: [
          t('jee-3d-01', 'Vectors, Dot & Cross Products', '3D Geometry & Vectors', 'Mathematics', ['JEE Main','JEE Adv','CBSE 12'], 5, 2, 8, true),
          t('jee-3d-02', '3D Geometry — Lines & Planes', '3D Geometry & Vectors', 'Mathematics', ['JEE Main','CBSE 12'], 5, 2, 7, false),
        ]},
      ],
    },
  ],

  'NEET': [
    {
      name: 'Biology', chapters: [
        { id: 'neet-bio-cell', name: 'Cell Biology', subject: 'Biology', topics: [
          t('neet-cell-01', 'Cell Structure & Organelles', 'Cell Biology', 'Biology', ['NEET','CBSE 12'], 6, 3, 0, true),
          t('neet-cell-02', 'Cell Division — Mitosis & Meiosis', 'Cell Biology', 'Biology', ['NEET','CBSE 12'], 6, 3, 0, true),
        ]},
        { id: 'neet-bio-gen', name: 'Genetics', subject: 'Biology', topics: [
          t('neet-gen-01', "Mendelian Genetics & Laws of Inheritance", 'Genetics', 'Biology', ['NEET','CBSE 12'], 8, 4, 2, true),
          t('neet-gen-02', 'DNA Structure, Replication & Transcription', 'Genetics', 'Biology', ['NEET','CBSE 12'], 8, 4, 1, true),
          t('neet-gen-03', 'Mutation, Genetic Disorders', 'Genetics', 'Biology', ['NEET'], 5, 2, 0, false),
        ]},
        { id: 'neet-bio-eco', name: 'Ecology', subject: 'Biology', topics: [
          t('neet-eco-01', 'Ecosystems, Food Chains & Pyramids', 'Ecology', 'Biology', ['NEET','CBSE 12'], 5, 2, 0, true),
          t('neet-eco-02', 'Biodiversity & Conservation', 'Ecology', 'Biology', ['NEET','CBSE 12'], 4, 2, 0, false),
        ]},
        { id: 'neet-bio-plant', name: 'Plant Physiology', subject: 'Biology', topics: [
          t('neet-pp-01', 'Photosynthesis & Respiration', 'Plant Physiology', 'Biology', ['NEET','CBSE 12'], 7, 3, 2, true),
          t('neet-pp-02', 'Mineral Nutrition & Absorption', 'Plant Physiology', 'Biology', ['NEET'], 4, 2, 0, false),
        ]},
        { id: 'neet-bio-human', name: 'Human Physiology', subject: 'Biology', topics: [
          t('neet-hp-01', 'Digestive System & Nutrition', 'Human Physiology', 'Biology', ['NEET','CBSE 12'], 5, 3, 0, true),
          t('neet-hp-02', 'Circulatory & Respiratory Systems', 'Human Physiology', 'Biology', ['NEET','CBSE 12'], 6, 3, 2, true),
          t('neet-hp-03', 'Nervous & Endocrine Systems', 'Human Physiology', 'Biology', ['NEET','CBSE 12'], 6, 3, 0, true),
        ]},
      ],
    },
    {
      name: 'Physics', chapters: [
        { id: 'neet-phy-km', name: 'Mechanics', subject: 'Physics', topics: [
          t('neet-km-01', 'Equations of Motion & Kinematics', 'Mechanics', 'Physics', ['NEET','CBSE 12'], 5, 2, 5, true),
          t('neet-km-02', "Newton's Laws & Friction", 'Mechanics', 'Physics', ['NEET','CBSE 12'], 5, 2, 4, true),
        ]},
        { id: 'neet-phy-mod', name: 'Modern Physics', subject: 'Physics', topics: [
          t('neet-mod-01', 'Photoelectric Effect & Atomic Models', 'Modern Physics', 'Physics', ['NEET','CBSE 12'], 5, 2, 4, true),
          t('neet-mod-02', 'Nuclear Physics', 'Modern Physics', 'Physics', ['NEET'], 4, 2, 3, false),
        ]},
      ],
    },
    {
      name: 'Chemistry', chapters: [
        { id: 'neet-chem-oc', name: 'Organic Chemistry', subject: 'Chemistry', topics: [
          t('neet-oc-01', 'Biomolecules, Vitamins, Hormones', 'Organic Chemistry', 'Chemistry', ['NEET','CBSE 12'], 6, 3, 1, true),
          t('neet-oc-02', 'GOC & Reaction Mechanisms', 'Organic Chemistry', 'Chemistry', ['NEET'], 5, 2, 2, true),
        ]},
        { id: 'neet-chem-eq', name: 'Equilibrium & Acids', subject: 'Chemistry', topics: [
          t('neet-eq-01', 'Ionic Equilibrium, pH, Buffers', 'Equilibrium & Acids', 'Chemistry', ['NEET','CBSE 12'], 4, 2, 4, true),
        ]},
      ],
    },
  ],

  'CAT': [
    {
      name: 'Quantitative Aptitude', chapters: [
        { id: 'cat-qa', name: 'Arithmetic', subject: 'Quantitative Aptitude', topics: [
          t('cat-qa-01', 'Percentages, Ratios & Proportions', 'Arithmetic', 'Quantitative Aptitude', ['CAT'], 8, 4, 6, true),
          t('cat-qa-02', 'Time, Speed & Distance', 'Arithmetic', 'Quantitative Aptitude', ['CAT'], 7, 3, 5, true),
          t('cat-qa-03', 'Profit, Loss & Interest', 'Arithmetic', 'Quantitative Aptitude', ['CAT'], 6, 3, 4, true),
        ]},
        { id: 'cat-qa2', name: 'Algebra & Geometry', subject: 'Quantitative Aptitude', topics: [
          t('cat-qa-04', 'Permutations & Combinations', 'Algebra & Geometry', 'Quantitative Aptitude', ['CAT'], 7, 3, 5, true),
          t('cat-qa-05', 'Geometry & Mensuration', 'Algebra & Geometry', 'Quantitative Aptitude', ['CAT'], 6, 3, 8, false),
          t('cat-qa-06', 'Number Systems', 'Algebra & Geometry', 'Quantitative Aptitude', ['CAT'], 6, 3, 3, true),
        ]},
      ],
    },
    {
      name: 'Verbal Ability', chapters: [
        { id: 'cat-va', name: 'VARC', subject: 'Verbal Ability', topics: [
          t('cat-va-01', 'Reading Comprehension', 'VARC', 'Verbal Ability', ['CAT'], 10, 6, 0, true),
          t('cat-va-02', 'Para Jumbles & Para Summary', 'VARC', 'Verbal Ability', ['CAT'], 6, 3, 0, true),
          t('cat-va-03', 'Vocabulary & Sentence Correction', 'VARC', 'Verbal Ability', ['CAT'], 5, 2, 0, false),
        ]},
      ],
    },
    {
      name: 'DILR', chapters: [
        { id: 'cat-dilr', name: 'Data Interpretation & LR', subject: 'DILR', topics: [
          t('cat-dilr-01', 'Tables, Bar & Pie Charts', 'Data Interpretation & LR', 'DILR', ['CAT'], 8, 4, 2, true),
          t('cat-dilr-02', 'Logical Reasoning Sets', 'Data Interpretation & LR', 'DILR', ['CAT'], 8, 4, 0, true),
        ]},
      ],
    },
  ],

  'CBSE 12': [
    {
      name: 'Mathematics', chapters: [
        { id: 'cbse-calc', name: 'Calculus', subject: 'Mathematics', topics: [
          t('cbse-c1', 'Continuity & Differentiability', 'Calculus', 'Mathematics', ['CBSE 12'], 10, 4, 10, true),
          t('cbse-c2', 'Applications of Derivatives', 'Calculus', 'Mathematics', ['CBSE 12'], 8, 3, 8, true),
          t('cbse-c3', 'Integrals & Area', 'Calculus', 'Mathematics', ['CBSE 12'], 10, 4, 12, true),
          t('cbse-c4', 'Differential Equations', 'Calculus', 'Mathematics', ['CBSE 12'], 6, 2, 6, false),
        ]},
        { id: 'cbse-alg', name: 'Algebra & Vectors', subject: 'Mathematics', topics: [
          t('cbse-alg-01', 'Matrices & Determinants', 'Algebra & Vectors', 'Mathematics', ['CBSE 12'], 9, 3, 7, true),
          t('cbse-alg-02', 'Vectors & 3D Geometry', 'Algebra & Vectors', 'Mathematics', ['CBSE 12'], 8, 3, 8, true),
          t('cbse-alg-03', 'Linear Programming', 'Algebra & Vectors', 'Mathematics', ['CBSE 12'], 5, 2, 2, false),
          t('cbse-alg-04', 'Probability (Conditional & Bayes)', 'Algebra & Vectors', 'Mathematics', ['CBSE 12'], 7, 2, 4, true),
        ]},
      ],
    },
    {
      name: 'Physics', chapters: [
        { id: 'cbse-phy-el', name: 'Electricity & Magnetism', subject: 'Physics', topics: [
          t('cbse-el-01', 'Current Electricity & Ohm\'s Law', 'Electricity & Magnetism', 'Physics', ['CBSE 12'], 7, 3, 8, true),
          t('cbse-el-02', 'Magnetic Effects of Current', 'Electricity & Magnetism', 'Physics', ['CBSE 12'], 7, 3, 7, true),
          t('cbse-el-03', 'Electromagnetic Induction', 'Electricity & Magnetism', 'Physics', ['CBSE 12'], 6, 2, 6, true),
        ]},
      ],
    },
  ],

  'UPSC': [
    {
      name: 'General Studies', chapters: [
        { id: 'upsc-gs1', name: 'Indian History', subject: 'General Studies', topics: [
          t('upsc-hist-01', 'Ancient & Medieval India', 'Indian History', 'General Studies', ['UPSC'], 6, 4, 0, true),
          t('upsc-hist-02', 'Modern India & Freedom Movement', 'Indian History', 'General Studies', ['UPSC'], 8, 5, 0, true),
        ]},
        { id: 'upsc-gs2', name: 'Polity & Governance', subject: 'General Studies', topics: [
          t('upsc-pol-01', 'Constitutional Framework & Amendments', 'Polity & Governance', 'General Studies', ['UPSC'], 9, 6, 0, true),
          t('upsc-pol-02', 'Parliament, Judiciary & Executive', 'Polity & Governance', 'General Studies', ['UPSC'], 7, 4, 0, true),
        ]},
        { id: 'upsc-gs3', name: 'Economy', subject: 'General Studies', topics: [
          t('upsc-eco-01', 'Indian Economy — GDP, Inflation, Fiscal Policy', 'Economy', 'General Studies', ['UPSC'], 8, 5, 0, true),
        ]},
        { id: 'upsc-gs4', name: 'Geography', subject: 'General Studies', topics: [
          t('upsc-geo-01', 'Physical Geography of India', 'Geography', 'General Studies', ['UPSC'], 6, 4, 0, false),
          t('upsc-geo-02', 'Climate, Rivers & Soil', 'Geography', 'General Studies', ['UPSC'], 6, 3, 0, true),
        ]},
      ],
    },
  ],

  'JEE Adv': [
    {
      name: 'Physics', chapters: [
        { id: 'jadv-phy-km', name: 'Kinematics & Mechanics', subject: 'Physics', topics: [
          t('jadv-km-01', 'Projectile & Relative Motion', 'Kinematics & Mechanics', 'Physics', ['JEE Adv','JEE Main'], 5, 2, 7, true),
          t('jadv-km-02', 'Rotational Motion & Torque', 'Kinematics & Mechanics', 'Physics', ['JEE Adv'], 7, 3, 9, true),
          t('jadv-km-03', 'Oscillations & SHM', 'Kinematics & Mechanics', 'Physics', ['JEE Adv'], 6, 2, 8, true),
        ]},
        { id: 'jadv-phy-em', name: 'Electromagnetism', subject: 'Physics', topics: [
          t('jadv-em-01', 'Electromagnetic Induction', 'Electromagnetism', 'Physics', ['JEE Adv'], 7, 3, 8, true),
          t('jadv-em-02', 'AC Circuits & Resonance', 'Electromagnetism', 'Physics', ['JEE Adv'], 6, 2, 7, true),
        ]},
      ],
    },
    {
      name: 'Chemistry', chapters: [
        { id: 'jadv-chem-oc', name: 'Organic Chemistry', subject: 'Chemistry', topics: [
          t('jadv-oc-01', 'Named Reactions & Mechanisms (Adv)', 'Organic Chemistry', 'Chemistry', ['JEE Adv'], 9, 4, 3, true),
          t('jadv-oc-02', 'Stereochemistry', 'Organic Chemistry', 'Chemistry', ['JEE Adv'], 6, 2, 2, true),
        ]},
        { id: 'jadv-chem-eq', name: 'Electrochemistry & Equilibrium', subject: 'Chemistry', topics: [
          t('jadv-eq-01', 'Nernst Equation & Cell Potentials', 'Electrochemistry & Equilibrium', 'Chemistry', ['JEE Adv'], 6, 2, 5, true),
        ]},
      ],
    },
    {
      name: 'Mathematics', chapters: [
        { id: 'jadv-maths-calc', name: 'Calculus', subject: 'Mathematics', topics: [
          t('jadv-c1', 'Limits & L\'Hopital', 'Calculus', 'Mathematics', ['JEE Adv'], 6, 2, 8, true),
          t('jadv-c2', 'Integration Techniques (Advanced)', 'Calculus', 'Mathematics', ['JEE Adv'], 9, 4, 15, true),
          t('jadv-c3', 'Area & Volumes of Revolution', 'Calculus', 'Mathematics', ['JEE Adv'], 7, 3, 8, true),
        ]},
        { id: 'jadv-maths-cg', name: 'Coordinate & 3D Geometry', subject: 'Mathematics', topics: [
          t('jadv-cg-01', 'Conics — Deeper Properties', 'Coordinate & 3D Geometry', 'Mathematics', ['JEE Adv'], 7, 3, 10, true),
          t('jadv-cg-02', 'Lines & Planes in 3D', 'Coordinate & 3D Geometry', 'Mathematics', ['JEE Adv'], 6, 2, 8, false),
        ]},
      ],
    },
  ],

  'GATE': [
    {
      name: 'Engineering Mathematics', chapters: [
        { id: 'gate-em', name: 'Engineering Mathematics', subject: 'Engineering Mathematics', topics: [
          t('gate-em-01', 'Linear Algebra & Eigenvalues', 'Engineering Mathematics', 'Engineering Mathematics', ['GATE'], 8, 3, 10, true),
          t('gate-em-02', 'Calculus & Differential Equations', 'Engineering Mathematics', 'Engineering Mathematics', ['GATE'], 8, 3, 12, true),
          t('gate-em-03', 'Probability & Statistics', 'Engineering Mathematics', 'Engineering Mathematics', ['GATE'], 6, 2, 6, true),
        ]},
      ],
    },
    {
      name: 'Computer Science', chapters: [        { id: 'gate-cs', name: 'Core CS', subject: 'Computer Science', topics: [
          t('gate-cs-01', 'Algorithms & Complexity', 'Core CS', 'Computer Science', ['GATE'], 9, 4, 5, true),
          t('gate-cs-02', 'Operating Systems', 'Core CS', 'Computer Science', ['GATE'], 8, 3, 3, true),
          t('gate-cs-03', 'Database Management Systems', 'Core CS', 'Computer Science', ['GATE'], 7, 3, 4, true),
          t('gate-cs-04', 'Computer Networks', 'Core CS', 'Computer Science', ['GATE'], 7, 3, 5, true),
        ]},
      ],
    },
  ],
};

// ─── Formula Registry ─────────────────────────────────────────────────────────

export const FORMULA_REGISTRY: FormulaEntry[] = [
  { id: 'f-km-01', topicId: 'jee-km-01', topicName: 'Projectile Motion', chapter: 'Kinematics', subject: 'Physics', latex: 'R = \\frac{u^2 \\sin 2\\theta}{g}', plain: 'R = u²sin2θ / g', description: 'Range of projectile', example: 'u=20m/s, θ=45°: R=40m', exam: ['JEE Main','CBSE 12'], isBookmarked: false, masteryConfirmed: false },
  { id: 'f-km-02', topicId: 'jee-km-01', topicName: 'Projectile Motion', chapter: 'Kinematics', subject: 'Physics', latex: 'H = \\frac{u^2 \\sin^2\\theta}{2g}', plain: 'H = u²sin²θ / 2g', description: 'Maximum height of projectile', exam: ['JEE Main','CBSE 12'], isBookmarked: false, masteryConfirmed: false },
  { id: 'f-lm-01', topicId: 'jee-lm-01', topicName: "Newton's Laws", chapter: 'Laws of Motion', subject: 'Physics', latex: 'F = ma', plain: 'F = ma', description: "Newton's Second Law", example: '10N on 2kg → a=5m/s²', exam: ['JEE Main','NEET','CBSE 12'], isBookmarked: false, masteryConfirmed: false },
  { id: 'f-es-01', topicId: 'jee-es-01', topicName: "Coulomb's Law", chapter: 'Electrostatics', subject: 'Physics', latex: 'F = k\\frac{q_1 q_2}{r^2}', plain: 'F = kq₁q₂/r²', description: "Coulomb's Law of electrostatic force", exam: ['JEE Main','NEET'], isBookmarked: false, masteryConfirmed: false },
  { id: 'f-calc-01', topicId: 'jee-c3', topicName: 'Integration by Parts', chapter: 'Calculus', subject: 'Mathematics', latex: '\\int u\\,dv = uv - \\int v\\,du', plain: '∫u dv = uv - ∫v du', description: 'Integration by Parts', example: '∫x eˣ dx = xeˣ - eˣ + C', exam: ['JEE Main','JEE Adv'], isBookmarked: false, masteryConfirmed: false },
  { id: 'f-calc-02', topicId: 'jee-c2', topicName: 'Differentiation', chapter: 'Calculus', subject: 'Mathematics', latex: '\\frac{d}{dx}[f(g(x))] = f\'(g(x)) \\cdot g\'(x)', plain: 'Chain Rule: d/dx[f(g(x))] = f\'(g(x))·g\'(x)', description: 'Chain Rule for differentiation', exam: ['JEE Main','JEE Adv','CBSE 12'], isBookmarked: false, masteryConfirmed: false },
  { id: 'f-qp-01', topicId: 'jee-km-01', topicName: 'Equations of Motion', chapter: 'Kinematics', subject: 'Physics', latex: 'v^2 = u^2 + 2as', plain: 'v² = u² + 2as', description: 'Third equation of motion', exam: ['JEE Main','NEET','CBSE 12'], isBookmarked: false, masteryConfirmed: false },
  { id: 'f-td-01', topicId: 'jee-ct-01', topicName: 'Gibbs Energy', chapter: 'Thermochemistry', subject: 'Chemistry', latex: '\\Delta G = \\Delta H - T\\Delta S', plain: 'ΔG = ΔH − TΔS', description: 'Gibbs Free Energy equation', exam: ['JEE Main','JEE Adv','NEET'], isBookmarked: false, masteryConfirmed: false },
];

// ─── localStorage key ─────────────────────────────────────────────────────────

const NOTEBOOK_KEY = 'edugenius_notebook';

// ─── Persistence ──────────────────────────────────────────────────────────────

export function loadNotebookState(exam: ExamScope): NotebookState {
  try {
    const raw = localStorage.getItem(NOTEBOOK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as NotebookState;
      if (parsed.activeExam === exam) return parsed;
    }
  } catch { /* ignore */ }
  return {
    activeExam: exam,
    coverage: {},
    masteryScores: {},
    problems: [],
    notes: [],
    revisionQueue: [],
    lastUpdated: Date.now(),
  };
}

export function saveNotebookState(state: NotebookState): void {
  localStorage.setItem(NOTEBOOK_KEY, JSON.stringify({ ...state, lastUpdated: Date.now() }));
}

// ─── Syllabus helpers ─────────────────────────────────────────────────────────

export function getAllTopics(exam: ExamScope): SyllabusTopic[] {
  const subjects = SYLLABUS_MAP[exam] ?? [];
  return subjects.flatMap(s => s.chapters.flatMap(c => c.topics));
}

export function getTopicById(exam: ExamScope, id: string): SyllabusTopic | undefined {
  return getAllTopics(exam).find(t => t.id === id);
}

export function getCoverageSummary(exam: ExamScope, coverage: Record<string, CoverageStatus>): CoverageSummary {
  const topics = getAllTopics(exam);
  const counts = { covered: 0, partial: 0, uncovered: 0, 'needs-revision': 0 };
  const highYieldUncovered: SyllabusTopic[] = [];

  for (const topic of topics) {
    const status = coverage[topic.id] ?? 'uncovered';
    counts[status]++;
    if ((status === 'uncovered' || status === 'needs-revision') && topic.meta.isHighYield) {
      highYieldUncovered.push({ ...topic, coverage: status });
    }
  }

  const total = topics.length;
  return {
    total,
    covered: counts.covered,
    partial: counts.partial,
    uncovered: counts.uncovered,
    needsRevision: counts['needs-revision'],
    coveragePercent: total > 0 ? Math.round(((counts.covered + counts.partial * 0.5) / total) * 100) : 0,
    highYieldUncovered: highYieldUncovered.slice(0, 10),
  };
}

// ─── Problem helpers ──────────────────────────────────────────────────────────

export function addProblem(state: NotebookState, problem: Omit<ProblemEntry, 'id' | 'timestamp' | 'revisionCount'>): NotebookState {
  const entry: ProblemEntry = {
    ...problem,
    id: `prob-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    revisionCount: 0,
  };
  // Auto-update coverage
  const newCoverage = { ...state.coverage };
  if (!newCoverage[problem.topicId] || newCoverage[problem.topicId] === 'uncovered') {
    newCoverage[problem.topicId] = 'partial';
  }
  // Schedule revision (24h initial)
  const revItem: RevisionItem = {
    problemId: entry.id, topicId: problem.topicId,
    dueAt: Date.now() + 24 * 60 * 60 * 1000,
    easeFactor: 2.5, interval: 1, repetitions: 0,
  };
  return { ...state, problems: [...state.problems, entry], coverage: newCoverage, revisionQueue: [...state.revisionQueue, revItem] };
}

export function getProblemsForTopic(state: NotebookState, topicId: string): ProblemEntry[] {
  return state.problems.filter(p => p.topicId === topicId);
}

export function getDueRevisions(state: NotebookState): RevisionItem[] {
  const now = Date.now();
  return state.revisionQueue.filter(r => r.dueAt <= now);
}

export function markTopicCovered(state: NotebookState, topicId: string): NotebookState {
  return { ...state, coverage: { ...state.coverage, [topicId]: 'covered' }, masteryScores: { ...state.masteryScores, [topicId]: 100 } };
}

// ─── SM-2 Spaced Repetition ───────────────────────────────────────────────────

export function applySpacedRepetition(item: RevisionItem, quality: 0 | 1 | 2 | 3 | 4 | 5): RevisionItem {
  const q = quality;
  const ef = Math.max(1.3, item.easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  const reps = q >= 3 ? item.repetitions + 1 : 0;
  const interval = reps === 0 ? 1 : reps === 1 ? 6 : Math.round(item.interval * ef);
  const dueAt = Date.now() + interval * 24 * 60 * 60 * 1000;
  return { ...item, easeFactor: ef, repetitions: reps, interval, dueAt };
}

// ─── Note helpers ─────────────────────────────────────────────────────────────

export function addNote(state: NotebookState, note: Omit<NoteEntry, 'id' | 'timestamp' | 'updatedAt'>): NotebookState {
  const entry: NoteEntry = {
    ...note,
    id: `note-${Date.now()}`,
    timestamp: Date.now(),
    updatedAt: Date.now(),
  };
  return { ...state, notes: [...state.notes, entry] };
}

// ─── Mock seed data for demo ──────────────────────────────────────────────────

export function seedDemoProblems(state: NotebookState): NotebookState {
  let s = state;
  const demos: Omit<ProblemEntry, 'id' | 'timestamp' | 'revisionCount'>[] = [
    {
      topicId: 'jee-km-01', topicName: 'Projectile Motion', chapter: 'Kinematics', subject: 'Physics',
      exam: ['JEE Main'], question: 'A ball thrown at 30° with 40 m/s. Find max height. (g=10)',
      aiSolution: 'H = u²sin²θ/2g = 1600×0.25/20 = 20 m',
      aiSteps: ['Identify: u=40, θ=30°', 'sin²30° = 0.25', 'H = 1600×0.25/20 = 20 m'],
      difficulty: 'medium', source: 'practice', isCorrect: true, timeSpentSec: 45,
      tags: ['projectile', 'height'], isBookmarked: true, isFlagged: false,
    },
    {
      topicId: 'jee-c3', topicName: 'Integration by Parts', chapter: 'Calculus', subject: 'Mathematics',
      exam: ['JEE Main'], question: '∫ x·eˣ dx',
      aiSolution: 'x·eˣ − eˣ + C = eˣ(x−1) + C',
      aiSteps: ['Choose u=x, dv=eˣdx', 'du=dx, v=eˣ', '∫x eˣ dx = x eˣ − ∫eˣ dx', '= x eˣ − eˣ + C'],
      difficulty: 'medium', source: 'chat', isCorrect: false, timeSpentSec: 90,
      tags: ['integration', 'JEE pattern'], isBookmarked: false, isFlagged: true,
    },
    {
      topicId: 'jee-oc-01', topicName: 'Named Reactions', chapter: 'Organic Chemistry', subject: 'Chemistry',
      exam: ['JEE Main', 'NEET'], question: 'What is Cannizzaro reaction? Give example.',
      aiSolution: 'Non-enolizable aldehyde undergoes self-disproportionation in base → alcohol + carboxylate salt. E.g.: 2 HCHO + NaOH → CH₃OH + HCOONa',
      aiSteps: ['Identify: aldehyde with no α-H', 'Base conditions', 'One molecule oxidised, one reduced'],
      difficulty: 'hard', source: 'manual',
      tags: ['named reactions', 'organic', 'high yield'], isBookmarked: true, isFlagged: false,
    },
  ];
  for (const d of demos) s = addProblem(s, d);
  // Seed a note
  s = addNote(s, {
    topicId: 'jee-oc-01', topicName: 'Named Reactions', chapter: 'Organic Chemistry', subject: 'Chemistry',
    title: 'Top 10 Named Reactions for JEE',
    content: '1. Aldol Condensation\n2. Cannizzaro\n3. Wurtz Reaction\n4. Grignard Reaction\n5. Kolbe Reaction\n6. Reimer-Tiemann\n7. Friedel-Crafts\n8. Sandmeyer\n9. Hoffmann Bromamide\n10. Beckmann Rearrangement',
    tags: ['organic', 'named-reactions', 'quick-ref'],
    isBookmarked: true, color: '#8B5CF6',
  });
  return s;
}
