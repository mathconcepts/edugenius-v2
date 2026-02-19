/**
 * UserAttributeRegistry.tsx — Central User Attribute / Input Registry
 *
 * All attributes required or optional for a user in EduGenius.
 * Shows: mandatory/optional, which roles need it, purpose, impacted
 * agents + sub-agents + features, validation rules, and collection point.
 *
 * Route: /user-attributes
 * Access: CEO, Admin (configure); Teacher (read)
 */

import React, { useState, useMemo } from 'react';
import {
  Search, ChevronDown, ChevronRight, Info,
  CheckCircle2, Clock, User, Bot, Zap,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type AttrStatus   = 'mandatory' | 'optional' | 'conditional' | 'system_generated';
type UserRole     = 'student' | 'teacher' | 'parent' | 'admin' | 'ceo';
type CollectWhen  = 'signup' | 'onboarding' | 'profile' | 'payment' | 'channel_connect' | 'settings' | 'admin_set';
type ImpactLevel  = 'critical' | 'high' | 'medium' | 'low';

interface ImpactedItem {
  name: string;             // agent / sub-agent / feature name
  kind: 'agent' | 'subagent' | 'feature';
  emoji?: string;
  impact: ImpactLevel;
  reason: string;           // why this attribute affects it
}

interface UserAttribute {
  id: string;
  name: string;
  category: string;
  status: AttrStatus;
  conditionNote?: string;   // shown when status=conditional
  roles: UserRole[];        // which roles this applies to
  collectAt: CollectWhen[]; // where/when it is collected
  dataType: string;         // e.g. 'string', 'enum', 'date', 'boolean'
  validation?: string;      // human-readable rule
  purpose: string;
  fallback: string;         // what happens if absent
  impacted: ImpactedItem[];
  example?: string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const ATTRIBUTES: UserAttribute[] = [

  // ═══════════════════════════════════════════════════════
  // IDENTITY
  // ═══════════════════════════════════════════════════════

  {
    id: 'first_name', name: 'First Name', category: 'Identity', status: 'mandatory',
    roles: ['student','teacher','parent','admin','ceo'], collectAt: ['signup'],
    dataType: 'string', validation: '2–50 chars',
    purpose: 'Personalises all communications, tutor greetings, certificates, and parent notifications.',
    fallback: 'Platform cannot create account without it.',
    example: 'Arjun',
    impacted: [
      {name:'Sage',      kind:'agent',    emoji:'🧠', impact:'high',   reason:'Personalises Socratic greetings and encouragement messages'},
      {name:'Mentor',    kind:'agent',    emoji:'🎯', impact:'high',   reason:'Study reminders use student name for engagement'},
      {name:'Herald',    kind:'agent',    emoji:'📣', impact:'medium', reason:'Email subject lines and WhatsApp messages use first name'},
      {name:'Chat UI',   kind:'feature',             impact:'medium', reason:'Displayed in chat header and welcome screen'},
      {name:'Certificates', kind:'feature',          impact:'high',   reason:'Printed on achievement certificates'},
    ],
  },
  {
    id: 'last_name', name: 'Last Name', category: 'Identity', status: 'mandatory',
    roles: ['student','teacher','parent','admin','ceo'], collectAt: ['signup'],
    dataType: 'string', validation: '2–50 chars',
    purpose: 'Full name for certificates, admin records, and formal communications.',
    fallback: 'Account blocked from creation.',
    example: 'Sharma',
    impacted: [
      {name:'Certificates', kind:'feature', impact:'high',   reason:'Full name on completion certificates'},
      {name:'Oracle',       kind:'agent',   emoji:'📊', impact:'low', reason:'Student leaderboard display name'},
    ],
  },
  {
    id: 'display_name', name: 'Display Name / Nickname', category: 'Identity', status: 'optional',
    roles: ['student','teacher'], collectAt: ['profile'],
    dataType: 'string', validation: '2–30 chars',
    purpose: 'Shown in leaderboards, chat, and peer interactions. Students can choose a pseudonym.',
    fallback: 'First name used as display name.',
    example: 'AJ_JEE2026',
    impacted: [
      {name:'Leaderboard', kind:'feature', impact:'high',   reason:'Public identity in competitive rankings'},
      {name:'Chat UI',     kind:'feature', impact:'medium', reason:'Shown in group study rooms'},
      {name:'Mentor',      kind:'agent', emoji:'🎯', impact:'low', reason:'Gamification shout-outs use display name'},
    ],
  },
  {
    id: 'date_of_birth', name: 'Date of Birth', category: 'Identity', status: 'optional',
    roles: ['student','parent'], collectAt: ['onboarding','profile'],
    dataType: 'date', validation: 'Must be past date; student: age 10–25',
    purpose: 'Age-appropriate content filtering, COPPA compliance for under-13, birthday rewards.',
    fallback: 'No age-gating applied. No birthday streak bonus.',
    example: '2008-07-15',
    impacted: [
      {name:'Mentor',          kind:'agent',   emoji:'🎯', impact:'medium', reason:'Birthday streak bonus and motivational message'},
      {name:'Content Filter',  kind:'feature',             impact:'high',   reason:'Under-13 content restrictions (COPPA)'},
      {name:'Atlas',           kind:'agent',   emoji:'📚', impact:'low',    reason:'Age-appropriate question difficulty calibration'},
    ],
  },
  {
    id: 'gender', name: 'Gender', category: 'Identity', status: 'optional',
    roles: ['student','teacher','parent'], collectAt: ['profile'],
    dataType: 'enum', validation: 'male | female | other | prefer_not_to_say',
    purpose: 'Personalises pronouns in AI tutor responses ("he/she/they"). Diversity analytics.',
    fallback: 'Gender-neutral pronouns used throughout.',
    impacted: [
      {name:'Sage',   kind:'agent', emoji:'🧠', impact:'low', reason:'Pronoun selection in encouragement messages'},
      {name:'Oracle', kind:'agent', emoji:'📊', impact:'low', reason:'Gender diversity analytics for admin dashboard'},
    ],
  },
  {
    id: 'avatar', name: 'Profile Photo / Avatar', category: 'Identity', status: 'optional',
    roles: ['student','teacher','parent','admin','ceo'], collectAt: ['profile'],
    dataType: 'image_url', validation: 'JPEG/PNG, max 2MB, square crop',
    purpose: 'Humanises the experience. Shown in leaderboards, chat, and teacher dashboards.',
    fallback: 'Auto-generated initials avatar.',
    impacted: [
      {name:'Chat UI',     kind:'feature', impact:'medium', reason:'Avatar shown in chat bubbles'},
      {name:'Leaderboard', kind:'feature', impact:'medium', reason:'Profile picture in rankings'},
    ],
  },

  // ═══════════════════════════════════════════════════════
  // CONTACT CHANNELS
  // ═══════════════════════════════════════════════════════

  {
    id: 'email', name: 'Email Address', category: 'Contact Channels', status: 'mandatory',
    roles: ['student','teacher','parent','admin','ceo'], collectAt: ['signup'],
    dataType: 'email', validation: 'Valid email format; must be unique in system',
    purpose: 'Primary identity + login credential. OTP delivery, password reset, subscription receipts, study reminders.',
    fallback: 'Cannot create account without email.',
    example: 'arjun@gmail.com',
    impacted: [
      {name:'Auth Guard',        kind:'subagent', impact:'critical', reason:'Primary login identifier'},
      {name:'Mentor',            kind:'agent',    emoji:'🎯', impact:'critical', reason:'Daily study reminders via email'},
      {name:'Herald',            kind:'agent',    emoji:'📣', impact:'high',     reason:'Newsletter, marketing campaigns, subscription receipts'},
      {name:'Subscription Notifier', kind:'subagent', impact:'high', reason:'Plan renewal, expiry warnings, payment receipts'},
      {name:'Email Verification', kind:'feature',             impact:'critical', reason:'Account activation requires verified email'},
    ],
  },
  {
    id: 'email_verified', name: 'Email Verified', category: 'Contact Channels', status: 'mandatory',
    roles: ['student','teacher','parent','admin','ceo'], collectAt: ['onboarding'],
    dataType: 'boolean',
    purpose: 'Confirms email ownership. Required before accessing full platform features.',
    fallback: 'Restricted to read-only mode until verified.',
    impacted: [
      {name:'Auth Guard',       kind:'subagent', impact:'critical', reason:'Unverified users blocked from premium features'},
      {name:'Study Reminder',   kind:'subagent', impact:'high',     reason:'Reminders only sent to verified emails'},
      {name:'Herald',           kind:'agent',    emoji:'📣', impact:'high', reason:'Marketing emails not sent to unverified'},
    ],
  },
  {
    id: 'phone', name: 'Phone Number', category: 'Contact Channels', status: 'conditional',
    conditionNote: 'Mandatory for WhatsApp/SMS channels; optional otherwise',
    roles: ['student','parent'], collectAt: ['onboarding','profile'],
    dataType: 'phone', validation: 'E.164 format, e.g. +91XXXXXXXXXX',
    purpose: 'WhatsApp tutoring, SMS OTP fallback, study reminders via SMS. Required for Indian market engagement.',
    fallback: 'WhatsApp and SMS channels unavailable. Email/web-only.',
    example: '+919876543210',
    impacted: [
      {name:'WhatsApp Handler',  kind:'subagent', impact:'critical', reason:'No phone = no WhatsApp tutoring'},
      {name:'SMS OTP Verifier',  kind:'subagent', impact:'high',     reason:'SMS fallback for login OTP'},
      {name:'Mentor',            kind:'agent',    emoji:'🎯', impact:'high',   reason:'SMS and WhatsApp study reminders'},
      {name:'Sage',              kind:'agent',    emoji:'🧠', impact:'high',   reason:'Multi-channel tutoring via WhatsApp'},
      {name:'Herald',            kind:'agent',    emoji:'📣', impact:'medium', reason:'WhatsApp broadcast campaigns'},
    ],
  },
  {
    id: 'phone_verified', name: 'Phone Verified', category: 'Contact Channels', status: 'conditional',
    conditionNote: 'Required if phone is provided',
    roles: ['student','parent'], collectAt: ['onboarding'],
    dataType: 'boolean',
    purpose: 'Confirms phone ownership before enabling WhatsApp/SMS communications.',
    fallback: 'WhatsApp and SMS disabled even if phone is on file.',
    impacted: [
      {name:'WhatsApp Handler', kind:'subagent', impact:'critical', reason:'WhatsApp only activates after phone verification'},
      {name:'Push Notifier',    kind:'subagent', impact:'high',     reason:'SMS OTP and reminders gated on verified phone'},
    ],
  },
  {
    id: 'whatsapp_id', name: 'WhatsApp Account ID', category: 'Contact Channels', status: 'optional',
    roles: ['student','parent'], collectAt: ['channel_connect'],
    dataType: 'string', validation: 'Linked via WhatsApp Business API verification flow',
    purpose: 'Enables AI tutoring, reminders, and study material delivery directly in WhatsApp.',
    fallback: 'Web chat only. No WhatsApp tutoring.',
    impacted: [
      {name:'Sage',          kind:'agent',    emoji:'🧠', impact:'high',   reason:'WhatsApp-based AI tutor sessions'},
      {name:'Mentor',        kind:'agent',    emoji:'🎯', impact:'high',   reason:'WhatsApp daily reminders and streak nudges'},
      {name:'Herald',        kind:'agent',    emoji:'📣', impact:'medium', reason:'WhatsApp campaign broadcasts'},
      {name:'WhatsApp Handler', kind:'subagent',          impact:'critical', reason:'Core WhatsApp routing'},
      {name:'Broadcast Manager', kind:'subagent',         impact:'medium',   reason:'Bulk messaging to connected students'},
    ],
  },
  {
    id: 'telegram_id', name: 'Telegram Chat ID / Username', category: 'Contact Channels', status: 'optional',
    roles: ['student','teacher','parent'], collectAt: ['channel_connect'],
    dataType: 'string', validation: 'Linked via Telegram deep-link verification',
    purpose: 'Enables AI tutoring, math rendering, inline study commands, and group study rooms on Telegram.',
    fallback: 'Web chat only. No Telegram tutoring.',
    impacted: [
      {name:'Sage',             kind:'agent',    emoji:'🧠', impact:'high',   reason:'Telegram AI tutor sessions with LaTeX rendering'},
      {name:'Mentor',           kind:'agent',    emoji:'🎯', impact:'medium', reason:'Telegram study reminders'},
      {name:'Herald',           kind:'agent',    emoji:'📣', impact:'medium', reason:'Telegram channel announcements'},
      {name:'Telegram Handler', kind:'subagent',             impact:'critical', reason:'Core Telegram message routing'},
    ],
  },

  // ═══════════════════════════════════════════════════════
  // ACADEMIC PROFILE (Student)
  // ═══════════════════════════════════════════════════════

  {
    id: 'primary_exam', name: 'Primary Exam Target', category: 'Academic Profile', status: 'mandatory',
    roles: ['student'], collectAt: ['onboarding'],
    dataType: 'enum', validation: 'JEE_MAIN | JEE_ADVANCED | NEET | CBSE_10 | CBSE_12 | CAT | UPSC | GATE | STATE_BOARDS',
    purpose: 'Configures entire platform experience: content, question bank, agent prompts, difficulty, syllabus, and exam calendar.',
    fallback: 'Generic curriculum shown. No exam-specific tuning, strategies, or countdown.',
    example: 'JEE_MAIN',
    impacted: [
      {name:'Sage',            kind:'agent',    emoji:'🧠', impact:'critical', reason:'All tutor system prompts are exam-specific'},
      {name:'Atlas',           kind:'agent',    emoji:'📚', impact:'critical', reason:'Content factory generates exam-specific questions/notes'},
      {name:'Mentor',          kind:'agent',    emoji:'🎯', impact:'critical', reason:'Study plan built around exam date and syllabus'},
      {name:'Scout',           kind:'agent',    emoji:'🔍', impact:'high',     reason:'Tracks exam-specific competitor pricing and trends'},
      {name:'Oracle',          kind:'agent',    emoji:'📊', impact:'high',     reason:'Analytics segmented by exam type'},
      {name:'Exam Countdown',  kind:'feature',              impact:'high',     reason:'Countdown only works with a target exam set'},
      {name:'Question Bank',   kind:'feature',              impact:'critical', reason:'Questions filtered by exam syllabus'},
      {name:'ExamInsights',    kind:'feature',              impact:'critical', reason:'Best practices, strategies, topper stories per exam'},
      {name:'Topic Cluster Analyzer', kind:'subagent',      impact:'high',     reason:'Maps weak topics to exam weightage'},
    ],
  },
  {
    id: 'primary_exam_year', name: 'Target Exam Year', category: 'Academic Profile', status: 'mandatory',
    roles: ['student'], collectAt: ['onboarding'],
    dataType: 'integer', validation: 'Current year to +3 years',
    purpose: 'Drives exam countdown timer, study timeline intensity, and content pacing.',
    fallback: 'No countdown. Study plan defaults to 12-month timeline.',
    example: '2026',
    impacted: [
      {name:'Mentor',         kind:'agent',    emoji:'🎯', impact:'critical', reason:'Study plan phases calculated from exam date'},
      {name:'Exam Countdown', kind:'feature',              impact:'high',     reason:'Days-to-exam banner on student dashboard'},
      {name:'Study Planner',  kind:'subagent',             impact:'critical', reason:'Pacing and milestone scheduling'},
    ],
  },
  {
    id: 'exam_attempt', name: 'Attempt Number', category: 'Academic Profile', status: 'optional',
    roles: ['student'], collectAt: ['onboarding','profile'],
    dataType: 'integer', validation: '1, 2, or 3',
    purpose: 'Dropper/repeater students get different content strategy — focussed revision vs new learning.',
    fallback: 'Treated as first attempt.',
    impacted: [
      {name:'Sage',   kind:'agent', emoji:'🧠', impact:'medium', reason:'Dropper prompt: revision-heavy vs concept-first'},
      {name:'Mentor', kind:'agent', emoji:'🎯', impact:'medium', reason:'Different motivation strategy for droppers'},
      {name:'Atlas',  kind:'agent', emoji:'📚', impact:'low',    reason:'Revision content prioritised for 2nd/3rd attempt'},
    ],
  },
  {
    id: 'secondary_exams', name: 'Secondary Exam Targets', category: 'Academic Profile', status: 'optional',
    roles: ['student'], collectAt: ['onboarding','profile'],
    dataType: 'string[]', validation: 'Max 3 secondary exams',
    purpose: 'Blended content strategy — e.g. JEE + BITSAT overlap topics surfaced together.',
    fallback: 'Single-exam content only.',
    impacted: [
      {name:'Atlas',  kind:'agent', emoji:'📚', impact:'medium', reason:'Cross-exam topic overlap content'},
      {name:'Mentor', kind:'agent', emoji:'🎯', impact:'low',    reason:'Multi-exam study schedule'},
    ],
  },
  {
    id: 'grade', name: 'Current Grade / Class', category: 'Academic Profile', status: 'mandatory',
    roles: ['student'], collectAt: ['onboarding'],
    dataType: 'integer', validation: '6–12 (school), 1–4 (college)',
    purpose: 'Determines curriculum level, question difficulty, and appropriate content pool.',
    fallback: 'Content defaulted to Grade 12 difficulty. May be too hard for junior students.',
    example: '11',
    impacted: [
      {name:'Atlas',           kind:'agent',    emoji:'📚', impact:'critical', reason:'Content generation filtered by grade'},
      {name:'Sage',            kind:'agent',    emoji:'🧠', impact:'high',     reason:'Explanation complexity scaled to grade'},
      {name:'Curriculum Mapper', kind:'subagent',           impact:'critical', reason:'Maps grade to syllabus chapters'},
      {name:'Question Generator', kind:'subagent',          impact:'critical', reason:'Questions generated at grade difficulty'},
    ],
  },
  {
    id: 'board', name: 'Education Board', category: 'Academic Profile', status: 'conditional',
    conditionNote: 'Mandatory for school exams (CBSE_10, CBSE_12, STATE_BOARDS)',
    roles: ['student'], collectAt: ['onboarding'],
    dataType: 'enum', validation: 'CBSE | ICSE | STATE | IB | OTHER',
    purpose: 'Aligns content to the right syllabus. CBSE vs ICSE have different chapter structures.',
    fallback: 'CBSE assumed. Wrong syllabus shown for ICSE/State board students.',
    example: 'CBSE',
    impacted: [
      {name:'Atlas',            kind:'agent',    emoji:'📚', impact:'critical', reason:'Syllabus source differs by board'},
      {name:'Curriculum Mapper', kind:'subagent',            impact:'critical', reason:'Chapter ordering maps to board guidelines'},
    ],
  },
  {
    id: 'subjects', name: 'Subject Configuration', category: 'Academic Profile', status: 'mandatory',
    roles: ['student'], collectAt: ['onboarding'],
    dataType: 'SubjectPreference[]', validation: 'Priority 1–3 per subject; enable/disable toggles',
    purpose: 'Determines which subjects get content, questions, and agent attention. Priority drives study plan hours allocation.',
    fallback: 'All exam subjects enabled at equal priority.',
    impacted: [
      {name:'Mentor',             kind:'agent',    emoji:'🎯', impact:'critical', reason:'Daily study plan hours allocated by priority'},
      {name:'Atlas',              kind:'agent',    emoji:'📚', impact:'critical', reason:'Content volume per subject'},
      {name:'Sage',               kind:'agent',    emoji:'🧠', impact:'critical', reason:'Tutor focuses on configured subjects'},
      {name:'Question Generator', kind:'subagent',             impact:'critical', reason:'Questions generated only for enabled subjects'},
      {name:'Progress Tracker',   kind:'subagent',             impact:'high',     reason:'Progress analytics per subject'},
    ],
  },
  {
    id: 'strong_weak_subjects', name: 'Strong / Weak Subjects', category: 'Academic Profile', status: 'optional',
    roles: ['student'], collectAt: ['onboarding','profile'],
    dataType: 'Subject[]',
    purpose: 'Adaptive difficulty engine prioritises weak subjects. Strong subjects get revision-mode content.',
    fallback: 'Uniform difficulty across all subjects. Less personalisation.',
    impacted: [
      {name:'Sage',   kind:'agent', emoji:'🧠', impact:'high',   reason:'Harder questions in weak subjects, lighter in strong'},
      {name:'Mentor', kind:'agent', emoji:'🎯', impact:'high',   reason:'Weak subject sessions scheduled more frequently'},
      {name:'Atlas',  kind:'agent', emoji:'📚', impact:'medium', reason:'More remedial content generated for weak subjects'},
      {name:'Adaptive Engine', kind:'feature', impact:'high',   reason:'Core input to difficulty adjustment algorithm'},
    ],
  },
  {
    id: 'school', name: 'School / Institution Name', category: 'Academic Profile', status: 'optional',
    roles: ['student','teacher'], collectAt: ['profile'],
    dataType: 'string',
    purpose: 'Institution-level analytics for teachers, school partnerships, and leaderboard grouping.',
    fallback: 'No institution-based grouping or leaderboards.',
    impacted: [
      {name:'Oracle',      kind:'agent', emoji:'📊', impact:'medium', reason:'School-level analytics for admin dashboard'},
      {name:'Leaderboard', kind:'feature',            impact:'medium', reason:'School leaderboard grouping'},
      {name:'Scout',       kind:'agent', emoji:'🔍', impact:'low',    reason:'School-based B2B partnership targeting'},
    ],
  },
  {
    id: 'target_score', name: 'Target Score / Rank', category: 'Academic Profile', status: 'optional',
    roles: ['student'], collectAt: ['onboarding','profile'],
    dataType: 'integer', validation: 'Percentile 0–100 OR rank',
    purpose: 'Calibrates study plan intensity and milestone pacing. Goal-anchored motivation.',
    fallback: 'Generic improvement target used.',
    example: '99 percentile',
    impacted: [
      {name:'Mentor',         kind:'agent',    emoji:'🎯', impact:'high',   reason:'Gap analysis between current level and target'},
      {name:'Study Planner',  kind:'subagent',             impact:'high',   reason:'Intensity and hours calculated from gap to target'},
      {name:'Progress Tracker', kind:'subagent',           impact:'medium', reason:'Progress shown vs target, not just absolute'},
    ],
  },
  {
    id: 'dream_colleges', name: 'Dream Colleges', category: 'Academic Profile', status: 'optional',
    roles: ['student'], collectAt: ['profile'],
    dataType: 'string[]',
    purpose: 'Personalises aspirational motivation messages and cut-off benchmarks.',
    fallback: 'Generic motivation used.',
    impacted: [
      {name:'Mentor', kind:'agent', emoji:'🎯', impact:'medium', reason:'References dream college in motivation messages ("You need X rank for IIT Bombay")'},
      {name:'Sage',   kind:'agent', emoji:'🧠', impact:'low',    reason:'Cut-off info used in contextual encouragement'},
    ],
  },

  // ═══════════════════════════════════════════════════════
  // LEARNING PREFERENCES
  // ═══════════════════════════════════════════════════════

  {
    id: 'learning_style', name: 'Learning Style', category: 'Learning Preferences', status: 'optional',
    roles: ['student'], collectAt: ['onboarding'],
    dataType: 'enum', validation: 'visual | auditory | reading | kinesthetic | mixed',
    purpose: 'Personalises explanation format: visual gets diagrams first, reading gets text-dense notes, kinesthetic gets practice-first.',
    fallback: 'Mixed style default — balanced text + diagrams.',
    impacted: [
      {name:'Sage',  kind:'agent', emoji:'🧠', impact:'high',   reason:'Explanation modality adapted to learning style'},
      {name:'Atlas', kind:'agent', emoji:'📚', impact:'high',   reason:'Content format weighted towards preferred style'},
      {name:'Concept Explainer', kind:'subagent', impact:'high', reason:'Selects diagram vs text vs analogy format'},
    ],
  },
  {
    id: 'preferred_language', name: 'Preferred Language', category: 'Learning Preferences', status: 'optional',
    roles: ['student','teacher'], collectAt: ['onboarding','settings'],
    dataType: 'enum', validation: 'en | hi | hinglish | regional',
    purpose: 'All tutor responses, notes, and UI delivered in preferred language. Vernacular support for Tier 2/3 India.',
    fallback: 'English default.',
    impacted: [
      {name:'Sage',       kind:'agent',    emoji:'🧠', impact:'critical', reason:'Tutor responses in student language'},
      {name:'Atlas',      kind:'agent',    emoji:'📚', impact:'high',     reason:'Notes and content generated in that language'},
      {name:'Translator', kind:'subagent',             impact:'critical', reason:'Primary driver of translation pipeline'},
      {name:'Herald',     kind:'agent',    emoji:'📣', impact:'medium',   reason:'Marketing messages in regional language'},
    ],
  },
  {
    id: 'study_pace', name: 'Study Pace', category: 'Learning Preferences', status: 'optional',
    roles: ['student'], collectAt: ['onboarding'],
    dataType: 'enum', validation: 'relaxed | moderate | intensive | crash',
    purpose: 'Calibrates daily study hours, content volume, and session length to student bandwidth.',
    fallback: 'Moderate pace default.',
    impacted: [
      {name:'Mentor',        kind:'agent',    emoji:'🎯', impact:'high',   reason:'Study plan session length and frequency'},
      {name:'Study Planner', kind:'subagent',             impact:'high',   reason:'Daily question quota and reading volume'},
    ],
  },
  {
    id: 'daily_study_hours', name: 'Available Study Hours / Day', category: 'Learning Preferences', status: 'optional',
    roles: ['student'], collectAt: ['onboarding','settings'],
    dataType: 'float', validation: '0.5–16 hours',
    purpose: 'Primary input to study plan scheduling algorithm. Caps daily content delivery.',
    fallback: '3 hours/day assumed.',
    example: '6',
    impacted: [
      {name:'Study Planner', kind:'subagent', impact:'critical', reason:'Entire study schedule built from available hours'},
      {name:'Mentor',        kind:'agent',    emoji:'🎯', impact:'high',   reason:'Session reminders timed to study schedule'},
      {name:'Adaptive Engine', kind:'feature',             impact:'high',   reason:'Content volume gated by available hours'},
    ],
  },
  {
    id: 'preferred_study_time', name: 'Preferred Study Time', category: 'Learning Preferences', status: 'optional',
    roles: ['student'], collectAt: ['onboarding','settings'],
    dataType: 'enum', validation: 'morning | afternoon | evening | night',
    purpose: 'Schedules reminders and live sessions at preferred time. Night owls vs morning birds.',
    fallback: 'Evening default (6–9PM IST).',
    impacted: [
      {name:'Study Reminder', kind:'subagent', impact:'high', reason:'Reminders sent at preferred study time'},
      {name:'Mentor',         kind:'agent', emoji:'🎯', impact:'medium', reason:'Schedules motivational check-ins at active hours'},
    ],
  },
  {
    id: 'current_level', name: 'Current Difficulty Level', category: 'Learning Preferences', status: 'optional',
    roles: ['student'], collectAt: ['onboarding'],
    dataType: 'enum', validation: 'beginner | intermediate | advanced | expert',
    purpose: 'Starting difficulty for question bank and content. Avoids overwhelming beginners or boring toppers.',
    fallback: 'Intermediate default. Diagnostic test recommended.',
    impacted: [
      {name:'Sage',               kind:'agent',    emoji:'🧠', impact:'high',   reason:'Question difficulty initialised at this level'},
      {name:'Question Generator', kind:'subagent',             impact:'high',   reason:'Generates questions at stated difficulty'},
      {name:'Adaptive Engine',    kind:'feature',              impact:'high',   reason:'Baseline for difficulty adjustment'},
    ],
  },
  {
    id: 'diagnostic_score', name: 'Diagnostic Test Score', category: 'Learning Preferences', status: 'optional',
    roles: ['student'], collectAt: ['onboarding'],
    dataType: 'float', validation: '0–100 percentile',
    purpose: 'Overrides self-reported current level with objective measurement. More accurate personalisation.',
    fallback: 'Self-reported level used. Less accurate adaptive engine.',
    impacted: [
      {name:'Adaptive Engine', kind:'feature',  impact:'critical', reason:'Primary calibration input after diagnostic'},
      {name:'Sage',            kind:'agent', emoji:'🧠', impact:'high', reason:'Question difficulty set from diagnostic'},
      {name:'Mentor',          kind:'agent', emoji:'🎯', impact:'medium', reason:'Gap-to-target study plan recalibrated after diagnostic'},
    ],
  },

  // ═══════════════════════════════════════════════════════
  // LOCATION
  // ═══════════════════════════════════════════════════════
  {
    id: 'city', name: 'City', category: 'Location', status: 'optional',
    roles: ['student','teacher'], collectAt: ['profile'],
    dataType: 'string',
    purpose: 'Enables city-based leaderboards, local coaching recommendations, and regional language defaults.',
    fallback: 'No city-based features. National leaderboard only.',
    impacted: [
      {name:'Scout',       kind:'agent',    emoji:'🔍', impact:'medium', reason:'City-level market insights and competitor tracking'},
      {name:'Herald',      kind:'agent',    emoji:'📣', impact:'medium', reason:'Location-based marketing campaigns'},
      {name:'Leaderboard', kind:'feature',              impact:'medium', reason:'City leaderboard grouping'},
    ],
  },
  {
    id: 'state', name: 'State', category: 'Location', status: 'optional',
    roles: ['student','teacher'], collectAt: ['profile'],
    dataType: 'string',
    purpose: 'State board syllabus selection, regional language defaults, and state-level analytics.',
    fallback: 'No state-specific features.',
    impacted: [
      {name:'Atlas',  kind:'agent', emoji:'📚', impact:'medium', reason:'State board syllabus if exam=STATE_BOARDS'},
      {name:'Oracle', kind:'agent', emoji:'📊', impact:'low',    reason:'State-wise analytics for admin'},
    ],
  },
  {
    id: 'country', name: 'Country', category: 'Location', status: 'optional',
    roles: ['student','teacher','parent'], collectAt: ['signup','profile'],
    dataType: 'string', validation: 'ISO 3166-1 alpha-2',
    purpose: 'Determines currency, payment gateway (Razorpay for India, Stripe for international), tax, and language defaults.',
    fallback: 'India assumed. Wrong gateway shown for international students.',
    example: 'IN',
    impacted: [
      {name:'Subscription Manager', kind:'subagent', impact:'critical', reason:'Currency and payment gateway routing'},
      {name:'Stripe / Razorpay',    kind:'feature',                      impact:'critical', reason:'Gateway selected by country'},
      {name:'Herald',               kind:'agent',    emoji:'📣', impact:'medium', reason:'Region-specific pricing displayed'},
    ],
  },
  {
    id: 'billing_address', name: 'Billing Address', category: 'Location', status: 'conditional',
    conditionNote: 'Required at checkout for invoicing and GST compliance',
    roles: ['student','parent','teacher'], collectAt: ['payment'],
    dataType: 'object', validation: 'Line 1, City, State, Pincode, Country',
    purpose: 'GST invoice generation, payment gateway compliance, and international tax.',
    fallback: 'Payment may fail for B2B invoicing. GST input credit not available.',
    impacted: [
      {name:'Subscription Manager', kind:'subagent', impact:'high',   reason:'Invoice generation requires billing address'},
      {name:'Stripe / Razorpay',    kind:'feature',                    impact:'high',   reason:'Required for gateway compliance'},
      {name:'Oracle',               kind:'agent', emoji:'📊', impact:'medium', reason:'Revenue analytics by geography'},
    ],
  },

  // ═══════════════════════════════════════════════════════
  // SUBSCRIPTION & PAYMENT
  // ═══════════════════════════════════════════════════════

  {
    id: 'plan_id', name: 'Subscription Plan', category: 'Subscription & Payment', status: 'mandatory',
    roles: ['student','teacher','parent'], collectAt: ['signup','payment'],
    dataType: 'enum', validation: 'free | basic | standard | premium | institutional',
    purpose: 'Gates features: question limits, AI tutor sessions, number of exams, chat channels, download quota.',
    fallback: 'Free plan defaults. Core features locked.',
    example: 'premium',
    impacted: [
      {name:'Sage',                kind:'agent',    emoji:'🧠', impact:'critical', reason:'Daily AI chat session limit enforced by plan'},
      {name:'Herald',              kind:'agent',    emoji:'📣', impact:'high',     reason:'Churn predictor and upsell triggers based on plan usage'},
      {name:'Atlas',               kind:'agent',    emoji:'📚', impact:'high',     reason:'Question download quota per plan'},
      {name:'Paywall / Feature Gate', kind:'feature',           impact:'critical', reason:'All premium features gated on plan'},
      {name:'Subscription Manager',   kind:'subagent',          impact:'critical', reason:'Plan enforcement and renewal management'},
      {name:'Revenue Tracker',        kind:'subagent',          impact:'high',     reason:'MRR/ARR calculation by plan'},
    ],
  },
  {
    id: 'plan_expires_at', name: 'Plan Expiry Date', category: 'Subscription & Payment', status: 'mandatory',
    roles: ['student','teacher','parent'], collectAt: ['payment'],
    dataType: 'datetime',
    purpose: 'Drives subscription renewal reminders, feature downgrade on expiry, and grace period management.',
    fallback: 'No expiry enforcement — plan never expires (not suitable for production).',
    impacted: [
      {name:'Mentor',              kind:'agent',    emoji:'🎯', impact:'high',   reason:'Expiry reminder 7, 3, 1 days before'},
      {name:'Subscription Notifier', kind:'subagent',           impact:'critical', reason:'Sends renewal reminders and expired notices'},
      {name:'Paywall',             kind:'feature',              impact:'critical', reason:'Feature access revoked on expiry'},
      {name:'Herald',              kind:'agent',    emoji:'📣', impact:'medium', reason:'Renewal campaign triggered near expiry'},
    ],
  },
  {
    id: 'payment_method', name: 'Payment Method / Token', category: 'Subscription & Payment', status: 'conditional',
    conditionNote: 'Required for paid plans; not stored raw — tokenised by payment gateway',
    roles: ['student','parent','teacher'], collectAt: ['payment'],
    dataType: 'token', validation: 'Razorpay/Stripe token only — card data never stored on EduGenius servers',
    purpose: 'Auto-renewal of subscriptions without re-entering card details.',
    fallback: 'Manual renewal required. Higher churn on expiry.',
    impacted: [
      {name:'Subscription Manager', kind:'subagent', impact:'high',   reason:'Enables auto-renewal without user friction'},
      {name:'Herald',               kind:'agent', emoji:'📣', impact:'medium', reason:'Churn predictor watches for failed payment tokens'},
    ],
  },
  {
    id: 'gst_number', name: 'GST Number', category: 'Subscription & Payment', status: 'optional',
    roles: ['teacher','admin'], collectAt: ['payment','profile'],
    dataType: 'string', validation: '15-char GSTIN format',
    purpose: 'B2B invoice with GST input credit for institutional/teacher subscribers.',
    fallback: 'B2C invoice issued. No GST input credit.',
    impacted: [
      {name:'Subscription Manager', kind:'subagent', impact:'medium', reason:'Switches to B2B invoice template with GSTIN'},
      {name:'Oracle',               kind:'agent', emoji:'📊', impact:'low',    reason:'Tax analytics for institutional accounts'},
    ],
  },
  {
    id: 'referral_code', name: 'Referral Code (Used)', category: 'Subscription & Payment', status: 'optional',
    roles: ['student','parent'], collectAt: ['signup'],
    dataType: 'string',
    purpose: 'Grants signup discount to new user. Credits referrer with commission or free days.',
    fallback: 'No discount applied. Referrer not credited.',
    impacted: [
      {name:'Herald',              kind:'agent',    emoji:'📣', impact:'high',   reason:'Referral program tracking and commission crediting'},
      {name:'Subscription Manager', kind:'subagent',            impact:'medium', reason:'Discount applied at checkout'},
      {name:'Revenue Tracker',     kind:'subagent',             impact:'medium', reason:'Attribution analytics for referral channel'},
    ],
  },
  {
    id: 'invite_code', name: 'Invite Code', category: 'Subscription & Payment', status: 'optional',
    roles: ['student','teacher','parent'], collectAt: ['signup'],
    dataType: 'string',
    purpose: 'Institutional or teacher invites — auto-assigns student to teacher/batch, skips exam selection.',
    fallback: 'Self-service onboarding. No pre-assignment to teacher/batch.',
    impacted: [
      {name:'Auth Guard',      kind:'subagent', impact:'medium', reason:'Validates invite and pre-fills role/batch'},
      {name:'Students page',   kind:'feature',                   impact:'medium', reason:'Student automatically added to inviter\'s roster'},
    ],
  },

  // ═══════════════════════════════════════════════════════
  // NOTIFICATIONS & SETTINGS
  // ═══════════════════════════════════════════════════════

  {
    id: 'notification_channels', name: 'Notification Channel Preferences', category: 'Notifications & Settings', status: 'optional',
    roles: ['student','parent','teacher'], collectAt: ['settings'],
    dataType: 'object', validation: 'email | push | sms | whatsapp | telegram — each boolean',
    purpose: 'Controls which channels are active for reminders, alerts, and reports. Reduces opt-outs by respecting preferences.',
    fallback: 'Email only.',
    impacted: [
      {name:'Mentor',          kind:'agent',    emoji:'🎯', impact:'critical', reason:'Reminder routing depends on enabled channels'},
      {name:'Push Notifier',   kind:'subagent',             impact:'high',     reason:'Activated only if push is enabled'},
      {name:'Herald',          kind:'agent',    emoji:'📣', impact:'medium',   reason:'Campaign delivery channel selection'},
    ],
  },
  {
    id: 'notification_types', name: 'Notification Type Preferences', category: 'Notifications & Settings', status: 'optional',
    roles: ['student','parent','teacher'], collectAt: ['settings'],
    dataType: 'object', validation: 'studyReminders | dailyGoals | weeklyReport | examAlerts | achievements | marketing',
    purpose: 'User-controlled notification opt-ins. Reduces unsubscribes and improves engagement.',
    fallback: 'All notification types enabled.',
    impacted: [
      {name:'Mentor', kind:'agent', emoji:'🎯', impact:'high',   reason:'Only sends reminders for opted-in types'},
      {name:'Herald', kind:'agent', emoji:'📣', impact:'high',   reason:'Marketing emails gated on marketing opt-in'},
    ],
  },
  {
    id: 'quiet_hours', name: 'Quiet Hours', category: 'Notifications & Settings', status: 'optional',
    roles: ['student','parent'], collectAt: ['settings'],
    dataType: 'object', validation: 'HH:MM start and end',
    purpose: 'Suppresses all notifications during sleep/prayer/school hours. Improves user trust.',
    fallback: 'Notifications sent at any time. Risk of late-night disturbances.',
    impacted: [
      {name:'Mentor',        kind:'agent',    emoji:'🎯', impact:'high',   reason:'No reminders sent during quiet window'},
      {name:'Push Notifier', kind:'subagent',             impact:'high',   reason:'Message queued until quiet window ends'},
    ],
  },
  {
    id: 'timezone', name: 'Timezone', category: 'Notifications & Settings', status: 'optional',
    roles: ['student','teacher','parent'], collectAt: ['settings'],
    dataType: 'string', validation: 'IANA timezone string, e.g. Asia/Kolkata',
    purpose: 'All scheduled reminders and exam countdowns rendered in local time.',
    fallback: 'IST (Asia/Kolkata) assumed. Wrong times for international students.',
    example: 'Asia/Kolkata',
    impacted: [
      {name:'Mentor',         kind:'agent', emoji:'🎯', impact:'high',   reason:'Reminder scheduling in local time'},
      {name:'Exam Countdown', kind:'feature',            impact:'medium', reason:'Days and time-to-exam in local time'},
    ],
  },
  {
    id: 'theme', name: 'UI Theme', category: 'Notifications & Settings', status: 'optional',
    roles: ['student','teacher','parent','admin','ceo'], collectAt: ['settings'],
    dataType: 'enum', validation: 'light | dark | system',
    purpose: 'Reduces eye strain for night-time studiers (dark mode). Persists across sessions.',
    fallback: 'System default used.',
    impacted: [
      {name:'Chat UI',     kind:'feature', impact:'medium', reason:'Dark mode toggle in chat interface'},
      {name:'Dashboard',   kind:'feature', impact:'low',    reason:'Theme applied across all pages'},
    ],
  },
  {
    id: 'accessibility', name: 'Accessibility Preferences', category: 'Notifications & Settings', status: 'optional',
    roles: ['student','teacher','parent','admin','ceo'], collectAt: ['settings'],
    dataType: 'object', validation: 'fontSize | highContrast | reduceMotion | dyslexiaFont',
    purpose: 'Makes platform usable for students with visual impairments, dyslexia, or motion sensitivity.',
    fallback: 'Default font size and standard animations.',
    impacted: [
      {name:'Chat UI',   kind:'feature', impact:'high',   reason:'Font size and contrast applied to tutor responses'},
      {name:'Content',   kind:'feature', impact:'medium', reason:'Dyslexia-friendly font for notes and questions'},
    ],
  },
  {
    id: 'privacy_settings', name: 'Privacy Settings', category: 'Notifications & Settings', status: 'optional',
    roles: ['student','parent'], collectAt: ['settings'],
    dataType: 'object', validation: 'profileVisibility | showOnLeaderboard | allowDataForImprovement',
    purpose: 'Student controls visibility and data usage. Required for GDPR/PDPA compliance.',
    fallback: 'Default: visible on leaderboard, data used for improvement.',
    impacted: [
      {name:'Leaderboard', kind:'feature',  impact:'high',   reason:'Student hidden from leaderboard if opted out'},
      {name:'Oracle',      kind:'agent', emoji:'📊', impact:'medium', reason:'Analytics anonymised if data improvement opted out'},
    ],
  },

  // ═══════════════════════════════════════════════════════
  // GAMIFICATION
  // ═══════════════════════════════════════════════════════

  {
    id: 'streak', name: 'Study Streak', category: 'Gamification', status: 'system_generated',
    roles: ['student'], collectAt: ['admin_set'],
    dataType: 'integer', validation: 'Auto-maintained; can be reset or frozen by admin',
    purpose: 'Primary engagement driver. Students protect streaks. Drives daily returns.',
    fallback: 'No streak = lower daily active rate.',
    impacted: [
      {name:'Mentor',      kind:'agent', emoji:'🎯', impact:'critical', reason:'Streak coach is a dedicated sub-agent'},
      {name:'Streak Coach', kind:'subagent',          impact:'critical', reason:'Sends "Protect your streak!" reminders'},
      {name:'Dashboard',   kind:'feature',            impact:'high',     reason:'Streak counter prominently shown'},
      {name:'Oracle',      kind:'agent', emoji:'📊', impact:'medium',   reason:'Streak analytics for retention reporting'},
    ],
  },
  {
    id: 'badges', name: 'Earned Badges', category: 'Gamification', status: 'system_generated',
    roles: ['student'], collectAt: ['admin_set'],
    dataType: 'string[]',
    purpose: 'Recognition system. Badges shared socially drive organic acquisition.',
    fallback: 'No recognition layer. Lower motivation.',
    impacted: [
      {name:'Mentor',    kind:'agent', emoji:'🎯', impact:'high',   reason:'Badge award triggers congratulation message'},
      {name:'Herald',    kind:'agent', emoji:'📣', impact:'medium', reason:'Badge shareable image for social media'},
      {name:'Dashboard', kind:'feature',            impact:'medium', reason:'Badge showcase on student profile'},
    ],
  },

  // ═══════════════════════════════════════════════════════
  // PARENT-SPECIFIC
  // ═══════════════════════════════════════════════════════

  {
    id: 'children_ids', name: 'Linked Children', category: 'Parent Profile', status: 'mandatory',
    roles: ['parent'], collectAt: ['onboarding'],
    dataType: 'string[]',
    purpose: 'Links parent to student accounts. Enables parental monitoring, progress reports, and payment management.',
    fallback: 'Parent account has no purpose without linked children.',
    impacted: [
      {name:'Mentor',           kind:'agent',    emoji:'🎯', impact:'critical', reason:'Progress reports sent to parent'},
      {name:'Progress Reporter', kind:'subagent',            impact:'critical', reason:'Weekly digest to parent email/WhatsApp'},
      {name:'Students page',    kind:'feature',              impact:'high',     reason:'Parent can see child\'s dashboard'},
    ],
  },
  {
    id: 'parent_alert_threshold', name: 'Parent Alert Threshold', category: 'Parent Profile', status: 'optional',
    roles: ['parent'], collectAt: ['settings'],
    dataType: 'integer', validation: '0–100 (score below which parent is alerted)',
    purpose: 'Smart alerts — parents notified only when child scores below their threshold, not every test.',
    fallback: 'All score alerts sent. Parent notification fatigue.',
    impacted: [
      {name:'Progress Reporter', kind:'subagent', impact:'high', reason:'Alert filtering by threshold before sending'},
      {name:'Mentor',            kind:'agent', emoji:'🎯', impact:'medium', reason:'Parent escalation when child underperforms'},
    ],
  },

  // ═══════════════════════════════════════════════════════
  // TEACHER-SPECIFIC
  // ═══════════════════════════════════════════════════════

  {
    id: 'teacher_subjects', name: 'Teaching Subjects', category: 'Teacher Profile', status: 'mandatory',
    roles: ['teacher'], collectAt: ['onboarding'],
    dataType: 'Subject[]',
    purpose: 'Determines which content the teacher can create, review, and assign to students.',
    fallback: 'Teacher sees all subjects but cannot filter to their specialisation.',
    impacted: [
      {name:'Atlas',             kind:'agent',    emoji:'📚', impact:'high',   reason:'Content review queue filtered to teacher\'s subjects'},
      {name:'Content Reviewer',  kind:'subagent',             impact:'high',   reason:'Only assigned content in teacher\'s subjects'},
      {name:'Students page',     kind:'feature',              impact:'medium', reason:'Teacher\'s student list filtered by subject'},
    ],
  },
  {
    id: 'teacher_grades', name: 'Teaching Grades', category: 'Teacher Profile', status: 'mandatory',
    roles: ['teacher'], collectAt: ['onboarding'],
    dataType: 'integer[]',
    purpose: 'Restricts teacher\'s content creation and student assignment to relevant grade levels.',
    fallback: 'Teacher sees all grades.',
    impacted: [
      {name:'Atlas',         kind:'agent',    emoji:'📚', impact:'medium', reason:'Content generation filtered to teacher grades'},
      {name:'Students page', kind:'feature',              impact:'medium', reason:'Student roster filtered by grade'},
    ],
  },
  {
    id: 'institution', name: 'Institution / Coaching Centre', category: 'Teacher Profile', status: 'optional',
    roles: ['teacher','admin'], collectAt: ['profile'],
    dataType: 'string',
    purpose: 'Enables multi-tenant institutional deployments. Coaching centres get white-label features.',
    fallback: 'Individual teacher account only. No institutional grouping.',
    impacted: [
      {name:'Oracle', kind:'agent', emoji:'📊', impact:'medium', reason:'Institutional analytics dashboard'},
      {name:'Scout',  kind:'agent', emoji:'🔍', impact:'low',    reason:'B2B institution tracking for sales'},
    ],
  },

  // ═══════════════════════════════════════════════════════
  // SECURITY & AUTH
  // ═══════════════════════════════════════════════════════

  {
    id: 'mfa', name: 'MFA / 2FA Method', category: 'Security', status: 'optional',
    roles: ['student','teacher','parent','admin','ceo'], collectAt: ['settings'],
    dataType: 'enum', validation: 'totp | sms | email | backup_codes',
    purpose: 'Additional login security. Recommended for admin/teacher; optional for students.',
    fallback: 'Password-only login. Higher account takeover risk.',
    impacted: [
      {name:'Auth Guard',     kind:'subagent', impact:'high',   reason:'MFA challenge on login if enabled'},
      {name:'Session Manager', kind:'subagent', impact:'medium', reason:'Sessions marked as MFA-verified'},
    ],
  },
  {
    id: 'passkey', name: 'Passkey / WebAuthn Credential', category: 'Security', status: 'optional',
    roles: ['student','teacher','parent','admin','ceo'], collectAt: ['settings'],
    dataType: 'credential_id',
    purpose: 'Passwordless login via device biometrics (Face ID, fingerprint). Best UX for mobile-heavy Indian market.',
    fallback: 'Password + OTP login.',
    impacted: [
      {name:'Auth Guard',       kind:'subagent', impact:'high',   reason:'WebAuthn challenge flow on login'},
      {name:'PasskeyManager UI', kind:'feature',                  impact:'high',   reason:'Dedicated passkey management page'},
    ],
  },
  {
    id: 'auth_provider', name: 'Auth Provider', category: 'Security', status: 'mandatory',
    roles: ['student','teacher','parent','admin','ceo'], collectAt: ['signup'],
    dataType: 'enum', validation: 'email | google | microsoft | apple | phone',
    purpose: 'Determines login flow. Google OAuth is primary for Indian students; email/password as fallback.',
    fallback: 'Cannot log in without at least one auth provider.',
    impacted: [
      {name:'Auth Guard',      kind:'subagent', impact:'critical', reason:'Login flow selected by provider'},
      {name:'Session Manager', kind:'subagent', impact:'critical', reason:'Token generation per provider'},
      {name:'Google OAuth',    kind:'feature',                     impact:'high',   reason:'Google Meet integration requires Google provider'},
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IMPACT_COLORS: Record<ImpactLevel, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const STATUS_CONFIG = {
  mandatory:         { cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',         label: '⭐ Mandatory' },
  optional:          { cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',         label: 'Optional' },
  conditional:       { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',  label: '⚠️ Conditional' },
  system_generated:  { cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', label: '🤖 System' },
};

const ROLE_COLORS: Record<UserRole, string> = {
  student: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  teacher: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  parent:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  admin:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  ceo:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const COLLECT_LABELS: Record<CollectWhen, string> = {
  signup:          '📝 Signup',
  onboarding:      '🚀 Onboarding',
  profile:         '👤 Profile',
  payment:         '💳 Payment',
  channel_connect: '📲 Channel Connect',
  settings:        '⚙️ Settings',
  admin_set:       '🔧 Admin-Set',
};

// ─── Attribute Card ───────────────────────────────────────────────────────────

function AttributeCard({ attr }: { attr: UserAttribute }) {
  const [expanded, setExpanded] = useState(false);
  const sc = STATUS_CONFIG[attr.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.optional;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
          attr.status === 'mandatory' ? 'bg-red-500' :
          attr.status === 'conditional' ? 'bg-amber-500' :
          attr.status === 'system_generated' ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
        }`} />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900 dark:text-white text-sm">{attr.name}</span>
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${sc.cls}`}>{sc.label}</span>
            {attr.roles.map(r => (
              <span key={r} className={`px-1.5 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[r]}`}>
                {r}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 mb-1">
            {attr.collectAt.map(c => (
              <span key={c} className="px-1.5 py-0.5 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded text-xs">
                {COLLECT_LABELS[c]}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{attr.purpose}</p>
          {attr.conditionNote && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 italic">{attr.conditionNote}</p>
          )}
        </div>

        <button onClick={() => setExpanded(e => !e)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 shrink-0">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
          {/* Purpose + Fallback */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-1">PURPOSE</p>
              <p className="text-xs text-blue-900 dark:text-blue-200">{attr.purpose}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg p-3">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">FALLBACK / IF MISSING</p>
              <p className="text-xs text-amber-900 dark:text-amber-200">{attr.fallback}</p>
            </div>
          </div>

          {/* Validation + Example */}
          {(attr.validation || attr.example) && (
            <div className="flex gap-3">
              {attr.validation && (
                <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">VALIDATION</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300 font-mono">{attr.validation}</p>
                </div>
              )}
              {attr.example && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">EXAMPLE</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300 font-mono">{attr.example}</p>
                </div>
              )}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">DATA TYPE</p>
                <p className="text-xs text-gray-700 dark:text-gray-300 font-mono">{attr.dataType}</p>
              </div>
            </div>
          )}

          {/* Impacted Agents / Sub-Agents / Features */}
          <div>
            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
              <Bot size={12} /> IMPACTED AGENTS, SUB-AGENTS & FEATURES
            </p>
            <div className="space-y-2">
              {attr.impacted.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${IMPACT_COLORS[item.impact]}`}>
                    {item.impact.toUpperCase()}
                  </span>
                  <div>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {item.emoji ? `${item.emoji} ` : ''}{item.name}
                      <span className="ml-1 text-xs text-gray-400 dark:text-gray-500 font-normal">
                        ({item.kind})
                      </span>
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function UserAttributeRegistry() {
  const { userRole } = useAppStore();

  const [search, setSearch]           = useState('');
  const [catFilter, setCatFilter]     = useState('All');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter]   = useState<'all' | UserRole>('all');

  const categories = useMemo(() => ['All', ...Array.from(new Set(ATTRIBUTES.map(a => a.category)))], []);

  const filtered = useMemo(() => ATTRIBUTES.filter(a => {
    if (catFilter !== 'All' && a.category !== catFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (roleFilter !== 'all' && !a.roles.includes(roleFilter as UserRole)) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.name.toLowerCase().includes(q) ||
             a.category.toLowerCase().includes(q) ||
             a.purpose.toLowerCase().includes(q) ||
             a.id.toLowerCase().includes(q) ||
             a.impacted.some(i => i.name.toLowerCase().includes(q));
    }
    return true;
  }), [catFilter, statusFilter, roleFilter, search]);

  const stats = useMemo(() => ({
    total:       ATTRIBUTES.length,
    mandatory:   ATTRIBUTES.filter(a => a.status === 'mandatory').length,
    conditional: ATTRIBUTES.filter(a => a.status === 'conditional').length,
    optional:    ATTRIBUTES.filter(a => a.status === 'optional').length,
    system:      ATTRIBUTES.filter(a => a.status === 'system_generated').length,
  }), []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Attribute Registry</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Every input and configuration attribute for users — purpose, fallback, and impacted agents/features.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total',       value: stats.total,       color: 'text-gray-700 dark:text-gray-300' },
          { label: 'Mandatory',   value: stats.mandatory,   color: 'text-red-600 dark:text-red-400' },
          { label: 'Conditional', value: stats.conditional, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Optional',    value: stats.optional,    color: 'text-blue-600 dark:text-blue-400' },
          { label: 'System',      value: stats.system,      color: 'text-purple-600 dark:text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search attributes, agents, features..."
            className="pl-8 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-60 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option value="all">All Status</option>
          <option value="mandatory">Mandatory</option>
          <option value="conditional">Conditional</option>
          <option value="optional">Optional</option>
          <option value="system_generated">System</option>
        </select>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option value="all">All Roles</option>
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
          <option value="parent">Parent</option>
          <option value="admin">Admin</option>
          <option value="ceo">CEO</option>
        </select>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} of {ATTRIBUTES.length}</span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Mandatory</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Conditional</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 inline-block" /> Optional</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> System-generated</span>
        <span className="flex items-center gap-1 ml-auto">
          <Info size={12} /> Click any row to see purpose, fallback, and impacted agents
        </span>
      </div>

      {/* Cards grouped by category */}
      {categories.filter(c => c !== 'All').map(cat => {
        const items = filtered.filter(a => a.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat}>
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <User size={14} /> {cat}
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-normal">
                {items.length}
              </span>
            </h2>
            <div className="space-y-2">
              {items.map(a => <AttributeCard key={a.id} attr={a} />)}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-600">No attributes match your filters</div>
      )}
    </div>
  );
}

export default UserAttributeRegistry;
