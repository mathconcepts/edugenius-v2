import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserRole, Agent, Notification } from '@/types';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

interface AppState {
  // ── Core ─────────────────────────────────────────────────────────────────────
  user: User | null;
  setUser: (user: User | null) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  playgroundMode: boolean;
  setPlaygroundMode: (enabled: boolean) => void;

  // ── Manim ─────────────────────────────────────────────────────────────────────
  manimEnabled: boolean;
  setManimEnabled: (enabled: boolean) => void;
  manimServiceUrl: string;
  setManimServiceUrl: (url: string) => void;

  // ── v2.0 Feature Flags (CEO/Admin toggleable from Settings > Advanced) ────────

  // F1: Gamification — XP, levels, streaks, badges, leaderboard (default ON)
  gamificationEnabled: boolean;
  setGamificationEnabled: (v: boolean) => void;

  // F2: Voice input (mic → text) + TTS (read Sage responses aloud) (default OFF)
  voiceInputEnabled: boolean;
  setVoiceInputEnabled: (v: boolean) => void;
  voiceTTSEnabled: boolean;
  setVoiceTTSEnabled: (v: boolean) => void;

  // F3: Daily Brief — concept-of-the-day WhatsApp-style card (default ON)
  dailyBriefEnabled: boolean;
  setDailyBriefEnabled: (v: boolean) => void;
  dailyBriefChannel: 'in-app' | 'whatsapp' | 'telegram';
  setDailyBriefChannel: (v: 'in-app' | 'whatsapp' | 'telegram') => void;

  // F4: Spaced Repetition widget & revision schedule (default ON)
  spacedRepetitionEnabled: boolean;
  setSpacedRepetitionEnabled: (v: boolean) => void;

  // F6: Live Exam Simulator (default ON)
  examSimEnabled: boolean;
  setExamSimEnabled: (v: boolean) => void;

  // F8: Micro-video / on-demand Manim (separate from manim lab) (default OFF)
  microVideoEnabled: boolean;
  setMicroVideoEnabled: (v: boolean) => void;

  // F10: Multilingual Sage (default OFF)
  multilingualEnabled: boolean;
  setMultilingualEnabled: (v: boolean) => void;
  sageLanguage: string; // BCP-47 e.g. 'en-IN', 'hi-IN', 'te-IN'
  setSageLanguage: (v: string) => void;

  // F11: Predictive Readiness Score (default ON)
  readinessScoreEnabled: boolean;
  setReadinessScoreEnabled: (v: boolean) => void;

  // F12: Mood Check-In (default ON)
  moodCheckInEnabled: boolean;
  setMoodCheckInEnabled: (v: boolean) => void;

  // ── Notifications ─────────────────────────────────────────────────────────────
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;

  // ── Agents ───────────────────────────────────────────────────────────────────
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;
  updateAgentStatus: (id: string, status: Agent['status']) => void;
}

const defaultAgents: Agent[] = [
  {
    id: 'scout',
    name: 'Scout',
    emoji: '🔍',
    status: 'active',
    description: 'Market Research & Intelligence',
    subAgents: [
      { id: 'trend-tracker', name: 'Trend Tracker', description: 'Monitors education trends', status: 'active' },
      { id: 'competitor-watcher', name: 'Competitor Watcher', description: 'Tracks competitors', status: 'idle' },
      { id: 'market-analyst', name: 'Market Analyst', description: 'Analyzes market data', status: 'active' },
      { id: 'opportunity-finder', name: 'Opportunity Finder', description: 'Identifies opportunities', status: 'idle' },
      { id: 'exam-tracker', name: 'Exam Tracker', description: 'Monitors exam updates', status: 'active' },
    ],
    metrics: { tasksCompleted: 1247, tokensUsed: 450000, avgResponseTime: 2.3, successRate: 94.5 },
  },
  {
    id: 'atlas',
    name: 'Atlas',
    emoji: '📚',
    status: 'active',
    description: 'Content Factory & Knowledge Base',
    subAgents: [
      { id: 'content-writer', name: 'Content Writer', description: 'Creates educational content', status: 'busy' },
      { id: 'question-generator', name: 'Question Generator', description: 'Generates practice questions', status: 'active' },
      { id: 'curriculum-mapper', name: 'Curriculum Mapper', description: 'Maps curriculum structure', status: 'idle' },
      { id: 'quality-checker', name: 'Quality Checker', description: 'Reviews content quality', status: 'active' },
      { id: 'translator', name: 'Translator', description: 'Handles vernacular content', status: 'idle' },
      { id: 'formatter', name: 'Formatter', description: 'Formats content for delivery', status: 'active' },
      { id: 'asset-manager', name: 'Asset Manager', description: 'Manages media assets', status: 'idle' },
    ],
    metrics: { tasksCompleted: 3456, tokensUsed: 1200000, avgResponseTime: 4.5, successRate: 97.2 },
  },
  {
    id: 'sage',
    name: 'Sage',
    emoji: '🎓',
    status: 'busy',
    description: 'Socratic Tutor & Learning Engine',
    subAgents: [
      { id: 'socratic-guide', name: 'Socratic Guide', description: 'Guides through questions', status: 'busy' },
      { id: 'hint-provider', name: 'Hint Provider', description: 'Provides progressive hints', status: 'active' },
      { id: 'concept-explainer', name: 'Concept Explainer', description: 'Explains concepts clearly', status: 'busy' },
      { id: 'mistake-analyzer', name: 'Mistake Analyzer', description: 'Analyzes student mistakes', status: 'active' },
      { id: 'progress-tracker', name: 'Progress Tracker', description: 'Tracks learning progress', status: 'active' },
      { id: 'adaptive-router', name: 'Adaptive Router', description: 'Routes to optimal content', status: 'active' },
      { id: 'math-solver', name: 'Math Solver', description: 'Wolfram-powered solver', status: 'idle' },
    ],
    metrics: { tasksCompleted: 8923, tokensUsed: 2500000, avgResponseTime: 1.8, successRate: 96.8 },
  },
  {
    id: 'mentor',
    name: 'Mentor',
    emoji: '👨🏫',
    status: 'active',
    description: 'Student Engagement & Gamification',
    subAgents: [
      { id: 'motivator', name: 'Motivator', description: 'Sends motivational nudges', status: 'active' },
      { id: 'streak-manager', name: 'Streak Manager', description: 'Manages learning streaks', status: 'active' },
      { id: 'badge-awarder', name: 'Badge Awarder', description: 'Awards achievement badges', status: 'idle' },
      { id: 'parent-reporter', name: 'Parent Reporter', description: 'Generates parent reports', status: 'idle' },
      { id: 'goal-setter', name: 'Goal Setter', description: 'Helps set learning goals', status: 'active' },
      { id: 'reminder-bot', name: 'Reminder Bot', description: 'Sends study reminders', status: 'active' },
    ],
    metrics: { tasksCompleted: 2156, tokensUsed: 380000, avgResponseTime: 0.8, successRate: 98.1 },
  },
  {
    id: 'herald',
    name: 'Herald',
    emoji: '📢',
    status: 'idle',
    description: 'Marketing & Growth Engine',
    subAgents: [
      { id: 'blog-writer', name: 'Blog Writer', description: 'Writes SEO blog posts', status: 'idle' },
      { id: 'social-manager', name: 'Social Manager', description: 'Manages social media', status: 'idle' },
      { id: 'email-crafter', name: 'Email Crafter', description: 'Creates email campaigns', status: 'idle' },
      { id: 'seo-optimizer', name: 'SEO Optimizer', description: 'Optimizes for search', status: 'active' },
      { id: 'ad-creator', name: 'Ad Creator', description: 'Creates ad campaigns', status: 'idle' },
      { id: 'landing-builder', name: 'Landing Builder', description: 'Builds landing pages', status: 'idle' },
      { id: 'referral-manager', name: 'Referral Manager', description: 'Manages referrals', status: 'idle' },
    ],
    metrics: { tasksCompleted: 892, tokensUsed: 520000, avgResponseTime: 5.2, successRate: 91.3 },
  },
  {
    id: 'forge',
    name: 'Forge',
    emoji: '⚙️',
    status: 'active',
    description: 'DevOps & Infrastructure',
    subAgents: [
      { id: 'deployer', name: 'Deployer', description: 'Handles deployments', status: 'active' },
      { id: 'monitor', name: 'Monitor', description: 'Monitors system health', status: 'active' },
      { id: 'scaler', name: 'Scaler', description: 'Auto-scales resources', status: 'idle' },
      { id: 'backup-manager', name: 'Backup Manager', description: 'Manages backups', status: 'active' },
      { id: 'security-guard', name: 'Security Guard', description: 'Security monitoring', status: 'active' },
      { id: 'log-analyzer', name: 'Log Analyzer', description: 'Analyzes system logs', status: 'idle' },
      { id: 'cost-optimizer', name: 'Cost Optimizer', description: 'Optimizes cloud costs', status: 'idle' },
    ],
    metrics: { tasksCompleted: 567, tokensUsed: 180000, avgResponseTime: 0.5, successRate: 99.2 },
  },
  {
    id: 'oracle',
    name: 'Oracle',
    emoji: '📊',
    status: 'active',
    description: 'Analytics & Business Intelligence',
    subAgents: [
      { id: 'metric-tracker', name: 'Metric Tracker', description: 'Tracks key metrics', status: 'active' },
      { id: 'report-generator', name: 'Report Generator', description: 'Generates reports', status: 'idle' },
      { id: 'trend-analyzer', name: 'Trend Analyzer', description: 'Analyzes trends', status: 'active' },
      { id: 'predictor', name: 'Predictor', description: 'Predicts future metrics', status: 'idle' },
      { id: 'cohort-analyzer', name: 'Cohort Analyzer', description: 'Analyzes user cohorts', status: 'active' },
      { id: 'ab-tester', name: 'A/B Tester', description: 'Manages A/B tests', status: 'idle' },
    ],
    metrics: { tasksCompleted: 1834, tokensUsed: 420000, avgResponseTime: 3.1, successRate: 95.7 },
  },
  {
    id: 'nexus',
    name: 'Nexus',
    emoji: '🔗',
    status: 'active',
    description: 'Manager Orchestrator — L2 ticket routing, at-risk detection, outreach, update dispatch',
    subAgents: [
      { id: 'ticket-router',        name: 'Ticket Router',         description: 'Routes L2 tickets to exam-scoped manager',         status: 'active' },
      { id: 'at-risk-detector',     name: 'At-Risk Detector',      description: 'Flags disengaged students for proactive outreach',  status: 'active' },
      { id: 'outreach-composer',    name: 'Outreach Composer',     description: 'Drafts personalised outreach per channel',          status: 'active' },
      { id: 'update-dispatcher',    name: 'Update Dispatcher',     description: 'Routes update triggers to Atlas/Forge/Sage/Herald', status: 'active' },
      { id: 'resolution-suggester', name: 'Resolution Suggester',  description: 'Suggests resolutions from KB + past tickets',       status: 'active' },
      { id: 'csat-monitor',         name: 'CSAT Monitor',          description: 'Tracks per-manager satisfaction scores',            status: 'active' },
      { id: 'broadcast-planner',    name: 'Broadcast Planner',     description: 'Plans exam-scoped announcements across channels',   status: 'idle'   },
      { id: 'churn-rescue',         name: 'Churn Rescue',          description: 'Detects near-expiry inactive students',             status: 'active' },
      { id: 'escalation-guard',     name: 'Escalation Guard',      description: 'Nudges manager on SLA-approaching tickets',        status: 'active' },
      { id: 'knowledge-updater',    name: 'Knowledge Updater',     description: 'Adds resolved patterns to L1 knowledge base',      status: 'idle'   },
    ],
    metrics: { tasksCompleted: 0, tokensUsed: 0, avgResponseTime: 0.8, successRate: 100 },
  },
];

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // ── Core ─────────────────────────────────────────────────────────────────
      user: null,
      setUser: (user) => set({ user }),
      userRole: 'ceo' as UserRole,
      setUserRole: (role) => set({ userRole: role }),
      theme: 'dark' as 'light' | 'dark',
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      playgroundMode: true,
      setPlaygroundMode: (enabled) => set({ playgroundMode: enabled }),

      // ── Manim ─────────────────────────────────────────────────────────────────
      manimEnabled: false,
      setManimEnabled: (enabled) => set({ manimEnabled: enabled }),
      manimServiceUrl: 'http://localhost:7341',
      setManimServiceUrl: (url) => set({ manimServiceUrl: url }),

      // ── v2.0 Feature Flags ────────────────────────────────────────────────────
      gamificationEnabled: true,
      setGamificationEnabled: (v) => set({ gamificationEnabled: v }),

      voiceInputEnabled: false,
      setVoiceInputEnabled: (v) => set({ voiceInputEnabled: v }),
      voiceTTSEnabled: false,
      setVoiceTTSEnabled: (v) => set({ voiceTTSEnabled: v }),

      dailyBriefEnabled: true,
      setDailyBriefEnabled: (v) => set({ dailyBriefEnabled: v }),
      dailyBriefChannel: 'in-app' as const,
      setDailyBriefChannel: (v) => set({ dailyBriefChannel: v }),

      spacedRepetitionEnabled: true,
      setSpacedRepetitionEnabled: (v) => set({ spacedRepetitionEnabled: v }),

      examSimEnabled: true,
      setExamSimEnabled: (v) => set({ examSimEnabled: v }),

      microVideoEnabled: false,
      setMicroVideoEnabled: (v) => set({ microVideoEnabled: v }),

      multilingualEnabled: false,
      setMultilingualEnabled: (v) => set({ multilingualEnabled: v }),
      sageLanguage: 'en-IN',
      setSageLanguage: (v) => set({ sageLanguage: v }),

      readinessScoreEnabled: true,
      setReadinessScoreEnabled: (v) => set({ readinessScoreEnabled: v }),

      moodCheckInEnabled: true,
      setMoodCheckInEnabled: (v) => set({ moodCheckInEnabled: v }),

      // ── Notifications ─────────────────────────────────────────────────────────
      notifications: [],
      addNotification: (notification) => set((state) => ({
        notifications: [
          {
            ...notification,
            id: Math.random().toString(36).slice(2),
            timestamp: new Date(),
            read: false,
          },
          ...state.notifications,
        ].slice(0, 50),
      })),
      markNotificationRead: (id) => set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
      })),
      clearNotifications: () => set({ notifications: [] }),

      // ── Agents ────────────────────────────────────────────────────────────────
      agents: defaultAgents,
      setAgents: (agents) => set({ agents }),
      updateAgentStatus: (id, status) => set((state) => ({
        agents: state.agents.map((a) =>
          a.id === id ? { ...a, status } : a
        ),
      })),
    }),
    {
      name: 'edugenius-storage',
      version: 3, // Bumped for v2.0 feature flags
      storage: createJSONStorage(() => localStorage),
      migrate: (_oldState, _oldVersion) => {
        return {
          theme: 'dark' as const,
          sidebarOpen: true,
          userRole: 'ceo' as UserRole,
          playgroundMode: true,
        };
      },
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        userRole: state.userRole,
        playgroundMode: state.playgroundMode,
        manimEnabled: state.manimEnabled,
        manimServiceUrl: state.manimServiceUrl,
        // v2.0 feature flags
        gamificationEnabled: state.gamificationEnabled,
        voiceInputEnabled: state.voiceInputEnabled,
        voiceTTSEnabled: state.voiceTTSEnabled,
        dailyBriefEnabled: state.dailyBriefEnabled,
        dailyBriefChannel: state.dailyBriefChannel,
        spacedRepetitionEnabled: state.spacedRepetitionEnabled,
        examSimEnabled: state.examSimEnabled,
        microVideoEnabled: state.microVideoEnabled,
        multilingualEnabled: state.multilingualEnabled,
        sageLanguage: state.sageLanguage,
        readinessScoreEnabled: state.readinessScoreEnabled,
        moodCheckInEnabled: state.moodCheckInEnabled,
      }),
    }
  )
);
