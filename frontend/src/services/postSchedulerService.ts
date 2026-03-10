/**
 * postSchedulerService.ts — Optimal Timing + Rate Limiting + Multi-Channel Scheduling
 *
 * Schedules approved content at platform-optimal times for Indian audience (IST).
 * Enforces per-platform daily rate limits to avoid spam signals.
 *
 * OPTIMAL TIMING by platform (IST):
 * - Reddit r/GATE: 9am-11am, 8pm-10pm (study breaks)
 * - Quora: 7pm-9pm (evening research)
 * - X/Twitter: 8am, 1pm, 9pm
 * - YouTube: within 1h of video comment
 * - Telegram: 10am, 4pm, 9pm
 * - WhatsApp: 10am, 7pm
 *
 * Storage keys: `edugenius_social_schedule_*`
 */

import type { SocialPlatform } from './socialIntentScoutService';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PostStatus = 'queued' | 'posted' | 'failed' | 'cancelled';

export interface ScheduledPost {
  id: string;
  answerId: string;
  platform: SocialPlatform;
  content: string;
  scheduledFor: number;
  status: PostStatus;
  postedAt?: number;
  url?: string;
}

// ─── Rate Limits ──────────────────────────────────────────────────────────────

interface PlatformLimit {
  daily: number;
  minIntervalMs: number; // minimum ms between posts on same platform
}

const RATE_LIMITS: Record<SocialPlatform, PlatformLimit> = {
  reddit: { daily: 5, minIntervalMs: 7200000 },        // 5/day, 2h apart
  quora: { daily: 3, minIntervalMs: 10800000 },         // 3/day, 3h apart
  x_twitter: { daily: 10, minIntervalMs: 1800000 },     // 10/day, 30min apart
  youtube_comments: { daily: 15, minIntervalMs: 900000 }, // 15/day, 15min apart
  google_paa: { daily: 0, minIntervalMs: 0 },           // read-only, no posting
  telegram_group: { daily: 20, minIntervalMs: 1200000 }, // 20/day, 20min apart
  whatsapp_group: { daily: 10, minIntervalMs: 3600000 }, // 10/day, 1h apart
};

// ─── Optimal Posting Windows (IST offset from midnight) ───────────────────────

// IST = UTC+5:30 (19800000ms offset)
const IST_OFFSET_MS = 19800000;

interface TimeWindow {
  startHour: number; // IST hour
  endHour: number;
}

const OPTIMAL_WINDOWS: Record<SocialPlatform, TimeWindow[]> = {
  reddit: [
    { startHour: 9, endHour: 11 },
    { startHour: 20, endHour: 22 },
  ],
  quora: [
    { startHour: 19, endHour: 21 },
  ],
  x_twitter: [
    { startHour: 8, endHour: 9 },
    { startHour: 13, endHour: 14 },
    { startHour: 21, endHour: 22 },
  ],
  youtube_comments: [
    { startHour: 10, endHour: 22 }, // wide window — recency matters most
  ],
  google_paa: [
    { startHour: 9, endHour: 18 }, // not used for posting
  ],
  telegram_group: [
    { startHour: 10, endHour: 11 },
    { startHour: 16, endHour: 17 },
    { startHour: 21, endHour: 22 },
  ],
  whatsapp_group: [
    { startHour: 10, endHour: 11 },
    { startHour: 19, endHour: 20 },
  ],
};

// ─── Storage Keys ──────────────────────────────────────────────────────────────

const SCHEDULE_KEY = 'edugenius_social_schedule';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSchedule(): ScheduledPost[] {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSchedule(posts: ScheduledPost[]): void {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(posts));
}

function getTodayStartMs(): number {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  istNow.setHours(0, 0, 0, 0);
  return istNow.getTime() - IST_OFFSET_MS;
}

/**
 * Get today's post count for a platform.
 */
function getTodayCount(platform: SocialPlatform): number {
  const todayStart = getTodayStartMs();
  return getSchedule().filter(
    p => p.platform === platform &&
      p.scheduledFor >= todayStart &&
      p.status !== 'cancelled'
  ).length;
}

/**
 * Get timestamp of last post for a platform.
 */
function getLastPostTime(platform: SocialPlatform): number {
  const posts = getSchedule()
    .filter(p => p.platform === platform && p.status !== 'cancelled')
    .sort((a, b) => b.scheduledFor - a.scheduledFor);
  return posts.length > 0 ? posts[0].scheduledFor : 0;
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Get next optimal posting time for a platform, respecting rate limits.
 */
export function getOptimalTime(platform: SocialPlatform, preferredTime?: Date): Date {
  const limit = RATE_LIMITS[platform];
  const windows = OPTIMAL_WINDOWS[platform];
  const lastPost = getLastPostTime(platform);
  const now = Date.now();

  // Start from preferred time or now + min interval (whichever is later)
  const earliestPossible = Math.max(
    preferredTime?.getTime() || now,
    lastPost + limit.minIntervalMs,
    now + 60000 // at least 1 minute from now
  );

  // Find next optimal window from earliestPossible
  const base = new Date(earliestPossible);
  const istBase = new Date(base.getTime() + IST_OFFSET_MS);
  const currentHour = istBase.getHours();

  // Check today's remaining windows
  for (const window of windows) {
    if (window.startHour > currentHour) {
      // Window is today, in the future
      const windowStart = new Date(istBase);
      windowStart.setHours(window.startHour, 0, 0, 0);
      const utcWindowStart = new Date(windowStart.getTime() - IST_OFFSET_MS);
      if (utcWindowStart.getTime() >= earliestPossible) {
        return utcWindowStart;
      }
    }
  }

  // No window today — go to tomorrow's first window
  const tomorrow = new Date(istBase);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const firstWindow = windows[0] || { startHour: 10, endHour: 11 };
  tomorrow.setHours(firstWindow.startHour, 0, 0, 0);
  return new Date(tomorrow.getTime() - IST_OFFSET_MS);
}

/**
 * Schedule a post for the given platform.
 * Returns null if daily quota exceeded.
 */
export function schedulePost(
  answerId: string,
  platform: SocialPlatform,
  content: string,
  preferredTime?: Date,
): ScheduledPost | null {
  // Check daily quota
  const limit = RATE_LIMITS[platform];
  if (limit.daily > 0 && getTodayCount(platform) >= limit.daily) {
    // Over daily limit — schedule for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const firstWindow = OPTIMAL_WINDOWS[platform][0] || { startHour: 10, endHour: 11 };
    const tomorrowIST = new Date(tomorrow.getTime() + IST_OFFSET_MS);
    tomorrowIST.setHours(firstWindow.startHour, 0, 0, 0);
    const tomorrowUTC = new Date(tomorrowIST.getTime() - IST_OFFSET_MS);
    preferredTime = tomorrowUTC;
  }

  const optimalTime = getOptimalTime(platform, preferredTime);

  const post: ScheduledPost = {
    id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    answerId,
    platform,
    content,
    scheduledFor: optimalTime.getTime(),
    status: 'queued',
  };

  const all = getSchedule();
  all.push(post);
  saveSchedule(all);

  // Emit signal
  localStorage.setItem('social:posts_scheduled', JSON.stringify({
    ts: Date.now(),
    postId: post.id,
    platform,
    scheduledFor: post.scheduledFor,
  }));

  return post;
}

export function getScheduledPosts(): ScheduledPost[] {
  return getSchedule();
}

export function cancelPost(id: string): void {
  const all = getSchedule();
  const post = all.find(p => p.id === id);
  if (post && post.status === 'queued') {
    post.status = 'cancelled';
    saveSchedule(all);
  }
}

export function reschedulePost(id: string, newTime: Date): void {
  const all = getSchedule();
  const post = all.find(p => p.id === id);
  if (post && post.status === 'queued') {
    post.scheduledFor = newTime.getTime();
    saveSchedule(all);
  }
}

export function getDailyLimit(platform: SocialPlatform): number {
  return RATE_LIMITS[platform].daily;
}

export function getRemainingQuota(platform: SocialPlatform): number {
  const limit = RATE_LIMITS[platform].daily;
  if (limit === 0) return 0;
  return Math.max(0, limit - getTodayCount(platform));
}

/**
 * Simulate posting a scheduled item.
 * API-hook: Replace with real platform API calls in production.
 */
export function simulatePost(post: ScheduledPost): { success: boolean; url: string } {
  const all = getSchedule();
  const item = all.find(p => p.id === post.id);

  const success = Math.random() > 0.05; // 95% success rate in simulation

  if (item) {
    item.status = success ? 'posted' : 'failed';
    item.postedAt = Date.now();
    if (success) {
      item.url = generateSimulatedUrl(post.platform);
    }
    saveSchedule(all);
  }

  localStorage.setItem('social:performance', JSON.stringify({
    ts: Date.now(),
    postId: post.id,
    platform: post.platform,
    success,
    url: item?.url,
  }));

  return { success, url: item?.url || '' };
}

function generateSimulatedUrl(platform: SocialPlatform): string {
  const id = Math.random().toString(36).slice(2, 10);
  const baseUrls: Record<SocialPlatform, string> = {
    reddit: `https://reddit.com/r/GATE/comments/${id}`,
    quora: `https://quora.com/answer/${id}`,
    x_twitter: `https://x.com/EduGenius/status/${id}`,
    youtube_comments: `https://youtube.com/watch?v=${id}&lc=comment_id`,
    google_paa: `https://google.com/search?q=gate+prep`,
    telegram_group: `https://t.me/EduGenius/${id}`,
    whatsapp_group: `https://wa.me/group/${id}`,
  };
  return baseUrls[platform];
}

/**
 * Get posts grouped by day for timeline view.
 */
export function getPostsByDay(): Record<string, ScheduledPost[]> {
  const posts = getSchedule().filter(p => p.status !== 'cancelled');
  const grouped: Record<string, ScheduledPost[]> = {};

  for (const post of posts) {
    const date = new Date(post.scheduledFor + IST_OFFSET_MS);
    const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (!grouped[dayKey]) grouped[dayKey] = [];
    grouped[dayKey].push(post);
  }

  return grouped;
}

/**
 * Get per-platform quota status.
 */
export function getPlatformQuotas(): Record<SocialPlatform, { used: number; total: number; remaining: number }> {
  const platforms: SocialPlatform[] = ['reddit', 'quora', 'x_twitter', 'youtube_comments', 'telegram_group', 'whatsapp_group', 'google_paa'];
  const result = {} as Record<SocialPlatform, { used: number; total: number; remaining: number }>;

  for (const platform of platforms) {
    const total = RATE_LIMITS[platform].daily;
    const used = getTodayCount(platform);
    result[platform] = {
      used,
      total,
      remaining: Math.max(0, total - used),
    };
  }

  return result;
}

export function clearSchedule(): void {
  localStorage.removeItem(SCHEDULE_KEY);
}
