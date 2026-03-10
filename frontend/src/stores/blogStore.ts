/**
 * Blog Store — Live production state for blog content
 * AI-driven: layout, hierarchy, and featured selection are determined dynamically
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { blogAgentBridge, SEED_STRATEGY_SIGNALS } from '@/services/blogAgentBridge';
import type { StrategySignal, LayoutIntelligence, BlogPerformanceSignal } from '@/services/blogAgentBridge';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BlogStatus = 'draft' | 'review' | 'scheduled' | 'published' | 'archived';
export type BlogLayout = 'magazine' | 'grid' | 'list' | 'hero-focus' | 'minimal';
export type ContentType = 'educational' | 'exam-tips' | 'strategy' | 'success-story' | 'news' | 'comparison' | 'how-to';
export type ExamTag = 'JEE' | 'NEET' | 'CBSE_10' | 'CBSE_12' | 'CAT' | 'UPSC' | 'GATE' | 'ICSE' | 'General';

export interface BlogSection {
  type: 'heading' | 'paragraph' | 'bullets' | 'numbered' | 'callout' | 'code' | 'image' | 'cta' | 'table' | 'quote' | 'divider';
  level?: 1 | 2 | 3;           // for heading
  content: string;
  items?: string[];              // for bullets/numbered
  calloutType?: 'info' | 'warning' | 'tip' | 'success';
  ctaText?: string;
  ctaUrl?: string;
  caption?: string;
  tableHeaders?: string[];
  tableRows?: string[][];
}

export interface InternalLink {
  text: string;
  url: string;
  context: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;             // raw markdown / plain text
  sections: BlogSection[];     // structured sections (AI-parsed)
  
  // Classification
  category: string;            // AI-determined from content
  contentType: ContentType;
  examTags: ExamTag[];
  tags: string[];
  
  // Authorship
  author: string;
  authorRole?: string;
  
  // Media
  emoji: string;               // fallback icon if no image
  coverImage?: string;
  
  // AI scoring — drives layout hierarchy
  qualityScore: number;        // 0–100, AI-assessed
  engagementScore: number;     // 0–100, predicted engagement
  seoScore: number;            // 0–100
  featured: boolean;           // AI sets true if qualityScore > 80
  pinned: boolean;             // manual CEO/admin pin
  
  // SEO
  metaTitle?: string;
  metaDescription?: string;
  keywords: string[];
  internalLinks: InternalLink[];
  
  // Publishing
  status: BlogStatus;
  scheduledAt?: string;
  publishedAt?: string;
  
  // Metrics (live)
  views: number;
  shares: number;
  readTime: number;            // minutes, AI-estimated from word count
  
  // Generation metadata
  generatedByAI: boolean;
  promptTemplate?: string;
  generatedAt?: string;

  // Agent traceability
  strategySignalId?: string;                        // which signal triggered this post
  agentLineage?: import('@/services/blogAgentBridge').AgentLineage;
  strategyAlignmentScore?: number;                  // 0-100
  pendingStrategyUpdates?: string[];                 // strategy changes not yet in post

  // Performance signal (computed)
  performanceTrend?: 'rising' | 'stable' | 'declining';
  agentRecommendation?: 'amplify' | 'rewrite' | 'retire' | 'keep';

  // Chat entry URL — CTA that opens chat pre-filled for this post's topic
  chatEntryUrl?: string;  // /chat?source=blog&slug={slug}&topic={title}&exam={exam}&utm_source=blog&utm_medium=cta
  // Posts that link TO this post (backlinks from other blog posts)
  backlinkedFrom?: string[];  // array of slugs

  // Versioning
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface LayoutDecision {
  layout: BlogLayout;
  reason: string;
  heroPostId?: string;
  featuredPostIds: string[];
  categoryOrder: string[];
}

export interface GenerateRequest {
  topic: string;
  examTag: ExamTag;
  contentType: ContentType;
  targetWordCount?: number;
  keywords?: string[];
}

// ─── AI Layout Engine ─────────────────────────────────────────────────────────

function computeLayout(posts: BlogPost[]): LayoutDecision {
  const published = posts.filter(p => p.status === 'published');
  const pinnedPosts = published.filter(p => p.pinned);
  const highQuality = published.filter(p => p.qualityScore >= 80).sort((a, b) => b.qualityScore - a.qualityScore);
  const featured = published.filter(p => p.featured).sort((a, b) => b.engagementScore - a.engagementScore);

  // Determine hero post: pinned > highest quality recent
  const heroPost = pinnedPosts[0] || highQuality[0] || featured[0] || published[0];

  // Dynamic layout selection based on content volume & type
  let layout: BlogLayout;
  let reason: string;

  if (published.length === 0) {
    layout = 'minimal';
    reason = 'No published posts — show empty state';
  } else if (published.length <= 2) {
    layout = 'hero-focus';
    reason = 'Small content library — emphasize hero post';
  } else if (pinnedPosts.length > 0 || highQuality.length >= 3) {
    layout = 'magazine';
    reason = 'Rich content library with strong featured posts — magazine layout';
  } else if (published.some(p => p.contentType === 'success-story') && published.length >= 4) {
    layout = 'hero-focus';
    reason = 'Success stories drive engagement — lead with hero';
  } else if (published.length >= 6) {
    layout = 'grid';
    reason = 'Large library — grid for discoverability';
  } else {
    layout = 'grid';
    reason = 'Default grid layout';
  }

  // Category order: sort by post count desc, then alphabetical
  const categoryCounts: Record<string, number> = {};
  published.forEach(p => {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  });
  const categoryOrder = Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([cat]) => cat);

  // Featured post IDs: top 4 by combined score (excluding hero)
  const featuredPostIds = published
    .filter(p => p.id !== heroPost?.id)
    .sort((a, b) => (b.qualityScore + b.engagementScore) - (a.qualityScore + a.engagementScore))
    .slice(0, 4)
    .map(p => p.id);

  return {
    layout,
    reason,
    heroPostId: heroPost?.id,
    featuredPostIds,
    categoryOrder: ['All', ...categoryOrder],
  };
}

// ─── Parse AI-generated content into sections ─────────────────────────────────

function parseContentToSections(content: string): BlogSection[] {
  const lines = content.split('\n');
  const sections: BlogSection[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) { i++; continue; }

    // Headings
    const h1 = line.match(/^#\s+(.+)/);
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);
    if (h1) { sections.push({ type: 'heading', level: 1, content: h1[1] }); i++; continue; }
    if (h2) { sections.push({ type: 'heading', level: 2, content: h2[1] }); i++; continue; }
    if (h3) { sections.push({ type: 'heading', level: 3, content: h3[1] }); i++; continue; }

    // Horizontal rule
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      sections.push({ type: 'divider', content: '' }); i++; continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      sections.push({ type: 'quote', content: line.replace(/^>\s*/, '') }); i++; continue;
    }

    // Callout blocks: > [!TIP], > [!INFO], > [!WARNING]
    const calloutMatch = line.match(/^\[!(TIP|INFO|WARNING|SUCCESS)\]\s*(.*)/i);
    if (calloutMatch) {
      const calloutType = calloutMatch[1].toLowerCase() as BlogSection['calloutType'];
      sections.push({ type: 'callout', calloutType, content: calloutMatch[2] }); i++; continue;
    }

    // Bullet list
    if (line.match(/^[-*]\s/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().match(/^[-*]\s/)) {
        items.push(lines[i].trim().replace(/^[-*]\s/, ''));
        i++;
      }
      sections.push({ type: 'bullets', content: '', items }); continue;
    }

    // Numbered list
    if (line.match(/^\d+\.\s/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().match(/^\d+\.\s/)) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''));
        i++;
      }
      sections.push({ type: 'numbered', content: '', items }); continue;
    }

    // CTA line: [CTA: text | url]
    const ctaMatch = line.match(/^\[CTA:\s*(.+?)\s*\|\s*(.+?)\]$/);
    if (ctaMatch) {
      sections.push({ type: 'cta', content: '', ctaText: ctaMatch[1], ctaUrl: ctaMatch[2] }); i++; continue;
    }

    // Default: paragraph
    sections.push({ type: 'paragraph', content: line });
    i++;
  }

  return sections;
}

// ─── AI Generation (stub — real LLM wiring pending) ──────────────────────────
// DEBT: replace generatePostContent() with a real Atlas agent call via
//       atlasTaskService.enqueueTask() or contentGenerationService.generateContent()

function generatePostContent(req: GenerateRequest): Partial<BlogPost> {
  const wordCount = req.targetWordCount || 800;
  const readTime = Math.max(1, Math.round(wordCount / 200));

  // Scoring: AI would compute these; use sensible defaults for mock
  const qualityScore = 75 + Math.floor(Math.random() * 20);
  const engagementScore = 65 + Math.floor(Math.random() * 30);
  const seoScore = 70 + Math.floor(Math.random() * 25);

  const categoryMap: Record<ContentType, string> = {
    'educational': 'Study Guide',
    'exam-tips': req.examTag,
    'strategy': 'Strategy',
    'success-story': 'Success Stories',
    'news': 'News',
    'comparison': 'Comparison',
    'how-to': 'How To',
  };

  const emojiMap: Record<ExamTag, string> = {
    JEE: '⚗️', NEET: '🧬', CBSE_10: '📘', CBSE_12: '📗',
    CAT: '💼', UPSC: '🏛️', GATE: '🔧', ICSE: '📙', General: '📚',
  };

  const internalLinks: InternalLink[] = [
    { text: 'Try AI Tutor', url: '/chat', context: 'Get personalized help' },
    { text: 'Track your progress', url: '/progress', context: 'Monitor improvement' },
    { text: 'Practice tests', url: '/learn', context: 'Test your knowledge' },
  ];

  const content = `## Introduction

Preparing for ${req.examTag} requires a structured approach. In this guide, we'll cover everything you need to know about ${req.topic}.

## Key Concepts

Understanding the fundamentals is crucial for success. Here's what you need to focus on:

- Master the core theory before moving to applications
- Practice with previous year questions regularly
- Build a consistent study schedule

## Strategy & Approach

[!TIP] Focus on high-weightage topics first — they appear most frequently in the exam.

A systematic approach to ${req.topic} involves breaking it down into manageable chunks. Start with the conceptual foundation, then build toward application.

## Common Mistakes to Avoid

1. Skipping theory and jumping to problems
2. Not reviewing mistakes after practice tests
3. Ignoring low-weightage topics completely

## Conclusion

With the right strategy and consistent practice, mastering ${req.topic} is achievable. Start with the basics, build up progressively, and always review your weak areas.

[CTA: Start Learning Now | /learn]`;

  const slug = req.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return {
    slug: `${slug}-${req.examTag.toLowerCase()}-guide`,
    title: `${req.topic}: Complete Guide for ${req.examTag} ${new Date().getFullYear()}`,
    excerpt: `Master ${req.topic} for ${req.examTag} with our comprehensive AI-generated guide covering strategies, common mistakes, and expert tips.`,
    content,
    sections: parseContentToSections(content),
    category: categoryMap[req.contentType],
    contentType: req.contentType,
    examTags: [req.examTag],
    tags: [req.examTag, req.topic.split(' ')[0], req.contentType],
    author: 'Atlas AI',
    authorRole: 'AI Content Engine',
    emoji: emojiMap[req.examTag] || '📚',
    qualityScore,
    engagementScore,
    seoScore,
    featured: qualityScore >= 80,
    pinned: false,
    keywords: req.keywords || [req.topic, req.examTag, 'study guide'],
    internalLinks,
    readTime,
    generatedByAI: true,
    promptTemplate: 'blog_post_v2',
    generatedAt: new Date().toISOString(),
    metaTitle: `${req.topic} for ${req.examTag} - EduGenius`,
    metaDescription: `Comprehensive guide to ${req.topic} for ${req.examTag} students. Expert tips, strategies, and AI-powered learning.`,
  };
}

// ─── Default seed posts ───────────────────────────────────────────────────────

const seedPosts: BlogPost[] = [
  {
    id: 'post-1',
    slug: 'jee-main-2026-complete-strategy',
    title: 'JEE Main 2026: Complete Strategy Guide for 250+ Score',
    excerpt: 'Master the art of JEE preparation with our comprehensive guide covering time management, subject-wise tips, and last-minute strategies.',
    content: '## Introduction\n\nJEE Main 2026 preparation requires a structured 6-month plan...',
    sections: parseContentToSections(`## Introduction

JEE Main 2026 preparation requires a structured plan. This guide covers everything from syllabus analysis to last-minute revision.

## Subject-wise Priority

- **Physics:** Focus on Mechanics, Electrostatics, and Modern Physics
- **Chemistry:** Organic Chemistry and Physical Chemistry carry the most weight
- **Mathematics:** Calculus, Coordinate Geometry, and Algebra are non-negotiable

## Time Management Strategy

[!TIP] Give 40% time to your weakest subject — don't over-invest in strengths.

1. First 3 months: Complete NCERT + reference books
2. Next 2 months: Intensive practice with previous year papers
3. Last month: Full mock tests + revision

## Common Mistakes

1. Ignoring NCERT for Physics theory
2. Not tracking mock test performance
3. Studying too many reference books

[CTA: Practice with AI Tutor | /chat]`),
    category: 'JEE',
    contentType: 'strategy',
    examTags: ['JEE'],
    tags: ['JEE', 'Strategy', 'Time Management'],
    author: 'Atlas AI',
    authorRole: 'AI Content Engine',
    emoji: '📚',
    qualityScore: 92,
    engagementScore: 88,
    seoScore: 85,
    featured: true,
    pinned: true,
    keywords: ['JEE Main 2026', 'JEE strategy', 'JEE preparation'],
    internalLinks: [
      { text: 'Practice with AI Tutor', url: '/chat', context: 'Get personalized JEE help' },
      { text: 'Track your JEE progress', url: '/progress', context: 'Monitor improvement' },
    ],
    status: 'published',
    publishedAt: '2026-02-15T08:00:00Z',
    views: 4821,
    shares: 312,
    readTime: 12,
    generatedByAI: true,
    version: 1,
    createdAt: '2026-02-14T10:00:00Z',
    updatedAt: '2026-02-15T08:00:00Z',
    chatEntryUrl: '/chat?source=blog&slug=jee-main-2026-complete-strategy&topic=JEE%20Main%202026%3A%20Complete%20Strategy%20Guide%20for%20250%2B%20Score&exam=JEE&utm_source=blog&utm_medium=cta&utm_campaign=JEE',
  },
  {
    id: 'post-2',
    slug: 'neet-biology-human-physiology',
    title: 'NEET Biology: Human Physiology High-Yield Topics 2026',
    excerpt: 'Focus on what matters most. Our analysis of 10 years of NEET papers reveals the most frequently asked Human Physiology topics.',
    content: '## Introduction\n\nHuman Physiology contributes ~20% of NEET Biology...',
    sections: parseContentToSections(`## Introduction

Human Physiology consistently contributes 15–20% of NEET Biology questions. Getting this chapter right can be the difference between a good and great score.

## High-Yield Topics (must know)

- Digestion and Absorption — 3–4 questions every year
- Breathing and Exchange of Gases — always tested
- Body Fluids and Circulation — ECG interpretation is frequently asked
- Neural Control and Coordination — reflex arc diagrams

## Study Strategy

[!INFO] Use mnemonics for enzyme functions and their pH levels — they're tested frequently.

1. Read NCERT line by line — many questions are verbatim
2. Draw and label diagrams from memory
3. Practice MCQs from previous 10 years

## Common Mistakes

1. Skipping NCERT diagrams
2. Not memorizing hormone tables
3. Confusing similar processes (e.g., inspiration vs expiration)

[CTA: Ask Sage about Biology | /chat]`),
    category: 'NEET',
    contentType: 'educational',
    examTags: ['NEET'],
    tags: ['NEET', 'Biology', 'Physiology'],
    author: 'Atlas AI',
    authorRole: 'AI Content Engine',
    emoji: '🧬',
    qualityScore: 88,
    engagementScore: 82,
    seoScore: 80,
    featured: true,
    pinned: false,
    keywords: ['NEET biology', 'human physiology NEET', 'NEET 2026'],
    internalLinks: [
      { text: 'Ask Sage about Biology', url: '/chat', context: 'AI tutoring for NEET' },
    ],
    status: 'published',
    publishedAt: '2026-02-14T08:00:00Z',
    views: 3240,
    shares: 198,
    readTime: 10,
    generatedByAI: true,
    version: 1,
    createdAt: '2026-02-13T09:00:00Z',
    updatedAt: '2026-02-14T08:00:00Z',
    chatEntryUrl: '/chat?source=blog&slug=neet-biology-human-physiology&topic=NEET%20Biology%3A%20Human%20Physiology%20High-Yield%20Topics%202026&exam=NEET&utm_source=blog&utm_medium=cta&utm_campaign=NEET',
  },
  {
    id: 'post-3',
    slug: 'organic-chemistry-reaction-mechanisms',
    title: 'Organic Chemistry: Master Reaction Mechanisms in 7 Days',
    excerpt: 'Stop memorizing, start understanding. Learn the logic behind organic reactions and predict products like a pro.',
    content: '',
    sections: parseContentToSections(`## Why Mechanisms Matter

Memorizing organic reactions doesn't work long-term. Understanding the electron-pushing mechanism lets you predict any reaction product.

## The 4 Key Mechanisms

1. **SN1 and SN2** — nucleophilic substitution; learn what makes each favored
2. **E1 and E2** — elimination reactions; Zaitsev vs Hofmann products
3. **Addition reactions** — Markovnikov's rule is your friend
4. **Electrophilic Aromatic Substitution** — directing effects are testable every year

## 7-Day Study Plan

- Day 1–2: SN1 and SN2 with practice problems
- Day 3–4: Elimination reactions
- Day 5: Addition reactions
- Day 6: EAS and directing effects
- Day 7: Mixed practice, full mock chapter test

[!TIP] Always ask: Is the substrate primary, secondary, or tertiary? That determines the mechanism.

[CTA: Practice Organic Chemistry with AI | /chat]`),
    category: 'JEE',
    contentType: 'how-to',
    examTags: ['JEE', 'NEET'],
    tags: ['Chemistry', 'Organic Chemistry', 'JEE', 'NEET'],
    author: 'Atlas AI',
    authorRole: 'AI Content Engine',
    emoji: '🧪',
    qualityScore: 84,
    engagementScore: 79,
    seoScore: 78,
    featured: true,
    pinned: false,
    keywords: ['organic chemistry mechanisms', 'JEE chemistry', 'NEET chemistry'],
    internalLinks: [
      { text: 'Practice with AI', url: '/chat', context: 'Organic chemistry help' },
    ],
    status: 'published',
    publishedAt: '2026-02-13T08:00:00Z',
    views: 2890,
    shares: 156,
    readTime: 9,
    generatedByAI: true,
    version: 1,
    createdAt: '2026-02-12T09:00:00Z',
    updatedAt: '2026-02-13T08:00:00Z',
    chatEntryUrl: '/chat?source=blog&slug=organic-chemistry-reaction-mechanisms&topic=Organic%20Chemistry%3A%20Master%20Reaction%20Mechanisms%20in%207%20Days&exam=JEE&utm_source=blog&utm_medium=cta&utm_campaign=JEE',
  },
  {
    id: 'post-4',
    slug: 'student-success-story-rahul-jee-air-1247',
    title: 'How Rahul Cracked JEE with AIR 1247 Using AI Tutoring',
    excerpt: 'From struggling with Physics to securing a top rank. Rahul shares his journey and how EduGenius helped him succeed.',
    content: '',
    sections: parseContentToSections(`## Rahul's Story

Rahul was an average student from Pune who struggled with Physics. After 6 months with EduGenius, he secured AIR 1247 in JEE Main 2025.

## The Turning Point

> "I used to skip Physics. After using EduGenius's AI tutor, I started understanding WHY formulas work — not just HOW to apply them."

## What Changed

- Switched from textbook reading to Socratic AI discussions
- Identified his weak areas through progress tracking
- Used exam-prep mode 2 weeks before the exam

## Key Lessons

1. Understanding beats memorization every time
2. Consistent daily practice (even 30 minutes) compounds over months
3. Tracking mistakes is as important as solving new problems

[!SUCCESS] Rahul now helps other students through EduGenius's peer-learning feature.

[CTA: Start Your Journey | /learn]`),
    category: 'Success Stories',
    contentType: 'success-story',
    examTags: ['JEE'],
    tags: ['Success Story', 'JEE', 'AIR 1247'],
    author: 'Editorial Team',
    authorRole: 'Human Editor',
    emoji: '🏆',
    qualityScore: 90,
    engagementScore: 94,
    seoScore: 72,
    featured: true,
    pinned: false,
    keywords: ['JEE success story', 'EduGenius results', 'JEE AIR'],
    internalLinks: [
      { text: 'Start your journey', url: '/learn', context: 'Begin like Rahul' },
    ],
    status: 'published',
    publishedAt: '2026-02-12T08:00:00Z',
    views: 6120,
    shares: 489,
    readTime: 5,
    generatedByAI: false,
    version: 1,
    createdAt: '2026-02-11T09:00:00Z',
    updatedAt: '2026-02-12T08:00:00Z',
    chatEntryUrl: '/chat?source=blog&slug=student-success-story-rahul-jee-air-1247&topic=How%20Rahul%20Cracked%20JEE%20with%20AIR%201247%20Using%20AI%20Tutoring&exam=JEE&utm_source=blog&utm_medium=cta&utm_campaign=Success%20Stories',
  },
  {
    id: 'post-5',
    slug: 'cbse-board-exam-last-30-days',
    title: 'CBSE Board Exams: Last 30 Days Game Plan',
    excerpt: 'With boards around the corner, your day-by-day plan to maximize marks and reduce exam anxiety.',
    content: '',
    sections: parseContentToSections(`## Why the Last 30 Days Matter

The last month before CBSE boards is not for learning new topics — it's for consolidating what you know and closing weak gaps.

## Week-by-Week Plan

### Week 1: Assessment
Map all chapters by your confidence level: Strong / Moderate / Weak

### Week 2–3: Targeted Revision
- Strong: Quick review (1 hour each)
- Moderate: Full revision with practice problems
- Weak: Deep focus with sample papers

### Week 4: Mock Tests
- Do one full mock every day
- Analyze errors — don't just move on

[!WARNING] Don't start new topics in the last week. It increases confusion without improving scores.

## Day Before & Exam Day

- Light revision of formulas and key diagrams
- Sleep by 10 PM
- Eat a proper breakfast

[CTA: Get a personalized revision plan | /learn]`),
    category: 'CBSE',
    contentType: 'exam-tips',
    examTags: ['CBSE_10', 'CBSE_12'],
    tags: ['CBSE', 'Board Exam', 'Revision'],
    author: 'Atlas AI',
    authorRole: 'AI Content Engine',
    emoji: '📝',
    qualityScore: 81,
    engagementScore: 77,
    seoScore: 82,
    featured: false,
    pinned: false,
    keywords: ['CBSE board exam 2026', 'last month CBSE preparation'],
    internalLinks: [
      { text: 'Get a revision plan', url: '/learn', context: 'CBSE board preparation' },
    ],
    status: 'published',
    publishedAt: '2026-02-11T08:00:00Z',
    views: 1980,
    shares: 94,
    readTime: 6,
    generatedByAI: true,
    version: 1,
    createdAt: '2026-02-10T09:00:00Z',
    updatedAt: '2026-02-11T08:00:00Z',
    chatEntryUrl: '/chat?source=blog&slug=cbse-board-exam-last-30-days&topic=CBSE%20Board%20Exams%3A%20Last%2030%20Days%20Game%20Plan&exam=CBSE_12&utm_source=blog&utm_medium=cta&utm_campaign=CBSE',
  },
];

// ─── Store ────────────────────────────────────────────────────────────────────

interface BlogState {
  posts: BlogPost[];
  layout: LayoutDecision;
  isGenerating: boolean;
  generationError: string | null;
  selectedPostId: string | null;

  // Agent bridge state
  strategySignals: import('@/services/blogAgentBridge').StrategySignal[];
  layoutIntelligence: import('@/services/blogAgentBridge').LayoutIntelligence | null;

  // Computed helpers
  getPublished: () => BlogPost[];
  getBySlug: (slug: string) => BlogPost | undefined;
  getRelated: (post: BlogPost, limit?: number) => BlogPost[];

  // Actions
  addPost: (post: BlogPost) => void;
  updatePost: (id: string, updates: Partial<BlogPost>) => void;
  deletePost: (id: string) => void;
  publishPost: (id: string) => void;
  pinPost: (id: string, pinned: boolean) => void;
  archivePost: (id: string) => void;
  incrementViews: (id: string) => void;
  selectPost: (id: string | null) => void;

  // AI generation
  generatePost: (req: GenerateRequest) => Promise<BlogPost>;

  // Re-compute layout (called after any content change)
  recomputeLayout: () => void;

  // Agent bridge actions
  ingestSignal: (signal: import('@/services/blogAgentBridge').StrategySignal) => void;
  refreshLayoutIntelligence: () => void;
  getPerformanceSignals: () => import('@/services/blogAgentBridge').BlogPerformanceSignal[];
}

let postCounter = seedPosts.length + 1;

// Suppress unused-import lint for types used in interface declarations only
type _StrategySignal = StrategySignal;
type _LayoutIntelligence = LayoutIntelligence;
type _BlogPerformanceSignal = BlogPerformanceSignal;

export const useBlogStore = create<BlogState>()(
  persist(
    (set, get) => ({
      posts: seedPosts,
      layout: computeLayout(seedPosts),
      isGenerating: false,
      generationError: null,
      selectedPostId: null,

      // Agent bridge initial state
      strategySignals: SEED_STRATEGY_SIGNALS,
      layoutIntelligence: null,

      // ── Computed ──
      getPublished: () => get().posts.filter(p => p.status === 'published'),
      getBySlug: (slug) => get().posts.find(p => p.slug === slug),
      getRelated: (post, limit = 3) =>
        get().posts
          .filter(p => p.id !== post.id && p.status === 'published')
          .map(p => ({
            post: p,
            score:
              p.examTags.filter(t => post.examTags.includes(t)).length * 3 +
              p.tags.filter(t => post.tags.includes(t)).length * 2 +
              (p.category === post.category ? 2 : 0),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map(({ post: p }) => p),

      // ── Mutations ──
      addPost: (post) => {
        set(state => {
          const posts = [post, ...state.posts];
          return { posts, layout: computeLayout(posts) };
        });
      },

      updatePost: (id, updates) => {
        set(state => {
          const posts = state.posts.map(p =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          );
          return { posts, layout: computeLayout(posts) };
        });
      },

      deletePost: (id) => {
        set(state => {
          const posts = state.posts.filter(p => p.id !== id);
          return { posts, layout: computeLayout(posts) };
        });
      },

      publishPost: (id) => {
        set(state => {
          const posts = state.posts.map(p =>
            p.id === id
              ? { ...p, status: 'published' as BlogStatus, publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
              : p
          );
          return { posts, layout: computeLayout(posts) };
        });
      },

      pinPost: (id, pinned) => {
        set(state => {
          const posts = state.posts.map(p =>
            p.id === id ? { ...p, pinned, updatedAt: new Date().toISOString() } : p
          );
          return { posts, layout: computeLayout(posts) };
        });
      },

      archivePost: (id) => {
        set(state => {
          const posts = state.posts.map(p =>
            p.id === id ? { ...p, status: 'archived' as BlogStatus, updatedAt: new Date().toISOString() } : p
          );
          return { posts, layout: computeLayout(posts) };
        });
      },

      incrementViews: (id) => {
        set(state => ({
          posts: state.posts.map(p => p.id === id ? { ...p, views: p.views + 1 } : p),
        }));
      },

      selectPost: (id) => set({ selectedPostId: id }),

      // ── AI Generation ──
      generatePost: async (req) => {
        set({ isGenerating: true, generationError: null });
        try {
          // Simulate LLM latency (replace with real API call when credentials available)
          await new Promise(resolve => setTimeout(resolve, 1200));

          const generated = generatePostContent(req);
          const id = `post-${++postCounter}`;
          const now = new Date().toISOString();

          const post: BlogPost = {
            id,
            slug: generated.slug!,
            title: generated.title!,
            excerpt: generated.excerpt!,
            content: generated.content!,
            sections: generated.sections!,
            category: generated.category!,
            contentType: generated.contentType!,
            examTags: generated.examTags!,
            tags: generated.tags!,
            author: generated.author!,
            authorRole: generated.authorRole,
            emoji: generated.emoji!,
            qualityScore: generated.qualityScore!,
            engagementScore: generated.engagementScore!,
            seoScore: generated.seoScore!,
            featured: generated.featured!,
            pinned: false,
            keywords: generated.keywords!,
            internalLinks: generated.internalLinks!,
            metaTitle: generated.metaTitle,
            metaDescription: generated.metaDescription,
            status: 'draft',
            views: 0,
            shares: 0,
            readTime: generated.readTime!,
            generatedByAI: true,
            promptTemplate: generated.promptTemplate,
            generatedAt: now,
            version: 1,
            createdAt: now,
            updatedAt: now,
          };

          get().addPost(post);
          set({ isGenerating: false });
          return post;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Generation failed';
          set({ isGenerating: false, generationError: msg });
          throw err;
        }
      },

      recomputeLayout: () => {
        set(state => ({ layout: computeLayout(state.posts) }));
      },

      // ── Agent bridge actions ──
      ingestSignal: (signal) => {
        blogAgentBridge.ingestStrategySignal(signal);
        set({ strategySignals: blogAgentBridge.getPendingSignals() });
      },

      refreshLayoutIntelligence: () => {
        const state = get();
        const pending = blogAgentBridge.getPendingSignals();
        const intelligence = blogAgentBridge.computeLayoutIntelligence(state.posts, pending);
        set({ layoutIntelligence: intelligence });
      },

      getPerformanceSignals: () => {
        const published = get().posts.filter(p => p.status === 'published');
        return blogAgentBridge.broadcastPerformance(published);
      },
    }),
    {
      name: 'edugenius-blog',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        posts: state.posts,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Recompute layout after hydration
          state.layout = computeLayout(state.posts);
        }
      },
    }
  )
);

// Export helpers
export { computeLayout, parseContentToSections };
