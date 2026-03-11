/**
 * websiteSeoService.ts — EduGenius SEO Engine
 *
 * Generates all SEO artifacts: page meta, JSON-LD schemas, sitemap entries,
 * SEO score, keyword targets, indexing priority signals.
 *
 * All localStorage keys prefixed `edugenius_growth_`.
 * Emits signals to growthOrchestrator when SEO gaps are detected.
 */

import type { ExamConfig } from '@/data/examRegistry';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PageType =
  | 'home'
  | 'exam'
  | 'blog_post'
  | 'blog_index'
  | 'feature'
  | 'pricing'
  | 'about'
  | 'contact'
  | 'topic_cluster';

export interface OgTags {
  title: string;
  description: string;
  image: string;
  url: string;
  type: 'website' | 'article';
  siteName: string;
}

export interface TwitterCard {
  card: 'summary' | 'summary_large_image';
  site: string;
  title: string;
  description: string;
  image: string;
}

export interface PageMeta {
  title: string;
  description: string;
  keywords: string[];
  ogTags: OgTags;
  twitterCard: TwitterCard;
  canonicalUrl: string;
  robots: 'index,follow' | 'noindex,nofollow' | 'index,nofollow';
}

export interface SitemapEntry {
  url: string;
  priority: number;      // 0.0–1.0
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  lastmod: string;       // ISO date
}

export interface SeoScore {
  score: number;         // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendations: string[];
  breakdown: {
    titleScore: number;
    descriptionScore: number;
    keywordScore: number;
    schemaScore: number;
    freshnessScore: number;
  };
}

export interface KeywordSet {
  primary: string;
  secondary: string[];
  lsi: string[];         // Latent Semantic Indexing keywords
  questionKeywords: string[];
}

// ─── JSON-LD Schema types ─────────────────────────────────────────────────────

export type SchemaType =
  | 'WebPage'
  | 'WebSite'
  | 'Course'
  | 'FAQPage'
  | 'BreadcrumbList'
  | 'Organization'
  | 'BlogPosting'
  | 'HowTo'
  | 'EducationalOrganization';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SchemaMarkup = Record<string, any>;

// ─── Context shapes ───────────────────────────────────────────────────────────

export interface ExamPageContext {
  exam: ExamConfig;
  faqs?: Array<{ question: string; answer: string }>;
  breadcrumbs?: Array<{ name: string; url: string }>;
}

export interface BlogPostContext {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  author?: string;
  examTags?: string[];
  imageUrl?: string;
  wordCount?: number;
}

export interface PageContext {
  exam?: ExamConfig;
  blogPost?: BlogPostContext;
  topic?: string;
  featureId?: string;
  customTitle?: string;
  customDescription?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SITE_URL = 'https://edugenius.ai';
const SITE_NAME = 'EduGenius';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;
const TWITTER_HANDLE = '@EduGeniusAI';
const ORGANIZATION_LOGO = `${SITE_URL}/logo.png`;

const STORAGE_KEY_SEO_CACHE = 'edugenius_growth_seo_cache';
const STORAGE_KEY_SEO_GAPS = 'edugenius_growth_seo_gaps';

// ─── Keyword Banks ────────────────────────────────────────────────────────────

const EXAM_KEYWORD_BANKS: Record<string, KeywordSet> = {
  'jee-main': {
    primary: 'JEE Main 2026 preparation',
    secondary: ['JEE Main AI tutor', 'JEE Main practice test', 'IIT JEE coaching online', 'JEE Main mock test'],
    lsi: ['joint entrance exam', 'IIT admission', 'engineering entrance', 'NTA JEE', 'JEE rank predictor'],
    questionKeywords: ['how to crack JEE Main', 'best JEE Main app', 'JEE Main syllabus 2026'],
  },
  'neet': {
    primary: 'NEET UG 2026 preparation',
    secondary: ['NEET AI tutor', 'NEET biology practice', 'MBBS entrance coaching', 'NEET mock test online'],
    lsi: ['national eligibility entrance test', 'medical entrance exam India', 'NCERT biology for NEET', 'NTA NEET'],
    questionKeywords: ['how to prepare for NEET', 'best NEET app India', 'NEET syllabus 2026'],
  },
  'gate-engineering-maths': {
    primary: 'GATE Engineering Mathematics preparation',
    secondary: ['GATE EM AI tutor', 'numerical methods GATE', 'linear algebra GATE coaching', 'GATE maths practice'],
    lsi: ['GATE 2026 engineering maths', 'complex variables GATE', 'transform theory preparation', 'discrete mathematics GATE'],
    questionKeywords: ['how to prepare GATE engineering maths', 'best GATE EM resources', 'GATE maths syllabus'],
  },
  'cbse-12': {
    primary: 'CBSE Class 12 board exam preparation',
    secondary: ['CBSE 12 AI tutor', 'CBSE sample papers', 'board exam 95 percent strategy', 'NCERT solutions class 12'],
    lsi: ['CBSE marking scheme', 'class 12 physics chemistry maths', 'boards 2026', 'NCERT exemplar'],
    questionKeywords: ['how to score 95 in CBSE boards', 'CBSE class 12 study plan', 'best CBSE app'],
  },
  'cat': {
    primary: 'CAT 2026 MBA entrance preparation',
    secondary: ['CAT AI tutor', 'DILR practice online', 'CAT quant preparation', 'MBA entrance coaching'],
    lsi: ['common admission test', 'IIM admission', 'VARC strategy CAT', 'reading comprehension CAT'],
    questionKeywords: ['how to crack CAT exam', 'best CAT preparation app', 'CAT syllabus 2026'],
  },
};

const HOME_KEYWORDS: KeywordSet = {
  primary: 'AI-powered exam preparation India',
  secondary: ['AI tutor for JEE NEET', 'personalized study app India', 'Socratic tutoring AI', 'exam preparation platform'],
  lsi: ['adaptive learning', 'AI education app', 'competitive exam India', 'study with AI'],
  questionKeywords: ['best AI study app India', 'how does EduGenius work', 'AI tutor free India'],
};

// ─── SEO Service ─────────────────────────────────────────────────────────────

class WebsiteSeoService {
  // ── Page Meta Generation ────────────────────────────────────────────────────

  generatePageMeta(pageType: PageType, ctx: PageContext): PageMeta {
    switch (pageType) {
      case 'home':
        return this._homePageMeta();
      case 'exam':
        return ctx.exam ? this._examPageMeta(ctx.exam) : this._homePageMeta();
      case 'blog_post':
        return ctx.blogPost ? this._blogPostMeta(ctx.blogPost) : this._blogIndexMeta();
      case 'blog_index':
        return this._blogIndexMeta();
      case 'pricing':
        return this._pricingMeta();
      case 'feature':
        return this._featureMeta(ctx.featureId ?? 'ai-tutor');
      case 'topic_cluster':
        return this._topicClusterMeta(ctx.topic ?? 'study', ctx.exam);
      default:
        return this._homePageMeta();
    }
  }

  private _homePageMeta(): PageMeta {
    const title = 'EduGenius — AI Tutor for JEE, NEET, GATE & Boards | India\'s #1 AI Study App';
    const description = 'Crack JEE, NEET, GATE, CBSE boards with EduGenius AI. Personalised Socratic tutoring, adaptive practice, step-by-step solutions — available 24/7. Join 50,000+ toppers.';
    return {
      title,
      description,
      keywords: [...HOME_KEYWORDS.secondary, ...HOME_KEYWORDS.lsi],
      canonicalUrl: `${SITE_URL}/`,
      robots: 'index,follow',
      ogTags: {
        title,
        description,
        image: DEFAULT_OG_IMAGE,
        url: `${SITE_URL}/`,
        type: 'website',
        siteName: SITE_NAME,
      },
      twitterCard: {
        card: 'summary_large_image',
        site: TWITTER_HANDLE,
        title,
        description,
        image: DEFAULT_OG_IMAGE,
      },
    };
  }

  private _examPageMeta(exam: ExamConfig): PageMeta {
    const kw = EXAM_KEYWORD_BANKS[exam.id];
    const primary = kw?.primary ?? `${exam.name} AI preparation`;
    const title = `${exam.name} Preparation with AI — EduGenius | ${exam.shortName} Coaching Online`;
    const description = exam.description ?? `Master ${exam.name} with AI-powered personalised tutoring. ${kw?.secondary?.[0] ?? 'Practice smarter'}, get step-by-step solutions, and track your progress.`;
    return {
      title,
      description,
      keywords: kw ? [primary, ...kw.secondary, ...kw.lsi] : [exam.name],
      canonicalUrl: `${SITE_URL}/website/exams/${exam.route}`,
      robots: 'index,follow',
      ogTags: {
        title,
        description,
        image: `${SITE_URL}/og-exam-${exam.route}.png`,
        url: `${SITE_URL}/website/exams/${exam.route}`,
        type: 'website',
        siteName: SITE_NAME,
      },
      twitterCard: {
        card: 'summary_large_image',
        site: TWITTER_HANDLE,
        title,
        description,
        image: `${SITE_URL}/og-exam-${exam.route}.png`,
      },
    };
  }

  private _blogPostMeta(post: BlogPostContext): PageMeta {
    const title = `${post.title} | EduGenius Blog`;
    return {
      title,
      description: post.description,
      keywords: post.examTags ?? [],
      canonicalUrl: `${SITE_URL}/website/blog/${post.slug}`,
      robots: 'index,follow',
      ogTags: {
        title,
        description: post.description,
        image: post.imageUrl ?? DEFAULT_OG_IMAGE,
        url: `${SITE_URL}/website/blog/${post.slug}`,
        type: 'article',
        siteName: SITE_NAME,
      },
      twitterCard: {
        card: 'summary_large_image',
        site: TWITTER_HANDLE,
        title,
        description: post.description,
        image: post.imageUrl ?? DEFAULT_OG_IMAGE,
      },
    };
  }

  private _blogIndexMeta(): PageMeta {
    const title = 'EduGenius Blog — JEE, NEET, GATE Study Tips & AI Learning Insights';
    const description = 'Expert study strategies, exam analysis, and AI learning tips for JEE, NEET, GATE, CBSE and CAT aspirants. Stay updated with the latest trends in competitive exam prep.';
    return {
      title,
      description,
      keywords: ['JEE study tips', 'NEET preparation guide', 'AI learning', 'exam strategy blog', 'competitive exam India'],
      canonicalUrl: `${SITE_URL}/website/blog`,
      robots: 'index,follow',
      ogTags: {
        title,
        description,
        image: DEFAULT_OG_IMAGE,
        url: `${SITE_URL}/website/blog`,
        type: 'website',
        siteName: SITE_NAME,
      },
      twitterCard: {
        card: 'summary_large_image',
        site: TWITTER_HANDLE,
        title,
        description,
        image: DEFAULT_OG_IMAGE,
      },
    };
  }

  private _pricingMeta(): PageMeta {
    const title = 'EduGenius Pricing — Free & Pro Plans for AI Exam Prep | JEE, NEET, GATE';
    const description = 'Start free, upgrade when you\'re ready. EduGenius Pro unlocks unlimited AI tutoring, full mock tests, and personalized study plans for JEE, NEET & GATE.';
    return {
      title,
      description,
      keywords: ['EduGenius pricing', 'AI tutor free', 'JEE NEET app price', 'study app subscription India'],
      canonicalUrl: `${SITE_URL}/website/pricing`,
      robots: 'index,follow',
      ogTags: {
        title,
        description,
        image: DEFAULT_OG_IMAGE,
        url: `${SITE_URL}/website/pricing`,
        type: 'website',
        siteName: SITE_NAME,
      },
      twitterCard: {
        card: 'summary',
        site: TWITTER_HANDLE,
        title,
        description,
        image: DEFAULT_OG_IMAGE,
      },
    };
  }

  private _featureMeta(featureId: string): PageMeta {
    const featureNames: Record<string, { title: string; desc: string }> = {
      'ai-tutor': { title: 'AI Socratic Tutor', desc: 'Learn by asking questions, not memorising answers.' },
      'adaptive-practice': { title: 'Adaptive Practice', desc: 'Questions that adjust to your level — never too easy, never too hard.' },
      'smart-notebook': { title: 'Smart Notebook', desc: 'Write equations, get instant AI-powered solutions.' },
    };
    const f = featureNames[featureId] ?? featureNames['ai-tutor'];
    const title = `${f.title} — EduGenius Feature`;
    return {
      title,
      description: f.desc,
      keywords: [featureId, 'AI tutor feature', 'EduGenius'],
      canonicalUrl: `${SITE_URL}/website/features/${featureId}`,
      robots: 'index,follow',
      ogTags: {
        title,
        description: f.desc,
        image: DEFAULT_OG_IMAGE,
        url: `${SITE_URL}/website/features/${featureId}`,
        type: 'website',
        siteName: SITE_NAME,
      },
      twitterCard: {
        card: 'summary_large_image',
        site: TWITTER_HANDLE,
        title,
        description: f.desc,
        image: DEFAULT_OG_IMAGE,
      },
    };
  }

  private _topicClusterMeta(topic: string, exam?: ExamConfig): PageMeta {
    const examStr = exam ? ` for ${exam.shortName}` : '';
    const title = `${topic} Study Guide${examStr} | EduGenius`;
    const description = `Master ${topic}${examStr} with AI-powered explanations, practice questions, and Socratic tutoring. Expert-curated content for competitive exam success.`;
    return {
      title,
      description,
      keywords: [topic, `${topic} study guide`, `${topic} exam prep`],
      canonicalUrl: `${SITE_URL}/website/topics/${topic.toLowerCase().replace(/\s+/g, '-')}`,
      robots: 'index,follow',
      ogTags: {
        title,
        description,
        image: DEFAULT_OG_IMAGE,
        url: `${SITE_URL}/website/topics/${topic.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'website',
        siteName: SITE_NAME,
      },
      twitterCard: {
        card: 'summary',
        site: TWITTER_HANDLE,
        title,
        description,
        image: DEFAULT_OG_IMAGE,
      },
    };
  }

  // ── Schema Markup (JSON-LD) ──────────────────────────────────────────────────

  generateSchemaMarkup(schemaType: SchemaType, data: PageContext): SchemaMarkup {
    switch (schemaType) {
      case 'Organization':
        return this._organizationSchema();
      case 'WebSite':
        return this._websiteSchema();
      case 'WebPage':
        return this._webPageSchema(data);
      case 'Course':
        return data.exam ? this._courseSchema(data.exam) : this._organizationSchema();
      case 'FAQPage':
        return this._faqSchema(data);
      case 'BreadcrumbList':
        return this._breadcrumbSchema(data);
      case 'BlogPosting':
        return data.blogPost ? this._blogPostingSchema(data.blogPost) : this._webPageSchema(data);
      case 'EducationalOrganization':
        return this._educationalOrgSchema();
      case 'HowTo':
        return this._howToSchema(data);
      default:
        return this._organizationSchema();
    }
  }

  private _organizationSchema(): SchemaMarkup {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: ORGANIZATION_LOGO,
      description: 'AI-powered exam preparation platform for Indian competitive exams — JEE, NEET, GATE, CBSE and CAT.',
      sameAs: [
        'https://twitter.com/EduGeniusAI',
        'https://linkedin.com/company/edugenius-ai',
        'https://instagram.com/edugeniusai',
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        availableLanguage: ['English', 'Hindi'],
      },
    };
  }

  private _educationalOrgSchema(): SchemaMarkup {
    return {
      '@context': 'https://schema.org',
      '@type': 'EducationalOrganization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: ORGANIZATION_LOGO,
      description: 'India\'s AI-powered Socratic tutoring platform for JEE, NEET, GATE, CBSE and CAT preparation.',
      hasCredential: {
        '@type': 'EducationalOccupationalCredential',
        credentialCategory: 'exam preparation',
      },
    };
  }

  private _websiteSchema(): SchemaMarkup {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      description: 'AI-powered exam preparation for JEE, NEET, GATE, CBSE and CAT.',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/website/blog?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    };
  }

  private _webPageSchema(ctx: PageContext): SchemaMarkup {
    const meta = this.generatePageMeta('home', ctx);
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: meta.title,
      description: meta.description,
      url: meta.canonicalUrl,
      inLanguage: 'en-IN',
      isPartOf: { '@id': SITE_URL },
      about: { '@type': 'Thing', name: 'Exam Preparation' },
      dateModified: new Date().toISOString(),
    };
  }

  private _courseSchema(exam: ExamConfig): SchemaMarkup {
    return {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: `${exam.name} Preparation`,
      description: exam.description,
      provider: {
        '@type': 'EducationalOrganization',
        name: SITE_NAME,
        url: SITE_URL,
      },
      url: `${SITE_URL}/website/exams/${exam.route}`,
      courseMode: 'online',
      availableLanguage: ['English', 'Hindi'],
      educationalLevel: exam.category === 'boards' ? 'HighSchool' : 'PostSecondary',
      teaches: exam.topics.join(', '),
      hasCourseInstance: {
        '@type': 'CourseInstance',
        courseMode: 'online',
        instructor: {
          '@type': 'Person',
          name: 'EduGenius AI (Sage)',
          description: 'Socratic AI tutor',
        },
      },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
        description: 'Free trial available. Pro plans from ₹499/month.',
      },
    };
  }

  private _faqSchema(ctx: PageContext): SchemaMarkup {
    const defaultFaqs = [
      { question: 'What is EduGenius?', answer: 'EduGenius is an AI-powered exam preparation platform that uses Socratic tutoring to help students crack JEE, NEET, GATE, CBSE and CAT.' },
      { question: 'Is EduGenius free?', answer: 'Yes, EduGenius has a free tier with limited AI interactions. Pro plans unlock unlimited tutoring and full mock tests.' },
      { question: 'Which exams does EduGenius support?', answer: 'EduGenius supports JEE Main & Advanced, NEET UG, GATE Engineering Mathematics, CBSE Class 12, and CAT MBA entrance.' },
      { question: 'How is EduGenius different from other apps?', answer: 'EduGenius uses Socratic AI tutoring — instead of giving answers, Sage asks guiding questions that help you discover solutions yourself. This builds deeper understanding.' },
    ];

    const examFaqs = ctx.exam ? [
      { question: `How many questions are in ${ctx.exam.shortName}?`, answer: `${ctx.exam.name} has ${ctx.exam.totalQuestions} questions and is ${ctx.exam.duration} minutes long.` },
      { question: `What topics does EduGenius cover for ${ctx.exam.shortName}?`, answer: `EduGenius covers all ${ctx.exam.topics.length} topics: ${ctx.exam.topics.slice(0, 5).join(', ')}${ctx.exam.topics.length > 5 ? ', and more.' : '.'}` },
    ] : [];

    const faqs = [...(examFaqs.length ? examFaqs : defaultFaqs)];

    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };
  }

  private _breadcrumbSchema(ctx: PageContext): SchemaMarkup {
    const items = [{ name: 'Home', url: SITE_URL }];
    if (ctx.exam) {
      items.push({ name: 'Exams', url: `${SITE_URL}/website/exams` });
      items.push({ name: ctx.exam.shortName, url: `${SITE_URL}/website/exams/${ctx.exam.route}` });
    } else if (ctx.blogPost) {
      items.push({ name: 'Blog', url: `${SITE_URL}/website/blog` });
      items.push({ name: ctx.blogPost.title, url: `${SITE_URL}/website/blog/${ctx.blogPost.slug}` });
    }
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: item.url,
      })),
    };
  }

  private _blogPostingSchema(post: BlogPostContext): SchemaMarkup {
    return {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      url: `${SITE_URL}/website/blog/${post.slug}`,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt ?? post.publishedAt,
      author: {
        '@type': 'Organization',
        name: SITE_NAME,
      },
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        logo: { '@type': 'ImageObject', url: ORGANIZATION_LOGO },
      },
      image: post.imageUrl ?? DEFAULT_OG_IMAGE,
      inLanguage: 'en-IN',
      wordCount: post.wordCount ?? 800,
      about: {
        '@type': 'Thing',
        name: post.examTags?.join(', ') ?? 'Exam Preparation',
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/website/blog/${post.slug}`,
      },
    };
  }

  private _howToSchema(ctx: PageContext): SchemaMarkup {
    const examName = ctx.exam?.name ?? 'Competitive Exam';
    return {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: `How to Prepare for ${examName} with AI`,
      description: `Step-by-step guide to cracking ${examName} using EduGenius AI tutoring.`,
      step: [
        { '@type': 'HowToStep', name: 'Enroll free', text: 'Create a free EduGenius account and select your exam.' },
        { '@type': 'HowToStep', name: 'Diagnose gaps', text: 'Take the diagnostic test to find your weak topics.' },
        { '@type': 'HowToStep', name: 'Study with Sage', text: 'Chat with Sage AI for Socratic deep-dive sessions.' },
        { '@type': 'HowToStep', name: 'Practice & test', text: 'Solve adaptive practice sets and take full mock tests.' },
        { '@type': 'HowToStep', name: 'Track & improve', text: 'Review performance analytics and adjust your strategy.' },
      ],
      totalTime: 'P90D',
    };
  }

  // ── Sitemap ──────────────────────────────────────────────────────────────────

  buildSitemapEntries(exams: ExamConfig[]): SitemapEntry[] {
    const today = new Date().toISOString().split('T')[0];
    const entries: SitemapEntry[] = [
      { url: `${SITE_URL}/`, priority: 1.0, changefreq: 'weekly', lastmod: today },
      { url: `${SITE_URL}/website`, priority: 1.0, changefreq: 'weekly', lastmod: today },
      { url: `${SITE_URL}/website/pricing`, priority: 0.8, changefreq: 'monthly', lastmod: today },
      { url: `${SITE_URL}/website/blog`, priority: 0.9, changefreq: 'daily', lastmod: today },
    ];

    // Add per-exam pages
    for (const exam of exams) {
      if (exam.status !== 'coming-soon') {
        entries.push({
          url: `${SITE_URL}/website/exams/${exam.route}`,
          priority: 0.9,
          changefreq: 'weekly',
          lastmod: exam.launchDate ?? today,
        });
      }
    }

    return entries;
  }

  buildSitemapXml(entries: SitemapEntry[]): string {
    const items = entries
      .map(
        (e) =>
          `  <url>\n    <loc>${e.url}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority.toFixed(1)}</priority>\n  </url>`,
      )
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>`;
  }

  // ── SEO Score ────────────────────────────────────────────────────────────────

  calculatePageSeoScore(meta: PageMeta): SeoScore {
    const titleScore = this._scoreTitleTag(meta.title);
    const descScore = this._scoreMetaDescription(meta.description);
    const kwScore = this._scoreKeywords(meta.keywords);
    const schemaScore = 80; // default: schema presence assumed
    const freshnessScore = 85; // baseline

    const overall = Math.round(
      titleScore * 0.25 + descScore * 0.25 + kwScore * 0.2 + schemaScore * 0.2 + freshnessScore * 0.1,
    );

    const recommendations: string[] = [];
    if (titleScore < 70) recommendations.push('Title tag is too short or missing primary keyword');
    if (descScore < 70) recommendations.push('Meta description should be 150-160 characters');
    if (kwScore < 60) recommendations.push('Add more relevant secondary keywords');
    if (!meta.ogTags.image.includes('og-')) recommendations.push('Add a dedicated OG image for this page');

    const grade: SeoScore['grade'] =
      overall >= 90 ? 'A' : overall >= 75 ? 'B' : overall >= 60 ? 'C' : overall >= 45 ? 'D' : 'F';

    return {
      score: overall,
      grade,
      recommendations,
      breakdown: { titleScore, descriptionScore: descScore, keywordScore: kwScore, schemaScore, freshnessScore },
    };
  }

  private _scoreTitleTag(title: string): number {
    if (!title) return 0;
    const len = title.length;
    if (len < 30) return 40;
    if (len > 70) return 60;
    return 90;
  }

  private _scoreMetaDescription(desc: string): number {
    if (!desc) return 0;
    const len = desc.length;
    if (len < 100) return 40;
    if (len > 165) return 65;
    return 90;
  }

  private _scoreKeywords(keywords: string[]): number {
    if (!keywords.length) return 0;
    if (keywords.length < 3) return 50;
    if (keywords.length >= 5) return 90;
    return 70;
  }

  // ── Indexing Priority ────────────────────────────────────────────────────────

  getIndexingPriority(pageType: PageType): { shouldIndex: boolean; priority: 'high' | 'medium' | 'low'; reason: string } {
    const config: Record<PageType, { shouldIndex: boolean; priority: 'high' | 'medium' | 'low'; reason: string }> = {
      home:          { shouldIndex: true,  priority: 'high',   reason: 'Homepage — maximum indexing priority' },
      exam:          { shouldIndex: true,  priority: 'high',   reason: 'Exam landing pages are high-value SEO targets' },
      blog_post:     { shouldIndex: true,  priority: 'medium', reason: 'Blog posts drive organic traffic via long-tail keywords' },
      blog_index:    { shouldIndex: true,  priority: 'medium', reason: 'Blog index is a hub page' },
      feature:       { shouldIndex: true,  priority: 'medium', reason: 'Feature pages convert intent-based searches' },
      pricing:       { shouldIndex: true,  priority: 'medium', reason: 'Pricing page captures bottom-funnel searches' },
      about:         { shouldIndex: true,  priority: 'low',    reason: 'About page — brand credibility' },
      contact:       { shouldIndex: false, priority: 'low',    reason: 'Contact page — low SEO value' },
      topic_cluster: { shouldIndex: true,  priority: 'high',   reason: 'Topic cluster pages capture long-tail search volume' },
    };
    return config[pageType] ?? { shouldIndex: true, priority: 'medium', reason: 'Default indexing' };
  }

  // ── Keyword Targets ──────────────────────────────────────────────────────────

  trackKeywordTargets(examId: string, topic: string): KeywordSet {
    const examKw = EXAM_KEYWORD_BANKS[examId];
    if (examKw) {
      return {
        ...examKw,
        lsi: [...examKw.lsi, `${topic} ${examId}`, `${topic} for exam`, `${topic} preparation India`],
        questionKeywords: [...examKw.questionKeywords, `how to study ${topic}`, `${topic} tips`],
      };
    }
    return {
      primary: `${topic} exam preparation`,
      secondary: [`${topic} study guide`, `${topic} practice questions`],
      lsi: [`${topic} India`, `${topic} competitive exam`],
      questionKeywords: [`how to learn ${topic}`, `best ${topic} resources`],
    };
  }

  // ── SEO Gap Detection → Emit Signal ─────────────────────────────────────────

  injectSeoSignals(exams: ExamConfig[]): void {
    try {
      const gaps: Array<{ pageId: string; gapType: string; urgency: 'low' | 'medium' | 'high' }> = [];

      // Check if exam pages have been freshly optimised
      const seoCache = this._loadSeoCache();
      for (const exam of exams) {
        const lastOpt = seoCache[exam.id];
        const daysSinceOpt = lastOpt
          ? Math.floor((Date.now() - new Date(lastOpt).getTime()) / 86400000)
          : 999;
        if (daysSinceOpt > 30) {
          gaps.push({ pageId: exam.id, gapType: 'stale_meta', urgency: daysSinceOpt > 60 ? 'high' : 'medium' });
        }
      }

      if (gaps.length > 0) {
        localStorage.setItem(
          STORAGE_KEY_SEO_GAPS,
          JSON.stringify({ gaps, detectedAt: new Date().toISOString() }),
        );
        // Signal the growth orchestrator
        localStorage.setItem(
          'edugenius_growth_signal_seo_gaps',
          JSON.stringify({ payload: { gaps }, ts: Date.now() }),
        );
      }
    } catch {
      // Never crash — graceful fallback
    }
  }

  markPageOptimised(pageId: string): void {
    const cache = this._loadSeoCache();
    cache[pageId] = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY_SEO_CACHE, JSON.stringify(cache));
    } catch {
      // storage full — ignore
    }
  }

  private _loadSeoCache(): Record<string, string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SEO_CACHE);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  // ── Convenience: inject <head> tags ─────────────────────────────────────────

  /** Returns a serialised JSON-LD script tag string (inject into <head>) */
  toScriptTag(schema: SchemaMarkup): string {
    return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
  }

  /** Combine multiple schemas into an array for a single script tag */
  combineSchemas(schemas: SchemaMarkup[]): SchemaMarkup {
    return schemas.length === 1 ? schemas[0] : schemas;
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const websiteSeoService = new WebsiteSeoService();
export type { WebsiteSeoService };
