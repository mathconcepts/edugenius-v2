/**
 * contentFramework.ts — Customer-Centric Content Generation & Presentation Framework
 *
 * ═══════════════════════════════════════════════════════════════════
 * PHILOSOPHY
 * ═══════════════════════════════════════════════════════════════════
 *
 * Every piece of content has TWO layers:
 *
 *   1. GENERATION LAYER  — HOW the content is created
 *      Source → Arbitration → Enrichment → Quality → Storage
 *      Driven by: exam, topic, cohort signals, Wolfram, RAG
 *
 *   2. PRESENTATION LAYER — HOW the content is shown to each customer
 *      Driven by: customer role, emotional state, channel, device,
 *                 mastery level, time pressure, interaction history
 *
 * The same underlying content item (e.g. "Electromagnetic Induction MCQ Set")
 * renders DIFFERENTLY for:
 *   - A student at 11pm 3 days before GATE  → compact, calming, formula-first
 *   - A student who just scored 80%         → challenging, upbeat, extension problems
 *   - A teacher preparing class material    → editable, with pedagogy notes
 *   - A parent checking on child's progress → plain English, progress summary
 *   - CEO Giri monitoring content quality   → KPI overlay, engagement heatmap
 *
 * ═══════════════════════════════════════════════════════════════════
 * ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════════
 *
 *  ┌─────────────────────────────────────────────────────┐
 *  │              ContentFramework                       │
 *  │                                                     │
 *  │  ┌─────────────┐    ┌───────────────────────────┐  │
 *  │  │ Generation  │    │     Presentation          │  │
 *  │  │  Pipeline   │    │       Engine              │  │
 *  │  │             │    │                           │  │
 *  │  │ Source      │    │  CustomerProfile          │  │
 *  │  │ Arbitration │───▶│  PresentationContext      │  │
 *  │  │ Enrichment  │    │  AdaptationRules          │  │
 *  │  │ Quality     │    │  RenderDirective          │  │
 *  │  │ Storage     │    │                           │  │
 *  │  └─────────────┘    └───────────────────────────┘  │
 *  │                                                     │
 *  │  ┌─────────────────────────────────────────────┐   │
 *  │  │          Content Atom (canonical)           │   │
 *  │  │  raw content + metadata + quality scores    │   │
 *  │  └─────────────────────────────────────────────┘   │
 *  └─────────────────────────────────────────────────────┘
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ═══════════════════════════════════════════════════════════════════
// SECTION 1 — CUSTOMER PROFILES
// ═══════════════════════════════════════════════════════════════════

/**
 * Every person interacting with EduGenius has a CustomerRole.
 * This drives the entire presentation layer.
 */
export type CustomerRole =
  | 'student'          // preparing for an exam
  | 'teacher'          // teaching or upskilling
  | 'parent'           // monitoring a child
  | 'ceo'              // Giri — platform metrics + content quality
  | 'admin'            // content moderation + configuration
  | 'guest';           // unauthenticated visitor

/**
 * Learning moment — what the customer is trying to do RIGHT NOW.
 * More granular than role; changes within a session.
 */
export type LearningMoment =
  // Student moments
  | 'first_encounter'        // seeing this topic for the first time
  | 'building_concept'       // mid-way through learning the concept
  | 'practice_session'       // solving problems
  | 'doubt_resolution'       // stuck on something specific
  | 'quick_revision'         // exam is soon, scanning key points
  | 'exam_day'               // literally exam day
  // Teacher moments
  | 'lesson_planning'        // preparing a class
  | 'classroom_delivery'     // presenting during a class
  | 'student_review'         // reviewing student performance
  // Parent moments
  | 'progress_check'         // seeing how child is doing
  // CEO/Admin moments
  | 'content_audit'          // reviewing content quality
  | 'performance_review';    // looking at platform KPIs

/**
 * Customer context — everything known about this person right now.
 * Assembled from: auth session, persona engine, behavioural signals, Oracle data.
 */
export interface CustomerProfile {
  // Identity
  uid: string;
  name: string;
  role: CustomerRole;

  // Exam context (relevant for student/teacher)
  examId?: string;
  examName?: string;
  daysToExam?: number;

  // Learning context
  moment: LearningMoment;
  currentTopic?: string;
  masteryPct?: number;          // 0–100 for current topic
  sessionDurationMin?: number;  // how long they've been active
  questionsThisSession?: number;

  // Emotional + cognitive state
  emotionalState?: 'confident' | 'anxious' | 'frustrated' | 'motivated' | 'exhausted' | 'neutral';
  cognitiveLoad?: 'low' | 'medium' | 'high' | 'overloaded';

  // Channel + device
  channel: 'web' | 'whatsapp' | 'telegram' | 'mobile_web' | 'widget';
  deviceType: 'desktop' | 'mobile' | 'tablet';

  // Performance signals
  recentScore?: number;         // last mock/practice score (%)
  streak?: number;              // study streak in days
  weakTopics?: string[];
  strongTopics?: string[];

  // Preferences (learned)
  prefersShortContent?: boolean;
  prefersAnalogies?: boolean;
  language: 'english' | 'hindi' | 'tamil' | 'telugu' | 'mixed';
  nativeLanguageStrength: 'full_english' | 'mixed_ok' | 'vernacular_preferred';
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 2 — CONTENT ATOM (canonical representation)
// ═══════════════════════════════════════════════════════════════════

/**
 * A ContentAtom is the raw, canonical form of a piece of content.
 * It is generated once and presented differently to each customer.
 */
export type ContentAtomType =
  | 'mcq'                // single MCQ with explanation
  | 'lesson_block'       // a section of lesson notes
  | 'worked_example'     // a solved problem with steps
  | 'formula_card'       // a formula with intuition
  | 'analogy'            // an analogy explaining a concept
  | 'flashcard'          // Q&A pair for spaced repetition
  | 'misconception'      // common wrong belief + correction
  | 'exam_tip'           // exam technique / shortcut
  | 'concept_map'        // relationship between concepts
  | 'practice_set'       // collection of MCQs
  | 'summary'            // condensed overview
  | 'blog_post'          // long-form SEO content
  | 'visual_explainer';  // diagram description + walkthrough

export interface ContentAtom {
  id: string;
  type: ContentAtomType;

  // Two-layer generation model
  layer?: 'mandatory' | 'personalized';  // which generation layer produced this
  generationIntent?: string;              // e.g. 'mandatory:concept_core' or 'personalized:visual:exam_readiness'

  // Content fields (raw — before presentation transformation)
  title: string;
  body: string;                 // main content text
  bodyMarkdown?: string;        // markdown version (for rich rendering)
  supplementary?: string;       // extra depth, hints, extensions

  // For MCQ atoms
  mcq?: {
    question: string;
    options: { A: string; B: string; C: string; D: string };
    correct: 'A' | 'B' | 'C' | 'D';
    explanation: string;
    commonWrongAnswer: 'A' | 'B' | 'C' | 'D';   // for targeted feedback
    examTip?: string;                             // what distinguishes this in exam
  };

  // For formula cards
  formula?: {
    latex: string;              // LaTeX expression
    plainText: string;          // text fallback
    intuition: string;          // why does this formula work?
    whenToUse: string;
    pitfalls: string[];
  };

  // Metadata
  examId: string;
  topic: string;
  subTopic?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  syllabusPriority: 'high' | 'medium' | 'low';  // based on PYQ frequency

  // Quality scores (set by Oracle/quality pipeline)
  quality: {
    accuracy: number;           // 0–1 (Wolfram-verified or manually checked)
    clarity: number;            // 0–1 (readability score)
    examRelevance: number;      // 0–1 (based on PYQ frequency)
    engagementScore: number;    // 0–1 (from student interaction data)
    wolframVerified: boolean;
    reviewedByHuman: boolean;
  };

  // Generation metadata
  generatedBy: 'atlas' | 'sage' | 'wolfram' | 'human' | 'hybrid';
  generatedAt: Date;
  sourceType: 'llm' | 'wolfram' | 'document' | 'pyq' | 'manual';
  version: number;

  // Usage analytics
  timesServed: number;
  avgRating: number;             // 1–5 from student feedback
  completionRate: number;        // % of students who finished it
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 3 — PRESENTATION CONTEXT & DIRECTIVES
// ═══════════════════════════════════════════════════════════════════

/**
 * PresentationContext — everything needed to decide HOW to render content.
 */
export interface PresentationContext {
  customer: CustomerProfile;
  contentAtom: ContentAtom;
  renderSurface: 'card' | 'fullpage' | 'chat_bubble' | 'whatsapp_message' | 'widget' | 'pdf';
  showMetadata: boolean;      // teachers/CEO see metadata; students don't
}

/**
 * RenderDirective — computed instructions for the UI layer.
 * Generated by `resolvePresentation()` and consumed by React components.
 */
export interface RenderDirective {
  // What to show
  displayTitle: string;            // possibly rewritten for the customer
  displayBody: string;             // transformed body text
  showFormula: boolean;
  showExplanation: boolean;
  showExamTip: boolean;
  showMisconceptionWarning: boolean;
  showDifficultyBadge: boolean;
  showQualityBadge: boolean;       // CEO/admin only
  showPedagogyNote: boolean;       // teacher only
  showProgressHint: boolean;       // student: "You've seen 3/10 topics in this chapter"

  // How to style it
  tone: 'encouraging' | 'calm' | 'upbeat' | 'neutral' | 'urgent' | 'authoritative';
  density: 'minimal' | 'compact' | 'standard' | 'rich';
  highlightLevel: 'none' | 'key_terms' | 'full';
  useEmoji: boolean;
  mathRenderMode: 'latex' | 'plaintext' | 'none';  // mobile/WhatsApp → plaintext

  // Interaction design
  primaryCTA: CTAConfig | null;
  secondaryCTA: CTAConfig | null;
  feedbackWidget: boolean;
  nextContentSuggestion: boolean;

  // Cognitive scaffolding
  prefaceText?: string;            // shown BEFORE content (e.g. "You got Q3 wrong last time...")
  closingText?: string;            // shown AFTER content (e.g. "Try the next level?")
  hintAvailable: boolean;
  progressBarConfig?: { current: number; total: number; label: string };

  // Channel adaptations
  whatsappSafe: boolean;           // no markdown, no LaTeX, emoji-friendly
  characterBudget?: number;        // WhatsApp: ~900 chars, Telegram: 4096
}

export interface CTAConfig {
  label: string;
  action: 'next_question' | 'try_harder' | 'get_hint' | 'practice_more' |
          'ask_sage' | 'view_formula' | 'mark_done' | 'save_flashcard' |
          'share' | 'download_pdf' | 'edit_content' | 'view_analytics';
  variant: 'primary' | 'secondary' | 'ghost';
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 4 — ADAPTATION RULES
// ═══════════════════════════════════════════════════════════════════

/**
 * These rules encode how the presentation layer adapts for each customer.
 * They are evaluated in order; first match wins per property.
 */

function adaptTone(profile: CustomerProfile): RenderDirective['tone'] {
  if (profile.emotionalState === 'anxious' || profile.emotionalState === 'frustrated') return 'calm';
  if (profile.emotionalState === 'motivated' || profile.emotionalState === 'confident') return 'upbeat';
  if (profile.emotionalState === 'exhausted') return 'calm';
  if (profile.moment === 'exam_day') return 'urgent';
  if (profile.role === 'ceo' || profile.role === 'admin') return 'authoritative';
  if (profile.role === 'teacher') return 'neutral';
  if (profile.moment === 'first_encounter') return 'encouraging';
  return 'neutral';
}

function adaptDensity(profile: CustomerProfile, atom: ContentAtom): RenderDirective['density'] {
  // Overloaded students get minimal content
  if (profile.cognitiveLoad === 'overloaded') return 'minimal';
  if (profile.moment === 'exam_day') return 'compact';
  if (profile.moment === 'quick_revision') return 'compact';
  // WhatsApp always compact
  if (profile.channel === 'whatsapp' || profile.channel === 'telegram') return 'compact';
  // Mobile: compact unless tablet
  if (profile.deviceType === 'mobile') return 'compact';
  // Teachers and CEO get full rich view
  if (profile.role === 'teacher' || profile.role === 'ceo' || profile.role === 'admin') return 'rich';
  // Practice session: standard
  if (profile.moment === 'practice_session') return 'standard';
  // Lesson building: standard
  if (profile.moment === 'building_concept') return 'standard';
  return 'standard';
}

function adaptMathRender(profile: CustomerProfile): RenderDirective['mathRenderMode'] {
  if (profile.channel === 'whatsapp') return 'plaintext';  // WhatsApp can't render LaTeX
  if (profile.channel === 'telegram') return 'plaintext';  // Telegram basic mode
  if (profile.deviceType === 'mobile' && profile.channel !== 'widget') return 'latex'; // KaTeX works on mobile web
  return 'latex';
}

function buildPrefaceText(profile: CustomerProfile, atom: ContentAtom): string | undefined {
  // Returning student with previous performance data
  if (profile.moment === 'doubt_resolution' && profile.currentTopic === atom.topic) {
    return `You've been working on ${atom.topic}. Let me help you clear this up.`;
  }
  if (profile.moment === 'quick_revision' && profile.daysToExam !== undefined && profile.daysToExam <= 7) {
    return `${profile.daysToExam} day${profile.daysToExam === 1 ? '' : 's'} to go. Focus on what matters most.`;
  }
  if (profile.emotionalState === 'frustrated') {
    return `It's okay — this topic trips up a lot of students. Let's break it down simply.`;
  }
  if (profile.emotionalState === 'anxious' && profile.moment === 'exam_day') {
    return `You've prepared for this. Let's do a quick confidence check.`;
  }
  if (profile.moment === 'first_encounter') {
    return `First time with this topic? Let's build it from scratch.`;
  }
  return undefined;
}

function buildClosingText(profile: CustomerProfile, atom: ContentAtom): string | undefined {
  if (profile.role === 'student') {
    if (profile.emotionalState === 'motivated') {
      return `Feeling good? Try the harder version below. 💪`;
    }
    if (profile.moment === 'quick_revision') {
      return `Quick check: can you recall the key formula without looking?`;
    }
    if (atom.type === 'mcq' && profile.moment === 'practice_session') {
      return `How did that feel? Rate it to help us send you better questions.`;
    }
    if (profile.moment === 'exam_day') {
      return `Trust your preparation. You know this.`;
    }
  }
  if (profile.role === 'teacher') {
    return `Pedagogy note: Students most commonly confuse ${atom.mcq?.commonWrongAnswer ?? 'option B'} with the correct answer. Address this proactively.`;
  }
  return undefined;
}

function buildPrimaryCtA(profile: CustomerProfile, atom: ContentAtom): CTAConfig | null {
  if (profile.role === 'student') {
    if (atom.type === 'mcq' || atom.type === 'practice_set') return { label: 'Next Question →', action: 'next_question', variant: 'primary' };
    if (atom.type === 'lesson_block') return { label: 'Practice This', action: 'practice_more', variant: 'primary' };
    if (atom.type === 'formula_card') return { label: 'Practice Problems', action: 'practice_more', variant: 'primary' };
    if (atom.type === 'flashcard') return { label: 'Got It ✓', action: 'mark_done', variant: 'primary' };
    if (profile.emotionalState === 'frustrated') return { label: 'Ask Sage to Explain', action: 'ask_sage', variant: 'primary' };
  }
  if (profile.role === 'teacher') {
    return { label: 'Edit for My Class', action: 'edit_content', variant: 'primary' };
  }
  if (profile.role === 'ceo' || profile.role === 'admin') {
    return { label: 'View Analytics', action: 'view_analytics', variant: 'primary' };
  }
  return null;
}

function buildSecondaryCtA(profile: CustomerProfile, atom: ContentAtom): CTAConfig | null {
  if (profile.role === 'student') {
    if (profile.moment === 'doubt_resolution') return { label: '💡 Get Hint', action: 'get_hint', variant: 'secondary' };
    if (atom.type === 'formula_card') return { label: 'Save Flashcard', action: 'save_flashcard', variant: 'secondary' };
    if (atom.type === 'lesson_block') return { label: 'Ask Sage', action: 'ask_sage', variant: 'secondary' };
  }
  if (profile.role === 'teacher') {
    return { label: 'Download PDF', action: 'download_pdf', variant: 'secondary' };
  }
  return null;
}

function rewriteTitleForCustomer(title: string, profile: CustomerProfile): string {
  // Parent: make it plain English
  if (profile.role === 'parent') {
    // Strip exam jargon from title
    return title.replace(/\(GATE\)|MCQ Set|PYQ/gi, '').trim() + ' — Learning Progress';
  }
  // Exam-day student: add urgency framing
  if (profile.moment === 'exam_day') {
    return '⚡ ' + title;
  }
  // First encounter student: add welcoming framing
  if (profile.moment === 'first_encounter') {
    return title + ' — From Scratch';
  }
  return title;
}

function transformBodyForChannel(body: string, profile: CustomerProfile, density: RenderDirective['density']): string {
  let transformed = body;

  // WhatsApp: strip markdown, shorten
  if (profile.channel === 'whatsapp') {
    transformed = transformed
      .replace(/\*\*(.*?)\*\*/g, '*$1*')   // bold → WhatsApp bold
      .replace(/#{1,6}\s/g, '')             // remove markdown headers
      .replace(/`([^`]+)`/g, '"$1"')        // code → quotes
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // strip links
  }

  // Compact mode: truncate to ~500 chars, add ellipsis
  if (density === 'compact' && transformed.length > 500) {
    const truncate = transformed.slice(0, 480);
    const lastPeriod = truncate.lastIndexOf('.');
    transformed = (lastPeriod > 300 ? truncate.slice(0, lastPeriod + 1) : truncate) + '…';
  }

  // Minimal mode: first paragraph only
  if (density === 'minimal') {
    const firstPara = transformed.split('\n\n')[0];
    transformed = firstPara;
  }

  // Parent: simplify language (heuristic replacements)
  if (profile.role === 'parent') {
    transformed = transformed
      .replace(/eigenvalue/gi, 'a key mathematical value')
      .replace(/Laplace transform/gi, 'a mathematical tool')
      .replace(/differentiation/gi, 'rate of change calculation')
      .replace(/integration/gi, 'area calculation')
      .replace(/\bEM\b/g, 'Electromagnetism');
  }

  return transformed;
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 5 — CORE RESOLVER
// ═══════════════════════════════════════════════════════════════════

/**
 * resolvePresentation()
 *
 * THE main function. Takes a ContentAtom + CustomerProfile and returns
 * a RenderDirective that tells the UI exactly how to display the content.
 *
 * This is called by every content component before rendering.
 */
export function resolvePresentation(ctx: PresentationContext): RenderDirective {
  const { customer, contentAtom: atom, renderSurface } = ctx;

  const tone = adaptTone(customer);
  const density = adaptDensity(customer, atom);
  const mathRenderMode = adaptMathRender(customer);
  const prefaceText = buildPrefaceText(customer, atom);
  const closingText = buildClosingText(customer, atom);
  const primaryCTA = buildPrimaryCtA(customer, atom);
  const secondaryCTA = buildSecondaryCtA(customer, atom);
  const displayTitle = rewriteTitleForCustomer(atom.title, customer);
  const displayBody = transformBodyForChannel(
    density === 'minimal' && atom.supplementary ? atom.body : atom.bodyMarkdown ?? atom.body,
    customer,
    density,
  );

  const isStudent = customer.role === 'student';
  const isTeacher = customer.role === 'teacher';
  const isCEO = customer.role === 'ceo' || customer.role === 'admin';
  const isParent = customer.role === 'parent';
  const isMessaging = customer.channel === 'whatsapp' || customer.channel === 'telegram';

  return {
    displayTitle,
    displayBody,
    showFormula: atom.formula !== undefined && mathRenderMode !== 'none',
    showExplanation: density !== 'minimal' && (isStudent || isTeacher),
    showExamTip: isStudent && atom.mcq?.examTip !== undefined && density !== 'minimal',
    showMisconceptionWarning: isStudent && atom.type === 'misconception',
    showDifficultyBadge: isStudent || isTeacher,
    showQualityBadge: isCEO,
    showPedagogyNote: isTeacher,
    showProgressHint: isStudent && customer.masteryPct !== undefined,

    tone,
    density,
    highlightLevel: density === 'rich' ? 'full' : density === 'standard' ? 'key_terms' : 'none',
    useEmoji: isStudent && !isCEO && density !== 'rich',
    mathRenderMode,

    primaryCTA,
    secondaryCTA,
    feedbackWidget: isStudent && !isMessaging && renderSurface !== 'pdf',
    nextContentSuggestion: isStudent && renderSurface === 'card',

    prefaceText,
    closingText,
    hintAvailable: isStudent && atom.type === 'mcq',
    progressBarConfig: isStudent && customer.masteryPct !== undefined
      ? { current: customer.masteryPct, total: 100, label: `${atom.topic} mastery` }
      : undefined,

    whatsappSafe: isMessaging,
    characterBudget: customer.channel === 'whatsapp' ? 900 : customer.channel === 'telegram' ? 4096 : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 6 — GENERATION PIPELINE
// ═══════════════════════════════════════════════════════════════════

/**
 * GenerationSpec — what to generate and for whom.
 * This feeds into the generation pipeline.
 */
export interface GenerationSpec {
  // What to generate
  atomType: ContentAtomType;
  examId: string;
  examName: string;
  topic: string;
  subTopic?: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  count: number;

  // Customer context (influences HOW it's generated, not just presented)
  targetCustomer: CustomerProfile;

  // Generation config
  forceWolframGrounding: boolean;    // for math/science atoms
  useRagContext: boolean;             // inject PYQ/course context
  useCohortSignals: boolean;          // inject what other students got wrong
  includeCommonMistakes: boolean;     // for MCQ wrong-answer design

  // Quality thresholds
  minAccuracyScore: number;           // 0–1, default 0.8
  minClarityScore: number;            // 0–1, default 0.7
  requireExamTip: boolean;

  // Persona overrides (if known)
  targetLearningStyle?: string;
  targetObjective?: string;
  targetCognitiveTier?: string;
}

/**
 * GenerationResult — what comes out of the pipeline.
 */
export interface GenerationResult {
  atoms: ContentAtom[];
  generationId: string;
  spec: GenerationSpec;
  pipelineLog: PipelineStepLog[];
  totalTokensUsed: number;
  qualityPassed: boolean;
  failedAtoms: number;
}

export interface PipelineStepLog {
  step: 'source' | 'arbitration' | 'enrichment' | 'quality' | 'storage';
  status: 'ok' | 'warn' | 'fail';
  durationMs: number;
  detail: string;
}

/**
 * ContentGenerationPipeline — orchestrates the full generation flow.
 *
 * Steps:
 *   1. Source      — decide where content comes from (LLM / Wolfram / document / PYQ)
 *   2. Prompt      — assemble the persona-aware prompt via contentPersonaEngine
 *   3. Generate    — call LLM (Gemini via llmService)
 *   4. Enrich      — Wolfram verification, RAG grounding, cohort signal injection
 *   5. Quality     — score accuracy, clarity, exam relevance
 *   6. Transform   — structure raw output into ContentAtom schema
 *   7. Store       — persist to content store for serving
 */
export class ContentGenerationPipeline {

  /**
   * run() — entry point for generation.
   * Takes a GenerationSpec and returns GenerationResult.
   */
  async run(spec: GenerationSpec): Promise<GenerationResult> {
    const generationId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const log: PipelineStepLog[] = [];
    const atoms: ContentAtom[] = [];
    let totalTokens = 0;

    // Step 1: Source arbitration
    const t1 = Date.now();
    const sourcePath = this.arbitrateSource(spec);
    log.push({ step: 'source', status: 'ok', durationMs: Date.now() - t1, detail: `Path: ${sourcePath}` });

    // Step 2: Build generation prompt (persona-aware)
    const t2 = Date.now();
    const prompt = this.buildGenerationPrompt(spec, sourcePath);
    log.push({ step: 'arbitration', status: 'ok', durationMs: Date.now() - t2, detail: `Prompt: ${prompt.length} chars` });

    // Step 3–7: Generate + enrich + quality + transform
    // In production: call LLM here via llmService
    // For now: return scaffold with metadata wired correctly
    for (let i = 0; i < spec.count; i++) {
      const atom = this.scaffoldAtom(spec, i, generationId);
      atoms.push(atom);
      totalTokens += 1500; // approximate
    }

    const qualityPassed = atoms.every(a => a.quality.accuracy >= spec.minAccuracyScore);

    return {
      atoms,
      generationId,
      spec,
      pipelineLog: log,
      totalTokensUsed: totalTokens,
      qualityPassed,
      failedAtoms: atoms.filter(a => a.quality.accuracy < spec.minAccuracyScore).length,
    };
  }

  private arbitrateSource(spec: GenerationSpec): 'wolfram' | 'rag' | 'llm' | 'pyq' {
    const mathTopics = ['calculus', 'algebra', 'physics', 'circuit', 'control', 'signal', 'thermodynamics', 'electromagnetism'];
    const isMath = mathTopics.some(t => spec.topic.toLowerCase().includes(t));
    if (spec.forceWolframGrounding || isMath) return 'wolfram';
    if (spec.useRagContext) return 'rag';
    return 'llm';
  }

  private buildGenerationPrompt(spec: GenerationSpec, sourcePath: string): string {
    const { targetCustomer: c, atomType, examName, topic, difficulty } = spec;

    const personaDirective = c.emotionalState === 'frustrated'
      ? 'The student is frustrated. Generate content that is extremely clear, step-by-step, and confidence-building.'
      : c.moment === 'exam_day'
      ? 'Exam day context. Be ultra-concise and high-signal. No padding.'
      : c.moment === 'first_encounter'
      ? 'First exposure to this concept. Build from first principles with a real-world hook.'
      : '';

    const cohortDirective = spec.useCohortSignals
      ? `Common mistakes by students on this topic: incorporate these as distractors/warnings.`
      : '';

    const wolframDirective = sourcePath === 'wolfram'
      ? `This is a mathematical/science topic. All formulas and numerical values must be Wolfram-verified.`
      : '';

    return [
      `Generate a ${atomType} for ${examName} on topic: "${topic}".`,
      `Difficulty: ${difficulty}.`,
      `Count: ${spec.count} items.`,
      personaDirective,
      cohortDirective,
      wolframDirective,
      spec.requireExamTip ? 'Include a specific exam technique for each item.' : '',
      spec.includeCommonMistakes ? 'Design wrong answers to target real student misconceptions.' : '',
    ].filter(Boolean).join('\n');
  }

  private scaffoldAtom(spec: GenerationSpec, index: number, generationId: string): ContentAtom {
    const now = new Date();
    return {
      id: `${generationId}_${index}`,
      type: spec.atomType,
      title: `${spec.topic} — ${spec.atomType} #${index + 1}`,
      body: `[Generated content for ${spec.examName} · ${spec.topic} · ${spec.difficulty}]`,
      bodyMarkdown: `**${spec.topic}**\n\n[Content generated by Atlas]`,
      examId: spec.examId,
      topic: spec.topic,
      subTopic: spec.subTopic,
      difficulty: spec.difficulty === 'mixed' ? 'medium' : spec.difficulty,
      syllabusPriority: 'high',
      quality: {
        accuracy: 0.9,
        clarity: 0.85,
        examRelevance: 0.88,
        engagementScore: 0,
        wolframVerified: spec.forceWolframGrounding,
        reviewedByHuman: false,
      },
      generatedBy: spec.forceWolframGrounding ? 'wolfram' : 'atlas',
      generatedAt: now,
      sourceType: spec.forceWolframGrounding ? 'wolfram' : spec.useRagContext ? 'document' : 'llm',
      version: 1,
      timesServed: 0,
      avgRating: 0,
      completionRate: 0,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 7 — CUSTOMER PROFILE BUILDER
// ═══════════════════════════════════════════════════════════════════

/**
 * buildCustomerProfile()
 *
 * Assembles a CustomerProfile from all available signals.
 * Called at session start and updated on significant events.
 */
export function buildCustomerProfile(raw: {
  uid: string;
  name: string;
  role: CustomerRole;
  examId?: string;
  examName?: string;
  daysToExam?: number;
  channel?: CustomerProfile['channel'];
  deviceType?: CustomerProfile['deviceType'];
  emotionalState?: CustomerProfile['emotionalState'];
  masteryPct?: number;
  recentScore?: number;
  streak?: number;
  weakTopics?: string[];
  strongTopics?: string[];
  currentTopic?: string;
  sessionDurationMin?: number;
  questionsThisSession?: number;
  language?: CustomerProfile['language'];
  prefersShortContent?: boolean;
}): CustomerProfile {
  // Infer learning moment from context
  const moment = inferLearningMoment(raw);

  // Infer cognitive load from session signals
  const cognitiveLoad = inferCognitiveLoad(raw);

  // Infer native language strength
  const nativeLanguageStrength: CustomerProfile['nativeLanguageStrength'] =
    raw.language === 'english' ? 'full_english' :
    raw.language === 'mixed' ? 'mixed_ok' : 'vernacular_preferred';

  return {
    uid: raw.uid,
    name: raw.name,
    role: raw.role,
    examId: raw.examId,
    examName: raw.examName,
    daysToExam: raw.daysToExam,
    moment,
    currentTopic: raw.currentTopic,
    masteryPct: raw.masteryPct,
    sessionDurationMin: raw.sessionDurationMin ?? 0,
    questionsThisSession: raw.questionsThisSession ?? 0,
    emotionalState: raw.emotionalState ?? 'neutral',
    cognitiveLoad,
    channel: raw.channel ?? 'web',
    deviceType: raw.deviceType ?? 'desktop',
    recentScore: raw.recentScore,
    streak: raw.streak ?? 0,
    weakTopics: raw.weakTopics ?? [],
    strongTopics: raw.strongTopics ?? [],
    prefersShortContent: raw.prefersShortContent ?? false,
    prefersAnalogies: false,
    language: raw.language ?? 'english',
    nativeLanguageStrength,
  };
}

function inferLearningMoment(raw: {
  role: CustomerRole;
  daysToExam?: number;
  masteryPct?: number;
  questionsThisSession?: number;
  emotionalState?: CustomerProfile['emotionalState'];
}): LearningMoment {
  if (raw.role === 'teacher') return 'lesson_planning';
  if (raw.role === 'parent') return 'progress_check';
  if (raw.role === 'ceo' || raw.role === 'admin') return 'content_audit';

  // Student moments
  if (raw.daysToExam !== undefined && raw.daysToExam === 0) return 'exam_day';
  if (raw.daysToExam !== undefined && raw.daysToExam <= 7) return 'quick_revision';
  if (raw.emotionalState === 'frustrated') return 'doubt_resolution';
  if (raw.masteryPct !== undefined && raw.masteryPct < 20) return 'first_encounter';
  if (raw.masteryPct !== undefined && raw.masteryPct >= 20 && raw.masteryPct < 70) return 'building_concept';
  if (raw.questionsThisSession !== undefined && raw.questionsThisSession > 5) return 'practice_session';
  return 'building_concept';
}

function inferCognitiveLoad(raw: {
  sessionDurationMin?: number;
  questionsThisSession?: number;
  emotionalState?: CustomerProfile['emotionalState'];
  daysToExam?: number;
}): CustomerProfile['cognitiveLoad'] {
  if (raw.emotionalState === 'exhausted') return 'overloaded';
  if (raw.daysToExam === 0) return 'high';
  if ((raw.sessionDurationMin ?? 0) > 120) return 'high';
  if ((raw.questionsThisSession ?? 0) > 20) return 'medium';
  return 'low';
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 8 — CONVENIENCE EXPORTS
// ═══════════════════════════════════════════════════════════════════

/** Singleton pipeline instance */
export const contentPipeline = new ContentGenerationPipeline();

/**
 * Quick helper: build profile + resolve presentation in one call.
 * Used by React components.
 */
export function getContentDirective(
  atom: ContentAtom,
  profileRaw: Parameters<typeof buildCustomerProfile>[0],
  renderSurface: PresentationContext['renderSurface'] = 'card',
): RenderDirective {
  const customer = buildCustomerProfile(profileRaw);
  return resolvePresentation({ customer, contentAtom: atom, renderSurface, showMetadata: false });
}

/** Role-based visibility gate */
export function canSeeContent(role: CustomerRole, atomType: ContentAtomType): boolean {
  const studentTypes: ContentAtomType[] = ['mcq', 'flashcard', 'worked_example', 'formula_card', 'analogy', 'summary', 'exam_tip', 'misconception', 'visual_explainer'];
  const teacherTypes: ContentAtomType[] = [...studentTypes, 'lesson_block', 'concept_map', 'practice_set', 'blog_post'];
  const ceoTypes: ContentAtomType[] = [...teacherTypes]; // all

  if (role === 'student') return studentTypes.includes(atomType);
  if (role === 'teacher') return teacherTypes.includes(atomType);
  if (role === 'ceo' || role === 'admin') return ceoTypes.includes(atomType);
  if (role === 'parent') return ['summary', 'concept_map'].includes(atomType);
  return false;
}