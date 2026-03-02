import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Search,
  Sun,
  Moon,
  Settings,
  LogOut,
  User,
  ChevronDown,
  Check,
  AlertCircle,
  Info,
  AlertTriangle,
  MessageSquare,
  Command,
  Zap,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { clsx } from 'clsx';
import { SmartNotifications } from '@/components/ux/UXEnhancements';

const roleConfig: Record<string, { icon: string; label: string; color: string }> = {
  ceo:     { icon: '👔', label: 'CEO',     color: 'from-purple-500 to-pink-500' },
  admin:   { icon: '⚙️', label: 'Admin',   color: 'from-blue-500 to-cyan-500' },
  manager: { icon: '🎧', label: 'Manager', color: 'from-teal-500 to-green-500' },
  teacher: { icon: '👩‍🏫', label: 'Teacher', color: 'from-green-500 to-emerald-500' },
  student: { icon: '🎓', label: 'Student', color: 'from-orange-500 to-red-500' },
};

// ── Command Bar (CEO/Admin) ───────────────────────────────────────────────────

function CommandBar() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setExpanded(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex-1 max-w-xl">
      {expanded ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onBlur={() => { if (!query) setExpanded(false); }}
            placeholder="Search anything... (Esc to close)"
            className="input pl-9 pr-4"
            autoFocus
          />
        </motion.div>
      ) : (
        <button
          onClick={() => { setExpanded(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-800/60 border border-surface-700/50 hover:bg-surface-800 hover:border-surface-600 transition-all text-surface-400 hover:text-surface-300 text-sm w-full max-w-sm"
        >
          <Search className="w-4 h-4" />
          <span className="flex-1 text-left">Search anything...</span>
          <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 bg-surface-700/60 rounded text-[10px] text-surface-500 font-mono">
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        </button>
      )}
    </div>
  );
}

export function Header() {
  const { theme, toggleTheme, notifications, markNotificationRead, sidebarOpen, userRole, setUserRole } = useAppStore();
  const isSimpleRole = userRole === 'student' || userRole === 'teacher';
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const notificationIcon = {
    info: Info,
    success: Check,
    warning: AlertTriangle,
    error: AlertCircle,
  };

  const notificationColor = {
    info: 'text-blue-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  };

  return (
    <header
      className={clsx(
        'fixed top-0 right-0 h-16 glass border-b border-surface-700/50 z-30 flex items-center justify-between px-4 gap-3 transition-all duration-200',
        sidebarOpen ? 'left-[240px]' : 'left-[56px]'
      )}
    >
      {/* Left: Command bar (CEO/Admin/Manager) or spacer */}
      {!isSimpleRole ? (
        <CommandBar />
      ) : (
        <div className="flex-1" />
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {/* AI Quick Ask (CEO/Admin) */}
        {!isSimpleRole && (
          <button
            onClick={() => navigate('/chat')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-500/10 border border-accent-500/20 text-accent-400 hover:bg-accent-500/20 text-sm font-medium transition-all"
            title="Quick chat with AI"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden md:inline">Ask AI</span>
            <Zap className="w-3 h-3 text-accent-300" />
          </button>
        )}

        {/* ── Role Chip — always visible ── */}
        <div className="relative">
          <button
            onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r ${roleConfig[userRole].color} text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm`}
          >
            <span className="text-sm leading-none">{roleConfig[userRole].icon}</span>
            <span className="uppercase tracking-wide">{roleConfig[userRole].label}</span>
            <ChevronDown className="w-3 h-3 opacity-80" />
          </button>

          <AnimatePresence>
            {showRoleSwitcher && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowRoleSwitcher(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-44 glass rounded-xl shadow-xl z-50 overflow-hidden"
                >
                  <div className="p-2 border-b border-surface-700/50">
                    <p className="text-[10px] text-surface-400 px-2 uppercase tracking-wider">Preview as:</p>
                  </div>
                  <div className="p-2">
                    {(Object.keys(roleConfig) as Array<keyof typeof roleConfig>).map((role) => (
                      <button
                        key={role}
                        onClick={() => {
                          setUserRole(role as import('@/types').UserRole);
                          setShowRoleSwitcher(false);
                          navigate('/');
                        }}
                        className={clsx(
                          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-left',
                          userRole === role ? 'bg-primary-500/20 text-primary-400' : 'hover:bg-surface-800'
                        )}
                      >
                        <span className="text-base">{roleConfig[role].icon}</span>
                        <span className="text-sm">{roleConfig[role].label}</span>
                        {userRole === role && <Check className="w-3.5 h-3.5 ml-auto" />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 hover:bg-surface-800 rounded-lg transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-yellow-400" />
          ) : (
            <Moon className="w-5 h-5 text-primary-500" />
          )}
        </button>

        {/* ── Smart AI Notifications ── */}
        <SmartNotifications />

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 hover:bg-surface-800 rounded-lg transition-colors relative"
          >
            <Bell className="w-5 h-5 text-surface-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-80 glass rounded-xl shadow-xl z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-surface-700/50 flex items-center justify-between">
                    <h3 className="font-semibold">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-xs bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-surface-500">
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No notifications</p>
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((notification) => {
                        const Icon = notificationIcon[notification.type];
                        return (
                          <div
                            key={notification.id}
                            onClick={() => markNotificationRead(notification.id)}
                            className={clsx(
                              'p-4 border-b border-surface-700/30 hover:bg-surface-800/50 cursor-pointer transition-colors',
                              !notification.read && 'bg-primary-500/5'
                            )}
                          >
                            <div className="flex gap-3">
                              <div className={clsx('mt-0.5', notificationColor[notification.type])}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{notification.title}</p>
                                <p className="text-sm text-surface-400 line-clamp-2">{notification.message}</p>
                                <p className="text-xs text-surface-500 mt-1">
                                  {new Date(notification.timestamp).toLocaleTimeString()}
                                </p>
                              </div>
                              {!notification.read && (
                                <div className="w-2 h-2 rounded-full bg-primary-500 mt-2" />
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 p-2 hover:bg-surface-800 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          </button>

          <AnimatePresence>
            {showProfile && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-56 glass rounded-xl shadow-xl z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-surface-700/50">
                    <p className="font-semibold">Giri</p>
                    <p className="text-sm text-surface-400">giri@mathconcepts.com</p>
                  </div>
                  <div className="p-2">
                    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-800 transition-colors text-left">
                      <User className="w-4 h-4 text-surface-400" />
                      <span className="text-sm">Profile</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-800 transition-colors text-left">
                      <Settings className="w-4 h-4 text-surface-400" />
                      <span className="text-sm">Settings</span>
                    </button>
                    <hr className="my-2 border-surface-700/50" />
                    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors text-left">
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm">Sign out</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
