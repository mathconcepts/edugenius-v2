/**
 * guardRailsSkill.ts — Content Safety + Pedagogical Guardrails
 * VoltAgent pattern: Intercept and validate agent input/output at runtime.
 *
 * Sage-specific rules:
 *   - No direct answer to MCQ without attempt (Socratic strategy)
 *   - No harmful/distressing content
 *   - No off-topic non-exam content (e.g. political opinions)
 *   - Flag frustration signals → route to Mentor
 *   - Detect cheating intent ("give me all answers to this test") → redirect
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type GuardRailResult = 'pass' | 'block' | 'redirect' | 'warn';

export interface GuardRailCheck {
  rule: string;
  result: GuardRailResult;
  reason?: string;
  redirectTo?: 'mentor' | 'parent' | 'teacher' | 'chat';
  transformedInput?: string; // sanitized version
}

export interface GuardRailReport {
  inputChecks: GuardRailCheck[];
  outputChecks: GuardRailCheck[];
  finalResult: GuardRailResult;
  blocked: boolean;
  redirected: boolean;
  sanitizedInput?: string;
  sanitizedOutput?: string;
}

// ─── Keyword lists ────────────────────────────────────────────────────────────

const CRISIS_KEYWORDS = [
  'suicide', 'kill myself', 'end my life', 'self harm', 'self-harm',
  'hurt myself', 'want to die', 'hopeless', 'give up on life', 'no reason to live',
];

const CHEATING_PATTERNS = [
  /give me all (the )?answers/i,
  /solve (the )?entire test/i,
  /solve (the )?whole (paper|exam|test)/i,
  /all answers (for|to) (the )?(test|exam|paper)/i,
  /complete (the )?(test|exam|paper) for me/i,
  /do (the )?(test|exam|paper) for me/i,
];

const OFF_TOPIC_PATTERNS = [
  /\b(politics|politician|election|vote|BJP|Congress|AAP|Modi|rahul gandhi)\b/i,
  /\b(religion|hindu|muslim|christian|caste|reservation|temple|mosque|church)\b/i,
  /\b(adult|porn|sex|nude|naked|18\+|explicit)\b/i,
  /\b(gambling|betting|casino|rummy|poker)\b/i,
];

const FRUSTRATION_KEYWORDS = [
  'i hate this', 'i cant do this', "i can't do this", 'this is impossible',
  'i give up', 'i quit', 'i suck', 'i am stupid', "i'm stupid", 'too hard',
  'i dont understand anything', "i don't understand anything",
  'waste of time', 'useless', 'this makes no sense',
];

const MCQ_ANSWER_REQUEST_PATTERNS = [
  /what is the answer (to|for)/i,
  /which (option|choice) is (correct|right)/i,
  /is it (a|b|c|d)\?/i,
  /tell me the answer/i,
  /just give me the answer/i,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function containsCrisisKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some(k => lower.includes(k));
}

function containsCheatIntent(text: string): boolean {
  return CHEATING_PATTERNS.some(p => p.test(text));
}

function containsOffTopic(text: string): boolean {
  return OFF_TOPIC_PATTERNS.some(p => p.test(text));
}

function containsFrustrationSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return FRUSTRATION_KEYWORDS.some(k => lower.includes(k));
}

function isMCQAnswerRequest(text: string): boolean {
  return MCQ_ANSWER_REQUEST_PATTERNS.some(p => p.test(text));
}

function isSocraticStrategy(strategyId: string): boolean {
  return strategyId === 'socratic';
}

// ─── Input guardrails ─────────────────────────────────────────────────────────

/**
 * Run input guardrails BEFORE sending to LLM.
 */
export function checkInput(
  input: string,
  strategyId: string,
  context?: { isStudentMode?: boolean }
): GuardRailReport {
  const checks: GuardRailCheck[] = [];

  // Rule 1: Crisis detection → redirect to Mentor
  if (containsCrisisKeyword(input)) {
    checks.push({
      rule: 'crisis_detection',
      result: 'redirect',
      reason: 'Input contains crisis/distress keywords. Routing to Mentor for empathetic response.',
      redirectTo: 'mentor',
      transformedInput: `[SAGE CRISIS REDIRECT] The student may be in distress. Respond with warmth and empathy first. Say: "I hear you. That sounds really tough. Before we continue studying, I just want to check in — are you okay? You can always talk to me, and there's support available if you need it." Then gently offer to continue when they're ready. Do NOT ignore this.`,
    });
  }

  // Rule 2: Cheating intent → block + redirect to teacher
  if (containsCheatIntent(input)) {
    checks.push({
      rule: 'cheating_intent',
      result: 'block',
      reason: 'Input appears to request bulk answers or test solutions — academic integrity concern.',
      redirectTo: 'teacher',
      transformedInput: undefined,
    });
  }

  // Rule 3: Off-topic content → block, gentle redirect
  if (containsOffTopic(input)) {
    checks.push({
      rule: 'off_topic',
      result: 'block',
      reason: 'Input contains off-topic content (politics, religion, adult content). Redirecting to exam focus.',
      transformedInput: `I'm best suited to help with your exam preparation. Let's focus on what's going to help you crack ${strategyId === 'socratic' ? 'your exam' : 'the exam'} — what topic would you like to work on?`,
    });
  }

  // Rule 4: Frustration signals → route to Mentor
  if (containsFrustrationSignal(input) && context?.isStudentMode !== false) {
    checks.push({
      rule: 'frustration_signal',
      result: 'redirect',
      reason: 'Student appears frustrated. Mentor routing recommended.',
      redirectTo: 'mentor',
      transformedInput: undefined,
    });
  }

  // Rule 5: Socratic strategy + direct MCQ answer request → transform input
  if (isSocraticStrategy(strategyId) && isMCQAnswerRequest(input)) {
    checks.push({
      rule: 'socratic_mcq_guard',
      result: 'warn',
      reason: 'Socratic strategy active — direct answer request detected. Transforming to guide thinking.',
      transformedInput: `${input}\n\n[SAGE INSTRUCTION: Do NOT reveal the direct answer. Think step by step first. Ask the student: "What do you already know about this topic? What can you eliminate first?"]`,
    });
  }

  // Determine final result (worst case: block > redirect > warn > pass)
  const finalResult = determineFinalResult(checks);

  // Find sanitized input from first transforming check
  const transformingCheck = checks.find(c => c.transformedInput);
  const sanitizedInput = transformingCheck?.transformedInput;

  return {
    inputChecks: checks,
    outputChecks: [],
    finalResult,
    blocked: finalResult === 'block',
    redirected: finalResult === 'redirect',
    sanitizedInput,
  };
}

// ─── Output guardrails ────────────────────────────────────────────────────────

/**
 * Run output guardrails AFTER LLM response.
 */
export function checkOutput(output: string, strategyId: string): GuardRailReport {
  const checks: GuardRailCheck[] = [];
  const wordCount = output.split(/\s+/).length;

  // Rule 1: Response too long for what looks like a simple question
  if (wordCount > 500) {
    checks.push({
      rule: 'brevity_guard',
      result: 'warn',
      reason: `Response is ${wordCount} words — may be too long. Consider breaking into smaller chunks.`,
    });
  }

  // Rule 2: Direct MCQ answer without explanation in Socratic mode
  if (isSocraticStrategy(strategyId)) {
    const mcqAnswerPattern = /\b(the answer is|correct answer is|answer: [A-D]|option [A-D] is correct)\b/i;
    if (mcqAnswerPattern.test(output)) {
      // Transform: append guiding question, flag the direct answer reveal
      const transformed = output.replace(
        /\b(the answer is|correct answer is|answer: [A-D]|option [A-D] is correct)[^.!?]*/gi,
        '[Let me guide you to the answer]'
      ) + '\n\n*What do you think? Try eliminating options one by one — which ones can you rule out?*';

      checks.push({
        rule: 'socratic_output_guard',
        result: 'warn',
        reason: 'Socratic mode: direct MCQ answer detected in output. Transforming to guiding question.',
        transformedInput: transformed,
      });
    }
  }

  // Rule 3: Formula without units (basic heuristic)
  const formulaWithoutUnitsPattern = /=\s*[\d.]+(?:\s*[+\-*/]\s*[\d.]+)*\s*(?!\s*(?:m|s|kg|N|J|W|Pa|K|mol|A|V|Ω|Hz|m\/s|km\/h|rad|sr|C|F|H|T|Wb|lm|lx|Bq|Gy|Sv))/;
  if (formulaWithoutUnitsPattern.test(output)) {
    checks.push({
      rule: 'units_check',
      result: 'warn',
      reason: 'Formula result may be missing units. Consider adding units for exam accuracy.',
    });
  }

  const finalResult = determineFinalResult(checks);
  const transformingCheck = checks.find(c => c.transformedInput);

  return {
    inputChecks: [],
    outputChecks: checks,
    finalResult,
    blocked: false, // output blocks are converted to warnings, never hard-blocked
    redirected: false,
    sanitizedOutput: transformingCheck?.transformedInput,
  };
}

// ─── Surface sanitization ─────────────────────────────────────────────────────

/**
 * Sanitize output for the target delivery surface.
 *
 * - WhatsApp: strip markdown, max 1000 chars
 * - Telegram: preserve markdown
 * - In-app: allow full markdown
 * - PDF: strip emojis
 */
export function sanitizeForSurface(text: string, surface: string): string {
  switch (surface.toLowerCase()) {
    case 'whatsapp': {
      // Strip markdown (bold, italic, headers, code blocks)
      let stripped = text
        .replace(/\*\*(.+?)\*\*/g, '$1')       // **bold**
        .replace(/\*(.+?)\*/g, '$1')             // *italic*
        .replace(/#{1,6}\s+/g, '')               // ### headers
        .replace(/```[\s\S]*?```/g, '[code]')    // code blocks
        .replace(/`(.+?)`/g, '$1')               // inline code
        .replace(/\[(.+?)\]\((.+?)\)/g, '$1')   // [link](url)
        .replace(/^\s*[-*+]\s+/gm, '• ')         // unordered list
        .replace(/^\s*\d+\.\s+/gm, '')           // ordered list
        .trim();
      // Max 1000 chars
      if (stripped.length > 1000) {
        stripped = stripped.slice(0, 997) + '...';
      }
      return stripped;
    }

    case 'telegram':
      // Preserve markdown as-is — Telegram supports it
      return text;

    case 'pdf': {
      // Strip emojis
      return text.replace(
        /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F004}\u{1F0CF}]/gu,
        ''
      ).trim();
    }

    case 'in-app':
    default:
      // Full markdown allowed
      return text;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function determineFinalResult(checks: GuardRailCheck[]): GuardRailResult {
  if (checks.some(c => c.result === 'block')) return 'block';
  if (checks.some(c => c.result === 'redirect')) return 'redirect';
  if (checks.some(c => c.result === 'warn')) return 'warn';
  return 'pass';
}
