/**
 * Smart Notebook — Syllabus-Aware Ready Reckoner
 *
 * Five views, one source of truth:
 *  1. Syllabus Map       — exam/subject/chapter/topic coverage tracker
 *  2. Problem Clusters   — all practiced problems grouped by topic
 *  3. Formula Registry   — quick-look formulas per topic/chapter
 *  4. My Notes           — free-form topic-linked notes
 *  5. Revision Queue     — spaced-repetition due items + uncovered high-yield alert
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Target, CheckCircle, XCircle, Clock, ChevronRight,
  ChevronDown, Star, Flag, BookMarked, PenLine, RotateCcw,
  Zap, Filter, Search, Plus, AlertTriangle, TrendingUp,
  BarChart2, Layers, FileText, Award, Edit3, Trash2, Bookmark,
  ArrowRight, Circle, CheckSquare, Lock,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  type ExamScope, type SyllabusTopic, type ProblemEntry, type NoteEntry,
  type NotebookState, type CoverageStatus,
  SYLLABUS_MAP, FORMULA_REGISTRY,
  loadNotebookState, saveNotebookState,
  getAllTopics, getCoverageSummary, getDueRevisions,
  addProblem, addNote, markTopicCovered, applySpacedRepetition, seedDemoProblems,
} from '@/services/notebookEngine';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAMS: ExamScope[] = ['JEE Main', 'JEE Adv', 'NEET', 'CBSE 12', 'CAT', 'UPSC', 'GATE'];

const COVERAGE_COLORS: Record<CoverageStatus, string> = {
  covered:         'text-green-400 bg-green-900/20 border-green-500/30',
  partial:         'text-yellow-400 bg-yellow-900/20 border-yellow-500/30',
  uncovered:       'text-surface-400 bg-surface-800/50 border-surface-600/30',
  'needs-revision':'text-orange-400 bg-orange-900/20 border-orange-500/30',
};

const COVERAGE_ICONS: Record<CoverageStatus, React.FC<{className?: string}>> = {
  covered:          CheckCircle,
  partial:          Clock,
  uncovered:        Circle,
  'needs-revision': AlertTriangle,
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy:   'text-green-400 bg-green-900/20',
  medium: 'text-yellow-400 bg-yellow-900/20',
  hard:   'text-red-400 bg-red-900/20',
};

type Tab = 'syllabus' | 'problems' | 'formulas' | 'notes' | 'revision';

// ─── Sub-components ───────────────────────────────────────────────────────────

function CoverageBar({ percent, className }: { percent: number; className?: string }) {
  return (
    <div className={clsx('h-2 bg-surface-700 rounded-full overflow-hidden', className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={clsx('h-full rounded-full', percent >= 70 ? 'bg-green-500' : percent >= 40 ? 'bg-yellow-500' : 'bg-red-500')}
      />
    </div>
  );
}

function Badge({ label, className }: { label: string; className?: string }) {
  return <span className={clsx('px-2 py-0.5 text-xs rounded-full font-medium', className)}>{label}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Notebook() {
  const [exam, setExam] = useState<ExamScope>('JEE Main');
  const [state, setState] = useState<NotebookState>(() => {
    const s = loadNotebookState('JEE Main');
    // Seed demo data on first visit
    if (s.problems.length === 0 && s.notes.length === 0) return seedDemoProblems(s);
    return s;
  });
  const [tab, setTab] = useState<Tab>('syllabus');
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [showAddProblem, setShowAddProblem] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<SyllabusTopic | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  // Persist on change
  useEffect(() => { saveNotebookState(state); }, [state]);

  // Switch exam
  const switchExam = useCallback((e: ExamScope) => {
    setExam(e);
    const s = loadNotebookState(e);
    setState(s.problems.length === 0 && s.notes.length === 0 && e === 'JEE Main' ? seedDemoProblems(s) : s);
    setSubjectFilter('All');
    setExpandedChapters(new Set());
    setSelectedTopic(null);
  }, []);

  const summary = useMemo(() => getCoverageSummary(exam, state.coverage), [exam, state.coverage]);
  const subjects = useMemo(() => (SYLLABUS_MAP[exam] ?? []).map(s => s.name), [exam]);
  const dueRevisions = useMemo(() => getDueRevisions(state), [state]);
  const examFormulas = useMemo(() => FORMULA_REGISTRY.filter(f => f.exam.includes(exam)), [exam]);

  const toggleChapter = (id: string) => setExpandedChapters(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const setCoverage = (topicId: string, status: CoverageStatus) => {
    setState(s => ({ ...s, coverage: { ...s.coverage, [topicId]: status } }));
  };

  // ── Tabs ──────────────────────────────────────────────────────────────────

  const TABS: { id: Tab; icon: React.FC<{className?: string}>; label: string; badge?: number }[] = [
    { id: 'syllabus',  icon: Layers,    label: 'Syllabus Map' },
    { id: 'problems',  icon: Target,    label: 'Problem Bank', badge: state.problems.length },
    { id: 'formulas',  icon: Zap,       label: 'Formulas',     badge: examFormulas.length },
    { id: 'notes',     icon: PenLine,   label: 'My Notes',     badge: state.notes.length },
    { id: 'revision',  icon: RotateCcw, label: 'Revision',     badge: dueRevisions.length || undefined },
  ];

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📓</span>
          <div>
            <h1 className="text-xl font-bold text-white">Smart Notebook</h1>
            <p className="text-xs text-surface-400">{summary.coveragePercent}% syllabus covered · {state.problems.length} problems · {dueRevisions.length} due for revision</p>
          </div>
        </div>
        {/* Exam selector */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {EXAMS.map(e => (
            <button
              key={e}
              onClick={() => switchExam(e)}
              className={clsx('px-3 py-1.5 text-xs rounded-lg font-medium transition-colors', exam === e ? 'bg-primary-600 text-white' : 'bg-surface-700 text-surface-300 hover:bg-surface-600')}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Coverage bar */}
      <div className="card p-3 mb-3 flex-shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="flex justify-between text-xs text-surface-400 mb-1">
              <span>Overall Coverage</span>
              <span className="text-white font-medium">{summary.coveragePercent}%</span>
            </div>
            <CoverageBar percent={summary.coveragePercent} />
          </div>
          <div className="flex gap-4 text-xs flex-wrap">
            {[
              { label: 'Covered', val: summary.covered, color: 'text-green-400' },
              { label: 'Partial', val: summary.partial, color: 'text-yellow-400' },
              { label: 'Uncovered', val: summary.uncovered, color: 'text-surface-400' },
              { label: 'Revise', val: summary.needsRevision, color: 'text-orange-400' },
            ].map(x => (
              <div key={x.label} className="text-center">
                <div className={clsx('font-bold text-base', x.color)}>{x.val}</div>
                <div className="text-surface-500">{x.label}</div>
              </div>
            ))}
            <div className="text-center">
              <div className="font-bold text-base text-white">{summary.total}</div>
              <div className="text-surface-500">Topics</div>
            </div>
          </div>
        </div>
        {summary.highYieldUncovered.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs text-orange-400 bg-orange-900/10 border border-orange-500/20 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
            <span>⚡ High-yield uncovered: {summary.highYieldUncovered.slice(0,3).map(t => t.name).join(', ')}{summary.highYieldUncovered.length > 3 ? ` +${summary.highYieldUncovered.length - 3} more` : ''}</span>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-3 flex-shrink-0 bg-surface-800 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx('flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-colors', tab === t.id ? 'bg-primary-600 text-white' : 'text-surface-400 hover:text-white')}
          >
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
            {t.badge != null && t.badge > 0 && (
              <span className={clsx('text-[10px] rounded-full px-1.5 py-0.5 font-bold', tab === t.id ? 'bg-white/20 text-white' : 'bg-surface-700 text-surface-300')}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="h-full overflow-y-auto">

            {/* ── TAB 1: SYLLABUS MAP ───────────────────────────────────── */}
            {tab === 'syllabus' && (
              <div className="space-y-2 pb-4">
                {/* Subject filter */}
                <div className="flex gap-2 flex-wrap">
                  {['All', ...subjects].map(s => (
                    <button key={s} onClick={() => setSubjectFilter(s)} className={clsx('px-3 py-1 text-xs rounded-lg', subjectFilter === s ? 'bg-primary-600 text-white' : 'bg-surface-700 text-surface-300 hover:bg-surface-600')}>
                      {s}
                    </button>
                  ))}
                </div>

                {(SYLLABUS_MAP[exam] ?? [])
                  .filter(subj => subjectFilter === 'All' || subj.name === subjectFilter)
                  .map(subj => {
                    const subjectTopics = subj.chapters.flatMap(c => c.topics);
                    const covered = subjectTopics.filter(t => (state.coverage[t.id] ?? 'uncovered') === 'covered').length;
                    const pct = Math.round((covered / subjectTopics.length) * 100);
                    return (
                      <div key={subj.name} className="card">
                        <div className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{subj.name}</span>
                            <Badge label={`${pct}%`} className={pct >= 70 ? 'text-green-400 bg-green-900/30' : pct >= 40 ? 'text-yellow-400 bg-yellow-900/30' : 'text-surface-400 bg-surface-700'} />
                          </div>
                          <CoverageBar percent={pct} className="w-32" />
                        </div>
                        {subj.chapters.map(chapter => {
                          const chTopics = chapter.topics;
                          const chCovered = chTopics.filter(t => state.coverage[t.id] === 'covered').length;
                          const isOpen = expandedChapters.has(chapter.id);
                          return (
                            <div key={chapter.id} className="border-t border-surface-700">
                              <button
                                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-700/50 transition-colors"
                                onClick={() => toggleChapter(chapter.id)}
                              >
                                <div className="flex items-center gap-2">
                                  {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-surface-400" /> : <ChevronRight className="w-3.5 h-3.5 text-surface-400" />}
                                  <span className="text-sm text-surface-200">{chapter.name}</span>
                                  <span className="text-xs text-surface-500">{chCovered}/{chTopics.length} topics</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {chTopics.some(t => t.meta.isHighYield) && <Badge label="⚡ High Yield" className="text-yellow-400 bg-yellow-900/20" />}
                                  <CoverageBar percent={Math.round((chCovered / chTopics.length) * 100)} className="w-20" />
                                </div>
                              </button>

                              <AnimatePresence>
                                {isOpen && (
                                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                    <div className="px-4 pb-3 space-y-2">
                                      {chTopics
                                        .filter(top => !search || top.name.toLowerCase().includes(search.toLowerCase()))
                                        .map(topic => {
                                          const coverage = state.coverage[topic.id] ?? 'uncovered';
                                          const Icon = COVERAGE_ICONS[coverage];
                                          const problems = state.problems.filter(p => p.topicId === topic.id);
                                          return (
                                            <div key={topic.id} className={clsx('flex items-center gap-3 p-2.5 rounded-xl border transition-colors', COVERAGE_COLORS[coverage])}>
                                              <Icon className="w-4 h-4 flex-shrink-0" />
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <span className="text-sm font-medium text-white truncate">{topic.name}</span>
                                                  {topic.meta.isHighYield && <Badge label="⚡" className="text-yellow-400 bg-yellow-900/30" />}
                                                  <Badge label={`${topic.meta.weightage}%`} className="text-surface-400 bg-surface-700" />
                                                  {topic.meta.formulaCount > 0 && <Badge label={`${topic.meta.formulaCount} formulae`} className="text-blue-400 bg-blue-900/20" />}
                                                  {problems.length > 0 && <Badge label={`${problems.length} probs`} className="text-purple-400 bg-purple-900/20" />}
                                                </div>
                                                <div className="text-xs text-surface-500 mt-0.5">~{topic.meta.avgQuestionsPerYear} Q/yr · {topic.meta.exam.join(', ')}</div>
                                              </div>
                                              {/* Coverage controls */}
                                              <div className="flex gap-1.5 flex-shrink-0">
                                                {(['uncovered', 'partial', 'covered', 'needs-revision'] as CoverageStatus[]).map(s => (
                                                  <button
                                                    key={s}
                                                    title={s}
                                                    onClick={() => setCoverage(topic.id, s)}
                                                    className={clsx('w-5 h-5 rounded-full border text-[9px] transition-all', coverage === s ? 'scale-110' : 'opacity-40 hover:opacity-80',
                                                      s === 'covered' ? 'bg-green-500 border-green-400' :
                                                      s === 'partial' ? 'bg-yellow-500 border-yellow-400' :
                                                      s === 'needs-revision' ? 'bg-orange-500 border-orange-400' :
                                                      'bg-surface-600 border-surface-500')}
                                                  />
                                                ))}
                                              </div>
                                              {/* Quick actions */}
                                              <div className="flex gap-1 flex-shrink-0">
                                                <button onClick={() => setSelectedTopic(topic)} className="p-1 rounded hover:bg-surface-600" title="View problems">
                                                  <Target className="w-3.5 h-3.5 text-surface-400" />
                                                </button>
                                                <button onClick={() => { setSelectedTopic(topic); setTab('problems'); setShowAddProblem(true); }} className="p-1 rounded hover:bg-surface-600" title="Add problem">
                                                  <Plus className="w-3.5 h-3.5 text-surface-400" />
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
              </div>
            )}

            {/* ── TAB 2: PROBLEM BANK ───────────────────────────────────── */}
            {tab === 'problems' && (
              <div className="space-y-3 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search problems, topics..." className="w-full pl-9 pr-4 py-2 text-sm bg-surface-800 border border-surface-700 rounded-xl text-white placeholder-surface-400 focus:outline-none focus:border-primary-500" />
                  </div>
                  <button onClick={() => setShowAddProblem(true)} className="btn btn-primary flex items-center gap-2 text-sm px-4 py-2">
                    <Plus className="w-4 h-4" /> Add Problem
                  </button>
                </div>

                {/* Grouped by topic */}
                {(() => {
                  const filtered = state.problems.filter(p =>
                    !search || p.question.toLowerCase().includes(search.toLowerCase()) || p.topicName.toLowerCase().includes(search.toLowerCase()) || p.chapter.toLowerCase().includes(search.toLowerCase())
                  );
                  const byTopic = filtered.reduce<Record<string, ProblemEntry[]>>((acc, p) => {
                    const key = `${p.subject} > ${p.chapter} > ${p.topicName}`;
                    (acc[key] = acc[key] || []).push(p);
                    return acc;
                  }, {});

                  if (filtered.length === 0) return (
                    <div className="text-center py-12 text-surface-400">
                      <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p>No problems yet. Add your first!</p>
                      <button onClick={() => setShowAddProblem(true)} className="btn btn-primary mt-4 text-sm">+ Add Problem</button>
                    </div>
                  );

                  return Object.entries(byTopic).map(([topic, probs]) => (
                    <div key={topic} className="card">
                      <div className="flex items-center justify-between p-3 border-b border-surface-700">
                        <span className="text-sm font-medium text-primary-300">{topic}</span>
                        <div className="flex gap-2 text-xs">
                          <span className="text-green-400">{probs.filter(p => p.isCorrect).length} ✓</span>
                          <span className="text-red-400">{probs.filter(p => p.isCorrect === false).length} ✗</span>
                          <span className="text-surface-400">{probs.filter(p => p.isFlagged).length} 🚩</span>
                        </div>
                      </div>
                      <div className="divide-y divide-surface-700/50">
                        {probs.map(prob => (
                          <div key={prob.id} className="p-3 hover:bg-surface-700/30 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <Badge label={prob.difficulty} className={DIFFICULTY_COLORS[prob.difficulty]} />
                                  <Badge label={prob.source} className="text-surface-400 bg-surface-700" />
                                  {prob.isCorrect === true && <Badge label="✓ Correct" className="text-green-400 bg-green-900/20" />}
                                  {prob.isCorrect === false && <Badge label="✗ Wrong" className="text-red-400 bg-red-900/20" />}
                                  {prob.isFlagged && <Badge label="🚩 Revisit" className="text-orange-400 bg-orange-900/20" />}
                                  {prob.isBookmarked && <Bookmark className="w-3 h-3 text-yellow-400" />}
                                </div>
                                <p className="text-sm text-white">{prob.question}</p>
                                {prob.aiSolution && (
                                  <div className="mt-2 bg-primary-900/20 border border-primary-500/20 rounded-lg p-2">
                                    <p className="text-xs text-primary-300 font-medium mb-1">🤖 Sage Solution:</p>
                                    <p className="text-xs text-surface-300">{prob.aiSolution}</p>
                                    {prob.aiSteps && prob.aiSteps.length > 0 && (
                                      <ol className="mt-1 space-y-0.5">
                                        {prob.aiSteps.map((step, i) => <li key={i} className="text-xs text-surface-400">{i + 1}. {step}</li>)}
                                      </ol>
                                    )}
                                  </div>
                                )}
                                {prob.notes && <p className="mt-1 text-xs text-surface-400 italic">📝 {prob.notes}</p>}
                                <div className="flex gap-2 mt-1 flex-wrap">
                                  {prob.tags.map(tag => <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-surface-700 text-surface-400 rounded">{tag}</span>)}
                                </div>
                              </div>
                              <div className="flex flex-col gap-1">
                                <button onClick={() => setState(s => ({ ...s, problems: s.problems.map(p => p.id === prob.id ? { ...p, isBookmarked: !p.isBookmarked } : p) }))}
                                  className="p-1 rounded hover:bg-surface-600"><Bookmark className={clsx('w-3.5 h-3.5', prob.isBookmarked ? 'text-yellow-400' : 'text-surface-500')} /></button>
                                <button onClick={() => setState(s => ({ ...s, problems: s.problems.map(p => p.id === prob.id ? { ...p, isFlagged: !p.isFlagged } : p) }))}
                                  className="p-1 rounded hover:bg-surface-600"><Flag className={clsx('w-3.5 h-3.5', prob.isFlagged ? 'text-orange-400' : 'text-surface-500')} /></button>
                                <button onClick={() => setState(s => ({ ...s, problems: s.problems.filter(p => p.id !== prob.id) }))}
                                  className="p-1 rounded hover:bg-surface-600"><Trash2 className="w-3.5 h-3.5 text-surface-500 hover:text-red-400" /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}

                {/* Add Problem Modal */}
                <AnimatePresence>
                  {showAddProblem && (
                    <AddProblemModal
                      exam={exam}
                      preselectedTopic={selectedTopic}
                      onAdd={(prob) => { setState(s => addProblem(s, prob)); setShowAddProblem(false); }}
                      onClose={() => setShowAddProblem(false)}
                    />
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ── TAB 3: FORMULA REGISTRY ───────────────────────────────── */}
            {tab === 'formulas' && (
              <div className="space-y-3 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search formulas..." className="w-full pl-9 pr-4 py-2 text-sm bg-surface-800 border border-surface-700 rounded-xl text-white placeholder-surface-400 focus:outline-none focus:border-primary-500" />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {['All', ...subjects].map(s => (
                      <button key={s} onClick={() => setSubjectFilter(s)} className={clsx('px-3 py-1.5 text-xs rounded-lg', subjectFilter === s ? 'bg-primary-600 text-white' : 'bg-surface-700 text-surface-300')}>{s}</button>
                    ))}
                  </div>
                </div>

                {(() => {
                  const filtered = examFormulas.filter(f =>
                    (subjectFilter === 'All' || f.subject === subjectFilter) &&
                    (!search || f.plain.toLowerCase().includes(search.toLowerCase()) || f.description.toLowerCase().includes(search.toLowerCase()) || f.topicName.toLowerCase().includes(search.toLowerCase()))
                  );
                  const bySubject = filtered.reduce<Record<string, typeof filtered>>((acc, f) => {
                    (acc[f.subject] = acc[f.subject] || []).push(f);
                    return acc;
                  }, {});

                  return Object.entries(bySubject).map(([subj, formulas]) => (
                    <div key={subj} className="card">
                      <div className="p-3 border-b border-surface-700 font-medium text-sm text-primary-300">{subj}</div>
                      <div className="divide-y divide-surface-700/50">                        {formulas.map(f => (
                          <div key={f.id} className="p-3 hover:bg-surface-700/30">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="text-xs text-surface-400">{f.chapter} › {f.topicName}</span>
                                  {f.masteryConfirmed && <Badge label="✓ Mastered" className="text-green-400 bg-green-900/20" />}
                                </div>
                                <div className="font-mono text-sm text-yellow-300 bg-yellow-900/10 border border-yellow-500/20 rounded-lg px-3 py-2 mb-1">
                                  {f.plain}
                                </div>
                                <p className="text-xs text-surface-300">{f.description}</p>
                                {f.example && <p className="text-xs text-surface-500 mt-0.5">📌 e.g. {f.example}</p>}
                              </div>
                              <div className="flex flex-col gap-1">
                                <button onClick={() => {
                                  const newFormulas = FORMULA_REGISTRY.map(ff => ff.id === f.id ? { ...ff, isBookmarked: !ff.isBookmarked } : ff);
                                  // In real app, persist to state; for now we just re-render
                                }}><Bookmark className={clsx('w-4 h-4', f.isBookmarked ? 'text-yellow-400' : 'text-surface-500')} /></button>
                                <button onClick={() => {
                                  const idx = FORMULA_REGISTRY.findIndex(ff => ff.id === f.id);
                                  if (idx !== -1) FORMULA_REGISTRY[idx] = { ...f, masteryConfirmed: !f.masteryConfirmed };
                                }}><CheckSquare className={clsx('w-4 h-4', f.masteryConfirmed ? 'text-green-400' : 'text-surface-500')} /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}

                {examFormulas.length === 0 && (
                  <div className="text-center py-12 text-surface-400">
                    <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No formulas registered for {exam} yet.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 4: MY NOTES ───────────────────────────────────────── */}
            {tab === 'notes' && (
              <div className="space-y-3 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes..." className="w-full pl-9 pr-4 py-2 text-sm bg-surface-800 border border-surface-700 rounded-xl text-white placeholder-surface-400 focus:outline-none focus:border-primary-500" />
                  </div>
                  <button onClick={() => setShowAddNote(true)} className="btn btn-primary flex items-center gap-2 text-sm px-4 py-2">
                    <Plus className="w-4 h-4" /> New Note
                  </button>
                </div>

                {state.notes.length === 0 && (
                  <div className="text-center py-12 text-surface-400">
                    <PenLine className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No notes yet. Start writing!</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {state.notes
                    .filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()))
                    .map(note => (
                      <div key={note.id} className="card p-3 hover:ring-1 hover:ring-primary-500/30 transition-all cursor-pointer"
                        style={{ borderLeft: `3px solid ${note.color}` }}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-medium text-sm text-white">{note.title}</div>
                            {note.topicName && <div className="text-xs text-surface-500">{note.subject} › {note.chapter} › {note.topicName}</div>}
                          </div>
                          <div className="flex gap-1">
                            {note.isBookmarked && <Bookmark className="w-3.5 h-3.5 text-yellow-400" />}
                            <button onClick={() => setState(s => ({ ...s, notes: s.notes.filter(n => n.id !== note.id) }))}>
                              <Trash2 className="w-3.5 h-3.5 text-surface-500 hover:text-red-400" />
                            </button>
                          </div>
                        </div>
                        <pre className="text-xs text-surface-300 whitespace-pre-wrap line-clamp-4">{note.content}</pre>
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {note.tags.map(tag => <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-surface-700 text-surface-400 rounded">{tag}</span>)}
                        </div>
                        <div className="text-[10px] text-surface-600 mt-1">{new Date(note.updatedAt).toLocaleDateString()}</div>
                      </div>
                    ))}
                </div>

                <AnimatePresence>
                  {showAddNote && (
                    <AddNoteModal
                      exam={exam}
                      onAdd={(n) => { setState(s => addNote(s, n)); setShowAddNote(false); }}
                      onClose={() => setShowAddNote(false)}
                    />
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ── TAB 5: REVISION QUEUE ────────────────────────────────── */}
            {tab === 'revision' && (
              <div className="space-y-4 pb-4">
                {/* Uncovered high-yield alert */}
                {summary.highYieldUncovered.length > 0 && (
                  <div className="card border border-orange-500/30 bg-orange-900/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4 text-orange-400" />
                      <span className="font-medium text-orange-400">⚡ Priority: Uncovered High-Yield Topics</span>
                    </div>
                    <div className="space-y-2">
                      {summary.highYieldUncovered.map(topic => (
                        <div key={topic.id} className="flex items-center justify-between p-2 bg-surface-800 rounded-lg">
                          <div>
                            <span className="text-sm text-white">{topic.name}</span>
                            <span className="text-xs text-surface-400 ml-2">{topic.chapter} · {topic.meta.weightage}% weight · ~{topic.meta.avgQuestionsPerYear} Q/yr</span>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => { setTab('syllabus'); }} className="text-xs px-2 py-1 bg-primary-600 text-white rounded-lg hover:bg-primary-500">
                              Study
                            </button>
                            <button onClick={() => { setShowAddProblem(true); setSelectedTopic(topic); setTab('problems'); }} className="text-xs px-2 py-1 bg-surface-700 text-surface-300 rounded-lg hover:bg-surface-600">
                              + Problem
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Due revisions */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-primary-400" />
                    Due for Revision ({dueRevisions.length})
                  </h3>
                  {dueRevisions.length === 0 ? (
                    <div className="card p-6 text-center text-surface-400">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                      <p className="text-sm">All caught up! No revisions due.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dueRevisions.map(rev => {
                        const prob = state.problems.find(p => p.id === rev.problemId);
                        if (!prob) return null;
                        return (
                          <div key={rev.problemId} className="card p-3">
                            <div className="flex items-start gap-3">
                              <div className="flex-1">
                                <div className="text-xs text-surface-400 mb-1">{prob.subject} › {prob.chapter} › {prob.topicName}</div>
                                <p className="text-sm text-white">{prob.question}</p>
                                {prob.aiSolution && (
                                  <p className="text-xs text-surface-400 mt-1">Solution: {prob.aiSolution}</p>
                                )}
                              </div>
                              <div className="flex flex-col gap-1.5 text-xs flex-shrink-0">
                                <span className="text-surface-500 text-center">How well?</span>
                                {[0, 1, 2, 3, 4, 5].map(q => (
                                  <button
                                    key={q}
                                    onClick={() => {
                                      const updated = applySpacedRepetition(rev, q as 0|1|2|3|4|5);
                                      setState(s => ({
                                        ...s,
                                        revisionQueue: s.revisionQueue.map(r => r.problemId === rev.problemId ? updated : r),
                                        problems: s.problems.map(p => p.id === rev.problemId ? { ...p, revisionCount: p.revisionCount + 1, lastRevisedAt: Date.now() } : p),
                                      }));
                                    }}
                                    className={clsx('w-8 h-6 rounded text-center font-bold transition-colors',
                                      q >= 4 ? 'bg-green-800 hover:bg-green-700 text-green-300' :
                                      q >= 2 ? 'bg-yellow-800 hover:bg-yellow-700 text-yellow-300' :
                                      'bg-red-800 hover:bg-red-700 text-red-300'
                                    )}
                                    title={['Complete blackout','Incorrect - remembered on seeing','Incorrect, easy recall','Correct with difficulty','Correct after hesitation','Perfect response'][q]}
                                  >
                                    {q}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-primary-400" /> Study Stats
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Problems', val: state.problems.length, color: 'text-blue-400' },
                      { label: 'Correct Rate', val: state.problems.length ? `${Math.round((state.problems.filter(p => p.isCorrect).length / state.problems.filter(p => p.isCorrect !== undefined).length || 0) * 100)}%` : '–', color: 'text-green-400' },
                      { label: 'Notes Written', val: state.notes.length, color: 'text-yellow-400' },
                      { label: 'Topics Covered', val: `${summary.covered + summary.partial} / ${summary.total}`, color: 'text-purple-400' },
                    ].map(s => (
                      <div key={s.label} className="bg-surface-800 rounded-xl p-3 text-center">
                        <div className={clsx('text-xl font-bold', s.color)}>{s.val}</div>
                        <div className="text-xs text-surface-400 mt-1">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Add Problem Modal ────────────────────────────────────────────────────────

function AddProblemModal({ exam, preselectedTopic, onAdd, onClose }: {
  exam: ExamScope;
  preselectedTopic: SyllabusTopic | null;
  onAdd: (p: Omit<ProblemEntry, 'id' | 'timestamp' | 'revisionCount'>) => void;
  onClose: () => void;
}) {
  const allTopics = getAllTopics(exam);
  const [topicId, setTopicId] = useState(preselectedTopic?.id ?? allTopics[0]?.id ?? '');
  const [question, setQuestion] = useState('');
  const [solution, setSolution] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [isCorrect, setIsCorrect] = useState<boolean | undefined>(undefined);
  const [tags, setTags] = useState('');
  const [flagged, setFlagged] = useState(false);
  const [notes, setNotes] = useState('');

  const selectedTopic = allTopics.find(t => t.id === topicId);

  const handleSubmit = () => {
    if (!question.trim() || !topicId) return;
    onAdd({
      topicId,
      topicName: selectedTopic?.name ?? '',
      chapter: selectedTopic?.chapter ?? '',
      subject: selectedTopic?.subject ?? '',
      exam: [exam],
      question: question.trim(),
      userSolution: solution.trim() || undefined,
      aiSolution: undefined,
      difficulty,
      source: 'manual',
      isCorrect,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      isBookmarked: false,
      isFlagged: flagged,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="card w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Add Problem</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-700 text-surface-400">✕</button>
        </div>

        <div>
          <label className="text-xs text-surface-400 mb-1 block">Topic *</label>
          <select value={topicId} onChange={e => setTopicId(e.target.value)}
            className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
            {allTopics.map(t => <option key={t.id} value={t.id}>{t.subject} › {t.chapter} › {t.name}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-surface-400 mb-1 block">Question *</label>
          <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={3} placeholder="Paste or type the question..."
            className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-400 focus:outline-none focus:border-primary-500 resize-none" />
        </div>

        <div>
          <label className="text-xs text-surface-400 mb-1 block">Your Solution / Working</label>
          <textarea value={solution} onChange={e => setSolution(e.target.value)} rows={2} placeholder="Write your approach..."
            className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-400 focus:outline-none focus:border-primary-500 resize-none" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Difficulty</label>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value as typeof difficulty)}
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
              {['easy', 'medium', 'hard'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Result</label>
            <div className="flex gap-2 mt-1">
              {[{ val: true, label: '✓ Correct', cls: 'text-green-400 border-green-500' }, { val: false, label: '✗ Wrong', cls: 'text-red-400 border-red-500' }, { val: undefined, label: '? NA', cls: 'text-surface-400 border-surface-600' }].map(r => (
                <button key={String(r.val)} onClick={() => setIsCorrect(r.val)}
                  className={clsx('flex-1 py-1 rounded-lg border text-xs font-medium transition-colors', isCorrect === r.val ? r.cls + ' bg-surface-700' : 'border-surface-700 text-surface-500')}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Tags (comma-separated)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. JEE pattern, tricky"
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-400 focus:outline-none focus:border-primary-500" />
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any quick note..."
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-400 focus:outline-none focus:border-primary-500" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="flagged" checked={flagged} onChange={e => setFlagged(e.target.checked)} className="rounded" />
          <label htmlFor="flagged" className="text-xs text-surface-300">🚩 Flag for revisit</label>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2 bg-surface-700 hover:bg-surface-600 text-white rounded-xl text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={!question.trim()} className="flex-1 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium">Save Problem</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Add Note Modal ───────────────────────────────────────────────────────────

function AddNoteModal({ exam, onAdd, onClose }: {
  exam: ExamScope;
  onAdd: (n: Omit<NoteEntry, 'id' | 'timestamp' | 'updatedAt'>) => void;
  onClose: () => void;
}) {
  const allTopics = getAllTopics(exam);
  const [topicId, setTopicId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [color, setColor] = useState('#8B5CF6');
  const [bookmarked, setBookmarked] = useState(false);

  const selectedTopic = allTopics.find(t => t.id === topicId);
  const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6'];

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) return;
    onAdd({
      topicId: topicId || undefined,
      topicName: selectedTopic?.name,
      chapter: selectedTopic?.chapter,
      subject: selectedTopic?.subject,
      title: title.trim(),
      content: content.trim(),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      isBookmarked: bookmarked,
      color,
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="card w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">New Note</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-700 text-surface-400">✕</button>
        </div>

        <div>
          <label className="text-xs text-surface-400 mb-1 block">Link to Topic (optional)</label>
          <select value={topicId} onChange={e => setTopicId(e.target.value)}
            className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
            <option value="">— No topic link —</option>
            {allTopics.map(t => <option key={t.id} value={t.id}>{t.subject} › {t.chapter} › {t.name}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-surface-400 mb-1 block">Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Named Reactions Quick Reference"
            className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-400 focus:outline-none focus:border-primary-500" />
        </div>

        <div>
          <label className="text-xs text-surface-400 mb-1 block">Content *</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder="Write your notes here (markdown supported)..."
            className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-400 focus:outline-none focus:border-primary-500 resize-none" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Tags</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="comma separated"
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-400 focus:outline-none focus:border-primary-500" />
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Colour accent</label>
            <div className="flex gap-1.5 mt-1">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{ background: c }}
                  className={clsx('w-6 h-6 rounded-full transition-transform', color === c ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100')} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="nb-bkm" checked={bookmarked} onChange={e => setBookmarked(e.target.checked)} className="rounded" />
          <label htmlFor="nb-bkm" className="text-xs text-surface-300">Bookmark this note</label>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2 bg-surface-700 hover:bg-surface-600 text-white rounded-xl text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={!title.trim() || !content.trim()} className="flex-1 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium">Save Note</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
