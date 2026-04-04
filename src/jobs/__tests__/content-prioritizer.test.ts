import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pg before importing
const mockQuery = vi.fn();
vi.mock('pg', () => ({
  default: {
    Pool: vi.fn(() => ({ query: mockQuery })),
  },
}));

const { normalize, selectContentType, contentPrioritizerRoutes } = await import('../content-prioritizer');

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    pathname: '',
    query: new URLSearchParams(),
    params: {},
    body: null,
    headers: {},
    ...overrides,
  };
}

function makeRes() {
  let _status = 200;
  let _body = '';
  return {
    writeHead(status: number) { _status = status; },
    end(body?: string) { _body = body || ''; },
    get status() { return _status; },
    get body() { return _body; },
    headersSent: false,
  };
}

describe('normalize', () => {
  it('returns 0 when max is 0', () => {
    expect(normalize(5, 0)).toBe(0);
  });

  it('normalizes value to 0-1 range', () => {
    expect(normalize(5, 10)).toBe(0.5);
    expect(normalize(10, 10)).toBe(1);
    expect(normalize(0, 10)).toBe(0);
  });

  it('clamps to 1 when value exceeds max', () => {
    expect(normalize(15, 10)).toBe(1);
  });

  it('clamps to 0 for negative values', () => {
    expect(normalize(-5, 10)).toBe(0);
  });
});

describe('selectContentType', () => {
  it('returns solved_problem for high struggle', () => {
    expect(selectContentType('calculus', 0.8, 0.1, 0.1)).toBe('solved_problem');
  });

  it('returns topic_explainer for high trend signal', () => {
    expect(selectContentType('calculus', 0.3, 0.7, 0.1)).toBe('topic_explainer');
  });

  it('returns exam_strategy for high conversion', () => {
    expect(selectContentType('calculus', 0.3, 0.3, 0.5)).toBe('exam_strategy');
  });

  it('rotates through types by default', () => {
    // Default behavior when no strong signal
    const result = selectContentType('calculus', 0.3, 0.3, 0.1);
    expect(['solved_problem', 'topic_explainer', 'exam_strategy', 'comparison']).toContain(result);
  });
});

describe('contentPrioritizerRoutes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.DATABASE_URL = 'postgres://test';
    process.env.CRON_SECRET = 'test-secret';
  });

  it('has POST /api/content/prioritize route', () => {
    expect(contentPrioritizerRoutes).toHaveLength(1);
    expect(contentPrioritizerRoutes[0].method).toBe('POST');
    expect(contentPrioritizerRoutes[0].path).toBe('/api/content/prioritize');
  });

  it('returns 401 without auth', async () => {
    const res = makeRes();
    await contentPrioritizerRoutes[0].handler(makeReq(), res as any);
    expect(res.status).toBe(401);
  });

  it('computes priorities for all 10 topics', async () => {
    // Mock all queries to return empty results (fallback behavior)
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const res = makeRes();
    await contentPrioritizerRoutes[0].handler(
      makeReq({ headers: { authorization: 'Bearer test-secret' } }),
      res as any
    );

    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('complete');
    expect(body.priorities).toHaveLength(10);
    // Each priority should have topic, content_type, priority_score, signals
    for (const p of body.priorities) {
      expect(p.topic).toBeTruthy();
      expect(p.content_type).toBeTruthy();
      expect(typeof p.priority_score).toBe('number');
      expect(p.signals).toBeTruthy();
    }
  });

  it('returns equal scores when no data available', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const res = makeRes();
    await contentPrioritizerRoutes[0].handler(
      makeReq({ headers: { authorization: 'Bearer test-secret' } }),
      res as any
    );

    const body = JSON.parse(res.body);
    const scores = body.priorities.map((p: any) => p.priority_score);
    // With no data, all topics should have equal struggle (0.5) and coverage gap (1.0)
    // Score = 0.30 * 0.5 + 0.25 * 0 + 0.20 * 0 + 0.15 * 0 + 0.10 * 1 = 0.25
    expect(scores[0]).toBeCloseTo(0.25, 1);
  });
});
