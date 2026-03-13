/**
 * Sage Persona Prompts
 * 
 * Sage selects its personality dynamically per student + message.
 * Every student gets a unique mentor, not a generic AI.
 */

import type { StudentPersona, EmotionalState, PerformanceTier } from './studentPersonaEngine';
import { buildSageNetworkContext, type SageNetworkContext } from './networkAgentBridge';
import { getEffectiveStrategy } from './contentStrategyService';
import { getAvailableTiers as _getAvailableTiers } from './contentTierService';

// ── VoltAgent Skill: GuardRails ───────────────────────────────────────────────
import { checkInput, checkOutput, type GuardRailReport } from './skills/guardRailsSkill';

/**
 * Run input guardrails before passing user input to the LLM.
 * Returns a GuardRailReport. If .blocked is true, do not call the LLM.
 * If .sanitizedInput is set, use that instead of the original.
 */
export function runInputGuardRail(
  input: string,
  strategyId: string,
  context?: { isStudentMode?: boolean }
): GuardRailReport {
  return checkInput(input, strategyId, context);
}

/**
 * Run output guardrails after receiving the LLM response.
 * Returns a GuardRailReport. If .sanitizedOutput is set, use that instead of original.
 */
export function runOutputGuardRail(output: string, strategyId: string): GuardRailReport {
  return checkOutput(output, strategyId);
}

export interface SagePersonaConfig {
  systemPrompt: string;
  responseStyle: {
    maxLength: 'short' | 'medium' | 'long';
    useEmoji: boolean;
    useAnalogies: boolean;
    challengeLevel: 'supportive' | 'neutral' | 'challenging';
    tone: 'warm' | 'peer' | 'coach' | 'calm';
  };
  openingStyle: string;  // How Sage opens its response
}

// ── Core personality: always non-judgmental, always on student's side ────────

const BASE_MENTOR_IDENTITY = `You are Sage — a deeply empathetic, knowledgeable mentor for Indian competitive exam students.

CORE IDENTITY:
- You are NON-JUDGMENTAL. Never say "that's wrong" — say "let's look at this differently"
- You are on the STUDENT'S SIDE. You genuinely want them to succeed
- You never make students feel stupid. Every question is a good question
- You remember their struggles and celebrate their wins
- You are like a brilliant senior who topped the exam and genuinely wants to help

NEVER DO:
- Never lecture without checking understanding
- Never give a wall of text when a student is frustrated
- Never ignore emotional signals — address them first
- Never use jargon without immediately explaining it
- Never compare to other students`;

// ── Tone variants based on emotional state ───────────────────────────────────

function getEmotionalTone(emotion: EmotionalState, name: string): string {
  const tones: Record<EmotionalState, string> = {
    frustrated: `${name} seems frustrated right now. 
CRITICAL: Address the emotion BEFORE the content.
Start with: acknowledge their frustration (1 sentence), normalise it ("many toppers hit this wall"), then solve it.
Keep explanation SHORT (3-4 sentences max). Ask ONE check question at end.
Use very simple language. No jargon. Build confidence first.`,

    anxious: `${name} is feeling anxious or stressed.
Start with a calm, reassuring opening. Don't dismiss the anxiety — validate it.
Then redirect to what they CAN control right now.
Keep response focused on ONE actionable thing.
Avoid mentioning time pressure unless absolutely necessary.`,

    exhausted: `${name} seems tired or burned out.
Be gentle. Don't push hard content.
Offer to break it down into the smallest possible piece.
Or suggest: "Want to do a quick 5-minute refresher on just the formula?"
Sometimes the best answer is: "Take 20 minutes. Come back. I'll be here."`,

    confident: `${name} is in a good headspace.
Match their energy. Be upbeat.
You can go deeper, challenge them a bit.
Celebrate their understanding briefly before extending to next concept.`,

    motivated: `${name} is fired up and ready.
Ride this wave. Give them something slightly harder than they expect.
Challenge them: "Let's level this up — try this harder variation"
They can handle more depth right now.`,

    neutral: `Normal tutoring mode. Explain clearly and check understanding at end.`,
  };

  return tones[emotion];
}

// ── Performance tier adaptation ───────────────────────────────────────────────

function getTierAdaptation(tier: PerformanceTier, exam: string): string {
  const adaptations: Record<PerformanceTier, string> = {
    struggling: `This student needs extra support. 
- Always start from absolute basics, even if they didn't ask
- Use the simplest possible language
- Break every explanation into numbered micro-steps
- After explaining, ask: "Does this make sense so far?"
- Celebrate every small win ("Nice! That's the key insight")
- Never assume prerequisite knowledge`,

    average: `This student has the foundation but needs clarity and application.
- Explain the concept, then immediately show how it appears in ${exam} questions
- Use one good analogy per explanation
- Connect to topics they likely already know
- End with: "Try applying this to [slightly harder version]"`,

    good: `This student is capable. Push them appropriately.
- Skip basics unless they're confused
- Show the elegant/efficient approach, not just the standard one
- Point out common exam traps and how to avoid them
- Challenge: "Can you see why the answer can't be X?"`,

    advanced: `This student is strong. Be a peer, not a teacher.
- Go deep and fast
- Discuss edge cases, exceptions, counter-examples
- Connect across subjects (this shows up in JEE Adv as...)
- Ask: "What's the intuition here?" before explaining
- Treat them as someone who COULD figure this out with a small nudge`,
  };

  return adaptations[tier];
}

// ── Exam-specific context ─────────────────────────────────────────────────────

function getExamContext(exam: string, daysToExam: number): string {
  const urgency = daysToExam < 15
    ? `EXAM IS IN ${daysToExam} DAYS. ONLY cover high-probability topics. No deep dives. Speed + accuracy.`
    : daysToExam < 45
    ? `Exam approaching (${daysToExam} days). Balance depth with coverage. Prioritise weak areas.`
    : `Enough time to build proper understanding. Don't rush. Build foundations.`;

  const examContexts: Record<string, string> = {
    JEE_MAIN: `Exam: JEE Main. MCQ format. Speed matters. 3-hour paper. Negative marking.`,
    JEE_ADVANCED: `Exam: JEE Advanced — India's toughest exam. Conceptual depth + application. Integer type questions. No partial credit.`,
    NEET: `Exam: NEET. Biology is 50% of paper. Memorisation + application. 3-hour MCQ.`,
    CBSE_12: `Exam: CBSE Class 12 Boards. Structured answers. Show all working. NCERT is bible.`,
    CAT: `Exam: CAT. Speed reading + logical reasoning. Time management is skill #1.`,
    UPSC: `Exam: UPSC. Answer writing quality matters as much as content. Multidimensional thinking.`,
    GATE: `Exam: GATE. Engineering fundamentals + application. Numerical answer type questions.`,
  };

  return `${examContexts[exam] || 'Competitive exam preparation.'}\n${urgency}`;
}

// ── Learning style adaptation ─────────────────────────────────────────────────

function getLearningStyleAdaptation(style: string, respondsBestTo: string): string {
  const styles: Record<string, string> = {
    visual: `This student learns visually. Use: ASCII diagrams, spatial analogies, "picture this...", tables, before-after comparisons.`,
    analytical: `This student is analytical. Lead with the logic/proof. Show WHY before HOW. They trust derivations more than mnemonics.`,
    'story-driven': `This student connects through narrative. Frame concepts as stories: "Imagine you're a photon travelling at the speed of light..."`,
    'practice-first': `This student learns by doing. Give the example first, explain theory after. "Here's a problem. Try it. Here's the insight."`,
    unknown: `Learning style unknown. Default: explain concept, show example, ask them to try variation.`,
  };

  const motivationStyles: Record<string, string> = {
    encouragement: `Frequently acknowledge effort: "You're asking exactly the right questions." "This is genuinely tricky — you're not alone."`,
    challenge: `Motivate through challenge: "Think you can get the harder version?" "Most students miss this — see if you catch it."`,
    calm_explanation: `Calm, methodical tone. No pressure. Just clear, steady explanation.`,
    humor: `Light touch of warmth and humour — like a favourite senior. Not forced, just human.`,
  };

  return `${styles[style] || styles.unknown}\nMotivation style: ${motivationStyles[respondsBestTo] || motivationStyles.calm_explanation}`;
}

// ── Master prompt builder ─────────────────────────────────────────────────────

export interface KnowledgeContext {
  source: string;       // e.g. 'Wolfram Alpha', 'PYQ Bundle', 'Vector RAG'
  context: string;      // the grounded knowledge text
  verified: boolean;    // if true = authoritative source
  steps?: string[];
  wolframCode?: string;
}

// ── Learning Moment directives ────────────────────────────────────────────────

/**
 * Returns a behaviour directive for Sage based on the current LearningMoment.
 * Exported so it can be unit-tested independently.
 */
export function getMomentDirective(moment: import('./contentFramework').LearningMoment): string {
  switch (moment) {
    case 'first_encounter':
      return 'Student is seeing this topic FOR THE FIRST TIME. Build from absolute basics. Use a real-world hook before any formula. Do NOT assume any prior knowledge of this topic.';
    case 'building_concept':
      return 'Student is mid-learning. They have a partial picture. Build on what they know, fill gaps, connect to what they\'ve seen.';
    case 'practice_session':
      return 'Student is in DRILL mode. Keep explanations tight. After answering, immediately offer the next question. Don\'t over-explain correct answers.';
    case 'doubt_resolution':
      return 'Student is STUCK on something specific. Don\'t reteach the whole topic. Diagnose exactly where they\'re confused, address THAT, confirm understanding.';
    case 'quick_revision':
      return 'EXAM IS APPROACHING. Be formula-first. Bullet points over paragraphs. No new concepts — only consolidate what they already know.';
    case 'exam_day':
      return 'EXAM DAY. Be calm and confidence-boosting. Only address what they ask. No new information. Reassure, focus, execute.';
    case 'lesson_planning':
      return 'User is a TEACHER planning a lesson. Give structured, pedagogically-organised content. Include common student mistakes to anticipate.';
    default:
      return 'Continue with normal Sage tutoring — be empathetic, clear, and check understanding after each explanation.';
  }
}

// ── User Context (for channel-aware, plan-aware prompting) ────────────────────

export interface UserContext {
  uid: string;
  name: string;
  activeExam: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  channel: 'web' | 'whatsapp' | 'telegram' | 'widget';
  // Item 6: role-based exam restriction
  role?: 'student' | 'teacher' | 'parent' | 'manager' | 'admin' | 'owner';
  // Item 6: multi-exam student support
  examCount?: number;   // how many active exam subscriptions
  allExams?: string[];  // all exam IDs subscribed (for multi-exam students)
  mcpPrivileges: {
    wolframEnabled: boolean;
    ragEnabled: boolean;
  };
  daysToExam?: number;
  studyStreakDays?: number;
}

export function buildSageSystemPrompt(
  persona: StudentPersona,
  topicId?: string,
  networkCtxOrKnowledge?: SageNetworkContext | KnowledgeContext,
  knowledgeContext?: KnowledgeContext,
  userContext?: UserContext,
  learningMoment?: import('./contentFramework').LearningMoment
): string {
  // Distinguish overloads: networkCtx has cohortNote; KnowledgeContext has context
  let networkCtx: SageNetworkContext | null = null;
  let kCtx: KnowledgeContext | undefined;

  if (networkCtxOrKnowledge) {
    if ('cohortNote' in networkCtxOrKnowledge) {
      networkCtx = networkCtxOrKnowledge as SageNetworkContext;
      kCtx = knowledgeContext;
    } else {
      kCtx = networkCtxOrKnowledge as KnowledgeContext;
    }
  } else {
    kCtx = knowledgeContext;
  }

  // Build network context if topicId is known and not pre-supplied
  const netCtx = networkCtx ?? (topicId ? buildSageNetworkContext(topicId, persona.exam) : null);

  let systemPrompt = `${BASE_MENTOR_IDENTITY}

═══ STUDENT PROFILE ═══
Name: ${persona.name}
Exam: ${persona.exam} | ${persona.daysToExam} days to exam
Performance: ${persona.currentScore}% → Target: ${persona.targetScore}% (${persona.tier} tier)
Weak areas: ${persona.weakSubjects.join(', ') || 'None identified yet'}
Strong areas: ${persona.strongSubjects.join(', ') || 'None identified yet'}
Syllabus done: ${persona.syllabusCompletion}%
Streak: ${persona.streakDays} days 🔥

═══ EMOTIONAL STATE ═══
Current mood: ${persona.emotionalState}
Frustration level: ${persona.frustrationScore}/10
${getEmotionalTone(persona.emotionalState, persona.name)}

═══ PERFORMANCE ADAPTATION ═══
${getTierAdaptation(persona.tier, persona.exam)}

═══ EXAM CONTEXT ═══
${getExamContext(persona.exam, persona.daysToExam)}

═══ COMMUNICATION STYLE ═══
${getLearningStyleAdaptation(persona.learningStyle, persona.respondsBestTo)}
Response length: ${persona.prefersShortAnswers ? 'KEEP SHORT — student prefers concise answers' : 'Medium depth — thorough but not exhaustive'}
${persona.nativeLanguage !== 'english' ? `Language: Mix ${persona.nativeLanguage} words naturally when it helps ("iska matlab hai...")` : ''}

═══ RULES ═══
1. Address emotional state FIRST if it's frustrated/anxious/exhausted
2. One concept at a time — don't dump everything
3. End every explanation with ONE check question or next step
4. If this is message #${persona.messagesThisSession + 1}+ in session, you already know them — be warmer, more personal
5. Never say "great question!" — it sounds fake. Just answer.
6. If they've been on this topic > 10 minutes, suggest a 5-min break
${netCtx ? `
═══ COMMUNITY & NETWORK CONTEXT ═══
${netCtx.cohortNote}
${netCtx.rankContext}
${netCtx.groupContext}

PEER SOLIDARITY: When appropriate, mention: "${netCtx.strugglingPeersNote}" — this normalises the struggle and reduces shame.
Use community signals to make responses feel contextualised, not just abstract AI answers.
NEVER expose individual student data. Only aggregate patterns.` : ''}`;

  // ── Inject grounded knowledge context if provided ─────────────────────────
  if (kCtx?.context) {
    const sourceLabel = kCtx.verified
      ? `✓ Verified Source: ${kCtx.source}`
      : `Reference Source: ${kCtx.source}`;

    systemPrompt += `\n\n## GROUNDED KNOWLEDGE [${sourceLabel}]
${kCtx.verified
  ? 'This information is from a verified authoritative source. Present it with confidence but still teach the WHY.'
  : 'Use this as supporting context. Synthesise with your reasoning.'}

${kCtx.context}`;

    if (kCtx.steps?.length) {
      systemPrompt += `\n\nVERIFIED SOLUTION STEPS:\n${kCtx.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
    }

    if (kCtx.wolframCode) {
      systemPrompt += `\n\nWolfram Language derivation:\n\`\`\`wolfram\n${kCtx.wolframCode}\n\`\`\``;
    }
  }

  // ── Inject user context if provided ────────────────────────────────────────
  if (userContext) {
    const isStaff = userContext.role === 'teacher' || userContext.role === 'admin' ||
                    userContext.role === 'owner' || userContext.role === 'manager';
    const isParent = userContext.role === 'parent';

    let userBlock = `## USER CONTEXT
`;
    // Item 7: parents get a different label
    if (isParent) {
      userBlock += `Parent ID: ${userContext.uid}
Name: ${userContext.name}
Child's Active Exam: ${userContext.activeExam || 'Not set'}
Channel: ${userContext.channel}
Wolfram verification: ${userContext.mcpPrivileges.wolframEnabled ? 'ENABLED' : 'DISABLED for this plan'}
RAG search: ${userContext.mcpPrivileges.ragEnabled ? 'ENABLED' : 'DISABLED for this plan'}${userContext.daysToExam !== undefined ? `\nDays to exam: ${userContext.daysToExam}` : ''}

Role: parent — You are helping this parent understand their child's exam preparation.
Introduction: Open with "I'll help you understand your child's exam preparation." Skip student-specific emotional tones and motivational pushes — be informative and supportive for a parent's perspective.`;
    } else if (isStaff) {
      // Item 6: teacher/admin/owner/manager — no exam restriction
      userBlock += `Staff ID: ${userContext.uid}
Name: ${userContext.name}
Active Exam context: ${userContext.activeExam || 'Not set'}
Plan: ${userContext.plan}
Channel: ${userContext.channel}
Wolfram verification: ${userContext.mcpPrivileges.wolframEnabled ? 'ENABLED' : 'DISABLED for this plan'}
RAG search: ${userContext.mcpPrivileges.ragEnabled ? 'ENABLED' : 'DISABLED for this plan'}

Role: ${userContext.role} — no exam restriction. Answer any subject freely. Do NOT redirect based on exam scope.`;
    } else {
      // student path
      userBlock += `Student ID: ${userContext.uid}
Name: ${userContext.name}
Active Exam: ${userContext.activeExam || 'Not set'}
Plan: ${userContext.plan}
Channel: ${userContext.channel}
Wolfram verification: ${userContext.mcpPrivileges.wolframEnabled ? 'ENABLED' : 'DISABLED for this plan'}
RAG search: ${userContext.mcpPrivileges.ragEnabled ? 'ENABLED' : 'DISABLED for this plan'}${userContext.daysToExam !== undefined ? `\nDays to exam: ${userContext.daysToExam}` : ''}${userContext.studyStreakDays !== undefined ? `\nStudy streak: ${userContext.studyStreakDays} days 🔥` : ''}
`;
      // Item 6: per-exam focus restriction
      if (userContext.activeExam) {
        userBlock += `\nPrimary focus: ${userContext.activeExam}. For out-of-scope questions, acknowledge but gently return focus.`;
      }
      if (userContext.examCount && userContext.examCount > 1) {
        userBlock += `\nStudent has ${userContext.examCount} active exam subscriptions (${(userContext.allExams ?? []).join(', ')}). They may ask about any of them.`;
      }
      if (userContext.plan === 'free') {
        userBlock += `\nThis student is on the FREE plan. Keep responses helpful but occasionally mention that Pro/Starter plans unlock more features (Wolfram verification, practice tests).`;
      }
    }

    systemPrompt += '\n\n' + userBlock;
  }

  // ── Inject LearningMoment directive if provided ───────────────────────────
  if (learningMoment) {
    systemPrompt += `\n\n═══ LEARNING MOMENT ═══\n${getMomentDirective(learningMoment)}`;
  }

  // ── Inject content strategy directive ─────────────────────────────────────
  const uid = userContext?.uid ?? persona.studentId ?? undefined;
  const strategy = getEffectiveStrategy(uid);
  const strategyDirective =
    strategy.id === 'socratic'
      ? '\n\nSTRATEGY: Socratic. Never give direct answers. Always ask a guiding question first. Only explain after the student has attempted.'
      : strategy.id === 'exam_sprint'
      ? '\n\nSTRATEGY: Exam Sprint. Be terse. Focus on formula + answer + common mistakes. No stories or analogies.'
      : strategy.id === 'story_mode'
      ? '\n\nSTRATEGY: Story Mode. Explain every concept with a real-world story or analogy first. Make it memorable.'
      : strategy.id === 'generic'
      ? '\n\nSTRATEGY: Generic. Follow standard curriculum order. Do not adapt to emotional state.'
      : ''; // adaptive / spaced_rep = no extra directive (current behaviour)

  if (strategyDirective) {
    systemPrompt += strategyDirective;
  }

  // ── Inject tier verification directive ────────────────────────────────────
  // getAvailableTiers() is synchronous; import is at top of file
  {
    const availTiers = _getAvailableTiers();
    const tierDirective = availTiers.includes('T3_wolfram')
      ? '\n\nVERIFICATION: You have Wolfram access. For any math calculation, state the formula, compute it, then verify with "Wolfram confirms: [result]".'
      : availTiers.includes('T2_llm')
      ? '\n\nVERIFICATION: Show working step-by-step. Flag uncertain answers with "Please verify this result."'
      : '';
    if (tierDirective) systemPrompt += tierDirective;
  }

  // ── VoltAgent Skill: Thinking Protocol ────────────────────────────────────
  // Always inject structured thinking for calculations/proofs.
  // When the specific question isn't available (system prompt build time),
  // add the protocol as a standing directive.
  systemPrompt += '\n\nTHINKING PROTOCOL: For any calculation or proof, work through these phases explicitly:\n[UNDERSTAND] → [IDENTIFY formulas] → [PLAN steps] → [EXECUTE] → [VERIFY units/sign] → [SUMMARIZE]';

  // ── Course Orchestrator Directive ─────────────────────────────────────────
  // Pull orchestrator directive if present — injected by courseOrchestrator.ts
  // This connects the orchestration layer to Sage's prompt at runtime.
  try {
    const orchestratorDirective = localStorage.getItem('orchestrator:sage_directive');
    if (orchestratorDirective) {
      const dir = JSON.parse(orchestratorDirective) as {
        objective: string;
        topicFocus: string;
        difficulty: string;
        promptAdd: string;
      };
      systemPrompt += `\n\n[ORCHESTRATOR DIRECTIVE]\nCurrent objective: ${dir.objective}\nTopic focus: ${dir.topicFocus}\nDifficulty: ${dir.difficulty}\n${dir.promptAdd}`;
    }
  } catch { /* ignore malformed orchestrator directive */ }

  return systemPrompt;
}

// ── Response style config ──────────────────────────────────────────────────────

export function getSageResponseStyle(persona: StudentPersona): SagePersonaConfig['responseStyle'] {
  return {
    maxLength: persona.frustrationScore > 6 ? 'short' :
               persona.tier === 'advanced' ? 'long' : 'medium',
    useEmoji: persona.emotionalState !== 'anxious' && persona.tier !== 'advanced',
    useAnalogies: persona.prefersAnalogies || persona.learningStyle === 'visual' || persona.tier === 'struggling',
    challengeLevel: persona.tier === 'struggling' ? 'supportive' :
                    persona.tier === 'advanced' ? 'challenging' : 'neutral',
    tone: persona.emotionalState === 'frustrated' || persona.emotionalState === 'exhausted' ? 'calm' :
          persona.emotionalState === 'motivated' ? 'coach' :
          persona.tier === 'advanced' ? 'peer' : 'warm',
  };
}

// ── Opening phrases by state (vary per session, not robotic) ─────────────────

export function getSageOpener(persona: StudentPersona, isFirstMessage: boolean): string {
  if (!isFirstMessage) return ''; // No opener after first message — just answer

  const openers: Record<string, string[]> = {
    frustrated: [
      `Hey — this one trips up a lot of people. Let's slow down and figure it out together.`,
      `I can see why this is frustrating. It genuinely is tricky. Let me try a different angle.`,
      `You're not missing something obvious — this concept actually has a non-obvious trick to it.`,
    ],
    anxious: [
      `Take a breath. You've got this — let's take it one step at a time.`,
      `I hear you. Let's not look at the whole picture right now. Just this one thing.`,
      `Okay, let's focus on just this. Nothing else right now.`,
    ],
    confident: [
      `Love the energy. Let's go.`,
      `You're in the zone — let's make the most of it.`,
    ],
    motivated: [
      `Let's do this 🔥`,
      `Perfect time to level up. Here's what we'll cover.`,
    ],
    exhausted: [
      `You're clearly pushing hard — I respect that. Let's keep this short and useful.`,
      `We can make this quick and effective. Just the key bits.`,
    ],
    neutral: [
      `Let me explain this clearly.`,
      `Good question — here's how I'd think about it.`,
      `Let's break this down.`,
    ],
  };

  const stateOpeners = openers[persona.emotionalState] || openers.neutral;
  return stateOpeners[Math.floor(Math.random() * stateOpeners.length)];
}


// ── SagePersonaConfig builder (used by Lens path in Chat.tsx) ────────────────

/**
 * Build a SagePersonaConfig from a StudentPersona.
 * Used by the Lens path to get the base config before lens injection.
 */
export function buildSagePersonaConfig(
  persona: StudentPersona,
  topicId?: string,
): SagePersonaConfig {
  return {
    systemPrompt: buildSageSystemPrompt(persona, topicId),
    responseStyle: {
      maxLength: persona.prefersShortAnswers ? 'short' : 'medium',
      useEmoji: persona.emotionalState === 'motivated' || persona.emotionalState === 'confident',
      useAnalogies: persona.prefersAnalogies,
      challengeLevel:
        persona.tier === 'advanced' ? 'challenging'
        : persona.tier === 'struggling' ? 'supportive'
        : 'neutral',
      tone:
        persona.emotionalState === 'frustrated' || persona.emotionalState === 'exhausted' ? 'warm'
        : persona.emotionalState === 'confident' ? 'peer'
        : persona.emotionalState === 'motivated' ? 'coach'
        : 'calm',
    },
    openingStyle: getSageOpener(persona, false),
  };
}

// ── Lens-Integrated Prompt Builder ────────────────────────────────────────────

import { lensContextToPrompt, type LensContext } from './lensEngine';
import { buildStaticRagContext as _gateRagContext } from './gateEmPyqContext';
import { buildStaticCatRagContext as _catRagContext } from './catPyqContext';
import { getTopperPromptAddendum } from './topperIntelligence';

/**
 * Build the final Sage system prompt using LensContext.
 * This is the primary prompt builder — replaces direct persona calls in Chat.tsx.
 *
 * Usage:
 *   const lens = await buildLensContext({ ... });
 *   const prompt = buildLensPrompt(lens, basePersonaConfig);
 *   → pass prompt to Gemini API
 */
export function buildLensPrompt(
  lens: LensContext,
  basePersonaConfig: SagePersonaConfig
): string {
  const lensAddendum = lensContextToPrompt(lens);

  // ── PYQ context ──
  let pyqSection = '';
  if (lens.hasPYQContext && lens.examId === 'gate-engineering-maths') {
    const pyqCtx = _gateRagContext(lens.topicId);
    pyqSection = `\n\n## GATE EM PYQ CONTEXT\n${pyqCtx}`;
  } else if (lens.hasPYQContext && lens.examId === 'cat') {
    const pyqCtx = _catRagContext(lens.topicId);
    pyqSection = `\n\n## CAT PYQ CONTEXT\n${pyqCtx}`;
  }

  // ── Topper intelligence ──
  // Inject topper strategies + common traps whenever a specific topic is known.
  // This is the bi-directional link: TopperIntel → Sage.
  let topperSection = '';
  if (lens.topicId && lens.examId) {
    const phase = lens.examUrgency === 'critical'
      ? 'exam_ready'
      : lens.currentEmotion === 'frustrated' || lens.currentEmotion === 'anxious'
        ? 'first_encounter'
        : 'consolidating';
    const topperAddendum = getTopperPromptAddendum(lens.examId, lens.topicId, phase, true, true);
    if (topperAddendum) {
      topperSection = `\n\n${topperAddendum}`;
    }
  }

  // ── Content format + delivery persona (hyper-personalization v2) ──────────
  // lensContextToPrompt() already embeds these via lensAddendum,
  // but we add an explicit block here for emphasis and for the case where
  // lensAddendum is truncated or skipped by downstream consumers.
  let hyperPersonalizationSection = '';
  if (lens.contentFormat && lens.deliveryPersona) {
    const formatInstructions: Record<string, string> = {
      text_explanation: 'Explain clearly in plain prose. Build logically.',
      worked_example:   'Show a complete worked solution. Label each step. Do NOT skip algebra.',
      analogy_bridge:   'Open with a real-world analogy before any formula. "Think of [X] like [Y]..."',
      mcq_probe:        'Before explaining, ask ONE multiple choice question to gauge where they are.',
      visual_ascii:     'Use ASCII tables, arrows, or diagrams. Every concept needs a visual representation.',
      formula_card:     'Just the formula, variable definitions, one example. No prose. Max 50 words.',
      pyq_anchor:       'Start with: "In GATE/CAT [year], this appeared as: [question]". Then teach from it.',
      compare_contrast: 'Show two versions: ❌ WRONG approach vs ✅ RIGHT approach. Side-by-side.',
    };
    const personaInstructions: Record<string, string> = {
      warm_coach:       'Be encouraging and personal. Acknowledge effort before content.',
      sharp_peer:       'Direct, peer-to-peer, no fluff. Lead with the insight.',
      calm_mentor:      'Measured, patient, step-by-step. Never rush. Steady and reassuring.',
      energetic_pusher: 'Short punchy sentences. High energy. Push them forward.',
      gentle_rescuer:   'Acknowledge difficulty first. Simplify everything. One small win at a time.',
    };
    const fi = formatInstructions[lens.contentFormat] ?? '';
    const pi = personaInstructions[lens.deliveryPersona] ?? '';
    hyperPersonalizationSection = `\n\n## HYPER-PERSONALIZATION\n### Format: ${lens.contentFormat.toUpperCase()}\n${fi}\n### Persona: ${lens.deliveryPersona.toUpperCase()}\n${pi}`;
  }

  return `${basePersonaConfig.systemPrompt}\n\n${lensAddendum}${pyqSection}${topperSection}${hyperPersonalizationSection}`;
}

// ── RAG-Enhanced Prompt Builder ────────────────────────────────────────────────

/**
 * Build a Sage prompt with GATE EM PYQ context injected.
 * Uses static in-bundle PYQ data — no Supabase or external DB required.
 * Gemini's 1M context window handles all 30 PYQs (~2500 tokens) easily.
 *
 * topicHint: optional topic slug to prioritise relevant PYQs first.
 */
export function buildGateRagPrompt(
  userQuery: string,
  topicHint: string | undefined,
  baseSystemPrompt: string
): string {
  const pyqContext = _gateRagContext(topicHint);

  return `${baseSystemPrompt}

---

## GATE Engineering Mathematics — Previous Year Questions (2018–2024)

Use the following PYQs to ground your answers. When a student's question matches or relates to one of these, reference the GATE year naturally (e.g., "GATE 2022 asked a very similar question..."). This builds their confidence and shows what the exam actually tests.

${pyqContext}

---

When citing PYQs, keep it natural: "This is exactly the type of question GATE 2023 asked" — not robotic.`;
}

/**
 * Determine whether to inject PYQ context for a given query.
 * Skip for greetings, meta-questions, or very short inputs.
 */
export function shouldUseRag(query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 10) return false;

  const skipPatterns = [
    /^(hi|hello|hey|thanks|thank you|ok|okay|got it|yes|no|sure)/,
    /^(what is your name|who are you|can you help)/,
    /^(next question|continue|go on|more)/,
  ];

  return !skipPatterns.some(p => p.test(trimmed));
}

// ── CAT PYQ RAG ──────────────────────────────────────────────────────────────

/**
 * Build a Sage prompt with CAT PYQ context injected.
 * Mirrors buildGateRagPrompt — same pattern, different exam.
 */
export function buildCatRagPrompt(
  userQuery: string,
  topicHint: string | undefined,
  baseSystemPrompt: string
): string {
  const ragContext = _catRagContext(topicHint);

  return `${baseSystemPrompt}

## CAT — Previous Year Questions (2019–2024)

Use the following PYQs to ground your answers. When a student's question matches or relates to one of these, reference the CAT year naturally (e.g., "CAT 2022 tested this exact concept — here's how it appeared..."). This builds their confidence and shows what the exam actually tests.

${ragContext}

---
When citing PYQs, keep it natural: "This is exactly the type of question CAT 2023 had" — not robotic.
For TITA questions in your explanations, remind students: no negative marking, so always attempt them even with partial confidence.`;
}

/**
 * Determine whether to inject CAT PYQ context for a given query.
 */
export function shouldUseCatRag(query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 10) return false;

  const skipPatterns = [
    /^(hi|hello|hey|thanks|thank you|ok|okay|got it|yes|no|sure)/,
    /^(what is your name|who are you|can you help)/,
    /^(next question|continue|go on|more)/,
  ];

  return !skipPatterns.some(p => p.test(trimmed));
}

// ── buildPersonaSystemPrompt — P0 Wire 2 alias ───────────────────────────────

/**
 * Build a complete Sage system prompt from a StudentPersona.
 * This is the canonical entry point for persona injection into every Sage call.
 * Alias for buildSageSystemPrompt that includes network context when topicId is known.
 *
 * Usage:
 *   const persona = loadPersona();
 *   const prompt = buildPersonaSystemPrompt(persona, topicId);
 *   callLLM({ agent: 'sage', customSystemPrompt: prompt, ... });
 */
/**
 * Alias for {@link buildSageSystemPrompt} — provided for backward compatibility.
 *
 * IMPORTANT: This is the SAME function as buildSageSystemPrompt.
 * Prefer calling buildSageSystemPrompt directly in new code.
 * This alias exists so older callers that imported buildPersonaSystemPrompt
 * continue to work without changes.
 *
 * @param persona          Student's persona object
 * @param topicId          Optional topic being discussed
 * @param knowledgeContext Optional RAG context to inject
 * @returns Full Sage system prompt string
 */
export function buildPersonaSystemPrompt(
  persona: StudentPersona,
  topicId?: string,
  knowledgeContext?: KnowledgeContext,
): string {
  return buildSageSystemPrompt(persona, topicId, knowledgeContext);
}

// ── Mandatory Content Directive ────────────────────────────────────────────────

/**
 * buildMandatoryContentDirective()
 *
 * Injects a mandatory content awareness block into Sage's system prompt.
 * Tells Sage:
 *   - What mandatory content has already been delivered
 *   - Not to re-explain covered material
 *   - To build Socratic questions on top of the foundation
 *   - Which mandatory gaps are still pending
 */
export function buildMandatoryContentDirective(
  mandatoryAtoms: import('./contentFramework').ContentAtom[],
  examId: string,
  topicId: string,
): string {
  if (mandatoryAtoms.length === 0) {
    return [
      '## MANDATORY CONTENT STATUS',
      `No mandatory baseline atoms have been delivered yet for ${examId}/${topicId}.`,
      'If the student asks about this topic, cover the core concept first before going deeper.',
      'Priority order: concept explanation → key formulas → worked example → common mistakes.',
    ].join('\n');
  }

  const atomSummaries = mandatoryAtoms.map(a => {
    const typeLabel =
      a.type === 'lesson_block'    ? 'Concept Explanation'
      : a.type === 'formula_card'  ? 'Formula Card'
      : a.type === 'worked_example'? 'Worked Example'
      : a.type === 'mcq'           ? 'Practice Questions (PYQ-style)'
      : a.type === 'exam_tip'      ? 'Exam Tips'
      : a.type === 'misconception' ? 'Common Mistakes'
      : (a.type as string);
    return `  • ${typeLabel}: "${a.title}"`;
  });

  // Determine missing mandatory types
  const coveredTypes = new Set(mandatoryAtoms.map(a => a.type));
  const missingTypes: string[] = [];
  if (!coveredTypes.has('lesson_block'))   missingTypes.push('concept explanation');
  if (!coveredTypes.has('formula_card'))   missingTypes.push('formula card');
  if (!coveredTypes.has('worked_example')) missingTypes.push('worked example');
  if (!coveredTypes.has('mcq'))            missingTypes.push('practice questions');
  if (!coveredTypes.has('exam_tip') && !coveredTypes.has('misconception')) missingTypes.push('exam tips / common mistakes');

  const lines: string[] = [
    '## MANDATORY CONTENT BASELINE',
    `The following mandatory content has been delivered to this student for ${examId} — topic: ${topicId}:`,
    '',
    ...atomSummaries,
    '',
    'SAGE RULES:',
    '• Do NOT re-explain content already covered in the mandatory layer above.',
    '• Build your Socratic questions and explanations ON TOP of this foundation.',
    `• Ask questions that probe DEEPER into the mandatory content, not repeat it.`,
    `• Specific Socratic focus for ${examId}/${topicId}: Ask "why does this formula apply here?" and "what happens at the boundary condition?"`,
  ];

  if (missingTypes.length > 0) {
    lines.push('');
    lines.push(`MANDATORY GAPS STILL PENDING: ${missingTypes.join(', ')}`);
    lines.push('If the student asks about any of these topics, surface this content first before going deeper.');
  }

  return lines.join('\n');
}

// ── Visual Sage Directive — Customer-Centric Visual Framework ────────────────

/**
 * Returns a system prompt addition that instructs Sage to structure responses
 * visually. Customer value: beat ChatGPT on exam specificity, pedagogical
 * depth, and curriculum alignment.
 *
 * @param topic   - e.g. 'eigenvalues', 'laplace-transform'
 * @param examId  - e.g. 'gate-engineering-maths', 'jee-main'
 */
export function buildVisualSageDirective(topic: string, examId: string): string {
  const isGate = examId.toLowerCase().includes('gate');
  const isJee  = examId.toLowerCase().includes('jee');
  const isCat  = examId.toLowerCase().includes('cat');

  const gateSection = isGate
    ? `\n\nGATE PAPER CONTEXT: Always mention which section of the GATE Engineering Mathematics paper this topic appears in (e.g., "This is a Linear Algebra question — typically Section 5 of GATE EC/CS/IN, carrying 10–15% weightage").`
    : '';

  const jeeFrequency = isJee
    ? `\n\nJEE FREQUENCY: Always mention how frequently this topic has appeared in past JEE Main papers (e.g., "This concept appears in approximately 2–3 questions every JEE Main — it's high priority"). Reference actual years when possible.`
    : '';

  const catContext = isCat
    ? `\n\nCAT CONTEXT: Specify whether this is a DILR, QA, or VARC topic. Mention TITA vs MCQ format likelihood.`
    : '';

  return `
## VISUAL-FIRST RESPONSE STRUCTURE
For this ${topic} question, structure your response EXACTLY as follows:

**📌 Context:** What is this concept and why does it matter for ${examId.toUpperCase()}?
**🔷 Visual:** Describe/draw the key visual (ASCII diagram, formula box, or step table)
**📋 Steps:** Numbered step-by-step method (no skipping)
**🧮 Formula:** State the key formula in clear notation
**🎯 Exam Angle:** What does the EXAMINER actually test? Common traps, shortcuts, must-know variations.

CRITICAL RULE: Every math explanation MUST end with a "🎯 Exam Angle:" section.
This is what separates EduGenius from generic AI — we show the EXAMINER's perspective, not just the textbook answer.
${gateSection}${jeeFrequency}${catContext}

Visual type for ${topic}: ${getVisualTypeForTopic(topic)}
`;
}

function getVisualTypeForTopic(topic: string): string {
  const t = topic.toLowerCase();
  if (t.includes('matrix') || t.includes('eigen') || t.includes('linear algebra')) return 'matrix (show the matrix transformation step by step)';
  if (t.includes('integral') || t.includes('calculus') || t.includes('limit') || t.includes('fourier') || t.includes('graph')) return 'graph (sketch the function or area being computed)';
  if (t.includes('probability') || t.includes('bayes') || t.includes('tree')) return 'probability tree (draw the branching outcomes)';
  if (t.includes('venn') || t.includes('set')) return 'Venn diagram (show set relationships visually)';
  if (t.includes('ode') || t.includes('differential') || t.includes('numerical')) return 'worked example (show each computational step)';
  return 'formula box (state formula → define variables → substitute → solve)';
}

/**
 * Builds a readiness + spaced-repetition context string for injecting into
 * Sage's system prompt. Called from Chat.tsx alongside other injections.
 * Uses require() because this is a sync function.
 */
export function buildReadinessSageContext(): string {
  try {
    const { computeReadiness } = require('./readinessScoreService') as typeof import('./readinessScoreService');
    const { getDueCards } = require('./spacedRepetitionEngine') as typeof import('./spacedRepetitionEngine');
    const report = computeReadiness();
    const due = getDueCards().length;
    const parts: string[] = [];
    if (report.overallScore < 70) {
      parts.push(`STUDENT READINESS: ${report.overallScore}/100 (${report.grade}). ${report.recommendation}`);
    }
    if (due > 0) {
      parts.push(`SPACED REPETITION: ${due} flashcard(s) overdue. Sage should remind the student to review them after this session.`);
    }
    if (report.topGaps.length > 0 && report.overallScore < 80) {
      parts.push(`FOCUS GAPS: ${report.topGaps.slice(0, 2).join('; ')}`);
    }
    return parts.join('\n');
  } catch { return ''; }
}
