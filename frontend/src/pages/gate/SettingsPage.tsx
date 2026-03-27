/**
 * SettingsPage — Theme toggle + session info with animations.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSession } from '@/hooks/useSession';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { Moon, Sun, Copy, Check, Trash2 } from 'lucide-react';

export default function SettingsPage() {
  const sessionId = useSession();
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });

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
