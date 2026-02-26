/**
 * ExamCreationWizard.tsx
 *
 * CEO-facing deep exam creation workflow:
 * 27-step multi-agent pipeline across 9 phases with:
 * - CEO decision gates (viability approval, quality gate)
 * - Parallel step execution visualisation
 * - PDF/document upload for ingestion
 * - Wolfram/SymPy/web-scrape source indicators
 * - Combo workflow edge case panel
 * - Full agent interconnection map
 */

import { useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket, Upload, CheckCircle2, Clock, AlertTriangle, X,
  ArrowRight, Bot, FileText, Globe, Zap, BarChart3,
  ChevronDown, ChevronRight, Play, Pause, Info,
  Sparkles, GitBranch, Shield, Database, Cpu,
  TrendingUp, BookOpen, Search, PenTool, Package,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  EXAM_CREATION_STEPS, EXAM_CREATION_PHASES, COMBO_WORKFLOWS,
  EXAM_CREATION_CONNECTIONS, runExamCreationWorkflow,
  type ExamCreationStep,
} from '@/services/examCreationWorkflow';

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = 'waiting' | 'running' | 'done' | 'error' | 'gate';

interface StepState {
  status: StepStatus;
  output?: string;
}

interface CEOGate {
  stepId: string;
  report: string;
  resolve: (approved: boolean) => void;
}

const EXAM_OPTIONS = [
  'JEE Main', 'JEE Advanced', 'NEET', 'CBSE Class 12',
  'CBSE Class 10', 'CAT', 'UPSC CSE', 'GATE',
  'GATE Engineering Mathematics',
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  research:     <Search size={12}/>,
  ingestion:    <Database size={12}/>,
  generation:   <PenTool size={12}/>,
  verification: <Shield size={12}/>,
  marketing:    <TrendingUp size={12}/>,
  deployment:   <Package size={12}/>,
  analytics:    <BarChart3 size={12}/>,
  decision:     <Sparkles size={12}/>,
};

const CATEGORY_COLORS: Record<string, string> = {
  research:     'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  ingestion:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  generation:   'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400',
  verification: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  marketing:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  deployment:   'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  analytics:    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  decision:     'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
};

const AGENT_COLORS: Record<string, string> = {
  scout:  'border-sky-400 bg-sky-50 dark:bg-sky-900/10',
  atlas:  'border-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-900/10',
  sage:   'border-green-400 bg-green-50 dark:bg-green-900/10',
  mentor: 'border-amber-400 bg-amber-50 dark:bg-amber-900/10',
  herald: 'border-red-400 bg-red-50 dark:bg-red-900/10',
  forge:  'border-violet-400 bg-violet-50 dark:bg-violet-900/10',
  oracle: 'border-cyan-400 bg-cyan-50 dark:bg-cyan-900/10',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepCard({ step, state, expanded, onToggle }:
  { step: ExamCreationStep; state: StepState; expanded: boolean; onToggle: () => void }) {

  const isParallel = step.execution === 'parallel' && step.parallelWith?.length;

  return (
    <motion.div
      layout
      className={clsx('rounded-xl border-l-4 transition-all',
        state.status === 'running' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10 shadow-md' :
        state.status === 'done'    ? 'border-green-500 bg-white dark:bg-gray-800' :
        state.status === 'error'   ? 'border-red-500 bg-red-50 dark:bg-red-900/10' :
        state.status === 'gate'    ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10 shadow-lg animate-pulse' :
        `border-l-4 ${AGENT_COLORS[step.agentId].split(' ')[0]} bg-white dark:bg-gray-800 opacity-60`,
      )}>
      <button onClick={onToggle} className="w-full p-3 text-left flex items-start gap-3">
        {/* Status icon */}
        <div className="mt-0.5 shrink-0">
          {state.status === 'running' && <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />}
          {state.status === 'done'    && <CheckCircle2 size={20} className="text-green-500" />}
          {state.status === 'error'   && <AlertTriangle size={20} className="text-red-500" />}
          {state.status === 'gate'    && <Sparkles size={20} className="text-yellow-600" />}
          {state.status === 'waiting' && <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />}
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="text-base">{step.agentEmoji}</span>
            <span className="font-semibold text-sm text-gray-900 dark:text-white">{step.action}</span>
            {step.requiresCEOApproval && (
              <span className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs rounded font-bold">
                👔 CEO Gate
              </span>
            )}
            {isParallel && (
              <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs rounded">
                ⚡ Parallel
              </span>
            )}
            <span className={clsx('px-1.5 py-0.5 rounded text-xs flex items-center gap-0.5', CATEGORY_COLORS[step.category])}>
              {CATEGORY_ICONS[step.category]} {step.category}
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-2">
            <span className="font-medium text-gray-600 dark:text-gray-300">{step.agentName}</span>
            <span>·</span>
            <Clock size={10} className="inline" /> ~{Math.round(step.estimatedMs / 1000)}s
            {step.connectionsRequired.length > 0 && (
              <><span>·</span> <Globe size={10} className="inline" /> {step.connectionsRequired[0]}{step.connectionsRequired.length > 1 ? ` +${step.connectionsRequired.length - 1}` : ''}</>
            )}
          </p>
        </div>
        <ChevronDown size={14} className={clsx('shrink-0 mt-1 text-gray-400 transition-transform', expanded && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="px-3 pb-3 space-y-3">
              <p className="text-xs text-gray-600 dark:text-gray-300">{step.description}</p>
              {/* Sub-agents + connections */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {step.subAgentsInvolved.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1"><Bot size={10}/> SUB-AGENTS</p>
                    <div className="flex flex-wrap gap-1">
                      {step.subAgentsInvolved.map(s => <span key={s} className="px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">{s}</span>)}
                    </div>
                  </div>
                )}
                {step.connectionsRequired.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1"><Globe size={10}/> CONNECTIONS</p>
                    <div className="flex flex-wrap gap-1">
                      {step.connectionsRequired.map(c => <span key={c} className="px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">{c}</span>)}
                    </div>
                  </div>
                )}
              </div>
              {/* Fallback chain */}
              {step.fallbackChain && step.fallbackChain.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                  <AlertTriangle size={10}/>
                  <span className="font-bold">Fallback:</span>
                  {step.fallbackChain.map((f, i) => <span key={f}>{i > 0 && <ArrowRight size={10} className="inline mx-0.5"/>}{f}</span>)}
                </div>
              )}
              {/* Output */}
              {state.output && (
                <div className="bg-gray-900 dark:bg-black rounded-lg p-3">
                  <pre className="text-xs text-green-400 whitespace-pre-wrap font-mono leading-relaxed">{state.output}</pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CEOGateModal({ gate, onDecide }: { gate: CEOGate; onDecide: (approved: boolean) => void }) {
  const step = EXAM_CREATION_STEPS.find(s => s.id === gate.stepId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-2xl border border-yellow-300 dark:border-yellow-700 shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
            <Sparkles size={20} className="text-yellow-600" />
          </div>
          <div>
            <p className="font-bold text-gray-900 dark:text-white">👔 CEO Decision Required</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{step?.action}</p>
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 mb-4 max-h-72 overflow-y-auto">
          <pre className="text-xs text-green-400 whitespace-pre-wrap font-mono leading-relaxed">{gate.report}</pre>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Review the report above and decide whether to proceed to the next phase.
        </p>
        <div className="flex gap-3">
          <button onClick={() => onDecide(false)}
            className="flex-1 px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium">
            ✗ Abort / Reconsider
          </button>
          <button onClick={() => onDecide(true)}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 text-sm font-medium">
            ✓ Approve & Proceed
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ExamCreationWizard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const prefilledExam = searchParams.get('exam') || '';
  const isPreanalysed = searchParams.get('preanalysed') === 'true';

  const [examName, setExamName] = useState(prefilledExam);
  const [pilotMode, setPilotMode] = useState(false);
  const [multilingual, setMultilingual] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [stepStates, setStepStates] = useState<Record<string, StepState>>({});
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [ceoGate, setCeoGate] = useState<CEOGate | null>(null);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'combos' | 'connections'>('pipeline');
  const [expandedPhase, setExpandedPhase] = useState<number | null>(1);
  const fileRef = useRef<HTMLInputElement>(null);

  const updateStep = useCallback((stepId: string, status: StepStatus, output?: string) => {
    setStepStates(prev => ({ ...prev, [stepId]: { status, output } }));
    if (status === 'running' || status === 'gate') {
      setExpandedSteps(prev => new Set([...prev, stepId]));
      // Auto-expand the phase
      const step = EXAM_CREATION_STEPS.find(s => s.id === stepId);
      if (step) setExpandedPhase(step.phase);
    }
  }, []);

  const handleStart = useCallback(async () => {
    if (!examName) return;
    setRunning(true);
    setCompleted(false);
    setStepStates({});

    // Mark all steps as waiting
    const initial: Record<string, StepState> = {};
    EXAM_CREATION_STEPS.forEach(s => { initial[s.id] = { status: 'waiting' }; });
    setStepStates(initial);

    const inputs: Record<string, unknown> = { examName, pilotMode, multilingual, uploadedFiles };

    const result = await runExamCreationWorkflow(
      inputs,
      (stepId, status, output) => {
        if (status === 'running') updateStep(stepId, 'running');
        else if (status === 'done') updateStep(stepId, 'done', output);
        else if (status === 'error') updateStep(stepId, 'error', output);
      },
      (stepId, report) => {
        return new Promise<boolean>(resolve => {
          updateStep(stepId, 'gate', report);
          setCeoGate({ stepId, report, resolve });
        });
      },
    );

    setRunning(false);
    setCompleted(result.success);
  }, [examName, pilotMode, multilingual, uploadedFiles, updateStep]);

  const handleGateDecision = (approved: boolean) => {
    if (ceoGate) {
      if (!approved) updateStep(ceoGate.stepId, 'error', 'CEO aborted workflow.');
      else updateStep(ceoGate.stepId, 'done');
      ceoGate.resolve(approved);
      setCeoGate(null);
    }
  };

  const totalSteps = EXAM_CREATION_STEPS.length;
  const doneSteps = Object.values(stepStates).filter(s => s.status === 'done').length;
  const progress = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Rocket size={24} className="text-blue-500" /> New Exam Creation
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          27-step multi-agent pipeline: market research → source ingestion → content generation → verification → deployment
        </p>
      </div>

      {/* Pre-analysed banner */}
      {isPreanalysed && prefilledExam && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-2">
            <span className="text-lg">✅</span>
            <div>
              <p className="text-sm font-semibold text-green-400">VentureScout pre-analysis loaded for {prefilledExam}</p>
              <p className="text-xs text-green-400/70">Demand, competitor, pricing & SEO research complete — skipping Phase 1</p>
            </div>
          </div>
          <button onClick={() => navigate('/opportunity-discovery')} className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors">
            View Research
          </button>
        </div>
      )}

      {/* No analysis banner — shown only when accessed directly without pre-fill */}
      {!isPreanalysed && !running && !prefilledExam && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2">
            <span className="text-lg">🕵️</span>
            <p className="text-sm text-amber-400">No opportunity analysis yet — run discovery first for better results</p>
          </div>
          <button onClick={() => navigate('/opportunity-discovery')} className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors">
            Run Discovery First →
          </button>
        </div>
      )}

      {/* Config Panel */}
      {!running && !completed && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 className="font-bold text-gray-900 dark:text-white">Configure Exam</h2>
          {/* Exam selector */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">EXAM *</label>
            <div className="flex flex-wrap gap-2">
              {EXAM_OPTIONS.map(e => (
                <button key={e} onClick={() => setExamName(e)}
                  className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                    examName === e ? 'bg-blue-600 text-white border-blue-600'
                                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')}>
                  {e}
                </button>
              ))}
              <input placeholder="Custom exam name..." value={EXAM_OPTIONS.includes(examName) ? '' : examName}
                onChange={e => setExamName(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-40 focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={pilotMode} onChange={e => setPilotMode(e.target.checked)} className="rounded" />
              <span className="text-sm text-gray-700 dark:text-gray-300">⚡ Pilot Mode (fast launch, top 20 topics)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={multilingual} onChange={e => setMultilingual(e.target.checked)} className="rounded" />
              <span className="text-sm text-gray-700 dark:text-gray-300">🌐 Multilingual (English + Hinglish)</span>
            </label>
          </div>

          {/* PDF Upload */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
              📄 UPLOAD SOURCE DOCUMENTS (Optional but recommended)
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
              <Upload size={20} className="mx-auto text-gray-400 mb-1" />
              <p className="text-xs text-gray-500 dark:text-gray-400">NCERT textbooks, PYQ papers, reference books (PDF, DOCX)</p>
              <p className="text-xs text-gray-400 mt-0.5">Click or drag & drop</p>
              <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.pptx" className="hidden"
                onChange={e => {
                  const names = Array.from(e.target.files || []).map(f => f.name);
                  setUploadedFiles(prev => [...new Set([...prev, ...names])]);
                }} />
            </div>
            {uploadedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {uploadedFiles.map(f => (
                  <span key={f} className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-400">
                    <FileText size={10}/> {f}
                    <button onClick={() => setUploadedFiles(prev => prev.filter(x => x !== f))} className="ml-1 hover:text-red-500"><X size={10}/></button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Atlas will parse → chunk → embed into vector store for RAG-grounded generation.
              Without uploads: Scout scrapes NTA/CBSE official sites + LLM knowledge base.
            </p>
          </div>

          <button onClick={handleStart} disabled={!examName}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2">
            <Rocket size={16}/> Launch Exam Creation Pipeline
          </button>
        </div>
      )}

      {/* Progress bar */}
      {(running || completed) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {completed ? '🎉 Pipeline Complete!' : `Running: ${examName} exam creation`}
            </span>
            <span className="text-sm text-gray-500">{doneSteps}/{totalSteps} steps</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
            <motion.div className="bg-blue-500 rounded-full h-2" animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
          </div>
          {completed && (
            <div className="mt-3 flex gap-3">
              <button onClick={() => { setRunning(false); setCompleted(false); setStepStates({}); }}
                className="px-4 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50">
                Create Another Exam
              </button>
              <a href="/exam-analytics" className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                View Analytics →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Tab nav */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        {([
          { id: 'pipeline',     icon: <Cpu size={14}/>,       label: 'Pipeline' },
          { id: 'combos',       icon: <GitBranch size={14}/>,  label: 'Edge Cases' },
          { id: 'connections',  icon: <Zap size={14}/>,        label: 'Agent Connections' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === t.id ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                 : 'text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-700/50')}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── PIPELINE TAB ──────────────────────────────────────────── */}
      {activeTab === 'pipeline' && (
        <div className="space-y-3">
          {EXAM_CREATION_PHASES.map(phase => {
            const phaseSteps = EXAM_CREATION_STEPS.filter(s => s.phase === phase.phase);
            const phaseDone = phaseSteps.filter(s => stepStates[s.id]?.status === 'done').length;
            const phaseRunning = phaseSteps.some(s => stepStates[s.id]?.status === 'running' || stepStates[s.id]?.status === 'gate');
            const isOpen = expandedPhase === phase.phase;

            return (
              <div key={phase.phase} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button onClick={() => setExpandedPhase(isOpen ? null : phase.phase)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <span className="text-xl">{phase.emoji}</span>
                  <div className="flex-1 text-left">
                    <p className={clsx('font-bold text-sm', phase.color)}>Phase {phase.phase}: {phase.label}</p>
                    <p className="text-xs text-gray-400">{phaseDone}/{phase.stepCount} steps complete</p>
                  </div>
                  {phaseRunning && <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />}
                  {phaseDone === phase.stepCount && phase.stepCount > 0 && <CheckCircle2 size={16} className="text-green-500" />}
                  <ChevronRight size={14} className={clsx('text-gray-400 transition-transform', isOpen && 'rotate-90')} />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="px-3 pb-3 space-y-2 border-t border-gray-100 dark:border-gray-700 pt-2">
                        {phaseSteps.map(step => (
                          <StepCard key={step.id} step={step}
                            state={stepStates[step.id] || { status: 'waiting' }}
                            expanded={expandedSteps.has(step.id)}
                            onToggle={() => setExpandedSteps(prev => {
                              const next = new Set(prev);
                              next.has(step.id) ? next.delete(step.id) : next.add(step.id);
                              return next;
                            })} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* ── COMBO WORKFLOWS / EDGE CASES ─────────────────────────── */}
      {activeTab === 'combos' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            These edge-case workflows activate automatically based on conditions encountered during the main pipeline.
          </p>
          {COMBO_WORKFLOWS.map(combo => (
            <div key={combo.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">⚡</span>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 dark:text-white text-sm">{combo.name}</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mb-1">Trigger: {combo.trigger}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">{combo.description}</p>
                  <p className="text-xs text-gray-400 italic">💡 {combo.reason}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {combo.steps.map(s => {
                      const step = EXAM_CREATION_STEPS.find(x => x.id === s);
                      return step ? (
                        <span key={s} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300 rounded flex items-center gap-0.5">
                          {step.agentEmoji} {step.action}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── AGENT CONNECTIONS ─────────────────────────────────────── */}
      {activeTab === 'connections' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Full data flow map between agents, external sources, and the CEO for the exam creation pipeline.
          </p>
          <div className="space-y-2">
            {EXAM_CREATION_CONNECTIONS.map((conn, idx) => (
              <div key={idx} className={clsx('flex items-center gap-3 p-3 rounded-xl border',
                conn.isCriticalPath ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800')}>
                <span className={clsx('px-2 py-1 rounded font-mono text-xs font-bold shrink-0',
                  conn.isCriticalPath ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400')}>
                  {conn.from}
                </span>
                <ArrowRight size={14} className="text-gray-400 shrink-0" />
                <span className={clsx('px-2 py-1 rounded font-mono text-xs font-bold shrink-0',
                  conn.isCriticalPath ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400')}>
                  {conn.to}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{conn.dataType}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{conn.description}</p>
                </div>
                {conn.isCriticalPath && <span className="text-xs text-blue-600 dark:text-blue-400 font-bold shrink-0">Critical Path</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CEO Gate Modal */}
      {ceoGate && <CEOGateModal gate={ceoGate} onDecide={handleGateDecision} />}
    </div>
  );
}

export default ExamCreationWizard;
