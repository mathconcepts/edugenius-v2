/**
 * ChannelManager.tsx — Admin Channel Management Dashboard
 *
 * Accessible to CEO and Admin roles only.
 * Provides:
 * 1. Live status of all chat channels (web, mobile, WhatsApp, Telegram, widget)
 * 2. Webhook URL configuration per channel
 * 3. Per-channel conversation volume + response quality metrics
 * 4. Conversation routing rules (which agent handles which channel)
 * 5. Message preview — see exactly what students see on each channel
 * 6. Channel-specific quick reply management
 */

import React, { useState } from 'react';
import { clsx } from 'clsx';
import {
  MessageSquare, Smartphone, Globe, Bot, Zap, Settings,
  Eye, ToggleLeft, ToggleRight, Copy, Check, AlertCircle,
  TrendingUp, Users, Clock, ChevronRight, ExternalLink,
  Send, RefreshCw, Webhook
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ChannelId = 'web' | 'mobile' | 'whatsapp' | 'telegram' | 'widget';
type ChannelStatus = 'active' | 'inactive' | 'error' | 'pending';

interface ChannelConfig {
  id: ChannelId;
  name: string;
  icon: React.ReactNode;
  description: string;
  status: ChannelStatus;
  webhookUrl?: string;
  tokenConfigured: boolean;
  dailyMessages: number;
  avgResponseMs: number;
  satisfactionScore: number;  // 0-100
  activeConversations: number;
  routedAgent: string;
  quickRepliesEnabled: boolean;
  latexSupported: boolean;
  setupDocs: string;
}

// ─── Mock channel data ────────────────────────────────────────────────────────

const CHANNELS: ChannelConfig[] = [
  {
    id: 'web',
    name: 'Web Chat',
    icon: <Globe className="w-5 h-5" />,
    description: 'Full-featured in-app chat — all capabilities unlocked',
    status: 'active',
    tokenConfigured: true,
    dailyMessages: 1247,
    avgResponseMs: 2100,
    satisfactionScore: 94,
    activeConversations: 38,
    routedAgent: 'sage',
    quickRepliesEnabled: true,
    latexSupported: true,
    setupDocs: 'https://docs.edugenius.ai/channels/web',
  },
  {
    id: 'mobile',
    name: 'Mobile (PWA)',
    icon: <Smartphone className="w-5 h-5" />,
    description: 'Progressive Web App — mobile-optimised layout + voice input',
    status: 'active',
    tokenConfigured: true,
    dailyMessages: 892,
    avgResponseMs: 2300,
    satisfactionScore: 91,
    activeConversations: 24,
    routedAgent: 'sage',
    quickRepliesEnabled: true,
    latexSupported: true,
    setupDocs: 'https://docs.edugenius.ai/channels/mobile',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    icon: <MessageSquare className="w-5 h-5 text-green-400" />,
    description: 'Students chat on WhatsApp — Sage adapts to WhatsApp format',
    status: 'pending',
    webhookUrl: 'https://edugenius.ai/api/webhooks/whatsapp',
    tokenConfigured: false,
    dailyMessages: 0,
    avgResponseMs: 0,
    satisfactionScore: 0,
    activeConversations: 0,
    routedAgent: 'sage',
    quickRepliesEnabled: true,
    latexSupported: false,
    setupDocs: 'https://docs.meta.com/whatsapp/cloud-api/get-started',
  },
  {
    id: 'telegram',
    name: 'Telegram Bot',
    icon: <Bot className="w-5 h-5 text-blue-400" />,
    description: 'Telegram bot — supports markdown, code blocks, inline keyboards',
    status: 'pending',
    webhookUrl: 'https://edugenius.ai/api/webhooks/telegram',
    tokenConfigured: false,
    dailyMessages: 0,
    avgResponseMs: 0,
    satisfactionScore: 0,
    activeConversations: 0,
    routedAgent: 'sage',
    quickRepliesEnabled: true,
    latexSupported: false,
    setupDocs: 'https://core.telegram.org/bots/api',
  },
  {
    id: 'widget',
    name: 'Embeddable Widget',
    icon: <Zap className="w-5 h-5 text-purple-400" />,
    description: 'Embed on any website — one script tag, infinite reach',
    status: 'inactive',
    webhookUrl: undefined,
    tokenConfigured: true,
    dailyMessages: 0,
    avgResponseMs: 0,
    satisfactionScore: 0,
    activeConversations: 0,
    routedAgent: 'sage',
    quickRepliesEnabled: true,
    latexSupported: true,
    setupDocs: 'https://docs.edugenius.ai/channels/widget',
  },
];

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ChannelStatus }) {
  const styles: Record<ChannelStatus, string> = {
    active:   'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    inactive: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    error:    'bg-red-500/20 text-red-300 border-red-500/30',
    pending:  'bg-amber-500/20 text-amber-300 border-amber-500/30',
  };
  const labels: Record<ChannelStatus, string> = {
    active: '● Live',
    inactive: '○ Inactive',
    error: '⚠ Error',
    pending: '◐ Setup Needed',
  };
  return (
    <span className={clsx('text-xs px-2 py-0.5 rounded-full border font-medium', styles[status])}>
      {labels[status]}
    </span>
  );
}

// ─── Metric chip ──────────────────────────────────────────────────────────────

function MetricChip({ label, value, suffix = '' }: { label: string; value: number | string; suffix?: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-white">{value}{suffix}</p>
      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
    </div>
  );
}

// ─── Channel Card ─────────────────────────────────────────────────────────────

function ChannelCard({
  channel,
  onConfigure,
  onPreview,
}: {
  channel: ChannelConfig;
  onConfigure: (ch: ChannelConfig) => void;
  onPreview: (ch: ChannelConfig) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyWebhook = () => {
    if (channel.webhookUrl) {
      navigator.clipboard.writeText(channel.webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isLive = channel.status === 'active';

  return (
    <div className={clsx(
      'rounded-2xl border p-5 flex flex-col gap-4 transition-all duration-200',
      isLive
        ? 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40'
        : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600/60',
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            isLive ? 'bg-emerald-500/20' : 'bg-slate-700/60',
          )}>
            {channel.icon}
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">{channel.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5 max-w-xs">{channel.description}</p>
          </div>
        </div>
        <StatusBadge status={channel.status} />
      </div>

      {/* Metrics (only for active channels) */}
      {isLive && (
        <div className="grid grid-cols-4 gap-2 py-3 border-y border-slate-700/30">
          <MetricChip label="Msgs/day" value={channel.dailyMessages.toLocaleString()} />
          <MetricChip label="Avg latency" value={channel.avgResponseMs} suffix="ms" />
          <MetricChip label="Satisfaction" value={channel.satisfactionScore} suffix="%" />
          <MetricChip label="Active now" value={channel.activeConversations} />
        </div>
      )}

      {/* Setup needed banner */}
      {channel.status === 'pending' && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-amber-300">Setup Required</p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              {!channel.tokenConfigured
                ? 'API token not configured — add it in Settings → Integrations'
                : 'Configure webhook URL in your provider dashboard'}
            </p>
            {channel.webhookUrl && (
              <div className="flex items-center gap-2 mt-2 p-1.5 bg-black/30 rounded-lg">
                <code className="text-[10px] text-amber-200 flex-1 truncate">{channel.webhookUrl}</code>
                <button onClick={copyWebhook} className="shrink-0">
                  {copied
                    ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                    : <Copy className="w-3.5 h-3.5 text-amber-400 hover:text-amber-200" />}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Capabilities row */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'LaTeX', enabled: channel.latexSupported },
          { label: 'Quick Replies', enabled: channel.quickRepliesEnabled },
          { label: 'Voice', enabled: channel.id === 'web' || channel.id === 'mobile' || channel.id === 'telegram' },
          { label: 'File Upload', enabled: channel.id !== 'widget' },
        ].map(({ label, enabled }) => (
          <span
            key={label}
            className={clsx(
              'text-[10px] px-2 py-0.5 rounded-full font-medium',
              enabled
                ? 'bg-indigo-500/15 text-indigo-300'
                : 'bg-slate-700/40 text-slate-500 line-through',
            )}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        <button
          onClick={() => onPreview(channel)}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> Preview
        </button>
        <button
          onClick={() => onConfigure(channel)}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-300 hover:text-indigo-200 transition-colors"
        >
          <Settings className="w-3.5 h-3.5" /> Configure
        </button>
        {channel.setupDocs && (
          <a
            href={channel.setupDocs}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs p-2 rounded-lg bg-slate-700/30 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Channel Preview Modal ────────────────────────────────────────────────────

function ChannelPreview({ channel, onClose }: { channel: ChannelConfig; onClose: () => void }) {
  const [testMessage, setTestMessage] = useState('Explain eigenvalues to me');
  const [previewResponse] = useState(
    channel.id === 'whatsapp'
      ? `*Eigenvalues — Quick Version* 🎯\n\nThink of a matrix as a stretching machine.\n\nWhen you apply it to certain special vectors (called *eigenvectors*), they don't change direction — they only get _scaled_.\n\nThat scale factor is the *eigenvalue*.\n\n• Ax = λx\n• A = matrix, x = eigenvector, λ = eigenvalue\n\nWant a worked example or practice question?`
      : channel.id === 'telegram'
      ? `*Eigenvalues* 🧮\n\nA matrix A has eigenvector x if:\n\`Ax = λx\`\n\nwhere λ (lambda) is the eigenvalue.\n\n*How to find them:*\n1. Solve det(A - λI) = 0\n2. This gives the characteristic polynomial\n3. Roots = eigenvalues\n\n*Example:* For A = [[2,1],[1,2]], eigenvalues are 3 and 1.\n\nWant me to walk through the full calculation?`
      : `**Eigenvalues** — here's the intuition 🎯\n\nA matrix $A$ is a **transformation** (rotation, stretch, shear). Some vectors survive this transformation with only their *magnitude* changed — not direction. These special vectors are called **eigenvectors**, and the scale factor is the **eigenvalue** $\\lambda$:\n\n$$Ax = \\lambda x$$\n\n**Finding eigenvalues:** Solve $\\det(A - \\lambda I) = 0$\n\nThis gives the **characteristic polynomial** — its roots are your eigenvalues.\n\n> *GATE 2023 asked a very similar problem — they gave a 2×2 matrix and asked for the larger eigenvalue. The trick: sum of eigenvalues = trace, product = determinant.*\n\nWant me to work through an example?`
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            {channel.icon}
            <div>
              <h3 className="font-semibold text-white text-sm">{channel.name} — Preview</h3>
              <p className="text-xs text-slate-400">How students see Sage's response on this channel</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">✕</button>
        </div>

        {/* Test message input */}
        <div className="p-4 border-b border-slate-700/30 bg-slate-800/40">
          <label className="text-xs text-slate-400 mb-1.5 block">Test message</label>
          <input
            value={testMessage}
            onChange={e => setTestMessage(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Channel-specific preview */}
        <div className="p-4 space-y-4">
          {/* User bubble */}
          <div className="flex justify-end">
            <div className={clsx(
              'max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm',
              channel.id === 'whatsapp'
                ? 'bg-[#dcf8c6] text-slate-900'
                : channel.id === 'telegram'
                ? 'bg-blue-500 text-white'
                : 'bg-indigo-600 text-white',
            )}>
              {testMessage}
            </div>
          </div>

          {/* Sage response — formatted per channel */}
          <div className="flex items-start gap-3">
            <div className={clsx(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0',
              channel.id === 'whatsapp' ? 'bg-green-500' : 'bg-indigo-600',
            )}>
              🎓
            </div>
            <div className={clsx(
              'flex-1 max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm',
              channel.id === 'whatsapp'
                ? 'bg-white text-slate-900 border border-slate-200'
                : 'bg-slate-800 text-slate-100 border border-slate-700',
            )}>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {previewResponse}
              </pre>
            </div>
          </div>

          {/* Quick replies */}
          {channel.quickRepliesEnabled && (
            <div className={clsx(
              'flex flex-wrap gap-2 pl-11',
              channel.id === 'telegram' ? 'grid grid-cols-2' : '',
            )}>
              {['📝 Practice MCQ', '🔢 Formula', '📋 PYQ', "🤔 Didn't get it"].map(r => (
                <button
                  key={r}
                  className={clsx(
                    'text-xs px-3 py-1.5 rounded-full border transition-colors',
                    channel.id === 'whatsapp'
                      ? 'border-green-500 text-green-700 bg-white hover:bg-green-50'
                      : channel.id === 'telegram'
                      ? 'border-blue-500/40 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 w-full text-center'
                      : 'border-indigo-500/40 text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Capability notes */}
        <div className="p-4 border-t border-slate-700/30 bg-slate-800/20">
          <p className="text-xs text-slate-400">
            {channel.id === 'whatsapp' && '⚠️ LaTeX rendered as plain text. Tables converted to bullets. Max 3 quick-reply buttons.'}
            {channel.id === 'telegram' && '✅ Markdown + code blocks supported. LaTeX as plain text. Inline keyboard for quick replies.'}
            {channel.id === 'web' && '✅ Full markdown, KaTeX, Manim visualisations, code highlighting, tables all supported.'}
            {channel.id === 'mobile' && '✅ Same as web. Layout adapted: bullets over tables, large thumb-zone input bar.'}
            {channel.id === 'widget' && '✅ Markdown + KaTeX. Compact layout. Quick replies below each response.'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Routing Rules Panel ──────────────────────────────────────────────────────

function RoutingRules() {
  const rules = [
    { trigger: 'Student asks a math/concept question', agent: 'Sage', priority: 1 },
    { trigger: 'Student asks about exam schedule or news', agent: 'Scout', priority: 2 },
    { trigger: 'Student inactive >3 days', agent: 'Mentor (auto-nudge)', priority: 3 },
    { trigger: 'Student reports a bug or access issue', agent: 'Nexus', priority: 4 },
    { trigger: 'Teacher asks about class progress', agent: 'Oracle', priority: 5 },
    { trigger: 'CEO asks for metrics', agent: 'Oracle', priority: 6 },
  ];

  return (
    <div className="space-y-2">
      {rules.map(r => (
        <div key={r.trigger} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
          <span className="text-xs text-slate-500 w-4 shrink-0">{r.priority}</span>
          <span className="text-xs text-slate-300 flex-1">{r.trigger}</span>
          <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
          <span className="text-xs font-medium text-indigo-300 shrink-0">{r.agent}</span>
        </div>
      ))}
      <button className="w-full text-xs text-indigo-400 hover:text-indigo-300 py-2 transition-colors">
        + Add routing rule
      </button>
    </div>
  );
}

// ─── Widget Embed Code ────────────────────────────────────────────────────────

function EmbedCode() {
  const [copied, setCopied] = useState(false);
  const code = `<script>
  window.EduGeniusWidget = {
    apiKey: 'YOUR_API_KEY',
    exam: 'gate-em',       // or 'cat', 'jee', etc.
    theme: 'dark',
    position: 'bottom-right',
  };
</script>
<script src="https://cdn.edugenius.ai/widget.js" async></script>`;

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <pre className="p-4 bg-black/40 rounded-xl border border-slate-700/50 text-xs text-slate-300 overflow-x-auto">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 transition-colors"
      >
        {copied
          ? <Check className="w-3.5 h-3.5 text-emerald-400" />
          : <Copy className="w-3.5 h-3.5 text-slate-400" />}
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ChannelManager() {
  const [activeTab, setActiveTab] = useState<'channels' | 'routing' | 'embed' | 'analytics'>('channels');
  const [previewChannel, setPreviewChannel] = useState<ChannelConfig | null>(null);
  const [configuringChannel, setConfiguringChannel] = useState<ChannelConfig | null>(null);

  const totalDailyMessages = CHANNELS.reduce((s, c) => s + c.dailyMessages, 0);
  const activeChannels = CHANNELS.filter(c => c.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Channel Manager</h1>
        <p className="text-slate-400 text-sm mt-1">
          Control where and how students talk to Sage — web, mobile, WhatsApp, Telegram, and embedded widget.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Channels', value: `${activeChannels}/5`, icon: <Zap className="w-4 h-4" /> },
          { label: 'Msgs Today', value: totalDailyMessages.toLocaleString(), icon: <MessageSquare className="w-4 h-4" /> },
          { label: 'Live Convos', value: '62', icon: <Users className="w-4 h-4" /> },
          { label: 'Avg Latency', value: '2.2s', icon: <Clock className="w-4 h-4" /> },
        ].map(stat => (
          <div key={stat.label} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/40 flex items-center gap-3">
            <div className="text-indigo-400">{stat.icon}</div>
            <div>
              <p className="text-lg font-bold text-white">{stat.value}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800/50 rounded-xl border border-slate-700/40 w-fit">
        {(['channels', 'routing', 'embed', 'analytics'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all',
              activeTab === tab
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'channels' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {CHANNELS.map(ch => (
            <ChannelCard
              key={ch.id}
              channel={ch}
              onConfigure={setConfiguringChannel}
              onPreview={setPreviewChannel}
            />
          ))}
        </div>
      )}

      {activeTab === 'routing' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-sm font-semibold text-white mb-3">Message Routing Rules</h2>
            <p className="text-xs text-slate-400 mb-4">
              Incoming messages are matched top-to-bottom. First match wins. All channels use these rules.
            </p>
            <RoutingRules />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white mb-3">Channel → Agent Map</h2>
            <div className="space-y-2">
              {CHANNELS.map(ch => (
                <div key={ch.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
                  <span className="text-slate-400">{ch.icon}</span>
                  <span className="text-sm text-slate-300 flex-1">{ch.name}</span>
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span className="text-xs font-medium text-indigo-300 capitalize">{ch.routedAgent}</span>
                  <button className="text-slate-500 hover:text-slate-300 text-xs">Edit</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'embed' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-sm font-semibold text-white mb-3">Widget Embed Code</h2>
            <p className="text-xs text-slate-400 mb-4">
              Paste this into any website's &lt;head&gt; or &lt;body&gt; to add Sage as a floating chat button.
            </p>
            <EmbedCode />
            <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-300 font-medium mb-1">⚠️ Widget is inactive</p>
              <p className="text-xs text-amber-400/80">
                Set status to Active in the Channels tab, then add your API key to the embed code.
              </p>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white mb-3">Widget Customisation</h2>
            <div className="space-y-3">
              {[
                { label: 'Theme', options: ['dark', 'light', 'auto'] },
                { label: 'Position', options: ['bottom-right', 'bottom-left', 'top-right'] },
                { label: 'Language', options: ['English', 'Hindi', 'Tamil', 'Telugu'] },
              ].map(({ label, options }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{label}</span>
                  <select className="text-xs bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500">
                    {options.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="p-8 text-center text-slate-400">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="font-medium text-white">Channel Analytics</p>
          <p className="text-sm mt-1">Per-channel conversation volume, satisfaction scores, and drop-off analysis — coming in Phase 5.</p>
        </div>
      )}

      {/* Channel Preview Modal */}
      {previewChannel && (
        <ChannelPreview channel={previewChannel} onClose={() => setPreviewChannel(null)} />
      )}
    </div>
  );
}

export default ChannelManager;
