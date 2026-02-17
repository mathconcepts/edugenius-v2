/**
 * Unit Tests for Sage Agent (AI Tutor)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SageAgent } from '../../../agents/sage';

describe('SageAgent', () => {
  let sage: SageAgent;

  beforeEach(async () => {
    sage = new SageAgent();
    await sage.start();
  });

  afterEach(async () => {
    await sage.stop();
  });

  describe('Session Management', () => {
    it('should start a new session', async () => {
      const sessionId = await sage.startSession('student-1', 'algebra');
      
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });

    it('should get session details', async () => {
      const sessionId = await sage.startSession('student-1', 'algebra');
      const session = sage.getSession(sessionId);

      expect(session).toBeDefined();
      expect(session?.studentId).toBe('student-1');
      expect(session?.topic).toBe('algebra');
      expect(session?.status).toBe('active');
    });

    it('should track active sessions count', async () => {
      expect(sage.getActiveSessions()).toBe(0);

      await sage.startSession('student-1', 'algebra');
      expect(sage.getActiveSessions()).toBe(1);

      await sage.startSession('student-2', 'geometry');
      expect(sage.getActiveSessions()).toBe(2);
    });

    it('should handle multiple sessions for same student', async () => {
      const session1 = await sage.startSession('student-1', 'algebra');
      const session2 = await sage.startSession('student-1', 'geometry');

      expect(session1).not.toBe(session2);
      expect(sage.getActiveSessions()).toBe(2);
    });

    it('should handle session without topic', async () => {
      const sessionId = await sage.startSession('student-1');
      const session = sage.getSession(sessionId);

      expect(session).toBeDefined();
      expect(session?.topic).toBeUndefined();
    });
  });

  describe('Tutoring Interaction', () => {
    it('should handle questions', async () => {
      const sessionId = await sage.startSession('student-1', 'algebra');
      
      // Should not throw
      await expect(sage.ask(sessionId, 'What is algebra?')).resolves.not.toThrow();
    });

    it('should throw for invalid session', async () => {
      await expect(
        sage.ask('invalid-session', 'Question')
      ).rejects.toThrow('Session not found');
    });

    it('should track questions asked', async () => {
      const sessionId = await sage.startSession('student-1', 'algebra');
      
      await sage.ask(sessionId, 'Question 1');
      await sage.ask(sessionId, 'Question 2');

      const session = sage.getSession(sessionId);
      expect(session?.context.questionsAsked).toBeGreaterThanOrEqual(2);
    });

    it('should update last activity', async () => {
      const sessionId = await sage.startSession('student-1', 'algebra');
      const session1 = sage.getSession(sessionId);
      const lastActivity1 = session1?.lastActivityAt;

      await new Promise(r => setTimeout(r, 10));
      await sage.ask(sessionId, 'Question');

      const session2 = sage.getSession(sessionId);
      expect(session2?.lastActivityAt).toBeGreaterThan(lastActivity1!);
    });
  });

  describe('Session Context', () => {
    it('should initialize context correctly', async () => {
      const sessionId = await sage.startSession('student-1', 'algebra');
      const session = sage.getSession(sessionId);

      expect(session?.context).toBeDefined();
      expect(session?.context.difficulty).toBe('medium');
      expect(session?.context.mastery).toBe(0.5);
      expect(session?.context.emotionalState).toBe('neutral');
      expect(session?.context.hintsUsed).toBe(0);
      expect(session?.context.questionsAsked).toBe(0);
      expect(session?.context.correctAnswers).toBe(0);
    });

    it('should have message history', async () => {
      const sessionId = await sage.startSession('student-1', 'algebra');
      const session = sage.getSession(sessionId);

      // Should have greeting message
      expect(session?.messages).toBeDefined();
      expect(session?.messages.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty question', async () => {
      const sessionId = await sage.startSession('student-1', 'algebra');
      
      // Should not throw, just process empty
      await expect(sage.ask(sessionId, '')).resolves.not.toThrow();
    });

    it('should handle very long question', async () => {
      const sessionId = await sage.startSession('student-1', 'algebra');
      const longQuestion = 'x'.repeat(10000);
      
      await expect(sage.ask(sessionId, longQuestion)).resolves.not.toThrow();
    });

    it('should handle special characters in question', async () => {
      const sessionId = await sage.startSession('student-1', 'algebra');
      
      await expect(
        sage.ask(sessionId, 'What is x² + y² = z²? <script>alert("xss")</script>')
      ).resolves.not.toThrow();
    });

    it('should handle unicode in topic', async () => {
      const sessionId = await sage.startSession('student-1', '数学/代数');
      const session = sage.getSession(sessionId);

      expect(session?.topic).toBe('数学/代数');
    });

    it('should handle rapid questions', async () => {
      const sessionId = await sage.startSession('student-1', 'algebra');
      
      const promises = Array(10).fill(null).map((_, i) =>
        sage.ask(sessionId, `Question ${i}`)
      );

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });

  describe('Greeting Variations', () => {
    it('should generate greeting with topic', async () => {
      const sessionId = await sage.startSession('student-1', 'algebra');
      const session = sage.getSession(sessionId);
      
      const greetingMessage = session?.messages.find(m => m.role === 'tutor');
      expect(greetingMessage?.content).toBeDefined();
      expect(greetingMessage?.content.length).toBeGreaterThan(0);
    });

    it('should generate greeting without topic', async () => {
      const sessionId = await sage.startSession('student-1');
      const session = sage.getSession(sessionId);
      
      const greetingMessage = session?.messages.find(m => m.role === 'tutor');
      expect(greetingMessage?.content).toBeDefined();
    });
  });
});

describe('SageAgent Robustness', () => {
  it('should handle start/stop cycles', async () => {
    const sage = new SageAgent();

    for (let i = 0; i < 3; i++) {
      await sage.start();
      await sage.startSession(`student-${i}`, 'math');
      await sage.stop();
    }

    // Sessions should be cleared
    expect(sage.getActiveSessions()).toBe(0);
  });

  it('should isolate sessions between students', async () => {
    const sage = new SageAgent();
    await sage.start();

    const session1 = await sage.startSession('student-1', 'algebra');
    const session2 = await sage.startSession('student-2', 'geometry');

    await sage.ask(session1, 'Question for student 1');
    await sage.ask(session2, 'Question for student 2');

    const s1 = sage.getSession(session1);
    const s2 = sage.getSession(session2);

    expect(s1?.studentId).toBe('student-1');
    expect(s2?.studentId).toBe('student-2');
    expect(s1?.topic).not.toBe(s2?.topic);

    await sage.stop();
  });
});
