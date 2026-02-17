/**
 * Atlas Content Integration
 * Integrates Atlas agent with the content delivery pipeline
 */

import { randomUUID } from 'crypto';
import {
  BlogPipeline,
  VlogPipeline,
  ContentCalendarManager,
  blogPipeline,
  vlogPipeline,
  contentCalendarManager,
} from '../../content';
import { PromptRepository, promptRepository } from '../../prompts';
import { examConfigManager } from '../../config';
import { deploymentManager } from '../../deployment';
import {
  BlogPost,
  VlogContent,
  ContentCalendarEntry,
  BlogPlatform,
  VlogPlatform,
} from '../../content/types';
import { PromptExecutionResult } from '../../prompts/types';

// ============================================================================
// Content Creation Types
// ============================================================================

export interface ContentCreationRequest {
  examCode: string;
  topic: string;
  contentType: 'blog' | 'vlog' | 'both';
  subject?: string;
  chapter?: string;
  language?: string;
  urgency?: 'low' | 'normal' | 'high';
}

export interface ContentCreationResult {
  blog?: {
    id: string;
    title: string;
    status: string;
    platforms: string[];
  };
  vlog?: {
    id: string;
    title: string;
    status: string;
    platforms: string[];
  };
  calendarEntry?: string;
}

// ============================================================================
// Atlas Content Integration
// ============================================================================

export class AtlasContentIntegration {
  private prompts: PromptRepository;
  private blogs: BlogPipeline;
  private vlogs: VlogPipeline;
  private calendar: ContentCalendarManager;

  constructor() {
    this.prompts = promptRepository;
    this.blogs = blogPipeline;
    this.vlogs = vlogPipeline;
    this.calendar = contentCalendarManager;
  }

  // -------------------------------------------------------------------------
  // Content Creation
  // -------------------------------------------------------------------------

  async createContent(request: ContentCreationRequest): Promise<ContentCreationResult> {
    const result: ContentCreationResult = {};

    // Get exam config for modifiers
    const examConfig = await examConfigManager.getConfigByCode(request.examCode);
    const modifiers = examConfig
      ? await examConfigManager.getPromptModifiers(examConfig.id)
      : [];

    // Check deployment mode
    const deployment = await deploymentManager.getDeployment(request.examCode);
    const isPilot = deployment?.mode === 'pilot';

    // Add language modifier if specified
    if (request.language && request.language !== 'en') {
      modifiers.push(`lang:${request.language}`);
    }

    // Create blog if requested
    if (request.contentType === 'blog' || request.contentType === 'both') {
      result.blog = await this.createBlogPost(request, modifiers, isPilot);
    }

    // Create vlog if requested
    if (request.contentType === 'vlog' || request.contentType === 'both') {
      result.vlog = await this.createVlogContent(request, modifiers, isPilot);
    }

    // Add to calendar
    if (result.blog || result.vlog) {
      const entry = await this.calendar.scheduleContent({
        title: request.topic,
        type: request.contentType === 'both' ? 'blog' : request.contentType,
        exam: request.examCode,
        subject: request.subject,
        scheduledDate: this.getScheduledDate(request.urgency || 'normal'),
        priority: request.urgency === 'high' ? 'high' : 'normal',
        status: 'scheduled',
        contentId: result.blog?.id || result.vlog?.id,
      });
      result.calendarEntry = entry.id;
    }

    return result;
  }

  private async createBlogPost(
    request: ContentCreationRequest,
    modifiers: string[],
    isPilot: boolean
  ): Promise<ContentCreationResult['blog']> {
    // Get blog writing prompt with modifiers
    const promptResult = await this.prompts.execute('blog-post', {
      topic: request.topic,
      exam: request.examCode,
      subject: request.subject || 'general',
    }, modifiers);

    // Create blog post
    const blog = await this.blogs.createPost({
      title: this.generateTitle(request.topic, request.examCode),
      content: promptResult.output,
      excerpt: this.generateExcerpt(promptResult.output),
      category: this.mapToCategory(request.subject || 'general'),
      tags: this.generateTags(request),
      exam: request.examCode,
      subject: request.subject,
      seo: {
        metaTitle: `${request.topic} - ${request.examCode} Preparation`,
        metaDescription: this.generateMetaDescription(request.topic, request.examCode),
        focusKeyword: request.topic.toLowerCase(),
        keywords: this.generateKeywords(request),
      },
    });

    // Determine platforms based on deployment mode
    const platforms: BlogPlatform[] = isPilot
      ? ['self-hosted']
      : ['self-hosted', 'medium'];

    // Schedule publishing
    for (const platform of platforms) {
      await this.blogs.schedulePublish(blog.id, platform, {
        publishAt: this.getScheduledDate(request.urgency || 'normal'),
      });
    }

    return {
      id: blog.id,
      title: blog.title,
      status: blog.status,
      platforms: platforms,
    };
  }

  private async createVlogContent(
    request: ContentCreationRequest,
    modifiers: string[],
    isPilot: boolean
  ): Promise<ContentCreationResult['vlog']> {
    // Get vlog script prompt with modifiers
    const promptResult = await this.prompts.execute('vlog-script', {
      topic: request.topic,
      exam: request.examCode,
      subject: request.subject || 'general',
      duration: '5-7 minutes',
    }, modifiers);

    // Create vlog content
    const vlog = await this.vlogs.createVlog({
      title: this.generateVideoTitle(request.topic, request.examCode),
      description: this.generateVideoDescription(request.topic, request.examCode),
      script: {
        sections: this.parseScript(promptResult.output),
        totalDuration: 360, // 6 minutes average
      },
      tags: this.generateVideoTags(request),
      exam: request.examCode,
      subject: request.subject,
    });

    // Determine platforms based on deployment mode
    const platforms: VlogPlatform[] = isPilot
      ? ['youtube']
      : ['youtube', 'instagram-reels'];

    // Schedule publishing
    for (const platform of platforms) {
      await this.vlogs.schedulePublish(vlog.id, platform, {
        publishAt: this.getScheduledDate(request.urgency || 'normal'),
      });
    }

    return {
      id: vlog.id,
      title: vlog.title,
      status: vlog.status,
      platforms: platforms,
    };
  }

  // -------------------------------------------------------------------------
  // Batch Content Creation
  // -------------------------------------------------------------------------

  async createBatchContent(
    examCode: string,
    topics: string[],
    contentType: 'blog' | 'vlog' | 'both'
  ): Promise<ContentCreationResult[]> {
    const results: ContentCreationResult[] = [];

    for (const topic of topics) {
      const result = await this.createContent({
        examCode,
        topic,
        contentType,
      });
      results.push(result);
    }

    return results;
  }

  async createDailyContent(examCode: string): Promise<ContentCreationResult[]> {
    // Get exam config for cadence
    const examConfig = await examConfigManager.getConfigByCode(examCode);
    if (!examConfig) return [];

    const cadence = examConfig.contentCadence;
    const results: ContentCreationResult[] = [];

    // Determine what to create today based on cadence
    const dayOfWeek = new Date().getDay();
    
    // Blogs: distribute across week
    const blogsToday = Math.ceil(cadence.blogsPerWeek / 5); // weekdays only
    
    // Videos: usually 1-2 days per week
    const videosToday = dayOfWeek === 1 || dayOfWeek === 4 ? 1 : 0;

    // Get topics from content calendar or generate
    const blogTopics = await this.getTopicsForToday(examCode, 'blog', blogsToday);
    const videoTopics = await this.getTopicsForToday(examCode, 'vlog', videosToday);

    // Create blog content
    for (const topic of blogTopics) {
      const result = await this.createContent({
        examCode,
        topic,
        contentType: 'blog',
      });
      results.push(result);
    }

    // Create video content
    for (const topic of videoTopics) {
      const result = await this.createContent({
        examCode,
        topic,
        contentType: 'vlog',
      });
      results.push(result);
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Content Analytics Integration
  // -------------------------------------------------------------------------

  async getContentPerformance(examCode: string): Promise<{
    blogs: { total: number; published: number; avgViews: number };
    vlogs: { total: number; published: number; avgViews: number };
    topPerforming: Array<{ id: string; title: string; views: number; type: string }>;
  }> {
    const blogStats = await this.blogs.getStats(examCode);
    const vlogStats = await this.vlogs.getStats(examCode);

    return {
      blogs: blogStats,
      vlogs: vlogStats,
      topPerforming: [
        ...blogStats.topPosts.map(p => ({ ...p, type: 'blog' })),
        ...vlogStats.topVideos.map(v => ({ ...v, type: 'vlog' })),
      ].sort((a, b) => b.views - a.views).slice(0, 10),
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private generateTitle(topic: string, examCode: string): string {
    return `${topic} | ${examCode} Preparation Guide`;
  }

  private generateVideoTitle(topic: string, examCode: string): string {
    return `${topic} - Complete Explanation | ${examCode}`;
  }

  private generateExcerpt(content: string): string {
    const firstParagraph = content.split('\n\n')[0] || content;
    return firstParagraph.slice(0, 200) + '...';
  }

  private generateMetaDescription(topic: string, examCode: string): string {
    return `Master ${topic} for ${examCode}. Detailed explanations, examples, and practice questions to help you succeed.`;
  }

  private generateVideoDescription(topic: string, examCode: string): string {
    return `In this video, we explain ${topic} in detail for ${examCode} preparation. Watch till the end for tips and tricks!\n\n📚 Topics covered:\n- Key concepts\n- Important formulas\n- Solved examples\n- Practice tips`;
  }

  private generateTags(request: ContentCreationRequest): string[] {
    return [
      request.examCode.toLowerCase(),
      request.topic.toLowerCase().replace(/\s+/g, '-'),
      request.subject?.toLowerCase() || 'general',
      'education',
      'exam-prep',
    ];
  }

  private generateVideoTags(request: ContentCreationRequest): string[] {
    return [
      request.examCode,
      request.topic,
      request.subject || 'general',
      'education',
      'exam preparation',
      'study tips',
    ];
  }

  private generateKeywords(request: ContentCreationRequest): string[] {
    return [
      request.topic,
      `${request.topic} ${request.examCode}`,
      `${request.examCode} preparation`,
      request.subject || '',
    ].filter(Boolean);
  }

  private mapToCategory(subject: string): string {
    const categoryMap: Record<string, string> = {
      physics: 'physics',
      chemistry: 'chemistry',
      mathematics: 'mathematics',
      biology: 'biology',
      general: 'exam-tips',
    };
    return categoryMap[subject.toLowerCase()] || 'exam-tips';
  }

  private parseScript(scriptText: string): Array<{ title: string; content: string; duration: number }> {
    // Simple section parsing - would be more sophisticated in production
    const sections = scriptText.split(/#{2,3}\s+/).filter(Boolean);
    return sections.map((section, i) => {
      const lines = section.split('\n');
      return {
        title: lines[0] || `Section ${i + 1}`,
        content: lines.slice(1).join('\n'),
        duration: 60, // 1 minute per section
      };
    });
  }

  private getScheduledDate(urgency: 'low' | 'normal' | 'high'): number {
    const now = Date.now();
    switch (urgency) {
      case 'high':
        return now + (2 * 60 * 60 * 1000); // 2 hours
      case 'normal':
        return now + (24 * 60 * 60 * 1000); // 1 day
      case 'low':
        return now + (3 * 24 * 60 * 60 * 1000); // 3 days
    }
  }

  private async getTopicsForToday(
    examCode: string,
    type: 'blog' | 'vlog',
    count: number
  ): Promise<string[]> {
    // Get from calendar or generate topics
    const scheduled = await this.calendar.getEntriesForDate(
      new Date(),
      examCode
    );

    const topics = scheduled
      .filter(e => e.type === type && e.status === 'scheduled')
      .map(e => e.title)
      .slice(0, count);

    // If not enough scheduled, generate topics
    while (topics.length < count) {
      topics.push(`Topic ${topics.length + 1} for ${examCode}`);
    }

    return topics;
  }
}

// ============================================================================
// Export
// ============================================================================

export const atlasContentIntegration = new AtlasContentIntegration();
