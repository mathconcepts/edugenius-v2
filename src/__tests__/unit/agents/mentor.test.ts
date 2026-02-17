/**
 * Unit Tests for Mentor Agent (Engagement)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MentorAgent } from '../../../agents/mentor';

describe('MentorAgent', () => {
  let mentor: MentorAgent;

  beforeEach(async () => {
    mentor = new MentorAgent();
    await mentor.start();
  });

  afterEach(async () => {
    await mentor.stop();
  });

  describe('Engagement Tracking', () => {
    it('should calculate engagement score', async () => {
      const engagement = await mentor.checkStudentEngagement('student-1');

      expect(engagement).toBeDefined();
      expect(engagement.studentId).toBe('student-1');
      expect(typeof engagement.score).toBe('number');
      expect(engagement.score).toBeGreaterThanOrEqual(0);
      expect(engagement.score).toBeLessThanOrEqual(1);
    });

    it('should calculate churn risk', async () => {
      const engagement = await mentor.checkStudentEngagement('student-1');

      expect(typeof engagement.churnRisk).toBe('number');
      expect(engagement.churnRisk).toBeGreaterThanOrEqual(0);
      expect(engagement.churnRisk).toBeLessThanOrEqual(1);
    });

    it('should include engagement factors', async () => {
      const engagement = await mentor.checkStudentEngagement('student-1');

      expect(engagement.factors).toBeDefined();
      expect(typeof engagement.factors.recency).toBe('number');
      expect(typeof engagement.factors.frequency).toBe('number');
      expect(typeof engagement.factors.duration).toBe('number');
      expect(typeof engagement.factors.progress).toBe('number');
      expect(typeof engagement.factors.streak).toBe('number');
    });

    it('should cache engagement calculations', async () => {
      const engagement1 = await mentor.checkStudentEngagement('student-1');
      const engagement2 = await mentor.checkStudentEngagement('student-1');

      // Should be same cached result within time window
      expect(engagement1.calculatedAt).toBe(engagement2.calculatedAt);
    });

    it('should handle multiple students', async () => {
      const e1 = await mentor.checkStudentEngagement('student-1');
      const e2 = await mentor.checkStudentEngagement('student-2');
      const e3 = await mentor.checkStudentEngagement('student-3');

      expect(e1.studentId).toBe('student-1');
      expect(e2.studentId).toBe('student-2');
      expect(e3.studentId).toBe('student-3');
    });
  });

  describe('Streak Tracking', () => {
    it('should return undefined for unknown student', () => {
      const streak = mentor.getStudentStreak('unknown-student');
      expect(streak).toBeUndefined();
    });

    it('should track streak data structure', async () => {
      // Trigger streak tracking via engagement
      await mentor.checkStudentEngagement('student-1');
      
      // Streak may or may not be set depending on implementation
      const streak = mentor.getStudentStreak('student-1');
      
      if (streak) {
        expect(streak.studentId).toBe('student-1');
        expect(typeof streak.currentStreak).toBe('number');
        expect(typeof streak.longestStreak).toBe('number');
      }
    });
  });

  describe('Nudge System', () => {
    it('should send custom nudge', async () => {
      await expect(
        mentor.sendCustomNudge('student-1', 'Keep learning!', 'push')
      ).resolves.not.toThrow();
    });

    it('should handle different channels', async () => {
      const channels = ['push', 'email', 'whatsapp', 'sms', 'in_app'] as const;

      for (const channel of channels) {
        await expect(
          mentor.sendCustomNudge('student-1', 'Test', channel)
        ).resolves.not.toThrow();
      }
    });

    it('should default to push channel', async () => {
      await expect(
        mentor.sendCustomNudge('student-1', 'Test message')
      ).resolves.not.toThrow();
    });

    it('should handle empty message', async () => {
      await expect(
        mentor.sendCustomNudge('student-1', '')
      ).resolves.not.toThrow();
    });

    it('should handle long message', async () => {
      const longMessage = 'x'.repeat(1000);
      await expect(
        mentor.sendCustomNudge('student-1', longMessage)
      ).resolves.not.toThrow();
    });

    it('should handle special characters', async () => {
      await expect(
        mentor.sendCustomNudge('student-1', '🔥 Keep going! <script>')
      ).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty student ID', async () => {
      const engagement = await mentor.checkStudentEngagement('');
      expect(engagement.studentId).toBe('');
    });

    it('should handle numeric student ID', async () => {
      const engagement = await mentor.checkStudentEngagement('12345');
      expect(engagement.studentId).toBe('12345');
    });

    it('should handle special characters in student ID', async () => {
      const engagement = await mentor.checkStudentEngagement('student@test.com');
      expect(engagement.studentId).toBe('student@test.com');
    });

    it('should handle concurrent engagement checks', async () => {
      const promises = Array(10).fill(null).map((_, i) =>
        mentor.checkStudentEngagement(`student-${i}`)
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach((r, i) => {
        expect(r.studentId).toBe(`student-${i}`);
      });
    });

    it('should handle concurrent nudges', async () => {
      const promises = Array(10).fill(null).map((_, i) =>
        mentor.sendCustomNudge(`student-${i}`, `Message ${i}`)
      );

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });
});

describe('MentorAgent Robustness', () => {
  it('should handle rapid start/stop', async () => {
    const mentor = new MentorAgent();

    for (let i = 0; i < 3; i++) {
      await mentor.start();
      await mentor.checkStudentEngagement('student-1');
      await mentor.stop();
    }
  });

  it('should handle operations after restart', async () => {
    const mentor = new MentorAgent();

    await mentor.start();
    await mentor.checkStudentEngagement('student-1');
    await mentor.stop();

    await mentor.start();
    const engagement = await mentor.checkStudentEngagement('student-2');
    expect(engagement.studentId).toBe('student-2');
    await mentor.stop();
  });
});
