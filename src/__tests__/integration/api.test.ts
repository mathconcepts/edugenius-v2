/**
 * Integration Tests for EduGenius API
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { APIServer, createAPIServer } from '../../api';
import { getOrchestrator, resetOrchestrator } from '../../orchestrator';

describe('EduGenius API Server', () => {
  let server: APIServer;
  const port = 3099; // Use non-standard port for tests
  const baseUrl = `http://localhost:${port}`;

  beforeAll(async () => {
    // Start orchestrator first
    const orchestrator = getOrchestrator();
    await orchestrator.start();

    // Start API server
    server = createAPIServer({ port });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
    const orchestrator = getOrchestrator();
    await orchestrator.stop();
    resetOrchestrator();
  });

  describe('Health & Status', () => {
    it('GET /health returns ok', async () => {
      const response = await fetch(`${baseUrl}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
    });

    it('GET /status returns system status', async () => {
      const response = await fetch(`${baseUrl}/status`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('running');
      expect(data.agents).toBeDefined();
      expect(Array.isArray(data.agents)).toBe(true);
      expect(data.metrics).toBeDefined();
    });
  });

  describe('Agents', () => {
    it('GET /agents lists all agents', async () => {
      const response = await fetch(`${baseUrl}/agents`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agents).toBeDefined();
      expect(data.agents.length).toBe(7);
    });

    it('GET /agents/:agentId returns agent details', async () => {
      const response = await fetch(`${baseUrl}/agents/Scout`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('Scout');
      expect(data.name).toBe('Scout');
      expect(data.state).toBeDefined();
    });

    it('GET /agents/:agentId returns 404 for unknown agent', async () => {
      const response = await fetch(`${baseUrl}/agents/Unknown`);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Agent not found');
    });
  });

  describe('Workflows', () => {
    it('GET /workflows lists available workflows', async () => {
      const response = await fetch(`${baseUrl}/workflows`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.workflows).toBeDefined();
      expect(Array.isArray(data.workflows)).toBe(true);
      expect(data.workflows.length).toBeGreaterThan(0);
    });

    it('POST /workflows/:id/start starts a workflow', async () => {
      const response = await fetch(`${baseUrl}/workflows/daily-ops/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.instanceId).toBeDefined();
      expect(data.workflowId).toBe('daily-ops');
      expect(data.status).toBe('started');
    });
  });

  describe('Tutoring (Sage)', () => {
    let sessionId: string;

    it('POST /tutoring/sessions creates a session', async () => {
      const response = await fetch(`${baseUrl}/tutoring/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: 'test-student-api',
          topic: 'algebra',
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.sessionId).toBeDefined();
      expect(data.studentId).toBe('test-student-api');

      sessionId = data.sessionId;
    });

    it('POST /tutoring/sessions requires studentId', async () => {
      const response = await fetch(`${baseUrl}/tutoring/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('studentId is required');
    });

    it('GET /tutoring/sessions/:id returns session', async () => {
      const response = await fetch(`${baseUrl}/tutoring/sessions/${sessionId}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(sessionId);
    });

    it('POST /tutoring/sessions/:id/ask sends question', async () => {
      const response = await fetch(`${baseUrl}/tutoring/sessions/${sessionId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'What is algebra?' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('processing');
    });
  });

  describe('Students (Mentor)', () => {
    it('GET /students/:id/engagement returns engagement score', async () => {
      const response = await fetch(`${baseUrl}/students/test-student-api/engagement`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.studentId).toBe('test-student-api');
      expect(typeof data.score).toBe('number');
      expect(typeof data.churnRisk).toBe('number');
    });

    it('POST /students/:id/nudge sends nudge', async () => {
      const response = await fetch(`${baseUrl}/students/test-student-api/nudge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Keep learning!',
          channel: 'push',
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('sent');
    });
  });

  describe('Campaigns (Herald)', () => {
    it('POST /campaigns creates a campaign', async () => {
      const response = await fetch(`${baseUrl}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Campaign',
          type: 'promotional',
          channels: ['email', 'twitter'],
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.campaignId).toBeDefined();
      expect(data.status).toBe('launched');
    });

    it('GET /campaigns lists campaigns', async () => {
      const response = await fetch(`${baseUrl}/campaigns`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.campaigns).toBeDefined();
      expect(Array.isArray(data.campaigns)).toBe(true);
    });
  });

  describe('Deployments (Forge)', () => {
    it('POST /deploy starts a deployment', async () => {
      const response = await fetch(`${baseUrl}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment: 'staging',
          version: 'v1.0.0-test',
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.deploymentId).toBeDefined();
      expect(data.status).toBe('started');
    });

    it('GET /health-check runs health check', async () => {
      const response = await fetch(`${baseUrl}/health-check`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.overall).toBeDefined();
    });
  });

  describe('Analytics (Oracle)', () => {
    it('GET /analytics/report returns daily report', async () => {
      const response = await fetch(`${baseUrl}/analytics/report`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.type).toBe('daily');
      expect(data.metrics).toBeDefined();
    });

    it('GET /analytics/report?type=weekly returns weekly report', async () => {
      const response = await fetch(`${baseUrl}/analytics/report?type=weekly`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.type).toBe('weekly');
    });

    it('GET /analytics/funnel returns funnel analysis', async () => {
      const response = await fetch(`${baseUrl}/analytics/funnel`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.funnel).toBeDefined();
    });

    it('GET /analytics/cohorts returns cohort analysis', async () => {
      const response = await fetch(`${baseUrl}/analytics/cohorts`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it('POST /analytics/metrics records a metric', async () => {
      const response = await fetch(`${baseUrl}/analytics/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'test.metric',
          value: 42,
          dimensions: { source: 'api-test' },
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.status).toBe('recorded');
    });
  });

  describe('Error Handling', () => {
    it('returns 404 for unknown routes', async () => {
      const response = await fetch(`${baseUrl}/unknown/route`);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not Found');
    });

    it('handles CORS preflight', async () => {
      const response = await fetch(`${baseUrl}/health`, {
        method: 'OPTIONS',
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    });
  });
});
