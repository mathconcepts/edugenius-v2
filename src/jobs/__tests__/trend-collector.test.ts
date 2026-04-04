import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pg before importing
const mockQuery = vi.fn();
vi.mock('pg', () => ({
  default: {
    Pool: vi.fn(() => ({ query: mockQuery })),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const { matchTopics, trendCollectorRoutes } = await import('../trend-collector');

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

describe('matchTopics', () => {
  it('matches linear algebra keywords', () => {
    expect(matchTopics('How to find eigenvalue of a 3x3 matrix')).toContain('linear-algebra');
  });

  it('matches calculus keywords', () => {
    expect(matchTopics('Help with integral of sin(x)dx')).toContain('calculus');
  });

  it('matches multiple topics', () => {
    const topics = matchTopics('Using eigenvalues to solve differential equations');
    expect(topics).toContain('linear-algebra');
    expect(topics).toContain('differential-equations');
  });

  it('returns empty for unrelated text', () => {
    expect(matchTopics('Best restaurants in Mumbai')).toEqual([]);
  });

  it('is case-insensitive', () => {
    expect(matchTopics('EIGENVALUE PROBLEMS')).toContain('linear-algebra');
  });
});

describe('trendCollectorRoutes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.DATABASE_URL = 'postgres://test';
    process.env.CRON_SECRET = 'test-secret';
  });

  it('has POST /api/trends/collect route', () => {
    expect(trendCollectorRoutes).toHaveLength(1);
    expect(trendCollectorRoutes[0].method).toBe('POST');
    expect(trendCollectorRoutes[0].path).toBe('/api/trends/collect');
  });

  it('returns 401 without auth', async () => {
    const res = makeRes();
    await trendCollectorRoutes[0].handler(makeReq(), res as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong auth', async () => {
    const res = makeRes();
    await trendCollectorRoutes[0].handler(
      makeReq({ headers: { authorization: 'Bearer wrong' } }),
      res as any
    );
    expect(res.status).toBe(401);
  });

  it('handles Reddit fetch failure gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const res = makeRes();
    await trendCollectorRoutes[0].handler(
      makeReq({ headers: { authorization: 'Bearer test-secret' } }),
      res as any
    );

    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('complete');
    expect(body.total).toBe(0);
  });

  it('processes Reddit data and returns complete status', async () => {
    // Mock fetch for all 4 collectors (Reddit, StackExchange, YouTube, NewsAPI)
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('reddit.com')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              children: [{
                data: { title: 'Help with eigenvalue problems', url: 'https://reddit.com/1', score: 42, selftext: '', subreddit: 'GATE' }
              }]
            }
          }),
        });
      }
      if (url.includes('stackexchange.com')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [] }) });
      }
      return Promise.reject(new Error('Unexpected URL'));
    });
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const res = makeRes();
    await trendCollectorRoutes[0].handler(
      makeReq({ headers: { authorization: 'Bearer test-secret' } }),
      res as any
    );

    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('complete');
    expect(body.sources.reddit).toBeGreaterThan(0);
  });
});
