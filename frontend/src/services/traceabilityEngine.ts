/**
 * traceabilityEngine.ts
 *
 * End-to-end bidirectional traceability engine.
 *
 * Trace chain:
 *   End user (any channel)
 *   → Entry point (chat / blog / link / backlink)
 *   → Intent Engine
 *   → Agent routing
 *   → Sub-agent selection
 *   → Prompt version
 *   → LLM call
 *   → Output
 *
 * All data stored in localStorage under the key 'edugenius_traces'.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TraceContext {
  sessionId: string;
  userId?: string;
  examType?: string;
  entryPoint:
    | 'chat_direct'
    | 'blog_cta'
    | 'blog_internal'
    | 'practice'
    | 'dashboard'
    | 'external_link';
  referrerUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  blogSlug?: string;    // if came from blog
  blogTopic?: string;   // pre-filled question topic
}

export interface TraceNode {
  traceId: string;        // unique per node
  rootTraceId: string;    // top-level trace ID (ties all nodes together)
  parentTraceId?: string;
  nodeType:
    | 'entry'
    | 'intent'
    | 'agent_call'
    | 'sub_agent_call'
    | 'llm_call'
    | 'output'
    | 'blog_publish'
    | 'blog_signal';
  agentId?: string;
  subAgentId?: string;
  promptId?: string;
  promptVersion?: string;
  action: string;
  inputSummary: string;   // truncated for display
  outputSummary: string;  // truncated for display
  latencyMs?: number;
  timestamp: string;      // ISO
  metadata?: Record<string, unknown>;
}

export interface TraceTree {
  rootTraceId: string;
  context: TraceContext;
  nodes: TraceNode[];
  totalLatencyMs: number;
  agentsInvolved: string[];
  promptsUsed: string[];
  createdAt: string;
  completedAt?: string;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'edugenius_traces';
const MAX_STORED = 100;  // keep most recent 100 traces

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function truncate(s: string, n = 120): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/** Create a new root trace from a TraceContext. */
export function createRootTrace(context: TraceContext): TraceTree {
  const rootTraceId = uid();
  const now = new Date().toISOString();
  const tree: TraceTree = {
    rootTraceId,
    context,
    nodes: [],
    totalLatencyMs: 0,
    agentsInvolved: [],
    promptsUsed: [],
    createdAt: now,
  };

  // Add automatic entry node
  addNode(tree, {
    traceId: uid(),
    parentTraceId: undefined,
    nodeType: 'entry',
    action: `entry:${context.entryPoint}`,
    inputSummary: truncate(
      [
        context.referrerUrl && `referrer=${context.referrerUrl}`,
        context.utmSource && `utm_source=${context.utmSource}`,
        context.blogSlug && `blog=${context.blogSlug}`,
      ]
        .filter(Boolean)
        .join(' · ') || 'direct',
    ),
    outputSummary: `session=${context.sessionId}`,
    timestamp: now,
    metadata: {
      utmSource: context.utmSource,
      utmMedium: context.utmMedium,
      utmCampaign: context.utmCampaign,
      blogSlug: context.blogSlug,
      blogTopic: context.blogTopic,
    },
  });

  return tree;
}

/** Add a node to an existing TraceTree (mutates the tree and returns the node). */
export function addNode(
  tree: TraceTree,
  node: Omit<TraceNode, 'rootTraceId'>,
): TraceNode {
  const fullNode: TraceNode = {
    ...node,
    rootTraceId: tree.rootTraceId,
    timestamp: node.timestamp ?? new Date().toISOString(),
  };
  tree.nodes.push(fullNode);

  // Update derived fields
  if (node.latencyMs) {
    tree.totalLatencyMs += node.latencyMs;
  }
  if (node.agentId && !tree.agentsInvolved.includes(node.agentId)) {
    tree.agentsInvolved.push(node.agentId);
  }
  if (node.promptId && !tree.promptsUsed.includes(node.promptId)) {
    tree.promptsUsed.push(node.promptId);
  }

  return fullNode;
}

/** Mark a trace as completed. */
export function completeTrace(tree: TraceTree): void {
  tree.completedAt = new Date().toISOString();
}

/** Persist a TraceTree to localStorage. */
export function storeTrace(tree: TraceTree): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: TraceTree[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(t => t.rootTraceId === tree.rootTraceId);
    if (idx >= 0) {
      all[idx] = tree;
    } else {
      all.unshift(tree);
    }
    // Keep only the most recent MAX_STORED traces
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, MAX_STORED)));
  } catch (e) {
    console.warn('[TraceEngine] Failed to persist trace:', e);
  }
}

/** Load a single TraceTree by rootTraceId. */
export function loadTrace(rootTraceId: string): TraceTree | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const all: TraceTree[] = JSON.parse(raw);
    return all.find(t => t.rootTraceId === rootTraceId) ?? null;
  } catch {
    return null;
  }
}

/** List the most recent traces (default 20). */
export function listRecentTraces(limit = 20): TraceTree[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all: TraceTree[] = JSON.parse(raw);
    return all.slice(0, limit);
  } catch {
    return [];
  }
}

// ─── Mock traces for demo ─────────────────────────────────────────────────────

/** Build 3 realistic example traces for demo display. */
export function buildMockTraces(): TraceTree[] {
  const now = Date.now();

  // ── Trace 1: Blog CTA → Sage ────────────────────────────────────────────────
  const t1: TraceTree = {
    rootTraceId: 'mock-blog-cta-001',
    context: {
      sessionId: 'sess-blog-001',
      examType: 'JEE',
      entryPoint: 'blog_cta',
      referrerUrl: '/website/blog/jee-main-2026-complete-strategy',
      utmSource: 'blog',
      utmMedium: 'cta',
      utmCampaign: 'JEE',
      blogSlug: 'jee-main-2026-complete-strategy',
      blogTopic: 'JEE Main 2026: Complete Strategy Guide for 250+ Score',
    },
    nodes: [
      {
        traceId: 'mock-t1-n1',
        rootTraceId: 'mock-blog-cta-001',
        nodeType: 'entry',
        action: 'entry:blog_cta',
        inputSummary: 'referrer=/website/blog/jee-main-2026-complete-strategy · utm_source=blog · blog=jee-main-2026-complete-strategy',
        outputSummary: 'session=sess-blog-001',
        timestamp: new Date(now - 18_000_000).toISOString(),
        metadata: { utmSource: 'blog', utmMedium: 'cta', utmCampaign: 'JEE' },
      },
      {
        traceId: 'mock-t1-n2',
        rootTraceId: 'mock-blog-cta-001',
        parentTraceId: 'mock-t1-n1',
        nodeType: 'intent',
        action: 'exam_strategy',
        inputSummary: 'How should I divide my time across subjects for JEE Main?',
        outputSummary: '→ sage (confidence 0.91)',
        latencyMs: 38,
        timestamp: new Date(now - 17_990_000).toISOString(),
      },
      {
        traceId: 'mock-t1-n3',
        rootTraceId: 'mock-blog-cta-001',
        parentTraceId: 'mock-t1-n2',
        nodeType: 'agent_call',
        agentId: 'sage',
        subAgentId: 'AdaptiveTutor',
        promptId: 'sage-adaptive-v1',
        promptVersion: '1.0.0',
        action: 'route:sage',
        inputSummary: 'exam_strategy query — JEE context from blog CTA',
        outputSummary: 'Sage selected; persona loaded (exam=JEE_MAIN, streak=4)',
        latencyMs: 62,
        timestamp: new Date(now - 17_928_000).toISOString(),
      },
      {
        traceId: 'mock-t1-n4',
        rootTraceId: 'mock-blog-cta-001',
        parentTraceId: 'mock-t1-n3',
        nodeType: 'llm_call',
        agentId: 'sage',
        promptId: 'sage-adaptive-v1',
        promptVersion: '1.0.0',
        action: 'llm:gemini-1.5-flash',
        inputSummary: '[system: adaptive tutor persona] How should I divide my time across subjects for JEE Main?',
        outputSummary: 'For JEE Main, a proven split is 40% Math, 35% Physics, 25% Chemistry during practice phase…',
        latencyMs: 1_840,
        timestamp: new Date(now - 17_866_000).toISOString(),
        metadata: { provider: 'gemini', model: 'gemini-1.5-flash', tokens: 312 },
      },
      {
        traceId: 'mock-t1-n5',
        rootTraceId: 'mock-blog-cta-001',
        parentTraceId: 'mock-t1-n4',
        nodeType: 'output',
        agentId: 'sage',
        action: 'output:delivered',
        inputSummary: 'LLM response text (312 tokens)',
        outputSummary: 'For JEE Main, a proven split is 40% Math, 35% Physics, 25% Chemistry…',
        latencyMs: 12,
        timestamp: new Date(now - 17_854_000).toISOString(),
      },
    ],
    totalLatencyMs: 1_952,
    agentsInvolved: ['sage'],
    promptsUsed: ['sage-adaptive-v1'],
    createdAt: new Date(now - 18_000_000).toISOString(),
    completedAt: new Date(now - 17_854_000).toISOString(),
  };

  // ── Trace 2: Direct Chat → Sage ─────────────────────────────────────────────
  const t2: TraceTree = {
    rootTraceId: 'mock-direct-chat-002',
    context: {
      sessionId: 'sess-direct-002',
      examType: 'NEET',
      entryPoint: 'chat_direct',
      referrerUrl: undefined,
    },
    nodes: [
      {
        traceId: 'mock-t2-n1',
        rootTraceId: 'mock-direct-chat-002',
        nodeType: 'entry',
        action: 'entry:chat_direct',
        inputSummary: 'direct',
        outputSummary: 'session=sess-direct-002',
        timestamp: new Date(now - 3_600_000).toISOString(),
      },
      {
        traceId: 'mock-t2-n2',
        rootTraceId: 'mock-direct-chat-002',
        parentTraceId: 'mock-t2-n1',
        nodeType: 'intent',
        action: 'explain_concept',
        inputSummary: 'Explain the mechanism of action of ACh at neuromuscular junction',
        outputSummary: '→ sage (confidence 0.87)',
        latencyMs: 41,
        timestamp: new Date(now - 3_599_959).toISOString(),
      },
      {
        traceId: 'mock-t2-n3',
        rootTraceId: 'mock-direct-chat-002',
        parentTraceId: 'mock-t2-n2',
        nodeType: 'sub_agent_call',
        agentId: 'sage',
        subAgentId: 'Socratic',
        promptId: 'sage-socratic-v2',
        promptVersion: '2.3.1',
        action: 'sub_agent:Socratic',
        inputSummary: 'explain_concept — NEET Biology — neuromuscular junction',
        outputSummary: 'Socratic mode activated; persona: NEET student, Biology strength=medium',
        latencyMs: 55,
        timestamp: new Date(now - 3_599_904).toISOString(),
      },
      {
        traceId: 'mock-t2-n4',
        rootTraceId: 'mock-direct-chat-002',
        parentTraceId: 'mock-t2-n3',
        nodeType: 'llm_call',
        agentId: 'sage',
        subAgentId: 'Socratic',
        promptId: 'sage-socratic-v2',
        promptVersion: '2.3.1',
        action: 'llm:gemini-1.5-flash',
        inputSummary: '[system: Socratic tutor, NEET focus] Explain ACh mechanism at NMJ',
        outputSummary: 'When a nerve impulse arrives at the axon terminal, Ca²⁺ ions enter and trigger ACh vesicle fusion…',
        latencyMs: 2_210,
        timestamp: new Date(now - 3_599_849).toISOString(),
        metadata: { provider: 'gemini', model: 'gemini-1.5-flash', tokens: 428 },
      },
      {
        traceId: 'mock-t2-n5',
        rootTraceId: 'mock-direct-chat-002',
        parentTraceId: 'mock-t2-n4',
        nodeType: 'output',
        agentId: 'sage',
        action: 'output:delivered',
        inputSummary: 'LLM response (428 tokens)',
        outputSummary: 'When a nerve impulse arrives at the axon terminal, Ca²⁺ ions enter…',
        latencyMs: 9,
        timestamp: new Date(now - 3_599_640).toISOString(),
      },
    ],
    totalLatencyMs: 2_315,
    agentsInvolved: ['sage'],
    promptsUsed: ['sage-socratic-v2'],
    createdAt: new Date(now - 3_600_000).toISOString(),
    completedAt: new Date(now - 3_599_640).toISOString(),
  };

  // ── Trace 3: Practice → Sage ────────────────────────────────────────────────
  const t3: TraceTree = {
    rootTraceId: 'mock-practice-003',
    context: {
      sessionId: 'sess-practice-003',
      examType: 'CAT',
      entryPoint: 'practice',
      referrerUrl: '/practice',
      blogTopic: 'Quant Problem Sets — CAT',
    },
    nodes: [
      {
        traceId: 'mock-t3-n1',
        rootTraceId: 'mock-practice-003',
        nodeType: 'entry',
        action: 'entry:practice',
        inputSummary: 'referrer=/practice · topic=Quant Problem Sets — CAT',
        outputSummary: 'session=sess-practice-003',
        timestamp: new Date(now - 900_000).toISOString(),
      },
      {
        traceId: 'mock-t3-n2',
        rootTraceId: 'mock-practice-003',
        parentTraceId: 'mock-t3-n1',
        nodeType: 'intent',
        action: 'generate_questions',
        inputSummary: 'Give me 5 hard CAT-level data interpretation questions',
        outputSummary: '→ sage (confidence 0.94)',
        latencyMs: 35,
        timestamp: new Date(now - 899_965).toISOString(),
      },
      {
        traceId: 'mock-t3-n3',
        rootTraceId: 'mock-practice-003',
        parentTraceId: 'mock-t3-n2',
        nodeType: 'agent_call',
        agentId: 'sage',
        subAgentId: 'QuestionForge',
        promptId: 'sage-question-forge-v1',
        promptVersion: '1.2.0',
        action: 'route:sage/QuestionForge',
        inputSummary: 'generate_questions — CAT DI — difficulty=hard — count=5',
        outputSummary: 'QuestionForge activated; CAT DI template loaded',
        latencyMs: 48,
        timestamp: new Date(now - 899_917).toISOString(),
      },
      {
        traceId: 'mock-t3-n4',
        rootTraceId: 'mock-practice-003',
        parentTraceId: 'mock-t3-n3',
        nodeType: 'llm_call',
        agentId: 'sage',
        subAgentId: 'QuestionForge',
        promptId: 'sage-question-forge-v1',
        promptVersion: '1.2.0',
        action: 'llm:anthropic-claude-3-haiku',
        inputSummary: '[system: Question generator, CAT] 5 hard DI questions with answer keys',
        outputSummary: 'Q1: A company had revenues of ₹120 Cr in 2022... [5 questions with solutions generated]',
        latencyMs: 3_120,
        timestamp: new Date(now - 899_869).toISOString(),
        metadata: { provider: 'anthropic', model: 'claude-3-haiku', tokens: 820 },
      },
      {
        traceId: 'mock-t3-n5',
        rootTraceId: 'mock-practice-003',
        parentTraceId: 'mock-t3-n4',
        nodeType: 'output',
        agentId: 'sage',
        action: 'output:delivered',
        inputSummary: 'LLM response (820 tokens) — 5 DI questions',
        outputSummary: '5 CAT-level DI questions with full solutions delivered',
        latencyMs: 14,
        timestamp: new Date(now - 899_735).toISOString(),
      },
    ],
    totalLatencyMs: 3_217,
    agentsInvolved: ['sage'],
    promptsUsed: ['sage-question-forge-v1'],
    createdAt: new Date(now - 900_000).toISOString(),
    completedAt: new Date(now - 899_735).toISOString(),
  };

  return [t1, t2, t3];
}
