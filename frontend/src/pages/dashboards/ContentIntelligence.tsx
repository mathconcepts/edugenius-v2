/**
 * Content Intelligence Dashboard — /content-intelligence
 *
 * Shows Atlas topic queue and Herald content calendar
 * driven by real student persona signals.
 *
 * Roles: CEO · Admin · Teacher (read-only for teacher)
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, Zap, Users, BarChart3, RefreshCw,
  BookOpen, MessageSquare, FileText,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  getCohortInsights,
  getAtlasTopicQueue,
  getHeraldContentCalendar,
} from '../../services/personaContentBridge';
import type { ContentOpportunity, OutreachTrigger } from '../../services/personaContentBridge';

// ── Style maps ────────────────────────────────────────────────────────────────

const urgencyColor: Record<string, string> = {
  publish_now: 'text-red-400 bg-red-500/10 border-red-500/30',
  this_week:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  this_month:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  send_now:    'text-red-400 bg-red-500/10 border-red-500/30',
  today:       'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  this_week_o: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
};

const emotionEmoji: Record<string, string> = {
  frustrated: '😤',
  anxious:    '😰',
  neutral:    '😐',
  confident:  '💪',
  motivated:  '🔥',
  exhausted:  '😴',
};

const tierColor: Record<string, string> = {
  struggling: 'bg-red-500',
  average:    'bg-yellow-500',
  good:       'bg-blue-500',
  advanced:   'bg-emerald-500',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function AtlasCard({ item, index, onExecute, executingId }: {
  item: ContentOpportunity;
  index: number;
  onExecute: (id: string) => void;
  executingId: string | null;
}) {
  const isRunning = executingId === item.id;
  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-surface-900 border border-surface-800 rounded-2xl p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={clsx('text-xs px-2 py-0.5 rounded-full border', urgencyColor[item.urgency])}>
              {item.urgency.replace(/_/g, ' ').toUpperCase()}
            </span>
            <span className="text-xs bg-surface-800 text-surface-400 px-2 py-0.5 rounded-full">
              {item.type.replace(/_/g, ' ')}
            </span>
            <span className="text-xs bg-surface-800 text-surface-400 px-2 py-0.5 rounded-full">
              {String(item.targetExam).replace(/_/g, ' ')}
            </span>
          </div>

          <h3 className="text-white font-semibold">{item.title}</h3>
          <p className="text-surface-400 text-sm mt-1">{item.reasoning}</p>

          <details className="mt-2 group">
            <summary className="text-xs text-primary-400 cursor-pointer select-none list-none flex items-center gap-1">
              <span className="group-open:hidden">▶ Content angle &amp; impact</span>
              <span className="hidden group-open:inline">▼ Content angle &amp; impact</span>
            </summary>
            <div className="mt-2 space-y-2 pl-2 border-l border-surface-700">
              <p className="text-xs text-surface-300">
                <span className="text-surface-500">Angle: </span>{item.suggestedAngle}
              </p>
              <p className="text-xs text-surface-300">
                <span className="text-surface-500">Impact: </span>{item.estimatedImpact}
              </p>
              {item.seoKeywords && item.seoKeywords.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {item.seoKeywords.map(kw => (
                    <span key={kw} className="text-xs bg-primary-500/10 text-primary-400 px-2 py-0.5 rounded-full">
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </details>
        </div>

        <button
          onClick={() => onExecute(item.id)}
          disabled={isRunning}
          className="btn-primary text-xs px-4 py-2 flex items-center gap-1 whitespace-nowrap flex-shrink-0"
        >
          {isRunning
            ? <><RefreshCw className="w-3 h-3 animate-spin" /> Creating…</>
            : <><Zap className="w-3 h-3" /> Create Now</>}
        </button>
      </div>
    </motion.div>
  );
}

function HeraldTriggerCard({ trigger, index, onExecute, executingId }: {
  trigger: OutreachTrigger;
  index: number;
  onExecute: (id: string) => void;
  executingId: string | null;
}) {
  const isRunning = executingId === trigger.id;
  const channelIcon = trigger.channel === 'whatsapp' ? '💬' : trigger.channel === 'email' ? '📧' : '✈️';
  return (
    <motion.div
      key={trigger.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-surface-900 border border-red-500/20 rounded-2xl p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-lg">{channelIcon}</span>
            <span className="text-white font-medium text-sm">{trigger.targetSegment}</span>
            <span className="text-xs text-surface-400">
              {trigger.studentCount.toLocaleString('en-IN')} students
            </span>
          </div>
          <p className="text-surface-400 text-sm">{trigger.messageAngle}</p>
          <details className="mt-2 group">
            <summary className="text-xs text-primary-400 cursor-pointer select-none list-none flex items-center gap-1">
              <span className="group-open:hidden">▶ Draft message</span>
              <span className="hidden group-open:inline">▼ Draft message</span>
            </summary>
            <pre className="mt-2 text-xs text-surface-300 bg-surface-800 p-3 rounded-xl whitespace-pre-wrap font-sans">
              {trigger.suggestedTemplate}
            </pre>
          </details>
        </div>
        <button
          onClick={() => onExecute(trigger.id)}
          disabled={isRunning}
          className="btn-primary text-xs px-4 py-2 whitespace-nowrap flex-shrink-0"
        >
          {isRunning ? 'Sending…' : '▶ Send'}
        </button>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ContentIntelligence() {
  const [activeTab, setActiveTab] = useState<'atlas' | 'herald' | 'cohort'>('atlas');
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Re-derive on each render (or refresh)
  const insights        = getCohortInsights();
  const atlasQueue      = getAtlasTopicQueue();
  const heraldCalendar  = getHeraldContentCalendar();

  const handleExecute = (id: string) => {
    setExecutingId(id);
    // In production: agentProtocol.dispatch({ target: 'Atlas' | 'Herald', payload: item })
    setTimeout(() => setExecutingId(null), 2000);
  };

  const handleRefresh = () => setRefreshKey(k => k + 1);

  return (
    <div key={refreshKey} className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary-400" />
            Content Intelligence
          </h1>
          <p className="text-surface-400 mt-1 text-sm">
            Content decisions driven by{' '}
            <span className="text-white font-medium">
              {insights.totalStudents.toLocaleString('en-IN')}
            </span>{' '}
            student personas · Updated {new Date(insights.generatedAt).toLocaleTimeString('en-IN')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
          <div className="flex items-center gap-2 text-sm text-surface-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live cohort signals
          </div>
        </div>
      </div>

      {/* ── Cohort snapshot strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Dominant Emotion',
            value: `${emotionEmoji[insights.dominantEmotion]} ${insights.dominantEmotion}`,
            sub: `${insights.emotionalDistribution[insights.dominantEmotion]}% of students`,
          },
          {
            label: 'Avg Syllabus Done',
            value: `${insights.avgSyllabusCompletion}%`,
            sub: `${insights.avgDaysToExam} days to exam`,
          },
          {
            label: 'Avg Streak',
            value: `${insights.avgStreakDays} days`,
            sub: `${insights.avgSessionMinutes} min/session`,
          },
          {
            label: 'Top Pain Point',
            value: insights.topWeakTopics[0]?.topic.split('—')[0].trim() || '—',
            sub: `${insights.topWeakTopics[0]?.count} students struggling`,
          },
        ].map(m => (
          <div key={m.label} className="bg-surface-900 border border-surface-800 rounded-2xl p-4">
            <p className="text-surface-400 text-xs">{m.label}</p>
            <p className="text-white font-bold mt-1">{m.value}</p>
            <p className="text-surface-500 text-xs mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-surface-900 p-1 rounded-xl w-fit">
        {([
          { id: 'atlas',  label: '📚 Atlas Queue',      count: atlasQueue.length },
          { id: 'herald', label: '📢 Herald Calendar',  count: heraldCalendar.immediate.length },
          { id: 'cohort', label: '👥 Cohort Insights',  count: null },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
              activeTab === tab.id
                ? 'bg-primary-600 text-white'
                : 'text-surface-400 hover:text-white',
            )}
          >
            {tab.label}
            {tab.count !== null && (
              <span className={clsx(
                'text-xs px-1.5 py-0.5 rounded-full',
                activeTab === tab.id ? 'bg-white/20' : 'bg-surface-700',
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Atlas Queue ── */}
      {activeTab === 'atlas' && (
        <div className="space-y-3">
          <p className="text-surface-400 text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Atlas will create these next, ranked by student need urgency.
          </p>
          {atlasQueue.length === 0 && (
            <p className="text-surface-500 text-sm py-8 text-center">No content queued right now.</p>
          )}
          {atlasQueue.map((item, i) => (
            <AtlasCard
              key={item.id}
              item={item}
              index={i}
              onExecute={handleExecute}
              executingId={executingId}
            />
          ))}
        </div>
      )}

      {/* ── Herald Calendar ── */}
      {activeTab === 'herald' && (
        <div className="space-y-6">
          {/* Send Now */}
          {heraldCalendar.immediate.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> 🚨 Send Now
              </h3>
              <div className="space-y-3">
                {heraldCalendar.immediate.map((trigger, i) => (
                  <HeraldTriggerCard
                    key={trigger.id}
                    trigger={trigger}
                    index={i}
                    onExecute={handleExecute}
                    executingId={executingId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* This Week */}
          {heraldCalendar.thisWeek.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> 📅 This Week
              </h3>
              <div className="space-y-3">
                {heraldCalendar.thisWeek.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-surface-900 border border-surface-800 rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm">{item.title}</p>
                        <p className="text-surface-400 text-xs mt-0.5">{item.reasoning}</p>
                      </div>
                      <button
                        onClick={() => handleExecute(item.id)}
                        disabled={executingId === item.id}
                        className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0"
                      >
                        {executingId === item.id ? 'Queuing…' : 'Queue →'}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {heraldCalendar.immediate.length === 0 && heraldCalendar.thisWeek.length === 0 && (
            <p className="text-surface-500 text-sm py-8 text-center">No outreach queued right now.</p>
          )}
        </div>
      )}

      {/* ── Cohort Insights ── */}
      {activeTab === 'cohort' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Emotion distribution */}
          <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-400" />
              Student Emotional State
            </h3>
            <div className="space-y-3">
              {(Object.entries(insights.emotionalDistribution) as [string, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([emotion, pct]) => (
                  <div key={emotion} className="flex items-center gap-3">
                    <span className="text-lg w-6 text-center">{emotionEmoji[emotion]}</span>
                    <span className="text-surface-300 text-sm capitalize w-24 flex-shrink-0">{emotion}</span>
                    <div className="flex-1 bg-surface-800 rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-surface-400 text-xs w-8 text-right">{pct}%</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Performance tier */}
          <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary-400" />
              Performance Distribution
            </h3>
            <div className="space-y-3">
              {(Object.entries(insights.tierDistribution) as [string, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([tier, pct]) => (
                  <div key={tier} className="flex items-center gap-3">
                    <span className="text-surface-300 text-sm capitalize w-24 flex-shrink-0">{tier}</span>
                    <div className="flex-1 bg-surface-800 rounded-full h-2">
                      <div
                        className={clsx('h-2 rounded-full transition-all', tierColor[tier])}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-surface-400 text-xs w-8 text-right">{pct}%</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Top weak topics */}
          <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5 md:col-span-2">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary-400" />
              Cohort Pain Points — What Students Are Struggling With
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {insights.topWeakTopics.map((wt, i) => (
                <div
                  key={wt.topic}
                  className="flex items-center gap-3 bg-surface-800/50 rounded-xl p-3"
                >
                  <span className="text-surface-500 text-xs w-5 text-center font-mono">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{wt.topic}</p>
                    <p className="text-surface-400 text-xs">
                      {String(wt.examType).replace(/_/g, ' ')} · {wt.count} students
                    </p>
                  </div>
                  <span className={clsx(
                    'text-xs px-2 py-0.5 rounded-full border flex-shrink-0',
                    wt.urgency === 'critical'
                      ? 'text-red-400 bg-red-500/10 border-red-500/30'
                      : wt.urgency === 'high'
                        ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
                        : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
                  )}>
                    {wt.urgency}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Engagement summary */}
          <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5 md:col-span-2">
            <h3 className="font-semibold text-white mb-4">📈 Engagement Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Students', value: insights.totalStudents.toLocaleString('en-IN') },
                { label: 'Avg Syllabus Done', value: `${insights.avgSyllabusCompletion}%` },
                { label: 'Avg Days to Exam', value: `${insights.avgDaysToExam}d` },
                { label: 'Avg Streak', value: `${insights.avgStreakDays} days` },
              ].map(stat => (
                <div key={stat.label} className="text-center">
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-surface-400 text-xs mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
