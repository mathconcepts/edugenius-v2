import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pg and fetch before importing
const mockQuery = vi.fn();
vi.mock('pg', () => ({
  default: {
    Pool: vi.fn(() => ({ query: mockQuery })),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const { retentionRoutes, enqueueWelcomeSequence } = await import('../retention-engine');

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
    writeHead(status: number, _headers?: Record<string, string>) { _status = status; },
    end(body?: string) { _body = body || ''; },
    get status() { return _status; },
    get json() { return _body ? JSON.parse(_body) : null; },
  };
}

function findHandler(method: string, path: string) {
  const route = retentionRoutes.find(r => r.method === method && r.path === path);
  if (!route) throw new Error(`Route not found: ${method} ${path}`);
  return route.handler;
}

describe('retention-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
    delete process.env.RESEND_API_KEY;
  });

  describe('POST /api/email/process', () => {
    it('rejects requests without CRON_SECRET', async () => {
      const handler = findHandler('POST', '/api/email/process');
      const res = makeRes();
      await handler(makeReq() as any, res as any);

      expect(res.status).toBe(401);
      expect(res.json.error).toBe('Unauthorized');
    });

    it('processes pending emails with rate limit of 20', async () => {
      process.env.CRON_SECRET = 'test-secret';

      // Return 2 pending emails
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'e1', user_id: 'u1', template: 'welcome_day0', payload: {}, email: 'a@test.com' },
          { id: 'e2', user_id: 'u2', template: 'welcome_day3', payload: {}, email: 'b@test.com' },
        ],
      });
      // Update queries for each email (skipped because no RESEND_API_KEY)
      mockQuery.mockResolvedValue({ rows: [] });

      const handler = findHandler('POST', '/api/email/process');
      const res = makeRes();
      await handler(
        makeReq({ headers: { authorization: 'Bearer test-secret' } }) as any,
        res as any,
      );

      expect(res.status).toBe(200);
      expect(res.json.processed).toBe(2);
      // Without RESEND_API_KEY, emails are skipped
      expect(res.json.skipped).toBe(2);
      expect(res.json.sent).toBe(0);

      // Verify LIMIT 20 in the query
      expect(mockQuery.mock.calls[0][0]).toContain('LIMIT 20');
    });

    it('skips emails when user has no email address', async () => {
      process.env.CRON_SECRET = 'test-secret';

      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'e1', user_id: 'u1', template: 'welcome_day0', payload: {}, email: null },
        ],
      });
      mockQuery.mockResolvedValue({ rows: [] });

      const handler = findHandler('POST', '/api/email/process');
      const res = makeRes();
      await handler(
        makeReq({ headers: { authorization: 'Bearer test-secret' } }) as any,
        res as any,
      );

      expect(res.json.skipped).toBe(1);
    });

    it('sends email when RESEND_API_KEY is configured', async () => {
      process.env.CRON_SECRET = 'test-secret';
      process.env.RESEND_API_KEY = 're_test_key';

      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'e1', user_id: 'u1', template: 'welcome_day0', payload: {}, email: 'a@test.com' },
        ],
      });
      mockQuery.mockResolvedValue({ rows: [] });

      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'msg_1' }) });

      const handler = findHandler('POST', '/api/email/process');
      const res = makeRes();
      await handler(
        makeReq({ headers: { authorization: 'Bearer test-secret' } }) as any,
        res as any,
      );

      expect(res.json.sent).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('marks email as failed when Resend API returns error', async () => {
      process.env.CRON_SECRET = 'test-secret';
      process.env.RESEND_API_KEY = 're_test_key';

      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'e1', user_id: 'u1', template: 'welcome_day0', payload: {}, email: 'a@test.com' },
        ],
      });
      mockQuery.mockResolvedValue({ rows: [] });

      mockFetch.mockResolvedValueOnce({ ok: false, status: 429, text: () => Promise.resolve('rate limited') });

      const handler = findHandler('POST', '/api/email/process');
      const res = makeRes();
      await handler(
        makeReq({ headers: { authorization: 'Bearer test-secret' } }) as any,
        res as any,
      );

      expect(res.json.failed).toBe(1);
    });
  });

  describe('enqueueWelcomeSequence', () => {
    it('enqueues 3 emails with correct scheduling', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await enqueueWelcomeSequence('user-123');

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const call = mockQuery.mock.calls[0];
      // Should insert 3 rows in one query
      expect(call[0]).toContain('welcome_day0');
      expect(call[0]).toContain('welcome_day3');
      expect(call[0]).toContain('welcome_day7');
      // First param is user ID
      expect(call[1][0]).toBe('user-123');
      // Day3 and Day7 are ISO date strings
      expect(new Date(call[1][1]).getTime()).toBeGreaterThan(Date.now());
      expect(new Date(call[1][2]).getTime()).toBeGreaterThan(new Date(call[1][1]).getTime());
    });
  });

  describe('POST /api/retention/enqueue', () => {
    it('rejects without CRON_SECRET', async () => {
      const handler = findHandler('POST', '/api/retention/enqueue');
      const res = makeRes();
      await handler(makeReq() as any, res as any);

      expect(res.status).toBe(401);
    });

    it('returns enqueue count on success', async () => {
      process.env.CRON_SECRET = 'test-secret';

      // Streak check returns no users (empty)
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const handler = findHandler('POST', '/api/retention/enqueue');
      const res = makeRes();
      await handler(
        makeReq({ headers: { authorization: 'Bearer test-secret' } }) as any,
        res as any,
      );

      expect(res.status).toBe(200);
      expect(res.json).toHaveProperty('enqueued');
      expect(typeof res.json.enqueued).toBe('number');
    });
  });
});
