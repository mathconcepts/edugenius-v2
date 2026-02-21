/**
 * Network Effects Hub
 *
 * All 7 network effect loops in one place, consent-gated:
 *  1. Data Network Effect (always on — anonymised)
 *  2. Leaderboard         (consent: show_rank)
 *  3. Study Groups        (consent: join_group)
 *  4. Problem Bank        (consent: contribute_problems)
 *  5. Referral Program    (consent: referral)
 *  6. Share Cards         (consent: content_sharing)
 *  7. Teacher Viral       (teacher role only)
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Trophy, BookOpen, Share2, Gift, TrendingUp, Zap,
  Shield, Check, Lock, ChevronRight, Copy, ExternalLink,
  ThumbsUp, Star, Crown, Flame, Target, Plus, X, Info,
  BarChart2, Globe, Network, GraduationCap, MessageSquare,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  type NetworkFeature, type NetworkConsent, type StudyGroup,
  type ContributedProblem, type LeaderboardEntry, type ShareCard,
  loadConsent, saveConsent, grantConsent, revokeConsent,
  getLeaderboard, getStudyGroups, getContributedProblems,
  getReferralState, generateShareCard, getNetworkMetrics, getCohortSignals,
} from '@/services/networkEffectsEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'leaderboard' | 'groups' | 'problems' | 'referral' | 'share' | 'insights';

const EXAM_LIST = ['JEE Main', 'NEET', 'CAT', 'CBSE 12', 'UPSC', 'GATE'];

// ─── Consent Gate component ───────────────────────────────────────────────────

function ConsentGate({ feature, title, description, icon: Icon, benefit, children, consent, onGrant }: {
  feature: NetworkFeature;
  title: string;
  description: string;
  icon: React.FC<{className?: string}>;
  benefit: string;
  children: React.ReactNode;
  consent: NetworkConsent;
  onGrant: (f: NetworkFeature) => void;
}) {
  const isGranted = consent[feature];

  if (isGranted) return <>{children}</>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="card p-8 text-center flex flex-col items-center gap-4 max-w-md mx-auto mt-8">
      <div className="w-16 h-16 rounded-2xl bg-primary-900/30 border border-primary-500/30 flex items-center justify-center">
        <Icon className="w-8 h-8 text-primary-400" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-surface-400 mb-3">{description}</p>
        <div className="flex items-center justify-center gap-2 text-xs text-green-400 bg-green-900/20 border border-green-500/20 rounded-lg px-3 py-2 mb-4">
          <Gift className="w-3.5 h-3.5" />
          <span>{benefit}</span>
        </div>
      </div>
      <div className="w-full space-y-2 text-xs text-surface-500 bg-surface-800/50 rounded-xl p-3">
        <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-blue-400" /><span>Your data is anonymised before sharing with other students</span></div>
        <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-blue-400" /><span>You can revoke consent at any time in Settings</span></div>
        <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-blue-400" /><span>Only you can see your real name; others see an alias</span></div>
      </div>
      <button onClick={() => onGrant(feature)} className="w-full py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-medium text-sm transition-colors">
        ✓ I agree — Enable {title}
      </button>
      <p className="text-[10px] text-surface-600">By enabling, you agree to EduGenius Community Guidelines</p>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NetworkEffects() {
  const [consent, setConsent] = useState<NetworkConsent>(loadConsent);
  const [tab, setTab] = useState<Tab>('overview');
  const [exam, setExam] = useState('JEE Main');
  const [copyDone, setCopyDone] = useState(false);
  const [joinedGroups, setJoinedGroups] = useState<Set<string>>(new Set());
  const [upvotedProblems, setUpvotedProblems] = useState<Set<string>>(new Set());
  const [showContribute, setShowContribute] = useState(false);
  const [showShareCard, setShowShareCard] = useState<ShareCard | null>(null);

  const metrics = useMemo(() => getNetworkMetrics(), []);
  const leaderboard = useMemo(() => getLeaderboard(exam), [exam]);
  const groups = useMemo(() => getStudyGroups(exam), [exam]);
  const problems = useMemo(() => getContributedProblems(exam), [exam]);
  const referral = useMemo(() => getReferralState('user123'), []);
  const cohortSignals = useMemo(() => getCohortSignals(exam), [exam]);

  const handleGrant = (feature: NetworkFeature) => {
    const updated = grantConsent(feature);
    setConsent(updated);
  };

  const handleRevoke = (feature: NetworkFeature) => {
    const updated = revokeConsent(feature);
    setConsent(updated);
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referral.referralLink).catch(() => {});
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  };

  const TABS: { id: Tab; icon: React.FC<{className?: string}>; label: string; locked?: NetworkFeature }[] = [
    { id: 'overview',     icon: Network,        label: 'Overview' },
    { id: 'leaderboard',  icon: Trophy,         label: 'Rankings',   locked: 'show_rank' },
    { id: 'groups',       icon: Users,          label: 'Study Groups', locked: 'join_group' },
    { id: 'problems',     icon: BookOpen,       label: 'Problem Bank', locked: 'contribute_problems' },
    { id: 'referral',     icon: Gift,           label: 'Referral',   locked: 'referral' },
    { id: 'share',        icon: Share2,         label: 'Share',      locked: 'content_sharing' },
    { id: 'insights',     icon: TrendingUp,     label: 'AI Insights' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌐</span>
          <div>
            <h1 className="text-xl font-bold text-white">Community & Network</h1>
            <p className="text-xs text-surface-400">
              {metrics.studentsOnlineNow} students online now · {metrics.totalActiveStudents.toLocaleString()} total · AI {Math.round((metrics.dataNetworkMultiplier - 1) * 100)}% smarter from collective data
            </p>
          </div>
        </div>
        {/* Exam filter */}
        <div className="flex gap-1.5 flex-wrap justify-end">
          {EXAM_LIST.map(e => (
            <button key={e} onClick={() => setExam(e)}
              className={clsx('px-2.5 py-1 text-xs rounded-lg', exam === e ? 'bg-primary-600 text-white' : 'bg-surface-700 text-surface-300 hover:bg-surface-600')}>
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-3 flex-shrink-0 bg-surface-800 rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => {
          const isLocked = t.locked && !consent[t.locked];
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={clsx('flex-shrink-0 flex items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-colors',
                tab === t.id ? 'bg-primary-600 text-white' : 'text-surface-400 hover:text-white')}>
              <t.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
              {isLocked && <Lock className="w-3 h-3 opacity-60" />}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="pb-6">

            {/* ── OVERVIEW ─────────────────────────────────────────────── */}
            {tab === 'overview' && (
              <div className="space-y-4">
                {/* Live metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Students Online', val: metrics.studentsOnlineNow, icon: Globe, color: 'text-green-400', sub: 'right now' },
                    { label: 'Community Size', val: metrics.totalActiveStudents.toLocaleString(), icon: Users, color: 'text-blue-400', sub: 'active learners' },
                    { label: 'Problems Shared', val: metrics.problemsSubmittedToday, icon: BookOpen, color: 'text-purple-400', sub: 'today' },
                    { label: 'AI Accuracy Boost', val: `+${Math.round((metrics.dataNetworkMultiplier - 1) * 100)}%`, icon: Zap, color: 'text-yellow-400', sub: 'from collective data' },
                  ].map(m => (
                    <div key={m.label} className="card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <m.icon className={clsx('w-4 h-4', m.color)} />
                        <span className="text-xs text-surface-400">{m.label}</span>
                      </div>
                      <div className={clsx('text-2xl font-bold', m.color)}>{m.val}</div>
                      <div className="text-xs text-surface-500 mt-0.5">{m.sub}</div>
                    </div>
                  ))}
                </div>

                {/* The 7 loops */}
                <div className="card p-4">
                  <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <Network className="w-4 h-4 text-primary-400" /> How the Network Makes You Smarter
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      {
                        icon: '🤖', title: 'Data Network Effect',
                        desc: 'Every problem you solve trains Sage to give better answers to everyone. Currently 34% more accurate than a solo AI.',
                        status: consent.data_network ? 'active' : 'off',
                        feature: 'data_network' as NetworkFeature,
                        tab: 'insights' as Tab,
                        requiresConsent: false,
                      },
                      {
                        icon: '🏆', title: 'Rankings & Leaderboard',
                        desc: 'See where you stand among all aspirants in your exam. Competing peers boost practice by 40%.',
                        status: consent.show_rank ? 'active' : 'locked',
                        feature: 'show_rank' as NetworkFeature,
                        tab: 'leaderboard' as Tab,
                        requiresConsent: true,
                      },
                      {
                        icon: '👥', title: 'Study Groups',
                        desc: 'Join topic-focused pods. Groups solve 2× more problems and have 28% higher exam scores.',
                        status: consent.join_group ? 'active' : 'locked',
                        feature: 'join_group' as NetworkFeature,
                        tab: 'groups' as Tab,
                        requiresConsent: true,
                      },
                      {
                        icon: '📚', title: 'Contributed Problem Bank',
                        desc: 'Real problems shared by toppers. Every contribution earns you XP and helps 1,000+ students.',
                        status: consent.contribute_problems ? 'active' : 'locked',
                        feature: 'contribute_problems' as NetworkFeature,
                        tab: 'problems' as Tab,
                        requiresConsent: true,
                      },
                      {
                        icon: '🎁', title: 'Refer & Earn',
                        desc: 'Invite friends studying the same exam — both get Premium. 5 referrals = Lifetime Pro.',
                        status: consent.referral ? 'active' : 'locked',
                        feature: 'referral' as NetworkFeature,
                        tab: 'referral' as Tab,
                        requiresConsent: true,
                      },
                      {
                        icon: '📱', title: 'Share Your Wins',
                        desc: 'Share streak cards and rank cards on WhatsApp/Instagram — each share brings new students.',
                        status: consent.content_sharing ? 'active' : 'locked',
                        feature: 'content_sharing' as NetworkFeature,
                        tab: 'share' as Tab,
                        requiresConsent: true,
                      },
                    ].map(loop => (
                      <div key={loop.title} className="flex gap-3 p-3 bg-surface-800/50 rounded-xl">
                        <span className="text-2xl flex-shrink-0">{loop.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-medium text-white">{loop.title}</span>
                            {loop.status === 'active' && <span className="text-[10px] px-1.5 py-0.5 bg-green-900/30 text-green-400 rounded-full">● Active</span>}
                            {loop.status === 'locked' && <span className="text-[10px] px-1.5 py-0.5 bg-surface-700 text-surface-400 rounded-full flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> Locked</span>}
                          </div>
                          <p className="text-xs text-surface-400 line-clamp-2">{loop.desc}</p>
                        </div>
                        <button onClick={() => setTab(loop.tab)}
                          className="flex-shrink-0 p-1.5 rounded-lg bg-primary-900/30 hover:bg-primary-800/30 text-primary-400">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data Privacy Banner */}
                <div className="card border border-blue-500/20 bg-blue-900/10 p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-blue-300 mb-1">Your Privacy is Protected</h3>
                      <p className="text-xs text-surface-400">All community features are opt-in. Your real name is never shown to other students without your explicit consent. Anonymised cohort data (aggregated, never individual) is always used to improve AI responses for everyone — this cannot be disabled as it doesn't expose personal data.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── LEADERBOARD ──────────────────────────────────────────── */}
            {tab === 'leaderboard' && (
              <ConsentGate
                feature="show_rank"
                title="Show My Rank"
                description="Join the leaderboard to see where you stand among all students preparing for the same exam. Studies show competitive visibility increases daily practice by 40%."
                icon={Trophy}
                benefit="Join now → unlock your rank badge + performance percentile"
                consent={consent}
                onGrant={handleGrant}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-yellow-400" /> {exam} Leaderboard
                    </h2>
                    <span className="text-xs text-surface-400">Updates every 30 min</span>
                  </div>

                  {/* Current user highlight */}
                  {leaderboard.filter(e => e.isCurrentUser).map(entry => (
                    <div key="you" className="card p-4 border border-primary-500/40 bg-primary-900/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold">#{entry.rank}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">You</span>
                            {entry.badge && <span className="text-xs px-2 py-0.5 bg-primary-800/50 text-primary-300 rounded-full">{entry.badge}</span>}
                          </div>
                          <div className="text-xs text-surface-400">Mastery: {entry.masteryScore}% · 🔥 {entry.streak} days · {entry.problemsSolved} problems</div>
                        </div>
                        <div className="text-right">
                          <div className="text-primary-400 text-sm font-medium">Top {Math.round((entry.rank / 1240) * 100)}%</div>
                          <div className="text-xs text-surface-500">{1240 - entry.rank} behind you</div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Top entries */}
                  <div className="card divide-y divide-surface-700/50">
                    {leaderboard.map((entry, i) => (
                      <div key={i} className={clsx('flex items-center gap-3 p-3', entry.isCurrentUser && 'bg-primary-900/10')}>
                        <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                          entry.rank === 1 ? 'bg-yellow-600 text-white' :
                          entry.rank === 2 ? 'bg-surface-400 text-black' :
                          entry.rank === 3 ? 'bg-orange-700 text-white' :
                          'bg-surface-700 text-surface-300')}>
                          {entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank - 1] : `${entry.rank}`}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={clsx('text-sm font-medium', entry.isCurrentUser ? 'text-primary-300' : 'text-white')}>{entry.displayName}</span>
                            {entry.badge && <span className="text-[10px] px-1.5 py-0.5 bg-surface-700 text-surface-400 rounded-full">{entry.badge}</span>}
                          </div>
                          <div className="text-xs text-surface-400">🔥 {entry.streak}d · {entry.problemsSolved} solved</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-semibold text-white">{entry.masteryScore}%</div>
                          <div className="text-xs text-surface-500">mastery</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-center">
                    <button onClick={() => handleRevoke('show_rank')} className="text-xs text-surface-500 hover:text-surface-300 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Opt out of leaderboard
                    </button>
                  </div>
                </div>
              </ConsentGate>
            )}

            {/* ── STUDY GROUPS ─────────────────────────────────────────── */}
            {tab === 'groups' && (
              <ConsentGate
                feature="join_group"
                title="Join Study Groups"
                description="Study with peers preparing for the same exam. Groups set weekly goals, share problems, and challenge each other. Students in groups score 28% higher on average."
                icon={Users}
                benefit="Join a group → unlock group chat, weekly challenges & peer rankings"
                consent={consent}
                onGrant={handleGrant}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" /> {exam} Study Groups
                    </h2>
                    <button className="btn text-xs px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Create Group
                    </button>
                  </div>

                  {groups.length === 0 ? (
                    <div className="card p-8 text-center text-surface-400">
                      <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p>No groups for {exam} yet. Create the first one!</p>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {groups.map(group => {
                        const isJoined = joinedGroups.has(group.id);
                        const progress = Math.round((group.weeklyProgress / group.weeklyGoal) * 100);
                        return (
                          <div key={group.id} className={clsx('card p-4 space-y-3', isJoined && 'border border-primary-500/40 bg-primary-900/10')}>
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-medium text-white text-sm">{group.name}</div>
                                <div className="text-xs text-surface-400 mt-0.5">{group.memberCount.toLocaleString()} members · {group.activeNow} online now</div>
                              </div>
                              {isJoined && <span className="text-[10px] px-2 py-0.5 bg-green-900/30 text-green-400 rounded-full">Joined</span>}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-primary-300 bg-primary-900/20 px-2.5 py-1.5 rounded-lg">
                              <Target className="w-3 h-3" />
                              <span>Studying: <strong>{group.topicFocus}</strong></span>
                            </div>

                            <div>
                              <div className="flex justify-between text-xs text-surface-400 mb-1">
                                <span>Weekly Goal: {group.weeklyGoal} problems</span>
                                <span className="text-white">{progress}%</span>
                              </div>
                              <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                                <div className={clsx('h-full rounded-full transition-all', progress >= 70 ? 'bg-green-500' : progress >= 40 ? 'bg-yellow-500' : 'bg-red-500')} style={{ width: `${progress}%` }} />
                              </div>
                            </div>

                            <button
                              onClick={() => setJoinedGroups(prev => { const n = new Set(prev); isJoined ? n.delete(group.id) : n.add(group.id); return n; })}
                              className={clsx('w-full py-2 rounded-xl text-sm font-medium transition-colors',
                                isJoined ? 'bg-surface-700 hover:bg-red-900/30 hover:text-red-400 text-surface-300' : 'bg-primary-600 hover:bg-primary-500 text-white')}>
                              {isJoined ? 'Leave Group' : 'Join Group'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </ConsentGate>
            )}

            {/* ── PROBLEM BANK ─────────────────────────────────────────── */}
            {tab === 'problems' && (
              <ConsentGate
                feature="contribute_problems"
                title="Community Problem Bank"
                description="Real problems shared by toppers and peers. Every problem you contribute earns you XP, shows your contributor badge, and helps hundreds of students."
                icon={BookOpen}
                benefit="Contribute 5 problems → earn ⭐ Contributor badge + 30 days Premium"
                consent={consent}
                onGrant={handleGrant}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-purple-400" /> Community Problems — {exam}
                    </h2>
                    <button onClick={() => setShowContribute(true)}
                      className="btn text-xs px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Contribute
                    </button>
                  </div>

                  {problems.length === 0 ? (
                    <div className="card p-8 text-center text-surface-400">
                      <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p>No community problems for {exam} yet.</p>
                      <button onClick={() => setShowContribute(true)} className="btn btn-primary mt-4 text-sm">+ Share First Problem</button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {problems.map(prob => (
                        <div key={prob.id} className="card p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium',
                                  prob.difficulty === 'hard' ? 'text-red-400 bg-red-900/20' :
                                  prob.difficulty === 'medium' ? 'text-yellow-400 bg-yellow-900/20' : 'text-green-400 bg-green-900/20')}>
                                  {prob.difficulty}
                                </span>
                                <span className="text-xs text-surface-400">{prob.subject} › {prob.chapter}</span>
                                {prob.verifiedByAI && <span className="text-xs text-green-400 bg-green-900/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Check className="w-2.5 h-2.5" /> AI Verified</span>}
                              </div>
                              <p className="text-sm text-white mb-2">{prob.question}</p>
                              {prob.options && (
                                <div className="grid grid-cols-2 gap-1 mb-2">
                                  {prob.options.map((opt, i) => (
                                    <div key={i} className={clsx('text-xs px-2 py-1.5 rounded-lg', i === prob.correctIndex ? 'bg-green-900/30 text-green-300 font-medium' : 'bg-surface-800 text-surface-400')}>
                                      {String.fromCharCode(65 + i)}. {opt}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="text-xs text-surface-400 bg-surface-800 rounded-lg p-2 mt-1">
                                <strong className="text-surface-300">Solution:</strong> {prob.solution}
                              </div>
                              <div className="flex items-center gap-3 mt-2">
                                <button
                                  onClick={() => setUpvotedProblems(prev => { const n = new Set(prev); n.has(prob.id) ? n.delete(prob.id) : n.add(prob.id); return n; })}
                                  className={clsx('flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors',
                                    upvotedProblems.has(prob.id) ? 'bg-blue-900/30 text-blue-400' : 'bg-surface-700 text-surface-400 hover:text-blue-400')}>
                                  <ThumbsUp className="w-3 h-3" />
                                  <span>{prob.upvotes + (upvotedProblems.has(prob.id) ? 1 : 0)}</span>
                                </button>
                                <span className="text-xs text-surface-500">by {prob.contributorAlias}</span>
                                <div className="flex gap-1 flex-wrap">
                                  {prob.tags.map(tag => <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-surface-700 text-surface-500 rounded">{tag}</span>)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Contribute Modal */}
                  <AnimatePresence>
                    {showContribute && (
                      <ContributeProblemModal exam={exam} onClose={() => setShowContribute(false)} />
                    )}
                  </AnimatePresence>
                </div>
              </ConsentGate>
            )}

            {/* ── REFERRAL ─────────────────────────────────────────────── */}
            {tab === 'referral' && (
              <ConsentGate
                feature="referral"
                title="Refer & Earn Program"
                description="Invite friends studying the same exam. For every friend who joins and studies for 7 days, you both get 7 days of Premium. 5 referrals = Lifetime Pro."
                icon={Gift}
                benefit="First referral → 7 days Premium for you AND your friend"
                consent={consent}
                onGrant={handleGrant}
              >
                <div className="space-y-4">
                  {/* Stats strip */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Successful', val: referral.successfulReferrals, color: 'text-green-400' },
                      { label: 'Pending', val: referral.pendingReferrals, color: 'text-yellow-400' },
                      { label: 'Reward Earned', val: referral.rewardEarned, color: 'text-purple-400' },
                    ].map(s => (
                      <div key={s.label} className="card p-3 text-center">
                        <div className={clsx('text-lg font-bold', s.color)}>{s.val}</div>
                        <div className="text-xs text-surface-400 mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Referral link */}
                  <div className="card p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-white">Your Referral Link</h3>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-surface-800 border border-surface-700 rounded-xl px-3 py-2.5 text-sm text-surface-300 truncate font-mono">
                        {referral.referralLink}
                      </div>
                      <button onClick={copyReferralLink} className={clsx('px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2', copyDone ? 'bg-green-600 text-white' : 'bg-primary-600 hover:bg-primary-500 text-white')}>
                        {copyDone ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
                      </button>
                    </div>
                    <div className="text-xs text-surface-500 text-center">Code: <span className="font-mono text-primary-400 font-bold">{referral.referralCode}</span></div>

                    {/* Share buttons */}
                    <div className="flex gap-2">
                      {[
                        { label: '📱 WhatsApp', color: 'bg-green-700 hover:bg-green-600', msg: `Hey! I'm using EduGenius AI to prep for ${exam}. Join with my link and we both get Premium: ${referral.referralLink}` },
                        { label: '✈️ Telegram', color: 'bg-blue-700 hover:bg-blue-600', msg: `Join EduGenius ${exam} prep: ${referral.referralLink}` },
                      ].map(s => (
                        <button key={s.label} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(s.msg)}`, '_blank')}
                          className={clsx('flex-1 py-2 rounded-xl text-xs font-medium text-white transition-colors', s.color)}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Milestones */}
                  <div className="card p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Referral Milestones</h3>
                    <div className="space-y-3">
                      {referral.milestones.map((m, i) => (
                        <div key={i} className={clsx('flex items-center gap-3 p-3 rounded-xl border', m.achieved ? 'border-green-500/30 bg-green-900/10' : 'border-surface-700 bg-surface-800/50')}>
                          <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                            m.achieved ? 'bg-green-600 text-white' : 'bg-surface-700 text-surface-400')}>
                            {m.achieved ? '✓' : m.count}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm text-white">{m.count} friend{m.count > 1 ? 's' : ''} join</div>
                            <div className={clsx('text-xs', m.achieved ? 'text-green-400' : 'text-surface-400')}>{m.reward}</div>
                          </div>
                          {m.achieved && <span className="text-xs text-green-400 bg-green-900/20 px-2 py-0.5 rounded-full">Claimed!</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ConsentGate>
            )}

            {/* ── SHARE CARDS ──────────────────────────────────────────── */}
            {tab === 'share' && (
              <ConsentGate
                feature="content_sharing"
                title="Share Your Progress"
                description="Create beautiful share cards for your streak, rank, or a problem you solved. Each card brings new students to EduGenius — and your streak inspires friends to study."
                icon={Share2}
                benefit="Share your first card → unlock ⭐ Social Champion badge"
                consent={consent}
                onGrant={handleGrant}
              >
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-pink-400" /> Create Share Card
                  </h2>

                  <div className="grid sm:grid-cols-2 gap-3">
                    {([
                      { type: 'streak' as const, label: '🔥 Streak Card', data: { exam, streak: 7 } },
                      { type: 'rank' as const, label: '🏆 Rank Card', data: { exam, rank: 12 } },
                      { type: 'mastery' as const, label: '✅ Mastery Card', data: { exam, mastery: 85, topic: 'Integration' } },
                      { type: 'problem_solved' as const, label: '🧠 Problem Card', data: { exam, topic: 'Named Reactions' } },
                    ]).map(card => {
                      const generated = generateShareCard(card.type, card.data);
                      return (
                        <div key={card.type} className="card overflow-hidden cursor-pointer hover:ring-1 hover:ring-primary-500/40 transition-all"
                          onClick={() => setShowShareCard(generated)}>
                          {/* Card preview */}
                          <div className={clsx('p-6 bg-gradient-to-br', generated.bgGradient)}>
                            <div className="text-white">
                              <div className="text-xl font-bold mb-1">{generated.headline}</div>
                              <div className="text-sm opacity-80">{generated.subline}</div>
                              <div className="text-4xl font-black mt-3 opacity-90">{generated.stat}</div>
                            </div>
                          </div>
                          <div className="p-3 flex items-center justify-between">
                            <span className="text-sm text-surface-300">{card.label}</span>
                            <button className="text-xs px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg flex items-center gap-1">
                              <Share2 className="w-3 h-3" /> Share
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Share Card Modal */}
                <AnimatePresence>
                  {showShareCard && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                        className="card w-full max-w-sm overflow-hidden">
                        <div className={clsx('p-8 bg-gradient-to-br', showShareCard.bgGradient)}>
                          <div className="text-white text-center">
                            <div className="text-2xl font-bold mb-2">{showShareCard.headline}</div>
                            <div className="text-sm opacity-80">{showShareCard.subline}</div>
                            <div className="text-5xl font-black mt-4 opacity-90">{showShareCard.stat}</div>
                            <div className="text-xs mt-4 opacity-70">EduGenius · {showShareCard.exam}</div>
                          </div>
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="flex gap-2">
                            <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(showShareCard.headline + ' ' + showShareCard.deepLink)}`, '_blank')}
                              className="flex-1 py-2 bg-green-700 hover:bg-green-600 text-white rounded-xl text-sm font-medium">📱 WhatsApp</button>
                            <button onClick={() => navigator.clipboard.writeText(showShareCard.deepLink)}
                              className="flex-1 py-2 bg-surface-700 hover:bg-surface-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1">
                              <Copy className="w-3.5 h-3.5" /> Copy Link
                            </button>
                          </div>
                          <button onClick={() => setShowShareCard(null)} className="w-full py-2 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-xl text-sm">Close</button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </ConsentGate>
            )}

            {/* ── AI INSIGHTS ──────────────────────────────────────────── */}
            {tab === 'insights' && (
              <div className="space-y-4">
                <div className="card border border-green-500/20 bg-green-900/10 p-4">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-green-300 mb-1">Data Network Effect — Always On</h3>
                      <p className="text-xs text-surface-400">
                        Every student's anonymised practice data trains Sage to give better answers. {metrics.totalActiveStudents.toLocaleString()} students have made Sage <strong className="text-green-400">{Math.round((metrics.dataNetworkMultiplier - 1) * 100)}% more accurate</strong> than a standalone AI. No personal data is ever exposed.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-primary-400" /> Where Your Cohort is Struggling — {exam}
                  </h2>
                  <div className="space-y-3">
                    {cohortSignals.map(signal => (
                      <div key={signal.topicId} className="card p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <div className="text-sm font-medium text-white">{signal.topicName}</div>
                            <div className="text-xs text-surface-400">{signal.studentsStruggling} students struggling</div>
                          </div>
                          <div className="text-right">
                            <div className={clsx('text-lg font-bold', signal.avgMastery >= 60 ? 'text-green-400' : signal.avgMastery >= 40 ? 'text-yellow-400' : 'text-red-400')}>{signal.avgMastery}%</div>
                            <div className="text-xs text-surface-500">avg mastery</div>
                          </div>
                        </div>
                        <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden mb-3">
                          <div className={clsx('h-full rounded-full', signal.avgMastery >= 60 ? 'bg-green-500' : signal.avgMastery >= 40 ? 'bg-yellow-500' : 'bg-red-500')} style={{ width: `${signal.avgMastery}%` }} />
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-start gap-2 bg-orange-900/10 border border-orange-500/20 rounded-lg px-2.5 py-1.5">
                            <span className="text-orange-400 flex-shrink-0">⚠</span>
                            <span className="text-surface-300"><strong className="text-orange-300">Common mistake:</strong> {signal.commonMistakePattern}</span>
                          </div>
                          <div className="flex items-start gap-2 bg-blue-900/10 border border-blue-500/20 rounded-lg px-2.5 py-1.5">
                            <span className="text-blue-400 flex-shrink-0">❓</span>
                            <span className="text-surface-300"><strong className="text-blue-300">Most asked:</strong> {signal.mostAskedQuestion}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary-400" /> How Data Network Grows Over Time
                  </h3>
                  <div className="space-y-2">
                    {[
                      { students: 100, accuracy: '+5%', desc: 'Baseline — limited data' },
                      { students: 500, accuracy: '+18%', desc: 'Common mistake patterns detected' },
                      { students: 1240, accuracy: '+34%', desc: 'Current — deep cohort insights' },
                      { students: 5000, accuracy: '+55%', desc: 'Target — predictive error prevention' },
                      { students: 20000, accuracy: '+80%', desc: 'Vision — exam-specific AI fine-tune' },
                    ].map((row, i) => (
                      <div key={i} className={clsx('flex items-center gap-3 p-2.5 rounded-lg', row.students <= 1240 ? 'bg-primary-900/20 border border-primary-500/20' : 'bg-surface-800/50')}>
                        <div className="text-sm font-mono text-surface-400 w-16 flex-shrink-0">{row.students.toLocaleString()}</div>
                        <div className={clsx('text-sm font-bold w-12 flex-shrink-0', row.students <= 1240 ? 'text-green-400' : 'text-surface-500')}>{row.accuracy}</div>
                        <div className="text-xs text-surface-400">{row.desc}</div>
                        {row.students === 1240 && <span className="text-[10px] px-1.5 py-0.5 bg-green-900/30 text-green-400 rounded-full flex-shrink-0">You are here</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Contribute Problem Modal ─────────────────────────────────────────────────

function ContributeProblemModal({ exam, onClose }: { exam: string; onClose: () => void }) {
  const [question, setQuestion] = useState('');
  const [solution, setSolution] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [tags, setTags] = useState('');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        className="card w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Contribute a Problem</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-700 text-surface-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="text-xs text-surface-400 bg-surface-800/50 rounded-xl p-3">
          Your contribution will be AI-verified before going live. You'll be credited as an anonymised alias (e.g. "Physics Ace #447"). Real name is never shown.
        </div>

        <div>
          <label className="text-xs text-surface-400 mb-1 block">Topic / Chapter</label>
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Integration by Parts — Calculus"
            className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-400 focus:outline-none focus:border-primary-500" />
        </div>
        <div>
          <label className="text-xs text-surface-400 mb-1 block">Question *</label>
          <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={3} placeholder="Type the question clearly..."
            className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-400 focus:outline-none focus:border-primary-500 resize-none" />
        </div>
        <div>
          <label className="text-xs text-surface-400 mb-1 block">Solution / Explanation *</label>
          <textarea value={solution} onChange={e => setSolution(e.target.value)} rows={3} placeholder="Step-by-step solution..."
            className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-400 focus:outline-none focus:border-primary-500 resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Difficulty</label>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
              {['easy','medium','hard'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Tags</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="comma-separated"
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-400 focus:outline-none focus:border-primary-500" />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2 bg-surface-700 hover:bg-surface-600 text-white rounded-xl text-sm">Cancel</button>
          <button disabled={!question.trim() || !solution.trim()}
            onClick={() => { alert('Submitted for AI verification! You\'ll earn XP once it goes live.'); onClose(); }}
            className="flex-1 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium">Submit for Review</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

