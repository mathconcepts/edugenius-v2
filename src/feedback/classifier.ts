/**
 * EduGenius Feedback Classifier
 * Keyword-based classification with confidence scoring and quality analysis
 */

import type {
  TicketCategory,
  TicketPriority,
  ComplaintQuality,
  CreateTicketInput,
} from './types';

// ============================================================================
// Keyword Maps
// ============================================================================

const CATEGORY_KEYWORDS: Record<TicketCategory, string[]> = {
  content_error: [
    'wrong answer',
    'incorrect answer',
    'wrong explanation',
    'mistake in',
    'error in',
    'wrong formula',
    'wrong concept',
    'incorrect formula',
    'incorrect explanation',
    'wrong solution',
    'solution is wrong',
    'answer is wrong',
    'this is wrong',
    'incorrect solution',
    'bad explanation',
    'wrong derivation',
    'calculation error',
    'typo in answer',
    'factual error',
  ],
  content_missing: [
    'missing topic',
    'missing chapter',
    'not covered',
    'no content',
    'content missing',
    'topic not found',
    'where is the content',
    'incomplete coverage',
    'syllabus gap',
    'no explanation for',
    'missing question',
    'no practice',
    'not available',
    'not included',
    'need more content',
    'add content',
  ],
  ai_behavior: [
    'ai wrong',
    'bot confused',
    'bad response',
    'ai gave wrong',
    'ai said',
    'sage said',
    'tutor gave',
    'ai is not helping',
    'bot is not helping',
    'chat is wrong',
    'tutor is wrong',
    'ai keeps repeating',
    'bot repeating',
    'unhelpful response',
    'ai confused me',
    'sage is wrong',
    'mentor is wrong',
    'bot gave',
    'chatbot',
    'ai answer',
  ],
  technical_bug: [
    'crash',
    'crashed',
    'error',
    'not loading',
    'broken',
    'bug',
    'glitch',
    'not working',
    '500 error',
    '404',
    'blank screen',
    'black screen',
    'freezes',
    'froze',
    'stuck',
    'loops',
    'infinite loop',
    'timeout',
    'exception',
    'failed to load',
    'cannot open',
    'app crash',
    'page crash',
  ],
  payment_issue: [
    'payment',
    'charge',
    'charged',
    'refund',
    'billing',
    'subscription',
    'money',
    'amount',
    'invoice',
    'receipt',
    'deducted',
    'transaction',
    'bank',
    'upi',
    'card',
    'paid',
    'double charged',
    'overcharged',
    'not upgraded',
    'premium',
    'plan',
  ],
  access_denied: [
    'cannot access',
    "can't access",
    'access denied',
    'locked',
    'not allowed',
    'restricted',
    'no permission',
    'blocked',
    'cannot view',
    "can't view",
    'not enrolled',
    'enrollment issue',
    'access issue',
    'open content',
    'locked content',
    'premium content locked',
    'upgrade to access',
  ],
  feature_request: [
    'feature request',
    'please add',
    'would be great if',
    'suggestion',
    'idea',
    'request',
    'wish list',
    'add feature',
    'improve',
    'enhancement',
    'new feature',
    'add option',
    'consider adding',
    'would love to see',
    'can you add',
    'it would help if',
    'could you add',
  ],
  general_feedback: [
    'great app',
    'love it',
    'awesome',
    'fantastic',
    'excellent',
    'good job',
    'thank you',
    'thanks',
    'helpful',
    'really useful',
    'amazing',
    'appreciate',
    'good work',
    'keep it up',
    'brilliant',
    'feedback',
    'general comment',
    'just wanted to say',
  ],
  account_issue: [
    'account',
    'login',
    'log in',
    'sign in',
    'profile',
    'password',
    'forgot password',
    'reset password',
    'username',
    'email change',
    'cannot login',
    "can't login",
    'account locked',
    'delete account',
    'merge account',
    'settings',
    'preferences',
    'notification settings',
  ],
  exam_content: [
    'exam question',
    'exam answer',
    'jee question',
    'neet question',
    'mock test',
    'practice test',
    'past paper',
    'previous year',
    'pyq',
    'wrong exam question',
    'exam preparation',
    'test content',
    'test error',
    'quiz error',
    'wrong in test',
    'incorrect in exam',
  ],
  performance: [
    'slow',
    'laggy',
    'lag',
    'takes too long',
    'loading',
    'performance',
    'buffering',
    'video buffering',
    'takes forever',
    'hangs',
    'response time',
    'very slow',
    'app is slow',
    'website is slow',
    'delay',
    'long wait',
  ],
  other: [],
};

const HIGH_PRIORITY_KEYWORDS: string[] = [
  'urgent',
  'immediately',
  'critical',
  'exam tomorrow',
  "can't access",
  'wrong answer exam',
  'asap',
  'important',
  'serious issue',
  'major bug',
  'cannot study',
  'exam in two days',
  'exam next day',
  'need help now',
];

const CRITICAL_KEYWORDS: string[] = [
  'data loss',
  'account deleted',
  'payment deducted not received',
  'exam today',
  'exam in few hours',
  'money lost',
  'all data gone',
  'lost my progress',
  'cannot login exam',
  'access denied exam day',
  'double payment',
];

// ============================================================================
// Classification Engine
// ============================================================================

export interface ClassificationResult {
  category: TicketCategory;
  priority: TicketPriority;
  subcategory?: string;
  tags: string[];
  confidence: number;
}

/**
 * Tokenize and normalize text for matching
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Count keyword hits in text
 */
function countKeywordHits(text: string, keywords: string[]): number {
  const normalized = normalizeText(text);
  return keywords.filter((kw) => normalized.includes(kw.toLowerCase())).sum_() ?? 0;
}

function sumHits(text: string, keywords: string[]): number {
  const normalized = normalizeText(text);
  return keywords.reduce((count, kw) => {
    return count + (normalized.includes(kw.toLowerCase()) ? 1 : 0);
  }, 0);
}

/**
 * Classify a ticket based on title + description
 */
export function classifyTicket(title: string, description: string): ClassificationResult {
  const combined = `${title} ${description}`;
  const normalized = normalizeText(combined);

  const scores: Partial<Record<TicketCategory, number>> = {};

  // Score each category
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [TicketCategory, string[]][]) {
    if (keywords.length === 0) continue;
    const hits = sumHits(combined, keywords);
    if (hits > 0) {
      scores[cat] = hits / keywords.length;
    }
  }

  // Find winner
  let bestCategory: TicketCategory = 'other';
  let bestScore = 0;

  for (const [cat, score] of Object.entries(scores) as [TicketCategory, number][]) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  }

  // Determine priority
  let priority: TicketPriority = 'low';

  const criticalHits = sumHits(combined, CRITICAL_KEYWORDS);
  const highHits = sumHits(combined, HIGH_PRIORITY_KEYWORDS);

  if (criticalHits > 0) {
    priority = 'critical';
  } else if (highHits > 0) {
    priority = 'high';
  } else if (
    bestCategory === 'payment_issue' ||
    bestCategory === 'access_denied' ||
    bestCategory === 'technical_bug'
  ) {
    priority = 'medium';
  } else if (
    bestCategory === 'content_error' ||
    bestCategory === 'ai_behavior' ||
    bestCategory === 'exam_content'
  ) {
    priority = 'medium';
  } else {
    priority = 'low';
  }

  // Generate tags
  const tags: string[] = [bestCategory];
  if (priority === 'critical' || priority === 'high') tags.push(priority);
  if (normalized.includes('jee')) tags.push('jee');
  if (normalized.includes('neet')) tags.push('neet');
  if (normalized.includes('physics')) tags.push('physics');
  if (normalized.includes('chemistry')) tags.push('chemistry');
  if (normalized.includes('mathematics') || normalized.includes('maths') || normalized.includes('math')) {
    tags.push('mathematics');
  }
  if (normalized.includes('biology')) tags.push('biology');
  if (normalized.includes('sage')) tags.push('sage');
  if (normalized.includes('mentor')) tags.push('mentor');

  // Subcategory
  let subcategory: string | undefined;
  if (bestCategory === 'technical_bug' && normalized.includes('video')) subcategory = 'video_playback';
  if (bestCategory === 'technical_bug' && normalized.includes('login')) subcategory = 'authentication';
  if (bestCategory === 'content_error' && normalized.includes('formula')) subcategory = 'formula_error';
  if (bestCategory === 'content_error' && normalized.includes('answer')) subcategory = 'answer_error';
  if (bestCategory === 'payment_issue' && normalized.includes('refund')) subcategory = 'refund_request';

  const confidence = Math.min(100, Math.round(bestScore * 100 * 10));

  return {
    category: bestCategory,
    priority,
    subcategory,
    tags: [...new Set(tags)],
    confidence,
  };
}

// ============================================================================
// Quality Scoring
// ============================================================================

/**
 * Score the complaint quality based on the text content (0–100)
 */
export function scoreComplaintQuality(
  title: string,
  description: string
): ComplaintQuality {
  const combined = `${title} ${description}`;
  const normalized = normalizeText(combined);

  // --- Specific details ---
  const specificPatterns = [
    /chapter\s*\d+/i,
    /topic\s*[\w\s]+/i,
    /question\s*(?:no|number|#)?\s*\d+/i,
    /page\s*\d+/i,
    /module\s*\d+/i,
    /unit\s*\d+/i,
    /exercise\s*\d+/i,
    /problem\s*\d+/i,
    /(physics|chemistry|mathematics|biology|english)/i,
    /(jee|neet|cbse|icse|cat|upsc)/i,
  ];
  const hasSpecificDetails = specificPatterns.some((p) => p.test(combined));

  // --- Reproduction steps ---
  const reproPatterns = [
    /when i/i,
    /when i click/i,
    /if i/i,
    /steps to reproduce/i,
    /to reproduce/i,
    /i tried/i,
    /after\s+(clicking|submitting|opening)/i,
    /on clicking/i,
    /following steps/i,
    /here is what happened/i,
    /what i did/i,
  ];
  const hasReproSteps = reproPatterns.some((p) => p.test(combined));

  // --- Expected behavior ---
  const expectedPatterns = [
    /expected/i,
    /should have/i,
    /should be/i,
    /supposed to/i,
    /it should/i,
    /i expected/i,
    /the correct answer/i,
    /it was supposed/i,
    /was expecting/i,
  ];
  const hasExpectedBehavior = expectedPatterns.some((p) => p.test(combined));

  // --- Actual behavior ---
  const actualPatterns = [
    /actually/i,
    /instead/i,
    /but it/i,
    /however/i,
    /but the app/i,
    /what happened/i,
    /it showed/i,
    /it displayed/i,
    /i saw/i,
    /got an error/i,
    /received/i,
  ];
  const hasActualBehavior = actualPatterns.some((p) => p.test(combined));

  // --- Sentiment ---
  const angryPatterns = [/angry|furious|ridiculous|unacceptable|terrible|horrible|worst|outraged|disgusted/i];
  const frustratedPatterns = [/frustrated|annoying|annoyed|disappointed|fed up|sick of|not happy|so bad|hate/i];
  const positivePatterns = [/great|love|awesome|excellent|fantastic|helpful|amazing|appreciate|good job/i];

  let sentiment: ComplaintQuality['sentiment'] = 'neutral';
  if (angryPatterns.some((p) => p.test(combined))) {
    sentiment = 'angry';
  } else if (frustratedPatterns.some((p) => p.test(combined))) {
    sentiment = 'frustrated';
  } else if (positivePatterns.some((p) => p.test(combined))) {
    sentiment = 'positive';
  }

  // --- Urgency ---
  const urgentPatterns = [/exam today|exam now|right now|immediately|urgently|emergency|hours left/i];
  const highUrgencyPatterns = [/exam tomorrow|exam this week|asap|urgent|critical|need help now/i];
  const mediumUrgencyPatterns = [/soon|please help|need this|important/i];

  let urgency: ComplaintQuality['urgency'] = 'low';
  if (urgentPatterns.some((p) => p.test(combined))) {
    urgency = 'urgent';
  } else if (highUrgencyPatterns.some((p) => p.test(combined))) {
    urgency = 'high';
  } else if (mediumUrgencyPatterns.some((p) => p.test(combined))) {
    urgency = 'medium';
  }

  // --- Actionable ---
  // Actionable if it names something fixable, not just vague praise/rant
  const vague = description.split(' ').length < 5 && !hasSpecificDetails;
  const isActionable = !vague && (hasSpecificDetails || hasReproSteps || hasExpectedBehavior || hasActualBehavior);

  // --- Score calculation ---
  let score = 0;
  if (hasSpecificDetails) score += 25;
  if (hasReproSteps) score += 20;
  if (hasExpectedBehavior) score += 20;
  if (hasActualBehavior) score += 20;
  if (isActionable) score += 10;
  if (description.split(' ').length >= 20) score += 5; // Sufficient detail length

  return {
    score,
    hasSpecificDetails,
    hasReproSteps,
    hasExpectedBehavior,
    hasActualBehavior,
    sentiment,
    urgency,
    isActionable,
  };
}

/**
 * Determine the confidence threshold required for L1 auto-resolution
 * based on ticket priority
 */
export function getL1ConfidenceThreshold(priority: TicketPriority): number {
  switch (priority) {
    case 'critical':
      return 90;
    case 'high':
      return 80;
    case 'medium':
      return 70;
    case 'low':
      return 60;
  }
}
