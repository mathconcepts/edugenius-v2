/**
 * mediaContentSkill.ts — Social/Video/Ad Content Generation
 * VoltAgent pattern: AI Ads Generator + YouTube to Blog Agent.
 *
 * Generates platform-specific media content for marketing:
 *   - Instagram/LinkedIn posts (exam tips content)
 *   - YouTube video scripts (concept explanations)
 *   - WhatsApp broadcast messages
 *   - Ad copy variants (A/B testable)
 *   - Thumbnail briefs
 *   - Short-form video hooks (Reels/Shorts)
 */

import { callLLM } from '../llmService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MediaPlatform =
  | 'instagram'
  | 'linkedin'
  | 'youtube'
  | 'youtube_shorts'
  | 'whatsapp_broadcast'
  | 'google_ad'
  | 'twitter';

export interface MediaContentRequest {
  platform: MediaPlatform;
  topic: string;
  exam: string;
  angle: 'tip' | 'myth_bust' | 'success_story' | 'fear_fomo' | 'how_to' | 'comparison';
  targetAudience: 'student' | 'parent' | 'teacher';
  tone: 'inspirational' | 'practical' | 'urgent' | 'friendly' | 'authoritative';
}

export interface MediaContentResult {
  platform: MediaPlatform;
  primaryText: string;      // main caption / script
  headline?: string;        // for ads
  hook?: string;            // first 3 seconds for video
  hashtags?: string[];      // for Instagram/LinkedIn
  imagePrompt?: string;     // DALL-E prompt for accompanying visual
  variants?: string[];      // A/B test variants of primaryText
  estimatedReach?: string;  // "High", "Medium", "Low" based on platform + angle
  cta: string;              // call to action
}

// ─── Platform specs ───────────────────────────────────────────────────────────

export const PLATFORM_SPECS: Record<MediaPlatform, { maxChars: number; format: string; bestAngles: string[] }> = {
  instagram: {
    maxChars: 2200,
    format: 'caption + 30 hashtags + CTA',
    bestAngles: ['tip', 'myth_bust', 'how_to'],
  },
  linkedin: {
    maxChars: 3000,
    format: 'professional narrative + CTA + 3-5 hashtags',
    bestAngles: ['success_story', 'how_to', 'comparison'],
  },
  youtube: {
    maxChars: 5000,
    format: 'full script with hook + chapters + outro',
    bestAngles: ['how_to', 'myth_bust', 'comparison'],
  },
  youtube_shorts: {
    maxChars: 500,
    format: '60-second script: hook + 3 points + CTA',
    bestAngles: ['tip', 'myth_bust', 'fear_fomo'],
  },
  whatsapp_broadcast: {
    maxChars: 1000,
    format: 'conversational, emoji-rich, single CTA',
    bestAngles: ['tip', 'fear_fomo', 'how_to'],
  },
  google_ad: {
    maxChars: 300,
    format: 'headline (30 chars) + desc1 (90) + desc2 (90)',
    bestAngles: ['comparison', 'how_to', 'fear_fomo'],
  },
  twitter: {
    maxChars: 280,
    format: 'punchy + thread hook + hashtags',
    bestAngles: ['myth_bust', 'tip', 'fear_fomo'],
  },
};

// ─── Angle instructions ───────────────────────────────────────────────────────

const ANGLE_INSTRUCTIONS: Record<MediaContentRequest['angle'], string> = {
  tip:           'Share one powerful, specific, actionable tip students often don\'t know.',
  myth_bust:     'Identify a common myth students believe about this topic/exam and bust it with evidence.',
  success_story: 'Tell the story of how a student overcame this challenge. Make it relatable.',
  fear_fomo:     'Create urgency — what happens if they don\'t act now? What are others doing that they\'re not?',
  how_to:        'Give a clear step-by-step guide. Number the steps. Be specific.',
  comparison:    'Compare two approaches, tools, or strategies. Show why EduGenius wins.',
};

const TONE_INSTRUCTIONS: Record<MediaContentRequest['tone'], string> = {
  inspirational: 'Use emotionally resonant language. Build hope. Reference a bigger goal.',
  practical:     'Be direct and actionable. No fluff. Numbers and specifics.',
  urgent:        'Create time pressure. Use words like "now", "today", "don\'t wait".',
  friendly:      'Conversational, like a senior talking to a junior. Warm and relatable.',
  authoritative: 'Expert voice. Cite data. Confident assertions.',
};

const AUDIENCE_CONTEXT: Record<MediaContentRequest['targetAudience'], string> = {
  student: 'The reader is an Indian competitive exam student (JEE/NEET/GATE/CAT). They\'re stressed, motivated, and time-poor.',
  parent:  'The reader is a parent of an exam student. They\'re worried about their child\'s future and looking for proven solutions.',
  teacher: 'The reader is a teacher or coaching institute owner. They want to improve student outcomes and differentiate their offering.',
};

// ─── Reach estimates ─────────────────────────────────────────────────────────

function estimateReach(platform: MediaPlatform, angle: MediaContentRequest['angle']): string {
  const bestAngles = PLATFORM_SPECS[platform].bestAngles;
  if (bestAngles.includes(angle)) return 'High';
  if (platform === 'youtube' || platform === 'linkedin') return 'Medium';
  return 'Low';
}

// ─── CTA generator ────────────────────────────────────────────────────────────

function generateCTA(platform: MediaPlatform, audience: MediaContentRequest['targetAudience']): string {
  const ctas: Record<MediaPlatform, Record<MediaContentRequest['targetAudience'], string>> = {
    instagram: {
      student: '📲 Start your free trial → link in bio',
      parent:  '📲 See your child\'s personalised plan → link in bio',
      teacher: '📲 Try EduGenius for your students → link in bio',
    },
    linkedin: {
      student: 'Try EduGenius free at edugenius.app',
      parent:  'Book a demo for your child at edugenius.app',
      teacher: 'Partner with EduGenius — contact us at edugenius.app',
    },
    youtube: {
      student: 'Subscribe for daily exam tips. Start free at edugenius.app — link below 👇',
      parent:  'Watch more parent guides. Book a free consultation at edugenius.app',
      teacher: 'Subscribe for teaching resources. Partner with us at edugenius.app',
    },
    youtube_shorts: {
      student: '📱 Free trial → edugenius.app',
      parent:  '📱 Book demo → edugenius.app',
      teacher: '📱 Partner with us → edugenius.app',
    },
    whatsapp_broadcast: {
      student: '👉 Start today: edugenius.app',
      parent:  '👉 See your child\'s plan: edugenius.app',
      teacher: '👉 Upgrade your students: edugenius.app',
    },
    google_ad: {
      student: 'Start Free Trial',
      parent:  'See Your Child\'s Plan',
      teacher: 'Partner With EduGenius',
    },
    twitter: {
      student: '→ Start free: edugenius.app 🧠',
      parent:  '→ Book demo: edugenius.app',
      teacher: '→ Partner: edugenius.app',
    },
  };
  return ctas[platform]?.[audience] ?? 'Try EduGenius free → edugenius.app';
}

// ─── Image prompt generator ───────────────────────────────────────────────────

function generateImagePrompt(req: MediaContentRequest): string {
  const examVisuals: Record<string, string> = {
    GATE: 'circuit diagrams, engineering formulas on a whiteboard',
    JEE:  'physics equations, a student studying late at night with books',
    NEET: 'biology diagrams, medical textbooks, a student in a library',
    CAT:  'data charts, business graphs, a confident professional',
    UPSC: 'India map, newspaper headlines, a civil service uniform',
  };
  const examKey = Object.keys(examVisuals).find(k => req.exam.toUpperCase().includes(k)) ?? 'GATE';
  const baseVisual = examVisuals[examKey];

  const styleMap: Record<MediaPlatform, string> = {
    instagram:          'vibrant, mobile-optimised, square 1080x1080, warm gradient background',
    linkedin:           'professional, clean, white background, subtle blue tones',
    youtube:            'high-contrast thumbnail, bold text overlay, 1280x720',
    youtube_shorts:     'vertical 9:16, bright colours, minimal text',
    whatsapp_broadcast: 'simple, clear, text-friendly, 600x400',
    google_ad:          'clean product screenshot or aspirational student photo',
    twitter:            'bold, minimal, high-contrast, 1200x675',
  };

  return `${styleMap[req.platform]}. Shows ${baseVisual}. Indian student context. Aspirational mood. No faces (avoid likeness issues). Brand colour: deep blue and gold.`;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Build LLM prompt for a specific platform + angle combination.
 */
export function buildMediaContentPrompt(req: MediaContentRequest): string {
  const spec = PLATFORM_SPECS[req.platform];
  const angleInst = ANGLE_INSTRUCTIONS[req.angle];
  const toneInst = TONE_INSTRUCTIONS[req.tone];
  const audienceCtx = AUDIENCE_CONTEXT[req.targetAudience];

  return `You are Herald, EduGenius marketing agent. Create ${req.platform.replace(/_/g, ' ')} content.

AUDIENCE: ${audienceCtx}
EXAM CONTEXT: ${req.exam}
TOPIC: ${req.topic}

ANGLE: ${angleInst}
TONE: ${toneInst}

FORMAT REQUIREMENTS:
- Platform: ${req.platform}
- Format: ${spec.format}
- Max characters: ${spec.maxChars}

OUTPUT FORMAT (JSON):
{
  "primaryText": "main ${req.platform === 'youtube' ? 'script' : 'caption/body text'}",
  "headline": "${req.platform === 'google_ad' ? 'max 30 chars' : 'optional short headline'}",
  "hook": "${req.platform.includes('youtube') ? 'first 3 seconds — must grab attention' : 'optional opening hook'}",
  "hashtags": ${['instagram', 'linkedin', 'twitter'].includes(req.platform) ? '"array of relevant hashtags"' : 'null'},
  "variantA": "alternative version of primaryText",
  "variantB": "another alternative"
}

Rules:
- Do NOT exceed the character limit
- Include one specific, memorable fact about ${req.exam} to build credibility
- Always end with a call to action
- Make it feel like it was written by a human who aced ${req.exam}, not a corporation`.trim();
}

// ─── Response parser ──────────────────────────────────────────────────────────

/**
 * Parse LLM output into a structured MediaContentResult.
 */
export function parseMediaContentResponse(raw: string, platform: MediaPlatform): MediaContentResult {
  // Try JSON parse first
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        platform,
        primaryText: parsed.primaryText ?? raw.slice(0, 500),
        headline:    parsed.headline,
        hook:        parsed.hook,
        hashtags:    parsed.hashtags ?? (parsed.hashtags_array ? parsed.hashtags_array : undefined),
        imagePrompt: undefined, // Added post-parse
        variants:    [parsed.variantA, parsed.variantB].filter(Boolean),
        estimatedReach: estimateReach(platform, 'tip'), // default
        cta:         generateCTA(platform, 'student'),
      };
    }
  } catch { /* fall through to text parse */ }

  // Fallback: treat entire response as primaryText
  return {
    platform,
    primaryText: raw.trim(),
    cta: generateCTA(platform, 'student'),
    estimatedReach: 'Medium',
  };
}

// ─── Content generators ───────────────────────────────────────────────────────

/**
 * Generate structured media content via LLM.
 */
export async function generateMediaContent(req: MediaContentRequest): Promise<MediaContentResult> {
  const prompt = buildMediaContentPrompt(req);
  const cta = generateCTA(req.platform, req.targetAudience);
  const imagePrompt = generateImagePrompt(req);
  const estimatedReach = estimateReach(req.platform, req.angle);

  try {
    const response = await callLLM({
      agent: 'herald',
      message: prompt,
      intent: 'generate_content',
    });

    const result = parseMediaContentResponse(response?.text ?? '', req.platform);
    return {
      ...result,
      cta,
      imagePrompt,
      estimatedReach,
    };
  } catch {
    // Return a placeholder on failure
    return {
      platform: req.platform,
      primaryText: `[Content generation failed. Platform: ${req.platform}, Topic: ${req.topic}, Exam: ${req.exam}]`,
      cta,
      imagePrompt,
      estimatedReach: 'Low',
    };
  }
}

/**
 * Generate multiple A/B variants.
 */
export async function generateVariants(req: MediaContentRequest, count = 3): Promise<MediaContentResult[]> {
  const promises = Array.from({ length: count }, (_, i) => {
    // Vary angle slightly for each variant
    const angles: MediaContentRequest['angle'][] = ['tip', 'myth_bust', 'how_to', 'fear_fomo', 'comparison', 'success_story'];
    const variantReq: MediaContentRequest = {
      ...req,
      angle: angles[(angles.indexOf(req.angle) + i) % angles.length],
    };
    return generateMediaContent(variantReq);
  });

  return Promise.all(promises);
}

// ─── Pre-built request factories ─────────────────────────────────────────────

/**
 * Pre-built request for parent-targeting ads.
 */
export function buildParentAdCopy(exam: string, daysToExam: number): MediaContentRequest {
  const angle: MediaContentRequest['angle'] = daysToExam < 30 ? 'fear_fomo' : 'success_story';
  return {
    platform: 'google_ad',
    topic: `${exam} preparation for your child`,
    exam,
    angle,
    targetAudience: 'parent',
    tone: daysToExam < 30 ? 'urgent' : 'inspirational',
  };
}

/**
 * Pre-built request for retargeting students who visited but didn't sign up.
 */
export function buildStudentRetargetCopy(exam: string, lastTopic: string): MediaContentRequest {
  return {
    platform: 'instagram',
    topic: lastTopic,
    exam,
    angle: 'tip',
    targetAudience: 'student',
    tone: 'friendly',
  };
}

// ─── Extended format types ────────────────────────────────────────────────────

export interface XThread {
  platform: 'x_twitter';
  tweets: string[];          // 5-8 tweets, each under 280 chars
  standaloneTweet: string;
  pollOptions: string[];
  threadHook: string;        // first tweet — the hook
}

export interface RedditPost {
  platform: 'reddit';
  subreddit: string;         // e.g. 'r/GATE', 'r/JEEpreparation'
  postTitle: string;
  body: string;
  tldr: string;
  flairSuggestion: string;
}

export interface QuoraQA {
  platform: 'quora';
  question: string;
  answer: string;
  credentialsLine: string;
}

export interface InstagramStory {
  platform: 'instagram';
  caption: string;
  hashtags: string[];
  storySequence: {
    slide: number;
    text: string;
    background?: string;
    cta?: string;
  }[];
}

// ─── X Thread generator ───────────────────────────────────────────────────────

export async function generateXThread(
  topic: string,
  exam: string,
  audience: MediaContentRequest['targetAudience'],
): Promise<XThread> {
  const prompt = `You are Herald, EduGenius marketing agent. Generate a Twitter/X thread.
Topic: "${topic}" | Exam: ${exam} | Audience: ${audience}

Return JSON:
{
  "tweets": [
    "Tweet 1 — hook (under 280 chars)",
    "Tweet 2",
    "Tweet 3",
    "Tweet 4",
    "Tweet 5",
    "Tweet 6 — CTA"
  ],
  "standaloneTweet": "single best tweet (280 chars)",
  "pollOptions": ["Option A", "Option B", "Option C", "Option D"]
}`;

  try {
    const response = await callLLM({ agent: 'herald', message: prompt, intent: 'generate_content' });
    const raw = response?.text ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { tweets: string[]; standaloneTweet: string; pollOptions: string[] };
      return {
        platform: 'x_twitter',
        tweets: parsed.tweets ?? [],
        standaloneTweet: parsed.standaloneTweet ?? '',
        pollOptions: parsed.pollOptions ?? [],
        threadHook: parsed.tweets?.[0] ?? '',
      };
    }
  } catch { /* fall through */ }

  return {
    platform: 'x_twitter',
    tweets: [`🧵 ${topic} for ${exam} — A Thread`, 'Key concept explained.', '→ edugenius.app'],
    standaloneTweet: `Master ${topic} for ${exam} with EduGenius → edugenius.app`,
    pollOptions: ['Very important', 'Somewhat', 'Not sure', 'Not important'],
    threadHook: `🧵 ${topic} for ${exam} — A Thread`,
  };
}

// ─── Reddit post generator ────────────────────────────────────────────────────

const EXAM_SUBREDDIT_MAP: Record<string, string> = {
  GATE: 'r/GATE',
  JEE: 'r/JEEpreparation',
  NEET: 'r/NEET',
  CAT: 'r/MBA',
  UPSC: 'r/UPSC',
  CBSE: 'r/CBSE',
};

export async function generateRedditPost(
  topic: string,
  exam: string,
  audience: MediaContentRequest['targetAudience'],
): Promise<RedditPost> {
  const subreddit = EXAM_SUBREDDIT_MAP[exam.toUpperCase()] ?? 'r/IndianStudents';

  const prompt = `You are Herald, EduGenius marketing agent. Generate a Reddit post for ${subreddit}.
Topic: "${topic}" | Exam: ${exam} | Audience: ${audience}

Guidelines: value-first, no promotional language, genuinely helpful.

Return JSON:
{
  "postTitle": "post title (max 300 chars)",
  "body": "post body in markdown (400-600 words)",
  "tldr": "TL;DR (2 sentences)",
  "flairSuggestion": "post flair (e.g. Tips, Resource, Discussion)"
}`;

  try {
    const response = await callLLM({ agent: 'herald', message: prompt, intent: 'generate_content' });
    const raw = response?.text ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as Omit<RedditPost, 'platform' | 'subreddit'>;
      return { platform: 'reddit', subreddit, ...parsed };
    }
  } catch { /* fall through */ }

  return {
    platform: 'reddit', subreddit,
    postTitle: `[Study Notes] ${topic} — ${exam} prep resource`,
    body: `Sharing notes on ${topic} for ${exam} aspirants. Hope this helps the community.`,
    tldr: `Study ${topic} systematically. EduGenius has free resources.`,
    flairSuggestion: 'Resource',
  };
}

// ─── Quora Q&A generator ──────────────────────────────────────────────────────

export async function generateQuoraQA(
  topic: string,
  exam: string,
  audience: MediaContentRequest['targetAudience'],
): Promise<QuoraQA> {
  const prompt = `You are Herald, EduGenius expert. Generate a Quora Q&A.
Topic: "${topic}" | Exam: ${exam} | Audience: ${audience}

Return JSON:
{
  "question": "a genuine question a student would ask on Quora",
  "answer": "detailed expert answer (600-800 words) with sections, examples, and actionable advice",
  "credentialsLine": "1-line credentials (e.g. 'GATE AIR 47 | Mentored 5000+ students at EduGenius')"
}`;

  try {
    const response = await callLLM({ agent: 'herald', message: prompt, intent: 'generate_content' });
    const raw = response?.text ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as Omit<QuoraQA, 'platform'>;
      return { platform: 'quora', ...parsed };
    }
  } catch { /* fall through */ }

  return {
    platform: 'quora',
    question: `How do I master ${topic} for ${exam}?`,
    answer: `${topic} is a critical topic for ${exam}. Here is a systematic approach...`,
    credentialsLine: `${exam} expert at EduGenius | Mentored 10,000+ aspirants`,
  };
}

// ─── Instagram story generator ────────────────────────────────────────────────

export async function generateInstagramStory(
  topic: string,
  exam: string,
  audience: MediaContentRequest['targetAudience'],
): Promise<InstagramStory> {
  const prompt = `You are Herald, EduGenius marketing agent. Generate an Instagram content set.
Topic: "${topic}" | Exam: ${exam} | Audience: ${audience}

Return JSON:
{
  "caption": "Instagram caption (150-200 words, emoji-rich, value-first)",
  "hashtags": ["#tag1", "#tag2", ...up to 30 hashtags],
  "storySequence": [
    {"slide": 1, "text": "hook/question", "background": "gradient suggestion", "cta": null},
    {"slide": 2, "text": "value/insight"},
    {"slide": 3, "text": "CTA slide", "cta": "Follow + link in bio"}
  ]
}`;

  try {
    const response = await callLLM({ agent: 'herald', message: prompt, intent: 'generate_content' });
    const raw = response?.text ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as Omit<InstagramStory, 'platform'>;
      return { platform: 'instagram', ...parsed };
    }
  } catch { /* fall through */ }

  return {
    platform: 'instagram',
    caption: `📚 ${topic} tips for ${exam}! Save this for your revision. 🔥\n\n#${exam}prep #ExamPrep #EduGenius`,
    hashtags: [`#${exam}`, '#ExamPrep', '#StudyTips', '#EduGenius'],
    storySequence: [
      { slide: 1, text: `Did you know this about ${topic}? 👇`, background: 'blue gradient' },
      { slide: 2, text: `Key insight: master this concept to boost your ${exam} score.` },
      { slide: 3, text: 'Get your free study plan at EduGenius!', cta: 'Link in bio 👆' },
    ],
  };
}
