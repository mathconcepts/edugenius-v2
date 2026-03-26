/**
 * GATECountdown — Days until GATE exam.
 * Exam date stored in localStorage, defaults to Feb 1 2027.
 */

import { useState, useEffect } from 'react';

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

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/25">
      <span className="text-base">📅</span>
      <span className="text-sm font-bold text-purple-400">{daysLeft}</span>
      <span className="text-xs text-surface-400">days to GATE</span>
    </div>
  );
}
