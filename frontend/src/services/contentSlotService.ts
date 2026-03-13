/**
 * contentSlotService.ts — Hyper-Personalized Modular Content Slot Engine
 *
 * Given a SlotContext (who + where + when + why), returns a SlotConfig
 * (what to render + how). The core resolution engine for the content
 * personalization system.
 *
 * Resolution priority (most specific wins):
 *   exam_day → overloaded → first_session → post_score → sr_due → time_of_day → standard
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SlotId =
  | 'dashboard_hero'       // top of student dashboard
  | 'dashboard_sidebar'    // right column widget stack
  | 'chat_pre_session'     // shown before student starts chatting
  | 'chat_post_response'   // injected after Sage response
  | 'practice_between_q'   // between questions in practice mode
  | 'practice_session_end' // after practice session
  | 'learn_topic_intro'    // before starting a topic
  | 'learn_topic_complete' // after completing a topic
  | 'daily_brief_card'     // daily brief widget slot
  | 'exam_sim_pre'         // before mock exam
  | 'exam_sim_post'        // after mock exam (results)
  | 'revision_card'        // inside revision schedule
  | 'blog_sidebar'         // blog page right column
  | 'blog_post_bottom'     // below blog article
  | 'leaderboard_personal' // personal summary on leaderboard
  | 'notification_push';   // WhatsApp/push notification content

export type ContentModule =
  | 'visual_concept_card'  // VisualConceptCard component
  | 'spaced_repetition'    // SR card due today
  | 'readiness_score'      // Readiness gauge
  | 'mood_checkin'         // Mood check-in
  | 'daily_brief'          // Today's brief
  | 'xp_bar'               // Gamification bar
  | 'streak_motivation'    // Streak card
  | 'exam_countdown'       // Days to exam
  | 'topic_recommendation' // Next best topic
  | 'pyq_spotlight'        // A GATE PYQ to try
  | 'cohort_benchmark'     // How you compare
  | 'weakness_alert'       // Topic flagged as weak
  | 'celebration'          // Win moment
  | 'nudge_card'           // Mentor nudge
  | 'concept_bite'         // Micro-concept (2 min)
  | 'formula_flash'        // Formula to remember
  | 'practice_cta'         // Start practice CTA
  | 'empty_state_guide';   // First-time guidance

export interface SlotContext {
  slotId: SlotId;
  userId: string;
  examId: string;
  topic?: string;
  // Persona signals
  learningStyle: string;
  cognitiveLoad: 'low' | 'medium' | 'high' | 'overloaded';
  daysToExam: number;
  streakDays: number;
  readinessScore: number;    // 0-100
  mood?: string;
  recentScore?: number;      // last practice score 0-100
  sessionMinutes?: number;   // minutes in current session
  learningMoment: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night';
  // Flags
  isFirstSession: boolean;
  hasSRCardsDue: boolean;
  hasNewBadge: boolean;
  role: string;
}

export interface SlotConfig {
  slotId: SlotId;
  modules: ModuleConfig[];    // ordered list (render top to bottom)
  layout: 'stack' | 'carousel' | 'grid' | 'single' | 'inline';
  maxModules: number;
  refreshIntervalMs?: number; // auto-refresh interval
}

export interface ModuleConfig {
  moduleId: ContentModule;
  priority: number;           // 1 = highest
  props: Record<string, unknown>;
  visible: boolean;
  reason: string;             // why this was selected (for debugging/CEO view)
  personalizationSignals: string[];  // which signals drove this
}

// ─── Signal Weights (adjustable per-platform) ─────────────────────────────────

export interface SignalWeights {
  cognitiveLoad: number;   // 0-1
  daysToExam: number;
  recentScore: number;
  timeOfDay: number;
  mood: number;
  streak: number;
  srDue: number;
  firstSession: number;
}

const DEFAULT_SIGNAL_WEIGHTS: SignalWeights = {
  cognitiveLoad: 0.9,
  daysToExam:    0.85,
  recentScore:   0.8,
  timeOfDay:     0.6,
  mood:          0.75,
  streak:        0.5,
  srDue:         0.95,
  firstSession:  1.0,
};

// ─── A/B Override Registry ────────────────────────────────────────────────────

export interface ABOverride {
  moduleId: ContentModule;
  slotId: SlotId;
  percentUsers: number; // 0-100
  reason: string;
}

const AB_OVERRIDES: ABOverride[] = [];

export function registerABOverride(override: ABOverride): void {
  AB_OVERRIDES.push(override);
}

export function clearABOverrides(): void {
  AB_OVERRIDES.length = 0;
}

// ─── Slot Layout Defaults ─────────────────────────────────────────────────────

const SLOT_LAYOUT_DEFAULTS: Record<SlotId, Pick<SlotConfig, 'layout' | 'maxModules' | 'refreshIntervalMs'>> = {
  dashboard_hero:       { layout: 'single',   maxModules: 1, refreshIntervalMs: 300_000 },
  dashboard_sidebar:    { layout: 'stack',    maxModules: 4, refreshIntervalMs: 120_000 },
  chat_pre_session:     { layout: 'single',   maxModules: 1 },
  chat_post_response:   { layout: 'inline',   maxModules: 2 },
  practice_between_q:   { layout: 'single',   maxModules: 1 },
  practice_session_end: { layout: 'stack',    maxModules: 3 },
  learn_topic_intro:    { layout: 'stack',    maxModules: 2 },
  learn_topic_complete: { layout: 'stack',    maxModules: 3 },
  daily_brief_card:     { layout: 'single',   maxModules: 1 },
  exam_sim_pre:         { layout: 'stack',    maxModules: 2 },
  exam_sim_post:        { layout: 'stack',    maxModules: 3 },
  revision_card:        { layout: 'carousel', maxModules: 5 },
  blog_sidebar:         { layout: 'stack',    maxModules: 3 },
  blog_post_bottom:     { layout: 'grid',     maxModules: 2 },
  leaderboard_personal: { layout: 'stack',    maxModules: 2 },
  notification_push:    { layout: 'single',   maxModules: 1 },
};

// ─── Module Builder Helpers ───────────────────────────────────────────────────

function makeModule(
  moduleId: ContentModule,
  priority: number,
  reason: string,
  signals: string[],
  props: Record<string, unknown> = {},
): ModuleConfig {
  return {
    moduleId,
    priority,
    props,
    visible: true,
    reason,
    personalizationSignals: signals,
  };
}

// ─── Core Resolution Logic ────────────────────────────────────────────────────

/**
 * Resolve which modules to show for a given slot context.
 * Priority rules (first match wins at each level, then merged):
 *
 * 1. exam_day       — daysToExam <= 1
 * 2. overloaded     — cognitiveLoad === 'overloaded' OR mood in ['stressed','frustrated']
 * 3. first_session  — isFirstSession
 * 4. post_high_score— recentScore >= 80
 * 5. post_low_score — recentScore < 40 (and defined)
 * 6. sr_due         — hasSRCardsDue (always inject)
 * 7. morning_streak — timeOfDay === 'morning' && streakDays > 0
 * 8. exam_soon      — daysToExam 2-7
 * 9. standard       — fallback
 */
function resolveModulesForContext(ctx: SlotContext): ModuleConfig[] {
  const modules: ModuleConfig[] = [];
  let priority = 1;

  const addModule = (
    moduleId: ContentModule,
    reason: string,
    signals: string[],
    props: Record<string, unknown> = {},
  ) => {
    modules.push(makeModule(moduleId, priority++, reason, signals, props));
  };

  // ── Scenario 1: Exam Day (daysToExam <= 1) ──────────────────────────────────
  if (ctx.daysToExam <= 1) {
    addModule('formula_flash',   'Exam day — review key formulas',       ['daysToExam'], { examId: ctx.examId, topic: ctx.topic });
    addModule('pyq_spotlight',   'Exam day — one last PYQ to warm up',   ['daysToExam'], { examId: ctx.examId });
    addModule('readiness_score', 'Exam day — know your readiness level', ['daysToExam', 'readinessScore']);
    return modules;
  }

  // ── Scenario 2: Overloaded / Stressed ──────────────────────────────────────
  const isStressed = ctx.cognitiveLoad === 'overloaded' ||
    ctx.mood === 'stressed' || ctx.mood === 'frustrated';
  if (isStressed) {
    addModule('concept_bite',      'Cognitive load is high — keep it short',         ['cognitiveLoad', 'mood'], { topic: ctx.topic });
    addModule('streak_motivation', 'Morale boost when stressed',                     ['mood', 'streak'], { streakDays: ctx.streakDays });
    if (ctx.hasSRCardsDue) {
      addModule('spaced_repetition', 'SR cards are time-sensitive — gentle reminder', ['hasSRCardsDue'], {});
    }
    return modules;
  }

  // ── Scenario 3: First Session ───────────────────────────────────────────────
  if (ctx.isFirstSession) {
    addModule('empty_state_guide', 'First-time user — onboarding guide',   ['isFirstSession'], { examId: ctx.examId });
    addModule('mood_checkin',      'Capture baseline mood on first visit',  ['isFirstSession'], {});
    addModule('exam_countdown',    'Make exam urgency visible from day 1',  ['isFirstSession', 'daysToExam'], { daysToExam: ctx.daysToExam, examId: ctx.examId });
    return modules;
  }

  // ── Scenario 4: Post High Score (≥80) ──────────────────────────────────────
  if (ctx.recentScore !== undefined && ctx.recentScore >= 80) {
    addModule('celebration',        'Celebrate the win',                                      ['recentScore'], { score: ctx.recentScore });
    addModule('cohort_benchmark',   'Show how they compare after a great session',            ['recentScore', 'readinessScore'], {});
    addModule('topic_recommendation','Push to harder topics after success',                   ['recentScore', 'learningMoment'], { topic: ctx.topic, difficulty: 'hard' });
    if (ctx.hasSRCardsDue) {
      addModule('spaced_repetition', 'SR is time-sensitive even after success',               ['hasSRCardsDue'], {});
    }
    if (ctx.hasNewBadge) {
      addModule('xp_bar', 'New badge earned — show XP progress',                              ['hasNewBadge'], {});
    }
    return modules;
  }

  // ── Scenario 5: Post Low Score (<40) ───────────────────────────────────────
  if (ctx.recentScore !== undefined && ctx.recentScore < 40) {
    addModule('weakness_alert', 'Flag weak area after low score',           ['recentScore'], { topic: ctx.topic, score: ctx.recentScore });
    addModule('concept_bite',   'Micro-lesson to rebuild confidence',       ['recentScore', 'cognitiveLoad'], { topic: ctx.topic });
    addModule('nudge_card',     'Mentor nudge after discouraging result',   ['recentScore', 'mood'], {});
    if (ctx.hasSRCardsDue) {
      addModule('spaced_repetition', 'SR due — do not skip even after low score', ['hasSRCardsDue'], {});
    }
    return modules;
  }

  // ── SR always appears when due (time-sensitive) ─────────────────────────────
  if (ctx.hasSRCardsDue) {
    addModule('spaced_repetition', 'Spaced repetition cards are due today — SM-2 is time-sensitive', ['hasSRCardsDue'], {});
  }

  // ── Scenario 6: Morning + Streak ───────────────────────────────────────────
  if (ctx.timeOfDay === 'morning' && ctx.streakDays > 0) {
    addModule('streak_motivation', 'Morning motivation — protect the streak', ['timeOfDay', 'streak'], { streakDays: ctx.streakDays });
  }

  // ── Scenario 7: Exam Soon (2-7 days) ───────────────────────────────────────
  if (ctx.daysToExam >= 2 && ctx.daysToExam <= 7) {
    addModule('exam_countdown', 'Exam is very soon — make it visible',      ['daysToExam'], { daysToExam: ctx.daysToExam, examId: ctx.examId });
    addModule('daily_brief',    'Daily brief is critical in the final week', ['daysToExam'], { examId: ctx.examId });
    addModule('formula_flash',  'Final week — formulas on top of mind',     ['daysToExam'], { examId: ctx.examId, topic: ctx.topic });
    addModule('readiness_score','Track readiness in final sprint',           ['daysToExam', 'readinessScore'], {});
    return modules;
  }

  // ── Standard / Baseline ────────────────────────────────────────────────────
  addModule('visual_concept_card',  'Standard session — learn with visual card',  ['learningStyle', 'learningMoment'], { topic: ctx.topic, examId: ctx.examId, learningStyle: ctx.learningStyle });
  addModule('topic_recommendation', 'Show next best topic based on persona',       ['learningMoment', 'readinessScore'], { topic: ctx.topic, examId: ctx.examId });
  addModule('xp_bar',               'Gamification — show progress',               ['streakDays'], {});

  // Add mood check-in if not checked in today
  if (ctx.mood === undefined || ctx.mood === '') {
    addModule('mood_checkin', 'No mood captured yet today', ['mood'], {});
  }

  // Add readiness if high cognitive load allows
  if (ctx.cognitiveLoad === 'low' || ctx.cognitiveLoad === 'medium') {
    addModule('readiness_score', 'Readiness visible during normal load', ['cognitiveLoad', 'readinessScore'], {});
  }

  return modules;
}

// ─── Slot-Specific Module Filtering ──────────────────────────────────────────

/**
 * Certain slots restrict which modules are allowed.
 * e.g. chat_post_response should only show inline, short modules.
 */
const SLOT_MODULE_ALLOWLIST: Partial<Record<SlotId, ContentModule[]>> = {
  chat_post_response:   ['concept_bite', 'formula_flash', 'pyq_spotlight', 'streak_motivation', 'nudge_card', 'celebration', 'xp_bar'],
  practice_between_q:   ['streak_motivation', 'concept_bite', 'nudge_card', 'formula_flash'],
  blog_sidebar:         ['topic_recommendation', 'practice_cta', 'exam_countdown', 'readiness_score'],
  blog_post_bottom:     ['topic_recommendation', 'pyq_spotlight', 'practice_cta'],
  notification_push:    ['streak_motivation', 'nudge_card', 'exam_countdown', 'daily_brief'],
  daily_brief_card:     ['daily_brief'],
};

function applySlotFiltering(slotId: SlotId, modules: ModuleConfig[]): ModuleConfig[] {
  const allowlist = SLOT_MODULE_ALLOWLIST[slotId];
  if (!allowlist) return modules;
  return modules.filter(m => allowlist.includes(m.moduleId));
}

// ─── A/B Override Application ─────────────────────────────────────────────────

function applyABOverrides(
  slotId: SlotId,
  userId: string,
  modules: ModuleConfig[],
): ModuleConfig[] {
  const applicableOverrides = AB_OVERRIDES.filter(o => o.slotId === slotId);
  if (applicableOverrides.length === 0) return modules;

  // Use userId hash to deterministically assign user to override bucket
  const hash = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const bucket = hash % 100; // 0-99

  let cumulativePct = 0;
  for (const override of applicableOverrides) {
    cumulativePct += override.percentUsers;
    if (bucket < cumulativePct) {
      // This user is in the override bucket
      const forced = makeModule(
        override.moduleId,
        0,
        `A/B override: ${override.reason}`,
        ['ab_override'],
        {},
      );
      return [forced, ...modules.filter(m => m.moduleId !== override.moduleId)];
    }
  }

  return modules;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Main entry point. Resolves a SlotContext into a SlotConfig.
 */
export function resolveSlot(ctx: SlotContext, weights?: Partial<SignalWeights>): SlotConfig {
  const effectiveWeights = { ...DEFAULT_SIGNAL_WEIGHTS, ...weights };
  const layoutDefaults = SLOT_LAYOUT_DEFAULTS[ctx.slotId];

  // Core resolution
  let modules = resolveModulesForContext(ctx);

  // Apply slot-specific filtering
  modules = applySlotFiltering(ctx.slotId, modules);

  // Apply A/B overrides
  modules = applyABOverrides(ctx.slotId, ctx.userId, modules);

  // Apply weight-based visibility: if a signal weight is very low (< 0.2),
  // hide modules purely driven by that signal
  modules = modules.map(m => {
    const isHidden = m.personalizationSignals.every(sig => {
      const weightKey = sig as keyof SignalWeights;
      const w = effectiveWeights[weightKey];
      return w !== undefined && w < 0.2;
    });
    if (isHidden && m.personalizationSignals.length > 0) {
      return { ...m, visible: false };
    }
    return m;
  });

  // Sort by priority, take maxModules, filter visible
  const sorted = [...modules]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, layoutDefaults.maxModules);

  return {
    slotId: ctx.slotId,
    modules: sorted,
    layout: layoutDefaults.layout,
    maxModules: layoutDefaults.maxModules,
    refreshIntervalMs: layoutDefaults.refreshIntervalMs,
  };
}

/**
 * Build a SlotContext from raw signals.
 * Convenience function for components that don't want to build the full context.
 */
export function buildSlotContext(
  slotId: SlotId,
  overrides: Partial<Omit<SlotContext, 'slotId'>>,
): SlotContext {
  const hour = new Date().getHours();
  const timeOfDay: SlotContext['timeOfDay'] =
    hour < 6    ? 'late_night' :
    hour < 12   ? 'morning' :
    hour < 17   ? 'afternoon' :
    hour < 21   ? 'evening' : 'night';

  return {
    slotId,
    userId:       'anon',
    examId:       'general',
    learningStyle: 'unknown',
    cognitiveLoad: 'medium',
    daysToExam:   90,
    streakDays:   0,
    readinessScore: 50,
    learningMoment: 'study',
    timeOfDay,
    isFirstSession: false,
    hasSRCardsDue:  false,
    hasNewBadge:    false,
    role:           'student',
    ...overrides,
  };
}

/**
 * Describe a slot config in human-readable text. Useful for CEO "why" panel.
 */
export function describeSlotConfig(config: SlotConfig): string {
  const lines: string[] = [
    `Slot: ${config.slotId}`,
    `Layout: ${config.layout} (max ${config.maxModules})`,
    '',
    'Modules:',
    ...config.modules.map((m, i) =>
      `  ${i + 1}. ${m.moduleId} [p${m.priority}] — ${m.reason} (signals: ${m.personalizationSignals.join(', ')})`
    ),
  ];
  return lines.join('\n');
}

/**
 * Simulate what a given persona would see in a slot.
 * Used by ContentPersonalizationControl CEO page.
 */
export function simulateSlot(
  slotId: SlotId,
  persona: Partial<SlotContext>,
  weights?: Partial<SignalWeights>,
): SlotConfig {
  const ctx = buildSlotContext(slotId, persona);
  return resolveSlot(ctx, weights);
}

/**
 * Get the "personalization health" score for a given context.
 * 0 = all defaults, 100 = fully personalized.
 */
export function personalizationHealthScore(config: SlotConfig): number {
  if (config.modules.length === 0) return 0;
  const signalledModules = config.modules.filter(
    m => m.personalizationSignals.length > 0 &&
         !m.personalizationSignals.includes('ab_override')
  );
  const avgSignals = signalledModules.reduce(
    (sum, m) => sum + m.personalizationSignals.length,
    0,
  ) / Math.max(signalledModules.length, 1);
  return Math.min(100, Math.round((avgSignals / 3) * 100));
}
