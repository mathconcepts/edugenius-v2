/**
 * Admin Feedback Dashboard — L2 Human Review Interface
 * Full context, audit trail, assignment, and resolution tools
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Clock, CheckCircle, User, Eye, Send,
  BarChart3, RefreshCw, ChevronDown, ChevronRight,
  ArrowUpCircle, Inbox, Filter
} from 'lucide-react';
import { clsx } from 'clsx';

// ---- Types ---------------------------------------------------------------
interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorName: string;
  action: string;
  details: string;
  previousStatus?: string;
  newStatus?: string;
}

interface AdminTicket {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: string;
  quality: { score: number; sentiment: string; urgency: string };
  sla: { l1DueAt: string; l2DueAt?: string; breached: boolean; l1DeadlineMinutes: number; l2DeadlineMinutes: number };
  auditTrail: AuditEntry[];
  createdAt: string;
  l1Response?: { response: string; confidenceScore: number; qualityCheckPassed: boolean; resolutionType: string; escalationReason?: string; completedAt?: string };
  l2Response?: { assignedTo?: string; response?: string; resolution?: string };
}

interface FeedbackStats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  slaCompliancePercent: number;
  avgSatisfactionRating: number;
  l1AutoResolutionRate: number;
  escalationRate: number;
}

// ---- Mock Data ----------------------------------------------------------
const MOCK_PENDING: AdminTicket[] = [
  {
    id: 'TKT-2026-000002',
    userId: 'user_abc123',
    title: 'App crashes on Practice mode',
    description: 'Every time I try to start a practice session in JEE Main, the app crashes within 3 seconds. I tried refreshing, clearing cache, and different browsers. The problem persists. My browser is Chrome 121.',
    category: 'technical_bug',
    priority: 'high',
    status: 'l2_escalated',
    quality: { score: 90, sentiment: 'negative', urgency: 'urgent' },
    sla: { l1DueAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), l2DueAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), breached: true, l1DeadlineMinutes: 60, l2DeadlineMinutes: 240 },
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    auditTrail: [
      { id: 'a1', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), actor: 'system', actorName: 'EduGenius System', action: 'ticket_created', details: 'Ticket created. Category: technical_bug. Priority: high.', newStatus: 'open' },
      { id: 'a2', timestamp: new Date(Date.now() - 118 * 60 * 1000).toISOString(), actor: 'system', actorName: 'EduGenius System', action: 'l1_submitted', details: 'Ticket routed to Forge L1 agent.', previousStatus: 'open', newStatus: 'l1_processing' },
      { id: 'a3', timestamp: new Date(Date.now() - 115 * 60 * 1000).toISOString(), actor: 'ai_l1', actorName: 'Forge Agent', action: 'l1_responded', details: 'L1 attempted resolution. Confidence: 55%. Quality check: FAILED — confidence below 60% threshold for high priority.', previousStatus: 'l1_processing', newStatus: 'l2_escalated' },
      { id: 'a4', timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), actor: 'system', actorName: 'SLA Monitor', action: 'sla_breached', details: 'L1 SLA breached. Auto-escalated to L2.', newStatus: 'l2_escalated' },
    ],
    l1Response: { response: 'Hi Student 👋\n\nSorry for the slow experience...', confidenceScore: 55, qualityCheckPassed: false, resolutionType: 'workaround_provided', escalationReason: 'Confidence below threshold for high priority ticket' },
  },
  {
    id: 'TKT-2026-000005',
    userId: 'user_xyz789',
    title: 'Charged twice for subscription',
    description: 'My bank account was charged ₹2,999 twice on 18th February. Transaction IDs: UTR123456789 and UTR987654321. Please refund the duplicate charge immediately.',
    category: 'payment_issue',
    priority: 'critical',
    status: 'l2_escalated',
    quality: { score: 95, sentiment: 'negative', urgency: 'urgent' },
    sla: { l1DueAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), l2DueAt: new Date(Date.now() + 55 * 60 * 1000).toISOString(), breached: false, l1DeadlineMinutes: 15, l2DeadlineMinutes: 60 },
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    auditTrail: [
      { id: 'b1', timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), actor: 'system', actorName: 'EduGenius System', action: 'ticket_created', details: 'Ticket created. Category: payment_issue. Priority: critical. Payment issues always escalate to L2.', newStatus: 'open' },
      { id: 'b2', timestamp: new Date(Date.now() - 44 * 60 * 1000).toISOString(), actor: 'ai_l1', actorName: 'Mentor Agent', action: 'l1_escalated', details: 'Payment issue — intentional escalation to L2. Provided preliminary info to user.', previousStatus: 'l1_processing', newStatus: 'l2_escalated' },
    ],
    l1Response: { response: 'Hi Student 👋\n\nI\'m sorry for any payment confusion...', confidenceScore: 30, qualityCheckPassed: false, resolutionType: 'escalated', escalationReason: 'Payment issues require human verification and finance team access' },
  },
];

const MOCK_STATS: FeedbackStats = {
  total: 47,
  byStatus: { open: 3, l1_processing: 2, l1_resolved: 8, l2_escalated: 2, l2_processing: 1, resolved: 28, closed: 3 },
  byCategory: { content_error: 12, technical_bug: 9, payment_issue: 5, general_feedback: 8, feature_request: 7, ai_behavior: 4, other: 2 },
  byPriority: { critical: 3, high: 12, medium: 24, low: 8 },
  slaCompliancePercent: 87.5,
  avgSatisfactionRating: 4.1,
  l1AutoResolutionRate: 72,
  escalationRate: 15,
};

// ---- Helpers -----------------------------------------------------------
const PRIORITY_COLOR: Record<string, string> = { critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-surface-400' };
const STATUS_COLOR: Record<string, string> = { open: 'text-blue-400', l1_processing: 'text-yellow-400', l2_escalated: 'text-orange-400', l2_processing: 'text-purple-400', resolved: 'text-green-400', closed: 'text-surface-400' };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function timeUntil(iso?: string) {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return 'OVERDUE';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ---- Resolve Dialog -------------------------------------------------------
function ResolveDialog({ ticket, onClose, onResolved }: { ticket: AdminTicket; onClose: () => void; onResolved: (t: AdminTicket) => void }) {
  const [response, setResponse] = useState('');
  const [resolution, setResolution] = useState<'resolved' | 'partial' | 'rejected' | 'duplicate'>('resolved');
  const [internalNote, setInternalNote] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500)); // Simulate API
    onResolved({ ...ticket, status: 'resolved', l2Response: { response, resolution } });
    setSubmitting(false);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-surface-800 rounded-2xl border border-surface-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-5 border-b border-surface-700 flex items-center justify-between sticky top-0 bg-surface-800">
          <h2 className="text-white font-semibold">Resolve Ticket {ticket.id}</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-white">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Original complaint */}
          <div className="bg-surface-900 rounded-lg p-4">
            <p className="text-surface-400 text-xs font-medium mb-2">USER'S COMPLAINT</p>
            <p className="text-white text-sm font-medium mb-1">{ticket.title}</p>
            <p className="text-surface-300 text-sm">{ticket.description}</p>
          </div>

          {/* L1 attempt */}
          {ticket.l1Response && (
            <div className="bg-surface-900 rounded-lg p-4 border border-yellow-500/20">
              <p className="text-yellow-400 text-xs font-medium mb-2">AI L1 ATTEMPT (Confidence: {ticket.l1Response.confidenceScore}% — FAILED quality check)</p>
              <p className="text-surface-300 text-sm">{ticket.l1Response.escalationReason}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-surface-400 text-sm mb-1 block">Resolution Type</label>
                <select value={resolution} onChange={(e) => setResolution(e.target.value as any)} className="input w-full text-sm">
                  <option value="resolved">✅ Resolved</option>
                  <option value="partial">⚠️ Partially Resolved</option>
                  <option value="rejected">❌ Rejected (not valid)</option>
                  <option value="duplicate">🔁 Duplicate</option>
                </select>
              </div>
              <div>
                <label className="text-surface-400 text-sm mb-1 block">Action Taken</label>
                <input type="text" value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} className="input w-full text-sm" placeholder="e.g., Issued refund ₹2,999" />
              </div>
            </div>

            <div>
              <label className="text-surface-400 text-sm mb-1 block">Response to User <span className="text-red-400">*</span></label>
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={5}
                className="input w-full text-sm resize-none"
                placeholder="Write a clear, empathetic response that the user will see..."
                required
              />
            </div>

            <div>
              <label className="text-surface-400 text-sm mb-1 block">Internal Note (not shown to user)</label>
              <textarea
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                rows={2}
                className="input w-full text-sm resize-none bg-yellow-900/10 border-yellow-500/20"
                placeholder="Notes for the team — root cause, follow-up actions, etc."
              />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 btn-secondary">Cancel</button>
              <button type="submit" disabled={submitting || !response.trim()} className="flex-1 btn-primary">
                {submitting ? 'Submitting...' : '✓ Resolve & Notify User'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---- Audit Trail ---------------------------------------------------------
function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  return (
    <div className="space-y-3">
      {entries.map((e, idx) => (
        <div key={e.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={clsx('w-2 h-2 rounded-full mt-1.5', e.actor === 'system' ? 'bg-surface-500' : e.actor.startsWith('ai') ? 'bg-blue-500' : e.actor === 'user' ? 'bg-green-500' : 'bg-purple-500')} />
            {idx < entries.length - 1 && <div className="w-px flex-1 bg-surface-700 mt-1" />}
          </div>
          <div className="pb-3 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-white text-xs font-medium">{e.actorName}</span>
              <span className="text-surface-500 text-xs">{timeAgo(e.timestamp)}</span>
              {e.newStatus && <span className={clsx('text-xs', STATUS_COLOR[e.newStatus] ?? 'text-surface-400')}>→ {e.newStatus.replace(/_/g, ' ')}</span>}
            </div>
            <p className="text-surface-400 text-xs">{e.details}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Ticket Row ----------------------------------------------------------
function AdminTicketRow({ ticket, onResolve }: { ticket: AdminTicket; onResolve: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const l2Due = timeUntil(ticket.sla.l2DueAt);
  const isOverdue = l2Due === 'OVERDUE';

  return (
    <div className={clsx('bg-surface-800 rounded-xl border overflow-hidden', ticket.sla.breached ? 'border-red-500/50' : 'border-surface-700')}>
      <div className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={clsx('text-xs font-bold', PRIORITY_COLOR[ticket.priority])}>{ticket.priority.toUpperCase()}</span>
              <span className="text-surface-500 text-xs font-mono">{ticket.id}</span>
              <span className="text-xs text-surface-400 capitalize bg-surface-700 px-2 py-0.5 rounded">{ticket.category.replace(/_/g, ' ')}</span>
              {ticket.sla.breached && <span className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> L1 BREACHED</span>}
            </div>
            <h3 className="text-white font-medium text-sm">{ticket.title}</h3>
            <p className="text-surface-400 text-xs mt-0.5 truncate">{ticket.description}</p>
            <div className="flex items-center gap-4 mt-2 text-xs">
              <span className="text-surface-500">Created: {timeAgo(ticket.createdAt)}</span>
              <span className={clsx(isOverdue ? 'text-red-400 font-bold' : 'text-orange-400')}>
                L2 SLA: {l2Due}
              </span>
              <span className="text-surface-500">Quality: {ticket.quality.score}/100</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onResolve} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
              <Send className="w-3 h-3" /> Resolve
            </button>
            <button onClick={() => setExpanded(!expanded)} className="text-surface-400 hover:text-white p-1">
              <ChevronRight className={clsx('w-4 h-4 transition-transform', expanded && 'rotate-90')} />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-surface-700"
          >
            <div className="p-4 grid grid-cols-2 gap-6">
              {/* Full description + L1 context */}
              <div className="space-y-4">
                <div>
                  <p className="text-surface-400 text-xs font-medium mb-2">FULL COMPLAINT</p>
                  <p className="text-surface-200 text-sm bg-surface-900 p-3 rounded-lg">{ticket.description}</p>
                </div>
                {ticket.l1Response && (
                  <div>
                    <p className="text-surface-400 text-xs font-medium mb-2">AI L1 RESPONSE</p>
                    <div className="bg-surface-900 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={clsx('text-xs', ticket.l1Response.qualityCheckPassed ? 'text-green-400' : 'text-red-400')}>
                          {ticket.l1Response.qualityCheckPassed ? '✓ Quality passed' : '✗ Quality failed'}
                        </span>
                        <span className="text-surface-500 text-xs">Confidence: {ticket.l1Response.confidenceScore}%</span>
                      </div>
                      <p className="text-surface-300 text-xs">{ticket.l1Response.escalationReason}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Audit trail */}
              <div>
                <p className="text-surface-400 text-xs font-medium mb-3">AUDIT TRAIL</p>
                <AuditTimeline entries={ticket.auditTrail} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- Main Page ----------------------------------------------------------
export default function AdminFeedbackPage() {
  const [tickets, setTickets] = useState<AdminTicket[]>(MOCK_PENDING);
  const [resolvingTicket, setResolvingTicket] = useState<AdminTicket | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'stats'>('queue');

  const handleResolved = (updated: AdminTicket) => {
    setTickets((prev) => prev.filter((t) => t.id !== updated.id));
    setResolvingTicket(null);
  };

  const stats = MOCK_STATS;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Feedback & Complaints</h1>
          <p className="text-surface-400 mt-1">L2 Human Review Queue — {tickets.length} pending</p>
        </div>
        <div className="flex items-center gap-2">
          {tickets.some((t) => t.priority === 'critical') && (
            <span className="flex items-center gap-1 text-red-400 text-sm bg-red-900/20 px-3 py-1.5 rounded-lg border border-red-500/30">
              <AlertTriangle className="w-4 h-4" /> {tickets.filter((t) => t.priority === 'critical').length} CRITICAL
            </span>
          )}
          <button onClick={() => setActiveTab('queue')} className={clsx('px-4 py-2 rounded-lg text-sm font-medium', activeTab === 'queue' ? 'bg-primary-500 text-white' : 'bg-surface-700 text-surface-300')}>
            <Inbox className="w-4 h-4 inline mr-1" /> Queue
          </button>
          <button onClick={() => setActiveTab('stats')} className={clsx('px-4 py-2 rounded-lg text-sm font-medium', activeTab === 'stats' ? 'bg-primary-500 text-white' : 'bg-surface-700 text-surface-300')}>
            <BarChart3 className="w-4 h-4 inline mr-1" /> Analytics
          </button>
        </div>
      </div>

      {activeTab === 'queue' && (
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <div className="text-center py-16 bg-surface-800 rounded-xl border border-surface-700">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-white font-medium">All caught up! 🎉</p>
              <p className="text-surface-400 text-sm mt-1">No tickets pending L2 review</p>
            </div>
          ) : (
            tickets
              .sort((a, b) => {
                // Critical first, then by SLA remaining
                if (a.priority === 'critical' && b.priority !== 'critical') return -1;
                if (b.priority === 'critical' && a.priority !== 'critical') return 1;
                const aRemaining = (a.sla.l2DueAt ? new Date(a.sla.l2DueAt).getTime() : Infinity) - Date.now();
                const bRemaining = (b.sla.l2DueAt ? new Date(b.sla.l2DueAt).getTime() : Infinity) - Date.now();
                return aRemaining - bRemaining;
              })
              .map((ticket) => (
                <AdminTicketRow
                  key={ticket.id}
                  ticket={ticket}
                  onResolve={() => setResolvingTicket(ticket)}
                />
              ))
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Tickets', value: stats.total, sub: 'all time' },
              { label: 'SLA Compliance', value: `${stats.slaCompliancePercent.toFixed(1)}%`, sub: stats.slaCompliancePercent >= 90 ? '✓ Healthy' : '⚠️ Below target', color: stats.slaCompliancePercent >= 90 ? 'text-green-400' : 'text-red-400' },
              { label: 'AI Resolution Rate', value: `${stats.l1AutoResolutionRate}%`, sub: 'tickets resolved by AI', color: 'text-blue-400' },
              { label: 'Avg Satisfaction', value: `${stats.avgSatisfactionRating.toFixed(1)}★`, sub: 'out of 5', color: 'text-yellow-400' },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-surface-800 rounded-xl p-4 border border-surface-700">
                <p className={clsx('text-3xl font-bold', kpi.color ?? 'text-white')}>{kpi.value}</p>
                <p className="text-surface-300 text-sm font-medium mt-1">{kpi.label}</p>
                <p className="text-surface-500 text-xs mt-0.5">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* By Category */}
          <div className="bg-surface-800 rounded-xl border border-surface-700 p-5">
            <h3 className="text-white font-semibold mb-4">Complaints by Category</h3>
            <div className="space-y-3">
              {Object.entries(stats.byCategory).sort(([, a], [, b]) => (b as number) - (a as number)).map(([cat, count]) => (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-surface-400 text-sm w-40 capitalize">{cat.replace(/_/g, ' ')}</span>
                  <div className="flex-1 bg-surface-700 rounded-full h-2">
                    <div className="bg-primary-500 h-full rounded-full" style={{ width: `${((count as number) / stats.total) * 100}%` }} />
                  </div>
                  <span className="text-white text-sm w-8 text-right">{count as number}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Resolution breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-800 rounded-xl border border-surface-700 p-5">
              <h3 className="text-white font-semibold mb-4">By Status</h3>
              <div className="space-y-2">
                {Object.entries(stats.byStatus).map(([status, count]) => (
                  <div key={status} className="flex justify-between text-sm">
                    <span className={clsx('capitalize', STATUS_COLOR[status] ?? 'text-surface-400')}>{status.replace(/_/g, ' ')}</span>
                    <span className="text-white font-medium">{count as number}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-surface-800 rounded-xl border border-surface-700 p-5">
              <h3 className="text-white font-semibold mb-4">By Priority</h3>
              <div className="space-y-2">
                {Object.entries(stats.byPriority).map(([priority, count]) => (
                  <div key={priority} className="flex justify-between text-sm">
                    <span className={clsx('capitalize', PRIORITY_COLOR[priority])}>{priority}</span>
                    <span className="text-white font-medium">{count as number}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Dialog */}
      {resolvingTicket && (
        <ResolveDialog
          ticket={resolvingTicket}
          onClose={() => setResolvingTicket(null)}
          onResolved={handleResolved}
        />
      )}
    </div>
  );
}
