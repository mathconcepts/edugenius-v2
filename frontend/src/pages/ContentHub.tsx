/**
 * ContentHub.tsx — Master Content Hub (CEO page at /content-hub)
 *
 * 5 tabs:
 *   1. Generate — single-piece content generation
 *   2. Repurpose — repurpose existing content across channels
 *   3. Campaign — full campaign orchestrator
 *   4. Pages — LocalPageBuilder integration
 *   5. Sync Status — cross-agent connection health
 *
 * Quick links: Social Intel (/social-intent)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  FileText, RefreshCw, Rocket, Globe, Activity,
  Loader2, CheckCircle2, XCircle, AlertCircle, Copy, ChevronDown, ChevronUp, Play,
} from 'lucide-react';
import { generateContent, ContentChannel, SupportedExam, ContentAudience, GeneratedContent } from '@/services/contentGenerationHub';
import { bulkRepurpose, BulkRepurposeResult } from '@/services/contentRepurposingService';
import { orchestrateContentCampaign, getAllCampaigns, ContentCampaign } from '@/services/masterContentAgent';
import { auditContentSync, SyncHealthReport } from '@/services/contentSyncService';
import { generateContentCalendar, ContentCalendar, selectStrategy } from '@/services/contentStrategyService';
import LocalPageBuilderView from './LocalPageBuilder';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAMS: SupportedExam[] = ['GATE', 'JEE', 'NEET', 'CAT', 'UPSC', 'CBSE'];
const CHANNELS: ContentChannel[] = ['blog', 'x_twitter', 'instagram', 'email', 'reddit', 'quora', 'linkedin', 'short_video', 'youtube'];
const AUDIENCES: ContentAudience[] = [
  'student_beginner', 'student_intermediate', 'student_advanced', 'teacher', 'parent', 'aspirant',
];
const CHANNEL_LABELS: Record<ContentChannel, string> = {
  blog: '📝 Blog', vlog: '🎬 Vlog', youtube: '▶️ YouTube', short_video: '📱 Short Video',
  x_twitter: '𝕏 Twitter', reddit: '🤖 Reddit', quora: '❓ Quora',
  linkedin: '💼 LinkedIn', instagram: '📸 Instagram', email: '📧 Email',
};
const AUDIENCE_LABELS: Record<ContentAudience, string> = {
  student_beginner: '🎓 Student (Beginner)', student_intermediate: '📚 Student (Intermediate)',
  student_advanced: '🏆 Student (Advanced)', teacher: '👨‍🏫 Teacher',
  parent: '👨‍👩‍👧 Parent', aspirant: '💼 Aspirant',
};

// ─── Tab nav ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'generate', label: 'Generate', icon: FileText },
  { id: 'repurpose', label: 'Repurpose', icon: RefreshCw },
  { id: 'campaign', label: 'Campaign', icon: Rocket },
  { id: 'pages', label: 'Pages', icon: Globe },
  { id: 'sync', label: 'Sync Status', icon: Activity },
] as const;
type TabId = typeof TABS[number]['id'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {/* ignore */});
}

function renderContent(content: GeneratedContent): string {
  if (!content) return '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = content as Record<string, any>;
  const skip = ['channel'];
  return Object.entries(obj)
    .filter(([k]) => !skip.includes(k))
    .map(([k, v]) => `**${k}:**\n${Array.isArray(v) ? v.map((item, i) => typeof item === 'object' ? JSON.stringify(item, null, 2) : `${i + 1}. ${item}`).join('\n') : typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}`)
    .join('\n\n');
}

// ─── Tab 1: Generate ──────────────────────────────────────────────────────────

function GenerateTab() {
  const [exam, setExam] = useState<SupportedExam>('GATE');
  const [topic, setTopic] = useState('');
  const [channel, setChannel] = useState<ContentChannel>('blog');
  const [audience, setAudience] = useState<ContentAudience>('student_intermediate');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [strategy, setStrategy] = useState<ReturnType<typeof selectStrategy> | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendar, setCalendar] = useState<ContentCalendar | null>(null);
  const [examDate, setExamDate] = useState('');

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const strat = selectStrategy(exam, audience, channel);
      setStrategy(strat);
      const content = await generateContent({ exam, topic, channel, audience });
      setResult(content);
    } finally {
      setLoading(false);
    }
  };

  const handleCalendar = () => {
    if (!examDate) return;
    const cal = generateContentCalendar(exam, examDate);
    setCalendar(cal);
    setShowCalendar(true);
  };

  const rawText = result ? renderContent(result) : '';

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Generate Content</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Exam</label>
            <select value={exam} onChange={e => setExam(e.target.value as SupportedExam)}
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
              {EXAMS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Channel</label>
            <select value={channel} onChange={e => setChannel(e.target.value as ContentChannel)}
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
              {CHANNELS.map(c => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Audience</label>
            <select value={audience} onChange={e => setAudience(e.target.value as ContentAudience)}
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
              {AUDIENCES.map(a => <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Topic</label>
            <input value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Electromagnetic Induction"
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handleGenerate} disabled={loading || !topic.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Strategy preview */}
      {strategy && (
        <div className="card p-4 bg-primary-950/30 border-primary-500/20">
          <h3 className="text-sm font-semibold text-primary-400 mb-2">Strategy Applied</h3>
          <div className="grid grid-cols-2 gap-2 text-xs text-surface-300">
            <span><strong>Tone:</strong> {strategy.tone}</span>
            <span><strong>Length:</strong> {strategy.length}</span>
            <span><strong>CTA:</strong> {strategy.cta}</span>
            <span><strong>Tip:</strong> {strategy.publishingTip}</span>
          </div>
          {strategy.hooks.length > 0 && (
            <div className="mt-2">
              <span className="text-xs text-surface-400">Hook suggestion:</span>
              <p className="text-xs text-surface-200 italic mt-1">"{strategy.hooks[0]}"</p>
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{CHANNEL_LABELS[result.channel]} Content</h3>
            <button onClick={() => copyToClipboard(rawText)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-700 hover:bg-surface-600 rounded-lg text-xs text-surface-300 transition-colors">
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>
          <pre className="text-xs text-surface-300 whitespace-pre-wrap font-mono bg-surface-800/50 rounded-xl p-4 max-h-96 overflow-y-auto">
            {rawText}
          </pre>
        </div>
      )}

      {/* Content calendar */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Content Calendar Generator</h3>
          <button onClick={() => setShowCalendar(!showCalendar)} className="text-surface-400 hover:text-white">
            {showCalendar ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        {showCalendar && (
          <div className="mt-4 space-y-4">
            <div className="flex gap-3">
              <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)}
                className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none" />
              <button onClick={handleCalendar} disabled={!examDate}
                className="px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                Generate Calendar
              </button>
            </div>
            {calendar && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {calendar.weeks.map(week => (
                  <div key={week.week} className="p-3 bg-surface-800/50 rounded-xl text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-white">Week {week.week} — {week.startDate}</span>
                      <span className={`px-2 py-0.5 rounded-full ${week.urgency === 'extreme' ? 'bg-red-500/20 text-red-400' : week.urgency === 'high' ? 'bg-orange-500/20 text-orange-400' : week.urgency === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                        {week.urgency}
                      </span>
                    </div>
                    <p className="text-surface-400">{week.focus}</p>
                    <p className="text-surface-300 mt-1">Topics: {week.suggestedTopics.join(', ')}</p>
                    <p className="text-primary-400">📌 {CHANNEL_LABELS[week.primaryChannel] ?? week.primaryChannel}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab 2: Repurpose ─────────────────────────────────────────────────────────

function RepurposeTab() {
  const [exam, setExam] = useState<SupportedExam>('GATE');
  const [topic, setTopic] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sourceChannel, setSourceChannel] = useState<ContentChannel>('blog');
  const [audience, setAudience] = useState<ContentAudience>('student_intermediate');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkRepurposeResult | null>(null);
  const [selectedView, setSelectedView] = useState<ContentChannel>('x_twitter');

  const handleRepurpose = async () => {
    if (!topic.trim() && !sourceText.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await bulkRepurpose({
        sourceText: sourceText || undefined,
        sourceChannel,
        exam,
        topic,
        audience,
        targetChannels: CHANNELS.filter(c => c !== sourceChannel),
      });
      setResult(res);
      const firstChannel = CHANNELS.find(c => c !== sourceChannel);
      if (firstChannel) setSelectedView(firstChannel);
    } finally {
      setLoading(false);
    }
  };

  const viewContent = result?.byChannel.get(selectedView);

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Repurpose Content</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Exam</label>
            <select value={exam} onChange={e => setExam(e.target.value as SupportedExam)}
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
              {EXAMS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Source Channel</label>
            <select value={sourceChannel} onChange={e => setSourceChannel(e.target.value as ContentChannel)}
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
              {CHANNELS.map(c => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-surface-400 mb-1 block">Topic</label>
            <input value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Fourier Transform"
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-surface-400 mb-1 block">Source Content (optional — paste existing content)</label>
            <textarea value={sourceText} onChange={e => setSourceText(e.target.value)} rows={4}
              placeholder="Paste your existing blog post, video script, or social post here..."
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500 resize-none" />
          </div>
        </div>
        <button onClick={handleRepurpose} disabled={loading || (!topic.trim() && !sourceText.trim())}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent-600 hover:bg-accent-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? 'Repurposing...' : 'Repurpose for All Channels'}
        </button>
      </div>

      {result && (
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Repurposed Content — {result.byChannel.size} channels</h3>
          {/* Channel tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {CHANNELS.filter(c => c !== sourceChannel).map(c => (
              result.byChannel.has(c) && (
                <button key={c} onClick={() => setSelectedView(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedView === c ? 'bg-primary-600 text-white' : 'bg-surface-700 text-surface-300 hover:bg-surface-600'}`}>
                  {CHANNEL_LABELS[c]}
                </button>
              )
            ))}
          </div>
          {viewContent && (
            <pre className="text-xs text-surface-300 whitespace-pre-wrap font-mono bg-surface-800/50 rounded-xl p-4 max-h-80 overflow-y-auto">
              {renderContent(viewContent)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Campaign ──────────────────────────────────────────────────────────

function CampaignTab() {
  const [exam, setExam] = useState<SupportedExam>('GATE');
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState<ContentAudience>('student_intermediate');
  const [targetDate, setTargetDate] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<ContentChannel[]>(['blog', 'x_twitter', 'instagram', 'email']);
  const [loading, setLoading] = useState(false);
  const [campaign, setCampaign] = useState<ContentCampaign | null>(null);
  const [allCampaigns, setAllCampaigns] = useState<ContentCampaign[]>([]);

  useEffect(() => {
    setAllCampaigns(getAllCampaigns().slice(0, 5));
  }, [campaign]);

  const toggleChannel = (c: ContentChannel) => {
    setSelectedChannels(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  const handleOrchestrate = async () => {
    if (!topic.trim() || !targetDate) return;
    setLoading(true);
    setCampaign(null);
    try {
      const result = await orchestrateContentCampaign(exam, topic, targetDate, {
        audience,
        channels: selectedChannels,
      });
      setCampaign(result);
      setAllCampaigns(getAllCampaigns().slice(0, 5));
    } finally {
      setLoading(false);
    }
  };

  const statusColor: Record<string, string> = {
    complete: 'text-green-400', failed: 'text-red-400', idle: 'text-surface-400',
    scouting: 'text-blue-400', strategy: 'text-yellow-400', generating: 'text-purple-400',
    distributing: 'text-orange-400', measuring: 'text-pink-400',
  };

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Campaign Orchestrator</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Exam</label>
            <select value={exam} onChange={e => setExam(e.target.value as SupportedExam)}
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
              {EXAMS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Target Date</label>
            <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500" />
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Audience</label>
            <select value={audience} onChange={e => setAudience(e.target.value as ContentAudience)}
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
              {AUDIENCES.map(a => <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Topic</label>
            <input value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Control Systems"
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
          </div>
        </div>
        {/* Channel selector */}
        <div>
          <label className="text-xs text-surface-400 mb-2 block">Channels</label>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map(c => (
              <button key={c} onClick={() => toggleChannel(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedChannels.includes(c) ? 'bg-primary-600 text-white' : 'bg-surface-700 text-surface-400 hover:text-white'}`}>
                {CHANNEL_LABELS[c]}
              </button>
            ))}
          </div>
        </div>
        <button onClick={handleOrchestrate} disabled={loading || !topic.trim() || !targetDate}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-600 to-accent-600 hover:opacity-90 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
          {loading ? 'Orchestrating Campaign...' : 'Launch Campaign'}
        </button>
      </div>

      {/* Active campaign result */}
      {campaign && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Campaign: {campaign.topic}</h3>
            <span className={`text-sm font-semibold ${statusColor[campaign.status] ?? 'text-surface-400'}`}>
              {campaign.status.toUpperCase()}
            </span>
          </div>
          {/* Pipeline log */}
          <div className="space-y-2">
            {campaign.pipelineLog.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                {entry.status === 'done' ? <CheckCircle2 className="w-4 h-4 text-green-400" /> :
                 entry.status === 'failed' ? <XCircle className="w-4 h-4 text-red-400" /> :
                 entry.status === 'running' ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" /> :
                 <div className="w-4 h-4 rounded-full border border-surface-600" />}
                <span className="text-surface-300 capitalize">{entry.step}</span>
                {entry.detail && <span className="text-surface-500 text-xs">— {entry.detail}</span>}
              </div>
            ))}
          </div>
          {/* Generated channels */}
          {campaign.generatedContent && campaign.generatedContent.size > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Array.from(campaign.generatedContent.keys()).map(ch => (
                <span key={ch} className="px-2 py-1 bg-green-500/15 text-green-400 text-xs rounded-lg">
                  {CHANNEL_LABELS[ch] ?? ch} ✓
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent campaigns */}
      {allCampaigns.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Recent Campaigns</h3>
          <div className="space-y-2">
            {allCampaigns.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-surface-800/50 rounded-xl text-xs">
                <div>
                  <span className="font-medium text-white">{c.exam} — {c.topic}</span>
                  <span className="text-surface-500 ml-2">{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
                <span className={`font-semibold ${statusColor[c.status] ?? 'text-surface-400'}`}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 5: Sync Status ───────────────────────────────────────────────────────

function SyncStatusTab() {
  const [report, setReport] = useState<SyncHealthReport | null>(null);
  const [loading, setLoading] = useState(false);

  const runAudit = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      const r = auditContentSync();
      setReport(r);
      setLoading(false);
    }, 300);
  }, []);

  useEffect(() => { runAudit(); }, [runAudit]);

  const statusIcon = (status: string) => {
    if (status === 'live') return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    if (status === 'broken') return <XCircle className="w-4 h-4 text-red-400" />;
    if (status === 'degraded') return <AlertCircle className="w-4 h-4 text-yellow-400" />;
    return <div className="w-4 h-4 rounded-full border border-surface-600" />;
  };

  const healthColor = report?.overallHealth === 'healthy' ? 'text-green-400' :
    report?.overallHealth === 'degraded' ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Cross-Agent Sync Health</h2>
            {report && (
              <p className={`text-sm font-semibold mt-1 ${healthColor}`}>
                System: {report.overallHealth.toUpperCase()} — {report.liveCount} live / {report.brokenCount} broken / {report.degradedCount} degraded
              </p>
            )}
          </div>
          <button onClick={runAudit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-surface-700 hover:bg-surface-600 rounded-xl text-sm transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Audit
          </button>
        </div>

        {report ? (
          <div className="space-y-3">
            {report.connections.map(conn => (
              <div key={conn.id} className="flex items-start gap-3 p-3 bg-surface-800/50 rounded-xl">
                {statusIcon(conn.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{conn.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${conn.status === 'live' ? 'bg-green-500/15 text-green-400' : conn.status === 'broken' ? 'bg-red-500/15 text-red-400' : conn.status === 'degraded' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-surface-700 text-surface-500'}`}>
                      {conn.status}
                    </span>
                  </div>
                  <p className="text-xs text-surface-400 mt-0.5">{conn.description}</p>
                  <p className="text-xs text-surface-500 mt-0.5">{conn.from} → {conn.to}</p>
                  {conn.detail && <p className="text-xs text-surface-500">{conn.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-surface-500">Running audit...</div>
        )}
      </div>
    </div>
  );
}

// ─── Main ContentHub ──────────────────────────────────────────────────────────

export default function ContentHub() {
  const [activeTab, setActiveTab] = useState<TabId>('generate');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-surface-700/50">
        <h1 className="text-xl font-bold gradient-text">Content Hub</h1>
        <p className="text-sm text-surface-400 mt-0.5">Multi-channel generation, repurposing engine, campaign orchestrator</p>
      </div>

      {/* Tab nav */}
      <div className="flex-shrink-0 flex gap-1 px-6 pt-3 border-b border-surface-700/30 pb-0">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-xl transition-colors border-b-2 ${activeTab === tab.id ? 'text-primary-400 border-primary-500 bg-primary-500/5' : 'text-surface-400 border-transparent hover:text-white'}`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Quick link: Social Intel */}
      {activeTab === 'generate' && (
        <div className="px-6 pt-3">
          <a
            href="/social-intent"
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-accent-600/20 border border-accent-500/30 text-accent-300 rounded-lg hover:bg-accent-600/30 transition-colors"
          >
            📡 Social Intel Hub — Monitor student questions &amp; auto-answer
          </a>
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'generate' && <GenerateTab />}
        {activeTab === 'repurpose' && <RepurposeTab />}
        {activeTab === 'campaign' && <CampaignTab />}
        {activeTab === 'pages' && <LocalPageBuilderView />}
        {activeTab === 'sync' && <SyncStatusTab />}
      </div>
    </div>
  );
}
