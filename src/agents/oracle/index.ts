/**
 * Oracle Agent - Analytics & Insights
 * Tracks metrics, detects anomalies, and generates reports
 */

import { randomUUID } from 'crypto';
import { BaseAgent, AgentConfig, AgentContext } from '../base-agent';
import {
  AnalyticsEventPayload,
  AnalyticsReportPayload,
  AnomalyAlertPayload,
} from '../../events/types';

// ============================================================================
// Oracle Agent Configuration
// ============================================================================

const ORACLE_CONFIG: AgentConfig = {
  id: 'Oracle',
  name: 'Oracle',
  description: 'Analytics agent - tracks metrics, detects anomalies, generates insights',
  heartbeatIntervalMs: 5 * 60 * 1000, // 5 minutes (continuous monitoring)
  budget: {
    dailyTokenLimit: 50000,
    warningThreshold: 0.8,
  },
  subAgents: [
    {
      id: 'MetricTracker',
      name: 'Metric Tracker',
      description: 'Tracks and aggregates KPIs',
      triggers: ['event:metric', 'schedule:minute'],
      handler: 'trackMetrics',
    },
    {
      id: 'AnomalyDetector',
      name: 'Anomaly Detector',
      description: 'Detects unusual patterns in metrics',
      triggers: ['event:metric', 'schedule:hourly'],
      handler: 'detectAnomalies',
    },
    {
      id: 'ReportGenerator',
      name: 'Report Generator',
      description: 'Creates daily/weekly/monthly reports',
      triggers: ['schedule:daily', 'request:report'],
      handler: 'generateReport',
    },
    {
      id: 'FunnelAnalyzer',
      name: 'Funnel Analyzer',
      description: 'Analyzes conversion funnels',
      triggers: ['schedule:daily', 'request:funnel'],
      handler: 'analyzeFunnel',
    },
    {
      id: 'CohortAnalyzer',
      name: 'Cohort Analyzer',
      description: 'Performs cohort retention analysis',
      triggers: ['schedule:weekly', 'request:cohort'],
      handler: 'analyzeCohorts',
    },
    {
      id: 'ABEvaluator',
      name: 'A/B Evaluator',
      description: 'Evaluates experiment results',
      triggers: ['request:experiment', 'schedule:daily'],
      handler: 'evaluateExperiment',
    },
  ],
};

// ============================================================================
// Oracle Agent Implementation
// ============================================================================

export class OracleAgent extends BaseAgent {
  private metrics: Map<string, MetricSeries> = new Map();
  private anomalies: Anomaly[] = [];
  private experiments: Map<string, Experiment> = new Map();
  private funnels: Map<string, FunnelData> = new Map();
  private cohorts: Map<string, CohortData> = new Map();

  constructor(config: Partial<AgentConfig> = {}) {
    super({ ...ORACLE_CONFIG, ...config });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  protected async initializeLLM(): Promise<void> {
    this.llm = null;
  }

  protected registerSubAgents(): void {
    this.registerSubAgent('MetricTracker', this.trackMetrics.bind(this));
    this.registerSubAgent('AnomalyDetector', this.detectAnomalies.bind(this));
    this.registerSubAgent('ReportGenerator', this.generateReport.bind(this));
    this.registerSubAgent('FunnelAnalyzer', this.analyzeFunnel.bind(this));
    this.registerSubAgent('CohortAnalyzer', this.analyzeCohorts.bind(this));
    this.registerSubAgent('ABEvaluator', this.evaluateExperiment.bind(this));
  }

  protected async setupSubscriptions(): Promise<void> {
    // Listen for analytics events
    this.subscribeAll('*.analytics.event', async (event) => {
      await this.recordEvent(event.payload);
    });

    // Listen for student progress (key metric)
    this.subscribeAll('sage.progress.updated', async (event) => {
      await this.trackLearningMetrics(event.payload);
    });

    // Listen for content views
    this.subscribeAll('atlas.content.viewed', async (event) => {
      await this.trackContentMetrics(event.payload);
    });
  }

  protected async onHeartbeat(): Promise<void> {
    // Run anomaly detection
    await this.runAnomalyDetection();

    // Generate reports at scheduled times
    const hour = new Date().getUTCHours();

    if (hour === 6) {
      // Morning: Daily report
      await this.invokeSubAgent('ReportGenerator', { type: 'daily' }, { agentId: this.config.id });
    }

    if (new Date().getDay() === 1 && hour === 9) {
      // Monday: Weekly report
      await this.invokeSubAgent('ReportGenerator', { type: 'weekly' }, { agentId: this.config.id });
    }
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Metric Tracker
  // -------------------------------------------------------------------------

  private async trackMetrics(
    input: MetricInput,
    context: AgentContext
  ): Promise<MetricResult> {
    const { metric, value, dimensions, timestamp } = input;

    // Get or create metric series
    let series = this.metrics.get(metric);
    if (!series) {
      series = {
        name: metric,
        points: [],
        aggregations: {
          sum: 0,
          count: 0,
          min: Infinity,
          max: -Infinity,
        },
      };
      this.metrics.set(metric, series);
    }

    // Add data point
    const point: DataPoint = {
      value,
      timestamp: timestamp || Date.now(),
      dimensions,
    };
    series.points.push(point);

    // Update aggregations
    series.aggregations.sum += value;
    series.aggregations.count++;
    series.aggregations.min = Math.min(series.aggregations.min, value);
    series.aggregations.max = Math.max(series.aggregations.max, value);
    series.aggregations.avg = series.aggregations.sum / series.aggregations.count;

    // Prune old data (keep last 24 hours)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    series.points = series.points.filter(p => p.timestamp > cutoff);

    return {
      success: true,
      metric,
      current: series.aggregations.avg || value,
      trend: this.calculateTrend(series),
    };
  }

  private calculateTrend(series: MetricSeries): 'up' | 'down' | 'stable' {
    if (series.points.length < 2) return 'stable';

    const recent = series.points.slice(-10);
    const older = series.points.slice(-20, -10);

    if (older.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, p) => sum + p.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, p) => sum + p.value, 0) / older.length;

    const change = (recentAvg - olderAvg) / olderAvg;

    if (change > 0.05) return 'up';
    if (change < -0.05) return 'down';
    return 'stable';
  }

  private async recordEvent(event: AnalyticsEventPayload): Promise<void> {
    await this.trackMetrics({
      metric: `event.${event.event}`,
      value: 1,
      dimensions: { source: event.source },
      timestamp: event.timestamp,
    }, { agentId: this.config.id });
  }

  private async trackLearningMetrics(progress: {
    studentId: string;
    masteryLevel: number;
    questionsAttempted: number;
    questionsCorrect: number;
    timeSpent: number;
  }): Promise<void> {
    await Promise.all([
      this.trackMetrics({
        metric: 'learning.sessions',
        value: 1,
      }, { agentId: this.config.id }),
      this.trackMetrics({
        metric: 'learning.mastery',
        value: progress.masteryLevel,
      }, { agentId: this.config.id }),
      this.trackMetrics({
        metric: 'learning.accuracy',
        value: progress.questionsCorrect / Math.max(progress.questionsAttempted, 1),
      }, { agentId: this.config.id }),
      this.trackMetrics({
        metric: 'learning.time_minutes',
        value: progress.timeSpent,
      }, { agentId: this.config.id }),
    ]);
  }

  private async trackContentMetrics(view: {
    contentId: string;
    studentId: string;
    duration: number;
  }): Promise<void> {
    await Promise.all([
      this.trackMetrics({
        metric: 'content.views',
        value: 1,
        dimensions: { contentId: view.contentId },
      }, { agentId: this.config.id }),
      this.trackMetrics({
        metric: 'content.time_seconds',
        value: view.duration,
      }, { agentId: this.config.id }),
    ]);
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Anomaly Detector
  // -------------------------------------------------------------------------

  private async detectAnomalies(
    input: AnomalyInput,
    context: AgentContext
  ): Promise<AnomalyResult> {
    const { metrics: targetMetrics } = input;
    const detected: Anomaly[] = [];

    const metricsToCheck = targetMetrics || Array.from(this.metrics.keys());

    for (const metricName of metricsToCheck) {
      const series = this.metrics.get(metricName);
      if (!series || series.points.length < 10) continue;

      const anomaly = this.checkForAnomaly(series);
      if (anomaly) {
        detected.push(anomaly);
        this.anomalies.push(anomaly);

        // Emit alert
        this.emit('oracle.anomaly.detected', {
          metric: anomaly.metric,
          type: anomaly.type,
          severity: anomaly.severity,
          value: anomaly.value,
          expected: anomaly.expected,
          deviation: anomaly.deviation,
          detectedAt: anomaly.detectedAt,
        });
      }
    }

    return {
      success: true,
      checked: metricsToCheck.length,
      anomaliesFound: detected.length,
      anomalies: detected,
    };
  }

  private checkForAnomaly(series: MetricSeries): Anomaly | null {
    const points = series.points;
    const recent = points.slice(-5);
    const historical = points.slice(-100, -5);

    if (historical.length < 20) return null;

    // Calculate mean and standard deviation
    const mean = historical.reduce((sum, p) => sum + p.value, 0) / historical.length;
    const variance = historical.reduce((sum, p) => sum + Math.pow(p.value - mean, 2), 0) / historical.length;
    const stdDev = Math.sqrt(variance);

    // Check recent values
    const recentAvg = recent.reduce((sum, p) => sum + p.value, 0) / recent.length;
    const deviation = Math.abs(recentAvg - mean) / stdDev;

    // Anomaly if > 2 standard deviations
    if (deviation > 2) {
      const severity: AnomalySeverity = deviation > 3 ? 'critical' : (deviation > 2.5 ? 'high' : 'medium');

      return {
        id: randomUUID(),
        metric: series.name,
        type: recentAvg > mean ? 'spike' : 'drop',
        severity,
        value: recentAvg,
        expected: mean,
        deviation,
        detectedAt: Date.now(),
      };
    }

    return null;
  }

  private async runAnomalyDetection(): Promise<void> {
    await this.invokeSubAgent('AnomalyDetector', {}, { agentId: this.config.id });
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Report Generator
  // -------------------------------------------------------------------------

  private async generateReport(
    input: ReportInput,
    context: AgentContext
  ): Promise<Report> {
    const { type, startDate, endDate, metrics: requestedMetrics } = input;

    const now = Date.now();
    const periodMs = this.getPeriodMs(type || 'daily');
    const start = startDate || (now - periodMs);
    const end = endDate || now;

    // Gather metrics for report
    const metricsData: ReportMetric[] = [];
    const targetMetrics = requestedMetrics || this.getDefaultReportMetrics();

    for (const metricName of targetMetrics) {
      const series = this.metrics.get(metricName);
      if (series) {
        const periodPoints = series.points.filter(
          p => p.timestamp >= start && p.timestamp <= end
        );

        metricsData.push({
          name: metricName,
          value: periodPoints.reduce((sum, p) => sum + p.value, 0) / Math.max(periodPoints.length, 1),
          change: this.calculatePeriodChange(series, start, end, periodMs),
          trend: this.calculateTrend(series),
        });
      }
    }

    // Generate insights
    const insights = this.generateInsights(metricsData);

    const report: Report = {
      id: randomUUID(),
      type: type || 'daily',
      period: {
        start,
        end,
        label: this.formatPeriod(start, end),
      },
      metrics: metricsData,
      insights,
      highlights: this.extractHighlights(metricsData),
      anomalies: this.anomalies.filter(a => a.detectedAt >= start && a.detectedAt <= end),
      generatedAt: Date.now(),
    };

    // Emit report event
    this.emit('oracle.report.generated', {
      reportId: report.id,
      reportType: report.type,
      period: report.period.label,
      highlights: report.highlights,
      anomalyCount: report.anomalies.length,
      generatedAt: report.generatedAt,
    });

    return report;
  }

  private getPeriodMs(type: ReportType): number {
    const periods: Record<ReportType, number> = {
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    };
    return periods[type];
  }

  private getDefaultReportMetrics(): string[] {
    return [
      'learning.sessions',
      'learning.mastery',
      'learning.accuracy',
      'learning.time_minutes',
      'content.views',
    ];
  }

  private calculatePeriodChange(
    series: MetricSeries,
    start: number,
    end: number,
    periodMs: number
  ): number {
    const currentPeriod = series.points.filter(p => p.timestamp >= start && p.timestamp <= end);
    const previousPeriod = series.points.filter(
      p => p.timestamp >= start - periodMs && p.timestamp < start
    );

    if (previousPeriod.length === 0) return 0;

    const currentAvg = currentPeriod.reduce((sum, p) => sum + p.value, 0) / currentPeriod.length || 0;
    const previousAvg = previousPeriod.reduce((sum, p) => sum + p.value, 0) / previousPeriod.length;

    return (currentAvg - previousAvg) / previousAvg;
  }

  private formatPeriod(start: number, end: number): string {
    const startDate = new Date(start).toISOString().split('T')[0];
    const endDate = new Date(end).toISOString().split('T')[0];
    return startDate === endDate ? startDate : `${startDate} to ${endDate}`;
  }

  private generateInsights(metrics: ReportMetric[]): string[] {
    const insights: string[] = [];

    for (const metric of metrics) {
      if (Math.abs(metric.change) > 0.1) {
        const direction = metric.change > 0 ? 'increased' : 'decreased';
        const pct = Math.abs(metric.change * 100).toFixed(1);
        insights.push(`${metric.name} ${direction} by ${pct}%`);
      }
    }

    return insights;
  }

  private extractHighlights(metrics: ReportMetric[]): string[] {
    const highlights: string[] = [];

    // Find best performing metrics
    const sorted = [...metrics].sort((a, b) => b.change - a.change);

    if (sorted.length > 0 && sorted[0].change > 0.05) {
      highlights.push(`📈 ${sorted[0].name} up ${(sorted[0].change * 100).toFixed(1)}%`);
    }

    if (sorted.length > 0 && sorted[sorted.length - 1].change < -0.05) {
      highlights.push(`📉 ${sorted[sorted.length - 1].name} needs attention`);
    }

    return highlights;
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Funnel Analyzer
  // -------------------------------------------------------------------------

  private async analyzeFunnel(
    input: FunnelInput,
    context: AgentContext
  ): Promise<FunnelResult> {
    const { funnelId, steps } = input;

    const funnelSteps = steps || [
      { name: 'Visit', metric: 'event.page_view' },
      { name: 'Sign Up', metric: 'event.signup' },
      { name: 'First Session', metric: 'event.first_session' },
      { name: 'Subscription', metric: 'event.subscribe' },
    ];

    const stepResults: FunnelStep[] = [];
    let previousCount = 0;

    for (const step of funnelSteps) {
      const series = this.metrics.get(step.metric);
      const count = series?.aggregations.count || 0;

      stepResults.push({
        name: step.name,
        count,
        conversionRate: previousCount > 0 ? count / previousCount : 1,
        dropoff: previousCount > 0 ? (previousCount - count) / previousCount : 0,
      });

      previousCount = count || 1;
    }

    // Calculate overall conversion
    const overallConversion = stepResults[stepResults.length - 1].count /
      Math.max(stepResults[0].count, 1);

    // Find biggest dropoff
    const biggestDropoff = stepResults.reduce((max, step) =>
      step.dropoff > max.dropoff ? step : max
    );

    const funnelData: FunnelData = {
      id: funnelId || 'default',
      steps: stepResults,
      overallConversion,
      biggestDropoff: biggestDropoff.name,
      analyzedAt: Date.now(),
    };

    this.funnels.set(funnelData.id, funnelData);

    return {
      success: true,
      funnel: funnelData,
      recommendations: this.generateFunnelRecommendations(funnelData),
    };
  }

  private generateFunnelRecommendations(funnel: FunnelData): string[] {
    const recommendations: string[] = [];

    for (const step of funnel.steps) {
      if (step.dropoff > 0.5) {
        recommendations.push(`High dropoff at "${step.name}" (${(step.dropoff * 100).toFixed(1)}%) — needs optimization`);
      }
    }

    if (funnel.overallConversion < 0.02) {
      recommendations.push('Overall conversion is low — consider simplifying the user journey');
    }

    return recommendations.length > 0 ? recommendations : ['Funnel performing within normal range'];
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Cohort Analyzer
  // -------------------------------------------------------------------------

  private async analyzeCohorts(
    input: CohortInput,
    context: AgentContext
  ): Promise<CohortResult> {
    const { cohortType, period } = input;

    // Generate cohort data (would pull from actual data)
    const cohorts: CohortEntry[] = [];
    const periods = period || 12;

    for (let i = 0; i < periods; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const cohortName = date.toISOString().slice(0, 7); // YYYY-MM

      const retention: number[] = [];
      const baseRetention = 1;
      for (let week = 0; week <= 12 - i; week++) {
        // Simulate retention curve
        retention.push(baseRetention * Math.pow(0.85, week) + Math.random() * 0.05);
      }

      cohorts.push({
        name: cohortName,
        size: Math.floor(Math.random() * 500) + 100,
        retention,
      });
    }

    // Calculate averages
    const avgRetention: number[] = [];
    const maxWeeks = Math.max(...cohorts.map(c => c.retention.length));

    for (let week = 0; week < maxWeeks; week++) {
      const weekValues = cohorts
        .filter(c => c.retention.length > week)
        .map(c => c.retention[week]);
      avgRetention.push(weekValues.reduce((a, b) => a + b, 0) / weekValues.length);
    }

    const cohortData: CohortData = {
      type: cohortType || 'weekly',
      cohorts,
      avgRetention,
      analyzedAt: Date.now(),
    };

    return {
      success: true,
      data: cohortData,
      insights: this.generateCohortInsights(cohortData),
    };
  }

  private generateCohortInsights(data: CohortData): string[] {
    const insights: string[] = [];

    // Week 1 retention
    if (data.avgRetention[1] < 0.5) {
      insights.push('Week 1 retention below 50% — focus on onboarding');
    }

    // Month 1 retention
    if (data.avgRetention[4] && data.avgRetention[4] < 0.3) {
      insights.push('Month 1 retention below 30% — investigate early churn');
    }

    // Improving trends
    const recent = data.cohorts.slice(0, 3);
    const older = data.cohorts.slice(3, 6);

    if (recent.length > 0 && older.length > 0) {
      const recentAvg = recent.reduce((sum, c) => sum + (c.retention[1] || 0), 0) / recent.length;
      const olderAvg = older.reduce((sum, c) => sum + (c.retention[1] || 0), 0) / older.length;

      if (recentAvg > olderAvg * 1.1) {
        insights.push('📈 Recent cohorts showing improved retention');
      }
    }

    return insights.length > 0 ? insights : ['Retention patterns within normal range'];
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: A/B Evaluator
  // -------------------------------------------------------------------------

  private async evaluateExperiment(
    input: ExperimentInput,
    context: AgentContext
  ): Promise<ExperimentResult> {
    const { experimentId, control, variants } = input;

    // Get or create experiment
    let experiment = this.experiments.get(experimentId);

    if (!experiment && control && variants) {
      experiment = {
        id: experimentId,
        name: experimentId,
        status: 'running',
        control: { name: control, size: 0, conversions: 0 },
        variants: variants.map(v => ({ name: v, size: 0, conversions: 0 })),
        startedAt: Date.now(),
      };
      this.experiments.set(experimentId, experiment);
    }

    if (!experiment) {
      return { success: false, error: 'Experiment not found' };
    }

    // Simulate data accumulation
    experiment.control.size += Math.floor(Math.random() * 100);
    experiment.control.conversions += Math.floor(Math.random() * 10);

    for (const variant of experiment.variants) {
      variant.size += Math.floor(Math.random() * 100);
      variant.conversions += Math.floor(Math.random() * 12); // Slightly better
    }

    // Calculate statistics
    const controlRate = experiment.control.conversions / Math.max(experiment.control.size, 1);

    const variantResults = experiment.variants.map(v => {
      const rate = v.conversions / Math.max(v.size, 1);
      const uplift = (rate - controlRate) / controlRate;
      const significant = this.calculateSignificance(experiment.control, v);

      return {
        name: v.name,
        size: v.size,
        conversions: v.conversions,
        rate,
        uplift,
        significant,
      };
    });

    // Determine winner
    const winner = variantResults.find(v => v.significant && v.uplift > 0.05);

    return {
      success: true,
      experiment: {
        id: experiment.id,
        name: experiment.name,
        status: experiment.status,
        duration: Date.now() - experiment.startedAt,
      },
      control: {
        ...experiment.control,
        rate: controlRate,
      },
      variants: variantResults,
      winner: winner?.name,
      recommendation: this.generateExperimentRecommendation(controlRate, variantResults),
    };
  }

  private calculateSignificance(
    control: { size: number; conversions: number },
    variant: { size: number; conversions: number }
  ): boolean {
    // Simplified significance test
    const minSample = 100;
    if (control.size < minSample || variant.size < minSample) return false;

    const p1 = control.conversions / control.size;
    const p2 = variant.conversions / variant.size;
    const pooledP = (control.conversions + variant.conversions) / (control.size + variant.size);

    const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / control.size + 1 / variant.size));
    const z = Math.abs(p1 - p2) / se;

    return z > 1.96; // 95% confidence
  }

  private generateExperimentRecommendation(
    controlRate: number,
    variants: Array<{ name: string; uplift: number; significant: boolean }>
  ): string {
    const significantWinners = variants.filter(v => v.significant && v.uplift > 0.05);

    if (significantWinners.length > 0) {
      const best = significantWinners.sort((a, b) => b.uplift - a.uplift)[0];
      return `Recommend deploying "${best.name}" — ${(best.uplift * 100).toFixed(1)}% uplift with statistical significance`;
    }

    const promising = variants.filter(v => v.uplift > 0.05);
    if (promising.length > 0) {
      return 'Continue experiment — promising results not yet significant';
    }

    return 'No clear winner — consider new variants or conclude experiment';
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async recordMetric(name: string, value: number, dimensions?: Record<string, string>): Promise<void> {
    await this.trackMetrics({ metric: name, value, dimensions }, { agentId: this.config.id });
  }

  async getReport(type: ReportType = 'daily'): Promise<Report> {
    return this.generateReport({ type }, { agentId: this.config.id });
  }

  async getFunnelAnalysis(funnelId?: string): Promise<FunnelResult> {
    return this.analyzeFunnel({ funnelId }, { agentId: this.config.id });
  }

  async getCohortAnalysis(): Promise<CohortResult> {
    return this.analyzeCohorts({}, { agentId: this.config.id });
  }

  async checkExperiment(experimentId: string): Promise<ExperimentResult> {
    return this.evaluateExperiment({ experimentId }, { agentId: this.config.id });
  }

  getRecentAnomalies(limit: number = 10): Anomaly[] {
    return this.anomalies.slice(-limit);
  }

  getMetricValue(name: string): number | undefined {
    return this.metrics.get(name)?.aggregations.avg;
  }
}

// ============================================================================
// Types
// ============================================================================

type ReportType = 'daily' | 'weekly' | 'monthly';
type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

interface DataPoint {
  value: number;
  timestamp: number;
  dimensions?: Record<string, string>;
}

interface MetricSeries {
  name: string;
  points: DataPoint[];
  aggregations: {
    sum: number;
    count: number;
    min: number;
    max: number;
    avg?: number;
  };
}

interface Anomaly {
  id: string;
  metric: string;
  type: 'spike' | 'drop';
  severity: AnomalySeverity;
  value: number;
  expected: number;
  deviation: number;
  detectedAt: number;
}

interface Report {
  id: string;
  type: ReportType;
  period: {
    start: number;
    end: number;
    label: string;
  };
  metrics: ReportMetric[];
  insights: string[];
  highlights: string[];
  anomalies: Anomaly[];
  generatedAt: number;
}

interface ReportMetric {
  name: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

interface FunnelStep {
  name: string;
  count: number;
  conversionRate: number;
  dropoff: number;
}

interface FunnelData {
  id: string;
  steps: FunnelStep[];
  overallConversion: number;
  biggestDropoff: string;
  analyzedAt: number;
}

interface CohortEntry {
  name: string;
  size: number;
  retention: number[];
}

interface CohortData {
  type: string;
  cohorts: CohortEntry[];
  avgRetention: number[];
  analyzedAt: number;
}

interface Experiment {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'completed';
  control: { name: string; size: number; conversions: number };
  variants: Array<{ name: string; size: number; conversions: number }>;
  startedAt: number;
  endedAt?: number;
}

// Input/Output types
interface MetricInput {
  metric: string;
  value: number;
  dimensions?: Record<string, string>;
  timestamp?: number;
}

interface MetricResult {
  success: boolean;
  metric: string;
  current: number;
  trend: 'up' | 'down' | 'stable';
}

interface AnomalyInput {
  metrics?: string[];
}

interface AnomalyResult {
  success: boolean;
  checked: number;
  anomaliesFound: number;
  anomalies: Anomaly[];
}

interface ReportInput {
  type?: ReportType;
  startDate?: number;
  endDate?: number;
  metrics?: string[];
}

interface FunnelInput {
  funnelId?: string;
  steps?: Array<{ name: string; metric: string }>;
}

interface FunnelResult {
  success: boolean;
  funnel: FunnelData;
  recommendations: string[];
}

interface CohortInput {
  cohortType?: string;
  period?: number;
}

interface CohortResult {
  success: boolean;
  data: CohortData;
  insights: string[];
}

interface ExperimentInput {
  experimentId: string;
  control?: string;
  variants?: string[];
}

interface ExperimentResult {
  success: boolean;
  error?: string;
  experiment?: {
    id: string;
    name: string;
    status: string;
    duration: number;
  };
  control?: {
    name: string;
    size: number;
    conversions: number;
    rate: number;
  };
  variants?: Array<{
    name: string;
    size: number;
    conversions: number;
    rate: number;
    uplift: number;
    significant: boolean;
  }>;
  winner?: string;
  recommendation?: string;
}

// ============================================================================
// Export
// ============================================================================

export { ORACLE_CONFIG }