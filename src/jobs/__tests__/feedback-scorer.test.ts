import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pg before importing
const mockQuery = vi.fn();
vi.mock('pg', () => {
  const MockPool = vi.fn(() => ({ query: mockQuery }));
  return {
    default: { Pool: MockPool },
    Pool: MockPool,
  };
});

const { normalizeScore, feedbackScorerRoutes, _setPool } = await import('../feedback-scorer');

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

describe('normalizeScore', () => {
  it('returns 0 when max is 0', () => {
    expect(normalizeScore(5, 0)).toBe(0);
  });

  it('normalizes correctly', () => {
    expect(normalizeScore(5, 10)).toBe(0.5);
    expect(normalizeScore(10, 10)).toBe(1);
    expect(normalizeScore(0, 10)).toBe(0);
  });

  it('handles zero views gracefully', () => {
    expect(normalizeScore(0, 0)).toBe(0);
  });
});

describe('feedbackScorerRoutes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.DATABASE_URL = 'postgres://test';
    process.env.CRON_SECRET = 'test-secret';
    // Inject mock pool directly to bypass require('pg') resolution issues
    _setPool({ query: mockQuery });
  });

  it('has POST /api/content/score route', () => {
    expect(feedbackScorerRoutes).toHaveLength(1);
    expect(feedbackScorerRoutes[0].method).toBe('POST');
    expect(feedbackScorerRoutes[0].path).toBe('/api/content/score');
  });

  it('returns 401 without auth', async () => {
    const res = makeRes();
    await feedbackScorerRoutes[0].handler(makeReq(), res as any);
    expect(res.status).toBe(401);
  });

  it('handles no published posts', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const res = makeRes();
    await feedbackScorerRoutes[0].handler(
      makeReq({ headers: { authorization: 'Bearer test-secret' } }),
      res as any
    );

    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('complete');
    expect(body.scored).toBe(0);
    expect(body.archived).toBe(0);
  });

  it('scores posts and returns top slugs', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM blog_posts') && sql.includes('published') && !sql.includes('UPDATE')) {
        return Promise.resolve({
          rows: [
            { id: 'id1', slug: 'post-1', topic: 'calculus', views: 100, published_at: new Date(Date.now() - 10 * 86400000).toISOString() },
            { id: 'id2', slug: 'post-2', topic: 'linear-algebra', views: 50, published_at: new Date(Date.now() - 5 * 86400000).toISOString() },
          ],
          rowCount: 2,
        });
      }
      if (sql.includes('signup_complete')) {
        return Promise.resolve({ rows: [{ slug: 'post-1', signups: 5 }], rowCount: 1 });
      }
      if (sql.includes('trend_signals')) {
        return Promise.resolve({ rows: [{ topic_match: 'calculus' }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = makeRes();
    await feedbackScorerRoutes[0].handler(
      makeReq({ headers: { authorization: 'Bearer test-secret' } }),
      res as any
    );

    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.scored).toBe(2);
    expect(body.topPosts).toHaveLength(2);
  });

  it('auto-archives low-scoring old posts', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM blog_posts') && sql.includes('published') && !sql.includes('UPDATE')) {
        return Promise.resolve({
          rows: [
            { id: 'old1', slug: 'old-post', topic: 'calculus', views: 1, published_at: new Date(Date.now() - 100 * 86400000).toISOString() },
          ],
          rowCount: 1,
        });
      }
      if (sql.includes('UPDATE blog_posts') && sql.includes('archived')) {
        return Promise.resolve({ rows: [{ id: 'old1' }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = makeRes();
    await feedbackScorerRoutes[0].handler(
      makeReq({ headers: { authorization: 'Bearer test-secret' } }),
      res as any
    );

    expect(res.status).toBe(200);
    const archiveCalls = mockQuery.mock.calls.filter(c => c[0]?.includes?.('archived'));
    expect(archiveCalls.length).toBeGreaterThan(0);
  });
});
