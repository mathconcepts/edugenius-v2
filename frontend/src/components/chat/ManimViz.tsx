/**
 * ManimViz — Inline math visualisation component for Sage chat responses.
 *
 * Renders a manim PNG/GIF inline below a chat message when:
 *   - manimEnabled is true in appStore
 *   - The arbitration layer decided this response benefits from visualisation
 *
 * Shows a loading state, gracefully falls back if service is unavailable.
 * Includes a "Regenerate" button and a dismiss button.
 */

import { useState, useEffect } from 'react';
import { Loader2, X, RefreshCw, Maximize2, Cpu } from 'lucide-react';
import { quickRender, type ManimRenderResult, type ManimQuickRequest } from '@/services/manimService';
import { useAppStore } from '@/stores/appStore';

interface Props {
  topic: string;
  latex?: string;
  title?: string;
  sessionId?: string;
  /** Called when user dismisses — parent can remember not to show again */
  onDismiss?: () => void;
}

type State =
  | { status: 'loading' }
  | { status: 'done'; result: ManimRenderResult }
  | { status: 'error'; message: string }
  | { status: 'dismissed' };

export function ManimViz({ topic, latex, title, sessionId, onDismiss }: Props) {
  const { manimServiceUrl } = useAppStore();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [expanded, setExpanded] = useState(false);

  const doRender = async () => {
    setState({ status: 'loading' });
    const req: ManimQuickRequest = { topic, latex, title, sessionId };
    const result = await quickRender(req, manimServiceUrl);
    if (result) {
      setState({ status: 'done', result });
    } else {
      setState({ status: 'error', message: 'Visualisation unavailable' });
    }
  };

  useEffect(() => {
    doRender();
  }, [topic, latex]);

  if (state.status === 'dismissed') return null;

  return (
    <div className="mt-3 rounded-xl border border-surface-700 bg-surface-900/60 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-800/80 border-b border-surface-700">
        <div className="flex items-center gap-2">
          <Cpu className="h-3.5 w-3.5 text-primary-400" />
          <span className="text-xs font-medium text-surface-300">Manim Visualisation</span>
          {state.status === 'done' && (
            <span className="text-xs text-surface-500">
              {state.result.cached ? '(cached)' : `${state.result.renderMs}ms`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {state.status === 'done' && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-white transition-colors"
              title="Expand"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
          {(state.status === 'done' || state.status === 'error') && (
            <button
              onClick={doRender}
              className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-white transition-colors"
              title="Re-render"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => {
              setState({ status: 'dismissed' });
              onDismiss?.();
            }}
            className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-white transition-colors"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`flex items-center justify-center p-2 ${expanded ? 'min-h-[400px]' : 'min-h-[160px]'}`}>
        {state.status === 'loading' && (
          <div className="flex flex-col items-center gap-2 text-surface-400">
            <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
            <span className="text-xs">Rendering {topic}…</span>
          </div>
        )}

        {state.status === 'error' && (
          <div className="flex flex-col items-center gap-2 text-surface-500">
            <span className="text-xs">{state.message}</span>
            <span className="text-xs text-surface-600">Is the manim service running?</span>
          </div>
        )}

        {state.status === 'done' && (
          <img
            src={state.result.url}
            alt={`${topic} visualisation`}
            className={`rounded-lg object-contain transition-all duration-200 ${
              expanded ? 'max-h-[380px] max-w-full' : 'max-h-[200px] max-w-full'
            }`}
            style={{ background: '#1a1a2e' }}
          />
        )}
      </div>

      {/* Footer: topic label */}
      {state.status === 'done' && title && (
        <div className="px-3 py-1.5 border-t border-surface-700 bg-surface-800/40">
          <span className="text-xs text-surface-500">{title}</span>
        </div>
      )}
    </div>
  );
}
