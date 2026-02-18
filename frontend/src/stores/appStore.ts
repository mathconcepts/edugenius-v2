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
  // User
  user: User | null;
  setUser: (user: User | null) => void;
  
  // User Role (for preview switching)
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  
  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  
  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  
  // Playground mode
  playgroundMode: boolean;
  setPlaygroundMode: (enabled: boolean) => void;
  
  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  
  // Agents
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
    emoji: '👨‍🏫',
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
];

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // User
      user: null,
      setUser: (user) => set({ user }),
      
      // User Role — single source of truth for all role-gated UI
      userRole: 'ceo' as UserRole,
      setUserRole: (role) => set({ userRole: role }),

      // Theme
      theme: 'dark' as 'light' | 'dark',
      toggleTheme: () => set((state) => ({
        theme: state.theme === 'dark' ? 'light' : 'dark',
      })),

      // Sidebar
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      // Playground
      playgroundMode: true,
      setPlaygroundMode: (enabled) => set({ playgroundMode: enabled }),

      // Notifications
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

      // Agents
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
      version: 2, // Bumped: clears old stale cache that had playgroundConfig
      storage: createJSONStorage(() => localStorage),
      migrate: (_oldState, _oldVersion) => {
        // Always start fresh on version bump — safe since it's preview/playground data
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
      }),
    }
  )
);
