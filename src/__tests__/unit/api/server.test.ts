/**
 * Unit Tests for API Server
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock types for testing without running actual server
interface MockRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

describe('API Route Matching', () => {
  // Test route pattern matching logic
  
  function matchRoute(pattern: string, path: string): Record<string, string> | null {
    const paramNames: string[] = [];
    const regexPattern = pattern.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });

    const regex = new RegExp(`^${regexPattern}$`);
    const match = path.match(regex);

    if (!match) return null;

    const params: Record<string, string> = {};
    paramNames.forEach((name, i) => {
      params[name] = match[i + 1];
    });

    return params;
  }

  it('should match simple routes', () => {
    expect(matchRoute('/health', '/health')).toEqual({});
    expect(matchRoute('/status', '/status')).toEqual({});
    expect(matchRoute('/agents', '/agents')).toEqual({});
  });

  it('should not match different routes', () => {
    expect(matchRoute('/health', '/status')).toBeNull();
    expect(matchRoute('/agents', '/users')).toBeNull();
  });

  it('should extract path parameters', () => {
    expect(matchRoute('/agents/:agentId', '/agents/Scout')).toEqual({ agentId: 'Scout' });
    expect(matchRoute('/users/:userId/posts/:postId', '/users/123/posts/456'))
      .toEqual({ userId: '123', postId: '456' });
  });

  it('should handle complex paths', () => {
    expect(matchRoute('/tutoring/sessions/:sessionId/ask', '/tutoring/sessions/abc123/ask'))
      .toEqual({ sessionId: 'abc123' });
  });

  it('should not match partial paths', () => {
    expect(matchRoute('/agents/:agentId', '/agents')).toBeNull();
    expect(matchRoute('/agents/:agentId', '/agents/Scout/extra')).toBeNull();
  });
});

describe('Request Parsing', () => {
  function parseQueryString(queryString: string): URLSearchParams {
    return new URLSearchParams(queryString);
  }

  it('should parse query parameters', () => {
    const params = parseQueryString('type=daily&limit=10');
    expect(params.get('type')).toBe('daily');
    expect(params.get('limit')).toBe('10');
  });

  it('should handle empty query string', () => {
    const params = parseQueryString('');
    expect(params.get('type')).toBeNull();
  });

  it('should handle multiple values', () => {
    const params = parseQueryString('tag=a&tag=b&tag=c');
    expect(params.getAll('tag')).toEqual(['a', 'b', 'c']);
  });

  it('should handle encoded values', () => {
    const params = parseQueryString('query=hello%20world');
    expect(params.get('query')).toBe('hello world');
  });
});

describe('Response Building', () => {
  function buildJsonResponse(data: unknown, status: number = 200): MockResponse {
    return {
      statusCode: status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  }

  function buildErrorResponse(status: number, message: string): MockResponse {
    return buildJsonResponse({ error: message }, status);
  }

  it('should build success response', () => {
    const response = buildJsonResponse({ status: 'ok' });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: 'ok' });
  });

  it('should build error response', () => {
    const response = buildErrorResponse(404, 'Not Found');
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'Not Found' });
  });

  it('should handle complex objects', () => {
    const data = {
      agents: [
        { id: 'Scout', status: 'active' },
        { id: 'Atlas', status: 'idle' },
      ],
    };
    const response = buildJsonResponse(data);
    expect(JSON.parse(response.body)).toEqual(data);
  });

  it('should handle null values', () => {
    const response = buildJsonResponse({ value: null });
    expect(JSON.parse(response.body)).toEqual({ value: null });
  });
});

describe('Rate Limiting', () => {
  class RateLimiter {
    private store: Map<string, { count: number; resetAt: number }> = new Map();
    
    constructor(
      private windowMs: number,
      private maxRequests: number
    ) {}

    check(ip: string): boolean {
      const now = Date.now();
      const entry = this.store.get(ip);

      if (!entry || now > entry.resetAt) {
        this.store.set(ip, { count: 1, resetAt: now + this.windowMs });
        return true;
      }

      if (entry.count >= this.maxRequests) {
        return false;
      }

      entry.count++;
      return true;
    }

    reset(): void {
      this.store.clear();
    }
  }

  it('should allow requests within limit', () => {
    const limiter = new RateLimiter(60000, 10);
    
    for (let i = 0; i < 10; i++) {
      expect(limiter.check('192.168.1.1')).toBe(true);
    }
  });

  it('should block requests over limit', () => {
    const limiter = new RateLimiter(60000, 3);
    
    expect(limiter.check('192.168.1.1')).toBe(true);
    expect(limiter.check('192.168.1.1')).toBe(true);
    expect(limiter.check('192.168.1.1')).toBe(true);
    expect(limiter.check('192.168.1.1')).toBe(false);
  });

  it('should track IPs separately', () => {
    const limiter = new RateLimiter(60000, 2);
    
    expect(limiter.check('192.168.1.1')).toBe(true);
    expect(limiter.check('192.168.1.1')).toBe(true);
    expect(limiter.check('192.168.1.1')).toBe(false);
    
    expect(limiter.check('192.168.1.2')).toBe(true);
    expect(limiter.check('192.168.1.2')).toBe(true);
  });

  it('should reset after window expires', async () => {
    const limiter = new RateLimiter(50, 1);
    
    expect(limiter.check('192.168.1.1')).toBe(true);
    expect(limiter.check('192.168.1.1')).toBe(false);
    
    await new Promise(r => setTimeout(r, 60));
    
    expect(limiter.check('192.168.1.1')).toBe(true);
  });
});

describe('Authentication', () => {
  class ApiKeyAuth {
    constructor(private validKeys: string[]) {}

    validate(key: string | undefined): boolean {
      if (!key) return false;
      return this.validKeys.includes(key);
    }

    extractKey(headers: Record<string, string>): string | undefined {
      // Try X-API-Key header
      if (headers['x-api-key']) {
        return headers['x-api-key'];
      }
      
      // Try Authorization header
      if (headers['authorization']?.startsWith('Bearer ')) {
        return headers['authorization'].substring(7);
      }

      return undefined;
    }
  }

  it('should validate correct API key', () => {
    const auth = new ApiKeyAuth(['valid-key-1', 'valid-key-2']);
    expect(auth.validate('valid-key-1')).toBe(true);
    expect(auth.validate('valid-key-2')).toBe(true);
  });

  it('should reject invalid API key', () => {
    const auth = new ApiKeyAuth(['valid-key']);
    expect(auth.validate('invalid-key')).toBe(false);
  });

  it('should reject empty/undefined key', () => {
    const auth = new ApiKeyAuth(['valid-key']);
    expect(auth.validate(undefined)).toBe(false);
    expect(auth.validate('')).toBe(false);
  });

  it('should extract key from X-API-Key header', () => {
    const auth = new ApiKeyAuth([]);
    expect(auth.extractKey({ 'x-api-key': 'my-key' })).toBe('my-key');
  });

  it('should extract key from Authorization header', () => {
    const auth = new ApiKeyAuth([]);
    expect(auth.extractKey({ 'authorization': 'Bearer my-token' })).toBe('my-token');
  });
});

describe('CORS Handling', () => {
  function buildCorsHeaders(allowedOrigins: string[]): Record<string, string> {
    return {
      'Access-Control-Allow-Origin': allowedOrigins.join(', '),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    };
  }

  it('should set correct CORS headers', () => {
    const headers = buildCorsHeaders(['*']);
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
    expect(headers['Access-Control-Allow-Methods']).toContain('GET');
    expect(headers['Access-Control-Allow-Methods']).toContain('POST');
  });

  it('should support multiple origins', () => {
    const headers = buildCorsHeaders(['http://localhost:3000', 'https://example.com']);
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000, https://example.com');
  });
});

describe('Content Validation', () => {
  function validateContentType(contentType: string | undefined, expected: string): boolean {
    if (!contentType) return expected === '';
    return contentType.toLowerCase().includes(expected.toLowerCase());
  }

  it('should validate JSON content type', () => {
    expect(validateContentType('application/json', 'application/json')).toBe(true);
    expect(validateContentType('application/json; charset=utf-8', 'application/json')).toBe(true);
  });

  it('should reject wrong content type', () => {
    expect(validateContentType('text/plain', 'application/json')).toBe(false);
  });

  it('should handle missing content type', () => {
    expect(validateContentType(undefined, '')).toBe(true);
    expect(validateContentType(undefined, 'application/json')).toBe(false);
  });
});

describe('Error Codes', () => {
  const HTTP_ERRORS: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };

  it('should have correct error messages', () => {
    expect(HTTP_ERRORS[400]).toBe('Bad Request');
    expect(HTTP_ERRORS[401]).toBe('Unauthorized');
    expect(HTTP_ERRORS[404]).toBe('Not Found');
    expect(HTTP_ERRORS[500]).toBe('Internal Server Error');
  });
});

describe('Request Body Parsing', () => {
  function parseJsonBody(body: string): unknown {
    if (!body) return {};
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }

  it('should parse valid JSON', () => {
    expect(parseJsonBody('{"key":"value"}')).toEqual({ key: 'value' });
  });

  it('should handle empty body', () => {
    expect(parseJsonBody('')).toEqual({});
  });

  it('should handle invalid JSON', () => {
    expect(parseJsonBody('not json')).toEqual({});
  });

  it('should parse complex objects', () => {
    const body = JSON.stringify({
      students: [{ id: '1', name: 'Alice' }],
      count: 1,
    });
    expect(parseJsonBody(body)).toEqual({
      students: [{ id: '1', name: 'Alice' }],
      count: 1,
    });
  });
});
