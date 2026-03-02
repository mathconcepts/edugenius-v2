/**
 * ManimToggle — Feature flag UI for enabling/disabling Manim visualisations.
 *
 * Shows in Chat settings panel. Includes:
 *   - On/off toggle (persisted via appStore → localStorage)
 *   - Live health check of the manim service
 *   - Service URL configuration for advanced users
 *   - Cost/resource explanation tooltip
 */

import { useState, useEffect } from 'react';
import { Cpu, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { checkManimHealth, getSessionRenderCount } from '@/services/manimService';

export function ManimToggle() {
  const { manimEnabled, setManimEnabled, manimServiceUrl, setManimServiceUrl } = useAppStore();
  const [health, setHealth] = useState<'unknown' | 'ok' | 'down'>('unknown');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [urlInput, setUrlInput] = useState(manimServiceUrl);
  const renderCount = getSessionRenderCount();

  // Health check on mount and when toggling on
  useEffect(() => {
    if (manimEnabled) {
      checkManimHealth(manimServiceUrl).then(ok => setHealth(ok ? 'ok' : 'down'));
    }
  }, [manimEnabled, manimServiceUrl]);

  const handleToggle = async () => {
    const next = !manimEnabled;
    setManimEnabled(next);
    if (next) {
      const ok = await checkManimHealth(manimServiceUrl);
      setHealth(ok ? 'ok' : 'down');
    } else {
      setHealth('unknown');
    }
  };

  const handleUrlSave = () => {
    setManimServiceUrl(urlInput.replace(/\/$/, ''));
    setHealth('unknown');
  };

  return (
    <div className="rounded-xl border border-surface-700 bg-surface-800/60 p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Cpu className="h-4 w-4 text-primary-400" />
          <div>
            <p className="text-sm font-medium text-white">Manim Visualisations</p>
            <p className="text-xs text-surface-400">
              Renders math diagrams & animations for complex concepts
            </p>
          </div>
        </div>
        {/* Toggle */}
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            manimEnabled ? 'bg-primary-500' : 'bg-surface-600'
          }`}
          role="switch"
          aria-checked={manimEnabled}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              manimEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Status */}
      {manimEnabled && (
        <div className="flex items-center gap-2">
          {health === 'ok' && (
            <><CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
            <span className="text-xs text-green-400">Service running · {renderCount} renders this session</span></>
          )}
          {health === 'down' && (
            <><XCircle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-xs text-red-400">Service unreachable — start manim-service/start.sh</span></>
          )}
          {health === 'unknown' && (
            <><AlertCircle className="h-3.5 w-3.5 text-yellow-400" />
            <span className="text-xs text-yellow-400">Checking service…</span></>
          )}
        </div>
      )}

      {/* Cost/resource note */}
      {manimEnabled && (
        <div className="rounded-lg bg-surface-900/60 border border-surface-700 p-3 space-y-1.5">
          <p className="text-xs font-medium text-surface-300">Resource tradeoffs</p>
          <ul className="space-y-1 text-xs text-surface-400">
            <li>📸 <strong className="text-surface-300">Static PNG</strong> — ~1–4s, ~50MB RAM. Used for equations, diagrams, charts.</li>
            <li>🎬 <strong className="text-surface-300">Animation (GIF)</strong> — ~5–15s, ~150MB RAM. Used for step-by-step proofs.</li>
            <li>🎥 <strong className="text-surface-300">Video (MP4)</strong> — ~15–60s, ~400MB RAM. Only on explicit request.</li>
            <li>⚡ <strong className="text-surface-300">KaTeX</strong> — instant, always used for inline formulas (not replaced).</li>
          </ul>
          <p className="text-xs text-surface-500">
            Arbitration: Manim is called only when a diagram adds genuine value (geometry, transforms, probability).
            Simple algebra always uses KaTeX. Max 10 renders per session.
          </p>
        </div>
      )}

      {/* Advanced config */}
      {manimEnabled && (
        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="flex items-center gap-1 text-xs text-surface-400 hover:text-surface-300 transition-colors"
        >
          {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Advanced
        </button>
      )}

      {manimEnabled && showAdvanced && (
        <div className="space-y-2">
          <label className="text-xs text-surface-400">Service URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              className="flex-1 rounded-lg bg-surface-900 border border-surface-600 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary-500"
              placeholder="http://localhost:7341"
            />
            <button
              onClick={handleUrlSave}
              className="px-3 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium transition-colors"
            >
              Save
            </button>
          </div>
          <p className="text-xs text-surface-500">
            Run <code className="bg-surface-900 px-1 rounded text-primary-300">manim-service/start.sh</code> on this machine to start the renderer.
          </p>
        </div>
      )}
    </div>
  );
}
