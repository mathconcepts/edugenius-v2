/**
 * userService.ts — EduGenius User Identity & Subscription Service
 *
 * Every user gets a canonical EG-XXXXXX UID across all channels.
 * Manages exam subscriptions, channel access, and MCP privileges.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'student' | 'teacher' | 'parent' | 'manager' | 'admin' | 'owner';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';
export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise';

export interface EGUser {
  uid: string;                     // EG-A1B2C3 — canonical cross-channel ID
  name: string;
  email?: string;
  phone?: string;                  // E.164 format e.g. +919876543210
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastActiveAt: string;
  examSubscriptions: ExamSubscription[];
  channelAccess: ChannelAccess;
  mcpPrivileges: MCPPrivileges;
  authMethods: AuthMethod[];
  preferences: UserPreferences;
}

export interface ExamSubscription {
  examId: string;
  examName: string;
  plan: PlanTier;
  status: 'active' | 'expired' | 'trial';
  startedAt: string;
  expiresAt?: string;
  features: ExamFeatures;
}

export interface ExamFeatures {
  chatEnabled: boolean;
  practiceEnabled: boolean;
  wolframVerification: boolean;
  mcpEnabled: boolean;
  ragEnabled: boolean;
  practiceLimit: number | null;
  aiExplanations: boolean;
  downloadContent: boolean;
}

export interface ChannelAccess {
  web: boolean;
  whatsapp: boolean;
  telegram: boolean;
  widget: boolean;
  whatsappPhone?: string;
  telegramChatId?: string;
  telegramUsername?: string;
  widgetToken?: string;
}

export interface MCPPrivileges {
  allowedSources: string[];
  wolframEnabled: boolean;
  customMcpEnabled: boolean;
  externalApiEnabled: boolean;
  ragEnabled: boolean;
  maxKnowledgeSources: number;
}

export interface AuthMethod {
  type: 'email_otp' | 'magic_link' | 'passkey' | 'whatsapp_otp' | 'telegram_bot' | 'telegram_token' | 'google';
  identifier: string;
  linkedAt: string;
  lastUsedAt?: string;
}

export interface UserPreferences {
  language: string;
  preferredChannel: 'web' | 'whatsapp' | 'telegram' | 'widget';
  notificationsEnabled: boolean;
  studyReminderTime?: string;
  preferredExamId?: string;
  // Parent-specific
  childExamIds?: string[];    // exams their children are preparing for
}

// ─── Plan → MCP Privilege Mapping ────────────────────────────────────────────

const PLAN_MCP_MAP: Record<PlanTier, MCPPrivileges> = {
  free: {
    wolframEnabled: false,
    customMcpEnabled: false,
    externalApiEnabled: false,
    ragEnabled: false,
    maxKnowledgeSources: 1,
    allowedSources: ['static-pyq-bundle', 'llm-fallback'],
  },
  starter: {
    wolframEnabled: false,
    customMcpEnabled: false,
    externalApiEnabled: false,
    ragEnabled: true,
    maxKnowledgeSources: 2,
    allowedSources: ['static-pyq-bundle', 'rag-supabase-primary', 'llm-fallback'],
  },
  pro: {
    wolframEnabled: true,
    customMcpEnabled: false,
    externalApiEnabled: true,
    ragEnabled: true,
    maxKnowledgeSources: 4,
    allowedSources: ['wolfram-api-primary', 'static-pyq-bundle', 'rag-supabase-primary', 'llm-fallback'],
  },
  enterprise: {
    wolframEnabled: true,
    customMcpEnabled: true,
    externalApiEnabled: true,
    ragEnabled: true,
    maxKnowledgeSources: 99,
    allowedSources: [], // empty = all sources
  },
};

// ─── Exam Features by Plan ────────────────────────────────────────────────────

function getExamFeatures(plan: PlanTier): ExamFeatures {
  switch (plan) {
    case 'free':
      return {
        chatEnabled: true,
        practiceEnabled: false,
        wolframVerification: false,
        mcpEnabled: false,
        ragEnabled: false,
        practiceLimit: 5,
        aiExplanations: false,
        downloadContent: false,
      };
    case 'starter':
      return {
        chatEnabled: true,
        practiceEnabled: true,
        wolframVerification: false,
        mcpEnabled: false,
        ragEnabled: true,
        practiceLimit: 20,
        aiExplanations: true,
        downloadContent: false,
      };
    case 'pro':
      return {
        chatEnabled: true,
        practiceEnabled: true,
        wolframVerification: true,
        mcpEnabled: false,
        ragEnabled: true,
        practiceLimit: null,
        aiExplanations: true,
        downloadContent: true,
      };
    case 'enterprise':
      return {
        chatEnabled: true,
        practiceEnabled: true,
        wolframVerification: true,
        mcpEnabled: true,
        ragEnabled: true,
        practiceLimit: null,
        aiExplanations: true,
        downloadContent: true,
      };
  }
}

// ─── Exam Catalog ─────────────────────────────────────────────────────────────

export interface ExamCatalogEntry {
  id: string;
  name: string;
  fullName: string;
  subjects: string[];
  emoji: string;
  description: string;
  targetYear?: string;
}

export const EXAM_CATALOG: ExamCatalogEntry[] = [
  {
    id: 'jee-main',
    name: 'JEE Main',
    fullName: 'Joint Entrance Examination (Main)',
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    emoji: '⚛️',
    description: 'Gateway to NITs, IIITs, and GFTIs',
  },
  {
    id: 'jee-advanced',
    name: 'JEE Advanced',
    fullName: 'Joint Entrance Examination (Advanced)',
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    emoji: '🏆',
    description: 'Gateway to IITs — India\'s premier engineering institutes',
  },
  {
    id: 'neet',
    name: 'NEET',
    fullName: 'National Eligibility cum Entrance Test',
    subjects: ['Physics', 'Chemistry', 'Biology'],
    emoji: '🩺',
    description: 'Medical entrance for MBBS, BDS, and allied courses',
  },
  {
    id: 'gate-em',
    name: 'GATE',
    fullName: 'Graduate Aptitude Test in Engineering',
    subjects: ['Engineering Mathematics', 'Technical Subjects', 'General Aptitude'],
    emoji: '🔬',
    description: 'Postgraduate engineering admissions and PSU recruitment',
  },
  {
    id: 'cat',
    name: 'CAT',
    fullName: 'Common Admission Test',
    subjects: ['Verbal Ability', 'Data Interpretation', 'Logical Reasoning', 'Quantitative Aptitude'],
    emoji: '📊',
    description: 'MBA admissions to IIMs and top B-schools',
  },
  {
    id: 'upsc',
    name: 'UPSC CSE',
    fullName: 'UPSC Civil Services Examination',
    subjects: ['GS Paper I-IV', 'CSAT', 'Optional Subject', 'Essay'],
    emoji: '🏛️',
    description: 'IAS, IPS, IFS and other central government services',
  },
  {
    id: 'cbse-12',
    name: 'CBSE Class 12',
    fullName: 'CBSE Board Examination (Class XII)',
    subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English'],
    emoji: '📚',
    description: 'Central Board senior secondary examination',
  },
  {
    id: 'gmat',
    name: 'GMAT',
    fullName: 'Graduate Management Admission Test',
    subjects: ['Analytical Writing', 'Integrated Reasoning', 'Quantitative', 'Verbal'],
    emoji: '🌐',
    description: 'Global MBA admissions test for top business schools',
  },
];

// ─── UID Generation ───────────────────────────────────────────────────────────

export function generateUID(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let uid = 'EG-';
  for (let i = 0; i < 6; i++) {
    uid += chars[Math.floor(Math.random() * chars.length)];
  }
  return uid;
}

// ─── Default Values ───────────────────────────────────────────────────────────

function defaultChannelAccess(): ChannelAccess {
  return { web: true, whatsapp: false, telegram: false, widget: false };
}

function defaultMCPPrivileges(): MCPPrivileges {
  return { ...PLAN_MCP_MAP.free };
}

function defaultPreferences(): UserPreferences {
  return {
    language: 'en',
    preferredChannel: 'web',
    notificationsEnabled: true,
  };
}

// ─── User CRUD ────────────────────────────────────────────────────────────────

export function createUser(partial: Partial<EGUser> & { name: string }): EGUser {
  const now = new Date().toISOString();
  const uid = partial.uid ?? generateUID();
  const examSubscriptions = partial.examSubscriptions ?? [];
  const user: EGUser = {
    uid,
    name: partial.name,
    email: partial.email,
    phone: partial.phone,
    role: partial.role ?? 'student',
    status: partial.status ?? 'pending',
    createdAt: partial.createdAt ?? now,
    lastActiveAt: partial.lastActiveAt ?? now,
    examSubscriptions,
    channelAccess: partial.channelAccess ?? defaultChannelAccess(),
    mcpPrivileges: partial.mcpPrivileges ?? computeMCPPrivileges(examSubscriptions),
    authMethods: partial.authMethods ?? [],
    preferences: partial.preferences ?? defaultPreferences(),
  };
  return user;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const CURRENT_USER_KEY = 'edugenius_current_user';
const ALL_USERS_KEY = 'edugenius_users';

export function loadCurrentUser(): EGUser | null {
  try {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    if (!stored) return null;
    const user = JSON.parse(stored) as EGUser;
    return cleanExpiredSubscriptions(user); // always clean expired on load
  } catch {
    return null;
  }
}

export function saveCurrentUser(user: EGUser | null): void {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

export function loadAllUsers(): EGUser[] {
  try {
    const raw = localStorage.getItem(ALL_USERS_KEY);
    if (raw) return JSON.parse(raw) as EGUser[];
  } catch { /* ignore */ }
  // seed with mock data on first load
  saveAllUsers(MOCK_USERS);
  return MOCK_USERS;
}

export function saveAllUsers(users: EGUser[]): void {
  localStorage.setItem(ALL_USERS_KEY, JSON.stringify(users));
}

// ─── Lookup Helpers ───────────────────────────────────────────────────────────

export function getUserByUID(uid: string): EGUser | undefined {
  return loadAllUsers().find((u) => u.uid === uid);
}

export function getUserByPhone(phone: string): EGUser | undefined {
  return loadAllUsers().find((u) => u.phone === phone || u.channelAccess.whatsappPhone === phone);
}

export function getUserByEmail(email: string): EGUser | undefined {
  const norm = email.toLowerCase();
  return loadAllUsers().find(
    (u) =>
      u.email?.toLowerCase() === norm ||
      u.authMethods.some((m) => m.identifier.toLowerCase() === norm)
  );
}

export function getUserByChannelId(
  channel: 'whatsapp' | 'telegram',
  identifier: string
): EGUser | undefined {
  return loadAllUsers().find((u) => {
    if (channel === 'whatsapp') {
      return u.channelAccess.whatsappPhone === identifier || u.phone === identifier;
    }
    return u.channelAccess.telegramChatId === identifier;
  });
}

// ─── MCP Privilege Computation ────────────────────────────────────────────────

const PLAN_ORDER: PlanTier[] = ['free', 'starter', 'pro', 'enterprise'];

export function computeMCPPrivileges(examSubscriptions: ExamSubscription[]): MCPPrivileges {
  const active = examSubscriptions.filter((s) => s.status === 'active' || s.status === 'trial');
  if (active.length === 0) return { ...PLAN_MCP_MAP.free };

  // Pick the highest plan across all active subscriptions
  const plans = active.map((s) => s.plan);
  const highestPlan = plans.reduce((best, p) =>
    PLAN_ORDER.indexOf(p) > PLAN_ORDER.indexOf(best) ? p : best
  );
  return { ...PLAN_MCP_MAP[highestPlan] };
}

// ─── Per-Exam Privilege Helpers (Item 1) ─────────────────────────────────────

/**
 * Returns MCP privileges for a specific exam subscription (not the global highest).
 * Use this instead of computeMCPPrivileges() when you need per-exam source filtering.
 */
export function getExamPrivileges(
  examSubscriptions: ExamSubscription[],
  examId: string
): MCPPrivileges {
  const sub = examSubscriptions.find(
    (s) => s.examId === examId && (s.status === 'active' || s.status === 'trial')
  );
  if (!sub) return { ...PLAN_MCP_MAP.free }; // no subscription = free tier
  return { ...PLAN_MCP_MAP[sub.plan] };
}

/**
 * Returns allowed source IDs for a specific exam.
 * Empty array means all sources allowed (enterprise).
 */
export function getExamFilteredSources(
  examSubscriptions: ExamSubscription[],
  examId: string
): string[] {
  const priv = getExamPrivileges(examSubscriptions, examId);
  if (!priv.allowedSources || priv.allowedSources.length === 0) {
    return []; // enterprise = all sources
  }
  return priv.allowedSources;
}

// ─── Expired Subscription Cleanup (Item 2) ───────────────────────────────────

/**
 * Marks expired subscriptions (expiresAt < now) so they are excluded from privilege computation.
 * Call on every user load to keep subscription state fresh.
 */
export function cleanExpiredSubscriptions(user: EGUser): EGUser {
  const now = new Date().toISOString();
  const updated = user.examSubscriptions.map((s) => {
    if (s.expiresAt && s.expiresAt < now && s.status !== 'expired') {
      return { ...s, status: 'expired' as const };
    }
    return s;
  });
  const newPrivileges = computeMCPPrivileges(updated);
  return { ...user, examSubscriptions: updated, mcpPrivileges: newPrivileges };
}

// ─── Session-scoped Active Exam (Item 3) ─────────────────────────────────────

const ACTIVE_EXAM_SESSION_KEY = 'edugenius_active_exam_session';

/**
 * Get the session-scoped active exam override (clears on tab close).
 */
export function getActiveExamForSession(): string | null {
  return sessionStorage.getItem(ACTIVE_EXAM_SESSION_KEY);
}

/**
 * Set the session-scoped active exam (survives page refresh, not tab close).
 */
export function setActiveExamForSession(examId: string): void {
  sessionStorage.setItem(ACTIVE_EXAM_SESSION_KEY, examId);
}

/**
 * Clear the session-scoped active exam override.
 */
export function clearActiveExamSession(): void {
  sessionStorage.removeItem(ACTIVE_EXAM_SESSION_KEY);
}

/**
 * Single source of truth for which exam is active.
 * Priority: sessionStorage override → preferredExamId → first active subscription.
 * For parent role: falls back to childExamIds synthetic subscription.
 */
export function resolveActiveExam(user: EGUser): ExamSubscription | null {
  const sessionExamId = getActiveExamForSession();
  const active = user.examSubscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trial'
  );

  // Teacher/admin/owner/manager: no exam restriction — return first active or null
  if (user.role === 'teacher' || user.role === 'admin' || user.role === 'owner' || user.role === 'manager') {
    if (active.length === 0) return null;
    if (sessionExamId) {
      const match = active.find((s) => s.examId === sessionExamId);
      if (match) return match;
    }
    return active[0];
  }

  // Parent role: use childExamIds if no own subscriptions
  if (user.role === 'parent' && active.length === 0 && user.preferences.childExamIds?.length) {
    const childExamId = sessionExamId && user.preferences.childExamIds.includes(sessionExamId)
      ? sessionExamId
      : user.preferences.childExamIds[0];
    const examEntry = EXAM_CATALOG.find((e) => e.id === childExamId);
    if (examEntry) {
      // Synthetic subscription for parent role
      return {
        examId: examEntry.id,
        examName: examEntry.name,
        plan: 'free',
        status: 'active',
        startedAt: user.createdAt,
        features: {
          chatEnabled: true,
          practiceEnabled: false,
          wolframVerification: false,
          mcpEnabled: false,
          ragEnabled: false,
          practiceLimit: null,
          aiExplanations: false,
          downloadContent: false,
        },
      };
    }
  }

  if (active.length === 0) return null;

  if (sessionExamId) {
    const match = active.find((s) => s.examId === sessionExamId);
    if (match) return match;
  }
  if (user.preferences.preferredExamId) {
    const match = active.find((s) => s.examId === user.preferences.preferredExamId);
    if (match) return match;
  }
  return active[0];
}

// ─── Subscription Management ──────────────────────────────────────────────────

export function subscribeToExam(
  userId: string,
  examId: string,
  plan: PlanTier,
  expiresAt?: string
): EGUser | undefined {
  const users = loadAllUsers();
  const idx = users.findIndex((u) => u.uid === userId);
  if (idx === -1) return undefined;

  const examEntry = EXAM_CATALOG.find((e) => e.id === examId);
  if (!examEntry) return undefined;

  const now = new Date().toISOString();
  const sub: ExamSubscription = {
    examId,
    examName: examEntry.name,
    plan,
    status: 'active',
    startedAt: now,
    expiresAt,
    features: getExamFeatures(plan),
  };

  // Replace existing subscription for same exam
  const existing = users[idx].examSubscriptions.filter((s) => s.examId !== examId);
  users[idx] = {
    ...users[idx],
    examSubscriptions: [...existing, sub],
    mcpPrivileges: computeMCPPrivileges([...existing, sub]),
  };

  saveAllUsers(users);
  return users[idx];
}

// ─── Channel Linking ──────────────────────────────────────────────────────────

export function linkChannel(
  userId: string,
  channel: 'whatsapp' | 'telegram' | 'widget',
  identifier: string,
  extra?: { username?: string }
): EGUser | undefined {
  const users = loadAllUsers();
  const idx = users.findIndex((u) => u.uid === userId);
  if (idx === -1) return undefined;

  const updated: EGUser = { ...users[idx] };
  if (channel === 'whatsapp') {
    updated.channelAccess = { ...updated.channelAccess, whatsapp: true, whatsappPhone: identifier };
    if (!updated.phone) updated.phone = identifier;
  } else if (channel === 'telegram') {
    updated.channelAccess = {
      ...updated.channelAccess,
      telegram: true,
      telegramChatId: identifier,
      telegramUsername: extra?.username,
    };
  } else if (channel === 'widget') {
    updated.channelAccess = { ...updated.channelAccess, widget: true, widgetToken: identifier };
  }

  users[idx] = updated;
  saveAllUsers(users);
  return updated;
}

export function isChannelAllowed(user: EGUser, channel: keyof ChannelAccess): boolean {
  return !!user.channelAccess[channel];
}

// ─── Filtered Source IDs ──────────────────────────────────────────────────────

export function getFilteredSources(user: EGUser | null): string[] {
  if (!user) return PLAN_MCP_MAP.free.allowedSources;
  const { mcpPrivileges } = user;
  // Empty allowedSources on enterprise means all sources allowed
  if (mcpPrivileges.allowedSources.length === 0) return [];
  return mcpPrivileges.allowedSources;
}

// ─── Update User ──────────────────────────────────────────────────────────────

export function updateUser(uid: string, patch: Partial<EGUser>): EGUser | undefined {
  const users = loadAllUsers();
  const idx = users.findIndex((u) => u.uid === uid);
  if (idx === -1) return undefined;
  users[idx] = { ...users[idx], ...patch };
  saveAllUsers(users);
  return users[idx];
}

export function deleteUser(uid: string): boolean {
  const users = loadAllUsers();
  const next = users.filter((u) => u.uid !== uid);
  if (next.length === users.length) return false;
  saveAllUsers(next);
  return true;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

function mkSub(
  examId: string,
  plan: PlanTier,
  status: ExamSubscription['status'] = 'active',
  expiresAt?: string
): ExamSubscription {
  const entry = EXAM_CATALOG.find((e) => e.id === examId)!;
  return {
    examId,
    examName: entry.name,
    plan,
    status,
    startedAt: '2025-09-01T00:00:00Z',
    expiresAt,
    features: getExamFeatures(plan),
  };
}

export const MOCK_USERS: EGUser[] = [
  {
    uid: 'EG-A1B2C3',
    name: 'Arjun Sharma',
    email: 'arjun@gmail.com',
    phone: '+919876543210',
    role: 'student',
    status: 'active',
    createdAt: '2025-09-01T00:00:00Z',
    lastActiveAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    examSubscriptions: [mkSub('jee-main', 'pro', 'active', '2026-12-31')],
    channelAccess: { web: true, whatsapp: true, telegram: false, widget: false, whatsappPhone: '+919876543210' },
    mcpPrivileges: computeMCPPrivileges([mkSub('jee-main', 'pro')]),
    authMethods: [{ type: 'whatsapp_otp', identifier: '+919876543210', linkedAt: '2025-09-01T00:00:00Z' }],
    preferences: { language: 'en', preferredChannel: 'whatsapp', notificationsEnabled: true, preferredExamId: 'jee-main' },
  },
  {
    uid: 'EG-D4E5F6',
    name: 'Priya Nair',
    email: 'priya@gmail.com',
    phone: '+919123456789',
    role: 'student',
    status: 'active',
    createdAt: '2025-10-15T00:00:00Z',
    lastActiveAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    examSubscriptions: [mkSub('neet', 'starter', 'active', '2026-06-30')],
    channelAccess: { web: true, whatsapp: false, telegram: true, widget: false, telegramChatId: '123456789', telegramUsername: 'priyanair' },
    mcpPrivileges: computeMCPPrivileges([mkSub('neet', 'starter')]),
    authMethods: [{ type: 'telegram_bot', identifier: '123456789', linkedAt: '2025-10-15T00:00:00Z' }],
    preferences: { language: 'en', preferredChannel: 'telegram', notificationsEnabled: true, preferredExamId: 'neet' },
  },
  {
    uid: 'EG-G7H8I9',
    name: 'Rohan Mehta',
    email: 'rohan@gmail.com',
    phone: '+919988776655',
    role: 'student',
    status: 'inactive',
    createdAt: '2025-11-01T00:00:00Z',
    lastActiveAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    examSubscriptions: [mkSub('jee-main', 'free')],
    channelAccess: { web: true, whatsapp: false, telegram: false, widget: false },
    mcpPrivileges: computeMCPPrivileges([mkSub('jee-main', 'free')]),
    authMethods: [{ type: 'email_otp', identifier: 'rohan@gmail.com', linkedAt: '2025-11-01T00:00:00Z' }],
    preferences: { language: 'en', preferredChannel: 'web', notificationsEnabled: false, preferredExamId: 'jee-main' },
  },
  {
    uid: 'EG-J1K2L3',
    name: 'Sunita Verma',
    email: 'sunita@gmail.com',
    phone: '+919001122334',
    role: 'parent',
    status: 'active',
    createdAt: '2025-08-20T00:00:00Z',
    lastActiveAt: new Date(Date.now() - 86400000).toISOString(),
    examSubscriptions: [],
    channelAccess: { web: true, whatsapp: true, telegram: false, widget: false, whatsappPhone: '+919001122334' },
    mcpPrivileges: defaultMCPPrivileges(),
    authMethods: [{ type: 'whatsapp_otp', identifier: '+919001122334', linkedAt: '2025-08-20T00:00:00Z' }],
    preferences: { language: 'hi', preferredChannel: 'whatsapp', notificationsEnabled: true },
  },
  {
    uid: 'EG-M4N5O6',
    name: 'Dr. Anil Kumar',
    email: 'anil@school.edu',
    phone: '+917766554433',
    role: 'teacher',
    status: 'active',
    createdAt: '2025-07-01T00:00:00Z',
    lastActiveAt: new Date(Date.now() - 1800000).toISOString(),
    examSubscriptions: [mkSub('cbse-12', 'pro', 'active')],
    channelAccess: { web: true, whatsapp: true, telegram: true, widget: true, whatsappPhone: '+917766554433', telegramChatId: '987654321', widgetToken: 'wt-anil-school' },
    mcpPrivileges: computeMCPPrivileges([mkSub('cbse-12', 'pro')]),
    authMethods: [
      { type: 'email_otp', identifier: 'anil@school.edu', linkedAt: '2025-07-01T00:00:00Z' },
      { type: 'google', identifier: 'anil@school.edu', linkedAt: '2025-07-15T00:00:00Z' },
    ],
    preferences: { language: 'en', preferredChannel: 'web', notificationsEnabled: true, preferredExamId: 'cbse-12' },
  },
  {
    uid: 'EG-P7Q8R9',
    name: 'Meera Iyer',
    email: 'meera@gmail.com',
    phone: '+919555444333',
    role: 'student',
    status: 'active',
    createdAt: '2025-06-15T00:00:00Z',
    lastActiveAt: new Date(Date.now() - 3600000).toISOString(),
    examSubscriptions: [
      mkSub('upsc', 'pro', 'active', '2026-12-31'),
      mkSub('cbse-12', 'starter', 'expired', '2025-03-31'),
    ],
    channelAccess: { web: true, whatsapp: true, telegram: true, widget: false, whatsappPhone: '+919555444333', telegramChatId: '111222333' },
    mcpPrivileges: computeMCPPrivileges([mkSub('upsc', 'pro')]),
    authMethods: [{ type: 'whatsapp_otp', identifier: '+919555444333', linkedAt: '2025-06-15T00:00:00Z' }],
    preferences: { language: 'en', preferredChannel: 'web', notificationsEnabled: true, preferredExamId: 'upsc' },
  },
  {
    uid: 'EG-S1T2U3',
    name: 'Vikram Patel',
    email: 'vikram@gmail.com',
    phone: '+919444555666',
    role: 'student',
    status: 'active',
    createdAt: '2025-05-01T00:00:00Z',
    lastActiveAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    examSubscriptions: [
      mkSub('cat', 'enterprise', 'active', '2026-12-31'),
      mkSub('gmat', 'enterprise', 'active', '2026-12-31'),
    ],
    channelAccess: { web: true, whatsapp: true, telegram: true, widget: true, whatsappPhone: '+919444555666', telegramChatId: '444555666', widgetToken: 'wt-vikram-premium' },
    mcpPrivileges: computeMCPPrivileges([mkSub('cat', 'enterprise')]),
    authMethods: [
      { type: 'google', identifier: 'vikram@gmail.com', linkedAt: '2025-05-01T00:00:00Z' },
      { type: 'passkey', identifier: 'pk-vikram-chrome', linkedAt: '2025-05-10T00:00:00Z' },
    ],
    preferences: { language: 'en', preferredChannel: 'web', notificationsEnabled: true, preferredExamId: 'cat' },
  },
  {
    uid: 'EG-V4W5X6',
    name: 'Raju Gupta',
    email: 'raju@gmail.com',
    phone: '+919222111000',
    role: 'student',
    status: 'suspended',
    createdAt: '2025-12-01T00:00:00Z',
    lastActiveAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    examSubscriptions: [mkSub('gate-em', 'free')],
    channelAccess: { web: true, whatsapp: false, telegram: false, widget: false },
    mcpPrivileges: computeMCPPrivileges([mkSub('gate-em', 'free')]),
    authMethods: [{ type: 'email_otp', identifier: 'raju@gmail.com', linkedAt: '2025-12-01T00:00:00Z' }],
    preferences: { language: 'hi', preferredChannel: 'web', notificationsEnabled: false, preferredExamId: 'gate-em' },
  },
  {
    uid: 'EG-Y7Z8A9',
    name: 'Nisha Singh',
    email: 'nisha@gmail.com',
    phone: '+919333222111',
    role: 'student',
    status: 'pending',
    createdAt: '2026-01-15T00:00:00Z',
    lastActiveAt: new Date(Date.now() - 86400000).toISOString(),
    examSubscriptions: [mkSub('jee-advanced', 'pro', 'trial', '2026-02-15')],
    channelAccess: { web: true, whatsapp: false, telegram: false, widget: false },
    mcpPrivileges: computeMCPPrivileges([mkSub('jee-advanced', 'pro', 'trial')]),
    authMethods: [{ type: 'email_otp', identifier: 'nisha@gmail.com', linkedAt: '2026-01-15T00:00:00Z' }],
    preferences: { language: 'en', preferredChannel: 'web', notificationsEnabled: true, preferredExamId: 'jee-advanced' },
  },
  {
    uid: 'EG-B1C2D3',
    name: 'Amit Joshi',
    email: 'amit@edugenius.in',
    phone: '+919100200300',
    role: 'admin',
    status: 'active',
    createdAt: '2025-01-01T00:00:00Z',
    lastActiveAt: new Date(Date.now() - 600000).toISOString(),
    examSubscriptions: [],
    channelAccess: { web: true, whatsapp: true, telegram: true, widget: true, whatsappPhone: '+919100200300', telegramChatId: '000111222', widgetToken: 'wt-admin-internal' },
    mcpPrivileges: { ...PLAN_MCP_MAP.enterprise },
    authMethods: [
      { type: 'google', identifier: 'amit@edugenius.in', linkedAt: '2025-01-01T00:00:00Z' },
      { type: 'passkey', identifier: 'pk-amit-admin', linkedAt: '2025-01-15T00:00:00Z' },
    ],
    preferences: { language: 'en', preferredChannel: 'web', notificationsEnabled: true },
  },
];
