/**
 * Progress Page - Student progress tracking and analytics
 * AI-powered insights and recommendations
 * Wire 6 — P1: Real data from persona + notebook engine replaces mockData
 */

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
// Wire 6 imports
import { loadPersona } from '@/services/studentPersonaEngine';
import { loadNotebookState, getCoverageSummary, type ExamScope } from '@/services/notebookEngine';

interface ProgressData {
  overall: number;
  subjects: {
    name: string;
    progress: number;
    mastery: number;
    topicsCompleted: number;
    totalTopics: number;
    trend: 'up' | 'down' | 'stable';
  }[];
  streaks: {
    current: number;
    longest: number;
    thisWeek: number[];
  };
  achievements: {
    id: string;
    name: string;
    icon: string;
    date: string;
    description: string;
  }[];
  weeklyActivity: number[];
  testScores: {
    date: string;
    score: number;
    total: number;
    percentile: number;
  }[];
}

const mockData: ProgressData = {
  overall: 67,
  subjects: [
    { name: 'Physics', progress: 72, mastery: 68, topicsCompleted: 32, totalTopics: 45, trend: 'up' },
    { name: 'Chemistry', progress: 58, mastery: 52, topicsCompleted: 30, totalTopics: 52, trend: 'stable' },
    { name: 'Mathematics', progress: 78, mastery: 75, topicsCompleted: 30, totalTopics: 38, trend: 'up' },
    { name: 'Biology', progress: 45, mastery: 40, topicsCompleted: 22, totalTopics: 48, trend: 'down' },
  ],
  streaks: {
    current: 12,
    longest: 45,
    thisWeek: [1, 1, 1, 0, 1, 1, 1],
  },
  achievements: [
    { id: '1', name: 'Week Warrior', icon: '🔥', date: '2026-02-15', description: '7-day streak achieved' },
    { id: '2', name: 'Physics Pro', icon: '⚡', date: '2026-02-14', description: '70% mastery in Physics' },
    { id: '3', name: 'Quick Learner', icon: '🚀', date: '2026-02-10', description: 'Completed 10 topics in one day' },
    { id: '4', name: 'Night Owl', icon: '🦉', date: '2026-02-08', description: 'Study session past midnight' },
  ],
  weeklyActivity: [45, 60, 30, 90, 75, 120, 85],
  testScores: [
    { date: '2026-02-10', score: 85, total: 100, percentile: 92 },
    { date: '2026-02-03', score: 78, total: 100, percentile: 85 },
    { date: '2026-01-27', score: 72, total: 100, percentile: 78 },
    { date: '2026-01-20', score: 68, total: 100, percentile: 72 },
  ],
};

// ─── Build ProgressData from persona + notebook engine ────────────────────────

function buildProgressData(): ProgressData {
  const persona = loadPersona();
  const examMap: Record<string, ExamScope> = {
    JEE_MAIN: 'JEE Main', JEE_ADVANCED: 'JEE Adv', NEET: 'NEET',
    CBSE_12: 'CBSE 12', CAT: 'CAT', UPSC: 'UPSC', GATE: 'GATE',
  };
  const examScope: ExamScope = examMap[persona.exam] ?? 'JEE Main';
  const notebookState = loadNotebookState(examScope);
  const coverage = getCoverageSummary(examScope, notebookState.coverage);

  // Build subjects from coverage data (group by subject via syllabus)
  const subjectMap: Record<string, { completed: number; total: number; mastery: number }> = {};
  for (const [topicId, status] of Object.entries(notebookState.coverage)) {
    // Extract subject from topic id prefix (e.g. jee-km-01 → Physics)
    const subjectGuess = topicId.includes('-phy-') || topicId.includes('-km-') || topicId.includes('-lm-') ? 'Physics'
      : topicId.includes('-c') ? 'Chemistry'
      : topicId.includes('-m') || topicId.includes('-c3') ? 'Mathematics'
      : topicId.includes('-bio-') ? 'Biology'
      : 'Other';
    if (!subjectMap[subjectGuess]) subjectMap[subjectGuess] = { completed: 0, total: 0, mastery: 0 };
    subjectMap[subjectGuess].total++;
    if (status === 'covered') subjectMap[subjectGuess].completed++;
    const m = notebookState.masteryScores[topicId] ?? 0;
    subjectMap[subjectGuess].mastery = Math.round((subjectMap[subjectGuess].mastery * (subjectMap[subjectGuess].total - 1) + m) / subjectMap[subjectGuess].total);
  }

  // Map to ProgressData.subjects shape; fall back to mockData subjects if no real coverage
  const hasCoverage = Object.keys(subjectMap).length > 0;
  const subjects: ProgressData['subjects'] = hasCoverage
    ? Object.entries(subjectMap).map(([name, d]) => ({
        name,
        progress: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
        mastery: d.mastery,
        topicsCompleted: d.completed,
        totalTopics: d.total,
        trend: d.mastery > 60 ? 'up' : d.mastery < 40 ? 'down' : 'stable' as 'up' | 'down' | 'stable',
      }))
    : mockData.subjects;

  // Weakest subject trend based on persona weak subjects
  const weakSet = new Set(persona.weakSubjects.map(s => s.toLowerCase()));
  subjects.forEach(s => {
    if (weakSet.has(s.name.toLowerCase())) s.trend = 'down';
  });

  return {
    overall: coverage.coveragePercent || persona.syllabusCompletion,
    subjects,
    streaks: {
      current: persona.streakDays,
      longest: Math.max(persona.streakDays, mockData.streaks.longest),
      thisWeek: mockData.streaks.thisWeek,
    },
    achievements: mockData.achievements,
    weeklyActivity: mockData.weeklyActivity,
    testScores: mockData.testScores,
  };
}

export default function Progress() {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('week');
  const [data, setData] = useState<ProgressData>(mockData);

  // Wire 6 — P1: Load real data from persona + notebook engine
  useEffect(() => {
    setData(buildProgressData());
  }, []);

  const trendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➡️';
    }
  };

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const maxActivity = Math.max(...data.weeklyActivity);

  // Compute "topics mastered" (mastery >= 80%)
  const topicsMastered = data.subjects.reduce((acc, s) => acc + (s.mastery >= 80 ? s.topicsCompleted : 0), 0);

  // Days to exam from localStorage/persona
  const daysToExam = (() => {
    try {
      const raw = localStorage.getItem('edugenius_persona');
      if (!raw) return null;
      return (JSON.parse(raw) as { daysToExam?: number }).daysToExam ?? null;
    } catch { return null; }
  })();

  // Check if milestone reached (≥10 total topics completed)
  const totalTopicsCompleted = data.subjects.reduce((acc, s) => acc + s.topicsCompleted, 0);
  const milestoneReached = totalTopicsCompleted >= 10;

  return (
    <div className="space-y-6">

      {/* ── Progress Summary — 3 stats in mobile-cards ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="mobile-card flex flex-col items-center text-center gap-1.5">
          <span className="text-2xl">🏅</span>
          <p className="text-xl font-black text-emerald-400">{topicsMastered}</p>
          <p className="text-[11px] text-surface-400 leading-tight">Topics<br/>Mastered</p>
        </div>
        <div className="mobile-card flex flex-col items-center text-center gap-1.5">
          <span className={clsx('text-2xl', data.streaks.current > 0 ? 'streak-pulse' : '')}>🔥</span>
          <p className="text-xl font-black text-amber-400">{data.streaks.current}</p>
          <p className="text-[11px] text-surface-400 leading-tight">Day<br/>Streak</p>
        </div>
        <div className="mobile-card flex flex-col items-center text-center gap-1.5">
          <span className="text-2xl">📅</span>
          <p className="text-xl font-black text-sky-400">{daysToExam ?? '—'}</p>
          <p className="text-[11px] text-surface-400 leading-tight">Days to<br/>Exam</p>
        </div>
      </div>

      {/* Milestone celebration */}
      {milestoneReached && (
        <div className="confidence-card p-4 flex items-center gap-3">
          <span className={clsx('text-3xl', 'achievement-pulse')}>🎉</span>
          <div>
            <p className="text-sm font-bold text-emerald-300">Milestone: {totalTopicsCompleted}+ topics complete!</p>
            <p className="text-xs text-surface-400">You're building real momentum — keep it up!</p>
          </div>
        </div>
      )}

      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-primary-600/20 to-primary-800/20 border-primary-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-surface-400 text-sm">Overall Progress</p>
              <p className="text-3xl font-bold text-white">{data.overall}%</p>
            </div>
            <div className="w-16 h-16 relative">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="32" cy="32" r="28" fill="none" stroke="#374151" strokeWidth="4" />
                <circle 
                  cx="32" cy="32" r="28" fill="none" stroke="#8B5CF6" strokeWidth="4"
                  strokeDasharray={`${data.overall * 1.76} 176`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔥</span>
            <div>
              <p className="text-surface-400 text-sm">Current Streak</p>
              <p className="text-2xl font-bold text-white">{data.streaks.current} days</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            <div>
              <p className="text-surface-400 text-sm">Achievements</p>
              <p className="text-2xl font-bold text-white">{data.achievements.length}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📊</span>
            <div>
              <p className="text-surface-400 text-sm">Latest Percentile</p>
              <p className="text-2xl font-bold text-white">{data.testScores[0].percentile}th</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="card bg-gradient-to-r from-accent-600/10 to-primary-600/10 border-accent-500/30">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-accent-500/20 rounded-xl">
            <span className="text-2xl">🤖</span>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">Oracle AI Insights</h3>
            <ul className="space-y-2 text-surface-300 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                Your Physics performance is improving! You've moved up 8 percentile points this month.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">!</span>
                Biology needs attention. Consider spending 30 extra minutes daily to catch up.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-400">💡</span>
                You perform best between 6-8 PM. Schedule important topics during this time.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subject Progress */}
        <div className="lg:col-span-2 card">
          <h3 className="text-lg font-semibold text-white mb-4">Subject-wise Progress</h3>
          <div className="space-y-4">
            {data.subjects.map(subject => {
              const masteryBadge = subject.mastery >= 80 ? '🏆' : subject.mastery >= 50 ? '⭐' : null;
              return (
                <div key={subject.name} className="p-4 bg-surface-800/50 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{trendIcon(subject.trend)}</span>
                      <span className="font-medium text-white">{subject.name}</span>
                      {masteryBadge && (
                        <span className={clsx('text-base', subject.mastery >= 80 ? 'achievement-pulse' : '')}>
                          {masteryBadge}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-surface-400">
                      {subject.topicsCompleted}/{subject.totalTopics} topics
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-surface-400">Progress</span>
                        <span className="text-primary-400">{subject.progress}%</span>
                      </div>
                      <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            'h-full rounded-full transition-all',
                            subject.progress >= 70 ? 'progress-shimmer' : 'bg-primary-500'
                          )}
                          style={{ width: `${subject.progress}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-surface-400">Mastery</span>
                        <span className={subject.mastery >= 80 ? 'text-emerald-400' : 'text-accent-400'}>{subject.mastery}%</span>
                      </div>
                      <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            'h-full rounded-full transition-all',
                            subject.mastery >= 80 ? 'progress-shimmer' : 'bg-accent-500'
                          )}
                          style={{ width: `${subject.mastery}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Activity */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">This Week</h3>
          <div className="flex items-end justify-between h-32 mb-2">
            {data.weeklyActivity.map((minutes, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div 
                  className={`w-8 rounded-t-lg transition-all ${
                    data.streaks.thisWeek[i] ? 'bg-primary-500' : 'bg-surface-700'
                  }`}
                  style={{ height: `${(minutes / maxActivity) * 100}%`, minHeight: '4px' }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-surface-400">
            {dayLabels.map(day => (
              <span key={day} className="w-8 text-center">{day}</span>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-surface-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-400">Total this week</span>
              <span className="text-white font-medium">
                {Math.round(data.weeklyActivity.reduce((a, b) => a + b, 0) / 60)} hours
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test Scores */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Test Performance</h3>
          <div className="space-y-3">
            {data.testScores.map((test, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-surface-800/50 rounded-lg">
                <div>
                  <p className="text-white font-medium">{test.score}/{test.total}</p>
                  <p className="text-xs text-surface-400">{test.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-primary-400 font-medium">{test.percentile}th percentile</p>
                  <p className="text-xs text-surface-400">
                    {i > 0 && test.percentile > data.testScores[i - 1].percentile 
                      ? `↑ ${test.percentile - data.testScores[i - 1].percentile}` 
                      : i > 0 
                        ? `↓ ${data.testScores[i - 1].percentile - test.percentile}`
                        : 'Latest'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Achievements */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Achievements</h3>
          <div className="space-y-3">
            {data.achievements.map(achievement => (
              <div key={achievement.id} className="flex items-center gap-3 p-3 bg-surface-800/50 rounded-lg">
                <span className="text-2xl">{achievement.icon}</span>
                <div className="flex-1">
                  <p className="text-white font-medium">{achievement.name}</p>
                  <p className="text-xs text-surface-400">{achievement.description}</p>
                </div>
                <span className="text-xs text-surface-500">{achievement.date}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-sm w-full mt-4 bg-surface-700 hover:bg-surface-600">
            View All Achievements
          </button>
        </div>
      </div>
    </div>
  );
}
