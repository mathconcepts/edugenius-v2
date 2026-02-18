/**
 * User Feedback & My Tickets Page
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquarePlus, Clock, CheckCircle, AlertTriangle,
  ChevronRight, RefreshCw, ArrowUpCircle, Star, Search, Filter
} from 'lucide-react';
import { clsx } from 'clsx';

// ---- Types ---------------------------------------------------------------
interface Ticket {
  id: string;
  title: string;
  description: string;
  type: 'feedback' | 'complaint' | 'bug_report' | 'feature_request';
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: string;
  quality: { score: number; sentiment: string; urgency: string };
  sla: { l1DueAt: string; breached: boolean };
  createdAt: string;
  satisfactionRating?: number;
  l1Response?: { response: string; resolutionType: string; confidenceScore: number; completedAt: string; qualityCheckPassed: boolean };
}

// ---- Helpers -------------------------------------------------------------
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open:           { label: 'Open',          color: 'text-blue-400 bg-blue-900/30',   icon: <Clock className="w-3 h-3" /> },
  l1_processing:  { label: 'AI Reviewing',  color: 'text-yellow-400 bg-yellow-900/30', icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
  l1_resolved:    { label: 'Resolved (AI)', color: 'text-green-400 bg-green-900/30', icon: <CheckCircle className="w-3 h-3" /> },
  l2_escalated:   { label: 'Escalated',     color: 'text-orange-400 bg-orange-900/30', icon: <ArrowUpCircle className="w-3 h-3" /> },
  l2_processing:  { label: 'Human Review',  color: 'text-purple-400 bg-purple-900/30', icon: <RefreshCw className="w-3 h-3" /> },
  resolved:       { label: 'Resolved',      color: 'text-green-400 bg-green-900/30',  icon: <CheckCircle className="w-3 h-3" /> },
  closed:         { label: 'Closed',        color: 'text-surface-400 bg-surface-700', icon: <CheckCircle className="w-3 h-3" /> },
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-400',
  high:     'text-orange-400',
  medium:   'text-yellow-400',
  low:      'text-surface-400',
};

// ---- Mock data for demo --------------------------------------------------
const MOCK_TICKETS: Ticket[] = [
  {
    id: 'TKT-2026-000001',
    title: 'Wrong answer for integration question',
    description: 'The AI gave a wrong answer for the integral of x^2 sin(x). It forgot the integration by parts step.',
    type: 'complaint',
    category: 'content_error',
    priority: 'high',
    status: 'l1_resolved',
    quality: { score: 82, sentiment: 'negative', urgency: 'normal' },
    sla: { l1DueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), breached: false },
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    l1Response: {
      response: "Hi Student 👋\n\nThank you for flagging this — content accuracy is something we take very seriously at EduGenius.\n\nI've logged this as a content accuracy issue and flagged the specific content for the Atlas (Content) team to verify and correct.\n\nIn the meantime, the correct solution uses integration by parts twice:\n∫x²sin(x)dx = -x²cos(x) + 2x·sin(x) + 2cos(x) + C\n\nContent errors are corrected within 24 hours of verification.",
      resolutionType: 'workaround_provided',
      confidenceScore: 75,
      completedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      qualityCheckPassed: true,
    },
  },
  {
    id: 'TKT-2026-000002',
    title: 'App crashes on Practice mode',
    description: 'Every time I try to start a practice session in JEE Main, the app crashes.',
    type: 'bug_report',
    category: 'technical_bug',
    priority: 'high',
    status: 'l2_escalated',
    quality: { score: 90, sentiment: 'negative', urgency: 'urgent' },
    sla: { l1DueAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), breached: true },
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'TKT-2026-000003',
    title: 'Love the new Smart Notebook!',
    description: 'The AI-powered notebook is amazing. It saves so much time during revision.',
    type: 'feedback',
    category: 'general_feedback',
    priority: 'low',
    status: 'resolved',
    quality: { score: 95, sentiment: 'positive', urgency: 'normal' },
    sla: { l1DueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), breached: false },
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    satisfactionRating: 5,
  },
];

// ---- Components ----------------------------------------------------------
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'text-surface-400 bg-surface-700', icon: null };
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', cfg.color)}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function StarRating({ onRate }: { onRate: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  const [selected, setSelected] = useState(0);

  if (selected > 0) {
    return <p className="text-green-400 text-sm">Thanks for rating! ⭐ {selected}/5</p>;
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-surface-400 text-sm mr-2">Rate resolution:</span>
      {[1, 2, 3, 4, 5].map((r) => (
        <button
          key={r}
          onMouseEnter={() => setHover(r)}
          onMouseLeave={() => setHover(0)}
          onClick={() => { setSelected(r); onRate(r); }}
          className={clsx('text-xl transition-colors', r <= (hover || selected) ? 'text-yellow-400' : 'text-surface-600')}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function TicketCard({
  ticket,
  onExpand,
  onSatisfied,
  onEscalate,
  onRate,
}: {
  ticket: Ticket;
  onExpand: () => void;
  onSatisfied: () => void;
  onEscalate: () => void;
  onRate: (r: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const handleExpand = () => {
    setExpanded(!expanded);
    onExpand();
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
  const needsRating = isResolved && !ticket.satisfactionRating;
  const showActions = ticket.status === 'l1_resolved';

  return (
    <motion.div
      layout
      className={clsx(
        'bg-surface-800 rounded-xl border overflow-hidden',
        ticket.sla.breached ? 'border-red-500/50' : 'border-surface-700'
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <StatusBadge status={ticket.status} />
              <span className={clsx('text-xs font-medium', PRIORITY_COLOR[ticket.priority])}>
                {ticket.priority.toUpperCase()}
              </span>
              {ticket.sla.breached && (
                <span className="text-xs text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> SLA Breached
                </span>
              )}
            </div>
            <h3 className="text-white font-medium text-sm truncate">{ticket.title}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-surface-500 text-xs font-mono">{ticket.id}</span>
              <span className="text-surface-500 text-xs">{timeAgo(ticket.createdAt)}</span>
              <span className="text-surface-500 text-xs capitalize">{ticket.category.replace(/_/g, ' ')}</span>
            </div>
          </div>
          <button onClick={handleExpand} className="text-surface-400 hover:text-white p-1">
            <ChevronRight className={clsx('w-4 h-4 transition-transform', expanded && 'rotate-90')} />
          </button>
        </div>

        {/* Actions for L1-resolved tickets */}
        {showActions && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={onSatisfied}
              className="flex-1 py-1.5 text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg font-medium"
            >
              ✓ Resolved — thanks!
            </button>
            <button
              onClick={onEscalate}
              className="flex-1 py-1.5 text-xs bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 rounded-lg font-medium"
            >
              ↑ Need human help
            </button>
          </div>
        )}

        {/* Rating for resolved */}
        {needsRating && (
          <div className="mt-3 pt-3 border-t border-surface-700">
            <StarRating onRate={onRate} />
          </div>
        )}
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-surface-700"
          >
            <div className="p-4 space-y-4">
              {/* Original message */}
              <div>
                <p className="text-surface-400 text-xs font-medium mb-2">Your report:</p>
                <p className="text-surface-200 text-sm bg-surface-900 p-3 rounded-lg">{ticket.description}</p>
              </div>

              {/* Quality indicator */}
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-surface-700 rounded-full h-1.5">
                  <div
                    className={clsx('h-full rounded-full', ticket.quality.score >= 70 ? 'bg-green-500' : ticket.quality.score >= 50 ? 'bg-yellow-500' : 'bg-red-500')}
                    style={{ width: `${ticket.quality.score}%` }}
                  />
                </div>
                <span className="text-surface-400 text-xs">Report quality: {ticket.quality.score}/100</span>
              </div>

              {/* L1 Response */}
              {ticket.l1Response && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-surface-400 text-xs font-medium">AI Response:</p>
                    <span className="text-xs text-surface-500">
                      Confidence {ticket.l1Response.confidenceScore}%
                      {ticket.l1Response.qualityCheckPassed && ' ✓ Quality checked'}
                    </span>
                  </div>
                  <div className="bg-surface-900 p-3 rounded-lg">
                    <p className="text-surface-200 text-sm whitespace-pre-line">{ticket.l1Response.response}</p>
                  </div>
                </div>
              )}

              {/* Audit trail hint */}
              <p className="text-surface-500 text-xs">
                Full audit trail available in admin panel • Ticket: {ticket.id}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---- Submit Form ---------------------------------------------------------
function SubmitForm({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: (t: Ticket) => void }) {
  const [type, setType] = useState<'complaint' | 'feedback' | 'bug_report' | 'feature_request'>('complaint');
  const [category, setCategory] = useState('content_error');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const wordCount = description.split(' ').filter(Boolean).length;
  const quality = wordCount < 5 ? 'poor' : wordCount < 15 ? 'fair' : wordCount < 30 ? 'good' : 'excellent';
  const qualityColor = { poor: 'text-red-400', fair: 'text-yellow-400', good: 'text-blue-400', excellent: 'text-green-400' }[quality];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, category, title, description }),
      });

      if (response.ok) {
        const data = await response.json();
        onSubmitted({ ...data, title, description, type, category, quality: { score: Math.min(100, wordCount * 3), sentiment: 'negative', urgency: 'normal' }, sla: { l1DueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), breached: false }, createdAt: new Date().toISOString() });
      }
    } catch {
      // Mock success
      const mockId = `TKT-2026-${Math.floor(Math.random() * 999999).toString().padStart(6, '0')}`;
      onSubmitted({
        id: mockId, title, description, type, category,
        priority: 'medium', status: 'open',
        quality: { score: Math.min(100, wordCount * 3), sentiment: 'negative', urgency: 'normal' },
        sla: { l1DueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), breached: false },
        createdAt: new Date().toISOString(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-surface-800 rounded-2xl border border-surface-700 w-full max-w-lg"
      >
        <div className="p-5 border-b border-surface-700 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">Submit Feedback or Complaint</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-surface-400 text-sm mb-1 block">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as any)} className="input w-full text-sm">
                <option value="complaint">Complaint</option>
                <option value="feedback">Feedback</option>
                <option value="bug_report">Bug Report</option>
                <option value="feature_request">Feature Request</option>
              </select>
            </div>
            <div>
              <label className="text-surface-400 text-sm mb-1 block">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input w-full text-sm">
                <option value="content_error">Content Error</option>
                <option value="ai_behavior">AI Behavior</option>
                <option value="technical_bug">Technical Bug</option>
                <option value="access_denied">Access Issue</option>
                <option value="account_issue">Account Issue</option>
                <option value="payment_issue">Payment Issue</option>
                <option value="feature_request">Feature Request</option>
                <option value="general_feedback">General Feedback</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-surface-400 text-sm mb-1 block">Title <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input w-full"
              placeholder="Brief summary of your issue"
              required
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-surface-400 text-sm">Description <span className="text-red-400">*</span></label>
              <span className={clsx('text-xs', qualityColor)}>
                Report quality: {quality} ({wordCount} words)
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="input w-full resize-none"
              placeholder="Describe the issue in detail. Include: what happened, what you expected, steps to reproduce, and any screenshots if relevant. More detail = faster resolution."
              required
            />
            {wordCount > 0 && wordCount < 10 && (
              <p className="text-yellow-400 text-xs mt-1">💡 More detail helps our AI resolve your ticket faster — aim for at least 20 words</p>
            )}
          </div>

          <div className="bg-surface-900 rounded-lg p-3 text-xs text-surface-400">
            🤖 <strong className="text-surface-300">How it works:</strong> Our AI reviews your report immediately, then a human agent takes over if needed. Payment issues always go to a human.
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting || !title.trim() || !description.trim()} className="flex-1 btn-primary">
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ---- Main Page -----------------------------------------------------------
export default function FeedbackPage() {
  const [tickets, setTickets] = useState<Ticket[]>(MOCK_TICKETS);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const filtered = tickets.filter((t) => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleSubmitted = (ticket: Ticket) => {
    setTickets((prev) => [ticket, ...prev]);
    setShowForm(false);
  };

  const handleSatisfied = async (ticketId: string) => {
    setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, status: 'resolved' } : t));
  };

  const handleEscalate = async (ticketId: string) => {
    setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, status: 'l2_escalated' } : t));
  };

  const handleRate = async (ticketId: string, rating: number) => {
    setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, satisfactionRating: rating } : t));
  };

  const stats = {
    open: tickets.filter((t) => !['resolved', 'closed'].includes(t.status)).length,
    resolved: tickets.filter((t) => ['resolved', 'closed'].includes(t.status)).length,
    breached: tickets.filter((t) => t.sla.breached).length,
    avgRating: tickets.filter((t) => t.satisfactionRating).reduce((sum, t) => sum + (t.satisfactionRating ?? 0), 0) / Math.max(1, tickets.filter((t) => t.satisfactionRating).length),
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Tickets</h1>
          <p className="text-surface-400 mt-1">Track your feedback and complaints</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <MessageSquarePlus className="w-4 h-4" />
          New Ticket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Open', value: stats.open, color: 'text-blue-400' },
          { label: 'Resolved', value: stats.resolved, color: 'text-green-400' },
          { label: 'SLA Breached', value: stats.breached, color: 'text-red-400' },
          { label: 'Avg Rating', value: stats.avgRating > 0 ? `${stats.avgRating.toFixed(1)}★` : '—', color: 'text-yellow-400' },
        ].map((s) => (
          <div key={s.label} className="bg-surface-800 rounded-xl p-3 text-center border border-surface-700">
            <p className={clsx('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-surface-400 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or ticket ID..."
            className="input w-full pl-9 text-sm"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input text-sm">
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="l1_processing">AI Reviewing</option>
          <option value="l1_resolved">Awaiting Your Confirmation</option>
          <option value="l2_escalated">Escalated</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Ticket List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-surface-500">
            <MessageSquarePlus className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No tickets found</p>
            <button onClick={() => setShowForm(true)} className="btn-primary mt-4">Submit your first ticket</button>
          </div>
        ) : (
          filtered.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onExpand={() => {}}
              onSatisfied={() => handleSatisfied(ticket.id)}
              onEscalate={() => handleEscalate(ticket.id)}
              onRate={(r) => handleRate(ticket.id, r)}
            />
          ))
        )}
      </div>

      {/* Submit Form Modal */}
      {showForm && <SubmitForm onClose={() => setShowForm(false)} onSubmitted={handleSubmitted} />}
    </div>
  );
}
