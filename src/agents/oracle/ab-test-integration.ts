/**
 * Oracle A/B Test Integration
 * Tracks and analyzes A/B test performance for content and landing pages
 */

import { randomUUID } from 'crypto';
import { promptRepository } from '../../prompts';
import { landingPageManager } from '../../content';
import { deploymentManager } from '../../deployment';

// ============================================================================
// A/B Test Types
// ============================================================================

export interface ABTestResult {
  testId: string;
  name: string;
  type: 'prompt' | 'landing-page' | 'feature';
  status: 'running' | 'completed' | 'stopped';
  startedAt: number;
  endedAt?: number;
  variants: ABTestVariant[];
  winner?: string;
  confidence: number;
  sampleSize: number;
}

export interface ABTestVariant {
  id: string;
  name: string;
  impressions: number;
  conversions: number;
  conversionRate: number;
  revenue?: number;
  avgEngagement?: number;
}

export interface ABTestConfig {
  testId: string;
  minSampleSize: number;
  confidenceThreshold: number;
  maxDuration: number; // days
}

// ============================================================================
// Oracle A/B Test Integration
// ============================================================================

export class OracleABTestIntegration {
  private activeTests: Map<string, ABTestConfig> = new Map();
  private testResults: Map<string, ABTestResult> = new Map();

  // -------------------------------------------------------------------------
  // Prompt A/B Testing
  // -------------------------------------------------------------------------

  async trackPromptExecution(
    promptId: string,
    variantId: string,
    metrics: {
      success: boolean;
      latency: number;
      quality?: number;
      userSatisfaction?: number;
    }
  ): Promise<void> {
    const testId = `prompt-${promptId}`;
    let result = this.testResults.get(testId);

    if (!result) {
      result = {
        testId,
        name: `Prompt: ${promptId}`,
        type: 'prompt',
        status: 'running',
        startedAt: Date.now(),
        variants: [],
        confidence: 0,
        sampleSize: 0,
      };
      this.testResults.set(testId, result);
    }

    // Find or create variant
    let variant = result.variants.find(v => v.id === variantId);
    if (!variant) {
      variant = {
        id: variantId,
        name: variantId,
        impressions: 0,
        conversions: 0,
        conversionRate: 0,
      };
      result.variants.push(variant);
    }

    // Update metrics
    variant.impressions++;
    if (metrics.success) {
      variant.conversions++;
    }
    variant.conversionRate = variant.conversions / variant.impressions;
    variant.avgEngagement = metrics.quality;

    result.sampleSize++;

    // Check if test can be concluded
    await this.checkTestCompletion(testId);
  }

  async getPromptTestResults(promptId: string): Promise<ABTestResult | undefined> {
    return this.testResults.get(`prompt-${promptId}`);
  }

  // -------------------------------------------------------------------------
  // Landing Page A/B Testing
  // -------------------------------------------------------------------------

  async trackLandingPageView(
    pageId: string,
    variantId: string
  ): Promise<void> {
    const testId = `landing-page-${pageId}`;
    let result = this.testResults.get(testId);

    if (!result) {
      result = {
        testId,
        name: `Landing Page: ${pageId}`,
        type: 'landing-page',
        status: 'running',
        startedAt: Date.now(),
        variants: [],
        confidence: 0,
        sampleSize: 0,
      };
      this.testResults.set(testId, result);
    }

    let variant = result.variants.find(v => v.id === variantId);
    if (!variant) {
      variant = {
        id: variantId,
        name: variantId,
        impressions: 0,
        conversions: 0,
        conversionRate: 0,
      };
      result.variants.push(variant);
    }

    variant.impressions++;
    result.sampleSize++;
  }

  async trackLandingPageConversion(
    pageId: string,
    variantId: string,
    revenue?: number
  ): Promise<void> {
    const testId = `landing-page-${pageId}`;
    const result = this.testResults.get(testId);
    if (!result) return;

    const variant = result.variants.find(v => v.id === variantId);
    if (!variant) return;

    variant.conversions++;
    variant.conversionRate = variant.conversions / variant.impressions;
    if (revenue) {
      variant.revenue = (variant.revenue || 0) + revenue;
    }

    await this.checkTestCompletion(testId);
  }

  // -------------------------------------------------------------------------
  // Feature Flag A/B Testing
  // -------------------------------------------------------------------------

  async trackFeatureUsage(
    examId: string,
    featureId: string,
    enabled: boolean,
    engagement: number
  ): Promise<void> {
    const testId = `feature-${examId}-${featureId}`;
    let result = this.testResults.get(testId);

    if (!result) {
      result = {
        testId,
        name: `Feature: ${featureId} (${examId})`,
        type: 'feature',
        status: 'running',
        startedAt: Date.now(),
        variants: [
          { id: 'enabled', name: 'Enabled', impressions: 0, conversions: 0, conversionRate: 0 },
          { id: 'disabled', name: 'Disabled', impressions: 0, conversions: 0, conversionRate: 0 },
        ],
        confidence: 0,
        sampleSize: 0,
      };
      this.testResults.set(testId, result);
    }

    const variantId = enabled ? 'enabled' : 'disabled';
    const variant = result.variants.find(v => v.id === variantId);
    if (!variant) return;

    variant.impressions++;
    variant.avgEngagement = ((variant.avgEngagement || 0) * (variant.impressions - 1) + engagement) / variant.impressions;

    // Consider high engagement as conversion
    if (engagement > 0.7) {
      variant.conversions++;
      variant.conversionRate = variant.conversions / variant.impressions;
    }

    result.sampleSize++;
    await this.checkTestCompletion(testId);
  }

  // -------------------------------------------------------------------------
  // Statistical Analysis
  // -------------------------------------------------------------------------

  private async checkTestCompletion(testId: string): Promise<void> {
    const result = this.testResults.get(testId);
    if (!result || result.status !== 'running') return;

    const config = this.activeTests.get(testId) || {
      testId,
      minSampleSize: 100,
      confidenceThreshold: 0.95,
      maxDuration: 14,
    };

    // Check if we have enough samples
    if (result.sampleSize < config.minSampleSize) return;

    // Check if max duration exceeded
    const durationDays = (Date.now() - result.startedAt) / (24 * 60 * 60 * 1000);
    if (durationDays > config.maxDuration) {
      result.status = 'completed';
      result.endedAt = Date.now();
    }

    // Calculate statistical significance
    if (result.variants.length >= 2) {
      const confidence = this.calculateConfidence(result.variants);
      result.confidence = confidence;

      if (confidence >= config.confidenceThreshold) {
        result.status = 'completed';
        result.endedAt = Date.now();
        result.winner = this.determineWinner(result.variants);
      }
    }
  }

  private calculateConfidence(variants: ABTestVariant[]): number {
    if (variants.length < 2) return 0;

    // Sort by conversion rate
    const sorted = [...variants].sort((a, b) => b.conversionRate - a.conversionRate);
    const best = sorted[0];
    const second = sorted[1];

    // Simple z-test approximation
    const n1 = best.impressions;
    const n2 = second.impressions;
    const p1 = best.conversionRate;
    const p2 = second.conversionRate;

    if (n1 < 10 || n2 < 10) return 0;

    const pooledP = (best.conversions + second.conversions) / (n1 + n2);
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));

    if (se === 0) return 0;

    const z = Math.abs(p1 - p2) / se;

    // Convert z-score to confidence (simplified)
    const confidence = 1 - 2 * (1 - this.normalCDF(z));
    return Math.max(0, Math.min(1, confidence));
  }

  private normalCDF(z: number): number {
    // Approximation of normal CDF
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1 / (1 + p * z);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

    return 0.5 * (1 + sign * y);
  }

  private determineWinner(variants: ABTestVariant[]): string {
    const sorted = [...variants].sort((a, b) => b.conversionRate - a.conversionRate);
    return sorted[0].id;
  }

  // -------------------------------------------------------------------------
  // Reporting
  // -------------------------------------------------------------------------

  async getActiveTests(): Promise<ABTestResult[]> {
    return Array.from(this.testResults.values())
      .filter(r => r.status === 'running');
  }

  async getCompletedTests(since?: number): Promise<ABTestResult[]> {
    const cutoff = since || Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
    return Array.from(this.testResults.values())
      .filter(r => r.status === 'completed' && (r.endedAt || 0) > cutoff);
  }

  async getTestSummary(): Promise<{
    active: number;
    completed: number;
    totalSamples: number;
    avgConfidence: number;
    winsByType: Record<string, number>;
  }> {
    const all = Array.from(this.testResults.values());
    const active = all.filter(r => r.status === 'running');
    const completed = all.filter(r => r.status === 'completed');

    const totalSamples = all.reduce((sum, r) => sum + r.sampleSize, 0);
    const avgConfidence = completed.length > 0
      ? completed.reduce((sum, r) => sum + r.confidence, 0) / completed.length
      : 0;

    const winsByType: Record<string, number> = {};
    for (const result of completed) {
      if (result.winner) {
        winsByType[result.type] = (winsByType[result.type] || 0) + 1;
      }
    }

    return {
      active: active.length,
      completed: completed.length,
      totalSamples,
      avgConfidence,
      winsByType,
    };
  }

  // -------------------------------------------------------------------------
  // Auto-Apply Winners
  // -------------------------------------------------------------------------

  async applyWinningVariants(): Promise<string[]> {
    const applied: string[] = [];
    const completed = await this.getCompletedTests();

    for (const result of completed) {
      if (!result.winner || result.confidence < 0.95) continue;

      if (result.type === 'prompt') {
        // Would update prompt repository to use winning variant
        applied.push(`Applied winning prompt variant: ${result.winner}`);
      } else if (result.type === 'landing-page') {
        // Would update landing page to use winning variant
        applied.push(`Applied winning landing page variant: ${result.winner}`);
      } else if (result.type === 'feature') {
        // Would update feature flag based on results
        applied.push(`Applied winning feature config: ${result.winner}`);
      }
    }

    return applied;
  }
}

// ============================================================================
// Export
// ============================================================================

export const oracleABTestIntegration = new OracleABTestIntegration();
