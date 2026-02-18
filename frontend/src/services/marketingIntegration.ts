/**
 * Marketing Integration Service
 * 
 * Connects portal features to marketing content:
 * 1. Blog posts that showcase features with portal CTAs
 * 2. Landing pages for each learning mode
 * 3. SEO-optimized content with proper internal linking
 * 4. Feature announcements with engagement hooks
 * 
 * NO SIDE IMPACTS: This is additive - doesn't modify existing functionality
 */

import type { LearningMode } from '@/types/personalization';

// ============================================
// FEATURE-TO-MARKETING MAPPING
// ============================================

export interface FeatureMarketingConfig {
  featureId: string;
  featureName: string;
  tagline: string;
  shortDescription: string;
  longDescription: string;
  
  // Marketing assets
  heroImage?: string;
  demoVideo?: string;
  screenshots: string[];
  
  // Portal links
  portalPath: string;
  ctaText: string;
  ctaSecondary?: string;
  
  // SEO
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  
  // Blog integration
  relatedBlogTopics: string[];
  sampleBlogTitles: string[];
  
  // Target audience
  targetAudience: string[];
  painPoints: string[];
  benefits: string[];
}

export const featureMarketingConfigs: Record<string, FeatureMarketingConfig> = {
  // ============================================
  // LEARNING MODES
  // ============================================
  learning_modes: {
    featureId: 'learning_modes',
    featureName: 'Smart Learning Modes',
    tagline: 'Study smarter, not harder',
    shortDescription: 'AI that adapts to how YOU want to learn — deep understanding or quick exam prep',
    longDescription: `
      EduGenius understands that learning isn't one-size-fits-all. Whether you're building 
      deep conceptual understanding or cramming for tomorrow's exam, our AI adapts instantly.
      
      Just ask naturally — "explain why" triggers detailed explanations, while "quick tip" 
      gets you straight to the point. Or manually switch modes anytime. Your AI tutor 
      becomes exactly what you need, when you need it.
    `,
    portalPath: '/learn',
    ctaText: 'Try Smart Learning Free',
    ctaSecondary: 'See How It Works',
    seoTitle: 'Smart Learning Modes | AI Tutor That Adapts to You | EduGenius',
    seoDescription: 'Study smarter with AI that knows when you need deep explanations vs quick exam tips. 6 learning modes for JEE, NEET, CBSE preparation.',
    keywords: ['adaptive learning', 'AI tutor', 'JEE preparation', 'NEET preparation', 'personalized learning', 'exam prep', 'smart study'],
    screenshots: ['/screenshots/learning-modes-selector.png', '/screenshots/deep-learning-response.png', '/screenshots/exam-prep-response.png'],
    relatedBlogTopics: ['study techniques', 'exam preparation', 'learning styles', 'AI in education'],
    sampleBlogTitles: [
      '6 Ways to Study Smarter (Not Harder) for JEE 2026',
      'Why Your Study Method Matters More Than Hours Spent',
      'The Science Behind Adaptive Learning: How AI Knows What You Need',
      'Exam Prep vs Deep Learning: When to Use Each Approach',
    ],
    targetAudience: ['JEE aspirants', 'NEET aspirants', 'CBSE students', 'Parents of students'],
    painPoints: [
      'One-size-fits-all teaching doesn\'t work for me',
      'I need quick answers during revision but deep explanations when learning new topics',
      'Coaching classes can\'t adapt to my pace',
      'I waste time getting explanations I don\'t need',
    ],
    benefits: [
      'AI that understands your learning intent',
      'Switch between 6 modes instantly',
      'Save time with mode-appropriate responses',
      'Learn your way, not the textbook\'s way',
    ],
  },

  exam_prep_mode: {
    featureId: 'exam_prep_mode',
    featureName: 'Exam Prep Mode',
    tagline: 'Every second counts. Get straight to the point.',
    shortDescription: 'Quick tips, shortcuts, and exam patterns — no fluff, just what you need to score',
    longDescription: `
      When exams are around the corner, you don't have time for lengthy explanations. 
      Exam Prep Mode gives you:
      
      ⚡ Direct formulas and answers
      🚀 Time-saving shortcuts and tricks
      ⚠️ Common mistakes to avoid
      ⏱️ How long each problem type takes
      📖 Previous year question patterns
      
      EduGenius automatically switches to Exam Prep Mode when your exam is within 7 days.
      Because we know what pressure feels like.
    `,
    portalPath: '/learn?mode=exam_prep',
    ctaText: 'Activate Exam Mode',
    ctaSecondary: 'See Exam Tips',
    seoTitle: 'Exam Prep Mode | Quick Tips & Shortcuts for JEE/NEET | EduGenius',
    seoDescription: 'Get exam-ready with AI that gives you shortcuts, patterns, and time estimates. 50+ proven tips for JEE and NEET success.',
    keywords: ['JEE shortcuts', 'NEET tricks', 'exam tips', 'quick revision', 'last minute preparation', 'exam patterns'],
    screenshots: ['/screenshots/exam-prep-response.png', '/screenshots/exam-tips-panel.png', '/screenshots/time-estimates.png'],
    relatedBlogTopics: ['exam strategies', 'time management', 'last minute tips', 'shortcuts'],
    sampleBlogTitles: [
      '50 Shortcuts That Will Save You 30 Minutes in JEE Main',
      'Last 7 Days Before NEET: The Ultimate Exam Prep Strategy',
      'Common Mistakes That Cost Students 20+ Marks in Physics',
      'Time Management Secrets of JEE Toppers',
    ],
    targetAudience: ['Students with upcoming exams', 'Droppers', 'Repeaters'],
    painPoints: [
      'I don\'t have time for long explanations',
      'I keep making the same silly mistakes',
      'I don\'t know which topics are most important',
      'I run out of time in exams',
    ],
    benefits: [
      'Responses optimized for exam context',
      '50+ proven shortcuts and tips',
      'Auto-activates near exam dates',
      'Time estimates for each problem type',
    ],
  },

  // ============================================
  // NOTEBOOK FEATURES
  // ============================================
  smart_notebook: {
    featureId: 'smart_notebook',
    featureName: 'Smart Notebook',
    tagline: 'Your entire learning journey, organized automatically',
    shortDescription: 'Every problem you solve, every doubt you clear — all in one searchable, smart notebook',
    longDescription: `
      Stop losing track of what you've learned. EduGenius Smart Notebook automatically:
      
      📝 Captures every problem from AI tutoring, WhatsApp, Telegram
      🎯 Tracks your mastery across 100+ topics
      🔄 Schedules spaced repetition for weak areas
      📊 Shows your progress with beautiful analytics
      📅 Creates personalized study plans
      
      It's like having a perfect study diary that writes itself.
    `,
    portalPath: '/notebook',
    ctaText: 'Start Your Smart Notebook',
    ctaSecondary: 'See Sample Notebook',
    seoTitle: 'Smart Notebook | Auto-Organize Your JEE/NEET Preparation | EduGenius',
    seoDescription: 'Never lose track of your learning. AI-powered notebook that captures problems, tracks mastery, and creates study plans automatically.',
    keywords: ['study notebook', 'JEE notes', 'NEET notes', 'spaced repetition', 'topic tracker', 'study planner'],
    screenshots: ['/screenshots/notebook-overview.png', '/screenshots/topic-mastery.png', '/screenshots/spaced-repetition.png'],
    relatedBlogTopics: ['note-taking', 'study organization', 'revision techniques', 'memory'],
    sampleBlogTitles: [
      'Why 90% of Students\' Notes Are Useless (And How to Fix It)',
      'The Science of Spaced Repetition: Remember Everything You Learn',
      'How Toppers Organize Their Study Material',
      'From Chaos to Clarity: Organizing 2 Years of JEE Prep',
    ],
    targetAudience: ['Serious JEE/NEET aspirants', 'Students who struggle with organization'],
    painPoints: [
      'I can\'t find problems I solved before',
      'I don\'t know which topics I\'m weak in',
      'I forget what I learned last month',
      'My notes are all over the place',
    ],
    benefits: [
      'Auto-captures from all channels',
      'Visual mastery tracking',
      'AI-powered revision scheduling',
      'Searchable problem history',
    ],
  },

  interactive_resources: {
    featureId: 'interactive_resources',
    featureName: 'Interactive Simulations',
    tagline: 'See physics, don\'t just read it',
    shortDescription: '50+ Wolfram, PhET, GeoGebra simulations mapped to your syllabus',
    longDescription: `
      Some concepts need to be SEEN to be understood. EduGenius brings together the 
      world's best interactive simulations:
      
      🔬 PhET: Projectile motion, circuits, waves
      📐 GeoGebra: Conic sections, 3D geometry, calculus
      🧮 Wolfram: Visualizations with live computation
      📊 Desmos: Interactive graphs and calculators
      
      All mapped to JEE/NEET/CBSE topics. The AI knows exactly which simulation 
      to show for your current problem.
    `,
    portalPath: '/resources',
    ctaText: 'Explore Simulations',
    ctaSecondary: 'See Resource Library',
    seoTitle: 'Interactive Simulations for JEE/NEET | PhET, GeoGebra, Wolfram | EduGenius',
    seoDescription: '50+ interactive simulations from PhET, GeoGebra, Wolfram mapped to JEE and NEET syllabus. Learn by doing, not just reading.',
    keywords: ['physics simulations', 'interactive learning', 'PhET', 'GeoGebra', 'visual learning', 'JEE resources'],
    screenshots: ['/screenshots/projectile-simulation.png', '/screenshots/circuit-builder.png', '/screenshots/conic-sections.png'],
    relatedBlogTopics: ['visual learning', 'physics concepts', 'interactive education'],
    sampleBlogTitles: [
      '10 Physics Concepts You\'ll Finally Understand With These Simulations',
      'Why Visual Learners Score Higher in JEE Physics',
      'The Best Free Online Resources for JEE/NEET Preparation',
      'How to Use Simulations Effectively in Your Study Routine',
    ],
    targetAudience: ['Visual learners', 'Students struggling with abstract concepts'],
    painPoints: [
      'I can\'t visualize physics concepts',
      'Textbook diagrams are static and confusing',
      'I need to see how things work, not just read about them',
    ],
    benefits: [
      '50+ curated simulations',
      'Mapped to exact syllabus topics',
      'AI recommends relevant simulations',
      'Works on mobile and desktop',
    ],
  },

  // ============================================
  // MULTI-CHANNEL
  // ============================================
  multi_channel: {
    featureId: 'multi_channel',
    featureName: 'Learn Anywhere',
    tagline: 'WhatsApp, Telegram, or Web — your AI tutor is everywhere',
    shortDescription: 'Study on your favorite platform. All synced to your notebook automatically.',
    longDescription: `
      Don't change your habits. EduGenius comes to you:
      
      📱 WhatsApp: Quick doubts while commuting
      ✈️ Telegram: Deep study sessions with rich formatting
      🌐 Web: Full dashboard with simulations
      🎥 Google Meet: Live tutoring sessions
      
      Every interaction syncs to your Smart Notebook. Switch platforms seamlessly — 
      your learning history follows you everywhere.
    `,
    portalPath: '/integrations',
    ctaText: 'Connect Your Channels',
    ctaSecondary: 'See All Platforms',
    seoTitle: 'AI Tutor on WhatsApp, Telegram | Study Anywhere | EduGenius',
    seoDescription: 'Get AI tutoring on WhatsApp, Telegram, or web. All synced automatically. Study on your favorite platform.',
    keywords: ['WhatsApp tutor', 'Telegram study', 'mobile learning', 'AI on WhatsApp', 'study anywhere'],
    screenshots: ['/screenshots/whatsapp-chat.png', '/screenshots/telegram-chat.png', '/screenshots/channel-sync.png'],
    relatedBlogTopics: ['mobile learning', 'study on the go', 'productivity'],
    sampleBlogTitles: [
      'How to Turn Your Commute into Study Time',
      '5 Ways to Study Effectively on Your Phone',
      'Why WhatsApp Might Be Your Best Study Tool',
      'The Rise of Mobile Learning: Study Anywhere, Anytime',
    ],
    targetAudience: ['Busy students', 'Students who commute', 'Mobile-first users'],
    painPoints: [
      'I can\'t always sit at a computer',
      'I want to study during commute/breaks',
      'Switching between apps is annoying',
    ],
    benefits: [
      'Study on WhatsApp, Telegram, or web',
      'All progress synced automatically',
      'Same AI, any platform',
      'Quick doubts on mobile, deep study on web',
    ],
  },
};

// ============================================
// BLOG CONTENT TEMPLATES
// ============================================

export interface BlogTemplate {
  type: 'feature_showcase' | 'how_to' | 'comparison' | 'listicle' | 'case_study' | 'tips';
  structure: BlogSection[];
  ctaPlacement: 'inline' | 'end' | 'both';
  internalLinks: number; // Minimum internal links to include
}

export interface BlogSection {
  id: string;
  name: string;
  purpose: string;
  wordCount: number;
  includePortalLink: boolean;
}

export const blogTemplates: Record<string, BlogTemplate> = {
  feature_showcase: {
    type: 'feature_showcase',
    structure: [
      { id: 'hook', name: 'Attention Hook', purpose: 'Problem statement that resonates', wordCount: 100, includePortalLink: false },
      { id: 'pain', name: 'Pain Points', purpose: 'Elaborate on the problem', wordCount: 200, includePortalLink: false },
      { id: 'solution', name: 'Solution Introduction', purpose: 'Introduce the feature', wordCount: 150, includePortalLink: true },
      { id: 'how_it_works', name: 'How It Works', purpose: 'Explain with examples', wordCount: 300, includePortalLink: true },
      { id: 'benefits', name: 'Key Benefits', purpose: 'List 3-5 benefits', wordCount: 200, includePortalLink: false },
      { id: 'testimonial', name: 'Social Proof', purpose: 'Student story or stat', wordCount: 100, includePortalLink: false },
      { id: 'cta', name: 'Call to Action', purpose: 'Drive to portal', wordCount: 50, includePortalLink: true },
    ],
    ctaPlacement: 'both',
    internalLinks: 3,
  },
  
  tips_listicle: {
    type: 'listicle',
    structure: [
      { id: 'intro', name: 'Introduction', purpose: 'Why these tips matter', wordCount: 100, includePortalLink: false },
      { id: 'tips', name: 'Tips (5-10)', purpose: 'Each tip with explanation', wordCount: 800, includePortalLink: true },
      { id: 'bonus', name: 'Bonus Tip', purpose: 'Feature-related tip', wordCount: 150, includePortalLink: true },
      { id: 'conclusion', name: 'Conclusion', purpose: 'Summarize and CTA', wordCount: 100, includePortalLink: true },
    ],
    ctaPlacement: 'both',
    internalLinks: 5,
  },

  how_to_guide: {
    type: 'how_to',
    structure: [
      { id: 'intro', name: 'Introduction', purpose: 'What reader will learn', wordCount: 100, includePortalLink: false },
      { id: 'prerequisites', name: 'Prerequisites', purpose: 'What reader needs', wordCount: 50, includePortalLink: false },
      { id: 'steps', name: 'Step-by-Step', purpose: 'Detailed steps', wordCount: 600, includePortalLink: true },
      { id: 'examples', name: 'Examples', purpose: 'Show it in action', wordCount: 200, includePortalLink: true },
      { id: 'common_mistakes', name: 'Common Mistakes', purpose: 'What to avoid', wordCount: 150, includePortalLink: false },
      { id: 'next_steps', name: 'Next Steps', purpose: 'What to do after', wordCount: 100, includePortalLink: true },
    ],
    ctaPlacement: 'end',
    internalLinks: 4,
  },
};

// ============================================
// INTERNAL LINKING STRATEGY
// ============================================

export interface InternalLink {
  anchorText: string;
  targetPath: string;
  context: string; // When to use this link
}

export const internalLinkLibrary: InternalLink[] = [
  // Feature links
  { anchorText: 'Smart Learning Modes', targetPath: '/features/learning-modes', context: 'When discussing adaptive learning' },
  { anchorText: 'Exam Prep Mode', targetPath: '/learn?mode=exam_prep', context: 'When discussing exam strategies' },
  { anchorText: 'interactive simulations', targetPath: '/resources', context: 'When discussing visual learning' },
  { anchorText: 'Smart Notebook', targetPath: '/notebook', context: 'When discussing note-taking or organization' },
  { anchorText: 'AI tutor on WhatsApp', targetPath: '/integrations/whatsapp', context: 'When discussing mobile learning' },
  
  // Topic links (to portal study pages)
  { anchorText: 'projectile motion', targetPath: '/learn/physics/projectile-motion', context: 'Physics kinematics content' },
  { anchorText: 'quadratic equations', targetPath: '/learn/math/quadratic-equations', context: 'Algebra content' },
  { anchorText: 'organic chemistry reactions', targetPath: '/learn/chemistry/organic-reactions', context: 'Organic chemistry content' },
  { anchorText: 'conic sections', targetPath: '/learn/math/conic-sections', context: 'Coordinate geometry content' },
  
  // Exam links
  { anchorText: 'JEE Main preparation', targetPath: '/exams/jee-main', context: 'JEE-related content' },
  { anchorText: 'NEET preparation', targetPath: '/exams/neet', context: 'NEET-related content' },
  { anchorText: 'CBSE Class 12', targetPath: '/exams/cbse-12', context: 'Board exam content' },
  
  // Resource links
  { anchorText: 'physics simulations', targetPath: '/resources?subject=physics', context: 'Physics visual learning' },
  { anchorText: 'previous year questions', targetPath: '/practice/pyq', context: 'Exam practice content' },
  { anchorText: 'spaced repetition', targetPath: '/notebook/revision', context: 'Memory/revision content' },
];

// ============================================
// CTA GENERATOR
// ============================================

export interface CTAConfig {
  type: 'primary' | 'secondary' | 'inline' | 'banner';
  text: string;
  subtext?: string;
  link: string;
  style: 'button' | 'link' | 'card';
  urgency?: string; // e.g., "Limited time offer"
}

export function generateCTAForContext(
  context: 'blog' | 'landing' | 'email' | 'social',
  feature: string,
  position: 'top' | 'middle' | 'end'
): CTAConfig {
  const featureConfig = featureMarketingConfigs[feature];
  
  if (!featureConfig) {
    return {
      type: 'primary',
      text: 'Start Learning Free',
      link: '/signup',
      style: 'button',
    };
  }

  // Different CTAs based on position
  if (position === 'top') {
    return {
      type: 'secondary',
      text: featureConfig.ctaSecondary || 'Learn More',
      link: featureConfig.portalPath,
      style: 'link',
    };
  }

  if (position === 'middle') {
    return {
      type: 'inline',
      text: `Try ${featureConfig.featureName}`,
      subtext: featureConfig.tagline,
      link: featureConfig.portalPath,
      style: 'card',
    };
  }

  // End position - strongest CTA
  return {
    type: 'primary',
    text: featureConfig.ctaText,
    subtext: 'No credit card required',
    link: '/signup?feature=' + feature,
    style: 'button',
    urgency: 'Join 10,000+ students',
  };
}

// ============================================
// SEO CONTENT GENERATOR
// ============================================

export interface SEOContent {
  title: string;
  metaDescription: string;
  h1: string;
  h2s: string[];
  keywords: string[];
  structuredData: object;
}

export function generateSEOContent(feature: string, pageType: 'landing' | 'blog' | 'feature'): SEOContent {
  const config = featureMarketingConfigs[feature];
  
  if (!config) {
    return {
      title: 'AI Tutoring for JEE & NEET | EduGenius',
      metaDescription: 'Personalized AI tutoring for JEE, NEET, and CBSE preparation. Learn smarter with adaptive technology.',
      h1: 'AI-Powered Learning for Competitive Exams',
      h2s: [],
      keywords: ['AI tutor', 'JEE preparation', 'NEET preparation'],
      structuredData: {},
    };
  }

  return {
    title: config.seoTitle,
    metaDescription: config.seoDescription,
    h1: config.featureName,
    h2s: [
      `Why ${config.featureName}?`,
      'How It Works',
      'Key Benefits',
      'What Students Say',
      'Get Started Today',
    ],
    keywords: config.keywords,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      'name': config.featureName,
      'applicationCategory': 'EducationalApplication',
      'description': config.shortDescription,
      'offers': {
        '@type': 'Offer',
        'price': '0',
        'priceCurrency': 'INR',
      },
    },
  };
}

// ============================================
// PROMPT MODIFIERS FOR AI CONTENT
// ============================================

export const contentPromptModifiers = {
  // For blog content generation
  blog: {
    tone: 'Conversational yet authoritative. Write like a friendly senior who topped exams.',
    audience: 'JEE/NEET aspirants aged 16-20, their parents, and coaching center owners.',
    goal: 'Educate while naturally showcasing EduGenius features. Never be salesy.',
    structure: 'Use short paragraphs (2-3 sentences). Include subheadings every 200 words.',
    linking: 'Include 3-5 internal links to portal features. Use natural anchor text.',
    cta: 'One soft CTA in middle, one clear CTA at end. Make them feel helpful, not pushy.',
    seo: 'Include primary keyword in first 100 words, H1, and meta description.',
    examples: 'Use specific JEE/NEET examples. Reference actual topics from syllabus.',
    avoid: 'Avoid generic advice. No clickbait. No false promises about rank improvements.',
  },
  
  // For landing page copy
  landing: {
    tone: 'Confident and benefit-focused. Every sentence should answer "what\'s in it for me?"',
    audience: 'Students actively looking for study solutions. High intent.',
    goal: 'Convert visitors to free signups. Remove friction and objections.',
    structure: 'Hero → Pain → Solution → Features → Social Proof → CTA',
    linking: 'Deep link to specific features. Make it easy to explore.',
    cta: 'Multiple CTAs with same goal, different phrasings. A/B test.',
    seo: 'Optimize for high-intent keywords: "AI tutor for JEE", "best NEET preparation".',
    avoid: 'No jargon. No feature lists without benefits. No walls of text.',
  },
  
  // For social media
  social: {
    tone: 'Casual, relatable, sometimes humorous. Speak like a friend, not a brand.',
    audience: 'Students scrolling during breaks. Low attention span.',
    goal: 'Stop the scroll. Get engagement. Drive to bio link.',
    structure: 'Hook in first line. Value in body. CTA or question at end.',
    linking: 'Use link in bio or swipe-up. Track with UTM parameters.',
    cta: 'Soft CTAs: "Link in bio if you want to try this" rather than "SIGN UP NOW"',
    seo: 'Use trending hashtags + niche hashtags. Tag relevant accounts.',
    avoid: 'Don\'t be preachy. Don\'t post only promotional content. 80% value, 20% promotion.',
  },
  
  // For email marketing
  email: {
    tone: 'Personal and helpful. Write like emailing a student you\'re mentoring.',
    audience: 'Existing users or leads. They already know us.',
    goal: 'Re-engage, educate about features, or drive specific actions.',
    structure: 'Strong subject line. One clear goal per email. P.S. for secondary CTA.',
    linking: 'Deep link to exact feature. Make clicking irresistible.',
    cta: 'One primary button CTA. Make the benefit of clicking crystal clear.',
    seo: 'N/A for email, but ensure preview text is optimized.',
    avoid: 'No long emails. No multiple goals. No "Hi there" subject lines.',
  },
};

// ============================================
// FEATURE-TO-CONTENT MAPPING
// ============================================

export interface ContentPlan {
  feature: string;
  blogPosts: BlogPostPlan[];
  landingPage: LandingPagePlan;
  socialPosts: SocialPostPlan[];
  emailSequence: EmailPlan[];
}

export interface BlogPostPlan {
  title: string;
  template: string;
  targetKeyword: string;
  internalLinks: string[];
  featureCTAs: string[];
}

export interface LandingPagePlan {
  headline: string;
  subheadline: string;
  sections: string[];
  testimonials: number;
  ctas: number;
}

export interface SocialPostPlan {
  platform: 'twitter' | 'linkedin' | 'instagram';
  angle: string;
  cta: string;
}

export interface EmailPlan {
  subject: string;
  goal: string;
  ctaText: string;
}

export function generateContentPlan(featureId: string): ContentPlan {
  const config = featureMarketingConfigs[featureId];
  
  if (!config) {
    throw new Error(`Unknown feature: ${featureId}`);
  }

  return {
    feature: featureId,
    blogPosts: config.sampleBlogTitles.map((title, i) => ({
      title,
      template: i === 0 ? 'feature_showcase' : 'tips_listicle',
      targetKeyword: config.keywords[i % config.keywords.length],
      internalLinks: [config.portalPath, '/signup', '/resources'],
      featureCTAs: [config.ctaText, config.ctaSecondary || 'Learn More'],
    })),
    landingPage: {
      headline: config.tagline,
      subheadline: config.shortDescription,
      sections: ['hero', 'pain_points', 'solution', 'features', 'how_it_works', 'testimonials', 'faq', 'cta'],
      testimonials: 3,
      ctas: 4,
    },
    socialPosts: [
      { platform: 'twitter', angle: 'Quick tip + feature mention', cta: 'Thread on more tips (link in bio)' },
      { platform: 'linkedin', angle: 'Educational insight + subtle feature', cta: 'Comment your thoughts' },
      { platform: 'instagram', angle: 'Visual/carousel showing feature', cta: 'Link in bio to try' },
    ],
    emailSequence: [
      { subject: `Have you tried ${config.featureName}?`, goal: 'Feature awareness', ctaText: 'Try it now' },
      { subject: `3 ways ${config.featureName} helps you study smarter`, goal: 'Feature education', ctaText: 'See how' },
      { subject: `Students are loving ${config.featureName}`, goal: 'Social proof', ctaText: 'Join them' },
    ],
  };
}

// ============================================
// EXPORT
// ============================================

export const MarketingIntegration = {
  featureMarketingConfigs,
  blogTemplates,
  internalLinkLibrary,
  generateCTAForContext,
  generateSEOContent,
  generateContentPlan,
  contentPromptModifiers,
};

export default MarketingIntegration;
