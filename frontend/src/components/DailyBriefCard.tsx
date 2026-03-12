/**
 * DailyBriefCard — WhatsApp-styled concept-of-the-day card
 * - Dark green WhatsApp-like styling
 * - Interactive MCQ with XP reward
 * - Countdown to next brief
 * - "Enable WhatsApp delivery" CTA
 */
import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, MessageCircle, Clock, Zap } from 'lucide-react';
import { getTodaysBrief, markBriefAnswered, isBriefAnsweredToday } from '@/services/dailyBriefService';
import { awardXP } from '@/services/gamificationService';
import { useAppStore } from '@/stores/appStore';

interface DailyBriefCardProps {
  className?: string;
  compact?: boolean;
}

function MsToNextBrief(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const ms = midnight.getTime() - now.getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export function DailyBriefCard({ className = '', compact = false }: DailyBriefCardProps) {
  const dailyBriefEnabled = useAppStore(s => s.dailyBriefEnabled);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [showWAModal, setShowWAModal] = useState(false);
  const [timeToNext, setTimeToNext] = useState(MsToNextBrief());

  const brief = getTodaysBrief();
  const alreadyAnswered = isBriefAnsweredToday();

  useEffect(() => {
    const interval = setInterval(() => setTimeToNext(MsToNextBrief()), 60000);
    return () => clearInterval(interval);
  }, []);

  if (!dailyBriefEnabled) return null;

  const handleAnswer = (idx: number) => {
    if (revealed || alreadyAnswered) return;
    setSelected(idx);
    setRevealed(true);
    const correct = idx === brief.todayQuestion.answer;
    markBriefAnswered(brief.id, correct);
    if (correct) {
      const result = awardXP({ type: 'daily_goal', xp: 50, description: 'Daily Brief correct answer' });
      setXpEarned(result.earnedXP);
    }
  };

  const isCorrect = revealed && selected === brief.todayQuestion.answer;

  if (compact) {
    return (
      <div
        className={`rounded-xl bg-[#1a2a1e] border border-[#2d5a3a] p-3 cursor-pointer hover:border-[#4a8a5a] transition-colors ${className}`}
        onClick={() => window.location.href = '/daily-brief'}
      >
        <div className="flex items-center gap-2">
          <span className="text-green-400">📱</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-green-300 truncate">{brief.concept}</div>
            <div className="text-xs text-surface-400">{brief.subject} · Today's Brief</div>
          </div>
          {alreadyAnswered ? (
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
          ) : (
            <span className="text-xs bg-green-700 text-green-100 px-2 py-0.5 rounded-full flex-shrink-0">+50 XP</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl bg-[#0d1f14] border border-[#2d5a3a] overflow-hidden ${className}`}>
      {/* WhatsApp-style header */}
      <div className="bg-[#1a3a24] px-4 py-3 flex items-center gap-3 border-b border-[#2d5a3a]">
        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-bold">
          EG
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-green-300">EduGenius Daily Brief</div>
          <div className="text-xs text-green-600">AI-powered · {brief.subject}</div>
        </div>
        <div className="flex items-center gap-1 text-xs text-green-600">
          <Clock className="w-3 h-3" />
          <span>Next in {timeToNext}</span>
        </div>
      </div>

      {/* Message bubble */}
      <div className="p-4 space-y-4">
        {/* Concept */}
        <div className="rounded-xl bg-[#1a2a1e] border border-[#2d5a3a] p-4 space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-2xl">🧠</span>
            <div>
              <div className="text-xs text-green-500 font-medium uppercase tracking-wide mb-1">Today's Concept</div>
              <div className="text-white font-bold text-base">{brief.concept}</div>
            </div>
          </div>
          <p className="text-surface-300 text-sm leading-relaxed">{brief.summary}</p>
          <div className="bg-[#0d1f14] rounded-lg px-3 py-2 text-sm text-green-300 font-medium border-l-2 border-green-500">
            {brief.quickFact}
          </div>
        </div>

        {/* Streak + countdown */}
        {(brief.streakNote || brief.examCountdown) && (
          <div className="flex items-center justify-between text-xs">
            {brief.streakNote && <span className="text-orange-400">{brief.streakNote}</span>}
            {brief.examCountdown && (
              <span className="text-surface-400">📅 {brief.examCountdown} days to exam</span>
            )}
          </div>
        )}

        {/* MCQ Question */}
        <div className="space-y-2">
          <div className="text-xs text-green-500 font-medium uppercase tracking-wide flex items-center gap-1.5">
            <Zap className="w-3 h-3" />
            {alreadyAnswered ? 'Already answered today' : 'Answer to earn 50 XP'}
          </div>
          <p className="text-white text-sm font-medium">{brief.todayQuestion.text}</p>

          <div className="space-y-2">
            {brief.todayQuestion.options.map((opt, idx) => {
              let btnClass = 'w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all border ';
              if (!revealed && !alreadyAnswered) {
                btnClass += 'border-[#2d5a3a] bg-[#1a2a1e] text-surface-200 hover:border-green-500 hover:bg-[#1f3228] cursor-pointer';
              } else if (idx === brief.todayQuestion.answer) {
                btnClass += 'border-green-500 bg-green-950 text-green-300';
              } else if (idx === selected && idx !== brief.todayQuestion.answer) {
                btnClass += 'border-red-500 bg-red-950 text-red-300';
              } else {
                btnClass += 'border-[#2d5a3a] bg-[#0d1f14] text-surface-500';
              }

              return (
                <button
                  key={idx}
                  className={btnClass}
                  onClick={() => handleAnswer(idx)}
                  disabled={revealed || alreadyAnswered}
                >
                  <span className="font-medium mr-2">{String.fromCharCode(65 + idx)}.</span>
                  {opt}
                  {revealed && idx === brief.todayQuestion.answer && (
                    <CheckCircle className="w-4 h-4 text-green-400 float-right mt-0.5" />
                  )}
                  {revealed && idx === selected && idx !== brief.todayQuestion.answer && (
                    <XCircle className="w-4 h-4 text-red-400 float-right mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {(revealed || alreadyAnswered) && (
            <div className="rounded-xl bg-[#1a2a1e] border border-[#2d5a3a] p-3 space-y-1">
              <div className="flex items-center gap-2">
                {isCorrect ? (
                  <span className="text-green-400 font-semibold text-sm">✅ Correct! +{xpEarned || 50} XP</span>
                ) : (
                  <span className="text-red-400 font-semibold text-sm">❌ Not quite</span>
                )}
              </div>
              <p className="text-surface-300 text-xs">{brief.todayQuestion.explanation}</p>
            </div>
          )}
        </div>

        {/* Tip */}
        <div className="bg-[#1a2a1e] rounded-xl px-3 py-2 text-xs text-surface-300 border-l-2 border-yellow-600">
          {brief.tip}
        </div>

        {/* CTA row */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => window.location.href = '/daily-brief'}
            className="flex-1 text-xs text-green-400 hover:text-green-300 bg-[#1a2a1e] hover:bg-[#1f3228] border border-[#2d5a3a] rounded-xl py-2 transition-colors"
          >
            View history
          </button>
          <button
            onClick={() => setShowWAModal(true)}
            className="flex items-center gap-1.5 text-xs text-green-300 bg-green-900/40 hover:bg-green-900/60 border border-green-700 rounded-xl px-3 py-2 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp delivery
          </button>
        </div>
      </div>

      {/* WhatsApp modal */}
      {showWAModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4">
          <div className="bg-surface-900 rounded-2xl w-full max-w-md p-6 space-y-4 border border-surface-700">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-400" />
              WhatsApp Daily Brief
            </h3>
            <p className="text-surface-400 text-sm">
              Get your daily brief delivered directly to WhatsApp every morning at 7 AM. 
              This feature is coming soon! You'll be able to answer questions right in WhatsApp 
              and earn XP on the go.
            </p>
            <div className="bg-surface-800 rounded-xl p-3 text-xs text-surface-400">
              📱 For now, your briefs are available in-app. We'll notify you when WhatsApp delivery goes live!
            </div>
            <button
              onClick={() => setShowWAModal(false)}
              className="w-full bg-green-700 hover:bg-green-600 text-white py-2.5 rounded-xl font-medium transition-colors"
            >
              Got it — notify me when ready
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
