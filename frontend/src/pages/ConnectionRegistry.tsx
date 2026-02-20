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

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, ChevronDown, ChevronRight, ExternalLink,
  CheckCircle2, XCircle, AlertTriangle, Clock,
  Eye, EyeOff, Copy, X, Info, Network, Bot, Shield,
  Layers, GraduationCap,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

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

type ConnStatus  = 'active' | 'inactive' | 'error' | 'pending';
type ConnType    = 'api' | 'mcp' | 'webhook' | 'oauth' | 'database';
type ImpactLevel = 'critical' | 'high' | 'medium' | 'low';

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
  /** If true, the whole connection can be configured per-exam */
  examScoped?: boolean;
  impactedAgents: ImpactedAgent[];
  fields: ConnField[];
  docsUrl?: string; mcpEndpoint?: string; tags: string[];
}

// ─── Static Registry ──────────────────────────────────────────────────────────

const REGISTRY: Connection[] = [

  /* ══════════════════════════════════════════════════════════════════════════ */
  /* AI Providers                                                               */
  /* ══════════════════════════════════════════════════════════════════════════ */
  {
    id:'gemini', name:'Google Gemini', type:'api', category:'AI Providers', mandatory:true, status:'inactive',
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
    id:'anthropic', name:'Anthropic Claude', type:'api', category:'AI Providers', mandatory:false, status:'inactive',
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
    id:'learnlm', name:'Google LearnLM', type:'api', category:'AI Providers', mandatory:false, status:'inactive',
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
    id:'groq', name:'Groq', type:'api', category:'AI Providers', mandatory:false, status:'inactive',
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
    id:'openai', name:'OpenAI GPT', type:'api', category:'AI Providers', mandatory:false, status:'inactive',
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
    id:'wolfram', name:'Wolfram Alpha', type:'api', category:'Content Verification', mandatory:false, status:'inactive',
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
    id:'sympy', name:'SymPy Cloud', type:'api', category:'Content Verification', mandatory:false, status:'inactive',
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
    id:'postgres', name:'PostgreSQL', type:'database', category:'Database', mandatory:true, status:'inactive',
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
    id:'supabase', name:'Supabase', type:'database', category:'Database', mandatory:false, status:'inactive',
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
    id:'redis', name:'Redis', type:'database', category:'Database', mandatory:false, status:'inactive',
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
    id:'jwt', name:'JWT Secret', type:'api', category:'Authentication', mandatory:true, status:'inactive',
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
    id:'google-oauth', name:'Google OAuth 2.0', type:'oauth', category:'Authentication', mandatory:false, status:'inactive',
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
    id:'razorpay', name:'Razorpay', type:'api', category:'Payments', mandatory:false, status:'inactive',
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
    id:'stripe', name:'Stripe', type:'api', category:'Payments', mandatory:false, status:'inactive',
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
    id:'sendgrid', name:'SendGrid', type:'api', category:'Email', mandatory:false, status:'inactive',
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
    id:'resend', name:'Resend', type:'api', category:'Email', mandatory:false, status:'inactive',
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
    id:'whatsapp', name:'WhatsApp Business', type:'api', category:'Chat Channels', mandatory:false, status:'inactive',
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
    id:'telegram', name:'Telegram Bot', type:'api', category:'Chat Channels', mandatory:false, status:'inactive',
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
    id:'ga4', name:'Google Analytics 4', type:'api', category:'Analytics', mandatory:false, status:'inactive',
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
    id:'mixpanel', name:'Mixpanel', type:'api', category:'Analytics', mandatory:false, status:'inactive',
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
    id:'pinecone', name:'Pinecone', type:'api', category:'Vector Store', mandatory:false, status:'inactive',
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
    id:'qdrant', name:'Qdrant', type:'api', category:'Vector Store', mandatory:false, status:'inactive',
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
    id:'s3', name:'AWS S3 / Cloudflare R2', type:'api', category:'Storage', mandatory:false, status:'inactive',
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
    id:'mcp-wolfram', name:'Wolfram MCP Server', type:'mcp', category:'MCP Servers', mandatory:false, status:'inactive',
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
    id:'mcp-filesystem', name:'Filesystem MCP Server', type:'mcp', category:'MCP Servers', mandatory:false, status:'inactive',
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
    id:'mcp-browser', name:'Browser / Puppeteer MCP', type:'mcp', category:'MCP Servers', mandatory:false, status:'inactive',
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

const STORAGE_KEY = 'edugenius_connections';

function loadStoredValues(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function saveStoredValues(vals: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vals));
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(vals) }));
}

function deriveStatus(conn: Connection, stored: Record<string, string>): ConnStatus {
  const required = conn.fields.filter(f => f.required && !f.examScoped);
  if (required.length === 0) return conn.status;
  const allFilled = required.every(f => !!stored[f.key]);
  return allFilled ? 'active' : 'inactive';
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
  conn, stored, canEdit, onConfigure,
}: {
  conn: Connection; stored: Record<string, string>;
  canEdit: boolean; onConfigure: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = deriveStatus(conn, stored);

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
            {conn.mandatory && (
              <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">MANDATORY</span>
            )}
            {conn.examScoped && (
              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 flex items-center gap-0.5">
                <Layers size={10} /> EXAM-SCOPED
              </span>
            )}
            <StatusBadge status={status} />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{conn.purpose}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <button onClick={() => onConfigure(conn.id)}
              className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700">
              {status === 'active' ? 'Edit' : 'Configure'}
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

          <div>
            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
              <Bot size={12} /> IMPACTED AGENTS & SUB-AGENTS
            </p>
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
          </div>

          <div>
            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">ENV VARIABLES</p>
            <div className="flex flex-wrap gap-1">
              {conn.fields.map(f => (
                <span key={f.key} className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                  f.examScoped
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    : stored[f.key]
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ConnectionRegistry() {
  const { userRole } = useAppStore();
  const canEdit = userRole === 'admin' || userRole === 'ceo';

  const [stored, setStored] = useState<Record<string, string>>(loadStoredValues);
  const [configureId, setConfigureId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [mandatoryOnly, setMandatoryOnly] = useState(false);
  const [examScopedOnly, setExamScopedOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'exam-instance'>('all');

  // Inline exam-key edit modal
  const [examKeyModal, setExamKeyModal] = useState<{
    key: string; label: string; value: string; isPassword: boolean;
  } | null>(null);

  useEffect(() => {
    const handler = () => setStored(loadStoredValues());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const categories = useMemo(() => ['All', ...Array.from(new Set(REGISTRY.map(c => c.category)))], []);

  const filtered = useMemo(() => REGISTRY.filter(c => {
    const status = deriveStatus(c, stored);
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
  }), [stored, categoryFilter, statusFilter, mandatoryOnly, examScopedOnly, search]);

  const stats = useMemo(() => {
    const active        = REGISTRY.filter(c => deriveStatus(c, stored) === 'active').length;
    const mandatory     = REGISTRY.filter(c => c.mandatory).length;
    const mandatoryDone = REGISTRY.filter(c => c.mandatory && deriveStatus(c, stored) === 'active').length;
    const examScoped    = REGISTRY.filter(c => c.examScoped).length;
    // count exam-scoped fields configured across all exams
    let examConfigured = 0;
    let examTotal = 0;
    for (const conn of REGISTRY.filter(c => c.examScoped)) {
      for (const f of conn.fields.filter(f => f.examScoped)) {
        for (const exam of EXAM_TYPES) {
          examTotal++;
          if (stored[examKey(f.key, exam)]) examConfigured++;
        }
      }
    }
    return { total: REGISTRY.length, active, mandatory, mandatoryDone, examScoped, examConfigured, examTotal };
  }, [stored]);

  function handleSave(id: string, vals: Record<string, string>) {
    const updated = { ...stored, ...vals };
    setStored(updated);
    saveStoredValues(updated);
    Object.entries(vals).forEach(([k, v]) => {
      if (k.startsWith('VITE_') && (window as any).__env) {
        (window as any).__env[k] = v;
      }
    });
  }

  function handleExamKeySave(key: string, value: string) {
    const updated = { ...stored, [key]: value };
    setStored(updated);
    saveStoredValues(updated);
  }

  const configConn = REGISTRY.find(c => c.id === configureId) || null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Connection Registry</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Source of truth for all external API, MCP, and infrastructure connections. Supports one instance per examination.
          {canEdit ? ' Configure here to propagate to all agents.' : ' Read-only view.'}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-700 dark:text-gray-300' },
          { label: 'Active', value: stats.active, color: 'text-green-600 dark:text-green-400' },
          { label: 'Mandatory', value: `${stats.mandatoryDone}/${stats.mandatory}`, color: stats.mandatoryDone === stats.mandatory ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' },
          { label: 'Exam-Scoped', value: stats.examScoped, color: 'text-purple-600 dark:text-purple-400' },
          { label: 'Exam Keys Set', value: `${stats.examConfigured}/${stats.examTotal}`, color: stats.examConfigured > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'all' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}
        >
          All Connections
        </button>
        <button
          onClick={() => setViewMode('exam-instance')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'exam-instance' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}
        >
          <Layers size={14} /> Per-Exam Instances
          {stats.examConfigured < stats.examTotal && (
            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">{stats.examTotal - stats.examConfigured} missing</span>
          )}
        </button>
      </div>

      {/* Exam Instance Panel */}
      {viewMode === 'exam-instance' && (
        <ExamInstancePanel
          stored={stored}
          canEdit={canEdit}
          onEditExamKey={(key, label, value) => setExamKeyModal({
            key, label, value,
            isPassword: REGISTRY.flatMap(c => c.fields).find(f => key.startsWith(f.key))?.type === 'password',
          })}
        />
      )}

      {/* Filters (only in all-connections view) */}
      {viewMode === 'all' && (
        <>
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
            <span className="text-xs text-gray-400 ml-auto">{filtered.length} of {REGISTRY.length}</span>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Mandatory</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 inline-block" /> Optional</span>
            <span className="flex items-center gap-1 text-purple-500"><Layers size={10} /> Exam-Scoped (one instance per exam)</span>
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
                  canEdit={canEdit}
                  onConfigure={setConfigureId}
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
          stored={stored}
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
    </div>
  );
}

export default ConnectionRegistry;
