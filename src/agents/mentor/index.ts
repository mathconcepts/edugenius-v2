/**
 * Mentor Agent - Student Engagement
 * Manages retention, gamification, and parent communication
 */

import { BaseAgent, AgentConfig, AgentContext } from '../base-agent';
import { EngagementAlertPayload, NudgeRequestPayload, NudgeSentPayload } from '../../events/types';
import { Student, StudentEngagement, Badge, Achievement } from '../../data/types';

// ============================================================================
// Mentor Agent Configuration
// ============================================================================

const MENTOR_CONFIG: AgentConfig = {
  id: 'Mentor',
  name: 'Mentor',
  description: 'Engagement agent - manages retention, gamification, and parent communication',
  heartbeatIntervalMs: 2 * 60 * 60 * 1000, // 2 hours
  budget: {
    dailyTokenLimit: 50000,
    warningThreshold: 0.7,
  },
  subAgents: [
    {
      id: 'ChurnPredictor',
      name: 'Churn Predictor',
      description: 'Identifies at-risk students',
      triggers: ['schedule:daily', 'event:inactivity'],
      handler: 'predictChurn',
    },
    {
      id: 'NudgeEngine',
      name: 'Nudge Engine',
      description: 'Sends personalized notifications',
      triggers: ['request:nudge', 'schedule:hourly'],
      handler: 'sendNudge',
    },
    {
      id: 'StreakTracker',
      name: 'Streak Tracker',
      description: 'Manages learning streaks',
      triggers: ['event:session_end'],
      handler: 'trackStreak',
    },
    {
      id: 'MilestoneManager',
      name: 'Milestone Manager',
      description: 'Awards badges and achievements',
      triggers: ['event:progress'],
      handler: 'checkMilestones',
    },
    {
      id: 'ReEngager',
      name: 'Re-Engager',
      description: 'Win-back campaigns for churned users',
      triggers: ['schedule:weekly', 'event:churn'],
      handler: 'reEngage',
    },
    {
      id: 'ParentReporter',
      name: 'Parent Reporter',
      description: 'Generates progress reports for parents',
      triggers: ['schedule:weekly', 'request:report'],
      handler: 'generateParentReport',
    },
  ],
};

// ============================================================================
// Mentor Agent Implementation
// ============================================================================

export class MentorAgent extends BaseAgent {
  private nudgeQueue: NudgeTask[] = [];
  private studentEngagement: Map<string, EngagementScore> = new Map();
  private streaks: Map<string, StreakData> = new Map();

  constructor(config: Partial<AgentConfig> = {}) {
    super({ ...MENTOR_CONFIG, ...config });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  protected async initializeLLM(): Promise<void> {
    this.llm = null;
  }

  protected registerSubAgents(): void {
    this.registerSubAgent('ChurnPredictor', this.predictChurn.bind(this));
    this.registerSubAgent('NudgeEngine', this.sendNudge.bind(this));
    this.registerSubAgent('StreakTracker', this.trackStreak.bind(this));
    this.registerSubAgent('MilestoneManager', this.checkMilestones.bind(this));
    this.registerSubAgent('ReEngager', this.reEngage.bind(this));
    this.registerSubAgent('ParentReporter', this.generateParentReport.bind(this));
  }

  protected async setupSubscriptions(): Promise<void> {
    // Listen for session endings
    this.subscribeAll('sage.session.ended', async (event) => {
      const { studentId } = event.payload;
      await this.invokeSubAgent('StreakTracker', { studentId }, { agentId: this.config.id });
    });

    // Listen for progress updates
    this.subscribeAll('sage.progress.updated', async (event) => {
      await this.invokeSubAgent('MilestoneManager', event.payload, { agentId: this.config.id });
    });

    // Listen for nudge requests
    this.subscribe('mentor.nudge.requested', async (event) => {
      await this.queueNudge(event.payload);
    });
  }

  protected async onHeartbeat(): Promise<void> {
    const hour = new Date().getUTCHours();

    // Morning: Churn prediction
    if (hour === 8) {
      await this.runChurnPrediction();
    }

    // Process nudge queue
    await this.processNudgeQueue();

    // Weekly: Parent reports (Sunday 10 AM UTC)
    if (new Date().getDay() === 0 && hour === 10) {
      await this.runParentReports();
    }
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Churn Predictor
  // -------------------------------------------------------------------------

  private async predictChurn(
    input: ChurnPredictorInput,
    context: AgentContext
  ): Promise<ChurnPrediction[]> {
    const { studentIds } = input;
    const predictions: ChurnPrediction[] = [];

    for (const studentId of studentIds || []) {
      const engagement = await this.calculateEngagement(studentId);
      
      if (engagement.churnRisk > 0.5) {
        predictions.push({
          studentId,
          churnRisk: engagement.churnRisk,
          factors: engagement.factors,
          recommendedAction: this.getChurnAction(engagement),
        });

        // Emit alert
        this.emit('mentor.engagement.alert', {
          studentId,
          alertType: 'churn_risk',
          score: engagement.churnRisk,
          factors: engagement.factors,
          recommendedAction: this.getChurnAction(engagement),
          urgency: engagement.churnRisk > 0.8 ? 'critical' : 'high',
        });
      }
    }

    return predictions;
  }

  private async calculateEngagement(studentId: string): Promise<EngagementScore> {
    // Check cache first
    const cached = this.studentEngagement.get(studentId);
    if (cached && Date.now() - cached.calculatedAt < 3600000) {
      return cached;
    }

    // Calculate engagement factors
    const factors: Record<string, number> = {
      recency: Math.random() * 0.3 + 0.3, // Days since last activity
      frequency: Math.random() * 0.3 + 0.4, // Sessions per week
      duration: Math.random() * 0.3 + 0.5, // Average session length
      progress: Math.random() * 0.3 + 0.4, // Learning progress
      streak: Math.random() * 0.3 + 0.3, // Current streak
    };

    // Calculate churn risk (weighted average inverse)
    const weights = { recency: 0.3, frequency: 0.25, duration: 0.15, progress: 0.2, streak: 0.1 };
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (const [factor, value] of Object.entries(factors)) {
      weightedSum += value * (weights[factor as keyof typeof weights] || 0.1);
      totalWeight += weights[factor as keyof typeof weights] || 0.1;
    }

    const engagementScore = weightedSum / totalWeight;
    const churnRisk = 1 - engagementScore;

    const result: EngagementScore = {
      studentId,
      score: engagementScore,
      churnRisk,
      factors,
      calculatedAt: Date.now(),
    };

    this.studentEngagement.set(studentId, result);
    return result;
  }

  private getChurnAction(engagement: EngagementScore): string {
    const lowestFactor = Object.entries(engagement.factors)
      .sort((a, b) => a[1] - b[1])[0];

    const actions: Record<string, string> = {
      recency: 'Send re-engagement nudge',
      frequency: 'Schedule reminder notifications',
      duration: 'Offer shorter, focused sessions',
      progress: 'Provide easier content to build momentum',
      streak: 'Highlight streak recovery opportunity',
    };

    return actions[lowestFactor[0]] || 'Send personalized check-in';
  }

  private async runChurnPrediction(): Promise<void> {
    const studentIds = await this.getActiveStudentIds();
    await this.invokeSubAgent<ChurnPrediction[]>(
      'ChurnPredictor',
      { studentIds },
      { agentId: this.config.id }
    );
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Nudge Engine
  // -------------------------------------------------------------------------

  private async sendNudge(
    input: NudgeInput,
    context: AgentContext
  ): Promise<NudgeResult> {
    const { studentId, nudgeType, channel, content, scheduledFor } = input;

    // Personalize content
    const personalizedContent = await this.personalizeNudge(studentId, content, nudgeType);

    // Schedule or send immediately
    if (scheduledFor && scheduledFor > Date.now()) {
      this.nudgeQueue.push({
        id: `nudge-${Date.now()}`,
        studentId,
        nudgeType,
        channel,
        content: personalizedContent,
        scheduledFor,
        status: 'scheduled',
      });
      return { sent: false, scheduled: true, scheduledFor };
    }

    // Send nudge (would integrate with notification services)
    const sent = await this.deliverNudge(studentId, channel, personalizedContent);

    if (sent) {
      this.emit('mentor.nudge.sent', {
        nudgeId: `nudge-${Date.now()}`,
        studentId,
        nudgeType,
        channel,
        sentAt: Date.now(),
        delivered: true,
      });
    }

    return { sent, scheduled: false };
  }

  private async personalizeNudge(
    studentId: string,
    content: string,
    nudgeType: NudgeType
  ): Promise<string> {
    // Would fetch student data and personalize
    const templates: Record<NudgeType, string> = {
      reminder: `Hey! 📚 Don't forget to practice today. ${content}`,
      encouragement: `You're doing great! 💪 ${content}`,
      challenge: `Ready for a challenge? 🎯 ${content}`,
      celebration: `🎉 Amazing work! ${content}`,
      help: `Need any help? 🤝 ${content}`,
    };

    return templates[nudgeType] || content;
  }

  private async deliverNudge(
    studentId: string,
    channel: NudgeChannel,
    content: string
  ): Promise<boolean> {
    // Would integrate with notification services
    console.log(`[Mentor] Sending ${channel} nudge to ${studentId}: ${content.slice(0, 50)}...`);
    return true;
  }

  private async queueNudge(request: NudgeRequestPayload): Promise<void> {
    await this.invokeSubAgent(
      'NudgeEngine',
      {
        studentId: request.studentId,
        nudgeType: request.nudgeType,
        channel: request.channel,
        content: request.content,
        scheduledFor: request.scheduledFor,
      },
      { agentId: this.config.id }
    );
  }

  private async processNudgeQueue(): Promise<void> {
    const now = Date.now();
    const ready = this.nudgeQueue.filter(n => 
      n.status === 'scheduled' && n.scheduledFor && n.scheduledFor <= now
    );

    for (const nudge of ready) {
      await this.deliverNudge(nudge.studentId, nudge.channel, nudge.content);
      nudge.status = 'sent';
    }

    // Clean up sent nudges
    this.nudgeQueue = this.nudgeQueue.filter(n => n.status !== 'sent');
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Streak Tracker
  // -------------------------------------------------------------------------

  private async trackStreak(
    input: StreakInput,
    context: AgentContext
  ): Promise<StreakResult> {
    const { studentId } = input;

    const today = this.getDateString(new Date());
    let streak = this.streaks.get(studentId) || {
      studentId,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: '',
      history: [],
    };

    const yesterday = this.getDateString(new Date(Date.now() - 86400000));

    if (streak.lastActiveDate === today) {
      // Already active today
      return { streak: streak.currentStreak, extended: false };
    }

    if (streak.lastActiveDate === yesterday) {
      // Streak continues
      streak.currentStreak++;
      streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
    } else if (streak.lastActiveDate !== '') {
      // Streak broken
      streak.currentStreak = 1;
    } else {
      // First activity
      streak.currentStreak = 1;
    }

    streak.lastActiveDate = today;
    streak.history.push({ date: today, active: true });

    this.streaks.set(studentId, streak);

    // Celebrate milestones
    if ([7, 30, 100, 365].includes(streak.currentStreak)) {
      await this.celebrateStreak(studentId, streak.currentStreak);
    }

    return {
      streak: streak.currentStreak,
      extended: true,
      longestStreak: streak.longestStreak,
    };
  }

  private getDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private async celebrateStreak(studentId: string, days: number): Promise<void> {
    const messages: Record<number, string> = {
      7: '🔥 1 week streak! You\'re on fire!',
      30: '🏆 30 day streak! You\'re unstoppable!',
      100: '💯 100 days! Legendary dedication!',
      365: '👑 1 YEAR STREAK! You\'re a learning champion!',
    };

    await this.sendNudge({
      studentId,
      nudgeType: 'celebration',
      channel: 'push',
      content: messages[days] || `${days} day streak! Keep going!`,
    }, { agentId: this.config.id });
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Milestone Manager
  // -------------------------------------------------------------------------

  private async checkMilestones(
    input: MilestoneInput,
    context: AgentContext
  ): Promise<MilestoneResult> {
    const { studentId, masteryLevel, questionsCorrect, timeSpent, streakDays } = input;

    const newBadges: Badge[] = [];
    const newAchievements: Achievement[] = [];

    // Check mastery badges
    if (masteryLevel >= 0.8 && !await this.hasBadge(studentId, 'mastery-80')) {
      newBadges.push({
        id: 'mastery-80',
        name: 'Topic Master',
        description: 'Reached 80% mastery in a topic',
        icon: '🎓',
        earnedAt: Date.now(),
      });
    }

    // Check streak badges
    if (streakDays >= 7 && !await this.hasBadge(studentId, 'streak-7')) {
      newBadges.push({
        id: 'streak-7',
        name: 'Week Warrior',
        description: '7 day learning streak',
        icon: '🔥',
        earnedAt: Date.now(),
      });
    }

    // Check question milestones
    const questionMilestones = [10, 50, 100, 500, 1000];
    for (const milestone of questionMilestones) {
      if (questionsCorrect >= milestone && !await this.hasBadge(studentId, `questions-${milestone}`)) {
        newBadges.push({
          id: `questions-${milestone}`,
          name: `${milestone} Questions`,
          description: `Answered ${milestone} questions correctly`,
          icon: milestone >= 500 ? '🌟' : '⭐',
          earnedAt: Date.now(),
        });
      }
    }

    // Store new badges
    for (const badge of newBadges) {
      await this.awardBadge(studentId, badge);
    }

    // Send celebration nudge if new badges earned
    if (newBadges.length > 0) {
      await this.sendNudge({
        studentId,
        nudgeType: 'celebration',
        channel: 'push',
        content: `🎉 You earned: ${newBadges.map(b => `${b.icon} ${b.name}`).join(', ')}`,
      }, { agentId: this.config.id });
    }

    return { badges: newBadges, achievements: newAchievements };
  }

  private async hasBadge(studentId: string, badgeId: string): Promise<boolean> {
    const badges = await this.cache.get<string[]>(`badges:${studentId}`);
    return badges?.includes(badgeId) || false;
  }

  private async awardBadge(studentId: string, badge: Badge): Promise<void> {
    const badges = await this.cache.get<string[]>(`badges:${studentId}`) || [];
    badges.push(badge.id);
    await this.cache.set(`badges:${studentId}`, badges);
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Re-Engager
  // -------------------------------------------------------------------------

  private async reEngage(
    input: ReEngageInput,
    context: AgentContext
  ): Promise<ReEngageResult> {
    const { studentIds } = input;
    const reEngaged: string[] = [];

    for (const studentId of studentIds || []) {
      const engagement = await this.calculateEngagement(studentId);
      
      if (engagement.churnRisk > 0.7) {
        // High-risk: Multi-channel approach
        await this.runReEngagementCampaign(studentId, 'high');
        reEngaged.push(studentId);
      } else if (engagement.churnRisk > 0.5) {
        // Medium-risk: Single nudge
        await this.runReEngagementCampaign(studentId, 'medium');
        reEngaged.push(studentId);
      }
    }

    return { reEngaged, count: reEngaged.length };
  }

  private async runReEngagementCampaign(
    studentId: string,
    intensity: 'high' | 'medium'
  ): Promise<void> {
    const campaigns = {
      high: [
        { channel: 'email' as NudgeChannel, delay: 0 },
        { channel: 'push' as NudgeChannel, delay: 86400000 }, // 1 day
        { channel: 'whatsapp' as NudgeChannel, delay: 172800000 }, // 2 days
      ],
      medium: [
        { channel: 'push' as NudgeChannel, delay: 0 },
      ],
    };

    const messages = [
      'We miss you! 🥺 Your learning journey awaits.',
      'Your streak recovery window is closing soon! 🔥',
      'New content just for you! Come check it out. 📚',
    ];

    for (const [i, step] of campaigns[intensity].entries()) {
      await this.sendNudge({
        studentId,
        nudgeType: 'reminder',
        channel: step.channel,
        content: messages[i % messages.length],
        scheduledFor: Date.now() + step.delay,
      }, { agentId: this.config.id });
    }
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Parent Reporter
  // -------------------------------------------------------------------------

  private async generateParentReport(
    input: ParentReportInput,
    context: AgentContext
  ): Promise<ParentReport> {
    const { studentId, parentEmail, period } = input;

    // Generate report data
    const engagement = await this.calculateEngagement(studentId);
    const streak = this.streaks.get(studentId);
    const badges = await this.cache.get<string[]>(`badges:${studentId}`) || [];

    const report: ParentReport = {
      studentId,
      period: period || 'weekly',
      generatedAt: Date.now(),
      summary: {
        totalSessions: Math.floor(Math.random() * 10) + 5,
        totalMinutes: Math.floor(Math.random() * 300) + 60,
        questionsAnswered: Math.floor(Math.random() * 50) + 10,
        masteryProgress: Math.random() * 0.1 + 0.05, // 5-15% improvement
        currentStreak: streak?.currentStreak || 0,
      },
      highlights: [
        `Completed ${Math.floor(Math.random() * 3) + 1} topics this week`,
        badges.length > 0 ? `Earned ${badges.length} badge(s)` : 'Making steady progress',
        engagement.score > 0.7 ? 'Excellent engagement!' : 'Could benefit from more practice',
      ],
      recommendations: this.getParentRecommendations(engagement),
    };

    // Would send email to parent
    console.log(`[Mentor] Parent report generated for ${studentId}`);

    return report;
  }

  private getParentRecommendations(engagement: EngagementScore): string[] {
    const recommendations: string[] = [];

    if (engagement.factors.frequency < 0.5) {
      recommendations.push('Encourage daily practice, even just 10-15 minutes');
    }
    if (engagement.factors.duration < 0.5) {
      recommendations.push('Try setting a dedicated study time each day');
    }
    if (engagement.factors.progress < 0.5) {
      recommendations.push('Consider reviewing fundamentals before advancing');
    }
    if (engagement.score > 0.8) {
      recommendations.push('Great progress! Consider challenging content');
    }

    return recommendations.length > 0 ? recommendations : ['Keep up the good work!'];
  }

  private async runParentReports(): Promise<void> {
    const students = await this.getActiveStudentIds();
    for (const studentId of students.slice(0, 10)) { // Limit for demo
      await this.invokeSubAgent(
        'ParentReporter',
        { studentId, period: 'weekly' },
        { agentId: this.config.id }
      );
    }
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  private async getActiveStudentIds(): Promise<string[]> {
    // Would fetch from database
    return ['student-1', 'student-2', 'student-3'];
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async checkStudentEngagement(studentId: string): Promise<EngagementScore> {
    return this.calculateEngagement(studentId);
  }

  async sendCustomNudge(studentId: string, message: string, channel: NudgeChannel = 'push'): Promise<void> {
    await this.invokeSubAgent(
      'NudgeEngine',
      { studentId, nudgeType: 'reminder', channel, content: message },
      { agentId: this.config.id }
    );
  }

  getStudentStreak(studentId: string): StreakData | undefined {
    return this.streaks.get(studentId);
  }
}

// ============================================================================
// Types
// ============================================================================

type NudgeType = 'reminder' | 'encouragement' | 'challenge' | 'celebration' | 'help';
type NudgeChannel = 'push' | 'email' | 'whatsapp' | 'sms' | 'in_app';

interface EngagementScore {
  studentId: string;
  score: number;
  churnRisk: number;
  factors: Record<string, number>;
  calculatedAt: number;
}

interface ChurnPredictorInput {
  studentIds?: string[];
}

interface ChurnPrediction {
  studentId: string;
  churnRisk: number;
  factors: Record<string, number>;
  recommendedAction: string;
}

interface NudgeInput {
  studentId: string;
  nudgeType: NudgeType;
  channel: NudgeChannel;
  content: string;
  scheduledFor?: number;
}

interface NudgeResult {
  sent: boolean;
  scheduled: boolean;
  scheduledFor?: number;
}

interface NudgeTask {
  id: string;
  studentId: string;
  nudgeType: NudgeType;
  channel: NudgeChannel;
  content: string;
  scheduledFor?: number;
  status: 'scheduled' | 'sent' | 'failed';
}

interface StreakInput {
  studentId: string;
}

interface StreakData {
  studentId: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  history: Array<{ date: string; active: boolean }>;
}

interface StreakResult {
  streak: number;
  extended: boolean;
  longestStreak?: number;
}

interface MilestoneInput {
  studentId: string;
  masteryLevel: number;
  questionsCorrect: number;
  timeSpent: number;
  streakDays: number;
}

interface MilestoneResult {
  badges: Badge[];
  achievements: Achievement[];
}

interface ReEngageInput {
  studentIds?: string[];
}

interface ReEngageResult {
  reEngaged: string[];
  count: number;
}

interface ParentReportInput {
  studentId: string;
  parentEmail?: string;
  period?: 'daily' | 'weekly' | 'monthly';
}

interface ParentReport {
  studentId: string;
  period: string;
  generatedAt: number;
  summary: {
    totalSessions: number;
    totalMinutes: number;
    questionsAnswered: number;
    masteryProgress: number;
    currentStreak: number;
  };
  highlights: string[];
  recommendations: string[];
}

// ============================================================================
// Export
// ============================================================================

export { MENTOR_CONFIG };
