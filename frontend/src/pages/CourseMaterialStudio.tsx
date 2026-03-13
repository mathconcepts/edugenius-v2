/**
 * CourseMaterialStudio.tsx — Playbook-Driven Course Material Studio
 *
 * Two modes:
 *   CEO Mode   — Full control panel with all personalization variables
 *   Student Mode — Simplified, request-driven interface
 *
 * Route: /course-material-studio
 */

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Wand2, Brain, Clock, Zap, Target, Users, GraduationCap,
  ChevronDown, ChevronUp, Copy, Edit3, Download, RefreshCw, Library,
  MessageSquare, CheckCircle2, AlertCircle, Info, Sparkles, Filter,
  BarChart3, Eye, EyeOff, Layers,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  generateCourseMaterial,
  autoPersonalize,
  parseCustomRequest,
  getMaterialPlaybookHealth,
  getAvailableSubtopics,
  TEMPLATE_CONFIGS,
  type CourseTemplate,
  type PersonalizationConfig,
  type CourseMaterial,
  type CourseSection,
  type CourseSectionType,
} from '@/services/courseMaterialGenerator';
import { MANDATORY_COVERAGE_MAP } from '@/services/mandatoryContentService';
import type { LearningStyle, CognitiveTier } from '@/services/contentPersonaEngine';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CourseMaterialStudioProps {
  ceoMode?: boolean;        // Full control panel (default: student mode)
  defaultExamId?: string;
  defaultTopicId?: string;
  defaultSubtopicIds?: string[];
  onMaterialGenerated?: (material: CourseMaterial) => void;
}

// ─── Template Card Data ───────────────────────────────────────────────────────

const TEMPLATE_INFO: Record<CourseTemplate, {
  label: string;
  emoji: string;
  description: string;
  estimatedMin: number;
  color: string;
}> = {
  exam_cracker:    { label: 'Exam Cracker',    emoji: '🎯', description: 'PYQs + traps + formulas — exam-day ready', estimatedMin: 30, color: 'red' },
  concept_builder: { label: 'Concept Builder', emoji: '🏗️', description: 'Core concept → examples → exercises', estimatedMin: 60, color: 'blue' },
  quick_revision:  { label: 'Quick Revision',  emoji: '⚡', description: '10-min compact refresh before exam', estimatedMin: 10, color: 'yellow' },
  visual_deep_dive:{ label: 'Visual Deep Dive',emoji: '🎨', description: 'ASCII diagrams + analogies + visual flow', estimatedMin: 30, color: 'purple' },
  socratic_journey:{ label: 'Socratic Journey',emoji: '🤔', description: 'Question → probe → reveal (Sage-style)', estimatedMin: 45, color: 'green' },
  topper_strategy: { label: 'Topper Strategy', emoji: '🏆', description: 'Edge cases + advanced applications', estimatedMin: 60, color: 'orange' },
  parent_brief:    { label: 'Parent Brief',    emoji: '👨‍👩‍👧', description: 'Plain-English for non-technical parents', estimatedMin: 10, color: 'teal' },
  teacher_kit:     { label: 'Teacher Kit',     emoji: '📋', description: 'Lesson plan + pedagogy notes + exercises', estimatedMin: 60, color: 'indigo' },
  custom:          { label: 'Custom',          emoji: '✨', description: 'Your exact request, personalized by AI', estimatedMin: 30, color: 'pink' },
};

const LEARNING_STYLES: Array<{ value: LearningStyle; label: string; icon: string }> = [
  { value: 'visual',         label: 'Visual',        icon: '👁️' },
  { value: 'analytical',     label: 'Analytical',    icon: '🔢' },
  { value: 'story_driven',   label: 'Story-Driven',  icon: '📖' },
  { value: 'practice_first', label: 'Practice First',icon: '🎯' },
  { value: 'auditory',       label: 'Conversational',icon: '🗣️' },
  { value: 'unknown',        label: 'Auto-Detect',   icon: '🤖' },
];

const COGNITIVE_TIERS: Array<{ value: CognitiveTier; label: string; desc: string }> = [
  { value: 'foundational', label: 'Foundational', desc: 'First exposure' },
  { value: 'developing',   label: 'Developing',   desc: 'Building depth' },
  { value: 'proficient',   label: 'Proficient',   desc: 'Exam-ready' },
  { value: 'advanced',     label: 'Advanced',     desc: 'Edge cases & derivations' },
];

const EXAM_OPTIONS = Object.keys(MANDATORY_COVERAGE_MAP);

const CUSTOM_REQUEST_PILLS = [
  'Explain like a story',
  '5 minute revision',
  'Only PYQs',
  'Teach like a beginner',
  'Focus on traps',
  'I learn by doing problems',
  'Topper strategy',
  'Visual diagrams',
  'Advanced only',
];

// ─── Section Type Badge ───────────────────────────────────────────────────────

const SECTION_TYPE_COLORS: Record<CourseSectionType, string> = {
  concept:       'bg-blue-100 text-blue-700',
  formula:       'bg-purple-100 text-purple-700',
  example:       'bg-green-100 text-green-700',
  pyq:           'bg-yellow-100 text-yellow-700',
  analogy:       'bg-pink-100 text-pink-700',
  socratic:      'bg-teal-100 text-teal-700',
  misconception: 'bg-red-100 text-red-700',
  exam_tip:      'bg-orange-100 text-orange-700',
  summary:       'bg-gray-100 text-gray-700',
  exercise:      'bg-indigo-100 text-indigo-700',
  teacher_note:  'bg-cyan-100 text-cyan-700',
  parent_note:   'bg-rose-100 text-rose-700',
};

const SECTION_TYPE_LABELS: Record<CourseSectionType, string> = {
  concept:       'Concept',
  formula:       'Formula',
  example:       'Example',
  pyq:           'PYQ',
  analogy:       'Analogy',
  socratic:      'Socratic',
  misconception: 'Mistakes',
  exam_tip:      'Exam Tip',
  summary:       'Summary',
  exercise:      'Exercise',
  teacher_note:  'Teacher Note',
  parent_note:   'Parent Note',
};

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  section,
  ceoMode,
  index,
}: {
  section: CourseSection;
  ceoMode: boolean;
  index: number;
}) {
  const [expanded, setExpanded] = useState(index < 3);
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(section.content);
  const [showPlaybookSource, setShowPlaybookSource] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(editing ? editedContent : section.content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [editing, editedContent, section.content]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="border border-surface-200 rounded-xl overflow-hidden bg-surface-800"
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-700 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', SECTION_TYPE_COLORS[section.type])}>
          {SECTION_TYPE_LABELS[section.type]}
        </span>
        <span className={clsx(
          'text-xs px-2 py-0.5 rounded-full font-medium',
          section.layer === 'mandatory'
            ? 'bg-primary-900/40 text-primary-300'
            : 'bg-surface-600 text-surface-300',
        )}>
          {section.layer === 'mandatory' ? 'Mandatory' : 'Personalized'}
        </span>
        <span className="text-sm font-medium text-surface-100 flex-1 truncate">{section.title}</span>
        <span className="text-xs text-surface-400 shrink-0">{section.estimatedMinutes} min</span>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} className="text-surface-400">
          <ChevronDown size={14} />
        </motion.div>
      </div>

      {/* Body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 border-t border-surface-700">
              {editing ? (
                <textarea
                  value={editedContent}
                  onChange={e => setEditedContent(e.target.value)}
                  className="w-full h-48 bg-surface-900 text-surface-100 text-sm p-3 rounded-lg border border-surface-600 resize-y font-mono"
                />
              ) : (
                <pre className="text-sm text-surface-200 whitespace-pre-wrap font-sans leading-relaxed">
                  {section.content}
                </pre>
              )}

              {/* Action bar */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-700">
                <button
                  onClick={() => setEditing(e => !e)}
                  className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors"
                >
                  <Edit3 size={12} />
                  {editing ? 'Done Editing' : 'Edit'}
                </button>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors"
                >
                  <Copy size={12} />
                  {copied ? 'Copied!' : 'Copy'}
                </button>

                {ceoMode && (
                  <button
                    onClick={() => setShowPlaybookSource(s => !s)}
                    className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors ml-auto"
                  >
                    <Info size={12} />
                    Playbook Source
                  </button>
                )}
              </div>

              {/* CEO: Playbook source + personalization trace */}
              {ceoMode && showPlaybookSource && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3 p-3 bg-surface-900 rounded-lg text-xs space-y-1"
                >
                  <div className="text-surface-400">
                    <span className="text-surface-300 font-medium">Playbook Source:</span> {section.playbookSource}
                  </div>
                  {section.personalizationApplied.length > 0 && (
                    <div className="text-surface-400">
                      <span className="text-surface-300 font-medium">Personalization:</span>{' '}
                      {section.personalizationApplied.join(', ')}
                    </div>
                  )}
                  <div className="text-surface-400">
                    <span className="text-surface-300 font-medium">Subtopic:</span> {section.subtopicId}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CourseMaterialStudio({
  ceoMode = false,
  defaultExamId = 'GATE_EM',
  defaultTopicId = 'linear_algebra',
  defaultSubtopicIds = [],
  onMaterialGenerated,
}: CourseMaterialStudioProps) {
  // ── Config state ────────────────────────────────────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState<CourseTemplate>('concept_builder');
  const [examId, setExamId] = useState(defaultExamId);
  const [topicId, setTopicId] = useState(defaultTopicId);
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>(defaultSubtopicIds);
  const [learningStyle, setLearningStyle] = useState<LearningStyle>('unknown');
  const [cognitiveTier, setCognitiveTier] = useState<CognitiveTier>('developing');
  const [sessionLength, setSessionLength] = useState<number>(30);
  const [daysToExam, setDaysToExam] = useState<number>(30);
  const [role, setRole] = useState<string>('student');
  const [customRequest, setCustomRequest] = useState('');
  const [includeAnalogies, setIncludeAnalogies] = useState(true);
  const [includeSocratic, setIncludeSocratic] = useState(true);
  const [includePYQs, setIncludePYQs] = useState(true);
  const [includeFormulas, setIncludeFormulas] = useState(true);
  const [includeMistakes, setIncludeMistakes] = useState(true);
  const [includeExamTips, setIncludeExamTips] = useState(true);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed');

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [material, setMaterial] = useState<CourseMaterial | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [personalizationOpen, setPersonalizationOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showTracing, setShowTracing] = useState(false);
  const [studentRequest, setStudentRequest] = useState('');

  const rightPanelRef = useRef<HTMLDivElement>(null);

  // ── Derived values ───────────────────────────────────────────────────────────
  const availableTopics = MANDATORY_COVERAGE_MAP[examId] ?? [];
  const availableSubtopics = getAvailableSubtopics(examId, topicId);

  const playbookHealth = selectedSubtopics.length > 0
    ? getMaterialPlaybookHealth({ examId, topicId, subtopicIds: selectedSubtopics })
    : 0;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const toggleSubtopic = useCallback((sid: string) => {
    setSelectedSubtopics(prev =>
      prev.includes(sid) ? prev.filter(s => s !== sid) : [...prev, sid],
    );
  }, []);

  const handleAutoFill = useCallback(async () => {
    try {
      const subtopicsToUse = selectedSubtopics.length > 0
        ? selectedSubtopics
        : availableSubtopics.slice(0, 3).map(s => s.subtopicId);
      const config = await autoPersonalize(examId, topicId, subtopicsToUse);
      if (config.learningStyle) setLearningStyle(config.learningStyle);
      if (config.cognitiveTier) setCognitiveTier(config.cognitiveTier);
      if (config.sessionLengthMinutes) setSessionLength(config.sessionLengthMinutes);
      if (config.daysToExam) setDaysToExam(config.daysToExam);
      if (config.role) setRole(config.role);
      if (config.includeAnalogies !== undefined) setIncludeAnalogies(config.includeAnalogies);
      if (config.includeSocraticQuestions !== undefined) setIncludeSocratic(config.includeSocraticQuestions);
      if (config.includePYQs !== undefined) setIncludePYQs(config.includePYQs);
      if (config.includeFormulas !== undefined) setIncludeFormulas(config.includeFormulas);
      if (config.includeCommonMistakes !== undefined) setIncludeMistakes(config.includeCommonMistakes);
      if (config.includeExamTips !== undefined) setIncludeExamTips(config.includeExamTips);
    } catch (e) {
      console.error('[CourseMaterialStudio] autoPersonalize failed', e);
    }
  }, [examId, topicId, selectedSubtopics, availableSubtopics]);

  const handleGenerate = useCallback(async () => {
    if (generating) return;

    const subtopicsToUse = selectedSubtopics.length > 0
      ? selectedSubtopics
      : availableSubtopics.slice(0, 3).map(s => s.subtopicId);

    if (subtopicsToUse.length === 0) {
      setError('Please select at least one subtopic.');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const config: PersonalizationConfig = {
        examId,
        topicId,
        subtopicIds: subtopicsToUse,
        learningStyle,
        cognitiveTier,
        sessionLengthMinutes: sessionLength,
        daysToExam,
        role,
        customRequest: customRequest || undefined,
        includeAnalogies,
        includeSocraticQuestions: includeSocratic,
        includePYQs,
        includeFormulas,
        includeCommonMistakes: includeMistakes,
        includeExamTips,
        preferredDifficulty: difficulty,
      };

      const result = await generateCourseMaterial(selectedTemplate, config);
      setMaterial(result);
      onMaterialGenerated?.(result);

      // Scroll to result
      setTimeout(() => rightPanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 100);
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  }, [
    generating, selectedSubtopics, availableSubtopics, examId, topicId,
    learningStyle, cognitiveTier, sessionLength, daysToExam, role,
    customRequest, includeAnalogies, includeSocratic, includePYQs,
    includeFormulas, includeMistakes, includeExamTips, difficulty,
    selectedTemplate, onMaterialGenerated,
  ]);

  const handleStudentGenerate = useCallback(async () => {
    if (!studentRequest.trim()) return;
    setGenerating(true);
    setError(null);

    try {
      const overrides = parseCustomRequest(studentRequest);
      const subtopicsToUse = selectedSubtopics.length > 0
        ? selectedSubtopics
        : availableSubtopics.slice(0, 2).map(s => s.subtopicId);

      const config: PersonalizationConfig = {
        examId,
        topicId,
        subtopicIds: subtopicsToUse,
        customRequest: studentRequest,
        ...overrides,
      };

      const result = await generateCourseMaterial(
        (overrides.sessionLengthMinutes !== undefined && overrides.sessionLengthMinutes <= 10) ? 'quick_revision' :
        (overrides.learningStyle === 'visual') ? 'visual_deep_dive' :
        'concept_builder',
        config,
      );
      setMaterial(result);
      onMaterialGenerated?.(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  }, [studentRequest, selectedSubtopics, availableSubtopics, examId, topicId, onMaterialGenerated]);

  // ── Student Mode ─────────────────────────────────────────────────────────────

  if (!ceoMode) {
    return (
      <div className="space-y-4 p-4 max-w-2xl mx-auto">
        <div className="text-center">
          <h2 className="text-xl font-bold text-surface-100">📚 Course Material Studio</h2>
          <p className="text-sm text-surface-400 mt-1">Tell me what you want to learn</p>
        </div>

        {/* Search bar */}
        <div className="relative">
          <input
            type="text"
            value={studentRequest}
            onChange={e => setStudentRequest(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleStudentGenerate()}
            placeholder="e.g. 'Explain eigenvalues in 10 min' or 'Only PYQs for Calculus'"
            className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-3 pr-12 text-surface-100 placeholder-surface-500 focus:outline-none focus:border-primary-500"
          />
          <button
            onClick={handleStudentGenerate}
            disabled={generating || !studentRequest.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 rounded-lg transition-colors"
          >
            <Wand2 size={16} className="text-white" />
          </button>
        </div>

        {/* Keyword pills */}
        <div className="flex flex-wrap gap-2">
          {CUSTOM_REQUEST_PILLS.map(pill => (
            <button
              key={pill}
              onClick={() => setStudentRequest(pill)}
              className="text-xs px-3 py-1.5 rounded-full bg-surface-700 hover:bg-surface-600 text-surface-300 hover:text-surface-100 transition-colors"
            >
              {pill}
            </button>
          ))}
        </div>

        {/* Recommended templates */}
        <div>
          <p className="text-xs text-surface-400 mb-2">Recommended for you:</p>
          <div className="grid grid-cols-3 gap-2">
            {(['quick_revision', 'exam_cracker', 'concept_builder'] as CourseTemplate[]).map(t => {
              const info = TEMPLATE_INFO[t];
              return (
                <button
                  key={t}
                  onClick={async () => {
                    setSelectedTemplate(t);
                    const subtopicsToUse = availableSubtopics.slice(0, 2).map(s => s.subtopicId);
                    setGenerating(true);
                    try {
                      const result = await generateCourseMaterial(t, {
                        examId, topicId, subtopicIds: subtopicsToUse,
                      });
                      setMaterial(result);
                      onMaterialGenerated?.(result);
                    } catch { /* ignore */ } finally {
                      setGenerating(false);
                    }
                  }}
                  className="p-3 bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded-xl text-left transition-all"
                >
                  <div className="text-lg">{info.emoji}</div>
                  <div className="text-xs font-medium text-surface-200 mt-1">{info.label}</div>
                  <div className="text-xs text-surface-500 mt-0.5">{info.estimatedMin} min</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading */}
        {generating && (
          <div className="flex items-center justify-center gap-2 py-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <RefreshCw size={16} className="text-primary-400" />
            </motion.div>
            <span className="text-sm text-surface-400">Generating your material...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-700 rounded-lg">
            <AlertCircle size={14} className="text-red-400" />
            <span className="text-sm text-red-300">{error}</span>
          </div>
        )}

        {/* Results (student mode) */}
        {material && !generating && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-surface-100">{material.title}</h3>
                <p className="text-xs text-surface-400">{material.subtitle} · {material.personalizationSummary}</p>
              </div>
              <span className="text-xs text-surface-500">{material.sections.length} sections</span>
            </div>

            <div className="space-y-2">
              {material.sections.slice(0, 6).map((section, i) => (
                <SectionCard key={section.id} section={section} ceoMode={false} index={i} />
              ))}
              {material.sections.length > 6 && (
                <p className="text-xs text-surface-500 text-center py-2">
                  + {material.sections.length - 6} more sections
                </p>
              )}
            </div>

            {/* Ask Sage button */}
            <button
              onClick={() => {
                localStorage.setItem('sage_course_material', JSON.stringify(material));
                window.location.href = '/chat';
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-500 rounded-xl text-sm font-medium text-white transition-colors"
            >
              <MessageSquare size={16} />
              Ask Sage to teach this material
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── CEO Mode ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Panel: Configuration */}
      <div className="w-[380px] shrink-0 border-r border-surface-700 overflow-y-auto flex flex-col">
        <div className="p-4 border-b border-surface-700">
          <div className="flex items-center gap-2">
            <Library size={18} className="text-primary-400" />
            <h2 className="font-bold text-surface-100">Course Material Studio</h2>
          </div>
          <p className="text-xs text-surface-400 mt-1">Playbook-driven personalized content generation</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Template selector */}
          <div>
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Template</h3>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TEMPLATE_INFO) as CourseTemplate[]).map(t => {
                const info = TEMPLATE_INFO[t];
                return (
                  <button
                    key={t}
                    onClick={() => setSelectedTemplate(t)}
                    className={clsx(
                      'p-2.5 rounded-xl text-left border transition-all',
                      selectedTemplate === t
                        ? 'border-primary-500 bg-primary-900/30'
                        : 'border-surface-700 hover:border-surface-500 bg-surface-800',
                    )}
                  >
                    <div className="text-base">{info.emoji}</div>
                    <div className="text-xs font-medium text-surface-200 mt-1 leading-tight">{info.label}</div>
                    <div className="text-[10px] text-surface-500 mt-0.5">{info.estimatedMin} min</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Exam + Topic + Subtopic */}
          <div>
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Scope</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-surface-400 mb-1 block">Exam</label>
                <select
                  value={examId}
                  onChange={e => { setExamId(e.target.value); setSelectedSubtopics([]); setTopicId(''); }}
                  className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-primary-500"
                >
                  {EXAM_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-surface-400 mb-1 block">Topic</label>
                <select
                  value={topicId}
                  onChange={e => { setTopicId(e.target.value); setSelectedSubtopics([]); }}
                  className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-primary-500"
                >
                  <option value="">All topics</option>
                  {availableTopics.map(t => <option key={t.topicId} value={t.topicId}>{t.topicName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-surface-400 mb-1 block">Subtopics (select)</label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {availableSubtopics.map(s => (
                    <button
                      key={s.subtopicId}
                      onClick={() => toggleSubtopic(s.subtopicId)}
                      className={clsx(
                        'text-xs px-2.5 py-1 rounded-full border transition-all',
                        selectedSubtopics.includes(s.subtopicId)
                          ? 'bg-primary-600 border-primary-500 text-white'
                          : 'bg-surface-700 border-surface-600 text-surface-300 hover:border-surface-400',
                      )}
                    >
                      {s.subtopicName}
                    </button>
                  ))}
                  {availableSubtopics.length === 0 && (
                    <span className="text-xs text-surface-500">Select exam + topic first</span>
                  )}
                </div>
                {playbookHealth > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-surface-700 rounded-full overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full transition-all', playbookHealth >= 70 ? 'bg-green-500' : playbookHealth >= 40 ? 'bg-yellow-500' : 'bg-red-500')}
                        style={{ width: `${playbookHealth}%` }}
                      />
                    </div>
                    <span className="text-xs text-surface-400">Playbook Health: {playbookHealth}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Personalization Variables accordion */}
          <div>
            <button
              onClick={() => setPersonalizationOpen(o => !o)}
              className="flex items-center justify-between w-full text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2"
            >
              <span>Personalization Variables</span>
              <motion.div animate={{ rotate: personalizationOpen ? 180 : 0 }}>
                <ChevronDown size={14} />
              </motion.div>
            </button>
            <AnimatePresence>
              {personalizationOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  {/* Learning Style */}
                  <div>
                    <label className="text-xs text-surface-400 mb-2 block">Learning Style</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {LEARNING_STYLES.map(s => (
                        <button
                          key={s.value}
                          onClick={() => setLearningStyle(s.value)}
                          className={clsx(
                            'text-xs p-2 rounded-lg border transition-all text-center',
                            learningStyle === s.value
                              ? 'border-primary-500 bg-primary-900/30 text-primary-300'
                              : 'border-surface-700 bg-surface-800 text-surface-400 hover:border-surface-500',
                          )}
                        >
                          <div className="text-sm">{s.icon}</div>
                          <div className="mt-0.5 leading-tight">{s.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cognitive Tier */}
                  <div>
                    <label className="text-xs text-surface-400 mb-2 block">Cognitive Tier</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {COGNITIVE_TIERS.map(t => (
                        <button
                          key={t.value}
                          onClick={() => setCognitiveTier(t.value)}
                          className={clsx(
                            'text-xs p-2 rounded-lg border transition-all text-left',
                            cognitiveTier === t.value
                              ? 'border-primary-500 bg-primary-900/30'
                              : 'border-surface-700 bg-surface-800 hover:border-surface-500',
                          )}
                        >
                          <div className="font-medium text-surface-200">{t.label}</div>
                          <div className="text-surface-500 text-[10px]">{t.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Session length + Days to exam */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-surface-400 mb-1 block">Session (min)</label>
                      <select
                        value={sessionLength}
                        onChange={e => setSessionLength(Number(e.target.value))}
                        className="w-full bg-surface-700 border border-surface-600 rounded-lg px-2 py-1.5 text-xs text-surface-100 focus:outline-none"
                      >
                        {[5, 10, 15, 30, 60].map(m => <option key={m} value={m}>{m} min</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-surface-400 mb-1 block">Days to Exam</label>
                      <input
                        type="number"
                        value={daysToExam}
                        onChange={e => setDaysToExam(Number(e.target.value))}
                        min={0}
                        max={365}
                        className="w-full bg-surface-700 border border-surface-600 rounded-lg px-2 py-1.5 text-xs text-surface-100 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Role */}
                  <div>
                    <label className="text-xs text-surface-400 mb-1 block">Role</label>
                    <select
                      value={role}
                      onChange={e => setRole(e.target.value)}
                      className="w-full bg-surface-700 border border-surface-600 rounded-lg px-2 py-1.5 text-xs text-surface-100 focus:outline-none"
                    >
                      {['student', 'teacher', 'parent', 'self_learner', 'coach'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  {/* Difficulty */}
                  <div>
                    <label className="text-xs text-surface-400 mb-1 block">Difficulty</label>
                    <div className="flex gap-1.5">
                      {(['easy', 'medium', 'hard', 'mixed'] as const).map(d => (
                        <button
                          key={d}
                          onClick={() => setDifficulty(d)}
                          className={clsx(
                            'flex-1 text-xs py-1.5 rounded-lg border transition-all capitalize',
                            difficulty === d
                              ? 'border-primary-500 bg-primary-900/30 text-primary-300'
                              : 'border-surface-700 bg-surface-800 text-surface-400 hover:border-surface-500',
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Include toggles */}
                  <div>
                    <label className="text-xs text-surface-400 mb-2 block">Content Toggles</label>
                    <div className="space-y-1.5">
                      {[
                        { label: 'Analogies',          val: includeAnalogies,  set: setIncludeAnalogies },
                        { label: 'Socratic Questions', val: includeSocratic,   set: setIncludeSocratic },
                        { label: 'PYQs',               val: includePYQs,       set: setIncludePYQs },
                        { label: 'Formulas',           val: includeFormulas,   set: setIncludeFormulas },
                        { label: 'Common Mistakes',    val: includeMistakes,   set: setIncludeMistakes },
                        { label: 'Exam Tips',          val: includeExamTips,   set: setIncludeExamTips },
                      ].map(({ label, val, set }) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-xs text-surface-300">{label}</span>
                          <button
                            onClick={() => set(!val)}
                            className={clsx(
                              'w-8 h-4 rounded-full transition-all relative',
                              val ? 'bg-primary-600' : 'bg-surface-600',
                            )}
                          >
                            <div className={clsx(
                              'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all',
                              val ? 'right-0.5' : 'left-0.5',
                            )} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Custom Request */}
          <div>
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Custom Request</h3>
            <textarea
              value={customRequest}
              onChange={e => setCustomRequest(e.target.value)}
              placeholder="Or describe exactly what you want... e.g. 'Explain eigenvalues like a story with 5-min focus on traps'"
              className="w-full h-20 bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-xs text-surface-100 placeholder-surface-500 focus:outline-none focus:border-primary-500 resize-none"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {CUSTOM_REQUEST_PILLS.slice(0, 5).map(pill => (
                <button
                  key={pill}
                  onClick={() => setCustomRequest(pill)}
                  className="text-[10px] px-2 py-1 rounded-full bg-surface-700 hover:bg-surface-600 text-surface-400 hover:text-surface-200 transition-colors"
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom action bar */}
        <div className="p-4 border-t border-surface-700 space-y-2">
          <button
            onClick={handleAutoFill}
            className="w-full flex items-center justify-center gap-2 py-2 bg-surface-700 hover:bg-surface-600 rounded-lg text-sm text-surface-200 transition-colors"
          >
            <Brain size={14} />
            Auto-Fill from Student Profile
          </button>

          <button
            onClick={() => setPreviewOpen(o => !o)}
            className="w-full flex items-center justify-center gap-2 py-2 bg-surface-700 hover:bg-surface-600 rounded-lg text-sm text-surface-200 transition-colors"
          >
            <Eye size={14} />
            {previewOpen ? 'Hide' : 'Preview'} Personalization
          </button>

          {previewOpen && selectedSubtopics.length > 0 && (
            <div className="p-3 bg-surface-900 rounded-lg text-xs space-y-1">
              <div className="font-medium text-surface-300">Playbook fields that will be read:</div>
              <div className="text-surface-400 space-y-0.5">
                <div>• academic.definition (concept)</div>
                {includeFormulas && <div>• examIntelligence.highYieldFormulas (formula)</div>}
                {includePYQs && <div>• examIntelligence.pyqs (PYQs)</div>}
                {includeMistakes && <div>• pedagogy.commonMisconceptions (mistakes)</div>}
                {includeExamTips && <div>• examIntelligence.examSpecificTips (tips)</div>}
                {includeAnalogies && <div>• pedagogy.effectiveAnalogies → {learningStyle} style</div>}
                {includeSocratic && <div>• pedagogy.socraticQuestions + agentConnections.sage.avgSocraticDepth</div>}
                {daysToExam <= 7 && <div className="text-yellow-400">• examIntelligence.trapTopics (T-{daysToExam} urgency)</div>}
              </div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating}
            className={clsx(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all',
              generating
                ? 'bg-primary-700 text-primary-200 cursor-wait'
                : 'bg-primary-600 hover:bg-primary-500 text-white',
            )}
          >
            {generating ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <RefreshCw size={16} />
                </motion.div>
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate Course Material
              </>
            )}
          </button>

          {error && (
            <div className="flex items-start gap-2 p-2 bg-red-900/30 border border-red-700 rounded-lg">
              <AlertCircle size={12} className="text-red-400 mt-0.5 shrink-0" />
              <span className="text-xs text-red-300">{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Generated Material */}
      <div ref={rightPanelRef} className="flex-1 overflow-y-auto">
        {!material && !generating && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-surface-200 mb-2">No material generated yet</h3>
            <p className="text-sm text-surface-400 max-w-sm">
              Configure a template and personalization settings on the left, then click Generate.
            </p>
          </div>
        )}

        {generating && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            >
              <RefreshCw size={32} className="text-primary-400" />
            </motion.div>
            <div className="text-sm text-surface-400">Assembling course material from playbook...</div>
          </div>
        )}

        {material && !generating && (
          <div className="p-6 space-y-5">
            {/* Material header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-surface-100">{material.title}</h2>
                <p className="text-sm text-surface-400 mt-1">{material.subtitle}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs px-2 py-0.5 bg-primary-900/40 text-primary-300 rounded-full">
                    {material.personalizationSummary}
                  </span>
                  <span className="text-xs text-surface-500">
                    {material.sections.length} sections
                  </span>
                  <span className="text-xs text-surface-500">
                    ~{material.estimatedTotalMinutes} min total
                  </span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setShowTracing(t => !t)}
                  className="p-2 bg-surface-700 hover:bg-surface-600 rounded-lg transition-colors"
                  title="Show generation trace"
                >
                  {showTracing ? <EyeOff size={14} className="text-surface-300" /> : <Eye size={14} className="text-surface-400" />}
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem('sage_course_material', JSON.stringify(material));
                    window.location.href = '/chat';
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-surface-700 hover:bg-surface-600 rounded-lg text-xs text-surface-200 transition-colors"
                >
                  <MessageSquare size={12} />
                  Ask Sage
                </button>
                <button
                  onClick={() => {
                    const json = JSON.stringify(material, null, 2);
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${material.id}.json`;
                    a.click();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-surface-700 hover:bg-surface-600 rounded-lg text-xs text-surface-200 transition-colors"
                >
                  <Download size={12} />
                  Export
                </button>
              </div>
            </div>

            {/* Generation trace (CEO) */}
            {showTracing && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-surface-800 border border-surface-700 rounded-xl text-xs space-y-2"
              >
                <div className="font-semibold text-surface-300 flex items-center gap-2">
                  <BarChart3 size={12} />
                  Generation Trace
                </div>
                <div className="grid grid-cols-2 gap-2 text-surface-400">
                  <div><span className="text-surface-300">Template:</span> {material.generationTrace.templateUsed}</div>
                  <div><span className="text-surface-300">Playbook health:</span> {material.generationTrace.playbookHealthAtGeneration}%</div>
                  <div><span className="text-surface-300">Mandatory fulfilled:</span> {material.generationTrace.mandatoryAtomsFulfilled.length}</div>
                  <div><span className="text-surface-300">Personalized added:</span> {material.generationTrace.personalizedSectionsAdded}</div>
                  <div><span className="text-surface-300">Agents:</span> {material.agentsInvolved.join(', ')}</div>
                  <div><span className="text-surface-300">Playbooks read:</span> {material.playbooksRead.length}</div>
                </div>
                {material.generationTrace.templateKeyResolved && (
                  <div className="text-surface-400">
                    <span className="text-surface-300">Template key:</span> {material.generationTrace.templateKeyResolved}
                  </div>
                )}
                <div>
                  <span className="text-surface-300">Personalization vars:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(material.personalizationVariables).map(([k, v]) => (
                      <span key={k} className="px-1.5 py-0.5 bg-surface-700 rounded text-surface-400">
                        {k}={v}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Mandatory / Personalized summary bar */}
            <div className="flex items-center gap-4 p-3 bg-surface-800 rounded-xl text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary-500" />
                <span className="text-surface-400">Mandatory: {material.sections.filter(s => s.layer === 'mandatory').length}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-surface-400">Personalized: {material.sections.filter(s => s.layer === 'personalized').length}</span>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Layers size={12} className="text-surface-500" />
                <span className="text-surface-500">{material.sections.length} total sections</span>
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-3">
              {material.sections.map((section, i) => (
                <SectionCard key={section.id} section={section} ceoMode index={i} />
              ))}
            </div>

            {/* Bottom: save to library */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  const saved = JSON.parse(localStorage.getItem('eg_course_library') ?? '[]') as CourseMaterial[];
                  saved.unshift(material);
                  localStorage.setItem('eg_course_library', JSON.stringify(saved.slice(0, 20)));
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface-700 hover:bg-surface-600 rounded-xl text-sm text-surface-200 transition-colors"
              >
                <BookOpen size={14} />
                Save to Course Library
              </button>
              <button
                onClick={handleGenerate}
                className="flex items-center gap-2 px-4 py-3 bg-surface-700 hover:bg-surface-600 rounded-xl text-sm text-surface-300 transition-colors"
              >
                <RefreshCw size={14} />
                Regenerate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
