/**
 * SpacedRepetitionWidget.tsx — Dashboard widget for spaced repetition
 * Shows due cards, forgetting curve, flash card modal.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, RotateCcw, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '@/stores/appStore';
import {
  getDueCards, getAllCards, sm2Update, saveCard, ensureSampleCards, getStats,
  type SRCard, type ReviewQuality,
} from '@/services/spacedRepetitionEngine';
import { awardXP } from '@/services/gamificationService';

// ─── Flash Card Modal ─────────────────────────────────────────────────────────

function FlashCardModal({ onClose }: { onClose: () => void }) {
  const { gamificationEnabled } = useAppStore();
  const [cards, setCards] = useState<SRCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  useEffect(() => {
    ensureSampleCards();
    setCards(getDueCards().slice(0, 10)); // max 10 per session
  }, []);

  const card = cards[idx];

  const handleRate = (quality: ReviewQuality) => {
    if (!card) return;
    const updated = sm2Update(card, quality);
    saveCard(updated);

    if (quality >= 3 && gamificationEnabled) {
      awardXP({ type: 'sr_review' });
    }

    setReviewed(r => r + 1);
    const next = idx + 1;
    if (next >= cards.length) {
      setDone(true);
    } else {
      setIdx(next);
      setFlipped(false);
    }
  };

  if (!card || done) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="text-4xl">✅</div>
        <p className="text-white font-bold">Session complete!</p>
        <p className="text-surface-400 text-sm">Reviewed {reviewed} card{reviewed !== 1 ? 's' : ''}.</p>
        <button onClick={onClose} className="px-6 py-2 bg-primary-600 text-white rounded-xl font-semibold">Done</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-2 text-xs text-surface-400">
        <span>{idx + 1} / {cards.length}</span>
        <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
          <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${((idx) / cards.length) * 100}%` }} />
        </div>
        <span className="text-surface-500">{card.subject}</span>
      </div>

      {/* Card */}
      <div
        onClick={() => setFlipped(true)}
        className={clsx(
          'min-h-[180px] rounded-2xl border p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all',
          flipped ? 'bg-primary-900/30 border-primary-600/50' : 'bg-surface-800 border-surface-600 hover:border-surface-500'
        )}
      >
        {!flipped ? (
          <div className="space-y-3">
            <p className="text-xs text-surface-400 uppercase tracking-wider">{card.topic}</p>
            <p className="text-white font-bold text-lg">{card.topic}</p>
            <p className="text-surface-400 text-sm">Tap to reveal the concept</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-white font-medium leading-relaxed">{card.concept}</p>
            {card.hint && (
              <p className="text-primary-300 text-sm italic">💡 {card.hint}</p>
            )}
          </div>
        )}
      </div>

      {/* Rating buttons */}
      <AnimatePresence>
        {flipped && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-2"
          >
            {[
              { label: 'Hard', quality: 2 as ReviewQuality, color: 'bg-red-700 hover:bg-red-600', icon: <XCircle className="w-4 h-4" /> },
              { label: 'Good', quality: 4 as ReviewQuality, color: 'bg-yellow-700 hover:bg-yellow-600', icon: <RotateCcw className="w-4 h-4" /> },
              { label: 'Easy', quality: 5 as ReviewQuality, color: 'bg-green-700 hover:bg-green-600', icon: <CheckCircle className="w-4 h-4" /> },
            ].map(btn => (
              <button
                key={btn.label}
                onClick={() => handleRate(btn.quality)}
                className={clsx('flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all', btn.color)}
              >
                {btn.icon} {btn.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export function SpacedRepetitionWidget() {
  const { spacedRepetitionEnabled } = useAppStore();
  const [showModal, setShowModal] = useState(false);

  // Emit SR overdue signal to Mentor once per day when 3+ cards are due
  useEffect(() => {
    if (!spacedRepetitionEnabled) return;
    const dueCards = getDueCards();
    if (dueCards.length >= 3) {
      const today = new Date().toDateString();
      const lastEmitted = localStorage.getItem('eg_sr_overdue_emitted');
      if (lastEmitted !== today) {
        localStorage.setItem('eg_sr_overdue_emitted', today);
        import('@/services/signalBus').then(({ emitSROverdue }) => {
          emitSROverdue({
            studentId: 'student_local',
            overdueTopics: dueCards.slice(0, 5).map(c => c.topic),
            examId: localStorage.getItem('eg_active_exam') ?? 'gate',
            daysOverdue: 1,
          }).catch(() => {});
        }).catch(() => {});
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!spacedRepetitionEnabled) return null;

  ensureSampleCards();
  const stats = getStats();
  const urgency = stats.due > 5 ? 'high' : stats.due > 0 ? 'medium' : 'none';

  return (
    <>
      <div className={clsx(
        'rounded-xl border p-4 transition-all cursor-pointer hover:border-opacity-80',
        urgency === 'high' ? 'bg-red-900/20 border-red-700/50' :
        urgency === 'medium' ? 'bg-amber-900/20 border-amber-700/50' :
        'bg-surface-800 border-surface-700/50'
      )} onClick={() => stats.due > 0 && setShowModal(true)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className={clsx('w-4 h-4',
              urgency === 'high' ? 'text-red-400' :
              urgency === 'medium' ? 'text-amber-400' : 'text-surface-400'
            )} />
            <span className="text-sm font-semibold text-white">Spaced Repetition</span>
          </div>
          {stats.due > 0 && (
            <span className={clsx(
              'text-xs font-bold px-2 py-0.5 rounded-full',
              urgency === 'high' ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
            )}>
              {stats.due} due
            </span>
          )}
        </div>

        {/* Forgetting curve mini sparkline */}
        <div className="flex gap-1 items-end h-8 mb-3">
          {[100, 82, 68, 55, 45, 36, 28].map((v, i) => (
            <div
              key={i}
              className={clsx('flex-1 rounded-t transition-all',
                i === 0 ? 'bg-green-500' : i < 3 ? 'bg-yellow-500' : 'bg-red-500'
              )}
              style={{ height: `${v}%` }}
            />
          ))}
        </div>
        <p className="text-xs text-surface-500 text-center mb-3">Memory decay curve — review prevents forgetting</p>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div><div className="font-bold text-white">{stats.total}</div><div className="text-surface-400">Cards</div></div>
          <div><div className="font-bold text-green-400">{stats.mastered}</div><div className="text-surface-400">Mastered</div></div>
          <div><div className="font-bold text-blue-400">{stats.avgRetention}%</div><div className="text-surface-400">Retention</div></div>
        </div>

        {stats.due > 0 && (
          <button className="w-full mt-3 py-2 bg-primary-600 hover:bg-primary-500 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-all">
            Start Review <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {stats.due === 0 && (
          <p className="text-center text-xs text-green-400 mt-3">✅ All caught up for today!</p>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-surface-800 rounded-2xl border border-surface-700 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary-400" /> Flash Card Review
                </h3>
                <button onClick={() => setShowModal(false)} className="text-surface-400 hover:text-white text-lg">✕</button>
              </div>
              <FlashCardModal onClose={() => setShowModal(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
