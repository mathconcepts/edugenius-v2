/**
 * SubTopicBibleViewer.tsx — CEO Dashboard: SubTopic Bible
 *
 * Three tabs:
 *   1. Bible Browser  — exam → topic → subtopic grid → full reader
 *   2. Bible Health   — completeness heatmap + gaps table
 *   3. Progressive Updates — live update log
 */

import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, ChevronRight, AlertTriangle, CheckCircle, Clock, TrendingUp,
  TrendingDown, Minus, RefreshCw, Search, Filter, Eye, Zap, BarChart3,
  Brain, Target, Users, MessageSquare, Bot, Star, AlertCircle, Database,
} from 'lucide-react';
import {
  getAllBibles,
  getBibleCompleteness,
  getBibleHealthScore,
  reconcileBiblesFromViewer,
  type SubTopicBible,
} from '@/pages/dashboards/bibleViewerHelpers';
import { reconcileBibles } from '@/services/bibleProgressiveUpdater';

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewTab = 'browser' | 'health' | 'updates';

interface BibleReaderSection {
  key: string;
  label: string;
  icon: React.ElementType;
}

const READER_SECTIONS: BibleReaderSection[] = [
  { key: 'academic', label: 'Academic Foundation', icon: BookOpen },
  { key: 'pedagogy', label: 'Teaching Intelligence', icon: Brain },
  { key: 'exam', label: 'Exam Intelligence', icon: Target },
  { key: 'analytics', label: 'Student Analytics', icon: BarChart3 },
  { key: 'preferences', label: 'Student Preferences', icon: Users },
  { key: 'search', label: 'Search Intelligence', icon: Search },
  { key: 'agents', label: 'Agent Connections', icon: Bot },
  { key: 'prompts', label: 'Prompt Intelligence', icon: MessageSquare },
  { key: 'graph', label: 'Knowledge Graph', icon: Database },
  { key: 'history', label: 'Update History', icon: Clock },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function completenessColor(pct: number): string {
  if (pct >= 80) return 'text-green-400';
  if (pct >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

function completenessRingColor(pct: number): string {
  if (pct >= 80) return '#22c55e';
  if (pct >= 50) return '#eab308';
  return '#ef4444';
}

function alertColor(level: 'green' | 'amber' | 'red'): string {
  return level === 'red' ? 'text-red-400' : level === 'amber' ? 'text-yellow-400' : 'text-green-400';
}

function trendIcon(trend: string): React.ReactElement {
  if (trend === 'improving') return <TrendingUp size={14} className="text-green-400" />;
  if (trend === 'declining') return <TrendingDown size={14} className="text-red-400" />;
  return <Minus size={14} className="text-surface-400" />;
}

// ─── Completeness Ring ────────────────────────────────────────────────────────

function CompletenessRing({ pct, size = 48 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const fill = (pct / 100) * circumference;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#334155" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={completenessRingColor(pct)}
        strokeWidth={4}
        strokeDasharray={`${fill} ${circumference - fill}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill="white" fontSize={size < 40 ? 9 : 11} fontWeight="bold">
        {pct}%
      </text>
    </svg>
  );
}

// ─── SubTopic Card ────────────────────────────────────────────────────────────

function SubTopicCard({ bible, onClick }: { bible: SubTopicBible; onClick: () => void }) {
  const completeness = getBibleCompleteness(bible);
  const alertLevel = bible.agentConnections.oracle.alertLevel;
  const lastUpdated = bible.lastUpdatedAt ? new Date(bible.lastUpdatedAt).toLocaleDateString() : '—';

  return (
    <button
      onClick={onClick}
      className="p-3 bg-surface-800 hover:bg-surface-750 border border-surface-700 hover:border-primary-500/50 rounded-lg text-left transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{bible.subtopicName}</p>
          <p className="text-xs text-surface-400 mt-0.5 truncate">{bible.subtopicId}</p>
        </div>
        <CompletenessRing pct={completeness} size={40} />
      </div>
      <div className="flex items-center gap-2 text-xs text-surface-400">
        <span className={alertColor(alertLevel)}>● {alertLevel}</span>
        <span>·</span>
        <span>v{bible.version}</span>
        <span>·</span>
        <span>{lastUpdated}</span>
      </div>
    </button>
  );
}

// ─── Full Bible Reader ────────────────────────────────────────────────────────

function BibleReader({ bible, onBack }: { bible: SubTopicBible; onBack: () => void }) {
  const [activeSection, setActiveSection] = useState('academic');
  const completeness = getBibleCompleteness(bible);
  const healthScore = getBibleHealthScore(bible);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-surface-400 hover:text-white transition-colors">
          <ChevronRight size={18} className="rotate-180" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">{bible.subtopicName}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full bg-surface-700 ${completenessColor(completeness)}`}>
              {completeness}% complete
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full bg-surface-700 ${alertColor(bible.agentConnections.oracle.alertLevel)}`}>
              {bible.agentConnections.oracle.alertLevel}
            </span>
          </div>
          <p className="text-xs text-surface-400">{bible.examId} › {bible.topicId} › {bible.subtopicId} · v{bible.version}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-surface-400">Health Score</p>
          <p className="text-2xl font-bold text-white">{healthScore}</p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-4 border-b border-surface-700">
        {READER_SECTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors ${
              activeSection === s.key
                ? 'bg-primary-600 text-white'
                : 'text-surface-400 hover:text-white hover:bg-surface-700'
            }`}
          >
            <s.icon size={12} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === 'academic' && <AcademicSection bible={bible} />}
        {activeSection === 'pedagogy' && <PedagogySection bible={bible} />}
        {activeSection === 'exam' && <ExamSection bible={bible} />}
        {activeSection === 'analytics' && <AnalyticsSection bible={bible} />}
        {activeSection === 'preferences' && <PreferencesSection bible={bible} />}
        {activeSection === 'search' && <SearchSection bible={bible} />}
        {activeSection === 'agents' && <AgentsSection bible={bible} />}
        {activeSection === 'prompts' && <PromptsSection bible={bible} />}
        {activeSection === 'graph' && <GraphSection bible={bible} />}
        {activeSection === 'history' && <HistorySection bible={bible} />}
      </div>
    </div>
  );
}

// ─── Section Components ───────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return <p className="text-surface-500 text-sm italic">{label}</p>;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-lg p-4 mb-3">
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      {children}
    </div>
  );
}

function AcademicSection({ bible }: { bible: SubTopicBible }) {
  const a = bible.academic;
  return (
    <div>
      <SectionCard title="Definition">
        {a.definition ? <p className="text-sm text-surface-200 leading-relaxed">{a.definition}</p> : <EmptyState label="No definition yet" />}
      </SectionCard>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <SectionCard title="Level">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-surface-400">Difficulty</span><span className="text-white capitalize">{a.difficulty}</span></div>
            <div className="flex justify-between"><span className="text-surface-400">Bloom's</span><span className="text-white capitalize">{a.bloomsLevel}</span></div>
            <div className="flex justify-between"><span className="text-surface-400">Est. Hours</span><span className="text-white">{a.estimatedMasteryHours}h</span></div>
          </div>
        </SectionCard>
        <SectionCard title="Prerequisites">
          {a.prerequisites.length > 0
            ? <div className="flex flex-wrap gap-1">{a.prerequisites.map(p => <span key={p} className="text-xs px-2 py-0.5 bg-surface-700 rounded text-surface-200">{p}</span>)}</div>
            : <EmptyState label="None" />}
        </SectionCard>
      </div>
      <SectionCard title="Real World Applications">
        {a.realWorldApplications.length > 0
          ? <ul className="space-y-1">{a.realWorldApplications.map((r, i) => <li key={i} className="text-sm text-surface-200">• {r}</li>)}</ul>
          : <EmptyState label="Not yet mapped" />}
      </SectionCard>
      <SectionCard title="Cross-Subject Connections">
        {a.crossSubjectConnections.length > 0
          ? <div className="flex flex-wrap gap-1">{a.crossSubjectConnections.map((c, i) => <span key={i} className="text-xs px-2 py-0.5 bg-blue-900/40 text-blue-300 rounded">{c}</span>)}</div>
          : <EmptyState label="Not yet mapped" />}
      </SectionCard>
    </div>
  );
}

function PedagogySection({ bible }: { bible: SubTopicBible }) {
  const p = bible.pedagogy;
  return (
    <div>
      <SectionCard title="Teaching Sequence">
        {p.teachingSequence.length > 0
          ? <ol className="space-y-1">{p.teachingSequence.map((s, i) => <li key={i} className="text-sm text-surface-200"><span className="text-primary-400 mr-2">{i + 1}.</span>{s}</li>)}</ol>
          : <EmptyState label="Not yet defined" />}
      </SectionCard>
      <SectionCard title="Common Misconceptions">
        {p.commonMisconceptions.length > 0
          ? p.commonMisconceptions.map((m, i) => (
              <div key={i} className="mb-3 last:mb-0 p-2 bg-red-900/20 border border-red-800/30 rounded">
                <div className="flex items-center gap-1 mb-1">
                  <AlertTriangle size={12} className="text-red-400" />
                  <span className="text-xs text-red-400 font-medium capitalize">{m.frequency.replace('_', ' ')}</span>
                </div>
                <p className="text-sm text-red-300">❌ {m.misconception}</p>
                <p className="text-sm text-green-300 mt-1">✓ {m.correction}</p>
              </div>
            ))
          : <EmptyState label="No misconceptions recorded yet" />}
      </SectionCard>
      <SectionCard title="Socratic Questions">
        {p.socraticQuestions.length > 0
          ? <ul className="space-y-2">{p.socraticQuestions.map((q, i) => <li key={i} className="text-sm text-surface-200 flex gap-2"><span className="text-purple-400">?</span>{q}</li>)}</ul>
          : <EmptyState label="No Socratic questions yet" />}
      </SectionCard>
      <SectionCard title="Effective Analogies">
        {p.effectiveAnalogies.length > 0
          ? p.effectiveAnalogies.map((a, i) => (
              <div key={i} className="mb-2 last:mb-0 p-2 bg-surface-750 rounded">
                <p className="text-sm text-surface-100">{a.analogy}</p>
                <p className="text-xs text-surface-400 mt-1">Works for: {a.worksFor.join(', ')}</p>
              </div>
            ))
          : <EmptyState label="No analogies recorded yet" />}
      </SectionCard>
    </div>
  );
}

function ExamSection({ bible }: { bible: SubTopicBible }) {
  const e = bible.examIntelligence;
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <SectionCard title="Weightage">
          <p className="text-2xl font-bold text-white">{e.weightage}%</p>
          <p className="text-xs text-surface-400">of total marks</p>
        </SectionCard>
        <SectionCard title="Avg Questions">
          <p className="text-2xl font-bold text-white">{e.averageQuestionsPerPaper}</p>
          <p className="text-xs text-surface-400">per paper</p>
        </SectionCard>
        <SectionCard title="Curve">
          <p className="text-sm font-medium text-white capitalize">{e.difficultyCurve.replace('_', ' ')}</p>
        </SectionCard>
      </div>
      <SectionCard title="High-Yield Formulas">
        {e.highYieldFormulas.length > 0
          ? <div className="space-y-1">{e.highYieldFormulas.map((f, i) => <div key={i} className="text-sm font-mono bg-surface-900 px-2 py-1 rounded text-amber-300">{f}</div>)}</div>
          : <EmptyState label="No formulas recorded yet" />}
      </SectionCard>
      <SectionCard title="Previous Year Questions">
        {e.pyqs.length > 0
          ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-surface-400 text-xs border-b border-surface-700">
                    <th className="text-left pb-2">Year</th>
                    <th className="text-left pb-2">Question</th>
                    <th className="text-left pb-2">Marks</th>
                    <th className="text-left pb-2">Difficulty</th>
                  </tr>
                </thead>
                <tbody>
                  {e.pyqs.map((q, i) => (
                    <tr key={i} className="border-b border-surface-800 hover:bg-surface-750">
                      <td className="py-2 pr-3 text-primary-400 whitespace-nowrap">{q.year}</td>
                      <td className="py-2 pr-3 text-surface-200">{q.question}</td>
                      <td className="py-2 pr-3 text-surface-300">{q.marks}</td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                          q.difficulty === 'hard' ? 'bg-red-900/40 text-red-300'
                          : q.difficulty === 'medium' ? 'bg-yellow-900/40 text-yellow-300'
                          : 'bg-green-900/40 text-green-300'
                        }`}>{q.difficulty}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
          : <EmptyState label="No PYQs recorded yet" />}
      </SectionCard>
      <SectionCard title="Exam Tips">
        {e.examSpecificTips ? <p className="text-sm text-surface-200">{e.examSpecificTips}</p> : <EmptyState label="No tips yet" />}
      </SectionCard>
    </div>
  );
}

function AnalyticsSection({ bible }: { bible: SubTopicBible }) {
  const a = bible.analytics;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <SectionCard title="Students Taught">
          <p className="text-2xl font-bold text-white">{a.totalStudentsTaught.toLocaleString()}</p>
        </SectionCard>
        <SectionCard title="Avg Mastery">
          <p className="text-2xl font-bold text-white">{a.averageMasteryScore}%</p>
        </SectionCard>
        <SectionCard title="Completion Rate">
          <p className="text-2xl font-bold text-white">{Math.round(a.completionRate * 100)}%</p>
        </SectionCard>
        <SectionCard title="Dropoff Rate">
          <p className={`text-2xl font-bold ${a.dropoffRate > 0.4 ? 'text-red-400' : 'text-white'}`}>
            {Math.round(a.dropoffRate * 100)}%
          </p>
        </SectionCard>
      </div>
      <SectionCard title="Trend">
        <div className="flex items-center gap-2">{trendIcon(a.recentTrend)}<span className="text-sm text-surface-200 capitalize">{a.recentTrend}</span></div>
      </SectionCard>
      <SectionCard title="Common Stuck Points">
        {a.commonStuckPoints.length > 0
          ? <ul className="space-y-1">{a.commonStuckPoints.map((s, i) => <li key={i} className="text-sm text-surface-200 flex gap-2"><AlertCircle size={12} className="text-yellow-400 mt-0.5 shrink-0" />{s}</li>)}</ul>
          : <EmptyState label="No stuck points recorded yet" />}
      </SectionCard>
    </div>
  );
}

function PreferencesSection({ bible }: { bible: SubTopicBible }) {
  const p = bible.studentPreferences;
  const styles = Object.entries(p.preferredLearningStyles).sort((a, b) => b[1] - a[1]);
  const formats = Object.entries(p.preferredFormats).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <SectionCard title="Preferred Learning Styles">
        {styles.length > 0
          ? styles.map(([style, pct]) => (
              <div key={style} className="flex items-center gap-2 mb-2">
                <span className="text-sm text-surface-300 w-32 capitalize">{style.replace('_', ' ')}</span>
                <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-surface-400 w-10 text-right">{pct}%</span>
              </div>
            ))
          : <EmptyState label="No preference data yet" />}
      </SectionCard>
      <SectionCard title="Preferred Content Formats">
        {formats.length > 0
          ? formats.slice(0, 6).map(([fmt, score]) => (
              <div key={fmt} className="flex items-center gap-2 mb-2">
                <span className="text-sm text-surface-300 w-32 capitalize">{fmt.replace('_', ' ')}</span>
                <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${score}%` }} />
                </div>
                <span className="text-xs text-surface-400 w-10 text-right">{score}</span>
              </div>
            ))
          : <EmptyState label="No format data yet" />}
      </SectionCard>
      <div className="grid grid-cols-2 gap-3">
        <SectionCard title="Device Preference">
          <p className="text-sm text-white capitalize">{p.devicePreference}</p>
        </SectionCard>
        <SectionCard title="Best Time of Day">
          <p className="text-sm text-white capitalize">{p.bestTimeOfDay.replace('_', ' ')}</p>
        </SectionCard>
      </div>
    </div>
  );
}

function SearchSection({ bible }: { bible: SubTopicBible }) {
  const s = bible.searchIntelligence;
  return (
    <div>
      <SectionCard title="Top Search Queries">
        {s.topSearchQueries.length > 0
          ? <div className="flex flex-wrap gap-1">{s.topSearchQueries.map((q, i) => <span key={i} className="text-xs px-2 py-1 bg-surface-700 rounded text-surface-200">{q}</span>)}</div>
          : <EmptyState label="No search queries yet" />}
      </SectionCard>
      <SectionCard title="Content Gaps">
        {s.contentGaps.length > 0
          ? <ul className="space-y-1">{s.contentGaps.map((g, i) => <li key={i} className="text-sm text-surface-200 flex gap-2"><AlertCircle size={12} className="text-red-400 mt-0.5 shrink-0" />{g}</li>)}</ul>
          : <EmptyState label="No content gaps identified" />}
      </SectionCard>
      <SectionCard title="External Search Trends">
        {s.externalSearchTrends.length > 0
          ? s.externalSearchTrends.map((t, i) => (
              <div key={i} className="flex items-center justify-between mb-1">
                <span className="text-sm text-surface-200">{t.keyword}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${t.trend === 'rising' ? 'text-green-400' : t.trend === 'falling' ? 'text-red-400' : 'text-surface-400'}`}>{t.trend}</span>
                  <span className="text-xs text-surface-400 capitalize">{t.volume}</span>
                </div>
              </div>
            ))
          : <EmptyState label="No external trend data yet" />}
      </SectionCard>
    </div>
  );
}

function AgentsSection({ bible }: { bible: SubTopicBible }) {
  const ac = bible.agentConnections;
  const agents = [
    { name: 'Atlas', emoji: '📚', data: [
      { label: 'Content Coverage', value: `${ac.atlas.contentCoverage}%` },
      { label: 'Last Generated', value: ac.atlas.lastGenerated ? new Date(ac.atlas.lastGenerated).toLocaleDateString() : '—' },
      { label: 'Priority', value: ac.atlas.generationPriority },
    ]},
    { name: 'Sage', emoji: '🎓', data: [
      { label: 'Total Sessions', value: String(ac.sage.totalSessions) },
      { label: 'Avg Socratic Depth', value: `${ac.sage.avgSocraticDepth}/5` },
      { label: 'Last Taught', value: ac.sage.lastTaughtAt ? new Date(ac.sage.lastTaughtAt).toLocaleDateString() : '—' },
    ]},
    { name: 'Oracle', emoji: '📊', data: [
      { label: 'Alert Level', value: ac.oracle.alertLevel },
      { label: 'Last Analyzed', value: ac.oracle.lastAnalyzed ? new Date(ac.oracle.lastAnalyzed).toLocaleDateString() : '—' },
    ]},
    { name: 'Scout', emoji: '🔍', data: [
      { label: 'Market Position', value: ac.scout.marketPosition },
      { label: 'Last Researched', value: ac.scout.lastResearched ? new Date(ac.scout.lastResearched).toLocaleDateString() : '—' },
    ]},
    { name: 'Mentor', emoji: '💪', data: [
      { label: 'Nudges Sent', value: String(ac.mentor.nudgesSent) },
      { label: 'Effectiveness', value: `${Math.round(ac.mentor.nudgeEffectiveness * 100)}%` },
    ]},
    { name: 'Herald', emoji: '📣', data: [
      { label: 'Content Published', value: String(ac.herald.contentPublished) },
      { label: 'Last Published', value: ac.herald.lastPublishedAt ? new Date(ac.herald.lastPublishedAt).toLocaleDateString() : '—' },
    ]},
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {agents.map(agent => (
        <div key={agent.name} className="bg-surface-800 border border-surface-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span>{agent.emoji}</span>
            <span className="text-sm font-semibold text-white">{agent.name}</span>
          </div>
          {agent.data.map(d => (
            <div key={d.label} className="flex justify-between text-xs mb-1">
              <span className="text-surface-400">{d.label}</span>
              <span className="text-surface-200 capitalize">{d.value}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function PromptsSection({ bible }: { bible: SubTopicBible }) {
  const pi = bible.promptIntelligence;
  return (
    <div>
      <SectionCard title="Best Template Key">
        {pi.bestTemplateKey
          ? <code className="text-sm font-mono text-primary-300 bg-surface-900 px-2 py-1 rounded block">{pi.bestTemplateKey}</code>
          : <EmptyState label="Not yet determined" />}
      </SectionCard>
      <SectionCard title="Effective Prompts">
        {pi.effectiveSystemPrompts.length > 0
          ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-surface-400 border-b border-surface-700">
                    <th className="text-left pb-2">Style</th>
                    <th className="text-left pb-2">Objective</th>
                    <th className="text-left pb-2">Success %</th>
                    <th className="text-left pb-2">Uses</th>
                  </tr>
                </thead>
                <tbody>
                  {pi.effectiveSystemPrompts.slice(0, 5).map((p, i) => (
                    <tr key={i} className="border-b border-surface-800">
                      <td className="py-1.5 pr-3 text-surface-200 capitalize">{p.style}</td>
                      <td className="py-1.5 pr-3 text-surface-200 capitalize">{p.objective}</td>
                      <td className="py-1.5 pr-3 text-green-400">{Math.round(p.successRate * 100)}%</td>
                      <td className="py-1.5 text-surface-400">{p.usageCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
          : <EmptyState label="No prompt data yet" />}
      </SectionCard>
    </div>
  );
}

function GraphSection({ bible }: { bible: SubTopicBible }) {
  const g = bible.knowledgeGraph;
  return (
    <div>
      <SectionCard title="Cluster">
        <span className="text-sm px-2 py-1 bg-blue-900/30 text-blue-300 rounded">{g.clusterTag || 'Unassigned'}</span>
      </SectionCard>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <SectionCard title="Incoming Links">
          {g.incomingLinks.length > 0
            ? <div className="flex flex-wrap gap-1">{g.incomingLinks.map((l, i) => <span key={i} className="text-xs px-2 py-0.5 bg-surface-700 rounded text-surface-200">{l}</span>)}</div>
            : <EmptyState label="None" />}
        </SectionCard>
        <SectionCard title="Outgoing Links">
          {g.outgoingLinks.length > 0
            ? <div className="flex flex-wrap gap-1">{g.outgoingLinks.map((l, i) => <span key={i} className="text-xs px-2 py-0.5 bg-surface-700 rounded text-surface-200">{l}</span>)}</div>
            : <EmptyState label="None" />}
        </SectionCard>
      </div>
      <SectionCard title="Cross-Exam Relevance">
        {Object.keys(g.crossExamRelevance).length > 0
          ? Object.entries(g.crossExamRelevance).map(([exam, rel]) => (
              <div key={exam} className="flex items-center gap-2 mb-2">
                <span className="text-sm text-surface-300 w-20">{exam}</span>
                <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${rel * 100}%` }} />
                </div>
                <span className="text-xs text-surface-400 w-8 text-right">{Math.round(rel * 100)}%</span>
              </div>
            ))
          : <EmptyState label="No cross-exam data yet" />}
      </SectionCard>
    </div>
  );
}

function HistorySection({ bible }: { bible: SubTopicBible }) {
  const history = [...bible.updateHistory].reverse().slice(0, 20);
  return (
    <SectionCard title="Update History (last 20)">
      {history.length > 0
        ? (
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-xs border-b border-surface-800 pb-2 last:border-0">
                <span className="text-surface-500 whitespace-nowrap">{new Date(h.updatedAt).toLocaleString()}</span>
                <span className="text-primary-400">{h.updatedBy}</span>
                <span className="text-surface-400">updated</span>
                <span className="text-surface-200">{h.field}</span>
              </div>
            ))}
          </div>
        )
        : <EmptyState label="No updates recorded yet" />}
    </SectionCard>
  );
}

// ─── Tab 1: Bible Browser ─────────────────────────────────────────────────────

function BibleBrowserTab() {
  const [bibles, setBibles] = useState<SubTopicBible[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('ALL');
  const [selectedTopic, setSelectedTopic] = useState<string>('ALL');
  const [activeBible, setActiveBible] = useState<SubTopicBible | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setBibles(getAllBibles());
  }, []);

  const exams = ['ALL', ...Array.from(new Set(bibles.map(b => b.examId)))];
  const topics = ['ALL', ...Array.from(new Set(bibles.filter(b => selectedExam === 'ALL' || b.examId === selectedExam).map(b => b.topicId)))];

  const filtered = bibles.filter(b => {
    if (selectedExam !== 'ALL' && b.examId !== selectedExam) return false;
    if (selectedTopic !== 'ALL' && b.topicId !== selectedTopic) return false;
    if (searchQuery && !b.subtopicName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (activeBible) {
    return <BibleReader bible={activeBible} onBack={() => setActiveBible(null)} />;
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search subtopics..."
            className="pl-7 pr-3 py-1.5 bg-surface-800 border border-surface-700 rounded-md text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500"
          />
        </div>
        <select
          value={selectedExam}
          onChange={e => { setSelectedExam(e.target.value); setSelectedTopic('ALL'); }}
          className="px-3 py-1.5 bg-surface-800 border border-surface-700 rounded-md text-sm text-white"
        >
          {exams.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select
          value={selectedTopic}
          onChange={e => setSelectedTopic(e.target.value)}
          className="px-3 py-1.5 bg-surface-800 border border-surface-700 rounded-md text-sm text-white"
        >
          {topics.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-xs text-surface-400 self-center">{filtered.length} subtopics</span>
      </div>

      {/* Grid */}
      {filtered.length > 0
        ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {filtered.map(bible => (
              <SubTopicCard key={bible.id} bible={bible} onClick={() => setActiveBible(bible)} />
            ))}
          </div>
        )
        : (
          <div className="text-center py-12 text-surface-500">
            <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
            <p>No subtopics found. {bibles.length === 0 ? 'Bibles are being seeded...' : 'Try adjusting filters.'}</p>
          </div>
        )}
    </div>
  );
}

// ─── Tab 2: Bible Health ──────────────────────────────────────────────────────

function BibleHealthTab() {
  const [bibles, setBibles] = useState<SubTopicBible[]>([]);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<{ audited: number; gaps: number; queued: number } | null>(null);

  useEffect(() => { setBibles(getAllBibles()); }, []);

  const withGaps = bibles.map(b => ({ bible: b, completeness: getBibleCompleteness(b) }))
    .filter(({ completeness }) => completeness < 80)
    .sort((a, b) => a.completeness - b.completeness);

  const handleReconcile = async () => {
    setReconciling(true);
    try {
      const result = await reconcileBibles();
      setReconcileResult(result);
      setBibles(getAllBibles()); // refresh
    } finally {
      setReconciling(false);
    }
  };

  // Heatmap data: exam × topic
  const examTopics: Record<string, Record<string, number>> = {};
  for (const b of bibles) {
    if (!examTopics[b.examId]) examTopics[b.examId] = {};
    const existing = examTopics[b.examId][b.topicId];
    const c = getBibleCompleteness(b);
    examTopics[b.examId][b.topicId] = existing === undefined ? c : Math.round((existing + c) / 2);
  }

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-surface-800 border border-surface-700 rounded-lg p-3">
          <p className="text-xs text-surface-400 mb-1">Total Bibles</p>
          <p className="text-2xl font-bold text-white">{bibles.length}</p>
        </div>
        <div className="bg-surface-800 border border-surface-700 rounded-lg p-3">
          <p className="text-xs text-surface-400 mb-1">Healthy (≥80%)</p>
          <p className="text-2xl font-bold text-green-400">{bibles.filter(b => getBibleCompleteness(b) >= 80).length}</p>
        </div>
        <div className="bg-surface-800 border border-surface-700 rounded-lg p-3">
          <p className="text-xs text-surface-400 mb-1">Need Attention</p>
          <p className="text-2xl font-bold text-red-400">{withGaps.length}</p>
        </div>
      </div>

      {/* Fill All Gaps */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleReconcile}
          disabled={reconciling}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
        >
          <RefreshCw size={14} className={reconciling ? 'animate-spin' : ''} />
          {reconciling ? 'Reconciling...' : 'Fill All Gaps'}
        </button>
        {reconcileResult && (
          <p className="text-sm text-surface-300">
            Audited {reconcileResult.audited} · {reconcileResult.gaps} gaps found · {reconcileResult.queued} queued
          </p>
        )}
      </div>

      {/* Heatmap */}
      <div className="bg-surface-800 border border-surface-700 rounded-lg p-4 mb-4 overflow-x-auto">
        <h3 className="text-sm font-semibold text-white mb-3">Completeness Heatmap (Exam × Topic)</h3>
        <table className="text-xs">
          <tbody>
            {Object.entries(examTopics).map(([exam, topics]) => (
              <tr key={exam}>
                <td className="text-surface-400 pr-3 whitespace-nowrap py-1">{exam}</td>
                {Object.entries(topics).map(([topic, pct]) => (
                  <td key={topic} className="pr-1 py-1">
                    <div
                      title={`${exam} › ${topic}: ${pct}%`}
                      className="w-12 h-8 rounded flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: pct >= 80 ? '#16a34a33' : pct >= 50 ? '#ca8a0433' : '#dc262633', color: pct >= 80 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444' }}
                    >
                      {pct}%
                    </div>
                    <div className="text-center text-surface-500 text-xs truncate w-12">{topic.replace('_', ' ')}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Gaps table */}
      <div className="bg-surface-800 border border-surface-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Top Gaps (sorted by priority)</h3>
        {withGaps.length > 0
          ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-surface-400 text-xs border-b border-surface-700">
                  <th className="text-left pb-2">Subtopic</th>
                  <th className="text-left pb-2">Exam</th>
                  <th className="text-left pb-2">Completeness</th>
                  <th className="text-left pb-2">Alert</th>
                </tr>
              </thead>
              <tbody>
                {withGaps.slice(0, 15).map(({ bible, completeness }) => (
                  <tr key={bible.id} className="border-b border-surface-800">
                    <td className="py-2 pr-3 text-surface-200">{bible.subtopicName}</td>
                    <td className="py-2 pr-3 text-surface-400">{bible.examId}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${completeness}%`, backgroundColor: completenessRingColor(completeness) }} />
                        </div>
                        <span className={completenessColor(completeness)}>{completeness}%</span>
                      </div>
                    </td>
                    <td className="py-2">
                      <span className={`text-xs ${alertColor(bible.agentConnections.oracle.alertLevel)}`}>
                        ● {bible.agentConnections.oracle.alertLevel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
          : <p className="text-green-400 text-sm flex items-center gap-2"><CheckCircle size={14} />All bibles are healthy!</p>}
      </div>
    </div>
  );
}

// ─── Tab 3: Progressive Updates ───────────────────────────────────────────────

function ProgressiveUpdatesTab() {
  const [bibles, setBibles] = useState<SubTopicBible[]>([]);
  const [enriching, setEnriching] = useState<string | null>(null);

  useEffect(() => { setBibles(getAllBibles()); }, []);

  // Collect recent updates from all bibles
  const allUpdates = bibles
    .flatMap(b => b.updateHistory.map(u => ({ ...u, bible: b })))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 50);

  const handleEnrich = async (bible: SubTopicBible) => {
    setEnriching(bible.id);
    try {
      const { enrichBible } = await import('@/services/bibleProgressiveUpdater');
      await enrichBible(bible);
      setBibles(getAllBibles());
    } finally {
      setEnriching(null);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        {/* Update log */}
        <div className="bg-surface-800 border border-surface-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Live Update Log (last 50)</h3>
          {allUpdates.length > 0
            ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {allUpdates.map((u, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs border-b border-surface-800 pb-2 last:border-0">
                    <span className="text-surface-500 whitespace-nowrap">{new Date(u.updatedAt).toLocaleTimeString()}</span>
                    <div>
                      <span className="text-primary-400">{u.updatedBy}</span>
                      <span className="text-surface-400"> updated </span>
                      <span className="text-surface-200">{u.field}</span>
                      <span className="text-surface-500"> on {u.bible.subtopicName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
            : <p className="text-surface-500 text-sm">No updates recorded yet</p>}
        </div>

        {/* Enrichment queue */}
        <div className="bg-surface-800 border border-surface-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Enrichment Queue</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {bibles.filter(b => getBibleCompleteness(b) < 60).slice(0, 10).map(bible => (
              <div key={bible.id} className="flex items-center justify-between p-2 bg-surface-750 rounded">
                <div>
                  <p className="text-sm text-white">{bible.subtopicName}</p>
                  <p className="text-xs text-surface-400">{bible.examId} · {getBibleCompleteness(bible)}% complete</p>
                </div>
                <button
                  onClick={() => handleEnrich(bible)}
                  disabled={enriching === bible.id}
                  className="flex items-center gap-1 px-2 py-1 bg-primary-600/30 hover:bg-primary-600/50 text-primary-300 rounded text-xs disabled:opacity-50 transition-colors"
                >
                  <Zap size={12} className={enriching === bible.id ? 'animate-pulse' : ''} />
                  {enriching === bible.id ? 'Enriching...' : 'Enrich'}
                </button>
              </div>
            ))}
            {bibles.filter(b => getBibleCompleteness(b) < 60).length === 0 && (
              <p className="text-green-400 text-sm flex items-center gap-2"><CheckCircle size={14} />All bibles are sufficiently complete!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SubTopicBibleViewer() {
  const [activeTab, setActiveTab] = useState<ViewTab>('browser');

  const tabs: { key: ViewTab; label: string; icon: React.ElementType }[] = [
    { key: 'browser', label: 'Bible Browser', icon: BookOpen },
    { key: 'health', label: 'Bible Health', icon: Star },
    { key: 'updates', label: 'Progressive Updates', icon: RefreshCw },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen size={24} className="text-primary-400" />
            <h1 className="text-2xl font-bold text-white">SubTopic Bible</h1>
          </div>
          <p className="text-sm text-surface-400 mt-1">Universal knowledge graph — single source of truth for every course subtopic</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-surface-400">
          <Eye size={14} />
          <span>Reads updated on every agent action</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-surface-700">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 -mb-px border-b-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-surface-400 hover:text-white'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'browser' && <BibleBrowserTab />}
        {activeTab === 'health' && <BibleHealthTab />}
        {activeTab === 'updates' && <ProgressiveUpdatesTab />}
      </div>
    </div>
  );
}
