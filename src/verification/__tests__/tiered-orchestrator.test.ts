import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TieredVerificationOrchestrator,
  type DualSolveLLM,
  type TierSignalEmitter,
  DEFAULT_CONFIG,
} from '../tiered-orchestrator.js';
import { InMemoryVectorStore } from '../../data/vector-store.js';
import type { WolframVerifier } from '../verifiers/wolfram.js';
import type { VerificationCheck } from '../types.js';

// ============================================================================
// Test Helpers
// ============================================================================

function makeLLM(answer: string, confidence = 0.9): DualSolveLLM {
  return {
    solve: vi.fn().mockResolvedValue({ answer, confidence }),
  };
}

function makeWolfram(status: 'verified' | 'failed' | 'inconclusive' = 'verified'): WolframVerifier {
  return {
    id: 'wolfram',
    name: 'Wolfram Alpha',
    supportedContentTypes: ['math_solution'],
    initialize: vi.fn(),
    checkHealth: vi.fn().mockResolvedValue(true),
    verify: vi.fn().mockResolvedValue({
      verifier: 'wolfram',
      status,
      confidence: status === 'verified' ? 0.95 : 0.1,
      details: `Wolfram says: ${status}`,
      timestamp: new Date(),
      durationMs: 100,
    } satisfies VerificationCheck),
    getSuggestion: vi.fn().mockResolvedValue(null),
  } as unknown as WolframVerifier;
}

function makeEmbedder(): (text: string) => Promise<number[]> {
  // Deterministic mock: hash the text to a 10-dim vector
  return vi.fn().mockImplementation(async (text: string) => {
    const hash = [...text].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    return Array.from({ length: 10 }, (_, i) => Math.sin(hash + i));
  });
}

function makeSignals(): TierSignalEmitter & { calls: Array<{ signal: string; data: Record<string, unknown> }> } {
  const calls: Array<{ signal: string; data: Record<string, unknown> }> = [];
  return {
    calls,
    emit(signal: string, data: Record<string, unknown>) {
      calls.push({ signal, data });
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('TieredVerificationOrchestrator', () => {
  let store: InMemoryVectorStore;
  let embedder: ReturnType<typeof makeEmbedder>;
  let signals: ReturnType<typeof makeSignals>;

  beforeEach(() => {
    store = new InMemoryVectorStore();
    embedder = makeEmbedder();
    signals = makeSignals();
  });

  // ── Tier 1 RAG ──────────────────────────────────────────────────────────

  describe('Tier 1: RAG Lookup', () => {
    it('returns immediately on RAG cache hit above threshold', async () => {
      // Seed the vector store with a cached result
      const embedding = await embedder('What is 2+2? answer: 4');
      await store.upsert([{
        id: 'cached-1',
        embedding,
        metadata: {
          type: 'question',
          entityId: 'cached-1',
          createdAt: Date.now(),
          verificationStatus: 'verified',
          verificationConfidence: 0.95,
          verifier: 'wolfram',
          answer: '4',
        },
        content: 'What is 2+2? answer: 4',
      }]);

      const llmA = makeLLM('4');
      const llmB = makeLLM('4');
      const wolfram = makeWolfram();

      const orch = new TieredVerificationOrchestrator(
        store, embedder, llmA, llmB, wolfram,
        { ...DEFAULT_CONFIG, ragThreshold: 0.5 }, // Low threshold to ensure hit
        signals,
      );

      const result = await orch.verify('What is 2+2?', '4');

      expect(result.tierUsed).toBe('tier1_rag');
      expect(result.overallStatus).toBe('verified');
      expect(result.traceId).toBeTruthy();
      expect(result.tierTimings.tier1Ms).toBeDefined();
      expect(result.tierTimings.tier2Ms).toBeUndefined();
      // LLMs should NOT have been called
      expect(llmA.solve).not.toHaveBeenCalled();
      expect(llmB.solve).not.toHaveBeenCalled();
    });

    it('falls through to Tier 2 when no RAG match', async () => {
      const llmA = makeLLM('42');
      const llmB = makeLLM('42');
      const wolfram = makeWolfram();

      const orch = new TieredVerificationOrchestrator(
        store, embedder, llmA, llmB, wolfram,
        DEFAULT_CONFIG,
        signals,
      );

      const result = await orch.verify('What is 6*7?', '42');

      expect(result.tierUsed).toBe('tier2_llm');
      expect(llmA.solve).toHaveBeenCalledOnce();
      expect(llmB.solve).toHaveBeenCalledOnce();
    });
  });

  // ── Tier 2 LLM Dual-Solve ─────────────────────────────────────────────

  describe('Tier 2: LLM Dual-Solve', () => {
    it('returns verified when both LLMs agree with student', async () => {
      const llmA = makeLLM('42');
      const llmB = makeLLM('42');
      const wolfram = makeWolfram();

      const orch = new TieredVerificationOrchestrator(
        store, embedder, llmA, llmB, wolfram,
        DEFAULT_CONFIG,
        signals,
      );

      const result = await orch.verify('What is 6*7?', '42');

      expect(result.tierUsed).toBe('tier2_llm');
      expect(result.overallStatus).toBe('verified');
      expect(result.llmAgreement).toBe(true);
      expect(wolfram.verify).not.toHaveBeenCalled();
    });

    it('returns failed when both LLMs agree but differ from student', async () => {
      const llmA = makeLLM('43');
      const llmB = makeLLM('43');
      const wolfram = makeWolfram();

      const orch = new TieredVerificationOrchestrator(
        store, embedder, llmA, llmB, wolfram,
        DEFAULT_CONFIG,
        signals,
      );

      const result = await orch.verify('What is 6*7?', '42');

      expect(result.tierUsed).toBe('tier2_llm');
      expect(result.overallStatus).toBe('failed');
      expect(result.llmAgreement).toBe(true);
    });

    it('escalates to Tier 3 when LLMs disagree', async () => {
      const llmA = makeLLM('42');
      const llmB = makeLLM('43');
      const wolfram = makeWolfram('verified');

      const orch = new TieredVerificationOrchestrator(
        store, embedder, llmA, llmB, wolfram,
        DEFAULT_CONFIG,
        signals,
      );

      const result = await orch.verify('What is 6*7?', '42');

      expect(result.tierUsed).toBe('tier3_wolfram');
      expect(wolfram.verify).toHaveBeenCalledOnce();
    });

    it('writes back to RAG cache on Tier 2 agreement', async () => {
      const llmA = makeLLM('42');
      const llmB = makeLLM('42');
      const wolfram = makeWolfram();

      const orch = new TieredVerificationOrchestrator(
        store, embedder, llmA, llmB, wolfram,
        DEFAULT_CONFIG,
        signals,
      );

      await orch.verify('What is 6*7?', '42');

      // Vector store should now have the cached result
      const count = await store.count();
      expect(count).toBe(1);
    });

    it('handles LLM timeout gracefully', async () => {
      const llmA: DualSolveLLM = {
        solve: vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 20_000))),
      };
      const llmB = makeLLM('42');
      const wolfram = makeWolfram('verified');

      const orch = new TieredVerificationOrchestrator(
        store, embedder, llmA, llmB, wolfram,
        { ...DEFAULT_CONFIG, llmTimeoutMs: 50 }, // Very short timeout
        signals,
      );

      const result = await orch.verify('What is 6*7?', '42');

      // Should not hang — LLM A times out, LLMs disagree (A empty, B "42"), escalate to Wolfram
      expect(result.tierUsed).toBe('tier3_wolfram');
    });
  });

  // ── Tier 3 Wolfram ──────────────────────────────────────────────────────

  describe('Tier 3: Wolfram Arbitration', () => {
    it('respects daily Wolfram limit', async () => {
      const llmA = makeLLM('42');
      const llmB = makeLLM('43'); // Disagree → need Wolfram
      const wolfram = makeWolfram('verified');

      const orch = new TieredVerificationOrchestrator(
        store, embedder, llmA, llmB, wolfram,
        { ...DEFAULT_CONFIG, wolframDailyLimit: 0 }, // Already at limit
        signals,
      );

      const result = await orch.verify('What is 6*7?', '42');

      // Should NOT call Wolfram — fall back to best LLM
      expect(result.tierUsed).toBe('tier2_llm');
      expect(wolfram.verify).not.toHaveBeenCalled();
      expect(result.llmAgreement).toBe(false);

      const rateLimitSignal = signals.calls.find(c => c.signal === 'wolfram.rate_limited');
      expect(rateLimitSignal).toBeTruthy();
    });

    it('writes Wolfram result to RAG cache', async () => {
      const llmA = makeLLM('42');
      const llmB = makeLLM('43');
      const wolfram = makeWolfram('verified');

      const orch = new TieredVerificationOrchestrator(
        store, embedder, llmA, llmB, wolfram,
        DEFAULT_CONFIG,
        signals,
      );

      await orch.verify('What is 6*7?', '42');

      const count = await store.count();
      expect(count).toBe(1);
    });
  });

  // ── Observability ──────────────────────────────────────────────────────

  describe('Observability', () => {
    it('includes trace ID in every result', async () => {
      const llmA = makeLLM('42');
      const llmB = makeLLM('42');
      const wolfram = makeWolfram();

      const orch = new TieredVerificationOrchestrator(
        store, embedder, llmA, llmB, wolfram,
        DEFAULT_CONFIG,
        signals,
      );

      const result = await orch.verify('What is 6*7?', '42');

      expect(result.traceId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('emits signals for each tier', async () => {
      const llmA = makeLLM('42');
      const llmB = makeLLM('43'); // Disagree
      const wolfram = makeWolfram('verified');

      const orch = new TieredVerificationOrchestrator(
        store, embedder, llmA, llmB, wolfram,
        DEFAULT_CONFIG,
        signals,
      );

      await orch.verify('What is 6*7?', '42');

      const signalTypes = signals.calls.map(c => c.signal);
      expect(signalTypes).toContain('tier_2_disagree');
      expect(signalTypes).toContain('wolfram.called');
    });

    it('reports Wolfram usage stats', async () => {
      const llmA = makeLLM('42');
      const llmB = makeLLM('43');
      const wolfram = makeWolfram('verified');

      const orch = new TieredVerificationOrchestrator(
        store, embedder, llmA, llmB, wolfram,
        DEFAULT_CONFIG,
        signals,
      );

      const before = orch.getWolframUsage();
      expect(before.callsToday).toBe(0);

      await orch.verify('What is 6*7?', '42');

      const after = orch.getWolframUsage();
      expect(after.callsToday).toBe(1);
    });

    it('resets Wolfram counter', async () => {
      const llmA = makeLLM('42');
      const llmB = makeLLM('43');
      const wolfram = makeWolfram('verified');

      const orch = new TieredVerificationOrchestrator(
        store, embedder, llmA, llmB, wolfram,
        DEFAULT_CONFIG,
        signals,
      );

      await orch.verify('What is 6*7?', '42');
      expect(orch.getWolframUsage().callsToday).toBe(1);

      orch.resetWolframCounter();
      expect(orch.getWolframUsage().callsToday).toBe(0);
    });
  });

  // ── Answer Matching ────────────────────────────────────────────────────

  describe('Answer Matching', () => {
    it('matches numeric answers with float tolerance', async () => {
      const llmA = makeLLM('3.14159');
      const llmB = makeLLM('3.14159');
      const wolfram = makeWolfram();

      const orch = new TieredVerificationOrchestrator(
        store, embedder, llmA, llmB, wolfram,
        DEFAULT_CONFIG,
        signals,
      );

      // Student answer slightly different
      const result = await orch.verify('What is pi to 5 decimals?', '3.14159');

      expect(result.overallStatus).toBe('verified');
      expect(result.tierUsed).toBe('tier2_llm');
    });

    it('matches answers with different whitespace/parens', async () => {
      const llmA = makeLLM('( x + 1 )');
      const llmB = makeLLM('(x+1)');
      const wolfram = makeWolfram();

      const orch = new TieredVerificationOrchestrator(
        store, embedder, llmA, llmB, wolfram,
        DEFAULT_CONFIG,
        signals,
      );

      const result = await orch.verify('Factor x^2 + 2x + 1', '(x+1)');

      expect(result.tierUsed).toBe('tier2_llm');
      expect(result.llmAgreement).toBe(true);
    });
  });
});
