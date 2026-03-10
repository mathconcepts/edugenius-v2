/**
 * answerCrafterService.ts — Humanized Answer Generation Engine
 *
 * Generates contextual, humanized answers to social media questions.
 * Applies platform-specific tone, hook templates, and anti-spam scoring.
 *
 * HUMANIZATION RULES:
 * 1. Never start with "Great question!"
 * 2. Use first person ("I struggled with this too...")
 * 3. Include a micro-story or personal anecdote hook
 * 4. Max 2 sentences promoting EduGenius — and only if natural
 * 5. Match platform tone: Reddit=casual, Quora=expert, X=punchy, YouTube=encouraging
 * 6. Include imperfections: "tbh", "honestly", "ngl" for casual platforms
 * 7. Anti-bot: vary sentence length, avoid bullet lists on casual platforms
 * 8. For motivation_drop/result_anxiety: lead with empathy first, answer second
 *
 * Storage keys: `edugenius_social_answers_*`
 */

import type { SocialSignal, SocialPlatform, IntentType, ExamCode } from './socialIntentScoutService';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CraftedAnswer {
  id: string;
  signalId: string;
  platform: SocialPlatform;
  exam: ExamCode;
  topic: string;
  intentType: IntentType;

  // Core generated content
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];

  // Platform-formatted versions
  formatted: {
    reddit: string;
    quora: string;
    x_twitter: string;
    youtube: string;
    telegram: string;
    whatsapp: string;
  };

  // Quality scores (1-10)
  wordCount: number;
  readabilityScore: number;
  humanizationScore: number;
  antiSpamScore: number;

  // Lifecycle
  generatedAt: number;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'posted' | 'scheduled';
  scheduledFor?: number;
  postedAt?: number;
  editedByAdmin?: boolean;
  adminNotes?: string;
}

// ─── Storage Keys ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'edugenius_social_answers';

// ─── Hook Templates (by intent type) ─────────────────────────────────────────

const HOOK_TEMPLATES: Record<IntentType, string[]> = {
  help_request: [
    'Okay so [topic] tripped me up for weeks until I found this...',
    'Honestly this took me embarrassingly long to figure out — here\'s what finally clicked:',
    'I asked this exact question 8 months ago. Here\'s what nobody tells you:',
  ],
  confusion: [
    'You\'re not alone — [topic] confuses almost everyone at first. Here\'s the thing...',
    'Ngl I was confused by this for months. The textbooks make it way harder than it is.',
    'The reason [topic] feels confusing is that most explanations get it backwards. Let me flip it:',
  ],
  motivation_drop: [
    'Three months before my GATE attempt I almost quit. What changed everything was...',
    'That feeling you\'re describing? I know it exactly. Here\'s what I wish someone told me then:',
    'First — that feeling is normal. Second — it\'s actually a signal, not a sign to quit. Here\'s why:',
  ],
  result_anxiety: [
    'The score anxiety is real but the math might actually be better than you think.',
    'I ran the numbers on [exam] cutoffs obsessively. Here\'s what actually matters vs what you\'re worrying about:',
    'Okay let\'s be real about what these scores actually mean — no sugarcoating:',
  ],
  resource_hunt: [
    'Honest answer: most [exam] resources are overhyped. The ones that actually work are:',
    'I wasted 3 months on the wrong resources. Here\'s the curated list I wish I had:',
    'Skip the coaching centre recommendations — here\'s what top rankers actually used:',
  ],
  comparison: [
    'I went through this exact debate. Here\'s what the data says...',
    'Spoiler: the answer depends on your specific situation. Let me break it down:',
    'Both camps will tell you they\'re right. Here\'s an honest comparison:',
  ],
  concept_question: [
    'The real-world answer is way more interesting than any textbook explanation.',
    'Your professor is right that it\'s important, but they probably explained it backwards. Try this:',
    'Let me explain [topic] the way I wish someone explained it to me:',
  ],
  practice_need: [
    'Okay this is actually one of the most common gaps in [exam] prep. Here\'s the full list:',
    'I\'ve tried basically everything for [topic] practice. The ones that actually help:',
    'Specific to [exam]-level questions — here\'s where to find them, ranked:',
  ],
  community_query: [
    'Yes, very much same boat last year. Here\'s what helped:',
    'This is more common than people admit — you\'re definitely not alone. What worked for me:',
    'I asked this exact thing in this subreddit a year ago. Here\'s my update:',
  ],
};

// ─── Body Templates (by exam + topic) ─────────────────────────────────────────

interface BodyTemplate {
  exam: ExamCode | 'general';
  topic?: string;
  intentType?: IntentType;
  body: string;
  cta: string;
}

const BODY_TEMPLATES: BodyTemplate[] = [
  {
    exam: 'gate-em',
    topic: 'convolution',
    intentType: 'confusion',
    body: `The graphical method feels abstract until you think of it as a sliding window. Here's the mental model: one signal stays fixed, you flip the other one, then slide it across and multiply-and-sum at each position.

The trick that clicked for me was doing it physically with graph paper first. Draw your signal, flip it on paper, slide it. Once you see it visually 5-6 times, the formula becomes obvious rather than memorized.

For GATE specifically — they love asking about LTI systems with simple rectangular pulses. Master the graphical method with rectangles first (the output is always a trapezoid or triangle), then move to more complex signals.`,
    cta: 'If you want more signal processing practice with GATE-level difficulty, there\'s a structured problem set that covers this progressively.',
  },
  {
    exam: 'gate-em',
    topic: 'linear algebra',
    intentType: 'concept_question',
    body: `Eigenvalues show up everywhere in engineering — your professor undersells them by treating them as abstract math.

Real examples: in structural engineering, eigenvalues determine the natural frequencies of a bridge (critical for avoiding resonance disasters). In circuits, they determine how quickly transients decay. In image compression (JPEG uses SVD, which is all eigenvalues), they tell you how much information each direction in the image contains.

For GATE, the practical angle is this: eigenvalues tell you how a linear system will behave over time. Positive eigenvalue = exponential growth. Negative = decay. Complex = oscillation. That's the intuition that unlocks all the GATE questions.`,
    cta: 'If you want the full linear algebra topic roadmap for GATE EM — which subtopics to prioritize and in what order — that\'s worth looking into.',
  },
  {
    exam: 'gate-em',
    topic: 'mock test performance',
    intentType: 'motivation_drop',
    body: `Seriously, don't make any decisions right now. The "I should quit" feeling after bad mocks is universal — I promise you most people who went on to crack GATE had this exact moment.

Here's what the data actually shows: mock performance 6 weeks out is a poor predictor of final rank. What matters is the trajectory of improvement, not the absolute score. If you're going from 28 to 35 to 42, that trajectory is strong.

What I'd recommend: pick ONE topic you're consistently getting wrong and spend 3 focused days on just that. Don't try to fix everything. One subject mastered is better than five subjects half-understood.

And honestly — the fact that you're still here asking this question means you haven't actually quit. That counts for more than a mock score.`,
    cta: 'A structured weakness analysis can help identify exactly which topics are dragging your mock scores down — pattern recognition is much faster than random practice.',
  },
  {
    exam: 'general',
    intentType: 'resource_hunt',
    body: `The honest answer is that free resources now are better than paid resources from 5 years ago. The problem is curation, not availability.

For concept understanding: NPTEL lectures (yes they're slow — 1.5x speed helps), and the specific professors vary by subject — worth researching who's best for your exact topic.

For practice at exam level: Previous year questions are underrated. Most aspirants try to do them AFTER completing theory, but doing them ALONGSIDE learning (and looking up what you don't know) is faster.

For mock tests: Institute-provided mocks have the right difficulty calibration. Third-party mocks can be too easy or too hard — be selective.

What I'd skip: overpriced "full course" subscriptions with 200+ hours of video you won't finish. Learn in topic-sized chunks.`,
    cta: 'Specifically for [exam], the topic-wise breakdown of what matters most (based on actual weightage analysis) can save you significant time.',
  },
  {
    exam: 'gate-em',
    topic: 'GATE score cutoff',
    intentType: 'result_anxiety',
    body: `Let me give you the real numbers rather than vague reassurance.

For GATE 2025, a score of 55/100 in ECE typically translates to roughly 500-700 GATE score (out of 1000), depending on the year's difficulty. This usually means a rank in the 2000-5000 range.

PSU access at this range: BHEL, PGCIL, and some state PSUs have cutoffs in this range. IIT/NIT M.Tech requires higher. Private companies often look at GATE score more holistically alongside interviews.

What I'd say: 55 isn't the score people post about on Reddit (they post 80+), but it opens real doors. The PSU cutoff data from previous years is publicly available — worth checking the specific organizations you're targeting rather than worrying about the average.`,
    cta: 'The PSU-wise cutoff tracker and eligibility calculator is something that saves a lot of guesswork during application season.',
  },
  {
    exam: 'gate-ee',
    topic: 'circuit theory',
    intentType: 'confusion',
    body: `Thevenin vs Norton — the rule I use: if your final circuit has something in series with the load (like a series resistance), go Thevenin. If something's in parallel, Norton is cleaner.

More practically for GATE: 90% of questions can be solved with either method. The choice is about speed. Thevenin gives you Voc first then Rth — better when you need voltage. Norton gives you Isc first then Rth — better when you need current.

The Rth calculation is identical in both methods (short the sources, find resistance from terminals). That's your common anchor point — master that first.

One more thing: if you see a dependent source in the circuit, you must use the Voc/Isc method (not the source-deactivation method) for Rth. This trips up a lot of people in GATE.`,
    cta: 'Network theorem questions follow predictable patterns in GATE — if you want a curated set of PYQs organized by technique, that exists.',
  },
  {
    exam: 'cat',
    topic: 'percentile improvement',
    intentType: 'help_request',
    body: `The 85-to-99 jump is about eliminating error types, not learning new material.

At 85 percentile, you're getting the medium-hard questions right but making 2-3 errors per section that you "shouldn't" make — either rushing, second-guessing right answers, or misreading question stems.

What actually separates 99+ scorers: they don't get more questions right, they get fewer wrong. Time management is tighter. And they pick their battles — they know which question types to skip fast and which to spend time on.

Specific fix: record every wrong answer in your next 5 mocks. Categorize them: was it "didn't know concept", "knew but made error", or "ran out of time"? The ratio tells you exactly what to work on. If >50% are type 2 or 3, you don't need more content — you need a different approach to the test itself.`,
    cta: 'Error pattern analysis specifically for CAT sections is something that can accelerate this diagnosis significantly.',
  },
];

// ─── Hashtag Sets ──────────────────────────────────────────────────────────────

const HASHTAGS_BY_EXAM: Record<ExamCode | 'general', string[]> = {
  'gate-em': ['#GATE2026', '#GATEprep', '#EngineeringMathematics', '#GATEStudy'],
  'gate-ee': ['#GATE2026', '#GATEElectrical', '#GATEprep', '#EEprep'],
  'gate-cs': ['#GATE2026', '#GATEcs', '#GATEprep', '#CSprep'],
  jee: ['#JEE2026', '#JEEMain', '#JEEAdvanced', '#IITprep'],
  neet: ['#NEET2026', '#NEETprep', '#MedicalEntrance'],
  cat: ['#CAT2025', '#MBAprep', '#IIM', '#CATprep'],
  upsc: ['#UPSC2026', '#IAS', '#CivilServices', '#UPSCprep'],
  general: ['#ExamPrep', '#StudyTips', '#StudentLife', '#Learning'],
};

// ─── Formatters (per platform) ─────────────────────────────────────────────────

function formatForReddit(hook: string, body: string, cta: string): string {
  // Reddit: conversational, markdown-friendly, minimal self-promotion
  return `${hook}

${body}

---

${cta}`;
}

function formatForQuora(hook: string, body: string, cta: string, exam: ExamCode): string {
  // Quora: authoritative, structured, with implied credentials
  return `**${hook}**

${body}

---

*Based on patterns from [${exam.toUpperCase()}] prep analysis and student performance data.*

${cta}`;
}

function formatForTwitter(hook: string, body: string, cta: string): string {
  // X/Twitter: thread format, each tweet ≤280 chars
  const thread: string[] = [];

  thread.push(hook.slice(0, 275) + (hook.length > 275 ? '...' : '') + ' 🧵');

  // Split body into tweet-sized chunks
  const sentences = body.split(/(?<=[.!?])\s+/);
  let current = '';
  let tweetNum = 2;

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).length > 270) {
      if (current) {
        thread.push(`${tweetNum}/ ${current.trim()}`);
        tweetNum++;
      }
      current = sentence;
    } else {
      current = current ? current + ' ' + sentence : sentence;
    }
  }
  if (current) {
    thread.push(`${tweetNum}/ ${current.trim()}`);
    tweetNum++;
  }

  thread.push(`${tweetNum}/ ${cta.slice(0, 240)}`);

  return thread.join('\n\n');
}

function formatForYoutube(hook: string, body: string, cta: string): string {
  // YouTube: comment reply format, encouraging tone
  return `${hook}

${body}

${cta} 🎯`;
}

function formatForTelegram(hook: string, body: string, cta: string): string {
  // Telegram: casual, emoji-friendly
  const bodyWithEmojis = body
    .replace(/first[,.]?/gi, '1️⃣')
    .replace(/second[,.]?/gi, '2️⃣')
    .replace(/third[,.]?/gi, '3️⃣');

  return `${hook} 👇\n\n${bodyWithEmojis}\n\n✅ ${cta}`;
}

function formatForWhatsapp(hook: string, body: string, cta: string): string {
  // WhatsApp: brief, well-structured with bold markers
  const shortBody = body.split('\n\n').slice(0, 2).join('\n\n');
  return `*${hook}*\n\n${shortBody}\n\n_${cta}_`;
}

// ─── Core Generation ───────────────────────────────────────────────────────────

function selectHookTemplate(intentType: IntentType, topic: string): string {
  const templates = HOOK_TEMPLATES[intentType] || HOOK_TEMPLATES.help_request;
  const idx = Math.floor(Math.random() * templates.length);
  return templates[idx].replace('[topic]', topic);
}

function selectBodyTemplate(signal: SocialSignal): { body: string; cta: string } {
  // Try to find exact match first
  const exact = BODY_TEMPLATES.find(
    t =>
      (t.exam === signal.exam || t.exam === 'general') &&
      t.topic &&
      signal.topic.toLowerCase().includes(t.topic.toLowerCase()) &&
      t.intentType === signal.intentType
  );
  if (exact) return { body: exact.body, cta: exact.cta };

  // Match by exam + topic
  const byExamTopic = BODY_TEMPLATES.find(
    t =>
      (t.exam === signal.exam || t.exam === 'general') &&
      t.topic &&
      signal.topic.toLowerCase().includes(t.topic.toLowerCase())
  );
  if (byExamTopic) return { body: byExamTopic.body, cta: byExamTopic.cta };

  // Match by intent
  const byIntent = BODY_TEMPLATES.find(t => t.intentType === signal.intentType);
  if (byIntent) {
    return {
      body: byIntent.body,
      cta: byIntent.cta.replace('[exam]', signal.exam.toUpperCase()),
    };
  }

  // Fallback generic body
  return {
    body: `This is a common question for ${signal.exam.toUpperCase()} aspirants. The key to ${signal.topic} is building understanding progressively — starting with the fundamentals before tackling advanced problems.

The most effective approach I've seen: don't just read solutions. Work through problems yourself first, get stuck, then look at the solution. The "getting stuck" part is where the actual learning happens.

Focus on the previous year questions for ${signal.exam.toUpperCase()} specifically — they're the best signal of what actually gets tested vs what textbooks over-index on.`,
    cta: `For ${signal.exam.toUpperCase()} specifically, a structured topic-wise approach with verified practice questions can make the preparation significantly more efficient.`,
  };
}

/**
 * Calculate quality scores for a generated answer.
 */
export function calculateScores(hook: string, body: string, intentType: IntentType): {
  readabilityScore: number;
  humanizationScore: number;
  antiSpamScore: number;
} {
  const text = hook + ' ' + body;
  const wordCount = text.split(/\s+/).length;

  // Readability: penalize very long or very short answers
  const idealWords = 200;
  const readabilityRaw = 10 - Math.abs(wordCount - idealWords) / 50;
  const readabilityScore = Math.min(10, Math.max(1, Math.round(readabilityRaw)));

  // Humanization: reward conversational markers, punish robotic openers
  let humanScore = 5;
  const humanMarkers = ['tbh', 'honestly', 'ngl', 'i\'ve', 'i was', 'i asked', 'me too', 'i know', 'let me', 'i\'d', "i'd"];
  const robotMarkers = ['great question', 'certainly', 'as an ai', 'in conclusion', 'in summary', 'moreover', 'furthermore'];

  for (const m of humanMarkers) {
    if (text.toLowerCase().includes(m)) humanScore += 0.5;
  }
  for (const m of robotMarkers) {
    if (text.toLowerCase().includes(m)) humanScore -= 1.5;
  }

  // Empathy-first for emotional intents
  if (['motivation_drop', 'result_anxiety'].includes(intentType)) {
    const empathyMarkers = ['normal', 'you\'re not alone', 'i know', 'i understand', 'that feeling', 'real'];
    for (const m of empathyMarkers) {
      if (text.toLowerCase().includes(m)) humanScore += 0.5;
    }
  }

  const humanizationScore = Math.min(10, Math.max(1, Math.round(humanScore)));

  // Anti-spam: penalize excessive self-promotion, excessive links
  let spamScore = 9;
  const promoCount = (text.match(/edugenius/gi) || []).length;
  if (promoCount > 2) spamScore -= 2 * (promoCount - 2);
  if (/buy now|click here|sign up now|free trial/.test(text.toLowerCase())) spamScore -= 3;

  const antiSpamScore = Math.min(10, Math.max(1, Math.round(spamScore)));

  return { readabilityScore, humanizationScore, antiSpamScore };
}

/**
 * Generate a soft CTA for the given platform + exam.
 * Never hard-sell. Always provide value first.
 */
export function generateCTA(platform: SocialPlatform, exam: ExamCode): string {
  const ctas: Record<SocialPlatform, string> = {
    reddit: `If anyone wants the ${exam.toUpperCase()} topic-wise breakdown I used, happy to share. DM or I can post it.`,
    quora: `Structured ${exam.toUpperCase()} preparation resources with topic prioritization are available if you'd like to explore further.`,
    x_twitter: `More ${exam.toUpperCase()} prep breakdowns in my thread history. Follow for regular deep-dives 🧵`,
    youtube_comments: `If this helped, there's a full ${exam.toUpperCase()} topic series on EduGenius that goes much deeper 👆`,
    google_paa: `A personalized ${exam.toUpperCase()} preparation plan based on your starting point can help structure this better.`,
    telegram_group: `There's a free ${exam.toUpperCase()} preparation roadmap I can share — just ask in the group 🙌`,
    whatsapp_group: `Ask me for the ${exam.toUpperCase()} study schedule template — it's helped a bunch of people in this group.`,
  };
  return ctas[platform];
}

/**
 * Main answer crafting function.
 * Simulates LLM generation with realistic, humanized templates.
 *
 * API-hook: In production, replace body generation with:
 *   callLLM({ model: 'claude-3-5-sonnet', system: HUMANIZATION_RULES, messages: [signal] })
 */
export function craftAnswer(signal: SocialSignal): CraftedAnswer {
  const hook = selectHookTemplate(signal.intentType, signal.topic);
  const { body, cta: templateCta } = selectBodyTemplate(signal);
  const cta = generateCTA(signal.platform, signal.exam);
  const hashtags = HASHTAGS_BY_EXAM[signal.exam] || HASHTAGS_BY_EXAM.general;
  const scores = calculateScores(hook, body, signal.intentType);

  const formatted = {
    reddit: formatForReddit(hook, body, cta),
    quora: formatForQuora(hook, body, templateCta, signal.exam),
    x_twitter: formatForTwitter(hook, body, cta),
    youtube: formatForYoutube(hook, body, cta),
    telegram: formatForTelegram(hook, body, cta),
    whatsapp: formatForWhatsapp(hook, body, cta),
  };

  const fullText = hook + ' ' + body;

  const answer: CraftedAnswer = {
    id: `ans_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    signalId: signal.id,
    platform: signal.platform,
    exam: signal.exam,
    topic: signal.topic,
    intentType: signal.intentType,
    hook,
    body,
    cta,
    hashtags,
    formatted,
    wordCount: fullText.split(/\s+/).length,
    ...scores,
    generatedAt: Date.now(),
    status: 'pending_review',
  };

  saveAnswer(answer);
  return answer;
}

// ─── Storage Operations ───────────────────────────────────────────────────────

export function saveAnswer(answer: CraftedAnswer): void {
  const all = getAnswers();
  const idx = all.findIndex(a => a.id === answer.id);
  if (idx >= 0) {
    all[idx] = answer;
  } else {
    all.push(answer);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getAnswers(status?: CraftedAnswer['status']): CraftedAnswer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: CraftedAnswer[] = raw ? JSON.parse(raw) : [];
    if (status) return all.filter(a => a.status === status);
    return all;
  } catch {
    return [];
  }
}

export function updateAnswerStatus(
  id: string,
  status: CraftedAnswer['status'],
  notes?: string
): void {
  const all = getAnswers();
  const answer = all.find(a => a.id === id);
  if (answer) {
    answer.status = status;
    if (notes) answer.adminNotes = notes;
    if (status === 'posted') answer.postedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}

export function updateAnswerContent(
  id: string,
  updates: Partial<Pick<CraftedAnswer, 'hook' | 'body' | 'cta' | 'formatted'>>
): void {
  const all = getAnswers();
  const answer = all.find(a => a.id === id);
  if (answer) {
    Object.assign(answer, updates);
    answer.editedByAdmin = true;

    // Recalculate scores if content changed
    if (updates.hook || updates.body) {
      const scores = calculateScores(
        updates.hook || answer.hook,
        updates.body || answer.body,
        answer.intentType
      );
      Object.assign(answer, scores);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}

export function clearAnswers(): void {
  localStorage.removeItem(STORAGE_KEY);
}
