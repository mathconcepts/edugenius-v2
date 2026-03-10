/**
 * Exam Tips Panel Component
 * Shows contextual exam tips, shortcuts, and patterns
 *
 * AUDIT NOTE: No active importer found — kept intentionally as a utility component.
 * // DEBT: wire into ExamInsights.tsx or Chat.tsx sidebar when ready
 */

import { useState } from 'react';
import type { ExamTip } from '@/types/personalization';

interface ExamTipsPanelProps {
  tips: ExamTip[];
  topic?: string;
  examType?: string;
  compact?: boolean;
}

const tipTypeConfig: Record<ExamTip['type'], {
  icon: string;
  label: string;
  color: string;
}> = {
  shortcut: { icon: '🚀', label: 'Shortcut', color: 'text-green-400' },
  pattern: { icon: '🎯', label: 'Pattern', color: 'text-blue-400' },
  elimination: { icon: '❌', label: 'Elimination', color: 'text-purple-400' },
  approximation: { icon: '≈', label: 'Approximation', color: 'text-cyan-400' },
  sign_check: { icon: '±', label: 'Sign Check', color: 'text-yellow-400' },
  unit_analysis: { icon: '📏', label: 'Unit Analysis', color: 'text-orange-400' },
  graph_reading: { icon: '📊', label: 'Graph Reading', color: 'text-pink-400' },
  option_analysis: { icon: '🔍', label: 'Option Analysis', color: 'text-indigo-400' },
  time_management: { icon: '⏱️', label: 'Time Management', color: 'text-red-400' },
  common_trap: { icon: '⚠️', label: 'Common Trap', color: 'text-amber-400' },
};

const importanceConfig: Record<ExamTip['importance'], {
  badge: string;
  color: string;
}> = {
  must_know: { badge: '⭐ Must Know', color: 'bg-red-600' },
  good_to_know: { badge: 'Good to Know', color: 'bg-blue-600' },
  edge_case: { badge: 'Edge Case', color: 'bg-surface-600' },
};

export function ExamTipsPanel({
  tips,
  topic,
  examType,
  compact = false,
}: ExamTipsPanelProps) {
  const [expandedTip, setExpandedTip] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  // Filter tips
  let filteredTips = tips;
  if (filterType !== 'all') {
    filteredTips = tips.filter((tip) => tip.type === filterType);
  }

  // Sort by importance
  const importanceOrder = { must_know: 0, good_to_know: 1, edge_case: 2 };
  filteredTips.sort((a, b) => importanceOrder[a.importance] - importanceOrder[b.importance]);

  if (tips.length === 0) {
    return (
      <div className="text-center py-8 text-surface-400">
        <span className="text-3xl mb-2 block">📚</span>
        <p>No specific tips for this topic yet.</p>
        <p className="text-sm">Try practicing more to unlock exam insights!</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {filteredTips.slice(0, 3).map((tip) => (
          <CompactTipCard key={tip.id} tip={tip} />
        ))}
        {filteredTips.length > 3 && (
          <button className="text-sm text-primary-400 hover:underline">
            View all {filteredTips.length} tips →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span>⚡</span> Exam Tips
            {examType && <span className="text-sm font-normal text-surface-400">for {examType}</span>}
          </h3>
          {topic && (
            <p className="text-sm text-surface-400">Topic: {topic}</p>
          )}
        </div>
        <span className="px-2 py-1 bg-orange-600 text-white text-xs rounded-full">
          {tips.length} tips
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <FilterButton
          active={filterType === 'all'}
          onClick={() => setFilterType('all')}
          label="All"
          count={tips.length}
        />
        <FilterButton
          active={filterType === 'shortcut'}
          onClick={() => setFilterType('shortcut')}
          label="🚀 Shortcuts"
          count={tips.filter((t) => t.type === 'shortcut').length}
        />
        <FilterButton
          active={filterType === 'common_trap'}
          onClick={() => setFilterType('common_trap')}
          label="⚠️ Traps"
          count={tips.filter((t) => t.type === 'common_trap').length}
        />
        <FilterButton
          active={filterType === 'pattern'}
          onClick={() => setFilterType('pattern')}
          label="🎯 Patterns"
          count={tips.filter((t) => t.type === 'pattern').length}
        />
        <FilterButton
          active={filterType === 'time_management'}
          onClick={() => setFilterType('time_management')}
          label="⏱️ Time"
          count={tips.filter((t) => t.type === 'time_management').length}
        />
      </div>

      {/* Tips list */}
      <div className="space-y-3">
        {filteredTips.map((tip) => (
          <TipCard
            key={tip.id}
            tip={tip}
            expanded={expandedTip === tip.id}
            onToggle={() => setExpandedTip(expandedTip === tip.id ? null : tip.id)}
          />
        ))}
      </div>

      {/* Summary stats */}
      <div className="p-4 bg-surface-800 rounded-xl">
        <p className="text-sm text-surface-400 mb-2">Potential time savings:</p>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-2xl font-bold text-green-400">
              {Math.round(tips.reduce((sum, t) => sum + t.timeSaving, 0) / 60)}m
            </p>
            <p className="text-xs text-surface-500">saved per exam</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-400">
              {Math.round(tips.reduce((sum, t) => sum + t.errorReduction, 0) / tips.length)}%
            </p>
            <p className="text-xs text-surface-500">fewer errors</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  if (count === 0) return null;
  
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
        active
          ? 'bg-primary-600 text-white'
          : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
      }`}
    >
      {label} ({count})
    </button>
  );
}

function TipCard({
  tip,
  expanded,
  onToggle,
}: {
  tip: ExamTip;
  expanded: boolean;
  onToggle: () => void;
}) {
  const typeConfig = tipTypeConfig[tip.type];
  const importance = importanceConfig[tip.importance];

  return (
    <div
      className={`p-4 rounded-xl border transition-all cursor-pointer ${
        expanded
          ? 'bg-surface-800 border-primary-500/50'
          : 'bg-surface-800/50 border-surface-700 hover:border-surface-600'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{typeConfig.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-medium ${typeConfig.color}`}>
              {typeConfig.label}
            </span>
            <span className={`px-2 py-0.5 text-xs rounded ${importance.color} text-white`}>
              {importance.badge}
            </span>
          </div>
          <p className="text-white">{tip.content}</p>
          
          {expanded && (
            <div className="mt-4 space-y-3">
              {/* Applicable topics */}
              <div>
                <p className="text-xs text-surface-500 mb-1">Applies to:</p>
                <div className="flex flex-wrap gap-1">
                  {tip.applicableTo.map((topic) => (
                    <span
                      key={topic}
                      className="px-2 py-0.5 bg-surface-700 text-surface-300 text-xs rounded"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>

              {/* Exams */}
              <div>
                <p className="text-xs text-surface-500 mb-1">For exams:</p>
                <div className="flex flex-wrap gap-1">
                  {tip.examTypes.map((exam) => (
                    <span
                      key={exam}
                      className="px-2 py-0.5 bg-primary-900/30 text-primary-400 text-xs rounded"
                    >
                      {exam}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-4">
                <div className="flex items-center gap-1">
                  <span className="text-green-400">⏱️</span>
                  <span className="text-sm text-surface-300">
                    Saves {tip.timeSaving}s
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-blue-400">📉</span>
                  <span className="text-sm text-surface-300">
                    {tip.errorReduction}% fewer errors
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        <span className={`text-surface-500 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>
    </div>
  );
}

function CompactTipCard({ tip }: { tip: ExamTip }) {
  const typeConfig = tipTypeConfig[tip.type];
  
  return (
    <div className="flex items-start gap-2 p-2 bg-surface-800/50 rounded-lg">
      <span>{typeConfig.icon}</span>
      <p className="text-sm text-surface-200 line-clamp-2">{tip.content}</p>
    </div>
  );
}

// Quick tip widget for chat responses
export function QuickTipBubble({ tip }: { tip: ExamTip }) {
  const typeConfig = tipTypeConfig[tip.type];
  const importance = importanceConfig[tip.importance];
  
  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 bg-orange-900/30 border border-orange-500/30 rounded-lg">
      <span>{typeConfig.icon}</span>
      <span className="text-sm text-orange-200">{tip.content}</span>
      {tip.importance === 'must_know' && (
        <span className="px-1.5 py-0.5 bg-red-600 text-white text-xs rounded">
          ⭐
        </span>
      )}
    </div>
  );
}

export default ExamTipsPanel;
