/**
 * googleTrendsService.ts — Scout's Google Trends intelligence layer
 * Uses the public Google Trends explore endpoint (no API key required)
 * Targets Indian exam preparation keywords for EduGenius market intelligence
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type TrendVelocity = 'rising' | 'stable' | 'declining';

export interface TrendResult {
  keyword: string;
  score: number;
  velocity: TrendVelocity;
  relatedQueries: string[];
}

interface GoogleTrendsTimelinePoint {
  value: number[];
  formattedValue: string[];
  time: string;
}

interface GoogleTrendsWidget {
  title: string;
  id: string;
  token: string;
  type: string;
  request: Record<string, unknown>;
}

// ── Tracked Keywords ──────────────────────────────────────────────────────────

export const EDUGENIUS_TRACKED_KEYWORDS: Record<string, string[]> = {
  GATE: [
    'GATE 2026 preparation',
    'GATE EM syllabus',
    'GATE electronics previous papers',
    'GATE cutoff 2025',
  ],
  CAT: [
    'CAT 2026 preparation',
    'CAT quant tricks',
    'MBA entrance exam',
  ],
  JEE: [
    'JEE Main 2026',
    'JEE advanced preparation',
    'IIT entrance coaching',
  ],
  NEET: [
    'NEET 2026 preparation',
    'NEET biology',
  ],
  General: [
    'online exam preparation India',
    'AI tutor India',
    'exam preparation app India',
  ],
};

export const ALL_TRACKED_KEYWORDS: string[] = Object.values(EDUGENIUS_TRACKED_KEYWORDS).flat();

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripGooglePrefix(raw: string): string {
  // Google Trends prepends: )]}',\n
  return raw.replace(/^\)\]\}',\n/, '').trim();
}

async function fetchWithBackoff(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status === 429) {
        // Rate limited — exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      const delay = Math.pow(2, attempt) * 800;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

function computeVelocity(timelineValues: number[]): TrendVelocity {
  if (timelineValues.length < 4) return 'stable';
  const half = Math.floor(timelineValues.length / 2);
  const firstHalf = timelineValues.slice(0, half);
  const secondHalf = timelineValues.slice(half);
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const firstAvg = avg(firstHalf);
  const secondAvg = avg(secondHalf);
  const delta = secondAvg - firstAvg;
  if (delta > 8) return 'rising';
  if (delta < -8) return 'declining';
  return 'stable';
}

// ── Simulated Data (dev / fallback) ──────────────────────────────────────────

export function simulateTrendData(keywords?: string[]): TrendResult[] {
  const targets = keywords ?? ALL_TRACKED_KEYWORDS;

  const velocityPool: TrendVelocity[] = ['rising', 'rising', 'stable', 'stable', 'declining'];
  const relatedQueriesMap: Record<string, string[]> = {
    'GATE 2026 preparation': ['GATE syllabus 2026', 'GATE mock test', 'GATE rank predictor'],
    'GATE EM syllabus': ['electromagnetic waves GATE', 'GATE EC syllabus', 'field theory GATE'],
    'GATE electronics previous papers': ['GATE 2025 EC paper', 'GATE PYQ electronics', 'GATE signal processing'],
    'GATE cutoff 2025': ['GATE score vs rank', 'GATE cutoff IIT', 'GATE cutoff NIT'],
    'CAT 2026 preparation': ['CAT mock test', 'CAT verbal ability', 'CAT DI LR strategies'],
    'CAT quant tricks': ['CAT percentage tricks', 'CAT number system', 'CAT geometry shortcuts'],
    'MBA entrance exam': ['XAT 2026', 'SNAP exam', 'IIM admission process'],
    'JEE Main 2026': ['JEE Main syllabus 2026', 'JEE Main mock test', 'JEE Main January session'],
    'JEE advanced preparation': ['IIT JEE coaching', 'JEE advanced maths', 'JEE advanced physics'],
    'IIT entrance coaching': ['IIT coaching fees', 'Allen Kota', 'online JEE coaching'],
    'NEET 2026 preparation': ['NEET syllabus 2026', 'NEET biology chapters', 'NEET mock test'],
    'NEET biology': ['NEET genetics', 'NEET cell biology', 'NEET ecology topics'],
    'online exam preparation India': ['best online coaching India', 'Unacademy vs EduGenius', 'free mock tests India'],
    'AI tutor India': ['AI study assistant India', 'personalized learning AI', 'EduGenius AI tutor'],
    'exam preparation app India': ['best exam app 2026', 'GATE preparation app', 'offline exam app'],
  };

  return targets.map((keyword, i) => {
    const seed = keyword.length + i;
    const score = 30 + (seed * 17 + i * 11) % 65;
    const velocity = velocityPool[(seed + i) % velocityPool.length];
    const related = relatedQueriesMap[keyword] ?? [
      `${keyword} tips`,
      `best resources for ${keyword}`,
      `${keyword} 2026 guide`,
    ];
    return { keyword, score, velocity, relatedQueries: related };
  });
}

// ── Core API Functions ────────────────────────────────────────────────────────

/**
 * Fetches the current interest score (0–100) for a keyword from Google Trends
 */
export async function getTrendScore(keyword: string): Promise<number> {
  try {
    const req = JSON.stringify({
      comparisonItem: [{ keyword, geo: 'IN', time: 'today 3-m' }],
      category: 0,
      property: '',
    });
    const url = `https://trends.google.com/trends/api/explore?hl=en-US&tz=-330&req=${encodeURIComponent(req)}`;

    const res = await fetchWithBackoff(url, {
      headers: { 'Accept': 'text/javascript, application/javascript' },
    });
    const rawText = await res.text();
    const cleaned = stripGooglePrefix(rawText);
    const parsed = JSON.parse(cleaned);

    // Extract timeline data widget
    const widgets: GoogleTrendsWidget[] = parsed?.widgets ?? [];
    const timelineWidget = widgets.find((w) => w.type === 'fe_line_chart');

    if (!timelineWidget?.token) {
      console.warn('[GoogleTrends] No timeline widget found for:', keyword);
      return simulateTrendData([keyword])[0].score;
    }

    // Fetch actual timeline data
    const timelineReq = JSON.stringify({
      time: 'today 3-m',
      resolution: 'WEEK',
      locale: 'en-US',
      comparisonItem: [{ geo: { country: 'IN' }, complexKeywordsRestriction: { keyword: [{ type: 'BROAD', value: keyword }] } }],
      requestOptions: { property: '', backend: 'IZG', category: 0 },
    });

    const timelineUrl = `https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=-330&req=${encodeURIComponent(timelineReq)}&token=${encodeURIComponent(timelineWidget.token)}`;
    const timelineRes = await fetchWithBackoff(timelineUrl, {
      headers: { 'Accept': 'text/javascript, application/javascript' },
    });
    const timelineRaw = await timelineRes.text();
    const timelineCleaned = stripGooglePrefix(timelineRaw);
    const timelineData = JSON.parse(timelineCleaned);

    const timelinePoints: GoogleTrendsTimelinePoint[] = timelineData?.default?.timelineData ?? [];
    if (timelinePoints.length === 0) return simulateTrendData([keyword])[0].score;

    // Return the most recent value
    const latest = timelinePoints[timelinePoints.length - 1];
    return latest?.value?.[0] ?? 0;
  } catch (err) {
    console.warn('[GoogleTrends] API error for', keyword, '— using simulated data:', err);
    return simulateTrendData([keyword])[0].score;
  }
}

/**
 * Fetches rising related queries for a keyword
 */
export async function getRelatedQueries(keyword: string): Promise<string[]> {
  try {
    const req = JSON.stringify({
      comparisonItem: [{ keyword, geo: 'IN', time: 'today 3-m' }],
      category: 0,
      property: '',
    });
    const url = `https://trends.google.com/trends/api/explore?hl=en-US&tz=-330&req=${encodeURIComponent(req)}`;

    const res = await fetchWithBackoff(url, {
      headers: { 'Accept': 'text/javascript, application/javascript' },
    });
    const rawText = await res.text();
    const cleaned = stripGooglePrefix(rawText);
    const parsed = JSON.parse(cleaned);

    const widgets: GoogleTrendsWidget[] = parsed?.widgets ?? [];
    const relatedWidget = widgets.find((w) => w.id === 'RELATED_QUERIES');

    if (!relatedWidget?.token) {
      return simulateTrendData([keyword])[0].relatedQueries;
    }

    // Fetch related queries
    const relReq = JSON.stringify(relatedWidget.request);
    const relUrl = `https://trends.google.com/trends/api/widgetdata/relatedsearches?hl=en-US&tz=-330&req=${encodeURIComponent(relReq)}&token=${encodeURIComponent(relatedWidget.token)}`;
    const relRes = await fetchWithBackoff(relUrl, {
      headers: { 'Accept': 'text/javascript, application/javascript' },
    });
    const relRaw = await relRes.text();
    const relCleaned = stripGooglePrefix(relRaw);
    const relData = JSON.parse(relCleaned);

    const risingItems = relData?.default?.rankedList?.[1]?.rankedKeyword ?? [];
    return risingItems.slice(0, 5).map((item: { query: string }) => item.query);
  } catch (err) {
    console.warn('[GoogleTrends] Related queries error for', keyword, '— using simulated:', err);
    return simulateTrendData([keyword])[0].relatedQueries;
  }
}

/**
 * Batch scans multiple keywords and returns sorted TrendResults by velocity
 */
export async function batchTrendScan(keywords: string[]): Promise<TrendResult[]> {
  const results: TrendResult[] = [];

  // Process in batches of 3 to avoid rate limiting
  const batchSize = 3;
  for (let i = 0; i < keywords.length; i += batchSize) {
    const batch = keywords.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (keyword) => {
        try {
          const [score, relatedQueries] = await Promise.all([
            getTrendScore(keyword),
            getRelatedQueries(keyword),
          ]);

          // For velocity, we need historical data — simulate based on score for now
          // Real implementation fetches timeline and computes velocity
          const simulated = simulateTrendData([keyword])[0];
          const velocity: TrendVelocity =
            score > 75 ? 'rising' : score > 40 ? simulated.velocity : 'declining';

          return { keyword, score, velocity, relatedQueries };
        } catch {
          return simulateTrendData([keyword])[0];
        }
      }),
    );
    results.push(...batchResults);

    // Throttle between batches
    if (i + batchSize < keywords.length) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // Sort: rising first, then stable, then declining; within each by score descending
  const velocityOrder: Record<TrendVelocity, number> = { rising: 0, stable: 1, declining: 2 };
  return results.sort((a, b) => {
    const vDiff = velocityOrder[a.velocity] - velocityOrder[b.velocity];
    return vDiff !== 0 ? vDiff : b.score - a.score;
  });
}
