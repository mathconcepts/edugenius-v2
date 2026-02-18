import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Home,
  MessageSquare,
  BookOpen,
  Users,
  BarChart3,
  Settings,
  Bot,
  Zap,
  FileText,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  User,
  BookMarked,
  Plug,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

const roleNavItems = {
  ceo: [
    { to: '/', icon: Home, label: 'Dashboard' },
    { to: '/agents', icon: Bot, label: 'Agents' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/content', icon: FileText, label: 'Content' },
    { to: '/users', icon: Users, label: 'Users' },
    { to: '/events', icon: Zap, label: 'Events' },
    { to: '/integrations', icon: Plug, label: 'Integrations' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ],
  admin: [
    { to: '/', icon: Home, label: 'Dashboard' },
    { to: '/users', icon: Users, label: 'Users' },
    { to: '/content', icon: FileText, label: 'Content' },
    { to: '/analytics', icon: BarChart3, label: 'Reports' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ],
  teacher: [
    { to: '/', icon: Home, label: 'Dashboard' },
    { to: '/students', icon: Users, label: 'My Students' },
    { to: '/content', icon: BookOpen, label: 'Lessons' },
    { to: '/analytics', icon: BarChart3, label: 'Progress' },
    { to: '/chat', icon: MessageSquare, label: 'Help' },
  ],
  student: [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/learn', icon: GraduationCap, label: 'Learn' },
    { to: '/chat', icon: MessageSquare, label: 'Ask Sage' },
    { to: '/notebook', icon: BookMarked, label: 'Notebook' },
    { to: '/progress', icon: BarChart3, label: 'Progress' },
  ],
};

const agentShortcuts = [
  { id: 'scout', emoji: '🔍', label: 'Scout' },
  { id: 'atlas', emoji: '📚', label: 'Atlas' },
  { id: 'sage', emoji: '🎓', label: 'Sage' },
  { id: 'mentor', emoji: '👨‍🏫', label: 'Mentor' },
  { id: 'herald', emoji: '📢', label: 'Herald' },
  { id: 'forge', emoji: '⚙️', label: 'Forge' },
  { id: 'oracle', emoji: '📊', label: 'Oracle' },
];

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, playgroundConfig, setPlaygroundConfig } = useAppStore();
  const navItems = roleNavItems[playgroundConfig.role] || roleNavItems.ceo;

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 260 : 72 }}
      className="fixed left-0 top-0 h-screen glass border-r border-surface-700/50 z-40 flex flex-col"
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-surface-700/50">
        <AnimatePresence mode="wait">
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold">
                E
              </div>
              <span className="font-semibold text-lg gradient-text">EduGenius</span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={toggleSidebar}
          className="p-2 hover:bg-surface-800 rounded-lg transition-colors"
        >
          {sidebarOpen ? (
            <ChevronLeft className="w-5 h-5 text-surface-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-surface-400" />
          )}
        </button>
      </div>

      {/* Playground Toggle */}
      <div className="px-3 py-3 border-b border-surface-700/50">
        <div className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-500/10 border border-accent-500/30',
          !sidebarOpen && 'justify-center'
        )}>
          <PlayCircle className="w-4 h-4 text-accent-400" />
          {sidebarOpen && (
            <span className="text-sm text-accent-400 font-medium">Playground Mode</span>
          )}
        </div>
      </div>

      {/* Role Switcher */}
      {sidebarOpen && (
        <div className="px-3 py-3 border-b border-surface-700/50">
          <p className="text-xs text-surface-500 mb-2 px-2">View as:</p>
          <div className="grid grid-cols-2 gap-1">
            {(['ceo', 'admin', 'teacher', 'student'] as const).map((role) => (
              <button
                key={role}
                onClick={() => setPlaygroundConfig({ role })}
                className={clsx(
                  'px-2 py-1.5 rounded text-xs font-medium transition-all',
                  playgroundConfig.role === role
                    ? 'bg-primary-500 text-white'
                    : 'bg-surface-800 text-surface-400 hover:text-white hover:bg-surface-700'
                )}
              >
                {role === 'ceo' ? 'CEO' : role.charAt(0).toUpperCase() + role.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                isActive
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                  : 'text-surface-400 hover:bg-surface-800 hover:text-white',
                !sidebarOpen && 'justify-center'
              )
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="font-medium">{item.label}</span>}
          </NavLink>
        ))}

        {/* Agent Shortcuts (CEO only) */}
        {playgroundConfig.role === 'ceo' && sidebarOpen && (
          <>
            <div className="pt-4 pb-2">
              <p className="text-xs text-surface-500 px-3 uppercase tracking-wider">Agents</p>
            </div>
            {agentShortcuts.map((agent) => (
              <NavLink
                key={agent.id}
                to={`/agents/${agent.id}`}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-all',
                    isActive
                      ? 'bg-surface-800 text-white'
                      : 'text-surface-400 hover:bg-surface-800/50 hover:text-white'
                  )
                }
              >
                <span className="text-lg">{agent.emoji}</span>
                <span className="text-sm">{agent.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User / Bottom */}
      <div className="p-3 border-t border-surface-700/50">
        <div className={clsx(
          'flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-800/50',
          !sidebarOpen && 'justify-center'
        )}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {playgroundConfig.role === 'ceo' ? 'Giri (CEO)' : 
                 playgroundConfig.role === 'admin' ? 'Admin User' :
                 playgroundConfig.role === 'teacher' ? 'Teacher User' : 'Student User'}
              </p>
              <p className="text-xs text-surface-500 capitalize">{playgroundConfig.role}</p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
