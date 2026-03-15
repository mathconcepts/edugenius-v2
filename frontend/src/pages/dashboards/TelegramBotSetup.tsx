/**
 * TelegramBotSetup.tsx — CEO Guided Telegram Bot Setup Wizard
 *
 * Steps: Welcome → Token → Validated → Webhook Config → Webhook Live → Test → Live
 * Includes: health monitor, troubleshooting, multi-bot mode
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, XCircle, AlertTriangle, Eye, EyeOff, Copy, RefreshCw,
  MessageSquare, ChevronRight, ChevronDown, ChevronUp, Loader2,
  ArrowLeft, Shield, Zap, Globe, Users, Bot, Activity,
  ExternalLink, Plus, Trash2, RotateCcw,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  loadBotConfig,
  saveBotConfig,
  resetSetup,
  validateBotToken,
  generateWebhookSecret,
  suggestWebhookUrl,
  setTelegramWebhook,
  deleteTelegramWebhook,
  checkWebhookStatus,
  setBotCommands,
  getDefaultCommands,
  sendTestMessage,
  runHealthCheck,
  advanceStep,
  setError,
  obfuscateToken,
  deobfuscateToken,
  isValidTokenFormat,
  type TelegramBotConfig,
  type SetupStep,
  type BotCommandSpec,
  type SetupDiagnostic,
  type ExamBotEntry,
} from '@/services/telegramBotSetupService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STEPS: SetupStep[] = [
  'not_started', 'token_entry', 'token_valid',
  'webhook_config', 'webhook_live', 'send_test', 'live',
];

const STEP_LABELS = [
  'Welcome', 'Bot Token', 'Validated',
  'Webhook', 'Confirmed', 'Test', 'Live!',
];

function stepIndex(step: SetupStep): number {
  const i = STEPS.indexOf(step);
  return i < 0 ? 0 : i;
}

function makeNewConfig(): TelegramBotConfig {
  return {
    botToken: '',
    botId: 0,
    botUsername: '',
    botName: '',
    webhookUrl: suggestWebhookUrl(),
    webhookSecret: generateWebhookSecret(),
    setupStep: 'not_started',
    isLive: false,
    botCommands: getDefaultCommands(),
    examBots: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Small UI atoms ───────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-surface-900/50 border border-surface-700 rounded-xl p-6', className)}>
      {children}
    </div>
  );
}

function StatusDot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  if (warn) return <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />;
  return <span className={clsx('inline-block w-2 h-2 rounded-full flex-shrink-0', ok ? 'bg-green-400' : 'bg-red-400')} />;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {});
  };
  return (
    <button onClick={copy} className="p-1.5 hover:bg-surface-700 rounded-lg transition-colors" title="Copy">
      {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-surface-400" />}
    </button>
  );
}

function ErrorBanner({ message, fix }: { message: string; fix?: string }) {
  return (
    <div className="flex gap-3 p-4 bg-red-900/20 border border-red-700/50 rounded-xl mt-4">
      <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm text-red-300">{message}</p>
        {fix && <p className="text-xs text-red-400/70 mt-1">Fix: {fix}</p>}
      </div>
    </div>
  );
}

function WarningBanner({ message }: { message: string }) {
  return (
    <div className="flex gap-3 p-4 bg-yellow-900/20 border border-yellow-700/40 rounded-xl mt-3">
      <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-yellow-300">{message}</p>
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex gap-3 p-4 bg-green-900/20 border border-green-700/40 rounded-xl mt-3">
      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-green-300">{message}</p>
    </div>
  );
}

// ─── Progress Stepper ─────────────────────────────────────────────────────────

function Stepper({ current }: { current: SetupStep }) {
  const idx = stepIndex(current);
  const displaySteps = STEP_LABELS.slice(0, 7);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {displaySteps.map((label, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={clsx(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                done ? 'bg-green-500 text-white' :
                active ? 'bg-primary-500 text-white ring-2 ring-primary-400/50' :
                'bg-surface-700 text-surface-400'
              )}>
                {done ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={clsx('text-[9px] mt-1 whitespace-nowrap', active ? 'text-primary-400' : done ? 'text-green-400' : 'text-surface-500')}>
                {label}
              </span>
            </div>
            {i < displaySteps.length - 1 && (
              <div className={clsx('flex-1 h-0.5 min-w-[16px] rounded mt-[-12px]', i < idx ? 'bg-green-500' : 'bg-surface-700')} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Diagnostic Row ───────────────────────────────────────────────────────────

function DiagRow({ d }: { d: SetupDiagnostic }) {
  const icon = d.status === 'pass'
    ? <CheckCircle className="w-4 h-4 text-green-400" />
    : d.status === 'fail'
      ? <XCircle className="w-4 h-4 text-red-400" />
      : d.status === 'warn'
        ? <AlertTriangle className="w-4 h-4 text-yellow-400" />
        : <Loader2 className="w-4 h-4 text-surface-400 animate-spin" />;

  return (
    <div className="flex items-start gap-3 py-2 border-b border-surface-700/30 last:border-0">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium">{d.check}</p>
        <p className="text-xs text-surface-400 mt-0.5">{d.detail}</p>
        {d.fix && <p className="text-xs text-yellow-300/80 mt-1">💡 {d.fix}</p>}
      </div>
    </div>
  );
}

// ─── Step 0: Welcome ──────────────────────────────────────────────────────────

function StepWelcome({ onStart }: { onStart: () => void }) {
  const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  const checks = [
    { label: 'Backend URL (VITE_API_BASE_URL)', ok: !!apiBase, value: apiBase },
    { label: 'Supabase configured', ok: !!supabaseUrl, value: supabaseUrl ? 'Set ✓' : undefined },
    { label: 'Gemini API key', ok: !!geminiKey, value: geminiKey ? 'Set ✓' : undefined },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
          <MessageSquare className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">Set up your Telegram Bot</h1>
        <p className="text-surface-400 max-w-lg mx-auto">
          Connect EduGenius to Telegram in about 5 minutes. Students can then interact with your AI tutor directly from Telegram — no app download required.
        </p>
      </div>

      <Card>
        <h3 className="font-semibold text-white mb-3">What this bot does</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Bot, label: 'AI tutoring', desc: 'Sage answers questions 24/7' },
            { icon: Zap, label: 'SR nudges', desc: 'Spaced-repetition reminders' },
            { icon: Globe, label: 'Daily brief', desc: 'Morning study plan delivery' },
            { icon: Users, label: 'Exam switching', desc: 'Students change active exam' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex gap-2.5 p-3 bg-surface-800/50 rounded-lg">
              <Icon className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-white font-medium">{label}</p>
                <p className="text-xs text-surface-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-white mb-3">Pre-flight check</h3>
        <div className="space-y-2">
          {checks.map(c => (
            <div key={c.label} className="flex items-center gap-3">
              <StatusDot ok={c.ok} warn={!c.ok} />
              <span className={clsx('text-sm', c.ok ? 'text-surface-300' : 'text-yellow-400')}>{c.label}</span>
              {c.ok && c.value && c.value !== 'Set ✓' && (
                <span className="text-xs text-surface-500 truncate max-w-[160px]">{c.value}</span>
              )}
              {!c.ok && <span className="text-xs text-yellow-500">Not set — bot will still work</span>}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-white mb-2">What you'll need</h3>
        <ul className="space-y-1.5 text-sm text-surface-300">
          <li className="flex gap-2"><span className="text-primary-400">1.</span>A Telegram account</li>
          <li className="flex gap-2"><span className="text-primary-400">2.</span>A bot token from @BotFather (we'll guide you)</li>
          <li className="flex gap-2"><span className="text-primary-400">3.</span>A public HTTPS webhook URL (your backend)</li>
        </ul>
      </Card>

      <button
        onClick={onStart}
        className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
      >
        Let's Start <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Step 1: Token Entry ──────────────────────────────────────────────────────

function StepTokenEntry({
  onValidate,
  initialToken,
}: {
  onValidate: (token: string, botInfo: { id: number; username: string; name: string }, privacyMode: boolean) => void;
  initialToken?: string;
}) {
  const [token, setToken] = useState(initialToken ?? '');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setErr] = useState<string | null>(null);
  const [formatOk, setFormatOk] = useState<boolean | null>(null);

  const handleChange = (v: string) => {
    setToken(v);
    setErr(null);
    if (v.length > 10) setFormatOk(isValidTokenFormat(v.trim()));
    else setFormatOk(null);
  };

  const handleValidate = async () => {
    setErr(null);
    setLoading(true);
    const result = await validateBotToken(token);
    setLoading(false);
    if (!result.valid || !result.botInfo) {
      setErr(result.error ?? 'Validation failed.');
      return;
    }
    onValidate(token.trim(), result.botInfo, result.privacyMode ?? false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Get your bot token</h2>
        <p className="text-surface-400 text-sm mt-1">Follow these steps in Telegram, then paste your token below.</p>
      </div>

      <Card>
        <ol className="space-y-3 text-sm text-surface-300">
          {[
            <>Open Telegram and search for <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-primary-400 hover:underline">@BotFather</a></>,
            'Send the command: /newbot',
            'Choose a name for your bot (e.g. "EduGenius")',
            'Choose a username — must end in "bot" (e.g. EduGeniusBot)',
            'BotFather sends you a token — copy and paste it below',
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-primary-500/20 text-primary-400 text-xs flex items-center justify-center flex-shrink-0 font-bold mt-0.5">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Card>

      <div>
        <label className="block text-sm text-surface-300 mb-2 font-medium">Bot Token</label>
        <div className={clsx(
          'flex items-center gap-2 rounded-xl border bg-surface-800/50 px-3 py-2.5 transition-colors',
          error ? 'border-red-500/60' :
          formatOk === true ? 'border-green-500/50' :
          'border-surface-600 focus-within:border-primary-500/60'
        )}>
          <input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={e => handleChange(e.target.value)}
            placeholder="123456789:ABCdefGhijklmnopqrstuvwxyz_1234567"
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-surface-600 font-mono"
            onKeyDown={e => e.key === 'Enter' && !loading && handleValidate()}
          />
          <button onClick={() => setShowToken(v => !v)} className="text-surface-400 hover:text-white transition-colors">
            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {formatOk === true && !error && (
          <p className="text-xs text-green-400 mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Format looks correct</p>
        )}
        {formatOk === false && (
          <p className="text-xs text-red-400 mt-1">Token must look like: 123456789:ABCdefGhijklmnop... (35+ chars after the colon)</p>
        )}
        <p className="text-xs text-surface-500 mt-2">🔒 Stored encrypted in your browser. Never shared with third parties.</p>
      </div>

      {error && <ErrorBanner message={error} fix={error.includes('Unauthorized') ? 'Go back to BotFather → /revoke then /token to get a fresh token.' : undefined} />}

      <button
        onClick={handleValidate}
        disabled={loading || !token.trim()}
        className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
        {loading ? 'Validating…' : 'Validate Token →'}
      </button>
    </div>
  );
}

// ─── Step 2: Token Validated ──────────────────────────────────────────────────

function StepTokenValidated({
  config,
  existingWebhook,
  privacyMode,
  onContinue,
  onBack,
}: {
  config: TelegramBotConfig;
  existingWebhook: string;
  privacyMode: boolean;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="w-16 h-16 mx-auto rounded-full bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center"
        >
          <CheckCircle className="w-8 h-8 text-green-400" />
        </motion.div>
        <h2 className="text-xl font-bold text-white">This is your bot 🎉</h2>
      </div>

      <Card>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white">{config.botName}</p>
              <p className="text-sm text-primary-400">@{config.botUsername}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-surface-800/50 rounded-lg p-3">
              <p className="text-xs text-surface-500">Bot ID</p>
              <p className="text-sm text-white font-mono">{config.botId}</p>
            </div>
            <div className="bg-surface-800/50 rounded-lg p-3">
              <p className="text-xs text-surface-500">Bot Link</p>
              <a href={`https://t.me/${config.botUsername}`} target="_blank" rel="noreferrer"
                className="text-sm text-primary-400 hover:underline flex items-center gap-1">
                t.me/{config.botUsername} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </Card>

      {existingWebhook && existingWebhook !== config.webhookUrl && (
        <WarningBanner message={`This bot already has a webhook set to: ${existingWebhook}. We'll update it to your new URL in the next step.`} />
      )}

      {privacyMode && (
        <WarningBanner message="Bot privacy mode is ON — this bot cannot read group messages. If you use group tutoring, go to @BotFather → /setprivacy → Disable for this bot." />
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="px-4 py-3 rounded-xl border border-surface-600 text-surface-300 hover:bg-surface-800 transition-colors flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={onContinue} className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold flex items-center justify-center gap-2 transition-colors">
          Configure Webhook <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Webhook Config ───────────────────────────────────────────────────

function StepWebhookConfig({
  config,
  onSetWebhook,
  onBack,
}: {
  config: TelegramBotConfig;
  onSetWebhook: (url: string, secret: string) => Promise<void>;
  onBack: () => void;
}) {
  const [url, setUrl] = useState(config.webhookUrl || suggestWebhookUrl());
  const [secret, setSecret] = useState(config.webhookSecret || generateWebhookSecret());
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setErr] = useState<string | null>(null);

  const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const urlIsHttps = url.startsWith('https://') || url.startsWith('/.netlify/');
  const urlIsHttp = url.startsWith('http://');

  const handleSet = async () => {
    setErr(null);
    setLoading(true);
    await onSetWebhook(url, secret);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Configure Webhook</h2>
        <p className="text-surface-400 text-sm mt-1">
          A webhook is how Telegram delivers messages to your server — like a doorbell that rings every time someone messages your bot.
        </p>
      </div>

      {!apiBase && (
        <Card className="border-yellow-700/40 bg-yellow-900/10">
          <div className="flex gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-300 font-medium">VITE_API_BASE_URL is not set</p>
          </div>
          <p className="text-xs text-yellow-400/80 mb-3">You need a backend to receive Telegram messages. Options:</p>
          <div className="space-y-2 text-xs text-surface-300">
            <div className="bg-surface-800/50 rounded-lg p-3">
              <p className="font-medium text-white mb-1">Option A — Netlify Functions</p>
              <p className="font-mono text-primary-400">/.netlify/functions/telegram-webhook</p>
              <p className="text-surface-500 mt-1">Works without a separate backend.</p>
            </div>
            <div className="bg-surface-800/50 rounded-lg p-3">
              <p className="font-medium text-white mb-1">Option B — Railway / Render</p>
              <p className="text-surface-400">Deploy a Node.js backend → set VITE_API_BASE_URL in Netlify env vars.</p>
            </div>
            <div className="bg-surface-800/50 rounded-lg p-3">
              <p className="font-medium text-white mb-1">Option C — Local dev with ngrok</p>
              <p className="font-mono text-primary-400">ngrok http 3000</p>
              <p className="text-surface-500 mt-1">Gives a public HTTPS URL for testing.</p>
            </div>
          </div>
        </Card>
      )}

      <div>
        <label className="block text-sm text-surface-300 mb-2 font-medium">Webhook URL</label>
        <div className={clsx(
          'flex items-center gap-2 rounded-xl border bg-surface-800/50 px-3 py-2.5 transition-colors',
          urlIsHttp ? 'border-red-500/60' :
          urlIsHttps ? 'border-green-500/40 focus-within:border-green-500/60' :
          'border-surface-600 focus-within:border-primary-500/60'
        )}>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://your-api.com/webhook/telegram"
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-surface-600 font-mono"
          />
        </div>
        {urlIsHttp && (
          <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><XCircle className="w-3 h-3" />Must be HTTPS. Telegram rejects plain HTTP.</p>
        )}
        {urlIsHttps && (
          <p className="text-xs text-green-400 mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" />HTTPS ✓</p>
        )}
      </div>

      <div>
        <label className="block text-sm text-surface-300 mb-2 font-medium">Webhook Secret</label>
        <p className="text-xs text-surface-500 mb-2">A random secret that your backend uses to verify requests are from Telegram — never share it.</p>
        <div className="flex items-center gap-2 rounded-xl border border-surface-600 bg-surface-800/50 px-3 py-2.5">
          <input
            type={showSecret ? 'text' : 'password'}
            value={secret}
            onChange={e => setSecret(e.target.value)}
            className="flex-1 bg-transparent text-white text-sm outline-none font-mono"
          />
          <button onClick={() => setShowSecret(v => !v)} className="text-surface-400 hover:text-white">
            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <CopyButton text={secret} />
          <button
            onClick={() => setSecret(generateWebhookSecret())}
            className="p-1.5 hover:bg-surface-700 rounded-lg transition-colors"
            title="Regenerate"
          >
            <RefreshCw className="w-4 h-4 text-surface-400" />
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="flex gap-3">
        <button onClick={onBack} className="px-4 py-3 rounded-xl border border-surface-600 text-surface-300 hover:bg-surface-800 transition-colors flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={handleSet}
          disabled={loading || !url.trim() || urlIsHttp}
          className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
          {loading ? 'Setting webhook…' : 'Set Webhook →'}
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Webhook Live ─────────────────────────────────────────────────

function StepWebhookLive({
  config,
  onSetCommands,
  onBack,
}: {
  config: TelegramBotConfig;
  onSetCommands: (commands: BotCommandSpec[]) => Promise<void>;
  onBack: () => void;
}) {
  const [commands, setCommands] = useState<BotCommandSpec[]>(config.botCommands);
  const [loading, setLoading] = useState(false);
  const [error, setErr] = useState<string | null>(null);
  const [webhookInfo, setWebhookInfo] = useState<{ pendingCount: number; lastError?: string } | null>(null);

  const token = deobfuscateToken(config.botToken);

  useEffect(() => {
    checkWebhookStatus(token).then(info => {
      setWebhookInfo({ pendingCount: info.pendingCount, lastError: info.lastError });
    }).catch(() => {});
  }, [token]);

  const toggleCommand = (cmd: string) => {
    setCommands(prev => prev.map(c => c.command === cmd ? { ...c, enabled: !c.enabled } : c));
  };

  const handleSetCommands = async () => {
    setErr(null);
    setLoading(true);
    await onSetCommands(commands);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="w-14 h-14 mx-auto rounded-full bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center"
        >
          <CheckCircle className="w-7 h-7 text-green-400" />
        </motion.div>
        <h2 className="text-xl font-bold text-white">Webhook registered ✅</h2>
        <p className="text-surface-400 text-sm">Telegram will now deliver messages to your server.</p>
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-white mb-3">Webhook Status</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-surface-300">URL: <span className="font-mono text-white text-xs">{config.webhookUrl}</span></span>
          </div>
          {webhookInfo && (
            <div className="flex items-center gap-2">
              {webhookInfo.pendingCount > 100
                ? <AlertTriangle className="w-4 h-4 text-yellow-400" />
                : <CheckCircle className="w-4 h-4 text-green-400" />}
              <span className="text-surface-300">Pending updates: {webhookInfo.pendingCount}</span>
              {webhookInfo.pendingCount > 100 && (
                <span className="text-xs text-yellow-400">(backlog — check backend)</span>
              )}
            </div>
          )}
          {webhookInfo?.lastError && (
            <ErrorBanner
              message={`Telegram last error: ${webhookInfo.lastError}`}
              fix="Check your backend logs. Ensure the webhook route is live and returning 200."
            />
          )}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-white mb-3">Configure Bot Commands</h3>
        <p className="text-xs text-surface-500 mb-3">These appear in the Telegram command menu when users type /</p>
        <div className="space-y-2">
          {commands.map(cmd => (
            <label key={cmd.command} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={cmd.enabled}
                onChange={() => toggleCommand(cmd.command)}
                className="mt-1 rounded text-primary-500"
              />
              <div>
                <p className={clsx('text-sm font-medium', cmd.enabled ? 'text-white' : 'text-surface-500')}>
                  /{cmd.command}
                </p>
                <p className="text-xs text-surface-500">{cmd.description}</p>
              </div>
            </label>
          ))}
        </div>
      </Card>

      {error && <ErrorBanner message={error} />}

      <div className="flex gap-3">
        <button onClick={onBack} className="px-4 py-3 rounded-xl border border-surface-600 text-surface-300 hover:bg-surface-800 transition-colors flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={handleSetCommands}
          disabled={loading}
          className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {loading ? 'Setting commands…' : 'Set Commands & Continue →'}
        </button>
      </div>
    </div>
  );
}

// ─── Step 5: Test Message ─────────────────────────────────────────────────────

function StepSendTest({
  config,
  onTestSent,
  onBack,
}: {
  config: TelegramBotConfig;
  onTestSent: (chatId: string) => Promise<void>;
  onBack: () => void;
}) {
  const [chatId, setChatId] = useState(config.testChatId ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSend = async () => {
    setErr(null);
    setLoading(true);
    const token = deobfuscateToken(config.botToken);
    const result = await sendTestMessage(token, chatId);
    setLoading(false);
    if (!result.success) {
      setErr(result.error ?? 'Failed to send message.');
      return;
    }
    setSuccess(true);
    await onTestSent(chatId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Send a test message</h2>
        <p className="text-surface-400 text-sm mt-1">Let's verify everything works end-to-end.</p>
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-white mb-3">Before you proceed</h3>
        <ol className="space-y-2 text-sm text-surface-300">
          <li className="flex gap-2">
            <span className="text-primary-400 font-bold">1.</span>
            Open Telegram and find your bot: <span className="text-primary-400 font-mono">@{config.botUsername}</span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary-400 font-bold">2.</span>
            Send <span className="font-mono text-white">/start</span> to the bot
          </li>
          <li className="flex gap-2">
            <span className="text-primary-400 font-bold">3.</span>
            Get your chat ID from <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-primary-400 hover:underline">@userinfobot</a>
          </li>
        </ol>
        <div className="mt-3 p-3 bg-surface-800/50 rounded-lg">
          <p className="text-xs text-surface-400">💡 Tip: Message @userinfobot on Telegram — it replies with your chat ID instantly.</p>
        </div>
      </Card>

      <div>
        <label className="block text-sm text-surface-300 mb-2 font-medium">Your Telegram Chat ID</label>
        <input
          type="text"
          value={chatId}
          onChange={e => { setChatId(e.target.value); setErr(null); setSuccess(false); }}
          placeholder="e.g. 123456789"
          className="w-full bg-surface-800/50 border border-surface-600 focus:border-primary-500/60 rounded-xl px-3 py-2.5 text-white text-sm outline-none font-mono placeholder:text-surface-600 transition-colors"
        />
      </div>

      {error && (
        <ErrorBanner
          message={error}
          fix={
            error.includes('/start') ? `Open Telegram → @${config.botUsername} → send /start, then try again.` :
            error.includes('not found') ? 'Double-check the chat ID. Get it from @userinfobot on Telegram.' : undefined
          }
        />
      )}

      {success && <SuccessBanner message="🎉 Test message sent! Check your Telegram app." />}

      <div className="flex gap-3">
        <button onClick={onBack} className="px-4 py-3 rounded-xl border border-surface-600 text-surface-300 hover:bg-surface-800 transition-colors flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={handleSend}
          disabled={loading || !chatId.trim()}
          className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
          {loading ? 'Sending…' : 'Send Test Message →'}
        </button>
      </div>
    </div>
  );
}

// ─── Step 6: Live! Dashboard ──────────────────────────────────────────────────

function StepLive({ config, onReset }: { config: TelegramBotConfig; onReset: () => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, -10, 10, -5, 5, 0] }}
          transition={{ duration: 0.6 }}
          className="text-5xl"
        >
          🟢
        </motion.div>
        <h2 className="text-2xl font-bold text-white">Bot is LIVE!</h2>
        <p className="text-surface-400">Your EduGenius Telegram bot is fully operational.</p>
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-white mb-3">Health Summary</h3>
        <div className="space-y-2">
          {[
            { label: 'Token', ok: true },
            { label: 'Webhook', ok: true },
            { label: 'Commands', ok: config.botCommands.some(c => c.enabled) },
            { label: 'Test message', ok: !!config.testChatId },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3">
              {item.ok
                ? <CheckCircle className="w-4 h-4 text-green-400" />
                : <AlertTriangle className="w-4 h-4 text-yellow-400" />}
              <span className="text-sm text-surface-300">{item.label}</span>
              <span className={clsx('text-xs ml-auto', item.ok ? 'text-green-400' : 'text-yellow-400')}>
                {item.ok ? '✓' : 'Skipped'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-white mb-3">Bot Link</h3>
        <div className="flex items-center gap-2 bg-surface-800/50 rounded-lg p-3">
          <span className="text-sm text-primary-400 font-mono flex-1">https://t.me/{config.botUsername}</span>
          <CopyButton text={`https://t.me/${config.botUsername}`} />
          <a href={`https://t.me/${config.botUsername}`} target="_blank" rel="noreferrer"
            className="p-1.5 hover:bg-surface-700 rounded-lg transition-colors">
            <ExternalLink className="w-4 h-4 text-surface-400" />
          </a>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-white mb-3">Next Steps</h3>
        <div className="space-y-2">
          {[
            { label: 'Share bot link with students', icon: Users, desc: `https://t.me/${config.botUsername}` },
            { label: 'Configure Daily Brief schedule', icon: Activity, desc: 'Mentor agent settings' },
            { label: 'Set up exam-specific bots', icon: Bot, desc: 'Advanced multi-bot mode below' },
          ].map(({ label, icon: Icon, desc }) => (
            <div key={label} className="flex gap-3 p-3 bg-surface-800/30 rounded-lg">
              <Icon className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-white">{label}</p>
                <p className="text-xs text-surface-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <button
        onClick={onReset}
        className="w-full py-2.5 rounded-xl border border-red-700/40 text-red-400 hover:bg-red-900/20 text-sm transition-colors flex items-center justify-center gap-2"
      >
        <RotateCcw className="w-4 h-4" /> Reset Setup (start over)
      </button>
    </div>
  );
}

// ─── Health Monitor Panel ─────────────────────────────────────────────────────

function HealthMonitor({ config }: { config: TelegramBotConfig }) {
  const [diagnostics, setDiagnostics] = useState<SetupDiagnostic[]>([]);
  const [running, setRunning] = useState(false);
  const [lastCheck, setLastCheck] = useState(config.lastHealthCheck ?? null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runCheck = useCallback(async () => {
    setRunning(true);
    const results = await runHealthCheck(config);
    setDiagnostics(results);
    setRunning(false);
    setLastCheck(new Date().toISOString());
  }, [config]);

  // Auto-check every 5 minutes
  useEffect(() => {
    runCheck();
    intervalRef.current = setInterval(runCheck, 5 * 60 * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [runCheck]);

  const hasFail = diagnostics.some(d => d.status === 'fail');
  const hasWarn = diagnostics.some(d => d.status === 'warn');

  return (
    <Card className={clsx(
      hasFail ? 'border-red-700/50' : hasWarn ? 'border-yellow-700/40' : 'border-green-700/30'
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className={clsx('w-4 h-4', hasFail ? 'text-red-400' : hasWarn ? 'text-yellow-400' : 'text-green-400')} />
          <h3 className="font-semibold text-white text-sm">Health Monitor</h3>
        </div>
        <div className="flex items-center gap-3">
          {lastCheck && (
            <span className="text-xs text-surface-500">
              Last: {new Date(lastCheck).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={runCheck}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700 hover:bg-surface-600 text-xs text-surface-300 transition-colors disabled:opacity-50"
          >
            {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {running ? 'Checking…' : 'Run Check'}
          </button>
        </div>
      </div>
      {diagnostics.length === 0 && running && (
        <p className="text-sm text-surface-500 text-center py-4">Running diagnostics…</p>
      )}
      {diagnostics.map((d, i) => <DiagRow key={i} d={d} />)}
    </Card>
  );
}

// ─── Troubleshooting Section ──────────────────────────────────────────────────

const TROUBLESHOOT_ITEMS = [
  { problem: 'Invalid token', symptom: '"Unauthorized" from Telegram', fix: 'Re-create bot in @BotFather using /newbot' },
  { problem: 'Webhook not receiving', symptom: 'pending_update_count growing', fix: 'Check webhook URL is HTTPS + publicly reachable' },
  { problem: 'Bot not responding', symptom: 'Message sent, no reply', fix: 'Check backend logs, verify webhook secret matches TELEGRAM_WEBHOOK_SECRET env var' },
  { problem: '"Chat not found"', symptom: 'Test message fails', fix: 'User must /start the bot first. Check chat ID is correct.' },
  { problem: 'Webhook URL is HTTP', symptom: 'setWebhook fails', fix: 'Must be HTTPS. Use ngrok for local dev: ngrok http 3000' },
  { problem: 'Bot privacy mode ON', symptom: "Can't read group messages", fix: '@BotFather → /setprivacy → select bot → Disable' },
  { problem: 'Flood control', symptom: '429 Too Many Requests', fix: 'Telegram rate limits. Add delays between sends (> 30 msg/sec triggers limits)' },
  { problem: 'Webhook 409 conflict', symptom: 'Another process is polling', fix: 'Delete webhook first (deleteTelegramWebhook), then re-set' },
  { problem: 'Self-signed cert', symptom: 'Webhook fails SSL', fix: 'Upload cert to Telegram setWebhook or use a cert from a trusted CA' },
  { problem: 'IP not whitelisted', symptom: "Telegram can't reach webhook", fix: 'Open ports 80, 88, 443, 8443 in your firewall' },
];

function TroubleshootingSection() {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <span className="font-semibold text-white text-sm">Troubleshooting Guide</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-surface-400" /> : <ChevronDown className="w-4 h-4 text-surface-400" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-surface-700">
                    <th className="text-left py-2 text-surface-400 font-medium pr-4">Problem</th>
                    <th className="text-left py-2 text-surface-400 font-medium pr-4">Symptom</th>
                    <th className="text-left py-2 text-surface-400 font-medium">Fix</th>
                  </tr>
                </thead>
                <tbody>
                  {TROUBLESHOOT_ITEMS.map((item, i) => (
                    <tr key={i} className="border-b border-surface-700/30 last:border-0">
                      <td className="py-2 pr-4 text-white font-medium whitespace-nowrap">{item.problem}</td>
                      <td className="py-2 pr-4 text-surface-400">{item.symptom}</td>
                      <td className="py-2 text-green-400">{item.fix}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ─── Multi-Bot (Exam-Scoped) Section ──────────────────────────────────────────

function ExamBotsSection({
  examBots,
  onUpdate,
}: {
  examBots: ExamBotEntry[];
  onUpdate: (bots: ExamBotEntry[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<ExamBotEntry>>({});

  const addBot = () => {
    if (!newEntry.examId || !newEntry.botToken) return;
    const entry: ExamBotEntry = {
      examId: newEntry.examId,
      examName: newEntry.examName ?? newEntry.examId,
      botToken: obfuscateToken(newEntry.botToken),
      botUsername: newEntry.botUsername ?? '',
      webhookUrl: newEntry.webhookUrl ?? suggestWebhookUrl(),
      isLive: false,
    };
    onUpdate([...examBots, entry]);
    setNewEntry({});
    setAdding(false);
  };

  const removeBot = (examId: string) => {
    onUpdate(examBots.filter(b => b.examId !== examId));
  };

  return (
    <Card>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary-400" />
          <span className="font-semibold text-white text-sm">Per-Exam Bots (Advanced)</span>
          {examBots.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-primary-500/20 text-primary-400 text-xs">{examBots.length}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-surface-400" /> : <ChevronDown className="w-4 h-4 text-surface-400" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3">
              <p className="text-xs text-surface-400">
                Create separate bots for each exam — e.g. @EduGeniusGATEBot, @EduGeniusJEEBot. Each bot follows the same setup flow.
              </p>

              {examBots.map(bot => (
                <div key={bot.examId} className="flex items-center gap-3 p-3 bg-surface-800/30 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{bot.examName}</p>
                    <p className="text-xs text-surface-500">@{bot.botUsername || '(not set)'}</p>
                  </div>
                  <StatusDot ok={bot.isLive} />
                  <button
                    onClick={() => removeBot(bot.examId)}
                    className="p-1.5 hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              ))}

              {adding ? (
                <div className="space-y-2 p-3 bg-surface-800/30 rounded-lg">
                  <input
                    type="text"
                    placeholder="Exam ID (e.g. GATE)"
                    value={newEntry.examId ?? ''}
                    onChange={e => setNewEntry(p => ({ ...p, examId: e.target.value }))}
                    className="w-full bg-surface-700/50 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-surface-500"
                  />
                  <input
                    type="text"
                    placeholder="Exam Name (e.g. GATE Engineering)"
                    value={newEntry.examName ?? ''}
                    onChange={e => setNewEntry(p => ({ ...p, examName: e.target.value }))}
                    className="w-full bg-surface-700/50 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-surface-500"
                  />
                  <input
                    type="password"
                    placeholder="Bot Token from BotFather"
                    value={newEntry.botToken ?? ''}
                    onChange={e => setNewEntry(p => ({ ...p, botToken: e.target.value }))}
                    className="w-full bg-surface-700/50 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-surface-500 font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Bot username (e.g. EduGeniusGATEBot)"
                    value={newEntry.botUsername ?? ''}
                    onChange={e => setNewEntry(p => ({ ...p, botUsername: e.target.value }))}
                    className="w-full bg-surface-700/50 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-surface-500"
                  />
                  <div className="flex gap-2">
                    <button onClick={addBot} className="flex-1 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm transition-colors">Add Bot</button>
                    <button onClick={() => { setAdding(false); setNewEntry({}); }} className="px-3 py-2 rounded-lg border border-surface-600 text-surface-400 text-sm hover:bg-surface-800 transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="flex items-center gap-2 w-full py-2.5 rounded-lg border border-dashed border-surface-600 text-surface-400 hover:text-white hover:border-surface-500 text-sm transition-colors justify-center"
                >
                  <Plus className="w-4 h-4" /> Add Exam Bot
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export function TelegramBotSetup() {
  const [config, setConfig] = useState<TelegramBotConfig>(() => loadBotConfig() ?? makeNewConfig());
  const [existingWebhook, setExistingWebhook] = useState('');
  const [privacyMode, setPrivacyMode] = useState(false);

  const persist = (c: TelegramBotConfig) => {
    setConfig(c);
    saveBotConfig(c);
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleStart = () => {
    const next = advanceStep(config, 'token_entry');
    persist(next);
  };

  const handleTokenValidated = async (
    token: string,
    botInfo: { id: number; username: string; name: string },
    pm: boolean
  ) => {
    setPrivacyMode(pm);
    // Check for existing webhook
    const webhookStatus = await checkWebhookStatus(token);
    setExistingWebhook(webhookStatus.url);

    const next = advanceStep({
      ...config,
      botToken: obfuscateToken(token),
      botId: botInfo.id,
      botUsername: botInfo.username,
      botName: botInfo.name,
    }, 'token_valid');
    persist(next);
  };

  const handleContinueToWebhook = () => {
    persist(advanceStep(config, 'webhook_config'));
  };

  const handleSetWebhook = async (url: string, secret: string) => {
    const token = deobfuscateToken(config.botToken);

    // If existing webhook conflicts, delete first
    if (existingWebhook && existingWebhook !== url) {
      await deleteTelegramWebhook(token);
    }

    const result = await setTelegramWebhook(token, url, secret);
    if (!result.success) {
      persist(setError({ ...config, webhookUrl: url, webhookSecret: secret }, result.error ?? 'Webhook setup failed.'));
      return;
    }

    const next = advanceStep({
      ...config,
      webhookUrl: url,
      webhookSecret: secret,
    }, 'webhook_live');
    persist(next);
  };

  const handleSetCommands = async (commands: BotCommandSpec[]) => {
    const token = deobfuscateToken(config.botToken);
    await setBotCommands(token, commands);
    const next = advanceStep({ ...config, botCommands: commands }, 'send_test');
    persist(next);
  };

  const handleTestSent = async (chatId: string) => {
    const next = advanceStep({ ...config, testChatId: chatId }, 'live');
    persist({ ...next, isLive: true });
  };

  const handleReset = () => {
    if (!window.confirm('This will delete your bot configuration. Are you sure?')) return;
    resetSetup();
    setConfig(makeNewConfig());
    setExistingWebhook('');
  };

  const handleExamBotsUpdate = (bots: ExamBotEntry[]) => {
    persist({ ...config, examBots: bots });
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const step = config.setupStep;
  const isErrorStep = step === 'error';

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Telegram Bot Setup</h1>
          <p className="text-xs text-surface-500">
            {config.isLive
              ? `@${config.botUsername} is live`
              : 'Set up your EduGenius Telegram bot'}
          </p>
        </div>
        {config.isLive && (
          <span className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      {/* Progress Stepper */}
      {step !== 'not_started' && !isErrorStep && (
        <Card className="py-4">
          <Stepper current={step} />
        </Card>
      )}

      {/* Error state */}
      {isErrorStep && (
        <div className="space-y-4">
          <ErrorBanner
            message={config.lastError ?? 'An error occurred.'}
            fix="Check the details above, fix the issue, and try again."
          />
          <div className="flex gap-3">
            <button
              onClick={() => persist(advanceStep(config, 'webhook_config'))}
              className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Retry
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-3 rounded-xl border border-red-700/40 text-red-400 hover:bg-red-900/20 transition-colors text-sm"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {step === 'not_started' && (
            <StepWelcome onStart={handleStart} />
          )}

          {step === 'token_entry' && (
            <StepTokenEntry
              onValidate={handleTokenValidated}
              initialToken={config.botToken ? deobfuscateToken(config.botToken) : undefined}
            />
          )}

          {step === 'token_valid' && (
            <StepTokenValidated
              config={config}
              existingWebhook={existingWebhook}
              privacyMode={privacyMode}
              onContinue={handleContinueToWebhook}
              onBack={() => persist(advanceStep(config, 'token_entry'))}
            />
          )}

          {step === 'webhook_config' && (
            <StepWebhookConfig
              config={config}
              onSetWebhook={handleSetWebhook}
              onBack={() => persist(advanceStep(config, 'token_valid'))}
            />
          )}

          {(step === 'webhook_live' || step === 'setting_webhook') && (
            <StepWebhookLive
              config={config}
              onSetCommands={handleSetCommands}
              onBack={() => persist(advanceStep(config, 'webhook_config'))}
            />
          )}

          {step === 'send_test' && (
            <StepSendTest
              config={config}
              onTestSent={handleTestSent}
              onBack={() => persist(advanceStep(config, 'webhook_live'))}
            />
          )}

          {(step === 'live' || step === 'paused') && (
            <StepLive config={config} onReset={handleReset} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Health Monitor — always visible when live */}
      {config.isLive && (
        <HealthMonitor config={config} />
      )}

      {/* Exam-scoped bots */}
      {config.isLive && (
        <ExamBotsSection examBots={config.examBots} onUpdate={handleExamBotsUpdate} />
      )}

      {/* Troubleshooting — always visible */}
      <TroubleshootingSection />
    </div>
  );
}

export default TelegramBotSetup;
