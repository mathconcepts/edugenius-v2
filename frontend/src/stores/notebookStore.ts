/**
 * Notebook Store - Central state management for the enhanced notebook
 * Tracks all practice problems, chat interactions, learning plans, and progress
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  PracticeProblem,
  ChatInteraction,
  TopicProgress,
  LearningPlan,
  NotebookEntry,
  RevisionSession,
  NotebookAnalytics,
  NotebookFilters,
  NotebookSortOptions,
  ProblemStatus,
  TopicStatus,
} from '@/types/notebook';

interface NotebookState {
  // ============================================
  // DATA
  // ============================================
  problems: PracticeProblem[];
  chatInteractions: ChatInteraction[];
  topicProgress: TopicProgress[];
  learningPlans: LearningPlan[];
  entries: NotebookEntry[];
  revisionSessions: RevisionSession[];
  
  // Current session
  activeRevisionSession: RevisionSession | null;
  activeLearningPlan: LearningPlan | null;
  
  // Filters & view state
  filters: NotebookFilters;
  sortOptions: NotebookSortOptions;
  currentView: 'all' | 'problems' | 'notes' | 'topics' | 'plans' | 'revision' | 'chat' | 'analytics';
  
  // ============================================
  // PROBLEM ACTIONS
  // ============================================
  addProblem: (problem: Omit<PracticeProblem, 'id'>) => string;
  updateProblem: (id: string, updates: Partial<PracticeProblem>) => void;
  updateProblemStatus: (id: string, status: ProblemStatus, answer?: string) => void;
  starProblem: (id: string) => void;
  addProblemNote: (id: string, note: string) => void;
  markForReview: (id: string, nextReviewDate: Date) => void;
  
  // ============================================
  // CHAT INTERACTION ACTIONS
  // ============================================
  addChatInteraction: (interaction: Omit<ChatInteraction, 'id'>) => string;
  extractProblemsFromChat: (interactionId: string, problems: Omit<PracticeProblem, 'id'>[]) => void;
  markChatHelpful: (id: string, helpful: boolean) => void;
  
  // ============================================
  // TOPIC PROGRESS ACTIONS
  // ============================================
  updateTopicProgress: (topicId: string, updates: Partial<TopicProgress>) => void;
  markTopicStatus: (topicId: string, status: TopicStatus) => void;
  scheduleTopicRevision: (topicId: string, date: Date) => void;
  recalculateTopicProgress: (topicId: string) => void;
  
  // ============================================
  // LEARNING PLAN ACTIONS
  // ============================================
  createLearningPlan: (plan: Omit<LearningPlan, 'id' | 'progressPercent' | 'daysCompleted'>) => string;
  updateLearningPlan: (id: string, updates: Partial<LearningPlan>) => void;
  setActiveLearningPlan: (id: string | null) => void;
  completeScheduledTopic: (planId: string, topicId: string) => void;
  
  // ============================================
  // NOTEBOOK ENTRY ACTIONS
  // ============================================
  addEntry: (entry: Omit<NotebookEntry, 'id' | 'timestamp'>) => string;
  updateEntry: (id: string, updates: Partial<NotebookEntry>) => void;
  deleteEntry: (id: string) => void;
  starEntry: (id: string) => void;
  
  // ============================================
  // REVISION SESSION ACTIONS
  // ============================================
  startRevisionSession: (type: RevisionSession['sessionType'], problemIds: string[]) => string;
  recordRevisionAttempt: (problemId: string, correct: boolean) => void;
  completeRevisionSession: () => void;
  
  // ============================================
  // FILTER & VIEW ACTIONS
  // ============================================
  setFilters: (filters: NotebookFilters) => void;
  clearFilters: () => void;
  setSortOptions: (options: NotebookSortOptions) => void;
  setCurrentView: (view: NotebookState['currentView']) => void;
  
  // ============================================
  // COMPUTED GETTERS
  // ============================================
  getFilteredProblems: () => PracticeProblem[];
  getPendingReviews: () => PracticeProblem[];
  getWeakTopics: () => TopicProgress[];
  getMasteredTopics: () => TopicProgress[];
  getTodaySchedule: () => LearningPlan['scheduledTopics'];
  getAnalytics: () => NotebookAnalytics;
  
  // ============================================
  // SYNC & IMPORT
  // ============================================
  syncFromChat: (sessionId: string, messages: Array<{ role: string; content: string; timestamp: Date }>) => void;
  importFromChannel: (channel: string, data: unknown) => void;
}

// Generate unique ID
const generateId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// Calculate SM-2 algorithm values
const calculateSM2 = (grade: number, easeFactor: number, interval: number, repetitions: number) => {
  let newEF = easeFactor;
  let newInterval = interval;
  let newReps = repetitions;
  
  if (grade >= 3) {
    if (newReps === 0) {
      newInterval = 1;
    } else if (newReps === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * easeFactor);
    }
    newReps += 1;
    newEF = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  } else {
    newReps = 0;
    newInterval = 1;
  }
  
  if (newEF < 1.3) newEF = 1.3;
  
  return { easeFactor: newEF, interval: newInterval, repetitions: newReps };
};

export const useNotebookStore = create<NotebookState>()(
  persist(
    (set, get) => ({
      // ============================================
      // INITIAL STATE
      // ============================================
      problems: [],
      chatInteractions: [],
      topicProgress: [],
      learningPlans: [],
      entries: [],
      revisionSessions: [],
      activeRevisionSession: null,
      activeLearningPlan: null,
      filters: {},
      sortOptions: { field: 'timestamp', direction: 'desc' },
      currentView: 'all',
      
      // ============================================
      // PROBLEM ACTIONS
      // ============================================
      addProblem: (problem) => {
        const id = generateId();
        const newProblem: PracticeProblem = {
          ...problem,
          id,
          attemptCount: 0,
          firstAttemptedAt: new Date(),
          lastAttemptedAt: new Date(),
          timeSpentSeconds: 0,
          hintsUsed: 0,
          easeFactor: 2.5,
          interval: 0,
          isStarred: false,
          tags: problem.tags || [],
          relatedConcepts: problem.relatedConcepts || [],
          similarProblems: [],
          hintsAvailable: problem.hintsAvailable || [],
        };
        set((state) => ({ problems: [newProblem, ...state.problems] }));
        return id;
      },
      
      updateProblem: (id, updates) => {
        set((state) => ({
          problems: state.problems.map((p) =>
            p.id === id ? { ...p, ...updates, lastAttemptedAt: new Date() } : p
          ),
        }));
      },
      
      updateProblemStatus: (id, status, answer) => {
        set((state) => ({
          problems: state.problems.map((p) => {
            if (p.id !== id) return p;
            
            const updates: Partial<PracticeProblem> = {
              status,
              lastAttemptedAt: new Date(),
              attemptCount: p.attemptCount + 1,
            };
            
            if (answer) updates.studentAnswer = answer;
            if (status === 'solved' || status === 'mastered') {
              updates.solvedAt = new Date();
              // Update spaced repetition
              const sm2 = calculateSM2(4, p.easeFactor, p.interval, 0);
              updates.easeFactor = sm2.easeFactor;
              updates.interval = sm2.interval;
              updates.nextReviewDate = new Date(Date.now() + sm2.interval * 24 * 60 * 60 * 1000);
            } else if (status === 'incorrect') {
              const sm2 = calculateSM2(1, p.easeFactor, p.interval, 0);
              updates.easeFactor = sm2.easeFactor;
              updates.interval = sm2.interval;
              updates.nextReviewDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            }
            
            return { ...p, ...updates };
          }),
        }));
      },
      
      starProblem: (id) => {
        set((state) => ({
          problems: state.problems.map((p) =>
            p.id === id ? { ...p, isStarred: !p.isStarred } : p
          ),
        }));
      },
      
      addProblemNote: (id, note) => {
        set((state) => ({
          problems: state.problems.map((p) =>
            p.id === id ? { ...p, notes: note } : p
          ),
        }));
      },
      
      markForReview: (id, nextReviewDate) => {
        set((state) => ({
          problems: state.problems.map((p) =>
            p.id === id ? { ...p, status: 'needs_review', nextReviewDate } : p
          ),
        }));
      },
      
      // ============================================
      // CHAT INTERACTION ACTIONS
      // ============================================
      addChatInteraction: (interaction) => {
        const id = generateId();
        set((state) => ({
          chatInteractions: [
            { ...interaction, id, extractedProblems: [] },
            ...state.chatInteractions,
          ],
        }));
        return id;
      },
      
      extractProblemsFromChat: (interactionId, problems) => {
        const problemIds: string[] = [];
        const state = get();
        
        problems.forEach((problem) => {
          const id = state.addProblem({
            ...problem,
            source: 'chatbot',
            sourceId: interactionId,
          });
          problemIds.push(id);
        });
        
        set((state) => ({
          chatInteractions: state.chatInteractions.map((ci) =>
            ci.id === interactionId
              ? { ...ci, extractedProblems: [...ci.extractedProblems, ...problemIds] }
              : ci
          ),
        }));
      },
      
      markChatHelpful: (id, helpful) => {
        set((state) => ({
          chatInteractions: state.chatInteractions.map((ci) =>
            ci.id === id ? { ...ci, wasHelpful: helpful } : ci
          ),
        }));
      },
      
      // ============================================
      // TOPIC PROGRESS ACTIONS
      // ============================================
      updateTopicProgress: (topicId, updates) => {
        set((state) => {
          const existing = state.topicProgress.find((t) => t.id === topicId);
          if (existing) {
            return {
              topicProgress: state.topicProgress.map((t) =>
                t.id === topicId ? { ...t, ...updates } : t
              ),
            };
          }
          return {
            topicProgress: [
              ...state.topicProgress,
              {
                id: topicId,
                subject: '',
                topic: '',
                subtopics: [],
                status: 'in_progress',
                progressPercent: 0,
                totalProblems: 0,
                solvedProblems: 0,
                correctProblems: 0,
                incorrectProblems: 0,
                skippedProblems: 0,
                timeSpentMinutes: 0,
                revisionCount: 0,
                confidenceScore: 0,
                masteryScore: 0,
                weakAreas: [],
                relatedTopics: [],
                prerequisites: [],
                isPrerequisiteMet: true,
                ...updates,
              } as TopicProgress,
            ],
          };
        });
      },
      
      markTopicStatus: (topicId, status) => {
        set((state) => ({
          topicProgress: state.topicProgress.map((t) =>
            t.id === topicId
              ? {
                  ...t,
                  status,
                  lastStudiedAt: new Date(),
                  ...(status === 'revised' ? { lastRevisionAt: new Date(), revisionCount: t.revisionCount + 1 } : {}),
                }
              : t
          ),
        }));
      },
      
      scheduleTopicRevision: (topicId, date) => {
        set((state) => ({
          topicProgress: state.topicProgress.map((t) =>
            t.id === topicId ? { ...t, nextRevisionDate: date, status: 'pending_revision' } : t
          ),
        }));
      },
      
      recalculateTopicProgress: (topicId) => {
        const state = get();
        const topicProblems = state.problems.filter((p) => p.topic === topicId);
        
        if (topicProblems.length === 0) return;
        
        const solved = topicProblems.filter((p) => p.status === 'solved' || p.status === 'mastered').length;
        const correct = topicProblems.filter((p) => p.status === 'solved' || p.status === 'mastered').length;
        const incorrect = topicProblems.filter((p) => p.status === 'incorrect').length;
        const skipped = topicProblems.filter((p) => p.status === 'skipped').length;
        const totalTime = topicProblems.reduce((sum, p) => sum + p.timeSpentSeconds, 0);
        
        const accuracy = topicProblems.length > 0 ? (correct / (correct + incorrect)) * 100 : 0;
        const progress = (solved / topicProblems.length) * 100;
        
        let status: TopicStatus = 'in_progress';
        if (progress === 100 && accuracy >= 90) status = 'mastered';
        else if (progress >= 80) status = 'needs_practice';
        else if (progress === 0) status = 'not_started';
        
        get().updateTopicProgress(topicId, {
          totalProblems: topicProblems.length,
          solvedProblems: solved,
          correctProblems: correct,
          incorrectProblems: incorrect,
          skippedProblems: skipped,
          progressPercent: progress,
          masteryScore: accuracy,
          timeSpentMinutes: Math.round(totalTime / 60),
          status,
        });
      },
      
      // ============================================
      // LEARNING PLAN ACTIONS
      // ============================================
      createLearningPlan: (plan) => {
        const id = generateId();
        const totalDays = Math.ceil(
          (plan.endDate.getTime() - plan.startDate.getTime()) / (24 * 60 * 60 * 1000)
        );
        set((state) => ({
          learningPlans: [
            { ...plan, id, progressPercent: 0, daysCompleted: 0, totalDays },
            ...state.learningPlans,
          ],
        }));
        return id;
      },
      
      updateLearningPlan: (id, updates) => {
        set((state) => ({
          learningPlans: state.learningPlans.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },
      
      setActiveLearningPlan: (id) => {
        const plan = id ? get().learningPlans.find((p) => p.id === id) || null : null;
        set({ activeLearningPlan: plan });
      },
      
      completeScheduledTopic: (planId, topicId) => {
        set((state) => ({
          learningPlans: state.learningPlans.map((plan) => {
            if (plan.id !== planId) return plan;
            const updatedTopics = plan.scheduledTopics.map((t) =>
              t.id === topicId ? { ...t, status: 'completed' as const } : t
            );
            const completedCount = updatedTopics.filter((t) => t.status === 'completed').length;
            return {
              ...plan,
              scheduledTopics: updatedTopics,
              progressPercent: (completedCount / updatedTopics.length) * 100,
            };
          }),
        }));
      },
      
      // ============================================
      // NOTEBOOK ENTRY ACTIONS
      // ============================================
      addEntry: (entry) => {
        const id = generateId();
        set((state) => ({
          entries: [
            { ...entry, id, timestamp: new Date(), aiProcessed: false, isStarred: false, tags: entry.tags || [] },
            ...state.entries,
          ],
        }));
        return id;
      },
      
      updateEntry: (id, updates) => {
        set((state) => ({
          entries: state.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        }));
      },
      
      deleteEntry: (id) => {
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        }));
      },
      
      starEntry: (id) => {
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === id ? { ...e, isStarred: !e.isStarred } : e
          ),
        }));
      },
      
      // ============================================
      // REVISION SESSION ACTIONS
      // ============================================
      startRevisionSession: (type, problemIds) => {
        const id = generateId();
        const session: RevisionSession = {
          id,
          startedAt: new Date(),
          problemIds,
          completedProblemIds: [],
          correctCount: 0,
          incorrectCount: 0,
          skippedCount: 0,
          topicsCovered: [],
          sessionType: type,
        };
        set({ activeRevisionSession: session });
        return id;
      },
      
      recordRevisionAttempt: (problemId, correct) => {
        set((state) => {
          if (!state.activeRevisionSession) return state;
          
          const session = state.activeRevisionSession;
          const problem = state.problems.find((p) => p.id === problemId);
          const topics = problem ? [...new Set([...session.topicsCovered, problem.topic])] : session.topicsCovered;
          
          return {
            activeRevisionSession: {
              ...session,
              completedProblemIds: [...session.completedProblemIds, problemId],
              correctCount: correct ? session.correctCount + 1 : session.correctCount,
              incorrectCount: !correct ? session.incorrectCount + 1 : session.incorrectCount,
              topicsCovered: topics,
            },
          };
        });
        
        // Also update the problem
        get().updateProblemStatus(problemId, correct ? 'solved' : 'incorrect');
      },
      
      completeRevisionSession: () => {
        const session = get().activeRevisionSession;
        if (!session) return;
        
        set((state) => ({
          revisionSessions: [
            { ...session, completedAt: new Date() },
            ...state.revisionSessions,
          ],
          activeRevisionSession: null,
        }));
      },
      
      // ============================================
      // FILTER & VIEW ACTIONS
      // ============================================
      setFilters: (filters) => set({ filters }),
      clearFilters: () => set({ filters: {} }),
      setSortOptions: (sortOptions) => set({ sortOptions }),
      setCurrentView: (currentView) => set({ currentView }),
      
      // ============================================
      // COMPUTED GETTERS
      // ============================================
      getFilteredProblems: () => {
        const { problems, filters, sortOptions } = get();
        let filtered = [...problems];
        
        if (filters.subjects?.length) {
          filtered = filtered.filter((p) => filters.subjects!.includes(p.subject));
        }
        if (filters.topics?.length) {
          filtered = filtered.filter((p) => filters.topics!.includes(p.topic));
        }
        if (filters.difficulty?.length) {
          filtered = filtered.filter((p) => filters.difficulty!.includes(p.difficulty));
        }
        if (filters.status?.length) {
          filtered = filtered.filter((p) => filters.status!.includes(p.status));
        }
        if (filters.source?.length) {
          filtered = filtered.filter((p) => filters.source!.includes(p.source));
        }
        if (filters.isStarred !== undefined) {
          filtered = filtered.filter((p) => p.isStarred === filters.isStarred);
        }
        if (filters.needsReview) {
          const now = new Date();
          filtered = filtered.filter(
            (p) => p.nextReviewDate && new Date(p.nextReviewDate) <= now
          );
        }
        if (filters.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          filtered = filtered.filter(
            (p) =>
              p.question.toLowerCase().includes(query) ||
              p.topic.toLowerCase().includes(query) ||
              p.subject.toLowerCase().includes(query)
          );
        }
        if (filters.dateRange) {
          filtered = filtered.filter(
            (p) =>
              new Date(p.firstAttemptedAt) >= filters.dateRange!.start &&
              new Date(p.firstAttemptedAt) <= filters.dateRange!.end
          );
        }
        
        // Sort
        filtered.sort((a, b) => {
          let comparison = 0;
          switch (sortOptions.field) {
            case 'timestamp':
              comparison = new Date(b.lastAttemptedAt).getTime() - new Date(a.lastAttemptedAt).getTime();
              break;
            case 'difficulty':
              const diffOrder = { easy: 1, medium: 2, hard: 3, olympiad: 4 };
              comparison = diffOrder[a.difficulty] - diffOrder[b.difficulty];
              break;
            case 'topic':
              comparison = a.topic.localeCompare(b.topic);
              break;
            case 'timeSpent':
              comparison = b.timeSpentSeconds - a.timeSpentSeconds;
              break;
          }
          return sortOptions.direction === 'desc' ? comparison : -comparison;
        });
        
        return filtered;
      },
      
      getPendingReviews: () => {
        const now = new Date();
        return get().problems.filter(
          (p) => p.nextReviewDate && new Date(p.nextReviewDate) <= now
        );
      },
      
      getWeakTopics: () => {
        return get().topicProgress.filter((t) => t.masteryScore < 60 || t.status === 'needs_practice');
      },
      
      getMasteredTopics: () => {
        return get().topicProgress.filter((t) => t.status === 'mastered' || t.masteryScore >= 90);
      },
      
      getTodaySchedule: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const activePlan = get().activeLearningPlan;
        if (!activePlan) return [];
        
        return activePlan.scheduledTopics.filter((t) => {
          const date = new Date(t.scheduledDate);
          return date >= today && date < tomorrow;
        });
      },
      
      getAnalytics: () => {
        const { problems, topicProgress } = get();
        
        const solved = problems.filter((p) => p.status === 'solved' || p.status === 'mastered');
        const totalTime = problems.reduce((sum, p) => sum + p.timeSpentSeconds, 0);
        const correct = problems.filter((p) => p.status === 'solved' || p.status === 'mastered').length;
        const attempted = problems.filter((p) => p.attemptCount > 0).length;
        
        // By difficulty
        const byDifficulty = {} as NotebookAnalytics['byDifficulty'];
        (['easy', 'medium', 'hard', 'olympiad'] as const).forEach((diff) => {
          const diffProblems = problems.filter((p) => p.difficulty === diff);
          const diffSolved = diffProblems.filter((p) => p.status === 'solved' || p.status === 'mastered');
          byDifficulty[diff] = {
            total: diffProblems.length,
            solved: diffSolved.length,
            accuracy: diffProblems.length > 0 ? (diffSolved.length / diffProblems.length) * 100 : 0,
            avgTimeSeconds: diffProblems.length > 0
              ? diffProblems.reduce((sum, p) => sum + p.timeSpentSeconds, 0) / diffProblems.length
              : 0,
          };
        });
        
        // By subject
        const subjects = [...new Set(problems.map((p) => p.subject))];
        const bySubject = {} as NotebookAnalytics['bySubject'];
        subjects.forEach((subj) => {
          const subjProblems = problems.filter((p) => p.subject === subj);
          const subjSolved = subjProblems.filter((p) => p.status === 'solved' || p.status === 'mastered');
          const subjTopics = topicProgress.filter((t) => t.subject === subj);
          bySubject[subj] = {
            total: subjProblems.length,
            solved: subjSolved.length,
            accuracy: subjProblems.length > 0 ? (subjSolved.length / subjProblems.length) * 100 : 0,
            masteryScore: subjTopics.length > 0
              ? subjTopics.reduce((sum, t) => sum + t.masteryScore, 0) / subjTopics.length
              : 0,
          };
        });
        
        // Time by day
        const timeByDay: Record<string, number> = {};
        problems.forEach((p) => {
          const day = new Date(p.lastAttemptedAt).toISOString().split('T')[0];
          timeByDay[day] = (timeByDay[day] || 0) + p.timeSpentSeconds / 60;
        });
        
        // Time by subject
        const timeBySubject: Record<string, number> = {};
        problems.forEach((p) => {
          timeBySubject[p.subject] = (timeBySubject[p.subject] || 0) + p.timeSpentSeconds / 60;
        });
        
        // Weak and strong topics
        const weakTopics = topicProgress
          .filter((t) => t.masteryScore < 60)
          .map((t) => t.topic);
        const strongTopics = topicProgress
          .filter((t) => t.masteryScore >= 80)
          .map((t) => t.topic);
        
        return {
          totalProblems: problems.length,
          totalSolved: solved.length,
          totalTimeMinutes: Math.round(totalTime / 60),
          overallAccuracy: attempted > 0 ? (correct / attempted) * 100 : 0,
          currentStreak: 0, // TODO: Calculate actual streak
          longestStreak: 0,
          byDifficulty,
          bySubject,
          timeByDay,
          timeBySubject,
          weakTopics,
          strongTopics,
          focusAreas: weakTopics.slice(0, 3),
          nextSteps: [
            weakTopics.length > 0 ? `Focus on ${weakTopics[0]}` : 'Keep practicing!',
            'Complete pending reviews',
            'Try some challenging problems',
          ],
        };
      },
      
      // ============================================
      // SYNC & IMPORT
      // ============================================
      syncFromChat: (sessionId, messages) => {
        const state = get();
        
        messages.forEach((msg, index) => {
          if (msg.role === 'user') {
            const nextMsg = messages[index + 1];
            if (nextMsg && nextMsg.role === 'assistant') {
              state.addChatInteraction({
                sessionId,
                channel: 'app',
                agentType: 'sage',
                userMessage: msg.content,
                aiResponse: nextMsg.content,
                interactionType: 'question',
                timestamp: msg.timestamp,
                responseTimeMs: 0,
                followUpAsked: false,
                extractedProblems: [],
              });
            }
          }
        });
      },
      
      importFromChannel: (channel, data) => {
        // Placeholder for channel-specific import logic
        console.log(`Importing from ${channel}:`, data);
      },
    }),
    {
      name: 'edugenius-notebook',
      partialize: (state) => ({
        problems: state.problems,
        chatInteractions: state.chatInteractions,
        topicProgress: state.topicProgress,
        learningPlans: state.learningPlans,
        entries: state.entries,
        revisionSessions: state.revisionSessions,
      }),
    }
  )
);
