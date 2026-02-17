/**
 * Content Management Page - Admin/CEO view
 * AI-powered content creation and management
 */

import { useState } from 'react';

interface ContentItem {
  id: string;
  title: string;
  type: 'question' | 'lesson' | 'blog' | 'video';
  subject: string;
  status: 'draft' | 'review' | 'published' | 'ai-generating';
  author: string;
  createdAt: string;
  views?: number;
  engagement?: number;
}

const mockContent: ContentItem[] = [
  { id: '1', title: 'Electromagnetic Induction - Complete Guide', type: 'lesson', subject: 'Physics', status: 'published', author: 'Atlas AI', createdAt: '2026-02-17', views: 1250, engagement: 85 },
  { id: '2', title: 'Organic Chemistry Reactions MCQs', type: 'question', subject: 'Chemistry', status: 'published', author: 'Atlas AI', createdAt: '2026-02-17', views: 890, engagement: 78 },
  { id: '3', title: 'Integration Techniques Video', type: 'video', subject: 'Mathematics', status: 'review', author: 'Atlas AI', createdAt: '2026-02-16' },
  { id: '4', title: 'JEE 2026 Strategy Blog', type: 'blog', subject: 'General', status: 'ai-generating', author: 'Atlas AI', createdAt: '2026-02-17' },
  { id: '5', title: 'Thermodynamics Practice Set', type: 'question', subject: 'Physics', status: 'draft', author: 'Atlas AI', createdAt: '2026-02-16' },
];

const contentStats = {
  totalContent: 2847,
  publishedToday: 24,
  aiGenerated: 89,
  avgEngagement: 76,
};

export default function Content() {
  const [filter, setFilter] = useState<string>('all');
  const [generating, setGenerating] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState('');

  const filteredContent = filter === 'all' 
    ? mockContent 
    : mockContent.filter(c => c.status === filter || c.type === filter);

  const handleGenerate = () => {
    if (!generationPrompt.trim()) return;
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setGenerationPrompt('');
      // Would add new content to list
    }, 3000);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-500/20 text-green-400';
      case 'review': return 'bg-yellow-500/20 text-yellow-400';
      case 'draft': return 'bg-surface-600 text-surface-300';
      case 'ai-generating': return 'bg-primary-500/20 text-primary-400';
      default: return 'bg-surface-600 text-surface-300';
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'question': return '❓';
      case 'lesson': return '📚';
      case 'blog': return '📝';
      case 'video': return '🎥';
      default: return '📄';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-surface-400 text-sm">Total Content</p>
          <p className="text-2xl font-bold text-white">{contentStats.totalContent.toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="text-surface-400 text-sm">Published Today</p>
          <p className="text-2xl font-bold text-green-400">{contentStats.publishedToday}</p>
        </div>
        <div className="card">
          <p className="text-surface-400 text-sm">AI Generated</p>
          <p className="text-2xl font-bold text-primary-400">{contentStats.aiGenerated}%</p>
        </div>
        <div className="card">
          <p className="text-surface-400 text-sm">Avg Engagement</p>
          <p className="text-2xl font-bold text-accent-400">{contentStats.avgEngagement}%</p>
        </div>
      </div>

      {/* AI Content Generation */}
      <div className="card bg-gradient-to-r from-primary-600/10 to-accent-600/10 border-primary-500/30">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>🤖</span> Atlas AI Content Generator
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={generationPrompt}
            onChange={(e) => setGenerationPrompt(e.target.value)}
            placeholder="Describe the content you want to generate... e.g., '10 MCQs on Electromagnetic Induction for JEE'"
            className="flex-1 bg-surface-800 border border-surface-700 rounded-xl px-4 py-3 text-white placeholder-surface-400 focus:outline-none focus:border-primary-500"
          />
          <button 
            onClick={handleGenerate}
            disabled={generating}
            className="btn btn-primary px-6"
          >
            {generating ? (
              <>
                <span className="animate-spin mr-2">⚡</span>
                Generating...
              </>
            ) : (
              <>✨ Generate</>
            )}
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button className="btn btn-sm bg-surface-700 hover:bg-surface-600">📝 Questions</button>
          <button className="btn btn-sm bg-surface-700 hover:bg-surface-600">📚 Lessons</button>
          <button className="btn btn-sm bg-surface-700 hover:bg-surface-600">📰 Blog Post</button>
          <button className="btn btn-sm bg-surface-700 hover:bg-surface-600">🎥 Video Script</button>
        </div>
      </div>

      {/* Content List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Content Library</h3>
          <div className="flex gap-2">
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="all">All Content</option>
              <option value="published">Published</option>
              <option value="review">In Review</option>
              <option value="draft">Drafts</option>
              <option value="ai-generating">AI Generating</option>
              <option value="question">Questions</option>
              <option value="lesson">Lessons</option>
              <option value="blog">Blogs</option>
              <option value="video">Videos</option>
            </select>
            <button className="btn btn-sm bg-primary-600 hover:bg-primary-700">
              + Create New
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-surface-400 text-sm border-b border-surface-700">
                <th className="pb-3 font-medium">Content</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Subject</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Author</th>
                <th className="pb-3 font-medium">Performance</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContent.map(item => (
                <tr key={item.id} className="border-b border-surface-800 hover:bg-surface-800/50">
                  <td className="py-4">
                    <p className="text-white font-medium">{item.title}</p>
                    <p className="text-xs text-surface-400">{item.createdAt}</p>
                  </td>
                  <td className="py-4">
                    <span className="flex items-center gap-1">
                      <span>{typeIcon(item.type)}</span>
                      <span className="text-surface-300 capitalize">{item.type}</span>
                    </span>
                  </td>
                  <td className="py-4 text-surface-300">{item.subject}</td>
                  <td className="py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${statusColor(item.status)}`}>
                      {item.status === 'ai-generating' ? '⚡ Generating' : item.status}
                    </span>
                  </td>
                  <td className="py-4 text-surface-300">{item.author}</td>
                  <td className="py-4">
                    {item.views ? (
                      <div className="text-sm">
                        <p className="text-white">{item.views.toLocaleString()} views</p>
                        <p className="text-surface-400">{item.engagement}% engagement</p>
                      </div>
                    ) : (
                      <span className="text-surface-500">—</span>
                    )}
                  </td>
                  <td className="py-4">
                    <div className="flex gap-1">
                      <button className="btn btn-sm bg-surface-700 hover:bg-surface-600 px-2">👁️</button>
                      <button className="btn btn-sm bg-surface-700 hover:bg-surface-600 px-2">✏️</button>
                      <button className="btn btn-sm bg-surface-700 hover:bg-surface-600 px-2">📊</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Content Pipeline */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Content Pipeline (Today)</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-surface-800/50 rounded-xl text-center">
            <p className="text-3xl font-bold text-primary-400">12</p>
            <p className="text-sm text-surface-400">AI Generating</p>
          </div>
          <div className="p-4 bg-surface-800/50 rounded-xl text-center">
            <p className="text-3xl font-bold text-yellow-400">8</p>
            <p className="text-sm text-surface-400">In Review</p>
          </div>
          <div className="p-4 bg-surface-800/50 rounded-xl text-center">
            <p className="text-3xl font-bold text-green-400">24</p>
            <p className="text-sm text-surface-400">Published</p>
          </div>
          <div className="p-4 bg-surface-800/50 rounded-xl text-center">
            <p className="text-3xl font-bold text-accent-400">156</p>
            <p className="text-sm text-surface-400">Scheduled</p>
          </div>
        </div>
      </div>
    </div>
  );
}
