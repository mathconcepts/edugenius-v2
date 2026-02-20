/**
 * Daily CEO Briefing Generator
 *
 * Oracle runs this every morning at 7am IST.
 * Delivers a 60-second scannable brief to CEO dashboard + WhatsApp/Telegram.
 *
 * Format: "5 numbers, 3 decisions needed, 1 win"
 *
 * Design principle: Giri should be able to read and act on this in < 60 seconds.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface DailyBrief {
  date: string;
  generatedAt: Date;
  generatedBy: 'Oracle';

  /** 5 key numbers — the heartbeat of the business */
  metrics: {
    mrrINR: number;
    mrrChange: number;       // % vs yesterday
    activeStudents: number;
    newSignups: number;
    churnedToday: number;
  };

  /** What agents did overnight — no action needed, just FYI */
  agentActivity: {
    agent: string;
    summary: string;
    count: number;
  }[];

  /**
   * Up to 3 decisions CEO may want to make.
   * If CEO ignores for 24h → agents execute the defaultIfNoResponse.
   */
  pendingDecisions: {
    id: string;
    from: string;
    decision: string;
    options: string[];
    defaultIfNoResponse: string;
    urgency: 'must_decide' | 'nice_to_decide' | 'agents_handle';
    expiresAt: Date;
  }[];

  /** The one win to celebrate */
  highlight: {
    type: 'revenue' | 'content' | 'student' | 'agent';
    message: string;
  };

  /** Anything that needs attention */
  alerts: {
    severity: 'critical' | 'warning' | 'info';
    message: string;
    suggestedAction: string;
  }[];
}

export interface BriefInput {
  mrr: number;
  mrrYesterday: number;
  activeStudents: number;
  newSignups: number;
  churned: number;
  agentSummaries: Array<{ agent: string; summary: string; count: number }>;
  pendingApprovals: Array<{
    id: string;
    proposedBy: string;
    action: string;
    options?: string[];
    default?: string;
    urgency?: 'must_decide' | 'nice_to_decide' | 'agents_handle';
  }>;
}

// ── Generator ────────────────────────────────────────────────────────────────

export function generateDailyBrief(data: BriefInput): DailyBrief {
  const mrrChange =
    data.mrrYesterday > 0
      ? ((data.mrr - data.mrrYesterday) / data.mrrYesterday) * 100
      : 0;

  const alerts: DailyBrief['alerts'] = [];

  if (data.churned > 20) {
    alerts.push({
      severity: 'warning',
      message: `${data.churned} students churned today — above normal`,
      suggestedAction: 'Mentor is running rescue campaign. Monitor for 48h.',
    });
  }

  if (data.mrr < data.mrrYesterday * 0.9) {
    alerts.push({
      severity: 'critical',
      message: `MRR dropped >10% vs yesterday — immediate attention needed`,
      suggestedAction: 'Oracle is diagnosing. Check Integrations and payment logs.',
    });
  }

  const highlight: DailyBrief['highlight'] =
    mrrChange > 0
      ? {
          type: 'revenue',
          message: `MRR up ${mrrChange.toFixed(1)}% — ${data.newSignups} students joined yesterday`,
        }
      : {
          type: 'student',
          message: `${data.newSignups} new students onboarded. Agents activated re-engagement for ${data.churned} churned users.`,
        };

  return {
    date: new Date().toLocaleDateString('en-IN'),
    generatedAt: new Date(),
    generatedBy: 'Oracle',
    metrics: {
      mrrINR: data.mrr,
      mrrChange: Math.round(mrrChange * 10) / 10,
      activeStudents: data.activeStudents,
      newSignups: data.newSignups,
      churnedToday: data.churned,
    },
    agentActivity: data.agentSummaries,
    pendingDecisions: data.pendingApprovals.slice(0, 3).map(a => ({
      id: a.id,
      from: a.proposedBy,
      decision: a.action,
      options: a.options ?? ['Approve', 'Reject', 'Modify'],
      defaultIfNoResponse: a.default ?? 'Agents will proceed with conservative option',
      urgency: a.urgency ?? 'agents_handle',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })),
    highlight,
    alerts,
  };
}

// ── Formatters ───────────────────────────────────────────────────────────────

/** WhatsApp/Telegram message format — scannable in < 60 seconds */
export function briefToWhatsApp(brief: DailyBrief): string {
  const arrow = brief.metrics.mrrChange >= 0 ? '📈' : '📉';
  const mrrSign = brief.metrics.mrrChange > 0 ? '+' : '';

  const agentLines = brief.agentActivity
    .map(a => `• ${a.agent}: ${a.summary}`)
    .join('\n');

  const decisionLines =
    brief.pendingDecisions.length > 0
      ? `*Needs your call (24h to respond):*\n${brief.pendingDecisions
          .map(
            (d, i) =>
              `${i + 1}. ${d.decision}\n   → Default if silent: ${d.defaultIfNoResponse}`,
          )
          .join('\n')}`
      : '✅ No decisions needed — agents handled everything';

  const alertLines =
    brief.alerts.length > 0
      ? `\n⚠️ *Alerts:*\n${brief.alerts.map(a => `• [${a.severity.toUpperCase()}] ${a.message}`).join('\n')}`
      : '';

  return `
*EduGenius Daily Brief — ${brief.date}*
${arrow} MRR: ₹${brief.metrics.mrrINR.toLocaleString('en-IN')} (${mrrSign}${brief.metrics.mrrChange}%)
👥 Active: ${brief.metrics.activeStudents.toLocaleString('en-IN')} | New: +${brief.metrics.newSignups} | Churned: -${brief.metrics.churnedToday}

*Overnight by your agents:*
${agentLines}

${decisionLines}

🏆 ${brief.highlight.message}${alertLines}
`.trim();
}

/** Dashboard card data — structured for the React UI */
export function briefToCardData(brief: DailyBrief) {
  return {
    metricsStrip: [
      {
        label: 'MRR',
        value: `₹${brief.metrics.mrrINR.toLocaleString('en-IN')}`,
        change: brief.metrics.mrrChange,
        color: brief.metrics.mrrChange >= 0 ? 'green' : 'red',
      },
      {
        label: 'Active Students',
        value: brief.metrics.activeStudents.toLocaleString('en-IN'),
        color: 'blue',
      },
      { label: 'New Signups', value: `+${brief.metrics.newSignups}`, color: 'green' },
      { label: 'Churned', value: `−${brief.metrics.churnedToday}`, color: 'red' },
    ],
    agents: brief.agentActivity,
    decisions: brief.pendingDecisions,
    highlight: brief.highlight,
    alerts: brief.alerts,
  };
}
