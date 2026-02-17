/**
 * Content Delivery API Routes
 * Routes for prompts, content pipeline, landing pages, and deployments
 */

import { ServerResponse } from 'http';
import { promptRepository } from '../prompts';
import { blogPipeline, vlogPipeline, contentCalendarManager, landingPageManager } from '../content';
import { deploymentManager } from '../deployment';
import { examConfigManager } from '../config';

// ============================================================================
// Route Handler Type
// ============================================================================

interface ParsedRequest {
  pathname: string;
  query: URLSearchParams;
  params: Record<string, string>;
  body: unknown;
}

type RouteHandler = (req: ParsedRequest, res: ServerResponse) => Promise<void>;

// ============================================================================
// Helper Functions
// ============================================================================

function sendJSON(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJSON(res, { error: message }, status);
}

// ============================================================================
// Prompt Routes
// ============================================================================

export const handleListPrompts: RouteHandler = async (req, res) => {
  const category = req.query.get('category') || undefined;
  const prompts = await promptRepository.listPrompts(category);
  sendJSON(res, { prompts });
};

export const handleGetPrompt: RouteHandler = async (req, res) => {
  const prompt = await promptRepository.getPrompt(req.params.promptId);
  if (!prompt) {
    sendError(res, 404, 'Prompt not found');
    return;
  }
  sendJSON(res, prompt);
};

export const handleExecutePrompt: RouteHandler = async (req, res) => {
  const body = req.body as { variables?: Record<string, string>; modifiers?: string[] };
  
  try {
    const result = await promptRepository.execute(
      req.params.promptId,
      body.variables || {},
      body.modifiers || []
    );
    sendJSON(res, result);
  } catch (error) {
    sendError(res, 400, (error as Error).message);
  }
};

export const handleListModifiers: RouteHandler = async (req, res) => {
  const modifiers = promptRepository.listModifiers();
  sendJSON(res, { modifiers });
};

// ============================================================================
// Blog Routes
// ============================================================================

export const handleListBlogs: RouteHandler = async (req, res) => {
  const exam = req.query.get('exam') || undefined;
  const status = req.query.get('status') || undefined;
  const posts = await blogPipeline.listPosts({ exam, status });
  sendJSON(res, { posts });
};

export const handleGetBlog: RouteHandler = async (req, res) => {
  const post = await blogPipeline.getPost(req.params.postId);
  if (!post) {
    sendError(res, 404, 'Blog post not found');
    return;
  }
  sendJSON(res, post);
};

export const handleCreateBlog: RouteHandler = async (req, res) => {
  const body = req.body as {
    title: string;
    content: string;
    category: string;
    exam?: string;
  };

  if (!body.title || !body.content) {
    sendError(res, 400, 'title and content are required');
    return;
  }

  try {
    const post = await blogPipeline.createPost(body);
    sendJSON(res, post, 201);
  } catch (error) {
    sendError(res, 500, (error as Error).message);
  }
};

export const handlePublishBlog: RouteHandler = async (req, res) => {
  const body = req.body as { platform: string; publishAt?: number };

  try {
    await blogPipeline.schedulePublish(req.params.postId, body.platform as any, {
      publishAt: body.publishAt || Date.now(),
    });
    sendJSON(res, { status: 'scheduled', postId: req.params.postId });
  } catch (error) {
    sendError(res, 500, (error as Error).message);
  }
};

// ============================================================================
// Vlog Routes
// ============================================================================

export const handleListVlogs: RouteHandler = async (req, res) => {
  const exam = req.query.get('exam') || undefined;
  const vlogs = await vlogPipeline.listVlogs({ exam });
  sendJSON(res, { vlogs });
};

export const handleGetVlog: RouteHandler = async (req, res) => {
  const vlog = await vlogPipeline.getVlog(req.params.vlogId);
  if (!vlog) {
    sendError(res, 404, 'Vlog not found');
    return;
  }
  sendJSON(res, vlog);
};

export const handleCreateVlog: RouteHandler = async (req, res) => {
  const body = req.body as {
    title: string;
    description: string;
    script: { sections: Array<{ title: string; content: string; duration: number }> };
    exam?: string;
  };

  if (!body.title || !body.script) {
    sendError(res, 400, 'title and script are required');
    return;
  }

  try {
    const vlog = await vlogPipeline.createVlog(body);
    sendJSON(res, vlog, 201);
  } catch (error) {
    sendError(res, 500, (error as Error).message);
  }
};

// ============================================================================
// Landing Page Routes
// ============================================================================

export const handleListLandingPages: RouteHandler = async (req, res) => {
  const exam = req.query.get('exam') || undefined;
  const pages = await landingPageManager.listPages({ exam });
  sendJSON(res, { pages });
};

export const handleGetLandingPage: RouteHandler = async (req, res) => {
  const page = await landingPageManager.getPage(req.params.pageId);
  if (!page) {
    sendError(res, 404, 'Landing page not found');
    return;
  }
  sendJSON(res, page);
};

export const handleCreateLandingPage: RouteHandler = async (req, res) => {
  const body = req.body as {
    title: string;
    slug: string;
    template: string;
    exam?: string;
    variables?: Record<string, string>;
  };

  if (!body.title || !body.slug || !body.template) {
    sendError(res, 400, 'title, slug, and template are required');
    return;
  }

  try {
    const page = await landingPageManager.createPage(body as any);
    sendJSON(res, page, 201);
  } catch (error) {
    sendError(res, 500, (error as Error).message);
  }
};

export const handleRenderLandingPage: RouteHandler = async (req, res) => {
  try {
    const html = await landingPageManager.renderPage(req.params.pageId);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } catch (error) {
    sendError(res, 500, (error as Error).message);
  }
};

// ============================================================================
// Content Calendar Routes
// ============================================================================

export const handleGetCalendar: RouteHandler = async (req, res) => {
  const exam = req.query.get('exam') || undefined;
  const startDate = req.query.get('start') ? new Date(req.query.get('start')!) : new Date();
  const endDate = req.query.get('end') ? new Date(req.query.get('end')!) : undefined;

  const entries = await contentCalendarManager.getEntries({
    exam,
    startDate,
    endDate,
  });
  sendJSON(res, { entries });
};

export const handleScheduleContent: RouteHandler = async (req, res) => {
  const body = req.body as {
    title: string;
    type: string;
    exam: string;
    scheduledDate: number;
  };

  try {
    const entry = await contentCalendarManager.scheduleContent(body as any);
    sendJSON(res, entry, 201);
  } catch (error) {
    sendError(res, 500, (error as Error).message);
  }
};

// ============================================================================
// Deployment Routes
// ============================================================================

export const handleListDeployments: RouteHandler = async (req, res) => {
  const mode = req.query.get('mode') as 'pilot' | 'full' | undefined;
  const deployments = await deploymentManager.listDeployments({ mode });
  sendJSON(res, { deployments });
};

export const handleGetDeployment: RouteHandler = async (req, res) => {
  const deployment = await deploymentManager.getDeployment(req.params.examId);
  if (!deployment) {
    sendError(res, 404, 'Deployment not found');
    return;
  }
  sendJSON(res, deployment);
};

export const handleCreateDeployment: RouteHandler = async (req, res) => {
  const body = req.body as {
    examId: string;
    examCode: string;
    examName: string;
    config: unknown;
  };

  if (!body.examId || !body.examCode) {
    sendError(res, 400, 'examId and examCode are required');
    return;
  }

  try {
    const deployment = await deploymentManager.createDeployment(body as any);
    sendJSON(res, deployment, 201);
  } catch (error) {
    sendError(res, 500, (error as Error).message);
  }
};

export const handleStartPilot: RouteHandler = async (req, res) => {
  try {
    const deployment = await deploymentManager.startPilot(req.params.examId);
    if (!deployment) {
      sendError(res, 404, 'Deployment not found');
      return;
    }
    sendJSON(res, deployment);
  } catch (error) {
    sendError(res, 500, (error as Error).message);
  }
};

export const handlePromoteToFull: RouteHandler = async (req, res) => {
  try {
    const deployment = await deploymentManager.promoteToFull(req.params.examId);
    sendJSON(res, deployment);
  } catch (error) {
    sendError(res, 400, (error as Error).message);
  }
};

export const handleCheckPilotStatus: RouteHandler = async (req, res) => {
  try {
    const status = await deploymentManager.checkPilotStatus(req.params.examId);
    sendJSON(res, status);
  } catch (error) {
    sendError(res, 500, (error as Error).message);
  }
};

export const handleRollback: RouteHandler = async (req, res) => {
  const body = req.body as { reason: string };

  try {
    const deployment = await deploymentManager.rollback(req.params.examId, body.reason || 'Manual rollback');
    sendJSON(res, deployment);
  } catch (error) {
    sendError(res, 500, (error as Error).message);
  }
};

// ============================================================================
// Feature Flag Routes
// ============================================================================

export const handleListFeatureFlags: RouteHandler = async (req, res) => {
  const flags = await deploymentManager.listFeatureFlags();
  sendJSON(res, { flags });
};

export const handleSetFeatureEnabled: RouteHandler = async (req, res) => {
  const body = req.body as { enabled: boolean };

  try {
    await deploymentManager.setFeatureEnabled(
      req.params.examId,
      req.params.featureId,
      body.enabled
    );
    sendJSON(res, { status: 'updated' });
  } catch (error) {
    sendError(res, 500, (error as Error).message);
  }
};

export const handleSetFeatureRollout: RouteHandler = async (req, res) => {
  const body = req.body as { percentage: number };

  try {
    await deploymentManager.setFeatureRollout(
      req.params.examId,
      req.params.featureId,
      body.percentage
    );
    sendJSON(res, { status: 'updated' });
  } catch (error) {
    sendError(res, 500, (error as Error).message);
  }
};

// ============================================================================
// Exam Config Routes
// ============================================================================

export const handleListExamConfigs: RouteHandler = async (req, res) => {
  const configs = await examConfigManager.listConfigs();
  sendJSON(res, { configs });
};

export const handleGetExamConfig: RouteHandler = async (req, res) => {
  const config = await examConfigManager.getConfigByCode(req.params.examCode);
  if (!config) {
    sendError(res, 404, 'Exam config not found');
    return;
  }
  sendJSON(res, config);
};

export const handleCreateExamConfig: RouteHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;

  try {
    const config = await examConfigManager.createConfig(body as any);
    sendJSON(res, config, 201);
  } catch (error) {
    sendError(res, 500, (error as Error).message);
  }
};

export const handleUpdateExamConfig: RouteHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const config = await examConfigManager.getConfigByCode(req.params.examCode);

  if (!config) {
    sendError(res, 404, 'Exam config not found');
    return;
  }

  try {
    const updated = await examConfigManager.updateConfig(config.id, body as any);
    sendJSON(res, updated);
  } catch (error) {
    sendError(res, 500, (error as Error).message);
  }
};

export const handleValidateExamConfig: RouteHandler = async (req, res) => {
  const config = await examConfigManager.getConfigByCode(req.params.examCode);

  if (!config) {
    sendError(res, 404, 'Exam config not found');
    return;
  }

  const validation = await examConfigManager.validateConfig(config.id);
  sendJSON(res, validation);
};

// ============================================================================
// Route Registration Helper
// ============================================================================

export interface RouteDefinition {
  method: string;
  path: string;
  handler: RouteHandler;
}

export const contentRoutes: RouteDefinition[] = [
  // Prompts
  { method: 'GET', path: '/prompts', handler: handleListPrompts },
  { method: 'GET', path: '/prompts/modifiers', handler: handleListModifiers },
  { method: 'GET', path: '/prompts/:promptId', handler: handleGetPrompt },
  { method: 'POST', path: '/prompts/:promptId/execute', handler: handleExecutePrompt },

  // Blogs
  { method: 'GET', path: '/blogs', handler: handleListBlogs },
  { method: 'GET', path: '/blogs/:postId', handler: handleGetBlog },
  { method: 'POST', path: '/blogs', handler: handleCreateBlog },
  { method: 'POST', path: '/blogs/:postId/publish', handler: handlePublishBlog },

  // Vlogs
  { method: 'GET', path: '/vlogs', handler: handleListVlogs },
  { method: 'GET', path: '/vlogs/:vlogId', handler: handleGetVlog },
  { method: 'POST', path: '/vlogs', handler: handleCreateVlog },

  // Landing Pages
  { method: 'GET', path: '/landing-pages', handler: handleListLandingPages },
  { method: 'GET', path: '/landing-pages/:pageId', handler: handleGetLandingPage },
  { method: 'GET', path: '/landing-pages/:pageId/render', handler: handleRenderLandingPage },
  { method: 'POST', path: '/landing-pages', handler: handleCreateLandingPage },

  // Calendar
  { method: 'GET', path: '/calendar', handler: handleGetCalendar },
  { method: 'POST', path: '/calendar', handler: handleScheduleContent },

  // Deployments
  { method: 'GET', path: '/deployments', handler: handleListDeployments },
  { method: 'GET', path: '/deployments/:examId', handler: handleGetDeployment },
  { method: 'POST', path: '/deployments', handler: handleCreateDeployment },
  { method: 'POST', path: '/deployments/:examId/pilot/start', handler: handleStartPilot },
  { method: 'POST', path: '/deployments/:examId/pilot/status', handler: handleCheckPilotStatus },
  { method: 'POST', path: '/deployments/:examId/promote', handler: handlePromoteToFull },
  { method: 'POST', path: '/deployments/:examId/rollback', handler: handleRollback },

  // Feature Flags
  { method: 'GET', path: '/feature-flags', handler: handleListFeatureFlags },
  { method: 'PUT', path: '/deployments/:examId/features/:featureId/enabled', handler: handleSetFeatureEnabled },
  { method: 'PUT', path: '/deployments/:examId/features/:featureId/rollout', handler: handleSetFeatureRollout },

  // Exam Configs
  { method: 'GET', path: '/exam-configs', handler: handleListExamConfigs },
  { method: 'GET', path: '/exam-configs/:examCode', handler: handleGetExamConfig },
  { method: 'POST', path: '/exam-configs', handler: handleCreateExamConfig },
  { method: 'PUT', path: '/exam-configs/:examCode', handler: handleUpdateExamConfig },
  { method: 'POST', path: '/exam-configs/:examCode/validate', handler: handleValidateExamConfig },
];
