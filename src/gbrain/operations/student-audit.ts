// @ts-nocheck
/**
 * Student Audit — Deep 360° analysis compiled from GBrain data
 *
 * Produces a markdown report covering mastery, errors, cognition, motivation,
 * and strategic recommendations. Used for coaching sessions, parent reports,
 * and drop-off investigations.
 */

import pg from 'pg';
import { getOrCreateStudentModel, getMasterySummary, getTopicMastery } from '../student-model';
import { getErrorPatternReport } from '../error-taxonomy';
import { generateAttemptSequence, generateScoreMaximizationPlan, EXAM_CONFIGS } from '../exam-strategy';
import { CONCEPT_MAP, traceWeakestPrerequisite } from '../../constants/concept-graph';
import { TOPIC_NAMES, MARKS_WEIGHTS } from '../../engine/priority-engine';

const { Pool } = pg;

export interface StudentAuditReport {
  session_id: string;
  generated_at: string;
  executive_summary: {
    predicted_score_range: string;
    readiness_level: 'not-ready' | 'building' | 'ready' | 'confident';
    biggest_risk: string;
    top_strength: string;
  };
  mastery_heatmap: Array<{ topic: string; label: string; mastery: number; trend: string; weight: number; expected_marks_contribution: number }>;
  error_analysis: {
    total_errors: number;
    dominant_type: string;
    trend: string;
    top_misconceptions: Array<{ id: string; count: number; description: string }>;
    recommendations: string[];
  };
  prerequisite_alerts: Array<{ concept: string; shaky_prereqs: string[]; severity: string; fix_order: string[] }>;
  cognitive_profile: {
    representation_mode: string;
    abstraction_comfort: number;
    working_memory_est: number;
    narrative: string;
  };
  motivation_trajectory: {
    current_state: string;
    consecutive_failures: number;
    confidence_calibration: any;
    narrative: string;
  };
  strategic_recommendations: string[];
  action_plan: Array<{ session: number; focus: string; concepts: string[]; duration_minutes: number; rationale: string }>;
}

export async function auditStudent(sessionId: string): Promise<StudentAuditReport> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const model = await getOrCreateStudentModel(sessionId);
    const errorReport = await getErrorPatternReport(sessionId, 30);
    const mastery = getMasterySummary(model);

    // ── Executive Summary ──────────────────────────────────────
    const playbook = generateAttemptSequence(model, EXAM_CONFIGS['gate']);
    const avgMastery = Object.values(mastery).reduce((a, b) => a + b, 0) / Object.keys(mastery).length;
    let readinessLevel: StudentAuditReport['executive_summary']['readiness_level'];
    if (avgMastery < 0.2) readinessLevel = 'not-ready';
    else if (avgMastery < 0.4) readinessLevel = 'building';
    else if (avgMastery < 0.65) readinessLevel = 'ready';
    else readinessLevel = 'confident';

    const weakestTopic = Object.entries(mastery).sort((a, b) => a[1] - b[1])[0];
    const strongestTopic = Object.entries(mastery).sort((a, b) => b[1] - a[1])[0];
    const biggestRisk = weakestTopic
      ? `${TOPIC_NAMES[weakestTopic[0]] || weakestTopic[0]} at ${Math.round(weakestTopic[1] * 100)}% — highest marks-weight × weakness product`
      : 'Insufficient data for risk assessment';
    const topStrength = strongestTopic && strongestTopic[1] > 0
      ? `${TOPIC_NAMES[strongestTopic[0]] || strongestTopic[0]} at ${Math.round(strongestTopic[1] * 100)}%`
      : 'No strong topics yet';

    // ── Mastery Heatmap ────────────────────────────────────────
    const mastery_heatmap = Object.keys(MARKS_WEIGHTS).map(topic => {
      const m = mastery[topic] || 0;
      const weight = MARKS_WEIGHTS[topic] || 0.08;
      return {
        topic,
        label: TOPIC_NAMES[topic] || topic,
        mastery: m,
        trend: 'stable', // TODO: compute from historical snapshots
        weight,
        expected_marks_contribution: Math.round(m * weight * 130 * 10) / 10, // 130 approx GATE total
      };
    }).sort((a, b) => b.expected_marks_contribution - a.expected_marks_contribution);

    // ── Prerequisite Alerts with Fix Order ─────────────────────
    const prerequisite_alerts = model.prerequisite_alerts.map(a => {
      const weakPrereqs = traceWeakestPrerequisite(a.concept, model.mastery_vector, 0.3);
      return {
        concept: a.concept,
        shaky_prereqs: a.shaky_prereqs,
        severity: a.severity,
        fix_order: weakPrereqs.map(w => w.id),
      };
    });

    // ── Cognitive Narrative ────────────────────────────────────
    const cognitiveNarrative = buildCognitiveNarrative(model);
    const motivationNarrative = buildMotivationNarrative(model);

    // ── Strategic Recommendations ──────────────────────────────
    const strategic_recommendations = buildRecommendations(model, mastery, errorReport, readinessLevel);

    // ── Action Plan ────────────────────────────────────────────
    const action_plan = buildActionPlan(model, mastery_heatmap, prerequisite_alerts);

    return {
      session_id: sessionId,
      generated_at: new Date().toISOString(),
      executive_summary: {
        predicted_score_range: `${playbook.expected_score.conservative}–${playbook.expected_score.optimistic} marks`,
        readiness_level: readinessLevel,
        biggest_risk: biggestRisk,
        top_strength: topStrength,
      },
      mastery_heatmap,
      error_analysis: {
        total_errors: errorReport.total_errors,
        dominant_type: Object.entries(errorReport.by_type).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none',
        trend: errorReport.trend,
        top_misconceptions: errorReport.top_misconceptions.slice(0, 5),
        recommendations: errorReport.recommendations,
      },
      prerequisite_alerts,
      cognitive_profile: {
        representation_mode: model.representation_mode,
        abstraction_comfort: model.abstraction_comfort,
        working_memory_est: model.working_memory_est,
        narrative: cognitiveNarrative,
      },
      motivation_trajectory: {
        current_state: model.motivation_state,
        consecutive_failures: model.consecutive_failures,
        confidence_calibration: model.confidence_calibration,
        narrative: motivationNarrative,
      },
      strategic_recommendations,
      action_plan,
    };
  } finally {
    await pool.end();
  }
}

function buildCognitiveNarrative(model: any): string {
  const parts: string[] = [];
  if (model.representation_mode === 'geometric') parts.push('Learns best through visual/geometric reasoning.');
  else if (model.representation_mode === 'algebraic') parts.push('Prefers formal algebraic manipulation.');
  else if (model.representation_mode === 'numerical') parts.push('Needs concrete numerical examples before abstract reasoning.');
  else parts.push('Balanced across representations — adapts explanations as needed.');

  if (model.abstraction_comfort > 0.7) parts.push('Comfortable with abstract definitions and formal notation.');
  else if (model.abstraction_comfort < 0.3) parts.push('Needs concrete examples before abstractions.');

  if (model.working_memory_est <= 3) parts.push('Lower working memory — prefers shorter solution chunks.');
  else if (model.working_memory_est >= 6) parts.push('Strong working memory — can handle multi-step derivations.');

  return parts.join(' ');
}

function buildMotivationNarrative(model: any): string {
  const state = model.motivation_state;
  const failures = model.consecutive_failures;
  const cal = model.confidence_calibration;

  const parts: string[] = [];
  parts.push(`Current state: ${state}.`);

  if (failures >= 3) parts.push(`⚠️ ${failures} consecutive failures — at risk of disengagement.`);

  if (cal.overconfident_rate > 0.3) {
    parts.push('Tends toward overconfidence — attempts hard problems without verifying. Risk: negative marking losses.');
  } else if (cal.underconfident_rate > 0.3) {
    parts.push('Tends toward underconfidence — skips problems they could solve. Risk: leaving marks on the table.');
  } else {
    parts.push('Well-calibrated confidence — skip/attempt decisions are sound.');
  }

  return parts.join(' ');
}

function buildRecommendations(model: any, mastery: any, errorReport: any, readiness: string): string[] {
  const recs: string[] = [];

  if (readiness === 'not-ready') {
    recs.push('Foundation phase: avoid timed practice. Focus on one topic at a time until mastery ≥ 40%.');
  } else if (readiness === 'building') {
    recs.push('Concept-building phase: interleave 2-3 topics, introduce worked examples with fading.');
  } else if (readiness === 'ready') {
    recs.push('Drill phase: full-length practice sessions, mixed topics, moderate time pressure.');
  } else {
    recs.push('Peak phase: full mocks, edge cases, strategic rehearsal. No new material.');
  }

  // Error-pattern-specific
  const byType = errorReport.by_type || {};
  const total = errorReport.total_errors || 1;
  if ((byType.arithmetic || 0) / total > 0.3) {
    recs.push('Arithmetic error rate is high — practice calculation discipline: write every intermediate step.');
  }
  if ((byType.time_pressure || 0) / total > 0.2) {
    recs.push('Time-pressure errors detected — practice untimed first, gradually introduce time limits.');
  }
  if ((byType.conceptual || 0) / total > 0.3) {
    recs.push('Many conceptual errors — revisit foundational theory before attempting harder problems.');
  }

  // Prerequisite alerts
  const critical = (model.prerequisite_alerts || []).filter((a: any) => a.severity === 'critical');
  if (critical.length > 0) {
    recs.push(`${critical.length} critical foundation gap(s) — repair before advancing: ${critical.map((c: any) => c.concept).slice(0, 3).join(', ')}`);
  }

  // Cognitive profile
  if (model.representation_mode === 'geometric') {
    recs.push('Lean into visual explanations — use geometric intuition wherever possible.');
  }
  if (model.working_memory_est <= 3) {
    recs.push('Present solutions in 3-4 steps max — break longer derivations into checkpoints.');
  }

  return recs;
}

function buildActionPlan(model: any, heatmap: any[], alerts: any[]): Array<{ session: number; focus: string; concepts: string[]; duration_minutes: number; rationale: string }> {
  const plan = [];

  // Session 1: fix the most critical prerequisite gap
  if (alerts.length > 0 && alerts[0].severity === 'critical') {
    const target = alerts[0];
    plan.push({
      session: 1,
      focus: `Prerequisite repair: ${target.fix_order[0]}`,
      concepts: target.fix_order.slice(0, 2),
      duration_minutes: 30,
      rationale: `This is a critical foundation gap blocking ${target.concept}. Fixing it unlocks downstream concepts.`,
    });
  } else {
    // Target the highest marks-weight topic with mastery < 0.7
    const target = heatmap.find(h => h.mastery < 0.7);
    if (target) {
      plan.push({
        session: 1,
        focus: `Build mastery: ${target.label}`,
        concepts: [target.topic],
        duration_minutes: 45,
        rationale: `High marks weight (${Math.round(target.weight * 100)}%) and mastery under 70% — biggest leverage for score improvement.`,
      });
    }
  }

  // Session 2: confidence builder + weakness
  plan.push({
    session: 2,
    focus: 'Mixed practice (confidence + challenge)',
    concepts: heatmap.slice(0, 2).map(h => h.topic),
    duration_minutes: 40,
    rationale: 'Interleaved practice — one strong topic to build confidence, one weak to apply lessons.',
  });

  // Session 3: timed practice or review
  plan.push({
    session: 3,
    focus: model.motivation_state === 'frustrated' ? 'Low-pressure review' : 'Timed drill',
    concepts: ['review'],
    duration_minutes: 30,
    rationale: model.motivation_state === 'frustrated'
      ? 'Currently frustrated — shift to review mode. Rebuild momentum before adding pressure.'
      : 'Introduce exam-like conditions: 30 min, 15-20 problems, GBrain-verified answers.',
  });

  return plan;
}

/** Format the audit report as markdown */
export function formatAuditMarkdown(r: StudentAuditReport): string {
  const md: string[] = [];
  md.push(`# Student Audit — ${r.session_id}`);
  md.push(`*Generated: ${r.generated_at}*`);
  md.push('');
  md.push('## Executive Summary');
  md.push(`- **Predicted score:** ${r.executive_summary.predicted_score_range}`);
  md.push(`- **Readiness:** ${r.executive_summary.readiness_level}`);
  md.push(`- **Biggest risk:** ${r.executive_summary.biggest_risk}`);
  md.push(`- **Top strength:** ${r.executive_summary.top_strength}`);
  md.push('');
  md.push('## Mastery Heatmap');
  md.push('| Topic | Mastery | Weight | Expected Marks |');
  md.push('|-------|---------|--------|----------------|');
  for (const h of r.mastery_heatmap) {
    md.push(`| ${h.label} | ${Math.round(h.mastery * 100)}% | ${Math.round(h.weight * 100)}% | ${h.expected_marks_contribution} |`);
  }
  md.push('');
  md.push('## Error Analysis');
  md.push(`- Total errors (30d): ${r.error_analysis.total_errors}`);
  md.push(`- Dominant type: ${r.error_analysis.dominant_type}`);
  md.push(`- Trend: ${r.error_analysis.trend}`);
  if (r.error_analysis.recommendations.length > 0) {
    md.push('');
    md.push('**Recommendations:**');
    for (const rec of r.error_analysis.recommendations) md.push(`- ${rec}`);
  }
  md.push('');
  md.push('## Prerequisite Alerts');
  if (r.prerequisite_alerts.length === 0) {
    md.push('*No critical foundation gaps.*');
  } else {
    for (const a of r.prerequisite_alerts) {
      md.push(`- **${a.concept}** (${a.severity}) — fix order: ${a.fix_order.slice(0, 3).join(' → ')}`);
    }
  }
  md.push('');
  md.push('## Cognitive Profile');
  md.push(r.cognitive_profile.narrative);
  md.push('');
  md.push('## Motivation');
  md.push(r.motivation_trajectory.narrative);
  md.push('');
  md.push('## Strategic Recommendations');
  for (const rec of r.strategic_recommendations) md.push(`- ${rec}`);
  md.push('');
  md.push('## Next 3 Sessions');
  for (const s of r.action_plan) {
    md.push(`**Session ${s.session}: ${s.focus}** (${s.duration_minutes} min)`);
    md.push(`  ${s.rationale}`);
    md.push('');
  }
  return md.join('\n');
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const sessionId = process.argv[2];
  if (!sessionId) {
    console.error('Usage: tsx student-audit.ts <sessionId>');
    process.exit(1);
  }
  auditStudent(sessionId)
    .then(r => console.log(formatAuditMarkdown(r)))
    .catch(err => { console.error(err); process.exit(1); });
}
