/**
 * AgentWorkflowPanel
 * Reusable animated workflow visualizer used by LaunchExamModal,
 * RunOpsModal, Strategy page, and Content page.
 *
 * Shows agents as nodes with arrows between them.
 * Each node: emoji + name + status (waiting/running/done) + output snippet.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Loader2, Clock, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import {
  AgentWorkflow,
  WorkflowStep,
  StepStatus,
  runWorkflow,
  WORKFLOWS,
} from '@/services/agentWorkflows';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface StepState {
  status: StepStatus;
  output?: string;
  startedAt?: number;
  completedAt?: number;
}

interface AgentWorkflowPanelProps {
  workflowId: string;
  inputs?: Record<string, unknown>;
  autoStart?: boolean;
  onComplete?: (outputs: Record<string, unknown>) => void;
  compact?: boolean;
  /** If true, shows a horizontal flow diagram A→B→C above the step list */
  showFlowDiagram?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Flow Diagram (A → B → C → D)
// ─────────────────────────────────────────────────────────────────────────────

function FlowDiagram({
  steps,
  stepStates,
}: {
  steps: WorkflowStep[];
  stepStates: StepState[];
}) {
  return (
    <div className="flex items-center justify-center gap-1 flex-wrap mb-4 px-2">
      {steps.map((step, i) => {
        const state = stepStates[i];
        const isRunning = state?.status === 'running';
        const isDone = state?.status === 'done';
        const isWaiting = !state || state.status === 'waiting';

        return (
          <React.Fragment key={step.agentId}>
            <div
              className={clsx(
                'flex flex-col items-center px-2 py-1.5 rounded-xl border text-center transition-all duration-300',
                isDone && 'border-green-500/50 bg-green-500/10',
                isRunning && 'border-primary-500/70 bg-primary-500/10 shadow-lg shadow-primary-500/20',
                isWaiting && 'border-surface-700 bg-surface-800/40'
              )}
            >
              <span className="text-base leading-none">{step.agentEmoji}</span>
              <span
                className={clsx(
                  'text-[10px] font-semibold mt-0.5',
                  isDone && 'text-green-400',
                  isRunning && 'text-primary-400',
                  isWaiting && 'text-surface-400'
                )}
              >
                {step.agentName}
              </span>
              {isRunning && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse mt-0.5" />
              )}
              {isDone && (
                <CheckCircle className="w-2.5 h-2.5 text-green-400 mt-0.5" />
              )}
            </div>
            {i < steps.length - 1 && (
              <ArrowRight
                className={clsx(
                  'w-3.5 h-3.5 flex-shrink-0 transition-colors duration-300',
                  stepStates[i]?.status === 'done' ? 'text-green-400' : 'text-surface-600'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single Step Row
// ─────────────────────────────────────────────────────────────────────────────

function StepRow({
  step,
  index,
  state,
  compact,
}: {
  step: WorkflowStep;
  index: number;
  state: StepState;
  compact: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = state.status === 'running';
  const isDone = state.status === 'done';
  const isWaiting = state.status === 'waiting';

  // Auto-expand when running, keep expanded when done
  useEffect(() => {
    if (isRunning) setExpanded(true);
  }, [isRunning]);

  const durationMs =
    isDone && state.startedAt && state.completedAt
      ? state.completedAt - state.startedAt
      : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={clsx(
        'rounded-xl border transition-all duration-300',
        isDone && 'border-green-500/30 bg-green-500/5',
        isRunning && 'border-primary-500/50 bg-primary-500/5 shadow-md shadow-primary-500/10',
        isWaiting && 'border-surface-700/50 bg-surface-800/30'
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 p-3">
        {/* Status icon */}
        <div className="flex-shrink-0">
          {isRunning ? (
            <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
            </div>
          ) : isDone ? (
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-surface-700/50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-surface-500" />
            </div>
          )}
        </div>

        {/* Agent emoji + info */}
        <div className="text-xl flex-shrink-0">{step.agentEmoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx('font-semibold text-sm', isDone && 'text-green-300', isRunning && 'text-primary-300', isWaiting && 'text-surface-300')}>
              {step.agentName}
            </span>
            <span className="text-surface-500 text-xs">·</span>
            <span className="text-xs text-surface-400">{step.action}</span>
          </div>
          {!compact && (
            <p className="text-xs text-surface-500 mt-0.5 truncate">{step.description}</p>
          )}
        </div>

        {/* Duration badge + expand toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {durationMs && (
            <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
              {(durationMs / 1000).toFixed(1)}s
            </span>
          )}
          {isRunning && (
            <span className="text-[10px] text-primary-400 bg-primary-500/10 px-1.5 py-0.5 rounded animate-pulse">
              running...
            </span>
          )}
          {!compact && state.output && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1 hover:bg-surface-700 rounded-lg transition-colors"
            >
              {expanded
                ? <ChevronUp className="w-3.5 h-3.5 text-surface-400" />
                : <ChevronDown className="w-3.5 h-3.5 text-surface-400" />
              }
            </button>
          )}
        </div>
      </div>

      {/* Output panel */}
      <AnimatePresence>
        {expanded && state.output && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              <div className="bg-surface-900/80 border border-surface-700/50 rounded-xl p-3">
                <p className="text-[10px] text-surface-500 uppercase tracking-wider mb-1.5">Output</p>
                <pre className="text-xs text-surface-200 whitespace-pre-wrap leading-relaxed font-mono">
                  {state.output}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function AgentWorkflowPanel({
  workflowId,
  inputs = {},
  autoStart = false,
  onComplete,
  compact = false,
  showFlowDiagram = true,
}: AgentWorkflowPanelProps) {
  const workflow: AgentWorkflow | undefined = WORKFLOWS[workflowId];

  const [stepStates, setStepStates] = useState<StepState[]>(() =>
    workflow ? workflow.steps.map(() => ({ status: 'waiting' as StepStatus })) : []
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [finalOutputs, setFinalOutputs] = useState<Record<string, unknown>>({});

  const startWorkflow = useCallback(async () => {
    if (isRunning || !workflow) return;
    setIsRunning(true);
    setIsComplete(false);
    setStepStates(workflow.steps.map(() => ({ status: 'waiting' })));

    const result = await runWorkflow(
      workflowId,
      inputs,
      (stepIndex, status, output) => {
        setStepStates(prev => {
          const next = [...prev];
          if (status === 'running') {
            next[stepIndex] = { status: 'running', startedAt: Date.now() };
          } else if (status === 'done') {
            next[stepIndex] = {
              ...next[stepIndex],
              status: 'done',
              output,
              completedAt: Date.now(),
            };
          } else {
            next[stepIndex] = { ...next[stepIndex], status: 'error', output };
          }
          return next;
        });
      }
    );

    setIsRunning(false);
    setIsComplete(true);
    setFinalOutputs(result.outputs);
    onComplete?.(result.outputs);
  }, [workflowId, inputs, isRunning, workflow, onComplete]);

  useEffect(() => {
    if (autoStart) startWorkflow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  if (!workflow) {
    return (
      <div className="text-surface-500 text-sm p-4 text-center">
        Unknown workflow: {workflowId}
      </div>
    );
  }

  const completedCount = stepStates.filter(s => s.status === 'done').length;

  return (
    <div className="space-y-3">
      {/* Flow Diagram */}
      {showFlowDiagram && !compact && (
        <FlowDiagram steps={workflow.steps} stepStates={stepStates} />
      )}

      {/* Progress bar */}
      {(isRunning || isComplete) && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-surface-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary-500 to-green-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(completedCount / workflow.steps.length) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <span className="text-xs text-surface-400 flex-shrink-0">
            {completedCount}/{workflow.steps.length}
          </span>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-2">
        {workflow.steps.map((step, i) => (
          <StepRow
            key={`${step.agentId}-${i}`}
            step={step}
            index={i}
            state={stepStates[i] ?? { status: 'waiting' }}
            compact={compact}
          />
        ))}
      </div>

      {/* Completion message */}
      <AnimatePresence>
        {isComplete && workflow.onComplete && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-sm text-green-300"
          >
            ✅ {workflow.onComplete}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Start button */}
      {!autoStart && !isRunning && !isComplete && (
        <button
          onClick={startWorkflow}
          className="w-full py-2.5 rounded-xl bg-primary-500 hover:bg-primary-400 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
        >
          ▶ Start Workflow
        </button>
      )}

      {/* Re-run button */}
      {isComplete && !autoStart && (
        <button
          onClick={() => {
            setIsComplete(false);
            setStepStates(workflow.steps.map(() => ({ status: 'waiting' })));
            startWorkflow();
          }}
          className="w-full py-2 rounded-xl border border-surface-700 text-surface-400 hover:bg-surface-800 text-sm transition-all"
        >
          ↺ Run Again
        </button>
      )}
    </div>
  );
}

export default AgentWorkflowPanel;
