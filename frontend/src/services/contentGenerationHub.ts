/**
 * contentGenerationHub.ts — Multi-format Content Generation Hub
 *
 * Generates richly structured content for every channel and format:
 *   Blog, Vlog/YouTube, Short Video (Reels/Shorts/TikTok),
 *   X/Twitter Thread, Reddit, Quora, LinkedIn, Instagram, Email
 *
 * Uses callLLM() via Herald agent. All keys prefixed `edugenius_content_`.
 */

import { callLLM } from './llmService';
import type { ContentAtom } from './contentFramework';

// ─── Supported exams & audiences ─────────────────────────────────────────────

export type SupportedExam = 'GATE' | 'JEE' | 'NEET' | 'CAT' | 'UPSC' | 'CBSE';
export type ContentAudience = 'student_beginner' | 'student_intermediate' | 'student_advanced' | 'teacher' | 'parent' | 'aspirant';
export type ContentChannel =
  | 'blog'
  | 'vlog'
  | 'youtube'
  | 'short_video'
  | 'x_twitter'
  | 'reddit'
  | 'quora'
  | 'linkedin'
  | 'instagram'
  | 'email';

// ─── Output types per channel ─────────────────────────────────────────────────

export interface BlogContent {
  channel: 'blog';
  title: string;
  metaDescription: string;
  h1: string;
  outline: { h2: string; h3s: string[] }[];
  intro: string;
  sections: { heading: string; body: string }[];
  conclusion: string;
  cta: string;
  seoKeywords: string[];
}

export interface VlogContent {
  channel: 'vlog' | 'youtube';
  title: string;
  thumbnailBrief: string;
  description: string;
  timestamps: { time: string; label: string }[];
  chapters: string[];
  scriptOutline: { section: string; notes: string }[];
  pinnedComment: string;
}

export interface ShortVideoContent {
  channel: 'short_video';
  hook: string;         // first 3 seconds
  script: string;       // ~60s full script
  caption: string;
  hashtags: string[];
  ctaOverlay: string;
}

export interface XThreadContent {
  channel: 'x_twitter';
  thread: string[];     // 5-8 tweets
  standaloneTweet: string;
  pollOptions: string[];
}

export interface RedditContent {
  channel: 'reddit';
  subreddit: string;
  postTitle: string;
  body: string;
  tldr: string;
  flairSuggestion: string;
}

export interface QuoraContent {
  channel: 'quora';
  question: string;
  answer: string;
  credentialsLine: string;
}

export interface LinkedInContent {
  channel: 'linkedin';
  post: string;
  articleOutline: { section: string; summary: string }[];
}

export interface InstagramContent {
  channel: 'instagram';
  caption: string;
  hashtags: string[];
  storySequence: { slide: number; text: string; cta?: string }[];
}

export interface EmailContent {
  channel: 'email';
  subject: string;
  previewText: string;
  body: string;
  cta: string;
}

export type GeneratedContent =
  | BlogContent
  | VlogContent
  | ShortVideoContent
  | XThreadContent
  | RedditContent
  | QuoraContent
  | LinkedInContent
  | InstagramContent
  | EmailContent;

// ─── Request ──────────────────────────────────────────────────────────────────

export interface ContentGenerationRequest {
  exam: SupportedExam;
  topic: string;
  channel: ContentChannel;
  audience: ContentAudience;
  tone?: 'inspiring' | 'educational' | 'conversational' | 'urgent' | 'professional';
  atom?: ContentAtom;   // optionally seed from existing atom
}

// ─── Exam subreddit map ───────────────────────────────────────────────────────

const EXAM_SUBREDDIT: Record<SupportedExam, string> = {
  GATE: 'r/GATE',
  JEE:  'r/JEEpreparation',
  NEET: 'r/NEET',
  CAT:  'r/MBA',
  UPSC: 'r/UPSC',
  CBSE: 'r/CBSE',
};

// ─── Audience descriptions ────────────────────────────────────────────────────

const AUDIENCE_DESC: Record<ContentAudience, string> = {
  student_beginner:     'beginner student just starting out with this exam',
  student_intermediate: 'intermediate student who has covered basics and wants deeper understanding',
  student_advanced:     'advanced student preparing for final stretch of exam prep',
  teacher:              'teacher or tutor who prepares students for this exam',
  parent:               'parent of a student preparing for this exam',
  aspirant:             'working professional or fresh graduate who is an aspirant',
};

// ─── Prompt builders ──────────────────────────────────────────────────────────

function baseContext(req: ContentGenerationRequest): string {
  const audienceDesc = AUDIENCE_DESC[req.audience];
  return `Exam: ${req.exam} | Topic: ${req.topic} | Audience: ${audienceDesc} | Tone: ${req.tone ?? 'educational'}`;
}

function buildBlogPrompt(req: ContentGenerationRequest): string {
  return `You are Atlas, EduGenius content agent. Generate a complete SEO blog post.
${baseContext(req)}

Return JSON with exactly this structure:
{
  "title": "compelling SEO title",
  "metaDescription": "155-char meta description",
  "h1": "page H1 heading",
  "outline": [{"h2": "section heading", "h3s": ["sub-heading 1", "sub-heading 2"]}],
  "intro": "2-paragraph intro hook",
  "sections": [
    {"heading": "Section 1", "body": "300-word body"},
    {"heading": "Section 2", "body": "300-word body"},
    {"heading": "Section 3", "body": "300-word body"}
  ],
  "conclusion": "strong concluding paragraph",
  "cta": "call to action line",
  "seoKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`;
}

function buildVlogPrompt(req: ContentGenerationRequest): string {
  return `You are Atlas, EduGenius content agent. Generate a complete YouTube/Vlog content package.
${baseContext(req)}

Return JSON:
{
  "title": "YouTube video title (click-worthy, 60 chars)",
  "thumbnailBrief": "description of thumbnail visual design",
  "description": "full YouTube description with keywords (300 words)",
  "timestamps": [{"time": "0:00", "label": "Introduction"}, {"time": "2:30", "label": "section"}],
  "chapters": ["Chapter 1: ...", "Chapter 2: ..."],
  "scriptOutline": [{"section": "Intro", "notes": "what to say here"}, ...],
  "pinnedComment": "pinned first comment text with links"
}`;
}

function buildShortVideoPrompt(req: ContentGenerationRequest): string {
  return `You are Atlas, EduGenius content agent. Generate a short-form video script (Reels/Shorts/TikTok).
${baseContext(req)}

Return JSON:
{
  "hook": "opening 3 seconds — punchy, pattern-interrupting line",
  "script": "full 60-second spoken script with stage directions [PAUSE], [SHOW TEXT]",
  "caption": "social caption (150 chars)",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", ...up to 15],
  "ctaOverlay": "text overlay for CTA at end of video"
}`;
}

function buildXThreadPrompt(req: ContentGenerationRequest): string {
  return `You are Atlas, EduGenius content agent. Generate a Twitter/X thread.
${baseContext(req)}

Return JSON:
{
  "thread": [
    "Tweet 1 (hook — under 280 chars)",
    "Tweet 2",
    "Tweet 3",
    "Tweet 4",
    "Tweet 5",
    "Tweet 6 (CTA + link)",
    "Tweet 7 (optional)",
    "Tweet 8 (optional)"
  ],
  "standaloneTweet": "single best tweet standalone version (280 chars)",
  "pollOptions": ["Option A", "Option B", "Option C", "Option D"]
}
Each tweet under 280 characters.`;
}

function buildRedditPrompt(req: ContentGenerationRequest): string {
  const subreddit = EXAM_SUBREDDIT[req.exam];
  return `You are Atlas, EduGenius content agent. Generate a Reddit post for ${subreddit}.
${baseContext(req)}

Return JSON:
{
  "subreddit": "${subreddit}",
  "postTitle": "compelling Reddit post title (under 300 chars)",
  "body": "detailed post body in markdown (400-600 words, value-first, not promotional)",
  "tldr": "TL;DR: 2-sentence summary",
  "flairSuggestion": "suggested post flair (e.g. Tips, Resource, Discussion)"
}`;
}

function buildQuoraPrompt(req: ContentGenerationRequest): string {
  return `You are Atlas, EduGenius content agent. Generate a Quora question and expert answer.
${baseContext(req)}

Return JSON:
{
  "question": "a question a real student would ask about this topic on Quora",
  "answer": "detailed, expert answer (600-800 words) with sub-headings, examples, and actionable advice",
  "credentialsLine": "1-line credentials disclaimer (e.g. 'GATE AIR 47, now helping 10k+ students...')"
}`;
}

function buildLinkedInPrompt(req: ContentGenerationRequest): string {
  return `You are Atlas, EduGenius content agent. Generate LinkedIn content.
${baseContext(req)}

Return JSON:
{
  "post": "LinkedIn post (300-500 words), professional, story-driven, with line breaks for readability. Include 3-5 hashtags at the end.",
  "articleOutline": [
    {"section": "Introduction", "summary": "what this section covers"},
    {"section": "Section 2", "summary": "..."},
    {"section": "Conclusion", "summary": "..."}
  ]
}`;
}

function buildInstagramPrompt(req: ContentGenerationRequest): string {
  return `You are Atlas, EduGenius content agent. Generate Instagram content.
${baseContext(req)}

Return JSON:
{
  "caption": "Instagram caption (150-200 words, emoji-rich, hook in first line)",
  "hashtags": ["#tag1", "#tag2", ...up to 30 hashtags],
  "storySequence": [
    {"slide": 1, "text": "Slide 1 content (hook/question)", "cta": null},
    {"slide": 2, "text": "Slide 2 content (value/tip)"},
    {"slide": 3, "text": "Slide 3 content (CTA)", "cta": "Swipe up / Link in bio"}
  ]
}`;
}

function buildEmailPrompt(req: ContentGenerationRequest): string {
  return `You are Atlas, EduGenius content agent. Generate an email newsletter.
${baseContext(req)}

Return JSON:
{
  "subject": "email subject line (under 60 chars, curiosity-driven)",
  "previewText": "preview text (under 100 chars, teases the main value)",
  "body": "full email body in markdown (400-600 words, sections with H2s, warm and direct tone)",
  "cta": "primary CTA text + URL placeholder"
}`;
}

// ─── Prompt dispatcher ────────────────────────────────────────────────────────

function buildPrompt(req: ContentGenerationRequest): string {
  switch (req.channel) {
    case 'blog':        return buildBlogPrompt(req);
    case 'vlog':
    case 'youtube':     return buildVlogPrompt(req);
    case 'short_video': return buildShortVideoPrompt(req);
    case 'x_twitter':   return buildXThreadPrompt(req);
    case 'reddit':      return buildRedditPrompt(req);
    case 'quora':       return buildQuoraPrompt(req);
    case 'linkedin':    return buildLinkedInPrompt(req);
    case 'instagram':   return buildInstagramPrompt(req);
    case 'email':       return buildEmailPrompt(req);
    default:            return buildBlogPrompt(req);
  }
}

// ─── Fallback content ─────────────────────────────────────────────────────────

function buildFallback(req: ContentGenerationRequest): GeneratedContent {
  const base = { exam: req.exam, topic: req.topic };
  switch (req.channel) {
    case 'blog': return {
      channel: 'blog', title: `${base.topic} — Complete ${base.exam} Guide`,
      metaDescription: `Master ${base.topic} for ${base.exam}. Expert tips, practice questions, and study strategies.`,
      h1: `${base.topic} for ${base.exam}: Everything You Need to Know`,
      outline: [{ h2: 'What is ' + base.topic, h3s: ['Definition', 'Key Concepts'] }],
      intro: `[Content generation pending. Topic: ${base.topic}, Exam: ${base.exam}]`,
      sections: [{ heading: 'Core Concepts', body: '[Generated body]' }],
      conclusion: '[Conclusion pending]', cta: 'Start your free trial at EduGenius',
      seoKeywords: [base.topic, base.exam, 'exam prep', 'study guide'],
    };
    case 'x_twitter': return {
      channel: 'x_twitter',
      thread: [`🧵 ${base.topic} for ${base.exam} — Thread`, `[Content pending]`, `→ edugenius.app`],
      standaloneTweet: `Master ${base.topic} for ${base.exam} with EduGenius → edugenius.app`,
      pollOptions: ['Option A', 'Option B', 'Option C', 'Option D'],
    };
    case 'reddit': return {
      channel: 'reddit', subreddit: EXAM_SUBREDDIT[req.exam],
      postTitle: `[Study Notes] ${base.topic} — ${base.exam} prep`,
      body: `[Content pending]`, tldr: `Study ${base.topic} systematically.`, flairSuggestion: 'Resource',
    };
    case 'quora': return {
      channel: 'quora', question: `How do I master ${base.topic} for ${base.exam}?`,
      answer: `[Answer pending]`, credentialsLine: `${base.exam} expert at EduGenius`,
    };
    case 'linkedin': return {
      channel: 'linkedin', post: `[LinkedIn post pending — ${base.topic} / ${base.exam}]`,
      articleOutline: [{ section: 'Introduction', summary: 'Overview' }],
    };
    case 'instagram': return {
      channel: 'instagram', caption: `📚 ${base.topic} tips for ${base.exam}! 🔥`,
      hashtags: [`#${base.exam}`, '#ExamPrep', '#EduGenius'],
      storySequence: [
        { slide: 1, text: `Did you know this about ${base.topic}?` },
        { slide: 2, text: 'Here is the key insight:' },
        { slide: 3, text: 'Try EduGenius free!', cta: 'Link in bio' },
      ],
    };
    case 'email': return {
      channel: 'email', subject: `${base.topic} mastery in 7 days`,
      previewText: `Your ${base.exam} prep just got easier`,
      body: `[Email body pending]`, cta: 'Start free → edugenius.app',
    };
    case 'short_video': return {
      channel: 'short_video',
      hook: `Stop! If you're preparing for ${base.exam}, you need to hear this...`,
      script: `[60-second script pending for ${base.topic}]`,
      caption: `${base.topic} tip for ${base.exam} 🚀`,
      hashtags: [`#${base.exam}`, '#ExamPrep', '#Shorts'],
      ctaOverlay: 'Follow for daily tips!',
    };
    default: return {
      channel: 'vlog', title: `${base.topic} — ${base.exam} Explained`,
      thumbnailBrief: 'Bold text on clean background',
      description: `[Description pending]`,
      timestamps: [{ time: '0:00', label: 'Introduction' }],
      chapters: ['Chapter 1: Introduction'],
      scriptOutline: [{ section: 'Intro', notes: 'Hook the viewer' }],
      pinnedComment: 'Resources in description! 👇',
    };
  }
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseResponse(raw: string, req: ContentGenerationRequest): GeneratedContent {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return buildFallback(req);
    const parsed = JSON.parse(jsonMatch[0]);
    // Attach channel tag
    return { channel: req.channel, ...parsed } as GeneratedContent;
  } catch {
    return buildFallback(req);
  }
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateContent(req: ContentGenerationRequest): Promise<GeneratedContent> {
  const prompt = buildPrompt(req);

  try {
    const response = await callLLM({
      agent: 'atlas',
      message: prompt,
      intent: 'generate_content',
    });
    return parseResponse(response?.text ?? '', req);
  } catch {
    return buildFallback(req);
  }
}

// ─── Batch generator ──────────────────────────────────────────────────────────

export async function generateAllChannels(
  exam: SupportedExam,
  topic: string,
  audience: ContentAudience,
  channels: ContentChannel[] = ['blog', 'x_twitter', 'instagram', 'email', 'reddit'],
): Promise<Map<ContentChannel, GeneratedContent>> {
  const results = new Map<ContentChannel, GeneratedContent>();
  await Promise.all(
    channels.map(async channel => {
      const content = await generateContent({ exam, topic, channel, audience });
      results.set(channel, content);
    })
  );
  return results;
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

const CACHE_KEY = 'edugenius_content_generation_cache';

export function cacheContent(key: string, content: GeneratedContent): void {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
    cache[key] = { content, ts: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* ignore */ }
}

export function getCachedContent(key: string): GeneratedContent | null {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
    const entry = cache[key];
    if (!entry) return null;
    // Expire after 24h
    if (Date.now() - entry.ts > 86400000) return null;
    return entry.content as GeneratedContent;
  } catch {
    return null;
  }
}

export function buildCacheKey(req: ContentGenerationRequest): string {
  return `${req.exam}|${req.topic}|${req.channel}|${req.audience}`;
}
