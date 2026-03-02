/**
 * Sidebar — Role-adaptive, frugal navigation
 * CEO: grouped sections with collapsible headers
 * Student/Teacher: clean 4-5 items, prominent chat CTA
 * Redesigned: 56px collapsed, w-5 h-5 icons, gradient active pill, tooltips
 */
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Home, MessageSquare, BookOpen, Users, BarChart3, Settings, Bot, Zap,
  FileText, GraduationCap, ChevronLeft, ChevronRight, PlayCircle, User,
  BookMarked, Plug, Target, PenTool, MessageSquarePlus, Trophy, TrendingUp, Network, UserCheck, Headphones, Rocket, Activity, Compass, ClipboardList, Sparkles, Link2, Gem, DollarSign, ChevronDown,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

// ── CEO Section definitions ──────────────────────────────────────────────────

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  highlight?: boolean;
}

interface CEOSection {
  id: string;
  emoji: string;
  label: string;
  items: NavItem[];
}

const ceoSections: CEOSection[] = [
  {
    id: 'core',
    emoji: '🏠',
    label: 'Core',
    items: [
      { to: '/briefing', icon: ClipboardList, label: 'Daily Brief', highlight: true },
      { to: '/', icon: Home, label: 'Dashboard' },
      { to: '/strategy', icon: Target, label: 'Strategy' },
    ],
  },
  {
    id: 'intelligence',
    emoji: '📊',
    label: 'Intelligence',
    items: [
      { to: '/opportunity-discovery', icon: Compass, label: 'Opportunities', highlight: false },
      { to: '/prism', icon: Gem, label: 'Prism Intelligence', highlight: false },
      { to: '/revenue', icon: DollarSign, label: 'Revenue Intel', highlight: false },
      { to: '/content-intelligence', icon: Sparkles, label: 'Content Intel', highlight: false },
    ],
  },
  {
    id: 'people',
    emoji: '👥',
    label: 'People',
    items: [
      { to: '/users', icon: Users, label: 'Users' },
      { to: '/students', icon: GraduationCap, label: 'Students' },
      { to: '/admin/feedback', icon: MessageSquarePlus, label: 'Feedback' },
      { to: '/connections', icon: Network, label: 'Connections' },
    ],
  },
  {
    id: 'platform',
    emoji: '⚙️',
    label: 'Platform',
    items: [
      { to: '/agents', icon: Bot, label: 'Agents' },
      { to: '/integrations', icon: Plug, label: 'Integrations' },
      { to: '/create-exam', icon: Rocket, label: 'Create Exam' },
      { to: '/analytics', icon: BarChart3, label: 'Analytics' },
      { to: '/exam-analytics', icon: TrendingUp, label: 'Exam Analytics' },
      { to: '/content', icon: FileText, label: 'Content' },
      { to: '/blog', icon: PenTool, label: 'Blog' },
      { to: '/user-attributes', icon: UserCheck, label: 'User Attributes' },
      { to: '/events', icon: Zap, label: 'Events' },
    ],
  },
  {
    id: 'dev',
    emoji: '🔧',
    label: 'Dev',
    items: [
      { to: '/status', icon: Activity, label: 'System Status' },
      { to: '/trace', icon: Link2, label: 'Trace Explorer' },
      { to: '/autonomy-settings', icon: Settings, label: 'Autonomy' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

// ── Non-CEO role nav items ────────────────────────────────────────────────────

const roleNavItems = {
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
    { to: '/content-intelligence', icon: Sparkles, label: 'Content Intel' },
    { to: '/prism', icon: Gem, label: 'Prism Intelligence' },
    { to: '/blog', icon: PenTool, label: 'Blog' },
    { to: '/connections', icon: Network, label: 'Connections' },
    { to: '/user-attributes', icon: UserCheck, label: 'User Attributes' },
    { to: '/admin/feedback', icon: MessageSquarePlus, label: 'Feedback' },
    { to: '/analytics', icon: BarChart3, label: 'Reports' },
    { to: '/settings', icon: Settings, label: 'Settings' },
    { to: '/status', icon: Activity, label: 'System Status' },
    { to: '/trace', icon: Link2, label: 'Trace Explorer' },
  ],
  teacher: [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/chat', icon: MessageSquare, label: 'AI Chat', highlight: true },
    { to: '/students', icon: Users, label: 'Students' },
    { to: '/content-intelligence', icon: Sparkles, label: 'Content Intel' },
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
    { to: '/network', icon: Network, label: 'Community', highlight: false },
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

// ── Tooltip wrapper (for collapsed sidebar) ──────────────────────────────────

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-surface-800 border border-surface-700 text-xs text-white rounded-lg whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover/tip:opacity-100 transition-opacity">
        {label}
      </div>
    </div>
  );
}

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

// ── CEO Section Component ─────────────────────────────────────────────────────

function CEOSectionGroup({
  section,
  sidebarOpen,
  defaultOpen = true,
}: {
  section: CEOSection;
  sidebarOpen: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (!sidebarOpen) {
    // Collapsed: just show section emoji as divider + icons
    return (
      <div className="mb-1">
        <Tooltip label={section.label}>
          <div className="flex justify-center py-1 my-0.5">
            <span className="text-[10px] text-surface-600 select-none">{section.emoji}</span>
          </div>
        </Tooltip>
        {section.items.map(item => (
          <Tooltip key={item.to} label={item.label}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center justify-center p-2.5 rounded-xl transition-all mb-0.5',
                  isActive
                    ? 'bg-gradient-to-r from-primary-600/30 to-primary-500/20 text-primary-400'
                    : item.highlight
                      ? 'text-accent-300 hover:bg-accent-500/10'
                      : 'text-surface-400 hover:bg-surface-800/60 hover:text-white'
                )
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
            </NavLink>
          </Tooltip>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-1">
      {/* Section header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-800/40 transition-colors group"
      >
        <span className="text-sm">{section.emoji}</span>
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-widest text-surface-500 group-hover:text-surface-400 text-left">
          {section.label}
        </span>
        <ChevronDown className={clsx(
          'w-3 h-3 text-surface-600 transition-transform',
          open ? 'rotate-0' : '-rotate-90'
        )} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5 pl-1">
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2 rounded-xl transition-all',
                      isActive
                        ? 'bg-gradient-to-r from-primary-600/25 to-primary-500/15 text-primary-400 border border-primary-500/20'
                        : item.highlight
                          ? 'text-accent-300 hover:bg-accent-500/10 hover:text-accent-200'
                          : 'text-surface-400 hover:bg-surface-800/60 hover:text-white'
                    )
                  }
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className={clsx(
                    'font-medium text-sm truncate',
                    item.highlight && 'font-semibold'
                  )}>
                    {item.label}
                  </span>
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="my-1 mx-2 border-t border-surface-700/30" />
    </div>
  );
}

// ── Nav Item (non-CEO roles) ──────────────────────────────────────────────────

function NavItemLink({
  item,
  sidebarOpen,
}: {
  item: NavItem;
  sidebarOpen: boolean;
}) {
  const link = (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
          isActive
            ? 'bg-gradient-to-r from-primary-600/25 to-primary-500/15 text-primary-400 border border-primary-500/20'
            : item.highlight
              ? 'text-accent-300 hover:bg-accent-500/10 hover:text-accent-200'
              : 'text-surface-400 hover:bg-surface-800/60 hover:text-white',
          !sidebarOpen && 'justify-center'
        )
      }
    >
      <item.icon className="w-5 h-5 flex-shrink-0" />
      {sidebarOpen && (
        <span className={clsx(
          'font-medium text-sm',
          item.highlight && 'font-semibold'
        )}>
          {item.label}
        </span>
      )}
    </NavLink>
  );

  if (!sidebarOpen) {
    return <Tooltip label={item.label}>{link}</Tooltip>;
  }
  return link;
}

// ── Main Sidebar ─────────────────────────────────────────────────────────────

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, userRole, setUserRole } = useAppStore();
  const navigate = useNavigate();
  const isSimple = userRole === 'student' || userRole === 'teacher';
  const isCEO = userRole === 'ceo';

  const navItems = isCEO ? [] : (roleNavItems[userRole as keyof typeof roleNavItems] || roleNavItems.admin);

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 240 : 56 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
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
          className="p-1.5 hover:bg-surface-800 rounded-lg transition-colors flex-shrink-0 ml-auto"
        >
          {sidebarOpen
            ? <ChevronLeft className="w-4 h-4 text-surface-400" />
            : <ChevronRight className="w-4 h-4 text-surface-400" />}
        </button>
      </div>

      {/* Playground indicator (non-intrusive) */}
      {sidebarOpen && (
        <div className="px-4 py-1.5 border-b border-surface-700/30">
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

      {/* Simple role switcher for student/teacher (collapsed) */}
      {!sidebarOpen && (
        <div className="px-2 py-2 border-b border-surface-700/30">
          <Tooltip label="Switch role">
            <button
              onClick={() => setUserRole(userRole === 'student' ? 'teacher' : userRole === 'teacher' ? 'student' : 'ceo')}
              className="w-full flex items-center justify-center p-1.5 hover:bg-surface-800 rounded-lg transition-colors"
            >
              <User className="w-4 h-4 text-surface-500" />
            </button>
          </Tooltip>
        </div>
      )}

      {/* Streak badge (student) */}
      {userRole === 'student' && <StreakBadge streak={12} open={sidebarOpen} />}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {/* CEO: grouped sections */}
        {isCEO && ceoSections.map((section, i) => (
          <CEOSectionGroup
            key={section.id}
            section={section}
            sidebarOpen={sidebarOpen}
            defaultOpen={i < 2} /* Core + Intelligence open by default */
          />
        ))}

        {/* Non-CEO: flat nav */}
        {!isCEO && navItems.map(item => (
          <NavItemLink key={item.to} item={item} sidebarOpen={sidebarOpen} />
        ))}

        {/* Agent shortcuts (CEO only, expanded) */}
        {isCEO && sidebarOpen && (
          <>
            <div className="pt-2 pb-1">
              <p className="text-[10px] text-surface-500 px-3 uppercase tracking-wider">Agent Shortcuts</p>
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
                isActive ? 'bg-gradient-to-r from-primary-600/25 to-primary-500/15 text-primary-400 border border-primary-500/20' : 'text-surface-400 hover:bg-surface-800/60 hover:text-white')}>
              <Target className="w-5 h-5" />
              <span>Practice MCQs</span>
            </NavLink>
            <NavLink to="/insights" className={({ isActive }) =>
              clsx('flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm',
                isActive ? 'bg-gradient-to-r from-primary-600/25 to-primary-500/15 text-primary-400 border border-primary-500/20' : 'text-surface-400 hover:bg-surface-800/60 hover:text-white')}>
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
