/**
 * ContentOrchestrator.tsx — CEO Content Orchestration Dashboard
 *
 * Route: /content-orchestrator
 * Sections:
 *   1. Live Orchestration Console — generate + view result
 *   2. Tier Status Panel — which tiers are available
 *   3. Orchestrator Settings — config controls
 *   4. Recent Generations — log table
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu, Zap, CheckCircle, XCircle, AlertTriangle, Copy, ChevronDown,
  ChevronUp, RefreshCw, Save, BarChart3, FileText, MessageSquare,
  Youtube, Mail, Image, Film, Layers, Clock, Settings,
} from 'lucide-react';
import { clsx } from 'clsx';

import {
  orchestrateContent,
  getOrchestratorConfig,
  updateOrchestratorConfig,
  getOrchestrationLog,
  type ContentOrchestrationRequest,
  type ContentOrchestrationResult,
  type OrchestratorConfig,
} from '@/services/contentOrchestratorService';

import {
  TIER_CONFIGS,
  getAvailableTiers,
  getTierUpgradePath,
  type ContentTier,
  type DeliverySurface,
  type MediaFormat,
} from '@/services/contentTierService';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAMS = ['GATE', 'JEE', 'NEET', 'CAT', 'UPSC', 'CBSE'];

const SURFACES: { value: DeliverySurface; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'in_app',   label: 'In-App',   icon: Layers,       desc: 'Student dashboard, learn page, chat' },
  { value: 'blog_web', label: 'Blog/Web',  icon: FileText,     desc: 'SEO blog post, landing page' },
  { value: 'whatsapp', label: 'WhatsApp',  icon: MessageSquare, desc: 'WhatsApp message (short, image-friendly)' },
  { value: 'telegram', label: 'Telegram',  icon: MessageSquare, desc: 'Telegram channel / bot message' },
  { value: 'youtube',  label: 'YouTube',   icon: Youtube,      desc: 'Video script + chapters + thumbnail' },
  { value: 'email',    label: 'Email',     icon: Mail,         desc: 'Newsletter / drip email' },
  { value: 'pdf',      label: 'PDF',       icon: FileText,     desc: 'Downloadable PDF export' },
];

const MEDIA_FORMAT_OPTIONS: { value: MediaFormat; label: string; icon: React.ElementType }[] = [
  { value: 'image_prompt',    label: 'Image Prompt',    icon: Image },
  { value: 'video_script',    label: 'Video Script',    icon: Film },
  { value: 'audio_script',    label: 'Audio Script',    icon: Cpu },
  { value: 'infographic_spec', label: 'Infographic',   icon: BarChart3 },
];

const TIER_COST_ESTIMATE: Record<ContentTier, string> = {
  T0_static:    'Free — ~0ms',
  T1_rag:       'Free — ~200–500ms',
  T2_llm:       '~₹0.01/req — 2–5s',
  T3_wolfram:   '~₹0.05/req — 5–10s',
  T4_richmedia: '~₹0.15/req — 10–20s',
};

const AGENT_LABELS: Record<string, string> = {
  scout: '🔍 Scout (Market Intel)',
  atlas: '📚 Atlas (Content Factory)',
  sage:  '🎓 Sage (Socratic Tutor)',
  oracle: '📊 Oracle (Analytics)',
  mentor: '👨‍🏫 Mentor (Engagement)',
  herald: '📣 Herald (Blog/Marketing)',
  forge:  '⚙️ Forge (DevOps)',
};

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium border', className)}>
      {label}
    </span>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="p-2 rounded-lg bg-primary-500/10 border border-primary-500/20 shrink-0 mt-0.5">
        <Icon className="w-5 h-5 text-primary-400" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-surface-100">{title}</h2>
        {subtitle && <p className="text-sm text-surface-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function Expandable({ label, content }: { label: string; content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-surface-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-800 hover:bg-surface-750 text-sm font-medium text-surface-200 transition-colors"
      >
        <span>{label}</span>
        {open ? <ChevronUp className="w-4 h-4 text-surface-400" /> : <ChevronDown className="w-4 h-4 text-surface-400" />}
      </button>
      {open && (
        <div className="px-4 py-3 bg-surface-900 text-sm text-surface-300 whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-64 overflow-y-auto">
          {content}
        </div>
      )}
    </div>
  );
}

// ─── Section 1: Generation Console ───────────────────────────────────────────

function GenerationConsole() {
  const [topic, setTopic] = useState('');
  const [examType, setExamType] = useState('GATE');
  const [surface, setSurface] = useState<DeliverySurface>('in_app');
  const [tierOverride, setTierOverride] = useState<ContentTier | ''>('');
  const [mediaFormats, setMediaFormats] = useState<MediaFormat[]>([]);
  const [priority, setPriority] = useState<'urgent' | 'normal' | 'background'>('normal');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContentOrchestrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableTiers = getAvailableTiers();

  const toggleFormat = (fmt: MediaFormat) => {
    setMediaFormats((prev) =>
      prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt],
    );
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const req: ContentOrchestrationRequest = {
        topic: topic.trim(),
        examType,
        surface,
        tierOverride: tierOverride || undefined,
        mediaFormats: mediaFormats.length > 0 ? mediaFormats : undefined,
        priority,
        triggeredBy: 'ceo_manual',
        persona: 'ceo',
      };
      const res = await orchestrateContent(req);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <SectionHeader
        icon={Zap}
        title="Live Orchestration Console"
        subtitle="Generate content across any tier and surface"
      />

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Topic */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Electromagnetic Induction, Integration by Parts, Profit & Loss..."
            className="w-full px-3 py-2.5 bg-surface-800 border border-surface-600 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30"
          />
        </div>

        {/* Exam */}
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Exam</label>
          <select
            value={examType}
            onChange={(e) => setExamType(e.target.value)}
            className="w-full px-3 py-2.5 bg-surface-800 border border-surface-600 rounded-lg text-surface-100 text-sm focus:outline-none focus:border-primary-500"
          >
            {EXAMS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as typeof priority)}
            className="w-full px-3 py-2.5 bg-surface-800 border border-surface-600 rounded-lg text-surface-100 text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="urgent">🔴 Urgent</option>
            <option value="normal">🟡 Normal</option>
            <option value="background">⚪ Background</option>
          </select>
        </div>

        {/* Surface */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-surface-300 mb-2">Delivery Surface</label>
          <div className="grid grid-cols-2 gap-2">
            {SURFACES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setSurface(value)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
                  surface === value
                    ? 'bg-primary-600/20 border-primary-500 text-primary-300'
                    : 'bg-surface-800 border-surface-700 text-surface-400 hover:border-surface-500 hover:text-surface-200',
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tier Override */}
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Tier Override (optional)</label>
          <select
            value={tierOverride}
            onChange={(e) => setTierOverride(e.target.value as ContentTier | '')}
            className="w-full px-3 py-2.5 bg-surface-800 border border-surface-600 rounded-lg text-surface-100 text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="">Auto-select</option>
            {(Object.keys(TIER_CONFIGS) as ContentTier[]).map((t) => (
              <option key={t} value={t} disabled={!availableTiers.includes(t)}>
                {TIER_CONFIGS[t].emoji} {TIER_CONFIGS[t].name}{!availableTiers.includes(t) ? ' (unavailable)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Media Formats */}
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-2">Media Formats (T4)</label>
          <div className="flex flex-wrap gap-2">
            {MEDIA_FORMAT_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => toggleFormat(value)}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                  mediaFormats.includes(value)
                    ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                    : 'bg-surface-800 border-surface-700 text-surface-400 hover:border-surface-500',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="btn-primary w-full flex items-center justify-center gap-2 py-3"
      >
        {loading ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Orchestrating…
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            Generate Content
          </>
        )}
      </button>

      {/* Result */}
      {result && (
        <div className="mt-6 space-y-4 border-t border-surface-700 pt-6">
          {/* Status bar */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              label={`${TIER_CONFIGS[result.tier].emoji} ${TIER_CONFIGS[result.tier].name}`}
              className={
                result.tier === 'T4_richmedia' ? 'text-violet-400 bg-violet-500/10 border-violet-500/30'
                : result.tier === 'T3_wolfram'  ? 'text-blue-400 bg-blue-500/10 border-blue-500/30'
                : result.tier === 'T2_llm'      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                : result.tier === 'T1_rag'      ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
                :                                 'text-surface-400 bg-surface-500/10 border-surface-600'
              }
            />
            <Badge
              label={`Strategy: ${result.strategy}`}
              className="text-amber-400 bg-amber-500/10 border-amber-500/30"
            />
            <Badge
              label={result.status}
              className={
                result.status === 'success' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                : result.status === 'partial' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
                : result.status === 'fallback' ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
                :                               'text-red-400 bg-red-500/10 border-red-500/30'
              }
            />
            <span className="text-xs text-surface-500 ml-auto">
              <Clock className="w-3.5 h-3.5 inline mr-1" />
              {result.generationMs}ms
            </span>
          </div>

          {result.fallbackReason && (
            <div className="px-3 py-2 bg-yellow-500/5 border border-yellow-500/20 rounded-lg text-xs text-yellow-400">
              ⚠️ {result.fallbackReason}
            </div>
          )}

          {/* Text content */}
          {result.textContent && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-surface-300">Generated Content</span>
                <CopyButton text={result.textContent} />
              </div>
              <Expandable
                label={`📄 Text Content (${result.textContent.split(/\s+/).length} words)`}
                content={result.textContent}
              />
            </div>
          )}

          {/* Image prompt */}
          {result.imagePrompt && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-surface-300">🎨 Image Prompt</span>
                <CopyButton text={result.imagePrompt} />
              </div>
              <div className="px-4 py-3 bg-surface-900 border border-surface-700 rounded-lg text-xs text-surface-300 font-mono max-h-[200px] sm:max-h-none overflow-y-auto">
                {result.imagePrompt}
              </div>
            </div>
          )}

          {/* Thumbnail brief */}
          {result.thumbnailBrief && (
            <div className="p-4 bg-surface-800 border border-surface-700 rounded-lg space-y-2">
              <div className="text-sm font-medium text-surface-200">🖼 Thumbnail Brief</div>
              <div className="text-lg font-bold text-white">{result.thumbnailBrief.headline}</div>
              {result.thumbnailBrief.subtext && (
                <div className="text-sm text-surface-400">{result.thumbnailBrief.subtext}</div>
              )}
              <div className="text-xs text-surface-500">
                <strong>Visual:</strong> {result.thumbnailBrief.visualConcept}
              </div>
              <div className="text-xs text-surface-500">
                <strong>Colors:</strong> {result.thumbnailBrief.colorScheme}
              </div>
            </div>
          )}

          {/* Video script */}
          {result.videoScript && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-surface-300">🎬 Video Script</div>
              <Expandable
                label={`Hook — "${result.videoScript.title}"`}
                content={result.videoScript.hook}
              />
              {result.videoScript.chapters.map((ch, i) => (
                <Expandable
                  key={i}
                  label={`Ch ${i + 1}: ${ch.title} (${ch.duration})`}
                  content={ch.content}
                />
              ))}
              <Expandable
                label="CTA + Description"
                content={`CTA:\n${result.videoScript.callToAction}\n\nDescription:\n${result.videoScript.description}\n\nTags: ${result.videoScript.tags.join(', ')}`}
              />
            </div>
          )}

          {/* Infographic spec */}
          {result.infographicSpec && (
            <div className="p-4 bg-surface-800 border border-surface-700 rounded-lg space-y-3">
              <div className="text-sm font-medium text-surface-200">
                📊 Infographic: {result.infographicSpec.title}
                <Badge label={result.infographicSpec.format} className="ml-2 text-xs text-surface-400 bg-surface-700 border-surface-600" />
              </div>
              {result.infographicSpec.sections.map((s, i) => (
                <div key={i} className="border-l-2 border-primary-500/40 pl-3">
                  <div className="text-xs font-semibold text-surface-300">{s.heading}</div>
                  <div className="text-xs text-surface-400 mt-0.5">{s.content}</div>
                </div>
              ))}
            </div>
          )}

          {/* Agent signals */}
          {result.agentSignals.length > 0 && (
            <div>
              <div className="text-sm font-medium text-surface-300 mb-2">📡 Agent Signals Emitted</div>
              <div className="space-y-1.5">
                {result.agentSignals.map((sig, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-surface-400">
                    <span className="w-16 text-surface-500">{sig.agentId}</span>
                    <Badge label={sig.signalType} className="text-xs text-primary-400 bg-primary-500/10 border-primary-500/20" />
                    <span className="text-surface-600 font-mono truncate">{sig.storageKey}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section 2: Tier Status Panel ────────────────────────────────────────────

function TierStatusPanel() {
  const [available, setAvailable] = useState<ContentTier[]>([]);
  const [upgradePath, setUpgradePath] = useState<{ tier: ContentTier; blockedBy: string[] }[]>([]);

  useEffect(() => {
    setAvailable(getAvailableTiers());
    setUpgradePath(getTierUpgradePath());
  }, []);

  const refresh = () => {
    setAvailable(getAvailableTiers());
    setUpgradePath(getTierUpgradePath());
  };

  const blockedMap = Object.fromEntries(upgradePath.map((u) => [u.tier, u.blockedBy]));

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <SectionHeader
          icon={Layers}
          title="Tier Status"
          subtitle="Which tiers are unlocked based on your connections"
        />
        <button
          onClick={refresh}
          className="p-2 rounded-lg hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
          title="Refresh tier status"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-700">
              <th className="text-left py-2 px-3 text-surface-400 font-medium">Tier</th>
              <th className="text-left py-2 px-3 text-surface-400 font-medium">Status</th>
              <th className="text-left py-2 px-3 text-surface-400 font-medium">Required Connections</th>
              <th className="text-left py-2 px-3 text-surface-400 font-medium">Cost / Latency</th>
              <th className="text-left py-2 px-3 text-surface-400 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-700/50">
            {(Object.keys(TIER_CONFIGS) as ContentTier[]).map((tier) => {
              const cfg = TIER_CONFIGS[tier];
              const isAvail = available.includes(tier);
              const blocked = blockedMap[tier] ?? [];
              return (
                <tr key={tier} className="hover:bg-surface-800/50 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{cfg.emoji}</span>
                      <div>
                        <div className="font-medium text-surface-200">{cfg.name}</div>
                        <div className="text-xs text-surface-500 max-w-[200px]">{cfg.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    {isAvail ? (
                      <div className="flex items-center gap-1.5 text-emerald-400">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Available</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-red-400">
                        <XCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Blocked</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {cfg.requiresConnections.length === 0 ? (
                      <span className="text-surface-500 text-xs">None required</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {cfg.requiresConnections.map((conn) => {
                          const isMissing = blocked.includes(conn);
                          return (
                            <Badge
                              key={conn}
                              label={conn.replace('VITE_', '').replace('_API_KEY', '').replace('_APP_ID', '')}
                              className={
                                isMissing
                                  ? 'text-red-400 bg-red-500/10 border-red-500/30'
                                  : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                              }
                            />
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-xs text-surface-400 font-mono">
                    {TIER_COST_ESTIMATE[tier]}
                  </td>
                  <td className="py-3 px-3">
                    {!isAvail && blocked.length > 0 ? (
                      <Link
                        to="/connections"
                        className="text-xs text-primary-400 hover:text-primary-300 underline"
                      >
                        Add {blocked[0].replace('VITE_', '').replace('_API_KEY', '').replace('_APP_ID', '')} →
                      </Link>
                    ) : isAvail ? (
                      <span className="text-xs text-surface-500">Ready</span>
                    ) : (
                      <span className="text-xs text-surface-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Mobile stacked tier cards */}
      <div className="sm:hidden space-y-2">
        {(Object.keys(TIER_CONFIGS) as ContentTier[]).map((tier) => {
          const cfg = TIER_CONFIGS[tier];
          const isAvail = available.includes(tier);
          return (
            <div key={tier} className="bg-surface-800/50 border border-surface-700/50 rounded-xl p-3 flex items-center gap-3">
              <span className="text-2xl">{cfg.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-surface-200">{cfg.name}</span>
                  {isAvail
                    ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                </div>
                <p className="text-xs text-surface-500 truncate">{cfg.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section 3: Orchestrator Settings ────────────────────────────────────────

function OrchestratorSettings() {
  const [config, setConfig] = useState<OrchestratorConfig>(getOrchestratorConfig());
  const [saved, setSaved] = useState(false);

  const availableTiers = getAvailableTiers();

  const handleSave = () => {
    updateOrchestratorConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleSurface = (surface: DeliverySurface, field: 'enabledSurfaces' | 'richMediaSurfaces') => {
    setConfig((prev) => ({
      ...prev,
      [field]: prev[field].includes(surface)
        ? prev[field].filter((s) => s !== surface)
        : [...prev[field], surface],
    }));
  };

  const toggleAgent = (agentId: string) => {
    setConfig((prev) => ({
      ...prev,
      agentSignalsEnabled: {
        ...prev.agentSignalsEnabled,
        [agentId]: !prev.agentSignalsEnabled[agentId],
      },
    }));
  };

  const COST_OPTIONS = ['free', 'low', 'medium', 'high'] as const;
  const ALL_SURFACES: DeliverySurface[] = ['in_app', 'blog_web', 'whatsapp', 'telegram', 'youtube', 'email', 'pdf'];

  return (
    <div className="card">
      <SectionHeader
        icon={Settings}
        title="Orchestrator Settings"
        subtitle="Platform-level controls for content generation behaviour"
      />

      <div className="space-y-6">
        {/* Tier Override */}
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Default Tier Override
            <span className="text-surface-500 font-normal ml-2">Forces all generation to this tier</span>
          </label>
          <select
            value={config.defaultTierOverride ?? ''}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                defaultTierOverride: (e.target.value as ContentTier) || undefined,
              }))
            }
            className="w-full px-3 py-2.5 bg-surface-800 border border-surface-600 rounded-lg text-surface-100 text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="">Auto-select (recommended)</option>
            {(Object.keys(TIER_CONFIGS) as ContentTier[]).map((t) => (
              <option key={t} value={t} disabled={!availableTiers.includes(t)}>
                {TIER_CONFIGS[t].emoji} {TIER_CONFIGS[t].name}{!availableTiers.includes(t) ? ' (unavailable)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Toggles row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="flex items-center justify-between p-4 bg-surface-800 rounded-lg border border-surface-700">
            <div>
              <div className="text-sm font-medium text-surface-200">Auto-Escalate</div>
              <div className="text-xs text-surface-500">Upgrade tier if quality is low</div>
            </div>
            <button
              onClick={() => setConfig((p) => ({ ...p, autoEscalate: !p.autoEscalate }))}
              className={clsx(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                config.autoEscalate ? 'bg-primary-600' : 'bg-surface-600',
              )}
            >
              <span
                className={clsx(
                  'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                  config.autoEscalate ? 'translate-x-6' : 'translate-x-1',
                )}
              />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Max Cost Level</label>
            <select
              value={config.maxCostLevel}
              onChange={(e) =>
                setConfig((p) => ({ ...p, maxCostLevel: e.target.value as OrchestratorConfig['maxCostLevel'] }))
              }
              className="w-full px-3 py-2.5 bg-surface-800 border border-surface-600 rounded-lg text-surface-100 text-sm focus:outline-none focus:border-primary-500"
            >
              {COST_OPTIONS.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
        </div>

        {/* Enabled Surfaces */}
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-2">Enabled Surfaces</label>
          <div className="flex flex-wrap gap-2">
            {ALL_SURFACES.map((s) => (
              <button
                key={s}
                onClick={() => toggleSurface(s, 'enabledSurfaces')}
                className={clsx(
                  'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                  config.enabledSurfaces.includes(s)
                    ? 'bg-primary-600/20 border-primary-500 text-primary-300'
                    : 'bg-surface-800 border-surface-700 text-surface-500 hover:border-surface-500',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Rich Media Surfaces */}
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-2">Rich Media Surfaces (get T4)</label>
          <div className="flex flex-wrap gap-2">
            {ALL_SURFACES.map((s) => (
              <button
                key={s}
                onClick={() => toggleSurface(s, 'richMediaSurfaces')}
                className={clsx(
                  'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                  config.richMediaSurfaces.includes(s)
                    ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                    : 'bg-surface-800 border-surface-700 text-surface-500 hover:border-surface-500',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Agent Signal Toggles */}
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-3">Agent Signals</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(AGENT_LABELS).map(([agentId, label]) => (
              <div
                key={agentId}
                className={clsx(
                  'flex items-center justify-between p-3 rounded-lg border text-sm transition-colors cursor-pointer',
                  config.agentSignalsEnabled[agentId]
                    ? 'bg-surface-800 border-primary-500/40 text-surface-200'
                    : 'bg-surface-800/50 border-surface-700 text-surface-500',
                )}
                onClick={() => toggleAgent(agentId)}
              >
                <span className="truncate text-xs">{label}</span>
                <div
                  className={clsx(
                    'w-8 h-4 rounded-full relative shrink-0 ml-2 transition-colors',
                    config.agentSignalsEnabled[agentId] ? 'bg-primary-600' : 'bg-surface-600',
                  )}
                >
                  <span
                    className={clsx(
                      'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform',
                      config.agentSignalsEnabled[agentId] ? 'translate-x-4' : 'translate-x-0.5',
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          className={clsx(
            'w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm transition-colors',
            saved
              ? 'bg-emerald-600 text-white'
              : 'bg-primary-600 hover:bg-primary-700 text-white',
          )}
        >
          {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Settings</>}
        </button>
      </div>
    </div>
  );
}

// ─── Section 4: Recent Generations Log ───────────────────────────────────────

function RecentGenerations() {
  const [log, setLog] = useState(getOrchestrationLog());

  const refresh = useCallback(() => setLog(getOrchestrationLog()), []);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <SectionHeader
          icon={BarChart3}
          title="Recent Generations"
          subtitle="Last 20 orchestrated content requests"
        />
        <button
          onClick={refresh}
          className="p-2 rounded-lg hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {log.length === 0 ? (
        <div className="text-center py-12 text-surface-500">
          <Cpu className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No generations yet. Use the console above to generate content.</p>
        </div>
      ) : (
        <>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="text-left py-2 px-3 text-surface-400 font-medium">Topic</th>
                  <th className="text-left py-2 px-3 text-surface-400 font-medium">Tier</th>
                  <th className="text-left py-2 px-3 text-surface-400 font-medium">Surface</th>
                  <th className="text-left py-2 px-3 text-surface-400 font-medium">Status</th>
                  <th className="text-left py-2 px-3 text-surface-400 font-medium">Time</th>
                  <th className="text-left py-2 px-3 text-surface-400 font-medium">Formats</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50">
                {log.map((entry) => (
                  <tr key={entry.requestId} className="hover:bg-surface-800/50 transition-colors">
                    <td className="py-2.5 px-3 text-surface-200 max-w-[200px] truncate">{entry.topic}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-xs font-mono text-surface-400">
                        {TIER_CONFIGS[entry.tier]?.emoji} {entry.tier}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-surface-400">{entry.surface}</td>
                    <td className="py-2.5 px-3">
                      <Badge
                        label={entry.status}
                        className={
                          entry.status === 'success' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                          : entry.status === 'partial' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
                          : entry.status === 'fallback' ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
                          :                              'text-red-400 bg-red-500/10 border-red-500/30'
                        }
                      />
                    </td>
                    <td className="py-2.5 px-3 text-xs text-surface-500 font-mono">{entry.generationMs}ms</td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1">
                        {entry.formats.map((f) => (
                          <Badge
                            key={f}
                            label={f}
                            className="text-xs text-surface-400 bg-surface-700 border-surface-600"
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile stacked log cards */}
          <div className="sm:hidden divide-y divide-surface-700/50">
            {log.map((entry) => (
              <div key={entry.requestId} className="py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-200 truncate">{entry.topic}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs font-mono text-surface-500">{TIER_CONFIGS[entry.tier]?.emoji} {entry.tier}</span>
                    <span className="text-xs text-surface-500">{entry.surface}</span>
                    <span className="text-xs text-surface-500 font-mono">{entry.generationMs}ms</span>
                  </div>
                </div>
                <Badge
                  label={entry.status}
                  className={
                    entry.status === 'success' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                    : entry.status === 'partial' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
                    : entry.status === 'fallback' ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
                    :                              'text-red-400 bg-red-500/10 border-red-500/30'
                  }
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page Root ────────────────────────────────────────────────────────────────

export default function ContentOrchestrator() {
  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-primary-500/20 to-violet-500/20 border border-primary-500/30">
          <Cpu className="w-7 h-7 text-primary-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Content Orchestrator</h1>
          <p className="text-surface-400 mt-1 text-sm">
            Master control for content tier selection, multi-surface delivery, and agent signal routing.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-surface-400">
            {getAvailableTiers().length}/5 tiers available
          </span>
        </div>
      </div>

      {/* Section 1 */}
      <GenerationConsole />

      {/* Section 2 */}
      <TierStatusPanel />

      {/* Sections 3 & 4 — side by side on large screens */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <OrchestratorSettings />
        <RecentGenerations />
      </div>
    </div>
  );
}
