/**
 * ConnectionRegistry.tsx — Central API / MCP Connection Hub
 *
 * ✅ Mandatory vs Optional         ✅ Purpose + Fallback + Impacted Agents/Sub-agents
 * ✅ MCP endpoint support          ✅ Bidirectional localStorage sync
 * ✅ All roles can read; CEO/Admin can configure
 * ✅ Category filter, search, status summary
 * ✅ Entering a key here → saved to localStorage → read by llmService / runtime
 *
 * ── PER-EXAM INSTANCE SUPPORT ──
 * Connections marked `examScoped: true` can have one configuration per examination.
 * Env var naming convention:  BASE_VAR_JEE, BASE_VAR_NEET, BASE_VAR_CAT, etc.
 * Example: PINECONE_INDEX_JEE, TELEGRAM_BOT_TOKEN_NEET, GA4_MEASUREMENT_ID_CAT
 * ExamInstancePanel shows all per-exam vars in a single master view.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search, ChevronDown, ChevronRight, ExternalLink,
  CheckCircle2, XCircle, AlertTriangle, Clock,
  Eye, EyeOff, Copy, X, Info, Network, Bot, Shield,
  Layers, GraduationCap, Plus, Trash2, User, Zap,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import {
  loadSources as krLoadSources,
  registerSource as krRegisterSource,
  removeSource as krRemoveSource,
  toggleSource as krToggleSource,
  getQueryLogStats,
  type KnowledgeSourceConfig,
} from '@/services/knowledgeRouter';
import {
  getIndexingJobStatus,
  runProgressiveIndexing,
} from '@/services/ragIndexer';
import { loadCurrentUser } from '@/services/userService';

// ─── Exam types ───────────────────────────────────────────────────────────────

export const EXAM_TYPES = ['JEE', 'NEET', 'CBSE', 'CAT', 'UPSC', 'GATE', 'ICSE'] as const;
export type ExamType = typeof EXAM_TYPES[number];

const EXAM_META: Record<ExamType, { label: string; emoji: string; color: string }> = {
  JEE:   { label: 'JEE Main & Advanced',  emoji: '⚛️',  color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  NEET:  { label: 'NEET-UG',              emoji: '🧬',  color: 'bg-green-500/10 text-green-400 border-green-500/30' },
  CBSE:  { label: 'CBSE 10 & 12',         emoji: '📖',  color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  CAT:   { label: 'CAT (MBA)',             emoji: '💼',  color: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  UPSC:  { label: 'UPSC Civil Services',  emoji: '🏛️',  color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  GATE:  { label: 'GATE Engineering',     emoji: '⚙️',  color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
  ICSE:  { label: 'ICSE Board',           emoji: '📚',  color: 'bg-pink-500/10 text-pink-400 border-pink-500/30' },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnStatus       = 'active' | 'inactive' | 'error' | 'pending';
type ConnType         = 'api' | 'mcp' | 'webhook' | 'oauth' | 'database';
type ImpactLevel      = 'critical' | 'high' | 'medium' | 'low';
type ConnectionScope  = 'platform' | 'exam' | 'user';
type AuthType         = 'api_key' | 'bearer_token' | 'basic_auth' | 'none';

interface ConnField {
  key: string; label: string;
  type: 'text' | 'password' | 'url' | 'select';
  placeholder?: string; required: boolean; hint?: string;
  options?: { value: string; label: string }[];
  /** If true, this field gets per-exam instances: KEY_JEE, KEY_NEET, etc. */
  examScoped?: boolean;
}
interface ImpactedAgent {
  id: string; name: string; emoji: string;
  subAgents: string[]; impact: ImpactLevel;
}
interface Connection {
  id: string; name: string; type: ConnType; category: string;
  mandatory: boolean; status: ConnStatus;
  purpose: string; fallback: string;
  /** 3-tier scope: platform (CEO), exam (per-exam CEO), user (individual) */
  scope: ConnectionScope;
  /** If true, the whole connection can be configured per-exam */
  examScoped?: boolean;
  impactedAgents: ImpactedAgent[];
  fields: ConnField[];
  docsUrl?: string; mcpEndpoint?: string; tags: string[];
  /** True if this was dynamically added (not in static REGISTRY) */
  isCustom?: boolean;
  /** For custom connections: auth type */
  authType?: AuthType;
  /** Endpoint URL for testing */
  endpoint?: string;
}

// ─── Custom Connection Form State ─────────────────────────────────────────────

interface CustomConnForm {
  name: string;
  type: ConnType;
  scope: 'platform' | 'user';
  category: string;
  endpoint: string;
  authType: AuthType;
  apiKeyLabel: string;
  storageKey: string;
  purpose: string;
  fallback: string;
  assignedAgents: string[];
}

const ALL_AGENTS = [
  { id: 'scout',  name: 'Scout',  emoji: '🔍' },
  { id: 'atlas',  name: 'Atlas',  emoji: '📚' },
  { id: 'sage',   name: 'Sage',   emoji: '🧠' },
  { id: 'mentor', name: 'Mentor', emoji: '🎯' },
  { id: 'herald', name: 'Herald', emoji: '📣' },
  { id: 'forge',  name: 'Forge',  emoji: '⚙️' },
  { id: 'oracle', name: 'Oracle', emoji: '📊' },
];

// ─── Static Registry ──────────────────────────────────────────────────────────

const REGISTRY: Connection[] = [

  /* ══════════════════════════════════════════════════════════════════════════ */
  /* AI Providers                                                               */
  /* ══════════════════════════════════════════════════════════════════════════ */
  {
    id:'gemini', name:'Google Gemini', type:'api', category:'AI Providers', mandatory:true, status:'inactive', scope:'platform',
    purpose:'Primary LLM for all tutoring, content generation, exam insights, and agent reasoning. ~80% of AI calls. One shared key across all exams.',
    fallback:'Chain: Anthropic → OpenAI → Groq → Ollama. If all absent → demo mock mode.',
    tags:['llm','core'],
    impactedAgents:[
      {id:'sage',   name:'Sage',   emoji:'🧠', impact:'critical', subAgents:['Socratic Tutor','Doubt Resolver','Concept Explainer','Step Validator','EmotionReader']},
      {id:'atlas',  name:'Atlas',  emoji:'📚', impact:'critical', subAgents:['Content Writer','Question Generator','Translator','Quality Checker']},
      {id:'mentor', name:'Mentor', emoji:'🎯', impact:'high',     subAgents:['Study Planner','Motivation Coach','Progress Reporter']},
      {id:'herald', name:'Herald', emoji:'📣', impact:'high',     subAgents:['Blog Writer','Social Media Manager','Newsletter Manager']},
      {id:'scout',  name:'Scout',  emoji:'🔍', impact:'medium',   subAgents:['Market Analyst','Competitor Watcher','Opportunity Finder']},
      {id:'oracle', name:'Oracle', emoji:'📊', impact:'medium',   subAgents:['Analytics Engine','Daily Brief Generator']},
    ],
    fields:[
      {key:'VITE_GEMINI_API_KEY', label:'Gemini API Key', type:'password', placeholder:'AIza...', required:true, hint:'aistudio.google.com → Get API key (free tier available)'},
    ],
    docsUrl:'https://aistudio.google.com/',
  },
  {
    id:'anthropic', name:'Anthropic Claude', type:'api', category:'AI Providers', mandatory:false, status:'inactive', scope:'platform',
    purpose:'High-quality LLM fallback for complex reasoning, multi-step proofs, and code-heavy tasks. Same key used across all exams.',
    fallback:'Falls back to Gemini 1.5 Pro. Quality difference noticeable for hardest JEE/GATE problems.',
    tags:['llm'],
    impactedAgents:[
      {id:'sage',  name:'Sage',  emoji:'🧠', impact:'high',   subAgents:['Hard Problem Solver','Step Explainer']},
      {id:'forge', name:'Forge', emoji:'⚙️', impact:'medium', subAgents:['Code Reviewer']},
    ],
    fields:[
      {key:'VITE_ANTHROPIC_API_KEY', label:'API Key', type:'password', placeholder:'sk-ant-...', required:true, hint:'console.anthropic.com'},
    ],
    docsUrl:'https://console.anthropic.com/',
  },
  {
    id:'learnlm', name:'Google LearnLM', type:'api', category:'AI Providers', mandatory:false, status:'inactive', scope:'platform',
    purpose:'Pedagogically-optimized model for Socratic tutoring — calibrates explanations to student level, prefers guiding questions over direct answers.',
    fallback:'Gemini 1.5 Pro with custom pedagogy system prompt. ~85% behaviour preserved.',
    tags:['llm','education'],
    impactedAgents:[
      {id:'sage', name:'Sage', emoji:'🧠', impact:'high', subAgents:['Socratic Tutor','Concept Explainer','Doubt Resolver']},
    ],
    fields:[
      {key:'LEARNLM_API_KEY', label:'API Key (same as Gemini)', type:'password', placeholder:'AIza...', required:true, hint:'LearnLM uses Gemini API auth — same key as Gemini'},
    ],
    docsUrl:'https://ai.google.dev/gemini-api/docs/learnlm',
  },
  {
    id:'groq', name:'Groq', type:'api', category:'AI Providers', mandatory:false, status:'inactive', scope:'platform',
    purpose:'Ultra-fast inference (Llama 3, Mixtral). Latency-sensitive features: live typing hints, real-time suggestions.',
    fallback:'Gemini Flash. Live-feature latency increases ~200-400ms.',
    tags:['llm','fast'],
    impactedAgents:[
      {id:'sage',   name:'Sage',   emoji:'🧠', impact:'medium', subAgents:['Real-Time Hint Generator']},
      {id:'mentor', name:'Mentor', emoji:'🎯', impact:'low',    subAgents:[]},
    ],
    fields:[
      {key:'GROQ_API_KEY', label:'API Key', type:'password', placeholder:'gsk_...', required:true, hint:'console.groq.com — generous free tier'},
    ],
    docsUrl:'https://console.groq.com/',
  },
  {
    id:'openai', name:'OpenAI GPT', type:'api', category:'AI Providers', mandatory:false, status:'inactive', scope:'platform',
    purpose:'Tertiary LLM + embeddings (text-embedding-3-small) when Pinecone is active.',
    fallback:'Embeddings → local sentence-transformers. Chat → Gemini.',
    tags:['llm','embeddings'],
    impactedAgents:[
      {id:'atlas',  name:'Atlas',  emoji:'📚', impact:'medium', subAgents:['Curriculum Mapper','Quality Checker']},
      {id:'oracle', name:'Oracle', emoji:'📊', impact:'low',    subAgents:['Insight Generator']},
    ],
    fields:[
      {key:'VITE_OPENAI_API_KEY', label:'API Key', type:'password', placeholder:'sk-...', required:true, hint:'platform.openai.com'},
    ],
    docsUrl:'https://platform.openai.com/',
  },

  /* ══════════════════════════════════════════════════════════════════════════ */
  /* Content Verification                                                       */
  /* ══════════════════════════════════════════════════════════════════════════ */
  {
    id:'wolfram', name:'Wolfram Alpha', type:'api', category:'Content Verification', mandatory:false, status:'inactive', scope:'exam',
    examScoped: true,
    purpose:'Ground-truth math/science verification. Cross-checks LLM solutions before showing to students. Critical for JEE/NEET/GATE accuracy. One App ID per exam isolates query quotas.',
    fallback:'SymPy → LLM consensus. Accuracy drops ~15% on complex integrals/DEs.',
    tags:['verification','math'],
    impactedAgents:[
      {id:'sage',  name:'Sage',  emoji:'🧠', impact:'high',   subAgents:['Answer Verifier','Step Validator','Hard Problem Solver']},
      {id:'atlas', name:'Atlas', emoji:'📚', impact:'medium', subAgents:['Quality Checker','Question Generator']},
    ],
    fields:[
      {key:'WOLFRAM_APP_ID', label:'App ID', type:'password', placeholder:'XXXXX-XXXXXXXXXX', required:true, hint:'developer.wolframalpha.com → My Apps → Get an App ID', examScoped:true},
    ],
    docsUrl:'https://developer.wolframalpha.com/',
  },
  {
    id:'sympy', name:'SymPy Cloud', type:'api', category:'Content Verification', mandatory:false, status:'inactive', scope:'platform',
    purpose:'Symbolic math engine. Verifies algebra, calculus, equations when Wolfram unavailable.',
    fallback:'LLM consensus verification only.',
    tags:['verification','math'],
    impactedAgents:[
      {id:'sage', name:'Sage', emoji:'🧠', impact:'medium', subAgents:['Answer Verifier','Step Validator']},
    ],
    fields:[
      {key:'SYMPY_API_URL', label:'SymPy API URL', type:'url', placeholder:'http://localhost:8200/sympy', required:true},
    ],
  },

  /* ══════════════════════════════════════════════════════════════════════════ */
  /* Database                                                                   */
  /* ══════════════════════════════════════════════════════════════════════════ */
  {
    id:'postgres', name:'PostgreSQL', type:'database', category:'Database', mandatory:true, status:'inactive', scope:'platform',
    purpose:'Primary relational database. Stores users, progress, subscriptions, exam configs, teacher data, audit logs. Shared across all exams — partitioned by exam_type column.',
    fallback:'No fallback. Required for user auth and persistence.',
    tags:['database','core'],
    impactedAgents:[
      {id:'forge',  name:'Forge',  emoji:'⚙️', impact:'critical', subAgents:['DB Migrator','Backup Manager']},
      {id:'oracle', name:'Oracle', emoji:'📊', impact:'critical', subAgents:['Analytics Engine','Report Builder']},
      {id:'sage',   name:'Sage',   emoji:'🧠', impact:'critical', subAgents:['Progress Tracker','History Manager']},
      {id:'mentor', name:'Mentor', emoji:'🎯', impact:'high',     subAgents:['Study Planner']},
      {id:'herald', name:'Herald', emoji:'📣', impact:'high',     subAgents:['Subscription Manager']},
    ],
    fields:[
      {key:'DATABASE_URL', label:'Connection String', type:'password', placeholder:'postgresql://user:pass@host:5432/edugenius', required:true, hint:'Format: postgresql://USER:PASS@HOST:PORT/DB'},
    ],
    docsUrl:'https://www.postgresql.org/',
  },
  {
    id:'supabase', name:'Supabase', type:'database', category:'Database', mandatory:false, status:'inactive', scope:'platform',
    purpose:'Managed Postgres + Auth + Realtime. Recommended hosted option for faster MVP deployment.',
    fallback:'Self-hosted PostgreSQL + custom auth.',
    tags:['database','auth','realtime'],
    impactedAgents:[
      {id:'forge',  name:'Forge',  emoji:'⚙️', impact:'high',   subAgents:['DB Migrator']},
      {id:'oracle', name:'Oracle', emoji:'📊', impact:'high',   subAgents:['Analytics Engine']},
      {id:'mentor', name:'Mentor', emoji:'🎯', impact:'medium', subAgents:['Progress Reporter']},
    ],
    fields:[
      {key:'VITE_SUPABASE_URL',      label:'Project URL',  type:'url',      placeholder:'https://xxx.supabase.co', required:true,  hint:'supabase.com → Project Settings → API'},
      {key:'VITE_SUPABASE_ANON_KEY', label:'Anon Key',     type:'password', placeholder:'eyJh...',                required:true},
      {key:'SUPABASE_SERVICE_KEY',   label:'Service Key',  type:'password', placeholder:'eyJh...',                required:false, hint:'Backend only — never expose to frontend'},
    ],
    docsUrl:'https://supabase.com/',
  },
  {
    id:'redis', name:'Redis', type:'database', category:'Database', mandatory:false, status:'inactive', scope:'platform',
    purpose:'Session cache, rate limiting, job queues (BullMQ), real-time leaderboards. Optional but improves performance at scale.',
    fallback:'In-process cache (lost on restart). Rate limiting disabled.',
    tags:['cache','queue'],
    impactedAgents:[
      {id:'forge',  name:'Forge',  emoji:'⚙️', impact:'medium', subAgents:['Queue Manager','Rate Limiter']},
      {id:'sage',   name:'Sage',   emoji:'🧠', impact:'low',    subAgents:[]},
      {id:'oracle', name:'Oracle', emoji:'📊', impact:'low',    subAgents:[]},
    ],
    fields:[
      {key:'REDIS_URL', label:'Redis URL', type:'password', placeholder:'redis://localhost:6379', required:true, hint:'redis://[:password@]host:port[/db]'},
    ],
    docsUrl:'https://redis.io/',
  },

  /* ══════════════════════════════════════════════════════════════════════════ */
  /* Authentication                                                             */
  /* ══════════════════════════════════════════════════════════════════════════ */
  {
    id:'jwt', name:'JWT Secret', type:'api', category:'Authentication', mandatory:true, status:'inactive', scope:'platform',
    purpose:'Signing & verifying user session tokens. Required for all authenticated API calls.',
    fallback:'No fallback. Without this, user sessions cannot be verified.',
    tags:['auth','security','core'],
    impactedAgents:[
      {id:'forge', name:'Forge', emoji:'⚙️', impact:'critical', subAgents:['Auth Guard','Session Manager','Token Refresher']},
    ],
    fields:[
      {key:'JWT_SECRET', label:'JWT Secret (min 32 chars)', type:'password', placeholder:'at-least-32-random-chars', required:true, hint:'Use: openssl rand -base64 32'},
    ],
  },
  {
    id:'google-oauth', name:'Google OAuth 2.0', type:'oauth', category:'Authentication', mandatory:false, status:'inactive', scope:'platform',
    purpose:'One-click Google Sign-In for students/teachers. Also enables Google Meet scheduling and Google Calendar integration for live session booking.',
    fallback:'Email/password + OTP only. No calendar or Meet integration.',
    tags:['auth','oauth','meet'],
    impactedAgents:[
      {id:'mentor', name:'Mentor', emoji:'🎯', impact:'medium', subAgents:['Calendar Sync','Meet Session Manager']},
      {id:'forge',  name:'Forge',  emoji:'⚙️', impact:'medium', subAgents:['OAuth Handler']},
    ],
    fields:[
      {key:'VITE_GOOGLE_CLIENT_ID',     label:'Client ID',     type:'text',     placeholder:'xxxxx.apps.googleusercontent.com', required:true,  hint:'console.cloud.google.com → OAuth 2.0 Credentials'},
      {key:'GOOGLE_CLIENT_SECRET',      label:'Client Secret', type:'password', placeholder:'GOCSPX-...',                       required:true},
      {key:'GOOGLE_REDIRECT_URI',       label:'Redirect URI',  type:'url',      placeholder:'https://yourdomain.com/auth/callback', required:true},
    ],
    docsUrl:'https://console.cloud.google.com/',
  },

  /* ══════════════════════════════════════════════════════════════════════════ */
  /* Payments                                                                   */
  /* ══════════════════════════════════════════════════════════════════════════ */
  {
    id:'razorpay', name:'Razorpay', type:'api', category:'Payments', mandatory:false, status:'inactive', scope:'exam',
    examScoped: true,
    purpose:'Primary payment gateway (India). Handles subscription plans, chatbot add-ons, one-time purchases. Exam-scoped plan IDs allow different pricing per exam (e.g., JEE Premium ≠ CAT Premium).',
    fallback:'Stripe (international). Manual payment collection via bank transfer for India users.',
    tags:['payments','india','subscriptions'],
    impactedAgents:[
      {id:'herald', name:'Herald', emoji:'📣', impact:'high',   subAgents:['Subscription Manager','Revenue Tracker','Churn Predictor']},
      {id:'oracle', name:'Oracle', emoji:'📊', impact:'medium', subAgents:['Revenue Analytics','MRR Calculator']},
      {id:'scout',  name:'Scout',  emoji:'🔍', impact:'low',    subAgents:['Pricing Optimizer']},
    ],
    fields:[
      {key:'RAZORPAY_KEY_ID',              label:'Key ID (Live)',           type:'text',     placeholder:'rzp_live_...',  required:true,  hint:'dashboard.razorpay.com → Settings → API Keys'},
      {key:'RAZORPAY_KEY_SECRET',          label:'Key Secret',             type:'password', placeholder:'',              required:true},
      {key:'RAZORPAY_WEBHOOK_SECRET',      label:'Webhook Secret',         type:'password', placeholder:'',              required:true,  hint:'Set when creating webhook in Razorpay dashboard'},
      {key:'VITE_RAZORPAY_KEY_ID',         label:'Key ID (Frontend)',       type:'text',     placeholder:'rzp_live_...',  required:true,  hint:'Same as Key ID — exposed to browser for Razorpay.js'},
      {key:'RAZORPAY_PLAN_PRO',            label:'Pro Plan ID',            type:'text',     placeholder:'plan_...',      required:false, hint:'Create plan in Razorpay dashboard', examScoped:true},
      {key:'RAZORPAY_PLAN_PREMIUM',        label:'Premium Plan ID',        type:'text',     placeholder:'plan_...',      required:false, examScoped:true},
      {key:'RAZORPAY_PLAN_ELITE',          label:'Elite Plan ID',          type:'text',     placeholder:'plan_...',      required:false, examScoped:true},
      {key:'RAZORPAY_PLAN_WHATSAPP',       label:'WhatsApp Add-on Plan ID',type:'text',     placeholder:'plan_...',      required:false},
      {key:'RAZORPAY_PLAN_TELEGRAM',       label:'Telegram Add-on Plan ID',type:'text',     placeholder:'plan_...',      required:false},
      {key:'RAZORPAY_PLAN_BUNDLE',         label:'Bundle Add-on Plan ID',  type:'text',     placeholder:'plan_...',      required:false},
    ],
    docsUrl:'https://dashboard.razorpay.com/',
  },
  {
    id:'stripe', name:'Stripe', type:'api', category:'Payments', mandatory:false, status:'inactive', scope:'platform',
    purpose:'International payment gateway. Handles USD/international subscriptions. Use alongside Razorpay for global users.',
    fallback:'Razorpay (India-only). No international billing without Stripe.',
    tags:['payments','international','subscriptions'],
    impactedAgents:[
      {id:'herald', name:'Herald', emoji:'📣', impact:'high',   subAgents:['Subscription Manager','Revenue Tracker']},
      {id:'oracle', name:'Oracle', emoji:'📊', impact:'medium', subAgents:['Revenue Analytics']},
    ],
    fields:[
      {key:'STRIPE_SECRET_KEY',       label:'Secret Key',        type:'password', placeholder:'sk_live_...', required:true,  hint:'dashboard.stripe.com → Developers → API Keys'},
      {key:'STRIPE_WEBHOOK_SECRET',   label:'Webhook Secret',    type:'password', placeholder:'whsec_...',   required:true},
      {key:'VITE_STRIPE_PUBLIC_KEY',  label:'Public Key',        type:'text',     placeholder:'pk_live_...', required:true},
      {key:'STRIPE_PRICE_PRO',        label:'Pro Price ID',      type:'text',     placeholder:'price_...',   required:false},
      {key:'STRIPE_PRICE_PREMIUM',    label:'Premium Price ID',  type:'text',     placeholder:'price_...',   required:false},
      {key:'STRIPE_PRICE_ELITE',      label:'Elite Price ID',    type:'text',     placeholder:'price_...',   required:false},
    ],
    docsUrl:'https://dashboard.stripe.com/',
  },

  /* ══════════════════════════════════════════════════════════════════════════ */
  /* Email                                                                      */
  /* ══════════════════════════════════════════════════════════════════════════ */
  {
    id:'sendgrid', name:'SendGrid', type:'api', category:'Email', mandatory:false, status:'inactive', scope:'platform',
    purpose:'Transactional + marketing email. OTP verification, welcome emails, study reminders, weekly progress reports, newsletters.',
    fallback:'Resend (simpler API, fewer templates). SMTP fallback via Nodemailer.',
    tags:['email','notifications'],
    impactedAgents:[
      {id:'mentor', name:'Mentor', emoji:'🎯', impact:'high',   subAgents:['Study Reminder','Streak Coach','Progress Reporter','OTP Sender']},
      {id:'herald', name:'Herald', emoji:'📣', impact:'medium', subAgents:['Newsletter Manager','Subscription Notifier']},
      {id:'nexus',  name:'Nexus',  emoji:'🔗', impact:'medium', subAgents:['Support Email Handler']},
    ],
    fields:[
      {key:'SENDGRID_API_KEY',      label:'API Key',           type:'password', placeholder:'SG.xxx', required:true,  hint:'app.sendgrid.com → Settings → API Keys'},
      {key:'SENDGRID_FROM_EMAIL',   label:'From Email',        type:'text',     placeholder:'hello@edugenius.in', required:true},
      {key:'SENDGRID_FROM_NAME',    label:'From Name',         type:'text',     placeholder:'EduGenius', required:true},
    ],
    docsUrl:'https://sendgrid.com/',
  },
  {
    id:'resend', name:'Resend', type:'api', category:'Email', mandatory:false, status:'inactive', scope:'platform',
    purpose:'Modern email API (Resend.com). Simpler alternative to SendGrid. Recommended for lean setups.',
    fallback:'SendGrid. SMTP via Nodemailer.',
    tags:['email','notifications'],
    impactedAgents:[
      {id:'mentor', name:'Mentor', emoji:'🎯', impact:'medium', subAgents:['Study Reminder','OTP Sender']},
      {id:'herald', name:'Herald', emoji:'📣', impact:'medium', subAgents:['Newsletter Manager']},
    ],
    fields:[
      {key:'RESEND_API_KEY',    label:'API Key',     type:'password', placeholder:'re_...', required:true, hint:'resend.com → API Keys'},
      {key:'RESEND_FROM_EMAIL', label:'From Email',  type:'text',     placeholder:'hello@edugenius.in', required:true},
    ],
    docsUrl:'https://resend.com/',
  },

  /* ══════════════════════════════════════════════════════════════════════════ */
  /* Chat Channels (Exam-Scoped)                                                */
  /* ══════════════════════════════════════════════════════════════════════════ */
  {
    id:'whatsapp', name:'WhatsApp Business', type:'api', category:'Chat Channels', mandatory:false, status:'inactive', scope:'exam',
    examScoped: true,
    purpose:'WhatsApp tutoring & outreach. Plan-gated: Premium/Elite included; Pro via ₹99/mo add-on. Exam-scoped: separate WhatsApp Business numbers per exam allow branded sender identity (e.g., "EduGenius JEE" vs "EduGenius NEET").',
    fallback:'Web portal only. Students link via Settings → Channels.',
    tags:['messaging','channels','chatbot'],
    impactedAgents:[
      {id:'chatbot_access', name:'ChatbotAccessService', emoji:'🔐', impact:'critical', subAgents:['Plan Gating Layer','Add-on Checker']},
      {id:'sage',   name:'Sage',   emoji:'🧠', impact:'high',   subAgents:['Multi-Channel Tutor','WhatsApp Handler']},
      {id:'mentor', name:'Mentor', emoji:'🎯', impact:'high',   subAgents:['WhatsApp Reminder','Lifecycle Outreach']},
      {id:'herald', name:'Herald', emoji:'📣', impact:'medium', subAgents:['Broadcast Manager','Campaign Delivery']},
      {id:'nexus',  name:'Nexus',  emoji:'🔗', impact:'medium', subAgents:['Support Ticket Notifier']},
    ],
    fields:[
      {key:'WHATSAPP_PHONE_NUMBER_ID',  label:'Phone Number ID',      type:'text',     placeholder:'1234567890', required:true,  hint:'Meta Business Suite → WhatsApp', examScoped:true},
      {key:'WHATSAPP_ACCESS_TOKEN',     label:'Access Token',         type:'password', placeholder:'EAAxxxxx',   required:true,  examScoped:true},
      {key:'WHATSAPP_VERIFY_TOKEN',     label:'Webhook Verify Token', type:'password', placeholder:'your_token', required:true},
      {key:'WHATSAPP_APP_SECRET',       label:'App Secret',           type:'password', placeholder:'',           required:true},
    ],
    docsUrl:'https://business.facebook.com/',
  },
  {
    id:'telegram', name:'Telegram Bot', type:'api', category:'Chat Channels', mandatory:false, status:'inactive', scope:'exam',
    examScoped: true,
    purpose:'Telegram tutoring. Popular with JEE/NEET students — inline keyboards, LaTeX math rendering, group study rooms. Plan-gated: Premium/Elite included; Pro via ₹99/mo add-on. Exam-scoped: one bot per exam for focused topic context and separate student communities.',
    fallback:'Web portal only. Students connect via Settings → Channels using /link bot command.',
    tags:['messaging','channels','chatbot'],
    impactedAgents:[
      {id:'chatbot_access', name:'ChatbotAccessService', emoji:'🔐', impact:'critical', subAgents:['Plan Gating Layer','Add-on Checker']},
      {id:'sage',   name:'Sage',   emoji:'🧠', impact:'high',   subAgents:['Multi-Channel Tutor','Telegram Handler','LaTeX Renderer']},
      {id:'mentor', name:'Mentor', emoji:'🎯', impact:'high',   subAgents:['Telegram Reminder','Lifecycle Outreach']},
      {id:'herald', name:'Herald', emoji:'📣', impact:'medium', subAgents:['Broadcast Manager','Announcement Publisher']},
      {id:'forge',  name:'Forge',  emoji:'⚙️', impact:'high',   subAgents:['Webhook Configurator','Bot Router']},
    ],
    fields:[
      {key:'TELEGRAM_BOT_TOKEN',      label:'Bot Token',      type:'password', placeholder:'123456:ABC-DEF...', required:true,  hint:'@BotFather on Telegram → /newbot', examScoped:true},
      {key:'TELEGRAM_WEBHOOK_SECRET', label:'Webhook Secret', type:'password', placeholder:'random_secret',    required:false},
    ],
    docsUrl:'https://core.telegram.org/bots',
  },

  /* ══════════════════════════════════════════════════════════════════════════ */
  /* Analytics (Exam-Scoped)                                                    */
  /* ══════════════════════════════════════════════════════════════════════════ */
  {
    id:'ga4', name:'Google Analytics 4', type:'api', category:'Analytics', mandatory:false, status:'inactive', scope:'exam',
    examScoped: true,
    purpose:'User behaviour: funnel analysis, page views, conversion tracking. Exam-scoped: separate GA4 properties per exam give clean funnels without JEE traffic polluting NEET conversion data.',
    fallback:'Internal Oracle analytics for key metrics. No external analytics without this.',
    tags:['analytics'],
    impactedAgents:[
      {id:'oracle', name:'Oracle', emoji:'📊', impact:'high',   subAgents:['Funnel Analyzer','Behaviour Tracker','Cohort Builder']},
      {id:'scout',  name:'Scout',  emoji:'🔍', impact:'medium', subAgents:['Traffic Analyzer','Keyword Opportunity Finder']},
    ],
    fields:[
      {key:'GA4_MEASUREMENT_ID',      label:'Measurement ID',          type:'text',     placeholder:'G-XXXXXXXXXX', required:true,  examScoped:true},
      {key:'GA4_API_SECRET',          label:'API Secret',              type:'password', placeholder:'',             required:false, hint:'For server-side events', examScoped:true},
      {key:'VITE_GA4_MEASUREMENT_ID', label:'Frontend Measurement ID', type:'text',     placeholder:'G-XXXXXXXXXX', required:true,  examScoped:true},
    ],
    docsUrl:'https://analytics.google.com/',
  },
  {
    id:'mixpanel', name:'Mixpanel', type:'api', category:'Analytics', mandatory:false, status:'inactive', scope:'platform',
    purpose:'Product analytics: user-level event tracking, cohort analysis, A/B test measurement. Shared instance, filtered by exam_type property.',
    fallback:'Oracle internal analytics only.',
    tags:['analytics','product'],
    impactedAgents:[
      {id:'oracle', name:'Oracle', emoji:'📊', impact:'medium', subAgents:['Cohort Analyzer','Retention Tracker','A/B Test Evaluator']},
    ],
    fields:[
      {key:'MIXPANEL_TOKEN',      label:'Project Token', type:'text',     placeholder:'', required:true},
      {key:'MIXPANEL_API_SECRET', label:'API Secret',    type:'password', placeholder:'', required:false},
    ],
    docsUrl:'https://mixpanel.com/',
  },

  /* ══════════════════════════════════════════════════════════════════════════ */
  /* Vector Store (Exam-Scoped)                                                 */
  /* ══════════════════════════════════════════════════════════════════════════ */
  {
    id:'pinecone', name:'Pinecone', type:'api', category:'Vector Store', mandatory:false, status:'inactive', scope:'exam',
    examScoped: true,
    purpose:'Vector DB for semantic search and RAG tutoring. Exam-scoped indexes are critical: JEE Physics vectors must not pollute NEET Biology retrieval. One index per exam = clean, relevant results.',
    fallback:'Qdrant → in-memory (non-persistent, max ~50K vectors).',
    tags:['vector','rag','search'],
    impactedAgents:[
      {id:'atlas', name:'Atlas', emoji:'📚', impact:'high',   subAgents:['Content Retriever','Similarity Engine','Curriculum Mapper']},
      {id:'sage',  name:'Sage',  emoji:'🧠', impact:'high',   subAgents:['Contextual Tutor','Past Question Finder','RAG Synthesizer']},
      {id:'scout', name:'Scout', emoji:'🔍', impact:'medium', subAgents:['Topic Cluster Analyzer']},
    ],
    fields:[
      {key:'PINECONE_API_KEY',     label:'API Key',     type:'password', placeholder:'',             required:true},
      {key:'PINECONE_ENVIRONMENT', label:'Environment', type:'text',     placeholder:'us-east1-gcp', required:true},
      {key:'PINECONE_INDEX',       label:'Index Name',  type:'text',     placeholder:'edugenius-jee', required:true, hint:'Use one index per exam: edugenius-jee, edugenius-neet, etc.', examScoped:true},
    ],
    docsUrl:'https://app.pinecone.io/',
  },
  {
    id:'qdrant', name:'Qdrant', type:'api', category:'Vector Store', mandatory:false, status:'inactive', scope:'exam',
    examScoped: true,
    purpose:'Self-hostable vector DB — cost-effective Pinecone alternative. One Qdrant collection per exam.',
    fallback:'In-memory vector store (limited, non-persistent).',
    tags:['vector','rag'],
    impactedAgents:[
      {id:'atlas', name:'Atlas', emoji:'📚', impact:'high',   subAgents:['Content Retriever','Similarity Engine']},
      {id:'sage',  name:'Sage',  emoji:'🧠', impact:'medium', subAgents:['Contextual Tutor']},
    ],
    fields:[
      {key:'QDRANT_URL',        label:'Qdrant URL',    type:'url',      placeholder:'http://localhost:6333', required:true},
      {key:'QDRANT_API_KEY',    label:'API Key',       type:'password', placeholder:'Optional for local',    required:false},
      {key:'QDRANT_COLLECTION', label:'Collection',    type:'text',     placeholder:'edugenius-jee',         required:true, hint:'One collection per exam: edugenius-jee, edugenius-neet, etc.', examScoped:true},
    ],
    docsUrl:'https://qdrant.tech/',
  },

  /* ══════════════════════════════════════════════════════════════════════════ */
  /* Storage                                                                    */
  /* ══════════════════════════════════════════════════════════════════════════ */
  {
    id:'s3', name:'AWS S3 / Cloudflare R2', type:'api', category:'Storage', mandatory:false, status:'inactive', scope:'platform',
    purpose:'Object storage for PDFs, images, video scripts, user uploads. Course content organised by exam bucket/prefix.',
    fallback:'Local filesystem (dev only). Not suitable for production multi-instance.',
    tags:['storage','uploads'],
    impactedAgents:[
      {id:'atlas', name:'Atlas', emoji:'📚', impact:'high',   subAgents:['Asset Manager','PDF Ingester','Content Writer']},
      {id:'forge', name:'Forge', emoji:'⚙️', impact:'medium', subAgents:['Deployment Manager','Backup Manager']},
    ],
    fields:[
      {key:'S3_BUCKET',            label:'Bucket Name',        type:'text',     placeholder:'edugenius-content', required:true},
      {key:'S3_REGION',            label:'Region',             type:'text',     placeholder:'ap-south-1',        required:true},
      {key:'S3_ACCESS_KEY_ID',     label:'Access Key ID',      type:'text',     placeholder:'AKIA...',           required:true},
      {key:'S3_SECRET_ACCESS_KEY', label:'Secret Access Key',  type:'password', placeholder:'',                  required:true},
      {key:'S3_ENDPOINT',          label:'Custom Endpoint',    type:'url',      placeholder:'https://...r2.cloudflarestorage.com', required:false, hint:'For Cloudflare R2 or MinIO'},
      {key:'VITE_CDN_URL',         label:'CDN URL (public)',   type:'url',      placeholder:'https://cdn.edugenius.in', required:false},
    ],
    docsUrl:'https://aws.amazon.com/s3/',
  },

  /* ══════════════════════════════════════════════════════════════════════════ */
  /* MCP Servers                                                                */
  /* ══════════════════════════════════════════════════════════════════════════ */
  {
    id:'mcp-wolfram', name:'Wolfram MCP Server', type:'mcp', category:'MCP Servers', mandatory:false, status:'inactive', scope:'platform',
    purpose:'Exposes Wolfram Alpha as an MCP tool. Any MCP-compatible LLM can call Wolfram directly as a tool — no wrapper code needed.',
    fallback:'REST API via WOLFRAM_APP_ID.',
    mcpEndpoint:'http://localhost:8100/wolfram',
    tags:['mcp','math'],
    impactedAgents:[
      {id:'sage',  name:'Sage',  emoji:'🧠', impact:'high',   subAgents:['Answer Verifier','Hard Problem Solver']},
      {id:'atlas', name:'Atlas', emoji:'📚', impact:'medium', subAgents:['Quality Checker']},
    ],
    fields:[
      {key:'MCP_WOLFRAM_URL',    label:'MCP Server URL', type:'url',      placeholder:'http://localhost:8100/wolfram', required:true},
      {key:'MCP_WOLFRAM_SECRET', label:'Server Secret',  type:'password', placeholder:'Optional shared secret',       required:false},
    ],
  },
  {
    id:'mcp-filesystem', name:'Filesystem MCP Server', type:'mcp', category:'MCP Servers', mandatory:false, status:'inactive', scope:'platform',
    purpose:'Allows Atlas/Forge agents to read/write course content files via MCP tool calls. Useful for self-hosted deployments.',
    fallback:'S3/GCS blob storage via direct API calls.',
    mcpEndpoint:'http://localhost:8101/filesystem',
    tags:['mcp','storage'],
    impactedAgents:[
      {id:'atlas', name:'Atlas', emoji:'📚', impact:'medium', subAgents:['Asset Manager','Content Writer']},
      {id:'forge', name:'Forge', emoji:'⚙️', impact:'medium', subAgents:['Deployment Manager']},
    ],
    fields:[
      {key:'MCP_FILESYSTEM_URL',    label:'MCP Server URL',    type:'url',      placeholder:'http://localhost:8101/filesystem', required:true},
      {key:'MCP_FILESYSTEM_ROOT',   label:'Allowed Root Path', type:'text',     placeholder:'/data/edugenius',                  required:true},
      {key:'MCP_FILESYSTEM_SECRET', label:'Server Secret',     type:'password', placeholder:'Optional',                         required:false},
    ],
  },
  {
    id:'mcp-browser', name:'Browser / Puppeteer MCP', type:'mcp', category:'MCP Servers', mandatory:false, status:'inactive', scope:'platform',
    purpose:'Headless browser control via MCP. Scout uses it for live competitor scraping (Unacademy, PW, Byju\'s pricing) and real-time rank/cutoff scraping from NTA/exam websites.',
    fallback:'Static mock data from last manual scrape. Scout accuracy degrades within 1-2 days.',
    mcpEndpoint:'http://localhost:8102/browser',
    tags:['mcp','scraping','scout'],
    impactedAgents:[
      {id:'scout', name:'Scout', emoji:'🔍', impact:'high', subAgents:['Competitor Price Scraper','NTA Rank Scraper','Cutoff Tracker']},
    ],
    fields:[
      {key:'MCP_BROWSER_URL',    label:'MCP Server URL', type:'url',      placeholder:'http://localhost:8102/browser', required:true},
      {key:'MCP_BROWSER_SECRET', label:'Server Secret',  type:'password', placeholder:'Optional',                     required:false},
    ],
  },

  /* ══════════════════════════════════════════════════════════════════════════ */
  /* Personal Connections (User-Scoped)                                         */
  /* ══════════════════════════════════════════════════════════════════════════ */
  {
    id:'personal-wolfram', name:'My Wolfram Key', type:'api', category:'Personal Connections', mandatory:false, status:'inactive', scope:'user',
    purpose:'Your personal Wolfram Alpha App ID. Overrides the platform key for your sessions — useful for teachers and power users who need their own quota.',
    fallback:'Falls back to platform Wolfram key, then SymPy.',
    tags:['personal','verification','math'],
    impactedAgents:[
      {id:'sage', name:'Sage', emoji:'🧠', impact:'medium', subAgents:['Answer Verifier','Step Validator']},
    ],
    fields:[
      {key:'MY_WOLFRAM_APP_ID', label:'My Wolfram App ID', type:'password', placeholder:'XXXXX-XXXXXXXXXX', required:true, hint:'developer.wolframalpha.com → My Apps → Get an App ID'},
    ],
    docsUrl:'https://developer.wolframalpha.com/',
    endpoint:'https://api.wolframalpha.com/v2/query',
  },
  {
    id:'personal-mcp', name:'My MCP Server', type:'mcp', category:'Personal Connections', mandatory:false, status:'inactive', scope:'user',
    purpose:'Your personal MCP server endpoint. Connect a custom knowledge base, private tool server, or local AI assistant to EduGenius under your account only.',
    fallback:'Platform MCP servers and built-in knowledge sources.',
    tags:['personal','mcp'],
    impactedAgents:[
      {id:'sage',  name:'Sage',  emoji:'🧠', impact:'low', subAgents:['Contextual Tutor']},
      {id:'atlas', name:'Atlas', emoji:'📚', impact:'low', subAgents:['Content Retriever']},
    ],
    fields:[
      {key:'MY_MCP_URL',    label:'My MCP Endpoint URL',  type:'url',      placeholder:'http://localhost:3001/mcp', required:true},
      {key:'MY_MCP_SECRET', label:'My MCP Auth Secret',   type:'password', placeholder:'Optional secret',          required:false},
    ],
  },
  {
    id:'personal-telegram', name:'My Telegram Bot', type:'api', category:'Personal Connections', mandatory:false, status:'inactive', scope:'user',
    purpose:'Your personal Telegram bot for receiving study reminders, progress updates, and interacting with EduGenius AI directly on Telegram under your own account.',
    fallback:'Platform Telegram bot (shared) or web portal only.',
    tags:['personal','messaging','telegram'],
    impactedAgents:[
      {id:'mentor', name:'Mentor', emoji:'🎯', impact:'medium', subAgents:['Personal Reminder','Lifecycle Outreach']},
    ],
    fields:[
      {key:'MY_TELEGRAM_BOT_TOKEN', label:'My Telegram Bot Token', type:'password', placeholder:'123456:ABC-DEF...', required:true, hint:'@BotFather on Telegram → /newbot'},
    ],
    docsUrl:'https://core.telegram.org/bots',
  },
];

// ─── Exam-instance key derivation ─────────────────────────────────────────────

/** Returns the exam-scoped env var key, e.g. PINECONE_INDEX → PINECONE_INDEX_JEE */
function examKey(baseKey: string, exam: ExamType): string {
  return `${baseKey}_${exam}`;
}

/** Derive all exam-scoped field keys for a connection across all exams */
function allExamKeys(conn: Connection): { exam: ExamType; key: string; baseKey: string }[] {
  const result: { exam: ExamType; key: string; baseKey: string }[] = [];
  for (const field of conn.fields) {
    if (field.examScoped) {
      for (const exam of EXAM_TYPES) {
        result.push({ exam, key: examKey(field.key, exam), baseKey: field.key });
      }
    }
  }
  return result;
}

// ─── Storage Layer (bidirectional sync) ───────────────────────────────────────

const STORAGE_KEY         = 'edugenius_connections';
const CUSTOM_REGISTRY_KEY = 'edugenius_custom_connections';

function getUserId(): string {
  try { return loadCurrentUser()?.uid || 'guest'; }
  catch { return 'guest'; }
}
function userStorageKey(): string { return `edugenius_user_connections_${getUserId()}`; }
function agentConnectionsKey(agentId: string): string { return `edugenius_agent_connections_${agentId}`; }
function connHealthKey(connId: string): string { return `edugenius_conn_health_${connId}`; }

function loadStoredValues(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function saveStoredValues(vals: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vals));
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(vals) }));
}

function loadUserStoredValues(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(userStorageKey()) || '{}'); }
  catch { return {}; }
}

function saveUserStoredValues(vals: Record<string, string>) {
  const k = userStorageKey();
  localStorage.setItem(k, JSON.stringify(vals));
  window.dispatchEvent(new StorageEvent('storage', { key: k, newValue: JSON.stringify(vals) }));
}

function loadCustomConnections(): Connection[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_REGISTRY_KEY) || '[]');
    // Merge user-scoped custom connections too
    const userId = getUserId();
    const userRaw = JSON.parse(localStorage.getItem(`edugenius_custom_connections_user_${userId}`) || '[]');
    return [...raw, ...userRaw];
  } catch { return []; }
}

function saveCustomConnection(conn: Connection) {
  try {
    if (conn.scope === 'user') {
      const userId = getUserId();
      const key = `edugenius_custom_connections_user_${userId}`;
      const existing: Connection[] = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify([...existing.filter(c => c.id !== conn.id), conn]));
    } else {
      const existing: Connection[] = JSON.parse(localStorage.getItem(CUSTOM_REGISTRY_KEY) || '[]');
      localStorage.setItem(CUSTOM_REGISTRY_KEY, JSON.stringify([...existing.filter(c => c.id !== conn.id), conn]));
    }
  } catch { /* noop */ }
}

function deleteCustomConnection(id: string) {
  try {
    const existing: Connection[] = JSON.parse(localStorage.getItem(CUSTOM_REGISTRY_KEY) || '[]');
    localStorage.setItem(CUSTOM_REGISTRY_KEY, JSON.stringify(existing.filter(c => c.id !== id)));
    const userId = getUserId();
    const userKey = `edugenius_custom_connections_user_${userId}`;
    const userExisting: Connection[] = JSON.parse(localStorage.getItem(userKey) || '[]');
    localStorage.setItem(userKey, JSON.stringify(userExisting.filter(c => c.id !== id)));
  } catch { /* noop */ }
}

interface ConnHealth { status: 'active' | 'error'; testedAt: number; }

function loadConnHealth(connId: string): ConnHealth | null {
  try { return JSON.parse(localStorage.getItem(connHealthKey(connId)) || 'null'); }
  catch { return null; }
}

function saveConnHealth(connId: string, h: ConnHealth) {
  localStorage.setItem(connHealthKey(connId), JSON.stringify(h));
}

function deriveStatus(conn: Connection, stored: Record<string, string>, userStored?: Record<string, string>): ConnStatus {
  const src = conn.scope === 'user' ? (userStored || loadUserStoredValues()) : stored;
  const required = conn.fields.filter(f => f.required && !f.examScoped);
  if (required.length === 0) return conn.status;
  const allFilled = required.every(f => !!src[f.key]);
  return allFilled ? 'active' : 'inactive';
}

// Update agent connections map when a custom connection is assigned
function updateAgentConnectionMap(agentId: string, connId: string, enabled: boolean) {
  try {
    const key = agentConnectionsKey(agentId);
    const existing: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = enabled
      ? [...new Set([...existing, connId])]
      : existing.filter(id => id !== connId);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch { /* noop */ }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IMPACT_COLORS: Record<ImpactLevel, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const TYPE_ICONS: Record<ConnType, React.ReactNode> = {
  api:      <Network size={14} />,
  mcp:      <Bot size={14} />,
  webhook:  <Network size={14} />,
  oauth:    <Shield size={14} />,
  database: <Bot size={14} />,
};

function StatusBadge({ status }: { status: ConnStatus }) {
  const map = {
    active:   { cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',         icon: <CheckCircle2 size={12} />, label: 'Active' },
    inactive: { cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',                icon: <Clock size={12} />,        label: 'Not Configured' },
    error:    { cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',                 icon: <XCircle size={12} />,      label: 'Error' },
    pending:  { cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',     icon: <AlertTriangle size={12} />, label: 'Pending' },
  };
  const { cls, icon, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {icon}{label}
    </span>
  );
}

function ScopeBadge({ scope, isCustom }: { scope: ConnectionScope; isCustom?: boolean }) {
  if (isCustom) return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      Custom
    </span>
  );
  const map: Record<ConnectionScope, { cls: string; label: string }> = {
    platform: { cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', label: 'Platform' },
    exam:     { cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', label: 'Exam' },
    user:     { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'User' },
  };
  const { cls, label } = map[scope];
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ─── Exam Instance Panel ──────────────────────────────────────────────────────

/**
 * Shows all exam-scoped connections in a grid: rows = connections, cols = exams.
 * Each cell shows configured/missing status and lets CEO/Admin configure the value.
 */
function ExamInstancePanel({
  stored, canEdit, onEditExamKey,
}: {
  stored: Record<string, string>;
  canEdit: boolean;
  onEditExamKey: (key: string, label: string, currentValue: string) => void;
}) {
  const [activeExam, setActiveExam] = useState<ExamType>('JEE');

  const examScopedConns = REGISTRY.filter(c => c.examScoped);

  // For the active exam, collect all scoped fields
  const examFields: { conn: Connection; field: ConnField; storageKey: string }[] = [];
  for (const conn of examScopedConns) {
    for (const field of conn.fields) {
      if (field.examScoped) {
        examFields.push({ conn, field, storageKey: examKey(field.key, activeExam) });
      }
    }
  }

  const configuredCount = examFields.filter(f => !!stored[f.storageKey]).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
        <GraduationCap size={18} className="text-primary-400" />
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white text-sm">Per-Exam Instance Configuration</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Configure separate API keys / IDs per examination. One instance per exam = isolated data, clean analytics, independent scaling.
          </p>
        </div>
      </div>

      {/* Exam tabs */}
      <div className="flex gap-1 p-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex-wrap">
        {EXAM_TYPES.map(exam => {
          const examFieldsForThisExam = examFields.filter(f => examKey(f.field.key, exam) && !!stored[examKey(f.field.key, exam)]);
          const total = examScopedConns.flatMap(c => c.fields.filter(f => f.examScoped)).length;
          const done = examFieldsForThisExam.length;
          return (
            <button
              key={exam}
              onClick={() => setActiveExam(exam)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeExam === exam
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span>{EXAM_META[exam].emoji}</span>
              <span>{exam}</span>
              <span className={`px-1 py-0.5 rounded text-xs ${done > 0 ? 'bg-green-500/20 text-green-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}>
                {done}/{total}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active exam fields */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">{EXAM_META[activeExam].emoji}</span>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{EXAM_META[activeExam].label}</h3>
            <p className="text-xs text-gray-400">{configuredCount}/{examFields.length} fields configured</p>
          </div>
        </div>

        <div className="space-y-2">
          {examFields.map(({ conn, field, storageKey }) => {
            const val = stored[storageKey] || '';
            const isSet = !!val;
            return (
              <div
                key={storageKey}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                  isSet
                    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/40'
                    : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{storageKey}</span>
                    {isSet
                      ? <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                      : <Clock size={12} className="text-gray-400 shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    {conn.name} · {field.label}
                    {field.hint && <span className="text-gray-400"> — {field.hint}</span>}
                  </p>
                </div>
                {isSet && (
                  <span className="text-xs text-gray-400 font-mono truncate max-w-[120px]">
                    {field.type === 'password' ? '••••••••' : val}
                  </span>
                )}
                {canEdit && (
                  <button
                    onClick={() => onEditExamKey(storageKey, `${conn.name} — ${field.label} (${activeExam})`, val)}
                    className={`px-2.5 py-1 text-xs rounded-lg shrink-0 ${
                      isSet
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-primary-600 text-white hover:bg-primary-700'
                    }`}
                  >
                    {isSet ? 'Edit' : 'Set'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Env var naming guide */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40 rounded-lg">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">ENV VAR NAMING CONVENTION</p>
          <p className="text-xs text-blue-800 dark:text-blue-300">
            Pattern: <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 rounded">BASE_VAR_{'{'}EXAM{'}'}</code>
          </p>
          <div className="mt-1 space-y-0.5">
            {examFields.slice(0, 3).map(({ storageKey }) => (
              <p key={storageKey} className="text-xs font-mono text-blue-700 dark:text-blue-400">{storageKey}=...</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Single-key edit modal ────────────────────────────────────────────────────

function KeyEditModal({
  label, envKey, currentValue, isPassword, onSave, onClose,
}: {
  label: string; envKey: string; currentValue: string;
  isPassword: boolean; onSave: (v: string) => void; onClose: () => void;
}) {
  const [val, setVal] = useState(currentValue);
  const [show, setShow] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="font-bold text-gray-900 dark:text-white text-sm">{label}</h2>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs font-mono text-gray-400">{envKey}</p>
          <div className="relative flex items-center gap-2">
            <input
              type={isPassword && !show ? 'password' : 'text'}
              value={val}
              onChange={e => setVal(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            />
            {isPassword && (
              <button type="button" onClick={() => setShow(s => !s)} className="absolute right-8 text-gray-400">
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            )}
            <button type="button" onClick={() => navigator.clipboard.writeText(val)} className="shrink-0 text-gray-400">
              <Copy size={14} />
            </button>
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600">Cancel</button>
          <button onClick={() => { onSave(val); onClose(); }} className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">
            Save & Propagate
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Configure Modal ──────────────────────────────────────────────────────────

function ConfigureModal({
  conn, stored, onSave, onClose,
}: {
  conn: Connection; stored: Record<string, string>;
  onSave: (vals: Record<string, string>) => void; onClose: () => void;
}) {
  const nonScopedFields = conn.fields.filter(f => !f.examScoped);
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(nonScopedFields.map(f => [f.key, stored[f.key] || '']))
  );
  const [show, setShow] = useState<Record<string, boolean>>({});

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{conn.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{conn.category}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-3 border-b border-gray-200 dark:border-gray-700">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">PURPOSE</p>
            <p className="text-sm text-blue-900 dark:text-blue-200">{conn.purpose}</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">FALLBACK</p>
            <p className="text-sm text-amber-900 dark:text-amber-200">{conn.fallback}</p>
          </div>
          {conn.examScoped && (
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 flex items-start gap-2">
              <Layers size={14} className="text-purple-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-1">EXAM-SCOPED</p>
                <p className="text-xs text-purple-900 dark:text-purple-200">
                  Fields marked ★ can be configured per exam in the <strong>Per-Exam Instance Panel</strong> above.
                  Configure shared/global fields here.
                </p>
              </div>
            </div>
          )}
          {conn.mcpEndpoint && (
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-1">MCP ENDPOINT</p>
              <code className="text-sm text-purple-900 dark:text-purple-200 font-mono">{conn.mcpEndpoint}</code>
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Global (non-exam-scoped) fields */}
          {nonScopedFields.length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase">Global Settings</p>
              {nonScopedFields.map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {field.hint && <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{field.hint}</p>}
                  <div className="relative flex items-center gap-2">
                    <input
                      type={field.type === 'password' && !show[field.key] ? 'password' : 'text'}
                      value={vals[field.key] || ''}
                      onChange={e => setVals({ ...vals, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    {field.type === 'password' && (
                      <button type="button" onClick={() => setShow(s => ({ ...s, [field.key]: !s[field.key] }))}
                        className="absolute right-8 text-gray-400 hover:text-gray-600">
                        {show[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                    <button type="button" onClick={() => navigator.clipboard.writeText(vals[field.key] || '')}
                      title="Copy" className="shrink-0 text-gray-400 hover:text-gray-600">
                      <Copy size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">{field.key}</p>
                </div>
              ))}
            </>
          )}

          {/* Exam-scoped fields reminder */}
          {conn.fields.some(f => f.examScoped) && (
            <div className="p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800/40">
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-1 flex items-center gap-1">
                <Layers size={12} /> Exam-scoped fields
              </p>
              <div className="space-y-1">
                {conn.fields.filter(f => f.examScoped).map(f => (
                  <p key={f.key} className="text-xs font-mono text-purple-700 dark:text-purple-400">
                    ★ {f.key}_JEE, {f.key}_NEET, {f.key}_CAT... → configure in Per-Exam panel
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-between items-center">
          {conn.docsUrl && (
            <a href={conn.docsUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline">
              <ExternalLink size={14} /> Docs
            </a>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button onClick={() => { onSave(vals); onClose(); }}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">
              Save & Propagate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Connection Card ──────────────────────────────────────────────────────────

function ConnectionCard({
  conn, stored, userStored, canEdit, showScopeBadge, onConfigure, onDelete,
}: {
  conn: Connection; stored: Record<string, string>; userStored: Record<string, string>;
  canEdit: boolean; showScopeBadge?: boolean;
  onConfigure: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [health, setHealth] = useState<ConnHealth | null>(() => loadConnHealth(conn.id));
  const [testing, setTesting] = useState(false);

  const status = deriveStatus(conn, stored, userStored);
  const src = conn.scope === 'user' ? userStored : stored;
  const hasValue = conn.fields.some(f => !!src[f.key]);

  async function handleTest() {
    setTesting(true);
    try {
      let ok = false;
      if (conn.id === 'personal-wolfram' || conn.id === 'wolfram') {
        const key = src['MY_WOLFRAM_APP_ID'] || src['WOLFRAM_APP_ID'] || '';
        if (key) {
          try {
            const r = await fetch(`https://api.wolframalpha.com/v2/query?input=2%2B2&appid=${key}&format=plaintext`);
            const text = await r.text();
            ok = text.includes('<result>') || text.includes('queryresult');
          } catch { ok = false; }
        }
      } else if (conn.endpoint || conn.mcpEndpoint) {
        const url = conn.endpoint || conn.mcpEndpoint || '';
        try {
          const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
          ok = r.ok || r.status < 500;
        } catch { ok = false; }
      } else {
        // No endpoint to test — mark as pending
        const h: ConnHealth = { status: 'active', testedAt: Date.now() };
        setHealth(h); saveConnHealth(conn.id, h);
        return;
      }
      const h: ConnHealth = { status: ok ? 'active' : 'error', testedAt: Date.now() };
      setHealth(h); saveConnHealth(conn.id, h);
    } finally { setTesting(false); }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 flex items-start gap-3">
        <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${conn.mandatory ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'}`} title={conn.mandatory ? 'Mandatory' : 'Optional'} />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900 dark:text-white text-sm">{conn.name}</span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              {TYPE_ICONS[conn.type]} {conn.type.toUpperCase()}
            </span>
            {showScopeBadge && <ScopeBadge scope={conn.scope} isCustom={conn.isCustom} />}
            {conn.mandatory && (
              <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">MANDATORY</span>
            )}
            {conn.examScoped && (
              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 flex items-center gap-0.5">
                <Layers size={10} /> EXAM-SCOPED
              </span>
            )}
            <StatusBadge status={status} />
            {/* Health probe result */}
            {health && (
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs ${health.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                {health.status === 'active' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                Tested {new Date(health.testedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{conn.purpose}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Test button — only if there's a stored value */}
          {hasValue && (
            <button
              onClick={handleTest}
              disabled={testing}
              title="Test connection"
              className="px-2 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-1 disabled:opacity-50"
            >
              <Zap size={11} /> {testing ? '…' : 'Test'}
            </button>
          )}
          {canEdit && (
            <button onClick={() => onConfigure(conn.id)}
              className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700">
              {status === 'active' ? 'Edit' : 'Configure'}
            </button>
          )}
          {/* Delete for custom connections only */}
          {conn.isCustom && onDelete && (
            <button
              onClick={() => { if (confirm(`Delete "${conn.name}"?`)) onDelete(conn.id); }}
              className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              title="Delete custom connection"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-1">PURPOSE</p>
              <p className="text-xs text-blue-900 dark:text-blue-200">{conn.purpose}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg p-3">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">FALLBACK</p>
              <p className="text-xs text-amber-900 dark:text-amber-200">{conn.fallback}</p>
            </div>
          </div>

          {conn.mcpEndpoint && (
            <div className="bg-purple-50 dark:bg-purple-900/10 rounded-lg p-3">
              <p className="text-xs font-bold text-purple-700 dark:text-purple-400 mb-1">MCP ENDPOINT</p>
              <code className="text-xs text-purple-900 dark:text-purple-200 font-mono">{conn.mcpEndpoint}</code>
            </div>
          )}

          {conn.endpoint && (
            <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3">
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">ENDPOINT</p>
              <code className="text-xs text-gray-700 dark:text-gray-300 font-mono">{conn.endpoint}</code>
            </div>
          )}

          <div>
            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
              <Bot size={12} /> {conn.isCustom ? 'ASSIGNED AGENTS' : 'IMPACTED AGENTS & SUB-AGENTS'}
            </p>
            {conn.isCustom ? (
              /* Custom connection: checkboxes for agent assignment */
              <div className="flex flex-wrap gap-2">
                {ALL_AGENTS.map(agent => {
                  const assigned = conn.impactedAgents.some(a => a.id === agent.id);
                  return (
                    <label key={agent.id} className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={assigned}
                        onChange={e => {
                          // Update agent connections map for user-scoped connections
                          if (conn.scope === 'user') {
                            updateAgentConnectionMap(agent.id, conn.id, e.target.checked);
                          }
                          // We can't mutate static objects, but for custom conns we persist separately
                          const updated: Connection = {
                            ...conn,
                            impactedAgents: e.target.checked
                              ? [...conn.impactedAgents, { id: agent.id, name: agent.name, emoji: agent.emoji, subAgents: [], impact: 'low' }]
                              : conn.impactedAgents.filter(a => a.id !== agent.id),
                          };
                          saveCustomConnection(updated);
                          // Force a re-render signal
                          window.dispatchEvent(new Event('edugenius_custom_updated'));
                        }}
                        className="rounded"
                      />
                      <span>{agent.emoji} {agent.name}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {conn.impactedAgents.map(agent => (
                  <div key={agent.id} className="flex items-start gap-2">
                    <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${IMPACT_COLORS[agent.impact]}`}>
                      {agent.impact.toUpperCase()}
                    </span>
                    <div>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{agent.emoji} {agent.name}</span>
                      {agent.subAgents.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {agent.subAgents.map(sa => (
                            <span key={sa} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs">{sa}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">ENV VARIABLES</p>
            <div className="flex flex-wrap gap-1">
              {conn.fields.map(f => (
                <span key={f.key} className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                  f.examScoped
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    : src[f.key]
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {f.required && !f.examScoped ? '* ' : ''}{f.examScoped ? `★ ${f.key}_{EXAM}` : f.key}
                </span>
              ))}
            </div>
            {conn.fields.some(f => f.examScoped) && (
              <p className="text-xs text-purple-500 dark:text-purple-400 mt-1">
                ★ = exam-scoped (e.g. {conn.fields.find(f => f.examScoped)?.key}_JEE, _NEET, _CAT…)
              </p>
            )}
          </div>

          {conn.docsUrl && (
            <a href={conn.docsUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
              <ExternalLink size={12} /> Documentation
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Add Custom Connection Form ───────────────────────────────────────────────

function AddConnectionForm({
  existingCategories,
  onSave,
  onCancel,
}: {
  existingCategories: string[];
  onSave: (conn: Connection) => void;
  onCancel: () => void;
}) {
  const defaultForm: CustomConnForm = {
    name: '', type: 'api', scope: 'platform', category: '',
    endpoint: '', authType: 'api_key', apiKeyLabel: 'API Key',
    storageKey: '', purpose: '', fallback: '', assignedAgents: [],
  };
  const [form, setForm] = useState<CustomConnForm>(defaultForm);

  function nameToStorageKey(name: string): string {
    return 'CUSTOM_' + name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function handleNameChange(name: string) {
    setForm(f => ({ ...f, name, storageKey: nameToStorageKey(name) }));
  }

  function toggleAgent(agentId: string) {
    setForm(f => ({
      ...f,
      assignedAgents: f.assignedAgents.includes(agentId)
        ? f.assignedAgents.filter(id => id !== agentId)
        : [...f.assignedAgents, agentId],
    }));
  }

  function handleSave() {
    if (!form.name.trim()) return;
    const conn: Connection = {
      id: `custom-${Date.now()}`,
      name: form.name.trim(),
      type: form.type,
      scope: form.scope as ConnectionScope,
      category: form.category.trim() || 'Custom',
      mandatory: false,
      status: 'inactive',
      purpose: form.purpose.trim() || 'Custom connection.',
      fallback: form.fallback.trim() || 'None configured.',
      isCustom: true,
      authType: form.authType,
      endpoint: form.endpoint.trim() || undefined,
      tags: ['custom'],
      impactedAgents: form.assignedAgents.map(id => {
        const ag = ALL_AGENTS.find(a => a.id === id)!;
        return { id: ag.id, name: ag.name, emoji: ag.emoji, subAgents: [], impact: 'low' as ImpactLevel };
      }),
      fields: form.authType !== 'none' ? [{
        key: form.storageKey || nameToStorageKey(form.name),
        label: form.apiKeyLabel || 'API Key',
        type: 'password',
        placeholder: '',
        required: true,
        hint: form.endpoint ? `Endpoint: ${form.endpoint}` : undefined,
      }] : [],
    };
    onSave(conn);
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-blue-300 dark:border-blue-700 p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Plus size={16} className="text-blue-500" />
        <h3 className="font-bold text-gray-900 dark:text-white text-sm">Add Custom Connection</h3>
        <button onClick={onCancel} className="ml-auto text-gray-400 hover:text-gray-600"><X size={16} /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name <span className="text-red-500">*</span></label>
          <input value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="My Custom API"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        {/* Type */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ConnType }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
            <option value="api">API</option>
            <option value="mcp">MCP</option>
            <option value="webhook">Webhook</option>
          </select>
        </div>
        {/* Scope */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Scope</label>
          <select value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value as 'platform' | 'user' }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
            <option value="platform">Platform (all users)</option>
            <option value="user">User (my account only)</option>
          </select>
        </div>
        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
          <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            list="existing-categories" placeholder="Custom"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          <datalist id="existing-categories">
            {existingCategories.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>
        {/* Endpoint */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Endpoint / Base URL</label>
          <input value={form.endpoint} onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))} placeholder="https://api.example.com"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
        </div>
        {/* Auth type */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Auth Type</label>
          <select value={form.authType} onChange={e => setForm(f => ({ ...f, authType: e.target.value as AuthType }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
            <option value="api_key">API Key</option>
            <option value="bearer_token">Bearer Token</option>
            <option value="basic_auth">Basic Auth</option>
            <option value="none">None</option>
          </select>
        </div>
        {/* API key label */}
        {form.authType !== 'none' && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">API Key Field Label</label>
            <input value={form.apiKeyLabel} onChange={e => setForm(f => ({ ...f, apiKeyLabel: e.target.value }))} placeholder="API Key"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          </div>
        )}
        {/* Storage key */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Storage Key (auto-generated)</label>
          <input value={form.storageKey} onChange={e => setForm(f => ({ ...f, storageKey: e.target.value }))} placeholder="CUSTOM_MY_API"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono" />
        </div>
      </div>

      {/* Purpose */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Purpose</label>
        <textarea value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} rows={2} placeholder="What does this connection do?"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none" />
      </div>

      {/* Fallback */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Fallback</label>
        <input value={form.fallback} onChange={e => setForm(f => ({ ...f, fallback: e.target.value }))} placeholder="What happens if this is unavailable?"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
      </div>

      {/* Assign to agents */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Assign to Agents</label>
        <div className="flex flex-wrap gap-2">
          {ALL_AGENTS.map(agent => (
            <label key={agent.id} className="flex items-center gap-1.5 cursor-pointer text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5">
              <input type="checkbox" checked={form.assignedAgents.includes(agent.id)} onChange={() => toggleAgent(agent.id)} className="rounded" />
              <span>{agent.emoji} {agent.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={handleSave}
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium">
          Save Connection
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── My Connections Panel (User-Scoped) ───────────────────────────────────────

function MyConnectionsPanel({
  connections,
  userStored,
  onConfigureUser,
}: {
  connections: Connection[];
  userStored: Record<string, string>;
  onConfigureUser: (id: string) => void;
}) {
  const userConns = connections.filter(c => c.scope === 'user');
  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40 rounded-lg flex items-start gap-2">
        <User size={14} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-800 dark:text-blue-300">
          <strong>These are your personal API connections.</strong> They apply only to your account and override platform defaults where applicable.
        </p>
      </div>
      <div className="space-y-2">
        {userConns.length === 0 ? (
          <div className="text-center py-10 text-gray-400">No user-scoped connections found.</div>
        ) : (
          userConns.map(conn => {
            const src = userStored;
            const status = deriveStatus(conn, {}, src);
            return (
              <div key={conn.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${status === 'active' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{conn.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{conn.purpose}</p>
                </div>
                <StatusBadge status={status} />
                <button
                  onClick={() => onConfigureUser(conn.id)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 shrink-0"
                >
                  Configure
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Knowledge Sources Panel ──────────────────────────────────────────────────

function KnowledgeSourcesPanel() {
  const [sources, setSources] = useState<KnowledgeSourceConfig[]>(() => krLoadSources());
  const [logStats, setLogStats] = useState(() => getQueryLogStats());
  const [jobStatus, setJobStatus] = useState(() => getIndexingJobStatus());
  const [indexing, setIndexing] = useState(false);
  const [showAddMcp, setShowAddMcp] = useState(false);
  const [showAddApi, setShowAddApi] = useState(false);

  const [mcpForm, setMcpForm] = useState({ displayName: '', mcpEndpoint: '', mcpTool: '', priority: '2' });
  const [apiForm, setApiForm] = useState({ displayName: '', apiEndpoint: '', apiQueryParam: 'q', apiResponsePath: '', priority: '2' });

  const refresh = useCallback(() => {
    setSources(krLoadSources());
    setLogStats(getQueryLogStats());
    setJobStatus(getIndexingJobStatus());
  }, []);

  const handleToggle = (id: string, enabled: boolean) => {
    krToggleSource(id, enabled);
    refresh();
  };

  const handleRemove = (id: string) => {
    if (!confirm(`Remove source "${id}"?`)) return;
    krRemoveSource(id);
    refresh();
  };

  const handleAddMcp = () => {
    if (!mcpForm.displayName || !mcpForm.mcpEndpoint || !mcpForm.mcpTool) return;
    krRegisterSource({
      id: `mcp-${Date.now()}`,
      type: 'custom_mcp',
      displayName: mcpForm.displayName,
      enabled: true,
      priority: parseInt(mcpForm.priority) || 2,
      mcpEndpoint: mcpForm.mcpEndpoint,
      mcpTool: mcpForm.mcpTool,
      minConfidence: 0.6,
      timeoutMs: 8000,
    });
    setMcpForm({ displayName: '', mcpEndpoint: '', mcpTool: '', priority: '2' });
    setShowAddMcp(false);
    refresh();
  };

  const handleAddApi = () => {
    if (!apiForm.displayName || !apiForm.apiEndpoint) return;
    krRegisterSource({
      id: `api-${Date.now()}`,
      type: 'external_api',
      displayName: apiForm.displayName,
      enabled: true,
      priority: parseInt(apiForm.priority) || 2,
      apiEndpoint: apiForm.apiEndpoint,
      apiQueryParam: apiForm.apiQueryParam || 'q',
      apiResponsePath: apiForm.apiResponsePath || undefined,
      minConfidence: 0.6,
      timeoutMs: 8000,
    });
    setApiForm({ displayName: '', apiEndpoint: '', apiQueryParam: 'q', apiResponsePath: '', priority: '2' });
    setShowAddApi(false);
    refresh();
  };

  const handleRunIndexing = async () => {
    setIndexing(true);
    try {
      await runProgressiveIndexing(20);
    } finally {
      setIndexing(false);
      refresh();
    }
  };

  const sourceTypeColor: Record<string, string> = {
    wolfram_api: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    wolfram_mcp: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    custom_mcp: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    external_api: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    static_pyq: 'bg-green-500/10 text-green-400 border-green-500/30',
    rag_supabase: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    llm_fallback: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  };

  return (
    <div className="mt-10 space-y-6">
      <div className="flex items-center gap-3">
        <Network size={20} className="text-purple-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Knowledge Sources</h2>
        <span className="text-xs text-gray-400 ml-auto">Priority chain: Wolfram → MCP → External API → PYQ → RAG → LLM</span>
      </div>

      {/* Sources list */}
      <div className="space-y-2">
        {sources.map((src) => (
          <div key={src.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <span className="text-sm font-mono text-gray-400 w-5 text-center">{src.priority}</span>
            <span className={`px-2 py-0.5 rounded text-xs border ${sourceTypeColor[src.type] ?? 'bg-gray-500/10 text-gray-400 border-gray-500/30'}`}>
              {src.type}
            </span>
            <span className="flex-1 text-sm text-gray-900 dark:text-white font-medium">{src.displayName}</span>
            <span className="text-xs text-gray-400">{src.id}</span>
            <button
              onClick={() => handleToggle(src.id, !src.enabled)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${src.enabled ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/20'}`}
            >
              {src.enabled ? 'Enabled' : 'Disabled'}
            </button>
            {!['wolfram-api-primary', 'static-pyq-bundle', 'rag-supabase-primary', 'llm-fallback'].includes(src.id) && (
              <button onClick={() => handleRemove(src.id)} className="text-red-400 hover:text-red-300 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => { setShowAddMcp(!showAddMcp); setShowAddApi(false); }}
          className="px-4 py-2 text-sm rounded-lg bg-purple-600/10 text-purple-400 border border-purple-500/30 hover:bg-purple-600/20 transition-colors"
        >
          + Add Custom MCP
        </button>
        <button
          onClick={() => { setShowAddApi(!showAddApi); setShowAddMcp(false); }}
          className="px-4 py-2 text-sm rounded-lg bg-blue-600/10 text-blue-400 border border-blue-500/30 hover:bg-blue-600/20 transition-colors"
        >
          + Add External API
        </button>
      </div>

      {/* MCP Form */}
      {showAddMcp && (
        <div className="p-4 rounded-lg border border-purple-500/30 bg-purple-500/5 space-y-3">
          <h3 className="text-sm font-medium text-purple-400">New Custom MCP Source</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Display Name', key: 'displayName', placeholder: 'My MCP Server' },
              { label: 'MCP Endpoint URL', key: 'mcpEndpoint', placeholder: 'http://localhost:3001/mcp' },
              { label: 'Tool Name', key: 'mcpTool', placeholder: 'query_knowledge' },
              { label: 'Priority (1=highest)', key: 'priority', placeholder: '2' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-xs text-gray-400 mb-1">{label}</label>
                <input
                  value={mcpForm[key as keyof typeof mcpForm]}
                  onChange={(e) => setMcpForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-600 bg-gray-900 text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddMcp} className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors">Save MCP Source</button>
            <button onClick={() => setShowAddMcp(false)} className="px-4 py-2 text-sm rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* API Form */}
      {showAddApi && (
        <div className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/5 space-y-3">
          <h3 className="text-sm font-medium text-blue-400">New External API Source</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Display Name', key: 'displayName', placeholder: 'My Knowledge API' },
              { label: 'API Endpoint URL', key: 'apiEndpoint', placeholder: 'https://api.example.com/search' },
              { label: 'Query Param Name', key: 'apiQueryParam', placeholder: 'q' },
              { label: 'Response Path (dot notation)', key: 'apiResponsePath', placeholder: 'data.answer' },
              { label: 'Priority (1=highest)', key: 'priority', placeholder: '2' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-xs text-gray-400 mb-1">{label}</label>
                <input
                  value={apiForm[key as keyof typeof apiForm]}
                  onChange={(e) => setApiForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-600 bg-gray-900 text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddApi} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">Save API Source</button>
            <button onClick={() => setShowAddApi(false)} className="px-4 py-2 text-sm rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* RAG Indexer Status */}
      <div className="p-4 rounded-lg border border-cyan-500/30 bg-cyan-500/5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-cyan-400 flex items-center gap-2">
            <GraduationCap size={14} /> RAG Indexer — Progressive Knowledge Growth
          </h3>
          <button onClick={refresh} className="text-xs text-gray-400 hover:text-gray-200 transition-colors">↻ Refresh</button>
        </div>

        {/* Query log stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Queries Logged', value: logStats.total },
            { label: 'Pending Embedding', value: logStats.pendingEmbedding },
            { label: 'Embedded in RAG', value: logStats.embedded },
          ].map(({ label, value }) => (
            <div key={label} className="p-3 rounded-lg bg-gray-800/60 text-center">
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-gray-400 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Job status */}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>Status: <span className={`font-medium ${jobStatus.status === 'running' ? 'text-yellow-400' : jobStatus.status === 'done' ? 'text-green-400' : 'text-gray-400'}`}>{jobStatus.status}</span></span>
          {jobStatus.lastRun && <span>Last run: {new Date(jobStatus.lastRun).toLocaleTimeString()}</span>}
          {jobStatus.nextRun && <span>Next run: {new Date(jobStatus.nextRun).toLocaleTimeString()}</span>}
          <span>Processed: {jobStatus.processed} | Errors: {jobStatus.errors}</span>
        </div>

        <button
          onClick={handleRunIndexing}
          disabled={indexing}
          className="px-4 py-2 text-sm rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {indexing ? '⏳ Indexing...' : '▶ Run Indexing Now'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ConnectionRegistry() {
  const { userRole } = useAppStore();
  const canEdit = userRole === 'admin' || userRole === 'ceo';

  const [stored, setStored] = useState<Record<string, string>>(loadStoredValues);
  const [userStored, setUserStored] = useState<Record<string, string>>(loadUserStoredValues);
  const [customConns, setCustomConns] = useState<Connection[]>(loadCustomConnections);
  const [configureId, setConfigureId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [mandatoryOnly, setMandatoryOnly] = useState(false);
  const [examScopedOnly, setExamScopedOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'exam-instance' | 'my-connections' | 'add-connection'>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | ConnectionScope>('all');

  // Inline exam-key edit modal
  const [examKeyModal, setExamKeyModal] = useState<{
    key: string; label: string; value: string; isPassword: boolean;
  } | null>(null);

  // Listen to storage changes (platform + user)
  useEffect(() => {
    const handler = () => {
      setStored(loadStoredValues());
      setUserStored(loadUserStoredValues());
      setCustomConns(loadCustomConnections());
    };
    window.addEventListener('storage', handler);
    window.addEventListener('edugenius_custom_updated', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('edugenius_custom_updated', handler);
    };
  }, []);

  // All connections = REGISTRY + custom
  const allConnections = useMemo<Connection[]>(() => {
    const customIds = new Set(customConns.map(c => c.id));
    return [...REGISTRY.filter(c => !customIds.has(c.id)), ...customConns];
  }, [customConns]);

  const categories = useMemo(() =>
    ['All', ...Array.from(new Set(allConnections.map(c => c.category)))],
    [allConnections]
  );

  const filtered = useMemo(() => allConnections.filter(c => {
    const status = deriveStatus(c, stored, userStored);
    if (scopeFilter !== 'all' && c.scope !== scopeFilter) return false;
    if (categoryFilter !== 'All' && c.category !== categoryFilter) return false;
    if (statusFilter === 'active'   && status !== 'active')  return false;
    if (statusFilter === 'inactive' && status === 'active')  return false;
    if (mandatoryOnly && !c.mandatory) return false;
    if (examScopedOnly && !c.examScoped) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) ||
             c.category.toLowerCase().includes(q) ||
             c.purpose.toLowerCase().includes(q) ||
             c.tags.some(t => t.includes(q)) ||
             c.impactedAgents.some(a =>
               a.name.toLowerCase().includes(q) || a.subAgents.some(s => s.toLowerCase().includes(q))
             );
    }
    return true;
  }), [allConnections, stored, userStored, scopeFilter, categoryFilter, statusFilter, mandatoryOnly, examScopedOnly, search]);

  const stats = useMemo(() => {
    const active        = allConnections.filter(c => deriveStatus(c, stored, userStored) === 'active').length;
    const mandatory     = allConnections.filter(c => c.mandatory).length;
    const mandatoryDone = allConnections.filter(c => c.mandatory && deriveStatus(c, stored, userStored) === 'active').length;
    const examScoped    = allConnections.filter(c => c.examScoped).length;
    const userCount     = allConnections.filter(c => c.scope === 'user').length;
    let examConfigured = 0;
    let examTotal = 0;
    for (const conn of allConnections.filter(c => c.examScoped)) {
      for (const f of conn.fields.filter(f => f.examScoped)) {
        for (const exam of EXAM_TYPES) {
          examTotal++;
          if (stored[examKey(f.key, exam)]) examConfigured++;
        }
      }
    }
    return { total: allConnections.length, active, mandatory, mandatoryDone, examScoped, examConfigured, examTotal, userCount };
  }, [allConnections, stored, userStored]);

  function handleSave(id: string, vals: Record<string, string>) {
    // Check if this is a user-scoped connection
    const conn = allConnections.find(c => c.id === id);
    if (conn?.scope === 'user') {
      const updated = { ...userStored, ...vals };
      setUserStored(updated);
      saveUserStoredValues(updated);
    } else {
      const updated = { ...stored, ...vals };
      setStored(updated);
      saveStoredValues(updated);
      Object.entries(vals).forEach(([k, v]) => {
        if (k.startsWith('VITE_') && (window as any).__env) {
          (window as any).__env[k] = v;
        }
      });
    }
  }

  function handleExamKeySave(key: string, value: string) {
    const updated = { ...stored, [key]: value };
    setStored(updated);
    saveStoredValues(updated);
  }

  function handleAddCustomConnection(conn: Connection) {
    saveCustomConnection(conn);
    setCustomConns(loadCustomConnections());
    setViewMode('all');
  }

  function handleDeleteCustomConnection(id: string) {
    deleteCustomConnection(id);
    setCustomConns(loadCustomConnections());
  }

  const configConn = allConnections.find(c => c.id === configureId) || null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Connection Registry</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Source of truth for all external API, MCP, and infrastructure connections. 3-tier scope: Platform · Exam · User.
          {canEdit ? ' Configure here to propagate to all agents.' : ' Read-only view — My Connections tab is yours to configure.'}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-700 dark:text-gray-300' },
          { label: 'Active', value: stats.active, color: 'text-green-600 dark:text-green-400' },
          { label: 'Mandatory', value: `${stats.mandatoryDone}/${stats.mandatory}`, color: stats.mandatoryDone === stats.mandatory ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' },
          { label: 'Exam-Scoped', value: stats.examScoped, color: 'text-purple-600 dark:text-purple-400' },
          { label: 'My Connections', value: stats.userCount, color: 'text-blue-600 dark:text-blue-400' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setViewMode('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'all' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
          All Connections
        </button>
        <button onClick={() => setViewMode('exam-instance')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'exam-instance' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
          <Layers size={14} /> Per-Exam Instances
          {stats.examConfigured < stats.examTotal && (
            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">{stats.examTotal - stats.examConfigured} missing</span>
          )}
        </button>
        {/* My Connections — visible to all roles */}
        <button onClick={() => setViewMode('my-connections')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'my-connections' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
          <User size={14} /> My Connections
        </button>
        {/* Add Connection */}
        <button onClick={() => setViewMode(viewMode === 'add-connection' ? 'all' : 'add-connection')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'add-connection' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-emerald-600 dark:text-emerald-400'}`}>
          <Plus size={14} /> Add Connection
        </button>
      </div>

      {/* Add Connection Form */}
      {viewMode === 'add-connection' && (
        <AddConnectionForm
          existingCategories={categories.filter(c => c !== 'All')}
          onSave={handleAddCustomConnection}
          onCancel={() => setViewMode('all')}
        />
      )}

      {/* Exam Instance Panel */}
      {viewMode === 'exam-instance' && (
        <ExamInstancePanel
          stored={stored}
          canEdit={canEdit}
          onEditExamKey={(key, label, value) => setExamKeyModal({
            key, label, value,
            isPassword: allConnections.flatMap(c => c.fields).find(f => key.startsWith(f.key))?.type === 'password',
          })}
        />
      )}

      {/* My Connections Panel */}
      {viewMode === 'my-connections' && (
        <MyConnectionsPanel
          connections={allConnections}
          userStored={userStored}
          onConfigureUser={setConfigureId}
        />
      )}

      {/* All Connections view */}
      {viewMode === 'all' && (
        <>
          {/* Scope tabs */}
          <div className="flex gap-1 flex-wrap">
            {(['all', 'platform', 'exam', 'user'] as const).map(s => (
              <button key={s} onClick={() => setScopeFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  scopeFilter === s
                    ? s === 'all' ? 'bg-gray-700 text-white'
                      : s === 'platform' ? 'bg-gray-600 text-white'
                      : s === 'exam' ? 'bg-purple-600 text-white'
                      : 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}>
                {s === 'all' ? 'All Scopes' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search connections, agents, env vars..."
                className="pl-8 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-64 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Not Configured</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={mandatoryOnly} onChange={e => setMandatoryOnly(e.target.checked)} className="rounded" />
              Mandatory only
            </label>
            <label className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 cursor-pointer">
              <input type="checkbox" checked={examScopedOnly} onChange={e => setExamScopedOnly(e.target.checked)} className="rounded" />
              Exam-scoped only
            </label>
            <span className="text-xs text-gray-400 ml-auto">{filtered.length} of {allConnections.length}</span>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Mandatory</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 inline-block" /> Optional</span>
            <span className="flex items-center gap-1 text-purple-500"><Layers size={10} /> Exam-Scoped</span>
            <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">[Platform]</span>
            <span className="flex items-center gap-1 text-purple-500">[Exam]</span>
            <span className="flex items-center gap-1 text-blue-500">[User]</span>
            <span className="flex items-center gap-1 text-emerald-500">[Custom]</span>
            <span className="flex items-center gap-1 ml-auto text-amber-600 dark:text-amber-400">
              <Info size={12} /> Values saved here propagate to all agents
            </span>
          </div>

          {/* Cards */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-600">No connections match your filters</div>
            ) : (
              filtered.map(conn => (
                <ConnectionCard
                  key={conn.id}
                  conn={conn}
                  stored={stored}
                  userStored={userStored}
                  canEdit={canEdit || conn.scope === 'user'}
                  showScopeBadge
                  onConfigure={setConfigureId}
                  onDelete={conn.isCustom ? handleDeleteCustomConnection : undefined}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Configure Modal */}
      {configConn && (
        <ConfigureModal
          conn={configConn}
          stored={configConn.scope === 'user' ? userStored : stored}
          onSave={(vals) => handleSave(configConn.id, vals)}
          onClose={() => setConfigureId(null)}
        />
      )}

      {/* Exam Key Edit Modal */}
      {examKeyModal && (
        <KeyEditModal
          label={examKeyModal.label}
          envKey={examKeyModal.key}
          currentValue={examKeyModal.value}
          isPassword={examKeyModal.isPassword ?? false}
          onSave={(v) => handleExamKeySave(examKeyModal.key, v)}
          onClose={() => setExamKeyModal(null)}
        />
      )}

      {/* Knowledge Sources Panel */}
      <KnowledgeSourcesPanel />
    </div>
  );
}

export default ConnectionRegistry;
