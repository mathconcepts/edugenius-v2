/**
 * landingPageEngine.ts — Dynamic Landing Page Generator
 *
 * Generates fully dynamic landing page configs for:
 *   - Exam-specific pages (any exam in examRegistry)
 *   - Feature pages
 *   - Blog topic cluster pages
 *
 * Adapts pages from Oracle performance data (A/B variant selection).
 * Integrates with: marketingIntegration configs, examRegistry, contentStrategyService.
 *
 * All localStorage keys prefixed `edugenius_growth_`.
 */

import { EXAM_REGISTRY, getExamById, type ExamConfig } from '@/data/examRegistry';
import { websiteSeoService, type PageMeta } from './websiteSeoService';
import type { SchemaMarkup } from './websiteSeoService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SectionType =
  | 'hero'
  | 'features'
  | 'social_proof'
  | 'faq'
  | 'cta'
  | 'exam_calendar'
  | 'testimonials'
  | 'why_edugenius'
  | 'topic_grid'
  | 'comparison_table';

export interface ContentSection {
  id: string;
  type: SectionType;
  headline: string;
  body: string;
  cta?: {
    primary: { text: string; href: string };
    secondary?: { text: string; href: string };
  };
  image?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>;
  abVariant?: 'A' | 'B';
  conversionWeight?: number;  // 0-1 — higher means Oracle prefers this
}

export interface LandingPageConfig {
  pageId: string;
  slug: string;
  title: string;
  meta: PageMeta;
  sections: ContentSection[];
  ctas: Array<{ text: string; href: string; variant: 'primary' | 'secondary' | 'ghost' }>;
  schema: SchemaMarkup[];
  targetKeywords: string[];
  lastUpdated: string;
  adaptationVersion: number;
  examId?: string;
  featureId?: string;
}

export interface ExamCalendarEntry {
  examId: string;
  examName: string;
  date: string;           // ISO date string
  stage: 'registration' | 'admit_card' | 'exam' | 'result';
  daysAway: number;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY_PAGES = 'edugenius_growth_lp_cache';
const STORAGE_KEY_AB = 'edugenius_growth_ab_variants';

// ─── Exam Calendar (static seed — refreshed by Scout) ────────────────────────

const EXAM_CALENDAR_DATA: ExamCalendarEntry[] = [
  { examId: 'jee-main', examName: 'JEE Main Session 1', date: '2026-01-22', stage: 'exam', daysAway: 0 },
  { examId: 'neet', examName: 'NEET UG', date: '2026-05-05', stage: 'exam', daysAway: 0 },
  { examId: 'gate-engineering-maths', examName: 'GATE 2026', date: '2026-02-01', stage: 'exam', daysAway: 0 },
  { examId: 'cat', examName: 'CAT 2026', date: '2026-11-23', stage: 'exam', daysAway: 0 },
  { examId: 'cbse-12', examName: 'CBSE Class 12 Boards', date: '2026-02-15', stage: 'exam', daysAway: 0 },
];

function getExamCalendar(): ExamCalendarEntry[] {
  const now = Date.now();
  return EXAM_CALENDAR_DATA.map((e) => ({
    ...e,
    daysAway: Math.max(0, Math.floor((new Date(e.date).getTime() - now) / 86400000)),
  }));
}

// ─── Social Proof Data (fallback; Oracle replaces with live numbers) ──────────

const SOCIAL_PROOF = {
  studentCount: '50,000+',
  successRate: '94%',
  aiInteractions: '10M+',
  questionBank: '2.5L+',
  avgRankImprovement: '+45%',
};

// ─── Testimonials per exam ────────────────────────────────────────────────────

const EXAM_TESTIMONIALS: Record<string, Array<{ name: string; score: string; quote: string; avatar: string }>> = {
  'jee-main': [
    { name: 'Rahul S.', score: 'AIR 1,247', quote: 'Sage helped me understand concepts I struggled with for years. My rank jumped from 15k to 1.2k!', avatar: '👦' },
    { name: 'Arjun K.', score: 'AIR 856', quote: 'The adaptive practice knew exactly what I needed. EduGenius is simply better than every coaching app I tried.', avatar: '👦' },
  ],
  'neet': [
    { name: 'Priya P.', score: '685/720', quote: 'Smart Notebook is amazing! I write equations and get instant step-by-step solutions. NCERT coverage is perfect.', avatar: '👧' },
    { name: 'Sneha R.', score: '672/720', quote: 'The Socratic AI never just gives you the answer — it makes you think. That\'s exactly what NEET needs.', avatar: '👧' },
  ],
  'gate-engineering-maths': [
    { name: 'Aditya M.', score: 'AIR 312 (GATE CS)', quote: 'Numerical methods and complex variables — the two hardest topics — were finally made simple by EduGenius.', avatar: '👨‍💻' },
    { name: 'Kiran T.', score: 'Score: 67.5', quote: 'I couldn\'t find good resources for GATE EM anywhere. EduGenius filled every gap.', avatar: '👨' },
  ],
  'cat': [
    { name: 'Vikram S.', score: '99.2 percentile', quote: 'DILR was my weakest. Sage\'s puzzle-based approach totally changed how I approach these questions.', avatar: '👨' },
    { name: 'Ananya B.', score: '98.7 percentile', quote: 'RC strategy sessions with the AI tutor were a game changer. I can now finish RC in 40 minutes flat.', avatar: '👩' },
  ],
  'cbse-12': [
    { name: 'Ishaan P.', score: '97.4%', quote: 'NCERT mastery mode on EduGenius made sure I didn\'t miss a single marking scheme point.', avatar: '👦' },
    { name: 'Kavya R.', score: '96.2%', quote: 'The AI gives you practice exactly like board patterns. My chemistry marks went from 68 to 94.', avatar: '👧' },
  ],
};

const DEFAULT_TESTIMONIALS = EXAM_TESTIMONIALS['jee-main'];

// ─── Feature Data ─────────────────────────────────────────────────────────────

const FEATURE_HEADLINES: Record<string, string> = {
  'ai-tutor': 'Sage — Your Socratic AI Tutor, Available 24/7',
  'adaptive-practice': 'Adaptive Practice That Knows Your Gaps',
  'smart-notebook': 'Smart Notebook: Write → Solve → Master',
  'mock-tests': 'Full Mock Tests with AI-Powered Analysis',
  'spaced-repetition': 'Never Forget What You\'ve Learned',
};

// ─── Landing Page Engine ──────────────────────────────────────────────────────

class LandingPageEngine {
  // ── Exam Landing Page ───────────────────────────────────────────────────────

  generateExamLandingPage(examId: string): LandingPageConfig {
    const exam = getExamById(examId) ?? EXAM_REGISTRY[0];
    const abVariant = this._getAbVariant(examId);
    const meta = websiteSeoService.generatePageMeta('exam', { exam });
    const kwSet = websiteSeoService.trackKeywordTargets(examId, exam.topics[0] ?? 'preparation');
    const calendar = getExamCalendar().filter((e) => e.examId === examId || e.daysAway < 120);
    const testimonials = EXAM_TESTIMONIALS[examId] ?? DEFAULT_TESTIMONIALS;

    const sections: ContentSection[] = [
      this._buildHeroSection(exam, abVariant),
      this._buildFeaturesSection(exam),
      this._buildWhyEduGeniusSection(exam),
      this._buildTestimonialsSection(testimonials),
      this._buildTopicGridSection(exam),
      this._buildFaqSection(exam),
      this._buildExamCalendarSection(calendar),
      this._buildCtaSection(exam, abVariant),
    ];

    const schemas = [
      websiteSeoService.generateSchemaMarkup('Course', { exam }),
      websiteSeoService.generateSchemaMarkup('FAQPage', { exam }),
      websiteSeoService.generateSchemaMarkup('BreadcrumbList', { exam }),
      websiteSeoService.generateSchemaMarkup('Organization', {}),
    ];

    const config: LandingPageConfig = {
      pageId: `exam-${examId}`,
      slug: `/website/exams/${exam.route}`,
      title: exam.name,
      meta,
      sections,
      ctas: [
        { text: 'Start Free', href: '/onboarding', variant: 'primary' },
        { text: 'See Demo', href: '/website/demo', variant: 'secondary' },
      ],
      schema: schemas,
      targetKeywords: [kwSet.primary, ...kwSet.secondary.slice(0, 3)],
      lastUpdated: new Date().toISOString(),
      adaptationVersion: 1,
      examId,
    };

    this._cachePage(config);
    return config;
  }

  // ── Feature Landing Page ────────────────────────────────────────────────────

  generateFeaturePage(featureId: string): LandingPageConfig {
    const headline = FEATURE_HEADLINES[featureId] ?? 'EduGenius AI Feature';
    const meta = websiteSeoService.generatePageMeta('feature', { featureId });

    const sections: ContentSection[] = [
      {
        id: `${featureId}-hero`,
        type: 'hero',
        headline,
        body: `Designed for India's competitive exam aspirants. No more passive reading — EduGenius makes you think.`,
        cta: {
          primary: { text: 'Try It Free', href: '/onboarding' },
          secondary: { text: 'Watch Demo', href: '/website/demo' },
        },
      },
      {
        id: `${featureId}-social-proof`,
        type: 'social_proof',
        headline: 'Trusted by 50,000+ Students',
        body: `${SOCIAL_PROOF.studentCount} students | ${SOCIAL_PROOF.successRate} success rate | ${SOCIAL_PROOF.aiInteractions} AI interactions`,
        data: SOCIAL_PROOF,
      },
      {
        id: `${featureId}-cta`,
        type: 'cta',
        headline: 'Ready to Try?',
        body: 'Free forever. No credit card required.',
        cta: { primary: { text: 'Get Started', href: '/onboarding' } },
      },
    ];

    const config: LandingPageConfig = {
      pageId: `feature-${featureId}`,
      slug: `/website/features/${featureId}`,
      title: headline,
      meta,
      sections,
      ctas: [{ text: 'Try Free', href: '/onboarding', variant: 'primary' }],
      schema: [websiteSeoService.generateSchemaMarkup('WebPage', {})],
      targetKeywords: meta.keywords.slice(0, 4),
      lastUpdated: new Date().toISOString(),
      adaptationVersion: 1,
      featureId,
    };

    this._cachePage(config);
    return config;
  }

  // ── Blog Topic Cluster Landing Page ────────────────────────────────────────

  generateBlogLandingPage(topic: string, exam?: ExamConfig): LandingPageConfig {
    const examStr = exam ? ` for ${exam.shortName}` : '';
    const meta = websiteSeoService.generatePageMeta('topic_cluster', { exam, topic });

    const sections: ContentSection[] = [
      {
        id: `topic-hero`,
        type: 'hero',
        headline: `Master ${topic}${examStr} with AI Tutoring`,
        body: `Curated guides, practice questions, and AI-powered explanations — all in one place.`,
        cta: { primary: { text: 'Start Learning', href: '/onboarding' } },
      },
      {
        id: `topic-cta`,
        type: 'cta',
        headline: 'Get Personalised Practice',
        body: 'Join 50,000+ students already using EduGenius.',
        cta: { primary: { text: 'Start Free', href: '/onboarding' } },
      },
    ];

    const config: LandingPageConfig = {
      pageId: `topic-${topic.toLowerCase().replace(/\s+/g, '-')}`,
      slug: `/website/topics/${topic.toLowerCase().replace(/\s+/g, '-')}`,
      title: `${topic}${examStr} Study Guide`,
      meta,
      sections,
      ctas: [{ text: 'Start Free', href: '/onboarding', variant: 'primary' }],
      schema: [websiteSeoService.generateSchemaMarkup('HowTo', { exam, topic })],
      targetKeywords: meta.keywords.slice(0, 4),
      lastUpdated: new Date().toISOString(),
      adaptationVersion: 1,
    };

    this._cachePage(config);
    return config;
  }

  // ── Performance Adaptation ──────────────────────────────────────────────────

  adaptPageFromPerformance(
    pageId: string,
    metrics: { ctr?: number; bounceRate?: number; conversionRate?: number; weakSectionIds?: string[] },
  ): LandingPageConfig | null {
    const cached = this._loadCachedPage(pageId);
    if (!cached) return null;

    const updated = { ...cached };
    updated.adaptationVersion += 1;
    updated.lastUpdated = new Date().toISOString();

    // If conversion rate is low, promote CTA section to top
    if (metrics.conversionRate !== undefined && metrics.conversionRate < 0.02) {
      const ctaIdx = updated.sections.findIndex((s) => s.type === 'cta');
      if (ctaIdx > 1) {
        const [cta] = updated.sections.splice(ctaIdx, 1);
        updated.sections.splice(1, 0, cta);
      }
    }

    // If bounce rate is high, swap hero to B variant
    if (metrics.bounceRate !== undefined && metrics.bounceRate > 0.75) {
      updated.sections = updated.sections.map((s) =>
        s.type === 'hero' ? { ...s, abVariant: 'B' } : s,
      );
    }

    this._cachePage(updated);

    // Signal growth orchestrator about the adaptation
    this._emitAdaptationSignal(pageId, metrics);

    return updated;
  }

  // ── Section Builders ────────────────────────────────────────────────────────

  private _buildHeroSection(exam: ExamConfig, abVariant: 'A' | 'B'): ContentSection {
    const taglines: Record<string, { A: string; B: string }> = {
      'jee-main': {
        A: `Crack JEE with India's First Socratic AI Tutor`,
        B: `From 15,000 rank to IIT — EduGenius makes it possible`,
      },
      'neet': {
        A: `MBBS Dreams Start Here — AI-Powered NEET Prep`,
        B: `Score 680+ in NEET with Personalised AI Coaching`,
      },
      'gate-engineering-maths': {
        A: `GATE Engineering Maths — Finally Made Simple`,
        B: `Complex Variables, Numerical Methods — Master the Hardest GATE Topics`,
      },
      'cat': {
        A: `Crack CAT with AI — DILR, VARC, Quant, All in One`,
        B: `99 Percentile is Possible — EduGenius AI Knows Your Gaps`,
      },
      'cbse-12': {
        A: `Score 95%+ in CBSE Boards with AI Precision`,
        B: `NCERT Complete + AI Tutor = Board Exam Mastery`,
      },
    };

    const tag = taglines[exam.id] ?? { A: `${exam.name} Preparation with AI`, B: `Crack ${exam.shortName} with Smart AI Coaching` };
    const headline = abVariant === 'A' ? tag.A : tag.B;

    return {
      id: `hero-${exam.id}`,
      type: 'hero',
      headline,
      body: exam.description,
      cta: {
        primary: { text: 'Start Free', href: '/onboarding' },
        secondary: { text: 'See How It Works', href: '/website/demo' },
      },
      data: {
        examIcon: exam.icon,
        examShort: exam.shortName,
        socialProof: SOCIAL_PROOF,
      },
      abVariant,
    };
  }

  private _buildFeaturesSection(exam: ExamConfig): ContentSection {
    const examFeatures: Record<string, string[]> = {
      'jee-main': ['JEE-pattern mock tests with full analysis', 'Adaptive difficulty — never too easy or too hard', 'AI doubt-solver in English & Hinglish', 'Rank predictor based on your practice performance', 'Chapter-wise weightage analysis', 'Previous year questions with Sage explanations'],
      'neet': ['NCERT-aligned AI tutoring for Biology, Physics, Chemistry', 'NEET-pattern full mock tests', 'Assertion-Reason question deep-dive', 'AI explains NCERT line-by-line if needed', 'Marking scheme mastery drills', 'Weak topic flashcard review with spaced repetition'],
      'gate-engineering-maths': ['All 10 GATE EM topics with AI coverage', 'Numerical methods step-by-step solver', 'Linear algebra concept-to-question mapping', 'GATE PYQ bank with Socratic explanations', 'Adaptive difficulty for 1-mark vs 2-mark questions', 'Score predictor based on accuracy trends'],
      'cat': ['DILR puzzle training with Sage guidance', 'RC strategy sessions — speed + accuracy', 'Quant shortcut techniques for CAT', 'CAT-pattern sectional mocks', 'Time management drills', 'Percentile predictor based on mock scores'],
      'cbse-12': ['NCERT chapter mastery tracker', 'Sample paper practise with marking scheme', 'AI explains every NCERT exemplar solution', 'Board question pattern analysis', '3-5 mark question writing practice with AI feedback', 'Revision schedule generator'],
    };
    const features = examFeatures[exam.id] ?? ['AI Socratic tutoring', 'Adaptive practice', 'Progress analytics', 'Mock tests'];

    return {
      id: `features-${exam.id}`,
      type: 'features',
      headline: `Everything You Need to Crack ${exam.shortName}`,
      body: `Purpose-built for ${exam.name} — not a generic study app.`,
      data: { features },
    };
  }

  private _buildWhyEduGeniusSection(exam: ExamConfig): ContentSection {
    return {
      id: `why-${exam.id}`,
      type: 'why_edugenius',
      headline: 'Why EduGenius Beats Every Other App',
      body: 'Most apps give you content. EduGenius teaches you to think.',
      data: {
        points: [
          { title: 'Socratic AI, not just answers', body: 'Sage asks guiding questions — you discover solutions. This is how toppers think.' },
          { title: 'Adapts to your level every session', body: 'Our AI knows your mastery level per topic and serves exactly the right challenge.' },
          { title: 'Built for Indian exams', body: `Designed specifically for ${exam.name} — question patterns, marking schemes, PYQs.` },
          { title: 'Available 24/7 — no scheduling', body: 'No batch timing. No waiting. Get a doubt cleared at 2 AM if that\'s when you study.' },
        ],
      },
    };
  }

  private _buildTestimonialsSection(
    testimonials: Array<{ name: string; score: string; quote: string; avatar: string }>,
  ): ContentSection {
    return {
      id: 'testimonials',
      type: 'testimonials',
      headline: 'What Toppers Say',
      body: 'Real students. Real results.',
      data: { testimonials },
    };
  }

  private _buildTopicGridSection(exam: ExamConfig): ContentSection {
    return {
      id: `topics-${exam.id}`,
      type: 'topic_grid',
      headline: `${exam.shortName} Syllabus Coverage`,
      body: 'Every topic, every subtopic — powered by AI.',
      data: {
        topics: exam.topics,
        topicWeights: exam.topicWeights ?? [],
        totalTopics: exam.topics.length,
      },
    };
  }

  private _buildFaqSection(exam: ExamConfig): ContentSection {
    const faqs = [
      { q: `Is EduGenius free for ${exam.shortName}?`, a: 'Yes — free plan includes 50 AI interactions/day. Pro unlocks unlimited sessions and full mock tests.' },
      { q: `How is EduGenius different from ${exam.shortName === 'JEE' ? 'Allen or Unacademy' : exam.shortName === 'NEET' ? 'Aakash or BYJU\'s' : 'other coaching apps'}?`, a: 'EduGenius uses Socratic AI tutoring — it asks you questions, not just explains concepts. This builds deeper understanding and better retention.' },
      { q: `Can I use EduGenius on mobile?`, a: 'Yes — EduGenius works on any browser. Android and iOS apps coming in 2026.' },
      { q: `Does EduGenius follow the latest ${exam.shortName} syllabus?`, a: `Absolutely. Our content is updated every month based on the latest ${exam.name} official syllabus and previous year patterns.` },
    ];

    return {
      id: `faq-${exam.id}`,
      type: 'faq',
      headline: 'Frequently Asked Questions',
      body: '',
      data: { faqs },
    };
  }

  private _buildExamCalendarSection(calendar: ExamCalendarEntry[]): ContentSection {
    return {
      id: 'exam-calendar',
      type: 'exam_calendar',
      headline: 'Upcoming Exam Dates',
      body: 'Plan your preparation around the official exam schedule.',
      data: { calendar: calendar.filter((e) => e.daysAway >= 0).slice(0, 5) },
    };
  }

  private _buildCtaSection(exam: ExamConfig, abVariant: 'A' | 'B'): ContentSection {
    const ctaCopy = {
      A: { headline: `Start Your ${exam.shortName} Journey Today`, body: 'Join 50,000+ students. Free forever.' },
      B: { headline: 'Your Rank Is Waiting — Start Now', body: 'Free trial. No credit card. Cancel anytime.' },
    };
    const copy = ctaCopy[abVariant];

    return {
      id: `cta-${exam.id}`,
      type: 'cta',
      headline: copy.headline,
      body: copy.body,
      cta: {
        primary: { text: 'Start Free Today', href: '/onboarding' },
        secondary: { text: 'View Pricing', href: '/website/pricing' },
      },
      abVariant,
      conversionWeight: abVariant === 'A' ? 0.5 : 0.5,
    };
  }

  // ── A/B Variant Selection ───────────────────────────────────────────────────

  private _getAbVariant(pageId: string): 'A' | 'B' {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AB);
      if (stored) {
        const variants = JSON.parse(stored) as Record<string, 'A' | 'B'>;
        if (variants[pageId]) return variants[pageId];
      }
      // Assign randomly and persist
      const variant: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';
      const variants = stored ? (JSON.parse(stored) as Record<string, 'A' | 'B'>) : {};
      variants[pageId] = variant;
      localStorage.setItem(STORAGE_KEY_AB, JSON.stringify(variants));
      return variant;
    } catch {
      return 'A';
    }
  }

  // ── Cache ───────────────────────────────────────────────────────────────────

  private _cachePage(config: LandingPageConfig): void {
    try {
      const cache = this._loadAllCached();
      cache[config.pageId] = config;
      localStorage.setItem(STORAGE_KEY_PAGES, JSON.stringify(cache));
    } catch {
      // Ignore storage errors
    }
  }

  private _loadCachedPage(pageId: string): LandingPageConfig | null {
    try {
      const cache = this._loadAllCached();
      return cache[pageId] ?? null;
    } catch {
      return null;
    }
  }

  private _loadAllCached(): Record<string, LandingPageConfig> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PAGES);
      return raw ? (JSON.parse(raw) as Record<string, LandingPageConfig>) : {};
    } catch {
      return {};
    }
  }

  getCachedPage(pageId: string): LandingPageConfig | null {
    return this._loadCachedPage(pageId);
  }

  getAllCachedPages(): LandingPageConfig[] {
    return Object.values(this._loadAllCached());
  }

  // ── Signals ─────────────────────────────────────────────────────────────────

  private _emitAdaptationSignal(
    pageId: string,
    metrics: { ctr?: number; bounceRate?: number; conversionRate?: number },
  ): void {
    try {
      localStorage.setItem(
        `edugenius_growth_signal_page_adapted`,
        JSON.stringify({ payload: { pageId, metrics }, ts: Date.now() }),
      );
    } catch {
      // Ignore
    }
  }

  emitPageReady(config: LandingPageConfig): void {
    try {
      localStorage.setItem(
        'edugenius_growth_landing_page_ready',
        JSON.stringify({
          payload: { slug: config.slug, examId: config.examId, pageId: config.pageId },
          ts: Date.now(),
        }),
      );
    } catch {
      // Ignore
    }
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const landingPageEngine = new LandingPageEngine();
export type { LandingPageEngine };
