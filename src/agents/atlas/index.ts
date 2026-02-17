/**
 * Atlas Agent - Content Engine
 * Creates, manages, and publishes educational content
 */

import { BaseAgent, AgentConfig, AgentContext } from '../base-agent';
import { LLMClient } from '../../llm';
import {
  ContentRequestPayload,
  ContentCreatedPayload,
  ContentPublishedPayload,
} from '../../events/types';
import { Content, ContentType, ContentStatus, DifficultyLevel } from '../../data/types';

// ============================================================================
// Atlas Agent Configuration
// ============================================================================

const ATLAS_CONFIG: AgentConfig = {
  id: 'Atlas',
  name: 'Atlas',
  description: 'Content engine agent - creates and manages educational content',
  heartbeatIntervalMs: 30 * 60 * 1000, // 30 minutes
  budget: {
    dailyTokenLimit: 200000,
    warningThreshold: 0.8,
  },
  subAgents: [
    {
      id: 'Curator',
      name: 'Content Curator',
      description: 'Topic selection, gap analysis, content planning',
      triggers: ['request:content', 'schedule:daily'],
      handler: 'curate',
    },
    {
      id: 'Writer',
      name: 'Content Writer',
      description: 'Writes lessons, explanations, summaries',
      triggers: ['request:write'],
      handler: 'write',
    },
    {
      id: 'QuizMaster',
      name: 'Quiz Master',
      description: 'Creates questions, assessments, practice sets',
      triggers: ['request:quiz'],
      handler: 'createQuiz',
    },
    {
      id: 'Visualizer',
      name: 'Visual Designer',
      description: 'Creates diagram specs, infographic layouts',
      triggers: ['request:visual'],
      handler: 'createVisual',
    },
    {
      id: 'SEOOptimizer',
      name: 'SEO Optimizer',
      description: 'Optimizes content for search engines',
      triggers: ['content:created'],
      handler: 'optimizeSEO',
    },
    {
      id: 'Translator',
      name: 'Language Translator',
      description: 'Translates content to vernacular languages',
      triggers: ['request:translate'],
      handler: 'translate',
    },
    {
      id: 'FactChecker',
      name: 'Fact Checker',
      description: 'Verifies accuracy of content',
      triggers: ['content:review'],
      handler: 'checkFacts',
    },
  ],
};

// ============================================================================
// Atlas Agent Implementation
// ============================================================================

export class AtlasAgent extends BaseAgent {
  private contentQueue: ContentTask[] = [];
  private processingContent: Map<string, ContentTask> = new Map();

  constructor(config: Partial<AgentConfig> = {}) {
    super({ ...ATLAS_CONFIG, ...config });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  protected async initializeLLM(): Promise<void> {
    // LLM client initialization
    this.llm = null; // Will be injected
  }

  protected registerSubAgents(): void {
    this.registerSubAgent('Curator', this.curate.bind(this));
    this.registerSubAgent('Writer', this.write.bind(this));
    this.registerSubAgent('QuizMaster', this.createQuiz.bind(this));
    this.registerSubAgent('Visualizer', this.createVisual.bind(this));
    this.registerSubAgent('SEOOptimizer', this.optimizeSEO.bind(this));
    this.registerSubAgent('Translator', this.translate.bind(this));
    this.registerSubAgent('FactChecker', this.checkFacts.bind(this));
  }

  protected async setupSubscriptions(): Promise<void> {
    // Listen for content requests
    this.subscribe('atlas.content.requested', async (event) => {
      await this.handleContentRequest(event.payload, event.meta.correlationId);
    });

    // Listen for trend alerts to create timely content
    this.subscribeAll('scout.trend.detected', async (event) => {
      if (event.payload.score > 0.8) {
        // High-scoring trend - queue content creation
        await this.queueTrendContent(event.payload);
      }
    });
  }

  protected async onHeartbeat(): Promise<void> {
    // Process content queue
    await this.processContentQueue();

    // Check for stale drafts
    await this.reviewStaleDrafts();
  }

  // -------------------------------------------------------------------------
  // Content Request Handling
  // -------------------------------------------------------------------------

  private async handleContentRequest(
    request: ContentRequestPayload,
    correlationId?: string
  ): Promise<void> {
    const task: ContentTask = {
      id: request.requestId,
      type: request.contentType as ContentType,
      topic: request.topic,
      audience: request.targetAudience,
      exam: request.exam,
      difficulty: request.difficulty || 'medium',
      language: request.language,
      priority: request.priority,
      status: 'queued',
      createdAt: Date.now(),
      correlationId,
    };

    this.contentQueue.push(task);
    this.sortQueue();

    // Start processing if not busy
    if (this.processingContent.size < 3) {
      await this.processContentQueue();
    }
  }

  private async queueTrendContent(trend: { topic: string; score: number }): Promise<void> {
    const task: ContentTask = {
      id: `trend-${Date.now()}`,
      type: 'blog',
      topic: trend.topic,
      audience: 'students',
      difficulty: 'medium',
      language: 'en',
      priority: 'high',
      status: 'queued',
      createdAt: Date.now(),
    };

    this.contentQueue.unshift(task); // Add to front
  }

  private sortQueue(): void {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    this.contentQueue.sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 2;
      const pb = priorityOrder[b.priority] ?? 2;
      return pa - pb;
    });
  }

  private async processContentQueue(): Promise<void> {
    while (this.contentQueue.length > 0 && this.processingContent.size < 3) {
      const task = this.contentQueue.shift();
      if (!task) break;

      task.status = 'processing';
      this.processingContent.set(task.id, task);

      // Process asynchronously
      this.createContent(task).catch((error) => {
        console.error(`[Atlas] Content creation failed for ${task.id}:`, error);
        task.status = 'failed';
        task.error = error.message;
      }).finally(() => {
        this.processingContent.delete(task.id);
      });
    }
  }

  // -------------------------------------------------------------------------
  // Content Creation Pipeline
  // -------------------------------------------------------------------------

  private async createContent(task: ContentTask): Promise<ContentResult> {
    const context: AgentContext = {
      agentId: this.config.id,
      taskId: task.id,
      correlationId: task.correlationId,
    };

    // Step 1: Curate - Plan the content
    const plan = await this.invokeSubAgent<ContentPlan>(
      'Curator',
      {
        topic: task.topic,
        type: task.type,
        audience: task.audience,
        difficulty: task.difficulty,
      },
      context
    );

    // Step 2: Write - Create the content
    const draft = await this.invokeSubAgent<ContentDraft>(
      'Writer',
      {
        plan,
        language: task.language,
      },
      context
    );

    // Step 3: Add quiz if applicable
    let quiz: QuizContent | undefined;
    if (['lesson', 'practice'].includes(task.type)) {
      quiz = await this.invokeSubAgent<QuizContent>(
        'QuizMaster',
        {
          topic: task.topic,
          difficulty: task.difficulty,
          count: 5,
        },
        context
      );
    }

    // Step 4: SEO Optimization
    const seoData = await this.invokeSubAgent<SEOData>(
      'SEOOptimizer',
      {
        content: draft,
        topic: task.topic,
        type: task.type,
      },
      context
    );

    // Step 5: Fact Check
    const factCheck = await this.invokeSubAgent<FactCheckResult>(
      'FactChecker',
      {
        content: draft,
        topic: task.topic,
      },
      context
    );

    // Create final content
    const content: ContentResult = {
      id: `content-${Date.now()}`,
      requestId: task.id,
      type: task.type,
      title: draft.title,
      body: draft.body,
      sections: draft.sections,
      quiz,
      seo: seoData,
      factCheckScore: factCheck.score,
      status: factCheck.score > 0.8 ? 'review' : 'draft',
      createdAt: Date.now(),
    };

    // Emit content created event
    this.emit('atlas.content.created', {
      contentId: content.id,
      requestId: task.id,
      contentType: task.type,
      title: content.title,
      status: content.status,
      wordCount: this.countWords(content.body),
      mediaAssets: [],
      seoScore: seoData.score,
      readabilityScore: draft.readabilityScore,
      createdBy: `${this.config.id}.Writer`,
    });

    task.status = 'completed';
    task.result = content;

    return content;
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Curator
  // -------------------------------------------------------------------------

  private async curate(
    input: CuratorInput,
    context: AgentContext
  ): Promise<ContentPlan> {
    const { topic, type, audience, difficulty } = input;

    // Generate content outline
    const outline = await this.generateOutline(topic, type, difficulty);

    return {
      topic,
      type,
      audience,
      difficulty,
      outline,
      estimatedWordCount: this.estimateWordCount(type),
      sections: outline.map((item, i) => ({
        id: `section-${i}`,
        title: item,
        type: i === 0 ? 'introduction' : i === outline.length - 1 ? 'conclusion' : 'body',
        estimatedWords: Math.floor(this.estimateWordCount(type) / outline.length),
      })),
      keywords: await this.getKeywords(topic),
      references: [],
    };
  }

  private async generateOutline(
    topic: string,
    type: ContentType,
    difficulty: DifficultyLevel
  ): Promise<string[]> {
    // Would use LLM in production
    const baseOutline = [
      `Introduction to ${topic}`,
      'Key Concepts',
      'Understanding the Fundamentals',
      'Practical Applications',
      'Common Mistakes to Avoid',
      'Summary and Key Takeaways',
    ];

    if (type === 'quiz' || type === 'practice') {
      return [
        'Instructions',
        'Section A: Multiple Choice',
        'Section B: Short Answer',
        'Answer Key',
      ];
    }

    return baseOutline;
  }

  private estimateWordCount(type: ContentType): number {
    const estimates: Record<ContentType, number> = {
      lesson: 1500,
      quiz: 500,
      practice: 800,
      summary: 400,
      video: 300,
      infographic: 200,
      blog: 1200,
      social: 100,
    };
    return estimates[type] || 1000;
  }

  private async getKeywords(topic: string): Promise<string[]> {
    // Check cache for Scout's keyword research
    const cached = await this.cache.get<{ primary: string; secondary: string[] }>(
      `keywords:${topic}`
    );
    if (cached) {
      return [cached.primary, ...cached.secondary];
    }

    // Fallback to basic keywords
    return [topic, `${topic} explained`, `learn ${topic}`];
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Writer
  // -------------------------------------------------------------------------

  private async write(
    input: WriterInput,
    context: AgentContext
  ): Promise<ContentDraft> {
    const { plan, language } = input;

    // Generate content for each section
    const sections: ContentSection[] = [];
    let fullBody = '';

    for (const sectionPlan of plan.sections) {
      const sectionContent = await this.writeSection(sectionPlan, plan, language);
      sections.push(sectionContent);
      fullBody += sectionContent.content + '\n\n';
    }

    return {
      title: this.generateTitle(plan.topic, plan.type),
      body: fullBody.trim(),
      sections,
      wordCount: this.countWords(fullBody),
      readabilityScore: this.calculateReadability(fullBody),
      language,
    };
  }

  private async writeSection(
    sectionPlan: SectionPlan,
    plan: ContentPlan,
    language: string
  ): Promise<ContentSection> {
    // Would use LLM in production
    const content = this.generateSectionContent(sectionPlan, plan);

    return {
      id: sectionPlan.id,
      title: sectionPlan.title,
      type: sectionPlan.type,
      content,
      wordCount: this.countWords(content),
    };
  }

  private generateSectionContent(section: SectionPlan, plan: ContentPlan): string {
    // Placeholder content generation
    if (section.type === 'introduction') {
      return `Welcome to this comprehensive guide on ${plan.topic}. In this ${plan.type}, we'll explore the key concepts and help you understand the fundamentals.`;
    }
    if (section.type === 'conclusion') {
      return `In conclusion, ${plan.topic} is an essential concept that you'll encounter frequently. Remember the key points we discussed and practice regularly for mastery.`;
    }
    return `${section.title}\n\nThis section covers important aspects of ${plan.topic}. Understanding these concepts will help you build a strong foundation.`;
  }

  private generateTitle(topic: string, type: ContentType): string {
    const templates: Record<ContentType, string> = {
      lesson: `Complete Guide to ${topic}`,
      quiz: `${topic} Practice Quiz`,
      practice: `${topic} Practice Problems`,
      summary: `${topic} Quick Summary`,
      video: `Understanding ${topic}`,
      infographic: `${topic} Infographic`,
      blog: `Everything You Need to Know About ${topic}`,
      social: topic,
    };
    return templates[type] || topic;
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: QuizMaster
  // -------------------------------------------------------------------------

  private async createQuiz(
    input: QuizMasterInput,
    context: AgentContext
  ): Promise<QuizContent> {
    const { topic, difficulty, count } = input;

    const questions: Question[] = [];

    for (let i = 0; i < count; i++) {
      questions.push(await this.generateQuestion(topic, difficulty, i));
    }

    return {
      topic,
      difficulty,
      questions,
      totalMarks: questions.reduce((sum, q) => sum + q.marks, 0),
      timeLimit: count * 2, // 2 minutes per question
    };
  }

  private async generateQuestion(
    topic: string,
    difficulty: DifficultyLevel,
    index: number
  ): Promise<Question> {
    // Would use LLM in production
    return {
      id: `q-${index}`,
      type: 'mcq',
      question: `Question ${index + 1} about ${topic}?`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 0,
      explanation: `The correct answer is A because...`,
      difficulty,
      marks: difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3,
    };
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: SEO Optimizer
  // -------------------------------------------------------------------------

  private async optimizeSEO(
    input: SEOOptimizerInput,
    context: AgentContext
  ): Promise<SEOData> {
    const { content, topic, type } = input;

    return {
      metaTitle: `${content.title} | EduGenius`,
      metaDescription: `Learn ${topic} with our comprehensive ${type}. Clear explanations and practical examples.`,
      keywords: [topic, `${topic} guide`, `learn ${topic}`, `${topic} tutorial`],
      headings: this.extractHeadings(content.body),
      score: 0.85,
      suggestions: [
        'Add more internal links',
        'Include an image with alt text',
        'Add structured data markup',
      ],
    };
  }

  private extractHeadings(body: string): string[] {
    const headingRegex = /^#+\s+(.+)$/gm;
    const headings: string[] = [];
    let match;
    while ((match = headingRegex.exec(body)) !== null) {
      headings.push(match[1]);
    }
    return headings;
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Translator
  // -------------------------------------------------------------------------

  private async translate(
    input: TranslatorInput,
    context: AgentContext
  ): Promise<TranslatedContent> {
    const { content, targetLanguage } = input;

    // Would use translation API/LLM in production
    return {
      originalLanguage: content.language,
      targetLanguage,
      title: `[${targetLanguage}] ${content.title}`,
      body: content.body, // Would be translated
      translatedAt: Date.now(),
    };
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Visual Designer
  // -------------------------------------------------------------------------

  private async createVisual(
    input: VisualizerInput,
    context: AgentContext
  ): Promise<VisualSpec> {
    const { topic, type, content } = input;

    return {
      type: type || 'diagram',
      title: `${topic} Visualization`,
      description: `Visual representation of ${topic}`,
      elements: [
        { type: 'header', text: topic },
        { type: 'box', text: 'Key Concept 1' },
        { type: 'arrow', from: 0, to: 1 },
        { type: 'box', text: 'Key Concept 2' },
      ],
      style: {
        theme: 'educational',
        colors: ['#4A90D9', '#50C878', '#FFD700'],
      },
      suggestedTool: 'mermaid',
    };
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Fact Checker
  // -------------------------------------------------------------------------

  private async checkFacts(
    input: FactCheckerInput,
    context: AgentContext
  ): Promise<FactCheckResult> {
    const { content, topic } = input;

    // Would verify against reliable sources in production
    return {
      score: 0.92,
      verified: true,
      claims: [
        { claim: 'Main concept is accurate', verified: true, confidence: 0.95 },
        { claim: 'Examples are relevant', verified: true, confidence: 0.88 },
      ],
      suggestions: [],
      checkedAt: Date.now(),
    };
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  private countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
  }

  private calculateReadability(text: string): number {
    // Simplified readability score (would use proper algorithm in production)
    const words = this.countWords(text);
    const sentences = text.split(/[.!?]+/).length;
    const avgWordsPerSentence = words / sentences;
    
    // Lower avg words = more readable
    return Math.max(0, Math.min(1, 1 - (avgWordsPerSentence - 10) / 30));
  }

  private async reviewStaleDrafts(): Promise<void> {
    // Would check for drafts older than X hours and send reminders
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async requestContent(params: {
    type: ContentType;
    topic: string;
    audience: string;
    difficulty?: DifficultyLevel;
    language?: string;
  }): Promise<string> {
    const requestId = `req-${Date.now()}`;

    await this.handleContentRequest({
      requestId,
      contentType: params.type,
      topic: params.topic,
      targetAudience: params.audience,
      difficulty: params.difficulty,
      language: params.language || 'en',
      priority: 'normal',
    });

    return requestId;
  }

  getQueueStatus(): { queued: number; processing: number } {
    return {
      queued: this.contentQueue.length,
      processing: this.processingContent.size,
    };
  }
}

// ============================================================================
// Types
// ============================================================================

interface ContentTask {
  id: string;
  type: ContentType;
  topic: string;
  audience: string;
  exam?: string;
  difficulty: DifficultyLevel;
  language: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  correlationId?: string;
  result?: ContentResult;
  error?: string;
}

interface ContentPlan {
  topic: string;
  type: ContentType;
  audience: string;
  difficulty: DifficultyLevel;
  outline: string[];
  estimatedWordCount: number;
  sections: SectionPlan[];
  keywords: string[];
  references: string[];
}

interface SectionPlan {
  id: string;
  title: string;
  type: 'introduction' | 'body' | 'conclusion';
  estimatedWords: number;
}

interface ContentDraft {
  title: string;
  body: string;
  sections: ContentSection[];
  wordCount: number;
  readabilityScore: number;
  language: string;
}

interface ContentSection {
  id: string;
  title: string;
  type: string;
  content: string;
  wordCount: number;
}

interface ContentResult {
  id: string;
  requestId: string;
  type: ContentType;
  title: string;
  body: string;
  sections: ContentSection[];
  quiz?: QuizContent;
  seo: SEOData;
  factCheckScore: number;
  status: ContentStatus;
  createdAt: number;
}

interface QuizContent {
  topic: string;
  difficulty: DifficultyLevel;
  questions: Question[];
  totalMarks: number;
  timeLimit: number;
}

interface Question {
  id: string;
  type: 'mcq' | 'fill' | 'short' | 'numerical';
  question: string;
  options?: string[];
  correctAnswer: number | string;
  explanation: string;
  difficulty: DifficultyLevel;
  marks: number;
}

interface SEOData {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  headings: string[];
  score: number;
  suggestions: string[];
}

interface VisualSpec {
  type: 'diagram' | 'infographic' | 'chart' | 'flowchart';
  title: string;
  description: string;
  elements: unknown[];
  style: {
    theme: string;
    colors: string[];
  };
  suggestedTool: string;
}

interface FactCheckResult {
  score: number;
  verified: boolean;
  claims: Array<{
    claim: string;
    verified: boolean;
    confidence: number;
  }>;
  suggestions: string[];
  checkedAt: number;
}

interface TranslatedContent {
  originalLanguage: string;
  targetLanguage: string;
  title: string;
  body: string;
  translatedAt: number;
}

// Input types
interface CuratorInput {
  topic: string;
  type: ContentType;
  audience: string;
  difficulty: DifficultyLevel;
}

interface WriterInput {
  plan: ContentPlan;
  language: string;
}

interface QuizMasterInput {
  topic: string;
  difficulty: DifficultyLevel;
  count: number;
}

interface SEOOptimizerInput {
  content: ContentDraft;
  topic: string;
  type: ContentType;
}

interface TranslatorInput {
  content: ContentDraft;
  targetLanguage: string;
}

interface VisualizerInput {
  topic: string;
  type?: 'diagram' | 'infographic' | 'chart' | 'flowchart';
  content?: ContentDraft;
}

interface FactCheckerInput {
  content: ContentDraft;
  topic: string;
}

// ============================================================================
// Export
// ============================================================================

export { ATLAS_CONFIG };
