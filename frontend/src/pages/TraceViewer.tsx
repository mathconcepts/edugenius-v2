/**
 * TraceViewer — End-to-end bidirectional trace explorer
 * Route: /trace (list) and /trace/:traceId (detail)
 * CEO + Admin only
 */

import { useState, type ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ChevronDown, ChevronUp, Clock, Link2, Layers,
  Cpu, MessageSquare, Globe, Rss, Activity, Database,
  AlertCircle, Check, RefreshCw,
} from 'lucide-react';
import {
  listRecentTraces,
  loadTrace,
  buildMockTraces,
} from '@/services/traceabilityEngine';
import type { TraceTree, TraceNode } from '@/services/traceabilityEngine';

// ─── Agent colour map ──────────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  sage:   'text-blue-400 bg-blue-500/10 border-blue-500/30',
  atlas:  'text-purple-400 bg-purple-500/10 border-purple-500/30',
  mentor: 'text-green-400 bg-green-500/10 border-green-500/30',
  scout:  'text-red-400 bg-red-500/10 border-red-500/30',
  herald: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
  oracle: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  forge:  'text-gray-400 bg-gray-500/10 border-gray-500/30',
};

const AGENT_DOT: Record<string, string> = {
  sage:   'bg-blue-400',
  atlas:  'bg-purple-400',
  mentor: 'bg-green-400',
  scout:  'bg-red-400',
  herald: 'bg-indigo-400',
  oracle: 'bg-orange-400',
  forge:  'bg-gray-400',
};

// ─── Node type visuals ─────────────────────────────────────────────────────────

const NODE_TYPE_CONFIG: Record<
  TraceNode['nodeType'],
  { icon: ReactNode; label: string; lineColor: string }
> = {
  entry:         { icon: <Globe className="w-3.5 h-3.5" />,        label: 'Entry',         lineColor: 'border-primary-500/40' },
  intent:        { icon: <Activity className="w-3.5 h-3.5" />,     label: 'Intent',        lineColor: 'border-yellow-500/40' },
  agent_call:    { icon: <Cpu className="w-3.5 h-3.5" />,          label: 'Agent Call',    lineColor: 'border-blue-500/40' },
  sub_agent_call:{ icon: <Layers className="w-3.5 h-3.5" />,       label: 'Sub-Agent',     lineColor: 'border-purple-500/40' },
  llm_call:      { icon: <MessageSquare className="w-3.5 h-3.5" />,label: 'LLM Call',      lineColor: 'border-accent-500/40' },
  output:        { icon: <Check className="w-3.5 h-3.5" />,        label: 'Output',        lineColor: 'border-green-500/40' },
  blog_publish:  { icon: <Rss className="w-3.5 h-3.5" />,          label: 'Blog Publish',  lineColor: 'border-orange-500/40' },
  blog_signal:   { icon: <Database className="w-3.5 h-3.5" />,     label: 'Blog Signal',   lineColor: 'border-red-500/40' },
  emotion_signal:{ icon: <Activity className="w-3.5 h-3.5" />,     label: 'Emotion',       lineColor: 'border-pink-500/40' },
};

// ─── Entry point badge ─────────────────────────────────────────────────────────

function EntryPointBadge({ entryPoint }: { entryPoint: string }) {
  const map: Record<string, { label: string; color: string }> = {
    chat_direct:   { label: '💬 Direct Chat',       color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    blog_cta:      { label: '📰 Blog CTA',           color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
    blog_internal: { label: '🔗 Blog Internal Link', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
    practice:      { label: '✏️ Practice',           color: 'text-green-400 bg-green-500/10 border-green-500/20' },
    dashboard:     { label: '📊 Dashboard',          color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    external_link: { label: '🌐 External Link',      color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  };
  const cfg = map[entryPoint] ?? { label: entryPoint, color: 'text-surface-400 bg-surface-800 border-surface-700' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ─── Timeline node ─────────────────────────────────────────────────────────────

function TimelineNode({ node, isLast }: { node: TraceNode; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const cfg = NODE_TYPE_CONFIG[node.nodeType] ?? NODE_TYPE_CONFIG.entry;
  const agentColor = node.agentId ? (AGENT_COLORS[node.agentId] ?? 'text-surface-400 bg-surface-800 border-surface-700') : '';

  return (
    <div className="flex gap-3">
      {/* Left: connector */}
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center border ${agentColor || 'bg-surface-800 border-surface-700 text-surface-400'} flex-shrink-0`}>
          {cfg.icon}
        </div>
        {!isLast && <div className={`w-px flex-1 mt-1 border-l-2 border-dashed ${cfg.lineColor}`} style={{ minHeight: 24 }} />}
      </div>

      {/* Right: content */}
      <div className="flex-1 pb-5">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-surface-300 uppercase tracking-wide">{cfg.label}</span>
          {node.agentId && (
            <span className={`text-xs px-1.5 py-0.5 rounded border ${agentColor}`}>
              {node.agentId}{node.subAgentId ? `/${node.subAgentId}` : ''}
            </span>
          )}
          {node.latencyMs !== undefined && (
            <span className="text-xs text-surface-600 flex items-center gap-0.5">
              <Clock className="w-3 h-3" /> {node.latencyMs}ms
            </span>
          )}
          <span className="text-xs text-surface-600 ml-auto">
            {new Date(node.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        <p className="text-sm font-mono text-primary-400 mb-0.5">{node.action}</p>

        <div className="bg-surface-800/60 rounded-lg border border-surface-700/50 p-2.5 text-xs text-surface-400 space-y-1">
          <div><span className="text-surface-500">In: </span>{node.inputSummary}</div>
          <div><span className="text-surface-500">Out: </span>{node.outputSummary}</div>
        </div>

        {/* Prompt details — expandable for llm_call */}
        {node.nodeType === 'llm_call' && node.promptId && (
          <button
            onClick={() => setOpen(o => !o)}
            className="mt-2 flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors"
          >
            {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Prompt details
          </button>
        )}
        <AnimatePresence>
          {open && node.promptId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 p-3 bg-surface-900 rounded-lg border border-primary-500/20 text-xs space-y-1 overflow-hidden"
            >
              <div className="flex gap-2">
                <span className="text-surface-500">Prompt ID:</span>
                <span className="font-mono text-primary-400">{node.promptId}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-surface-500">Version:</span>
                <span className="font-mono text-accent-400">{node.promptVersion ?? '—'}</span>
              </div>
              {!!node.metadata?.provider && (
                <div className="flex gap-2">
                  <span className="text-surface-500">Provider:</span>
                  <span className="text-white">{String(node.metadata.provider)}</span>
                </div>
              )}
              {!!node.metadata?.tokens && (
                <div className="flex gap-2">
                  <span className="text-surface-500">Tokens:</span>
                  <span className="text-white">{String(node.metadata.tokens)}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Trace Detail View ─────────────────────────────────────────────────────────

function TraceDetail({ tree, isDemo }: { tree: TraceTree; isDemo?: boolean }) {
  const navigate = useNavigate();
  const ctx = tree.context;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate('/trace')}
        className="flex items-center gap-2 text-surface-400 hover:text-white transition-colors mb-6 text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Trace List
      </button>

      {/* Demo badge */}
      {isDemo && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-xs">
          <AlertCircle className="w-4 h-4" />
          Demo data — no real traces recorded yet. Interact with the chat to generate live traces.
        </div>
      )}

      {/* Summary card */}
      <div className="glass rounded-xl p-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs text-surface-500 mb-1 font-mono">{tree.rootTraceId}</p>
            <h2 className="text-lg font-bold text-white">Trace Details</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <EntryPointBadge entryPoint={ctx.entryPoint} />
            {tree.completedAt ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">Completed</span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> In progress
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-surface-500 text-xs mb-0.5">Total Latency</p>
            <p className="text-white font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-accent-400" />
              {tree.totalLatencyMs.toLocaleString()}ms
            </p>
          </div>
          <div>
            <p className="text-surface-500 text-xs mb-0.5">Agents</p>
            <div className="flex gap-1 flex-wrap">
              {tree.agentsInvolved.map(a => (
                <span key={a} className={`text-xs px-1.5 py-0.5 rounded border ${AGENT_COLORS[a] ?? 'text-surface-400 bg-surface-800 border-surface-700'}`}>
                  {a}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-surface-500 text-xs mb-0.5">Prompts Used</p>
            <div className="flex gap-1 flex-wrap">
              {tree.promptsUsed.map(p => (
                <span key={p} className="text-xs font-mono text-primary-400">{p}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-surface-500 text-xs mb-0.5">Nodes</p>
            <p className="text-white font-semibold">{tree.nodes.length}</p>
          </div>
        </div>

        {/* Extra context */}
        <div className="mt-4 pt-4 border-t border-surface-700/50 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-surface-400">
          {ctx.referrerUrl && (
            <div className="flex gap-2">
              <span className="text-surface-500">Referrer:</span>
              <Link to={ctx.referrerUrl} className="text-primary-400 hover:underline truncate">{ctx.referrerUrl}</Link>
            </div>
          )}
          {ctx.blogSlug && (
            <div className="flex gap-2">
              <span className="text-surface-500">Blog Slug:</span>
              <span className="font-mono">{ctx.blogSlug}</span>
            </div>
          )}
          {ctx.utmSource && (
            <div className="flex gap-2">
              <span className="text-surface-500">UTM:</span>
              <span>{ctx.utmSource}{ctx.utmMedium ? ` / ${ctx.utmMedium}` : ''}{ctx.utmCampaign ? ` / ${ctx.utmCampaign}` : ''}</span>
            </div>
          )}
          {ctx.examType && (
            <div className="flex gap-2">
              <span className="text-surface-500">Exam:</span>
              <span className="text-accent-400">{ctx.examType}</span>
            </div>
          )}
          {ctx.blogTopic && (
            <div className="flex gap-2 col-span-2">
              <span className="text-surface-500">Topic:</span>
              <span className="text-white">{ctx.blogTopic}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-surface-500">Session:</span>
            <span className="font-mono">{ctx.sessionId}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-surface-500">Created:</span>
            <span>{new Date(tree.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary-400" /> Trace Timeline
        </h3>
        <div>
          {tree.nodes.map((node, i) => (
            <TimelineNode key={node.traceId} node={node} isLast={i === tree.nodes.length - 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Trace List Card ───────────────────────────────────────────────────────────

function TraceCard({ tree, isDemo }: { tree: TraceTree; isDemo?: boolean }) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate(`/trace/${tree.rootTraceId}`)}
      className="glass rounded-xl p-4 cursor-pointer hover:border-primary-500/40 border border-surface-700/50 transition-all group"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <EntryPointBadge entryPoint={tree.context.entryPoint} />
          {isDemo && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">demo</span>
          )}
        </div>
        <span className="text-xs text-surface-600">
          {new Date(tree.createdAt).toLocaleString()}
        </span>
      </div>

      <p className="text-xs font-mono text-surface-500 mb-2 truncate">{tree.rootTraceId}</p>

      {tree.context.blogTopic && (
        <p className="text-sm text-white mb-2 line-clamp-1">📖 {tree.context.blogTopic}</p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-surface-400">
        {/* Agent chain */}
        <span className="flex items-center gap-1">
          {tree.agentsInvolved.map(a => (
            <span key={a} className={`w-2 h-2 rounded-full ${AGENT_DOT[a] ?? 'bg-surface-500'}`} title={a} />
          ))}
          {tree.agentsInvolved.join(' → ')}
        </span>
        <span className="flex items-center gap-1 text-surface-600">
          <Clock className="w-3 h-3" /> {tree.totalLatencyMs.toLocaleString()}ms
        </span>
        <span className="text-surface-600">{tree.nodes.length} nodes</span>
        {tree.completedAt ? (
          <span className="ml-auto text-green-400 flex items-center gap-1">
            <Check className="w-3 h-3" /> done
          </span>
        ) : (
          <span className="ml-auto text-yellow-400 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" /> live
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main TraceViewer ──────────────────────────────────────────────────────────

export function TraceViewer() {
  const { traceId } = useParams<{ traceId?: string }>();
  const navigate = useNavigate();

  // Load real traces; fall back to mock if empty
  const realTraces = listRecentTraces(20);
  const isDemo = realTraces.length === 0;
  const traces = isDemo ? buildMockTraces() : realTraces;

  // Detail view
  if (traceId) {
    const tree = loadTrace(traceId) ?? (isDemo ? traces.find(t => t.rootTraceId === traceId) : null);
    if (!tree) {
      return (
        <div className="p-8 text-center text-surface-400">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
          <p>Trace <span className="font-mono text-white">{traceId}</span> not found.</p>
          <button onClick={() => navigate('/trace')} className="mt-4 btn-primary px-4 py-2 rounded-lg text-sm">
            Back to list
          </button>
        </div>
      );
    }
    return (
      <div className="p-6">
        <TraceDetail tree={tree} isDemo={isDemo} />
      </div>
    );
  }

  // List view
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              🔗 Trace Explorer
            </h1>
            <p className="text-surface-400 text-sm mt-1">
              End-to-end bidirectional traceability — from user entry to LLM output
            </p>
          </div>
          {isDemo && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5" /> Demo data
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-surface-500">
          {Object.entries(AGENT_COLORS).map(([agent, cls]) => (
            <span key={agent} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${cls}`}>
              <span className={`w-2 h-2 rounded-full ${AGENT_DOT[agent]}`} />
              {agent}
            </span>
          ))}
        </div>
      </div>

      {/* Demo notice */}
      {isDemo && (
        <div className="mb-6 p-4 bg-surface-800/60 rounded-xl border border-yellow-500/20 text-sm text-surface-300">
          <p className="font-medium text-yellow-300 mb-1">No live traces yet</p>
          <p className="text-surface-400 text-xs">
            Showing mock example traces. Start a chat (especially via a blog CTA) to generate real traces that appear here.
          </p>
        </div>
      )}

      {/* Trace cards */}
      <div className="space-y-3">
        {traces.map(tree => (
          <TraceCard key={tree.rootTraceId} tree={tree} isDemo={isDemo} />
        ))}
      </div>

      {traces.length === 0 && !isDemo && (
        <div className="text-center py-16 text-surface-500">
          <Link2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No traces recorded yet.</p>
        </div>
      )}
    </div>
  );
}

export default TraceViewer;
