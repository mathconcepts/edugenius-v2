/**
 * Network Agent Bridge
 *
 * Central dispatcher that feeds ALL 7 network effect loops into every agent
 * and sub-agent. This is the wiring layer between the Network Effects Hub
 * and the 9-agent autonomous system.
 *
 * Architecture:
 *   NetworkEffectsEngine → NetworkAgentBridge → IntelligencePackets → Agents
 *
 * Each network effect loop generates specific signals for specific agents:
 *
 *  Loop 1: Data Network Effect
 *    → Sage: cohort mistake patterns for proactive correction
 *    → Atlas: content gaps from collective struggles
 *    → Herald: topics where avg mastery < 50% (need better content)
 *
 *  Loop 2: Leaderboard
 *    → Mentor: who's slipping in rank (churn risk), who's surging (engage)
 *    → Oracle: rank velocity as engagement health metric
 *    → Herald: "Top students share this habit" social proof content
 *
 *  Loop 3: Study Groups
 *    → Atlas: group's weekly topic → prioritise that content
 *    → Herald: group milestones → celebration emails/push
 *    → Sage: student in active group → motivate with group context
 *    → Mentor: inactive students → nudge to join group
 *
 *  Loop 4: Contributed Problems
 *    → Atlas: high-upvote problems → generate blog/lesson around them
 *    → Sage: verified community problems → extend answer bank
 *    → Scout: topic clusters from contributions → identify content demand
 *    → Forge: AI-verify queue → batch verification jobs
 *
 *  Loop 5: Referral
 *    → Herald: pending referrals → re-engagement email to invitee
 *    → Mentor: successful referee → warm welcome sequence
 *    → Oracle: referral conversion rate → LTV impact measurement
 *
 *  Loop 6: Share Cards
 *    → Scout: viral share topics → surface to Atlas as priority content
 *    → Herald: UTM-tagged inbound from shares → attribution + follow-up
 *    → Oracle: share→signup conversion funnel tracking
 *
 *  Loop 7: Teacher Viral
 *    → Herald: teacher invites class → class onboarding sequence
 *    → Mentor: new student from teacher → assign subject-specific welcome
 *    → Nexus: teacher ticket priority escalation (teachers are force multipliers)
 */

import {
  getCohortSignals, getNetworkMetrics, getLeaderboard,
  getStudyGroups, getContributedProblems,
  type CohortSignal, type NetworkMetrics,
} from './networkEffectsEngine';
import {
  type IntelligencePacket, type PrismTargetAgent,
  loadPrismState, storePrismState,
} from './prismBridge';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NetworkLoopId =
  | 'data_network'
  | 'leaderboard'
  | 'study_groups'
  | 'contributed_problems'
  | 'referral'
  | 'share_cards'
  | 'teacher_viral';

export interface NetworkSignal {
  loopId: NetworkLoopId;
  targetAgent: PrismTargetAgent;
  targetSubAgent?: string;
  priority: IntelligencePacket['priority'];
  signalType: string;
  insight: string;
  actionRequired: string;
  dataPoints: Record<string, unknown>;
}

export interface AgentNetworkContext {
  // What every agent gets on each run
  cohortSignals: CohortSignal[];
  networkMetrics: NetworkMetrics;
  // Agent-specific
  activeLoops: NetworkLoopId[];
  pendingActions: NetworkSignal[];
}

// ─── Core dispatcher ──────────────────────────────────────────────────────────

export function generateNetworkSignals(exam: string = 'JEE Main'): NetworkSignal[] {
  const signals: NetworkSignal[] = [];
  const cohortSignals = getCohortSignals(exam);
  const metrics = getNetworkMetrics();
  const groups = getStudyGroups(exam);
  const problems = getContributedProblems(exam);

  // ── Loop 1: Data Network Effect → Sage, Atlas, Herald ─────────────────────
  for (const signal of cohortSignals) {
    if (signal.avgMastery < 50) {
      // Sage: proactively address this mistake pattern
      signals.push({
        loopId: 'data_network',
        targetAgent: 'sage',
        targetSubAgent: 'SocraticTutor',
        priority: signal.studentsStruggling > 250 ? 'critical' : 'high',
        signalType: 'cohort:struggle_pattern',
        insight: `${signal.studentsStruggling} students struggle with "${signal.topicName}". Common mistake: ${signal.commonMistakePattern}`,
        actionRequired: `When student asks about ${signal.topicName}, proactively address: "${signal.commonMistakePattern}" BEFORE they make this error. Open with "Many students confuse X with Y here..."`,
        dataPoints: { topicId: signal.topicId, avgMastery: signal.avgMastery, studentsStruggling: signal.studentsStruggling, mostAskedQ: signal.mostAskedQuestion },
      });

      // Atlas: content gap — need better material here
      signals.push({
        loopId: 'data_network',
        targetAgent: 'atlas',
        targetSubAgent: 'ContentCurator',
        priority: 'high',
        signalType: 'cohort:content_gap',
        insight: `Content gap detected: ${signal.studentsStruggling} students struggle with "${signal.topicName}" (avg mastery ${signal.avgMastery}%)`,
        actionRequired: `Create a targeted micro-lesson specifically addressing "${signal.commonMistakePattern}" for ${signal.topicName}. Include worked examples correcting this exact mistake.`,
        dataPoints: { topicId: signal.topicId, topicName: signal.topicName, avgMastery: signal.avgMastery },
      });

      // Herald: publish blog on this pain point
      signals.push({
        loopId: 'data_network',
        targetAgent: 'herald',
        targetSubAgent: 'ContentCalendar',
        priority: 'medium',
        signalType: 'cohort:blog_opportunity',
        insight: `"${signal.topicName}" is a major pain point — ${signal.studentsStruggling} students struggling. High-traffic blog opportunity.`,
        actionRequired: `Schedule blog post: "Why Students Get ${signal.topicName} Wrong (And How to Fix It)" — use community struggle data as hook. Target keyword: "${signal.topicName} mistakes ${exam}"`,
        dataPoints: { topicName: signal.topicName, studentsStruggling: signal.studentsStruggling, exam },
      });
    }
  }

  // ── Loop 2: Leaderboard → Mentor, Oracle, Herald ──────────────────────────
  const leaderboard = getLeaderboard(exam);
  const currentUser = leaderboard.find(e => e.isCurrentUser);
  if (currentUser) {
    const rankPercentile = Math.round((currentUser.rank / 1240) * 100);

    // Mentor: rank-based personalised nudge
    signals.push({
      loopId: 'leaderboard',
      targetAgent: 'mentor',
      targetSubAgent: 'EngagementOptimizer',
      priority: rankPercentile > 60 ? 'high' : 'medium',
      signalType: 'leaderboard:rank_signal',
      insight: `Student is rank #${currentUser.rank} (top ${rankPercentile}%). ${rankPercentile > 50 ? 'Below median — churn risk.' : 'Above median — momentum signal.'}`,
      actionRequired: rankPercentile > 50
        ? `Send personalised nudge: "You're ${currentUser.rank - 5} spots away from top 50% — just 3 problems today will move you up." Include specific weak topic from cohort signals.`
        : `Celebrate rank and give stretch goal: "You're in the top ${rankPercentile}%! ${leaderboard[currentUser.rank - 2]?.displayName ?? 'The student ahead'} has ${(leaderboard[currentUser.rank - 2]?.problemsSolved ?? 0) - currentUser.problemsSolved} more problems solved."`,
      dataPoints: { rank: currentUser.rank, percentile: rankPercentile, streak: currentUser.streak, problemsSolved: currentUser.problemsSolved },
    });

    // Oracle: track rank velocity as engagement health
    signals.push({
      loopId: 'leaderboard',
      targetAgent: 'oracle',
      targetSubAgent: 'EngagementAnalytics',
      priority: 'medium',
      signalType: 'leaderboard:rank_velocity',
      insight: `Rank data available: #${currentUser.rank} with ${currentUser.streak}d streak and ${currentUser.problemsSolved} problems`,
      actionRequired: 'Track rank change week-over-week as early engagement health metric. Students dropping >5 ranks/week have 3× higher churn probability.',
      dataPoints: { rank: currentUser.rank, streak: currentUser.streak, mastery: currentUser.masteryScore },
    });

    // Herald: social proof content from top performers
    signals.push({
      loopId: 'leaderboard',
      targetAgent: 'herald',
      targetSubAgent: 'SocialProof',
      priority: 'low',
      signalType: 'leaderboard:social_proof',
      insight: `Top 3 performers: ${leaderboard.slice(0, 3).map(e => e.displayName).join(', ')} — all have streaks > 30 days`,
      actionRequired: 'Generate "What Top 3 Students Do Differently" email/push content. Highlight: daily streak > 30, 700+ problems solved, consistent weak-topic focus.',
      dataPoints: { topStudents: leaderboard.slice(0, 3) },
    });
  }

  // ── Loop 3: Study Groups → Atlas, Herald, Sage, Mentor ────────────────────
  const activeGroups = groups.filter(g => g.activeNow > 10);
  for (const group of activeGroups.slice(0, 3)) {
    // Atlas: group's current topic = high-demand content
    signals.push({
      loopId: 'study_groups',
      targetAgent: 'atlas',
      targetSubAgent: 'ContentCurator',
      priority: 'high',
      signalType: 'study_group:topic_demand',
      insight: `Study group "${group.name}" (${group.memberCount} members, ${group.activeNow} active now) is studying "${group.topicFocus}"`,
      actionRequired: `Prioritise generating practice problems and a quick-reference sheet for "${group.topicFocus}". ${group.memberCount} students need this content right now.`,
      dataPoints: { groupId: group.id, topic: group.topicFocus, memberCount: group.memberCount, activeNow: group.activeNow },
    });

    // Herald: group milestone → celebration outreach
    const progressPct = Math.round((group.weeklyProgress / group.weeklyGoal) * 100);
    if (progressPct >= 80) {
      signals.push({
        loopId: 'study_groups',
        targetAgent: 'herald',
        targetSubAgent: 'ContentCalendar',
        priority: 'medium',
        signalType: 'study_group:milestone',
        insight: `Group "${group.name}" is ${progressPct}% through weekly goal — near milestone`,
        actionRequired: `Send group-wide push: "You're ${progressPct}% to your goal! 🔥 Finish strong this week." Include leaderboard snippet for group members.`,
        dataPoints: { groupId: group.id, groupName: group.name, progressPct, weeklyGoal: group.weeklyGoal },
      });
    }

    // Mentor: students NOT in any group → nudge to join
    signals.push({
      loopId: 'study_groups',
      targetAgent: 'mentor',
      targetSubAgent: 'EngagementOptimizer',
      priority: 'low',
      signalType: 'study_group:join_nudge',
      insight: `Active group "${group.name}" studying "${group.topicFocus}" has ${group.memberCount} members — students who haven't joined miss 28% score boost`,
      actionRequired: `For students studying ${group.topicFocus} but NOT in a group: send "Join the squad studying your topic" nudge with group stats. One-tap join flow.`,
      dataPoints: { groupId: group.id, groupName: group.name, topic: group.topicFocus, memberCount: group.memberCount },
    });

    // Sage: if student is in this group, reference it
    signals.push({
      loopId: 'study_groups',
      targetAgent: 'sage',
      targetSubAgent: 'SocraticTutor',
      priority: 'low',
      signalType: 'study_group:context',
      insight: `Student may be in group studying "${group.topicFocus}" — use group context for motivation`,
      actionRequired: `When answering questions on "${group.topicFocus}", mention: "Your study group is working on this too — you're not alone. Let me show you the step many of them got wrong first."`,
      dataPoints: { groupTopic: group.topicFocus, groupName: group.name, groupSize: group.memberCount },
    });
  }

  // ── Loop 4: Contributed Problems → Atlas, Sage, Scout, Forge ──────────────
  const highUpvote = problems.filter(p => p.upvotes > 20);
  for (const prob of highUpvote.slice(0, 3)) {
    // Atlas: high-upvote problem = content demand signal
    signals.push({
      loopId: 'contributed_problems',
      targetAgent: 'atlas',
      targetSubAgent: 'ContentCurator',
      priority: 'high',
      signalType: 'community:high_upvote_problem',
      insight: `Community problem on "${prob.topicName}" has ${prob.upvotes} upvotes — strong demand signal`,
      actionRequired: `Create a full lesson/article around this problem type: "${prob.question.substring(0, 60)}...". Turn community demand into SEO-optimised content.`,
      dataPoints: { problemId: prob.id, topicName: prob.topicName, upvotes: prob.upvotes, difficulty: prob.difficulty },
    });

    // Sage: verified community problems extend the answer bank
    if (prob.verifiedByAI) {
      signals.push({
        loopId: 'contributed_problems',
        targetAgent: 'sage',
        targetSubAgent: 'ProblemSolver',
        priority: 'medium',
        signalType: 'community:verified_problem',
        insight: `AI-verified community problem available for "${prob.topicName}" (${prob.upvotes} upvotes)`,
        actionRequired: `Add to Sage's answer bank: when student asks about "${prob.topicName}", offer this community-contributed problem as practice. Reference contributor reputation.`,
        dataPoints: { question: prob.question, solution: prob.solution, difficulty: prob.difficulty, topicName: prob.topicName },
      });
    }

    // Scout: cluster of contributed problems on topic = SEO opportunity
    signals.push({
      loopId: 'contributed_problems',
      targetAgent: 'scout',
      targetSubAgent: 'TrendSpotter',
      priority: 'medium',
      signalType: 'community:topic_demand_cluster',
      insight: `Community contributions cluster around "${prob.topicName}" — organic demand evidence`,
      actionRequired: `Research search volume for "${prob.topicName} ${exam} problems" — high community contribution rate correlates with underserved search demand.`,
      dataPoints: { topicName: prob.topicName, chapter: prob.chapter, exam: prob.exam },
    });

    // Forge: pending AI verification queue
    if (!prob.verifiedByAI) {
      signals.push({
        loopId: 'contributed_problems',
        targetAgent: 'forge',
        targetSubAgent: 'CIManager',
        priority: 'medium',
        signalType: 'community:verification_queue',
        insight: `Unverified community problem needs AI review: "${prob.question.substring(0, 80)}..."`,
        actionRequired: 'Schedule batch AI verification job. Use LLM to check mathematical correctness, solution accuracy, and exam relevance. Publish verified batch twice daily.',
        dataPoints: { problemId: prob.id, topicName: prob.topicName, solution: prob.solution },
      });
    }
  }

  // ── Loop 5: Referral → Herald, Mentor, Oracle ─────────────────────────────
  signals.push({
    loopId: 'referral',
    targetAgent: 'herald',
    targetSubAgent: 'LeadNurtureEngine',
    priority: 'high',
    signalType: 'referral:invitee_pending',
    insight: 'Referral invitees who don\'t sign up within 48h have 70% lower conversion probability',
    actionRequired: 'After 24h of no signup from invitee: send warm re-engagement WhatsApp/email: "Your friend thinks you\'d love this. Here\'s why [specific exam benefit]." Include social proof from leaderboard.',
    dataPoints: { reEngagementWindowHrs: 24, conversionBoostFromFollowup: '2.4×' },
  });

  signals.push({
    loopId: 'referral',
    targetAgent: 'mentor',
    targetSubAgent: 'OnboardingActivator',
    priority: 'high',
    signalType: 'referral:new_referee',
    insight: 'Students who arrive via referral have 40% higher 30-day retention',
    actionRequired: 'Detect referral UTM source on new signup. Trigger warm welcome: "Welcome! [Referrer Name] says you\'re prepping for [exam] too — here\'s a personalised start plan." First 3 days are critical.',
    dataPoints: { referrerContext: 'include_referrer_name', onboardingPriority: 'premium', retentionBoost: '40%' },
  });

  signals.push({
    loopId: 'referral',
    targetAgent: 'oracle',
    targetSubAgent: 'RevenueArchitect',
    priority: 'medium',
    signalType: 'referral:ltv_signal',
    insight: 'Referral channel LTV is typically 2.5× paid acquisition LTV',
    actionRequired: 'Track referral cohort separately in LTV model. Referral conversion rate and 30-day retention should be dashboard KPIs. Raise referral reward budget if LTV/CAC ratio > 3.',
    dataPoints: { ltvMultiplier: 2.5, targetLtvCacRatio: 3 },
  });

  // ── Loop 6: Share Cards → Scout, Herald, Oracle ───────────────────────────
  signals.push({
    loopId: 'share_cards',
    targetAgent: 'scout',
    targetSubAgent: 'TrendSpotter',
    priority: 'medium',
    signalType: 'share:viral_topic',
    insight: 'Share cards with specific exam topics generate 3× more inbound clicks than generic cards',
    actionRequired: 'Monitor which share card topics drive most inbound traffic. Feed top-3 viral topics to Atlas as priority content. Current top: Integration, Named Reactions, Mendelian Genetics.',
    dataPoints: { topViralTopics: ['Integration by Parts', 'Named Reactions', 'Mendelian Genetics'] },
  });

  signals.push({
    loopId: 'share_cards',
    targetAgent: 'herald',
    targetSubAgent: 'MarketingAutomation',
    priority: 'medium',
    signalType: 'share:inbound_attribution',
    insight: 'UTM-tagged share links allow attribution of organic→paid conversion funnel',
    actionRequired: 'When a student arrives via share UTM: (1) log attribution, (2) show "Join [Sharer Name]\'s exam prep community" welcome screen, (3) add to same study group as sharer if possible.',
    dataPoints: { utmSource: 'share', utmMedium: ['streak', 'rank', 'mastery', 'problem'], conversionBoost: '1.8×' },
  });

  signals.push({
    loopId: 'share_cards',
    targetAgent: 'oracle',
    targetSubAgent: 'FunnelAnalytics',
    priority: 'low',
    signalType: 'share:funnel_tracking',
    insight: 'Share→click→signup→paid is a measurable viral funnel',
    actionRequired: 'Track share card funnel: share events → unique clicks → signups → 7-day active → paid. Calculate viral coefficient K = shares_per_user × signup_rate. Target K > 0.3.',
    dataPoints: { targetViralCoefficient: 0.3, currentFunnelSteps: ['share', 'click', 'signup', 'active', 'paid'] },
  });

  // ── Loop 7: Teacher Viral → Herald, Mentor, Nexus ─────────────────────────
  signals.push({
    loopId: 'teacher_viral',
    targetAgent: 'herald',
    targetSubAgent: 'OnboardingActivator',
    priority: 'high',
    signalType: 'teacher:class_invited',
    insight: 'Teacher-referred students arrive in batches (avg 30/class) — high-density onboarding opportunity',
    actionRequired: 'When teacher sends class invite: trigger cohort onboarding email for entire class. Subject: "[Teacher Name]\'s [School] class is prepping for [Exam] together." Include class leaderboard and group link.',
    dataPoints: { avgClassSize: 30, teacherRetentionMultiplier: '3×', batchOnboardingBoost: '55%' },
  });

  signals.push({
    loopId: 'teacher_viral',
    targetAgent: 'mentor',
    targetSubAgent: 'EngagementOptimizer',
    priority: 'high',
    signalType: 'teacher:student_assignment',
    insight: 'Teacher-assigned students have structured learning context — personalise around school curriculum',
    actionRequired: 'Detect teacher→student relationship. Customise Sage and Mentor messaging: "Your teacher assigned this. Here\'s how it maps to your [board/exam]." Align practice to teacher\'s syllabus schedule.',
    dataPoints: { teacherAssignedStudentBoost: '2.1× engagement', curriculumAlignmentRequired: true },
  });

  signals.push({
    loopId: 'teacher_viral',
    targetAgent: 'mentor', // Nexus handles ticket routing — use Mentor for engagement
    targetSubAgent: 'DeliveryCadenceManager',
    priority: 'medium',
    signalType: 'teacher:priority_support',
    insight: 'Teachers are force multipliers — 1 teacher problem = 30 student problems',
    actionRequired: 'Route all teacher support tickets to highest-priority queue. SLA: 2h response vs 24h for regular users. Teachers with unresolved issues are most likely to stop recommending the platform.',
    dataPoints: { teacherSlaHours: 2, standardSlaHours: 24, forceMultiplier: 30 },
  });

  return signals;
}

// ─── Merge signals into Prism IntelligencePackets ────────────────────────────

export function pushNetworkSignalsToPrism(exam: string = 'JEE Main'): void {
  const signals = generateNetworkSignals(exam);
  const prismState = loadPrismState();
  if (!prismState) return;

  const newPackets: IntelligencePacket[] = signals.map(sig => ({
    id: `net-${sig.loopId}-${sig.targetAgent}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    generatedAt: new Date().toISOString(),
    targetAgent: sig.targetAgent,
    subAgent: sig.targetSubAgent,
    priority: sig.priority,
    signalType: `network:${sig.signalType}`,
    insight: sig.insight,
    actionRequired: sig.actionRequired,
    dataPoints: { ...sig.dataPoints, networkLoopId: sig.loopId },
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  }));

  // Merge with existing — avoid duplicates by loopId+agent+signalType within 4h
  const existingIds = new Set(
    (prismState.intelligencePackets ?? [])
      .filter(p => p.status !== 'expired' && new Date(p.expiresAt ?? 0) > new Date())
      .map(p => `${p.signalType}-${p.targetAgent}`)
  );

  const fresh = newPackets.filter(p => !existingIds.has(`${p.signalType}-${p.targetAgent}`));

  storePrismState({
    ...prismState,
    intelligencePackets: [...(prismState.intelligencePackets ?? []), ...fresh],
  });
}

// ─── Agent-specific context getters ──────────────────────────────────────────

export function getNetworkContextForAgent(
  agent: PrismTargetAgent,
  exam: string = 'JEE Main'
): AgentNetworkContext {
  const signals = generateNetworkSignals(exam);
  const agentSignals = signals.filter(s => s.targetAgent === agent);
  const activeLoops: NetworkLoopId[] = [...new Set(agentSignals.map(s => s.loopId))];

  return {
    cohortSignals: getCohortSignals(exam),
    networkMetrics: getNetworkMetrics(),
    activeLoops,
    pendingActions: agentSignals,
  };
}

// ─── Sage-specific: Cohort-enriched prompt injection ─────────────────────────

export interface SageNetworkContext {
  cohortNote: string;          // injected into system prompt
  rankContext: string;         // motivational rank context
  groupContext: string;        // study group context if applicable
  strugglingPeersNote: string; // "312 peers also struggle with this"
}

export function buildSageNetworkContext(
  topicId: string,
  exam: string = 'JEE Main'
): SageNetworkContext {
  const cohortSignals = getCohortSignals(exam);
  const topicSignal = cohortSignals.find(s => s.topicId === topicId);
  const leaderboard = getLeaderboard(exam);
  const currentUser = leaderboard.find(e => e.isCurrentUser);
  const groups = getStudyGroups(exam);

  const cohortNote = topicSignal
    ? `COHORT CONTEXT: ${topicSignal.studentsStruggling} students in this exam are struggling with this topic (avg mastery ${topicSignal.avgMastery}%). Common mistake: "${topicSignal.commonMistakePattern}". Most asked question: "${topicSignal.mostAskedQuestion}". Proactively address this mistake BEFORE the student makes it.`
    : '';

  const rankContext = currentUser
    ? `STUDENT RANK: #${currentUser.rank} out of 1,240 (top ${Math.round((currentUser.rank / 1240) * 100)}%). Streak: ${currentUser.streak} days. Use this context to calibrate challenge level and motivation.`
    : '';

  const relevantGroup = groups.find(g =>
    g.topicFocus.toLowerCase().includes(topicId.split('-').slice(2).join(' ').toLowerCase())
  );

  const groupContext = relevantGroup
    ? `STUDY GROUP: ${relevantGroup.memberCount} students in "${relevantGroup.name}" are studying ${relevantGroup.topicFocus} this week. Weekly progress: ${Math.round((relevantGroup.weeklyProgress / relevantGroup.weeklyGoal) * 100)}%. You can reference group momentum.`
    : '';

  const strugglingPeersNote = topicSignal
    ? `${topicSignal.studentsStruggling} of your peers are working through this same challenge right now.`
    : '';

  return { cohortNote, rankContext, groupContext, strugglingPeersNote };
}

// ─── Atlas-specific: Community problem → content brief ───────────────────────

export interface AtlasContentSignal {
  topicName: string;
  contentType: 'micro_lesson' | 'practice_set' | 'blog_post' | 'quick_ref';
  urgency: 'immediate' | 'this_week' | 'backlog';
  sourceLoop: NetworkLoopId;
  brief: string;
  upvoteSignal?: number;
  studentsStruggling?: number;
}

export function getAtlasContentSignals(exam: string = 'JEE Main'): AtlasContentSignal[] {
  const signals: AtlasContentSignal[] = [];
  const cohort = getCohortSignals(exam);
  const problems = getContributedProblems(exam);
  const groups = getStudyGroups(exam);

  // From cohort struggles
  for (const s of cohort.filter(c => c.avgMastery < 50)) {
    signals.push({
      topicName: s.topicName, contentType: 'micro_lesson', urgency: 'immediate',
      sourceLoop: 'data_network',
      brief: `Micro-lesson addressing "${s.commonMistakePattern}" for ${s.topicName}. Lead with the common error, show exactly why it's wrong, then correct approach. 300-word max.`,
      studentsStruggling: s.studentsStruggling,
    });
  }

  // From high-upvote community problems
  for (const p of problems.filter(pr => pr.upvotes > 20)) {
    signals.push({
      topicName: p.topicName, contentType: 'practice_set', urgency: 'this_week',
      sourceLoop: 'contributed_problems',
      brief: `Build a 5-problem set around the community-upvoted question: "${p.question.substring(0, 80)}..." Add difficulty ladder (easy → hard). ${p.upvotes} upvotes confirm demand.`,
      upvoteSignal: p.upvotes,
    });
  }

  // From study group topics
  for (const g of groups.filter(gr => gr.activeNow > 15)) {    signals.push({
      topicName: g.topicFocus, contentType: 'quick_ref', urgency: 'immediate',
      sourceLoop: 'study_groups',
      brief: `Quick reference sheet for "${g.topicFocus}" — ${g.memberCount} students in group need this NOW. 1 page: key formulas, common mistakes, 3 worked examples. Optimised for mobile reading.`,
    });
  }

  // Sort: immediate first, then by studentsStruggling / upvoteSignal
  return signals.sort((a, b) => {
    const urgencyOrder = { immediate: 0, this_week: 1, backlog: 2 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });
}

// ─── Herald-specific: Network-triggered outreach campaigns ───────────────────

export interface HeraldCampaignSignal {
  campaignType: 'referral_reactivation' | 'group_milestone' | 'rank_surge' | 'share_followup' | 'teacher_class_invite' | 'cohort_blog';
  targetSegment: string;
  channel: 'email' | 'whatsapp' | 'push' | 'in_app';
  urgency: 'immediate' | 'scheduled';
  subject: string;
  body: string;
  cta: string;
  sourceLoop: NetworkLoopId;
}

export function getHeraldCampaignSignals(exam: string = 'JEE Main'): HeraldCampaignSignal[] {
  const cohort = getCohortSignals(exam);
  const groups = getStudyGroups(exam);
  const campaigns: HeraldCampaignSignal[] = [];

  // Referral re-activation
  campaigns.push({
    campaignType: 'referral_reactivation', targetSegment: 'invited_not_joined',
    channel: 'whatsapp', urgency: 'scheduled',
    sourceLoop: 'referral',
    subject: 'Your study buddy is waiting',
    body: 'Your friend invited you to study {{exam}} together on EduGenius. 1,240 aspirants are already ahead of you. Join free — no credit card.',
    cta: 'Join in 30 seconds →',
  });

  // Group milestone celebration
  for (const g of groups.filter(gr => Math.round((gr.weeklyProgress / gr.weeklyGoal) * 100) >= 80).slice(0, 1)) {
    campaigns.push({
      campaignType: 'group_milestone', targetSegment: `group_${g.id}`,
      channel: 'push', urgency: 'immediate',
      sourceLoop: 'study_groups',
      subject: `${g.name} is 80% to weekly goal! 🔥`,
      body: `Your group has solved ${g.weeklyProgress}/${g.weeklyGoal} problems this week. Push together to hit the goal — everyone's close!`,
      cta: 'Solve 1 more problem →',
    });
  }

  // Blog from cohort struggle
  for (const s of cohort.filter(c => c.avgMastery < 50).slice(0, 2)) {
    campaigns.push({
      campaignType: 'cohort_blog', targetSegment: `students_struggling_${s.topicId}`,
      channel: 'email', urgency: 'scheduled',
      sourceLoop: 'data_network',
      subject: `${s.studentsStruggling} students make this ${s.topicName} mistake`,
      body: `We analysed patterns from 1,240+ students preparing for ${exam}. Here's the most common mistake in ${s.topicName}: "${s.commonMistakePattern}". Here's exactly how to fix it...`,
      cta: 'Read the fix →',
    });
  }

  return campaigns;
}
