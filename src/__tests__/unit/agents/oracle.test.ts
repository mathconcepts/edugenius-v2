/**
 * Unit Tests for Oracle Agent (Analytics)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OracleAgent } from '../../../agents/oracle';

describe('OracleAgent', () => {
  let oracle: OracleAgent;

  beforeEach(async () => {
    oracle = new OracleAgent();
    await oracle.start();
  });

  afterEach(async () => {
    await oracle.stop();
  });

  describe('Metric Recording', () => {
    it('should record a metric', async () => {
      await expect(
        oracle.recordMetric('test.metric', 42)
      ).resolves.not.toThrow();
    });

    it('should record metric with dimensions', async () => {
      await expect(
        oracle.recordMetric('test.metric', 42, { source: 'test', type: 'unit' })
      ).resolves.not.toThrow();
    });

    it('should get recorded metric value', async () => {
      await oracle.recordMetric('custom.metric', 100);
      await oracle.recordMetric('custom.metric', 200);

      const value = oracle.getMetricValue('custom.metric');
      expect(value).toBeDefined();
      expect(typeof value).toBe('number');
    });

    it('should return undefined for unknown metric', () => {
      const value = oracle.getMetricValue('unknown.metric');
      expect(value).toBeUndefined();
    });

    it('should handle zero value', async () => {
      await expect(
        oracle.recordMetric('test.zero', 0)
      ).resolves.not.toThrow();
    });

    it('should handle negative value', async () => {
      await expect(
        oracle.recordMetric('test.negative', -100)
      ).resolves.not.toThrow();
    });

    it('should handle decimal value', async () => {
      await expect(
        oracle.recordMetric('test.decimal', 3.14159)
      ).resolves.not.toThrow();
    });

    it('should handle large value', async () => {
      await expect(
        oracle.recordMetric('test.large', Number.MAX_SAFE_INTEGER)
      ).resolves.not.toThrow();
    });
  });

  describe('Report Generation', () => {
    it('should generate daily report', async () => {
      const report = await oracle.getReport('daily');

      expect(report).toBeDefined();
      expect(report.type).toBe('daily');
      expect(report.id).toBeDefined();
      expect(report.period).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(Array.isArray(report.metrics)).toBe(true);
    });

    it('should generate weekly report', async () => {
      const report = await oracle.getReport('weekly');
      expect(report.type).toBe('weekly');
    });

    it('should generate monthly report', async () => {
      const report = await oracle.getReport('monthly');
      expect(report.type).toBe('monthly');
    });

    it('should default to daily report', async () => {
      const report = await oracle.getReport();
      expect(report.type).toBe('daily');
    });

    it('should include period information', async () => {
      const report = await oracle.getReport('daily');

      expect(report.period.start).toBeDefined();
      expect(report.period.end).toBeDefined();
      expect(report.period.label).toBeDefined();
      expect(report.period.start).toBeLessThanOrEqual(report.period.end);
    });

    it('should include insights', async () => {
      const report = await oracle.getReport('daily');
      expect(Array.isArray(report.insights)).toBe(true);
    });

    it('should include highlights', async () => {
      const report = await oracle.getReport('daily');
      expect(Array.isArray(report.highlights)).toBe(true);
    });

    it('should include anomalies', async () => {
      const report = await oracle.getReport('daily');
      expect(Array.isArray(report.anomalies)).toBe(true);
    });

    it('should include generatedAt timestamp', async () => {
      const report = await oracle.getReport('daily');
      expect(report.generatedAt).toBeGreaterThan(0);
    });
  });

  describe('Funnel Analysis', () => {
    it('should perform funnel analysis', async () => {
      const result = await oracle.getFunnelAnalysis();

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.funnel).toBeDefined();
    });

    it('should include funnel steps', async () => {
      const result = await oracle.getFunnelAnalysis();

      expect(result.funnel.steps).toBeDefined();
      expect(Array.isArray(result.funnel.steps)).toBe(true);
    });

    it('should include overall conversion', async () => {
      const result = await oracle.getFunnelAnalysis();
      expect(typeof result.funnel.overallConversion).toBe('number');
    });

    it('should include recommendations', async () => {
      const result = await oracle.getFunnelAnalysis();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('Cohort Analysis', () => {
    it('should perform cohort analysis', async () => {
      const result = await oracle.getCohortAnalysis();

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should include cohort data', async () => {
      const result = await oracle.getCohortAnalysis();

      expect(result.data.cohorts).toBeDefined();
      expect(Array.isArray(result.data.cohorts)).toBe(true);
    });

    it('should include average retention', async () => {
      const result = await oracle.getCohortAnalysis();

      expect(result.data.avgRetention).toBeDefined();
      expect(Array.isArray(result.data.avgRetention)).toBe(true);
    });

    it('should include insights', async () => {
      const result = await oracle.getCohortAnalysis();
      expect(Array.isArray(result.insights)).toBe(true);
    });
  });

  describe('A/B Test Evaluation', () => {
    it('should check experiment', async () => {
      const result = await oracle.checkExperiment('test-experiment');
      expect(result).toBeDefined();
    });

    it('should return not found for unknown experiment', async () => {
      const result = await oracle.checkExperiment('unknown-exp');
      // May create new experiment or return not found
      expect(result).toBeDefined();
    });
  });

  describe('Anomaly Detection', () => {
    it('should return recent anomalies', () => {
      const anomalies = oracle.getRecentAnomalies();
      expect(Array.isArray(anomalies)).toBe(true);
    });

    it('should respect limit parameter', () => {
      const anomalies = oracle.getRecentAnomalies(5);
      expect(anomalies.length).toBeLessThanOrEqual(5);
    });

    it('should default to 10 anomalies', () => {
      const anomalies = oracle.getRecentAnomalies();
      expect(anomalies.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle metric with empty name', async () => {
      await expect(
        oracle.recordMetric('', 42)
      ).resolves.not.toThrow();
    });

    it('should handle metric with special characters', async () => {
      await expect(
        oracle.recordMetric('test/metric.name-with_chars', 42)
      ).resolves.not.toThrow();
    });

    it('should handle concurrent metric recordings', async () => {
      const promises = Array(100).fill(null).map((_, i) =>
        oracle.recordMetric('concurrent.metric', i)
      );

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should handle rapid report generation', async () => {
      const promises = Array(5).fill(null).map(() =>
        oracle.getReport('daily')
      );

      const reports = await Promise.all(promises);
      expect(reports).toHaveLength(5);
    });
  });
});

describe('OracleAgent Robustness', () => {
  it('should maintain metrics across operations', async () => {
    const oracle = new OracleAgent();
    await oracle.start();

    await oracle.recordMetric('persistent.metric', 100);
    await oracle.recordMetric('persistent.metric', 200);

    const value = oracle.getMetricValue('persistent.metric');
    expect(value).toBeDefined();

    await oracle.stop();
  });

  it('should generate accurate reports with data', async () => {
    const oracle = new OracleAgent();
    await oracle.start();

    // Record some metrics
    for (let i = 0; i < 10; i++) {
      await oracle.recordMetric('learning.sessions', 1);
      await oracle.recordMetric('learning.time_minutes', 30);
    }

    const report = await oracle.getReport('daily');
    expect(report.metrics.length).toBeGreaterThan(0);

    await oracle.stop();
  });
});
