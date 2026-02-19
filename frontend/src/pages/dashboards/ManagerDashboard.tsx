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

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox, Users, Megaphone, Zap, BarChart3,
  ChevronRight, ChevronDown, AlertTriangle, CheckCircle2,
  Clock, Phone, MessageSquare, Mail, Send,
  User, RefreshCw, Bot, X, Star, Filter,
  BookOpen, Cpu, ArrowRight, Flame,
  GitBranch, UserPlus, GraduationCap, TrendingUp, Headphones,
  Sparkles, Circle, CheckCircle, PlayCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  NexusUrgencyScore,
  AIMessageDraft,
  StudentTimelineDrawer,
  CampaignROICard,
  SmartRuleWizard,
} from '@/components/ux/UXEnhancements';

// ─── Mock data types ──────────────────────────────────────────────────────────

type Priority  = 'critical' | 'high' | 'medium' | 'low';
type TStatus   = 'l2_escalated' | 'l2_processing' | 'resolved' | 'open';
type SHealth   = 'at_risk' | 'inactive' | 'low_score' | 'healthy';
type LifecyclePhase = 'acquisition' | 'onboarding' | 'delivery' | 'retention' | 'support';
type OutType   =
  // Acquisition
  | 'lead_welcome' | 'lead_nurture_exam_tip' | 'trial_invite' | 'trial_expiry_nudge' | 'referral_invite' | 'paid_ad_follow_up'
  // Onboarding
  | 'welcome_call' | 'onboarding_step_nudge' | 'first_session_invite' | 'setup_incomplete_reminder' | 'parent_intro' | 'teacher_intro'
  // Delivery
  | 'daily_study_reminder' | 'exam_countdown_nudge' | 'live_session_prep' | 'mock_test_invite' | 'topic_completion_nudge' | 'content_update_notice' | 'milestone_celebration' | 'low_score_intervention'
  // Retention
  | 'proactive_checkin' | 'at_risk_alert' | 'churn_rescue' | 'subscription_expiry_warn' | 'upsell_plan_upgrade' | 'referral_program_nudge'
  // Support
  | 'ticket_response' | 'feedback_followup' | 'bulk_announcement';

interface LifecycleRule {
  phase: LifecyclePhase;
  triggerEvent: string;
  delayHours: number;
  outreachType: OutType;
  preferredChannel: string;
  ownerAgent: string;
  templateKey: string;
  enabled: boolean;
}

interface Lead {
  id: string; name: string; phone?: string; email?: string;
  targetExam: string; source: string; status: 'new' | 'contacted' | 'nurturing' | 'trial' | 'converted' | 'lost';
  touchCount: number; lastTouchAt?: string;
}
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

const MOCK_LEADS: Lead[] = [
  { id: 'L-001', name: 'Tanvi Kapoor',     phone: '+91 98100 11111', targetExam: 'JEE Main', source: 'paid_ad',       status: 'nurturing', touchCount: 2, lastTouchAt: new Date(Date.now() - 2*86400000).toISOString() },
  { id: 'L-002', name: 'Suresh Iyer',      phone: '+91 98200 22222', targetExam: 'NEET',     source: 'referral',      status: 'trial',     touchCount: 3, lastTouchAt: new Date(Date.now() - 1*86400000).toISOString() },
  { id: 'L-003', name: 'Meera Patel',      email: 'meera@gmail.com', targetExam: 'CBSE 12',  source: 'organic_search',status: 'new',       touchCount: 1, lastTouchAt: new Date(Date.now() - 5*3600000).toISOString() },
  { id: 'L-004', name: 'Aryan Bose',       phone: '+91 97300 33333', targetExam: 'JEE Main', source: 'telegram_bot',  status: 'contacted', touchCount: 1, lastTouchAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'L-005', name: 'Lakshmi Nair',     phone: '+91 96400 44444', targetExam: 'NEET',     source: 'whatsapp_link', status: 'converted', touchCount: 4, lastTouchAt: new Date(Date.now() - 3*86400000).toISOString() },
];

const LIFECYCLE_RULES: LifecycleRule[] = [
  // Acquisition
  { phase: 'acquisition', triggerEvent: 'lead:captured',          delayHours: 0,   outreachType: 'lead_welcome',              preferredChannel: 'whatsapp', ownerAgent: 'Herald', templateKey: 'lead_welcome_wa',           enabled: true  },
  { phase: 'acquisition', triggerEvent: 'lead:captured',          delayHours: 24,  outreachType: 'lead_nurture_exam_tip',     preferredChannel: 'email',    ownerAgent: 'Herald', templateKey: 'lead_nurture_tip_d1',       enabled: true  },
  { phase: 'acquisition', triggerEvent: 'lead:captured',          delayHours: 72,  outreachType: 'trial_invite',              preferredChannel: 'whatsapp', ownerAgent: 'Herald', templateKey: 'trial_invite_wa',           enabled: true  },
  { phase: 'acquisition', triggerEvent: 'lead:trial_started',     delayHours: -48, outreachType: 'trial_expiry_nudge',        preferredChannel: 'whatsapp', ownerAgent: 'Herald', templateKey: 'trial_expiry_nudge',        enabled: true  },
  { phase: 'acquisition', triggerEvent: 'user:referral_given',    delayHours: 0,   outreachType: 'referral_invite',           preferredChannel: 'whatsapp', ownerAgent: 'Herald', templateKey: 'referral_invite',           enabled: true  },
  // Onboarding
  { phase: 'onboarding',  triggerEvent: 'user:signed_up',         delayHours: 0,   outreachType: 'welcome_call',              preferredChannel: 'whatsapp', ownerAgent: 'Mentor', templateKey: 'welcome_new_student',       enabled: true  },
  { phase: 'onboarding',  triggerEvent: 'user:signed_up',         delayHours: 2,   outreachType: 'first_session_invite',      preferredChannel: 'in_app',   ownerAgent: 'Mentor', templateKey: 'first_session_cta',         enabled: true  },
  { phase: 'onboarding',  triggerEvent: 'onboarding:step_stuck',  delayHours: 6,   outreachType: 'onboarding_step_nudge',     preferredChannel: 'in_app',   ownerAgent: 'Mentor', templateKey: 'onboarding_nudge',          enabled: true  },
  { phase: 'onboarding',  triggerEvent: 'onboarding:incomplete',  delayHours: 24,  outreachType: 'setup_incomplete_reminder', preferredChannel: 'email',    ownerAgent: 'Mentor', templateKey: 'setup_reminder_d1',         enabled: false },
  { phase: 'onboarding',  triggerEvent: 'user:parent_linked',     delayHours: 0,   outreachType: 'parent_intro',              preferredChannel: 'whatsapp', ownerAgent: 'Mentor', templateKey: 'parent_welcome',            enabled: true  },
  // Delivery
  { phase: 'delivery',    triggerEvent: 'cron:daily_9am',         delayHours: 0,   outreachType: 'daily_study_reminder',      preferredChannel: 'in_app',   ownerAgent: 'Sage',   templateKey: 'daily_streak_reminder',     enabled: true  },
  { phase: 'delivery',    triggerEvent: 'exam:days_remaining_30', delayHours: 0,   outreachType: 'exam_countdown_nudge',      preferredChannel: 'whatsapp', ownerAgent: 'Sage',   templateKey: 'exam_countdown_30d',        enabled: true  },
  { phase: 'delivery',    triggerEvent: 'exam:days_remaining_7',  delayHours: 0,   outreachType: 'exam_countdown_nudge',      preferredChannel: 'whatsapp', ownerAgent: 'Sage',   templateKey: 'exam_countdown_7d',         enabled: true  },
  { phase: 'delivery',    triggerEvent: 'session:scheduled',      delayHours: -1,  outreachType: 'live_session_prep',         preferredChannel: 'whatsapp', ownerAgent: 'Sage',   templateKey: 'live_session_prep_brief',   enabled: true  },
  { phase: 'delivery',    triggerEvent: 'student:milestone_hit',  delayHours: 0,   outreachType: 'milestone_celebration',     preferredChannel: 'in_app',   ownerAgent: 'Mentor', templateKey: 'milestone_celebration',     enabled: true  },
  { phase: 'delivery',    triggerEvent: 'score:dropped_below_40', delayHours: 2,   outreachType: 'low_score_intervention',    preferredChannel: 'whatsapp', ownerAgent: 'Nexus',  templateKey: 'low_score_help_offer',      enabled: true  },
  // Retention
  { phase: 'retention',   triggerEvent: 'student:inactive_3d',   delayHours: 0,   outreachType: 'proactive_checkin',         preferredChannel: 'whatsapp', ownerAgent: 'Nexus',  templateKey: 'checkin_3d_inactive',       enabled: true  },
  { phase: 'retention',   triggerEvent: 'student:inactive_7d',   delayHours: 0,   outreachType: 'at_risk_alert',             preferredChannel: 'whatsapp', ownerAgent: 'Nexus',  templateKey: 'at_risk_7d',                enabled: true  },
  { phase: 'retention',   triggerEvent: 'student:inactive_14d',  delayHours: 0,   outreachType: 'churn_rescue',              preferredChannel: 'whatsapp', ownerAgent: 'Nexus',  templateKey: 'churn_rescue_14d',          enabled: true  },
  { phase: 'retention',   triggerEvent: 'subscription:expiring_7d',delayHours: 0, outreachType: 'subscription_expiry_warn',  preferredChannel: 'whatsapp', ownerAgent: 'Nexus',  templateKey: 'sub_expiry_7d',             enabled: true  },
  { phase: 'retention',   triggerEvent: 'user:feature_gate_hit', delayHours: 1,   outreachType: 'upsell_plan_upgrade',       preferredChannel: 'in_app',   ownerAgent: 'Herald', templateKey: 'upsell_upgrade_prompt',     enabled: true  },
  { phase: 'retention',   triggerEvent: 'student:csat_above_4.5',delayHours: 24,  outreachType: 'referral_program_nudge',    preferredChannel: 'in_app',   ownerAgent: 'Herald', templateKey: 'referral_happy_user',       enabled: false },
  // Support
  { phase: 'support',     triggerEvent: 'ticket:resolved',        delayHours: 24,  outreachType: 'feedback_followup',         preferredChannel: 'whatsapp', ownerAgent: 'Nexus',  templateKey: 'ticket_followup_24h',       enabled: true  },
];

const MOCK_TRIGGERS: UpdateTrigger[] = [
  { id: 'UPD-001', type: 'content_fix',        examId: 'JEE Main', description: 'Fix Electrostatics Q12 answer (4√2 N)',     urgency: 'critical', status: 'in_progress', agent: 'Atlas',  affected: 1240, createdAt: new Date(Date.now() - 30*60000).toISOString() },
  { id: 'UPD-002', type: 'agent_prompt_update', examId: 'JEE Main', description: 'Add u-v selection heuristic to Sage prompt',   urgency: 'high',     status: 'pending',     agent: 'Sage',   affected: 3400, createdAt: new Date(Date.now() - 2*3600000).toISOString() },
  { id: 'UPD-003', type: 'exam_date_change',    examId: 'NEET',     description: 'NEET 2026 date moved to May 4',              urgency: 'critical', status: 'deployed',    agent: 'Atlas',  affected: 5800, createdAt: new Date(Date.now() - 6*3600000).toISOString() },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<LifecyclePhase, { label: string; emoji: string; icon: React.ReactNode; color: string; bg: string; ownerLabel: string }> = {
  acquisition: { label: 'Acquisition',  emoji: '🌱', icon: <UserPlus size={14}/>,     color: 'text-emerald-600 dark:text-emerald-400',  bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',   ownerLabel: 'Herald'  },
  onboarding:  { label: 'Onboarding',   emoji: '🚀', icon: <GraduationCap size={14}/>, color: 'text-blue-600 dark:text-blue-400',        bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',               ownerLabel: 'Mentor'  },
  delivery:    { label: 'Delivery',     emoji: '📅', icon: <BookOpen size={14}/>,      color: 'text-indigo-600 dark:text-indigo-400',    bg: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',       ownerLabel: 'Sage'    },
  retention:   { label: 'Retention',    emoji: '🔄', icon: <TrendingUp size={14}/>,    color: 'text-orange-600 dark:text-orange-400',    bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',     ownerLabel: 'Nexus'   },
  support:     { label: 'Support',      emoji: '🎧', icon: <Headphones size={14}/>,    color: 'text-purple-600 dark:text-purple-400',    bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',     ownerAgent: 'Nexus'   },
} as any;

const LEAD_STATUS_COLORS: Record<Lead['status'], string> = {
  new:       'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  contacted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  nurturing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  trial:     'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  converted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  lost:      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

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

  const OUTREACH_TEMPLATES: Partial<Record<OutType, string>> = {
    // Acquisition
    lead_welcome:              "Hi {{name}} 👋 I saw you're preparing for {{exam}}. EduGenius has helped 10,000+ students crack it — want to see how? I'll share a free study plan!",
    lead_nurture_exam_tip:     "Hi {{name}} 💡 Quick tip for {{exam}}: focus on {{topic}} this week — it's worth 12 marks. Our AI tutor explains it in 5 minutes. Want to try?",
    trial_invite:              "Hi {{name}} 🎁 You've been on our list — time to experience EduGenius free for 7 days! No credit card. Just pure {{exam}} prep. Start now 👇",
    trial_expiry_nudge:        "Hi {{name}} ⏰ Your EduGenius trial ends in 48 hours! Don't lose your progress. Upgrade now and keep your momentum going for {{exam}}.",
    referral_invite:           "Hi {{name}} 🎉 Your friend {{referrerName}} just joined EduGenius for {{exam}}! Join them and get 1 month free when you both subscribe.",
    paid_ad_follow_up:         "Hi {{name}}, you recently checked out EduGenius for {{exam}}. Any questions? I'm here to help you decide — no pressure 😊",
    // Onboarding
    welcome_call:              "Welcome to EduGenius, {{name}}! 🎉 I'm your exam manager for {{exam}}. Feel free to reach out anytime — I'm here to make sure you succeed.",
    first_session_invite:      "Hi {{name}} 🚀 You're all set! Start your first {{exam}} session now — your AI tutor is ready. It only takes 10 minutes to feel the difference.",
    onboarding_step_nudge:     "Hi {{name}}, looks like you're still setting up your {{exam}} profile. Takes 2 mins — and it personalises everything for you 🙏",
    setup_incomplete_reminder: "Hi {{name}}, your EduGenius setup isn't complete yet. Configure your {{exam}} subjects so we can personalise your study plan!",
    parent_intro:              "Hello! I'm reaching out on behalf of {{studentName}}, who just joined EduGenius for {{exam}} prep. I'll keep you updated on their progress 📊",
    teacher_intro:             "Welcome {{name}}! Your cohort for {{exam}} is ready. You have {{count}} students assigned. Log in to review their progress and plan sessions.",
    // Delivery
    daily_study_reminder:      "Good morning {{name}} ☀️ Ready for today's session? Your {{exam}} exam is {{days}} days away. Even 45 mins today makes a difference!",
    exam_countdown_nudge:      "Hi {{name}} 🎯 {{days}} days to {{exam}}! Time to accelerate. Open EduGenius now and crush today's target.",
    live_session_prep:         "Hi {{name}} 📖 Your live {{exam}} session starts in 1 hour! Here's what to prep: {{topics}}. See you there! 👇",
    mock_test_invite:          "Hi {{name}} 📝 Time for your weekly mock test! It's the best way to find gaps before the real {{exam}}. 40 questions, 50 minutes. Go! 💪",
    topic_completion_nudge:    "Hi {{name}}, you started {{topic}} 3 days ago but haven't finished. Just 15 more minutes — you're 70% there!",
    content_update_notice:     "Hi {{name}} 📚 Important update: {{exam}} syllabus has been revised. Check your EduGenius app for the updated topics and notes.",
    milestone_celebration:     "🎉 {{name}}, you just hit {{milestone}}! Amazing progress on your {{exam}} journey. Keep going — you're unstoppable!",
    low_score_intervention:    "Hi {{name}}, your recent mock score was {{score}}%. Don't worry — I'm here to help. Let's identify your weak areas and fix them together.",
    // Retention
    proactive_checkin:         "Hi {{name}} 👋 Just checking in — how's your {{exam}} prep going? Drop me a message if you need help!",
    at_risk_alert:             "Hi {{name}}, we noticed you haven't studied in a while. Your exam is coming up — let's get back on track! Even 30 mins today makes a difference 💪",
    churn_rescue:              "Hi {{name}}, we miss you! Your {{exam}} journey isn't over. Come back and we'll create a customised plan to get you back on track 🚀",
    subscription_expiry_warn:  "Hi {{name}}, your EduGenius plan expires on {{expiry}}. Renew now to keep your streak and access to all premium content!",
    upsell_plan_upgrade:       "Hi {{name}} ⭐ You've been using EduGenius Pro features — upgrade now to unlock unlimited mock tests, live sessions, and priority support!",
    referral_program_nudge:    "Hi {{name}} 🎁 Loving EduGenius? Share it with a friend and get 1 month free! They'll thank you when they crack {{exam}} 😊",
    // Support
    feedback_followup:         "Hi {{name}}, following up on your recent issue (#{{ticketId}}). Was it resolved to your satisfaction? Let us know if you need anything else.",
    bulk_announcement:         '',
    ticket_response:           '',
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
          <select value={outreachType} onChange={e => { setOutreachType(e.target.value as OutType); setMessage(OUTREACH_TEMPLATES[e.target.value as OutType] ?? ''); }}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <optgroup label="🌱 Acquisition (Herald)">
              <option value="lead_welcome">Lead Welcome</option>
              <option value="lead_nurture_exam_tip">Exam Tip Nurture</option>
              <option value="trial_invite">Trial Invite</option>
              <option value="trial_expiry_nudge">Trial Expiry Nudge</option>
              <option value="referral_invite">Referral Invite</option>
            </optgroup>
            <optgroup label="🚀 Onboarding (Mentor)">
              <option value="welcome_call">Welcome</option>
              <option value="first_session_invite">First Session Invite</option>
              <option value="onboarding_step_nudge">Onboarding Nudge</option>
              <option value="setup_incomplete_reminder">Setup Reminder</option>
              <option value="parent_intro">Parent Introduction</option>
            </optgroup>
            <optgroup label="📅 Delivery (Sage)">
              <option value="daily_study_reminder">Daily Study Reminder</option>
              <option value="exam_countdown_nudge">Exam Countdown</option>
              <option value="live_session_prep">Live Session Prep</option>
              <option value="mock_test_invite">Mock Test Invite</option>
              <option value="milestone_celebration">Milestone Celebration</option>
              <option value="low_score_intervention">Low Score Intervention</option>
            </optgroup>
            <optgroup label="🔄 Retention (Nexus)">
              <option value="proactive_checkin">Check-in</option>
              <option value="at_risk_alert">At-Risk Alert</option>
              <option value="churn_rescue">Churn Rescue</option>
              <option value="subscription_expiry_warn">Subscription Expiry Warning</option>
              <option value="upsell_plan_upgrade">Plan Upgrade Nudge</option>
              <option value="referral_program_nudge">Referral Program</option>
            </optgroup>
            <optgroup label="🎧 Support (Nexus)">
              <option value="feedback_followup">Feedback Follow-up</option>
              <option value="bulk_announcement">Bulk Announcement</option>
            </optgroup>
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

// ─── Urgency score helper ─────────────────────────────────────────────────────

function ticketUrgencyScore(ticket: Ticket): number {
  const priorityScore: Record<Priority, number> = { critical: 100, high: 75, medium: 50, low: 25 };
  const base = priorityScore[ticket.priority];
  // Add time pressure: overdue tickets score higher
  const minsLeft = Math.floor((new Date(ticket.dueAt).getTime() - Date.now()) / 60000);
  const timePenalty = minsLeft < 0 ? 20 : minsLeft < 60 ? 10 : 0;
  return Math.min(100, base + timePenalty);
}

// ─── Priority Inbox Row ────────────────────────────────────────────────────────

function PriorityInboxRow({
  ticket,
  onViewTimeline,
  resolvedIds,
  onResolve,
  onEscalate,
}: {
  ticket: Ticket;
  onViewTimeline: (name: string) => void;
  resolvedIds: Set<string>;
  onResolve: (id: string) => void;
  onEscalate: (id: string) => void;
}) {
  const [showDraft, setShowDraft] = useState(false);
  const urgency = ticketUrgencyScore(ticket);
  const tl = timeLeft(ticket.dueAt);
  const urgencyLabel = urgency >= 80 ? '🔴 High' : urgency >= 50 ? '🟡 Med' : '🟢 Low';
  const isResolved = resolvedIds.has(ticket.id);

  return (
    <div className={clsx(
      'p-4 rounded-xl border transition-all',
      isResolved
        ? 'border-green-500/20 bg-green-500/5 opacity-60'
        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
    )}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <NexusUrgencyScore score={urgency} reason={`${ticket.priority.toUpperCase()} priority · ${ticket.escalationReason}`} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <button
                onClick={() => onViewTimeline(ticket.studentName)}
                className="font-semibold text-sm text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {ticket.studentName}
              </button>
              <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">{ticket.category}</span>
              <span className="text-xs font-medium">{urgencyLabel}</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">{ticket.subject}</p>
            <p className="text-xs text-gray-400 mt-0.5">{timeAgo(ticket.createdAt)} · {ticket.examId}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
          <span className={clsx('text-xs', tl.overdue ? 'text-red-500' : 'text-gray-400')}>
            {tl.overdue && '⚠️ '}{tl.label}
          </span>
          <button
            onClick={() => setShowDraft(v => !v)}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition-colors"
          >
            ✨ Draft
          </button>
          <button
            onClick={() => onResolve(ticket.id)}
            disabled={isResolved}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors disabled:opacity-40"
          >
            {isResolved ? '✅ Resolved' : 'Resolve'}
          </button>
          <button
            onClick={() => onEscalate(ticket.id)}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 transition-colors"
          >
            Escalate
          </button>
        </div>
      </div>
      {showDraft && (
        <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">
          <AIMessageDraft
            studentName={ticket.studentName}
            exam={ticket.examId}
            riskReason={ticket.escalationReason}
            onUseDraft={(msg) => {
              console.log('Draft used:', msg);
              setShowDraft(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

export function ManagerDashboard() {
  const [activeExam, setActiveExam] = useState(EXAM_SCOPES[0]);
  const [section, setSection] = useState<'inbox' | 'tickets' | 'students' | 'outreach' | 'updates' | 'metrics' | 'pipeline'>('inbox');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketFilter, setTicketFilter] = useState<'all' | Priority>('all');
  const [pipelinePhase, setPipelinePhase] = useState<LifecyclePhase | 'all'>('all');
  const [lifecycleRules, setLifecycleRules] = useState(LIFECYCLE_RULES);
  const [timelineStudent, setTimelineStudent] = useState<string | null>(null);
  const [resolvedTicketIds, setResolvedTicketIds] = useState<Set<string>>(new Set());
  const [escalatedTicketIds, setEscalatedTicketIds] = useState<Set<string>>(new Set());

  const handleResolve = useCallback((id: string) => {
    setResolvedTicketIds(prev => new Set([...prev, id]));
  }, []);

  const handleEscalate = useCallback((id: string) => {
    setEscalatedTicketIds(prev => new Set([...prev, id]));
  }, []);

  const examTickets = MOCK_TICKETS.filter(t => t.examId === activeExam);
  const filteredTickets = ticketFilter === 'all' ? examTickets : examTickets.filter(t => t.priority === ticketFilter);
  const examStudents = MOCK_STUDENTS.filter(s => s.exam === activeExam);
  const atRiskStudents = examStudents.filter(s => s.health !== 'healthy');
  // Priority Inbox: all tickets sorted by urgency, max 10
  const priorityInboxTickets = useMemo(() =>
    [...MOCK_TICKETS].sort((a, b) => ticketUrgencyScore(b) - ticketUrgencyScore(a)).slice(0, 10),
  []);

  const PERF: PerfMetric[] = [
    { label: 'Open Tickets',     value: examTickets.filter(t => t.status !== 'resolved').length, color: 'text-orange-600 dark:text-orange-400', icon: <Inbox size={16} /> },
    { label: 'Avg Resolution',   value: '2.4h',  color: 'text-blue-600 dark:text-blue-400',   icon: <Clock size={16} /> },
    { label: 'CSAT',             value: '4.2/5', color: 'text-green-600 dark:text-green-400', icon: <Star size={16} /> },
    { label: 'At-Risk Students', value: atRiskStudents.length, color: 'text-red-600 dark:text-red-400', icon: <AlertTriangle size={16} /> },
    { label: 'Outreach Sent',    value: 23,      color: 'text-purple-600 dark:text-purple-400', icon: <Megaphone size={16} /> },
    { label: 'SLA Breaches',     value: 1,       color: 'text-amber-600 dark:text-amber-400', icon: <RefreshCw size={16} /> },
  ];

  return (
    <>
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
          <SectionTab active={section==='inbox'}    onClick={() => setSection('inbox')}    icon={<Zap size={14}/>}         label="Priority Inbox" badge={priorityInboxTickets.filter(t=>!resolvedTicketIds.has(t.id)).length} />
          <SectionTab active={section==='tickets'}  onClick={() => setSection('tickets')}  icon={<Inbox size={14}/>}       label="Tickets"    badge={filteredTickets.filter(t=>t.status!=='resolved').length} />
          <SectionTab active={section==='students'} onClick={() => setSection('students')} icon={<Users size={14}/>}       label="Students"   badge={atRiskStudents.length} />
          <SectionTab active={section==='pipeline'} onClick={() => setSection('pipeline')} icon={<GitBranch size={14}/>}   label="Lifecycle"  />
          <SectionTab active={section==='outreach'} onClick={() => setSection('outreach')} icon={<Megaphone size={14}/>}   label="Outreach" />
          <SectionTab active={section==='updates'}  onClick={() => setSection('updates')}  icon={<BarChart3 size={14}/>}   label="Updates"    badge={MOCK_TRIGGERS.filter(t=>t.status==='pending').length} />
          <SectionTab active={section==='metrics'}  onClick={() => setSection('metrics')}  icon={<BarChart3 size={14}/>}   label="Metrics" />
        </div>

        {/* ── PRIORITY INBOX ─────────────────────────────────────── */}
        {section === 'inbox' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Zap size={16} className="text-yellow-500" /> Priority Inbox
                <span className="text-xs font-normal text-gray-400">Sorted by urgency score · showing top {priorityInboxTickets.length}</span>
              </h2>
            </div>
            {priorityInboxTickets.map(ticket => (
              <PriorityInboxRow
                key={ticket.id}
                ticket={ticket}
                onViewTimeline={setTimelineStudent}
                resolvedIds={resolvedTicketIds}
                onResolve={handleResolve}
                onEscalate={handleEscalate}
              />
            ))}
          </div>
        )}

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
                        <button
                          onClick={() => setTimelineStudent(s.name)}
                          className="font-semibold text-gray-900 dark:text-white text-sm hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {s.name}
                        </button>
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

        {/* ── LIFECYCLE PIPELINE ────────────────────────────────── */}
        {section === 'pipeline' && (
          <div className="space-y-6">
            {/* Pipeline overview: funnel visual */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <GitBranch size={16} className="text-blue-500" />
                Customer Lifecycle Pipeline
              </h2>
              <div className="flex items-stretch gap-0 overflow-x-auto">
                {(['acquisition', 'onboarding', 'delivery', 'retention', 'support'] as LifecyclePhase[]).map((phase, idx) => {
                  const cfg = PHASE_CONFIG[phase];
                  const rulesCount = LIFECYCLE_RULES.filter(r => r.phase === phase).length;
                  const activeRules = LIFECYCLE_RULES.filter(r => r.phase === phase && r.enabled).length;
                  const phaseStats: Record<LifecyclePhase, { count: number; label: string }> = {
                    acquisition: { count: MOCK_LEADS.filter(l => ['new','contacted','nurturing','trial'].includes(l.status)).length, label: 'leads active' },
                    onboarding:  { count: MOCK_LEADS.filter(l => l.status === 'converted').length,                                   label: 'users activating' },
                    delivery:    { count: MOCK_STUDENTS.filter(s => s.health === 'healthy').length,                                  label: 'students learning' },
                    retention:   { count: atRiskStudents.length,                                                                     label: 'need attention' },
                    support:     { count: examTickets.filter(t => t.status !== 'resolved').length,                                   label: 'tickets open' },
                  };
                  const stat = phaseStats[phase];
                  return (
                    <div key={phase} className="flex items-stretch flex-1 min-w-0">
                      <button onClick={() => setPipelinePhase(phase)}
                        className={clsx('flex-1 p-3 border rounded-lg text-left transition-all hover:shadow-md',
                          pipelinePhase === phase ? `${cfg.bg} border-current shadow-sm` : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800')}>
                        <div className="text-lg mb-1">{cfg.emoji}</div>
                        <p className={clsx('text-xs font-bold', cfg.color)}>{cfg.label.toUpperCase()}</p>
                        <p className={clsx('text-2xl font-bold mt-1', cfg.color)}>{stat.count}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{stat.label}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{activeRules}/{rulesCount} rules active</p>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">Owner: {cfg.ownerLabel}</p>
                      </button>
                      {idx < 4 && (
                        <div className="flex items-center px-1">
                          <ArrowRight size={14} className="text-gray-300 dark:text-gray-600 shrink-0" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lead pipeline (Acquisition section) */}
            {(pipelinePhase === 'all' || pipelinePhase === 'acquisition') && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <UserPlus size={14} className="text-emerald-500" /> 🌱 Lead Pipeline
                    <span className="text-xs font-normal text-gray-400">(Herald-managed)</span>
                  </h3>
                  <button className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 flex items-center gap-1">
                    <UserPlus size={12} /> Add Lead
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                        <th className="pb-2 pr-3 font-medium">Name</th>
                        <th className="pb-2 pr-3 font-medium">Contact</th>
                        <th className="pb-2 pr-3 font-medium">Exam</th>
                        <th className="pb-2 pr-3 font-medium">Source</th>
                        <th className="pb-2 pr-3 font-medium">Status</th>
                        <th className="pb-2 pr-3 font-medium">Touches</th>
                        <th className="pb-2 font-medium">Last Touch</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                      {MOCK_LEADS.map(lead => (
                        <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">{lead.name}</td>
                          <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">{lead.phone ?? lead.email ?? '—'}</td>
                          <td className="py-2 pr-3"><span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded">{lead.targetExam}</span></td>
                          <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">{lead.source.replace('_', ' ')}</td>
                          <td className="py-2 pr-3"><span className={clsx('px-1.5 py-0.5 rounded font-medium', LEAD_STATUS_COLORS[lead.status])}>{lead.status}</span></td>
                          <td className="py-2 pr-3 text-center text-gray-700 dark:text-gray-300">{lead.touchCount}</td>
                          <td className="py-2 text-gray-400">{lead.lastTouchAt ? timeAgo(lead.lastTouchAt) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Campaign ROI Card */}
            <CampaignROICard />

            {/* Lifecycle Rules Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Sparkles size={14} className="text-yellow-500" /> Automation Rules
                  <span className="text-xs font-normal text-gray-400">({lifecycleRules.filter(r => r.enabled).length}/{lifecycleRules.length} enabled)</span>
                </h3>
                {/* Phase filter */}
                <div className="flex gap-1">
                  {(['all', 'acquisition', 'onboarding', 'delivery', 'retention', 'support'] as const).map(p => (
                    <button key={p} onClick={() => setPipelinePhase(p as any)}
                      className={clsx('px-2 py-1 rounded text-xs font-medium transition-colors',
                        pipelinePhase === p ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600')}>
                      {p === 'all' ? 'All' : PHASE_CONFIG[p].emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {lifecycleRules.filter(r => pipelinePhase === 'all' || r.phase === pipelinePhase).map((rule, idx) => {
                  const cfg = PHASE_CONFIG[rule.phase];
                  return (
                    <div key={`${rule.phase}-${idx}`}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      {/* Toggle */}
                      <button onClick={() => setLifecycleRules(prev =>
                        prev.map((r, i) => i === prev.findIndex(x => x.templateKey === rule.templateKey && x.phase === rule.phase) ? { ...r, enabled: !r.enabled } : r)
                      )} className={clsx('w-8 h-4.5 rounded-full transition-colors shrink-0 flex items-center',
                        rule.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600')}>
                        <span className={clsx('w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5',
                          rule.enabled ? 'translate-x-4' : 'translate-x-0')} />
                      </button>
                      {/* Phase badge */}
                      <span className={clsx('px-1.5 py-0.5 rounded text-xs font-medium shrink-0', cfg.color, 'bg-transparent border', cfg.bg.includes('emerald') ? 'border-emerald-200 dark:border-emerald-700' : cfg.bg.includes('blue') ? 'border-blue-200 dark:border-blue-700' : cfg.bg.includes('indigo') ? 'border-indigo-200 dark:border-indigo-700' : cfg.bg.includes('orange') ? 'border-orange-200 dark:border-orange-700' : 'border-purple-200 dark:border-purple-700')}>
                        {cfg.emoji} {cfg.label}
                      </span>
                      {/* Trigger → outreach */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1 text-xs">
                          <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300 font-mono">{rule.triggerEvent}</code>
                          <ArrowRight size={10} className="text-gray-400" />
                          <span className="text-gray-800 dark:text-gray-200 font-medium">{rule.outreachType.replace(/_/g, ' ')}</span>
                          <span className="text-gray-400">via {rule.preferredChannel}</span>
                          {rule.delayHours > 0 && <span className="text-gray-400">+{rule.delayHours}h</span>}
                          {rule.delayHours < 0 && <span className="text-gray-400">{rule.delayHours}h (pre-event)</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">Owner: <span className="font-medium text-gray-600 dark:text-gray-300">{rule.ownerAgent}</span></span>
                          <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                          <span className="text-xs font-mono text-gray-400">{rule.templateKey}</span>
                        </div>
                      </div>
                      {/* Status */}
                      <span className={clsx('text-xs shrink-0', rule.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400')}>
                        {rule.enabled ? '● Live' : '○ Off'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Smart Rule Wizard */}
            <SmartRuleWizard />
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
            // Core (Support)
            { name: 'Ticket Router',          emoji: '🎯', status: 'active',  note: '4 tickets routed today' },
            { name: 'Resolution Suggester',   emoji: '💡', status: 'active',  note: 'Ready for tickets' },
            { name: 'Escalation Guard',       emoji: '🚨', status: 'active',  note: 'Watching 4 open tickets' },
            { name: 'CSAT Monitor',           emoji: '📈', status: 'active',  note: 'CSAT 4.2 — healthy' },
            // Lifecycle
            { name: 'Lead Nurture Engine',    emoji: '🌱', status: 'active',  note: `${MOCK_LEADS.filter(l=>l.status!=='converted'&&l.status!=='lost').length} leads in funnel` },
            { name: 'Onboarding Activator',   emoji: '🚀', status: 'active',  note: `${MOCK_LEADS.filter(l=>l.status==='converted').length} users activating` },
            { name: 'Delivery Cadence Mgr',   emoji: '📅', status: 'active',  note: 'Daily reminders live' },
            { name: 'Lifecycle Rule Engine',  emoji: '⚙️', status: 'active',  note: `${lifecycleRules.filter(r=>r.enabled).length} rules active` },
            // Retention
            { name: 'At-Risk Detector',       emoji: '⚠️', status: 'active',  note: `${atRiskStudents.length} students flagged` },
            { name: 'Churn Rescue',           emoji: '🔄', status: 'active',  note: '1 expiry in 3 days' },
            { name: 'Outreach Composer',      emoji: '✉️', status: 'active',  note: '23 messages drafted' },
            { name: 'Update Dispatcher',      emoji: '🚀', status: 'active',  note: '1 pending dispatch' },
            { name: 'Knowledge Updater',      emoji: '📚', status: 'idle',    note: '2 KB entries pending' },
            { name: 'Broadcast Planner',      emoji: '📢', status: 'idle',    note: 'No broadcasts scheduled' },
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

    {/* Student Timeline Drawer — slides in from right when student name is clicked */}
    {timelineStudent && (
      <StudentTimelineDrawer
        studentName={timelineStudent}
        onClose={() => setTimelineStudent(null)}
      />
    )}
    </>
  );
}

export default ManagerDashboard;
