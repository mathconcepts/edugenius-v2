/**
 * Header — Clean, 3-element layout
 * Left: page title (dynamic from route)
 * Center: breathing room
 * Right: theme toggle + avatar dropdown (role switcher + logout)
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun, Moon, Settings, LogOut, User, Check, Bell,
  AlertCircle, Info, AlertTriangle,
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

// Route → page title map
const routeTitles: Record<string, string> = {
  '/':                      'Dashboard',
  '/briefing':              'Daily Brief',
  '/create-exam':           'Create Exam',
  '/opportunity-discovery': 'Intelligence',
  '/students':              'People',
  '/settings':              'Settings',
  '/chat':                  'AI Chat',
  '/learn':                 'Study',
  '/notebook':              'Notebook',
  '/progress':              'Progress',
  '/content':               'Content',
  '/analytics':             'Analytics',
  '/users':                 'Users',
  '/manager':               'Dashboard',
  '/feedback':              'Tickets',
  '/agents':                'Agents',
  '/integrations':          'Integrations',
  '/strategy':              'Strategy',
  '/revenue':               'Revenue',
  '/prism':                 'Prism',
  '/blog':                  'Blog',
  '/exam-analytics':        'Exam Analytics',
  '/connections':           'Connections',
  '/status':                'System Status',
  '/trace':                 'Trace Explorer',
  '/autonomy-settings':     'Autonomy',
  '/practice':              'Practice',
  '/insights':              'Exam Tips',
  '/network':               'Community',
};

function usePageTitle(): string {
  const location = useLocation();
  // Try exact match first
  if (routeTitles[location.pathname]) return routeTitles[location.pathname];
  // Try prefix match (e.g. /agents/scout)
  const prefix = '/' + location.pathname.split('/')[1];
  return routeTitles[prefix] ?? 'EduGenius';
}

// ── Keyboard shortcut for ⌘K (search) — no button, just handler ──────────────
function useCommandBar() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Could dispatch a global event here; for now just prevent default
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}

export function Header() {
  const { theme, toggleTheme, notifications, markNotificationRead, sidebarOpen, userRole, setUserRole } = useAppStore();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const pageTitle = usePageTitle();

  useCommandBar();

  const unreadCount = notifications.filter(n => !n.read).length;

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
        'fixed top-0 right-0 h-16 glass border-b border-surface-700/50 z-30 flex items-center px-5 gap-4 transition-all duration-200',
        sidebarOpen ? 'left-[220px]' : 'left-[56px]'
      )}
    >
      {/* Left: page title */}
      <h1 className="text-base font-semibold text-white tracking-tight truncate flex-1">
        {pageTitle}
      </h1>

      {/* Center: breathing room (implicit flex-1 above handles this) */}

      {/* Right: compact actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">

        {/* Smart AI notifications (existing component) */}
        <SmartNotifications />

        {/* Bell — only show when there are unread notifications */}
        {unreadCount > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 hover:bg-surface-800 rounded-lg transition-colors relative"
            >
              <Bell className="w-5 h-5 text-surface-400" />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
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
                      <span className="text-xs bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded-full">
                        {unreadCount} new
                      </span>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.slice(0, 10).map(notification => {
                        const Icon = notificationIcon[notification.type];
                        return (
                          <div
                            key={notification.id}
                            onClick={() => markNotificationRead(notification.id)}
                            className={clsx(
                              'p-3.5 border-b border-surface-700/30 hover:bg-surface-800/50 cursor-pointer transition-colors',
                              !notification.read && 'bg-primary-500/5'
                            )}
                          >
                            <div className="flex gap-3">
                              <div className={clsx('mt-0.5', notificationColor[notification.type])}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{notification.title}</p>
                                <p className="text-xs text-surface-400 line-clamp-2">{notification.message}</p>
                              </div>
                              {!notification.read && <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 flex-shrink-0" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          className="p-2 hover:bg-surface-800 rounded-lg transition-colors"
        >
          {theme === 'dark'
            ? <Sun className="w-4.5 h-4.5 text-yellow-400" />
            : <Moon className="w-4.5 h-4.5 text-primary-500" />}
        </button>

        {/* Avatar — opens dropdown with role switcher + logout */}
        <div className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 p-1.5 hover:bg-surface-800 rounded-lg transition-colors"
          >
            <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${roleConfig[userRole].color} flex items-center justify-center`}>
              <span className="text-white text-xs font-bold leading-none">{roleConfig[userRole].icon}</span>
            </div>
          </button>

          <AnimatePresence>
            {showProfile && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-52 glass rounded-xl shadow-xl z-50 overflow-hidden"
                >
                  {/* Profile header */}
                  <div className="p-3.5 border-b border-surface-700/50">
                    <p className="font-semibold text-sm">Giri</p>
                    <p className="text-xs text-surface-400">giri@mathconcepts.com</p>
                  </div>

                  {/* Role switcher */}
                  <div className="p-2 border-b border-surface-700/30">
                    <p className="text-[10px] text-surface-500 px-2 mb-1.5 uppercase tracking-wider">Preview as</p>
                    {(Object.keys(roleConfig) as Array<keyof typeof roleConfig>).map(role => (
                      <button
                        key={role}
                        onClick={() => {
                          setUserRole(role as import('@/types').UserRole);
                          setShowProfile(false);
                          navigate('/');
                        }}
                        className={clsx(
                          'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors text-left',
                          userRole === role ? 'bg-primary-500/20 text-primary-400' : 'hover:bg-surface-800 text-surface-300'
                        )}
                      >
                        <span className="text-sm">{roleConfig[role].icon}</span>
                        <span className="text-sm">{roleConfig[role].label}</span>
                        {userRole === role && <Check className="w-3.5 h-3.5 ml-auto" />}
                      </button>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="p-2">
                    <button
                      onClick={() => { navigate('/settings'); setShowProfile(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-800 transition-colors text-left text-surface-300"
                    >
                      <Settings className="w-4 h-4 text-surface-400" />
                      <span className="text-sm">Settings</span>
                    </button>
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
