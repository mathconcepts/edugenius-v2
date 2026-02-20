/**
 * Blog — Dynamic AI-driven layout
 * Layout hierarchy (magazine / grid / hero-focus / list / minimal)
 * is determined automatically by the AI layout engine in blogStore.
 */

import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  Plus, Edit, Trash2, Eye, BarChart2, Pin, PinOff,
  ArrowLeft, Share2, Clock, Tag, ChevronRight,
  Sparkles, Loader2, CheckCircle, AlertCircle,
  TrendingUp, BookOpen, Search, X, Activity,
  GitBranch, Zap, RefreshCw, ChevronDown, ChevronUp,
  LayoutGrid, Signal, Target, AlertTriangle,
} from 'lucide-react';
import { useBlogStore, type BlogPost, type BlogSection, type ExamTag, type ContentType, type GenerateRequest } from '@/stores/blogStore';
import { blogAgentBridge } from '@/services/blogAgentBridge';
import type { StrategySignal, BlogPerformanceSignal, AgentLineage, BlogGenerationPrompt } from '@/services/blogAgentBridge';
import { useAppStore } from '@/stores/appStore';
import { loadPersona } from '@/services/studentPersonaEngine';

// ─── Section Renderer ──────────────────────────────────────────────────────────

function RenderSection({ section }: { section: BlogSection }) {
  switch (section.type) {
    case 'heading':
      if (section.level === 1) return <h1 className="text-3xl font-bold text-white mt-8 mb-4">{section.content}</h1>;
      if (section.level === 2) return <h2 className="text-2xl font-semibold text-white mt-6 mb-3 border-b border-surface-700 pb-2">{section.content}</h2>;
      return <h3 className="text-xl font-medium text-white mt-4 mb-2">{section.content}</h3>;

    case 'paragraph':
      return <p className="text-surface-300 leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: section.content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>') }} />;

    case 'bullets':
      return (
        <ul className="mb-4 space-y-2">
          {section.items?.map((item, i) => (
            <li key={i} className="flex gap-3 text-surface-300">
              <span className="text-primary-400 mt-1 flex-shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
            </li>
          ))}
        </ul>
      );

    case 'numbered':
      return (
        <ol className="mb-4 space-y-2">
          {section.items?.map((item, i) => (
            <li key={i} className="flex gap-3 text-surface-300">
              <span className="text-primary-400 font-mono text-sm mt-0.5 flex-shrink-0 w-5">{i + 1}.</span>
              <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
            </li>
          ))}
        </ol>
      );

    case 'callout': {
      const styles = {
        tip:     { bg: 'bg-green-500/10 border-green-500/30',  icon: '💡', text: 'text-green-400' },
        info:    { bg: 'bg-blue-500/10 border-blue-500/30',    icon: 'ℹ️', text: 'text-blue-400'  },
        warning: { bg: 'bg-yellow-500/10 border-yellow-500/30', icon: '⚠️', text: 'text-yellow-400' },
        success: { bg: 'bg-emerald-500/10 border-emerald-500/30', icon: '✅', text: 'text-emerald-400' },
      };
      const s = styles[section.calloutType || 'info'];
      return (
        <div className={`flex gap-3 p-4 rounded-xl border mb-4 ${s.bg}`}>
          <span className="text-lg flex-shrink-0">{s.icon}</span>
          <p className={`text-sm ${s.text}`}>{section.content}</p>
        </div>
      );
    }

    case 'quote':
      return (
        <blockquote className="border-l-4 border-primary-500 pl-4 mb-4 italic text-surface-300">
          {section.content}
        </blockquote>
      );

    case 'cta':
      return (
        <div className="my-6 p-5 bg-gradient-to-r from-primary-900/40 to-accent-900/40 border border-primary-500/30 rounded-xl flex items-center justify-between">
          <p className="text-white font-medium">{section.ctaText}</p>
          <Link to={section.ctaUrl || '/'} className="btn-primary text-sm px-4 py-2 rounded-lg">
            Get Started →
          </Link>
        </div>
      );

    case 'divider':
      return <hr className="border-surface-700 my-6" />;

    default:
      return null;
  }
}

// ─── Post Card Variants ────────────────────────────────────────────────────────

function HeroCard({ post, onClick }: { post: BlogPost; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="group cursor-pointer relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-900/50 via-surface-800 to-accent-900/30 border border-primary-500/30 hover:border-primary-400 transition-all p-8 md:p-12"
    >
      {post.pinned && (
        <div className="absolute top-4 right-4 flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded-full">
          <Pin className="w-3 h-3" /> Featured
        </div>
      )}
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-5xl">{post.emoji}</span>
          <span className="text-xs text-primary-400 bg-primary-500/10 px-3 py-1 rounded-full font-medium">{post.category}</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 group-hover:text-primary-300 transition-colors leading-tight">
          {post.title}
        </h2>
        <p className="text-surface-300 text-lg mb-6 line-clamp-3">{post.excerpt}</p>
        <div className="flex items-center gap-4 text-sm text-surface-400">
          <span>{post.author}</span>
          <span>•</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {post.readTime} min read</span>
          <span>•</span>
          <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {post.views.toLocaleString()} views</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {post.examTags.map(tag => (
            <span key={tag} className="text-xs text-surface-400 bg-surface-800 px-2 py-0.5 rounded">#{tag}</span>
          ))}
        </div>
      </div>
      <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2 text-primary-400 font-medium">
          Read Article <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </motion.div>
  );
}

function FeaturedCard({ post, onClick }: { post: BlogPost; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="group cursor-pointer p-6 bg-surface-800/80 rounded-2xl border border-surface-700 hover:border-primary-500/50 transition-all flex gap-4"
    >
      <span className="text-4xl flex-shrink-0">{post.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-primary-400 font-medium">{post.category}</span>
          {post.featured && <TrendingUp className="w-3 h-3 text-orange-400" />}
        </div>
        <h3 className="text-base font-semibold text-white group-hover:text-primary-400 transition-colors line-clamp-2 mb-2">
          {post.title}
        </h3>
        <div className="flex items-center gap-3 text-xs text-surface-500">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {post.readTime} min</span>
          <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {post.views.toLocaleString()}</span>
        </div>
      </div>
    </motion.div>
  );
}

function GridCard({ post, onClick }: { post: BlogPost; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="group cursor-pointer p-6 bg-surface-800 rounded-2xl border border-surface-700 hover:border-primary-500/50 transition-all"
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="text-4xl">{post.emoji}</span>
        <span className="text-xs text-primary-400 font-medium bg-primary-500/10 px-2 py-1 rounded">{post.category}</span>
      </div>
      <h3 className="text-lg font-semibold text-white group-hover:text-primary-400 transition-colors line-clamp-2 mb-2">
        {post.title}
      </h3>
      <p className="text-surface-400 text-sm line-clamp-3 mb-4">{post.excerpt}</p>
      <div className="flex items-center justify-between text-xs text-surface-500">
        <span>{post.author}</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {post.readTime} min</span>
          <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {post.views.toLocaleString()}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Full Post Reader ──────────────────────────────────────────────────────────

function PostReader({ post, onBack }: { post: BlogPost; onBack: () => void }) {
  const { getRelated, incrementViews } = useBlogStore();
  const navigate = useNavigate();
  const related = getRelated(post, 3);

  useEffect(() => {
    incrementViews(post.id);
    window.scrollTo(0, 0);
  }, [post.id]);

  return (
    <div className="min-h-screen bg-surface-900">
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-surface-700/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-surface-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Blog
          </button>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1 text-surface-400 hover:text-white text-sm transition-colors">
              <Share2 className="w-4 h-4" /> Share
            </button>
            <Link to="/" className="btn-primary text-sm px-4 py-2 rounded-lg">Try EduGenius Free</Link>
          </div>
        </div>
      </nav>

      <div className="pt-28 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs text-primary-400 bg-primary-500/10 px-3 py-1 rounded-full font-medium">{post.category}</span>
              {post.examTags.map(tag => (
                <span key={tag} className="text-xs text-surface-400 bg-surface-800 px-2 py-0.5 rounded">#{tag}</span>
              ))}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">{post.title}</h1>
            <p className="text-xl text-surface-300 mb-6">{post.excerpt}</p>

            <div className="flex flex-wrap items-center gap-4 text-sm text-surface-400 pb-6 border-b border-surface-700">
              <span className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-xs font-bold">
                  {post.author[0]}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{post.author}</p>
                  {post.authorRole && <p className="text-xs text-surface-500">{post.authorRole}</p>}
                </div>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {post.readTime} min read</span>
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {post.views.toLocaleString()} views</span>
              {post.generatedByAI && (
                <span className="flex items-center gap-1 text-accent-400"><Sparkles className="w-3 h-3" /> AI Generated</span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="prose-blog">
            {post.sections.map((section, i) => (
              <RenderSection key={i} section={section} />
            ))}
          </div>

          {/* Internal Links */}
          {post.internalLinks.length > 0 && (
            <div className="mt-8 p-5 bg-surface-800 rounded-xl border border-surface-700">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary-400" /> Continue Learning
              </h4>
              <div className="space-y-2">
                {post.internalLinks.map((link, i) => (
                  <Link key={i} to={link.url} className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-700 transition-colors group">
                    <span className="text-sm text-surface-300 group-hover:text-white">{link.context}</span>
                    <span className="text-xs text-primary-400 flex items-center gap-1">{link.text} <ChevronRight className="w-3 h-3" /></span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {post.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-xs text-surface-400 bg-surface-800 border border-surface-700 px-3 py-1 rounded-full">
                  <Tag className="w-3 h-3" /> {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Related Posts */}
        {related.length > 0 && (
          <div className="max-w-3xl mx-auto mt-12">
            <h3 className="text-xl font-bold text-white mb-4">Related Articles</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {related.map(p => (
                <button key={p.id} onClick={() => navigate(`/website/blog/${p.slug}`)}
                  className="text-left p-4 bg-surface-800 rounded-xl border border-surface-700 hover:border-primary-500/50 transition-all group">
                  <span className="text-2xl block mb-2">{p.emoji}</span>
                  <p className="text-sm font-medium text-white group-hover:text-primary-400 transition-colors line-clamp-2">{p.title}</p>
                  <p className="text-xs text-surface-500 mt-2">{p.readTime} min read</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Generate Modal ────────────────────────────────────────────────────────────

function GenerateModal({ onClose, onGenerated }: { onClose: () => void; onGenerated: (post: BlogPost) => void }) {
  const { generatePost, isGenerating } = useBlogStore();
  const [form, setForm] = useState<GenerateRequest>({
    topic: '',
    examTag: 'JEE',
    contentType: 'educational',
    targetWordCount: 800,
    keywords: [],
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [generated, setGenerated] = useState<BlogPost | null>(null);
  const [error, setError] = useState('');

  const examOptions: ExamTag[] = ['JEE', 'NEET', 'CBSE_10', 'CBSE_12', 'CAT', 'UPSC', 'GATE', 'ICSE', 'General'];
  const contentTypes: ContentType[] = ['educational', 'exam-tips', 'strategy', 'success-story', 'news', 'comparison', 'how-to'];

  const handleGenerate = async () => {
    if (!form.topic.trim()) { setError('Topic is required'); return; }
    setError('');
    try {
      const post = await generatePost(form);
      setGenerated(post);
    } catch {
      setError('Generation failed. Please try again.');
    }
  };

  const addKeyword = () => {
    if (keywordInput.trim()) {
      setForm(f => ({ ...f, keywords: [...(f.keywords || []), keywordInput.trim()] }));
      setKeywordInput('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {generated ? (
          <div className="text-center py-4">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Post Generated!</h3>
            <p className="text-surface-400 mb-2">"{generated.title}"</p>
            <p className="text-sm text-surface-500 mb-6">Saved as <span className="text-yellow-400">Draft</span> — review and publish when ready.</p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 btn-secondary py-2 rounded-lg text-sm">Close</button>
              <button onClick={() => { onGenerated(generated); onClose(); }} className="flex-1 btn-primary py-2 rounded-lg text-sm">
                View Post
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent-400" />
                <h3 className="text-lg font-bold text-white">Generate with Atlas AI</h3>
              </div>
              <button onClick={onClose} className="text-surface-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-surface-400 mb-1 block">Topic *</label>
                <input
                  className="input w-full"
                  placeholder="e.g. Electromagnetic Induction, Cell Biology, Quadratic Equations..."
                  value={form.topic}
                  onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-surface-400 mb-1 block">Exam</label>
                  <select className="input w-full" value={form.examTag} onChange={e => setForm(f => ({ ...f, examTag: e.target.value as ExamTag }))}>
                    {examOptions.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-surface-400 mb-1 block">Content Type</label>
                  <select className="input w-full" value={form.contentType} onChange={e => setForm(f => ({ ...f, contentType: e.target.value as ContentType }))}>
                    {contentTypes.map(c => <option key={c} value={c}>{c.replace('-', ' ')}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-surface-400 mb-1 block">Word Count</label>
                <select className="input w-full" value={form.targetWordCount} onChange={e => setForm(f => ({ ...f, targetWordCount: +e.target.value }))}>
                  {[400, 600, 800, 1000, 1500, 2000].map(n => <option key={n} value={n}>{n} words (~{Math.round(n/200)} min read)</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-surface-400 mb-1 block">SEO Keywords (optional)</label>
                <div className="flex gap-2">
                  <input className="input flex-1" placeholder="Add keyword..." value={keywordInput}
                    onChange={e => setKeywordInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addKeyword()} />
                  <button onClick={addKeyword} className="btn-secondary px-3 rounded-lg text-sm">Add</button>
                </div>
                {(form.keywords || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {form.keywords!.map((kw, i) => (
                      <span key={i} className="text-xs bg-surface-800 text-surface-300 px-2 py-0.5 rounded flex items-center gap-1">
                        {kw}
                        <button onClick={() => setForm(f => ({ ...f, keywords: f.keywords!.filter((_, j) => j !== i) }))}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}

              <button onClick={handleGenerate} disabled={isGenerating} className="btn-primary w-full py-2.5 rounded-lg flex items-center justify-center gap-2">
                {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate Post</>}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

// ─── Admin Blog Manager ────────────────────────────────────────────────────────

function AdminBlogManager() {
  const { posts, layout, generatePost, publishPost, pinPost, archivePost, deletePost, isGenerating } = useBlogStore();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  const categories = ['All', ...Array.from(new Set(posts.map(p => p.category)))];

  const filtered = posts.filter(p => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const stats = {
    total: posts.length,
    published: posts.filter(p => p.status === 'published').length,
    draft: posts.filter(p => p.status === 'draft').length,
    avgScore: posts.length ? Math.round(posts.reduce((s, p) => s + p.qualityScore, 0) / posts.length) : 0,
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      published: 'bg-green-500/10 text-green-400',
      draft: 'bg-yellow-500/10 text-yellow-400',
      scheduled: 'bg-blue-500/10 text-blue-400',
      archived: 'bg-surface-700 text-surface-500',
      review: 'bg-purple-500/10 text-purple-400',
    };
    return <span className={`px-2 py-0.5 rounded text-xs ${styles[status] || styles.draft}`}>{status}</span>;
  };

  if (selectedPost) {
    return <PostReader post={selectedPost} onBack={() => setSelectedPost(null)} />;
  }

  return (
    <div className="space-y-5">
      {showGenerateModal && (
        <GenerateModal onClose={() => setShowGenerateModal(false)} onGenerated={(post) => setSelectedPost(post)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Blog Manager</h1>
          <p className="text-surface-400 text-sm">
            AI Layout: <span className="text-accent-400 font-medium capitalize">{layout.layout}</span>
            <span className="text-surface-600 ml-2">— {layout.reason}</span>
          </p>
        </div>
        <button onClick={() => setShowGenerateModal(true)} className="btn-primary flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Generate with AI
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Posts', value: stats.total, icon: '📝', color: 'text-blue-400' },
          { label: 'Published', value: stats.published, icon: '✅', color: 'text-green-400' },
          { label: 'Drafts', value: stats.draft, icon: '📋', color: 'text-yellow-400' },
          { label: 'Avg Quality', value: `${stats.avgScore}%`, icon: '⭐', color: 'text-purple-400' },
        ].map((stat, i) => (
          <div key={i} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl">{stat.icon}</span>
              <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
            </div>
            <p className="text-sm text-surface-400 mt-2">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${selectedCategory === cat ? 'bg-primary-600 text-white' : 'bg-surface-800 text-surface-400 hover:bg-surface-700'}`}>
              {cat}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input className="input pl-9 w-56 text-sm" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Posts Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead className="bg-surface-800/50">
            <tr>
              {['Title', 'Category', 'Author', 'Scores', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-700/50">
            {filtered.map(post => (
              <tr key={post.id} className="hover:bg-surface-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{post.emoji}</span>
                    <div>
                      <p className="font-medium text-white text-sm line-clamp-1">{post.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-surface-500">{post.readTime} min</span>
                        {post.generatedByAI && <span className="text-xs text-accent-400 flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" />AI</span>}
                        {post.pinned && <span className="text-xs text-yellow-400 flex items-center gap-0.5"><Pin className="w-2.5 h-2.5" />Pinned</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-primary-500/10 text-primary-400 text-xs rounded">{post.category}</span>
                </td>
                <td className="px-4 py-3 text-surface-400 text-sm">{post.author}</td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-surface-500 w-12">Quality</span>
                      <div className="flex-1 h-1.5 bg-surface-700 rounded-full w-16">
                        <div className="h-full rounded-full bg-green-500" style={{ width: `${post.qualityScore}%` }} />
                      </div>
                      <span className="text-surface-400">{post.qualityScore}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-surface-500 w-12">SEO</span>
                      <div className="flex-1 h-1.5 bg-surface-700 rounded-full w-16">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${post.seoScore}%` }} />
                      </div>
                      <span className="text-surface-400">{post.seoScore}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{statusBadge(post.status)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button title="View" onClick={() => setSelectedPost(post)} className="p-1.5 hover:bg-surface-700 rounded transition-colors">
                      <Eye className="w-3.5 h-3.5 text-surface-400" />
                    </button>
                    <button title={post.pinned ? 'Unpin' : 'Pin'} onClick={() => pinPost(post.id, !post.pinned)} className="p-1.5 hover:bg-surface-700 rounded transition-colors">
                      {post.pinned ? <PinOff className="w-3.5 h-3.5 text-yellow-400" /> : <Pin className="w-3.5 h-3.5 text-surface-400" />}
                    </button>
                    {post.status !== 'published' && (
                      <button title="Publish" onClick={() => publishPost(post.id)} className="p-1.5 hover:bg-green-500/10 rounded transition-colors">
                        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                      </button>
                    )}
                    <button title="Archive" onClick={() => archivePost(post.id)} className="p-1.5 hover:bg-surface-700 rounded transition-colors">
                      <BarChart2 className="w-3.5 h-3.5 text-surface-400" />
                    </button>
                    <button title="Delete" onClick={() => deletePost(post.id)} className="p-1.5 hover:bg-red-500/10 rounded transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <Search className="w-8 h-8 text-surface-600 mx-auto mb-3" />
            <p className="text-surface-400">No posts found</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Public Blog (Dynamic AI Layout) ──────────────────────────────────────────

interface BlogProps {
  adminMode?: boolean;
}

export default function Blog({ adminMode = false }: BlogProps) {
  const { posts, layout, getPublished } = useBlogStore();
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  const published = getPublished();

  // If slug in URL, show that post
  useEffect(() => {
    if (slug) {
      const found = posts.find(p => p.slug === slug);
      if (found) setSelectedPost(found);
    } else {
      setSelectedPost(null);
    }
  }, [slug, posts]);

  const openPost = (post: BlogPost) => {
    setSelectedPost(post);
    navigate(`/website/blog/${post.slug}`);
  };

  const goBack = () => {
    setSelectedPost(null);
    navigate('/website/blog');
  };

  if (adminMode) return <AdminBlogManager />;
  if (selectedPost) return <PostReader post={selectedPost} onBack={goBack} />;

  // Persona-aware content sorting
  // Only activate if student has an explicitly saved persona (not default)
  const studentPersona = (() => {
    try {
      const stored = localStorage.getItem('edugenius_student_persona');
      if (!stored) return null;
      return loadPersona();
    } catch { return null; }
  })();
  const personaExam = studentPersona?.exam; // e.g. 'JEE_MAIN'
  const personaWeakSubjects = studentPersona?.weakSubjects ?? [];

  function personaRelevanceScore(post: BlogPost): number {
    let score = 0;
    // Exam match
    if (personaExam) {
      const examNorm = personaExam.replace('_', '').toLowerCase();
      const postExams = post.examTags.map(t => t.toLowerCase().replace('_', ''));
      if (postExams.some(t => t.includes(examNorm) || examNorm.includes(t))) score += 3;
    }
    // Weak subject match
    for (const subj of personaWeakSubjects) {
      const subjLower = subj.toLowerCase();
      if (post.title.toLowerCase().includes(subjLower) || post.excerpt.toLowerCase().includes(subjLower)) {
        score += 2;
      }
    }
    // Pinned bonus
    if (post.pinned) score += 1;
    return score;
  }

  // Filter
  const filtered = published
    .filter(p => {
      const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesSearch = !searchQuery ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    })
    .sort((a, b) => personaRelevanceScore(b) - personaRelevanceScore(a));

  // If persona is active, show a "personalised for you" banner
  const isPersonalised = !!studentPersona;

  const heroPost = layout.heroPostId ? published.find(p => p.id === layout.heroPostId) : null;
  const featuredPosts = layout.featuredPostIds.map(id => published.find(p => p.id === id)).filter(Boolean) as BlogPost[];
  const restPosts = filtered.filter(p => p.id !== layout.heroPostId && !layout.featuredPostIds.includes(p.id));

  return (
    <div className="min-h-screen bg-surface-900">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-surface-700/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/website" className="flex items-center gap-2">
            <span className="text-2xl">🎓</span>
            <span className="text-xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">EduGenius</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-surface-400 hover:text-white text-sm transition-colors">Login</Link>
            <Link to="/website/signup" className="btn-primary text-sm px-4 py-2 rounded-lg">Start Free</Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-28 pb-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white">Blog</h1>
              <p className="text-surface-400 mt-1">Study strategies, exam insights, and success stories from our AI content engine</p>
            </div>
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
              <input className="pl-9 pr-4 py-2 bg-surface-800 border border-surface-700 rounded-xl text-white text-sm placeholder-surface-500 focus:outline-none focus:border-primary-500 w-56"
                placeholder="Search articles..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>

          {/* Persona-aware banner */}
          {isPersonalised && (
            <div className="mb-4 flex items-center gap-3 px-4 py-2.5 bg-primary-500/10 border border-primary-500/20 rounded-xl text-sm">
              <span className="text-primary-400">🎯</span>
              <span className="text-primary-300">
                Showing content personalised for{' '}
                <strong>{String(studentPersona!.exam).replace(/_/g, ' ')}</strong>
                {personaWeakSubjects.length > 0 && (
                  <> · Prioritising <strong>{personaWeakSubjects[0]}</strong> (your top focus area)</>
                )}
              </span>
            </div>
          )}

          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            {layout.categoryOrder.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm transition-colors ${selectedCategory === cat ? 'bg-primary-600 text-white' : 'bg-surface-800 text-surface-400 hover:bg-surface-700'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Dynamic Layout */}
      <div className="px-6 pb-20">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* MINIMAL — no posts */}
          {layout.layout === 'minimal' && (
            <div className="text-center py-20">
              <span className="text-6xl block mb-4">📝</span>
              <h2 className="text-2xl font-bold text-white mb-2">No posts yet</h2>
              <p className="text-surface-400">Check back soon for study guides and exam strategies.</p>
            </div>
          )}

          {/* HERO-FOCUS or MAGAZINE — Hero post prominent */}
          {(layout.layout === 'hero-focus' || layout.layout === 'magazine') && heroPost && !searchQuery && selectedCategory === 'All' && (
            <HeroCard post={heroPost} onClick={() => openPost(heroPost)} />
          )}

          {/* MAGAZINE — featured posts sidebar */}
          {layout.layout === 'magazine' && featuredPosts.length > 0 && !searchQuery && selectedCategory === 'All' && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-400" /> Trending
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {featuredPosts.map(post => (
                  <FeaturedCard key={post.id} post={post} onClick={() => openPost(post)} />
                ))}
              </div>
            </div>
          )}

          {/* All / filtered posts — GRID (default for all layouts) */}
          {filtered.length > 0 && (
            <div>
              {(searchQuery || selectedCategory !== 'All') ? (
                <p className="text-sm text-surface-500 mb-4">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
              ) : (
                <h2 className="text-lg font-semibold text-white mb-4">
                  {layout.layout === 'minimal' ? '' : 'All Articles'}
                </h2>
              )}
              <div className="grid md:grid-cols-3 gap-5">
                {(searchQuery || selectedCategory !== 'All' ? filtered : restPosts).map(post => (
                  <GridCard key={post.id} post={post} onClick={() => openPost(post)} />
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && layout.layout !== 'minimal' && (
            <div className="text-center py-12">
              <Search className="w-8 h-8 text-surface-600 mx-auto mb-3" />
              <p className="text-surface-400">No articles found. Try a different search or category.</p>
            </div>
          )}
        </div>
      </div>

      {/* Newsletter */}
      <section className="py-16 px-6 bg-gradient-to-r from-primary-900/30 to-accent-900/30 border-t border-surface-700/30">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Get Study Tips in Your Inbox</h2>
          <p className="text-surface-400 mb-6">Weekly AI-curated insights, strategies, and updates.</p>
          <div className="flex gap-3 max-w-md mx-auto">
            <input type="email" placeholder="Enter your email"
              className="flex-1 px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-white placeholder-surface-500 focus:outline-none focus:border-primary-500 text-sm" />
            <button className="btn-primary px-6 py-3 rounded-xl text-sm">Subscribe</button>
          </div>
        </div>
      </section>
    </div>
  );
}
