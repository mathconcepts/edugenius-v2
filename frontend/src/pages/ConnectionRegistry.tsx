/**
 * ConnectionRegistry.tsx — Central API / MCP Connection Hub
 *
 * ✅ Mandatory vs Optional  ✅ Purpose + Fallback + Impacted Agents/Sub-agents
 * ✅ MCP endpoint support   ✅ Bidirectional localStorage sync
 * ✅ All roles can read; CEO/Admin can configure
 * ✅ Category filter, search, status summary
 * ✅ Entering a key here → saved to localStorage → read by llmService / runtime
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, ChevronDown, ChevronRight, ExternalLink,
  CheckCircle2, XCircle, AlertTriangle, Clock,
  Eye, EyeOff, Copy, X, Info, Network, Bot, Shield,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnStatus  = 'active' | 'inactive' | 'error' | 'pending';
type ConnType    = 'api' | 'mcp' | 'webhook' | 'oauth' | 'database';
type ImpactLevel = 'critical' | 'high' | 'medium' | 'low';

interface ConnField {
  key: string; label: string;
  type: 'text' | 'password' | 'url' | 'select';
  placeholder?: string; required: boolean; hint?: string;
  options?: { value: string; label: string }[];
}
interface ImpactedAgent {
  id: string; name: string; emoji: string;
  subAgents: string[]; impact: ImpactLevel;
}
interface Connection {
  id: string; name: string; type: ConnType; category: string;
  mandatory: boolean; status: ConnStatus;
  purpose: string; fallback: string;
  impactedAgents: ImpactedAgent[];
  fields: ConnField[];
  docsUrl?: string; mcpEndpoint?: string; tags: string[];
}

// ─── Static Registry ──────────────────────────────────────────────────────────

const REGISTRY: Connection[] = [
  /* ── AI Providers ──────────────────────────────────────────────────────── */
  { id:'gemini', name:'Google Gemini', type:'api', category:'AI Providers', mandatory:true, status:'inactive',
    purpose:'Primary LLM for all tutoring, content generation, exam insights, and agent reasoning. ~80% of AI calls.',
    fallback:'Chain: Anthropic → OpenAI → Groq → Ollama. If all absent → demo mock mode.',
    tags:['llm','core'],
    impactedAgents:[
      {id:'sage',   name:'Sage',   emoji:'🧠', impact:'critical', subAgents:['Socratic Tutor','Doubt Resolver','Concept Explainer','Step Validator']},
      {id:'atlas',  name:'Atlas',  emoji:'📚', impact:'critical', subAgents:['Content Writer','Question Generator','Translator','Quality Checker']},
      {id:'mentor', name:'Mentor', emoji:'🎯', impact:'high',     subAgents:['Study Planner','Motivation Coach','Progress Reporter']},
      {id:'herald', name:'Herald', emoji:'📣', impact:'high',     subAgents:['Blog Writer','Social Media Manager','Newsletter Manager']},
      {id:'scout',  name:'Scout',  emoji:'🔍', impact:'medium',   subAgents:['Market Analyst','Competitor Watcher']},
    ],
    fields:[{key:'VITE_GEMINI_API_KEY', label:'Gemini API Key', type:'password', placeholder:'AIza...', required:true, hint:'aistudio.google.com → Get API key (free tier available)'}],
    docsUrl:'https://aistudio.google.com/',
  },
  { id:'anthropic', name:'Anthropic Claude', type:'api', category:'AI Providers', mandatory:false, status:'inactive',
    purpose:'High-quality LLM fallback for complex reasoning, multi-step proofs, and code-heavy tasks.',
    fallback:'Falls back to Gemini 1.5 Pro. Quality difference noticeable for hardest JEE problems.',
    tags:['llm'],
    impactedAgents:[
      {id:'sage',  name:'Sage',  emoji:'🧠', impact:'high',   subAgents:['Hard Problem Solver','Step Explainer']},
      {id:'forge', name:'Forge', emoji:'⚙️', impact:'medium', subAgents:['Code Reviewer']},
    ],
    fields:[{key:'VITE_ANTHROPIC_API_KEY', label:'API Key', type:'password', placeholder:'sk-ant-...', required:true, hint:'console.anthropic.com'}],
    docsUrl:'https://console.anthropic.com/',
  },
  { id:'learnlm', name:'Google LearnLM', type:'api', category:'AI Providers', mandatory:false, status:'inactive',
    purpose:'Pedagogically-optimized model for Socratic tutoring — calibrates explanations to student level, prefers guiding questions over direct answers.',
    fallback:'Gemini 1.5 Pro with custom pedagogy system prompt. ~85% behaviour preserved.',
    tags:['llm','education'],
    impactedAgents:[
      {id:'sage', name:'Sage', emoji:'🧠', impact:'high', subAgents:['Socratic Tutor','Concept Explainer','Doubt Resolver']},
    ],
    fields:[{key:'LEARNLM_API_KEY', label:'API Key (same as Gemini)', type:'password', placeholder:'AIza...', required:true, hint:'LearnLM uses Gemini API auth — same key as Gemini'}],
    docsUrl:'https://ai.google.dev/gemini-api/docs/learnlm',
  },
  { id:'groq', name:'Groq', type:'api', category:'AI Providers', mandatory:false, status:'inactive',
    purpose:'Ultra-fast inference (Llama 3, Mixtral). Latency-sensitive features: live typing hints, real-time suggestions.',
    fallback:'Gemini Flash. Live-feature latency increases ~200-400ms.',
    tags:['llm','fast'],
    impactedAgents:[
      {id:'sage',   name:'Sage',   emoji:'🧠', impact:'medium', subAgents:['Real-Time Hint Generator']},
      {id:'mentor', name:'Mentor', emoji:'🎯', impact:'low',    subAgents:[]},
    ],
    fields:[{key:'GROQ_API_KEY', label:'API Key', type:'password', placeholder:'gsk_...', required:true, hint:'console.groq.com — generous free tier'}],
    docsUrl:'https://console.groq.com/',
  },
  { id:'openai', name:'OpenAI GPT', type:'api', category:'AI Providers', mandatory:false, status:'inactive',
    purpose:'Tertiary LLM + embeddings (text-embedding-3-small) when Pinecone is active.',
    fallback:'Embeddings → local sentence-transformers. Chat → Gemini.',
    tags:['llm','embeddings'],
    impactedAgents:[
      {id:'atlas',  name:'Atlas',  emoji:'📚', impact:'medium', subAgents:['Curriculum Mapper','Quality Checker']},
      {id:'oracle', name:'Oracle', emoji:'📊', impact:'low',    subAgents:['Insight Generator']},
    ],
    fields:[{key:'VITE_OPENAI_API_KEY', label:'API Key', type:'password', placeholder:'sk-...', required:true, hint:'platform.openai.com'}],
    docsUrl:'https://platform.openai.com/',
  },

  /* ── Content Verification ────────────────────────────────────────────────── */
  { id:'wolfram', name:'Wolfram Alpha', type:'api', category:'Content Verification', mandatory:false, status:'inactive',
    purpose:'Ground-truth math/science verification. Cross-checks LLM solutions before showing to students. Critical for JEE/NEET accuracy.',
    fallback:'SymPy → LLM consensus. Accuracy drops ~15% on complex integrals/DEs.',
    tags:['verification','math'],
    impactedAgents:[
      {id:'sage',  name:'Sage',  emoji:'🧠', impact:'high',   subAgents:['Answer Verifier','Step Validator','Hard Problem Solver']},
      {id:'atlas', name:'Atlas', emoji:'📚', impact:'medium', subAgents:['Quality Checker']},
    ],
    fields:[{key:'WOLFRAM_APP_ID', label:'App ID', type:'password', placeholder:'XXXXX-XXXXXXXXXX', required:true, hint:'developer.wolframalpha.com → My Apps → Get an App ID'}],
    docsUrl:'https://developer.wolframalpha.com/',
  },
  { id:'sympy', name:'SymPy Cloud', type:'api', category:'Content Verification', mandatory:false, status:'inactive',
    purpose:'Symbolic math engine. Verifies algebra, calculus, equations when Wolfram unavailable.',
    fallback:'LLM consensus verification only. Recommend Wolfram OR SymPy for any math exam.',
    tags:['verification','math'],
    impactedAgents:[
      {id:'sage', name:'Sage', emoji:'🧠', impact:'medium', subAgents:['Answer Verifier','Step Validator']},
    ],
    fields:[
      {key:'SYMPY_ENDPOINT', label:'Endpoint URL', type:'url',      placeholder:'https://...', required:true},
      {key:'SYMPY_API_KEY',  label:'API Key',      type:'password', placeholder:'Optional',    required:false},
    ],
  },

  /* ── Database ────────────────────────────────────────────────────────────── */
  { id:'postgres', name:'PostgreSQL', type:'database', category:'Database', mandatory:true, status:'inactive',
    purpose:'Primary data store — users, exams, content, progress, payments, feedback, agent logs.',
    fallback:'No fallback. Platform cannot run without a database. Quickstart: neon.tech (free).',
    tags:['database','core'],
    impactedAgents:[
      {id:'forge',  name:'Forge',  emoji:'⚙️', impact:'critical', subAgents:['DB Migrator','Backup Manager']},
      {id:'oracle', name:'Oracle', emoji:'📊', impact:'critical', subAgents:['Analytics Engine','Report Builder']},
      {id:'sage',   name:'Sage',   emoji:'🧠', impact:'critical', subAgents:['Progress Tracker','History Manager']},
      {id:'mentor', name:'Mentor', emoji:'🎯', impact:'high',     subAgents:['Study Planner']},
      {id:'herald', name:'Herald', emoji:'📣', impact:'high',     subAgents:['Subscription Manager']},
    ],
    fields:[
      {key:'DATABASE_URL', label:'Connection URL', type:'password', placeholder:'postgres://user:pass@host:5432/edugenius', required:true, hint:'Free DB at neon.tech'},
      {key:'POSTGRES_SSL', label:'SSL Mode', type:'select', required:false, options:[{value:'false',label:'Disabled (local dev)'},{value:'true',label:'Enabled (production)'}]},
    ],
    docsUrl:'https://neon.tech/',
  },
  { id:'redis', name:'Redis', type:'database', category:'Database', mandatory:false, status:'inactive',
    purpose:'Caching + queuing: session tokens, rate limits, agent job queues, frequent exam data. Cuts DB load ~60%.',
    fallback:'In-memory cache per-process (not shared, lost on restart). Fine for single-server dev.',
    tags:['database','cache'],
    impactedAgents:[
      {id:'forge',  name:'Forge',  emoji:'⚙️', impact:'medium', subAgents:['Queue Manager','Rate Limiter']},
      {id:'sage',   name:'Sage',   emoji:'🧠', impact:'low',    subAgents:[]},
      {id:'oracle', name:'Oracle', emoji:'📊', impact:'low',    subAgents:[]},
    ],
    fields:[{key:'REDIS_URL', label:'Redis URL', type:'password', placeholder:'redis://localhost:6379', required:true, hint:'Free: redis.io/try-free (Redis Cloud)'}],
    docsUrl:'https://redis.io/try-free/',
  },

  /* ── Auth ────────────────────────────────────────────────────────────────── */
  { id:'jwt', name:'JWT Secret', type:'api', category:'Authentication', mandatory:true, status:'inactive',
    purpose:'Signs and verifies all user session tokens. Every authenticated endpoint depends on this.',
    fallback:'No fallback. Without this, no user can log in.',
    tags:['auth','security','core'],
    impactedAgents:[
      {id:'forge', name:'Forge', emoji:'⚙️', impact:'critical', subAgents:['Auth Guard','Session Manager','Token Refresher']},
    ],
    fields:[{key:'JWT_SECRET', label:'Secret (64+ chars)', type:'password', placeholder:'Generate: openssl rand -hex 32', required:true, hint:'Run: openssl rand -hex 32 in terminal'}],
  },
  { id:'google-oauth', name:'Google OAuth 2.0', type:'oauth', category:'Authentication', mandatory:false, status:'inactive',
    purpose:'"Sign in with Google" for students and teachers. Also enables Google Meet live classes.',
    fallback:'Email/password login still works. Google Meet live sessions require this.',
    tags:['auth','oauth'],
    impactedAgents:[
      {id:'mentor', name:'Mentor', emoji:'🎯', impact:'medium', subAgents:['Calendar Sync','Meet Session Manager']},
    ],
    fields:[
      {key:'GOOGLE_CLIENT_ID',     label:'Client ID',     type:'text',     placeholder:'xxx.apps.googleusercontent.com', required:true},
      {key:'GOOGLE_CLIENT_SECRET', label:'Client Secret', type:'password', placeholder:'GOCSPX-...', required:true},
      {key:'GOOGLE_REDIRECT_URI',  label:'Redirect URI',  type:'url',      placeholder:'https://yourdomain.com/auth/google/callback', required:true},
    ],
    docsUrl:'https://console.cloud.google.com/apis/credentials',
  },

  /* ── Payments ────────────────────────────────────────────────────────────── */
  { id:'stripe', name:'Stripe', type:'api', category:'Payments', mandatory:false, status:'inactive',
    purpose:'International payments: credit/debit cards, Apple Pay, Google Pay, SEPA. Subscription management for global students.',
    fallback:'Razorpay for India-only payments. Disable if India-only launch for now.',
    tags:['payments','international'],
    impactedAgents:[
      {id:'herald', name:'Herald', emoji:'📣', impact:'high',   subAgents:['Subscription Manager','Revenue Tracker','Churn Predictor']},
      {id:'oracle', name:'Oracle', emoji:'📊', impact:'medium', subAgents:['Revenue Analytics']},
      {id:'scout',  name:'Scout',  emoji:'🔍', impact:'low',    subAgents:['Pricing Optimizer']},
    ],
    fields:[
      {key:'STRIPE_PUBLISHABLE_KEY',      label:'Publishable Key',          type:'text',     placeholder:'pk_live_...', required:true},
      {key:'STRIPE_SECRET_KEY',           label:'Secret Key',               type:'password', placeholder:'sk_live_...', required:true},
      {key:'STRIPE_WEBHOOK_SECRET',       label:'Webhook Secret',           type:'password', placeholder:'whsec_...',   required:true, hint:'Stripe Dashboard → Developers → Webhooks'},
      {key:'VITE_STRIPE_PUBLISHABLE_KEY', label:'Frontend Publishable Key', type:'text',     placeholder:'pk_live_...', required:true, hint:'Same value — needed in browser too'},
    ],
    docsUrl:'https://dashboard.stripe.com/',
  },
  { id:'razorpay', name:'Razorpay', type:'api', category:'Payments', mandatory:false, status:'inactive',
    purpose:'India-first gateway: UPI, NetBanking, Cards, Wallets, EMI. Essential for Indian student market.',
    fallback:'Stripe for non-UPI payments. No UPI support without Razorpay.',
    tags:['payments','india','upi'],
    impactedAgents:[
      {id:'herald', name:'Herald', emoji:'📣', impact:'high',   subAgents:['Subscription Manager','Revenue Tracker']},
      {id:'oracle', name:'Oracle', emoji:'📊', impact:'medium', subAgents:['Revenue Analytics']},
      {id:'scout',  name:'Scout',  emoji:'🔍', impact:'low',    subAgents:['Pricing Optimizer']},
    ],
    fields:[
      {key:'RAZORPAY_KEY_ID',          label:'Key ID',               type:'text',     placeholder:'rzp_live_...', required:true},
      {key:'RAZORPAY_KEY_SECRET',      label:'Key Secret',           type:'password', placeholder:'',             required:true},
      {key:'RAZORPAY_WEBHOOK_SECRET',  label:'Webhook Secret',       type:'password', placeholder:'',             required:true},
      {key:'VITE_RAZORPAY_KEY_ID',     label:'Frontend Key ID',      type:'text',     placeholder:'rzp_live_...', required:true, hint:'Safe to expose on frontend'},
    ],
    docsUrl:'https://dashboard.razorpay.com/',
  },

  /* ── Email ───────────────────────────────────────────────────────────────── */
  { id:'sendgrid', name:'SendGrid', type:'api', category:'Email', mandatory:false, status:'inactive',
    purpose:'Transactional email: OTP codes, welcome emails, study reminders, subscription receipts, progress reports.',
    fallback:'Resend → SMTP fallback chain. Deliverability lower without proper SPF/DKIM.',
    tags:['email','notifications'],
    impactedAgents:[
      {id:'mentor', name:'Mentor', emoji:'🎯', impact:'high',   subAgents:['Study Reminder','Streak Coach','Progress Reporter']},
      {id:'herald', name:'Herald', emoji:'📣', impact:'medium', subAgents:['Newsletter Manager','Subscription Notifier']},
    ],
    fields:[{key:'SENDGRID_API_KEY', label:'API Key', type:'password', placeholder:'SG...', required:true, hint:'app.sendgrid.com → Settings → API Keys'}],
    docsUrl:'https://app.sendgrid.com/',
  },
  { id:'resend', name:'Resend', type:'api', category:'Email', mandatory:false, status:'inactive',
    purpose:'Developer-friendly email API. Alternative to SendGrid — simpler setup, React Email support.',
    fallback:'SMTP fallback if not configured.',
    tags:['email'],
    impactedAgents:[
      {id:'mentor', name:'Mentor', emoji:'🎯', impact:'medium', subAgents:['Study Reminder']},
      {id:'herald', name:'Herald', emoji:'📣', impact:'medium', subAgents:['Newsletter Manager']},
    ],
    fields:[{key:'RESEND_API_KEY', label:'API Key', type:'password', placeholder:'re_...', required:true, hint:'resend.com → API Keys'}],
    docsUrl:'https://resend.com/',
  },

  /* ── Chat Channels ───────────────────────────────────────────────────────── */
  { id:'whatsapp', name:'WhatsApp Business', type:'api', category:'Chat Channels', mandatory:false, status:'inactive',
    purpose:"WhatsApp tutoring — students get AI tutor, reminders, study material via India's #1 messaging platform. Access gated by student plan: Premium/Elite included; Pro via ₹99/mo add-on.",
    fallback:'Web portal only. Students on eligible plans prompted to connect via Settings → Channels.',
    tags:['messaging','india','channels','chatbot'],
    impactedAgents:[
      {id:'chatbot_access', name:'ChatbotAccessService', emoji:'🔐', impact:'critical', subAgents:['Plan Gating Layer','Add-on Checker']},
      {id:'sage',   name:'Sage',   emoji:'🧠', impact:'high',   subAgents:['Multi-Channel Tutor','WhatsApp Handler']},
      {id:'mentor', name:'Mentor', emoji:'🎯', impact:'high',   subAgents:['WhatsApp Reminder','Push Notifier','Lifecycle Outreach']},
      {id:'herald', name:'Herald', emoji:'📣', impact:'medium', subAgents:['Broadcast Manager','Campaign Delivery']},
      {id:'nexus',  name:'Nexus',  emoji:'🔗', impact:'medium', subAgents:['Support Ticket Notifier']},
    ],
    fields:[
      {key:'WHATSAPP_PHONE_NUMBER_ID',  label:'Phone Number ID',       type:'text',     placeholder:'1234567890', required:true,  hint:'Meta Business Suite → WhatsApp'},
      {key:'WHATSAPP_ACCESS_TOKEN',     label:'Access Token',          type:'password', placeholder:'EAAxxxxx',   required:true},
      {key:'WHATSAPP_VERIFY_TOKEN',     label:'Webhook Verify Token',  type:'password', placeholder:'your_token', required:true},
      {key:'WHATSAPP_APP_SECRET',       label:'App Secret',            type:'password', placeholder:'',           required:true},
    ],
    docsUrl:'https://business.facebook.com/',
  },
  { id:'telegram', name:'Telegram Bot', type:'api', category:'Chat Channels', mandatory:false, status:'inactive',
    purpose:'Telegram tutoring. Popular with JEE/NEET students — inline keyboards, LaTeX math rendering, group study rooms. Access gated by student plan: Premium/Elite included; Pro via ₹99/mo add-on.',
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
      {key:'TELEGRAM_BOT_TOKEN',      label:'Bot Token',         type:'password', placeholder:'123456:ABC-DEF...', required:true,  hint:'@BotFather on Telegram → /newbot'},
      {key:'TELEGRAM_WEBHOOK_SECRET', label:'Webhook Secret',    type:'password', placeholder:'random_secret',    required:false},
    ],
    docsUrl:'https://core.telegram.org/bots',
  },

  /* ── Analytics ───────────────────────────────────────────────────────────── */
  { id:'ga4', name:'Google Analytics 4', type:'api', category:'Analytics', mandatory:false, status:'inactive',
    purpose:'User behaviour: funnel analysis, page views, conversion tracking, session recordings.',
    fallback:'Internal Oracle analytics for key metrics. No external analytics without this.',
    tags:['analytics'],
    impactedAgents:[
      {id:'oracle', name:'Oracle', emoji:'📊', impact:'high',   subAgents:['Funnel Analyzer','Behaviour Tracker']},
      {id:'scout',  name:'Scout',  emoji:'🔍', impact:'medium', subAgents:['Traffic Analyzer']},
    ],
    fields:[
      {key:'GA4_MEASUREMENT_ID',      label:'Measurement ID',          type:'text',     placeholder:'G-XXXXXXXXXX', required:true},
      {key:'GA4_API_SECRET',          label:'API Secret',              type:'password', placeholder:'',             required:false, hint:'For server-side events'},
      {key:'VITE_GA4_MEASUREMENT_ID', label:'Frontend Measurement ID', type:'text',     placeholder:'G-XXXXXXXXXX', required:true},
    ],
    docsUrl:'https://analytics.google.com/',
  },
  { id:'mixpanel', name:'Mixpanel', type:'api', category:'Analytics', mandatory:false, status:'inactive',
    purpose:'Product analytics: user-level event tracking, cohort analysis, A/B test measurement.',
    fallback:'Oracle internal analytics only.',
    tags:['analytics','product'],
    impactedAgents:[
      {id:'oracle', name:'Oracle', emoji:'📊', impact:'medium', subAgents:['Cohort Analyzer','Retention Tracker']},
    ],
    fields:[
      {key:'MIXPANEL_TOKEN',      label:'Project Token', type:'text',     placeholder:'', required:true},
      {key:'MIXPANEL_API_SECRET', label:'API Secret',    type:'password', placeholder:'', required:false},
    ],
    docsUrl:'https://mixpanel.com/',
  },

  /* ── Vector Store ────────────────────────────────────────────────────────── */
  { id:'pinecone', name:'Pinecone', type:'api', category:'Vector Store', mandatory:false, status:'inactive',
    purpose:'Vector DB for semantic search: "Find similar questions", contextual RAG tutoring across study materials.',
    fallback:'Qdrant → in-memory (non-persistent, max ~50K vectors).',
    tags:['vector','rag','search'],
    impactedAgents:[
      {id:'atlas', name:'Atlas', emoji:'📚', impact:'high',   subAgents:['Content Retriever','Similarity Engine','Curriculum Mapper']},
      {id:'sage',  name:'Sage',  emoji:'🧠', impact:'high',   subAgents:['Contextual Tutor','Past Question Finder']},
      {id:'scout', name:'Scout', emoji:'🔍', impact:'medium', subAgents:['Topic Cluster Analyzer']},
    ],
    fields:[
      {key:'PINECONE_API_KEY',     label:'API Key',     type:'password', placeholder:'',             required:true},
      {key:'PINECONE_ENVIRONMENT', label:'Environment', type:'text',     placeholder:'us-east1-gcp', required:true},
      {key:'PINECONE_INDEX',       label:'Index Name',  type:'text',     placeholder:'edugenius',    required:true},
    ],
    docsUrl:'https://app.pinecone.io/',
  },
  { id:'qdrant', name:'Qdrant', type:'api', category:'Vector Store', mandatory:false, status:'inactive',
    purpose:'Self-hostable vector DB — cost-effective Pinecone alternative for scale.',
    fallback:'In-memory vector store (limited, non-persistent).',
    tags:['vector','rag'],
    impactedAgents:[
      {id:'atlas', name:'Atlas', emoji:'📚', impact:'high',   subAgents:['Content Retriever','Similarity Engine']},
      {id:'sage',  name:'Sage',  emoji:'🧠', impact:'medium', subAgents:['Contextual Tutor']},
    ],
    fields:[
      {key:'QDRANT_URL',        label:'Qdrant URL',  type:'url',      placeholder:'http://localhost:6333', required:true},
      {key:'QDRANT_API_KEY',    label:'API Key',     type:'password', placeholder:'Optional for local',    required:false},
      {key:'QDRANT_COLLECTION', label:'Collection',  type:'text',     placeholder:'edugenius',             required:true},
    ],
    docsUrl:'https://qdrant.tech/',
  },

  /* ── MCP Servers ─────────────────────────────────────────────────────────── */
  { id:'mcp-wolfram', name:'Wolfram MCP Server', type:'mcp', category:'MCP Servers', mandatory:false, status:'inactive',
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
  { id:'mcp-filesystem', name:'Filesystem MCP Server', type:'mcp', category:'MCP Servers', mandatory:false, status:'inactive',
    purpose:'Allows Atlas/Forge agents to read/write course content files via MCP tool calls. Useful for self-hosted deployments.',
    fallback:'S3/GCS blob storage via direct API calls.',
    mcpEndpoint:'http://localhost:8101/filesystem',
    tags:['mcp','storage'],
    impactedAgents:[
      {id:'atlas', name:'Atlas', emoji:'📚', impact:'medium', subAgents:['Asset Manager','Content Writer']},
      {id:'forge', name:'Forge', emoji:'⚙️', impact:'medium', subAgents:['Deployment Manager']},
    ],
    fields:[
      {key:'MCP_FILESYSTEM_URL',    label:'MCP Server URL',     type:'url',      placeholder:'http://localhost:8101/filesystem', required:true},
      {key:'MCP_FILESYSTEM_ROOT',   label:'Allowed Root Path',  type:'text',     placeholder:'/data/edugenius',                  required:true},
      {key:'MCP_FILESYSTEM_SECRET', label:'Server Secret',      type:'password', placeholder:'Optional',                         required:false},
    ],
  },
];

// ─── Storage Layer (bidirectional sync) ───────────────────────────────────────

const STORAGE_KEY = 'edugenius_connections';

function loadStoredValues(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveStoredValues(vals: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vals));
  // Also broadcast so other open tabs / runtime can pick up
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(vals) }));
}

function deriveStatus(conn: Connection, stored: Record<string, string>): ConnStatus {
  const required = conn.fields.filter(f => f.required);
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
    active:   { cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle2 size={12} />, label: 'Active' },
    inactive: { cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',         icon: <Clock size={12} />,        label: 'Not Configured' },
    error:    { cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           icon: <XCircle size={12} />,      label: 'Error' },
    pending:  { cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <AlertTriangle size={12} />, label: 'Pending' },
  };
  const { cls, icon, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {icon}{label}
    </span>
  );
}

// ─── Configure Modal ──────────────────────────────────────────────────────────

function ConfigureModal({
  conn, stored, onSave, onClose,
}: {
  conn: Connection;
  stored: Record<string, string>;
  onSave: (vals: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(conn.fields.map(f => [f.key, stored[f.key] || '']))
  );
  const [show, setShow] = useState<Record<string, boolean>>({});

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{conn.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{conn.category}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Purpose + Fallback */}
        <div className="p-5 space-y-3 border-b border-gray-200 dark:border-gray-700">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">PURPOSE</p>
            <p className="text-sm text-blue-900 dark:text-blue-200">{conn.purpose}</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">FALLBACK</p>
            <p className="text-sm text-amber-900 dark:text-amber-200">{conn.fallback}</p>
          </div>
          {conn.mcpEndpoint && (
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-1">MCP ENDPOINT</p>
              <code className="text-sm text-purple-900 dark:text-purple-200 font-mono">{conn.mcpEndpoint}</code>
            </div>
          )}
        </div>

        {/* Fields */}
        <div className="p-5 space-y-4">
          {conn.fields.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {field.hint && <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{field.hint}</p>}
              {field.type === 'select' ? (
                <select
                  value={vals[field.key] || ''}
                  onChange={e => setVals({ ...vals, [field.key]: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">Select...</option>
                  {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <div className="relative flex items-center gap-2">
                  <input
                    type={field.type === 'password' && !show[field.key] ? 'password' : 'text'}
                    value={vals[field.key] || ''}
                    onChange={e => setVals({ ...vals, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              )}
              <p className="text-xs text-gray-400 mt-0.5 font-mono">{field.key}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
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
      {/* Card Header */}
      <div className="p-4 flex items-start gap-3">
        {/* Mandatory Indicator */}
        <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${conn.mandatory ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'}`} title={conn.mandatory ? 'Mandatory' : 'Optional'} />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900 dark:text-white text-sm">{conn.name}</span>
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400`}>
              {TYPE_ICONS[conn.type]} {conn.type.toUpperCase()}
            </span>
            {conn.mandatory && (
              <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                MANDATORY
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

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
          {/* Purpose + Fallback */}
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

          {/* MCP Endpoint */}
          {conn.mcpEndpoint && (
            <div className="bg-purple-50 dark:bg-purple-900/10 rounded-lg p-3">
              <p className="text-xs font-bold text-purple-700 dark:text-purple-400 mb-1">MCP ENDPOINT</p>
              <code className="text-xs text-purple-900 dark:text-purple-200 font-mono">{conn.mcpEndpoint}</code>
            </div>
          )}

          {/* Impacted Agents */}
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
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {agent.emoji} {agent.name}
                    </span>
                    {agent.subAgents.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {agent.subAgents.map(sa => (
                          <span key={sa} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs">
                            {sa}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Required Fields (keys only, no values) */}
          <div>
            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">ENV VARIABLES</p>
            <div className="flex flex-wrap gap-1">
              {conn.fields.map(f => (
                <span key={f.key} className={`px-1.5 py-0.5 rounded text-xs font-mono ${stored[f.key] ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                  {f.required ? '* ' : ''}{f.key}
                </span>
              ))}
            </div>
          </div>

          {/* Docs Link */}
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

  // Sync from localStorage on storage events (other tabs / runtime)
  useEffect(() => {
    const handler = () => setStored(loadStoredValues());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const categories = useMemo(() => ['All', ...Array.from(new Set(REGISTRY.map(c => c.category)))], []);

  const filtered = useMemo(() => REGISTRY.filter(c => {
    const status = deriveStatus(c, stored);
    if (categoryFilter !== 'All' && c.category !== categoryFilter) return false;
    if (statusFilter === 'active'   && status !== 'active')   return false;
    if (statusFilter === 'inactive' && status === 'active')   return false;
    if (mandatoryOnly && !c.mandatory) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) ||
             c.category.toLowerCase().includes(q) ||
             c.purpose.toLowerCase().includes(q) ||
             c.tags.some(t => t.includes(q)) ||
             c.impactedAgents.some(a => a.name.toLowerCase().includes(q) || a.subAgents.some(s => s.toLowerCase().includes(q)));
    }
    return true;
  }), [stored, categoryFilter, statusFilter, mandatoryOnly, search]);

  // Stats
  const stats = useMemo(() => {
    const active   = REGISTRY.filter(c => deriveStatus(c, stored) === 'active').length;
    const mandatory = REGISTRY.filter(c => c.mandatory).length;
    const mandatoryDone = REGISTRY.filter(c => c.mandatory && deriveStatus(c, stored) === 'active').length;
    return { total: REGISTRY.length, active, mandatory, mandatoryDone };
  }, [stored]);

  function handleSave(id: string, vals: Record<string, string>) {
    const updated = { ...stored, ...vals };
    setStored(updated);
    saveStoredValues(updated);
    // Propagate to runtime env vars that llmService reads
    Object.entries(vals).forEach(([k, v]) => {
      if (k.startsWith('VITE_') && (window as any).__env) {
        (window as any).__env[k] = v;
      }
    });
  }

  const configConn = REGISTRY.find(c => c.id === configureId) || null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Connection Registry</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          All external API / MCP connections — purpose, fallback, and impacted agents in one place.
          {canEdit ? ' Configure here to propagate to all layers.' : ' Read-only view.'}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Connections', value: stats.total, color: 'text-gray-700 dark:text-gray-300' },
          { label: 'Active', value: stats.active, color: 'text-green-600 dark:text-green-400' },
          { label: 'Mandatory', value: stats.mandatory, color: 'text-red-600 dark:text-red-400' },
          { label: 'Mandatory Active', value: `${stats.mandatoryDone}/${stats.mandatory}`, color: stats.mandatoryDone === stats.mandatory ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search connections, agents, env vars..."
            className="pl-8 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-64 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <input type="checkbox" checked={mandatoryOnly} onChange={e => setMandatoryOnly(e.target.checked)}
            className="rounded" />
          Mandatory only
        </label>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} of {REGISTRY.length}</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Mandatory</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 inline-block" /> Optional</span>
        <span className="flex items-center gap-1 ml-auto text-amber-600 dark:text-amber-400">
          <Info size={12} /> Values saved here propagate to runtime config
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

      {/* Configure Modal */}
      {configConn && (
        <ConfigureModal
          conn={configConn}
          stored={stored}
          onSave={(vals) => handleSave(configConn.id, vals)}
          onClose={() => setConfigureId(null)}
        />
      )}
    </div>
  );
}

export default ConnectionRegistry;
