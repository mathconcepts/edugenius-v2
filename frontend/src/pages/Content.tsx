/**
 * Content Management — CEO/Admin view
 * Generation sources: Prompt | Document Upload | API / MCP | AI Agent | Wolfram ∑
 */
import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Globe, Bot, Sparkles,
  X, Check, Loader2, Eye, Edit3, BarChart3, Plus, Brain,
  Calculator, Download, RefreshCw, ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';
import { AgentWorkflowPanel } from '@/components/AgentWorkflowPanel';
import { getCohortInsights } from '@/services/personaContentBridge';
import {
  generateContent,
  type GenerationRequest,
  type GeneratedContent,
  type MCQItem,
  type ContentOutputFormat,
  type ContentSource,
} from '@/services/contentGenerationService';
import { queryWolfram, isWolframAvailable } from '@/services/wolframService';

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
const CONTENT_TYPES: { value: ContentOutputFormat; label: string }[] = [
  { value: 'mcq_set', label: 'MCQ Questions' },
  { value: 'lesson_notes', label: 'Lesson Notes' },
  { value: 'summary', label: 'Summary' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'flashcard_set', label: 'Flashcards' },
  { value: 'formula_sheet', label: 'Formula Sheet' },
  { value: 'worked_example', label: 'Worked Example' },
  { value: 'blog_post', label: 'Blog Post' },
];
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
  { id: 'wolfram', icon: Calculator, label: 'Wolfram ∑' },
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

// ── Progress Bar ──────────────────────────────────────────────────────────────

interface ProgressBarProps {
  step: string;
  pct: number;
}
function ProgressBar({ step, pct }: ProgressBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-primary-300 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          {step}
        </span>
        <span className="text-surface-400">{pct}%</span>
      </div>
      <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </div>
  );
}

// ── Content Output Preview ────────────────────────────────────────────────────

interface ContentOutputProps {
  content: GeneratedContent;
  onReset: () => void;
}
function ContentOutput({ content, onReset }: ContentOutputProps) {
  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${content.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get first MCQ for preview
  const firstMcq = Array.isArray(content.structured) && content.structured.length > 0
    && 'options' in content.structured[0]
    ? content.structured[0] as MCQItem
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 space-y-4 border-t border-surface-700/50 pt-4"
    >
      {/* Header badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-1 rounded-lg bg-primary-500/20 text-primary-300 text-xs font-medium">
          {content.format.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
        </span>
        <span className="px-2 py-1 rounded-lg bg-surface-700 text-surface-300 text-xs">
          {content.examTarget}
        </span>
        {content.wolframVerified && (
          <span className="px-2 py-1 rounded-lg bg-green-500/20 text-green-400 text-xs flex items-center gap-1">
            <Check className="w-3 h-3" /> Wolfram Verified
          </span>
        )}
        <span className="ml-auto text-xs text-surface-500">
          {content.wordCount} words · {Math.round(content.confidence * 100)}% confidence
        </span>
      </div>

      {/* Title */}
      <h4 className="font-semibold text-sm text-white">{content.title}</h4>

      {/* MCQ preview */}
      {firstMcq && (
        <div className="p-3 rounded-xl bg-surface-900/80 border border-surface-700/50">
          <p className="text-[10px] text-surface-500 uppercase tracking-wider mb-2">Preview — First Question</p>
          <p className="text-sm font-medium mb-3">{firstMcq.question}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(['A', 'B', 'C', 'D'] as const).map(key => (
              <div key={key} className={clsx(
                'px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5',
                key === firstMcq.correctAnswer
                  ? 'bg-green-500/15 text-green-300 border border-green-500/30'
                  : 'bg-surface-800/80 text-surface-400'
              )}>
                <span className="font-semibold">{key}.</span>
                {firstMcq.options[key]}
              </div>
            ))}
          </div>
          {firstMcq.wolframVerified && (
            <p className="text-[10px] text-green-400 mt-2 flex items-center gap-1">
              <Check className="w-3 h-3" /> Answer Wolfram-verified
            </p>
          )}
        </div>
      )}

      {/* Text content preview (for non-MCQ formats) */}
      {!firstMcq && content.content && (
        <div className="p-3 rounded-xl bg-surface-900/80 border border-surface-700/50">
          <p className="text-[10px] text-surface-500 uppercase tracking-wider mb-2">Content Preview</p>
          <p className="text-xs text-surface-300 leading-relaxed line-clamp-6 whitespace-pre-line">
            {content.content.slice(0, 500)}…
          </p>
        </div>
      )}

      {/* Wolfram steps */}
      {content.wolframSteps && content.wolframSteps.length > 0 && (
        <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/20">
          <p className="text-[10px] text-green-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Calculator className="w-3 h-3" /> Wolfram Computation Steps
          </p>
          {content.wolframSteps.slice(0, 4).map((step, i) => (
            <p key={i} className="text-xs text-surface-300 py-0.5">{step}</p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => alert('Review & Publish workflow — integrate with your CMS')}
          className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5"
        >
          <Eye className="w-3.5 h-3.5" /> Review & Publish
        </button>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-surface-700 text-surface-300 hover:bg-surface-800 text-sm transition-all"
        >
          <Download className="w-3.5 h-3.5" /> Download JSON
        </button>
        <button
          onClick={onReset}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-surface-500 hover:text-surface-300 text-sm transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>
    </motion.div>
  );
}

// ── Source panels ─────────────────────────────────────────────────────────────

interface PanelWithOutputProps {
  onGenerated: (content: GeneratedContent) => void;
}

function PromptPanel({ onGenerated }: PanelWithOutputProps) {
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState<ContentOutputFormat>('mcq_set');
  const [exam, setExam] = useState(EXAM_OPTIONS[0]);
  const [count, setCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ step: '', pct: 0 });
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const request: GenerationRequest = {
        source: 'direct_prompt',
        sourceData: { prompt },
        outputFormat: format,
        examTarget: exam,
        count,
        useWolframVerification: isWolframAvailable(),
        useWolframGrounding: false,
      };
      const result = await generateContent(request, (step, pct) => setProgress({ step, pct }));
      onGenerated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
      setProgress({ step: '', pct: 0 });
    }
  };

  return (
    <div className="space-y-3">
      <textarea
        value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
        placeholder='e.g. "10 MCQs on Electromagnetic Induction for JEE 2026, medium difficulty, with explanations"'
        className="input w-full resize-none text-sm"
        disabled={generating}
      />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-surface-400 mb-1.5 block">Format</label>
          <select className="input w-full text-sm" value={format} onChange={e => setFormat(e.target.value as ContentOutputFormat)} disabled={generating}>
            {CONTENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-surface-400 mb-1.5 block">Exam</label>
          <select className="input w-full text-sm" value={exam} onChange={e => setExam(e.target.value)} disabled={generating}>
            {EXAM_OPTIONS.map(e => <option key={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-surface-400 mb-1.5 block">Count</label>
          <input type="number" min={1} max={50} className="input w-full text-sm" value={count}
            onChange={e => setCount(Number(e.target.value))} disabled={generating} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {['10 MCQs on Optics', 'Lesson on Organic Chemistry', 'JEE Strategy Blog', 'Flashcards: Thermodynamics'].map(p => (
          <button key={p} onClick={() => setPrompt(p)} disabled={generating}
            className="text-xs px-2.5 py-1.5 bg-surface-700 hover:bg-surface-600 rounded-lg transition-colors disabled:opacity-50">{p}</button>
        ))}
      </div>
      {generating && <ProgressBar step={progress.step || 'Generating...'} pct={progress.pct} />}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button onClick={handleGenerate} disabled={!prompt.trim() || generating}
        className={clsx('flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all',
          prompt.trim() && !generating ? 'bg-primary-500 hover:bg-primary-400 text-white' : 'bg-surface-700 text-surface-500 cursor-not-allowed')}>
        {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
          : <><Sparkles className="w-4 h-4" /> Generate with AI</>}
      </button>
    </div>
  );
}

type DocState = 'idle' | 'uploading' | 'extracting' | 'generating' | 'done';

function DocumentPanel({ onGenerated }: PanelWithOutputProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [docState, setDocState] = useState<DocState>('idle');
  const [contentType, setContentType] = useState<ContentOutputFormat>('mcq_set');
  const [examCtx, setExamCtx] = useState(EXAM_OPTIONS[0]);
  const [preview, setPreview] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [progress, setProgress] = useState({ step: '', pct: 0 });
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setDocState('idle');
    setPreview('');
    setExtractedText('');
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const readFileAsText = (f: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string ?? '');
    reader.onerror = reject;
    reader.readAsText(f);
  });

  const handleGenerate = async () => {
    if (!file) return;
    setDocState('uploading');
    setError('');
    setProgress({ step: 'Reading document...', pct: 10 });

    try {
      // For text files, read directly; otherwise show a placeholder
      let text = '';
      if (file.name.endsWith('.txt')) {
        text = await readFileAsText(file);
      } else {
        // Simulate extraction for PDF/DOCX (real implementation needs a parser)
        await new Promise(r => setTimeout(r, 1200));
        setDocState('extracting');
        setProgress({ step: 'Extracting content...', pct: 25 });
        await new Promise(r => setTimeout(r, 1000));
        text = `[Extracted from "${file.name}"] — In a production build, use a PDF/DOCX parser library (e.g. pdf-parse, mammoth) to extract text from this file. The content would be passed to the AI for content generation.`;
      }
      setExtractedText(text);
      setPreview(text.slice(0, 300));
      setDocState('generating');

      const request: GenerationRequest = {
        source: 'document_upload',
        sourceData: { documentText: text, prompt: `Generate ${contentType} from this document content` },
        outputFormat: contentType,
        examTarget: examCtx,
        count: 10,
        useWolframVerification: isWolframAvailable(),
        useWolframGrounding: false,
      };
      const result = await generateContent(request, (step, pct) => {
        setProgress({ step, pct: Math.max(pct, 30) });
      });
      onGenerated(result);
      setDocState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setDocState('idle');
    }
  };

  const stateLabel: Record<DocState, string> = {
    idle: '', uploading: 'Uploading document...', extracting: 'Extracting content...',
    generating: 'Generating with AI...', done: 'Content ready!'
  };

  return (
    <div className="space-y-4">
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
          <button onClick={() => { setFile(null); setDocState('idle'); setPreview(''); setExtractedText(''); }}
            className="p-1.5 hover:bg-surface-700 rounded-lg transition-colors">
            <X className="w-4 h-4 text-surface-400" />
          </button>
        </div>
      )}

      {file && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-surface-400 mb-1.5 block">Generate as</label>
              <select className="input w-full text-sm" value={contentType} onChange={e => setContentType(e.target.value as ContentOutputFormat)}>
                {CONTENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1.5 block">For exam</label>
              <select className="input w-full text-sm" value={examCtx} onChange={e => setExamCtx(e.target.value)}>
                {EXAM_OPTIONS.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
          </div>

          {docState !== 'idle' && docState !== 'done' && (
            <ProgressBar step={progress.step || stateLabel[docState]} pct={progress.pct} />
          )}
          {docState === 'done' && (
            <div className="flex items-center gap-2 text-sm text-green-400">
              <Check className="w-4 h-4" /> Content ready!
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}

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
            {docState === 'done' ? 'Generate Again' : `Generate ${CONTENT_TYPES.find(t => t.value === contentType)?.label} from Document`}
          </button>
        </>
      )}
    </div>
  );
}

function ApiPanel({ onGenerated }: PanelWithOutputProps) {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<ContentOutputFormat>('mcq_set');
  const [exam, setExam] = useState(EXAM_OPTIONS[0]);
  const [fetching, setFetching] = useState(false);
  const [progress, setProgress] = useState({ step: '', pct: 0 });
  const [error, setError] = useState('');

  const handleFetch = async () => {
    if (!url.trim()) return;
    setFetching(true);
    setError('');
    try {
      const isMcp = url.startsWith('mcp://');
      const request: GenerationRequest = {
        source: isMcp ? 'mcp_endpoint' : 'external_api',
        sourceData: isMcp ? { mcpEndpoint: url } : { apiUrl: url },
        outputFormat: format,
        examTarget: exam,
        count: 10,
        useWolframVerification: isWolframAvailable(),
        useWolframGrounding: false,
      };
      const result = await generateContent(request, (step, pct) => setProgress({ step, pct }));
      onGenerated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setFetching(false);
      setProgress({ step: '', pct: 0 });
    }
  };

  const PRESETS = [
    { label: 'Khan Academy API', url: 'https://api.khanacademy.org', badge: null },
    { label: 'NCERT JSON feed', url: 'https://ncert.nic.in/api/content', badge: null },
    { label: 'OpenStax RSS', url: 'https://openstax.org/api/books', badge: null },
    { label: 'Custom MCP server', url: 'mcp://localhost:3001/resources', badge: null },
    { label: 'Wolfram MCP', url: 'mcp://wolfram.com/foundation-tool', badge: 'Verified ✓' },
  ];

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-surface-400 mb-1.5 block">Source URL or MCP Endpoint</label>
        <input className="input w-full text-sm" placeholder="https://api.example.com/content or mcp://server/resource"
          value={url} onChange={e => setUrl(e.target.value)} disabled={fetching} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-surface-400 mb-1.5 block">Content type to generate</label>
          <select className="input w-full text-sm" value={format} onChange={e => setFormat(e.target.value as ContentOutputFormat)}>
            {CONTENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-surface-400 mb-1.5 block">For exam</label>
          <select className="input w-full text-sm" value={exam} onChange={e => setExam(e.target.value)}>
            {EXAM_OPTIONS.map(e => <option key={e}>{e}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => setUrl(p.url)} disabled={fetching}
            className="text-xs px-2.5 py-1.5 bg-surface-700 hover:bg-surface-600 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50">
            {p.label}
            {p.badge && (
              <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px] font-medium">{p.badge}</span>
            )}
          </button>
        ))}
      </div>
      {fetching && <ProgressBar step={progress.step || 'Fetching...'} pct={progress.pct} />}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button onClick={handleFetch} disabled={!url.trim() || fetching}
        className={clsx('flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all',
          url.trim() && !fetching ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-surface-700 text-surface-500 cursor-not-allowed')}>
        {fetching ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching...</>
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

function AgentPanel({ onGenerated: _onGenerated }: PanelWithOutputProps) {
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

// ── Wolfram Panel ─────────────────────────────────────────────────────────────

function WolframPanel({ onGenerated }: PanelWithOutputProps) {
  const [wolframQuery, setWolframQuery] = useState('');
  const [format, setFormat] = useState<ContentOutputFormat>('mcq_set');
  const [exam, setExam] = useState(EXAM_OPTIONS[0]);
  const [count, setCount] = useState(10);
  const [useGrounding, setUseGrounding] = useState(true);
  const [useVerification, setUseVerification] = useState(true);
  const [wolframPreview, setWolframPreview] = useState('');
  const [computing, setComputing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ step: '', pct: 0 });
  const [error, setError] = useState('');
  const wolframAvailable = isWolframAvailable();

  const WOLFRAM_PRESETS = [
    'integrate x^2 * e^x dx',
    'eigenvalues of [[2,1],[1,3]]',
    'solve x^3 - 6x^2 + 11x - 6 = 0',
    'Maxwell\'s equations in differential form',
    'Fourier transform of Gaussian function',
    'entropy of ideal gas derivation',
  ];

  const handleComputeFirst = async () => {
    if (!wolframQuery.trim() || !wolframAvailable) return;
    setComputing(true);
    setError('');
    setWolframPreview('');
    try {
      const result = await queryWolfram(wolframQuery);
      if (result.success) {
        setWolframPreview(result.answer);
      } else {
        setError(`Wolfram: ${result.answer}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wolfram query failed');
    } finally {
      setComputing(false);
    }
  };

  const handleGenerate = async () => {
    if (!wolframQuery.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const request: GenerationRequest = {
        source: 'wolfram_grounded',
        sourceData: { wolframQuery, prompt: wolframQuery },
        outputFormat: format,
        examTarget: exam,
        count,
        useWolframVerification: useVerification && wolframAvailable,
        useWolframGrounding: useGrounding && wolframAvailable,
      };
      const result = await generateContent(request, (step, pct) => setProgress({ step, pct }));
      onGenerated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
      setProgress({ step: '', pct: 0 });
    }
  };

  if (!wolframAvailable) {
    return (
      <div className="space-y-4">
        <div className="p-5 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 space-y-3">
          <div className="flex items-start gap-3">
            <Calculator className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-300 text-sm mb-1">Wolfram not configured</p>
              <p className="text-xs text-surface-400 leading-relaxed">
                Add <code className="bg-surface-800 px-1.5 py-0.5 rounded text-yellow-300">WOLFRAM_APP_ID</code> to
                your Netlify environment variables to activate Wolfram-grounded content generation.
              </p>
            </div>
          </div>
          <a
            href="https://developer.wolframalpha.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Get a free Wolfram App ID →
          </a>
        </div>
        <div className="p-4 rounded-xl bg-surface-800/40 border border-surface-700/50">
          <p className="text-xs font-semibold text-surface-300 mb-2">What Wolfram ∑ unlocks:</p>
          <ul className="space-y-1.5 text-xs text-surface-400">
            <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-400" /> Deterministic math computation — every formula verified</li>
            <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-400" /> Wolfram-grounded MCQ generation — answers mathematically proven</li>
            <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-400" /> Step-by-step solutions with Wolfram Language code</li>
            <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-400" /> MCP integration for real-time computation in any workflow</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info badge */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
        <Calculator className="w-4 h-4 text-green-400 flex-shrink-0" />
        <p className="text-xs text-green-300">
          Wolfram connected — content will be grounded in deterministic computation
        </p>
        <span className="ml-auto px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px] font-medium">Active</span>
      </div>

      {/* Computation query */}
      <div>
        <label className="text-xs text-surface-400 mb-1.5 block">Computation query</label>
        <input
          className="input w-full text-sm"
          placeholder='e.g. "eigenvalue decomposition of 3x3 matrix" or "integrate x²e^x"'
          value={wolframQuery}
          onChange={e => setWolframQuery(e.target.value)}
          disabled={computing || generating}
        />
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {WOLFRAM_PRESETS.map(p => (
          <button key={p} onClick={() => setWolframQuery(p)} disabled={computing || generating}
            className="text-xs px-2.5 py-1 bg-surface-700 hover:bg-surface-600 rounded-lg transition-colors font-mono disabled:opacity-50">
            {p.length > 30 ? p.slice(0, 28) + '…' : p}
          </button>
        ))}
      </div>

      {/* Options row */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-surface-400 mb-1.5 block">Format</label>
          <select className="input w-full text-sm" value={format} onChange={e => setFormat(e.target.value as ContentOutputFormat)} disabled={generating}>
            {CONTENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-surface-400 mb-1.5 block">Exam</label>
          <select className="input w-full text-sm" value={exam} onChange={e => setExam(e.target.value)} disabled={generating}>
            {EXAM_OPTIONS.map(e => <option key={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-surface-400 mb-1.5 block">Count</label>
          <input type="number" min={1} max={30} className="input w-full text-sm" value={count}
            onChange={e => setCount(Number(e.target.value))} disabled={generating} />
        </div>
      </div>

      {/* Toggles */}
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={useGrounding} onChange={e => setUseGrounding(e.target.checked)}
            className="w-3.5 h-3.5 accent-primary-500" disabled={generating} />
          <span className="text-xs text-surface-300">Wolfram Grounded</span>
          <span className="text-[10px] text-primary-400 bg-primary-500/10 px-1.5 py-0.5 rounded">Recommended</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={useVerification} onChange={e => setUseVerification(e.target.checked)}
            className="w-3.5 h-3.5 accent-green-500" disabled={generating} />
          <span className="text-xs text-surface-300">Wolfram Verification</span>
        </label>
      </div>

      {/* Compute First button */}
      {!wolframPreview && (
        <button onClick={handleComputeFirst} disabled={!wolframQuery.trim() || computing || generating}
          className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all border',
            wolframQuery.trim() && !computing
              ? 'border-green-500/50 text-green-300 hover:bg-green-500/10'
              : 'border-surface-700 text-surface-500 cursor-not-allowed')}>
          {computing ? <><Loader2 className="w-4 h-4 animate-spin" /> Computing...</>
            : <><Calculator className="w-4 h-4" /> Compute First (preview result)</>}
        </button>
      )}

      {/* Wolfram result preview */}
      {wolframPreview && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-xl bg-green-500/5 border border-green-500/20"
        >
          <p className="text-[10px] text-green-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Check className="w-3 h-3" /> Wolfram Computation Result
          </p>
          <p className="text-sm text-white font-mono leading-relaxed whitespace-pre-wrap">{wolframPreview}</p>
          <p className="text-[10px] text-surface-500 mt-2">
            Content will be generated using these exact values — mathematically provable.
          </p>
        </motion.div>
      )}

      {/* Progress */}
      {generating && <ProgressBar step={progress.step || 'Computing + Generating...'} pct={progress.pct} />}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Generate button */}
      <button onClick={handleGenerate} disabled={!wolframQuery.trim() || generating || computing}
        className={clsx('flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all',
          wolframQuery.trim() && !generating && !computing
            ? 'bg-gradient-to-r from-primary-500 to-green-600 hover:from-primary-400 hover:to-green-500 text-white'
            : 'bg-surface-700 text-surface-500 cursor-not-allowed')}>
        {generating
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating Wolfram-grounded content...</>
          : wolframPreview
          ? <><Sparkles className="w-4 h-4" /> Generate Content from This</>
          : <><Calculator className="w-4 h-4" /> Compute & Generate</>}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Content() {
  const [activeSource, setActiveSource] = useState<SourceTab>('prompt');
  const [filter, setFilter] = useState('all');
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);

  const filteredContent = filter === 'all'
    ? mockContent
    : mockContent.filter(c => c.status === filter || c.type === filter);

  const cohortInsight = getCohortInsights();

  const handleGenerated = (content: GeneratedContent) => {
    setGeneratedContent(content);
  };

  const handleReset = () => {
    setGeneratedContent(null);
  };

  return (
    <div className="space-y-6 pb-8">

      {/* Student Signals Banner */}
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-gradient-to-r from-primary-600/10 to-accent-600/10 border border-primary-500/20 rounded-2xl">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-primary-400 flex-shrink-0" />
          <div>
            <p className="text-white text-sm font-medium">
              Content driven by{' '}
              <span className="text-primary-300">{cohortInsight.totalStudents.toLocaleString('en-IN')} student signals</span>
              {' '}· Top pain point:{' '}
              <span className="text-white font-semibold">{cohortInsight.topWeakTopics[0]?.topic.split('—')[0].trim() ?? '—'}</span>
            </p>
            <p className="text-surface-400 text-xs mt-0.5">
              {cohortInsight.contentOpportunities.filter(c => c.urgency === 'publish_now').length} urgent content pieces queued
              · Dominant emotion: {cohortInsight.dominantEmotion}
            </p>
          </div>
        </div>
        <Link
          to="/content-intelligence"
          className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          View Atlas Queue →
        </Link>
      </div>

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
          {isWolframAvailable() && (
            <span className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/15 text-green-400 text-[10px] font-medium border border-green-500/20">
              <Calculator className="w-3 h-3" /> Wolfram Active
            </span>
          )}
        </div>

        {/* Source tabs */}
        <div className="flex gap-1 mb-5 p-1 bg-surface-800/60 rounded-xl w-fit flex-wrap">
          {SOURCE_TABS.map(tab => (
            <button key={tab.id} onClick={() => { setActiveSource(tab.id); setGeneratedContent(null); }}
              className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                activeSource === tab.id
                  ? tab.id === 'wolfram'
                    ? 'bg-gradient-to-r from-primary-500 to-green-600 text-white shadow-lg'
                    : 'bg-primary-500 text-white shadow-lg'
                  : 'text-surface-400 hover:text-white hover:bg-surface-700')}>
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.id === 'wolfram' && !isWolframAvailable() && (
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 ml-0.5" title="Not configured" />
              )}
            </button>
          ))}
        </div>

        {/* Active source panel */}
        <AnimatePresence mode="wait">
          <motion.div key={activeSource}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}>
            {activeSource === 'prompt' && <PromptPanel onGenerated={handleGenerated} />}
            {activeSource === 'document' && <DocumentPanel onGenerated={handleGenerated} />}
            {activeSource === 'api' && <ApiPanel onGenerated={handleGenerated} />}
            {activeSource === 'agent' && <AgentPanel onGenerated={handleGenerated} />}
            {activeSource === 'wolfram' && <WolframPanel onGenerated={handleGenerated} />}
          </motion.div>
        </AnimatePresence>

        {/* Generated content output */}
        <AnimatePresence>
          {generatedContent && (
            <ContentOutput content={generatedContent} onReset={handleReset} />
          )}
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
