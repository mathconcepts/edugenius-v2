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
import { gateRoutes, setOrchestrator } from './api/gate-routes';
import { dailyProblemRoutes } from './jobs/daily-problem';
import { telegramWebhookRoutes } from './jobs/telegram-webhook';
import { flywheelRoutes, setFlywheelOrchestrator } from './jobs/content-flywheel';
import { topicPageRoutes } from './api/topic-pages';
import { streakRoutes } from './api/streak-routes';
import { adminRoutes } from './api/admin-routes';
import { TieredVerificationOrchestrator } from './verification/tiered-orchestrator';
import { InMemoryVectorStore, PgVectorStore } from './data/vector-store';
import { WolframVerifier } from './verification/verifiers/wolfram';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import fs from 'fs';

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

// Health check
registerRoute('GET', '/health', async (_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'gate-math-api' }));
});

// ============================================================================
// Request handling
// ============================================================================

async function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
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
  if (method === 'GET' && !pathname.startsWith('/api') && !pathname.startsWith('/telegram') && !pathname.startsWith('/health') && !pathname.startsWith('/solutions') && !pathname.startsWith('/topics') && pathname !== '/sitemap.xml') {
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
  const dbUrl = process.env.DATABASE_URL;
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
