/**
 * DailyBriefCard.tsx — WhatsApp-styled daily learning brief card
 * Shows concept, quick fact, interactive MCQ.
 * Awards XP on correct answer via gamificationService.
 * CEO/Admin: appStore.dailyBriefEnabled
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, ChevronRight, MessageCircle, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '@/stores/appStore';
import { getTodaysBriefV2, recordBriefAnswer, getTodayAnswer } from '@/services/dailyBriefService';
import { awardXP } from '@/services/gamificationService';

export function DailyBriefCard() {
  const { dailyBriefEnabled, gamificationEnabled } = useAppStore();
  const brief = getTodaysBriefV2();
  const existing = getTodayAnswer(brief.id);

  const [selected, setSelected] = useState<number | null>(existing?.selectedIndex ?? null);
  const [revealed, setRevealed] = useState(existing !== null);
  const [xpGained, setXpGained] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(existing !== null);

  if (!dailyBriefEnabled) return null;

  const handleAnswer = (idx: number) => {
    if (revealed) return;
    const correct = idx === brief.question.correctIndex;
    setSelected(idx);
    setRevealed(true);
    recordBriefAnswer(brief.id, idx, correct);

    if (correct && gamificationEnabled) {
      const result = awardXP({ type: 'brief_answered' });
      setXpGained(result.earned);
    }
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-green-900/30 border border-green-700/40 rounded-xl text-left hover:bg-green-900/40 transition-all"
      >
        <MessageCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-green-300">Today's Brief: {brief.concept}</p>
          <p className="text-xs text-green-500/70">
            {existing?.correct ? '✅ Answered correctly' : '❌ Answered incorrectly'} — tap to review
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-green-500" />
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-green-700/40 bg-gradient-to-br from-green-900/40 via-surface-800/60 to-surface-800/80 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-green-800/40 border-b border-green-700/30">
        <MessageCircle className="w-4 h-4 text-green-400" />
        <span className="text-xs font-semibold text-green-300 uppercase tracking-wider">Daily Brief</span>
        <span className="ml-auto text-xs text-green-500/70 bg-green-900/40 px-2 py-0.5 rounded-full">
          {brief.examTag}
        </span>
        {existing !== null && (
          <button onClick={() => setCollapsed(true)} className="text-xs text-green-500 hover:text-green-300 ml-2">
            Collapse
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Concept */}
        <div>
          <h3 className="font-bold text-white text-base">{brief.concept}</h3>
          <p className="text-sm text-surface-300 mt-1 leading-relaxed">{brief.summary}</p>
        </div>

        {/* Quick fact bubble */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2">
          <p className="text-sm text-yellow-200">{brief.quickFact}</p>
        </div>

        {/* Question */}
        <div>
          <p className="text-sm font-semibold text-white mb-2">📝 Quick Question</p>
          <p className="text-sm text-surface-200 mb-3">{brief.question.text}</p>

          <div className="space-y-2">
            {brief.question.options.map((opt, i) => {
              const isCorrect = i === brief.question.correctIndex;
              const isSelected = i === selected;
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={revealed}
                  className={clsx(
                    'w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all',
                    !revealed && 'hover:bg-surface-600 border-surface-600 text-surface-200',
                    revealed && isCorrect && 'bg-green-500/20 border-green-500 text-green-200',
                    revealed && isSelected && !isCorrect && 'bg-red-500/20 border-red-500 text-red-200',
                    revealed && !isSelected && !isCorrect && 'border-surface-700 text-surface-500 opacity-60'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-surface-700 text-xs flex items-center justify-center font-bold flex-shrink-0">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                    {revealed && isCorrect && <CheckCircle className="w-4 h-4 ml-auto text-green-400" />}
                    {revealed && isSelected && !isCorrect && <XCircle className="w-4 h-4 ml-auto text-red-400" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Explanation */}
        <AnimatePresence>
          {revealed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-surface-700/60 rounded-xl p-3 space-y-2"
            >
              <p className="text-sm font-semibold text-white">💡 Explanation</p>
              <p className="text-sm text-surface-300">{brief.question.explanation}</p>
              <p className="text-sm text-cyan-300 border-t border-surface-600 pt-2">{brief.tip}</p>

              {xpGained && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-1.5 text-yellow-400 text-sm font-bold"
                >
                  <Zap className="w-4 h-4" />
                  +{xpGained} XP earned!
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
