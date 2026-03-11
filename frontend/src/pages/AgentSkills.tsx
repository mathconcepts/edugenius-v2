/**
 * AgentSkills.tsx — Agent Skills Registry + Prompt Template Manager
 * CEO view of all VoltAgent-inspired skills and their connections
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Brain, BarChart2, FileCode, Users, Video, Mic, Plus, Trash2, Eye, ChevronUp, RefreshCw, ChevronDown, AlertTriangle, TrendingUp, TrendingDown, Minus as MinusIcon } from 'lucide-react';
import { getAllTemplates, saveCustomTemplate, deleteCustomTemplate, type PromptTemplate } from '@/services/skills/dynamicPromptsSkill';
import { getEvalSummary } from '@/services/skills/liveEvalsSkill';
import { isSpeechAvailable, canUsePremiumVoice } from '@/services/skills/voiceSkill';
import {
  buildUserResearchReport,
  loadResearchReport,
  saveResearchReport,
  type UserResearchReport,
  type ResearchSubtopic,
} from '@/services/skills/userResearchSkill';

// ── Skill Registry (static metadata) ─────────────────────────────────────────

interface SkillMeta {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  agents: string[];
  connectedPrompts: string[];
  storageKey: string;
  status: 'active' | 'degraded' | 'inactive';
}

const SKILLS: SkillMeta[] = [
  {
    id: 'guardrails', name: 'Guard Rails', icon: Shield,
    description: 'Content safety + pedagogical enforcement. Blocks cheating, detects crisis, enforces Socratic mode.',
    agents: ['Sage'], connectedPrompts: ['sage-mcq-socratic', 'buildSageSystemPrompt'],
    storageKey: 'edugenius_skill_guardrails_enabled', status: 'active',
  },
  {
    id: 'thinking_tool', name: 'Thinking Tool', icon: Brain,
    description: '6-phase structured reasoning (Understand→Identify→Plan→Execute→Verify→Summarize) for complex problems.',
    agents: ['Sage', 'Atlas'], connectedPrompts: ['atlas-content-gen', 'buildSageSystemPrompt'],
    storageKey: 'edugenius_skill_thinking_tool_enabled', status: 'active',
  },
  {
    id: 'live_evals', name: 'Live Evals', icon: BarChart2,
    description: 'Real-time heuristic scoring of every Sage response on 6 metrics. Oracle aggregates for quality dashboard.',
    agents: ['Oracle', 'Sage'], connectedPrompts: ['oracle-insight'],
    storageKey: 'edugenius_skill_live_evals_enabled', status: 'active',
  },
  {
    id: 'dynamic_prompts', name: 'Dynamic Prompts', icon: FileCode,
    description: 'Versioned, testable prompt templates for all agents. 6 built-in + custom templates.',
    agents: ['Sage', 'Atlas', 'Herald', 'Scout', 'Oracle', 'Mentor'],
    connectedPrompts: ['sage-mcq-socratic', 'atlas-content-gen', 'herald-blog-seo', 'scout-market-analysis', 'mentor-reengagement', 'oracle-insight'],
    storageKey: 'edugenius_skill_dynamic_prompts_enabled', status: 'active',
  },
  {
    id: 'user_research', name: 'User Research', icon: Users,
    description: 'Student archetype profiling (Grinder/Strategist/Panicker/Casual/Topper). Injected into Sage + Mentor prompts.',
    agents: ['Scout', 'Oracle', 'Sage', 'Mentor'],
    connectedPrompts: ['mentor-reengagement', 'oracle-insight', 'buildSageSystemPrompt'],
    storageKey: 'edugenius_skill_user_research_enabled', status: 'active',
  },
  {
    id: 'media_content', name: 'Media Content', icon: Video,
    description: 'Platform-specific content for Instagram/LinkedIn/YouTube/Shorts/WhatsApp/Google Ads with A/B variants.',
    agents: ['Herald', 'Atlas'],
    connectedPrompts: ['herald-blog-seo', 'atlas-content-gen'],
    storageKey: 'edugenius_skill_media_content_enabled', status: 'active',
  },
  {
    id: 'voice', name: 'Voice Output', icon: Mic,
    description: 'Text-to-speech for Sage explanations. Browser TTS always available; upgrades to ElevenLabs/OpenAI when configured.',
    agents: ['Sage', 'Mentor'],
    connectedPrompts: ['sage-mcq-socratic'],
    storageKey: 'edugenius_skill_voice_enabled', status: 'active',
  },
  {
    id: 'social_intent_scout', name: 'Social Intent Scout', icon: Users,
    description: '5-agent social intelligence pipeline: IntentScout monitors Reddit/Quora/X/YouTube for student questions, AnswerCrafter generates humanized answers, HookSmith adds platform-specific CTAs, ApprovalGate routes through admin review, PostScheduler posts at optimal IST times.',
    agents: ['Scout', 'Atlas', 'Herald', 'Forge'],
    connectedPrompts: ['atlas-content-gen', 'scout-market-analysis', 'herald-blog-seo'],
    storageKey: 'edugenius_skill_social_intent_enabled', status: 'active',
  },
];

// ── User Research Report Components ──────────────────────────────────────────

const CONFIDENCE_STYLE: Record<string, string> = {
  HIGH:   'bg-emerald-900/30 text-emerald-300 border-emerald-700',
  MEDIUM: 'bg-yellow-900/30 text-yellow-300 border-yellow-700',
  LOW:    'bg-surface-700 text-surface-400 border-surface-600',
};

const SIGNAL_STYLE: Record<string, string> = {
  CHURN_RISK:       'text-red-400',
  FRUSTRATION_ALERT:'text-orange-400',
  CONTENT_GAP:      'text-fuchsia-400',
  ENGAGEMENT_GAP:   'text-amber-400',
  FORMAT_REQUEST:   'text-blue-400',
};

function SubtopicCard({ subtopic, defaultOpen = false }: { subtopic: ResearchSubtopic; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-surface-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-surface-800 hover:bg-surface-750 transition-colors text-left"
      >
        <span className="text-base">{subtopic.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-surface-100">{subtopic.title}</span>
            <span className={`px-1.5 py-0.5 rounded text-xs border font-medium ${CONFIDENCE_STYLE[subtopic.confidence.toUpperCase()] ?? CONFIDENCE_STYLE.LOW}`}>
              {subtopic.confidence}
            </span>
            {subtopic.signalToEmit && (
              <span className={`text-xs font-mono font-medium ${SIGNAL_STYLE[subtopic.signalToEmit] ?? 'text-surface-400'}`}>
                → {subtopic.signalToEmit}
              </span>
            )}
          </div>
          <p className="text-xs text-surface-400 mt-0.5 truncate">{subtopic.summary.split('.')[0]}.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex gap-1">
            {subtopic.responsibleAgents.slice(0, 3).map(a => (
              <span key={a} className="text-xs bg-surface-700 text-surface-400 px-1.5 py-0.5 rounded-full capitalize">{a}</span>
            ))}
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-surface-400" /> : <ChevronDown className="w-4 h-4 text-surface-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 py-4 bg-surface-900/60 space-y-4">
          {/* 4-field grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">📝 Summary</p>
              <p className="text-sm text-surface-200 leading-relaxed">{subtopic.summary}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">👤 User Intent</p>
              <p className="text-sm text-surface-300 leading-relaxed italic">"{subtopic.userIntent}"</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">📡 Data Sources</p>
              <div className="flex flex-wrap gap-1">
                {subtopic.dataSources.map(src => (
                  <span key={src} className="text-xs bg-surface-800 text-surface-400 px-2 py-0.5 rounded-full">
                    {src.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">⚡ Action Objective</p>
              <p className="text-sm text-primary-300 leading-relaxed">{subtopic.actionObjective}</p>
            </div>
          </div>
          <p className="text-xs text-surface-600">
            Updated: {new Date(subtopic.updatedAt).toLocaleString()} · Agents: {subtopic.responsibleAgents.join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}

function UserResearchSection() {
  const [report, setReport] = useState<UserResearchReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTable, setShowTable] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const userId = 'live-user';

  // Load from storage on mount
  useEffect(() => {
    const stored = loadResearchReport(userId);
    if (stored) setReport(stored);
  }, []);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const r = buildUserResearchReport(userId, report ?? undefined);
      saveResearchReport(r);
      setReport(r);
      setIsGenerating(false);
    }, 400);
  };

  const trajectoryIcon = (t: string) => {
    if (t === 'accelerating') return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    if (t === 'declining') return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <MinusIcon className="w-4 h-4 text-yellow-400" />;
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">User Research Report</h2>
          <p className="text-xs text-surface-500 mt-0.5">Per-subtopic analysis: intent, data sources, and system-determined action objectives. Updates progressively as new signals arrive.</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
          {report ? 'Refresh Report' : 'Generate Report'}
        </button>
      </div>

      {!report && !isGenerating && (
        <div className="flex flex-col items-center justify-center py-12 text-surface-500 space-y-2 border border-dashed border-surface-700 rounded-xl">
          <Users className="w-8 h-8 opacity-30" />
          <p className="text-sm">No research report yet — click Generate to build from available student signals.</p>
        </div>
      )}

      {report && (
        <>
          {/* Report header */}
          <div className="bg-surface-900 border border-surface-700 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-lg font-bold text-white">{report.profile.archetype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                  <span className="text-xs bg-surface-700 text-surface-300 px-2 py-0.5 rounded-full">{report.exam}</span>
                  <span className="flex items-center gap-1 text-xs text-surface-400">
                    {trajectoryIcon(report.profile.trajectoryLabel)} {report.profile.trajectoryLabel}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-surface-500">
                  <span>{report.subtopics.length} subtopics analysed</span>
                  <span>{report.subtopics.filter(s => s.signalToEmit).length} signals ready to emit</span>
                  <span>Updated: {new Date(report.updatedAt).toLocaleTimeString()}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTable(t => !t)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-surface-800 text-surface-300 hover:text-white transition-colors"
                >
                  {showTable ? 'Hide' : 'Show'} Table
                </button>
                <button
                  onClick={() => setShowLog(l => !l)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-surface-800 text-surface-300 hover:text-white transition-colors"
                >
                  Update Log ({report.updateLog.length})
                </button>
              </div>
            </div>

            {/* Update log */}
            {showLog && (
              <div className="mt-4 border-t border-surface-700 pt-3 space-y-1 max-h-36 overflow-y-auto">
                {[...report.updateLog].reverse().map((entry, i) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <span className="text-surface-600 flex-shrink-0">{new Date(entry.ts).toLocaleTimeString()}</span>
                    <span className="text-surface-400">{entry.change}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Consolidated summary table */}
          {showTable && (
            <div className="overflow-x-auto rounded-xl border border-surface-700">
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="bg-surface-800 text-surface-400 uppercase tracking-wider">
                    <th className="px-3 py-2.5 text-left">Subtopic</th>
                    <th className="px-3 py-2.5 text-left">Key Finding</th>
                    <th className="px-3 py-2.5 text-left">User Intent</th>
                    <th className="px-3 py-2.5 text-left">Data Source</th>
                    <th className="px-3 py-2.5 text-left">Action Objective</th>
                    <th className="px-3 py-2.5 text-left">Agents</th>
                    <th className="px-3 py-2.5 text-left">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  {report.consolidatedTable.map((row, i) => (
                    <tr key={i} className="bg-surface-900 hover:bg-surface-800/50 transition-colors">
                      <td className="px-3 py-2 font-medium text-surface-200 whitespace-nowrap">{row.subtopic}</td>
                      <td className="px-3 py-2 text-surface-300 max-w-xs">{row.keyFinding}</td>
                      <td className="px-3 py-2 text-surface-400 italic max-w-xs">{row.userIntent}</td>
                      <td className="px-3 py-2 text-surface-500 whitespace-nowrap">{row.primarySource}</td>
                      <td className="px-3 py-2 text-primary-400 max-w-xs">{row.actionObjective}</td>
                      <td className="px-3 py-2 text-surface-400 whitespace-nowrap">{row.agents}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded border text-xs font-medium ${CONFIDENCE_STYLE[row.confidence] ?? CONFIDENCE_STYLE.LOW}`}>
                          {row.confidence}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Subtopic deep-dive cards */}
          <div className="space-y-2">
            {report.subtopics.map((subtopic, i) => (
              <SubtopicCard key={subtopic.id} subtopic={subtopic} defaultOpen={i === 0} />
            ))}
          </div>

          {/* Signals ready to emit */}
          {report.subtopics.some(s => s.signalToEmit) && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-900/20 border border-amber-700">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-300 mb-1">Signals ready to emit</p>
                <div className="flex flex-wrap gap-2">
                  {report.subtopics
                    .filter(s => s.signalToEmit)
                    .map(s => (
                      <span key={s.id} className={`text-xs font-mono font-medium ${SIGNAL_STYLE[s.signalToEmit!] ?? 'text-surface-300'}`}>
                        {s.emoji} {s.signalToEmit} → {s.responsibleAgents.join(', ')}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AgentSkills() {
  const [skillStates, setSkillStates] = useState<Record<string, boolean>>(() => {
    const states: Record<string, boolean> = {};
    SKILLS.forEach(s => {
      try {
        const stored = localStorage.getItem(s.storageKey);
        states[s.id] = stored === null ? true : stored === 'true';
      } catch { states[s.id] = true; }
    });
    return states;
  });

  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [evalSummary, setEvalSummary] = useState<Record<string, { avgScore: number; total: number; passing: number }>>({});
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    id: '', agentId: 'sage', name: '', description: '', version: '1.0.0', template: '', tags: '',
  });
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [voicePremium, setVoicePremium] = useState(false);

  useEffect(() => {
    setTemplates(getAllTemplates());
    setEvalSummary(getEvalSummary());
    setVoiceAvailable(isSpeechAvailable());
    setVoicePremium(canUsePremiumVoice());
  }, []);

  const toggleSkill = (skillId: string) => {
    const skill = SKILLS.find(s => s.id === skillId);
    if (!skill) return;
    const next = !skillStates[skillId];
    setSkillStates(prev => ({ ...prev, [skillId]: next }));
    try { localStorage.setItem(skill.storageKey, String(next)); } catch { /**/ }
  };

  const handleSaveTemplate = () => {
    if (!newTemplate.id || !newTemplate.name || !newTemplate.template) return;
    saveCustomTemplate({
      id: newTemplate.id,
      agentId: newTemplate.agentId,
      name: newTemplate.name,
      description: newTemplate.description,
      version: newTemplate.version,
      template: newTemplate.template,
      variables: [],
      tags: newTemplate.tags.split(',').map(t => t.trim()).filter(Boolean),
    });
    setTemplates(getAllTemplates());
    setShowAddForm(false);
    setNewTemplate({ id: '', agentId: 'sage', name: '', description: '', version: '1.0.0', template: '', tags: '' });
  };

  const handleDeleteTemplate = (id: string) => {
    deleteCustomTemplate(id);
    setTemplates(getAllTemplates());
  };

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-6 space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Agent Skills</h1>
        <p className="text-sm text-surface-400 mt-1">
          VoltAgent-inspired skill modules wired into EduGenius agents. Toggle skills and manage prompt templates.
        </p>
      </div>

      {/* Skills Grid */}
      <section>
        <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-4">Installed Skills</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {SKILLS.map(skill => {
            const Icon = skill.icon;
            const enabled = skillStates[skill.id];
            const evalData = evalSummary[skill.agents[0]?.toLowerCase()];
            return (
              <div
                key={skill.id}
                className={`rounded-xl border p-4 bg-surface-900 transition-all ${
                  enabled ? 'border-surface-700' : 'border-surface-800 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${enabled ? 'bg-primary-500/10' : 'bg-surface-800'}`}>
                      <Icon className={`w-5 h-5 ${enabled ? 'text-primary-400' : 'text-surface-500'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{skill.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-surface-700 text-surface-500'
                        }`}>
                          {enabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-xs text-surface-400 mt-1 leading-relaxed">{skill.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {skill.agents.map(a => (
                          <span key={a} className="text-xs bg-surface-800 text-surface-400 px-2 py-0.5 rounded-full">{a}</span>
                        ))}
                      </div>
                      {evalData && (
                        <p className="text-xs text-surface-500 mt-1">
                          Avg quality:{' '}
                          <span className={`font-semibold ${evalData.avgScore >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {evalData.avgScore.toFixed(0)}/100
                          </span>
                          {' '}· {evalData.total} evals
                        </p>
                      )}
                      {skill.id === 'voice' && (
                        <p className="text-xs text-surface-500 mt-1">
                          {voicePremium
                            ? '✅ Premium voice (ElevenLabs/OpenAI)'
                            : voiceAvailable
                            ? '🔊 Browser TTS available'
                            : '❌ No TTS available'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => toggleSkill(skill.id)}
                    className={`flex-shrink-0 w-11 h-6 rounded-full transition-colors relative ${
                      enabled ? 'bg-primary-500' : 'bg-surface-700'
                    }`}
                    aria-label={`Toggle ${skill.name}`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        enabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* User Research Report */}
      <UserResearchSection />

      {/* Prompt Templates */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Prompt Templates</h2>
          <button
            onClick={() => setShowAddForm(p => !p)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Template
          </button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="mb-4 p-4 rounded-xl bg-surface-900 border border-surface-700 space-y-3">
            <h3 className="text-sm font-semibold text-white">New Prompt Template</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={newTemplate.id}
                onChange={e => setNewTemplate(p => ({ ...p, id: e.target.value }))}
                placeholder="template-id (unique)"
                className="px-3 py-2 text-sm rounded-lg bg-surface-800 border border-surface-700 text-white placeholder-surface-500 focus:outline-none focus:border-primary-500"
              />
              <select
                value={newTemplate.agentId}
                onChange={e => setNewTemplate(p => ({ ...p, agentId: e.target.value }))}
                className="px-3 py-2 text-sm rounded-lg bg-surface-800 border border-surface-700 text-white focus:outline-none focus:border-primary-500"
              >
                {['sage', 'atlas', 'herald', 'scout', 'oracle', 'mentor'].map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <input
                value={newTemplate.name}
                onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))}
                placeholder="Display name"
                className="px-3 py-2 text-sm rounded-lg bg-surface-800 border border-surface-700 text-white placeholder-surface-500 focus:outline-none focus:border-primary-500"
              />
              <input
                value={newTemplate.tags}
                onChange={e => setNewTemplate(p => ({ ...p, tags: e.target.value }))}
                placeholder="tags (comma-separated)"
                className="px-3 py-2 text-sm rounded-lg bg-surface-800 border border-surface-700 text-white placeholder-surface-500 focus:outline-none focus:border-primary-500"
              />
              <input
                value={newTemplate.description}
                onChange={e => setNewTemplate(p => ({ ...p, description: e.target.value }))}
                placeholder="Description"
                className="col-span-2 px-3 py-2 text-sm rounded-lg bg-surface-800 border border-surface-700 text-white placeholder-surface-500 focus:outline-none focus:border-primary-500"
              />
              <textarea
                value={newTemplate.template}
                onChange={e => setNewTemplate(p => ({ ...p, template: e.target.value }))}
                placeholder="Template body — use {{variable}} for dynamic values"
                rows={4}
                className="col-span-2 px-3 py-2 text-sm rounded-lg bg-surface-800 border border-surface-700 text-white placeholder-surface-500 focus:outline-none focus:border-primary-500 font-mono resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveTemplate}
                className="px-4 py-2 text-sm rounded-lg bg-primary-500 text-white hover:bg-primary-400 font-medium"
              >
                Save
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-sm rounded-lg bg-surface-700 text-surface-300 hover:bg-surface-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Templates Table */}
        <div className="rounded-xl border border-surface-700 overflow-hidden">
          <table className="hidden sm:table w-full text-sm">
            <thead>
              <tr className="bg-surface-800 text-surface-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Agent</th>
                <th className="px-4 py-3 text-left">Version</th>
                <th className="px-4 py-3 text-left">Tags</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {templates.map(t => (
                <React.Fragment key={t.id}>
                  <tr className="bg-surface-900 hover:bg-surface-800/60 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{t.name}</p>
                      <p className="text-xs text-surface-500 truncate max-w-xs">{t.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-surface-800 text-surface-300 px-2 py-0.5 rounded-full">{t.agentId}</span>
                    </td>
                    <td className="px-4 py-3 text-surface-400 text-xs">{t.version}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {t.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-xs bg-surface-800 text-surface-500 px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                        {t.metrics?.avgScore !== undefined && (
                          <span className="text-xs bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">
                            {t.metrics.avgScore.toFixed(0)}pts
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setExpandedTemplate(expandedTemplate === t.id ? null : t.id)}
                          className="p-1.5 rounded-lg hover:bg-surface-700 text-surface-400 hover:text-white"
                          title="Preview template"
                        >
                          {expandedTemplate === t.id ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        {(t as any).isCustom && (
                          <button
                            onClick={() => handleDeleteTemplate(t.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-surface-400 hover:text-red-400"
                            title="Delete template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedTemplate === t.id && (
                    <tr className="bg-surface-800/40">
                      <td colSpan={5} className="px-4 py-3">
                        <pre className="text-xs text-surface-300 font-mono whitespace-pre-wrap bg-surface-900 rounded-lg p-3 max-h-48 overflow-y-auto">
                          {t.template}
                        </pre>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {t.variables.map(v => (
                            <span
                              key={v.key}
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                v.required ? 'bg-red-500/10 text-red-400' : 'bg-surface-700 text-surface-400'
                              }`}
                            >
                              {`{{${v.key}}}`}{v.required ? ' *' : ''}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-surface-500">
                    No templates found. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
