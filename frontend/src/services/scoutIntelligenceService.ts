/**
 * scoutIntelligenceService.ts — Master orchestrator for Scout's intelligence pipeline
 * Combines Google Trends + Reddit signals using the "Gap Triangle" scoring model
 * Feeds directly into Atlas's content queue
 */

import {
  batchTrendScan,
  simulateTrendData,
  ALL_TRACKED_KEYWORDS,
  type TrendResult,
} from './googleTrendsService';

import {
  runRedditScan,
  simulateRedditData,
  type ContentGap,
  type RedditIntelReport,
} from './redditIntelService';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PriorityContentItem {
  topic: string;
  examFocus: string;
  priority: number;
  reasoning: string;
  suggestedAtomType: string;
}

export interface ScoutWeeklyReport {
  generatedAt: string;
  trendAlerts: TrendResult[];
  contentGaps: ContentGap[];
  priorityContentQueue: PriorityContentItem[];
  competitorSignals: string[];
}

// ── Storage Keys ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'scout:weekly-report';

// ── Gap Triangle Scoring ──────────────────────────────────────────────────────

/**
 * Gap Triangle: score = trendVelocity * 0.4 + redditGapScore * 0.4 + questionCount * 0.2
 * - trendVelocity: 100 for rising, 50 for stable, 20 for declining
 * - redditGapScore: urgency mapped to 100/60/30
 * - questionCount: normalized 0–100
 */
function gapTriangleScore(
  trendResult: TrendResult | undefined,
  gap: ContentGap,
  maxQuestionCount: number,
): number {
  const velocityScore = trendResult
    ? trendResult.velocity === 'rising' ? 100
    : trendResult.velocity === 'stable' ? 50 : 20
    : 40; // neutral fallback

  const redditGapScore = gap.urgency === 'high' ? 100 : gap.urgency === 'medium' ? 60 : 30;

  const questionScore = Math.min((gap.questionCount / Math.max(maxQuestionCount, 1)) * 100, 100);

  return velocityScore * 0.4 + redditGapScore * 0.4 + questionScore * 0.2;
}

function inferExamFocus(topic: string): string {
  const lower = topic.toLowerCase();
  if (lower.includes('gate')) return 'GATE';
  if (lower.includes('cat') || lower.includes('mba')) return 'CAT';
  if (lower.includes('jee') || lower.includes('iit')) return 'JEE';
  if (lower.includes('neet')) return 'NEET';
  if (lower.includes('upsc')) return 'UPSC';
  return 'General';
}

function suggestAtomType(topic: string, gap: ContentGap): string {
  const lower = topic.toLowerCase();
  const questions = gap.sampleQuestions.join(' ').toLowerCase();

  if (lower.includes('formula') || lower.includes('equation')) return 'formula_sheet';
  if (lower.includes('schedule') || lower.includes('plan')) return 'study_plan';
  if (lower.includes('trick') || lower.includes('shortcut')) return 'trick_sheet';
  if (lower.includes('mcq') || lower.includes('practice') || lower.includes('previous')) return 'mcq_set';
  if (questions.includes('explain') || questions.includes('how to')) return 'explainer_article';
  if (lower.includes('strategy') || lower.includes('approach')) return 'strategy_guide';
  if (lower.includes('notes') || lower.includes('revision')) return 'revision_notes';
  if (lower.includes('weightage') || lower.includes('syllabus')) return 'syllabus_breakdown';
  return 'explainer_article';
}

function buildReasoning(
  topic: string,
  gap: ContentGap,
  trend: TrendResult | undefined,
  score: number,
): string {
  const parts: string[] = [];

  if (gap.urgency === 'high') {
    parts.push(`🔴 High urgency gap — ${gap.questionCount} students are actively struggling with this`);
  } else if (gap.urgency === 'medium') {
    parts.push(`🟡 Medium-priority gap — ${gap.questionCount} unanswered questions found`);
  }

  if (trend?.velocity === 'rising') {
    parts.push(`📈 Trending UP on Google (score: ${trend.score})`);
  } else if (trend?.velocity === 'stable') {
    parts.push(`→ Stable search interest (score: ${trend?.score ?? 'N/A'})`);
  }

  if (gap.avgScore < 5) {
    parts.push(`Reddit engagement is low (avg score ${gap.avgScore}) — existing content is poor`);
  }

  parts.push(`Gap Triangle score: ${score.toFixed(1)}/100`);

  return parts.join('. ') || `Score: ${score.toFixed(1)} — recommended for Atlas queue`;
}

// ── Competitor Signals (hardcoded intel + placeholder for live fetch) ─────────

function generateCompetitorSignals(): string[] {
  return [
    'Unacademy launched GATE 2026 "Pro" subscription — ₹12,000/year',
    'PhysicsWallah adding AI doubt solver — beta live for JEE students',
    'BYJU\'s focusing on NEET after JEE pullback — opportunity for our JEE content',
    'Allen launched free mock test series for GATE 2026 — monitor sign-ups',
    'Testbook gaining ground on CAT preparation segment — differentiate with AI',
  ];
}

// ── Core Scan ─────────────────────────────────────────────────────────────────

/**
 * Runs the full weekly intelligence scan combining Trends + Reddit
 */
export async function runWeeklyIntelligenceScan(): Promise<ScoutWeeklyReport> {
  console.info('[Scout] Starting weekly intelligence scan...');

  let trendResults: TrendResult[];
  let redditReport: RedditIntelReport;

  // Run both in parallel with fallbacks
  try {
    [trendResults, redditReport] = await Promise.all([
      batchTrendScan(ALL_TRACKED_KEYWORDS).catch((err) => {
        console.warn('[Scout] Trends scan failed — using simulated:', err);
        return simulateTrendData();
      }),
      runRedditScan().catch((err) => {
        console.warn('[Scout] Reddit scan failed — using simulated:', err);
        return simulateRedditData();
      }),
    ]);
  } catch (err) {
    console.error('[Scout] Scan failed entirely — using simulated data:', err);
    trendResults = simulateTrendData();
    redditReport = simulateRedditData();
  }

  // Rising trends = alerts
  const trendAlerts = trendResults.filter(r => r.velocity === 'rising');

  // Build priority content queue via Gap Triangle
  const maxQuestionCount = Math.max(...redditReport.contentGaps.map(g => g.questionCount), 1);

  const priorityItems: PriorityContentItem[] = redditReport.contentGaps.map((gap) => {
    // Try to find a related trend signal
    const relatedTrend = trendResults.find((t) =>
      gap.topic.toLowerCase().split(' ').some(word =>
        word.length > 3 && t.keyword.toLowerCase().includes(word),
      ),
    );

    const score = gapTriangleScore(relatedTrend, gap, maxQuestionCount);
    const examFocus = inferExamFocus(gap.topic);
    const atomType = suggestAtomType(gap.topic, gap);
    const reasoning = buildReasoning(gap.topic, gap, relatedTrend, score);

    return {
      topic: gap.topic,
      examFocus,
      priority: Math.round(score),
      reasoning,
      suggestedAtomType: atomType,
    };
  });

  // Sort by priority descending
  priorityItems.sort((a, b) => b.priority - a.priority);

  const report: ScoutWeeklyReport = {
    generatedAt: new Date().toISOString(),
    trendAlerts,
    contentGaps: redditReport.contentGaps,
    priorityContentQueue: priorityItems,
    competitorSignals: generateCompetitorSignals(),
  };

  // Auto-save to localStorage
  saveReportToStorage(report);

  console.info(`[Scout] Scan complete. ${trendAlerts.length} trend alerts, ${report.contentGaps.length} content gaps, ${priorityItems.length} queue items`);

  // ── Emit top priorities to orchestrator ──────────────────────────────────
  try {
    const topPriorities = report.priorityContentQueue.slice(0, 5);
    localStorage.setItem(
      'orchestrator:scout_priorities',
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        topics: topPriorities.map((p) => ({
          topic: p.topic,
          examFocus: p.examFocus,
          suggestedTier: 'T2_llm' as const,
        })),
      }),
    );
  } catch {
    // localStorage may be unavailable
  }

  return report;
}

/**
 * Returns top N content priority items, running a scan if no report exists
 */
export async function getTopContentPriorities(limit = 5): Promise<PriorityContentItem[]> {
  const last = getLastReport();
  if (last) {
    return last.priorityContentQueue.slice(0, limit);
  }
  const report = await runWeeklyIntelligenceScan();
  return report.priorityContentQueue.slice(0, limit);
}

// ── Storage ───────────────────────────────────────────────────────────────────

/**
 * Save the weekly report to localStorage
 */
export function saveReportToStorage(report: ScoutWeeklyReport): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
  } catch (err) {
    console.warn('[Scout] Failed to save report to localStorage:', err);
  }
}

/**
 * Retrieve the last weekly report from localStorage
 */
export function getLastReport(): ScoutWeeklyReport | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ScoutWeeklyReport;
  } catch {
    return null;
  }
}

/**
 * Check if the last report is older than 7 days
 */
export function isReportStale(): boolean {
  const last = getLastReport();
  if (!last) return true;
  const age = Date.now() - new Date(last.generatedAt).getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return age > sevenDays;
}
