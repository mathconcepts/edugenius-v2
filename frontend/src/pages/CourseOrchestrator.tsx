/**
 * CourseOrchestrator.tsx — CEO Dashboard for the Master Course Orchestrator
 *
 * 4 tabs:
 *   1. 🎯 Live Decisions
 *   2. 📚 Content Library
 *   3. 🔗 Agent Connections
 *   4. ⚙️ Orchestration Rules
 *
 * Route: /course-orchestrator (CEO only)
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, BookOpen, Link2, Settings2, Play, RefreshCw, CheckCircle2,
  AlertTriangle, XCircle, Zap, ChevronRight, Eye, User, Brain,
  BarChart3, Clock, Layers, Send, Filter,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  orchestrateSession,
  buildLearnerProfile,
  selectLearningObjective,
  decideContent,
  inferExamPhase,
  getDecisionHistory,
  getAgentSignalStatuses,
  getOrchestratorRules,
  saveOrchestratorRules,
  recordOutcome,
  type OrchestratorDecision,
  type LearnerProfile,
  type LearnerRole,
  type ExamPhase,
  type LearningObjectiveType,
  type ContentMode,
  type DeliveryChannel,
  type AgentSignalStatus,
  type OrchestratorRules,
} from '@/services/courseOrchestrator';
import {
  getAllStaticAtoms,
  getStaticAtomsForTopic,
  getCoveredTopics,
  getSupportedExams,
  getAtomCount,
  type StaticContentAtom,
} from '@/services/staticContentLibrary';
import { auditContentSync } from '@/services/contentSyncService';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'decisions',   label: 'Live Decisions',   icon: Target    },
  { id: 'library',     label: 'Content Library',  icon: BookOpen  },
  { id: 'connections', label: 'Agent Connections', icon: Link2     },
  { id: 'rules',       label: 'Rules',             icon: Settings2 },
] as const;

type TabId = typeof TABS[number]['id'];

const EXAM_OPTIONS = ['GATE_EM', 'JEE', 'CAT', 'NEET', 'UPSC'];

const PHASE_LABELS: Record<ExamPhase, string> = {
  discovery:  '🌱 Discovery (>180d)',
  foundation: '🏗️ Foundation (90–180d)',
  structured: '📐 Structured (45–90d)',
  intensive:  '⚡ Intensive (21–45d)',
  sprint:     '🏃 Sprint (7–21d)',
  exam_week:  '🎯 Exam Week (<7d)',
  post_exam:  '🎉 Post-Exam',
};

const OBJECTIVE_LABELS: Record<LearningObjectiveType, string> = {
  introduce_concept:    '🆕 Introduce Concept',
  deepen_understanding: '📖 Deepen Understanding',
  fix_misconception:    '🔧 Fix Misconception',
  build_speed:          '⚡ Build Speed',
  exam_pattern:         '📋 Exam Pattern',
  cross_connect:        '🕸️ Cross-Connect',
  revision:             '🔄 Revision',
  assess_readiness:     '✅ Assess Readiness',
};

const MODE_COLORS: Record<ContentMode, string> = {
  static_pyq:       'bg-blue-900/30 text-blue-300 border-blue-700',
  rag_retrieval:    'bg-purple-900/30 text-purple-300 border-purple-700',
  llm_generated:    'bg-orange-900/30 text-orange-300 border-orange-700',
  wolfram_verified: 'bg-green-900/30 text-green-300 border-green-700',
  rich_media:       'bg-pink-900/30 text-pink-300 border-pink-700',
};

// ─── Simulate Panel ───────────────────────────────────────────────────────────

interface SimulateConfig {
  examId: string;
  daysToExam: number;
  masteryPercent: number;
  role: LearnerRole;
  streakDays: number;
  cognitiveLoad: 'low' | 'medium' | 'high';
}

function buildSimulatedProfile(cfg: SimulateConfig): LearnerProfile {
  const examPhase = inferExamPhase(cfg.daysToExam);
  const score = cfg.masteryPercent / 100;

  const mockTopics = [
    { topicId: 'calculus', topicName: 'Calculus' },
    { topicId: 'linear_algebra', topicName: 'Linear Algebra' },
    { topicId: 'probability', topicName: 'Probability' },
    { topicId: 'complex_numbers', topicName: 'Complex Numbers' },
    { topicId: 'signals', topicName: 'Signals & Systems' },
  ].map((t, i) => ({
    ...t,
    masteryScore: Math.max(0, Math.min(1, score + (i * 0.05 - 0.1))),
    isMastered: score + (i * 0.05 - 0.1) >= 0.85,
    attemptCount: Math.floor(5 + i * 3),
    lastAttempted: Date.now() - i * 86400000,
    weakSubtopics: score < 0.5 ? ['subtopic-a', 'subtopic-b'] : [],
  }));

  const sorted = [...mockTopics].sort((a, b) => a.masteryScore - b.masteryScore);
  const quintile = Math.max(1, Math.ceil(sorted.length * 0.2));

  return {
    userId: 'sim-user',
    role: cfg.role,
    examId: cfg.examId,
    examPhase,
    daysToExam: cfg.daysToExam,
    learningStyle: 'mixed',
    cognitiveLoad: cfg.cognitiveLoad,
    streakDays: cfg.streakDays,
    sessionCount: 42,
    topicMastery: mockTopics,
    weakestTopics: sorted.slice(0, quintile).map(t => t.topicId),
    strongestTopics: sorted.slice(-quintile).map(t => t.topicId),
    nextReviewTopics: cfg.daysToExam < 30 ? ['calculus'] : [],
    preferredChannel: 'in_app_chat',
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium border', color)}>
      {label}
    </span>
  );
}

function SignalStatusDot({ status }: { status: 'live' | 'silent' | 'error' | 'unknown' }) {
  const colors = {
    live:    'bg-emerald-400',
    silent:  'bg-surface-500',
    error:   'bg-red-400',
    unknown: 'bg-yellow-400',
  };
  return <span className={clsx('inline-block w-2 h-2 rounded-full', colors[status])} />;
}

function DecisionCard({ decision }: { decision: OrchestratorDecision }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary-400" />
          <span className="text-sm font-medium text-surface-100">
            {OBJECTIVE_LABELS[decision.objective.type] ?? decision.objective.type}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            label={decision.learnerProfile.examPhase}
            color="bg-surface-700 text-surface-300 border-surface-600"
          />
          <Badge
            label={`T${decision.contentDecision.tierTarget}`}
            color={MODE_COLORS[decision.contentDecision.mode]}
          />
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-surface-400 hover:text-surface-200 transition-colors"
          >
            <ChevronRight className={clsx('w-4 h-4 transition-transform', expanded && 'rotate-90')} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-surface-500">Topic:</span>{' '}
          <span className="text-surface-200">{decision.objective.topicName}</span>
        </div>
        <div>
          <span className="text-surface-500">Agent:</span>{' '}
          <span className="text-surface-200 capitalize">{decision.contentDecision.agentId}</span>
        </div>
        <div>
          <span className="text-surface-500">Format:</span>{' '}
          <span className="text-surface-200">{decision.contentDecision.format}</span>
        </div>
        <div>
          <span className="text-surface-500">Channel:</span>{' '}
          <span className="text-surface-200">{decision.contentDecision.channel}</span>
        </div>
      </div>

      <p className="text-xs text-surface-400 italic">"{decision.objective.rationale}"</p>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 border-t border-surface-700 pt-3"
          >
            <div>
              <h4 className="text-xs font-semibold text-surface-400 mb-1">ADAPTATION HINTS</h4>
              <div className="space-y-1 text-xs text-surface-300">
                <p><span className="text-yellow-400">If confused:</span> {decision.adaptationHints.ifConfused}</p>
                <p><span className="text-orange-400">If bored:</span> {decision.adaptationHints.ifBored}</p>
                <p><span className="text-green-400">Next objective:</span> {decision.adaptationHints.nextObjective}</p>
              </div>
            </div>
            {decision.studentInsights && (
              <div>
                <h4 className="text-xs font-semibold text-surface-400 mb-1">STUDENT INSIGHTS</h4>
                <div className="space-y-1 text-xs text-surface-300">
                  <p><span className="text-red-400">Struggle:</span> {decision.studentInsights.topStruggle}</p>
                  <p><span className="text-green-400">Win:</span> {decision.studentInsights.recentWin}</p>
                  <p><span className="text-blue-400">Intervention:</span> {decision.studentInsights.suggestedIntervention}</p>
                </div>
              </div>
            )}
            <div>
              <h4 className="text-xs font-semibold text-surface-400 mb-1">PROMPT DIRECTIVES</h4>
              <div className="flex flex-wrap gap-1">
                {decision.contentDecision.promptDirectives.map(d => (
                  <span key={d} className="px-2 py-0.5 rounded bg-surface-700 text-surface-300 text-xs font-mono">{d}</span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-xs text-surface-600">
        {new Date(decision.timestamp).toLocaleTimeString()}
        {' · '}Est. {decision.objective.estimatedMinutes}min
        {' · '}{decision.contentDecision.estimatedTokens} tokens
      </p>
    </div>
  );
}

// ─── Tab 1: Live Decisions ────────────────────────────────────────────────────

function LiveDecisionsTab() {
  const [simConfig, setSimConfig] = useState<SimulateConfig>({
    examId: 'GATE_EM',
    daysToExam: 60,
    masteryPercent: 45,
    role: 'student',
    streakDays: 5,
    cognitiveLoad: 'medium',
  });
  const [currentDecision, setCurrentDecision] = useState<OrchestratorDecision | null>(null);
  const [history, setHistory] = useState<OrchestratorDecision[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    const hist = getDecisionHistory('sim-user', 10);
    setHistory(hist);
  }, []);

  const handleSimulate = useCallback(async () => {
    setIsSimulating(true);
    try {
      // Build simulated profile and run orchestrator
      const profile = buildSimulatedProfile(simConfig);
      const objective = selectLearningObjective(profile);
      const contentDecision = decideContent(profile, objective);

      const decision: OrchestratorDecision = {
        sessionId: `sim-${Date.now()}`,
        userId: 'sim-user',
        timestamp: Date.now(),
        learnerProfile: profile,
        objective,
        contentDecision,
        adaptationHints: {
          ifConfused: `Switch to worked example for ${objective.topicName}.`,
          ifBored: `Increase to hard difficulty.`,
          ifTooFast: `Jump to next subtopic.`,
          nextObjective: `After ${objective.type} → build_speed on ${objective.topicName}`,
        },
        signals: {},
      };

      setCurrentDecision(decision);
      setHistory(prev => [decision, ...prev].slice(0, 10));
    } finally {
      setIsSimulating(false);
    }
  }, [simConfig]);

  const handleLiveOrchestrate = useCallback(async () => {
    setIsSimulating(true);
    try {
      const decision = await orchestrateSession('live-user', simConfig.examId);
      setCurrentDecision(decision);
      setHistory(prev => [decision, ...prev].slice(0, 10));
    } finally {
      setIsSimulating(false);
    }
  }, [simConfig.examId]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Simulate Panel */}
      <div className="space-y-4">
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-surface-200 mb-4 flex items-center gap-2">
            <Play className="w-4 h-4 text-primary-400" />
            Simulate Decision
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Exam</label>
              <select
                value={simConfig.examId}
                onChange={e => setSimConfig(p => ({ ...p, examId: e.target.value }))}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100"
              >
                {EXAM_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-surface-400 mb-1 block">Role</label>
              <select
                value={simConfig.role}
                onChange={e => setSimConfig(p => ({ ...p, role: e.target.value as LearnerRole }))}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100"
              >
                {(['student', 'teacher', 'parent', 'self_learner', 'coach'] as LearnerRole[]).map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-surface-400 mb-1 block">Days to Exam: {simConfig.daysToExam}</label>
              <input
                type="range" min={0} max={365} step={5}
                value={simConfig.daysToExam}
                onChange={e => setSimConfig(p => ({ ...p, daysToExam: Number(e.target.value) }))}
                className="w-full accent-primary-500"
              />
              <p className="text-xs text-primary-400 mt-0.5">{PHASE_LABELS[inferExamPhase(simConfig.daysToExam)]}</p>
            </div>

            <div>
              <label className="text-xs text-surface-400 mb-1 block">Avg Mastery: {simConfig.masteryPercent}%</label>
              <input
                type="range" min={0} max={100} step={5}
                value={simConfig.masteryPercent}
                onChange={e => setSimConfig(p => ({ ...p, masteryPercent: Number(e.target.value) }))}
                className="w-full accent-primary-500"
              />
            </div>

            <div>
              <label className="text-xs text-surface-400 mb-1 block">Streak Days</label>
              <input
                type="number" min={0} max={365}
                value={simConfig.streakDays}
                onChange={e => setSimConfig(p => ({ ...p, streakDays: Number(e.target.value) }))}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100"
              />
            </div>

            <div>
              <label className="text-xs text-surface-400 mb-1 block">Cognitive Load</label>
              <select
                value={simConfig.cognitiveLoad}
                onChange={e => setSimConfig(p => ({ ...p, cognitiveLoad: e.target.value as 'low' | 'medium' | 'high' }))}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSimulate}
              disabled={isSimulating}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isSimulating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Simulate
            </button>
            <button
              onClick={handleLiveOrchestrate}
              disabled={isSimulating}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              Run Live
            </button>
          </div>
        </div>

        {/* Current Decision */}
        {currentDecision && (
          <div>
            <h3 className="text-xs font-semibold text-surface-400 mb-2">LATEST DECISION</h3>
            <DecisionCard decision={currentDecision} />
          </div>
        )}
      </div>

      {/* Decision History */}
      <div>
        <h3 className="text-xs font-semibold text-surface-400 mb-3 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          DECISION HISTORY (last 10)
        </h3>
        {history.length === 0 ? (
          <div className="text-center text-surface-500 py-12">
            <Brain className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No decisions yet — run a simulation to see results here.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {history.map(d => (
              <DecisionCard key={d.sessionId} decision={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab 2: Content Library ───────────────────────────────────────────────────

function ContentLibraryTab() {
  const [selectedExam, setSelectedExam] = useState('GATE_EM');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [previewAtom, setPreviewAtom] = useState<StaticContentAtom | null>(null);
  const [filterFormat, setFilterFormat] = useState<string>('all');

  const allAtoms = getAllStaticAtoms(selectedExam);
  const coveredTopics = getCoveredTopics(selectedExam);
  const allExams = getSupportedExams();

  const topicAtoms = selectedTopic
    ? getStaticAtomsForTopic(selectedExam, selectedTopic)
    : allAtoms;

  const filtered = filterFormat === 'all'
    ? topicAtoms
    : topicAtoms.filter(a => a.format === filterFormat);

  const assignAtom = (atom: StaticContentAtom) => {
    localStorage.setItem('orchestrator:atlas_task', JSON.stringify({
      action: 'assign_static_atom',
      atomId: atom.id,
      examId: atom.examId,
      topicId: atom.topicId,
      format: atom.format,
      timestamp: Date.now(),
    }));
    alert(`Atom "${atom.id}" assigned to Atlas queue.`);
  };

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Atoms', value: getAtomCount(), icon: Layers, color: 'text-primary-400' },
          { label: 'Exams Covered', value: allExams.length, icon: Target, color: 'text-emerald-400' },
          { label: `${selectedExam} Topics`, value: coveredTopics.length, icon: BookOpen, color: 'text-orange-400' },
          { label: 'Filtered', value: filtered.length, icon: Filter, color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-surface-800 border border-surface-700 rounded-lg p-3 flex items-center gap-3">
            <s.icon className={clsx('w-5 h-5 shrink-0', s.color)} />
            <div>
              <p className="text-lg font-bold text-surface-100">{s.value}</p>
              <p className="text-xs text-surface-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={selectedExam}
          onChange={e => { setSelectedExam(e.target.value); setSelectedTopic(null); }}
          className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-surface-100"
        >
          {allExams.map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        <select
          value={selectedTopic ?? 'all'}
          onChange={e => setSelectedTopic(e.target.value === 'all' ? null : e.target.value)}
          className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-surface-100"
        >
          <option value="all">All Topics</option>
          {coveredTopics.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={filterFormat}
          onChange={e => setFilterFormat(e.target.value)}
          className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-surface-100"
        >
          <option value="all">All Formats</option>
          <option value="revision_card">Revision Cards</option>
          <option value="formula_sheet">Formula Sheets</option>
          <option value="worked_example">Worked Examples</option>
          <option value="explanation">Explanations</option>
        </select>
      </div>

      {/* Atom grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(atom => (
          <div
            key={atom.id}
            className="bg-surface-800 border border-surface-700 rounded-lg p-4 space-y-2 hover:border-surface-500 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-surface-100">{atom.topicName}</p>
                <p className="text-xs text-surface-400 font-mono">{atom.id}</p>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <Badge
                  label={atom.format.replace('_', ' ')}
                  color="bg-surface-700 text-surface-300 border-surface-600"
                />
                <Badge
                  label={atom.difficulty}
                  color={
                    atom.difficulty === 'easy' ? 'bg-green-900/30 text-green-300 border-green-700' :
                    atom.difficulty === 'hard' ? 'bg-red-900/30 text-red-300 border-red-700' :
                    'bg-yellow-900/30 text-yellow-300 border-yellow-700'
                  }
                />
              </div>
            </div>

            <p className="text-xs text-surface-400 line-clamp-2">{atom.content.slice(0, 120)}...</p>

            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {atom.tags.slice(0, 2).map(t => (
                  <span key={t} className="px-1.5 py-0.5 bg-surface-700 rounded text-xs text-surface-400">{t}</span>
                ))}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setPreviewAtom(previewAtom?.id === atom.id ? null : atom)}
                  className="p-1.5 rounded-lg bg-surface-700 hover:bg-surface-600 text-surface-300 transition-colors"
                  title="Preview"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => assignAtom(atom)}
                  className="p-1.5 rounded-lg bg-primary-700 hover:bg-primary-600 text-white transition-colors"
                  title="Assign to student"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Preview */}
            <AnimatePresence>
              {previewAtom?.id === atom.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-surface-700 pt-3 mt-2"
                >
                  <pre className="text-xs text-surface-300 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                    {atom.content}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Coverage map */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-surface-200 mb-3">Coverage Map — {selectedExam}</h3>
        <div className="flex flex-wrap gap-2">
          {coveredTopics.map(topic => {
            const count = getStaticAtomsForTopic(selectedExam, topic).length;
            return (
              <button
                key={topic}
                onClick={() => setSelectedTopic(topic === selectedTopic ? null : topic)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  topic === selectedTopic
                    ? 'bg-primary-600 text-white border-primary-500'
                    : 'bg-surface-700 text-surface-300 border-surface-600 hover:border-surface-400'
                )}
              >
                {topic} ({count})
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: Agent Connections ─────────────────────────────────

function AgentConnectionsTab() {
  const [statuses, setStatuses] = useState<AgentSignalStatus[]>([]);
  const [syncHealth, setSyncHealth] = useState<ReturnType<typeof auditContentSync> | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    setStatuses(getAgentSignalStatuses());
    setSyncHealth(auditContentSync());
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  const testSignal = (agentId: string) => {
    const key = `orchestrator:${agentId}_test`;
    localStorage.setItem(key, JSON.stringify({ test: true, timestamp: Date.now() }));
    setTimeout(refresh, 500);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-surface-200">Orchestrator ↔ Agent Signal Bus</h3>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-700 hover:bg-surface-600 rounded-lg text-xs text-surface-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {lastRefresh && (
        <p className="text-xs text-surface-500">Last refreshed: {lastRefresh.toLocaleTimeString()}</p>
      )}

      {/* Agent signal table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-700 text-left">
              <th className="pb-2 text-xs text-surface-400 font-medium">Agent</th>
              <th className="pb-2 text-xs text-surface-400 font-medium">Outbound Signal</th>
              <th className="pb-2 text-xs text-surface-400 font-medium">Out Status</th>
              <th className="pb-2 text-xs text-surface-400 font-medium">Inbound Signal</th>
              <th className="pb-2 text-xs text-surface-400 font-medium">In Status</th>
              <th className="pb-2 text-xs text-surface-400 font-medium">Last Out</th>
              <th className="pb-2 text-xs text-surface-400 font-medium">Test</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-700/50">
            {statuses.map(s => (
              <tr key={s.agentId} className="hover:bg-surface-800/50 transition-colors">
                <td className="py-3 pr-4">
                  <span className="font-medium text-surface-100 capitalize">{s.agentId}</span>
                </td>
                <td className="py-3 pr-4">
                  <code className="text-xs bg-surface-700 px-2 py-0.5 rounded text-primary-300">
                    {s.outboundKey}
                  </code>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-1.5">
                    <SignalStatusDot status={s.outboundStatus} />
                    <span className={clsx('text-xs', s.outboundStatus === 'live' ? 'text-emerald-400' : 'text-surface-500')}>
                      {s.outboundStatus}
                    </span>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  {s.inboundKey ? (
                    <code className="text-xs bg-surface-700 px-2 py-0.5 rounded text-purple-300">
                      {s.inboundKey}
                    </code>
                  ) : (
                    <span className="text-xs text-surface-600">—</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-1.5">
                    <SignalStatusDot status={s.inboundStatus as 'live' | 'silent' | 'error' | 'unknown'} />
                    <span className="text-xs text-surface-500">{s.inboundStatus}</span>
                  </div>
                </td>
                <td className="py-3 pr-4 text-xs text-surface-500">
                  {s.lastOutboundTs
                    ? `${Math.round((Date.now() - s.lastOutboundTs) / 1000)}s ago`
                    : '—'}
                </td>
                <td className="py-3">
                  <button
                    onClick={() => testSignal(s.agentId)}
                    className="px-2 py-1 bg-surface-700 hover:bg-surface-600 rounded text-xs text-surface-300 transition-colors"
                  >
                    Test →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Content Sync Health */}
      {syncHealth && (
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-surface-200">Content Sync Health</h3>
            <Badge
              label={syncHealth.overallHealth}
              color={
                syncHealth.overallHealth === 'healthy' ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700' :
                syncHealth.overallHealth === 'degraded' ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700' :
                'bg-red-900/30 text-red-300 border-red-700'
              }
            />
          </div>
          <div className="grid grid-cols-4 gap-3 text-center text-xs">
            {[
              { label: 'Live', value: syncHealth.liveCount, color: 'text-emerald-400' },
              { label: 'Degraded', value: syncHealth.degradedCount, color: 'text-yellow-400' },
              { label: 'Broken', value: syncHealth.brokenCount, color: 'text-red-400' },
              { label: 'Unconfigured', value: syncHealth.unconfiguredCount, color: 'text-surface-400' },
            ].map(s => (
              <div key={s.label} className="bg-surface-700 rounded-lg p-2">
                <p className={clsx('text-xl font-bold', s.color)}>{s.value}</p>
                <p className="text-surface-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signal legend */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-surface-400 mb-3">SIGNAL DIRECTIONS</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {[
            { from: 'Orchestrator', to: 'Sage', key: 'orchestrator:sage_directive', desc: 'Prompt injection with objective + topic focus' },
            { from: 'Sage', to: 'Orchestrator', key: 'sage:session_outcome', desc: 'Session result (correct/incorrect, time spent)' },
            { from: 'Orchestrator', to: 'Atlas', key: 'orchestrator:atlas_task', desc: 'Content generation request (format + difficulty)' },
            { from: 'Atlas', to: 'Orchestrator', key: 'atlas:content_ready', desc: 'Signals when content batch is available' },
            { from: 'Orchestrator', to: 'Mentor', key: 'orchestrator:mentor_nudge', desc: 'Engagement nudge with cognitive load signal' },
            { from: 'Mentor', to: 'Orchestrator', key: 'mentor:engagement_signal', desc: 'Student fatigue / engagement state' },
            { from: 'Orchestrator', to: 'Oracle', key: 'orchestrator:oracle_event', desc: 'Decision analytics event for tracking' },
            { from: 'Oracle', to: 'Orchestrator', key: 'oracle:mastery_update', desc: 'Updated mastery scores from BKT model' },
            { from: 'Orchestrator', to: 'Scout', key: 'orchestrator:scout_priority', desc: 'Topic priority for content intelligence' },
          ].map(sig => (
            <div key={sig.key} className="flex items-start gap-2 p-2 bg-surface-700 rounded-lg">
              <ChevronRight className="w-3.5 h-3.5 text-surface-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-surface-200">
                  <span className="text-primary-400">{sig.from}</span>
                  {' → '}
                  <span className="text-emerald-400">{sig.to}</span>
                </p>
                <code className="text-surface-500 font-mono">{sig.key}</code>
                <p className="text-surface-500 mt-0.5">{sig.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 4: Orchestration Rules ───────────────────────────────────────────────

function OrchestrationRulesTab() {
  const [rules, setRules] = useState<OrchestratorRules>(() => getOrchestratorRules());
  const [saved, setSaved] = useState(false);

  const updateThreshold = (key: keyof OrchestratorRules['phaseThresholds'], value: number) => {
    setRules(prev => ({
      ...prev,
      phaseThresholds: { ...prev.phaseThresholds, [key]: value },
    }));
    setSaved(false);
  };

  const updateRoleOverride = (role: LearnerRole, enabled: boolean) => {
    setRules(prev => ({
      ...prev,
      roleOverridesEnabled: { ...prev.roleOverridesEnabled, [role]: enabled },
    }));
    setSaved(false);
  };

  const handleSave = () => {
    saveOrchestratorRules(rules);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const phaseOrder: Array<{ key: keyof OrchestratorRules['phaseThresholds']; label: string; phase: ExamPhase }> = [
    { key: 'discoveryMin', label: 'Discovery threshold (days)', phase: 'discovery' },
    { key: 'foundationMin', label: 'Foundation threshold (days)', phase: 'foundation' },
    { key: 'structuredMin', label: 'Structured threshold (days)', phase: 'structured' },
    { key: 'intensiveMin', label: 'Intensive threshold (days)', phase: 'intensive' },
    { key: 'sprintMin', label: 'Sprint threshold (days)', phase: 'sprint' },
    { key: 'examWeekMin', label: 'Exam Week threshold (days)', phase: 'exam_week' },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Phase Thresholds */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-surface-200 mb-4">Phase Thresholds</h3>
        <p className="text-xs text-surface-400 mb-4">Days remaining → exam phase mapping. A student with N days left will be in the highest phase where N &gt; threshold.</p>
        <div className="space-y-4">
          {phaseOrder.map(p => (
            <div key={p.key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-surface-300">{p.label}</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-primary-400">{PHASE_LABELS[p.phase]}</span>
                  <input
                    type="number"
                    value={rules.phaseThresholds[p.key]}
                    onChange={e => updateThreshold(p.key, Number(e.target.value))}
                    className="w-16 bg-surface-700 border border-surface-600 rounded px-2 py-1 text-xs text-surface-100 text-right"
                  />
                </div>
              </div>
              <input
                type="range" min={0} max={365} step={5}
                value={rules.phaseThresholds[p.key]}
                onChange={e => updateThreshold(p.key, Number(e.target.value))}
                className="w-full accent-primary-500"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Role Override Toggles */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-surface-200 mb-4">Role Override Toggles</h3>
        <p className="text-xs text-surface-400 mb-4">When enabled, role-specific overrides change objective, channel, and agent for non-student roles.</p>
        <div className="space-y-3">
          {(Object.entries(rules.roleOverridesEnabled) as Array<[LearnerRole, boolean]>).map(([role, enabled]) => (
            <div key={role} className="flex items-center justify-between">
              <div>
                <p className="text-sm text-surface-200 capitalize">{role.replace('_', ' ')}</p>
                <p className="text-xs text-surface-500">
                  {role === 'teacher' && 'Overrides to assess_readiness + oracle agent + content_feed channel'}
                  {role === 'parent' && 'Overrides to revision_card format + whatsapp/email channel'}
                  {role === 'self_learner' && 'Overrides to cross_connect objective + llm_generated mode'}
                  {role === 'coach' && 'Overrides to assess_readiness + oracle agent'}
                  {role === 'student' && 'Default behaviour — no overrides'}
                </p>
              </div>
              <button
                onClick={() => updateRoleOverride(role, !enabled)}
                className={clsx(
                  'relative inline-flex h-5 w-10 items-center rounded-full transition-colors',
                  enabled ? 'bg-primary-600' : 'bg-surface-600'
                )}
              >
                <span className={clsx(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  enabled ? 'translate-x-5' : 'translate-x-1'
                )} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Auto-sync interval */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-surface-200 mb-3">Auto-sync Interval</h3>
        <div className="flex items-center gap-3">
          <input
            type="range" min={5000} max={120000} step={5000}
            value={rules.autoSyncIntervalMs}
            onChange={e => {
              setRules(prev => ({ ...prev, autoSyncIntervalMs: Number(e.target.value) }));
              setSaved(false);
            }}
            className="flex-1 accent-primary-500"
          />
          <span className="text-sm text-surface-200 w-20 text-right">
            {(rules.autoSyncIntervalMs / 1000).toFixed(0)}s
          </span>
        </div>
        <p className="text-xs text-surface-500 mt-1">How often the orchestrator state syncs to connected agents.</p>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        className={clsx(
          'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
          saved
            ? 'bg-emerald-700 text-white'
            : 'bg-primary-600 hover:bg-primary-700 text-white'
        )}
      >
        {saved ? <CheckCircle2 className="w-4 h-4" /> : <Settings2 className="w-4 h-4" />}
        {saved ? 'Saved!' : 'Save Rules'}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CourseOrchestrator() {
  const [activeTab, setActiveTab] = useState<TabId>('decisions');

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-50 flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary-400" />
            Course Engine
          </h1>
          <p className="text-sm text-surface-400 mt-1">
            Master orchestrator — decides what every learner studies, when, how, and at what depth.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/30 border border-emerald-700 rounded-lg">
            <SignalStatusDot status="live" />
            <span className="text-xs text-emerald-300 font-medium">Orchestrator Active</span>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-surface-700 pb-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-surface-400 hover:text-surface-200'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === 'decisions'   && <LiveDecisionsTab />}
          {activeTab === 'library'     && <ContentLibraryTab />}
          {activeTab === 'connections' && <AgentConnectionsTab />}
          {activeTab === 'rules'       && <OrchestrationRulesTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
