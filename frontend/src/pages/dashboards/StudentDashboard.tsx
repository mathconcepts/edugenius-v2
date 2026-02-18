import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Trophy,
  Flame,
  Target,
  MessageSquare,
  Play,
  Clock,
  CheckCircle,
  Sparkles,
  Brain,
  Zap,
} from 'lucide-react';
import { clsx } from 'clsx';

const subjects = [
  { id: 'math', name: 'Mathematics', icon: '🔢', progress: 72, color: 'from-blue-500 to-cyan-500' },
  { id: 'physics', name: 'Physics', icon: '⚡', progress: 58, color: 'from-yellow-500 to-orange-500' },
  { id: 'chemistry', name: 'Chemistry', icon: '🧪', progress: 45, color: 'from-green-500 to-emerald-500' },
  { id: 'biology', name: 'Biology', icon: '🧬', progress: 63, color: 'from-pink-500 to-rose-500' },
];

const recentTopics = [
  { id: '1', title: 'Quadratic Equations', subject: 'Mathematics', status: 'in-progress', progress: 65 },
  { id: '2', title: 'Newton\'s Laws', subject: 'Physics', status: 'completed', progress: 100 },
  { id: '3', title: 'Chemical Bonding', subject: 'Chemistry', status: 'not-started', progress: 0 },
];

const badges = [
  { id: '1', name: 'Quick Learner', icon: '🚀', earned: true },
  { id: '2', name: '7 Day Streak', icon: '🔥', earned: true },
  { id: '3', name: 'Problem Solver', icon: '🧩', earned: true },
  { id: '4', name: 'Math Master', icon: '👑', earned: false },
  { id: '5', name: 'Perfect Score', icon: '💯', earned: false },
];

const dailyChallenges = [
  { id: '1', title: 'Solve 5 algebra problems', xp: 50, completed: true },
  { id: '2', title: 'Watch a physics video', xp: 30, completed: false },
  { id: '3', title: 'Practice for 30 minutes', xp: 40, completed: false },
];

export function StudentDashboard() {
  const [streak] = useState(12);
  const [totalXP] = useState(2450);
  const [level] = useState(15);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 bg-gradient-to-r from-primary-500/10 via-accent-500/10 to-primary-500/10"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, Student! 👋</h1>
            <p className="text-surface-400 mt-1">Ready to learn something new today?</p>
          </div>
          <Link
            to="/chat"
            className="btn-primary flex items-center gap-2"
          >
            <MessageSquare className="w-5 h-5" />
            Ask Sage
          </Link>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-900/50">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Flame className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{streak}</p>
              <p className="text-sm text-surface-400">Day Streak</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-900/50">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalXP.toLocaleString()}</p>
              <p className="text-sm text-surface-400">Total XP</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-900/50">
            <div className="p-2 rounded-lg bg-primary-500/20">
              <Trophy className="w-6 h-6 text-primary-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">Level {level}</p>
              <p className="text-sm text-surface-400">Explorer</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Continue Learning */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Continue Learning</h2>
              <Link to="/learn" className="text-sm text-primary-400 hover:text-primary-300">
                View all
              </Link>
            </div>

            <div className="space-y-3">
              {recentTopics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-surface-800/50 hover:bg-surface-800 transition-colors cursor-pointer group"
                >
                  <div className="p-3 rounded-xl bg-primary-500/10">
                    <BookOpen className="w-5 h-5 text-primary-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{topic.title}</h3>
                      {topic.status === 'completed' && (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                    <p className="text-sm text-surface-400">{topic.subject}</p>
                    {topic.status === 'in-progress' && (
                      <div className="mt-2 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full"
                          style={{ width: `${topic.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <button className="p-2 rounded-lg bg-primary-500 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Subjects */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <h2 className="font-semibold text-lg mb-4">My Subjects</h2>
            <div className="grid grid-cols-2 gap-4">
              {subjects.map((subject) => (
                <Link
                  key={subject.id}
                  to={`/learn/${subject.id}`}
                  className="p-4 rounded-xl bg-surface-800/50 hover:bg-surface-800 transition-colors group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{subject.icon}</span>
                    <div>
                      <h3 className="font-medium">{subject.name}</h3>
                      <p className="text-sm text-surface-400">{subject.progress}% complete</p>
                    </div>
                  </div>
                  <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full bg-gradient-to-r',
                        subject.color
                      )}
                      style={{ width: `${subject.progress}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4"
          >
            <Link
              to="/chat"
              className="card-hover flex flex-col items-center text-center group"
            >
              <div className="p-4 rounded-2xl bg-gradient-to-br from-accent-500/20 to-primary-500/20 mb-3 group-hover:scale-110 transition-transform">
                <Brain className="w-8 h-8 text-accent-400" />
              </div>
              <h3 className="font-medium">Ask a Question</h3>
              <p className="text-xs text-surface-400 mt-1">Sage is ready to help</p>
            </Link>
            <Link
              to="/notebook"
              className="card-hover flex flex-col items-center text-center group"
            >
              <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 mb-3 group-hover:scale-110 transition-transform">
                <BookOpen className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="font-medium">Smart Notebook</h3>
              <p className="text-xs text-surface-400 mt-1">Write & solve</p>
            </Link>
            <Link
              to="/progress"
              className="card-hover flex flex-col items-center text-center group"
            >
              <div className="p-4 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 mb-3 group-hover:scale-110 transition-transform">
                <Target className="w-8 h-8 text-yellow-400" />
              </div>
              <h3 className="font-medium">My Progress</h3>
              <p className="text-xs text-surface-400 mt-1">Track your growth</p>
            </Link>
            <Link
              to="/insights"
              className="card-hover flex flex-col items-center text-center group"
            >
              <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 mb-3 group-hover:scale-110 transition-transform">
                <Trophy className="w-8 h-8 text-pink-400" />
              </div>
              <h3 className="font-medium">Exam Tips</h3>
              <p className="text-xs text-surface-400 mt-1">Topper strategies</p>
            </Link>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Daily Challenges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Daily Challenges</h2>
              <Zap className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="space-y-3">
              {dailyChallenges.map((challenge) => (
                <div
                  key={challenge.id}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-lg transition-colors',
                    challenge.completed
                      ? 'bg-green-500/10 border border-green-500/30'
                      : 'bg-surface-800/50 hover:bg-surface-800 cursor-pointer'
                  )}
                >
                  <div
                    className={clsx(
                      'w-6 h-6 rounded-full flex items-center justify-center',
                      challenge.completed
                        ? 'bg-green-500'
                        : 'border-2 border-surface-600'
                    )}
                  >
                    {challenge.completed && (
                      <CheckCircle className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={clsx(
                      'text-sm',
                      challenge.completed && 'line-through text-surface-400'
                    )}>
                      {challenge.title}
                    </p>
                  </div>
                  <span className="text-xs text-yellow-400 font-medium">
                    +{challenge.xp} XP
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">My Badges</h2>
              <Link to="/progress" className="text-sm text-primary-400 hover:text-primary-300">
                View all
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className={clsx(
                    'p-3 rounded-xl text-center transition-all',
                    badge.earned
                      ? 'bg-surface-800/50'
                      : 'bg-surface-800/30 opacity-50'
                  )}
                  title={badge.name}
                >
                  <span className="text-2xl">{badge.icon}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Study Timer */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card bg-gradient-to-br from-primary-500/10 to-accent-500/10"
          >
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-5 h-5 text-primary-400" />
              <h2 className="font-semibold">Study Timer</h2>
            </div>
            <div className="text-center py-4">
              <p className="text-4xl font-bold font-mono">25:00</p>
              <p className="text-sm text-surface-400 mt-2">Focus Session</p>
            </div>
            <button className="w-full btn-primary flex items-center justify-center gap-2">
              <Play className="w-4 h-4" />
              Start Focus Mode
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
