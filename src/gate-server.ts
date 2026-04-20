// @ts-nocheck
/**
 * GATE Math App — Standalone Server
 *
 * Lightweight entry point that boots only the GATE math API
 * without the full 8-agent orchestrator.
 *
 * Usage: npx tsx src/gate-server.ts
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { gateRoutes, setOrchestrator, setGeminiModel } from './api/gate-routes';
import { notebookRoutes } from './api/notebook-routes';
import { dailyProblemRoutes } from './jobs/daily-problem';
import { telegramWebhookRoutes } from './jobs/telegram-webhook';
import { flywheelRoutes, setFlywheelOrchestrator } from './jobs/content-flywheel';
import { topicPageRoutes } from './api/topic-pages';
import { streakRoutes } from './api/streak-routes';
import { adminRoutes } from './api/admin-routes';
import { chatRoutes, setChatVectorStore, setChatEmbedder } from './api/chat-routes';
import { socialRoutes } from './api/social-routes';
import { commanderRoutes } from './api/commander-routes';
import { blogRoutes } from './api/blog-routes';
import { funnelRoutes } from './api/funnel-routes';
import { notificationRoutes } from './api/notification-routes';
import { retentionRoutes } from './jobs/retention-engine';
import { trendCollectorRoutes } from './jobs/trend-collector';
import { contentPrioritizerRoutes } from './jobs/content-prioritizer';
import { feedbackScorerRoutes } from './jobs/feedback-scorer';
import { gbrainRoutes } from './gbrain/gbrain-routes';
import { geminiProxyRoutes } from './api/gemini-proxy';
import { aggregateRoutes } from './api/aggregate';
import { contentRoutes } from './api/content-routes';
import { getAuth, migrateSession } from './api/auth-middleware';
import { TieredVerificationOrchestrator } from './verification/tiered-orchestrator';
import { InMemoryVectorStore, PgVectorStore } from './data/vector-store';
import { WolframVerifier } from './verification/verifiers/wolfram';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { renderBlogPost } from './templates/blog-post';
import { renderBlogIndex } from './templates/blog-index';
import { renderExamLanding } from './templates/exam-landing';
import { renderSitemap, buildSitemapEntries } from './templates/sitemap';
import { renderRssFeed } from './templates/rss-feed';
import path from 'path';
import fs from 'fs';
import pg from 'pg';
import { autoMigrate } from './db/auto-migrate';

const ssrPool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL });

// ============================================================================
// Route matching (simplified from APIServer)
// ============================================================================

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: (req: ParsedRequest, res: ServerResponse) => Promise<void>;
}

interface ParsedRequest {
  pathname: string;
  query: URLSearchParams;
  params: Record<string, string>;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}

const routes: Route[] = [];

function registerRoute(method: string, path: string, handler: Route['handler']): void {
  const paramNames: string[] = [];
  const pattern = path.replace(/:(\w+)/g, (_match, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  routes.push({
    method: method.toUpperCase(),
    pattern: new RegExp(`^${pattern}$`),
    paramNames,
    handler,
  });
}

// Register all routes
for (const route of gateRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of dailyProblemRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of telegramWebhookRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of flywheelRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of topicPageRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of streakRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of adminRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of chatRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of socialRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of notebookRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of commanderRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of blogRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of funnelRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of notificationRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of retentionRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of trendCollectorRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of contentPrioritizerRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of feedbackScorerRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of gbrainRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of geminiProxyRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of aggregateRoutes) {
  registerRoute(route.method, route.path, route.handler);
}
for (const route of contentRoutes) {
  registerRoute(route.method, route.path, route.handler);
}

// ── SSR Routes (server-rendered HTML for SEO) ─────────────────────────────────

registerRoute('GET', '/blog/:slug', async (req, res) => {
  try {
    const result = await ssrPool.query(
      `SELECT * FROM blog_posts WHERE slug = $1 AND status = 'published'`,
      [req.params.slug]
    );
    if (result.rows.length === 0) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Post not found</h1><a href="/blog">Back to blog</a></body></html>');
      return;
    }
    // Increment view count (fire-and-forget)
    ssrPool.query('UPDATE blog_posts SET views = views + 1 WHERE id = $1', [result.rows[0].id]).catch(() => {});
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderBlogPost(result.rows[0]));
  } catch (err) {
    console.error('[ssr] Blog post error:', err);
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>Server error</h1></body></html>');
  }
});

registerRoute('GET', '/blog', async (req, res) => {
  try {
    const page = parseInt(req.query.get('page') || '1', 10);
    const topic = req.query.get('topic');
    const sort = req.query.get('sort') || 'recent';
    const contentType = req.query.get('type');
    const limit = 20;
    const offset = (page - 1) * limit;

    let where = "WHERE status = 'published'";
    const params: unknown[] = [];
    let idx = 1;
    if (topic) { where += ` AND topic = $${idx++}`; params.push(topic); }
    if (contentType) { where += ` AND content_type = $${idx++}`; params.push(contentType); }

    // Check if content_score column exists (migration may not be applied yet)
    let hasContentScore = false;
    try {
      await ssrPool.query(`SELECT content_score FROM blog_posts LIMIT 0`);
      hasContentScore = true;
    } catch { /* column doesn't exist yet */ }

    // Sort options
    const orderMap: Record<string, string> = {
      recent: 'published_at DESC NULLS LAST',
      trending: hasContentScore
        ? 'content_score DESC NULLS LAST, published_at DESC NULLS LAST'
        : 'views DESC NULLS LAST, published_at DESC NULLS LAST',
      views: 'views DESC NULLS LAST',
    };
    const orderBy = orderMap[sort] || orderMap.recent;

    const countResult = await ssrPool.query(`SELECT COUNT(*) FROM blog_posts ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(total / limit);

    const scoreCol = hasContentScore ? ', content_score' : '';
    const result = await ssrPool.query(
      `SELECT id, slug, title, excerpt, content_type, topic, exam_tags, views, published_at${scoreCol}
       FROM blog_posts ${where}
       ORDER BY ${orderBy}
       LIMIT $${idx++} OFFSET $${idx}`,
      [...params, limit, offset]
    );

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderBlogIndex(result.rows, page, totalPages, topic || undefined, sort, contentType || undefined));
  } catch (err) {
    console.error('[ssr] Blog index error:', err);
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>Server error</h1></body></html>');
  }
});

registerRoute('GET', '/exams/:examId', async (req, res) => {
  try {
    const examId = req.params.examId;
    const topicName = examId.replace(/-/g, ' ');

    const problemsResult = await ssrPool.query(
      `SELECT id, question_text, topic, difficulty, options
       FROM pyq_questions WHERE LOWER(topic) = LOWER($1)
       ORDER BY RANDOM() LIMIT 5`,
      [topicName]
    );

    const blogsResult = await ssrPool.query(
      `SELECT slug, title, content_type, excerpt
       FROM blog_posts WHERE LOWER(topic) = LOWER($1) AND status = 'published'
       ORDER BY published_at DESC LIMIT 4`,
      [topicName]
    );

    const statsResult = await ssrPool.query(
      `SELECT topic, COUNT(*) as count, difficulty
       FROM pyq_questions WHERE LOWER(topic) = LOWER($1)
       GROUP BY topic, difficulty`,
      [topicName]
    );

    const totalProblems = statsResult.rows.reduce((acc, r) => acc + parseInt(r.count), 0);
    const diffDist: Record<string, number> = {};
    statsResult.rows.forEach(r => { diffDist[r.difficulty] = parseInt(r.count); });

    const allTopics = await ssrPool.query(`SELECT DISTINCT topic FROM pyq_questions WHERE topic IS NOT NULL`);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderExamLanding({
      examId,
      title: `GATE ${topicName.split(' ').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ')} — Practice & Study Guide`,
      description: `Master ${topicName} for GATE Engineering Mathematics. ${totalProblems} verified problems with step-by-step solutions, AI tutor, and personalized study plans.`,
      problems: problemsResult.rows,
      blogs: blogsResult.rows,
      stats: {
        totalProblems,
        topics: allTopics.rows.map(r => r.topic).slice(0, 10),
        difficultyDistribution: diffDist,
      },
    }));
  } catch (err) {
    console.error('[ssr] Exam landing error:', err);
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>Server error</h1></body></html>');
  }
});

registerRoute('GET', '/sitemap.xml', async (_req, res) => {
  try {
    const blogs = await ssrPool.query(`SELECT slug, updated_at FROM blog_posts WHERE status = 'published'`);
    const topics = await ssrPool.query(`SELECT DISTINCT topic FROM pyq_questions WHERE topic IS NOT NULL`);
    const entries = buildSitemapEntries(blogs.rows, topics.rows.map(r => r.topic));
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
    res.end(renderSitemap(entries));
  } catch (err) {
    console.error('[ssr] Sitemap error:', err);
    res.writeHead(500, { 'Content-Type': 'application/xml' });
    res.end('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

registerRoute('GET', '/rss.xml', async (_req, res) => {
  try {
    const result = await ssrPool.query(
      `SELECT title, slug, excerpt, topic, published_at
       FROM blog_posts WHERE status = 'published'
       ORDER BY published_at DESC LIMIT 50`
    );
    res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
    res.end(renderRssFeed(result.rows));
  } catch (err) {
    console.error('[ssr] RSS error:', err);
    res.writeHead(500, { 'Content-Type': 'application/xml' });
    res.end('<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>');
  }
});

// Auth session migration
registerRoute('POST', '/api/auth/migrate-session', async (req, res) => {
  const auth = await getAuth(req);
  if (!auth) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required' }));
    return;
  }
  const { sessionId } = req.body as any || {};
  if (!sessionId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'sessionId required' }));
    return;
  }
  try {
    await migrateSession(auth.userId, sessionId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('[auth] Migration error:', (err as Error).message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Migration failed' }));
  }
});

// Health check
registerRoute('GET', '/health', async (_req, res) => {
  const info: Record<string, unknown> = { status: 'ok', service: 'gate-math-api' };
  info.database_url_set = !!process.env.DATABASE_URL;
  info.supabase_url_set = !!process.env.SUPABASE_URL;
  // Quick DB ping
  if (process.env.DATABASE_URL) {
    try {
      const pg = await import('pg');
      const client = new pg.default.Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const r = await client.query('SELECT 1 as ok');
      info.database = r.rows[0]?.ok === 1 ? 'connected' : 'unexpected';
      await client.end();
    } catch (e: any) {
      info.database = `error: ${e.message}`;
    }
  } else {
    info.database = 'not configured';
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(info));
});

// ============================================================================
// Request handling
// ============================================================================

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB (supports base64 images)

async function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    req.on('data', (chunk) => {
      totalSize += chunk.length;
      if (totalSize > MAX_BODY_SIZE) {
        req.destroy();
        return reject(new Error('Request body too large'));
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) return resolve(undefined);
      try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
    });
    req.on('error', () => resolve(undefined));
  });
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = (req.method || 'GET').toUpperCase();

  // Try to serve static frontend files in production
  if (method === 'GET' && !pathname.startsWith('/api') && !pathname.startsWith('/telegram') && !pathname.startsWith('/health') && !pathname.startsWith('/solutions') && !pathname.startsWith('/topics') && !pathname.startsWith('/blog') && !pathname.startsWith('/exams') && pathname !== '/sitemap.xml' && pathname !== '/rss.xml') {
    const frontendDist = path.join(process.cwd(), 'frontend', 'dist');
    if (fs.existsSync(frontendDist)) {
      const filePath = path.join(frontendDist, pathname === '/' ? 'index.html' : pathname);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const contentTypes: Record<string, string> = {
          '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
          '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
          '.map': 'application/json',
        };
        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
      // SPA fallback — serve index.html for unknown paths
      const indexPath = path.join(frontendDist, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(indexPath).pipe(res);
        return;
      }
    }
  }

  // Match API routes
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = pathname.match(route.pattern);
    if (!match) continue;

    const params: Record<string, string> = {};
    route.paramNames.forEach((name, i) => {
      params[name] = match[i + 1];
    });

    const body = await parseBody(req);

    const parsedReq: ParsedRequest = {
      pathname,
      query: url.searchParams,
      params,
      body,
      headers: req.headers as Record<string, string | string[] | undefined>,
    };

    try {
      await route.handler(parsedReq, res);
    } catch (err) {
      console.error(`[gate-server] Error handling ${method} ${pathname}:`, err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

// ============================================================================
// Bootstrap
// ============================================================================

async function main() {
  const port = parseInt(process.env.PORT || '8080', 10);

  // ── Auto-migrate database ─────────────────────────────────────────────
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    const migratePool = new pg.Pool({ connectionString: dbUrl, max: 2 });
    try {
      await autoMigrate(migratePool);
    } catch (err) {
      console.error('[gate-server] Auto-migrate error (non-fatal):', (err as Error).message);
    }
    await migratePool.end();
  }

  // ── Gemini SDK ──────────────────────────────────────────────────────────
  const geminiKey = process.env.GEMINI_API_KEY;
  const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;

  // ── Embedder (gemini-embedding-001, 3072 dims) ──────────────────────────
  const embeddingModel = genAI ? genAI.getGenerativeModel({ model: 'gemini-embedding-001' }) : null;
  const embedder = embeddingModel
    ? async (text: string): Promise<number[]> => {
        const result = await embeddingModel.embedContent(text);
        return result.embedding.values;
      }
    : async (_text: string) => {
        console.warn('[gate-server] GEMINI_API_KEY not set — using zero embeddings');
        return new Array(3072).fill(0);
      };

  // ── LLM dual-solve (Gemini 2.0 Flash for speed) ────────────────────────
  const makeLLMSolver = (modelName: string) => {
    if (!genAI) {
      return {
        solve: async (_problem: string) => ({
          answer: 'LLM not configured (GEMINI_API_KEY missing)',
          confidence: 0.5,
        }),
      };
    }
    const model = genAI.getGenerativeModel({ model: modelName });
    return {
      solve: async (problem: string, context?: any) => {
        const prompt = `You are a GATE Engineering Mathematics expert. Solve the following problem step by step.
Give ONLY the final answer value on the last line, prefixed with "ANSWER: ".
If it's multiple choice, state the letter and value.

Problem: ${problem}
${context?.expectedAnswer ? `Student's answer: ${context.expectedAnswer}` : ''}

Solve carefully:`;
        try {
          const result = await model.generateContent(prompt);
          const text = result.response.text();
          // Extract answer from last line
          const answerMatch = text.match(/ANSWER:\s*(.+)/i);
          const answer = answerMatch ? answerMatch[1].trim() : text.trim().split('\n').pop()?.trim() || '';
          return { answer, confidence: 0.8 };
        } catch (err) {
          console.error(`[${modelName}] solve error:`, (err as Error).message);
          return { answer: '', confidence: 0 };
        }
      },
    };
  };

  // Use 2.5-flash for both solvers (fast + available on current quota)
  const llmA = makeLLMSolver('gemini-2.5-flash');
  const llmB = makeLLMSolver('gemini-2.5-flash');

  // ── Wolfram Alpha ───────────────────────────────────────────────────────
  const wolframAppId = process.env.WOLFRAM_APP_ID;
  let wolfram: any = null;
  if (wolframAppId) {
    wolfram = new WolframVerifier();
    await wolfram.initialize({
      config: { appId: wolframAppId },
      timeoutMs: 15_000,
    });
    const healthy = await wolfram.checkHealth();
    console.log(`[gate-server] Wolfram Alpha: ${healthy ? 'connected' : 'FAILED health check'}`);
  } else {
    console.warn('[gate-server] WOLFRAM_APP_ID not set — Tier 3 disabled');
  }

  // ── Vector store (pgvector-backed for persistence across cold starts) ──
  let vectorStore;
  if (dbUrl) {
    const pg = await import('pg');
    const pool = new pg.default.Pool({ connectionString: dbUrl, max: 5, idleTimeoutMillis: 30_000 });
    const pgStore = new PgVectorStore(pool);
    await pgStore.initialize();
    vectorStore = pgStore;
  } else {
    console.warn('[gate-server] DATABASE_URL not set — using in-memory vector store (no persistence)');
    vectorStore = new InMemoryVectorStore();
  }

  // ── Orchestrator ────────────────────────────────────────────────────────
  const orchestrator = new TieredVerificationOrchestrator(
    vectorStore,
    embedder,
    llmA,
    llmB,
    wolfram,
    {
      ragThreshold: 0.85,
      wolframDailyLimit: 50,
      llmTimeoutMs: 10_000,
      wolframTimeoutMs: 15_000,
    },
  );

  setOrchestrator(orchestrator);
  setFlywheelOrchestrator(orchestrator);

  // Inject Gemini model for image extraction in verify-any
  if (genAI) {
    setGeminiModel(genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }));
  }

  // ── Content Pipeline: inject vector store + embedder into chat routes ──
  setChatVectorStore(vectorStore);
  setChatEmbedder(embedder);
  console.log(`[gate-server] Content pipeline: chat grounding enabled`);

  console.log(`[gate-server] Verification tiers: RAG${genAI ? ' + Gemini LLM' : ''}${wolfram ? ' + Wolfram' : ''}`);

  const server = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error('[gate-server] Unhandled request error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`
┌──────────────────────────────────────────────┐
│  GATE Math API                               │
│  http://localhost:${port}                         │
│                                              │
│  Core:                                       │
│    GET  /health                 Health        │
│    GET  /api/topics             Topics        │
│    GET  /api/problems/:topic    Problems      │
│    POST /api/verify             Verify        │
│    POST /api/verify-any         Verify Any    │
│    GET  /api/sr/:id             SR State      │
│    POST /api/sr/:id             SR Update     │
│    GET  /api/progress/:id       Progress      │
│  SEO:                                        │
│    GET  /solutions/:slug        Solution Page │
│    GET  /topics/:slug           Topic Page    │
│    GET  /sitemap.xml            Sitemap       │
│  AI Tutor:                                   │
│    POST /api/chat               Stream Chat   │
│    GET  /api/chat/:id           History       │
│  Study Commander:                            │
│    POST /api/onboard             Onboard     │
│    GET  /api/onboard/:id         Profile     │
│    GET  /api/diagnostic/:id      Questions   │
│    POST /api/diagnostic/:id      Save Diag   │
│    GET  /api/today/:id           Daily Plan  │
│    POST /api/today/:id/:i/rate   Rate Task   │
│    GET  /api/priority/:id        Priorities  │
│  Auth:                                       │
│    POST /api/auth/migrate-session Migrate    │
│  Social:                                     │
│    GET  /api/admin/social       List Content  │
│    PUT  /api/admin/social/:id   Update        │
│  Automation:                                 │
│    POST /api/flywheel/generate  Content Gen   │
│    POST /telegram/daily-problem Daily Post    │
└──────────────────────────────────────────────┘
`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[gate-server] Shutting down...');
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(console.error);
