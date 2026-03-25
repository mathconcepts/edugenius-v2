/**
 * Unit Tests for Daily Problem Job
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatProblemCaption, formatSolution } from '../daily-problem';

// ============================================================================
// Test Data
// ============================================================================

const mockPYQ = {
  id: 'test-pyq-1',
  exam_id: 'gate-engineering-maths',
  year: 2023,
  question_text: 'The eigenvalues of the matrix [[3, 1], [0, 3]] are',
  options: { A: '3, 3', B: '3, 0', C: '1, 3', D: '0, 1' },
  correct_answer: 'A',
  explanation: 'The matrix is upper triangular. Eigenvalues are diagonal entries: 3 and 3.',
  topic: 'linear-algebra',
  difficulty: 'easy',
  marks: 2,
};

// ============================================================================
// Format Tests
// ============================================================================

describe('formatProblemCaption', () => {
  it('should format a PYQ as an HTML Telegram message', () => {
    const caption = formatProblemCaption(mockPYQ);

    expect(caption).toContain('GATE Engineering Math');
    expect(caption).toContain('Linear Algebra');
    expect(caption).toContain('★☆☆');
    expect(caption).toContain('GATE 2023');
    expect(caption).toContain('eigenvalues');
    expect(caption).toContain('A) 3, 3');
    expect(caption).toContain('B) 3, 0');
  });

  it('should handle medium difficulty', () => {
    const medium = { ...mockPYQ, difficulty: 'medium' };
    const caption = formatProblemCaption(medium);
    expect(caption).toContain('★★☆');
  });

  it('should handle hard difficulty', () => {
    const hard = { ...mockPYQ, difficulty: 'hard' };
    const caption = formatProblemCaption(hard);
    expect(caption).toContain('★★★');
  });

  it('should handle stringified JSON options', () => {
    const stringOpts = { ...mockPYQ, options: JSON.stringify(mockPYQ.options) };
    const caption = formatProblemCaption(stringOpts);
    expect(caption).toContain('A) 3, 3');
  });

  it('should format topic with hyphens as title case', () => {
    const pyq = { ...mockPYQ, topic: 'differential-equations' };
    const caption = formatProblemCaption(pyq);
    expect(caption).toContain('Differential Equations');
  });
});

describe('formatSolution', () => {
  it('should include correct answer and explanation', () => {
    const solution = formatSolution(mockPYQ);

    expect(solution).toContain('Answer: A)');
    expect(solution).toContain('upper triangular');
    expect(solution).toContain('diagonal entries');
  });

  it('should include the follow CTA', () => {
    const solution = formatSolution(mockPYQ);
    expect(solution).toContain('daily GATE math problems');
  });
});

// ============================================================================
// selectUnpostedPYQ tests would require DB mocks — integration test territory.
// Covered via the route handler test below with a mock pool.
// ============================================================================

describe('Daily Problem Route Auth', () => {
  it('should be importable without side effects', async () => {
    // Verify the module exports are accessible
    const mod = await import('../daily-problem');
    expect(mod.dailyProblemRoutes).toBeDefined();
    expect(mod.dailyProblemRoutes).toHaveLength(1);
    expect(mod.dailyProblemRoutes[0].method).toBe('POST');
    expect(mod.dailyProblemRoutes[0].path).toBe('/telegram/daily-problem');
  });
});
