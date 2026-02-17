/**
 * EduGenius Orchestrator
 * Master coordinator for all agents and system operations
 */

import { EventEmitter } from 'events';
import { EventBus } from '../events/event-bus';
import { WorkflowOrchestrator, WorkflowDefinition } from '../events/workflow-orchestrator';
import { LLMClient } from '../llm';
import { Cache } from '../data/cache';
import {
  BaseAgent,
  ScoutAgent,
  AtlasAgent,
  SageAgent,
  MentorAgent,
  HeraldAgent,
  ForgeAgent,
  OracleAgent,
  AGENT_CONFIGS,
} from '../agents';
import { AgentId } from '../events/types';

// ============================================================================
// Types
// ============================================================================

export interface OrchestratorConfig {
  enabledAgents?: AgentId[];
  llmConfig?: {
    defaultProvider: string;
    fallbackProviders?: string[];
  };
  cacheConfig?: {
    host: string;
    port: number;
  };
  heartbeatEnabled?: boolean;
  metricsEnabled?: boolean;
}

export interface SystemStatus {
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  uptime: number;
  agents: AgentStatus[];
  metrics: SystemMetrics;
}

export interface AgentStatus {
  id: AgentId;
  status: 'active' | 'idle' | 'busy' | 'blocked' | 'offline';
  lastHeartbeat: number;
  tokensUsedToday: number;
  errors: number;
}

export interface SystemMetrics {
  totalEvents: number;
  eventsPerMinute: number;
  activeWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  cacheHitRate: number;
}

// ============================================================================
// Orchestrator Implementation
// ============================================================================

export class EduGeniusOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error' = 'stopped';
  private startTime: number = 0;

  // Core infrastructure
  private eventBus: EventBus;
  private workflowOrchestrator: WorkflowOrchestrator;
  private llmClient: LLMClient | null = null;
  private cache: Cache;

  // Agents
  private agents: Map<AgentId, BaseAgent> = new Map();

  // Metrics
  private metrics: SystemMetrics = {
    totalEvents: 0,
    eventsPerMinute: 0,
    activeWorkflows: 0,
    completedWorkflows: 0,
    failedWorkflows: 0,
    cacheHitRate: 0,
  };

  constructor(config: OrchestratorConfig = {}) {
    super();
    this.config = {
      enabledAgents: ['Scout', 'Atlas', 'Sage', 'Mentor', 'Herald', 'Forge', 'Oracle'],
      heartbeatEnabled: true,
      metricsEnabled: true,
      ...config,
    };

    // Initialize infrastructure
    this.eventBus = new EventBus();
    this.workflowOrchestrator = new WorkflowOrchestrator(this.eventBus);
    this.cache = new Cache();
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async start(): Promise<void> {
    if (this.status === 'running') {
      throw new Error('Orchestrator is already running');
    }

    this.status = 'starting';
    this.startTime = Date.now();
    this.emit('starting');

    try {
      // 1. Initialize cache
      await this.cache.connect();
      console.log('[Orchestrator] Cache connected');

      // 2. Register workflows
      this.registerWorkflows();
      console.log('[Orchestrator] Workflows registered');

      // 3. Setup event listeners
      this.setupEventListeners();
      console.log('[Orchestrator] Event listeners ready');

      // 4. Initialize and start agents
      await this.initializeAgents();
      console.log(`[Orchestrator] ${this.agents.size} agents initialized`);

      // 5. Start agents
      await this.startAgents();
      console.log('[Orchestrator] All agents started');

      this.status = 'running';
      this.emit('started');
      console.log('[Orchestrator] System ready');

    } catch (error) {
      this.status = 'error';
      this.emit('error', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.status !== 'running') {
      return;
    }

    this.status = 'stopping';
    this.emit('stopping');

    try {
      // Stop all agents
      await this.stopAgents();

      // Disconnect cache
      await this.cache.disconnect();

      this.status = 'stopped';
      this.emit('stopped');
      console.log('[Orchestrator] System stopped');

    } catch (error) {
      this.status = 'error';
      this.emit('error', error);
      throw error;
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  // -------------------------------------------------------------------------
  // Agent Management
  // -------------------------------------------------------------------------

  private async initializeAgents(): Promise<void> {
    const agentFactories: Record<AgentId, () => BaseAgent> = {
      Jarvis: () => { throw new Error('Jarvis is the orchestrator itself'); },
      Scout: () => new ScoutAgent(),
      Atlas: () => new AtlasAgent(),
      Sage: () => new SageAgent(),
      Mentor: () => new MentorAgent(),
      Herald: () => new HeraldAgent(),
      Forge: () => new ForgeAgent(),
      Oracle: () => new OracleAgent(),
    };

    for (const agentId of this.config.enabledAgents || []) {
      if (agentId === 'Jarvis') continue; // Skip Jarvis (orchestrator)

      const factory = agentFactories[agentId];
      if (factory) {
        const agent = factory();
        this.agents.set(agentId, agent);
      }
    }
  }

  private async startAgents(): Promise<void> {
    const startPromises = Array.from(this.agents.values()).map(agent => agent.start());
    await Promise.all(startPromises);
  }

  private async stopAgents(): Promise<void> {
    const stopPromises = Array.from(this.agents.values()).map(agent => agent.stop());
    await Promise.all(stopPromises);
  }

  getAgent<T extends BaseAgent>(agentId: AgentId): T | undefined {
    return this.agents.get(agentId) as T | undefined;
  }

  // -------------------------------------------------------------------------
  // Workflow Registration
  // -------------------------------------------------------------------------

  private registerWorkflows(): void {
    // New Exam Launch Workflow
    this.workflowOrchestrator.registerWorkflow(this.createExamLaunchWorkflow());

    // Daily Operations Workflow
    this.workflowOrchestrator.registerWorkflow(this.createDailyOpsWorkflow());

    // Student Session Workflow
    this.workflowOrchestrator.registerWorkflow(this.createStudentSessionWorkflow());

    // Content Pipeline Workflow
    this.workflowOrchestrator.registerWorkflow(this.createContentPipelineWorkflow());

    // Deployment Workflow
    this.workflowOrchestrator.registerWorkflow(this.createDeploymentWorkflow());
  }

  private createExamLaunchWorkflow(): WorkflowDefinition {
    return {
      id: 'exam-launch',
      name: 'New Exam Launch',
      description: 'End-to-end workflow for launching a new exam',
      version: '1.0.0',
      steps: [
        {
          id: 'research',
          name: 'Market Research',
          agentId: 'Scout',
          action: 'analyze_exam',
          timeout: 300000,
          retries: 2,
        },
        {
          id: 'content-plan',
          name: 'Content Planning',
          agentId: 'Atlas',
          action: 'plan_content',
          dependencies: ['research'],
          timeout: 180000,
        },
        {
          id: 'content-create',
          name: 'Content Creation',
          agentId: 'Atlas',
          action: 'create_content',
          dependencies: ['content-plan'],
          timeout: 600000,
        },
        {
          id: 'marketing-prep',
          name: 'Marketing Preparation',
          agentId: 'Herald',
          action: 'prepare_launch',
          dependencies: ['content-plan'],
          timeout: 300000,
        },
        {
          id: 'deploy',
          name: 'Deploy Content',
          agentId: 'Forge',
          action: 'deploy',
          dependencies: ['content-create'],
          timeout: 300000,
        },
        {
          id: 'launch-marketing',
          name: 'Launch Marketing',
          agentId: 'Herald',
          action: 'launch_campaign',
          dependencies: ['deploy', 'marketing-prep'],
          timeout: 180000,
        },
        {
          id: 'monitor',
          name: 'Monitor Launch',
          agentId: 'Oracle',
          action: 'track_launch',
          dependencies: ['launch-marketing'],
          timeout: 3600000,
        },
      ],
      triggers: [
        { type: 'event', event: 'exam.launch.requested' },
        { type: 'manual' },
      ],
    };
  }

  private createDailyOpsWorkflow(): WorkflowDefinition {
    return {
      id: 'daily-ops',
      name: 'Daily Operations',
      description: 'Daily automated operations across all agents',
      version: '1.0.0',
      steps: [
        {
          id: 'market-scan',
          name: 'Morning Market Scan',
          agentId: 'Scout',
          action: 'daily_scan',
          timeout: 300000,
        },
        {
          id: 'content-queue',
          name: 'Process Content Queue',
          agentId: 'Atlas',
          action: 'process_queue',
          timeout: 600000,
        },
        {
          id: 'engagement-check',
          name: 'Check Engagement',
          agentId: 'Mentor',
          action: 'daily_engagement',
          timeout: 300000,
        },
        {
          id: 'scheduled-posts',
          name: 'Process Scheduled Posts',
          agentId: 'Herald',
          action: 'process_scheduled',
          timeout: 300000,
        },
        {
          id: 'health-check',
          name: 'System Health Check',
          agentId: 'Forge',
          action: 'health_check',
          timeout: 120000,
        },
        {
          id: 'daily-report',
          name: 'Generate Daily Report',
          agentId: 'Oracle',
          action: 'daily_report',
          dependencies: ['market-scan', 'content-queue', 'engagement-check', 'scheduled-posts', 'health-check'],
          timeout: 180000,
        },
      ],
      triggers: [
        { type: 'schedule', cron: '0 6 * * *' }, // 6 AM daily
        { type: 'manual' },
      ],
    };
  }

  private createStudentSessionWorkflow(): WorkflowDefinition {
    return {
      id: 'student-session',
      name: 'Student Learning Session',
      description: 'Complete student interaction workflow',
      version: '1.0.0',
      steps: [
        {
          id: 'session-start',
          name: 'Initialize Session',
          agentId: 'Sage',
          action: 'start_session',
          timeout: 30000,
        },
        {
          id: 'tutoring',
          name: 'Tutoring Interaction',
          agentId: 'Sage',
          action: 'tutor',
          dependencies: ['session-start'],
          timeout: 3600000, // 1 hour max session
        },
        {
          id: 'session-end',
          name: 'End Session',
          agentId: 'Sage',
          action: 'end_session',
          dependencies: ['tutoring'],
          timeout: 30000,
        },
        {
          id: 'update-progress',
          name: 'Update Progress',
          agentId: 'Mentor',
          action: 'update_progress',
          dependencies: ['session-end'],
          timeout: 60000,
        },
        {
          id: 'track-analytics',
          name: 'Track Analytics',
          agentId: 'Oracle',
          action: 'track_session',
          dependencies: ['session-end'],
          timeout: 30000,
        },
      ],
      triggers: [
        { type: 'event', event: 'student.session.started' },
      ],
    };
  }

  private createContentPipelineWorkflow(): WorkflowDefinition {
    return {
      id: 'content-pipeline',
      name: 'Content Creation Pipeline',
      description: 'End-to-end content creation and distribution',
      version: '1.0.0',
      steps: [
        {
          id: 'plan',
          name: 'Plan Content',
          agentId: 'Atlas',
          action: 'plan',
          timeout: 120000,
        },
        {
          id: 'create',
          name: 'Create Content',
          agentId: 'Atlas',
          action: 'create',
          dependencies: ['plan'],
          timeout: 300000,
        },
        {
          id: 'review',
          name: 'Review & Fact Check',
          agentId: 'Atlas',
          action: 'review',
          dependencies: ['create'],
          timeout: 180000,
        },
        {
          id: 'seo-optimize',
          name: 'SEO Optimization',
          agentId: 'Atlas',
          action: 'seo_optimize',
          dependencies: ['review'],
          timeout: 120000,
        },
        {
          id: 'publish',
          name: 'Publish Content',
          agentId: 'Forge',
          action: 'publish',
          dependencies: ['seo-optimize'],
          timeout: 60000,
        },
        {
          id: 'promote',
          name: 'Promote Content',
          agentId: 'Herald',
          action: 'promote',
          dependencies: ['publish'],
          timeout: 120000,
        },
        {
          id: 'track',
          name: 'Track Performance',
          agentId: 'Oracle',
          action: 'track_content',
          dependencies: ['publish'],
          timeout: 86400000, // 24 hours tracking
        },
      ],
      triggers: [
        { type: 'event', event: 'content.requested' },
        { type: 'manual' },
      ],
    };
  }

  private createDeploymentWorkflow(): WorkflowDefinition {
    return {
      id: 'deployment',
      name: 'Production Deployment',
      description: 'Safe production deployment with rollback',
      version: '1.0.0',
      steps: [
        {
          id: 'build',
          name: 'Build',
          agentId: 'Forge',
          action: 'build',
          timeout: 300000,
        },
        {
          id: 'test',
          name: 'Run Tests',
          agentId: 'Forge',
          action: 'test',
          dependencies: ['build'],
          timeout: 600000,
        },
        {
          id: 'deploy-staging',
          name: 'Deploy to Staging',
          agentId: 'Forge',
          action: 'deploy_staging',
          dependencies: ['test'],
          timeout: 300000,
        },
        {
          id: 'health-staging',
          name: 'Staging Health Check',
          agentId: 'Forge',
          action: 'health_check',
          dependencies: ['deploy-staging'],
          timeout: 120000,
        },
        {
          id: 'deploy-production',
          name: 'Deploy to Production',
          agentId: 'Forge',
          action: 'deploy_production',
          dependencies: ['health-staging'],
          timeout: 300000,
        },
        {
          id: 'health-production',
          name: 'Production Health Check',
          agentId: 'Forge',
          action: 'health_check_production',
          dependencies: ['deploy-production'],
          timeout: 300000,
        },
        {
          id: 'cache-invalidate',
          name: 'Invalidate Caches',
          agentId: 'Forge',
          action: 'invalidate_cache',
          dependencies: ['deploy-production'],
          timeout: 60000,
        },
        {
          id: 'cdn-sync',
          name: 'CDN Sync',
          agentId: 'Forge',
          action: 'cdn_sync',
          dependencies: ['deploy-production'],
          timeout: 120000,
        },
        {
          id: 'notify',
          name: 'Notify Stakeholders',
          agentId: 'Herald',
          action: 'notify_deploy',
          dependencies: ['health-production'],
          timeout: 30000,
        },
      ],
      triggers: [
        { type: 'event', event: 'deploy.requested' },
        { type: 'manual' },
      ],
      compensations: {
        'deploy-production': {
          action: 'rollback',
          agentId: 'Forge',
        },
      },
    };
  }

  // -------------------------------------------------------------------------
  // Event Handling
  // -------------------------------------------------------------------------

  private setupEventListeners(): void {
    // Track all events for metrics
    this.eventBus.subscribeAll('*', () => {
      this.metrics.totalEvents++;
    });

    // Workflow completion tracking
    this.eventBus.subscribe('workflow.completed', () => {
      this.metrics.completedWorkflows++;
      this.metrics.activeWorkflows = Math.max(0, this.metrics.activeWorkflows - 1);
    });

    this.eventBus.subscribe('workflow.failed', () => {
      this.metrics.failedWorkflows++;
      this.metrics.activeWorkflows = Math.max(0, this.metrics.activeWorkflows - 1);
    });

    this.eventBus.subscribe('workflow.started', () => {
      this.metrics.activeWorkflows++;
    });

    // Cross-agent event routing
    this.setupCrossAgentRouting();
  }

  private setupCrossAgentRouting(): void {
    // Scout findings → Atlas content requests
    this.eventBus.subscribe('scout.opportunity.found', (event) => {
      this.eventBus.publish('atlas.content.requested', {
        source: 'scout',
        opportunity: event.payload,
        priority: 'high',
      });
    });

    // Atlas content published → Herald promotion
    this.eventBus.subscribe('atlas.content.published', (event) => {
      this.eventBus.publish('herald.promote.requested', {
        contentId: event.payload.contentId,
        contentType: event.payload.contentType,
        channels: ['social', 'email'],
      });
    });

    // Sage session ended → Mentor progress update
    this.eventBus.subscribe('sage.session.ended', (event) => {
      this.eventBus.publish('mentor.progress.update', {
        studentId: event.payload.studentId,
        sessionData: event.payload,
      });
    });

    // Mentor churn alert → Herald re-engagement
    this.eventBus.subscribe('mentor.engagement.alert', (event) => {
      if (event.payload.alertType === 'churn_risk' && event.payload.score > 0.7) {
        this.eventBus.publish('herald.reengage.requested', {
          studentId: event.payload.studentId,
          urgency: event.payload.urgency,
        });
      }
    });

    // Forge deploy completed → Oracle tracking
    this.eventBus.subscribe('forge.deploy.completed', (event) => {
      this.eventBus.publish('oracle.track.deployment', {
        deploymentId: event.payload.deploymentId,
        version: event.payload.version,
        status: event.payload.status,
      });
    });

    // Oracle anomaly detected → Alert routing
    this.eventBus.subscribe('oracle.anomaly.detected', (event) => {
      if (event.payload.severity === 'critical') {
        // Could trigger Forge rollback
        this.eventBus.publish('forge.evaluate.rollback', {
          metric: event.payload.metric,
          severity: event.payload.severity,
        });
      }
    });
  }

  // -------------------------------------------------------------------------
  // Workflow Execution
  // -------------------------------------------------------------------------

  async startWorkflow(workflowId: string, input?: Record<string, unknown>): Promise<string> {
    const instanceId = await this.workflowOrchestrator.startWorkflow(workflowId, input);
    this.emit('workflow:started', { workflowId, instanceId });
    return instanceId;
  }

  async getWorkflowStatus(instanceId: string): Promise<unknown> {
    return this.workflowOrchestrator.getWorkflowStatus(instanceId);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  getStatus(): SystemStatus {
    const agentStatuses: AgentStatus[] = [];

    for (const [agentId, agent] of this.agents) {
      const state = agent.getState();
      agentStatuses.push({
        id: agentId,
        status: state.status,
        lastHeartbeat: state.lastHeartbeat,
        tokensUsedToday: state.tokensUsedToday,
        errors: state.errors.length,
      });
    }

    return {
      status: this.status,
      uptime: this.status === 'running' ? Date.now() - this.startTime : 0,
      agents: agentStatuses,
      metrics: this.metrics,
    };
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }

  getCache(): Cache {
    return this.cache;
  }

  // -------------------------------------------------------------------------
  // Direct Agent Actions
  // -------------------------------------------------------------------------

  // Scout actions
  async analyzeMarket(examId?: string): Promise<unknown> {
    const scout = this.getAgent<ScoutAgent>('Scout');
    if (!scout) throw new Error('Scout agent not available');
    return scout.runMarketScan();
  }

  // Atlas actions
  async createContent(request: { topic: string; type: string; subject: string }): Promise<unknown> {
    const atlas = this.getAgent<AtlasAgent>('Atlas');
    if (!atlas) throw new Error('Atlas agent not available');
    return atlas.requestContent(request.topic, request.type as any, request.subject);
  }

  // Sage actions
  async startTutoringSession(studentId: string, topic?: string): Promise<string> {
    const sage = this.getAgent<SageAgent>('Sage');
    if (!sage) throw new Error('Sage agent not available');
    return sage.startSession(studentId, topic);
  }

  // Mentor actions
  async checkStudentEngagement(studentId: string): Promise<unknown> {
    const mentor = this.getAgent<MentorAgent>('Mentor');
    if (!mentor) throw new Error('Mentor agent not available');
    return mentor.checkStudentEngagement(studentId);
  }

  // Herald actions
  async launchCampaign(data: { name: string; type: string; channels: string[] }): Promise<string> {
    const herald = this.getAgent<HeraldAgent>('Herald');
    if (!herald) throw new Error('Herald agent not available');
    return herald.launchCampaign({
      name: data.name,
      type: data.type,
      channels: data.channels,
      targetAudience: [],
      startDate: Date.now(),
    });
  }

  // Forge actions
  async deploy(environment: 'development' | 'staging' | 'production', version: string): Promise<string> {
    const forge = this.getAgent<ForgeAgent>('Forge');
    if (!forge) throw new Error('Forge agent not available');
    return forge.deploy(environment, version);
  }

  async runHealthCheck(): Promise<unknown> {
    const forge = this.getAgent<ForgeAgent>('Forge');
    if (!forge) throw new Error('Forge agent not available');
    return forge.runHealthCheck();
  }

  // Oracle actions
  async getReport(type: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<unknown> {
    const oracle = this.getAgent<OracleAgent>('Oracle');
    if (!oracle) throw new Error('Oracle agent not available');
    return oracle.getReport(type);
  }

  async getFunnelAnalysis(): Promise<unknown> {
    const oracle = this.getAgent<OracleAgent>('Oracle');
    if (!oracle) throw new Error('Oracle agent not available');
    return oracle.getFunnelAnalysis();
  }
}

// ============================================================================
// Export singleton
// ============================================================================

let orchestrator: EduGeniusOrchestrator | null = null;

export function getOrchestrator(config?: OrchestratorConfig): EduGeniusOrchestrator {
  if (!orchestrator) {
    orchestrator = new EduGeniusOrchestrator(config);
  }
  return orchestrator;
}

export function resetOrchestrator(): void {
  if (orchestrator) {
    orchestrator.stop().catch(console.error);
    orchestrator = null;
  }
}
