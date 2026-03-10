/**
 * LocalPageBuilder.tsx — CEO page at /page-builder
 *
 * Generate, preview, and deploy self-contained HTML landing pages.
 * Used both as a standalone route and embedded in ContentHub (Tab 4).
 */

import { useState, useEffect, useRef } from 'react';
import { Plus, Globe, Eye, Upload, Trash2, Loader2, CheckCircle2, XCircle, AlertCircle, Download } from 'lucide-react';
import {
  buildPage, getAllPages, deletePage, deployPage,
  getSyncStatus, BuiltPage, PageSpec, PageType, PAGES_OUTPUT_DIR,
} from '@/services/localPageBuilderService';
import type { SupportedExam } from '@/services/contentGenerationHub';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAMS: SupportedExam[] = ['GATE', 'JEE', 'NEET', 'CAT', 'UPSC', 'CBSE'];
const PAGE_TYPES: { value: PageType; label: string; desc: string }[] = [
  { value: 'exam_landing',    label: '🎯 Exam Landing',    desc: 'Full landing page for an exam' },
  { value: 'topic_explainer', label: '📖 Topic Explainer', desc: 'Deep-dive into a specific topic' },
  { value: 'lead_capture',    label: '📧 Lead Capture',    desc: 'Email/lead generation form' },
  { value: 'free_resource',   label: '📚 Free Resource',   desc: 'Download page for free content' },
];

const STATUS_COLORS: Record<string, string> = {
  local_only:    'text-surface-400',
  deploying:     'text-blue-400',
  deployed:      'text-green-400',
  deploy_failed: 'text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  local_only:    'Local Only',
  deploying:     'Deploying...',
  deployed:      'Deployed ✓',
  deploy_failed: 'Deploy Failed',
};

// ─── Build form ───────────────────────────────────────────────────────────────

interface BuildFormProps {
  onBuilt: (page: BuiltPage) => void;
}

function BuildForm({ onBuilt }: BuildFormProps) {
  const [building, setBuilding] = useState(false);
  const [form, setForm] = useState<Partial<PageSpec>>({
    type: 'exam_landing',
    exam: 'GATE',
    topic: '',
    headline: '',
    subHeadline: '',
    ctaText: 'Start Free Trial',
  });

  const updateForm = (updates: Partial<PageSpec>) => setForm(prev => ({ ...prev, ...updates }));

  const handleBuild = async () => {
    if (!form.exam || !form.topic || !form.headline) return;
    setBuilding(true);
    try {
      const spec: PageSpec = {
        id: `page_${Date.now()}`,
        type: form.type ?? 'exam_landing',
        exam: form.exam!,
        topic: form.topic!,
        headline: form.headline!,
        subHeadline: form.subHeadline ?? `Master ${form.topic} for ${form.exam} with AI-powered preparation.`,
        ctaText: form.ctaText ?? 'Start Free Trial',
        metaTitle: `${form.headline} | EduGenius`,
        metaDescription: form.subHeadline ?? `${form.topic} for ${form.exam} — EduGenius`,
      };
      const page = await buildPage(spec);
      onBuilt(page);
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="card p-6 space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2"><Plus className="w-5 h-5" /> Build New Page</h2>

      {/* Page type selector */}
      <div>
        <label className="text-xs text-surface-400 mb-2 block">Page Type</label>
        <div className="grid grid-cols-2 gap-2">
          {PAGE_TYPES.map(pt => (
            <button key={pt.value} onClick={() => updateForm({ type: pt.value })}
              className={`text-left p-3 rounded-xl border text-sm transition-colors ${form.type === pt.value ? 'border-primary-500/50 bg-primary-500/10' : 'border-surface-700 hover:border-surface-600'}`}>
              <div className="font-medium">{pt.label}</div>
              <div className="text-xs text-surface-400 mt-0.5">{pt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-surface-400 mb-1 block">Exam</label>
          <select value={form.exam} onChange={e => updateForm({ exam: e.target.value as SupportedExam })}
            className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
            {EXAMS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-surface-400 mb-1 block">Topic</label>
          <input value={form.topic} onChange={e => updateForm({ topic: e.target.value })}
            placeholder="e.g. Electromagnetics"
            className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-surface-400 mb-1 block">Headline</label>
          <input value={form.headline} onChange={e => updateForm({ headline: e.target.value })}
            placeholder="e.g. Crack GATE 2025 with AI-Powered Preparation"
            className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-surface-400 mb-1 block">Sub-headline</label>
          <input value={form.subHeadline} onChange={e => updateForm({ subHeadline: e.target.value })}
            placeholder="e.g. Join 50,000+ students who trust EduGenius"
            className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
        </div>
        <div>
          <label className="text-xs text-surface-400 mb-1 block">CTA Button Text</label>
          <input value={form.ctaText} onChange={e => updateForm({ ctaText: e.target.value })}
            placeholder="Start Free Trial"
            className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
        </div>
        <div>
          <label className="text-xs text-surface-400 mb-1 block">GA Tracking ID (optional)</label>
          <input value={form.gaTrackingId ?? ''} onChange={e => updateForm({ gaTrackingId: e.target.value })}
            placeholder="G-XXXXXXXXXX"
            className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
        </div>
      </div>

      <button onClick={handleBuild} disabled={building || !form.topic || !form.headline}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
        {building ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
        {building ? 'Building page...' : 'Build Page'}
      </button>

      {/* Output dir info */}
      <p className="text-xs text-surface-500">
        📁 Output: <code className="text-surface-400">{PAGES_OUTPUT_DIR}/</code>
      </p>
    </div>
  );
}

// ─── Page preview ─────────────────────────────────────────────────────────────

function PagePreview({ page, onClose }: { page: BuiltPage; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(page.html);
        doc.close();
      }
    }
  }, [page.html]);

  const handleDownload = () => {
    const blob = new Blob([page.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = page.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-surface-900 border-b border-surface-700">
        <div>
          <h3 className="font-semibold text-sm">{page.spec.headline}</h3>
          <p className="text-xs text-surface-400">{page.filename}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-700 hover:bg-surface-600 rounded-lg text-xs text-white transition-colors">
            <Download className="w-3.5 h-3.5" /> Download HTML
          </button>
          <button onClick={onClose}
            className="px-3 py-1.5 bg-surface-700 hover:bg-surface-600 rounded-lg text-xs text-white transition-colors">
            ✕ Close
          </button>
        </div>
      </div>
      <div className="flex-1 bg-white">
        <iframe ref={iframeRef} className="w-full h-full border-0" title="Page Preview" sandbox="allow-scripts" />
      </div>
    </div>
  );
}

// ─── Page list item ───────────────────────────────────────────────────────────

function PageListItem({
  page,
  onPreview,
  onDeploy,
  onDelete,
  deploying,
}: {
  page: BuiltPage;
  onPreview: () => void;
  onDeploy: () => void;
  onDelete: () => void;
  deploying: boolean;
}) {
  const statusIcon = page.deployStatus === 'deployed'
    ? <CheckCircle2 className="w-4 h-4 text-green-400" />
    : page.deployStatus === 'deploy_failed'
    ? <XCircle className="w-4 h-4 text-red-400" />
    : page.deployStatus === 'deploying'
    ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
    : <AlertCircle className="w-4 h-4 text-surface-500" />;

  return (
    <div className="p-4 bg-surface-800/50 rounded-xl border border-surface-700/50 hover:border-surface-600/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-primary-500/15 text-primary-400 text-xs font-medium">{page.spec.exam}</span>
            <span className="text-xs text-surface-500">{page.spec.type.replace(/_/g, ' ')}</span>
          </div>
          <h3 className="font-medium text-sm text-white truncate">{page.spec.headline}</h3>
          <p className="text-xs text-surface-400 truncate mt-0.5">{page.filename}</p>
          <div className="flex items-center gap-2 mt-2">
            {statusIcon}
            <span className={`text-xs font-medium ${STATUS_COLORS[page.deployStatus]}`}>
              {STATUS_LABELS[page.deployStatus]}
            </span>
            {page.netlifyUrl && (
              <a href={page.netlifyUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:underline truncate max-w-48">
                {page.netlifyUrl}
              </a>
            )}
          </div>
          <p className="text-xs text-surface-600 mt-1">{new Date(page.createdAt).toLocaleString()}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button onClick={onPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-700 hover:bg-surface-600 rounded-lg text-xs text-white transition-colors">
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
          {page.deployStatus !== 'deployed' && (
            <button onClick={onDeploy} disabled={deploying || page.deployStatus === 'deploying'}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs text-white transition-colors disabled:opacity-50">
              {deploying || page.deployStatus === 'deploying'
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Upload className="w-3.5 h-3.5" />}
              Deploy
            </button>
          )}
          <button onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 rounded-lg text-xs text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main LocalPageBuilder ────────────────────────────────────────────────────

export default function LocalPageBuilderView() {
  const [pages, setPages] = useState<BuiltPage[]>([]);
  const [previewPage, setPreviewPage] = useState<BuiltPage | null>(null);
  const [deployingId, setDeployingId] = useState<string | null>(null);

  const refreshPages = () => setPages(getAllPages().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

  useEffect(() => { refreshPages(); }, []);

  const handleBuilt = (page: BuiltPage) => {
    refreshPages();
  };

  const handleDeploy = async (page: BuiltPage) => {
    setDeployingId(page.id);
    try {
      await deployPage(page.id);
      refreshPages();
    } finally {
      setDeployingId(null);
    }
  };

  const handleDelete = (page: BuiltPage) => {
    if (confirm(`Delete "${page.spec.headline}"?`)) {
      deletePage(page.id);
      refreshPages();
    }
  };

  const syncStatus = getSyncStatus();

  return (
    <div className="space-y-6">
      {/* Sync status bar */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-surface-400">
          <span className="w-2 h-2 rounded-full bg-surface-500"></span>
          {syncStatus.local} Local
        </div>
        <div className="flex items-center gap-1.5 text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          {syncStatus.deployed} Deployed
        </div>
        <div className="flex items-center gap-1.5 text-blue-400">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          {syncStatus.deploying} Deploying
        </div>
        {syncStatus.failed > 0 && (
          <div className="flex items-center gap-1.5 text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            {syncStatus.failed} Failed
          </div>
        )}
      </div>

      {/* Build form */}
      <BuildForm onBuilt={handleBuilt} />

      {/* Page list */}
      {pages.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-surface-300">Built Pages ({pages.length})</h2>
          {pages.map(page => (
            <PageListItem
              key={page.id}
              page={page}
              onPreview={() => setPreviewPage(page)}
              onDeploy={() => handleDeploy(page)}
              onDelete={() => handleDelete(page)}
              deploying={deployingId === page.id}
            />
          ))}
        </div>
      )}

      {pages.length === 0 && (
        <div className="text-center py-12 text-surface-500">
          <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No pages built yet. Use the form above to create your first landing page.</p>
        </div>
      )}

      {/* Preview modal */}
      {previewPage && <PagePreview page={previewPage} onClose={() => setPreviewPage(null)} />}
    </div>
  );
}
