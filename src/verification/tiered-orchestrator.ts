/**
 * TieredVerificationOrchestrator
 *
 * Sequential 3-tier verification cascade for GATE math problems:
 *   Tier 1: RAG lookup (pgvector cosine similarity) — $0, <500ms
 *   Tier 2: LLM dual-solve (2 models in parallel) — $0 (free tier), <8s
 *   Tier 3: Wolfram Alpha arbitration — free tier (2000/mo), <15s
 *
 * Short-circuits at first confident result. Every verification gets a
 * trace ID for end-to-end observability.
 *
 *   INPUT ──▶ Tier 1 (RAG) ──▶ Tier 2 (LLM×2) ──▶ Tier 3 (Wolfram)
 *     │           │ hit?            │ agree?            │ arbitrate
 *     │           ▼ YES → return    ▼ YES → return      ▼ return
 *     │                             │ NO → continue      │
 *     │                                                  │
 *     └──────── trace ID threaded through all tiers ─────┘
 */

import { randomUUID } from 'crypto';
import type {
  VerificationCheck,
  VerificationContext,
  VerificationResult,
  VerificationStatus,
  ContentType,
} from './types.js';
import type { VectorStore, VectorSearchResult } from '../data/vector-store.js';
import type { WolframVerifier } from './verifiers/wolfram.js';

// ============================================================================
// Types
// ============================================================================

export interface TieredOrchestratorConfig {
  /** Cosine similarity threshold for RAG hit (0-1). Default 0.85 */
  ragThreshold: number;
  /** Max Wolfram calls per day. Default 50 (self-imposed cap within 2000/mo free) */
  wolframDailyLimit: number;
  /** Timeout per LLM call in ms. Default 10_000 */
  llmTimeoutMs: number;
  /** Timeout for Wolfram call in ms. Default 15_000 */
  wolframTimeoutMs: number;
}

export const DEFAULT_CONFIG: TieredOrchestratorConfig = {
  ragThreshold: 0.85,
  wolframDailyLimit: 50,
  llmTimeoutMs: 10_000,
  wolframTimeoutMs: 15_000,
};

export type TierUsed = 'tier1_rag' | 'tier2_llm' | 'tier3_wolfram';

export interface TieredVerificationResult extends VerificationResult {
  traceId: string;
  tierUsed: TierUsed;
  tierTimings: {
    tier1Ms?: number;
    tier2Ms?: number;
    tier3Ms?: number;
  };
  ragScore?: number;
  llmAgreement?: boolean;
}

/** Minimal interface for LLM dual-solve — keeps orchestrator testable without full LLMClient */
export interface DualSolveLLM {
  solve(problem: string, context?: VerificationContext): Promise<{ answer: string; confidence: number }>;
}

export interface TierSignalEmitter {
  emit(signal: string, data: Record<string, unknown>): void;
}

// ============================================================================
// Orchestrator
// ============================================================================

export class TieredVerificationOrchestrator {
  private wolframCallsToday = 0;
  private wolframResetDate: string = new Date().toISOString().slice(0, 10);

  constructor(
    private vectorStore: VectorStore,
    private embedder: (text: string) => Promise<number[]>,
    private llmA: DualSolveLLM,
    private llmB: DualSolveLLM,
    private wolfram: WolframVerifier,
    private config: TieredOrchestratorConfig = DEFAULT_CONFIG,
    private signals?: TierSignalEmitter,
  ) {}

  /**
   * Verify a student's answer to a math problem.
   *
   * @param problem  - The problem statement
   * @param answer   - The student's answer
   * @param context  - Optional verification context (topic, subject, etc.)
   */
  async verify(
    problem: string,
    answer: string,
    context?: VerificationContext,
  ): Promise<TieredVerificationResult> {
    const traceId = randomUUID();
    const requestedAt = new Date();
    const checks: VerificationCheck[] = [];
    const tierTimings: TieredVerificationResult['tierTimings'] = {};

    const baseResult = {
      contentId: traceId,
      contentType: 'math_solution' as ContentType,
      originalContent: `${problem} → ${answer}`,
      traceId,
      tierTimings,
    };

    // ── Tier 1: RAG Lookup ───────────────────────────────────────────────
    const t1Start = Date.now();
    const ragResult = await this.tier1RAG(problem, answer);
    tierTimings.tier1Ms = Date.now() - t1Start;

    if (ragResult) {
      checks.push(ragResult.check);
      this.emitSignal('tier_1_hit', { traceId, score: ragResult.score });

      return this.buildResult({
        ...baseResult,
        checks,
        requestedAt,
        tierUsed: 'tier1_rag',
        status: ragResult.check.status,
        confidence: ragResult.check.confidence,
        ragScore: ragResult.score,
      });
    }

    // ── Tier 2: LLM Dual-Solve ──────────────────────────────────────────
    const t2Start = Date.now();
    const llmResult = await this.tier2LLMDualSolve(problem, answer, context);
    tierTimings.tier2Ms = Date.now() - t2Start;

    if (llmResult.agreed) {
      checks.push(...llmResult.checks);
      this.emitSignal('tier_2_agree', { traceId, matchesStudent: llmResult.matchesStudent });

      // Write back to RAG cache for future lookups
      await this.writeToRAGCache(problem, answer, llmResult.checks[0]);

      return this.buildResult({
        ...baseResult,
        checks,
        requestedAt,
        tierUsed: 'tier2_llm',
        status: llmResult.matchesStudent ? 'verified' : 'failed',
        confidence: llmResult.avgConfidence,
        llmAgreement: true,
      });
    }

    checks.push(...llmResult.checks);
    this.emitSignal('tier_2_disagree', { traceId });

    // ── Tier 3: Wolfram Arbitration ──────────────────────────────────────
    if (!this.canCallWolfram()) {
      this.emitSignal('wolfram.rate_limited', { traceId, callsToday: this.wolframCallsToday });

      // Fallback: use the more confident LLM answer
      const bestCheck = llmResult.checks.reduce((a, b) => a.confidence > b.confidence ? a : b);
      return this.buildResult({
        ...baseResult,
        checks,
        requestedAt,
        tierUsed: 'tier2_llm',
        status: bestCheck.status,
        confidence: bestCheck.confidence * 0.8, // Penalize confidence when LLMs disagreed
        llmAgreement: false,
      });
    }

    const t3Start = Date.now();
    const wolframCheck = await this.tier3Wolfram(problem, answer, context);
    tierTimings.tier3Ms = Date.now() - t3Start;
    checks.push(wolframCheck);

    this.emitSignal('wolfram.called', { traceId, durationMs: tierTimings.tier3Ms });

    // Write Wolfram-verified result to RAG cache
    if (wolframCheck.status === 'verified' || wolframCheck.status === 'failed') {
      await this.writeToRAGCache(problem, answer, wolframCheck);
    }

    return this.buildResult({
      ...baseResult,
      checks,
      requestedAt,
      tierUsed: 'tier3_wolfram',
      status: wolframCheck.status,
      confidence: wolframCheck.confidence,
      llmAgreement: false,
    });
  }

  /** Reset the daily Wolfram counter. Called by cron at midnight. */
  resetWolframCounter(): void {
    this.wolframCallsToday = 0;
    this.wolframResetDate = new Date().toISOString().slice(0, 10);
  }

  /** Current Wolfram usage stats for observability */
  getWolframUsage(): { callsToday: number; limit: number; resetDate: string } {
    return {
      callsToday: this.wolframCallsToday,
      limit: this.config.wolframDailyLimit,
      resetDate: this.wolframResetDate,
    };
  }

  // ============================================================================
  // Tier Implementations
  // ============================================================================

  private async tier1RAG(
    problem: string,
    answer: string,
  ): Promise<{ check: VerificationCheck; score: number } | null> {
    try {
      const queryText = `${problem} answer: ${answer}`;
      const embedding = await this.embedder(queryText);

      const results = await this.vectorStore.search({
        vector: embedding,
        limit: 1,
        threshold: this.config.ragThreshold,
        filter: { type: 'question' },
      });

      if (results.length === 0) return null;

      const match = results[0];
      const cachedStatus = this.extractCachedStatus(match);
      if (!cachedStatus) return null;

      return {
        score: match.score,
        check: {
          verifier: 'database',
          status: cachedStatus.status,
          confidence: match.score * cachedStatus.confidence,
          details: `RAG cache hit (score: ${match.score.toFixed(3)}). Cached verdict: ${cachedStatus.status}`,
          timestamp: new Date(),
          durationMs: 0, // Set by caller
        },
      };
    } catch (error) {
      // RAG failure is non-fatal — fall through to Tier 2
      this.emitSignal('tier_1_error', {
        error: error instanceof Error ? error.message : 'Unknown RAG error',
      });
      return null;
    }
  }

  private async tier2LLMDualSolve(
    problem: string,
    answer: string,
    context?: VerificationContext,
  ): Promise<{
    agreed: boolean;
    matchesStudent: boolean;
    checks: VerificationCheck[];
    avgConfidence: number;
  }> {
    const solveContext: VerificationContext = {
      ...context,
      expectedAnswer: answer,
      sourceContent: problem,
    };

    // Run both LLMs in parallel with timeout
    const [resultA, resultB] = await Promise.all([
      this.safeSolve(this.llmA, problem, solveContext, 'LLM-A'),
      this.safeSolve(this.llmB, problem, solveContext, 'LLM-B'),
    ]);

    const checks: VerificationCheck[] = [
      this.llmSolveToCheck(resultA, 'LLM-A'),
      this.llmSolveToCheck(resultB, 'LLM-B'),
    ];

    // Compare: do both LLMs agree on the answer?
    const aMatchesStudent = this.answersMatch(resultA.answer, answer);
    const bMatchesStudent = this.answersMatch(resultB.answer, answer);
    const llmsAgree = this.answersMatch(resultA.answer, resultB.answer);

    const avgConfidence = (resultA.confidence + resultB.confidence) / 2;

    return {
      agreed: llmsAgree,
      matchesStudent: llmsAgree && aMatchesStudent,
      checks,
      avgConfidence,
    };
  }

  private async tier3Wolfram(
    problem: string,
    answer: string,
    context?: VerificationContext,
  ): Promise<VerificationCheck> {
    this.wolframCallsToday++;

    // Auto-reset if the date has changed
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.wolframResetDate) {
      this.wolframCallsToday = 1;
      this.wolframResetDate = today;
    }

    try {
      const check = await this.wolfram.verify(
        problem,
        'math_solution',
        { ...context, expectedAnswer: answer, sourceContent: problem },
      );
      return check;
    } catch (error) {
      return {
        verifier: 'wolfram',
        status: 'inconclusive',
        confidence: 0,
        details: `Wolfram error: ${error instanceof Error ? error.message : 'Unknown'}`,
        timestamp: new Date(),
        durationMs: 0,
      };
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private async safeSolve(
    llm: DualSolveLLM,
    problem: string,
    context: VerificationContext,
    label: string,
  ): Promise<{ answer: string; confidence: number }> {
    try {
      const result = await Promise.race([
        llm.solve(problem, context),
        this.timeout(this.config.llmTimeoutMs, label),
      ]);
      return result;
    } catch (error) {
      this.emitSignal('tier_2_error', {
        label,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return { answer: '', confidence: 0 };
    }
  }

  private timeout(ms: number, label: string): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    );
  }

  private llmSolveToCheck(
    result: { answer: string; confidence: number },
    label: string,
  ): VerificationCheck {
    const hasAnswer = result.answer.length > 0;
    return {
      verifier: 'llm_consensus',
      status: hasAnswer ? (result.confidence >= 0.7 ? 'verified' : 'partial') : 'inconclusive',
      confidence: result.confidence,
      details: hasAnswer ? `${label} solved: ${result.answer}` : `${label} failed to solve`,
      timestamp: new Date(),
      durationMs: 0,
    };
  }

  private answersMatch(a: string, b: string): boolean {
    if (!a || !b) return false;

    const normalize = (s: string) =>
      s.toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[()[\]{}]/g, '')
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-');

    const normA = normalize(a);
    const normB = normalize(b);

    if (normA === normB) return true;

    // Numeric comparison with tolerance
    const numA = parseFloat(normA);
    const numB = parseFloat(normB);
    if (!isNaN(numA) && !isNaN(numB)) {
      return Math.abs(numA - numB) < 0.0001;
    }

    // Substring containment for complex expressions
    return normA.includes(normB) || normB.includes(normA);
  }

  private extractCachedStatus(
    match: VectorSearchResult,
  ): { status: VerificationStatus; confidence: number } | null {
    const meta = match.metadata as Record<string, unknown>;
    const status = meta['verificationStatus'] as VerificationStatus | undefined;
    const confidence = meta['verificationConfidence'] as number | undefined;

    if (!status || confidence === undefined) return null;
    return { status, confidence };
  }

  private async writeToRAGCache(
    problem: string,
    answer: string,
    check: VerificationCheck,
  ): Promise<void> {
    try {
      const text = `${problem} answer: ${answer}`;
      const embedding = await this.embedder(text);
      const id = randomUUID();

      await this.vectorStore.upsert([
        {
          id,
          embedding,
          metadata: {
            type: 'question',
            entityId: id,
            subject: 'mathematics',
            exam: 'GATE',
            createdAt: Date.now(),
            verificationStatus: check.status,
            verificationConfidence: check.confidence,
            verifier: check.verifier,
            answer,
          },
          content: text,
        },
      ]);
    } catch (error) {
      // Cache write failure is non-fatal
      this.emitSignal('rag_cache_write_error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  private canCallWolfram(): boolean {
    // Auto-reset if date changed
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.wolframResetDate) {
      this.wolframCallsToday = 0;
      this.wolframResetDate = today;
    }
    return this.wolframCallsToday < this.config.wolframDailyLimit;
  }

  private emitSignal(signal: string, data: Record<string, unknown>): void {
    this.signals?.emit(signal, data);
  }

  private buildResult(params: {
    contentId: string;
    contentType: ContentType;
    originalContent: string;
    traceId: string;
    tierTimings: TieredVerificationResult['tierTimings'];
    checks: VerificationCheck[];
    requestedAt: Date;
    tierUsed: TierUsed;
    status: VerificationStatus;
    confidence: number;
    ragScore?: number;
    llmAgreement?: boolean;
  }): TieredVerificationResult {
    const completedAt = new Date();
    return {
      contentId: params.contentId,
      contentType: params.contentType,
      originalContent: params.originalContent,
      overallStatus: params.status,
      overallConfidence: params.confidence,
      checks: params.checks,
      metadata: {
        requestedAt: params.requestedAt,
        completedAt,
        totalDurationMs: completedAt.getTime() - params.requestedAt.getTime(),
        verifiersUsed: params.checks.map(c => c.verifier),
      },
      traceId: params.traceId,
      tierUsed: params.tierUsed,
      tierTimings: params.tierTimings,
      ragScore: params.ragScore,
      llmAgreement: params.llmAgreement,
    };
  }
}
