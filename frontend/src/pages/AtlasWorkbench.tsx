/**
 * AtlasWorkbench.tsx — Atlas's Content Generation Workspace
 * CEO-only page at /atlas-workbench
 *
 * Shows queued Scout tasks and lets Atlas generate real ContentAtoms from them.
 * Uses the same glassmorphism design language as the rest of EduGenius.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Zap,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  BookOpen,
  Target,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  getPendingTasks,
  getQueue,
  updateTaskStatus,
  generateContentAtomForTask,
  type AtlasContentTask,
} from '@/services/atlasTaskService';
import type { ContentAtom } from '@/services/contentFramework';
import { ContentCard } from '@/components/ContentCard';

// ── Exam badge colours (mirrors MarketIntelligence) ───────────────────────────

const examBadgeColor: Record<string, string> = {
  GATE:    'text-blue-400 bg-blue-500/10 border-blue-500/30',
  CAT:     'text-purple-400 bg-purple-500/10 border-purple-500/30',
  JEE:     'text-orange-400 bg-orange-500/10 border-orange-500/30',
  NEET:    'text-pink-400 bg-pink-500/10 border-pink-500/30',
  General: 'text-surface-400 bg-surface-500/10 border-surface-500/30',
  UPSC:    'text-amber-400 bg-amber-500/10 border-amber-500/30',
};

const statusConfig = {
  queued:      { icon: Clock,        label: 'Queued',      class: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  in_progress: { icon: Loader2,      label: 'Generating…', class: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  done:        { icon: CheckCircle,  label: 'Done',        class: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  failed:      { icon: AlertCircle,  label: 'Failed',      class: 'text-red-400 bg-red-500/10 border-red-500/30' },
};

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle, color = 'text-primary-400' }: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={clsx('p-2 rounded-xl bg-surface-800/60 border border-surface-700/50', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Priority bar ──────────────────────────────────────────────────────────────

function PriorityBar({ score }: { score: number }) {
  const color = score > 70 ? 'bg-emerald-500' : score > 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-surface-400 w-6 text-right">{score}</span>
    </div>
  );
}

// ── Pending task card ─────────────────────────────────────────────────────────

interface TaskCardProps {
  task: AtlasContentTask;
  onGenerate: (task: AtlasContentTask) => void;
  isGenerating: boolean;
}

function PendingTaskCard({ task, onGenerate, isGenerating }: TaskCardProps) {
  const sc = statusConfig[task.status];
  const StatusIcon = sc.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-900 border border-surface-800 rounded-2xl p-5 hover:border-surface-700 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={clsx('text-xs px-2 py-0.5 rounded-full border', examBadgeColor[task.examFocus] ?? examBadgeColor.General)}>
              {task.examFocus}
            </span>
            <span className="text-xs bg-surface-800 text-surface-400 px-2 py-0.5 rounded-full border border-surface-700">
              {task.atomType.replace(/_/g, ' ')}
            </span>
            <span className={clsx('text-xs px-2 py-0.5 rounded-full border flex items-center gap-1', sc.class)}>
              <StatusIcon className={clsx('w-3 h-3', task.status === 'in_progress' && 'animate-spin')} />
              {sc.label}
            </span>
          </div>

          {/* Topic */}
          <h3 className="text-white font-semibold text-sm leading-snug mb-1">{task.topic}</h3>
          <p className="text-xs text-surface-500 leading-relaxed line-clamp-2">{task.reasoning}</p>

          {/* Priority bar */}
          <div className="mt-3">
            <p className="text-[10px] text-surface-600 mb-1">Priority Score</p>
            <PriorityBar score={task.priority} />
          </div>
        </div>

        {/* Generate button */}
        <div className="flex-shrink-0">
          {task.status === 'queued' && (
            <button
              onClick={() => onGenerate(task)}
              disabled={isGenerating}
              className={clsx(
                'flex items-center gap-2 text-xs px-4 py-2 rounded-xl font-medium transition-all border',
                isGenerating
                  ? 'bg-surface-800 text-surface-500 border-surface-700 cursor-not-allowed'
                  : 'bg-violet-600/20 hover:bg-violet-600/40 border-violet-500/30 text-violet-300 hover:text-violet-200',
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate
                </>
              )}
            </button>
          )}
          {task.status === 'in_progress' && (
            <span className="text-xs text-blue-400 flex items-center gap-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Working…
            </span>
          )}
          {task.status === 'done' && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              Done
            </span>
          )}
          {task.status === 'failed' && (
            <button
              onClick={() => onGenerate(task)}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Queued timestamp */}
      <p className="text-[10px] text-surface-700 mt-3">
        Queued {new Date(task.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
        {' · '}source: {task.source.replace(/_/g, ' ')}
      </p>
    </motion.div>
  );
}

// ── Generated content card wrapper ────────────────────────────────────────────

function GeneratedAtomCard({ task }: { task: AtlasContentTask }) {
  if (!task.contentAtom) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2 text-xs text-surface-500">
        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-emerald-400 font-medium">{task.topic}</span>
        <span>·</span>
        <span>{task.examFocus}</span>
        <span>·</span>
        <span>{task.atomType.replace(/_/g, ' ')}</span>
      </div>
      <ContentCard
        atom={task.contentAtom}
        profileRaw={{
          uid: 'atlas-workbench',
          name: 'Giri (CEO)',
          role: 'ceo',
          channel: 'web',
          deviceType: 'desktop',
          language: 'english',
        }}
        renderSurface="card"
      />
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AtlasWorkbench() {
  const [pendingTasks, setPendingTasks] = useState<AtlasContentTask[]>([]);
  const [doneTasks, setDoneTasks] = useState<AtlasContentTask[]>([]);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshTasks = useCallback(() => {
    const allTasks = getQueue().tasks;
    setPendingTasks(allTasks.filter(t => t.status === 'queued'));
    setDoneTasks(allTasks.filter(t => t.status === 'done' && t.contentAtom));
  }, []);

  useEffect(() => {
    refreshTasks();
    // Poll for status updates every 15s (Atlas might write externally)
    const interval = setInterval(refreshTasks, 15_000);
    return () => clearInterval(interval);
  }, [refreshTasks]);

  const handleGenerate = useCallback(async (task: AtlasContentTask) => {
    setGeneratingId(task.id);
    setError(null);
    updateTaskStatus(task.id, 'in_progress');
    refreshTasks();

    try {
      const atom: ContentAtom = await generateContentAtomForTask(task);
      updateTaskStatus(task.id, 'done', atom);
    } catch (err) {
      console.error('[AtlasWorkbench] Generation failed:', err);
      updateTaskStatus(task.id, 'failed');
      setError(`Generation failed for "${task.topic}". Check console for details.`);
    } finally {
      setGeneratingId(null);
      refreshTasks();
    }
  }, [refreshTasks]);

  const pendingCount = pendingTasks.length;
  const doneCount = doneTasks.length;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-violet-400" />
            Atlas Workbench
          </h1>
          <p className="text-surface-400 text-sm mt-1">
            Scout's queued content gaps → Atlas-generated ContentAtoms
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Stats pills */}
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-3 py-1.5 rounded-full">
              🟡 {pendingCount} pending
            </span>
            <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-full">
              ✅ {doneCount} done
            </span>
          </div>

          <button
            onClick={refreshTasks}
            className="text-xs flex items-center gap-1 text-surface-400 hover:text-white border border-surface-700 hover:border-surface-600 px-3 py-1.5 rounded-xl transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-sm text-red-400"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-xs hover:text-red-300">Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending Tasks */}
      <div className="bg-surface-900/50 border border-surface-800 rounded-3xl p-6">
        <SectionHeader
          icon={Target}
          title="Pending Tasks"
          subtitle="Queued by Scout — click Generate to create a ContentAtom"
          color="text-yellow-400"
        />

        {pendingCount === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="w-10 h-10 text-surface-700 mx-auto mb-3" />
            <p className="text-surface-500 text-sm">No pending tasks</p>
            <p className="text-surface-600 text-xs mt-1">
              Go to{' '}
              <a href="/market-intel" className="text-primary-400 hover:underline">Market Intelligence</a>
              {' '}and click "Create Content" on any gap.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pendingTasks.map(task => (
              <PendingTaskCard
                key={task.id}
                task={task}
                onGenerate={handleGenerate}
                isGenerating={generatingId === task.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Generated Content */}
      {doneCount > 0 && (
        <div className="bg-surface-900/50 border border-surface-800 rounded-3xl p-6">
          <SectionHeader
            icon={BookOpen}
            title="Generated Content"
            subtitle={`${doneCount} ContentAtom${doneCount !== 1 ? 's' : ''} generated by Atlas this session`}
            color="text-violet-400"
          />

          <div className="space-y-6">
            {doneTasks.map(task => (
              <GeneratedAtomCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {/* Empty generated state */}
      {doneCount === 0 && (
        <div className="bg-surface-900/30 border border-dashed border-surface-700 rounded-3xl p-8 text-center">
          <BarChart3 className="w-10 h-10 text-surface-700 mx-auto mb-3" />
          <p className="text-surface-500 text-sm">Generated ContentAtoms will appear here</p>
          <p className="text-surface-600 text-xs mt-1">Click "Generate" on a pending task above to create your first atom.</p>
        </div>
      )}
    </div>
  );
}
