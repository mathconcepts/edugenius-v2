/**
 * spacedRepetitionEngine.ts — SM-2 algorithm implementation
 * CEO/Admin can disable via appStore.spacedRepetitionEnabled.
 * No API calls — all local storage.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SRCard {
  id: string;
  topic: string;
  subject: string;
  concept: string;          // what to show on front of card
  hint?: string;            // optional hint
  lastSeen: number;         // timestamp ms
  nextReview: number;       // timestamp ms
  interval: number;         // days between reviews
  easeFactor: number;       // SM-2 ease factor (default 2.5)
  repetitions: number;      // successful repetitions
  retentionScore: number;   // estimated retention 0-100
  totalReviews: number;
  correctReviews: number;
}

export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;
// 0: complete blackout
// 1: incorrect, remembered with hint
// 2: incorrect, easy to remember
// 3: correct, hard (hesitant)
// 4: correct, good
// 5: perfect, no hesitation

const STORAGE_KEY = 'eg_sr_cards_v2';

// ─── SM-2 Core ────────────────────────────────────────────────────────────────

export function sm2Update(card: SRCard, quality: ReviewQuality): SRCard {
  let { easeFactor, interval, repetitions } = card;

  if (quality < 3) {
    // Failed — reset
    repetitions = 0;
    interval = 1;
  } else {
    // Success
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
  }

  // Update ease factor
  easeFactor = Math.max(
    1.3,
    easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  );

  // Retention score: exponential decay model
  // R(t) = e^(-t/S) where S is stability (interval * easeFactor)
  const stability = interval * easeFactor;
  const retentionScore = Math.round(100 * Math.exp(-interval / stability));

  return {
    ...card,
    easeFactor,
    interval,
    repetitions,
    lastSeen: Date.now(),
    nextReview: Date.now() + interval * 86400000,
    retentionScore: Math.min(95, Math.max(5, retentionScore)),
    totalReviews: card.totalReviews + 1,
    correctReviews: card.correctReviews + (quality >= 3 ? 1 : 0),
  };
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export function getAllCards(): SRCard[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as SRCard[];
  } catch { return []; }
}

export function saveCard(card: SRCard): void {
  const cards = getAllCards().filter(c => c.id !== card.id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...cards, card]));
}

export function deleteCard(id: string): void {
  const cards = getAllCards().filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

export function addCard(topic: string, subject: string, concept: string, hint?: string): SRCard {
  const card: SRCard = {
    id: `sr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    topic, subject, concept, hint,
    lastSeen: 0,
    nextReview: Date.now(),     // due immediately
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
    retentionScore: 100,
    totalReviews: 0,
    correctReviews: 0,
  };
  saveCard(card);
  return card;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function getDueCards(): SRCard[] {
  const now = Date.now();
  return getAllCards()
    .filter(c => c.nextReview <= now)
    .sort((a, b) => a.nextReview - b.nextReview);
}

export function getUpcomingCards(days = 7): Array<{ date: string; count: number }> {
  const cards = getAllCards();
  const result: Record<string, number> = {};
  const now = Date.now();

  for (let d = 0; d <= days; d++) {
    const date = new Date(now + d * 86400000).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    result[date] = 0;
  }

  cards.forEach(card => {
    for (let d = 0; d <= days; d++) {
      const dayStart = now + d * 86400000;
      const dayEnd = dayStart + 86400000;
      if (card.nextReview >= dayStart && card.nextReview < dayEnd) {
        const date = new Date(dayStart).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        result[date] = (result[date] ?? 0) + 1;
      }
    }
  });

  return Object.entries(result).map(([date, count]) => ({ date, count }));
}

export function getStats(): { total: number; due: number; mastered: number; avgRetention: number } {
  const cards = getAllCards();
  const due = getDueCards().length;
  const mastered = cards.filter(c => c.repetitions >= 4 && c.retentionScore >= 80).length;
  const avgRetention = cards.length
    ? Math.round(cards.reduce((s, c) => s + c.retentionScore, 0) / cards.length)
    : 0;
  return { total: cards.length, due, mastered, avgRetention };
}

// ─── Seed Sample Cards ────────────────────────────────────────────────────────

export function ensureSampleCards(): void {
  if (getAllCards().length > 0) return;
  const samples = [
    { topic: "Faraday's Law", subject: 'Electromagnetics', concept: "EMF = -N·dΦ/dt", hint: 'N = turns, Φ = flux in Webers' },
    { topic: "Lenz's Law", subject: 'Electromagnetics', concept: "Induced current opposes the change in flux that caused it.", hint: "Think: nature resists change" },
    { topic: 'Divergence Theorem', subject: 'Electromagnetics', concept: "∮S F·dS = ∭V (∇·F) dV — surface integral = volume integral of divergence", hint: "Gauss theorem" },
    { topic: 'Merge Sort', subject: 'Algorithms', concept: "Divide-and-conquer. O(n log n) always. Stable. O(n) space.", hint: "Split, recurse, merge" },
    { topic: "P vs NP", subject: 'Theory of Computation', concept: "P ⊆ NP. NP-complete problems: 3-SAT, Vertex Cover, Hamiltonian Cycle.", hint: "Cook's theorem: 3-SAT is NP-complete" },
    { topic: 'Normal Distribution', subject: 'Statistics', concept: "68-95-99.7 rule: ±1σ, ±2σ, ±3σ. z = (x-μ)/σ", hint: "Standardise first, then use z-table" },
    { topic: "Bayes' Theorem", subject: 'Probability', concept: "P(A|B) = P(B|A)·P(A) / P(B). Base rate often dominates.", hint: "Draw a tree diagram" },
  ];
  samples.forEach(s => addCard(s.topic, s.subject, s.concept, s.hint));
}
