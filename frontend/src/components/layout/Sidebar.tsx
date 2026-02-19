/**
 * Sidebar — Role-adaptive, frugal navigation
 * Student/Teacher: clean 4-5 items, prominent chat CTA
 * CEO/Admin: full power nav
 */
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Home, MessageSquare, BookOpen, Users, BarChart3, Settings, Bot, Zap,
  FileText, GraduationCap, ChevronLeft, ChevronRight, PlayCircle, User,
  BookMarked, Plug, Target, PenTool, MessageSquarePlus, Trophy, TrendingUp, Network, UserCheck, Headphones, Rocket, Activity, Compass,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

// ── Navigation definitions ──────────────────────────────────────────────────

const roleNavItems = {
  ceo: [
    { to: '/', icon: Home, label: 'Dashboard' },
    { to: '/opportunity-discovery', icon: Compass, label: 'Opportunities 🕵️', highlight: true },
    { to: '/create-exam', icon: Rocket, label: 'Create Exam' },
    { to: '/strategy', icon: Target, label: 'Strategy' },
    { to: '/agents', icon: Bot, label: 'Agents' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/exam-analytics', icon: TrendingUp, label: 'Exam Analytics' },
    { to: '/content', icon: FileText, label: 'Content' },
    { to: '/blog', icon: PenTool, label: 'Blog' },
    { to: '/users', icon: Users, label: 'Users' },
    { to: '/events', icon: Zap, label: 'Events' },
    { to: '/integrations', icon: Plug, label: 'Integrations' },
    { to: '/connections', icon: Network, label: 'Connections' },
    { to: '/user-attributes', icon: UserCheck, label: 'User Attributes' },
    { to: '/admin/feedback', icon: MessageSquarePlus, label: 'Feedback' },
    { to: '/settings', icon: Settings, label: 'Settings' },
    { to: '/status', icon: Activity, label: 'System Status' },
  ],
  manager: [
    { to: '/manager', icon: Headphones, label: 'My Dashboard', highlight: true },
    { to: '/users',   icon: Users,      label: 'Students' },
    { to: '/feedback', icon: MessageSquarePlus, label: 'Tickets' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  ],
  admin: [
    { to: '/', icon: Home, label: 'Dashboard' },
    { to: '/users', icon: Users, label: 'Users' },
    { to: '/exam-analytics', icon: TrendingUp, label: 'Exam Analytics' },
    { to: '/content', icon: FileText, label: 'Content' },
    { to: '/blog', icon: PenTool, label: 'Blog' },
    { to: '/connections', icon: Network, label: 'Connections' },
    { to: '/user-attributes', icon: UserCheck, label: 'User Attributes' },
    { to: '/admin/feedback', icon: MessageSquarePlus, label: 'Feedback' },
    { to: '/analytics', icon: BarChart3, label: 'Reports' },
    { to: '/settings', icon: Settings, label: 'Settings' },
    { to: '/status', icon: Activity, label: 'System Status' },
  ],
  teacher: [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/chat', icon: MessageSquare, label: 'AI Chat', highlight: true },
    { to: '/students', icon: Users, label: 'Students' },
    { to: '/exam-analytics', icon: TrendingUp, label: 'Exam Stats' },
    { to: '/content', icon: BookOpen, label: 'Lessons' },
    { to: '/analytics', icon: BarChart3, label: 'Progress' },
    { to: '/connections', icon: Network, label: 'Connections' },
  ],
  student: [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/chat', icon: MessageSquare, label: 'Ask Tutor', highlight: true },
    { to: '/learn', icon: GraduationCap, label: 'Study' },
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

// ── Streak indicator (student only) ─────────────────────────────────────────

function StreakBadge({ streak, open }: { streak: number; open: boolean }) {
  if (!open) return null;
  return (
    <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center gap-2">
      <span className="text-base">🔥</span>
      <div>
        <p className="text-xs font-semibold text-orange-300">{streak} day streak</p>
        <p className="text-[10px] text-orange-400/60">Keep it going!</p>
      </div>
    </div>
  );
}

// ── Main Sidebar ─────────────────────────────────────────────────────────────

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, userRole, setUserRole } = useAppStore();
  const navigate = useNavigate();
  const navItems = roleNavItems[userRole] || roleNavItems.ceo;
  const isSimple = userRole === 'student' || userRole === 'teacher';

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 240 : 64 }}
      className="fixed left-0 top-0 h-screen glass border-r border-surface-700/50 z-40 flex flex-col"
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-surface-700/50 flex-shrink-0">
        <AnimatePresence mode="wait">
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 px-1"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold text-sm">
                E
              </div>
              <span className="font-semibold gradient-text">EduGenius</span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={toggleSidebar}
          className="p-1.5 hover:bg-surface-800 rounded-lg transition-colors flex-shrink-0"
        >
          {sidebarOpen
            ? <ChevronLeft className="w-4 h-4 text-surface-400" />
            : <ChevronRight className="w-4 h-4 text-surface-400" />}
        </button>
      </div>

      {/* Playground indicator (non-intrusive) */}
      {sidebarOpen && (
        <div className="px-4 py-2 border-b border-surface-700/30">
          <div className="flex items-center gap-1.5">
            <PlayCircle className="w-3 h-3 text-accent-400" />
            <span className="text-[10px] text-accent-400/70 uppercase tracking-widest">Playground</span>
          </div>
        </div>
      )}

      {/* Role Switcher — only when expanded, only for CEO/Admin preview */}
      {sidebarOpen && !isSimple && (
        <div className="px-3 py-2 border-b border-surface-700/30">
          <p className="text-[10px] text-surface-500 mb-1.5 px-1 uppercase tracking-wider">View as</p>
          <div className="grid grid-cols-2 gap-1">
            {(['ceo', 'admin', 'manager', 'teacher', 'student'] as const).map(role => (
              <button
                key={role}
                onClick={() => { setUserRole(role); navigate('/'); }}
                className={clsx(
                  'px-2 py-1.5 rounded-lg text-xs font-medium transition-all',
                  userRole === role
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                    : 'bg-surface-800/50 text-surface-400 hover:text-white hover:bg-surface-700'
                )}
              >
                {role === 'ceo' ? 'CEO' : role.charAt(0).toUpperCase() + role.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Simple role switcher for student/teacher (just an icon) */}
      {!sidebarOpen && (
        <div className="px-2 py-2 border-b border-surface-700/30">
          <button
            onClick={() => setUserRole(userRole === 'student' ? 'teacher' : userRole === 'teacher' ? 'student' : 'ceo')}
            className="w-full flex items-center justify-center p-1.5 hover:bg-surface-800 rounded-lg transition-colors"
            title="Switch role"
          >
            <User className="w-4 h-4 text-surface-500" />
          </button>
        </div>
      )}

      {/* Streak badge (student) */}
      {userRole === 'student' && <StreakBadge streak={12} open={sidebarOpen} />}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
                isActive
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/20'
                  : (item as { highlight?: boolean }).highlight
                    ? 'text-accent-300 hover:bg-accent-500/10 hover:text-accent-200'
                    : 'text-surface-400 hover:bg-surface-800/60 hover:text-white',
                !sidebarOpen && 'justify-center'
              )
            }
          >
            <item.icon className={clsx(
              'flex-shrink-0',
              (item as { highlight?: boolean }).highlight ? 'w-5 h-5' : 'w-4.5 h-4.5 w-5 h-5'
            )} />
            {sidebarOpen && (
              <span className={clsx(
                'font-medium text-sm',
                (item as { highlight?: boolean }).highlight && 'font-semibold'
              )}>
                {item.label}
              </span>
            )}
          </NavLink>
        ))}

        {/* Agent shortcuts (CEO only, expanded) */}
        {userRole === 'ceo' && sidebarOpen && (
          <>
            <div className="pt-3 pb-1">
              <p className="text-[10px] text-surface-500 px-3 uppercase tracking-wider">Agents</p>
            </div>
            {agentShortcuts.map(agent => (
              <NavLink
                key={agent.id}
                to={`/agents/${agent.id}`}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all',
                    isActive ? 'bg-surface-800 text-white' : 'text-surface-400 hover:bg-surface-800/50 hover:text-white'
                  )
                }
              >
                <span className="text-base">{agent.emoji}</span>
                <span className="text-xs">{agent.label}</span>
              </NavLink>
            ))}
          </>
        )}

        {/* Student extra nav when expanded */}
        {userRole === 'student' && sidebarOpen && (
          <div className="pt-2 border-t border-surface-700/30 mt-2 space-y-0.5">
            <NavLink to="/practice" className={({ isActive }) =>
              clsx('flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm',
                isActive ? 'bg-primary-500/20 text-primary-400' : 'text-surface-400 hover:bg-surface-800/60 hover:text-white')}>
              <Target className="w-5 h-5" />
              <span>Practice MCQs</span>
            </NavLink>
            <NavLink to="/insights" className={({ isActive }) =>
              clsx('flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm',
                isActive ? 'bg-primary-500/20 text-primary-400' : 'text-surface-400 hover:bg-surface-800/60 hover:text-white')}>
              <Trophy className="w-5 h-5" />
              <span>Exam Tips</span>
            </NavLink>
          </div>
        )}
      </nav>

      {/* User info at bottom */}
      <div className="flex-shrink-0 p-2 border-t border-surface-700/50">
        <div className={clsx(
          'flex items-center gap-3 px-2 py-2 rounded-xl bg-surface-800/30',
          !sidebarOpen && 'justify-center'
        )}>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center flex-shrink-0">
            <User className="w-3.5 h-3.5 text-white" />
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {userRole === 'ceo' ? 'Giri (CEO)' :
                 userRole === 'admin' ? 'Admin' :
                 userRole === 'manager' ? 'Manager' :
                 userRole === 'teacher' ? 'Teacher' : 'Student'}
              </p>
              <p className="text-[10px] text-surface-500 capitalize">{userRole}</p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
