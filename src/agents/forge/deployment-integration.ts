/**
 * Forge Deployment Integration
 * Handles pilot/full deployment modes and feature flag management
 */

import { deploymentManager } from '../../deployment';
import { examConfigManager } from '../../config';
import {
  ExamDeployment,
  DeploymentMode,
  FeatureFlag,
  DeploymentMetrics,
} from '../../deployment/types';

// ============================================================================
// Deployment Pipeline Types
// ============================================================================

export interface DeploymentPipeline {
  examCode: string;
  stages: DeploymentStage[];
  currentStage: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
}

export interface DeploymentStage {
  name: string;
  type: 'validation' | 'pilot-setup' | 'pilot-monitor' | 'promotion' | 'full-deploy';
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface DeploymentCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

// ============================================================================
// Forge Deployment Integration
// ============================================================================

export class ForgeDeploymentIntegration {
  private pipelines: Map<string, DeploymentPipeline> = new Map();

  // -------------------------------------------------------------------------
  // Deployment Pipeline
  // -------------------------------------------------------------------------

  async startDeploymentPipeline(examCode: string): Promise<DeploymentPipeline> {
    const pipeline: DeploymentPipeline = {
      examCode,
      stages: [
        { name: 'Validation', type: 'validation', status: 'pending' },
        { name: 'Pilot Setup', type: 'pilot-setup', status: 'pending' },
        { name: 'Pilot Monitoring', type: 'pilot-monitor', status: 'pending' },
        { name: 'Promotion Check', type: 'promotion', status: 'pending' },
        { name: 'Full Deployment', type: 'full-deploy', status: 'pending' },
      ],
      currentStage: 0,
      status: 'running',
      startedAt: Date.now(),
    };

    this.pipelines.set(examCode, pipeline);

    // Start first stage
    await this.runStage(examCode, 0);

    return pipeline;
  }

  private async runStage(examCode: string, stageIndex: number): Promise<void> {
    const pipeline = this.pipelines.get(examCode);
    if (!pipeline || stageIndex >= pipeline.stages.length) return;

    const stage = pipeline.stages[stageIndex];
    stage.status = 'running';
    stage.startedAt = Date.now();

    try {
      switch (stage.type) {
        case 'validation':
          await this.runValidationStage(examCode);
          break;
        case 'pilot-setup':
          await this.runPilotSetupStage(examCode);
          break;
        case 'pilot-monitor':
          await this.runPilotMonitorStage(examCode);
          break;
        case 'promotion':
          await this.runPromotionStage(examCode);
          break;
        case 'full-deploy':
          await this.runFullDeployStage(examCode);
          break;
      }

      stage.status = 'completed';
      stage.completedAt = Date.now();
      pipeline.currentStage = stageIndex + 1;

      // Auto-advance to next stage (except pilot-monitor which requires manual advancement)
      if (stage.type !== 'pilot-monitor' && stageIndex + 1 < pipeline.stages.length) {
        await this.runStage(examCode, stageIndex + 1);
      }
    } catch (error) {
      stage.status = 'failed';
      stage.error = (error as Error).message;
      pipeline.status = 'failed';
    }
  }

  private async runValidationStage(examCode: string): Promise<void> {
    // Validate exam config
    const config = await examConfigManager.getConfigByCode(examCode);
    if (!config) {
      throw new Error(`Exam config not found: ${examCode}`);
    }

    const validation = await examConfigManager.validateConfig(config.id);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
  }

  private async runPilotSetupStage(examCode: string): Promise<void> {
    const config = await examConfigManager.getConfigByCode(examCode);
    if (!config) throw new Error('Config not found');

    // Create deployment
    await deploymentManager.createDeployment({
      examId: config.id,
      examCode: config.code,
      examName: config.name,
      config: {
        content: {
          blogsEnabled: true,
          vlogsEnabled: true,
          socialEnabled: true,
          cadence: config.contentCadence,
        },
        tutoring: {
          enabled: true,
          modelsAllowed: ['gemini-pro', 'claude-sonnet'],
          featuresEnabled: ['ai-tutoring', 'smart-notebook'],
        },
        marketing: {
          enabled: true,
          channels: ['social', 'email'],
          budget: config.marketingBudget?.total || 10000,
        },
        features: ['ai-tutoring', 'adaptive-practice', 'gamification'],
      },
    });

    // Start pilot
    await deploymentManager.startPilot(config.id);
  }

  private async runPilotMonitorStage(examCode: string): Promise<void> {
    // This stage is monitored externally
    // Just mark as running and wait for manual advancement
  }

  private async runPromotionStage(examCode: string): Promise<void> {
    const config = await examConfigManager.getConfigByCode(examCode);
    if (!config) throw new Error('Config not found');

    const status = await deploymentManager.checkPilotStatus(config.id);
    if (!status.canPromote) {
      throw new Error(`Cannot promote: ${status.issues.join(', ')}`);
    }
  }

  private async runFullDeployStage(examCode: string): Promise<void> {
    const config = await examConfigManager.getConfigByCode(examCode);
    if (!config) throw new Error('Config not found');

    await deploymentManager.promoteToFull(config.id);
  }

  async advancePipeline(examCode: string): Promise<DeploymentPipeline | undefined> {
    const pipeline = this.pipelines.get(examCode);
    if (!pipeline || pipeline.status !== 'running') return undefined;

    const currentStage = pipeline.stages[pipeline.currentStage];
    if (currentStage.status === 'running') {
      currentStage.status = 'completed';
      currentStage.completedAt = Date.now();
      pipeline.currentStage++;

      if (pipeline.currentStage < pipeline.stages.length) {
        await this.runStage(examCode, pipeline.currentStage);
      } else {
        pipeline.status = 'completed';
        pipeline.completedAt = Date.now();
      }
    }

    return pipeline;
  }

  // -------------------------------------------------------------------------
  // Pre-Deployment Checks
  // -------------------------------------------------------------------------

  async runPreDeploymentChecks(examCode: string): Promise<DeploymentCheck[]> {
    const checks: DeploymentCheck[] = [];

    // Check exam config
    const config = await examConfigManager.getConfigByCode(examCode);
    if (!config) {
      checks.push({
        name: 'Exam Config',
        passed: false,
        message: 'Exam configuration not found',
        severity: 'error',
      });
      return checks;
    }

    checks.push({
      name: 'Exam Config',
      passed: true,
      message: 'Configuration exists',
      severity: 'info',
    });

    // Validate config
    const validation = await examConfigManager.validateConfig(config.id);
    checks.push({
      name: 'Config Validation',
      passed: validation.valid,
      message: validation.valid ? 'All validations passed' : validation.errors.join('; '),
      severity: validation.valid ? 'info' : 'error',
    });

    // Check content readiness
    const hasContent = config.contentCadence.questionsPerDay > 0;
    checks.push({
      name: 'Content Readiness',
      passed: hasContent,
      message: hasContent ? 'Content cadence configured' : 'No content cadence set',
      severity: hasContent ? 'info' : 'warning',
    });

    // Check language support
    const hasLanguages = config.languages.length > 0;
    checks.push({
      name: 'Language Support',
      passed: hasLanguages,
      message: `${config.languages.length} language(s) configured`,
      severity: hasLanguages ? 'info' : 'warning',
    });

    // Check marketing budget
    const hasBudget = (config.marketingBudget?.total || 0) > 0;
    checks.push({
      name: 'Marketing Budget',
      passed: hasBudget,
      message: hasBudget ? `Budget: $${config.marketingBudget?.total}` : 'No budget allocated',
      severity: hasBudget ? 'info' : 'warning',
    });

    return checks;
  }

  // -------------------------------------------------------------------------
  // Feature Flag Management
  // -------------------------------------------------------------------------

  async getExamFeatures(examCode: string): Promise<{
    enabled: FeatureFlag[];
    disabled: FeatureFlag[];
    pilotOnly: FeatureFlag[];
  }> {
    const allFlags = await deploymentManager.listFeatureFlags();

    return {
      enabled: allFlags.filter(f => f.enabled && !f.pilotOnly),
      disabled: allFlags.filter(f => !f.enabled),
      pilotOnly: allFlags.filter(f => f.enabled && f.pilotOnly),
    };
  }

  async toggleFeature(
    examCode: string,
    featureId: string,
    enabled: boolean
  ): Promise<boolean> {
    const config = await examConfigManager.getConfigByCode(examCode);
    if (!config) return false;

    return await deploymentManager.setFeatureEnabled(config.id, featureId, enabled);
  }

  async setFeatureRollout(
    examCode: string,
    featureId: string,
    percentage: number
  ): Promise<boolean> {
    const config = await examConfigManager.getConfigByCode(examCode);
    if (!config) return false;

    return await deploymentManager.setFeatureRollout(config.id, featureId, percentage);
  }

  // -------------------------------------------------------------------------
  // Deployment Metrics
  // -------------------------------------------------------------------------

  async updateDeploymentMetrics(
    examCode: string,
    metrics: Partial<DeploymentMetrics>
  ): Promise<void> {
    const config = await examConfigManager.getConfigByCode(examCode);
    if (!config) return;

    await deploymentManager.updateMetrics(config.id, metrics);
  }

  async getDeploymentHealth(examCode: string): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    metrics: DeploymentMetrics;
    issues: string[];
  }> {
    const config = await examConfigManager.getConfigByCode(examCode);
    if (!config) {
      return {
        status: 'critical',
        metrics: {} as DeploymentMetrics,
        issues: ['Exam config not found'],
      };
    }

    const deployment = await deploymentManager.getDeployment(config.id);
    if (!deployment) {
      return {
        status: 'critical',
        metrics: {} as DeploymentMetrics,
        issues: ['Deployment not found'],
      };
    }

    const metrics = deployment.state.metrics;
    const issues: string[] = [];

    // Check error rate
    if (metrics.errorRate > 0.05) {
      issues.push(`High error rate: ${(metrics.errorRate * 100).toFixed(1)}%`);
    }

    // Check latency
    if (metrics.latencyP95 > 2000) {
      issues.push(`High latency: ${metrics.latencyP95}ms (P95)`);
    }

    // Check churn
    if (metrics.churnRate > 0.1) {
      issues.push(`High churn rate: ${(metrics.churnRate * 100).toFixed(1)}%`);
    }

    let status: 'healthy' | 'degraded' | 'critical';
    if (issues.length === 0) {
      status = 'healthy';
    } else if (issues.length <= 2 && metrics.errorRate < 0.1) {
      status = 'degraded';
    } else {
      status = 'critical';
    }

    return { status, metrics, issues };
  }

  // -------------------------------------------------------------------------
  // Rollback
  // -------------------------------------------------------------------------

  async rollbackDeployment(examCode: string, reason: string): Promise<boolean> {
    const config = await examConfigManager.getConfigByCode(examCode);
    if (!config) return false;

    const deployment = await deploymentManager.rollback(config.id, reason);
    
    // Also fail the pipeline if running
    const pipeline = this.pipelines.get(examCode);
    if (pipeline && pipeline.status === 'running') {
      pipeline.status = 'failed';
      const currentStage = pipeline.stages[pipeline.currentStage];
      if (currentStage) {
        currentStage.status = 'failed';
        currentStage.error = `Rolled back: ${reason}`;
      }
    }

    return !!deployment;
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  async getPipelineStatus(examCode: string): Promise<DeploymentPipeline | undefined> {
    return this.pipelines.get(examCode);
  }

  async getAllPipelines(): Promise<DeploymentPipeline[]> {
    return Array.from(this.pipelines.values());
  }
}

// ============================================================================
// Export
// ============================================================================

export const forgeDeploymentIntegration = new ForgeDeploymentIntegration();
