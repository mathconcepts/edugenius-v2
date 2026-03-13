/**
 * ContentPersonalizationControl.tsx — CEO Content Personalization Control Panel
 *
 * Live slot preview, signal weight sliders, A/B overrides, per-user peek,
 * and personalization health dashboard.
 *
 * Route: /content-personalization
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Sliders, Eye, FlaskConical, User, Activity,
  RefreshCw, ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import { clsx } from 'clsx';

import {
  resolveSlot,
  simulateSlot,
  describeSlotConfig,
  personalizationHealthScore,
  registerABOverride,
  clearABOverrides,
  type SlotId,
  type ContentModule,
  type SlotContext,
  type SignalWeights,
  type SlotConfig,
  type ABOverride,
} from '@/services/contentSlotService';
import { ContentSlot } from '@/components/ContentSlot';

// ─── All valid SlotIds ────────────────────────────────────────────────────────

const ALL_SLOT_IDS: SlotId[] = [
  'dashboard_hero', 'dashboard_sidebar', 'chat_pre_session', 'chat_post_response',
  'practice_between_q', 'practice_session_end', 'learn_topic_intro', 'learn_topic_complete',
  'daily_brief_card', 'exam_sim_pre', 'exam_sim_post', 'revision_card',
  'blog_sidebar', 'blog_post_bottom', 'leaderboard_personal', 'notification_push',
];

const ALL_MODULES: ContentModule[] = [
  'visual_concept_card', 'spaced_repetition', 'readiness_score', 'mood_checkin',
  'daily_brief', 'xp_bar', 'streak_motivation', 'exam_countdown', 'topic_recommendation',
  'pyq_spotlight', 'cohort_benchmark', 'weakness_alert', 'celebration', 'nudge_card',
  'concept_bite', 'formula_flash', 'practice_cta', 'empty_state_guide',
];

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'preview' | 'weights' | 'ab' | 'user' | 'health';

interface SimPersona {
  daysToExam: number;
  cognitiveLoad: SlotContext['cognitiveLoad'];
  streakDays: number;
  readinessScore: number;
  mood: string;
  recentScore: number;
  timeOfDay: SlotContext['timeOfDay'];
  isFirstSession: boolean;
  hasSRCardsDue: boolean;
  hasNewBadge: boolean;
  learningStyle: string;
  role: string;
  topic: string;
}

const DEFAULT_PERSONA: SimPersona = {
  daysToExam:     30,
  cognitiveLoad:  'medium',
  streakDays:     5,
  readinessScore: 55,
  mood:           'focused',
  recentScore:    65,
  timeOfDay:      'morning',
  isFirstSession: false,
  hasSRCardsDue:  true,
  hasNewBadge:    false,
  learningStyle:  'visual',
  role:           'student',
  topic:          'eigenvalues',
};

const DEFAULT_WEIGHTS: SignalWeights = {
  cognitiveLoad: 0.9,
  daysToExam:    0.85,
  recentScore:   0.8,
  timeOfDay:     0.6,
  mood:          0.75,
  streak:        0.5,
  srDue:         0.95,
  firstSession:  1.0,
};

// ─── Tab Button ───────────────────────────────────────────────────────────────

function TabBtn({ id, label, icon: Icon, active, onClick }: {
  id: TabId; label: string; icon: React.ElementType; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
        active ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30' : 'text-surface-400 hover:text-white hover:bg-surface-700',
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// ─── Live Slot Preview Tab ────────────────────────────────────────────────────

function PreviewTab() {
  const [slotId, setSlotId] = useState<SlotId>('dashboard_sidebar');
  const [persona, setPersona] = useState<SimPersona>(DEFAULT_PERSONA);
  const [weights, setWeights] = useState<SignalWeights>(DEFAULT_WEIGHTS);
  const [config, setConfig] = useState<SlotConfig | null>(null);
  const [description, setDescription] = useState('');
  const [open, setOpen] = useState(false);

  const simulate = useCallback(() => {
    const result = simulateSlot(slotId, {
      userId:        'ceo-preview',
      examId:        'gate-em',
      topic:         persona.topic || undefined,
      learningStyle: persona.learningStyle,
      cognitiveLoad: persona.cognitiveLoad,
      daysToExam:    persona.daysToExam,
      streakDays:    persona.streakDays,
      readinessScore: persona.readinessScore,
      mood:          persona.mood || undefined,
      recentScore:   persona.recentScore,
      timeOfDay:     persona.timeOfDay,
      isFirstSession: persona.isFirstSession,
      hasSRCardsDue:  persona.hasSRCardsDue,
      hasNewBadge:    persona.hasNewBadge,
      role:          persona.role,
      learningMoment: 'study',
    }, weights);
    setConfig(result);
    setDescription(describeSlotConfig(result));
  }, [slotId, persona, weights]);

  const updatePersona = <K extends keyof SimPersona>(key: K, value: SimPersona[K]) =>
    setPersona(p => ({ ...p, [key]: value }));

  return (
    <div className="space-y-5">
      {/* Slot selector */}
      <div>
        <label className="block text-xs text-surface-400 mb-1">Slot</label>
        <select
          className="input w-full text-sm"
          value={slotId}
          onChange={e => setSlotId(e.target.value as SlotId)}
        >
          {ALL_SLOT_IDS.map(id => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </div>

      {/* Persona builder */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-surface-400 mb-1">Days to Exam</label>
          <input type="number" className="input w-full text-sm" value={persona.daysToExam}
            onChange={e => updatePersona('daysToExam', Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-xs text-surface-400 mb-1">Cognitive Load</label>
          <select className="input w-full text-sm" value={persona.cognitiveLoad}
            onChange={e => updatePersona('cognitiveLoad', e.target.value as SlotContext['cognitiveLoad'])}>
            {(['low', 'medium', 'high', 'overloaded'] as const).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-surface-400 mb-1">Time of Day</label>
          <select className="input w-full text-sm" value={persona.timeOfDay}
            onChange={e => updatePersona('timeOfDay', e.target.value as SlotContext['timeOfDay'])}>
            {(['morning', 'afternoon', 'evening', 'night', 'late_night'] as const).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-surface-400 mb-1">Streak Days</label>
          <input type="number" className="input w-full text-sm" value={persona.streakDays}
            onChange={e => updatePersona('streakDays', Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-xs text-surface-400 mb-1">Readiness Score (0-100)</label>
          <input type="number" className="input w-full text-sm" value={persona.readinessScore}
            onChange={e => updatePersona('readinessScore', Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-xs text-surface-400 mb-1">Recent Score (0-100)</label>
          <input type="number" className="input w-full text-sm" value={persona.recentScore}
            onChange={e => updatePersona('recentScore', Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-xs text-surface-400 mb-1">Mood</label>
          <select className="input w-full text-sm" value={persona.mood}
            onChange={e => updatePersona('mood', e.target.value)}>
            {['', 'energised', 'focused', 'neutral', 'tired', 'stressed', 'frustrated'].map(v => (
              <option key={v} value={v}>{v || '(not set)'}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-surface-400 mb-1">Topic</label>
          <input type="text" className="input w-full text-sm" value={persona.topic}
            onChange={e => updatePersona('topic', e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs text-surface-400 cursor-pointer">
            <input type="checkbox" checked={persona.isFirstSession}
              onChange={e => updatePersona('isFirstSession', e.target.checked)} />
            First Session
          </label>
          <label className="flex items-center gap-2 text-xs text-surface-400 cursor-pointer">
            <input type="checkbox" checked={persona.hasSRCardsDue}
              onChange={e => updatePersona('hasSRCardsDue', e.target.checked)} />
            SR Cards Due
          </label>
          <label className="flex items-center gap-2 text-xs text-surface-400 cursor-pointer">
            <input type="checkbox" checked={persona.hasNewBadge}
              onChange={e => updatePersona('hasNewBadge', e.target.checked)} />
            New Badge
          </label>
        </div>
      </div>

      <button onClick={simulate} className="btn bg-primary-500 hover:bg-primary-400 text-white w-full">
        <RefreshCw className="w-4 h-4 mr-2" />
        Simulate Slot
      </button>

      {/* Results */}
      {config && (
        <div className="space-y-4">
          {/* Resolution description */}
          <div>
            <button
              onClick={() => setOpen(p => !p)}
              className="flex items-center gap-2 text-xs text-surface-400 hover:text-white transition-colors"
            >
              <Info className="w-3 h-3" />
              Resolution details
              {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {open && (
              <pre className="mt-2 p-3 bg-surface-900 border border-surface-700 rounded-lg text-[10px] text-surface-300 overflow-x-auto whitespace-pre-wrap">
                {description}
              </pre>
            )}
          </div>

          {/* Personalization health */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-surface-400">Personalization Health:</span>
            <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all"
                style={{ width: `${personalizationHealthScore(config)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-green-400">{personalizationHealthScore(config)}%</span>
          </div>

          {/* Live preview */}
          <div className="border border-dashed border-primary-500/30 rounded-xl p-4">
            <p className="text-xs text-primary-400 mb-3 flex items-center gap-1">
              <Eye className="w-3 h-3" />
              Live Preview — {slotId}
            </p>
            <ContentSlot
              slotId={slotId}
              topic={persona.topic || undefined}
              showPersonalizationBadge
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Signal Weights Tab ───────────────────────────────────────────────────────

function WeightsTab() {
  const [weights, setWeights] = useState<SignalWeights>(DEFAULT_WEIGHTS);

  const updateWeight = (key: keyof SignalWeights, value: number) =>
    setWeights(p => ({ ...p, [key]: value }));

  const WEIGHT_LABELS: Record<keyof SignalWeights, string> = {
    cognitiveLoad: 'Cognitive Load',
    daysToExam:    'Days to Exam',
    recentScore:   'Recent Score',
    timeOfDay:     'Time of Day',
    mood:          'Mood State',
    streak:        'Streak Count',
    srDue:         'SR Cards Due',
    firstSession:  'First Session',
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-surface-400">
        Adjust how much each personalization signal influences slot resolution.
        A weight of 0 effectively disables that signal.
      </p>

      {(Object.keys(weights) as (keyof SignalWeights)[]).map(key => (
        <div key={key}>
          <div className="flex justify-between mb-1">
            <label className="text-sm text-surface-300">{WEIGHT_LABELS[key]}</label>
            <span className="text-sm font-mono text-primary-400">{weights[key].toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0} max={1} step={0.05}
            value={weights[key]}
            onChange={e => updateWeight(key, Number(e.target.value))}
            className="w-full accent-primary-500"
          />
          <div className="flex justify-between text-[10px] text-surface-600 mt-0.5">
            <span>Disabled</span>
            <span>Max influence</span>
          </div>
        </div>
      ))}

      <div className="p-3 bg-surface-800/60 rounded-lg border border-surface-700">
        <p className="text-xs text-surface-400">
          <Info className="w-3 h-3 inline mr-1" />
          Changes here are preview-only. Production weight changes require a deploy.
        </p>
      </div>
    </div>
  );
}

// ─── A/B Override Tab ─────────────────────────────────────────────────────────

function ABTab() {
  const [overrides, setOverrides] = useState<ABOverride[]>([]);
  const [form, setForm] = useState<ABOverride>({
    moduleId:     'celebration',
    slotId:       'dashboard_hero',
    percentUsers: 20,
    reason:       '',
  });

  const addOverride = () => {
    if (!form.reason.trim()) return;
    const newOverride: ABOverride = { ...form };
    registerABOverride(newOverride);
    setOverrides(prev => [...prev, newOverride]);
    setForm(f => ({ ...f, reason: '' }));
  };

  const removeAll = () => {
    clearABOverrides();
    setOverrides([]);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-surface-400">
        Force a specific module for a percentage of users in a slot.
        Useful for testing new content types without full rollout.
      </p>

      {/* Add Override Form */}
      <div className="p-4 bg-surface-800/60 rounded-xl border border-surface-700 space-y-3">
        <p className="text-sm font-semibold text-white">Add Override</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-surface-400 block mb-1">Slot</label>
            <select className="input w-full text-sm" value={form.slotId}
              onChange={e => setForm(f => ({ ...f, slotId: e.target.value as SlotId }))}>
              {ALL_SLOT_IDS.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-400 block mb-1">Force Module</label>
            <select className="input w-full text-sm" value={form.moduleId}
              onChange={e => setForm(f => ({ ...f, moduleId: e.target.value as ContentModule }))}>
              {ALL_MODULES.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-400 block mb-1">% of Users</label>
            <input type="number" min={1} max={100} className="input w-full text-sm"
              value={form.percentUsers}
              onChange={e => setForm(f => ({ ...f, percentUsers: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="text-xs text-surface-400 block mb-1">Reason / Hypothesis</label>
            <input type="text" className="input w-full text-sm" placeholder="e.g. Test celebration uplift"
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
        </div>
        <button onClick={addOverride} className="btn bg-primary-500 hover:bg-primary-400 text-white text-sm">
          + Add Override
        </button>
      </div>

      {/* Active Overrides */}
      {overrides.length > 0 ? (
        <div className="space-y-2">
          <div className="flex justify-between">
            <p className="text-sm font-semibold text-white">Active Overrides ({overrides.length})</p>
            <button onClick={removeAll} className="text-xs text-red-400 hover:text-red-300">Clear all</button>
          </div>
          {overrides.map((o, i) => (
            <div key={i} className="p-3 bg-surface-800 rounded-lg border border-surface-700 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-white">
                  {o.slotId} → <span className="text-primary-400">{o.moduleId}</span>
                </p>
                <p className="text-[10px] text-surface-500">{o.percentUsers}% users · {o.reason}</p>
              </div>
              <span className="text-[10px] bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full">ACTIVE</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-surface-500 text-center py-4">No active overrides</p>
      )}
    </div>
  );
}

// ─── Per-User Peek Tab ────────────────────────────────────────────────────────

function UserPeekTab() {
  const [userId, setUserId] = useState('EG-A1B2C3');
  const [slotId, setSlotId] = useState<SlotId>('dashboard_sidebar');
  const [result, setResult] = useState<SlotConfig | null>(null);

  const peek = () => {
    // In production this would fetch the user's live context from the DB.
    // Here we simulate with a reasonable approximation.
    const config = resolveSlot({
      slotId,
      userId,
      examId:         'gate-em',
      learningStyle:  'visual',
      cognitiveLoad:  'medium',
      daysToExam:     45,
      streakDays:     8,
      readinessScore: 60,
      learningMoment: 'study',
      timeOfDay:      'morning',
      isFirstSession: false,
      hasSRCardsDue:  true,
      hasNewBadge:    false,
      role:           'student',
    });
    setResult(config);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-surface-400">
        Enter any userId to see what content they are currently configured to receive.
      </p>
      <div className="flex gap-3">
        <input type="text" className="input flex-1 text-sm" placeholder="EG-A1B2C3"
          value={userId} onChange={e => setUserId(e.target.value)} />
        <select className="input text-sm" value={slotId}
          onChange={e => setSlotId(e.target.value as SlotId)}>
          {ALL_SLOT_IDS.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
        <button onClick={peek} className="btn bg-primary-500 hover:bg-primary-400 text-white text-sm px-4">
          Peek
        </button>
      </div>

      {result && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">
            {userId} → {slotId}
          </p>

          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-surface-400">Personalization Health:</span>
            <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all"
                style={{ width: `${personalizationHealthScore(result)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-green-400">{personalizationHealthScore(result)}%</span>
          </div>

          {result.modules.map((m, i) => (
            <motion.div
              key={m.moduleId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-3 bg-surface-800 rounded-lg border border-surface-700"
            >
              <div className="flex justify-between">
                <p className="text-sm font-medium text-white">{m.moduleId}</p>
                <span className="text-[10px] text-surface-500">priority {m.priority}</span>
              </div>
              <p className="text-xs text-surface-400 mt-0.5">{m.reason}</p>
              <div className="flex gap-1 flex-wrap mt-1">
                {m.personalizationSignals.map(sig => (
                  <span key={sig} className="px-1.5 py-px bg-primary-500/10 text-primary-400 text-[10px] rounded-full">
                    {sig}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Personalization Health Tab ───────────────────────────────────────────────

function HealthTab() {
  const [results, setResults] = useState<{ slotId: SlotId; health: number; modules: string[] }[]>([]);

  const runHealthCheck = () => {
    const scenarios: Partial<SlotContext>[] = [
      { daysToExam: 1,  cognitiveLoad: 'overloaded', recentScore: 20 },
      { daysToExam: 5,  cognitiveLoad: 'medium',     recentScore: 85 },
      { daysToExam: 30, cognitiveLoad: 'low',        recentScore: 65 },
      { isFirstSession: true, daysToExam: 60 },
    ];

    const data = ALL_SLOT_IDS.map(slotId => {
      const configs = scenarios.map(s => resolveSlot({
        slotId,
        userId:        'health-check',
        examId:        'gate-em',
        learningStyle: 'visual',
        cognitiveLoad: s.cognitiveLoad ?? 'medium',
        daysToExam:    s.daysToExam ?? 30,
        streakDays:    7,
        readinessScore: 60,
        learningMoment: 'study',
        timeOfDay:     'morning',
        isFirstSession: s.isFirstSession ?? false,
        hasSRCardsDue:  true,
        hasNewBadge:    false,
        role:           'student',
        recentScore:    s.recentScore,
        ...s,
      }));

      const avgHealth = Math.round(
        configs.reduce((sum, c) => sum + personalizationHealthScore(c), 0) / configs.length,
      );

      const uniqueModules = [...new Set(configs.flatMap(c => c.modules.map(m => m.moduleId)))];

      return { slotId, health: avgHealth, modules: uniqueModules };
    });

    setResults(data);
  };

  const overallHealth = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.health, 0) / results.length)
    : null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-surface-400">
        Run a health check across all slots to see what % of users are getting
        personalized (non-default) content in each scenario.
      </p>

      <button onClick={runHealthCheck} className="btn bg-primary-500 hover:bg-primary-400 text-white w-full">
        <Activity className="w-4 h-4 mr-2" />
        Run Health Check (4 scenarios × {ALL_SLOT_IDS.length} slots)
      </button>

      {overallHealth !== null && (
        <div className="p-4 bg-surface-800 rounded-xl border border-surface-700">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">Overall Personalization Health</p>
            <span className={clsx(
              'text-2xl font-bold',
              overallHealth >= 70 ? 'text-green-400' :
              overallHealth >= 40 ? 'text-amber-400' : 'text-red-400',
            )}>
              {overallHealth}%
            </span>
          </div>
          <div className="h-3 bg-surface-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-emerald-400 rounded-full transition-all duration-1000"
              style={{ width: `${overallHealth}%` }}
            />
          </div>
          <p className="text-xs text-surface-500 mt-2">
            {overallHealth >= 70 ? '✅ Excellent — most users get tailored content.' :
             overallHealth >= 40 ? '⚠️ Moderate — consider more personalization signals.' :
             '❌ Low — many users seeing default content. Add more signals.'}
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-white">Per-Slot Health</p>
          {results.map(r => (
            <div key={r.slotId} className="flex items-center gap-3 p-2 bg-surface-800/60 rounded-lg">
              <p className="text-xs font-mono text-surface-300 w-48 shrink-0">{r.slotId}</p>
              <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all',
                    r.health >= 70 ? 'bg-green-500' :
                    r.health >= 40 ? 'bg-amber-500' : 'bg-red-500',
                  )}
                  style={{ width: `${r.health}%` }}
                />
              </div>
              <span className="text-xs font-bold text-surface-300 w-10 text-right">{r.health}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'preview', label: 'Live Preview',    icon: Eye },
  { id: 'weights', label: 'Signal Weights',  icon: Sliders },
  { id: 'ab',      label: 'A/B Overrides',   icon: FlaskConical },
  { id: 'user',    label: 'Per-User Peek',   icon: User },
  { id: 'health',  label: 'Health Check',    icon: Activity },
];

export function ContentPersonalizationControl() {
  const [activeTab, setActiveTab] = useState<TabId>('preview');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sliders className="w-6 h-6 text-primary-400" />
          Content Personalization Control
        </h1>
        <p className="text-surface-400 text-sm mt-1">
          Preview, tune, and health-check the hyper-personalized content slot system
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(tab => (
          <TabBtn
            key={tab.id}
            id={tab.id}
            label={tab.label}
            icon={tab.icon}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>

      {/* Tab Content */}
      <div className="card p-6">
        {activeTab === 'preview' && <PreviewTab />}
        {activeTab === 'weights' && <WeightsTab />}
        {activeTab === 'ab'      && <ABTab />}
        {activeTab === 'user'    && <UserPeekTab />}
        {activeTab === 'health'  && <HealthTab />}
      </div>
    </div>
  );
}
