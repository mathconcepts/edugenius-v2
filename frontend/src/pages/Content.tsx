/**
 * Content Management — CEO/Admin view
 * Generation sources: Prompt | Document Upload | API / MCP | AI Agent | Wolfram ∑ | Batch ⚡ | Auto ⚙️
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Globe, Bot, Sparkles,
  X, Check, Loader2, Eye, Edit3, BarChart3, Plus, Brain,
  Calculator, Download, RefreshCw, ExternalLink, Zap, ChevronDown, ChevronUp, Settings,
  Clock, Gauge, Play, Pause, Square, AlertCircle,
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
import {
  createBatchJob,
  runBatchJobWithPrefetch,
  exportBatchResult,
  createBatchItemsFromTopics,
  type BatchJob,
  type BatchItem,
  type BatchProgress,
  type BatchResult,
} from '@/services/batchContentService';
import {
  updateConfig,
  getRateLimitConfig,
  getState as getRateLimitState,
  formatBackoffRemaining,
} from '@/services/rateLimitService';
import { getSourceBadge } from '@/services/contentArbitrationService';
import {
  startAutomationRun,
  cancelCurrentRun as cancelAutomationRun,
  updateAutomationConfig,
  selectTopicsForNextRun,
  getAutomationState,
  setAutomationStateDirectly,
  type AutomationRun,
  type ScoredTopic,
} from '@/services/contentAutomationService';
import { useContentStore } from '@/stores/contentStore';
import { getLiveExams } from '@/data/examRegistry';
import { BatchGenerationPanel } from '@/components/BatchGenerationPanel';

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
  { id: 'batch', icon: Zap, label: 'Batch ⚡' },
  { id: 'persona_batch', icon: Brain, label: 'Persona Batch 🎯' },
  { id: 'auto', icon: Settings, label: 'Auto ⚙️' },
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

// ── Batch Panel ───────────────────────────────────────────────────────────────

type BatchSourceMode = 'auto' | 'wolfram' | 'document' | 'llm';

interface BatchItemRowProps {
  item: BatchItem;
  onView: (item: BatchItem) => void;
}

function BatchItemRow({ item, onView }: BatchItemRowProps) {
  const statusIcon = () => {
    switch (item.status) {
      case 'done': return '✅';
      case 'failed': return '❌';
      case 'running': return '⏳';
      case 'retrying': return '🔄';
      case 'rate_limited': return '⏱';
      default: return '⬜';
    }
  };

  const badge = item.arbitration ? getSourceBadge(item.arbitration.path) : null;
  const topic =
    item.request.sourceData.prompt ??
    item.request.sourceData.wolframQuery ??
    item.request.topicId ??
    item.id;

  const badgeColorClass = () => {
    if (!badge) return 'bg-surface-700 text-surface-300';
    switch (badge.color) {
      case 'green': return 'bg-green-500/15 text-green-300 border border-green-500/25';
      case 'blue': return 'bg-blue-500/15 text-blue-300 border border-blue-500/25';
      default: return 'bg-surface-700/60 text-surface-300 border border-surface-600/30';
    }
  };

  return (
    <div className="flex items-center gap-2 py-2 text-sm border-b border-surface-800/50 last:border-0">
      <span className="text-base w-5 flex-shrink-0">{statusIcon()}</span>
      <span className="flex-1 min-w-0 truncate text-xs text-surface-200" title={topic}>{topic}</span>

      {badge && (
        <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0', badgeColorClass())}>
          {badge.icon} {badge.label.replace(/^[^ ]+ /, '')}
        </span>
      )}

      {item.result?.wolframVerified && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/20 flex-shrink-0 flex items-center gap-0.5">
          <Check className="w-2.5 h-2.5" /> Verified
        </span>
      )}

      {item.status === 'running' && (
        <span className="text-[10px] text-surface-500 flex-shrink-0 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> running…
        </span>
      )}

      {item.status === 'rate_limited' && (
        <span className="text-[10px] text-orange-400 flex-shrink-0 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Rate limited — waiting…
        </span>
      )}

      {item.status === 'retrying' && (
        <span className={clsx('text-[10px] flex-shrink-0', item.retryReason === 'rate_limit' ? 'text-orange-400' : 'text-yellow-400')}>
          {item.retryReason === 'rate_limit'
            ? '🔄 Rate limited — waiting…'
            : `❌ Failed (${item.retryCount}/2 retries)`}
        </span>
      )}

      {item.status === 'failed' && item.error && (
        <span className="text-[10px] text-red-400 flex-shrink-0 max-w-[120px] truncate" title={item.error}>
          {item.error.slice(0, 30)}
        </span>
      )}

      {item.status === 'done' && item.result && (
        <button
          onClick={() => onView(item)}
          className="text-[10px] px-2 py-0.5 rounded border border-surface-600 text-surface-400 hover:text-white hover:border-surface-400 transition-all flex-shrink-0"
        >
          View
        </button>
      )}
    </div>
  );
}

function BatchPanel({ onGenerated }: PanelWithOutputProps) {
  const [batchName, setBatchName] = useState('');
  const [exam, setExam] = useState(EXAM_OPTIONS[0]);
  const [format, setFormat] = useState<ContentOutputFormat>('mcq_set');
  const [count, setCount] = useState(10);
  const [topicsText, setTopicsText] = useState('');
  const [sourceMode, setSourceMode] = useState<BatchSourceMode>('auto');

  const [job, setJob] = useState<BatchJob | null>(null);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  // Rate limit config panel
  const [showRateLimitPanel, setShowRateLimitPanel] = useState(false);
  const [llmRpm, setLlmRpm] = useState(() => getRateLimitConfig('llm').requestsPerMinute);
  const [llmMinDelay, setLlmMinDelay] = useState(() => getRateLimitConfig('llm').minDelayMs);

  // Live backoff ticker for UI
  const [backoffDisplay, setBackoffDisplay] = useState('');
  useEffect(() => {
    if (!running) { setBackoffDisplay(''); return; }
    const id = setInterval(() => {
      setBackoffDisplay(formatBackoffRemaining('llm'));
    }, 500);
    return () => clearInterval(id);
  }, [running]);

  // For inline "View" modal
  const [viewItem, setViewItem] = useState<BatchItem | null>(null);

  const topics = topicsText
    .split('\n')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  const handleGenerate = async () => {
    if (topics.length === 0) return;
    setError('');
    setResult(null);

    const requests = createBatchItemsFromTopics(topics, exam, format, count);

    // Apply source mode override
    const overriddenRequests = requests.map(r => {
      if (sourceMode === 'wolfram') {
        return { ...r, source: 'wolfram_grounded' as const, useWolframGrounding: true };
      }
      if (sourceMode === 'document') {
        return { ...r, source: 'direct_prompt' as const, useWolframGrounding: false };
      }
      if (sourceMode === 'llm') {
        return {
          ...r,
          source: 'direct_prompt' as const,
          useWolframGrounding: false,
          useWolframVerification: false,
        };
      }
      return r; // auto — arbitration will decide
    });

    const newJob = createBatchJob(
      batchName.trim() || `${exam} ${format.replace(/_/g, ' ')} Batch`,
      overriddenRequests,
    );
    setJob(newJob);
    setRunning(true);

    try {
      const batchResult = await runBatchJobWithPrefetch(
        newJob,
        (p) => setProgress({ ...p }),
        () => setJob({ ...newJob }), // trigger re-render on item complete
      );
      setResult(batchResult);
      // Surface first successful item to the parent output panel
      const firstDone = batchResult.items.find(i => i.status === 'done' && i.result);
      if (firstDone?.result) {
        onGenerated(firstDone.result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch failed');
    } finally {
      setRunning(false);
    }
  };

  const handleExport = () => {
    if (!result) return;
    const json = exportBatchResult(result);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch_${result.jobId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setJob(null);
    setProgress(null);
    setResult(null);
    setRunning(false);
    setError('');
    setViewItem(null);
    setBackoffDisplay('');
  };

  const applyRateLimitPreset = (preset: 'conservative' | 'balanced' | 'aggressive') => {
    const presets = {
      conservative: { requestsPerMinute: 10, minDelayMs: 4000 },
      balanced:     { requestsPerMinute: 15, minDelayMs: 2500 },
      aggressive:   { requestsPerMinute: 20, minDelayMs: 1500 },
    };
    const cfg = presets[preset];
    updateConfig('llm', cfg);
    setLlmRpm(cfg.requestsPerMinute);
    setLlmMinDelay(cfg.minDelayMs);
  };

  const handleLlmRpmChange = (val: number) => {
    setLlmRpm(val);
    updateConfig('llm', { requestsPerMinute: val });
  };

  const handleLlmMinDelayChange = (val: number) => {
    setLlmMinDelay(val);
    updateConfig('llm', { minDelayMs: val });
  };

  const sourceModeOptions: Array<{ id: BatchSourceMode; label: string; desc: string }> = [
    { id: 'auto', label: '🔀 Auto', desc: 'Arbitration decides' },
    { id: 'wolfram', label: '🔢 Wolfram', desc: 'Always Wolfram CAG' },
    { id: 'document', label: '📄 Document', desc: 'Document/API source' },
    { id: 'llm', label: '🧠 LLM', desc: 'Direct LLM only' },
  ];

  const currentItems = job?.items ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-primary-500/5 border border-primary-500/20">
        <Zap className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-primary-300">Batch Generator</p>
          <p className="text-xs text-surface-400">Generate multiple content items at once with automatic source arbitration</p>
        </div>
      </div>

      {/* Config form */}
      {!running && !result && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-surface-400 mb-1.5 block">Batch Name (optional)</label>
              <input
                className="input w-full text-sm"
                placeholder="e.g. GATE EM MCQs — Week 12"
                value={batchName}
                onChange={e => setBatchName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1.5 block">Exam</label>
              <select className="input w-full text-sm" value={exam} onChange={e => setExam(e.target.value)}>
                {EXAM_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1.5 block">Format</label>
              <select className="input w-full text-sm" value={format} onChange={e => setFormat(e.target.value as ContentOutputFormat)}>
                {CONTENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1.5 block">Count per item</label>
              <input
                type="number" min={1} max={30} className="input w-full text-sm"
                value={count} onChange={e => setCount(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Topics textarea */}
          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">
              Topics — one per line ({topics.length} topic{topics.length !== 1 ? 's' : ''})
            </label>
            <textarea
              className="input w-full resize-none text-sm font-mono"
              rows={5}
              placeholder={'Laplace Transform\nNernst Equation\nMaxwell\'s Equations\nKirchhoff\'s Laws\nFourier Series'}
              value={topicsText}
              onChange={e => setTopicsText(e.target.value)}
            />
          </div>

          {/* Source mode selector */}
          <div>
            <label className="text-xs text-surface-400 mb-2 block">Source Mode</label>
            <div className="flex gap-2 flex-wrap">
              {sourceModeOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSourceMode(opt.id)}
                  className={clsx(
                    'flex flex-col items-start px-3 py-2 rounded-xl text-xs border transition-all',
                    sourceMode === opt.id
                      ? 'border-primary-500 bg-primary-500/15 text-primary-300'
                      : 'border-surface-700 bg-surface-800/40 text-surface-300 hover:border-surface-500',
                  )}
                >
                  <span className="font-semibold">{opt.label}</span>
                  <span className="text-[10px] text-surface-500 mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
            {sourceMode === 'auto' && (
              <p className="text-[10px] text-surface-500 mt-1.5">
                Auto mode: mathematical topics → Wolfram CAG; others → LLM
              </p>
            )}
          </div>

          {/* ⚙️ Rate Limits config panel */}
          <div className="border border-surface-700/60 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowRateLimitPanel(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-surface-400 hover:bg-surface-800/40 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" /> ⚙️ Rate Limits (LLM)
              </span>
              {showRateLimitPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showRateLimitPanel && (
              <div className="px-3 pb-3 pt-1 space-y-3 border-t border-surface-700/50 bg-surface-900/40">
                {/* Preset buttons */}
                <div>
                  <p className="text-[10px] text-surface-500 mb-1.5">Preset</p>
                  <div className="flex gap-2">
                    {([
                      { key: 'conservative', label: 'Conservative (10 RPM)', rpm: 10 },
                      { key: 'balanced',     label: 'Balanced (15 RPM)',     rpm: 15 },
                      { key: 'aggressive',   label: 'Aggressive (20 RPM)',   rpm: 20 },
                    ] as const).map(p => (
                      <button
                        key={p.key}
                        onClick={() => applyRateLimitPreset(p.key)}
                        className={clsx(
                          'text-[10px] px-2 py-1 rounded-lg border transition-all',
                          llmRpm === p.rpm
                            ? 'border-primary-500 bg-primary-500/15 text-primary-300'
                            : 'border-surface-700 text-surface-400 hover:border-surface-500',
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* RPM slider */}
                <div>
                  <label className="text-[10px] text-surface-400 flex items-center justify-between mb-1">
                    <span>LLM Requests/min</span>
                    <span className="text-primary-300 font-medium">{llmRpm} RPM</span>
                  </label>
                  <input
                    type="range" min={5} max={30} step={1}
                    value={llmRpm}
                    onChange={e => handleLlmRpmChange(Number(e.target.value))}
                    className="w-full accent-primary-500"
                  />
                  <div className="flex justify-between text-[9px] text-surface-600 mt-0.5">
                    <span>5 (Free tier)</span><span>30 (Paid tier)</span>
                  </div>
                </div>
                {/* Min delay */}
                <div>
                  <label className="text-[10px] text-surface-400 flex items-center justify-between mb-1">
                    <span>Min delay between calls</span>
                    <span className="text-primary-300 font-medium">{(llmMinDelay / 1000).toFixed(1)}s</span>
                  </label>
                  <input
                    type="range" min={500} max={10000} step={500}
                    value={llmMinDelay}
                    onChange={e => handleLlmMinDelayChange(Number(e.target.value))}
                    className="w-full accent-primary-500"
                  />
                  <div className="flex justify-between text-[9px] text-surface-600 mt-0.5">
                    <span>0.5s</span><span>10s</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={topics.length === 0}
            className={clsx(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all',
              topics.length > 0
                ? 'bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-400 hover:to-accent-400 text-white shadow-lg'
                : 'bg-surface-700 text-surface-500 cursor-not-allowed',
            )}
          >
            <Zap className="w-4 h-4" />
            Generate Batch ({topics.length} item{topics.length !== 1 ? 's' : ''}) ▶
          </button>
        </>
      )}

      {/* Progress panel */}
      {(running || result) && job && (
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{job.name}</p>
              <p className="text-xs text-surface-400">
                {progress
                  ? `${progress.done + progress.failed}/${progress.totalItems} done`
                  : `${job.items.length} items`}
                {result && ` · ✅ ${result.successCount} success · ❌ ${result.failCount} failed · 🔢 ${result.verifiedCount} verified`}
              </p>
            </div>
            {!running && result && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-surface-700 text-surface-400 hover:bg-surface-800 transition-all"
              >
                <RefreshCw className="w-3 h-3" /> New Batch
              </button>
            )}
          </div>

          {/* Rate limit status bar */}
          {progress && running && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Rate limit indicator */}
              {backoffDisplay && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-orange-500/15 text-orange-400 border border-orange-500/20">
                  <Clock className="w-3 h-3" /> Rate limited: waiting {backoffDisplay}
                </span>
              )}

              {/* Wolfram pre-fetch phase indicator */}
              {progress.prefetchPhase && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/20">
                  <Calculator className="w-3 h-3" />
                  Pre-fetching Wolfram {progress.prefetchDone}/{progress.prefetchTotal}
                </span>
              )}

              {/* Effective concurrency badge */}
              <span
                className={clsx(
                  'flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border',
                  progress.effectiveConcurrency < job.concurrency
                    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                    : 'bg-surface-700/60 text-surface-400 border-surface-600/30',
                )}
                title={progress.effectiveConcurrency < job.concurrency ? 'Reduced due to rate limiting' : 'Full concurrency'}
              >
                <Gauge className="w-3 h-3" />
                ⚡ {progress.effectiveConcurrency}/{job.concurrency} parallel
              </span>

              {/* ETA */}
              {progress.estimatedRemainingMs !== undefined && progress.estimatedRemainingMs > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-surface-400">
                  ~{progress.estimatedRemainingMs >= 60000
                    ? `${Math.floor(progress.estimatedRemainingMs / 60000)}m ${Math.ceil((progress.estimatedRemainingMs % 60000) / 1000)}s`
                    : `${Math.ceil(progress.estimatedRemainingMs / 1000)}s`} remaining
                </span>
              )}

              {/* Rate limit hit counter */}
              {progress.rateLimitHits > 0 && (
                <span className="text-[10px] text-orange-400/70">
                  {progress.rateLimitHits} rate limit{progress.rateLimitHits !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {/* Progress bar */}
          {progress && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-surface-400">
                  {running
                    ? progress.prefetchPhase
                      ? `🔢 ${progress.currentItem ?? 'Pre-fetching Wolfram…'}`
                      : progress.currentItem
                        ? `⏳ ${progress.currentItem.slice(0, 35)}…`
                        : 'Processing…'
                    : 'Complete'}
                </span>
                <span className="text-primary-300 font-medium">{progress.overallPercent}%</span>
              </div>
              <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
                <motion.div
                  className={clsx(
                    'h-full rounded-full',
                    progress.waitingForRateLimit
                      ? 'bg-gradient-to-r from-orange-500 to-yellow-500'
                      : 'bg-gradient-to-r from-primary-500 to-accent-500',
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.overallPercent}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
          )}

          {/* Item list */}
          <div className="bg-surface-900/60 rounded-xl border border-surface-700/50 px-3 py-1 max-h-64 overflow-y-auto">
            {currentItems.map(item => (
              <BatchItemRow
                key={item.id}
                item={item}
                onView={setViewItem}
              />
            ))}
          </div>

          {/* Export button */}
          {result && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-600 text-surface-300 hover:bg-surface-800 text-sm transition-all"
            >
              <Download className="w-4 h-4" /> Export All JSON ⬇
            </button>
          )}
        </div>
      )}

      {/* Inline view modal */}
      <AnimatePresence>
        {viewItem?.result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="border-t border-surface-700/50 pt-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-surface-300">
                {viewItem.result.title}
              </p>
              <button
                onClick={() => setViewItem(null)}
                className="p-1 hover:bg-surface-700 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5 text-surface-400" />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-surface-900/80 border border-surface-700/50 max-h-48 overflow-y-auto">
              <p className="text-xs text-surface-300 whitespace-pre-line leading-relaxed">
                {viewItem.result.content.slice(0, 800)}
                {viewItem.result.content.length > 800 ? '…' : ''}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {viewItem.result.wolframVerified && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/20 flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" /> Wolfram Verified
                </span>
              )}
              <span className="text-[10px] px-2 py-0.5 rounded bg-surface-700 text-surface-300">
                {viewItem.result.wordCount} words
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-surface-700 text-surface-300">
                {Math.round(viewItem.result.confidence * 100)}% confidence
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Automation Panel ──────────────────────────────────────────────────────────

function AutomationPanel({ onGenerated }: PanelWithOutputProps) {
  const store = useContentStore();
  const {
    config,
    automationStatus,
    currentRun,
    runHistory,
    totalGenerated,
    totalVerified,
    setAutomationEnabled,
    updateConfig: storeUpdateConfig,
    addGeneratedContentBulk,
    setCurrentRun,
    setAutomationStatus,
    addRunToHistory,
    incrementTotals,
  } = store;

  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [topicQueue, setTopicQueue] = useState<ScoredTopic[]>([]);
  const [error, setError] = useState('');

  // Refresh topic queue on mount and every 30s
  useEffect(() => {
    const refreshQueue = () => {
      const state = getAutomationState();
      const scored = selectTopicsForNextRun(state);
      setTopicQueue(scored);
    };
    refreshQueue();
    const id = setInterval(refreshQueue, 30000);
    return () => clearInterval(id);
  }, [config]);

  // Auto-start logic
  useEffect(() => {
    if (config.enabled && config.triggerMode === 'continuous' && automationStatus === 'idle') {
      handleRunNow();
    }
    let timer: ReturnType<typeof setInterval> | null = null;
    if (config.enabled && config.triggerMode === 'scheduled') {
      const intervalMs = config.intervalMinutes * 60 * 1000;
      timer = setInterval(() => {
        if (automationStatus === 'idle') handleRunNow();
      }, intervalMs);
    }
    return () => { if (timer) clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.enabled, config.triggerMode, config.intervalMinutes, automationStatus]);

  const handleRunNow = async () => {
    if (automationStatus === 'running') return;
    setError('');
    setBatchProgress(null);
    setAutomationStatus('running');

    // Sync config to singleton before running
    updateAutomationConfig(config);

    const currentState = getAutomationState();

    try {
      const run = await startAutomationRun(
        { ...currentState, config },
        (p) => {
          setBatchProgress({ ...p });
          // Sync current run id into store
          const latest = getAutomationState();
          if (latest.currentRun) setCurrentRun(latest.currentRun);
        },
        (completedRun, newContent) => {
          // Sync completed run back to store
          addRunToHistory(completedRun);
          addGeneratedContentBulk(newContent);
          incrementTotals(newContent.length, completedRun.verifiedCount);
          setCurrentRun(completedRun);

          // Surface first item to parent output panel
          if (newContent.length > 0) {
            onGenerated(newContent[0]);
          }

          // Refresh topic queue after run
          const updatedState = getAutomationState();
          setTopicQueue(selectTopicsForNextRun(updatedState));
        },
      );

      if (run.status === 'cancelled') {
        setAutomationStatus('idle');
      } else if (run.status === 'failed') {
        setAutomationStatus('error');
        setError(run.error ?? 'Automation run failed');
      } else {
        setAutomationStatus('idle');
      }
    } catch (err) {
      setAutomationStatus('error');
      setError(err instanceof Error ? err.message : 'Automation failed');
    } finally {
      setBatchProgress(null);
    }
  };

  const handlePause = () => {
    setAutomationStatus('paused');
    setAutomationStateDirectly({ status: 'paused' });
  };

  const handleStop = () => {
    cancelAutomationRun();
    setAutomationStatus('idle');
    setCurrentRun(undefined);
    setBatchProgress(null);
    setError('');
  };

  const handleConfigChange = <K extends keyof typeof config>(
    key: K,
    value: typeof config[K],
  ) => {
    storeUpdateConfig({ [key]: value });
    updateAutomationConfig({ [key]: value });
  };

  const liveExams = getLiveExams();

  // Status badge
  const statusBadge = () => {
    switch (automationStatus) {
      case 'running':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold border border-green-500/30">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> RUNNING
          </span>
        );
      case 'paused':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-semibold border border-yellow-500/30">
            <Pause className="w-3 h-3" /> PAUSED
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/30">
            <AlertCircle className="w-3 h-3" /> ERROR
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-700 text-surface-400 text-xs font-semibold border border-surface-600">
            <span className="w-2 h-2 rounded-full bg-surface-500" /> IDLE
          </span>
        );
    }
  };

  // Format duration between two ISO strings
  const formatDuration = (startStr: string, endStr?: string): string => {
    const start = new Date(startStr).getTime();
    const end = endStr ? new Date(endStr).getTime() : Date.now();
    const ms = end - start;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-primary-500/10 to-accent-500/10 border border-primary-500/25">
        <span className="text-2xl">🤖</span>
        <div className="flex-1">
          <p className="font-bold text-white">Content Automation</p>
          <p className="text-xs text-surface-400 mt-0.5">
            Continuously generates content for all live exams — scored by competitor gaps, freshness, and exam priority
          </p>
        </div>
        {statusBadge()}
      </div>

      {/* ── Status strip ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-surface-800/50 border border-surface-700/50 text-center">
          <p className="text-xl font-bold text-primary-300">{totalGenerated}</p>
          <p className="text-[10px] text-surface-500 mt-0.5">Total Generated</p>
        </div>
        <div className="p-3 rounded-xl bg-surface-800/50 border border-surface-700/50 text-center">
          <p className="text-xl font-bold text-green-300">{totalVerified}</p>
          <p className="text-[10px] text-surface-500 mt-0.5">Wolfram Verified</p>
        </div>
        <div className="p-3 rounded-xl bg-surface-800/50 border border-surface-700/50 text-center">
          <p className="text-xl font-bold text-accent-300">{runHistory.length}</p>
          <p className="text-[10px] text-surface-500 mt-0.5">Runs Completed</p>
        </div>
      </div>

      {/* ── Configuration ── */}
      <div className="space-y-3 p-4 rounded-xl border border-surface-700/50 bg-surface-900/30">
        <p className="text-xs font-semibold text-surface-300 uppercase tracking-wider flex items-center gap-2">
          <Settings className="w-3.5 h-3.5" /> Configuration
        </p>

        {/* Enabled toggle + trigger mode */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">Automation</label>
            <button
              onClick={() => {
                const next = !config.enabled;
                setAutomationEnabled(next);
                handleConfigChange('enabled', next);
              }}
              className={clsx(
                'w-full py-2 rounded-xl text-sm font-medium border transition-all',
                config.enabled
                  ? 'bg-green-500/15 border-green-500/40 text-green-300'
                  : 'bg-surface-800 border-surface-700 text-surface-400 hover:border-surface-500',
              )}
            >
              {config.enabled ? '✓ Enabled' : 'Disabled'}
            </button>
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">Trigger Mode</label>
            <select
              className="input w-full text-sm"
              value={config.triggerMode}
              onChange={e => handleConfigChange('triggerMode', e.target.value as typeof config.triggerMode)}
            >
              <option value="manual">Manual</option>
              <option value="scheduled">Every {config.intervalMinutes}min</option>
              <option value="gap_driven">Gap Driven</option>
              <option value="continuous">Continuous</option>
            </select>
          </div>
        </div>

        {/* Interval (only for scheduled) */}
        {config.triggerMode === 'scheduled' && (
          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">
              Interval — {config.intervalMinutes} minutes
            </label>
            <input
              type="range" min={15} max={480} step={15}
              value={config.intervalMinutes}
              onChange={e => handleConfigChange('intervalMinutes', Number(e.target.value))}
              className="w-full accent-primary-500"
            />
            <div className="flex justify-between text-[9px] text-surface-600 mt-0.5">
              <span>15m</span><span>8h</span>
            </div>
          </div>
        )}

        {/* Target exams */}
        <div>
          <label className="text-xs text-surface-400 mb-1.5 block">Target Exams</label>
          <div className="flex flex-wrap gap-1.5">
            {liveExams.map(exam => {
              const active = config.targetExams.includes(exam.id);
              return (
                <button
                  key={exam.id}
                  onClick={() => {
                    const next = active
                      ? config.targetExams.filter(id => id !== exam.id)
                      : [...config.targetExams, exam.id];
                    handleConfigChange('targetExams', next);
                  }}
                  className={clsx(
                    'text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1',
                    active
                      ? 'bg-primary-500/20 border-primary-500/50 text-primary-300'
                      : 'bg-surface-800 border-surface-700 text-surface-400 hover:border-surface-500',
                  )}
                >
                  {active && <Check className="w-2.5 h-2.5" />}
                  {exam.shortName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Format + counts row */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">Format</label>
            <select
              className="input w-full text-xs"
              value={config.targetFormats[0] ?? 'mcq_set'}
              onChange={e =>
                handleConfigChange('targetFormats', [e.target.value as ContentOutputFormat])
              }
            >
              {CONTENT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">Count/topic</label>
            <input
              type="number" min={1} max={30} className="input w-full text-xs"
              value={config.countPerTopic}
              onChange={e => handleConfigChange('countPerTopic', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">Per batch</label>
            <input
              type="number" min={1} max={20} className="input w-full text-xs"
              value={config.itemsPerBatch}
              onChange={e => handleConfigChange('itemsPerBatch', Number(e.target.value))}
            />
          </div>
        </div>

        {/* Checkboxes */}
        <div className="flex flex-col gap-2">
          {[
            {
              key: 'prioritizeCompetitorGaps' as const,
              label: 'Prioritise competitor gaps',
              desc: '+30 score for underserved topics',
            },
            {
              key: 'prioritizeStaleContent' as const,
              label: `Regenerate stale content (>${config.stalenessThresholdDays} days)`,
              desc: '+15 score for old content',
            },
            {
              key: 'autoPublish' as const,
              label: 'Auto-mark ready for review',
              desc: 'Sets readyForReview=true on all generated items',
            },
          ].map(({ key, label, desc }) => (
            <label key={key} className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={config[key] as boolean}
                onChange={e => handleConfigChange(key, e.target.checked)}
                className="w-3.5 h-3.5 accent-primary-500 mt-0.5 flex-shrink-0"
              />
              <div>
                <span className="text-xs text-surface-200">{label}</span>
                <p className="text-[10px] text-surface-500">{desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* ── Topic Queue ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-surface-300 uppercase tracking-wider">
            🎯 Topic Queue (next run)
          </p>
          <button
            onClick={() => {
              const state = getAutomationState();
              updateAutomationConfig(config);
              setTopicQueue(selectTopicsForNextRun({ ...state, config }));
            }}
            className="text-[10px] text-surface-500 hover:text-surface-300 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {topicQueue.length === 0 ? (
          <p className="text-xs text-surface-500 py-3 text-center">
            No topics selected — check exam targets above
          </p>
        ) : (
          <div className="space-y-1">
            {topicQueue.map((t, i) => (
              <div
                key={`${t.examId}::${t.topicId}`}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-800/40 border border-surface-700/40"
              >
                <span className="text-xs text-surface-500 w-4 flex-shrink-0">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate capitalize">
                    {t.topicId.replace(/-/g, ' ')}
                  </p>
                  <p className="text-[10px] text-surface-500">{t.examName}</p>
                </div>
                <span className="text-[10px] font-semibold text-accent-300">
                  Score: {t.score}
                </span>
                <span className={clsx(
                  'text-[10px] px-1.5 py-0.5 rounded font-medium',
                  t.suggestedFormat === 'mcq_set'
                    ? 'bg-green-500/15 text-green-400'
                    : t.suggestedFormat === 'blog_post'
                    ? 'bg-blue-500/15 text-blue-400'
                    : 'bg-surface-700 text-surface-400',
                )}>
                  {t.suggestedFormat === 'mcq_set' ? '🔢 W' : t.suggestedFormat === 'blog_post' ? '📝 B' : '🧠 L'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Action buttons ── */}
      <div className="flex gap-2">
        <button
          onClick={handleRunNow}
          disabled={automationStatus === 'running' || topicQueue.length === 0}
          className={clsx(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all',
            automationStatus !== 'running' && topicQueue.length > 0
              ? 'bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-400 hover:to-accent-400 text-white shadow-lg'
              : 'bg-surface-700 text-surface-500 cursor-not-allowed',
          )}
        >
          {automationStatus === 'running'
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Running…</>
            : <><Play className="w-4 h-4" /> Run Now</>}
        </button>

        {automationStatus === 'running' && (
          <>
            <button
              onClick={handlePause}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10 transition-all"
            >
              <Pause className="w-4 h-4" /> Pause
            </button>
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-all"
            >
              <Square className="w-4 h-4" /> Stop
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* ── Current Run Progress ── */}
      {automationStatus === 'running' && batchProgress && (
        <div className="space-y-2 p-4 rounded-xl bg-surface-900/40 border border-surface-700/50">
          <p className="text-xs font-semibold text-surface-300 uppercase tracking-wider">
            📊 Current Run
          </p>

          {/* Prefetch phase indicator */}
          {batchProgress.prefetchPhase && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/20 w-fit">
              <Calculator className="w-3 h-3" />
              Pre-fetching Wolfram {batchProgress.prefetchDone}/{batchProgress.prefetchTotal}
            </span>
          )}

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-400 truncate max-w-[70%]">
                {batchProgress.currentItem
                  ? `⏳ ${batchProgress.currentItem.slice(0, 40)}`
                  : 'Processing…'}
              </span>
              <span className="text-primary-300 font-medium">{batchProgress.overallPercent}%</span>
            </div>
            <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
              <motion.div
                className={clsx(
                  'h-full rounded-full',
                  batchProgress.waitingForRateLimit
                    ? 'bg-gradient-to-r from-orange-500 to-yellow-500'
                    : 'bg-gradient-to-r from-primary-500 to-accent-500',
                )}
                initial={{ width: 0 }}
                animate={{ width: `${batchProgress.overallPercent}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-3 flex-wrap text-[10px] text-surface-400">
            <span>✅ {batchProgress.done} done</span>
            <span>❌ {batchProgress.failed} failed</span>
            <span>🔢 {batchProgress.verifiedCount} verified</span>
            {batchProgress.rateLimitHits > 0 && (
              <span className="text-orange-400">
                {batchProgress.rateLimitHits} rate limit{batchProgress.rateLimitHits !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Run History ── */}
      {runHistory.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-surface-300 uppercase tracking-wider">
            📋 Run History
          </p>
          <div className="rounded-xl border border-surface-700/50 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-700/50 text-[10px] text-surface-500 uppercase tracking-wider">
                  <th className="px-3 py-2 text-left font-medium">Time</th>
                  <th className="px-3 py-2 text-left font-medium">Topics</th>
                  <th className="px-3 py-2 text-left font-medium">Result</th>
                  <th className="px-3 py-2 text-left font-medium">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/50">
                {runHistory.map(run => (
                  <tr
                    key={run.id}
                    className="hover:bg-surface-800/20 transition-colors"
                  >
                    <td className="px-3 py-2.5 text-surface-400">
                      {new Date(run.startedAt).toLocaleString(undefined, {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-2.5 text-surface-300">
                      {run.topicsAttempted.length} topics
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="text-green-400">✅ {run.topicsSucceeded.length}</span>
                        <span className="text-red-400">❌ {run.topicsFailed.length}</span>
                        {run.verifiedCount > 0 && (
                          <span className="text-green-300">🔢 {run.verifiedCount}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-surface-400">
                      {run.completedAt
                        ? formatDuration(run.startedAt, run.completedAt)
                        : '—'}
                      {run.status === 'cancelled' && (
                        <span className="ml-1.5 text-[9px] text-yellow-400">cancelled</span>
                      )}
                      {run.status === 'failed' && (
                        <span className="ml-1.5 text-[9px] text-red-400">failed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

// ── Convert GeneratedContent to ContentItem (for the table) ──────────────────

function generatedToContentItem(g: GeneratedContent): ContentItem {
  const typeMap: Record<string, ContentItem['type']> = {
    mcq_set: 'question',
    quiz: 'question',
    lesson_notes: 'lesson',
    blog_post: 'blog',
    flashcard_set: 'lesson',
    formula_sheet: 'lesson',
    worked_example: 'lesson',
    summary: 'lesson',
  };
  return {
    id: g.id,
    title: g.title,
    type: typeMap[g.format] ?? 'lesson',
    subject: g.examTarget,
    status: g.readyForReview ? 'review' : 'draft',
    author: '🤖 AI Auto',
    createdAt: new Date(g.generatedAt).toISOString().split('T')[0],
  };
}

export default function Content() {
  const [activeSource, setActiveSource] = useState<SourceTab>('prompt');
  const [filter, setFilter] = useState('all');
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);

  const { generatedContent: autoContent } = useContentStore();

  // Merge mock + auto-generated content for the table
  const autoItems: ContentItem[] = autoContent.slice(0, 50).map(generatedToContentItem);
  const allContent: ContentItem[] = [...autoItems, ...mockContent];

  const filteredContent = filter === 'all'
    ? allContent
    : allContent.filter(c => c.status === filter || c.type === filter);

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
            {activeSource === 'batch' && <BatchPanel onGenerated={handleGenerated} />}
            {activeSource === 'persona_batch' && <BatchGenerationPanel />}
            {activeSource === 'auto' && <AutomationPanel onGenerated={handleGenerated} />}
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
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <p className="font-medium text-sm">{item.title}</p>
                      {item.author === '🤖 AI Auto' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary-500/15 text-primary-300 border border-primary-500/20 font-medium">
                          🤖 AI Auto
                        </span>
                      )}
                    </div>
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
