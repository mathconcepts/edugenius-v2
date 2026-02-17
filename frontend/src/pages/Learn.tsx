/**
 * Learn Page - Student Learning Interface
 * AI-powered topic exploration and tutoring
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';

interface Topic {
  id: string;
  name: string;
  subject: string;
  chapter: string;
  difficulty: 'easy' | 'medium' | 'hard';
  progress: number;
  mastery: number;
  estimatedTime: number;
  prerequisites: string[];
  aiRecommended: boolean;
}

interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  topics: number;
  progress: number;
  nextTopic?: Topic;
}

const subjects: Subject[] = [
  { id: 'physics', name: 'Physics', icon: '⚡', color: 'from-blue-500 to-cyan-500', topics: 45, progress: 68 },
  { id: 'chemistry', name: 'Chemistry', icon: '🧪', color: 'from-green-500 to-emerald-500', topics: 52, progress: 45 },
  { id: 'mathematics', name: 'Mathematics', icon: '📐', color: 'from-purple-500 to-pink-500', topics: 38, progress: 72 },
  { id: 'biology', name: 'Biology', icon: '🧬', color: 'from-orange-500 to-red-500', topics: 48, progress: 35 },
];

const mockTopics: Topic[] = [
  { id: '1', name: 'Electromagnetic Induction', subject: 'physics', chapter: 'Electromagnetism', difficulty: 'medium', progress: 80, mastery: 75, estimatedTime: 45, prerequisites: ['Magnetic Fields'], aiRecommended: true },
  { id: '2', name: 'AC Circuits', subject: 'physics', chapter: 'Electromagnetism', difficulty: 'hard', progress: 30, mastery: 25, estimatedTime: 60, prerequisites: ['Electromagnetic Induction'], aiRecommended: false },
  { id: '3', name: 'Thermodynamics Laws', subject: 'physics', chapter: 'Heat', difficulty: 'medium', progress: 100, mastery: 90, estimatedTime: 40, prerequisites: [], aiRecommended: false },
  { id: '4', name: 'Organic Reactions', subject: 'chemistry', chapter: 'Organic Chemistry', difficulty: 'hard', progress: 50, mastery: 45, estimatedTime: 75, prerequisites: ['Hydrocarbons'], aiRecommended: true },
  { id: '5', name: 'Integration Techniques', subject: 'mathematics', chapter: 'Calculus', difficulty: 'medium', progress: 65, mastery: 60, estimatedTime: 50, prerequisites: ['Differentiation'], aiRecommended: true },
];

export default function Learn() {
  const { subjectId } = useParams();
  const { userRole } = useAppStore();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(subjectId || null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (subjectId) {
      setSelectedSubject(subjectId);
    }
  }, [subjectId]);

  useEffect(() => {
    // Simulate AI generating suggestions
    setLoading(true);
    setTimeout(() => {
      setAiSuggestions([
        "Based on your recent struggles with Electromagnetic Induction, I recommend reviewing Magnetic Fields first.",
        "You're making great progress in Mathematics! Ready to tackle Integration by Parts?",
        "Your Chemistry mastery is improving. Let's solidify Organic Reactions today.",
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredTopics = selectedSubject 
    ? mockTopics.filter(t => t.subject === selectedSubject)
    : mockTopics;

  const recommendedTopics = mockTopics.filter(t => t.aiRecommended);

  return (
    <div className="space-y-6">
      {/* AI Recommendations Banner */}
      <div className="card bg-gradient-to-r from-primary-600/20 to-accent-600/20 border-primary-500/30">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary-500/20 rounded-xl">
            <span className="text-2xl">🤖</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white mb-2">Sage AI Recommendations</h3>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-surface-700 rounded w-3/4"></div>
                <div className="h-4 bg-surface-700 rounded w-1/2"></div>
              </div>
            ) : (
              <ul className="space-y-1 text-surface-300 text-sm">
                {aiSuggestions.map((suggestion, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary-400">•</span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Subject Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {subjects.map(subject => (
          <button
            key={subject.id}
            onClick={() => setSelectedSubject(subject.id === selectedSubject ? null : subject.id)}
            className={`card p-4 text-left transition-all hover:scale-105 ${
              selectedSubject === subject.id ? 'ring-2 ring-primary-500' : ''
            }`}
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${subject.color} flex items-center justify-center text-2xl mb-3`}>
              {subject.icon}
            </div>
            <h3 className="font-semibold text-white">{subject.name}</h3>
            <p className="text-sm text-surface-400">{subject.topics} topics</p>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-surface-400">Progress</span>
                <span className="text-primary-400">{subject.progress}%</span>
              </div>
              <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r ${subject.color} rounded-full transition-all`}
                  style={{ width: `${subject.progress}%` }}
                />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Topics List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            {selectedSubject 
              ? `${subjects.find(s => s.id === selectedSubject)?.name} Topics`
              : 'All Topics'
            }
          </h2>
          <div className="flex gap-2">
            <button className="btn btn-sm bg-surface-700 hover:bg-surface-600">
              📊 By Difficulty
            </button>
            <button className="btn btn-sm bg-surface-700 hover:bg-surface-600">
              🎯 By Priority
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {filteredTopics.map(topic => (
            <Link
              key={topic.id}
              to={`/chat?topic=${encodeURIComponent(topic.name)}`}
              className="block p-4 bg-surface-800/50 rounded-xl border border-surface-700 hover:border-primary-500/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {topic.aiRecommended && (
                    <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded-full">
                      🤖 AI Pick
                    </span>
                  )}
                  <div>
                    <h3 className="font-medium text-white group-hover:text-primary-400 transition-colors">
                      {topic.name}
                    </h3>
                    <p className="text-sm text-surface-400">{topic.chapter}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-surface-300">{topic.estimatedTime} min</div>
                    <div className={`text-xs ${
                      topic.difficulty === 'easy' ? 'text-green-400' :
                      topic.difficulty === 'medium' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {topic.difficulty.charAt(0).toUpperCase() + topic.difficulty.slice(1)}
                    </div>
                  </div>
                  <div className="w-16">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-surface-400">Mastery</span>
                    </div>
                    <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          topic.mastery >= 80 ? 'bg-green-500' :
                          topic.mastery >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${topic.mastery}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-surface-400 group-hover:text-primary-400 transition-colors">
                    →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/chat" className="card p-4 hover:border-primary-500/50 transition-all group">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-500/20 rounded-xl group-hover:bg-primary-500/30 transition-colors">
              <span className="text-xl">💬</span>
            </div>
            <div>
              <h3 className="font-medium text-white">Ask Sage AI</h3>
              <p className="text-sm text-surface-400">Get instant help with any topic</p>
            </div>
          </div>
        </Link>

        <Link to="/notebook" className="card p-4 hover:border-primary-500/50 transition-all group">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-accent-500/20 rounded-xl group-hover:bg-accent-500/30 transition-colors">
              <span className="text-xl">📝</span>
            </div>
            <div>
              <h3 className="font-medium text-white">Smart Notebook</h3>
              <p className="text-sm text-surface-400">Write equations, get explanations</p>
            </div>
          </div>
        </Link>

        <Link to="/progress" className="card p-4 hover:border-primary-500/50 transition-all group">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/20 rounded-xl group-hover:bg-green-500/30 transition-colors">
              <span className="text-xl">📊</span>
            </div>
            <div>
              <h3 className="font-medium text-white">My Progress</h3>
              <p className="text-sm text-surface-400">Track your learning journey</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
