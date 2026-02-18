// @ts-nocheck
/**
 * Prompt Repository
 * Wolfram-style prompt management with versioning, modifiers, and A/B testing
 */

import { randomUUID } from 'crypto';
import {
  PromptTemplate,
  PromptModifier,
  PromptVariable,
  PromptVariant,
  PromptExecution,
  PromptABTest,
  PromptFilter,
  PromptCompileOptions,
  CompiledPrompt,
  PromptCategory,
  ModifierType,
  PromptMetrics,
  ABTestMetrics,
} from './types';

// ============================================================================
// Prompt Repository
// ============================================================================

export class PromptRepository {
  private templates: Map<string, PromptTemplate> = new Map();
  private modifiers: Map<string, PromptModifier> = new Map();
  private executions: Map<string, PromptExecution> = new Map();
  private abTests: Map<string, PromptABTest> = new Map();

  constructor() {
    this.initializeDefaultModifiers();
    this.initializeDefaultTemplates();
  }

  // -------------------------------------------------------------------------
  // Template Management
  // -------------------------------------------------------------------------

  async createTemplate(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<PromptTemplate> {
    const now = Date.now();
    const newTemplate: PromptTemplate = {
      ...template,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      metrics: {
        usageCount: 0,
        successRate: 0,
        avgLatencyMs: 0,
        avgTokens: 0,
        lastUsed: 0,
      },
    };

    this.templates.set(newTemplate.id, newTemplate);
    return newTemplate;
  }

  async getTemplate(id: string): Promise<PromptTemplate | undefined> {
    return this.templates.get(id);
  }

  async getTemplateByName(name: string): Promise<PromptTemplate | undefined> {
    for (const template of this.templates.values()) {
      if (template.name === name) {
        return template;
      }
    }
    return undefined;
  }

  async listTemplates(filter?: PromptFilter): Promise<PromptTemplate[]> {
    let templates = Array.from(this.templates.values());

    if (filter) {
      if (filter.category) {
        templates = templates.filter(t => t.category === filter.category);
      }
      if (filter.scope) {
        templates = templates.filter(t => t.scope === filter.scope);
      }
      if (filter.examType) {
        templates = templates.filter(t => t.examTypes?.includes(filter.examType!));
      }
      if (filter.isActive !== undefined) {
        templates = templates.filter(t => t.isActive === filter.isActive);
      }
      if (filter.search) {
        const search = filter.search.toLowerCase();
        templates = templates.filter(t =>
          t.name.toLowerCase().includes(search) ||
          t.description.toLowerCase().includes(search)
        );
      }
    }

    return templates;
  }

  async updateTemplate(id: string, updates: Partial<PromptTemplate>): Promise<PromptTemplate | undefined> {
    const template = this.templates.get(id);
    if (!template) return undefined;

    const updated: PromptTemplate = {
      ...template,
      ...updates,
      id: template.id,
      createdAt: template.createdAt,
      updatedAt: Date.now(),
      version: this.incrementVersion(template.version),
    };

    this.templates.set(id, updated);
    return updated;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    return this.templates.delete(id);
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[parts.length - 1]++;
    return parts.join('.');
  }

  // -------------------------------------------------------------------------
  // Modifier Management
  // -------------------------------------------------------------------------

  async createModifier(modifier: Omit<PromptModifier, 'id'>): Promise<PromptModifier> {
    const newModifier: PromptModifier = {
      ...modifier,
      id: randomUUID(),
    };

    this.modifiers.set(newModifier.id, newModifier);
    return newModifier;
  }

  async getModifier(type: ModifierType): Promise<PromptModifier | undefined> {
    for (const modifier of this.modifiers.values()) {
      if (modifier.type === type) {
        return modifier;
      }
    }
    return undefined;
  }

  async listModifiers(category?: PromptCategory): Promise<PromptModifier[]> {
    let modifiers = Array.from(this.modifiers.values());

    if (category) {
      modifiers = modifiers.filter(m => m.category.includes(category));
    }

    return modifiers;
  }

  // -------------------------------------------------------------------------
  // Prompt Compilation
  // -------------------------------------------------------------------------

  async compile(templateId: string, options: PromptCompileOptions): Promise<CompiledPrompt> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Select variant (for A/B testing)
    let selectedVariant: PromptVariant | undefined;
    let promptTemplate = template.userPromptTemplate;

    if (template.variants && template.variants.length > 0) {
      selectedVariant = options.variant
        ? template.variants.find(v => v.id === options.variant)
        : this.selectVariant(template.variants);

      if (selectedVariant) {
        promptTemplate = selectedVariant.promptTemplate;
      }
    }

    // Validate variables
    this.validateVariables(template.variables, options.variables);

    // Apply variable substitution
    let compiledPrompt = this.substituteVariables(promptTemplate, options.variables);
    let systemPrompt = template.systemPrompt
      ? this.substituteVariables(template.systemPrompt, options.variables)
      : undefined;

    // Apply modifiers
    const modifiersToApply = options.modifiers || template.defaultModifiers;
    const appliedModifiers: ModifierType[] = [];

    for (const modType of modifiersToApply) {
      if (!template.allowedModifiers.includes(modType) && !modType.startsWith('custom:')) {
        continue; // Skip disallowed modifiers
      }

      const modifier = await this.getModifier(modType);
      if (modifier) {
        // Check for conflicts
        const hasConflict = appliedModifiers.some(m =>
          modifier.conflicts?.includes(m)
        );
        if (hasConflict) continue;

        // Apply modifier
        compiledPrompt = this.applyModifier(compiledPrompt, modifier, options.variables);
        appliedModifiers.push(modType);
      }
    }

    return {
      systemPrompt,
      userPrompt: compiledPrompt,
      templateId,
      variantId: selectedVariant?.id,
      modifiersApplied: appliedModifiers,
      compiledAt: Date.now(),
    };
  }

  private validateVariables(
    definitions: PromptVariable[],
    provided: Record<string, unknown>
  ): void {
    for (const def of definitions) {
      if (def.required && !(def.name in provided)) {
        throw new Error(`Missing required variable: ${def.name}`);
      }

      const value = provided[def.name];
      if (value !== undefined && def.validation) {
        if (def.validation.enum && !def.validation.enum.includes(value)) {
          throw new Error(`Invalid value for ${def.name}: must be one of ${def.validation.enum.join(', ')}`);
        }
        if (typeof value === 'number') {
          if (def.validation.min !== undefined && value < def.validation.min) {
            throw new Error(`${def.name} must be >= ${def.validation.min}`);
          }
          if (def.validation.max !== undefined && value > def.validation.max) {
            throw new Error(`${def.name} must be <= ${def.validation.max}`);
          }
        }
      }
    }
  }

  private substituteVariables(
    template: string,
    variables: Record<string, unknown>
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(placeholder, String(value));
    }

    return result;
  }

  private applyModifier(
    prompt: string,
    modifier: PromptModifier,
    variables: Record<string, unknown>
  ): string {
    const modifierText = this.substituteVariables(modifier.template, variables);

    switch (modifier.position) {
      case 'prefix':
        return `${modifierText}\n\n${prompt}`;
      case 'suffix':
        return `${prompt}\n\n${modifierText}`;
      case 'inject':
        if (modifier.injectAt) {
          return prompt.replace(modifier.injectAt, `${modifier.injectAt}\n${modifierText}`);
        }
        return prompt;
      default:
        return prompt;
    }
  }

  private selectVariant(variants: PromptVariant[]): PromptVariant {
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    let random = Math.random() * totalWeight;

    for (const variant of variants) {
      random -= variant.weight;
      if (random <= 0) {
        return variant;
      }
    }

    return variants[0];
  }

  // -------------------------------------------------------------------------
  // Execution Tracking
  // -------------------------------------------------------------------------

  async recordExecution(execution: Omit<PromptExecution, 'id'>): Promise<PromptExecution> {
    const record: PromptExecution = {
      ...execution,
      id: randomUUID(),
    };

    this.executions.set(record.id, record);

    // Update template metrics
    await this.updateTemplateMetrics(execution.templateId, record);

    return record;
  }

  async completeExecution(
    id: string,
    result: { response?: string; success: boolean; error?: string }
  ): Promise<void> {
    const execution = this.executions.get(id);
    if (!execution) return;

    execution.completedAt = Date.now();
    execution.latencyMs = execution.completedAt - execution.startedAt;
    execution.response = result.response;
    execution.success = result.success;
    execution.error = result.error;

    this.executions.set(id, execution);
  }

  private async updateTemplateMetrics(
    templateId: string,
    execution: PromptExecution
  ): Promise<void> {
    const template = this.templates.get(templateId);
    if (!template || !template.metrics) return;

    const metrics = template.metrics;
    metrics.usageCount++;
    metrics.lastUsed = Date.now();

    if (execution.success) {
      // Update success rate (rolling average)
      metrics.successRate = (
        (metrics.successRate * (metrics.usageCount - 1) + 1) /
        metrics.usageCount
      );
    } else {
      metrics.successRate = (
        (metrics.successRate * (metrics.usageCount - 1)) /
        metrics.usageCount
      );
    }

    if (execution.latencyMs) {
      metrics.avgLatencyMs = (
        (metrics.avgLatencyMs * (metrics.usageCount - 1) + execution.latencyMs) /
        metrics.usageCount
      );
    }

    template.metrics = metrics;
    this.templates.set(templateId, template);
  }

  // -------------------------------------------------------------------------
  // A/B Testing
  // -------------------------------------------------------------------------

  async createABTest(test: Omit<PromptABTest, 'id' | 'variantMetrics'>): Promise<PromptABTest> {
    const abTest: PromptABTest = {
      ...test,
      id: randomUUID(),
      variantMetrics: {},
    };

    // Initialize metrics for each variant
    for (const variant of test.variants) {
      abTest.variantMetrics[variant.id] = {
        impressions: 0,
        conversions: 0,
        conversionRate: 0,
        avgEngagement: 0,
        avgQuality: 0,
        statisticalSignificance: 0,
      };
    }

    this.abTests.set(abTest.id, abTest);

    // Link test to template
    const template = this.templates.get(test.templateId);
    if (template) {
      template.abTestId = abTest.id;
      template.variants = test.variants;
      this.templates.set(template.id, template);
    }

    return abTest;
  }

  async getABTest(id: string): Promise<PromptABTest | undefined> {
    return this.abTests.get(id);
  }

  async updateABTestMetrics(
    testId: string,
    variantId: string,
    metrics: Partial<ABTestMetrics>
  ): Promise<void> {
    const test = this.abTests.get(testId);
    if (!test) return;

    const current = test.variantMetrics[variantId] || {
      impressions: 0,
      conversions: 0,
      conversionRate: 0,
      avgEngagement: 0,
      avgQuality: 0,
      statisticalSignificance: 0,
    };

    test.variantMetrics[variantId] = {
      ...current,
      ...metrics,
    };

    // Recalculate conversion rate
    if (metrics.impressions || metrics.conversions) {
      const m = test.variantMetrics[variantId];
      m.conversionRate = m.impressions > 0 ? m.conversions / m.impressions : 0;
    }

    this.abTests.set(testId, test);
  }

  async concludeABTest(testId: string): Promise<{ winner: string; confidence: number }> {
    const test = this.abTests.get(testId);
    if (!test) throw new Error('Test not found');

    // Find best performing variant
    let bestVariant = '';
    let bestConversion = -1;

    for (const [variantId, metrics] of Object.entries(test.variantMetrics)) {
      if (metrics.conversionRate > bestConversion) {
        bestConversion = metrics.conversionRate;
        bestVariant = variantId;
      }
    }

    // Calculate statistical significance (simplified)
    const confidence = this.calculateConfidence(test);

    test.status = 'completed';
    test.endedAt = Date.now();
    test.winner = bestVariant;
    test.confidenceLevel = confidence;

    this.abTests.set(testId, test);

    return { winner: bestVariant, confidence };
  }

  private calculateConfidence(test: PromptABTest): number {
    // Simplified confidence calculation
    // In production, use proper statistical methods (chi-squared, t-test)
    const totalSamples = Object.values(test.variantMetrics)
      .reduce((sum, m) => sum + m.impressions, 0);

    if (totalSamples < 100) return 0;
    if (totalSamples < 500) return 0.7;
    if (totalSamples < 1000) return 0.85;
    return 0.95;
  }

  // -------------------------------------------------------------------------
  // Default Initialization
  // -------------------------------------------------------------------------

  private initializeDefaultModifiers(): void {
    const defaultModifiers: Omit<PromptModifier, 'id'>[] = [
      // Tone modifiers
      {
        type: 'tone:formal',
        name: 'Formal Tone',
        description: 'Use formal, professional language',
        template: 'Use formal language, avoid colloquialisms, maintain professional tone.',
        position: 'prefix',
        category: ['content', 'marketing', 'tutoring'],
      },
      {
        type: 'tone:casual',
        name: 'Casual Tone',
        description: 'Use friendly, conversational language',
        template: 'Use friendly, conversational language. Be approachable and relatable.',
        position: 'prefix',
        category: ['content', 'marketing', 'engagement'],
        conflicts: ['tone:formal', 'tone:academic'],
      },
      {
        type: 'tone:friendly',
        name: 'Friendly Tone',
        description: 'Warm and encouraging',
        template: 'Be warm, encouraging, and supportive. Use positive language.',
        position: 'prefix',
        category: ['tutoring', 'engagement'],
      },
      {
        type: 'tone:academic',
        name: 'Academic Tone',
        description: 'Scholarly and precise',
        template: 'Use precise academic language. Cite concepts clearly. Be methodical.',
        position: 'prefix',
        category: ['content', 'tutoring'],
        conflicts: ['tone:casual'],
      },

      // Language modifiers
      {
        type: 'lang:hinglish',
        name: 'Hinglish',
        description: 'Mix of Hindi and English',
        template: 'Use Hinglish - a natural mix of Hindi and English. Example: "Yeh concept bahut important hai for your exam."',
        position: 'prefix',
        category: ['content', 'tutoring', 'marketing', 'engagement'],
      },
      {
        type: 'lang:simple',
        name: 'Simple Language',
        description: 'Easy to understand vocabulary',
        template: 'Use simple vocabulary. Avoid jargon. Explain complex terms when used.',
        position: 'prefix',
        category: ['content', 'tutoring'],
      },
      {
        type: 'lang:technical',
        name: 'Technical Language',
        description: 'Use precise technical terms',
        template: 'Use proper technical terminology. Assume familiarity with domain concepts.',
        position: 'prefix',
        category: ['content', 'tutoring'],
        conflicts: ['lang:simple'],
      },

      // Format modifiers
      {
        type: 'format:listicle',
        name: 'Listicle Format',
        description: 'Numbered or bulleted list format',
        template: 'Structure the content as a numbered list with clear, scannable points.',
        position: 'prefix',
        category: ['content', 'marketing'],
      },
      {
        type: 'format:explainer',
        name: 'Explainer Format',
        description: 'Step-by-step explanation',
        template: 'Provide a clear, step-by-step explanation. Start with basics, build to complex.',
        position: 'prefix',
        category: ['content', 'tutoring'],
      },
      {
        type: 'format:qa',
        name: 'Q&A Format',
        description: 'Question and answer format',
        template: 'Structure as questions and answers. Anticipate common doubts.',
        position: 'prefix',
        category: ['content', 'tutoring'],
      },
      {
        type: 'format:story',
        name: 'Story Format',
        description: 'Narrative storytelling approach',
        template: 'Present the content through a relatable story or scenario.',
        position: 'prefix',
        category: ['content', 'marketing'],
      },
      {
        type: 'format:tutorial',
        name: 'Tutorial Format',
        description: 'Hands-on tutorial with examples',
        template: 'Create a hands-on tutorial with practical examples and exercises.',
        position: 'prefix',
        category: ['content', 'tutoring'],
      },

      // Audience modifiers
      {
        type: 'audience:student',
        name: 'Student Audience',
        description: 'Targeting students',
        template: 'Target students preparing for exams. Focus on exam relevance and practical application.',
        position: 'prefix',
        category: ['content', 'marketing', 'tutoring'],
      },
      {
        type: 'audience:parent',
        name: 'Parent Audience',
        description: 'Targeting parents',
        template: 'Address parents. Focus on child\'s progress, safety, and results.',
        position: 'prefix',
        category: ['marketing', 'engagement'],
        conflicts: ['audience:student', 'audience:teacher'],
      },
      {
        type: 'audience:beginner',
        name: 'Beginner Level',
        description: 'For beginners with no prior knowledge',
        template: 'Assume no prior knowledge. Start from absolute basics.',
        position: 'prefix',
        category: ['content', 'tutoring'],
        conflicts: ['audience:advanced'],
      },
      {
        type: 'audience:advanced',
        name: 'Advanced Level',
        description: 'For advanced learners',
        template: 'Target advanced learners. Include nuanced concepts and edge cases.',
        position: 'prefix',
        category: ['content', 'tutoring'],
        conflicts: ['audience:beginner'],
      },

      // Exam style modifiers
      {
        type: 'style:jee',
        name: 'JEE Style',
        description: 'JEE examination style',
        template: 'Follow JEE pattern: focus on problem-solving, numerical accuracy, time management. Include PYQ-style questions.',
        position: 'prefix',
        category: ['content', 'tutoring'],
      },
      {
        type: 'style:neet',
        name: 'NEET Style',
        description: 'NEET examination style',
        template: 'Follow NEET pattern: focus on conceptual clarity, NCERT alignment, biology emphasis.',
        position: 'prefix',
        category: ['content', 'tutoring'],
      },
      {
        type: 'style:board',
        name: 'Board Exam Style',
        description: 'Board examination style',
        template: 'Follow board exam pattern: theory questions, derivations, diagram-based answers.',
        position: 'prefix',
        category: ['content', 'tutoring'],
      },

      // Output modifiers
      {
        type: 'output:concise',
        name: 'Concise Output',
        description: 'Brief and to-the-point',
        template: 'Be concise. Maximum 200 words. Focus on key points only.',
        position: 'suffix',
        category: ['content', 'tutoring', 'marketing'],
        conflicts: ['output:detailed'],
      },
      {
        type: 'output:detailed',
        name: 'Detailed Output',
        description: 'Comprehensive and thorough',
        template: 'Provide detailed explanations. Include examples, edge cases, and elaborations.',
        position: 'suffix',
        category: ['content', 'tutoring'],
        conflicts: ['output:concise'],
      },
      {
        type: 'output:stepwise',
        name: 'Step-wise Output',
        description: 'Step-by-step breakdown',
        template: 'Break down into clear numbered steps. Show work for each step.',
        position: 'suffix',
        category: ['content', 'tutoring'],
      },
    ];

    for (const modifier of defaultModifiers) {
      this.createModifier(modifier);
    }
  }

  private initializeDefaultTemplates(): void {
    // Templates will be added by category
    // Content templates
    this.createTemplate({
      name: 'blog_post',
      description: 'Generate a blog post on an educational topic',
      category: 'content',
      scope: 'global',
      userPromptTemplate: `Write a blog post about "{{topic}}" for {{exam}} students.

Target audience: {{audience}}
Word count: {{wordCount}}
Keywords to include: {{keywords}}

The blog should:
1. Have an engaging introduction
2. Cover key concepts clearly
3. Include practical examples
4. End with actionable takeaways`,
      variables: [
        { name: 'topic', type: 'string', description: 'Blog topic', required: true },
        { name: 'exam', type: 'string', description: 'Target exam', required: true },
        { name: 'audience', type: 'string', description: 'Target audience', required: false, defaultValue: 'students' },
        { name: 'wordCount', type: 'number', description: 'Target word count', required: false, defaultValue: 1000 },
        { name: 'keywords', type: 'array', description: 'SEO keywords', required: false, defaultValue: [] },
      ],
      defaultModifiers: ['audience:student', 'format:explainer'],
      allowedModifiers: [
        'tone:formal', 'tone:casual', 'tone:friendly', 'tone:academic',
        'lang:hinglish', 'lang:simple',
        'format:listicle', 'format:explainer', 'format:qa', 'format:story',
        'audience:student', 'audience:beginner', 'audience:advanced',
        'style:jee', 'style:neet', 'style:board',
        'output:concise', 'output:detailed',
      ],
      version: '1.0.0',
      isActive: true,
      createdBy: 'system',
    });

    // Tutoring templates
    this.createTemplate({
      name: 'socratic_question',
      description: 'Generate Socratic questioning for tutoring',
      category: 'tutoring',
      scope: 'global',
      systemPrompt: 'You are a Socratic tutor. Never give direct answers. Guide through questions.',
      userPromptTemplate: `The student is working on: "{{problem}}"
Their current understanding: {{currentLevel}}
Their attempted answer: {{attempt}}

Ask guiding questions to help them discover the correct approach without giving away the answer.`,
      variables: [
        { name: 'problem', type: 'string', description: 'The problem being solved', required: true },
        { name: 'currentLevel', type: 'string', description: 'Student level', required: false, defaultValue: 'intermediate' },
        { name: 'attempt', type: 'string', description: 'Student attempt', required: false },
      ],
      defaultModifiers: ['tone:friendly', 'audience:student'],
      allowedModifiers: [
        'tone:friendly', 'lang:hinglish', 'lang:simple',
        'audience:beginner', 'audience:advanced',
        'style:jee', 'style:neet', 'style:board',
        'output:stepwise',
      ],
      version: '1.0.0',
      isActive: true,
      createdBy: 'system',
    });

    // Marketing templates
    this.createTemplate({
      name: 'social_post',
      description: 'Generate social media post',
      category: 'marketing',
      scope: 'global',
      userPromptTemplate: `Create a {{platform}} post about "{{topic}}" for {{exam}} preparation.

Goal: {{goal}}
Character limit: {{charLimit}}
Include hashtags: {{includeHashtags}}`,
      variables: [
        { name: 'platform', type: 'string', description: 'Social platform', required: true, validation: { enum: ['twitter', 'linkedin', 'instagram', 'facebook'] } },
        { name: 'topic', type: 'string', description: 'Post topic', required: true },
        { name: 'exam', type: 'string', description: 'Target exam', required: true },
        { name: 'goal', type: 'string', description: 'Post goal', required: false, defaultValue: 'engagement' },
        { name: 'charLimit', type: 'number', description: 'Character limit', required: false, defaultValue: 280 },
        { name: 'includeHashtags', type: 'boolean', description: 'Include hashtags', required: false, defaultValue: true },
      ],
      defaultModifiers: ['tone:casual', 'audience:student', 'output:concise'],
      allowedModifiers: [
        'tone:casual', 'tone:friendly',
        'lang:hinglish',
        'audience:student', 'audience:parent',
        'output:concise',
      ],
      version: '1.0.0',
      isActive: true,
      createdBy: 'system',
    });
  }

  // Alias stubs for backward compatibility
  async execute(templateId: string, variables: Record<string, unknown>): Promise<string> {
    const compiled = await this.compile(templateId, { variables: variables as Record<string, string> });
    return compiled.content;
  }

  async listPrompts(filter?: PromptFilter): Promise<PromptTemplate[]> {
    return this.listTemplates(filter);
  }

  async getPrompt(id: string): Promise<PromptTemplate | undefined> {
    return this.getTemplate(id);
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const promptRepository = new PromptRepository();
