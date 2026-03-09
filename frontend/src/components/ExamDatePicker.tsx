/**
 * ExamDatePicker.tsx — Exam Date Setting UI
 *
 * Lets students (and CEO) set or override the exam date for any exam.
 * Shows system default clearly, with a "Set my date" override option.
 *
 * Usage:
 *   <ExamDatePicker examId="gate-em" onDateChange={(d) => console.log(d)} />
 *   <ExamDatePicker examId="jee-main" compact />          // inline card mode
 *   <ExamDatePicker examId="cat" showCountdown />         // with countdown ring
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, CheckCircle, RotateCcw, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import {
  getExamDate,
  setExamDate,
  getDaysToExam,
  getExamDateFormatted,
  getUrgencyLevel,
  getSystemDefaultDate,
  getSystemDefaultLabel,
} from '@/services/examDateService';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ExamDatePickerProps {
  examId: string;
  examName: string;
  compact?: boolean;         // minimal inline mode
  showCountdown?: boolean;   // show animated countdown ring
  onDateChange?: (date: Date, source: 'user' | 'system_default') => void;
  className?: string;
}

// ── Urgency styles ────────────────────────────────────────────────────────────

function urgencyStyle(level: ReturnType<typeof getUrgencyLevel>) {
  switch (level) {
    case 'critical': return { ring: 'from-red-500 to-orange-500',     badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',     label: '🚨 CRITICAL' };
    case 'high':     return { ring: 'from-amber-500 to-orange-400',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', label: '⚠️ Soon' };
    case 'medium':   return { ring: 'from-violet-500 to-purple-500',  badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300', label: '📅 Upcoming' };
    case 'low':      return { ring: 'from-emerald-500 to-teal-400',   badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', label: '✅ Plenty of time' };
  }
}

// ── Countdown ring (SVG) ──────────────────────────────────────────────────────

function CountdownRing({ days, urgency }: { days: number; urgency: ReturnType<typeof getUrgencyLevel> }) {
  // Ring fills as exam approaches: 365 days = empty, 0 days = full
  const maxDays = 365;
  const fillPct = Math.max(0, Math.min(1, 1 - days / maxDays));
  const r = 40;
  const circumference = 2 * Math.PI * r;
  const strokeDash = fillPct * circumference;

  const { ring } = urgencyStyle(urgency);
  const strokeColor = urgency === 'critical' ? '#ef4444' :
                      urgency === 'high'     ? '#f59e0b' :
                      urgency === 'medium'   ? '#8b5cf6' : '#10b981';

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
        {/* Track */}
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8"
          className="text-slate-100 dark:text-slate-800" />
        {/* Fill */}
        <motion.circle
          cx="50" cy="50" r={r} fill="none"
          stroke={strokeColor} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${strokeDash} ${circumference}`}
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${strokeDash} ${circumference}` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="text-center z-10">
        <div className={clsx('text-2xl font-bold', urgency === 'critical' ? 'text-red-500' : urgency === 'high' ? 'text-amber-500' : 'text-slate-900 dark:text-slate-100')}>
          {days}
        </div>
        <div className="text-xs text-slate-400">days</div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ExamDatePicker({ examId, examName, compact = false, showCountdown = false, onDateChange, className }: ExamDatePickerProps) {
  const [resolved, setResolved] = useState(() => getExamDate(examId));
  const [days, setDays] = useState(() => getDaysToExam(examId));
  const [urgency, setUrgency] = useState(() => getUrgencyLevel(examId));
  const [editing, setEditing] = useState(false);
  const [dateInput, setDateInput] = useState('');
  const [saved, setSaved] = useState(false);

  // Refresh on mount + when examId changes
  useEffect(() => {
    const r = getExamDate(examId);
    setResolved(r);
    setDays(getDaysToExam(examId));
    setUrgency(getUrgencyLevel(examId));
    // Pre-fill input with current date
    const d = r.date;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setDateInput(`${yyyy}-${mm}-${dd}`);
  }, [examId]);

  const handleSave = () => {
    if (!dateInput) return;
    const parsed = new Date(dateInput + 'T08:00:00');
    if (isNaN(parsed.getTime())) return;
    setExamDate(examId, parsed);
    const r = getExamDate(examId);
    setResolved(r);
    setDays(getDaysToExam(examId));
    setUrgency(getUrgencyLevel(examId));
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    onDateChange?.(parsed, 'user');
  };

  const handleReset = () => {
    setExamDate(examId, null); // clear user date → fall back to system default
    const r = getExamDate(examId);
    setResolved(r);
    setDays(getDaysToExam(examId));
    setUrgency(getUrgencyLevel(examId));
    setEditing(false);
    onDateChange?.(r.date, 'system_default');
  };

  const { badge } = urgencyStyle(urgency);
  const systemDefault = getSystemDefaultDate(examId);
  const systemDefaultLabel = getSystemDefaultLabel(examId);

  // ── Compact mode (inline badge) ───────────────────────────────────────────

  if (compact) {
    return (
      <div className={clsx('flex items-center gap-2', className)}>
        <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="text-sm text-slate-700 dark:text-slate-300">{getExamDateFormatted(examId)}</span>
        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', badge)}>{days}d</span>
        {resolved.source === 'user' && (
          <button onClick={() => setEditing(v => !v)} className="text-xs text-violet-600 dark:text-violet-400 hover:underline">
            Change
          </button>
        )}
        {!editing && resolved.source !== 'user' && (
          <button onClick={() => setEditing(v => !v)} className="text-xs text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:underline">
            Set date
          </button>
        )}
        <AnimatePresence>
          {editing && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="flex items-center gap-1 overflow-hidden"
            >
              <input
                type="date"
                value={dateInput}
                onChange={e => setDateInput(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="text-xs border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
              <button onClick={handleSave} className="text-xs bg-violet-600 text-white px-2 py-1 rounded hover:bg-violet-700">Save</button>
              <button onClick={() => setEditing(false)} className="text-xs text-slate-400 px-1">✕</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Full card mode ────────────────────────────────────────────────────────

  return (
    <div className={clsx(
      'bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden',
      urgency === 'critical' ? 'border-red-200 dark:border-red-800' :
      urgency === 'high' ? 'border-amber-200 dark:border-amber-800' :
      'border-slate-200 dark:border-slate-700',
      className,
    )}>
      {/* Urgency stripe */}
      <div className={clsx('h-1 bg-gradient-to-r', urgencyStyle(urgency).ring)} />

      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">{examName}</h3>
              <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', badge)}>
                {urgencyStyle(urgency).label}
              </span>
            </div>

            {/* Source tag */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              {resolved.source === 'user' ? (
                <><CheckCircle className="w-3.5 h-3.5 text-green-500" /> Set by you</>
              ) : resolved.source === 'system_default' ? (
                <><Zap className="w-3.5 h-3.5 text-blue-500" /> System default · {resolved.label}</>
              ) : (
                <><Clock className="w-3.5 h-3.5 text-slate-400" /> Estimated (set your actual date below)</>
              )}
            </div>
          </div>

          {/* Countdown ring */}
          {showCountdown && (
            <CountdownRing days={Math.max(0, days)} urgency={urgency} />
          )}
        </div>

        {/* Date display */}
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3 flex items-center gap-3">
          <Calendar className="w-5 h-5 text-violet-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{getExamDateFormatted(examId)}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {days > 0 ? `${days} day${days === 1 ? '' : 's'} to go` : days === 0 ? '🎯 Exam is today!' : 'Exam passed'}
            </p>
          </div>
        </div>

        {/* Edit controls */}
        <div className="space-y-3">
          <button
            onClick={() => setEditing(v => !v)}
            className="flex items-center gap-1.5 text-sm text-violet-600 dark:text-violet-400 hover:underline"
          >
            {editing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {editing ? 'Cancel' : 'Change my exam date'}
          </button>

          <AnimatePresence>
            {editing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-1">
                  {/* Date input */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                      Your exam date
                    </label>
                    <input
                      type="date"
                      value={dateInput}
                      onChange={e => setDateInput(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      max={new Date(new Date().getFullYear() + 2, 11, 31).toISOString().split('T')[0]}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>

                  {/* System default reference */}
                  {systemDefault && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      System default: {systemDefaultLabel}
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSave}
                      disabled={!dateInput}
                      className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Save date
                    </button>
                    {resolved.source === 'user' && (
                      <button
                        onClick={handleReset}
                        className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Use system default
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Saved confirmation */}
        <AnimatePresence>
          {saved && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
            >
              <CheckCircle className="w-4 h-4" />
              Exam date saved! Countdown updated.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ExamDatePicker;
