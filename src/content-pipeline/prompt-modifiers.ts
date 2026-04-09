/**
 * Content Pipeline — Prompt Modifiers
 *
 * Pure functions that compose additional system prompt context for the AI tutor.
 * No LLM calls, no API calls — just string composition from user context.
 *
 *   UserContext ──▶ difficultyContext()     ──┐
 *                  examProximityContext()  ──┼──▶ composeSystemContext()
 *                  weaknessContext()       ──┘
 */

export interface UserContext {
  sessionId: string;
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  examDate?: string;        // ISO date string
  diagnosticScore?: number; // 0-1 for this topic
  taskType?: 'practice' | 'study' | 'revise';
  topicAccuracies?: Record<string, number>; // topic → accuracy (0-1)
}

/**
 * Compose additional system prompt context from user context.
 * Returns a string to append to the AI tutor's system prompt.
 */
export function composeSystemContext(ctx: UserContext): string {
  const parts: string[] = [];

  const diff = difficultyContext(ctx);
  if (diff) parts.push(diff);

  const prox = examProximityContext(ctx);
  if (prox) parts.push(prox);

  const weak = weaknessContext(ctx);
  if (weak) parts.push(weak);

  const tired = tiredStudentContext(ctx);
  if (tired) parts.push(tired);

  if (parts.length === 0) return '';
  return '\n\n## Student Context\n' + parts.join('\n');
}

/**
 * Tired student modifier — if studying late at night and exam is approaching,
 * prompt for shorter, more direct responses.
 */
export function tiredStudentContext(ctx: UserContext): string {
  if (!ctx.examDate) return '';

  // Check if exam is within 30 days
  const now = new Date();
  const istHour = new Date(now.getTime() + 5.5 * 3600 * 1000).getUTCHours();
  const exam = new Date(ctx.examDate);
  const daysLeft = Math.ceil((exam.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft > 30 || daysLeft < 0) return '';
  if (istHour < 21 && istHour >= 5) return ''; // Not late night (9pm-5am IST)

  return '- Student is likely studying late. Keep answers SHORT and actionable. Lead with the formula or method, then explain why. No preamble.';
}

/**
 * Difficulty modifier — adjusts based on diagnostic score for the topic.
 */
export function difficultyContext(ctx: UserContext): string {
  if (ctx.diagnosticScore == null || !ctx.topic) return '';

  const pct = Math.round(ctx.diagnosticScore * 100);
  if (pct < 30) {
    return `- Student scored ${pct}% on ${ctx.topic} in their diagnostic. Start with fundamentals and build up gradually. Use simpler language and more examples.`;
  } else if (pct < 60) {
    return `- Student scored ${pct}% on ${ctx.topic}. They have basics but struggle with applications. Focus on worked examples and common patterns.`;
  } else {
    return `- Student scored ${pct}% on ${ctx.topic}. They're strong here. Focus on edge cases, time-saving tricks, and exam-level difficulty.`;
  }
}

/**
 * Exam proximity modifier — adjusts urgency and focus based on days until exam.
 */
export function examProximityContext(ctx: UserContext): string {
  if (!ctx.examDate) return '';

  const now = new Date(Date.now() + 5.5 * 3600 * 1000); // IST
  const exam = new Date(ctx.examDate);
  const daysLeft = Math.ceil((exam.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return '';
  if (daysLeft <= 7) {
    return `- EXAM IN ${daysLeft} DAYS. Focus only on high-yield topics and quick revision. No new concepts. Practice previous year questions.`;
  } else if (daysLeft <= 30) {
    return `- Exam in ${daysLeft} days. Prioritize frequently tested topics and timed practice. Keep explanations concise.`;
  } else if (daysLeft <= 90) {
    return `- Exam in ${daysLeft} days. Good time for deep understanding and building problem-solving speed.`;
  }
  return `- Exam in ${daysLeft} days. Plenty of time to build strong foundations.`;
}

/**
 * Weakness modifier — highlights weak topics based on practice accuracy.
 */
export function weaknessContext(ctx: UserContext): string {
  if (!ctx.topicAccuracies) return '';

  const weakTopics = Object.entries(ctx.topicAccuracies)
    .filter(([_, acc]) => acc < 0.4)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3);

  if (weakTopics.length === 0) return '';

  const topicList = weakTopics.map(([t, a]) => `${t} (${Math.round(a * 100)}%)`).join(', ');
  return `- Student's weakest areas: ${topicList}. If they ask about these topics, be extra patient and thorough.`;
}
