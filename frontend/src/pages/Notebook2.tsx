/**
 * Enhanced Smart Notebook - Part 2
 * Revision, Chat History, Analytics tabs + Helper components
 */

import type { 
  PracticeProblem, 
  TopicProgress, 
  NotebookEntry,
  LearningGoal,
  ScheduledTopic,
  ChatInteraction,
} from '@/types/notebook';
import { useNotebookStore } from '@/stores/notebookStore';

// ============================================
// REVISION TAB (continued from Part 1)
// ============================================

export function RevisionTab() {
  const store = useNotebookStore();
  const pendingReviews = store.getPendingReviews();
  const activeSession = store.activeRevisionSession;
  const recentSessions = store.revisionSessions.slice(0, 5);

  const startQuickReview = () => {
    const problemIds = pendingReviews.slice(0, 10).map((p) => p.id);
    store.startRevisionSession('quick_review', problemIds);
  };

  const startWeakAreasReview = () => {
    const weakTopics = store.getWeakTopics();
    const problemIds = store.problems
      .filter((p) => weakTopics.some((t) => t.topic === p.topic))
      .slice(0, 15)
      .map((p) => p.id);
    store.startRevisionSession('weak_areas', problemIds);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      {activeSession ? (
        <ActiveRevisionSession session={activeSession} />
      ) : (
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="grid md:grid-cols-3 gap-4">
            <RevisionActionCard
              icon="🔄"
              title="Quick Review"
              description={`${pendingReviews.length} problems due`}
              buttonText="Start Review"
              onClick={startQuickReview}
              color="primary"
              disabled={pendingReviews.length === 0}
            />
            <RevisionActionCard
              icon="⚠️"
              title="Weak Areas"
              description="Focus on challenging topics"
              buttonText="Practice Now"
              onClick={startWeakAreasReview}
              color="yellow"
            />
            <RevisionActionCard
              icon="📚"
              title="Full Revision"
              description="Comprehensive topic review"
              buttonText="Start Session"
              onClick={() => {}}
              color="purple"
            />
          </div>

          {/* Spaced Repetition Calendar */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">📅 Revision Schedule</h3>
            <SpacedRepetitionCalendar problems={store.problems} />
          </div>

          {/* Recent Sessions */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">📊 Recent Sessions</h3>
            {recentSessions.length > 0 ? (
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <RevisionSessionCard key={session.id} session={session} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon="🔄"
                title="No revision sessions yet"
                description="Start a revision session to track your progress"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// CHAT HISTORY TAB
// ============================================

export function ChatHistoryTab() {
  const store = useNotebookStore();
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  let interactions = [...store.chatInteractions];
  
  if (filterChannel !== 'all') {
    interactions = interactions.filter((i) => i.channel === filterChannel);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    interactions = interactions.filter(
      (i) => i.userMessage.toLowerCase().includes(q) || i.aiResponse.toLowerCase().includes(q)
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Filters */}
      <div className="p-4 border-b border-surface-700 flex gap-3">
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white placeholder-surface-400 focus:outline-none focus:border-primary-500"
        />
        <select
          value={filterChannel}
          onChange={(e) => setFilterChannel(e.target.value)}
          className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white"
        >
          <option value="all">All Channels</option>
          <option value="whatsapp">📱 WhatsApp</option>
          <option value="telegram">✈️ Telegram</option>
          <option value="web">🌐 Web Chat</option>
          <option value="app">📲 App</option>
          <option value="google_meet">🎥 Google Meet</option>
        </select>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto p-4">
        {interactions.length > 0 ? (
          <div className="space-y-4">
            {interactions.map((interaction) => (
              <ChatInteractionCard key={interaction.id} interaction={interaction} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="💬"
            title="No chat history"
            description="Your conversations with Sage AI will appear here"
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// ANALYTICS TAB
// ============================================

export function AnalyticsTab() {
  const store = useNotebookStore();
  const analytics = store.getAnalytics();

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Performance Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AnalyticCard
          icon="📝"
          label="Total Problems"
          value={analytics.totalProblems}
          trend={analytics.totalProblems > 0 ? '+' + analytics.totalProblems : '0'}
          trendUp={true}
        />
        <AnalyticCard
          icon="✅"
          label="Solved"
          value={analytics.totalSolved}
          trend={`${((analytics.totalSolved / Math.max(analytics.totalProblems, 1)) * 100).toFixed(0)}%`}
          trendUp={true}
        />
        <AnalyticCard
          icon="🎯"
          label="Accuracy"
          value={`${analytics.overallAccuracy.toFixed(1)}%`}
          trend="target: 90%"
          trendUp={analytics.overallAccuracy >= 70}
        />
        <AnalyticCard
          icon="⏱️"
          label="Time Invested"
          value={`${Math.round(analytics.totalTimeMinutes / 60)}h`}
          trend={`${analytics.totalTimeMinutes} min`}
          trendUp={true}
        />
      </div>

      {/* Performance by Difficulty */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">📊 Performance by Difficulty</h3>
        <div className="grid md:grid-cols-4 gap-4">
          {(['easy', 'medium', 'hard', 'olympiad'] as const).map((diff) => {
            const data = analytics.byDifficulty[diff];
            return (
              <DifficultyCard
                key={diff}
                difficulty={diff}
                total={data.total}
                solved={data.solved}
                accuracy={data.accuracy}
                avgTime={data.avgTimeSeconds}
              />
            );
          })}
        </div>
      </div>

      {/* Performance by Subject */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">📚 Performance by Subject</h3>
        <div className="space-y-4">
          {Object.entries(analytics.bySubject).map(([subject, data]) => (
            <SubjectPerformanceBar
              key={subject}
              subject={subject}
              total={data.total}
              solved={data.solved}
              accuracy={data.accuracy}
              masteryScore={data.masteryScore}
            />
          ))}
        </div>
      </div>

      {/* Time Distribution */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">📅 Daily Activity</h3>
          <TimeDistributionChart data={analytics.timeByDay} />
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">📊 Time by Subject</h3>
          <SubjectTimeChart data={analytics.timeBySubject} />
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>💪</span> Strong Topics
          </h3>
          {analytics.strongTopics.length > 0 ? (
            <div className="space-y-2">
              {analytics.strongTopics.map((topic) => (
                <div key={topic} className="flex items-center gap-2 p-2 bg-green-900/20 rounded-lg">
                  <span className="text-green-400">✓</span>
                  <span className="text-surface-200">{topic}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-surface-400">Keep practicing to identify your strengths!</p>
          )}
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>⚠️</span> Areas to Improve
          </h3>
          {analytics.weakTopics.length > 0 ? (
            <div className="space-y-2">
              {analytics.weakTopics.map((topic) => (
                <div key={topic} className="flex items-center gap-2 p-2 bg-yellow-900/20 rounded-lg">
                  <span className="text-yellow-400">!</span>
                  <span className="text-surface-200">{topic}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-surface-400">Great job! No weak areas identified.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

import { useState } from 'react';

// Stat Card
export function StatCard({ icon, label, value, subtext, color }: {
  icon: string;
  label: string;
  value: string | number;
  subtext: string;
  color: 'primary' | 'green' | 'blue' | 'orange' | 'purple';
}) {
  const colorClasses = {
    primary: 'from-primary-600/20 to-primary-900/20 border-primary-500/30',
    green: 'from-green-600/20 to-green-900/20 border-green-500/30',
    blue: 'from-blue-600/20 to-blue-900/20 border-blue-500/30',
    orange: 'from-orange-600/20 to-orange-900/20 border-orange-500/30',
    purple: 'from-purple-600/20 to-purple-900/20 border-purple-500/30',
  };

  return (
    <div className={`card p-4 bg-gradient-to-br ${colorClasses[color]}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-sm text-surface-400">{label}</p>
          <p className="text-xs text-surface-500">{subtext}</p>
        </div>
      </div>
    </div>
  );
}

// Mastery Stat Card
export function MasteryStatCard({ icon, label, count, color }: {
  icon: string;
  label: string;
  count: number;
  color: 'green' | 'blue' | 'yellow' | 'purple' | 'gray';
}) {
  const colorClasses = {
    green: 'text-green-400',
    blue: 'text-blue-400',
    yellow: 'text-yellow-400',
    purple: 'text-purple-400',
    gray: 'text-surface-400',
  };

  return (
    <div className="card p-4 text-center">
      <span className="text-2xl">{icon}</span>
      <p className={`text-2xl font-bold ${colorClasses[color]}`}>{count}</p>
      <p className="text-sm text-surface-400">{label}</p>
    </div>
  );
}

// Empty State
export function EmptyState({ icon, title, description }: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-8 text-surface-400">
      <span className="text-4xl mb-4 block">{icon}</span>
      <p className="font-medium text-white">{title}</p>
      <p className="text-sm mt-1">{description}</p>
    </div>
  );
}

// Status Badge
export function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { color: string; label: string }> = {
    pending: { color: 'bg-surface-600', label: 'Pending' },
    in_progress: { color: 'bg-blue-600', label: 'In Progress' },
    completed: { color: 'bg-green-600', label: 'Completed' },
    skipped: { color: 'bg-yellow-600', label: 'Skipped' },
    rescheduled: { color: 'bg-purple-600', label: 'Rescheduled' },
    solved: { color: 'bg-green-600', label: 'Solved' },
    incorrect: { color: 'bg-red-600', label: 'Incorrect' },
    attempted: { color: 'bg-yellow-600', label: 'Attempted' },
    needs_review: { color: 'bg-purple-600', label: 'Review' },
    mastered: { color: 'bg-primary-600', label: 'Mastered' },
    not_started: { color: 'bg-surface-600', label: 'Not Started' },
    needs_practice: { color: 'bg-yellow-600', label: 'Needs Practice' },
    pending_revision: { color: 'bg-purple-600', label: 'Due Review' },
    revised: { color: 'bg-blue-600', label: 'Revised' },
  };

  const config = statusConfig[status] || { color: 'bg-surface-600', label: status };

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${config.color} text-white`}>
      {config.label}
    </span>
  );
}

// Problem Mini Card
export function ProblemMiniCard({ problem }: { problem: PracticeProblem }) {
  const difficultyColors = {
    easy: 'text-green-400',
    medium: 'text-yellow-400',
    hard: 'text-red-400',
    olympiad: 'text-purple-400',
  };

  return (
    <div className="p-3 bg-surface-800 rounded-lg hover:bg-surface-700 cursor-pointer transition-colors">
      <p className="text-sm text-white line-clamp-1">{problem.question}</p>
      <div className="flex items-center gap-2 mt-1 text-xs">
        <span className={difficultyColors[problem.difficulty]}>{problem.difficulty}</span>
        <span className="text-surface-500">•</span>
        <span className="text-surface-400">{problem.topic}</span>
      </div>
    </div>
  );
}

// Topic Mini Card
export function TopicMiniCard({ topic }: { topic: TopicProgress }) {
  return (
    <div className="flex items-center justify-between p-3 bg-surface-800 rounded-lg">
      <div>
        <p className="font-medium text-white">{topic.topic}</p>
        <p className="text-sm text-surface-400">{topic.subject}</p>
      </div>
      <div className="text-right">
        <p className="text-sm text-yellow-400">{topic.masteryScore.toFixed(0)}% mastery</p>
        <StatusBadge status={topic.status} />
      </div>
    </div>
  );
}

// Problem Card (Full)
export function ProblemCard({ problem }: { problem: PracticeProblem }) {
  const [expanded, setExpanded] = useState(false);
  const store = useNotebookStore();

  const sourceIcons = {
    ai_tutor: '🤖',
    chatbot: '💬',
    practice: '📚',
    assessment: '📋',
    revision: '🔄',
    recommended: '✨',
    challenge: '🏆',
    peer: '👥',
  };

  const difficultyColors = {
    easy: 'bg-green-600',
    medium: 'bg-yellow-600',
    hard: 'bg-red-600',
    olympiad: 'bg-purple-600',
  };

  return (
    <div className="card overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-surface-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 text-xs rounded ${difficultyColors[problem.difficulty]} text-white`}>
                {problem.difficulty}
              </span>
              <StatusBadge status={problem.status} />
              <span className="text-surface-400 text-xs">
                {sourceIcons[problem.source]} {problem.source.replace('_', ' ')}
              </span>
              {problem.channelSource && (
                <span className="text-surface-500 text-xs">via {problem.channelSource}</span>
              )}
            </div>
            <p className="text-white">{problem.question}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-surface-400">
              <span>📚 {problem.subject} / {problem.topic}</span>
              <span>⏱️ {Math.round(problem.timeSpentSeconds / 60)}m</span>
              <span>🔄 {problem.attemptCount} attempts</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); store.starProblem(problem.id); }}
              className={`text-xl ${problem.isStarred ? 'text-yellow-400' : 'text-surface-500 hover:text-yellow-400'}`}
            >
              {problem.isStarred ? '⭐' : '☆'}
            </button>
            <span className="text-xs text-surface-500">
              {new Date(problem.lastAttemptedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="p-4 border-t border-surface-700 bg-surface-900/50 space-y-4">
          {problem.aiExplanation && (
            <div>
              <h4 className="text-sm font-medium text-primary-400 mb-2">🤖 AI Explanation</h4>
              <div className="p-3 bg-surface-800 rounded-lg text-surface-200 text-sm whitespace-pre-wrap">
                {problem.aiExplanation}
              </div>
            </div>
          )}
          {problem.solutionSteps && problem.solutionSteps.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-green-400 mb-2">📝 Solution Steps</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-surface-200">
                {problem.solutionSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}
          {problem.relatedConcepts.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-blue-400 mb-2">🔗 Related Concepts</h4>
              <div className="flex flex-wrap gap-2">
                {problem.relatedConcepts.map((concept) => (
                  <span key={concept} className="px-2 py-1 bg-blue-900/30 text-blue-400 text-xs rounded-full">
                    {concept}
                  </span>
                ))}
              </div>
            </div>
          )}
          {problem.notes && (
            <div>
              <h4 className="text-sm font-medium text-yellow-400 mb-2">📌 Your Notes</h4>
              <p className="text-sm text-surface-200">{problem.notes}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button className="btn btn-sm bg-primary-600">🔄 Practice Again</button>
            <button className="btn btn-sm bg-surface-700">📌 Add Note</button>
            <button className="btn btn-sm bg-surface-700">🎬 Watch Video</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Topic Progress Card
export function TopicProgressCard({ topic }: { topic: TopicProgress }) {
  return (
    <div className="p-4 bg-surface-800 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-medium text-white">{topic.topic}</h4>
          <p className="text-sm text-surface-400">
            {topic.solvedProblems}/{topic.totalProblems} problems • {topic.timeSpentMinutes}m spent
          </p>
        </div>
        <StatusBadge status={topic.status} />
      </div>
      
      {/* Progress bars */}
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-surface-400">Progress</span>
            <span className="text-primary-400">{topic.progressPercent.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-surface-700 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full"
              style={{ width: `${topic.progressPercent}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-surface-400">Mastery</span>
            <span className={topic.masteryScore >= 80 ? 'text-green-400' : topic.masteryScore >= 50 ? 'text-yellow-400' : 'text-red-400'}>
              {topic.masteryScore.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-surface-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                topic.masteryScore >= 80 ? 'bg-green-600' : topic.masteryScore >= 50 ? 'bg-yellow-600' : 'bg-red-600'
              }`}
              style={{ width: `${topic.masteryScore}%` }}
            />
          </div>
        </div>
      </div>

      {topic.nextRevisionDate && (
        <p className="text-xs text-purple-400 mt-2">
          📅 Next revision: {new Date(topic.nextRevisionDate).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

// Notebook Entry Card
export function NotebookEntryCard({ entry }: { entry: NotebookEntry }) {
  const store = useNotebookStore();
  
  return (
    <div
      className={`p-4 rounded-xl ${
        entry.type === 'ai_response'
          ? 'bg-primary-900/30 border border-primary-500/30'
          : 'bg-surface-800'
      }`}
    >
      {entry.type === 'ai_response' && (
        <div className="flex items-center gap-2 mb-2 text-primary-400 text-sm">
          <span>🤖</span>
          <span>Sage AI</span>
        </div>
      )}
      {entry.type === 'equation' && !entry.aiProcessed && (
        <div className="font-mono text-lg text-white">{entry.content}</div>
      )}
      {entry.type === 'text' && (
        <div className="text-surface-200">{entry.content}</div>
      )}
      {(entry.type === 'ai_response' || entry.aiProcessed) && (
        <div className="prose prose-invert prose-sm max-w-none">
          <pre className="whitespace-pre-wrap font-sans">{entry.content}</pre>
        </div>
      )}
      <div className="flex items-center justify-between mt-2 text-xs text-surface-500">
        <span>{new Date(entry.timestamp).toLocaleString()}</span>
        <button
          onClick={() => store.starEntry(entry.id)}
          className={entry.isStarred ? 'text-yellow-400' : 'hover:text-yellow-400'}
        >
          {entry.isStarred ? '⭐' : '☆'}
        </button>
      </div>
    </div>
  );
}

// Interactive Resources Panel
export function InteractiveResourcesPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Mock resources for display
  const resources = [
    { id: '1', name: 'Quadratic Explorer', icon: '📐', provider: 'Wolfram' },
    { id: '2', name: 'Conic Sections', icon: '⭕', provider: 'GeoGebra' },
    { id: '3', name: 'Projectile Motion', icon: '🚀', provider: 'PhET' },
    { id: '4', name: 'Unit Circle', icon: '📊', provider: 'Desmos' },
    { id: '5', name: 'Circuit Builder', icon: '⚡', provider: 'PhET' },
  ];

  return (
    <div className="w-80 card flex flex-col">
      <div className="p-4 border-b border-surface-700">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <span>✨</span> Interactive Resources
        </h3>
        <p className="text-xs text-surface-400 mt-1">Simulations & visualizations</p>
      </div>
      
      <div className="p-3 border-b border-surface-700">
        <input
          type="text"
          placeholder="Search resources..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-400 focus:outline-none focus:border-primary-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {resources.map((resource) => (
          <button
            key={resource.id}
            className="w-full p-3 bg-surface-800 hover:bg-surface-700 rounded-lg text-left transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{resource.icon}</span>
              <div>
                <p className="text-sm font-medium text-white">{resource.name}</p>
                <p className="text-xs text-surface-400">{resource.provider}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="p-3 border-t border-surface-700">
        <button className="btn btn-sm w-full bg-primary-600">
          🔍 Browse All Resources
        </button>
      </div>
    </div>
  );
}

// Additional helper components...
export function SubjectProgressBar({ topics }: { topics: TopicProgress[] }) {
  const mastered = topics.filter((t) => t.status === 'mastered').length;
  const total = topics.length;
  const percent = total > 0 ? (mastered / total) * 100 : 0;

  return (
    <div className="w-32">
      <div className="w-full bg-surface-700 rounded-full h-2">
        <div
          className="bg-green-600 h-2 rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-surface-400 mt-1">{mastered}/{total} mastered</p>
    </div>
  );
}

export function getSubjectEmoji