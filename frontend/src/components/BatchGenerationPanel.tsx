/**
 * BatchGenerationPanel.tsx — CEO/Admin: Persona-Driven Batch Content Generation
 *
 * Allows the CEO to configure a PersonaBatchSpec (exam × topics × styles × objectives × formats),
 * preview the expansion count, trigger generation, monitor progress, and export results.
 *
 * Usage: import and place in the Content page tab or /batch-generate route.
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Download, Play, RefreshCw, CheckCircle, XCircle,
  Loader2, ChevronDown, ChevronUp, Info, BarChart3, AlertTriangle,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  expandBatchSpec,
  runPersonaBatch,
  buildFullCoverageBatchSpec,
} from '@/services/personaBatchService';
import type {
  PersonaBatchSpec,
  PersonaBatchResult,
  PersonaBatchRequest,
  BatchMode,
  LearningStyle,
  LearningObjective,
  ContentPersonaFormat,
} from '@/services';
import { LEARNING_STYLE_LABELS, OBJECTIVE_LABELS, FORMAT_LABELS } from '@/services/contentPersonaEngine';
import { REGISTRY_SIZE } from '@/services/templateRegistry';

// ─── Constants ─────────────────────────────────────────────────────────────────

const EXAM_OPTIONS: { value: string; label: string; topics: string[] }[] = [
  {
    value: 'gate_em',
    label: 'GATE EM',
    topics: [
      'Electric Field and Potential', 'Magnetostatics', 'Electromagnetic Induction',
      'Maxwell\'s Equations', 'Electromagnetic Waves', 'Transmission Lines',
      'Waveguides', 'Antennas', 'Electrostatics in Matter', 'Magnetic Materials',
    ],
  },
  {
    value: 'jee',
    label: 'JEE Main / Advanced',
    topics: ['Mechanics', 'Electromagnetism', 'Waves', 'Modern Physics', 'Thermodynamics'],
  },
  {
    value: 'cat',
    label: 'CAT',
    topics: ['Quantitative Aptitude', 'Verbal Ability', 'Reading Comprehension', 'DILR'],
  },
  {
    value: 'neet',
    label: 'NEET',
    topics: ['Mechanics', 'Electrostatics', 'Optics', 'Modern Physics', 'Cell Biology', 'Genetics'],
  },
];

const STYLE_OPTIONS: { value: LearningStyle; label: string }[] = [
  { value: 'visual',         label: LEARNING_STYLE_LABELS.visual },
  { value: 'analytical',     label: LEARNING_STYLE_LABELS.analytical },
  { value: 'story_driven',   label: LEARNING_STYLE_LABELS.story_driven },
  { value: 'practice_first', label: LEARNING_STYLE_LABELS.practice_first },
  { value: 'auditory',       label: LEARNING_STYLE_LABELS.auditory },
];

const OBJECTIVE_OPTIONS: { value: LearningObjective; label: string }[] = [
  { value: 'conceptual_understanding', label: OBJECTIVE_LABELS.conceptual_understanding },
  { value: 'exam_readiness',           label: OBJECTIVE_LABELS.exam_readiness },
  { value: 'quick_revision',           label: OBJECTIVE_LABELS.quick_revision },
  { value: 'skill_building',           label: OBJECTIVE_LABELS.skill_building },
  { value: 'competitive_edge',         label: OBJECTIVE_LABELS.competitive_edge },
];

const FORMAT_OPTIONS: { value: ContentPersonaFormat; label: string }[] = [
  { value: 'mcq_set',            label: FORMAT_LABELS.mcq_set },
  { value: 'lesson_notes',       label: FORMAT_LABELS.lesson_notes },
  { value: 'flashcard_set',      label: FORMAT_LABELS.flashcard_set },
  { value: 'worked_example',     label: FORMAT_LABELS.worked_example },
  { value: 'cheatsheet',         label: FORMAT_LABELS.cheatsheet },
  { value: 'formula_sheet',      label: FORMAT_LABELS.formula_sheet },
  { value: 'visual_diagram_text',label: FORMAT_LABELS.visual_diagram_text },
  { value: 'analogy_explainer',  label: FORMAT_LABELS.analogy_explainer },
  { value: 'blog_post',          label: FORMAT_LABELS.blog_post },
];

const MODE_OPTIONS: { value: BatchMode; label: string; desc: string }[] = [
  { value: 'generate_only',        label: 'Generate Only',          desc: 'Pure LLM — fast, no external sources' },
  { value: 'scrape_then_generate', label: 'Scrape → Generate',      desc: 'Fetch from KnowledgeRouter first, then generate grounded content' },
  { value: 'wolfram_grounded',     label: 'Wolfram Grounded',       desc: 'Wolfram verification on all outputs (math-heavy content)' },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function MultiSelectGroup<T extends string>({
  label,
  options,
  selected,
  onChange,
  max,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (v: T[]) => void;
  max?: number;
}) {
  const toggle = (v: T) => {
    if (selected.includes(v)) {
      onChange(selected.filter(s => s !== v));
    } else if (!max || selected.length < max) {
      onChange([...selected, v]);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-surface-300 uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              selected.includes(opt.value)
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-surface-700 text-surface-300 hover:bg-surface-600',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PersonaBatchRequest['status'] }) {
  const config = {
    pending:  { icon: <div className="w-2 h-2 rounded-full bg-surface-400" />, label: 'Pending',  cls: 'text-surface-400' },
    running:  { icon: <Loader2 className="w-3 h-3 animate-spin" />,            label: 'Running',  cls: 'text-yellow-400' },
    done:     { icon: <CheckCircle className="w-3 h-3" />,                      label: 'Done',     cls: 'text-green-400' },
    failed:   { icon: <XCircle className="w-3 h-3" />,                         label: 'Failed',   cls: 'text-red-400' },
  }[status];

  return (
    <span className={clsx('flex items-center gap-1 text-xs font-medium', config.cls)}>
      {config.icon} {config.label}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function BatchGenerationPanel() {
  // ── Form state ──────────────────────────────────────────────────────────
  const [examId, setExamId]       = useState<string>('gate_em');
  const [topics, setTopics]       = useState<string[]>([]);
  const [styles, setStyles]       = useState<LearningStyle[]>(['analytical']);
  const [objectives, setObjectives] = useState<LearningObjective[]>(['exam_readiness']);
  const [formats, setFormats]     = useState<ContentPersonaFormat[]>(['mcq_set']);
  const [mode, setMode]           = useState<BatchMode>('generate_only');
  const [difficulty, setDifficulty] = useState<PersonaBatchSpec['difficulty']>('mixed');
  const [itemCount, setItemCount] = useState(10);

  // ── Run state ────────────────────────────────────────────────────────────
  const [phase, setPhase]         = useState<'idle' | 'scraping' | 'generating' | 'done'>('idle');
  const [progress, setProgress]   = useState({ done: 0, total: 0 });
  const [result, setResult]       = useState<PersonaBatchResult | null>(null);
  const [requests, setRequests]   = useState<PersonaBatchRequest[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // ── Computed ──────────────────────────────────────────────────────────────
  const selectedExam = useMemo(
    () => EXAM_OPTIONS.find(e => e.value === examId) ?? EXAM_OPTIONS[0],
    [examId],
  );

  const allTopics = selectedExam.topics;

  const expansion = useMemo(() => {
    if (!topics.length || !styles.length || !objectives.length || !formats.length) return null;
    const spec: PersonaBatchSpec = {
      id:                  `preview_${Date.now()}`,
      name:                `Preview`,
      examId,
      examName:            selectedExam.label,
      topics,
      learningStyles:      styles,
      objectives,
      formats,
      difficulty,
      itemCountPerRequest: itemCount,
      mode,
    };
    return expandBatchSpec(spec);
  }, [examId, selectedExam.label, topics, styles, objectives, formats, difficulty, itemCount, mode]);

  const totalRequests = expansion?.totalRequests ?? 0;
  const skipped       = expansion?.skippedCombos ?? 0;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleExamChange = useCallback((newExamId: string) => {
    setExamId(newExamId);
    setTopics([]); // reset topics on exam change
  }, []);

  const handleSelectAllTopics = useCallback(() => {
    setTopics(topics.length === allTopics.length ? [] : allTopics);
  }, [topics.length, allTopics]);

  const handleLoadFullCoverage = useCallback(() => {
    const spec = buildFullCoverageBatchSpec(examId, selectedExam.label, allTopics, { mode });
    setTopics(spec.topics);
    setStyles(spec.learningStyles);
    setObjectives(spec.objectives);
    setFormats(spec.formats as ContentPersonaFormat[]);
  }, [examId, selectedExam.label, allTopics, mode]);

  const handleGenerate = useCallback(async () => {
    if (!expansion || totalRequests === 0) return;
    setError(null);
    setResult(null);
    setPhase('scraping');
    setProgress({ done: 0, total: totalRequests });

    // Track request statuses locally for UI
    const liveRequests: PersonaBatchRequest[] = expansion.requests.map(r => ({ ...r }));
    setRequests(liveRequests);
    let liveIdx = 0;

    try {
      const spec: PersonaBatchSpec = {
        id:                  `batch_${Date.now()}`,
        name:                `${selectedExam.label} — Persona Batch`,
        examId,
        examName:            selectedExam.label,
        topics,
        learningStyles:      styles,
        objectives,
        formats,
        difficulty,
        itemCountPerRequest: itemCount,
        mode,
      };

      const batchResult = await runPersonaBatch(spec, (phaseStr, done, total) => {
        setPhase(phaseStr as 'scraping' | 'generating');
        setProgress({ done, total });

        // Update individual request statuses
        if (phaseStr === 'generating' && done > 0 && done <= liveRequests.length) {
          const prevIdx = liveIdx;
          while (liveIdx < done && liveIdx < liveRequests.length) {
            liveRequests[liveIdx] = { ...liveRequests[liveIdx], status: 'done' };
            liveIdx++;
          }
          if (liveIdx < liveRequests.length) {
            liveRequests[liveIdx] = { ...liveRequests[liveIdx], status: 'running' };
          }
          if (prevIdx !== liveIdx) setRequests([...liveRequests]);
        }
      });

      // Mark all as done
      liveRequests.forEach((_, i) => { liveRequests[i] = { ...liveRequests[i], status: 'done' }; });
      setRequests([...liveRequests]);
      setResult(batchResult);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch generation failed');
      setPhase('idle');
    }
  }, [expansion, totalRequests, examId, selectedExam.label, topics, styles, objectives, formats, difficulty, itemCount, mode]);

  const handleExport = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `batch_${result.specId}_${result.completedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const isRunning = phase === 'scraping' || phase === 'generating';
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary-400" />
            Persona Batch Generator
          </h2>
          <p className="text-sm text-surface-400 mt-0.5">
            Template registry: {REGISTRY_SIZE} overrides active
          </p>
        </div>
        <button
          onClick={handleLoadFullCoverage}
          className="btn-secondary text-sm flex items-center gap-1.5"
          disabled={isRunning}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Full Coverage Preset
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Config */}
        <div className="lg:col-span-2 space-y-5">

          {/* Exam selector */}
          <div className="card p-4 space-y-3">
            <p className="text-xs font-medium text-surface-300 uppercase tracking-wide">Exam</p>
            <div className="flex flex-wrap gap-2">
              {EXAM_OPTIONS.map(e => (
                <button
                  key={e.value}
                  onClick={() => handleExamChange(e.value)}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    examId === e.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-700 text-surface-300 hover:bg-surface-600',
                  )}
                  disabled={isRunning}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topics */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-surface-300 uppercase tracking-wide">Topics</p>
              <button
                onClick={handleSelectAllTopics}
                className="text-xs text-primary-400 hover:text-primary-300"
                disabled={isRunning}
              >
                {topics.length === allTopics.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {allTopics.map(t => (
                <button
                  key={t}
                  onClick={() => setTopics(prev =>
                    prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t],
                  )}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    topics.includes(t)
                      ? 'bg-secondary-600 text-white'
                      : 'bg-surface-700 text-surface-300 hover:bg-surface-600',
                  )}
                  disabled={isRunning}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Styles, Objectives, Formats */}
          <div className="card p-4 space-y-4">
            <MultiSelectGroup
              label="Learning Styles"
              options={STYLE_OPTIONS}
              selected={styles}
              onChange={setStyles}
            />
            <MultiSelectGroup
              label="Objectives"
              options={OBJECTIVE_OPTIONS}
              selected={objectives}
              onChange={setObjectives}
            />
            <MultiSelectGroup
              label="Output Formats"
              options={FORMAT_OPTIONS}
              selected={formats}
              onChange={setFormats}
            />
          </div>

          {/* Mode, Difficulty, Count */}
          <div className="card p-4 space-y-4">
            <div>
              <p className="text-xs font-medium text-surface-300 uppercase tracking-wide mb-2">Generation Mode</p>
              <div className="space-y-2">
                {MODE_OPTIONS.map(m => (
                  <label key={m.value} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      value={m.value}
                      checked={mode === m.value}
                      onChange={() => setMode(m.value)}
                      disabled={isRunning}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium text-white">{m.label}</span>
                      <p className="text-xs text-surface-400">{m.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-surface-300 uppercase tracking-wide mb-2">Difficulty</p>
                <select
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value as PersonaBatchSpec['difficulty'])}
                  disabled={isRunning}
                  className="w-full bg-surface-700 text-white rounded-lg px-3 py-2 text-sm"
                >
                  {['easy', 'medium', 'hard', 'mixed'].map(d => (
                    <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs font-medium text-surface-300 uppercase tracking-wide mb-2">MCQ Count</p>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={itemCount}
                  onChange={e => setItemCount(Number(e.target.value))}
                  disabled={isRunning}
                  className="w-full bg-surface-700 text-white rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Preview + Controls */}
        <div className="space-y-4">

          {/* Expansion Preview */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary-400" />
              <p className="text-sm font-semibold text-white">Expansion Preview</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-surface-300">
                <span>Topics</span>
                <span className="font-mono text-white">{topics.length}</span>
              </div>
              <div className="flex justify-between text-surface-300">
                <span>Styles</span>
                <span className="font-mono text-white">{styles.length}</span>
              </div>
              <div className="flex justify-between text-surface-300">
                <span>Objectives</span>
                <span className="font-mono text-white">{objectives.length}</span>
              </div>
              <div className="flex justify-between text-surface-300">
                <span>Formats</span>
                <span className="font-mono text-white">{formats.length}</span>
              </div>
              <div className="flex justify-between text-surface-300">
                <span>Skipped combos</span>
                <span className="font-mono text-yellow-400">{skipped}</span>
              </div>
              <div className="border-t border-surface-600 pt-2 flex justify-between font-semibold">
                <span className="text-surface-200">Total requests</span>
                <span className="font-mono text-primary-400 text-lg">{totalRequests}</span>
              </div>
            </div>

            {skipped > 0 && (
              <div className="flex items-start gap-2 text-xs text-yellow-400 bg-yellow-400/10 rounded-lg p-2">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{skipped} invalid objective×format combinations were filtered out automatically.</span>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isRunning || totalRequests === 0}
            className={clsx(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all',
              isRunning || totalRequests === 0
                ? 'bg-surface-700 text-surface-500 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-600/20',
            )}
          >
            {isRunning ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {phase === 'scraping' ? 'Scraping...' : 'Generating...'}</>
            ) : (
              <><Play className="w-4 h-4" /> Generate {totalRequests > 0 ? `${totalRequests} Requests` : ''}</>
            )}
          </button>

          {/* Progress Bar */}
          <AnimatePresence>
            {isRunning && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                <div className="flex justify-between text-xs text-surface-400">
                  <span className="capitalize">{phase}</span>
                  <span>{progress.done} / {progress.total} ({pct}%)</span>
                </div>
                <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ ease: 'linear', duration: 0.3 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2 text-xs text-red-400 bg-red-400/10 rounded-lg p-3"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result Summary */}
          <AnimatePresence>
            {result && phase === 'done' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-4 space-y-3"
              >
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-semibold">Batch Complete</span>
                </div>
                <div className="space-y-1 text-xs text-surface-300">
                  <div className="flex justify-between">
                    <span>Succeeded</span>
                    <span className="text-green-400 font-mono">{result.succeeded}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Failed</span>
                    <span className={clsx('font-mono', result.failed > 0 ? 'text-red-400' : 'text-surface-400')}>
                      {result.failed}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg quality</span>
                    <span className="text-primary-400 font-mono">
                      {result.outputs.length > 0
                        ? `${Math.round(result.outputs.reduce((s, o) => s + o.qualityScore, 0) / result.outputs.length * 100)}%`
                        : '—'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleExport}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-white text-xs font-medium transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export JSON
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Request List */}
      {requests.length > 0 && (
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowRequests(v => !v)}
            className="w-full flex items-center justify-between p-4 text-sm font-medium text-white hover:bg-surface-700/50 transition-colors"
          >
            <span>Request Details ({requests.length})</span>
            {showRequests ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <AnimatePresence>
            {showRequests && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-surface-700 divide-y divide-surface-700/50 max-h-96 overflow-y-auto">
                  {requests.map(req => (
                    <div key={req.id} className="px-4 py-2.5 flex items-center justify-between gap-4 text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="text-surface-200 font-medium truncate">
                          {req.personaContext.topic}
                        </p>
                        <p className="text-surface-400 truncate">
                          {req.personaContext.learningStyle} · {req.personaContext.objective} · {req.personaContext.format}
                        </p>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default BatchGenerationPanel;
