/**
 * EduGenius API Server
 * REST API for all system operations
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { EduGeniusOrchestrator, getOrchestrator } from '../orchestrator';

// ============================================================================
// Types
// ============================================================================

export interface APIConfig {
  port: number;
  host: string;
  corsOrigins?: string[];
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
  auth?: {
    enabled: boolean;
    apiKeys?: string[];
  };
}

interface RouteHandler {
  (req: ParsedRequest, res: ServerResponse): Promise<void>;
}

interface ParsedRequest extends IncomingMessage {
  pathname: string;
  query: URLSearchParams;
  params: Record<string, string>;
  body: unknown;
}

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

// ============================================================================
// API Server Implementation
// ============================================================================

export class APIServer {
  private config: APIConfig;
  private server: ReturnType<typeof createServer> | null = null;
  private orchestrator: EduGeniusOrchestrator;
  private routes: Route[] = [];
  private rateLimitStore: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(config: Partial<APIConfig> = {}) {
    this.config = {
      port: 3000,
      host: '0.0.0.0',
      corsOrigins: ['*'],
      rateLimit: {
        windowMs: 60000,
        maxRequests: 100,
      },
      auth: {
        enabled: false,
      },
      ...config,
    };

    this.orchestrator = getOrchestrator();
    this.registerRoutes();
  }

  // -------------------------------------------------------------------------
  // Server Lifecycle
  // -------------------------------------------------------------------------

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer(this.handleRequest.bind(this));

      this.server.on('error', reject);

      this.server.listen(this.config.port, this.config.host, () => {
        console.log(`[API] Server listening on http://${this.config.host}:${this.config.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[API] Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // -------------------------------------------------------------------------
  // Request Handling
  // -------------------------------------------------------------------------

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startTime = Date.now();

    try {
      // Parse request
      const parsedReq = await this.parseRequest(req);

      // CORS
      this.setCORSHeaders(res);

      // Handle preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Rate limiting
      if (!this.checkRateLimit(req, res)) {
        return;
      }

      // Authentication
      if (!this.checkAuth(req, res)) {
        return;
      }

      // Route matching
      const route = this.matchRoute(req.method || 'GET', parsedReq.pathname);

      if (!route) {
        this.sendError(res, 404, 'Not Found');
        return;
      }

      // Extract params
      const match = parsedReq.pathname.match(route.pattern);
      if (match) {
        route.paramNames.forEach((name, i) => {
          parsedReq.params[name] = match[i + 1];
        });
      }

      // Execute handler
      await route.handler(parsedReq, res);

    } catch (error) {
      console.error('[API] Error:', error);
      this.sendError(res, 500, 'Internal Server Error');
    } finally {
      const duration = Date.now() - startTime;
      console.log(`[API] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    }
  }

  private async parseRequest(req: IncomingMessage): Promise<ParsedRequest> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    const parsedReq = req as ParsedRequest;
    parsedReq.pathname = url.pathname;
    parsedReq.query = url.searchParams;
    parsedReq.params = {};

    // Parse body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
      parsedReq.body = await this.parseBody(req);
    }

    return parsedReq;
  }

  private parseBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          resolve({});
        }
      });
      req.on('error', reject);
    });
  }

  // -------------------------------------------------------------------------
  // Middleware
  // -------------------------------------------------------------------------

  private setCORSHeaders(res: ServerResponse): void {
    const origins = this.config.corsOrigins?.join(', ') || '*';
    res.setHeader('Access-Control-Allow-Origin', origins);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  }

  private checkRateLimit(req: IncomingMessage, res: ServerResponse): boolean {
    if (!this.config.rateLimit) return true;

    const ip = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = this.rateLimitStore.get(ip);

    if (!entry || now > entry.resetAt) {
      this.rateLimitStore.set(ip, {
        count: 1,
        resetAt: now + this.config.rateLimit.windowMs,
      });
      return true;
    }

    if (entry.count >= this.config.rateLimit.maxRequests) {
      this.sendError(res, 429, 'Too Many Requests');
      return false;
    }

    entry.count++;
    return true;
  }

  private checkAuth(req: IncomingMessage, res: ServerResponse): boolean {
    if (!this.config.auth?.enabled) return true;

    const apiKey = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '');

    if (!apiKey || !this.config.auth.apiKeys?.includes(apiKey as string)) {
      this.sendError(res, 401, 'Unauthorized');
      return false;
    }

    return true;
  }

  // -------------------------------------------------------------------------
  // Routing
  // -------------------------------------------------------------------------

  private registerRoute(method: string, path: string, handler: RouteHandler): void {
    const paramNames: string[] = [];
    const pattern = path.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });

    this.routes.push({
      method,
      pattern: new RegExp(`^${pattern}$`),
      paramNames,
      handler,
    });
  }

  private matchRoute(method: string, pathname: string): Route | undefined {
    return this.routes.find(
      route => route.method === method && route.pattern.test(pathname)
    );
  }

  private registerRoutes(): void {
    // Health & Status
    this.registerRoute('GET', '/health', this.handleHealth.bind(this));
    this.registerRoute('GET', '/status', this.handleStatus.bind(this));

    // Agents
    this.registerRoute('GET', '/agents', this.handleListAgents.bind(this));
    this.registerRoute('GET', '/agents/:agentId', this.handleGetAgent.bind(this));

    // Workflows
    this.registerRoute('GET', '/workflows', this.handleListWorkflows.bind(this));
    this.registerRoute('POST', '/workflows/:workflowId/start', this.handleStartWorkflow.bind(this));
    this.registerRoute('GET', '/workflows/instances/:instanceId', this.handleGetWorkflowInstance.bind(this));

    // Tutoring (Sage)
    this.registerRoute('POST', '/tutoring/sessions', this.handleStartSession.bind(this));
    this.registerRoute('POST', '/tutoring/sessions/:sessionId/ask', this.handleAskTutor.bind(this));
    this.registerRoute('GET', '/tutoring/sessions/:sessionId', this.handleGetSession.bind(this));

    // Content (Atlas)
    this.registerRoute('POST', '/content', this.handleCreateContent.bind(this));
    this.registerRoute('GET', '/content/:contentId', this.handleGetContent.bind(this));

    // Students (Mentor)
    this.registerRoute('GET', '/students/:studentId/engagement', this.handleGetEngagement.bind(this));
    this.registerRoute('POST', '/students/:studentId/nudge', this.handleSendNudge.bind(this));

    // Campaigns (Herald)
    this.registerRoute('POST', '/campaigns', this.handleCreateCampaign.bind(this));
    this.registerRoute('GET', '/campaigns', this.handleListCampaigns.bind(this));

    // Deployments (Forge)
    this.registerRoute('POST', '/deploy', this.handleDeploy.bind(this));
    this.registerRoute('GET', '/deploy/:deploymentId', this.handleGetDeployment.bind(this));
    this.registerRoute('GET', '/health-check', this.handleHealthCheck.bind(this));

    // Analytics (Oracle)
    this.registerRoute('GET', '/analytics/report', this.handleGetReport.bind(this));
    this.registerRoute('GET', '/analytics/funnel', this.handleGetFunnel.bind(this));
    this.registerRoute('GET', '/analytics/cohorts', this.handleGetCohorts.bind(this));
    this.registerRoute('POST', '/analytics/metrics', this.handleRecordMetric.bind(this));
  }

  // -------------------------------------------------------------------------
  // Response Helpers
  // -------------------------------------------------------------------------

  private sendJSON(res: ServerResponse, data: unknown, status: number = 200): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  private sendError(res: ServerResponse, status: number, message: string): void {
    this.sendJSON(res, { error: message }, status);
  }

  // -------------------------------------------------------------------------
  // Route Handlers
  // -------------------------------------------------------------------------

  private async handleHealth(req: ParsedRequest, res: ServerResponse): Promise<void> {
    this.sendJSON(res, { status: 'ok', timestamp: Date.now() });
  }

  private async handleStatus(req: ParsedRequest, res: ServerResponse): Promise<void> {
    const status = this.orchestrator.getStatus();
    this.sendJSON(res, status);
  }

  private async handleListAgents(req: ParsedRequest, res: ServerResponse): Promise<void> {
    const status = this.orchestrator.getStatus();
    this.sendJSON(res, { agents: status.agents });
  }

  private async handleGetAgent(req: ParsedRequest, res: ServerResponse): Promise<void> {
    const agentId = req.params.agentId as any;
    const agent = this.orchestrator.getAgent(agentId);

    if (!agent) {
      this.sendError(res, 404, 'Agent not found');
      return;
    }

    const state = agent.getState();
    const config = agent.getConfig();

    this.sendJSON(res, {
      id: agentId,
      name: config.name,
      description: config.description,
      state,
    });
  }

  private async handleListWorkflows(req: ParsedRequest, res: ServerResponse): Promise<void> {
    // Would get from workflow orchestrator
    this.sendJSON(res, {
      workflows: [
        { id: 'exam-launch', name: 'New Exam Launch' },
        { id: 'daily-ops', name: 'Daily Operations' },
        { id: 'student-session', name: 'Student Learning Session' },
        { id: 'content-pipeline', name: 'Content Creation Pipeline' },
        { id: 'deployment', name: 'Production Deployment' },
      ],
    });
  }

  private async handleStartWorkflow(req: ParsedRequest, res: ServerResponse): Promise<void> {
    const { workflowId } = req.params;
    const input = req.body as Record<string, unknown>;

    try {
      const instanceId = await this.orchestrator.startWorkflow(workflowId, input);
      this.sendJSON(res, { instanceId, workflowId, status: 'started' }, 201);
    } catch (error) {
      this.sendError(res, 400, (error as Error).message);
    }
  }

  private async handleGetWorkflowInstance(req: ParsedRequest, res: ServerResponse): Promise<void> {
    const { instanceId } = req.params;
    const status = await this.orchestrator.getWorkflowStatus(instanceId);

    if (!status) {
      this.sendError(res, 404, 'Workflow instance not found');
      return;
    }

    this.sendJSON(res, status);
  }

  private async handleStartSession(req: ParsedRequest, res: ServerResponse): Promise<void> {
    const body = req.body as { studentId: string; topic?: string };

    if (!body.studentId) {
      this.sendError(res, 400, 'studentId is required');
      return;
    }

    try {
      const sessionId = await this.orchestrator.startTutoringSession(body.studentId, body.topic);
      this.sendJSON(res, { sessionId, studentId: body.studentId }, 201);
    } catch (error) {
      this.sendError(res, 500, (error as Error).message);
    }
  }

  private async handleAskTutor(req: ParsedRequest, res: ServerResponse): Promise<void> {
    const { sessionId } = req.params;
    const body = req.body as { question: string };

    if (!body.question) {
      this.sendError(res, 400, 'question is required');
      return;
    }

    // Get Sage agent and call ask
    const sage = this.orchestrator.getAgent('Sage') as any;
    if (!sage) {
      this.sendError(res, 503, 'Tutor service unavailable');
      return;
    }

    try {
      await sage.ask(sessionId, body.question);
      // Response would come via events
      this.sendJSON(res, { status: 'processing', sessionId });
    } catch (error) {
      this.sendError(res, 500, (error as Error).message);
    }
  }

  private async handleGetSession(req: ParsedRequest, res: ServerResponse): Promise<void> {
    const { sessionId } = req.params;

    const sage = this.orchestrator.getAgent('Sage') as any;
    if (!sage) {
      this.sendError(res, 503, 'Tutor service unavailable');
      return;
    }

    const session = sage.getSession(sessionId);
    if (!session) {
      this.sendError(res, 404, 'Session not found');
      return;
    }

    this.sendJSON(res, session);
  }

  private async handleCreateContent(req: ParsedRequest, res: ServerResponse): Promise<void> {
    const body = req.body as { topic: string; type: string; subject: string };

    if (!body.topic || !body.type || !body.subject) {
      this.sendError(res, 400, 'topic, type, and subject are required');
      return;
    }

    try {
      const result = await this.orchestrator.createContent(body);
      this.sendJSON(res, result, 201);
    } catch (error) {
      this.sendError(res, 500, (error as Error).message);
    }
  }

  private async handleGetContent(req: ParsedRequest, res: ServerResponse): Promise<void> {
    // Would fetch from content repository
    this.sendJSON(res, { id: req.params.contentId, status: 'not_implemented' });
  }

  private async handleGetEngagement(req: ParsedRequest, res: ServerResponse): Promise<void> {
    const { studentId } = req.params;

    try {
      const engagement = await this.orchestrator.checkStudentEngagement(studentId);
      this.sendJSON(res, engagement);
    } catch (error) {
      this.sendError(res, 500, (error as Error).message);
    }
  }

  private async handleSendNudge(req: ParsedRequest, res: ServerResponse): Promise<void> {
    const { studentId } = req.params;
    const body = req.body as { message: string; channel?: string };

    const mentor = this.orchestrator.getAgent('Mentor') as any;
    if (!mentor) {
      this.sendError(res, 503, 'Mentor service unavailable');
      return;
    }

    try {
      await mentor.sendCustomNudge(studentId, body.message, body.channel || 'push');
      this.sendJSON(res, { status: 'sent', studentId });
    } catch (error) {
      this.sendError(res, 500, (error as Error).message);
    }
  }

  private async handleCreateCampaign(req: ParsedRequest, res: ServerResponse): Promise<void> {
    const body = req.body as { name: string; type: string; channels: string[] };

    if (!body.name || !body.type || !body.channels) {
      this.sendError(res, 400, 'name, type, and channels are required');
      return;
    }

    try {
      const campaignId = await this.orchestrator.launchCampaign(body);
      this.sendJSON(res, { campaignId, status: 'launched' }, 201);
    } catch (error) {
      this.sendError(res, 500, (error as Error).message);
    }
  }

  private async handleListCampaigns(req: ParsedRequest, res: ServerResponse): Promise<void> {
    const herald = this.orchestrator.getAgent('Herald') as any;
    if (!herald) {
      this.sendError(res, 503, 'Herald service unavailable');
      return;
    }

    const campaigns = herald.getActiveCampaigns();
    this.sendJSON(res, { campaigns });
  }

  private async handleDeploy(req: ParsedRequest, res: ServerResponse): Promise<void> {
    const body = req.body as { environment: 'development' | 'staging' | 'production'; version: string };

    if (!body.environment || !body.version) {
      this.sendError(res, 400, 'environment and version are required');
      return;
    }

    try {
      const deploymentId = await this.orchestrator.deploy(body.environment, body.version);
      this.sendJSON(res, { deploymentId, status: 'started' }, 201);
    } catch (error) {
      this.sendError(res, 500, (error as Error).message);
    }
  }

  private async handleGetDeployment(req: ParsedRequest, res: ServerResponse): Promise<void> {
    const { deploymentId } = req.params;

    const forge = this.orchestrator.getAgent('Forge') as any;
    if (!forge) {
      this.sendError(res, 503, 'Forge service unavailable');
      return;
    }

    const deployment = forge.getDeploymentStatus(deploymentId);
    if (!deployment) {
      this.sendError(res, 404, 'Deployment not found');
      return;
    }

    this.sendJSON(res, deployment);
  }

  private async handleHealthCheck(req: ParsedRequest, res: ServerResponse): Promise<void> {
    try {
      const result = await this.orchestrator.runHealthCheck();
      this.sendJSON(res, result);
    } catch (error) {
      this.sendError(res, 500, (error as Error).message);
    }
  }

  private async handleGetReport(req: ParsedRequest, res: ServerResponse): Promise<void> {
    const type = (req.query.get('type') as 'daily' | 'weekly' | 'monthly') || 'daily';

    try {
      const report = await this.orchestrator.getReport(type);
      this.sendJSON(res, report);
    } catch (error) {
      this.sendError(res, 500, (error as Error).message);
    }
  }

  private async handleGetFunnel(req: ParsedRequest, res: ServerResponse): Promise<void> {
    try {
      const funnel = await this.orchestrator.getFunnelAnalysis();
      this.sendJSON(res, funnel);
    } catch (error) {
      this.sendError(res, 500, (error as Error).message);
    }
  }

  private async handleGetCohorts(req: ParsedRequest, res: ServerResponse): Promise<void> {
    const oracle = this.orchestrator.getAgent('Oracle') as any;
    if (!oracle) {
      this.sendError(res, 503, 'Oracle service unavailable');
      return;
    }

    try {
      const cohorts = await oracle.getCohortAnalysis();
      this.sendJSON(res, cohorts);
    } catch (error) {
      this.sendError(res, 500, (error as Error).message);
    }
  }

  private async handleRecordMetric(req: ParsedRequest, res: ServerResponse): Promise<void> {
    const body = req.body as { name: string; value: number; dimensions?: Record<string, string> };

    if (!body.name || body.value === undefined) {
      this.sendError(res, 400, 'name and value are required');
      return;
    }

    const oracle = this.orchestrator.getAgent('Oracle') as any;
    if (!oracle) {
      this.sendError(res, 503, 'Oracle service unavailable');
      return;
    }

    try {
      await oracle.recordMetric(body.name, body.value, body.dimensions);
      this.sendJSON(res, { status: 'recorded' }, 201);
    } catch (error) {
      this.sendError(res, 500, (error as Error).message);
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export function createAPIServer(config?: Partial<APIConfig>): APIServer {
  return new APIServer(config);
}
