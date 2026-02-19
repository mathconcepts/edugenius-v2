/**
 * Content Management — CEO/Admin view
 * Generation sources: Prompt | Document Upload | External API/MCP | AI Agent
 */
import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Globe, Bot, Sparkles,
  X, Check, Loader2, Eye, Edit3, BarChart3, Plus,
} from 'lucide-react';
import { clsx } from 'clsx';
import { AgentWorkflowPanel } from '@/components/AgentWorkflowPanel';

// ── Types & data ─────────────────────────────────────────────────────────────

interface ContentItem {
  id: string; title: string; type: 'question' | 'lesson' | 'blog' | 'video';
  subject: string; status: 'draft' | 'review' | 'published' | 'ai-generating';
  author: string; createdAt: string; views?: number; engagement?: number;
}

const mockContent: ContentItem[] = [
  { id: '1', title: 'Electromagnetic Induction — Complete Guide', type: 'lesson', subject: 'Physics', status: 'published', author: 'Atlas AI', createdAt: '2026-02-17', views: 1250, engagement: 85 },
  { id: '2', title: 'Organic Chemistry Reactions MCQs', type: 'question', subject: 'Chemistry', status: 'published', author: 'Atlas AI', createdAt: '2026-02-17', views: 890, engagement: 78 },
  { id: '3', title: 'Integration Techniques — Video Script', type: 'video', subject: 'Mathematics', status: 'review', author: 'Atlas AI', createdAt: '2026-02-16' },
  { id: '4', title: 'JEE 2026 Strategy Blog', type: 'blog', subject: 'General', status: 'ai-generating', author: 'Atlas AI', createdAt: '2026-02-17' },
  { id: '5', title: 'Thermodynamics Practice Set', type: 'question', subject: 'Physics', status: 'draft', author: 'Atlas AI', createdAt: '2026-02-16' },
];

const contentStats = { totalContent: 2847, publishedToday: 24, aiGenerated: 89, avgEngagement: 76 };

const EXAM_OPTIONS = ['JEE Main', 'JEE Advanced', 'NEET', 'CBSE Class 10', 'CBSE Class 12', 'CAT', 'UPSC', 'GATE'];
const CONTENT_TYPES = ['MCQ Questions', 'Lesson Notes', 'Summary', 'Quiz', 'Flashcards', 'Video Script', 'Blog Post'];
const AGENTS = [
  { id: 'atlas', name: 'Atlas', emoji: '📚', desc: 'Questions, lessons, study notes' },
  { id: 'herald', name: 'Herald', emoji: '📢', desc: 'Blog posts, marketing content' },
  { id: 'scout', name: 'Scout', emoji: '🔍', desc: 'Research reports, competitive analysis' },
];

const SOURCE_TABS = [
  { id: 'prompt', icon: Sparkles, label: 'Prompt' },
  { id: 'document', icon: Upload, label: 'Document' },
  { id: 'api', icon: Globe, label: 'API / MCP' },
  { id: 'agent', icon: Bot, label: 'AI Agent' },
] as const;

type SourceTab = typeof SOURCE_TABS[number]['id'];

function statusColor(s: string) {
  switch (s) {
    case 'published': return 'bg-green-500/20 text-green-400';
    case 'review': return 'bg-yellow-500/20 text-yellow-400';
    case 'draft': return 'bg-surface-600 text-surface-300';
    case 'ai-generating': return 'bg-primary-500/20 text-primary-400';
    default: return 'bg-surface-600 text-surface-300';
  }
}
function typeIcon(t: string) {
  switch (t) {
    case 'question': return '❓'; case 'lesson': return '📚';
    case 'blog': return '📝'; case 'video': return '🎥'; default: return '📄';
  }
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return '📕';
  if (ext === 'docx' || ext === 'doc') return '📘';
  if (ext === 'pptx' || ext === 'ppt') return '📙';
  if (ext === 'txt') return '📃';
  return '📄';
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Source panels ─────────────────────────────────────────────────────────────

function PromptPanel() {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setGenerating(true); setDone(false);
    setTimeout(() => { setGenerating(false); setDone(true); setTimeout(() => setDone(false), 3000); }, 2800);
  };

  return (
    <div className="space-y-3">
      <textarea
        value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
        placeholder='e.g. "10 MCQs on Electromagnetic Induction for JEE 2026, medium difficulty, with explanations"'
        className="input w-full resize-none text-sm"
      />
      <div className="flex flex-wrap gap-2">
        {['10 MCQs on Optics', 'Lesson on Organic Chemistry', 'JEE Strategy Blog', 'Flashcards: Thermodynamics'].map(p => (
          <button key={p} onClick={() => setPrompt(p)}
            className="text-xs px-2.5 py-1.5 bg-surface-700 hover:bg-surface-600 rounded-lg transition-colors">{p}</button>
        ))}
      </div>
      <button onClick={handleGenerate} disabled={!prompt.trim() || generating}
        className={clsx('flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all',
          prompt.trim() ? 'bg-primary-500 hover:bg-primary-400 text-white' : 'bg-surface-700 text-surface-500 cursor-not-allowed')}>
        {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
          : done ? <><Check className="w-4 h-4" /> Done!</>
          : <><Sparkles className="w-4 h-4" /> Generate with AI</>}
      </button>
    </div>
  );
}

type DocState = 'idle' | 'uploading' | 'extracting' | 'generating' | 'done';

function DocumentPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [docState, setDocState] = useState<DocState>('idle');
  const [contentType, setContentType] = useState(CONTENT_TYPES[0]);
  const [examCtx, setExamCtx] = useState(EXAM_OPTIONS[0]);
  const [preview, setPreview] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setDocState('idle');
    setPreview('');
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleGenerate = () => {
    if (!file) return;
    setDocState('uploading');
    setTimeout(() => setDocState('extracting'), 1000);
    setTimeout(() => {
      setPreview(`Extracted from "${file.name}":\n\nChapter 3: Electromagnetic Induction\n\nFaraday's law states that the induced EMF in any closed circuit is equal to the negative of the time rate of change of the magnetic flux enclosed by the circuit. This fundamental principle forms the basis of electric generators and transformers. The magnitude of the induced EMF is given by ε = -dΦ/dt where Φ is the magnetic flux...`);
      setDocState('generating');
    }, 2200);
    setTimeout(() => setDocState('done'), 4000);
  };

  const stateLabel: Record<DocState, string> = {
    idle: '', uploading: 'Uploading document...', extracting: 'Extracting content...',
    generating: 'Generating with AI...', done: 'Content ready!'
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {!file ? (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={clsx(
            'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all',
            isDragging ? 'border-primary-500 bg-primary-500/5' : 'border-surface-600 hover:border-surface-500 hover:bg-surface-800/30'
          )}
        >
          <input ref={inputRef} type="file" className="hidden"
            accept=".pdf,.docx,.doc,.pptx,.ppt,.txt"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          <Upload className="w-8 h-8 text-surface-400 mx-auto mb-3" />
          <p className="font-medium text-sm mb-1">Drop your document here or <span className="text-primary-400">browse</span></p>
          <p className="text-xs text-surface-500">Supports PDF, DOCX, PPTX, TXT</p>
          <div className="flex justify-center gap-3 mt-4">
            {['📕 PDF', '📘 DOCX', '📙 PPTX', '📃 TXT'].map(t => (
              <span key={t} className="text-xs px-2 py-1 bg-surface-700/50 rounded-lg">{t}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-surface-800/50 border border-surface-700/50 flex items-center gap-3">
          <span className="text-2xl">{fileIcon(file.name)}</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{file.name}</p>
            <p className="text-xs text-surface-500">{fileSizeLabel(file.size)}</p>
          </div>
          <button onClick={() => { setFile(null); setDocState('idle'); setPreview(''); }}
            className="p-1.5 hover:bg-surface-700 rounded-lg transition-colors">
            <X className="w-4 h-4 text-surface-400" />
          </button>
        </div>
      )}

      {file && (
        <>
          {/* Options */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-surface-400 mb-1.5 block">Generate as</label>
              <select className="input w-full text-sm" value={contentType} onChange={e => setContentType(e.target.value)}>
                {CONTENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1.5 block">For exam</label>
              <select className="input w-full text-sm" value={examCtx} onChange={e => setExamCtx(e.target.value)}>
                {EXAM_OPTIONS.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
          </div>

          {/* State indicator */}
          {docState !== 'idle' && docState !== 'done' && (
            <div className="flex items-center gap-2 text-sm text-primary-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              {stateLabel[docState]}
            </div>
          )}
          {docState === 'done' && (
            <div className="flex items-center gap-2 text-sm text-green-400">
              <Check className="w-4 h-4" /> {stateLabel.done}
            </div>
          )}

          {/* Extracted preview */}
          {preview && (
            <div className="p-3 rounded-xl bg-surface-900/80 border border-surface-700/50">
              <p className="text-[10px] text-surface-500 mb-2 uppercase tracking-wider">Extracted Preview</p>
              <p className="text-xs text-surface-300 leading-relaxed whitespace-pre-line line-clamp-4">{preview}</p>
            </div>
          )}

          <button onClick={handleGenerate} disabled={docState !== 'idle' && docState !== 'done'}
            className={clsx('flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all',
              docState === 'idle' || docState === 'done'
                ? 'bg-primary-500 hover:bg-primary-400 text-white'
                : 'bg-surface-700 text-surface-500 cursor-not-allowed')}>
            <Upload className="w-4 h-4" />
            {docState === 'done' ? 'Generate Again' : `Generate ${contentType} from Document`}
          </button>
        </>
      )}
    </div>
  );
}

function ApiPanel() {
  const [url, setUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [done, setDone] = useState(false);

  const handleFetch = () => {
    if (!url.trim()) return;
    setFetching(true); setDone(false);
    setTimeout(() => { setFetching(false); setDone(true); setTimeout(() => setDone(false), 3000); }, 2500);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-surface-400 mb-1.5 block">Source URL or MCP Endpoint</label>
        <input className="input w-full text-sm" placeholder="https://api.example.com/content or mcp://server/resource"
          value={url} onChange={e => setUrl(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-surface-400 mb-1.5 block">Content type to generate</label>
          <select className="input w-full text-sm">
            {CONTENT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-surface-400 mb-1.5 block">For exam</label>
          <select className="input w-full text-sm">
            {EXAM_OPTIONS.map(e => <option key={e}>{e}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {['Khan Academy API', 'NCERT JSON feed', 'OpenStax RSS', 'Custom MCP server'].map(p => (
          <button key={p} onClick={() => setUrl(`https://api.${p.toLowerCase().replace(/ /g, '')}.com`)}
            className="text-xs px-2.5 py-1.5 bg-surface-700 hover:bg-surface-600 rounded-lg transition-colors">{p}</button>
        ))}
      </div>
      <button onClick={handleFetch} disabled={!url.trim() || fetching}
        className={clsx('flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all',
          url.trim() ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-surface-700 text-surface-500 cursor-not-allowed')}>
        {fetching ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching...</>
          : done ? <><Check className="w-4 h-4" /> Done!</>
          : <><Globe className="w-4 h-4" /> Fetch & Generate</>}
      </button>
    </div>
  );
}

const AGENT_TO_WORKFLOW: Record<string, string> = {
  atlas: 'generate_content',
  herald: 'blog_post',
  scout: 'growth_strategy',
};

const AGENT_PRESETS: Record<string, Array<{ label: string; topic: string; contentType: string }>> = {
  atlas: [
    { label: 'Generate 20 JEE MCQs on Modern Physics', topic: 'Modern Physics', contentType: 'question' },
    { label: 'Create NEET Biology lesson on Cell Division', topic: 'Cell Division', contentType: 'lesson' },
    { label: 'Make a practice quiz on Organic Chemistry', topic: 'Organic Chemistry', contentType: 'quiz' },
  ],
  herald: [
    { label: 'Write SEO blog: Top 10 JEE Preparation Tips', topic: 'JEE Preparation Tips', contentType: 'blog' },
    { label: 'Blog: NEET success stories and strategies', topic: 'NEET Success Stories', contentType: 'blog' },
    { label: 'Blog: How to crack CAT in 3 months', topic: 'CAT Preparation Strategy', contentType: 'blog' },
  ],
  scout: [
    { label: 'Research competitor pricing for JEE coaching', topic: 'JEE coaching market', contentType: 'research' },
    { label: 'Analyse top-performing EdTech content formats', topic: 'EdTech content formats', contentType: 'research' },
    { label: 'Find trending topics in competitive exam prep', topic: 'competitive exam trends', contentType: 'research' },
  ],
};

function AgentPanel() {
  const [agent, setAgent] = useState(AGENTS[0]);
  const [selectedPreset, setSelectedPreset] = useState<{ label: string; topic: string; contentType: string } | null>(null);
  const [started, setStarted] = useState(false);
  const [complete, setComplete] = useState(false);

  const presets = AGENT_PRESETS[agent.id] || [];
  const workflowId = AGENT_TO_WORKFLOW[agent.id] || 'generate_content';

  const handleAgentSwitch = (a: typeof AGENTS[0]) => {
    setAgent(a);
    setSelectedPreset(null);
    setStarted(false);
    setComplete(false);
  };

  const handleRun = () => {
    if (!selectedPreset) return;
    setStarted(true);
    setComplete(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-surface-400 mb-2">Select agent</p>
        <div className="grid grid-cols-3 gap-2">
          {AGENTS.map(a => (
            <button key={a.id} onClick={() => handleAgentSwitch(a)}
              className={clsx('flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center',
                agent.id === a.id ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700 bg-surface-800/50 hover:border-surface-600')}>
              <span className="text-xl">{a.emoji}</span>
              <p className="text-xs font-semibold">{a.name}</p>
              <p className="text-[10px] text-surface-500 leading-tight">{a.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {!started ? (
        <>
          <div>
            <p className="text-xs text-surface-400 mb-2">Quick presets for {agent.name}</p>
            <div className="space-y-1.5">
              {presets.map(p => (
                <button key={p.label} onClick={() => setSelectedPreset(p)}
                  className={clsx('w-full text-left text-xs px-3 py-2.5 rounded-xl transition-colors',
                    selectedPreset?.label === p.label
                      ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                      : 'bg-surface-800/50 hover:bg-surface-700 text-surface-300')}>
                  <span className="text-accent-400 mr-1.5">›</span>{p.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleRun} disabled={!selectedPreset}
            className={clsx('flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all',
              selectedPreset ? 'bg-accent-600 hover:bg-accent-500 text-white' : 'bg-surface-700 text-surface-500 cursor-not-allowed')}>
            {agent.emoji} Run with {agent.name}
          </button>
        </>
      ) : (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-surface-800/50 border border-surface-700/50">
            <p className="text-xs text-surface-400 mb-1">Running</p>
            <p className="text-sm font-medium">{selectedPreset?.label}</p>
          </div>

          <AgentWorkflowPanel
            workflowId={workflowId}
            inputs={{
              topic: selectedPreset?.topic,
              contentType: selectedPreset?.contentType,
              agent: agent.name,
            }}
            autoStart={true}
            showFlowDiagram={true}
            onComplete={() => setComplete(true)}
          />

          {complete && (
            <button
              onClick={() => { setStarted(false); setComplete(false); setSelectedPreset(null); }}
              className="w-full py-2 rounded-xl border border-surface-700 text-surface-400 hover:bg-surface-800 text-sm transition-all"
            >
              ← Back to presets
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Content() {
  const [activeSource, setActiveSource] = useState<SourceTab>('prompt');
  const [filter, setFilter] = useState('all');

  const filteredContent = filter === 'all'
    ? mockContent
    : mockContent.filter(c => c.status === filter || c.type === filter);

  return (
    <div className="space-y-6 pb-8">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card"><p className="text-surface-400 text-sm">Total Content</p><p className="text-2xl font-bold">{contentStats.totalContent.toLocaleString()}</p></div>
        <div className="card"><p className="text-surface-400 text-sm">Published Today</p><p className="text-2xl font-bold text-green-400">{contentStats.publishedToday}</p></div>
        <div className="card"><p className="text-surface-400 text-sm">AI Generated</p><p className="text-2xl font-bold text-primary-400">{contentStats.aiGenerated}%</p></div>
        <div className="card"><p className="text-surface-400 text-sm">Avg Engagement</p><p className="text-2xl font-bold text-accent-400">{contentStats.avgEngagement}%</p></div>
      </div>

      {/* ── Generation Sources ── */}
      <div className="card bg-gradient-to-br from-primary-600/5 to-accent-600/5 border border-primary-500/20">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🤖</span>
          <h3 className="font-bold">Generate Content</h3>
        </div>

        {/* Source tabs */}
        <div className="flex gap-1 mb-5 p-1 bg-surface-800/60 rounded-xl w-fit">
          {SOURCE_TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveSource(tab.id)}
              className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                activeSource === tab.id
                  ? 'bg-primary-500 text-white shadow-lg'
                  : 'text-surface-400 hover:text-white hover:bg-surface-700')}>
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active source panel */}
        <AnimatePresence mode="wait">
          <motion.div key={activeSource}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}>
            {activeSource === 'prompt' && <PromptPanel />}
            {activeSource === 'document' && <DocumentPanel />}
            {activeSource === 'api' && <ApiPanel />}
            {activeSource === 'agent' && <AgentPanel />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Content list */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Content Library</h3>
          <div className="flex gap-2">
            <select value={filter} onChange={e => setFilter(e.target.value)}
              className="input text-sm py-1.5">
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="review">In Review</option>
              <option value="draft">Drafts</option>
              <option value="question">Questions</option>
              <option value="lesson">Lessons</option>
              <option value="blog">Blogs</option>
            </select>
            <button className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Create
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-surface-400 text-xs border-b border-surface-700/50">
                <th className="pb-3 font-medium">Content</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Subject</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Performance</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {filteredContent.map(item => (
                <tr key={item.id} className="hover:bg-surface-800/30 transition-colors">
                  <td className="py-3.5">
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-xs text-surface-500">{item.createdAt} · {item.author}</p>
                  </td>
                  <td className="py-3.5">
                    <span className="flex items-center gap-1 text-sm text-surface-300">
                      <span>{typeIcon(item.type)}</span>
                      <span className="capitalize">{item.type}</span>
                    </span>
                  </td>
                  <td className="py-3.5 text-sm text-surface-300">{item.subject}</td>
                  <td className="py-3.5">
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs', statusColor(item.status))}>
                      {item.status === 'ai-generating' ? '⚡ Generating' : item.status}
                    </span>
                  </td>
                  <td className="py-3.5 text-sm">
                    {item.views
                      ? <div><p className="text-white">{item.views.toLocaleString()} views</p><p className="text-xs text-surface-400">{item.engagement}% engagement</p></div>
                      : <span className="text-surface-500">—</span>}
                  </td>
                  <td className="py-3.5">
                    <div className="flex gap-1">
                      <button className="p-1.5 hover:bg-surface-700 rounded-lg transition-colors" title="Preview"><Eye className="w-3.5 h-3.5 text-surface-400" /></button>
                      <button className="p-1.5 hover:bg-surface-700 rounded-lg transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5 text-surface-400" /></button>
                      <button className="p-1.5 hover:bg-surface-700 rounded-lg transition-colors" title="Analytics"><BarChart3 className="w-3.5 h-3.5 text-surface-400" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pipeline */}
      <div className="card">
        <h3 className="font-semibold mb-4">Pipeline (Today)</h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'AI Generating', value: 12, color: 'text-primary-400' },
            { label: 'In Review', value: 8, color: 'text-yellow-400' },
            { label: 'Published', value: 24, color: 'text-green-400' },
            { label: 'Scheduled', value: 156, color: 'text-accent-400' },
          ].map(s => (
            <div key={s.label} className="p-4 bg-surface-800/50 rounded-xl text-center">
              <p className={clsx('text-3xl font-bold', s.color)}>{s.value}</p>
              <p className="text-xs text-surface-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
