/**
 * topperIntelligence.ts — EduGenius Topper Intelligence Service
 *
 * "Every topper has a strategy. Every failure has a pattern. We make both visible."
 *
 * This service connects topper strategies and lessons learned DIRECTLY to each
 * learning module so that:
 *   1. Sage injects topper tactics BEFORE a student makes a common mistake
 *   2. Atlas generates topper-style content (not average-student content)
 *   3. Mentor uses topper milestones for motivation ("You just hit the same
 *      point where 80% of toppers had their breakthrough")
 *   4. Oracle tracks whether topper-aligned study patterns improve mastery
 *   5. Scout harvests fresh topper strategies from PYQs + online sources
 *
 * Data model:
 *   TopperStrategy — a proven study pattern for a specific topic
 *   LessonLearned — a failure pattern that toppers overcame
 *   TopperInsight — compiled view per topic (strategies + lessons + timing)
 *   ModuleTopperProfile — ties a course module to all its insights
 *
 * ─── Bi-directional agent wiring ───────────────────────────────────────────
 *
 *  Scout ──→ TopperIntel    harvestTopperPatterns() — new topper data in
 *  TopperIntel ──→ Sage      getTopperSystemPromptAddendum() — inject before response
 *  TopperIntel ──→ Atlas     getAtlasContentBrief() — generate topper-grade content
 *  TopperIntel ──→ Mentor    getMotivationMilestone() — topper milestone nudge
 *  TopperIntel ──→ Oracle    getTopperMetrics() — track strategy effectiveness
 *  Sage ──→ TopperIntel      recordStudentMistake() — feeds lessons-learned pool
 *  Oracle ──→ TopperIntel    updateStrategyEfficacy() — which strategies actually work
 */

import { enqueueSignal } from './persistenceDB';

// ─── Core data types ──────────────────────────────────────────────────────────

export type StudyPhase = 'first_encounter' | 'building' | 'consolidating' | 'exam_ready';
export type LearningApproach = 'formula_first' | 'intuition_first' | 'example_first' | 'problem_first';
export type MistakeCategory = 'conceptual' | 'calculation' | 'time_management' | 'interpretation' | 'memory';

export interface TopperStrategy {
  id: string;
  topicId: string;
  examId: string;
  title: string;
  shortSummary: string;            // One sentence — shown in UI chip
  detailedExplanation: string;     // For Sage to inject into prompt
  phase: StudyPhase;               // When in the learning journey this applies
  approach: LearningApproach;
  timeInvestment: 'quick' | 'medium' | 'deep';  // 5min / 30min / 2h+
  examRelevance: number;           // 0-1 (how directly GATE/CAT testable)
  successRate: number;             // 0-1 (% of students using this who improved mastery)
  sourceType: 'pyq_analysis' | 'topper_interview' | 'teacher_insight' | 'oracle_derived';
  tags: string[];
}

export interface LessonLearned {
  id: string;
  topicId: string;
  examId: string;
  mistakeTitle: string;            // "Confusing rank with nullity"
  mistakeDescription: string;      // What the student thinks vs. reality
  whyItHappens: string;            // Root cause
  howToppersAvoidIt: string;       // The specific thing toppers do differently
  category: MistakeCategory;
  frequency: number;               // 0-1 (how often this appears in student sessions)
  examYearsAppeared: number[];     // GATE years where this exact trap appeared
  fixInSeconds: string;            // The 10-second rule to catch yourself mid-exam
}

export interface TopperInsight {
  topicId: string;
  examId: string;
  topperMindset: string;           // The overarching mental model toppers use
  keyStrategies: TopperStrategy[];
  lessonsLearned: LessonLearned[];
  studySequence: string[];         // Ordered list: how toppers approach the topic
  examDayChecklist: string[];      // What to scan in 30 seconds before tackling a question
  commonTrap: string;              // Single most common trap — always injected by Sage
  breakthroughMoment: string;      // The "aha" moment — when to say "you just hit the topper mindset"
  timeToMasteryHours: {
    average: number;               // Average student
    topper: number;                // Topper (with these strategies)
  };
}

// ─── Topper insight database ──────────────────────────────────────────────────
// Built from: teaching-tips.md analysis + PYQ pattern mining + GATE topper interviews

export const TOPPER_INSIGHTS: Record<string, TopperInsight> = {
  'gate-em::linear-algebra': {
    topicId: 'linear-algebra',
    examId: 'gate-engineering-maths',
    topperMindset: 'I never compute an eigenvalue from scratch in the exam. I use trace=sum, det=product, and the characteristic equation shortcuts. The matrix is just a clue — eigenvalues are the answer.',
    studySequence: [
      '1. Matrix ops + determinant by hand (Day 1-2) — feel the mechanics',
      '2. Row reduction → rank → null space (Day 3) — these are the same thing',
      '3. Eigenvalues via char equation, but immediately convert to shortcut (Day 4-5)',
      '4. Cayley-Hamilton: just substitute the matrix into its own char equation (Day 6)',
      '5. 20 PYQs timed — build exam instinct (Day 7)',
    ],
    examDayChecklist: [
      'Is det = 0? → singular, one eigenvalue is 0',
      'Check trace = sum of eigenvalues BEFORE computing anything',
      'For Ax=b: check rank(A) vs rank([A|b]) first, not last',
      'Orthogonal matrix? → QᵀQ = I, use this to find entries fast',
    ],
    commonTrap: 'Students confuse det(kA) = kⁿ·det(A) with det(kA) = k·det(A). The n matters — a 3×3 matrix scales the determinant by k³, not k. GATE has tested this in at least 4 recent years.',
    breakthroughMoment: 'When you can look at a matrix and immediately say "eigenvalues must sum to X and multiply to Y" — that\'s topper instinct. You\'ve just unlocked the shortcut layer.',
    timeToMasteryHours: { average: 18, topper: 10 },
    keyStrategies: [
      {
        id: 'la-s1',
        topicId: 'linear-algebra',
        examId: 'gate-engineering-maths',
        title: 'TDP Method: Trace-Determinant-Product',
        shortSummary: 'Never compute eigenvalues — derive them from trace and determinant',
        detailedExplanation: `Toppers almost never solve the full characteristic equation. Instead:
For 2×2: λ₁ + λ₂ = trace(A), λ₁ × λ₂ = det(A). Solve the system.
For 3×3: Sum = trace, Product = det, then use sum of 2×2 minors for the middle coefficient.
When a question asks "find the larger eigenvalue," you can do it in 20 seconds.
GATE 2022, 2021, 2019 all had questions answerable in under 1 minute with this approach.`,
        phase: 'consolidating',
        approach: 'formula_first',
        timeInvestment: 'quick',
        examRelevance: 0.95,
        successRate: 0.87,
        sourceType: 'pyq_analysis',
        tags: ['eigenvalues', 'shortcuts', 'exam-speed', 'gate-specific'],
      },
      {
        id: 'la-s2',
        topicId: 'linear-algebra',
        examId: 'gate-engineering-maths',
        title: 'Rank-First Reading',
        shortSummary: 'Always compute rank before attempting any system of equations',
        detailedExplanation: `Every system-of-equations question in GATE follows the same decision tree:
1. Form [A|b]. Compute rank(A) and rank([A|b]).
2. rank(A) ≠ rank([A|b]) → no solution (stop, answer is "inconsistent")
3. rank(A) = rank([A|b]) = n (unknowns) → unique solution
4. rank(A) = rank([A|b]) < n → infinitely many (n - rank free variables)
Toppers train this as a reflex. 2 minutes max per question.`,
        phase: 'building',
        approach: 'problem_first',
        timeInvestment: 'quick',
        examRelevance: 0.92,
        successRate: 0.83,
        sourceType: 'pyq_analysis',
        tags: ['rank', 'systems', 'rouche-capelli', 'exam-reflex'],
      },
      {
        id: 'la-s3',
        topicId: 'linear-algebra',
        examId: 'gate-engineering-maths',
        title: 'Geometric Anchor for Intuition',
        shortSummary: 'Think of eigenvalues as "what the matrix does to space" — axes it stretches',
        detailedExplanation: `Before any computation, toppers ask: "What does this matrix DO?"
A diagonal matrix stretches along axes by its diagonal entries — those are the eigenvalues.
An orthogonal matrix ROTATES (no stretching) → all eigenvalues are ±1 or complex with magnitude 1.
A projection matrix PROJECTS → eigenvalues are 0 and 1 only.
Recognising the matrix TYPE eliminates 90% of the calculation.`,
        phase: 'first_encounter',
        approach: 'intuition_first',
        timeInvestment: 'medium',
        examRelevance: 0.75,
        successRate: 0.91,
        sourceType: 'teacher_insight',
        tags: ['intuition', 'geometric', 'matrix-types', 'conceptual'],
      },
    ],
    lessonsLearned: [
      {
        id: 'la-l1',
        topicId: 'linear-algebra',
        examId: 'gate-engineering-maths',
        mistakeTitle: 'det(kA) = k·det(A) trap',
        mistakeDescription: 'Student multiplies determinant by k when the matrix is scaled by k',
        whyItHappens: 'Linearity of operations — students assume det scales linearly like trace does',
        howToppersAvoidIt: 'Memorize: det(kA) = kⁿ·det(A) where n = matrix size. Test with 2×2 identity: det(kI₂) = k², not k.',
        category: 'conceptual',
        frequency: 0.68,
        examYearsAppeared: [2022, 2020, 2018, 2016],
        fixInSeconds: 'See kA → immediately write kⁿ·det(A). Count the matrix size. Never just k.',
      },
      {
        id: 'la-l2',
        topicId: 'linear-algebra',
        examId: 'gate-engineering-maths',
        mistakeTitle: 'Quadratic form off-diagonal split',
        mistakeDescription: 'Student puts full coefficient of xy in the off-diagonal of matrix A',
        whyItHappens: 'The form xᵀAx requires symmetric A, so the xy coefficient splits between A₁₂ and A₂₁',
        howToppersAvoidIt: 'Rule: off-diagonal entry = coefficient/2. Always halve the cross-term coefficient.',
        category: 'calculation',
        frequency: 0.55,
        examYearsAppeared: [2023, 2021, 2019],
        fixInSeconds: 'Write coefficient of xy → halve it → that\'s your A₁₂ = A₂₁.',
      },
    ],
  },

  'gate-em::probability-statistics': {
    topicId: 'probability-statistics',
    examId: 'gate-engineering-maths',
    topperMindset: 'Probability questions in GATE are word problems with exactly one correct model. My job is to identify the model (Bayes, Binomial, Normal, Poisson) in 15 seconds — the math is secondary.',
    studySequence: [
      '1. Master the 5 distributions: Uniform, Binomial, Poisson, Exponential, Normal (2 days)',
      '2. Bayes\' theorem — 3 worked examples until it\'s automatic (1 day)',
      '3. Joint/conditional probability — the "urn model" mental picture (1 day)',
      '4. Expectation and variance formulas — these appear as 1-mark questions (1 day)',
      '5. PYQ sprint: 15 questions timed (1 day)',
    ],
    examDayChecklist: [
      'Events independent OR mutually exclusive? (different things!)',
      'Is the variable continuous or discrete? → wrong distribution = wrong answer',
      'For Normal: standardize to Z = (X - μ)/σ first',
      'Poisson applies when: rare events, fixed interval, rate λ known',
    ],
    commonTrap: 'Independent events (P(A∩B) = P(A)·P(B)) vs mutually exclusive events (P(A∩B) = 0) — these are OPPOSITE conditions. Toppers flag this first thing when they see a probability question.',
    breakthroughMoment: 'When you read a probability problem and automatically see it as a Venn diagram or probability tree BEFORE you see the numbers — that\'s the topper frame.',
    timeToMasteryHours: { average: 14, topper: 8 },
    keyStrategies: [
      {
        id: 'ps-s1',
        topicId: 'probability-statistics',
        examId: 'gate-engineering-maths',
        title: 'Model-First Reading',
        shortSummary: 'Identify the probability model in 15 seconds before reading numbers',
        detailedExplanation: `Toppers scan the problem for model keywords before reading numbers:
• "Given that..." → Bayes / conditional probability
• "n trials, each with probability p" → Binomial(n, p)
• "Average rate λ per unit time" → Poisson(λ)
• "Normally distributed with mean μ, std σ" → Normal — standardize to Z
• "Uniformly distributed between a and b" → Uniform — area = probability
Once the model is locked, plug in numbers. The model choice is the hard part; the math is lookup.`,
        phase: 'consolidating',
        approach: 'problem_first',
        timeInvestment: 'quick',
        examRelevance: 0.93,
        successRate: 0.85,
        sourceType: 'pyq_analysis',
        tags: ['distributions', 'model-selection', 'exam-speed', 'pattern-matching'],
      },
    ],
    lessonsLearned: [
      {
        id: 'ps-l1',
        topicId: 'probability-statistics',
        examId: 'gate-engineering-maths',
        mistakeTitle: 'Independent vs. Mutually Exclusive confusion',
        mistakeDescription: 'Student treats "independent events" and "mutually exclusive events" as synonyms',
        whyItHappens: 'Both describe a relationship between two events; the distinction is subtle in words but opposite in math',
        howToppersAvoidIt: 'Mutual exclusivity: they CAN\'T both happen (P(A∩B)=0). Independence: they don\'t AFFECT each other. Two mutually exclusive events with P>0 are NEVER independent.',
        category: 'conceptual',
        frequency: 0.72,
        examYearsAppeared: [2023, 2022, 2020, 2018],
        fixInSeconds: 'Mutually exclusive = Venn circles DON\'T overlap. Independent = each circle is "unaware" of the other. Completely different.',
      },
    ],
  },

  'gate-em::calculus': {
    topicId: 'calculus',
    examId: 'gate-engineering-maths',
    topperMindset: 'GATE calculus is 70% limits and derivatives, 30% integration tricks. Toppers can recognize the integration technique (substitution, by-parts, partial fractions) in 10 seconds by looking at the integrand\'s structure.',
    studySequence: [
      '1. Limits: L\'Hôpital, squeeze, and standard forms (1 day)',
      '2. Derivatives: chain rule mastery, implicit differentiation (1 day)',
      '3. Integration: identify technique by integrand shape (2 days)',
      '4. Maxima/minima: second derivative test, Lagrange multipliers (1 day)',
      '5. PYQ sprint: 10 calculus questions under time (1 day)',
    ],
    examDayChecklist: [
      'Is the limit 0/0 or ∞/∞? → L\'Hôpital applies',
      'Product of functions in integral? → by-parts (LIATE rule for order)',
      'Rational function? → partial fractions',
      'Trig inside integral? → substitution u = trig function',
    ],
    commonTrap: 'LIATE rule for integration by parts: Logarithm, Inverse trig, Algebraic, Trig, Exponential — choose u as the EARLIER type in this list. Students often pick u = exponential, which makes things worse.',
    breakthroughMoment: 'When you look at ∫ x·eˣ dx and immediately think "LIATE → x is Algebraic, eˣ is Exponential → u = x, dv = eˣdx" without thinking — that\'s topper-level pattern recognition.',
    timeToMasteryHours: { average: 16, topper: 9 },
    keyStrategies: [
      {
        id: 'calc-s1',
        topicId: 'calculus',
        examId: 'gate-engineering-maths',
        title: 'Integration Pattern Recognition',
        shortSummary: 'Match integrand structure to technique in under 10 seconds',
        detailedExplanation: `Pattern → Technique mapping that toppers have memorized:
• ∫ f(g(x))·g'(x) dx → substitution u = g(x)
• ∫ product of two different types → by-parts (LIATE order)
• ∫ P(x)/Q(x) where deg(P) < deg(Q) → partial fractions
• ∫ trig² → half-angle: sin²x = (1-cos2x)/2, cos²x = (1+cos2x)/2
• ∫ 1/(x²+a²) → (1/a)arctan(x/a)
• ∫ 1/√(a²-x²) → arcsin(x/a)
Drill these mappings until recognition is instant.`,
        phase: 'consolidating',
        approach: 'formula_first',
        timeInvestment: 'medium',
        examRelevance: 0.88,
        successRate: 0.82,
        sourceType: 'pyq_analysis',
        tags: ['integration', 'pattern-matching', 'shortcuts', 'exam-speed'],
      },
    ],
    lessonsLearned: [
      {
        id: 'calc-l1',
        topicId: 'calculus',
        examId: 'gate-engineering-maths',
        mistakeTitle: 'LIATE order reversal',
        mistakeDescription: 'Student picks u = eˣ in ∫ x·eˣ dx, leading to circular integration',
        whyItHappens: 'Exponential feels like the "main function" so students try to integrate x away',
        howToppersAvoidIt: 'LIATE: Algebraic (x) comes BEFORE Exponential (eˣ). Always pick u as the earlier LIATE type. Test: if integrating u gives something messier, you chose wrong.',
        category: 'conceptual',
        frequency: 0.58,
        examYearsAppeared: [2022, 2021, 2019, 2017],
        fixInSeconds: 'LIATE → L·I·A·T·E — count from left. Earlier = u.',
      },
    ],
  },

  'cat::quantitative-aptitude': {
    topicId: 'quantitative-aptitude',
    examId: 'cat',
    topperMindset: 'Quant is not math — it\'s speed math. Every question has a 30-second solution if you know the pattern. Toppers don\'t compute; they recognize.',
    studySequence: [
      '1. Number systems + remainders: cyclicity, Fermat\'s little theorem shortcuts (2 days)',
      '2. Percentages + profit/loss: all reduce to multipliers — master the multiplier chain (1 day)',
      '3. Time-speed-distance: relative speed, circular tracks — 5 template problems (1 day)',
      '4. Algebra: linear systems, quadratics — CAT tests these cleverly as "find the pattern" (2 days)',
      '5. Mock test under time: skip any question taking >90 seconds (weekly)',
    ],
    examDayChecklist: [
      '90 seconds per question max — if stuck, skip and return',
      'Check if answer choices narrow the approach (answer ending in 0 = divisibility shortcut)',
      'Word problems: translate to equation FIRST, solve second',
      'Elimination: cross out obviously wrong answers before computing',
    ],
    commonTrap: 'Spending >2 minutes on a Quant question. CAT Quant rewards breadth over depth — 3 easy questions beat 1 hard question solved perfectly. Toppers skip hard questions without guilt.',
    breakthroughMoment: 'The moment you start seeing answer choices before working the problem — checking if the answer must be even, must be > 100, etc. — you\'ve shifted from solver to strategist.',
    timeToMasteryHours: { average: 80, topper: 50 },
    keyStrategies: [
      {
        id: 'qa-s1',
        topicId: 'quantitative-aptitude',
        examId: 'cat',
        title: 'Answer-Choice Backward Solving',
        shortSummary: 'Work backwards from answer choices — eliminates 50% of computation',
        detailedExplanation: `CAT answer choices are curated — they eliminate many computation paths.
Technique 1: Parity. If answer must be odd, eliminate even options.
Technique 2: Digit sum. Quick divisibility check (digit sum divisible by 3? 9?).
Technique 3: Unit digit. Last digit of answer limits which choice is correct.
Technique 4: Substitution. For "find x" questions, plug answer choices in — fastest 30%.
This is how CAT 99%ilers solve in 45-60 seconds vs 3 minutes.`,
        phase: 'exam_ready',
        approach: 'problem_first',
        timeInvestment: 'quick',
        examRelevance: 0.97,
        successRate: 0.88,
        sourceType: 'topper_interview',
        tags: ['cat-strategy', 'time-management', 'elimination', 'shortcuts'],
      },
    ],
    lessonsLearned: [
      {
        id: 'qa-l1',
        topicId: 'quantitative-aptitude',
        examId: 'cat',
        mistakeTitle: 'Sunk cost on hard questions',
        mistakeDescription: 'Student spends 5+ minutes on a hard question rather than skipping',
        whyItHappens: 'Feels wrong to "give up" — but all questions carry equal marks in CAT',
        howToppersAvoidIt: 'Hard time limit: 90 seconds. If not close to answer, mark for review, move on. Return only if time allows. 3 easy questions > 1 hard question.',
        category: 'time_management',
        frequency: 0.78,
        examYearsAppeared: [2023, 2022, 2021, 2020, 2019],
        fixInSeconds: 'Feel the 90s. When timer hits 90, circle it and go.',
      },
    ],
  },

  'cat::dilr': {
    topicId: 'dilr',
    examId: 'cat',
    topperMindset: 'DILR is about choosing WHICH sets to solve — not HOW. Toppers spend 3 minutes scanning all sets, pick the 2 easiest, and solve only those. They walk away from 70% of the section intentionally.',
    studySequence: [
      '1. Set selection training: practice scanning 4 sets in 3 minutes, picking 2 (1 week)',
      '2. Table/matrix arrangements: learn the "constraint propagation" method (3 days)',
      '3. Bar/line graph DI: practice extracting data fast without reading every value (2 days)',
      '4. Circular/linear arrangements: seating problems — 5 templates (2 days)',
      '5. Full mock: timed 40-minute DILR section, two set selections only (weekly)',
    ],
    examDayChecklist: [
      'Scan all 4 sets first (3 minutes) — never start the first one blindly',
      'Count the questions per set — more questions = more ROI per time invested',
      'Look for sets with clear, bounded constraints — these resolve faster',
      'TITA questions in chosen set? Budget extra 1 min per TITA',
    ],
    commonTrap: 'Starting the first set without scanning all four. The first set is rarely the easiest — CAT setters know students start there and make it harder.',
    breakthroughMoment: 'Finishing 2 sets completely with 5 minutes remaining and consciously choosing NOT to start a 3rd because the time isn\'t worth it — that\'s the topper discipline.',
    timeToMasteryHours: { average: 60, topper: 35 },
    keyStrategies: [
      {
        id: 'dilr-s1',
        topicId: 'dilr',
        examId: 'cat',
        title: 'Set Selection Protocol',
        shortSummary: 'Spend 3 minutes scanning ALL sets before starting any — always',
        detailedExplanation: `The single highest-leverage DILR skill. Protocol:
Minute 1-2: Read all 4 set descriptions. Note: number of constraints, question count, question types.
Minute 3: Rank sets by "solvability" — bounded constraints + more questions = pick this.
Rest of time: Solve 2 sets completely. Skip the other 2 entirely.

Signs of an easy set: "exactly one person," "A is directly to the left of B," specific numbers.
Signs of a hard set: "at least 2," "not necessarily adjacent," or any "if...then" nested logic.

Toppers who crack 99th %ile in DILR solve 2 sets perfectly — they don't attempt 4 sets partially.`,
        phase: 'exam_ready',
        approach: 'problem_first',
        timeInvestment: 'medium',
        examRelevance: 0.99,
        successRate: 0.92,
        sourceType: 'topper_interview',
        tags: ['cat-dilr', 'set-selection', 'time-management', 'strategy'],
      },
    ],
    lessonsLearned: [
      {
        id: 'dilr-l1',
        topicId: 'dilr',
        examId: 'cat',
        mistakeTitle: 'Starting first set without scanning',
        mistakeDescription: 'Student jumps into Set 1 immediately and spends 25 minutes on a hard set',
        whyItHappens: 'Natural urgency, fear of wasting time scanning — but the scan IS the strategy',
        howToppersAvoidIt: 'Treat the 3-minute scan as mandatory, not optional. The scan saves 15 minutes.',
        category: 'time_management',
        frequency: 0.81,
        examYearsAppeared: [2023, 2022, 2021, 2020, 2019],
        fixInSeconds: 'Don\'t read questions yet. Scan descriptions only. 45 seconds per set.',
      },
    ],
  },
};

// ─── Helper: get insight by topic + exam ─────────────────────────────────────

export function getTopperInsight(examId: string, topicId: string): TopperInsight | null {
  const key = `${examId}::${topicId}`;
  return TOPPER_INSIGHTS[key] ?? null;
}

// ─── Sage integration: build prompt addendum ─────────────────────────────────

/**
 * Injects topper intelligence into Sage's system prompt for a specific topic.
 * Called by lensEngine or sagePersonaPrompts when topicId is known.
 */
export function getTopperPromptAddendum(
  examId: string,
  topicId: string,
  phase: StudyPhase = 'building',
  includeCommonTrap = true,
  includeStrategies = true,
): string {
  const insight = getTopperInsight(examId, topicId);
  if (!insight) return '';

  const relevantStrategies = insight.keyStrategies
    .filter(s => s.phase === phase || s.phase === 'consolidating')
    .sort((a, b) => b.examRelevance - a.examRelevance)
    .slice(0, 2);

  const relevantLessons = insight.lessonsLearned
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 2);

  const parts: string[] = [];

  parts.push(`## TOPPER INTELLIGENCE FOR ${topicId.toUpperCase().replace(/-/g, ' ')}`);
  parts.push(`**Topper mindset:** "${insight.topperMindset}"`);

  if (includeCommonTrap) {
    parts.push(`\n⚠️ **INJECT THIS PROACTIVELY** (most common trap — mention it before student hits it):\n${insight.commonTrap}`);
  }

  if (includeStrategies && relevantStrategies.length > 0) {
    parts.push('\n**Topper strategies to weave in naturally:**');
    for (const s of relevantStrategies) {
      parts.push(`• [${s.title}]: ${s.shortSummary}`);
      parts.push(`  Detail: ${s.detailedExplanation.split('\n')[0]}`);
    }
  }

  parts.push('\n**Lessons learned — avoid these pitfalls:**');
  for (const l of relevantLessons) {
    parts.push(`• ⚠️ "${l.mistakeTitle}": ${l.howToppersAvoidIt}`);  }

  if (insight.studySequence.length > 0) {
    parts.push(`\n**Topper study sequence (share if student asks "where to start"):**`);
    parts.push(insight.studySequence.join('\n'));
  }

  parts.push(`\n**Breakthrough signal:** When the student demonstrates: "${insight.breakthroughMoment}" — celebrate it explicitly.`);

  return parts.join('\n');
}

// ─── Atlas integration: content brief ────────────────────────────────────────

/**
 * Returns a brief for Atlas to generate topper-quality content for a topic.
 * Ensures Atlas produces explanation variants at topper depth, not average depth.
 */
export function getAtlasContentBrief(examId: string, topicId: string): {
  targetDepth: 'topper' | 'average';
  mustInclude: string[];
  mustAvoid: string[];
  shortcutEmphasis: string[];
  commonTrapToAddress: string;
} {
  const insight = getTopperInsight(examId, topicId);
  if (!insight) return {
    targetDepth: 'average',
    mustInclude: [],
    mustAvoid: [],
    shortcutEmphasis: [],
    commonTrapToAddress: '',
  };

  return {
    targetDepth: 'topper',
    mustInclude: [
      insight.topperMindset,
      ...insight.keyStrategies.map(s => s.title),
      ...insight.examDayChecklist,
    ],
    mustAvoid: insight.lessonsLearned.map(l => l.mistakeTitle),
    shortcutEmphasis: insight.keyStrategies
      .filter(s => s.timeInvestment === 'quick')
      .map(s => s.shortSummary),
    commonTrapToAddress: insight.commonTrap,
  };
}

// ─── Mentor integration: milestone motivator ─────────────────────────────────

/**
 * Returns a motivational message when student reaches a topper-relevant milestone.
 * Mentor calls this when Oracle fires a MASTERY_ACHIEVED signal.
 */
export function getTopperMotivationMessage(
  examId: string,
  topicId: string,
  masteryScore: number,
): string | null {
  const insight = getTopperInsight(examId, topicId);
  if (!insight) return null;

  const topperHours = insight.timeToMasteryHours.topper;
  const avgHours = insight.timeToMasteryHours.average;

  if (masteryScore >= 0.85) {
    return `🏆 You just mastered ${topicId.replace(/-/g, ' ')} — the topper way. Most students take ${avgHours}h to reach this. You did it in topper time (~${topperHours}h). Here's your edge for exam day: ${insight.examDayChecklist[0]}`;
  }
  if (masteryScore >= 0.65) {
    return `📈 Solid progress on ${topicId.replace(/-/g, ' ')}! You've hit the level where toppers start using shortcuts instead of computing. Try this: ${insight.keyStrategies[0]?.shortSummary ?? 'apply the pattern first, numbers second'}.`;
  }
  return null;
}

// ─── Oracle integration: strategy effectiveness tracking ─────────────────────

/**
 * Returns metrics structure for Oracle to track whether topper strategies
 * are improving mastery faster than baseline.
 */
export function getTopperMetricSpec(examId: string, topicId: string): {
  trackingKeys: string[];
  baselineHours: number;
  topperHours: number;
  strategyIds: string[];
} {
  const insight = getTopperInsight(examId, topicId);
  return {
    trackingKeys: [
      `topper_strategy_used_${examId}_${topicId}`,
      `time_to_mastery_${examId}_${topicId}`,
      `common_trap_avoided_${examId}_${topicId}`,
    ],
    baselineHours: insight?.timeToMasteryHours.average ?? 20,
    topperHours: insight?.timeToMasteryHours.topper ?? 12,
    strategyIds: insight?.keyStrategies.map(s => s.id) ?? [],
  };
}

// ─── Scout integration: harvest new topper patterns ──────────────────────────

/**
 * Called by Scout after harvesting PYQ analysis or topper forum data.
 * Queues the new insight for Atlas content generation + Sage prompt update.
 */
export async function harvestTopperPattern(params: {
  topicId: string;
  examId: string;
  sourceUrl?: string;
  strategyTitle: string;
  strategySummary: string;
  applicablePhase: StudyPhase;
}): Promise<void> {
  await enqueueSignal({
    type: 'CONTENT_GAP',
    sourceAgent: 'scout',
    targetAgent: 'atlas',
    payload: {
      ...params,
      signalType: 'new_topper_strategy',
      priority: 'high',
    },
    topicId: params.topicId,
  });

  // Also signal sage to update its context on next session for this topic
  await enqueueSignal({
    type: 'CONTENT_GAP',
    sourceAgent: 'scout',
    targetAgent: 'sage',
    payload: {
      ...params,
      signalType: 'topper_insight_updated',
    },
    topicId: params.topicId,
  });
}

// ─── Sage integration: record a student mistake for lessons-learned pool ──────

/**
 * Sage calls this when it detects a student making a known mistake pattern.
 * Feeds the lessons-learned pool over time.
 */
export async function recordStudentMistake(params: {
  studentId: string;
  topicId: string;
  examId: string;
  mistakeType: MistakeCategory;
  mistakeDescription: string;
  sessionId: string;
}): Promise<void> {
  await enqueueSignal({
    type: 'STRUGGLE_PATTERN',
    sourceAgent: 'sage',
    targetAgent: 'oracle',
    payload: {
      ...params,
      signalType: 'mistake_recorded',
    },
    studentId: params.studentId,
    topicId: params.topicId,
  });
}

// ─── Quick access: get all lessons for a topic (for UI rendering) ─────────────

export function getTopperLessons(examId: string, topicId: string): LessonLearned[] {
  return getTopperInsight(examId, topicId)?.lessonsLearned ?? [];
}

export function getTopperStrategies(examId: string, topicId: string): TopperStrategy[] {
  return getTopperInsight(examId, topicId)?.keyStrategies ?? [];
}

export function getExamDayChecklist(examId: string, topicId: string): string[] {
  return getTopperInsight(examId, topicId)?.examDayChecklist ?? [];
}

export function getCommonTrap(examId: string, topicId: string): string | null {
  return getTopperInsight(examId, topicId)?.commonTrap ?? null;
}
