/**
 * SettingsPage — Theme toggle + session info with animations.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSession } from '@/hooks/useSession';
import { useStorageMode, type StorageMode } from '@/hooks/useStorageMode';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { isOptedIn as getAggregateOptIn, setOptIn as persistAggregateOptIn } from '@/lib/gbrain/aggregate';
import { Moon, Sun, Copy, Check, Trash2, Bell, BellOff, Mail, Zap, Database, HardDrive, Cpu } from 'lucide-react';

export default function SettingsPage() {
  const sessionId = useSession();
  const { mode: storageMode, effectiveMode, setMode: setStorageMode, groundingCount } = useStorageMode();
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });
  const [notifPrefs, setNotifPrefs] = useState({
    email_digest: true,
    streak_reminders: true,
    push_enabled: true,
  });
  const [aggregateOptIn, setAggregateOptIn] = useState(() => getAggregateOptIn());

  const toggleAggregateOptIn = () => {
    const next = !aggregateOptIn;
    persistAggregateOptIn(next);
    setAggregateOptIn(next);
  };

  useEffect(() => {
    fetch(`/api/notifications/preferences?session_id=${sessionId}`)
      .then(r => r.json())
      .then(data => setNotifPrefs(prev => ({ ...prev, ...data })))
      .catch(() => {});
  }, [sessionId]);

  const updateNotifPref = (key: keyof typeof notifPrefs) => {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    fetch('/api/notifications/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, ...updated }),
    }).catch(() => {});
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('gate_theme', next);
  };

  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearProgress = () => {
    if (confirm('Clear all progress? This cannot be undone.')) {
      localStorage.removeItem('gate_session_id');
      document.cookie = 'gate_sid=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      window.location.reload();
    }
  };

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      <motion.h1 variants={fadeInUp} className="text-xl font-bold text-surface-100">
        Settings
      </motion.h1>

      {/* Theme */}
      <motion.div variants={fadeInUp} className="p-4 rounded-xl bg-surface-900 border border-surface-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-surface-200">Theme</p>
            <p className="text-xs text-surface-500">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</p>
          </div>
          <button
            onClick={toggleTheme}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-800 border border-surface-700 hover:bg-surface-700 transition-colors active:scale-95"
          >
            <motion.div
              key={theme}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-sky-400" />}
            </motion.div>
          </button>
        </div>
      </motion.div>

      {/* Session */}
      <motion.div variants={fadeInUp} className="p-4 rounded-xl bg-surface-900 border border-surface-800 space-y-3">
        <p className="text-sm font-medium text-surface-200">Session</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs text-surface-500 bg-surface-800 px-3 py-2 rounded-lg truncate">
            {sessionId}
          </code>
          <button
            onClick={copySessionId}
            className="p-2 rounded-lg bg-surface-800 hover:bg-surface-700 transition-colors active:scale-95"
          >
            <motion.div
              key={copied ? 'check' : 'copy'}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} className="text-surface-400" />}
            </motion.div>
          </button>
        </div>
        <p className="text-xs text-surface-600">
          Your progress is tied to this session ID. Save it to restore progress on another device.
        </p>
      </motion.div>

      {/* Storage Mode (DB-less GBrain) */}
      <motion.div variants={fadeInUp} className="p-4 rounded-xl bg-surface-900 border border-surface-800 space-y-3">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-sky-400" />
          <p className="text-sm font-medium text-surface-200">Storage Mode</p>
        </div>
        <p className="text-xs text-surface-500 leading-relaxed">
          Where your student state (mastery, errors, attempts) is saved. IndexedDB
          keeps everything on your device — required for material grounding.
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {([
            { id: 'auto' as StorageMode, label: 'Auto', icon: Cpu, desc: 'Best of both' },
            { id: 'indexeddb' as StorageMode, label: 'Local', icon: HardDrive, desc: 'On-device' },
            { id: 'postgres' as StorageMode, label: 'Cloud', icon: Database, desc: 'Sync across' },
          ]).map(opt => (
            <button
              key={opt.id}
              onClick={() => setStorageMode(opt.id)}
              className={`p-2 rounded-lg border transition-colors text-left ${
                storageMode === opt.id
                  ? 'bg-sky-500/10 border-sky-500/40'
                  : 'bg-surface-800 border-surface-700 hover:border-surface-600'
              }`}
            >
              <opt.icon size={12} className={storageMode === opt.id ? 'text-sky-400 mb-1' : 'text-surface-500 mb-1'} />
              <p className={`text-xs font-medium ${storageMode === opt.id ? 'text-sky-300' : 'text-surface-300'}`}>{opt.label}</p>
              <p className="text-[10px] text-surface-500">{opt.desc}</p>
            </button>
          ))}
        </div>
        <div className="text-[10px] text-surface-600">
          Currently active: <span className="text-surface-400 font-mono">{effectiveMode}</span>
          {groundingCount > 0 && <span> · {groundingCount} material chunks</span>}
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div variants={fadeInUp} className="p-4 rounded-xl bg-surface-900 border border-surface-800 space-y-4">
        <p className="text-sm font-medium text-surface-200">Notifications</p>
        {([
          { key: 'email_digest' as const, label: 'Weekly Email Digest', desc: 'Problems solved, accuracy, weak topics', icon: Mail },
          { key: 'streak_reminders' as const, label: 'Streak Reminders', desc: 'Get notified when your streak is at risk', icon: Zap },
          { key: 'push_enabled' as const, label: 'Push Notifications', desc: 'Daily practice reminders in your browser', icon: Bell },
        ]).map(({ key, label, desc, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon size={16} className="text-surface-400" />
              <div>
                <p className="text-sm text-surface-200">{label}</p>
                <p className="text-xs text-surface-500">{desc}</p>
              </div>
            </div>
            <button
              onClick={() => updateNotifPref(key)}
              className={`w-10 h-6 rounded-full transition-colors ${notifPrefs[key] ? 'bg-emerald-500' : 'bg-surface-700'}`}
            >
              <motion.div
                className="w-4 h-4 rounded-full bg-white shadow"
                animate={{ x: notifPrefs[key] ? 18 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        ))}
      </motion.div>

      {/* Community Data Sharing (opt-in) */}
      <motion.div variants={fadeInUp} className="p-4 rounded-xl bg-surface-900 border border-surface-800 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-surface-200">Help improve GBrain</h2>
          <p className="text-xs text-surface-500 mt-1">
            Send anonymized stats (concept, error type, misconception — never your name, text, or answers)
            to help the population-level misconception library grow. Off by default.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap size={16} className="text-surface-400" />
            <div>
              <p className="text-sm text-surface-200">Anonymous aggregation</p>
              <p className="text-xs text-surface-500">Batched every 5 min · cancelable anytime</p>
            </div>
          </div>
          <button
            onClick={toggleAggregateOptIn}
            className={`w-10 h-6 rounded-full transition-colors ${aggregateOptIn ? 'bg-emerald-500' : 'bg-surface-700'}`}
          >
            <motion.div
              className="w-4 h-4 rounded-full bg-white shadow"
              animate={{ x: aggregateOptIn ? 18 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </motion.div>

      {/* Danger Zone */}
      <motion.div variants={fadeInUp} className="p-4 rounded-xl bg-surface-900 border border-red-500/20">
        <button
          onClick={clearProgress}
          className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors active:scale-[0.98]"
        >
          <Trash2 size={16} />
          <span>Clear all progress and start fresh</span>
        </button>
      </motion.div>

      {/* About */}
      <motion.div variants={fadeInUp} className="text-center text-xs text-surface-600 space-y-1 pt-4">
        <p>GATE Engineering Mathematics Practice</p>
        <p>Powered by RAG + LLM Dual-Solve + Wolfram Alpha</p>
      </motion.div>
    </motion.div>
  );
}
