// @ts-nocheck
/**
 * Trend Collector — Daily External Signal Aggregation
 *
 * Collects trending GATE math topics from Reddit, Stack Exchange, YouTube, NewsAPI.
 * Each source is independently fallible — if one fails, others still run.
 * All API keys are optional; missing keys = skip that source silently.
 *
 * Cron endpoint: POST /api/trends/collect (Bearer CRON_SECRET)
 */

import { ServerResponse } from 'http';
import { TOPIC_KEYWORDS } from '../constants/topics';

interface ParsedRequest {
  pathname: string;
  query: URLSearchParams;
  params: Record<string, string>;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}

type RouteHandler = (req: ParsedRequest, res: ServerResponse) => Promise<void>;

interface RouteDefinition {
  method: string;
  path: string;
  handler: RouteHandler;
}

interface TrendSignal {
  source: string;
  topic_match: string | null;
  title: string;
  url: string | null;
  score: number;
  raw_data: Record<string, unknown>;
}

// ============================================================================
// Topic keyword matching
// ============================================================================

// TOPIC_KEYWORDS imported from ../constants/topics

function matchTopics(text: string): string[] {
  const lower = text.toLowerCase();
  const matches: string[] = [];
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      matches.push(topic);
    }
  }
  return matches;
}

// ============================================================================
// Database
// ============================================================================

let _pool: any = null;

function getPool() {
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('[trend-collector] DATABASE_URL not configured');
  const { Pool } = require('pg');
  _pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 30_000 });
  return _pool;
}

async function insertSignals(signals: TrendSignal[]): Promise<number> {
  if (signals.length === 0) return 0;
  const pool = getPool();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  let inserted = 0;

  for (const s of signals) {
    try {
      await pool.query(
        `INSERT INTO trend_signals (source, topic_match, title, url, score, raw_data, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [s.source, s.topic_match, s.title, s.url, s.score, JSON.stringify(s.raw_data), expiresAt]
      );
      inserted++;
    } catch (err) {
      console.warn(`[trend-collector] Insert failed for "${s.title}":`, (err as Error).message);
    }
  }
  return inserted;
}

// ============================================================================
// Collectors
// ============================================================================

async function collectReddit(): Promise<TrendSignal[]> {
  const signals: TrendSignal[] = [];
  try {
    const res = await fetch('https://www.reddit.com/r/GATE+Indian_Academia/hot.json?limit=25', {
      headers: { 'User-Agent': 'GATE-Math-Bot/1.0' },
    });
    if (!res.ok) {
      console.warn(`[trend-collector] Reddit returned ${res.status}`);
      return signals;
    }
    const data = await res.json();
    const posts = data?.data?.children || [];

    for (const post of posts) {
      const { title, url, score, selftext } = post.data || {};
      if (!title) continue;
      const searchText = `${title} ${selftext || ''}`;
      const topics = matchTopics(searchText);

      if (topics.length === 0) {
        // Still insert with null topic_match for general GATE signals
        signals.push({
          source: 'reddit',
          topic_match: null,
          title: title.slice(0, 500),
          url: url || null,
          score: score || 0,
          raw_data: { subreddit: post.data?.subreddit, created_utc: post.data?.created_utc },
        });
      } else {
        for (const topic of topics) {
          signals.push({
            source: 'reddit',
            topic_match: topic,
            title: title.slice(0, 500),
            url: url || null,
            score: score || 0,
            raw_data: { subreddit: post.data?.subreddit, created_utc: post.data?.created_utc },
          });
        }
      }
    }
    console.log(`[trend-collector] Reddit: ${signals.length} signals from ${posts.length} posts`);
  } catch (err) {
    console.warn('[trend-collector] Reddit failed:', (err as Error).message);
  }
  return signals;
}

async function collectStackExchange(): Promise<TrendSignal[]> {
  const signals: TrendSignal[] = [];
  try {
    const res = await fetch(
      'https://api.stackexchange.com/2.3/questions?order=desc&sort=hot&site=math&pagesize=25&filter=withbody',
      { headers: { 'Accept-Encoding': 'gzip' } }
    );
    if (!res.ok) {
      console.warn(`[trend-collector] Stack Exchange returned ${res.status}`);
      return signals;
    }
    const data = await res.json();
    const questions = data?.items || [];

    for (const q of questions) {
      const searchText = `${q.title || ''} ${(q.tags || []).join(' ')}`;
      const topics = matchTopics(searchText);

      for (const topic of topics) {
        signals.push({
          source: 'stackexchange',
          topic_match: topic,
          title: (q.title || '').slice(0, 500),
          url: q.link || null,
          score: q.score || 0,
          raw_data: { tags: q.tags, view_count: q.view_count, answer_count: q.answer_count },
        });
      }
    }
    console.log(`[trend-collector] Stack Exchange: ${signals.length} signals from ${questions.length} questions`);
  } catch (err) {
    console.warn('[trend-collector] Stack Exchange failed:', (err as Error).message);
  }
  return signals;
}

async function collectYouTube(): Promise<TrendSignal[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.log('[trend-collector] YouTube: skipped (YOUTUBE_API_KEY not set)');
    return [];
  }

  const signals: TrendSignal[] = [];
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=GATE+engineering+mathematics&type=video&order=date&maxResults=15&key=${encodeURIComponent(apiKey)}`
    );
    if (!res.ok) {
      console.warn(`[trend-collector] YouTube returned ${res.status}`);
      return signals;
    }
    const data = await res.json();
    const items = data?.items || [];

    for (const item of items) {
      const title = item.snippet?.title || '';
      const topics = matchTopics(title);

      for (const topic of topics) {
        signals.push({
          source: 'youtube',
          topic_match: topic,
          title: title.slice(0, 500),
          url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
          score: 1, // YouTube search doesn't return view counts in search results
          raw_data: { channelTitle: item.snippet?.channelTitle, publishedAt: item.snippet?.publishedAt },
        });
      }
    }
    console.log(`[trend-collector] YouTube: ${signals.length} signals from ${items.length} videos`);
  } catch (err) {
    console.warn('[trend-collector] YouTube failed:', (err as Error).message);
  }
  return signals;
}

async function collectNewsAPI(): Promise<TrendSignal[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    console.log('[trend-collector] NewsAPI: skipped (NEWSAPI_KEY not set)');
    return [];
  }

  const signals: TrendSignal[] = [];
  try {
    const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const res = await fetch(
      `https://newsapi.org/v2/everything?q=GATE+exam+engineering+mathematics&from=${fromDate}&sortBy=relevancy&pageSize=15&apiKey=${encodeURIComponent(apiKey)}`
    );
    if (!res.ok) {
      console.warn(`[trend-collector] NewsAPI returned ${res.status}`);
      return signals;
    }
    const data = await res.json();
    const articles = data?.articles || [];

    for (const article of articles) {
      const searchText = `${article.title || ''} ${article.description || ''}`;
      const topics = matchTopics(searchText);

      signals.push({
        source: 'newsapi',
        topic_match: topics[0] || null,
        title: (article.title || '').slice(0, 500),
        url: article.url || null,
        score: 1,
        raw_data: { source: article.source?.name, publishedAt: article.publishedAt },
      });
    }
    console.log(`[trend-collector] NewsAPI: ${signals.length} signals from ${articles.length} articles`);
  } catch (err) {
    console.warn('[trend-collector] NewsAPI failed:', (err as Error).message);
  }
  return signals;
}

// ============================================================================
// Main Collection Pipeline
// ============================================================================

async function runTrendCollection(): Promise<{ sources: Record<string, number>; total: number }> {
  // Clean expired signals first
  try {
    const pool = getPool();
    await pool.query(`DELETE FROM trend_signals WHERE expires_at < NOW()`);
  } catch (err) {
    console.warn('[trend-collector] Cleanup failed:', (err as Error).message);
  }

  // Run all collectors in parallel — each is independently fallible
  const [reddit, stackExchange, youtube, newsApi] = await Promise.all([
    collectReddit(),
    collectStackExchange(),
    collectYouTube(),
    collectNewsAPI(),
  ]);

  const allSignals = [...reddit, ...stackExchange, ...youtube, ...newsApi];

  const inserted = await insertSignals(allSignals);

  const result = {
    sources: {
      reddit: reddit.length,
      stackexchange: stackExchange.length,
      youtube: youtube.length,
      newsapi: newsApi.length,
    },
    total: inserted,
  };

  console.log(`[trend-collector] Complete: ${inserted} signals inserted`, result.sources);
  return result;
}

// ============================================================================
// Route Handler
// ============================================================================

async function handleTrendCollect(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'CRON_SECRET not configured' }));
    return;
  }

  const authHeader = (req.headers?.['authorization'] || req.headers?.['Authorization']) as string | undefined;
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  try {
    const result = await runTrendCollection();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'complete', ...result }));
  } catch (err) {
    console.error('[trend-collector] Pipeline error:', (err as Error).message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}

// ============================================================================
// Exports
// ============================================================================

export { runTrendCollection, matchTopics };
export { TOPIC_KEYWORDS } from '../constants/topics';

export const trendCollectorRoutes: RouteDefinition[] = [
  { method: 'POST', path: '/api/trends/collect', handler: handleTrendCollect },
];
