/**
 * Progress Page - Student progress tracking and analytics
 * AI-powered insights and recommendations
 */

import { useState } from 'react';

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

export default function Progress() {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('week');
  const data = mockData;

  const trendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➡️';
    }
  };

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const maxActivity = Math.max(...data.weeklyActivity);

  return (
    <div className="space-y-6">
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
            {data.subjects.map(subject => (
              <div key={subject.name} className="p-4 bg-surface-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{trendIcon(subject.trend)}</span>
                    <span className="font-medium text-white">{subject.name}</span>
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
                        className="h-full bg-primary-500 rounded-full transition-all"
                        style={{ width: `${subject.progress}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-surface-400">Mastery</span>
                      <span className="text-accent-400">{subject.mastery}%</span>
                    </div>
                    <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent-500 rounded-full transition-all"
                        style={{ width: `${subject.mastery}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
