/**
 * gamificationService.ts — XP, levels, streaks, badges, leaderboard
 * All data stored in localStorage. No API calls = no rate limits.
 * CEO/Admin can disable via appStore.gamificationEnabled.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type PlayerRank = 'Novice' | 'Explorer' | 'Scholar' | 'Expert' | 'Master' | 'Legend';

export interface GamificationBadge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  earnedAt: string; // ISO string
  rarity: BadgeRarity;
}

export interface PlayerProfile {
  level: number;
  xp: number;
  xpToNextLevel: number;
  streak: number;
  longestStreak: number;
  gems: number;
  rank: PlayerRank;
  badges: GamificationBadge[];
  weeklyXP: number;
  weekStart: string; // ISO date string
  totalQuestions: number;
  correctAnswers: number;
  lastActive: string; // date string
}

export type XPEventType =
  | 'question_correct'
  | 'streak_bonus'
  | 'topic_complete'
  | 'daily_goal'
  | 'peer_helped'
  | 'exam_complete'
  | 'brief_answered'
  | 'sr_review';

export interface XPEvent {
  type: XPEventType;
  multiplier?: number;
}

export interface XPAwardResult {
  profile: PlayerProfile;
  earned: number;
  levelUp: boolean;
  newBadges: GamificationBadge[];
}

export interface LeaderboardEntry {
  name: string;
  xp: number;
  level: number;
  rank: PlayerRank;
  streak: number;
  isYou?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const XP_TABLE: Record<XPEventType, number> = {
  question_correct: 10,
  streak_bonus: 25,
  topic_complete: 100,
  daily_goal: 50,
  peer_helped: 30,
  exam_complete: 200,
  brief_answered: 20,
  sr_review: 15,
};

// XP thresholds for each level (level = index + 1)
const LEVEL_THRESHOLDS = [
  0,      // Level 1
  100,    // Level 2
  250,    // Level 3
  500,    // Level 4
  1000,   // Level 5
  2000,   // Level 6
  4000,   // Level 7
  8000,   // Level 8
  15000,  // Level 9
  30000,  // Level 10
];

const STORAGE_KEY = 'eg_gamification_profile';
const LAST_ACTIVE_KEY = 'eg_last_active_date';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLevelFromXP(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

function getXPToNextLevel(xp: number, level: number): number {
  const nextThreshold = LEVEL_THRESHOLDS[level]; // level is 1-indexed, array is 0-indexed
  return nextThreshold !== undefined ? nextThreshold - xp : 0;
}

function getRank(level: number): PlayerRank {
  if (level < 3) return 'Novice';
  if (level < 5) return 'Explorer';
  if (level < 7) return 'Scholar';
  if (level < 9) return 'Expert';
  if (level < 10) return 'Master';
  return 'Legend';
}

function getWeekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toDateString();
}

function checkBadges(profile: PlayerProfile): GamificationBadge[] {
  const newBadges: GamificationBadge[] = [];
  const has = (id: string) => profile.badges.some(b => b.id === id);
  const now = new Date().toISOString();

  if (profile.streak >= 3 && !has('streak_3'))
    newBadges.push({ id: 'streak_3', name: 'On Fire', emoji: '🔥', description: '3-day streak!', earnedAt: now, rarity: 'common' });
  if (profile.streak >= 7 && !has('streak_7'))
    newBadges.push({ id: 'streak_7', name: 'Week Warrior', emoji: '⚔️', description: '7-day streak!', earnedAt: now, rarity: 'rare' });
  if (profile.streak >= 30 && !has('streak_30'))
    newBadges.push({ id: 'streak_30', name: 'Iron Will', emoji: '🏆', description: '30-day streak!', earnedAt: now, rarity: 'legendary' });
  if (profile.level >= 3 && !has('level_3'))
    newBadges.push({ id: 'level_3', name: 'Explorer', emoji: '🗺️', description: 'Reached Level 3', earnedAt: now, rarity: 'common' });
  if (profile.level >= 5 && !has('level_5'))
    newBadges.push({ id: 'level_5', name: 'Scholar', emoji: '🎓', description: 'Reached Scholar rank', earnedAt: now, rarity: 'rare' });
  if (profile.level >= 8 && !has('level_8'))
    newBadges.push({ id: 'level_8', name: 'Expert', emoji: '⭐', description: 'Reached Expert rank', earnedAt: now, rarity: 'epic' });
  if (profile.correctAnswers >= 100 && !has('century'))
    newBadges.push({ id: 'century', name: 'Century', emoji: '💯', description: '100 correct answers!', earnedAt: now, rarity: 'rare' });
  if (profile.gems >= 500 && !has('gem_500'))
    newBadges.push({ id: 'gem_500', name: 'Gem Collector', emoji: '💎', description: 'Collected 500 gems', earnedAt: now, rarity: 'epic' });

  return newBadges;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PlayerProfile;
  } catch { /* fall through */ }
  return {
    level: 1, xp: 0, xpToNextLevel: 100,
    streak: 0, longestStreak: 0, gems: 0, rank: 'Novice',
    badges: [], weeklyXP: 0, weekStart: getWeekStart(),
    totalQuestions: 0, correctAnswers: 0, lastActive: '',
  };
}

export function saveProfile(profile: PlayerProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

/** Call this on every correct answer / event. Returns result with levelUp flag. */
export function awardXP(event: XPEvent): XPAwardResult {
  const profile = loadProfile();
  const base = XP_TABLE[event.type] ?? 10;
  const earned = Math.round(base * (event.multiplier ?? 1));
  const oldLevel = profile.level;

  // Reset weekly XP if new week
  const currentWeekStart = getWeekStart();
  if (profile.weekStart !== currentWeekStart) {
    profile.weeklyXP = 0;
    profile.weekStart = currentWeekStart;
  }

  profile.xp += earned;
  profile.weeklyXP += earned;
  profile.gems += Math.floor(earned / 10);

  if (event.type === 'question_correct') profile.correctAnswers += 1;

  const newLevel = getLevelFromXP(profile.xp);
  profile.level = newLevel;
  profile.rank = getRank(newLevel);
  profile.xpToNextLevel = getXPToNextLevel(profile.xp, newLevel);

  const newBadges = checkBadges(profile);
  profile.badges = [...profile.badges, ...newBadges];

  saveProfile(profile);
  return { profile, earned, levelUp: newLevel > oldLevel, newBadges };
}

/** Call once per day when student completes any activity */
export function updateStreak(): PlayerProfile {
  const profile = loadProfile();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (profile.lastActive === today) return profile;

  if (profile.lastActive === yesterday) {
    profile.streak += 1;
  } else {
    profile.streak = 1;
  }
  profile.longestStreak = Math.max(profile.streak, profile.longestStreak);
  profile.lastActive = today;
  localStorage.setItem(LAST_ACTIVE_KEY, today);
  saveProfile(profile);
  return profile;
}

/** XP progress within current level as 0-100 percentage */
export function getLevelProgress(profile: PlayerProfile): number {
  const levelIdx = profile.level - 1;
  const levelStart = LEVEL_THRESHOLDS[levelIdx] ?? 0;
  const levelEnd = LEVEL_THRESHOLDS[levelIdx + 1];
  if (!levelEnd) return 100;
  const range = levelEnd - levelStart;
  const progress = profile.xp - levelStart;
  return Math.min(100, Math.round((progress / range) * 100));
}

/** Mock leaderboard — in production, replace with API call */
export function getLeaderboard(): LeaderboardEntry[] {
  const me = loadProfile();
  const entries: LeaderboardEntry[] = [
    { name: 'Arjun K.', xp: 4820, level: 8, rank: 'Master', streak: 14 },
    { name: 'Priya S.', xp: 3950, level: 7, rank: 'Expert', streak: 21 },
    { name: 'Rohan M.', xp: 3200, level: 6, rank: 'Expert', streak: 7 },
    { name: 'Ananya T.', xp: 2800, level: 6, rank: 'Expert', streak: 5 },
    { name: 'Vikram R.', xp: 2100, level: 5, rank: 'Scholar', streak: 3 },
    { name: 'Deepa L.', xp: 1500, level: 4, rank: 'Explorer', streak: 8 },
    { name: 'Kiran P.', xp: 950, level: 3, rank: 'Explorer', streak: 2 },
    { name: 'You', xp: me.xp, level: me.level, rank: me.rank, streak: me.streak, isYou: true },
  ];
  return entries.sort((a, b) => b.xp - a.xp);
}

export function getWeeklyLeaderboard(): LeaderboardEntry[] {
  const me = loadProfile();
  const entries: LeaderboardEntry[] = [
    { name: 'Priya S.', xp: 820, level: 7, rank: 'Expert', streak: 21 },
    { name: 'Arjun K.', xp: 650, level: 8, rank: 'Master', streak: 14 },
    { name: 'Kiran P.', xp: 480, level: 3, rank: 'Explorer', streak: 2 },
    { name: 'Deepa L.', xp: 310, level: 4, rank: 'Explorer', streak: 8 },
    { name: 'You', xp: me.weeklyXP, level: me.level, rank: me.rank, streak: me.streak, isYou: true },
  ];
  return entries.sort((a, b) => b.xp - a.xp);
}
