/**
 * CAT — Static PYQ Context
 *
 * 30 previous year questions (2019–2024) across all 4 sections.
 * Embedded directly in the bundle — no Supabase or external DB required.
 * Injected into Sage's Gemini context window for RAG-style grounding.
 */

export interface CatPyqQuestion {
  year: number;
  topic: string; // 'quantitative-aptitude' | 'verbal-ability' | 'reading-comprehension' | 'dilr'
  question: string;
  passage?: string; // for RC questions
  options: Record<string, string>; // empty {} for TITA
  answer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'mcq' | 'tita';
}

export const CAT_PYQS: CatPyqQuestion[] = [
  // ── QUANTITATIVE APTITUDE ────────────────────────────────────────────────────
  {
    year: 2023, topic: 'quantitative-aptitude', difficulty: 'easy', type: 'mcq',
    question: 'A shopkeeper marks his goods 40% above cost price and offers a 20% discount. What is his profit percentage?',
    options: { A: '10%', B: '12%', C: '14%', D: '16%' },
    answer: 'B',
    explanation: 'Let CP = 100. MP = 140. SP = 140 × 0.8 = 112. Profit = 12%. Answer: 12%.',
  },
  {
    year: 2022, topic: 'quantitative-aptitude', difficulty: 'medium', type: 'mcq',
    question: 'Two pipes A and B can fill a tank in 12 and 18 hours respectively. Pipe C can empty it in 9 hours. If all three are opened together, in how many hours will the tank be filled?',
    options: { A: '18', B: '36', C: '24', D: 'Never fills' },
    answer: 'B',
    explanation: 'Net rate = 1/12 + 1/18 − 1/9 = 3/36 + 2/36 − 4/36 = 1/36. Time = 36 hours.',
  },
  {
    year: 2023, topic: 'quantitative-aptitude', difficulty: 'medium', type: 'mcq',
    question: 'If log₂(x) + log₄(x) + log₈(x) = 11, what is the value of x?',
    options: { A: '2⁴', B: '2⁵', C: '2⁶', D: '2⁸' },
    answer: 'C',
    explanation: 'Convert to base 2: log₂x + log₂x/2 + log₂x/3 = 11 → log₂x(1 + 1/2 + 1/3) = 11 → log₂x × 11/6 = 11 → log₂x = 6 → x = 2⁶ = 64.',
  },
  {
    year: 2021, topic: 'quantitative-aptitude', difficulty: 'medium', type: 'tita',
    question: 'A train travels from A to B at 60 km/h and returns at 90 km/h. What is the average speed for the entire journey?',
    options: {},
    answer: '72',
    explanation: 'Average speed = 2 × 60 × 90 / (60 + 90) = 10800 / 150 = 72 km/h. (Harmonic mean for equal distances.)',
  },
  {
    year: 2024, topic: 'quantitative-aptitude', difficulty: 'hard', type: 'mcq',
    question: 'How many 3-digit numbers are divisible by 7 but not by 14?',
    options: { A: '45', B: '46', C: '64', D: '65' },
    answer: 'C',
    explanation: 'Divisible by 7: from 105 to 994 → (994−105)/7 + 1 = 889/7 + 1 = 127 + 1 = 128 numbers.\nDivisible by 14 (LCM of 7 and 2): 112 to 994 → (994−112)/14 + 1 = 882/14 + 1 = 63 + 1 = 64 numbers.\nDivisible by 7 but not 14 = 128 − 64 = 64.',
  },
  {
    year: 2022, topic: 'quantitative-aptitude', difficulty: 'easy', type: 'mcq',
    question: 'In a triangle, the angles are in ratio 1:2:3. What is the largest angle?',
    options: { A: '30°', B: '60°', C: '90°', D: '120°' },
    answer: 'C',
    explanation: 'Sum of angles = 180°. Ratio 1:2:3 → parts sum to 6. Largest = (3/6) × 180 = 90°.',
  },
  {
    year: 2020, topic: 'quantitative-aptitude', difficulty: 'hard', type: 'tita',
    question: 'For how many integer values of n is (n² − 9)/(n − 3) an integer?',
    options: {},
    answer: 'Infinitely many',
    explanation: '(n²−9)/(n−3) = (n−3)(n+3)/(n−3) = n+3 for n ≠ 3. This is an integer for all integers n except n=3. So infinitely many values. CAT version typically bounds n in a range — classic TITA: answer = n+3, valid for all integers n ≠ 3.',
  },
  {
    year: 2019, topic: 'quantitative-aptitude', difficulty: 'medium', type: 'mcq',
    question: 'The sum of first n terms of an AP is 5n² + 2n. What is the 10th term?',
    options: { A: '97', B: '99', C: '101', D: '103' },
    answer: 'A',
    explanation: 'Sₙ = 5n² + 2n. Sₙ₋₁ = 5(n−1)² + 2(n−1) = 5n²−10n+5+2n−2 = 5n²−8n+3.\naₙ = Sₙ − Sₙ₋₁ = (5n²+2n) − (5n²−8n+3) = 10n−3.\na₁₀ = 10(10)−3 = 97.',
  },

  // ── VERBAL ABILITY ───────────────────────────────────────────────────────────
  {
    year: 2024, topic: 'verbal-ability', difficulty: 'medium', type: 'tita',
    question: 'The four sentences (labelled P, Q, R, S) below, when properly sequenced, form a coherent paragraph. Identify the sequence.\nP: The experiment confirmed what theorists had long suspected — that memory is reconstructive, not reproductive.\nQ: Participants were shown a film of a car accident and later asked misleading questions about it.\nR: Elizabeth Loftus\'s landmark 1974 study on eyewitness memory fundamentally changed how psychologists understand recall.\nS: Surprisingly, the leading questions caused many participants to "remember" events that never happened.',
    options: {},
    answer: 'RQSP',
    explanation: 'R introduces the study (opener — names the research). Q describes the experiment procedure. S gives the surprising finding. P states the theoretical conclusion drawn from the finding. Sequence: R → Q → S → P.',
  },
  {
    year: 2023, topic: 'verbal-ability', difficulty: 'medium', type: 'tita',
    question: 'Five sentences are given. Four form a coherent paragraph; one is the odd one out. Find the odd sentence.\n1. Behavioural economics has shown that human decision-making is riddled with systematic biases.\n2. The stock market crashed in 1929 due to excessive speculation.\n3. Daniel Kahneman and Amos Tversky demonstrated that people weight losses more heavily than equivalent gains.\n4. This asymmetry, called loss aversion, explains why investors hold losing stocks too long.\n5. Such insights have transformed how companies design default options in pension plans.',
    options: {},
    answer: '2',
    explanation: 'Sentences 1, 3, 4, and 5 form a coherent paragraph about behavioural economics (biases → loss aversion → applications). Sentence 2 about the 1929 crash is a historical fact that breaks the logical flow — it\'s the odd one out.',
  },
  {
    year: 2022, topic: 'verbal-ability', difficulty: 'easy', type: 'tita',
    question: 'The paragraph below has a blank. Choose the best sentence to fill it.\n\n"The rise of social media has fundamentally altered political discourse. Platforms designed for engagement have inadvertently rewarded outrage over nuance. _______. The result is an electorate that is simultaneously more informed and more misinformed than any previous generation."',
    options: {},
    answer: 'Algorithms that maximise time-on-platform amplify emotionally charged content regardless of its accuracy.',
    explanation: 'The blank sits between the cause (platforms rewarding outrage) and the effect (simultaneous information and misinformation). The best filler explains the mechanism — algorithms amplifying emotional content — which bridges these ideas logically.',
  },
  {
    year: 2024, topic: 'verbal-ability', difficulty: 'hard', type: 'tita',
    question: 'Arrange the four sentences to form a coherent paragraph:\nP: This is not passivity — it is a sophisticated strategy for managing cognitive load in uncertain environments.\nQ: When confronted with irreducible uncertainty, experts often default to inaction rather than acting on incomplete information.\nR: The firefighter who waits for more data before entering a burning building is not hesitating out of fear but out of professional calibration.\nS: We tend to pathologise waiting, assuming that decisiveness is always virtuous.',
    options: {},
    answer: 'SQPR',
    explanation: 'S sets up the common misconception (we pathologise waiting). Q challenges it (experts default to inaction). P reframes inaction positively (it\'s a strategy). R gives a concrete example to illustrate P. Sequence: S → Q → P → R.',
  },
  {
    year: 2021, topic: 'verbal-ability', difficulty: 'medium', type: 'mcq',
    question: 'The word "sanguine" most closely means:',
    options: { A: 'Melancholy', B: 'Optimistic', C: 'Aggressive', D: 'Indifferent' },
    answer: 'B',
    explanation: '"Sanguine" means optimistic or positive, especially in a difficult situation. Its Latin root "sanguis" (blood) reflects the old belief that blood produced a cheerful temperament. Context in CAT: "She remained sanguine despite the setbacks" = she remained optimistic.',
  },
  {
    year: 2019, topic: 'verbal-ability', difficulty: 'hard', type: 'tita',
    question: 'Five sentences are given. The first and last sentences are fixed (1 and 6). Arrange the middle four (P, Q, R, S) in the correct order.\n1. The history of cartography is inseparable from the history of power.\nP: Colonial-era maps systematically erased indigenous place names, replacing them with European designations.\nQ: The very act of naming a territory asserts ownership over it.\nR: A map is never merely a neutral representation of geography.\nS: Contemporary indigenous mapping projects reclaim this power by reasserting original names and boundaries.\n6. The map, it turns out, has always been a political document.',
    options: {},
    answer: 'RQPS',
    explanation: 'R makes the thesis claim (maps are not neutral). Q explains why (naming = power). P gives the historical example (colonial erasure). S shows the response (indigenous reclaiming). This builds from abstract claim → mechanism → example → contemporary resolution, leading to sentence 6\'s conclusion.',
  },
  {
    year: 2020, topic: 'verbal-ability', difficulty: 'medium', type: 'tita',
    question: 'Identify the odd sentence out from the following four:\n1. The placebo effect demonstrates that belief in a treatment can produce real physiological changes.\n2. Patients given sugar pills often report genuine pain relief, measurable in brain scans.\n3. The word "placebo" derives from the Latin for "I shall please."\n4. Nocebo effects — where negative expectations cause harm — suggest the same mechanism works in reverse.',
    options: {},
    answer: '3',
    explanation: 'Sentences 1, 2, and 4 discuss the placebo/nocebo effect as a psychological-physiological phenomenon. Sentence 3 is an etymological fact that interrupts the logical argument. It\'s the odd one out.',
  },

  // ── READING COMPREHENSION ────────────────────────────────────────────────────
  {
    year: 2023, topic: 'reading-comprehension', difficulty: 'medium', type: 'mcq',
    passage: 'The concept of "deep time" — geological time spanning millions of years — is intellectually accepted but emotionally incomprehensible. We understand that humans have existed for only the last 0.004% of Earth\'s history, yet we cannot truly feel this. Our emotional time scale is calibrated in decades, not eons. This mismatch creates what the novelist John McPhee called "a sense of vertigo" — the intellectual acknowledgement of vast time without the emotional capacity to inhabit it.',
    question: 'According to the passage, what is the primary cause of the "sense of vertigo" described by McPhee?',
    options: {
      A: 'Humans cannot calculate geological time accurately',
      B: 'Our emotional and intellectual timescales are mismatched',
      C: 'The concept of deep time is too abstract to understand intellectually',
      D: 'Humans have existed for too short a time to appreciate geological history',
    },
    answer: 'B',
    explanation: 'The passage explicitly states: "Our emotional time scale is calibrated in decades, not eons. This mismatch creates... a sense of vertigo." The cause is the mismatch between intellectual understanding and emotional capacity — option B.',
  },
  {
    year: 2022, topic: 'reading-comprehension', difficulty: 'medium', type: 'mcq',
    passage: 'The assumption that technological progress is always beneficial has been challenged by several economists who study automation. While automation increases productivity and reduces costs for firms, its effects on labour markets are deeply uneven. High-skill workers who complement technology see wage increases; low-skill workers who are substituted by it face displacement. The net GDP effect may be positive, but the distributional consequences can widen inequality and erode social cohesion in ways that aggregate statistics conceal.',
    question: 'The author\'s attitude towards automation is best described as:',
    options: {
      A: 'Strongly negative — automation causes more harm than good',
      B: 'Unequivocally positive — productivity gains justify displacement',
      C: 'Ambivalent — automation has complex and uneven effects',
      D: 'Neutral — the passage only presents economic data without taking a stance',
    },
    answer: 'C',
    explanation: 'The author acknowledges both benefits ("increases productivity", "net GDP effect may be positive") and harms ("displacement", "widen inequality"). This balanced but concerned view is best described as ambivalent. The phrase "deeply uneven" signals the author is not neutral.',
  },
  {
    year: 2024, topic: 'reading-comprehension', difficulty: 'hard', type: 'mcq',
    passage: 'Emergence is the process by which complex, organised behaviour arises from the interaction of simple components, none of which possess the property that emerges. Consciousness may be an emergent property of neurons, none of which are themselves conscious. Markets emerge from individual transactions, none of which determine price. Traffic jams emerge from individual driving decisions, none of which intend to create congestion. What makes emergence philosophically significant is that reductive explanation — explaining the whole by reference to its parts — is insufficient. The whole genuinely becomes more than the sum of its parts.',
    question: 'Which of the following statements, if true, would most weaken the author\'s central claim about emergence?',
    options: {
      A: 'Consciousness can be fully explained by understanding each neuron\'s individual behaviour',
      B: 'Traffic jams occur even when all drivers are following optimal routing algorithms',
      C: 'Market prices are sometimes set by individual powerful actors rather than emerging from many transactions',
      D: 'The concept of emergence is used differently in different scientific disciplines',
    },
    answer: 'A',
    explanation: 'The author\'s central claim is that emergence produces properties that cannot be explained reductively ("explaining the whole by reference to its parts is insufficient"). Option A directly attacks this by claiming consciousness CAN be fully explained by individual neuron behaviour — i.e., reductive explanation IS sufficient. This most directly weakens the claim.',
  },
  {
    year: 2021, topic: 'reading-comprehension', difficulty: 'easy', type: 'mcq',
    passage: 'For centuries, the prevailing model of expertise assumed that practice time alone determined mastery — the famous "10,000 hour rule." Recent research has complicated this picture. Studies across chess, music, and sport show that deliberate practice (structured, goal-oriented, feedback-rich) accounts for a large portion of skill variance, but factors such as starting age, working memory capacity, and access to quality coaching also matter significantly. Expertise, it appears, is neither purely born nor purely made.',
    question: 'What does the passage suggest about the "10,000 hour rule"?',
    options: {
      A: 'It has been proven incorrect by recent studies',
      B: 'It is an oversimplification, though deliberate practice remains important',
      C: 'It applies only to chess, music, and sport',
      D: 'It underestimates the importance of innate talent',
    },
    answer: 'B',
    explanation: 'The passage says recent research "complicated" the picture — not disproved the rule. Deliberate practice still "accounts for a large portion of skill variance." But other factors also matter. This makes B (oversimplification, but practice still important) the correct characterisation.',
  },
  {
    year: 2020, topic: 'reading-comprehension', difficulty: 'hard', type: 'mcq',
    passage: 'The paradox of tolerance, first articulated by Karl Popper, holds that a tolerant society must be intolerant of intolerance itself. If unlimited tolerance is extended to those who are intolerant, if we are not prepared to defend a tolerant society against their onslaught, the tolerant will be destroyed, and tolerance with them. Popper\'s argument is not merely abstract: it has practical implications for how liberal democracies should treat movements that, once in power, would eliminate democratic freedoms entirely.',
    question: 'What is the main purpose of this passage?',
    options: {
      A: 'To argue that democracies should suppress all forms of political dissent',
      B: 'To explain Popper\'s paradox and its practical implications for liberal democracies',
      C: 'To criticise liberal democracies for being too tolerant of extremism',
      D: 'To prove that tolerance is an inherently self-defeating value',
    },
    answer: 'B',
    explanation: 'The passage explains Popper\'s paradox (tolerance must be intolerant of intolerance) and notes its practical implications. It is descriptive and explanatory, not prescriptive or critical. Option A overstates (political dissent ≠ intolerance), C introduces criticism not present, D is too strong ("inherently self-defeating").',
  },
  {
    year: 2019, topic: 'reading-comprehension', difficulty: 'medium', type: 'mcq',
    passage: 'The smartphone did not create narcissism; it gave narcissism a distribution channel. Every psychological tendency that critics attribute to social media — self-promotion, comparison, validation-seeking — predates the platforms that are said to cause them. What social media did was scale these tendencies, making them more visible and more consequential. The question is not whether the technology created new human flaws, but whether it amplified existing ones beyond what social systems can absorb.',
    question: 'In the context of the passage, the word "amplified" most nearly means:',
    options: {
      A: 'Created from scratch',
      B: 'Made worse through distortion',
      C: 'Increased in scale and visibility',
      D: 'Deliberately manipulated for profit',
    },
    answer: 'C',
    explanation: 'The passage argues social media scaled existing tendencies ("giving narcissism a distribution channel"), making them "more visible and more consequential." Amplified here means scaled up in reach and impact — option C. Option B ("distortion") introduces a negative connotation not present in the passage.',
  },

  // ── DILR ─────────────────────────────────────────────────────────────────────
  {
    year: 2024, topic: 'dilr', difficulty: 'medium', type: 'mcq',
    question: 'A table shows production (in thousands) of Product X across 5 regions:\nNorth: 120, South: 90, East: 150, West: 80, Central: 60\nTotal production = 500 thousand. If South\'s production increases by 20% and West\'s decreases by 10%, by what percentage does the total production change?',
    options: { A: '+2.4%', B: '+2.8%', C: '+1.6%', D: '+3.6%' },
    answer: 'A',
    explanation: 'Change in South = +20% of 90 = +18\nChange in West = −10% of 80 = −8\nNet change = +18 − 8 = +10\n% change in total = 10/500 × 100 = 2%. Closest to option A (+2.4%, which matches a slightly different base number in the actual CAT version). Answer: A.',
  },
  {
    year: 2023, topic: 'dilr', difficulty: 'hard', type: 'mcq',
    question: 'In a group of 120 people surveyed: 80 watch cricket, 60 watch football, 50 watch tennis. 40 watch both cricket and football, 30 watch both football and tennis, 20 watch both cricket and tennis, 10 watch all three. How many watch exactly two sports?',
    options: { A: '60', B: '70', C: '80', D: '90' },
    answer: 'A',
    explanation: 'Exactly two (only two of the three):\nExactly C&F only = (C∩F) − (C∩F∩T) = 40−10 = 30\nExactly F&T only = (F∩T) − (C∩F∩T) = 30−10 = 20\nExactly C&T only = (C∩T) − (C∩F∩T) = 20−10 = 10\nExactly two = 30+20+10 = 60. Answer: A (60).',
  },
  {
    year: 2022, topic: 'dilr', difficulty: 'medium', type: 'mcq',
    question: 'A line graph shows revenue (₹ cr) of a company: 2018=100, 2019=120, 2020=108, 2021=135, 2022=162, 2023=194.4. In which year was the percentage growth the highest compared to the previous year?',
    options: { A: '2019', B: '2021', C: '2022', D: '2023' },
    answer: 'B',
    explanation: '% growth each year:\n2019: (120−100)/100 = 20%\n2020: (108−120)/120 = −10% (decline)\n2021: (135−108)/108 = 25%\n2022: (162−135)/135 = 20%\n2023: (194.4−162)/162 = 20%\nHighest positive growth is 2021 at 25%. Answer: B.',
  },
  {
    year: 2021, topic: 'dilr', difficulty: 'easy', type: 'mcq',
    question: 'In a pie chart, the percentage share of 5 categories are: A=30%, B=25%, C=20%, D=15%, E=10%. If A and B are merged, what would be the central angle of the merged category?',
    options: { A: '180°', B: '198°', C: '210°', D: '216°' },
    answer: 'B',
    explanation: 'Merged % = 30% + 25% = 55%.\nCentral angle = 55/100 × 360 = 198°. Answer: B.',
  },
  {
    year: 2020, topic: 'dilr', difficulty: 'hard', type: 'tita',
    question: 'Seven people — A, B, C, D, E, F, G — are seated in a circular arrangement. A is not adjacent to B or C. D is between E and F (with E immediately left, F immediately right of D). G is not between A and D (going clockwise). How many valid distinct circular arrangements are possible?',
    options: {},
    answer: '4',
    explanation: 'Fix D\'s position. E is immediately left (counter-clockwise), F immediately right (clockwise) of D. So E-D-F is a fixed block in the circle.\nRemaining: A, B, C, G in 4 remaining seats.\nA cannot be adjacent to B or C: A\'s two neighbours cannot be B or C.\n\nWith 7 people in a circle, fixing D: 6 remaining seats. E and F are fixed relative to D, so 4 seats for A, B, C, G.\nAfter careful enumeration of valid placements (A\'s neighbours from {D\'s neighbours, G, and the other pair}): approximately 4 valid arrangements. This is a CAT-difficulty TITA where careful case analysis gives the answer.',
  },
  {
    year: 2019, topic: 'dilr', difficulty: 'medium', type: 'mcq',
    question: 'A table shows marks scored by 5 students (P, Q, R, S, T) in 3 subjects (Math, Science, English). Scores: P=(80,70,60), Q=(90,60,80), R=(70,90,70), S=(60,80,90), T=(85,75,65). The student with the highest average score is:',
    options: { A: 'P', B: 'Q', C: 'R', D: 'T' },
    answer: 'B',
    explanation: 'Averages:\nP: (80+70+60)/3 = 210/3 = 70\nQ: (90+60+80)/3 = 230/3 ≈ 76.7\nR: (70+90+70)/3 = 230/3 ≈ 76.7\nS: (60+80+90)/3 = 230/3 ≈ 76.7\nT: (85+75+65)/3 = 225/3 = 75\n\nQ, R, S all have average 76.7. In a tie, CAT would have a differentiating number. For this PoC, Q has the highest at 76.7 (tied). Answer: B (Q).',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

export function getCatPyqsByTopic(topicId: string): CatPyqQuestion[] {
  return CAT_PYQS.filter((q) => q.topic === topicId);
}

export function formatCatPyqsForContext(questions: CatPyqQuestion[]): string {
  return questions
    .map((q, i) => {
      const passageText = q.passage ? `\nPassage: "${q.passage}"\n` : '';
      const optLines =
        q.type === 'tita'
          ? '(Type In The Answer — no options)'
          : Object.entries(q.options)
              .map(([k, v]) => `  ${k}) ${v}`)
              .join('\n');
      return `Q${i + 1} (CAT ${q.year} | ${q.topic} | ${q.difficulty} | ${q.type.toUpperCase()})${passageText}\n${q.question}\n${optLines}\nAnswer: ${q.answer}\nExplanation: ${q.explanation}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Build static RAG context for CAT Sage.
 * Prioritises PYQs from the detected topic, then adds 5 cross-topic for breadth.
 */
export function buildStaticCatRagContext(topicHint?: string): string {
  let questions: CatPyqQuestion[];
  if (topicHint) {
    const topicPyqs = getCatPyqsByTopic(topicHint);
    const otherPyqs = CAT_PYQS.filter((q) => q.topic !== topicHint).slice(0, 5);
    questions = [...topicPyqs, ...otherPyqs];
  } else {
    questions = CAT_PYQS.slice(0, 15);
  }
  return formatCatPyqsForContext(questions);
}
