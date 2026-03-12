/**
 * VisualConceptCard — Customer-Centric Visual Math Framework
 *
 * Rich card component for visual concept delivery.
 * Beats ChatGPT on: exam specificity, pedagogical depth, curriculum alignment.
 *
 * Feature-flagged via visualConceptCardsEnabled from appStore.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronUp, Target, BookOpen,
  Lightbulb, AlertTriangle, ArrowRight, Grid3X3,
  BarChart3, GitBranch, Circle, Box, CheckSquare,
} from 'lucide-react';
import type { VisualConceptCardData, VisualType } from '@/services/visualMathService';

// ── Visual type icons ─────────────────────────────────────────────────────────

const VISUAL_TYPE_ICONS: Record<VisualType, React.ReactNode> = {
  'matrix':           <Grid3X3 className="w-4 h-4" />,
  'graph':            <BarChart3 className="w-4 h-4" />,
  'probability-tree': <GitBranch className="w-4 h-4" />,
  'number-line':      <ArrowRight className="w-4 h-4" />,
  'venn':             <Circle className="w-4 h-4" />,
  'formula-box':      <Box className="w-4 h-4" />,
  'worked-example':   <CheckSquare className="w-4 h-4" />,
};

const VISUAL_TYPE_LABELS: Record<VisualType, string> = {
  'matrix':           'Matrix View',
  'graph':            'Graph Visual',
  'probability-tree': 'Probability Tree',
  'number-line':      'Number Line',
  'venn':             'Venn Diagram',
  'formula-box':      'Formula Card',
  'worked-example':   'Worked Example',
};

const DIFFICULTY_CONFIG = {
  easy:   { label: 'Easy',   color: 'text-green-400 bg-green-400/10 border-green-400/20' },
  medium: { label: 'Medium', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  hard:   { label: 'Hard',   color: 'text-red-400 bg-red-400/10 border-red-400/20'       },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface VisualConceptCardProps {
  data: VisualConceptCardData;
  /** If true, starts collapsed (default false) */
  defaultCollapsed?: boolean;
  /** Called when user dismisses the card */
  onDismiss?: () => void;
}

// ── Formula display (simple LaTeX-style rendering with monospace) ─────────────

function FormulaDisplay({ formula }: { formula: string }) {
  // Strip outermost LaTeX delimiters if present
  const clean = formula.replace(/^\\\(|\\\)$|^\\\[|\\\]$/g, '').trim();

  return (
    <div className="bg-surface-900/80 border border-primary-500/20 rounded-xl px-4 py-3 my-2">
      <div className="text-center font-mono text-primary-200 text-sm tracking-wide leading-relaxed overflow-x-auto">
        <code>{clean}</code>
      </div>
    </div>
  );
}

// ── ASCII Diagram display ─────────────────────────────────────────────────────

function AsciiDiagram({ diagram }: { diagram: string }) {
  return (
    <div className="bg-surface-900/80 border border-surface-600/40 rounded-xl px-4 py-3 my-2 overflow-x-auto">
      <pre className="text-xs text-surface-300 font-mono leading-relaxed whitespace-pre">
        {diagram.trim()}
      </pre>
    </div>
  );
}

// ── Visual Zone: renders the appropriate visual based on visualType ────────────

function VisualZone({
  visualType,
  keyFormula,
  asciiDiagram,
  steps,
}: {
  visualType: VisualType;
  keyFormula: string;
  asciiDiagram?: string;
  steps: string[];
}) {
  if (asciiDiagram) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-2 text-xs text-surface-400 font-medium uppercase tracking-wider">
          {VISUAL_TYPE_ICONS[visualType]}
          <span>{VISUAL_TYPE_LABELS[visualType]}</span>
        </div>
        <AsciiDiagram diagram={asciiDiagram} />
        <FormulaDisplay formula={keyFormula} />
      </div>
    );
  }

  // For formula-box or worked-example: show formula prominently
  if (visualType === 'formula-box' || visualType === 'worked-example') {
    return (
      <div>
        <div className="flex items-center gap-2 mb-2 text-xs text-surface-400 font-medium uppercase tracking-wider">
          {VISUAL_TYPE_ICONS[visualType]}
          <span>{VISUAL_TYPE_LABELS[visualType]}</span>
        </div>
        <FormulaDisplay formula={keyFormula} />
        {/* For worked-example show the first 3 steps inline */}
        {visualType === 'worked-example' && (
          <div className="space-y-1 mt-2">
            {steps.slice(0, 3).map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-surface-400">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400 font-mono text-[10px]">
                  {i + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
            {steps.length > 3 && (
              <p className="text-xs text-surface-600 italic pl-7">+ {steps.length - 3} more steps below ↓</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Default: formula + label
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-xs text-surface-400 font-medium uppercase tracking-wider">
        {VISUAL_TYPE_ICONS[visualType]}
        <span>{VISUAL_TYPE_LABELS[visualType]}</span>
      </div>
      <FormulaDisplay formula={keyFormula} />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function VisualConceptCard({
  data,
  defaultCollapsed = false,
  onDismiss,
}: VisualConceptCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const diffConfig = DIFFICULTY_CONFIG[data.difficulty] ?? DIFFICULTY_CONFIG.medium;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="mt-3 rounded-2xl border border-primary-500/20 bg-surface-900/60 backdrop-blur-sm overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.04) 0%, rgba(139,92,246,0.04) 100%)',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          {/* Visual concept icon */}
          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400">
            <Target className="w-3.5 h-3.5" />
          </div>

          {/* Topic name */}
          <span className="font-semibold text-white text-sm truncate">{data.concept}</span>

          {/* Exam badge */}
          <span className="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full">
            {data.examId === 'gate-engineering-maths' ? 'GATE EM' :
             data.examId === 'jee-main' ? 'JEE Main' :
             data.examId === 'jee-advanced' ? 'JEE Adv' :
             data.examId === 'neet' ? 'NEET' :
             data.examId.toUpperCase()}
          </span>

          {/* Difficulty pill */}
          <span className={`flex-shrink-0 text-[10px] font-medium px-2 py-0.5 border rounded-full ${diffConfig.color}`}>
            {diffConfig.label}
          </span>
        </div>

        {/* Collapse/Expand + Dismiss */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
            className="p-1 rounded-md hover:bg-surface-700 transition-colors text-surface-500 hover:text-surface-300"
            aria-label={isCollapsed ? 'Expand visual card' : 'Collapse visual card'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          {onDismiss && (
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(); }}
              className="p-1 rounded-md hover:bg-surface-700 transition-colors text-surface-600 hover:text-surface-400 text-xs"
              aria-label="Dismiss visual card"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Exam section info (GATE only) ──────────────────────────────────── */}
      {!isCollapsed && data.gateSection && (
        <div className="mx-4 mb-2 text-[10px] text-surface-500 font-medium tracking-wide flex items-center gap-1.5">
          <BookOpen className="w-3 h-3" />
          <span>{data.gateSection}</span>
        </div>
      )}

      {/* ── Expandable body ─────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div className="px-4 pb-4 space-y-4">

              {/* ── Visual Zone ───────────────────────────────────────────── */}
              <VisualZone
                visualType={data.visualType}
                keyFormula={data.keyFormula}
                asciiDiagram={data.asciiDiagram}
                steps={data.steps}
              />

              {/* ── Steps Panel ───────────────────────────────────────────── */}
              <div>
                <h4 className="text-xs font-semibold text-surface-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-400 inline-block" />
                  Step-by-Step Breakdown
                </h4>
                <ol className="space-y-2">
                  {data.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-500/15 border border-primary-500/25 flex items-center justify-center text-primary-300 font-mono text-[11px] font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-surface-300 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* ── Memory Anchor ─────────────────────────────────────────── */}
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3">
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider mb-1">
                      Memory Anchor
                    </p>
                    <p className="text-sm text-purple-200 italic leading-relaxed">{data.memoryAnchor}</p>
                  </div>
                </div>
              </div>

              {/* ── Exam Tip ──────────────────────────────────────────────── */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider mb-1">
                      🎯 Exam Tip
                    </p>
                    <p className="text-sm text-amber-200 leading-relaxed">{data.examTip}</p>
                  </div>
                </div>
              </div>

              {/* ── JEE frequency (if applicable) ────────────────────────── */}
              {data.jeeFrequency && (
                <p className="text-[10px] text-surface-500 italic">📊 {data.jeeFrequency}</p>
              )}

              {/* ── CTA: Try a question ───────────────────────────────────── */}
              <Link
                to={data.practiceLink}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary-600/20 hover:bg-primary-600/30 border border-primary-500/25 hover:border-primary-500/40 text-primary-300 hover:text-primary-200 text-sm font-medium transition-all group"
              >
                <Target className="w-4 h-4 group-hover:scale-110 transition-transform" />
                Try a question on {data.concept}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default VisualConceptCard;
