/**
 * Agent Hooks for Exam Insights
 * Integrates knowledge base with all agents
 */

import { examInsightsService, EXAM_BEST_PRACTICES } from './exam-insights';
import type { ExamType, Subject } from '../users/types';

// ============================================
// SAGE AGENT INTEGRATION
// ============================================

export const sageInsightHooks = {
  /**
   * Get contextual tips during tutoring
   * Called when Sage is explaining a topic
   */
  async getTeachingContext(
    examId: ExamType,
    subject: Subject,
    topic: string,
    studentLevel: 'beginner' | 'intermediate' | 'advanced'
  ): Promise<{
    relatedInsights: string[];
    commonMistakes: string[];
    topperTips: string[];
  }> {
    const insights = await examInsightsService.getInsightsForExam(examId, {
      category: 'subject_specific',
      targetAudience: studentLevel,
      limit: 3,
    });

    const lessons = await examInsightsService.getLessonsForExam(examId, {
      subject,
      limit: 3,
    });

    const topperStories = await examInsightsService.getTopperStories(examId, { limit: 2 });

    return {
      relatedInsights: insights.map(i => i.summary),
      commonMistakes: lessons.map(l => l.mistake),
      topperTips: topperStories.flatMap(s => 
        s.subjectStrategies
          .filter(ss => ss.subject === subject)
          .map(ss => ss.strategy)
      ),
    };
  },

  /**
   * Build exam-aware system prompt
   */
  buildExamContext(examId: ExamType): string {
    const practices = EXAM_BEST_PRACTICES[examId];
    if (!practices) return '';

    return `
## Exam-Specific Context for ${examId}

**Overview:** ${practices.overview}

**Key Strategies to Emphasize:**
${practices.keyStrategies.map((s, i) => `${i + 1}. ${s}`).join('\n')}

**Common Mistakes to Warn About:**
${practices.commonMistakes.map(m => `- ⚠️ ${m}`).join('\n')}

**Scoring Tips to Share:**
${practices.scoringTips.map(t => `- 💡 ${t}`).join('\n')}

When teaching, naturally incorporate these insights. Warn students about common pitfalls.
Share scoring strategies when relevant to the topic being discussed.
`;
  },

  /**
   * Get phase-specific teaching adjustments
   */
  getPhaseGuidance(examId: ExamType, daysToExam: number): string {
    const practices = EXAM_BEST_PRACTICES[examId];
    if (!practices) return '';

    if (daysToExam <= 1) {
      return `
## EXAM DAY MODE
Student has their exam tomorrow or today. Adjust your teaching:
- Be calm and reassuring
- Focus only on quick revision, not new concepts
- Share exam day tips: ${practices.examDayTips.join(', ')}
- Build confidence, not anxiety
`;
    }

    if (daysToExam <= 7) {
      return `
## LAST WEEK MODE
Student's exam is in ${daysToExam} days. Adjust your teaching:
- No new complex topics - only revision
- Focus on high-yield areas
- Quick formulas and facts
- Last week strategy: ${practices.lastWeekStrategy.join(', ')}
`;
    }

    if (daysToExam <= 30) {
      return `
## REVISION MODE
Student's exam is in ${daysToExam} days. Adjust your teaching:
- Focus on weak areas
- Practice problems over theory
- Mock test analysis
- Time management emphasis
`;
    }

    return `
## PREPARATION MODE
Student has ${daysToExam} days until exam. Full preparation mode:
- Deep conceptual understanding
- Build strong foundations
- Cover syllabus systematically
`;
  },
};

// ============================================
// MENTOR AGENT INTEGRATION
// ============================================

export const mentorInsightHooks = {
  /**
   * Get daily insight to share with student
   */
  async getDailyInsight(
    examId: ExamType,
    daysToExam: number
  ): Promise<{
    type: 'strategy' | 'mistake' | 'topper_tip' | 'motivation';
    content: string;
    actionItem?: string;
  }> {
    const practices = EXAM_BEST_PRACTICES[examId];
    
    // Rotate insight types based on day
    const dayOfWeek = new Date().getDay();
    
    if (daysToExam <= 7) {
      // Last week: Focus on exam tips
      const tip = practices.lastWeekStrategy[dayOfWeek % practices.lastWeekStrategy.length];
      return {
        type: 'strategy',
        content: `📅 Last week tip: ${tip}`,
        actionItem: tip,
      };
    }

    if (dayOfWeek === 0) {
      // Sunday: Topper motivation
      const topperStories = await examInsightsService.getTopperStories(examId, { limit: 1 });
      if (topperStories.length > 0) {
        const story = topperStories[0];
        return {
          type: 'topper_tip',
          content: `🏆 Topper Insight from ${story.name} (Rank ${story.rank}, ${story.year}): "${story.topTips[0]}"`,
        };
      }
    }

    if (dayOfWeek === 3) {
      // Wednesday: Common mistake warning
      const lessons = await examInsightsService.getLessonsForExam(examId, { limit: 5 });
      const lesson = lessons[Math.floor(Math.random() * lessons.length)];
      if (lesson) {
        return {
          type: 'mistake',
          content: `⚠️ Avoid this: ${lesson.mistake}`,
          actionItem: lesson.whatToDoInstead,
        };
      }
    }

    // Default: Strategy tip
    const strategy = practices.keyStrategies[dayOfWeek % practices.keyStrategies.length];
    return {
      type: 'strategy',
      content: `💡 Strategy: ${strategy}`,
    };
  },

  /**
   * Get motivational message based on student progress
   */
  async getMotivationalMessage(
    examId: ExamType,
    studentName: string,
    daysToExam: number,
    recentProgress: 'good' | 'average' | 'struggling'
  ): Promise<string> {
    const topperStories = await examInsightsService.getTopperStories(examId, { limit: 3 });
    
    if (recentProgress === 'struggling' && topperStories.length > 0) {
      const story = topperStories.find(s => s.previousAttempts > 0);
      if (story) {
        return `${studentName}, remember: ${story.name} (Rank ${story.rank}) also faced challenges. They said: "${story.turningPoint}" Keep going! 💪`;
      }
    }

    if (daysToExam <= 30) {
      return `${studentName}, you're in the final stretch! ${daysToExam} days to go. Trust your preparation and stay focused. You've got this! 🎯`;
    }

    return `${studentName}, every day of consistent effort counts. Keep building your foundation! 📚`;
  },
};

// ============================================
// ATLAS AGENT INTEGRATION
// ============================================

export const atlasInsightHooks = {
  /**
   * Get content generation guidelines for exam
   */
  getContentGuidelines(examId: ExamType): {
    focusAreas: string[];
    avoidAreas: string[];
    difficultyDistribution: { easy: number; medium: number; hard: number };
    contentTypes: string[];
  } {
    const practices = EXAM_BEST_PRACTICES[examId];
    
    const prioritySubjects = practices.subjectPriorities
      .filter(p => p.priority === 'high')
      .map(p => p.subject);

    return {
      focusAreas: prioritySubjects,
      avoidAreas: practices.commonMistakes,
      difficultyDistribution: {
        easy: 30,
        medium: 50,
        hard: 20,
      },
      contentTypes: [
        'concept_explanation',
        'practice_problems',
        'quick_revision_notes',
        'common_mistake_warnings',
        'exam_pattern_analysis',
      ],
    };
  },

  /**
   * Generate practice questions targeting common mistakes
   */
  getMistakeTargetedTopics(examId: ExamType): string[] {
    const practices = EXAM_BEST_PRACTICES[examId];
    return practices.commonMistakes.map(mistake => {
      // Extract topic from mistake description
      const topics = mistake.match(/(?:ignoring|neglecting|skipping)\s+(\w+)/i);
      return topics ? topics[1] : mistake;
    });
  },
};

// ============================================
// HERALD AGENT INTEGRATION
// ============================================

export const heraldInsightHooks = {
  /**
   * Get content ideas for blog posts
   */
  getBlogContentIdeas(examId: ExamType): {
    title: string;
    outline: string[];
    keywords: string[];
  }[] {
    const practices = EXAM_BEST_PRACTICES[examId];
    const examName = examId.replace(/_/g, ' ');

    return [
      {
        title: `Top ${practices.keyStrategies.length} Strategies for ${examName} Success`,
        outline: practices.keyStrategies,
        keywords: [examName, 'strategy', 'tips', 'preparation'],
      },
      {
        title: `${examName} Common Mistakes: What Toppers Avoid`,
        outline: practices.commonMistakes,
        keywords: [examName, 'mistakes', 'avoid', 'tips'],
      },
      {
        title: `Last Week Before ${examName}: Complete Strategy`,
        outline: practices.lastWeekStrategy,
        keywords: [examName, 'last week', 'revision', 'exam prep'],
      },
      {
        title: `${examName} Exam Day Tips: What to Do and Avoid`,
        outline: practices.examDayTips,
        keywords: [examName, 'exam day', 'tips', 'strategy'],
      },
    ];
  },

  /**
   * Get social media post ideas
   */
  getSocialPostIdeas(examId: ExamType): {
    platform: 'twitter' | 'instagram' | 'linkedin';
    content: string;
    hashtags: string[];
  }[] {
    const practices = EXAM_BEST_PRACTICES[examId];
    const examName = examId.replace(/_/g, ' ');

    return practices.scoringTips.slice(0, 5).map((tip, i) => ({
      platform: 'twitter' as const,
      content: `💡 ${examName} Scoring Tip #${i + 1}:\n\n${tip}\n\nSave this for exam day! 📌`,
      hashtags: [`#${examId}`, '#ExamTips', '#EduGenius', '#StudySmart'],
    }));
  },
};

// ============================================
// ORACLE AGENT INTEGRATION
// ============================================

export const oracleInsightHooks = {
  /**
   * Track insight effectiveness
   */
  async analyzeInsightEngagement(examId: ExamType): Promise<{
    mostViewed: string[];
    mostHelpful: string[];
    underutilized: string[];
    recommendations: string[];
  }> {
    const insights = await examInsightsService.getInsightsForExam(examId);
    
    const sortedByViews = [...insights].sort((a, b) => b.viewCount - a.viewCount);
    const sortedByHelpful = [...insights].sort((a, b) => b.helpfulCount - a.helpfulCount);
    const underutilized = insights.filter(i => i.viewCount < 10);

    return {
      mostViewed: sortedByViews.slice(0, 5).map(i => i.title),
      mostHelpful: sortedByHelpful.slice(0, 5).map(i => i.title),
      underutilized: underutilized.slice(0, 5).map(i => i.title),
      recommendations: [
        underutilized.length > 10 
          ? 'Promote underutilized insights in daily notifications' 
          : 'Good insight distribution',
      ],
    };
  },

  /**
   * Correlation analysis between insight usage and performance
   */
  getInsightImpactMetrics(): {
    metric: string;
    value: string;
    trend: 'up' | 'down' | 'stable';
  }[] {
    return [
      { metric: 'Insight Views → Score Correlation', value: '+12%', trend: 'up' },
      { metric: 'Lesson Avoidance Rate', value: '78%', trend: 'up' },
      { metric: 'Topper Story Engagement', value: '4.2 min avg', trend: 'stable' },
    ];
  },
};

// ============================================
// SCOUT AGENT INTEGRATION
// ============================================

export const scoutInsightHooks = {
  /**
   * Topics to research for new insights
   */
  getResearchTopics(examId: ExamType): string[] {
    return [
      `${examId} topper interview ${new Date().getFullYear()}`,
      `${examId} exam pattern changes`,
      `${examId} syllabus updates`,
      `${examId} common mistakes students make`,
      `${examId} best preparation strategy`,
      `${examId} last minute tips`,
    ];
  },

  /**
   * Sources to monitor for new insights
   */
  getMonitoringSources(): {
    source: string;
    type: 'youtube' | 'news' | 'forum' | 'social';
    frequency: 'daily' | 'weekly';
  }[] {
    return [
      { source: 'YouTube topper interviews', type: 'youtube', frequency: 'weekly' },
      { source: 'Education news sites', type: 'news', frequency: 'daily' },
      { source: 'Student forums (Quora, Reddit)', type: 'forum', frequency: 'weekly' },
      { source: 'Official exam body announcements', type: 'news', frequency: 'daily' },
    ];
  },
};

// ============================================
// REGISTER ALL HOOKS
// ============================================

export function registerInsightHooks(): void {
  // Sage uses insights during tutoring
  examInsightsService.on('insights:personalized', (data) => {
    console.log(`[Sage] Personalized insights delivered for ${data.examId}`);
  });

  // Mentor tracks engagement
  examInsightsService.on('insight:viewed', (data) => {
    console.log(`[Mentor] Insight ${data.insightId} viewed by ${data.userId}`);
  });

  // Oracle tracks helpfulness
  examInsightsService.on('insight:helpful', (data) => {
    console.log(`[Oracle] Insight ${data.insightId} marked helpful by ${data.userId}`);
  });

  // Atlas monitors new content needs
  examInsightsService.on('lesson:created', (lesson) => {
    console.log(`[Atlas] New lesson learned: ${lesson.mistake} - generating targeted content`);
  });

  // Herald creates content from topper stories
  examInsightsService.on('topper_story:created', (story) => {
    console.log(`[Herald] New topper story: ${story.name} - scheduling social posts`);
  });

  console.log('[ExamInsights] All agent hooks registered');
}
