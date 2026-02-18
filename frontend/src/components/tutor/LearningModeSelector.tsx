/**
 * Learning Mode Selector Component
 * Allows students to switch between different learning modes
 * and shows the appropriate response format
 */

import { useState } from 'react';
import type { LearningMode } from '@/types/personalization';

interface LearningModeSelectorProps {
  currentMode: LearningMode;
  onModeChange: (mode: LearningMode) => void;
  daysToExam?: number;
  compact?: boolean;
}

const modeConfig: Record<LearningMode, {
  icon: string;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  bgColor: string;
}> = {
  deep_learning: {
    icon: '📚',
    label: 'Deep Learning',
    shortLabel: 'Learn',
    description: 'Full explanations with intuition, derivations, and examples',
    color: 'text-blue-400',
    bgColor: 'bg-blue-600',
  },
  exam_prep: {
    icon: '⚡',
    label: 'Exam Prep',
    shortLabel: 'Exam',
    description: 'Quick tips, shortcuts, and time-saving tricks',
    color: 'text-orange-400',
    bgColor: 'bg-orange-600',
  },
  revision: {
    icon: '🔄',
    label: 'Revision',
    shortLabel: 'Revise',
    description: 'Key points, formulas, and memory aids',
    color: 'text-purple-400',
    bgColor: 'bg-purple-600',
  },
  practice: {
    icon: '✏️',
    label: 'Practice',
    shortLabel: 'Practice',
    description: 'Step-by-step problem solving',
    color: 'text-green-400',
    bgColor: 'bg-green-600',
  },
  doubt_clearing: {
    icon: '❓',
    label: 'Clear Doubts',
    shortLabel: 'Doubts',
    description: 'Patient explanations for confusion points',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-600',
  },
  quick_reference: {
    icon: '📐',
    label: 'Quick Ref',
    shortLabel: 'Formula',
    description: 'Just the formula or definition',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-600',
  },
};

export function LearningModeSelector({
  currentMode,
  onModeChange,
  daysToExam,
  compact = false,
}: LearningModeSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const currentModeConfig = modeConfig[currentMode];

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg ${currentModeConfig.bgColor} text-white transition-all hover:opacity-90`}
        >
          <span>{currentModeConfig.icon}</span>
          <span className="text-sm font-medium">{currentModeConfig.shortLabel}</span>
          <span className="text-xs opacity-75">▼</span>
        </button>

        {isExpanded && (
          <div className="absolute top-full left-0 mt-2 w-64 bg-surface-800 border border-surface-700 rounded-xl shadow-xl z-50">
            {(Object.keys(modeConfig) as LearningMode[]).map((mode) => {
              const config = modeConfig[mode];
              const isActive = mode === currentMode;
              return (
                <button
                  key={mode}
                  onClick={() => {
                    onModeChange(mode);
                    setIsExpanded(false);
                  }}
                  className={`w-full flex items-center gap-3 p-3 text-left hover:bg-surface-700 transition-colors first:rounded-t-xl last:rounded-b-xl ${
                    isActive ? 'bg-surface-700' : ''
                  }`}
                >
                  <span className="text-xl">{config.icon}</span>
                  <div className="flex-1">
                    <p className={`font-medium ${isActive ? config.color : 'text-white'}`}>
                      {config.label}
                    </p>
                    <p className="text-xs text-surface-400">{config.description}</p>
                  </div>
                  {isActive && <span className="text-green-400">✓</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Click outside to close */}
        {isExpanded && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsExpanded(false)}
          />
        )}
      </div>
    );
  }

  // Full mode selector
  return (
    <div className="space-y-4">
      {/* Exam proximity warning */}
      {daysToExam !== undefined && daysToExam <= 7 && (
        <div className="p-3 bg-orange-900/30 border border-orange-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-orange-400">
            <span>⚡</span>
            <span className="font-medium">Exam in {daysToExam} days!</span>
          </div>
          <p className="text-sm text-surface-300 mt-1">
            Consider switching to <strong>Exam Prep</strong> mode for quick, focused answers.
          </p>
        </div>
      )}

      {/* Mode cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {(Object.keys(modeConfig) as LearningMode[]).map((mode) => {
          const config = modeConfig[mode];
          const isActive = mode === currentMode;
          return (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                isActive
                  ? `${config.bgColor} border-transparent`
                  : 'bg-surface-800 border-surface-700 hover:border-surface-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{config.icon}</span>
                <span className={`font-semibold ${isActive ? 'text-white' : config.color}`}>
                  {config.label}
                </span>
              </div>
              <p className={`text-sm ${isActive ? 'text-white/80' : 'text-surface-400'}`}>
                {config.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Current mode explanation */}
      <div className={`p-4 rounded-xl ${currentModeConfig.bgColor}/20 border border-${currentModeConfig.color.replace('text-', '')}/30`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{currentModeConfig.icon}</span>
          <span className={`font-semibold ${currentModeConfig.color}`}>
            {currentModeConfig.label} Mode Active
          </span>
        </div>
        <p className="text-surface-200 text-sm">
          {getModeDetailedDescription(currentMode)}
        </p>
      </div>
    </div>
  );
}

function getModeDetailedDescription(mode: LearningMode): string {
  const descriptions: Record<LearningMode, string> = {
    deep_learning: 
      'I\'ll explain concepts thoroughly with intuition, derivations, examples, and visualizations. ' +
      'Perfect for building strong fundamentals and understanding the "why" behind concepts.',
    exam_prep:
      'I\'ll give you quick, focused answers with shortcuts, exam tips, and common mistakes to avoid. ' +
      'Every second counts — no fluff, just what you need to score.',
    revision:
      'I\'ll help you refresh your memory with key points, important formulas, and memory aids. ' +
      'Great for consolidating what you\'ve already learned.',
    practice:
      'I\'ll focus on solving problems step-by-step and teaching you the approach. ' +
      'You\'ll learn patterns and build problem-solving skills.',
    doubt_clearing:
      'I\'ll patiently address your specific confusion with clear explanations and analogies. ' +
      'No question is too basic — let\'s clear every doubt.',
    quick_reference:
      'I\'ll give you just the formula or definition you need, nothing more. ' +
      'Perfect when you just need a quick lookup.',
  };
  return descriptions[mode];
}

// Response format preview
export function ResponseFormatPreview({ mode }: { mode: LearningMode }) {
  const formats: Record<LearningMode, React.ReactNode> = {
    deep_learning: (
      <div className="space-y-2 text-sm">
        <div className="p-2 bg-blue-900/30 rounded">📚 <strong>Concept</strong> — Full explanation with intuition</div>
        <div className="p-2 bg-blue-900/20 rounded">📝 <strong>Derivation</strong> — Step-by-step proof</div>
        <div className="p-2 bg-blue-900/20 rounded">✏️ <strong>Examples</strong> — 2-3 worked problems</div>
        <div className="p-2 bg-blue-900/20 rounded">📊 <strong>Visualization</strong> — Interactive resource</div>
        <div className="p-2 bg-blue-900/20 rounded">🔗 <strong>Connections</strong> — Related topics</div>
      </div>
    ),
    exam_prep: (
      <div className="space-y-2 text-sm">
        <div className="p-2 bg-orange-900/30 rounded">⚡ <strong>Quick Answer</strong> — Direct formula/result</div>
        <div className="p-2 bg-orange-900/20 rounded">🚀 <strong>Shortcut</strong> — Time-saving trick</div>
        <div className="p-2 bg-orange-900/20 rounded">⚠️ <strong>Watch Out</strong> — Common mistakes</div>
        <div className="p-2 bg-orange-900/20 rounded">⏱️ <strong>Time</strong> — How long in exam</div>
        <div className="p-2 bg-orange-900/20 rounded">📖 <strong>PYQ Pattern</strong> — Previous year reference</div>
      </div>
    ),
    revision: (
      <div className="space-y-2 text-sm">
        <div className="p-2 bg-purple-900/30 rounded">📝 <strong>Summary</strong> — Key points</div>
        <div className="p-2 bg-purple-900/20 rounded">📐 <strong>Formulas</strong> — Important equations</div>
        <div className="p-2 bg-purple-900/20 rounded">🧠 <strong>Memory Aid</strong> — Mnemonics</div>
        <div className="p-2 bg-purple-900/20 rounded">❓ <strong>Quick Quiz</strong> — Self-test</div>
      </div>
    ),
    practice: (
      <div className="space-y-2 text-sm">
        <div className="p-2 bg-green-900/30 rounded">🎯 <strong>Approach</strong> — How to think</div>
        <div className="p-2 bg-green-900/20 rounded">📝 <strong>Solution</strong> — Step-by-step</div>
        <div className="p-2 bg-green-900/20 rounded">✅ <strong>Verify</strong> — Check your answer</div>
        <div className="p-2 bg-green-900/20 rounded">🔄 <strong>Similar</strong> — More problems</div>
      </div>
    ),
    doubt_clearing: (
      <div className="space-y-2 text-sm">
        <div className="p-2 bg-yellow-900/30 rounded">💡 <strong>Clarification</strong> — Clear explanation</div>
        <div className="p-2 bg-yellow-900/20 rounded">🤔 <strong>Confusion Points</strong> — Why it's tricky</div>
        <div className="p-2 bg-yellow-900/20 rounded">🔗 <strong>Analogy</strong> — Simple comparison</div>
        <div className="p-2 bg-yellow-900/20 rounded">✏️ <strong>Examples</strong> — Clarifying cases</div>
      </div>
    ),
    quick_reference: (
      <div className="space-y-2 text-sm">
        <div className="p-2 bg-cyan-900/30 rounded">📐 <strong>Formula</strong> — The equation</div>
        <div className="p-2 bg-cyan-900/20 rounded">🔤 <strong>Variables</strong> — What each means</div>
        <div className="p-2 bg-cyan-900/20 rounded">📏 <strong>Units</strong> — SI units</div>
      </div>
    ),
  };

  return (
    <div>
      <p className="text-xs text-surface-500 mb-2">Response will include:</p>
      {formats[mode]}
    </div>
  );
}

export default LearningModeSelector;
