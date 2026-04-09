// @ts-nocheck
/**
 * SEO Topic Landing Pages + Sitemap
 *
 * Server-rendered HTML pages for each GATE math topic.
 * Designed for Google indexing — JSON-LD, meta tags, auto-sitemap.
 *
 *   GET /topics/:slug     → Topic landing page
 *   GET /sitemap.xml      → Auto-generated sitemap
 */

import { ServerResponse } from 'http';
import pg from 'pg';
import { GATE_TOPICS, TOPIC_LABELS } from '../constants/topics';
const { Pool } = pg;

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Database
// ============================================================================

let _pool: any = null;

function getPool() {
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('[topic-pages] DATABASE_URL not configured');
  _pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 30_000 });
  return _pool;
}

// GATE_TOPICS, TOPIC_LABELS imported from ../constants/topics
const GATE_TOPIC_OBJECTS = GATE_TOPICS.map(id => ({ id, name: TOPIC_LABELS[id] }));

// ============================================================================
// Topic Landing Page
// ============================================================================

async function handleTopicPage(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const slug = req.params.slug;
  const topic = GATE_TOPIC_OBJECTS.find(t => t.id === slug);
  if (!topic) {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<h1>Topic not found</h1>');
    return;
  }

  const pool = getPool();

  // Get problems for this topic
  const problems = await pool.query(
    `SELECT id, question_text, difficulty, year, correct_answer
     FROM pyq_questions
     WHERE topic = $1
     ORDER BY year DESC, difficulty
     LIMIT 50`,
    [slug],
  );

  // Count by difficulty
  const diffCounts = { easy: 0, medium: 0, hard: 0 };
  for (const p of problems.rows) {
    if (p.difficulty in diffCounts) diffCounts[p.difficulty]++;
  }

  const baseUrl = process.env.APP_URL || 'https://gate-math-api.onrender.com';

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `GATE ${topic.name} Practice Problems`,
    description: `Practice ${topic.name} problems for GATE Engineering Mathematics with verified solutions.`,
    numberOfItems: problems.rows.length,
    itemListElement: problems.rows.slice(0, 20).map((p: any, i: number) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Quiz',
        name: p.question_text.slice(0, 100),
        educationalLevel: p.difficulty,
        url: `${baseUrl}/solutions/gate-${slug}-${p.id.slice(0, 8)}`,
      },
    })),
  };

  // Problem list HTML
  const problemsHtml = problems.rows.map((p: any) => {
    const diffBadge = p.difficulty === 'easy' ? '🟢' : p.difficulty === 'medium' ? '🟡' : '🔴';
    const excerpt = escapeHtml(p.question_text.slice(0, 150)) + (p.question_text.length > 150 ? '...' : '');
    return `
      <li class="problem-item">
        <span class="diff">${diffBadge} ${p.difficulty}</span>
        <span class="year">${p.year}</span>
        <p>${excerpt}</p>
      </li>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GATE ${topic.name} Practice Problems | Verified Solutions</title>
  <meta name="description" content="Practice ${problems.rows.length} verified ${topic.name} problems for GATE Engineering Mathematics. Difficulty breakdown: ${diffCounts.easy} easy, ${diffCounts.medium} medium, ${diffCounts.hard} hard.">
  <link rel="canonical" href="${baseUrl}/topics/${slug}">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 1rem; color: #1a1a1a; }
    h1 { font-size: 1.8rem; }
    .stats { display: flex; gap: 1rem; margin: 1rem 0; }
    .stat { background: #f5f5f5; padding: 0.5rem 1rem; border-radius: 8px; }
    .problem-item { border-bottom: 1px solid #eee; padding: 0.75rem 0; }
    .problem-item .diff { font-size: 0.85rem; }
    .problem-item .year { font-size: 0.8rem; color: #666; margin-left: 0.5rem; }
    .problem-item p { margin: 0.25rem 0 0; font-size: 0.95rem; }
    ul { list-style: none; padding: 0; }
    a { color: #2563eb; }
    .cta { background: #2563eb; color: white; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; display: inline-block; margin: 1rem 0; }
  </style>
</head>
<body>
  <nav><a href="/">GATE Math Practice</a> &gt; ${escapeHtml(topic.name)}</nav>
  <h1>GATE ${escapeHtml(topic.name)} Practice Problems</h1>

  <div class="stats">
    <div class="stat"><strong>${problems.rows.length}</strong> problems</div>
    <div class="stat">🟢 ${diffCounts.easy} easy</div>
    <div class="stat">🟡 ${diffCounts.medium} medium</div>
    <div class="stat">🔴 ${diffCounts.hard} hard</div>
  </div>

  <a href="/#/practice/${slug}" class="cta">Start Practicing ${escapeHtml(topic.name)}</a>

  <h2>Problems</h2>
  <ul>${problemsHtml || '<li>No problems yet. Check back soon!</li>'}</ul>

  <footer style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee; font-size: 0.85rem; color: #666;">
    <p>All solutions verified by 3-tier pipeline (RAG + AI + Wolfram Alpha)</p>
    <p><a href="/">GATE Math Practice</a> — Free GATE Engineering Mathematics preparation</p>
  </footer>
</body>
</html>`;

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  });
  res.end(html);
}

// ============================================================================
// Sitemap
// ============================================================================

async function handleSitemap(_req: ParsedRequest, res: ServerResponse): Promise<void> {
  const baseUrl = process.env.APP_URL || 'https://gate-math-api.onrender.com';

  let seoPages: any[] = [];
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT slug, updated_at FROM seo_pages ORDER BY updated_at DESC LIMIT 5000`,
    );
    seoPages = result.rows;
  } catch {
    // DB not available — generate sitemap with just static pages
  }

  const urls: string[] = [
    // Homepage
    `<url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    // Topic pages
    ...GATE_TOPIC_OBJECTS.map(t =>
      `<url><loc>${baseUrl}/topics/${t.id}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`
    ),
    // SEO solution pages
    ...seoPages.map(p =>
      `<url><loc>${baseUrl}/solutions/${p.slug}</loc><lastmod>${new Date(p.updated_at).toISOString().slice(0, 10)}</lastmod><priority>0.6</priority></url>`
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  res.writeHead(200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  });
  res.end(xml);
}

// ============================================================================
// Helpers
// ============================================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================
// Route Definitions
// ============================================================================

export const topicPageRoutes: RouteDefinition[] = [
  { method: 'GET', path: '/topics/:slug', handler: handleTopicPage },
  { method: 'GET', path: '/sitemap.xml', handler: handleSitemap },
];
