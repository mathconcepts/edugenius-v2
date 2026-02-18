// @ts-nocheck
/**
 * Landing Page Manager
 * Template-based landing page generation with A/B testing
 */

import { randomUUID } from 'crypto';
import {
  LandingPage,
  LandingPageTemplate,
  LandingPageStatus,
  LandingSection,
  SectionType,
  SectionContent,
  LandingPageVariant,
  LandingPageMetrics,
  LayoutTemplate,
  LayoutStructure,
  LayoutStyles,
} from './types';

// ============================================================================
// Landing Page Templates
// ============================================================================

const DEFAULT_TEMPLATES: Record<LandingPageTemplate, LandingSection[]> = {
  'hero-features-cta': [
    {
      id: 'hero',
      type: 'hero',
      order: 0,
      content: {
        headline: '{{headline}}',
        subheadline: '{{subheadline}}',
        ctaText: 'Start Free Trial',
        ctaUrl: '/signup',
      },
      visible: true,
    },
    {
      id: 'features',
      type: 'features',
      order: 1,
      content: {
        title: 'Why Students Love Us',
        items: [],
      },
      visible: true,
    },
    {
      id: 'testimonials',
      type: 'testimonials',
      order: 2,
      content: {
        title: 'Success Stories',
        testimonials: [],
      },
      visible: true,
    },
    {
      id: 'cta',
      type: 'cta',
      order: 3,
      content: {
        headline: 'Ready to Start?',
        subheadline: 'Join thousands of successful students',
        ctaText: 'Get Started Free',
        ctaUrl: '/signup',
      },
      visible: true,
    },
  ],

  'comparison': [
    {
      id: 'hero',
      type: 'hero',
      order: 0,
      content: {
        headline: 'EduGenius vs {{competitor}}',
        subheadline: 'See why students choose us',
      },
      visible: true,
    },
    {
      id: 'comparison',
      type: 'comparison',
      order: 1,
      content: {
        title: 'Feature Comparison',
        comparisonTable: {
          competitors: ['EduGenius', '{{competitor}}'],
          features: [],
        },
      },
      visible: true,
    },
    {
      id: 'testimonials',
      type: 'testimonials',
      order: 2,
      content: {
        title: 'Students Who Switched',
        testimonials: [],
      },
      visible: true,
    },
    {
      id: 'cta',
      type: 'cta',
      order: 3,
      content: {
        headline: 'Ready to Switch?',
        ctaText: 'Try Free for 7 Days',
        ctaUrl: '/signup',
      },
      visible: true,
    },
  ],

  'free-tool': [
    {
      id: 'hero',
      type: 'hero',
      order: 0,
      content: {
        headline: 'Free {{toolName}}',
        subheadline: '{{toolDescription}}',
      },
      visible: true,
    },
    {
      id: 'form',
      type: 'form',
      order: 1,
      content: {
        title: 'Try it Now',
        formFields: [
          { name: 'input', type: 'text', label: 'Enter your data', required: true },
        ],
        submitText: 'Calculate',
      },
      visible: true,
    },
    {
      id: 'benefits',
      type: 'benefits',
      order: 2,
      content: {
        title: 'Why Use This Tool?',
        items: [],
      },
      visible: true,
    },
    {
      id: 'cta',
      type: 'cta',
      order: 3,
      content: {
        headline: 'Want More Tools Like This?',
        ctaText: 'Sign Up Free',
        ctaUrl: '/signup',
      },
      visible: true,
    },
  ],

  'waitlist': [
    {
      id: 'hero',
      type: 'hero',
      order: 0,
      content: {
        headline: 'Coming Soon: {{productName}}',
        subheadline: 'Be the first to know when we launch',
      },
      visible: true,
    },
    {
      id: 'countdown',
      type: 'countdown',
      order: 1,
      content: {
        countdownLabel: 'Launching In',
      },
      visible: true,
    },
    {
      id: 'form',
      type: 'form',
      order: 2,
      content: {
        title: 'Join the Waitlist',
        formFields: [
          { name: 'email', type: 'email', label: 'Email Address', required: true },
          { name: 'exam', type: 'select', label: 'Your Exam', required: false, options: [] },
        ],
        submitText: 'Join Waitlist',
      },
      visible: true,
    },
    {
      id: 'social-proof',
      type: 'social-proof',
      order: 3,
      content: {
        stats: [
          { value: '{{waitlistCount}}+', label: 'Students Waiting' },
        ],
      },
      visible: true,
    },
  ],

  'exam-specific': [
    {
      id: 'hero',
      type: 'hero',
      order: 0,
      content: {
        headline: 'Ace {{examName}} with AI',
        subheadline: 'Personalized prep powered by AI tutoring',
      },
      visible: true,
    },
    {
      id: 'stats',
      type: 'stats',
      order: 1,
      content: {
        stats: [
          { value: '95%', label: 'Pass Rate' },
          { value: '10K+', label: 'Students' },
          { value: '4.8★', label: 'Rating' },
        ],
      },
      visible: true,
    },
    {
      id: 'features',
      type: 'features',
      order: 2,
      content: {
        title: 'Everything You Need for {{examName}}',
        items: [],
      },
      visible: true,
    },
    {
      id: 'pricing',
      type: 'pricing',
      order: 3,
      content: {
        title: 'Choose Your Plan',
        plans: [],
      },
      visible: true,
    },
    {
      id: 'faq',
      type: 'faq',
      order: 4,
      content: {
        title: '{{examName}} Prep FAQs',
        faqs: [],
      },
      visible: true,
    },
    {
      id: 'cta',
      type: 'cta',
      order: 5,
      content: {
        headline: 'Start Your {{examName}} Journey',
        ctaText: 'Try Free for 7 Days',
        ctaUrl: '/signup?exam={{examCode}}',
      },
      visible: true,
    },
  ],

  'course-promo': [
    {
      id: 'hero',
      type: 'hero',
      order: 0,
      content: {
        headline: '{{courseName}}',
        subheadline: '{{courseDescription}}',
      },
      visible: true,
    },
    {
      id: 'video',
      type: 'video',
      order: 1,
      content: {
        title: 'Course Preview',
      },
      visible: true,
    },
    {
      id: 'features',
      type: 'features',
      order: 2,
      content: {
        title: 'What You\'ll Learn',
        items: [],
      },
      visible: true,
    },
    {
      id: 'testimonials',
      type: 'testimonials',
      order: 3,
      content: {
        title: 'Student Reviews',
        testimonials: [],
      },
      visible: true,
    },
    {
      id: 'pricing',
      type: 'pricing',
      order: 4,
      content: {
        title: 'Enroll Now',
        plans: [],
      },
      visible: true,
    },
  ],

  'testimonials': [
    {
      id: 'hero',
      type: 'hero',
      order: 0,
      content: {
        headline: 'Student Success Stories',
        subheadline: 'Real results from real students',
      },
      visible: true,
    },
    {
      id: 'stats',
      type: 'stats',
      order: 1,
      content: {
        stats: [
          { value: '50K+', label: 'Happy Students' },
          { value: '95%', label: 'Success Rate' },
          { value: '4.9★', label: 'Average Rating' },
        ],
      },
      visible: true,
    },
    {
      id: 'testimonials',
      type: 'testimonials',
      order: 2,
      content: {
        testimonials: [],
      },
      visible: true,
    },
    {
      id: 'cta',
      type: 'cta',
      order: 3,
      content: {
        headline: 'Join Our Success Stories',
        ctaText: 'Start Learning Today',
        ctaUrl: '/signup',
      },
      visible: true,
    },
  ],

  'pricing': [
    {
      id: 'hero',
      type: 'hero',
      order: 0,
      content: {
        headline: 'Simple, Transparent Pricing',
        subheadline: 'Choose the plan that fits your goals',
      },
      visible: true,
    },
    {
      id: 'pricing',
      type: 'pricing',
      order: 1,
      content: {
        plans: [],
      },
      visible: true,
    },
    {
      id: 'comparison',
      type: 'comparison',
      order: 2,
      content: {
        title: 'Compare Plans',
        comparisonTable: {
          competitors: [],
          features: [],
        },
      },
      visible: true,
    },
    {
      id: 'faq',
      type: 'faq',
      order: 3,
      content: {
        title: 'Pricing FAQs',
        faqs: [],
      },
      visible: true,
    },
  ],
};

// ============================================================================
// Landing Page Manager
// ============================================================================

export class LandingPageManager {
  private pages: Map<string, LandingPage> = new Map();
  private layouts: Map<string, LayoutTemplate> = new Map();

  constructor() {
    this.initializeDefaultLayouts();
  }

  // -------------------------------------------------------------------------
  // Page Creation
  // -------------------------------------------------------------------------

  async createPage(params: {
    name: string;
    template: LandingPageTemplate;
    examTypes: string[];
    campaign?: string;
    variables?: Record<string, string>;
    deploymentMode?: 'pilot' | 'full';
  }): Promise<LandingPage> {
    const {
      name,
      template,
      examTypes,
      campaign,
      variables = {},
      deploymentMode = 'pilot',
    } = params;

    // Get template sections
    const templateSections = DEFAULT_TEMPLATES[template];
    if (!templateSections) {
      throw new Error(`Unknown template: ${template}`);
    }

    // Apply variables to sections
    const sections = this.applyVariables(templateSections, variables);

    const page: LandingPage = {
      id: randomUUID(),
      name,
      slug: this.generateSlug(name),
      template,
      sections,
      examTypes,
      campaign,
      seo: {
        title: name,
        description: '',
        keywords: examTypes,
      },
      status: 'draft',
      deploymentMode,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.pages.set(page.id, page);
    return page;
  }

  private applyVariables(
    sections: LandingSection[],
    variables: Record<string, string>
  ): LandingSection[] {
    return sections.map(section => ({
      ...section,
      id: randomUUID(),
      content: this.substituteVariablesInContent(section.content, variables),
    }));
  }

  private substituteVariablesInContent(
    content: SectionContent,
    variables: Record<string, string>
  ): SectionContent {
    const substitute = (text: string | undefined): string | undefined => {
      if (!text) return text;
      let result = text;
      for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
      return result;
    };

    return {
      ...content,
      headline: substitute(content.headline),
      subheadline: substitute(content.subheadline),
      title: substitute(content.title),
      description: substitute(content.description),
      ctaText: substitute(content.ctaText),
      ctaUrl: substitute(content.ctaUrl),
    };
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // -------------------------------------------------------------------------
  // Page Management
  // -------------------------------------------------------------------------

  async getPage(id: string): Promise<LandingPage | undefined> {
    return this.pages.get(id);
  }

  async getPageBySlug(slug: string): Promise<LandingPage | undefined> {
    for (const page of this.pages.values()) {
      if (page.slug === slug) return page;
    }
    return undefined;
  }

  async updatePage(id: string, updates: Partial<LandingPage>): Promise<LandingPage | undefined> {
    const page = this.pages.get(id);
    if (!page) return undefined;

    const updated: LandingPage = {
      ...page,
      ...updates,
      id: page.id,
      version: page.version + 1,
      updatedAt: Date.now(),
    };

    this.pages.set(id, updated);
    return updated;
  }

  async listPages(filter?: {
    status?: LandingPageStatus;
    template?: LandingPageTemplate;
    exam?: string;
    deploymentMode?: 'pilot' | 'full';
  }): Promise<LandingPage[]> {
    let pages = Array.from(this.pages.values());

    if (filter) {
      if (filter.status) {
        pages = pages.filter(p => p.status === filter.status);
      }
      if (filter.template) {
        pages = pages.filter(p => p.template === filter.template);
      }
      if (filter.exam) {
        pages = pages.filter(p => p.examTypes.includes(filter.exam!));
      }
      if (filter.deploymentMode) {
        pages = pages.filter(p => p.deploymentMode === filter.deploymentMode);
      }
    }

    return pages;
  }

  // -------------------------------------------------------------------------
  // Section Management
  // -------------------------------------------------------------------------

  async addSection(
    pageId: string,
    section: Omit<LandingSection, 'id'>
  ): Promise<LandingSection | undefined> {
    const page = this.pages.get(pageId);
    if (!page) return undefined;

    const newSection: LandingSection = {
      ...section,
      id: randomUUID(),
    };

    page.sections.push(newSection);
    page.sections.sort((a, b) => a.order - b.order);
    page.updatedAt = Date.now();

    this.pages.set(pageId, page);
    return newSection;
  }

  async updateSection(
    pageId: string,
    sectionId: string,
    updates: Partial<LandingSection>
  ): Promise<LandingSection | undefined> {
    const page = this.pages.get(pageId);
    if (!page) return undefined;

    const sectionIndex = page.sections.findIndex(s => s.id === sectionId);
    if (sectionIndex === -1) return undefined;

    const updated: LandingSection = {
      ...page.sections[sectionIndex],
      ...updates,
      id: sectionId,
    };

    page.sections[sectionIndex] = updated;
    page.updatedAt = Date.now();

    this.pages.set(pageId, page);
    return updated;
  }

  async removeSection(pageId: string, sectionId: string): Promise<boolean> {
    const page = this.pages.get(pageId);
    if (!page) return false;

    const initialLength = page.sections.length;
    page.sections = page.sections.filter(s => s.id !== sectionId);

    if (page.sections.length !== initialLength) {
      page.updatedAt = Date.now();
      this.pages.set(pageId, page);
      return true;
    }

    return false;
  }

  async reorderSections(pageId: string, sectionIds: string[]): Promise<boolean> {
    const page = this.pages.get(pageId);
    if (!page) return false;

    const sectionMap = new Map(page.sections.map(s => [s.id, s]));
    const reordered: LandingSection[] = [];

    for (let i = 0; i < sectionIds.length; i++) {
      const section = sectionMap.get(sectionIds[i]);
      if (section) {
        section.order = i;
        reordered.push(section);
      }
    }

    page.sections = reordered;
    page.updatedAt = Date.now();
    this.pages.set(pageId, page);

    return true;
  }

  // -------------------------------------------------------------------------
  // A/B Testing
  // -------------------------------------------------------------------------

  async createVariant(
    pageId: string,
    name: string,
    changes: Record<string, unknown>
  ): Promise<LandingPageVariant | undefined> {
    const page = this.pages.get(pageId);
    if (!page) return undefined;

    const variant: LandingPageVariant = {
      id: randomUUID(),
      name,
      changes,
      weight: 0.5,
    };

    if (!page.variants) {
      page.variants = [];
    }

    page.variants.push(variant);
    page.updatedAt = Date.now();
    this.pages.set(pageId, page);

    return variant;
  }

  async setActiveVariant(pageId: string, variantId: string): Promise<boolean> {
    const page = this.pages.get(pageId);
    if (!page) return false;

    page.activeVariant = variantId;
    page.updatedAt = Date.now();
    this.pages.set(pageId, page);

    return true;
  }

  async updateVariantMetrics(
    pageId: string,
    variantId: string,
    metrics: Partial<LandingPageMetrics>
  ): Promise<void> {
    const page = this.pages.get(pageId);
    if (!page || !page.variants) return;

    const variant = page.variants.find(v => v.id === variantId);
    if (variant) {
      variant.metrics = {
        ...variant.metrics,
        ...metrics,
      } as LandingPageMetrics;
      this.pages.set(pageId, page);
    }
  }

  // -------------------------------------------------------------------------
  // Publishing
  // -------------------------------------------------------------------------

  async publishPage(id: string): Promise<{ success: boolean; url?: string }> {
    const page = this.pages.get(id);
    if (!page) {
      return { success: false };
    }

    page.status = 'active';
    page.updatedAt = Date.now();
    this.pages.set(id, page);

    return {
      success: true,
      url: `https://edugenius.ai/${page.slug}`,
    };
  }

  async unpublishPage(id: string): Promise<boolean> {
    const page = this.pages.get(id);
    if (!page) return false;

    page.status = 'paused';
    page.updatedAt = Date.now();
    this.pages.set(id, page);

    return true;
  }

  // -------------------------------------------------------------------------
  // Layouts
  // -------------------------------------------------------------------------

  private initializeDefaultLayouts(): void {
    const defaultLayout: LayoutTemplate = {
      id: 'default',
      name: 'Default Layout',
      type: 'landing',
      structure: {
        header: {
          id: 'header',
          name: 'Header',
          allowedComponents: ['logo', 'nav', 'cta-button'],
          defaultComponent: 'logo',
        },
        main: [
          {
            id: 'main-content',
            name: 'Main Content',
            allowedComponents: ['hero', 'features', 'testimonials', 'pricing', 'faq', 'cta'],
            minComponents: 1,
            maxComponents: 10,
          },
        ],
        footer: {
          id: 'footer',
          name: 'Footer',
          allowedComponents: ['links', 'social', 'copyright'],
          defaultComponent: 'links',
        },
      },
      styles: {
        primaryColor: '#4A90D9',
        secondaryColor: '#50C878',
        fontFamily: 'Inter, sans-serif',
        headingFont: 'Inter, sans-serif',
        spacing: 'normal',
        borderRadius: '8px',
        shadows: true,
      },
      customizable: [
        { id: 'primary', name: 'Primary Color', type: 'color', path: 'styles.primaryColor', defaultValue: '#4A90D9' },
        { id: 'secondary', name: 'Secondary Color', type: 'color', path: 'styles.secondaryColor', defaultValue: '#50C878' },
      ],
    };

    this.layouts.set(defaultLayout.id, defaultLayout);
  }

  async getLayout(id: string): Promise<LayoutTemplate | undefined> {
    return this.layouts.get(id);
  }

  async listLayouts(): Promise<LayoutTemplate[]> {
    return Array.from(this.layouts.values());
  }

  // -------------------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------------------

  async updatePageMetrics(id: string, metrics: Partial<LandingPageMetrics>): Promise<void> {
    const page = this.pages.get(id);
    if (!page) return;

    page.metrics = {
      ...page.metrics,
      ...metrics,
    } as LandingPageMetrics;

    this.pages.set(id, page);
  }

  async getTopPerformingPages(limit = 10): Promise<LandingPage[]> {
    const pages = Array.from(this.pages.values())
      .filter(p => p.metrics && p.metrics.conversionRate > 0)
      .sort((a, b) => (b.metrics?.conversionRate || 0) - (a.metrics?.conversionRate || 0));

    return pages.slice(0, limit);
  }

  // Alias stubs
  async renderPage(id: string, variables?: Record<string, unknown>): Promise<{ html: string; page?: LandingPage }> {
    const page = await this.getPage(id);
    return { html: `<div data-page="${id}"></div>`, page };
  }
  async getVariantPerformance(pageId: string): Promise<{ variantId: string; conversionRate: number }[]> {
    const page = await this.getPage(pageId);
    return (page?.variants ?? []).map(v => ({ variantId: v.id, conversionRate: v.metrics?.conversionRate ?? 0 }));
  }
}

// ============================================================================
// Export
// ============================================================================

export const landingPageManager = new LandingPageManager();
