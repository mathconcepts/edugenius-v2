/**
 * contentPersonaEngine.ts — Hyper-Personalized Prompt Template Engine
 *
 * Generates tailored content prompts based on:
 *   - Learning Style: visual, analytical, story-driven, practice-first, auditory
 *   - Learning Objective: conceptual_understanding, exam_readiness, quick_revision,
 *                         skill_building, doubt_clearing, competitive_edge
 *   - Cognitive Load: low (has time), medium, high (stressed), overloaded (exam-day)
 *   - Content Format: mcq_set, lesson_notes, flashcard_set, worked_example, formula_sheet,
 *                     analogy_explainer, visual_diagram_text, blog_post, cheatsheet
 *   - Exam Context: exam name, topic, difficulty, syllabus position
 *   - Cohort Signal: what other students struggle with on this topic
 *
 * Template resolution order (most specific wins):
 *   exam × topic × style × objective → full template
 *   exam × style × objective         → exam-level template
 *   style × objective                → generic template
 *   objective only                   → base template
 */

import { loadPersona } from './studentPersonaEngine';
import { resolveActiveExam } from './userService';
import type { EGUser } from './userService';
import { resolveTemplate } from './templateRegistry';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LearningStyle =
  | 'visual'           // learns via diagrams, spatial analogies, tables
  | 'analytical'       // wants proof/derivation first, then intuition
  | 'story_driven'     // narrative framing ("imagine you're a photon...")
  | 'practice_first'   // example before theory
  | 'auditory'         // conversational, dialogue-style explanation
  | 'unknown';         // adapt based on engagement

export type LearningObjective =
  | 'conceptual_understanding'  // WHY does this work?
  | 'exam_readiness'            // HOW to answer this in exam conditions?
  | 'quick_revision'            // 5-min refresh before exam
  | 'skill_building'            // build long-term ability
  | 'doubt_clearing'            // student is confused, needs targeted fix
  | 'competitive_edge';         // tricky edge cases, topper-level knowledge

export type CognitiveTier =
  | 'foundational'     // first exposure to concept
  | 'developing'       // understands basics, building depth
  | 'proficient'       // solid understanding, needs exam application
  | 'advanced';        // ready for edge cases and derivations

export type ContentPersonaFormat =
  | 'mcq_set'
  | 'lesson_notes'
  | 'flashcard_set'
  | 'worked_example'
  | 'formula_sheet'
  | 'analogy_explainer'    // explains via analogy
  | 'visual_diagram_text'  // ASCII/text diagrams + spatial walkthrough
  | 'cheatsheet'           // compact exam cheatsheet
  | 'blog_post'
  | 'doubt_resolution';    // targeted answer to specific doubt

export interface PersonaContext {
  // Student profile
  learningStyle: LearningStyle;
  objective: LearningObjective;
  cognitiveTier: CognitiveTier;
  cognitiveLoad: 'low' | 'medium' | 'high' | 'overloaded';
  streakDays: number;
  daysToExam: number;
  studyTimePattern: 'morning_bird' | 'afternoon' | 'night_owl' | 'late_night_crisis';

  // Exam context
  examId: string;
  examName: string;
  topic: string;
  topicWeight: number;       // 0–1 (how important for this exam)
  subTopic?: string;

  // Performance context
  topicMasteryPct: number;   // 0–100 from persistenceDB
  commonMistakes?: string[]; // from cohort signals (Oracle/Prism data)
  relatedWeakTopics?: string[];

  // Output spec
  format: ContentPersonaFormat;
  itemCount?: number;         // for mcq_set, flashcard_set
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';

  // Channel context
  channel: 'web' | 'whatsapp' | 'telegram' | 'widget';
}

export interface PersonaPromptTemplate {
  id: string;
  systemPrompt: string;
  userPromptTemplate: string;   // uses {{variable}} placeholders
  outputSchema?: string;        // JSON schema description for structured output
  qualityChecks: string[];      // things to validate post-generation
  estimatedTokens: number;
}

export interface RenderedPrompt {
  systemPrompt: string;
  userPrompt: string;
  templateId: string;
  personaContext: PersonaContext;
  estimatedTokens: number;
  /** Which registry key matched (for debug/analytics). undefined = no override. */
  templateKey?: string;
}

// ─── UI Label Maps ────────────────────────────────────────────────────────────

export const LEARNING_STYLE_LABELS: Record<LearningStyle, string> = {
  visual:        'Visual Learner',
  analytical:    'Analytical / Proof-Based',
  story_driven:  'Story & Narrative',
  practice_first:'Practice First',
  auditory:      'Conversational',
  unknown:       'Adaptive (Auto-Detect)',
};

export const OBJECTIVE_LABELS: Record<LearningObjective, string> = {
  conceptual_understanding: 'Conceptual Understanding',
  exam_readiness:           'Exam Readiness',
  quick_revision:           'Quick Revision',
  skill_building:           'Skill Building',
  doubt_clearing:           'Doubt Clearing',
  competitive_edge:         'Competitive Edge (Topper)',
};

export const COGNITIVE_TIER_LABELS: Record<CognitiveTier, string> = {
  foundational: 'Foundational (First Exposure)',
  developing:   'Developing (Building Depth)',
  proficient:   'Proficient (Exam-Ready)',
  advanced:     'Advanced (Edge Cases & Derivations)',
};

export const FORMAT_LABELS: Record<ContentPersonaFormat, string> = {
  mcq_set:            'MCQ Set',
  lesson_notes:       'Lesson Notes',
  flashcard_set:      'Flashcard Set',
  worked_example:     'Worked Example',
  formula_sheet:      'Formula Sheet',
  analogy_explainer:  'Analogy Explainer',
  visual_diagram_text:'Visual Diagram (Text)',
  cheatsheet:         'Exam Cheatsheet',
  blog_post:          'Blog Post',
  doubt_resolution:   'Doubt Resolution',
};

// ─── Directive Builders ───────────────────────────────────────────────────────

/**
 * Returns a style-specific instruction string to inject into the system prompt.
 */
export function buildLearningStyleDirective(style: LearningStyle, channel: string): string {
  const channelNote =
    channel === 'whatsapp' || channel === 'telegram'
      ? 'Channel limit: use text-based visuals only (no HTML/LaTeX).'
      : '';

  const directives: Record<LearningStyle, string> = {
    visual: [
      'STYLE: Visual learner. Use ASCII diagrams, tables, spatial analogies.',
      'Structure: show the "shape" of the concept before words.',
      'Use: before/after comparison, flow arrows (→), numbered diagrams.',
      channelNote,
    ].filter(Boolean).join('\n'),

    analytical: [
      'STYLE: Analytical learner. Lead with the mathematical proof or derivation.',
      'Structure: Axioms → Derivation → Result → Application.',
      'Show WHY before HOW. Trust their ability to follow rigorous logic.',
      'Include: variable definitions, boundary conditions, limiting cases.',
    ].join('\n'),

    story_driven: [
      'STYLE: Narrative learner. Frame concepts as stories with characters and cause-effect.',
      'Structure: Set the scene → Introduce the problem → Walk through as if it\'s happening → Reveal the principle.',
      'Use first-person situations: "Imagine you are an electron in a copper wire..."',
      'Avoid dry formula-first presentations.',
    ].join('\n'),

    practice_first: [
      'STYLE: Practice-first learner. Show a solved example BEFORE explaining theory.',
      'Structure: Here\'s a problem → Here\'s the solution (step-by-step) → HERE\'S why each step works.',
      'Let the example be the teacher. Theory is the footnote, not the headline.',
    ].join('\n'),

    auditory: [
      'STYLE: Conversational learner. Write as if speaking aloud.',
      'Structure: Short sentences. Natural rhythm. Ask questions as if in dialogue: "So what happens here? Well..."',
      'Use contractions, casual phrasing, and thinking-aloud moments.',
      'Avoid walls of text — use paragraph breaks like pauses.',
    ].join('\n'),

    unknown: [
      'STYLE: Adaptive — start with a one-sentence hook, give a brief worked example,',
      'then explain the underlying concept. This approach works for most learners.',
    ].join(' '),
  };

  return directives[style];
}

/**
 * Returns an objective-specific directive based on urgency and learning goal.
 */
export function buildObjectiveDirective(objective: LearningObjective, daysToExam: number): string {
  const urgency =
    daysToExam <= 7  ? 'EXAM IN <1 WEEK: '  :
    daysToExam <= 30 ? 'EXAM APPROACHING: ' : '';

  const directives: Record<LearningObjective, string> = {
    conceptual_understanding: [
      `${urgency}OBJECTIVE: Build deep conceptual understanding.`,
      'Focus: WHY it works, not just HOW.',
      'Include: intuitive explanation, common misconceptions corrected, real-world analogy.',
      'DO NOT: skip steps, use "obviously", assume prior knowledge.',
    ].join('\n'),

    exam_readiness: [
      `${urgency}OBJECTIVE: Maximize marks in exam conditions.`,
      'Focus: What examiners look for, fastest correct method, common traps to avoid.',
      'Include: key formula to memorize, 1-line shortcut, common wrong answers and why.',
      'Format every MCQ with: correct answer highlighted + trap option explained.',
    ].join('\n'),

    quick_revision: [
      `${urgency}OBJECTIVE: 5-minute rapid refresh before exam.`,
      'Format: Bullet points only. Max 3 bullets per concept. Bold key terms.',
      'Include: formula, 1 example, 1 common mistake. NO long explanations.',
      daysToExam <= 1 ? 'EXAM TOMORROW: ultra-condensed, confidence-building mode.' : '',
    ].filter(Boolean).join('\n'),

    skill_building: [
      'OBJECTIVE: Build lasting skill that transfers to unseen problems.',
      'Focus: generalized problem-solving approach, not topic-specific tricks.',
      'Include: how to recognize this problem type, general strategy, 2+ variations.',
      'Push student to derive, not just memorize.',
    ].join('\n'),

    doubt_clearing: [
      'OBJECTIVE: Resolve a specific confusion with surgical precision.',
      'Start by restating the likely source of confusion (without assuming).',
      'Address ONE thing at a time. Confirm understanding before moving on.',
      'End with: a check question that would reveal if the doubt is truly resolved.',
    ].join('\n'),

    competitive_edge: [
      'OBJECTIVE: Topper-level mastery — edge cases, proofs, highest-difficulty application.',
      'Include: derivations, boundary conditions, where the formula fails, JEE Advanced / GATE Level 3 variants.',
      'Treat student as an equal who can handle rigorous content.',
      'Include at least one problem where the "obvious" approach fails.',
    ].join('\n'),
  };

  return directives[objective];
}

/**
 * Returns a tier-specific directive calibrated by mastery percentage.
 */
export function buildCognitiveTierDirective(tier: CognitiveTier, masteryPct: number): string {
  const masteryNote =
    masteryPct > 0
      ? ` (student has demonstrated ${masteryPct}% mastery on this topic)`
      : '';

  const directives: Record<CognitiveTier, string> = {
    foundational: [
      `STUDENT LEVEL: Foundational${masteryNote}. This may be the student's first encounter with this concept.`,
      'Start from scratch — assume zero prior knowledge of this specific topic.',
      'Use the simplest possible language. Define every term before using it.',
      'Structure: What is it → Why does it exist → Simplest possible example → One practice item.',
      'Celebrate small wins: acknowledge when the student grasps each step.',
      'Never say "as you know" or "obviously". Nothing is obvious at this stage.',
    ].join('\n'),

    developing: [
      `STUDENT LEVEL: Developing${masteryNote}. Student understands the basics and is building depth.`,
      'Bridge from what they know to what they don\'t. Use known concepts as scaffolding.',
      'Structure: Quick recap of foundation → Bridge to new idea → Deepen with a twist → Practice variation.',
      'Acknowledge their progress: "You\'ve got the basics — now let\'s go one level deeper."',
      'Introduce slightly harder language but always pair with explanation.',
    ].join('\n'),

    proficient: [
      `STUDENT LEVEL: Proficient${masteryNote}. Student has solid understanding; focus on exam application.`,
      'Skip the basics — they know them. Go straight to exam-relevant application.',
      'Structure: Core principle (1 line) → Key exam formats this appears in → Edge cases → Timed practice.',
      'Push for speed and accuracy. Exam conditions apply.',
      'Include: common trap questions, negative marking strategy (if applicable), time-saving shortcuts.',
    ].join('\n'),

    advanced: [
      `STUDENT LEVEL: Advanced${masteryNote}. Student is ready for edge cases, derivations, and cross-topic mastery.`,
      'Treat them as a peer. Skip all scaffolding.',
      'Structure: State the non-obvious, derive rigorously, show where the standard formula breaks down.',
      'Include: counterexamples, cross-topic connections, "what if" boundary conditions.',
      'Challenge assumption: present a scenario where the student\'s likely intuition is WRONG.',
      'Reference: JEE Advanced, GATE Level 3, Olympiad-style variants as appropriate.',
    ].join('\n'),
  };

  return directives[tier];
}

/**
 * Returns exam-specific formatting and context rules.
 */
export function buildExamContextDirective(
  examId: string,
  topic: string,
  topicWeight: number,
  commonMistakes?: string[]
): string {
  // Exam-specific rules keyed by exam ID prefix
  const examRules: Record<string, string> = {
    'jee':  [
      'EXAM: JEE Main / Advanced.',
      'Format: MCQ with single correct and multiple correct variants. Negative marking applies (-1 for wrong).',
      'Level: IIT JEE difficulty. Students need speed AND accuracy.',
      'Emphasis: Derivation-based understanding + pattern recognition across Physics/Chemistry/Maths.',
      'Common JEE traps: dimensional analysis failures, sign errors in EMF, limiting reagent mistakes.',
    ].join('\n'),

    'neet': [
      'EXAM: NEET UG (Biology/Physics/Chemistry).',
      'Format: Single-correct MCQ, NCERT-based. Assertion-Reason format common.',
      'Level: NCERT + beyond. Standard textbook definitions carry full marks.',
      'Emphasis: Biology (60%) is dominant. Exact NCERT language matters for Biology answers.',
      'Common NEET traps: subtle NCERT phrasing differences, diagram-based questions.',
    ].join('\n'),

    'gate': [
      'EXAM: GATE (Graduate Aptitude Test in Engineering).',
      'Format: Numerical Answer Type (NAT) + MCQ. No negative marking for NAT.',
      'Level: Engineering fundamentals at B.Tech depth, often requiring derivation.',
      'GATE scoring: 1-mark and 2-mark questions. 2-mark wrong = -2/3 penalty.',
      'Emphasis: Conceptual clarity + numerical precision. Show all working steps.',
    ].join('\n'),

    'cat':  [
      'EXAM: CAT (Common Admission Test — MBA entrance).',
      'Format: MCQ + TITA (Type In The Answer). Reading Comprehension, VARC, DILR, QA.',
      'Time pressure is extreme: ~90 seconds per question max.',
      'Level: Speed and accuracy. Shortcut methods beat first-principles every time.',
      'Common CAT traps: lengthy RC passages with trap answer choices, DILR with misleading setup.',
    ].join('\n'),

    'upsc': [
      'EXAM: UPSC Civil Services (Prelims + Mains + Interview).',
      'Format: Prelims: MCQ. Mains: Essay/Descriptive (250-word, 150-word answers).',
      'Level: Multidimensional perspective required. No single-answer viewpoint.',
      'Emphasis: Current affairs integration + static syllabus linkage + analytical writing.',
      'UPSC style: structure answers with Introduction → Body (multiple dimensions) → Conclusion.',
    ].join('\n'),

    'cbse': [
      'EXAM: CBSE Board (Class 10 / 12).',
      'Format: Mix of MCQ, Short Answer (2-3 marks), Long Answer (5 marks). Show all working.',
      'Level: NCERT curriculum. Exact NCERT definitions score full marks.',
      'Emphasis: Step-by-step working shown. Even partially correct working earns partial marks.',
      'Common CBSE traps: skipping units, not showing intermediate steps, using formulas without derivation when asked.',
    ].join('\n'),

    'cuet': [
      'EXAM: CUET UG (Central University Entrance Test).',
      'Format: MCQ, 45 minutes per subject, 40 questions.',
      'Level: Class 12 NCERT + analytical reasoning.',
      'Emphasis: Speed and NCERT accuracy. Cross-subject linkage common in Language section.',
    ].join('\n'),
  };

  // Match exam ID to rule set (prefix match)
  const matchedKey = Object.keys(examRules).find(k => examId.toLowerCase().startsWith(k));
  const examRule = matchedKey ? examRules[matchedKey] : [
    `EXAM: ${examId}.`,
    'Apply standard competitive exam best practices: clear explanations, worked examples, accurate answers.',
  ].join('\n');

  const weightNote =
    topicWeight >= 0.7 ? `\nTOPIC WEIGHT: HIGH (${Math.round(topicWeight * 100)}% syllabus weight) — this topic appears frequently in exams. Prioritize thoroughly.` :
    topicWeight >= 0.4 ? `\nTOPIC WEIGHT: MEDIUM (${Math.round(topicWeight * 100)}% syllabus weight) — cover completely but not exhaustively.` :
    topicWeight > 0    ? `\nTOPIC WEIGHT: LOW (${Math.round(topicWeight * 100)}% syllabus weight) — brief but accurate coverage sufficient.` : '';

  const mistakesNote = commonMistakes?.length
    ? `\nCOHORT ERRORS ON "${topic}": Students commonly make these mistakes:\n${commonMistakes.map(m => `  • ${m}`).join('\n')}\nAddress these proactively in the content.`
    : '';

  return `${examRule}${weightNote}${mistakesNote}`;
}

/**
 * Returns channel-specific output formatting rules.
 */
export function buildChannelDirective(channel: string): string {
  const rules: Record<string, string> = {
    whatsapp: [
      'OUTPUT FORMAT: WhatsApp only.',
      'Use *bold* and _italic_ (no ## headers, no LaTeX, no code blocks).',
      'Keep under 800 chars per message. Use numbered lists.',
      'No tables — use line-separated lists instead.',
    ].join('\n'),

    telegram: [
      'OUTPUT FORMAT: Telegram.',
      'Use **bold**, _italic_, `code`. LaTeX not supported inline — write formulas in plain text.',
      'Headers: use emoji + text (e.g. "📌 Key Formula:") instead of ## markdown headers.',
      'Tables are acceptable if simple (pipe-separated).',
    ].join('\n'),

    widget: [
      'OUTPUT FORMAT: Embedded widget.',
      'Keep under 500 chars total. Max 3 bullet points. No headers.',
      'Single concept only. Link to full content for detail.',
    ].join('\n'),

    web: [
      'OUTPUT FORMAT: Web (full markdown).',
      'Use ## headers, LaTeX ($$...$$), code blocks, tables as needed.',
      'No character limit. Structure with clear sections.',
    ].join('\n'),
  };

  return rules[channel] ?? rules['web'];
}

/**
 * Returns output format instructions for the specific content format requested.
 */
export function buildFormatDirective(
  format: ContentPersonaFormat,
  itemCount?: number,
  difficulty?: string
): string {
  const n = itemCount ?? 10;
  const diff = difficulty ?? 'medium';

  const directives: Record<ContentPersonaFormat, string> = {
    mcq_set: [
      `FORMAT: Generate exactly ${n} MCQs (difficulty: ${diff}).`,
      'Each MCQ must include:',
      '  1. Question (clear, unambiguous)',
      '  2. Four options: A) B) C) D)',
      '  3. Correct answer: "Answer: X"',
      '  4. 2-sentence explanation (why correct + why each distractor is wrong)',
      '  5. Difficulty tag: [Easy / Medium / Hard]',
      'Do NOT repeat the same concept twice. Vary question types: numerical, conceptual, application.',
    ].join('\n'),

    lesson_notes: [
      'FORMAT: Structured lesson notes.',
      'Use this exact section order:',
      '  ## Overview (2–3 sentences: what this topic is and why it matters)',
      '  ## Core Concept (the fundamental idea, explained clearly)',
      '  ## Key Formula (formula + variable definitions + units)',
      '  ## Worked Example (1 complete solved problem with all steps)',
      '  ## Exam Tips (3–5 bullet points: what examiners test, common traps)',
      '  ## Quick Check (1 practice question + answer)',
    ].join('\n'),

    flashcard_set: [
      `FORMAT: Generate ${n} flashcard pairs (difficulty: ${diff}).`,
      'Each flashcard:',
      '  Q: [question — concise, single-concept]',
      '  A: [answer — max 2 lines, no padding]',
      'Separate each card with "---"',
      'Cover: definitions, formulas, applications, common traps — one per card.',
    ].join('\n'),

    worked_example: [
      'FORMAT: Complete worked solution.',
      'Structure (use these exact headings):',
      '  **Problem:** [state the problem]',
      '  **Given:** [list all given information]',
      '  **Find:** [what needs to be determined]',
      '  **Method:** [which approach/formula to use and why]',
      '  **Solution:** [step-by-step working, numbered]',
      '  **Answer:** [final answer with units]',
      '  **Sanity Check:** [verify answer makes physical/logical sense]',
    ].join('\n'),

    formula_sheet: [
      'FORMAT: Formula reference sheet.',
      'Use a table or structured list with these columns for each formula:',
      '  Formula | Variables | Units | Conditions/Assumptions | Common Exam Application',
      'Group formulas by sub-topic.',
      'Highlight the 2–3 most frequently tested formulas with ⭐.',
    ].join('\n'),

    analogy_explainer: [
      'FORMAT: Analogy-based explanation.',
      'Three-paragraph structure:',
      '  Paragraph 1 — THE ANALOGY: Introduce an everyday scenario that mirrors the concept.',
      '  Paragraph 2 — THE MAPPING: Explain precisely how each element of the analogy maps to the concept.',
      '  Paragraph 3 — WHERE IT BREAKS DOWN: CRITICAL — state where the analogy fails or is imperfect. This prevents misconceptions.',
      'The analogy must be culturally relevant for Indian students (avoid US-centric examples).',
    ].join('\n'),

    visual_diagram_text: [
      'FORMAT: Text-based visual diagrams.',
      'Use ASCII art to illustrate the concept:',
      '  - Boxes [ ] for entities/states',
      '  - Arrows → for flow/direction',
      '  - Numbers (1), (2) for sequence steps',
      '  - + / - for charge, == for equilibrium',
      'After each diagram: 1 paragraph explaining what the diagram shows.',
      'Use multiple diagrams for complex processes (e.g. before/after, cause/effect).',
    ].join('\n'),

    cheatsheet: [
      'FORMAT: One-page exam cheatsheet.',
      'Sections:',
      '  🔑 KEY FORMULAS (bold formula, condition it applies)',
      '  ⚡ SHORTCUTS (5-second tricks for common question types)',
      '  ⚠️ COMMON TRAPS (what NOT to do, with example)',
      '  📌 MUST-REMEMBER FACTS (non-derivable constants, definitions)',
      'Ultra-condensed — every line must earn its place. No fluff.',
    ].join('\n'),

    doubt_resolution: [
      'FORMAT: Targeted doubt resolution.',
      'Structure:',
      '  1. IDENTIFY THE CONFUSION: State the most likely source of the student\'s confusion (be specific).',
      '  2. CLEAR EXPLANATION: Address it directly in 2–3 short paragraphs. One idea at a time.',
      '  3. WORKED EXAMPLE: Show a concrete example that makes the concept tangible.',
      '  4. CHECK QUESTION: End with a question the student can answer — if they get it right, the doubt is resolved.',
      'Tone: patient, precise. Never make the student feel stupid for not knowing.',
    ].join('\n'),

    blog_post: [
      'FORMAT: SEO-optimised blog post for competitive exam students.',
      'Structure:',
      '  # [Compelling headline with exam name + topic]',
      '  [Hook paragraph — 2–3 sentences, why this matters for their exam]',
      '  ## What is [Topic]? (concept overview)',
      '  ## Why It Matters for [Exam Name] (exam relevance, question patterns)',
      '  ## Core Concepts Explained (with examples)',
      '  ## Practice Problems (2–3 solved examples)',
      '  ## Common Mistakes to Avoid',
      '  ## Quick Revision Checklist',
      '  [CTA: "Try EduGenius AI tutor for personalised practice"]',
      'Target: 800–1200 words. Include 2–3 natural keyword uses of "[topic] for [exam]".',
    ].join('\n'),
  };

  return directives[format];
}

// ─── Main Renderer ────────────────────────────────────────────────────────────

/**
 * Assembles all directives into a final rendered prompt pair (system + user).
 */
export function renderPrompt(ctx: PersonaContext): RenderedPrompt {
  const styleDirective    = buildLearningStyleDirective(ctx.learningStyle, ctx.channel);
  const objectiveDirective = buildObjectiveDirective(ctx.objective, ctx.daysToExam);
  const tierDirective     = buildCognitiveTierDirective(ctx.cognitiveTier, ctx.topicMasteryPct);
  const examDirective     = buildExamContextDirective(ctx.examId, ctx.topic, ctx.topicWeight, ctx.commonMistakes);
  const channelDirective  = buildChannelDirective(ctx.channel);
  const formatDirective   = buildFormatDirective(ctx.format, ctx.itemCount, ctx.difficulty);

  // Urgency / overload banners (appended last so they stand out)
  const overloadBanner = ctx.cognitiveLoad === 'overloaded'
    ? '\n## ⚠️ STUDENT IS OVERLOADED\nKeep content minimal, reassuring, and confidence-building. This is not the time for depth.'
    : '';
  const examSoonBanner = ctx.daysToExam <= 3
    ? `\n## ⚠️ EXAM IN ${ctx.daysToExam} DAY${ctx.daysToExam === 1 ? '' : 'S'}\nOnly high-probability exam topics. No deep dives. Speed and accuracy only.`
    : '';

  const systemPromptParts: string[] = [
    'You are Atlas — EduGenius\'s AI content generator. You produce exam-preparation content for Indian competitive exam students.',
    '',
    '## EXAM CONTEXT',
    examDirective,
    '',
    '## LEARNING STYLE',
    styleDirective,
    '',
    '## OBJECTIVE',
    objectiveDirective,
    '',
    '## STUDENT LEVEL',
    tierDirective,
    '',
    '## OUTPUT FORMAT',
    channelDirective,
    formatDirective,
  ];

  if (ctx.commonMistakes?.length) {
    systemPromptParts.push(
      '',
      `## KNOWN STUDENT MISTAKES ON THIS TOPIC`,
      ctx.commonMistakes.map(m => `- ${m}`).join('\n'),
    );
  }

  if (overloadBanner) systemPromptParts.push(overloadBanner);
  if (examSoonBanner) systemPromptParts.push(examSoonBanner);

  // ── Template Registry: resolve override (most-specific first) ────────────
  const templateMatch = resolveTemplate(
    ctx.examId,
    ctx.topic,
    ctx.learningStyle,
    ctx.objective,
  );

  let resolvedSystemPrompt: string;
  let templateKey: string | undefined;

  if (templateMatch) {
    const { override, key } = templateMatch;
    templateKey = key;

    // Apply prefix (prepended before all other directives)
    const prefixPart = override.systemPromptPrefix ? [override.systemPromptPrefix, ''] : [];
    // Apply suffix (appended after all other directives)
    const suffixPart = override.systemPromptSuffix ? ['', override.systemPromptSuffix] : [];

    resolvedSystemPrompt = [
      ...prefixPart,
      ...systemPromptParts.filter(p => p !== undefined),
      ...suffixPart,
    ].join('\n');

    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.debug(`[contentPersonaEngine] Template registry match: "${key}"`);
    }
  } else {
    resolvedSystemPrompt = systemPromptParts.filter(p => p !== undefined).join('\n');
  }

  // ── User prompt ───────────────────────────────────────────────────────────
  // If the matched template provides a full user-prompt override, use it.
  let userPrompt: string;
  if (templateMatch?.override.userPromptOverride) {
    userPrompt = templateMatch.override.userPromptOverride;
  } else {
    const formatLabel = ctx.format === 'mcq_set'
      ? `${ctx.itemCount ?? 10} MCQs`
      : FORMAT_LABELS[ctx.format] ?? 'content';

    const userPromptParts = [
      `Generate ${formatLabel} for:`,
      `Topic: ${ctx.topic}${ctx.subTopic ? ` → ${ctx.subTopic}` : ''}`,
      `Exam: ${ctx.examName}`,
      `Difficulty: ${ctx.difficulty ?? 'medium'}`,
    ];

    if (ctx.relatedWeakTopics?.length) {
      userPromptParts.push(`Also address connections to: ${ctx.relatedWeakTopics.join(', ')}`);
    }

    if (ctx.streakDays >= 7) {
      userPromptParts.push(`Note: Student is on a ${ctx.streakDays}-day streak — acknowledge their consistency briefly.`);
    }

    userPrompt = userPromptParts.join('\n');
  }

  // Token budget: use override if available, else estimate from prompt length
  const estimatedTokens = templateMatch?.override.tokenBudget
    ?? Math.ceil((resolvedSystemPrompt.length + userPrompt.length) / 4);

  return {
    systemPrompt: resolvedSystemPrompt,
    userPrompt,
    templateId: `${ctx.examId}__${ctx.topic}__${ctx.learningStyle}__${ctx.objective}__${ctx.format}`.replace(/\s+/g, '_'),
    templateKey,
    personaContext: ctx,
    estimatedTokens,
  };
}

// ─── Persona Inference ────────────────────────────────────────────────────────

/**
 * Automatically infer a PersonaContext from an EGUser + behavioral signals.
 * Pass `overrides` to pin specific fields (e.g. force a specific format or channel).
 */
export function inferPersonaContext(
  user: EGUser | null,
  topic: string,
  examId: string,
  format: ContentPersonaFormat,
  overrides?: Partial<PersonaContext>
): PersonaContext {
  const persona = loadPersona();
  const activeSub = user ? resolveActiveExam(user) : null;

  // Map studentPersonaEngine LearningStyle → contentPersonaEngine LearningStyle
  // (studentPersonaEngine uses 'story-driven' / 'practice-first' with hyphens)
  const rawStyle = persona?.learningStyle ?? 'unknown';
  const mappedStyle: LearningStyle =
    rawStyle === 'story-driven'   ? 'story_driven'   :
    rawStyle === 'practice-first' ? 'practice_first' :
    (rawStyle as LearningStyle);

  // Infer objective from urgency
  const daysToExam = persona?.daysToExam ?? 90;
  const inferredObjective: LearningObjective =
    daysToExam <= 7  ? 'quick_revision'           :
    daysToExam <= 30 ? 'exam_readiness'            :
    'conceptual_understanding';

  // Map PerformanceTier → CognitiveTier
  const tierMap: Record<string, CognitiveTier> = {
    advanced:   'advanced',
    good:       'proficient',
    average:    'developing',
    struggling: 'foundational',
  };
  const cognitiveTier: CognitiveTier = tierMap[persona?.tier ?? ''] ?? 'developing';

  return {
    learningStyle:    mappedStyle,
    objective:        inferredObjective,
    cognitiveTier,
    cognitiveLoad:    'medium',
    streakDays:       persona?.streakDays ?? 0,
    daysToExam,
    studyTimePattern: 'afternoon',
    examId,
    examName:         activeSub?.examName ?? examId,
    topic,
    topicWeight:      0.5,
    topicMasteryPct:  0,
    format,
    itemCount:        format === 'mcq_set' ? 10 : undefined,
    difficulty:       'medium',
    channel:          'web',
    ...overrides,
  };
}
