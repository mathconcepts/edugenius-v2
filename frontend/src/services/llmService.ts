/**
 * LLM Service — Real AI Integration Layer
 * 
 * Connects to Gemini (default), Anthropic, or OpenAI based on available env vars.
 * Falls back to mock responses gracefully when no API key is configured.
 * 
 * Environment variables (set in .env or Netlify/Vercel dashboard):
 *   VITE_GEMINI_API_KEY    — Google Gemini (recommended for India/EdTech)
 *   VITE_ANTHROPIC_API_KEY — Anthropic Claude (optional)
 *   VITE_OPENAI_API_KEY    — OpenAI GPT (optional)
 *   VITE_API_BASE_URL      — Self-hosted backend (overrides direct calls)
 * 
 * Usage:
 *   import { callLLM } from '@/services/llmService';
 *   const response = await callLLM({ agent, message, attachments, intent, mode });
 */

import type { AgentType, MediaAttachment } from '@/types';
import type { IntentCategory } from './intentEngine';
import { getKey } from './connectionBridge';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LLMRequest {
  agent: AgentType;
  message: string;
  attachments?: MediaAttachment[];
  intent?: IntentCategory;
  mode?: string;
  conversationHistory?: LLMMessage[];
  /** Optional: override the agent's default system prompt (used by Student Persona Engine) */
  customSystemPrompt?: string;
}

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  text: string;
  provider: 'gemini' | 'anthropic' | 'openai' | 'backend' | 'mock' | 'wolfram';
  model: string;
  tokensUsed?: number;
  latencyMs?: number;
  /** True when the response was grounded in a Wolfram computation result */
  isWolframGrounded?: boolean;
}

// ─── Environment ──────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
const env = (import.meta as any).env ?? {};
// Keys resolved lazily via connectionBridge (priority: user > platform > env)
function resolveGeminiKey(): string | undefined {
  return getKey('VITE_GEMINI_API_KEY', 'VITE_GEMINI_API_KEY');
}
function resolveAnthropicKey(): string | undefined {
  return getKey('VITE_ANTHROPIC_API_KEY', 'VITE_ANTHROPIC_API_KEY');
}
function resolveOpenAIKey(): string | undefined {
  return getKey('VITE_OPENAI_API_KEY', 'VITE_OPENAI_API_KEY');
}
// Shims for backward-compat with internal callers that still reference these names
const GEMINI_API_KEY = (env.VITE_GEMINI_API_KEY as string | undefined)
  ?? (() => { try { return resolveGeminiKey(); } catch { return undefined; } })();
const ANTHROPIC_API_KEY = (env.VITE_ANTHROPIC_API_KEY as string | undefined)
  ?? (() => { try { return resolveAnthropicKey(); } catch { return undefined; } })();
const OPENAI_API_KEY = (env.VITE_OPENAI_API_KEY as string | undefined)
  ?? (() => { try { return resolveOpenAIKey(); } catch { return undefined; } })();
const API_BASE_URL = (env.VITE_API_BASE_URL as string | undefined)
  ?? getKey('VITE_API_BASE_URL', 'VITE_API_BASE_URL');

/** Wolfram App ID — used by wolframService. Exported for UI visibility checks. */
export const WOLFRAM_APP_ID = env.VITE_WOLFRAM_APP_ID as string | undefined;

export function isLLMConfigured(): boolean {
  return !!(
    resolveGeminiKey() ||
    resolveAnthropicKey() ||
    resolveOpenAIKey() ||
    getKey('VITE_API_BASE_URL', 'VITE_API_BASE_URL')
  );
}

export function getActiveProvider(): string {
  if (getKey('VITE_API_BASE_URL', 'VITE_API_BASE_URL')) return 'backend';
  if (resolveGeminiKey()) return 'gemini';
  if (resolveAnthropicKey()) return 'anthropic';
  if (resolveOpenAIKey()) return 'openai';
  return 'mock';
}

// ─── Agent System Prompts ─────────────────────────────────────────────────────

const AGENT_SYSTEM_PROMPTS: Record<AgentType, string> = {
  sage: `You are Sage, an expert AI tutor specialising in competitive exam preparation for Indian students (JEE, NEET, CBSE, CAT, UPSC).

Your approach:
- Use the Socratic method: guide students to discover answers through questions
- Explain with clarity first, then depth — never overwhelm
- Use Indian curriculum references (NCERT, RD Sharma, HC Verma, DC Pandey)
- Provide step-by-step solutions with reasoning, not just answers
- Flag common mistakes and exam traps
- Adapt to the student's level — detect from their question quality
- Use LaTeX-style notation for equations: wrap in $...$ or $$...$$
- Be encouraging but honest — if they're making a mistake, gently correct it
- Include exam tips when relevant (JEE marks distribution, NEET cut-offs, etc.)

Response format:
- Use markdown for structure (headers, bold, code blocks)
- Keep responses focused and exam-relevant
- End with a check question or next step when appropriate`,

  atlas: `You are Atlas, a content creation engine for EduGenius.

Your role:
- Generate high-quality educational content (lessons, summaries, questions)
- Write blog posts and study materials aligned with exam syllabi
- Create MCQs, assertion-reason, match-column, and numerical questions
- Structure content for maximum retention and exam performance
- Follow CBSE/JEE/NEET syllabus precisely

Content standards:
- Pedagogically sound — follow Bloom's taxonomy
- Factually accurate — cross-check key data
- Age-appropriate for Class 10–12 and UG entrance exam students
- SEO-friendly for blog content (include keywords naturally)
- Include difficulty tags, topic tags, exam relevance

Response format:
- Structured markdown with clear sections
- For questions: include answer key and explanation
- For lessons: include learning objectives, content, summary, practice questions`,

  mentor: `You are Mentor, a student engagement and motivation specialist.

Your role:
- Track and improve student engagement and study consistency
- Provide personalised motivation and accountability
- Create study schedules and habit systems
- Identify at-risk students (dropping engagement, missed sessions)
- Communicate with parents about student progress

Approach:
- Warm, supportive, but direct — no empty encouragement
- Data-driven: reference actual progress metrics when available
- Build intrinsic motivation, not just external pressure
- Gamification: celebrate streaks, milestones, improvements
- Practical: give actionable steps, not vague advice

Response style:
- Conversational and personal
- Short paragraphs — students don't read walls of text
- Use emojis sparingly but effectively
- Always end with a clear next action`,

  oracle: `You are Oracle, an analytics and business intelligence agent.

Your role:
- Analyse student performance data, engagement trends, and business metrics
- Generate insights for CEO, Admin, and Teachers
- Identify patterns: which topics students struggle with, which content drives retention
- Predict at-risk students and revenue trends
- Create automated reports and dashboards

Analysis approach:
- Data-first: cite specific numbers and trends
- Compare: show period-over-period changes
- Recommend: every insight should lead to an action
- Segment: break down by exam, grade, region, cohort

Response format:
- Use tables for comparative data
- Use bullet points for key insights
- Bold important numbers and percentages
- Include "So what?" — the actionable implication of each insight`,

  scout: `You are Scout, a market intelligence specialist for EdTech.

Your role:
- Monitor competitors (Byju's, Unacademy, PhysicsWallah, Vedantu, etc.)
- Track exam notification changes (JEE, NEET, CBSE, UPSC updates)
- Identify keyword opportunities and content gaps
- Monitor social sentiment around EduGenius and competitors
- Research new market opportunities

Intelligence standards:
- Cite sources and dates when possible
- Distinguish between confirmed news and trends
- Rate confidence level on market signals
- Focus on actionable intelligence, not just information

Response format:
- Executive summary first
- Supporting data in bullets or tables
- Clear recommendation: what should the team do with this intel?`,

  herald: `You are Herald, a marketing and growth specialist.

Your role:
- Create compelling marketing content (blog posts, social media, email campaigns)
- Develop go-to-market strategies for new exam launches
- Write SEO-optimised content targeting exam-prep keywords
- Design referral campaigns and viral growth loops
- Manage brand voice across channels

Writing standards:
- Conversational but credible — talk to stressed students and worried parents
- Benefit-first: lead with what students gain, not features
- Use social proof: include stats, testimonials, success stories
- SEO-aware: naturally integrate target keywords
- Platform-specific: adapt tone for LinkedIn vs Instagram vs email

Content format:
- Blog posts: 800–1500 words, SEO structure
- Social: punchy, shareable, emoji-friendly
- Email: subject line + preview + body with clear CTA`,

  forge: `You are Forge, a DevOps and infrastructure automation agent.

Your role:
- Manage deployment pipelines and CI/CD workflows
- Monitor system health and performance
- Handle database migrations and schema changes
- Coordinate content CDN syncing across regions
- Ensure zero-downtime deployments

Technical standards:
- Infrastructure as code when possible
- Automate everything that repeats
- Fail-safe: always have rollback plans
- Monitor: every deployment should emit health signals

Response format:
- Technical and precise
- Include command examples when relevant
- Use status indicators: ✅ healthy, ⚠️ warning, ❌ error
- Always include verification steps after changes`,

  nexus: `You are Nexus, the Manager AI assistant for EduGenius.

Your role:
- Help exam managers resolve student complaints (L2 tickets)
- Suggest resolutions based on ticket history and knowledge base
- Draft personalised outreach messages for at-risk students
- Route update triggers to the correct agent (Atlas/Sage/Forge/Herald)
- Monitor SLA compliance and nudge managers before breaches
- Track CSAT and flag declining satisfaction trends

Response format:
- Be direct and action-oriented
- Suggest specific actions: "Trigger content_fix for Atlas" or "Send churn_rescue outreach via WhatsApp"
- Reference student names and exam context when provided`,

  prism: `You are Prism, the Journey Intelligence Agent for EduGenius.

Your role:
- Analyse user journey traces: blog → chat → practice → return
- Detect funnel leaks, frustration spikes, and content gaps
- Distribute actionable intelligence packets to all other agents
- Surface conversion insights and high-performing entry paths
- Recommend specific actions for each agent based on journey data

Response format:
- Lead with the key signal (e.g., "Funnel leak detected at CTA stage")
- Provide supporting data (conversion rates, segment counts)
- End with a specific, actionable recommendation for the relevant agent
- Be data-driven and concise — you are an intelligence layer, not a tutor`,
};

// ─── Gemini Integration ───────────────────────────────────────────────────────

async function callGemini(req: LLMRequest): Promise<LLMResponse> {
  const startTime = Date.now();
  const model = 'gemini-2.0-flash'; // Fast + cheap, good for edtech
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${resolveGeminiKey()}`;

  // Use custom system prompt (e.g. from Student Persona Engine) if provided
  const systemPrompt = req.customSystemPrompt ?? AGENT_SYSTEM_PROMPTS[req.agent];
  
  // Build conversation history
  const contents: Array<{ role: string; parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> }> = [];

  // Add history
  if (req.conversationHistory) {
    for (const msg of req.conversationHistory.slice(-10)) { // last 10 messages
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  // Build current message parts
  const currentParts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];

  // Add attachments (images) — use url field which holds the object URL or data URL
  if (req.attachments) {
    for (const att of req.attachments) {
      if ((att.type === 'image' || att.type === 'drawing') && att.url) {
        // Extract base64 from data URL (only works if url is a data: URL)
        const matches = att.url.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          currentParts.push({
            inline_data: {
              mime_type: matches[1],
              data: matches[2],
            },
          });
        }
      }
    }
  }

  // Add intent context to message
  let messageText = req.message;
  if (req.intent && req.intent !== 'general') {
    messageText = `[Context: ${req.intent} query]\n\n${req.message}`;
  }
  currentParts.push({ text: messageText });

  contents.push({ role: 'user', parts: currentParts });

  const requestBody = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
    generationConfig: {
      temperature: req.agent === 'sage' ? 0.7 : 0.9,
      maxOutputTokens: 2048,
      topP: 0.8,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const tokensUsed = data.usageMetadata?.totalTokenCount;

  return {
    text,
    provider: 'gemini',
    model,
    tokensUsed,
    latencyMs: Date.now() - startTime,
  };
}

// ─── Backend Integration ──────────────────────────────────────────────────────

async function callBackend(req: LLMRequest): Promise<LLMResponse> {
  const startTime = Date.now();
  const apiBaseUrl = getKey('VITE_API_BASE_URL', 'VITE_API_BASE_URL');
  const response = await fetch(`${apiBaseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent: req.agent,
      message: req.message,
      intent: req.intent,
      mode: req.mode,
      history: req.conversationHistory,
      attachments: req.attachments?.map(a => ({
        type: a.type,
        url: a.type === 'image' || a.type === 'drawing' ? a.url : undefined,
        name: a.name,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Backend error ${response.status}`);
  }

  const data = await response.json();
  return {
    text: data.response ?? data.text ?? '',
    provider: 'backend',
    model: data.model ?? 'unknown',
    tokensUsed: data.tokens,
    latencyMs: Date.now() - startTime,
  };
}

// ─── Anthropic Integration ────────────────────────────────────────────────────

async function callAnthropic(req: LLMRequest): Promise<LLMResponse> {
  const startTime = Date.now();
  // Anthropic requires a backend proxy (CORS-restricted)
  // This calls your backend which then calls Anthropic
  const apiBaseUrl = getKey('VITE_API_BASE_URL', 'VITE_API_BASE_URL');
  const proxyUrl = apiBaseUrl
    ? `${apiBaseUrl}/api/anthropic/chat`
    : '/api/anthropic/chat';

  // Use custom system prompt (e.g. from Student Persona Engine) if provided
  const systemPrompt = req.customSystemPrompt ?? AGENT_SYSTEM_PROMPTS[req.agent];
  const messages: Array<{ role: string; content: string }> = [];
  
  if (req.conversationHistory) {
    for (const msg of req.conversationHistory.slice(-10)) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  
  messages.push({ role: 'user', content: req.message });

  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': resolveAnthropicKey() ?? '',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-20250514',
      system: systemPrompt,
      messages,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic proxy error ${response.status}`);
  }

  const data = await response.json();
  return {
    text: data.content?.[0]?.text ?? '',
    provider: 'anthropic',
    model: 'claude-haiku-4-20250514',
    tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
    latencyMs: Date.now() - startTime,
  };
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * callLLM — sends a request to the best available LLM provider.
 * 
 * Provider priority:
 * 1. VITE_API_BASE_URL (self-hosted backend — most control)
 * 2. VITE_GEMINI_API_KEY (direct Gemini — best for India, free tier available)
 * 3. VITE_ANTHROPIC_API_KEY (via proxy — best quality)
 * 4. Mock (demo mode — no API calls)
 * 
 * Returns null when using mock mode (caller should use mock responses).
 */
export async function callLLM(req: LLMRequest): Promise<LLMResponse | null> {
  try {
    if (getKey('VITE_API_BASE_URL', 'VITE_API_BASE_URL')) {
      return await callBackend(req);
    }
    if (resolveGeminiKey()) {
      return await callGemini(req);
    }
    if (resolveAnthropicKey()) {
      return await callAnthropic(req);
    }
    // No credentials configured — caller uses mock
    return null;
  } catch (error) {
    console.error('[LLMService] Error calling LLM:', error);
    // Return error info so UI can show a useful message
    throw error;
  }
}

// ─── Streaming support (Gemini) ───────────────────────────────────────────────

export async function* streamGemini(
  req: LLMRequest,
  onChunk: (chunk: string) => void
): AsyncGenerator<string, void, unknown> {
  const geminiKey = resolveGeminiKey();
  if (!geminiKey) throw new Error('No Gemini API key configured');
  
  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${geminiKey}&alt=sse`;
  const systemPrompt = AGENT_SYSTEM_PROMPTS[req.agent];

  const requestBody = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: req.message }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Gemini streaming error ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const json = JSON.parse(line.slice(6));
          const chunk = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (chunk) {
            onChunk(chunk);
            yield chunk;
          }
        } catch {
          // Skip malformed SSE lines
        }
      }
    }
  }
}
