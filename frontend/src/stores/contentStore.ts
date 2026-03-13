/**
 * contentStore.ts — Zustand store for content automation state
 *
 * React-friendly mirror of the contentAutomationService singleton.
 * Persisted to localStorage under 'edugenius-content-store'.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  AutomationStatus,
  AutomationConfig,
  AutomationRun,
} from '@/services/contentAutomationService';
import type { GeneratedContent } from '@/services/contentGenerationService';
import type { SubTopicBible } from '@/services/subTopicBibleService';

// ─── Default config (duplicated here to avoid circular deps at init time) ─────

const DEFAULT_CONFIG: AutomationConfig = {
  enabled: false,
  triggerMode: 'manual',
  intervalMinutes: 60,
  targetExams: [],          // populated lazily from examRegistry on first use
  targetFormats: ['mcq_set'],
  itemsPerBatch: 5,
  countPerTopic: 10,
  prioritizeCompetitorGaps: true,
  prioritizeStaleContent: true,
  stalenessThresholdDays: 7,
  autoPublish: true,
};

// ─── Store interface ──────────────────────────────────────────────────────────

interface ContentStoreState {
  // Automation state (mirrored from singleton for React reactivity)
  automationEnabled: boolean;
  automationStatus: AutomationStatus;
  currentRun: AutomationRun | undefined;
  runHistory: AutomationRun[];
  generatedContent: GeneratedContent[];
  totalGenerated: number;
  totalVerified: number;
  config: AutomationConfig;

  // Bible state
  activeBible: SubTopicBible | null;
  bibleHealthSummary: { total: number; healthy: number; needsAttention: number };

  // Actions
  setAutomationEnabled: (enabled: boolean) => void;
  updateConfig: (patch: Partial<AutomationConfig>) => void;
  addGeneratedContent: (item: GeneratedContent) => void;
  addGeneratedContentBulk: (items: GeneratedContent[]) => void;
  setCurrentRun: (run: AutomationRun | undefined) => void;
  setAutomationStatus: (status: AutomationStatus) => void;
  addRunToHistory: (run: AutomationRun) => void;
  incrementTotals: (generated: number, verified: number) => void;
  setActiveBible: (bible: SubTopicBible | null) => void;
  refreshBibleHealth: () => void;
  reset: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useContentStore = create<ContentStoreState>()(
  persist(
    (set) => ({
      // Initial state
      automationEnabled: false,
      automationStatus: 'idle' as AutomationStatus,
      currentRun: undefined,
      runHistory: [],
      generatedContent: [],
      totalGenerated: 0,
      totalVerified: 0,
      config: DEFAULT_CONFIG,
      activeBible: null,
      bibleHealthSummary: { total: 0, healthy: 0, needsAttention: 0 },

      // ── Actions ──────────────────────────────────────────────────────────

      setAutomationEnabled: (enabled) =>
        set((s) => ({
          automationEnabled: enabled,
          config: { ...s.config, enabled },
        })),

      updateConfig: (patch) =>
        set((s) => ({
          config: { ...s.config, ...patch },
          // Keep automationEnabled in sync with config.enabled
          automationEnabled: patch.enabled !== undefined ? patch.enabled : s.automationEnabled,
        })),

      addGeneratedContent: (item) =>
        set((s) => {
          // Cap at 500 items — drop oldest (end of array)
          const updated = [item, ...s.generatedContent].slice(0, 500);
          return { generatedContent: updated };
        }),

      addGeneratedContentBulk: (items) =>
        set((s) => {
          const updated = [...items, ...s.generatedContent].slice(0, 500);
          return { generatedContent: updated };
        }),

      setCurrentRun: (run) => set({ currentRun: run }),

      setAutomationStatus: (status) => set({ automationStatus: status }),

      addRunToHistory: (run) =>
        set((s) => {
          // Cap at 20 runs
          const updated = [run, ...s.runHistory].slice(0, 20);
          return { runHistory: updated };
        }),

      incrementTotals: (generated, verified) =>
        set((s) => ({
          totalGenerated: s.totalGenerated + generated,
          totalVerified: s.totalVerified + verified,
        })),

      setActiveBible: (bible) => set({ activeBible: bible }),

      refreshBibleHealth: () => {
        try {
          const { getBibleHealthSummary } = require('@/services/bibleProgressiveUpdater') as typeof import('@/services/bibleProgressiveUpdater');
          set({ bibleHealthSummary: getBibleHealthSummary() });
        } catch { /* non-fatal */ }
      },

      reset: () =>
        set({
          automationEnabled: false,
          automationStatus: 'idle',
          currentRun: undefined,
          runHistory: [],
          generatedContent: [],
          totalGenerated: 0,
          totalVerified: 0,
          config: DEFAULT_CONFIG,
          activeBible: null,
          bibleHealthSummary: { total: 0, healthy: 0, needsAttention: 0 },
        }),
    }),
    {
      name: 'edugenius-content-store',
      storage: createJSONStorage(() => localStorage),
      // Only persist the data fields, not function references
      partialize: (state) => ({
        automationEnabled: state.automationEnabled,
        automationStatus: state.automationStatus,
        currentRun: state.currentRun,
        runHistory: state.runHistory,
        generatedContent: state.generatedContent,
        totalGenerated: state.totalGenerated,
        totalVerified: state.totalVerified,
        config: state.config,
      }),
    },
  ),
);
