// Keyword-based topic detection for GATE Engineering Mathematics
// Used by chat-routes, gate-routes to auto-tag notebook entries

import { TOPIC_KEYWORDS } from '../constants/topics';

export function detectTopic(text: string): string {
  const lower = text.toLowerCase();
  let bestMatch = 'general';
  let maxHits = 0;

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const hits = keywords.filter(kw => lower.includes(kw)).length;
    if (hits > maxHits) {
      maxHits = hits;
      bestMatch = topic;
    }
  }

  return bestMatch;
}
