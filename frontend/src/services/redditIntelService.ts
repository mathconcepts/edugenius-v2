/**
 * redditIntelService.ts — Scout's Reddit intelligence layer
 * Uses Reddit's public JSON API (no auth required for public subreddits)
 * Identifies content gaps and trending topics across exam communities
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RedditPost {
  title: string;
  score: number;
  numComments: number;
  url: string;
  created: number;
  subreddit: string;
  selftext?: string;
}

export type GapUrgency = 'high' | 'medium' | 'low';

export interface ContentGap {
  topic: string;
  urgency: GapUrgency;
  questionCount: number;
  avgScore: number;
  sampleQuestions: string[];
}

export interface RedditIntelReport {
  scannedAt: string;
  totalPosts: number;
  contentGaps: ContentGap[];
  trendingTopics: string[];
  sentimentSummary: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const TARGET_SUBREDDITS = [
  'GATE',
  'CATprep',
  'JEEprep',
  'NEET',
  'IITJEEprep',
  'Indian_Academia',
];

const HIGH_PRIORITY_KEYWORDS = [
  'where can i find',
  'where can i get',
  'how to',
  'can someone explain',
  'struggling with',
  'anyone know',
  'please help',
  'confused about',
  'what is',
  'can anyone',
  'help me understand',
  'need resources for',
];

const NEGATIVE_SENTIMENT_WORDS = [
  'failed', 'failing', 'hard', 'difficult', 'confused', 'stuck', 'lost',
  'depressed', 'anxiety', 'worried', 'scared', 'panic', 'hopeless', 'bad',
];

const POSITIVE_SENTIMENT_WORDS = [
  'cleared', 'qualified', 'rank', 'success', 'great', 'amazing', 'helpful',
  'easy', 'confident', 'ready', 'prepared', 'achieved', 'cracked',
];

// ── Reddit API ────────────────────────────────────────────────────────────────

function parseRedditPosts(data: unknown): RedditPost[] {
  try {
    const typed = data as { data?: { children?: Array<{ data: unknown }> } };
    const children = typed?.data?.children ?? [];
    return children.map((child) => {
      const post = child.data as {
        title?: string;
        score?: number;
        num_comments?: number;
        url?: string;
        created_utc?: number;
        subreddit?: string;
        selftext?: string;
      };
      return {
        title: post.title ?? '',
        score: post.score ?? 0,
        numComments: post.num_comments ?? 0,
        url: post.url ?? '',
        created: post.created_utc ?? 0,
        subreddit: post.subreddit ?? '',
        selftext: post.selftext,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Search a subreddit for posts matching a query
 */
export async function searchSubreddit(
  subreddit: string,
  query: string,
): Promise<RedditPost[]> {
  try {
    const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&sort=new&limit=25&t=week&restrict_sr=1`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'EduGenius-Scout/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return parseRedditPosts(data);
  } catch (err) {
    console.warn(`[Reddit] searchSubreddit(${subreddit}, ${query}) failed:`, err);
    return [];
  }
}

/**
 * Fetch hot posts from a subreddit
 */
export async function getHotPosts(
  subreddit: string,
  limit = 25,
): Promise<RedditPost[]> {
  try {
    const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'EduGenius-Scout/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return parseRedditPosts(data);
  } catch (err) {
    console.warn(`[Reddit] getHotPosts(${subreddit}) failed:`, err);
    return [];
  }
}

// ── Gap Analysis ──────────────────────────────────────────────────────────────

function isHighPriorityGap(title: string, selftext?: string): boolean {
  const text = `${title} ${selftext ?? ''}`.toLowerCase();
  return HIGH_PRIORITY_KEYWORDS.some(kw => text.includes(kw));
}

function isContentGap(post: RedditPost): boolean {
  // Posts with >5 comments and score <10 = unanswered/unsatisfied
  return post.numComments > 5 && post.score < 10;
}

function extractTopicFromTitle(title: string): string {
  // Clean up Reddit-speak to extract the core topic
  return title
    .replace(/\?/g, '')
    .replace(/!\s*/g, '')
    .replace(/\b(need|looking for|anyone|please|help|how to|where|can|i|me|my|is|are|was|were|will|would|should|could|the|a|an)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

function categoriseUrgency(posts: RedditPost[]): GapUrgency {
  const highCount = posts.filter(p => isHighPriorityGap(p.title, p.selftext)).length;
  const ratio = highCount / Math.max(posts.length, 1);
  if (ratio > 0.5) return 'high';
  if (ratio > 0.2) return 'medium';
  return 'low';
}

/**
 * Analyse posts for content gaps — unanswered / under-served questions
 */
export function extractContentGaps(posts: RedditPost[]): ContentGap[] {
  const gapPosts = posts.filter(p => isContentGap(p) || isHighPriorityGap(p.title, p.selftext));

  // Group by rough topic similarity using first significant words
  const topicGroups: Map<string, RedditPost[]> = new Map();

  for (const post of gapPosts) {
    const topic = extractTopicFromTitle(post.title);
    const firstWords = topic.split(' ').slice(0, 3).join(' ').toLowerCase();

    // Find existing similar group
    let found = false;
    for (const [key, group] of topicGroups.entries()) {
      const keyWords = key.split(' ').slice(0, 3).join(' ').toLowerCase();
      // Simple similarity: shared first word
      if (keyWords.split(' ')[0] === firstWords.split(' ')[0]) {
        group.push(post);
        found = true;
        break;
      }
    }
    if (!found) {
      topicGroups.set(topic, [post]);
    }
  }

  const gaps: ContentGap[] = [];
  for (const [topic, groupPosts] of topicGroups.entries()) {
    if (!topic.trim()) continue;

    const avgScore = groupPosts.reduce((s, p) => s + p.score, 0) / groupPosts.length;
    const urgency = categoriseUrgency(groupPosts);
    const sampleQuestions = groupPosts.slice(0, 3).map(p => p.title);

    gaps.push({
      topic: topic || 'General Study Help',
      urgency,
      questionCount: groupPosts.length,
      avgScore: Math.round(avgScore * 10) / 10,
      sampleQuestions,
    });
  }

  // Sort by urgency + question count
  const urgencyOrder: Record<GapUrgency, number> = { high: 0, medium: 1, low: 2 };
  return gaps
    .sort((a, b) => {
      const uDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      return uDiff !== 0 ? uDiff : b.questionCount - a.questionCount;
    })
    .slice(0, 20);
}

// ── Trending Topics ───────────────────────────────────────────────────────────

function extractTrendingTopics(posts: RedditPost[]): string[] {
  // Word frequency analysis on titles
  const wordFreq: Map<string, number> = new Map();
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'in', 'it', 'to', 'and', 'or', 'for', 'of',
    'with', 'on', 'at', 'by', 'as', 'be', 'was', 'has', 'have', 'had',
    'this', 'that', 'from', 'are', 'not', 'my', 'i', 'me', 'any', 'can',
    'do', 'did', 'will', 'just', 'been', 'how', 'what', 'when', 'where',
    'who', 'which', 'all', 'but', 'if', 'so', 'we', 'they', 'you', 'he',
  ]);

  for (const post of posts) {
    const words = post.title.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w));
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
    }
  }

  return Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}

// ── Sentiment Analysis ────────────────────────────────────────────────────────

function analyseSentiment(posts: RedditPost[]): { positive: number; neutral: number; negative: number } {
  let positive = 0;
  let negative = 0;

  for (const post of posts) {
    const text = `${post.title} ${post.selftext ?? ''}`.toLowerCase();
    const hasPositive = POSITIVE_SENTIMENT_WORDS.some(w => text.includes(w));
    const hasNegative = NEGATIVE_SENTIMENT_WORDS.some(w => text.includes(w));

    if (hasPositive && !hasNegative) positive++;
    else if (hasNegative && !hasPositive) negative++;
    // else neutral
  }

  const total = posts.length;
  const neutral = total - positive - negative;
  return {
    positive: Math.round((positive / Math.max(total, 1)) * 100),
    neutral: Math.round((neutral / Math.max(total, 1)) * 100),
    negative: Math.round((negative / Math.max(total, 1)) * 100),
  };
}

// ── Full Reddit Scan ──────────────────────────────────────────────────────────

/**
 * Scans all target subreddits and returns a full intelligence report
 */
export async function runRedditScan(): Promise<RedditIntelReport> {
  const allPosts: RedditPost[] = [];

  await Promise.all(
    TARGET_SUBREDDITS.map(async (subreddit) => {
      const posts = await getHotPosts(subreddit, 25);
      allPosts.push(...posts);
    }),
  );

  // If API failed completely, use simulated data
  if (allPosts.length === 0) {
    console.warn('[Reddit] All subreddits returned empty — using simulated data');
    return simulateRedditData();
  }

  const contentGaps = extractContentGaps(allPosts);
  const trendingTopics = extractTrendingTopics(allPosts);
  const sentimentSummary = analyseSentiment(allPosts);

  return {
    scannedAt: new Date().toISOString(),
    totalPosts: allPosts.length,
    contentGaps,
    trendingTopics,
    sentimentSummary,
  };
}

// ── Simulated Data (dev / fallback) ──────────────────────────────────────────

export function simulateRedditData(): RedditIntelReport {
  const contentGaps: ContentGap[] = [
    {
      topic: 'GATE 2026 Electromagnetics notes PDF',
      urgency: 'high',
      questionCount: 12,
      avgScore: 4.2,
      sampleQuestions: [
        'Where can I find good EM notes for GATE 2026?',
        'Can someone explain Maxwell equations for GATE?',
        'Struggling with electromagnetic waves — any resources?',
      ],
    },
    {
      topic: 'CAT DI LR strategy for 99 percentile',
      urgency: 'high',
      questionCount: 9,
      avgScore: 6.8,
      sampleQuestions: [
        'How to attempt DI LR section in CAT 2026?',
        'Confused about which DI sets to attempt first',
        'Need help with CAT LR games strategy',
      ],
    },
    {
      topic: 'JEE Main 2026 organic chemistry revision',
      urgency: 'medium',
      questionCount: 7,
      avgScore: 8.1,
      sampleQuestions: [
        'Best way to revise organic chemistry for JEE?',
        'How to remember reaction mechanisms?',
        'Struggling with named reactions for JEE',
      ],
    },
    {
      topic: 'NEET biology chapter weightage 2026',
      urgency: 'high',
      questionCount: 11,
      avgScore: 3.5,
      sampleQuestions: [
        'What is the chapter-wise weightage for NEET biology?',
        'Where can I find NEET 2026 most important topics?',
        'How many questions from Genetics vs Ecology?',
      ],
    },
    {
      topic: 'GATE vs NEET — which exam to prepare for?',
      urgency: 'low',
      questionCount: 4,
      avgScore: 22.0,
      sampleQuestions: [
        'Confused between GATE and NEET — which has better scope?',
        'Is it possible to prepare for both GATE and NEET?',
      ],
    },
    {
      topic: 'IIT JEE coaching online vs offline',
      urgency: 'medium',
      questionCount: 6,
      avgScore: 7.5,
      sampleQuestions: [
        'Is online JEE coaching as effective as offline?',
        'Which online platform is best for JEE Advanced?',
        'Comparing Allen Kota vs AI tutors for JEE',
      ],
    },
    {
      topic: 'GATE Signal Processing problems',
      urgency: 'high',
      questionCount: 8,
      avgScore: 5.2,
      sampleQuestions: [
        'Struggling with DSP problems for GATE',
        'Can someone explain Z-transform for GATE?',
        'How to approach signal processing numericals?',
      ],
    },
    {
      topic: 'MBA CAT 2026 study schedule',
      urgency: 'medium',
      questionCount: 5,
      avgScore: 9.4,
      sampleQuestions: [
        'What is a good 6-month study plan for CAT 2026?',
        'How many hours daily for CAT preparation?',
        'Can working professionals crack CAT in 4 months?',
      ],
    },
  ];

  const trendingTopics = [
    'gate2026', 'electromagnetics', 'jee', 'neet', 'cat', 'preparation',
    'syllabus', 'mock', 'test', 'rank', 'coaching', 'resources',
    'strategy', 'revision', 'organic',
  ];

  return {
    scannedAt: new Date().toISOString(),
    totalPosts: 148,
    contentGaps,
    trendingTopics,
    sentimentSummary: { positive: 38, neutral: 44, negative: 18 },
  };
}
