// @ts-nocheck
/**
 * Content Engine Routes
 *
 * HTTP surface for the four-tier content cascade. Called by both the client
 * and CI jobs. Stateless — no database.
 *
 * Endpoints:
 *   POST /api/content/resolve   — pipeline entry; returns a problem/explainer
 *   POST /api/content/verify    — Wolfram verification of a specific answer
 *   GET  /api/content/stats     — bundle inventory (public)
 *   GET  /api/content/explainer/:conceptId — direct explainer lookup
 */

import { ServerResponse } from 'http';
import { resolveContent, bundleStats } from '../content/resolver';
import { verifyProblemWithWolfram } from '../services/wolfram-service';
import { recordTelemetry, getTelemetrySummary } from '../content/telemetry';
import { requireRole } from './auth-middleware';

interface ParsedRequest {
  pathname: string;
  query: URLSearchParams;
  params: Record<string, string>;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}

type RouteHandler = (req: ParsedRequest, res: ServerResponse) => Promise<void>;

function sendJSON(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, status: number, msg: string) {
  sendJSON(res, { error: msg }, status);
}

async function handleResolve(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = (req.body as any) || {};
  if (!body.intent) return sendError(res, 400, 'intent required (practice|explain|verify)');
  try {
    const result = await resolveContent(body);
    // Auto-record telemetry (server-side, no extra client round-trip)
    recordTelemetry({
      source: result.source,
      latency_ms: result.latency_ms,
      cost_usd: result.cost_estimate_usd,
      topic: body.topic,
      concept_id: body.concept_id,
      tier_requested: body.max_tier,
      wolfram_verified: result.wolfram_verified,
    });
    sendJSON(res, result);
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
}

async function handleTelemetryIngest(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = (req.body as any) || {};
  const result = recordTelemetry(body);
  sendJSON(res, result);
}

async function handleTelemetrySummary(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const user = await requireRole(req, res, 'admin', 'teacher');
  if (!user) return;
  try {
    sendJSON(res, getTelemetrySummary());
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
}

async function handleVerify(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = (req.body as any) || {};
  const { problem_text, expected_answer } = body;
  if (!problem_text || !expected_answer) return sendError(res, 400, 'problem_text and expected_answer required');
  try {
    const result = await verifyProblemWithWolfram(problem_text, expected_answer);
    sendJSON(res, result);
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
}

async function handleStats(_req: ParsedRequest, res: ServerResponse): Promise<void> {
  try {
    sendJSON(res, bundleStats());
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
}

async function handleExplainer(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { conceptId } = req.params;
  if (!conceptId) return sendError(res, 400, 'conceptId required');
  try {
    const result = await resolveContent({ intent: 'explain', concept_id: conceptId, max_tier: 0 });
    if (result.source === 'miss') {
      return sendError(res, 404, `No explainer for concept: ${conceptId}`);
    }
    sendJSON(res, result);
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
}

export const contentRoutes: Array<{ method: string; path: string; handler: RouteHandler }> = [
  { method: 'POST', path: '/api/content/resolve', handler: handleResolve },
  { method: 'POST', path: '/api/content/verify', handler: handleVerify },
  { method: 'GET', path: '/api/content/stats', handler: handleStats },
  { method: 'GET', path: '/api/content/explainer/:conceptId', handler: handleExplainer },
  { method: 'POST', path: '/api/content/telemetry', handler: handleTelemetryIngest },
  { method: 'GET', path: '/api/content/telemetry/summary', handler: handleTelemetrySummary },
];
