/**
 * GATECountdown — Animated days-until-GATE with urgency color shift.
 * Green (>180 days), amber (90-180), red (<90).
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

const GATE_DATE_KEY = 'gate_exam_date';
const DEFAULT_GATE_DATE = '2027-02-01';

function getExamDate(): string {
  return localStorage.getItem(GATE_DATE_KEY) || DEFAULT_GATE_DATE;
}

export function GATECountdown() {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    const examDate = new Date(getExamDate());
    const now = new Date();
    const diff = Math.ceil((examDate.getTime() - now.getTime()) / 86400000);
    setDaysLeft(diff > 0 ? diff : 0);
  }, []);

  if (daysLeft === null || daysLeft === 0) return null;

  // Urgency colors
  let colorClasses = 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400';
  if (daysLeft < 90) {
    colorClasses = 'bg-red-500/10 border-red-500/25 text-red-400';
  } else if (daysLeft < 180) {
    colorClasses = 'bg-amber-500/10 border-amber-500/25 text-amber-400';
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
        className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-full border', colorClasses)}
      >
        <motion.span
          className="text-base"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          📅
        </motion.span>
        <span className="text-sm font-bold">{daysLeft}</span>
        <span className="text-xs text-surface-400">days to GATE</span>
      </motion.div>
    </AnimatePresence>
  );
}
