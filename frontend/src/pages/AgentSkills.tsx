/**
 * AgentSkills.tsx — Agent Skills Registry + Prompt Template Manager
 * CEO view of all VoltAgent-inspired skills and their connections
 */
import React, { useState, useEffect } from 'react';
import { Shield, Brain, BarChart2, FileCode, Users, Video, Mic, Plus, Trash2, Eye, ChevronUp } from 'lucide-react';
import { getAllTemplates, saveCustomTemplate, deleteCustomTemplate, type PromptTemplate } from '@/services/skills/dynamicPromptsSkill';
import { getEvalSummary } from '@/services/skills/liveEvalsSkill';
import { isSpeechAvailable, canUsePremiumVoice } from '@/services/skills/voiceSkill';

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
