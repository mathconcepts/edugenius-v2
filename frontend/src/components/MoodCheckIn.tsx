/**
 * MoodCheckIn.tsx — Student mood check-in widget + adaptive session plan
 * CEO/Admin: appStore.moodCheckInEnabled
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useAppStore } from '@/stores/appStore';
import {
  MOOD_OPTIONS, getTodayMood, recordMood, getSessionPlan, getMoodInsight,
  type Mood,
} from '@/services/moodCheckInService';

export function MoodCheckIn() {
  const { moodCheckInEnabled } = useAppStore();
  const existing = getTodayMood();
  const [selected, setSelected] = useState<Mood | null>(existing?.mood ?? null);
  const [confirmed, setConfirmed] = useState(existing !== null);
  const [dismissed, setDismissed] = useState(false);

  if (!moodCheckInEnabled || dismissed) return null;

  const insight = getMoodInsight();

  const handleSelect = (mood: Mood) => {
    setSelected(mood);
    recordMood(mood);
    setConfirmed(true);

    // Emit to Mentor agent via signal bus
    const plan = getSessionPlan(mood);
    import('@/services/signalBus').then(({ emitMoodSignal }) => {
      emitMoodSignal({
        studentId: 'student_local',
        examId: localStorage.getItem('eg_active_exam') ?? 'gate',
        mood,
        sessionPlanDuration: plan.durationMinutes,
        streakProtected: plan.streakProtected,
      }).catch(() => {});
    }).catch(() => {});
  };

  if (confirmed && selected) {
    const plan = getSessionPlan(selected);
    const moodOption = MOOD_OPTIONS.find(m => m.mood === selected)!;

    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-surface-700 bg-surface-800/60 p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{moodOption.emoji}</span>
              <p className="text-sm font-semibold text-white">{plan.message}</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-surface-400 flex-wrap">
              <span>⏱️ {plan.durationMinutes} min session</span>
              <span className={clsx(
                'px-2 py-0.5 rounded-full font-medium',
                plan.difficulty === 'easy' ? 'bg-green-900/40 text-green-300' :
                plan.difficulty === 'medium' ? 'bg-yellow-900/40 text-yellow-300' :
                'bg-red-900/40 text-red-300'
              )}>{plan.difficulty}</span>
              {plan.streakProtected && <span className="text-orange-400">🛡️ Streak protected</span>}
            </div>
            {insight && (
              <p className="text-xs text-amber-300 mt-2 border-t border-surface-700 pt-2">{insight}</p>
            )}
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-surface-500 hover:text-surface-300 text-sm flex-shrink-0"
          >
            ✕
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-primary-500/30 bg-primary-900/10 p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-white">How are you feeling today?</p>
        <button onClick={() => setDismissed(true)} className="text-surface-500 hover:text-surface-300 text-sm">✕</button>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {MOOD_OPTIONS.map(({ mood, emoji, label }) => (
          <button
            key={mood}
            onClick={() => handleSelect(mood)}
            className={clsx(
              'flex flex-col items-center gap-1 py-3 rounded-xl border text-center transition-all',
              selected === mood
                ? 'bg-primary-600/30 border-primary-500 text-primary-200'
                : 'bg-surface-800 border-surface-700 text-surface-300 hover:bg-surface-700 hover:border-surface-500'
            )}
          >
            <span className="text-2xl">{emoji}</span>
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-surface-500 mt-2 text-center">
        Sage adapts your session based on how you feel
      </p>
    </motion.div>
  );
}
