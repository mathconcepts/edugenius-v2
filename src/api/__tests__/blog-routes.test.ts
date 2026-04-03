import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pg before importing routes
const mockQuery = vi.fn();
vi.mock('pg', () => ({
  default: {
    Pool: vi.fn(() => ({ query: mockQuery })),
  },
}));

// Import after mock
const { blogRoutes } = await import('../blog-routes');

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    pathname: '/api/blog',
    query: new URLSearchParams(),
    params: {},
    body: null,
    headers: {},
    ...overrides,
  };
}

function makeRes() {
  let _status = 200;
  let _headers: Record<string, string> = {};
  let _body = '';
  return {
    writeHead(status: number, headers?: Record<string, string>) {
      _status = status;
      if (headers) _headers = headers;
    },
    end(body?: string) { _body = body || ''; },
    get status() { return _status; },
    get body() { return _body; },
    get json() { return _body ? JSON.parse(_body) : null; },
  };
}

function findHandler(method: string, path: string) {
  const route = blogRoutes.find(r => r.method === method && r.path === path);
  if (!route) throw new Error(`Route not found: ${method} ${path}`);
  return route.handler;
}

describe('blog-routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/blog', () => {
    it('returns paginated published posts', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({
          rows: [
            { id: '1', slug: 'post-1', title: 'Post 1' },
            { id: '2', slug: 'post-2', title: 'Post 2' },
          ],
        });

      const handler = findHandler('GET', '/api/blog');
      const res = makeRes();
      await handler(makeReq() as any, res as any);

      expect(res.status).toBe(200);
      expect(res.json.posts).toHaveLength(2);
      expect(res.json.total).toBe(3);
      expect(res.json.page).toBe(1);
      // First query should filter by published status
      expect(mockQuery.mock.calls[0][0]).toContain("status = 'published'");
    });

    it('filters by topic when provided', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: '1', slug: 'la-post' }] });

      const query = new URLSearchParams({ topic: 'Linear Algebra' });
      const handler = findHandler('GET', '/api/blog');
      const res = makeRes();
      await handler(makeReq({ query }) as any, res as any);

      expect(mockQuery.mock.calls[0][0]).toContain('topic = $1');
      expect(mockQuery.mock.calls[0][1]).toContain('Linear Algebra');
    });

    it('caps limit at 50', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const query = new URLSearchParams({ limit: '999' });
      const handler = findHandler('GET', '/api/blog');
      const res = makeRes();
      await handler(makeReq({ query }) as any, res as any);

      // The limit param should be capped at 50
      const listCall = mockQuery.mock.calls[1];
      expect(listCall[1]).toContain(50);
    });
  });

  describe('GET /api/blog/:slug', () => {
    it('returns 404 for missing slug', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const handler = findHandler('GET', '/api/blog/:slug');
      const res = makeRes();
      await handler(makeReq({ params: { slug: 'nonexistent' } }) as any, res as any);

      expect(res.status).toBe(404);
      expect(res.json.error).toBe('Blog post not found');
    });

    it('returns post for valid slug', async () => {
      const post = { id: '1', slug: 'test-post', title: 'Test', sections: [] };
      mockQuery.mockResolvedValueOnce({ rows: [post] });

      const handler = findHandler('GET', '/api/blog/:slug');
      const res = makeRes();
      await handler(makeReq({ params: { slug: 'test-post' } }) as any, res as any);

      expect(res.status).toBe(200);
      expect(res.json.slug).toBe('test-post');
    });
  });

  describe('PUT /api/admin/blog/:id', () => {
    it('rejects invalid status', async () => {
      const handler = findHandler('PUT', '/api/admin/blog/:id');
      const res = makeRes();
      await handler(makeReq({ params: { id: '1' }, body: { status: 'invalid' } }) as any, res as any);

      expect(res.status).toBe(400);
      expect(res.json.error).toContain('Invalid status');
    });

    it('returns 404 when post not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const handler = findHandler('PUT', '/api/admin/blog/:id');
      const res = makeRes();
      await handler(makeReq({ params: { id: 'missing' }, body: { status: 'published' } }) as any, res as any);

      expect(res.status).toBe(404);
    });

    it('publishes post with valid status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: '1', slug: 'test', status: 'published' }] });

      const handler = findHandler('PUT', '/api/admin/blog/:id');
      const res = makeRes();
      await handler(makeReq({ params: { id: '1' }, body: { status: 'published' } }) as any, res as any);

      expect(res.status).toBe(200);
      expect(res.json.status).toBe('published');
    });
  });

  describe('POST /api/blog/:id/view', () => {
    it('returns 204 and fires view count update', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const handler = findHandler('POST', '/api/blog/:id/view');
      const res = makeRes();
      await handler(makeReq({ params: { id: '1' } }) as any, res as any);

      expect(res.status).toBe(204);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('views = views + 1'),
        ['1']
      );
    });
  });
});
