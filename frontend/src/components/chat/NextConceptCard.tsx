/**
 * NextConceptCard.tsx
 *
 * Renders a "what to learn next" suggestion card below Sage's response.
 * Powered by LensEngine.suggestedNextContent — picks the student's weakest
 * high-priority topic that isn't the current one.
 *
 * Visual: compact card with topic name, reason, urgency indicator.
 * Clicking navigates to that topic's practice/concept page.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { NextContentSuggestion } from '@/services/lensEngine';

interface NextConceptCardProps {
  suggestion: NextContentSuggestion;
  examRoute: string; // e.g. 'gate-em'
  onDismiss?: () => void;
}

const TOPIC_DISPLAY_NAMES: Record<string, string> = {
  'linear-algebra':         'Linear Algebra',
  'calculus':               'Calculus',
  'differential-equations': 'Differential Equations',
  'complex-variables':      'Complex Variables',
  'probability-statistics': 'Probability & Statistics',
  'numerical-methods':      'Numerical Methods',
  'transform-theory':       'Transform Theory',
  'discrete-mathematics':   'Discrete Mathematics',
  'graph-theory':           'Graph Theory',
  'vector-calculus':        'Vector Calculus',
  'quantitative-aptitude':  'Quantitative Aptitude',
  'verbal-ability':         'Verbal Ability',
  'reading-comprehension':  'Reading Comprehension',
  'dilr':                   'Data Interpretation & Logical Reasoning',
};

const CONTENT_TYPE_ICONS: Record<NextContentSuggestion['contentType'], string> = {
  mcq:     '🎯',
  concept: '📖',
  formula: '🔢',
  pyq:     '📋',
};

const URGENCY_STYLES: Record<NextContentSuggestion['urgency'], {
  border: string;
  badge: string;
  label: string;
}> = {
  high:   { border: 'border-red-500/40',    badge: 'bg-red-500/20 text-red-300',    label: 'High Priority' },
  medium: { border: 'border-amber-500/40',  badge: 'bg-amber-500/20 text-amber-300', label: 'Suggested' },
  low:    { border: 'border-slate-500/30',  badge: 'bg-slate-500/20 text-slate-400', label: 'When Ready' },
};

export const NextConceptCard: React.FC<NextConceptCardProps> = ({
  suggestion,
  examRoute,
  onDismiss,
}) => {
  const navigate = useNavigate();
  const topicName = TOPIC_DISPLAY_NAMES[suggestion.topicId] ?? suggestion.topicId;
  const icon = CONTENT_TYPE_ICONS[suggestion.contentType];
  const urgencyStyle = URGENCY_STYLES[suggestion.urgency];

  const handleGo = () => {
    navigate(`/practice/${examRoute}?topic=${suggestion.topicId}&mode=${suggestion.contentType}`);
  };

  return (
    <div
      className={`mt-3 flex items-start gap-3 p-3 rounded-xl border ${urgencyStyle.border} bg-white/4 backdrop-blur-sm group`}
    >
      {/* Icon */}
      <div className="text-xl mt-0.5 select-none">{icon}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-slate-200 truncate">{topicName}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${urgencyStyle.badge}`}>
            {urgencyStyle.label}
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">{suggestion.reason}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={handleGo}
          className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-300 hover:text-indigo-200 transition-colors font-medium"
        >
          Go
        </button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs p-1 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

export default NextConceptCard;
