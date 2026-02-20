/**
 * Self-Improving Prompt System
 *
 * When an agent's output gets negative feedback (student says "bad explanation"),
 * the system logs it, and the next prompt includes learnings.
 *
 * Sage uses this most heavily — if a student says "I don't understand",
 * Sage switches explanation style automatically.
 *
 * Herald uses it for marketing copy — if a subject line doesn't get opens,
 * it learns to avoid that pattern.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface PromptOutcome {
  promptId: string;
  agentId: string;
  promptVariant: string;
  outcome: 'positive' | 'negative' | 'neutral';
  signal: string;     // "student said: I don't understand" or "5-star rating"
  timestamp: Date;
}

export interface LearnedStyle {
  agentId: string;
  context: string;        // "JEE_Physics_Mechanics"
  preferredStyle: string; // "use analogies + step-by-step, avoid jargon"
  confidenceLevel: number;
  updatedAt: Date;
  sampleCount: number;
}

export interface StudentContext {
  isStruggling: boolean;
  isAdvanced: boolean;
  daysToExam: number;
  learningStyle?: 'visual' | 'auditory' | 'reading' | 'kinesthetic';
  subject?: string;
  recentPerformancePercent?: number;
}

// ── Sage (Tutor) prompt variants ─────────────────────────────────────────────

export const SAGE_PROMPT_VARIANTS = {
  default: `You are Sage, an expert AI tutor for Indian competitive exams (JEE, NEET, UPSC, CA, GATE).
Explain concepts clearly with examples. If the student seems confused, simplify further.
Always check if they understood before moving on.`,

  visual_learner: `You are Sage. This student learns visually.
Use ASCII diagrams, step-by-step breakdowns, and analogies to real-world objects they can picture.
Format responses with clear sections and visual hierarchy.`,

  struggling: `You are Sage. This student is struggling. Be very patient and warm.
Start from absolute basics. Use the Socratic method — ask small guiding questions.
Keep each response SHORT (3-4 sentences max). Check understanding before moving on.
Never make them feel bad for not knowing something.`,

  advanced: `You are Sage. This student is advanced (scoring 85%+).
Skip basics. Challenge them with edge cases, counter-examples, and exam-tricky variations.
Connect concepts across subjects when relevant. Push them to explain their reasoning.`,

  exam_pressure: `You are Sage. This student has an exam in < 7 days. Time is precious.
Focus ONLY on high-probability exam topics. Give quick revision tips, formula lists, and common mistakes to avoid.
Be crisp. No long explanations — give them exactly what they need for the exam.`,

  parent_explaining: `You are Sage, explaining a student's progress to their parent.
Use simple, reassuring language. Avoid jargon. Focus on effort, improvement, and next steps.
Be positive but honest about areas that need work.`,
} as const;

export type SageVariant = keyof typeof SAGE_PROMPT_VARIANTS;

// ── Herald (Marketing) prompt variants ───────────────────────────────────────

export const HERALD_PROMPT_VARIANTS = {
  default: `Write engaging content for Indian exam prep students aged 16-28.
Tone: Motivating, peer-like, not corporate. Occasionally use Hindi words naturally (not forced).
Focus on their aspirations, fears, and the specific exam they're preparing for.`,

  high_engagement: `Previous posts with these patterns got 40%+ open rates:
- Subject line starts with a number or a question
- First sentence creates urgency or curiosity
- CTA is specific ("Try this 5-min technique tonight") not generic ("Learn more")
- Ends with a relatable micro-story
Replicate this pattern exactly.`,

  re_engagement: `This student hasn't opened an email in 14+ days. Last chance to re-engage.
Subject: Something that makes them open (curiosity, fear of missing out, or genuine value).
Body: Ultra short. One sentence. One CTA. No fluff.
Make them feel: "Wow, this is exactly what I needed."`,

  whatsapp: `Write a WhatsApp message for Indian exam prep students. Rules:
- Max 3 lines. Mobile-first.
- Start with emoji that matches the mood.
- No marketing speak. Sound like a friend who cares.
- End with a question or micro-action (not a link dump).`,
} as const;

export type HeraldVariant = keyof typeof HERALD_PROMPT_VARIANTS;

// ── Outcome tracker (in-memory for now, will be persisted to DB) ─────────────

const outcomes: PromptOutcome[] = [];
const learnedStyles = new Map<string, LearnedStyle>();

export function recordOutcome(outcome: PromptOutcome): void {
  outcomes.push(outcome);
  updateLearnedStyle(outcome);
}

function updateLearnedStyle(outcome: PromptOutcome): void {
  const key = `${outcome.agentId}_${outcome.promptVariant}`;
  const existing = learnedStyles.get(key);

  if (!existing) {
    learnedStyles.set(key, {
      agentId: outcome.agentId,
      context: outcome.promptVariant,
      preferredStyle:
        outcome.outcome === 'positive' ? 'keep_this_style' : 'avoid_this_style',
      confidenceLevel: 0.5,
      updatedAt: new Date(),
      sampleCount: 1,
    });
  } else {
    // Bayesian-style update: positive nudges confidence up, negative nudges it down
    const weight = outcome.outcome === 'positive' ? 0.1 : -0.1;
    existing.confidenceLevel = Math.max(
      0,
      Math.min(1, existing.confidenceLevel + weight),
    );
    existing.sampleCount++;
    existing.updatedAt = new Date();
  }
}

// ── Context-aware prompt selector ────────────────────────────────────────────

export function getBestPromptForContext(
  agentId: 'Sage' | 'Herald',
  studentContext: StudentContext,
): string {
  if (agentId === 'Sage') {
    if (studentContext.daysToExam <= 7) return SAGE_PROMPT_VARIANTS.exam_pressure;
    if (studentContext.isAdvanced) return SAGE_PROMPT_VARIANTS.advanced;
    if (studentContext.isStruggling) return SAGE_PROMPT_VARIANTS.struggling;
    if (studentContext.learningStyle === 'visual') return SAGE_PROMPT_VARIANTS.visual_learner;
    return SAGE_PROMPT_VARIANTS.default;
  }

  // Herald defaults
  return HERALD_PROMPT_VARIANTS.default;
}

/** Get the learned confidence level for a given prompt variant */
export function getVariantConfidence(agentId: string, variant: string): number {
  return learnedStyles.get(`${agentId}_${variant}`)?.confidenceLevel ?? 0.5;
}

/** All outcomes for analysis / dashboard */
export function getOutcomeHistory(agentId?: string): PromptOutcome[] {
  return agentId ? outcomes.filter(o => o.agentId === agentId) : [...outcomes];
}

/** Aggregate win rate per variant */
export function getVariantWinRates(): Record<string, number> {
  const counts: Record<string, { pos: number; total: number }> = {};

  for (const o of outcomes) {
    const key = `${o.agentId}__${o.promptVariant}`;
    if (!counts[key]) counts[key] = { pos: 0, total: 0 };
    counts[key].total++;
    if (o.outcome === 'positive') counts[key].pos++;
  }

  return Object.fromEntries(
    Object.entries(counts).map(([k, v]) => [k, v.total > 0 ? v.pos / v.total : 0.5]),
  );
}
