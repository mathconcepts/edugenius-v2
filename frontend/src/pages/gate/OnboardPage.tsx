/**
 * OnboardPage — 4-step wizard for Study Commander onboarding.
 * Steps: Exam Date → Target Score → Weekly Hours → Topic Confidence
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/hooks/useApi';
import { useSession } from '@/hooks/useSession';
import { trackEvent } from '@/lib/analytics';
import { Calendar, Target, Clock, Brain, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { clsx } from 'clsx';

const TOPICS = [
  { id: 'linear-algebra', name: 'Linear Algebra' },
  { id: 'calculus', name: 'Calculus' },
  { id: 'probability-statistics', name: 'Probability & Statistics' },
  { id: 'differential-equations', name: 'Differential Equations' },
  { id: 'complex-variables', name: 'Complex Variables' },
  { id: 'transform-theory', name: 'Transform Theory' },
  { id: 'numerical-methods', name: 'Numerical Methods' },
  { id: 'discrete-mathematics', name: 'Discrete Mathematics' },
  { id: 'graph-theory', name: 'Graph Theory' },
  { id: 'vector-calculus', name: 'Vector Calculus' },
];

const BUCKETS = [
  { key: 'weak', label: 'Weak', value: 1, border: 'border-red-500/30', bg: 'bg-red-500/5', chip: 'bg-red-500/15 text-red-400 border-red-500/30' },
  { key: 'okay', label: 'Okay', value: 3, border: 'border-amber-500/30', bg: 'bg-amber-500/5', chip: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { key: 'strong', label: 'Strong', value: 5, border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', chip: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
] as const;

const STEPS = [
  { icon: Calendar, label: 'Exam Date' },
  { icon: Target, label: 'Target Score' },
  { icon: Clock, label: 'Weekly Hours' },
  { icon: Brain, label: 'Confidence' },
];

export default function OnboardPage() {
  const sessionId = useSession();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [examDate, setExamDate] = useState('');
  const [targetScore, setTargetScore] = useState<number>(60);
  const [weeklyHours, setWeeklyHours] = useState<number>(10);
  const [confidence, setConfidence] = useState<Record<string, number>>(
    Object.fromEntries(TOPICS.map(t => [t.id, 3]))
  );

  const canAdvance = () => {
    if (step === 0) return examDate !== '';
    return true;
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      await apiFetch('/api/onboard', {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          exam_date: examDate,
          target_score: targetScore,
          weekly_hours: weeklyHours,
          topic_confidence: confidence,
        }),
      });
      trackEvent('onboard_complete', { weekly_hours: weeklyHours });
      navigate('/diagnostic');
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 py-4">
        {STEPS.map((s, i) => (
          <div
            key={i}
            className={clsx(
              'w-2.5 h-2.5 rounded-full transition-all duration-300',
              i === step ? 'bg-emerald-500 scale-125' : i < step ? 'bg-emerald-500/50' : 'bg-surface-700'
            )}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            {step === 0 && (
              <div className="space-y-6 px-1">
                <div className="text-center space-y-2">
                  <Calendar size={32} className="text-emerald-400 mx-auto" />
                  <h2 className="text-xl font-bold text-surface-100">When is your GATE exam?</h2>
                  <p className="text-sm text-surface-400">We'll pace your study plan accordingly</p>
                </div>
                <input
                  type="date"
                  value={examDate}
                  onChange={e => setExamDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full px-4 py-3 rounded-xl bg-surface-900 border border-surface-700 text-surface-100 focus:border-emerald-500 focus:outline-none text-center text-lg font-mono"
                />
                {examDate && (() => {
                  const days = Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000);
                  return (
                    <p className={clsx(
                      'text-center text-sm font-medium',
                      days < 60 ? 'text-amber-400' : 'text-emerald-400'
                    )}>
                      {days} days from now
                      {days < 60 && ' — every day counts!'}
                    </p>
                  );
                })()}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6 px-1">
                <div className="text-center space-y-2">
                  <Target size={32} className="text-emerald-400 mx-auto" />
                  <h2 className="text-xl font-bold text-surface-100">Target score in Engineering Math?</h2>
                  <p className="text-sm text-surface-400">Out of 100 marks (13 marks in GATE)</p>
                </div>
                <div className="text-center">
                  <span className="text-5xl font-bold text-emerald-400 font-mono">{targetScore}</span>
                  <span className="text-xl text-surface-500 ml-1">/100</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={100}
                  step={5}
                  value={targetScore}
                  onChange={e => setTargetScore(parseInt(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-surface-500">
                  <span>20 (pass)</span>
                  <span>60 (good)</span>
                  <span>100 (max)</span>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 px-1">
                <div className="text-center space-y-2">
                  <Clock size={32} className="text-emerald-400 mx-auto" />
                  <h2 className="text-xl font-bold text-surface-100">Hours per week for math?</h2>
                  <p className="text-sm text-surface-400">Be realistic — we'll plan around this</p>
                </div>
                <div className="text-center">
                  <span className="text-5xl font-bold text-emerald-400 font-mono">{weeklyHours}</span>
                  <span className="text-xl text-surface-500 ml-1">hrs/week</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={40}
                  step={1}
                  value={weeklyHours}
                  onChange={e => setWeeklyHours(parseInt(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-surface-500">
                  <span>3 hrs</span>
                  <span>~{Math.round(weeklyHours / 7 * 60)} min/day</span>
                  <span>40 hrs</span>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 px-1">
                <div className="text-center space-y-2">
                  <Brain size={32} className="text-emerald-400 mx-auto" />
                  <h2 className="text-xl font-bold text-surface-100">Sort your topics</h2>
                  <p className="text-sm text-surface-400">Tap a topic to cycle: Weak → Okay → Strong</p>
                </div>
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pb-4">
                  {BUCKETS.map(bucket => {
                    const topicsInBucket = TOPICS.filter(t => confidence[t.id] === bucket.value);
                    return (
                      <div key={bucket.key} className={clsx('p-3 rounded-xl border', bucket.border, bucket.bg)}>
                        <p className="text-xs font-semibold text-surface-300 mb-2">{bucket.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {topicsInBucket.length === 0 && (
                            <span className="text-[11px] text-surface-600 italic">Tap topics to move here</span>
                          )}
                          {topicsInBucket.map(topic => {
                            const nextLabel = bucket.value === 1 ? 'Okay' : bucket.value === 3 ? 'Strong' : 'Weak';
                            return (
                              <button
                                key={topic.id}
                                onClick={() => {
                                  const cur = confidence[topic.id];
                                  const next = cur === 1 ? 3 : cur === 3 ? 5 : 1;
                                  setConfidence(prev => ({ ...prev, [topic.id]: next }));
                                }}
                                aria-label={`Move ${topic.name} to ${nextLabel}`}
                                className={clsx(
                                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer touch-manipulation active:scale-95',
                                  bucket.chip,
                                )}
                              >
                                {topic.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {error && (
          <p className="text-sm text-red-400 text-center px-4">{error}</p>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3 pt-4 pb-6 px-1">
          {step > 0 && (
            <button
              onClick={handleBack}
              className="flex items-center gap-1 px-4 py-3 rounded-xl border border-surface-700 text-surface-300 hover:bg-surface-800 transition-colors"
            >
              <ChevronLeft size={16} />
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canAdvance() || saving}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all',
              canAdvance() && !saving
                ? 'bg-gradient-to-r from-emerald-500 to-sky-500 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40'
                : 'bg-surface-700 text-surface-500 cursor-not-allowed'
            )}
          >
            {saving ? (
              <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : step === 3 ? (
              <>
                <Check size={18} />
                Start Diagnostic
              </>
            ) : (
              <>
                Next
                <ChevronRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
