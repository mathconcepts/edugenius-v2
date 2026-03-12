/**
 * readinessScoreService.ts — Predictive exam readiness score
 * CEO/Admin: appStore.readinessScoreEnabled
 * Scoring is heuristic-based (local data) — no API calls.
 */

import { getAllCards, getDueCards, getStats } from './spacedRepetitionEngine';
import { loadProfile } from './gamificationService';
import { getBriefHistory } from './dailyBriefService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReadinessBreakdown {
  label: string;
  score: number;   // 0-100
  weight: number;  // contribution weight
  emoji: string;
  detail: string;
}

export interface ReadinessReport {
  overallScore: number;      // 0-100
  grade: string;             // S / A+ / A / B+ / B / C / D
  confidence: 'high' | 'medium' | 'low';
  examReadyDate: string;     // ISO date when student will be "ready" (score ≥ 75)
  breakdown: ReadinessBreakdown[];
  topGaps: string[];
  recommendation: string;
  trend: 'improving' | 'stable' | 'declining';
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function gradeFromScore(score: number): string {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A+';
  if (score >= 70) return 'A';
  if (score >= 60) return 'B+';
  if (score >= 50) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

function daysToReady(currentScore: number, targetScore = 75, dailyGain = 1.5): number {
  if (currentScore >= targetScore) return 0;
  return Math.ceil((targetScore - currentScore) / dailyGain);
}

export function computeReadiness(examDate?: Date): ReadinessReport {
  const profile = loadProfile();
  const srStats = getStats();
  const dueCards = getDueCards();
  const briefHistory = getBriefHistory();
  const allCards = getAllCards();

  // ── Component scores ────────────────────────────────────────────────────────

  // 1. Practice consistency (streak + daily study)
  const streakScore = Math.min(100, (profile.streak / 21) * 100); // 21-day streak = full score
  const consistencyBreakdown: ReadinessBreakdown = {
    label: 'Practice Consistency',
    score: Math.round(streakScore),
    weight: 0.25,
    emoji: '🔥',
    detail: `${profile.streak}-day streak. Target: 21+ days for exam confidence.`,
  };

  // 2. Spaced repetition health
  const overdueRatio = allCards.length > 0 ? dueCards.length / allCards.length : 0;
  const srHealth = Math.max(0, 100 - overdueRatio * 100);
  const avgRetention = srStats.avgRetention;
  const srScore = Math.round((srHealth * 0.5) + (avgRetention * 0.5));
  const srBreakdown: ReadinessBreakdown = {
    label: 'Knowledge Retention',
    score: srScore,
    weight: 0.30,
    emoji: '🧠',
    detail: `${srStats.mastered} concepts mastered. ${dueCards.length} reviews overdue. Avg retention: ${avgRetention}%.`,
  };

  // 3. Daily brief accuracy
  const answered = briefHistory.filter(h => h.answeredCorrectly !== null);
  const correct = briefHistory.filter(h => h.answeredCorrectly === true).length;
  const briefScore = answered.length > 0 ? Math.round((correct / answered.length) * 100) : 40;
  const briefBreakdown: ReadinessBreakdown = {
    label: 'Concept Recall',
    score: briefScore,
    weight: 0.20,
    emoji: '📖',
    detail: `${correct}/${answered.length} daily questions correct. Accuracy: ${briefScore}%.`,
  };

  // 4. XP / engagement velocity
  const xpScore = Math.min(100, Math.round((profile.weeklyXP / 500) * 100)); // 500 XP/week = ready
  const engagementBreakdown: ReadinessBreakdown = {
    label: 'Study Engagement',
    score: xpScore,
    weight: 0.15,
    emoji: '⚡',
    detail: `${profile.weeklyXP} XP this week. Level ${profile.level} (${profile.rank}).`,
  };

  // 5. Exam countdown pressure adjustment
  let countdownBonus = 0;
  if (examDate) {
    const daysLeft = Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / 86400000));
    countdownBonus = daysLeft < 14 ? -5 : daysLeft > 60 ? +5 : 0; // penalise if very close, bonus if far
  }
  const pressureBreakdown: ReadinessBreakdown = {
    label: 'Time Buffer',
    score: Math.min(100, Math.max(0, examDate
      ? Math.round(Math.min(100, (Math.ceil((examDate.getTime() - Date.now()) / 86400000) / 90) * 100))
      : 60)),
    weight: 0.10,
    emoji: '⏱️',
    detail: examDate
      ? `${Math.ceil((examDate.getTime() - Date.now()) / 86400000)} days to exam.`
      : 'No exam date set.',
  };

  const breakdown = [consistencyBreakdown, srBreakdown, briefBreakdown, engagementBreakdown, pressureBreakdown];

  // ── Weighted overall score ───────────────────────────────────────────────────
  const raw = breakdown.reduce((sum, b) => sum + b.score * b.weight, 0) + countdownBonus;
  const overallScore = Math.min(100, Math.max(0, Math.round(raw)));
  const grade = gradeFromScore(overallScore);

  // ── Confidence level ────────────────────────────────────────────────────────
  const confidence: ReadinessReport['confidence'] =
    srStats.total >= 10 && answered.length >= 5 ? 'high' :
    srStats.total >= 3 || answered.length >= 2 ? 'medium' : 'low';

  // ── Top gaps ────────────────────────────────────────────────────────────────
  const topGaps: string[] = [];
  if (consistencyBreakdown.score < 50) topGaps.push('Build a daily study habit (streak < 3)');
  if (srBreakdown.score < 50) topGaps.push(`Review ${dueCards.length} overdue flashcards`);
  if (briefBreakdown.score < 60) topGaps.push('Daily brief accuracy below 60% — revisit weak concepts');
  if (xpScore < 40) topGaps.push('Low weekly engagement — try 15 min/day minimum');
  if (topGaps.length === 0) topGaps.push('Keep up the momentum — no critical gaps detected');

  // ── Recommendation ──────────────────────────────────────────────────────────
  let recommendation: string;
  if (overallScore >= 80) recommendation = '🎯 You are on track! Focus on timed mock exams and weak areas.';
  else if (overallScore >= 65) recommendation = '📈 Good progress. Complete overdue reviews and maintain your streak.';
  else if (overallScore >= 50) recommendation = '⚠️ Need more practice. Add 30 min/day and review all due flashcards.';
  else recommendation = '🚨 Readiness is low. Set a daily goal and start with just 5 flashcards/day.';

  // ── Exam ready date ─────────────────────────────────────────────────────────
  const daysNeeded = daysToReady(overallScore);
  const readyDate = new Date(Date.now() + daysNeeded * 86400000);

  // ── Trend (compare to yesterday's stored score) ──────────────────────────────
  const yesterday = localStorage.getItem('eg_readiness_yesterday');
  let trend: ReadinessReport['trend'] = 'stable';
  if (yesterday) {
    const prev = parseInt(yesterday, 10);
    if (overallScore > prev + 2) trend = 'improving';
    else if (overallScore < prev - 2) trend = 'declining';
  }
  localStorage.setItem('eg_readiness_yesterday', String(overallScore));

  return {
    overallScore,
    grade,
    confidence,
    examReadyDate: readyDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    breakdown,
    topGaps,
    recommendation,
    trend,
  };
}
