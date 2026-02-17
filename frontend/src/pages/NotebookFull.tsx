/**
 * Enhanced Smart Notebook - Complete Implementation
 * Combines all tabs, components, and features
 */

import { useState, useRef, useEffect } from 'react';
import { useNotebookStore } from '@/stores/notebookStore';
import type { 
  PracticeProblem, 
  TopicProgress, 
  NotebookEntry,
  LearningGoal,
  ScheduledTopic,
  ChatInteraction,
  RevisionSession,
  ProblemStatus,
  TopicStatus,
  ProblemDifficulty,
} from '@/types/notebook';

// ============================================
// TAB NAVIGATION
// ============================================

type TabType = 'all' | 'problems' | 'topics' | 'notes' | 'plans' | 'revision' | 'chat' | 'analytics';

const tabs: { id: TabType; label: string; icon: string }[] = [
  { id: 'all', label: 'Overview', icon: '📊' },
  { id: 'problems', label: 'Problems', icon: '📝' },
  { id: 'topics', label: 'Topic Mastery', icon: '🎯' },
  { id: 'notes', label: 'Notes', icon: '📓' },
  { id: 'plans', label: 'Learning Plan', icon: '📅' },
  { id: 'revision', label: 'Revision', icon: '🔄' },
  { id: 'chat', label: 'Chat History', icon: '💬' },
  { id: 'analytics', label: 'Insights', icon: '📈' },
];

// ============================================
// MAIN NOTEBOOK COMPONENT
// ============================================

export default function Notebook() {
  const [activeTab, setActiveTab] = useState<TabType>('all');

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Tab Navigation */}
      <div className="flex items-center gap-2 p-4 border-b border-surface-700 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white'
                : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'all' && <OverviewTab />}
        {activeTab === 'problems' && <ProblemsTab />}
        {activeTab === 'topics' && <TopicMasteryTab />}
        {activeTab === 'notes' && <NotesTab />}
        {activeTab === 'plans' && <LearningPlanTab />}
        {activeTab === 'revision' && <RevisionTab />}
        {activeTab === 'chat' && <ChatHistoryTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
      </div>
    </div>
  );
}

// ============================================
// OVERVIEW TAB
// ============================================

function OverviewTab() {
  const store = useNotebookStore();
  const analytics = store.getAnalytics();
  const pendingReviews = store.getPendingReviews();
  const weakTopics = store.getWeakTopics();
  const todaySchedule = store.getTodaySchedule();

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="📝" label="Problems Solved" value={analytics.totalSolved} subtext={`of ${analytics.totalProblems} total`} color="primary" />
        <StatCard icon="🎯" label="Accuracy" value={`${analytics.overallAccuracy.toFixed(1)}%`} subtext="overall performance" color="green" />
        <StatCard icon="⏱️" label="Time Spent" value={`${Math.round(analytics.totalTimeMinutes / 60)}h`} subtext={`${analytics.totalTimeMinutes} minutes`} color="blue" />
        <StatCard icon="🔥" label="Current Streak" value={analytics.currentStreak} subtext="days" color="orange" />
      </div>

      {/* Today's Schedule */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>📅</span> Today's Schedule
        </h3>
        {todaySchedule.length > 0 ? (
          <div className="space-y-3">
            {todaySchedule.map((topic) => (
              <div key={topic.id} className={`p-3 rounded-lg border ${
                topic.status === 'completed' ? 'bg-green-900/20 border-green-500/30' :
                topic.status === 'in_progress' ? 'bg-primary-900/20 border-primary-500/30' :
                'bg-surface-800 border-surface-700'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{topic.topicName}</p>
                    <p className="text-sm text-surface-400">{topic.subject} • {topic.estimatedMinutes} min</p>
                  </div>
                  <StatusBadge status={topic.status} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="📅" title="No schedule for today" description="Create a learning plan to get personalized daily schedules" />
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pending Reviews */}
        <div className="card p-4">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>🔄</span> Due for Review ({pendingReviews.length})
          </h3>
          {pendingReviews.length > 0 ? (
            <div className="space-y-2">
              {pendingReviews.slice(0, 5).map((problem) => (
                <ProblemMiniCard key={problem.id} problem={problem} />
              ))}
              {pendingReviews.length > 5 && (
                <button className="text-primary-400 text-sm hover:underline">View all {pendingReviews.length} reviews →</button>
              )}
            </div>
          ) : (
            <EmptyState icon="✅" title="All caught up!" description="No problems due for review right now" />
          )}
        </div>

        {/* Weak Areas */}
        <div className="card p-4">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>⚠️</span> Focus Areas ({weakTopics.length})
          </h3>
          {weakTopics.length > 0 ? (
            <div className="space-y-3">
              {weakTopics.slice(0, 5).map((topic) => (
                <TopicMiniCard key={topic.id} topic={topic} />
              ))}
            </div>
          ) : (
            <EmptyState icon="💪" title="Great progress!" description="You're performing well across all topics" />
          )}
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="card p-4 bg-gradient-to-r from-primary-900/30 to-purple-900/30 border-primary-500/30">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>🤖</span> Sage's Recommendations
        </h3>
        <div className="space-y-2">
          {analytics.nextSteps.map((step, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-surface-900/50 rounded-lg">
              <span className="text-primary-400 font-bold">{i + 1}.</span>
              <p className="text-surface-200">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// PROBLEMS TAB
// ============================================

function ProblemsTab() {
  const store = useNotebookStore();
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'timestamp' | 'difficulty' | 'topic'>('timestamp');

  const problems = store.problems;
  const subjects = [...new Set(problems.map((p) => p.subject))];

  let filtered = [...problems];
  if (filterSubject !== 'all') filtered = filtered.filter((p) => p.subject === filterSubject);
  if (filterStatus !== 'all') filtered = filtered.filter((p) => p.status === filterStatus);
  if (filterDifficulty !== 'all') filtered = filtered.filter((p) => p.difficulty === filterDifficulty);
  if (filterSource !== 'all') filtered = filtered.filter((p) => p.source === filterSource);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter((p) => p.question.toLowerCase().includes(q) || p.topic.toLowerCase().includes(q));
  }

  filtered.sort((a, b) => {
    if (sortBy === 'timestamp') return new Date(b.lastAttemptedAt).getTime() - new Date(a.lastAttemptedAt).getTime();
    if (sortBy === 'difficulty') {
      const order = { easy: 1, medium: 2, hard: 3, olympiad: 4 };
      return order[a.difficulty] - order[b.difficulty];
    }
    return a.topic.localeCompare(b.topic);
  });

  return (
    <div className="h-full flex flex-col">
      {/* Filters */}
      <div className="p-4 border-b border-surface-700 flex flex-wrap gap-3">
        <input type="text" placeholder="Search problems..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[200px] bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white placeholder-surface-400 focus:outline-none focus:border-primary-500" />
        <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white">
          <option value="all">All Subjects</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white">
          <option value="all">All Status</option>
          <option value="solved">✅ Solved</option>
          <option value="incorrect">❌ Incorrect</option>
          <option value="attempted">🔄 Attempted</option>
          <option value="needs_review">📌 Needs Review</option>
        </select>
        <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)} className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white">
          <option value="all">All Difficulty</option>
          <option value="easy">🟢 Easy</option>
          <option value="medium">🟡 Medium</option>
          <option value="hard">🔴 Hard</option>
          <option value="olympiad">💎 Olympiad</option>
        </select>
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white">
          <option value="all">All Sources</option>
          <option value="ai_tutor">🤖 AI Tutor</option>
          <option value="chatbot">💬 Chatbot</option>
          <option value="practice">📚 Practice</option>
          <option value="assessment">📋 Assessment</option>
        </select>
      </div>

      {/* Problem List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((problem) => <ProblemCard key={problem.id} problem={problem} />)}
          </div>
        ) : (
          <EmptyState icon="📝" title="No problems found" description={problems.length === 0 ? "Start practicing to see your problems here" : "Try adjusting your filters"} />
        )}
      </div>
    </div>
  );
}

// ============================================
// TOPIC MASTERY TAB  
// ============================================

function TopicMasteryTab() {
  const store = useNotebookStore();
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const topicProgress = store.topicProgress;
  const subjects = [...new Set(topicProgress.map((t) => t.subject))];
  const getTopicsBySubject = (subject: string) => topicProgress.filter((t) => t.subject === subject);

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <MasteryStatCard icon="🎯" label="Mastered" count={topicProgress.filter((t) => t.status === 'mastered').length} color="green" />
        <MasteryStatCard icon="📖" label="In Progress" count={topicProgress.filter((t) => t.status === 'in_progress').length} color="blue" />
        <MasteryStatCard icon="⚠️" label="Needs Practice" count={topicProgress.filter((t) => t.status === 'needs_practice').length} color="yellow" />
        <MasteryStatCard icon="🔄" label="Pending Revision" count={topicProgress.filter((t) => t.status === 'pending_revision').length} color="purple" />
        <MasteryStatCard icon="⬜" label="Not Started" count={topicProgress.filter((t) => t.status === 'not_started').length} color="gray" />
      </div>

      {subjects.length > 0 ? (
        <div className="space-y-4">
          {subjects.map((subject) => (
            <div key={subject} className="card overflow-hidden">
              <button onClick={() => setExpandedSubject(expandedSubject === subject ? null : subject)}
                className="w-full p-4 flex items-center justify-between hover:bg-surface-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getSubjectEmoji(subject)}</span>
                  <div className="text-left">
                    <h3 className="font-semibold text-white">{subject}</h3>
                    <p className="text-sm text-surface-400">{getTopicsBySubject(subject).length} topics</p>
                  </div>
                </div>
                <span className={`transform transition-transform ${expandedSubject === subject ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {expandedSubject === subject && (
                <div className="border-t border-surface-700 p-4 space-y-3">
                  {getTopicsBySubject(subject).map((topic) => <TopicProgressCard key={topic.id} topic={topic} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="🎯" title="No topic data yet" description="Practice problems to see your topic mastery tracking" />
      )}
    </div>
  );
}

// ============================================
// NOTES TAB
// ============================================

function NotesTab() {
  const store = useNotebookStore();
  const [inputMode, setInputMode] = useState<'equation' | 'text' | 'draw'>('equation');
  const [currentInput, setCurrentInput] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);

  const handleSubmit = async () => {
    if (!currentInput.trim()) return;
    store.addEntry({ type: inputMode === 'equation' ? 'equation' : 'text', content: currentInput, tags: [] });
    if (inputMode === 'equation') {
      setAiThinking(true);
      setTimeout(() => {
        store.addEntry({ type: 'ai_response', content: `**Analysis:** I'll help you solve this step by step.\n\n**Interactive Resource:** Try the relevant simulation to visualize!`, aiProcessed: true, tags: [] });
        setAiThinking(false);
      }, 1500);
    }
    setCurrentInput('');
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) { ctx.beginPath(); ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY); }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) { ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#8B5CF6'; ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY); ctx.stroke(); }
  };

  const clearCanvas = () => canvasRef.current?.getContext('2d')?.clearRect(0, 0, 600, 150);

  return (
    <div className="h-full flex gap-6 p-6">
      <div className="flex-1 flex flex-col">
        <div className="card flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-surface-700">
            <div className="flex gap-2">
              <button onClick={() => setInputMode('equation')} className={`btn btn-sm ${inputMode === 'equation' ? 'bg-primary-600' : 'bg-surface-700'}`}>📐 Equation</button>
              <button onClick={() => setInputMode('text')} className={`btn btn-sm ${inputMode === 'text' ? 'bg-primary-600' : 'bg-surface-700'}`}>📝 Text</button>
              <button onClick={() => setInputMode('draw')} className={`btn btn-sm ${inputMode === 'draw' ? 'bg-primary-600' : 'bg-surface-700'}`}>✏️ Draw</button>
            </div>
            <button className="btn btn-sm bg-surface-700 hover:bg-surface-600">📥 Export PDF</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-900/50">
            {store.entries.length === 0 && <EmptyState icon="📓" title="Start writing" description="Write equations, notes, or draw diagrams. Sage AI will help!" />}
            {store.entries.map((entry) => <NotebookEntryCard key={entry.id} entry={entry} />)}
            {aiThinking && (
              <div className="p-4 rounded-xl bg-primary-900/30 border border-primary-500/30">
                <div className="flex items-center gap-2 text-primary-400"><span className="animate-spin">⚡</span><span>Sage AI is analyzing...</span></div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-surface-700">
            {inputMode === 'draw' ? (
              <div className="space-y-3">
                <canvas ref={canvasRef} width={600} height={150} className="w-full bg-surface-900 rounded-xl border border-surface-700 cursor-crosshair"
                  onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)} onMouseLeave={() => setIsDrawing(false)} />
                <div className="flex justify-between">
                  <button onClick={clearCanvas} className="btn btn-sm bg-surface-700">🗑️ Clear</button>
                  <button className="btn btn-sm btn-primary">🔍 Recognize & Solve</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <input type="text" value={currentInput} onChange={(e) => setCurrentInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder={inputMode === 'equation' ? 'Type equation: x^2 + 5x + 6 = 0' : 'Type your notes...'}
                  className="flex-1 bg-surface-800 border border-surface-700 rounded-xl px-4 py-3 text-white placeholder-surface-400 focus:outline-none focus:border-primary-500" />
                <button onClick={handleSubmit} className="btn btn-primary px-6">{inputMode === 'equation' ? '🧮 Solve' : '💾 Save'}</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <InteractiveResourcesPanel />
    </div>
  );
}

// ============================================
// LEARNING PLAN TAB
// ============================================

function LearningPlanTab() {
  const store = useNotebookStore();
  const activePlan = store.activeLearningPlan;
  const todaySchedule = store.getTodaySchedule();

  return (
    <div className="h-full overflow-y-auto p-6">
      {activePlan ? (
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{activePlan.name}</h2>
                <p className="text-surface-400">{new Date(activePlan.startDate).toLocaleDateString()} - {new Date(activePlan.endDate).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary-400">{activePlan.progressPercent.toFixed(0)}%</p>
                <p className="text-sm text-surface-400">Complete</p>
              </div>
            </div>
            <div className="w-full bg-surface-700 rounded-full h-3">
              <div className="bg-gradient-to-r from-primary-600 to-purple-600 h-3 rounded-full transition-all" style={{ width: `${activePlan.progressPercent}%` }} />
            </div>
            <div className="mt-4 flex gap-4 text-sm">
              <span className="text-surface-400">🎯 Daily target: <span className="text-white">{activePlan.dailyTargetMinutes} min</span></span>
              <span className="text-surface-400">🔥 Streak: <span className="text-orange-400">{activePlan.streakDays} days</span></span>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">📅 Today's Topics</h3>
            {todaySchedule.length > 0 ? (
              <div className="space-y-3">{todaySchedule.map((topic) => <ScheduledTopicCard key={topic.id} topic={topic} />)}</div>
            ) : (
              <EmptyState icon="✅" title="All done for today!" description="Great job completing your daily targets" />
            )}
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">🎯 Goals</h3>
            <div className="space-y-4">{activePlan.goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}</div>
          </div>
        </div>
      ) : (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <span className="text-6xl mb-4 block">📅</span>
            <h2 className="text-xl font-bold text-white mb-2">No Active Learning Plan</h2>
            <p className="text-surface-400 mb-6">Create a personalized learning plan to track your progress</p>
            <button className="btn btn-primary">✨ Create AI-Powered Plan</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// REVISION TAB
// ============================================

function RevisionTab() {
  const store = useNotebookStore();
  const pendingReviews = store.getPendingReviews();
  const activeSession = store.activeRevisionSession;
  const recentSessions = store.revisionSessions.slice(0, 5);

  const startQuickReview = () => {
    const problemIds = pendingReviews.slice(0, 10).map((p) => p.id);
    store.startRevisionSession('quick_review', problemIds);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      {activeSession ? (
        <ActiveRevisionSession session={activeSession} />
      ) : (
        <div className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <RevisionActionCard icon="🔄" title="Quick Review" description={`${pendingReviews.length} problems due`} buttonText="Start Review" onClick={startQuickReview} color="primary" disabled={pendingReviews.length === 0} />
            <RevisionActionCard icon="⚠️" title="Weak Areas" description="Focus on challenging topics" buttonText="Practice Now" onClick={() => {}} color="yellow" />
            <RevisionActionCard icon="📚" title="Full Revision" description="Comprehensive topic review" buttonText="Start Session" onClick={() => {}} color="purple" />
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">📅 Spaced Repetition Schedule</h3>
            <SpacedRepetitionCalendar problems={store.problems} />
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">📊 Recent Sessions</h3>
            {recentSessions.length > 0 ? (
              <div className="space-y-3">{recentSessions.map((session) => <RevisionSessionCard key={session.id} session={session} />)}</div>
            ) : (
              <EmptyState icon="🔄" title="No revision sessions yet" description="Start a revision session to track your progress" />
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

function ChatHistoryTab() {
  const store = useNotebookStore();
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  let interactions = [...store.chatInteractions];
  if (filterChannel !== 'all') interactions = interactions.filter((i) => i.channel === filterChannel);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    interactions = interactions.filter((i) => i.userMessage.toLowerCase().includes(q) || i.aiResponse.toLowerCase().includes(q));
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-surface-700 flex gap-3">
        <input type="text" placeholder="Search conversations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white placeholder-surface-400 focus:outline-none focus:border-primary-500" />
        <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white">
          <option value="all">All Channels</option>
          <option value="whatsapp">📱 WhatsApp</option>
          <option value="telegram">✈️ Telegram</option>
          <option value="web">🌐 Web Chat</option>
          <option value="app">📲 App</option>
          <option value="google_meet">🎥 Google Meet</option>
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {interactions.length > 0 ? (
          <div className="space-y-4">{interactions.map((interaction) => <ChatInteractionCard key={interaction.id} interaction={interaction} />)}</div>
        ) : (
          <EmptyState icon="💬" title="No chat history" description="Your conversations with Sage AI will appear here" />
        )}
      </div>
