/**
 * SystemStatus — Deployment Health & Configuration Overview
 *
 * Shows at a glance:
 * - Which environment variables / API keys are configured
 * - Which features are live vs. running on mock data
 * - Go-live checklist for Giri
 * - Build info
 *
 * Accessible at /status (CEO + Admin only)
 */

import { useState, useEffect } from 'react';
import {
  CheckCircle2, XCircle, AlertCircle, Clock, Zap, Server,
  Brain, Database, Mail, CreditCard, Globe, Shield, BarChart3,
  RefreshCw, Copy, Check,
} from 'lucide-react';
import { clsx } from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = 'live' | 'mock' | 'missing' | 'optional';

interface ServiceCheck {
  id: string;
  name: string;
  description: string;
  status: Status;
  detail?: string;
  envVar?: string;
  docsLink?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

interface CheckCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  checks: ServiceCheck[];
}

// ─── Env Detector ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
const env = (import.meta as any).env ?? {};

function hasKey(key: string): boolean {
  const val = env[key];
  return typeof val === 'string' && val.length > 10;
}

function envStatus(key: string, isOptional = false): Status {
  if (hasKey(key)) return 'live';
  return isOptional ? 'optional' : 'missing';
}

// ─── Check Builder ────────────────────────────────────────────────────────────

function buildChecks(): CheckCategory[] {
  return [
    {
      id: 'ai',
      label: 'AI / LLM',
      icon: Brain,
      checks: [
        {
          id: 'gemini',
          name: 'Gemini API',
          description: 'Primary AI provider — powers all tutoring, content generation, and agent reasoning',
          status: envStatus('VITE_GEMINI_API_KEY'),
          envVar: 'VITE_GEMINI_API_KEY',
          detail: hasKey('VITE_GEMINI_API_KEY')
            ? 'Connected — Gemini 2.0 Flash active'
            : 'Not set — all AI responses are mock data',
          docsLink: 'https://aistudio.google.com/app/apikey',
          priority: 'critical',
        },
        {
          id: 'anthropic',
          name: 'Anthropic (Claude)',
          description: 'Fallback AI provider for complex reasoning tasks',
          status: envStatus('VITE_ANTHROPIC_API_KEY', true),
          envVar: 'VITE_ANTHROPIC_API_KEY',
          detail: hasKey('VITE_ANTHROPIC_API_KEY')
            ? 'Connected — Claude Sonnet available as fallback'
            : 'Optional — Gemini is the primary provider',
          priority: 'low',
        },
        {
          id: 'openai',
          name: 'OpenAI',
          description: 'Third-party AI fallback',
          status: envStatus('VITE_OPENAI_API_KEY', true),
          envVar: 'VITE_OPENAI_API_KEY',
          detail: hasKey('VITE_OPENAI_API_KEY') ? 'Connected' : 'Optional',
          priority: 'low',
        },
      ],
    },
    {
      id: 'backend',
      label: 'Backend / API',
      icon: Server,
      checks: [
        {
          id: 'api',
          name: 'Backend API',
          description: 'Self-hosted Node.js backend for multi-agent orchestration',
          status: envStatus('VITE_API_BASE_URL', true),
          envVar: 'VITE_API_BASE_URL',
          detail: hasKey('VITE_API_BASE_URL')
            ? `Connected — ${env.VITE_API_BASE_URL}`
            : 'Not set — direct LLM calls only (no server-side agents)',
          priority: 'high',
        },
        {
          id: 'wolfram',
          name: 'Wolfram Alpha API',
          description: 'Mathematical computation and verification',
          status: envStatus('VITE_WOLFRAM_APP_ID', true),
          envVar: 'VITE_WOLFRAM_APP_ID',
          detail: hasKey('VITE_WOLFRAM_APP_ID') ? 'Connected' : 'Optional — math answers will use LLM only',
          priority: 'medium',
        },
      ],
    },
    {
      id: 'data',
      label: 'Database / Storage',
      icon: Database,
      checks: [
        {
          id: 'supabase',
          name: 'Supabase',
          description: 'User auth, database, and real-time subscriptions',
          status: envStatus('VITE_SUPABASE_URL'),
          envVar: 'VITE_SUPABASE_URL',
          detail: hasKey('VITE_SUPABASE_URL') ? 'Connected' : 'Not set — user data is not persisted',
          docsLink: 'https://supabase.com',
          priority: 'critical',
        },
        {
          id: 'pinecone',
          name: 'Pinecone / Qdrant',
          description: 'Vector database for semantic search and knowledge graphs',
          status: envStatus('VITE_PINECONE_API_KEY', true),
          envVar: 'VITE_PINECONE_API_KEY',
          detail: hasKey('VITE_PINECONE_API_KEY') ? 'Connected' : 'Optional — enables semantic search',
          priority: 'medium',
        },
      ],
    },
    {
      id: 'payments',
      label: 'Payments',
      icon: CreditCard,
      checks: [
        {
          id: 'razorpay',
          name: 'Razorpay',
          description: 'Primary payment gateway (India)',
          status: envStatus('VITE_RAZORPAY_KEY_ID'),
          envVar: 'VITE_RAZORPAY_KEY_ID',
          detail: hasKey('VITE_RAZORPAY_KEY_ID') ? 'Connected — live payments active' : 'Not set — subscriptions unavailable',
          docsLink: 'https://dashboard.razorpay.com/app/keys',
          priority: 'critical',
        },
        {
          id: 'stripe',
          name: 'Stripe',
          description: 'International payment gateway',
          status: envStatus('VITE_STRIPE_PUBLISHABLE_KEY', true),
          envVar: 'VITE_STRIPE_PUBLISHABLE_KEY',
          detail: hasKey('VITE_STRIPE_PUBLISHABLE_KEY') ? 'Connected' : 'Optional — for international users',
          priority: 'low',
        },
      ],
    },
    {
      id: 'comms',
      label: 'Communication',
      icon: Mail,
      checks: [
        {
          id: 'sendgrid',
          name: 'SendGrid / Resend',
          description: 'Transactional email (OTP, welcome, progress reports)',
          status: envStatus('VITE_SENDGRID_API_KEY', true),
          envVar: 'VITE_SENDGRID_API_KEY',
          detail: hasKey('VITE_SENDGRID_API_KEY') ? 'Connected' : 'Not set — email delivery unavailable',
          priority: 'high',
        },
        {
          id: 'whatsapp',
          name: 'WhatsApp Business',
          description: 'Student engagement via WhatsApp',
          status: envStatus('VITE_WHATSAPP_TOKEN', true),
          envVar: 'VITE_WHATSAPP_TOKEN',
          detail: hasKey('VITE_WHATSAPP_TOKEN') ? 'Connected' : 'Optional — enables WhatsApp channel',
          priority: 'medium',
        },
        {
          id: 'telegram',
          name: 'Telegram Bot',
          description: 'Student engagement via Telegram',
          status: envStatus('VITE_TELEGRAM_BOT_TOKEN', true),
          envVar: 'VITE_TELEGRAM_BOT_TOKEN',
          detail: hasKey('VITE_TELEGRAM_BOT_TOKEN') ? 'Connected' : 'Optional — enables Telegram channel',
          priority: 'medium',
        },
      ],
    },
    {
      id: 'analytics_tracking',
      label: 'Analytics',
      icon: BarChart3,
      checks: [
        {
          id: 'ga4',
          name: 'Google Analytics 4',
          description: 'User behaviour and conversion tracking',
          status: envStatus('VITE_GA4_MEASUREMENT_ID', true),
          envVar: 'VITE_GA4_MEASUREMENT_ID',
          detail: hasKey('VITE_GA4_MEASUREMENT_ID') ? 'Connected' : 'Not set — no web analytics',
          priority: 'high',
        },
        {
          id: 'mixpanel',
          name: 'Mixpanel',
          description: 'Product analytics and user journeys',
          status: envStatus('VITE_MIXPANEL_TOKEN', true),
          envVar: 'VITE_MIXPANEL_TOKEN',
          detail: hasKey('VITE_MIXPANEL_TOKEN') ? 'Connected' : 'Optional',
          priority: 'low',
        },
      ],
    },
    {
      id: 'security',
      label: 'Security / Auth',
      icon: Shield,
      checks: [
        {
          id: 'google_oauth',
          name: 'Google OAuth',
          description: 'Sign in with Google',
          status: envStatus('VITE_GOOGLE_CLIENT_ID'),
          envVar: 'VITE_GOOGLE_CLIENT_ID',
          detail: hasKey('VITE_GOOGLE_CLIENT_ID') ? 'Connected' : 'Not set — Google sign-in unavailable',
          docsLink: 'https://console.cloud.google.com/apis/credentials',
          priority: 'high',
        },
        {
          id: 'turnstile',
          name: 'Cloudflare Turnstile',
          description: 'Bot protection on auth forms',
          status: envStatus('VITE_CF_TURNSTILE_SITE_KEY', true),
          envVar: 'VITE_CF_TURNSTILE_SITE_KEY',
          detail: hasKey('VITE_CF_TURNSTILE_SITE_KEY') ? 'Active' : 'Optional — recommended for production',
          priority: 'medium',
        },
      ],
    },
    {
      id: 'hosting',
      label: 'Hosting / CDN',
      icon: Globe,
      checks: [
        {
          id: 'netlify',
          name: 'Netlify Deploy',
          description: 'Frontend hosting and CDN',
          status: env.VITE_NETLIFY_CONTEXT ? 'live' : 'mock',
          detail: env.VITE_NETLIFY_CONTEXT
            ? `Context: ${env.VITE_NETLIFY_CONTEXT}`
            : 'Running locally / manual deploy',
          priority: 'critical',
        },
        {
          id: 'domain',
          name: 'Custom Domain',
          description: 'Production domain (edugenius.in or similar)',
          status: (env.VITE_APP_URL && !env.VITE_APP_URL?.includes('localhost') && !env.VITE_APP_URL?.includes('netlify.app'))
            ? 'live'
            : 'missing',
          envVar: 'VITE_APP_URL',
          detail: env.VITE_APP_URL ?? 'Not configured',
          priority: 'high',
        },
      ],
    },
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Status }) {
  const cfg = {
    live:     { icon: CheckCircle2, label: 'Live',     className: 'text-green-400 bg-green-400/10' },
    mock:     { icon: AlertCircle,  label: 'Mock',     className: 'text-yellow-400 bg-yellow-400/10' },
    missing:  { icon: XCircle,      label: 'Missing',  className: 'text-red-400 bg-red-400/10' },
    optional: { icon: Clock,        label: 'Optional', className: 'text-blue-400 bg-blue-400/10' },
  }[status];

  const Icon = cfg.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', cfg.className)}>
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}

function PriorityDot({ priority }: { priority: ServiceCheck['priority'] }) {
  const colors = {
    critical: 'bg-red-500',
    high: 'bg-orange-400',
    medium: 'bg-yellow-400',
    low: 'bg-gray-400',
  };
  return (
    <span
      title={`Priority: ${priority}`}
      className={clsx('inline-block w-2 h-2 rounded-full flex-shrink-0 mt-1', colors[priority])}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SystemStatus() {
  const [categories, setCategories] = useState<CheckCategory[]>([]);
  const [copiedEnv, setCopiedEnv] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setCategories(buildChecks());
  }, [refreshKey]);

  const allChecks = categories.flatMap(c => c.checks);
  const liveCount    = allChecks.filter(c => c.status === 'live').length;
  const missingCount = allChecks.filter(c => c.status === 'missing').length;
  const mockCount    = allChecks.filter(c => c.status === 'mock').length;
  const criticalMissing = allChecks.filter(c => c.status === 'missing' && c.priority === 'critical');

  const overallHealth = missingCount === 0 ? 'production-ready'
    : criticalMissing.length > 0 ? 'needs-config'
    : 'partial';

  const healthConfig = {
    'production-ready': { label: 'Production Ready ✅', className: 'text-green-400' },
    'partial':          { label: 'Partially Configured ⚠️', className: 'text-yellow-400' },
    'needs-config':     { label: 'Needs Configuration 🔧', className: 'text-red-400' },
  }[overallHealth];

  function copyEnvVar(key: string) {
    navigator.clipboard.writeText(key).catch(() => {});
    setCopiedEnv(key);
    setTimeout(() => setCopiedEnv(null), 1500);
  }

  // ── Build .env snippet for missing critical/high ──────────────────────────
  const missingForEnv = allChecks.filter(
    c => (c.status === 'missing') && c.envVar && (c.priority === 'critical' || c.priority === 'high')
  );
  const envSnippet = missingForEnv.map(c => `${c.envVar}=YOUR_KEY_HERE`).join('\n');

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Zap size={14} /> System Status
            </div>
            <h1 className="text-3xl font-bold text-white">Deployment Health</h1>
            <p className="text-gray-400 mt-1">
              Live view of which services are configured vs. running on mock data.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={clsx('text-lg font-semibold', healthConfig.className)}>
              {healthConfig.label}
            </span>
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Live', value: liveCount, color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20' },
            { label: 'Mock / Local', value: mockCount, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
            { label: 'Missing', value: missingCount, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={clsx('rounded-xl border p-4 text-center', bg)}>
              <div className={clsx('text-3xl font-bold', color)}>{value}</div>
              <div className="text-sm text-gray-400 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Critical actions */}
        {criticalMissing.length > 0 && (
          <div className="mb-8 rounded-xl border border-red-500/30 bg-red-500/5 p-5">
            <h2 className="text-red-400 font-semibold mb-3 flex items-center gap-2">
              <XCircle size={16} /> Critical — Platform cannot launch without these
            </h2>
            <ul className="space-y-2">
              {criticalMissing.map(c => (
                <li key={c.id} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-red-400 mt-0.5">→</span>
                  <span>
                    <strong className="text-white">{c.name}</strong>
                    {c.envVar && (
                      <code className="ml-2 text-xs bg-gray-800 px-1.5 py-0.5 rounded text-yellow-300">
                        {c.envVar}
                      </code>
                    )}
                    {c.docsLink && (
                      <a
                        href={c.docsLink}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 text-blue-400 hover:text-blue-300 underline"
                      >
                        Get key →
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            {envSnippet && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Add to Netlify Environment Variables:</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(envSnippet).catch(() => {}); setCopiedEnv('snippet'); setTimeout(() => setCopiedEnv(null), 1500); }}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    {copiedEnv === 'snippet' ? <><Check size={12} className="text-green-400" /> Copied!</> : <><Copy size={12} /> Copy all</>}
                  </button>
                </div>
                <pre className="bg-gray-900 rounded-lg p-3 text-xs text-green-300 overflow-x-auto">{envSnippet}</pre>
              </div>
            )}
          </div>
        )}

        {/* Category checks */}
        <div className="space-y-6">
          {categories.map(category => {
            const Icon = category.icon;
            const catLive    = category.checks.filter(c => c.status === 'live').length;
            const catTotal   = category.checks.length;

            return (
              <div key={category.id} className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
                {/* Category header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-800/50">
                  <div className="flex items-center gap-2 text-gray-200 font-medium">
                    <Icon size={16} className="text-blue-400" />
                    {category.label}
                  </div>
                  <span className="text-xs text-gray-400">
                    {catLive}/{catTotal} live
                  </span>
                </div>

                {/* Checks */}
                <div className="divide-y divide-gray-800/50">
                  {category.checks.map(check => (
                    <div key={check.id} className="px-5 py-3 flex items-start gap-3">
                      <PriorityDot priority={check.priority} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-0.5">
                          <span className="text-sm font-medium text-white">{check.name}</span>
                          <StatusBadge status={check.status} />
                          {check.envVar && (
                            <button
                              onClick={() => copyEnvVar(check.envVar!)}
                              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                              title="Copy env var name"
                            >
                              <code className="bg-gray-800 px-1 rounded">{check.envVar}</code>
                              {copiedEnv === check.envVar
                                ? <Check size={10} className="text-green-400" />
                                : <Copy size={10} />}
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{check.description}</p>
                        {check.detail && (
                          <p className={clsx(
                            'text-xs mt-1',
                            check.status === 'live' ? 'text-green-400' :
                            check.status === 'missing' ? 'text-red-400' :
                            'text-yellow-400'
                          )}>
                            {check.detail}
                          </p>
                        )}
                      </div>
                      {check.docsLink && (
                        <a
                          href={check.docsLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap shrink-0"
                        >
                          Get key →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Build info footer */}
        <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900 p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Build Info</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { label: 'App Version',  value: env.VITE_APP_VERSION ?? '1.0.0' },
              { label: 'Environment',  value: env.VITE_APP_ENV ?? (env.DEV ? 'development' : 'production') },
              { label: 'API Base URL', value: env.VITE_API_BASE_URL ?? '(direct LLM calls)' },
              { label: 'App URL',      value: env.VITE_APP_URL ?? window.location.origin },
              { label: 'Netlify',      value: env.VITE_NETLIFY_CONTEXT ?? 'not detected' },
              { label: 'Build Date',   value: env.VITE_BUILD_DATE ?? new Date().toLocaleDateString() },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-2">
                <span className="text-gray-500 w-28 shrink-0">{label}:</span>
                <span className="text-gray-300 break-all">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          This page is only visible to CEO and Admin roles. Environment variables are read at build time.
        </p>
      </div>
    </div>
  );
}

export default SystemStatus;
