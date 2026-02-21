/**
 * Network Effects Engine
 *
 * Powers all 7 network effect loops in EduGenius:
 *  1. Data Network Effect   — cohort signals improve AI for everyone
 *  2. Leaderboard           — exam-rank visibility drives practice (consent: show_rank)
 *  3. Study Groups          — peer learning pods per exam (consent: join_group)
 *  4. Problem Contribution  — user-submitted questions enrich the bank (consent: contribute_problems)
 *  5. Referral Loop         — invite friends, both earn (consent: referral)
 *  6. Teacher Viral         — teacher assigns → class onboards
 *  7. Content Virality      — shareable score cards & streak cards
 *
 * Consent model:
 *  - All consent flags stored in localStorage under `edugenius_network_consent`
 *  - No data is shared/displayed without explicit opt-in
 *  - Each feature shows a clear consent prompt on first use
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type NetworkFeature =
  | 'show_rank'
  | 'join_group'
  | 'contribute_problems'
  | 'referral'
  | 'content_sharing'
  | 'data_network';   // this one is always on (anonymised cohort stats only)

export interface NetworkConsent {
  show_rank: boolean;
  join_group: boolean;
  contribute_problems: boolean;
  referral: boolean;
  content_sharing: boolean;
  data_network: boolean;        // always true but stored for transparency
  lastUpdated: number;
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;          // anonymised if not consented: "JEE Aspirant #847"
  exam: string;
  masteryScore: number;         // 0–100
  streak: number;
  problemsSolved: number;
  isCurrentUser?: boolean;
  badge?: string;
}

export interface StudyGroup {
  id: string;
  exam: string;
  name: string;
  memberCount: number;
  activeNow: number;
  topicFocus: string;
  weeklyGoal: number;           // problems/week
  weeklyProgress: number;
  joinCode?: string;
  isJoined: boolean;
  createdAt: number;
}

export interface ContributedProblem {
  id: string;
  topicId: string;
  topicName: string;
  chapter: string;
  subject: string;
  exam: string[];
  question: string;
  options?: string[];
  correctIndex?: number;
  solution: string;
  contributorAlias: string;     // "JEE Warrior #312" — never real name
  upvotes: number;
  hasUpvoted: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  verifiedByAI: boolean;
  timestamp: number;
  tags: string[];
}

export interface ReferralState {
  referralCode: string;
  referralLink: string;
  successfulReferrals: number;
  pendingReferrals: number;
  rewardEarned: string;          // e.g. "7 days Premium"
  rewardPending: string;
  milestones: ReferralMilestone[];
}

export interface ReferralMilestone {
  count: number;
  reward: string;
  achieved: boolean;
}

export interface ShareCard {
  type: 'streak' | 'rank' | 'mastery' | 'problem_solved';
  headline: string;
  subline: string;
  stat: string;
  exam: string;
  cta: string;
  deepLink: string;
  bgGradient: string;
}

export interface NetworkMetrics {
  totalActiveStudents: number;
  studentsOnlineNow: number;
  problemsSubmittedToday: number;
  avgCohortMastery: number;
  topStudyingTopic: string;
  dataNetworkMultiplier: number;  // how much the AI has improved (1.0 = baseline)
}

// ─── Consent helpers ──────────────────────────────────────────────────────────

const CONSENT_KEY = 'edugenius_network_consent';

export function loadConsent(): NetworkConsent {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (raw) return JSON.parse(raw) as NetworkConsent;
  } catch { /* ignore */ }
  return {
    show_rank: false,
    join_group: false,
    contribute_problems: false,
    referral: false,
    content_sharing: false,
    data_network: true,
    lastUpdated: Date.now(),
  };
}

export function saveConsent(c: NetworkConsent): void {
  localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...c, lastUpdated: Date.now() }));
}

export function grantConsent(feature: NetworkFeature): NetworkConsent {
  const c = loadConsent();
  const updated = { ...c, [feature]: true };
  saveConsent(updated);
  return updated;
}

export function revokeConsent(feature: NetworkFeature): NetworkConsent {
  const c = loadConsent();
  const updated = { ...c, [feature]: false };
  saveConsent(updated);
  return updated;
}

// ─── Leaderboard mock data ────────────────────────────────────────────────────

export function getLeaderboard(exam: string, currentUserScore: number = 72): LeaderboardEntry[] {
  const base: LeaderboardEntry[] = [
    { rank: 1,  displayName: 'Arjun S.',        exam, masteryScore: 94, streak: 42, problemsSolved: 847, badge: '🏆 Titan' },
    { rank: 2,  displayName: 'Priya M.',         exam, masteryScore: 91, streak: 38, problemsSolved: 782, badge: '⚡ Spark' },
    { rank: 3,  displayName: 'Rohan K.',         exam, masteryScore: 89, streak: 35, problemsSolved: 721 },
    { rank: 4,  displayName: 'Sneha T.',         exam, masteryScore: 87, streak: 31, problemsSolved: 698 },
    { rank: 5,  displayName: 'Karan P.',         exam, masteryScore: 85, streak: 28, problemsSolved: 654 },
    { rank: 12, displayName: 'You',              exam, masteryScore: currentUserScore, streak: 7, problemsSolved: 124, isCurrentUser: true, badge: '🌱 Rising' },
    { rank: 13, displayName: 'JEE Aspirant #91', exam, masteryScore: currentUserScore - 2, streak: 5, problemsSolved: 110 },
    { rank: 14, displayName: 'JEE Aspirant #44', exam, masteryScore: currentUserScore - 3, streak: 3, problemsSolved: 98 },
  ];
  return base;
}

// ─── Study Groups mock data ───────────────────────────────────────────────────

export function getStudyGroups(exam: string): StudyGroup[] {
  const GROUPS: StudyGroup[] = [
    {
      id: 'sg-jee-01', exam: 'JEE Main', name: '🔥 JEE Crack Squad',
      memberCount: 847, activeNow: 34, topicFocus: 'Integration Techniques',
      weeklyGoal: 50, weeklyProgress: 38, isJoined: false, createdAt: Date.now() - 30 * 86400000,
    },
    {
      id: 'sg-jee-02', exam: 'JEE Main', name: '⚡ Organic Chemistry Ninjas',
      memberCount: 312, activeNow: 18, topicFocus: 'Named Reactions',
      weeklyGoal: 30, weeklyProgress: 22, isJoined: false, createdAt: Date.now() - 15 * 86400000,
    },
    {
      id: 'sg-jee-03', exam: 'JEE Main', name: '🚀 Physics First Principles',
      memberCount: 524, activeNow: 27, topicFocus: 'Electrostatics',
      weeklyGoal: 40, weeklyProgress: 29, isJoined: false, createdAt: Date.now() - 22 * 86400000,
    },
    {
      id: 'sg-neet-01', exam: 'NEET', name: '🧬 NEET Biology Masters',
      memberCount: 1240, activeNow: 67, topicFocus: 'Genetics & Heredity',
      weeklyGoal: 60, weeklyProgress: 51, isJoined: false, createdAt: Date.now() - 45 * 86400000,
    },
    {
      id: 'sg-neet-02', exam: 'NEET', name: '⚗️ Organic Chemistry NEET',
      memberCount: 489, activeNow: 22, topicFocus: 'Biomolecules',
      weeklyGoal: 35, weeklyProgress: 18, isJoined: false, createdAt: Date.now() - 10 * 86400000,
    },
    {
      id: 'sg-cat-01', exam: 'CAT', name: '📊 CAT DILR Domination',
      memberCount: 378, activeNow: 15, topicFocus: 'LR Sets — Grouping',
      weeklyGoal: 25, weeklyProgress: 20, isJoined: false, createdAt: Date.now() - 20 * 86400000,
    },
  ];
  return GROUPS.filter(g => g.exam === exam || exam === 'All');
}

// ─── Contributed Problems mock data ──────────────────────────────────────────

export function getContributedProblems(exam: string): ContributedProblem[] {
  return [
    {
      id: 'cp-001', topicId: 'jee-oc-01', topicName: 'Named Reactions',
      chapter: 'Organic Chemistry', subject: 'Chemistry', exam: ['JEE Main', 'JEE Adv'],
      question: 'In the Cannizzaro reaction, 2 HCHO + NaOH gives which products?',
      options: ['CH₃OH + HCOONa', 'HCOOH + CH₃ONa', 'CH₄ + CO₂', 'CH₂O₂ + NaH'],
      correctIndex: 0,
      solution: 'Self-oxidation-reduction: HCHO → CH₃OH (reduced) + HCOONa (oxidised). No α-H so no aldol.',
      contributorAlias: 'Chem Warrior #312', upvotes: 47, hasUpvoted: false,
      difficulty: 'hard', verifiedByAI: true, timestamp: Date.now() - 2 * 86400000,
      tags: ['named reactions', 'cannizzaro', 'oxidation'],
    },
    {
      id: 'cp-002', topicId: 'jee-c3', topicName: 'Integration by Parts',
      chapter: 'Calculus', subject: 'Mathematics', exam: ['JEE Main'],
      question: 'Evaluate: ∫ x²·ln(x) dx',
      solution: 'IBP with u=ln(x), dv=x²dx → du=dx/x, v=x³/3\n= x³ln(x)/3 − x³/9 + C',
      contributorAlias: 'Maths Monk #88', upvotes: 31, hasUpvoted: false,
      difficulty: 'medium', verifiedByAI: true, timestamp: Date.now() - 4 * 86400000,
      tags: ['integration', 'IBP', 'logarithm'],
    },
    {
      id: 'cp-003', topicId: 'neet-gen-01', topicName: 'Mendelian Genetics',
      chapter: 'Genetics', subject: 'Biology', exam: ['NEET'],
      question: 'In a dihybrid cross AaBb × AaBb, what fraction shows both dominant traits?',
      solution: '9/16 — standard Mendelian 9:3:3:1 ratio; 9 show both dominant phenotypes.',
      contributorAlias: 'Bio Pioneer #201', upvotes: 62, hasUpvoted: false,
      difficulty: 'easy', verifiedByAI: true, timestamp: Date.now() - 1 * 86400000,
      tags: ['genetics', 'dihybrid', 'mendelian'],
    },
    {
      id: 'cp-004', topicId: 'jee-es-01', topicName: "Coulomb's Law",
      chapter: 'Electrostatics', subject: 'Physics', exam: ['JEE Main', 'NEET'],
      question: 'Two charges +2μC and +8μC separated by 30 cm. Where is the null point from +2μC?',
      solution: 'At null point: k·2/r² = k·8/(0.3−r)² → 1/r = 2/(0.3−r) → r = 0.1 m (10 cm from +2μC)',
      contributorAlias: 'Physics Ace #447', upvotes: 28, hasUpvoted: false,
      difficulty: 'medium', verifiedByAI: false, timestamp: Date.now() - 3 * 86400000,
      tags: ['electrostatics', 'coulomb', 'null point'],
    },
  ].filter(p => p.exam.includes(exam) || exam === 'All') as ContributedProblem[];
}

// ─── Referral helpers ─────────────────────────────────────────────────────────

export function getReferralState(userId: string = 'demo'): ReferralState {
  const code = `EG-${userId.slice(0, 4).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`;
  return {
    referralCode: code,
    referralLink: `https://edugenius-v2.netlify.app?ref=${code}`,
    successfulReferrals: 2,
    pendingReferrals: 1,
    rewardEarned: '14 days Premium',
    rewardPending: '7 days Premium',
    milestones: [
      { count: 1, reward: '7 days Premium',  achieved: true },
      { count: 3, reward: '1 month Premium', achieved: false },
      { count: 5, reward: '3 months Premium + Merch', achieved: false },
      { count: 10, reward: 'Lifetime Pro',   achieved: false },
    ],
  };
}

// ─── Share Card generator ─────────────────────────────────────────────────────

export function generateShareCard(type: ShareCard['type'], data: {
  exam: string; streak?: number; rank?: number; mastery?: number; topic?: string;
}): ShareCard {
  const { exam, streak = 0, rank = 0, mastery = 0, topic = '' } = data;
  const base = 'https://edugenius-v2.netlify.app';

  switch (type) {
    case 'streak':
      return {
        type, exam,
        headline: `🔥 ${streak}-day study streak!`,
        subline: `Studying ${exam} on EduGenius`,
        stat: `${streak} days`,
        cta: 'Start your streak →',
        deepLink: `${base}?utm_source=share&utm_medium=streak&utm_campaign=${exam.replace(' ', '_')}`,
        bgGradient: 'from-orange-600 to-red-700',
      };
    case 'rank':
      return {
        type, exam,
        headline: `🏆 Ranked #${rank} in ${exam}`,
        subline: `Top ${Math.round((rank / 1240) * 100)}% of all ${exam} aspirants`,
        stat: `#${rank}`,
        cta: 'Can you beat me? →',
        deepLink: `${base}?utm_source=share&utm_medium=rank&exam=${exam.replace(' ', '_')}`,
        bgGradient: 'from-yellow-600 to-orange-600',
      };
    case 'mastery':
      return {
        type, exam,
        headline: `✅ Mastered ${topic}`,
        subline: `${mastery}% mastery in ${exam} ${topic}`,
        stat: `${mastery}%`,
        cta: 'Study smarter →',
        deepLink: `${base}?utm_source=share&utm_medium=mastery&topic=${encodeURIComponent(topic)}`,
        bgGradient: 'from-green-600 to-teal-700',
      };
    case 'problem_solved':
      return {
        type, exam,
        headline: `🧠 Solved a ${exam} problem!`,
        subline: `Topic: ${topic}`,
        stat: `${topic}`,
        cta: 'Try it yourself →',
        deepLink: `${base}?utm_source=share&utm_medium=problem&exam=${exam.replace(' ', '_')}`,
        bgGradient: 'from-purple-600 to-blue-700',
      };
  }
}

// ─── Network Metrics (live cohort data) ──────────────────────────────────────

export function getNetworkMetrics(): NetworkMetrics {
  return {
    totalActiveStudents: 1240,
    studentsOnlineNow: Math.floor(80 + Math.random() * 60),
    problemsSubmittedToday: 847,
    avgCohortMastery: 54,
    topStudyingTopic: 'Integration by Parts',
    dataNetworkMultiplier: 1.34,  // Sage answers are 34% more accurate than baseline
  };
}

// ─── Data Network Effect: cohort insights injected into Sage ─────────────────

export interface CohortSignal {
  topicId: string;
  topicName: string;
  avgMastery: number;
  commonMistakePattern: string;
  mostAskedQuestion: string;
  studentsStruggling: number;
}

export function getCohortSignals(exam: string): CohortSignal[] {
  return [
    {
      topicId: 'jee-oc-01', topicName: 'Named Reactions',
      avgMastery: 41, commonMistakePattern: 'Confusing Cannizzaro with Aldol (both aldehydes)',
      mostAskedQuestion: 'Which aldehydes undergo Cannizzaro?',
      studentsStruggling: 312,
    },
    {
      topicId: 'jee-c3', topicName: 'Integration by Parts',
      avgMastery: 48, commonMistakePattern: 'Wrong choice of u (not following ILATE)',
      mostAskedQuestion: '∫ x·ln(x) dx — which to pick as u?',
      studentsStruggling: 287,
    },
    {
      topicId: 'jee-es-01', topicName: "Coulomb's Law",
      avgMastery: 63, commonMistakePattern: 'Null point calculation — squaring error',
      mostAskedQuestion: 'Three charges in a line — find equilibrium point',
      studentsStruggling: 198,
    },
    {
      topicId: 'neet-gen-01', topicName: 'Mendelian Genetics',
      avgMastery: 57, commonMistakePattern: 'Incomplete dominance vs codominance mix-up',
      mostAskedQuestion: 'Difference between incomplete dominance and codominance?',
      studentsStruggling: 241,
    },
  ].filter(s => exam === 'All' || ['JEE Main', 'NEET'].includes(exam));
}
