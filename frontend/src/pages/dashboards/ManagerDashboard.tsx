/**
 * ManagerDashboard.tsx
 *
 * Full workspace for the Manager role:
 *  - Exam-scoped view (tabs per assigned exam)
 *  - L2 ticket queue with resolution panel
 *  - Student health overview (at-risk, inactive, low score)
 *  - Proactive outreach composer (all channels)
 *  - Update trigger panel (fires tasks to Atlas / Forge / Sage)
 *  - CSAT + SLA performance metrics
 *  - Nexus AI assistant sidebar
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox, Users, Megaphone, Zap, BarChart3,
  ChevronRight, ChevronDown, AlertTriangle, CheckCircle2,
  Clock, Phone, MessageSquare, Mail, Send,
  User, RefreshCw, Bot, X, Star, Filter,
  BookOpen, Cpu, ArrowRight, Flame,
} from 'lucide-react';
import { clsx } from 'clsx';

// ─── Mock data types ──────────────────────────────────────────────────────────

type Priority  = 'critical' | 'high' | 'medium' | 'low';
type TStatus   = 'l2_escalated' | 'l2_processing' | 'resolved' | 'open';
type SHealth   = 'at_risk' | 'inactive' | 'low_score' | 'healthy';
type OutType   = 'proactive_checkin' | 'at_risk_alert' | 'exam_countdown_nudge' |
                 'low_score_intervention' | 'subscription_expiry_warn' |
                 'feedback_followup' | 'welcome_call' | 'churn_rescue' | 'bulk_announcement';
type UpdateT   = 'content_fix' | 'syllabus_update' | 'difficulty_recalibrate' |
                 'agent_prompt_update' | 'exam_date_change' | 'feature_flag_toggle' | 'pricing_update';

interface Ticket {
  id: string; studentName: string; studentId: string;
  examId: string; category: string; priority: Priority; status: TStatus;
  subject: string; description: string; createdAt: string; dueAt: string;
  l1Confidence: number; escalationReason: string;
  suggestion?: string; // Nexus resolution suggestion
}
interface Student {
  id: string; name: string; exam: string; grade: number;
  plan: string; planExpiry: string; lastActive: string;
  inactiveDays: number; streak: number; recentScore: number;
  scoreTrend: 'improving' | 'stable' | 'declining';
  health: SHealth; riskReason?: string;
  channels: { email: boolean; whatsapp: boolean; telegram: boolean };
}
interface PerfMetric {
  label: string; value: string | number; unit?: string;
  color: string; icon: React.ReactNode;
}
interface UpdateTrigger {
  id: string; type: UpdateT; examId: string; description: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'in_progress' | 'deployed';
  agent: string; affected: number; createdAt: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const EXAM_SCOPES = ['JEE Main', 'NEET', 'CBSE 12'];

const MOCK_TICKETS: Ticket[] = [
  {
    id: 'TKT-00042', studentName: 'Arjun Sharma', studentId: 'STU-001',
    examId: 'JEE Main', category: 'Content Error', priority: 'critical', status: 'l2_escalated',
    subject: 'Wrong answer for Electrostatics Q12', dueAt: new Date(Date.now() + 1.5 * 3600000).toISOString(),
    description: 'The answer shown for Electrostatics Q12 (Chapter 1, JEE Mock Test 3) is wrong. The correct answer should be 4√2 N but the system shows 2N.',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(), l1Confidence: 48,
    escalationReason: 'Math content error — L1 confidence below threshold',
    suggestion: 'Verified against Wolfram: correct answer is 4√2 N. Trigger content_fix for Atlas → JEE Main Electrostatics Q12.',
  },
  {
    id: 'TKT-00039', studentName: 'Priya Nair', studentId: 'STU-002',
    examId: 'NEET', category: 'Payment Issue', priority: 'high', status: 'l2_escalated',
    subject: 'Double charged ₹2,999 on 18th Feb',
    description: 'Bank shows two debit entries UTR123456 and UTR987654 on 18th Feb for ₹2,999 each. Please refund one.',
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(), dueAt: new Date(Date.now() + 3 * 3600000).toISOString(),
    l1Confidence: 52, escalationReason: 'Payment issue requires human verification',
    suggestion: 'Check Razorpay dashboard for duplicate order. If confirmed, initiate refund via Razorpay refund API.',
  },
  {
    id: 'TKT-00036', studentName: 'Rohit Kumar', studentId: 'STU-003',
    examId: 'JEE Main', category: 'AI Behaviour', priority: 'medium', status: 'l2_processing',
    subject: 'Tutor gives circular explanations for Integration by Parts',
    description: 'Every time I ask about Integration by Parts, the AI just repeats the same formula without explaining when to use u-v rule vs other methods.',
    createdAt: new Date(Date.now() - 8 * 3600000).toISOString(), dueAt: new Date(Date.now() + 8 * 3600000).toISOString(),
    l1Confidence: 61, escalationReason: 'Recurring pedagogical issue — needs prompt investigation',
    suggestion: 'Update Sage system prompt for JEE Main → add explicit u-v selection heuristic. Trigger agent_prompt_update.',
  },
  {
    id: 'TKT-00031', studentName: 'Ananya Singh', studentId: 'STU-004',
    examId: 'CBSE 12', category: 'Access Denied', priority: 'low', status: 'l2_escalated',
    subject: 'Cannot access Economics chapter 4 notes',
    description: 'I am on the Standard plan but cannot access Chapter 4 Economics notes. It says "Upgrade required" even though it should be included.',
    createdAt: new Date(Date.now() - 12 * 3600000).toISOString(), dueAt: new Date(Date.now() + 24 * 3600000).toISOString(),
    l1Confidence: 55, escalationReason: 'Plan entitlement mismatch — needs DB check',
    suggestion: 'Check plan entitlements for Standard → Economics Chapter 4. Likely a feature_flag misconfiguration.',
  },
];

const MOCK_STUDENTS: Student[] = [
  { id: 'STU-011', name: 'Kabir Verma',    exam: 'JEE Main', grade: 12, plan: 'Premium',  planExpiry: '2026-03-15', lastActive: '9 days ago', inactiveDays: 9, streak: 0, recentScore: 28, scoreTrend: 'declining',  health: 'at_risk',    riskReason: '9 days inactive, score dropped to 28%',   channels: { email: true,  whatsapp: true,  telegram: false } },
  { id: 'STU-012', name: 'Deepa Menon',    exam: 'NEET',     grade: 12, plan: 'Standard', planExpiry: '2026-02-25', lastActive: '2 days ago', inactiveDays: 2, streak: 1, recentScore: 55, scoreTrend: 'stable',    health: 'inactive',   riskReason: undefined,                                 channels: { email: true,  whatsapp: false, telegram: true  } },
  { id: 'STU-013', name: 'Saanvi Reddy',   exam: 'NEET',     grade: 11, plan: 'Basic',    planExpiry: '2026-02-22', lastActive: '1 day ago',  inactiveDays: 1, streak: 3, recentScore: 31, scoreTrend: 'declining',  health: 'low_score',  riskReason: 'Mock score 31% (threshold: 40%)',         channels: { email: true,  whatsapp: true,  telegram: false } },
  { id: 'STU-014', name: 'Aditya Joshi',   exam: 'JEE Main', grade: 12, plan: 'Premium',  planExpiry: '2026-06-01', lastActive: '4 hours ago', inactiveDays: 0, streak: 21, recentScore: 78, scoreTrend: 'improving', health: 'healthy',    riskReason: undefined,                                channels: { email: true,  whatsapp: true,  telegram: true  } },
  { id: 'STU-015', name: 'Ishaan Malhotra', exam: 'CBSE 12', grade: 12, plan: 'Standard', planExpiry: '2026-02-28', lastActive: '6 days ago', inactiveDays: 6, streak: 0, recentScore: 42, scoreTrend: 'stable',    health: 'at_risk',    riskReason: 'Plan expires in 9 days, 6 days inactive', channels: { email: true,  whatsapp: false, telegram: false } },
];

const MOCK_TRIGGERS: UpdateTrigger[] = [
  { id: 'UPD-001', type: 'content_fix',        examId: 'JEE Main', description: 'Fix Electrostatics Q12 answer (4√2 N)',     urgency: 'critical', status: 'in_progress', agent: 'Atlas',  affected: 1240, createdAt: new Date(Date.now() - 30*60000).toISOString() },
  { id: 'UPD-002', type: 'agent_prompt_update', examId: 'JEE Main', description: 'Add u-v selection heuristic to Sage prompt',   urgency: 'high',     status: 'pending',     agent: 'Sage',   affected: 3400, createdAt: new Date(Date.now() - 2*3600000).toISOString() },
  { id: 'UPD-003', type: 'exam_date_change',    examId: 'NEET',     description: 'NEET 2026 date moved to May 4',              urgency: 'critical', status: 'deployed',    agent: 'Atlas',  affected: 5800, createdAt: new Date(Date.now() - 6*3600000).toISOString() },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<Priority, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const HEALTH_CONFIG: Record<SHealth, { label: string; color: string; icon: React.ReactNode }> = {
  at_risk:   { label: '🚨 At Risk',   color: 'text-red-600 dark:text-red-400',    icon: <AlertTriangle size={14} /> },
  inactive:  { label: '😴 Inactive',  color: 'text-orange-600 dark:text-orange-400', icon: <Clock size={14} /> },
  low_score: { label: '📉 Low Score', color: 'text-amber-600 dark:text-amber-400',  icon: <BarChart3 size={14} /> },
  healthy:   { label: '✅ Healthy',   color: 'text-green-600 dark:text-green-400',  icon: <CheckCircle2 size={14} /> },
};

const UPDATE_TARGET: Record<UpdateT, { agent: string; emoji: string; color: string }> = {
  content_fix:           { agent: 'Atlas',  emoji: '📚', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  syllabus_update:       { agent: 'Atlas',  emoji: '📚', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  difficulty_recalibrate:{ agent: 'Sage',   emoji: '🧠', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  agent_prompt_update:   { agent: 'Sage',   emoji: '🧠', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  exam_date_change:      { agent: 'Atlas',  emoji: '📅', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  feature_flag_toggle:   { agent: 'Forge',  emoji: '⚙️', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  pricing_update:        { agent: 'Herald', emoji: '📣', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function timeLeft(iso: string) {
  const mins = Math.floor((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins < 0) return { label: `Overdue ${-mins}m`, overdue: true };
  if (mins < 60) return { label: `${mins}m left`, overdue: false };
  return { label: `${Math.floor(mins / 60)}h left`, overdue: false };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTab({ active, onClick, icon, label, badge }:
  { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button onClick={onClick}
      className={clsx('flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors',
        active ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
               : 'text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-700/50')}>
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">{badge}</span>
      )}
    </button>
  );
}

function TicketRow({ ticket, onSelect, selected }:
  { ticket: Ticket; onSelect: (t: Ticket) => void; selected: boolean }) {
  const tl = timeLeft(ticket.dueAt);
  return (
    <div onClick={() => onSelect(ticket)}
      className={clsx('p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md',
        selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600'
                 : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-400">{ticket.id}</span>
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
              {ticket.priority.toUpperCase()}
            </span>
            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs">
              {ticket.category}
            </span>
            <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded text-xs">
              {ticket.examId}
            </span>
          </div>
          <p className="font-medium text-gray-900 dark:text-white text-sm line-clamp-1">{ticket.subject}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {ticket.studentName} · {timeAgo(ticket.createdAt)}
          </p>
        </div>
        <div className={clsx('text-xs font-medium shrink-0', tl.overdue ? 'text-red-600 dark:text-red-400' : 'text-gray-500')}>
          {tl.overdue && <AlertTriangle size={12} className="inline mr-0.5" />}
          {tl.label}
        </div>
      </div>
    </div>
  );
}

function ResolutionPanel({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const [response, setResponse] = useState('');
  const [note, setNote] = useState('');
  const [triggerType, setTriggerType] = useState('');
  const [resolved, setResolved] = useState(false);

  if (resolved) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <CheckCircle2 size={48} className="text-green-500" />
      <p className="text-lg font-semibold text-gray-900 dark:text-white">Ticket Resolved</p>
      <p className="text-sm text-gray-500">Update trigger dispatched to {UPDATE_TARGET[triggerType as UpdateT]?.agent ?? 'agent'} if selected.</p>
      <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Close</button>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-gray-400">{ticket.id}</span>
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
              {ticket.priority.toUpperCase()}
            </span>
          </div>
          <p className="font-semibold text-gray-900 dark:text-white mt-1 text-sm">{ticket.subject}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{ticket.studentName} · {ticket.examId}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
          <X size={16} className="text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Description */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">STUDENT'S COMPLAINT</p>
          <p className="text-sm text-gray-800 dark:text-gray-200">{ticket.description}</p>
        </div>

        {/* Nexus Suggestion */}
        {ticket.suggestion && (
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
            <p className="text-xs font-bold text-purple-700 dark:text-purple-400 mb-1 flex items-center gap-1">
              <Bot size={12} /> NEXUS SUGGESTION
            </p>
            <p className="text-xs text-purple-900 dark:text-purple-200">{ticket.suggestion}</p>
          </div>
        )}

        {/* L1 context */}
        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg p-3">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">L1 CONTEXT</p>
          <p className="text-xs text-amber-900 dark:text-amber-200">Confidence: {ticket.l1Confidence}% · {ticket.escalationReason}</p>
        </div>

        {/* Response */}
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">RESPONSE TO STUDENT *</label>
          <textarea value={response} onChange={e => setResponse(e.target.value)} rows={4}
            placeholder="Write your response to the student..."
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>

        {/* Internal note */}
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">INTERNAL NOTE</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="Note for admin / future reference..."
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* Update trigger */}
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">TRIGGER UPDATE (Optional)</label>
          <select value={triggerType} onChange={e => setTriggerType(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="">No update needed</option>
            <option value="content_fix">📚 Atlas — Content Fix</option>
            <option value="syllabus_update">📚 Atlas — Syllabus Update</option>
            <option value="agent_prompt_update">🧠 Sage — Agent Prompt Update</option>
            <option value="difficulty_recalibrate">🧠 Sage — Difficulty Recalibrate</option>
            <option value="exam_date_change">📅 Atlas — Exam Date Change</option>
            <option value="feature_flag_toggle">⚙️ Forge — Feature Flag Toggle</option>
            <option value="pricing_update">📣 Herald — Pricing Update</option>
          </select>
          {triggerType && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Dispatch task to {UPDATE_TARGET[triggerType as UpdateT]?.emoji} {UPDATE_TARGET[triggerType as UpdateT]?.agent} on resolve
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2 shrink-0">
        <button onClick={onClose}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
          Cancel
        </button>
        <button
          disabled={!response.trim()}
          onClick={() => setResolved(true)}
          className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1">
          <CheckCircle2 size={14} /> Resolve
        </button>
      </div>
    </div>
  );
}

function OutreachComposer({ students }: { students: Student[] }) {
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [outreachType, setOutreachType] = useState<OutType>('proactive_checkin');
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'telegram' | 'sms'>('whatsapp');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const OUTREACH_TEMPLATES: Record<OutType, string> = {
    proactive_checkin: "Hi {{name}} 👋 Just checking in — how's your {{exam}} prep going? Drop me a message if you need help!",
    at_risk_alert: "Hi {{name}}, we noticed you haven't studied in a while. Your exam is coming up — let's get back on track! Even 30 mins today makes a difference 💪",
    exam_countdown_nudge: "Hi {{name}} 🎯 Your {{exam}} is in {{days}} days! Time to accelerate. Open EduGenius now and crush today's target.",
    low_score_intervention: "Hi {{name}}, your recent mock score was {{score}}%. Don't worry — I'm here to help. Let's identify your weak areas and fix them together.",
    subscription_expiry_warn: "Hi {{name}}, your EduGenius plan expires on {{expiry}}. Renew now to keep your streak and access to all premium content!",
    feedback_followup: "Hi {{name}}, following up on your recent issue (#{{ticketId}}). Was it resolved to your satisfaction? Let us know if you need anything else.",
    welcome_call: "Welcome to EduGenius, {{name}}! 🎉 I'm your exam manager for {{exam}}. Feel free to reach out anytime — I'm here to make sure you succeed.",
    churn_rescue: "Hi {{name}}, we miss you! Your {{exam}} journey isn't over. Come back and we'll create a customised plan to get you back on track 🚀",
    bulk_announcement: '',
  };

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-4">
      {/* Type + Channel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">OUTREACH TYPE</label>
          <select value={outreachType} onChange={e => { setOutreachType(e.target.value as OutType); setMessage(OUTREACH_TEMPLATES[e.target.value as OutType]); }}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="proactive_checkin">Check-in</option>
            <option value="at_risk_alert">At-Risk Alert</option>
            <option value="exam_countdown_nudge">Exam Countdown</option>
            <option value="low_score_intervention">Low Score Intervention</option>
            <option value="subscription_expiry_warn">Subscription Expiry Warning</option>
            <option value="feedback_followup">Feedback Follow-up</option>
            <option value="welcome_call">Welcome</option>
            <option value="churn_rescue">Churn Rescue</option>
            <option value="bulk_announcement">Bulk Announcement</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">CHANNEL</label>
          <div className="flex gap-2">
            {(['whatsapp', 'email', 'telegram', 'sms'] as const).map(ch => (
              <button key={ch} onClick={() => setChannel(ch)}
                className={clsx('px-3 py-2 text-xs rounded-lg border transition-colors',
                  channel === ch ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')}>
                {ch === 'whatsapp' ? '💬' : ch === 'email' ? '📧' : ch === 'telegram' ? '✈️' : '📱'} {ch}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Select students */}
      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
          RECIPIENTS ({selectedStudents.length} selected)
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
          {students.map(s => (
            <label key={s.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
              <input type="checkbox" checked={selectedStudents.includes(s.id)}
                onChange={() => toggleStudent(s.id)} className="rounded" />
              <span className="text-sm text-gray-800 dark:text-gray-200">{s.name}</span>
              <span className={clsx('ml-auto text-xs', HEALTH_CONFIG[s.health].color)}>
                {HEALTH_CONFIG[s.health].label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Message */}
      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">MESSAGE</label>
        <textarea value={message || OUTREACH_TEMPLATES[outreachType]} onChange={e => setMessage(e.target.value)} rows={4}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500" />
        <p className="text-xs text-gray-400 mt-1">Variables: {'{{name}}'}, {'{{exam}}'}, {'{{days}}'}, {'{{score}}'}, {'{{expiry}}'}</p>
      </div>

      {sent ? (
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
          <CheckCircle2 size={16} /> Sent to {selectedStudents.length} student(s) via {channel}
        </div>
      ) : (
        <button disabled={selectedStudents.length === 0}
          onClick={() => setSent(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          <Send size={14} /> Send Outreach ({selectedStudents.length})
        </button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ManagerDashboard() {
  const [activeExam, setActiveExam] = useState(EXAM_SCOPES[0]);
  const [section, setSection] = useState<'tickets' | 'students' | 'outreach' | 'updates' | 'metrics'>('tickets');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketFilter, setTicketFilter] = useState<'all' | Priority>('all');

  const examTickets = MOCK_TICKETS.filter(t => t.examId === activeExam);
  const filteredTickets = ticketFilter === 'all' ? examTickets : examTickets.filter(t => t.priority === ticketFilter);
  const examStudents = MOCK_STUDENTS.filter(s => s.exam === activeExam);
  const atRiskStudents = examStudents.filter(s => s.health !== 'healthy');

  const PERF: PerfMetric[] = [
    { label: 'Open Tickets',     value: examTickets.filter(t => t.status !== 'resolved').length, color: 'text-orange-600 dark:text-orange-400', icon: <Inbox size={16} /> },
    { label: 'Avg Resolution',   value: '2.4h',  color: 'text-blue-600 dark:text-blue-400',   icon: <Clock size={16} /> },
    { label: 'CSAT',             value: '4.2/5', color: 'text-green-600 dark:text-green-400', icon: <Star size={16} /> },
    { label: 'At-Risk Students', value: atRiskStudents.length, color: 'text-red-600 dark:text-red-400', icon: <AlertTriangle size={16} /> },
    { label: 'Outreach Sent',    value: 23,      color: 'text-purple-600 dark:text-purple-400', icon: <Megaphone size={16} /> },
    { label: 'SLA Breaches',     value: 1,       color: 'text-amber-600 dark:text-amber-400', icon: <RefreshCw size={16} /> },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manager Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            L2 ticket resolution · student outreach · update triggers · exam-scoped view
          </p>
        </div>

        {/* Exam tabs */}
        <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
          {EXAM_SCOPES.map(exam => (
            <button key={exam} onClick={() => setActiveExam(exam)}
              className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeExam === exam ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                   : 'text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-700/50')}>
              {exam}
            </button>
          ))}
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {PERF.map(m => (
            <div key={m.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">{m.label}</p>
                <span className={m.color}>{m.icon}</span>
              </div>
              <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Section nav */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit flex-wrap">
          <SectionTab active={section==='tickets'}  onClick={() => setSection('tickets')}  icon={<Inbox size={14}/>}       label="Tickets"    badge={filteredTickets.filter(t=>t.status!=='resolved').length} />
          <SectionTab active={section==='students'} onClick={() => setSection('students')} icon={<Users size={14}/>}       label="Students"   badge={atRiskStudents.length} />
          <SectionTab active={section==='outreach'} onClick={() => setSection('outreach')} icon={<Megaphone size={14}/>}   label="Outreach" />
          <SectionTab active={section==='updates'}  onClick={() => setSection('updates')}  icon={<Zap size={14}/>}         label="Updates"    badge={MOCK_TRIGGERS.filter(t=>t.status==='pending').length} />
          <SectionTab active={section==='metrics'}  onClick={() => setSection('metrics')}  icon={<BarChart3 size={14}/>}   label="Metrics" />
        </div>

        {/* ── TICKETS ────────────────────────────────────────────── */}
        {section === 'tickets' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* List */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-gray-400" />
                {(['all','critical','high','medium','low'] as const).map(p => (
                  <button key={p} onClick={() => setTicketFilter(p)}
                    className={clsx('px-2 py-1 rounded text-xs font-medium transition-colors',
                      ticketFilter === p ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600')}>
                    {p}
                  </button>
                ))}
              </div>
              {filteredTickets.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No tickets for {activeExam}</div>
              ) : (
                filteredTickets.map(t => (
                  <TicketRow key={t.id} ticket={t}
                    selected={selectedTicket?.id === t.id}
                    onSelect={setSelectedTicket} />
                ))
              )}
            </div>
            {/* Resolution panel */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 h-[600px]">
              {selectedTicket ? (
                <ResolutionPanel ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                  <Inbox size={40} className="opacity-30" />
                  <p className="text-sm">Select a ticket to resolve</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STUDENTS ───────────────────────────────────────────── */}
        {section === 'students' && (
          <div className="space-y-3">
            {examStudents.map(s => (
              <div key={s.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <User size={16} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 dark:text-white text-sm">{s.name}</span>
                        <span className="text-xs text-gray-400">Grade {s.grade} · {s.plan}</span>
                        <span className={clsx('text-xs font-medium', HEALTH_CONFIG[s.health].color)}>
                          {HEALTH_CONFIG[s.health].label}
                        </span>
                      </div>
                      {s.riskReason && <p className="text-xs text-red-600 dark:text-red-400 mb-1">{s.riskReason}</p>}
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>Last active: {s.lastActive}</span>
                        <span className="flex items-center gap-0.5"><Flame size={11} /> {s.streak} day streak</span>
                        <span>Recent score: {s.recentScore}% ({s.scoreTrend})</span>
                        <span>Plan expires: {s.planExpiry}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {s.channels.whatsapp && <button title="WhatsApp" className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200"><MessageSquare size={14} /></button>}
                    {s.channels.telegram && <button title="Telegram" className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200"><Send size={14} /></button>}
                    {s.channels.email   && <button title="Email"    className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"><Mail size={14} /></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── OUTREACH ───────────────────────────────────────────── */}
        {section === 'outreach' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="font-bold text-gray-900 dark:text-white mb-4">Compose Outreach</h2>
            <OutreachComposer students={examStudents} />
          </div>
        )}

        {/* ── UPDATES ────────────────────────────────────────────── */}
        {section === 'updates' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-gray-900 dark:text-white">Update Triggers</h2>
              <button className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1">
                <Zap size={14} /> New Trigger
              </button>
            </div>
            {MOCK_TRIGGERS.filter(t => t.examId === activeExam || activeExam === 'JEE Main').map(tr => {
              const target = UPDATE_TARGET[tr.type];
              return (
                <div key={tr.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', PRIORITY_COLORS[tr.urgency as Priority])}>
                        {tr.urgency.toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={clsx('px-1.5 py-0.5 rounded text-xs font-medium', target?.color)}>
                            {target?.emoji} {target?.agent}
                          </span>
                          <span className="text-xs text-gray-400 font-mono">{tr.id}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{tr.description}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {tr.affected.toLocaleString()} students · {tr.examId} · {timeAgo(tr.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className={clsx('px-2 py-1 rounded-full text-xs font-medium shrink-0',
                      tr.status === 'deployed'    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      tr.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      tr.status === 'approved'    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400')}>
                      {tr.status.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── METRICS ────────────────────────────────────────────── */}
        {section === 'metrics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { label: 'Tickets Resolved', value: 38, sub: 'This month', color: 'text-green-600' },
              { label: 'CSAT Score', value: '4.2 / 5', sub: '↑ from 3.8 last month', color: 'text-blue-600' },
              { label: 'Avg Resolution Time', value: '2.4h', sub: 'SLA target: 4h', color: 'text-indigo-600' },
              { label: 'Outreach Sent', value: 23, sub: '8 responded', color: 'text-purple-600' },
              { label: 'At-Risk Interventions', value: 5, sub: '3 re-engaged', color: 'text-orange-600' },
              { label: 'Updates Triggered', value: 3, sub: 'All deployed', color: 'text-teal-600' },
            ].map(m => (
              <div key={m.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.label}</p>
                <p className={`text-3xl font-bold mt-1 ${m.color} dark:${m.color}`}>{m.value}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{m.sub}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nexus AI Sidebar */}
      <div className="w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Bot size={14} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-sm">Nexus</p>
              <p className="text-xs text-gray-400">Manager AI Assistant</p>
            </div>
            <span className="ml-auto w-2 h-2 rounded-full bg-green-500" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">ACTIVE SUB-AGENTS</p>
          {[
            { name: 'Ticket Router',      emoji: '🎯', status: 'active',  note: '4 tickets routed today' },
            { name: 'At-Risk Detector',   emoji: '⚠️', status: 'active',  note: `${atRiskStudents.length} students flagged` },
            { name: 'Outreach Composer',  emoji: '✉️', status: 'active',  note: '23 messages drafted' },
            { name: 'Update Dispatcher',  emoji: '🚀', status: 'active',  note: '1 pending dispatch' },
            { name: 'Resolution Suggester',emoji:'💡', status: 'active',  note: 'Ready for tickets' },
            { name: 'CSAT Monitor',       emoji: '📈', status: 'active',  note: 'CSAT 4.2 — healthy' },
            { name: 'Escalation Guard',   emoji: '🚨', status: 'active',  note: 'Watching 4 open tickets' },
            { name: 'Churn Rescue',       emoji: '🔄', status: 'active',  note: '1 expiry in 3 days' },
            { name: 'Knowledge Updater',  emoji: '📚', status: 'idle',    note: '2 KB entries pending' },
            { name: 'Broadcast Planner',  emoji: '📢', status: 'idle',    note: 'No broadcasts scheduled' },
          ].map(sa => (
            <div key={sa.name} className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">{sa.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{sa.name}</span>
                  <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', sa.status === 'active' ? 'bg-green-500' : 'bg-gray-400')} />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">{sa.note}</p>
              </div>
            </div>
          ))}

          <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">NEXUS ALERTS</p>
            <div className="space-y-2">
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
                <p className="text-xs text-red-700 dark:text-red-400 font-medium">🚨 TKT-00042 due in 1.5h</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">⚠️ Kabir Verma — 9 days inactive</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">💡 Agent prompt update pending approval</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <input placeholder="Ask Nexus..." className="flex-1 text-xs bg-transparent outline-none text-gray-700 dark:text-gray-300 placeholder-gray-400" />
            <button className="text-blue-600 dark:text-blue-400"><ArrowRight size={14} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ManagerDashboard;
