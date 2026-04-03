import { describe, it, expect } from 'vitest';
import {
  composeSystemContext,
  difficultyContext,
  examProximityContext,
  weaknessContext,
  type UserContext,
} from '../prompt-modifiers';

describe('prompt-modifiers', () => {
  const baseCtx: UserContext = {
    sessionId: 'test-session',
  };

  describe('composeSystemContext', () => {
    it('returns empty string when no context data is provided', () => {
      expect(composeSystemContext(baseCtx)).toBe('');
    });

    it('combines all modifiers when full context is provided', () => {
      // Set exam date ~20 days from now in IST
      const examDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
      const ctx: UserContext = {
        sessionId: 'test',
        topic: 'linear-algebra',
        diagnosticScore: 0.25,
        examDate,
        topicAccuracies: { 'calculus': 0.2, 'probability': 0.35 },
      };
      const result = composeSystemContext(ctx);
      expect(result).toContain('## Student Context');
      expect(result).toContain('25%');
      expect(result).toContain('days');
      expect(result).toContain('weakest');
    });
  });

  describe('difficultyContext', () => {
    it('returns empty when no diagnostic score', () => {
      expect(difficultyContext(baseCtx)).toBe('');
    });

    it('recommends fundamentals for low score (<30%)', () => {
      const result = difficultyContext({ ...baseCtx, topic: 'calculus', diagnosticScore: 0.15 });
      expect(result).toContain('15%');
      expect(result).toContain('fundamentals');
    });

    it('recommends applications for mid score (30-60%)', () => {
      const result = difficultyContext({ ...baseCtx, topic: 'calculus', diagnosticScore: 0.45 });
      expect(result).toContain('45%');
      expect(result).toContain('applications');
    });

    it('recommends edge cases for high score (>60%)', () => {
      const result = difficultyContext({ ...baseCtx, topic: 'calculus', diagnosticScore: 0.85 });
      expect(result).toContain('85%');
      expect(result).toContain('edge cases');
    });
  });

  describe('examProximityContext', () => {
    it('returns empty when no exam date', () => {
      expect(examProximityContext(baseCtx)).toBe('');
    });

    it('shows urgency for <7 days', () => {
      const examDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const result = examProximityContext({ ...baseCtx, examDate });
      expect(result).toContain('EXAM IN');
      expect(result).toContain('high-yield');
    });

    it('shows moderate urgency for 8-30 days', () => {
      const examDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
      const result = examProximityContext({ ...baseCtx, examDate });
      expect(result).toContain('20 days');
      expect(result).toContain('timed practice');
    });

    it('shows relaxed tone for >90 days', () => {
      const examDate = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();
      const result = examProximityContext({ ...baseCtx, examDate });
      expect(result).toContain('foundations');
    });
  });

  describe('weaknessContext', () => {
    it('returns empty when no accuracy data', () => {
      expect(weaknessContext(baseCtx)).toBe('');
    });

    it('returns empty when no weak topics', () => {
      const result = weaknessContext({ ...baseCtx, topicAccuracies: { 'calculus': 0.8 } });
      expect(result).toBe('');
    });

    it('lists weak topics with accuracy <40%', () => {
      const result = weaknessContext({
        ...baseCtx,
        topicAccuracies: { 'calculus': 0.2, 'probability': 0.35, 'linear-algebra': 0.9 },
      });
      expect(result).toContain('calculus');
      expect(result).toContain('probability');
      expect(result).not.toContain('linear-algebra');
    });

    it('limits to 3 weakest topics', () => {
      const result = weaknessContext({
        ...baseCtx,
        topicAccuracies: {
          'a': 0.1, 'b': 0.15, 'c': 0.2, 'd': 0.25, 'e': 0.3,
        },
      });
      // Should only include 3, not all 5
      const matches = result.match(/%\)/g);
      expect(matches?.length).toBe(3);
    });
  });
});
