/**
 * Persona Content Bridge
 *
 * Aggregates individual student persona signals into cohort-level insights.
 * Atlas and Herald read this to make content decisions.
 *
 * Think of it as: "What does our student cohort ACTUALLY need right now?"
 */

import type { StudentPersona, ExamType, EmotionalState, PerformanceTier } from './studentPersonaEngine';

// ── Cohort Insight (aggregated from all student personas) ─────────────────────

export interface CohortInsight {
  generatedAt: Date;
  totalStudents: number;

  // Top pain points across cohort
  topWeakTopics: { topic: string; examType: ExamType; count: number; urgency: 'critical' | 'high' | 'medium' }[];

  // Emotional landscape
  emotionalDistribution: Record<EmotionalState, number>; // % of students in each state
  dominantEmotion: EmotionalState;

  // Performance spread
  tierDistribution: Record<PerformanceTier, number>; // % in each tier
  avgSyllabusCompletion: number;
  avgDaysToExam: number;

  // Engagement signals
  avgStreakDays: number;
  avgSessionMinutes: number;

  // Content opportunities (what to write NOW)
  contentOpportunities: ContentOpportunity[];

  // Outreach triggers (what Herald should send NOW)
  outreachTriggers: OutreachTrigger[];
}

export interface ContentOpportunity {
  id: string;
  type: 'blog' | 'video' | 'practice_set' | 'cheatsheet' | 'email' | 'whatsapp_tip';
  title: string;
  targetExam: ExamType | 'all';
  targetTier: PerformanceTier | 'all';
  targetEmotion: EmotionalState | 'all';
  urgency: 'publish_now' | 'this_week' | 'this_month';
  reasoning: string;       // Why this content is needed
  suggestedAngle: string;  // The hook/frame for this content
  estimatedImpact: string; // What outcome this drives
  assignTo: 'Atlas' | 'Herald' | 'both';
  seoKeywords?: string[];
}

export interface OutreachTrigger {
  id: string;
  channel: 'whatsapp' | 'email' | 'push' | 'telegram';
  targetSegment: string;   // e.g. "JEE students inactive 3+ days"
  studentCount: number;
  messageAngle: string;    // What tone/hook to use
  urgency: 'send_now' | 'today' | 'this_week';
  suggestedTemplate: string; // Draft message for Herald
}

// ── Mock cohort data (Oracle replaces with real data when backend live) ───────

const MOCK_COHORT: Partial<CohortInsight> = {
  totalStudents: 1240,
  topWeakTopics: [
    { topic: 'Organic Chemistry — Named Reactions', examType: 'JEE_MAIN', count: 312, urgency: 'critical' },
    { topic: 'Integration by Parts', examType: 'JEE_MAIN', count: 287, urgency: 'critical' },
    { topic: 'Genetics and Evolution', examType: 'NEET', count: 241, urgency: 'high' },
    { topic: 'Electrochemistry', examType: 'JEE_MAIN', count: 198, urgency: 'high' },
    { topic: 'Modern Physics', examType: 'JEE_ADVANCED', count: 176, urgency: 'high' },
    { topic: 'Reading Comprehension', examType: 'CAT', count: 143, urgency: 'medium' },
    { topic: 'Human Physiology', examType: 'NEET', count: 134, urgency: 'medium' },
    { topic: 'Coordinate Geometry', examType: 'CBSE_12', count: 121, urgency: 'medium' },
  ],
  emotionalDistribution: {
    frustrated: 28,
    anxious: 22,
    neutral: 31,
    confident: 11,
    motivated: 5,
    exhausted: 3,
  },
  dominantEmotion: 'frustrated',
  tierDistribution: {
    struggling: 34,
    average: 41,
    good: 19,
    advanced: 6,
  },
  avgSyllabusCompletion: 54,
  avgDaysToExam: 67,
  avgStreakDays: 3.2,
  avgSessionMinutes: 28,
};

// ── Content opportunity generator ─────────────────────────────────────────────

export function generateContentOpportunities(cohort: Partial<CohortInsight>): ContentOpportunity[] {
  const opportunities: ContentOpportunity[] = [];
  const weakTopics = cohort.topWeakTopics || [];
  const emotion = cohort.dominantEmotion || 'neutral';
  const daysToExam = cohort.avgDaysToExam || 90;

  // 1. Top weak topic → blog post + practice set
  if (weakTopics[0]) {
    const top = weakTopics[0];
    opportunities.push({
      id: `blog_${top.topic.replace(/\s+/g, '_').toLowerCase()}`,
      type: 'blog',
      title: `"${top.topic}" — The Complete Guide Students Actually Need`,
      targetExam: top.examType,
      targetTier: 'struggling',
      targetEmotion: 'frustrated',
      urgency: top.urgency === 'critical' ? 'publish_now' : 'this_week',
      reasoning: `${top.count} students are struggling with ${top.topic} — highest pain point in cohort`,
      suggestedAngle: `Start with "You're not alone — this is the #1 topic students struggle with." Break it into 3 simple steps. End with a practice shortcut.`,
      estimatedImpact: `Reduces Sage doubt load on this topic by ~30%. High organic search potential.`,
      assignTo: 'Atlas',
      seoKeywords: [
        `${top.topic.toLowerCase()} for ${top.examType.replace('_', ' ')}`,
        `how to study ${top.topic.toLowerCase()}`,
        `${top.topic.toLowerCase()} tricks`,
      ],
    });

    opportunities.push({
      id: `practice_${top.topic.replace(/\s+/g, '_').toLowerCase()}`,
      type: 'practice_set',
      title: `${top.topic} — 20 Practice Questions (Easy to Hard)`,
      targetExam: top.examType,
      targetTier: 'all',
      targetEmotion: 'all',
      urgency: 'publish_now',
      reasoning: `Complement the blog post. Students learn by doing.`,
      suggestedAngle: `Start with 5 concept-check questions, then 10 application, then 5 exam-level.`,
      estimatedImpact: `Direct practice improvement. Reduces repeat doubts to Sage.`,
      assignTo: 'Atlas',
    });
  }

  // 2. Emotional state → motivational content
  if (emotion === 'frustrated' || emotion === 'anxious') {
    opportunities.push({
      id: 'motivational_real_talk',
      type: 'blog',
      title: daysToExam < 30
        ? `Last ${daysToExam} Days Strategy — What Actually Works (From Students Who've Been Here)`
        : `Why You're Feeling Behind (And Why That's Normal)`,
      targetExam: 'all',
      targetTier: 'struggling',
      targetEmotion: emotion,
      urgency: 'publish_now',
      reasoning: `${cohort.emotionalDistribution?.[emotion]}% of students are ${emotion} right now — highest emotional cluster`,
      suggestedAngle: `Lead with empathy ("This is the hardest part of prep — and it's supposed to be"). Use real student quotes/scenarios. End with 3 actionable steps, not inspiration.`,
      estimatedImpact: `Increases app opens by students about to churn. Reduces support tickets.`,
      assignTo: 'Herald',
      seoKeywords: ['exam pressure tips', 'feeling behind in studies', 'exam anxiety tips'],
    });
  }

  // 3. Cheatsheet for #2 weak topic
  if (weakTopics[1]) {
    const second = weakTopics[1];
    opportunities.push({
      id: `cheatsheet_${second.topic.replace(/\s+/g, '_').toLowerCase()}`,
      type: 'cheatsheet',
      title: `${second.topic} — 1-Page Formula Sheet`,
      targetExam: second.examType,
      targetTier: 'all',
      targetEmotion: 'all',
      urgency: 'this_week',
      reasoning: `${second.count} students struggling. A cheatsheet is the fastest value delivery.`,
      suggestedAngle: `All formulas, one visual. No explanation. Print and stick above desk.`,
      estimatedImpact: `Highly shareable. WhatsApp forward potential = free virality.`,
      assignTo: 'Atlas',
    });
  }

  // 4. High completion students → advanced content
  if ((cohort.tierDistribution?.advanced || 0) > 5) {
    opportunities.push({
      id: 'advanced_edge_cases',
      type: 'blog',
      title: `Tricky ${weakTopics[0]?.examType?.replace('_', ' ') || 'JEE'} Questions That Fool Even Toppers`,
      targetExam: weakTopics[0]?.examType || 'JEE_MAIN',
      targetTier: 'advanced',
      targetEmotion: 'confident',
      urgency: 'this_week',
      reasoning: `Advanced students (6% of cohort) need harder content to stay engaged`,
      suggestedAngle: `"If you're scoring 85%+, stop reading basic guides. Here's what will push you to 95%."`,
      estimatedImpact: `Retains advanced students who might leave for Unacademy/PW.`,
      assignTo: 'Atlas',
    });
  }

  return opportunities;
}

// ── Outreach trigger generator ────────────────────────────────────────────────

export function generateOutreachTriggers(cohort: Partial<CohortInsight>): OutreachTrigger[] {
  const triggers: OutreachTrigger[] = [];
  const daysToExam = cohort.avgDaysToExam || 90;

  // Inactive frustrated students
  triggers.push({
    id: 'rescue_frustrated_inactive',
    channel: 'whatsapp',
    targetSegment: 'Students frustrated + inactive 3+ days',
    studentCount: Math.round((cohort.totalStudents || 1000) * 0.15),
    messageAngle: 'Acknowledge struggle, offer specific help on their weak topic, not generic motivation',
    urgency: 'send_now',
    suggestedTemplate: `Hey {{name}} 👋 Struggling with {{weak_topic}}? You're not the only one — 300+ students asked Sage about this this week. Here's the shortcut that helped them: [link]. Reply "help" if you want a 5-min walkthrough.`,
  });

  // High achievers — push harder
  triggers.push({
    id: 'challenge_advanced',
    channel: 'whatsapp',
    targetSegment: 'Advanced tier students (85%+ scores)',
    studentCount: Math.round((cohort.totalStudents || 1000) * 0.06),
    messageAngle: 'Challenge them, peer energy, not teacher-student',
    urgency: 'today',
    suggestedTemplate: `{{name}}, you're in the top 6% of EduGenius students. Ready for a harder challenge? Try this JEE Adv-level question: [link]. Most students get it wrong in under 10 seconds. Can you spot why?`,
  });

  // Exam countdown urgency
  if (daysToExam < 30) {
    triggers.push({
      id: 'exam_countdown_urgent',
      channel: 'email',
      targetSegment: `All students with exam in < ${daysToExam} days`,
      studentCount: cohort.totalStudents || 1000,
      messageAngle: 'Last-lap urgency + specific high-probability topic list',
      urgency: 'send_now',
      suggestedTemplate: `Subject: ${daysToExam} days left — here's what matters most\n\nYour exam is ${daysToExam} days away. Based on past years' papers, these 5 topics appear every year: [list]. Focus here first. Everything else is bonus.`,
    });
  }

  return triggers;
}

// ── Main aggregator (loads cohort, generates all insights) ────────────────────

export function getCohortInsights(): CohortInsight {
  // Try to load from localStorage (Mentor/Oracle would populate this from real data)
  try {
    const stored = localStorage.getItem('edugenius_cohort_insights');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...parsed,
        generatedAt: new Date(parsed.generatedAt),
        contentOpportunities: generateContentOpportunities(parsed),
        outreachTriggers: generateOutreachTriggers(parsed),
      };
    }
  } catch { /* fall through to mock */ }

  // Fall back to mock cohort
  const cohort = MOCK_COHORT;
  return {
    generatedAt: new Date(),
    totalStudents: cohort.totalStudents!,
    topWeakTopics: cohort.topWeakTopics!,
    emotionalDistribution: cohort.emotionalDistribution!,
    dominantEmotion: cohort.dominantEmotion!,
    tierDistribution: cohort.tierDistribution!,
    avgSyllabusCompletion: cohort.avgSyllabusCompletion!,
    avgDaysToExam: cohort.avgDaysToExam!,
    avgStreakDays: cohort.avgStreakDays!,
    avgSessionMinutes: cohort.avgSessionMinutes!,
    contentOpportunities: generateContentOpportunities(cohort),
    outreachTriggers: generateOutreachTriggers(cohort),
  };
}

// ── Atlas topic queue (what Atlas should write next) ─────────────────────────

export function getAtlasTopicQueue(): ContentOpportunity[] {
  const insights = getCohortInsights();
  const baseQueue = insights.contentOpportunities
    .filter(c => c.assignTo === 'Atlas' || c.assignTo === 'both')
    .sort((a, b) => {
      const urgencyScore: Record<ContentOpportunity['urgency'], number> = {
        publish_now: 3,
        this_week: 2,
        this_month: 1,
      };
      return urgencyScore[b.urgency] - urgencyScore[a.urgency];
    });

  // Merge network-effect signals (contributed problems, study group topics)
  try {
    const { getAtlasContentSignals } = require('./networkAgentBridge') as { getAtlasContentSignals: (exam: string) => { topicName: string; contentType: string; urgency: string; brief: string; studentsStruggling?: number; upvoteSignal?: number }[] };
    const networkSignals = getAtlasContentSignals('JEE Main');
    const networkItems: ContentOpportunity[] = networkSignals.map((sig, i) => ({
      id: `net-atlas-${i}`,
      type: 'practice_set' as const,
      title: `[Network] ${sig.topicName} — ${sig.contentType}`,
      targetExam: 'JEE_MAIN' as const,
      targetTier: 'all' as const,
      targetEmotion: 'all' as const,
      urgency: (sig.urgency === 'immediate' ? 'publish_now' : sig.urgency === 'this_week' ? 'this_week' : 'this_month') as ContentOpportunity['urgency'],
      reasoning: `Network signal: ${sig.brief}`,
      suggestedAngle: sig.brief,
      estimatedImpact: `${sig.studentsStruggling ?? sig.upvoteSignal ?? 50} students signalled demand`,
      assignTo: 'Atlas' as const,
    }));
    return [...networkItems.filter(n => n.urgency === 'publish_now'), ...baseQueue, ...networkItems.filter(n => n.urgency !== 'publish_now')];
  } catch {
    return baseQueue;
  }
}

// ── Herald content calendar (what Herald should send) ────────────────────────

export function getHeraldContentCalendar(): {
  immediate: OutreachTrigger[];
  thisWeek: ContentOpportunity[];
  networkCampaigns: { campaignType: string; subject: string; body: string; channel: string; sourceLoop: string }[];
  insights: CohortInsight;
} {
  const insights = getCohortInsights();

  // Pull network-triggered campaigns
  let networkCampaigns: { campaignType: string; subject: string; body: string; channel: string; sourceLoop: string }[] = [];
  try {
    const { getHeraldCampaignSignals } = require('./networkAgentBridge');
    networkCampaigns = getHeraldCampaignSignals('JEE Main');
  } catch { /* no-op */ }

  return {
    immediate: insights.outreachTriggers.filter(t => t.urgency === 'send_now'),
    thisWeek: insights.contentOpportunities
      .filter(c => c.assignTo === 'Herald' || c.assignTo === 'both')
      .filter(c => c.urgency !== 'this_month'),
    networkCampaigns,
    insights,
  };
}

// ── Persona → cohort aggregator (used when real student data flows in) ────────

/**
 * Aggregates an array of live student personas into a CohortInsight snapshot.
 * Call this when Oracle/Mentor push fresh persona data to localStorage.
 */
export function aggregatePersonasToCohort(personas: StudentPersona[]): Partial<CohortInsight> {
  if (personas.length === 0) return MOCK_COHORT;

  const total = personas.length;

  // Tally emotional distribution
  const emotionCounts: Record<EmotionalState, number> = {
    frustrated: 0, anxious: 0, neutral: 0, confident: 0, motivated: 0, exhausted: 0,
  };
  for (const p of personas) emotionCounts[p.emotionalState]++;
  const emotionalDistribution = Object.fromEntries(
    Object.entries(emotionCounts).map(([k, v]) => [k, Math.round((v / total) * 100)])
  ) as Record<EmotionalState, number>;

  // Dominant emotion
  const dominantEmotion = (Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0][0]) as EmotionalState;

  // Tier distribution
  const tierCounts: Record<PerformanceTier, number> = { struggling: 0, average: 0, good: 0, advanced: 0 };
  for (const p of personas) tierCounts[p.tier]++;
  const tierDistribution = Object.fromEntries(
    Object.entries(tierCounts).map(([k, v]) => [k, Math.round((v / total) * 100)])
  ) as Record<PerformanceTier, number>;

  // Aggregate weak subjects across all personas → ranked by frequency
  const topicFrequency: Record<string, { examType: ExamType; count: number }> = {};
  for (const p of personas) {
    for (const subject of p.weakSubjects) {
      const key = subject;
      if (!topicFrequency[key]) topicFrequency[key] = { examType: p.exam, count: 0 };
      topicFrequency[key].count++;
    }
  }
  const topWeakTopics = Object.entries(topicFrequency)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([topic, data]) => ({
      topic,
      examType: data.examType,
      count: data.count,
      urgency: data.count > total * 0.2
        ? 'critical' as const
        : data.count > total * 0.1
          ? 'high' as const
          : 'medium' as const,
    }));

  // Averages
  const avgSyllabusCompletion = Math.round(personas.reduce((s, p) => s + p.syllabusCompletion, 0) / total);
  const avgDaysToExam = Math.round(personas.reduce((s, p) => s + p.daysToExam, 0) / total);
  const avgStreakDays = parseFloat((personas.reduce((s, p) => s + p.streakDays, 0) / total).toFixed(1));
  const avgSessionMinutes = Math.round(personas.reduce((s, p) => s + p.avgSessionMinutes, 0) / total);

  return {
    totalStudents: total,
    topWeakTopics,
    emotionalDistribution,
    dominantEmotion,
    tierDistribution,
    avgSyllabusCompletion,
    avgDaysToExam,
    avgStreakDays,
    avgSessionMinutes,
  };
}

/**
 * Push fresh persona data into localStorage so getCohortInsights() picks it up.
 * Oracle/Mentor call this after computing cohort aggregates.
 */
export function pushCohortInsights(cohort: Partial<CohortInsight>): void {
  try {
    localStorage.setItem('edugenius_cohort_insights', JSON.stringify({
      ...cohort,
      generatedAt: new Date().toISOString(),
    }));
  } catch { /* storage full or unavailable */ }
}
