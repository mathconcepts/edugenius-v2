# Testing Guide

Comprehensive guide to testing the EduGenius platform.

---

## Test Structure

```
src/__tests__/
├── unit/
│   ├── agents/
│   │   ├── base-agent.test.ts
│   │   ├── sage.test.ts
│   │   ├── mentor.test.ts
│   │   └── oracle.test.ts
│   ├── api/
│   │   └── server.test.ts
│   ├── data/
│   │   └── cache.test.ts
│   ├── events/
│   │   └── event-bus.test.ts
│   ├── llm/
│   │   └── llm-client.test.ts
│   └── utils/
│       ├── validation.test.ts
│       └── retry.test.ts
└── integration/
    ├── orchestrator.test.ts
    └── api.test.ts
```

---

## Running Tests

### All Tests

```bash
npm test
```

### Watch Mode

```bash
npm run test:watch
```

### With Coverage

```bash
npm run test:coverage
```

### Specific Test File

```bash
npx vitest run src/__tests__/unit/agents/sage.test.ts
```

### Specific Test Pattern

```bash
npx vitest run -t "should start a new session"
```

---

## Test Configuration

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/__tests__/**',
        'src/index.ts',
      ],
    },
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
  },
});
```

---

## Unit Tests

### Testing Agents

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SageAgent } from '../../../agents/sage';

describe('SageAgent', () => {
  let sage: SageAgent;

  beforeEach(async () => {
    sage = new SageAgent();
    await sage.start();
  });

  afterEach(async () => {
    await sage.stop();
  });

  it('should start a new session', async () => {
    const sessionId = await sage.startSession('student-1', 'algebra');
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');
  });

  it('should handle questions', async () => {
    const sessionId = await sage.startSession('student-1', 'algebra');
    await expect(
      sage.ask(sessionId, 'What is algebra?')
    ).resolves.not.toThrow();
  });

  it('should throw for invalid session', async () => {
    await expect(
      sage.ask('invalid-session', 'Question')
    ).rejects.toThrow('Session not found');
  });
});
```

### Testing Event Bus

```typescript
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../../events/event-bus';

describe('EventBus', () => {
  it('should publish and receive events', async () => {
    const eventBus = new EventBus();
    const handler = vi.fn();

    eventBus.subscribe('test.event', handler);
    await eventBus.publish('test.event', { data: 'test' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'test.event',
        payload: { data: 'test' },
      })
    );
  });

  it('should support wildcards', async () => {
    const eventBus = new EventBus();
    const handler = vi.fn();

    eventBus.subscribeAll('agent.*', handler);
    await eventBus.publish('agent.scout.event', {});
    await eventBus.publish('agent.atlas.event', {});

    expect(handler).toHaveBeenCalledTimes(2);
  });
});
```

### Testing Validation

```typescript
import { describe, it, expect } from 'vitest';
import { validateString, validateNumber, ValidationError } from '../../../utils/validation';

describe('validateString', () => {
  it('should return valid string', () => {
    expect(validateString('hello')).toBe('hello');
  });

  it('should throw for required empty', () => {
    expect(() => validateString('', { required: true }))
      .toThrow(ValidationError);
  });

  it('should enforce maxLength', () => {
    expect(() => validateString('hello world', { maxLength: 5 }))
      .toThrow(ValidationError);
  });
});
```

### Testing Retry Logic

```typescript
import { describe, it, expect, vi } from 'vitest';
import { retry, CircuitBreaker } from '../../../utils/retry';

describe('retry', () => {
  it('should retry on failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const result = await retry(fn, { maxAttempts: 2, initialDelayMs: 10 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('CircuitBreaker', () => {
  it('should open after threshold failures', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(breaker.execute(fn)).rejects.toThrow();
    await expect(breaker.execute(fn)).rejects.toThrow();

    expect(breaker.getState()).toBe('open');
  });
});
```

---

## Integration Tests

### Testing Orchestrator

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getOrchestrator, resetOrchestrator } from '../../orchestrator';

describe('EduGenius Orchestrator', () => {
  let orchestrator;

  beforeAll(async () => {
    orchestrator = getOrchestrator();
    await orchestrator.start();
  });

  afterAll(async () => {
    await orchestrator.stop();
    resetOrchestrator();
  });

  it('should have all agents running', () => {
    const status = orchestrator.getStatus();
    expect(status.agents.length).toBe(7);
  });

  it('should start tutoring session', async () => {
    const sessionId = await orchestrator.startTutoringSession(
      'test-student',
      'algebra'
    );
    expect(sessionId).toBeDefined();
  });

  it('should run health check', async () => {
    const health = await orchestrator.runHealthCheck();
    expect(health.success).toBe(true);
  });
});
```

### Testing API

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAPIServer } from '../../api';
import { getOrchestrator, resetOrchestrator } from '../../orchestrator';

describe('API Server', () => {
  let server;
  const port = 3099;
  const baseUrl = `http://localhost:${port}`;

  beforeAll(async () => {
    const orchestrator = getOrchestrator();
    await orchestrator.start();
    server = createAPIServer({ port });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
    await getOrchestrator().stop();
    resetOrchestrator();
  });

  it('GET /health returns ok', async () => {
    const response = await fetch(`${baseUrl}/health`);
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  it('POST /tutoring/sessions creates session', async () => {
    const response = await fetch(`${baseUrl}/tutoring/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 'test', topic: 'math' }),
    });
    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data.sessionId).toBeDefined();
  });
});
```

---

## Mocking

### Mocking LLM Calls

```typescript
import { vi } from 'vitest';
import { LLMClient } from '../../../llm';

vi.mock('../../../llm', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue({
      content: 'Mocked response',
      tokensUsed: { input: 10, output: 20 },
    }),
  })),
}));
```

### Mocking External APIs

```typescript
vi.mock('node-fetch', () => ({
  default: vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ data: 'mocked' }),
  }),
}));
```

---

## Test Patterns

### Edge Cases to Test

1. **Empty inputs**
   ```typescript
   it('should handle empty question', async () => {
     await expect(sage.ask(sessionId, '')).resolves.not.toThrow();
   });
   ```

2. **Null/undefined**
   ```typescript
   it('should handle null studentId', () => {
     expect(() => validateStudentId(null)).toThrow();
   });
   ```

3. **Concurrent operations**
   ```typescript
   it('should handle concurrent sessions', async () => {
     const promises = Array(10).fill(null).map((_, i) =>
       sage.startSession(`student-${i}`, 'math')
     );
     const sessions = await Promise.all(promises);
     expect(sessions).toHaveLength(10);
   });
   ```

4. **Unicode/special characters**
   ```typescript
   it('should handle unicode topic', async () => {
     const sessionId = await sage.startSession('student', '数学');
     expect(sage.getSession(sessionId)?.topic).toBe('数学');
   });
   ```

5. **Lifecycle transitions**
   ```typescript
   it('should handle rapid start/stop', async () => {
     for (let i = 0; i < 5; i++) {
       await agent.start();
       await agent.stop();
     }
     expect(agent.getState().status).toBe('offline');
   });
   ```

---

## Coverage Goals

| Category | Target |
|----------|--------|
| Statements | 80% |
| Branches | 75% |
| Functions | 85% |
| Lines | 80% |

### Viewing Coverage

After running `npm run test:coverage`:

```bash
# Text report in terminal
# HTML report in coverage/index.html
open coverage/index.html
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
```

---

## Debugging Tests

### Verbose Output

```bash
npx vitest run --reporter=verbose
```

### Single Test with Logging

```typescript
it.only('debug this test', async () => {
  console.log('Debugging...');
  // Your test code
});
```

### VS Code Integration

```json
// .vscode/launch.json
{
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "--reporter=verbose"],
      "console": "integratedTerminal"
    }
  ]
}
```

---

## Best Practices

1. **Isolate tests** — Each test should be independent
2. **Clean up** — Use afterEach/afterAll for cleanup
3. **Descriptive names** — Test names should describe behavior
4. **Test edge cases** — Don't just test happy paths
5. **Mock external dependencies** — Don't hit real APIs
6. **Keep tests fast** — Use short timeouts in tests
7. **Test public APIs** — Focus on behavior, not implementation
