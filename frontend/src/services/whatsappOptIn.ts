/**
 * WhatsApp Opt-In Service
 * Handles phone capture, consent storage, and share link generation
 */

export interface WhatsAppOptIn {
  phone: string;           // E.164 format: +91XXXXXXXXXX
  countryCode: string;     // 'IN' for India
  exam: string;            // 'JEE Main', 'NEET', etc.
  consentTimestamp: string; // ISO timestamp
  source: 'onboarding' | 'post_session' | 'referral_share' | 'exit_intent';
  userId?: string;
}

const STORAGE_KEY = 'edugenius_whatsapp_optin';
const SKIP_KEY = 'edugenius_whatsapp_skip_until';

// ── Store ───────────────────────────────────────────────────────────────────

export function saveWhatsAppOptIn(data: WhatsAppOptIn): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // Clear any skip preference once they opt in
    localStorage.removeItem(SKIP_KEY);
  } catch {
    // localStorage unavailable — silently fail
  }
}

// ── Load ────────────────────────────────────────────────────────────────────

export function loadWhatsAppOptIn(): WhatsAppOptIn | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WhatsAppOptIn;
  } catch {
    return null;
  }
}

// ── Has opted in ────────────────────────────────────────────────────────────

export function hasWhatsAppOptIn(): boolean {
  return loadWhatsAppOptIn() !== null;
}

// ── Skip preference (7-day cooldown) ───────────────────────────────────────

export function saveWhatsAppSkip(): void {
  const until = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days from now
  try {
    localStorage.setItem(SKIP_KEY, String(until));
  } catch {
    // ignore
  }
}

export function shouldShowWhatsAppPrompt(): boolean {
  if (hasWhatsAppOptIn()) return false;
  try {
    const raw = localStorage.getItem(SKIP_KEY);
    if (!raw) return true;
    const until = parseInt(raw, 10);
    return Date.now() > until;
  } catch {
    return true;
  }
}

// ── WhatsApp deep link ──────────────────────────────────────────────────────

export function buildWhatsAppLink(phone: string, message: string): string {
  // Strip any non-digit characters then build wa.me link
  const digits = phone.replace(/\D/g, '');
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${encoded}`;
}

// ── Referral share message ──────────────────────────────────────────────────

export function buildReferralShareMessage(
  exam: string,
  score?: number,
  topic?: string
): string {
  const examSlug = exam.toLowerCase().replace(/\s+/g, '-');
  const topicSlug = topic ? topic.toLowerCase().replace(/\s+/g, '-') : '';

  const baseUrl = `https://edugenius.app/practice?ref=challenge&exam=${encodeURIComponent(examSlug)}${topicSlug ? `&topic=${encodeURIComponent(topicSlug)}` : ''}`;

  if (score !== undefined && topic) {
    return `I just scored ${score}/10 on ${topic} with this AI tutor. Can you beat me? 🎯\n→ ${baseUrl}`;
  }
  if (score !== undefined) {
    return `I just scored ${score}/10 on ${exam} prep with this AI tutor. Can you beat me? 🎯\n→ ${baseUrl}`;
  }
  return `I've been using this AI tutor for ${exam} prep and it's amazing! Try it:\n→ ${baseUrl}`;
}

// ── Validate Indian phone number ────────────────────────────────────────────

export function validateIndianPhone(raw: string): { valid: boolean; normalized: string } {
  // Strip spaces, dashes, brackets
  const cleaned = raw.replace(/[\s\-().]/g, '');
  // Accept 10 digits (with or without leading 0) or +91XXXXXXXXXX
  const tenDigit = cleaned.replace(/^(\+91|91|0)/, '');
  if (/^\d{10}$/.test(tenDigit)) {
    return { valid: true, normalized: `+91${tenDigit}` };
  }
  return { valid: false, normalized: '' };
}
