/**
 * socialIntentScoutService.ts — Social Media Intent Scout
 *
 * Monitors social platforms for student questions, classifies intent,
 * scores urgency, and feeds into the humanized answer pipeline.
 *
 * All platforms simulated with realistic seeded data — API-ready hooks
 * are clearly marked for production integration.
 *
 * Storage keys: `edugenius_social_signals_*`
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SocialPlatform =
  | 'reddit'
  | 'quora'
  | 'youtube_comments'
  | 'x_twitter'
  | 'google_paa'
  | 'telegram_group'
  | 'whatsapp_group';

export type IntentType =
  | 'help_request'     // "How do I solve this?"
  | 'confusion'        // "I don't understand X"
  | 'resource_hunt'    // "Best book for X?"
  | 'comparison'       // "X vs Y for GATE?"
  | 'motivation_drop'  // "Is it too late to start?"
  | 'result_anxiety'   // "What score is needed?"
  | 'concept_question' // "What is eigenvalue used for?"
  | 'practice_need'    // "Where can I practice X?"
  | 'community_query'; // "Anyone else struggling with X?"

export type ExamCode = 'gate-em' | 'gate-ee' | 'gate-cs' | 'jee' | 'neet' | 'cat' | 'upsc' | 'general';

export interface SocialSignal {
  id: string;
  platform: SocialPlatform;
  originalText: string;
  url?: string;
  authorHandle?: string;
  subreddit?: string;
  upvotes?: number;
  replyCount?: number;
  detectedAt: number;
  intentType: IntentType;
  exam: ExamCode;
  topic: string;
  urgency: 'high' | 'medium' | 'low';
  sentiment: 'frustrated' | 'curious' | 'anxious' | 'motivated' | 'neutral';
  processed: boolean;
  responseId?: string;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'edugenius_social_signals';
const SCAN_LOG_KEY = 'edugenius_social_last_scan';

// ─── Seeded Signal Data (20+ realistic examples) ─────────────────────────────

const SEEDED_SIGNALS: Omit<SocialSignal, 'id' | 'detectedAt' | 'processed'>[] = [
  // ── Reddit r/GATE ──────────────────────────────────────────────────────────
  {
    platform: 'reddit',
    subreddit: 'GATE',
    originalText: "I keep getting wrong answers in signal processing. Is there a trick to convolution I'm missing? Specifically the graphical method.",
    url: 'https://reddit.com/r/GATE/comments/simulated_1',
    authorHandle: 'gate_aspirant_2026',
    upvotes: 142,
    replyCount: 23,
    intentType: 'help_request',
    exam: 'gate-em',
    topic: 'signal processing',
    urgency: 'high',
    sentiment: 'frustrated',
  },
  {
    platform: 'reddit',
    subreddit: 'GATE',
    originalText: "Should I use Ramana or Bakshi for GATE EE circuit theory? People online keep recommending different things and I'm confused.",
    url: 'https://reddit.com/r/GATE/comments/simulated_2',
    authorHandle: 'ee_2026_prep',
    upvotes: 89,
    replyCount: 31,
    intentType: 'comparison',
    exam: 'gate-ee',
    topic: 'circuit theory',
    urgency: 'medium',
    sentiment: 'curious',
  },
  {
    platform: 'reddit',
    subreddit: 'GATE2026',
    originalText: "Just failed mock #5 with 28/100. GATE is in 6 weeks. Should I even continue? Feeling completely lost and hopeless right now.",
    url: 'https://reddit.com/r/GATE2026/comments/simulated_3',
    authorHandle: 'throwaway_gateprep',
    upvotes: 234,
    replyCount: 67,
    intentType: 'motivation_drop',
    exam: 'gate-em',
    topic: 'mock test performance',
    urgency: 'high',
    sentiment: 'frustrated',
  },
  {
    platform: 'reddit',
    subreddit: 'GATE',
    originalText: "Where can I find good GATE EM previous year questions with detailed solutions? NPTEL videos are too slow.",
    url: 'https://reddit.com/r/GATE/comments/simulated_4',
    authorHandle: 'em_gate_student',
    upvotes: 56,
    replyCount: 14,
    intentType: 'resource_hunt',
    exam: 'gate-em',
    topic: 'PYQ practice',
    urgency: 'medium',
    sentiment: 'curious',
  },
  {
    platform: 'reddit',
    subreddit: 'GATEprep',
    originalText: "What is the actual real-world application of eigenvalues? My professor says it's important but never explains WHY.",
    url: 'https://reddit.com/r/GATEprep/comments/simulated_5',
    authorHandle: 'curious_engineer_42',
    upvotes: 178,
    replyCount: 45,
    intentType: 'concept_question',
    exam: 'gate-em',
    topic: 'linear algebra',
    urgency: 'low',
    sentiment: 'curious',
  },

  // ── Quora ──────────────────────────────────────────────────────────────────
  {
    platform: 'quora',
    originalText: "Is 55/100 a good score in GATE ECE 2026? What rank would that translate to and which PSUs are accessible?",
    url: 'https://quora.com/simulated/gate-score-question',
    authorHandle: 'anon_quora_user',
    upvotes: 312,
    replyCount: 18,
    intentType: 'result_anxiety',
    exam: 'gate-em',
    topic: 'GATE score cutoff',
    urgency: 'high',
    sentiment: 'anxious',
  },
  {
    platform: 'quora',
    originalText: "How many months does it take to seriously prepare for GATE EE from scratch if I'm a final year BTech student with 6 hours/day?",
    url: 'https://quora.com/simulated/gate-preparation-time',
    authorHandle: 'final_year_student',
    upvotes: 891,
    replyCount: 42,
    intentType: 'resource_hunt',
    exam: 'gate-ee',
    topic: 'study plan',
    urgency: 'medium',
    sentiment: 'curious',
  },
  {
    platform: 'quora',
    originalText: "What's the difference between GATE EM (Engineering Mathematics) and GATE EE for PSU recruitment? Which one has better opportunities?",
    url: 'https://quora.com/simulated/gate-em-vs-ee',
    authorHandle: 'psu_aspirant_2026',
    upvotes: 445,
    replyCount: 29,
    intentType: 'comparison',
    exam: 'gate-em',
    topic: 'GATE paper selection',
    urgency: 'medium',
    sentiment: 'neutral',
  },
  {
    platform: 'quora',
    originalText: "Is it too late to start GATE 2026 preparation in November? I haven't studied anything yet.",
    url: 'https://quora.com/simulated/gate-late-start',
    authorHandle: 'late_starter_gate',
    upvotes: 1203,
    replyCount: 87,
    intentType: 'motivation_drop',
    exam: 'gate-em',
    topic: 'study planning',
    urgency: 'high',
    sentiment: 'anxious',
  },

  // ── YouTube Comments ───────────────────────────────────────────────────────
  {
    platform: 'youtube_comments',
    originalText: "Can you please explain convolution in simple terms? I've watched 10 videos and still don't get it. My GATE exam is next month 😭",
    url: 'https://youtube.com/watch?v=simulated_gate_signal',
    authorHandle: '@confused_student_ece',
    upvotes: 67,
    replyCount: 4,
    intentType: 'confusion',
    exam: 'gate-em',
    topic: 'convolution',
    urgency: 'high',
    sentiment: 'frustrated',
  },
  {
    platform: 'youtube_comments',
    originalText: "After watching this video I understand Laplace transforms but where do I practice problems? Any website that gives GATE-level questions?",
    url: 'https://youtube.com/watch?v=simulated_laplace_video',
    authorHandle: '@aspirant_2026_prep',
    upvotes: 23,
    replyCount: 2,
    intentType: 'practice_need',
    exam: 'gate-em',
    topic: 'Laplace transforms',
    urgency: 'medium',
    sentiment: 'motivated',
  },
  {
    platform: 'youtube_comments',
    originalText: "What's the difference between Fourier Series and Fourier Transform? I always mix them up in exams.",
    url: 'https://youtube.com/watch?v=simulated_fourier_video',
    authorHandle: '@fourier_confused',
    upvotes: 89,
    replyCount: 12,
    intentType: 'confusion',
    exam: 'gate-ee',
    topic: 'Fourier analysis',
    urgency: 'low',
    sentiment: 'curious',
  },

  // ── X / Twitter ────────────────────────────────────────────────────────────
  {
    platform: 'x_twitter',
    originalText: "Just failed mock #3. Should I give up on GATE 2026? 😭 My rank keeps getting worse every attempt. Anyone else in this boat?",
    url: 'https://x.com/simulated/status/001',
    authorHandle: '@gate2026_grind',
    upvotes: 234,
    replyCount: 89,
    intentType: 'motivation_drop',
    exam: 'gate-em',
    topic: 'mock test performance',
    urgency: 'high',
    sentiment: 'frustrated',
  },
  {
    platform: 'x_twitter',
    originalText: "Finally cracked probability questions for CAT 2025! Permutations & combinations were my weak spot for 6 months. Thread on what worked: 🧵",
    url: 'https://x.com/simulated/status/002',
    authorHandle: '@cat_2025_winner',
    upvotes: 567,
    replyCount: 134,
    intentType: 'community_query',
    exam: 'cat',
    topic: 'permutations & combinations',
    urgency: 'low',
    sentiment: 'motivated',
  },
  {
    platform: 'x_twitter',
    originalText: "Which coaching for JEE Advanced is actually worth it in 2026? Allen vs Resonance vs Aakash — genuinely confused and parents are pressuring me",
    url: 'https://x.com/simulated/status/003',
    authorHandle: '@jee_2026_aspirant',
    upvotes: 123,
    replyCount: 56,
    intentType: 'comparison',
    exam: 'jee',
    topic: 'JEE coaching',
    urgency: 'medium',
    sentiment: 'anxious',
  },

  // ── Google PAA (People Also Ask) ──────────────────────────────────────────
  {
    platform: 'google_paa',
    originalText: "How many months to prepare for GATE EE?",
    topic: 'study plan',
    exam: 'gate-ee',
    intentType: 'resource_hunt',
    urgency: 'medium',
    sentiment: 'curious',
  },
  {
    platform: 'google_paa',
    originalText: "What is the minimum score to qualify GATE 2026?",
    topic: 'GATE cutoff',
    exam: 'gate-em',
    intentType: 'result_anxiety',
    urgency: 'high',
    sentiment: 'anxious',
  },
  {
    platform: 'google_paa',
    originalText: "Is GATE easier than JEE Advanced?",
    topic: 'exam difficulty',
    exam: 'general',
    intentType: 'comparison',
    urgency: 'low',
    sentiment: 'curious',
  },

  // ── Telegram Group ─────────────────────────────────────────────────────────
  {
    platform: 'telegram_group',
    originalText: "Anyone else struggling with network theorems? Thevenin and Norton keep tripping me up in practice tests. Any shortcut to remember which to apply?",
    authorHandle: 'gate_prep_student',
    upvotes: 34,
    replyCount: 19,
    intentType: 'confusion',
    exam: 'gate-ee',
    topic: 'network theorems',
    urgency: 'medium',
    sentiment: 'frustrated',
  },
  {
    platform: 'telegram_group',
    originalText: "Bhai can anyone share good UPSC Maths optional notes? The ones on Telegram groups are all outdated or incomplete 😤",
    authorHandle: 'upsc_maths_guy',
    upvotes: 67,
    replyCount: 23,
    intentType: 'resource_hunt',
    exam: 'upsc',
    topic: 'Mathematics optional',
    urgency: 'medium',
    sentiment: 'frustrated',
  },

  // ── WhatsApp Group ─────────────────────────────────────────────────────────
  {
    platform: 'whatsapp_group',
    originalText: "Guys NEET 2026 is in 4 months. I haven't even finished organic chemistry. Is it possible to score 600+ from this stage?",
    authorHandle: 'neet_aspirant_wa',
    upvotes: 0,
    replyCount: 28,
    intentType: 'result_anxiety',
    exam: 'neet',
    topic: 'organic chemistry',
    urgency: 'high',
    sentiment: 'anxious',
  },
  {
    platform: 'whatsapp_group',
    originalText: "For GATE preparation which subjects should I prioritize first? EM (Engineering Mathematics) or the core electrical subjects?",
    authorHandle: 'fresh_gate_aspirant',
    upvotes: 0,
    replyCount: 15,
    intentType: 'resource_hunt',
    exam: 'gate-em',
    topic: 'subject prioritization',
    urgency: 'medium',
    sentiment: 'curious',
  },
  {
    platform: 'reddit',
    subreddit: 'CAT2025',
    originalText: "I'm scoring 80-85 percentile in mocks but need 99+ for IIM Ahmedabad. What specifically changes between 85 and 99 percentile? What am I missing?",
    url: 'https://reddit.com/r/CAT2025/comments/simulated_cat_1',
    authorHandle: 'cat_aspirant_iima',
    upvotes: 445,
    replyCount: 78,
    intentType: 'help_request',
    exam: 'cat',
    topic: 'percentile improvement',
    urgency: 'high',
    sentiment: 'anxious',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Classify intent from raw text using keyword heuristics.
 * API-hook: replace with LLM classifier in production.
 */
export function classifyIntent(text: string): IntentType {
  const t = text.toLowerCase();

  if (/give up|quit|hopeless|should i stop|worth it|too late to start|almost quit/.test(t)) return 'motivation_drop';
  if (/score|rank|cutoff|percentile|qualify|pass|result|marks/.test(t) && /what|how much|minimum|need/.test(t)) return 'result_anxiety';
  if (/don't understand|confused|confusing|don't get|can't understand|mix up|trip/.test(t)) return 'confusion';
  if (/vs|versus|or|which one|better|difference between|compare/.test(t)) return 'comparison';
  if (/best book|resource|notes|material|where (can|to) (find|get|study)|recommend/.test(t)) return 'resource_hunt';
  if (/practice|questions|problems|where.*solve|mock|test/.test(t)) return 'practice_need';
  if (/what is|explain|how does|why is|application of|real.world/.test(t)) return 'concept_question';
  if (/anyone else|anyone also|same here|struggling|we all|community/.test(t)) return 'community_query';
  if (/how (do|to)|trick|shortcut|method|solve|help/.test(t)) return 'help_request';

  return 'help_request';
}

/**
 * Detect exam from text.
 */
export function detectExamFromText(text: string): ExamCode {
  const t = text.toLowerCase();
  if (/gate.*em|gate.*engineering.*math/.test(t)) return 'gate-em';
  if (/gate.*ee|gate.*electrical/.test(t)) return 'gate-ee';
  if (/gate.*cs|gate.*computer/.test(t)) return 'gate-cs';
  if (/\bgate\b/.test(t)) return 'gate-em'; // default GATE to EM
  if (/\bjee\b|iit jee|jee (main|advanced)/.test(t)) return 'jee';
  if (/\bneet\b/.test(t)) return 'neet';
  if (/\bcat\b|iim|mba/.test(t)) return 'cat';
  if (/\bupsc\b|ias|ips|civil service/.test(t)) return 'upsc';
  return 'general';
}

/**
 * Extract primary topic from text.
 */
export function detectTopicFromText(text: string): string {
  const t = text.toLowerCase();

  const topicPatterns: [RegExp, string][] = [
    [/convolution/, 'convolution'],
    [/fourier (series|transform)/, 'Fourier analysis'],
    [/laplace/, 'Laplace transforms'],
    [/eigenvalue|eigenvector/, 'linear algebra'],
    [/signal processing|signals.*systems/, 'signal processing'],
    [/circuit theory|thevenin|norton|network theorem/, 'circuit theory'],
    [/probability|permutation|combination/, 'probability & combinatorics'],
    [/organic chemistry/, 'organic chemistry'],
    [/mock test|percentile|score|rank|cutoff/, 'exam performance'],
    [/study plan|preparation|how many months/, 'study planning'],
    [/coaching|allen|resonance|aakash/, 'coaching selection'],
    [/book|resource|notes|material/, 'study resources'],
  ];

  for (const [pattern, topic] of topicPatterns) {
    if (pattern.test(t)) return topic;
  }

  // Extract capitalized noun phrases as fallback
  const matches = text.match(/[A-Z][a-zA-Z ]{3,20}/);
  if (matches) return matches[0].trim();
  return 'general concepts';
}

/**
 * Score urgency based on exam proximity, upvotes, and intent type.
 */
export function scoreUrgency(signal: Omit<SocialSignal, 'urgency'>): 'high' | 'medium' | 'low' {
  const { upvotes = 0, intentType, exam } = signal;

  // High-stakes intents
  if (['motivation_drop', 'result_anxiety'].includes(intentType)) return 'high';

  // Trending content (high upvotes)
  if (upvotes > 200) return 'high';
  if (upvotes > 80) return 'medium';

  // Exam-specific urgency boost
  const highUrgencyExams: ExamCode[] = ['gate-em', 'gate-ee', 'neet'];
  if (highUrgencyExams.includes(exam)) return 'medium';

  return 'low';
}

// ─── Simulate Social Scan ─────────────────────────────────────────────────────

/**
 * Simulates a social media scan across specified platforms.
 * Returns new signals that aren't already saved.
 *
 * API-hook: In production, replace with real API calls per platform:
 *   - Reddit: Reddit API (PRAW / OAuth)
 *   - Quora: No public API — scrape or partner feed
 *   - YouTube: YouTube Data API v3 (comments.list)
 *   - X/Twitter: Twitter API v2 (filtered stream)
 *   - Google PAA: SerpAPI or DataForSEO
 *   - Telegram: Telethon / python-telegram-bot listening
 *   - WhatsApp: Unofficial — requires relay bot
 */
export function simulateSocialScan(
  platforms: SocialPlatform[] = ['reddit', 'quora', 'youtube_comments', 'x_twitter', 'google_paa', 'telegram_group'],
  exams: ExamCode[] = ['gate-em', 'gate-ee', 'jee', 'neet', 'cat', 'upsc'],
): SocialSignal[] {
  const existing = getSavedSignals();
  const existingTexts = new Set(existing.map(s => s.originalText.slice(0, 50)));

  const now = Date.now();
  const newSignals: SocialSignal[] = [];

  // Filter seeded data by platform + exam
  const filtered = SEEDED_SIGNALS.filter(s =>
    platforms.includes(s.platform) &&
    (exams.includes(s.exam) || s.exam === 'general')
  );

  for (const seed of filtered) {
    const preview = seed.originalText.slice(0, 50);
    if (existingTexts.has(preview)) continue; // skip duplicates

    // Vary detectedAt by ±2 days for realism
    const ageOffset = Math.floor(Math.random() * 172800000); // up to 2 days
    const signal: SocialSignal = {
      ...seed,
      id: generateId(),
      detectedAt: now - ageOffset,
      processed: false,
    };

    newSignals.push(signal);
  }

  // Save and emit
  const all = [...existing, ...newSignals];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

  if (newSignals.length > 0) {
    localStorage.setItem('social:new_signals', JSON.stringify({
      count: newSignals.length,
      ts: now,
      ids: newSignals.map(s => s.id),
    }));
  }

  // Update last scan timestamp
  localStorage.setItem(SCAN_LOG_KEY, JSON.stringify({ ts: now, count: newSignals.length }));

  return newSignals;
}

// ─── Storage Operations ───────────────────────────────────────────────────────

export function getSavedSignals(): SocialSignal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSignal(signal: SocialSignal): void {
  const all = getSavedSignals();
  const idx = all.findIndex(s => s.id === signal.id);
  if (idx >= 0) {
    all[idx] = signal;
  } else {
    all.push(signal);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function markProcessed(signalId: string, responseId: string): void {
  const all = getSavedSignals();
  const signal = all.find(s => s.id === signalId);
  if (signal) {
    signal.processed = true;
    signal.responseId = responseId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}

export function clearSignals(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SCAN_LOG_KEY);
}

// ─── Query Operations ─────────────────────────────────────────────────────────

/**
 * Get trending questions sorted by urgency + upvotes.
 */
export function getTrendingQuestions(exam?: ExamCode, limit = 10): SocialSignal[] {
  let signals = getSavedSignals().filter(s => !s.processed);
  if (exam) signals = signals.filter(s => s.exam === exam);

  const urgencyScore = { high: 100, medium: 50, low: 10 };

  return signals
    .sort((a, b) => {
      const scoreA = urgencyScore[a.urgency] + (a.upvotes || 0) * 0.1;
      const scoreB = urgencyScore[b.urgency] + (b.upvotes || 0) * 0.1;
      return scoreB - scoreA;
    })
    .slice(0, limit);
}

export function getPlatformSignals(platform: SocialPlatform): SocialSignal[] {
  return getSavedSignals().filter(s => s.platform === platform);
}

export function getUnprocessedSignals(): SocialSignal[] {
  return getSavedSignals().filter(s => !s.processed);
}

export function getLastScanInfo(): { ts: number; count: number } | null {
  try {
    const raw = localStorage.getItem(SCAN_LOG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Platform Display Helpers ─────────────────────────────────────────────────

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  reddit: 'Reddit',
  quora: 'Quora',
  youtube_comments: 'YouTube',
  x_twitter: 'X / Twitter',
  google_paa: 'Google PAA',
  telegram_group: 'Telegram',
  whatsapp_group: 'WhatsApp',
};

export const PLATFORM_EMOJIS: Record<SocialPlatform, string> = {
  reddit: '🤖',
  quora: '❓',
  youtube_comments: '▶️',
  x_twitter: '𝕏',
  google_paa: '🔍',
  telegram_group: '✈️',
  whatsapp_group: '💬',
};

export const EXAM_LABELS: Record<ExamCode, string> = {
  'gate-em': 'GATE EM',
  'gate-ee': 'GATE EE',
  'gate-cs': 'GATE CS',
  jee: 'JEE',
  neet: 'NEET',
  cat: 'CAT',
  upsc: 'UPSC',
  general: 'General',
};

export const INTENT_LABELS: Record<IntentType, string> = {
  help_request: '🙋 Help Request',
  confusion: '😕 Confusion',
  resource_hunt: '📚 Resource Hunt',
  comparison: '⚖️ Comparison',
  motivation_drop: '😔 Motivation Drop',
  result_anxiety: '😰 Result Anxiety',
  concept_question: '💡 Concept Question',
  practice_need: '📝 Practice Need',
  community_query: '👥 Community Query',
};
