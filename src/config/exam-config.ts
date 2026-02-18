// @ts-nocheck
/**
 * Exam Configuration Manager
 * Handles exam nature, format, content cadence, and configuration
 */

import { randomUUID } from 'crypto';
import {
  ExamConfig,
  ExamNature,
  ExamFormat,
  SubjectConfig,
  DifficultyDistribution,
  ContentCadence,
  LanguageConfig,
  MarketingBudget,
  PilotConfig,
  QuestionType,
  SectionFormat,
} from '../prompts/types';

// ============================================================================
// Default Exam Configurations
// ============================================================================

const DEFAULT_EXAM_CONFIGS: Record<string, Partial<ExamConfig>> = {
  JEE: {
    name: 'JEE Main',
    code: 'JEE',
    nature: {
      type: 'entrance',
      level: 'undergraduate',
      frequency: 'biannual',
      importance: 'critical',
    },
    format: {
      questionTypes: [
        { type: 'mcq', weight: 80, marks: 4 },
        { type: 'numerical', weight: 20, marks: 4 },
      ],
      totalMarks: 300,
      duration: 180,
      sections: [
        { name: 'Physics', subjects: ['physics'], mandatory: true, questionCount: 25, marks: 100 },
        { name: 'Chemistry', subjects: ['chemistry'], mandatory: true, questionCount: 25, marks: 100 },
        { name: 'Mathematics', subjects: ['mathematics'], mandatory: true, questionCount: 25, marks: 100 },
      ],
      negativemarking: true,
      negativeMarkingRatio: 1,
      calculator: 'none',
    },
    difficultyDistribution: { easy: 30, medium: 50, hard: 20 },
    contentCadence: {
      questionsPerDay: 50,
      blogsPerWeek: 3,
      videosPerWeek: 2,
      practiceTestsPerMonth: 4,
      revisionsPerChapter: 3,
    },
    languages: [
      { code: 'en', name: 'English', priority: 1, coverage: 100 },
      { code: 'hi', name: 'Hindi', priority: 2, coverage: 80 },
      { code: 'hinglish', name: 'Hinglish', priority: 3, coverage: 50 },
    ],
  },

  NEET: {
    name: 'NEET UG',
    code: 'NEET',
    nature: {
      type: 'entrance',
      level: 'undergraduate',
      frequency: 'annual',
      importance: 'critical',
    },
    format: {
      questionTypes: [
        { type: 'mcq', weight: 100, marks: 4 },
      ],
      totalMarks: 720,
      duration: 200,
      sections: [
        { name: 'Physics', subjects: ['physics'], mandatory: true, questionCount: 45, marks: 180 },
        { name: 'Chemistry', subjects: ['chemistry'], mandatory: true, questionCount: 45, marks: 180 },
        { name: 'Biology', subjects: ['biology'], mandatory: true, questionCount: 90, marks: 360 },
      ],
      negativemarking: true,
      negativeMarkingRatio: 1,
      calculator: 'none',
    },
    difficultyDistribution: { easy: 35, medium: 45, hard: 20 },
    contentCadence: {
      questionsPerDay: 60,
      blogsPerWeek: 4,
      videosPerWeek: 3,
      practiceTestsPerMonth: 4,
      revisionsPerChapter: 3,
    },
    languages: [
      { code: 'en', name: 'English', priority: 1, coverage: 100 },
      { code: 'hi', name: 'Hindi', priority: 2, coverage: 90 },
    ],
  },

  CBSE10: {
    name: 'CBSE Class 10 Boards',
    code: 'CBSE10',
    nature: {
      type: 'board',
      level: 'school',
      frequency: 'annual',
      importance: 'high',
    },
    format: {
      questionTypes: [
        { type: 'mcq', weight: 20, marks: 1 },
        { type: 'short', weight: 40, marks: 3 },
        { type: 'long', weight: 40, marks: 5 },
      ],
      totalMarks: 80,
      duration: 180,
      sections: [],
      negativemarking: false,
      calculator: 'none',
    },
    difficultyDistribution: { easy: 40, medium: 40, hard: 20 },
    contentCadence: {
      questionsPerDay: 30,
      blogsPerWeek: 2,
      videosPerWeek: 2,
      practiceTestsPerMonth: 2,
      revisionsPerChapter: 2,
    },
    languages: [
      { code: 'en', name: 'English', priority: 1, coverage: 100 },
      { code: 'hi', name: 'Hindi', priority: 2, coverage: 80 },
    ],
  },

  CBSE12: {
    name: 'CBSE Class 12 Boards',
    code: 'CBSE12',
    nature: {
      type: 'board',
      level: 'school',
      frequency: 'annual',
      importance: 'high',
    },
    format: {
      questionTypes: [
        { type: 'mcq', weight: 20, marks: 1 },
        { type: 'short', weight: 30, marks: 3 },
        { type: 'long', weight: 50, marks: 5 },
      ],
      totalMarks: 80,
      duration: 180,
      sections: [],
      negativemarking: false,
      calculator: 'none',
    },
    difficultyDistribution: { easy: 35, medium: 45, hard: 20 },
    contentCadence: {
      questionsPerDay: 40,
      blogsPerWeek: 3,
      videosPerWeek: 2,
      practiceTestsPerMonth: 3,
      revisionsPerChapter: 3,
    },
    languages: [
      { code: 'en', name: 'English', priority: 1, coverage: 100 },
      { code: 'hi', name: 'Hindi', priority: 2, coverage: 75 },
    ],
  },

  CAT: {
    name: 'CAT',
    code: 'CAT',
    nature: {
      type: 'entrance',
      level: 'graduate',
      frequency: 'annual',
      importance: 'critical',
    },
    format: {
      questionTypes: [
        { type: 'mcq', weight: 75, marks: 3 },
        { type: 'numerical', weight: 25, marks: 3 },
      ],
      totalMarks: 198,
      duration: 120,
      sections: [
        { name: 'VARC', subjects: ['verbal'], mandatory: true, questionCount: 24, marks: 66 },
        { name: 'DILR', subjects: ['reasoning'], mandatory: true, questionCount: 20, marks: 66 },
        { name: 'QA', subjects: ['quantitative'], mandatory: true, questionCount: 22, marks: 66 },
      ],
      negativemarking: true,
      negativeMarkingRatio: 1,
      calculator: 'scientific',
    },
    difficultyDistribution: { easy: 25, medium: 50, hard: 25 },
    contentCadence: {
      questionsPerDay: 30,
      blogsPerWeek: 2,
      videosPerWeek: 1,
      practiceTestsPerMonth: 4,
      revisionsPerChapter: 2,
    },
    languages: [
      { code: 'en', name: 'English', priority: 1, coverage: 100 },
    ],
  },

  UPSC: {
    name: 'UPSC Civil Services',
    code: 'UPSC',
    nature: {
      type: 'competitive',
      level: 'graduate',
      frequency: 'annual',
      importance: 'critical',
    },
    format: {
      questionTypes: [
        { type: 'mcq', weight: 100, marks: 2 },
      ],
      totalMarks: 200,
      duration: 120,
      sections: [
        { name: 'GS', subjects: ['general-studies'], mandatory: true, questionCount: 100, marks: 200 },
      ],
      negativemarking: true,
      negativeMarkingRatio: 0.33,
      calculator: 'none',
    },
    difficultyDistribution: { easy: 20, medium: 50, hard: 30 },
    contentCadence: {
      questionsPerDay: 25,
      blogsPerWeek: 5,
      videosPerWeek: 2,
      practiceTestsPerMonth: 4,
      revisionsPerChapter: 4,
    },
    languages: [
      { code: 'en', name: 'English', priority: 1, coverage: 100 },
      { code: 'hi', name: 'Hindi', priority: 2, coverage: 90 },
    ],
  },
};

// ============================================================================
// Exam Config Manager
// ============================================================================

export class ExamConfigManager {
  private configs: Map<string, ExamConfig> = new Map();

  constructor() {
    // Initialize default configs
    for (const [code, partial] of Object.entries(DEFAULT_EXAM_CONFIGS)) {
      this.createConfig(partial as Partial<ExamConfig>);
    }
  }

  // -------------------------------------------------------------------------
  // Config Management
  // -------------------------------------------------------------------------

  async createConfig(params: Partial<ExamConfig>): Promise<ExamConfig> {
    const config: ExamConfig = {
      id: randomUUID(),
      name: params.name || 'New Exam',
      code: params.code || 'NEW',
      nature: params.nature || {
        type: 'competitive',
        level: 'school',
        frequency: 'annual',
        importance: 'medium',
      },
      format: params.format || {
        questionTypes: [{ type: 'mcq', weight: 100, marks: 1 }],
        totalMarks: 100,
        duration: 60,
        sections: [],
        negativemarking: false,
        calculator: 'none',
      },
      subjects: params.subjects || [],
      difficultyDistribution: params.difficultyDistribution || { easy: 30, medium: 50, hard: 20 },
      contentCadence: params.contentCadence || {
        questionsPerDay: 20,
        blogsPerWeek: 2,
        videosPerWeek: 1,
        practiceTestsPerMonth: 2,
        revisionsPerChapter: 2,
      },
      languages: params.languages || [
        { code: 'en', name: 'English', priority: 1, coverage: 100 },
      ],
      marketingBudget: params.marketingBudget || {
        total: 10000,
        channels: {
          social: 30,
          email: 20,
          ads: 30,
          influencer: 10,
          content: 10,
        },
      },
      deploymentMode: params.deploymentMode || 'pilot',
      pilotConfig: params.pilotConfig,
      status: params.status || 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.configs.set(config.id, config);
    return config;
  }

  async getConfig(id: string): Promise<ExamConfig | undefined> {
    return this.configs.get(id);
  }

  async getConfigByCode(code: string): Promise<ExamConfig | undefined> {
    for (const config of this.configs.values()) {
      if (config.code === code) return config;
    }
    return undefined;
  }

  async listConfigs(filter?: {
    nature?: string;
    level?: string;
    status?: string;
    deploymentMode?: string;
  }): Promise<ExamConfig[]> {
    let configs = Array.from(this.configs.values());

    if (filter) {
      if (filter.nature) {
        configs = configs.filter(c => c.nature.type === filter.nature);
      }
      if (filter.level) {
        configs = configs.filter(c => c.nature.level === filter.level);
      }
      if (filter.status) {
        configs = configs.filter(c => c.status === filter.status);
      }
      if (filter.deploymentMode) {
        configs = configs.filter(c => c.deploymentMode === filter.deploymentMode);
      }
    }

    return configs;
  }

  async updateConfig(id: string, updates: Partial<ExamConfig>): Promise<ExamConfig | undefined> {
    const config = this.configs.get(id);
    if (!config) return undefined;

    const updated: ExamConfig = {
      ...config,
      ...updates,
      id: config.id,
      updatedAt: Date.now(),
    };

    this.configs.set(id, updated);
    return updated;
  }

  // -------------------------------------------------------------------------
  // Exam Nature & Format
  // -------------------------------------------------------------------------

  async setExamNature(id: string, nature: ExamNature): Promise<ExamConfig | undefined> {
    return this.updateConfig(id, { nature });
  }

  async setExamFormat(id: string, format: ExamFormat): Promise<ExamConfig | undefined> {
    return this.updateConfig(id, { format });
  }

  async addQuestionType(id: string, questionType: QuestionType): Promise<ExamConfig | undefined> {
    const config = this.configs.get(id);
    if (!config) return undefined;

    config.format.questionTypes.push(questionType);
    config.updatedAt = Date.now();

    this.configs.set(id, config);
    return config;
  }

  async addSection(id: string, section: SectionFormat): Promise<ExamConfig | undefined> {
    const config = this.configs.get(id);
    if (!config) return undefined;

    config.format.sections.push(section);
    config.updatedAt = Date.now();

    this.configs.set(id, config);
    return config;
  }

  // -------------------------------------------------------------------------
  // Content Cadence
  // -------------------------------------------------------------------------

  async setContentCadence(id: string, cadence: ContentCadence): Promise<ExamConfig | undefined> {
    return this.updateConfig(id, { contentCadence: cadence });
  }

  async adjustContentCadence(
    id: string,
    factor: number,
    metrics?: { type: string }
  ): Promise<ExamConfig | undefined> {
    const config = this.configs.get(id);
    if (!config) return undefined;

    const adjustedCadence: ContentCadence = {
      questionsPerDay: Math.round(config.contentCadence.questionsPerDay * factor),
      blogsPerWeek: Math.max(1, Math.round(config.contentCadence.blogsPerWeek * factor)),
      videosPerWeek: Math.max(1, Math.round(config.contentCadence.videosPerWeek * factor)),
      practiceTestsPerMonth: Math.max(1, Math.round(config.contentCadence.practiceTestsPerMonth * factor)),
      revisionsPerChapter: config.contentCadence.revisionsPerChapter, // Don't scale this
    };

    config.contentCadence = adjustedCadence;
    config.updatedAt = Date.now();

    this.configs.set(id, config);
    return config;
  }

  // -------------------------------------------------------------------------
  // Languages
  // -------------------------------------------------------------------------

  async setLanguages(id: string, languages: LanguageConfig[]): Promise<ExamConfig | undefined> {
    return this.updateConfig(id, { languages });
  }

  async addLanguage(id: string, language: LanguageConfig): Promise<ExamConfig | undefined> {
    const config = this.configs.get(id);
    if (!config) return undefined;

    config.languages.push(language);
    config.languages.sort((a, b) => a.priority - b.priority);
    config.updatedAt = Date.now();

    this.configs.set(id, config);
    return config;
  }

  // -------------------------------------------------------------------------
  // Marketing Budget
  // -------------------------------------------------------------------------

  async setMarketingBudget(id: string, budget: MarketingBudget): Promise<ExamConfig | undefined> {
    return this.updateConfig(id, { marketingBudget: budget });
  }

  async allocateBudget(
    id: string,
    allocations: Record<string, number>
  ): Promise<ExamConfig | undefined> {
    const config = this.configs.get(id);
    if (!config) return undefined;

    const total = Object.values(allocations).reduce((sum, v) => sum + v, 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new Error('Budget allocations must sum to 100%');
    }

    config.marketingBudget.channels = {
      social: allocations.social || 0,
      email: allocations.email || 0,
      ads: allocations.ads || 0,
      influencer: allocations.influencer || 0,
      content: allocations.content || 0,
    };
    config.updatedAt = Date.now();

    this.configs.set(id, config);
    return config;
  }

  // -------------------------------------------------------------------------
  // Deployment Mode
  // -------------------------------------------------------------------------

  async setDeploymentMode(
    id: string,
    mode: 'pilot' | 'full',
    pilotConfig?: PilotConfig
  ): Promise<ExamConfig | undefined> {
    const config = this.configs.get(id);
    if (!config) return undefined;

    config.deploymentMode = mode;
    if (mode === 'pilot' && pilotConfig) {
      config.pilotConfig = pilotConfig;
      config.pilotStartDate = Date.now();
    }
    if (mode === 'full') {
      config.pilotConfig = undefined;
    }
    config.updatedAt = Date.now();

    this.configs.set(id, config);
    return config;
  }

  async activateExam(id: string): Promise<ExamConfig | undefined> {
    return this.updateConfig(id, {
      status: config.deploymentMode === 'pilot' ? 'pilot' : 'active',
    });
  }

  // -------------------------------------------------------------------------
  // Difficulty Distribution
  // -------------------------------------------------------------------------

  async setDifficultyDistribution(
    id: string,
    distribution: DifficultyDistribution
  ): Promise<ExamConfig | undefined> {
    const total = distribution.easy + distribution.medium + distribution.hard;
    if (Math.abs(total - 100) > 0.01) {
      throw new Error('Difficulty distribution must sum to 100%');
    }

    return this.updateConfig(id, { difficultyDistribution: distribution });
  }

  // -------------------------------------------------------------------------
  // Subjects
  // -------------------------------------------------------------------------

  async addSubject(id: string, subject: SubjectConfig): Promise<ExamConfig | undefined> {
    const config = this.configs.get(id);
    if (!config) return undefined;

    config.subjects.push(subject);
    config.updatedAt = Date.now();

    this.configs.set(id, config);
    return config;
  }

  async updateSubject(
    id: string,
    subjectCode: string,
    updates: Partial<SubjectConfig>
  ): Promise<ExamConfig | undefined> {
    const config = this.configs.get(id);
    if (!config) return undefined;

    const subjectIndex = config.subjects.findIndex(s => s.code === subjectCode);
    if (subjectIndex === -1) return undefined;

    config.subjects[subjectIndex] = {
      ...config.subjects[subjectIndex],
      ...updates,
    };
    config.updatedAt = Date.now();

    this.configs.set(id, config);
    return config;
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  async validateConfig(id: string): Promise<{ valid: boolean; errors: string[] }> {
    const config = this.configs.get(id);
    if (!config) {
      return { valid: false, errors: ['Config not found'] };
    }

    const errors: string[] = [];

    // Validate nature
    if (!config.nature.type) {
      errors.push('Exam nature type is required');
    }

    // Validate format
    if (config.format.questionTypes.length === 0) {
      errors.push('At least one question type is required');
    }

    const questionTypeWeight = config.format.questionTypes.reduce((sum, qt) => sum + qt.weight, 0);
    if (Math.abs(questionTypeWeight - 100) > 0.01) {
      errors.push('Question type weights must sum to 100%');
    }

    // Validate difficulty distribution
    const diffTotal = config.difficultyDistribution.easy +
                      config.difficultyDistribution.medium +
                      config.difficultyDistribution.hard;
    if (Math.abs(diffTotal - 100) > 0.01) {
      errors.push('Difficulty distribution must sum to 100%');
    }

    // Validate languages
    if (config.languages.length === 0) {
      errors.push('At least one language is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  async cloneConfig(id: string, newCode: string, newName: string): Promise<ExamConfig | undefined> {
    const original = this.configs.get(id);
    if (!original) return undefined;

    const clone: Partial<ExamConfig> = {
      ...original,
      code: newCode,
      name: newName,
      status: 'draft',
      deploymentMode: 'pilot',
      pilotConfig: undefined,
    };

    return this.createConfig(clone);
  }

  async getPromptModifiers(id: string): Promise<string[]> {
    const config = this.configs.get(id);
    if (!config) return [];

    const modifiers: string[] = [];

    // Add style modifier based on exam type
    switch (config.code) {
      case 'JEE':
        modifiers.push('style:jee');
        break;
      case 'NEET':
        modifiers.push('style:neet');
        break;
      case 'CBSE10':
      case 'CBSE12':
        modifiers.push('style:board');
        break;
      default:
        modifiers.push('style:competitive');
    }

    // Add language modifiers
    for (const lang of config.languages) {
      if (lang.code === 'hinglish') {
        modifiers.push('lang:hinglish');
      }
    }

    // Add difficulty-based modifiers
    if (config.difficultyDistribution.hard > 25) {
      modifiers.push('audience:advanced');
    } else if (config.difficultyDistribution.easy > 40) {
      modifiers.push('audience:beginner');
    }

    return modifiers;
  }
}

// ============================================================================
// Export
// ============================================================================

export const examConfigManager = new ExamConfigManager();
